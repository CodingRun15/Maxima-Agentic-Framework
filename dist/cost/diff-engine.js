import * as ts from "typescript";
import { logger } from "../utils/logger.js";
export class DiffEngine {
    /**
     * Extract a specific function or class from a TypeScript file.
     */
    extractFunction(fileContent, functionName) {
        const sourceFile = ts.createSourceFile("temp.ts", fileContent, ts.ScriptTarget.Latest, true);
        let result = null;
        const imports = [];
        const visit = (node) => {
            // Collect imports
            if (ts.isImportDeclaration(node)) {
                const specifier = node.moduleSpecifier;
                if (ts.isStringLiteral(specifier)) {
                    imports.push(specifier.text);
                }
            }
            // Find the target function
            if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
                const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
                result = {
                    name: functionName,
                    startLine: start.line + 1,
                    endLine: end.line + 1,
                    content: node.getFullText(sourceFile).trim(),
                    imports,
                };
            }
            // Find the target method in a class
            if (ts.isClassDeclaration(node)) {
                for (const member of node.members) {
                    if (ts.isMethodDeclaration(member) &&
                        ts.isIdentifier(member.name) &&
                        member.name.text === functionName) {
                        const start = sourceFile.getLineAndCharacterOfPosition(member.getStart());
                        const end = sourceFile.getLineAndCharacterOfPosition(member.getEnd());
                        result = {
                            name: functionName,
                            startLine: start.line + 1,
                            endLine: end.line + 1,
                            content: member.getFullText(sourceFile).trim(),
                            imports,
                        };
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return result;
    }
    /**
     * Replace a function in the source with a new version.
     */
    applyFunctionDiff(originalContent, functionName, newFunctionContent) {
        const extracted = this.extractFunction(originalContent, functionName);
        if (!extracted) {
            logger.warn(`Diff engine: function '${functionName}' not found, falling back to full rewrite`);
            return null;
        }
        const lines = originalContent.split("\n");
        const before = lines.slice(0, extracted.startLine - 1);
        const after = lines.slice(extracted.endLine);
        return [...before, newFunctionContent, ...after].join("\n");
    }
    /**
     * List all top-level functions and class methods in a file.
     * Useful for determining what can be individually modified.
     */
    listFunctions(fileContent) {
        const sourceFile = ts.createSourceFile("temp.ts", fileContent, ts.ScriptTarget.Latest, true);
        const names = [];
        const visit = (node) => {
            if (ts.isFunctionDeclaration(node) && node.name) {
                names.push(node.name.text);
            }
            if (ts.isClassDeclaration(node)) {
                for (const member of node.members) {
                    if (ts.isMethodDeclaration(member) &&
                        ts.isIdentifier(member.name)) {
                        const className = node.name?.text || "AnonymousClass";
                        names.push(`${className}.${member.name.text}`);
                    }
                }
            }
            ts.forEachChild(node, visit);
        };
        visit(sourceFile);
        return names;
    }
    /**
     * Build a minimal prompt context for modifying a single function.
     * Much smaller than sending the entire file.
     */
    buildFunctionContext(fileContent, functionName) {
        const extracted = this.extractFunction(fileContent, functionName);
        if (!extracted)
            return null;
        let context = "";
        // Include imports
        if (extracted.imports.length > 0) {
            context += `// Imports:\n`;
            for (const imp of extracted.imports) {
                context += `// import ... from "${imp}"\n`;
            }
            context += "\n";
        }
        context += `// Function to modify (lines ${extracted.startLine}-${extracted.endLine}):\n`;
        context += extracted.content;
        return context;
    }
}
