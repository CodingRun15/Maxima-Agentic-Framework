import { TokenUsage, CostReport, ModelTier } from "../core/types.js";
import { StateManager } from "../core/state-manager.js";
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
export declare class TokenBudgetManager {
    private stateManager;
    private sessionUsage;
    private tierUsage;
    private totalCalls;
    private cacheHits;
    constructor(stateManager: StateManager);
    /**
     * Check if a proposed call is within budget.
     * Returns { allowed, reason } — if not allowed, the caller should split the task.
     */
    checkBudget(taskId: string, estimatedInputTokens: number): Promise<{
        allowed: boolean;
        reason?: string;
        budgetRemaining?: number;
    }>;
    /**
     * Record token usage after a successful LLM call.
     */
    recordUsage(taskId: string, tier: ModelTier, usage: TokenUsage): Promise<void>;
    /**
     * Record a cache hit (no real tokens spent).
     */
    recordCacheHit(): void;
    /**
     * Estimate cost for a prompt before sending it.
     */
    estimateCost(promptText: string, tier: ModelTier, expectedOutputTokens?: number): {
        inputTokens: number;
        estimatedCostUsd: number;
    };
    /**
     * Generate a full cost report for the session.
     */
    getCostReport(): Promise<CostReport>;
    /**
     * Print a human-readable cost summary.
     */
    printCostSummary(): Promise<void>;
}
