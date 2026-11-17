import type { ChatMessage, MessagePart } from "./sdk.js";
export { detectIgnoreMemory, detectResumeMemory } from "../../recall/turn.js";
export declare function deriveIgnoredFromHistory(messages: readonly ChatMessage[]): boolean;
export declare function isAutoMemoryPart(part: MessagePart): boolean;
export declare function stripAutoMemoryParts(messages: readonly ChatMessage[]): ChatMessage[];
