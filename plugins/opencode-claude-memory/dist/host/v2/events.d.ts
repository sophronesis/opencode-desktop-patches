import type { ExtractionCoordinator } from "../../extraction/ExtractionCoordinator.js";
import type { RecalledMemory } from "../../recall/format.js";
import { type RecallCoordinator } from "../../recall/RecallCoordinator.js";
import type { OwnedSessions } from "../../util/ownedSessions.js";
export type V2Event = {
    type?: string;
    location?: {
        directory?: string;
    } | null;
    data?: Record<string, unknown>;
};
export type V2EventDeps = {
    directory: string;
    owned: OwnedSessions;
    recall: Pick<RecallCoordinator, "forget">;
    extraction: Pick<ExtractionCoordinator, "onSessionIdle" | "onSessionStatus" | "onSessionDeleted">;
    now?: () => number;
};
export declare class V2SessionEvents {
    private readonly deps;
    private readonly sessions;
    private readonly recalled;
    private readonly now;
    constructor(deps: V2EventDeps);
    track(sessionID: string): void;
    isTracked(sessionID: string): boolean;
    surfacedKeys(sessionID: string): ReadonlySet<string>;
    remember(sessionID: string, memories: readonly RecalledMemory[]): RecalledMemory[];
    private evictStale;
    handle(event: V2Event): void;
    private forget;
}
export declare const RESUBSCRIBE_MIN_MS = 1000;
export declare const RESUBSCRIBE_MAX_MS = 30000;
export declare function consumeEvents(subscribe: (options: {
    signal: AbortSignal;
}) => AsyncIterable<unknown>, signal: AbortSignal, onEvent: (event: V2Event) => void, onError: (error: unknown) => void, backoff?: {
    minMs: number;
    maxMs: number;
}): Promise<void>;
