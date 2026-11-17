import { type MemoryHost } from "../types.js";
import { type OpencodeClient } from "./sdk.js";
export type V1HostOptions = {
    client: OpencodeClient;
    directory: string;
    toolsFor?: (agent: string) => Record<string, boolean> | undefined;
};
export declare function forkAnswerText(response: unknown): string;
export declare function createV1Host({ client, directory, toolsFor }: V1HostOptions): MemoryHost;
