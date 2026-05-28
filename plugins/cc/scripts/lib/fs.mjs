/**
 * Filesystem utilities.
 */
import fs from "node:fs";
import path from "node:path";

export function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write a value as formatted JSON to a file.
 * Creates parent directories if they don't exist.
 * @param {string} filePath - Absolute path to write to
 * @param {unknown} data - Value to serialize as JSON
 */
export function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readStdinIfPiped() {
  // Check if stdin is a pipe (not a TTY)
  if (process.stdin.isTTY) return null;

  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data.trim() || null));
    process.stdin.on("error", reject);
  });
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}
