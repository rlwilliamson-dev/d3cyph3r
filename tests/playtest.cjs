// Headless playthrough of the D3CYPH3R demo level.
//
// Verifies engine + level0 behavior end-to-end. Skips assertions that
// race with intentional async UI transitions (lobby render clears the
// terminal, etc.) — those would need their own race-tolerant approach.

const { chromium } = require("playwright");

async function promptText(page) {
  return await page.locator("#prompt-label").innerText();
}

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

  // v1.12.0 — first-visit guided tour. Annotated FIRST STEPS list
  // should print in the welcome banner the very first time the player
  // hits the lobby, alongside the existing WELCOME TO DRIFTWOOD
  // SYSTEMS / FIRST ASSIGNMENT sections.
  check("v1.12.0 FIRST STEPS header in first-visit banner", t.includes("FIRST STEPS"));
  check("v1.12.0 FIRST STEPS lists 'help' as step 1",       /1\.\s+help\b/.test(t));
  check("v1.12.0 FIRST STEPS lists 'tracks' as step 2",     /2\.\s+tracks\b/.test(t));
  check("v1.12.0 FIRST STEPS lists 'tiers' as step 3",      /3\.\s+tiers\b/.test(t));
  check("v1.12.0 FIRST STEPS lists 'progress' as step 4",   /4\.\s+progress\b/.test(t));
  check("v1.12.0 FIRST STEPS lists 'ssh level0@linux' as step 5", /5\.\s+ssh level0@linux\b/.test(t));
  check("v1.12.0 FIRST STEPS mentions 'tutorial start' for hand-held option",
        t.includes("tutorial start"));

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

  // v1.6.0 SYSTEM INSPECTION smoke tests — every command should
  // degrade to a graceful empty-state message when called from the
  // lobby (which has no system-inspection data).
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
    await typeAndEnter(page, cmd);
    t = await termText(page);
    check(`${cmd.split(" ")[0]} degrades gracefully at the lobby`, t.includes(expected));
  }

  // `crontab` with no flag prints usage (not a graceful empty-state).
  await typeAndEnter(page, "crontab");
  t = await termText(page);
  check("crontab without -l prints usage", t.includes("Usage: crontab -l"));

  // `systemctl` without a subcommand prints usage.
  await typeAndEnter(page, "systemctl");
  t = await termText(page);
  check("systemctl without subcommand prints usage", t.includes("Usage: systemctl status"));

  // v1.7.0 NETWORK / FORMAT / PATH smoke tests at lobby (no level data).
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
    await typeAndEnter(page, cmd);
    t = await termText(page);
    check(`${cmd} → '${expected}'`, t.includes(expected));
  }

  // ── v1.8.0 shell composition + commands ──────────────────────────
  // Shell composition: && / || / ; + quoting + $(...) + $?
  await typeAndEnter(page, "echo a && echo b");
  t = await termText(page);
  check("&&: both commands run when first succeeds",                /\ba\b[\s\S]*\bb\b/.test(t.split("echo a && echo b")[1] || ""));

  await typeAndEnter(page, "echo 'hello world'");
  t = await termText(page);
  check("single-quoted args preserve internal spaces",              /hello world/.test(t.split("echo 'hello world'")[1] || ""));

  await typeAndEnter(page, "echo \"user: $(whoami)\"");
  t = await termText(page);
  check("command substitution $(whoami) expands inside double-quotes", t.includes("user: guest"));

  await typeAndEnter(page, "echo {a,b,c}.txt");
  t = await termText(page);
  check("brace expansion produces 3 entries",                       /a\.txt b\.txt c\.txt/.test(t.split("echo {a,b,c}.txt")[1] || ""));

  await typeAndEnter(page, "echo 'has $USER'");
  t = await termText(page);
  // After the echo of the typed command, the output line should be "has $USER".
  // Check that "has $USER" appears more than once in the terminal (once in the
  // command echo, once in the output) and that "has guest" never appears.
  check("single-quoted $USER does NOT expand",                      (t.match(/has \$USER/g) || []).length >= 2 && !t.includes("has guest"));

  // git: lobby has no level.gitRepos
  await typeAndEnter(page, "git log");
  t = await termText(page);
  check("git outside a repo prints 'not a git repository'",         t.includes("not a git repository"));

  // jq: usage probe
  await typeAndEnter(page, "jq");
  t = await termText(page);
  check("jq with no args prints usage",                             t.includes("Usage: jq"));

  // jq from stdin
  await typeAndEnter(page, "echo '{\"a\":1}' | jq .a");
  t = await termText(page);
  check("jq .a on stdin JSON returns the value",                    /^\s*1\s*$/m.test(t.split("jq .a")[1] || ""));

  // gpg: --list-keys with no level data
  await typeAndEnter(page, "gpg --list-keys");
  t = await termText(page);
  check("gpg --list-keys with no data prints '(no keys)'",          t.includes("(no keys)"));

  // openssl extensions
  await typeAndEnter(page, "openssl rand -hex 8");
  t = await termText(page);
  check("openssl rand -hex 8 prints 16 hex chars",                  /[0-9a-f]{16}/.test(t.split("openssl rand -hex 8")[1] || ""));

  // printf
  await typeAndEnter(page, "printf 'host=%s\\n' atlas");
  t = await termText(page);
  check("printf %s substitutes the arg",                            /host=atlas/.test(t.split("printf 'host=")[1] || ""));

  // sed via pipe
  await typeAndEnter(page, "echo hello | sed 's/hello/world/'");
  t = await termText(page);
  check("sed substitutes pattern on stdin",                         /\bworld\b/.test(t.split("sed 's/hello/world/'")[1] || ""));

  // nc / host — should degrade gracefully at lobby
  await typeAndEnter(page, "nc -zv example.com 443");
  t = await termText(page);
  check("nc on unconfigured target: 'Connection refused'",          t.includes("Connection refused"));

  await typeAndEnter(page, "host example.com");
  t = await termText(page);
  check("host on unknown name: NXDOMAIN",                           t.includes("NXDOMAIN"));

  // df / du / free
  await typeAndEnter(page, "df -h");
  t = await termText(page);
  check("df on lobby: graceful empty-state",                        t.includes("disk-usage data unavailable"));

  await typeAndEnter(page, "free -h");
  t = await termText(page);
  check("free on lobby: graceful empty-state",                      t.includes("memory usage data unavailable"));

  // Read-only-fs stubs
  await typeAndEnter(page, "chmod 600 foo");
  t = await termText(page);
  check("chmod returns 'Read-only file system'",                    t.includes("Read-only file system"));

  await typeAndEnter(page, "rm important.txt");
  t = await termText(page);
  check("rm returns 'Read-only file system'",                       t.includes("Read-only file system"));

  await typeAndEnter(page, "sudo cat /etc/shadow");
  t = await termText(page);
  check("sudo prints 'incorrect password attempt'",                 t.includes("incorrect password attempt"));

  // walkthrough at lobby → graceful refusal
  await typeAndEnter(page, "walkthrough");
  t = await termText(page);
  check("walkthrough at lobby: 'ssh into a level first'",           t.includes("ssh into a level first"));

  // search with no visits
  await typeAndEnter(page, "search foo");
  t = await termText(page);
  check("search with no visited levels prompts to visit one",       t.includes("visit at least one level"));

  // basename / dirname — pure string ops, work everywhere.
  await typeAndEnter(page, "basename /home/daniel/notes.txt");
  t = await termText(page);
  check("basename strips dir portion",                    /\bnotes\.txt\b/.test(t.split("basename /home/daniel/notes.txt")[1] || ""));

  await typeAndEnter(page, "basename /home/daniel/notes.txt .txt");
  t = await termText(page);
  check("basename strips trailing suffix",                /\bnotes\b/.test(t.split("basename /home/daniel/notes.txt .txt")[1] || ""));

  await typeAndEnter(page, "dirname /home/daniel/notes.txt");
  t = await termText(page);
  check("dirname returns the parent path",                /\/home\/daniel/.test(t.split("dirname /home/daniel/notes.txt")[1] || ""));

  await typeAndEnter(page, "dirname justafile.txt");
  t = await termText(page);
  check("dirname on a bare filename returns '.'",         /^\s*\.\s*$/m.test(t.split("dirname justafile.txt")[1] || ""));

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
  check("Connection banner shows computed Tier (v1.10.0)", t.includes("Tier: Routine"));
  check("Connection banner shows Est. time",               t.includes("Est. time: ~10 min"));
  check("Objective references Daniel", t.includes("Daniel"));
  check("Lesson mentions Driftwood",   t.includes("Driftwood"));
  check("Lesson mentions Halton Bank", t.includes("Halton"));
  check("Prompt host updated to linux", (await promptText(page)).includes("@linux:"));
  check("Prompt user shows in-world identity 'daniel'", (await promptText(page)).startsWith("daniel@"));

  // v1.11.0 — opt-in persistence prompt fires once per session after
  // the first successful non-lobby connect. Verify it appeared with
  // its privacy-posture copy, then dismiss it ('n' = skip) so the
  // rest of the playtest types normal commands instead of having
  // them swallowed by the consent handler. (A dedicated v1.11.0 test
  // block later in this file exercises the opt-IN path and the
  // save-on/save-off/reset subcommands.)
  check("Persistence prompt fires on first connect (v1.11.0)", t.includes("Save your progress across browser sessions?"));
  check("Persistence prompt names localStorage privacy posture",  t.includes("Never sent to a"));
  check("Persistence prompt offers a y/N choice",                 t.includes("[y/N]"));
  await typeAndEnter(page, "n");
  await page.waitForTimeout(100);
  t = await termText(page);
  check("Persistence prompt dismiss-with-n prints sessionStorage reminder", t.includes("Progress stays in this tab only"));

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
  // Far from any command — confirm v1.15.0 did-you-mean does NOT
  // false-positive on nonsense input. 22 chars is well outside the
  // distance-2 ceiling for any registered command.
  check("v1.15.0 long nonsense gets NO 'Did you mean' suggestion",
        !/definitelynotacommand[\s\S]*?Did you mean/.test(t));

  // ── v1.15.0 — Did-you-mean typo suggestions ───────────────────────
  // Conservative thresholds (≤1 for typed length ≤3, ≤2 for length
  // 4+), case-insensitive match against COMMANDS keys + 'ssh'.
  await typeAndEnter(page, "lss");
  t = await termText(page);
  check("v1.15.0 'lss' suggests 'ls'",      t.includes("Did you mean: ls?"));

  await typeAndEnter(page, "catt");
  t = await termText(page);
  check("v1.15.0 'catt' suggests 'cat'",    t.includes("Did you mean: cat?"));

  await typeAndEnter(page, "sshh");
  t = await termText(page);
  check("v1.15.0 'sshh' suggests 'ssh' (ssh is in candidate pool)",
        t.includes("Did you mean: ssh?"));

  // Pure case-mismatch: confirm the lowercase tip fires so we don't
  // print a confusing "did you mean: ls?" when the player essentially
  // typed `ls` but capitalized.
  await typeAndEnter(page, "clear");
  await typeAndEnter(page, "LS");
  t = await termText(page);
  check("v1.15.0 'LS' suggests 'ls' with lowercase tip",
        t.includes("Did you mean: ls?") && t.includes("command names are lowercase"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  await page.locator("#cmd-input").focus();
  await page.keyboard.type("exit");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  const midTransition = await termText(page);
  check("exit prints 'Connection ... closed'", midTransition.includes("Connection to level0@linux closed"));
  await page.waitForTimeout(500);
  check("exit returns prompt host to d3cyph3r", (await promptText(page)).includes("@d3cyph3r:"));
  t = await termText(page);
  check("exit re-renders lobby engagements",  t.includes("AVAILABLE ENGAGEMENTS"));

  await typeAndEnter(page, "exit");
  t = await termText(page);
  check("exit at lobby prints 'Already at the lobby'", t.includes("Already at the lobby"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "logout");
  await page.waitForTimeout(500);
  check("logout alias also returns to lobby", (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host updated to linux on level1",              (await promptText(page)).includes("@linux:"));
  check("Prompt user shows in-world identity app_admin",       (await promptText(page)).startsWith("app_admin@"));
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

  // v1.6.0 SYSTEM INSPECTION — exercise each command against the
  // demo data seeded on level1@linux. These tests double as
  // regression coverage for the format strings and the per-field
  // schema lookups.
  await typeAndEnter(page, "crontab -l");
  t = await termText(page);
  check("crontab -l on app_admin prints 'no scheduled jobs' header", t.includes("no scheduled jobs"));

  await typeAndEnter(page, "crontab -l -u root");
  t = await termText(page);
  check("crontab -l -u root reveals the staging-worker healthcheck", t.includes("staging-worker-healthcheck.sh"));
  check("crontab -l -u root reveals the backup-staging cron",        t.includes("backup-staging-env.sh"));

  await typeAndEnter(page, "last");
  t = await termText(page);
  check("last shows the current app_admin session as 'still logged in'", t.includes("still logged in"));
  check("last shows the reboot pseudo-event with kernel version",       /reboot.*6\.1\.0-d3cyph3r/.test(t));
  check("last shows Daniel's prior session (continuity)",               t.includes("daniel"));

  await typeAndEnter(page, "who");
  t = await termText(page);
  check("who lists the active app_admin session from 10.0.7.42",  /app_admin.*pts\/0.*10\.0\.7\.42/.test(t));

  await typeAndEnter(page, "w");
  t = await termText(page);
  check("w prints uptime header with load average",                t.includes("load average"));
  check("w prints USER / TTY / FROM column header",                t.includes("USER") && t.includes("LOGIN@"));

  await typeAndEnter(page, "lsof -i");
  t = await termText(page);
  check("lsof -i shows sshd listening on port 22",                 /sshd.*LISTEN/.test(t));
  check("lsof -i shows postgres listening on 5432",                /postgres.*5432.*LISTEN/.test(t));

  await typeAndEnter(page, "ss -lt");
  t = await termText(page);
  check("ss -lt shows LISTEN-state TCP sockets",                   t.includes("LISTEN"));
  check("ss -lt shows sshd process info",                          t.includes("sshd"));

  await typeAndEnter(page, "journalctl -u staging-worker");
  await page.waitForTimeout(150);  // wait for the bonus-find banner to render
  t = await termText(page);
  check("journalctl -u staging-worker shows the fallback log line", t.includes("falling back to /home/app_admin/staging-worker.env.bak"));
  check("journalctl -u staging-worker shows the permission-denied error", t.includes("permission denied reading /home/app_admin/staging-worker.env"));
  // v1.9.0: this call also triggers the level1@linux bonus-find
  // "self-logged-bug" (trigger: journalctl + output contains
  // "falling back to"). First-call-only — subsequent journalctl
  // invocations in the same session won't re-print the banner
  // because the find is already marked as discovered.
  check("v1.9.0 bonus-find fires on journalctl (self-logged-bug)",   t.includes("Bonus find unlocked: Self-logged config-fallback bug"));

  await typeAndEnter(page, "systemctl status staging-worker.service");
  t = await termText(page);
  check("systemctl status renders the active glyph",               /● staging-worker\.service/.test(t));
  check("systemctl status shows the unit description",             t.includes("Halton staging-worker service"));
  check("systemctl status shows the journal-log block",            t.includes("falling back to"));

  await typeAndEnter(page, "systemctl status nonexistent-unit");
  t = await termText(page);
  check("systemctl status on unknown unit reports 'could not be found'", t.includes("could not be found"));

  await typeAndEnter(page, "dmesg");
  t = await termText(page);
  check("dmesg shows the Linux kernel version line",               /Linux version 6\.1\.0-d3cyph3r/.test(t));
  check("dmesg shows the SYN-flood warning entry",                 t.includes("Possible SYN flooding"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1 returns to lobby", (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Atlas Health perimeter check (network track) ──────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@network");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@network",                                t.includes("Connected: level0@network"));
  check("Prompt host updated to 'network'",                           (await promptText(page)).includes("@network:"));
  check("Prompt user shows in-world identity 'secops'",               (await promptText(page)).startsWith("secops@"));
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
  check("exit from level0@network returns to lobby",                  (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'network' on level1",                      (await promptText(page)).includes("@network:"));
  check("Prompt user shows in-world identity 'dbadmin'",              (await promptText(page)).startsWith("dbadmin@"));
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

  // v1.10.0 BONUS-FIND TRIGGER — cat welcome.md fires the
  // "dbadmin-shell-drift" bonus (welcome.md notes /bin/bash on the
  // vendor service account).
  await typeAndEnter(page, "cat welcome.md");
  t = await termText(page);
  check("level1@network welcome.md notes /bin/bash on dbadmin",      t.includes("/bin/bash"));

  await typeAndEnter(page, "cat priya-note.md");
  t = await termText(page);
  check("priya-note.md mentions Priya (continuity)",                  t.includes("Priya"));
  check("priya-note.md states rules-of-engagement",                   t.toLowerCase().includes("rules of engagement"));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'dbadmin' on the Atlas staging-db host",       /\bdbadmin\b/.test(t));

  // v1.7.0 NETWORK INSPECTION — exercise the new commands against
  // the demo data seeded on level1@network. The reachable hosts
  // here are the same internal-zone targets the AXFR puzzle just
  // surfaced; ping / traceroute let the player verify reachability
  // before reporting blast radius.
  await typeAndEnter(page, "ip addr");
  t = await termText(page);
  check("ip addr lists eth0 with the staging-db IPv4",                /eth0.*10\.40\.10\.5/s.test(t));
  check("ip addr auto-injects the loopback interface",                t.includes("lo:"));

  await typeAndEnter(page, "ip route");
  t = await termText(page);
  check("ip route shows the default gateway",                         /default\s+via\s+10\.40\.10\.1/.test(t));
  check("ip route shows the connected /24 subnet",                    /10\.40\.10\.0\/24/.test(t));

  await typeAndEnter(page, "arp -a");
  t = await termText(page);
  check("arp -a shows the gateway entry",                             /gateway\s+\(10\.40\.10\.1\)/.test(t));
  check("arp -a shows the staging-web host",                          t.includes("staging-web.atlas.internal"));

  await typeAndEnter(page, "ping prod-db.atlas.internal");
  t = await termText(page);
  check("ping reaches the prod-db host (4 ECHO replies)",             /icmp_seq=4 ttl=64/.test(t));
  check("ping prints the standard stats summary",                     t.includes("packets transmitted") && t.includes("rtt min/avg/max"));

  await typeAndEnter(page, "ping nonexistent.host.example");
  t = await termText(page);
  check("ping on unresolvable host prints 'Name or service not known'", t.includes("Name or service not known"));

  await typeAndEnter(page, "traceroute audit-bypass.atlas.internal");
  t = await termText(page);
  check("traceroute shows the gateway hop",                           /\s1\s+gateway\s+\(10\.40\.10\.1\)/.test(t));
  check("traceroute shows the final hop to the audit-bypass host",    /audit-bypass|deprecated-bypass-host/.test(t));

  await typeAndEnter(page, "nslookup prod-db.atlas.internal");
  t = await termText(page);
  check("nslookup resolves prod-db to its internal IP",               t.includes("10.40.20.5"));
  check("nslookup prints the resolver address line",                  t.includes("Server:") && t.includes("Address:"));

  await typeAndEnter(page, "nslookup nonexistent.host.example");
  t = await termText(page);
  check("nslookup on unknown host prints NXDOMAIN",                   t.includes("NXDOMAIN"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@network returns to lobby",                  (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Theo's Safer API Key (crypto track) ───────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@crypto");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@crypto",                                 t.includes("Connected: level0@crypto"));
  check("Prompt host updated to 'crypto'",                            (await promptText(page)).includes("@crypto:"));
  check("Prompt user shows in-world identity 'secops'",               (await promptText(page)).startsWith("secops@"));
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
  check("exit from level0@crypto returns to lobby",                   (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'crypto' on level1",                       (await promptText(page)).includes("@crypto:"));
  check("Prompt user shows in-world identity 'vesta-deploy'",         (await promptText(page)).startsWith("vesta-deploy@"));
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

  // v1.10.0 BONUS-FIND TRIGGER — cat priya-note.md fires the
  // "most-downloaded-fallacy" bonus (Priya quotes Theo's library-
  // popularity reasoning verbatim).
  await typeAndEnter(page, "cat priya-note.md");
  t = await termText(page);
  check("level1@crypto priya-note.md quotes the most-downloaded rationale",
        t.includes("most-downloaded"));

  await typeAndEnter(page, "cat verify-middleware.js");
  t = await termText(page);
  check("verify-middleware.js shows jwt.verify without algorithms whitelist",
        /jwt\.verify\(token,\s*SIGNING_SECRET\)/.test(t));

  await typeAndEnter(page, "whoami");
  t = await termText(page);
  check("whoami prints 'vesta-deploy' on Vesta's deploy host",        /\bvesta-deploy\b/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level1@crypto returns to lobby",                   (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Meridian's Forgotten Backup Folder (web track) ────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@web");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@web",                                    t.includes("Connected: level0@web"));
  check("Prompt host updated to 'web'",                               (await promptText(page)).includes("@web:"));
  check("Prompt user shows in-world identity 'secops'",               (await promptText(page)).startsWith("secops@"));
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

  // v1.10.0 BONUS-FIND TRIGGER — robots.txt is a hidden Optional
  // exploration step (curl /robots.txt while in level0@web). Fires
  // the "robots-txt-billboard" bonus.
  await typeAndEnter(page, "curl https://www.meridian.edu/robots.txt");
  t = await termText(page);
  check("level0@web: curl robots.txt surfaces /backup/ Disallow",     t.includes("Disallow: /backup/"));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);
  check("exit from level0@web returns to lobby",                      (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'web' on level1",                          (await promptText(page)).includes("@web:"));
  check("Prompt user shows in-world identity 'webapp_admin'",         (await promptText(page)).startsWith("webapp_admin@"));
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

  // v1.10.0 BONUS-FIND TRIGGER — cat session.txt fires the
  // "ten-year-session-token" bonus (the file notes the 2036 expiry
  // as itself a finding).
  await typeAndEnter(page, "cat session.txt");
  t = await termText(page);
  check("level1@web session.txt notes the long-lived session as a finding",
        t.includes("long-lived service-account"));

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
  check("exit from level1@web returns to lobby",                      (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Reed's Soccer Alibi (forensics track) ─────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@forensics");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@forensics",                              t.includes("Connected: level0@forensics"));
  check("Prompt host updated to 'forensics'",                         (await promptText(page)).includes("@forensics:"));
  check("Prompt user shows in-world identity 'secops'",               (await promptText(page)).startsWith("secops@"));
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
  check("exit from level0@forensics returns to lobby",                (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'forensics' on level1",                    (await promptText(page)).includes("@forensics:"));
  check("Prompt user stays 'secops' on level1@forensics",             (await promptText(page)).startsWith("secops@"));
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
  check("exit from level1@forensics returns to lobby",                (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Veridian's Open Letter (OSINT track) ──────────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@osint");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@osint",                                  t.includes("Connected: level0@osint"));
  check("Prompt host updated to 'osint'",                             (await promptText(page)).includes("@osint:"));
  check("Prompt user shows in-world identity 'intel'",                (await promptText(page)).startsWith("intel@"));
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
  check("exit from level0@osint returns to lobby",                    (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'osint' on level1",                        (await promptText(page)).includes("@osint:"));
  check("Prompt user stays 'intel' on level1@osint",                  (await promptText(page)).startsWith("intel@"));
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
  check("exit from level1@osint returns to lobby",                    (await promptText(page)).includes("@d3cyph3r:"));

  // ── Level 0 — Coverline's Twelfth Bucket (cloud track) ──────────
  // No password (level0 of each track is the entry point).
  await typeAndEnter(page, "ssh level0@cloud");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@cloud",                                  t.includes("Connected: level0@cloud"));
  check("Prompt host updated to 'cloud'",                             (await promptText(page)).includes("@cloud:"));
  check("Prompt user shows in-world identity 'cloudsec'",             (await promptText(page)).startsWith("cloudsec@"));
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

  // v1.10.0 BONUS-FIND TRIGGER — `aws sts get-caller-identity`
  // confirms the audit is running from Driftwood's account, not the
  // client's. Fires the "sts-identity-confirmation" bonus.
  await typeAndEnter(page, "aws sts get-caller-identity");
  t = await termText(page);
  check("aws sts get-caller-identity returns Driftwood account",      t.includes("driftwood-cloudsec-readonly"));

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
  check("exit from level0@cloud returns to lobby",                    (await promptText(page)).includes("@d3cyph3r:"));

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
  check("Prompt host stays 'cloud' on level1",                        (await promptText(page)).includes("@cloud:"));
  check("Prompt user stays 'cloudsec' on level1@cloud",               (await promptText(page)).startsWith("cloudsec@"));
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
  check("exit from level1@cloud returns to lobby",                    (await promptText(page)).includes("@d3cyph3r:"));

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

  // ──── v1.9.0: shell-environment + job control + extended flags
  //
  // env_vars + bonusFinds are seeded on level1@linux. Hop there to
  // exercise them, then come back to lobby and over to level1@network
  // for dig flag tests.

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("terminal").innerHTML = ""; });

  await typeAndEnter(page, "env");
  t = await termText(page);
  check("env lists EDITOR seeded from level.env_vars",                t.includes("EDITOR=nano"));
  check("env lists AWS_PROFILE seeded from level.env_vars",           t.includes("AWS_PROFILE=halton-staging"));
  check("env still shows built-in USER",                              /USER=app_admin/.test(t));

  await typeAndEnter(page, "export FOO=bar");
  await typeAndEnter(page, "echo $FOO");
  t = await termText(page);
  check("export FOO=bar + echo $FOO prints 'bar'",                    /\bbar\b/.test(t.split("echo $FOO")[1] || ""));

  await typeAndEnter(page, "unset FOO");
  await typeAndEnter(page, "echo before-${FOO}after");
  t = await termText(page);
  check("unset FOO removes the value (expands to empty)",             /before-after/.test(t));

  // POSIX assignment: bare FOO=bar
  await typeAndEnter(page, "X=hello");
  await typeAndEnter(page, "echo $X");
  t = await termText(page);
  check("POSIX-style X=hello assignment + echo expands",              /hello/.test(t.split("echo $X")[1] || ""));

  // PS1 customization: short prompt, then restore.
  await typeAndEnter(page, "export PS1='> '");
  const customPrompt = await promptText(page);
  check("custom PS1 renders without user@host: layout",               !customPrompt.includes("@linux:") && customPrompt.length > 0);
  await typeAndEnter(page, "unset PS1");
  const defaultPrompt = await promptText(page);
  check("unset PS1 restores the default user@host: prompt",           /@linux:/.test(defaultPrompt));

  // Job control: backgrounded echo, jobs lists it, fg replays it.
  await typeAndEnter(page, "echo hello-bg &");
  t = await termText(page);
  check("backgrounded cmd prints job header [N] NNNNN",               /\[\d+\]\s+\d+/.test(t.split("echo hello-bg &")[1] || ""));
  await typeAndEnter(page, "jobs");
  t = await termText(page);
  check("jobs lists the backgrounded entry",                          /Done.*echo hello-bg/.test(t));
  await typeAndEnter(page, "fg");
  t = await termText(page);
  check("fg replays captured output (prints hello-bg)",               /hello-bg/.test(t.split("fg")[1] || ""));
  await typeAndEnter(page, "jobs");
  t = await termText(page);
  // After fg removes the job, jobs prints nothing — confirm by
  // looking at the LATEST output block (split after `jobs` command).
  const afterFg = t.split("jobs").slice(-1)[0] || "";
  check("jobs after fg is empty",                                     !/Done|Running/.test(afterFg));

  // Bonus-find: cat backup.sh should fire the "backup-script" find.
  await typeAndEnter(page, "cat backup.sh");
  t = await termText(page);
  check("bonus-find fires on cat backup.sh",                          /Bonus find unlocked: Daniel's backup script/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  // dig extended flags — level1@network has the AXFR-rich dnsData
  // for atlas.internal (single-label TLD; AXFR contains the MX
  // record). +short answer-only output works on any populated host.
  await typeAndEnter(page, "ssh level1@network");
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("terminal").innerHTML = ""; });

  await typeAndEnter(page, "dig +short atlas.internal AXFR");
  t = await termText(page);
  check("dig +short (AXFR) returns answer-only output",               !/ANSWER SECTION/.test(t.split("dig +short")[1] || ""));

  await typeAndEnter(page, "dig @8.8.8.8 atlas.internal AXFR");
  t = await termText(page);
  // The AXFR path doesn't use the SERVER footer format, so we test
  // that the request flag at least doesn't break the lookup.
  check("dig @server still returns AXFR records",                     /SOA/.test(t.split("dig @8.8.8.8")[1] || ""));

  // dig +trace flavor — synthesizes the root → TLD → authoritative
  // walk. We assert the trace header appears.
  await typeAndEnter(page, "dig atlas.internal +trace");
  t = await termText(page);
  check("dig +trace prints root-servers + a-gtld-servers walk",       /root-servers|gtld-servers/.test(t.split("dig atlas.internal +trace")[1] || ""));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  // ──── v1.9.0: deeper command coverage (pre-merge audit)
  // Hop into level1@linux for the multi-host pivot demo + the
  // remaining shell-environment / job-control / readline shortcuts
  // that didn't get covered in the first pass.

  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("terminal").innerHTML = ""; });

  // `set` (env alias) — print mode.
  await typeAndEnter(page, "set");
  t = await termText(page);
  check("set prints env (alias) — shows USER=app_admin",              /USER=app_admin/.test(t.split("\nset\n").slice(-1)[0] || t));

  // export -p / -n forms.
  await typeAndEnter(page, "export TEMP_VAR=tmp");
  await typeAndEnter(page, "export -n TEMP_VAR");
  await typeAndEnter(page, "echo after-unexport:${TEMP_VAR}done");
  t = await termText(page);
  check("export -n acts as unset",                                    /after-unexport:done/.test(t));

  // Job control: bg %1 + kill %1 + jobs -l + wait.
  await typeAndEnter(page, "echo j1 &");
  await typeAndEnter(page, "echo j2 &");
  await typeAndEnter(page, "jobs -l");
  t = await termText(page);
  check("jobs -l prints fake PID column",                             /\[\d+\]\s+[+\- ]?\s*\d{5}/.test(t.split("jobs -l")[1] || ""));

  await typeAndEnter(page, "bg %1");
  t = await termText(page);
  check("bg %1 prints '[N]+ <cmd> &' echo",                           /\[\d+\]\+ echo j1 &/.test(t.split("bg %1")[1] || ""));

  await typeAndEnter(page, "kill %2");
  await typeAndEnter(page, "jobs");
  t = await termText(page);
  const afterKill = t.split("jobs").slice(-1)[0] || "";
  check("kill %2 removes job 2; only job 1 remains",                  /echo j1/.test(afterKill) && !/echo j2/.test(afterKill));

  await typeAndEnter(page, "disown");
  await typeAndEnter(page, "jobs");
  t = await termText(page);
  check("disown (no args) clears the job table",                      !/echo j[12]/.test(t.split("disown").slice(-1)[0] || ""));

  // wait is a no-op (everything synchronous).
  await typeAndEnter(page, "wait");
  // No assertion beyond "doesn't throw" — covered by the No-page-
  // errors check at the bottom.

  // kill with unknown PID prints "No such process".
  await typeAndEnter(page, "kill 99999");
  t = await termText(page);
  check("kill <pid> on unknown PID prints 'No such process'",         /No such process/.test(t.split("kill 99999")[1] || ""));

  // (v1.9.0 bonus-find for journalctl asserted earlier in the
  // sysinspect section — first-call only; the find is single-shot
  // per session, so a duplicate journalctl here wouldn't reprint
  // the banner.)

  // Multi-host pivot demo: ssh into Daniel's halton-bastion. The
  // pivot host has no password — implied agent forwarding. We
  // verify the prompt changes, ls shows the backups dir, and exit
  // unwinds back to app_admin@linux.
  await typeAndEnter(page, "ssh dbsvc@halton-bastion");
  await page.waitForTimeout(300);
  const pivotPrompt = await promptText(page);
  check("ssh into pivot host shows dbsvc@halton-bastion: prompt",     /dbsvc@halton-bastion/.test(pivotPrompt));

  await typeAndEnter(page, "ls");
  t = await termText(page);
  check("pivot host's ls shows backups/ + logs/ + welcome.md",        /backups/.test(t) && /logs/.test(t) && /welcome\.md/.test(t));

  await typeAndEnter(page, "cat ~/logs/postgresql.log");
  t = await termText(page);
  check("pivot host can read its own postgres log",                   /pg_dump completed/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);
  const unwoundPrompt = await promptText(page);
  check("exit from pivot unwinds back to app_admin@linux",            /app_admin@linux:/.test(unwoundPrompt));

  // After unwinding, env should be fresh (per-shell semantics) —
  // TEMP_VAR set inside the parent shell pre-pivot should be gone.
  await typeAndEnter(page, "echo before${TEMP_VAR}after");
  t = await termText(page);
  check("pivot-back: env reset (TEMP_VAR no longer set)",             /beforeafter/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  // ──── v1.9.0: backfilled level0@linux env_vars + bonusFind
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("terminal").innerHTML = ""; });

  await typeAndEnter(page, "env");
  t = await termText(page);
  check("level0@linux env_vars: EDITOR=vi present",                   /EDITOR=vi/.test(t));
  check("level0@linux env_vars: HISTSIZE=1000 present",               /HISTSIZE=1000/.test(t));

  await typeAndEnter(page, "cat .bash_history");
  t = await termText(page);
  check("bonus-find fires on cat .bash_history (Daniel's pattern)",   /Bonus find unlocked: Daniel's muscle-memory pattern/.test(t));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  // ──── v1.9.0: curl extended flags (lobby has no web data, so we
  // hop to level0@web which seeds web responses for the meridian
  // engagement).
  await typeAndEnter(page, "ssh level0@web");
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById("terminal").innerHTML = ""; });

  // -v verbose prints request preamble (> lines) regardless of the
  // server's response. URL must exist in level.web so the request
  // hits a response rather than a DNS-fail.
  await typeAndEnter(page, "curl -v https://www.meridian.edu");
  t = await termText(page);
  check("curl -v prints '> GET ...' request preamble",                /> GET .+ HTTP\/1\.1/.test(t.split("curl -v ").slice(-1)[0] || ""));

  // -X POST + -d + -H — sandbox can't fork, so the response lookup
  // falls back to the GET response for the URL when no method-aware
  // entry exists. Just verify the command doesn't error.
  await typeAndEnter(page, "curl -X POST -d 'a=1' -H 'Content-Type: application/x-www-form-urlencoded' https://www.meridian.edu");
  t = await termText(page);
  check("curl -X POST -d -H runs (no 'command not found' / no err)",  !/command not found/.test(t.split("curl -X POST").slice(-1)[0] || ""));

  // Gobuster real syntax — dir subcommand + -u + -w cosmetic flag.
  // The URL needs to match a level.gobusterRes entry; level0@web
  // seeds the meridian.edu top-level domain.
  await typeAndEnter(page, "gobuster dir -u https://www.meridian.edu -w /usr/share/wordlists/dirb/big.txt");
  t = await termText(page);
  check("gobuster dir -u -w threads banner shows the new wordlist",   /\/dirb\/big\.txt/.test(t.split("gobuster dir").slice(-1)[0] || ""));

  await typeAndEnter(page, "exit");
  await page.waitForTimeout(400);

  // ──── v1.9.0: readline shortcuts. Playwright dispatches the
  // exact key combos; we verify they mutate the cmd-input value
  // (we're not asserting visual cursor position — too brittle).

  // Pre-fill some history so Alt-. has something to recall.
  await typeAndEnter(page, "echo last-arg-victim");
  await page.locator("#cmd-input").focus();
  await page.locator("#cmd-input").fill("");

  // Alt-.: insert last arg of previous command.
  await page.keyboard.down("Alt");
  await page.keyboard.press("Period");
  await page.keyboard.up("Alt");
  let inputVal = await page.locator("#cmd-input").inputValue();
  check("Alt-. inserts last arg of previous command",                 inputVal === "last-arg-victim");

  await page.locator("#cmd-input").fill("");

  // Ctrl-K + Ctrl-Y: kill text + yank it back at cursor 0.
  await page.locator("#cmd-input").fill("hello world");
  // Move cursor to start so Ctrl-K kills the whole line.
  await page.keyboard.down("Control");
  await page.keyboard.press("a");
  await page.keyboard.up("Control");
  await page.keyboard.down("Control");
  await page.keyboard.press("k");
  await page.keyboard.up("Control");
  inputVal = await page.locator("#cmd-input").inputValue();
  check("Ctrl-K kills from cursor to end of line",                    inputVal === "");

  await page.keyboard.down("Control");
  await page.keyboard.press("y");
  await page.keyboard.up("Control");
  inputVal = await page.locator("#cmd-input").inputValue();
  check("Ctrl-Y yanks killed text back from the kill ring",           inputVal === "hello world");

  // Alt-B / Alt-F: word back / word forward (we don't have a clean
  // way to assert cursor position via Playwright, but we can verify
  // the key combo doesn't dispatch a character into the input).
  await page.locator("#cmd-input").fill("");
  await page.locator("#cmd-input").fill("alpha beta gamma");
  await page.keyboard.down("Alt");
  await page.keyboard.press("KeyB");
  await page.keyboard.up("Alt");
  inputVal = await page.locator("#cmd-input").inputValue();
  check("Alt-B doesn't insert a modified character into the input",   inputVal === "alpha beta gamma");

  await page.keyboard.down("Alt");
  await page.keyboard.press("KeyF");
  await page.keyboard.up("Alt");
  inputVal = await page.locator("#cmd-input").inputValue();
  check("Alt-F doesn't insert a modified character either",           inputVal === "alpha beta gamma");

  // Clear the input so it doesn't dirty subsequent assertions.
  await page.locator("#cmd-input").fill("");

  // ──── v1.10.0: lobby tree (tracks command) ──────────────────────
  // We're in the lobby (exit from web at line 1862). Test the
  // tracks verb + the expanded tree rendering.

  await typeAndEnter(page, "tracks");
  t = await termText(page);
  check("tracks (no args) prints expand-state report",                t.includes("Track expand state:"));
  check("tracks status lists linux track",                            t.includes("linux"));
  check("tracks status lists network track",                          t.includes("network"));

  // Toggle linux (will be expanded since level0@linux was visited
  // earlier — collapse it first to get a known state, then expand).
  await typeAndEnter(page, "tracks reset");
  t = await termText(page);
  check("tracks reset prints 'All tracks collapsed.'",                t.includes("All tracks collapsed"));

  // After reset, expand linux explicitly.
  await typeAndEnter(page, "tracks linux");
  t = await termText(page);
  check("tracks linux prints toggle success",                         t.includes("Track 'linux' expanded"));

  // Lobby has been re-rendered. The expanded tree should now show
  // each linux level's `ssh levelN@linux` line, plus the title we
  // added in v1.10.0.
  t = await termText(page);
  check("Expanded linux tree shows ssh level1@linux entry",           t.includes("ssh level1@linux"));
  check("Expanded linux tree shows the v1.10.0 title 'Halton Bank staging bastion'",
        t.includes("Halton Bank staging bastion"));
  check("Expanded linux tree shows the v1.10.0 title 'Daniel'",       t.includes("Daniel's laptop handoff"));
  // v1.10.0 — tier tag computed from level number. level0/1 → Routine.
  check("Expanded linux tree shows computed [Routine] tag per row",   t.includes("[Routine]"));

  // Unknown-track guard.
  await typeAndEnter(page, "tracks doesnotexist");
  t = await termText(page);
  check("tracks <unknown> errors with helpful message",               t.includes("is not a known track"));

  // tracks all expands every track.
  await typeAndEnter(page, "tracks all");
  t = await termText(page);
  check("tracks all reports 'All tracks expanded.'",                  t.includes("All tracks expanded"));

  // After tracks all, the lobby re-renders with everything open;
  // a non-linux track's level1 should now be visible.
  check("After 'tracks all', network/level1 row visible",             t.includes("ssh level1@network"));

  // Reset state for tidy session end.
  await typeAndEnter(page, "tracks reset");

  // ──── v1.10.0: tiers command — print difficulty-tier legend.
  await typeAndEnter(page, "tiers");
  t = await termText(page);
  check("tiers prints the 'Difficulty tiers' header",                 t.includes("Difficulty tiers"));
  check("tiers lists Routine + range level0-5",                       t.includes("Routine") && t.includes("level0–5"));
  check("tiers lists Live + range level6-10",                         t.includes("Live") && t.includes("level6–10"));
  check("tiers lists Escalated + range level11-15",                   t.includes("Escalated") && t.includes("level11–15"));
  check("tiers lists Critical + range level16-20",                    t.includes("Critical") && t.includes("level16–20"));
  check("tiers lists Crisis + range level21+",                        t.includes("Crisis") && t.includes("level21+"));
  check("tiers explains the 'Live not just harder than Routine' framing",
        t.includes("not the puzzle complexity") || t.includes("operational state"));

  // ──── v1.10.0: progress --detail ────────────────────────────────
  await typeAndEnter(page, "progress --detail");
  t = await termText(page);
  check("progress --detail prints session summary",                   /\d+ \/ \d+ levels visited this session/.test(t));
  check("progress --detail prints bonus-find aggregate counter",      /\d+ \/ \d+ bonus finds discovered/.test(t));
  // All three bonus finds (Daniel's muscle-memory pattern, Daniel's
  // backup script, Self-logged config-fallback bug) were unlocked
  // earlier in the run (see the "bonus-find fires on …" checks),
  // so in --detail mode every find renders by name with the ✦
  // marker. Verify all three appear verbatim.
  check("progress --detail names a discovered bonus find verbatim",   t.includes("Daniel's muscle-memory pattern"));
  check("progress --detail also names the backup-script bonus",       t.includes("Daniel's backup script"));
  check("progress --detail also names the self-logged-bug bonus",     t.includes("Self-logged config-fallback bug"));

  // v1.10.0 — bonus finds on the 12 non-linux levels. Each trigger
  // command was either already in the existing playtest flow (cat
  // engagement-notes.md / cat welcome.md / etc.) or added explicitly
  // (curl robots.txt on level0@web; aws sts get-caller-identity on
  // level0@cloud). Verify each fires by checking the bonus name
  // appears in `progress --detail` output.
  const v110bonuses = [
    ["network/level0 five-sprint",          "The five-sprint rotation"],
    ["network/level1 dbadmin shell drift",  "Vendor default account with /bin/bash"],
    ["crypto/level0 Vendolux coffee",       "The Vendolux coffee machine"],
    ["crypto/level1 most-downloaded",       "'Most-downloaded npm package, should be safe'"],
    ["web/level0 robots.txt billboard",     "robots.txt as an attacker's site map"],
    ["web/level1 ten-year session",         "The ten-year service-account session"],
    ["forensics/level0 EXIF direction",     "Camera direction in EXIF"],
    ["forensics/level1 certutil LOLBin",    "certutil as a LOLBin"],
    ["osint/level0 Adobe hint",             "Adobe's cleartext password hints"],
    ["osint/level1 Strava neighborhood",    "Aaron's Strava neighborhood"],
    ["cloud/level0 sts identity",           "Probing from outside the client's account"],
    ["cloud/level1 TTL without enforcement", "TTL columns without enforcement"],
  ];
  for (const [label, name] of v110bonuses) {
    check(`bonus '${label}' discovered + appears in --detail`,         t.includes(name));
  }

  // The [?] hidden branch (anti-spoiler render for un-found finds)
  // can't be exercised here without restarting the session — every
  // bonus is unlocked. The branch is a single hard-coded string in
  // learning.js's progress(); it's covered by code review + the
  // positive cases above prove the iteration works.

  // ──── v1.10.0: cold-start gate hint ─────────────────────────────
  // Clear the visited set so we can simulate a player ssh-ing into
  // level1@linux without having earned the credential. The yellow
  // hint should follow "Permission denied".
  await page.evaluate(() => {
    sessionStorage.removeItem("visited");
    // Also reset lobby expand state so this section doesn't pollute it.
    sessionStorage.removeItem("lobbyExpanded");
  });
  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(120);
  // Password prompt — type a bogus password.
  await page.keyboard.type("not-the-password");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("Cold-start: wrong-password still prints 'Permission denied'",
        t.includes("Permission denied, please try again."));
  check("Cold-start gate hint suggests visiting the prerequisite level",
        t.includes("Tip: this level gates on a credential discovered in level0@linux"));

  // ──── v1.10.0: SSH to a not-yet-shipped level on a known host.
  // Well-formed `level<N>@<known-host>` where N is past what's been
  // built should: (a) still print the red DNS-style error AND (b)
  // append a yellow tip telling the player the level isn't built yet
  // and pointing at the currently-shipped max.
  await typeAndEnter(page, "ssh level5@linux");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("ssh level5@linux still prints 'Could not resolve hostname' (red)",
        t.includes("Could not resolve hostname 'level5@linux'"));
  check("ssh level5@linux follow-up tip: level isn't built yet",
        t.includes("this level isn't built yet"));
  check("ssh level5@linux follow-up tip names the linux track + current ceiling",
        t.includes("The linux track currently ships level0 through level1"));

  // Real typos (`leve4@linux`, missing the second `l`) should still
  // get ONLY the plain DNS error — no "not built yet" tip, because
  // it's a typo, not a future level.
  await typeAndEnter(page, "ssh leve4@linux");
  await page.waitForTimeout(120);
  t = await termText(page);
  // Slice to most recent occurrence so we don't pick up the level5 tip
  // from the prior call still being on screen.
  const lastTypo = t.lastIndexOf("Could not resolve hostname 'leve4@linux'");
  const afterTypo = t.slice(lastTypo, lastTypo + 400);
  check("ssh leve4@linux (typo) still prints DNS error",
        t.includes("Could not resolve hostname 'leve4@linux'"));
  check("ssh leve4@linux (typo) does NOT show 'not built yet' tip",
        !afterTypo.includes("this level isn't built yet"));

  // Sanity: the hint is suppressed when the player HAS visited the
  // prereq. Re-seed `visited` with level0@linux and retry.
  await page.evaluate(() => {
    sessionStorage.setItem("visited", JSON.stringify(["level0@linux"]));
  });
  // The current shell is still at the password prompt (because we
  // didn't connect). The previous wrong password dropped us out of
  // password mode, so we need to ssh again to re-enter it.
  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(120);
  await page.keyboard.type("still-wrong");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  t = await termText(page);
  // After the second wrong attempt, the most recent line should be
  // "Permission denied" without a follow-up tip. Slice to the most
  // recent occurrence and check the next few lines don't include
  // the tip prefix.
  const lastDenied = t.lastIndexOf("Permission denied, please try again.");
  const after = t.slice(lastDenied, lastDenied + 400);
  check("Cold-start hint is suppressed when prereq IS visited",
        !after.includes("Tip: this level gates on a credential"));

  // ──────────────────────────────────────────────────────────────────
  // v1.14.0 — 20-achievement layer
  // ──────────────────────────────────────────────────────────────────
  //
  // The achievements engine has been firing throughout the playtest
  // — by this point in the run, the player has visited many levels,
  // discovered many bonus finds, used pipes, opened walkthroughs,
  // etc. Verify the layer is working: `achievements` lists all 20,
  // some have been earned given prior playtest activity, --detail
  // shows progress fractions where measurable, the registry covers
  // all four tiers.

  // Clean reset for this block so we have a known earned set.
  await page.evaluate(() => {
    localStorage.removeItem("d3cyph3r-progress-enabled");
    localStorage.removeItem("d3cyph3r-progress");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(1200);

  // Run the command from the empty lobby — should list all 20 with
  // 0 earned.
  await typeAndEnter(page, "achievements");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("v1.14.0 'achievements' prints header with 0/20 earned",
        /Achievements\s*\(0\/20\s+earned\)/.test(t));
  // Each of the 4 tier sections should be present.
  check("v1.14.0 'achievements' shows EASY tier section",          /\bEASY\b/.test(t));
  check("v1.14.0 'achievements' shows MEDIUM tier section",        /\bMEDIUM\b/.test(t));
  check("v1.14.0 'achievements' shows HARD tier section",          /\bHARD\b/.test(t));
  check("v1.14.0 'achievements' shows COMPLETIONIST tier section", /\bCOMPLETIONIST\b/.test(t));
  // Spot-check 4 of the 20 achievement names from different tiers.
  check("v1.14.0 'achievements' lists 'First Steps'",          t.includes("First Steps"));
  check("v1.14.0 'achievements' lists 'Multi-Host Pivot'",     t.includes("Multi-Host Pivot"));
  check("v1.14.0 'achievements' lists 'Polymath'",             t.includes("Polymath"));
  check("v1.14.0 'achievements' lists 'Completionist'",        t.includes("Completionist"));

  // --- 1985 unlocks when theme is set to crt-green ---
  await typeAndEnter(page, "theme crt-green");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.14.0 '1985' achievement unlocks on theme crt-green",
        /Achievement unlocked:\s*1985/.test(t));

  // --- First Steps unlocks on first non-lobby connect ---
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  // Dismiss the persistence prompt that fires for fresh-session connects.
  await typeAndEnter(page, "n");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("v1.14.0 'First Steps' achievement unlocks on first level visit",
        /Achievement unlocked:\s*First Steps/.test(t));

  // --- Asked for Help unlocks on `man <cmd>` ---
  await typeAndEnter(page, "man ls");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("v1.14.0 'Asked for Help' achievement unlocks on man read",
        /Achievement unlocked:\s*Asked for Help/.test(t));

  // --- achievements --detail shows progress fractions ---
  await typeAndEnter(page, "achievements --detail");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("v1.14.0 'achievements --detail' shows tracks-visited progress",
        /progress:\s*\d+\/\d+ tracks visited/.test(t));
  check("v1.14.0 'achievements --detail' shows bonus-finds progress",
        /progress:\s*\d+\/\d+ bonus finds/.test(t));

  // --- earned set persists in localStorage if persistence is enabled ---
  await typeAndEnter(page, "progress save-on");
  await page.waitForTimeout(120);
  const earnedInLs = await page.evaluate(() => {
    const raw = localStorage.getItem("d3cyph3r-progress");
    if (!raw) return [];
    try { return JSON.parse(raw)["d3cyph3r:earnedAchievements"]; } catch (_) { return []; }
  });
  check("v1.14.0 earned achievements mirror to localStorage when opted in",
        typeof earnedInLs === "string" && earnedInLs.includes("first-steps"));

  // Clean up — go back to default theme + dismiss any persistence
  // state so the v1.13.0 block (which runs after this) starts from
  // a known position.
  await typeAndEnter(page, "theme dark");
  await page.waitForTimeout(80);
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(120);

  // ──────────────────────────────────────────────────────────────────
  // v1.13.0 — 11-theme picker
  // ──────────────────────────────────────────────────────────────────
  //
  // Exercise the theme registry, the data-theme attribute toggling,
  // the data-theme-mode side-attribute, the four-shape command
  // surface (`themes`, `theme`, `theme <name>`, `theme next/prev`),
  // and the localStorage round-trip on reload.

  // Reset to a known clean state (default dark theme).
  await page.evaluate(() => { localStorage.removeItem("d3cyph3r-theme"); });
  await page.reload();
  await page.waitForTimeout(1200);

  // --- `themes` lists all 11 ---
  await typeAndEnter(page, "themes");
  await page.waitForTimeout(80);
  t = await termText(page);
  for (const name of ["dark", "light", "crt-green", "amber", "synthwave",
                      "solarized-dark", "solarized-light", "high-contrast",
                      "nord", "gruvbox", "dracula"]) {
    check(`v1.13.0 'themes' lists '${name}'`, t.includes(name));
  }
  check("v1.13.0 'themes' marks current theme with arrow",
        /→\s+dark\b/.test(t));

  // --- `theme` (no arg) reports current ---
  await typeAndEnter(page, "theme");
  await page.waitForTimeout(80);
  t = await termText(page);
  check("v1.13.0 'theme' (no arg) reports current is 'dark'",
        /Current theme:\s*dark/.test(t));

  // --- `theme crt-green` switches the body attribute ---
  await typeAndEnter(page, "theme crt-green");
  await page.waitForTimeout(80);
  const themeAttr = await page.evaluate(() => document.body.getAttribute("data-theme"));
  const modeAttr  = await page.evaluate(() => document.body.getAttribute("data-theme-mode"));
  check("v1.13.0 'theme crt-green' sets data-theme=crt-green", themeAttr === "crt-green");
  check("v1.13.0 crt-green theme has data-theme-mode='dark'",   modeAttr === "dark");

  // --- mode flips to 'light' for a light theme ---
  await typeAndEnter(page, "theme solarized-light");
  await page.waitForTimeout(80);
  const lightModeAttr = await page.evaluate(() => document.body.getAttribute("data-theme-mode"));
  check("v1.13.0 solarized-light theme has data-theme-mode='light'", lightModeAttr === "light");

  // --- invalid name errors gracefully ---
  await typeAndEnter(page, "theme purple-monkey-dishwasher");
  await page.waitForTimeout(80);
  t = await termText(page);
  check("v1.13.0 'theme <invalid>' prints error",
        /unknown theme/i.test(t));
  // Check theme was NOT changed by the invalid command.
  const stillLight = await page.evaluate(() => document.body.getAttribute("data-theme"));
  check("v1.13.0 invalid name does NOT change current theme",
        stillLight === "solarized-light");

  // --- `theme next` cycles ---
  await typeAndEnter(page, "theme next");
  await page.waitForTimeout(80);
  const afterNext = await page.evaluate(() => document.body.getAttribute("data-theme"));
  check("v1.13.0 'theme next' advances past solarized-light",
        afterNext !== "solarized-light");

  // --- `theme prev` reverses ---
  await typeAndEnter(page, "theme prev");
  await page.waitForTimeout(80);
  const afterPrev = await page.evaluate(() => document.body.getAttribute("data-theme"));
  check("v1.13.0 'theme prev' returns to solarized-light",
        afterPrev === "solarized-light");

  // --- localStorage persists the choice across reload ---
  await typeAndEnter(page, "theme dracula");
  await page.waitForTimeout(80);
  const lsBefore = await page.evaluate(() => localStorage.getItem("d3cyph3r-theme"));
  check("v1.13.0 'theme dracula' writes to localStorage", lsBefore === "dracula");
  await page.reload();
  await page.waitForTimeout(1200);
  const afterReload = await page.evaluate(() => document.body.getAttribute("data-theme"));
  check("v1.13.0 dracula theme survives reload (hydrated from localStorage)",
        afterReload === "dracula");

  // --- topbar click cycles to next theme ---
  await typeAndEnter(page, "theme dark");
  await page.waitForTimeout(80);
  await page.locator("#theme-toggle").click();
  await page.waitForTimeout(80);
  const afterClick = await page.evaluate(() => document.body.getAttribute("data-theme"));
  check("v1.13.0 topbar theme toggle cycles past 'dark'",
        afterClick !== "dark");

  // Clean up — back to dark for downstream tests.
  await typeAndEnter(page, "theme dark");
  await page.waitForTimeout(80);

  // ──────────────────────────────────────────────────────────────────
  // v1.12.0 — first-visit guided tour (interactive state machine)
  // ──────────────────────────────────────────────────────────────────
  //
  // Smoke checks on the annotated FIRST STEPS banner live earlier in
  // this file (right after the initial lobby render). This block
  // exercises the interactive `tutorial start` state machine: each
  // expected command advances the step, mismatched input nudges
  // without trapping, 'skip' exits cleanly, and the completion banner
  // fires after the final step's ssh dispatch.

  await page.evaluate(() => {
    localStorage.removeItem("d3cyph3r-progress-enabled");
    localStorage.removeItem("d3cyph3r-progress");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(1500);

  // Kick off the interactive tour from a fresh lobby.
  await typeAndEnter(page, "tutorial start");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.12.0 tour: 'tutorial start' prints step 1 header",
        t.includes("TUTORIAL  (1/4)"));
  check("v1.12.0 tour: step 1 instructs 'help'",
        /Type 'help' and press Enter/i.test(t));

  // Wrong-command nudge — type 'ls' instead of 'help'. Tour should
  // print a nudge but still let the dispatch run.
  const beforeMistype = t.length;
  await typeAndEnter(page, "ls");
  await page.waitForTimeout(150);
  t = await termText(page);
  const afterMistype = t.slice(beforeMistype);
  check("v1.12.0 tour: mistyped command triggers nudge",
        /tutorial: type 'help'/i.test(afterMistype));
  // Tour should still be at step 1 — verify by checking step header
  // didn't advance. The most recent TUTORIAL header should still say
  // (1/4).
  check("v1.12.0 tour: mismatched input does NOT advance the step",
        !afterMistype.includes("TUTORIAL  (2/4)"));

  // Correct command — advances to step 2.
  await typeAndEnter(page, "help");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.12.0 tour: 'help' dispatches normally (help output still appears)",
        t.includes("OPEN-SOURCE INTEL"));
  check("v1.12.0 tour: advance to step 2 after correct command",
        t.includes("TUTORIAL  (2/4)"));
  check("v1.12.0 tour: step 2 instructs 'tracks'",
        /Type 'tracks'|expand the engagement tree/i.test(t));

  // Step 2 → 3.
  await typeAndEnter(page, "tracks");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.12.0 tour: advance to step 3 after 'tracks'",
        t.includes("TUTORIAL  (3/4)"));

  // Step 3 → 4.
  await typeAndEnter(page, "tiers");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.12.0 tour: advance to step 4 after 'tiers'",
        t.includes("TUTORIAL  (4/4)"));

  // Step 4 — the final ssh that completes the tour. This is the only
  // step whose completion message prints BEFORE dispatch (so the
  // banner lands above the level0@linux connection banner / lesson /
  // objective / persistence prompt).
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  t = await termText(page);
  check("v1.12.0 tour: completion banner fires after final step",
        t.includes("TUTORIAL COMPLETE"));
  check("v1.12.0 tour: ssh dispatch ran (connection banner present)",
        t.includes("Connected: level0@linux"));
  // Order check — TUTORIAL COMPLETE should appear BEFORE the
  // connection banner in the transcript so the player sees the tour
  // outro before the level-entry chrome.
  const tutCompleteIdx = t.lastIndexOf("TUTORIAL COMPLETE");
  const connectIdx     = t.lastIndexOf("Connected: level0@linux");
  check("v1.12.0 tour: TUTORIAL COMPLETE prints BEFORE connection banner",
        tutCompleteIdx >= 0 && connectIdx >= 0 && tutCompleteIdx < connectIdx);

  // Now we're in level0@linux with the persistence prompt pending
  // (fresh session, never opted in). Dismiss it with 'n' so the
  // playtest can continue.
  await typeAndEnter(page, "n");
  await page.waitForTimeout(150);

  // 'skip' path — restart tour, type 'skip' at step 1.
  // Need to exit level0 first since 'tutorial start' is lobby-only.
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(150);
  await typeAndEnter(page, "tutorial start");
  await page.waitForTimeout(150);
  await typeAndEnter(page, "skip");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.12.0 tour: 'skip' prints skipped banner",
        t.lastIndexOf("TUTORIAL SKIPPED") > 0);

  // Verify tour is no longer intercepting input — a normal command
  // dispatches without a tutorial nudge.
  await typeAndEnter(page, "help");
  await page.waitForTimeout(150);
  t = await termText(page);
  const lastHelp  = t.lastIndexOf("OPEN-SOURCE INTEL");
  const lastNudge = t.lastIndexOf("(tutorial: type");
  check("v1.12.0 tour: after 'skip', 'help' runs without tutorial nudge",
        lastHelp > 0 && (lastNudge < 0 || lastNudge < lastHelp - 1000));

  // Lobby-only guardrail — running 'tutorial start' from inside a
  // level should print a friendly redirect, not enter the tour.
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(200);
  await typeAndEnter(page, "tutorial start");
  await page.waitForTimeout(120);
  t = await termText(page);
  check("v1.12.0 tour: 'tutorial start' from non-lobby level is gated",
        t.includes("run 'tutorial start' from the lobby"));

  // Clean up — return to lobby for downstream tests.
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(150);

  // ──────────────────────────────────────────────────────────────────
  // v1.11.0 — opt-in localStorage progress persistence
  // ──────────────────────────────────────────────────────────────────
  //
  // The smoke check earlier in this file already verified the prompt
  // fires once per session and dismisses on 'n'. This block exercises
  // the FULL flow: opt-in path, hydration on reload, the three
  // `progress` subcommands (save-on / save-off / reset), and storage
  // isolation from the unrelated `d3cyph3r-history` / `d3cyph3r-theme`
  // localStorage keys.
  //
  // The block does a hard storage reset + reload before each scenario
  // so prior state from the long playtest doesn't pollute the result.

  // --- Scenario A: opt-in path + hydration roundtrip ---
  await page.evaluate(() => {
    localStorage.removeItem("d3cyph3r-progress-enabled");
    localStorage.removeItem("d3cyph3r-progress");
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForTimeout(1500);

  // Connect to level0@linux fresh; the level has no password (it's the
  // entry point for the linux track), so connectTo runs immediately and
  // the persistence prompt fires after the connection banner / lesson /
  // objective lines.
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  t = await termText(page);
  check("v1.11.0 A1: prompt fires on first non-lobby connect of a fresh session",
        t.includes("Save your progress across browser sessions?"));

  // Type 'y' to opt in.
  await typeAndEnter(page, "y");
  await page.waitForTimeout(150);
  t = await termText(page);
  check("v1.11.0 A2: 'y' opt-in prints success confirmation",
        t.includes("Progress will be saved to this browser"));

  const enabledFlag = await page.evaluate(() => localStorage.getItem("d3cyph3r-progress-enabled"));
  check("v1.11.0 A3: localStorage flag set to '1' after opt-in", enabledFlag === "1");

  const blob = await page.evaluate(() => {
    const raw = localStorage.getItem("d3cyph3r-progress");
    return raw ? JSON.parse(raw) : null;
  });
  check("v1.11.0 A4: persistence blob created on opt-in", blob && typeof blob === "object");
  check("v1.11.0 A5: blob contains 'visited' including level0@linux",
        blob && blob.visited && blob.visited.includes("level0@linux"));

  // Advance the hint counter twice so we can test that it persists.
  await typeAndEnter(page, "hint");
  await typeAndEnter(page, "hint");
  await page.waitForTimeout(100);
  const hintBlobBefore = await page.evaluate(() => {
    const raw = localStorage.getItem("d3cyph3r-progress");
    return raw ? JSON.parse(raw) : {};
  });
  check("v1.11.0 A6: hint counter mirrored to blob (level0@linux at 2)",
        hintBlobBefore["d3cyph3r-hint-level0@linux"] === "2");

  // Reload — sessionStorage gets wiped, but the blob should rehydrate.
  await page.reload();
  await page.waitForTimeout(1500);
  const visitedAfterReload = await page.evaluate(() => sessionStorage.getItem("visited"));
  check("v1.11.0 A7: sessionStorage.visited rehydrated after reload",
        visitedAfterReload && JSON.parse(visitedAfterReload).includes("level0@linux"));
  const hintAfterReload = await page.evaluate(() => sessionStorage.getItem("d3cyph3r-hint-level0@linux"));
  check("v1.11.0 A8: hint counter rehydrated after reload", hintAfterReload === "2");

  // Reconnect — prompt should NOT fire again (already enabled).
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  t = await termText(page);
  // Trim to most recent occurrence so we don't see the earlier prompt
  // from before the reload. After reload the term was cleared, so the
  // text from before isn't there anyway, but be defensive.
  check("v1.11.0 A9: prompt does NOT fire on subsequent connect when already enabled",
        !t.includes("Save your progress across browser sessions?"));

  // --- Scenario B: progress save-off ---
  // We're currently in level0@linux with persistence enabled. Disable
  // it via the subcommand and verify the blob disappears.
  await typeAndEnter(page, "progress save-off");
  await page.waitForTimeout(100);
  t = await termText(page);
  check("v1.11.0 B1: 'progress save-off' confirms persistence disabled",
        t.includes("Persistence disabled"));

  const flagAfterOff = await page.evaluate(() => localStorage.getItem("d3cyph3r-progress-enabled"));
  const blobAfterOff = await page.evaluate(() => localStorage.getItem("d3cyph3r-progress"));
  check("v1.11.0 B2: enabled flag cleared after save-off", flagAfterOff === null);
  check("v1.11.0 B3: persistence blob removed after save-off", blobAfterOff === null);
  const visitedAfterOff = await page.evaluate(() => sessionStorage.getItem("visited"));
  check("v1.11.0 B4: sessionStorage.visited untouched by save-off",
        visitedAfterOff && JSON.parse(visitedAfterOff).includes("level0@linux"));

  // --- Scenario C: progress save-on re-enable ---
  await typeAndEnter(page, "progress save-on");
  await page.waitForTimeout(100);
  t = await termText(page);
  check("v1.11.0 C1: 'progress save-on' confirms persistence re-enabled",
        t.includes("Progress will be saved to this browser"));
  const flagAfterOn = await page.evaluate(() => localStorage.getItem("d3cyph3r-progress-enabled"));
  check("v1.11.0 C2: enabled flag set after save-on", flagAfterOn === "1");
  const blobAfterOn = await page.evaluate(() => {
    const raw = localStorage.getItem("d3cyph3r-progress");
    return raw ? JSON.parse(raw) : null;
  });
  check("v1.11.0 C3: blob snapshot captures current progress on re-enable",
        blobAfterOn && blobAfterOn.visited && blobAfterOn.visited.includes("level0@linux"));

  // --- Scenario D: progress reset ---
  // Storage-isolation setup: plant a known d3cyph3r-theme value
  // BEFORE the reset (we test theme survival, not history — the
  // command history is auto-rewritten every time the player types
  // something, so a planted sentinel there gets clobbered by the
  // act of typing `progress reset` itself, which doesn't prove the
  // reset is to blame).
  await page.evaluate(() => {
    localStorage.setItem("d3cyph3r-theme", "light");
  });
  await typeAndEnter(page, "progress reset");
  await page.waitForTimeout(100);
  t = await termText(page);
  check("v1.11.0 D1: 'progress reset' confirms wipe", t.includes("Progress wiped"));

  const flagAfterReset    = await page.evaluate(() => localStorage.getItem("d3cyph3r-progress-enabled"));
  // v1.14.0 update: 'progress reset' wipes the blob, but the
  // post-dispatch achievement check immediately re-earns
  // achievements whose criteria don't depend on the cleared data
  // (e.g. "Persistent Player" — the opt-in flag is preserved by
  // design, so the achievement stays earned). The blob therefore
  // gets repopulated with the achievements set within the same
  // dispatch tick. The intent of D3 is "tracked PROGRESS keys
  // (visited, bonuses, hint counters) are gone" — achievements
  // re-populating is correct behavior.
  const blobAfterReset    = await page.evaluate(() => {
    const raw = localStorage.getItem("d3cyph3r-progress");
    if (raw === null) return { state: "null" };
    try {
      const obj = JSON.parse(raw);
      return {
        state: "exists",
        hasVisited:    "visited" in obj,
        hasBonuses:    "d3cyph3r:bonusFinds" in obj,
        hasAnyHintKey: Object.keys(obj).some(k => k.startsWith("d3cyph3r-hint-")),
      };
    } catch (_) { return { state: "malformed" }; }
  });
  const visitedAfterReset = await page.evaluate(() => sessionStorage.getItem("visited"));
  const hintAfterReset    = await page.evaluate(() => sessionStorage.getItem("d3cyph3r-hint-level0@linux"));
  check("v1.11.0 D2: enabled flag preserved across reset", flagAfterReset === "1");
  check("v1.11.0 D3: blob no longer carries visited/bonuses/hint keys after reset",
        blobAfterReset.state === "null" ||
        (!blobAfterReset.hasVisited && !blobAfterReset.hasBonuses && !blobAfterReset.hasAnyHintKey));
  check("v1.11.0 D4: sessionStorage.visited cleared by reset", visitedAfterReset === null);
  check("v1.11.0 D5: hint counter cleared by reset", hintAfterReset === null);

  // Storage isolation — d3cyph3r-history and d3cyph3r-theme are NOT
  // tracked by the persistence layer and must survive 'progress reset'.
  // Theme is unaffected by typing commands so it's the clean check
  // here; for history we just verify the key still exists after the
  // reset (its contents will have been updated by the typing flow
  // itself, but the key shouldn't be deleted).
  const historyAfter = await page.evaluate(() => localStorage.getItem("d3cyph3r-history"));
  const themeAfter   = await page.evaluate(() => localStorage.getItem("d3cyph3r-theme"));
  check("v1.11.0 D6: d3cyph3r-history key not removed by progress reset",
        historyAfter !== null);
  check("v1.11.0 D7: d3cyph3r-theme NOT affected by progress reset", themeAfter === "light");

  // Clean up: leave persistence off for any post-block work and reset
  // the theme so we don't influence anything downstream.
  await page.evaluate(() => {
    localStorage.removeItem("d3cyph3r-progress-enabled");
    localStorage.removeItem("d3cyph3r-progress");
    localStorage.removeItem("d3cyph3r-history");
    localStorage.removeItem("d3cyph3r-theme");
  });

  // ──────────────────────────────────────────────────────────────────
  // v1.16.0 — Per-level time tracking
  // ──────────────────────────────────────────────────────────────────
  //
  // Tracks total time spent per level (across visits) + first-solve
  // elapsed (captured when the player navigates from level<N>@<track>
  // to level<N+1>@<track>). Surfaces in progress --detail per-row and
  // in the connection banner on revisit. Pivot hosts ride on the
  // parent's timer.
  //
  // Setup: wipe sessionStorage + reload to a fully clean baseline so
  // the timer module starts fresh. The v1.11.0 progress reset above
  // emptied sessionStorage's progress keys; the reload re-creates the
  // session from scratch so we know no stale level-times bleed in.

  await page.evaluate(() => { sessionStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(1200);
  // Suppress the once-per-session UX that would intercept our input
  // after the sessionStorage wipe:
  //   - persistence-consent prompt (fires on first non-lobby connect)
  //   - first-visit welcome banner (cosmetic but adds scrollback noise)
  // Both are tested in their own blocks above; here we're isolating
  // the timer behavior.
  await page.evaluate(() => {
    sessionStorage.setItem("d3cyph3r-prompt-seen", "1");
    sessionStorage.setItem("seenOnboarding", "true");
  });

  // --- T1: first connect to level0 has NO "Previous solve" line ---
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  const t1 = await termText(page);
  // The banner after the most-recent ssh command. Split on the echoed
  // command line and check just the tail so we don't false-match an
  // earlier "Previous solve time" in scrollback.
  const banner1 = t1.split("ssh level0@linux").slice(-1)[0] || "";
  check("v1.16.0 T1: first connect to level0 does NOT show 'Previous solve time'",
        !banner1.includes("Previous solve time"));

  // --- T2: spend > 1s in level0 so the time tag isn't "< 1s" ---
  await page.waitForTimeout(1200);

  // --- T3: ssh level0 → level1 triggers SOLVE for level0 ---
  // Forward-navigate (no exit) so solve detection fires.
  await typeAndEnter(page, "ssh level1@linux");
  await page.waitForTimeout(300);
  await typeAndEnter(page, "please-rotate-me");
  await page.waitForTimeout(600);
  const tConnected = await termText(page);
  check("v1.16.0 T3: navigated level0 → level1 (solve trigger)",
        tConnected.includes("Connected: level1@linux"));

  // --- T4: exit back to lobby (stops level1 timer with no solve target) ---
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(500);

  // --- T5: progress --detail surfaces time tag for level0 ---
  await typeAndEnter(page, "progress --detail");
  await page.waitForTimeout(150);
  const tDetail = await termText(page);
  // level0 row should show "<N>s" (we waited > 1s, so seconds-form).
  check("v1.16.0 T5a: progress --detail shows time tag for visited level0",
        /level0@linux[^\n]*\b\d+s\b/.test(tDetail));
  // ...AND a "solve: <time>" annotation since level0 → level1 fired.
  check("v1.16.0 T5b: progress --detail shows '(solve: <time>)' for level0",
        /level0@linux[^\n]*\(solve:\s*\d+s/.test(tDetail));
  // level1 was visited too, but it's a terminal level (no level2
  // yet) so it gets a time tag but NO solve annotation.
  check("v1.16.0 T5c: progress --detail shows time tag for visited level1",
        /level1@linux[^\n]*\b(<\s*1s|\d+s)\b/.test(tDetail));
  check("v1.16.0 T5d: level1 row has NO '(solve:' (terminal level)",
        !/level1@linux[^\n]*\(solve:/.test(tDetail));

  // --- T6: re-enter level0 → banner shows "Previous solve time" ---
  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(400);
  const t6 = await termText(page);
  const banner6 = t6.split("ssh level0@linux").slice(-1)[0] || "";
  check("v1.16.0 T6: revisit shows 'Previous solve time' banner",
        banner6.includes("Previous solve time:"));

  // --- T7: sessionStorage carries the levelTimes blob ---
  const timesBlob = await page.evaluate(() => {
    const raw = sessionStorage.getItem("d3cyph3r:levelTimes");
    return raw ? JSON.parse(raw) : null;
  });
  check("v1.16.0 T7a: sessionStorage carries d3cyph3r:levelTimes",
        timesBlob !== null);
  check("v1.16.0 T7b: levelTimes blob records level0 as solved",
        timesBlob && timesBlob["level0@linux"] && timesBlob["level0@linux"].isSolved === true);
  check("v1.16.0 T7c: levelTimes blob has firstSolveMs for level0",
        timesBlob && Number.isFinite(timesBlob["level0@linux"]?.firstSolveMs));

  // Clean up: leave the player at the lobby for any post-block work.
  await typeAndEnter(page, "exit");
  await page.waitForTimeout(300);

  check("No page errors raised", errors.length === 0);
  if (errors.length) errors.forEach(e => console.log("  ", e));

  console.log(`\n${pass}/${pass + fail} checks passed`);

  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
