import { buildMemoryToolSpecs } from "../../tools.js";
export function buildMemoryTools(store, extraction) {
    const tools = {};
    for (const spec of buildMemoryToolSpecs(store, extraction)) {
        tools[spec.name] = {
            description: spec.description,
            args: spec.args,
            async execute(args, ctx) {
                const result = await spec.execute(args, { sessionID: ctx?.sessionID });
                return result.title === undefined ? { output: result.output } : { title: result.title, output: result.output };
            },
        };
    }
    // The Zod v4 shapes come from the plugin's own `zod` dependency, not the SDK's copy; V1 accepts
    // any object carrying `_zod`, but the two copies' types do not unify.
    return tools;
}
