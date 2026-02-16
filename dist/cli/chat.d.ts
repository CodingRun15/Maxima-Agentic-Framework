/**
 * Interactive Chat Interface — the main user-facing REPL.
 *
 * Every LLM call goes through the 6-layer cost pipeline:
 * 1. Trivial diff detection → skip LLM entirely
 * 2. Cache lookup → return cached result if inputs unchanged
 * 3. Model routing → pick cheapest model for the task
 * 4. Context packing → trim to only relevant files
 * 5. Token budget gate → block if over budget
 * 6. API call → cache result
 */
export declare class ChatInterface {
    private rl;
    private stateManager;
    private agentClient;
    private promptBuilder;
    private dependencyAnalyzer;
    private contextPacker;
    private modelRouter;
    private cacheManager;
    private budgetManager;
    private conversationHistory;
    private pendingPlan;
    private tierOverride;
    private brainstormMode;
    private brainstormTopic;
    private brainstormHistory;
    constructor(projectRoot: string);
    start(): Promise<void>;
    private shutdown;
    private handleInput;
    private handleCommand;
    private handleBreakdown;
    private handleApprovePlan;
    private handleBuild;
    /**
     * Execute a single task through the full cost pipeline.
     */
    private executeTask;
    private handleStatus;
    private handleChange;
    private handleBrainstorm;
    private handleBrainstormMessage;
    private handleMessage;
    private handleTierOverride;
    /**
     * Parse inline tier flags from a message.
     * Returns the tier if found, null otherwise.
     */
    private parseInlineTier;
    private askForApproval;
    /**
     * Parse LLM response for file blocks:
     * --- FILE: <path> ---
     * <content>
     * --- END FILE ---
     */
    private parseFileBlocks;
}
