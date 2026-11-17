import * as path from "node:path";
type DirectoryPaths = Pick<typeof path, "isAbsolute" | "join" | "normalize" | "sep">;
export declare function resolveAutoMemoryDirectory(value: string | undefined, homeDir: string, paths?: DirectoryPaths): string | undefined;
export {};
