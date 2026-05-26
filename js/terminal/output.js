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
