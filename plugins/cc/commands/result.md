---
description: Show the stored final output for a finished Claude Code job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" result "$ARGUMENTS"`

Present the full command output to the user. Do not summarize or condense it. Preserve all details including:
- Job ID and status
- The complete result payload
- File paths and line numbers exactly as reported
- Error messages or parse errors
- Follow-up commands such as `/cc:status <id>`
