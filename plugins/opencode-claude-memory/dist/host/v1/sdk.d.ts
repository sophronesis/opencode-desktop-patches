import type { Hooks, PluginInput } from "@opencode-ai/plugin";
export type OpencodeClient = PluginInput["client"];
export type PluginEvent = Parameters<NonNullable<Hooks["event"]>>[0]["event"];
export type PluginConfig = Parameters<NonNullable<Hooks["config"]>>[0];
export type AgentConfig = NonNullable<NonNullable<PluginConfig["agent"]>[string]>;
export type ChatMessage = Parameters<NonNullable<Hooks["experimental.chat.messages.transform"]>>[1]["messages"][number];
export type MessageInfo = ChatMessage["info"];
export type MessagePart = ChatMessage["parts"][number];
export type SessionInfo = Extract<PluginEvent, {
    type: "session.deleted";
}>["properties"]["info"];
export declare function unwrapData<T = unknown>(response: unknown): T | undefined;
