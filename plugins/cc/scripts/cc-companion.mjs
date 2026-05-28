#!/usr/bin/env node

/**
 * cc-companion.mjs — Main entry point for the cc-plugin-codex plugin.
 *
 * Usage:
 *   node scripts/cc-companion.mjs setup [--json]
 *   node scripts/cc-companion.mjs task [--background] [--write] [--resume-last|--resume <id>] [--model <model>] [--effort <level>] [prompt]
 *   node scripts/cc-companion.mjs review [--wait|--background] [--base <ref>] [--scope <auto|working-tree|branch>]
 *   node scripts/cc-companion.mjs adversarial-review [--wait|--background] [--base <ref>] [--scope <auto|working-tree|branch>] [focus text]
 *   node scripts/cc-companion.mjs status [job-id] [--all] [--json]
 *   node scripts/cc-companion.mjs result [job-id] [--json]
 *   node scripts/cc-companion.mjs cancel [job-id] [--json]
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import {
  getClaudeCodeAvailability,
  getClaudeCodeAuthStatus,
  runClaudePrompt,
  runClaudeConversation
} from "./lib/claude-code.mjs";
import { readStdinIfPiped } from "./lib/fs.mjs";
import { ensureGitRepository, collectReviewContext, resolveReviewTarget, getCurrentBranch } from "./lib/git.mjs";
import { binaryAvailable } from "./lib/process.mjs";
import { loadPromptTemplate, interpolateTemplate } from "./lib/prompts.mjs";
import {
  generateJobId,
  getConfig,
  listJobs,
  setConfig,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
  sortJobsNewestFirst
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob,
  SESSION_ID_ENV
} from "./lib/tracked-jobs.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import {
  renderSetupReport,
  renderTaskResult,
  renderReviewResult,
  renderStatusReport,
  renderJobStatusReport,
  renderStoredJobResult,
  renderCancelReport
} from "./lib/render.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const REVIEW_SCHEMA = path.join(ROOT_DIR, "schemas", "review-output.schema.json");

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/cc-companion.mjs setup [--json] [--enable-review-gate|--disable-review-gate]",
      "  node scripts/cc-companion.mjs task [--background] [--write] [--resume-last|--resume <id>] [--model <model>] [--allowed-tools <tools>] [prompt]",
      "  node scripts/cc-companion.mjs review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch]",
      "  node scripts/cc-companion.mjs adversarial-review [--wait|--background] [--base <ref>] [--scope auto|working-tree|branch>] [focus text]",
      "  node scripts/cc-companion.mjs status [job-id] [--all] [--json]",
      "  node scripts/cc-companion.mjs result [job-id] [--json]",
      "  node scripts/cc-companion.mjs cancel [job-id] [--json]",
      "  node scripts/cc-companion.mjs doctor [--json]"
    ].join("\n")
  );
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(value);
  }
}

function outputCommandResult(payload, rendered, asJson) {
  outputResult(asJson ? payload : rendered, asJson);
}

function normalizeArgv(argv) {
  if (argv.length === 1) {
    const [raw] = argv;
    if (!raw || !raw.trim()) return [];
    return splitRawArgumentString(raw);
  }
  return argv;
}

function parseCommandInput(argv, config = {}) {
  return parseArgs(normalizeArgv(argv), {
    ...config,
    aliasMap: {
      C: "cwd",
      ...(config.aliasMap ?? {})
    }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function resolveCommandWorkspace(options = {}) {
  return resolveWorkspaceRoot(resolveCommandCwd(options));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstMeaningfulLine(text, fallback) {
  const line = String(text ?? "")
    .split(/\r?\n/)
    .map((v) => v.trim())
    .find(Boolean);
  return line ?? fallback;
}

// ──────────────────────────────────────────────────
// setup
// ──────────────────────────────────────────────────

async function buildSetupReport(cwd, actionsTaken = []) {
  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const npmStatus = binaryAvailable("npm", ["--version"], { cwd });
  const claudeStatus = getClaudeCodeAvailability();
  const authStatus = await getClaudeCodeAuthStatus(cwd);

  const nextSteps = [];
  if (!claudeStatus.available) {
    nextSteps.push("Install Claude Code: `npm install -g @anthropic-ai/claude-code`");
  }
  if (claudeStatus.available && !authStatus.loggedIn) {
    nextSteps.push("Run `claude` interactively to complete authentication.");
  }

  return {
    ready: nodeStatus.available && claudeStatus.available && authStatus.loggedIn,
    node: nodeStatus,
    npm: npmStatus,
    claudeCode: claudeStatus,
    auth: authStatus,
    actionsTaken,
    nextSteps
  };
}

async function handleSetup(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json", "enable-review-gate", "disable-review-gate"]
  });

  if (options["enable-review-gate"] && options["disable-review-gate"]) {
    throw new Error("Choose either --enable-review-gate or --disable-review-gate.");
  }

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const actionsTaken = [];

  if (options["enable-review-gate"]) {
    setConfig(workspaceRoot, "stopReviewGate", true);
    actionsTaken.push(`Enabled the stop-time review gate for ${workspaceRoot}.`);
  } else if (options["disable-review-gate"]) {
    setConfig(workspaceRoot, "stopReviewGate", false);
    actionsTaken.push(`Disabled the stop-time review gate for ${workspaceRoot}.`);
  }

  const report = await buildSetupReport(cwd, actionsTaken);
  report.reviewGateEnabled = getConfig(workspaceRoot).stopReviewGate ?? false;
  outputResult(options.json ? report : renderSetupReport(report), options.json);
}

// ──────────────────────────────────────────────────
// task
// ──────────────────────────────────────────────────

function ensureClaudeCodeAvailable() {
  const availability = getClaudeCodeAvailability();
  if (!availability.available) {
    throw new Error("Claude Code CLI is not installed. Install it with `npm install -g @anthropic-ai/claude-code`.");
  }
}

async function executeTaskRun(request) {
  const workspaceRoot = resolveWorkspaceRoot(request.cwd);
  ensureClaudeCodeAvailable();

  let prompt = request.prompt;

  // Check for piped stdin
  if (!prompt) {
    const stdinData = await readStdinIfPiped();
    if (stdinData) prompt = stdinData;
  }

  if (!prompt && !request.resumeSessionId) {
    throw new Error("Provide a prompt, piped stdin, or use --resume.");
  }

  const result = await runClaudeConversation(workspaceRoot, prompt || "Continue from where we left off.", {
    resumeSessionId: request.resumeSessionId,
    model: request.model,
    maxTurns: request.write ? 50 : 10,
    permissionMode: request.write ? "full-auto" : "plan",
    allowedTools: request.allowedTools,
    onProgress: request.onProgress
  });

  const rawOutput = typeof result.result === "string" ? result.result : JSON.stringify(result.result ?? "");
  const failureMessage = result.isError ? rawOutput : "";

  return {
    exitStatus: result.exitCode,
    sessionId: result.sessionId,
    payload: {
      claudeCode: {
        status: result.exitCode,
        stderr: result.stderr,
        stdout: rawOutput,
        sessionId: result.sessionId,
        cost: result.cost,
        duration: result.duration
      }
    },
    rendered: renderTaskResult({ rawOutput, failureMessage }),
    summary: firstMeaningfulLine(rawOutput, "Task completed."),
    jobTitle: "Claude Code Task",
    jobClass: "task"
  };
}

async function handleTask(argv) {
  const { options, positional } = parseCommandInput(argv, {
    valueOptions: ["cwd", "model", "resume", "allowed-tools"],
    booleanOptions: ["background", "write", "resume-last"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const prompt = positional.join(" ");
  const jobId = generateJobId("task");
  const logFile = createJobLogFile(workspaceRoot, jobId, "Claude Code Task");

  let resumeSessionId = null;
  if (options.resume) {
    resumeSessionId = options.resume;
  } else if (options["resume-last"]) {
    // Look for the most recent completed task with a sessionId
    const jobs = sortJobsNewestFirst(listJobs(workspaceRoot));
    const lastTask = jobs.find((j) => j.jobClass === "task" && j.sessionId && j.status === "completed");
    if (lastTask) {
      resumeSessionId = lastTask.sessionId;
    }
  }

  if (!prompt && !resumeSessionId) {
    const stdinData = await readStdinIfPiped();
    if (!stdinData) {
      throw new Error("Provide a prompt, piped stdin, or use --resume / --resume-last.");
    }
  }

  const job = createJobRecord({
    id: jobId,
    workspaceRoot,
    jobClass: "task",
    title: "Claude Code Task",
    summary: prompt ? prompt.slice(0, 120) : "Resuming conversation",
    write: Boolean(options.write),
    sessionId: resumeSessionId
  });

  const progressUpdater = createJobProgressUpdater(workspaceRoot, jobId);
  const progressReporter = createProgressReporter({
    stderr: true,
    logFile,
    onEvent: progressUpdater
  });

  const runner = () => executeTaskRun({
    cwd,
    prompt,
    resumeSessionId,
    model: options.model,
    write: options.write,
    allowedTools: options["allowed-tools"],
    onProgress: progressReporter
  });

  const execution = await runTrackedJob(job, runner, { logFile });
  outputResult(execution.rendered, false);
}

// ──────────────────────────────────────────────────
// review
// ──────────────────────────────────────────────────

function buildAdversarialReviewPrompt(context, focusText) {
  const template = loadPromptTemplate(ROOT_DIR, "adversarial-review");
  return interpolateTemplate(template, {
    REVIEW_KIND: "Adversarial Review",
    TARGET_LABEL: context.target.label,
    USER_FOCUS: focusText || "No extra focus provided.",
    REVIEW_COLLECTION_GUIDANCE: "Focus on bugs, security issues, performance problems, and design flaws.",
    REVIEW_INPUT: context.diff || "(No diff content available)"
  });
}

async function executeReviewRun(request) {
  ensureClaudeCodeAvailable();
  ensureGitRepository(request.cwd);

  const target = resolveReviewTarget(request.cwd, {
    base: request.base,
    scope: request.scope
  });
  const focusText = request.focusText?.trim() ?? "";
  const reviewName = request.reviewName ?? "Review";

  const context = collectReviewContext(request.cwd, target);
  const prompt = buildAdversarialReviewPrompt(context, focusText);

  const result = await runClaudePrompt(context.repoRoot, prompt, {
    model: request.model,
    maxTurns: 5,
    onProgress: request.onProgress
  });

  const rawOutput = typeof result.result === "string" ? result.result : JSON.stringify(result.result ?? "");

  // Try to parse structured review output
  let parsed = null;
  try {
    // Look for JSON block in the output
    const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)```/) || rawOutput.match(/(\{[\s\S]*"verdict"[\s\S]*\})/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    }
  } catch {
    // Not valid JSON, treat as raw text
  }

  const payload = {
    review: reviewName,
    target,
    sessionId: result.sessionId,
    claudeCode: {
      status: result.exitCode,
      stderr: result.stderr,
      stdout: rawOutput
    },
    result: parsed,
    rawOutput
  };

  return {
    exitStatus: result.exitCode,
    sessionId: result.sessionId,
    payload,
    rendered: renderReviewResult({ parsed, rawOutput, parseError: parsed ? null : "No structured JSON found" }, {
      reviewLabel: reviewName,
      targetLabel: context.target.label
    }),
    summary: parsed?.summary ?? firstMeaningfulLine(rawOutput, `${reviewName} completed.`),
    jobTitle: `Claude Code ${reviewName}`,
    jobClass: "review",
    targetLabel: target.label
  };
}

async function handleReview(argv, reviewName = "Review") {
  const { options, positional } = parseCommandInput(argv, {
    valueOptions: ["cwd", "base", "scope", "model"],
    booleanOptions: ["wait", "background"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);
  const focusText = reviewName === "Adversarial Review" ? positional.join(" ") : "";
  const jobId = generateJobId("review");
  const logFile = createJobLogFile(workspaceRoot, jobId, `Claude Code ${reviewName}`);

  const job = createJobRecord({
    id: jobId,
    workspaceRoot,
    jobClass: "review",
    title: `Claude Code ${reviewName}`,
    summary: `Reviewing changes in ${cwd}`
  });

  const progressUpdater = createJobProgressUpdater(workspaceRoot, jobId);
  const progressReporter = createProgressReporter({
    stderr: true,
    logFile,
    onEvent: progressUpdater
  });

  const runner = () => executeReviewRun({
    cwd,
    base: options.base,
    scope: options.scope ?? "auto",
    model: options.model,
    focusText,
    reviewName,
    onProgress: progressReporter
  });

  const execution = await runTrackedJob(job, runner, { logFile });
  outputResult(execution.rendered, false);
}

// ──────────────────────────────────────────────────
// status
// ──────────────────────────────────────────────────

async function handleStatus(argv) {
  const { options, positional } = parseCommandInput(argv, {
    valueOptions: ["cwd", "timeout-ms"],
    booleanOptions: ["all", "json", "wait"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  if (positional.length > 0) {
    // Single job status
    const jobId = positional[0];
    const snapshot = buildSingleJobSnapshot(workspaceRoot, jobId);
    outputCommandResult(snapshot, renderJobStatusReport(snapshot.job), options.json);
    return;
  }

  const report = buildStatusSnapshot(workspaceRoot, { showAll: options.all });
  outputCommandResult(report, renderStatusReport(report), options.json);
}

// ──────────────────────────────────────────────────
// result
// ──────────────────────────────────────────────────

async function handleResult(argv) {
  const { options, positional } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  if (positional.length === 0) {
    throw new Error("Provide a job ID. Use `/cc:status` to list jobs.");
  }

  const jobId = positional[0];
  const result = resolveResultJob(workspaceRoot, jobId);
  outputCommandResult(result, renderStoredJobResult(result.job, result.storedJob), options.json);
}

// ──────────────────────────────────────────────────
// cancel
// ──────────────────────────────────────────────────

async function handleCancel(argv) {
  const { options, positional } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  if (positional.length === 0) {
    throw new Error("Provide a job ID. Use `/cc:status` to list active jobs.");
  }

  const jobId = positional[0];
  const result = resolveCancelableJob(workspaceRoot, jobId);

  if (result.job.status !== "running" && result.job.status !== "queued") {
    throw new Error(`Job ${jobId} is not running (status: ${result.job.status}).`);
  }

  upsertJob(workspaceRoot, { id: jobId, status: "cancelled", phase: "cancelled", completedAt: nowIso() });
  outputCommandResult({ cancelled: jobId }, renderCancelReport({ id: jobId, ...result.job }), options.json);
}

// ──────────────────────────────────────────────────
// doctor
// ──────────────────────────────────────────────────

async function handleDoctor(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveCommandWorkspace(options);

  const nodeStatus = binaryAvailable("node", ["--version"], { cwd });
  const npmStatus = binaryAvailable("npm", ["--version"], { cwd });
  const gitStatus = binaryAvailable("git", ["--version"], { cwd });
  const claudeStatus = getClaudeCodeAvailability();
  const authStatus = await getClaudeCodeAuthStatus(cwd);

  let gitRepo = false;
  let gitBranch = "N/A";
  try {
    ensureGitRepository(cwd);
    gitRepo = true;
    gitBranch = getCurrentBranch(cwd);
  } catch {
    // Not a git repo
  }

  const config = getConfig(workspaceRoot);
  const jobs = listJobs(workspaceRoot);

  const diagnostics = {
    system: {
      node: nodeStatus,
      npm: npmStatus,
      git: gitStatus,
      platform: process.platform,
      arch: process.arch,
      cwd
    },
    claudeCode: {
      available: claudeStatus.available,
      detail: claudeStatus.detail,
      auth: authStatus
    },
    workspace: {
      root: workspaceRoot,
      isGitRepo: gitRepo,
      branch: gitBranch
    },
    plugin: {
      version: "0.2.0",
      reviewGate: config.stopReviewGate ?? false,
      totalJobs: jobs.length,
      runningJobs: jobs.filter((j) => j.status === "running" || j.status === "queued").length
    },
    ready: nodeStatus.available && claudeStatus.available && authStatus.loggedIn,
    warnings: [],
    recommendations: []
  };

  if (!nodeStatus.available) diagnostics.warnings.push("Node.js not found.");
  if (!npmStatus.available) diagnostics.warnings.push("npm not found.");
  if (!claudeStatus.available) {
    diagnostics.warnings.push("Claude Code CLI not installed.");
    diagnostics.recommendations.push("Install: npm install -g @anthropic-ai/claude-code");
  }
  if (claudeStatus.available && !authStatus.loggedIn) {
    diagnostics.warnings.push("Claude Code not authenticated.");
    diagnostics.recommendations.push("Run `claude` interactively to authenticate.");
  }
  if (!gitRepo) diagnostics.warnings.push("Not in a git repository.");

  if (diagnostics.ready) {
    diagnostics.recommendations.push("All checks passed. Plugin is ready to use.");
  }

  const lines = [
    "# CC Plugin Doctor",
    "",
    `Ready: ${diagnostics.ready ? "✅ Yes" : "❌ No"}`,
    "",
    "## System",
    `- Node.js: ${nodeStatus.detail}`,
    `- npm: ${npmStatus.detail}`,
    `- Git: ${gitStatus.detail}`,
    `- Platform: ${process.platform} ${process.arch}`,
    "",
    "## Claude Code",
    `- Available: ${claudeStatus.available ? "Yes" : "No"}`,
    `- Detail: ${claudeStatus.detail}`,
    `- Auth: ${authStatus.detail}`,
    "",
    "## Workspace",
    `- Root: ${workspaceRoot}`,
    `- Git repo: ${gitRepo ? "Yes" : "No"}`,
    `- Branch: ${gitBranch}`,
    "",
    "## Plugin",
    `- Version: ${diagnostics.plugin.version}`,
    `- Review gate: ${diagnostics.plugin.reviewGate ? "enabled" : "disabled"}`,
    `- Total jobs: ${diagnostics.plugin.totalJobs}`,
    `- Running: ${diagnostics.plugin.runningJobs}`
  ];

  if (diagnostics.warnings.length > 0) {
    lines.push("", "## ⚠️ Warnings");
    for (const w of diagnostics.warnings) lines.push(`- ${w}`);
  }

  if (diagnostics.recommendations.length > 0) {
    lines.push("", "## 💡 Recommendations");
    for (const r of diagnostics.recommendations) lines.push(`- ${r}`);
  }

  outputResult(options.json ? diagnostics : `${lines.join("\n").trimEnd()}\n`, options.json);
}

// ──────────────────────────────────────────────────
// Main dispatch
// ──────────────────────────────────────────────────

const [command, ...rest] = process.argv.slice(2);

try {
  switch (command) {
    case "setup":
      await handleSetup(rest);
      break;
    case "task":
      await handleTask(rest);
      break;
    case "review":
      await handleReview(rest, "Review");
      break;
    case "adversarial-review":
      await handleReview(rest, "Adversarial Review");
      break;
    case "status":
      await handleStatus(rest);
      break;
    case "result":
      await handleResult(rest);
      break;
    case "cancel":
      await handleCancel(rest);
      break;
    case "doctor":
      await handleDoctor(rest);
      break;
    default:
      printUsage();
      if (command) {
        console.error(`\nUnknown command: ${command}`);
        process.exit(1);
      }
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
