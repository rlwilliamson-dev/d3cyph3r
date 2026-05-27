// Learning-aid commands: hint, man, what-is.
//
// These three are the engine's player-facing self-help layer. They
// exist so a player who's stuck doesn't have to choose between
// banging on the keyboard and reading the walkthrough — there's an
// in-game path that gives progressive nudges (`hint`), command-
// reference lookups (`man`), and concept-glossary lookups
// (`what-is`).
//
// All three follow the same (level, arg, stdin?) → { text, cls } | null
// contract as the rest of the engine.
//
// Schema fields read off the level:
//   level.hints?: string[]    Ordered list of progressively-more-direct
//                             nudges. Surfaced one at a time by `hint`,
//                             with the position tracked per-level in
//                             sessionStorage so it survives reloads
//                             within the same tab session.
//
// Why per-level position tracking instead of a single global counter?
// Tracks are independent — a player might be stuck on level1@network
// and switch over to level0@cloud for a break, then come back. Each
// level's hint progression should resume where they left off.
//
// Why sessionStorage (not localStorage)? Matches the rest of the
// engine's persistence model — tab-scoped progress, no cross-session
// state beyond the theme preference. Closing the tab resets hint
// position alongside the visited-levels list.

import { currentLevelKey, isBonusFound, clearInMemoryProgress } from "../engine/state.js";
import { getLiveLevelTime, formatTime, clearLevelTimes } from "../engine/leveltimer.js";
import { LEVELS } from "../../levels/index.js";
import { MAN_PAGES } from "./man-pages.js";
import { GLOSSARY } from "./glossary.js";
import {
  isPersistenceEnabled, enablePersistence, disablePersistence,
  clearAllProgress, mirrorSession,
} from "../engine/persistence.js";
import { recordMilestone } from "../engine/achievements.js";

// Storage key for the per-level hint counter. The key includes the
// level identifier so multiple levels don't collide.
function hintKey(levelKey) {
  return `d3cyph3r-hint-${levelKey}`;
}

function readHintIndex() {
  try {
    return parseInt(sessionStorage.getItem(hintKey(currentLevelKey)) || "0", 10);
  } catch (_) {
    return 0;
  }
}

function writeHintIndex(i) {
  mirrorSession(hintKey(currentLevelKey), String(i));
}

// Walkthrough URL hint for the current track + level — used as the
// final fallback when the player has exhausted all hints. The path
// follows the walkthroughs subsite's convention
// (`/walkthroughs/<track>/<level>`).
function walkthroughHint(level) {
  if (!level || !level.track) return "";
  const slot = currentLevelKey.split("@")[0]; // levelN
  return `  No more hints — see the full walkthrough at https://www.d3cyph3r.com/walkthroughs/#/${level.track}/${slot}`;
}

export const learningCommands = {
  // hint: print the next nudge for the current level. Each call
  // advances the counter; the level's `hints` array drives the
  // progression. Designed to be safe to spam — past the end of the
  // array the player just gets a polite "see the walkthrough"
  // message instead of an error.
  //
  // `hint reset` / `hint -r` rewinds to the first hint, useful if
  // the player wants to re-read the progression.
  //
  // `hint list` (debug aid) shows how many hints exist and which one
  // the player is on. Doesn't reveal unseen hints.
  hint(level, arg) {
    if (!level || level.isLobby) {
      return { text: "hint: ssh into a level first — the lobby has no hints", cls: "dim" };
    }
    const hints = level.hints || [];
    const trimmed = (arg || "").trim();

    if (trimmed === "reset" || trimmed === "-r" || trimmed === "--reset") {
      if (hints.length === 0) {
        writeHintIndex(0);
        return { text: "hint: this level doesn't have any hints", cls: "dim" };
      }
      // Advance past the hint we're about to print, so the next plain
      // `hint` call surfaces hint #2 (not hint #1 again).
      writeHintIndex(1);
      return { text: `(hint counter reset)\n\n[hint 1/${hints.length}] ${hints[0]}`, cls: "info" };
    }

    if (trimmed === "list" || trimmed === "-l") {
      if (hints.length === 0) return { text: "hint: this level doesn't have any hints", cls: "dim" };
      const at = readHintIndex();
      return {
        text: `${hints.length} hint${hints.length === 1 ? "" : "s"} available for this level. ` +
              `You've seen ${at} so far. Type 'hint' for the next one, or 'hint reset' to start over.`,
        cls: "info",
      };
    }

    if (hints.length === 0) {
      return {
        text: `hint: this level doesn't have any hints yet.\n${walkthroughHint(level)}`.trimEnd(),
        cls: "dim",
      };
    }

    const i = readHintIndex();
    if (i >= hints.length) {
      return {
        text: `(you've seen all ${hints.length} hints for this level)\n${walkthroughHint(level)}`.trimEnd(),
        cls: "dim",
      };
    }

    writeHintIndex(i + 1);
    return {
      text: `[hint ${i + 1}/${hints.length}] ${hints[i]}`,
      cls: "info",
    };
  },

  // man: print a command's manual page. Manpages live in the
  // MAN_PAGES map (one entry per command); follows the standard
  // NAME / SYNOPSIS / DESCRIPTION / EXAMPLES format. Unknown
  // command → standard "No manual entry" message (mirrors `man`).
  //
  // Forkers note: when you add a new command, also add a manpage
  // entry in `js/commands/man-pages.js` so `man <cmd>` doesn't 404
  // on shipped commands.
  man(_level, arg) {
    const cmd = (arg || "").trim().split(/\s+/)[0];
    if (!cmd) return { text: "Usage: man <command>\n  e.g. man ls, man grep, man jwt", cls: "err" };
    const page = MAN_PAGES[cmd];
    if (!page) return { text: `No manual entry for ${cmd}`, cls: "err" };
    // v1.14.0: record for the "Asked for Help" achievement. Only on
    // successful lookups — we want this to mean "read a real manpage,"
    // not "typo'd a command."
    recordMilestone("manRead");
    return { text: page, cls: "out" };
  },

  // what-is: glossary lookup. The GLOSSARY map covers frameworks
  // (NIST, OWASP, MITRE, CWE, CIS), regulations (PCI-DSS, HIPAA,
  // FERPA, GLBA, CMMC, SOC 2, NAIC, NYDFS), certifications
  // (Security+, CySA+, CISSP, etc.), and core technical terms that
  // appear in level lessons-learned (JWT, IDOR, AXFR, evtx, etc.).
  //
  // Lookups are case-insensitive. Unknown term → friendly "not in
  // glossary" message with the canonical-search suggestion.
  // walkthrough: open the matching walkthrough page for the current
  // level in a new tab. Useful when the player wants to compare
  // their solve to the published reference, or just see the level's
  // post-solve deep-dive without leaving the terminal.
  walkthrough(level) {
    if (!level || level.isLobby) {
      return { text: "walkthrough: ssh into a level first to see its walkthrough", cls: "dim" };
    }
    const slot = currentLevelKey.split("@")[0];
    const url  = `/walkthroughs/#/${level.track}/${slot}`;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) { /* popup blocked or non-browser env */ }
    // v1.14.0: record for the "Studious" achievement.
    recordMilestone("walkthroughOpened");
    return {
      text: `Opening walkthrough in new tab: ${url}\n(if your browser blocked the popup, navigate to /walkthroughs/ and pick ${level.track} / ${slot})`,
      cls: "info",
    };
  },

  // progress: list every visited level plus an overall solve count.
  // Visited state lives in sessionStorage (see js/engine/progress.js);
  // we render it as a per-track checklist.
  //
  // Bonus finds (v1.9.0) layer on top: each level may declare a
  // `bonusFinds` array, and `foundBonuses` (state.js) tracks which
  // ones the player has unlocked. By default we render the count
  // (e.g. `[bonuses 1/2]`); pass `--detail` to see each find by name.
  //
  // Anti-spoiler rule (v1.10.0): in --detail mode we ONLY name finds
  // the player has already unlocked. Unfound entries render as
  // `[?] hidden — keep exploring`. Same for un-visited levels: we
  // do not surface the per-level find titles until the player has
  // at least entered the level.
  //
  // v1.11.0 subcommands manage the opt-in persistence layer:
  //   progress save-on   — mirror session progress to localStorage
  //                        going forward (and snapshot current state).
  //   progress save-off  — stop mirroring + delete the localStorage
  //                        blob. Current tab keeps its sessionStorage
  //                        state until the tab closes.
  //   progress reset     — wipe every tracked sessionStorage key + the
  //                        localStorage blob + in-memory state. Does
  //                        NOT change the opt-in flag — a player who
  //                        explicitly opted in stays opted in.
  progress(_level, arg) {
    const trimmed = (arg || "").trim();

    // v1.11.0 subcommands (parse before --detail since they don't
    // share argv with the renderer).
    if (trimmed === "save-on") {
      if (isPersistenceEnabled()) {
        return { text: "progress: already saving to this browser. Use 'progress save-off' to stop.", cls: "dim" };
      }
      enablePersistence();
      return {
        text: "Progress will be saved to this browser (localStorage). Stored only here, never sent to a server. Use 'progress save-off' to stop, or 'progress reset' to wipe.",
        cls: "success",
      };
    }
    if (trimmed === "save-off") {
      if (!isPersistenceEnabled()) {
        return { text: "progress: not currently saving across sessions.", cls: "dim" };
      }
      disablePersistence();
      return {
        text: "Persistence disabled. The browser-stored blob has been deleted; this tab's progress lives only in sessionStorage and will be lost when you close the tab.",
        cls: "warn",
      };
    }
    if (trimmed === "reset") {
      clearAllProgress();
      clearInMemoryProgress();
      // v1.16.0: drop in-memory level-times too. The sessionStorage
      // key + localStorage blob were already wiped by clearAllProgress
      // (d3cyph3r:levelTimes is in TRACKED_KEYS.static), but the
      // in-memory map persists across the reset call — without this,
      // the next progress --detail would still show stale times until
      // the next page load.
      clearLevelTimes();
      const tail = isPersistenceEnabled()
        ? "(Persistence is still ON — new progress will be saved going forward. Use 'progress save-off' to disable it.)"
        : "(Persistence was off; nothing else to clean up.)";
      return {
        text: `Progress wiped — visited levels, bonus finds, hint counters, and lobby state all cleared.\n${tail}\nReload or return to the lobby to see the cleaned state.`,
        cls: "success",
      };
    }

    const detail = trimmed === "--detail";
    let visited;
    try {
      visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]"));
    } catch (_) { visited = new Set(); }
    // Group all non-lobby, non-pivot levels by track. Pivot hosts
    // (level.pivot === true) don't belong to a track and shouldn't
    // appear in the per-track checklist.
    const byTrack = {};
    for (const [key, lvl] of Object.entries(LEVELS)) {
      if (lvl.isLobby || !lvl.track || lvl.pivot) continue;
      (byTrack[lvl.track] ||= []).push(key);
    }
    const tracks = Object.keys(byTrack).sort();
    const lines = [];
    let totalSolved = 0, totalLevels = 0;
    let totalFinds = 0, totalFoundFinds = 0;
    for (const t of tracks) {
      const keys = byTrack[t].sort();
      lines.push(`  ${t.toUpperCase()}`);
      for (const k of keys) {
        const lvl  = LEVELS[k];
        const mark = visited.has(k) ? "✓" : "·";
        const finds = Array.isArray(lvl.bonusFinds) ? lvl.bonusFinds : [];
        const foundCount = finds.filter(f => f.id && isBonusFound(k, f.id)).length;
        totalFinds      += finds.length;
        totalFoundFinds += foundCount;
        // Inline bonus count, but only on levels that actually have
        // any. Suppress the brackets entirely on bonus-free levels so
        // the output stays tidy for older content.
        const bonusTag = finds.length > 0
          ? `   [bonuses ${foundCount}/${finds.length}]`
          : "";
        // v1.16.0: per-level time tag. Visited levels show their
        // accumulated time (live-running for the active level);
        // solved levels also surface the first-solve elapsed. Pivot
        // hosts aren't in this loop (skipped above), so no tag-
        // collision concerns there.
        let timeTag = "";
        if (visited.has(k)) {
          const t = getLiveLevelTime(k);
          if (t.totalMs > 0) {
            timeTag = `   ${formatTime(t.totalMs)}`;
            if (t.isSolved && Number.isFinite(t.firstSolveMs)) {
              timeTag += ` (solve: ${formatTime(t.firstSolveMs)})`;
            }
          }
        }
        lines.push(`    ${mark} ${k}${bonusTag}${timeTag}`);
        if (visited.has(k)) totalSolved++;
        totalLevels++;
        // --detail expansion: only if this level has bonus finds.
        if (detail && finds.length > 0) {
          if (!visited.has(k)) {
            // Anti-spoiler: don't name finds on unvisited levels.
            lines.push(`        (visit the level to discover what's here)`);
          } else {
            for (const f of finds) {
              if (!f.id) continue;
              if (isBonusFound(k, f.id)) {
                lines.push(`        ✦ ${f.name || f.id}`);
              } else {
                lines.push(`        [?] hidden — keep exploring`);
              }
            }
          }
        }
      }
      lines.push("");
    }
    lines.push(`  ${totalSolved} / ${totalLevels} levels visited this session.`);
    if (totalFinds > 0) {
      lines.push(`  ${totalFoundFinds} / ${totalFinds} bonus finds discovered.`);
      if (!detail) {
        lines.push(`  (Run 'progress --detail' to list discovered finds by name.)`);
      }
    }
    // Footer reflects the actual persistence state — v1.11.0 added
    // an opt-in localStorage mirror, and players should see at a
    // glance whether their progress will survive closing the tab.
    if (isPersistenceEnabled()) {
      lines.push(`  (Progress is saved to this browser. 'progress save-off' to stop saving, 'progress reset' to wipe.)`);
    } else {
      lines.push(`  (Progress is per-tab; closing the tab resets it. 'progress save-on' to persist across sessions.)`);
    }
    return { text: lines.join("\n"), cls: "out" };
  },

  // search: cross-level lessons-learned + welcome.md / handoff.md /
  // engagement-notes.md search. Iterates every visited level's text
  // content for the query (case-insensitive). Prints up to N matches
  // per file, with the surrounding line as context.
  //
  // Spoiler-safe: search ONLY visits levels the player has already
  // entered. Players don't accidentally surface lessons-learned
  // content from levels they haven't solved yet.
  search(level, arg) {
    const query = (arg || "").trim();
    if (!query) return { text: "Usage: search <term>", cls: "err" };
    const lc = query.toLowerCase();
    let visited;
    try {
      visited = new Set(JSON.parse(sessionStorage.getItem("visited") || "[]"));
    } catch (_) { visited = new Set(); }
    if (visited.size === 0) {
      return { text: "search: visit at least one level first; search only scans levels you've entered.", cls: "dim" };
    }
    const hits = [];
    for (const key of visited) {
      const lvl = LEVELS[key];
      if (!lvl?.files) continue;
      for (const [path, content] of Object.entries(lvl.files)) {
        if (typeof content !== "string") continue;
        const ls = content.split("\n");
        for (let i = 0; i < ls.length; i++) {
          if (ls[i].toLowerCase().includes(lc)) {
            hits.push(`${key}:${path}:${i + 1}: ${ls[i].trim()}`);
            if (hits.length >= 50) break;  // hard cap to avoid spam
          }
        }
        if (hits.length >= 50) break;
      }
      if (hits.length >= 50) break;
    }
    if (hits.length === 0) return { text: `(no matches for '${query}' in visited levels)`, cls: "dim" };
    return { text: hits.join("\n"), cls: "warn" };
  },

  "what-is"(_level, arg) {
    const term = (arg || "").trim();
    if (!term) {
      return {
        text: "Usage: what-is <term>\n  e.g. what-is CWE, what-is JWT, what-is FERPA",
        cls: "err",
      };
    }
    // Normalize to upper-case for hash lookup, then fall back to the
    // raw entry if the glossary indexes the literal string (e.g.
    // CamelCase terms).
    const upper = term.toUpperCase();
    const entry = GLOSSARY[upper] || GLOSSARY[term];
    if (!entry) {
      return {
        text: `'${term}' is not in the glossary. Try 'what-is' on a CWE id, framework name (NIST, OWASP, MITRE, CIS), regulation (PCI-DSS, HIPAA, FERPA, GLBA, CMMC, SOC2), or term from a lessons-learned post-mortem.`,
        cls: "dim",
      };
    }
    return { text: entry, cls: "out" };
  },
};
