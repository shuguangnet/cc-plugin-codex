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

  it("extracts numTurns and totalTokens from single JSON", () => {
    const output = JSON.stringify({
      result: "Done",
      session_id: "sess-1",
      num_turns: 5,
      total_tokens: 1234
    });
    const result = parseClaudeOutput(output);
    assert.equal(result.numTurns, 5);
    assert.equal(result.totalTokens, 1234);
  });

  it("extracts numTurns and totalTokens from JSONL result event", () => {
    const output = [
      JSON.stringify({ type: "start", session_id: "sess-1" }),
      JSON.stringify({ type: "result", result: "Done", num_turns: 3, total_tokens: 567 })
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Done");
    assert.equal(result.numTurns, 3);
    assert.equal(result.totalTokens, 567);
  });

  it("handles JSONL with mixed JSON and non-JSON lines", () => {
    const output = [
      "Some plain text line",
      JSON.stringify({ type: "result", result: "OK" }),
      "Another plain line"
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "OK");
    assert.equal(result.events.length, 1);
  });

  it("falls back to last content event when no result event in JSONL", () => {
    const output = [
      JSON.stringify({ type: "start", session_id: "sess-1" }),
      JSON.stringify({ type: "content", content: "Working..." }),
      JSON.stringify({ type: "assistant", content: "Almost done" })
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Almost done");
    assert.equal(result.sessionId, "sess-1");
  });

  it("falls back to last event when no content events in JSONL", () => {
    const output = [
      JSON.stringify({ type: "start", session_id: "sess-2" }),
      JSON.stringify({ type: "heartbeat" })
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.sessionId, "sess-2");
    assert.ok(result.events.length === 2);
  });

  it("prefers result event over content event in JSONL", () => {
    const output = [
      JSON.stringify({ type: "content", content: "Draft output" }),
      JSON.stringify({ type: "result", result: "Final output" })
    ].join("\n");
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "Final output");
  });

  it("handles single JSON array (non-object) as plain text", () => {
    const output = JSON.stringify([1, 2, 3]);
    const result = parseClaudeOutput(output);
    assert.equal(result.result, "[1,2,3]");
    assert.equal(result.sessionId, null);
  });

  it("handles single JSON primitive as plain text", () => {
    const result = parseClaudeOutput('"hello"');
    assert.equal(result.result, '"hello"');
    assert.equal(result.sessionId, null);
  });
});
