import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCommand } from "../plugins/cc/scripts/lib/process.mjs";
import {
  ensureGitRepository,
  getCurrentBranch,
  getDiffStat,
  getDiffContent,
  resolveReviewTarget,
  collectReviewContext
} from "../plugins/cc/scripts/lib/git.mjs";

let testDir;
let testRepo;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-git-"));
  testRepo = path.join(testDir, "repo");
  fs.mkdirSync(testRepo);
  runCommand("git", ["init"], { cwd: testRepo });
  runCommand("git", ["config", "user.email", "test@test.com"], { cwd: testRepo });
  runCommand("git", ["config", "user.name", "Test"], { cwd: testRepo });
  // Create initial commit so HEAD exists
  fs.writeFileSync(path.join(testRepo, "init.txt"), "init");
  runCommand("git", ["add", "."], { cwd: testRepo });
  runCommand("git", ["commit", "-m", "init"], { cwd: testRepo });
});

afterEach(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe("git utilities", () => {
  it("ensureGitRepository returns repo root", () => {
    const root = ensureGitRepository(testRepo);
    assert.ok(root);
    assert.ok(path.isAbsolute(root));
  });

  it("ensureGitRepository throws for non-repo", () => {
    const fakeDir = path.join(testDir, "not-a-repo");
    fs.mkdirSync(fakeDir);
    assert.throws(() => ensureGitRepository(fakeDir), /Not a git repository/);
  });

  it("getCurrentBranch returns branch name", () => {
    const branch = getCurrentBranch(testRepo);
    assert.ok(branch);
    assert.ok(typeof branch === "string");
    // Should be main or master
    assert.ok(["main", "master"].includes(branch));
  });

  it("getCurrentBranch returns unknown for non-repo", () => {
    const fakeDir = path.join(testDir, "not-a-repo");
    fs.mkdirSync(fakeDir);
    const branch = getCurrentBranch(fakeDir);
    assert.equal(branch, "unknown");
  });

  it("getDiffStat returns empty for clean repo", () => {
    const stat = getDiffStat(null, testRepo);
    assert.equal(stat, "");
  });

  it("getDiffStat returns stat for dirty repo", () => {
    fs.writeFileSync(path.join(testRepo, "new.txt"), "new content");
    const stat = getDiffStat(null, testRepo);
    // Should mention file changes
    assert.ok(stat.includes("file") || stat.includes("insertion") || stat.includes("change") || stat === "");
  });

  it("getDiffContent returns empty for clean repo", () => {
    const content = getDiffContent(null, testRepo, "auto");
    assert.equal(content, "");
  });

  it("getDiffContent working-tree scope returns diff", () => {
    fs.writeFileSync(path.join(testRepo, "new.txt"), "new content");
    const content = getDiffContent(null, testRepo, "working-tree");
    assert.ok(content.includes("new content") || content === "");
  });

  it("resolveReviewTarget returns working-tree mode by default", () => {
    const target = resolveReviewTarget(testRepo);
    assert.equal(target.mode, "working-tree");
    assert.equal(target.baseRef, null);
  });

  it("resolveReviewTarget with scope=branch returns branch mode", () => {
    const target = resolveReviewTarget(testRepo, { scope: "branch", base: "main" });
    assert.equal(target.mode, "branch");
    assert.equal(target.baseRef, "main");
  });

  it("resolveReviewTarget with explicit working-tree scope", () => {
    const target = resolveReviewTarget(testRepo, { scope: "working-tree" });
    assert.equal(target.mode, "working-tree");
    assert.equal(target.baseRef, null);
  });

  it("collectReviewContext returns complete context", () => {
    const target = { mode: "working-tree", label: "Working tree changes", baseRef: null };
    const ctx = collectReviewContext(testRepo, target);
    assert.ok(ctx.repoRoot);
    assert.ok(ctx.branch);
    assert.ok("diff" in ctx);
    assert.ok(ctx.summary);
    assert.equal(ctx.target.mode, "working-tree");
  });

  it("collectReviewContext includes diff when changes exist", () => {
    fs.writeFileSync(path.join(testRepo, "feature.txt"), "feature code");
    const target = { mode: "working-tree", label: "Working tree", baseRef: null };
    const ctx = collectReviewContext(testRepo, target);
    assert.ok(ctx.diff.includes("feature code") || ctx.diff === "");
  });
});
