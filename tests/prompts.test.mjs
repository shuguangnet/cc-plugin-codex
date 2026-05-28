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
