// Theme registry + apply / cycle / persist (v1.13.0).
//
// Pre-v1.13.0 this module was a binary dark↔light toggle. v1.13.0
// expands to 11 themes — the original dark/light pair plus 9 new
// looks (CRT phosphor green, VT220 amber, synthwave neon,
// Solarized dark+light, high-contrast accessibility, Nord,
// Gruvbox, Dracula). The CSS palettes live in style.css (and
// walkthroughs/walkthrough.css) under `body[data-theme="<name>"]`
// blocks; this module owns the JS side: the registry, the
// localStorage persistence, the topbar cycle button, and the
// `theme` / `themes` command surface (those live in
// js/commands/themes.js but read from THEMES here).
//
// PERSISTENCE
//   localStorage key: "d3cyph3r-theme" (unchanged from v0.x for
//   compatibility — returning users who set "light" pre-v1.13.0
//   will hydrate cleanly into data-theme="light").
//
// MODE ATTRIBUTE
//   Each theme has a `mode` of "dark" or "light" describing the
//   surface luminance. This drives the moon/sun icon swap in the
//   topbar toggle button (see CSS .theme-icon-sun rules). The
//   attribute lives on body alongside the data-theme attribute.
//
// CROSS-SUBSITE
//   The walkthroughs subsite (separately-served, same origin)
//   reads the same localStorage key and applies the same
//   data-theme attribute — see walkthroughs/walkthrough.js.

/**
 * Theme registry — single source of truth for what themes exist,
 * the cycle order, the human-readable name shown by `themes`, and
 * the mode classification used for the moon/sun icon.
 *
 * Adding a theme:
 *   1. Add a row here.
 *   2. Add a matching `body[data-theme="<name>"]` block in
 *      style.css (main app) AND walkthroughs/walkthrough.css.
 *   3. Bump the CSS cache-bust query in BOTH `index.html` files.
 *   4. Done — the `theme` / `themes` commands and the topbar
 *      cycle button pick it up automatically.
 */
export const THEMES = [
  { name: "dark",             mode: "dark",  label: "Dark — GitHub-flavored default (D3CYPH3R original)" },
  { name: "light",            mode: "light", label: "Light — GitHub-flavored daytime" },
  { name: "crt-green",        mode: "dark",  label: "CRT Green — phosphor terminal, 1980s hacker movie" },
  { name: "amber",            mode: "dark",  label: "Amber — VT220 / IBM 3270 retro Unix" },
  { name: "synthwave",        mode: "dark",  label: "Synthwave — outrun neon on deep purple" },
  { name: "solarized-dark",   mode: "dark",  label: "Solarized Dark — Ethan Schoonover, calm and muted" },
  { name: "solarized-light",  mode: "light", label: "Solarized Light — Schoonover daytime sibling" },
  { name: "high-contrast",    mode: "dark",  label: "High Contrast — accessibility / max-readability" },
  { name: "nord",             mode: "dark",  label: "Nord — calm icy palette" },
  { name: "gruvbox",          mode: "dark",  label: "Gruvbox — warm earthy" },
  { name: "dracula",          mode: "dark",  label: "Dracula — popular dev theme" },
];

const KEY = "d3cyph3r-theme";
const DEFAULT_THEME = "dark";

/**
 * Resolve a theme name to its registry entry. Returns null if the
 * name isn't known. Case-insensitive lookup.
 */
export function findTheme(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  return THEMES.find(t => t.name === lower) || null;
}

/**
 * Apply a theme to the document. Sets `data-theme` + `data-theme-
 * mode` attributes on body and writes the choice to localStorage.
 * Returns the applied theme entry, or null if the name was unknown
 * (no change applied — caller decides whether to error).
 */
export function setTheme(name) {
  const theme = findTheme(name);
  if (!theme) return null;
  document.body.setAttribute("data-theme",      theme.name);
  document.body.setAttribute("data-theme-mode", theme.mode);
  try { localStorage.setItem(KEY, theme.name); } catch (_) { /* private mode */ }
  // v1.14.0: record for Style Points (3+ themes) and 1985
  // (crt-green or amber). Dynamic import to avoid the circular
  // dependency that would result from a static import at top —
  // achievements.js indirectly imports persistence.js, which
  // imports from terminal/output.js, which is already in the
  // dependency tree. A dynamic import sidesteps any top-level
  // initialization-order concerns; the catch handles the case
  // where the module hasn't loaded yet (e.g. during the very
  // first initTheme() call before achievements.js's module init
  // completes).
  //
  // v2.4.2: gated on the game actually being present.
  //
  // This module is shared with the walkthroughs subsite, which uses it
  // purely to apply a palette. There, the import above was pulling the
  // whole engine in behind it: achievements.js statically imports
  // LEVELS from levels/index.js, so every walkthrough page downloaded
  // all seven level-data files. Measured at 906 KB of JavaScript per
  // page, 831 KB of it scenario data that a documentation page has no
  // use for, to record a game achievement that cannot be earned there.
  //
  // #terminal exists only in the main app's index.html, never in a
  // generated walkthrough page, which makes it a reliable and cheap
  // signal. Checked at call time rather than module load so it stays
  // correct regardless of when the DOM is ready.
  if (document.getElementById("terminal")) {
    import("../engine/achievements.js")
      .then(m => m.recordMilestone("themesSeen", theme.name))
      .catch(() => { /* silent — non-critical, milestone will record on next setTheme */ });
  }
  return theme;
}

/** Return the currently-active theme entry. */
export function getTheme() {
  const name = document.body.getAttribute("data-theme") || DEFAULT_THEME;
  return findTheme(name) || THEMES[0];
}

/**
 * Advance to the next theme in the registry order (wraps around
 * past the end). Returns the new theme entry. Used by the topbar
 * cycle button and `theme next`.
 */
export function cycleTheme(direction = 1) {
  const current = getTheme();
  const idx = THEMES.findIndex(t => t.name === current.name);
  const next = ((idx === -1 ? 0 : idx) + direction + THEMES.length) % THEMES.length;
  return setTheme(THEMES[next].name);
}

/**
 * Read the saved preference and apply on page load. Called once
 * from main.js before any rendering — gating it on first paint
 * avoids a flash of the wrong palette.
 *
 * Migration note: pre-v1.13.0 stored only "dark" or "light". Both
 * names still exist in the new registry, so existing values
 * round-trip cleanly. Anything else (a never-set storage entry,
 * a value corrupted by a different app sharing the key) falls
 * back to DEFAULT_THEME without erroring.
 */
export function initTheme() {
  let saved;
  try { saved = localStorage.getItem(KEY); } catch (_) { saved = null; }
  setTheme(findTheme(saved)?.name || DEFAULT_THEME);
}
