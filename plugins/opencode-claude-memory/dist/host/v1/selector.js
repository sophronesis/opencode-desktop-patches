// V1 entry points of the recall selector: a hidden child session with structured output, driven
// through the V1 host. The selection logic itself lives in recall/selector.ts.
import { parseSelectedMemories, selectRelevantMemories } from "../../recall/selector.js";
import { createV1Host, forkAnswerText } from "./host.js";
export function extractSelectedMemories(response) {
    return parseSelectedMemories(forkAnswerText(response));
}
// Never throws: a failed or timed-out selector simply recalls nothing for this turn.
export function selectRelevantMemoryFilenames(input) {
    const { client, directory, tools, ...rest } = input;
    return selectRelevantMemories({ ...rest, host: createV1Host({ client, directory, toolsFor: () => tools }) });
}
