// tests/specs/persistence-savecode.spec.cjs
//
// v1.11.0 — opt-in localStorage persistence. Exercises the FULL flow:
// opt-in path + hydration roundtrip across reload, the three
// `progress` subcommands (save-on / save-off / reset), and storage
// isolation from the unrelated d3cyph3r-history / d3cyph3r-theme
// localStorage keys.
//
// v1.20.0 — Stateless save/restore (portable progress codes).
// Verifies the `save` command emits a D3C2-prefixed base64url-grouped
// code with a CRC32 hex tail, `restore --help` and `save --help` land
// curated entries, error handling (no-arg / bad magic / mangled
// checksum), `restore --preview <code>` is non-mutating, the [y/N]
// confirmation prompt + cancel path leaves storage untouched, and
// the full round trip (reset → restore → reload) brings every
// tracked field back (visited, achievements, bonus finds, hint
// counter, level times, onboarding flag).
//
// Ported from the v1.23.x monolithic playtest.cjs lines 2632-3283.
// Uses the v1.24.0 dispatchCmd helper (value-set + Enter dispatch)
// instead of typeAndEnter (per-character typing + blind 80ms wait).
//
// Each describe is serial because the scenarios chain state (opt-in
// → save-off → save-on → reset), and the save/restore round trip
// depends on a code generated earlier in the same run.

const { test, expect } = require("@playwright/test");
const {
  dispatchCmd,
  terminalText,
  bootAndWait,
  resetState,
  waitForOutput,
} = require("../lib/helpers.cjs");

test.describe.serial("opt-in persistence (v1.11.0)", () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("Scenario A: opt-in path + hydration roundtrip across reload", async ({ page }) => {
    await bootAndWait(page, "/");
    await resetState(page);

    // Connect to level0@linux fresh — no password (entry point of the
    // linux track), so connectTo runs immediately and the persistence
    // prompt fires after the connection banner / lesson / objective.
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Save your progress across browser sessions?");
    let t = await terminalText(page);
    expect(t).toContain("Save your progress across browser sessions?");

    // Type 'y' to opt in.
    await dispatchCmd(page, "y");
    await waitForOutput(page, "Progress will be saved to this browser");
    t = await terminalText(page);
    expect(t).toContain("Progress will be saved to this browser");

    const enabledFlag = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-progress-enabled"),
    );
    expect(enabledFlag).toBe("1");

    const blob = await page.evaluate(() => {
      const raw = localStorage.getItem("d3cyph3r-progress");
      return raw ? JSON.parse(raw) : null;
    });
    expect(blob).toBeTruthy();
    expect(typeof blob).toBe("object");
    expect(blob.visited).toContain("level0@linux");

    // Advance the hint counter twice so we can test that it persists.
    await dispatchCmd(page, "hint");
    await dispatchCmd(page, "hint");
    const hintBlobBefore = await page.evaluate(() => {
      const raw = localStorage.getItem("d3cyph3r-progress");
      return raw ? JSON.parse(raw) : {};
    });
    expect(hintBlobBefore["d3cyph3r-hint-level0@linux"]).toBe("2");

    // Reload — sessionStorage gets wiped, but the blob should rehydrate.
    await page.reload();
    await bootAndWait(page, "/");
    const visitedAfterReload = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(visitedAfterReload).toBeTruthy();
    expect(JSON.parse(visitedAfterReload)).toContain("level0@linux");

    const hintAfterReload = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r-hint-level0@linux"),
    );
    expect(hintAfterReload).toBe("2");

    // Reconnect — prompt should NOT fire again (already enabled).
    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Connected: level0@linux");
    t = await terminalText(page);
    expect(t).not.toContain("Save your progress across browser sessions?");
  });

  test("Scenario B/C/D: save-off / save-on / reset + storage isolation", async ({ page }) => {
    // Build up state: opt-in, hint counter, then exercise the
    // three subcommands in sequence.
    await bootAndWait(page, "/");
    await resetState(page);

    await dispatchCmd(page, "ssh level0@linux");
    await waitForOutput(page, "Save your progress across browser sessions?");
    await dispatchCmd(page, "y");
    await waitForOutput(page, "Progress will be saved to this browser");

    // --- Scenario B: progress save-off ---
    await dispatchCmd(page, "progress save-off");
    let t = await terminalText(page);
    expect(t).toContain("Persistence disabled");

    const flagAfterOff = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-progress-enabled"),
    );
    const blobAfterOff = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-progress"),
    );
    expect(flagAfterOff).toBeNull();
    expect(blobAfterOff).toBeNull();
    const visitedAfterOff = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(visitedAfterOff).toBeTruthy();
    expect(JSON.parse(visitedAfterOff)).toContain("level0@linux");

    // --- Scenario C: progress save-on re-enable ---
    await dispatchCmd(page, "progress save-on");
    t = await terminalText(page);
    expect(t).toContain("Progress will be saved to this browser");
    const flagAfterOn = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-progress-enabled"),
    );
    expect(flagAfterOn).toBe("1");

    const blobAfterOn = await page.evaluate(() => {
      const raw = localStorage.getItem("d3cyph3r-progress");
      return raw ? JSON.parse(raw) : null;
    });
    expect(blobAfterOn).toBeTruthy();
    expect(blobAfterOn.visited).toContain("level0@linux");

    // --- Scenario D: progress reset + storage isolation ---
    // Plant a known d3cyph3r-theme value BEFORE the reset (we test
    // theme survival, not history — typing `progress reset` itself
    // mutates history, so the cleanest sentinel is theme).
    await page.evaluate(() => {
      localStorage.setItem("d3cyph3r-theme", "light");
    });
    await dispatchCmd(page, "progress reset");
    t = await terminalText(page);
    expect(t).toContain("Progress wiped");

    const flagAfterReset = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-progress-enabled"),
    );
    // v1.14.0 nuance: 'progress reset' wipes the blob, but the
    // post-dispatch achievement check immediately re-earns
    // achievements whose criteria don't depend on the cleared
    // data — those can repopulate the blob. The intent of D3 is
    // "tracked PROGRESS keys (visited, bonuses, hint counters)
    // are gone".
    const blobAfterReset = await page.evaluate(() => {
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
    const visitedAfterReset = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    const hintAfterReset = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r-hint-level0@linux"),
    );
    expect(flagAfterReset).toBe("1");
    const blobClean =
      blobAfterReset.state === "null" ||
      (!blobAfterReset.hasVisited &&
        !blobAfterReset.hasBonuses &&
        !blobAfterReset.hasAnyHintKey);
    expect(blobClean).toBeTruthy();
    expect(visitedAfterReset).toBeNull();
    expect(hintAfterReset).toBeNull();

    // Storage isolation — d3cyph3r-history and d3cyph3r-theme are
    // NOT tracked by the persistence layer and must survive
    // 'progress reset'. Theme is unaffected by typing commands so
    // it's the clean check here; for history we just verify the
    // key still exists.
    const historyAfter = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-history"),
    );
    const themeAfter = await page.evaluate(() =>
      localStorage.getItem("d3cyph3r-theme"),
    );
    expect(historyAfter).not.toBeNull();
    expect(themeAfter).toBe("light");
  });
});

test.describe.serial("stateless save/restore (v1.20.0)", () => {
  // Two tests in this describe (`restore --preview` and `restore` cancel)
  // captured save-codes via regex from terminalText() and fed them
  // back to restore. Under CI shard pressure (4 parallel runners +
  // workers=4), the captured codes occasionally failed CRC32 validation
  // on the round-trip — a flake that surfaced shard 3/4 of v1.25.0's
  // merge-to-main playtest. Locally these tests pass 8/8; the failure
  // is timing/resource-pressure-bound on CI. test.describe.configure
  // here gives the describe a retry budget of 2 so a single transient
  // CRC mismatch doesn't block a deploy; the underlying tests still
  // need to be hardened (tighter regex extraction would close the
  // root cause). v1.25.1 ships the retry; root-cause work is a future
  // patch.
  test.describe.configure({ retries: 2 });

  // The round-trip test depends on a code generated earlier in this
  // run, so we share state via a module-scoped variable. Each test
  // still gets its own browser context — we re-stage the same
  // sessionStorage in each test that needs the code to be valid.
  let sharedCode = "";

  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
    await bootAndWait(page, "/");
    await resetState(page);

    // Stage a known richer state via sessionStorage BEFORE the test
    // runs (bypassing the engine is intentional — this block tests
    // savecode encode/decode/apply, not the gameplay that produces
    // the state).
    await page.evaluate(() => {
      sessionStorage.setItem("visited", JSON.stringify([
        "level0@linux", "level1@linux", "level0@network",
      ]));
      sessionStorage.setItem("d3cyph3r:earnedAchievements", JSON.stringify([
        "first-steps", "going-deep",
      ]));
      // Use a real bonus-find id that's in BONUS_REGISTRY.
      sessionStorage.setItem("d3cyph3r:bonusFinds", JSON.stringify([
        "level0@linux:daniel-history-pattern",
      ]));
      sessionStorage.setItem("d3cyph3r-hint-level0@linux", "2");
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("--help blocks reference portable code + --preview flag", async ({ page }) => {
    await dispatchCmd(page, "save --help");
    let t = await terminalText(page);
    expect(t).toContain("portable progress code");
    expect(t).toMatch(/\brestore\b/);

    await dispatchCmd(page, "restore --help");
    t = await terminalText(page);
    expect(t).toContain("--preview");
    const lower = t.toLowerCase();
    expect(lower.includes("y/n") || t.includes("validate")).toBeTruthy();
  });

  test("`save` generates a D3C2-prefixed code with CRC tail (< 300 chars)", async ({ page }) => {
    await dispatchCmd(page, "save");
    const t = await terminalText(page);
    expect(t).toContain("Your D3CYPH3R progress code");

    // Codes are "D3C2-" + base64url groups (8-char hyphen-grouped)
    // + a final "-XXXXXXXX" CRC32. Match base64url chars + hyphens.
    // Read the save code from the DOM directly. innerText (via
    // terminalText) reads CSS-visual line breaks because `.line` uses
    // `overflow-wrap: anywhere`, so the longer v1.26.0 codes wrapped
    // visually and innerText inserted `\n` mid-code — fragile to
    // capture via regex against `t` because internal 8-char base64url
    // chunks can spuriously match a `-[0-9a-f]{8}` tail. textContent
    // ignores CSS layout, so the `.line.out` div holding the save
    // code returns the full string unmodified.
    const code = await page.evaluate(() => {
      const lines = document.querySelectorAll("#terminal .line.out");
      for (const line of lines) {
        const txt = line.textContent.trim();
        if (txt.startsWith("D3C2-")) return txt;
      }
      return null;
    });
    expect(code).not.toBeNull();
    expect(code.length).toBeGreaterThan(30);
    expect(code).toMatch(/-[0-9a-f]{8}$/);
    // Binary format keeps mid-game state well under 300 chars.
    expect(code.length).toBeLessThan(300);

    // Cache for the round-trip test below.
    sharedCode = code;
  });

  test("error handling: no-arg / bad magic / mangled checksum", async ({ page }) => {
    // No arg → usage hint.
    await dispatchCmd(page, "restore");
    let t = await terminalText(page);
    expect(t).toContain("Usage:");
    expect(t).toContain("--preview");

    // Garbage (no magic header) → rejected.
    await dispatchCmd(page, "restore not-a-real-code-without-magic-prefix-anywhere-junk");
    t = await terminalText(page);
    const lower = t.toLowerCase();
    expect(t.includes("D3C2") || lower.includes("not a d3cyph3r")).toBeTruthy();

    // Valid magic but mangled checksum → rejected with checksum error.
    await dispatchCmd(page, "restore D3C2-AAAAAAAA-BBBBBBBB-aaaaaaaa");
    t = await terminalText(page);
    const lower2 = t.toLowerCase();
    expect(
      lower2.includes("checksum") || lower2.includes("could not be decoded"),
    ).toBeTruthy();
  });

  test("`restore --preview <code>` does NOT mutate state", async ({ page }) => {
    // Generate a code from the staged state.
    await dispatchCmd(page, "save");
    let t = await terminalText(page);
    // Read the save code from the DOM directly. innerText (via
    // terminalText) reads CSS-visual line breaks because `.line` uses
    // `overflow-wrap: anywhere`, so the longer v1.26.0 codes wrapped
    // visually and innerText inserted `\n` mid-code — fragile to
    // capture via regex against `t` because internal 8-char base64url
    // chunks can spuriously match a `-[0-9a-f]{8}` tail. textContent
    // ignores CSS layout, so the `.line.out` div holding the save
    // code returns the full string unmodified.
    const code = await page.evaluate(() => {
      const lines = document.querySelectorAll("#terminal .line.out");
      for (const line of lines) {
        const txt = line.textContent.trim();
        if (txt.startsWith("D3C2-")) return txt;
      }
      return null;
    });
    expect(code).not.toBeNull();

    const visitedBefore = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    await dispatchCmd(page, `restore --preview ${code}`);
    t = await terminalText(page);
    expect(t).toContain("Progress code preview");
    expect(t).toMatch(/Visited levels:\s+\d+/);
    const visitedAfterPreview = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(visitedAfterPreview).toBe(visitedBefore);
  });

  test("`restore <code>` confirmation prompt + cancel with 'n'", async ({ page }) => {
    await dispatchCmd(page, "save");
    let t = await terminalText(page);
    // Read the save code from the DOM directly. innerText (via
    // terminalText) reads CSS-visual line breaks because `.line` uses
    // `overflow-wrap: anywhere`, so the longer v1.26.0 codes wrapped
    // visually and innerText inserted `\n` mid-code — fragile to
    // capture via regex against `t` because internal 8-char base64url
    // chunks can spuriously match a `-[0-9a-f]{8}` tail. textContent
    // ignores CSS layout, so the `.line.out` div holding the save
    // code returns the full string unmodified.
    const code = await page.evaluate(() => {
      const lines = document.querySelectorAll("#terminal .line.out");
      for (const line of lines) {
        const txt = line.textContent.trim();
        if (txt.startsWith("D3C2-")) return txt;
      }
      return null;
    });
    expect(code).not.toBeNull();

    const visitedBefore = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    await dispatchCmd(page, `restore ${code}`);
    t = await terminalText(page);
    expect(t).toContain("OVERWRITE your current progress");
    expect(t).toContain("[y/N]");

    await dispatchCmd(page, "n");
    t = await terminalText(page);
    expect(t).toContain("Restore cancelled");
    const visitedAfterCancel = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(visitedAfterCancel).toBe(visitedBefore);
  });

  test("full round trip: reset → restore → reload → state back", async ({ page }) => {
    // Generate a code from the staged state.
    await dispatchCmd(page, "save");
    let t = await terminalText(page);
    // Read the save code from the DOM directly. innerText (via
    // terminalText) reads CSS-visual line breaks because `.line` uses
    // `overflow-wrap: anywhere`, so the longer v1.26.0 codes wrapped
    // visually and innerText inserted `\n` mid-code — fragile to
    // capture via regex against `t` because internal 8-char base64url
    // chunks can spuriously match a `-[0-9a-f]{8}` tail. textContent
    // ignores CSS layout, so the `.line.out` div holding the save
    // code returns the full string unmodified.
    const code = await page.evaluate(() => {
      const lines = document.querySelectorAll("#terminal .line.out");
      for (const line of lines) {
        const txt = line.textContent.trim();
        if (txt.startsWith("D3C2-")) return txt;
      }
      return null;
    });
    expect(code).not.toBeNull();

    // Plant a level-times entry so we can confirm it round-trips.
    await page.evaluate(() => {
      sessionStorage.setItem(
        "d3cyph3r:levelTimes",
        JSON.stringify({
          "level0@linux": { totalMs: 5000, isSolved: true, firstSolveMs: 5000 },
        }),
      );
      sessionStorage.setItem("seenOnboarding", "true");
    });

    // We need the seenOnboarding flag in the saved code, so regenerate.
    await dispatchCmd(page, "save");
    t = await terminalText(page);
    const codeMatch2 = t.match(/D3C2-[A-Za-z0-9_-]+/g);
    expect(codeMatch2).not.toBeNull();
    const code2 = codeMatch2[codeMatch2.length - 1];

    // Wipe everything we tracked.
    await dispatchCmd(page, "progress reset");
    const visitedAfterResetV120 = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(
      visitedAfterResetV120 === null ||
        visitedAfterResetV120 === "[]" ||
        visitedAfterResetV120 === "",
    ).toBeTruthy();

    // Restore from a clean slate, confirm with 'y'. The handler
    // triggers window.location.reload() after a 1200ms delay;
    // sessionStorage survives the reload (same tab).
    await dispatchCmd(page, `restore ${code2}`);
    await dispatchCmd(page, "y");
    // Wait for the success line, the 1200ms delay, the reload
    // itself, and the boot sequence to finish.
    await page.waitForFunction(
      () => {
        const v = sessionStorage.getItem("visited");
        return v && v.includes("level0@linux") && v.includes("level1@linux");
      },
      null,
      { timeout: 8000 },
    );

    const visitedAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("visited"),
    );
    expect(visitedAfterRestore).toContain("level0@linux");
    expect(visitedAfterRestore).toContain("level1@linux");
    expect(visitedAfterRestore).toContain("level0@network");

    const achievementsAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r:earnedAchievements"),
    );
    expect(achievementsAfterRestore).toContain("first-steps");
    expect(achievementsAfterRestore).toContain("going-deep");

    const bonusFindsAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r:bonusFinds"),
    );
    expect(bonusFindsAfterRestore).toContain("daniel-history-pattern");

    const hintAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r-hint-level0@linux"),
    );
    expect(hintAfterRestore).toBe("2");

    const levelTimesAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("d3cyph3r:levelTimes"),
    );
    expect(levelTimesAfterRestore).toContain("level0@linux");

    // Onboarding flag should also have round-tripped.
    const onboardingAfterRestore = await page.evaluate(() =>
      sessionStorage.getItem("seenOnboarding"),
    );
    expect(onboardingAfterRestore).toBe("true");
  });
});
