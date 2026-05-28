import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, splitRawArgumentString } from "../plugins/cc/scripts/lib/args.mjs";

describe("splitRawArgumentString", () => {
  it("splits simple space-separated args", () => {
    assert.deepStrictEqual(splitRawArgumentString("a b c"), ["a", "b", "c"]);
  });

  it("handles empty string", () => {
    assert.deepStrictEqual(splitRawArgumentString(""), []);
    assert.deepStrictEqual(splitRawArgumentString("   "), []);
  });

  it("handles quoted strings", () => {
    assert.deepStrictEqual(splitRawArgumentString('"hello world"'), ["hello world"]);
    assert.deepStrictEqual(splitRawArgumentString("'hello world'"), ["hello world"]);
  });

  it("handles escaped characters", () => {
    assert.deepStrictEqual(splitRawArgumentString("hello\\ world"), ["hello world"]);
  });
});

describe("parseArgs", () => {
  it("parses positional args", () => {
    const result = parseArgs(["foo", "bar"]);
    assert.deepStrictEqual(result.positional, ["foo", "bar"]);
    assert.deepStrictEqual(result.options, {});
  });

  it("parses boolean flags", () => {
    const result = parseArgs(["--json"], { booleanOptions: ["json"] });
    assert.equal(result.options.json, true);
  });

  it("parses value options with =", () => {
    const result = parseArgs(["--model=gpt-4"], { valueOptions: ["model"] });
    assert.equal(result.options.model, "gpt-4");
  });

  it("parses value options with space", () => {
    const result = parseArgs(["--model", "gpt-4"], { valueOptions: ["model"] });
    assert.equal(result.options.model, "gpt-4");
  });

  it("handles -- separator", () => {
    const result = parseArgs(["--json", "--", "extra", "args"]);
    assert.equal(result.options.json, true);
    assert.deepStrictEqual(result.positional, ["extra", "args"]);
  });

  it("handles aliases", () => {
    const result = parseArgs(["-C", "/tmp"], {
      valueOptions: ["cwd"],
      aliasMap: { C: "cwd" }
    });
    assert.equal(result.options.cwd, "/tmp");
  });

  it("handles mixed args", () => {
    const result = parseArgs(["--json", "--model", "sonnet", "hello", "world"], {
      booleanOptions: ["json"],
      valueOptions: ["model"]
    });
    assert.equal(result.options.json, true);
    assert.equal(result.options.model, "sonnet");
    assert.deepStrictEqual(result.positional, ["hello", "world"]);
  });
});
