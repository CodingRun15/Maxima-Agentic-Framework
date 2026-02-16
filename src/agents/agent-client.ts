import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { Ollama } from "ollama";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AgentConfig, AgentMessage, TokenUsage } from "../core/types.js";
import { logger } from "../utils/logger.js";

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

export class AgentClient {
    private anthropic?: Anthropic;
    private openai?: OpenAI;
    private google?: GoogleGenerativeAI;
    private ollama?: Ollama;

    constructor() {
        if (process.env.ANTHROPIC_API_KEY) {
            this.anthropic = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY,
            });
        }
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }
        if (process.env.GEMINI_API_KEY) {
            this.google = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
        if (process.env.OLLAMA_HOST) {
            this.ollama = new Ollama({ host: process.env.OLLAMA_HOST });
        }
        if (!this.anthropic && !this.openai && !this.google && !this.ollama) {
            throw new Error("No LLM providers configured. Run `maxima setup` to configure API keys.");
        }
    }
    getAvailableProviders(): string[] {
        const providers: string[] = [];
        if (this.anthropic) providers.push("anthropic");
        if (this.openai) providers.push("openai");
        if (this.google) providers.push("google");
        if (this.ollama) providers.push("ollama");
        return providers;
    }

    /**
     * Send a chat request to the configured provider.
     * Falls back to any available provider if the requested one isn't configured.
     */
    async chat(
        config: AgentConfig,
        messages: AgentMessage[]
    ): Promise<ChatResult> {
        try {
            // If requested provider isn't available, fall back to any available one
            const resolvedConfig = this.resolveProvider(config);

            switch (resolvedConfig.provider) {
                case "anthropic":
                    return await this.chatAnthropic(resolvedConfig, messages);
                case "openai":
                    return await this.chatOpenAI(resolvedConfig, messages);
                case "google":
                    return await this.chatGoogle(resolvedConfig, messages);
                case "ollama":
                    return await this.chatOllama(resolvedConfig, messages);
                default:
                    throw new Error(`Unsupported provider: ${resolvedConfig.provider}`);
            }
        } catch (error: any) {
            const status = error?.status || error?.statusCode;
            const message = error?.message || String(error);

            // Return error as content instead of crashing
            if (status === 404) {
                return {
                    content: `[ERROR] Model "${config.model}" not found on ${config.provider}. Check that the model name is valid. Run \`maxima setup\` to reconfigure.`,
                    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
                };
            }
            if (status === 401 || status === 403) {
                return {
                    content: `[ERROR] Authentication failed for ${config.provider}. Your API key may be invalid or expired. Run \`maxima setup\` to update it.`,
                    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
                };
            }
            if (status === 429) {
                return {
                    content: `[ERROR] Rate limited by ${config.provider}. Please wait a moment and try again.`,
                    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
                };
            }
            if (message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("fetch failed")) {
                return {
                    content: `[ERROR] Cannot connect to ${config.provider}. Check your internet connection${config.provider === "ollama" ? " and that Ollama is running" : ""}.`,
                    usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
                };
            }

            // Unexpected errors — still don't crash
            logger.warn(`API error (${config.provider}/${config.model}): ${message}`);
            return {
                content: `[ERROR] ${config.provider} API error: ${message}`,
                usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
            };
        }
    }

    /**
     * Stream a chat response, delivering tokens via onStream callback.
     * Falls back to non-streaming chat() if streaming fails.
     */
    async chatStream(
        config: AgentConfig,
        messages: AgentMessage[],
        onStream: (chunk: string) => void
    ): Promise<ChatResult> {
        try {
            const resolvedConfig = this.resolveProvider(config);

            switch (resolvedConfig.provider) {
                case "anthropic":
                    return await this.streamAnthropic(resolvedConfig, messages, onStream);
                case "openai":
                    return await this.streamOpenAI(resolvedConfig, messages, onStream);
                case "google":
                    return await this.streamGoogle(resolvedConfig, messages, onStream);
                case "ollama":
                    return await this.streamOllama(resolvedConfig, messages, onStream);
                default:
                    return await this.chat(config, messages);
            }
        } catch (error: any) {
            // Fallback to non-streaming on any streaming error
            logger.warn(`Streaming failed (${config.provider}), falling back to non-streaming: ${error?.message}`);
            return await this.chat(config, messages);
        }
    }

    // ─── Streaming: Anthropic ──────────────────────────────────────────

    private async streamAnthropic(
        config: AgentConfig,
        messages: AgentMessage[],
        onStream: (chunk: string) => void
    ): Promise<ChatResult> {
        if (!this.anthropic) throw new Error("Anthropic not configured");

        let content = "";
        let inputTokens = 0;
        let outputTokens = 0;

        const stream = this.anthropic.messages.stream({
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: config.thinking ? 1 : config.temperature,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });

        for await (const event of stream) {
            if (event.type === "content_block_delta" && (event.delta as any).type === "text_delta") {
                const text = (event.delta as any).text;
                content += text;
                onStream(text);
            }
        }

        const finalMessage = await stream.finalMessage();
        inputTokens = finalMessage.usage.input_tokens;
        outputTokens = finalMessage.usage.output_tokens;

        return {
            content,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCostUsd: this.estimateCost(inputTokens, outputTokens, config),
            },
        };
    }

    // ─── Streaming: OpenAI ─────────────────────────────────────────────

    private async streamOpenAI(
        config: AgentConfig,
        messages: AgentMessage[],
        onStream: (chunk: string) => void
    ): Promise<ChatResult> {
        if (!this.openai) throw new Error("OpenAI not configured");

        const params: any = {
            model: config.model,
            stream: true,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        };

        if (config.thinking) {
            params.reasoning_effort = "high";
            params.max_completion_tokens = config.maxTokens;
        } else {
            params.temperature = config.temperature;
            params.max_tokens = config.maxTokens;
        }

        let content = "";
        let inputTokens = 0;
        let outputTokens = 0;

        const stream = await this.openai.chat.completions.create(params);
        for await (const chunk of stream as any) {
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
                content += delta;
                onStream(delta);
            }
            if (chunk.usage) {
                inputTokens = chunk.usage.prompt_tokens ?? 0;
                outputTokens = chunk.usage.completion_tokens ?? 0;
            }
        }

        // Estimate tokens if not reported in stream
        if (inputTokens === 0 && outputTokens === 0) {
            const totalInput = messages.reduce((acc, m) => acc + m.content.length, 0);
            inputTokens = Math.ceil(totalInput / 4);
            outputTokens = Math.ceil(content.length / 4);
        }

        return {
            content,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCostUsd: this.estimateCost(inputTokens, outputTokens, config),
            },
        };
    }

    // ─── Streaming: Google ─────────────────────────────────────────────

    private async streamGoogle(
        config: AgentConfig,
        messages: AgentMessage[],
        onStream: (chunk: string) => void
    ): Promise<ChatResult> {
        if (!this.google) throw new Error("Gemini not configured");

        const generationConfig: any = {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
        };

        if (config.thinking) {
            generationConfig.thinkingConfig = {
                thinkingBudget: Math.min(10000, config.maxTokens),
            };
            generationConfig.temperature = undefined;
        }

        const model = this.google.getGenerativeModel({
            model: config.model,
            generationConfig,
        });

        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const lastMessage = messages[messages.length - 1];
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(lastMessage.content);

        let content = "";
        for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
                content += text;
                onStream(text);
            }
        }

        const response = await result.response;
        const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

        return {
            content,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCostUsd: this.estimateCost(inputTokens, outputTokens, config),
            },
        };
    }

    // ─── Streaming: Ollama ─────────────────────────────────────────────

    private async streamOllama(
        config: AgentConfig,
        messages: AgentMessage[],
        onStream: (chunk: string) => void
    ): Promise<ChatResult> {
        if (!this.ollama) throw new Error("Ollama not configured");

        let content = "";
        let inputTokens = 0;
        let outputTokens = 0;

        const response = await this.ollama.chat({
            model: config.model,
            stream: true,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });

        for await (const chunk of response) {
            if (chunk.message?.content) {
                content += chunk.message.content;
                onStream(chunk.message.content);
            }
            if (chunk.done) {
                inputTokens = (chunk as any).prompt_eval_count ?? 0;
                outputTokens = (chunk as any).eval_count ?? 0;
            }
        }

        return {
            content,
            usage: {
                inputTokens,
                outputTokens,
                estimatedCostUsd: 0, // Local = free
            },
        };
    }

    /**
     * Resolve to an available provider if the configured one isn't set up.
     * Maps models to equivalent models on the fallback provider.
     */
    private resolveProvider(config: AgentConfig): AgentConfig {
        const providerAvailable = {
            anthropic: !!this.anthropic,
            openai: !!this.openai,
            google: !!this.google,
            ollama: !!this.ollama,
        };

        if (providerAvailable[config.provider]) {
            return config; // Requested provider is available
        }

        // Fallback chain: google → openai → anthropic → ollama
        const fallbacks: Array<{ provider: "anthropic" | "openai" | "google" | "ollama"; models: Record<string, string> }> = [
            {
                provider: "google",
                models: {
                    _thinking: "gemini-3-flash-preview-preview",
                    _expensive: "gemini-3-flash-preview-preview",
                    _cheap: "gemini-3-flash-preview-preview",
                    _default: "gemini-3-flash-preview-preview",
                },
            },
            {
                provider: "openai",
                models: {
                    _thinking: "chatgpt-5.2",
                    _expensive: "chatgpt-5.2",
                    _cheap: "gpt-5.2-mini",
                    _default: "gpt-5.2-mini",
                },
            },
            {
                provider: "anthropic",
                models: {
                    _thinking: "claude-4.5-opus",
                    _expensive: "claude-4-sonnet",
                    _cheap: "claude-4-haiku",
                    _default: "claude-4-haiku",
                },
            },
            {
                provider: "ollama",
                models: {
                    _thinking: "llama4",
                    _expensive: "llama4",
                    _cheap: "llama4",
                    _default: "llama4",
                },
            },
        ];

        for (const fb of fallbacks) {
            if (providerAvailable[fb.provider]) {
                const tier = config.thinking ? "_thinking" : "_default";
                const model = fb.models[tier];
                logger.warn(
                    `Provider ${config.provider} not available, falling back to ${fb.provider}/${model}`
                );
                return { ...config, provider: fb.provider, model };
            }
        }

        throw new Error("No LLM providers available.");
    }

    // ─── Anthropic ─────────────────────────────────────────────────────

    private async chatAnthropic(
        config: AgentConfig,
        messages: AgentMessage[]
    ): Promise<ChatResult> {
        if (!this.anthropic) {
            throw new Error("Anthropic API key not set.");
        }

        // Deep thinking: use extended thinking for Claude 4.5 Opus
        if (config.thinking) {
            const response = await this.anthropic.messages.create({
                model: config.model,
                max_tokens: config.maxTokens,
                temperature: 1, // Required for extended thinking
                thinking: {
                    type: "enabled",
                    budget_tokens: Math.min(10000, config.maxTokens),
                },
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            } as any);

            // Extract text from thinking response
            const textBlocks = response.content.filter((b: any) => b.type === "text");
            const content = textBlocks.map((b: any) => b.text).join("\n");

            const usage: TokenUsage = {
                inputTokens: response.usage.input_tokens,
                outputTokens: response.usage.output_tokens,
                estimatedCostUsd: this.estimateCost(
                    response.usage.input_tokens,
                    response.usage.output_tokens,
                    config
                ),
            };

            return { content, usage };
        }

        const response = await this.anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: config.temperature,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        });

        const content =
            response.content[0].type === "text" ? response.content[0].text : "";

        const usage: TokenUsage = {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            estimatedCostUsd: this.estimateCost(
                response.usage.input_tokens,
                response.usage.output_tokens,
                config
            ),
        };

        return { content, usage };
    }

    // ─── OpenAI ─────────────────────────────────────────────────────────

    private async chatOpenAI(
        config: AgentConfig,
        messages: AgentMessage[]
    ): Promise<ChatResult> {
        if (!this.openai) {
            throw new Error("OpenAI API key not set.");
        }

        // Deep thinking: use reasoning_effort for o-series / ChatGPT 5.2
        const params: any = {
            model: config.model,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
            })),
        };

        if (config.thinking) {
            params.reasoning_effort = "high";
            params.max_completion_tokens = config.maxTokens;
        } else {
            params.temperature = config.temperature;
            params.max_tokens = config.maxTokens;
        }

        const response = await this.openai.chat.completions.create(params);
        const content = response.choices[0].message.content || "";

        const usage: TokenUsage = {
            inputTokens: response.usage?.prompt_tokens ?? 0,
            outputTokens: response.usage?.completion_tokens ?? 0,
            estimatedCostUsd: this.estimateCost(
                response.usage?.prompt_tokens ?? 0,
                response.usage?.completion_tokens ?? 0,
                config
            ),
        };

        return { content, usage };
    }

    // ─── Google ─────────────────────────────────────────────────────────

    private async chatGoogle(
        config: AgentConfig,
        messages: AgentMessage[]
    ): Promise<ChatResult> {
        if (!this.google) {
            throw new Error("Gemini API key not set.");
        }

        const generationConfig: any = {
            temperature: config.temperature,
            maxOutputTokens: config.maxTokens,
        };

        // Deep thinking: enable thinkingConfig for Gemini
        if (config.thinking) {
            generationConfig.thinkingConfig = {
                thinkingBudget: Math.min(10000, config.maxTokens),
            };
            generationConfig.temperature = undefined; // Gemini thinking uses default temp
        }

        const model = this.google.getGenerativeModel({
            model: config.model,
            generationConfig,
        });

        // Convert message history to Gemini format
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));

        const lastMessage = messages[messages.length - 1];
        const chat = model.startChat({ history });
        const result = await chat.sendMessage(lastMessage.content);
        const response = result.response;
        const content = response.text();

        const usage: TokenUsage = {
            inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
            estimatedCostUsd: this.estimateCost(
                response.usageMetadata?.promptTokenCount ?? 0,
                response.usageMetadata?.candidatesTokenCount ?? 0,
                config
            ),
        };

        return { content, usage };
    }

    // ─── Ollama ─────────────────────────────────────────────────────────

    private async chatOllama(
        config: AgentConfig,
        messages: AgentMessage[]
    ): Promise<ChatResult> {
        try {
            const response = await this.ollama?.chat({
                model: config.model,
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            const content = response?.message.content;

            const usage: TokenUsage = {
                inputTokens: response?.prompt_eval_count ?? 0,
                outputTokens: response?.eval_count ?? 0,
                estimatedCostUsd: 0, // Local = free
            };

            return { content: content ?? "", usage };
        } catch (error) {
            logger.warn(
                `Ollama not available (${config.model}), falling back to cloud model.`
            );
            // Fall back to available cloud provider
            const fallbackConfig = this.resolveProvider({
                ...config,
                provider: "google", // Try Google first (cheapest)
            });
            if (fallbackConfig.provider !== "ollama") {
                return this.chat(fallbackConfig, messages);
            }
            throw new Error("No LLM provider available.");
        }
    }

    // ─── Cost Estimation ──────────────────────────────────────────────

    private estimateCost(
        inputTokens: number,
        outputTokens: number,
        config: AgentConfig
    ): number {
        const costTable: Record<string, { input: number; output: number }> = {
            // Anthropic — 2026
            "claude-4.5-opus": { input: 0.015 / 1000, output: 0.075 / 1000 },
            "claude-4-sonnet": { input: 0.003 / 1000, output: 0.015 / 1000 },
            "claude-4-haiku": { input: 0.0008 / 1000, output: 0.004 / 1000 },
            // OpenAI — 2026
            "chatgpt-5.2": { input: 0.005 / 1000, output: 0.015 / 1000 },
            "gpt-5.2-mini": { input: 0.0003 / 1000, output: 0.0012 / 1000 },
            "o3": { input: 0.01 / 1000, output: 0.04 / 1000 },
            "o4-mini": { input: 0.001 / 1000, output: 0.004 / 1000 },
            // Google — 2026
            // "gemini-3-pro": { input: 0.00125 / 1000, output: 0.005 / 1000 },
            "gemini-3-flash-preview": { input: 0.0001 / 1000, output: 0.0004 / 1000 },
            "gemini-3-flash-preview-lite": { input: 0.00005 / 1000, output: 0.0002 / 1000 },
        };

        const costs = costTable[config.model] || { input: 0.001 / 1000, output: 0.002 / 1000 };
        return inputTokens * costs.input + outputTokens * costs.output;
    }
}
