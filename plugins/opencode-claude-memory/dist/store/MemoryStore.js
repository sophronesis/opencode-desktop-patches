import { createHash } from "node:crypto";
import { cpSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, unlinkSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { writeFileAtomicSync } from "../util/exclusiveFile.js";
import { resolveAutoMemoryDirectory } from "./autoMemoryDirectory.js";
import { buildFrontmatter, editFrontmatter, FRONTMATTER_MAX_LINES, frontmatterKeys, ORIGIN, parseFrontmatter, parseMemoryType, } from "./frontmatter.js";
import { buildIndexPointer, findIndexPointerLine, readIndexFile, removeIndexLine, upsertIndexLine, } from "./indexFile.js";
import { ENTRYPOINT_NAME, findCanonicalGitRoot, findGitRoot, MAX_MEMORY_FILE_BYTES, resolveMemoryFilePath, sanitizePath, } from "./paths.js";
import { formatMemoryManifest, nameFromFilename, readMemoryEntry, scanMemoryFiles, } from "./scan.js";
function realDirectory(directory) {
    const absolute = resolve(directory);
    try {
        // Filesystems such as ext4 can keep canonically equivalent Unicode names distinct.
        return realpathSync.native(absolute);
    }
    catch {
        // Resolve existing ancestors too: read-only stores and private state may not exist yet,
        // but their parents can still contain symlinks.
        const parent = dirname(absolute);
        return parent === absolute ? absolute : join(realDirectory(parent), basename(absolute));
    }
}
function containsDirectory(root, directory) {
    const fromRoot = relative(root, directory);
    return fromRoot === "" || (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${sep}`));
}
// Owns the resolved memory paths for one project. Path resolution (git root, worktree canonical
// root, sanitised project key) happens exactly once, in the constructor.
export class MemoryStore {
    memoryRoot;
    gitRoot;
    canonicalRoot;
    claudeConfigDir;
    projectDir;
    memoryDir;
    usesDefaultMemoryDirectory;
    entrypoint;
    // Plugin-private state (extraction watermarks, auto-dream gate) lives next to, not inside, the
    // Claude Code project directory so Claude Code never sees it.
    stateDir;
    // Shared by every project targeting this memory directory; watermarks stay project-scoped.
    maintenanceLockPath;
    readOnly;
    now;
    constructor(memoryRoot, options) {
        this.memoryRoot = memoryRoot;
        this.gitRoot = findGitRoot(memoryRoot);
        this.canonicalRoot = findCanonicalGitRoot(memoryRoot) ?? memoryRoot;
        this.claudeConfigDir = options.claudeConfigDir;
        this.readOnly = options.readOnly ?? false;
        this.now = options.now ?? (() => new Date());
        const projectKey = sanitizePath(this.canonicalRoot);
        this.projectDir = join(this.claudeConfigDir, "projects", projectKey);
        const defaultMemoryDir = join(this.projectDir, "memory");
        this.memoryDir = resolveAutoMemoryDirectory(options.autoMemoryDirectory, options.homeDir ?? "") ?? defaultMemoryDir;
        this.entrypoint = join(this.memoryDir, ENTRYPOINT_NAME);
        const directory = realDirectory(this.memoryDir);
        const privateRoot = join(this.claudeConfigDir, "opencode-memory");
        const privateDirectory = realDirectory(privateRoot);
        if (containsDirectory(directory, privateDirectory) || containsDirectory(privateDirectory, directory)) {
            throw new Error(`Memory directory must not overlap the plugin state directory: ${privateRoot}`);
        }
        if (!this.readOnly)
            mkdirSync(this.memoryDir, { recursive: true });
        this.usesDefaultMemoryDirectory = directory === realDirectory(defaultMemoryDir);
        const key = createHash("sha256").update(directory).digest("hex");
        const projectStateDir = join(privateRoot, projectKey);
        this.stateDir = this.usesDefaultMemoryDirectory ? projectStateDir : join(projectStateDir, "memory-stores", key);
        // Recognise the default Claude directory layout too, so an explicit override pointing to
        // another project's default store shares its existing maintenance lock.
        const fromProjects = relative(realDirectory(join(this.claudeConfigDir, "projects")), directory);
        const parts = fromProjects.split(sep);
        this.maintenanceLockPath =
            !isAbsolute(fromProjects) && parts.length === 2 && parts[0] !== ".." && parts[1] === "memory"
                ? join(privateRoot, parts[0] ?? "", "maintenance.lock")
                : join(privateRoot, "memory-stores", key, "maintenance.lock");
    }
    scan() {
        return scanMemoryFiles(this.memoryDir);
    }
    manifest() {
        return formatMemoryManifest(this.scan());
    }
    list(options = {}) {
        const entries = [];
        for (const header of this.scan()) {
            const entry = readMemoryEntry(this.memoryDir, header.filename);
            if (entry)
                entries.push(entry);
        }
        if ((options.sort ?? "name") === "name") {
            entries.sort((a, b) => (a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0));
        }
        return entries;
    }
    read(fileName) {
        const { relativePath } = resolveMemoryFilePath(this.memoryDir, fileName);
        return readMemoryEntry(this.memoryDir, relativePath);
    }
    save(input) {
        this.assertWritable();
        const { relativePath, filePath } = resolveMemoryFilePath(this.memoryDir, input.fileName);
        if (typeof input.name !== "string" || !input.name.trim()) {
            throw new Error("Memory name is required");
        }
        // Writes follow links, so a memory file that links to the index would overwrite MEMORY.md itself.
        if (isLinkTo(filePath, this.entrypoint)) {
            throw new Error(`Memory "${relativePath}" is a link to ${ENTRYPOINT_NAME}; saving it would overwrite the index`);
        }
        const existing = readTextFile(filePath);
        const parsed = existing === null ? null : parseFrontmatter(existing);
        const index = this.readIndex();
        const nextIndex = indexAfterSave(index, relativePath, input, parsed);
        if (parsed !== null && isUnchanged(parsed, relativePath, input)) {
            // The same memory: at most a missing index pointer is added, the file itself is not rewritten.
            if (nextIndex === index)
                return { filePath, fileName: relativePath, unchanged: true };
            this.writeIndex(nextIndex);
            return { filePath, fileName: relativePath, unchanged: false };
        }
        const modified = this.now().toISOString();
        const fileContent = existing === null || parsed === null
            ? `${buildFrontmatter({ ...input, modified })}\n\n${input.content.trim()}\n`
            : updatedFileContent(existing, parsed, input, modified);
        if (Buffer.byteLength(fileContent, "utf-8") > MAX_MEMORY_FILE_BYTES) {
            throw new Error(`Memory file content exceeds the ${MAX_MEMORY_FILE_BYTES}-byte limit`);
        }
        // Line-level edits keep every other frontmatter line, so the block can outgrow the window both
        // this plugin and Claude Code read it in; refuse rather than write a file they would both
        // treat as having no frontmatter.
        if (!parseFrontmatter(fileContent).hasFrontmatter) {
            throw new Error(`Memory "${relativePath}" frontmatter would exceed ${FRONTMATTER_MAX_LINES} lines; trim its frontmatter first`);
        }
        writeFileAtomicSync(filePath, fileContent);
        if (nextIndex !== index)
            this.writeIndex(nextIndex);
        return { filePath, fileName: relativePath, unchanged: false };
    }
    // Deleting a memory that is not purely this plugin's (Claude Code's, dsh's, a hand-written one, or
    // one of ours that another tool has since edited) first keeps a copy under the plugin's state
    // directory, as dsh-unified-memory does, so an auto-dream prune can never silently destroy
    // another tool's work.
    delete(fileName) {
        this.assertWritable();
        const { relativePath, filePath } = resolveMemoryFilePath(this.memoryDir, fileName);
        const existing = readTextFile(filePath);
        if (existing === null)
            return { deleted: false };
        let trashedTo;
        if (!isPurelyOwn(existing, filePath)) {
            const stamp = this.now().toISOString().replace(/[:.]/g, "-");
            trashedTo = join(this.stateDir, "trash", stamp, relativePath);
            mkdirSync(dirname(trashedTo), { recursive: true });
            cpSync(filePath, trashedTo, { preserveTimestamps: true });
        }
        try {
            unlinkSync(filePath);
        }
        catch {
            return { deleted: false };
        }
        this.writeIndex(removeIndexLine(this.readIndex(), relativePath));
        return trashedTo ? { deleted: true, trashedTo } : { deleted: true };
    }
    search(query) {
        const lowerQuery = query.toLowerCase();
        return this.list().filter((entry) => entry.name.toLowerCase().includes(lowerQuery) ||
            entry.description.toLowerCase().includes(lowerQuery) ||
            entry.body.toLowerCase().includes(lowerQuery));
    }
    readIndex() {
        return readIndexFile(this.entrypoint);
    }
    writeIndex(content) {
        writeFileAtomicSync(this.entrypoint, content);
    }
    // Defence in depth: in read-only mode nothing registers a writing tool or runs a writing fork, so
    // reaching this is a bug, and it must fail rather than touch Claude Code's files.
    assertWritable() {
        if (this.readOnly)
            throw new Error("Memory is read-only (readOnly: true)");
    }
}
// A memory's name and description as the scanner (and `read()`) reports them: missing fields
// count as their defaults.
function previousFields(parsed, relativePath) {
    return {
        name: parsed.frontmatter.name ?? nameFromFilename(relativePath),
        description: parsed.frontmatter.description ?? "",
    };
}
// Unchanged means the same name, description, type and body, whatever else the frontmatter holds,
// so an identical re-save neither bumps `modified` nor stamps provenance.
function isUnchanged(parsed, relativePath, input) {
    if (!parsed.hasFrontmatter)
        return false;
    const before = previousFields(parsed, relativePath);
    return (before.name === input.name &&
        before.description === input.description &&
        (parseMemoryType(parsed.frontmatter.type) ?? "user") === input.type &&
        parsed.body.replace(/\r\n/g, "\n") === input.content.trim().replace(/\r\n/g, "\n"));
}
// MEMORY.md after a save. Index lines are often hand-written (Claude Code's format is
// `- [Title](file.md) — one-line hook`, and neither part has to repeat the frontmatter), so an
// existing pointer is kept unless it is still exactly the line this plugin generates from the
// memory's previous description, titled with its previous name or with the title given now: only
// such a line follows a new title or description. A memory without a pointer gains one, titled
// with `title` (or the name when there is none). No other line is touched.
function indexAfterSave(raw, relativePath, input, parsed) {
    const title = input.title?.trim() || undefined;
    const pointer = buildIndexPointer(relativePath, title ?? input.name, input.description);
    const current = findIndexPointerLine(raw, relativePath);
    if (current === undefined)
        return upsertIndexLine(raw, relativePath, pointer);
    if (current === pointer || parsed === null)
        return raw;
    const before = previousFields(parsed, relativePath);
    const generatedBefore = [before.name, ...(title ? [title] : [])].map((label) => buildIndexPointer(relativePath, label, before.description));
    return generatedBefore.includes(current) ? upsertIndexLine(raw, relativePath, pointer) : raw;
}
// The frontmatter keys of a memory this plugin creates (buildFrontmatter), each on one line; its own
// later saves keep exactly this set.
const OWN_KEYS = ["name", "description", "metadata", "type", "origin", "modified"];
// How far a file's modification time may sit from this plugin's own `modified` stamp and still count
// as that write: the stamp is taken just before the write, and filesystems with coarse timestamps
// (FAT, HFS+) round the modification time down by up to 2 s.
const OWN_WRITE_SLACK_MS = 2_000;
// A memory is purely this plugin's when its frontmatter is exactly what this plugin writes, with
// `origin: opencode`, and the file has not changed since the plugin last wrote it. Other writers are
// recognised by what they leave: Claude Code's Write and Edit tools keep `origin` but add `node_type`
// and `originSessionId` and restamp `modified`, other tools add `updatedBy` or keys of their own
// (or a second `modified`), and an edit that stamps nothing moves the modification time away from
// our `modified`. Any doubt counts as "not ours": an unneeded copy in the trash is harmless, a
// missing one loses another tool's work.
function isPurelyOwn(content, filePath) {
    const keys = frontmatterKeys(content);
    if (keys?.length !== OWN_KEYS.length || !OWN_KEYS.every((key) => keys.includes(key)))
        return false;
    const { frontmatter } = parseFrontmatter(content);
    if (frontmatter.origin !== ORIGIN)
        return false;
    const stamped = Date.parse(frontmatter.modified ?? "");
    if (Number.isNaN(stamped))
        return false;
    try {
        return Math.abs(statSync(filePath).mtimeMs - stamped) <= OWN_WRITE_SLACK_MS;
    }
    catch {
        return false;
    }
}
function isLinkTo(path, other) {
    try {
        return lstatSync(path).isSymbolicLink() && realpathSync(path) === realpathSync(other);
    }
    catch {
        return false;
    }
}
function readTextFile(path) {
    try {
        return readFileSync(path, "utf-8");
    }
    catch {
        return null;
    }
}
// Updates an existing memory in place: name, description, type and body change, every other
// frontmatter line is kept. The type and `modified` are written wherever the file already keeps
// them (top level in older files, under `metadata:` otherwise, both when it has both), and a file
// this plugin did not create gains `metadata.updatedBy: opencode` while its own `origin` stays.
function updatedFileContent(existing, parsed, input, modified) {
    return editFrontmatter(existing, {
        set: { name: input.name, description: input.description },
        setWhereExists: { type: input.type, modified },
        setMeta: parsed.frontmatter.origin === ORIGIN ? {} : { updatedBy: ORIGIN },
        body: input.content,
    });
}
