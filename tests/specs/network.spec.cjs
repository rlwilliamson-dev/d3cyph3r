// tests/specs/network.spec.cjs
//
// Coverage for the Network track: level0@network (Atlas Health
// perimeter check — nmap, engagement notes, breadcrumb leak) and
// level1@network (Atlas internal DNS — AXFR zone transfer +
// v1.7.0 network-inspection tooling exercised against the
// staging-db host's demo data).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 589-727.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Tests run in a single test.describe.serial() because level1@network
// is gated behind a password the player would normally collect from
// level0's engagement-notes.md. Each test() still gets a fresh page
// context — we re-do the ssh + password flow inside the level1 test
// rather than relying on state bleeding between tests.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

/**
 * Wait for the prompt-label text to satisfy a predicate. Used after
 * `ssh`-style transitions that flip the prompt asynchronously (the
 * engine's connectTo runs behind a 200-300ms setTimeout, so the
 * dispatchCmd input-cleared wait returns before the prompt updates).
 */
async function waitForPrompt(page, predicate, timeoutMs = 5000) {
  await page.waitForFunction(
    (predSrc) => {
      const el = document.getElementById("prompt-label");
      if (!el) return false;
      // eslint-disable-next-line no-new-func
      const pred = new Function("text", `return (${predSrc})(text);`);
      return pred(el.innerText);
    },
    predicate.toString(),
    { timeout: timeoutMs }
  );
}

test.describe("network track", () => {
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

  // ── Level 0 — Atlas Health perimeter check (network track) ──────
  // No password (level0 of each track is the entry point).
  test("level0@network — Atlas Health perimeter scan", async ({ page }) => {
    await dispatchCmd(page, "ssh level0@network");
    // The lobby->level connect path runs behind a setTimeout, so wait
    // for the connection banner to appear before reading state.
    await waitForOutput(page, "Connected: level0@network");
    // v1.11.0 — first non-lobby connect fires the persistence opt-in
    // prompt; the next Enter is routed to the consent handler. Dismiss
    // with 'n' so subsequent commands dispatch normally. (Dedicated
    // persistence-flow tests live in their own spec.)
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    let t = await terminalText(page);
    expect(t, "Connected to level0@network").toContain("Connected: level0@network");
    expect(await promptText(page), "Prompt host updated to 'network'").toContain("@network:");
    expect(await promptText(page), "Prompt user shows in-world identity 'secops'").toMatch(/^secops@/);
    expect(t, "Objective references Atlas Health").toContain("Atlas Health");
    expect(t, "Lesson mentions Marcus (new recurring character)").toContain("Marcus");

    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    for (const f of ["welcome.md", "engagement-notes.md", "atlas-perimeter.txt", "lessons-learned.md"]) {
      expect(t, `ls shows ${f}`).toContain(f);
    }

    await dispatchCmd(page, "nmap staging.atlas.health");
    t = await terminalText(page);
    expect(t, "nmap on staging reveals open 5432/postgresql").toMatch(/5432\/tcp\s+open\s+postgresql/);

    await dispatchCmd(page, "nmap -sV staging.atlas.health");
    t = await terminalText(page);
    expect(t, "nmap -sV reveals PostgreSQL 13.11").toContain("PostgreSQL 13.11");

    await dispatchCmd(page, "cat engagement-notes.md");
    t = await terminalText(page);
    expect(t, "engagement-notes.md mentions Priya (continuity)").toContain("Priya");
    expect(t, "engagement-notes.md leaks default cred breadcrumb").toContain("atlas-default-2025");

    await dispatchCmd(page, "whoami");
    t = await terminalText(page);
    expect(t, "whoami prints 'secops' on the audit workstation").toMatch(/\bsecops\b/);

    await dispatchCmd(page, "exit");
    // `exit` calls connectTo(LOBBY) behind a 200ms setTimeout, so the
    // prompt-label flip is asynchronous from dispatchCmd's POV.
    await waitForPrompt(page, (s) => s.includes("@d3cyph3r:"));
    expect(
      await promptText(page),
      "exit from level0@network returns to lobby"
    ).toContain("@d3cyph3r:");
  });

  // ── Level 1 — Atlas internal DNS (zone-transfer puzzle) ─────────
  // Cold-start scenario: this spec enters level1@network in a fresh
  // browser context, so the player never visited level0@network. That
  // means (a) the persistence-consent prompt has NOT fired yet (it
  // only fires on a SUCCESSFUL non-lobby connect), and (b) the v1.10.0
  // cold-start gate hint is printed alongside "Permission denied".
  test("level1@network — wrong password is rejected at the gate", async ({ page }) => {
    await dispatchCmd(page, "ssh level1@network");
    await dispatchCmd(page, "wrong-password");
    await waitForOutput(page, "Permission denied, please try again.");
    const t = await terminalText(page);
    expect(t, "Wrong password on level1@network prints 'Permission denied'").toContain(
      "Permission denied, please try again."
    );
  });

  test("level1@network — AXFR zone transfer + network-inspection tooling", async ({ page }) => {
    await dispatchCmd(page, "ssh level1@network");
    await dispatchCmd(page, "atlas-default-2025");
    // Wait for the post-password connectTo() to print the banner —
    // it's queued behind a 300ms setTimeout in handlePasswordInput.
    await waitForOutput(page, "Connected: level1@network");
    // Persistence prompt fires AFTER the first successful non-lobby
    // connect — dismiss it before continuing with level assertions.
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    let t = await terminalText(page);
    expect(t, "Correct password connects to level1@network").toContain("Connected: level1@network");
    expect(await promptText(page), "Prompt host stays 'network' on level1").toContain("@network:");
    expect(await promptText(page), "Prompt user shows in-world identity 'dbadmin'").toMatch(/^dbadmin@/);
    expect(t, "Objective references blast-radius / Marcus's team").toMatch(/blast radius|Marcus/);

    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    for (const f of ["welcome.md", "priya-note.md", "atlas-internal.txt", "lessons-learned.md"]) {
      expect(t, `ls shows ${f}`).toContain(f);
    }

    await dispatchCmd(page, "dig atlas.internal AXFR");
    t = await terminalText(page);
    expect(t, "AXFR dump reveals prod-db internal hostname").toContain("prod-db.atlas.internal");
    expect(t, "AXFR dump reveals PHI-tier host (phi-warehouse)").toContain("phi-warehouse.atlas.internal");
    expect(t, "AXFR dump reveals the 'audit-bypass' shadow hostname").toContain("audit-bypass.atlas.internal");
    expect(t, "AXFR TXT record leaks level2 breadcrumb credential").toContain("atlas-audit-bypass-2026");
    expect(t, "AXFR footer prints standard zone-transfer XFR-size summary").toContain("XFR size:");

    await dispatchCmd(page, "dig nonexistent.example AXFR");
    t = await terminalText(page);
    expect(
      t,
      "AXFR against a domain without records returns NXDOMAIN-style error"
    ).toMatch(/NXDOMAIN|REFUSED/);

    // v1.10.0 BONUS-FIND TRIGGER — cat welcome.md fires the
    // "dbadmin-shell-drift" bonus (welcome.md notes /bin/bash on the
    // vendor service account).
    await dispatchCmd(page, "cat welcome.md");
    t = await terminalText(page);
    expect(t, "level1@network welcome.md notes /bin/bash on dbadmin").toContain("/bin/bash");

    await dispatchCmd(page, "cat priya-note.md");
    t = await terminalText(page);
    expect(t, "priya-note.md mentions Priya (continuity)").toContain("Priya");
    expect(
      t.toLowerCase(),
      "priya-note.md states rules-of-engagement"
    ).toContain("rules of engagement");

    await dispatchCmd(page, "whoami");
    t = await terminalText(page);
    expect(t, "whoami prints 'dbadmin' on the Atlas staging-db host").toMatch(/\bdbadmin\b/);

    // v1.7.0 NETWORK INSPECTION — exercise the new commands against
    // the demo data seeded on level1@network. The reachable hosts
    // here are the same internal-zone targets the AXFR puzzle just
    // surfaced; ping / traceroute let the player verify reachability
    // before reporting blast radius.
    await dispatchCmd(page, "ip addr");
    t = await terminalText(page);
    expect(t, "ip addr lists eth0 with the staging-db IPv4").toMatch(/eth0.*10\.40\.10\.5/s);
    expect(t, "ip addr auto-injects the loopback interface").toContain("lo:");

    await dispatchCmd(page, "ip route");
    t = await terminalText(page);
    expect(t, "ip route shows the default gateway").toMatch(/default\s+via\s+10\.40\.10\.1/);
    expect(t, "ip route shows the connected /24 subnet").toMatch(/10\.40\.10\.0\/24/);

    await dispatchCmd(page, "arp -a");
    t = await terminalText(page);
    expect(t, "arp -a shows the gateway entry").toMatch(/gateway\s+\(10\.40\.10\.1\)/);
    expect(t, "arp -a shows the staging-web host").toContain("staging-web.atlas.internal");

    await dispatchCmd(page, "ping prod-db.atlas.internal");
    t = await terminalText(page);
    expect(t, "ping reaches the prod-db host (4 ECHO replies)").toMatch(/icmp_seq=4 ttl=64/);
    expect(t, "ping prints the standard stats summary (packets transmitted)").toContain("packets transmitted");
    expect(t, "ping prints the standard stats summary (rtt min/avg/max)").toContain("rtt min/avg/max");

    await dispatchCmd(page, "ping nonexistent.host.example");
    t = await terminalText(page);
    expect(t, "ping on unresolvable host prints 'Name or service not known'").toContain(
      "Name or service not known"
    );

    await dispatchCmd(page, "traceroute audit-bypass.atlas.internal");
    t = await terminalText(page);
    expect(t, "traceroute shows the gateway hop").toMatch(/\s1\s+gateway\s+\(10\.40\.10\.1\)/);
    expect(t, "traceroute shows the final hop to the audit-bypass host").toMatch(
      /audit-bypass|deprecated-bypass-host/
    );

    await dispatchCmd(page, "nslookup prod-db.atlas.internal");
    t = await terminalText(page);
    expect(t, "nslookup resolves prod-db to its internal IP").toContain("10.40.20.5");
    expect(t, "nslookup prints the resolver address line (Server:)").toContain("Server:");
    expect(t, "nslookup prints the resolver address line (Address:)").toContain("Address:");

    await dispatchCmd(page, "nslookup nonexistent.host.example");
    t = await terminalText(page);
    expect(t, "nslookup on unknown host prints NXDOMAIN").toContain("NXDOMAIN");

    await dispatchCmd(page, "exit");
    // See level0@network test — connectTo(LOBBY) is queued behind a
    // 200ms setTimeout, so the prompt-label flip is asynchronous.
    await waitForPrompt(page, (s) => s.includes("@d3cyph3r:"));
    expect(
      await promptText(page),
      "exit from level1@network returns to lobby"
    ).toContain("@d3cyph3r:");
  });

  // ── Level 2 — Marcus's leaky cert (v1.26.0) ─────────────────────
  // The audit-svc cred from level1's AXFR TXT-record leak grants
  // entry to audit-bypass.atlas.internal. Apache's self-signed cert
  // is the puzzle: SAN-list internal map + OU-field service email +
  // exim autoresponder leaking the cleartext level3 cred. Two
  // bonus finds trigger on the openssl x509 dump (wildcard sprawl
  // + DELETE BEFORE PROD subject string).
  test("level2@network — cert SAN map + autoresponder cleartext-cred leak", async ({ page }) => {
    await dispatchCmd(page, "ssh level2@network");
    await dispatchCmd(page, "atlas-audit-bypass-2026");
    // Post-password connectTo() is queued behind a 300ms setTimeout
    // in handlePasswordInput — wait for the banner before reading state.
    await waitForOutput(page, "Connected: level2@network");
    // Persistence-consent prompt fires AFTER the first successful
    // non-lobby connect — this is a fresh page context, so it fires
    // here. Dismiss with 'n' so subsequent commands dispatch normally.
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "n");
    let t = await terminalText(page);
    expect(t, "Correct password connects to level2@network").toContain("Connected: level2@network");
    // env_vars.HOSTNAME bumps the prompt host to the fqdn (truncated
    // at first dot for prompt rendering).
    expect(await promptText(page), "Prompt host updated to audit-bypass").toContain("@audit-bypass:");
    expect(await promptText(page), "Prompt user shows in-world identity 'audit-svc'").toMatch(/^audit-svc@/);
    expect(t, "Lesson mentions the day-three audit framing").toMatch(/Day three|day three/);

    await dispatchCmd(page, "ls");
    t = await terminalText(page);
    for (const f of ["welcome.md", "priya-note.md", "atlas-cert-scope.md", "lessons-learned.md"]) {
      expect(t, `ls shows ${f}`).toContain(f);
    }

    // openssl s_client — handshake-level cert + verification.
    await dispatchCmd(page, "openssl s_client -connect localhost:443");
    t = await terminalText(page);
    expect(t, "s_client surfaces the self-signed verification result").toContain("self signed certificate");
    expect(t, "s_client surfaces the audit-bypass CN").toContain("CN=audit-bypass.atlas.internal");
    expect(t, "s_client surfaces the OU=devops-ci service email").toContain("OU=devops-ci@atlas.health");

    // openssl x509 — full cert dump fires BOTH bonus finds.
    await dispatchCmd(page, "openssl x509 -text -noout -in /etc/apache2/ssl/audit-bypass.crt");
    t = await terminalText(page);
    expect(t, "x509 dump includes the wildcard SAN entry (wildcard-sprawl bonus)")
      .toContain("DNS:*.atlas.internal");
    expect(t, "x509 dump includes the DELETE BEFORE PROD subject (self-signed-CA-blunder bonus)")
      .toContain("DELETE BEFORE PROD");
    expect(t, "x509 dump enumerates production-tier internal hosts in SAN")
      .toContain("DNS:phi-warehouse.atlas.internal");
    expect(t, "x509 dump enumerates the devops-ci pivot in SAN")
      .toContain("DNS:devops-ci.atlas.internal");
    // The "wildcard-cert-sprawl" bonus banner pattern + the
    // "self-signed-ca-blunder" bonus banner pattern should both
    // have fired by now. The bonus banner format (bonus.js#70) is
    // "✦ Bonus find unlocked: <name>" — check that BOTH are present.
    const bonusBanners = (t.match(/Bonus find unlocked:/g) || []).length;
    expect(bonusBanners, "Both level2@network bonus finds (wildcard + self-signed CA) fire on the same x509 dump").toBeGreaterThanOrEqual(2);

    // crtsh — CT-log permanence enumeration. Should surface the
    // Tessera bridge + marcus-test entries that thread the
    // engagement narrative.
    await dispatchCmd(page, "crtsh atlas.health");
    t = await terminalText(page);
    expect(t, "crtsh surfaces the staging.atlas.health public cert (CT-log permanence)")
      .toContain("staging.atlas.health");
    expect(t, "crtsh surfaces the Tessera Q4 bridge subdomain (narrative thread from level1)")
      .toContain("tessera-bridge.atlas.health");
    expect(t, "crtsh surfaces Marcus's accidental public test issuance")
      .toContain("marcus-test.atlas.health");

    // The breadcrumb out — exim autoresponder log captures the
    // cleartext level3 cred in the password-reset reply body.
    await dispatchCmd(page, "cat /var/log/exim/autoresponder.log");
    t = await terminalText(page);
    expect(t, "autoresponder log includes the level3 cred (T3mp-DevopsCI-HD8814!q2)")
      .toContain("T3mp-DevopsCI-HD8814!q2");
    expect(t, "autoresponder log includes the helpdesk ticket id HD-2026-Q2-8814")
      .toContain("HD-2026-Q2-8814");

    await dispatchCmd(page, "whoami");
    t = await terminalText(page);
    expect(t, "whoami prints 'audit-svc' on the audit-bypass host")
      .toMatch(/\baudit-svc\b/);

    await dispatchCmd(page, "exit");
    // exit → connectTo(LOBBY) queued behind a 200ms setTimeout.
    await waitForPrompt(page, (s) => s.includes("@d3cyph3r:"));
    expect(
      await promptText(page),
      "exit from level2@network returns to lobby"
    ).toContain("@d3cyph3r:");
  });

  // Cold-start gate — wrong password on level2@network rejected.
  // Mirrors the level1 cold-start test pattern.
  test("level2@network — wrong password is rejected at the gate", async ({ page }) => {
    await dispatchCmd(page, "ssh level2@network");
    await dispatchCmd(page, "wrong-password");
    await waitForOutput(page, "Permission denied, please try again.");
    const t = await terminalText(page);
    expect(t, "Wrong password on level2@network prints 'Permission denied'").toContain(
      "Permission denied, please try again."
    );
  });
});
