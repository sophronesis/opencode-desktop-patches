export declare const V1_HOOK_START_MARKER = "# >>> opencode-memory auto-initialization >>>";
export declare const V1_HOOK_RC_FILES: readonly [".zshrc", ".bashrc", ".bash_profile", ".profile"];
export declare function findLegacyShellHooks(homeDir: string): string[];
