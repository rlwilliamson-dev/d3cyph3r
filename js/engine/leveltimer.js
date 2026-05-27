// Per-level time tracking + solve detection (v1.16.0). Records how
// long the player has spent in each level (total across all visits)
// and the elapsed time at the moment of first solve.
//
// STORAGE
//   sessionStorage key: "d3cyph3r:levelTimes" (also mirrored to the
//   persistence-layer localStorage blob when the player has opted in
//   — the key is in persistence.js#TRACKED_KEYS).
//
// SHAPE
//   {
//     "level0@linux": {
//       totalMs:      750000,    // sum across all visits
//       firstSolveMs: 600000,    // totalMs at the moment of first solve
//       isSolved:     true,
//     },
//     "level1@linux": {
//       totalMs:      300000,
//       firstSolveMs: null,
//       isSolved:     false,
//     },
//     ...
//   }
//
// SOLVE DETECTION
//   Per the v1.16.0 design: visiting `level<N+1>@<track>` proves the
//   player solved `level<N>@<track>` — they couldn't have entered the
//   next level without the credential the previous level leaked. So
//   when stopLevelTimer is called with `solveTarget === level<N+1>`,
//   the just-stopped level<N> gets `isSolved = true` and we capture
//   its current totalMs as firstSolveMs (idempotent — subsequent
//   re-solves don't overwrite). Terminal levels (last in their track,
//   no level<N+1> shipped yet) don't get a solve time. Pivot hosts
//   (non-numbered) don't participate in solve detection.
//
// PIVOTS
//   ssh'ing into a pivot host (level.network entry) doesn't stop the
//   parent level's timer — the pivot exploration is part of solving
//   the parent. ssh.js#connectTo skips both startLevelTimer and
//   stopLevelTimer when the incoming target is a pivot or the call
//   is an unwind (returning from a pivot).
//
// FAILURE POSTURE
//   Storage calls are wrapped in try/catch. The in-memory map is the
//   source of truth during a session; storage is a durability layer.
//   If sessionStorage throws (quota, private mode), the in-game
//   experience still works — we just lose the data on next page load.

import { mirrorSession } from "./persistence.js";

const STORAGE_KEY = "d3cyph3r:levelTimes";

/**
 * In-memory level-times registry. Populated from sessionStorage on
 * boot via initLevelTimer(), kept in sync with storage on every
 * accumulation event.
 */
let levelTimes = {};

/**
 * Wall-clock timestamp (Date.now()) when the player entered the
 * currently-timed top-level engagement, or null when in the lobby.
 * Lives in memory only — on reload we treat the level as freshly
 * entered (we'd otherwise need to know whether the tab was actually
 * open during the elapsed time, which we can't).
 */
let currentLevelEnteredAt = null;
let currentTimedLevelKey  = null;

/**
 * Restore levelTimes from sessionStorage. Called once at boot from
 * main.js, AFTER persistence.js#hydrateFromLocal has copied any
 * persisted blob into sessionStorage. Safe to call multiple times —
 * the last call wins.
 */
export function initLevelTimer() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) { levelTimes = {}; return; }
    const parsed = JSON.parse(raw);
    levelTimes = (parsed && typeof parsed === "object") ? parsed : {};
  } catch (_) {
    levelTimes = {};
  }
}

/**
 * Start a fresh timer for `key`. Called from ssh.js#connectTo when
 * entering a top-level (non-pivot, non-lobby) engagement. Doesn't
 * touch storage — the existing record (if any) keeps its totalMs,
 * we just remember the entry timestamp in memory.
 *
 * @param {string} key - Level key (e.g. "level0@linux").
 */
export function startLevelTimer(key) {
  currentTimedLevelKey  = key;
  currentLevelEnteredAt = Date.now();
}

/**
 * Stop the current timer, accumulating elapsed into the level's
 * totalMs and persisting. If `solveTarget` matches "the next level
 * in the just-stopped level's chain", mark the level solved and
 * capture firstSolveMs (idempotent — only set on first solve).
 *
 * @param {string|null} solveTarget - The level key the player is
 *   navigating TO. Pass null when no solve check is wanted (e.g.,
 *   returning to the lobby).
 */
export function stopLevelTimer(solveTarget = null) {
  if (!currentTimedLevelKey || !currentLevelEnteredAt) {
    currentTimedLevelKey  = null;
    currentLevelEnteredAt = null;
    return;
  }

  const elapsed = Date.now() - currentLevelEnteredAt;
  const prevKey = currentTimedLevelKey;
  currentTimedLevelKey  = null;
  currentLevelEnteredAt = null;

  if (elapsed <= 0) return;

  const record = levelTimes[prevKey] || { totalMs: 0, firstSolveMs: null, isSolved: false };
  record.totalMs = (record.totalMs || 0) + elapsed;

  if (solveTarget && !record.isSolved && isNextInChain(prevKey, solveTarget)) {
    record.isSolved     = true;
    record.firstSolveMs = record.totalMs;
  }

  levelTimes[prevKey] = record;
  persistLevelTimes();
}

/**
 * Flush the running elapsed time into storage WITHOUT stopping the
 * timer. Called by the beforeunload handler in main.js so closing
 * the tab preserves the running clock. Also resets the entry
 * timestamp so subsequent navigation doesn't double-count what we
 * just persisted.
 */
export function flushCurrentLevel() {
  if (!currentTimedLevelKey || !currentLevelEnteredAt) return;
  const now     = Date.now();
  const elapsed = now - currentLevelEnteredAt;
  if (elapsed <= 0) return;

  const record = levelTimes[currentTimedLevelKey] || { totalMs: 0, firstSolveMs: null, isSolved: false };
  record.totalMs = (record.totalMs || 0) + elapsed;
  levelTimes[currentTimedLevelKey] = record;
  currentLevelEnteredAt = now;     // checkpoint — don't double-count
  persistLevelTimes();
}

/**
 * Read the stored time record for a level. Returns a default
 * zero-record when the level has never been timed, so callers don't
 * have to null-check.
 */
export function getLevelTime(key) {
  return levelTimes[key] || { totalMs: 0, firstSolveMs: null, isSolved: false };
}

/**
 * Same as getLevelTime, but adds the currently-running elapsed time
 * for the active level — so `progress --detail` can show a live
 * running clock instead of the last checkpoint.
 */
export function getLiveLevelTime(key) {
  const rec = getLevelTime(key);
  if (key === currentTimedLevelKey && currentLevelEnteredAt) {
    return { ...rec, totalMs: rec.totalMs + (Date.now() - currentLevelEnteredAt) };
  }
  return rec;
}

/**
 * Format elapsed milliseconds for human glance:
 *   <  1s    → "< 1s"
 *   <  1m    → "<S>s"
 *   <  1h    → "<M>m <S>s"
 *   >= 1h    → "<H>h <M>m"      (seconds dropped past the hour mark)
 *   invalid  → "—"
 */
export function formatTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return "< 1s";
  const s = Math.floor(ms / 1000);
  if (s < 60)    return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60)    return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

/**
 * Wipe every in-memory timing record + clear the live timer. Called
 * from `progress reset` (the persistence side already removed the
 * sessionStorage key + localStorage blob; this drops the parallel
 * in-memory state so the next render sees a clean slate).
 */
export function clearLevelTimes() {
  levelTimes = {};
  currentLevelEnteredAt = null;
  currentTimedLevelKey  = null;
}

/**
 * `level<N+1>@<track>` is the next of `level<N>@<track>` (same track,
 * N incremented by exactly 1). Anything else (different track, pivot
 * host, skip-ahead) is NOT a solve trigger.
 */
function isNextInChain(prevKey, nextKey) {
  const a = /^level(\d+)@(.+)$/.exec(prevKey);
  const b = /^level(\d+)@(.+)$/.exec(nextKey);
  if (!a || !b) return false;
  if (a[2] !== b[2]) return false;
  return parseInt(b[1], 10) === parseInt(a[1], 10) + 1;
}

function persistLevelTimes() {
  try {
    mirrorSession(STORAGE_KEY, JSON.stringify(levelTimes));
  } catch (_) { /* silent — storage unavailable */ }
}
