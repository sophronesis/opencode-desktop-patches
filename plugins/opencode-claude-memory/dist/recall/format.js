import { RECALLED_MEMORIES_HEADING } from "../prompt/systemPrompt.js";
import { readMemoryBody, surfaceKey } from "../store/scan.js";
const MAX_MEMORY_LINES = 200;
const MAX_MEMORY_BYTES = 4096;
const encoder = new TextEncoder();
export function truncateMemoryContent(content) {
    const maxLines = content.split("\n").slice(0, MAX_MEMORY_LINES);
    const lineTruncated = maxLines.join("\n");
    if (encoder.encode(lineTruncated).length <= MAX_MEMORY_BYTES) {
        return lineTruncated;
    }
    const lines = lineTruncated.split("\n");
    const kept = [];
    let usedBytes = 0;
    for (const line of lines) {
        const candidate = kept.length === 0 ? line : `\n${line}`;
        const candidateBytes = encoder.encode(candidate).length;
        if (usedBytes + candidateBytes > MAX_MEMORY_BYTES)
            break;
        kept.push(line);
        usedBytes += candidateBytes;
    }
    return kept.join("\n");
}
function recalledMemoryFromHeader(header, content, now) {
    return {
        fileName: header.filename,
        filePath: header.filePath,
        name: header.name,
        type: header.type,
        description: header.description,
        content: truncateMemoryContent(content),
        ageInDays: Math.max(0, Math.floor((now - header.mtimeMs) / (1000 * 60 * 60 * 24))),
    };
}
export function recallSelectedMemories(headers, selectedFilenames, alreadySurfaced = new Set(), options = {}) {
    if (selectedFilenames.length === 0)
        return [];
    const maxMemories = options.maxMemories ?? 5;
    const now = options.now ?? Date.now();
    const byFilename = new Map(headers.map((header) => [header.filename, header]));
    const recalled = [];
    const seen = new Set();
    for (const filename of selectedFilenames) {
        if (seen.has(filename))
            continue;
        seen.add(filename);
        const header = byFilename.get(filename);
        if (!header || alreadySurfaced.has(surfaceKey(header)))
            continue;
        recalled.push(recalledMemoryFromHeader(header, readMemoryBody(header.filePath), now));
        if (recalled.length >= maxMemories)
            break;
    }
    return recalled;
}
function formatAgeWarning(ageInDays) {
    if (ageInDays <= 1)
        return "";
    return `\n> This memory is ${ageInDays} days old. Memories are point-in-time observations, not live state — claims about code behavior or file:line citations may be outdated. Verify against current code before asserting as fact.\n`;
}
export function formatRecalledMemories(memories) {
    if (memories.length === 0)
        return "";
    const sections = memories.map((memory) => {
        const ageWarning = formatAgeWarning(memory.ageInDays);
        return `### ${memory.name} (${memory.type})${ageWarning}\n${memory.content}`;
    });
    return [
        RECALLED_MEMORIES_HEADING,
        "",
        "The following memories were automatically selected as relevant to this conversation. They may be outdated — verify against current state before relying on them.",
        "",
        sections.join("\n\n"),
    ].join("\n");
}
