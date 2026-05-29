import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadPromptTemplate, interpolateTemplate } from "../plugins/cc/scripts/lib/prompts.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "plugins", "cc");

describe("loadPromptTemplate", () => {
  it("loads the adversarial-review template", () => {
    const template = loadPromptTemplate(ROOT_DIR, "adversarial-review");
    assert.ok(template.includes("REVIEW_KIND"));
    assert.ok(template.includes("TARGET_LABEL"));
  });

  it("throws for missing template", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, "nonexistent-template"),
      /Template not found/
    );
  });

  it("throws for path traversal with ../", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, "../package"),
      /Invalid template name/
    );
  });

  it("throws for path traversal with slash", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, "commands/task"),
      /Invalid template name/
    );
  });

  it("throws for empty name", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, ""),
      /Template name is required/
    );
  });

  it("throws for null name", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, null),
      /Template name is required/
    );
  });

  it("throws for null byte injection", () => {
    assert.throws(
      () => loadPromptTemplate(ROOT_DIR, "valid\0name"),
      /Invalid template name/
    );
  });
});

describe("interpolateTemplate", () => {
  it("replaces placeholders", () => {
    const result = interpolateTemplate("Hello {{NAME}}, welcome to {{PLACE}}!", {
      NAME: "World",
      PLACE: "Earth"
    });
    assert.equal(result, "Hello World, welcome to Earth!");
  });

  it("replaces missing vars with empty string", () => {
    const result = interpolateTemplate("Hello {{NAME}}!", {});
    assert.equal(result, "Hello !");
  });

  it("replaces placeholders with digits in variable names", () => {
    const result = interpolateTemplate("{{VAR_1}} and {{ITEM_2}}", {
      VAR_1: "first",
      ITEM_2: "second"
    });
    assert.equal(result, "first and second");
  });

  it("replaces placeholders starting with digits", () => {
    const result = interpolateTemplate("{{3_RETRY}} timeout", {
      "3_RETRY": "third"
    });
    assert.equal(result, "third timeout");
  });

  it("replaces placeholders ending with digits", () => {
    const result = interpolateTemplate("Value: {{MAX_3}}", {
      MAX_3: "three"
    });
    assert.equal(result, "Value: three");
  });

  it("ignores lowercase variable names", () => {
    const result = interpolateTemplate("{{lower}} and {{MIXED_case}}", {
      lower: "nope",
      MIXED_case: "nope"
    });
    assert.equal(result, "{{lower}} and {{MIXED_case}}");
  });

  it("handles multiple replacements including digits", () => {
    const result = interpolateTemplate("{{A_1}} {{B_2}} {{C_3}}", {
      A_1: "x",
      B_2: "y",
      C_3: "z"
    });
    assert.equal(result, "x y z");
  });
});
