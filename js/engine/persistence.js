// Opt-in localStorage persistence (v1.11.0).
//
// Most of the engine's progress state lives in sessionStorage — visited
// levels, discovered bonus finds, hint counters, lobby-tree expand
// state, the "you've seen the welcome screen" flag. sessionStorage
// resets when the tab closes; that was the original design, and it
// matches OverTheWire-style wargames where each session is self-
// contained.
//
// v1.11.0 layers an OPT-IN mirror to localStorage on top of that. The
// player is asked once, the first time they successfully ssh into a
// real (non-lobby) level. If they say yes, every write that lands in
// sessionStorage *also* lands in a JSON blob in localStorage; on the
// next page load, we copy the blob back into sessionStorage before any
// other module reads it. If they say no, nothing changes — the engine
// keeps acting like it did before v1.11.0.
//
// PRIVACY POSTURE
// ---------------
// localStorage is entirely client-side. The blob never leaves the
// player's browser. We have no backend, no analytics, no telemetry —
// the site is static HTML/JS on Azure SWA. The opt-in prompt makes
// this explicit so the player doesn't assume the data is being stored
// somewhere else.
//
// WHAT GETS MIRRORED
// ------------------
// Static keys (exact match):
//   "visited"               → JSON array of level keys
//   "d3cyph3r:bonusFinds"   → JSON array of "<levelKey>:<findId>"
//   "lobbyExpanded"         → JSON array of expanded track keys
//   "seenOnboarding"        → "true" once the welcome screen runs
//
// Prefix family (any sessionStorage key starting with the prefix):
//   "d3cyph3r-hint-"        → per-level hint counter
//
// Adding a new tracked sessionStorage key in the future: add it to
// TRACKED_KEYS below AND make sure every write to that key goes
// through mirrorSession() (the helper exported from this module) so
// the persistence layer sees it. The refactor in v1.11.0 routed all
// six existing write sites through mirrorSession; new write sites
// should follow the same convention.
//
// CONFLICT POLICY
// ---------------
// On hydration, sessionStorage WINS. If the player has both a fresh
// session (sessionStorage already populated) AND a persisted blob in
// localStorage, the session is treated as authoritative — hydration
// only writes to keys that are absent from sessionStorage. This makes
// hydration idempotent and prevents stale localStorage data from
// clobbering the current tab's in-progress work.
//
// FAILURE POSTURE
// ---------------
// Every storage call is wrapped in try/catch. localStorage and
// sessionStorage both throw in private-browsing mode, when site data
// is disabled, and when quota is exceeded. We swallow these failures
// silently and let the player keep playing — persistence is a
// convenience, not a hard requirement.

import { print } from "../terminal/output.js";
import { setAwaitingPersistenceConsent } from "./state.js";

const FLAG_KEY    = "d3cyph3r-progress-enabled";   // localStorage: "1" when opted in
const BLOB_KEY    = "d3cyph3r-progress";           // localStorage: JSON blob of mirrored data
const PROMPT_SEEN = "d3cyph3r-prompt-seen";        // sessionStorage: "1" once asked this session

// Registry of sessionStorage keys that get mirrored to the blob.
// Static keys match exactly; prefix keys match any key starting with
// the listed string (used for the dynamic `d3cyph3r-hint-<levelKey>`
// family — one entry per visited level).
const TRACKED_KEYS = {
  static: [
    "visited",
    "d3cyph3r:bonusFinds",
    "lobbyExpanded",
    "seenOnboarding",
    // v1.14.0 — achievement layer keys. Mirrored so opted-in
    // players' earned achievements + milestone flags survive
    // closing the tab.
    "d3cyph3r:earnedAchievements",
    "d3cyph3r:milestones",
  ],
  prefix: ["d3cyph3r-hint-"],
};

/**
 * Is the opt-in flag set in localStorage? Cheap (one getItem call).
 * Returns false on any storage error.
 */
export function isPersistenceEnabled() {
  try {
    return localStorage.getItem(FLAG_KEY) === "1";
  } catch (_) {
    return false;
  }
}

/**
 * Has the player already been asked this session? Used by the
 * connectTo() opt-in prompt to fire exactly once per browser session.
 */
export function wasPersistencePrompted() {
  try {
    return sessionStorage.getItem(PROMPT_SEEN) === "1";
  } catch (_) {
    return true;  // pretend we asked — safer than spamming
  }
}

/** Mark the prompt as seen for this session. */
export function markPersistencePrompted() {
  try { sessionStorage.setItem(PROMPT_SEEN, "1"); } catch (_) { /* silent */ }
}

/**
 * Enable persistence: set the flag, then take a snapshot of every
 * currently-tracked sessionStorage key and write it to the blob so
 * any progress accumulated *before* the player opted in is also
 * preserved (otherwise the first reload would lose everything from
 * the current session).
 */
export function enablePersistence() {
  try {
    localStorage.setItem(FLAG_KEY, "1");
    snapshotSessionToBlob();
  } catch (_) { /* silent */ }
}

/**
 * Disable persistence: clear the flag and remove the blob entirely.
 * sessionStorage keeps its in-progress state for the rest of this
 * tab, but closing the tab will discard it as normal. We deliberately
 * wipe the blob rather than leaving stale data around — leaving it
 * would defeat the privacy posture (the player opted out; their
 * progress shouldn't sit on disk).
 */
export function disablePersistence() {
  try {
    localStorage.removeItem(FLAG_KEY);
    localStorage.removeItem(BLOB_KEY);
  } catch (_) { /* silent */ }
}

/**
 * On boot, if persistence is enabled, copy the blob back into
 * sessionStorage. sessionStorage wins on conflict — we only write to
 * keys that are absent — so calling this twice is safe and a fresh
 * session (no sessionStorage data yet) gets fully repopulated.
 *
 * Called from main.js between initTheme() and loadBonusesFromStorage()
 * so the rehydrated `d3cyph3r:bonusFinds` is in place before
 * state.js#loadBonusesFromStorage reads it.
 */
export function hydrateFromLocal() {
  if (!isPersistenceEnabled()) return;
  let blob;
  try {
    const raw = localStorage.getItem(BLOB_KEY);
    if (!raw) return;
    blob = JSON.parse(raw);
  } catch (_) {
    return;  // malformed blob — leave sessionStorage alone
  }
  if (!blob || typeof blob !== "object") return;
  for (const [key, value] of Object.entries(blob)) {
    if (!isTracked(key)) continue;
    try {
      if (sessionStorage.getItem(key) === null) {
        sessionStorage.setItem(key, value);
      }
    } catch (_) { /* silent */ }
  }
}

/**
 * Write a value to sessionStorage AND, if persistence is enabled,
 * mirror it into the localStorage blob. This is the single chokepoint
 * for every tracked write — all six legacy write sites were refactored
 * to call this in v1.11.0.
 *
 * @param {string} key   sessionStorage key (must be in TRACKED_KEYS)
 * @param {string} value already-stringified value (callers handle
 *                       JSON.stringify themselves; this matches the
 *                       previous setItem signature so the refactor
 *                       is mechanical)
 */
export function mirrorSession(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch (_) { /* silent — keep going even if session storage is full */ }

  if (!isPersistenceEnabled()) return;
  if (!isTracked(key)) return;        // defensive — refuse to mirror untracked keys

  try {
    const raw  = localStorage.getItem(BLOB_KEY);
    const blob = raw ? JSON.parse(raw) : {};
    blob[key] = value;
    localStorage.setItem(BLOB_KEY, JSON.stringify(blob));
  } catch (_) { /* silent — usually quota exceeded */ }
}

/**
 * Wipe every tracked sessionStorage key + the localStorage blob.
 * Used by `progress reset`. Does NOT touch the opt-in flag — a
 * player who runs `progress reset` is starting over with persistence
 * still active (they explicitly opted in; resetting progress doesn't
 * imply opting out).
 *
 * Caller is responsible for in-memory state (state.js#foundBonuses Set)
 * — see clearInMemoryProgress() in state.js.
 */
export function clearAllProgress() {
  // Clear localStorage blob first so a partially-completed clear
  // doesn't leave a stale blob next to a clean sessionStorage.
  try { localStorage.removeItem(BLOB_KEY); } catch (_) { /* silent */ }

  // Clear static tracked keys.
  for (const key of TRACKED_KEYS.static) {
    try { sessionStorage.removeItem(key); } catch (_) { /* silent */ }
  }

  // Clear prefix-family keys (iterate sessionStorage looking for
  // matches — we don't know which levels have been touched).
  try {
    const toRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && TRACKED_KEYS.prefix.some(p => k.startsWith(p))) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  } catch (_) { /* silent */ }
}

/**
 * Copy every tracked sessionStorage key into a fresh localStorage
 * blob. Called by enablePersistence() so opt-in preserves progress
 * accumulated *before* the prompt fired (otherwise the player loses
 * everything on the first reload after opting in).
 */
function snapshotSessionToBlob() {
  const blob = {};
  try {
    // Static keys: grab whatever is currently set.
    for (const key of TRACKED_KEYS.static) {
      const v = sessionStorage.getItem(key);
      if (v !== null) blob[key] = v;
    }
    // Prefix family: iterate sessionStorage to find every match.
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k) continue;
      if (TRACKED_KEYS.prefix.some(p => k.startsWith(p))) {
        blob[k] = sessionStorage.getItem(k);
      }
    }
    localStorage.setItem(BLOB_KEY, JSON.stringify(blob));
  } catch (_) { /* silent */ }
}

/**
 * Is the given key tracked by the persistence layer?
 * (Static-set membership OR any-prefix-startswith match.)
 */
function isTracked(key) {
  if (TRACKED_KEYS.static.includes(key)) return true;
  return TRACKED_KEYS.prefix.some(p => key.startsWith(p));
}

// ---------------------------------------------------------------
// Opt-in prompt UX
// ---------------------------------------------------------------
//
// The prompt fires from connectTo() in ssh.js after the player has
// successfully entered a non-lobby level for the first time this
// session. Rationale: showing it in the lobby would land before they
// have any progress to save (zero motivation); waiting until they
// finish a level is too late (they might lose progress to a tab
// close before the trigger fires). The first successful connect is
// the sweet spot — they've done real work and have something worth
// saving.
//
// The prompt is intentionally informative — the privacy posture
// (local-only, no server, no telemetry) is spelled out so the
// player doesn't assume otherwise. Yes / Enter-with-no-input both
// default to OPT OUT; explicit "y" is required to enable. This
// matches the cautious-default posture preferred by privacy-
// conscious players.

/**
 * Fire the consent prompt if it hasn't been fired this session and
 * persistence isn't already enabled. Called from ssh.js#connectTo
 * on the first successful non-lobby connect.
 */
export function maybePromptForPersistence() {
  if (isPersistenceEnabled()) return;       // already saving — nothing to ask
  if (wasPersistencePrompted())  return;    // already asked this session

  markPersistencePrompted();

  // Yellow callout, surrounded by dividers so it's visually distinct
  // from the connection banner the player just saw. The body explains
  // exactly what's stored, where, and what's NOT done with it.
  print("", "out");
  print("────────────────────────────────────────────────────", "dim");
  print("Save your progress across browser sessions?", "warn");
  print("", "out");
  print("Stored only in this browser, on this device. Never sent to a", "dim");
  print("server, never seen by other players, never used for analytics.", "dim");
  print("Clear any time with 'progress reset' or your browser's site-", "dim");
  print("data clear button.", "dim");
  print("", "out");
  print("Type 'y' to enable, anything else (or just Enter) to skip.", "dim");
  print("You can change your mind later with 'progress save-on' / 'save-off'.", "dim");
  print("────────────────────────────────────────────────────", "dim");
  print("[y/N]", "warn");

  setAwaitingPersistenceConsent(true);
}

/**
 * Route a player input through the consent gate. Called from
 * execute.js when awaitingPersistenceConsent is true (mirrors the
 * awaitingPassword route).
 *
 * Accepts: "y", "Y", "yes", "YES" → enable.
 * Anything else (including blank Enter) → opt out for this session.
 *
 * Always clears awaitingPersistenceConsent regardless of input.
 */
export function handlePersistenceConsent(val) {
  setAwaitingPersistenceConsent(false);
  const v = (val || "").trim().toLowerCase();
  const yes = v === "y" || v === "yes";

  print("", "out");
  if (yes) {
    enablePersistence();
    print("Progress will be saved to this browser. Type 'progress save-off' to stop saving, or 'progress reset' to wipe.", "success");
    // v1.14.0: the consent path bypasses the normal execute.js
    // dispatch loop (where checkAchievements normally runs), so
    // fire one explicit achievement check now — this is when
    // "Persistent Player" unlocks. Dynamic import to avoid the
    // circular dependency between persistence.js and
    // achievements.js (achievements.js imports mirrorSession +
    // isPersistenceEnabled from here).
    import("./achievements.js")
      .then(m => m.checkAchievements())
      .catch(() => { /* silent — non-critical */ });
  } else {
    // We don't print anything about THIS session — sessionStorage
    // keeps working as it always did. Just acknowledge and move on.
    print("Skipping. Progress stays in this tab only; closing the tab will discard it.", "dim");
    print("If you change your mind, type 'progress save-on'.", "dim");
  }
  print("", "out");
}
