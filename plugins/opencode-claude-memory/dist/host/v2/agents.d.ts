import type { AgentEditor } from "@opencode/plugin/promise/agent";
import type { MemoryAgents } from "../../config.js";
import type { PermissionRule } from "./fork.js";
export type { PermissionRule };
export declare const BASELINE_PROBE_AGENT = "opencode-memory-baseline-probe";
export declare const PERMISSIONS_PROBE_AGENT = "opencode-memory-permissions-probe";
export declare function sandboxRules(allowedTools: readonly string[]): PermissionRule[];
export declare const PROBE_RULES: readonly PermissionRule[];
export declare function userRules(rules: readonly PermissionRule[], baseline: readonly PermissionRule[]): PermissionRule[];
export declare function applyMemoryAgents(editor: AgentEditor, agents: MemoryAgents, readOnly?: boolean): void;
export declare function ownAgentRules(resolved: readonly PermissionRule[], sandbox: readonly PermissionRule[], probe: readonly PermissionRule[]): PermissionRule[] | undefined;
export declare function forkSessionRules(sandbox: readonly PermissionRule[], resolved: readonly PermissionRule[] | undefined, probe: readonly PermissionRule[] | undefined): {
    rules: PermissionRule[];
    own: boolean;
};
