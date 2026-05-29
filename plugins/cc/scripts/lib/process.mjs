/**
 * Process execution utilities.
 */
import { spawnSync } from "node:child_process";
import process from "node:process";

/**
 * Execute a command synchronously and return the result.
 *
 * @param {string} command - The command to run
 * @param {string[]} [args=[]] - Command arguments
 * @param {object} [options={}] - Execution options
 * @param {string} [options.cwd] - Working directory
 * @param {object} [options.env] - Environment variables
 * @param {string} [options.input] - Stdin input
 * @param {number} [options.maxBuffer] - Max buffer size (default: 10 MB)
 * @param {string|string[]} [options.stdio] - Stdio mode (default: "pipe")
 * @param {number} [options.timeout] - Timeout in milliseconds (default: 0 = no timeout)
 * @returns {{ command: string, args: string[], status: number, signal: string|null, stdout: string, stderr: string, error: Error|null, timedOut: boolean }}
 */
export function runCommand(command, args = [], options = {}) {
  if (!command || typeof command !== "string") {
    throw new Error("runCommand requires a non-empty string command.");
  }
  if (!Array.isArray(args)) {
    throw new Error("runCommand args must be an array.");
  }
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    input: options.input,
    maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    stdio: options.stdio ?? "pipe",
    shell: process.platform === "win32" ? (process.env.SHELL || true) : false,
    timeout: options.timeout ?? 0,
    windowsHide: true
  });

  const timedOut = result.error?.code === "ETIMEDOUT" || (result.status === null && result.signal === "SIGTERM" && (options.timeout ?? 0) > 0);

  return {
    command,
    args,
    status: result.status,
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
    timedOut
  };
}

/**
 * Execute a command and throw if it fails.
 *
 * @param {string} command - The command to run
 * @param {string[]} [args=[]] - Command arguments
 * @param {object} [options={}] - Execution options (see {@link runCommand})
 * @returns {object} The command result
 * @throws {Error} If the command fails to start or returns a non-zero exit code
 */
export function runCommandChecked(command, args = [], options = {}) {
  const result = runCommand(command, args, options);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(formatCommandFailure(result));
  return result;
}

/**
 * Check whether a binary is available on the system.
 *
 * @param {string} command - The binary name to check
 * @param {string[]} [versionArgs=["--version"]] - Args to invoke the binary with
 * @param {object} [options={}] - Execution options
 * @returns {{ available: boolean, detail: string }}
 */
export function binaryAvailable(command, versionArgs = ["--version"], options = {}) {
  const result = runCommand(command, versionArgs, options);
  if (result.error && result.error.code === "ENOENT") {
    return { available: false, detail: "not found" };
  }
  if (result.error) {
    return { available: false, detail: result.error.message };
  }
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    return { available: false, detail };
  }
  return { available: true, detail: result.stdout.trim() || result.stderr.trim() || "ok" };
}

/**
 * Terminate a process and its children by sending SIGTERM.
 * Tries process group kill first (-pid), then falls back to direct kill.
 *
 * @param {number} pid - Process ID to terminate
 */
export function terminateProcessTree(pid) {
  if (!Number.isFinite(pid)) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Process already dead
    }
  }
}

/**
 * Format a failed command result into a human-readable error string.
 *
 * @param {{ command: string, args: string[], status: number, signal: string|null, stdout: string, stderr: string, timedOut?: boolean }} result
 * @returns {string} Formatted error description
 */
export function formatCommandFailure(result) {
  const parts = [`${result.command} ${result.args.join(" ")}`.trim()];
  if (result.timedOut) {
    parts.push("timed out");
  } else if (result.signal) {
    parts.push(`signal=${result.signal}`);
  } else {
    parts.push(`exit=${result.status}`);
  }
  const stderr = (result.stderr || "").trim();
  const stdout = (result.stdout || "").trim();
  if (stderr) parts.push(stderr);
  else if (stdout) parts.push(stdout);
  return parts.join(": ");
}
