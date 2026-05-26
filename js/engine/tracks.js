// Canonical track registry. Single source of truth used by:
//   - js/engine/lobby.js — to render the AVAILABLE ENGAGEMENTS list
//     (the v1.10.0 collapsible tree reads `description` from here for
//     per-track blurbs; difficulty/time are aggregated live from
//     each track's LEVELS entries at render time).
//   - js/engine/ssh.js   — to give a friendly "track scaffolded, no
//     levels yet" message when the player ssh's into a known but
//     not-yet-populated track.
//   - js/commands/shell.js HELP_SECTIONS — implicitly, via the
//     `track:` field on each section.
//   - js/commands/tracks.js — to enumerate which tracks the player
//     can expand/collapse in the lobby view.
//
// A track is "scaffolded" when its host is listed here. The host
// becomes a valid `ssh level0@<host>` target whether or not a level
// has been written yet — the engine just routes to a friendly
// stub message for empty ones.
//
// Schema:
//   key:         camelCase, used as `level.track` value
//   label:       human-readable name shown in the lobby
//   host:        hostname portion of `ssh levelN@<host>`
//   description: one-line blurb (~50–80 chars) shown in the lobby
//                tree header. Match the in-world Driftwood
//                Systems consulting tone — what this track teaches,
//                framed as engagement work, not coursework.

export const TRACKS = [
  {
    key: "linux",
    label: "Linux fundamentals",
    host: "linux",
    description: "Bash, filesystems, and what previous consultants left behind.",
  },
  {
    key: "network",
    label: "Networking tools",
    host: "network",
    description: "DNS, routes, and the wire between hosts.",
  },
  {
    key: "crypto",
    label: "Cryptography",
    host: "crypto",
    description: "Keys, signatures, hashes — and where developers misuse them.",
  },
  {
    key: "web",
    label: "Web security",
    host: "web",
    description: "HTTP, auth flows, and what's hiding in handler code.",
  },
  {
    key: "forensics",
    label: "Digital forensics",
    host: "forensics",
    description: "Logs, artifacts, and reconstructing what actually happened.",
  },
  {
    key: "osint",
    label: "Open-source intel",
    host: "osint",
    description: "What an attacker learns about you before any packet hits the network.",
  },
  {
    key: "cloud",
    label: "Cloud security",
    host: "cloud",
    description: "AWS, IAM, and the surface someone forgot is still in production.",
  },
];

// Fast lookup: is this hostname a known track? Used by ssh.js to
// distinguish "unknown hostname" (typo, returns DNS-style error)
// from "scaffolded track, levels coming" (warm message).
export const SCAFFOLDED_HOSTS = new Set(TRACKS.map(t => t.host));
