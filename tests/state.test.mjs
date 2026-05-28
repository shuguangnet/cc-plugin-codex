import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  resolveStateDir,
  loadState,
  saveState,
  upsertJob,
  listJobs,
  setConfig,
  getConfig,
  generateJobId
} from "../plugins/cc/scripts/lib/state.mjs";

// Create a temp directory for test state
let testDir;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-state-"));
  // Create a git repo so resolveWorkspaceRoot works
  fs.mkdirSync(path.join(testDir, ".git"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("state management", () => {
  it("generates unique job IDs", () => {
    const id1 = generateJobId("test");
    const id2 = generateJobId("test");
    assert.ok(id1.startsWith("test-"));
    assert.ok(id2.startsWith("test-"));
    assert.notEqual(id1, id2);
  });

  it("loads default state for new workspace", () => {
    const state = loadState(testDir);
    assert.equal(state.version, 1);
    assert.deepStrictEqual(state.jobs, []);
    assert.deepStrictEqual(state.config, {});
  });

  it("saves and loads state", () => {
    const state = loadState(testDir);
    state.config.testKey = "testValue";
    saveState(testDir, state);

    const loaded = loadState(testDir);
    assert.equal(loaded.config.testKey, "testValue");
  });

  it("upserts a new job", () => {
    upsertJob(testDir, { id: "job-1", status: "running", title: "Test" });
    const jobs = listJobs(testDir);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].id, "job-1");
    assert.equal(jobs[0].status, "running");
  });

  it("upserts an existing job (updates)", () => {
    upsertJob(testDir, { id: "job-1", status: "running" });
    upsertJob(testDir, { id: "job-1", status: "completed" });
    const jobs = listJobs(testDir);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].status, "completed");
  });

  it("prunes jobs to MAX_JOBS", () => {
    for (let i = 0; i < 60; i++) {
      upsertJob(testDir, { id: `job-${i}`, status: "completed" });
    }
    const jobs = listJobs(testDir);
    assert.ok(jobs.length <= 50);
  });

  it("sets and gets config", () => {
    setConfig(testDir, "stopReviewGate", true);
    const config = getConfig(testDir);
    assert.equal(config.stopReviewGate, true);
  });

  it("preserves existing config when setting new key", () => {
    setConfig(testDir, "key1", "value1");
    setConfig(testDir, "key2", "value2");
    const config = getConfig(testDir);
    assert.equal(config.key1, "value1");
    assert.equal(config.key2, "value2");
  });
});
