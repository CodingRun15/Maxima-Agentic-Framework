import { z } from "zod";
export declare const TaskSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    agent: z.ZodEnum<{
        architect: "architect";
        schema: "schema";
        codegen: "codegen";
        review: "review";
        test: "test";
    }>;
    files: z.ZodArray<z.ZodString>;
    imports: z.ZodOptional<z.ZodArray<z.ZodString>>;
    exports: z.ZodOptional<z.ZodArray<z.ZodString>>;
    parallel_safe: z.ZodBoolean;
    conflicts_with: z.ZodArray<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        in_progress: "in_progress";
        completed: "completed";
        locked: "locked";
    }>>;
    blocks: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const PhaseSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    parallel: z.ZodBoolean;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        agent: z.ZodEnum<{
            architect: "architect";
            schema: "schema";
            codegen: "codegen";
            review: "review";
            test: "test";
        }>;
        files: z.ZodArray<z.ZodString>;
        imports: z.ZodOptional<z.ZodArray<z.ZodString>>;
        exports: z.ZodOptional<z.ZodArray<z.ZodString>>;
        parallel_safe: z.ZodBoolean;
        conflicts_with: z.ZodArray<z.ZodString>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
            locked: "locked";
        }>>;
        blocks: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    status: z.ZodDefault<z.ZodEnum<{
        pending: "pending";
        in_progress: "in_progress";
        completed: "completed";
        locked: "locked";
    }>>;
}, z.core.$strip>;
export declare const ExecutionPlanSchema: z.ZodObject<{
    version: z.ZodString;
    created: z.ZodString;
    approved: z.ZodBoolean;
    phases: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        parallel: z.ZodBoolean;
        tasks: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            agent: z.ZodEnum<{
                architect: "architect";
                schema: "schema";
                codegen: "codegen";
                review: "review";
                test: "test";
            }>;
            files: z.ZodArray<z.ZodString>;
            imports: z.ZodOptional<z.ZodArray<z.ZodString>>;
            exports: z.ZodOptional<z.ZodArray<z.ZodString>>;
            parallel_safe: z.ZodBoolean;
            conflicts_with: z.ZodArray<z.ZodString>;
            status: z.ZodDefault<z.ZodEnum<{
                pending: "pending";
                in_progress: "in_progress";
                completed: "completed";
                locked: "locked";
            }>>;
            blocks: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>>;
        status: z.ZodDefault<z.ZodEnum<{
            pending: "pending";
            in_progress: "in_progress";
            completed: "completed";
            locked: "locked";
        }>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const TokenUsageSchema: z.ZodObject<{
    inputTokens: z.ZodNumber;
    outputTokens: z.ZodNumber;
    estimatedCostUsd: z.ZodNumber;
}, z.core.$strip>;
export declare const CacheEntrySchema: z.ZodObject<{
    key: z.ZodString;
    taskId: z.ZodString;
    promptHash: z.ZodString;
    inputFilesHash: z.ZodString;
    output: z.ZodString;
    modelUsed: z.ZodString;
    tokensUsed: z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    }, z.core.$strip>;
    createdAt: z.ZodString;
    ttlMs: z.ZodNumber;
}, z.core.$strip>;
export declare const TokenBudgetSchema: z.ZodObject<{
    maxTokensPerTask: z.ZodDefault<z.ZodNumber>;
    maxTokensPerPhase: z.ZodDefault<z.ZodNumber>;
    maxTokensPerChange: z.ZodDefault<z.ZodNumber>;
    currentUsage: z.ZodDefault<z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    }, z.core.$strip>>;
    lifetimeUsage: z.ZodDefault<z.ZodObject<{
        inputTokens: z.ZodNumber;
        outputTokens: z.ZodNumber;
        estimatedCostUsd: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const ProviderModelPairSchema: z.ZodObject<{
    provider: z.ZodEnum<{
        anthropic: "anthropic";
        openai: "openai";
        ollama: "ollama";
    }>;
    model: z.ZodString;
    maxTokens: z.ZodNumber;
    temperature: z.ZodNumber;
    costPer1kInput: z.ZodOptional<z.ZodNumber>;
    costPer1kOutput: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const ModelConfigSchema: z.ZodObject<{
    expensive: z.ZodObject<{
        provider: z.ZodEnum<{
            anthropic: "anthropic";
            openai: "openai";
            ollama: "ollama";
        }>;
        model: z.ZodString;
        maxTokens: z.ZodNumber;
        temperature: z.ZodNumber;
        costPer1kInput: z.ZodOptional<z.ZodNumber>;
        costPer1kOutput: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    cheap: z.ZodObject<{
        provider: z.ZodEnum<{
            anthropic: "anthropic";
            openai: "openai";
            ollama: "ollama";
        }>;
        model: z.ZodString;
        maxTokens: z.ZodNumber;
        temperature: z.ZodNumber;
        costPer1kInput: z.ZodOptional<z.ZodNumber>;
        costPer1kOutput: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    local: z.ZodObject<{
        provider: z.ZodEnum<{
            anthropic: "anthropic";
            openai: "openai";
            ollama: "ollama";
        }>;
        model: z.ZodString;
        maxTokens: z.ZodNumber;
        temperature: z.ZodNumber;
        costPer1kInput: z.ZodOptional<z.ZodNumber>;
        costPer1kOutput: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
}, z.core.$strip>;
