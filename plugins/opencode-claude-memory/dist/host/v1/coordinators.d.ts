import { ExtractionCoordinator } from "../../extraction/ExtractionCoordinator.js";
import { RecallCoordinator } from "../../recall/RecallCoordinator.js";
import type { ChatMessage, PluginEvent } from "./sdk.js";
export declare class V1RecallCoordinator extends RecallCoordinator {
    onMessagesTransform(output: {
        messages: ChatMessage[];
    }): void;
    onEvent(event: PluginEvent): void;
}
export declare class V1ExtractionCoordinator extends ExtractionCoordinator {
    onEvent(event: PluginEvent): void;
}
