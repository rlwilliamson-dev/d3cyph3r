// Lobby-tree commands: `tracks` — control which engagements are
// expanded in the lobby's AVAILABLE ENGAGEMENTS list.
//
// The lobby (js/engine/lobby.js) renders one of two views per track:
//   collapsed:  one-liner with [▸] icon, count, aggregated difficulty
//   expanded:   header + indented per-level lines (status, lesson title)
//
// Expand state is a Set<string> of track keys, persisted in
// sessionStorage under "lobbyExpanded". When the player toggles a
// track, we mutate the set, persist it, and re-render the lobby IF
// they're currently looking at it (otherwise the new state is picked
// up next time they hit the lobby).
//
// Commands:
//   tracks                — show current expand state across all tracks
//   tracks <name>         — toggle expand for the named track
//   tracks all            — expand every track
//   tracks reset          — collapse every track
//
// Smart default (first lobby visit of a session): tracks containing
// at least one visited level auto-expand. This is computed by the
// lobby renderer, not stored — so as the player visits new tracks,
// they expand on the next lobby render automatically.

import { TRACKS } from "../engine/tracks.js";
import { currentLevelKey } from "../engine/state.js";
import { LEVELS } from "../../levels/index.js";
import { showLobby } from "../engine/lobby.js";

const STORAGE_KEY = "lobbyExpanded";

/** Read the expand set from sessionStorage. */
export function readExpanded() {
  try {
    const arr = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    return new Set(Array.isArray(arr) ? arr : []);
  } catch (_) {
    return new Set();
  }
}

/** Persist the expand set to sessionStorage. */
function writeExpanded(set) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch (_) { /* storage disabled — silently no-op */ }
}

/**
 * If the player is currently in the lobby, re-render it so the
 * toggle is immediately reflected. From inside any other level
 * the new state will be visible next time they `exit` back.
 */
function rerenderIfInLobby() {
  const lvl = LEVELS[currentLevelKey];
  if (lvl?.isLobby) showLobby();
}

export const lobbyCommands = {
  tracks(_level, arg) {
    const a = (arg || "").trim();
    const knownKeys = new Set(TRACKS.map(t => t.key));
    const expanded  = readExpanded();

    // `tracks` with no arg: status report.
    if (a === "") {
      const lines = ["  Track expand state:"];
      for (const t of TRACKS) {
        const mark = expanded.has(t.key) ? "[▾]" : "[▸]";
        lines.push(`    ${mark} ${t.key.padEnd(10)} ${t.label}`);
      }
      lines.push("");
      lines.push("  Usage:");
      lines.push("    tracks <name>     toggle expand for one track");
      lines.push("    tracks all        expand every track");
      lines.push("    tracks reset      collapse every track");
      return { text: lines.join("\n"), cls: "out" };
    }

    if (a === "all") {
      for (const t of TRACKS) expanded.add(t.key);
      writeExpanded(expanded);
      rerenderIfInLobby();
      return { text: "All tracks expanded.", cls: "success" };
    }

    if (a === "reset" || a === "none" || a === "collapse") {
      writeExpanded(new Set());
      rerenderIfInLobby();
      return { text: "All tracks collapsed.", cls: "success" };
    }

    if (!knownKeys.has(a)) {
      const validList = TRACKS.map(t => t.key).join(", ");
      return {
        text: `tracks: '${a}' is not a known track.\n  Known tracks: ${validList}\n  Usage: tracks [<name>|all|reset]`,
        cls: "err",
      };
    }

    // Toggle behavior — if already expanded, collapse; otherwise expand.
    const action = expanded.has(a) ? "collapsed" : "expanded";
    if (expanded.has(a)) expanded.delete(a);
    else                 expanded.add(a);
    writeExpanded(expanded);
    rerenderIfInLobby();
    return { text: `Track '${a}' ${action}.`, cls: "success" };
  },
};
