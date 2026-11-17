import { z } from "zod";
export declare const MemoryOptionsSchema: z.ZodObject<{
    autoMemoryDirectory: z.ZodOptional<z.ZodString>;
    extract: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        debounceMs: z.ZodDefault<z.ZodNumber>;
        maxConversationChars: z.ZodDefault<z.ZodNumber>;
        catchUpLimit: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        timeoutMs: number;
        debounceMs: number;
        maxConversationChars: number;
        catchUpLimit: number;
    }, {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        debounceMs?: number | undefined;
        maxConversationChars?: number | undefined;
        catchUpLimit?: number | undefined;
    }>>;
    autodream: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        minHours: z.ZodDefault<z.ZodNumber>;
        minSessions: z.ZodDefault<z.ZodNumber>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        timeoutMs: number;
        minHours: number;
        minSessions: number;
    }, {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        minHours?: number | undefined;
        minSessions?: number | undefined;
    }>>;
    recall: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        waitMs: z.ZodDefault<z.ZodNumber>;
        timeoutMs: z.ZodDefault<z.ZodNumber>;
        maxMemories: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        timeoutMs: number;
        waitMs: number;
        maxMemories: number;
    }, {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        waitMs?: number | undefined;
        maxMemories?: number | undefined;
    }>>;
    readOnly: z.ZodDefault<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    extract: {
        enabled: boolean;
        timeoutMs: number;
        debounceMs: number;
        maxConversationChars: number;
        catchUpLimit: number;
    };
    autodream: {
        enabled: boolean;
        timeoutMs: number;
        minHours: number;
        minSessions: number;
    };
    recall: {
        enabled: boolean;
        timeoutMs: number;
        waitMs: number;
        maxMemories: number;
    };
    readOnly: boolean;
    autoMemoryDirectory?: string | undefined;
}, {
    autoMemoryDirectory?: string | undefined;
    extract?: {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        debounceMs?: number | undefined;
        maxConversationChars?: number | undefined;
        catchUpLimit?: number | undefined;
    } | undefined;
    autodream?: {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        minHours?: number | undefined;
        minSessions?: number | undefined;
    } | undefined;
    recall?: {
        enabled?: boolean | undefined;
        timeoutMs?: number | undefined;
        waitMs?: number | undefined;
        maxMemories?: number | undefined;
    } | undefined;
    readOnly?: boolean | undefined;
}>;
export type MemoryOptions = z.infer<typeof MemoryOptionsSchema>;
export declare const MEMORY_AGENTS: {
    readonly extract: "opencode-memory-extract";
    readonly recall: "opencode-memory-recall";
    readonly dream: "opencode-memory-dream";
};
export type MemoryAgents = typeof MEMORY_AGENTS;
export type MemoryConfig = MemoryOptions & {
    claudeConfigDir: string;
    homeDir: string;
    agents: MemoryAgents;
};
export declare class MemoryConfigError extends Error {
    constructor(message: string);
}
export declare function resolveClaudeConfigDir(env?: NodeJS.ProcessEnv): string;
export declare function parseMemoryOptions(options: unknown): MemoryOptions;
export declare function parseConfig(options: unknown, env?: NodeJS.ProcessEnv, homeDir?: string): MemoryConfig;
