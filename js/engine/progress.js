// Visited-levels tracking + progress bar.
//
// Default persistence is sessionStorage — progress survives reloads
// within the same tab session and resets when the tab closes. The
// optional persistence layer (v1.11.0, js/engine/persistence.js)
// mirrors writes to localStorage when the player has opted in;
// mirrorSession() routes both stores through one call so this module
// doesn't need to know whether persistence is on.

import { LEVELS } from "../../levels/index.js";
import { progressFill } from "../terminal/dom.js";
import { mirrorSession } from "./persistence.js";

const TOTAL_LEVELS = Object.values(LEVELS).filter(l => !l.isLobby && l.track !== null).length;

export function markVisited(key) {
  if (LEVELS[key]?.isLobby) return;
  // Defensive read (v1.24.3). sessionStorage["visited"] is normally
  // written by THIS function, so it should always parse cleanly — but
  // DevTools tampering, extensions that touch storage, or a corrupted
  // restore-code apply could leave malformed JSON behind. Without the
  // try/catch a single bad value bricks every subsequent connectTo()
  // call because markVisited throws before the progress bar updates.
  // Falling back to [] loses one tab's worth of visited-set state but
  // keeps the engine usable; the next markVisited write overwrites
  // the corrupted value with valid JSON.
  let visited;
  try {
    visited = JSON.parse(sessionStorage.getItem("visited") || "[]");
    if (!Array.isArray(visited)) visited = [];
  } catch (_) {
    visited = [];
  }
  if (!visited.includes(key)) {
    visited.push(key);
    mirrorSession("visited", JSON.stringify(visited));
  }
  // Cap progress at 100% — TOTAL_LEVELS can be 0 during early development.
  const pct = TOTAL_LEVELS === 0
    ? 0
    : Math.min(100, Math.round((visited.length / TOTAL_LEVELS) * 100));
  progressFill.style.width = pct + "%";
}
