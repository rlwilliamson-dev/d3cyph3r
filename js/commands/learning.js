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

import { currentLevelKey } from "../engine/state.js";
import { MAN_PAGES } from "./man-pages.js";
import { GLOSSARY } from "./glossary.js";

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
  try {
    sessionStorage.setItem(hintKey(currentLevelKey), String(i));
  } catch (_) { /* sessionStorage unavailable — silent */ }
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
