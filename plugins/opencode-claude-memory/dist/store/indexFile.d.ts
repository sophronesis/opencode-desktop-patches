export declare const POINTER_RE: RegExp;
export declare function readIndexFile(entrypoint: string): string;
export declare function buildIndexPointer(fileName: string, name: string, description: string): string;
export declare function indexHasPointer(raw: string, pointer: string): boolean;
export declare function findIndexPointerLine(raw: string, fileName: string): string | undefined;
export declare function pointerTarget(line: string): string | undefined;
export declare function upsertIndexLine(raw: string, fileName: string, pointer: string): string;
export declare function removeIndexLine(raw: string, fileName: string): string;
export type EntrypointTruncation = {
    content: string;
    lineCount: number;
    byteCount: number;
    wasLineTruncated: boolean;
    wasByteTruncated: boolean;
};
export declare function truncateEntrypoint(raw: string): EntrypointTruncation;
