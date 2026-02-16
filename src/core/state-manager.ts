import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
    ExecutionPlan, LockedFile, Change, Task, ModelConfig, TokenBudget,
} from "./types.js";
import { readJsonFile, writeJsonFile, ensureDir } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";

const DEFAULT_MODEL_CONFIG: ModelConfig = {
    thinking: {
        provider: "anthropic",
        model: "claude-4.5-opus",
        maxTokens: 16000,
        temperature: 1, // Thinking models require temperature 1
        costPer1kInput: 0.015,
        costPer1kOutput: 0.075,
    },
    expensive: {
        provider: "anthropic",
        model: "claude-4-sonnet",
        maxTokens: 8000,
        temperature: 0.7,
        costPer1kInput: 0.003,
        costPer1kOutput: 0.015,
    },
    cheap: {
        provider: "google",
        model: "gemini-3-flash-preview",
        maxTokens: 4000,
        temperature: 0.5,
        costPer1kInput: 0.0001,
        costPer1kOutput: 0.0004,
    },
    local: {
        provider: "ollama",
        model: "llama4",
        maxTokens: 4000,
        temperature: 0.3,
    },
};

const DEFAULT_TOKEN_BUDGET: TokenBudget = {
    maxTokensPerTask: 4000,
    maxTokensPerPhase: 20000,
    maxTokensPerChange: 8000,
    currentUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    lifetimeUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
};

export class StateManager {
    private projectRoot: string;
    private aistatePath: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        this.aistatePath = path.join(projectRoot, ".aistate");
    }

    // ─── Initialization ──────────────────────────────────────────────

    async initialize(): Promise<void> {
        const dirs = [
            this.aistatePath,
            path.join(this.aistatePath, "decisions"),
            path.join(this.aistatePath, "problems"),
            path.join(this.aistatePath, "cache"),
            path.join(this.aistatePath, "tmp"),
        ];

        for (const dir of dirs) {
            await ensureDir(dir);
        }

        // Create initial files
        await this.writeContext("# Project Context\n\n## Constraints\n\n## Notes\n");
        await this.writeChangelog([]);
        await this.saveModelConfig(DEFAULT_MODEL_CONFIG);
        await this.saveTokenBudget(DEFAULT_TOKEN_BUDGET);

        // Create empty architecture understanding
        await writeJsonFile(this.p("architecture-understanding.json"), {
            generatedAt: null,
            summary: "",
            patterns: [],
            keyFiles: [],
        });

        logger.success("Initialized .aistate directory");
    }

    // ─── Execution Plan ──────────────────────────────────────────────

    async getExecutionPlan(): Promise<ExecutionPlan | null> {
        return readJsonFile<ExecutionPlan>(this.p("execution-plan.json"));
    }

    async saveExecutionPlan(plan: ExecutionPlan): Promise<void> {
        await writeJsonFile(this.p("execution-plan.json"), plan);
    }

    // ─── Locked Files ────────────────────────────────────────────────

    async getLockedFiles(): Promise<Record<string, LockedFile>> {
        return (await readJsonFile<Record<string, LockedFile>>(
            this.p("decisions/locked-files.json")
        )) ?? {};
    }

    async lockFile(filePath: string, task: Task): Promise<void> {
        const lockedFiles = await this.getLockedFiles();

        const fileContent = await fs.readFile(
            path.join(this.projectRoot, filePath),
            "utf-8"
        );
        const hash = crypto.createHash("sha256").update(fileContent).digest("hex");
        const lines = fileContent.split("\n").length;

        lockedFiles[filePath] = {
            path: filePath,
            status: "locked",
            created_by: task.id,
            locked_at: new Date().toISOString(),
            exports: task.exports,
            imported_by: [],
            lines,
            hash,
        };

        await writeJsonFile(this.p("decisions/locked-files.json"), lockedFiles);
    }

    // ─── Context ─────────────────────────────────────────────────────

    async getContext(): Promise<string> {
        try {
            return await fs.readFile(this.p("context.md"), "utf-8");
        } catch {
            return "";
        }
    }

    async writeContext(content: string): Promise<void> {
        await fs.writeFile(this.p("context.md"), content);
    }

    async addContextNote(note: string): Promise<void> {
        const current = await this.getContext();
        await this.writeContext(current + "\n" + note);
    }

    // ─── Architecture Understanding (generated once, reused) ─────

    async getArchitectureUnderstanding(): Promise<{
        summary: string;
        patterns: string[];
        keyFiles: string[];
        generatedAt: string | null;
    }> {
        return (await readJsonFile(this.p("architecture-understanding.json"))) ?? {
            summary: "",
            patterns: [],
            keyFiles: [],
            generatedAt: null,
        };
    }

    async saveArchitectureUnderstanding(data: {
        summary: string;
        patterns: string[];
        keyFiles: string[];
    }): Promise<void> {
        await writeJsonFile(this.p("architecture-understanding.json"), {
            ...data,
            generatedAt: new Date().toISOString(),
        });
    }

    // ─── Changelog ───────────────────────────────────────────────────

    async getChangelog(): Promise<Change[]> {
        const data = await readJsonFile<{ changes: Change[] }>(this.p("changelog.json"));
        return data?.changes ?? [];
    }

    async writeChangelog(changes: Change[]): Promise<void> {
        await writeJsonFile(this.p("changelog.json"), { changes });
    }

    async addChange(change: Change): Promise<void> {
        const changes = await this.getChangelog();
        changes.push(change);
        await this.writeChangelog(changes);
    }

    // ─── Model Config ───────────────────────────────────────────────

    async getModelConfig(): Promise<ModelConfig> {
        return (await readJsonFile<ModelConfig>(this.p("model-config.json"))) ?? DEFAULT_MODEL_CONFIG;
    }

    async saveModelConfig(config: ModelConfig): Promise<void> {
        await writeJsonFile(this.p("model-config.json"), config);
    }

    // ─── Token Budget ───────────────────────────────────────────────

    async getTokenBudget(): Promise<TokenBudget> {
        return (await readJsonFile<TokenBudget>(this.p("token-budget.json"))) ?? DEFAULT_TOKEN_BUDGET;
    }

    async saveTokenBudget(budget: TokenBudget): Promise<void> {
        await writeJsonFile(this.p("token-budget.json"), budget);
    }

    // ─── Brainstorm Persistence ──────────────────────────────────────

    async getBrainstorm(): Promise<string> {
        try {
            return await fs.readFile(this.p("brainstorm.md"), "utf-8");
        } catch {
            return "";
        }
    }

    async saveBrainstorm(content: string): Promise<void> {
        await fs.writeFile(this.p("brainstorm.md"), content);
    }

    async appendBrainstorm(entry: string): Promise<void> {
        const current = await this.getBrainstorm();
        const timestamp = new Date().toISOString();
        const block = `\n---\n**[${timestamp}]**\n${entry}\n`;
        await this.saveBrainstorm(current + block);
    }

    // ─── File Utilities ──────────────────────────────────────────────

    async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(path.join(this.projectRoot, filePath));
            return true;
        } catch {
            return false;
        }
    }

    async readFile(filePath: string): Promise<string> {
        return await fs.readFile(path.join(this.projectRoot, filePath), "utf-8");
    }

    async writeFile(filePath: string, content: string): Promise<void> {
        const fullPath = path.join(this.projectRoot, filePath);
        await ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
    }

    // ─── Cache Directory Access ──────────────────────────────────────

    getCachePath(): string {
        return path.join(this.aistatePath, "cache");
    }

    getAistatePath(): string {
        return this.aistatePath;
    }

    getProjectRoot(): string {
        return this.projectRoot;
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    private p(relativePath: string): string {
        return path.join(this.aistatePath, relativePath);
    }
}
