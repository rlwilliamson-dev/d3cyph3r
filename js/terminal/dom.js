// Cache element refs once at module init so the rest of the app
// doesn't pay the document.getElementById cost per keystroke / tick.
//
// Every exported binding maps 1:1 to an element id in index.html.
// Most of these are populated at boot and read continuously; a few
// (the mirror-* triplet) participate in a small typography trick:
//
//   The real <input id="cmd-input"> is invisible (opacity 0). The
//   three mirror spans below the input render the same text in the
//   visible font with a blinking cursor inserted at the caret
//   position. js/input/* keeps the spans in sync with the input's
//   value + selectionStart, so the player sees a pixel-perfect
//   cursor on a custom font that wouldn't natively support one.
//
// Element responsibilities:
//   termEl         scrollable command-output container
//   cmdInput       hidden real <input> capturing keystrokes
//   mirror*        visible text rendered with custom cursor
//   tabHint        small hint surfaced when tab-completion is
//                  ambiguous
//   promptLabel    full prompt label element (rendered dynamically
//                  from PS1 by js/terminal/prompt.js — pre-v1.9.0 had
//                  inner #prompt-user / #prompt-host spans, replaced
//                  by the prompt renderer)
//   levelBadge     top-bar label showing current level + difficulty
//   progressFill   the in-bar progress meter (visited levels)
//   clockEl        top-bar HH:MM:SS clock
export const termEl       = document.getElementById("terminal");
export const cmdInput     = document.getElementById("cmd-input");
export const mirrorBefore = document.getElementById("mirror-before");
export const mirrorCursor = document.getElementById("mirror-cursor");
export const mirrorAfter  = document.getElementById("mirror-after");
export const tabHint      = document.getElementById("tab-hint");
export const promptLabel  = document.getElementById("prompt-label");
export const levelBadge   = document.getElementById("level-badge");
export const progressFill = document.getElementById("progress-fill");
export const clockEl      = document.getElementById("clock");
export const themeToggle  = document.getElementById("theme-toggle");
