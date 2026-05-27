// Typo suggestions (v1.15.0). When the dispatcher sees a command
// name that isn't registered, it asks this module for the closest
// known command. If something plausible turns up, we print a
// yellow "Did you mean: <cmd>?" follow-up under the red "command
// not found" line.
//
// SCOPE
//   Commands only — not ssh targets, not flag names. The typo
//   space for `ssh user@host` is too wide and the corpus too
//   small (~14 levels) for suggestions to feel useful; flag
//   typos would require each command to instrument its own
//   parser. Commands cover ~90% of real-world typos with one
//   small module.
//
// ALGORITHM
//   Plain Levenshtein edit distance (insertions, deletions,
//   substitutions — single-character ops only; no transposition
//   shortcut). Case-insensitive — both sides are lowercased
//   before comparison, so `LS` matches `ls` at distance 0.
//
// THRESHOLD
//   Conservative on purpose. A typed string of length 1–3 must
//   land within distance 1; length 4+ must land within distance
//   2. The short-string rule is what stops nonsense like
//   `xy → ls` (distance 2, would otherwise pass) from showing
//   up as a "did you mean" prompt.
//
// TIE-BREAKING
//   When multiple candidates share the same best distance:
//     1. Shorter candidate wins  (so `lss` → `ls`, not `lsof`).
//     2. On equal length, alphabetical (deterministic for tests).
//
// COST
//   The candidate pool is the live `COMMANDS` keys (~80 entries)
//   plus the `ssh` alias. Levenshtein on strings ≤16 chars over
//   ~80 candidates is well under a millisecond — we run it
//   exactly once per "command not found", which is rare. No
//   memoization or trigram pre-filter needed.

/**
 * Levenshtein distance between two strings. Case-insensitive.
 * Standard two-row DP — the full O(m·n) table isn't needed since
 * we only ever look at the previous row.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} Edit distance (number of single-character
 *   inserts / deletes / substitutions to turn `a` into `b`).
 */
export function levenshtein(a, b) {
  const s = String(a).toLowerCase();
  const t = String(b).toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j]     + 1,     // deletion
        curr[j - 1] + 1,     // insertion
        prev[j - 1] + cost,  // substitution
      );
    }
    // Swap rows; reuse the array we just finished reading.
    const tmp = prev; prev = curr; curr = tmp;
  }
  // Last write landed in `prev` after the final swap.
  return prev[n];
}

/**
 * Per-length threshold for "close enough to suggest". Short
 * strings hold to distance 1; length 4+ allow distance 2.
 *
 * @param {number} length
 * @returns {number} Max allowed Levenshtein distance.
 */
export function thresholdFor(length) {
  return length <= 3 ? 1 : 2;
}

/**
 * Find the closest known command to `typed`, or null if nothing
 * is within threshold.
 *
 * @param {string} typed - What the user wrote.
 * @param {Iterable<string>} candidates - Known command names
 *   (typically `Object.keys(COMMANDS)` plus `"ssh"`).
 * @returns {string | null} The single best candidate, or null
 *   when no candidate is close enough.
 */
export function suggestCommand(typed, candidates) {
  const t = String(typed).toLowerCase();
  if (!t) return null;
  const limit = thresholdFor(t.length);

  let best = null;
  let bestDist = Infinity;
  for (const cand of candidates) {
    const d = levenshtein(t, cand);
    if (d > limit) continue;
    if (d < bestDist) {
      best = cand;
      bestDist = d;
      continue;
    }
    if (d === bestDist && best) {
      // Tie: prefer the shorter candidate, then alphabetical.
      if (cand.length < best.length
       || (cand.length === best.length && cand < best)) {
        best = cand;
      }
    }
  }
  return best;
}
