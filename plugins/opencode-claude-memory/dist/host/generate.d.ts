import type { GenerateInput } from "./types.js";
export declare function buildGeneratePrompt(input: Pick<GenerateInput, "system" | "text" | "schema">): string;
