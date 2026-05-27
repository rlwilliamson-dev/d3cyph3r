// Player-facing `achievements` command (v1.14.0).
//
// Default — list every achievement grouped by tier, with a ★ for
// earned and · for unearned. Description always visible (these are
// motivation, not spoilers — see the comment in
// js/engine/achievements.js).
//
// `--detail` — also print a progress fraction for the achievements
// where progress is measurable (e.g. Polymath "4/7 tracks").
// Players who like checklists get a clear "how close am I" view.

import { print } from "../terminal/output.js";
import {
  ACHIEVEMENTS, getEarnedAchievements, computeAggregates,
} from "../engine/achievements.js";

const TIER_ORDER = ["Easy", "Medium", "Hard", "Completionist"];

/**
 * Optional progress-fraction text per achievement id. Returns null
 * when the achievement is a boolean (no meaningful "progress" to
 * show — it's either earned or it isn't).
 */
function progressFor(id, ag) {
  switch (id) {
    case "branching-out":   return `${Math.min(ag.visitedTracks.size, 3)}/3 tracks visited`;
    case "all-hands":       return `${ag.visitedTracks.size}/${ag.totalTracks} tracks visited`;
    case "track-master":    return `${ag.visited.size}/${ag.totalLevels} levels visited`;
    case "sleuth":          return `${Math.min(ag.foundBonusesCount, 5)}/5 bonus finds`;
    case "polymath":        return `${ag.tracksWithBonus.size}/${ag.totalTracks} tracks with at least one bonus`;
    case "thorough":        return `${ag.trackBonusComplete.size} track${ag.trackBonusComplete.size === 1 ? "" : "s"} fully bonused`;
    case "completionist":   return `${ag.foundBonusesCount}/${ag.totalBonuses} bonus finds`;
    case "style-points":    {
      const seen = (ag.milestones.themesSeen || []).length;
      return `${Math.min(seen, 3)}/3 themes tried`;
    }
    default: return null;
  }
}

export const achievementCommands = {
  achievements(_level, arg) {
    const detail = (arg || "").trim() === "--detail";
    const earned = getEarnedAchievements();
    const ag     = computeAggregates();

    // Per-line printing (instead of returning text+cls) so earned
    // rows can render in success-green and unearned in dim — visual
    // distinction matters more here than a single-class summary.
    print(`Achievements (${earned.size}/${ACHIEVEMENTS.length} earned)`, "info");
    print("", "out");

    for (const tier of TIER_ORDER) {
      const list = ACHIEVEMENTS.filter(a => a.tier === tier);
      if (list.length === 0) continue;
      print(`  ${tier.toUpperCase()}`, "warn");
      for (const a of list) {
        const isEarned = earned.has(a.id);
        const mark = isEarned ? "★" : "·";
        print(`    ${mark} ${a.name}: ${a.description}`,
              isEarned ? "success" : "dim");
        if (detail) {
          const p = progressFor(a.id, ag);
          if (p) print(`        progress: ${p}`, "dim");
        }
      }
      print("", "out");
    }

    if (!detail) {
      print("Run 'achievements --detail' to see progress fractions where measurable.", "dim");
    }
    // Suppress the dispatcher's default printing — we've handled
    // it line-by-line above.
    return null;
  },
};
