/**
 * Job control: snapshots, resolution, sorting.
 */
import { listJobs, readJobFile, resolveJobFile } from "./state.mjs";

/**
 * Sort jobs array with newest (by createdAt) first.
 *
 * @param {Array<{createdAt?: string}>} jobs - Jobs to sort
 * @returns {Array} New sorted array (does not mutate input)
 */
export function sortJobsNewestFirst(jobs) {
  return [...jobs].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

/**
 * Read the stored job JSON file from disk.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @returns {object|null} Parsed job data, or null if missing or unreadable
 */
export function readStoredJob(workspaceRoot, jobId) {
  const jobFile = resolveJobFile(workspaceRoot, jobId);
  try { return readJobFile(jobFile); } catch { return null; }
}

/**
 * Resolve a job for cancellation. Throws if the job is not found.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @returns {{ job: object }} The resolved job record
 * @throws {Error} If the job is not found
 */
export function resolveCancelableJob(workspaceRoot, jobId) {
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);
  return { job };
}

/**
 * Resolve a job for viewing its result. Throws if the job is not found.
 * Also reads the stored job file from disk if available.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @returns {{ job: object, storedJob: object|null }} Job record and stored data
 * @throws {Error} If the job is not found
 */
export function resolveResultJob(workspaceRoot, jobId) {
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);
  const storedJob = readStoredJob(workspaceRoot, jobId);
  return { job, storedJob };
}

/**
 * Compute elapsed time (for running jobs) and duration (for completed jobs).
 *
 * @param {{startedAt?: string, completedAt?: string}} job - Job with timestamps
 * @returns {{elapsed: string|null, duration: string|null}}
 */
function computeElapsedAndDuration(job) {
  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : null;
  const elapsed = startedAt && !completedAt ? formatElapsed(Date.now() - startedAt) : null;
  const duration = startedAt && completedAt ? formatElapsed(completedAt - startedAt) : null;
  return { elapsed, duration };
}

/**
 * Build a detailed snapshot for a single job, including elapsed/duration
 * and the stored job file data.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {string} jobId - Job identifier
 * @returns {{ job: object, storedJob: object|null, progressPreview: Array }} Snapshot data
 * @throws {Error} If the job is not found
 */
export function buildSingleJobSnapshot(workspaceRoot, jobId) {
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);
  const storedJob = readStoredJob(workspaceRoot, jobId);

  const { elapsed, duration } = computeElapsedAndDuration(job);

  return {
    job: { ...job, elapsed, duration },
    storedJob,
    progressPreview: storedJob?.progress?.slice(-5) ?? []
  };
}

/**
 * Build a status snapshot with running, latest finished, and recent jobs.
 *
 * @param {string} workspaceRoot - Workspace root directory
 * @param {object} [options={}] - Options
 * @param {boolean} [options.showAll=false] - Show all finished jobs instead of just 5
 * @returns {{ running: Array, latestFinished: object|null, recent: Array, config: object }}
 */
export function buildStatusSnapshot(workspaceRoot, options = {}) {
  const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
  const running = jobs.filter((j) => j.status === "running" || j.status === "queued");
  const finished = jobs.filter((j) => j.status !== "running" && j.status !== "queued");
  const latestFinished = finished[0] ?? null;
  const recent = options.showAll ? finished.slice(1) : finished.slice(1, 6);

  return {
    running: running.map((j) => enrichJob(j)),
    latestFinished: latestFinished ? enrichJob(latestFinished) : null,
    recent: recent.map((j) => enrichJob(j)),
    config: {}
  };
}

/**
 * Enrich a job record with computed elapsed/duration and kindLabel.
 *
 * @param {object} job - Raw job record
 * @returns {object} Enriched job with elapsed, duration, and kindLabel
 */
function enrichJob(job) {
  const { elapsed, duration } = computeElapsedAndDuration(job);
  return { ...job, elapsed, duration, kindLabel: job.jobClass ?? "task" };
}

/**
 * Format milliseconds into a human-readable elapsed time string.
 * Handles edge cases: NaN, negative, Infinity, and non-number inputs
 * are treated as 0ms.
 *
 * @param {number} ms - Milliseconds to format
 * @returns {string} Formatted string (e.g. "500ms", "5s", "2m 30s", "1h 5m")
 */
export function formatElapsed(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0ms";
  if (ms < 1000) return `${Math.floor(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
