import { logger } from "../utils/logger.js";
/**
 * Model Router — selects the cheapest model capable of handling each task.
 *
 * Tiers (cheapest → most powerful):
 * - Local (Ollama): formatting, trivial refactors — $0
 * - Cheap (Gemini 3 Flash / GPT-5.2-mini): code gen, tests, docs
 * - Expensive (Claude 4 Sonnet / ChatGPT 5.2): architecture, impact analysis
 * - Thinking (Claude 4.5 Opus / Gemini 3 Pro): deep reasoning, complex refactors
 */
/** Map agent types to their default complexity */
const AGENT_COMPLEXITY = {
    architect: "critical",
    schema: "medium",
    codegen: "medium",
    review: "high",
    test: "low",
};
/** Map task name keywords to complexity overrides */
const KEYWORD_COMPLEXITY = [
    {
        keywords: ["scaffold", "boilerplate", "template", "stub", "placeholder"],
        complexity: "low",
    },
    {
        keywords: ["format", "lint", "comment", "rename", "typo"],
        complexity: "trivial",
    },
    {
        keywords: ["architecture", "design", "refactor", "migrate", "breaking"],
        complexity: "critical",
    },
    {
        keywords: ["test", "spec", "mock", "fixture"],
        complexity: "low",
    },
    {
        keywords: ["document", "readme", "changelog", "summary"],
        complexity: "low",
    },
];
/** Map complexity to model tier */
const COMPLEXITY_TIER = {
    trivial: "local",
    low: "cheap",
    medium: "cheap",
    high: "expensive",
    critical: "thinking",
};
export class ModelRouter {
    stateManager;
    constructor(stateManager) {
        this.stateManager = stateManager;
    }
    /**
     * Route a task to the appropriate model tier.
     */
    async route(agentType, taskName, description) {
        const config = await this.stateManager.getModelConfig();
        const complexity = this.assessComplexity(agentType, taskName, description);
        const tier = COMPLEXITY_TIER[complexity];
        const modelPair = config[tier];
        const agentConfig = {
            name: agentType,
            provider: modelPair.provider,
            model: modelPair.model,
            temperature: modelPair.temperature,
            maxTokens: modelPair.maxTokens,
            thinking: tier === "thinking",
        };
        const reason = `${agentType}/${taskName} → complexity: ${complexity} → tier: ${tier} → ${modelPair.provider}/${modelPair.model}`;
        logger.debug(`Model routing: ${reason}`);
        return { tier, reason, config: agentConfig };
    }
    /**
     * Route a general chat message (defaults to cheap).
     */
    async routeChat() {
        const config = await this.stateManager.getModelConfig();
        const modelPair = config.cheap;
        return {
            tier: "cheap",
            reason: "General chat → cheap model",
            config: {
                name: "assistant",
                provider: modelPair.provider,
                model: modelPair.model,
                temperature: 0.7,
                maxTokens: 2000,
            },
        };
    }
    /**
     * Force an expensive routing (for breakdown / impact analysis).
     */
    async routeExpensive(name) {
        const config = await this.stateManager.getModelConfig();
        const modelPair = config.expensive;
        return {
            tier: "expensive",
            reason: `${name} → forced expensive`,
            config: {
                name,
                provider: modelPair.provider,
                model: modelPair.model,
                temperature: modelPair.temperature,
                maxTokens: modelPair.maxTokens,
            },
        };
    }
    /**
     * Force a thinking/deep reasoning routing.
     */
    async routeThinking(name) {
        const config = await this.stateManager.getModelConfig();
        const modelPair = config.thinking;
        return {
            tier: "thinking",
            reason: `${name} → deep thinking`,
            config: {
                name,
                provider: modelPair.provider,
                model: modelPair.model,
                temperature: modelPair.temperature,
                maxTokens: modelPair.maxTokens,
                thinking: true,
            },
        };
    }
    /**
     * Force a specific tier (user override, bypasses keyword routing).
     */
    async routeForced(name, tier) {
        const config = await this.stateManager.getModelConfig();
        const modelPair = config[tier];
        return {
            tier,
            reason: `${name} → forced ${tier} (user override)`,
            config: {
                name,
                provider: modelPair.provider,
                model: modelPair.model,
                temperature: modelPair.temperature,
                maxTokens: modelPair.maxTokens,
                thinking: tier === "thinking",
            },
        };
    }
    /**
     * Assess the complexity of a task based on agent type and keywords.
     */
    assessComplexity(agentType, taskName, description) {
        const text = `${taskName} ${description || ""}`.toLowerCase();
        // Check keyword overrides first
        for (const rule of KEYWORD_COMPLEXITY) {
            if (rule.keywords.some((kw) => text.includes(kw))) {
                return rule.complexity;
            }
        }
        // Fall back to agent type default
        return AGENT_COMPLEXITY[agentType];
    }
}
