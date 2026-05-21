// Top-bar clock. Cached element ref → no per-tick DOM lookup.
import { clockEl } from "./dom.js";

function update() {
  const now = new Date();
  clockEl.textContent =
    [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(n => String(n).padStart(2, "0"))
      .join(":");
}

export function startClock() {
  update();
  setInterval(update, 1000);
}
