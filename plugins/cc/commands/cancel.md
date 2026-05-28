---
description: Cancel a running Claude Code job
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" cancel "$ARGUMENTS"`

Present the output to the user. If no job ID was provided, remind them to use `/cc:status` to see active jobs.
