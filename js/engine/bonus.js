// Bonus-finds — optional discoverable nuggets within a level.
//
// A level can declare `bonusFinds`, an array of small puzzles the
// player MAY uncover but doesn't have to. They don't gate the
// credential chain; they're for replay value and curious players.
//
// Schema (on level data):
//
//   bonusFinds: [
//     {
//       id:       "easter-1",            // unique within the level
//       name:     "Sloan's leftover key",  // shown when found
//       hint:     "There's something in /var/log/old",
//       trigger:  {
//         command:        "cat",          // optional — argv[0] match
//         argMatches:     /\/var\/log\/old/,  // RegExp matched against the JOINED args
//         outputContains: "leftover key", // RegExp or substring matched on output
//       },
//     },
//   ]
//
// Any trigger condition not set in the entry is treated as "match
// anything." So a find with only `outputContains` will fire on whatever
// command happened to surface that string.
//
// On match:
//   - state.markBonusFound(levelKey, id) (sessionStorage-backed)
//   - print a dim ✦ banner with the name
//
// `progress` queries `state.isBonusFound(levelKey, id)` to show
// X/Y per level + names the discovered finds in --detail mode.

import { print } from "../terminal/output.js";
import { currentLevelKey, markBonusFound, isBonusFound } from "./state.js";

/** Test a string against either a RegExp or a substring. */
function matchesAny(str, pattern) {
  if (pattern == null) return true;
  if (pattern instanceof RegExp) return pattern.test(str);
  return String(str).includes(String(pattern));
}

/**
 * Check the level's bonusFinds against this command + its output.
 * Mutates state when a previously-unseen find matches; prints a
 * discovery banner.
 *
 * @param {object} level   - Current level data (may have bonusFinds).
 * @param {string[]} tokens - Raw expanded argv of the command segment.
 * @param {string} output  - The visible stdout that was just printed.
 */
export function checkBonusFinds(level, tokens, output) {
  if (!level || !Array.isArray(level.bonusFinds)) return;
  if (!tokens || tokens.length === 0) return;

  const cmd  = tokens[0];
  const args = tokens.slice(1).join(" ");

  for (const find of level.bonusFinds) {
    if (!find || !find.id) continue;
    if (isBonusFound(currentLevelKey, find.id)) continue;
    const t = find.trigger || {};
    if (t.command && t.command !== cmd) continue;
    if (!matchesAny(args, t.argMatches))     continue;
    if (!matchesAny(output, t.outputContains)) continue;

    markBonusFound(currentLevelKey, find.id);
    const name = find.name || find.id;
    print("", "out");
    print(`  ✦ Bonus find unlocked: ${name}`, "success");
    if (find.hint) print(`    ${find.hint}`, "dim");
    print("", "out");
  }
}
