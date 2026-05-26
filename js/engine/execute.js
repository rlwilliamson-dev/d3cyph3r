// Main command dispatch. Called by the input handler with each Enter press.
//
// Phases inside execute():
//   1. Echo the entered line to the terminal (unless we're in password mode)
//   2. If awaiting a password, route to ssh.handlePasswordInput
//   3. Shell-var expansion ($USER, $HOME, ${VAR}, etc.)
//   4. ssh special-case (must run before pipe parsing — ssh can't pipe)
//   5. Pipe-split the line and run each segment left-to-right, threading
//      stdout → stdin between stages
//   6. Each segment: look up the command in COMMANDS, invoke with
//      (level, arg, stdin). The FINAL segment's output prints; earlier
//      stages' output becomes the next stage's stdin.
//
// Handler signature: (level, arg, stdin?) → { text, cls } | null
//
//   stdin is undefined when the command is run standalone or as the
//   first segment of a pipe. It's a string when the command is
//   downstream of another stage. Most commands ignore stdin and behave
//   identically; pipe-friendly commands (grep, head, tail, wc, sort,
//   uniq, cut, tr) inspect stdin and read from it when there's no
//   explicit file arg.
//
//   Returning null from a non-final segment passes an empty string
//   as stdin to the next stage (matches bash behavior for commands
//   that produce no stdout).

import { LEVELS } from "../../levels/index.js";
import { COMMANDS } from "../../js/commands/index.js";
import { print } from "../terminal/output.js";
import { promptUser, promptHost } from "../terminal/dom.js";
import { currentLevelKey, awaitingPassword } from "./state.js";
import { handleSSH, handlePasswordInput } from "./ssh.js";
import { expandVars } from "./expand.js";

/**
 * Split a command line on top-level `|` pipes. Whitespace around the
 * pipe operator is consumed. We don't try to honor quoted strings —
 * the engine doesn't have a quoting layer, and there's no level
 * content that needs a literal `|` inside an arg.
 *
 * Returns at least one segment (the whole input when there's no pipe).
 */
function splitPipes(input) {
  return input.split(/\s*\|\s*/);
}

export function execute(raw) {
  const input = raw.trim();
  if (!input) return;

  // Echo the raw line to the terminal (before any expansion — players
  // should see exactly what they typed in the history).
  if (!awaitingPassword) {
    const user = promptUser.textContent;
    const host = promptHost.textContent;
    print(`${user}@${host}:~$ ${input}`, "cmd");
  }

  // Password mode: short-circuit, no expansion / no pipes.
  if (awaitingPassword) {
    handlePasswordInput(input);
    return;
  }

  const level = LEVELS[currentLevelKey];

  // Shell-var expansion runs on the WHOLE line before tokenization,
  // so e.g. `cat $HOME/notes.md` expands then resolvePath handles the
  // absolute path. The echo above used the unexpanded line so the
  // player sees what they actually typed.
  const expanded = expandVars(input, level);

  // ssh is special-cased: it can't appear in a pipe (it changes the
  // current level, no meaningful stdout to pipe), and its arg parsing
  // is bespoke.
  const firstTokens = expanded.split(/\s+/);
  if (firstTokens[0] === "ssh") {
    const res = handleSSH(firstTokens[1]);
    if (res) print(res.text, res.cls);
    return;
  }

  // Pipe-thread the segments left-to-right.
  const segments = splitPipes(expanded);
  let stdin = undefined;

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();
    if (!segment) {
      // Empty segment (e.g. `foo |  | bar`) is a syntax error in bash.
      print("syntax error near unexpected token `|`", "err");
      return;
    }
    const tokens = segment.split(/\s+/);
    const cmd    = tokens[0];
    const arg    = tokens.slice(1).join(" ");

    const handler = COMMANDS[cmd];
    if (!handler) {
      print(`${cmd}: command not found. Type 'help' for available commands.`, "err");
      return;
    }

    const isLast = i === segments.length - 1;
    const res    = handler(level, arg, stdin);

    if (isLast) {
      // Last stage → print to terminal.
      if (res) print(res.text, res.cls);
    } else {
      // Mid-pipeline stage → pass stdout to next segment as stdin.
      // null result becomes empty string (handler chose to print
      // nothing; downstream sees no input).
      stdin = res ? String(res.text ?? "") : "";
    }
  }
}
