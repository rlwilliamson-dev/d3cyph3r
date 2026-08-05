// tests/specs/shell-realism.spec.cjs
//
// Shell-realism playtest — the engine surface that grew across v1.3 /
// v1.4 / v1.9 to make D3CYPH3R's terminal feel like a real bash
// session rather than a switch statement of canned outputs.
//
// Coverage:
//   - v1.3.0  paths / globs / pipes / shell-variable expansion /
//             multi-stage pipes / tab autocomplete. Plus the v1.3.0
//             system-info family (which/type/id/uname/date/uptime/
//             hostname) and the v1.3.0 text-processing primitives
//             (wc/cut on stdin).
//   - v1.4.0  learning aids: `hint` (advancing counter inside a
//             seeded level), `man <cmd>` (catalog hits + the
//             "No manual entry" miss), `what-is <term>` (case-
//             insensitive glossary), and `awk` (column extraction
//             on stdin + -F field separator + /regex/ pattern).
//   - v1.9.0  shell environment (env / export / unset / POSIX
//             assignment / PS1), job control (& / jobs / fg / bg /
//             kill / disown / wait), bonus-find triggers, dig
//             extended flags (+short / +trace / @server), pivot
//             stack (ssh into pivot host → exit unwinds), curl -v /
//             -X / -d / -H, gobuster dir -u -w, and the readline
//             shortcuts that need real keystrokes (Alt-. / Ctrl-K /
//             Ctrl-Y / Alt-B / Alt-F).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 1592-2135.
// Uses the v1.24.0 dispatchCmd helper for the bulk of the dispatch
// path, and typeKeystrokes/pressKey for the small set of readline
// tests that need the real keyboard event chain (history /
// kill-ring / last-arg recall don't fire through the synthetic
// Enter-dispatch path).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so each describe block can ssh fresh from boot.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  typeKeystrokes,
  pressKey,
  terminalText,
  promptText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

// Helper: dismiss the v1.11.0 persistence opt-in prompt that fires
// on the first non-lobby connect of a fresh session. Every describe
// block in this file starts from a clean context, so each first ssh
// hits the prompt. Pulled out so it's easy to keep consistent.
async function dismissPersistencePrompt(page) {
  await waitForOutput(page, "Save your progress across browser sessions?");
  await dispatchCmd(page, "n");
  await waitForOutput(page, "Progress stays in this tab only");
}

test.describe("shell realism (v1.3 / v1.4 / v1.9)", () => {
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

  // ── v1.3.0 — paths / globs / pipes / variables ────────────────────
  // All of these need level0@linux's filesystem (welcome.md, handoff.md,
  // tasks.md, notes.txt, creds.txt, lessons-learned.md).
  test.describe("v1.3.0 paths / globs / pipes / vars (level0@linux)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@linux");
      await waitForOutput(page, "Connected: level0@linux");
      await dismissPersistencePrompt(page);
    });

    // ── path resolution ─────────────────────────────────────────────
    test("pwd prints /home/daniel", async ({ page }) => {
      await dispatchCmd(page, "pwd");
      const t = await terminalText(page);
      expect(t).toMatch(/\/home\/daniel\s*$/m);
    });

    test("cd /home/daniel resolves to home (absolute path)", async ({ page }) => {
      await dispatchCmd(page, "cd /home/daniel");
      await dispatchCmd(page, "pwd");
      const t = await terminalText(page);
      expect(t).toMatch(/\/home\/daniel\s*$/m);
    });

    test("cd ~ resolves to home root", async ({ page }) => {
      await dispatchCmd(page, "cd ~");
      await dispatchCmd(page, "pwd");
      const t = await terminalText(page);
      expect(t).toMatch(/\/home\/daniel\s*$/m);
    });

    test("cd ../../.. clamps at home directory boundary", async ({ page }) => {
      await dispatchCmd(page, "cd ../../..");
      const t = await terminalText(page);
      expect(t).toContain("already at home directory");
    });

    test("cd /etc (outside sandbox) prints 'No such file or directory'", async ({ page }) => {
      await dispatchCmd(page, "cd /etc");
      const t = await terminalText(page);
      expect(t).toContain("cd: /etc: No such file or directory");
    });

    // ── wildcards ───────────────────────────────────────────────────
    test("ls *.md expands glob and lists the markdown files", async ({ page }) => {
      await dispatchCmd(page, "ls *.md");
      const t = await terminalText(page);
      expect(t).toContain("welcome.md");
      expect(t).toContain("handoff.md");
      expect(t).toContain("tasks.md");
      // creds.txt is .txt — must NOT appear after the *.md command echo.
      const after = t.split("ls *.md")[1] || "";
      expect(after).not.toMatch(/\bcreds\.txt\b/);
    });

    test("cat *.txt concatenates notes.txt + creds.txt", async ({ page }) => {
      await dispatchCmd(page, "cat *.txt");
      const t = await terminalText(page);
      expect(t).toContain("please-rotate-me");
      expect(t).toMatch(/Halton/);
    });

    test("ls *.nope (no match) leaves the pattern literal in the error", async ({ page }) => {
      await dispatchCmd(page, "ls *.nope");
      const t = await terminalText(page);
      expect(t).toContain("ls: cannot access '*.nope'");
    });

    // ── shell variable expansion ────────────────────────────────────
    test("echo $USER expands to 'daniel'", async ({ page }) => {
      await dispatchCmd(page, "echo $USER");
      const t = await terminalText(page);
      const after = t.split("echo $USER")[1] || "";
      expect(after).toMatch(/\bdaniel\b/);
    });

    test("echo $HOME expands to /home/daniel", async ({ page }) => {
      await dispatchCmd(page, "echo $HOME");
      const t = await terminalText(page);
      const after = t.split("echo $HOME")[1] || "";
      expect(after).toContain("/home/daniel");
    });

    test("echo $HOSTNAME expands to 'linux'", async ({ page }) => {
      await dispatchCmd(page, "echo $HOSTNAME");
      const t = await terminalText(page);
      const after = t.split("echo $HOSTNAME")[1] || "";
      expect(after).toMatch(/\blinux\b/);
    });

    test("echo ${USER}@${HOSTNAME} expands the bracketed form", async ({ page }) => {
      await dispatchCmd(page, "echo ${USER}@${HOSTNAME}");
      const t = await terminalText(page);
      expect(t).toContain("daniel@linux");
    });

    test("echo $$ escapes to literal $", async ({ page }) => {
      await dispatchCmd(page, "echo $$");
      const t = await terminalText(page);
      const after = t.split("echo $$")[1] || "";
      expect(after).toMatch(/\$\s*$/m);
    });

    test("cat $HOME/welcome.md resolves var + absolute path", async ({ page }) => {
      await dispatchCmd(page, "cat $HOME/welcome.md");
      const t = await terminalText(page);
      // welcome.md uses "Welcome" or "welcome" somewhere in the body.
      expect(t.includes("welcome") || t.includes("Welcome")).toBeTruthy();
    });

    // ── pipes ───────────────────────────────────────────────────────
    test("cat | wc -l counts lines", async ({ page }) => {
      await dispatchCmd(page, "cat welcome.md | wc -l");
      const t = await terminalText(page);
      const after = t.split("cat welcome.md | wc -l")[1] || "";
      expect(after).toMatch(/\d+\s+welcome\.md|^\s*\d+\s*$/m);
    });

    test("cat | grep filters lines from stdin", async ({ page }) => {
      await dispatchCmd(page, "cat creds.txt | grep please");
      const t = await terminalText(page);
      expect(t).toContain("please-rotate-me");
    });

    test("ls | wc -l counts visible files", async ({ page }) => {
      await dispatchCmd(page, "ls | wc -l");
      const t = await terminalText(page);
      const after = t.split("ls | wc -l")[1] || "";
      expect(after).toMatch(/\d/);
    });

    test("echo hello | tr a-z A-Z uppercases stdin", async ({ page }) => {
      await dispatchCmd(page, "echo hello | tr a-z A-Z");
      const t = await terminalText(page);
      expect(t).toContain("HELLO");
    });

    test("ls | sort -r runs without crash", async ({ page }) => {
      await dispatchCmd(page, "ls | sort -r");
      const t = await terminalText(page);
      // We only assert the pipe stages execute — the actual ordering of
      // `ls` (space-separated) depends on the implementation.
      expect(t).not.toContain("command not found");
      expect(t).not.toContain("error");
    });

    test("multi-stage pipe runs without crash", async ({ page }) => {
      // grep -v isn't implemented — the test verifies the pipe stages
      // execute (even if grep -v just matches literal "-v"). The point
      // is the multi-stage chain doesn't blow up.
      await dispatchCmd(page, "cat welcome.md | grep -v ^ | wc -l");
      const t = await terminalText(page);
      expect(t).not.toContain("command not found");
    });

    test("tab autocomplete: 'cat we' → 'lcome.md'", async ({ page }) => {
      // The tab-hint layer reads the current input + cwd and writes the
      // completion to #tab-hint. We need REAL keystrokes for the hint
      // to materialize, since the input.js listener watches `input`
      // events, not the synthetic Enter we use elsewhere.
      await page.locator("#cmd-input").focus();
      await page.keyboard.type("cat we");
      // Wait for the hint span to update (it's a DOM mutation, no
      // promise to await — use a short polled wait).
      await page.waitForFunction(
        () => document.getElementById("tab-hint")?.innerText === "lcome.md",
        null,
        { timeout: 1500 },
      );
      const hint = await page.locator("#tab-hint").innerText();
      expect(hint).toBe("lcome.md");
    });
  });

  // ── v1.3.0 — system commands + text processing (lobby) ────────────
  // No level data needed — `which` / `type` / `id` / `uname` / `date` /
  // `uptime` / `hostname` are all engine-level. Text-processing smoke
  // tests use stdin only.
  test.describe("v1.3.0 system commands + text processing (lobby)", () => {
    test("which ls returns /usr/bin/ls", async ({ page }) => {
      await dispatchCmd(page, "which ls");
      const t = await terminalText(page);
      expect(t).toContain("/usr/bin/ls");
    });

    test("which on unknown command prints 'not found'", async ({ page }) => {
      await dispatchCmd(page, "which nope-asdf");
      const t = await terminalText(page);
      expect(t).toContain("nope-asdf: command not found");
    });

    test("type cat prints 'is a shell builtin'", async ({ page }) => {
      await dispatchCmd(page, "type cat");
      const t = await terminalText(page);
      expect(t).toContain("cat is a shell builtin");
    });

    test("id prints uid=1000(guest) + groups=", async ({ page }) => {
      await dispatchCmd(page, "id");
      const t = await terminalText(page);
      expect(t).toMatch(/uid=1000\(guest\)/);
      expect(t).toMatch(/groups=/);
    });

    test("uname prints 'Linux'", async ({ page }) => {
      await dispatchCmd(page, "uname");
      const t = await terminalText(page);
      const after = t.split("uname")[1] || "";
      expect(after).toMatch(/\bLinux\b/);
    });

    test("uname -a includes the d3cyph3r kernel signature", async ({ page }) => {
      await dispatchCmd(page, "uname -a");
      const t = await terminalText(page);
      expect(t).toContain("d3cyph3r");
    });

    test("hostname prints 'd3cyph3r' at the lobby", async ({ page }) => {
      await dispatchCmd(page, "hostname");
      const t = await terminalText(page);
      const after = t.split("hostname")[1] || "";
      expect(after).toMatch(/\bd3cyph3r\b/);
    });

    test("date prints day-of-week + month", async ({ page }) => {
      await dispatchCmd(page, "date");
      const t = await terminalText(page);
      expect(t).toMatch(/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/);
    });

    test("uptime prints 'up' + 'load average'", async ({ page }) => {
      await dispatchCmd(page, "uptime");
      const t = await terminalText(page);
      expect(t).toContain("up");
      expect(t).toContain("load average");
    });

    test("echo | wc -w counts 2 words", async ({ page }) => {
      await dispatchCmd(page, "echo hello world | wc -w");
      const t = await terminalText(page);
      const after = t.split("echo hello world | wc -w")[1] || "";
      expect(after).toMatch(/\b2\b/);
    });

    test("cut -d : -f 2 extracts 'b' from a:b:c", async ({ page }) => {
      await dispatchCmd(page, "echo a:b:c | cut -d : -f 2");
      const t = await terminalText(page);
      const after = t.split("cut -d : -f 2")[1] || "";
      expect(after).toMatch(/\bb\b/);
    });
  });

  // ── v1.4.0 — learning aids (lobby) ────────────────────────────────
  // `hint` at lobby gracefully refuses; `man` + `what-is` + `awk` all
  // work from anywhere (engine-level commands).
  test.describe("v1.4.0 learning aids (lobby)", () => {
    test("hint at lobby gracefully refuses", async ({ page }) => {
      await dispatchCmd(page, "hint");
      const t = await terminalText(page);
      expect(t).toContain("ssh into a level first");
    });

    test("man ls returns the 4-section catalog entry", async ({ page }) => {
      await dispatchCmd(page, "man ls");
      const t = await terminalText(page);
      expect(t).toContain("NAME");
      expect(t).toContain("SYNOPSIS");
      expect(t).toContain("DESCRIPTION");
      expect(t).toContain("EXAMPLES");
      expect(t).toMatch(/Long format/);
    });

    test("man jwt covers JWT-specific red flags", async ({ page }) => {
      await dispatchCmd(page, "man jwt");
      const t = await terminalText(page);
      expect(t.includes("alg: none") || t.includes("alg: 'none'")).toBeTruthy();
    });

    test("man hint exists (self-referential entry)", async ({ page }) => {
      await dispatchCmd(page, "man hint");
      const t = await terminalText(page);
      expect(
        t.includes("nudge for the current level") || t.includes("most-direct"),
      ).toBeTruthy();
    });

    test("man on unknown command prints 'No manual entry'", async ({ page }) => {
      await dispatchCmd(page, "man this-command-does-not-exist");
      const t = await terminalText(page);
      expect(t).toContain("No manual entry for this-command-does-not-exist");
    });

    test("what-is CWE returns the Common Weakness Enumeration entry", async ({ page }) => {
      await dispatchCmd(page, "what-is CWE");
      const t = await terminalText(page);
      expect(t).toContain("Common Weakness Enumeration");
      expect(t).toContain("MITRE");
    });

    test("what-is is case-insensitive (cwe → CWE entry)", async ({ page }) => {
      await dispatchCmd(page, "what-is cwe");
      const t = await terminalText(page);
      expect(t).toContain("Common Weakness Enumeration");
    });

    test("what-is CWE-798 returns the Hard-coded Credentials entry", async ({ page }) => {
      await dispatchCmd(page, "what-is CWE-798");
      const t = await terminalText(page);
      expect(t).toContain("Hard-coded Credentials");
    });

    test("what-is JWT explains the three-segment format", async ({ page }) => {
      await dispatchCmd(page, "what-is JWT");
      const t = await terminalText(page);
      expect(t.includes("header.payload.signature") || t.includes("three")).toBeTruthy();
    });

    test("what-is FERPA explains student-records privacy", async ({ page }) => {
      await dispatchCmd(page, "what-is FERPA");
      const t = await terminalText(page);
      expect(t).toContain("student");
      expect(t).toContain("education records");
    });

    test("what-is on unknown term prints 'not in the glossary'", async ({ page }) => {
      await dispatchCmd(page, "what-is asdfasdf-not-a-real-term");
      const t = await terminalText(page);
      expect(t).toContain("not in the glossary");
    });

    test("awk '{print $1}' on stdin prints first field", async ({ page }) => {
      await dispatchCmd(page, "echo hello world | awk '{print $1}'");
      const t = await terminalText(page);
      const after = t.split("awk '{print $1}'")[1] || "";
      expect(after).toMatch(/\bhello\b/);
    });

    test("awk '{print $2}' on stdin prints second field", async ({ page }) => {
      await dispatchCmd(page, "echo hello world | awk '{print $2}'");
      const t = await terminalText(page);
      const after = t.split("awk '{print $2}'")[1] || "";
      expect(after).toMatch(/\bworld\b/);
    });

    test("awk '{print $1, $2}' joins both fields with OFS", async ({ page }) => {
      await dispatchCmd(page, "echo hello world | awk '{print $1, $2}'");
      const t = await terminalText(page);
      const after = t.split("awk '{print $1, $2}'")[1] || "";
      expect(after).toMatch(/hello world/);
    });

    test("awk -F: '{print $2}' splits on colon", async ({ page }) => {
      await dispatchCmd(page, "echo a:b:c | awk -F: '{print $2}'");
      const t = await terminalText(page);
      const after = t.split("awk -F: '{print $2}'")[1] || "";
      expect(after).toMatch(/^\s*b\s*$/m);
    });

    test("awk '/regex/ {print ...}' fires on matching lines", async ({ page }) => {
      await dispatchCmd(page, "echo hello | awk '/h/ {print $1}'");
      const t = await terminalText(page);
      const after = t.split("awk '/h/")[1] || "";
      expect(after).toMatch(/\bhello\b/);
    });
  });

  // ── v1.4.0 — hint progression (level0@linux) ──────────────────────
  // level0@linux is seeded with 3 hints; we exercise the advance +
  // reset + list + walkthrough-fallback paths.
  test.describe("v1.4.0 hint progression (level0@linux)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@linux");
      await waitForOutput(page, "Connected: level0@linux");
      await dismissPersistencePrompt(page);
    });

    test("hint reset returns to the first hint", async ({ page }) => {
      await dispatchCmd(page, "hint reset");
      const t = await terminalText(page);
      expect(t).toContain("[hint 1/3]");
    });

    test("hint advances 1 → 2 → 3 with the smoking gun on hint 3", async ({ page }) => {
      await dispatchCmd(page, "hint reset");
      await dispatchCmd(page, "hint");
      let t = await terminalText(page);
      expect(t).toContain("[hint 2/3]");

      await dispatchCmd(page, "hint");
      t = await terminalText(page);
      expect(t).toContain("[hint 3/3]");
      const afterThird = t.split("[hint 3/3]")[1] || "";
      expect(afterThird).toMatch(/creds\.txt/);
    });

    test("hint past the end falls back to the walkthroughs pointer", async ({ page }) => {
      await dispatchCmd(page, "hint reset");
      // Advance through 2 → 3 → past-the-end.
      await dispatchCmd(page, "hint");
      await dispatchCmd(page, "hint");
      await dispatchCmd(page, "hint");
      const t = await terminalText(page);
      expect(t).toContain("walkthroughs");
    });

    // v2.4.0 — the walkthroughs subsite moved from hash routing
    // (/walkthroughs/#/linux/level0) to static pages
    // (/walkthroughs/linux/level0.html). Both the hint-exhaustion
    // pointer and the `walkthrough` command build that URL, and both
    // are shown to the player, so the format is asserted rather than
    // left to a loose substring match. A regression here sends players
    // to a 404.
    test("hint-exhaustion pointer uses the static walkthrough URL", async ({ page }) => {
      await dispatchCmd(page, "hint reset");
      await dispatchCmd(page, "hint");
      await dispatchCmd(page, "hint");
      await dispatchCmd(page, "hint");
      const t = await terminalText(page);
      expect(t).toContain("/walkthroughs/linux/level0.html");
      expect(t).not.toContain("/walkthroughs/#/");
    });

    test("`walkthrough` command reports the static URL for the current level", async ({ page }) => {
      await dispatchCmd(page, "walkthrough");
      const t = await terminalText(page);
      expect(t).toContain("/walkthroughs/linux/level0.html");
      expect(t).not.toContain("/walkthroughs/#/");
    });

    test("hint list reports the available hint count", async ({ page }) => {
      await dispatchCmd(page, "hint list");
      const t = await terminalText(page);
      expect(t).toMatch(/3 hints available/);
    });
  });

  // ── v1.9.0 — shell environment + jobs (level1@linux) ──────────────
  // level1@linux seeds env_vars (EDITOR=nano, AWS_PROFILE=...) and
  // playerUser=app_admin. The bonus-find on `cat backup.sh` is also
  // here.
  test.describe("v1.9.0 shell env + jobs (level1@linux)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level1@linux");
      await dispatchCmd(page, "please-rotate-me");
      await waitForOutput(page, "Connected: level1@linux");
      await dismissPersistencePrompt(page);
    });

    test("env lists seeded vars + built-in USER", async ({ page }) => {
      await dispatchCmd(page, "env");
      const t = await terminalText(page);
      expect(t).toContain("EDITOR=nano");
      expect(t).toContain("AWS_PROFILE=halton-staging");
      expect(t).toMatch(/USER=app_admin/);
    });

    test("export FOO=bar + echo $FOO prints 'bar'", async ({ page }) => {
      await dispatchCmd(page, "export FOO=bar");
      await dispatchCmd(page, "echo $FOO");
      const t = await terminalText(page);
      const after = t.split("echo $FOO")[1] || "";
      expect(after).toMatch(/\bbar\b/);
    });

    test("unset FOO removes the value (expands to empty)", async ({ page }) => {
      await dispatchCmd(page, "export FOO=bar");
      await dispatchCmd(page, "unset FOO");
      await dispatchCmd(page, "echo before-${FOO}after");
      const t = await terminalText(page);
      expect(t).toMatch(/before-after/);
    });

    test("POSIX-style X=hello assignment + echo expands", async ({ page }) => {
      await dispatchCmd(page, "X=hello");
      await dispatchCmd(page, "echo $X");
      const t = await terminalText(page);
      const after = t.split("echo $X")[1] || "";
      expect(after).toMatch(/hello/);
    });

    test("PS1 customization renders without user@host: layout; unset restores", async ({ page }) => {
      await dispatchCmd(page, "export PS1='> '");
      const customPrompt = await promptText(page);
      expect(customPrompt).not.toContain("@linux:");
      expect(customPrompt.length).toBeGreaterThan(0);

      await dispatchCmd(page, "unset PS1");
      const defaultPrompt = await promptText(page);
      expect(defaultPrompt).toMatch(/@linux:/);
    });

    test("backgrounded cmd prints job header [N] NNNNN, jobs lists, fg replays", async ({ page }) => {
      await dispatchCmd(page, "echo hello-bg &");
      let t = await terminalText(page);
      const afterBg = t.split("echo hello-bg &")[1] || "";
      expect(afterBg).toMatch(/\[\d+\]\s+\d+/);

      await dispatchCmd(page, "jobs");
      t = await terminalText(page);
      expect(t).toMatch(/Done.*echo hello-bg/);

      await dispatchCmd(page, "fg");
      t = await terminalText(page);
      const afterFgOut = t.split("fg")[1] || "";
      expect(afterFgOut).toMatch(/hello-bg/);

      // After fg removes the job, `jobs` prints nothing — confirm by
      // looking at the LATEST output block.
      await dispatchCmd(page, "jobs");
      t = await terminalText(page);
      const afterJobs = t.split("jobs").slice(-1)[0] || "";
      expect(afterJobs).not.toMatch(/Done|Running/);
    });

    test("bonus-find fires on cat backup.sh", async ({ page }) => {
      await dispatchCmd(page, "cat backup.sh");
      const t = await terminalText(page);
      expect(t).toMatch(/Bonus find unlocked: Daniel's backup script/);
    });
  });

  // ── v1.9.0 — dig extended flags (level1@network) ──────────────────
  // level1@network's dnsData has the atlas.internal AXFR records +
  // MX record. +short and +trace work on any populated host.
  test.describe("v1.9.0 dig extended flags (level1@network)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level1@network");
      await dispatchCmd(page, "atlas-default-2025");
      await waitForOutput(page, "Connected: level1@network");
      await dismissPersistencePrompt(page);
    });

    test("dig +short (AXFR) returns answer-only output (no ANSWER SECTION header)", async ({ page }) => {
      await dispatchCmd(page, "dig +short atlas.internal AXFR");
      const t = await terminalText(page);
      const after = t.split("dig +short")[1] || "";
      expect(after).not.toMatch(/ANSWER SECTION/);
    });

    test("dig @server still returns AXFR records", async ({ page }) => {
      await dispatchCmd(page, "dig @8.8.8.8 atlas.internal AXFR");
      const t = await terminalText(page);
      const after = t.split("dig @8.8.8.8")[1] || "";
      expect(after).toMatch(/SOA/);
    });

    test("dig +trace prints root-servers / gtld-servers walk", async ({ page }) => {
      await dispatchCmd(page, "dig atlas.internal +trace");
      const t = await terminalText(page);
      const after = t.split("dig atlas.internal +trace")[1] || "";
      expect(after).toMatch(/root-servers|gtld-servers/);
    });
  });

  // ── v1.9.0 — deeper coverage (level1@linux) ───────────────────────
  // Extra job-control + multi-host pivot + post-pivot env reset.
  test.describe("v1.9.0 deeper coverage (level1@linux)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level1@linux");
      await dispatchCmd(page, "please-rotate-me");
      await waitForOutput(page, "Connected: level1@linux");
      await dismissPersistencePrompt(page);
    });

    test("set is an alias for env — shows USER=app_admin", async ({ page }) => {
      await dispatchCmd(page, "set");
      const t = await terminalText(page);
      expect(t).toMatch(/USER=app_admin/);
    });

    test("export -n acts as unset", async ({ page }) => {
      await dispatchCmd(page, "export TEMP_VAR=tmp");
      await dispatchCmd(page, "export -n TEMP_VAR");
      await dispatchCmd(page, "echo after-unexport:${TEMP_VAR}done");
      const t = await terminalText(page);
      expect(t).toMatch(/after-unexport:done/);
    });

    test("jobs -l prints fake PID column", async ({ page }) => {
      await dispatchCmd(page, "echo j1 &");
      await dispatchCmd(page, "echo j2 &");
      await dispatchCmd(page, "jobs -l");
      const t = await terminalText(page);
      const after = t.split("jobs -l")[1] || "";
      expect(after).toMatch(/\[\d+\]\s+[+\- ]?\s*\d{5}/);
    });

    test("bg %1 prints '[N]+ <cmd> &' echo", async ({ page }) => {
      await dispatchCmd(page, "echo j1 &");
      await dispatchCmd(page, "echo j2 &");
      await dispatchCmd(page, "bg %1");
      const t = await terminalText(page);
      const after = t.split("bg %1")[1] || "";
      expect(after).toMatch(/\[\d+\]\+ echo j1 &/);
    });

    test("kill %2 removes job 2; only job 1 remains", async ({ page }) => {
      await dispatchCmd(page, "echo j1 &");
      await dispatchCmd(page, "echo j2 &");
      await dispatchCmd(page, "kill %2");
      await dispatchCmd(page, "jobs");
      const t = await terminalText(page);
      const after = t.split("jobs").slice(-1)[0] || "";
      expect(after).toMatch(/echo j1/);
      expect(after).not.toMatch(/echo j2/);
    });

    test("disown clears the job table", async ({ page }) => {
      await dispatchCmd(page, "echo j1 &");
      await dispatchCmd(page, "echo j2 &");
      await dispatchCmd(page, "disown");
      await dispatchCmd(page, "jobs");
      const t = await terminalText(page);
      const after = t.split("disown").slice(-1)[0] || "";
      expect(after).not.toMatch(/echo j[12]/);
    });

    test("wait is a no-op (doesn't throw)", async ({ page }) => {
      // The page-error afterEach is the assertion — `wait` shouldn't
      // raise. We still dispatch + assert no 'command not found' to
      // catch the regression where someone removes the no-op handler.
      await dispatchCmd(page, "wait");
      const t = await terminalText(page);
      expect(t).not.toContain("command not found");
    });

    test("kill on unknown PID prints 'No such process'", async ({ page }) => {
      await dispatchCmd(page, "kill 99999");
      const t = await terminalText(page);
      const after = t.split("kill 99999")[1] || "";
      expect(after).toMatch(/No such process/);
    });

    test("ssh into pivot host changes prompt + ls shows pivot's fs", async ({ page }) => {
      await dispatchCmd(page, "ssh dbsvc@halton-bastion");
      // Pivot connect emits a banner; the prompt label updates inside
      // connectTo() synchronously.
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("dbsvc@halton-bastion"),
        null,
        { timeout: 5000 },
      );
      const pivotPrompt = await promptText(page);
      expect(pivotPrompt).toMatch(/dbsvc@halton-bastion/);

      await dispatchCmd(page, "ls");
      let t = await terminalText(page);
      expect(t).toMatch(/backups/);
      expect(t).toMatch(/logs/);
      expect(t).toMatch(/welcome\.md/);

      await dispatchCmd(page, "cat ~/logs/postgresql.log");
      t = await terminalText(page);
      expect(t).toMatch(/pg_dump completed/);
    });

    test("exit from pivot unwinds back to app_admin@linux; env was reset", async ({ page }) => {
      // Set TEMP_VAR in the parent shell.
      await dispatchCmd(page, "export TEMP_VAR=parent");
      await dispatchCmd(page, "ssh dbsvc@halton-bastion");
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("dbsvc@halton-bastion"),
        null,
        { timeout: 5000 },
      );

      // Pop back. The pivot exit calls connectTo({unwind:true}) which
      // doesn't fire the persistence prompt again, so we just wait for
      // the prompt label to flip.
      await dispatchCmd(page, "exit");
      await page.waitForFunction(
        () => document.getElementById("prompt-label")?.innerText.includes("app_admin@linux"),
        null,
        { timeout: 5000 },
      );
      const unwoundPrompt = await promptText(page);
      expect(unwoundPrompt).toMatch(/app_admin@linux:/);

      // env is per-shell — TEMP_VAR set in the parent is gone after
      // unwinding back (current semantics).
      await dispatchCmd(page, "echo before${TEMP_VAR}after");
      const t = await terminalText(page);
      expect(t).toMatch(/beforeafter/);
    });
  });

  // ── v1.9.0 — level0@linux env_vars + bonus-find ───────────────────
  test.describe("v1.9.0 level0@linux env_vars + bonus-find", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@linux");
      await waitForOutput(page, "Connected: level0@linux");
      await dismissPersistencePrompt(page);
    });

    test("env_vars: EDITOR=vi + HISTSIZE=1000", async ({ page }) => {
      await dispatchCmd(page, "env");
      const t = await terminalText(page);
      expect(t).toMatch(/EDITOR=vi/);
      expect(t).toMatch(/HISTSIZE=1000/);
    });

    test("bonus-find fires on cat .bash_history (Daniel's muscle-memory pattern)", async ({ page }) => {
      await dispatchCmd(page, "cat .bash_history");
      const t = await terminalText(page);
      expect(t).toMatch(/Bonus find unlocked: Daniel's muscle-memory pattern/);
    });
  });

  // ── v1.9.0 — curl extended flags (level0@web) ─────────────────────
  // level0@web seeds level.web (response map) for the meridian
  // engagement, so requests resolve to a response object instead of
  // DNS-failing.
  test.describe("v1.9.0 curl extended flags (level0@web)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@web");
      await waitForOutput(page, "Connected: level0@web");
      await dismissPersistencePrompt(page);
    });

    test("curl -v prints '> GET ... HTTP/1.1' request preamble", async ({ page }) => {
      await dispatchCmd(page, "curl -v https://www.meridian.edu");
      const t = await terminalText(page);
      const after = t.split("curl -v ").slice(-1)[0] || "";
      expect(after).toMatch(/> GET .+ HTTP\/1\.1/);
    });

    test("curl -X POST -d -H runs (no 'command not found' / no err)", async ({ page }) => {
      await dispatchCmd(
        page,
        "curl -X POST -d 'a=1' -H 'Content-Type: application/x-www-form-urlencoded' https://www.meridian.edu",
      );
      const t = await terminalText(page);
      const after = t.split("curl -X POST").slice(-1)[0] || "";
      expect(after).not.toMatch(/command not found/);
    });

    test("gobuster dir -u -w threads banner shows the new wordlist", async ({ page }) => {
      await dispatchCmd(
        page,
        "gobuster dir -u https://www.meridian.edu -w /usr/share/wordlists/dirb/big.txt",
      );
      const t = await terminalText(page);
      const after = t.split("gobuster dir").slice(-1)[0] || "";
      expect(after).toMatch(/\/dirb\/big\.txt/);
    });
  });

  // ── v1.9.0 — readline shortcuts (lobby) ───────────────────────────
  // These tests need REAL keystrokes because the readline layer
  // (kill-ring, history-position recall, last-arg recall) lives in
  // input.js's keydown listener and only fires on actual
  // KeyboardEvents — not the synthetic Enter we use for dispatchCmd.
  test.describe("v1.9.0 readline shortcuts (lobby)", () => {
    test("Alt-. inserts last arg of previous command", async ({ page }) => {
      // Seed history with a command whose last arg we can recall.
      await dispatchCmd(page, "echo last-arg-victim");
      await page.locator("#cmd-input").focus();
      await page.locator("#cmd-input").fill("");

      // Alt+Period: insert previous command's last arg.
      await page.keyboard.down("Alt");
      await page.keyboard.press("Period");
      await page.keyboard.up("Alt");
      const inputVal = await page.locator("#cmd-input").inputValue();
      expect(inputVal).toBe("last-arg-victim");
    });

    test("Ctrl-K kills from cursor to end + Ctrl-Y yanks back", async ({ page }) => {
      await page.locator("#cmd-input").focus();
      await page.locator("#cmd-input").fill("hello world");

      // Move cursor to start so Ctrl-K kills the whole line.
      await page.keyboard.down("Control");
      await page.keyboard.press("a");
      await page.keyboard.up("Control");
      await page.keyboard.down("Control");
      await page.keyboard.press("k");
      await page.keyboard.up("Control");
      let inputVal = await page.locator("#cmd-input").inputValue();
      expect(inputVal).toBe("");

      // Ctrl-Y yanks the killed text back from the kill ring.
      await page.keyboard.down("Control");
      await page.keyboard.press("y");
      await page.keyboard.up("Control");
      inputVal = await page.locator("#cmd-input").inputValue();
      expect(inputVal).toBe("hello world");
    });

    test("Alt-B / Alt-F don't insert characters (cursor word-motion)", async ({ page }) => {
      // Alt-B / Alt-F move the cursor word-back / word-forward. We
      // can't cleanly assert cursor position via Playwright, but we
      // CAN verify the modified key combo doesn't drop a character
      // into the input — which is the regression guard.
      await page.locator("#cmd-input").focus();
      await page.locator("#cmd-input").fill("alpha beta gamma");

      await page.keyboard.down("Alt");
      await page.keyboard.press("KeyB");
      await page.keyboard.up("Alt");
      let inputVal = await page.locator("#cmd-input").inputValue();
      expect(inputVal).toBe("alpha beta gamma");

      await page.keyboard.down("Alt");
      await page.keyboard.press("KeyF");
      await page.keyboard.up("Alt");
      inputVal = await page.locator("#cmd-input").inputValue();
      expect(inputVal).toBe("alpha beta gamma");

      // Clear the input so it doesn't dirty subsequent assertions in
      // this context (we share the page across the describe block).
      await page.locator("#cmd-input").fill("");
    });
  });
});
