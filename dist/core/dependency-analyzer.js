import * as ts from "typescript";
export class DependencyAnalyzer {
    /**
     * Analyze if two tasks can run in parallel.
     */
    canRunInParallel(task1, task2) {
        // Rule 1: Both write to same file = conflict
        const fileConflict = task1.files.some((f) => task2.files.includes(f));
        if (fileConflict) {
            return { safe: false, reason: "Both write to same file" };
        }
        // Rule 2: task2 imports what task1 exports = dependency
        if (task2.imports && task1.exports) {
            const importConflict = task2.imports.some((imp) => task1.exports.includes(imp) || task1.files.includes(imp));
            if (importConflict) {
                return { safe: false, reason: "Import dependency detected" };
            }
        }
        // Rule 3: Both read same file but don't write = safe
        return { safe: true };
    }
    /**
     * Extract imports and exports from a TypeScript file.
     */
    async analyzeFile(filePath, content) {
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        const imports = [];
        const exports = [];
        const visit = (node) => {
            // Extract imports
            if (ts.isImportDeclaration(node)) {
                const moduleSpecifier = node.moduleSpecifier;
                if (ts.isStringLiteral(moduleSpecifier)) {
                    imports.push(moduleSpecifier.text);
                }
            }
            // Extract exports
            if (ts.isExportDeclaration(node) ||
                (ts.isFunctionDeclaration(node) &&
                    node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))) {
                if (ts.isFunctionDeclaration(node) && node.name) {
                    exports.push(node.name.text);
                }
            }
            // Export class declarations
            if (ts.isClassDeclaration(node) &&
                node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) &&
                node.name) {
                exports.push(node.name.text);
            }
            // Export variable declarations
            if (ts.isVariableStatement(node)) {
                const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
                if (isExported) {
                    for (const decl of node.declarationList.declarations) {
                        if (ts.isIdentifier(decl.name)) {
                            exports.push(decl.name.text);
                        }
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return { imports, exports };
    }
    /**
     * Build dependency graph from tasks.
     * Returns a map of task ID → array of task IDs it depends on.
     */
    buildDependencyGraph(tasks) {
        const graph = new Map();
        for (const task of tasks) {
            graph.set(task.id, []);
        }
        for (let i = 0; i < tasks.length; i++) {
            for (let j = 0; j < tasks.length; j++) {
                if (i !== j) {
                    const result = this.canRunInParallel(tasks[i], tasks[j]);
                    if (!result.safe) {
                        const deps = graph.get(tasks[j].id) || [];
                        deps.push(tasks[i].id);
                        graph.set(tasks[j].id, deps);
                    }
                }
            }
        }
        return graph;
    }
    /**
     * Organize tasks into phases based on dependencies.
     * Tasks within the same phase can run in parallel.
     */
    createPhases(tasks) {
        const graph = this.buildDependencyGraph(tasks);
        const phases = [];
        const processed = new Set();
        while (processed.size < tasks.length) {
            const currentPhase = [];
            for (const task of tasks) {
                if (processed.has(task.id))
                    continue;
                const deps = graph.get(task.id) || [];
                const allDepsProcessed = deps.every((dep) => processed.has(dep));
                if (allDepsProcessed) {
                    currentPhase.push(task);
                }
            }
            if (currentPhase.length === 0) {
                throw new Error("Circular dependency detected");
            }
            currentPhase.forEach((t) => processed.add(t.id));
            phases.push(currentPhase);
        }
        return phases;
    }
    /**
     * Get all direct dependency file paths for a given task.
     * Used by context-packer to determine which files to include.
     */
    getTaskDependencyFiles(task, allTasks) {
        const depFiles = new Set();
        // Include the task's own files
        for (const f of task.files) {
            depFiles.add(f);
        }
        // Include files from tasks this task depends on (via imports)
        if (task.imports) {
            for (const imp of task.imports) {
                // Find which tasks export what this task imports
                for (const otherTask of allTasks) {
                    if (otherTask.id === task.id)
                        continue;
                    if (otherTask.exports?.some((exp) => imp.includes(exp)) ||
                        otherTask.files.some((f) => imp.includes(f))) {
                        for (const f of otherTask.files) {
                            depFiles.add(f);
                        }
                    }
                }
            }
        }
        return Array.from(depFiles);
    }
}
