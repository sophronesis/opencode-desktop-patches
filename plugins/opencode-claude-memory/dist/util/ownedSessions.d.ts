export declare class OwnedSessions {
    private readonly timers;
    add(id: string): void;
    has(id: string | undefined): boolean;
    release(id: string, graceMs: number): void;
    dispose(): void;
}
