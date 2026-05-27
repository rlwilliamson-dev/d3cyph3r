// Lobby screen: ASCII logo, in-world Driftwood welcome (first visit only),
// and the persistent engagement list. Also defines the boot sequence.
//
// The lobby is the user's "home" — they ssh out to tracks and back here.
//
// v1.10.0: AVAILABLE ENGAGEMENTS became a collapsible tree (per-track
// expand state in sessionStorage). The `tracks` command toggles state;
// when the player toggles while in the lobby, we re-render. Smart
// default: tracks with any visited level auto-expand on first session
// render — once they've started a track, it stays expanded until they
// explicitly collapse it.

import { print, printSlow, printRich } from "../terminal/output.js";
import { termEl } from "../terminal/dom.js";
import { LEVELS } from "../../levels/index.js";
import { connectTo } from "./ssh.js";
import { VERSION_DISPLAY } from "./version.js";
import { TRACKS } from "./tracks.js";
import { tierForLevel, levelNumberFromKey } from "./tiers.js";
import { mirrorSession } from "./persistence.js";
import { FIRST_STEPS_LINES } from "../commands/tutorial.js";
import { ACHIEVEMENTS, getEarnedAchievements } from "./achievements.js";
import { getLevelTime, formatTime } from "./leveltimer.js";

// Wordmark rendered char-by-char inside `[ ]` brackets — uniform VT323
// font with a brightness cascade across the 8 characters (bright / mid /
// dim) so the wordmark reads as a "decoded message coming through" with
// fading character emphasis. Pure monochrome — no color accents.
//
// Glyph classes are defined in style.css under `.glyph-*`. Brightness
// classes (.glyph-bright/.glyph-mid/.glyph-dim) use theme-flippable CSS
// variables so the cascade reads correctly in both dark and light mode.
const LOGO_GLYPHS = [
  { ch: "D", cls: "glyph-vt323 glyph-bright" },
  { ch: "3", cls: "glyph-vt323 glyph-mid"    },
  { ch: "C", cls: "glyph-vt323 glyph-mid"    },
  { ch: "Y", cls: "glyph-vt323 glyph-bright" },
  { ch: "P", cls: "glyph-vt323 glyph-dim"    },
  { ch: "H", cls: "glyph-vt323 glyph-mid"    },
  { ch: "3", cls: "glyph-vt323 glyph-dim"    },
  { ch: "R", cls: "glyph-vt323 glyph-bright" },
];

function renderLogo() {
  const banner = document.createElement("div");
  banner.className = "line banner";

  // Opening bracket — JetBrains Mono dim, smaller than the wordmark for
  // visual hierarchy (brand reads as the focus; brackets frame it).
  const lbr = document.createElement("span");
  lbr.className = "glyph-bracket";
  lbr.textContent = "[";
  banner.appendChild(lbr);

  for (const { ch, cls } of LOGO_GLYPHS) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = ch;
    banner.appendChild(span);
  }

  // Closing bracket
  const rbr = document.createElement("span");
  rbr.className = "glyph-bracket";
  rbr.textContent = "]";
  banner.appendChild(rbr);

  termEl.appendChild(banner);
  termEl.scrollTop = termEl.scrollHeight;
}

const DIVIDER = "  ────────────────────────────────────────────────";

// Storage key for the lobby-tree expand state. Exported so the
// `tracks` command (in js/commands/lobby.js) can share the single
// source of truth — there's exactly one sessionStorage entry for
// the expand-set, and exactly one helper module that knows its name.
export const EXPAND_STORAGE_KEY = "lobbyExpanded";

/**
 * Read the set of currently-expanded track keys. On the first read
 * of a session (no storage entry yet), auto-expand any track the
 * player has already visited a level in — once you've started a
 * track, it stays expanded until you explicitly collapse it.
 *
 * Exported so `tracks` (in js/commands/lobby.js) can share the same
 * implementation (and the same seed-on-first-read behavior).
 *
 * @returns {Set<string>} expanded track keys
 */
export function readExpandedTracks() {
  const raw = sessionStorage.getItem(EXPAND_STORAGE_KEY);
  if (raw !== null) {
    try {
      const arr = JSON.parse(raw);
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (_) { return new Set(); }
  }
  // First lobby render of session — seed from visited.
  let visited;
  try { visited = JSON.parse(sessionStorage.getItem("visited") || "[]"); }
  catch (_) { visited = []; }
  const seeded = new Set();
  for (const key of visited) {
    const tk = LEVELS[key]?.track;
    if (tk) seeded.add(tk);
  }
  mirrorSession(EXPAND_STORAGE_KEY, JSON.stringify([...seeded]));
  return seeded;
}

/**
 * Persist a new expand-set to sessionStorage. Exported so the
 * `tracks` command can mutate state through the same single
 * surface that the renderer reads from.
 *
 * @param {Set<string>} set
 */
export function writeExpandedTracks(set) {
  mirrorSession(EXPAND_STORAGE_KEY, JSON.stringify([...set]));
}

/**
 * For a given track key, collect the shipped levels (sorted by
 * level<N> ordinal) and the player's visit state on each.
 *
 * @param {string} trackKey
 * @returns {{
 *   levels: Array<{ key:string, level:object, visited:boolean }>,
 *   visitedCount: number,
 *   shippedCount: number,
 * }}
 */
function gatherTrackLevels(trackKey) {
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { visited = new Set(); }
  // Filter out the lobby and pivot hosts (pivots don't have a `track`
  // anyway, but be defensive).
  const entries = Object.entries(LEVELS)
    .filter(([, l]) => l.track === trackKey && !l.isLobby && !l.pivot);
  // Sort by the numeric portion of `levelN@host` so level0 < level1.
  entries.sort(([a], [b]) => {
    const na = parseInt(a.replace(/^level/, ""), 10);
    const nb = parseInt(b.replace(/^level/, ""), 10);
    return (Number.isFinite(na) ? na : 999) - (Number.isFinite(nb) ? nb : 999);
  });
  const levels = entries.map(([key, level]) => ({
    key, level, visited: visited.has(key),
  }));
  return {
    levels,
    visitedCount: levels.filter(l => l.visited).length,
    shippedCount: levels.length,
  };
}

/**
 * Build the AVAILABLE ENGAGEMENTS lines for the lobby. Each entry is
 * `{ line, cls }`; multi-line tracks contribute several entries in
 * order. The caller just iterates and prints.
 */
function engagementList() {
  const expanded = readExpandedTracks();
  const out = [];

  for (const t of TRACKS) {
    const { levels, visitedCount, shippedCount } = gatherTrackLevels(t.key);
    const isExpanded = expanded.has(t.key);

    // ----- Track header line -----
    // The header always leads with `ssh level0@<host>` (the entry
    // point). Two reasons:
    //   1. New players see actionable text immediately — no need to
    //      expand the track to learn the invocation.
    //   2. The string appears in the lobby at all times, which keeps
    //      the playtest's per-track "lobby lists X" assertions passing
    //      regardless of expand state.
    // Players continuing a track expand it to see level1+ rows.
    const entryCmd = `ssh level0@${t.host}`;
    if (shippedCount === 0) {
      // Scaffolded-only track: keep it terse, dimmed, no expand chevron
      // since there's nothing to drill into.
      out.push({
        line: `  ${entryCmd.padEnd(24)}     ${t.label.padEnd(22)}  (no levels yet)`,
        cls: "dim",
      });
      continue;
    }

    // v1.18.0: fully-solved tracks get the success-green checkmark
    // glyph instead of the expand chevron. v1.19.0: chevrons swap
    // from bracketed `[▾]/[▸]/[✓]` (3 chars) to bare `▼/▶/✓` (1 char
    // + 2 spaces of padding) — bolder, more terminal-conventional,
    // same column width.
    const isComplete = visitedCount === shippedCount && shippedCount > 0;
    const chevron = isComplete
      ? "✓  "
      : (isExpanded ? "▼  " : "▶  ");
    // Tier surface (v1.10.0): compute from level0's ordinal (always
    // 0 → "Routine" for any track's entry point). The collapsed
    // header reads as "tier at the entry point"; the expanded body
    // shows each level's own tier if/when the track gets deeper.
    const entryTier = tierForLevel(levelNumberFromKey(levels[0]?.key));
    // v1.19.0: progress + tier render as colored chips via printRich.
    // The progress chip class depends on completeness (empty / partial
    // / complete); the tier chip class is per-tier.
    const progressCls = isComplete
      ? "chip chip-progress-complete"
      : (visitedCount === 0
        ? "chip chip-progress-empty"
        : "chip chip-progress-partial");
    const tierCls = entryTier
      ? `chip chip-tier-${entryTier.toLowerCase()}`
      : "chip";
    out.push({
      segments: [
        `  ${entryCmd.padEnd(24)} ${chevron}${t.label.padEnd(22)}  `,
        { text: `[${visitedCount}/${shippedCount} visited]`, cls: progressCls },
        entryTier ? "  " : "",
        entryTier ? { text: `[${entryTier}]`, cls: tierCls } : "",
      ],
      cls: isComplete ? "success" : "out",
    });

    // ----- Expanded body -----
    if (isExpanded) {
      if (t.description) {
        out.push({ line: `              ${t.description}`, cls: "dim" });
      }
      for (let i = 0; i < levels.length; i++) {
        const { key, level, visited } = levels[i];
        const last = i === levels.length - 1;
        const branch = last ? "└──" : "├──";
        const mark   = visited ? "✓" : "·";
        const tier   = tierForLevel(levelNumberFromKey(key));
        const cmd    = `ssh ${key}`.padEnd(24);
        // v1.19.0: per-level rows also use chip styling — title gets
        // a brightness bump, tier + time render as colored chips.
        const segments = [
          `              ${branch} ${cmd} ${mark}`,
        ];
        if (level.title) {
          segments.push("   ");
          segments.push({ text: level.title, cls: "chip-title" });
        }
        if (tier) {
          segments.push("   ");
          segments.push({ text: `[${tier}]`, cls: `chip chip-tier-${tier.toLowerCase()}` });
        }
        if (level.estimatedMinutes) {
          segments.push("   ");
          segments.push({ text: `[~${level.estimatedMinutes} min]`, cls: "chip chip-time" });
        }
        out.push({
          segments,
          cls: visited ? "success" : "out",
        });
      }
      out.push({ line: "", cls: "out" });
    }
  }
  return out;
}

/**
 * Compute the lobby's progress-summary numbers. Reads from the same
 * sessionStorage / module state that the rest of the engine uses, so
 * the numbers stay consistent with `progress`, `achievements`, etc.
 *
 * @returns {{
 *   visited:   number,  totalLevels:   number,
 *   foundFinds:number,  totalFinds:    number,
 *   earnedAch: number,  totalAch:      number,
 *   totalTimeMs: number,
 * }}
 */
function computeLobbySummary() {
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { visited = new Set(); }

  // All shipped non-lobby, non-pivot levels.
  const realLevels = Object.entries(LEVELS)
    .filter(([, l]) => !l.isLobby && !l.pivot && l.track);
  const totalLevels = realLevels.length;

  // Bonus finds — count totals + discovered.
  let totalFinds = 0;
  for (const [, l] of realLevels) {
    if (Array.isArray(l.bonusFinds)) totalFinds += l.bonusFinds.length;
  }
  let foundFinds = 0;
  try {
    const arr = JSON.parse(sessionStorage.getItem("d3cyph3r:bonusFinds") || "[]");
    foundFinds = Array.isArray(arr) ? arr.length : 0;
  } catch (_) { foundFinds = 0; }

  // Achievements.
  const earnedAch = getEarnedAchievements().size;
  const totalAch  = ACHIEVEMENTS.length;

  // Total time across all timed levels. getLevelTime returns the
  // zero-record default for never-timed levels so this is safe.
  let totalTimeMs = 0;
  for (const [key] of realLevels) {
    totalTimeMs += (getLevelTime(key).totalMs || 0);
  }

  return {
    visited: visited.size,
    totalLevels,
    foundFinds,
    totalFinds,
    earnedAch,
    totalAch,
    totalTimeMs,
  };
}

/**
 * Find the player's most logical "next" level — the lowest unvisited
 * `level<N+1>@<track>` whose `level<N>@<track>` predecessor has been
 * visited. Returns the level key string, or null when there's no
 * next-up to suggest (no progress yet, or all reachable levels done).
 *
 * Ranks by (next-level ordinal, alphabetical track) so a player with
 * progress on multiple tracks gets a deterministic recommendation:
 * the next level1 (or level2) in alphabetical track order, not a
 * random pick.
 */
function findNextUpLevel() {
  let visited;
  try { visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]")); }
  catch (_) { return null; }
  if (visited.size === 0) return null;  // no progress — FIRST STEPS guides

  const candidates = [];
  for (const key of visited) {
    const m = /^level(\d+)@(.+)$/.exec(key);
    if (!m) continue;
    const n    = parseInt(m[1], 10);
    const next = `level${n + 1}@${m[2]}`;
    if (LEVELS[next] && !visited.has(next) && !LEVELS[next].pivot) {
      candidates.push({ key: next, ord: n + 1, track: m[2] });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.ord - b.ord || a.track.localeCompare(b.track));
  return candidates[0].key;
}

export function showLobby() {
  termEl.innerHTML = "";
  renderLogo();
  print(`${VERSION_DISPLAY} · A Driftwood Systems property. Security training for the people who already run the infrastructure.`, "dim");
  print("", "out");

  const firstVisit = !sessionStorage.getItem("seenOnboarding");
  if (firstVisit) {
    mirrorSession("seenOnboarding", "true");

    print(DIVIDER, "dim");
    print("  WELCOME TO DRIFTWOOD SYSTEMS", "success");
    print(DIVIDER, "dim");
    print("", "out");
    print("  You've been assigned to the Security Engineering rotation.", "out");
    print("  Driftwood runs ~80 client engagements across ~600 consultants;", "out");
    print("  people roll on, people roll off, and access goes stale.", "out");
    print("", "out");
    print("  Your job: inherit the boxes they leave behind.", "out");
    print("  Find what shouldn't be there.", "out");
    print("", "out");

    // v1.12.0 — annotated FIRST STEPS section. Imported from
    // tutorial.js so the in-game `tutorial` command and this banner
    // share a single source of truth.
    print(DIVIDER, "dim");
    print("  FIRST STEPS", "success");
    print(DIVIDER, "dim");
    print("", "out");
    FIRST_STEPS_LINES.forEach(line => print(line, "out"));
    print("", "out");

    print(DIVIDER, "dim");
    print("  FIRST ASSIGNMENT", "success");
    print(DIVIDER, "dim");
    print("", "out");
    print("  Each box hides a password. Find it, use it with ssh to", "dim");
    print("  move to the next box (e.g. ssh level1@linux once you have", "dim");
    print("  the credential from level0@linux).", "dim");
    print("", "out");
  } else {
    // v1.18.0: returning-visitor welcome-back greeting. Tight
    // single-screen summary that replaces the 3-block first-visit
    // intro. Reads from the same state that progress / achievements
    // do, so numbers stay consistent across surfaces.
    const s = computeLobbySummary();
    print(DIVIDER, "dim");
    print("  WELCOME BACK", "success");
    print(DIVIDER, "dim");
    print("", "out");
    // Build the summary line piecewise so we can drop the time
    // segment when it's still zero (e.g., very early in the
    // session — no need to show "0s" prominently).
    const bits = [
      `${s.visited}/${s.totalLevels} levels visited`,
      `${s.foundFinds}/${s.totalFinds} bonus finds`,
      `${s.earnedAch}/${s.totalAch} achievements`,
    ];
    if (s.totalTimeMs > 0) bits.push(`${formatTime(s.totalTimeMs)} engaged`);
    print("  " + bits.join("  ·  "), "out");
    print("", "out");

    // Next-up recommendation. We compute the lowest unvisited
    // level<N+1>@<track> whose level<N>@<track> has been visited.
    // Skipped when:
    //   - no progress yet (the FIRST STEPS surface is gone on
    //     return visits — but the engagement list below still
    //     shows level0@linux etc., so the player has a path forward)
    //   - all reachable levels are done (no next-up to point at)
    const nextUp = findNextUpLevel();
    if (nextUp) {
      print(`  Continue: ssh ${nextUp}`, "info");
      print("", "out");
    }
  }

  print(DIVIDER, "dim");
  print("  AVAILABLE ENGAGEMENTS", "success");
  print(DIVIDER, "dim");
  print("", "out");
  // v1.19.0: rows have two possible shapes. Plain `{ line, cls }`
  // entries (scaffolded-only tracks, description lines, blank
  // separators) route to print(); chip-styled `{ segments, cls }`
  // entries (track headers + per-level expanded rows) route to
  // printRich() so the inline color spans render correctly.
  engagementList().forEach(row => {
    if (row.segments) printRich(row.segments, row.cls);
    else              print(row.line, row.cls);
  });
  print(DIVIDER, "dim");
  print("  Type 'tracks <name>' to expand a track, 'tracks all' to expand all.", "dim");
  print("  Type 'tiers' to see what each difficulty label (Routine / Live / Escalated / …) means.", "dim");
  // v1.18.0: surface the achievement layer (v1.14.0) from the lobby
  // footer. Shape changes based on earned count so the line stays
  // motivating regardless of whether the player has unlocked any yet.
  const earned = getEarnedAchievements().size;
  if (earned > 0) {
    print(`  ★ ${earned}/${ACHIEVEMENTS.length} achievements earned — type 'achievements' to view.`, "dim");
  } else {
    print("  Type 'achievements' to see what's available — they unlock as you play.", "dim");
  }
  print("  Type 'help' for available commands.", "warn");
  print("", "out");
}

export async function boot() {
  const msgs = [
    "[  0.000] Booting D3CYPH3R kernel 0.1.0...",
    "[  0.091] Initializing virtual filesystem...    OK",
    "[  0.213] Loading level engine...               OK",
    "[  0.334] Mounting /home...                     OK",
    "[  0.512] Starting terminal daemon...           OK",
    "[  0.601] System ready.",
    "",
  ];
  await printSlow(msgs, "dim", 65);
  connectTo("guest@d3cyph3r");
}
