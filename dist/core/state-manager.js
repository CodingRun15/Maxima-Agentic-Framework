import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { readJsonFile, writeJsonFile, ensureDir } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";
const DEFAULT_MODEL_CONFIG = {
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
const DEFAULT_TOKEN_BUDGET = {
    maxTokensPerTask: 4000,
    maxTokensPerPhase: 20000,
    maxTokensPerChange: 8000,
    currentUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    lifetimeUsage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
};
export class StateManager {
    projectRoot;
    aistatePath;
    constructor(projectRoot) {
        this.projectRoot = projectRoot;
        this.aistatePath = path.join(projectRoot, ".aistate");
    }
    // ─── Initialization ──────────────────────────────────────────────
    async initialize() {
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
    async getExecutionPlan() {
        return readJsonFile(this.p("execution-plan.json"));
    }
    async saveExecutionPlan(plan) {
        await writeJsonFile(this.p("execution-plan.json"), plan);
    }
    // ─── Locked Files ────────────────────────────────────────────────
    async getLockedFiles() {
        return (await readJsonFile(this.p("decisions/locked-files.json"))) ?? {};
    }
    async lockFile(filePath, task) {
        const lockedFiles = await this.getLockedFiles();
        const fileContent = await fs.readFile(path.join(this.projectRoot, filePath), "utf-8");
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
    async getContext() {
        try {
            return await fs.readFile(this.p("context.md"), "utf-8");
        }
        catch {
            return "";
        }
    }
    async writeContext(content) {
        await fs.writeFile(this.p("context.md"), content);
    }
    async addContextNote(note) {
        const current = await this.getContext();
        await this.writeContext(current + "\n" + note);
    }
    // ─── Architecture Understanding (generated once, reused) ─────
    async getArchitectureUnderstanding() {
        return (await readJsonFile(this.p("architecture-understanding.json"))) ?? {
            summary: "",
            patterns: [],
            keyFiles: [],
            generatedAt: null,
        };
    }
    async saveArchitectureUnderstanding(data) {
        await writeJsonFile(this.p("architecture-understanding.json"), {
            ...data,
            generatedAt: new Date().toISOString(),
        });
    }
    // ─── Changelog ───────────────────────────────────────────────────
    async getChangelog() {
        const data = await readJsonFile(this.p("changelog.json"));
        return data?.changes ?? [];
    }
    async writeChangelog(changes) {
        await writeJsonFile(this.p("changelog.json"), { changes });
    }
    async addChange(change) {
        const changes = await this.getChangelog();
        changes.push(change);
        await this.writeChangelog(changes);
    }
    // ─── Model Config ───────────────────────────────────────────────
    async getModelConfig() {
        return (await readJsonFile(this.p("model-config.json"))) ?? DEFAULT_MODEL_CONFIG;
    }
    async saveModelConfig(config) {
        await writeJsonFile(this.p("model-config.json"), config);
    }
    // ─── Token Budget ───────────────────────────────────────────────
    async getTokenBudget() {
        return (await readJsonFile(this.p("token-budget.json"))) ?? DEFAULT_TOKEN_BUDGET;
    }
    async saveTokenBudget(budget) {
        await writeJsonFile(this.p("token-budget.json"), budget);
    }
    // ─── Brainstorm Persistence ──────────────────────────────────────
    async getBrainstorm() {
        try {
            return await fs.readFile(this.p("brainstorm.md"), "utf-8");
        }
        catch {
            return "";
        }
    }
    async saveBrainstorm(content) {
        await fs.writeFile(this.p("brainstorm.md"), content);
    }
    async appendBrainstorm(entry) {
        const current = await this.getBrainstorm();
        const timestamp = new Date().toISOString();
        const block = `\n---\n**[${timestamp}]**\n${entry}\n`;
        await this.saveBrainstorm(current + block);
    }
    // ─── File Utilities ──────────────────────────────────────────────
    async fileExists(filePath) {
        try {
            await fs.access(path.join(this.projectRoot, filePath));
            return true;
        }
        catch {
            return false;
        }
    }
    async readFile(filePath) {
        return await fs.readFile(path.join(this.projectRoot, filePath), "utf-8");
    }
    async writeFile(filePath, content) {
        const fullPath = path.join(this.projectRoot, filePath);
        await ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content);
    }
    // ─── Cache Directory Access ──────────────────────────────────────
    getCachePath() {
        return path.join(this.aistatePath, "cache");
    }
    getAistatePath() {
        return this.aistatePath;
    }
    getProjectRoot() {
        return this.projectRoot;
    }
    // ─── Private Helpers ─────────────────────────────────────────────
    p(relativePath) {
        return path.join(this.aistatePath, relativePath);
    }
}
