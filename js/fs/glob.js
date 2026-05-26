// Wildcard expansion (globbing).
//
// Used by path-aware commands to turn a single arg with metachars
// (`ls *.txt`, `cat *.md`, `grep foo *.log`) into a list of concrete
// matching paths. The command then iterates that list normally.
//
// Supported metachars:
//   *   any run of chars (not crossing a /)
//   ?   any single char (not /)
//
// Not supported (deliberately, to keep the implementation tight —
// level authors can always enumerate explicitly):
//   [abc] character classes
//   {a,b} brace expansion
//   **    deep glob
//
// Bash default: a pattern that matches nothing is left unchanged so
// the command produces "no such file" with the literal pattern in the
// error string (e.g. `ls: cannot access '*.nope': No such file or
// directory`). We mirror that exactly so the user sees what they
// typed in the error.
//
// Sandboxing: globs expand against level.fs only — no shell
// var / command-substitution / process expansion.

import { resolvePath, getFSNode } from "./resolve.js";

// True if the string contains any glob metachar.
function isPattern(s) {
  return /[*?]/.test(s);
}

/**
 * Convert a glob pattern into a regex that matches a single basename.
 * Glob metachars are translated, and every other regex-meaningful
 * char is escaped to literal so e.g. `notes.txt` doesn't match
 * `notesXtxt`.
 */
function globToRegex(pattern) {
  // Escape regex specials first (NOT * or ?, which we translate after).
  const esc = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  // Then translate the glob metachars. `[^/]` so a glob can't accidentally
  // span directory boundaries — `*` is a single-segment wildcard.
  const re  = esc.replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]");
  return new RegExp("^" + re + "$");
}

/**
 * Expand one possibly-glob token into a list of concrete paths.
 *
 * @param {object}   level        - Current level (for the home prefix in resolvePath).
 * @param {string[]} currentPath  - cwd parts array.
 * @param {string}   pattern      - The raw arg the user typed.
 * @returns {string[]} Matching path strings (each in the form the
 *                     player would have typed — same dir prefix as
 *                     the input pattern). Returns [pattern] verbatim
 *                     when there are no metachars or no matches, so
 *                     the caller's normal lookup runs against the
 *                     literal string.
 *
 * Scope: only globs the LAST path segment. So:
 *   *.txt        → match basenames in cwd
 *   src/*.txt    → match basenames in src/
 *   src(*)/(*).txt   → NOT supported (glob in a non-final segment)
 *
 * Hidden files: a leading `.` is treated like any other char, so
 * `*` won't match `.bashrc` (bash behavior). To list hidden files,
 * the player uses `ls -a` or explicit patterns like `.*`.
 */
export function expandGlob(level, currentPath, pattern) {
  if (!isPattern(pattern)) return [pattern];

  // Bash-style: don't match leading dot unless the pattern starts with one.
  const matchesDotfiles = pattern.split("/").pop().startsWith(".");

  // Split into directory part + basename pattern.
  const lastSlash = pattern.lastIndexOf("/");
  const dirPart   = lastSlash >= 0 ? pattern.slice(0, lastSlash) : "";
  const baseGlob  = lastSlash >= 0 ? pattern.slice(lastSlash + 1) : pattern;

  // Resolve the directory the pattern lives in.
  const dirParts = resolvePath(level, currentPath, dirPart);
  const dirNode  = getFSNode(level, dirParts);
  if (!dirNode || !dirNode.children) {
    // Bad dir → no expansion possible → caller sees the literal pattern
    return [pattern];
  }

  const re = globToRegex(baseGlob);
  const names = Object.keys(dirNode.children)
    .filter(name => matchesDotfiles || !name.startsWith("."))
    .filter(name => re.test(name));

  if (names.length === 0) return [pattern];

  // Sort matches (bash globs return alphabetically-sorted results).
  names.sort();

  // Re-attach the directory prefix so the caller's lookup uses the
  // same path shape the player typed.
  if (lastSlash >= 0) {
    return names.map(n => pattern.slice(0, lastSlash + 1) + n);
  }
  return names;
}

/**
 * Convenience: expand a list of args, each of which might be a glob.
 * Args without wildcards pass through unchanged. Order is preserved.
 *
 * Used by commands that accept multiple path args (cat, grep, head,
 * tail, wc, ls). The caller can then iterate the flattened list.
 */
export function expandGlobs(level, currentPath, args) {
  const out = [];
  for (const a of args) {
    for (const m of expandGlob(level, currentPath, a)) out.push(m);
  }
  return out;
}
