export declare const MEMORY_TYPES: readonly ["user", "feedback", "project", "reference"];
export type MemoryType = (typeof MEMORY_TYPES)[number];
export declare const FRONTMATTER_MAX_LINES = 30;
export type Frontmatter = {
    name?: string;
    description?: string;
    type?: string;
    [key: string]: string | undefined;
};
export type ParsedMemoryFile = {
    frontmatter: Frontmatter;
    body: string;
    hasFrontmatter: boolean;
};
export declare function quoteScalar(value: string): string;
export declare function parseFrontmatter(raw: string): ParsedMemoryFile;
export declare function frontmatterKeys(raw: string): string[] | undefined;
export declare function parseFrontmatterHeader(raw: string): {
    frontmatter: Frontmatter;
    hasFrontmatter: boolean;
};
export declare const ORIGIN = "opencode";
export type NewMemoryFields = {
    name: string;
    description: string;
    type: MemoryType;
    modified: string;
};
export declare function buildFrontmatter(input: NewMemoryFields): string;
export type FrontmatterEdits = {
    set?: Record<string, string>;
    setWhereExists?: Record<string, string>;
    setMeta?: Record<string, string>;
    body?: string;
};
export declare function editFrontmatter(content: string, edits: FrontmatterEdits): string;
export declare function parseMemoryType(raw: string | undefined): MemoryType | undefined;
