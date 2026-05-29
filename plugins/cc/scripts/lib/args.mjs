/**
 * Argument parsing utilities for CLI commands.
 * Supports --flag, --key=value, --key value, and positional args.
 */

/**
 * Split a raw argument string into tokens, respecting shell-style quoting rules.
 *
 * Handles:
 * - Double-quoted strings (`"hello world"`) — treated as a single token
 * - Single-quoted strings (`'hello world'`) — treated as a single token
 * - Backslash escapes (`\\ `) — the escaped character is included literally
 * - Unquoted spaces — treated as token separators
 *
 * @param {string} raw - Raw argument string to split (e.g. from a text input field)
 * @returns {string[]} Array of parsed argument tokens, empty array if input is empty or whitespace-only
 *
 * @example
 * splitRawArgumentString('--model sonnet "review this"')
 * // => ['--model', 'sonnet', 'review this']
 *
 * @example
 * splitRawArgumentString("it's\\ a\\ test")
 * // => ["it's a test"]
 */
export function splitRawArgumentString(raw) {
  if (!raw || !raw.trim()) return [];
  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;
  let justClosedQuote = false;

  for (const char of raw) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      justClosedQuote = false;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      if (!inSingle) justClosedQuote = true;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      if (!inDouble) justClosedQuote = true;
      continue;
    }
    if (char === ' ' && !inSingle && !inDouble) {
      if (current || justClosedQuote) {
        tokens.push(current);
        current = '';
        justClosedQuote = false;
      }
      continue;
    }
    current += char;
    justClosedQuote = false;
  }
  if (escape) current += '\\';
  if (current || justClosedQuote) tokens.push(current);
  return tokens;
}

/**
 * Parse an array of argument tokens into structured options and positional arguments.
 *
 * Supports:
 * - Long boolean flags: `--verbose` (treated as `true`)
 * - Long value options: `--key=value` or `--key value` (consumes next token as value)
 * - Short flags/values: `-v` or `-C /tmp` (resolved via aliasMap)
 * - Double-dash separator: `--` — everything after is positional
 * - Automatic type dispatch via `booleanOptions` and `valueOptions` config sets
 *
 * When a `--` prefixed argument is not in `booleanOptions` or `valueOptions`, it falls
 * back to consuming the next argument as a value (unless the next argument looks like a flag).
 *
 * @param {string[]} argv - Array of argument tokens (e.g. from `splitRawArgumentString` or `process.argv.slice(2)`)
 * @param {object} [config={}] - Parsing configuration
 * @param {string[]} [config.valueOptions] - Option names that always consume the next token as a value
 * @param {string[]} [config.booleanOptions] - Option names that are always treated as boolean flags
 * @param {Record<string, string>} [config.aliasMap] - Mapping of short/alternative names to canonical names (e.g. `{ C: "cwd" }`)
 * @returns {{ options: Record<string, string|boolean>, positional: string[] }} Parsed result with options object and positional args array
 *
 * @example
 * parseArgs(['--json', '--model', 'sonnet', 'file.js'], {
 *   booleanOptions: ['json'],
 *   valueOptions: ['model']
 * })
 * // => { options: { json: true, model: 'sonnet' }, positional: ['file.js'] }
 *
 * @example
 * parseArgs(['-C', '/tmp', 'hello'], { valueOptions: ['cwd'], aliasMap: { C: 'cwd' } })
 * // => { options: { cwd: '/tmp' }, positional: ['hello'] }
 */
export function parseArgs(argv, config = {}) {
  const valueOptions = new Set(config.valueOptions ?? []);
  const booleanOptions = new Set(config.booleanOptions ?? []);
  const aliasMap = config.aliasMap ?? {};

  const options = {};
  const positional = [];
  let i = 0;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex !== -1) {
        const key = arg.slice(2, eqIndex);
        const resolved = aliasMap[key] ?? key;
        options[resolved] = arg.slice(eqIndex + 1);
        i++;
        continue;
      }

      const key = arg.slice(2);
      const resolved = aliasMap[key] ?? key;

      if (booleanOptions.has(resolved)) {
        options[resolved] = true;
        i++;
        continue;
      }

      if (valueOptions.has(resolved) && i + 1 < argv.length) {
        options[resolved] = argv[i + 1];
        i += 2;
        continue;
      }

      // Check if next arg looks like a flag — treat as boolean
      if (i + 1 >= argv.length || argv[i + 1].startsWith('-')) {
        options[resolved] = true;
        i++;
        continue;
      }

      // Default: consume next arg as value
      options[resolved] = argv[i + 1];
      i += 2;
      continue;
    }

    if (arg.startsWith('-') && arg.length > 1) {
      const flag = arg.slice(1);
      const resolved = aliasMap[flag] ?? flag;
      if (booleanOptions.has(resolved)) {
        options[resolved] = true;
        i++;
        continue;
      }
      if (valueOptions.has(resolved) && i + 1 < argv.length) {
        options[resolved] = argv[i + 1];
        i += 2;
        continue;
      }
      options[resolved] = true;
      i++;
      continue;
    }

    positional.push(arg);
    i++;
  }

  return { options, positional };
}
