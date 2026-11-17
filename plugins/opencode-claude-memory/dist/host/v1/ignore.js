// "Ignore memory" handling over the V1 message shape; the phrase rules live in recall/turn.ts.
import { AUTO_MEMORY_MARKER } from "../../prompt/systemPrompt.js";
import { deriveIgnoredFromQueries } from "../../recall/turn.js";
import { extractUserQuery, roleOf } from "./messages.js";
export { detectIgnoreMemory, detectResumeMemory } from "../../recall/turn.js";
// Replays every user message in order and returns whether memory is ignored at the end. Used to
// rebuild session state that the coordinator no longer holds (process restart, cache eviction), so
// an "ignore memory" said earlier in the session keeps applying without the user repeating it.
export function deriveIgnoredFromHistory(messages) {
    return deriveIgnoredFromQueries(messages.filter((message) => roleOf(message) === "user").map((message) => extractUserQuery(message)));
}
export function isAutoMemoryPart(part) {
    if (!part || typeof part !== "object")
        return false;
    const text = part.text;
    return typeof text === "string" && text.trimStart().startsWith(AUTO_MEMORY_MARKER);
}
// Drops the plugin's own system segment from system-role messages; messages left without parts
// are removed entirely.
export function stripAutoMemoryParts(messages) {
    return messages
        .map((message) => {
        if (roleOf(message) !== "system" || !Array.isArray(message.parts))
            return message;
        const parts = message.parts.filter((part) => !isAutoMemoryPart(part));
        return parts.length === message.parts.length ? message : { ...message, parts };
    })
        .filter((message) => !Array.isArray(message.parts) || message.parts.length > 0);
}
