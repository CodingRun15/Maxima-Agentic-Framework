import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
/**
 * Compute SHA-256 hash of a string.
 */
export function hashContent(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}
/**
 * Compute a combined hash from multiple strings (useful for cache keys).
 */
export function hashMultiple(...parts) {
    const combined = parts.join("|||");
    return hashContent(combined);
}
/**
 * Ensure a directory exists, creating parent directories as needed.
 */
export async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}
/**
 * Safely write a file, creating parent directories as needed.
 */
export async function safeWriteFile(filePath, content) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf-8");
}
/**
 * Check if a file or directory exists.
 */
export async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Detect if a diff is trivial (comment-only, whitespace-only changes).
 * Returns true if the change is purely cosmetic and no LLM call is needed.
 */
export function isTrivialDiff(oldContent, newContent) {
    const stripTrivial = (s) => {
        return s
            // Remove single-line comments
            .replace(/\/\/.*$/gm, "")
            // Remove multi-line comments
            .replace(/\/\*[\s\S]*?\*\//g, "")
            // Remove hash comments
            .replace(/#.*$/gm, "")
            // Collapse all whitespace
            .replace(/\s+/g, " ")
            .trim();
    };
    return stripTrivial(oldContent) === stripTrivial(newContent);
}
/**
 * Rough token estimate — ~4 chars per token for English/code.
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Strip comments and collapse whitespace to reduce tokens before sending to LLM.
 */
export function minifyForContext(content) {
    return content
        // Remove single-line comments (but keep strings)
        .replace(/(?<!["'`])\/\/.*$/gm, "")
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, "")
        // Collapse multiple blank lines into one
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
/**
 * Read a JSON file and parse it, returning null if it doesn't exist.
 */
export async function readJsonFile(filePath) {
    try {
        const content = await fs.readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Write an object as formatted JSON.
 */
export async function writeJsonFile(filePath, data) {
    await safeWriteFile(filePath, JSON.stringify(data, null, 2));
}
