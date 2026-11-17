// Lifecycle of a plugin-owned child session: create → prompt (with timeout) → abort on timeout →
// delete (best-effort). Shared by recall selection, extraction and auto-dream.
//
// Every stage has its own deadline and AbortSignal: the SDK client disables fetch timeouts, so a
// hung `create`, `abort` or `delete` would otherwise pin the caller (and with it the extraction
// queue and the maintenance lock) forever. `onFinished` always fires, even when cleanup timed out.
import { TimeoutError, withDeadline } from "../../util/timeout.js";
import { unwrapData } from "./sdk.js";
export const FORK_CREATE_TIMEOUT_MS = 30_000;
export const FORK_CLEANUP_TIMEOUT_MS = 15_000;
export class ForkSessionTimeoutError extends Error {
    constructor(title, timeoutMs) {
        super(`${title} timed out after ${timeoutMs}ms`);
        this.name = "ForkSessionTimeoutError";
    }
}
export function extractSessionID(response) {
    const data = unwrapData(response);
    if (!data || typeof data !== "object")
        return undefined;
    const id = data.id ?? data.sessionID;
    return typeof id === "string" ? id : undefined;
}
function describeError(error) {
    if (error && typeof error === "object") {
        const named = error;
        const message = named.data?.message ?? named.message;
        if (typeof message === "string") {
            return typeof named.name === "string" ? `${named.name}: ${message}` : message;
        }
        try {
            return JSON.stringify(error);
        }
        catch {
            return String(error);
        }
    }
    return String(error);
}
// The SDK client never throws (`ThrowOnError = false`): HTTP failures arrive as `{ error }` and a
// model failure inside the fork arrives as a normal assistant message carrying `info.error`. Both
// must count as a failed fork, otherwise the caller would advance its watermark over nothing.
export function forkFailure(response) {
    if (!response || typeof response !== "object")
        return undefined;
    const transport = response.error;
    if (transport !== undefined && transport !== null)
        return describeError(transport);
    const data = unwrapData(response);
    const modelError = data && typeof data === "object" ? data.info?.error : undefined;
    if (modelError !== undefined && modelError !== null)
        return describeError(modelError);
    return undefined;
}
export class ForkSessionError extends Error {
    constructor(title, detail) {
        super(`${title}: ${detail}`);
        this.name = "ForkSessionError";
    }
}
// Security: forks run on raw, potentially untrusted transcript content (fetched pages, tool output).
// Callers restrict `tools` to the memory tools; the per-stage deadlines guarantee the caller gets
// control back even when the fork hangs on a permission prompt or the server stops answering.
export async function runForkSession(input) {
    const { client, directory } = input;
    const createTimeoutMs = input.createTimeoutMs ?? FORK_CREATE_TIMEOUT_MS;
    const cleanupTimeoutMs = input.cleanupTimeoutMs ?? FORK_CLEANUP_TIMEOUT_MS;
    const created = await withDeadline(`${input.title} session.create`, createTimeoutMs, (signal) => client.session.create({
        body: { parentID: input.parentSessionID, title: input.title },
        query: { directory },
        signal,
    }));
    const createFailure = forkFailure(created);
    if (createFailure)
        throw new ForkSessionError(input.title, `session.create failed (${createFailure})`);
    const forkID = extractSessionID(created);
    if (!forkID)
        throw new ForkSessionError(input.title, "session.create returned no session id");
    input.onCreated?.(forkID);
    // `format` (structured output) is accepted by the server but missing from the v1 SDK body type.
    const body = {
        agent: input.agent,
        parts: input.parts,
    };
    if (input.system !== undefined)
        body.system = input.system;
    if (input.tools !== undefined)
        body.tools = input.tools;
    if (input.format !== undefined)
        body.format = input.format;
    if (input.model !== undefined)
        body.model = input.model;
    const cleanup = async (stage) => {
        try {
            await withDeadline(`${input.title} session.${stage}`, cleanupTimeoutMs, (signal) => stage === "abort"
                ? client.session.abort({ path: { id: forkID }, query: { directory }, signal })
                : client.session.delete({ path: { id: forkID }, query: { directory }, signal }));
        }
        catch (error) {
            input.onCleanupFailed?.(forkID, stage, error);
        }
    };
    let timedOut = false;
    try {
        let response;
        try {
            response = await withDeadline(`${input.title} session.prompt`, input.timeoutMs, (signal) => client.session.prompt({ path: { id: forkID }, query: { directory }, body: body, signal }));
        }
        catch (error) {
            if (error instanceof TimeoutError) {
                timedOut = true;
                throw new ForkSessionTimeoutError(input.title, input.timeoutMs);
            }
            throw error;
        }
        const failure = forkFailure(response);
        if (failure)
            throw new ForkSessionError(input.title, failure);
        return response;
    }
    finally {
        try {
            // On timeout the server is still running the fork: stop it before deleting the session so it
            // does not keep inserting parts for a row that no longer exists.
            if (timedOut)
                await cleanup("abort");
            await cleanup("delete");
        }
        finally {
            input.onFinished?.(forkID);
        }
    }
}
