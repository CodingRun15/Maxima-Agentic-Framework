import fs from "fs/promises";
import path from "path";
import { hashMultiple, readJsonFile, writeJsonFile, ensureDir } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";
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
export class CacheManager {
    cachePath;
    stats = { hits: 0, misses: 0, tokensSaved: 0, costSaved: 0 };
    constructor(cachePath) {
        this.cachePath = cachePath;
    }
    /**
     * Look up a cached result for the given inputs.
     */
    async lookup(taskId, promptContent, inputFileContents) {
        const key = this.computeKey(taskId, promptContent, inputFileContents);
        const entry = await readJsonFile(this.entryPath(key));
        if (!entry) {
            this.stats.misses++;
            logger.debug(`Cache MISS: ${taskId} (key: ${key.slice(0, 12)}...)`);
            return null;
        }
        // Check TTL
        const age = Date.now() - new Date(entry.createdAt).getTime();
        if (age > entry.ttlMs) {
            this.stats.misses++;
            logger.debug(`Cache EXPIRED: ${taskId} (age: ${Math.round(age / 1000)}s)`);
            await this.evict(key);
            return null;
        }
        this.stats.hits++;
        this.stats.tokensSaved += entry.tokensUsed.inputTokens + entry.tokensUsed.outputTokens;
        this.stats.costSaved += entry.tokensUsed.estimatedCostUsd;
        logger.cost(`Cache HIT: ${taskId}`, {
            input: entry.tokensUsed.inputTokens,
            output: entry.tokensUsed.outputTokens,
            cost: entry.tokensUsed.estimatedCostUsd,
        });
        return entry;
    }
    /**
     * Store a result in the cache.
     */
    async store(taskId, promptContent, inputFileContents, output, modelUsed, tokensUsed, ttlMs = 24 * 60 * 60 * 1000 // Default: 24 hours
    ) {
        const key = this.computeKey(taskId, promptContent, inputFileContents);
        const promptHash = hashMultiple(promptContent);
        const inputFilesHash = hashMultiple(...inputFileContents);
        const entry = {
            key,
            taskId,
            promptHash,
            inputFilesHash,
            output,
            modelUsed,
            tokensUsed,
            createdAt: new Date().toISOString(),
            ttlMs,
        };
        await ensureDir(this.cachePath);
        await writeJsonFile(this.entryPath(key), entry);
        logger.debug(`Cache STORE: ${taskId} (key: ${key.slice(0, 12)}...)`);
    }
    /**
     * Evict a specific cache entry.
     */
    async evict(key) {
        try {
            await fs.unlink(this.entryPath(key));
        }
        catch {
            // Already gone
        }
    }
    /**
     * Clear the entire cache.
     */
    async clear() {
        try {
            const files = await fs.readdir(this.cachePath);
            for (const file of files) {
                if (file.endsWith(".json")) {
                    await fs.unlink(path.join(this.cachePath, file));
                }
            }
            logger.success("Cache cleared");
        }
        catch {
            // Cache directory doesn't exist yet
        }
    }
    /**
     * Get cache statistics.
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return {
            ...this.stats,
            hitRate: total > 0 ? this.stats.hits / total : 0,
        };
    }
    // ─── Private Helpers ─────────────────────────────────────────────
    computeKey(taskId, promptContent, inputFileContents) {
        return hashMultiple(taskId, promptContent, ...inputFileContents);
    }
    entryPath(key) {
        return path.join(this.cachePath, `${key}.json`);
    }
}
