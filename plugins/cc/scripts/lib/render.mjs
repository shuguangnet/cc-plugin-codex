/**
 * Output rendering for cc-plugin-codex commands.
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

export function renderTaskResult(parsedResult) {
  const rawOutput = typeof parsedResult?.rawOutput === "string" ? parsedResult.rawOutput : "";
  if (rawOutput) return rawOutput.endsWith("\n") ? rawOutput : `${rawOutput}\n`;

  const message = String(parsedResult?.failureMessage ?? "").trim() || "Claude Code did not return a final message.";
  return `${message}\n`;
}

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

function esc(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}
