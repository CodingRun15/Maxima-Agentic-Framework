/**
 * Prompt Builder — token-optimized prompt templates.
 *
 * All prompts accept pre-packed context from the ContextPacker
 * instead of raw file contents, ensuring minimal token usage.
 */
export class PromptBuilder {
    /**
     * Build prompt for brainstorming mode.
     * Encourages collaborative exploration and idea generation.
     */
    buildBrainstormPrompt(topic, history) {
        return `You are a collaborative technical architect engaged in a brainstorming session. Your role is to help explore ideas, ask clarifying questions, suggest alternatives, and think through trade-offs.

BRAINSTORMING TOPIC:
${topic}

${history ? `PREVIOUS DISCUSSION:\n${history}\n` : ""}
Guidelines:
- Be concise but insightful
- Ask probing questions to refine ideas
- Suggest concrete approaches with pros/cons
- Flag potential risks or edge cases early
- Keep responses focused and 
- Keep responses actionable
- Do not start the response with difficult suggestions. Here are few suggestions although you can think freely as well :
   - Don't start with tech. Start with pain-point.Turn system chaos into system-intent.
   - Think in constraints not possibilities.
   - Decompose the problem into domains like business logic, supporting systems,infra layer, data layer, intergrations etc.
   - think in data flow rather than components
   - choose architecture style later
   - design for modularity, replacability, observability, scalability, security, performance, cost, maintainability, clear interfaces, testing.
   - overall flow
   Problem → Constraints → Success metrics → Domain breakdown → Data flow → Failure scenarios → Architecture style → Iteration
Continue the brainstorming discussion.`;
    }
    /**
     * Build prompt for project breakdown.
     * Uses expensive model — this is the one place where full context is justified.
     */
    buildBreakdownPrompt(description, context, brainstormHistory) {
        const brainstormSection = brainstormHistory
            ? `\nPRIOR BRAINSTORMING (incorporate these insights):\n${brainstormHistory}\n`
            : "";
        return `You are an expert software architect. Break down this project into an execution plan.

PROJECT DESCRIPTION:
${description}

CONTEXT & CONSTRAINTS:
${context}
${brainstormSection}
Create a detailed execution plan with:
1. Phases (groups of tasks)
2. Tasks within each phase
3. File dependencies
4. Parallel execution opportunities

Return ONLY valid JSON matching this schema:
{
  "phases": [
    {
      "id": "phase_1",
      "name": "Foundation",
      "parallel": false,
      "tasks": [
        {
          "id": "task_1_1",
          "name": "Create database schema",
          "agent": "schema",
          "files": ["src/schema.sql"],
          "exports": [],
          "imports": [],
          "parallel_safe": false,
          "conflicts_with": [],
          "status": "pending"
        }
      ],
      "status": "pending"
    }
  ]
}`;
    }
    /**
     * Build prompt for task execution.
     * Context is pre-packed by ContextPacker (minimal, dependency-aware).
     */
    buildTaskPrompt(task, packedContext, lockedDecisions) {
        return `You are a ${task.agent} agent. Generate code for this task.

TASK: ${task.name}

${packedContext}

LOCKED DECISIONS (do NOT contradict these):
${lockedDecisions || "None yet."}

FILES TO CREATE/MODIFY:
${task.files.join(", ")}

Return COMPLETE file contents for each file. Wrap each file in:
--- FILE: <path> ---
<content>
--- END FILE ---`;
    }
    /**
     * Build prompt for impact analysis.
     * Uses minimal context (locked file metadata, not full content).
     */
    buildImpactAnalysisPrompt(changeRequest, lockedFilesSummary, architectureSummary) {
        return `Analyze the impact of this change request on the existing codebase.

CHANGE REQUEST:
${changeRequest}

CURRENT LOCKED FILES:
${lockedFilesSummary}

ARCHITECTURE:
${architectureSummary}

Return ONLY valid JSON:
{
  "noChange": ["files that don't need changes"],
  "modify": [
    {
      "file": "path/to/file",
      "reason": "why it needs to change",
      "estimate": "estimated lines of change",
      "changes": ["specific change 1", "specific change 2"]
    }
  ],
  "create": [
    {
      "file": "path/to/new/file",
      "reason": "why it's needed",
      "estimate": "estimated lines"
    }
  ],
  "delete": [],
  "breakingChanges": [
    {
      "decision_id": "decision that's contradicted",
      "description": "what conflicts",
      "affected_files": ["list of affected files"]
    }
  ]
}`;
    }
    /**
     * Build prompt for modifying a single function (diff-based).
     * Much cheaper than sending the entire file.
     */
    buildFunctionModifyPrompt(functionContext, modificationRequest) {
        return `Modify this function according to the request.

CURRENT FUNCTION:
${functionContext}

MODIFICATION REQUEST:
${modificationRequest}

Return ONLY the modified function (no explanation, no markdown).`;
    }
}
