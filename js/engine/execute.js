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
import {
  currentLevelKey, awaitingPassword, awaitingPersistenceConsent,
  lastExitCode, setLastExitCode,
  setEnvVar, addJob,
} from "./state.js";
import { handleSSH, handlePasswordInput } from "./ssh.js";
import { handlePersistenceConsent } from "./persistence.js";
import {
  handleTourInput, reprintStepAfterAdvance, printTourCompleteBanner,
  TOUR_RESULT,
} from "../commands/tutorial.js";
import { parseLine, unquote, expandBraces } from "./parse.js";
import { expandTokenVars, getEnv } from "./expand.js";
import { checkBonusFinds } from "./bonus.js";
import { renderPrompt } from "../terminal/prompt.js";
import { dequoteAssignmentValue } from "../commands/env.js";

/** Valid variable name for inline assignments (POSIX shell identifier). */
const VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Top-level entrypoint. Echoes the line, handles password / ssh
 * special-cases, then runs the parsed statement chain.
 */
export function execute(raw) {
  const input = raw.trim();
  // Blank input is a no-op for normal dispatch BUT must still route
  // to the persistence-consent handler when one is pending — the
  // prompt explicitly tells the player that pressing Enter alone
  // counts as opt-out, so we can't drop it on the floor.
  if (!input && !awaitingPersistenceConsent) return;

  // Echo the raw line (before any expansion) so the user sees what
  // they actually typed in history. We echo with the canonical
  // user@host:cwd$ prefix even when the player has customized PS1 —
  // the transcript stays grep-friendly that way.
  //
  // Skip the echo for password input (masked elsewhere) AND for
  // the v1.11.0 persistence-consent prompt — those are interactive
  // micro-dialogs, not transcript-worthy command lines.
  if (!awaitingPassword && !awaitingPersistenceConsent) {
    const env  = getEnv();
    const user = env.USER || "user";
    const host = (env.HOSTNAME || "host").split(".")[0];
    const home = env.HOME || "/";
    const pwd  = env.PWD  || home;
    const path = pwd === home ? "~" : (pwd.startsWith(home + "/") ? "~" + pwd.slice(home.length) : pwd);
    print(`${user}@${host}:${path}$ ${input}`, "cmd");
  }

  // Password-prompt mode short-circuits everything else.
  if (awaitingPassword) {
    handlePasswordInput(input);
    return;
  }

  // Persistence-consent prompt (v1.11.0) — same short-circuit pattern
  // as the password prompt. The handler restores normal dispatch by
  // clearing awaitingPersistenceConsent in state.js.
  if (awaitingPersistenceConsent) {
    handlePersistenceConsent(input);
    return;
  }

  // First-visit guided tour (v1.12.0). Runs AFTER password + consent
  // so the gated modes always take priority. Outcomes:
  //   SKIP     — player typed 'skip'; tutorial.js already printed
  //              the skipped banner and reset tourStep. Suppress
  //              dispatch (the input wasn't a real command).
  //   COMPLETE — step matched AND was the final step. We print the
  //              completion banner BEFORE dispatch so it lands above
  //              the level0 connection banner / lesson / objective /
  //              persistence prompt that the ssh dispatch will
  //              produce.
  //   ADVANCE  — step matched (not last). Dispatch runs first; the
  //              new step's instructions print AFTER, so they're the
  //              last thing on screen and the player sees what to do
  //              next without scrolling up.
  //   STAY     — mismatch. tutorial.js already printed the nudge.
  //              Continue with normal dispatch so the player still
  //              sees the result of whatever they typed.
  //   INACTIVE — no tour running; no-op pass-through.
  const tourResult = handleTourInput(input);
  if (tourResult === TOUR_RESULT.SKIP) return;
  if (tourResult === TOUR_RESULT.COMPLETE) printTourCompleteBanner();

  // ssh is special-cased above the chain layer — it can't appear in
  // a pipe or be chained with &&/|| (changing levels mid-pipeline
  // would have undefined semantics). We detect it from the raw
  // input's first token.
  const firstWord = input.replace(/^\s+/, "").split(/\s+/)[0];
  if (firstWord === "ssh") {
    const tokens = input.split(/\s+/);
    const res = handleSSH(tokens[1]);
    if (res) print(res.text, res.cls);
    // No ADVANCE re-print needed here — the only tour step that uses
    // ssh is the final one, which already produced COMPLETE above.
    return;
  }

  // Parse + run.
  const stmts = parseLine(input);
  runStatements(stmts);

  // Post-dispatch tour hook — print the NEXT step's instructions so
  // they appear after the just-dispatched command's output.
  if (tourResult === TOUR_RESULT.ADVANCE) reprintStepAfterAdvance();

  // Refresh the prompt label — cd may have changed PWD, export may
  // have changed PS1, FOO=bar assignments may have shadowed built-ins,
  // etc. Cheap (single innerHTML update) and keeps the prompt in
  // sync without each command having to remember to call it.
  renderPrompt();
}

/**
 * Execute a statement chain honoring AND / OR / ALWAYS semantics.
 * Updates `$?` after each statement.
 *
 * Background statements (stmt.bg, from trailing `&`) capture their
 * stdout into a job-table entry instead of printing it inline. Real
 * bash would fork and continue immediately; our commands are
 * synchronous so the work is already done by the time we return,
 * but the UX (job ID + replayable `fg`) matches.
 */
function runStatements(stmts) {
  for (const stmt of stmts) {
    if (stmt.op === "AND" && lastExitCode !== 0) continue;
    if (stmt.op === "OR"  && lastExitCode === 0) continue;

    if (stmt.bg) {
      const { code, output } = runPipeline(stmt.segments, true);
      const commandLine = reconstructCommandLine(stmt.segments);
      const job = addJob(commandLine, output);
      print(`[${job.id}] ${10000 + job.id}`, "out");
      setLastExitCode(code);
      continue;
    }

    const { code } = runPipeline(stmt.segments, false);
    setLastExitCode(code);
  }
}

/**
 * Reconstruct a printable command line from token segments. Used to
 * label background jobs in `jobs` output. Imperfect — quoting isn't
 * preserved exactly — but readable.
 */
function reconstructCommandLine(segments) {
  return segments.map(seg => seg.join(" ")).join(" | ");
}

/**
 * Run one pipeline (one or more `|`-separated segments).
 *
 * @param {Array<string[]>} segments - Token segments from the parser.
 * @param {boolean} [capture=false] - When true, the final segment's
 *     output is captured into the returned object instead of being
 *     printed to the terminal. Used for background jobs.
 * @returns {{code: number, output: string}} Final-segment exit code
 *     and (when capturing) the captured stdout. `output` is "" when
 *     not capturing.
 */
function runPipeline(segments, capture = false) {
  const level = LEVELS[currentLevelKey];
  let stdin = undefined;
  let lastSegCode = 0;
  let captured = "";

  for (let i = 0; i < segments.length; i++) {
    const tokens = segments[i];
    const isLast = i === segments.length - 1;
    const { result, exitCode } = runSegment(level, tokens, stdin);

    if (isLast) {
      if (capture) {
        captured = result && result.text != null ? String(result.text) : "";
      } else if (result && result.text != null) {
        print(result.text, result.cls);
        // Side-effect: bonus-find detection on visible output only.
        // Capturing into jobs intentionally skips this — bg work
        // shouldn't quietly award discovery points off-screen.
        checkBonusFinds(level, tokens, result.text);
      }
      lastSegCode = exitCode;
    } else {
      // Mid-pipeline → pass stdout to next stage's stdin (empty when
      // the handler returns null or only-class).
      stdin = result && result.text != null ? String(result.text) : "";
    }
  }
  return { code: lastSegCode, output: captured };
}

/**
 * Run a single command segment. Handles token expansion, brace
 * expansion, command lookup, and result-to-exit-code conversion.
 *
 * Leading `NAME=value` tokens are extracted as inline variable
 * assignments BEFORE command lookup, mirroring bash's behavior:
 *
 *   FOO=bar              → assignment-only, no command run, exit 0
 *   FOO=bar cmd args     → set FOO in env, then run `cmd args`
 *
 * Standard bash temporarily applies assignments for the duration of
 * the command and restores them afterwards. The sandbox simplifies
 * this to a permanent set — assignments stay in processEnv after the
 * command completes. Documented limitation; unlikely to bite players.
 *
 * Returns { result, exitCode } where result is the handler's return
 * value (or null) and exitCode is 0 on success, 1 on err / not-found.
 */
function runSegment(level, rawTokens, stdin) {
  if (rawTokens.length === 0) return { result: null, exitCode: 0 };

  // Expand each token: brace, vars, $(...) substitution, quote-strip.
  const argv = expandTokens(rawTokens);
  if (argv.length === 0) return { result: null, exitCode: 0 };

  // Extract leading NAME=value assignments. We test against the
  // EXPANDED tokens — `FOO=$BAR` should work after $BAR resolves.
  let cursor = 0;
  while (cursor < argv.length && VAR_NAME_RE.test(argv[cursor])) {
    const eq    = argv[cursor].indexOf("=");
    const name  = argv[cursor].slice(0, eq);
    const value = dequoteAssignmentValue(argv[cursor].slice(eq + 1));
    setEnvVar(name, value);
    cursor++;
  }

  // Assignment-only: nothing left to run.
  if (cursor >= argv.length) return { result: null, exitCode: 0 };

  const cmd = argv[cursor];
  const arg = argv.slice(cursor + 1).join(" ");

  const handler = COMMANDS[cmd];
  if (!handler) {
    print(`${cmd}: command not found. Type 'help' for available commands.`, "err");
    return { result: null, exitCode: 127 };  // bash uses 127 for not-found
  }

  const result   = handler(level, arg, stdin, argv.slice(cursor + 1));
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
