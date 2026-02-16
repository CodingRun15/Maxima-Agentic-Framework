#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { StateManager } from "../core/state-manager.js";
import { ChatInterface } from "./chat.js";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
const program = new Command();
program
    .name("maxima")
    .description("Maxima — Cost-optimized AI Project Manager")
    .version("1.0.0");
program
    .command("init")
    .description("Initialize AI project manager in current directory")
    .action(async () => {
    const stateManager = new StateManager(process.cwd());
    await stateManager.initialize();
    console.log(chalk.green("✓ Initialized .aistate directory"));
    console.log(chalk.gray("  Created: context.md, model-config.json, token-budget.json"));
    console.log(chalk.gray("  Run `maxima setup` to configure your API key"));
});
program
    .command("setup")
    .description("Interactive setup — choose provider, enter API key")
    .action(async () => {
    console.log(chalk.bold.green("\n🔧 Maxima Setup\n"));
    const PROVIDERS = [
        {
            name: "Anthropic (Claude 4.5 Opus, Claude 4 Sonnet, Claude 4 Haiku)",
            value: "anthropic",
            envKey: "ANTHROPIC_API_KEY",
            models: {
                thinking: { provider: "anthropic", model: "claude-4.5-opus", maxTokens: 16000, temperature: 1, costPer1kInput: 0.015, costPer1kOutput: 0.075 },
                expensive: { provider: "anthropic", model: "claude-4-sonnet", maxTokens: 8000, temperature: 0.7, costPer1kInput: 0.003, costPer1kOutput: 0.015 },
                cheap: { provider: "anthropic", model: "claude-4-haiku", maxTokens: 4000, temperature: 0.5, costPer1kInput: 0.0008, costPer1kOutput: 0.004 },
            },
        },
        {
            name: "OpenAI (ChatGPT 5.2, GPT-5.2-mini, o4-mini)",
            value: "openai",
            envKey: "OPENAI_API_KEY",
            models: {
                thinking: { provider: "openai", model: "chatgpt-5.2", maxTokens: 16000, temperature: 1, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
                expensive: { provider: "openai", model: "chatgpt-5.2", maxTokens: 8000, temperature: 0.7, costPer1kInput: 0.005, costPer1kOutput: 0.015 },
                cheap: { provider: "openai", model: "gpt-5.2-mini", maxTokens: 4000, temperature: 0.5, costPer1kInput: 0.0003, costPer1kOutput: 0.0012 },
            },
        },
        {
            name: "Google (Gemini 3 Flash)",
            value: "google",
            envKey: "GEMINI_API_KEY",
            models: {
                thinking: { provider: "google", model: "gemini-3-flash-preview", maxTokens: 16000, temperature: 1, costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
                expensive: { provider: "google", model: "gemini-3-flash-preview", maxTokens: 8000, temperature: 0.7, costPer1kInput: 0.00125, costPer1kOutput: 0.005 },
                cheap: { provider: "google", model: "gemini-3-flash-preview", maxTokens: 4000, temperature: 0.5, costPer1kInput: 0.0001, costPer1kOutput: 0.0004 },
            },
        },
        {
            name: "Ollama (Local — free, requires Ollama running)",
            value: "ollama",
            envKey: "OLLAMA_HOST",
            models: {
                thinking: { provider: "ollama", model: "llama4", maxTokens: 16000, temperature: 0.7 },
                expensive: { provider: "ollama", model: "llama4", maxTokens: 8000, temperature: 0.7 },
                cheap: { provider: "ollama", model: "llama4", maxTokens: 4000, temperature: 0.3 },
            },
        },
    ];
    const { provider } = await inquirer.prompt([
        {
            type: "select",
            name: "provider",
            message: "Select your LLM provider:",
            choices: PROVIDERS.map((p) => ({ name: p.name, value: p.value })),
        },
    ]);
    const selected = PROVIDERS.find((p) => p.value === provider);
    let keyValue;
    if (provider === "ollama") {
        const { host } = await inquirer.prompt([
            {
                type: "input",
                name: "host",
                message: "Ollama host URL:",
                default: "http://127.0.0.1:11434",
            },
        ]);
        keyValue = host;
    }
    console.log(selected.envKey);
    if (!process.env[selected.envKey]) {
        const { apiKey } = await inquirer.prompt([
            {
                type: "password",
                name: "apiKey",
                message: `Enter your ${selected.envKey}:`,
                mask: "*",
            },
        ]);
        if (!apiKey) {
            await inquirer.prompt([
                {
                    type: "password",
                    name: "apiKey",
                    message: `Api key is required. Enter your ${selected.envKey}:`,
                    mask: "*",
                },
            ]);
        }
        keyValue = apiKey;
        // Save to .env
        const envPath = path.join(process.cwd(), ".env");
        let envContent = "";
        try {
            envContent = await fs.readFile(envPath, "utf-8");
        }
        catch { /* file doesn't exist yet */ }
        // Update or append the key
        const keyLine = `${selected.envKey}=${keyValue}`;
        if (envContent.includes(`${selected.envKey}=`)) {
            envContent = envContent.replace(new RegExp(`^${selected.envKey}=.*$`, "m"), keyLine);
        }
        else {
            envContent = envContent.trim() + (envContent ? "\n" : "") + keyLine + "\n";
        }
        await fs.writeFile(envPath, envContent);
        console.log(chalk.green(`\n✓ Saved ${selected.envKey} to .env`));
    }
    const stateManager = new StateManager(process.cwd());
    const modelConfig = {
        thinking: selected.models.thinking,
        expensive: selected.models.expensive,
        cheap: selected.models.cheap,
        local: { provider: "ollama", model: "llama4", maxTokens: 4000, temperature: 0.3 },
    };
    await stateManager.saveModelConfig(modelConfig);
    console.log(chalk.green(`✓ Configured model tiers for ${provider}`));
    console.log(chalk.bold("\nModel configuration:"));
    console.log(chalk.gray(`  🧠 Thinking:   ${selected.models.thinking.model}`));
    console.log(chalk.gray(`  🔥 Expensive:  ${selected.models.expensive.model}`));
    console.log(chalk.gray(`  💰 Cheap:      ${selected.models.cheap.model}`));
    console.log(chalk.gray(`  🏠 Local:      llama4 (Ollama)`));
    console.log(chalk.bold.green("\n✓ Setup complete! Run `maxima chat` to start.\n"));
});
program
    .command("status")
    .description("Show project status")
    .action(async () => {
    const stateManager = new StateManager(process.cwd());
    const plan = await stateManager.getExecutionPlan();
    if (!plan) {
        console.log(chalk.yellow("No execution plan found. Run /breakdown in chat first."));
        return;
    }
    console.log(chalk.bold("\nProject Status:\n"));
    for (const phase of plan.phases) {
        const icon = phase.status === "locked"
            ? "✓"
            : phase.status === "in_progress"
                ? "⏳"
                : "○";
        console.log(chalk.bold(`${icon} Phase ${phase.id}: ${phase.name}`));
        for (const task of phase.tasks) {
            const taskIcon = task.status === "locked"
                ? "  ✓"
                : task.status === "in_progress"
                    ? "  ⏳"
                    : "  ○";
            console.log(`${taskIcon} ${task.name}`);
        }
    }
});
program
    .command("changelog")
    .description("Show change history")
    .action(async () => {
    const stateManager = new StateManager(process.cwd());
    const changes = await stateManager.getChangelog();
    if (changes.length === 0) {
        console.log(chalk.yellow("No changes recorded yet."));
        return;
    }
    console.log(chalk.bold("\nChange History:\n"));
    for (const change of changes) {
        console.log(chalk.gray(change.date));
        console.log(chalk.bold(`  ${change.type}`));
        if (change.request) {
            console.log(`  ${change.request}`);
        }
        console.log(chalk.green(`  +${change.files_created.length} created`));
        console.log(chalk.yellow(`  ~${change.files_modified.length} modified`));
        console.log(chalk.red(`  -${change.files_deleted.length} deleted`));
        console.log("");
    }
});
program
    .command("chat")
    .description("Start interactive chat session")
    .action(async () => {
    const chat = new ChatInterface(process.cwd());
    await chat.start();
});
program
    .command("cost-report")
    .description("Show cost and token usage report")
    .action(async () => {
    const stateManager = new StateManager(process.cwd());
    const budget = await stateManager.getTokenBudget();
    console.log(chalk.bold.magenta("\n═══ COST REPORT ═══\n"));
    console.log(`  Lifetime tokens:  ${budget.lifetimeUsage.inputTokens + budget.lifetimeUsage.outputTokens}`);
    console.log(`  Lifetime cost:    $${budget.lifetimeUsage.estimatedCostUsd.toFixed(4)}`);
    console.log(`  Budget per task:  ${budget.maxTokensPerTask} tokens`);
    console.log(`  Budget per phase: ${budget.maxTokensPerPhase} tokens`);
});
process.on("uncaughtException", (error) => {
    console.error(chalk.red(`\n✗ Unexpected error: ${error.message}\n`));
    process.exit(1);
});
process.on("unhandledRejection", (reason) => {
    console.log(chalk.red(`\n✗ Unhandled error: ${reason?.message || reason}\n`));
    console.log(chalk.yellow("\n\n👋 Goodbye!"));
    // Don't exit — let the REPL continue
    process.exit(0);
});
process.on("SIGINT", () => {
    console.log(chalk.yellow("\n\n👋 Goodbye!"));
    process.exit(0);
});
process.on("SIGTERM", () => {
    console.log(chalk.yellow("\n\n👋 Goodbye!"));
    process.exit(0);
});
program.parse();
