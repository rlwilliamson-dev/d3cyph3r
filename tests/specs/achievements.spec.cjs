// tests/specs/achievements.spec.cjs
//
// v1.14.0 — 20-achievement layer. Verifies the registry renders all
// four tiers (Easy / Medium / Hard / Completionist), specific
// achievements unlock on their triggers (1985 on crt-green theme,
// First Steps on first non-lobby connect, Asked for Help on `man`),
// `achievements --detail` surfaces progress fractions, and earned
// state mirrors into localStorage when persistence is enabled.
//
// Ported from the v1.23.x monolithic playtest.cjs lines 2316-2405.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Tests run serially because they progressively earn achievements —
// 1985 (theme), then First Steps (ssh), then Asked for Help (man) —
// and the final localStorage check relies on the accumulated set
// being present.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
  resetState,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe.serial("achievements (v1.14.0)", () => {
  test.beforeAll(async ({ browser }) => {
    // Single shared page across the serial block so achievements
    // accumulate the way the monolithic playtest exercised them.
    // Created in beforeAll, reused via fixture below.
  });

  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("clean lobby shows 0/20 earned across all 4 tiers", async ({ page }) => {
    // Clean reset so we have a known earned set (0).
    await bootAndWait(page, "/");
    await resetState(page);

    await dispatchCmd(page, "achievements");
    const t = await terminalText(page);
    expect(t).toMatch(/Achievements\s*\(0\/20\s+earned\)/);
    // All four tier sections should be present.
    expect(t).toMatch(/\bEASY\b/);
    expect(t).toMatch(/\bMEDIUM\b/);
    expect(t).toMatch(/\bHARD\b/);
    expect(t).toMatch(/\bCOMPLETIONIST\b/);
    // Spot-check 4 of the 20 achievement names from different tiers.
    expect(t).toContain("First Steps");
    expect(t).toContain("Multi-Host Pivot");
    expect(t).toContain("Polymath");
    expect(t).toContain("Completionist");
  });

  test("1985 achievement unlocks on theme crt-green", async ({ page }) => {
    await bootAndWait(page, "/");
    await resetState(page);

    await dispatchCmd(page, "theme crt-green");
    const t = await terminalText(page);
    expect(t).toMatch(/Achievement unlocked:\s*1985/);

    // Reset theme so we don't leak into the next test.
    await dispatchCmd(page, "theme dark");
  });

  test("First Steps unlocks on first non-lobby connect", async ({ page }) => {
    await bootAndWait(page, "/");
    await resetState(page);

    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    // Dismiss the persistence prompt that fires for fresh-session connects.
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");

    const t = await terminalText(page);
    expect(t).toMatch(/Achievement unlocked:\s*First Steps/);
  });

  test("Asked for Help unlocks on man + --detail shows progress fractions", async ({ page }) => {
    await bootAndWait(page, "/");
    await resetState(page);

    // ssh in first (gets the v1.11.0 prompt out of the way).
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");

    // Trigger Asked for Help — read any manpage.
    await dispatchCmd(page, "man ls");
    let t = await terminalText(page);
    expect(t).toMatch(/Achievement unlocked:\s*Asked for Help/);

    // achievements --detail shows progress fractions.
    await dispatchCmd(page, "achievements --detail");
    t = await terminalText(page);
    expect(t).toMatch(/progress:\s*\d+\/\d+ tracks visited/);
    expect(t).toMatch(/progress:\s*\d+\/\d+ bonus finds/);
  });

  test("earned achievements mirror to localStorage when persistence is enabled", async ({ page }) => {
    await bootAndWait(page, "/");
    await resetState(page);

    // Earn First Steps so there's something to mirror.
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    await waitForOutput(page, "Progress stays in this tab only");

    // Opt into persistence and check the blob.
    await dispatchCmd(page, "progress save-on");
    const earnedInLs = await page.evaluate(() => {
      const raw = localStorage.getItem("d3cyph3r-progress");
      if (!raw) return null;
      try { return JSON.parse(raw)["d3cyph3r:earnedAchievements"]; } catch (_) { return null; }
    });
    expect(typeof earnedInLs).toBe("string");
    expect(earnedInLs).toContain("first-steps");
  });
});
