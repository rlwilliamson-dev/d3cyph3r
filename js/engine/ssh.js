// SSH-style level switching. Mirrors the bandit.labs.overthewire.org UX:
// `ssh level0@linux` connects directly if no password is set, otherwise
// prompts for a password (masked input via the `.password` class).

import { LEVELS } from "../../levels/index.js";
import { print } from "../terminal/output.js";
import { cmdInput, promptUser, promptHost, levelBadge } from "../terminal/dom.js";
import {
  setCurrentLevelKey, currentLevelKey,
  setAwaitingPassword, awaitingPassword,
  resetPath,
} from "./state.js";
import { markVisited } from "./progress.js";
import { showLobby } from "./lobby.js";

export function handleSSH(target) {
  const level = LEVELS[target];
  if (!level) {
    return { text: `ssh: Could not resolve hostname '${target}': Name or service not known`, cls: "err" };
  }
  if (!level.password) { connectTo(target); return null; }

  print(`Connecting to ${target}...`, "dim");
  print(`${target}'s password:`, "info");
  cmdInput.classList.add("password");
  setAwaitingPassword({ target, password: level.password });
  return null;
}

export function handlePasswordInput(val) {
  const { target, password } = awaitingPassword;
  setAwaitingPassword(null);
  cmdInput.classList.remove("password");
  print("", "out");

  if (val === password) {
    print("Access granted.", "success");
    setTimeout(() => connectTo(target), 300);
  } else {
    print("Permission denied, please try again.", "err");
  }
}

export function connectTo(key) {
  setCurrentLevelKey(key);
  const level = LEVELS[key];
  resetPath();
  markVisited(key);
  updatePrompt();

  if (level.isLobby) { showLobby(); return; }

  print("", "out");
  print(`── Connected: ${key}`, "dim");
  print("", "out");
  if (level.lesson) {
    print(level.lesson, "dim");
    print("", "out");
  }
  if (level.objective) {
    print(`Objective: ${level.objective}`, "info");
    print("", "out");
  }
}

function updatePrompt() {
  const [user, host] = currentLevelKey.split("@");
  promptUser.textContent = user;
  promptHost.textContent = host;
  levelBadge.textContent = LEVELS[currentLevelKey]?.isLobby ? "LOBBY" : currentLevelKey.toUpperCase();
}
