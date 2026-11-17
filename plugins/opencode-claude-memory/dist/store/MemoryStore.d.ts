import { type MemoryType } from "./frontmatter.js";
import { type MemoryEntry, type MemoryHeader } from "./scan.js";
export type SaveMemoryInput = {
    fileName: string;
    name: string;
    description: string;
    type: MemoryType;
    content: string;
    title?: string;
};
export type SaveMemoryResult = {
    filePath: string;
    fileName: string;
    unchanged: boolean;
};
export type DeleteMemoryResult = {
    deleted: boolean;
    trashedTo?: string;
};
export type ListOptions = {
    sort?: "name" | "mtime";
};
export type MemoryStoreOptions = {
    claudeConfigDir: string;
    autoMemoryDirectory?: string;
    homeDir?: string;
    readOnly?: boolean;
    now?: () => Date;
};
export declare class MemoryStore {
    readonly memoryRoot: string;
    readonly gitRoot: string | null;
    readonly canonicalRoot: string;
    readonly claudeConfigDir: string;
    readonly projectDir: string;
    readonly memoryDir: string;
    readonly usesDefaultMemoryDirectory: boolean;
    readonly entrypoint: string;
    readonly stateDir: string;
    readonly maintenanceLockPath: string;
    readonly readOnly: boolean;
    private readonly now;
    constructor(memoryRoot: string, options: MemoryStoreOptions);
    scan(): MemoryHeader[];
    manifest(): string;
    list(options?: ListOptions): MemoryEntry[];
    read(fileName: string): MemoryEntry | null;
    save(input: SaveMemoryInput): SaveMemoryResult;
    delete(fileName: string): DeleteMemoryResult;
    search(query: string): MemoryEntry[];
    readIndex(): string;
    private writeIndex;
    private assertWritable;
}
