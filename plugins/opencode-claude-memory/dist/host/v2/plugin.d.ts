import type { Plugin } from "@opencode/plugin";
import { z } from "zod/v4";
import { type MemoryToolSpec } from "../../tools.js";
export type V2Context = Plugin.Context;
export type V2Cleanup = Plugin.Cleanup;
export declare const SETUP_CALL_TIMEOUT_MS = 30000;
export declare const CLEANUP_CALL_TIMEOUT_MS = 5000;
export declare function toV2Tool(spec: MemoryToolSpec): {
    name: "memory_save" | "memory_delete" | "memory_list" | "memory_search" | "memory_read";
    description: string;
    input: z.ZodObject<{
        [x: string]: z.core.$ZodType<unknown, unknown, z.core.$ZodTypeInternals<unknown, unknown>>;
    }, z.core.$strip>;
    options: {
        codemode: boolean;
    };
    execute(input: unknown, context: {
        sessionID: string;
    }): Promise<{
        metadata?: {
            title: string;
        } | undefined;
        content: string;
    }>;
};
export declare const createV2Setup: (env?: NodeJS.ProcessEnv, homeDir?: string) => (ctx: V2Context) => Promise<V2Cleanup>;
