/**
 * Git context utilities for reviews.
 * Provides functions for detecting git repositories, branches, diffs,
 * and assembling review context for Claude Code prompts.
 */
import { runCommand } from "./process.mjs";

/**
 * Verify that a directory is inside a git repository and return the repo root.
 *
 * @param {string} cwd - Directory path to check
 * @returns {string} Absolute path to the git repository root
 * @throws {Error} If the directory is not inside a git repository
 */
export function ensureGitRepository(cwd) {
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.status !== 0) {
    throw new Error(`Not a git repository: ${cwd}`);
  }
  return result.stdout.trim();
}

/**
 * Get the current git branch name for the given directory.
 * Returns "unknown" if not in a git repository or on a detached HEAD.
 *
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @returns {string} Current branch name, or "unknown" if unavailable
 */
export function getCurrentBranch(cwd) {
  const result = runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

/**
 * Get a short diffstat summary for the current changes.
 *
 * @param {string|null} base - Base ref for branch diff (e.g. "main"). If null, shows working tree changes.
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @returns {string} Diffstat string (e.g. "1 file changed, 5 insertions(+)"), or empty if no changes
 */
export function getDiffStat(base, cwd) {
  const args = base ? ["diff", "--shortstat", `${base}...HEAD`] : ["diff", "--shortstat"];
  const result = runCommand("git", args, { cwd });
  return result.status === 0 ? result.stdout.trim() : "";
}

/**
 * Get the unified diff for working tree changes (staged + unstaged).
 *
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @returns {string} Combined diff of staged and unstaged changes, or empty string
 */
function getWorkingTreeDiff(cwd) {
  const staged = runCommand("git", ["diff", "--cached"], { cwd });
  const unstaged = runCommand("git", ["diff"], { cwd });
  return [staged.stdout, unstaged.stdout].filter(Boolean).join("\n");
}

/**
 * Get the unified diff between a base ref and HEAD.
 *
 * @param {string} base - Base ref (e.g. "main")
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @returns {string} Unified diff content, or empty string
 */
function getBranchDiff(base, cwd) {
  const result = runCommand("git", ["diff", `${base}...HEAD`], { cwd });
  return result.stdout ?? "";
}

/**
 * Get the full diff content for code review.
 * Supports three scopes:
 * - "working-tree": staged + unstaged changes in the working tree
 * - "branch": diff between a base ref and HEAD
 * - "auto": tries working tree first, falls back to branch diff
 *
 * @param {string|null} base - Base ref for branch diff (e.g. "main"). Used when scope is "branch" or "auto" fallback.
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @param {"auto"|"working-tree"|"branch"} [scope="auto"] - Diff scope to use
 * @returns {string} Unified diff content, or empty string if no changes
 */
export function getDiffContent(base, cwd, scope = "auto") {
  if (scope === "working-tree") {
    return getWorkingTreeDiff(cwd);
  }
  if (scope === "branch" && base) {
    return getBranchDiff(base, cwd);
  }
  // auto: try working tree first, fall back to branch diff
  const workingTreeDiff = getWorkingTreeDiff(cwd);
  if (workingTreeDiff.trim()) return workingTreeDiff;
  if (base) {
    return getBranchDiff(base, cwd);
  }
  return "";
}

/**
 * Determine what to review based on the given scope and available changes.
 * In "auto" mode, prefers working tree changes if any exist, otherwise uses branch diff.
 *
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @param {object} [options={}] - Review options
 * @param {string|null} [options.base=null] - Base ref for branch diff (e.g. "main")
 * @param {"auto"|"working-tree"|"branch"} [options.scope="auto"] - Diff scope
 * @returns {{ mode: "working-tree"|"branch", label: string, baseRef: string|null }} Review target descriptor
 */
export function resolveReviewTarget(cwd, options = {}) {
  const base = options.base ?? null;
  const scope = options.scope ?? "auto";

  if (scope === "working-tree") {
    return { mode: "working-tree", label: "Working tree changes", baseRef: null };
  }
  if (scope === "branch") {
    return { mode: "branch", label: `Branch diff against ${base ?? "main"}`, baseRef: base };
  }
  // auto
  const diffStat = getDiffStat(null, cwd);
  if (diffStat) {
    return { mode: "working-tree", label: "Working tree changes", baseRef: null };
  }
  if (base) {
    return { mode: "branch", label: `Branch diff against ${base}`, baseRef: base };
  }
  return { mode: "working-tree", label: "Working tree changes", baseRef: null };
}

/**
 * Collect all git context needed for a review prompt.
 * Gathers the repository root, current branch, diff content, and diffstat summary.
 *
 * @param {string} cwd - Directory path (must be inside a git repo)
 * @param {{ mode: string, baseRef: string|null }} target - Review target descriptor from {@link resolveReviewTarget}
 * @returns {{ repoRoot: string, branch: string, diff: string, summary: string, target: object }} Complete review context
 */
export function collectReviewContext(cwd, target) {
  const repoRoot = ensureGitRepository(cwd);
  const branch = getCurrentBranch(repoRoot);
  const diff = getDiffContent(target.baseRef, repoRoot, target.mode);
  const summary = getDiffStat(target.baseRef, repoRoot) || "No changes detected.";

  return { repoRoot, branch, diff, summary, target };
}
