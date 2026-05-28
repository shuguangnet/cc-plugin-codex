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
  createJobLogFile
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
