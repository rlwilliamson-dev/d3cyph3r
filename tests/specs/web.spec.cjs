// tests/specs/web.spec.cjs
//
// Web-track playtest coverage:
//   - level0@web — "Meridian's Forgotten Backup Folder" (gobuster +
//                  curl autoindex; FERPA / OWASP A05 lesson).
//   - level1@web — "Carlos's Login Wall" (IDOR via student_id query
//                  parameter; transcript API).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 828-958.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context, so the v1.11.0
// persistence prompt fires on the first non-lobby connect of each
// test — every ssh-in here dismisses it with `n` immediately so the
// subsequent commands aren't swallowed by the consent handler.
//
// level1@web depends on the level0 breadcrumb (M3rid14n!2023-prod)
// as its password gate, but each test() supplies the password
// directly rather than chaining through a level0 playthrough — so
// the two test() blocks are independent (no test.describe.serial
// needed).

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("web track", () => {
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

  test("level0@web — Meridian backup folder (autoindex + FERPA leak)", async ({ page }) => {
    // No password — level0 is the entry point for the web track.
    // ssh handler defers connectTo() by 200ms (setTimeout in ssh.js),
    // so wait for the connection banner before dismissing the v1.11.0
    // persistence opt-in prompt that fires immediately after.
    await dispatchCmd(page, "ssh level0@web");
    await waitForOutput(page, "Connected: level0@web");
    await waitForOutput(page, "[y/N]");
    await dispatchCmd(page, "n");

    let t = await terminalText(page);
    expect(t).toContain("Connected: level0@web");
    expect(await promptText(page)).toContain("@web:");
    expect(await promptText(page)).toMatch(/^secops@/);
    expect(t).toContain("Meridian State University");
    expect(t).toContain("Carlos");

    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    for (const f of [
      "welcome.md",
      "engagement-notes.md",
      "meridian-scope.txt",
      "lessons-learned.md",
    ]) {
      expect(t, `ls shows ${f}`).toContain(f);
    }

    await dispatchCmd(page, "gobuster https://www.meridian.edu");
    t = await terminalText(page);
    expect(t).toMatch(/\/backup\s+\(Status: 200\)/);
    expect(t).toMatch(/\/admin\s+\(Status: 401\)/);

    await dispatchCmd(page, "curl https://www.meridian.edu/backup/");
    t = await terminalText(page);
    expect(t).toContain("Index of /backup");
    expect(t).toContain("students_export_2023.csv");
    expect(t).toContain("db-creds.txt");

    await dispatchCmd(
      page,
      "curl https://www.meridian.edu/backup/students_export_2023.csv"
    );
    t = await terminalText(page);
    expect(t).toContain("patel.a@meridian.edu");
    expect(t).toMatch(/3\.91/);
    expect(t).toContain("4,217 records");

    await dispatchCmd(page, "curl https://www.meridian.edu/backup/db-creds.txt");
    t = await terminalText(page);
    expect(t).toContain("M3rid14n!2023-prod");

    await dispatchCmd(page, "cat engagement-notes.md");
    t = await terminalText(page);
    expect(t).toContain("Priya");
    expect(t).toContain("FERPA");

    await dispatchCmd(page, "cat lessons-learned.md");
    t = await terminalText(page);
    expect(t).toContain("CWE-548");
    expect(t).toContain("A05");
    expect(t).toContain("Misconfiguration");

    // v1.10.0 bonus-find trigger — curl /robots.txt fires the
    // "robots-txt-billboard" bonus.
    await dispatchCmd(page, "curl https://www.meridian.edu/robots.txt");
    t = await terminalText(page);
    expect(t).toContain("Disallow: /backup/");

    // exit defers connectTo(LOBBY) by 200ms (setTimeout in shell.js).
    // Wait for the prompt to flip back to the guest@d3cyph3r lobby.
    await dispatchCmd(page, "exit");
    await page.waitForFunction(() => {
      const p = document.getElementById("prompt-label");
      return p && p.innerText.includes("@d3cyph3r:");
    }, null, { timeout: 5000 });
    expect(await promptText(page)).toContain("@d3cyph3r:");
  });

  test("level1@web — Carlos's login wall (IDOR via student_id)", async ({ page }) => {
    // Wrong password first to confirm the gate works. handlePasswordInput
    // prints "Permission denied" synchronously (no setTimeout when the
    // password is wrong), so dispatchCmd's input-cleared wait suffices.
    await dispatchCmd(page, "ssh level1@web");
    await dispatchCmd(page, "wrong-password");
    let t = await terminalText(page);
    expect(t).toContain("Permission denied, please try again.");

    // Correct password: handlePasswordInput defers connectTo() by 300ms,
    // so wait on the connection banner + persistence prompt before the
    // dismiss.
    await dispatchCmd(page, "ssh level1@web");
    await dispatchCmd(page, "M3rid14n!2023-prod");
    await waitForOutput(page, "Connected: level1@web");
    await waitForOutput(page, "[y/N]");
    await dispatchCmd(page, "n");

    t = await terminalText(page);
    expect(t).toContain("Connected: level1@web");
    expect(await promptText(page)).toContain("@web:");
    expect(await promptText(page)).toMatch(/^webapp_admin@/);
    expect(t).toMatch(/transcript/i);

    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    for (const f of [
      "welcome.md",
      "priya-note.md",
      "transcript-api.js",
      "session.txt",
      "id-conventions.md",
      "lessons-learned.md",
    ]) {
      expect(t, `ls shows ${f}`).toContain(f);
    }

    await dispatchCmd(page, "cat transcript-api.js");
    t = await terminalText(page);
    expect(t).toContain("requireMeridianSSO");
    expect(t).toMatch(/req\.query\.student_id/);

    // v1.10.0 bonus-find trigger — cat session.txt fires the
    // "ten-year-session-token" bonus (the file notes the 2036 expiry
    // as itself a finding).
    await dispatchCmd(page, "cat session.txt");
    t = await terminalText(page);
    expect(t).toContain("long-lived service-account");

    await dispatchCmd(page, "cookies https://portal.meridian.edu");
    t = await terminalText(page);
    expect(t).toContain("MeridianSSO");

    // Curl two real-student transcript IDs from level0's CSV — both
    // return valid transcripts, demonstrating the IDOR (the SSO
    // middleware passes any authenticated request through regardless
    // of student_id owner).
    await dispatchCmd(
      page,
      "curl 'https://portal.meridian.edu/api/transcript?student_id=M-1872941'"
    );
    t = await terminalText(page);
    expect(t).toContain("Aisha");
    expect(t).toContain("patel.a@meridian.edu");

    await dispatchCmd(
      page,
      "curl 'https://portal.meridian.edu/api/transcript?student_id=M-1873041'"
    );
    t = await terminalText(page);
    expect(t).toContain("Jordan");
    expect(t).toMatch(/Academic Probation/);

    // The BluePier demo M-0000001 carries the level2 breadcrumb in its
    // advisor_notes field. Confirms IDOR extends to legacy system
    // accounts.
    await dispatchCmd(
      page,
      "curl 'https://portal.meridian.edu/api/transcript?student_id=M-0000001'"
    );
    t = await terminalText(page);
    expect(t).toContain("BLUEPIER DEMO ACCOUNT");
    expect(t).toContain("meridian-portal-svc-2026");

    // 404 case proves the API differentiates found-vs-not (so prior
    // responses were genuine database hits, not generic stubs).
    await dispatchCmd(
      page,
      "curl 'https://portal.meridian.edu/api/transcript?student_id=M-9999999'"
    );
    t = await terminalText(page);
    expect(t).toContain('"error":"not found"');

    await dispatchCmd(page, "whoami");
    t = await terminalText(page);
    expect(t).toMatch(/\bwebapp_admin\b/);

    await dispatchCmd(page, "exit");
    // exit defers connectTo(LOBBY) by 200ms (setTimeout in shell.js).
    // Wait for the prompt to flip back to the guest@d3cyph3r lobby.
    await page.waitForFunction(() => {
      const p = document.getElementById("prompt-label");
      return p && p.innerText.includes("@d3cyph3r:");
    }, null, { timeout: 5000 });
    expect(await promptText(page)).toContain("@d3cyph3r:");
  });
});
