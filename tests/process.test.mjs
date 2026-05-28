import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { binaryAvailable } from "../plugins/cc/scripts/lib/process.mjs";

describe("binaryAvailable", () => {
  it("detects node as available", () => {
    const result = binaryAvailable("node", ["--version"]);
    assert.equal(result.available, true);
    assert.ok(result.detail.length > 0);
  });

  it("detects missing binary", () => {
    const result = binaryAvailable("nonexistent-binary-xyz-12345", ["--version"]);
    assert.equal(result.available, false);
    assert.ok(result.detail.includes("not found") || result.detail.includes("ENOENT"));
  });
});
