// Level-difficulty tiers — single source of truth.
//
// A level's tier is COMPUTED from its level number, not stored in
// level data. This keeps the curve uniform across tracks: a level5
// is a level5 regardless of which track it lives on. Authors don't
// have to remember to set the right label; players don't have to
// trust that the label is accurate.
//
// Why "tiers" instead of plain "difficulty"? The labels (Routine,
// Live, Escalated, Critical, Crisis) describe the *operational
// state* of the engagement, not just a difficulty score. A "Live"
// engagement isn't merely harder than a "Routine" one — it carries
// real contractual stakes and time pressure. The label is a
// promise about the kind of pressure the player should expect
// inside the box, not just about puzzle complexity.
//
// To see the tier explanations in-game, type `tiers` at any prompt.
//
// Schema (each entry):
//   name        — short label shown in lobby / connection banner
//   range       — [min, max] inclusive level numbers; `max: null`
//                  means open-ended (catches all higher numbers)
//   description — 1–2 sentence explanation surfaced by `tiers`
//                  command and `man tiers`
//
// The TIERS array is order-dependent — `tierForLevel(N)` walks it
// in order and returns the first entry whose range contains N.

export const TIERS = [
  {
    name: "Routine",
    range: [0, 5],
    description:
      "Standard quarterly audit work. No time pressure, controlled " +
      "scope, documented findings.",
  },
  {
    name: "Live",
    range: [6, 10],
    description:
      "Active client engagement with real contractual stakes. The " +
      "clock ticks on a contract, not a sprint.",
  },
  {
    name: "Escalated",
    range: [11, 15],
    description:
      "Incident response in progress. Decisions made by people who " +
      "weren't briefed yesterday.",
  },
  {
    name: "Critical",
    range: [16, 20],
    description:
      "Notification clocks running. Outside counsel on the call. " +
      "Mistakes become next quarter's earnings call.",
  },
  {
    name: "Crisis",
    range: [21, null],
    description:
      "The kind of engagement that produces a public statement. The " +
      "question is no longer 'what happened' but 'how do we contain " +
      "the damage.'",
  },
];

/**
 * Return the tier name for a level number, or null if N isn't a
 * non-negative integer (e.g. pivot hosts pass `null` and get no
 * tier label — they don't belong on the main difficulty curve).
 *
 * @param {number} n - level ordinal (e.g. 0, 1, 2)
 * @returns {string | null}
 */
export function tierForLevel(n) {
  if (!Number.isFinite(n) || n < 0) return null;
  for (const t of TIERS) {
    const [min, max] = t.range;
    if (n >= min && (max === null || n <= max)) return t.name;
  }
  return null;  // unreachable for valid N given Crisis catches 21+
}

/**
 * Lookup the descriptive sentence for a tier by name. Returns the
 * empty string if the name doesn't match a known tier.
 *
 * @param {string} tierName
 * @returns {string}
 */
export function tierDescription(tierName) {
  const t = TIERS.find(x => x.name === tierName);
  return t ? t.description : "";
}

/**
 * Helper: extract the numeric level ordinal from a level key like
 * "level3@linux". Returns null if the key isn't in that shape (e.g.
 * pivot hosts, lobby, anything non-numbered).
 *
 * @param {string} key
 * @returns {number | null}
 */
export function levelNumberFromKey(key) {
  const m = /^level(\d+)@/.exec(key || "");
  return m ? parseInt(m[1], 10) : null;
}
