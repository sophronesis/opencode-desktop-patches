import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, sep } from "node:path";
import { parseFrontmatter, parseFrontmatterHeader, parseMemoryType } from "./frontmatter.js";
import { ENTRYPOINT_NAME, MAX_MEMORY_FILES } from "./paths.js";
export function toPosixRelative(relativePath) {
    return sep === "/" ? relativePath : relativePath.split(sep).join("/");
}
export function nameFromFilename(filename) {
    return basename(filename).replace(/\.md$/, "");
}
// Identity used to avoid surfacing the same memory twice in one conversation.
export function surfaceKey(header) {
    return `${header.name}|${header.type}`;
}
function headerFrom(filename, filePath, mtimeMs, parsed) {
    return {
        filename,
        filePath,
        mtimeMs,
        name: parsed.frontmatter.name ?? nameFromFilename(filename),
        description: parsed.frontmatter.description ?? "",
        type: parseMemoryType(parsed.frontmatter.type) ?? "user",
        hasFrontmatter: parsed.hasFrontmatter,
    };
}
export function readMemoryHeader(memoryDir, filename) {
    const filePath = join(memoryDir, ...filename.split("/"));
    try {
        const raw = readFileSync(filePath, "utf-8");
        const mtimeMs = statSync(filePath).mtimeMs;
        return headerFrom(filename, filePath, mtimeMs, parseFrontmatterHeader(raw));
    }
    catch {
        return null;
    }
}
export function readMemoryEntry(memoryDir, filename) {
    const filePath = join(memoryDir, ...filename.split("/"));
    try {
        const raw = readFileSync(filePath, "utf-8");
        const mtimeMs = statSync(filePath).mtimeMs;
        const parsed = parseFrontmatter(raw);
        return { ...headerFrom(filename, filePath, mtimeMs, parsed), body: parsed.body, raw };
    }
    catch {
        return null;
    }
}
// Reads a memory body through the same parser the scanner uses.
export function readMemoryBody(filePath) {
    try {
        return parseFrontmatter(readFileSync(filePath, "utf-8")).body;
    }
    catch {
        return "";
    }
}
// Own directory walk instead of `readdirSync({ recursive })`: symbolic links (files or directories)
// are never followed, so a link planted in the memory directory cannot pull outside files into the
// manifest or into recall. Whether the runtime's recursive readdir follows links is not relied on.
function listMarkdownFiles(memoryDir, recursive) {
    const out = [];
    const walk = (dir, prefix) => {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            const name = String(entry.name);
            const relative = prefix ? `${prefix}/${name}` : name;
            if (entry.isSymbolicLink())
                continue;
            if (entry.isDirectory()) {
                if (recursive)
                    walk(join(dir, name), relative);
            }
            else if (entry.isFile() && name.endsWith(".md") && name !== ENTRYPOINT_NAME) {
                out.push(relative);
            }
        }
    };
    walk(memoryDir, "");
    return out;
}
/**
 * Port of Claude Code's scanMemoryFiles(): recursive scan of the memory directory, header-only
 * parsing, sorted by mtime desc and capped at MAX_MEMORY_FILES.
 */
export function scanMemoryFiles(memoryDir, options = {}) {
    const headers = [];
    for (const entry of listMarkdownFiles(memoryDir, options.recursive ?? true)) {
        const header = readMemoryHeader(memoryDir, entry);
        if (header)
            headers.push(header);
    }
    return headers.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_MEMORY_FILES);
}
// Port of Claude Code's formatMemoryManifest():
// `- [type] filename (ISO timestamp): description` per line
export function formatMemoryManifest(memories) {
    return memories
        .map((m) => {
        const ts = new Date(m.mtimeMs).toISOString();
        return m.description
            ? `- [${m.type}] ${m.filename} (${ts}): ${m.description}`
            : `- [${m.type}] ${m.filename} (${ts})`;
    })
        .join("\n");
}
