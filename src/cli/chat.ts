import readline from "readline";
import chalk from "chalk";
import { StateManager } from "../core/state-manager.js";
import { AgentClient, ChatResult } from "../agents/agent-client.js";
import { PromptBuilder } from "../agents/prompts.js";
import { DependencyAnalyzer } from "../core/dependency-analyzer.js";
import { ContextPacker } from "../cost/context-packer.js";
import { ModelRouter } from "../cost/model-router.js";
import { CacheManager } from "../cost/cache-manager.js";
import { TokenBudgetManager } from "../cost/token-budget.js";
import { ExecutionPlan, AgentMessage, Task, ModelTier } from "../core/types.js";
import { isTrivialDiff, estimateTokens } from "../utils/file-utils.js";
import { logger } from "../utils/logger.js";

/**
 * Interactive Chat Interface — the main user-facing REPL.
 *
 * Every LLM call goes through the 6-layer cost pipeline:
 * 1. Trivial diff detection → skip LLM entirely
 * 2. Cache lookup → return cached result if inputs unchanged
 * 3. Model routing → pick cheapest model for the task
 * 4. Context packing → trim to only relevant files
 * 5. Token budget gate → block if over budget
 * 6. API call → cache result
 */
export class ChatInterface {
    private rl: readline.Interface;
    private stateManager: StateManager;
    private agentClient: AgentClient;
    private promptBuilder: PromptBuilder;
    private dependencyAnalyzer: DependencyAnalyzer;
    private contextPacker: ContextPacker;
    private modelRouter: ModelRouter;
    private cacheManager: CacheManager;
    private budgetManager: TokenBudgetManager;
    private conversationHistory: AgentMessage[] = [];
    private pendingPlan: ExecutionPlan | null = null;
    private tierOverride: ModelTier | null = null;
    private brainstormMode = false;
    private brainstormTopic = "";
    private brainstormHistory: AgentMessage[] = [];

    constructor(projectRoot: string) {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: chalk.blue("> "),
        });

        this.stateManager = new StateManager(projectRoot);
        this.agentClient = new AgentClient();
        this.promptBuilder = new PromptBuilder();
        this.dependencyAnalyzer = new DependencyAnalyzer();
        this.contextPacker = new ContextPacker(
            this.stateManager,
            this.dependencyAnalyzer
        );
        this.modelRouter = new ModelRouter(this.stateManager);
        this.cacheManager = new CacheManager(this.stateManager.getCachePath());
        this.budgetManager = new TokenBudgetManager(this.stateManager);
    }

    async start(): Promise<void> {
        console.log(chalk.bold.green("\n🤖 Maxima Project Manager\n"));
        console.log("Commands:");
        console.log("  /brainstorm <topic>      — Start brainstorming session");
        console.log("  /breakdown <description> — Break down project into phases");
        console.log("  /approve-plan            — Approve the current plan");
        console.log("  /build                   — Execute approved plan");
        console.log("  /status                  — Show project status");
        console.log("  /change <description>    — Request architecture change");
        console.log("  /tier [thinking|expensive|cheap|local|auto] — Force model tier");
        console.log("  /cost                    — Show cost report");
        console.log("  /exit                    — Exit chat");
        console.log("");
        console.log("Inline flags (append to any message):");
        console.log("  --thinking   — Use deep reasoning model for this message");
        console.log("  --expensive  — Use expensive model for this message");
        console.log("  --cheap      — Use cheap model for this message\n");

        this.rl.prompt();

        this.rl.on("line", async (input) => {
            const trimmed = input.trim();
            if (trimmed) {
                await this.handleInput(trimmed);
            }
            this.rl.prompt();
        });

        this.rl.on("close", () => {
            this.shutdown();
        });

        // Graceful shutdown on Ctrl+C
        process.on("SIGINT", () => {
            this.shutdown();
        });
        process.on("SIGTERM", () => {
            this.shutdown();
        });
    }

    private shutdown(): void {
        console.log(chalk.yellow("\n\n👋 Shutting down gracefully..."));
        this.rl.close();
        process.exit(0);
    }

    private async handleInput(input: string): Promise<void> {
        try {
            // In brainstorm mode, route messages specially
            if (this.brainstormMode) {
                if (input === "/done") {
                    this.brainstormMode = false;
                    this.brainstormTopic = "";
                    this.brainstormHistory = [];
                    console.log(chalk.green("\n✓ Brainstorm session saved. Use /breakdown to incorporate insights.\n"));
                    return;
                }
                if (input.startsWith("/")) {
                    console.log(chalk.yellow("Type /done to exit brainstorm mode first.\n"));
                    return;
                }
                await this.handleBrainstormMessage(input);
                return;
            }

            if (input.startsWith("/")) {
                await this.handleCommand(input);
            } else {
                await this.handleMessage(input);
            }
        } catch (error: any) {
            console.log(chalk.red(`\n✗ Error: ${error?.message || String(error)}\n`));
            logger.debug(`Unhandled error: ${error?.stack || error}`);
        }
    }

    // ─── Slash Commands ──────────────────────────────────────────────

    private async handleCommand(input: string): Promise<void> {
        const [command, ...args] = input.split(" ");
        const argument = args.join(" ");

        switch (command) {
            case "/brainstorm":
                await this.handleBrainstorm(argument);
                break;
            case "/breakdown":
                await this.handleBreakdown(argument);
                break;
            case "/approve-plan":
                await this.handleApprovePlan();
                break;
            case "/build":
                await this.handleBuild();
                break;
            case "/status":
                await this.handleStatus();
                break;
            case "/change":
                await this.handleChange(argument);
                break;
            case "/tier":
                this.handleTierOverride(argument);
                break;
            case "/cost":
                await this.budgetManager.printCostSummary();
                break;
            case "/exit":
                this.rl.close();
                break;
            default:
                console.log(chalk.red(`Unknown command: ${command}`));
        }
    }

    // ─── /breakdown — Uses EXPENSIVE model (architecture reasoning) ──

    private async handleBreakdown(description: string): Promise<void> {
        if (!description) {
            console.log(chalk.red("Usage: /breakdown <project description>"));
            return;
        }

        console.log(chalk.gray("\nAnalyzing project requirements...\n"));

        const context = await this.stateManager.getContext();
        const brainstormHistory = await this.stateManager.getBrainstorm();
        const prompt = this.promptBuilder.buildBreakdownPrompt(description, context, brainstormHistory || undefined);

        // Use thinking or expensive model (override takes priority)
        const routing = this.tierOverride
            ? await this.modelRouter.routeForced("architect", this.tierOverride)
            : await this.modelRouter.routeExpensive("architect");

        // Check budget
        const budgetCheck = await this.budgetManager.checkBudget(
            "breakdown",
            estimateTokens(prompt)
        );
        if (!budgetCheck.allowed) {
            console.log(chalk.red(budgetCheck.reason));
            return;
        }

        // Check cache first
        const cached = await this.cacheManager.lookup("breakdown", prompt, [context]);
        let result: ChatResult;

        if (cached) {
            this.budgetManager.recordCacheHit();
            result = { content: cached.output, usage: cached.tokensUsed };
        } else {
            result = await this.agentClient.chat(routing.config, [
                { role: "user", content: prompt },
            ]);
            await this.cacheManager.store(
                "breakdown",
                prompt,
                [context],
                result.content,
                routing.config.model,
                result.usage
            );
            await this.budgetManager.recordUsage("breakdown", routing.tier, result.usage);
        }

        // Parse JSON response
        try {
            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = result.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON found in response");

            const planData = JSON.parse(jsonMatch[0]);
            const plan: ExecutionPlan = {
                version: "1",
                created: new Date().toISOString(),
                approved: false,
                phases: planData.phases,
            };

            this.pendingPlan = plan;

            // Display plan
            console.log(chalk.bold("\n📋 EXECUTION PLAN:\n"));

            for (const phase of plan.phases) {
                console.log(chalk.bold.cyan(`Phase ${phase.id}: ${phase.name}`));
                console.log(chalk.gray(`  Parallel: ${phase.parallel}`));

                for (const task of phase.tasks) {
                    console.log(`  • ${task.name}`);
                    console.log(chalk.gray(`    Files: ${task.files.join(", ")}`));
                }
                console.log("");
            }

            console.log(
                chalk.yellow("\nRun /approve-plan to lock this plan and proceed.\n")
            );
        } catch (error) {
            console.log(chalk.red("Failed to parse plan. Raw response:"));
            console.log(result.content.slice(0, 500));
        }
    }

    // ─── /approve-plan ───────────────────────────────────────────────

    private async handleApprovePlan(): Promise<void> {
        if (!this.pendingPlan) {
            console.log(
                chalk.red("No pending plan to approve. Run /breakdown first.")
            );
            return;
        }

        this.pendingPlan.approved = true;
        await this.stateManager.saveExecutionPlan(this.pendingPlan);

        console.log(chalk.green("✓ Plan approved and locked"));
        console.log(chalk.gray("Run /build to execute the plan\n"));

        this.pendingPlan = null;
    }

    // ─── /build — Uses the full cost pipeline per task ───────────────

    private async handleBuild(): Promise<void> {
        const plan = await this.stateManager.getExecutionPlan();

        if (!plan || !plan.approved) {
            console.log(
                chalk.red(
                    "No approved plan found. Run /breakdown and /approve-plan first."
                )
            );
            return;
        }

        console.log(chalk.bold.green("\n🚀 Starting build...\n"));

        for (const phase of plan.phases) {
            console.log(chalk.bold.cyan(`Phase ${phase.id}: ${phase.name}`));

            if (phase.parallel && phase.tasks.length > 1) {
                // Parallel: only cheap tasks run concurrently
                await Promise.all(
                    phase.tasks.map((task) =>
                        this.executeTask(task, plan)
                    )
                );
            } else {
                for (const task of phase.tasks) {
                    await this.executeTask(task, plan);
                }
            }

            // Ask for approval after each phase
            const approved = await this.askForApproval(
                `Approve Phase ${phase.id}?`
            );

            if (!approved) {
                console.log(chalk.yellow("Build paused."));
                await this.stateManager.saveExecutionPlan(plan);
                return;
            }

            phase.status = "locked";
        }

        await this.stateManager.saveExecutionPlan(plan);
        console.log(chalk.bold.green("\n✓ BUILD COMPLETE\n"));
    }

    /**
     * Execute a single task through the full cost pipeline.
     */
    private async executeTask(
        task: Task,
        plan: ExecutionPlan
    ): Promise<void> {
        console.log(chalk.gray(`  ⏳ ${task.name}...`));

        const allTasks = plan.phases.flatMap((p) => p.tasks);

        // 1. Pack context (dependency-aware, minimal)
        const packed = await this.contextPacker.packForTask(task, allTasks);
        const contextStr = this.contextPacker.formatContext(packed);

        // 2. Build locked decisions string
        const lockedFiles = await this.stateManager.getLockedFiles();
        const lockedDecisions = Object.values(lockedFiles)
            .map((f) => `${f.path}: created by ${f.created_by}`)
            .join("\n");

        // 3. Build prompt
        const prompt = this.promptBuilder.buildTaskPrompt(
            task,
            contextStr,
            lockedDecisions
        );

        // 4. Route to model (override takes priority over keyword routing)
        const routing = this.tierOverride
            ? await this.modelRouter.routeForced(task.agent, this.tierOverride)
            : await this.modelRouter.route(task.agent, task.name);

        // 5. Check budget
        const budgetCheck = await this.budgetManager.checkBudget(
            task.id,
            estimateTokens(prompt)
        );
        if (!budgetCheck.allowed) {
            console.log(chalk.red(`  ✗ ${task.name}: ${budgetCheck.reason}`));
            return;
        }

        // 6. Check cache
        const inputContents = await Promise.all(
            task.files
                .filter(async (f: string) => await this.stateManager.fileExists(f))
                .map((f: string) =>
                    this.stateManager.readFile(f).catch(() => "")
                )
        );

        const cached = await this.cacheManager.lookup(
            task.id,
            prompt,
            inputContents
        );

        let result: ChatResult;

        if (cached) {
            this.budgetManager.recordCacheHit();
            result = { content: cached.output, usage: cached.tokensUsed };
        } else {
            // 7. Make the API call
            result = await this.agentClient.chat(routing.config, [
                { role: "user", content: prompt },
            ]);

            // 8. Cache the result
            await this.cacheManager.store(
                task.id,
                prompt,
                inputContents,
                result.content,
                routing.config.model,
                result.usage
            );

            await this.budgetManager.recordUsage(task.id, routing.tier, result.usage);
        }

        // 9. Parse response and write files
        const fileBlocks = this.parseFileBlocks(result.content);

        if (fileBlocks.size > 0) {
            for (const [filePath, content] of fileBlocks) {
                await this.stateManager.writeFile(filePath, content);
                await this.stateManager.lockFile(filePath, task);
            }
        } else {
            // Fallback: write raw response to each task file
            for (const file of task.files) {
                await this.stateManager.writeFile(file, result.content);
                await this.stateManager.lockFile(file, task);
            }
        }

        task.status = "locked";
        console.log(
            chalk.green(`  ✓ ${task.name}`) +
            chalk.gray(` [${routing.tier}/${routing.config.model}]`)
        );
    }

    // ─── /status ─────────────────────────────────────────────────────

    private async handleStatus(): Promise<void> {
        const plan = await this.stateManager.getExecutionPlan();

        if (!plan) {
            console.log(chalk.yellow("No execution plan found."));
            return;
        }

        console.log(chalk.bold("\n📊 PROJECT STATUS:\n"));

        for (const phase of plan.phases) {
            const icon =
                phase.status === "locked"
                    ? "✓"
                    : phase.status === "in_progress"
                        ? "⏳"
                        : "○";
            console.log(chalk.bold(`${icon} Phase ${phase.id}: ${phase.name}`));

            for (const task of phase.tasks) {
                const taskIcon =
                    task.status === "locked"
                        ? "  ✓"
                        : task.status === "in_progress"
                            ? "  ⏳"
                            : "  ○";
                console.log(`${taskIcon} ${task.name}`);
            }
        }
        console.log("");
    }

    // ─── /change — Uses impact analysis with cheap model first ──────

    private async handleChange(description: string): Promise<void> {
        if (!description) {
            console.log(chalk.red("Usage: /change <change description>"));
            return;
        }

        console.log(chalk.gray("\nAnalyzing impact...\n"));

        const packed = await this.contextPacker.packForImpactAnalysis();
        const lockedFiles = await this.stateManager.getLockedFiles();
        const lockedSummary = Object.entries(lockedFiles)
            .map(
                ([fp, info]) =>
                    `${fp} (${info.lines} lines, exports: ${info.exports?.join(", ") || "none"})`
            )
            .join("\n");

        const prompt = this.promptBuilder.buildImpactAnalysisPrompt(
            description,
            lockedSummary,
            packed.architectureSummary
        );

        // Route with override support
        const routing = this.tierOverride
            ? await this.modelRouter.routeForced("review", this.tierOverride)
            : await this.modelRouter.route("review", "impact-analysis");

        const cached = await this.cacheManager.lookup(
            "impact-analysis",
            prompt,
            [lockedSummary]
        );

        let result: ChatResult;

        if (cached) {
            this.budgetManager.recordCacheHit();
            result = { content: cached.output, usage: cached.tokensUsed };
        } else {
            result = await this.agentClient.chat(routing.config, [
                { role: "user", content: prompt },
            ]);
            await this.cacheManager.store(
                "impact-analysis",
                prompt,
                [lockedSummary],
                result.content,
                routing.config.model,
                result.usage
            );
            await this.budgetManager.recordUsage(
                "impact-analysis",
                routing.tier,
                result.usage
            );
        }

        console.log(chalk.bold("\n📋 IMPACT ANALYSIS:\n"));
        console.log(result.content);
    }

    // ─── /brainstorm — Interactive brainstorming mode ─────────────────

    private async handleBrainstorm(topic: string): Promise<void> {
        if (!topic) {
            console.log(chalk.red("Usage: /brainstorm <topic>"));
            return;
        }

        this.brainstormMode = true;
        this.brainstormTopic = topic;
        this.brainstormHistory = [];

        console.log(chalk.bold.magenta(`\n💡 BRAINSTORM MODE: ${topic}\n`));
        console.log(chalk.gray("Type your thoughts and questions. The AI will help explore ideas."));
        console.log(chalk.gray("Type /done to end the session and save.\n"));

        // Persist the topic
        await this.stateManager.appendBrainstorm(`## Topic: ${topic}`);

        // Send initial brainstorming prompt
        const existingHistory = await this.stateManager.getBrainstorm();
        const prompt = this.promptBuilder.buildBrainstormPrompt(topic, existingHistory);

        const routing = this.tierOverride
            ? await this.modelRouter.routeForced("assistant", this.tierOverride)
            : await this.modelRouter.routeChat();

        this.brainstormHistory.push({ role: "user", content: prompt });

        // Stream the initial response
        process.stdout.write(chalk.magenta("\n🤖 "));
        const result = await this.agentClient.chatStream(
            routing.config,
            this.brainstormHistory,
            (chunk) => process.stdout.write(chunk)
        );
        process.stdout.write("\n\n");

        await this.budgetManager.recordUsage("brainstorm", routing.tier, result.usage);

        this.brainstormHistory.push({ role: "assistant", content: result.content });
        await this.stateManager.appendBrainstorm(`**AI:** ${result.content}`);
    }

    private async handleBrainstormMessage(message: string): Promise<void> {
        this.brainstormHistory.push({ role: "user", content: message });
        await this.stateManager.appendBrainstorm(`**User:** ${message}`);

        const routing = this.tierOverride
            ? await this.modelRouter.routeForced("assistant", this.tierOverride)
            : await this.modelRouter.routeChat();

        // Stream the brainstorm response
        process.stdout.write(chalk.magenta("\n🤖 "));
        const result = await this.agentClient.chatStream(
            routing.config,
            this.brainstormHistory,
            (chunk) => process.stdout.write(chunk)
        );
        process.stdout.write("\n\n");

        await this.budgetManager.recordUsage("brainstorm", routing.tier, result.usage);

        this.brainstormHistory.push({ role: "assistant", content: result.content });
        await this.stateManager.appendBrainstorm(`**AI:** ${result.content}`);
    }

    // ─── General chat — Uses CHEAP model with streaming ──────────────

    private async handleMessage(message: string): Promise<void> {
        // Parse inline tier flags: --thinking, --expensive, --cheap
        const inlineTier = this.parseInlineTier(message);
        const cleanMessage = message
            .replace(/\s*--(thinking|expensive|cheap|local)\s*/g, "")
            .trim();

        this.conversationHistory.push({ role: "user", content: cleanMessage });

        // Determine routing: inline flag > sticky override > default cheap
        const activeTier = inlineTier || this.tierOverride;
        const routing = activeTier
            ? await this.modelRouter.routeForced("assistant", activeTier)
            : await this.modelRouter.routeChat();

        if (activeTier) {
            console.log(chalk.gray(`  [Using ${activeTier} tier: ${routing.config.model}]`));
        }

        // Stream the response token-by-token
        process.stdout.write(chalk.cyan("\nAssistant: "));
        const result = await this.agentClient.chatStream(
            routing.config,
            this.conversationHistory,
            (chunk) => process.stdout.write(chunk)
        );
        process.stdout.write("\n\n");

        await this.budgetManager.recordUsage("chat", routing.tier, result.usage);

        this.conversationHistory.push({
            role: "assistant",
            content: result.content,
        });
    }

    // ─── /tier — Set a sticky model tier override ─────────────────────

    private handleTierOverride(argument: string): void {
        const valid: ModelTier[] = ["thinking", "expensive", "cheap", "local"];
        const tier = argument.trim().toLowerCase();

        if (!tier || tier === "auto") {
            this.tierOverride = null;
            console.log(chalk.green("✓ Tier override cleared — using automatic routing\n"));
            return;
        }

        if (!valid.includes(tier as ModelTier)) {
            console.log(chalk.red(`Invalid tier. Use: ${valid.join(", ")} or auto\n`));
            return;
        }

        this.tierOverride = tier as ModelTier;
        const tierEmoji: Record<string, string> = {
            thinking: "🧠", expensive: "🔥", cheap: "💰", local: "🏠",
        };
        console.log(
            chalk.green(`✓ All requests will now use ${tierEmoji[tier] || ""} ${tier} tier`)
        );
        console.log(chalk.gray("  Use /tier auto to return to automatic routing\n"));
    }

    /**
     * Parse inline tier flags from a message.
     * Returns the tier if found, null otherwise.
     */
    private parseInlineTier(message: string): ModelTier | null {
        if (message.includes("--thinking")) return "thinking";
        if (message.includes("--expensive")) return "expensive";
        if (message.includes("--cheap")) return "cheap";
        if (message.includes("--local")) return "local";
        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    private async askForApproval(question: string): Promise<boolean> {
        return new Promise((resolve) => {
            this.rl.question(chalk.yellow(`${question} (y/n) `), (answer) => {
                resolve(answer.toLowerCase() === "y");
            });
        });
    }

    /**
     * Parse LLM response for file blocks:
     * --- FILE: <path> ---
     * <content>
     * --- END FILE ---
     */
    private parseFileBlocks(response: string): Map<string, string> {
        const blocks = new Map<string, string>();
        const regex = /--- FILE: (.+?) ---\n([\s\S]*?)--- END FILE ---/g;
        let match;

        while ((match = regex.exec(response)) !== null) {
            blocks.set(match[1].trim(), match[2].trim());
        }

        return blocks;
    }
}
