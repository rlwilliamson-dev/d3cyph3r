// Command-line parser. Turns the raw input string into a sequence of
// statements, each statement being a pipeline of segments, each
// segment being a list of tokens. Respects quoting, $(...) command
// substitution boundaries, and the chain operators && / || / ;.
//
// Output shape:
//   [
//     { op: "ALWAYS", segments: [["echo", "hi"]] },
//     { op: "AND",    segments: [["ls", "src"]] },
//     { op: "OR",     segments: [["echo", "src missing"]] },
//   ]
//
// Statement-chain semantics (run in sequence):
//   ALWAYS  → run unconditionally (first stmt, or after `;`)
//   AND     → run only if the previous statement's exit code was 0
//   OR      → run only if the previous statement's exit code was != 0
//
// Tokens retain their surrounding quote markers (a leading `'` or `"`)
// so downstream expansion (`js/engine/expand.js`) can decide whether
// to expand `$VAR` / `$(...)` (yes inside `"..."` and unquoted; no
// inside `'...'`). The expansion layer strips the quotes after
// processing.
//
// What this parser does NOT do:
//   - Variable expansion (that's expand.js's job, after parsing)
//   - Glob expansion (per-command, after expansion)
//   - Pathname/heredoc/redirect syntax (`>`, `<`, `<<`)
//   - Background jobs (`&` at end of line) — irrelevant in this sandbox

const SINGLE = "'";
const DOUBLE = '"';

/**
 * Parse a raw command line into a statement list.
 *
 * @param {string} input - The raw user input.
 * @returns {Array<{op: string, segments: string[][]}>}
 */
export function parseLine(input) {
  const stmts = [];
  let curStmt   = { op: "ALWAYS", segments: [[]] };
  let curSegIdx = 0;
  let curToken  = "";
  let mode      = "none";   // "none" | "single" | "double"
  let parenDepth = 0;       // tracks $(...) depth so operators inside are ignored

  const flushToken = () => {
    if (curToken.length > 0) {
      curStmt.segments[curSegIdx].push(curToken);
      curToken = "";
    }
  };

  const flushStmt = (nextOp) => {
    flushToken();
    stmts.push(curStmt);
    curStmt   = { op: nextOp, segments: [[]] };
    curSegIdx = 0;
  };

  let i = 0;
  while (i < input.length) {
    const c    = input[i];
    const next = input[i + 1];

    // ── Inside single quotes: everything is literal until the closing '
    if (mode === "single") {
      curToken += c;
      if (c === SINGLE) mode = "none";
      i++;
      continue;
    }

    // ── Inside double quotes: backslash escapes only $"`\, else literal
    if (mode === "double") {
      if (c === "\\" && next !== undefined && '"\\$`'.includes(next)) {
        // bash-style escape inside "..."
        curToken += "\\" + next;
        i += 2;
        continue;
      }
      curToken += c;
      if (c === DOUBLE) mode = "none";
      i++;
      continue;
    }

    // ── Outside quotes — full bash-ish character class:

    // Open a quoted region (keep the quote in the token so expand.js can see it)
    if (c === SINGLE) { mode = "single"; curToken += c; i++; continue; }
    if (c === DOUBLE) { mode = "double"; curToken += c; i++; continue; }

    // Backslash escape outside quotes — consumes the next char literally
    if (c === "\\" && next !== undefined) {
      curToken += next;
      i += 2;
      continue;
    }

    // $(...) — keep the whole substitution as part of the current token,
    // tracking paren depth so operators inside don't split the line
    if (c === "$" && next === "(") {
      curToken += "$(";
      i += 2;
      parenDepth++;
      continue;
    }
    if (parenDepth > 0) {
      if (c === "(") parenDepth++;
      else if (c === ")") parenDepth--;
      curToken += c;
      i++;
      continue;
    }

    // Chain operators at top level
    if (c === "&" && next === "&") { flushStmt("AND");    i += 2; continue; }
    if (c === "|" && next === "|") { flushStmt("OR");     i += 2; continue; }
    if (c === ";")                  { flushStmt("ALWAYS"); i += 1; continue; }

    // Pipe within current statement
    if (c === "|") {
      flushToken();
      curStmt.segments.push([]);
      curSegIdx++;
      i++;
      continue;
    }

    // Whitespace ends the current token
    if (/\s/.test(c)) {
      flushToken();
      i++;
      continue;
    }

    // Regular character
    curToken += c;
    i++;
  }

  flushToken();
  if (curStmt.segments.some(seg => seg.length > 0)) stmts.push(curStmt);

  // Filter out statements whose pipeline is entirely empty (e.g. `;;` typo)
  return stmts.filter(s => s.segments.some(seg => seg.length > 0));
}

/**
 * Strip outer quotes from a token. Used after expand.js has done its
 * work, to produce the final clean string the command handler sees.
 *
 * Single quotes: strip outer pair, keep content verbatim.
 * Double quotes: strip outer pair, keep content (escapes already
 *   processed during parse).
 * No quotes: pass through.
 */
export function unquote(token) {
  if (!token || token.length < 2) return token;
  const first = token[0];
  const last  = token[token.length - 1];
  if ((first === SINGLE && last === SINGLE) || (first === DOUBLE && last === DOUBLE)) {
    return token.slice(1, -1);
  }
  return token;
}

/**
 * Brace expansion: `cat {a,b,c}.txt` → `cat a.txt b.txt c.txt`.
 * Bash-style comma-separated list inside `{...}`. Multiple braces
 * in one token Cartesian-product. Used per-token by the expansion
 * layer.
 *
 * Quote-aware: braces inside `'...'` or `"..."` regions of the
 * token are LITERAL (bash behavior — `echo "{a,b}"` prints
 * `{a,b}`). Tokens containing any quote character skip brace
 * expansion entirely. This is slightly broader than bash's
 * "only-the-unquoted-parts" rule, but covers the engine's needs
 * (every level command that uses braces uses them in unquoted
 * argument positions) without introducing a second tokenizer
 * just for braces.
 */
export function expandBraces(token) {
  // Quoted tokens (e.g. awk programs like `'{print $1, $2}'`) must
  // never be brace-expanded — `{...,...}` inside a quoted region is
  // literal in bash, and the engine's command handlers expect the
  // quoted content to arrive intact.
  if (token.includes("'") || token.includes('"')) return [token];

  const m = token.match(/^([^{]*)\{([^{}]+)\}(.*)$/);
  if (!m) return [token];
  const [, prefix, body, suffix] = m;
  if (!body.includes(",")) return [token]; // empty brace = literal
  const parts = body.split(",");
  const expandedSuffix = expandBraces(suffix); // recurse on tail
  const out = [];
  for (const p of parts) {
    for (const s of expandedSuffix) {
      out.push(prefix + p + s);
    }
  }
  return out;
}
