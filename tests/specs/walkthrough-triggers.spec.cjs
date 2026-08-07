// Every command a walkthrough tells a player to run must actually run.
//
// WHY THIS EXISTS
// ---------------
// §7.5 "Optional exploration" points players at commands that unlock the
// level's bonus finds: "**Trigger:** `evtx -id 4688 Security.evtx`". A
// walkthrough that says "try this" and gets "command not found" is worse
// than a walkthrough that says nothing, because the player assumes they
// mistyped it.
//
// Nothing connected those two surfaces. The walkthrough corpus and the
// command registry are edited independently, so a renamed flag or a
// dropped file breaks the instruction silently. This test reads the
// triggers straight out of the markdown and executes them in the engine.
//
// Scoped to the explicit **Trigger:** lines rather than every inline code
// span in the section. The prose also quotes command names ("the `aws`
// command") and, in one case, reproduces a character's shell history —
// those are not instructions to the player, and treating them as such
// produced six false alarms on the first pass.

const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
  resetState,
  waitForOutput,
} = require("../lib/helpers.cjs");

const WT = path.join(__dirname, "..", "..", "walkthroughs");

/** [{ level, cmds }] for every walkthrough whose §7.5 names a trigger. */
function readTriggers() {
  const out = [];
  const tracks = fs
    .readdirSync(WT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== "vendor")
    .map((d) => d.name)
    .sort();

  for (const track of tracks) {
    for (const f of fs.readdirSync(path.join(WT, track)).filter((x) => x.endsWith(".md")).sort()) {
      const md = fs.readFileSync(path.join(WT, track, f), "utf8");
      const a = md.search(/^## §7\.5/m);
      const b = md.search(/^## §8/m);
      if (a < 0 || b < 0) continue;

      const cmds = [
        ...new Set(
          [...md.slice(a, b).matchAll(/\*\*Trigger:?\*\*:?\s*`([^`]+)`/g)].map((m) =>
            m[1].trim()
          )
        ),
      ].filter((c) => !/[<>]/.test(c)); // placeholders are documentation

      if (cmds.length) out.push({ level: `${f.replace(/\.md$/, "")}@${track}`, cmds });
    }
  }
  return out;
}

const PLAN = readTriggers();

test("every §7.5 trigger command runs in its level", async ({ page }) => {
  expect(PLAN.length, "no §7.5 triggers found — has the format changed?").toBeGreaterThan(10);

  await bootAndWait(page);
  const passwords = await page.evaluate(async () => {
    const m = await import("/levels/index.js");
    const out = {};
    for (const [k, v] of Object.entries(m.LEVELS)) out[k] = v.password || null;
    return out;
  });

  const problems = [];

  for (const { level, cmds } of PLAN) {
    // Straight to the target from a fresh boot. The password is the
    // gate, not a prior visit, so walking level0 -> levelN is
    // unnecessary — and doing so fires the v1.11.0 persistence prompt
    // mid-chain, which swallows the next ssh and silently parks the
    // shell on level0.
    await resetState(page);
    await dispatchCmd(page, `ssh ${level}`);
    if (passwords[level]) await dispatchCmd(page, passwords[level]);
    await waitForOutput(page, `Connected: ${level}`);
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");

    // Ask the engine where it is rather than reading the banner: the
    // wording differs between a free connect and one through a password
    // gate, and guessing at it reported every gated level as unreachable.
    const at = await page.evaluate(async () => {
      const st = await import("/js/engine/state.js");
      return st.currentLevelKey;
    });
    expect(at, `failed to enter ${level}`).toBe(level);

    for (const cmd of cmds) {
      // Compare only what THIS command printed. Reading the tail of the
      // whole buffer attributes a previous command's error to the next.
      const before = (await terminalText(page)).length;
      await dispatchCmd(page, cmd);
      const fresh = (await terminalText(page)).slice(before);

      const BAD = [
        /command not found/i,
        /no such file or directory/i,
        /unknown (?:command|option|subcommand|service)/i,
        /invalid (?:option|argument|choice)/i,
        /^\s*Usage:/im,
      ];
      const hit = BAD.find((re) => re.test(fresh));
      if (hit) {
        problems.push(`${level}: "${cmd}" -> ${(fresh.match(hit) || [""])[0].trim()}`);
      }
    }
  }

  expect(problems, `\n${problems.join("\n")}\n`).toEqual([]);
});
