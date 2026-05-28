---
description: Delegate a coding task to Claude Code
argument-hint: '[--background] [--write] [--resume-last|--resume <id>] [--model <model>] [prompt]'
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

Delegate a coding task to Claude Code.

Raw slash-command arguments:
`$ARGUMENTS`

Execution mode rules:
- If `--background` is passed, do not ask. Run in a background task.
- If `--write` is passed, Claude Code will be allowed to modify files (full-auto mode).
- Otherwise, ask the user once with `AskUserQuestion`:
  - `Run interactively (Recommended)`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip flags or rewrite intent.
- `--write` grants Claude Code file modification permissions.
- `--resume-last` continues the most recent Claude Code conversation.
- `--resume <id>` continues a specific conversation by session ID.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" task "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" task "$ARGUMENTS"`,
  description: "Claude Code task",
  run_in_background: true
})
```
- After launching, tell the user: "Claude Code task started in the background. Check `/cc:status` for progress."
