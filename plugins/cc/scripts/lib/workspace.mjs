/**
 * Workspace resolution.
 * Attempts to find the git repository root for the given directory.
 * Falls back to the original directory if not inside a git repo.
 */
import { ensureGitRepository } from "./git.mjs";

/**
 * Resolve the workspace root directory for a given path.
 * If the path is inside a git repository, returns the git repo root.
 * Otherwise, returns the original directory unchanged.
 *
 * @param {string} cwd - Directory path to resolve
 * @returns {string} Absolute path to the workspace root
 */
export function resolveWorkspaceRoot(cwd) {
  try {
    return ensureGitRepository(cwd);
  } catch {
    return cwd;
  }
}
