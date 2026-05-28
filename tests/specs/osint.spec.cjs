// tests/specs/osint.spec.cjs
//
// OSINT track playtest — covers level0@osint (Veridian's Open Letter,
// HIBP breach-corpus enumeration of Dr. Aaron Hines's personal email)
// and level1@osint (Aaron's Weekend Project, GitHub developer-footprint
// + leaked .env AWS credential).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 1214-1372.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture; the password gate (level1@osint) is exercised inside
// the level1 tests since assertions depend on being inside the level.
//
// Credential chain: level0 (no password) → leak: BostonStrong#2013
// → level1 (gated on BostonStrong#2013) → leak: AaronHinesMD/...
// (consumed by level2@cloud).
//
// Note: `intel` is the in-world `playerUser` for the OSINT workstation
// (`prompt: intel@osint:`), not the engine slot name.
//
// v1.11.0 persistence opt-in: the first non-lobby connect of a fresh
// session fires a yes/no prompt. Each test() gets a fresh browser
// context, so every entry into a level hits the prompt — we dismiss
// with 'n' in the beforeEach blocks below.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("osint track", () => {
  test.beforeEach(async ({ page }) => {
    // Capture page-level errors so we can fail tests on engine crashes
    // even if no assertion specifically catches the bad output.
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

  // ── Level 0 — Veridian's Open Letter ──────────────────────────────
  // No password (level0 of each track is the entry point).
  test.describe("level0@osint — Veridian's Open Letter", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@osint");
      await waitForOutput(page, "Connected: level0@osint");
      // v1.11.0 persistence opt-in prompt fires on first non-lobby
      // connect of a fresh session. Dismiss with 'n'.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("connection banner + prompt identity + intro lore", async ({ page }) => {
      const t = await terminalText(page);
      expect(t, "Connected to level0@osint").toContain("Connected: level0@osint");
      expect(await promptText(page), "Prompt host updated to 'osint'").toContain("@osint:");
      expect(await promptText(page), "Prompt user shows in-world identity 'intel'").toMatch(/^intel@/);
      expect(t, "Objective references Veridian (client)").toContain("Veridian");
      expect(t, "Objective references Dr. Aaron Hines (subject)").toContain("Aaron Hines");
      expect(t, "Lesson mentions Marisol (new recurring character)").toContain("Marisol");
      expect(t, "Lesson mentions HIPAA (compliance regime)").toContain("HIPAA");
    });

    test("ls shows the level0 fileset", async ({ page }) => {
      await dispatchCmd(page, "ls");
      const t = await terminalText(page);
      for (const f of ["welcome.md", "engagement-notes.md", "subject-brief.txt", "lessons-learned.md"]) {
        expect(t, `ls shows ${f}`).toContain(f);
      }
    });

    test("engagement-notes.md cites HIPAA / HITRUST / Priya continuity", async ({ page }) => {
      await dispatchCmd(page, "cat engagement-notes.md");
      const t = await terminalText(page);
      expect(t, "engagement-notes.md mentions Priya (continuity)").toContain("Priya");
      expect(t, "engagement-notes.md cites HIPAA Security Rule").toContain("HIPAA Security Rule");
      expect(t, "engagement-notes.md cites HITRUST CSF (overlay framework)").toContain("HITRUST");
    });

    test("subject-brief.txt scopes personal email IN, work email OUT", async ({ page }) => {
      await dispatchCmd(page, "cat subject-brief.txt");
      const t = await terminalText(page);
      expect(t, "subject-brief.txt provides personal email for HIBP lookup").toContain("aaron.hines.md@gmail.com");
      expect(t, "subject-brief.txt scopes Veridian work email OUT").toContain("OUT OF SCOPE");
    });

    test("hibp returns 3 breaches + cleartext password reuse on personal email", async ({ page }) => {
      await dispatchCmd(page, "hibp aaron.hines.md@gmail.com");
      const t = await terminalText(page);
      expect(t, "hibp returns LinkedIn 2012 breach hit").toContain("LinkedIn (2012)");
      expect(t, "hibp returns Adobe 2013 breach hit").toContain("Adobe (2013)");
      expect(t, "hibp returns LiveJournal 2014 breach hit").toContain("LiveJournal");
      expect(t, "hibp surfaces cleartext password (LinkedIn cracked corpus)").toContain("BostonStrong#2013");
      expect(t, "hibp flags CONFIRMED REUSE across two breaches").toContain("CONFIRMED REUSE");
    });

    test("hibp respects OOS work email (graceful 'no breaches found')", async ({ page }) => {
      // Verify the out-of-scope guard: Aaron's WORK email should produce
      // the graceful "no breaches found" message, not a configured hit.
      // (Per Marisol's scope: only the personal email was authorized.)
      await dispatchCmd(page, "hibp ahines@veridian-analytics.com");
      const t = await terminalText(page);
      expect(t, "hibp returns 'no breaches found' for un-configured work email")
        .toMatch(/no breaches found for 'ahines@veridian-analytics\.com'/);
    });

    test("lessons-learned.md cites NIST 800-63B / CWE-521 / T1110.004", async ({ page }) => {
      await dispatchCmd(page, "cat lessons-learned.md");
      const t = await terminalText(page);
      expect(t, "lessons-learned.md cites NIST SP 800-63B (breach-list screening)").toContain("800-63B");
      expect(t, "lessons-learned.md cites CWE-521 (Weak Password Requirements)").toContain("CWE-521");
      expect(t, "lessons-learned.md cites T1110.004 (Credential Stuffing)").toContain("T1110.004");
    });

    test("exit from level0@osint returns to lobby", async ({ page }) => {
      await dispatchCmd(page, "exit");
      // `exit` re-prints "AVAILABLE ENGAGEMENTS" but that string is
      // already in scrollback from boot, so we anchor on the live
      // prompt label updating to the lobby identity.
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
        null,
        { timeout: 5000 },
      );
      expect(await promptText(page), "exit from level0@osint returns to lobby").toContain("@d3cyph3r:");
    });
  });

  // ── Level 1 — Aaron's Weekend Project ─────────────────────────────
  test.describe("level1@osint — Aaron's Weekend Project", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      // Wrong password first to confirm the gate works.
      await dispatchCmd(page, "ssh level1@osint");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t, "Wrong password on level1@osint prints 'Permission denied'")
        .toContain("Permission denied, please try again.");
    });

    test.describe("inside level1", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level1@osint");
        await dispatchCmd(page, "BostonStrong#2013");
        await waitForOutput(page, "Connected: level1@osint");
        // v1.11.0 persistence opt-in dismissal (see level0 beforeEach
        // for full rationale).
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity + intro lore", async ({ page }) => {
        const t = await terminalText(page);
        expect(t, "Correct password connects to level1@osint").toContain("Connected: level1@osint");
        expect(await promptText(page), "Prompt host stays 'osint' on level1").toContain("@osint:");
        expect(await promptText(page), "Prompt user stays 'intel' on level1@osint").toMatch(/^intel@/);
        expect(t, "Objective references the developer footprint task")
          .toMatch(/developer footprint|github/i);
      });

      test("ls shows the level1 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of ["welcome.md", "engagement-notes.md", "subject-update.txt", "lessons-learned.md"]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("sherlock surfaces Aaron's GitHub + Strava profiles", async ({ page }) => {
        await dispatchCmd(page, "sherlock aaron-hines-md");
        const t = await terminalText(page);
        expect(t, "sherlock shows Aaron's GitHub profile URL").toContain("github.com/aaron-hines-md");
        expect(t, "sherlock shows Aaron's Strava profile URL").toContain("strava.com/athletes/aaron-hines-md");
      });

      test("github -h prints usage with all three forms", async ({ page }) => {
        await dispatchCmd(page, "github -h");
        const t = await terminalText(page);
        expect(t, "github -h prints usage with all three forms").toContain("github <user>");
        expect(t, "github -h prints usage with all three forms").toContain("file <path>");
      });

      test("github profile lookup lists Aaron's name + repos", async ({ page }) => {
        await dispatchCmd(page, "github aaron-hines-md");
        const t = await terminalText(page);
        expect(t, "github profile shows Aaron's name").toContain("Aaron Hines, MD");
        expect(t, "github profile shows Boston location").toContain("Boston, MA");
        expect(t, "github profile lists personal-pgx-tool repo").toContain("personal-pgx-tool");
        expect(t, "github profile lists marathon-pacer-log decoy").toContain("marathon-pacer-log");
        expect(t, "github profile lists pgx-residency-notes decoy").toContain("pgx-residency-notes");
        expect(t, "github profile lists dotfiles decoy").toContain("dotfiles");
      });

      test("github repo metadata + file tree exposes committed .env", async ({ page }) => {
        await dispatchCmd(page, "github aaron-hines-md/personal-pgx-tool");
        const t = await terminalText(page);
        expect(t, "github repo metadata shows MIT license").toContain("License: MIT");
        expect(t, "github repo file tree includes .env (committed before .gitignore)").toContain(".env");
        expect(t, "github repo file tree includes app.py").toContain("app.py");
        expect(t, "github repo file tree includes src/pgx_lookup.py").toContain("src/pgx_lookup.py");
      });

      test(".env contents leak OpenFDA key + AWS credential breadcrumb", async ({ page }) => {
        // The smoking gun — .env contents include the AWS secret.
        await dispatchCmd(page, "github aaron-hines-md/personal-pgx-tool file .env");
        const t = await terminalText(page);
        expect(t, ".env shows the OpenFDA personal API key").toContain("OPENFDA_API_KEY=oFDA-aaron-personal-2023");
        expect(t, ".env shows the AWS_ACCESS_KEY_ID").toContain("AWS_ACCESS_KEY_ID=AKIAVDS3IAARONHINES23");
        expect(t, ".env reveals the level2 breadcrumb (AWS secret)").toContain("AaronHinesMD/Pers0nal+AWS/2024+BrightBlu");
        expect(t, ".env shows the S3 cache bucket name").toContain("ahines-pgx-cache");
      });

      test(".gitignore lists .env (added after first commit — the irony)", async ({ page }) => {
        // .gitignore listing .env is the ironic detail (drives the lesson).
        await dispatchCmd(page, "github aaron-hines-md/personal-pgx-tool file .gitignore");
        const t = await terminalText(page);
        expect(t, ".gitignore lists .env (added AFTER the first commit)").toMatch(/^\.env$/m);
      });

      test("decoy repos are enumerable but innocuous", async ({ page }) => {
        // Read a decoy repo to confirm those are also enumerable but innocuous.
        await dispatchCmd(page, "github aaron-hines-md/marathon-pacer-log file README.md");
        const t = await terminalText(page);
        expect(t, "marathon-pacer-log README mentions Boston Marathon").toContain("Boston Marathon");
      });

      test("github graceful errors on unknown user / repo / file", async ({ page }) => {
        await dispatchCmd(page, "github nonexistent-user");
        let t = await terminalText(page);
        expect(t, "github on unknown user returns graceful 'no profile' error")
          .toContain("no GitHub profile for 'nonexistent-user'");

        await dispatchCmd(page, "github aaron-hines-md/nonexistent-repo");
        t = await terminalText(page);
        expect(t, "github on unknown repo returns graceful 'not found' error")
          .toContain("repository 'aaron-hines-md/nonexistent-repo' not found");

        await dispatchCmd(page, "github aaron-hines-md/personal-pgx-tool file nonexistent.py");
        t = await terminalText(page);
        expect(t, "github file on unknown path returns graceful 'not found' error")
          .toContain("file 'nonexistent.py' not found");
      });

      test("lessons-learned.md cites CWEs, NIST 800-218, MITRE TTPs, defender tools", async ({ page }) => {
        await dispatchCmd(page, "cat lessons-learned.md");
        const t = await terminalText(page);
        expect(t, "lessons-learned.md cites CWE-798 (Hard-Coded Credentials)").toContain("CWE-798");
        expect(t, "lessons-learned.md cites CWE-540 (Sensitive Info in Source)").toContain("CWE-540");
        expect(t, "lessons-learned.md cites NIST SP 800-218 SSDF").toContain("800-218");
        expect(t, "lessons-learned.md cites MITRE T1593.003 (Code Repositories)").toContain("T1593.003");
        expect(t, "lessons-learned.md cites MITRE T1552.001 (Credentials In Files)").toContain("T1552.001");
        expect(t, "lessons-learned.md cites TruffleHog (defender tooling)").toContain("TruffleHog");
        expect(t, "lessons-learned.md cites GitHub Secret Scanning").toContain("Secret Scanning");
      });

      test("whoami prints 'intel' (in-world OSINT workstation identity)", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t, "whoami prints 'intel' on the OSINT workstation").toMatch(/\bintel\b/);
      });

      test("exit from level1@osint returns to lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        // See level0 exit test for the rationale on prompt-label wait.
        await page.waitForFunction(
          () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
          null,
          { timeout: 5000 },
        );
        expect(await promptText(page), "exit from level1@osint returns to lobby").toContain("@d3cyph3r:");
      });
    });
  });
});
