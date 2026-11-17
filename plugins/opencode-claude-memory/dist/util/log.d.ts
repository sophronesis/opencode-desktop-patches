export declare const LOG_SERVICE = "opencode-claude-memory";
export type LogLevel = "debug" | "info" | "warn" | "error";
export type Logger = (level: LogLevel, message: string, extra?: Record<string, unknown>) => void;
export declare function getErrorMessage(error: unknown): string;
