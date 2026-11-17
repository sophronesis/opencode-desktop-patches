import { type MemoryHeader } from "../store/scan.js";
export type RecalledMemory = {
    fileName: string;
    filePath: string;
    name: string;
    type: string;
    description: string;
    content: string;
    ageInDays: number;
};
export declare function truncateMemoryContent(content: string): string;
export type RecallSelectionOptions = {
    maxMemories?: number;
    now?: number;
};
export declare function recallSelectedMemories(headers: readonly MemoryHeader[], selectedFilenames: readonly string[], alreadySurfaced?: ReadonlySet<string>, options?: RecallSelectionOptions): RecalledMemory[];
export declare function formatRecalledMemories(memories: readonly RecalledMemory[]): string;
