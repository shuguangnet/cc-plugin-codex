import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseClaudeOutput } from "../plugins/cc/scripts/lib/claude-code.mjs";

describe("parseClaudeOutput", () => {
  it("parses empty output", () => {
    const result = parseClaudeOutput("");
    assert.equal(result.result, "");
    assert.equal(result.sessionId, null);
    assert.equal(result.isError, false);
  });

  it("parses empty output with stderr", () => {
    const result = parseClaudeOutput("", "Error: API key not found");
    assert.equal(result.isError, true);
    assert.ok(result.error.includes("API key"));
  });

  it("parses single JSON object", () => {
    const output = JSON.stringify({
      result: "Hello world",
      session_id: "sess-123",
      is_error: false,
      cost_usd: 0.001,
      duration_ms: 500
    });
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Hello world");
    assert.equal(result.sessionId, "sess-123");
    assert.equal(result.isError, false);
    assert.equal(result.cost, 0.001);
    assert.equal(result.duration, 500);
  });

  it("parses JSON with content field", () => {
    const output = JSON.stringify({
      content: "Some content",
      session_id: "sess-456"
    });
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Some content");
    assert.equal(result.sessionId, "sess-456");
  });

  it("parses JSONL streaming output", () => {
    const output = [
      JSON.stringify({ type: "start", session_id: "sess-789" }),
      JSON.stringify({ type: "content", content: "Working..." }),
      JSON.stringify({ type: "result", result: "Done!", is_error: false })
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Done!");
    assert.equal(result.sessionId, "sess-789");
    assert.equal(result.events.length, 3);
  });

  it("parses plain text output", () => {
    const result = parseClaudeOutput("Just plain text output");
    assert.equal(result.result, "Just plain text output");
    assert.equal(result.sessionId, null);
    assert.equal(result.isError, false);
  });

  it("handles JSON with is_error flag", () => {
    const output = JSON.stringify({
      result: "Error occurred",
      is_error: true
    });
    const result = parseClaudeOutput(output);
    assert.equal(result.isError, true);
  });
});
