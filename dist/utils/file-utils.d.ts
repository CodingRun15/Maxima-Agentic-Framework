/**
 * Compute SHA-256 hash of a string.
 */
export declare function hashContent(content: string): string;
/**
 * Compute a combined hash from multiple strings (useful for cache keys).
 */
export declare function hashMultiple(...parts: string[]): string;
/**
 * Ensure a directory exists, creating parent directories as needed.
 */
export declare function ensureDir(dirPath: string): Promise<void>;
/**
 * Safely write a file, creating parent directories as needed.
 */
export declare function safeWriteFile(filePath: string, content: string): Promise<void>;
/**
 * Check if a file or directory exists.
 */
export declare function pathExists(targetPath: string): Promise<boolean>;
/**
 * Detect if a diff is trivial (comment-only, whitespace-only changes).
 * Returns true if the change is purely cosmetic and no LLM call is needed.
 */
export declare function isTrivialDiff(oldContent: string, newContent: string): boolean;
/**
 * Rough token estimate — ~4 chars per token for English/code.
 */
export declare function estimateTokens(text: string): number;
/**
 * Strip comments and collapse whitespace to reduce tokens before sending to LLM.
 */
export declare function minifyForContext(content: string): string;
/**
 * Read a JSON file and parse it, returning null if it doesn't exist.
 */
export declare function readJsonFile<T>(filePath: string): Promise<T | null>;
/**
 * Write an object as formatted JSON.
 */
export declare function writeJsonFile(filePath: string, data: unknown): Promise<void>;
