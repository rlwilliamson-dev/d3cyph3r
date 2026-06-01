// tests/specs/cloud.spec.cjs
//
// Cloud track playtest — level0 ("Coverline's Twelfth Bucket") and
// level1 ("The Migration Table Nobody Dropped"). Exercises the
// `aws sts` / `aws s3 ls` / `aws s3 cp` surface (bucket enumeration,
// AccessDenied vs public-list, claim-JSON PII exposure), the
// breadcrumb-credential chain to level1, and the `psql` Postgres
// client (database listing, table enumeration, SELECT with LIMIT,
// graceful errors for unknown table / DB / DML attempts).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 1373-1591.
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

test.describe("cloud track", () => {
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

  // ── Level 0 — Coverline's Twelfth Bucket ──────────────────────────
  // No password (level0 of each track is the entry point).
  test.describe("level0@cloud — Coverline's Twelfth Bucket", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@cloud");
      await waitForOutput(page, "Connected: level0@cloud");
      // v1.11.0 — first non-lobby connect of the session fires the
      // persistence opt-in prompt. Dismiss with 'n'.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("connection banner + prompt identity", async ({ page }) => {
      const t = await terminalText(page);
      expect(t).toContain("Connected: level0@cloud");
      expect(t).toContain("Coverline");
      expect(t).toContain("Jordan");
      expect(t).toContain("SOC 2");

      const prompt = await promptText(page);
      expect(prompt).toContain("@cloud:");
      expect(prompt.startsWith("cloudsec@")).toBeTruthy();
    });

    test("ls shows the level0 fileset", async ({ page }) => {
      await dispatchCmd(page, "ls");
      const t = await terminalText(page);
      for (const f of [
        "welcome.md",
        "engagement-notes.md",
        "audit-worksheet.txt",
        "lessons-learned.md",
      ]) {
        expect(t, `ls shows ${f}`).toContain(f);
      }
    });

    test("engagement-notes.md cites the regulatory regimes", async ({ page }) => {
      await dispatchCmd(page, "cat engagement-notes.md");
      const t = await terminalText(page);
      expect(t).toContain("Priya");
      expect(t).toContain("SOC 2 Type II");
      expect(t).toContain("NAIC");
      expect(t).toContain("NYDFS");
    });

    test("audit-worksheet.txt lists all 6 buckets + flags public marketing", async ({ page }) => {
      await dispatchCmd(page, "cat audit-worksheet.txt");
      const t = await terminalText(page);
      expect(t).toContain("coverline-static-assets");
      expect(t).toContain("coverline-backups-prod");
      expect(t).toContain("coverline-marketing-public");
      expect(t).toContain("coverline-terraform-state");
      expect(t).toContain("coverline-customer-exports");
      expect(t).toContain("coverline-claims-uploads-prod");
      expect(t).toMatch(/coverline-marketing-public\s+PUBLIC/);
    });

    test("aws sts get-caller-identity returns Driftwood readonly (bonus-find trigger)", async ({ page }) => {
      // v1.10.0 BONUS-FIND TRIGGER — `aws sts get-caller-identity`
      // confirms the audit is running from Driftwood's account, not
      // the client's. Fires the "sts-identity-confirmation" bonus.
      await dispatchCmd(page, "aws sts get-caller-identity");
      const t = await terminalText(page);
      expect(t).toContain("driftwood-cloudsec-readonly");
    });

    test("locked-down buckets all return AccessDenied on ls", async ({ page }) => {
      for (const bucket of [
        "coverline-static-assets",
        "coverline-backups-prod",
        "coverline-terraform-state",
        "coverline-customer-exports",
      ]) {
        await dispatchCmd(page, `aws s3 ls --no-sign-request s3://${bucket}`);
        const t = await terminalText(page);
        expect(t, `${bucket} returns AccessDenied`).toMatch(/An error occurred \(AccessDenied\)/);
      }
    });

    test("public marketing bucket lists brochures + partner-kits", async ({ page }) => {
      await dispatchCmd(page, "aws s3 ls --no-sign-request s3://coverline-marketing-public");
      const t = await terminalText(page);
      expect(t).toContain("brochures/coverline-overview-2024.pdf");
      expect(t).toContain("partner-kits/coverline-affiliate-deck-2024.pdf");
    });

    test("claims-uploads bucket UNEXPECTEDLY lists (the finding)", async ({ page }) => {
      await dispatchCmd(page, "aws s3 ls --no-sign-request s3://coverline-claims-uploads-prod");
      const t = await terminalText(page);
      expect(t).toContain("2024-Q1-claims/claim-cl-019823.json");
      expect(t).toContain("legacy-deploy/migrate-rds.sh");
      expect(t).toContain("legacy-migration-snapshot/coverline_claims.dump");
    });

    test("claim JSON exposes claimant PII (NPI under GLBA/NAIC)", async ({ page }) => {
      await dispatchCmd(
        page,
        "aws s3 cp s3://coverline-claims-uploads-prod/2024-Q1-claims/claim-cl-019823.json -",
      );
      const t = await terminalText(page);
      expect(t).toContain("Marcus");
      expect(t).toContain("Reyes");
      expect(t).toMatch(/XXX-XX-\d{4}/);
      expect(t).toContain("Bridgeport");
      expect(t).toContain("06604");
    });

    test("migration script leaks RDS host + level1 breadcrumb", async ({ page }) => {
      await dispatchCmd(
        page,
        "aws s3 cp s3://coverline-claims-uploads-prod/legacy-deploy/migrate-rds.sh -",
      );
      const t = await terminalText(page);
      expect(t).toContain("coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com");
      expect(t).toContain("Cl41ms-Pr0d-M4st3r-2024");
    });

    test("aws s3 cp on a denied bucket also returns AccessDenied", async ({ page }) => {
      // Defense-in-depth — the engine doesn't let a player bypass the
      // ls denial by going straight to cp.
      await dispatchCmd(page, "aws s3 cp s3://coverline-backups-prod/some-key -");
      const t = await terminalText(page);
      expect(t).toMatch(/An error occurred \(AccessDenied\) when calling the GetObject/);
    });

    test("lessons-learned.md cites the relevant frameworks", async ({ page }) => {
      await dispatchCmd(page, "cat lessons-learned.md");
      const t = await terminalText(page);
      expect(t).toContain("CC6.1");
      expect(t).toContain("CWE-200");
      expect(t).toContain("CWE-798");
      expect(t).toContain("T1530");
      expect(t).toContain("CIS AWS Foundations Benchmark");
      expect(t).toContain("Block Public Access");
    });

    test("exit from level0@cloud returns to the lobby", async ({ page }) => {
      await dispatchCmd(page, "exit");
      // Wait for the prompt label to update to the lobby — `exit`
      // is async (setTimeout in shell.js), so anchor on the live prompt.
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("@d3cyph3r:"),
        null,
        { timeout: 5000 },
      );
      const prompt = await promptText(page);
      expect(prompt).toContain("@d3cyph3r:");
    });
  });

  // ── Level 1 — The Migration Table Nobody Dropped ────────────────
  test.describe("level1@cloud — The Migration Table Nobody Dropped", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level1@cloud");
      await dispatchCmd(page, "wrong-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level1", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level1@cloud");
        await dispatchCmd(page, "Cl41ms-Pr0d-M4st3r-2024");
        await waitForOutput(page, "Connected: level1@cloud");
        // v1.11.0 persistence opt-in prompt fires on first non-lobby
        // connect of a fresh session. Dismiss it.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level1@cloud");
        // Objective references DB enumeration.
        expect(t).toMatch(/enumerate|database|psql/i);

        const prompt = await promptText(page);
        expect(prompt).toContain("@cloud:");
        expect(prompt.startsWith("cloudsec@")).toBeTruthy();
      });

      test("ls shows the level1 fileset", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "engagement-notes.md",
          "bastion-handoff.txt",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("psql --version returns a PostgreSQL version string", async ({ page }) => {
        await dispatchCmd(page, "psql --version");
        const t = await terminalText(page);
        expect(t).toContain("PostgreSQL");
      });

      test("psql \\l lists the Coverline DBs + system DBs", async ({ page }) => {
        await dispatchCmd(page, 'psql "\\l"');
        const t = await terminalText(page);
        expect(t).toContain("coverline_claims");
        expect(t).toContain("coverline_billing");
        expect(t).toContain("template0");
        expect(t).toContain("template1");
      });

      test("psql \\dt against coverline_claims shows all 7 tables", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "\\dt"');
        const t = await terminalText(page);
        for (const tbl of [
          "claims",
          "customers",
          "policies",
          "adjusters",
          "integrations",
          "migration_artifacts",
          "users",
          "audit_log",
        ]) {
          expect(t, `psql \\dt lists table ${tbl}`).toContain(tbl);
        }
      });

      test("integrations table shows Secrets Manager + NAIC pointer pattern", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "SELECT * FROM integrations"');
        const t = await terminalText(page);
        expect(t).toContain("secrets-manager:broker-portal-prod");
        expect(t).toContain("naic-data-exchange");
      });

      test("migration_artifacts table carries the level2 breadcrumb", async ({ page }) => {
        // THE SMOKING GUN — the migration_artifacts table has the
        // broker-portal credential.
        await dispatchCmd(page, 'psql -d coverline_claims "SELECT * FROM migration_artifacts"');
        const t = await terminalText(page);
        expect(t).toContain("(3 rows)");
        expect(t).toContain("rds-mig-2024-svc-Tmp9pQ7rT");
        expect(t).toContain("Cv-BrokerSvc-Pr0d-2024-Migration");
        expect(t).toContain("naic-handoff-2024-Q1-7Kp9");
      });

      test("users table reveals the dormant vikram.shah account", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "SELECT * FROM users"');
        const t = await terminalText(page);
        expect(t).toContain("vikram.shah");
        expect(t).toContain("terminated");
        expect(t).toContain("coverline_admin");
        expect(t).toContain("rds_master");
      });

      test("audit_log shows the 2026-05-20 anomalous schema query", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "SELECT * FROM audit_log"');
        const t = await terminalText(page);
        expect(t).toContain("schema_query_pg_catalog");
        expect(t).toContain("2026-05-20");
        expect(t).toContain("unrecognized source");
      });

      test("SELECT with LIMIT returns the requested row count", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "SELECT * FROM claims LIMIT 2"');
        const t = await terminalText(page);
        expect(t).toContain("(2 rows)");
      });

      test("psql on unknown table returns graceful 'does not exist'", async ({ page }) => {
        await dispatchCmd(
          page,
          'psql -d coverline_claims "SELECT * FROM nonexistent_table"',
        );
        const t = await terminalText(page);
        expect(t).toContain('relation "nonexistent_table" does not exist');
      });

      test("psql on unknown database returns graceful FATAL message", async ({ page }) => {
        await dispatchCmd(page, 'psql -d nonexistent_db "\\dt"');
        const t = await terminalText(page);
        expect(t).toContain('database "nonexistent_db" does not exist');
      });

      test("psql refuses DML with helpful read-only error", async ({ page }) => {
        await dispatchCmd(page, 'psql -d coverline_claims "DELETE FROM claims"');
        const t = await terminalText(page);
        expect(t).toContain("SELECT and meta-commands only");
      });

      test("lessons-learned.md cites the relevant frameworks", async ({ page }) => {
        await dispatchCmd(page, "cat lessons-learned.md");
        const t = await terminalText(page);
        expect(t).toContain("CWE-798");
        expect(t).toContain("CWE-540");
        expect(t).toContain("IA-5(7)");
        expect(t).toContain("T1078");
        expect(t).toContain("T1213");
        expect(t).toContain("T1552.001");
        expect(t).toContain("CC6.2");
        expect(t).toContain("NAIC");
        expect(t).toContain("72");
        expect(t).toContain("500.07");
        expect(t).toContain("500.17");
        expect(t).toContain("314.5");
        expect(t).toContain("Secrets Manager");
        expect(t).toContain("Database Activity Streams");
      });

      test("whoami prints 'cloudsec' on the bastion", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bcloudsec\b/);
      });

      test("exit from level1@cloud returns to the lobby", async ({ page }) => {
        await dispatchCmd(page, "exit");
        // Wait for the prompt label to update to the lobby — `exit`
        // is async (setTimeout in shell.js), so anchor on the live prompt.
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

  // ── Level 2 — The Bot That Kept Admin ─────────────────────────────
  // IAM least-privilege audit: a dormant legacy-deploy-bot with
  // AdministratorAccess. Gate is level1's broker-portal-svc breadcrumb.
  test.describe("level2@cloud — The Bot That Kept Admin", () => {
    test("wrong password is rejected at the gate", async ({ page }) => {
      await dispatchCmd(page, "ssh level2@cloud");
      await dispatchCmd(page, "not-the-password");
      const t = await terminalText(page);
      expect(t).toContain("Permission denied, please try again.");
    });

    test.describe("inside level2", () => {
      test.beforeEach(async ({ page }) => {
        await dispatchCmd(page, "ssh level2@cloud");
        await dispatchCmd(page, "Cv-BrokerSvc-Pr0d-2024-Migration");
        await waitForOutput(page, "Connected: level2@cloud");
        // Dismiss the v1.11.0 persistence opt-in prompt.
        await waitForOutput(page, "Save your progress across browser sessions?");
        await dispatchCmd(page, "n");
        await waitForOutput(page, "Progress stays in this tab only");
      });

      test("connection banner + prompt identity", async ({ page }) => {
        const t = await terminalText(page);
        expect(t).toContain("Connected: level2@cloud");
        // Objective/lesson reference the IAM audit.
        expect(t).toMatch(/IAM|privilege|principal/i);

        const prompt = await promptText(page);
        expect(prompt).toContain("@cloud:");
        expect(prompt.startsWith("cloudsec@")).toBeTruthy();
      });

      test("ls shows the level2 fileset incl. the migration tooling dir", async ({ page }) => {
        await dispatchCmd(page, "ls");
        const t = await terminalText(page);
        for (const f of [
          "welcome.md",
          "engagement-notes.md",
          "migration-2024",
          "lessons-learned.md",
        ]) {
          expect(t, `ls shows ${f}`).toContain(f);
        }
      });

      test("aws sts get-caller-identity confirms broker-portal-svc in Coverline's account", async ({ page }) => {
        await dispatchCmd(page, "aws sts get-caller-identity");
        const t = await terminalText(page);
        expect(t).toContain("broker-portal-svc");
        expect(t).toContain("390210448812");
      });

      test("aws iam list-users enumerates the migration-era principals", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-users");
        const t = await terminalText(page);
        for (const u of [
          "legacy-deploy-bot",
          "migration-runner-bot",
          "ci-deploy-svc",
          "vikram.shah",
          "broker-portal-svc",
        ]) {
          expect(t, `list-users shows ${u}`).toContain(u);
        }
      });

      test("legacy-deploy-bot has AdministratorAccess attached (THE finding)", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-attached-user-policies --user-name legacy-deploy-bot");
        const t = await terminalText(page);
        expect(t).toContain("AdministratorAccess");
      });

      test("get-policy on AdministratorAccess shows the *:* god-mode grant", async ({ page }) => {
        await dispatchCmd(page, "aws iam get-policy --policy-arn arn:aws:iam::aws:policy/AdministratorAccess");
        const t = await terminalText(page);
        expect(t).toContain('"Action": "*"');
        expect(t).toContain('"Resource": "*"');
      });

      test("migration-runner-bot is tightly scoped (the least-privilege contrast)", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-attached-user-policies --user-name migration-runner-bot");
        const t = await terminalText(page);
        // The scoped policy name is the contrast vs legacy-deploy-bot's
        // AdministratorAccess. (A negative `.not.toContain` would false-
        // positive on the connection banner, which prints the objective —
        // and the objective text names AdministratorAccess.)
        expect(t).toContain("coverline-migration-s3-scoped");
        // The scoped policy doc grants only s3 on the migration buckets.
        await dispatchCmd(page, "aws iam get-policy --policy-arn arn:aws:iam::390210448812:policy/coverline-migration-s3-scoped");
        const t2 = await terminalText(page);
        expect(t2).toContain("coverline-migration-*");
      });

      test("legacy-deploy-bot's access key is Active and dates to the 2024 migration", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-access-keys --user-name legacy-deploy-bot");
        const t = await terminalText(page);
        expect(t).toContain("AKIA7X4DEPLOYB0T2024");
        expect(t).toContain("Active");
        expect(t).toContain("2024-02-15");
      });

      test("get-access-key-last-used shows the bot's key dormant since 2024 (the dormancy signal)", async ({ page }) => {
        await dispatchCmd(page, "aws iam get-access-key-last-used --access-key-id AKIA7X4DEPLOYB0T2024");
        const t = await terminalText(page);
        expect(t).toContain("legacy-deploy-bot");
        expect(t).toContain("2024-03-02");
      });

      test("BONUS: inspecting vikram.shah's still-Active key fires 'Ghost of a terminated admin'", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-access-keys --user-name vikram.shah");
        const t = await terminalText(page);
        expect(t).toContain("Active");
        expect(t, "ghost-terminated-admin bonus fires").toContain("Bonus find unlocked: Ghost of a terminated admin");
      });

      test("BONUS: ci-deploy-svc's 2019 key fires 'A key older than the cloud team'", async ({ page }) => {
        await dispatchCmd(page, "aws iam list-access-keys --user-name ci-deploy-svc");
        const t = await terminalText(page);
        expect(t).toContain("2019");
        expect(t, "ancient-access-key bonus fires").toContain("Bonus find unlocked: A key older than the cloud team");
      });

      test("BONUS: get-account-summary reveals a root access key + fires the root bonus", async ({ page }) => {
        await dispatchCmd(page, "aws iam get-account-summary");
        const t = await terminalText(page);
        expect(t).toContain("AccountAccessKeysPresent");
        expect(t, "root-access-key bonus fires").toContain("Bonus find unlocked: Root still has an access key");
      });

      test("the leftover bootstrap-creds file carries the level3 breadcrumb", async ({ page }) => {
        // THE BREADCRUMB — the secret for the dormant admin bot, left
        // in cleartext in Vikram's 2024 migration tooling.
        await dispatchCmd(page, "cat migration-2024/bootstrap-iam-keys.env");
        const t = await terminalText(page);
        expect(t).toContain("AKIA7X4DEPLOYB0T2024");
        expect(t).toContain("Ldb0t"); // start of the legacy-deploy-bot secret (level3 gate)
        expect(t).toContain("legacy-deploy-bot");
      });

      test("lessons-learned.md cites the relevant frameworks", async ({ page }) => {
        await dispatchCmd(page, "cat lessons-learned.md");
        const t = await terminalText(page);
        expect(t).toContain("AC-6");
        expect(t).toContain("CWE-269");
        expect(t).toContain("CWE-250");
        expect(t).toContain("T1078.004");
        expect(t).toContain("SCS-C03");
        expect(t).toContain("500.07");
        expect(t).toContain("least privilege");
      });

      test("whoami prints 'cloudsec' on the bastion", async ({ page }) => {
        await dispatchCmd(page, "whoami");
        const t = await terminalText(page);
        expect(t).toMatch(/\bcloudsec\b/);
      });

      test("exit from level2@cloud returns to the lobby", async ({ page }) => {
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
