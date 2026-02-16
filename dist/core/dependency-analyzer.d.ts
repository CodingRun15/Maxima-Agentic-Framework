import { Task } from "./types.js";
export declare class DependencyAnalyzer {
    /**
     * Analyze if two tasks can run in parallel.
     */
    canRunInParallel(task1: Task, task2: Task): {
        safe: boolean;
        reason?: string;
    };
    /**
     * Extract imports and exports from a TypeScript file.
     */
    analyzeFile(filePath: string, content: string): Promise<{
        imports: string[];
        exports: string[];
    }>;
    /**
     * Build dependency graph from tasks.
     * Returns a map of task ID → array of task IDs it depends on.
     */
    buildDependencyGraph(tasks: Task[]): Map<string, string[]>;
    /**
     * Organize tasks into phases based on dependencies.
     * Tasks within the same phase can run in parallel.
     */
    createPhases(tasks: Task[]): Task[][];
    /**
     * Get all direct dependency file paths for a given task.
     * Used by context-packer to determine which files to include.
     */
    getTaskDependencyFiles(task: Task, allTasks: Task[]): string[];
}
