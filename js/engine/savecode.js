// Progress codes (v1.20.0) — stateless save/restore via a packed
// binary format.
//
// Encodes the player's progress (visited levels, achievements,
// bonus finds, milestones, per-level times, hint counters, theme,
// onboarding flag, lobby-tree expand state) into a self-contained
// portable string the player can paste into D3CYPH3R running on
// any other browser/device to resume from the same point.
//
// SHAPE OF A CODE
// ---------------
//   "D3C2-XXXXXXXX-XXXXXXXX-...-CCCCCCCC"
//
//   - "D3C2"   : 4-char magic. The "2" is the format version (binary,
//                shipped with v1.20.0). A future "D3C3" decoder would
//                refuse v2 codes and migrate them; the v2 decoder
//                refuses anything that isn't "D3C2".
//   - Payload  : base64-encoded BINARY payload (see WIRE FORMAT
//                below), grouped into 8-char blocks with hyphens
//                between for visual readability. Hyphens are
//                decorative — the decoder strips them along with
//                whitespace before parsing, so codes can be wrapped
//                or line-broken freely when copy-pasting. Because "-"
//                is a decoration char, the payload armor deliberately
//                does NOT use standard base64url (which would put "-"
//                in the alphabet): it maps `+`→`.` and `/`→`_`, so no
//                payload character collides with the separator. See
//                b64urlEncodeBytes for the full rationale.
//   - Checksum : 8-char hex CRC32 over the armored payload (the
//                grouped, hyphen-free base64), appended after a final
//                hyphen. Catches typos, truncation, and accidental
//                concatenation.
//
// WIRE FORMAT (binary, big-endian)
// --------------------------------
//   byte 0          : schema version (= 0x02). Lets a future v3
//                     decoder accept v2 payloads without a magic
//                     change. Redundant with the magic above but
//                     cheap and safer.
//   bytes 1-4       : timestamp (uint32 seconds since epoch). Used
//                     only for the "Created N ago" preview line.
//   bytes 5-8       : achievement bitmask (uint32). Bit N is set if
//                     ACHIEVEMENT_REGISTRY[N] is earned.
//   byte 9          : flag byte. Bit positions:
//                       0  onboarding_seen
//                       1  has_theme               (next byte = theme_index)
//                       2  has_milestones          (next: 1 byte mask)
//                       3  has_themes_seen         (next: uint16 mask)
//                       4  has_lobby_expanded      (next: 1 byte mask)
//                       5-7 reserved (must be 0)
//   (theme_index)   : uint8, present iff flag bit 1 set.
//   byte N          : level_count (uint8). 0..255 levels follow.
//   For each level entry (level_count entries, in any order):
//     byte: level_index (uint8, position in LEVEL_REGISTRY)
//     byte: level_flags
//       bit 0  visited
//       bit 1  has_time_total
//       bit 2  is_solved              (implies first_solve also set
//                                       if has_time_solved bit also on)
//       bit 3  has_time_solved
//       bit 4  has_bonus_finds        (next: 1 byte bonus-bitmask)
//       bit 5  has_hint_counter       (next: varint hint count)
//       bits 6-7 reserved
//     if has_time_total:    varint total_seconds (quantized ms→s)
//     if has_time_solved:   varint first_solve_seconds
//     if has_bonus_finds:   1 byte (bit N = BONUS_REGISTRY[level][N] found)
//     if has_hint_counter:  varint hint_count
//   (milestones_mask)  : uint16 BE, present iff flag bit 2.
//                        16 slots; 6 used today. Headroom for
//                        v2.0+ content additions.
//   (themes_seen_mask) : uint16 BE, present iff flag bit 3.
//                        16 slots; 11 used today.
//   (lobby_mask)       : uint16 BE, present iff flag bit 4.
//                        16 slots = 16 tracks; 7 used today.
//
// STABLE INDEXES — APPEND-ONLY REGISTRIES
// ---------------------------------------
// The binary format compresses long strings to small integer
// indexes. Once a code is shipped to a player, the numeric index of
// every existing entry is BURNED IN — renaming or reordering an
// entry would silently corrupt every code that references it.
//
// HARD RULES for the six registries below:
//   1. NEW entries go AT THE END. Never insert in the middle.
//   2. DO NOT rename, reorder, or delete entries.
//   3. Removed-from-game items should still occupy their slot
//      (mark with a comment) so the index of every subsequent
//      entry stays stable.
//
// If an old code references a registry index that doesn't exist in
// the current build (e.g. a future-version code on an older
// deploy), the decoder treats it as "unknown" and skips/ignores it
// rather than throwing. Players never lose state, but the new
// entries don't activate until they update.
//
// COOKBOOK — ADDING NEW CONTENT IN FUTURE RELEASES
// ------------------------------------------------
//   New level (e.g., level2@linux for v2.0):
//     - Append "level2@linux" at the END of LEVEL_REGISTRY.
//     - If the level has bonus finds: add a BONUS_REGISTRY entry
//       (also append-only — never insert into a level's bonus list).
//
//   New achievement (e.g., a 21st):
//     - Append the id at the END of ACHIEVEMENT_REGISTRY.
//     - Stops working past index 31 (uint32 mask). Plan a wire-
//       format extension via reserved flag bits 5-7 before then.
//
//   New theme:
//     - Append at the END of THEME_REGISTRY.
//     - Cap: 16 themes-seen slots (uint16 mask); 256 theme indexes.
//
//   New track:
//     - Append at the END of TRACK_REGISTRY.
//     - Cap: 16 (uint16 mask). 7 used today.
//
//   New milestone (a new "have you ever done X?" flag):
//     - Append at the END of MILESTONE_REGISTRY.
//     - Cap: 16 (uint16 mask). 6 used today.
//
//   New bonus find on an existing level:
//     - Append the id to that level's BONUS_REGISTRY array.
//     - Cap: 8 bonuses per level (uint8 mask). Levels haven't
//       crossed 3 today.
//
// FORWARD/BACKWARD COMPAT BEHAVIOR
//   Old code on new engine: every existing index still maps to the
//     same item; new entries occupy new indexes the old code never
//     set. Perfect compatibility.
//   New code on old engine: the wire format still parses (length-
//     prefixed sections, bitmasks iterated only up to the old
//     registry's length, level entries with unknown indexes are
//     silently dropped). The player loses the bits of state the old
//     engine doesn't understand, but no crash and no corruption of
//     state the old engine DOES understand.
//
// HARDWARE/PRIVACY POSTURE
// ------------------------
// Same as the rest of the engine: no server, no account, no
// telemetry, no third-party scripts. Codes don't contain level
// passwords or bonus content. The localStorage persistence opt-in
// flag is deliberately not in the payload — that's a per-device
// privacy choice.

import { mirrorSession, clearAllProgress } from "./persistence.js";
import { clearInMemoryProgress, loadBonusesFromStorage } from "./state.js";
import { initLevelTimer } from "./leveltimer.js";

// ── Stable registries (APPEND-ONLY) ────────────────────────────────

/**
 * Level registry. Position in this array IS the wire-format index.
 * Adding a new level to the game: APPEND to the end here. Removing
 * a shipped level: comment-out the slot but leave the position to
 * keep subsequent indexes stable.
 *
 * Capped at 256 entries (uint8 level_index). Plenty of headroom for
 * the v6.0 "Veteran" milestone (~7 tracks × maybe 5 levels each).
 */
// The track groupings below are COSMETIC for human-reading. The
// canonical ordering is "added-when": every new level appends to
// the end of this array regardless of which track it belongs to.
// A v2.0 level2@linux lands at index 14, NOT next to level1@linux.
// (That's enforced by Object.freeze + the append-only rule above.)
export const LEVEL_REGISTRY = Object.freeze([
  // ── v1.0.0 launch lineup (all level0 + level1 per track) ──
  "level0@linux",        // 0
  "level1@linux",        // 1
  "level0@network",      // 2
  "level1@network",      // 3
  "level0@crypto",       // 4
  "level1@crypto",       // 5
  "level0@web",          // 6
  "level1@web",          // 7
  "level0@forensics",    // 8
  "level1@forensics",    // 9
  "level0@osint",        // 10
  "level1@osint",        // 11
  "level0@cloud",        // 12
  "level1@cloud",        // 13
  // ── v1.23.0 .. v1.30.0 — level2 sweep (completes the set across all 7 tracks) ──
  "level2@forensics",    // 14  — v1.23.0
  "level2@linux",        // 15  — v1.25.0
  "level2@network",      // 16  — v1.26.0
  "level2@crypto",       // 17  — v1.27.0
  "level2@web",          // 18  — v1.28.0
  "level2@osint",        // 19  — v1.29.0
  "level2@cloud",        // 20  — v1.30.0
  // ── v2.1.0 — level3 sweep begins (builds toward the v3.0.0 milestone) ──
  "level3@linux",        // 21  — v2.1.0
  // ── future levels append here at index 22, 23, 24, ... ──
]);
const LEVEL_INDEX = new Map(LEVEL_REGISTRY.map((k, i) => [k, i]));

/**
 * Achievement ID registry. Bit position N in the uint32 achievement
 * mask = ACHIEVEMENT_REGISTRY[N]. Max 32 today; if we ever cross
 * that, bump the mask to uint64 (will be a wire-format bump).
 */
export const ACHIEVEMENT_REGISTRY = Object.freeze([
  "first-steps",          // 0
  "first-discovery",      // 1
  "going-deep",           // 2
  "branching-out",        // 3
  "pipe-apprentice",      // 4
  "asked-for-help",       // 5
  "studious",             // 6
  "tutorial-graduate",    // 7
  "style-points",         // 8
  "nineteen-eighty-five", // 9
  "persistent-player",    // 10
  "all-hands",            // 11
  "sleuth",               // 12
  "multi-host-pivot",     // 13
  "job-runner",           // 14
  "thorough",             // 15
  "polymath",             // 16
  "hint-avoider",         // 17
  "track-master",         // 18
  "completionist",        // 19
]);
const ACHIEVEMENT_INDEX = new Map(ACHIEVEMENT_REGISTRY.map((id, i) => [id, i]));

/**
 * Theme name registry. uint8 theme_index = THEME_REGISTRY[N].
 * Max 256 themes; we're at 11.
 */
export const THEME_REGISTRY = Object.freeze([
  "dark",             // 0
  "light",            // 1
  "crt-green",        // 2
  "amber",            // 3
  "synthwave",        // 4
  "solarized-dark",   // 5
  "solarized-light",  // 6
  "high-contrast",    // 7
  "nord",             // 8
  "gruvbox",          // 9
  "dracula",          // 10
]);
const THEME_INDEX = new Map(THEME_REGISTRY.map((n, i) => [n, i]));

/**
 * Track key registry — used for the lobbyExpanded bitmask. Bit N
 * set = TRACKS[N] is expanded. uint16 mask in the wire format =
 * 16 slots; 7 used today.
 */
export const TRACK_REGISTRY = Object.freeze([
  "linux",      // 0
  "network",    // 1
  "crypto",     // 2
  "web",        // 3
  "forensics",  // 4
  "osint",      // 5
  "cloud",      // 6
]);
const TRACK_INDEX = new Map(TRACK_REGISTRY.map((k, i) => [k, i]));

/**
 * Milestone key registry — used for the milestones bitmask. Bit N
 * set = MILESTONE_REGISTRY[N] is true. uint16 mask in the wire
 * format = 16 slots; 6 used today.
 *
 * NOTE: "themesSeen" is NOT in this registry — it's an array, not
 * a boolean. It's encoded separately as themes_seen_bitmask.
 */
export const MILESTONE_REGISTRY = Object.freeze([
  "pipeUsed",          // 0
  "manRead",           // 1
  "walkthroughOpened", // 2
  "tutorialCompleted", // 3
  "multiHostPivot",    // 4
  "jobRun",            // 5
]);

/**
 * Bonus-find ID registry per level. Bit N of a level's bonus-mask
 * byte = BONUS_REGISTRY[levelKey][N] is found. Max 8 bonuses per
 * level (uint8); widen if any level ever ships more than 8.
 *
 * Levels not listed here have no bonus finds. When adding a new
 * bonus find to a level, APPEND to the level's array.
 */
export const BONUS_REGISTRY = Object.freeze({
  // Mirrors the `id:` fields declared in each level's bonusFinds[]
  // array. When adding a new bonus find to an existing level: APPEND
  // its id to that level's array here (don't reorder existing
  // entries). When adding a new level entirely: add a new entry.
  //
  // Catch-up note (v1.25.1): this registry was stale relative to the
  // actual bonus finds shipping in the level data. The level1@linux
  // `self-logged-bug` find shipped in v1.9.0, the forensics-track
  // bonuses shipped in v0.11.0 / v1.23.0, and the level2@linux pair
  // shipped in v1.25.0 — all silently absent from this map until
  // v1.25.1 backfilled them. Each append below preserves the
  // append-only rule (existing indices unchanged).
  "level0@linux":     Object.freeze(["daniel-history-pattern"]),
  "level1@linux":     Object.freeze(["backup-script", "self-logged-bug"]),
  "level0@network":   Object.freeze(["five-sprint-rotation"]),
  "level1@network":   Object.freeze(["dbadmin-shell-drift"]),
  "level0@crypto":    Object.freeze(["daniel-coffee-vendor"]),
  "level1@crypto":    Object.freeze(["most-downloaded-fallacy"]),
  "level0@web":       Object.freeze(["robots-txt-billboard"]),
  "level1@web":       Object.freeze(["ten-year-session-token"]),
  "level0@osint":     Object.freeze(["adobe-hint-as-intel"]),
  "level1@osint":     Object.freeze(["strava-segment-pattern"]),
  "level0@cloud":     Object.freeze(["sts-identity-confirmation"]),
  "level1@cloud":     Object.freeze(["ttl-without-enforcement"]),
  // v1.25.1 catch-up — finds that shipped earlier but were missing here.
  "level0@forensics": Object.freeze(["exif-image-direction"]),
  "level1@forensics": Object.freeze(["certutil-lolbin-pattern"]),
  "level2@forensics": Object.freeze(["exfil-downloader-in-history"]),
  "level2@linux":     Object.freeze(["tombstoned-daniel", "password-cargo-cult"]),
  // v1.26.0 — level2@network ships with two bonus finds, both fire
  // on the same openssl x509 cert dump.
  "level2@network":   Object.freeze(["wildcard-cert-sprawl", "self-signed-ca-blunder"]),
  // v1.27.0 — level2@crypto ships with two bonus finds: john's
  // multi-crack output reveals the password-reuse, and README.rockyou
  // documents the 2009 provenance.
  "level2@crypto":    Object.freeze(["theo-password-reuse", "rockyou-2009-provenance"]),
  // v1.28.0 — level2@web ships with two bonus finds: the verbose SQL
  // error fires on the probe, the no-WAF note fires on cat deploy-notes.
  "level2@web":       Object.freeze(["verbose-sql-errors", "no-waf-no-ratelimit"]),
  // v1.29.0 — level2@osint ships with two bonus finds: deletion-theatre
  // fires on waybacking the deleted repo, robots-txt-map on curling the
  // archived robots.txt.
  "level2@osint":     Object.freeze(["deletion-theatre", "robots-txt-map"]),
  // v1.30.0 — level2@cloud ships with three bonus finds: the orphaned
  // terminated-employee IAM user (fires on inspecting vikram.shah), the
  // never-rotated 2019 ci-deploy-svc key, and the root access key
  // surfaced by get-account-summary.
  "level2@cloud":     Object.freeze(["ghost-terminated-admin", "ancient-access-key", "root-access-key"]),
  // v2.1.0 — level3@linux ships with two bonus finds: daniel's account
  // surviving on a second host (fires on cat /etc/passwd), and the
  // config backup that swept up live secrets (fires on sudo cat of the
  // captured DB connection profile).
  "level3@linux":     Object.freeze(["daniel-outlived-again", "backup-swept-secrets"]),
});
// Build a reverse-lookup: "<levelKey>:<findId>" → { levelIdx, bitN }.
// The progress code's stored bonus-finds set lives at the "<key>:<id>"
// granularity; this lets the encoder map each entry back to a (level,
// bit) pair without iterating BONUS_REGISTRY for every find.
const BONUS_INDEX = new Map();
for (const [levelKey, ids] of Object.entries(BONUS_REGISTRY)) {
  ids.forEach((id, bit) => BONUS_INDEX.set(`${levelKey}:${id}`, { levelKey, bit }));
}

// ── Constants ─────────────────────────────────────────────────────

const MAGIC          = "D3C2";     // 4-char magic; the 2 is schema/format version
const SCHEMA_VERSION = 0x02;       // byte 0 of binary payload
const HYPHEN_GROUP   = 8;          // visual grouping every N base64url chars

// Flag bits in the global flag byte (binary offset 9).
const FLAG_ONBOARDING        = 0x01;
const FLAG_HAS_THEME         = 0x02;
const FLAG_HAS_MILESTONES    = 0x04;
const FLAG_HAS_THEMES_SEEN   = 0x08;
const FLAG_HAS_LOBBY_EXPAND  = 0x10;

// Flag bits in each level entry's level_flags byte.
const LF_VISITED       = 0x01;
const LF_TIME_TOTAL    = 0x02;
const LF_SOLVED        = 0x04;
const LF_TIME_SOLVED   = 0x08;
const LF_BONUS_FINDS   = 0x10;
const LF_HINT_COUNTER  = 0x20;

// ── CRC32 ──────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(str) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < str.length; i++) {
    c = (CRC_TABLE[(c ^ str.charCodeAt(i)) & 0xFF] ^ (c >>> 8)) >>> 0;
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── base64 armor ───────────────────────────────────────────────────
// The payload is base64-encoded, then `formatGroups` inserts a "-"
// every 8 chars for readability and the decoder's `stripDecoration`
// removes all "-"/whitespace before parsing. That makes "-" a
// DECORATION character owned by the framing layer — so the payload
// alphabet MUST NOT contain "-", or a data "-" would be indistinguish-
// able from a separator and silently stripped (corrupting the bytes
// AND breaking the CRC over them).
//
// Standard base64url maps `+`→`-` and `/`→`_`, which puts "-" INTO the
// payload alphabet and collides with the separator. We keep `/`→`_`
// (safe — "_" is never stripped) but map `+`→`.` instead of `-`. "." is
// outside [A-Za-z0-9_-], so it survives stripDecoration and can never
// be confused with a group separator.
//
// Backward compatibility: any previously-shipped D3C2 code that
// actually round-tripped had NO `+` in its base64 (a `+`→`-` would have
// been stripped and failed its checksum — the bug this fixes), so its
// armor contains only [A-Za-z0-9_] and decodes identically here. Codes
// that used to fail were never restorable, so there is nothing to
// preserve for them. The binary wire format (and thus the "D3C2" magic)
// is unchanged — only the ASCII armor's `+` substitution moved.
function b64urlEncodeBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, ".").replace(/\//g, "_");
}
function b64urlDecodeBytes(b64) {
  let std = b64.replace(/\./g, "+").replace(/_/g, "/");
  while (std.length % 4 !== 0) std += "=";
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Decoration helpers ─────────────────────────────────────────────
function formatGroups(s) {
  const parts = [];
  for (let i = 0; i < s.length; i += HYPHEN_GROUP) parts.push(s.slice(i, i + HYPHEN_GROUP));
  return parts.join("-");
}
function stripDecoration(s) {
  return String(s).replace(/[\s\-]+/g, "");
}

// ── Tiny binary writer / reader ───────────────────────────────────
// In-memory writer that builds a Uint8Array. All integer writes are
// big-endian. Varints use the standard MSB-continuation encoding
// (7 data bits per byte, MSB=1 means "more bytes follow").
class ByteWriter {
  constructor() { this.bytes = []; }
  u8(v)  { this.bytes.push(v & 0xFF); return this; }
  u16(v) { this.bytes.push((v >>> 8) & 0xFF, v & 0xFF); return this; }
  u32(v) {
    this.bytes.push((v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF);
    return this;
  }
  varint(v) {
    v = v >>> 0;
    while (v >= 0x80) { this.bytes.push((v & 0x7F) | 0x80); v >>>= 7; }
    this.bytes.push(v & 0x7F);
    return this;
  }
  finish() { return new Uint8Array(this.bytes); }
}
class ByteReader {
  constructor(bytes) { this.bytes = bytes; this.pos = 0; }
  remaining() { return this.bytes.length - this.pos; }
  u8()  {
    if (this.pos + 1 > this.bytes.length) throw new Error("u8 past end");
    return this.bytes[this.pos++];
  }
  u16() {
    if (this.pos + 2 > this.bytes.length) throw new Error("u16 past end");
    const v = (this.bytes[this.pos] << 8) | this.bytes[this.pos + 1];
    this.pos += 2;
    return v >>> 0;
  }
  u32() {
    if (this.pos + 4 > this.bytes.length) throw new Error("u32 past end");
    const b = this.bytes;
    const v = (b[this.pos] * 0x01000000) +
              ((b[this.pos + 1] << 16) | (b[this.pos + 2] << 8) | b[this.pos + 3]);
    this.pos += 4;
    return v >>> 0;
  }
  varint() {
    let result = 0, shift = 0;
    while (true) {
      if (this.pos >= this.bytes.length) throw new Error("varint past end");
      const b = this.bytes[this.pos++];
      result |= (b & 0x7F) << shift;
      if ((b & 0x80) === 0) return result >>> 0;
      shift += 7;
      if (shift > 35) throw new Error("varint too long");
    }
  }
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

// ── Snapshot builder ──────────────────────────────────────────────
//
// Builds an intermediate "snapshot" object from sessionStorage. The
// binary encoder consumes this; the summarize helpers also use it.
// Keeps the wire-format-specific logic separate from the
// sessionStorage read paths.
function buildSnapshot(themeName) {
  const snap = {
    timestampSec: Math.floor(Date.now() / 1000),
    onboarding:   false,
    theme:        null,
    achievements: [],
    milestones:   {},
    themesSeen:   [],
    lobbyExpanded:[],
    levels:       {},  // levelKey → { visited, totalMs, firstSolveMs, isSolved, bonusFinds[], hintCounter }
  };

  // Visited (and create level placeholders).
  const visited = readJSON("visited", []);
  if (Array.isArray(visited)) {
    for (const k of visited) {
      if (!snap.levels[k]) snap.levels[k] = blankLevel();
      snap.levels[k].visited = true;
    }
  }

  // Bonus finds (entries like "level0@linux:sloan-leftover-key").
  const bf = readJSON("d3cyph3r:bonusFinds", []);
  if (Array.isArray(bf)) {
    for (const entry of bf) {
      const idx = String(entry).indexOf(":");
      if (idx < 0) continue;
      const levelKey = entry.slice(0, idx);
      const findId   = entry.slice(idx + 1);
      if (!snap.levels[levelKey]) snap.levels[levelKey] = blankLevel();
      snap.levels[levelKey].bonusFinds.push(findId);
    }
  }

  // Achievements.
  const ach = readJSON("d3cyph3r:earnedAchievements", []);
  if (Array.isArray(ach)) snap.achievements = ach;

  // Milestones (object with boolean flags + a themesSeen array).
  const ms = readJSON("d3cyph3r:milestones", null);
  if (ms && typeof ms === "object") {
    for (const key of MILESTONE_REGISTRY) {
      if (ms[key] === true) snap.milestones[key] = true;
    }
    if (Array.isArray(ms.themesSeen)) snap.themesSeen = ms.themesSeen.slice();
  }

  // Level times.
  const lt = readJSON("d3cyph3r:levelTimes", null);
  if (lt && typeof lt === "object") {
    for (const [k, rec] of Object.entries(lt)) {
      if (!rec || typeof rec !== "object") continue;
      if (!snap.levels[k]) snap.levels[k] = blankLevel();
      if (Number.isFinite(rec.totalMs)      && rec.totalMs > 0)      snap.levels[k].totalMs = rec.totalMs;
      if (Number.isFinite(rec.firstSolveMs) && rec.firstSolveMs > 0) snap.levels[k].firstSolveMs = rec.firstSolveMs;
      if (rec.isSolved) snap.levels[k].isSolved = true;
    }
  }

  // Hint counters.
  const hc = readHintCounters();
  for (const [k, n] of Object.entries(hc)) {
    if (!snap.levels[k]) snap.levels[k] = blankLevel();
    snap.levels[k].hintCounter = n;
  }

  // Theme.
  if (themeName && typeof themeName === "string") snap.theme = themeName;

  // Onboarding flag.
  try { if (sessionStorage.getItem("seenOnboarding") === "true") snap.onboarding = true; } catch (_) { /* silent */ }

  // Lobby expanded (array of track keys).
  const le = readJSON("lobbyExpanded", []);
  if (Array.isArray(le)) snap.lobbyExpanded = le;

  return snap;
}
function blankLevel() {
  return { visited: false, totalMs: 0, firstSolveMs: 0, isSolved: false, bonusFinds: [], hintCounter: 0 };
}

// ── Encoder ───────────────────────────────────────────────────────

/**
 * Encode the current sessionStorage state into a portable progress
 * code. Returns the formatted string.
 *
 * @param {string|null} [themeName] — pass the active theme name (the
 *   command layer reads it from theme.js#getTheme().name).
 */
export function encodeProgress(themeName = null) {
  const snap = buildSnapshot(themeName);
  const bytes = snapshotToBytes(snap);
  const b64    = b64urlEncodeBytes(bytes);
  const checksum = crc32(b64).toString(16).padStart(8, "0");
  return MAGIC + "-" + formatGroups(b64) + "-" + checksum;
}

/**
 * Convert a snapshot object to the wire-format byte sequence.
 * Exported separately so tests can round-trip without the
 * base64/checksum/grouping wrapper.
 */
function snapshotToBytes(snap) {
  const w = new ByteWriter();
  w.u8(SCHEMA_VERSION);
  w.u32(snap.timestampSec >>> 0);

  // Achievement bitmask.
  let achMask = 0;
  for (const id of snap.achievements) {
    const bit = ACHIEVEMENT_INDEX.get(id);
    if (bit != null) achMask |= (1 << bit) >>> 0;
  }
  w.u32(achMask >>> 0);

  // Pre-compute optional sections so we can set flag bits accordingly.
  const milestoneMask = computeMilestoneMask(snap.milestones);
  const themesSeenMask = computeThemesSeenMask(snap.themesSeen);
  const lobbyMask = computeLobbyMask(snap.lobbyExpanded);
  const themeIdx  = snap.theme != null ? THEME_INDEX.get(snap.theme) : undefined;

  let flagByte = 0;
  if (snap.onboarding)                 flagByte |= FLAG_ONBOARDING;
  if (themeIdx != null)                flagByte |= FLAG_HAS_THEME;
  if (milestoneMask !== 0)             flagByte |= FLAG_HAS_MILESTONES;
  if (themesSeenMask !== 0)            flagByte |= FLAG_HAS_THEMES_SEEN;
  if (lobbyMask !== 0)                 flagByte |= FLAG_HAS_LOBBY_EXPAND;
  w.u8(flagByte);

  if (themeIdx != null) w.u8(themeIdx);

  // Levels: only emit entries that have ANY recordable state. An
  // entry the player has never touched contributes nothing.
  const entries = [];
  for (const [levelKey, data] of Object.entries(snap.levels)) {
    const idx = LEVEL_INDEX.get(levelKey);
    if (idx == null) continue;  // unknown level (shouldn't happen for shipped data)
    const has = data.visited
             || data.totalMs > 0
             || data.firstSolveMs > 0
             || data.isSolved
             || data.bonusFinds.length > 0
             || data.hintCounter > 0;
    if (!has) continue;
    entries.push({ idx, levelKey, data });
  }
  w.u8(entries.length & 0xFF);

  for (const { idx, levelKey, data } of entries) {
    w.u8(idx);

    const bonusMask = computeBonusMask(levelKey, data.bonusFinds);
    const hasBonus  = bonusMask !== 0;

    let lf = 0;
    if (data.visited)            lf |= LF_VISITED;
    if (data.totalMs > 0)        lf |= LF_TIME_TOTAL;
    if (data.isSolved)           lf |= LF_SOLVED;
    if (data.firstSolveMs > 0)   lf |= LF_TIME_SOLVED;
    if (hasBonus)                lf |= LF_BONUS_FINDS;
    if (data.hintCounter > 0)    lf |= LF_HINT_COUNTER;
    w.u8(lf);

    // Time fields: quantize ms → s for a more compact varint. The UI
    // re-multiplies by 1000 on read, so subsecond precision is lost
    // — fine for "you spent 7 minutes on this level".
    if (data.totalMs > 0)      w.varint(Math.round(data.totalMs / 1000));
    if (data.firstSolveMs > 0) w.varint(Math.round(data.firstSolveMs / 1000));
    if (hasBonus)              w.u8(bonusMask);
    if (data.hintCounter > 0)  w.varint(data.hintCounter);
  }

  if (milestoneMask !== 0)  w.u16(milestoneMask);
  if (themesSeenMask !== 0) w.u16(themesSeenMask);
  if (lobbyMask !== 0)      w.u16(lobbyMask);

  return w.finish();
}

function computeMilestoneMask(ms) {
  let m = 0;
  if (!ms) return 0;
  for (let i = 0; i < MILESTONE_REGISTRY.length; i++) {
    if (ms[MILESTONE_REGISTRY[i]] === true) m |= (1 << i);
  }
  return m & 0xFFFF;
}
function computeThemesSeenMask(themesSeen) {
  let m = 0;
  if (!Array.isArray(themesSeen)) return 0;
  for (const name of themesSeen) {
    const i = THEME_INDEX.get(name);
    if (i != null) m |= (1 << i);
  }
  return m & 0xFFFF;
}
function computeLobbyMask(expanded) {
  let m = 0;
  if (!Array.isArray(expanded)) return 0;
  for (const k of expanded) {
    const i = TRACK_INDEX.get(k);
    if (i != null) m |= (1 << i);
  }
  return m & 0xFFFF;
}
function computeBonusMask(levelKey, foundIds) {
  const ids = BONUS_REGISTRY[levelKey];
  if (!ids) return 0;
  let m = 0;
  for (const id of foundIds) {
    const bit = ids.indexOf(id);
    if (bit >= 0 && bit < 8) m |= (1 << bit);
  }
  return m & 0xFF;
}

// ── Decoder ───────────────────────────────────────────────────────

/**
 * Decode a player-entered progress code. Returns either
 *   { ok: true,  version, ts, data }   on success — where `data` is
 *                                       a snapshot in the same
 *                                       shape buildSnapshot returns
 *   { ok: false, error: <string> }     on any validation failure
 *
 * Does NOT touch state — the caller decides whether to apply via
 * applyDecoded(). Idempotent + side-effect-free.
 */
export function decodeProgress(code) {
  if (!code || typeof code !== "string") return { ok: false, error: "Empty progress code." };

  const cleaned = stripDecoration(code);
  // Hard upper bound on input size (v1.24.3). Real codes max out around
  // 200 characters (completionist with every level/achievement/bonus
  // earned), so 10k is ~50× the largest legitimate input. The cap
  // exists so a player pasting a multi-megabyte string (mis-pasted
  // file contents, browser-history dump, malicious DoS attempt) gets
  // a clean error instead of the decoder churning through varint
  // parsing on garbage data and freezing the tab.
  if (cleaned.length > 10_000) {
    return { ok: false, error: "Progress code is too long — must be under 10,000 characters. Did you paste the right text?" };
  }
  if (cleaned.length < MAGIC.length + 8 + 4) {
    return { ok: false, error: "Progress code looks truncated. Make sure you copied the whole thing." };
  }
  if (!cleaned.startsWith(MAGIC)) {
    return { ok: false, error: "Not a D3CYPH3R progress code (missing 'D3C2' header)." };
  }

  const after    = cleaned.slice(MAGIC.length);
  const checksum = after.slice(-8);
  const b64      = after.slice(0, -8);

  if (!/^[0-9a-f]{8}$/i.test(checksum)) {
    return { ok: false, error: "Progress code checksum is malformed." };
  }
  const computed = crc32(b64).toString(16).padStart(8, "0");
  if (computed !== checksum.toLowerCase()) {
    return { ok: false, error: "Progress code checksum failed — likely mistyped or corrupted. Re-copy the original code." };
  }

  let bytes;
  try { bytes = b64urlDecodeBytes(b64); }
  catch (_) { return { ok: false, error: "Progress code could not be decoded (not valid base64)." }; }

  let snap;
  try {
    snap = bytesToSnapshot(bytes);
  } catch (e) {
    return { ok: false, error: `Progress code payload is malformed (${e.message || "decoder error"}).` };
  }

  return { ok: true, version: snap._wireVersion, ts: snap.timestampSec * 1000, data: snap };
}

/**
 * Read the wire-format byte sequence and reconstruct a snapshot.
 * Throws on malformed input; the public decodeProgress wraps that
 * into an { ok: false } envelope.
 */
function bytesToSnapshot(bytes) {
  const r = new ByteReader(bytes);
  const wireVersion = r.u8();
  if (wireVersion !== SCHEMA_VERSION) {
    throw new Error(`schema v${wireVersion} not supported (this build understands v${SCHEMA_VERSION})`);
  }

  const timestampSec = r.u32();
  const achMask      = r.u32();
  const flagByte     = r.u8();

  const onboarding      = (flagByte & FLAG_ONBOARDING)       !== 0;
  const hasTheme        = (flagByte & FLAG_HAS_THEME)        !== 0;
  const hasMilestones   = (flagByte & FLAG_HAS_MILESTONES)   !== 0;
  const hasThemesSeen   = (flagByte & FLAG_HAS_THEMES_SEEN)  !== 0;
  const hasLobbyExpand  = (flagByte & FLAG_HAS_LOBBY_EXPAND) !== 0;

  let theme = null;
  if (hasTheme) {
    const themeIdx = r.u8();
    theme = THEME_REGISTRY[themeIdx] || null;
  }

  const levelCount = r.u8();
  const levels = {};
  for (let i = 0; i < levelCount; i++) {
    const levelIdx = r.u8();
    const lf       = r.u8();
    const levelKey = LEVEL_REGISTRY[levelIdx];

    // Always advance through the data even if the level index is
    // unknown (e.g. a newer code on an older deploy) so subsequent
    // entries decode correctly. Unknown entries are silently
    // dropped from the reconstructed snapshot.
    const rec = blankLevel();
    if (lf & LF_VISITED)      rec.visited      = true;
    if (lf & LF_TIME_TOTAL)   rec.totalMs      = r.varint() * 1000;
    if (lf & LF_TIME_SOLVED)  rec.firstSolveMs = r.varint() * 1000;
    if (lf & LF_SOLVED)       rec.isSolved     = true;
    if (lf & LF_BONUS_FINDS) {
      const mask = r.u8();
      const ids = (levelKey && BONUS_REGISTRY[levelKey]) || [];
      for (let b = 0; b < 8; b++) {
        if ((mask & (1 << b)) && ids[b] != null) rec.bonusFinds.push(ids[b]);
      }
    }
    if (lf & LF_HINT_COUNTER) rec.hintCounter = r.varint();

    if (levelKey) levels[levelKey] = rec;
  }

  const milestones = {};
  if (hasMilestones) {
    const m = r.u16();
    for (let i = 0; i < MILESTONE_REGISTRY.length; i++) {
      if (m & (1 << i)) milestones[MILESTONE_REGISTRY[i]] = true;
    }
  }

  const themesSeen = [];
  if (hasThemesSeen) {
    const m = r.u16();
    for (let i = 0; i < THEME_REGISTRY.length; i++) {
      if (m & (1 << i)) themesSeen.push(THEME_REGISTRY[i]);
    }
  }

  const lobbyExpanded = [];
  if (hasLobbyExpand) {
    const m = r.u16();
    for (let i = 0; i < TRACK_REGISTRY.length; i++) {
      if (m & (1 << i)) lobbyExpanded.push(TRACK_REGISTRY[i]);
    }
  }

  // Reconstruct achievements from the bitmask.
  const achievements = [];
  for (let i = 0; i < ACHIEVEMENT_REGISTRY.length; i++) {
    if (achMask & (1 << i)) achievements.push(ACHIEVEMENT_REGISTRY[i]);
  }

  return {
    _wireVersion: wireVersion,
    timestampSec,
    onboarding,
    theme,
    achievements,
    milestones,
    themesSeen,
    lobbyExpanded,
    levels,
  };
}

// ── Summarize helpers ─────────────────────────────────────────────

/**
 * Quick-count summary used by `restore --preview` and the
 * confirmation diff. Same shape whether the snapshot came from a
 * decoded code or the current session.
 */
function summarizeSnapshot(snap, timestamp) {
  if (!snap) return null;
  const levels = snap.levels || {};
  let visited = 0, solved = 0, timed = 0, hints = 0, bonus = 0;
  for (const rec of Object.values(levels)) {
    if (rec.visited)        visited++;
    if (rec.isSolved)       solved++;
    if (rec.totalMs > 0)    timed++;
    if (rec.hintCounter > 0) hints++;
    if (rec.bonusFinds && rec.bonusFinds.length) bonus += rec.bonusFinds.length;
  }
  return {
    visitedCount:        visited,
    bonusFindsCount:     bonus,
    achievementsCount:   Array.isArray(snap.achievements) ? snap.achievements.length : 0,
    solvedCount:         solved,
    timedLevelsCount:    timed,
    hintCountersCount:   hints,
    theme:               snap.theme || null,
    onboardingSeen:      !!snap.onboarding,
    expandedTracksCount: Array.isArray(snap.lobbyExpanded) ? snap.lobbyExpanded.length : 0,
    timestamp,
  };
}

/** Summary counts from a successfully decoded payload. */
export function summarizeDecoded(decoded) {
  if (!decoded || !decoded.ok) return null;
  return summarizeSnapshot(decoded.data, typeof decoded.ts === "number" ? decoded.ts : null);
}

/**
 * Summary counts from the player's CURRENT session state — used by
 * `restore` to show a before-vs-after diff in the confirmation prompt.
 */
export function summarizeCurrent(themeName = null) {
  return summarizeSnapshot(buildSnapshot(themeName), null);
}

// ── Applier ───────────────────────────────────────────────────────

/**
 * Replace the current session state with the decoded payload. Called
 * AFTER the player has confirmed.
 *
 * Wipe-then-write semantics. Returns the theme name to apply (or null);
 * the caller drives setTheme() so this module avoids importing the
 * theme module.
 */
export function applyDecoded(decoded) {
  if (!decoded || !decoded.ok) return { themeName: null };
  const snap = decoded.data || {};

  clearAllProgress();
  clearInMemoryProgress();

  // Visited.
  const visited = [];
  const levelTimesOut = {};
  const bonusFindsOut = [];
  for (const [levelKey, rec] of Object.entries(snap.levels || {})) {
    if (rec.visited) visited.push(levelKey);
    if (rec.totalMs > 0 || rec.firstSolveMs > 0 || rec.isSolved) {
      levelTimesOut[levelKey] = {
        totalMs:      rec.totalMs      > 0 ? rec.totalMs      : 0,
        firstSolveMs: rec.firstSolveMs > 0 ? rec.firstSolveMs : null,
        isSolved:     !!rec.isSolved,
      };
    }
    for (const id of rec.bonusFinds || []) {
      bonusFindsOut.push(`${levelKey}:${id}`);
    }
    if (rec.hintCounter > 0) {
      mirrorSession(`d3cyph3r-hint-${levelKey}`, String(rec.hintCounter));
    }
  }
  if (visited.length)            mirrorSession("visited",                       JSON.stringify(visited));
  if (bonusFindsOut.length)      mirrorSession("d3cyph3r:bonusFinds",           JSON.stringify(bonusFindsOut));
  if (Object.keys(levelTimesOut).length) mirrorSession("d3cyph3r:levelTimes",   JSON.stringify(levelTimesOut));

  // Achievements.
  if (Array.isArray(snap.achievements) && snap.achievements.length) {
    mirrorSession("d3cyph3r:earnedAchievements", JSON.stringify(snap.achievements));
  }

  // Milestones (rebuild a plain object including themesSeen).
  const milestonesOut = { ...(snap.milestones || {}) };
  if (Array.isArray(snap.themesSeen) && snap.themesSeen.length) {
    milestonesOut.themesSeen = snap.themesSeen.slice();
  }
  if (Object.keys(milestonesOut).length) {
    mirrorSession("d3cyph3r:milestones", JSON.stringify(milestonesOut));
  }

  // Lobby expanded.
  if (Array.isArray(snap.lobbyExpanded) && snap.lobbyExpanded.length) {
    mirrorSession("lobbyExpanded", JSON.stringify(snap.lobbyExpanded));
  }

  // Onboarding.
  if (snap.onboarding) mirrorSession("seenOnboarding", "true");

  // Rehydrate in-memory mirrors.
  loadBonusesFromStorage();
  initLevelTimer();

  return { themeName: typeof snap.theme === "string" ? snap.theme : null };
}
