import { surfaceKey } from "../store/scan.js";
import { recallSelectedMemories } from "./format.js";
import { selectRelevantMemories } from "./selector.js";
import { detectIgnoreMemory, detectResumeMemory } from "./turn.js";
export const SESSION_STATE_TTL_MS = 60 * 60 * 1000;
export const SELECTOR_GRACE_MS = 60_000;
const TIMEOUT = Symbol("recall-timeout");
function isUsefulRecallQuery(query) {
    const trimmed = query?.trim();
    if (!trimmed)
        return false;
    if (/\s/.test(trimmed))
        return true;
    return /[㐀-鿿]/.test(trimmed) && trimmed.length >= 4;
}
export class RecallCoordinator {
    deps;
    sessions = new Map();
    warnedMissingSessionID = false;
    now;
    constructor(deps) {
        this.deps = deps;
        this.now = deps.now ?? Date.now;
    }
    // Derives the turn state and starts the selector prefetch. Returns whether memory is ignored for
    // this session, so the host can drop the plugin's own prompt segment from the history.
    onTurn(turn) {
        const { sessionID } = turn;
        if (this.deps.owned.has(sessionID))
            return { ignored: false };
        const now = this.now();
        this.evictStale(now);
        const state = this.sessions.get(sessionID) ?? {
            updatedAt: now,
            ignored: turn.ignoredInHistory(),
        };
        state.updatedAt = now;
        if (state.turnID !== turn.turnID) {
            if (detectIgnoreMemory(turn.query))
                state.ignored = true;
            else if (state.ignored && detectResumeMemory(turn.query))
                state.ignored = false;
            state.turnID = turn.turnID;
            state.prefetch = state.ignored ? undefined : this.startPrefetch(turn);
        }
        this.sessions.set(sessionID, state);
        return { ignored: state.ignored };
    }
    // Waits for the prefetch (bounded by recall.waitMs) and hands the result over exactly once. On
    // timeout the prefetch keeps running for the next model call.
    async takeRecalled(sessionID) {
        if (!sessionID) {
            if (!this.warnedMissingSessionID) {
                this.warnedMissingSessionID = true;
                this.deps.log("warn", "system.transform received no sessionID; memory recall is disabled for this call");
            }
            return [];
        }
        const state = this.sessions.get(sessionID);
        const prefetch = state?.prefetch;
        if (!state || state.ignored || !prefetch || prefetch.consumed)
            return [];
        const result = await this.race(prefetch.promise, this.deps.config.recall.waitMs);
        if (result === TIMEOUT)
            return [];
        prefetch.consumed = true;
        return result;
    }
    isIgnored(sessionID) {
        return sessionID !== undefined && this.sessions.get(sessionID)?.ignored === true;
    }
    // The session was deleted: its preference and turn cache go with it.
    forget(sessionID) {
        this.sessions.delete(sessionID);
    }
    get trackedSessions() {
        return this.sessions.size;
    }
    race(promise, waitMs) {
        let timer;
        const timeout = new Promise((resolve) => {
            timer = setTimeout(() => resolve(TIMEOUT), waitMs);
        });
        return Promise.race([promise, timeout]).finally(() => {
            if (timer)
                clearTimeout(timer);
        });
    }
    // Drops the turn cache of sessions idle for longer than the TTL. An ignored session keeps its
    // entry (only the cache is cleared) so the instruction survives until the session is deleted.
    evictStale(now) {
        const cutoff = now - SESSION_STATE_TTL_MS;
        for (const [id, state] of this.sessions) {
            if (state.updatedAt >= cutoff)
                continue;
            if (state.ignored) {
                state.prefetch = undefined;
                state.turnID = undefined;
            }
            else {
                this.sessions.delete(id);
            }
        }
    }
    startPrefetch(turn) {
        const { host, config, store, owned } = this.deps;
        const { query } = turn;
        if (!config.recall.enabled || !host || !isUsefulRecallQuery(query))
            return undefined;
        const alreadySurfaced = turn.surfaced();
        const recentTools = turn.recentTools();
        const headers = store.scan().filter((header) => !alreadySurfaced.has(surfaceKey(header)));
        if (headers.length === 0)
            return undefined;
        const promise = selectRelevantMemories({
            host,
            parentSessionID: turn.sessionID,
            query,
            memories: headers,
            recentTools,
            agent: config.agents.recall,
            timeoutMs: config.recall.timeoutMs,
            maxMemories: config.recall.maxMemories,
            onSessionCreated: (id) => owned.add(id),
            onSessionFinished: (id) => owned.release(id, SELECTOR_GRACE_MS),
        })
            .then((selected) => recallSelectedMemories(headers, selected, alreadySurfaced, { maxMemories: config.recall.maxMemories }))
            .catch(() => []);
        return { turnID: turn.turnID, promise, consumed: false };
    }
}
