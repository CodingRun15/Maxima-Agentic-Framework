import { ImpactAnalysis, LockedFile, FileModification } from "./types.js";
import { StateManager } from "./state-manager.js";
export declare class ImpactAnalyzer {
    private stateManager;
    constructor(stateManager: StateManager);
    /**
     * Analyze the impact of a change request against locked files.
     * Uses cheap model by default; escalates to expensive only on breaking changes.
     */
    analyzeChange(changeRequest: string): Promise<ImpactAnalysis>;
    /**
     * Detect if a change contradicts any locked decisions.
     * Only called when the local heuristic flags potential conflicts.
     */
    detectBreakingChanges(changeRequest: string, lockedFiles: Record<string, LockedFile>): Promise<boolean>;
    /**
     * Estimate what changes are needed for a specific file.
     * This is a stub that returns a placeholder; the real estimation
     * happens via the LLM through the cost pipeline.
     */
    estimateFileChanges(filePath: string, changeDescription: string): Promise<FileModification>;
}
