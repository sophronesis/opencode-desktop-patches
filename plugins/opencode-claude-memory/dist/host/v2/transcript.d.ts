import type { TranscriptMessage } from "../types.js";
import type { V2Message } from "./fork.js";
export declare function toTranscript(messages: readonly V2Message[]): TranscriptMessage[];
