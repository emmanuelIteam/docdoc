'use strict';

// Minimal `.env` loader, without a dependency.
//
// The application reads its configuration from the process environment: the
// Scaleway container injects it in production, and the shell provides it in
// development. This module adds the convenience of a local `.env` file, read
// once when it is required.
//
// Two rules that matter:
//   - an existing environment variable always wins, so a value exported in the
//     shell or injected by the platform is never overridden by the file;
//   - the file is optional. Its absence is the normal case in production, not
//     an error.
//
// `DOCDOC_ENV_FILE` changes which file is read (and pointing it at a
// non-existent path disables the loading entirely, which is what the tests do
// to stay independent from a developer's local file).

const fs = require('fs');
const path = require('path');

function parse(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(separator + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) {
      value = value.slice(1, -1);
    } else {
      // An unquoted trailing comment ("VALUE # explanation") is not part of the
      // value; a `#` inside a value is kept.
      const comment = value.search(/\s#/);
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    values[key] = value;
  }
  return values;
}

// Read `file`, fill in the variables that are not already set, and report what
// was applied. Never throws.
function loadEnv(file = process.env.DOCDOC_ENV_FILE || path.join(__dirname, '.env')) {
  let contents = null;
  try {
    contents = fs.readFileSync(file, 'utf8');
  } catch {
    return { loaded: false, path: file, applied: [] };
  }
  const applied = [];
  for (const [key, value] of Object.entries(parse(contents))) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied.push(key);
    }
  }
  return { loaded: true, path: file, applied };
}

// Loaded on require: `require('./env')` must be the first line of an entry
// point, before any module that reads the environment as it loads.
const result = loadEnv();

module.exports = { loadEnv, parse, result };
