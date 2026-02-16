import { ExecutionPlan, LockedFile, Change, Task, ModelConfig, TokenBudget } from "./types.js";
export declare class StateManager {
    private projectRoot;
    private aistatePath;
    constructor(projectRoot: string);
    initialize(): Promise<void>;
    getExecutionPlan(): Promise<ExecutionPlan | null>;
    saveExecutionPlan(plan: ExecutionPlan): Promise<void>;
    getLockedFiles(): Promise<Record<string, LockedFile>>;
    lockFile(filePath: string, task: Task): Promise<void>;
    getContext(): Promise<string>;
    writeContext(content: string): Promise<void>;
    addContextNote(note: string): Promise<void>;
    getArchitectureUnderstanding(): Promise<{
        summary: string;
        patterns: string[];
        keyFiles: string[];
        generatedAt: string | null;
    }>;
    saveArchitectureUnderstanding(data: {
        summary: string;
        patterns: string[];
        keyFiles: string[];
    }): Promise<void>;
    getChangelog(): Promise<Change[]>;
    writeChangelog(changes: Change[]): Promise<void>;
    addChange(change: Change): Promise<void>;
    getModelConfig(): Promise<ModelConfig>;
    saveModelConfig(config: ModelConfig): Promise<void>;
    getTokenBudget(): Promise<TokenBudget>;
    saveTokenBudget(budget: TokenBudget): Promise<void>;
    getBrainstorm(): Promise<string>;
    saveBrainstorm(content: string): Promise<void>;
    appendBrainstorm(entry: string): Promise<void>;
    fileExists(filePath: string): Promise<boolean>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    getCachePath(): string;
    getAistatePath(): string;
    getProjectRoot(): string;
    private p;
}
