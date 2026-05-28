/**
 * Output rendering for cc-plugin-codex commands.
 * Each function takes structured data and returns a Markdown-formatted string
 * suitable for display in Claude Code's output.
 */

/**
 * Render a setup report showing system checks and next steps.
 *
 * @param {object} report - Setup report data
 * @param {boolean} report.ready - Whether the setup is fully ready
 * @param {{ detail: string }} report.node - Node.js availability check
 * @param {{ detail: string }} report.npm - npm availability check
 * @param {{ detail: string }} report.claudeCode - Claude Code CLI check
 * @param {{ detail: string }} report.auth - Authentication status check
 * @param {boolean} [report.reviewGateEnabled] - Whether the stop-time review gate is enabled
 * @param {string[]} report.actionsTaken - List of actions performed during setup
 * @param {string[]} report.nextSteps - Recommended next steps
 * @returns {string} Markdown-formatted setup report
 */
export function renderSetupReport(report) {
  const lines = [
    "# Claude Code Setup",
    "",
    `Status: ${report.ready ? "ready" : "needs attention"}`,
    "",
    "Checks:",
    `- node: ${report.node.detail}`,
    `- npm: ${report.npm.detail}`,
    `- claude code: ${report.claudeCode.detail}`,
    `- auth: ${report.auth.detail}`,
    `- review gate: ${report.reviewGateEnabled ? "enabled" : "disabled"}`,
    ""
  ];

  if (report.actionsTaken.length > 0) {
    lines.push("Actions taken:");
    for (const action of report.actionsTaken) lines.push(`- ${action}`);
    lines.push("");
  }

  if (report.nextSteps.length > 0) {
    lines.push("Next steps:");
    for (const step of report.nextSteps) lines.push(`- ${step}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render the result of a Claude Code task execution.
 * Prefers raw output if available; otherwise shows the failure message or a fallback.
 *
 * @param {object} parsedResult - Task result data
 * @param {string} [parsedResult.rawOutput] - Raw stdout from Claude Code
 * @param {string} [parsedResult.failureMessage] - Error message if the task failed
 * @returns {string} Formatted task result string
 */
export function renderTaskResult(parsedResult) {
  const rawOutput = typeof parsedResult?.rawOutput === "string" ? parsedResult.rawOutput : "";
  if (rawOutput) return rawOutput.endsWith("\n") ? rawOutput : `${rawOutput}\n`;

  const message = String(parsedResult?.failureMessage ?? "").trim() || "Claude Code did not return a final message.";
  return `${message}\n`;
}

/**
 * Render a structured code review result.
 * Shows verdict, summary, findings with severity levels, and next steps.
 * Falls back to a parse-error display when structured parsing fails.
 *
 * @param {object} parsedResult - Review result data
 * @param {object|null} parsedResult.parsed - Parsed review JSON, or null if parsing failed
 * @param {string} [parsedResult.parsed.verdict] - Review verdict (e.g. "approve", "request-changes")
 * @param {string} [parsedResult.parsed.summary] - Review summary text
 * @param {Array<{severity?: string, title?: string, body?: string, file?: string, line_start?: number, line_end?: number, recommendation?: string}>} [parsedResult.parsed.findings] - List of review findings
 * @param {string[]} [parsedResult.parsed.next_steps] - Recommended follow-up actions
 * @param {string} [parsedResult.rawOutput] - Raw Claude Code output
 * @param {string|null} [parsedResult.parseError] - Error message from JSON parsing
 * @param {object} [meta] - Display metadata
 * @param {string} [meta.reviewLabel] - Label for the review type (e.g. "Review", "Adversarial Review")
 * @param {string} [meta.targetLabel] - Label for the review target (e.g. "Working tree changes")
 * @returns {string} Markdown-formatted review report
 */
export function renderReviewResult(parsedResult, meta) {
  const { parsed, rawOutput, parseError } = parsedResult;
  const reviewLabel = meta?.reviewLabel ?? "Review";
  const targetLabel = meta?.targetLabel ?? "unknown";

  if (!parsed) {
    const lines = [
      `# Claude Code ${reviewLabel}`,
      "",
      `Target: ${targetLabel}`,
      "",
      `Parse error: ${parseError}`,
      ""
    ];
    if (rawOutput) {
      lines.push("Raw output:", "", "```text", rawOutput, "```");
    }
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const lines = [
    `# Claude Code ${reviewLabel}`,
    "",
    `Target: ${targetLabel}`,
    `Verdict: ${parsed.verdict ?? "unknown"}`,
    "",
    parsed.summary ?? "",
    ""
  ];

  if (Array.isArray(parsed.findings) && parsed.findings.length > 0) {
    lines.push("Findings:");
    for (const f of parsed.findings) {
      const severity = f.severity ?? "low";
      const file = f.file ?? "unknown";
      const lineRange = f.line_start ? (f.line_end ? `:${f.line_start}-${f.line_end}` : `:${f.line_start}`) : "";
      lines.push(`- [${severity}] ${f.title ?? "Finding"} (${file}${lineRange})`);
      if (f.body) lines.push(`  ${f.body}`);
      if (f.recommendation) lines.push(`  Recommendation: ${f.recommendation}`);
    }
  } else {
    lines.push("No material findings.");
  }

  if (Array.isArray(parsed.next_steps) && parsed.next_steps.length > 0) {
    lines.push("", "Next steps:");
    for (const step of parsed.next_steps) lines.push(`- ${step}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render the overall status report showing active, latest finished, and recent jobs.
 * Displays a table of running jobs with cancel actions, and detail lists for finished jobs.
 *
 * @param {object} report - Status snapshot
 * @param {Array<object>} report.running - Currently running or queued jobs
 * @param {object|null} report.latestFinished - Most recently completed/failed job
 * @param {Array<object>} report.recent - Other recent finished jobs
 * @returns {string} Markdown-formatted status report
 */
export function renderStatusReport(report) {
  const lines = ["# Claude Code Status", ""];

  if (report.running.length > 0) {
    lines.push("Active jobs:");
    lines.push("| Job | Kind | Status | Phase | Elapsed | Summary | Actions |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const job of report.running) {
      const actions = [`/cc:status ${job.id}`, `/cc:cancel ${job.id}`];
      lines.push(
        `| ${esc(job.id)} | ${esc(job.kindLabel)} | ${esc(job.status)} | ${esc(job.phase ?? "")} | ${esc(job.elapsed ?? "")} | ${esc(job.summary ?? "")} | ${actions.map((a) => `\`${a}\``).join(" ")} |`
      );
    }
    lines.push("");
  }

  if (report.latestFinished) {
    const j = report.latestFinished;
    lines.push("Latest finished:");
    pushJobDetails(lines, j, { showDuration: true, showResultHint: true });
    lines.push("");
  }

  if (report.recent.length > 0) {
    lines.push("Recent jobs:");
    for (const j of report.recent) pushJobDetails(lines, j, { showDuration: true });
    lines.push("");
  } else if (report.running.length === 0 && !report.latestFinished) {
    lines.push("No jobs recorded yet.", "");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render a detailed status report for a single job.
 * Shows elapsed time for running jobs, duration for completed jobs,
 * and contextual action hints (cancel for running, result for finished).
 *
 * @param {object} job - Enriched job record with elapsed/duration/computed fields
 * @param {string} job.id - Job identifier
 * @param {string} job.status - Job status ("running", "queued", "completed", "failed", "cancelled")
 * @param {string} [job.kindLabel] - Display label for job type (e.g. "task", "review")
 * @param {string} [job.title] - Human-readable job title
 * @param {string} [job.elapsed] - Elapsed time for running jobs
 * @param {string} [job.duration] - Duration for completed jobs
 * @param {string} [job.sessionId] - Claude Code session ID
 * @param {string} [job.summary] - Brief job summary
 * @returns {string} Markdown-formatted job status report
 */
export function renderJobStatusReport(job) {
  const lines = ["# Claude Code Job Status", ""];
  pushJobDetails(lines, job, {
    showElapsed: job.status === "running" || job.status === "queued",
    showDuration: job.status !== "running" && job.status !== "queued",
    showResultHint: true,
    showCancelHint: true
  });
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render the stored result data for a completed job.
 * Prefers raw Claude Code stdout from the stored job file; falls back to
 * rendered output, then to a structured summary with metadata.
 *
 * @param {object|null} job - Job record from state (may be null)
 * @param {object|null} storedJob - Full stored job data from disk (may be null)
 * @param {string} [storedJob.sessionId] - Claude Code session ID
 * @param {object} [storedJob.result] - Result payload
 * @param {object} [storedJob.result.claudeCode] - Claude Code specific result data
 * @param {string} [storedJob.result.claudeCode.stdout] - Raw stdout from Claude Code
 * @param {string} [storedJob.rendered] - Pre-rendered output string
 * @returns {string} Formatted job result string
 */
export function renderStoredJobResult(job, storedJob) {
  const sessionId = storedJob?.sessionId ?? job?.sessionId ?? null;
  const rawOutput = storedJob?.result?.claudeCode?.stdout ?? storedJob?.rendered ?? "";

  if (rawOutput) {
    const output = rawOutput.endsWith("\n") ? rawOutput : `${rawOutput}\n`;
    return sessionId ? `${output}\nClaude Code session: ${sessionId}\n` : output;
  }

  const lines = [
    `# ${job?.title ?? "Claude Code Result"}`,
    "",
    `Job: ${job?.id}`,
    `Status: ${job?.status}`
  ];
  if (sessionId) lines.push(`Session: ${sessionId}`);
  if (job?.summary) lines.push(`Summary: ${job.summary}`);
  if (job?.errorMessage) lines.push("", job.errorMessage);
  else lines.push("", "No result payload stored for this job.");

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render a cancellation confirmation report for a job.
 *
 * @param {object} job - The cancelled job record
 * @param {string} job.id - Job identifier
 * @param {string} [job.title] - Human-readable job title
 * @param {string} [job.summary] - Brief job summary
 * @returns {string} Markdown-formatted cancel report
 */
export function renderCancelReport(job) {
  const lines = [
    "# Claude Code Cancel",
    "",
    `Cancelled ${job.id}.`,
    ""
  ];
  if (job.title) lines.push(`- Title: ${job.title}`);
  if (job.summary) lines.push(`- Summary: ${job.summary}`);
  lines.push("- Check `/cc:status` for the updated queue.");
  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render a comprehensive doctor diagnostic report.
 * Shows system info, Claude Code status, workspace details, plugin status,
 * along with any warnings and recommendations.
 *
 * @param {object} diag - Diagnostic data
 * @param {boolean} diag.ready - Whether everything is set up correctly
 * @param {object} diag.system - System diagnostics
 * @param {{ available: boolean, detail: string }} diag.system.node - Node.js check
 * @param {{ available: boolean, detail: string }} diag.system.npm - npm check
 * @param {{ available: boolean, detail: string }} diag.system.git - Git check
 * @param {string} diag.system.platform - OS platform
 * @param {string} diag.system.arch - CPU architecture
 * @param {object} diag.claudeCode - Claude Code diagnostics
 * @param {boolean} diag.claudeCode.available - Whether CLI is installed
 * @param {string} diag.claudeCode.detail - Version or error detail
 * @param {{ loggedIn: boolean, detail: string }} diag.claudeCode.auth - Auth status
 * @param {object} diag.workspace - Workspace diagnostics
 * @param {string} diag.workspace.root - Resolved workspace root path
 * @param {boolean} diag.workspace.isGitRepo - Whether inside a git repo
 * @param {string} diag.workspace.branch - Current git branch
 * @param {object} diag.plugin - Plugin diagnostics
 * @param {string} diag.plugin.version - Plugin version
 * @param {boolean} diag.plugin.reviewGate - Whether review gate is enabled
 * @param {number} diag.plugin.totalJobs - Total recorded jobs
 * @param {number} diag.plugin.runningJobs - Currently running jobs
 * @param {string[]} diag.warnings - List of warning messages
 * @param {string[]} diag.recommendations - List of recommendation messages
 * @returns {string} Markdown-formatted doctor report
 */
export function renderDoctorReport(diag) {
  const lines = [
    "# CC Plugin Doctor",
    "",
    `Ready: ${diag.ready ? "✅ Yes" : "❌ No"}`,
    "",
    "## System",
    `- Node.js: ${diag.system.node.detail}`,
    `- npm: ${diag.system.npm.detail}`,
    `- Git: ${diag.system.git.detail}`,
    `- Platform: ${diag.system.platform} ${diag.system.arch}`,
    "",
    "## Claude Code",
    `- Available: ${diag.claudeCode.available ? "Yes" : "No"}`,
    `- Detail: ${diag.claudeCode.detail}`,
    `- Auth: ${diag.claudeCode.auth.detail}`,
    "",
    "## Workspace",
    `- Root: ${diag.workspace.root}`,
    `- Git repo: ${diag.workspace.isGitRepo ? "Yes" : "No"}`,
    `- Branch: ${diag.workspace.branch}`,
    "",
    "## Plugin",
    `- Version: ${diag.plugin.version}`,
    `- Review gate: ${diag.plugin.reviewGate ? "enabled" : "disabled"}`,
    `- Total jobs: ${diag.plugin.totalJobs}`,
    `- Running: ${diag.plugin.runningJobs}`
  ];

  if (diag.warnings.length > 0) {
    lines.push("", "## ⚠️ Warnings");
    for (const w of diag.warnings) lines.push(`- ${w}`);
  }

  if (diag.recommendations.length > 0) {
    lines.push("", "## 💡 Recommendations");
    for (const r of diag.recommendations) lines.push(`- ${r}`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Append job detail lines to a lines array for display.
 * Includes job ID, status, kind, title, and optionally elapsed/duration/session/hints.
 *
 * @param {string[]} lines - Array to push lines into (mutated)
 * @param {object} job - Job record to display
 * @param {object} [options={}] - Display options
 * @param {boolean} [options.showElapsed=false] - Show elapsed time (for running jobs)
 * @param {boolean} [options.showDuration=false] - Show total duration (for completed jobs)
 * @param {boolean} [options.showResultHint=false] - Show the /cc:result hint
 * @param {boolean} [options.showCancelHint=false] - Show the /cc:cancel hint
 */
function pushJobDetails(lines, job, options = {}) {
  const parts = [job.id, job.status ?? "unknown"];
  if (job.kindLabel) parts.push(job.kindLabel);
  if (job.title) parts.push(job.title);
  lines.push(`- ${parts.join(" | ")}`);
  if (job.summary) lines.push(`  Summary: ${job.summary}`);
  if (options.showElapsed && job.elapsed) lines.push(`  Elapsed: ${job.elapsed}`);
  if (options.showDuration && job.duration) lines.push(`  Duration: ${job.duration}`);
  if (job.sessionId) lines.push(`  Session: ${job.sessionId}`);
  if (options.showCancelHint && (job.status === "running" || job.status === "queued")) {
    lines.push(`  Cancel: /cc:cancel ${job.id}`);
  }
  if (options.showResultHint && job.status !== "running" && job.status !== "queued") {
    lines.push(`  Result: /cc:result ${job.id}`);
  }
}

/**
 * Escape a value for safe inclusion in a Markdown table cell.
 * Escapes pipe characters and replaces newlines with spaces.
 *
 * @param {*} value - Value to escape (coerced to string)
 * @returns {string} Escaped string safe for table cells
 */
function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
