// Main command dispatch. Called by the input handler with each Enter press.
//
// Order of concerns inside execute():
//   1. Echo the entered line to the terminal (unless we're in password mode)
//   2. If awaiting a password, route to ssh.handlePasswordInput
//   3. ssh command: route to ssh.handleSSH
//   4. Look up the command in COMMANDS and invoke its handler
//   5. Fall through to "command not found"

import { LEVELS } from "../../levels/index.js";
import { COMMANDS } from "../../js/commands/index.js";
import { print } from "../terminal/output.js";
import { promptUser, promptHost } from "../terminal/dom.js";
import { currentLevelKey, awaitingPassword } from "./state.js";
import { handleSSH, handlePasswordInput } from "./ssh.js";

export function execute(raw) {
  const input = raw.trim();
  if (!input) return;

  if (!awaitingPassword) {
    const user = promptUser.textContent;
    const host = promptHost.textContent;
    print(`${user}@${host}:~$ ${input}`, "cmd");
  }

  if (awaitingPassword) {
    handlePasswordInput(input);
    return;
  }

  const tokens = input.split(/\s+/);
  const level  = LEVELS[currentLevelKey];

  if (tokens[0] === "ssh") {
    const res = handleSSH(tokens[1]);
    if (res) print(res.text, res.cls);
    return;
  }

  const cmd = tokens[0];
  const arg = tokens.slice(1).join(" ");

  if (COMMANDS[cmd]) {
    const res = COMMANDS[cmd](level, arg);
    if (res) print(res.text, res.cls);
    return;
  }

  print(`${cmd}: command not found. Type 'help' for available commands.`, "err");
}
