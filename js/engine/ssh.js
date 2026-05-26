// SSH-style level switching. Mirrors the bandit.labs.overthewire.org UX:
// `ssh level0@linux` connects directly if no password is set, otherwise
// prompts for a password (masked input via the `.password` class).

import { LEVELS } from "../../levels/index.js";
import { print } from "../terminal/output.js";
import { cmdInput, levelBadge } from "../terminal/dom.js";
import { renderPrompt } from "../terminal/prompt.js";
import {
  setCurrentLevelKey, currentLevelKey,
  setAwaitingPassword, awaitingPassword,
  resetPath,
  clearProcessEnv, clearJobs,
  hostStack, pushHost, popHost,
} from "./state.js";
import { markVisited } from "./progress.js";
import { showLobby } from "./lobby.js";
import { SCAFFOLDED_HOSTS } from "./tracks.js";

export function handleSSH(target) {
  const level = LEVELS[target];
  if (!level) {
    // Distinguish "unknown hostname" (typo, returns DNS-style error)
    // from "known track, no levels yet" (warm scaffolded-track message).
    // The lobby surfaces both kinds in its engagement list; ssh has to
    // route them differently.
    const host = target.split("@")[1];
    if (host && SCAFFOLDED_HOSTS.has(host) && !Object.values(LEVELS).some(l => l.track === host)) {
      return {
        cls: "warn",
        text:
`ssh: ${target}: This track is scaffolded but no levels are built yet.

The ${host} command surface is wired (type 'help' to see what's available),
but no scenario has been written for it. Future PRs will land levels for
${host}; check the lobby's AVAILABLE ENGAGEMENTS list as new ones ship.`,
      };
    }
    return { text: `ssh: Could not resolve hostname '${target}': Name or service not known`, cls: "err" };
  }
  if (!level.password) { connectTo(target); return null; }

  // Replay mode (v1.8.0): if the player has already visited this
  // level in the current session, skip the password gate. The
  // credential discovery is the puzzle; making them re-do it on
  // every revisit punishes exploration. New session (tab close)
  // resets visited state, so the gate works fresh again.
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { visited = new Set(); }
  if (visited.has(target)) {
    print(`Connecting to ${target}...`, "dim");
    print(`(replay mode — skipping password gate; you've already entered this level this session)`, "dim");
    setTimeout(() => connectTo(target), 200);
    return null;
  }

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
    // Cold-start hint (v1.10.0): if the player tried to enter
    // level<N>@<host> without first visiting level<N-1>@<host>, they
    // can't possibly know the password — it's only seeded by the
    // previous level in the chain. Surface a friendly yellow nudge
    // pointing them at the prerequisite. Skipped for pivot hosts and
    // anything that isn't a `level<N>@<host>` pattern.
    const hint = prerequisiteHint(target);
    if (hint) print(hint, "warn");
  }
}

/**
 * If `target` is a `level<N>@<host>` with N > 0 and the player has
 * NOT visited `level<N-1>@<host>` in this session, return a hint
 * string. Otherwise return null (no hint — player has either earned
 * the credential or isn't trying a numbered level).
 *
 * @param {string} target - e.g. "level2@linux"
 * @returns {string | null}
 */
function prerequisiteHint(target) {
  const m = /^level(\d+)@(.+)$/.exec(target);
  if (!m) return null;                   // pivot host or other non-numbered target
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const host = m[2];
  const prev = `level${n - 1}@${host}`;
  // If the prerequisite level doesn't exist in the registry, there's
  // no useful hint to give (defensive — shouldn't happen for shipped
  // chains, but level<N> may exist before level<N-1> is built).
  if (!LEVELS[prev]) return null;
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { visited = new Set(); }
  if (visited.has(prev)) return null;    // player has the credential
  return `Tip: this level gates on a credential discovered in ${prev}. Try 'ssh ${prev}' first.`;
}

/**
 * Switch the engine into the level identified by `key`.
 *
 * @param {string} key - "<user>@<host>" target.
 * @param {object} [opts]
 * @param {boolean} [opts.unwind=false] - When true, the caller is
 *     responsible for hostStack management (e.g. `exit` already
 *     popped the entry that brought us back here). When false (the
 *     default — forward navigation), this function pushes or clears
 *     the stack to keep it consistent.
 */
export function connectTo(key, opts) {
  const incoming = LEVELS[key];
  const unwind   = !!(opts && opts.unwind);

  // Multi-host pivot bookkeeping. When the caller is unwinding, the
  // stack already reflects the new position — leave it alone.
  if (!unwind) {
    if (incoming?.pivot && currentLevelKey !== "guest@d3cyph3r") {
      // Entering a pivot host: remember where we came from so `exit`
      // can return there. Push only when we're forward-navigating from
      // a non-lobby shell (pivoting from the lobby has no meaning).
      pushHost({ levelKey: currentLevelKey });
    } else if (!incoming?.pivot) {
      // Forward-navigating to a top-level destination: any pivots in
      // the stack are abandoned, since we're leaving the pivot chain.
      hostStack.length = 0;
    }
  }

  // Every level change resets the shell-local state — env vars and the
  // job table belong to the current shell, not the world. (hostStack
  // is the explicit exception, managed above.)
  clearProcessEnv();
  clearJobs();

  setCurrentLevelKey(key);
  const level = LEVELS[key];
  resetPath();
  markVisited(key);
  updatePrompt();

  if (level.isLobby) { showLobby(); return; }

  print("", "out");
  print(`── Connected: ${key}`, "dim");

  // Difficulty + estimated time (v1.8.0 schema fields). Both are
  // optional; render the line only if at least one is present so
  // pre-v1.8 levels stay clean.
  if (level.difficulty || level.estimatedMinutes) {
    const bits = [];
    if (level.difficulty)       bits.push(`Difficulty: ${level.difficulty}`);
    if (level.estimatedMinutes) bits.push(`Est. time: ~${level.estimatedMinutes} min`);
    print(bits.join("   ·   "), "dim");
  }

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
  const level = LEVELS[currentLevelKey];
  levelBadge.textContent = level?.isLobby ? "LOBBY" : currentLevelKey.toUpperCase();
  renderPrompt();
}
