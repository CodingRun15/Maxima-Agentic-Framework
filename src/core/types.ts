// ─── Execution Plan ────────────────────────────────────────────────

export interface ExecutionPlan {
    version: string;
    created: string;
    approved: boolean;
    phases: Phase[];
}

export interface Phase {
    id: string;
    name: string;
    parallel: boolean;
    tasks: Task[];
    status: "pending" | "in_progress" | "completed" | "locked";
}

export interface Task {
    id: string;
    name: string;
    agent: AgentType;
    files: string[];
    imports?: string[];
    exports?: string[];
    parallel_safe: boolean;
    conflicts_with: string[];
    status: "pending" | "in_progress" | "completed" | "locked";
    blocks?: string[]; // Task IDs that depend on this
}

export type AgentType = "architect" | "schema" | "codegen" | "review" | "test";

// ─── Locked Files ──────────────────────────────────────────────────

export interface LockedFile {
    path: string;
    status: "locked" | "modified" | "deleted";
    created_by: string; // Task ID
    locked_at: string;
    exports?: string[];
    imported_by?: string[];
    lines: number;
    hash: string;
}

// ─── Changelog ─────────────────────────────────────────────────────

export interface Change {
    id: string;
    date: string;
    type: "initial_build" | "architecture_change" | "modification";
    plan_id: string;
    request?: string;
    files_created: string[];
    files_modified: string[];
    files_deleted: string[];
    approved_by: string;
    locked: boolean;
}

// ─── Impact Analysis ───────────────────────────────────────────────

export interface ImpactAnalysis {
    noChange: string[];
    modify: FileModification[];
    create: FileCreation[];
    delete: string[];
    breakingChanges: BreakingChange[];
}

export interface FileModification {
    file: string;
    reason: string;
    estimate: string;
    changes: string[];
}

export interface FileCreation {
    file: string;
    reason: string;
    estimate: string;
    template?: string;
}

export interface BreakingChange {
    decision_id: string;
    description: string;
    affected_files: string[];
}

// ─── Cost Engineering Types ────────────────────────────────────────

export type ModelTier = "thinking" | "expensive" | "cheap" | "local";

export interface ModelConfig {
    thinking: ProviderModelPair;
    expensive: ProviderModelPair;
    cheap: ProviderModelPair;
    local: ProviderModelPair;
}

export interface ProviderModelPair {
    provider: "anthropic" | "openai" | "google" | "ollama";
    model: string;
    maxTokens: number;
    temperature: number;
    costPer1kInput?: number;  // USD
    costPer1kOutput?: number; // USD
}

export interface CacheEntry {
    key: string;           // SHA-256 hash of inputs
    taskId: string;
    promptHash: string;
    inputFilesHash: string;
    output: string;
    modelUsed: string;
    tokensUsed: TokenUsage;
    createdAt: string;
    ttlMs: number;         // Time-to-live in milliseconds
}

export interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
}

export interface TokenBudget {
    maxTokensPerTask: number;
    maxTokensPerPhase: number;
    maxTokensPerChange: number;
    currentUsage: TokenUsage;
    lifetimeUsage: TokenUsage;
}

export interface CostReport {
    totalCalls: number;
    cacheHits: number;
    cacheHitRate: number;
    tokensSaved: number;
    costSaved: number;
    byTier: Record<ModelTier, TokenUsage>;
    byTask: Record<string, TokenUsage>;
}

// ─── Agent Types ───────────────────────────────────────────────────

export interface AgentConfig {
    name: string;
    provider: "anthropic" | "openai" | "google" | "ollama";
    model: string;
    temperature: number;
    maxTokens: number;
    thinking?: boolean; // Enable deep thinking/extended reasoning
    onStream?: (chunk: string) => void; // Optional callback for streaming tokens
}

export interface AgentMessage {
    role: "user" | "assistant";
    content: string;
}

// ─── Context Packing ───────────────────────────────────────────────

export interface PackedContext {
    files: ContextFile[];
    architectureSummary: string;
    totalTokenEstimate: number;
}

export interface ContextFile {
    path: string;
    content: string;
    relevance: "direct" | "import" | "pattern";
    tokenEstimate: number;
}

// ─── Model Routing ─────────────────────────────────────────────────

export type TaskComplexity = "trivial" | "low" | "medium" | "high" | "critical";

export interface RoutingDecision {
    tier: ModelTier;
    reason: string;
    config: AgentConfig;
}
