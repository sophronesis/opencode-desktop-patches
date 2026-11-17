export declare const MAINTENANCE_STALE_LOCK_MS: number;
export declare const MAINTENANCE_HEARTBEAT_MS: number;
export declare const LOCK_INIT_GRACE_MS = 5000;
export declare const REAP_LOCK_STALE_MS = 30000;
export type LockContent = {
    pid: number;
    token: string;
    startedAt: number;
    heartbeatAt: number;
};
export declare class MaintenanceLock {
    readonly lockPath: string;
    private readonly now;
    private readonly pid;
    private readonly alive;
    private token;
    private heartbeat;
    constructor(lockPath: string, now?: () => number, pid?: number, alive?: (pid: number) => boolean);
    get held(): boolean;
    private readHolder;
    private isLive;
    isHeld(): boolean;
    tryAcquire(): boolean;
    private reap;
    refresh(): boolean;
    release(): void;
    private startHeartbeat;
    private stopHeartbeat;
}
