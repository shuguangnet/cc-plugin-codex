#!/usr/bin/env node

/**
 * Session lifecycle hook for cc-plugin-codex.
 * Called on SessionStart and SessionEnd.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import process from "node:process";

const PLUGIN_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HOOK_TYPE = process.argv[2] ?? "unknown";
const LOG_DIR = path.join(os.tmpdir(), "cc-plugin-codex");
const LOG_FILE = path.join(LOG_DIR, "sessions.log");

function log(message) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [${HOOK_TYPE}] ${message}\n`, "utf8");
  } catch {
    // Best-effort logging
  }
}

const sessionId = process.env.CLAUDE_SESSION_ID ?? process.env.SESSION_ID ?? "unknown";

if (HOOK_TYPE === "SessionStart") {
  log(`Session started: ${sessionId}`);
  // Output a brief status to stderr (Claude Code captures this)
  process.stderr.write(`[cc-plugin-codex] Plugin loaded. Use /cc:setup to check Claude Code CLI.\n`);
} else if (HOOK_TYPE === "SessionEnd") {
  log(`Session ended: ${sessionId}`);
} else {
  log(`Unknown hook type: ${HOOK_TYPE}`);
}
