// tests/specs/linux.spec.cjs
//
// Linux-track playtest coverage. Two describe blocks:
//   - level0@linux env_vars + bonusFind backfill — exercises the
//     v1.9.0 env_vars on Daniel's old laptop (EDITOR=vi, HISTSIZE=1000)
//     and the "Daniel's muscle-memory pattern" bonus-find that fires
//     on `cat .bash_history`.
//   - level1@linux — "Halton jumphost" permissions puzzle. SUID-less
//     scenario: app_admin's home has a mode-600 staging-worker.env
//     they can't read AND a mode-644 staging-worker.env.bak that
//     leaks the production DB password. Doubles as the regression
//     bed for the v1.6.0 SYSTEM INSPECTION suite (crontab/last/who/w/
//     lsof/ss/journalctl/systemctl/dmesg) and the v1.9.0 journalctl
//     "self-logged-bug" bonus-find.
//
// Ported from the v1.23.x monolithic playtest.cjs lines 465-588
// (level1@linux block) and 2033-2050 (level0@linux env_vars +
// bonusFind backfill). Uses the v1.24.0 dispatchCmd helper
// (value-set + Enter dispatch) instead of typeAndEnter
// (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so the boot + ssh-in sequence runs fresh per test;
// the v1.11.0 persistence opt-in prompt fires on every first
// non-lobby connect and is dismissed with `n` inside each beforeEach.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("linux track", () => {
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

  // ── Level 0 — env_vars + bonusFind backfill ─────────────────────
  // level0@linux is the entry point (password: null). The v1.9.0
  // backfill seeded Daniel's leftover env_vars (EDITOR=vi etc.) and
  // a bonus-find on `cat .bash_history` that fires on the muscle-
  // memory pattern in his shell history.
  test.describe("level0@linux — env_vars + bonusFind backfill", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@linux");
      await waitForOutput(page, "Connected: level0@linux");
      // v1.11.0 — first non-lobby connect of the session fires the
      // persistence opt-in prompt. Dismiss with 'n'.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("env exposes Daniel's leftover EDITOR + HISTSIZE", async ({ page }) => {
      await dispatchCmd(page, "env");
      const t = await terminalText(page);
      expect(t).toMatch(/EDITOR=vi/);
      expect(t).toMatch(/HISTSIZE=1000/);
    });

    test("cat .bash_history fires Daniel's muscle-memory bonus find", async ({ page }) => {
      await dispatchCmd(page, "cat .bash_history");
      const t = await terminalText(page);
      expect(t).toMatch(/Bonus find unlocked: Daniel's muscle-memory pattern/);
    });
  });

  // ── Level 1 — Halton jumphost (permissions puzzle) ──────────────
  // Wrong password first to confirm the gate works, then the full
  // permissions puzzle + SYSTEM INSPECTION suite + journalctl bonus.
  test.describe("level1@linux — Halton jumphost", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level1@linux");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level1", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level1@linux");
        await dispatchCmd(page, "please-rotate-me");
        await waitForOutput(page, "Connected: level1@linux");
        // v1.11.0 persistence opt-in prompt fires on first non-lobby
        // connect of a fresh session. Dismiss it.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity (app_admin@linux)", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level1@linux");
        expect(t, "objective references the production credential").toContain("production");

        const prompt = await promptText(page);
        expect(prompt).toContain("@linux:");
        expect(prompt.startsWith("app_admin@")).toBeTruthy();
      });

      test("ls shows the level1 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        expect(t, "ls shows backup.sh").toContain("backup.sh");
        expect(t, "ls shows staging-worker.env").toMatch(/\bstaging-worker\.env\b/);
        expect(t, "ls shows staging-worker.env.bak").toContain("staging-worker.env.bak");
      });

      test("ls -la shows restrictive + loose perms; staging-worker.env is root:root", async ({ page }) => {
        await dispatchCmd(page, "ls -la");
        const t = await terminalText(page);
        expect(t, "ls -la shows restrictive perms (-rw-------)").toContain("-rw-------");
        expect(t, "ls -la shows loose perms (-rw-r--r--)").toContain("-rw-r--r--");
        expect(t).toMatch(/root\s+root\s+\d+\s+staging-worker\.env\b/);
      });

      test("cat on root-mode-600 file returns Permission denied", async ({ page }) => {
        await dispatchCmd(page, "cat staging-worker.env");
        const t = await terminalText(page);
        expect(t).toContain("cat: staging-worker.env: Permission denied");
      });

      test("cat on mode-644 backup leaks DB_PROD_PASS", async ({ page }) => {
        await dispatchCmd(page, "cat staging-worker.env.bak");
        const t = await terminalText(page);
        expect(t).toContain("DB_PROD_PASS=Halton-2024-Q3!");
      });

      test("handoff.md mentions Priya + the November incident", async ({ page }) => {
        await dispatchCmd(page, "cat handoff.md");
        const t = await terminalText(page);
        expect(t, "handoff.md mentions Priya (recurring character)").toContain("Priya");
        expect(t, "handoff.md cites the November incident").toContain("November");
      });

      test(".bash_history shows the sudo cp smoking gun", async ({ page }) => {
        await dispatchCmd(page, "cat .bash_history");
        const t = await terminalText(page);
        expect(t).toContain(
          "sudo cp /etc/systemd/system/staging-worker.service.d/override.conf",
        );
      });

      test("whoami prints in-world identity 'app_admin'", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bapp_admin\b/);
      });

      // ── v1.6.0 SYSTEM INSPECTION ────────────────────────────────
      // Exercise each command against the demo data seeded on
      // level1@linux. Doubles as regression coverage for the format
      // strings and per-field schema lookups.
      test("crontab -l on app_admin prints 'no scheduled jobs' header", async ({ page }) => {
        await dispatchCmd(page, "crontab -l");
        const t = await terminalText(page);
        expect(t).toContain("no scheduled jobs");
      });

      test("crontab -l -u root reveals the staging-worker crons", async ({ page }) => {
        await dispatchCmd(page, "crontab -l -u root");
        const t = await terminalText(page);
        expect(t, "crontab -l -u root reveals the staging-worker healthcheck").toContain(
          "staging-worker-healthcheck.sh",
        );
        expect(t, "crontab -l -u root reveals the backup-staging cron").toContain(
          "backup-staging-env.sh",
        );
      });

      test("last shows current session, reboot pseudo-event, daniel continuity", async ({ page }) => {
        await dispatchCmd(page, "last");
        const t = await terminalText(page);
        expect(t, "current app_admin session shown as 'still logged in'").toContain(
          "still logged in",
        );
        expect(t).toMatch(/reboot.*6\.1\.0-d3cyph3r/);
        expect(t, "last shows Daniel's prior session (continuity)").toContain("daniel");
      });

      test("who lists the active app_admin session from 10.0.7.42", async ({ page }) => {
        await dispatchCmd(page, "who");
        const t = await terminalText(page);
        expect(t).toMatch(/app_admin.*pts\/0.*10\.0\.7\.42/);
      });

      test("w prints uptime header + column header", async ({ page }) => {
        await dispatchCmd(page, "w");
        const t = await terminalText(page);
        expect(t, "w prints uptime header with load average").toContain("load average");
        expect(t).toContain("USER");
        expect(t).toContain("LOGIN@");
      });

      test("lsof -i shows sshd + postgres LISTEN entries", async ({ page }) => {
        await dispatchCmd(page, "lsof -i");
        const t = await terminalText(page);
        expect(t).toMatch(/sshd.*LISTEN/);
        expect(t).toMatch(/postgres.*5432.*LISTEN/);
      });

      test("ss -lt shows LISTEN sockets + sshd", async ({ page }) => {
        await dispatchCmd(page, "ss -lt");
        const t = await terminalText(page);
        expect(t).toContain("LISTEN");
        expect(t).toContain("sshd");
      });

      test("journalctl -u staging-worker leaks fallback + permission-denied + fires bonus find", async ({ page }) => {
        await dispatchCmd(page, "journalctl -u staging-worker");
        const t = await terminalText(page);
        expect(t, "journalctl shows the fallback log line").toContain(
          "falling back to /home/app_admin/staging-worker.env.bak",
        );
        expect(t, "journalctl shows the permission-denied error").toContain(
          "permission denied reading /home/app_admin/staging-worker.env",
        );
        // v1.9.0: this call also triggers the level1@linux bonus-find
        // "self-logged-bug" (trigger: journalctl + output contains
        // "falling back to"). First-call-only — subsequent journalctl
        // invocations in the same session won't re-print the banner
        // because the find is already marked as discovered.
        expect(t, "v1.9.0 bonus-find fires on journalctl").toContain(
          "Bonus find unlocked: Self-logged config-fallback bug",
        );
      });

      test("systemctl status renders the active unit", async ({ page }) => {
        await dispatchCmd(page, "systemctl status staging-worker.service");
        const t = await terminalText(page);
        expect(t, "active glyph rendered").toMatch(/● staging-worker\.service/);
        expect(t, "unit description").toContain("Halton staging-worker service");
        expect(t, "journal-log block").toContain("falling back to");
      });

      test("systemctl status on unknown unit reports 'could not be found'", async ({ page }) => {
        await dispatchCmd(page, "systemctl status nonexistent-unit");
        const t = await terminalText(page);
        expect(t).toContain("could not be found");
      });

      test("dmesg shows kernel version + SYN flood warning", async ({ page }) => {
        await dispatchCmd(page, "dmesg");
        const t = await terminalText(page);
        expect(t).toMatch(/Linux version 6\.1\.0-d3cyph3r/);
        expect(t).toContain("Possible SYN flooding");
      });

      test("exit from level1 returns to the lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        // Wait for the prompt label to update to the lobby — `exit`
        // re-prints "AVAILABLE ENGAGEMENTS" but that string is already
        // in scrollback from boot, so we anchor on the live prompt.
        await page.waitForFunction(
          () =>
            document
              .getElementById("prompt-label")
              ?.innerText.includes("@d3cyph3r:"),
          null,
          { timeout: 5000 },
        );
        const prompt = await promptText(page);
        expect(prompt).toContain("@d3cyph3r:");
      });
    });
  });

  // ── Level 2 — "Daniel's Forgotten Cron" ─────────────────────────
  // Gated by `Halton-2024-Q3!` (the DB_PROD_PASS leaked in level1's
  // staging-worker.env.bak; Halton policy reuses the string for the
  // bastion login). Puzzle is cron 101 against a tombstoned account:
  // /etc/cron.d/halton-weekly-snapshot runs as daniel (offboarded
  // 2025-01-31, account never disabled) and redirects bash `set -x`
  // trace to /var/log/cron-daniel.log (mode 644), which echoes the
  // exported SSH_KEY_PASSPHRASE = `H@lton-Snapshot-2024-Q4` — the
  // level3@linux entry credential.
  test.describe("level2@linux — Daniel's forgotten cron", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level2@linux");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level2", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level2@linux");
        await dispatchCmd(page, "Halton-2024-Q3!");
        await waitForOutput(page, "Connected: level2@linux");
        // v1.11.0 persistence opt-in prompt fires on first non-lobby
        // connect of a fresh session.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity (audit@halton-prod-bastion)", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level2@linux");
        expect(t, "objective references the cron job").toContain("cron");

        // env_vars.HOSTNAME on this level is `halton-prod-bastion…`,
        // so the PS1 \h substitution surfaces the short hostname
        // instead of the engine track key. That's the level1@linux
        // pattern with a different hostname.
        const prompt = await promptText(page);
        expect(prompt).toContain("@halton-prod-bastion:");
        expect(prompt.startsWith("audit@")).toBeTruthy();
      });

      test("whoami prints in-world identity 'audit'", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\baudit\b/);
      });

      test("ls /etc/cron.d/ surfaces the halton-weekly-snapshot job", async ({ page }) => {
        await dispatchCmd(page, "ls /etc/cron.d/");
        const t = await terminalText(page);
        expect(t).toContain("halton-weekly-snapshot");
      });

      test("cat /etc/cron.d/halton-weekly-snapshot reveals daniel + script + log redirect", async ({ page }) => {
        await dispatchCmd(page, "cat /etc/cron.d/halton-weekly-snapshot");
        const t = await terminalText(page);
        expect(t, "cron entry runs as daniel").toMatch(/\bdaniel\b/);
        expect(t, "cron entry invokes the snapshot script").toContain(
          "/opt/halton/snapshot-config.sh",
        );
        expect(t, "cron entry redirects stdout/stderr to the log").toContain(
          "/var/log/cron-daniel.log",
        );
      });

      test("cat /var/log/cron-daniel.log leaks the SSH_KEY_PASSPHRASE via set -x trace", async ({ page }) => {
        await dispatchCmd(page, "cat /var/log/cron-daniel.log");
        const t = await terminalText(page);
        expect(t, "set -x trace echoes the export line").toContain(
          "+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'",
        );
      });

      test("cat /opt/halton/snapshot-config.sh shows the leaking script", async ({ page }) => {
        await dispatchCmd(page, "cat /opt/halton/snapshot-config.sh");
        const t = await terminalText(page);
        expect(t, "script uses set -x for audit trace").toMatch(/set -euxo pipefail/);
        expect(t, "script exports SSH_KEY_PASSPHRASE in the env").toContain(
          "export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'",
        );
      });

      test("crontab -l on audit prints 'no scheduled jobs' header", async ({ page }) => {
        await dispatchCmd(page, "crontab -l");
        const t = await terminalText(page);
        expect(t).toContain("no scheduled jobs");
      });

      test("crontab -l -u daniel reports no user-level crontab (Daniel's job lives in /etc/cron.d/)", async ({ page }) => {
        await dispatchCmd(page, "crontab -l -u daniel");
        const t = await terminalText(page);
        expect(t).toContain("no crontab for daniel");
      });

      test("crontab -l -u root reveals the baseline maintenance lines", async ({ page }) => {
        await dispatchCmd(page, "crontab -l -u root");
        const t = await terminalText(page);
        expect(t).toContain("cron-health.sh");
        expect(t).toContain("logrotate");
      });

      test("journalctl -u cron.service shows the weekly daniel fires", async ({ page }) => {
        await dispatchCmd(page, "journalctl -u cron.service");
        const t = await terminalText(page);
        expect(t, "journalctl logs the daniel cron invocation").toContain(
          "(daniel) CMD (/opt/halton/snapshot-config.sh",
        );
      });

      test("last shows Daniel's stale Jan-31 login alongside current audit session", async ({ page }) => {
        await dispatchCmd(page, "last");
        const t = await terminalText(page);
        expect(t, "current audit session shown as 'still logged in'").toContain(
          "still logged in",
        );
        expect(t, "last shows daniel's Jan-31 stale login").toMatch(/daniel.*Jan 31/);
      });

      test("cat /etc/passwd fires the tombstoned-daniel bonus find", async ({ page }) => {
        await dispatchCmd(page, "cat /etc/passwd");
        const t = await terminalText(page);
        expect(t, "/etc/passwd carries daniel with /bin/bash shell").toContain(
          "daniel:x:1042:1042:Daniel Vance (rolled off Halton 2025-01-31):/home/daniel:/bin/bash",
        );
        expect(t, "bonus-find banner fires").toContain(
          "Bonus find unlocked: Daniel's account is still active",
        );
      });

      test("cat /opt/halton/PASSWORD-POLICY.md fires the password-cargo-cult bonus find", async ({ page }) => {
        await dispatchCmd(page, "cat /opt/halton/PASSWORD-POLICY.md");
        const t = await terminalText(page);
        expect(t, "policy doc documents the quarterly pattern").toContain("Halton-YYYY-Q#");
        expect(t, "bonus-find banner fires").toContain(
          "Bonus find unlocked: Halton's quarterly-password policy",
        );
      });

      test("exit from level2 returns to the lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        await page.waitForFunction(
          () =>
            document
              .getElementById("prompt-label")
              ?.innerText.includes("@d3cyph3r:"),
          null,
          { timeout: 5000 },
        );
        const prompt = await promptText(page);
        expect(prompt).toContain("@d3cyph3r:");
      });
    });
  });
});
