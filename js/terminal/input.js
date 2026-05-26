// Input handling: key dispatch, cursor mirror, tab autocomplete, history.
//
// Perf note: the original implementation rebuilt mirror.innerHTML on every
// keystroke (full HTML parse + reflow). This version updates the textContent
// of three pre-existing spans (mirror-before, mirror-cursor, mirror-after)
// so each keystroke is two assignments + a class toggle, no parser.
//
// Tab autocomplete has two modes, picked based on whether the current
// line has reached an arg yet:
//   - First word (no space yet): complete a command name from the
//     commandSet that main.js wires up.
//   - Subsequent words (after a space): complete the last token as a
//     filesystem path, using the current level's fs tree + cwd.
//     A unique match fills the whole basename; multiple matches fill
//     the longest common prefix so progressive Tab still makes
//     progress.

import { cmdInput, mirrorBefore, mirrorCursor, mirrorAfter, tabHint } from "./dom.js";
import { execute } from "../engine/execute.js";
import { LEVELS } from "../../levels/index.js";
import { currentLevelKey, currentPath } from "../engine/state.js";
import { resolvePath, getFSNode } from "../fs/resolve.js";

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

/**
 * Compute the autocomplete hint for the current input value.
 *
 * Mode 1 — command completion (no space typed yet): scan the
 * commandSet for a matching prefix and surface its suffix as the
 * hint.
 *
 * Mode 2 — path completion (space already typed): treat the LAST
 * whitespace-separated token as a path the player is filling in.
 * Resolve the directory part against the level's fs tree, then find
 * children whose names extend the basename prefix. With a single
 * match we fill the full basename (plus `/` if it's a directory);
 * with multiple matches we fill the longest common prefix so
 * progressive Tab still makes progress.
 *
 * Lobby / no-fs levels: gracefully degrade to "no hint" — we can't
 * complete paths against a level that has no filesystem.
 */
function updateTabHint() {
  const val = cmdInput.value;
  tabHint.textContent = "";
  if (!val) return;

  // Mode 1: command-name completion (no space yet).
  if (!val.includes(" ")) {
    const match = commandSet.find(c => c.startsWith(val) && c !== val);
    if (match) tabHint.textContent = match.slice(val.length);
    return;
  }

  // Mode 2: path completion. Identify the last whitespace-separated
  // token — that's what we'll complete.
  const lastSpaceIdx = val.lastIndexOf(" ");
  const lastToken    = val.slice(lastSpaceIdx + 1);
  if (!lastToken) return; // trailing space → nothing to complete yet

  // Skip flags (start with `-`) — they aren't paths.
  if (lastToken.startsWith("-")) return;

  // Find the level's fs tree. Lobby or hand-written legacy levels
  // without an fs tree → no hints.
  const level = LEVELS[currentLevelKey];
  if (!level || !level.fs) return;

  // Split the token into directory part + basename prefix. The dir
  // gets resolved through the same logic cd / ls / cat use, so abs
  // paths / ~ / .. all complete sensibly.
  const slashIdx   = lastToken.lastIndexOf("/");
  const dirPart    = slashIdx >= 0 ? lastToken.slice(0, slashIdx) : "";
  const basePrefix = slashIdx >= 0 ? lastToken.slice(slashIdx + 1) : lastToken;

  const dirParts = resolvePath(level, currentPath, dirPart);
  const dirNode  = getFSNode(level, dirParts);
  if (!dirNode || !dirNode.children) return;

  // Filter children to those matching the basename prefix. Hide
  // dotfiles unless the player explicitly typed a leading `.` (bash
  // behavior — keeps `cat ~/<Tab>` from suggesting `.bash_history`).
  const showDot = basePrefix.startsWith(".");
  const matches = Object.keys(dirNode.children).filter(name =>
    name.startsWith(basePrefix) && (showDot || !name.startsWith("."))
  );
  if (matches.length === 0) return;

  // Longest common prefix across matches. With one match this is the
  // whole basename; with several it's the largest shared head.
  let common = matches[0];
  for (let i = 1; i < matches.length; i++) {
    while (!matches[i].startsWith(common)) {
      common = common.slice(0, -1);
      if (common.length === 0) return;
    }
  }

  // The hint is the part of the common prefix BEYOND what the player
  // has already typed. Append `/` if the unique match is a directory
  // (so the player can immediately keep tabbing into deeper paths).
  let hint = common.slice(basePrefix.length);
  if (matches.length === 1 && dirNode.children[matches[0]].type === "dir") {
    hint += "/";
  }
  if (hint) tabHint.textContent = hint;
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
