import { describe, it, expect } from "vitest";
import { DependencyAnalyzer } from "../src/core/dependency-analyzer.js";
import { Task } from "../src/core/types.js";
import { isTrivialDiff, estimateTokens, minifyForContext } from "../src/utils/file-utils.js";
import { DiffEngine } from "../src/cost/diff-engine.js";

describe("DependencyAnalyzer", () => {
    const analyzer = new DependencyAnalyzer();

    it("should detect file conflicts", () => {
        const task1: Task = {
            id: "t1", name: "Task 1", agent: "codegen",
            files: ["src/app.ts"], parallel_safe: false,
            conflicts_with: [], status: "pending",
        };
        const task2: Task = {
            id: "t2", name: "Task 2", agent: "codegen",
            files: ["src/app.ts"], parallel_safe: false,
            conflicts_with: [], status: "pending",
        };

        const result = analyzer.canRunInParallel(task1, task2);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain("same file");
    });

    it("should allow parallel for independent tasks", () => {
        const task1: Task = {
            id: "t1", name: "Task 1", agent: "codegen",
            files: ["src/a.ts"], parallel_safe: true,
            conflicts_with: [], status: "pending",
        };
        const task2: Task = {
            id: "t2", name: "Task 2", agent: "codegen",
            files: ["src/b.ts"], parallel_safe: true,
            conflicts_with: [], status: "pending",
        };

        const result = analyzer.canRunInParallel(task1, task2);
        expect(result.safe).toBe(true);
    });

    it("should detect import dependencies", () => {
        const task1: Task = {
            id: "t1", name: "Task 1", agent: "codegen",
            files: ["src/types.ts"], exports: ["UserType"],
            parallel_safe: false, conflicts_with: [], status: "pending",
        };
        const task2: Task = {
            id: "t2", name: "Task 2", agent: "codegen",
            files: ["src/app.ts"], imports: ["UserType"],
            parallel_safe: false, conflicts_with: [], status: "pending",
        };

        const result = analyzer.canRunInParallel(task1, task2);
        expect(result.safe).toBe(false);
    });

    it("should create phases from dependencies", () => {
        const tasks: Task[] = [
            {
                id: "t1", name: "Schema", agent: "schema",
                files: ["src/schema.ts"], exports: ["Schema"],
                parallel_safe: false, conflicts_with: [], status: "pending",
            },
            {
                id: "t2", name: "Models", agent: "codegen",
                files: ["src/models.ts"], imports: ["Schema"],
                parallel_safe: false, conflicts_with: [], status: "pending",
            },
            {
                id: "t3", name: "Utils", agent: "codegen",
                files: ["src/utils.ts"],
                parallel_safe: true, conflicts_with: [], status: "pending",
            },
        ];

        const phases = analyzer.createPhases(tasks);
        // t1 and t3 can run in phase 1, t2 depends on t1 so goes to phase 2
        expect(phases.length).toBeGreaterThanOrEqual(2);
    });
});

describe("Trivial Diff Detection", () => {
    it("should detect comment-only changes", () => {
        const old = `function foo() {\n  return 1;\n}`;
        const new_ = `function foo() {\n  // added a comment\n  return 1;\n}`;
        expect(isTrivialDiff(old, new_)).toBe(true);
    });

    it("should detect whitespace-only changes", () => {
        const old = `function foo() {\n  return 1;\n}`;
        const new_ = `function foo()  {\n    return 1;\n  }`;
        expect(isTrivialDiff(old, new_)).toBe(true);
    });

    it("should detect real changes", () => {
        const old = `function foo() {\n  return 1;\n}`;
        const new_ = `function foo() {\n  return 2;\n}`;
        expect(isTrivialDiff(old, new_)).toBe(false);
    });
});

describe("Token Estimation", () => {
    it("should estimate ~4 chars per token", () => {
        expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4
    });

    it("should handle empty strings", () => {
        expect(estimateTokens("")).toBe(0);
    });
});

describe("Context Minification", () => {
    it("should strip comments and collapse whitespace", () => {
        const input = `// This is a comment\nfunction foo() {\n  // another comment\n  return 1;\n}\n\n\n\nconst x = 2;`;
        const result = minifyForContext(input);
        expect(result).not.toContain("This is a comment");
        expect(result).not.toContain("another comment");
        expect(result).toContain("function foo()");
        expect(result).toContain("const x = 2");
    });
});

describe("DiffEngine", () => {
    const engine = new DiffEngine();

    const sampleFile = `
import { foo } from "./utils";

export function greet(name: string): string {
  return "Hello, " + name;
}

export function farewell(name: string): string {
  return "Goodbye, " + name;
}
  `.trim();

    it("should extract a function from source", () => {
        const result = engine.extractFunction(sampleFile, "greet");
        expect(result).not.toBeNull();
        expect(result!.name).toBe("greet");
        expect(result!.content).toContain("Hello");
    });

    it("should list all functions", () => {
        const names = engine.listFunctions(sampleFile);
        expect(names).toContain("greet");
        expect(names).toContain("farewell");
    });

    it("should build function context", () => {
        const ctx = engine.buildFunctionContext(sampleFile, "greet");
        expect(ctx).not.toBeNull();
        expect(ctx).toContain("greet");
        expect(ctx).toContain("./utils");
    });

    it("should return null for non-existent function", () => {
        const result = engine.extractFunction(sampleFile, "nonExistent");
        expect(result).toBeNull();
    });
});
