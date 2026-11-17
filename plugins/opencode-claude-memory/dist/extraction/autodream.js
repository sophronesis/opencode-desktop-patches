import { getErrorMessage } from "../util/log.js";
import { MaintenanceLock } from "./lock.js";
import { AUTODREAM_PROMPT, AUTODREAM_USER_MESSAGE } from "./prompts.js";
export const AUTODREAM_TITLE = "opencode-memory auto-dream";
export const AUTODREAM_FORK_GRACE_MS = 60_000;
export function shouldRunAutodream(state, gate, now) {
    const hoursSince = (now - state.lastConsolidatedAt) / (60 * 60 * 1000);
    if (hoursSince < gate.minHours)
        return false;
    return state.sessionsSince.length >= gate.minSessions;
}
function summarize(activity) {
    return { saved: Array.from(new Set(activity.saved)), deleted: Array.from(new Set(activity.deleted)) };
}
export class AutoDream {
    deps;
    now;
    lock;
    // Running consolidation forks by session id, so their tool calls can be summarised in the log.
    activity = new Map();
    constructor(deps) {
        this.deps = deps;
        this.now = deps.now ?? Date.now;
        this.lock = deps.lock ?? new MaintenanceLock(deps.store.maintenanceLockPath, this.now);
    }
    // Called from the extraction coordinator's persisted update after a session was extracted.
    static noteSession(state, sessionID) {
        if (!state.sessionsSince.includes(sessionID))
            state.sessionsSince.push(sessionID);
    }
    // Records a memory tool call made inside a running consolidation fork; false for any other session.
    record(sessionID, kind, fileName) {
        const activity = this.activity.get(sessionID);
        if (!activity)
            return false;
        activity[kind].push(fileName);
        return true;
    }
    shouldRun() {
        const { config, state } = this.deps;
        if (!config.autodream.enabled)
            return false;
        return shouldRunAutodream(state.read().autodream, config.autodream, this.now());
    }
    // Runs a consolidation fork when the gate passes. Success resets the gate; failure leaves the
    // gate untouched so the next extracted session retries.
    async maybeRun(parentSessionID) {
        if (!this.shouldRun())
            return false;
        if (!this.lock.tryAcquire()) {
            this.deps.log("info", "Auto-dream skipped: another process holds the maintenance lock");
            return false;
        }
        const { host, config, owned, state, log } = this.deps;
        const activity = { saved: [], deleted: [] };
        try {
            // Re-check under the lock: another process may have consolidated while we waited to acquire.
            if (!this.shouldRun())
                return false;
            const autodream = state.read().autodream;
            log("info", "Auto-dream consolidation starting", {
                sessionsSince: autodream.sessionsSince.length,
                lastConsolidatedAt: autodream.lastConsolidatedAt,
            });
            await host.runFork({
                parentSessionID,
                title: AUTODREAM_TITLE,
                agent: config.agents.dream,
                system: AUTODREAM_PROMPT,
                text: AUTODREAM_USER_MESSAGE,
                timeoutMs: config.autodream.timeoutMs,
                onCreated: (id) => {
                    owned.add(id);
                    this.activity.set(id, activity);
                },
                onFinished: (id) => {
                    owned.release(id, AUTODREAM_FORK_GRACE_MS);
                    this.activity.delete(id);
                },
                onCleanupFailed: (id, stage, error) => log("warn", "Auto-dream fork cleanup failed; the server may still hold the fork session", {
                    forkID: id,
                    stage,
                    error: getErrorMessage(error),
                }),
            });
            state.update((data) => {
                data.autodream.lastConsolidatedAt = this.now();
                data.autodream.sessionsSince = [];
            });
            log("info", "Auto-dream consolidation completed", summarize(activity));
            return true;
        }
        catch (error) {
            // Saves and deletes made before the failure are already on disk: report them too.
            log("error", "Auto-dream consolidation failed", { error: getErrorMessage(error), ...summarize(activity) });
            return false;
        }
        finally {
            this.lock.release();
        }
    }
}
