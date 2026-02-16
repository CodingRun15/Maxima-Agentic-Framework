export type LogLevel = "debug" | "info" | "warn" | "error" | "success" | "cost";
export declare function setVerbose(verbose: boolean): void;
export declare const logger: {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    success(message: string, ...args: unknown[]): void;
    /** Log cost/token usage — always visible */
    cost(message: string, tokens?: {
        input: number;
        output: number;
        cost: number;
    }): void;
    /** Display a section header */
    header(title: string): void;
    /** Display a task progress indicator */
    task(icon: string, message: string): void;
};
