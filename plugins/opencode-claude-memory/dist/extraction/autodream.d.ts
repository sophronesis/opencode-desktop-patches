import type { MemoryConfig } from "../config.js";
import type { MemoryHost } from "../host/types.js";
import type { MemoryStore } from "../store/MemoryStore.js";
import { type Logger } from "../util/log.js";
import type { OwnedSessions } from "../util/ownedSessions.js";
import { MaintenanceLock } from "./lock.js";
import type { AutodreamState, ExtractionStateStore } from "./state.js";
export declare const AUTODREAM_TITLE = "opencode-memory auto-dream";
export declare const AUTODREAM_FORK_GRACE_MS = 60000;
export type AutodreamGate = Pick<MemoryConfig["autodream"], "minHours" | "minSessions">;
export declare function shouldRunAutodream(state: AutodreamState, gate: AutodreamGate, now: number): boolean;
export type AutoDreamDeps = {
    store: MemoryStore;
    config: MemoryConfig;
    host: MemoryHost;
    state: ExtractionStateStore;
    owned: OwnedSessions;
    log: Logger;
    now?: () => number;
    lock?: MaintenanceLock;
};
export type DreamActivity = {
    saved: string[];
    deleted: string[];
};
export declare class AutoDream {
    private readonly deps;
    private readonly now;
    private readonly lock;
    private readonly activity;
    constructor(deps: AutoDreamDeps);
    static noteSession(state: AutodreamState, sessionID: string): void;
    record(sessionID: string, kind: keyof DreamActivity, fileName: string): boolean;
    shouldRun(): boolean;
    maybeRun(parentSessionID: string): Promise<boolean>;
}
