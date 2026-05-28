import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderDoctorReport } from "../plugins/cc/scripts/lib/render.mjs";

describe("renderDoctorReport", () => {
  const readyDiag = {
    ready: true,
    system: {
      node: { available: true, detail: "v20.19.2" },
      npm: { available: true, detail: "10.8.2" },
      git: { available: true, detail: "git version 2.39.0" },
      platform: "linux",
      arch: "x64"
    },
    claudeCode: {
      available: true,
      detail: "@anthropic-ai/claude-code 1.0.0",
      auth: { loggedIn: true, detail: "Authenticated" }
    },
    workspace: {
      root: "/home/user/project",
      isGitRepo: true,
      branch: "main"
    },
    plugin: {
      version: "0.2.0",
      reviewGate: false,
      totalJobs: 5,
      runningJobs: 1
    },
    warnings: [],
    recommendations: ["All checks passed. Plugin is ready to use."]
  };

  it("renders a ready report with all checks passed", () => {
    const output = renderDoctorReport(readyDiag);
    assert.ok(output.includes("Ready: ✅ Yes"));
    assert.ok(output.includes("Node.js: v20.19.2"));
    assert.ok(output.includes("npm: 10.8.2"));
    assert.ok(output.includes("Git: git version 2.39.0"));
    assert.ok(output.includes("Platform: linux x64"));
    assert.ok(output.includes("Available: Yes"));
    assert.ok(output.includes("Git repo: Yes"));
    assert.ok(output.includes("Branch: main"));
    assert.ok(output.includes("Version: 0.2.0"));
    assert.ok(output.includes("Review gate: disabled"));
    assert.ok(output.includes("Total jobs: 5"));
    assert.ok(output.includes("Running: 1"));
    assert.ok(output.includes("All checks passed"));
  });

  it("renders warnings and recommendations for not-ready state", () => {
    const notReadyDiag = {
      ...readyDiag,
      ready: false,
      claudeCode: {
        available: false,
        detail: "not found",
        auth: { loggedIn: false, detail: "Not authenticated" }
      },
      warnings: [
        "Claude Code CLI not installed.",
        "Claude Code not authenticated."
      ],
      recommendations: [
        "Install: npm install -g @anthropic-ai/claude-code",
        "Run `claude` interactively to authenticate."
      ]
    };
    const output = renderDoctorReport(notReadyDiag);
    assert.ok(output.includes("Ready: ❌ No"));
    assert.ok(output.includes("Available: No"));
    assert.ok(output.includes("Claude Code CLI not installed."));
    assert.ok(output.includes("Claude Code not authenticated."));
    assert.ok(output.includes("npm install -g @anthropic-ai/claude-code"));
  });

  it("renders review gate as enabled when configured", () => {
    const diag = { ...readyDiag, plugin: { ...readyDiag.plugin, reviewGate: true } };
    const output = renderDoctorReport(diag);
    assert.ok(output.includes("Review gate: enabled"));
  });

  it("renders git repo as No when not in repo", () => {
    const diag = {
      ...readyDiag,
      workspace: { ...readyDiag.workspace, isGitRepo: false, branch: "N/A" }
    };
    const output = renderDoctorReport(diag);
    assert.ok(output.includes("Git repo: No"));
    assert.ok(output.includes("Branch: N/A"));
  });

  it("does not include warnings section when warnings is empty", () => {
    const output = renderDoctorReport(readyDiag);
    assert.ok(!output.includes("Warnings"));
  });

  it("includes recommendations section when present", () => {
    const output = renderDoctorReport(readyDiag);
    assert.ok(output.includes("Recommendations"));
  });
});
