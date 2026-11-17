export declare class TimeoutError extends Error {
    constructor(what: string, timeoutMs: number);
}
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, error: () => Error): Promise<T>;
export declare function withDeadline<T>(what: string, timeoutMs: number, call: (signal: AbortSignal) => Promise<T>): Promise<T>;
