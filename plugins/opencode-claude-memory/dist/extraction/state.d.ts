export declare const EXTRACTION_STATE_VERSION = 1;
export declare const EXTRACTION_STATE_FILE = "extraction-state.json";
export declare const MAINTENANCE_LOCK_FILE = "maintenance.lock";
export declare const STATE_LOCK_FILE = "extraction-state.lock";
export declare const SESSION_STATE_TTL_MS: number;
export type SessionExtractionState = {
    lastExtractedMessageID?: string;
    lastMessageAt?: number;
    updatedAt: number;
    failures: number;
    attemptedAt?: number;
};
export type AutodreamState = {
    lastConsolidatedAt: number;
    sessionsSince: string[];
};
export type ExtractionStateData = {
    version: typeof EXTRACTION_STATE_VERSION;
    sessions: Record<string, SessionExtractionState>;
    autodream: AutodreamState;
};
export declare function emptyExtractionState(): ExtractionStateData;
export declare function parseExtractionState(raw: string): ExtractionStateData;
export declare class ExtractionStateStore {
    readonly stateDir: string;
    private readonly now;
    readonly filePath: string;
    readonly lockPath: string;
    readonly stateLockPath: string;
    constructor(stateDir: string, now?: () => number);
    read(): ExtractionStateData;
    getSession(sessionID: string): SessionExtractionState | undefined;
    update(mutate: (data: ExtractionStateData) => void): ExtractionStateData;
    private prune;
    private write;
}
export declare function posixCksum(input: string): number;
export declare function migrateLegacyAutodreamState(store: ExtractionStateStore, legacyDir: string, projectRoots: readonly string[]): boolean;
