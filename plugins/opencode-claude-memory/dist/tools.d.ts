import { z } from "zod/v4";
import type { MemoryToolName } from "./agents.js";
import type { ExtractionCoordinator } from "./extraction/ExtractionCoordinator.js";
import type { MemoryStore, SaveMemoryResult } from "./store/MemoryStore.js";
export declare function formatMemorySaveResult(outcome: SaveMemoryResult, savedThisRun?: readonly string[]): string;
export declare function memorySaveTitle(type: string, name: string): string | undefined;
export declare function memoryListTitle(count: number): string;
export declare function memorySearchTitle(query: string, count: number): string;
export type MemoryToolResult = {
    title?: string;
    output: string;
};
export type MemoryToolContext = {
    sessionID?: string;
};
export type MemoryToolSpec = {
    name: MemoryToolName;
    description: string;
    args: z.ZodRawShape;
    execute(args: Record<string, unknown>, ctx: MemoryToolContext): Promise<MemoryToolResult>;
};
export declare function buildMemoryToolSpecs(store: MemoryStore, extraction: Pick<ExtractionCoordinator, "recordSave" | "recordDelete">): MemoryToolSpec[];
