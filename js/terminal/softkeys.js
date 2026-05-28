// Soft-key row for mobile players (v1.21.0).
//
// On phones, the on-screen keyboard is missing characters that
// terminal players type constantly: Tab, Esc, Ctrl-C, the pipe
// glyph, `&&`, `$`, `_`, etc. The soft-key row sits above the
// system keyboard with a horizontal scroll of large tap targets
// that insert those characters at the cursor.
//
// VISIBILITY
// ----------
// Only rendered when state.isMobileMode is true (player bypassed
// the mobile gate or launched the installed PWA). Desktop users
// never see it. The CSS gate is also defensive: even if this
// module ran in error, the row would be `display: none` outside
// of mobile mode.
//
// EXTENSIBILITY
// -------------
// The KEYS array is data-driven. To add a new soft-key:
//   1. Append a {label, value, modifier?} entry below.
//   2. That's it — no other code changes.
//
// Each entry's `label` is what the player sees on the button; the
// `value` is what gets inserted into the input. The optional
// `modifier` field handles keys like Tab and Esc that need to
// trigger a real keydown event rather than just text insertion.

import { cmdInput } from "./dom.js";
import { isMobileMode } from "../engine/state.js";

// Soft-key configuration. APPEND-ONLY makes adding new keys easy;
// reordering is safe (no other code references positions).
const KEYS = [
  // Special-keys that need keydown events (handled below)
  { label: "Tab",  key: "Tab",    special: true },
  { label: "Esc",  key: "Escape", special: true },
  { label: "↑",    key: "ArrowUp", special: true },
  { label: "↓",    key: "ArrowDown", special: true },
  { label: "^C",   key: "c", special: true, ctrl: true },

  // Character keys (just insert the literal value at cursor)
  { label: "|",    value: "|" },
  { label: "&&",   value: " && " },
  { label: "||",   value: " || " },
  { label: ";",    value: "; " },
  { label: ">",    value: " > " },
  { label: "$",    value: "$" },
  { label: "_",    value: "_" },
  { label: "/",    value: "/" },
  { label: "~",    value: "~" },
  { label: "*",    value: "*" },
  { label: ".",    value: "." },
  { label: "-",    value: "-" },
  { label: "=",    value: "=" },
];

/**
 * Build the soft-key row DOM and insert it into the input area
 * (above the on-screen keyboard, below the prompt input). No-op on
 * desktop. Called once from initInput() at boot.
 */
export function initSoftKeys() {
  if (!isMobileMode) return;
  if (document.getElementById("softkey-row")) return;  // idempotent

  const inputArea = document.getElementById("input-area");
  if (!inputArea || !inputArea.parentNode) return;

  const row = document.createElement("div");
  row.id = "softkey-row";
  row.className = "softkey-row";
  row.setAttribute("role", "toolbar");
  row.setAttribute("aria-label", "Terminal soft keys");

  for (const k of KEYS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "softkey-btn";
    btn.textContent = k.label;
    // Prevent the button from stealing focus from cmdInput — without
    // this, tapping a soft-key dismisses the on-screen keyboard
    // because focus moves off the input.
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });

    btn.addEventListener("click", () => handleKey(k));
    row.appendChild(btn);
  }

  // Insert as a SIBLING AFTER #input-area (not inside it). The parent
  // #screen is `display: flex; flex-direction: column`, so this lands
  // the soft-key row directly below the prompt + cmd input — without
  // competing for horizontal space inside #input-area's flex row
  // (which is what squeezed the input field to 0 width on Android in
  // the first v1.21.0 draft).
  inputArea.parentNode.insertBefore(row, inputArea.nextSibling);
}

/**
 * Dispatch a soft-key press. Two paths:
 *   - special: synthesize a real KeyboardEvent so existing readline
 *              handlers in input.js process it correctly (Tab for
 *              autocomplete, Arrow keys for history, Ctrl-C as
 *              break/abort, etc.).
 *   - character: just splice the value into the input at the cursor
 *                and fire an "input" event so the cursor mirror +
 *                tab-hint updates.
 */
function handleKey(k) {
  cmdInput.focus();

  if (k.special) {
    const ev = new KeyboardEvent("keydown", {
      key: k.key,
      code: k.key,
      ctrlKey: !!k.ctrl,
      bubbles: true,
      cancelable: true,
    });
    cmdInput.dispatchEvent(ev);
    return;
  }

  // Character insertion. Use selection range so insertion respects
  // the current caret position + any selection the player has.
  const start = cmdInput.selectionStart ?? cmdInput.value.length;
  const end = cmdInput.selectionEnd ?? cmdInput.value.length;
  const before = cmdInput.value.slice(0, start);
  const after = cmdInput.value.slice(end);
  cmdInput.value = before + k.value + after;
  const newPos = start + k.value.length;
  cmdInput.setSelectionRange(newPos, newPos);

  // Fire input event so the cursor-mirror + tab-hint listeners run.
  cmdInput.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Tap-to-focus: tapping anywhere outside the soft-key row should
 * trigger the on-screen keyboard. The hidden cmd-input element
 * doesn't naturally get focus from a touch on its visible mirror,
 * so we wire explicit click handlers on multiple areas.
 *
 * v1.21.0-r3 expansion: the initial draft only handled clicks on
 * #terminal, which left the prompt row + footer area focus-dead on
 * Android. Now we listen on the parent #screen and just exclude
 * clicks that landed on soft-key buttons (those self-manage focus).
 *
 * Skipped if the tap landed on selected text — selection-then-focus
 * would collapse the selection which is annoying.
 */
export function initTapToFocus() {
  if (!isMobileMode) return;
  const screenEl = document.getElementById("screen");
  if (!screenEl) return;

  const focusIfAllowed = (event) => {
    // Don't steal focus from soft-key buttons — they handle their
    // own focus management via mousedown.preventDefault.
    if (event.target && event.target.closest && event.target.closest(".softkey-btn")) return;
    try {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) return;
    } catch (_) { /* getSelection unavailable */ }
    cmdInput.focus();
  };

  // Click handles desktop + most mobile browsers; touchend handles
  // edge cases where a tap doesn't dispatch a synthetic click (e.g.
  // when there's a scroll gesture in flight).
  screenEl.addEventListener("click", focusIfAllowed);
  screenEl.addEventListener("touchend", focusIfAllowed, { passive: true });

  // Also focus the input proactively on first user gesture — some
  // browsers won't show the soft-keyboard until the input has
  // received explicit focus from a user gesture, and waiting for
  // the player to find the tiny input mirror is a bad first
  // experience.
  document.body.addEventListener("touchend", () => {
    if (document.activeElement !== cmdInput) cmdInput.focus();
  }, { passive: true, once: true });
}
