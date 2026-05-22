// Input handling: key dispatch, cursor mirror, tab autocomplete, history.
//
// Perf note: the original implementation rebuilt mirror.innerHTML on every
// keystroke (full HTML parse + reflow). This version updates the textContent
// of three pre-existing spans (mirror-before, mirror-cursor, mirror-after)
// so each keystroke is two assignments + a class toggle, no parser.

import { cmdInput, mirrorBefore, mirrorCursor, mirrorAfter, tabHint } from "./dom.js";
import { execute } from "../engine/execute.js";

// Set of known commands, used for Tab autocomplete. Populated by main.js
// once the COMMANDS map is assembled, to avoid hard-coding the list.
let commandSet = [];
export function setCommandSet(cmds) { commandSet = cmds; }

let blinkResetTimer = null;
const cmdHistory   = [];
let   histIndex    = -1;

function updateCursor() {
  const pos = cmdInput.selectionStart;
  const val = cmdInput.value;
  mirrorBefore.textContent = val.slice(0, pos);
  mirrorAfter.textContent  = val.slice(pos);
}

function onTyping() {
  updateCursor();
  mirrorCursor.classList.remove("blink");
  mirrorCursor.classList.add("typing");
  clearTimeout(blinkResetTimer);
  blinkResetTimer = setTimeout(() => {
    mirrorCursor.classList.remove("typing");
    mirrorCursor.classList.add("blink");
  }, 600);
}

function updateTabHint() {
  const val = cmdInput.value;
  tabHint.textContent = "";
  if (!val || val.includes(" ")) return;
  const match = commandSet.find(c => c.startsWith(val) && c !== val);
  if (match) tabHint.textContent = match.slice(val.length);
}

function pushHistory(cmd) {
  if (cmd && cmdHistory[0] !== cmd) cmdHistory.unshift(cmd);
  if (cmdHistory.length > 100) cmdHistory.pop();
  histIndex = -1;
}

export function initInput() {
  cmdInput.addEventListener("input", () => {
    onTyping();
    updateTabHint();
  });

  // Cursor position can change without input firing (click, arrow keys).
  cmdInput.addEventListener("click", updateCursor);
  cmdInput.addEventListener("keyup", updateCursor);
  cmdInput.addEventListener("keydown", () => setTimeout(updateCursor, 0));

  cmdInput.addEventListener("keydown", e => {
    switch (e.key) {
      case "Enter": {
        e.preventDefault();
        const val = cmdInput.value;
        cmdInput.value = "";
        tabHint.textContent = "";
        updateCursor();
        pushHistory(val);
        execute(val);
        break;
      }
      case "Tab": {
        e.preventDefault();
        const hint = tabHint.textContent;
        if (hint) {
          cmdInput.value += hint;
          tabHint.textContent = "";
          updateCursor();
        }
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        if (histIndex < cmdHistory.length - 1) {
          histIndex++;
          cmdInput.value = cmdHistory[histIndex];
          updateCursor();
        }
        break;
      }
      case "ArrowDown": {
        e.preventDefault();
        if (histIndex > 0) {
          histIndex--;
          cmdInput.value = cmdHistory[histIndex];
        } else {
          histIndex = -1;
          cmdInput.value = "";
        }
        updateCursor();
        break;
      }
    }
  });

  // Click anywhere outside an input → refocus the command line, UNLESS
  // the user has an active text selection. Otherwise the focus-steal on
  // mouseup tears the selection before the player can hit Cmd+C, making
  // it impossible to copy text out of the terminal (e.g. a base64 blob
  // they want to paste back into `base64 -d`).
  document.addEventListener("click", () => {
    if (window.getSelection().toString()) return;
    cmdInput.focus();
  });

  updateCursor();
}
