// Headless playthrough of the D3CYPH3R demo level.
//
// Verifies engine + level0 behavior end-to-end. Skips assertions that
// race with intentional async UI transitions (lobby render clears the
// terminal, etc.) — those would need their own race-tolerant approach.

const { chromium } = require("playwright");

async function typeAndEnter(page, text) {
  await page.locator("#cmd-input").focus();
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(80);
}

async function termText(page) {
  return page.locator("#terminal").innerText();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errors = [];
  page.on("pageerror",  e => errors.push("[pageerror] "  + e.message));
  page.on("console",    m => { if (m.type() === "error") errors.push("[console.error] " + m.text()); });
  page.on("requestfailed", r => errors.push("[requestfailed] " + r.url() + " " + r.failure().errorText));

  const baseUrl = process.env.D3CYPH3R_URL || "http://localhost:8000/";
  await page.goto(baseUrl);
  await page.waitForTimeout(1200);

  let pass = 0, fail = 0;
  const check = (name, cond) => {
    if (cond) { console.log("✓", name); pass++; }
    else      { console.log("✗", name); fail++; }
  };

  let t = await termText(page);
  check("Lobby AVAILABLE ENGAGEMENTS rendered",         t.includes("AVAILABLE ENGAGEMENTS"));
  check("Lobby shows Driftwood welcome on first visit", t.includes("WELCOME TO DRIFTWOOD SYSTEMS"));
  check("Lobby lists Linux track",                      t.includes("ssh level0@linux"));
  check("Lobby lists Network track",                    t.includes("ssh level0@network"));
  check("Lobby lists Crypto track",                     t.includes("ssh level0@crypto"));
  check("Lobby lists Web track",                        t.includes("ssh level0@web"));
  check("Lobby lists Forensics track",                  t.includes("ssh level0@forensics"));
  check("Lobby lists OSINT track",                      t.includes("ssh level0@osint"));
  check("Lobby lists Cloud track",                      t.includes("ssh level0@cloud"));
  check("Lobby shows no scaffolded-only tracks (all 7 have levels)", !t.includes("(no levels yet)"));

  // ── Engine command-surface smoke test ─────────────────────────────
  // Exercise every new command from the lobby (where no level data
  // exists) and confirm it returns its usage string / graceful empty
  // state rather than crashing. Catches wiring regressions before any
  // level uses these commands in anger.

  await typeAndEnter(page, "help");
  t = await termText(page);
  check("help renders OSINT section",       t.includes("OPEN-SOURCE INTEL"));
  check("help renders CLOUD section",       t.includes("CLOUD SECURITY"));
  check("help lists `head` (linux util)",   t.includes("head <file>"));
  check("help lists `tail` (linux util)",   t.includes("tail <file>"));
  check("help lists `stat` (linux util)",   t.includes("stat <file>"));
  check("help lists `ps`  (linux util)",    /ps\s+–\s+list running processes/.test(t));
  check("help lists `diff` (linux util)",   t.includes("diff <file1>"));
  check("help lists `jwt` (crypto)",        t.includes("jwt <token>"));
  check("help lists `sha256sum` (forensics)", t.includes("sha256sum <file>"));
  check("help lists `md5sum` (forensics)",  t.includes("md5sum <file>"));
  check("help lists `evtx` (forensics)",    t.includes("evtx [-id N] <file>"));
  check("help lists `github` (osint)",      t.includes("github <user>[/repo]"));
  check("help lists `psql` (cloud)",        t.includes("psql [-d <db>]"));

  // Each new command with no args should print a usage string (or for
  // `ps`, a graceful empty-state). These calls happen from the lobby
  // where level.processes / level.cloud / level.sherlockResults / etc.
  // are all undefined; the smoke test verifies graceful handling.
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
    await typeAndEnter(page, cmd);
    t = await termText(page);
    check(`${cmd} prints usage when called with no args`, t.includes(expected));
  }

  // `ps` is the one new command without a usage string — it prints a
  // graceful empty-state message when level.processes is undefined.
  await typeAndEnter(page, "ps");
  t = await termText(page);
  check("ps prints empty-state when no level.processes is set", t.includes("no processes visible"));

  // `aws` (no args) prints its own multi-service usage block.
  await typeAndEnter(page, "aws");
  t = await termText(page);
  check("aws prints multi-service usage when called with no args", t.includes("usage: aws") && t.includes("Available services"));

  // `aws s3 ls` with no level.cloud data prints the graceful empty
  // bucket-list message (not a crash).
  await typeAndEnter(page, "aws s3 ls");
  t = await termText(page);
  check("aws s3 ls degrades gracefully when no level.cloud data exists", t.includes("no buckets visible"));

  // `jwt` against a real-looking test token (the IETF / jwt.io standard
  // sample) should actually decode — no level data required.
  await typeAndEnter(page, "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  t = await termText(page);
  check("jwt actually decodes a valid token (alg in header)",   /"alg":\s*"HS256"/.test(t));
  check("jwt actually decodes a valid token (sub in payload)",  /"sub":\s*"1234567890"/.test(t));
  check("jwt actually decodes a valid token (name in payload)", t.includes("John Doe"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@linux", t.includes("Connected: level0@linux"));
  check("Objective references Daniel", t.includes("Daniel"));
  check("Lesson mentions Driftwood",   t.includes("Driftwood"));
  check("Lesson mentions Halton Bank", t.includes("Halton"));
  check("Prompt host updated to linux", (await page.locator("#prompt-host").innerText()) === "linux");
  check("Prompt user shows in-world identity 'daniel'", (await page.locator("#prompt-user").innerText()) === "daniel");

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "handoff.md", "tasks.md", "notes.txt", "creds.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }
  check("ls does NOT show hidden .bash_history", !t.includes(".bash_history"));

  await typeAndEnter(page, "ls -a");
  t = await termText(page);
  check("ls -a shows hidden .bash_history", t.includes(".bash_history"));
  check("ls -a shows the seeded .notes symlink",     t.includes(".notes"));

  // v1.5.0 symlink behavior — `.notes` is a symlink → notes.txt.
  await typeAndEnter(page, "ls -la");
  t = await termText(page);
  check("ls -la renders symlink with lrwxrwxrwx mode", /lrwxrwxrwx.*\.notes -> notes\.txt/.test(t));

  await typeAndEnter(page, "readlink .notes");
  t = await termText(page);
  check("readlink .notes prints the literal target",  /^\s*notes\.txt\s*$/m.test(t.split("readlink .notes")[1] || ""));

  await typeAndEnter(page, "readlink notes.txt");
  t = await termText(page);
  check("readlink on a non-symlink prints 'Invalid argument'", t.includes("readlink: notes.txt: Invalid argument"));

  await typeAndEnter(page, "readlink nonexistent-file");
  t = await termText(page);
  check("readlink on missing file prints 'No such file or directory'", t.includes("readlink: nonexistent-file: No such file or directory"));

  await typeAndEnter(page, "realpath .notes");
  t = await termText(page);
  check("realpath .notes resolves to /home/daniel/notes.txt", t.includes("/home/daniel/notes.txt"));

  await typeAndEnter(page, "realpath notes.txt");
  t = await termText(page);
  check("realpath on regular file prints absolute path", /\/home\/daniel\/notes\.txt/.test(t.split("realpath notes.txt").slice(-1)[0] || ""));

  await typeAndEnter(page, "cat .notes");
  t = await termText(page);
  check("cat .notes reads through symlink to notes.txt content", /Halton|notes|TODO/i.test(t.split("cat .notes")[1] || ""));

  await typeAndEnter(page, "cat creds.txt");
  t = await termText(page);
  check("cat creds.txt reveals 'please-rotate-me'", t.includes("please-rotate-me"));
  check("creds.txt mentions Halton MSA",             t.includes("MSA with Halton"));
  check("creds.txt cites CWE-798",                   t.includes("CWE-798"));

  await page.locator("#cmd-input").focus();
  await page.keyboard.type("wh");
  await page.waitForTimeout(80);
  check("Tab hint suggests 'oami' for 'wh'", (await page.locator("#tab-hint").innerText()) === "oami");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(80);
  check("Tab fills input to 'whoami'", (await page.locator("#cmd-input").inputValue()) === "whoami");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(80);
  t = await termText(page);
  check("whoami prints in-world identity 'daniel'", /\bdaniel\b/.test(t));

  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(80);
  check("ArrowUp recalls 'whoami'", (await page.locator("#cmd-input").inputValue()) === "whoami");
  await page.locator("#cmd-input").fill("");

  await typeAndEnter(page, "clear");
  t = await termText(page);
  check("clear empties the terminal", t.trim() === "");

  await typeAndEnter(page, "definitelynotacommand");
  t = await termText(page);
  check("Unknown command shows 'command not found'", t.includes("command not found"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  await page.locator("#cmd-input").focus();
  await page.keyboard.type("exit");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const midTransition = await termText(page);
  check("exit prints 'Connection ... closed'", midTransition.includes("Connection to level0@linux closed"));
  await page.waitForTimeout(500);
  check("exit returns prompt host to d3cyph3r", (await page.locator("#prompt-host").innerText()) === "d3cyph3r");
  t = await termText(page);
  check("exit re-renders lobby engagements",  t.includes("AVAILABLE ENGAGEMENTS"));

  await typeAndEnter(page, "exit");
  t = await termText(page);
  check("exit at lobby prints 'Already at the lobby'", t.includes("Already at the lobby"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "logout");
  await page.waitForTimeout(500);
  check("logout alias also returns to lobby", (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — Halton jumphost (permissions puzzle) ──────────────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password prints 'Permission denied, please try again.'", t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "please-rotate-me");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@linux",          t.includes("Connected: level1@linux"));
  check("Prompt host updated to linux on level1",              (await page.locator("#prompt-host").innerText()) === "linux");
  check("Prompt user shows in-world identity app_admin",       (await page.locator("#prompt-user").innerText()) === "app_admin");
  check("Objective references the production credential",      t.includes("production"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  check("ls shows backup.sh",              t.includes("backup.sh"));
  check("ls shows staging-worker.env",     /\bstaging-worker\.env\b/.test(t));
  check("ls shows staging-worker.env.bak", t.includes("staging-worker.env.bak"));

  await typeAndEnter(page, "ls -la");
  t = await termText(page);
  check("ls -la shows restrictive perms (-rw-------)", t.includes("-rw-------"));
  check("ls -la shows loose perms (-rw-r--r--)",       t.includes("-rw-r--r--"));
  check("ls -la shows root root on staging-worker.env", /root\s+root\s+\d+\s+staging-worker\.env\b/.test(t));

  await typeAndEnter(page, "cat staging-worker.env");
  t = await termText(page);
  check("cat on root-mode-600 file returns Permission denied",
        t.includes("cat: staging-worker.env: Permission denied"));

  await typeAndEnter(page, "cat staging-worker.env.bak");
  t = await termText(page);
  check("cat on mode-644 backup reveals DB_PROD_PASS=Halton-2024-Q3!",
        t.includes("DB_PROD_PASS=Halton-2024-Q3!"));

  await typeAndEnter(page, "cat handoff.md");
  t = await termText(page);
  check("handoff.md mentions Priya (recurring character)", t.includes("Priya"));
  check("handoff.md cites the November incident",          t.includes("November"));

  await typeAndEnter(page, "cat .bash_history");
  t = await termText(page);
  check(".bash_history shows the sudo cp smoking gun",
        t.includes("sudo cp /etc/systemd/system/staging-worker.service.d/override.conf"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints in-world identity 'app_admin'", /\bapp_admin\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1 returns to lobby", (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Atlas Health perimeter check (network track) ──────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@network");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@network",                                t.includes("Connected: level0@network"));
  check("Prompt host updated to 'network'",                           (await page.locator("#prompt-host").innerText()) === "network");
  check("Prompt user shows in-world identity 'secops'",               (await page.locator("#prompt-user").innerText()) === "secops");
  check("Objective references Atlas Health",                          t.includes("Atlas Health"));
  check("Lesson mentions Marcus (new recurring character)",           t.includes("Marcus"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "atlas-perimeter.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "nmap staging.atlas.health");
  t = await termText(page);
  check("nmap on staging reveals open 5432/postgresql",               /5432\/tcp\s+open\s+postgresql/.test(t));

  await typeAndEnter(page, "nmap -sV staging.atlas.health");
  t = await termText(page);
  check("nmap -sV reveals PostgreSQL 13.11",                          t.includes("PostgreSQL 13.11"));

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md leaks default cred breadcrumb",          t.includes("atlas-default-2025"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'secops' on the audit workstation",            /\bsecops\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@network returns to lobby",                  (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — Atlas internal DNS (zone-transfer puzzle) ─────────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@network");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@network prints 'Permission denied'", t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@network");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "atlas-default-2025");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@network",                t.includes("Connected: level1@network"));
  check("Prompt host stays 'network' on level1",                      (await page.locator("#prompt-host").innerText()) === "network");
  check("Prompt user shows in-world identity 'dbadmin'",              (await page.locator("#prompt-user").innerText()) === "dbadmin");
  check("Objective references blast-radius / Marcus's team",          t.includes("blast radius") || t.includes("Marcus"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "priya-note.md", "atlas-internal.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "dig atlas.internal AXFR");
  t = await termText(page);
  check("AXFR dump reveals prod-db internal hostname",                t.includes("prod-db.atlas.internal"));
  check("AXFR dump reveals PHI-tier host (phi-warehouse)",            t.includes("phi-warehouse.atlas.internal"));
  check("AXFR dump reveals the 'audit-bypass' shadow hostname",       t.includes("audit-bypass.atlas.internal"));
  check("AXFR TXT record leaks level2 breadcrumb credential",         t.includes("atlas-audit-bypass-2026"));
  check("AXFR footer prints standard zone-transfer XFR-size summary", t.includes("XFR size:"));

  await typeAndEnter(page, "dig nonexistent.example AXFR");
  t = await termText(page);
  check("AXFR against a domain without records returns NXDOMAIN-style error",
        t.includes("NXDOMAIN") || t.includes("REFUSED"));

  await typeAndEnter(page, "cat priya-note.md");
  t = await termText(page);
  check("priya-note.md mentions Priya (continuity)",                  t.includes("Priya"));
  check("priya-note.md states rules-of-engagement",                   t.toLowerCase().includes("rules of engagement"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'dbadmin' on the Atlas staging-db host",       /\bdbadmin\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@network returns to lobby",                  (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Theo's Safer API Key (crypto track) ───────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@crypto");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@crypto",                                 t.includes("Connected: level0@crypto"));
  check("Prompt host updated to 'crypto'",                            (await page.locator("#prompt-host").innerText()) === "crypto");
  check("Prompt user shows in-world identity 'secops'",               (await page.locator("#prompt-user").innerText()) === "secops");
  check("Objective references Vesta Retail",                          t.includes("Vesta Retail"));
  check("Lesson mentions Theo (new recurring character)",             t.includes("Theo"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "deploy.sh", "api-key.b64", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "base64 api-key.b64");
  t = await termText(page);
  check("base64 api-key.b64 decodes to the Vesta API key",            t.includes("vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3"));

  await typeAndEnter(page, "base64 -d dmVzdGFfcGtfbGl2ZV9IeEs0blA5cVIydlQ4WXdCbUM1ZEUz");
  t = await termText(page);
  check("base64 -d <string> also works for direct decoding",          /vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3/.test(t));

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md mentions Saanvi (Vesta CTO)",            t.includes("Saanvi"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites PCI-DSS Requirement 3.5",           t.includes("PCI-DSS") && t.includes("3.5"));
  check("lessons-learned.md cites CWE-261 (Weak Encoding for Password)", t.includes("CWE-261"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@crypto returns to lobby",                   (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — Theo's Signature That Wasn't (crypto track) ────────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@crypto");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@crypto prints 'Permission denied'", t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@crypto");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@crypto",                 t.includes("Connected: level1@crypto"));
  check("Prompt host stays 'crypto' on level1",                       (await page.locator("#prompt-host").innerText()) === "crypto");
  check("Prompt user shows in-world identity 'vesta-deploy'",         (await page.locator("#prompt-user").innerText()) === "vesta-deploy");
  check("Objective references Vesta admin API JWT auth",              t.includes("JWT") || t.includes("token"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "priya-note.md", "verify-middleware.js", "admin-access.log", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  // Extract the JWT from the log and decode it via the jwt command.
  await typeAndEnter(page, "cat admin-access.log");
  t = await termText(page);
  check("admin-access.log carries the alg:none JWT header",           t.includes("eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0"));

  // The full JWT is long; the test injects it directly rather than
  // copy-pasting from the rendered terminal output.
  const algNoneJwt = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJ2ZXN0YS1hZG1pbi1zdmMiLCJzdWIiOiJhZG1pbi1zdmMtZGVwbG95IiwiYXVkIjoidmVzdGEtYWRtaW4tYXBpIiwiaWF0IjoxNzc1NzIyNDQwLCJleHAiOjIwOTEzNDE2NDAsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiKiIsImFjdG9yIjoidGhlb0B2ZXN0YS5leGFtcGxlIiwiaGFuZG9mZl90b2tlbiI6InZlc3RhLWFkbWluLWhhbmRvZmYtMjAyNiJ9.";
  await typeAndEnter(page, "jwt " + algNoneJwt);
  t = await termText(page);
  check("jwt decoder prints the alg:none red flag",                   t.includes("alg: 'none'") || t.includes('alg: "none"'));
  check("jwt decoder flags the empty signature",                      t.includes("Signature is empty"));
  check("jwt decoded payload reveals the level2 breadcrumb",          t.includes("vesta-admin-handoff-2026"));
  check("jwt decoded payload shows role=admin claim",                 t.includes("\"role\": \"admin\""));

  await typeAndEnter(page, "cat verify-middleware.js");
  t = await termText(page);
  check("verify-middleware.js shows jwt.verify without algorithms whitelist",
        /jwt\.verify\(token,\s*SIGNING_SECRET\)/.test(t));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'vesta-deploy' on Vesta's deploy host",        /\bvesta-deploy\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@crypto returns to lobby",                   (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Meridian's Forgotten Backup Folder (web track) ────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@web");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@web",                                    t.includes("Connected: level0@web"));
  check("Prompt host updated to 'web'",                               (await page.locator("#prompt-host").innerText()) === "web");
  check("Prompt user shows in-world identity 'secops'",               (await page.locator("#prompt-user").innerText()) === "secops");
  check("Objective references Meridian State University",             t.includes("Meridian State University"));
  check("Lesson mentions Carlos (new recurring character)",           t.includes("Carlos"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "meridian-scope.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "gobuster https://www.meridian.edu");
  t = await termText(page);
  check("gobuster reveals /backup as Status 200",                     /\/backup\s+\(Status: 200\)/.test(t));
  check("gobuster shows /admin properly gated as 401",                /\/admin\s+\(Status: 401\)/.test(t));

  await typeAndEnter(page, "curl https://www.meridian.edu/backup/");
  t = await termText(page);
  check("curl on /backup/ shows the autoindex listing",               t.includes("Index of /backup"));
  check("autoindex lists the student-records CSV",                    t.includes("students_export_2023.csv"));
  check("autoindex lists the leaked DB credential note",              t.includes("db-creds.txt"));

  await typeAndEnter(page, "curl https://www.meridian.edu/backup/students_export_2023.csv");
  t = await termText(page);
  check("CSV exposes student PII (FERPA finding)",                    t.includes("patel.a@meridian.edu") && /3\.91/.test(t));
  check("CSV is truncated with the 4,217-records hint",               t.includes("4,217 records"));

  await typeAndEnter(page, "curl https://www.meridian.edu/backup/db-creds.txt");
  t = await termText(page);
  check("db-creds.txt leaks the M3rid14n!2023-prod credential",       t.includes("M3rid14n!2023-prod"));

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md cites FERPA as compliance regime",       t.includes("FERPA"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites CWE-548 (Directory Listing)",       t.includes("CWE-548"));
  check("lessons-learned.md cites OWASP A05 Security Misconfiguration", t.includes("A05") && t.includes("Misconfiguration"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@web returns to lobby",                      (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — Carlos's Login Wall (web track, IDOR) ──────────────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@web");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@web prints 'Permission denied'",    t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@web");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "M3rid14n!2023-prod");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@web",                    t.includes("Connected: level1@web"));
  check("Prompt host stays 'web' on level1",                          (await page.locator("#prompt-host").innerText()) === "web");
  check("Prompt user shows in-world identity 'webapp_admin'",         (await page.locator("#prompt-user").innerText()) === "webapp_admin");
  check("Objective references the transcript audit",                  /transcript/i.test(t));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "priya-note.md", "transcript-api.js", "session.txt", "id-conventions.md", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "cat transcript-api.js");
  t = await termText(page);
  check("transcript-api.js shows the SSO require",                    t.includes("requireMeridianSSO"));
  check("transcript-api.js reads student_id from req.query (the bug)", /req\.query\.student_id/.test(t));

  await typeAndEnter(page, "cookies https://portal.meridian.edu");
  t = await termText(page);
  check("cookies surfaces the MeridianSSO session cookie",            t.includes("MeridianSSO"));

  // Curl two real-student transcript IDs from level0's CSV — both return
  // valid transcripts, demonstrating the IDOR (the SSO middleware passes
  // any authenticated request through regardless of student_id owner).
  await typeAndEnter(page, "curl 'https://portal.meridian.edu/api/transcript?student_id=M-1872941'");
  t = await termText(page);
  check("IDOR: curl on Aisha's student_id returns her transcript",    t.includes("Aisha") && t.includes("patel.a@meridian.edu"));

  await typeAndEnter(page, "curl 'https://portal.meridian.edu/api/transcript?student_id=M-1873041'");
  t = await termText(page);
  check("IDOR: curl on Jordan's student_id returns his transcript",   t.includes("Jordan") && /Academic Probation/.test(t));

  // The BluePier demo M-0000001 carries the level2 breadcrumb in its
  // advisor_notes field. Confirms IDOR extends to legacy system accounts.
  await typeAndEnter(page, "curl 'https://portal.meridian.edu/api/transcript?student_id=M-0000001'");
  t = await termText(page);
  check("IDOR extends to legacy system accounts (BLUEPIER DEMO)",     t.includes("BLUEPIER DEMO ACCOUNT"));
  check("Demo account's advisor_notes carries level2 breadcrumb cred", t.includes("meridian-portal-svc-2026"));

  // 404 case proves the API differentiates found-vs-not (so prior
  // responses were genuine database hits, not generic stubs).
  await typeAndEnter(page, "curl 'https://portal.meridian.edu/api/transcript?student_id=M-9999999'");
  t = await termText(page);
  check("Unknown student_id returns a clean 404 not-found",           t.includes("\"error\":\"not found\""));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'webapp_admin' on Meridian's portal host",     /\bwebapp_admin\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@web returns to lobby",                      (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Reed's Soccer Alibi (forensics track) ─────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@forensics");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@forensics",                              t.includes("Connected: level0@forensics"));
  check("Prompt host updated to 'forensics'",                         (await page.locator("#prompt-host").innerText()) === "forensics");
  check("Prompt user shows in-world identity 'secops'",               (await page.locator("#prompt-user").innerText()) === "secops");
  check("Objective references Polaris Defense Systems",               t.includes("Polaris"));
  check("Lesson mentions Dana (new recurring character)",             t.includes("Dana"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "case-summary.txt", "soccer-field.jpg", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "file soccer-field.jpg");
  t = await termText(page);
  check("file soccer-field.jpg identifies as JPEG with EXIF",         /soccer-field\.jpg.*JPEG image data.*EXIF/.test(t));

  await typeAndEnter(page, "exif soccer-field.jpg");
  t = await termText(page);
  check("exif reveals DateTimeOriginal of 2025:07:18 (NOT March 2026)", t.includes("2025:07:18"));
  check("exif reveals GPS coordinates in Key Largo, Florida",         t.includes("25.0865") && t.includes("80.4473"));
  check("exif identifies the device as iPhone 14 Pro",                t.includes("iPhone 14 Pro"));

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md cites CMMC Level 2",                     t.includes("CMMC Level 2"));
  check("engagement-notes.md cites NIST 800-171",                     t.includes("NIST SP 800-171") || t.includes("NIST 800-171"));

  await typeAndEnter(page, "cat case-summary.txt");
  t = await termText(page);
  check("case-summary.txt leaks level1@forensics breadcrumb password", t.includes("POL-IIS-2026-0007-handoff"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites NIST SP 800-86 (Forensics Guide)",  t.includes("800-86"));
  check("lessons-learned.md cites CWE-200 (Info Exposure)",           t.includes("CWE-200"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@forensics returns to lobby",                (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — What the Logs Saw (forensics track, evtx) ──────────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@forensics");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@forensics prints 'Permission denied'", t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@forensics");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "POL-IIS-2026-0007-handoff");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@forensics",              t.includes("Connected: level1@forensics"));
  check("Prompt host stays 'forensics' on level1",                    (await page.locator("#prompt-host").innerText()) === "forensics");
  check("Prompt user stays 'secops' on level1@forensics",             (await page.locator("#prompt-user").innerText()) === "secops");
  check("Objective references event-log triage",                      /event log/i.test(t) || /Security event/i.test(t));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "case-summary.txt", "Security.evtx", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "file Security.evtx");
  t = await termText(page);
  check("file Security.evtx identifies as Microsoft Windows Event Log", t.includes("Microsoft Windows Event Log"));

  // evtx -h prints usage with the five common Security-channel IDs.
  await typeAndEnter(page, "evtx -h");
  t = await termText(page);
  check("evtx -h prints usage with Event ID reference",               t.includes("4624") && t.includes("4625") && t.includes("4688"));

  // Full dump confirms all 16 events parse cleanly.
  await typeAndEnter(page, "evtx Security.evtx");
  t = await termText(page);
  check("evtx dump shows total event count of 16",                    t.includes("Total events: 16"));
  check("evtx dump shows Reed's interactive logon (4624)",            t.includes("rconnolly"));
  check("evtx dump shows the IR jumpbox source IP",                   t.includes("10.42.7.18"));

  // Filter to 4625 — the smoking gun: one event, with the typed
  // password leaked into TargetUserName.
  await typeAndEnter(page, "evtx -id 4625 Security.evtx");
  t = await termText(page);
  check("evtx -id 4625 filters to a single match",                    t.includes("filtered to ID 4625: 1 match"));
  check("4625 event reveals SubStatus 0xC0000064 (no such user)",     t.includes("0xC0000064"));
  check("4625 TargetUserName field carries level2 breadcrumb cred",   t.includes("P0l4r1s-IR-L3ad-2026!"));

  // Filter to 4688 — Reed's exfil chain (PowerShell + certutil + chrome).
  await typeAndEnter(page, "evtx -id 4688 Security.evtx");
  t = await termText(page);
  check("4688 events include PowerShell Compress-Archive cmdline",    t.includes("Compress-Archive"));
  check("4688 events include certutil -encode (LOLBin pattern)",      t.includes("certutil.exe -encode"));
  check("4688 events include chrome upload to mega.nz",               t.includes("mega.nz/upload"));

  // Filter to 4663 — Reed's CUI reads from D:\CUI\Subsystem-A\.
  await typeAndEnter(page, "evtx -id 4663 Security.evtx");
  t = await termText(page);
  check("4663 events show Reed reading the CUI schematic",            t.includes("subsystem-a-schematics.pdf"));
  check("4663 events show Reed reading the CUI BOM spreadsheet",      t.includes("subsystem-a-bom.xlsx"));

  // Filter for a non-existent Event ID returns the empty-state message.
  await typeAndEnter(page, "evtx -id 9999 Security.evtx");
  t = await termText(page);
  check("evtx -id 9999 returns graceful empty-state",                 t.includes("no events with Event ID 9999"));

  await typeAndEnter(page, "cat case-summary.txt");
  t = await termText(page);
  check("case-summary.txt cites the FTK Imager acquisition tool",     t.includes("FTK Imager"));
  check("case-summary.txt cites the EnCase E01 split image format",   t.includes("E01 split"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites CWE-532 (Sensitive Info in Log)",   t.includes("CWE-532"));
  check("lessons-learned.md cites NIST SP 800-53 AU family",          t.includes("AU-2") || t.includes("AU-6"));
  check("lessons-learned.md cites MITRE T1078 (Valid Accounts)",      t.includes("T1078"));
  check("lessons-learned.md cites MITRE T1567.002 (Cloud Exfil)",     t.includes("T1567.002"));
  check("lessons-learned.md cites the LOLBAS project",                t.includes("LOLBAS"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'secops' on the forensics workstation",        /\bsecops\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@forensics returns to lobby",                (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Veridian's Open Letter (OSINT track) ──────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@osint");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@osint",                                  t.includes("Connected: level0@osint"));
  check("Prompt host updated to 'osint'",                             (await page.locator("#prompt-host").innerText()) === "osint");
  check("Prompt user shows in-world identity 'intel'",                (await page.locator("#prompt-user").innerText()) === "intel");
  check("Objective references Veridian (client)",                     t.includes("Veridian"));
  check("Objective references Dr. Aaron Hines (subject)",             t.includes("Aaron Hines"));
  check("Lesson mentions Marisol (new recurring character)",          t.includes("Marisol"));
  check("Lesson mentions HIPAA (compliance regime)",                  t.includes("HIPAA"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "subject-brief.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md cites HIPAA Security Rule",              t.includes("HIPAA Security Rule"));
  check("engagement-notes.md cites HITRUST CSF (overlay framework)",  t.includes("HITRUST"));

  await typeAndEnter(page, "cat subject-brief.txt");
  t = await termText(page);
  check("subject-brief.txt provides personal email for HIBP lookup",  t.includes("aaron.hines.md@gmail.com"));
  check("subject-brief.txt scopes Veridian work email OUT",           t.includes("OUT OF SCOPE"));

  await typeAndEnter(page, "hibp aaron.hines.md@gmail.com");
  t = await termText(page);
  check("hibp returns LinkedIn 2012 breach hit",                      t.includes("LinkedIn (2012)"));
  check("hibp returns Adobe 2013 breach hit",                         t.includes("Adobe (2013)"));
  check("hibp returns LiveJournal 2014 breach hit",                   t.includes("LiveJournal"));
  check("hibp surfaces cleartext password (LinkedIn cracked corpus)", t.includes("BostonStrong#2013"));
  check("hibp flags CONFIRMED REUSE across two breaches",             t.includes("CONFIRMED REUSE"));

  // Verify the out-of-scope guard: Aaron's WORK email should produce
  // the graceful "no breaches found" message, not a configured hit.
  // (Per Marisol's scope: only the personal email was authorized.)
  await typeAndEnter(page, "hibp ahines@veridian-analytics.com");
  t = await termText(page);
  check("hibp returns 'no breaches found' for un-configured work email",
        /no breaches found for 'ahines@veridian-analytics\.com'/.test(t));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites NIST SP 800-63B (breach-list screening)", t.includes("800-63B"));
  check("lessons-learned.md cites CWE-521 (Weak Password Requirements)",    t.includes("CWE-521"));
  check("lessons-learned.md cites T1110.004 (Credential Stuffing)",         t.includes("T1110.004"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@osint returns to lobby",                    (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — Aaron's Weekend Project (osint, github OSINT) ──────
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@osint");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@osint prints 'Permission denied'",  t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@osint");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "BostonStrong#2013");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@osint",                  t.includes("Connected: level1@osint"));
  check("Prompt host stays 'osint' on level1",                        (await page.locator("#prompt-host").innerText()) === "osint");
  check("Prompt user stays 'intel' on level1@osint",                  (await page.locator("#prompt-user").innerText()) === "intel");
  check("Objective references the developer footprint task",          /developer footprint/i.test(t) || /github/i.test(t));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "subject-update.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  // sherlock confirms Aaron's GitHub handle is reachable.
  await typeAndEnter(page, "sherlock aaron-hines-md");
  t = await termText(page);
  check("sherlock shows Aaron's GitHub profile URL",                  t.includes("github.com/aaron-hines-md"));
  check("sherlock shows Aaron's Strava profile URL",                  t.includes("strava.com/athletes/aaron-hines-md"));

  // github -h prints usage with all three forms.
  await typeAndEnter(page, "github -h");
  t = await termText(page);
  check("github -h prints usage with all three forms",                t.includes("github <user>") && t.includes("file <path>"));

  // github profile lookup — 4 public repos.
  await typeAndEnter(page, "github aaron-hines-md");
  t = await termText(page);
  check("github profile shows Aaron's name",                          t.includes("Aaron Hines, MD"));
  check("github profile shows Boston location",                       t.includes("Boston, MA"));
  check("github profile lists personal-pgx-tool repo",                t.includes("personal-pgx-tool"));
  check("github profile lists marathon-pacer-log decoy",              t.includes("marathon-pacer-log"));
  check("github profile lists pgx-residency-notes decoy",             t.includes("pgx-residency-notes"));
  check("github profile lists dotfiles decoy",                        t.includes("dotfiles"));

  // github repo metadata + file tree — .env visible in spite of being gitignored.
  await typeAndEnter(page, "github aaron-hines-md/personal-pgx-tool");
  t = await termText(page);
  check("github repo metadata shows MIT license",                     t.includes("License: MIT"));
  check("github repo file tree includes .env (committed before .gitignore)", t.includes(".env"));
  check("github repo file tree includes app.py",                      t.includes("app.py"));
  check("github repo file tree includes src/pgx_lookup.py",           t.includes("src/pgx_lookup.py"));

  // The smoking gun — .env contents include the AWS secret.
  await typeAndEnter(page, "github aaron-hines-md/personal-pgx-tool file .env");
  t = await termText(page);
  check(".env shows the OpenFDA personal API key",                    t.includes("OPENFDA_API_KEY=oFDA-aaron-personal-2023"));
  check(".env shows the AWS_ACCESS_KEY_ID",                           t.includes("AWS_ACCESS_KEY_ID=AKIAVDS3IAARONHINES23"));
  check(".env reveals the level2 breadcrumb (AWS secret)",            t.includes("AaronHinesMD/Pers0nal+AWS/2024+BrightBlu"));
  check(".env shows the S3 cache bucket name",                        t.includes("ahines-pgx-cache"));

  // .gitignore listing .env is the ironic detail (drives the lesson).
  await typeAndEnter(page, "github aaron-hines-md/personal-pgx-tool file .gitignore");
  t = await termText(page);
  check(".gitignore lists .env (added AFTER the first commit)",       /^\.env$/m.test(t));

  // Read a decoy repo to confirm those are also enumerable but innocuous.
  await typeAndEnter(page, "github aaron-hines-md/marathon-pacer-log file README.md");
  t = await termText(page);
  check("marathon-pacer-log README mentions Boston Marathon",         t.includes("Boston Marathon"));

  // Unknown user / repo / file return graceful error messages.
  await typeAndEnter(page, "github nonexistent-user");
  t = await termText(page);
  check("github on unknown user returns graceful 'no profile' error", t.includes("no GitHub profile for 'nonexistent-user'"));

  await typeAndEnter(page, "github aaron-hines-md/nonexistent-repo");
  t = await termText(page);
  check("github on unknown repo returns graceful 'not found' error",  t.includes("repository 'aaron-hines-md/nonexistent-repo' not found"));

  await typeAndEnter(page, "github aaron-hines-md/personal-pgx-tool file nonexistent.py");
  t = await termText(page);
  check("github file on unknown path returns graceful 'not found' error", t.includes("file 'nonexistent.py' not found"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites CWE-798 (Hard-Coded Credentials)",  t.includes("CWE-798"));
  check("lessons-learned.md cites CWE-540 (Sensitive Info in Source)",t.includes("CWE-540"));
  check("lessons-learned.md cites NIST SP 800-218 SSDF",              t.includes("800-218"));
  check("lessons-learned.md cites MITRE T1593.003 (Code Repositories)", t.includes("T1593.003"));
  check("lessons-learned.md cites MITRE T1552.001 (Credentials In Files)", t.includes("T1552.001"));
  check("lessons-learned.md cites TruffleHog (defender tooling)",     t.includes("TruffleHog"));
  check("lessons-learned.md cites GitHub Secret Scanning",            t.includes("Secret Scanning"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'intel' on the OSINT workstation",             /\bintel\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@osint returns to lobby",                    (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 0 — Coverline's Twelfth Bucket (cloud track) ──────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@cloud");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@cloud",                                  t.includes("Connected: level0@cloud"));
  check("Prompt host updated to 'cloud'",                             (await page.locator("#prompt-host").innerText()) === "cloud");
  check("Prompt user shows in-world identity 'cloudsec'",             (await page.locator("#prompt-user").innerText()) === "cloudsec");
  check("Objective references Coverline (client)",                    t.includes("Coverline"));
  check("Lesson mentions Jordan (new recurring character)",           t.includes("Jordan"));
  check("Lesson mentions SOC 2 (compliance regime)",                  t.includes("SOC 2"));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "audit-worksheet.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  await typeAndEnter(page, "cat engagement-notes.md");
  t = await termText(page);
  check("engagement-notes.md mentions Priya (continuity)",            t.includes("Priya"));
  check("engagement-notes.md cites SOC 2 Type II",                    t.includes("SOC 2 Type II"));
  check("engagement-notes.md cites NAIC Insurance Data Security",     t.includes("NAIC"));
  check("engagement-notes.md cites NYDFS 23 NYCRR 500",               t.includes("NYDFS"));

  await typeAndEnter(page, "cat audit-worksheet.txt");
  t = await termText(page);
  check("audit-worksheet.txt lists all 6 buckets in scope",
        t.includes("coverline-static-assets") &&
        t.includes("coverline-backups-prod") &&
        t.includes("coverline-marketing-public") &&
        t.includes("coverline-terraform-state") &&
        t.includes("coverline-customer-exports") &&
        t.includes("coverline-claims-uploads-prod"));
  check("audit-worksheet.txt flags marketing bucket as intentionally PUBLIC", /coverline-marketing-public\s+PUBLIC/.test(t));

  // Walk the worksheet. The locked-down buckets should all return
  // AccessDenied (the "correct" response for a private bucket).
  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-static-assets");
  t = await termText(page);
  check("static-assets bucket returns AccessDenied (correct)",        /An error occurred \(AccessDenied\)/.test(t));

  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-backups-prod");
  t = await termText(page);
  check("backups-prod bucket returns AccessDenied (correct)",         /An error occurred \(AccessDenied\)/.test(t));

  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-terraform-state");
  t = await termText(page);
  check("terraform-state bucket returns AccessDenied (correct)",      /An error occurred \(AccessDenied\)/.test(t));

  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-customer-exports");
  t = await termText(page);
  check("customer-exports bucket returns AccessDenied (correct)",     /An error occurred \(AccessDenied\)/.test(t));

  // The marketing bucket is intentionally public — should list brochures.
  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-marketing-public");
  t = await termText(page);
  check("marketing bucket lists brochure PDFs (expected public)",     t.includes("brochures/coverline-overview-2024.pdf"));
  check("marketing bucket lists partner-kit assets",                  t.includes("partner-kits/coverline-affiliate-deck-2024.pdf"));

  // THE FIND — claims bucket should list (it shouldn't be public).
  await typeAndEnter(page, "aws s3 ls --no-sign-request s3://coverline-claims-uploads-prod");
  t = await termText(page);
  check("claims-uploads bucket UNEXPECTEDLY lists (the finding)",     t.includes("2024-Q1-claims/claim-cl-019823.json"));
  check("claims-uploads bucket lists the stale migration script",     t.includes("legacy-deploy/migrate-rds.sh"));
  check("claims-uploads bucket lists the SQL dump artifact",          t.includes("legacy-migration-snapshot/coverline_claims.dump"));

  // Read a claim file and the migration script for the credential.
  await typeAndEnter(page, "aws s3 cp s3://coverline-claims-uploads-prod/2024-Q1-claims/claim-cl-019823.json -");
  t = await termText(page);
  check("claim JSON exposes claimant PII (name)",                     t.includes("Marcus") && t.includes("Reyes"));
  check("claim JSON exposes masked SSN (NPI under GLBA / NAIC)",      /XXX-XX-\d{4}/.test(t));
  check("claim JSON exposes residential address (PII)",               t.includes("Bridgeport") && t.includes("06604"));

  await typeAndEnter(page, "aws s3 cp s3://coverline-claims-uploads-prod/legacy-deploy/migrate-rds.sh -");
  t = await termText(page);
  check("migration script leaks RDS host (cloud topology data)",      t.includes("coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com"));
  check("migration script leaks level1@cloud breadcrumb password",    t.includes("Cl41ms-Pr0d-M4st3r-2024"));

  // Verify the engine's GetObject AccessDenied path also fires on
  // locked-down buckets (defense-in-depth — the engine doesn't let
  // a player bypass the ls denial by going straight to cp).
  await typeAndEnter(page, "aws s3 cp s3://coverline-backups-prod/some-key -");
  t = await termText(page);
  check("aws s3 cp on a denied bucket also returns AccessDenied",     /An error occurred \(AccessDenied\) when calling the GetObject/.test(t));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites SOC 2 CC6.1 (the audit control)",   t.includes("CC6.1"));
  check("lessons-learned.md cites CWE-200 (Info Exposure)",           t.includes("CWE-200"));
  check("lessons-learned.md cites CWE-798 (Hard-Coded Credentials)",  t.includes("CWE-798"));
  check("lessons-learned.md cites MITRE T1530 (Cloud Storage Object)",t.includes("T1530"));
  check("lessons-learned.md cites CIS AWS Foundations Benchmark",     t.includes("CIS AWS Foundations Benchmark"));
  check("lessons-learned.md cites AWS Block Public Access remediation", t.includes("Block Public Access"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@cloud returns to lobby",                    (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── Level 1 — The Migration Table Nobody Dropped (cloud, psql) ───
  // Wrong password first to confirm the gate works.
  await typeAndEnter(page, "ssh level1@cloud");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "wrong-password");
  await page.waitForTimeout(200);
  t = await termText(page);
  check("Wrong password on level1@cloud prints 'Permission denied'",  t.includes("Permission denied, please try again."));

  await typeAndEnter(page, "ssh level1@cloud");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "Cl41ms-Pr0d-M4st3r-2024");
  await page.waitForTimeout(600);
  t = await termText(page);
  check("Correct password connects to level1@cloud",                  t.includes("Connected: level1@cloud"));
  check("Prompt host stays 'cloud' on level1",                        (await page.locator("#prompt-host").innerText()) === "cloud");
  check("Prompt user stays 'cloudsec' on level1@cloud",               (await page.locator("#prompt-user").innerText()) === "cloudsec");
  check("Objective references DB enumeration",                        /enumerate|database|psql/i.test(t));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "engagement-notes.md", "bastion-handoff.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }

  // psql --version returns a version string.
  await typeAndEnter(page, "psql --version");
  t = await termText(page);
  check("psql --version returns a PostgreSQL version string",         t.includes("PostgreSQL"));

  // \l lists databases (Coverline's two DBs + 3 system DBs).
  await typeAndEnter(page, "psql \"\\l\"");
  t = await termText(page);
  check("psql \\l lists the coverline_claims database",               t.includes("coverline_claims"));
  check("psql \\l lists the coverline_billing database",              t.includes("coverline_billing"));
  check("psql \\l shows the system DBs (template0/template1)",        t.includes("template0") && t.includes("template1"));

  // \dt against coverline_claims shows the 7 tables.
  await typeAndEnter(page, "psql -d coverline_claims \"\\dt\"");
  t = await termText(page);
  for (const tbl of ["claims", "customers", "policies", "adjusters", "integrations", "migration_artifacts", "users", "audit_log"]) {
    check(`psql \\dt lists table ${tbl}`, t.includes(tbl));
  }

  // Read the integrations table — proves Coverline uses Secrets Manager.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM integrations\"");
  t = await termText(page);
  check("integrations table shows Secrets Manager pointer pattern",   t.includes("secrets-manager:broker-portal-prod"));
  check("integrations table shows the NAIC data-exchange integration",t.includes("naic-data-exchange"));

  // THE SMOKING GUN — the migration_artifacts table has the broker-portal credential.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM migration_artifacts\"");
  t = await termText(page);
  check("migration_artifacts table shows all 3 rows",                 t.includes("(3 rows)"));
  check("migration_artifacts row 1: rds-migration-runner credential", t.includes("rds-mig-2024-svc-Tmp9pQ7rT"));
  check("migration_artifacts row 2: broker-portal cred (level2 breadcrumb)", t.includes("Cv-BrokerSvc-Pr0d-2024-Migration"));
  check("migration_artifacts row 3: NAIC SFTP (properly rotated)",    t.includes("naic-handoff-2024-Q1-7Kp9"));

  // The users table reveals the dormant vikram.shah account.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM users\"");
  t = await termText(page);
  check("users table includes terminated vikram.shah",                t.includes("vikram.shah") && t.includes("terminated"));
  check("users table shows the coverline_admin rds_master row",       t.includes("coverline_admin") && t.includes("rds_master"));

  // The audit_log has the anomalous schema_query entry.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM audit_log\"");
  t = await termText(page);
  check("audit_log shows the 2026-05-20 anomalous schema query",      t.includes("schema_query_pg_catalog") && t.includes("2026-05-20"));
  check("audit_log labels the actor as unrecognized source",          t.includes("unrecognized source"));

  // SELECT with LIMIT.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM claims LIMIT 2\"");
  t = await termText(page);
  check("SELECT LIMIT 2 returns exactly 2 rows",                      t.includes("(2 rows)"));

  // Graceful error: unknown table.
  await typeAndEnter(page, "psql -d coverline_claims \"SELECT * FROM nonexistent_table\"");
  t = await termText(page);
  check("psql on unknown table returns graceful 'does not exist'",    t.includes('relation "nonexistent_table" does not exist'));

  // Graceful error: unknown database.
  await typeAndEnter(page, "psql -d nonexistent_db \"\\dt\"");
  t = await termText(page);
  check("psql on unknown database returns graceful FATAL message",    t.includes('database "nonexistent_db" does not exist'));

  // Graceful error: unsupported DML (read-only enforcement).
  await typeAndEnter(page, "psql -d coverline_claims \"DELETE FROM claims\"");
  t = await termText(page);
  check("psql refuses DML (DELETE) with helpful error",               t.includes("SELECT and meta-commands only"));

  await typeAndEnter(page, "cat lessons-learned.md");
  t = await termText(page);
  check("lessons-learned.md cites CWE-798 (Hard-Coded Credentials)",  t.includes("CWE-798"));
  check("lessons-learned.md cites CWE-540 (Sensitive Info in Source)",t.includes("CWE-540"));
  check("lessons-learned.md cites NIST SP 800-53 IA-5(7)",            t.includes("IA-5(7)"));
  check("lessons-learned.md cites MITRE T1078 (Valid Accounts)",      t.includes("T1078"));
  check("lessons-learned.md cites MITRE T1213 (Info Repositories)",   t.includes("T1213"));
  check("lessons-learned.md cites MITRE T1552.001",                   t.includes("T1552.001"));
  check("lessons-learned.md cites SOC 2 CC6.2 (System User Mgmt)",    t.includes("CC6.2"));
  check("lessons-learned.md cites NAIC §6 (72-hour clock)",           t.includes("NAIC") && t.includes("72"));
  check("lessons-learned.md cites NYDFS 500.07 + 500.17",             t.includes("500.07") && t.includes("500.17"));
  check("lessons-learned.md cites GLBA Safeguards 314.5",             t.includes("314.5"));
  check("lessons-learned.md cites AWS Secrets Manager remediation",   t.includes("Secrets Manager"));
  check("lessons-learned.md cites Database Activity Streams",         t.includes("Database Activity Streams"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'cloudsec' on the bastion",                    /\bcloudsec\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@cloud returns to lobby",                    (await page.locator("#prompt-host").innerText()) === "d3cyph3r");

  // ── v1.3.0 shell-realism features (paths / globs / pipes / vars) ──
  // These tests run against level0@linux, which has the largest
  // file set (welcome.md, handoff.md, tasks.md, notes.txt, creds.txt,
  // lessons-learned.md, plus hidden .bash_history). We exit back to
  // the lobby at the end for the system-command tests.
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);

  // Path resolution
  await typeAndEnter(page, "pwd");
  t = await termText(page);
  check("pwd prints /home/daniel",                                    /\/home\/daniel\s*$/m.test(t));

  await typeAndEnter(page, "cd /home/daniel");
  await typeAndEnter(page, "pwd");
  t = await termText(page);
  check("cd to absolute /home/<user> resolves to home",               /\/home\/daniel\s*$/m.test(t));

  await typeAndEnter(page, "cd ~");
  await typeAndEnter(page, "pwd");
  t = await termText(page);
  check("cd ~ resolves to home root",                                 /\/home\/daniel\s*$/m.test(t));

  await typeAndEnter(page, "cd ../../..");
  t = await termText(page);
  check("cd ../../.. from home prints 'already at home directory'",   t.includes("already at home directory"));

  await typeAndEnter(page, "cd /etc");
  t = await termText(page);
  check("cd /etc (outside sandbox) prints 'No such file or directory'", t.includes("cd: /etc: No such file or directory"));

  // Wildcards
  await typeAndEnter(page, "ls *.md");
  t = await termText(page);
  check("ls *.md expands glob and lists welcome.md",                  t.includes("welcome.md"));
  check("ls *.md expands glob and lists handoff.md",                  t.includes("handoff.md"));
  check("ls *.md expands glob and lists tasks.md",                    t.includes("tasks.md"));
  check("ls *.md does NOT include creds.txt (no .md extension)",      !/\bcreds\.txt\b/.test(t.split("ls *.md")[1] || ""));

  await typeAndEnter(page, "cat *.txt");
  t = await termText(page);
  check("cat *.txt concatenates notes.txt + creds.txt",               t.includes("please-rotate-me") && /Halton/.test(t));

  await typeAndEnter(page, "ls *.nope");
  t = await termText(page);
  check("ls *.nope (no match) leaves pattern literal in error",       t.includes("ls: cannot access '*.nope'"));

  // Shell variable expansion
  await typeAndEnter(page, "echo $USER");
  t = await termText(page);
  check("echo $USER expands to 'daniel'",                             /\bdaniel\b/.test(t.split("echo $USER")[1] || ""));

  await typeAndEnter(page, "echo $HOME");
  t = await termText(page);
  check("echo $HOME expands to /home/daniel",                         t.split("echo $HOME")[1]?.includes("/home/daniel"));

  await typeAndEnter(page, "echo $HOSTNAME");
  t = await termText(page);
  check("echo $HOSTNAME expands to 'linux'",                          /\blinux\b/.test(t.split("echo $HOSTNAME")[1] || ""));

  await typeAndEnter(page, "echo ${USER}@${HOSTNAME}");
  t = await termText(page);
  check("echo ${USER}@${HOSTNAME} expands both (bracketed form)",     t.includes("daniel@linux"));

  await typeAndEnter(page, "echo $$");
  t = await termText(page);
  check("echo $$ escapes to literal $",                               /\$\s*$/m.test(t.split("echo $$")[1] || ""));

  await typeAndEnter(page, "cat $HOME/welcome.md");
  t = await termText(page);
  check("cat $HOME/welcome.md resolves via var + absolute path",      t.includes("welcome") || t.includes("Welcome"));

  // Pipes
  await typeAndEnter(page, "cat welcome.md | wc -l");
  t = await termText(page);
  check("cat | wc -l counts lines",                                   /\d+\s+welcome\.md|^\s*\d+\s*$/m.test(t.split("cat welcome.md | wc -l")[1] || ""));

  await typeAndEnter(page, "cat creds.txt | grep please");
  t = await termText(page);
  check("cat | grep filters lines from stdin",                        t.includes("please-rotate-me"));

  await typeAndEnter(page, "ls | wc -l");
  t = await termText(page);
  check("ls | wc -l counts visible files (no -a)",                    /\d/.test(t.split("ls | wc -l")[1] || ""));

  await typeAndEnter(page, "echo hello | tr a-z A-Z");
  t = await termText(page);
  check("echo hello | tr a-z A-Z prints HELLO",                       t.includes("HELLO"));

  await typeAndEnter(page, "ls | sort -r");
  t = await termText(page);
  // Just confirm it didn't error; the actual ordering of `ls` (space-separated)
  // depends on the implementation. We mainly want no crash.
  check("ls | sort -r runs without crash",                            !t.includes("command not found") && !t.includes("error"));

  // Multi-stage pipe
  await typeAndEnter(page, "cat welcome.md | grep -v ^ | wc -l");
  t = await termText(page);
  // grep -v isn't implemented; this is intentionally probing that
  // the pipe stages execute (even if grep -v just matches lines
  // containing "-v"). The point is the multi-stage pipe doesn't crash.
  check("Multi-stage pipe runs without crash",                        !t.includes("command not found"));

  // Tab autocomplete: path completion for `cat we<Tab>` → welcome.md
  await page.locator("#cmd-input").focus();
  await page.keyboard.type("cat we");
  await page.waitForTimeout(80);
  check("Path autocomplete suggests 'lcome.md' for 'cat we'",         (await page.locator("#tab-hint").innerText()) === "lcome.md");
  await page.locator("#cmd-input").fill("");

  // Exit back to lobby for system-command tests.
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);

  // System commands (test from the lobby)
  await typeAndEnter(page, "which ls");
  t = await termText(page);
  check("which ls returns /usr/bin/ls",                               t.includes("/usr/bin/ls"));

  await typeAndEnter(page, "which nope-asdf");
  t = await termText(page);
  check("which on unknown command prints 'not found'",                t.includes("nope-asdf: command not found"));

  await typeAndEnter(page, "type cat");
  t = await termText(page);
  check("type cat prints 'is a shell builtin'",                       t.includes("cat is a shell builtin"));

  await typeAndEnter(page, "id");
  t = await termText(page);
  check("id prints uid=1000(guest)",                                  /uid=1000\(guest\)/.test(t));
  check("id prints groups=",                                          /groups=/.test(t));

  await typeAndEnter(page, "uname");
  t = await termText(page);
  check("uname prints 'Linux'",                                       /\bLinux\b/.test(t.split("uname")[1] || ""));

  await typeAndEnter(page, "uname -a");
  t = await termText(page);
  check("uname -a prints kernel release",                             t.includes("d3cyph3r"));

  await typeAndEnter(page, "hostname");
  t = await termText(page);
  check("hostname prints 'd3cyph3r' at lobby",                        /\bd3cyph3r\b/.test(t.split("hostname")[1] || ""));

  await typeAndEnter(page, "date");
  t = await termText(page);
  check("date prints day-of-week + month",                            /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/.test(t));

  await typeAndEnter(page, "uptime");
  t = await termText(page);
  check("uptime prints 'up' + 'load average'",                        t.includes("up") && t.includes("load average"));

  // Text-processing commands (smoke test via stdin)
  await typeAndEnter(page, "echo hello world | wc -w");
  t = await termText(page);
  check("echo | wc -w counts 2 words",                                /\b2\b/.test(t.split("echo hello world | wc -w")[1] || ""));

  await typeAndEnter(page, "echo a:b:c | cut -d : -f 2");
  t = await termText(page);
  check("cut -d : -f 2 extracts 'b' from a:b:c",                      /\bb\b/.test(t.split("cut -d : -f 2")[1] || ""));

  // ── v1.4.0 learning aids + awk ────────────────────────────────────
  // hint at lobby: graceful — no level to give hints for.
  await typeAndEnter(page, "hint");
  t = await termText(page);
  check("hint at lobby gracefully refuses",                           t.includes("ssh into a level first"));

  // man <cmd> for several commands — all should be in the catalog.
  await typeAndEnter(page, "man ls");
  t = await termText(page);
  check("man ls returns NAME / SYNOPSIS / DESCRIPTION / EXAMPLES",
    t.includes("NAME") && t.includes("SYNOPSIS") && t.includes("DESCRIPTION") && t.includes("EXAMPLES"));
  check("man ls mentions long format (-l)",                           /Long format/.test(t));

  await typeAndEnter(page, "man jwt");
  t = await termText(page);
  check("man jwt covers JWT-specific red flags",                      t.includes("alg: none") || t.includes("alg: 'none'"));

  await typeAndEnter(page, "man hint");
  t = await termText(page);
  check("man hint exists (self-referential entry)",                   t.includes("nudge for the current level") || t.includes("most-direct"));

  await typeAndEnter(page, "man this-command-does-not-exist");
  t = await termText(page);
  check("man on unknown command prints 'No manual entry'",            t.includes("No manual entry for this-command-does-not-exist"));

  // what-is glossary lookups.
  await typeAndEnter(page, "what-is CWE");
  t = await termText(page);
  check("what-is CWE returns the Common Weakness Enumeration entry",  t.includes("Common Weakness Enumeration"));
  check("what-is CWE mentions MITRE",                                 t.includes("MITRE"));

  await typeAndEnter(page, "what-is cwe");
  t = await termText(page);
  check("what-is is case-insensitive (cwe → CWE entry)",              t.includes("Common Weakness Enumeration"));

  await typeAndEnter(page, "what-is CWE-798");
  t = await termText(page);
  check("what-is CWE-798 returns the Hard-coded Credentials entry",   t.includes("Hard-coded Credentials"));

  await typeAndEnter(page, "what-is JWT");
  t = await termText(page);
  check("what-is JWT explains the three-segment format",              t.includes("header.payload.signature") || t.includes("three"));

  await typeAndEnter(page, "what-is FERPA");
  t = await termText(page);
  check("what-is FERPA explains student-records privacy",             t.includes("student") && t.includes("education records"));

  await typeAndEnter(page, "what-is asdfasdf-not-a-real-term");
  t = await termText(page);
  check("what-is on unknown term prints 'not in the glossary'",       t.includes("not in the glossary"));

  // awk: column extraction + pattern filtering, both file and stdin paths.
  await typeAndEnter(page, "echo hello world | awk '{print $1}'");
  t = await termText(page);
  check("awk '{print $1}' on stdin prints first field",               /\bhello\b/.test(t.split("awk '{print $1}'")[1] || ""));

  await typeAndEnter(page, "echo hello world | awk '{print $2}'");
  t = await termText(page);
  check("awk '{print $2}' on stdin prints second field",              /\bworld\b/.test(t.split("awk '{print $2}'")[1] || ""));

  await typeAndEnter(page, "echo hello world | awk '{print $1, $2}'");
  t = await termText(page);
  check("awk '{print $1, $2}' joins both fields with OFS",            /hello world/.test(t.split("awk '{print $1, $2}'")[1] || ""));

  await typeAndEnter(page, "echo a:b:c | awk -F: '{print $2}'");
  t = await termText(page);
  check("awk -F: '{print $2}' splits on colon + prints 2nd field",    /^\s*b\s*$/m.test(t.split("awk -F: '{print $2}'")[1] || ""));

  await typeAndEnter(page, "echo hello | awk '/h/ {print $1}'");
  t = await termText(page);
  check("awk '/regex/ {print ...}' fires on matching lines",          /\bhello\b/.test(t.split("awk '/h/")[1] || ""));

  // hint command — verify progression in level0@linux (which we seeded with 3 hints).
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);

  await typeAndEnter(page, "hint reset");  // ensure we start at hint 1
  t = await termText(page);
  check("hint reset returns to the first hint",                       t.includes("[hint 1/3]"));

  await typeAndEnter(page, "hint");
  t = await termText(page);
  check("hint advances to hint 2 after the first call",               t.includes("[hint 2/3]"));

  await typeAndEnter(page, "hint");
  t = await termText(page);
  check("hint advances to hint 3 (the most-direct one)",              t.includes("[hint 3/3]"));
  check("hint 3 names creds.txt (the smoking gun)",                   /creds\.txt/.test(t.split("[hint 3/3]")[1] || ""));

  await typeAndEnter(page, "hint");
  t = await termText(page);
  check("hint past the end falls back to walkthrough pointer",        t.includes("walkthroughs"));

  await typeAndEnter(page, "hint list");
  t = await termText(page);
  check("hint list reports 3 hints available",                        /3 hints available/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);

  check("No page errors raised", errors.length === 0);
  if (errors.length) errors.forEach(e => console.log("  ", e));

  console.log(`\n${pass}/${pass + fail} checks passed`);

  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
