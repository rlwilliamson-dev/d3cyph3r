// Top-bar clock. Renders HH:MM:SS into the #clock element, updating
// once per second. Pure cosmetic — the clock is part of the fake
// "system terminal" chrome, not a feature anything else reads.
//
// The element reference is cached at module-init (dom.js does the
// getElementById) so the tick loop costs one assignment per second
// rather than a DOM query.
import { clockEl } from "./dom.js";

// Render the current wall-clock time into clockEl. Two-digit padding
// keeps the bar a fixed width — no layout shift on 1:1:1 → 10:10:10.
function update() {
  const now = new Date();
  clockEl.textContent =
    [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, "0"))
      .join(":");
}

// Start the tick loop. Called once from main.js after the engine
// boots. Tick interval is 1000 ms — close enough to a second; minor
// drift across long sessions is invisible since the clock displays
// whole-second granularity anyway.
export function startClock() {
  update();
  setInterval(update, 1000);
}
