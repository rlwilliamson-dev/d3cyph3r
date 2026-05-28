// Standardized `cmd --help` (v1.17.0). Every command in COMMANDS now
// responds to `--help` with a short usage block. The dispatcher in
// execute.js intercepts the flag before calling the command's
// handler; this module owns the help-text resolution.
//
// TWO TIERS
//   1. Curated override (HELP_STRINGS map): a hand-written entry that
//      bundles a one-line description, usage, 2-3 common flags, and
//      the "man" pointer. Use for high-traffic commands or anything
//      where the auto-extracted version (tier 2) reads as too thin.
//   2. Auto-extracted (default): pull NAME + SYNOPSIS from MAN_PAGES
//      and synthesize a 3-line block. Works for every command that
//      has a manpage entry (which is all of them, as of v1.17.0).
//
// FORMAT
//   <cmd> — <one-line description>
//   usage: <synopsis>
//   See 'man <cmd>' for full details.
//
//   For commands with multi-line synopses (openssl, gpg, tar, …) each
//   additional line is indented to align under the first one.
//
// FALLBACK
//   If both the override and MAN_PAGES are missing for a command (a
//   bug or a forker addition that hasn't been wired in yet), the
//   `getCommandHelp()` resolver returns null and the dispatcher falls
//   through to the normal handler — no user-visible regression.

import { MAN_PAGES } from "./man-pages.js";

/**
 * Curated overrides. Each value is the COMPLETE help block (no
 * automatic synthesis); use for commands where the auto-extracted
 * version doesn't surface the useful flag set, or where multi-mode
 * commands need a different shape than a single SYNOPSIS line.
 *
 * Adding an override:
 *   <cmd>: `<cmd> — <description>
 * usage: <signature>
 *   -<flag>   <description>
 * See 'man <cmd>' for full details.`
 *
 * Keep entries to 5-7 lines. Players who want more depth use
 * `man <cmd>` or the walkthrough.
 */
export const HELP_STRINGS = {
  // ─── Multi-subcommand commands (single SYNOPSIS line in manpage
  // wouldn't capture the full surface — curated here) ───────────────

  progress: `progress — visited-levels checklist + persistence controls
usage: progress [--detail | save-on | save-off | reset]
  --detail   list each visited level with bonus-find discoveries + time
  save-on    enable opt-in localStorage persistence (per-browser only)
  save-off   stop saving + delete the persisted blob
  reset      wipe visited / bonus / hint / time data (keeps opt-in flag)
See 'man progress' for full details.`,

  git: `git — version-control inspector (read-only)
usage: git <subcommand> [args]
  log     commit history (--oneline, -<N>, -p, --stat)
  show    inspect a commit (git show <sha>)
  diff    range diff (git diff <a> <b>, git diff HEAD~1)
  status / blame / branch / remote / config — read-only inspectors
See 'man git' for full details.`,

  openssl: `openssl — cryptography toolkit (curated subset)
usage: openssl <subcommand> [args]
  x509    inspect a certificate     (openssl x509 -text -in FILE)
  rand    random bytes              (openssl rand -hex N)
  dgst    hash a file               (openssl dgst -sha256 FILE)
  enc -d  symmetric decrypt         (openssl enc -d -aes-256-cbc -in FILE)
See 'man openssl' for full details.`,

  theme: `theme — switch / cycle the terminal palette (v1.13.0)
usage: theme [<name> | next | prev]
  <name>   apply a named theme (see 'themes' for the list)
  next     cycle forward through the registry
  prev     cycle backward
See 'man theme' for full details.`,

  achievements: `achievements — list earned + remaining achievements (v1.14.0)
usage: achievements [--detail]
  --detail   show progress fractions where measurable
See 'man achievements' for full details.`,

  tutorial: `tutorial — interactive first-visit walk-through (v1.12.0)
usage: tutorial start
  start    begin the 4-step guided tour from the lobby
  (during the tour) type 'skip' to bail out at any point
See 'man tutorial' for full details.`,

  hint: `hint — get a progressive nudge for the current level
usage: hint [reset | list]
  (no args)  print the next hint in this level's sequence
  reset      restart this level's hint progression
  list       show every hint already revealed
See 'man hint' for full details.`,

  save: `save — generate a portable progress code (v1.20.0)
usage: save
Encodes session progress into a self-contained string you can paste
back on any browser to resume. No server, no account — the code
lives wherever you put it (notes app, email, paper). Pair with
'restore' to apply elsewhere.
See 'man save' for full details.`,

  restore: `restore — apply a progress code (v1.20.0)
usage: restore <code>
       restore --preview <code>
  <code>      validate + show a diff vs. current state, prompt [y/N]
  --preview   decode + summarize without changing anything
Codes are long; paste-don't-type. Hyphens / line breaks inside the
code are decorative — the decoder ignores both.
See 'man restore' for full details.`,

  sw: `sw — inspect / control the service worker (v1.21.0)
usage: sw [status | update | clear]
  status     show registration + active-SW version (default)
  update     force-check for a new version now
  clear      unregister + wipe caches (panic button)
See 'man sw' for full details.`,

  reload: `reload — refresh the page, applying any pending update (v1.21.0)
usage: reload
Triggers skipWaiting on a pending service-worker update (if any),
then reloads. Your progress survives — only engine code is swapped.
See 'man reload' for full details.`,

  // ─── Filesystem / read-only stubs: short curated message because
  // their MAN_PAGES entries are deliberately terse and the sandbox
  // refusal posture is itself the most useful thing to surface ────

  chmod:    `chmod — read-only sandbox stub
This filesystem is read-only. chmod prints a graceful error rather
than mutating state. See 'man chmod' for the sandbox-mode note.`,
  chown:    `chown — read-only sandbox stub
This filesystem is read-only. See 'man chown' for the sandbox-mode note.`,
  mv:       `mv — read-only sandbox stub
This filesystem is read-only. See 'man mv' for the sandbox-mode note.`,
  cp:       `cp — read-only sandbox stub
This filesystem is read-only. See 'man cp' for the sandbox-mode note.`,
  rm:       `rm — read-only sandbox stub
This filesystem is read-only. See 'man rm' for the sandbox-mode note.`,
  mkdir:    `mkdir — read-only sandbox stub
This filesystem is read-only. See 'man mkdir' for the sandbox-mode note.`,
  rmdir:    `rmdir — read-only sandbox stub
This filesystem is read-only. See 'man rmdir' for the sandbox-mode note.`,
  touch:    `touch — read-only sandbox stub
This filesystem is read-only. See 'man touch' for the sandbox-mode note.`,
  ln:       `ln — read-only sandbox stub
This filesystem is read-only. See 'man ln' for the sandbox-mode note.`,
  sudo:     `sudo — privilege-escalation stub
The sandbox runs without a real privilege boundary. See 'man sudo'
for the lesson-shaped error message.`,
  su:       `su — switch-user stub
Sandbox has no real user table. See 'man su' for context.`,
  useradd:  `useradd — user-management stub
The sandbox can't add real accounts. See 'man useradd' for context.`,
  passwd:   `passwd — password-change stub
The sandbox doesn't store real credentials. See 'man passwd' for context.`,
};

/**
 * Resolve the help text for a command, or null if no help is
 * available. Curated overrides win; otherwise auto-extract from
 * MAN_PAGES.
 */
export function getCommandHelp(cmd) {
  if (HELP_STRINGS[cmd]) return HELP_STRINGS[cmd];
  return autoFromManpage(cmd);
}

/**
 * Synthesize a 3-line help block from MAN_PAGES[cmd]. Pulls the NAME
 * section's first line (the "cmd — description" tagline) and the
 * SYNOPSIS section (one or more usage signatures). Returns null when
 * the command has no manpage.
 */
function autoFromManpage(cmd) {
  const page = MAN_PAGES[cmd];
  if (!page) return null;

  const nameLines     = extractSection(page, "NAME");
  const synopsisLines = extractSection(page, "SYNOPSIS");

  const name = nameLines[0] || `${cmd} — (no description)`;
  let usage = "";
  if (synopsisLines.length > 0) {
    usage = synopsisLines
      .map((line, i) => i === 0 ? `usage: ${line}` : `       ${line}`)
      .join("\n");
  }

  const parts = [name];
  if (usage) parts.push(usage);
  parts.push(`See 'man ${cmd}' for full details.`);
  return parts.join("\n");
}

/**
 * Extract the content lines of a manpage section (e.g., "NAME",
 * "SYNOPSIS"). A section ends at the next non-indented line OR at
 * end of string. Returns an array of trimmed lines (drops blanks).
 */
function extractSection(page, sectionName) {
  // Section header sits at column 0 (no leading whitespace). The
  // content under it is indented. Find the header, then collect
  // every indented or blank line until we hit another column-0 line.
  const lines = page.split("\n");
  let inSection = false;
  const collected = [];
  for (const line of lines) {
    if (line === sectionName) {
      inSection = true;
      continue;
    }
    if (!inSection) continue;
    // Column-0 non-empty line ends the section.
    if (line.length > 0 && !/^\s/.test(line)) break;
    if (line.trim()) collected.push(line.trim());
  }
  return collected;
}
