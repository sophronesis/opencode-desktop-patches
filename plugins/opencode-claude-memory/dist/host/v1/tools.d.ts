import type { Hooks } from "@opencode-ai/plugin";
import type { ExtractionCoordinator } from "../../extraction/ExtractionCoordinator.js";
import type { MemoryStore } from "../../store/MemoryStore.js";
export type MemoryTools = NonNullable<Hooks["tool"]>;
export declare function buildMemoryTools(store: MemoryStore, extraction: Pick<ExtractionCoordinator, "recordSave" | "recordDelete">): MemoryTools;
