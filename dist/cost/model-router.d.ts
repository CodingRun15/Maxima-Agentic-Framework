import { AgentType, ModelTier, RoutingDecision } from "../core/types.js";
import { StateManager } from "../core/state-manager.js";
export declare class ModelRouter {
    private stateManager;
    constructor(stateManager: StateManager);
    /**
     * Route a task to the appropriate model tier.
     */
    route(agentType: AgentType, taskName: string, description?: string): Promise<RoutingDecision>;
    /**
     * Route a general chat message (defaults to cheap).
     */
    routeChat(): Promise<RoutingDecision>;
    /**
     * Force an expensive routing (for breakdown / impact analysis).
     */
    routeExpensive(name: string): Promise<RoutingDecision>;
    /**
     * Force a thinking/deep reasoning routing.
     */
    routeThinking(name: string): Promise<RoutingDecision>;
    /**
     * Force a specific tier (user override, bypasses keyword routing).
     */
    routeForced(name: string, tier: ModelTier): Promise<RoutingDecision>;
    /**
     * Assess the complexity of a task based on agent type and keywords.
     */
    private assessComplexity;
}
