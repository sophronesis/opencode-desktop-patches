import type { MemoryHost } from "../host/types.js";
import { type MemoryHeader } from "../store/scan.js";
export declare const SELECT_MEMORIES_SYSTEM_PROMPT = "You are selecting memories that will be useful to OpenCode as it processes a user's query. You will be given the user's query and a list of available memory files with their filenames and descriptions.\n\nReturn a list of filenames for the memories that will clearly be useful to OpenCode as it processes the user's query (up to 5). Only include memories that you are certain will be helpful based on their name and description.\n- If you are unsure if a memory will be useful in processing the user's query, then do not include it in your list. Be selective and discerning.\n- If there are no memories in the list that would clearly be useful, feel free to return an empty list.\n- If a list of recently-used tools is provided, do not select memories that are usage reference or API documentation for those tools (OpenCode is already exercising them). DO still select memories containing warnings, gotchas, or known issues about those tools \u2014 active use is exactly when those matter.\n";
export declare const SELECT_MEMORIES_SCHEMA: {
    readonly type: "object";
    readonly properties: {
        readonly selected_memories: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
            };
        };
    };
    readonly required: readonly ["selected_memories"];
    readonly additionalProperties: false;
};
export declare const RECALL_SELECTOR_TITLE = "opencode-memory recall selector";
export type SelectRelevantMemoriesInput = {
    host: MemoryHost;
    parentSessionID: string;
    query: string;
    memories: readonly MemoryHeader[];
    recentTools: readonly string[];
    agent: string;
    timeoutMs: number;
    maxMemories: number;
    onSessionCreated?: (sessionID: string) => void;
    onSessionFinished?: (sessionID: string) => void;
};
export declare function parseSelectedMemories(text: string): string[];
export declare function buildSelectorQuery(query: string, memories: readonly MemoryHeader[], recentTools: readonly string[]): string;
export declare function selectRelevantMemories(input: SelectRelevantMemoriesInput): Promise<string[]>;
