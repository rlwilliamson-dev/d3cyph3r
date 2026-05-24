// D3CYPH3R requires a physical keyboard for the terminal-input model
// to work, so we hard-block mobile devices with a themed boot-fail
// screen rather than serving a broken UI.
//
// The gate triggers BEFORE any engine modules load (see main.js's
// short-circuit), so this module is intentionally self-contained —
// it doesn't import the lobby, the dispatcher, or the level data.
// Theme support is the only optional dependency: if `body.light` was
// set by a previous visit, the mobile gate inherits the light palette
// via the same CSS variables the main app uses.

export function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      || window.innerWidth < 900;
}

// Boot-log lines that appear in sequence during the fake startup.
// Timings (in ms from gate render) are chosen so the last line lands
// just under the 5-second progress-bar duration, with the final
// "keyboard required" block fading in right after the bar fills.
const BOOT_LINES = [
  { t:  200, text: "Booting D3CYPH3R kernel..." },
  { t:  700, text: "Initializing terminal interface..." },
  { t: 1300, text: "Checking input devices..." },
  { t: 2000, text: "Keyboard: NOT DETECTED",            cls: "warn" },
  { t: 2600, text: "Verifying display resolution..." },
  { t: 3200, text: "Resolution: UNSUPPORTED",           cls: "warn" },
  { t: 3800, text: "Device classification: MOBILE" },
  { t: 4400, text: "Applying compatibility layer..." },
  { t: 4900, text: "ERROR: Compatibility layer failed", cls: "err" },
];

// Delay before the final block appears. Matches the 5s progress-bar
// duration plus a small buffer so the bar has clearly completed
// before the explanation appears.
const FINAL_DELAY = 5200;

/**
 * Apply the theme preference saved by an earlier visit (potentially
 * on desktop). The mobile gate doesn't expose its own toggle — the
 * user can't usefully play either way — but inheriting the choice
 * keeps the visual identity consistent across devices on the same
 * account.
 */
function applySavedTheme() {
  try {
    if (localStorage.getItem("d3cyph3r-theme") === "light") {
      document.body.classList.add("light");
    }
  } catch (_) { /* localStorage unavailable — default to dark */ }
}

export function renderMobileGate() {
  applySavedTheme();

  // All styling lives in style.css under `.mobile-gate*` selectors.
  // No inline `style=` attributes — those would be blocked by our
  // CSP (`style-src 'self'`).
  document.body.innerHTML = `
    <div class="mobile-gate">
      <div class="mobile-gate-inner">
        <h1 class="mobile-gate-brand">D3CYPH3R</h1>
        <p class="mobile-gate-tagline">Terminal CTF · starting up</p>

        <div class="mobile-gate-progress" role="progressbar" aria-label="Boot progress">
          <div class="mobile-gate-progress-fill"></div>
        </div>

        <div class="mobile-gate-log" id="mobile-gate-log" aria-live="polite"></div>

        <div class="mobile-gate-final" id="mobile-gate-final" hidden>
          <p class="mobile-gate-final-title">Keyboard required</p>
          <p class="mobile-gate-final-body">
            D3CYPH3R is a keyboard-driven terminal experience.
            The puzzles need a real keyboard and a desktop browser —
            touch input doesn't work for the command-line interface.
          </p>
          <p class="mobile-gate-final-cta">
            Bookmark this page and revisit from a laptop or desktop.
          </p>
          <p class="mobile-gate-final-links">
            <a href="https://github.com/rlwilliamson-dev/d3cyph3r" target="_blank" rel="noopener noreferrer">
              View source on GitHub →
            </a>
          </p>
        </div>
      </div>
    </div>
  `;

  const logEl = document.getElementById("mobile-gate-log");
  for (const { t, text, cls } of BOOT_LINES) {
    setTimeout(() => {
      const line = document.createElement("div");
      line.className = "mobile-gate-log-line" + (cls ? " " + cls : "");
      line.textContent = text;
      logEl.appendChild(line);
    }, t);
  }

  setTimeout(() => {
    const finalEl = document.getElementById("mobile-gate-final");
    if (finalEl) finalEl.hidden = false;
  }, FINAL_DELAY);
}
