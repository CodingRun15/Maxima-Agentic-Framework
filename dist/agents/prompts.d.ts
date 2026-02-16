import { Task } from "../core/types.js";
/**
 * Prompt Builder — token-optimized prompt templates.
 *
 * All prompts accept pre-packed context from the ContextPacker
 * instead of raw file contents, ensuring minimal token usage.
 */
export declare class PromptBuilder {
    /**
     * Build prompt for brainstorming mode.
     * Encourages collaborative exploration and idea generation.
     */
    buildBrainstormPrompt(topic: string, history: string): string;
    /**
     * Build prompt for project breakdown.
     * Uses expensive model — this is the one place where full context is justified.
     */
    buildBreakdownPrompt(description: string, context: string, brainstormHistory?: string): string;
    /**
     * Build prompt for task execution.
     * Context is pre-packed by ContextPacker (minimal, dependency-aware).
     */
    buildTaskPrompt(task: Task, packedContext: string, lockedDecisions: string): string;
    /**
     * Build prompt for impact analysis.
     * Uses minimal context (locked file metadata, not full content).
     */
    buildImpactAnalysisPrompt(changeRequest: string, lockedFilesSummary: string, architectureSummary: string): string;
    /**
     * Build prompt for modifying a single function (diff-based).
     * Much cheaper than sending the entire file.
     */
    buildFunctionModifyPrompt(functionContext: string, modificationRequest: string): string;
}
