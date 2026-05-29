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

  it("renders parse error without raw output", () => {
    const output = renderReviewResult(
      { parsed: null, rawOutput: "", parseError: "Empty response" },
      { reviewLabel: "Review", targetLabel: "Branch" }
    );
    assert.ok(output.includes("Parse error: Empty response"));
    assert.ok(!output.includes("Raw output:"));
  });

  it("renders findings with line range", () => {
    const output = renderReviewResult(
      {
        parsed: {
          verdict: "approve",
          summary: "Looks good",
          findings: [
            { severity: "low", title: "Style", file: "app.js", line_start: 5, line_end: 10, recommendation: "Use const" }
          ]
        },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("[low] Style (app.js:5-10)"));
    assert.ok(output.includes("Recommendation: Use const"));
  });

  it("renders findings with only line_start", () => {
    const output = renderReviewResult(
      {
        parsed: {
          verdict: "request-changes",
          summary: "Issues",
          findings: [
            { severity: "medium", title: "Issue", file: "lib.mjs", line_start: 42 }
          ]
        },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("[medium] Issue (lib.mjs:42)"));
  });

  it("renders no material findings for empty findings array", () => {
    const output = renderReviewResult(
      {
        parsed: { verdict: "approve", summary: "All clear", findings: [] },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("No material findings."));
  });

  it("renders no material findings when findings is missing", () => {
    const output = renderReviewResult(
      {
        parsed: { verdict: "approve", summary: "All clear" },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("No material findings."));
  });

  it("renders next steps without findings", () => {
    const output = renderReviewResult(
      {
        parsed: { verdict: "approve", summary: "OK", next_steps: ["Deploy", "Monitor"] },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("Next steps:"));
    assert.ok(output.includes("- Deploy"));
    assert.ok(output.includes("- Monitor"));
  });

  it("uses default severity and title for findings", () => {
    const output = renderReviewResult(
      {
        parsed: {
          findings: [{ file: "a.js" }]
        },
        rawOutput: ""
      },
      {}
    );
    assert.ok(output.includes("[low] Finding (a.js)"));
  });

  it("uses defaults for missing meta", () => {
    const output = renderReviewResult(
      { parsed: { verdict: "approve" }, rawOutput: "" },
      undefined
    );
    assert.ok(output.includes("# Claude Code Review"));
    assert.ok(output.includes("Target: unknown"));
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

  it("renders latest finished job", () => {
    const output = renderStatusReport({
      running: [],
      latestFinished: {
        id: "job-done",
        status: "completed",
        kindLabel: "task",
        title: "Done Task",
        duration: "1m 30s",
        summary: "All done"
      },
      recent: [],
      config: {}
    });
    assert.ok(output.includes("Latest finished:"));
    assert.ok(output.includes("job-done"));
    assert.ok(output.includes("Done Task"));
    assert.ok(!output.includes("No jobs recorded yet"));
  });

  it("renders recent jobs", () => {
    const output = renderStatusReport({
      running: [],
      latestFinished: null,
      recent: [
        { id: "job-a", status: "completed", kindLabel: "task", duration: "10s" },
        { id: "job-b", status: "failed", kindLabel: "review", summary: "Review done" }
      ],
      config: {}
    });
    assert.ok(output.includes("Recent jobs:"));
    assert.ok(output.includes("job-a"));
    assert.ok(output.includes("job-b"));
  });

  it("renders all sections together", () => {
    const output = renderStatusReport({
      running: [
        { id: "job-active", kindLabel: "task", status: "running", phase: "executing", elapsed: "2m" }
      ],
      latestFinished: {
        id: "job-latest",
        status: "completed",
        kindLabel: "review",
        duration: "3m 15s"
      },
      recent: [
        { id: "job-old", status: "failed", kindLabel: "task" }
      ],
      config: {}
    });
    assert.ok(output.includes("Active jobs:"));
    assert.ok(output.includes("job-active"));
    assert.ok(output.includes("Latest finished:"));
    assert.ok(output.includes("job-latest"));
    assert.ok(output.includes("Recent jobs:"));
    assert.ok(output.includes("job-old"));
  });

  it("renders table header for running jobs", () => {
    const output = renderStatusReport({
      running: [
        { id: "j-1", kindLabel: "task", status: "running", summary: "Work" }
      ],
      latestFinished: null,
      recent: [],
      config: {}
    });
    assert.ok(output.includes("| Job | Kind | Status | Phase |"));
  });
});

describe("renderJobStatusReport", () => {
  it("renders running job with elapsed time and cancel hint", () => {
    const job = {
      id: "job-100",
      status: "running",
      kindLabel: "task",
      title: "My Task",
      elapsed: "30s",
      summary: "Working on it"
    };
    const output = renderJobStatusReport(job);
    assert.ok(output.includes("# Claude Code Job Status"));
    assert.ok(output.includes("job-100"));
    assert.ok(output.includes("running"));
    assert.ok(output.includes("My Task"));
    assert.ok(output.includes("Elapsed: 30s"));
    assert.ok(output.includes("/cc:cancel job-100"));
    // Should not show result hint for running jobs
    assert.ok(!output.includes("/cc:result job-100"));
  });

  it("renders completed job with duration and result hint", () => {
    const job = {
      id: "job-200",
      status: "completed",
      kindLabel: "task",
      title: "Done Task",
      duration: "2m 15s",
      sessionId: "sess-abc"
    };
    const output = renderJobStatusReport(job);
    assert.ok(output.includes("job-200"));
    assert.ok(output.includes("completed"));
    assert.ok(output.includes("Done Task"));
    assert.ok(output.includes("Duration: 2m 15s"));
    assert.ok(output.includes("Session: sess-abc"));
    assert.ok(output.includes("/cc:result job-200"));
    // Should not show cancel hint for completed jobs
    assert.ok(!output.includes("/cc:cancel job-200"));
  });

  it("renders queued job with cancel hint", () => {
    const job = { id: "job-300", status: "queued", kindLabel: "review" };
    const output = renderJobStatusReport(job);
    assert.ok(output.includes("queued"));
    assert.ok(output.includes("review"));
    assert.ok(output.includes("/cc:cancel job-300"));
  });

  it("renders failed job with result hint", () => {
    const job = { id: "job-400", status: "failed", summary: "Error occurred" };
    const output = renderJobStatusReport(job);
    assert.ok(output.includes("failed"));
    assert.ok(output.includes("Summary: Error occurred"));
    assert.ok(output.includes("/cc:result job-400"));
  });
});

describe("renderStoredJobResult", () => {
  it("renders raw output from stored job stdout", () => {
    const job = { id: "job-10" };
    const storedJob = {
      sessionId: "sess-1",
      result: { claudeCode: { stdout: "Hello from Claude\n" } }
    };
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("Hello from Claude"));
    assert.ok(output.includes("Claude Code session: sess-1"));
  });

  it("renders raw output without session when no sessionId", () => {
    const job = { id: "job-11" };
    const storedJob = {
      result: { claudeCode: { stdout: "Result text\n" } }
    };
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("Result text"));
    assert.ok(!output.includes("Claude Code session"));
  });

  it("falls back to storedJob.rendered when no stdout", () => {
    const job = { id: "job-12" };
    const storedJob = { rendered: "Rendered content\n" };
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("Rendered content"));
  });

  it("renders structured fallback when no raw output", () => {
    const job = { id: "job-20", title: "My Review", status: "completed", summary: "All good" };
    const storedJob = { sessionId: "sess-2" };
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("# My Review"));
    assert.ok(output.includes("Job: job-20"));
    assert.ok(output.includes("Status: completed"));
    assert.ok(output.includes("Session: sess-2"));
    assert.ok(output.includes("Summary: All good"));
  });

  it("shows error message when present", () => {
    const job = { id: "job-21", title: "Failed Task", status: "failed", errorMessage: "Process crashed" };
    const storedJob = {};
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("Process crashed"));
  });

  it("shows no result message when no payload and no error", () => {
    const job = { id: "job-22", status: "completed" };
    const storedJob = null;
    const output = renderStoredJobResult(job, storedJob);
    assert.ok(output.includes("No result payload stored"));
  });

  it("handles null job and storedJob gracefully", () => {
    const output = renderStoredJobResult(null, null);
    assert.ok(output.includes("# Claude Code Result"));
    assert.ok(output.includes("No result payload stored"));
  });
});
