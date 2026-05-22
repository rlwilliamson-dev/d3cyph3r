// Canonical track registry. Single source of truth used by:
//   - js/engine/lobby.js — to render the AVAILABLE ENGAGEMENTS list
//     (un-dimmed for tracks with levels, dimmed for scaffolded-only).
//   - js/engine/ssh.js   — to give a friendly "track scaffolded, no
//     levels yet" message when the player ssh's into a known but
//     not-yet-populated track.
//   - js/commands/shell.js HELP_SECTIONS — implicitly, via the
//     `track:` field on each section.
//
// A track is "scaffolded" when its host is listed here. The host
// becomes a valid `ssh level0@<host>` target whether or not a level
// has been written yet — the engine just routes to a friendly
// stub message for empty ones.

export const TRACKS = [
  { key: "linux",     label: "Linux fundamentals", host: "linux"     },
  { key: "network",   label: "Networking tools",   host: "network"   },
  { key: "crypto",    label: "Cryptography",       host: "crypto"    },
  { key: "web",       label: "Web security",       host: "web"       },
  { key: "forensics", label: "Digital forensics",  host: "forensics" },
  { key: "osint",     label: "Open-source intel",  host: "osint"     },
  { key: "cloud",     label: "Cloud security",     host: "cloud"     },
];

// Fast lookup: is this hostname a known track? Used by ssh.js to
// distinguish "unknown hostname" (typo, returns DNS-style error)
// from "scaffolded track, levels coming" (warm message).
export const SCAFFOLDED_HOSTS = new Set(TRACKS.map(t => t.host));
