// tests/specs/lobby-tree.spec.cjs
//
// v1.10.0 lobby polish surface — tests that run from the lobby (no
// level ssh required) plus the two ssh-error paths that exercise
// the lobby-tier hint engine without ever connecting:
//   - `tracks` command (collapsible engagement tree)
//   - `tiers` command (difficulty-tier legend)
//   - `progress --detail` (per-track summary + bonus-find listing)
//   - cold-start gate hint (yellow follow-up after Permission denied
//     when the prerequisite level wasn't visited)
//   - future-level tip (yellow follow-up after the red DNS error
//     when ssh-ing `level<N>@<known-host>` past the shipped ceiling)
//
// Ported from the v1.23.x monolithic playtest.cjs lines ~2136-2315.
// All tests start fresh in the lobby — none of them mutate state in
// a way that would bleed into another test (each Playwright test()
// gets its own browser context).
//
// Note on `progress --detail`: the monolith asserted on specific
// bonus-find names because earlier sections of that mega-script had
// already unlocked them. Per-spec contexts start clean, so this
// file seeds the relevant bonusFinds + visited keys in sessionStorage
// before reloading, which exercises the same "discovered find renders
// by name" code path without depending on cross-test order.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
} = require("../lib/helpers.cjs");

test.describe("lobby tree (v1.10.0)", () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
    await bootAndWait(page, "/");
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test.describe("tracks command", () => {
    test("tracks (no args) prints expand-state report listing each track", async ({ page }) => {
      await dispatchCmd(page, "tracks");
      const t = await terminalText(page);
      expect(t).toContain("Track expand state:");
      expect(t).toContain("linux");
      expect(t).toContain("network");
    });

    test("tracks reset collapses every track", async ({ page }) => {
      await dispatchCmd(page, "tracks reset");
      const t = await terminalText(page);
      expect(t).toContain("All tracks collapsed");
    });

    test("tracks <name> expands a known track + lobby re-renders with its levels", async ({ page }) => {
      // Start from a known-clean expand state.
      await dispatchCmd(page, "tracks reset");
      await dispatchCmd(page, "tracks linux");
      const t = await terminalText(page);
      expect(t).toContain("Track 'linux' expanded");
      // After the toggle the lobby re-renders with linux open. Each
      // level row carries the v1.10.0 title + the computed tier tag.
      expect(t).toContain("ssh level1@linux");
      expect(t).toContain("Halton Bank staging bastion");
      expect(t).toContain("Daniel's laptop handoff");
      // level0/level1 sit in the 0-5 range → Routine tier.
      expect(t).toContain("[Routine]");
    });

    test("tracks <unknown> errors with helpful message", async ({ page }) => {
      await dispatchCmd(page, "tracks doesnotexist");
      const t = await terminalText(page);
      expect(t).toContain("is not a known track");
    });

    test("tracks all expands every track + reveals non-linux level1s", async ({ page }) => {
      await dispatchCmd(page, "tracks all");
      const t = await terminalText(page);
      expect(t).toContain("All tracks expanded");
      // After the re-render, a non-linux level1 row is visible.
      expect(t).toContain("ssh level1@network");
    });
  });

  test.describe("tiers command", () => {
    test("tiers prints the full Routine→Crisis legend", async ({ page }) => {
      await dispatchCmd(page, "tiers");
      const t = await terminalText(page);
      expect(t).toContain("Difficulty tiers");
      expect(t).toContain("Routine");
      expect(t).toContain("level0–5");           // U+2013 en dash
      expect(t).toContain("Live");
      expect(t).toContain("level6–10");
      expect(t).toContain("Escalated");
      expect(t).toContain("level11–15");
      expect(t).toContain("Critical");
      expect(t).toContain("level16–20");
      expect(t).toContain("Crisis");
      expect(t).toContain("level21+");
    });

    test("tiers explains the operational-state framing (not raw puzzle complexity)", async ({ page }) => {
      await dispatchCmd(page, "tiers");
      const t = await terminalText(page);
      // The legend's prose can phrase this either way — accept either
      // phrasing so a copy tweak doesn't break the test.
      expect(t).toMatch(/not the puzzle complexity|operational state/);
    });
  });

  test.describe("progress --detail", () => {
    test("prints session-summary + bonus-find aggregate lines", async ({ page }) => {
      await dispatchCmd(page, "progress --detail");
      const t = await terminalText(page);
      expect(t).toMatch(/\d+ \/ \d+ levels visited this session/);
      expect(t).toMatch(/\d+ \/ \d+ bonus finds discovered/);
    });

    test("un-visited levels render the anti-spoiler '(visit the level to discover...)' line", async ({ page }) => {
      // Fresh context = no levels visited. The --detail expansion for
      // any level with bonusFinds should fall into the un-visited
      // branch and print the anti-spoiler line.
      await dispatchCmd(page, "progress --detail");
      const t = await terminalText(page);
      expect(t).toContain("visit the level to discover");
    });

    test("discovered bonuses render by name in --detail mode (seeded state)", async ({ page }) => {
      // Seed visited + bonusFinds directly in sessionStorage so the
      // --detail render takes the "found" branch and prints each
      // bonus by name (✦ prefix in the code; the name text is what
      // we assert against).
      await page.evaluate(() => {
        // Visit every shipped level so the un-found render path is
        // skipped for these names.
        sessionStorage.setItem(
          "visited",
          JSON.stringify([
            "level0@linux", "level1@linux",
            "level0@network", "level1@network",
            "level0@crypto", "level1@crypto",
            "level0@web", "level1@web",
            "level0@forensics", "level1@forensics", "level2@forensics",
            "level0@osint", "level1@osint",
            "level0@cloud", "level1@cloud",
          ])
        );
        // Bonus-find storage shape: "<levelKey>:<findId>". We don't
        // know every id off-hand; this test only needs the v1.10.0
        // names from the original monolith block. Easier route: set
        // sessionStorage to contain the IDs we lifted from the level
        // files.
        // IDs sourced directly from the per-track level files'
        // `bonusFinds[].id`. These are the IDs the engine writes to
        // sessionStorage when a player triggers each find; seeding
        // them here is equivalent to "the player already found this."
        sessionStorage.setItem(
          "d3cyph3r:bonusFinds",
          JSON.stringify([
            "level0@linux:daniel-history-pattern",
            "level1@linux:backup-script",
            "level1@linux:self-logged-bug",
            "level0@network:five-sprint-rotation",
            "level1@network:dbadmin-shell-drift",
            "level0@crypto:daniel-coffee-vendor",
            "level1@crypto:most-downloaded-fallacy",
            "level0@web:robots-txt-billboard",
            "level1@web:ten-year-session-token",
            "level0@forensics:exif-image-direction",
            "level1@forensics:certutil-lolbin-pattern",
            "level2@forensics:exfil-downloader-in-history",
            "level0@osint:adobe-hint-as-intel",
            "level1@osint:strava-segment-pattern",
            "level0@cloud:sts-identity-confirmation",
            "level1@cloud:ttl-without-enforcement",
          ])
        );
      });
      await page.reload();
      // Wait for boot again so the lobby render uses the seeded state.
      await page.waitForFunction(() => {
        const t = document.getElementById("terminal");
        return t && t.innerText.includes("AVAILABLE ENGAGEMENTS");
      }, null, { timeout: 8000 });

      await dispatchCmd(page, "progress --detail");
      const t = await terminalText(page);

      // Linux track's three v1.9.0/v1.10.0 finds.
      expect(t).toContain("Daniel's muscle-memory pattern");
      expect(t).toContain("Daniel's backup script");
      expect(t).toContain("Self-logged config-fallback bug");

      // v1.10.0 — 12 non-linux bonus names.
      const v110Bonuses = [
        "The five-sprint rotation",
        "Vendor default account with /bin/bash",
        "The Vendolux coffee machine",
        "'Most-downloaded npm package, should be safe'",
        "robots.txt as an attacker's site map",
        "The ten-year service-account session",
        "Camera direction in EXIF",
        "certutil as a LOLBin",
        "Adobe's cleartext password hints",
        "Aaron's Strava neighborhood",
        "Probing from outside the client's account",
        "TTL columns without enforcement",
      ];
      for (const name of v110Bonuses) {
        expect(t, `bonus '${name}' should appear in --detail`).toContain(name);
      }
    });
  });

  test.describe("cold-start gate hint", () => {
    test("ssh to level1 with un-visited level0 prints yellow prerequisite tip after Permission denied", async ({ page }) => {
      // Fresh context = `visited` is empty. ssh to level1@linux, type
      // a wrong password, expect Permission denied + the yellow
      // follow-up tip pointing at level0@linux.
      await dispatchCmd(page, "ssh level1@linux");
      await dispatchCmd(page, "not-the-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
      expect(t).toContain(
        "Tip: this level gates on a credential discovered in level0@linux"
      );
    });

    test("hint is suppressed when prerequisite IS visited", async ({ page }) => {
      // Seed visited to include the prereq, then attempt level1@linux
      // with a wrong password. Should see Permission denied with NO
      // follow-up "Tip: this level gates..." line.
      await page.evaluate(() => {
        sessionStorage.setItem("visited", JSON.stringify(["level0@linux"]));
      });
      await page.reload();
      await page.waitForFunction(() => {
        const t = document.getElementById("terminal");
        return t && t.innerText.includes("AVAILABLE ENGAGEMENTS");
      }, null, { timeout: 8000 });

      await dispatchCmd(page, "ssh level1@linux");
      await dispatchCmd(page, "still-wrong");
      const t = await terminalText(page);
      // Slice to the most recent Permission-denied so we only inspect
      // the lines immediately following it.
      const lastDenied = t.lastIndexOf("Permission denied, please try again.");
      expect(lastDenied).toBeGreaterThan(-1);
      const after = t.slice(lastDenied, lastDenied + 400);
      expect(after).not.toContain("Tip: this level gates on a credential");
    });
  });

  test.describe("future-level tip", () => {
    test("ssh level<N>@<known-host> past shipped ceiling: red DNS error + yellow check-back tip", async ({ page }) => {
      // level5@linux is past the linux track's current ceiling
      // (level2, as of v1.25.0). The branch should fire: red DNS-style
      // error PLUS a yellow follow-up explicitly naming the linux track
      // and the currently-shipped max.
      await dispatchCmd(page, "ssh level5@linux");
      const t = await terminalText(page);
      expect(t).toContain("Could not resolve hostname 'level5@linux'");
      expect(t).toContain("this level isn't built yet");
      expect(t).toContain("The linux track currently ships level0 through level2");
    });

    test("typo `leve4@linux` (missing l) still prints DNS error but NOT the future-level tip", async ({ page }) => {
      // The regex on the user prefix is strict (`^level(\d+)$`), so
      // a real typo (missing the second `l`) shouldn't match the
      // future-level branch — the player should see the plain DNS
      // error with no yellow follow-up.
      await dispatchCmd(page, "ssh leve4@linux");
      const t = await terminalText(page);
      expect(t).toContain("Could not resolve hostname 'leve4@linux'");
      const lastTypo = t.lastIndexOf("Could not resolve hostname 'leve4@linux'");
      const afterTypo = t.slice(lastTypo, lastTypo + 400);
      expect(afterTypo).not.toContain("this level isn't built yet");
    });
  });
});
