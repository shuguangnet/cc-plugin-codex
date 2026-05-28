import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  sortJobsNewestFirst,
  readStoredJob,
  buildStatusSnapshot,
  formatElapsed
} from "../plugins/cc/scripts/lib/job-control.mjs";
import { upsertJob, listJobs, writeJobFile, resolveJobFile } from "../plugins/cc/scripts/lib/state.mjs";

let testDir;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-jc-"));
  fs.mkdirSync(path.join(testDir, ".git"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("job control", () => {
  it("sorts jobs newest first", () => {
    upsertJob(testDir, { id: "job-1", status: "completed", createdAt: "2026-01-01T00:00:00Z" });
    upsertJob(testDir, { id: "job-2", status: "running", createdAt: "2026-01-02T00:00:00Z" });
    const jobs = listJobs(testDir);
    const sorted = sortJobsNewestFirst(jobs);
    assert.ok(Array.isArray(sorted));
    assert.equal(sorted.length, 2);
    // Newest first
    assert.ok(sorted[0].createdAt >= sorted[1].createdAt);
  });

  it("reads stored job file", () => {
    writeJobFile(testDir, "job-1", { id: "job-1", status: "running", result: "test" });
    const stored = readStoredJob(testDir, "job-1");
    assert.equal(stored.id, "job-1");
    assert.equal(stored.result, "test");
  });

  it("returns null for missing stored job", () => {
    const stored = readStoredJob(testDir, "nonexistent");
    assert.equal(stored, null);
  });

  it("builds status snapshot with empty jobs", () => {
    const snapshot = buildStatusSnapshot(testDir);
    assert.deepStrictEqual(snapshot.running, []);
    assert.equal(snapshot.latestFinished, null);
    assert.deepStrictEqual(snapshot.recent, []);
  });

  it("builds status snapshot with running and finished jobs", () => {
    upsertJob(testDir, { id: "job-1", status: "running", jobClass: "task", title: "Running Task" });
    upsertJob(testDir, { id: "job-2", status: "completed", jobClass: "review", title: "Done Review", completedAt: "2026-01-01T00:01:00Z" });
    const snapshot = buildStatusSnapshot(testDir);
    assert.equal(snapshot.running.length, 1);
    assert.equal(snapshot.running[0].id, "job-1");
    assert.ok(snapshot.latestFinished !== null);
  });

  it("builds status snapshot with showAll option", () => {
    for (let i = 0; i < 10; i++) {
      upsertJob(testDir, { id: `job-${i}`, status: "completed", jobClass: "task" });
    }
    const snapshot = buildStatusSnapshot(testDir, { showAll: true });
    assert.ok(snapshot.recent.length > 0);
  });
});

describe("formatElapsed", () => {
  it("formats zero milliseconds", () => {
    assert.equal(formatElapsed(0), "0ms");
  });

  it("formats sub-second values in milliseconds", () => {
    assert.equal(formatElapsed(500), "500ms");
    assert.equal(formatElapsed(999), "999ms");
  });

  it("formats exactly 1 second", () => {
    assert.equal(formatElapsed(1000), "1s");
  });

  it("formats seconds below 60", () => {
    assert.equal(formatElapsed(5000), "5s");
    assert.equal(formatElapsed(59000), "59s");
  });

  it("formats exactly 60 seconds as 1m 0s", () => {
    assert.equal(formatElapsed(60000), "1m 0s");
  });

  it("formats minutes and seconds", () => {
    assert.equal(formatElapsed(90000), "1m 30s");
    assert.equal(formatElapsed(3599000), "59m 59s");
  });

  it("formats exactly 1 hour", () => {
    assert.equal(formatElapsed(3600000), "1h 0m");
  });

  it("formats hours and minutes", () => {
    assert.equal(formatElapsed(3661000), "1h 1m");
    assert.equal(formatElapsed(7380000), "2h 3m");
  });

  it("formats large values", () => {
    assert.equal(formatElapsed(86400000), "24h 0m");
  });
});
