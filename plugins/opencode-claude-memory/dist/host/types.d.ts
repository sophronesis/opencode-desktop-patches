export declare const SDK_READ_TIMEOUT_MS = 30000;
export type TranscriptPart = {
    type?: string;
    text?: string;
    synthetic?: boolean;
    tool?: string;
    state?: {
        status?: string;
        output?: string;
    };
};
export type TranscriptMessage = {
    info: {
        id: string;
        role?: string;
        time?: {
            created?: number;
            completed?: number;
        };
    };
    parts?: readonly TranscriptPart[];
};
export type Transcript = {
    messages: TranscriptMessage[];
    truncated: boolean;
};
export type SessionSummary = {
    id: string;
    parentID?: string;
    updatedAt?: number;
};
export type ForkCleanupStage = "abort" | "delete";
export type ForkInput = {
    agent: string;
    title: string;
    system?: string;
    text: string;
    parentSessionID?: string;
    timeoutMs: number;
    onCreated?: (forkID: string) => void;
    onFinished?: (forkID: string) => void;
    onCleanupFailed?: (forkID: string, stage: ForkCleanupStage, error: unknown) => void;
};
export type GenerateInput = ForkInput & {
    schema?: Record<string, unknown>;
};
export interface MemoryHost {
    readTranscript(sessionID: string, afterMessageID?: string): Promise<Transcript>;
    listSessions(): Promise<SessionSummary[] | undefined>;
    runFork(input: ForkInput): Promise<void>;
    generate(input: GenerateInput): Promise<string>;
}
