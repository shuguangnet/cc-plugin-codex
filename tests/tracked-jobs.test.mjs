import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  nowIso,
  createJobRecord,
  createJobProgressUpdater,
  appendLogLine,
  appendLogBlock,
  createJobLogFile,
  runTrackedJob
} from "../plugins/cc/scripts/lib/tracked-jobs.mjs";
import { loadState, resolveJobFile, resolveJobLogFile } from "../plugins/cc/scripts/lib/state.mjs";

let testDir;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-tj-"));
  fs.mkdirSync(path.join(testDir, ".git"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("tracked-jobs", () => {
  it("nowIso returns ISO date string", () => {
    const iso = nowIso();
    assert.ok(iso.endsWith("Z"));
    assert.ok(!isNaN(Date.parse(iso)));
  });

  it("createJobRecord adds createdAt", () => {
    const record = createJobRecord({ id: "job-1", status: "running" });
    assert.equal(record.id, "job-1");
    assert.equal(record.status, "running");
    assert.ok(record.createdAt);
    assert.ok(record.createdAt.endsWith("Z"));
  });

  it("createJobRecord includes sessionId from env", () => {
    const record = createJobRecord(
      { id: "job-1" },
      { env: { CLAUDE_SESSION_ID: "sess-123" } }
    );
    assert.equal(record.sessionId, "sess-123");
  });

  it("createJobRecord with custom sessionIdEnv", () => {
    const record = createJobRecord(
      { id: "job-1" },
      { env: { MY_SESSION: "sess-456" }, sessionIdEnv: "MY_SESSION" }
    );
    assert.equal(record.sessionId, "sess-456");
  });

  it("createJobRecord without sessionId", () => {
    const record = createJobRecord({ id: "job-1" }, { env: {} });
    assert.equal(record.sessionId, undefined);
  });

  it("appendLogLine writes timestamped message", () => {
    const logFile = path.join(testDir, "test.log");
    fs.writeFileSync(logFile, "", "utf8");
    appendLogLine(logFile, "test message");
    const content = fs.readFileSync(logFile, "utf8");
    assert.ok(content.includes("test message"));
    assert.ok(content.includes("]"));
  });

  it("appendLogLine ignores empty message", () => {
    const logFile = path.join(testDir, "test.log");
    fs.writeFileSync(logFile, "", "utf8");
    appendLogLine(logFile, "");
    assert.equal(fs.readFileSync(logFile, "utf8"), "");
  });

  it("appendLogBlock writes block with title and body", () => {
    const logFile = path.join(testDir, "test.log");
    fs.writeFileSync(logFile, "", "utf8");
    appendLogBlock(logFile, "Output", "line1\nline2");
    const content = fs.readFileSync(logFile, "utf8");
    assert.ok(content.includes("Output"));
    assert.ok(content.includes("line1\nline2"));
  });

  it("createJobLogFile creates empty log file", () => {
    const logFile = createJobLogFile(testDir, "job-1", "Test Job");
    assert.ok(fs.existsSync(logFile));
    const content = fs.readFileSync(logFile, "utf8");
    assert.ok(content.includes("Starting Test Job"));
  });

  it("createJobProgressUpdater tracks phase changes", () => {
    const update = createJobProgressUpdater(testDir, "job-1");
    // Should not throw
    update({ message: "starting", phase: "initializing" });
    update({ message: "working", phase: "executing" });
    // Same phase again should be a no-op (no upsert)
    update({ message: "still working", phase: "executing" });
  });

  it("createJobProgressUpdater tracks sessionId", () => {
    const update = createJobProgressUpdater(testDir, "job-2");
    update({ message: "connected", sessionId: "sess-abc" });
    update({ message: "still connected", sessionId: "sess-abc" }); // no-op
    update({ message: "reconnected", sessionId: "sess-def" }); // changed
  });

  it("createJobProgressUpdater ignores events without changes", () => {
    const update = createJobProgressUpdater(testDir, "job-3");
    // Empty event should not throw
    update({});
    update({ message: "hello" });
    update(null);
    update(undefined);
  });
});

import { createProgressReporter } from "../plugins/cc/scripts/lib/tracked-jobs.mjs";

describe("createProgressReporter", () => {
  it("returns null when no outputs configured", () => {
    const reporter = createProgressReporter({});
    assert.equal(reporter, null);
  });

  it("returns a function when stderr is true", () => {
    const reporter = createProgressReporter({ stderr: true });
    assert.equal(typeof reporter, "function");
  });

  it("returns a function when logFile is provided", () => {
    const logFile = path.join(testDir, "progress.log");
    fs.writeFileSync(logFile, "", "utf8");
    const reporter = createProgressReporter({ logFile });
    assert.equal(typeof reporter, "function");
  });

  it("returns a function when onEvent is provided", () => {
    const events = [];
    const reporter = createProgressReporter({ onEvent: (e) => events.push(e) });
    assert.equal(typeof reporter, "function");
  });

  it("calls onEvent callback with normalized event", () => {
    const events = [];
    const reporter = createProgressReporter({ onEvent: (e) => events.push(e) });
    reporter({ message: "hello", phase: "running" });
    assert.equal(events.length, 1);
    assert.equal(events[0].message, "hello");
    assert.equal(events[0].phase, "running");
  });

  it("normalizes string input to event object", () => {
    const events = [];
    const reporter = createProgressReporter({ onEvent: (e) => events.push(e) });
    reporter("plain message");
    assert.equal(events.length, 1);
    assert.equal(events[0].message, "plain message");
    assert.equal(events[0].phase, null);
  });

  it("writes to log file", () => {
    const logFile = path.join(testDir, "progress2.log");
    fs.writeFileSync(logFile, "", "utf8");
    const reporter = createProgressReporter({ logFile });
    reporter({ message: "log this" });
    const content = fs.readFileSync(logFile, "utf8");
    assert.ok(content.includes("log this"));
  });

  it("handles null/undefined input gracefully", () => {
    const events = [];
    const reporter = createProgressReporter({ onEvent: (e) => events.push(e) });
    reporter(null);
    reporter(undefined);
    assert.equal(events.length, 2);
    assert.equal(events[0].message, "");
    assert.equal(events[1].message, "");
  });
});

describe("runTrackedJob validation", () => {
  it("throws when job is null", async () => {
    await assert.rejects(
      () => runTrackedJob(null, async () => ({})),
      /runTrackedJob requires a job object/
    );
  });

  it("throws when job is undefined", async () => {
    await assert.rejects(
      () => runTrackedJob(undefined, async () => ({})),
      /runTrackedJob requires a job object/
    );
  });

  it("throws when job is not an object", async () => {
    await assert.rejects(
      () => runTrackedJob("not-an-object", async () => ({})),
      /runTrackedJob requires a job object/
    );
  });

  it("throws when job.id is missing", async () => {
    await assert.rejects(
      () => runTrackedJob({ workspaceRoot: "/tmp" }, async () => ({})),
      /runTrackedJob requires job.id/
    );
  });

  it("throws when job.id is empty string", async () => {
    await assert.rejects(
      () => runTrackedJob({ id: "", workspaceRoot: "/tmp" }, async () => ({})),
      /runTrackedJob requires job.id/
    );
  });

  it("throws when job.workspaceRoot is missing", async () => {
    await assert.rejects(
      () => runTrackedJob({ id: "job-1" }, async () => ({})),
      /runTrackedJob requires job.workspaceRoot/
    );
  });

  it("throws when job.workspaceRoot is empty string", async () => {
    await assert.rejects(
      () => runTrackedJob({ id: "job-1", workspaceRoot: "" }, async () => ({})),
      /runTrackedJob requires job.workspaceRoot/
    );
  });

  it("throws when runner is not a function", async () => {
    await assert.rejects(
      () => runTrackedJob({ id: "job-1", workspaceRoot: "/tmp" }, "not-a-function"),
      /runTrackedJob requires a runner function/
    );
  });
});
