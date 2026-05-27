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
import { tierForLevel, levelNumberFromKey } from "./tiers.js";
import { maybePromptForPersistence } from "./persistence.js";
import { recordMilestone, checkAchievements } from "./achievements.js";

export function handleSSH(target) {
  const level = LEVELS[target];
  if (!level) {
    // Three routes for "level lookup miss":
    //   1. Scaffolded track with NO levels yet → warm "track scaffolded"
    //      message (currently unreachable since every track has level0+1
    //      shipped, but kept for forkers / future empty tracks).
    //   2. Well-formed `level<N>@<known-host>` where <N> hasn't shipped
    //      yet → red DNS error + yellow "level isn't built yet" tip.
    //      Distinguishes a future-level attempt from a true typo.
    //   3. Anything else (typos, wrong host, malformed user) → plain
    //      red DNS-style error.
    const host = target.split("@")[1];
    const user = target.split("@")[0];

    // Route 1: scaffolded-only track.
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

    // Route 2: well-formed `level<N>@<known-host>` but N hasn't shipped.
    // Match strictly — `leve4@linux` (typo, missing the `l`) doesn't
    // hit this branch and stays on the plain DNS error.
    const levelMatch = /^level(\d+)$/.exec(user || "");
    if (levelMatch && host && SCAFFOLDED_HOSTS.has(host)) {
      const requestedN  = parseInt(levelMatch[1], 10);
      const shippedNums = Object.keys(LEVELS)
        .map(k => /^level(\d+)@(.+)$/.exec(k))
        .filter(m => m && m[2] === host)
        .map(m => parseInt(m[1], 10))
        .filter(n => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (shippedNums.length > 0) {
        const maxShipped = shippedNums[shippedNums.length - 1];
        if (requestedN > maxShipped) {
          // Red DNS error + yellow follow-up. Mirrors the cold-start
          // gate-hint UX (handlePasswordInput below): keep the error,
          // add a friendly tip pointing at the actual situation.
          print(`ssh: Could not resolve hostname '${target}': Name or service not known`, "err");
          print(`Tip: this level isn't built yet. The ${host} track currently ships level0 through level${maxShipped}. Check back later — new levels release as MINOR bumps, one track at a time.`, "warn");
          return null;
        }
      }
    }

    // Route 3: plain DNS error.
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
      // v1.14.0: record the multi-host pivot for the Multi-Host
      // Pivot achievement. recordMilestone is idempotent.
      recordMilestone("multiHostPivot");
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

  // Tier + estimated time. Tier is computed from the level number
  // (v1.10.0: Routine / Live / Escalated / Critical / Crisis); see
  // `js/engine/tiers.js`. Pivot hosts (non-numbered) return null
  // from tierForLevel and we suppress the tier label for them
  // since they sit off the main difficulty curve. `estimatedMinutes`
  // remains a manual per-level field — keep this side of the line
  // optional so legacy / pivot levels without it stay clean.
  const tier = tierForLevel(levelNumberFromKey(key));
  if (tier || level.estimatedMinutes) {
    const bits = [];
    if (tier)                   bits.push(`Tier: ${tier}`);
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

  // Opt-in persistence prompt (v1.11.0). Fires once per session,
  // ONLY after a successful non-lobby connect (which is exactly
  // this code path). Skipped silently if the player has already
  // enabled persistence on a prior visit, or already seen the
  // prompt this session.
  //
  // Replay-mode re-entries (the cheap "you've already visited"
  // path in handleSSH above) ALSO end up here via connectTo, so
  // the prompt will fire on the first replay if the player closed
  // and reopened the tab without enabling persistence on the
  // original solve. That's intentional — give returning players
  // a chance to opt in.
  maybePromptForPersistence();

  // v1.14.0: ssh is special-cased in execute.js and returns
  // before that file's post-dispatch checkAchievements() fires.
  // markVisited above just added a level to the visited set, so
  // First Steps / Going Deep / Branching Out / All Hands / Track
  // Master could all fire here. Call the check explicitly so the
  // unlock banner shows immediately on connect.
  checkAchievements();
}

function updatePrompt() {
  const level = LEVELS[currentLevelKey];
  levelBadge.textContent = level?.isLobby ? "LOBBY" : currentLevelKey.toUpperCase();
  renderPrompt();
}
