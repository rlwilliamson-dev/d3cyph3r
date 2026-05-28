// tests/lib/helpers.cjs
//
// Shared playtest helpers used by every spec file under tests/specs/.
// The default input path here (dispatchCmd) is ~50x faster than the
// keystroke-by-keystroke approach the original monolithic playtest
// used; see the comments on each helper for the why.
//
// Exports:
//   - dispatchCmd(page, cmd)       — fast path: set #cmd-input.value and
//                                    dispatch a synthetic Enter keydown.
//                                    Returns when the engine has cleared
//                                    the input (proxy for "command done").
//   - typeKeystrokes(page, text)   — real keyboard.type(), retained for
//                                    the small set of readline tests
//                                    (history, Ctrl-R, Ctrl-Y, Alt-., tab
//                                    autocomplete) that need actual
//                                    keystroke events firing through
//                                    input.js's keydown listener.
//   - pressKey(page, key, mods?)   — synthesize a single special key
//                                    (Enter/ArrowUp/etc.) for the
//                                    readline tests.
//   - terminalText(page)           — convenience for #terminal.innerText.
//   - promptText(page)             — convenience for #prompt-label.innerText.
//   - bootAndWait(page, path?)     — page.goto + wait for the lobby to
//                                    render (replaces the blind 1200ms
//                                    boot wait).
//   - resetState(page)             — clear sessionStorage + localStorage,
//                                    reload, wait for boot.
//   - waitForOutput(page, text)    — wait until #terminal contains a
//                                    specific string; for the rare case
//                                    where engine output isn't synchronous
//                                    with Enter (e.g., post-ssh banners
//                                    that depend on the timer module).
//
// Design note on dispatchCmd:
//   The engine's Enter handler (js/terminal/input.js) reads
//   cmdInput.value, clears it synchronously, then calls execute(val).
//   execute() is synchronous — it prints to #terminal and returns
//   before resolving any Promises. So once cmdInput.value === "",
//   the command has fully run AND its output is in the DOM. That's
//   why dispatchCmd waits on input-cleared rather than a fixed timeout.
//
//   We set input.value directly (skipping per-character keyboard.type)
//   and dispatch ONE KeyboardEvent("keydown", { key: "Enter" }) to
//   trigger the same listener real input goes through. This bypasses
//   browser-level focus/keypress/input event chains, which is what
//   makes it ~75ms/cmd faster than typeAndEnter.

const BOOT_SIGNAL = "AVAILABLE ENGAGEMENTS";
const DEFAULT_WAIT_TIMEOUT = 5000;

/**
 * Dispatch a command line to the engine via direct value-set + synthetic
 * Enter keydown. Default path for all tests that don't specifically
 * exercise the keystroke / readline layer.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} cmd  The full command line (no trailing newline).
 * @returns {Promise<void>} Resolves once the engine has cleared the input,
 *                          which is the synchronous signal that execute()
 *                          completed and its output is in the DOM.
 */
async function dispatchCmd(page, cmd) {
  await page.evaluate((text) => {
    const input = document.getElementById("cmd-input");
    if (!input) throw new Error("dispatchCmd: #cmd-input not found");
    input.value = text;
    // Same event shape input.js's keydown listener checks for.
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    }));
  }, cmd);
  // Engine's Enter handler is synchronous: it clears cmdInput.value
  // BEFORE calling execute(), and execute() prints to #terminal before
  // returning. So once value is "", everything has happened.
  await page.waitForFunction(() => {
    const i = document.getElementById("cmd-input");
    return i && i.value === "";
  }, null, { timeout: DEFAULT_WAIT_TIMEOUT });
}

/**
 * Type via real keystroke events. Use when the test specifically needs
 * the keystroke chain — readline history, Ctrl-R reverse search, tab
 * autocomplete, kill-ring (Ctrl-K/Ctrl-Y), Alt-. last-arg, cursor
 * word-movement (Ctrl-Left/Right). Slower (~5ms/char) but high-fidelity.
 *
 * Caller is responsible for pressing Enter afterward if they want the
 * line dispatched. Most readline tests do NOT want Enter pressed since
 * they're asserting on the in-flight buffer state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
async function typeKeystrokes(page, text) {
  await page.locator("#cmd-input").focus();
  await page.keyboard.type(text);
}

/**
 * Press a single special key, optionally with modifiers, through the
 * real keyboard event chain. For readline tests + the password gate's
 * Enter (since password mode is a different execute() branch but still
 * triggered by the same Enter keydown).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} key  e.g. "Enter", "ArrowUp", "Tab", "Escape"
 * @param {Object} [opts]
 * @param {string} [opts.modifiers]  e.g. "Control+r" — passed to keyboard.press
 */
async function pressKey(page, key, opts = {}) {
  await page.locator("#cmd-input").focus();
  if (opts.modifiers) {
    await page.keyboard.press(opts.modifiers);
  } else {
    await page.keyboard.press(key);
  }
}

/**
 * Read the current #terminal text. Same as the original termText helper.
 * The terminal is append-only, so this returns ALL output since boot
 * (or since the last clear) — most tests assert with .toContain() to
 * match recent output anywhere in scrollback.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function terminalText(page) {
  return page.locator("#terminal").innerText();
}

/**
 * Read the current prompt label (#prompt-label). Used for ssh-host
 * assertions ("user@host:cwd$"), PS1 customization tests, and the
 * pivot-stack tests.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string>}
 */
async function promptText(page) {
  return page.locator("#prompt-label").innerText();
}

/**
 * Navigate to the page and wait for the lobby to render. Replaces the
 * blind waitForTimeout(1200) post-goto wait. Returns when "AVAILABLE
 * ENGAGEMENTS" appears in #terminal — the unambiguous signal that
 * main.js's boot() finished and connectTo("guest@d3cyph3r") rendered.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [path="/"]  Optional path/query string appended to baseURL.
 *                             Pass "/?test=1" or similar if the engine ever
 *                             grows a test-mode escape hatch (see the
 *                             deferred C-hook plan).
 */
async function bootAndWait(page, path = "/") {
  await page.goto(path);
  await page.waitForFunction(
    (signal) => {
      const t = document.getElementById("terminal");
      return t && t.innerText.includes(signal);
    },
    BOOT_SIGNAL,
    { timeout: 8000 } // generous to absorb CI's slower cold start
  );
}

/**
 * Reset persistence state and reload. Used by tests that need a
 * first-visit experience or want to re-trigger the opt-in prompt.
 * Both sessionStorage and the v1.11.0 localStorage mirror are nuked.
 *
 * @param {import('@playwright/test').Page} page
 */
async function resetState(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.clear();
      localStorage.removeItem("d3cyph3r-progress-enabled");
      localStorage.removeItem("d3cyph3r-progress");
      localStorage.removeItem("d3cyph3r-theme");
      localStorage.removeItem("d3cyph3r-mobile-bypass");
    } catch (_) {}
  });
  await page.reload();
  await page.waitForFunction(
    (signal) => {
      const t = document.getElementById("terminal");
      return t && t.innerText.includes(signal);
    },
    BOOT_SIGNAL,
    { timeout: 8000 }
  );
}

/**
 * Wait for #terminal to contain a specific string. Used in the few
 * spots where a command triggers async behavior (e.g., service-worker
 * registration banners, post-ssh "Previous solve" lines that depend on
 * the level timer module). Most call sites prefer dispatchCmd's
 * built-in cleared-input wait — only reach for this when that proves
 * insufficient.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} text  Substring to await.
 * @param {number} [timeoutMs=DEFAULT_WAIT_TIMEOUT]
 */
async function waitForOutput(page, text, timeoutMs = DEFAULT_WAIT_TIMEOUT) {
  await page.waitForFunction(
    (needle) => {
      const t = document.getElementById("terminal");
      return t && t.innerText.includes(needle);
    },
    text,
    { timeout: timeoutMs }
  );
}

module.exports = {
  dispatchCmd,
  typeKeystrokes,
  pressKey,
  terminalText,
  promptText,
  bootAndWait,
  resetState,
  waitForOutput,
  BOOT_SIGNAL,
};
