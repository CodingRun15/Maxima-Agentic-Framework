import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StateManager } from "../core/state-manager.js";

const server = new Server(
    {
        name: "ai-project-manager",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const stateManager = new StateManager(process.cwd());

// ─── List Tools ────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_status",
                description: "Get current project execution status",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
            {
                name: "get_plan",
                description: "Get current execution plan",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
            {
                name: "approve_plan",
                description: "Approve the current execution plan",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
            {
                name: "get_cost_report",
                description: "Get token usage and cost report",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
            {
                name: "get_locked_files",
                description: "Get all locked files and their status",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
            {
                name: "get_context",
                description: "Get the project context document",
                inputSchema: {
                    type: "object" as const,
                    properties: {},
                },
            },
        ],
    };
});

// ─── Handle Tool Calls ─────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
        case "get_status":
        case "get_plan": {
            const plan = await stateManager.getExecutionPlan();
            return {
                content: [
                    {
                        type: "text" as const,
                        text: plan ? JSON.stringify(plan, null, 2) : "No execution plan found.",
                    },
                ],
            };
        }

        case "approve_plan": {
            const plan = await stateManager.getExecutionPlan();
            if (plan) {
                plan.approved = true;
                await stateManager.saveExecutionPlan(plan);
                return {
                    content: [{ type: "text" as const, text: "Plan approved and locked." }],
                };
            }
            return {
                content: [{ type: "text" as const, text: "No plan found to approve." }],
            };
        }

        case "get_cost_report": {
            const budget = await stateManager.getTokenBudget();
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(
                            {
                                lifetimeTokens:
                                    budget.lifetimeUsage.inputTokens +
                                    budget.lifetimeUsage.outputTokens,
                                lifetimeCostUsd: budget.lifetimeUsage.estimatedCostUsd,
                                budgetPerTask: budget.maxTokensPerTask,
                                budgetPerPhase: budget.maxTokensPerPhase,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        }

        case "get_locked_files": {
            const locked = await stateManager.getLockedFiles();
            return {
                content: [
                    {
                        type: "text" as const,
                        text: JSON.stringify(locked, null, 2),
                    },
                ],
            };
        }

        case "get_context": {
            const context = await stateManager.getContext();
            return {
                content: [{ type: "text" as const, text: context }],
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});

// ─── Start Server ──────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch(console.error);
