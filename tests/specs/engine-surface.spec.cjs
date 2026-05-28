// tests/specs/engine-surface.spec.cjs
//
// Cross-cutting engine smoke tests that don't require entering any
// specific level. Exercises the lobby first-visit banner, the `help`
// reference, and the graceful empty-state behavior of every command
// surface that ships across versions.
//
// Ported from the v1.23.x monolithic playtest.cjs lines ~1-175.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so the first-visit lobby render happens fresh for
// each — no state-bleed between tests.

const { test, expect } = require("@playwright/test");
const { dispatchCmd, terminalText, bootAndWait } = require("../lib/helpers.cjs");

test.describe("engine surface", () => {
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
    // Surface accumulated errors only if the test otherwise passed —
    // a failing assertion already includes its own diagnostic.
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("lobby first-visit banner renders all 7 tracks", async ({ page }) => {
    const t = await terminalText(page);
    expect(t).toContain("AVAILABLE ENGAGEMENTS");
    expect(t).toContain("WELCOME TO DRIFTWOOD SYSTEMS");
    expect(t).toContain("ssh level0@linux");
    expect(t).toContain("ssh level0@network");
    expect(t).toContain("ssh level0@crypto");
    expect(t).toContain("ssh level0@web");
    expect(t).toContain("ssh level0@forensics");
    expect(t).toContain("ssh level0@osint");
    expect(t).toContain("ssh level0@cloud");
    // All 7 tracks have at least level0 — no scaffolded-only entries.
    expect(t).not.toContain("(no levels yet)");
  });

  test("first-visit FIRST STEPS banner shows numbered guide (v1.12.0)", async ({ page }) => {
    const t = await terminalText(page);
    expect(t).toContain("FIRST STEPS");
    expect(t).toMatch(/1\.\s+help\b/);
    expect(t).toMatch(/2\.\s+tracks\b/);
    expect(t).toMatch(/3\.\s+tiers\b/);
    expect(t).toMatch(/4\.\s+progress\b/);
    expect(t).toMatch(/5\.\s+ssh level0@linux\b/);
    expect(t).toContain("tutorial start");
  });

  test("help renders cross-cutting + per-track sections", async ({ page }) => {
    await dispatchCmd(page, "help");
    const t = await terminalText(page);
    expect(t).toContain("OPEN-SOURCE INTEL");
    expect(t).toContain("CLOUD SECURITY");
    expect(t).toContain("head <file>");
    expect(t).toContain("tail <file>");
    expect(t).toContain("stat <file>");
    expect(t).toMatch(/ps\s+–\s+list running processes/);
    expect(t).toContain("diff <file1>");
    expect(t).toContain("jwt <token>");
    expect(t).toContain("sha256sum <file>");
    expect(t).toContain("md5sum <file>");
    expect(t).toContain("evtx [-id N] <file>");
    expect(t).toContain("github <user>[/repo]");
    expect(t).toContain("psql [-d <db>]");
  });

  test("commands without args print usage strings", async ({ page }) => {
    const usageProbes = [
      ["head",         "Usage: head"],
      ["tail",         "Usage: tail"],
      ["stat",         "Usage: stat"],
      ["diff",         "Usage: diff"],
      ["jwt",          "Usage: jwt"],
      ["sha256sum",    "Usage: sha256sum"],
      ["md5sum",       "Usage: md5sum"],
      ["evtx",         "Usage: evtx"],
      ["github",       "Usage: github"],
      ["psql",         "Usage: psql"],
      ["sherlock",     "Usage: sherlock"],
      ["hibp",         "Usage: hibp"],
      ["wayback",      "Usage: wayback"],
      ["crtsh",        "Usage: crtsh"],
      ["theharvester", "Usage: theharvester"],
      ["shodan",       "Usage: shodan"],
      ["ipinfo",       "Usage: ipinfo"],
    ];
    for (const [cmd, expected] of usageProbes) {
      await dispatchCmd(page, cmd);
      const t = await terminalText(page);
      expect(t, `${cmd} should print usage`).toContain(expected);
    }
  });

  test("ps prints graceful empty-state at the lobby", async ({ page }) => {
    // `ps` is the one new command without a usage string — it prints
    // an empty-state message when level.processes is undefined.
    await dispatchCmd(page, "ps");
    const t = await terminalText(page);
    expect(t).toContain("no processes visible");
  });

  test("v1.6.0 SYSTEM INSPECTION commands degrade gracefully at the lobby", async ({ page }) => {
    const sysInspectProbes = [
      ["crontab -l",                "no crontab for"],
      ["last",                      "wtmp begins (no recorded logins)"],
      ["who",                       "(no active sessions)"],
      ["lsof",                      "(no open files visible"],
      ["ss",                        "(no sockets visible"],
      ["journalctl",                "No entries"],
      ["systemctl status anything", "could not be found"],
      ["dmesg",                     "ring buffer empty"],
    ];
    for (const [cmd, expected] of sysInspectProbes) {
      await dispatchCmd(page, cmd);
      const t = await terminalText(page);
      expect(t, `${cmd.split(" ")[0]} graceful at lobby`).toContain(expected);
    }
  });

  test("crontab without -l prints usage", async ({ page }) => {
    await dispatchCmd(page, "crontab");
    const t = await terminalText(page);
    expect(t).toContain("Usage: crontab -l");
  });

  test("systemctl without subcommand prints usage", async ({ page }) => {
    await dispatchCmd(page, "systemctl");
    const t = await terminalText(page);
    expect(t).toContain("Usage: systemctl status");
  });

  test("v1.7.0 NETWORK / FORMAT / PATH commands at lobby", async ({ page }) => {
    const v17Probes = [
      ["ip",                                  "Usage: ip {addr|route}"],
      ["ip addr",                             "lo:"],                          // auto-injected loopback
      ["ip route",                            "(routing table empty)"],
      ["arp -a",                              "(arp cache empty)"],
      ["ping example.com",                    "Name or service not known"],
      ["traceroute example.com",              "Name or service not known"],
      ["nslookup example.com",                "NXDOMAIN"],
      ["openssl",                             "Usage: openssl"],
      ["openssl x509 -text -noout -in foo",   "No such file or directory"],
      ["tar",                                 "Usage: tar"],
      ["tar tvf nonexistent.tar",             "Cannot open"],
      ["gunzip nonexistent.gz",               "No such file or directory"],
      ["zcat nonexistent.gz",                 "No such file or directory"],
    ];
    for (const [cmd, expected] of v17Probes) {
      await dispatchCmd(page, cmd);
      const t = await terminalText(page);
      expect(t, `${cmd}`).toContain(expected);
    }
  });
});
