import { LOG_SERVICE, type Logger } from "../../util/log.js";
import type { OpencodeClient } from "./sdk.js";
export { LOG_SERVICE };
export declare function createLogger(client: OpencodeClient | undefined, directory: string): Logger;
