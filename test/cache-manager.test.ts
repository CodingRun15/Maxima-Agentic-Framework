import { describe, it, expect, beforeEach } from "vitest";
import { CacheManager } from "../src/cost/cache-manager.js";
import { mkdtemp } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

describe("CacheManager", () => {
    let cache: CacheManager;
    let cachePath: string;

    beforeEach(async () => {
        cachePath = await mkdtemp(path.join(tmpdir(), "ai-cache-"));
        cache = new CacheManager(cachePath);
    });

    it("should return null on cache miss", async () => {
        const result = await cache.lookup("task-1", "prompt", ["file content"]);
        expect(result).toBeNull();
    });

    it("should store and retrieve cached entries", async () => {
        const usage = { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 };

        await cache.store(
            "task-1",
            "generate the code",
            ["input file content"],
            "generated output",
            "gpt-4o-mini",
            usage,
            60000
        );

        const result = await cache.lookup("task-1", "generate the code", [
            "input file content",
        ]);

        expect(result).not.toBeNull();
        expect(result!.output).toBe("generated output");
        expect(result!.modelUsed).toBe("gpt-4o-mini");
        expect(result!.tokensUsed.inputTokens).toBe(100);
    });

    it("should miss on different inputs", async () => {
        const usage = { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 };

        await cache.store(
            "task-1",
            "prompt-v1",
            ["file v1"],
            "output v1",
            "gpt-4o-mini",
            usage
        );

        // Same task, different prompt → miss
        const result = await cache.lookup("task-1", "prompt-v2", ["file v1"]);
        expect(result).toBeNull();

        // Same task, different file content → miss
        const result2 = await cache.lookup("task-1", "prompt-v1", ["file v2"]);
        expect(result2).toBeNull();
    });

    it("should track hit/miss stats", async () => {
        const usage = { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 };

        await cache.store("task-1", "p", ["f"], "out", "gpt-4o-mini", usage);

        await cache.lookup("task-1", "p", ["f"]); // hit
        await cache.lookup("task-2", "p", ["f"]); // miss

        const stats = cache.getStats();
        expect(stats.hits).toBe(1);
        expect(stats.misses).toBe(1);
        expect(stats.hitRate).toBe(0.5);
    });

    it("should clear all entries", async () => {
        const usage = { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.01 };

        await cache.store("task-1", "p", ["f"], "out", "gpt-4o-mini", usage);
        await cache.clear();

        const result = await cache.lookup("task-1", "p", ["f"]);
        expect(result).toBeNull();
    });
});
