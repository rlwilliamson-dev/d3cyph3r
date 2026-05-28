// tests/specs/themes-and-tutorial.spec.cjs
//
// v1.13.0 — 11-theme picker. Verifies the theme registry, data-theme
// + data-theme-mode body attributes, the four-shape command surface
// (`themes`, `theme`, `theme <name>`, `theme next/prev`), the
// invalid-name guard, and the localStorage round-trip across reload.
// Plus the topbar toggle-button cycle.
//
// v1.12.0 — First-visit guided tour. Exercises the `tutorial start`
// interactive state machine end-to-end: each expected command
// advances the step, mismatched input nudges without trapping,
// 'skip' exits cleanly, the completion banner fires after the final
// step's ssh dispatch (and lands BEFORE the level-entry chrome), and
// the lobby-only guardrail prints a friendly redirect when invoked
// from inside a level.
//
// Ported from the v1.23.x monolithic playtest.cjs lines 2407-2631.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so storage state is fresh per test.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
  resetState,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("themes (v1.13.0)", () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
    // Reset to a known clean state (default dark theme).
    await page.goto("/");
    await page.evaluate(() => { localStorage.removeItem("d3cyph3r-theme"); });
    await page.reload();
    await page.waitForFunction(() => {
      const t = document.getElementById("terminal");
      return t && t.innerText.includes("AVAILABLE ENGAGEMENTS");
    }, null, { timeout: 8000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("`themes` lists all 11 + marks current with arrow", async ({ page }) => {
    await dispatchCmd(page, "themes");
    const t = await terminalText(page);
    for (const name of [
      "dark", "light", "crt-green", "amber", "synthwave",
      "solarized-dark", "solarized-light", "high-contrast",
      "nord", "gruvbox", "dracula",
    ]) {
      expect(t, `themes lists '${name}'`).toContain(name);
    }
    expect(t).toMatch(/→\s+dark\b/);
  });

  test("`theme` (no arg) reports current theme", async ({ page }) => {
    await dispatchCmd(page, "theme");
    const t = await terminalText(page);
    expect(t).toMatch(/Current theme:\s*dark/);
  });

  test("`theme crt-green` sets data-theme + dark mode attribute", async ({ page }) => {
    await dispatchCmd(page, "theme crt-green");
    const themeAttr = await page.evaluate(() => document.body.getAttribute("data-theme"));
    const modeAttr  = await page.evaluate(() => document.body.getAttribute("data-theme-mode"));
    expect(themeAttr).toBe("crt-green");
    expect(modeAttr).toBe("dark");
  });

  test("light themes flip data-theme-mode to 'light'", async ({ page }) => {
    await dispatchCmd(page, "theme solarized-light");
    const modeAttr = await page.evaluate(() => document.body.getAttribute("data-theme-mode"));
    expect(modeAttr).toBe("light");
  });

  test("invalid theme name errors gracefully without changing state", async ({ page }) => {
    await dispatchCmd(page, "theme solarized-light");
    await dispatchCmd(page, "theme purple-monkey-dishwasher");
    const t = await terminalText(page);
    expect(t).toMatch(/unknown theme/i);
    // Theme should NOT have been changed by the invalid command.
    const stillLight = await page.evaluate(() => document.body.getAttribute("data-theme"));
    expect(stillLight).toBe("solarized-light");
  });

  test("`theme next` advances and `theme prev` reverses", async ({ page }) => {
    await dispatchCmd(page, "theme solarized-light");
    await dispatchCmd(page, "theme next");
    const afterNext = await page.evaluate(() => document.body.getAttribute("data-theme"));
    expect(afterNext).not.toBe("solarized-light");

    await dispatchCmd(page, "theme prev");
    const afterPrev = await page.evaluate(() => document.body.getAttribute("data-theme"));
    expect(afterPrev).toBe("solarized-light");
  });

  test("theme choice survives reload (localStorage round-trip)", async ({ page }) => {
    await dispatchCmd(page, "theme dracula");
    const lsBefore = await page.evaluate(() => localStorage.getItem("d3cyph3r-theme"));
    expect(lsBefore).toBe("dracula");

    await page.reload();
    await bootAndWait(page, "/");
    const afterReload = await page.evaluate(() => document.body.getAttribute("data-theme"));
    expect(afterReload).toBe("dracula");
  });

  test("topbar theme toggle cycles to next theme", async ({ page }) => {
    await dispatchCmd(page, "theme dark");
    await page.locator("#theme-toggle").click();
    const afterClick = await page.evaluate(() => document.body.getAttribute("data-theme"));
    expect(afterClick).not.toBe("dark");
  });
});

test.describe.serial("guided tour (v1.12.0)", () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
    await bootAndWait(page, "/");
    await resetState(page);
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("full happy path: step 1 → step 4 → completion banner before connect", async ({ page }) => {
    // Kick off the interactive tour from a fresh lobby.
    await dispatchCmd(page, "tutorial start");
    let t = await terminalText(page);
    expect(t).toContain("TUTORIAL  (1/4)");
    expect(t).toMatch(/Type 'help' and press Enter/i);

    // Wrong-command nudge — type 'ls' instead of 'help'. Tour
    // should print a nudge but still let the dispatch run.
    const beforeMistype = t.length;
    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    const afterMistype = t.slice(beforeMistype);
    expect(afterMistype).toMatch(/tutorial: type 'help'/i);
    // Tour should still be at step 1 — verify by checking step
    // header didn't advance.
    expect(afterMistype).not.toContain("TUTORIAL  (2/4)");

    // Correct command — advances to step 2.
    await dispatchCmd(page, "help");
    t = await terminalText(page);
    expect(t).toContain("OPEN-SOURCE INTEL"); // help output still appears
    expect(t).toContain("TUTORIAL  (2/4)");
    expect(t).toMatch(/Type 'tracks'|expand the engagement tree/i);

    // Step 2 → 3.
    await dispatchCmd(page, "tracks");
    t = await terminalText(page);
    expect(t).toContain("TUTORIAL  (3/4)");

    // Step 3 → 4.
    await dispatchCmd(page, "tiers");
    t = await terminalText(page);
    expect(t).toContain("TUTORIAL  (4/4)");

    // Step 4 — the final ssh that completes the tour. This is
    // the only step whose completion message prints BEFORE
    // dispatch (so the banner lands above the level-entry chrome).
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    t = await terminalText(page);
    expect(t).toContain("TUTORIAL COMPLETE");
    expect(t).toContain("Connected: level0@linux");

    // Order check — TUTORIAL COMPLETE should appear BEFORE the
    // connection banner so the player sees the tour outro before
    // the level-entry chrome.
    const tutCompleteIdx = t.lastIndexOf("TUTORIAL COMPLETE");
    const connectIdx     = t.lastIndexOf("Connected: level0@linux");
    expect(tutCompleteIdx).toBeGreaterThanOrEqual(0);
    expect(connectIdx).toBeGreaterThanOrEqual(0);
    expect(tutCompleteIdx).toBeLessThan(connectIdx);

    // Dismiss the persistence prompt that fires for fresh-session connects.
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");
  });

  test("'skip' exits the tour cleanly and stops intercepting input", async ({ page }) => {
    // Kick off the tour and immediately skip it.
    await dispatchCmd(page, "tutorial start");
    await dispatchCmd(page, "skip");
    let t = await terminalText(page);
    expect(t.lastIndexOf("TUTORIAL SKIPPED")).toBeGreaterThan(0);

    // Verify tour is no longer intercepting input — a normal
    // command dispatches without a tutorial nudge.
    await dispatchCmd(page, "help");
    t = await terminalText(page);
    const lastHelp  = t.lastIndexOf("OPEN-SOURCE INTEL");
    const lastNudge = t.lastIndexOf("(tutorial: type");
    expect(lastHelp).toBeGreaterThan(0);
    // Either no nudge at all, or last nudge happened well before
    // this help (i.e., from an earlier step in the tour, not from
    // this `help` invocation).
    expect(lastNudge < 0 || lastNudge < lastHelp - 1000).toBeTruthy();
  });

  test("'tutorial start' from inside a level is gated to lobby", async ({ page }) => {
    // Drop into a level first.
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    // Dismiss the v1.11.0 persistence prompt.
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");

    // Now attempt the tour from inside the level.
    await dispatchCmd(page, "tutorial start");
    const t = await terminalText(page);
    expect(t).toContain("run 'tutorial start' from the lobby");
  });
});
