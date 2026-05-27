// save / restore — stateless progress codes (v1.20.0).
//
// Player-facing layer over js/engine/savecode.js. Two commands:
//
//   save               Generate a portable code containing the current
//                      session's progress; print it with copy
//                      instructions.
//
//   restore <code>     Validate a code, show a before-vs-after diff
//                      vs. the player's current state, and prompt
//                      for confirmation before overwriting.
//   restore --preview <code>
//                      Decode + summarize a code WITHOUT applying it.
//                      Useful for sanity-checking a code (yours, a
//                      friend's, an old note) before committing to
//                      overwrite.
//
// CONFIRMATION FLOW
//   `restore <code>` calls decodeProgress + summarize, prints the
//   diff, prints "[y/N]", stashes the decoded payload into
//   state.js#awaitingRestoreConfirmation, and returns null. The next
//   line the player types is routed to handleRestoreConfirmation by
//   execute.js (mirroring the password and persistence-consent gates
//   above it in the dispatch chain). 'y' / 'Y' / 'yes' applies the
//   payload and triggers a page reload so the engine boots into the
//   restored state from a clean slate. Anything else cancels and
//   clears the gate.
//
// WHY RELOAD INSTEAD OF IN-PLACE
//   applyDecoded() writes to sessionStorage + rehydrates the
//   in-memory mirrors (foundBonuses Set, levelTimes map). That
//   covers most of the surface, but a handful of things (current
//   level key, processEnv map, hostStack, jobs) are scoped to the
//   current shell. The cleanest way to converge them with the
//   restored state — and the closest analogue to "loading a save"
//   in a game — is to drop the player back at the lobby with a
//   fresh boot. A reload achieves that without any module needing
//   bespoke "re-init from scratch" entrypoints.

import { print } from "../terminal/output.js";
import { encodeProgress, decodeProgress, summarizeDecoded, summarizeCurrent, applyDecoded } from "../engine/savecode.js";
import { getTheme, setTheme } from "../terminal/theme.js";
import { setAwaitingRestoreConfirmation } from "../engine/state.js";

/**
 * Wall-clock timestamp → "2025-11-15 10:34 UTC" for the preview line.
 * Uses UTC so the player gets a stable display regardless of timezone
 * (the timestamp is whatever the saving device's clock was; we don't
 * pretend to know either device's timezone).
 */
function formatTimestamp(ts) {
  if (!Number.isFinite(ts)) return "unknown time";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "unknown time";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/**
 * Render a "current → restored" diff line for the confirmation prompt.
 * When both sides are 0, suppress entirely; when only one side has
 * content, still show it so the player understands what's changing.
 *
 * @param {string} label    Human-readable label (e.g. "Visited levels")
 * @param {number} current  Count in the current session
 * @param {number} restored Count in the decoded payload
 * @returns {string|null}  The line, or null when both sides are zero
 */
function diffLine(label, current, restored) {
  if (current === 0 && restored === 0) return null;
  const arrow = current === restored ? "→ unchanged" : `→ ${restored}`;
  return `    ${label.padEnd(22)} ${String(current).padStart(3)}  ${arrow}`;
}

function printPreview(sumDecoded, header) {
  print("", "out");
  print(header, "warn");
  print("", "out");
  if (sumDecoded.timestamp) {
    print(`    Created:                ${formatTimestamp(sumDecoded.timestamp)}`, "dim");
    print("", "out");
  }
  print(`    Visited levels:         ${sumDecoded.visitedCount}`,        "out");
  print(`    Levels solved:          ${sumDecoded.solvedCount}`,         "out");
  print(`    Achievements earned:    ${sumDecoded.achievementsCount}`,   "out");
  print(`    Bonus finds:            ${sumDecoded.bonusFindsCount}`,     "out");
  print(`    Levels with time:       ${sumDecoded.timedLevelsCount}`,    "out");
  print(`    Hint counters set:      ${sumDecoded.hintCountersCount}`,   "out");
  if (sumDecoded.theme)              print(`    Theme:                  ${sumDecoded.theme}`,             "out");
  if (sumDecoded.onboardingSeen)     print(`    Onboarding seen:        yes`,                              "out");
  if (sumDecoded.expandedTracksCount) print(`    Expanded lobby tracks:  ${sumDecoded.expandedTracksCount}`,"out");
  print("", "out");
}

function printDiff(sumCurrent, sumDecoded) {
  const lines = [
    diffLine("Visited levels:",    sumCurrent.visitedCount,        sumDecoded.visitedCount),
    diffLine("Levels solved:",     sumCurrent.solvedCount,         sumDecoded.solvedCount),
    diffLine("Achievements:",      sumCurrent.achievementsCount,   sumDecoded.achievementsCount),
    diffLine("Bonus finds:",       sumCurrent.bonusFindsCount,     sumDecoded.bonusFindsCount),
    diffLine("Levels with time:",  sumCurrent.timedLevelsCount,    sumDecoded.timedLevelsCount),
    diffLine("Hint counters:",     sumCurrent.hintCountersCount,   sumDecoded.hintCountersCount),
  ].filter(Boolean);

  print("", "out");
  print("  This will OVERWRITE your current progress:", "warn");
  print("", "out");
  for (const line of lines) print(line, "out");
  if (sumDecoded.theme && sumDecoded.theme !== sumCurrent.theme) {
    print(`    Theme:                 ${sumCurrent.theme || "(none)"} → ${sumDecoded.theme}`, "out");
  }
  print("", "out");
  print("  Type 'y' to restore (overwrites + reloads), anything else cancels.", "dim");
  print("  [y/N]", "warn");
}

export const savecodeCommands = {
  /**
   * save: generate and print a progress code reflecting the current
   * session. No arguments. The code is printed inside divider lines
   * so it's easy to copy without grabbing surrounding text.
   *
   * Returns null because the print() calls handle the multi-line
   * output (success class for the header, plain for the code body,
   * dim for the instructions). A single { text, cls } return would
   * collapse everything to one class.
   */
  save(_level, arg) {
    const trimmed = (arg || "").trim();
    if (trimmed) {
      return { text: "save: takes no arguments. Usage: save", cls: "err" };
    }

    let themeName = null;
    try { themeName = getTheme().name; } catch (_) { /* default */ }

    let code;
    try {
      code = encodeProgress(themeName);
    } catch (e) {
      return { text: `save: failed to encode progress (${e && e.message ? e.message : "unknown error"})`, cls: "err" };
    }

    print("", "out");
    print("  Your D3CYPH3R progress code:", "success");
    print("", "out");
    print("  ────────────────────────────────────────────────────────────────", "dim");
    // Print the code as ONE line so a triple-click selects the whole
    // string. Wrapping would split selection across multiple terminal
    // line divs.
    print("  " + code, "out");
    print("  ────────────────────────────────────────────────────────────────", "dim");
    print("", "out");
    print("  Save it somewhere safe (notes app, email to yourself, paper).", "dim");
    print("  On any browser, paste it back with:  restore <code>", "dim");
    print("  Preview without applying:            restore --preview <code>", "dim");
    print("", "out");
    return null;
  },

  /**
   * restore: validate a code; either preview-only (--preview) or set
   * up the confirmation gate that the dispatcher routes the next
   * line's input through.
   */
  restore(_level, arg) {
    const argv = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (argv.length === 0) {
      return {
        text:
`Usage:
  restore <code>             validate, show a diff vs. your current progress, then prompt for [y/N]
  restore --preview <code>   decode + summarize without changing anything

Codes come from \`save\`. They're long; paste-don't-type. Hyphens and
line breaks are decorative — the decoder ignores both.`,
        cls: "err",
      };
    }

    let preview = false;
    let codeParts = [];
    for (const tok of argv) {
      if (tok === "--preview" || tok === "-p") preview = true;
      else codeParts.push(tok);
    }
    const code = codeParts.join("");

    if (!code) {
      return { text: "restore: no code provided. Usage: restore <code>", cls: "err" };
    }

    const decoded = decodeProgress(code);
    if (!decoded.ok) {
      return { text: `restore: ${decoded.error}`, cls: "err" };
    }
    const sumDecoded = summarizeDecoded(decoded);

    if (preview) {
      printPreview(sumDecoded, "  Progress code preview (no changes will be made):");
      print("  Run without --preview to apply (you'll get a confirmation prompt).", "dim");
      print("", "out");
      return null;
    }

    // Non-preview: stash the decoded payload and ask for confirmation.
    let themeName = null;
    try { themeName = getTheme().name; } catch (_) { /* default */ }
    const sumCurrent = summarizeCurrent(themeName);

    printPreview(sumDecoded, "  Progress code contents:");
    printDiff(sumCurrent, sumDecoded);

    setAwaitingRestoreConfirmation(decoded);
    return null;
  },
};

/**
 * Handle the player's y/N response to a `restore <code>` confirmation
 * prompt. Called from execute.js when awaitingRestoreConfirmation is
 * set, in the same position the password and persistence-consent
 * gates occupy.
 *
 * Always clears the gate, regardless of the player's response.
 *
 * Apply path (y / yes):
 *   1. applyDecoded() — wipes + writes sessionStorage, rehydrates the
 *      in-memory mirrors (foundBonuses Set, levelTimes map).
 *   2. setTheme() — applies the restored theme name via the existing
 *      theme API (handles localStorage write + DOM swap).
 *   3. window.location.reload() — fires after a brief delay so the
 *      success line renders before the page navigates away. The
 *      reload boots into the restored state with no stale in-memory
 *      objects (current level key, processEnv, jobs, hostStack all
 *      reset to lobby defaults).
 *
 * @param {string} input The line the player just typed.
 * @param {object|null} pending The decoded payload stashed by the
 *   restore command. Same shape that decodeProgress returns.
 */
export function handleRestoreConfirmation(input, pending) {
  setAwaitingRestoreConfirmation(null);

  const v = (input || "").trim().toLowerCase();
  const yes = v === "y" || v === "yes";

  print("", "out");
  if (!yes) {
    print("  Restore cancelled — your current progress is unchanged.", "dim");
    print("", "out");
    return;
  }

  if (!pending || !pending.ok) {
    // Shouldn't reach here — the gate is only set with a valid
    // payload — but defend against state weirdness.
    print("  Restore cancelled — the stashed code was no longer valid.", "err");
    print("", "out");
    return;
  }

  let applied;
  try {
    applied = applyDecoded(pending);
  } catch (e) {
    print(`  Restore failed: ${e && e.message ? e.message : "unknown error"}.`, "err");
    print("", "out");
    return;
  }

  if (applied && applied.themeName) {
    try { setTheme(applied.themeName); } catch (_) { /* silent — theme will revert to default on reload */ }
  }

  print("  Progress restored. Reloading…", "success");
  print("", "out");

  // Brief delay so the success line renders before the page reloads
  // and replaces the DOM.
  setTimeout(() => {
    try { window.location.reload(); } catch (_) { /* non-browser env */ }
  }, 1200);
}
