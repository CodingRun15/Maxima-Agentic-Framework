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
    blocks?: string[];
}
export type AgentType = "architect" | "schema" | "codegen" | "review" | "test";
export interface LockedFile {
    path: string;
    status: "locked" | "modified" | "deleted";
    created_by: string;
    locked_at: string;
    exports?: string[];
    imported_by?: string[];
    lines: number;
    hash: string;
}
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
    costPer1kInput?: number;
    costPer1kOutput?: number;
}
export interface CacheEntry {
    key: string;
    taskId: string;
    promptHash: string;
    inputFilesHash: string;
    output: string;
    modelUsed: string;
    tokensUsed: TokenUsage;
    createdAt: string;
    ttlMs: number;
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
export interface AgentConfig {
    name: string;
    provider: "anthropic" | "openai" | "google" | "ollama";
    model: string;
    temperature: number;
    maxTokens: number;
    thinking?: boolean;
    onStream?: (chunk: string) => void;
}
export interface AgentMessage {
    role: "user" | "assistant";
    content: string;
}
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
export type TaskComplexity = "trivial" | "low" | "medium" | "high" | "critical";
export interface RoutingDecision {
    tier: ModelTier;
    reason: string;
    config: AgentConfig;
}
