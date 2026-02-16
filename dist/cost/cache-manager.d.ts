import { CacheEntry, TokenUsage } from "../core/types.js";
/**
 * Cache Manager — deterministic replay cache for LLM outputs.
 *
 * If the same task is re-run with identical inputs (files + prompt),
 * the cached output is returned immediately with ZERO API cost.
 *
 * Storage: .aistate/cache/<hash>.json
 * Key: SHA-256(task_id + input_files_hashes + prompt_hash)
 *
 * Savings: ~15% on repeated/incremental builds.
 */
export declare class CacheManager {
    private cachePath;
    private stats;
    constructor(cachePath: string);
    /**
     * Look up a cached result for the given inputs.
     */
    lookup(taskId: string, promptContent: string, inputFileContents: string[]): Promise<CacheEntry | null>;
    /**
     * Store a result in the cache.
     */
    store(taskId: string, promptContent: string, inputFileContents: string[], output: string, modelUsed: string, tokensUsed: TokenUsage, ttlMs?: number): Promise<void>;
    /**
     * Evict a specific cache entry.
     */
    evict(key: string): Promise<void>;
    /**
     * Clear the entire cache.
     */
    clear(): Promise<void>;
    /**
     * Get cache statistics.
     */
    getStats(): {
        hits: number;
        misses: number;
        hitRate: number;
        tokensSaved: number;
        costSaved: number;
    };
    private computeKey;
    private entryPath;
}
