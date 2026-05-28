---
description: Run a focused adversarial review via Claude Code
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch] [focus text]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run an adversarial code review via Claude Code with custom focus.

Raw slash-command arguments:
`$ARGUMENTS`

This is a more aggressive review that searches for bugs, security issues, and design flaws.
The user can provide focus text to direct the review attention.

Execution rules are the same as `/cc:review`.

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" adversarial-review "$ARGUMENTS"
```
- Return stdout verbatim. No commentary.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" adversarial-review "$ARGUMENTS"`,
  description: "Claude Code adversarial review",
  run_in_background: true
})
```
