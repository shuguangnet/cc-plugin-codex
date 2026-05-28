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
});
