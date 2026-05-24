// D3CYPH3R entry point. Module loading is hoisted, so all transitive
// imports resolve before this file's top-level code runs.
//
// Order matters at runtime:
//   1. Check mobile → render gate and stop if true
//   2. Wire up the autocomplete word list
//   3. Bind input handlers
//   4. Start clock
//   5. Boot the terminal (prints kernel msgs, then drops into the lobby)

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

  // Apply saved theme BEFORE the boot sequence renders so the player
  // doesn't see a flash of the wrong palette.
  initTheme();

  document.getElementById("topbar-title").textContent = `D3CYPH3R ${VERSION_DISPLAY}`;

  if (themeToggle) themeToggle.addEventListener("click", toggleTheme);

  setCommandSet(ALL_CMDS);
  initInput();
  startClock();
  boot();
}
