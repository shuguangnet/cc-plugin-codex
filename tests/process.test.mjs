import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  runCommand,
  runCommandChecked,
  binaryAvailable,
  formatCommandFailure,
  terminateProcessTree
} from "../plugins/cc/scripts/lib/process.mjs";

describe("runCommand", () => {
  it("runs a simple command successfully", () => {
    const result = runCommand("echo", ["hello"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("hello"));
    assert.equal(result.error, null);
    assert.equal(result.signal, null);
  });

  it("captures stderr output", () => {
    const result = runCommand("node", ["-e", "process.stderr.write('err msg')"]);
    assert.equal(result.status, 0);
    assert.ok(result.stderr.includes("err msg"));
  });

  it("reports non-zero exit code", () => {
    const result = runCommand("node", ["-e", "process.exit(42)"]);
    assert.equal(result.status, 42);
    assert.equal(result.error, null);
  });

  it("returns error for non-existent command", () => {
    const result = runCommand("nonexistent-command-xyz-98765", []);
    assert.ok(result.error);
    assert.equal(result.error.code, "ENOENT");
  });

  it("returns null status for failed spawn (non-existent command)", () => {
    const result = runCommand("nonexistent-command-xyz-98765", []);
    assert.equal(result.status, null);
    assert.equal(result.signal, null);
  });

  it("respects cwd option", () => {
    const result = runCommand("pwd", [], { cwd: "/tmp" });
    assert.equal(result.status, 0);
    // On macOS /tmp is a symlink to /private/tmp
    assert.ok(result.stdout.trim().includes("tmp"));
  });

  it("passes input to stdin", () => {
    const result = runCommand("node", ["-e", "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>process.stdout.write(d))"], {
      input: "hello stdin"
    });
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("hello stdin"));
  });

  it("includes command and args in result", () => {
    const result = runCommand("echo", ["a", "b", "c"]);
    assert.equal(result.command, "echo");
    assert.deepStrictEqual(result.args, ["a", "b", "c"]);
  });
});

describe("runCommandChecked", () => {
  it("returns result for successful command", () => {
    const result = runCommandChecked("echo", ["ok"]);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes("ok"));
  });

  it("throws for non-zero exit code", () => {
    assert.throws(
      () => runCommandChecked("node", ["-e", "process.exit(1)"]),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.includes("exit=1"));
        return true;
      }
    );
  });

  it("throws for non-existent command", () => {
    assert.throws(
      () => runCommandChecked("nonexistent-command-xyz-98765", []),
      { code: "ENOENT" }
    );
  });
});

describe("formatCommandFailure", () => {
  it("formats exit code", () => {
    const msg = formatCommandFailure({
      command: "git",
      args: ["push"],
      status: 1,
      signal: null,
      stdout: "",
      stderr: "fatal: error"
    });
    assert.ok(msg.includes("git push"));
    assert.ok(msg.includes("exit=1"));
    assert.ok(msg.includes("fatal: error"));
  });

  it("formats signal", () => {
    const msg = formatCommandFailure({
      command: "node",
      args: ["server.js"],
      status: null,
      signal: "SIGTERM",
      stdout: "",
      stderr: ""
    });
    assert.ok(msg.includes("node server.js"));
    assert.ok(msg.includes("signal=SIGTERM"));
  });

  it("includes stdout when no stderr", () => {
    const msg = formatCommandFailure({
      command: "cmd",
      args: [],
      status: 1,
      signal: null,
      stdout: "some output",
      stderr: ""
    });
    assert.ok(msg.includes("some output"));
  });

  it("prefers stderr over stdout", () => {
    const msg = formatCommandFailure({
      command: "cmd",
      args: [],
      status: 1,
      signal: null,
      stdout: "output",
      stderr: "error output"
    });
    assert.ok(msg.includes("error output"));
  });
});

describe("binaryAvailable", () => {
  it("returns available=true for existing binary (node)", () => {
    const result = binaryAvailable("node", ["--version"]);
    assert.equal(result.available, true);
    assert.ok(result.detail.length > 0);
  });

  it("returns available=false for nonexistent binary", () => {
    const result = binaryAvailable("nonexistent-binary-xyz-98765");
    assert.equal(result.available, false);
    assert.equal(result.detail, "not found");
  });

  it("returns detail containing version for node", () => {
    const result = binaryAvailable("node", ["--version"]);
    assert.ok(result.detail.startsWith("v"));
  });

  it("returns available=false when binary exits non-zero", () => {
    // node -e "process.exit(1)" will fail with exit code 1
    const result = binaryAvailable("node", ["-e", "process.exit(1)"]);
    assert.equal(result.available, false);
    assert.ok(result.detail.length > 0);
  });
});

describe("terminateProcessTree", () => {
  it("does not throw for invalid pid", () => {
    assert.doesNotThrow(() => terminateProcessTree(NaN));
    assert.doesNotThrow(() => terminateProcessTree(Infinity));
    assert.doesNotThrow(() => terminateProcessTree("not a number"));
  });

  it("does not throw for non-existent pid", () => {
    // Use a very high pid that is unlikely to exist
    assert.doesNotThrow(() => terminateProcessTree(999999));
  });
});
