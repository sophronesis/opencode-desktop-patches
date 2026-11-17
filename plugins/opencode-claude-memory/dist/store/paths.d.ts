export declare const ENTRYPOINT_NAME = "MEMORY.md";
export declare const MAX_ENTRYPOINT_LINES = 200;
export declare const MAX_ENTRYPOINT_BYTES = 25000;
export declare const MAX_MEMORY_FILES = 200;
export declare const MAX_MEMORY_FILE_BYTES = 40000;
export declare function validateMemoryFileName(fileName: string): string;
export declare function resolveMemoryFilePath(memoryDir: string, fileName: string): {
    relativePath: string;
    filePath: string;
};
export declare function sanitizePath(name: string): string;
export declare function findGitRoot(startPath: string): string | null;
export declare function findCanonicalGitRoot(startPath: string): string | null;
export declare function isRootPath(path: string): boolean;
export declare function resolveMemoryRoot(worktree: string, directory: string): string;
