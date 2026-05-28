# Stop Review Gate Prompt

Before ending this session, you must run an adversarial code review.

Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cc-companion.mjs" adversarial-review --wait
```

If the review finds critical or high severity issues:
1. Present the findings to the user
2. Do not end the session until the user acknowledges

If the review passes or only has low/medium findings:
1. Present a brief summary
2. The session may end normally
