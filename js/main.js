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

import { isMobile, renderMobileGate } from "./mobile-gate.js";

if (isMobile()) {
  renderMobileGate();
} else {
  // These imports happen unconditionally (ES module semantics), but their
  // side effects are only triggered if we actually call into them.
  const { initInput, setCommandSet } = await import("./terminal/input.js");
  const { startClock }               = await import("./terminal/clock.js");
  const { initTheme, toggleTheme }   = await import("./terminal/theme.js");
  const { boot }                     = await import("./engine/lobby.js");
  const { ALL_CMDS }                 = await import("./commands/index.js");
  const { VERSION_DISPLAY }          = await import("./engine/version.js");
  const { themeToggle }              = await import("./terminal/dom.js");
  const { renderPrompt }             = await import("./terminal/prompt.js");
  const { loadBonusesFromStorage }   = await import("./engine/state.js");
  const { hydrateFromLocal }         = await import("./engine/persistence.js");

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

  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  setCommandSet(ALL_CMDS);
  initInput();
  startClock();
  // Render the prompt label before the kernel-boot sequence starts so
  // the user doesn't see an empty `:~$` line under the boot messages.
  renderPrompt();
  // Restore bonus-finds discovered earlier in this session.
  loadBonusesFromStorage();
  boot();
}
