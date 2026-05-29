import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  sortJobsNewestFirst,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob,
  buildSingleJobSnapshot,
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

describe("resolveCancelableJob", () => {
  it("resolves an existing job", () => {
    upsertJob(testDir, { id: "job-cancel-1", status: "running", title: "Task" });
    const { job } = resolveCancelableJob(testDir, "job-cancel-1");
    assert.equal(job.id, "job-cancel-1");
    assert.equal(job.status, "running");
  });

  it("throws for non-existent job", () => {
    assert.throws(
      () => resolveCancelableJob(testDir, "nonexistent"),
      /Job nonexistent not found/
    );
  });
});

describe("resolveResultJob", () => {
  it("resolves job and reads stored job file", () => {
    upsertJob(testDir, { id: "job-result-1", status: "completed" });
    writeJobFile(testDir, "job-result-1", { id: "job-result-1", result: "done" });
    const { job, storedJob } = resolveResultJob(testDir, "job-result-1");
    assert.equal(job.id, "job-result-1");
    assert.equal(job.status, "completed");
    assert.ok(storedJob);
    assert.equal(storedJob.result, "done");
  });

  it("returns null storedJob when file is missing", () => {
    upsertJob(testDir, { id: "job-result-2", status: "completed" });
    const { job, storedJob } = resolveResultJob(testDir, "job-result-2");
    assert.equal(job.id, "job-result-2");
    assert.equal(storedJob, null);
  });

  it("throws for non-existent job", () => {
    assert.throws(
      () => resolveResultJob(testDir, "nonexistent"),
      /Job nonexistent not found/
    );
  });
});

describe("buildSingleJobSnapshot", () => {
  it("builds snapshot with stored job data and progress", () => {
    upsertJob(testDir, {
      id: "job-snap-1",
      status: "running",
      startedAt: new Date(Date.now() - 5000).toISOString()
    });
    writeJobFile(testDir, "job-snap-1", {
      id: "job-snap-1",
      status: "running",
      progress: [
        { message: "step 1" },
        { message: "step 2" },
        { message: "step 3" },
        { message: "step 4" },
        { message: "step 5" },
        { message: "step 6" }
      ]
    });

    const snapshot = buildSingleJobSnapshot(testDir, "job-snap-1");
    assert.equal(snapshot.job.id, "job-snap-1");
    assert.equal(snapshot.job.status, "running");
    assert.ok(snapshot.job.elapsed); // should have elapsed time
    assert.ok(snapshot.storedJob);
    assert.equal(snapshot.storedJob.id, "job-snap-1");
    // Should slice last 5 progress items
    assert.equal(snapshot.progressPreview.length, 5);
    assert.equal(snapshot.progressPreview[0].message, "step 2");
  });

  it("builds snapshot for completed job with duration", () => {
    const started = new Date(Date.now() - 10000).toISOString();
    const completed = new Date(Date.now() - 2000).toISOString();
    upsertJob(testDir, {
      id: "job-snap-2",
      status: "completed",
      startedAt: started,
      completedAt: completed
    });

    const snapshot = buildSingleJobSnapshot(testDir, "job-snap-2");
    assert.equal(snapshot.job.id, "job-snap-2");
    assert.ok(snapshot.job.duration);
    assert.equal(snapshot.job.elapsed, null);
  });

  it("returns empty progressPreview when no stored job", () => {
    upsertJob(testDir, { id: "job-snap-3", status: "completed" });
    const snapshot = buildSingleJobSnapshot(testDir, "job-snap-3");
    assert.deepEqual(snapshot.progressPreview, []);
    assert.equal(snapshot.storedJob, null);
  });

  it("throws for non-existent job", () => {
    assert.throws(
      () => buildSingleJobSnapshot(testDir, "nonexistent"),
      /Job nonexistent not found/
    );
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

  it("returns 0ms for NaN", () => {
    assert.equal(formatElapsed(NaN), "0ms");
  });

  it("returns 0ms for negative values", () => {
    assert.equal(formatElapsed(-500), "0ms");
    assert.equal(formatElapsed(-1), "0ms");
  });

  it("returns 0ms for Infinity", () => {
    assert.equal(formatElapsed(Infinity), "0ms");
    assert.equal(formatElapsed(-Infinity), "0ms");
  });

  it("returns 0ms for non-number inputs", () => {
    assert.equal(formatElapsed(undefined), "0ms");
    assert.equal(formatElapsed(null), "0ms");
    assert.equal(formatElapsed("abc"), "0ms");
  });

  it("floors fractional milliseconds below 1s", () => {
    assert.equal(formatElapsed(999.6), "999ms");
    assert.equal(formatElapsed(500.4), "500ms");
    assert.equal(formatElapsed(100.9), "100ms");
  });
});
