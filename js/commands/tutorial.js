// First-visit guided tour (v1.12.0).
//
// Two surfaces:
//   1. Annotated FIRST STEPS list — printed in the lobby's first-visit
//      welcome banner. Shared with `tutorial` (no arg) so re-runs use
//      the same source-of-truth lines.
//   2. Interactive `tutorial start` state machine — walks the player
//      through `help` → `tracks` → `tiers` → `ssh level0@linux` one
//      command at a time. Each step waits for the expected input,
//      nudges if the player types something else (without trapping
//      them), and advances when matched.
//
// State lives in `js/engine/state.js#tourStep`:
//   -1 = not in tour (default)
//    0 → TOUR_STEPS.length - 1 = current step (0-indexed)
//
// Wired into the dispatch loop at js/engine/execute.js, alongside the
// existing awaitingPassword and awaitingPersistenceConsent
// short-circuits. Tour input check runs AFTER those two so the
// password / consent prompts always take priority — you can't get
// trapped in a tour while a password is pending.
//
// Persistence (v1.11.0): the tour status itself is not mirrored to
// localStorage — `tutorial start` is replayable any time. The
// annotated banner is gated by the existing `seenOnboarding`
// sessionStorage flag, which is in the persistence layer's tracked-
// keys registry, so a player who opted into persistence sees the
// banner exactly once across all their sessions on this device.

import { print } from "../terminal/output.js";
import { tourStep, setTourStep, currentLevelKey } from "../engine/state.js";

// ──────────────────────────────────────────────────────────────────
// Shared content
// ──────────────────────────────────────────────────────────────────

/**
 * The numbered "try these commands" list. Imported by both this
 * module's `tutorial` command and `js/engine/lobby.js`'s first-visit
 * welcome banner, so the two surfaces never drift.
 */
export const FIRST_STEPS_LINES = [
  "  NEW HERE?  Try these commands in order — each one teaches",
  "  something you'll use in every level:",
  "",
  "    1.  help                  — list every command available",
  "    2.  tracks                — expand the engagement tree",
  "    3.  tiers                 — see how levels scale (Routine → Crisis)",
  "    4.  progress              — your session checklist (empty for now)",
  "    5.  ssh level0@linux      — enter your first engagement",
  "",
  "  Type 'tutorial' to reprint these steps. Type 'tutorial start'",
  "  for a hand-held walk-through that waits for each command",
  "  (skippable with 'skip' at any prompt).",
];

// ──────────────────────────────────────────────────────────────────
// Interactive tour
// ──────────────────────────────────────────────────────────────────

/**
 * Each step has:
 *   instruction: lines to print as the step intro (printed in "warn"
 *                yellow so it visually stands out from level output).
 *   expected:    string OR RegExp — what the player must type to
 *                advance. RegExp is anchored; trailing whitespace
 *                tolerated.
 *   humanized:   readable form of `expected` for the nudge message
 *                (RegExps are ugly to print, so authors supply
 *                explicit text). Optional for plain-string expecteds.
 */
const TOUR_STEPS = [
  {
    instruction: [
      "─── TUTORIAL  (1/4) ───",
      "",
      "This is a terminal. You'll spend the whole game here. Each",
      "command does one thing — type it, press Enter, read what",
      "comes back. Start with 'help'. It lists every command you've",
      "got available right now.",
      "",
      "Type 'help' and press Enter. ('skip' or 'tutorial skip' to exit.)",
    ],
    expected: "help",
  },
  {
    instruction: [
      "─── TUTORIAL  (2/4) ───",
      "",
      "Good. The categories on the left of that help output group",
      "commands by purpose — you don't need to learn them all up",
      "front. Next, type 'tracks' to expand the engagement tree and",
      "see what work is available.",
    ],
    expected: "tracks",
  },
  {
    instruction: [
      "─── TUTORIAL  (3/4) ───",
      "",
      "Each track is a different client engagement. They're labeled",
      "by difficulty TIER — Routine, Live, Escalated, Critical,",
      "Crisis. Type 'tiers' to see what each label actually means in",
      "operational-tempo terms.",
    ],
    expected: "tiers",
  },
  {
    instruction: [
      "─── TUTORIAL  (4/4) ───",
      "",
      "Ready? Time to start the first engagement. Type",
      "'ssh level0@linux' — that's an inherited consultant laptop at",
      "Halton Bank. Inside, 'hint' will nudge you when stuck, and",
      "'walkthrough' opens the published deep-dive in a new tab.",
      "",
      "Good luck.",
    ],
    expected: /^ssh\s+level0@linux\s*$/i,
    humanized: "ssh level0@linux",
  },
];

const TOUR_COMPLETE_LINES = [
  "─── TUTORIAL COMPLETE ───",
  "",
  "You've got the basics. The annotated FIRST STEPS list lives in",
  "the lobby welcome banner; replay this guided walk-through any",
  "time with 'tutorial start'.",
];

// Outcomes returned by handleTourInput. Strings instead of an enum so
// execute.js can branch via plain switch/equality without extra
// imports.
export const TOUR_RESULT = {
  INACTIVE: "inactive",   // tour not running; caller dispatches normally
  STAY:     "stay",       // mismatch nudge printed; caller dispatches normally
  ADVANCE:  "advance",    // step matched (not last); caller dispatches, then prints next step
  COMPLETE: "complete",   // step matched AND was the last step; caller prints banner, then dispatches
  SKIP:     "skip",       // 'skip' typed; caller does NOT dispatch
};

/** Is a tour currently running? */
export function isTourActive() {
  return tourStep >= 0 && tourStep < TOUR_STEPS.length;
}

/** Print the current step's instruction lines (warn class). */
function printCurrentInstruction() {
  if (!isTourActive()) return;
  print("", "out");
  for (const line of TOUR_STEPS[tourStep].instruction) print(line, "warn");
  print("", "out");
}

/** Print the completion banner. */
function printCompletionBanner() {
  print("", "out");
  for (const line of TOUR_COMPLETE_LINES) print(line, "success");
  print("", "out");
}

/** Re-print step instructions after dispatch — called from execute.js. */
export function reprintStepAfterAdvance() {
  printCurrentInstruction();
}

/** Print the completion banner — called from execute.js. */
export function printTourCompleteBanner() {
  printCompletionBanner();
}

/**
 * Process player input while tour is active. The caller (execute.js)
 * uses the returned TOUR_RESULT to decide whether to dispatch normally,
 * skip dispatch entirely (SKIP), or print extra banners before/after
 * dispatch (COMPLETE / ADVANCE).
 *
 * Side effects: prints mismatch nudges and updates tourStep. Does NOT
 * print step-instruction lines (the caller orchestrates that so
 * ADVANCE's new-instructions print AFTER the dispatched command's
 * output).
 */
export function handleTourInput(input) {
  if (!isTourActive()) return TOUR_RESULT.INACTIVE;

  const raw   = (input || "").trim();
  const lower = raw.toLowerCase();

  // Universal skip — works at any step.
  if (lower === "skip" || lower === "tutorial skip") {
    setTourStep(-1);
    print("", "out");
    print("─── TUTORIAL SKIPPED ─── (run 'tutorial start' to resume)", "dim");
    print("", "out");
    return TOUR_RESULT.SKIP;
  }

  const step = TOUR_STEPS[tourStep];
  const matches = step.expected instanceof RegExp
    ? step.expected.test(raw)
    : raw === step.expected;

  if (!matches) {
    // Gentle nudge, don't trap. Dispatch runs normally so the player
    // sees the result of whatever they typed.
    const want = step.humanized || step.expected;
    print(`(tutorial: type '${want}' to advance — 'skip' to exit)`, "dim");
    return TOUR_RESULT.STAY;
  }

  const wasLastStep = tourStep === TOUR_STEPS.length - 1;
  setTourStep(wasLastStep ? -1 : tourStep + 1);
  return wasLastStep ? TOUR_RESULT.COMPLETE : TOUR_RESULT.ADVANCE;
}

// ──────────────────────────────────────────────────────────────────
// Command surface
// ──────────────────────────────────────────────────────────────────

export const tutorialCommands = {
  /**
   * tutorial               — reprint the FIRST STEPS list
   * tutorial start         — begin the interactive walk-through
   * tutorial skip          — exit the walk-through (when active)
   * tutorial reset         — wipe the seenOnboarding flag so the
   *                          welcome banner shows on the next lobby
   *                          render (mostly a debug aid; players who
   *                          want to replay should use 'tutorial' or
   *                          'tutorial start')
   */
  tutorial(_level, arg) {
    const trimmed = (arg || "").trim().toLowerCase();

    if (trimmed === "start") {
      // Lobby-only guardrail — the four tour steps assume the player
      // is in the lobby (the first three are lobby-context commands;
      // the fourth ssh's out). Running from a non-lobby level would
      // be confusing (e.g. step 2 'tracks' returns "lobby only").
      if (currentLevelKey !== "guest@d3cyph3r") {
        return {
          text: "tutorial: run 'tutorial start' from the lobby. Type 'exit' first to go back.",
          cls: "dim",
        };
      }
      setTourStep(0);
      printCurrentInstruction();
      return null;
    }

    if (trimmed === "skip") {
      if (!isTourActive()) {
        return { text: "tutorial: no walk-through running. Type 'tutorial start' to begin one.", cls: "dim" };
      }
      setTourStep(-1);
      return { text: "─── TUTORIAL SKIPPED ─── (run 'tutorial start' to resume)", cls: "dim" };
    }

    if (trimmed === "reset") {
      // Clear sessionStorage flag; lobby will reprint the welcome
      // banner the next time it renders. (Persistence mirroring picks
      // this up automatically — mirrorSession isn't called for a
      // removeItem, but on the next setItem from showLobby's path,
      // the new value (also "true" after reload) syncs correctly.)
      try { sessionStorage.removeItem("seenOnboarding"); } catch (_) { /* silent */ }
      return {
        text: "tutorial: welcome-banner flag cleared. Return to the lobby (exit, or ssh guest@d3cyph3r) to see the FIRST STEPS list.",
        cls: "info",
      };
    }

    if (trimmed === "" || trimmed === "help") {
      // Reprint the FIRST STEPS list.
      const lines = [
        "─── D3CYPH3R QUICKSTART ───",
        "",
        ...FIRST_STEPS_LINES,
      ];
      return { text: lines.join("\n"), cls: "out" };
    }

    return {
      text: `tutorial: unknown subcommand '${trimmed}'. Try: tutorial / tutorial start / tutorial skip / tutorial reset`,
      cls: "err",
    };
  },
};
