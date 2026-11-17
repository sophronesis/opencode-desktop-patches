import type { MemoryAgents } from "../../config.js";
import type { AgentConfig, PluginConfig } from "./sdk.js";
export declare function buildAgentDefaults(agents: MemoryAgents, readOnly?: boolean): Record<string, AgentConfig>;
export declare function mergeAgentConfig(defaults: AgentConfig, user: AgentConfig | undefined): AgentConfig;
export declare class AgentRegistry {
    private readonly defaults;
    private readonly merged;
    constructor(agents: MemoryAgents, readOnly?: boolean);
    register(config: PluginConfig): void;
    toolsFor(name: string): Record<string, boolean> | undefined;
}
