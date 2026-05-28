#!/usr/bin/env node

/**
 * Stop review gate hook for cc-plugin-codex.
 * When enabled, runs an adversarial review before allowing the session to end.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATE_DIR_ENV = "CLAUDE_PLUGIN_DATA";

function loadConfig() {
  const stateDir = process.env[STATE_DIR_ENV];
  if (!stateDir) return {};
  const stateFile = path.join(stateDir, "state.json");
  try {
    const data = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    return data.config ?? {};
  } catch {
    return {};
  }
}

const config = loadConfig();

if (!config.stopReviewGate) {
  // Gate is not enabled, exit silently
  process.exit(0);
}

// Output a message to stderr that Claude Code will see
process.stderr.write(
  "[cc-plugin-codex] Stop-time review gate is enabled. Run `/cc:adversarial-review --wait` before ending.\n"
);

// Exit with 0 to not block, but the stderr message serves as a reminder
process.exit(0);
