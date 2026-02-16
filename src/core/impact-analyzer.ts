import { ImpactAnalysis, LockedFile, FileModification } from "./types.js";
import { StateManager } from "./state-manager.js";
import { logger } from "../utils/logger.js";

export class ImpactAnalyzer {
    constructor(private stateManager: StateManager) { }

    /**
     * Analyze the impact of a change request against locked files.
     * Uses cheap model by default; escalates to expensive only on breaking changes.
     */
    async analyzeChange(changeRequest: string): Promise<ImpactAnalysis> {
        const lockedFiles = await this.stateManager.getLockedFiles();
        const impact: ImpactAnalysis = {
            noChange: [],
            modify: [],
            create: [],
            delete: [],
            breakingChanges: [],
        };

        // Quick local check: which locked files are mentioned or related
        const lockedPaths = Object.keys(lockedFiles);
        const mentionedFiles = lockedPaths.filter((fp) =>
            changeRequest.toLowerCase().includes(fp.toLowerCase())
        );

        if (mentionedFiles.length > 0) {
            for (const fp of mentionedFiles) {
                impact.modify.push({
                    file: fp,
                    reason: "Mentioned in change request",
                    estimate: "unknown",
                    changes: [],
                });
            }
        }

        // Files not mentioned are assumed unchanged
        for (const fp of lockedPaths) {
            if (!mentionedFiles.includes(fp)) {
                impact.noChange.push(fp);
            }
        }

        // In production, this would call the model-router with a cheap model
        // to get a full semantic analysis. The LLM call is deferred to the
        // chat.ts handler which uses the cost pipeline.

        logger.debug(`Impact analysis: ${impact.modify.length} files may change`);

        return impact;
    }

    /**
     * Detect if a change contradicts any locked decisions.
     * Only called when the local heuristic flags potential conflicts.
     */
    async detectBreakingChanges(
        changeRequest: string,
        lockedFiles: Record<string, LockedFile>
    ): Promise<boolean> {
        // Local heuristic: if the change mentions "remove", "delete", "replace"
        // and references a locked file, flag as potential breaking change.
        const dangerWords = ["remove", "delete", "replace", "rewrite", "drop"];
        const hasDangerWord = dangerWords.some((w) =>
            changeRequest.toLowerCase().includes(w)
        );
        const mentionsLockedFile = Object.keys(lockedFiles).some((fp) =>
            changeRequest.toLowerCase().includes(fp.toLowerCase())
        );

        return hasDangerWord && mentionsLockedFile;
    }

    /**
     * Estimate what changes are needed for a specific file.
     * This is a stub that returns a placeholder; the real estimation
     * happens via the LLM through the cost pipeline.
     */
    async estimateFileChanges(
        filePath: string,
        changeDescription: string
    ): Promise<FileModification> {
        return {
            file: filePath,
            reason: changeDescription,
            estimate: "+20 lines",
            changes: [],
        };
    }
}
