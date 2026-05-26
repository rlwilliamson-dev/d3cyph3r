// Pipe-friendly text-processing commands: wc, sort, uniq, cut, tr.
//
// Handler contract: same (level, arg, stdin?) → { text, cls } | null
// signature as every other command module. Every command here is
// stdin-aware — they prefer piped input when no file arg is given,
// fall back to the file arg when both are present (and the file arg
// is treated as overriding stdin to match bash).
//
// Why a separate module? These commands are infrastructure, not
// track-specific. They show up in every track's puzzles once the
// player starts composing pipelines (`grep word log | wc -l`,
// `aws s3 ls ... | sort -r`, etc.), so they live alongside `help` /
// `clear` / `report` as part of the engine's permanent surface.
//
// File-reading uses level.files (the flat map) when a file arg is
// given. Cwd-aware lookup is preferred via resolvePath for
// consistency with cd/ls/cat, but the legacy flat-map fallback
// keeps hand-written legacy levels working too.

import { currentPath } from "../engine/state.js";
import { resolvePath, getFSNode } from "../fs/resolve.js";

/**
 * Read a file by name into a string, cwd-aware. Returns:
 *   - string on success
 *   - { text, cls } error envelope on failure
 *   - null if no file arg was given (caller falls back to stdin)
 */
function readFile(level, file, cmd) {
  if (!file) return null;
  if (!level.fs) {
    if (!(file in level.files)) {
      return { text: `${cmd}: ${file}: No such file or directory`, cls: "err" };
    }
    return String(level.files[file] || "");
  }
  const target = resolvePath(level, currentPath, file);
  const node   = getFSNode(level, target);
  if (!node) {
    return { text: `${cmd}: ${file}: No such file or directory`, cls: "err" };
  }
  if (node.type === "dir") {
    return { text: `${cmd}: ${file}: Is a directory`, cls: "err" };
  }
  return String(node.content || "");
}

/**
 * Resolve the input source for a stdin-aware command. Priority:
 *   1. Explicit file arg (cwd-aware lookup)
 *   2. stdin from the previous pipeline stage
 *   3. Usage error (returned to caller)
 *
 * Returns `{ content, error }`. Caller checks error first, then
 * proceeds with content.
 */
function resolveInput(level, file, stdin, cmd) {
  if (file) {
    const r = readFile(level, file, cmd);
    if (typeof r === "object" && r !== null) return { content: null, error: r };
    return { content: r, error: null };
  }
  if (stdin !== undefined) return { content: String(stdin), error: null };
  return { content: null, error: { text: `Usage: ${cmd} [...] <file>`, cls: "err" } };
}

export const textCommands = {
  // wc: line / word / char counts. Flags compose: `wc -lw` shows both
  // lines and words. With no flags, all three are printed (the default
  // is GNU `wc`'s `-lwc` shape).
  //
  //   wc <file>            counts on file
  //   <stdin> | wc         counts on stdin
  //   wc -l <file>         only lines
  //   wc -c                stdin-bytes when called in a pipeline
  wc(level, arg, stdin) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const flags  = tokens.filter(t => t.startsWith("-")).join("");
    const file   = tokens.find(t => !t.startsWith("-"));

    const showL = flags.includes("l");
    const showW = flags.includes("w");
    const showC = flags.includes("c");
    const showAll = !showL && !showW && !showC;

    const { content, error } = resolveInput(level, file, stdin, "wc");
    if (error) return error;

    const lines = content === "" ? 0 : content.split("\n").length;
    const words = content.trim() === "" ? 0 : content.trim().split(/\s+/).length;
    const chars = content.length;

    const cols = [];
    if (showAll || showL) cols.push(lines);
    if (showAll || showW) cols.push(words);
    if (showAll || showC) cols.push(chars);

    // bash wc right-aligns counts to a 7-char width, then suffixes the
    // filename when one was supplied. Stdin → no filename in output.
    const text = cols.map(n => String(n).padStart(7)).join(" ") + (file ? " " + file : "");
    return { text, cls: "out" };
  },

  // sort: line-sort. Flags:
  //   -n   numeric (parseFloat-based; non-numeric sorts as 0)
  //   -r   reverse the result
  //   -u   deduplicate (only-unique-lines)
  //
  // Stable: tie-breaker is original input order (preserves bash's
  // documented stable behavior since coreutils 7.0).
  sort(level, arg, stdin) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const flags  = tokens.filter(t => t.startsWith("-")).join("");
    const file   = tokens.find(t => !t.startsWith("-"));

    const numeric = flags.includes("n");
    const reverse = flags.includes("r");
    const unique  = flags.includes("u");

    const { content, error } = resolveInput(level, file, stdin, "sort");
    if (error) return error;
    if (!content) return { text: "", cls: "out" };

    let lines = content.split("\n");
    // Drop the trailing empty line that comes from a final newline,
    // matching bash sort's behavior (it doesn't sort a phantom empty).
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    // Pair each line with its index so the comparator can fall back
    // on input order for a stable sort.
    const indexed = lines.map((line, i) => ({ line, i }));
    indexed.sort((a, b) => {
      let cmp;
      if (numeric) {
        const an = parseFloat(a.line); const bn = parseFloat(b.line);
        const va = isNaN(an) ? 0 : an; const vb = isNaN(bn) ? 0 : bn;
        cmp = va - vb;
      } else {
        cmp = a.line < b.line ? -1 : a.line > b.line ? 1 : 0;
      }
      if (cmp === 0) cmp = a.i - b.i;
      return reverse ? -cmp : cmp;
    });

    let out = indexed.map(x => x.line);
    if (unique) {
      const seen = new Set();
      out = out.filter(l => seen.has(l) ? false : (seen.add(l), true));
    }
    return { text: out.join("\n"), cls: "out" };
  },

  // uniq: collapse adjacent duplicate lines. Bash uniq requires its
  // input to already be sorted to catch all duplicates — we leave
  // that responsibility to the player (or to `sort | uniq`).
  //
  //   uniq              dedupe adjacent
  //   uniq -c           prefix each line with the run count
  //   uniq -d           print only the duplicated lines (one per run)
  //   uniq -u           print only the lines that appear once
  uniq(level, arg, stdin) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const flags  = tokens.filter(t => t.startsWith("-")).join("");
    const file   = tokens.find(t => !t.startsWith("-"));

    const countMode = flags.includes("c");
    const dupOnly   = flags.includes("d");
    const uniqOnly  = flags.includes("u");

    const { content, error } = resolveInput(level, file, stdin, "uniq");
    if (error) return error;
    if (!content) return { text: "", cls: "out" };

    let lines = content.split("\n");
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    // Walk the lines, batching consecutive duplicates. Each run carries
    // the line text and a count, which we use for both -c and -d/-u.
    const runs = [];
    for (const line of lines) {
      if (runs.length > 0 && runs[runs.length - 1].line === line) {
        runs[runs.length - 1].count++;
      } else {
        runs.push({ line, count: 1 });
      }
    }

    const filtered = runs.filter(r => {
      if (dupOnly  && r.count <= 1) return false;
      if (uniqOnly && r.count >  1) return false;
      return true;
    });

    const text = filtered.map(r => countMode
      ? `${String(r.count).padStart(7)} ${r.line}`
      : r.line
    ).join("\n");
    return { text, cls: "out" };
  },

  // cut: extract delimited fields from each line.
  //
  //   cut -d , -f 2       second comma-delimited field
  //   cut -f 1,3          fields 1 and 3, default tab delimiter
  //   cut -d : -f 1-3     fields 1-3 (range supported)
  //
  // Missing fields render as empty strings (matches bash cut).
  cut(level, arg, stdin) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);

    // Pull -d <delim> and -f <fields> out of the args, then anything
    // left is a positional file arg.
    let delim   = "\t";
    let fieldSpec = null;
    const positional = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "-d" && tokens[i + 1] !== undefined) {
        delim = tokens[++i];
        // Bash treats `-d ' '` as a single-space delim; we accept the
        // arg verbatim. Quoted forms aren't supported by the engine
        // tokenizer, so `-d ','` and `-d ,` are equivalent.
        if (delim.length > 1 && delim.startsWith("'") && delim.endsWith("'")) {
          delim = delim.slice(1, -1);
        }
      } else if (tokens[i] === "-f" && tokens[i + 1] !== undefined) {
        fieldSpec = tokens[++i];
      } else if (!tokens[i].startsWith("-")) {
        positional.push(tokens[i]);
      }
    }
    const file = positional[0];

    if (!fieldSpec) return { text: "Usage: cut -d <delim> -f <fields> [file]", cls: "err" };

    // Parse the field spec: comma-separated 1-indexed positions, with
    // hyphen ranges expanded (`1,3-5` → [1,3,4,5]).
    const fields = [];
    for (const part of fieldSpec.split(",")) {
      const m = part.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return { text: `cut: invalid field spec '${fieldSpec}'`, cls: "err" };
      const start = parseInt(m[1], 10);
      const end   = m[2] ? parseInt(m[2], 10) : start;
      for (let i = start; i <= end; i++) fields.push(i);
    }

    const { content, error } = resolveInput(level, file, stdin, "cut");
    if (error) return error;
    if (!content) return { text: "", cls: "out" };

    const lines = content.split("\n");
    const out = lines.map(line => {
      const cols = line.split(delim);
      return fields.map(f => cols[f - 1] ?? "").join(delim);
    });
    return { text: out.join("\n"), cls: "out" };
  },

  // tr: character-by-character translate / delete.
  //
  //   tr a-z A-Z              upper-case the input
  //   tr 'aeiou' '*'          replace all vowels with *
  //   tr -d ' \t'             delete whitespace
  //   tr -s ' '               squeeze adjacent spaces to one
  //
  // Stdin-only — real tr doesn't take a file arg. Char ranges are
  // expanded ASCII-style (a-z → abc...xyz).
  tr(_level, arg, stdin) {
    if (stdin === undefined) return { text: "tr: reads from standard input (use a pipe)", cls: "err" };

    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const flags  = tokens.filter(t => t.startsWith("-")).join("");
    const sets   = tokens.filter(t => !t.startsWith("-")).map(stripQuotes);

    const del      = flags.includes("d");
    const squeeze  = flags.includes("s");

    if (del && sets.length < 1)      return { text: "Usage: tr -d <set>", cls: "err" };
    if (!del && sets.length < 2)     return { text: "Usage: tr <set1> <set2>", cls: "err" };

    const set1 = expandRange(sets[0]);
    const set2 = sets[1] ? expandRange(sets[1]) : "";

    let out = "";
    let prev = "";
    for (const ch of String(stdin)) {
      const idx = set1.indexOf(ch);
      let next;
      if (idx >= 0 && del) {
        continue;                          // delete-mode: skip char
      } else if (idx >= 0) {
        // Map to corresponding char in set2; if set2 is shorter,
        // bash uses set2's LAST char as the fill.
        next = set2[idx] !== undefined ? set2[idx] : set2[set2.length - 1] || ch;
      } else {
        next = ch;
      }
      if (squeeze && next === prev) continue;
      out += next;
      prev = next;
    }
    return { text: out, cls: "out" };
  },
};

// Strip surrounding single or double quotes from a token. The engine
// doesn't have a real quote layer; this lets `tr 'a-z' 'A-Z'` work
// for players who type quotes out of habit.
function stripQuotes(s) {
  if (s.length >= 2 && (s[0] === "'" || s[0] === '"') && s[s.length - 1] === s[0]) {
    return s.slice(1, -1);
  }
  return s;
}

// Expand a tr-style character range. `a-z` → "abcdef...xyz". Ranges
// can be embedded in a longer string: `a-z0-9` → all lowercase plus
// digits. Backslash escapes aren't supported — level content doesn't
// need them, and adding them would invite ambiguity.
function expandRange(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i + 1] === "-" && s[i + 2] !== undefined) {
      const start = s.charCodeAt(i);
      const end   = s.charCodeAt(i + 2);
      if (end >= start) {
        for (let c = start; c <= end; c++) out += String.fromCharCode(c);
      } else {
        out += s[i] + s[i + 1] + s[i + 2];
      }
      i += 2;
    } else {
      out += s[i];
    }
  }
  return out;
}
