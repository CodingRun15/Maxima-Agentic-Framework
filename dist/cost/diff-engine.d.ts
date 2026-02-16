/**
 * Diff Engine — function-level diff extraction and application.
 *
 * Instead of sending entire files for regeneration, it:
 * 1. Parses the file AST to find the specific function/class
 * 2. Extracts just that node + its imports
 * 3. After LLM returns the modified function, splices it back in
 *
 * Savings: ~10% by avoiding full-file rewrites on modifications.
 */
export interface ExtractedFunction {
    name: string;
    startLine: number;
    endLine: number;
    content: string;
    imports: string[];
}
export declare class DiffEngine {
    /**
     * Extract a specific function or class from a TypeScript file.
     */
    extractFunction(fileContent: string, functionName: string): ExtractedFunction | null;
    /**
     * Replace a function in the source with a new version.
     */
    applyFunctionDiff(originalContent: string, functionName: string, newFunctionContent: string): string | null;
    /**
     * List all top-level functions and class methods in a file.
     * Useful for determining what can be individually modified.
     */
    listFunctions(fileContent: string): string[];
    /**
     * Build a minimal prompt context for modifying a single function.
     * Much smaller than sending the entire file.
     */
    buildFunctionContext(fileContent: string, functionName: string): string | null;
}
