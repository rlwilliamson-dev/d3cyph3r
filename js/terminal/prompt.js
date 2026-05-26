// PS1 prompt rendering.
//
// The prompt label (#prompt-label) is re-rendered from scratch on
// every level switch, cwd change, and PS1 mutation. The renderer
// reads PS1 from the merged env (via expand.js's getEnv) and walks
// the format string character-by-character, substituting bash escape
// codes.
//
// Supported escapes (bash subset we judged useful for the sandbox):
//
//   \u   — current user (USER env var, falls back to playerUser)
//   \h   — short hostname (HOSTNAME truncated at first dot)
//   \H   — full hostname (HOSTNAME verbatim)
//   \w   — current PWD, with $HOME collapsed to ~
//   \W   — basename of \w (or ~ if at home)
//   \$   — `$` (we don't model root, so always `$`, never `#`)
//   \\   — literal backslash
//   \[ \]  — non-printing-region delimiters (consumed silently;
//          bash uses them so readline knows the visible width)
//   \n   — newline (rendered as a space — single-line prompt assumed)
//   \033 — ANSI escape introducer (skipped + the rest of the sequence
//          up to and including the terminating letter; we don't honor
//          ANSI in the prompt label, only in command output)
//
// Anything else after \ passes through literally.
//
// Color highlighting: when rendering the DEFAULT PS1 we wrap the @ /
// host / "$ " in their existing classed spans so the prompt looks
// identical to pre-v1.9.0. Custom PS1 values render as plain text.

import { promptLabel } from "./dom.js";
import { getEnv, DEFAULT_PS1 } from "../engine/expand.js";

/** HTML-escape a string for safe insertion into innerHTML. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Walk the PS1 string and substitute bash-style escapes against the
 * current env. Returns plain text (no HTML).
 */
function expandPS1Text(ps1, env) {
  let out = "";
  for (let i = 0; i < ps1.length; i++) {
    const c = ps1[i];
    if (c !== "\\") { out += c; continue; }
    const n = ps1[i + 1];
    if (n === undefined) { out += c; continue; }

    switch (n) {
      case "u": out += env.USER     || "user";       i += 1; break;
      case "h": out += (env.HOSTNAME || "host").split(".")[0]; i += 1; break;
      case "H": out += env.HOSTNAME || "host";       i += 1; break;
      case "w": {
        const pwd = env.PWD || "/";
        const home = env.HOME || "/";
        out += pwd === home ? "~" : (pwd.startsWith(home + "/") ? "~" + pwd.slice(home.length) : pwd);
        i += 1;
        break;
      }
      case "W": {
        const pwd = env.PWD || "/";
        const home = env.HOME || "/";
        if (pwd === home) { out += "~"; }
        else {
          const parts = pwd.split("/").filter(Boolean);
          out += parts.length ? parts[parts.length - 1] : "/";
        }
        i += 1;
        break;
      }
      case "$": out += "$"; i += 1; break;
      case "\\": out += "\\"; i += 1; break;
      case "[": case "]": i += 1; break;  // non-printing delimiters
      case "n": out += " ";  i += 1; break;
      case "0": {
        // \033... — skip ANSI sequence up to (and including) the
        // terminating letter, or just consume \033 if no sequence.
        if (ps1[i + 2] === "3" && ps1[i + 3] === "3") {
          let j = i + 4;
          while (j < ps1.length && !/[A-Za-z]/.test(ps1[j])) j++;
          i = j; // i++ at end of loop advances past the letter
        } else { i += 1; }
        break;
      }
      default: out += c + n; i += 1; break;  // unknown — pass through
    }
  }
  return out;
}

/**
 * Render PS1 to HTML. For the DEFAULT PS1 we wrap pieces in the
 * existing `.at`, `.host`, `.dollar` classes so the colors match
 * the pre-v1.9.0 styling. For custom PS1 the result is plain text.
 */
export function renderPrompt() {
  if (!promptLabel) return;
  const env = getEnv();
  const ps1 = env.PS1 || DEFAULT_PS1;

  // Fast path: default PS1 → reproduce the historical colored layout.
  if (ps1 === DEFAULT_PS1) {
    const user = env.USER || "user";
    const host = (env.HOSTNAME || "host").split(".")[0];
    const home = env.HOME || "/";
    const pwd  = env.PWD || home;
    const path = pwd === home ? "~" : (pwd.startsWith(home + "/") ? "~" + pwd.slice(home.length) : pwd);
    promptLabel.innerHTML =
      `${esc(user)}<span class="at">@</span>` +
      `<span class="host">${esc(host)}</span>` +
      `<span class="dollar">:${esc(path)}$&nbsp;</span>`;
    return;
  }

  // Custom PS1: render as plain text. Trailing space is preserved.
  promptLabel.textContent = expandPS1Text(ps1, env);
}
