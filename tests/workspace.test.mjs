import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../plugins/cc/scripts/lib/process.mjs";
import { resolveWorkspaceRoot } from "../plugins/cc/scripts/lib/workspace.mjs";

describe("resolveWorkspaceRoot", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-test-workspace-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns git repo root when cwd is inside a git repo", () => {
    const repoDir = path.join(tmpDir, "myrepo");
    fs.mkdirSync(repoDir);
    runCommand("git", ["init"], { cwd: repoDir });
    runCommand("git", ["config", "user.email", "test@test.com"], { cwd: repoDir });
    runCommand("git", ["config", "user.name", "Test"], { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, "init.txt"), "init");
    runCommand("git", ["add", "."], { cwd: repoDir });
    runCommand("git", ["commit", "-m", "init"], { cwd: repoDir });

    const subDir = path.join(repoDir, "src", "lib");
    fs.mkdirSync(subDir, { recursive: true });

    const root = resolveWorkspaceRoot(subDir);
    // Should resolve to the git repo root
    assert.equal(root, path.resolve(repoDir));
  });

  it("returns cwd when not inside a git repo", () => {
    const notARepo = path.join(tmpDir, "plain-dir");
    fs.mkdirSync(notARepo);

    const root = resolveWorkspaceRoot(notARepo);
    assert.equal(root, notARepo);
  });

  it("returns git repo root when cwd is the repo root itself", () => {
    const repoDir = path.join(tmpDir, "exact-root");
    fs.mkdirSync(repoDir);
    runCommand("git", ["init"], { cwd: repoDir });
    runCommand("git", ["config", "user.email", "test@test.com"], { cwd: repoDir });
    runCommand("git", ["config", "user.name", "Test"], { cwd: repoDir });
    fs.writeFileSync(path.join(repoDir, "init.txt"), "init");
    runCommand("git", ["add", "."], { cwd: repoDir });
    runCommand("git", ["commit", "-m", "init"], { cwd: repoDir });

    const root = resolveWorkspaceRoot(repoDir);
    assert.equal(root, path.resolve(repoDir));
  });

  it("returns a string value", () => {
    const root = resolveWorkspaceRoot(tmpDir);
    assert.equal(typeof root, "string");
    assert.ok(root.length > 0);
  });

  it("returns an absolute path", () => {
    const root = resolveWorkspaceRoot(tmpDir);
    assert.ok(path.isAbsolute(root));
  });
});
