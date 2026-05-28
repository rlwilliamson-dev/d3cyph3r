// tests/specs/forensics.spec.cjs
//
// Forensics-track playtest coverage:
//   - level0@forensics — "Reed's Soccer Alibi" (file / exif metadata
//                        reveals the alibi photo was taken in Key Largo
//                        seven months before the claimed soccer game).
//   - level1@forensics — "What the Logs Saw" (evtx Security event-log
//                        triage; 4625 SubStatus 0xC0000064 leaks the
//                        level2 password into TargetUserName; 4688
//                        surfaces Reed's PowerShell/certutil/mega.nz
//                        exfil chain).
//   - level2@forensics — "What Reed's Browser Saw" (v1.23.0 sqlite3
//                        browser-DB forensics; History + Cookies
//                        queries reconstruct Reed's Saturday-morning
//                        Gmail handoff to a personal account).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 960-1213.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context, so the v1.11.0
// persistence opt-in prompt fires on the first non-lobby connect of
// each test — every ssh-in here dismisses it with `n` immediately so
// the subsequent commands aren't swallowed by the consent handler.
//
// level1@forensics and level2@forensics depend on the per-track
// credential chain (POL-IIS-2026-0007-handoff and P0l4r1s-IR-L3ad-2026!
// respectively), supplied directly in each test() block rather than
// chained through a full upstream playthrough.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("forensics track", () => {
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

  // ── Level 0 — Reed's Soccer Alibi ─────────────────────────────────
  // No password (level0 of each track is the entry point).
  test.describe("level0@forensics — Reed's Soccer Alibi", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@forensics");
      await waitForOutput(page, "Connected: level0@forensics");
      // v1.11.0 — first non-lobby connect of the session fires the
      // persistence opt-in prompt. Per-spec contexts start fresh, so
      // each first ssh in this file hits the prompt. Dismiss with 'n'.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("connection banner + prompt identity", async ({ page }) => {
      const t = await terminalText(page);
      expect(t).toContain("Connected: level0@forensics");
      expect(t).toContain("Polaris");
      expect(t).toContain("Dana");

      const prompt = await promptText(page);
      expect(prompt).toContain("@forensics:");
      expect(prompt.startsWith("secops@")).toBeTruthy();
    });

    test("ls shows the level0 fileset", async ({ page }) => {
      await dispatchCmd(page, "ls");
      const t = await terminalText(page);
      for (const f of [
        "welcome.md",
        "engagement-notes.md",
        "case-summary.txt",
        "soccer-field.jpg",
        "lessons-learned.md",
      ]) {
        expect(t, `ls shows ${f}`).toContain(f);
      }
    });

    test("file soccer-field.jpg identifies as JPEG with EXIF", async ({ page }) => {
      await dispatchCmd(page, "file soccer-field.jpg");
      const t = await terminalText(page);
      expect(t).toMatch(/soccer-field\.jpg.*JPEG image data.*EXIF/);
    });

    test("exif reveals the alibi-busting metadata", async ({ page }) => {
      await dispatchCmd(page, "exif soccer-field.jpg");
      const t = await terminalText(page);
      // DateTimeOriginal of 2025:07:18 (NOT March 2026 as Reed claimed).
      expect(t).toContain("2025:07:18");
      // GPS coordinates in Key Largo, Florida.
      expect(t).toContain("25.0865");
      expect(t).toContain("80.4473");
      // Device identifier.
      expect(t).toContain("iPhone 14 Pro");
    });

    test("engagement-notes.md preserves continuity + cites compliance frameworks", async ({ page }) => {
      await dispatchCmd(page, "cat engagement-notes.md");
      const t = await terminalText(page);
      expect(t).toContain("Priya");
      expect(t).toContain("CMMC Level 2");
      expect(t.includes("NIST SP 800-171") || t.includes("NIST 800-171")).toBeTruthy();
    });

    test("case-summary.txt leaks level1 breadcrumb password", async ({ page }) => {
      await dispatchCmd(page, "cat case-summary.txt");
      const t = await terminalText(page);
      expect(t).toContain("POL-IIS-2026-0007-handoff");
    });

    test("lessons-learned.md cites NIST SP 800-86 + CWE-200", async ({ page }) => {
      await dispatchCmd(page, "cat lessons-learned.md");
      const t = await terminalText(page);
      expect(t).toContain("800-86");
      expect(t).toContain("CWE-200");
    });

    test("exit from level0@forensics returns to the lobby", async ({ page }) => {
      await dispatchCmd(page, "exit");
      // Wait for the prompt label to update to the lobby — `exit`
      // re-prints "AVAILABLE ENGAGEMENTS" but that string is already
      // in scrollback from boot, so we anchor on the live prompt.
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
        null,
        { timeout: 5000 },
      );
      const prompt = await promptText(page);
      expect(prompt).toContain("@d3cyph3r:");
    });
  });

  // ── Level 1 — What the Logs Saw (evtx) ────────────────────────────
  test.describe("level1@forensics — What the Logs Saw", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level1@forensics");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level1", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level1@forensics");
        await dispatchCmd(page, "POL-IIS-2026-0007-handoff");
        await waitForOutput(page, "Connected: level1@forensics");
        // v1.11.0 persistence opt-in prompt fires on first non-lobby
        // connect of a fresh session. Dismiss it.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level1@forensics");
        // Objective references event-log triage.
        expect(/event log/i.test(t) || /Security event/i.test(t)).toBeTruthy();

        const prompt = await promptText(page);
        expect(prompt).toContain("@forensics:");
        expect(prompt.startsWith("secops@")).toBeTruthy();
      });

      test("ls shows the level1 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "engagement-notes.md",
          "case-summary.txt",
          "Security.evtx",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("file Security.evtx identifies as Microsoft Windows Event Log", async ({ page }) => {
        await dispatchCmd(page, "file Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("Microsoft Windows Event Log");
      });

      test("evtx -h prints usage with the five common Security-channel IDs", async ({ page }) => {
        await dispatchCmd(page, "evtx -h");
        const t = await terminalText(page);
        expect(t).toContain("4624");
        expect(t).toContain("4625");
        expect(t).toContain("4688");
      });

      test("evtx full dump parses all 16 events cleanly", async ({ page }) => {
        await dispatchCmd(page, "evtx Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("Total events: 16");
        // Reed's interactive logon (4624).
        expect(t).toContain("rconnolly");
        // IR jumpbox source IP.
        expect(t).toContain("10.42.7.18");
      });

      test("evtx -id 4625 reveals the password-leak smoking gun", async ({ page }) => {
        // Filter to 4625 — one event, with the typed password leaked
        // into TargetUserName (SubStatus 0xC0000064 = no such user).
        await dispatchCmd(page, "evtx -id 4625 Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("filtered to ID 4625: 1 match");
        expect(t).toContain("0xC0000064");
        expect(t).toContain("P0l4r1s-IR-L3ad-2026!");
      });

      test("evtx -id 4688 surfaces Reed's exfil chain", async ({ page }) => {
        // PowerShell Compress-Archive + certutil -encode (LOLBin) +
        // chrome upload to mega.nz.
        await dispatchCmd(page, "evtx -id 4688 Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("Compress-Archive");
        expect(t).toContain("certutil.exe -encode");
        expect(t).toContain("mega.nz/upload");
      });

      test("evtx -id 4663 shows Reed reading CUI artifacts", async ({ page }) => {
        // Reed's CUI reads from D:\CUI\Subsystem-A\.
        await dispatchCmd(page, "evtx -id 4663 Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("subsystem-a-schematics.pdf");
        expect(t).toContain("subsystem-a-bom.xlsx");
      });

      test("evtx -id 9999 returns graceful empty-state", async ({ page }) => {
        // Filter for a non-existent Event ID.
        await dispatchCmd(page, "evtx -id 9999 Security.evtx");
        const t = await terminalText(page);
        expect(t).toContain("no events with Event ID 9999");
      });

      test("case-summary.txt cites FTK Imager + E01 split", async ({ page }) => {
        await dispatchCmd(page, "cat case-summary.txt");
        const t = await terminalText(page);
        expect(t).toContain("FTK Imager");
        expect(t).toContain("E01 split");
      });

      test("lessons-learned.md cites the canonical references", async ({ page }) => {
        await dispatchCmd(page, "cat lessons-learned.md");
        const t = await terminalText(page);
        expect(t).toContain("CWE-532");
        expect(t.includes("AU-2") || t.includes("AU-6")).toBeTruthy();
        expect(t).toContain("T1078");
        expect(t).toContain("T1567.002");
        expect(t).toContain("LOLBAS");
      });

      test("whoami prints 'secops' on the forensics workstation", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bsecops\b/);
      });

      test("exit from level1@forensics returns to the lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        await page.waitForFunction(
          () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
          null,
          { timeout: 5000 },
        );
        const prompt = await promptText(page);
        expect(prompt).toContain("@d3cyph3r:");
      });
    });
  });

  // ── Level 2 — What Reed's Browser Saw (sqlite3, v1.23.0) ──────────
  test.describe("level2@forensics — What Reed's Browser Saw", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level2@forensics");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level2", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level2@forensics");
        await dispatchCmd(page, "P0l4r1s-IR-L3ad-2026!");
        await waitForOutput(page, "Connected: level2@forensics");
        // v1.11.0 persistence opt-in prompt.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level2@forensics");
        const prompt = await promptText(page);
        expect(prompt.startsWith("ir-audit@")).toBeTruthy();
      });

      test("ls shows the level2 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "case-notes.md",
          "chain-of-custody.txt",
          "Reed",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("sha256sum matches chain-of-custody baseline", async ({ page }) => {
        await dispatchCmd(page, "sha256sum Reed/History.sqlite");
        const t = await terminalText(page);
        expect(t).toContain(
          "8c4f1d2e93b56a087c1f4a72d9e83c61a5f2b40e7c93a18d6f25b91e7d34a8c2",
        );
      });

      test("sqlite3 --help (auto-extracted via v1.17.0 path)", async ({ page }) => {
        await dispatchCmd(page, "sqlite3 --help");
        const t = await terminalText(page);
        expect(t).toContain("sqlite3");
        expect(t).toContain("FILE");
      });

      test(".tables enumerates the History DB schema", async ({ page }) => {
        await dispatchCmd(page, 'sqlite3 Reed/History.sqlite ".tables"');
        const t = await terminalText(page);
        for (const tab of ["urls", "visits", "downloads", "keyword_search_terms"]) {
          expect(t, `.tables lists ${tab}`).toContain(tab);
        }
      });

      test(".schema urls returns the CREATE TABLE statement", async ({ page }) => {
        await dispatchCmd(page, 'sqlite3 Reed/History.sqlite ".schema urls"');
        const t = await terminalText(page);
        expect(t).toContain("CREATE TABLE urls");
        expect(t).toContain("last_visit_time");
      });

      test("SELECT * with LIMIT returns pipe-separated rows", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT * FROM urls LIMIT 3"',
        );
        const t = await terminalText(page);
        expect((t.match(/intranet\.polaris-ds\.local/g) || []).length).toBeGreaterThanOrEqual(1);
      });

      test("-header flag includes column names in output", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 -header Reed/History.sqlite "SELECT url FROM urls LIMIT 1"',
        );
        const t = await terminalText(page);
        expect(t).toContain("url");
      });

      test("ORDER BY DESC LIMIT surfaces recent browsing", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT url FROM urls ORDER BY last_visit_time DESC LIMIT 5"',
        );
        const t = await terminalText(page);
        expect(
          t.includes("amazon.com") ||
            t.includes("hackernews") ||
            t.includes("weather.com"),
        ).toBeTruthy();
      });

      test("WHERE LIKE surfaces Reed's Gmail visits (smoking-gun query)", async ({ page }) => {
        // Selecting url + title surfaces the personal Gmail account
        // context as well as the URL itself.
        await dispatchCmd(
          page,
          `sqlite3 Reed/History.sqlite "SELECT url, title FROM urls WHERE url LIKE '%mail.google%'"`,
        );
        const t = await terminalText(page);
        expect(t).toContain("mail.google.com");
        expect(t).toContain("rconnolly.personal");
      });

      test("COUNT(*) returns a single integer row", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT COUNT(*) FROM urls"',
        );
        const t = await terminalText(page);
        expect(t).toMatch(/\b15\b/);
      });

      test("Cookies.sqlite SELECT extracts the level3 breadcrumb", async ({ page }) => {
        await dispatchCmd(
          page,
          `sqlite3 Reed/Cookies.sqlite "SELECT value FROM cookies WHERE host_key = 'mail.google.com'"`,
        );
        const t = await terminalText(page);
        expect(t).toContain("RC-Gmail-PreDawn-2026-03-14-T0247Z");
      });

      test("downloads-table query surfaces exfil downloader (bonus-find trigger)", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT target_path FROM downloads"',
        );
        const t = await terminalText(page);
        expect(t).toContain("rc-archive-helper.ps1");
      });

      test("bonus-find 'exfil-downloader-in-history' surfaces in progress --detail", async ({ page }) => {
        // Trigger the bonus find first.
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT target_path FROM downloads"',
        );
        await dispatchCmd(page, "progress --detail");
        const t = await terminalText(page);
        expect(
          t.includes("PowerShell exfil downloader") ||
            t.includes("exfil-downloader"),
        ).toBeTruthy();
      });

      test("lessons-learned cites the canonical references", async ({ page }) => {
        await dispatchCmd(page, "cat lessons-learned.md");
        const t = await terminalText(page);
        expect(t).toContain("NIST SP 800-86");
        expect(t).toContain("GCFE");
        expect(t).toContain("T1567");
        expect(t).toContain("AU.L2-3.3");
      });

      test("unsupported JOIN surfaces a syntax-error message", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT * FROM urls JOIN visits ON urls.id=visits.url"',
        );
        const t = await terminalText(page);
        expect(t).toContain("syntax error");
      });

      test("unknown table surfaces 'no such table'", async ({ page }) => {
        await dispatchCmd(
          page,
          'sqlite3 Reed/History.sqlite "SELECT * FROM nonexistent"',
        );
        const t = await terminalText(page);
        expect(t).toContain("no such table");
      });

      test("non-SQLite file surfaces 'not a recognized SQLite database'", async ({ page }) => {
        await dispatchCmd(page, 'sqlite3 welcome.md ".tables"');
        const t = await terminalText(page);
        expect(t).toContain("not a recognized SQLite database");
      });

      test("exit from level2@forensics returns to the lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        await page.waitForFunction(
          () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
          null,
          { timeout: 5000 },
        );
        const prompt = await promptText(page);
        expect(prompt).toContain("@d3cyph3r:");
      });
    });
  });
});
