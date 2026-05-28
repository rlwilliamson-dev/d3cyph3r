// D3CYPH3R is designed for a physical keyboard, so we render a
// themed boot-fail screen on mobile devices to set expectations
// before the engine loads. As of v1.21.0 the gate is a WARNING,
// not a hard block — players who tap "Continue anyway" get routed
// to the engine with a mobile-mode flag set (state.isMobileMode),
// which surfaces a soft-key row above the on-screen keyboard plus
// responsive CSS adjustments.
//
// The gate triggers BEFORE any engine modules load (main.js's
// short-circuit), so this module is intentionally self-contained —
// no imports from the engine, dispatcher, or level data. Theme
// support is the only optional dependency: if `body.light` was set
// by a previous visit, the gate inherits the light palette via the
// same CSS variables the main app uses.
//
// BYPASS PERSISTENCE
// ------------------
// As of v1.21.0-r7, "Continue anyway" sets a SESSION-SCOPED flag
// (sessionStorage, not localStorage). The flag survives reloads
// within the same tab so a refresh-mid-play doesn't re-trigger the
// 5-second boot animation. But closing the tab + reopening (or
// closing the browser entirely on mobile) shows the gate again —
// the warning is THE FIRST THING every fresh visit, reinforcing
// that desktop is the better experience.
//
// Earlier drafts used localStorage (persistent), but that meant a
// player who tapped Continue once on their phone NEVER saw the
// warning again. Switching to sessionStorage trades a small amount
// of repeat-tap friction for a consistently-surfaced "we
// recommend desktop" message.
//
// PWA INSTALL INTERACTION
// -----------------------
// If the page is launched in standalone mode (PWA installed and
// opened via its dock icon), we still auto-bypass — installing the
// PWA is a strong "I want to use this on this device" signal and
// the player heard the warning the FIRST time they tapped Continue
// before installing. Re-showing the gate on every PWA launch would
// be hostile to someone who explicitly chose mobile.

const BYPASS_KEY = "d3cyph3r-mobile-bypass";

export function isMobile() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      || window.innerWidth < 900;
}

/**
 * Has the player already chosen to bypass the mobile gate on this
 * session? Returns true if either:
 *   - sessionStorage flag set by a previous Continue-anyway tap in
 *     this same tab session, OR
 *   - the page is running as a PWA in standalone mode (so
 *     installing it is implicit consent that doesn't need to be
 *     re-confirmed each launch).
 *
 * Defaults to false on any storage error — safer to show the gate
 * than to silently allow access.
 */
export function isMobileBypassed() {
  // PWA-launched sessions auto-bypass: if you installed the app, you've
  // already committed to using it on this device.
  try {
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
      return true;
    }
  } catch (_) { /* matchMedia may throw in unusual contexts */ }

  try {
    return sessionStorage.getItem(BYPASS_KEY) === "1";
  } catch (_) {
    return false;
  }
}

/** Set the bypass flag and return whether the write succeeded. */
function setBypassFlag() {
  try {
    sessionStorage.setItem(BYPASS_KEY, "1");
    return true;
  } catch (_) {
    // sessionStorage unavailable (private mode, full quota). The bypass
    // still works for this page load because main.js doesn't re-check
    // after the reload immediately — but the player will see the gate
    // again on next reload. Acceptable failure.
    return false;
  }
}

// Boot-log lines for the fake startup sequence. Timings (in ms from
// gate render) are chosen so the last line lands just under the 5s
// progress-bar duration, with the final block fading in right after
// the bar fills.
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

const FINAL_DELAY = 5200;

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
  // No inline `style=` attrs — blocked by our CSP (`style-src 'self'`).
  document.body.innerHTML = `
    <div class="mobile-gate">
      <div class="mobile-gate-inner">
        <h1 class="mobile-gate-brand">
          <span class="glyph-bracket">[</span><span class="glyph-vt323 glyph-bright">D</span><span class="glyph-vt323 glyph-mid">3</span><span class="glyph-vt323 glyph-mid">C</span><span class="glyph-vt323 glyph-bright">Y</span><span class="glyph-vt323 glyph-dim">P</span><span class="glyph-vt323 glyph-mid">H</span><span class="glyph-vt323 glyph-dim">3</span><span class="glyph-vt323 glyph-bright">R</span><span class="glyph-bracket">]</span>
        </h1>
        <p class="mobile-gate-tagline">Terminal CTF · starting up</p>

        <div class="mobile-gate-progress" role="progressbar" aria-label="Boot progress">
          <div class="mobile-gate-progress-fill"></div>
        </div>

        <div class="mobile-gate-log" id="mobile-gate-log" aria-live="polite"></div>

        <div class="mobile-gate-final" id="mobile-gate-final" hidden>
          <p class="mobile-gate-final-title">Desktop recommended</p>
          <p class="mobile-gate-final-body">
            D3CYPH3R is a keyboard-driven terminal experience. The puzzles
            assume a real keyboard and a desktop browser — the on-screen
            keyboard on touch devices works, but Tab autocomplete and
            Ctrl-shortcuts are awkward.
          </p>
          <p class="mobile-gate-final-cta">
            For the best experience, bookmark this page and revisit from a
            laptop or desktop with a physical keyboard.
          </p>

          <div class="mobile-gate-actions">
            <button id="mobile-gate-continue" class="mobile-gate-btn" type="button">
              Continue on mobile anyway →
            </button>
            <p class="mobile-gate-action-note">
              The terminal will load. Tap the screen to focus the input;
              a soft-key row at the bottom adds Tab, Esc, Ctrl-C, and
              shell symbols (<code>|</code>, <code>$</code>, <code>&amp;&amp;</code>)
              that are awkward on phone keyboards.
              <br><br>
              <em>This warning will re-appear next time you open
              D3CYPH3R — close the tab and come back to see it again.</em>
            </p>
          </div>

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

    const btn = document.getElementById("mobile-gate-continue");
    if (btn) {
      btn.addEventListener("click", () => {
        setBypassFlag();
        // Reload so main.js re-checks isMobileBypassed() and routes
        // through the normal engine boot path. Reloading (rather than
        // dynamically importing the engine modules from here) keeps
        // the boot order well-defined and avoids race conditions
        // between the gate teardown and the engine setup.
        try { window.location.reload(); } catch (_) { /* non-browser env */ }
      });
    }
  }, FINAL_DELAY);
}
