import { type MemoryType } from "./frontmatter.js";
export type MemoryHeader = {
    filename: string;
    filePath: string;
    mtimeMs: number;
    name: string;
    description: string;
    type: MemoryType;
    hasFrontmatter: boolean;
};
export type MemoryEntry = MemoryHeader & {
    body: string;
    raw: string;
};
export declare function toPosixRelative(relativePath: string): string;
export declare function nameFromFilename(filename: string): string;
export declare function surfaceKey(header: Pick<MemoryHeader, "name" | "type">): string;
export declare function readMemoryHeader(memoryDir: string, filename: string): MemoryHeader | null;
export declare function readMemoryEntry(memoryDir: string, filename: string): MemoryEntry | null;
export declare function readMemoryBody(filePath: string): string;
export type ScanOptions = {
    recursive?: boolean;
};
/**
 * Port of Claude Code's scanMemoryFiles(): recursive scan of the memory directory, header-only
 * parsing, sorted by mtime desc and capped at MAX_MEMORY_FILES.
 */
export declare function scanMemoryFiles(memoryDir: string, options?: ScanOptions): MemoryHeader[];
export declare function formatMemoryManifest(memories: readonly MemoryHeader[]): string;
