import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderSetupReport,
  renderTaskResult,
  renderReviewResult,
  renderStatusReport,
  renderCancelReport,
  renderStoredJobResult,
  renderJobStatusReport
} from "../plugins/cc/scripts/lib/render.mjs";

describe("renderSetupReport", () => {
  it("renders a ready report", () => {
    const output = renderSetupReport({
      ready: true,
      node: { detail: "v20.0.0" },
      npm: { detail: "10.0.0" },
      claudeCode: { detail: "1.0.0" },
      auth: { detail: "Authenticated" },
      actionsTaken: [],
      nextSteps: []
    });
    assert.ok(output.includes("Status: ready"));
    assert.ok(output.includes("node: v20.0.0"));
  });

  it("renders a report with next steps", () => {
    const output = renderSetupReport({
      ready: false,
      node: { detail: "v20.0.0" },
      npm: { detail: "10.0.0" },
      claudeCode: { detail: "not found" },
      auth: { detail: "CLI not installed" },
      actionsTaken: [],
      nextSteps: ["Install Claude Code"]
    });
    assert.ok(output.includes("Status: needs attention"));
    assert.ok(output.includes("Next steps:"));
    assert.ok(output.includes("Install Claude Code"));
  });
});

describe("renderTaskResult", () => {
  it("renders raw output", () => {
    const output = renderTaskResult({ rawOutput: "Hello world\n" });
    assert.equal(output, "Hello world\n");
  });

  it("renders failure message", () => {
    const output = renderTaskResult({ failureMessage: "Something went wrong" });
    assert.ok(output.includes("Something went wrong"));
  });

  it("renders fallback message", () => {
    const output = renderTaskResult({});
    assert.ok(output.includes("did not return"));
  });
});

describe("renderReviewResult", () => {
  it("renders a structured review", () => {
    const output = renderReviewResult(
      {
        parsed: {
          verdict: "request-changes",
          summary: "Found issues",
          findings: [
            { severity: "high", title: "Bug", body: "A bug", file: "test.js", line_start: 10 }
          ],
          next_steps: ["Fix the bug"]
        },
        rawOutput: "",
        parseError: null
      },
      { reviewLabel: "Review", targetLabel: "Working tree" }
    );
    assert.ok(output.includes("request-changes"));
    assert.ok(output.includes("Found issues"));
    assert.ok(output.includes("[high] Bug"));
    assert.ok(output.includes("Fix the bug"));
  });

  it("renders parse error", () => {
    const output = renderReviewResult(
      { parsed: null, rawOutput: "raw text", parseError: "No JSON" },
      { reviewLabel: "Review", targetLabel: "Working tree" }
    );
    assert.ok(output.includes("Parse error"));
    assert.ok(output.includes("raw text"));
  });
});

describe("renderCancelReport", () => {
  it("renders cancel info", () => {
    const output = renderCancelReport({ id: "job-123", title: "Test Task" });
    assert.ok(output.includes("Cancelled job-123"));
    assert.ok(output.includes("Test Task"));
  });
});

describe("renderStatusReport", () => {
  it("renders empty status", () => {
    const output = renderStatusReport({
      running: [],
      latestFinished: null,
      recent: [],
      config: {}
    });
    assert.ok(output.includes("No jobs recorded yet"));
  });

  it("renders running jobs", () => {
    const output = renderStatusReport({
      running: [
        { id: "job-1", kindLabel: "task", status: "running", phase: "running", elapsed: "5s", summary: "Test" }
      ],
      latestFinished: null,
      recent: [],
      config: {}
    });
    assert.ok(output.includes("Active jobs"));
    assert.ok(output.includes("job-1"));
  });
});
