/**
 * State management for cc-plugin-codex.
 * Persists job records and config to disk.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeJsonFile } from "./fs.mjs";
import { resolveWorkspaceRoot } from "./workspace.mjs";

const STATE_VERSION = 1;
const PLUGIN_DATA_ENV = "CLAUDE_PLUGIN_DATA";
const FALLBACK_STATE_ROOT_DIR = path.join(os.tmpdir(), "cc-plugin-codex");
const STATE_FILE_NAME = "state.json";
const JOBS_DIR_NAME = "jobs";
const MAX_JOBS = 50;

/**
 * Get the current ISO timestamp.
 * @returns {string} ISO 8601 date string
 */
export function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    version: STATE_VERSION,
    config: {},
    jobs: []
  };
}

/**
 * Resolve the state directory for a workspace, using a hash of the real path.
 * @param {string} cwd - Working directory
 * @returns {string} Absolute path to the state directory
 */
export function resolveStateDir(cwd) {
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  let canonical = workspaceRoot;
  try {
    canonical = fs.realpathSync.native(workspaceRoot);
  } catch {
    canonical = workspaceRoot;
  }

  const slug = (path.basename(workspaceRoot) || "workspace")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
  const hash = createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  const pluginDataDir = process.env[PLUGIN_DATA_ENV];
  const stateRoot = pluginDataDir ? path.join(pluginDataDir, "state") : FALLBACK_STATE_ROOT_DIR;
  return path.join(stateRoot, `${slug}-${hash}`);
}

/**
 * Resolve the state file path for a workspace.
 * @param {string} cwd - Working directory
 * @returns {string} Absolute path to the state JSON file
 */
export function resolveStateFile(cwd) {
  return path.join(resolveStateDir(cwd), STATE_FILE_NAME);
}

/**
 * Resolve the jobs directory path for a workspace.
 * @param {string} cwd - Working directory
 * @returns {string} Absolute path to the jobs directory
 */
export function resolveJobsDir(cwd) {
  return path.join(resolveStateDir(cwd), JOBS_DIR_NAME);
}

/**
 * Ensure the state directory (including jobs subdirectory) exists.
 * @param {string} cwd - Working directory
 */
export function ensureStateDir(cwd) {
  fs.mkdirSync(resolveJobsDir(cwd), { recursive: true });
}

/**
 * Load the persisted state for a workspace.
 * Returns default state if the file doesn't exist or is unreadable.
 * Avoids TOCTOU race by catching read/parse errors directly instead of checking existence first.
 *
 * @param {string} cwd - Working directory (used to resolve workspace)
 * @returns {{ version: number, config: object, jobs: Array }} The loaded or default state
 */
export function loadState(cwd) {
  const stateFile = resolveStateFile(cwd);
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    return {
      ...defaultState(),
      ...parsed,
      config: { ...defaultState().config, ...(parsed.config ?? {}) },
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
    };
  } catch {
    return defaultState();
  }
}

function pruneJobs(jobs) {
  return [...jobs]
    .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
    .slice(0, MAX_JOBS);
}

/**
 * Save state to disk, pruning jobs to MAX_JOBS and cleaning up orphaned job files.
 *
 * @param {string} cwd - Working directory (used to resolve workspace)
 * @param {object} state - State to persist
 * @returns {object} The saved state after pruning
 */
export function saveState(cwd, state) {
  const previousJobs = loadState(cwd).jobs;
  ensureStateDir(cwd);
  const nextJobs = pruneJobs(state.jobs ?? []);
  const nextState = {
    version: STATE_VERSION,
    config: { ...defaultState().config, ...(state.config ?? {}) },
    jobs: nextJobs
  };

  const retainedIds = new Set(nextJobs.map((j) => j.id));
  for (const job of previousJobs) {
    if (!retainedIds.has(job.id)) {
      const jobFile = resolveJobFile(cwd, job.id);
      if (fs.existsSync(jobFile)) fs.unlinkSync(jobFile);
      if (job.logFile && fs.existsSync(job.logFile)) fs.unlinkSync(job.logFile);
    }
  }

  writeJsonFile(resolveStateFile(cwd), nextState);
  return nextState;
}

/**
 * Atomically update state by loading, mutating, and saving.
 * @param {string} cwd - Working directory
 * @param {function(object): void} mutate - Callback to mutate the state in place
 * @returns {object} The saved state
 */
export function updateState(cwd, mutate) {
  const state = loadState(cwd);
  mutate(state);
  return saveState(cwd, state);
}

/**
 * Generate a unique job ID with an optional prefix.
 * @param {string} [prefix="job"] - Prefix for the job ID
 * @returns {string} Unique job identifier
 */
export function generateJobId(prefix = "job") {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/**
 * Insert or update a job record in the state.
 * @param {string} cwd - Working directory
 * @param {object} jobPatch - Job data (must include id)
 * @returns {object} The saved state
 */
export function upsertJob(cwd, jobPatch) {
  return updateState(cwd, (state) => {
    const timestamp = nowIso();
    const idx = state.jobs.findIndex((j) => j.id === jobPatch.id);
    if (idx === -1) {
      state.jobs.unshift({ createdAt: timestamp, updatedAt: timestamp, ...jobPatch });
    } else {
      state.jobs[idx] = { ...state.jobs[idx], ...jobPatch, updatedAt: timestamp };
    }
  });
}

/**
 * List all jobs for a workspace.
 * @param {string} cwd - Working directory
 * @returns {Array} Array of job records
 */
export function listJobs(cwd) {
  return loadState(cwd).jobs;
}

/**
 * Set a configuration key in the workspace state.
 * @param {string} cwd - Working directory
 * @param {string} key - Config key
 * @param {*} value - Config value
 * @returns {object} The saved state
 */
export function setConfig(cwd, key, value) {
  return updateState(cwd, (state) => {
    state.config = { ...state.config, [key]: value };
  });
}

/**
 * Get the configuration object for a workspace.
 * @param {string} cwd - Working directory
 * @returns {object} Configuration object
 */
export function getConfig(cwd) {
  return loadState(cwd).config;
}

/**
 * Write a job's detailed data to a JSON file on disk.
 * @param {string} cwd - Working directory
 * @param {string} jobId - Job identifier
 * @param {object} payload - Job data to persist
 * @returns {string} Absolute path to the written job file
 */
export function writeJobFile(cwd, jobId, payload) {
  ensureStateDir(cwd);
  const jobFile = resolveJobFile(cwd, jobId);
  writeJsonFile(jobFile, payload);
  return jobFile;
}

/**
 * Read and parse a job JSON file.
 * @param {string} jobFile - Absolute path to the job JSON file
 * @returns {object} Parsed job data
 * @throws {Error} If the file cannot be read or parsed
 */
export function readJobFile(jobFile) {
  return JSON.parse(fs.readFileSync(jobFile, "utf8"));
}

function validateJobId(jobId) {
  if (!jobId || typeof jobId !== "string") {
    throw new Error("Job ID is required.");
  }
  if (jobId.includes("\0") || jobId.includes("..") || jobId.includes("/") || jobId.includes("\\")) {
    throw new Error(`Invalid job ID: ${jobId}`);
  }
}

/**
 * Resolve the path to a job's log file.
 * @param {string} cwd - Working directory
 * @param {string} jobId - Job identifier (must not contain path separators or traversal sequences)
 * @returns {string} Absolute path to the job log file
 * @throws {Error} If jobId is invalid or contains path traversal characters
 */
export function resolveJobLogFile(cwd, jobId) {
  validateJobId(jobId);
  ensureStateDir(cwd);
  return path.join(resolveJobsDir(cwd), `${jobId}.log`);
}

/**
 * Resolve the path to a job's JSON file.
 * @param {string} cwd - Working directory
 * @param {string} jobId - Job identifier (must not contain path separators or traversal sequences)
 * @returns {string} Absolute path to the job JSON file
 * @throws {Error} If jobId is invalid or contains path traversal characters
 */
export function resolveJobFile(cwd, jobId) {
  validateJobId(jobId);
  ensureStateDir(cwd);
  return path.join(resolveJobsDir(cwd), `${jobId}.json`);
}
