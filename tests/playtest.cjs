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
  check("Lobby AVAILABLE ENGAGEMENTS rendered",     t.includes("AVAILABLE ENGAGEMENTS"));
  check("Lobby shows Driftwood welcome on first visit", t.includes("WELCOME TO DRIFTWOOD SYSTEMS"));
  check("Lobby lists Linux track",                   t.includes("ssh level0@linux"));

  await typeAndEnter(page, "ssh level0@linux");
  await page.waitForTimeout(300);
  t = await termText(page);
  check("Connected to level0@linux", t.includes("Connected: level0@linux"));
  check("Objective references Daniel", t.includes("Daniel"));
  check("Lesson mentions Driftwood",   t.includes("Driftwood"));
  check("Lesson mentions Halton Bank", t.includes("Halton"));
  check("Prompt host updated to linux", (await page.locator("#prompt-host").innerText()) === "linux");

  await typeAndEnter(page, "ls");
  t = await termText(page);
  for (const f of ["welcome.md", "handoff.md", "tasks.md", "notes.txt", "creds.txt", "lessons-learned.md"]) {
    check(`ls shows ${f}`, t.includes(f));
  }
  check("ls does NOT show hidden .bash_history", !t.includes(".bash_history"));

  await typeAndEnter(page, "ls -a");
  t = await termText(page);
  check("ls -a shows hidden .bash_history", t.includes(".bash_history"));

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
  check("whoami prints 'level0'", /\blevel0\b/.test(t));

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

  check("No page errors raised", errors.length === 0);
  if (errors.length) errors.forEach(e => console.log("  ", e));

  console.log(`\n${pass}/${pass + fail} checks passed`);

  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
