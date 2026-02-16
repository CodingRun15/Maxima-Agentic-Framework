import { z } from "zod";

// ─── Task & Phase Schemas ──────────────────────────────────────────

export const TaskSchema = z.object({
    id: z.string(),
    name: z.string(),
    agent: z.enum(["architect", "schema", "codegen", "review", "test"]),
    files: z.array(z.string()),
    imports: z.array(z.string()).optional(),
    exports: z.array(z.string()).optional(),
    parallel_safe: z.boolean(),
    conflicts_with: z.array(z.string()),
    status: z.enum(["pending", "in_progress", "completed", "locked"]).default("pending"),
    blocks: z.array(z.string()).optional(),
});

export const PhaseSchema = z.object({
    id: z.string(),
    name: z.string(),
    parallel: z.boolean(),
    tasks: z.array(TaskSchema),
    status: z.enum(["pending", "in_progress", "completed", "locked"]).default("pending"),
});

export const ExecutionPlanSchema = z.object({
    version: z.string(),
    created: z.string(),
    approved: z.boolean(),
    phases: z.array(PhaseSchema),
});

// ─── Cache Entry Schema ────────────────────────────────────────────

export const TokenUsageSchema = z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    estimatedCostUsd: z.number(),
});

export const CacheEntrySchema = z.object({
    key: z.string(),
    taskId: z.string(),
    promptHash: z.string(),
    inputFilesHash: z.string(),
    output: z.string(),
    modelUsed: z.string(),
    tokensUsed: TokenUsageSchema,
    createdAt: z.string(),
    ttlMs: z.number(),
});

// ─── Token Budget Schema ───────────────────────────────────────────

export const TokenBudgetSchema = z.object({
    maxTokensPerTask: z.number().default(4000),
    maxTokensPerPhase: z.number().default(20000),
    maxTokensPerChange: z.number().default(8000),
    currentUsage: TokenUsageSchema.default({
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
    }),
    lifetimeUsage: TokenUsageSchema.default({
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
    }),
});

// ─── Model Config Schema ───────────────────────────────────────────

export const ProviderModelPairSchema = z.object({
    provider: z.enum(["anthropic", "openai", "ollama"]),
    model: z.string(),
    maxTokens: z.number(),
    temperature: z.number(),
    costPer1kInput: z.number().optional(),
    costPer1kOutput: z.number().optional(),
});

export const ModelConfigSchema = z.object({
    expensive: ProviderModelPairSchema,
    cheap: ProviderModelPairSchema,
    local: ProviderModelPairSchema,
});
