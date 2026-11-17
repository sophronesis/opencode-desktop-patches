// Bounded waits for SDK calls. The plugin SDK client disables fetch timeouts, so every request
// the plugin makes must carry its own deadline; the AbortSignal is passed to the request so a hung
// connection is actually torn down instead of leaking.
export class TimeoutError extends Error {
    constructor(what, timeoutMs) {
        super(`${what} timed out after ${timeoutMs}ms`);
        this.name = "TimeoutError";
    }
}
// The deadline timer is deliberately *not* unref'd: it is cleared as soon as the call settles, and
// an unref'd timer is the only thing that has to fire when a request hangs. On Windows, Bun's event
// loop does not wake up for unref'd timers while nothing else is pending (observed on CI), so an
// unref'd deadline would never expire exactly when it is needed.
export function withTimeout(promise, timeoutMs, error) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(error()), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
}
// Runs `call` with a fresh AbortSignal that fires when the deadline passes. The SDK request
// options extend `RequestInit`, so the signal cancels the underlying fetch.
export function withDeadline(what, timeoutMs, call) {
    const controller = new AbortController();
    let invoked;
    try {
        invoked = Promise.resolve(call(controller.signal));
    }
    catch (error) {
        return Promise.reject(error);
    }
    return withTimeout(invoked, timeoutMs, () => {
        controller.abort();
        return new TimeoutError(what, timeoutMs);
    });
}
