import type { Logger } from "../../util/log.js";
export declare const LOG_FILE = "opencode-memory.log";
export declare const LOG_MAX_BYTES = 1000000;
export declare function createFileLogger(stateDir: string, maxBytes?: number): Logger;
