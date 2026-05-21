// Visited-levels tracking + progress bar.
//
// Persistence uses sessionStorage so progress survives reloads within the
// same tab session but resets when the tab closes — matches the original
// behavior. Swap for localStorage if you want cross-session persistence.

import { LEVELS } from "../../levels/index.js";
import { progressFill } from "../terminal/dom.js";

const TOTAL_LEVELS = Object.values(LEVELS).filter(l => !l.isLobby && l.track !== null).length;

export function markVisited(key) {
  if (LEVELS[key]?.isLobby) return;
  const visited = JSON.parse(sessionStorage.getItem("visited") || "[]");
  if (!visited.includes(key)) {
    visited.push(key);
    sessionStorage.setItem("visited", JSON.stringify(visited));
  }
  // Cap progress at 100% — TOTAL_LEVELS can be 0 during early development.
  const pct = TOTAL_LEVELS === 0
    ? 0
    : Math.min(100, Math.round((visited.length / TOTAL_LEVELS) * 100));
  progressFill.style.width = pct + "%";
}
