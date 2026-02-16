# Maxima — Cost-Optimized AI Project Manager

Autonomous AI project manager that plans, builds, and maintains code projects — **engineered for 80% lower API costs** through caching, context trimming, tiered models, and diff-based regeneration.

## Installation

```bash
npm install -g ai-project-manager
```

Or clone and build:

```bash
git clone <repo-url>
cd ai-project-manager
npm install
npm run build
```

## Quick Start

```bash
mkdir my-project && cd my-project
maxima init          # Creates .aistate/ directory
maxima chat          # Start interactive session
```

## Commands

### CLI Commands

| Command | Description |
|---------|-------------|
| `maxima init` | Initialize `.aistate/` in current directory |
| `maxima status` | Show project execution status |
| `maxima changelog` | Show change history |
| `maxima chat` | Start interactive REPL |
| `maxima cost-report` | Show token usage and cost report |

### Chat Slash Commands

| Command | Description |
|---------|-------------|
| `/brainstorm <topic>` | Start collaborative brainstorming session |
| `/done` | End brainstorm session and save |
| `/breakdown <desc>` | Break down a project into execution phases |
| `/approve-plan` | Approve and lock the current plan | 
| `/build` | Execute the approved plan phase-by-phase |
| `/tier`  | [thinking|expensive|cheap|local|auto]` | Force model tier |
| `/status` | Show project status |
| `/change <desc>` | Analyze impact of an architecture change |
| `/cost` | Show real-time cost report |
| `/exit` | Exit chat |

### Model Tiers

| Tier | Used For | Provider |
|------|----------|----------|
| Expensive | Architecture, impact analysis | Claude Sonnet / GPT-4 |
| Cheap | Code gen, tests, summaries | GPT-4o-mini / Haiku / Gemini |
| Local | Formatting, simple refactors | Ollama (free) |

Configure in `.aistate/model-config.json`.

### Flags 

| Flag | Description |
|------|-------------|
| `--thinking` | Use expensive model |
| `--expensive` | Use expensive model |
| `--cheap` | Use cheap model |

By default, `--cheap` is used.

## Cost Engineering

Every LLM call passes through a 6-layer pipeline:

```
Request → Trivial Diff? → Cache? → Model Router → Context Packer → Budget Gate → API
```

### How it saves 80%:

| Strategy | Savings | Mechanism |
|----------|---------|-----------|
| Context packing | ~40% | Only sends task-relevant files + their imports |
| Tiered models | ~25% | Uses GPT-4o-mini/Ollama for 70% of tasks |
| Deterministic cache | ~15% | Skips API if inputs unchanged |
| Diff-based regen | ~10% | Modifies functions, not whole files |
| Trivial diff skip | ~5% | Zero-cost for comment/whitespace changes |

### Model Tiers

| Tier | Used For | Provider |
|------|----------|----------|
| Expensive | Architecture, impact analysis | Claude Sonnet / GPT-4 |
| Cheap | Code gen, tests, summaries | GPT-4o-mini / Haiku |
| Local | Formatting, simple refactors | Ollama (free) |

Configure in `.aistate/model-config.json`.

## Architecture

```
src/
├── core/           # State management, dependency analysis
├── cost/           # 🔑 Cost engineering layer (5 modules)
├── agents/         # Multi-provider LLM client
├── cli/            # Commander CLI + chat REPL
└── mcp/            # MCP server for IDE integration
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | One of these | Anthropic API key |
| `OPENAI_API_KEY` | required | OpenAI API key |
| `OLLAMA_HOST` | Optional | Ollama host (default: `http://127.0.0.1:11434`) |
| `GEMINI_API_KEY` | One Of these | Google Gemini API key |
...more to come

## Development

```bash
npm run typecheck   # Type check without emitting
npm run test        # Run test suite
npm run build       # Compile TypeScript
npm run dev         # Run CLI in dev mode with tsx
```

## MCP Integration

Add to your IDE's MCP config:

```json
{
  "mcpServers": {
    "ai-project-manager": {
      "command": "node",
      "args": ["path/to/dist/mcp/server.js"]
    }
  }
}
```

## License

MIT
