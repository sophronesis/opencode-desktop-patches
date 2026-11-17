import type { MemoryHeader } from "../../store/scan.js";
import type { OpencodeClient } from "./sdk.js";
export type SelectRelevantMemoryFilenamesInput = {
    client: OpencodeClient;
    directory: string;
    parentSessionID: string;
    query: string;
    memories: readonly MemoryHeader[];
    recentTools: readonly string[];
    agent: string;
    tools?: Record<string, boolean>;
    timeoutMs: number;
    maxMemories: number;
    onSessionCreated?: (sessionID: string) => void;
    onSessionFinished?: (sessionID: string) => void;
};
export declare function extractSelectedMemories(response: unknown): string[];
export declare function selectRelevantMemoryFilenames(input: SelectRelevantMemoryFilenamesInput): Promise<string[]>;
