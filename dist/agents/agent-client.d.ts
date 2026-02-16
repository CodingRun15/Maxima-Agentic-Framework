import { AgentConfig, AgentMessage, TokenUsage } from "../core/types.js";
/**
 * Agent Client — multi-provider LLM client.
 *
 * Supports:
 * - Anthropic (Claude 4.5 Opus, Claude 4 Sonnet)
 * - OpenAI (ChatGPT 5.2, GPT-5.2-mini)
 * - Google (Gemini 3 Pro, Gemini 3 Flash)
 * - Ollama (local models — zero cost)
 *
 * Deep thinking / extended reasoning supported on all cloud providers.
 */
export interface ChatResult {
    content: string;
    usage: TokenUsage;
}
export declare class AgentClient {
    private anthropic?;
    private openai?;
    private google?;
    private ollama?;
    constructor();
    getAvailableProviders(): string[];
    /**
     * Send a chat request to the configured provider.
     * Falls back to any available provider if the requested one isn't configured.
     */
    chat(config: AgentConfig, messages: AgentMessage[]): Promise<ChatResult>;
    /**
     * Stream a chat response, delivering tokens via onStream callback.
     * Falls back to non-streaming chat() if streaming fails.
     */
    chatStream(config: AgentConfig, messages: AgentMessage[], onStream: (chunk: string) => void): Promise<ChatResult>;
    private streamAnthropic;
    private streamOpenAI;
    private streamGoogle;
    private streamOllama;
    /**
     * Resolve to an available provider if the configured one isn't set up.
     * Maps models to equivalent models on the fallback provider.
     */
    private resolveProvider;
    private chatAnthropic;
    private chatOpenAI;
    private chatGoogle;
    private chatOllama;
    private estimateCost;
}
