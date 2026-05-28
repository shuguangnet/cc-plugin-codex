---
description: Run diagnostics on Claude Code CLI and plugin configuration
argument-hint: '[--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*), Bash(npm:*), Bash(claude:*), Bash(git:*)
---

Run comprehensive diagnostics.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" doctor --json $ARGUMENTS
```

Present the full diagnostic output to the user. Include:
- Node.js version and location
- npm version
- Claude Code CLI version and location
- Claude Code authentication status
- Git repository status
- Plugin configuration
- Any warnings or recommendations
