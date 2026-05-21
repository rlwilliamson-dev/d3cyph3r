// Lobby screen: ASCII logo, in-world Driftwood welcome (first visit only),
// and the persistent engagement list. Also defines the boot sequence.
//
// The lobby is the user's "home" — they ssh out to tracks and back here.

import { print, printSlow } from "../terminal/output.js";
import { termEl } from "../terminal/dom.js";
import { LEVELS } from "../../levels/index.js";
import { connectTo } from "./ssh.js";

// Wordmark rendered char-by-char in mixed fonts and colors — meant to read
// like a partially-decrypted fragment, half hacker, half scratched-out.
// Glyph classes are defined in style.css under `.glyph-*`.
const LOGO_GLYPHS = [
  { ch: "D", cls: "glyph-mono glyph-white" },
  { ch: "3", cls: "glyph-vt323 glyph-green" },
  { ch: "C", cls: "glyph-share-tech-italic glyph-cyan" },
  { ch: "Y", cls: "glyph-vt323 glyph-accent" },
  { ch: "P", cls: "glyph-courier glyph-red" },
  { ch: "H", cls: "glyph-mono glyph-white" },
  { ch: "3", cls: "glyph-vt323 glyph-green" },
  { ch: "R", cls: "glyph-share-tech glyph-white" },
];

function renderLogo() {
  const banner = document.createElement("div");
  banner.className = "line banner";
  for (const { ch, cls } of LOGO_GLYPHS) {
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = ch;
    banner.appendChild(span);
  }
  termEl.appendChild(banner);
  termEl.scrollTop = termEl.scrollHeight;
}

const DIVIDER = "  ────────────────────────────────────────────────";

// Build the engagement list from the live LEVELS map so it stays in sync
// as tracks are added in future sessions. A track is "available" if at
// least one level exists for it.
function engagementList() {
  const tracks = [
    { key: "linux",     label: "Linux fundamentals", host: "linux"     },
    { key: "network",   label: "Networking tools",   host: "network"   },
    { key: "crypto",    label: "Cryptography",       host: "crypto"    },
    { key: "web",       label: "Web security",       host: "web"       },
    { key: "forensics", label: "Digital forensics",  host: "forensics" },
    { key: "osint",     label: "Open-source intel",  host: "osint"     },
    { key: "cloud",     label: "Cloud security",     host: "cloud"     },
  ];

  return tracks
    .map(t => {
      const count = Object.values(LEVELS).filter(l => l.track === t.key).length;
      if (count === 0) return null;
      const cmd = `ssh level0@${t.host}`.padEnd(22);
      const desc = `${t.label.padEnd(20)} (${count} ${count === 1 ? "level" : "levels"})`;
      return `  ${cmd} ${desc}`;
    })
    .filter(Boolean);
}

export function showLobby() {
  termEl.innerHTML = "";
  renderLogo();
  print("v0.1 · A Driftwood Systems property. Security training for the people who already run the infrastructure.", "dim");
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
  engagementList().forEach(line => print(line, "out"));
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
