// D3CYPH3R entry point. Module loading is hoisted, so all transitive
// imports resolve before this file's top-level code runs.
//
// Order matters at runtime:
//   1. Greet anyone reading the console (privacy-posture credibility)
//   2. Check mobile → render gate and stop if true
//   3. Wire up the autocomplete word list
//   4. Bind input handlers
//   5. Start clock
//   6. Boot the terminal (prints kernel msgs, then drops into the lobby)

// Privacy-posture credibility for the DevTools-opening minority. The
// site's CSP correctly blocks any third-party scripts Cloudflare auto-
// injects onto the proxied domain (an analytics beacon and a bot-
// detection challenge). Those rejections show up as CSP errors in the
// console, which looks like a problem at first glance. This info line
// explains they're the security policy enforcing the README's
// "no third-party scripts" claim — visible proof, not just a promise.
console.info(
  "%cD3CYPH3R%c — no analytics, no telemetry, no third-party scripts.\n" +
  "Any CSP errors above from static.cloudflareinsights.com or /cdn-cgi/* " +
  "are Cloudflare auto-injections that our security policy correctly blocks. " +
  "Privacy posture working as designed. → https://github.com/rlwilliamson-dev/d3cyph3r#about-this-project",
  "color: #58a6ff; font-weight: 700; font-family: 'JetBrains Mono', monospace;",
  "color: inherit;"
);

import { isMobile, isMobileBypassed, renderMobileGate } from "./mobile-gate.js";

// v1.21.0: the mobile gate became a WARNING rather than a hard block.
// Players can tap "Continue anyway" (sets localStorage flag) OR launch
// the installed PWA (matchMedia "standalone") to bypass. Either way,
// isMobileBypassed() returns true and the engine boots with a mobile-
// mode flag set so responsive CSS + soft-key row kick in.
const onMobile = isMobile();
const mobileBypassed = onMobile && isMobileBypassed();

if (onMobile && !mobileBypassed) {
  renderMobileGate();
} else {
  // These imports happen unconditionally (ES module semantics), but their
  // side effects are only triggered if we actually call into them.
  const { initInput, setCommandSet } = await import("./terminal/input.js");
  const { startClock }               = await import("./terminal/clock.js");
  const { initTheme, cycleTheme, getTheme } = await import("./terminal/theme.js");
  const { boot }                     = await import("./engine/lobby.js");
  const { ALL_CMDS }                 = await import("./commands/index.js");
  const { VERSION_DISPLAY }          = await import("./engine/version.js");
  const { themeToggle }              = await import("./terminal/dom.js");
  const { renderPrompt }             = await import("./terminal/prompt.js");
  const { loadBonusesFromStorage }   = await import("./engine/state.js");
  const { hydrateFromLocal }         = await import("./engine/persistence.js");
  const { initLevelTimer, flushCurrentLevel } = await import("./engine/leveltimer.js");
  const { setMobileMode }            = await import("./engine/state.js");
  const { registerServiceWorker }    = await import("./engine/pwa.js");

  // v1.21.0: tell the engine we're running in mobile-bypass mode so
  // responsive CSS hooks + the soft-key row activate. The mobile-mode
  // flag is read on demand by terminal/input.js (soft-key row) and
  // any other module that needs to adapt.
  setMobileMode(mobileBypassed);
  if (mobileBypassed) {
    document.body.classList.add("mobile-mode");
  }

  // Apply saved theme BEFORE the boot sequence renders so the player
  // doesn't see a flash of the wrong palette.
  initTheme();

  // Hydrate sessionStorage from the persistence blob BEFORE any
  // module reads session state (loadBonusesFromStorage immediately
  // below, the lobby's first render inside boot()). If the player
  // opted into persistence on a prior visit, this is where their
  // progress comes back. No-op if they never opted in.
  hydrateFromLocal();

  document.getElementById("topbar-title").textContent = `D3CYPH3R ${VERSION_DISPLAY}`;

  // v1.13.0: the topbar button cycles through ALL 11 themes (was a
  // binary dark/light toggle). The button's title is refreshed
  // after every click so hovering shows the new theme name.
  if (themeToggle) {
    const refreshTitle = () => {
      const t = getTheme();
      themeToggle.title = `Theme: ${t.name} — click to cycle (or run 'themes' / 'theme <name>')`;
    };
    refreshTitle();
    themeToggle.addEventListener("click", () => { cycleTheme(); refreshTitle(); });
  }

  setCommandSet(ALL_CMDS);
  initInput();
  startClock();
  // Render the prompt label before the kernel-boot sequence starts so
  // the user doesn't see an empty `:~$` line under the boot messages.
  renderPrompt();
  // Restore bonus-finds discovered earlier in this session.
  loadBonusesFromStorage();
  // v1.16.0: rehydrate per-level timing data from sessionStorage
  // (which hydrateFromLocal above will have populated from the
  // localStorage blob, if persistence is on). Runs AFTER bonus-finds
  // load so module init order stays alphabetical-ish; no ordering
  // dependency between the two.
  initLevelTimer();
  // v1.16.0: flush the running level timer on tab close so the
  // time accumulated in the currently-open level isn't lost.
  // beforeunload is best-effort — some browsers skip it during
  // hard tab close, but for the common refresh-and-navigate case
  // it captures the trailing elapsed.
  window.addEventListener("beforeunload", () => {
    try { flushCurrentLevel(); } catch (_) { /* silent */ }
  });
  boot();

  // v1.21.0: register the service worker AFTER engine boot so SW
  // installation doesn't compete with first-paint. The registration
  // promise is fire-and-forget — SW is a nice-to-have, not a blocker.
  // pwa.js handles its own failure modes (older browsers, file://
  // origin, registration errors) so we don't need to catch here.
  registerServiceWorker();
}
