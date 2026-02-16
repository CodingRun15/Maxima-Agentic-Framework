import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "cost";

let verboseMode = false;

export function setVerbose(verbose: boolean): void {
    verboseMode = verbose;
}

export const logger = {
    debug(message: string, ...args: unknown[]): void {
        if (verboseMode) {
            console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
        }
    },

    info(message: string, ...args: unknown[]): void {
        console.log(chalk.blue(`[INFO] ${message}`), ...args);
    },

    warn(message: string, ...args: unknown[]): void {
        console.log(chalk.yellow(`[WARN] ${message}`), ...args);
    },

    error(message: string, ...args: unknown[]): void {
        console.error(chalk.red(`[ERROR] ${message}`), ...args);
    },

    success(message: string, ...args: unknown[]): void {
        console.log(chalk.green(`✓ ${message}`), ...args);
    },

    /** Log cost/token usage — always visible */
    cost(message: string, tokens?: { input: number; output: number; cost: number }): void {
        if (tokens) {
            console.log(
                chalk.magenta(`[COST] ${message}`) +
                chalk.gray(` | in:${tokens.input} out:${tokens.output} $${tokens.cost.toFixed(4)}`)
            );
        } else {
            console.log(chalk.magenta(`[COST] ${message}`));
        }
    },

    /** Display a section header */
    header(title: string): void {
        console.log(chalk.bold.cyan(`\n═══ ${title} ═══\n`));
    },

    /** Display a task progress indicator */
    task(icon: string, message: string): void {
        console.log(`  ${icon} ${message}`);
    },
};
