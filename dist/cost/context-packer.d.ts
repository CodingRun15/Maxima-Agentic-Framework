import { Task, PackedContext } from "../core/types.js";
import { StateManager } from "../core/state-manager.js";
import { DependencyAnalyzer } from "../core/dependency-analyzer.js";
/**
 * Context Packer — builds minimal, dependency-aware context for each LLM call.
 *
 * Instead of sending the entire codebase, it:
 * 1. Includes only the task's own files
 * 2. Includes immediate imports/dependencies
 * 3. Strips comments and collapses whitespace
 * 4. Appends pre-computed architecture summary (~200 tokens)
 * 5. Never sends changelog, full plan, or unrelated files
 *
 * Typical savings: 40-60% of input token costs.
 */
export declare class ContextPacker {
    private stateManager;
    private dependencyAnalyzer;
    constructor(stateManager: StateManager, dependencyAnalyzer: DependencyAnalyzer);
    /**
     * Pack context for a specific task execution.
     */
    packForTask(task: Task, allTasks: Task[]): Promise<PackedContext>;
    /**
     * Pack context for a general chat message (minimal — architecture summary only).
     */
    packForChat(): Promise<PackedContext>;
    /**
     * Pack context for impact analysis (locked files summary + architecture).
     */
    packForImpactAnalysis(): Promise<PackedContext>;
    /**
     * Format packed context into a string for prompt injection.
     */
    formatContext(packed: PackedContext): string;
}
