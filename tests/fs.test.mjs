import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readJsonFile, ensureDir, fileExists } from "../plugins/cc/scripts/lib/fs.mjs";

describe("readJsonFile", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns parsed JSON for valid file", () => {
    const filePath = path.join(tmpDir, "test.json");
    fs.writeFileSync(filePath, JSON.stringify({ hello: "world" }), "utf8");
    const result = readJsonFile(filePath);
    assert.deepStrictEqual(result, { hello: "world" });
  });

  it("returns null for missing file", () => {
    const result = readJsonFile(path.join(tmpDir, "nonexistent.json"));
    assert.equal(result, null);
  });

  it("returns null for invalid JSON", () => {
    const filePath = path.join(tmpDir, "bad.json");
    fs.writeFileSync(filePath, "not valid json {{{", "utf8");
    const result = readJsonFile(filePath);
    assert.equal(result, null);
  });

  it("parses arrays", () => {
    const filePath = path.join(tmpDir, "array.json");
    fs.writeFileSync(filePath, JSON.stringify([1, 2, 3]), "utf8");
    const result = readJsonFile(filePath);
    assert.deepStrictEqual(result, [1, 2, 3]);
  });

  it("handles empty JSON object", () => {
    const filePath = path.join(tmpDir, "empty.json");
    fs.writeFileSync(filePath, "{}", "utf8");
    const result = readJsonFile(filePath);
    assert.deepStrictEqual(result, {});
  });
});

describe("ensureDir", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a single directory", () => {
    const dir = path.join(tmpDir, "newdir");
    ensureDir(dir);
    assert.ok(fs.statSync(dir).isDirectory());
  });

  it("creates nested directories", () => {
    const dir = path.join(tmpDir, "a", "b", "c");
    ensureDir(dir);
    assert.ok(fs.statSync(dir).isDirectory());
  });

  it("does not throw if directory already exists", () => {
    const dir = path.join(tmpDir, "existing");
    fs.mkdirSync(dir);
    assert.doesNotThrow(() => ensureDir(dir));
    assert.ok(fs.statSync(dir).isDirectory());
  });
});

describe("fileExists", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns true for existing file", () => {
    const filePath = path.join(tmpDir, "exists.txt");
    fs.writeFileSync(filePath, "hello", "utf8");
    assert.equal(fileExists(filePath), true);
  });

  it("returns true for existing directory", () => {
    const dirPath = path.join(tmpDir, "subdir");
    fs.mkdirSync(dirPath);
    assert.equal(fileExists(dirPath), true);
  });

  it("returns false for nonexistent path", () => {
    assert.equal(fileExists(path.join(tmpDir, "nope")), false);
  });
});
