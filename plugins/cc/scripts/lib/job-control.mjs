/**
 * Job control: snapshots, resolution, sorting.
 */
import fs from "node:fs";
import { listJobs, readJobFile, resolveJobFile } from "./state.mjs";

export function sortJobsNewestFirst(jobs) {
  return [...jobs].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export function readStoredJob(workspaceRoot, jobId) {
  const jobFile = resolveJobFile(workspaceRoot, jobId);
  if (!fs.existsSync(jobFile)) return null;
  try { return readJobFile(jobFile); } catch { return null; }
}

export function resolveCancelableJob(workspaceRoot, jobId) {
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);
  return { job };
}

export function resolveResultJob(workspaceRoot, jobId) {
  const jobs = listJobs(workspaceRoot);
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`Job ${jobId} not found.`);
  const storedJob = readStoredJob(workspaceRoot, jobId);
  return { job, storedJob };
}

function computeElapsedAndDuration(job) {
  const startedAt = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const completedAt = job.completedAt ? new Date(job.completedAt).getTime() : null;
  const elapsed = startedAt && !completedAt ? formatElapsed(Date.now() - startedAt) : null;
  const duration = startedAt && completedAt ? formatElapsed(completedAt - startedAt) : null;
  return { elapsed, duration };
}

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

function enrichJob(job) {
  const { elapsed, duration } = computeElapsedAndDuration(job);
  return { ...job, elapsed, duration, kindLabel: job.jobClass ?? "task" };
}

function formatElapsed(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
