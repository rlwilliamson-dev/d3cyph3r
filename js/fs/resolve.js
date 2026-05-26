// Path-resolution helpers shared across cwd-aware commands.
//
// Two helpers live here, each solving a different layer of "the user
// typed a path, what does it really mean?":
//
//   resolveFile(level, arg, currentPath)
//     Used by legacy / flat-map commands that consume entries from
//     level.files directly (base64, rot13, xxd, decode-hex, hash-id,
//     john, xor, strings, exif, file, etc.). Given a bare filename
//     while the user is `cd`'d into a subdir, prepend the cwd prefix
//     so the lookup hits the right flat-map key. Falls through (returns
//     the arg unchanged) when no rewrite applies — including when arg
//     starts with `-` (flag) or already exists as-is in level.files.
//
//   resolvePath(level, currentPath, input)
//     Used by modern / tree-aware commands (cd, ls, cat, glob,
//     autocomplete). Turns a user-typed path into an absolute parts
//     array relative to the level filesystem root. Pair it with
//     getFSNode() to look up the resulting tree node.
//
//   getFSNode(level, pathParts)
//     Walk the level.fs tree following an absolute parts array.
//     Returns the node or null. The canonical lookup for tree-aware
//     commands — `getFSNode(level, resolvePath(level, cwd, arg))`.
//
// Why two paths? See js/commands/linux.js's header comment: levels
// have both a nested `fs` tree (source of truth, used by modern
// commands) and a derived flat `files` map (used by legacy / cross-
// cutting commands). Both representations are kept in sync at module
// init — never write to either at runtime.
//
// Sandboxing: the level filesystem is rooted at `/home/<user>/`. Paths
// outside that root (`/etc/passwd`, `/var/log/...`) resolve to parts
// arrays that simply miss in getFSNode and produce a standard "No
// such file or directory" error — no separate "sandbox escape"
// branch needed.

import { currentLevelKey } from "../engine/state.js";

// Legacy flat-map filename rewrite. Kept as-is for backward compat
// with all the cross-cutting commands that read level.files directly.
export function resolveFile(level, arg, currentPath) {
  if (!arg || arg.startsWith("-")) return arg;
  if (arg in level.files) return arg;
  if (!currentPath.length) return arg;
  const flatKey = currentPath.join("/") + "/" + arg;
  return flatKey in level.files ? flatKey : arg;
}

/**
 * Return the in-world username for the current level. The home
 * directory is always `/home/<user>/`, so this is the prefix
 * resolvePath strips when it sees an absolute path. Falls back to the
 * engine slot name (e.g. `level1` from `level1@linux`) when the level
 * doesn't override via `playerUser`.
 *
 * Kept aligned with the identical helper in linux.js.
 */
function getCurrentUser(level) {
  return level?.playerUser || currentLevelKey.split("@")[0];
}

/**
 * Resolve a user-typed path string to an absolute parts array.
 *
 * @param {object}   level        - The current level (for playerUser → home prefix).
 * @param {string[]} currentPath  - The current working directory, parts array.
 * @param {string}   input        - The raw path string the player typed.
 * @returns {string[]} Resolved absolute path, parts array (relative to fs root).
 *
 * Examples (with currentPath = ["src"]):
 *   resolvePath(level, ["src"], "")             → ["src"]            (empty = cwd)
 *   resolvePath(level, ["src"], "notes.txt")    → ["src", "notes.txt"]
 *   resolvePath(level, ["src"], "./notes.txt")  → ["src", "notes.txt"]
 *   resolvePath(level, ["src"], "../bin")       → ["bin"]
 *   resolvePath(level, ["src"], "../../bin")    → ["bin"]            (clamped at root)
 *   resolvePath(level, ["src"], "~")            → []                 (home root)
 *   resolvePath(level, ["src"], "~/docs/a.md")  → ["docs", "a.md"]
 *   resolvePath(level, ["src"], "/home/foo/x")  → ["x"]              (assumes user "foo")
 *   resolvePath(level, ["src"], "/etc/passwd")  → ["etc", "passwd"]  (will miss in getFSNode)
 *   resolvePath(level, ["src"], "bin//foo/")    → ["src", "bin", "foo"] (collapsed)
 *
 * Edge cases:
 *   - `..` past root is clamped (bash's behavior too — you can't go
 *     above /); the resulting parts array stays empty rather than
 *     producing a negative-segment count.
 *   - Trailing slashes and double slashes are normalized away.
 *   - The function never throws — invalid-looking input just resolves
 *     to a parts array that won't exist, and the caller produces the
 *     "No such file or directory" error naturally.
 */
export function resolvePath(level, currentPath, input) {
  const raw = (input || "").trim();
  if (!raw) return [...currentPath];

  // Home shortcut.
  if (raw === "~") return [];

  let parts;

  if (raw.startsWith("~/")) {
    // ~/foo → relative to home root
    parts = raw.slice(2).split("/");
  } else if (raw.startsWith("/")) {
    // Absolute path. Two cases:
    //   /home/<user>/...  → strip prefix, resolve relative to fs root
    //   anything else     → strip leading /, parts will miss in
    //                       getFSNode and produce "No such file"
    const user = getCurrentUser(level);
    const homePrefix = `/home/${user}`;
    if (raw === homePrefix || raw === homePrefix + "/") {
      return [];
    }
    if (raw.startsWith(homePrefix + "/")) {
      parts = raw.slice(homePrefix.length + 1).split("/");
    } else {
      parts = raw.slice(1).split("/");
    }
  } else if (raw.startsWith("./")) {
    // ./foo → explicit cwd reference (same outcome as plain `foo`)
    parts = [...currentPath, ...raw.slice(2).split("/")];
  } else {
    // Plain relative path
    parts = [...currentPath, ...raw.split("/")];
  }

  // Normalize: drop empty (collapses //, trailing /), drop `.` (no-op),
  // pop on `..` (clamp at root).
  const out = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") {
      if (out.length > 0) out.pop();
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Walk level.fs from the root, following an absolute parts array.
 * Returns the matching node or null when any segment is missing or
 * the level has no fs tree.
 */
export function getFSNode(level, pathParts) {
  if (!level || !level.fs) return null;
  let node = level.fs;
  for (const part of pathParts) {
    if (!node.children || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}
