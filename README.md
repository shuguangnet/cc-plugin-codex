# cc-plugin-codex

> **Use Claude Code from within Codex CLI** — delegate tasks, run adversarial reviews, and manage Claude Code sessions without leaving Codex.

Inspired by [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) (which lets Claude Code drive Codex), this plugin does the **reverse**: it lets Codex drive Claude Code.

## What It Does

| Command | Description |
| --- | --- |
| `/cc:setup` | Check Claude Code CLI availability and authentication |
| `/cc:task` | Delegate a coding task to Claude Code |
| `/cc:review` | Run a code review via Claude Code |
| `/cc:adversarial-review` | Run a focused adversarial review |
| `/cc:status` | Show active and recent Claude Code jobs |
| `/cc:result` | Show stored result for a finished job |
| `/cc:cancel` | Cancel a running job |

## How It Works

The plugin wraps the Claude Code CLI (`claude`) and communicates with it via:

- **`claude -p` (print mode)**: Single-shot prompt → response, ideal for reviews and quick tasks
- **`claude --resume`**: Resume a previous conversation for multi-turn task workflows
- **`--output-format json`**: Structured output parsing for reliable result extraction

## Installation

```bash
# Clone into your Codex plugins directory
git clone https://github.com/shuguangnet/cc-plugin-codex.git ~/.codex/plugins/cc

# Or symlink
ln -s /path/to/cc-plugin-codex/plugins/cc ~/.codex/plugins/cc
```

### Prerequisites

- **Node.js** ≥ 18
- **Claude Code CLI** (`npm install -g @anthropic-ai/claude-code`)
- **Codex CLI** (`npm install -g @openai/codex`)

## Architecture

```
plugins/cc/
├── .claude-plugin/plugin.json    # Plugin manifest
├── hooks/hooks.json              # Session lifecycle hooks
├── commands/                     # Slash command definitions
│   ├── setup.md
│   ├── task.md
│   ├── review.md
│   ├── adversarial-review.md
│   ├── status.md
│   ├── result.md
│   └── cancel.md
├── scripts/
│   ├── cc-companion.mjs          # Main entry point
│   ├── session-lifecycle-hook.mjs
│   └── lib/
│       ├── claude-code.mjs       # Claude Code CLI client
│       ├── state.mjs             # Job state persistence
│       ├── tracked-jobs.mjs      # Job lifecycle tracking
│       ├── job-control.mjs       # Job queries and control
│       ├── render.mjs            # Output rendering
│       ├── git.mjs               # Git context helpers
│       ├── process.mjs           # Process management
│       ├── args.mjs              # Argument parsing
│       ├── fs.mjs                # Filesystem helpers
│       ├── prompts.mjs           # Template interpolation
│       └── workspace.mjs         # Workspace resolution
└── prompts/                      # Prompt templates
    └── adversarial-review.md
```

## License

MIT
