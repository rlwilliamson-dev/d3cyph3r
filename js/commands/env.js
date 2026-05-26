// Environment-variable commands: export / env / unset / set.
//
// All operate on the writable processEnv layer in state.js. Built-in
// variables (USER, HOME, PWD, …) are computed live by expand.js's
// getEnv() and are merged below processEnv — so `export USER=root`
// overrides the built-in while the assignment lives, and `unset USER`
// restores the live built-in.
//
// Real bash distinguishes shell variables from environment variables
// (the latter are inherited by child processes). The sandbox has no
// children, so the distinction is moot — `FOO=bar`, `export FOO=bar`,
// and `declare FOO=bar` all do the same thing here. We accept `export`
// without an assignment (e.g. `export FOO`) silently as a no-op; bash
// would mark the var as exported, which we already treat as default.
//
// Quoting note: by the time these handlers run, the dispatch layer
// has already stripped outer quotes from each token. So
// `export FOO="hello world"` arrives as argv = ["export", "FOO=hello world"].

import { processEnv, setEnvVar, unsetEnvVar } from "../engine/state.js";
import { getEnv } from "../engine/expand.js";

/** Valid variable name: must match POSIX shell identifier rules. */
const VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Strip outer matching quotes from an assignment value. In bash, the
 * parser dequotes the value during assignment recognition (FOO='a b'
 * stores the literal `a b`, not `'a b'`); our tokenizer leaves the
 * quotes attached because it doesn't know the token is an assignment.
 * This helper handles the dequoting for any callsite that splits a
 * NAME=value token.
 */
export function dequoteAssignmentValue(value) {
  if (value.length < 2) return value;
  const first = value[0], last = value[value.length - 1];
  if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * Parse a single `NAME=value` or bare `NAME` token. Returns
 *   { name, value }   when assignment   ("FOO=bar")
 *   { name, value: null } when bare name ("FOO")
 *   null when the token isn't a valid var assignment at all.
 */
function parseAssignment(token) {
  const eq = token.indexOf("=");
  if (eq === -1) {
    if (VAR_NAME_RE.test(token)) return { name: token, value: null };
    return null;
  }
  const name = token.slice(0, eq);
  if (!VAR_NAME_RE.test(name)) return null;
  const value = dequoteAssignmentValue(token.slice(eq + 1));
  return { name, value };
}

/** Quote a value for `export -p` style output: `export FOO="bar baz"`. */
function quoteForExport(v) {
  // Empty or simple identifiers don't need quoting; everything else
  // gets double-quoted with $/`/\/" escaped.
  if (v === "") return '""';
  if (/^[A-Za-z0-9_/.:-]+$/.test(v)) return v;
  return '"' + v.replace(/([\\"$`])/g, "\\$1") + '"';
}

/**
 * export [-n] [NAME[=value]]...
 *
 * No args → list all exported vars (effectively: all of the merged env).
 * With -n → unexport (treated same as unset in this sandbox).
 * With assignments → set in processEnv.
 */
function exportCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];
  if (args.length === 0) {
    // List everything in the merged env, sorted, as bash does.
    const env = getEnv();
    const names = Object.keys(env).sort();
    const lines = names.map(n => `declare -x ${n}=${quoteForExport(env[n])}`);
    return { text: lines.join("\n"), cls: "out" };
  }

  // Check for -n flag (unexport).
  let unexport = false;
  let i = 0;
  if (args[0] === "-n") { unexport = true; i = 1; }
  if (args[0] === "-p") {
    // -p: print as exports (same as no-arg)
    return exportCmd(_level, "", _stdin, []);
  }

  const errs = [];
  for (; i < args.length; i++) {
    const parsed = parseAssignment(args[i]);
    if (!parsed) {
      errs.push(`export: \`${args[i]}\`: not a valid identifier`);
      continue;
    }
    if (unexport) {
      unsetEnvVar(parsed.name);
    } else if (parsed.value !== null) {
      setEnvVar(parsed.name, parsed.value);
    }
    // Bare-name `export FOO` with no current value: no-op (we'd mark
    // it as exported, which is our default for everything anyway).
  }
  if (errs.length) return { text: errs.join("\n"), cls: "err" };
  return null;
}

/**
 * env [NAME=value]... [command [args]...]
 *
 * No args → print all env vars (NAME=value form, one per line).
 * With NAME=value prefix → set in processEnv (since the sandbox can't
 *   spawn a sub-shell, the assignment persists; documented behavior).
 * With trailing command → not yet supported (would need to call back
 *   into execute.js with a temp env layer); for now we set the vars
 *   and warn that the command portion is ignored.
 */
function envCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];

  // Walk args until we find one that ISN'T NAME=value.
  let assignEnd = 0;
  while (assignEnd < args.length) {
    const parsed = parseAssignment(args[assignEnd]);
    if (!parsed || parsed.value === null) break;
    assignEnd++;
  }

  // Apply the assignments.
  for (let i = 0; i < assignEnd; i++) {
    const { name, value } = parseAssignment(args[i]);
    setEnvVar(name, value);
  }

  // Remaining args = command + its args. Tell the user we don't
  // support that yet (it's an unusual case; level authors won't
  // be relying on it).
  if (assignEnd < args.length) {
    return {
      text: "env: per-invocation command exec not supported in this sandbox.\n" +
            "Vars were set in the current shell; run the command on the next line.",
      cls: "warn",
    };
  }

  // No command → list mode.
  const env = getEnv();
  const names = Object.keys(env).sort();
  const lines = names.map(n => `${n}=${env[n]}`);
  return { text: lines.join("\n"), cls: "out" };
}

/**
 * unset NAME...
 *
 * Remove vars from processEnv. Built-ins re-appear (since the writable
 * layer was masking them).
 */
function unsetCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];
  if (args.length === 0) {
    return { text: "unset: usage: unset [-v] [name ...]", cls: "err" };
  }
  let i = 0;
  if (args[0] === "-v" || args[0] === "-f") i = 1;
  const errs = [];
  for (; i < args.length; i++) {
    if (!VAR_NAME_RE.test(args[i])) {
      errs.push(`unset: \`${args[i]}\`: not a valid identifier`);
      continue;
    }
    unsetEnvVar(args[i]);
  }
  if (errs.length) return { text: errs.join("\n"), cls: "err" };
  return null;
}

/**
 * set
 *
 * Print all shell variables (= env in this sandbox). Real bash has
 * dozens of flags (-e, -u, -o pipefail, etc.) — we accept and ignore
 * them so realistic-looking scripts don't choke.
 */
function setCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];
  // Accept flag args (-e, -u, +e, etc.) as no-ops so `set -e` doesn't
  // error in a level script the author copied verbatim.
  if (args.length > 0 && args.every(a => /^[+-]/.test(a))) return null;

  const env = getEnv();
  const names = Object.keys(env).sort();
  const lines = names.map(n => `${n}=${env[n]}`);
  return { text: lines.join("\n"), cls: "out" };
}

export const envCommands = {
  export: exportCmd,
  env:    envCmd,
  unset:  unsetCmd,
  set:    setCmd,
};
