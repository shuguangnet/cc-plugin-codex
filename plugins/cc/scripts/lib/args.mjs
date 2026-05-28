/**
 * Argument parsing utilities for CLI commands.
 * Supports --flag, --key=value, --key value, and positional args.
 */

export function splitRawArgumentString(raw) {
  if (!raw || !raw.trim()) return [];
  const tokens = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let escape = false;

  for (const char of raw) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (char === ' ' && !inSingle && !inDouble) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

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
