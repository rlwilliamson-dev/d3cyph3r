// Token-level expansion: variables, command substitution, $?, quoting.
//
// Called per-token from the dispatcher (`js/engine/execute.js`) after
// the parser has produced the raw token list. The parser leaves outer
// quote markers on each token so this layer can decide:
//
//   single-quoted   ('foo $USER')    → no expansion, content literal
//   double-quoted   ("foo $USER")    → expand $VAR / ${VAR} / $? / $(...)
//   unquoted        (foo$USER)       → expand same as double-quoted
//                                      (we don't word-split substitution
//                                      results — bash does, but the
//                                      sandbox doesn't need it)
//
// Variable resolution layers (later layers override earlier):
//   1. Built-ins   — USER / LOGNAME / HOME / HOSTNAME / PWD / SHELL /
//                    PATH / LANG / PS1 / PS2. Computed live from engine
//                    state so they reflect the current level and cwd.
//   2. level.env_vars — static per-level env (the level author's gift
//                    to the player; e.g. a CI-style level can declare
//                    AWS_PROFILE=ci as an embedded hint).
//   3. processEnv  — user-writable layer set via `export FOO=bar` or
//                    `FOO=bar` assignment. Wins ties. Reset on level
//                    switch (a fresh shell starts clean).
//
//   Special: `?` → last exit code, `$` → literal $ (escape hatch).
//
// Command substitution: `$(cmd ...)` runs the inner pipeline (with
// the full chain semantics) and inserts the captured stdout. Nested
// substitutions work because the parser captures them as opaque
// blobs inside the outer token. The expand layer calls the supplied
// `runForOutput` callback to actually run them — the callback is
// passed in to avoid an import cycle with execute.js.

import { currentLevelKey, currentPath, lastExitCode, processEnv } from "./state.js";
import { LEVELS } from "../../levels/index.js";

const SINGLE = "'";
const DOUBLE = '"';

/** Default PS1 — bash's standard `\u@\h:\w$ ` plus a space for clarity. */
export const DEFAULT_PS1 = "\\u@\\h:\\w\\$ ";
export const DEFAULT_PS2 = "> ";

/**
 * Compute the live variable map for the current level.
 *
 * Layers (later layers win on conflict):
 *   1. Live built-ins (derived from engine state — always fresh).
 *   2. level.env_vars (static per-level).
 *   3. processEnv (user-writable; export/assignment).
 */
export function getEnv() {
  const level = LEVELS[currentLevelKey] || {};
  const user = level.playerUser || currentLevelKey.split("@")[0];
  const host = currentLevelKey.split("@")[1] || "localhost";
  const home = `/home/${user}`;
  const pwd  = currentPath.length === 0 ? home : home + "/" + currentPath.join("/");

  const builtins = {
    USER:     user,
    LOGNAME:  user,
    HOME:     home,
    HOSTNAME: host,
    PWD:      pwd,
    SHELL:    "/bin/bash",
    PATH:     "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    LANG:     "en_US.UTF-8",
    PS1:      DEFAULT_PS1,
    PS2:      DEFAULT_PS2,
  };

  // processEnv (Map) → plain object for spread
  const procObj = {};
  for (const [k, v] of processEnv) procObj[k] = v;

  return { ...builtins, ...(level.env_vars || {}), ...procObj };
}

/**
 * Expand variables and command substitution inside a single token,
 * respecting single-quote literal regions inside the token.
 *
 * @param {string} token        - Raw token (with quote markers retained).
 * @param {function(string): string} runSubstitution
 *      - Callback that runs a sub-command and returns its captured
 *        stdout. Injected to avoid a circular import on execute.js.
 * @returns {string} Expanded token (quote markers still present;
 *      caller strips them with `unquote` from parse.js).
 */
export function expandTokenVars(token, runSubstitution) {
  if (!token) return token;
  // Fast path: no expansion-trigger char anywhere.
  if (!token.includes("$") && !token.includes(SINGLE)) return token;

  const env = getEnv();
  let out  = "";
  let i    = 0;
  // Walk the token tracking whether we're inside single quotes — those
  // are literal. Double quotes don't disable expansion.
  let mode = "none";

  while (i < token.length) {
    const c    = token[i];
    const next = token[i + 1];

    if (mode === "single") {
      out += c;
      if (c === SINGLE) mode = "none";
      i++;
      continue;
    }
    if (c === SINGLE && mode !== "double") {
      mode = "single";
      out += c;
      i++;
      continue;
    }
    if (c === DOUBLE && mode === "none") {
      mode = "double";
      out += c;
      i++;
      continue;
    }
    if (c === DOUBLE && mode === "double") {
      mode = "none";
      out += c;
      i++;
      continue;
    }

    // $$ → literal $
    if (c === "$" && next === "$") {
      out += "$";
      i += 2;
      continue;
    }

    // $? → last exit code
    if (c === "$" && next === "?") {
      out += String(lastExitCode);
      i += 2;
      continue;
    }

    // $(...) → run inner command, substitute output
    if (c === "$" && next === "(") {
      // Find matching close — parens are balanced thanks to parse.js
      let depth = 1;
      let j = i + 2;
      while (j < token.length && depth > 0) {
        if (token[j] === "(") depth++;
        else if (token[j] === ")") depth--;
        if (depth === 0) break;
        j++;
      }
      const inner = token.slice(i + 2, j);
      const sub   = runSubstitution(inner);
      out += sub;
      i = j + 1;
      continue;
    }

    // ${name} → bracketed var
    if (c === "$" && next === "{") {
      const close = token.indexOf("}", i + 2);
      if (close === -1) {
        // unterminated — treat as literal
        out += c;
        i++;
        continue;
      }
      const name = token.slice(i + 2, close);
      out += (env[name] !== undefined) ? String(env[name]) : "";
      i = close + 1;
      continue;
    }

    // $name → bare var (identifier rules: [A-Za-z_][A-Za-z0-9_]*)
    if (c === "$" && next && /[A-Za-z_]/.test(next)) {
      let j = i + 1;
      while (j < token.length && /[A-Za-z0-9_]/.test(token[j])) j++;
      const name = token.slice(i + 1, j);
      out += (env[name] !== undefined) ? String(env[name]) : "";
      i = j;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}
