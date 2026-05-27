// Progress codes (v1.20.0) — stateless save/restore.
//
// Encodes the player's progress (visited levels, achievements, bonus
// finds, milestones, per-level times, hint counters, theme,
// onboarding flag, lobby-tree expand state) into a self-contained
// portable string. The player can paste it back into D3CYPH3R running
// on any other browser/device to resume from the same point.
//
// "Stateless" in the sense that the server side is unaware — the
// code is entirely client-generated and client-consumed. Same
// privacy posture as the rest of the engine: no server, no account,
// no telemetry. The string lives wherever the player puts it
// (notes app, email to themselves, paper, etc.).
//
// FORMAT
// ------
//   "D3CY1-XXXXXXXX-XXXXXXXX-...-CCCCCCCC"
//
//   - "D3CY1"  : 5-char magic + schema-version digit. The trailing
//                "1" lets future format changes co-exist (a future
//                "D3CY2" decoder can refuse v1 codes or migrate
//                them). Hard-coded — never rename.
//   - Payload  : base64url-encoded JSON, no padding, grouped into
//                8-char blocks with hyphens between for visual
//                readability. Hyphens are decorative — the decoder
//                strips them along with all whitespace before
//                parsing, so the player can wrap / line-break the
//                code freely when copy-pasting.
//   - Checksum : 8-char hex CRC32 of the base64url payload (computed
//                AFTER grouping/encoding, BEFORE the leading magic).
//                Catches typos, truncation, and accidental
//                concatenation of two separate codes.
//
// THE PAYLOAD
// -----------
// JSON.stringify({ v: 1, t: <epoch>, d: <state> }):
//   v   schema version (currently 1).
//   t   timestamp the code was minted; used for the "created N ago"
//       line in `restore --preview`.
//   d   the state map, with compact field names to keep codes small:
//         vis  array of visited level keys ("level0@linux", ...)
//         bf   array of bonus-find composite keys ("level0@linux:id")
//         ach  array of earned achievement ids
//         ms   milestones flag object
//         lt   per-level times { "level0@linux": { t,f,s } }
//                t = totalMs, f = firstSolveMs, s = isSolved (1/absent)
//         hc   hint counters { "level0@linux": 3 }
//         th   theme name
//         ob   onboarding-seen flag (1 / absent)
//         le   lobby-expanded array
//
// The compact keys are part of the wire format — once shipped, never
// rename. New fields can be added in a v2 schema without breaking v1
// codes (the v1 decoder reads only the v1 keys).
//
// WHAT WE DO NOT ENCODE
// ---------------------
//   - The persistence opt-in flag. Opting in to localStorage is a
//     per-device decision (it controls where progress is saved
//     automatically on THIS browser); restoring a save shouldn't
//     silently opt the player in on a new machine.
//   - The CSS theme cache-bust query, viewport size, or anything UI
//     transient.
//   - Anything sensitive — codes don't contain level passwords or
//     bonus content. Visited level keys are facts about progress,
//     not credentials: knowing the player visited "level3@linux"
//     doesn't reveal how to solve "level2@linux".
//
// FAILURE POSTURE
// ---------------
// All decode failures return { ok: false, error: <reason> } rather
// than throwing — the command layer surfaces the error directly to
// the player. The only thing that throws is internal logic bugs
// (e.g. encodeProgress called in a context without sessionStorage),
// which would be developer-visible regardless.

import { mirrorSession, clearAllProgress } from "./persistence.js";
import { clearInMemoryProgress, loadBonusesFromStorage } from "./state.js";
import { initLevelTimer } from "./leveltimer.js";

const MAGIC          = "D3CY1";   // 4-char brand + 1-digit schema version
const SCHEMA_VERSION = 1;
const HYPHEN_GROUP   = 8;         // Visual grouping every N base64url chars

// ── CRC32 ──────────────────────────────────────────────────────────
// Standard CRC-32 (IEEE 802.3 polynomial, reflected). Table-driven so
// encoding/decoding of even multi-KB payloads stays under a
// millisecond. Built once at module load.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c >>> 0;
  }
  return t;
})();

/** CRC-32 of a string's UTF-16 code units (sufficient for base64url
 *  input, which is pure ASCII). Returns an unsigned 32-bit number. */
function crc32(str) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    c = (CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xFF] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── base64url ──────────────────────────────────────────────────────
// btoa/atob operate on Latin-1 strings. To safely round-trip the
// JSON (which may contain non-ASCII chars in theme names or level
// titles), we go through TextEncoder → byte-string → btoa.

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin)
    .replace(/=/g, "")     // strip padding (we re-derive on decode)
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(b64) {
  let std = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (std.length % 4 !== 0) std += "=";
  const bin = atob(std);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── grouping helpers ───────────────────────────────────────────────

/** Insert hyphens every HYPHEN_GROUP chars. Pure visual aid. */
function formatGroups(s) {
  const parts = [];
  for (let i = 0; i < s.length; i += HYPHEN_GROUP) {
    parts.push(s.slice(i, i + HYPHEN_GROUP));
  }
  return parts.join("-");
}

/** Strip whitespace + hyphens. Called before parsing a user-entered
 *  code so we accept whatever decoration the player kept (or didn't). */
function stripDecoration(s) {
  return String(s).replace(/[\s\-]+/g, "");
}

// ── sessionStorage helpers ─────────────────────────────────────────

function readJSON(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/** Read every "d3cyph3r-hint-*" entry in sessionStorage. Returns an
 *  object keyed by the trailing level key, value = integer counter. */
function readHintCounters() {
  const out = {};
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith("d3cyph3r-hint-")) continue;
      const n = parseInt(sessionStorage.getItem(k) || "0", 10);
      if (n > 0) out[k.slice("d3cyph3r-hint-".length)] = n;
    }
  } catch (_) { /* silent */ }
  return out;
}

// ── encoder ────────────────────────────────────────────────────────

/**
 * Build a snapshot of every piece of state we encode. Sparse — fields
 * with no data (empty arrays, missing keys) are omitted so a brand-
 * new player's code is small. The compact field names (vis/bf/ach/
 * ms/lt/hc/th/ob/le) come from the FORMAT comment above.
 *
 * @param {string|null} [themeName] — current theme name, passed in by
 *   the command layer (this module avoids importing the theme module
 *   to keep its dep graph minimal).
 */
function buildSnapshot(themeName) {
  const data = {};

  const visited = readJSON("visited", []);
  if (Array.isArray(visited) && visited.length) data.vis = visited;

  const bf = readJSON("d3cyph3r:bonusFinds", []);
  if (Array.isArray(bf) && bf.length) data.bf = bf;

  const ach = readJSON("d3cyph3r:earnedAchievements", []);
  if (Array.isArray(ach) && ach.length) data.ach = ach;

  const ms = readJSON("d3cyph3r:milestones", null);
  if (ms && typeof ms === "object" && Object.keys(ms).length) data.ms = ms;

  // Level times — compact { totalMs, firstSolveMs, isSolved } → { t, f, s }.
  const lt = readJSON("d3cyph3r:levelTimes", null);
  if (lt && typeof lt === "object" && Object.keys(lt).length) {
    const compact = {};
    for (const [key, rec] of Object.entries(lt)) {
      if (!rec || typeof rec !== "object") continue;
      const row = {};
      if (Number.isFinite(rec.totalMs)      && rec.totalMs > 0)      row.t = rec.totalMs;
      if (Number.isFinite(rec.firstSolveMs) && rec.firstSolveMs > 0) row.f = rec.firstSolveMs;
      if (rec.isSolved)                                              row.s = 1;
      if (Object.keys(row).length) compact[key] = row;
    }
    if (Object.keys(compact).length) data.lt = compact;
  }

  const hc = readHintCounters();
  if (Object.keys(hc).length) data.hc = hc;

  if (themeName && typeof themeName === "string") data.th = themeName;

  try {
    if (sessionStorage.getItem("seenOnboarding") === "true") data.ob = 1;
  } catch (_) { /* silent */ }

  const le = readJSON("lobbyExpanded", []);
  if (Array.isArray(le) && le.length) data.le = le;

  return data;
}

/**
 * Encode the current sessionStorage state into a portable progress
 * code. Returns the string to print to the player.
 *
 * @param {string|null} [themeName] — pass the active theme name (from
 *   theme.js#getTheme().name) so the restore brings it back.
 */
export function encodeProgress(themeName = null) {
  const data    = buildSnapshot(themeName);
  const payload = JSON.stringify({ v: SCHEMA_VERSION, t: Date.now(), d: data });
  const b64     = b64urlEncode(payload);
  const checksum = crc32(b64).toString(16).padStart(8, "0");
  return MAGIC + "-" + formatGroups(b64) + "-" + checksum;
}

// ── decoder ────────────────────────────────────────────────────────

/**
 * Decode a player-entered progress code. Returns either
 *   { ok: true,  version, ts, data }   on success
 *   { ok: false, error: <string> }     on any validation failure
 *
 * Does NOT touch state — the caller decides whether to apply via
 * applyDecoded(). Idempotent + side-effect-free.
 */
export function decodeProgress(code) {
  if (!code || typeof code !== "string") {
    return { ok: false, error: "Empty progress code." };
  }

  const cleaned = stripDecoration(code);

  // Length floor: 5 (magic) + 8 (checksum) + at least 4 bytes of
  // payload. A real code is much longer, but this catches obvious
  // truncation before we waste a CRC pass.
  if (cleaned.length < MAGIC.length + 8 + 4) {
    return { ok: false, error: "Progress code looks truncated. Make sure you copied the whole thing." };
  }
  if (!cleaned.startsWith(MAGIC)) {
    return { ok: false, error: "Not a D3CYPH3R progress code (missing 'D3CY1' header)." };
  }

  const after    = cleaned.slice(MAGIC.length);
  const checksum = after.slice(-8);
  const b64      = after.slice(0, -8);

  // Checksum is 8 hex digits — anything else is a malformed code.
  if (!/^[0-9a-f]{8}$/i.test(checksum)) {
    return { ok: false, error: "Progress code checksum is malformed." };
  }

  const computed = crc32(b64).toString(16).padStart(8, "0");
  if (computed !== checksum.toLowerCase()) {
    return { ok: false, error: "Progress code checksum failed — likely mistyped or corrupted. Re-copy the original code." };
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(b64));
  } catch (_) {
    return { ok: false, error: "Progress code payload could not be decoded (not valid base64 or JSON)." };
  }

  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Progress code payload shape is invalid." };
  }
  if (typeof payload.v !== "number") {
    return { ok: false, error: "Progress code is missing its schema version." };
  }
  if (payload.v > SCHEMA_VERSION) {
    return { ok: false, error: `Progress code was created by a newer schema (v${payload.v}). Update D3CYPH3R and try again.` };
  }
  const data = payload.d;
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Progress code payload is missing the data section." };
  }

  return { ok: true, version: payload.v, ts: payload.t, data };
}

/**
 * Quick lookups for the preview / confirmation diff — counts of each
 * field without unpacking the whole structure. Shared helper that
 * builds the summary from a compact-data object (the `.d` of a
 * payload), used by both summarizeDecoded() and summarizeCurrent().
 */
function summarizeData(d, timestamp = null) {
  d = d || {};
  const lt = d.lt && typeof d.lt === "object" ? d.lt : {};
  let solvedCount = 0;
  for (const rec of Object.values(lt)) {
    if (rec && rec.s) solvedCount++;
  }
  return {
    visitedCount:        Array.isArray(d.vis) ? d.vis.length : 0,
    bonusFindsCount:     Array.isArray(d.bf)  ? d.bf.length  : 0,
    achievementsCount:   Array.isArray(d.ach) ? d.ach.length : 0,
    solvedCount,
    timedLevelsCount:    Object.keys(lt).length,
    hintCountersCount:   d.hc && typeof d.hc === "object" ? Object.keys(d.hc).length : 0,
    theme:               typeof d.th === "string" ? d.th : null,
    onboardingSeen:      d.ob === 1,
    expandedTracksCount: Array.isArray(d.le) ? d.le.length : 0,
    timestamp,
  };
}

/** Summary counts from a successfully decoded payload. */
export function summarizeDecoded(decoded) {
  if (!decoded || !decoded.ok) return null;
  return summarizeData(decoded.data, typeof decoded.ts === "number" ? decoded.ts : null);
}

/**
 * Summary counts from the player's CURRENT session state — used by
 * `restore` to show a before-vs-after diff in the confirmation
 * prompt. Same shape as summarizeDecoded().
 *
 * @param {string|null} [themeName] Pass the current theme name (the
 *   command layer reads it from theme.js#getTheme().name).
 */
export function summarizeCurrent(themeName = null) {
  return summarizeData(buildSnapshot(themeName), null);
}

// ── applier ────────────────────────────────────────────────────────

/**
 * Replace the current session state with the decoded payload. Called
 * AFTER the player has confirmed; up to this point the decode is
 * purely informational.
 *
 * Semantics (per v1.20.0 design):
 *   - REPLACE, not merge. Clear every tracked progress key in
 *     sessionStorage + the localStorage blob first, then write the
 *     restored values via mirrorSession() so they propagate to the
 *     localStorage blob if persistence is enabled on this device.
 *   - Reinitialize in-memory mirrors (foundBonuses Set in state.js,
 *     levelTimes map in leveltimer.js).
 *   - Theme application is NOT done here — the caller (command
 *     layer) calls setTheme() so the apply uses the theme module's
 *     existing API and side effects (localStorage write + DOM
 *     attribute swap).
 *
 * @returns {{ themeName: string|null }} The theme name to apply, if
 *   any. Returned so the command layer can drive setTheme() without
 *   this module importing the theme module.
 */
export function applyDecoded(decoded) {
  if (!decoded || !decoded.ok) return { themeName: null };
  const d = decoded.data || {};

  // Wipe-then-write semantics. clearAllProgress removes every key
  // listed in persistence.js#TRACKED_KEYS plus the localStorage blob.
  // clearInMemoryProgress resets state.js#foundBonuses to an empty
  // Set. We then write the restored values back through mirrorSession
  // so they re-populate sessionStorage AND propagate to the blob if
  // persistence is on.
  clearAllProgress();
  clearInMemoryProgress();

  if (Array.isArray(d.vis) && d.vis.length) {
    mirrorSession("visited", JSON.stringify(d.vis));
  }
  if (Array.isArray(d.bf) && d.bf.length) {
    mirrorSession("d3cyph3r:bonusFinds", JSON.stringify(d.bf));
  }
  if (Array.isArray(d.ach) && d.ach.length) {
    mirrorSession("d3cyph3r:earnedAchievements", JSON.stringify(d.ach));
  }
  if (d.ms && typeof d.ms === "object") {
    mirrorSession("d3cyph3r:milestones", JSON.stringify(d.ms));
  }

  // Level times — re-expand compact { t,f,s } → { totalMs, firstSolveMs, isSolved }.
  if (d.lt && typeof d.lt === "object") {
    const expanded = {};
    for (const [key, row] of Object.entries(d.lt)) {
      if (!row || typeof row !== "object") continue;
      expanded[key] = {
        totalMs:      Number.isFinite(row.t) ? row.t : 0,
        firstSolveMs: Number.isFinite(row.f) ? row.f : null,
        isSolved:     row.s === 1,
      };
    }
    if (Object.keys(expanded).length) {
      mirrorSession("d3cyph3r:levelTimes", JSON.stringify(expanded));
    }
  }

  // Hint counters — restore each "d3cyph3r-hint-<levelKey>" entry.
  if (d.hc && typeof d.hc === "object") {
    for (const [levelKey, count] of Object.entries(d.hc)) {
      if (!Number.isFinite(count) || count <= 0) continue;
      mirrorSession(`d3cyph3r-hint-${levelKey}`, String(count));
    }
  }

  if (d.ob === 1) {
    mirrorSession("seenOnboarding", "true");
  }
  if (Array.isArray(d.le) && d.le.length) {
    mirrorSession("lobbyExpanded", JSON.stringify(d.le));
  }

  // Rehydrate in-memory mirrors so the running session reflects the
  // newly-written sessionStorage data without waiting for a reload.
  loadBonusesFromStorage();
  initLevelTimer();

  return { themeName: typeof d.th === "string" ? d.th : null };
}
