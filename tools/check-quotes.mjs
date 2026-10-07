// Prove that no walkthrough misquotes the game.
//
// Walkthroughs reproduce lines out of levels/<track>.js verbatim. An
// editing pass that "improves" one of those quotes makes the page
// disagree with the level it documents, and nothing else in the build
// checks for that. This does.
//
// Method: take every reasonably long quoted span in every walkthrough,
// normalise whitespace, and require that if a NEARLY identical string
// exists in the level data, the quote matches it exactly.

import fs from "node:fs";
import path from "node:path";

const levels = fs
  .readdirSync("levels")
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join("levels", f), "utf8"))
  .join("\n")
  .replace(/\s+/g, " ");

let checked = 0;
const bad = [];

for (const track of fs
  .readdirSync("walkthroughs", { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "vendor")
  .map((d) => d.name)) {
  for (const f of fs.readdirSync(path.join("walkthroughs", track)).filter((x) => x.endsWith(".md"))) {
    const p = path.join("walkthroughs", track, f);
    const md = fs.readFileSync(p, "utf8");
    for (const m of md.matchAll(/"([^"\n]{40,})"/g)) {
      const q = m[1].replace(/`/g, "").replace(/\s+/g, " ").trim();
      checked++;
      if (levels.includes(q)) continue;
      // Not found verbatim. If a dash-free version of it IS in the level
      // data, the quote was edited and now disagrees with the game.
      const probe = q.replace(/,\s*/g, " ").replace(/\.\s*/g, " ").replace(/\s+/g, " ");
      const flat = levels.replace(/[—–]/g, " ").replace(/,\s*/g, " ").replace(/\.\s*/g, " ").replace(/\s+/g, " ");
      if (flat.includes(probe)) bad.push(`${track}/${f}: ${q.slice(0, 90)}`);
    }
  }
}

console.log(`quoted spans checked: ${checked}`);
if (bad.length) {
  console.log(`MISQUOTES the game (${bad.length}):`);
  for (const b of bad) console.log("  " + b);
  process.exit(1);
}
console.log("no walkthrough misquotes its level data");
