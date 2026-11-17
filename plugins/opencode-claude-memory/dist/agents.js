import { AUTODREAM_PROMPT, EXTRACT_PROMPT } from "./extraction/prompts.js";
import { SELECT_MEMORIES_SYSTEM_PROMPT } from "./recall/selector.js";
export const MEMORY_TOOL_NAMES = [
    "memory_save",
    "memory_delete",
    "memory_list",
    "memory_search",
    "memory_read",
];
export function memoryAgentDefaults(agents, readOnly = false) {
    const recall = {
        temperature: 0,
        prompt: SELECT_MEMORIES_SYSTEM_PROMPT,
        allowedTools: [],
    };
    // Read-only runs no extraction or auto-dream, so their agents (which may write) are not registered.
    if (readOnly)
        return { [agents.recall]: recall };
    return {
        [agents.recall]: recall,
        [agents.extract]: {
            prompt: EXTRACT_PROMPT,
            // A legitimate extraction is a handful of memory_save calls; the step cap terminates a model
            // that keeps re-saving the same files instead of letting it spin until the timeout (#35).
            steps: 30,
            allowedTools: ["memory_save", "memory_list", "memory_read"],
        },
        [agents.dream]: {
            prompt: AUTODREAM_PROMPT,
            steps: 60,
            allowedTools: MEMORY_TOOL_NAMES,
        },
    };
}
