import type { MemoryAgents } from "./config.js";
export declare const MEMORY_TOOL_NAMES: readonly ["memory_save", "memory_delete", "memory_list", "memory_search", "memory_read"];
export type MemoryToolName = (typeof MEMORY_TOOL_NAMES)[number];
export type MemoryAgentDefaults = {
    prompt: string;
    temperature?: number;
    steps?: number;
    allowedTools: readonly MemoryToolName[];
};
export declare function memoryAgentDefaults(agents: MemoryAgents, readOnly?: boolean): Record<string, MemoryAgentDefaults>;
