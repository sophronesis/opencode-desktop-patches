import type { ForkCleanupStage } from "../types.js";
import { type OpencodeClient } from "./sdk.js";
export declare const FORK_CREATE_TIMEOUT_MS = 30000;
export declare const FORK_CLEANUP_TIMEOUT_MS = 15000;
export type { ForkCleanupStage };
export type ForkSessionInput = {
    client: OpencodeClient;
    directory: string;
    parentSessionID?: string;
    title: string;
    agent: string;
    system?: string;
    parts: Array<{
        type: "text";
        text: string;
    }>;
    tools?: Record<string, boolean>;
    format?: unknown;
    model?: {
        providerID: string;
        modelID: string;
    };
    timeoutMs: number;
    createTimeoutMs?: number;
    cleanupTimeoutMs?: number;
    onCreated?: (forkID: string) => void;
    onFinished?: (forkID: string) => void;
    onCleanupFailed?: (forkID: string, stage: ForkCleanupStage, error: unknown) => void;
};
export declare class ForkSessionTimeoutError extends Error {
    constructor(title: string, timeoutMs: number);
}
export declare function extractSessionID(response: unknown): string | undefined;
export declare function forkFailure(response: unknown): string | undefined;
export declare class ForkSessionError extends Error {
    constructor(title: string, detail: string);
}
export declare function runForkSession(input: ForkSessionInput): Promise<unknown>;
