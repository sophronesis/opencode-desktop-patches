import type { MemoryConfig } from "../config.js";
import type { MemoryHost } from "../host/types.js";
import type { MemoryStore } from "../store/MemoryStore.js";
import type { Logger } from "../util/log.js";
import type { OwnedSessions } from "../util/ownedSessions.js";
import { type RecalledMemory } from "./format.js";
export declare const SESSION_STATE_TTL_MS: number;
export declare const SELECTOR_GRACE_MS = 60000;
export type RecallTurn = {
    sessionID: string;
    turnID: string;
    query: string | undefined;
    ignoredInHistory: () => boolean;
    surfaced: () => ReadonlySet<string>;
    recentTools: () => readonly string[];
};
export type RecallCoordinatorDeps = {
    store: MemoryStore;
    config: MemoryConfig;
    host: MemoryHost | undefined;
    owned: OwnedSessions;
    log: Logger;
    now?: () => number;
};
export declare class RecallCoordinator {
    protected readonly deps: RecallCoordinatorDeps;
    private readonly sessions;
    private warnedMissingSessionID;
    private readonly now;
    constructor(deps: RecallCoordinatorDeps);
    onTurn(turn: RecallTurn): {
        ignored: boolean;
    };
    takeRecalled(sessionID: string | undefined): Promise<RecalledMemory[]>;
    isIgnored(sessionID: string | undefined): boolean;
    forget(sessionID: string): void;
    get trackedSessions(): number;
    private race;
    private evictStale;
    private startPrefetch;
}
