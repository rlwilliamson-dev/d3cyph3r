// Level-data schema validator.
//
// Runs once at module init (after `initLevels` flattens the fs trees)
// and writes warnings to `console.warn` for any structural problems
// in the level data. The site keeps booting even on failure — the
// validator's purpose is to surface authoring bugs to forkers /
// contributors who open DevTools, not to block players.
//
// What it checks (per level):
//   - required fields present:    track, objective, lesson
//   - fs OR files (or both)       — required unless level is the lobby
//   - track value is a known one  — must appear in TRACKS array
//   - password chain integrity    — if level1@X has a password, that
//                                   string must appear in level0@X's
//                                   file content (the breadcrumb).
//                                   Loose substring check; cred values
//                                   sometimes appear with surrounding
//                                   quotes or in TXT records.
//   - hints shape                 — array of non-empty strings
//   - difficulty enum             — Easy | Medium | Hard | Expert
//   - estimatedMinutes numeric    — positive integer
//   - permissions reference real  — every key in level.permissions has
//     files                       a matching file/dir in level.fs
//   - certs reference real files  — same idea, for level.certs
//   - tarArchives reference real  — same idea, for level.tarArchives
//   - gzipArchives reference real — same idea, for level.gzipArchives
//   - playerUser ASCII            — no spaces / special chars
//
// What it does NOT check:
//   - Walkthrough content (separate concern)
//   - Lessons-learned formatting (level-author tooling lives in the
//     repo as the linter for that)
//   - Whether the puzzle is actually solvable (no way to know)
//
// Forkers: extend the per-level + cross-level loops below with any
// additional invariants your fork enforces.

import { TRACKS } from "./tracks.js";

const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard", "Expert"];

function warn(levelKey, msg) {
  console.warn(`[level-validator] ${levelKey}: ${msg}`);
}

/**
 * Run the validator against the assembled LEVELS map. Returns the
 * number of warnings emitted (0 = clean).
 */
export function validateLevels(levels) {
  let warnings = 0;
  const trackKeys = new Set(TRACKS.map(t => t.host));
  const keys      = Object.keys(levels);

  for (const key of keys) {
    const level = levels[key];

    // Lobby is special-cased — it has no track + no puzzle content.
    if (level.isLobby || key === "guest@d3cyph3r") continue;

    // Pivot hosts (v1.9.0 multi-host pivot) are promoted into LEVELS
    // by initLevels but intentionally lack a `track` — they live
    // inside another level, not as a track entry. Validate their
    // own fields without forcing them to look like top-level
    // engagements.
    if (level.pivot) {
      if (!level.objective) { warn(key, "pivot host missing objective"); warnings++; }
      if (!level.lesson)    { warn(key, "pivot host missing lesson");    warnings++; }
      if (!level.fs && (!level.files || Object.keys(level.files).length === 0)) {
        warn(key, "pivot host has no fs content");
        warnings++;
      }
      continue;
    }

    // Required fields
    if (!level.track)     { warn(key, "missing required field: track");     warnings++; }
    if (!level.objective) { warn(key, "missing required field: objective"); warnings++; }
    if (!level.lesson)    { warn(key, "missing required field: lesson");    warnings++; }

    // Track value must be known
    if (level.track && !trackKeys.has(level.track)) {
      warn(key, `unknown track value '${level.track}' (not in TRACKS array in js/engine/tracks.js)`);
      warnings++;
    }

    // FS shape — fs OR files
    if (!level.fs && (!level.files || Object.keys(level.files).length === 0)) {
      warn(key, "no level.fs and no level.files — every level except the lobby needs filesystem content");
      warnings++;
    }

    // Hints
    if (level.hints !== undefined) {
      if (!Array.isArray(level.hints)) {
        warn(key, "level.hints must be an array of strings");
        warnings++;
      } else {
        level.hints.forEach((h, i) => {
          if (typeof h !== "string" || !h.trim()) {
            warn(key, `hints[${i}] is not a non-empty string`);
            warnings++;
          }
        });
      }
    }

    // Difficulty enum
    if (level.difficulty !== undefined && !DIFFICULTY_LEVELS.includes(level.difficulty)) {
      warn(key, `unknown difficulty '${level.difficulty}' — expected one of: ${DIFFICULTY_LEVELS.join(", ")}`);
      warnings++;
    }

    // Estimated minutes
    if (level.estimatedMinutes !== undefined) {
      if (!Number.isInteger(level.estimatedMinutes) || level.estimatedMinutes <= 0) {
        warn(key, `level.estimatedMinutes must be a positive integer (got ${level.estimatedMinutes})`);
        warnings++;
      }
    }

    // playerUser sanity
    if (level.playerUser !== undefined) {
      if (typeof level.playerUser !== "string" || !/^[a-z_][a-z0-9_-]*$/.test(level.playerUser)) {
        warn(key, `level.playerUser '${level.playerUser}' is not a valid Unix username`);
        warnings++;
      }
    }

    // Permissions reference real files
    if (level.permissions) {
      const fsKeys = collectFsBaseNames(level.fs);
      for (const fileKey of Object.keys(level.permissions)) {
        if (!fsKeys.has(fileKey)) {
          warn(key, `permissions entry '${fileKey}' has no corresponding file/dir in level.fs (orphan)`);
          warnings++;
        }
      }
    }

    // Per-format-command schema references (cert / tar / gzip files
    // should exist in fs)
    for (const [field, label] of [
      ["certs",         "certs"],
      ["tarArchives",   "tarArchives"],
      ["gzipArchives",  "gzipArchives"],
    ]) {
      if (!level[field]) continue;
      for (const fileKey of Object.keys(level[field])) {
        if (level.files && !(fileKey in level.files)) {
          warn(key, `${label}['${fileKey}'] has no matching entry in level.files (the flat map). The format command will report 'No such file'.`);
          warnings++;
        }
      }
    }
  }

  // Cross-level: per-track credential chain integrity.
  // Group levels by track, walk in numeric order, check that
  // level<N>.password (when set) appears somewhere in level<N-1>'s
  // file content.
  const byTrack = {};
  for (const [key, level] of Object.entries(levels)) {
    if (!level.track || level.isLobby) continue;
    (byTrack[level.track] ||= []).push({ key, level });
  }
  for (const trackLevels of Object.values(byTrack)) {
    // Sort by levelN slot prefix (level0 → level1 → level2 → ...)
    trackLevels.sort((a, b) => {
      const an = parseInt(a.key.match(/^level(\d+)@/)?.[1] || "0", 10);
      const bn = parseInt(b.key.match(/^level(\d+)@/)?.[1] || "0", 10);
      return an - bn;
    });
    for (let i = 1; i < trackLevels.length; i++) {
      const prev = trackLevels[i - 1];
      const cur  = trackLevels[i];
      if (!cur.level.password) continue;
      const prevContent = collectAllFileContent(prev.level);
      if (!prevContent.includes(cur.level.password)) {
        warn(cur.key, `password '${cur.level.password}' does not appear in ${prev.key}'s file content — credential-chain breadcrumb may be missing`);
        warnings++;
      }
    }
  }

  if (warnings > 0) {
    console.warn(`[level-validator] ${warnings} warning(s) found across ${keys.length} levels`);
  }
  return warnings;
}

// Recursively walk level.fs and collect every basename (files + dirs).
function collectFsBaseNames(node, set = new Set()) {
  if (!node || !node.children) return set;
  for (const [name, child] of Object.entries(node.children)) {
    set.add(name);
    if (child.type === "dir") collectFsBaseNames(child, set);
  }
  return set;
}

// Concatenate every file's content in a level (used for the
// credential-chain check — we look for the next level's password
// anywhere in the prior level's bytes).
function collectAllFileContent(level) {
  if (!level.files) return "";
  return Object.values(level.files).filter(v => typeof v === "string").join("\n");
}
