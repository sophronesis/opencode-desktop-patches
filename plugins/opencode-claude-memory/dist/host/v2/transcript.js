function toolOutput(content) {
    if (!Array.isArray(content))
        return undefined;
    const text = content
        .map((item) => (item && typeof item === "object" ? item.text : undefined))
        .filter((value) => typeof value === "string")
        .join("\n");
    return text || undefined;
}
function assistantParts(content) {
    if (!Array.isArray(content))
        return [];
    const parts = [];
    for (const raw of content) {
        if (!raw || typeof raw !== "object")
            continue;
        if (raw.type === "text" && typeof raw.text === "string") {
            parts.push({ type: "text", text: raw.text });
        }
        else if (raw.type === "tool" && typeof raw.name === "string") {
            const status = typeof raw.state?.status === "string" ? raw.state.status : undefined;
            parts.push({ type: "tool", tool: raw.name, state: { status, output: toolOutput(raw.state?.content) } });
        }
    }
    return parts;
}
// User and assistant messages only: synthetic, system, compaction and bookkeeping messages carry no
// conversation the user had.
export function toTranscript(messages) {
    const transcript = [];
    for (const message of messages) {
        if (message.type === "user") {
            transcript.push({
                info: { id: message.id, role: "user", time: { created: message.time?.created } },
                parts: typeof message.text === "string" ? [{ type: "text", text: message.text }] : [],
            });
        }
        else if (message.type === "assistant") {
            transcript.push({
                info: {
                    id: message.id,
                    role: "assistant",
                    time: { created: message.time?.created, completed: message.time?.completed },
                },
                parts: assistantParts(message.content),
            });
        }
    }
    return transcript;
}
