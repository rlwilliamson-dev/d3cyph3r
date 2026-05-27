// Terminal output primitives.
//
// `print` accepts a single string (which may contain \n) or any value that
// can be String()'d. It batches all output lines into a DocumentFragment
// and appends them in one DOM op, then scrolls once. This is significantly
// cheaper than the original implementation's per-line appendChild + scroll.

import { termEl } from "./dom.js";

export function print(text, cls = "out") {
  const lines = String(text).split("\n");
  const frag  = document.createDocumentFragment();
  for (const line of lines) {
    const d = document.createElement("div");
    d.className = "line " + cls;
    d.textContent = line;
    frag.appendChild(d);
  }
  termEl.appendChild(frag);
  termEl.scrollTop = termEl.scrollHeight;
}

/**
 * Print a single line composed of multiple styled segments.
 *
 * Accepts an array where each element is either:
 *   - a string (rendered as plain text inside the line)
 *   - { text: string, cls?: string } (rendered as a styled <span>)
 *
 * Used by the lobby's chip rendering (v1.19.0) — the header /
 * engagement-list row needs mixed coloring (one chunk green for
 * "complete", one chunk yellow for "tier") that a single CSS class
 * on the whole line can't express. Uses textContent for each segment
 * so untrusted text would still be safely escaped if a caller ever
 * passes user input through here (today every caller is internal).
 *
 * @param {Array<string | {text: string, cls?: string}>} segments
 * @param {string} [baseCls="out"] — CSS class applied to the .line wrapper
 */
export function printRich(segments, baseCls = "out") {
  const d = document.createElement("div");
  d.className = "line " + baseCls;
  for (const seg of segments) {
    if (typeof seg === "string") {
      d.appendChild(document.createTextNode(seg));
    } else if (seg && typeof seg === "object") {
      const span = document.createElement("span");
      if (seg.cls) span.className = seg.cls;
      span.textContent = String(seg.text ?? "");
      d.appendChild(span);
    }
  }
  termEl.appendChild(d);
  termEl.scrollTop = termEl.scrollHeight;
}

// Type out an array of lines with a fixed delay between each. Resolves
// when the full sequence is on screen. Used for the boot sequence.
export function printSlow(lines, cls = "dim", delayMs = 55) {
  return new Promise(resolve => {
    let i = 0;
    (function next() {
      if (i >= lines.length) { resolve(); return; }
      print(lines[i++], cls);
      setTimeout(next, delayMs);
    })();
  });
}
