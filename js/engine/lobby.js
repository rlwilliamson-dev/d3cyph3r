// Lobby screen: ASCII logo, welcome / instructions, and boot sequence.
//
// The lobby is the user's "home" — they ssh out to tracks and back here.

import { print, printBanner, printSlow } from "../terminal/output.js";
import { termEl } from "../terminal/dom.js";
import { LEVELS } from "../../levels/index.js";
import { connectTo } from "./ssh.js";

// Clean text wordmark — feels more like modern dev tools (Vercel, GitHub
// CLI, bun) than the giant ASCII art of an old-school CTF site.
const LOGO_TEXT = "D3CYPH3R";

// Build the "AVAILABLE TRACKS" block from the live LEVELS map so it stays
// in sync as tracks are added in future sessions. A track is "available"
// if at least one level exists for it.
function trackList() {
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
  printBanner(LOGO_TEXT);
  print("v0.1 · A terminal-based cybersecurity training game.", "dim");
  print("", "out");

  const firstVisit = !sessionStorage.getItem("seenOnboarding");
  if (firstVisit) {
    sessionStorage.setItem("seenOnboarding", "true");

    print("  ────────────────────────────────────────────────", "dim");
    print("  START HERE", "success");
    print("  ────────────────────────────────────────────────", "dim");
    print("", "out");
    print("  ssh level0@linux", "cmd");
    print("", "out");
    print("  ────────────────────────────────────────────────", "dim");
    print("  YOUR GOAL", "success");
    print("  ────────────────────────────────────────────────", "dim");
    print("", "out");
    print("  Find passwords hidden in each level.", "out");
    print("  Use them with ssh to connect to the next level.", "out");
    print("  Example: ssh level1@linux  (after finding the password)", "dim");
    print("", "out");
  }

  print("  ────────────────────────────────────────────────", "dim");
  print("  AVAILABLE TRACKS", "success");
  print("  ────────────────────────────────────────────────", "dim");
  print("", "out");
  trackList().forEach(line => print(line, "out"));
  print("", "out");
  print("  ────────────────────────────────────────────────", "dim");
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
