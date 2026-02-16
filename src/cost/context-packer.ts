import { Task, PackedContext, ContextFile } from "../core/types.js";
import { StateManager } from "../core/state-manager.js";
import { DependencyAnalyzer } from "../core/dependency-analyzer.js";
import { estimateTokens, minifyForContext } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";

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
export class ContextPacker {
    constructor(
        private stateManager: StateManager,
        private dependencyAnalyzer: DependencyAnalyzer
    ) { }

    /**
     * Pack context for a specific task execution.
     */
    async packForTask(task: Task, allTasks: Task[]): Promise<PackedContext> {
        const files: ContextFile[] = [];

        // 1. Get dependency-aware file list (only task files + immediate imports)
        const relevantPaths = this.dependencyAnalyzer.getTaskDependencyFiles(
            task,
            allTasks
        );

        // 2. Load and minify each file
        for (const filePath of relevantPaths) {
            try {
                const exists = await this.stateManager.fileExists(filePath);
                if (!exists) continue;

                const rawContent = await this.stateManager.readFile(filePath);
                const minified = minifyForContext(rawContent);
                const relevance = task.files.includes(filePath) ? "direct" : "import";

                files.push({
                    path: filePath,
                    content: minified,
                    relevance: relevance as "direct" | "import",
                    tokenEstimate: estimateTokens(minified),
                });
            } catch {
                logger.debug(`Context packer: skipping ${filePath} (not readable)`);
            }
        }

        // 3. Get pre-computed architecture summary (tiny, ~200 tokens)
        const arch = await this.stateManager.getArchitectureUnderstanding();
        const architectureSummary = arch.summary || "No architecture understanding generated yet.";

        const totalTokenEstimate =
            files.reduce((sum, f) => sum + f.tokenEstimate, 0) +
            estimateTokens(architectureSummary);

        logger.debug(
            `Context packed: ${files.length} files, ~${totalTokenEstimate} tokens ` +
            `(${files.filter((f) => f.relevance === "direct").length} direct, ` +
            `${files.filter((f) => f.relevance === "import").length} imports)`
        );

        return { files, architectureSummary, totalTokenEstimate };
    }

    /**
     * Pack context for a general chat message (minimal — architecture summary only).
     */
    async packForChat(): Promise<PackedContext> {
        const arch = await this.stateManager.getArchitectureUnderstanding();
        const architectureSummary = arch.summary || "";

        return {
            files: [],
            architectureSummary,
            totalTokenEstimate: estimateTokens(architectureSummary),
        };
    }

    /**
     * Pack context for impact analysis (locked files summary + architecture).
     */
    async packForImpactAnalysis(): Promise<PackedContext> {
        const lockedFiles = await this.stateManager.getLockedFiles();
        const arch = await this.stateManager.getArchitectureUnderstanding();

        const files: ContextFile[] = [];

        // Include only locked file metadata, not full content
        for (const [filePath, lockInfo] of Object.entries(lockedFiles)) {
            const summary = `// ${filePath} — ${lockInfo.lines} lines, exports: ${lockInfo.exports?.join(", ") || "none"}`;
            files.push({
                path: filePath,
                content: summary,
                relevance: "pattern",
                tokenEstimate: estimateTokens(summary),
            });
        }

        const architectureSummary = arch.summary || "";
        const totalTokenEstimate =
            files.reduce((sum, f) => sum + f.tokenEstimate, 0) +
            estimateTokens(architectureSummary);

        return { files, architectureSummary, totalTokenEstimate };
    }

    /**
     * Format packed context into a string for prompt injection.
     */
    formatContext(packed: PackedContext): string {
        let output = "";

        if (packed.architectureSummary) {
            output += `ARCHITECTURE:\n${packed.architectureSummary}\n\n`;
        }

        if (packed.files.length > 0) {
            output += "RELEVANT FILES:\n";
            for (const file of packed.files) {
                output += `\n--- ${file.path} [${file.relevance}] ---\n`;
                output += file.content + "\n";
            }
        }

        return output;
    }
}
