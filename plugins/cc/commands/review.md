---
description: Run a code review via Claude Code against local git state
argument-hint: '[--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Run a Claude Code review on the current changes.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues, apply patches, or suggest changes.
- Your only job is to run the review and return Claude Code's output verbatim.

Execution mode rules:
- If `--wait` is passed, run in foreground.
- If `--background` is passed, run in background.
- Otherwise, estimate review size:
  - For working-tree: `git status --short` + `git diff --shortstat`.
  - For base-branch: `git diff --shortstat <base>...HEAD`.
  - Recommend waiting only for tiny changes (1-2 files).
  - Otherwise recommend background.
- Ask once with `AskUserQuestion`:
  - `Wait for results`
  - `Run in background (Recommended)`

Foreground flow:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" review "$ARGUMENTS"
```
- Return stdout verbatim. No commentary.

Background flow:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" review "$ARGUMENTS"`,
  description: "Claude Code review",
  run_in_background: true
})
```
- Tell the user: "Claude Code review started in the background. Check `/cc:status` for progress."
