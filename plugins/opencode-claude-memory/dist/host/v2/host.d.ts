import type { Logger } from "../../util/log.js";
import { type GenerateInput, type MemoryHost } from "../types.js";
import { type ModelRef, type PermissionRule, type V2SessionApi } from "./fork.js";
export type V2AgentInfo = {
    model?: ModelRef;
    permissions?: readonly PermissionRule[];
};
export type V2HostOptions = {
    session: V2SessionApi;
    generateText: (input: {
        prompt: string;
        model?: ModelRef;
    }) => Promise<{
        text: string;
    }>;
    getAgent: (name: string) => Promise<V2AgentInfo | undefined>;
    sandboxFor: (name: string) => PermissionRule[];
    log?: Logger;
};
export declare class V2Host implements MemoryHost {
    private readonly options;
    private readonly forkSystems;
    constructor(options: V2HostOptions);
    systemFor(sessionID: string): string | undefined;
    readTranscript(sessionID: string, afterMessageID?: string): Promise<{
        messages: import("../types.js").TranscriptMessage[];
        truncated: boolean;
    }>;
    listSessions(): Promise<undefined>;
    runFork(input: Parameters<MemoryHost["runFork"]>[0]): Promise<void>;
    generate(input: GenerateInput): Promise<string>;
    private agent;
    private fork;
}
