// tests/specs/crypto.spec.cjs
//
// Crypto track playtest — level0 ("Theo's Safer API Key") and level1
// ("Theo's Signature That Wasn't"). Exercises base64 decoding, the
// wrong-password gate on level1, JWT alg:none recognition via the
// engine's `jwt` decoder, the level1 bonus-find trigger
// (most-downloaded fallacy), and the credential chain that hands
// the alg:none JWT's `handoff_token` claim forward to level2.
//
// Ported from the v1.23.x monolithic playtest.cjs lines 728-826.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so the boot + ssh-in sequence runs fresh per test.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("crypto track", () => {
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

  // ── Level 0 — Theo's Safer API Key ────────────────────────────────
  // No password (level0 of each track is the entry point).
  test.describe("level0@crypto — Theo's Safer API Key", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@crypto");
      await waitForOutput(page, "Connected: level0@crypto");
      // v1.11.0 — first non-lobby connect of the session fires the
      // persistence opt-in prompt. The monolith dismissed it during
      // the linux-track block; per-spec contexts start fresh, so each
      // first ssh in this file hits the prompt. Dismiss with 'n'.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("connection banner + prompt identity", async ({ page }) => {
      const t = await terminalText(page);
      expect(t).toContain("Connected: level0@crypto");
      expect(t).toContain("Vesta Retail");
      expect(t).toContain("Theo");

      const prompt = await promptText(page);
      expect(prompt).toContain("@crypto:");
      expect(prompt.startsWith("secops@")).toBeTruthy();
    });

    test("ls shows the level0 fileset", async ({ page }) => {
      await dispatchCmd(page, "ls");
      const t = await terminalText(page);
      for (const f of [
        "welcome.md",
        "engagement-notes.md",
        "deploy.sh",
        "api-key.b64",
        "lessons-learned.md",
      ]) {
        expect(t, `ls shows ${f}`).toContain(f);
      }
    });

    test("base64 api-key.b64 decodes to the Vesta API key", async ({ page }) => {
      await dispatchCmd(page, "base64 api-key.b64");
      const t = await terminalText(page);
      expect(t).toContain("vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3");
    });

    test("base64 -d <string> decodes inline arguments", async ({ page }) => {
      await dispatchCmd(
        page,
        "base64 -d dmVzdGFfcGtfbGl2ZV9IeEs0blA5cVIydlQ4WXdCbUM1ZEUz",
      );
      const t = await terminalText(page);
      expect(t).toMatch(/vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3/);
    });

    test("engagement-notes.md preserves continuity characters", async ({ page }) => {
      await dispatchCmd(page, "cat engagement-notes.md");
      const t = await terminalText(page);
      expect(t).toContain("Priya");
      expect(t).toContain("Saanvi");
    });

    test("lessons-learned.md cites PCI-DSS 3.5 + CWE-261", async ({ page }) => {
      await dispatchCmd(page, "cat lessons-learned.md");
      const t = await terminalText(page);
      expect(t).toContain("PCI-DSS");
      expect(t).toContain("3.5");
      expect(t).toContain("CWE-261");
    });

    test("exit from level0@crypto returns to the lobby", async ({ page }) => {
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

  // ── Level 1 — Theo's Signature That Wasn't ───────────────────────
  test.describe("level1@crypto — Theo's Signature That Wasn't", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level1@crypto");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level1", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level1@crypto");
        await dispatchCmd(page, "vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3");
        await waitForOutput(page, "Connected: level1@crypto");
        // v1.11.0 persistence opt-in prompt fires on first non-lobby
        // connect of a fresh session. Dismiss it (see level0 beforeEach
        // for full rationale).
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level1@crypto");
        // Objective references JWT auth on the Vesta admin API.
        expect(t.includes("JWT") || t.includes("token")).toBeTruthy();

        const prompt = await promptText(page);
        expect(prompt).toContain("@crypto:");
        expect(prompt.startsWith("vesta-deploy@")).toBeTruthy();
      });

      test("ls shows the level1 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "priya-note.md",
          "verify-middleware.js",
          "admin-access.log",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("admin-access.log carries the alg:none JWT header", async ({ page }) => {
        await dispatchCmd(page, "cat admin-access.log");
        const t = await terminalText(page);
        expect(t).toContain("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0");
      });

      test("jwt decoder flags alg:none + reveals the level2 breadcrumb", async ({ page }) => {
        // The full JWT is long; the test injects it directly rather than
        // copy-pasting from the rendered terminal output.
        const algNoneJwt =
          "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJ2ZXN0YS1hZG1pbi1zdmMiLCJzdWIiOiJhZG1pbi1zdmMtZGVwbG95IiwiYXVkIjoidmVzdGEtYWRtaW4tYXBpIiwiaWF0IjoxNzc1NzIyNDQwLCJleHAiOjIwOTEzNDE2NDAsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiKiIsImFjdG9yIjoidGhlb0B2ZXN0YS5leGFtcGxlIiwiaGFuZG9mZl90b2tlbiI6InZlc3RhLWFkbWluLWhhbmRvZmYtMjAyNiJ9.";
        await dispatchCmd(page, "jwt " + algNoneJwt);
        const t = await terminalText(page);
        expect(t.includes("alg: 'none'") || t.includes('alg: "none"')).toBeTruthy();
        expect(t).toContain("Signature is empty");
        expect(t).toContain("vesta-admin-handoff-2026");
        expect(t).toContain('"role": "admin"');
      });

      test("priya-note.md quotes the most-downloaded fallacy (bonus-find trigger)", async ({ page }) => {
        // v1.10.0 BONUS-FIND TRIGGER — Priya quotes Theo's library-
        // popularity reasoning verbatim, which fires the
        // "most-downloaded-fallacy" bonus.
        await dispatchCmd(page, "cat priya-note.md");
        const t = await terminalText(page);
        expect(t).toContain("most-downloaded");
      });

      test("verify-middleware.js shows jwt.verify without algorithms whitelist", async ({ page }) => {
        await dispatchCmd(page, "cat verify-middleware.js");
        const t = await terminalText(page);
        expect(t).toMatch(/jwt\.verify\(token,\s*SIGNING_SECRET\)/);
      });

      test("whoami prints 'vesta-deploy' on Vesta's deploy host", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bvesta-deploy\b/);
      });

      test("exit from level1@crypto returns to the lobby", async ({ page }) => {
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
  });

  // ── Level 2 — Theo's quick hash (v1.27.0) ───────────────────────
  // The handoff cred from level1's JWT decode unlocks the Vesta admin
  // host. Theo's committed backup-passwords.txt holds 200 unsalted
  // MD5 hashes; john cracks four of them with rockyou.txt and they
  // all share one plaintext (TheoVesta!1). The aes-backup label is
  // the level3 breadcrumb; same-password-everywhere fires the
  // theo-password-reuse bonus, and README.rockyou fires the
  // 2009-provenance bonus.
  test.describe("level2@crypto — Theo's Quick Hash", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level2@crypto");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level2", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level2@crypto");
        await dispatchCmd(page, "vesta-admin-handoff-2026");
        await waitForOutput(page, "Connected: level2@crypto");
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level2@crypto");
        // env_vars.HOSTNAME sets prompt host to "admin" (truncated at
        // first dot from "admin.vesta.internal").
        const prompt = await promptText(page);
        expect(prompt).toContain("@admin:");
        expect(prompt.startsWith("vesta-admin@")).toBeTruthy();
      });

      test("ls shows the level2 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "priya-note.md",
          "backup-passwords.txt",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("hash-id on backup-passwords.txt detects MD5 across the 200 hashes", async ({ page }) => {
        // v1.27.0 multi-hash extension: hash-id picks the first hash
        // token off the first non-comment line and analyses it.
        await dispatchCmd(page, "hash-id backup-passwords.txt");
        const t = await terminalText(page);
        expect(t).toContain("MD5");
        expect(t).toContain("file contains 38 hashes");
        expect(t).toContain("Crack with: john");
      });

      test("john backup-passwords.txt cracks four hashes — all the same plaintext", async ({ page }) => {
        await dispatchCmd(page, "john backup-passwords.txt");
        const t = await terminalText(page);
        // Loaded count matches Theo's claimed file size (200).
        expect(t).toContain("Loaded 200 password hashes");
        // The four cracked labels.
        expect(t).toContain("theo@admin");
        expect(t).toContain("theo@db-prod");
        expect(t).toContain("aes-backup");
        expect(t).toContain("s3-readonly");
        // All four are the same plaintext — TheoVesta!1.
        const matches = t.match(/TheoVesta!1/g) || [];
        expect(matches.length, "TheoVesta!1 appears once per cracked label").toBeGreaterThanOrEqual(4);
        // "4g" appears in the session summary — fires the
        // theo-password-reuse bonus.
        expect(t).toContain("4g");
        expect(t).toContain("Bonus find unlocked");
        // Bonus name surfaces in the banner.
        expect(t).toContain("four of Theo's hashes");
      });

      test("README.rockyou surfaces the 2009 RockYou.com provenance (bonus)", async ({ page }) => {
        await dispatchCmd(page, "cat /usr/share/wordlists/README.rockyou");
        const t = await terminalText(page);
        expect(t).toContain("RockYou.com");
        expect(t).toContain("December 2009");
        // The rockyou-2009-provenance bonus banner.
        expect(t).toContain("Bonus find unlocked");
      });

      test("whoami prints 'vesta-admin' on the Vesta admin host", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bvesta-admin\b/);
      });

      test("exit from level2@crypto returns to the lobby", async ({ page }) => {
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
