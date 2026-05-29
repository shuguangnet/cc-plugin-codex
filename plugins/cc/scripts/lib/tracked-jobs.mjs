/**
 * Tracked job lifecycle management.
 * Provides functions for creating job records, logging, progress tracking,
 * and executing jobs with automatic state persistence.
 */
import fs from "node:fs";
import process from "node:process";

import { readStoredJob } from "./job-control.mjs";
import { nowIso as _nowIso, readJobFile, resolveJobFile, resolveJobLogFile, upsertJob, writeJobFile } from "./state.mjs";

/** Environment variable name for passing the Claude Code session ID. */
export const SESSION_ID_ENV = "CLAUDE_SESSION_ID";

/** Re-export nowIso from state module for convenience. */
export const nowIso = _nowIso;

/**
 * Normalize a progress event value into a standard event object.
 * Handles both object events (with message/phase/sessionId) and plain strings.
 *
 * @param {*} value - Raw progress event (object or string)
 * @returns {{ message: string, phase: string|null, sessionId: string|null }} Normalized event
 */
function normalizeProgressEvent(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      message: String(value.message ?? "").trim(),
      phase: typeof value.phase === "string" && value.phase.trim() ? value.phase.trim() : null,
      sessionId: typeof value.sessionId === "string" ? value.sessionId : null
    };
  }
  return { message: String(value ?? "").trim(), phase: null, sessionId: null };
}

/**
 * Append a single timestamped log line to a log file.
 * Silently ignores null/undefined log files or empty messages.
 *
 * @param {string|null} logFile - Absolute path to the log file
 * @param {string} message - Log message to append
 */
export function appendLogLine(logFile, message) {
  const normalized = String(message ?? "").trim();
  if (!logFile || !normalized) return;
  fs.appendFileSync(logFile, `[${nowIso()}] ${normalized}\n`, "utf8");
}

/**
 * Append a block of text with a title header to a log file.
 * Useful for logging structured output (e.g. final job results).
 *
 * @param {string|null} logFile - Absolute path to the log file
 * @param {string} title - Block title/header
 * @param {string} body - Block body content
 */
export function appendLogBlock(logFile, title, body) {
  if (!logFile || !body) return;
  fs.appendFileSync(logFile, `\n[${nowIso()}] ${title}\n${String(body).trimEnd()}\n`, "utf8");
}

/**
 * Create an empty log file for a job and optionally log an initial message.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @param {string} [title] - Optional title to log as the first entry
 * @returns {string} Absolute path to the created log file
 */
export function createJobLogFile(workspaceRoot, jobId, title) {
  const logFile = resolveJobLogFile(workspaceRoot, jobId);
  fs.writeFileSync(logFile, "", "utf8");
  if (title) appendLogLine(logFile, `Starting ${title}.`);
  return logFile;
}

/**
 * Create a job record with timestamps and optional session ID from environment.
 *
 * @param {object} base - Base job data (must include id, workspaceRoot, etc.)
 * @param {object} [options={}] - Options
 * @param {object} [options.env] - Environment variables to read session ID from (defaults to process.env)
 * @param {string} [options.sessionIdEnv] - Custom env var name for session ID (defaults to CLAUDE_SESSION_ID)
 * @returns {object} Job record with createdAt and optional sessionId
 */
export function createJobRecord(base, options = {}) {
  const env = options.env ?? process.env;
  const sessionId = env[options.sessionIdEnv ?? SESSION_ID_ENV];
  return {
    ...base,
    createdAt: nowIso(),
    ...(sessionId ? { sessionId } : {})
  };
}

/**
 * Create a progress updater function for a job.
 * The returned function tracks phase and sessionId changes, persisting them
 * to the job state and job file when they change.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @returns {function(object): void} Progress update function
 */
export function createJobProgressUpdater(workspaceRoot, jobId) {
  let lastPhase = null;
  let lastSessionId = null;

  return (event) => {
    const normalized = normalizeProgressEvent(event);
    const patch = { id: jobId };
    let changed = false;

    if (normalized.phase && normalized.phase !== lastPhase) {
      lastPhase = normalized.phase;
      patch.phase = normalized.phase;
      changed = true;
    }

    if (normalized.sessionId && normalized.sessionId !== lastSessionId) {
      lastSessionId = normalized.sessionId;
      patch.sessionId = normalized.sessionId;
      changed = true;
    }

    if (!changed) return;
    upsertJob(workspaceRoot, patch);

    const jobFile = resolveJobFile(workspaceRoot, jobId);
    try {
      const stored = readJobFile(jobFile);
      writeJobFile(workspaceRoot, jobId, { ...stored, ...patch });
    } catch {
      // File may not exist yet or may have been deleted — benign condition.
      // The next progress event will retry.
    }
  };
}

/**
 * Create a progress reporter that fans out events to multiple outputs.
 * Supports stderr logging, file logging, and an event callback.
 * Returns null if no outputs are configured.
 *
 * @param {object} [options={}] - Reporter configuration
 * @param {boolean} [options.stderr=false] - Whether to write progress to stderr
 * @param {string|null} [options.logFile=null] - Absolute path to a log file
 * @param {function|null} [options.onEvent=null] - Callback for normalized progress events
 * @returns {function|null} Progress reporter function, or null if no outputs configured
 */
export function createProgressReporter({ stderr = false, logFile = null, onEvent = null } = {}) {
  if (!stderr && !logFile && !onEvent) return null;
  return (eventOrMessage) => {
    const event = normalizeProgressEvent(eventOrMessage);
    if (stderr && event.message) process.stderr.write(`[cc] ${event.message}\n`);
    appendLogLine(logFile, event.message);
    onEvent?.(event);
  };
}

/**
 * Execute a job with automatic lifecycle tracking.
 * Creates running state, executes the runner function, and persists the result.
 * On failure, records the error and re-throws.
 *
 * @param {object} job - Job record (must include id and workspaceRoot)
 * @param {function(): Promise<object>} runner - Async function that executes the job
 * @param {object} [options={}] - Options
 * @param {string} [options.logFile] - Absolute path to the job's log file
 * @returns {Promise<object>} Execution result from the runner
 * @throws {Error} If job is not a valid object, or if id/workspaceRoot are missing
 * @throws {*} Re-throws any error from the runner after recording failure state
 */
export async function runTrackedJob(job, runner, options = {}) {
  if (!job || typeof job !== "object") {
    throw new Error("runTrackedJob requires a job object.");
  }
  if (!job.id || typeof job.id !== "string") {
    throw new Error("runTrackedJob requires job.id to be a non-empty string.");
  }
  if (!job.workspaceRoot || typeof job.workspaceRoot !== "string") {
    throw new Error("runTrackedJob requires job.workspaceRoot to be a non-empty string.");
  }
  if (typeof runner !== "function") {
    throw new Error("runTrackedJob requires a runner function.");
  }

  const runningRecord = {
    ...job,
    status: "running",
    startedAt: nowIso(),
    phase: "starting",
    pid: process.pid,
    logFile: options.logFile ?? job.logFile ?? null
  };
  writeJobFile(job.workspaceRoot, job.id, runningRecord);
  upsertJob(job.workspaceRoot, runningRecord);

  try {
    const execution = await runner();
    const status = execution.exitStatus === 0 ? "completed" : "failed";
    const completedAt = nowIso();
    writeJobFile(job.workspaceRoot, job.id, {
      ...runningRecord,
      status,
      sessionId: execution.sessionId ?? null,
      pid: null,
      phase: status === "completed" ? "done" : "failed",
      completedAt,
      result: execution.payload,
      rendered: execution.rendered
    });
    upsertJob(job.workspaceRoot, {
      id: job.id,
      status,
      sessionId: execution.sessionId ?? null,
      summary: execution.summary,
      phase: status === "completed" ? "done" : "failed",
      pid: null,
      completedAt
    });
    appendLogBlock(options.logFile ?? job.logFile ?? null, "Final output", execution.rendered);
    return execution;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const existing = readStoredJob(job.workspaceRoot, job.id) ?? runningRecord;
    const completedAt = nowIso();
    writeJobFile(job.workspaceRoot, job.id, {
      ...existing,
      status: "failed",
      phase: "failed",
      errorMessage,
      pid: null,
      completedAt,
      logFile: options.logFile ?? job.logFile ?? existing.logFile ?? null
    });
    upsertJob(job.workspaceRoot, {
      id: job.id,
      status: "failed",
      phase: "failed",
      pid: null,
      errorMessage,
      completedAt
    });
    throw error;
  }
}
