import type { MemoryStore } from "../store/MemoryStore.js";
export declare const AUTO_MEMORY_MARKER = "<!-- opencode-claude-memory -->";
export declare const RECALLED_MEMORIES_HEADING = "## Recalled Memories";
export type BuildMemorySystemPromptOptions = {
    includeIndex?: boolean;
};
export declare function buildMemorySystemPrompt(store: Pick<MemoryStore, "memoryDir" | "projectDir" | "readIndex"> & {
    readOnly?: boolean;
}, recalledMemoriesSection?: string, options?: BuildMemorySystemPromptOptions): string;
