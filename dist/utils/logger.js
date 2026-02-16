import chalk from "chalk";
let verboseMode = false;
export function setVerbose(verbose) {
    verboseMode = verbose;
}
export const logger = {
    debug(message, ...args) {
        if (verboseMode) {
            console.log(chalk.gray(`[DEBUG] ${message}`), ...args);
        }
    },
    info(message, ...args) {
        console.log(chalk.blue(`[INFO] ${message}`), ...args);
    },
    warn(message, ...args) {
        console.log(chalk.yellow(`[WARN] ${message}`), ...args);
    },
    error(message, ...args) {
        console.error(chalk.red(`[ERROR] ${message}`), ...args);
    },
    success(message, ...args) {
        console.log(chalk.green(`✓ ${message}`), ...args);
    },
    /** Log cost/token usage — always visible */
    cost(message, tokens) {
        if (tokens) {
            console.log(chalk.magenta(`[COST] ${message}`) +
                chalk.gray(` | in:${tokens.input} out:${tokens.output} $${tokens.cost.toFixed(4)}`));
        }
        else {
            console.log(chalk.magenta(`[COST] ${message}`));
        }
    },
    /** Display a section header */
    header(title) {
        console.log(chalk.bold.cyan(`\n═══ ${title} ═══\n`));
    },
    /** Display a task progress indicator */
    task(icon, message) {
        console.log(`  ${icon} ${message}`);
    },
};
