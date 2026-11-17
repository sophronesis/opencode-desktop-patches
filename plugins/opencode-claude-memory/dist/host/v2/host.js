import { withDeadline } from "../../util/timeout.js";
import { buildGeneratePrompt } from "../generate.js";
import { SDK_READ_TIMEOUT_MS } from "../types.js";
import { forkSessionRules, PERMISSIONS_PROBE_AGENT } from "./agents.js";
import { runV2Fork } from "./fork.js";
import { toTranscript } from "./transcript.js";
// The V2 plugin calls take no AbortSignal; withDeadline only bounds the wait.
function bounded(what, timeoutMs, call) {
    return withDeadline(what, timeoutMs, () => call());
}
export class V2Host {
    options;
    // Per-fork system prompt, injected by the context hook (V2 prompts carry no system field).
    forkSystems = new Map();
    constructor(options) {
        this.options = options;
    }
    systemFor(sessionID) {
        return this.forkSystems.get(sessionID);
    }
    async readTranscript(sessionID, afterMessageID) {
        const messages = await bounded("session.context", SDK_READ_TIMEOUT_MS, () => this.options.session.context({ sessionID }));
        const truncated = afterMessageID !== undefined && !messages.some((message) => message.id === afterMessageID);
        return { messages: toTranscript(messages), truncated };
    }
    async listSessions() {
        return undefined;
    }
    async runFork(input) {
        await this.fork(input);
    }
    // One deadline for the agent lookup and the model call together, so the selector never outlives
    // the caller's timeout (recall.timeoutMs).
    async generate(input) {
        const result = await bounded("generate.text", input.timeoutMs, async () => {
            const agent = await this.agent(input.agent);
            return this.options.generateText({
                prompt: buildGeneratePrompt(input),
                ...(agent?.model ? { model: agent.model } : {}),
            });
        });
        return typeof result?.text === "string" ? result.text : "";
    }
    async agent(name) {
        try {
            return await bounded(`agent.get ${name}`, SDK_READ_TIMEOUT_MS, () => this.options.getAgent(name));
        }
        catch {
            return undefined;
        }
    }
    async fork(input) {
        // The resolved agent ruleset carries the global `permissions` after the sandbox (see agents.ts),
        // so it is never passed through: the session ruleset is the sandbox followed by the agent's own
        // rules only. Without an explicit one the child would also inherit its parent's session rules.
        const sandbox = this.options.sandboxFor(input.agent);
        const [agent, probe] = await Promise.all([this.agent(input.agent), this.agent(PERMISSIONS_PROBE_AGENT)]);
        const { rules: permissions, own } = forkSessionRules(sandbox, agent?.permissions, probe?.permissions);
        if (!own && agent?.permissions) {
            this.options.log?.("warn", "Memory agent overrides could not be told apart from global rules; forking with the bare sandbox", {
                agent: input.agent,
            });
        }
        this.options.log?.("debug", "Memory fork session permissions", { agent: input.agent, permissions });
        return runV2Fork(this.options.session, {
            ...input,
            permissions,
            ...(agent?.model ? { model: agent.model } : {}),
            onCreated: (id) => {
                if (input.system)
                    this.forkSystems.set(id, input.system);
                input.onCreated?.(id);
            },
            onFinished: (id) => {
                this.forkSystems.delete(id);
                input.onFinished?.(id);
            },
        });
    }
}
