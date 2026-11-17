import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import { createMemoryPlugin } from "./host/v1/plugin.js";
import { createV2Setup, type V2Cleanup, type V2Context } from "./host/v2/plugin.js";
export declare const PLUGIN_ID = "opencode-claude-memory";
export { createMemoryPlugin, createV2Setup };
export declare const MemoryPlugin: Plugin;
export declare const MemorySetup: (context: V2Context) => Promise<V2Cleanup>;
declare const plugin: PluginModule & {
    setup: typeof MemorySetup;
};
export default plugin;
export { MEMORY_AGENTS, type MemoryConfig, type MemoryOptions, MemoryOptionsSchema } from "./config.js";
export { MemoryStore } from "./store/MemoryStore.js";
