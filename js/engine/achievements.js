// Achievement registry + check engine (v1.14.0).
//
// 20 achievements layered over data the engine already tracks
// (visited levels, foundBonuses Set, hint counters, theme name,
// persistence flag) plus a small "milestones" flag store for
// "ever done X" tracking that wasn't already there.
//
// THREE STORAGE KEYS
//   sessionStorage / mirrored localStorage:
//     d3cyph3r:earnedAchievements   JSON array of achievement IDs
//                                   that have been earned. Once an
//                                   ID is in here, it stays — even
//                                   if the player's state later
//                                   regresses past the criterion
//                                   (e.g. they `progress reset`
//                                   after earning Sleuth).
//     d3cyph3r:milestones           JSON object of "have you ever
//                                   done X?" flags + the themes-
//                                   seen array. Populated by
//                                   recordMilestone() from various
//                                   handlers around the engine.
//
// FIRE SITE
//   checkAchievements() is called from js/engine/execute.js after
//   the post-dispatch checkBonusFinds line — so a newly-discovered
//   bonus find immediately triggers Polymath/Thorough/Completionist
//   checks in the same pass.
//
// FORKER NOTES
//   - Add a 21st achievement: append a row to ACHIEVEMENTS below.
//     The check function receives a derived-state object (see
//     computeAggregates) that exposes the most useful aggregates.
//     If you need a new aggregate, extend computeAggregates and
//     add a milestone if it needs new tracking.
//   - The "anti-spoiler" rule that applies to bonus finds and
//     `progress --detail` does NOT apply here. Achievement names
//     and descriptions are public from the start — they're
//     motivation, not secrets. Players seeing "Polymath: find a
//     bonus on every track" doesn't spoil the puzzles; it tells
//     them what they're aiming for.

import { print } from "../terminal/output.js";
import { foundBonuses } from "./state.js";
import { mirrorSession, isPersistenceEnabled } from "./persistence.js";
import { LEVELS } from "../../levels/index.js";
import { TRACKS } from "./tracks.js";
import { getTheme } from "../terminal/theme.js";

// Storage keys (sessionStorage; mirrored to localStorage when the
// player has opted in via the v1.11.0 persistence layer).
const EARNED_KEY     = "d3cyph3r:earnedAchievements";
const MILESTONES_KEY = "d3cyph3r:milestones";

/**
 * The 20-achievement registry. Each row:
 *   id          — stable string identifier; written to the earned
 *                 set so renames are migration-affecting (don't
 *                 rename a shipped achievement)
 *   name        — display name shown in unlock banner + listing
 *   tier        — "Easy" | "Medium" | "Hard" | "Completionist"
 *   description — one-line "earn this by..." text
 *   check(ag)   — pure function over the aggregates object; returns
 *                 true when the achievement should be granted
 */
export const ACHIEVEMENTS = [
  // ── Visits + chain progression ─────────────────────────────────
  {
    id: "first-steps", name: "First Steps", tier: "Easy",
    description: "Visit any non-lobby level for the first time.",
    check: (ag) => ag.visited.size > 0,
  },
  {
    id: "first-discovery", name: "First Discovery", tier: "Easy",
    description: "Find your first bonus find.",
    check: (ag) => ag.foundBonusesCount > 0,
  },
  {
    id: "going-deep", name: "Going Deep", tier: "Easy",
    description: "Solve any level1 — the credential chain works.",
    check: (ag) => [...ag.visited].some(k => /^level1@/.test(k)),
  },
  {
    id: "branching-out", name: "Branching Out", tier: "Easy",
    description: "Visit at least one level on 3 different tracks.",
    check: (ag) => ag.visitedTracks.size >= 3,
  },
  {
    id: "pipe-apprentice", name: "Pipe Apprentice", tier: "Easy",
    description: "Chain commands with a pipe `|`.",
    check: (ag) => ag.milestones.pipeUsed === true,
  },
  {
    id: "asked-for-help", name: "Asked for Help", tier: "Easy",
    description: "Read any `man <cmd>` page.",
    check: (ag) => ag.milestones.manRead === true,
  },
  {
    id: "studious", name: "Studious", tier: "Easy",
    description: "Open a `walkthrough` in a new tab.",
    check: (ag) => ag.milestones.walkthroughOpened === true,
  },
  {
    id: "tutorial-graduate", name: "Tutorial Graduate", tier: "Easy",
    description: "Complete the interactive `tutorial start` walk-through.",
    check: (ag) => ag.milestones.tutorialCompleted === true,
  },
  {
    id: "style-points", name: "Style Points", tier: "Easy",
    description: "Try at least 3 different themes.",
    check: (ag) => Array.isArray(ag.milestones.themesSeen) && ag.milestones.themesSeen.length >= 3,
  },
  {
    id: "nineteen-eighty-five", name: "1985", tier: "Easy",
    description: "Set theme to crt-green or amber (retro Easter egg).",
    check: (ag) => ag.themeName === "crt-green" || ag.themeName === "amber",
  },
  {
    id: "persistent-player", name: "Persistent Player", tier: "Easy",
    description: "Opt in to localStorage progress persistence.",
    check: (ag) => ag.persistenceEnabled === true,
  },

  // ── Medium ─────────────────────────────────────────────────────
  {
    id: "all-hands", name: "All Hands", tier: "Medium",
    description: "Touch at least one level on every shipped track.",
    check: (ag) => ag.totalTracks > 0 && ag.visitedTracks.size === ag.totalTracks,
  },
  {
    id: "sleuth", name: "Sleuth", tier: "Medium",
    description: "Find 5+ bonus finds.",
    check: (ag) => ag.foundBonusesCount >= 5,
  },
  {
    id: "multi-host-pivot", name: "Multi-Host Pivot", tier: "Medium",
    description: "Use the multi-host pivot — ssh from inside a level into another host.",
    check: (ag) => ag.milestones.multiHostPivot === true,
  },
  {
    id: "job-runner", name: "Job Runner", tier: "Medium",
    description: "Background a command with `&` and replay it from the job table.",
    check: (ag) => ag.milestones.jobRun === true,
  },

  // ── Hard ───────────────────────────────────────────────────────
  {
    id: "thorough", name: "Thorough", tier: "Hard",
    description: "Find every bonus find within a single track.",
    check: (ag) => ag.trackBonusComplete.size > 0,
  },
  {
    id: "polymath", name: "Polymath", tier: "Hard",
    description: "Find at least one bonus find on every shipped track.",
    check: (ag) => ag.totalTracks > 0 && ag.tracksWithBonus.size === ag.totalTracks,
  },
  {
    id: "hint-avoider", name: "The Hint Avoider", tier: "Hard",
    description: "Solve a level0 without calling `hint`.",
    check: (ag) => ag.hintFreeLevel0 === true,
  },

  // ── Completionist ──────────────────────────────────────────────
  {
    id: "track-master", name: "Track Master", tier: "Completionist",
    description: "Visit every shipped level.",
    check: (ag) => ag.totalLevels > 0 && ag.visited.size === ag.totalLevels,
  },
  {
    id: "completionist", name: "Completionist", tier: "Completionist",
    description: "Find every bonus find across every shipped track.",
    check: (ag) => ag.totalBonuses > 0 && ag.foundBonusesCount === ag.totalBonuses,
  },
];

// ──────────────────────────────────────────────────────────────────
// Milestone (have-you-ever-done-X) tracking
// ──────────────────────────────────────────────────────────────────

/**
 * Read the milestone flag object. Always returns a fresh plain
 * object (no live binding) so callers can read without worrying
 * about mutation.
 */
export function getMilestones() {
  try {
    return JSON.parse(sessionStorage.getItem(MILESTONES_KEY) || "{}");
  } catch (_) {
    return {};
  }
}

/**
 * Record a milestone. `key` is the flag name (e.g. "pipeUsed");
 * `value` is whatever you want stored under it (default: true).
 * Idempotent for boolean flags. For the special "themesSeen" key,
 * appends `value` to an array (deduplicated).
 *
 * After recording, runs the achievement check so newly-met
 * criteria fire their unlock banner immediately. (Without this,
 * something like `theme crt-green` would record the milestone but
 * the player wouldn't see the "1985" unlock until they ran some
 * other command that triggered checkAchievements.)
 */
export function recordMilestone(key, value = true) {
  const m = getMilestones();
  let changed = false;
  if (key === "themesSeen") {
    if (!Array.isArray(m.themesSeen)) m.themesSeen = [];
    if (!m.themesSeen.includes(value)) {
      m.themesSeen.push(value);
      changed = true;
    }
  } else {
    if (m[key] !== value) {
      m[key] = value;
      changed = true;
    }
  }
  if (!changed) return;
  try { mirrorSession(MILESTONES_KEY, JSON.stringify(m)); } catch (_) { /* silent */ }
  checkAchievements();
}

// ──────────────────────────────────────────────────────────────────
// Earned set
// ──────────────────────────────────────────────────────────────────

function readEarnedSet() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(EARNED_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}

function persistEarnedSet(set) {
  try { mirrorSession(EARNED_KEY, JSON.stringify([...set])); } catch (_) { /* silent */ }
}

/** Set of earned achievement IDs (public accessor for the command). */
export function getEarnedAchievements() {
  return readEarnedSet();
}

/** Is the given achievement ID currently earned? */
export function isAchievementEarned(id) {
  return readEarnedSet().has(id);
}

// ──────────────────────────────────────────────────────────────────
// Aggregates — derived state passed to each achievement's check()
// ──────────────────────────────────────────────────────────────────

/**
 * Build the derived-state object the registry's check functions
 * receive. Exported so the `achievements --detail` command can
 * show progress fractions without re-deriving everything.
 */
export function computeAggregates() {
  // Visited levels (Set of level keys).
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { visited = new Set(); }

  // Tracks the player has touched.
  const visitedTracks = new Set();
  for (const key of visited) {
    const t = LEVELS[key]?.track;
    if (t) visitedTracks.add(t);
  }

  // All shipped non-lobby, non-pivot levels.
  const allLevels = Object.entries(LEVELS).filter(([, l]) => !l.isLobby && !l.pivot && l.track);
  const totalLevels = allLevels.length;

  // Bonus counts per track + total.
  const totalBonusesPerTrack = {};
  let totalBonuses = 0;
  for (const [, l] of allLevels) {
    if (!Array.isArray(l.bonusFinds)) continue;
    totalBonusesPerTrack[l.track] = (totalBonusesPerTrack[l.track] || 0) + l.bonusFinds.length;
    totalBonuses += l.bonusFinds.length;
  }

  // Found bonus counts — iterate the foundBonuses Set (entries
  // are "<levelKey>:<findId>") to roll up per-track + total.
  let foundBonusesCount = 0;
  const foundPerTrack = {};
  for (const entry of foundBonuses) {
    foundBonusesCount++;
    const [levelKey] = String(entry).split(":");
    const t = LEVELS[levelKey]?.track;
    if (t) foundPerTrack[t] = (foundPerTrack[t] || 0) + 1;
  }
  const tracksWithBonus = new Set(Object.keys(foundPerTrack));
  const trackBonusComplete = new Set();
  for (const [t, count] of Object.entries(foundPerTrack)) {
    if (totalBonusesPerTrack[t] && count === totalBonusesPerTrack[t]) {
      trackBonusComplete.add(t);
    }
  }

  // The Hint Avoider — any visited level1@<track> whose
  // corresponding level0@<track> has a hint counter of 0.
  // (If the player solved level0 without hints, level1 unlocks via
  // the discovered credential, and the level0 hint counter stays
  // at 0.)
  let hintFreeLevel0 = false;
  for (const key of visited) {
    const m = /^level1@(.+)$/.exec(key);
    if (!m) continue;
    const level0Key = `level0@${m[1]}`;
    try {
      const hintCount = parseInt(sessionStorage.getItem(`d3cyph3r-hint-${level0Key}`) || "0", 10);
      if (hintCount === 0) { hintFreeLevel0 = true; break; }
    } catch (_) { /* skip */ }
  }

  return {
    // Visits
    visited,
    visitedTracks,
    totalLevels,
    totalTracks: TRACKS.length,
    // Bonus finds
    foundBonusesCount,
    totalBonuses,
    tracksWithBonus,
    trackBonusComplete,
    totalBonusesPerTrack,
    foundPerTrack,
    // Skill
    hintFreeLevel0,
    // Flags + features
    milestones: getMilestones(),
    themeName: getTheme().name,
    persistenceEnabled: isPersistenceEnabled(),
  };
}

// ──────────────────────────────────────────────────────────────────
// Main check — wired into execute.js after checkBonusFinds
// ──────────────────────────────────────────────────────────────────

/**
 * Run every achievement's check against current state. Newly-met
 * achievements get added to the earned set + a yellow ★ unlock
 * banner prints inline. Already-earned achievements are skipped
 * (idempotent — safe to call after every command).
 *
 * Errors from individual check functions are caught and swallowed
 * so one buggy check can't break the rest.
 */
export function checkAchievements() {
  const earned = readEarnedSet();
  const ag = computeAggregates();
  const newlyEarned = [];

  for (const a of ACHIEVEMENTS) {
    if (earned.has(a.id)) continue;
    let met = false;
    try { met = !!a.check(ag); } catch (_) { met = false; }
    if (met) {
      earned.add(a.id);
      newlyEarned.push(a);
    }
  }

  if (newlyEarned.length === 0) return;

  persistEarnedSet(earned);

  // Print unlock banner(s). One banner per achievement, separated
  // by blank lines for visual distinction. Yellow (warn) class
  // matches the visual weight of the tutorial-tour-instruction
  // banner — important enough to notice, not so important it
  // steals attention from the level's actual output.
  for (const a of newlyEarned) {
    print("", "out");
    print(`  ★ Achievement unlocked: ${a.name}`, "warn");
    print(`    ${a.description}`, "dim");
    print("", "out");
  }
}
