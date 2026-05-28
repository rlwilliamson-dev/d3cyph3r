// tests/specs/mobile-pwa.spec.cjs
//
// v1.21.0 PWA + mobile support:
//   - manifest.webmanifest + /sw.js are reachable and well-formed
//   - service worker registers via navigator.serviceWorker.ready and
//     reaches the "active" state
//   - the `sw` command surface (status / --help / clear)
//   - mobile gate: narrow-viewport reload renders the warning gate,
//     surfaces the Continue-anyway button after FINAL_DELAY (5200ms
//     in mobile-gate.js — we wait 5800ms for the small safety margin)
//   - tapping Continue sets the sessionStorage bypass flag and reloads
//     into mobile mode (body.mobile-mode + #softkey-row + #cmd-input)
//   - soft-key buttons insert their literal value at the cursor
//   - bypass persists across a second reload — the gate does NOT
//     re-render and the engine boots directly
//
// Ported from the v1.23.x monolithic playtest.cjs lines 3285-3473.
// Uses the v1.24.0 dispatchCmd helper for engine commands; the PWA /
// mobile-gate machinery is exercised via direct page.evaluate() since
// it's DOM/service-worker plumbing, not engine command surface.
//
// The mobile-gate tests change the viewport to phone-portrait and
// reload to re-trigger main.js's isMobile() check. The 5800ms wait
// before clicking Continue is intentional UX delay — the gate
// deliberately hides the Continue button until the user has had time
// to read why desktop is recommended. Do NOT shrink this.

const { test, expect } = require("@playwright/test");
const { dispatchCmd, terminalText, bootAndWait } = require("../lib/helpers.cjs");

test.describe("PWA service worker", () => {
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

  test("manifest.webmanifest returns 200", async ({ page }) => {
    const resp = await page.evaluate(async () => {
      try {
        const r = await fetch("/manifest.webmanifest");
        return { status: r.status, contentType: r.headers.get("content-type") || "" };
      } catch (e) { return { status: 0, err: String(e) }; }
    });
    expect(resp.status).toBe(200);
  });

  test("/sw.js returns 200 and body looks like the SW source", async ({ page }) => {
    const resp = await page.evaluate(async () => {
      try {
        const r = await fetch("/sw.js");
        return { status: r.status, body: (await r.text()).slice(0, 200) };
      } catch (e) { return { status: 0, err: String(e) }; }
    });
    expect(resp.status).toBe(200);
    expect(resp.body).toContain("D3CYPH3R");
  });

  test("service worker registers and reaches active state", async ({ page }) => {
    // navigator.serviceWorker.ready resolves once the SW registration
    // is active. This is the canonical wait — no blind timeout needed.
    const state = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { supported: false };
      try {
        const reg = await navigator.serviceWorker.ready;
        return {
          supported: true,
          hasRegistration: !!reg,
          active: !!(reg && reg.active),
          scope: reg ? reg.scope : null,
        };
      } catch (e) { return { supported: true, err: String(e) }; }
    });
    expect(state.supported).toBe(true);
    expect(state.hasRegistration).toBe(true);
    expect(state.active).toBe(true);
  });
});

test.describe("sw command", () => {
  test.beforeEach(async ({ page }) => {
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push("[pageerror] " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error") page.errors.push("[console.error] " + m.text());
    });
    await bootAndWait(page, "/");
    // Make sure the SW is active before exercising the `sw` command —
    // the status output depends on navigator.serviceWorker.controller.
    await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        try { await navigator.serviceWorker.ready; } catch (_) {}
      }
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === "passed" && page.errors.length > 0) {
      throw new Error("Engine raised errors:\n" + page.errors.join("\n"));
    }
  });

  test("`sw` prints status header with State/Active version/Scope fields", async ({ page }) => {
    // The sw command handler is sync (returns null); runStatus() prints
    // via print() once the MessageChannel round-trip to the SW resolves.
    // Wait for the "Service worker status" header to appear in #terminal.
    await dispatchCmd(page, "sw");
    await page.waitForFunction(
      () => {
        const t = document.getElementById("terminal");
        return t && t.innerText.includes("Service worker status");
      },
      null,
      { timeout: 5000 }
    );
    const t = await terminalText(page);
    expect(t).toContain("Service worker status");
    expect(t).toMatch(/State:\s+active/);
    expect(t).toContain("Active version:");
    expect(t).toContain("Scope:");
  });

  test("`sw --help` surfaces curated help block", async ({ page }) => {
    await dispatchCmd(page, "sw --help");
    const t = await terminalText(page);
    expect(t).toContain("status");
    expect(t).toContain("update");
    expect(t).toContain("clear");
  });

  test("`sw clear` confirms unregister + cache wipe", async ({ page }) => {
    await dispatchCmd(page, "clear");
    await dispatchCmd(page, "sw clear");
    // Async fire-and-forget — wait for the confirmation line to land.
    await page.waitForFunction(
      () => {
        const t = document.getElementById("terminal");
        return t && (t.innerText.includes("Unregistering") || t.innerText.includes("Done"));
      },
      null,
      { timeout: 5000 }
    );
    const t = await terminalText(page);
    expect(t).toMatch(/Unregistering|Done/);
  });
});

test.describe("mobile gate", () => {
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

  test("narrow viewport renders mobile-gate with Continue-anyway button after FINAL_DELAY", async ({ page }) => {
    // Fresh context — but defensively clear the bypass flag and resize
    // BEFORE the first navigation so the gate runs on a clean state.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem("d3cyph3r-mobile-bypass");
        localStorage.removeItem("d3cyph3r-mobile-bypass");
      } catch (_) {}
    });
    await page.reload();

    // FINAL_DELAY in mobile-gate.js is 5200ms — wait 5800ms to give
    // the Continue button a small safety margin to render. This is
    // an intentional UX delay (read the warning before bypassing).
    await page.waitForTimeout(5800);

    const gateRendered = await page.evaluate(() => {
      return !!document.querySelector(".mobile-gate");
    });
    expect(gateRendered).toBe(true);

    const continueBtnVisible = await page.evaluate(() => {
      const btn = document.getElementById("mobile-gate-continue");
      if (!btn) return false;
      const finalEl = document.getElementById("mobile-gate-final");
      return !!(finalEl && !finalEl.hidden);
    });
    expect(continueBtnVisible).toBe(true);
  });

  test("Continue-anyway sets sessionStorage bypass flag and boots mobile mode", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem("d3cyph3r-mobile-bypass");
        localStorage.removeItem("d3cyph3r-mobile-bypass");
      } catch (_) {}
    });
    await page.reload();
    await page.waitForTimeout(5800);

    // Click Continue — triggers sessionStorage set + reload + engine boot.
    await page.evaluate(() => {
      const btn = document.getElementById("mobile-gate-continue");
      if (btn) btn.click();
    });

    // Wait for the engine to come up AND the mobile-mode bypass branch
    // to apply. cmd-input alone is racy because the element exists in
    // the static HTML before main.js runs — we need both the input
    // present AND body.mobile-mode set (which main.js applies via
    // setMobileMode() after the bypass flag check).
    await page.waitForFunction(
      () => !!document.getElementById("cmd-input") &&
            document.body.classList.contains("mobile-mode"),
      null,
      { timeout: 8000 }
    );

    const bypassPersisted = await page.evaluate(() => {
      try { return sessionStorage.getItem("d3cyph3r-mobile-bypass"); }
      catch (_) { return null; }
    });
    expect(bypassPersisted).toBe("1");

    const mobileModeWired = await page.evaluate(() => {
      return {
        hasClass: document.body.classList.contains("mobile-mode"),
        hasSoftkeyRow: !!document.getElementById("softkey-row"),
        hasInput: !!document.getElementById("cmd-input"),
      };
    });
    expect(mobileModeWired.hasClass).toBe(true);
    expect(mobileModeWired.hasSoftkeyRow).toBe(true);
    expect(mobileModeWired.hasInput).toBe(true);
  });

  test("soft-key '|' button inserts the literal char into the input", async ({ page }) => {
    // Pre-set the bypass flag so the engine boots straight into mobile
    // mode — no need to walk through the 5.8s gate just to test the
    // softkey row.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => {
      try { sessionStorage.setItem("d3cyph3r-mobile-bypass", "1"); } catch (_) {}
    });
    await page.reload();
    await bootAndWait(page, "/");

    const insertedPipe = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".softkey-btn"));
      const pipeBtn = buttons.find(b => b.textContent === "|");
      if (!pipeBtn) return { found: false };
      const input = document.getElementById("cmd-input");
      input.focus();
      input.value = "";
      pipeBtn.click();
      return { found: true, value: input.value };
    });
    expect(insertedPipe.found).toBe(true);
    expect(insertedPipe.value).toBe("|");
  });

  test("soft-key '&&' inserts with spaces around it", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => {
      try { sessionStorage.setItem("d3cyph3r-mobile-bypass", "1"); } catch (_) {}
    });
    await page.reload();
    await bootAndWait(page, "/");

    const insertedAnd = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".softkey-btn"));
      const andBtn = buttons.find(b => b.textContent === "&&");
      if (!andBtn) return { found: false };
      const input = document.getElementById("cmd-input");
      input.focus();
      input.value = "";
      andBtn.click();
      return { found: true, value: input.value };
    });
    expect(insertedAnd.found).toBe(true);
    expect(insertedAnd.value).toBe(" && ");
  });
});

test.describe("mobile bypass persistence", () => {
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

  test("bypass persists across reload — gate does NOT re-render, engine boots directly", async ({ page }) => {
    // Walk the full bypass once, then reload and verify the gate stays
    // suppressed on the second visit within the same session.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem("d3cyph3r-mobile-bypass");
        localStorage.removeItem("d3cyph3r-mobile-bypass");
      } catch (_) {}
    });
    await page.reload();
    await page.waitForTimeout(5800);
    await page.evaluate(() => {
      const btn = document.getElementById("mobile-gate-continue");
      if (btn) btn.click();
    });
    await page.waitForFunction(
      () => !!document.getElementById("cmd-input"),
      null,
      { timeout: 8000 }
    );

    // Second reload — bypass flag is now set, gate must NOT re-render.
    await page.reload();
    await page.waitForFunction(
      () => !!document.getElementById("cmd-input"),
      null,
      { timeout: 8000 }
    );

    const stillBypassed = await page.evaluate(() => {
      return {
        gateRendered: !!document.querySelector(".mobile-gate"),
        hasInput: !!document.getElementById("cmd-input"),
      };
    });
    expect(stillBypassed.gateRendered).toBe(false);
    expect(stillBypassed.hasInput).toBe(true);
  });
});
