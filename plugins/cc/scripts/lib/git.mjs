/**
 * Git context utilities for reviews.
 */
import { runCommand } from "./process.mjs";

export function ensureGitRepository(cwd) {
  const result = runCommand("git", ["rev-parse", "--show-toplevel"], { cwd });
  if (result.status !== 0) {
    throw new Error(`Not a git repository: ${cwd}`);
  }
  return result.stdout.trim();
}

export function getCurrentBranch(cwd) {
  const result = runCommand("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd });
  return result.status === 0 ? result.stdout.trim() : "unknown";
}

export function getDiffStat(base, cwd) {
  const args = base ? ["diff", "--shortstat", `${base}...HEAD`] : ["diff", "--shortstat"];
  const result = runCommand("git", args, { cwd });
  return result.status === 0 ? result.stdout.trim() : "";
}

export function getDiffContent(base, cwd, scope = "auto") {
  if (scope === "working-tree") {
    const staged = runCommand("git", ["diff", "--cached"], { cwd });
    const unstaged = runCommand("git", ["diff"], { cwd });
    return [staged.stdout, unstaged.stdout].filter(Boolean).join("\n");
  }
  if (scope === "branch" && base) {
    const result = runCommand("git", ["diff", `${base}...HEAD`], { cwd });
    return result.stdout ?? "";
  }
  // auto: try working tree first, fall back to branch diff
  const working = runCommand("git", ["diff"], { cwd });
  const staged = runCommand("git", ["diff", "--cached"], { cwd });
  const combined = [staged.stdout, working.stdout].filter(Boolean).join("\n");
  if (combined.trim()) return combined;
  if (base) {
    const result = runCommand("git", ["diff", `${base}...HEAD`], { cwd });
    return result.stdout ?? "";
  }
  return "";
}

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

export function collectReviewContext(cwd, target) {
  const repoRoot = ensureGitRepository(cwd);
  const branch = getCurrentBranch(repoRoot);
  const diff = getDiffContent(target.baseRef, repoRoot, target.mode);
  const summary = getDiffStat(target.baseRef, repoRoot) || "No changes detected.";

  return { repoRoot, branch, diff, summary, target };
}
