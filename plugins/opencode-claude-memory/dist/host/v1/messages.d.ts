import { extractSurfacedMemoryKeys } from "../../recall/turn.js";
import type { ChatMessage } from "./sdk.js";
export { extractSurfacedMemoryKeys };
export type TurnInfo = {
    sessionID?: string;
    query?: string;
    messageID?: string;
    messageIndex?: number;
};
export declare function roleOf(message: ChatMessage): string;
export declare function extractUserQuery(message: ChatMessage): string | undefined;
export declare function getLastUserQuery(messages: readonly ChatMessage[]): TurnInfo;
export declare function buildTurnID(sessionID: string, turn: TurnInfo): string;
export declare function collectSurfacedMemoryKeys(messages: readonly ChatMessage[]): Set<string>;
export declare function extractRecentTools(messages: readonly ChatMessage[]): string[];
