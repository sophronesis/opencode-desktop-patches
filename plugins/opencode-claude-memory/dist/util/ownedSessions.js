// Registry of sub-sessions the plugin created itself (recall selectors, extraction and auto-dream
// forks). Their events and transforms must be ignored, otherwise a fork's own `session.idle` would
// trigger another extraction of the fork, and the recall hooks would inject memory into the selector.
//
// A fork's `session.idle` can arrive after its `session.delete` HTTP call resolved, so ownership is
// released with a grace period; `session.deleted` shortens that to a few seconds.
export class OwnedSessions {
    timers = new Map();
    add(id) {
        const existing = this.timers.get(id);
        if (existing)
            clearTimeout(existing);
        this.timers.set(id, undefined);
    }
    has(id) {
        return id !== undefined && this.timers.has(id);
    }
    release(id, graceMs) {
        if (!this.timers.has(id))
            return;
        const existing = this.timers.get(id);
        if (existing)
            clearTimeout(existing);
        if (graceMs <= 0) {
            this.timers.delete(id);
            return;
        }
        const timer = setTimeout(() => this.timers.delete(id), graceMs);
        timer.unref?.();
        this.timers.set(id, timer);
    }
    dispose() {
        for (const timer of this.timers.values()) {
            if (timer)
                clearTimeout(timer);
        }
        this.timers.clear();
    }
}
