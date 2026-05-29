/**
 * Claude Code CLI Client
 *
 * Wraps the `claude` CLI to provide:
 * - Availability and auth checks
 * - Single-shot prompt execution (print mode)
 * - Conversation resume (multi-turn)
 * - JSON output parsing
 * - Streaming progress via child process stderr
 */
import { spawn } from "node:child_process";
import process from "node:process";
import { binaryAvailable, runCommand } from "./process.mjs";

const CLAUDE_CLI = "claude";

/**
 * Check if Claude Code CLI is installed.
 */
export function getClaudeCodeAvailability() {
  return binaryAvailable(CLAUDE_CLI, ["--version"]);
}

/**
 * Check Claude Code auth status by running a minimal prompt.
 */
export async function getClaudeCodeAuthStatus(cwd) {
  const availability = getClaudeCodeAvailability();
  if (!availability.available) {
    return { loggedIn: false, detail: "Claude Code CLI not installed", requiresAuth: false };
  }

  try {
    const result = runCommand(CLAUDE_CLI, ["-p", "Say OK", "--output-format", "json", "--max-turns", "1"], {
      cwd,
      timeout: 30000
    });

    if (result.status === 0 && result.stdout.trim()) {
      return { loggedIn: true, detail: "Authenticated", requiresAuth: false };
    }

    const stderr = result.stderr.toLowerCase();
    if (stderr.includes("unauthorized") || stderr.includes("api key") || stderr.includes("not authenticated")) {
      return { loggedIn: false, detail: "Not authenticated. Run `claude` to login.", requiresAuth: true };
    }

    // Might still be OK — some versions don't produce JSON for tiny prompts
    if (result.status === 0) {
      return { loggedIn: true, detail: "Authenticated (non-JSON response)", requiresAuth: false };
    }

    return { loggedIn: false, detail: result.stderr.trim() || `exit ${result.status}`, requiresAuth: true };
  } catch (error) {
    return { loggedIn: false, detail: error.message, requiresAuth: true };
  }
}

/**
 * Build common CLI arguments shared by both print and resume modes.
 * Handles outputFormat, maxTurns, model, systemPrompt, allowedTools, and permissionMode.
 *
 * @param {object} [options={}] - CLI options
 * @returns {string[]} CLI argument tokens
 */
function buildCommonArgs(options = {}) {
  const args = [];
  args.push("--output-format", options.outputFormat ?? "json");
  if (options.maxTurns) args.push("--max-turns", String(options.maxTurns));
  if (options.model) args.push("--model", options.model);
  if (options.systemPrompt) args.push("--system-prompt", options.systemPrompt);
  if (options.allowedTools) args.push("--allowedTools", options.allowedTools);
  if (options.permissionMode) args.push("--permission-mode", options.permissionMode);
  return args;
}

/**
 * Build CLI arguments for a Claude Code print-mode invocation.
 */
function buildPrintArgs(prompt, options = {}) {
  const args = ["-p", prompt, ...buildCommonArgs(options)];
  if (options.resume) {
    args.push("--resume", options.resume);
  }
  return args;
}

/**
 * Build CLI arguments for conversation resume.
 * Shares common option args with print mode via {@link buildCommonArgs}.
 */
function buildResumeArgs(sessionId, prompt, options = {}) {
  const args = ["--resume", sessionId];
  if (prompt) {
    args.push("-p", prompt);
  }
  args.push(...buildCommonArgs(options));
  return args;
}

/**
 * Parse Claude Code JSON output.
 * Claude Code can return:
 * - A single JSON object with {result, session_id, ...}
 * - JSONL with multiple events (streaming mode)
 * - Plain text (when output-format is text)
 */
export function parseClaudeOutput(stdout, stderr = "") {
  const trimmed = stdout.trim();
  if (!trimmed) {
    // Check stderr for error messages
    const stderrTrimmed = stderr.trim();
    if (stderrTrimmed) {
      return { result: "", sessionId: null, isError: true, error: stderrTrimmed, raw: "" };
    }
    return { result: "", sessionId: null, isError: false, raw: "" };
  }

  // Try parsing as single JSON object first
  try {
    const parsed = JSON.parse(trimmed);
    // Claude Code JSON output has these fields
    if (typeof parsed === "object" && parsed !== null) {
      return {
        result: parsed.result ?? parsed.content ?? parsed.text ?? trimmed,
        sessionId: parsed.session_id ?? parsed.sessionId ?? null,
        isError: parsed.is_error ?? parsed.isError ?? false,
        cost: parsed.cost_usd ?? parsed.cost ?? null,
        duration: parsed.duration_ms ?? parsed.duration ?? null,
        numTurns: parsed.num_turns ?? parsed.numTurns ?? null,
        totalTokens: parsed.total_tokens ?? null,
        raw: parsed
      };
    }
  } catch {
    // Not single JSON, try JSONL
  }

  // Try JSONL — accumulate events
  const lines = trimmed.split("\n").filter(Boolean);
  const events = [];
  let sessionId = null;
  let lastContentEvent = null;

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      events.push(event);
      if (event.session_id) sessionId = event.session_id;
      if (event.sessionId) sessionId = event.sessionId;
      // Track content-type events
      if (event.type === "assistant" || event.type === "result" || event.type === "content") {
        lastContentEvent = event;
      }
    } catch {
      // Not JSON, might be mixed text output
    }
  }

  if (events.length > 0) {
    // Prefer the last "result" event, then content, then last event
    const resultEvent = events.find((e) => e.type === "result") ?? lastContentEvent ?? events[events.length - 1];
    return {
      result: resultEvent.result ?? resultEvent.content ?? resultEvent.text ?? trimmed,
      sessionId,
      isError: resultEvent.is_error ?? false,
      cost: resultEvent.cost_usd ?? null,
      duration: resultEvent.duration_ms ?? null,
      numTurns: resultEvent.num_turns ?? resultEvent.numTurns ?? null,
      totalTokens: resultEvent.total_tokens ?? null,
      events,
      raw: resultEvent
    };
  }

  // Plain text output
  return { result: trimmed, sessionId: null, isError: false, raw: trimmed };
}

/**
 * Internal helper: spawn the Claude Code CLI and collect output.
 * Handles stdout/stderr collection, progress reporting, and exit processing.
 *
 * @param {string[]} args - CLI arguments
 * @param {string} cwd - Working directory
 * @param {object} options - Options including env and onProgress
 * @returns {Promise<object>} Parsed output with exitCode and stderr
 */
function spawnClaudeProcess(args, cwd, options = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...(options.env ?? {}) };

    const child = spawn(CLAUDE_CLI, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (options.onProgress) {
        for (const line of chunk.split("\n").filter(Boolean)) {
          options.onProgress({ message: line, phase: "running" });
        }
      }
    });

    child.on("error", (error) => {
      reject(new Error(`Failed to start Claude Code: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (signal === "SIGTERM" || signal === "SIGKILL") {
        reject(new Error("Claude Code was terminated."));
        return;
      }

      const parsed = parseClaudeOutput(stdout, stderr);

      if (code !== 0 && !parsed.result) {
        reject(new Error(stderr.trim() || `Claude Code exited with code ${code}`));
        return;
      }

      resolve({
        ...parsed,
        exitCode: code,
        stderr: stderr.trim()
      });
    });
  });
}

/**
 * Run a single-shot prompt via Claude Code CLI.
 * Returns a promise that resolves with the parsed output.
 */
export function runClaudePrompt(cwd, prompt, options = {}) {
  const args = buildPrintArgs(prompt, options);
  return spawnClaudeProcess(args, cwd, options);
}

/**
 * Run a multi-turn conversation with Claude Code.
 * If resumeSessionId is provided, resumes that session.
 * Otherwise starts a new conversation.
 */
export function runClaudeConversation(cwd, prompt, options = {}) {
  if (options.resumeSessionId) {
    const args = buildResumeArgs(options.resumeSessionId, prompt, options);
    return spawnClaudeProcess(args, cwd, options);
  }

  return runClaudePrompt(cwd, prompt, options);
}

/**
 * Kill a running Claude Code process.
 */
export function killClaudeProcess(child) {
  if (child && !child.killed) {
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 3000).unref?.();
  }
}
