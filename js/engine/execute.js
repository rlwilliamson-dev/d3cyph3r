// Main command dispatch. Called by the input handler with each Enter
// press. The shape of execution is now four layers deep:
//
//   1. Parse the raw input into a statement chain (`parseLine`).
//      Statements are split on `&&` / `||` / `;` at top level;
//      each statement is a pipeline of `|`-separated segments;
//      each segment is a list of tokens with quote markers retained.
//
//   2. Run the chain (`runStatements`):
//        AND → run only if previous statement exited 0
//        OR  → run only if previous statement exited non-0
//        ALWAYS → run unconditionally
//      Updates `$?` (lastExitCode) between statements.
//
//   3. Run each pipeline (`runPipeline`):
//        Threads stdout into the next segment's stdin.
//        Each segment's exit code propagates to the statement's
//        exit code (the last segment wins, mirroring bash with
//        `pipefail` off).
//
//   4. Run each segment (`runSegment`):
//        Expand tokens (vars + $(...) command substitution + brace
//        expansion + quote stripping). Look up the command. Invoke
//        with (level, arg, stdin, argv). Capture exit code.
//
// Echo + ssh + password-mode behavior live above runStatements so
// they're not affected by the chain semantics.

import { LEVELS } from "../../levels/index.js";
import { COMMANDS } from "../../js/commands/index.js";
import { print } from "../terminal/output.js";
import { promptUser, promptHost } from "../terminal/dom.js";
import { currentLevelKey, awaitingPassword, lastExitCode, setLastExitCode } from "./state.js";
import { handleSSH, handlePasswordInput } from "./ssh.js";
import { parseLine, unquote, expandBraces } from "./parse.js";
import { expandTokenVars } from "./expand.js";

/**
 * Top-level entrypoint. Echoes the line, handles password / ssh
 * special-cases, then runs the parsed statement chain.
 */
export function execute(raw) {
  const input = raw.trim();
  if (!input) return;

  // Echo the raw line (before any expansion) so the user sees what
  // they actually typed in history.
  if (!awaitingPassword) {
    const user = promptUser.textContent;
    const host = promptHost.textContent;
    print(`${user}@${host}:~$ ${input}`, "cmd");
  }

  // Password-prompt mode short-circuits everything else.
  if (awaitingPassword) {
    handlePasswordInput(input);
    return;
  }

  // ssh is special-cased above the chain layer — it can't appear in
  // a pipe or be chained with &&/|| (changing levels mid-pipeline
  // would have undefined semantics). We detect it from the raw
  // input's first token.
  const firstWord = input.replace(/^\s+/, "").split(/\s+/)[0];
  if (firstWord === "ssh") {
    const tokens = input.split(/\s+/);
    const res = handleSSH(tokens[1]);
    if (res) print(res.text, res.cls);
    return;
  }

  // Parse + run.
  const stmts = parseLine(input);
  runStatements(stmts);
}

/**
 * Execute a statement chain honoring AND / OR / ALWAYS semantics.
 * Updates `$?` after each statement.
 */
function runStatements(stmts) {
  for (const stmt of stmts) {
    if (stmt.op === "AND" && lastExitCode !== 0) continue;
    if (stmt.op === "OR"  && lastExitCode === 0) continue;
    const code = runPipeline(stmt.segments);
    setLastExitCode(code);
  }
}

/**
 * Run one pipeline (one or more `|`-separated segments). Returns the
 * exit code of the final segment.
 */
function runPipeline(segments) {
  const level = LEVELS[currentLevelKey];
  let stdin = undefined;
  let lastSegCode = 0;

  for (let i = 0; i < segments.length; i++) {
    const tokens = segments[i];
    const isLast = i === segments.length - 1;
    const { result, exitCode } = runSegment(level, tokens, stdin);

    if (isLast) {
      if (result && result.text != null) print(result.text, result.cls);
      lastSegCode = exitCode;
    } else {
      // Mid-pipeline → pass stdout to next stage's stdin (empty when
      // the handler returns null or only-class).
      stdin = result && result.text != null ? String(result.text) : "";
    }
  }
  return lastSegCode;
}

/**
 * Run a single command segment. Handles token expansion, brace
 * expansion, command lookup, and result-to-exit-code conversion.
 *
 * Returns { result, exitCode } where result is the handler's return
 * value (or null) and exitCode is 0 on success, 1 on err / not-found.
 */
function runSegment(level, rawTokens, stdin) {
  if (rawTokens.length === 0) return { result: null, exitCode: 0 };

  // Expand each token: brace, vars, $(...) substitution, quote-strip.
  const argv = expandTokens(rawTokens);
  if (argv.length === 0) return { result: null, exitCode: 0 };

  const cmd = argv[0];
  const arg = argv.slice(1).join(" ");

  const handler = COMMANDS[cmd];
  if (!handler) {
    print(`${cmd}: command not found. Type 'help' for available commands.`, "err");
    return { result: null, exitCode: 127 };  // bash uses 127 for not-found
  }

  const result   = handler(level, arg, stdin, argv.slice(1));
  // Exit code: 1 if the result was an error envelope, 0 otherwise.
  // Commands can override by returning { exitCode: N } in the future;
  // for now we infer from the CSS class.
  const exitCode = result && result.cls === "err" ? 1 : 0;
  return { result, exitCode };
}

/**
 * Expand a list of raw tokens (with quote markers retained) into
 * the final arg array the handler will see:
 *   1. Brace expansion (per-token, expanded BEFORE other expansions).
 *   2. Variable expansion (`$VAR`, `${VAR}`, `$?`) and command
 *      substitution `$(...)` — both quote-aware (skipped inside
 *      single quotes).
 *   3. Quote removal (strip outer ` ' ` or ` " ` after expansion).
 *
 * Glob expansion is NOT done here — individual commands call
 * expandGlobs from `js/fs/glob.js` when they want it. That avoids
 * accidentally expanding globs in commands like `echo *`.
 */
function expandTokens(rawTokens) {
  const out = [];
  for (const raw of rawTokens) {
    // Brace expansion first (string-level, before var expansion so
    // that `{a,b}` doesn't trigger if it came from a $VAR value).
    const braced = expandBraces(raw);
    for (const t of braced) {
      const expanded = expandTokenVars(t, runForOutput);
      out.push(unquote(expanded));
    }
  }
  return out;
}

/**
 * Run an input string and return its captured stdout as a single
 * string. Used by `$(...)` command substitution. The capture is
 * silent — no terminal output, no prompt echo. Recursion is bounded
 * by JavaScript's stack but a user can't realistically nest 1000
 * levels of substitution by hand.
 */
export function runForOutput(input) {
  const stmts = parseLine(input);
  const captured = [];

  // We mirror runStatements / runPipeline / runSegment but redirect
  // the FINAL segment's output into the captured buffer instead of
  // printing. Earlier segments still feed each other via stdin.
  const level = LEVELS[currentLevelKey];
  for (const stmt of stmts) {
    if (stmt.op === "AND" && lastExitCode !== 0) continue;
    if (stmt.op === "OR"  && lastExitCode === 0) continue;

    const segments = stmt.segments;
    let stdin = undefined;
    let segCode = 0;
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1;
      const argv   = expandTokens(segments[i]);
      if (argv.length === 0) continue;
      const cmd  = argv[0];
      const args = argv.slice(1).join(" ");
      const handler = COMMANDS[cmd];
      if (!handler) {
        captured.push(`${cmd}: command not found`);
        segCode = 127;
        break;
      }
      const result = handler(level, args, stdin, argv.slice(1));
      segCode = result && result.cls === "err" ? 1 : 0;
      if (isLast) {
        if (result && result.text != null) captured.push(String(result.text));
      } else {
        stdin = result && result.text != null ? String(result.text) : "";
      }
    }
    setLastExitCode(segCode);
  }
  // Trim trailing newline like bash does for `$(...)`.
  return captured.join("\n").replace(/\n+$/, "");
}
