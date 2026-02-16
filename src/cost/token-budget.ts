import { TokenUsage, TokenBudget, CostReport, ModelTier } from "../core/types.js";
import { StateManager } from "../core/state-manager.js";
import { logger } from "../utils/logger.js";
import { estimateTokens } from "../utils/file-utils.js";

/**
 * Token Budget — hard limits on token usage per task, phase, and change request.
 *
 * Prevents runaway costs by:
 * 1. Checking budget BEFORE making an LLM call
 * 2. Auto-splitting tasks that exceed budget
 * 3. Tracking cumulative spend across the project lifecycle
 * 4. Providing cost reports
 *
 * This is the final gate before any API call goes out.
 */
export class TokenBudgetManager {
    private sessionUsage: Record<string, TokenUsage> = {};
    private tierUsage: Record<ModelTier, TokenUsage> = {
        thinking: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        expensive: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        cheap: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
        local: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    };
    private totalCalls = 0;
    private cacheHits = 0;

    constructor(private stateManager: StateManager) { }

    /**
     * Check if a proposed call is within budget.
     * Returns { allowed, reason } — if not allowed, the caller should split the task.
     */
    async checkBudget(
        taskId: string,
        estimatedInputTokens: number
    ): Promise<{ allowed: boolean; reason?: string; budgetRemaining?: number }> {
        const budget = await this.stateManager.getTokenBudget();

        // Check per-task budget
        const taskUsage = this.sessionUsage[taskId]?.inputTokens ?? 0;
        const projectedUsage = taskUsage + estimatedInputTokens;

        if (projectedUsage > budget.maxTokensPerTask) {
            return {
                allowed: false,
                reason: `Task ${taskId} would exceed token budget (${projectedUsage} > ${budget.maxTokensPerTask}). Split into subtasks.`,
                budgetRemaining: budget.maxTokensPerTask - taskUsage,
            };
        }

        return {
            allowed: true,
            budgetRemaining: budget.maxTokensPerTask - projectedUsage,
        };
    }

    /**
     * Record token usage after a successful LLM call.
     */
    async recordUsage(
        taskId: string,
        tier: ModelTier,
        usage: TokenUsage
    ): Promise<void> {
        // Update session tracking
        if (!this.sessionUsage[taskId]) {
            this.sessionUsage[taskId] = {
                inputTokens: 0,
                outputTokens: 0,
                estimatedCostUsd: 0,
            };
        }

        this.sessionUsage[taskId].inputTokens += usage.inputTokens;
        this.sessionUsage[taskId].outputTokens += usage.outputTokens;
        this.sessionUsage[taskId].estimatedCostUsd += usage.estimatedCostUsd;

        // Update tier tracking
        this.tierUsage[tier].inputTokens += usage.inputTokens;
        this.tierUsage[tier].outputTokens += usage.outputTokens;
        this.tierUsage[tier].estimatedCostUsd += usage.estimatedCostUsd;

        this.totalCalls++;

        // Persist lifetime usage
        const budget = await this.stateManager.getTokenBudget();
        budget.lifetimeUsage.inputTokens += usage.inputTokens;
        budget.lifetimeUsage.outputTokens += usage.outputTokens;
        budget.lifetimeUsage.estimatedCostUsd += usage.estimatedCostUsd;
        budget.currentUsage = usage;
        await this.stateManager.saveTokenBudget(budget);

        logger.cost(`${taskId} [${tier}]`, {
            input: usage.inputTokens,
            output: usage.outputTokens,
            cost: usage.estimatedCostUsd,
        });
    }

    /**
     * Record a cache hit (no real tokens spent).
     */
    recordCacheHit(): void {
        this.cacheHits++;
    }

    /**
     * Estimate cost for a prompt before sending it.
     */
    estimateCost(
        promptText: string,
        tier: ModelTier,
        expectedOutputTokens: number = 2000
    ): { inputTokens: number; estimatedCostUsd: number } {
        const inputTokens = estimateTokens(promptText);
        // Rough cost estimation based on tier
        const costPerToken: Record<ModelTier, number> = {
            thinking: 0.00005,   // ~$50/1M tokens average (deep reasoning)
            expensive: 0.000015, // ~$15/1M tokens average
            cheap: 0.0000004,    // ~$0.40/1M tokens
            local: 0,            // Free
        };

        const estimatedCostUsd =
            (inputTokens + expectedOutputTokens) * costPerToken[tier];

        return { inputTokens, estimatedCostUsd };
    }

    /**
     * Generate a full cost report for the session.
     */
    async getCostReport(): Promise<CostReport> {
        const cacheStats = { hits: this.cacheHits, total: this.totalCalls + this.cacheHits };

        return {
            totalCalls: this.totalCalls,
            cacheHits: this.cacheHits,
            cacheHitRate: cacheStats.total > 0 ? this.cacheHits / cacheStats.total : 0,
            tokensSaved: 0, // Filled by cache manager
            costSaved: 0,   // Filled by cache manager
            byTier: { ...this.tierUsage },
            byTask: { ...this.sessionUsage },
        };
    }

    /**
     * Print a human-readable cost summary.
     */
    async printCostSummary(): Promise<void> {
        const report = await this.getCostReport();
        const budget = await this.stateManager.getTokenBudget();

        logger.header("COST REPORT");

        console.log(`  Total API calls:    ${report.totalCalls}`);
        console.log(`  Cache hits:         ${report.cacheHits}`);
        console.log(`  Cache hit rate:     ${(report.cacheHitRate * 100).toFixed(1)}%`);
        console.log("");
        console.log("  By tier:");
        for (const [tier, usage] of Object.entries(report.byTier)) {
            if (usage.inputTokens > 0 || usage.outputTokens > 0) {
                console.log(
                    `    ${tier.padEnd(10)} in:${usage.inputTokens} out:${usage.outputTokens} $${usage.estimatedCostUsd.toFixed(4)}`
                );
            }
        }
        console.log("");
        console.log("  Lifetime:");
        console.log(
            `    Total tokens:  ${budget.lifetimeUsage.inputTokens + budget.lifetimeUsage.outputTokens}`
        );
        console.log(
            `    Total cost:    $${budget.lifetimeUsage.estimatedCostUsd.toFixed(4)}`
        );
    }
}
