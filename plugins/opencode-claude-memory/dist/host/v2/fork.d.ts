import type { ForkInput } from "../types.js";
export declare const FORK_CREATE_TIMEOUT_MS = 30000;
export declare const FORK_CLEANUP_TIMEOUT_MS = 15000;
export declare const FORK_READ_TIMEOUT_MS = 30000;
export declare const FORK_SETTLE_POLL_MS = 250;
export type PermissionRule = {
    action: string;
    resource: string;
    effect: "allow" | "deny" | "ask";
};
export type ModelRef = {
    id: string;
    providerID: string;
    variant?: string;
};
export type V2Message = {
    id: string;
    type: string;
    time?: {
        created?: number;
        completed?: number;
    };
    text?: string;
    finish?: string;
    error?: unknown;
    content?: unknown;
};
export type V2SessionApi = {
    create(input: {
        parentID?: string;
        title?: string;
        agent?: string;
        model?: ModelRef;
        permissions?: PermissionRule[];
    }): Promise<{
        id: string;
    }>;
    prompt(input: {
        sessionID: string;
        text: string;
    }): Promise<unknown>;
    wait(input: {
        sessionID: string;
    }): Promise<unknown>;
    context(input: {
        sessionID: string;
    }): Promise<readonly V2Message[]>;
    interrupt(input: {
        sessionID: string;
    }): Promise<unknown>;
    remove(input: {
        sessionID: string;
    }): Promise<unknown>;
};
export type V2ForkInput = ForkInput & {
    permissions: PermissionRule[];
    model?: ModelRef;
    createTimeoutMs?: number;
    cleanupTimeoutMs?: number;
    pollMs?: number;
};
export declare class ForkSessionTimeoutError extends Error {
    constructor(title: string, timeoutMs: number);
}
export declare class ForkSessionError extends Error {
    constructor(title: string, detail: string);
}
type Outcome = {
    done: true;
    failure?: string;
} | {
    done: false;
};
export declare function forkOutcome(messages: readonly V2Message[], promptID: string | undefined): Outcome;
export declare function runV2Fork(session: V2SessionApi, input: V2ForkInput): Promise<readonly V2Message[]>;
export {};
