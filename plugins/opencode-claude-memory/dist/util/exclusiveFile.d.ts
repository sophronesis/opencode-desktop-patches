export declare function createExclusiveSync(path: string, content: string): boolean;
export declare function writeFileAtomicSync(path: string, content: string, rename?: (from: string, to: string) => void): void;
export declare function fileAgeMs(path: string, now?: number): number | undefined;
export declare function sleepSync(ms: number): void;
export declare function unlinkWithRetry(path: string, attempts?: number): boolean;
export type FileLockOptions = {
    timeoutMs?: number;
    staleMs?: number;
};
export declare const FILE_LOCK_TIMEOUT_MS = 5000;
export declare const FILE_LOCK_STALE_MS = 10000;
export declare function withFileLock<T>(lockPath: string, fn: () => T, options?: FileLockOptions): T;
