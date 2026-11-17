import { SESSION_STATE_TTL_MS } from "../../recall/RecallCoordinator.js";
import { surfaceKey } from "../../store/scan.js";
const IDLE_EVENTS = [
    "session.execution.succeeded",
    "session.execution.failed",
    "session.execution.interrupted",
    "session.idle",
];
export class V2SessionEvents {
    deps;
    // Tracked sessions → last time a hook or event saw them. Entries idle for longer than
    // SESSION_STATE_TTL_MS are evicted so a long-running server does not leak; the next prompt or
    // context hook tracks the session again.
    sessions = new Map();
    // Memories recalled per session, keyed by `surfaceKey`. V2 rebuilds the system prompt for every
    // model request and does not keep it in the history, so the recalled section is re-injected on
    // every request (not only the first one of a turn) and its keys are what the selector skips.
    recalled = new Map();
    now;
    constructor(deps) {
        this.deps = deps;
        this.now = deps.now ?? Date.now;
    }
    track(sessionID) {
        if (this.deps.owned.has(sessionID))
            return;
        const now = this.now();
        this.evictStale(now);
        this.sessions.set(sessionID, now);
    }
    isTracked(sessionID) {
        return this.sessions.has(sessionID);
    }
    surfacedKeys(sessionID) {
        return new Set(this.recalled.get(sessionID)?.keys() ?? []);
    }
    // Adds the memories recalled for this request and returns everything recalled so far in the session.
    remember(sessionID, memories) {
        let session = this.recalled.get(sessionID);
        if (!session && memories.length > 0) {
            session = new Map();
            this.recalled.set(sessionID, session);
        }
        for (const memory of memories) {
            session?.set(surfaceKey({ name: memory.name, type: memory.type }), memory);
        }
        return [...(session?.values() ?? [])];
    }
    evictStale(now) {
        const cutoff = now - SESSION_STATE_TTL_MS;
        for (const [id, seenAt] of this.sessions) {
            if (seenAt >= cutoff)
                continue;
            this.sessions.delete(id);
            this.recalled.delete(id);
        }
    }
    handle(event) {
        const type = event?.type;
        const data = event?.data;
        if (!type || !data)
            return;
        const sessionID = typeof data.sessionID === "string" ? data.sessionID : undefined;
        if (!sessionID)
            return;
        if (type === "session.deleted") {
            this.deps.owned.release(sessionID, 5_000);
            this.forget(sessionID);
            return;
        }
        if (type === "session.created") {
            const directory = data.location?.directory ?? event.location?.directory;
            if (directory === this.deps.directory && !data.parentID)
                this.track(sessionID);
            return;
        }
        if (this.deps.owned.has(sessionID) || !this.sessions.has(sessionID))
            return;
        this.sessions.set(sessionID, this.now());
        if (type === "session.execution.started") {
            this.deps.extraction.onSessionStatus(sessionID, "busy");
        }
        else if (IDLE_EVENTS.includes(type)) {
            this.deps.extraction.onSessionIdle(sessionID);
        }
        else if (type === "session.status") {
            const status = data.status?.type;
            if (status === "idle")
                this.deps.extraction.onSessionIdle(sessionID);
            else if (typeof status === "string")
                this.deps.extraction.onSessionStatus(sessionID, status);
        }
    }
    forget(sessionID) {
        this.sessions.delete(sessionID);
        this.recalled.delete(sessionID);
        this.deps.recall.forget(sessionID);
        this.deps.extraction.onSessionDeleted(sessionID);
    }
}
export const RESUBSCRIBE_MIN_MS = 1_000;
export const RESUBSCRIBE_MAX_MS = 30_000;
// Consumes the event stream until `signal` aborts. A stream that fails (a slow consumer overflows
// it) is re-opened with a capped backoff.
export async function consumeEvents(subscribe, signal, onEvent, onError, backoff = { minMs: RESUBSCRIBE_MIN_MS, maxMs: RESUBSCRIBE_MAX_MS }) {
    let delay = backoff.minMs;
    while (!signal.aborted) {
        try {
            for await (const event of subscribe({ signal })) {
                if (signal.aborted)
                    return;
                delay = backoff.minMs;
                try {
                    onEvent(event);
                }
                catch (error) {
                    onError(error);
                }
            }
        }
        catch (error) {
            if (signal.aborted)
                return;
            onError(error);
        }
        if (signal.aborted)
            return;
        await new Promise((resolve) => {
            const timer = setTimeout(resolve, delay);
            signal.addEventListener("abort", () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });
        delay = Math.min(delay * 2, backoff.maxMs);
    }
}
