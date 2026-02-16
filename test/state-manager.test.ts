import { describe, it, expect, beforeEach } from "vitest";
import { StateManager } from "../src/core/state-manager.js";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

describe("StateManager", () => {
    let sm: StateManager;
    let testDir: string;

    beforeEach(async () => {
        testDir = await mkdtemp(path.join(tmpdir(), "ai-test-"));
        sm = new StateManager(testDir);
        await sm.initialize();
    });

    it("should initialize .aistate directory", async () => {
        const { readdir } = await import("fs/promises");
        const files = await readdir(path.join(testDir, ".aistate"));
        expect(files).toContain("context.md");
        expect(files).toContain("changelog.json");
        expect(files).toContain("model-config.json");
        expect(files).toContain("token-budget.json");
        expect(files).toContain("architecture-understanding.json");
        expect(files).toContain("cache");
        expect(files).toContain("decisions");
    });

    it("should read and write context", async () => {
        await sm.addContextNote("Test constraint");
        const context = await sm.getContext();
        expect(context).toContain("Test constraint");
    });

    it("should save and retrieve execution plan", async () => {
        await sm.saveExecutionPlan({
            version: "1",
            created: new Date().toISOString(),
            approved: false,
            phases: [],
        });

        const plan = await sm.getExecutionPlan();
        expect(plan).not.toBeNull();
        expect(plan!.version).toBe("1");
        expect(plan!.approved).toBe(false);
    });

    it("should return null for missing execution plan", async () => {
        // Fresh state manager without a plan
        const sm2 = new StateManager(await mkdtemp(path.join(tmpdir(), "ai-test2-")));
        const plan = await sm2.getExecutionPlan();
        expect(plan).toBeNull();
    });

    it("should add changes to changelog", async () => {
        await sm.addChange({
            id: "change-1",
            date: new Date().toISOString(),
            type: "initial_build",
            plan_id: "plan-1",
            request: "Build the thing",
            files_created: ["src/index.ts"],
            files_modified: [],
            files_deleted: [],
            approved_by: "user",
            locked: true,
        });

        const changes = await sm.getChangelog();
        expect(changes).toHaveLength(1);
        expect(changes[0].id).toBe("change-1");
    });

    it("should save and retrieve model config", async () => {
        const config = await sm.getModelConfig();
        expect(config.thinking.provider).toBe("anthropic");
        expect(config.expensive.provider).toBe("anthropic");
        expect(config.cheap.provider).toBe("google");
        expect(config.local.provider).toBe("ollama");
    });

    it("should save and retrieve token budget", async () => {
        const budget = await sm.getTokenBudget();
        expect(budget.maxTokensPerTask).toBe(4000);
        expect(budget.lifetimeUsage.estimatedCostUsd).toBe(0);
    });

    it("should save and retrieve architecture understanding", async () => {
        await sm.saveArchitectureUnderstanding({
            summary: "REST API with JWT auth",
            patterns: ["MVC", "Repository pattern"],
            keyFiles: ["src/app.ts", "src/routes.ts"],
        });

        const arch = await sm.getArchitectureUnderstanding();
        expect(arch.summary).toBe("REST API with JWT auth");
        expect(arch.patterns).toContain("MVC");
        expect(arch.generatedAt).not.toBeNull();
    });

    // ─── Brainstorm Persistence ──────────────────────────────────────

    it("should return empty string when no brainstorm exists", async () => {
        const content = await sm.getBrainstorm();
        expect(content).toBe("");
    });

    it("should save and retrieve brainstorm content", async () => {
        await sm.saveBrainstorm("# My Brainstorm\n\nIdea 1: Use microservices");
        const content = await sm.getBrainstorm();
        expect(content).toContain("My Brainstorm");
        expect(content).toContain("Idea 1");
    });

    it("should append timestamped entries to brainstorm", async () => {
        await sm.appendBrainstorm("First thought");
        await sm.appendBrainstorm("Second thought");
        const content = await sm.getBrainstorm();
        expect(content).toContain("First thought");
        expect(content).toContain("Second thought");
        // Should have timestamps
        expect(content).toMatch(/\*\*\[.+\]\*\*/);
    });
});
