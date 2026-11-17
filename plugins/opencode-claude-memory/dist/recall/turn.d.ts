export declare function detectIgnoreMemory(query: string | undefined): boolean;
export declare function detectResumeMemory(query: string | undefined): boolean;
export declare function deriveIgnoredFromQueries(queries: Iterable<string | undefined>): boolean;
export declare function extractSurfacedMemoryKeys(systemText: string): Set<string>;
