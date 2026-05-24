// Lobby screen: ASCII logo, in-world Driftwood welcome (first visit only),
// and the persistent engagement list. Also defines the boot sequence.
//
// The lobby is the user's "home" — they ssh out to tracks and back here.

import { print, printSlow } from "../terminal/output.js";
import { termEl } from "../terminal/dom.js";
import { LEVELS } from "../../levels/index.js";
import { connectTo } from "./ssh.js";
import { VERSION_DISPLAY } from "./version.js";
import { TRACKS } from "./tracks.js";

// Wordmark rendered char-by-char inside `[ ]` brackets — uniform VT323
// font with a brightness cascade across the 8 characters (bright / mid /
// dim) so the wordmark reads as a "decoded message coming through" with
// fading character emphasis. Pure monochrome — no color accents.
//
// Glyph classes are defined in style.css under `.glyph-*`. Brightness
// classes (.glyph-bright/.glyph-mid/.glyph-dim) use theme-flippable CSS
// variables so the cascade reads correctly in both dark and light mode.
const LOGO_GLYPHS = [
  { ch: "D", cls: "glyph-vt323 glyph-bright" },
  { ch: "3", cls: "glyph-vt323 glyph-mid"    },
  { ch: "C", cls: "glyph-vt323 glyph-mid"    },
  { ch: "Y", cls: "glyph-vt323 glyph-bright" },
  { ch: "P", cls: "glyph-vt323 glyph-dim"    },
  { ch: "H", cls: "glyph-vt323 glyph-mid"    },
  { ch: "3", cls: "glyph-vt323 glyph-dim"    },
  { ch: "R", cls: "glyph-vt323 glyph-bright" },
];

function renderLogo() {
  const banner = document.createElement("div");
  banner.className = "line banner";

  // Opening bracket — JetBrains Mono dim, smaller than the wordmark for
  // visual hierarchy (brand reads as the focus; brackets frame it).
  const lbr = document.createElement("span");
  lbr.className = "glyph-bracket";
  lbr.textContent = "[";
  banner.appendChild(lbr);

  for (const { ch, cls } of LOGO_GLYPHS) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = ch;
    banner.appendChild(span);
  }

  // Closing bracket
  const rbr = document.createElement("span");
  rbr.className = "glyph-bracket";
  rbr.textContent = "]";
  banner.appendChild(rbr);

  termEl.appendChild(banner);
  termEl.scrollTop = termEl.scrollHeight;
}

const DIVIDER = "  ────────────────────────────────────────────────";

// Build the engagement list from the live LEVELS map and the canonical
// TRACKS registry. Tracks with shipped levels render in normal color
// with a count; scaffolded-only tracks (commands wired, no level data
// yet) render dimmed with a "(no levels yet)" suffix so players see
// the full roadmap, not just what's playable today.
function engagementList() {
  return TRACKS.map(t => {
    const count = Object.values(LEVELS).filter(l => l.track === t.key).length;
    const cmd = `ssh level0@${t.host}`.padEnd(22);
    if (count === 0) {
      const desc = `${t.label.padEnd(20)} (no levels yet)`;
      return { line: `  ${cmd} ${desc}`, cls: "dim" };
    }
    const desc = `${t.label.padEnd(20)} (${count} ${count === 1 ? "level" : "levels"})`;
    return { line: `  ${cmd} ${desc}`, cls: "out" };
  });
}

export function showLobby() {
  termEl.innerHTML = "";
  renderLogo();
  print(`${VERSION_DISPLAY} · A Driftwood Systems property. Security training for the people who already run the infrastructure.`, "dim");
  print("", "out");

  const firstVisit = !sessionStorage.getItem("seenOnboarding");
  if (firstVisit) {
    sessionStorage.setItem("seenOnboarding", "true");

    print(DIVIDER, "dim");
    print("  WELCOME TO DRIFTWOOD SYSTEMS", "success");
    print(DIVIDER, "dim");
    print("", "out");
    print("  You've been assigned to the Security Engineering rotation.", "out");
    print("  Driftwood runs ~80 client engagements across ~600 consultants;", "out");
    print("  people roll on, people roll off, and access goes stale.", "out");
    print("", "out");
    print("  Your job: inherit the boxes they leave behind.", "out");
    print("  Find what shouldn't be there.", "out");
    print("", "out");

    print(DIVIDER, "dim");
    print("  FIRST ASSIGNMENT", "success");
    print(DIVIDER, "dim");
    print("", "out");
    print("  ssh level0@linux", "cmd");
    print("", "out");
    print("  Each box hides a password. Find it, use it with ssh to", "dim");
    print("  move to the next box (e.g. ssh level1@linux once you have it).", "dim");
    print("", "out");
  }

  print(DIVIDER, "dim");
  print("  AVAILABLE ENGAGEMENTS", "success");
  print(DIVIDER, "dim");
  print("", "out");
  engagementList().forEach(({ line, cls }) => print(line, cls));
  print("", "out");
  print(DIVIDER, "dim");
  print("  Type 'help' for available commands.", "warn");
  print("", "out");
}

export async function boot() {
  const msgs = [
    "[  0.000] Booting D3CYPH3R kernel 0.1.0...",
    "[  0.091] Initializing virtual filesystem...    OK",
    "[  0.213] Loading level engine...               OK",
    "[  0.334] Mounting /home...                     OK",
    "[  0.512] Starting terminal daemon...           OK",
    "[  0.601] System ready.",
    "",
  ];
  await printSlow(msgs, "dim", 65);
  connectTo("guest@d3cyph3r");
}
