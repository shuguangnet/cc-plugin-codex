---
description: Check whether Claude Code CLI is ready and authenticated
argument-hint: '[--json]'
allowed-tools: Bash(node:*), Bash(npm:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" setup --json $ARGUMENTS
```

If the result says Claude Code is unavailable and npm is available:
- Use `AskUserQuestion` exactly once to ask whether to install Claude Code now.
- Put the install option first and suffix it with `(Recommended)`.
- Use these two options:
  - `Install Claude Code (Recommended)`
  - `Skip for now`
- If the user chooses install, run:

```bash
npm install -g @anthropic-ai/claude-code
```

- Then rerun:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" setup --json $ARGUMENTS
```

If Claude Code is already installed or npm is unavailable:
- Do not ask about installation.

Output rules:
- Present the final setup output to the user.
- If installation was skipped, present the original setup output.
- If Claude Code is installed but not authenticated, preserve the guidance to run `claude` interactively.
