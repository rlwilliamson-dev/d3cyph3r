// tests/specs/shell-features.spec.cjs
//
// Shell-layer behaviors that aren't tied to any particular level:
//   - v1.8.0 shell composition (&&) + single/double quoting + $(...)
//     command substitution + brace expansion + single-quote
//     literalness for $VAR.
//   - v1.15.0 "Did you mean…" typo suggestions across the COMMANDS
//     pool (plus `ssh`), with the conservative distance thresholds
//     and the explicit case-mismatch tip. Includes the far-away
//     negative case — gibberish like "definitelynotacommand" must
//     NOT produce a suggestion.
//   - v1.5.0 symlink rendering + traversal (`ls -la`, `readlink`,
//     `realpath`, `cat <symlink>`). Symlink demo data lives in
//     level0@linux's $HOME (`.notes` -> `notes.txt`), so this group
//     ssh's into that level once.
//
// Ported from the v1.23.x monolithic playtest.cjs lines 176-464.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each test() block gets its own browser context via the Playwright
// Test fixture, so the boot (and ssh-in, for the symlink describe)
// runs fresh per test.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe("shell features", () => {
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

  // ── v1.8.0 shell composition + quoting + $(...) ──────────────────
  // All four tests run from the lobby — no level data needed; the
  // tokenizer / expansion path is engine-wide.
  test.describe("shell composition + quoting + substitution", () => {
    test("&&: both commands run when first succeeds", async ({ page }) => {
      await dispatchCmd(page, "echo a && echo b");
      const t = await terminalText(page);
      // Split on the echoed command line so we assert on output,
      // not the echo itself, then look for 'a' followed by 'b'.
      const after = t.split("echo a && echo b")[1] || "";
      expect(after).toMatch(/\ba\b[\s\S]*\bb\b/);
    });

    test("single-quoted args preserve internal spaces", async ({ page }) => {
      await dispatchCmd(page, "echo 'hello world'");
      const t = await terminalText(page);
      const after = t.split("echo 'hello world'")[1] || "";
      expect(after).toMatch(/hello world/);
    });

    test("command substitution $(whoami) expands inside double-quotes", async ({ page }) => {
      await dispatchCmd(page, "echo \"user: $(whoami)\"");
      const t = await terminalText(page);
      // At the lobby the in-world identity is `guest`.
      expect(t).toContain("user: guest");
    });

    test("brace expansion produces 3 entries", async ({ page }) => {
      await dispatchCmd(page, "echo {a,b,c}.txt");
      const t = await terminalText(page);
      const after = t.split("echo {a,b,c}.txt")[1] || "";
      expect(after).toMatch(/a\.txt b\.txt c\.txt/);
    });

    test("single-quoted $USER does NOT expand", async ({ page }) => {
      await dispatchCmd(page, "echo 'has $USER'");
      const t = await terminalText(page);
      // The literal `has $USER` should appear at least twice in the
      // terminal — once in the command echo, once in the output —
      // and `has guest` (the expanded form) should never appear.
      const literalMatches = (t.match(/has \$USER/g) || []).length;
      expect(literalMatches).toBeGreaterThanOrEqual(2);
      expect(t).not.toContain("has guest");
    });
  });

  // ── v1.15.0 — Did-you-mean typo suggestions ──────────────────────
  // Conservative thresholds (≤1 for typed length ≤3, ≤2 for length
  // 4+), case-insensitive match against COMMANDS keys + 'ssh'.
  // Each typo gets a fresh context so prior suggestions in scrollback
  // can't false-match a later assertion.
  test.describe("did-you-mean (v1.15.0)", () => {
    test("long nonsense gets NO 'Did you mean' suggestion", async ({ page }) => {
      // 22-char gibberish is well outside the distance-2 ceiling for
      // any registered command — the far-away guard must hold.
      await dispatchCmd(page, "definitelynotacommand");
      const t = await terminalText(page);
      expect(t).toContain("command not found");
      // The 'Did you mean' tip must NOT follow this specific error.
      expect(t).not.toMatch(/definitelynotacommand[\s\S]*?Did you mean/);
    });

    test("'lss' suggests 'ls'", async ({ page }) => {
      await dispatchCmd(page, "lss");
      const t = await terminalText(page);
      expect(t).toContain("Did you mean: ls?");
    });

    test("'catt' suggests 'cat'", async ({ page }) => {
      await dispatchCmd(page, "catt");
      const t = await terminalText(page);
      expect(t).toContain("Did you mean: cat?");
    });

    test("'sshh' suggests 'ssh' (ssh is in candidate pool)", async ({ page }) => {
      await dispatchCmd(page, "sshh");
      const t = await terminalText(page);
      expect(t).toContain("Did you mean: ssh?");
    });

    test("'LS' suggests 'ls' with lowercase tip", async ({ page }) => {
      // Pure case-mismatch: confirm the lowercase tip fires so we
      // don't print a confusing "did you mean: ls?" when the player
      // essentially typed `ls` but capitalized.
      await dispatchCmd(page, "LS");
      const t = await terminalText(page);
      expect(t).toContain("Did you mean: ls?");
      expect(t).toContain("command names are lowercase");
    });
  });

  // ── v1.5.0 symlink rendering + traversal ─────────────────────────
  // Symlink demo lives in level0@linux's $HOME (`.notes -> notes.txt`).
  // This describe ssh's in once and runs five assertions against
  // that level's filesystem.
  test.describe("symlinks (v1.5.0)", () => {
    test.beforeEach(async ({ page }) => {
      await dispatchCmd(page, "ssh level0@linux");
      await waitForOutput(page, "Connected: level0@linux");
      // v1.11.0 — first non-lobby connect of the session fires the
      // persistence opt-in prompt. Dismiss with 'n' so the rest of
      // the test types normal commands.
      await waitForOutput(page, "Save your progress across browser sessions?");
      await dispatchCmd(page, "n");
      await waitForOutput(page, "Progress stays in this tab only");
    });

    test("ls -la renders symlink with lrwxrwxrwx mode + target", async ({ page }) => {
      await dispatchCmd(page, "ls -la");
      const t = await terminalText(page);
      expect(t).toMatch(/lrwxrwxrwx.*\.notes -> notes\.txt/);
    });

    test("readlink .notes prints the literal target", async ({ page }) => {
      await dispatchCmd(page, "readlink .notes");
      const t = await terminalText(page);
      const after = t.split("readlink .notes")[1] || "";
      expect(after).toMatch(/^\s*notes\.txt\s*$/m);
    });

    test("readlink on a non-symlink prints 'Invalid argument'", async ({ page }) => {
      await dispatchCmd(page, "readlink notes.txt");
      const t = await terminalText(page);
      expect(t).toContain("readlink: notes.txt: Invalid argument");
    });

    test("readlink on missing file prints 'No such file or directory'", async ({ page }) => {
      await dispatchCmd(page, "readlink nonexistent-file");
      const t = await terminalText(page);
      expect(t).toContain("readlink: nonexistent-file: No such file or directory");
    });

    test("realpath .notes resolves to /home/daniel/notes.txt", async ({ page }) => {
      await dispatchCmd(page, "realpath .notes");
      const t = await terminalText(page);
      expect(t).toContain("/home/daniel/notes.txt");
    });

    test("realpath on regular file prints absolute path", async ({ page }) => {
      await dispatchCmd(page, "realpath notes.txt");
      const t = await terminalText(page);
      // Use the LAST split segment (in case the literal /home/daniel
      // appears elsewhere in scrollback) to check the output.
      const segments = t.split("realpath notes.txt");
      const after = segments[segments.length - 1] || "";
      expect(after).toMatch(/\/home\/daniel\/notes\.txt/);
    });

    test("cat <symlink> reads through to target content", async ({ page }) => {
      await dispatchCmd(page, "cat .notes");
      const t = await terminalText(page);
      const after = t.split("cat .notes")[1] || "";
      // notes.txt's content includes Halton / notes / TODO references.
      expect(after).toMatch(/Halton|notes|TODO/i);
    });
  });
});
