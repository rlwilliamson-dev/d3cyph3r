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

import { print, printSlow } from "../terminal/output.js";
import { termEl } from "../terminal/dom.js";
import { LEVELS } from "../../levels/index.js";
import { connectTo } from "./ssh.js";
import { VERSION_DISPLAY } from "./version.js";
import { TRACKS } from "./tracks.js";
import { tierForLevel, levelNumberFromKey } from "./tiers.js";
import { mirrorSession } from "./persistence.js";

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

    const chevron = isExpanded ? "[▾]" : "[▸]";
    // Tier surface (v1.10.0): compute from level0's ordinal (always
    // 0 → "Routine" for any track's entry point). The collapsed
    // header reads as "tier at the entry point"; the expanded body
    // shows each level's own tier if/when the track gets deeper.
    const entryTier = tierForLevel(levelNumberFromKey(levels[0]?.key));
    const progressStr     = `${visitedCount}/${shippedCount} visited`;
    const meta = entryTier
      ? `${progressStr} · ${entryTier}`
      : progressStr;
    out.push({
      line: `  ${entryCmd.padEnd(24)} ${chevron} ${t.label.padEnd(22)}  ${meta}`,
      cls: "out",
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
        const title  = level.title ? `   ${level.title}` : "";
        const tier   = tierForLevel(levelNumberFromKey(key));
        const tierTag = tier ? `   [${tier}]` : "";
        const time   = level.estimatedMinutes ? `   ~${level.estimatedMinutes} min` : "";
        const cmd    = `ssh ${key}`.padEnd(24);
        out.push({
          line: `              ${branch} ${cmd} ${mark}${title}${tierTag}${time}`,
          cls: visited ? "success" : "out",
        });
      }
      out.push({ line: "", cls: "out" });
    }
  }
  return out;
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

    print(DIVIDER, "dim");
    print("  FIRST ASSIGNMENT", "success");
    print(DIVIDER, "dim");
    print("", "out");
    print("  ssh level0@linux", "cmd");
    print("", "out");
    print("  Each box hides a password. Find it, use it with ssh to", "dim");
    print("  move to the next box (e.g. ssh level1@linux once you have it).", "dim");
    print("", "out");
  }

  print(DIVIDER, "dim");
  print("  AVAILABLE ENGAGEMENTS", "success");
  print(DIVIDER, "dim");
  print("", "out");
  engagementList().forEach(({ line, cls }) => print(line, cls));
  print(DIVIDER, "dim");
  print("  Type 'tracks <name>' to expand a track, 'tracks all' to expand all.", "dim");
  print("  Type 'tiers' to see what each difficulty label (Routine / Live / Escalated / …) means.", "dim");
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
