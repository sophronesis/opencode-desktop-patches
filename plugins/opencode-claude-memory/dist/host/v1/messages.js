// Pure helpers over the V1 SDK message shape passed to `experimental.chat.messages.transform`.
import { extractSurfacedMemoryKeys } from "../../recall/turn.js";
export { extractSurfacedMemoryKeys };
// Older runtimes and tests may hand over messages whose `info` lacks the full SDK shape; only the
// fields actually used are read, defensively.
export function roleOf(message) {
    return String(message.info?.role ?? "");
}
function partText(part) {
    if (!part || typeof part !== "object")
        return undefined;
    const text = part.text;
    return typeof text === "string" ? text : undefined;
}
export function extractUserQuery(message) {
    if (!Array.isArray(message.parts))
        return undefined;
    const text = message.parts
        .filter((part) => part.type === "text")
        .map((part) => partText(part) ?? "")
        .filter(Boolean)
        .join("\n")
        .trim();
    return text || undefined;
}
export function getLastUserQuery(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (!message || roleOf(message) !== "user")
            continue;
        const info = message.info;
        return {
            query: extractUserQuery(message),
            sessionID: typeof info?.sessionID === "string" ? info.sessionID : undefined,
            messageID: typeof info?.id === "string" ? info.id : undefined,
            messageIndex: i,
        };
    }
    return {};
}
// One user turn may drive several LLM calls (tool loops); they share a turn ID so recall runs once.
export function buildTurnID(sessionID, turn) {
    return `${sessionID}:${turn.messageID ?? `${turn.messageIndex ?? -1}:${turn.query ?? ""}`}`;
}
export function collectSurfacedMemoryKeys(messages) {
    const keys = new Set();
    for (const message of messages) {
        if (roleOf(message) !== "system" || !Array.isArray(message.parts))
            continue;
        for (const part of message.parts) {
            const text = partText(part);
            if (!text)
                continue;
            for (const key of extractSurfacedMemoryKeys(text))
                keys.add(key);
        }
    }
    return keys;
}
// Only completed tools — matches Claude Code's collectRecentSuccessfulTools().
export function extractRecentTools(messages) {
    const tools = [];
    const seen = new Set();
    for (const message of messages) {
        if (!Array.isArray(message.parts))
            continue;
        for (const part of message.parts) {
            if (!part || typeof part !== "object")
                continue;
            const p = part;
            if (p.type !== "tool" || !p.tool)
                continue;
            if (p.state?.status !== "completed")
                continue;
            if (seen.has(p.tool))
                continue;
            seen.add(p.tool);
            tools.push(p.tool);
        }
    }
    return tools;
}
