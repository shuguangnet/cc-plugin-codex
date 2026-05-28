/**
 * Prompt template loading and interpolation.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Load a markdown prompt template from the prompts directory.
 * Validates the template name to prevent path traversal attacks.
 *
 * @param {string} rootDir - Root directory of the plugin (e.g. plugins/cc)
 * @param {string} name - Template name (without extension)
 * @returns {string} Template content
 * @throws {Error} If the name is invalid or the template file cannot be read
 */
export function loadPromptTemplate(rootDir, name) {
  if (!name || typeof name !== "string") {
    throw new Error("Template name is required.");
  }
  if (name.includes("..") || name.includes("/") || name.includes("\\")) {
    throw new Error(`Invalid template name: ${name}`);
  }
  const promptPath = path.join(rootDir, "prompts", `${name}.md`);
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Template not found: ${name}`);
  }
  return fs.readFileSync(promptPath, "utf8");
}

/**
 * Interpolate template variables in {{KEY}} placeholders.
 * Only uppercase letters and underscores are matched.
 *
 * @param {string} template - Template string with {{VAR}} placeholders
 * @param {Record<string, string>} variables - Variable values to substitute
 * @returns {string} Interpolated string
 */
export function interpolateTemplate(template, variables) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : "";
  });
}
