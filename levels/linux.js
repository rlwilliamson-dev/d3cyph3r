// Linux track levels.
//
// Each level is a fs-tree-backed scenario. See levels/README.md for the
// full schema. The minimum required keys: track, objective, lesson, fs.
// `password` is the password REQUIRED to ssh into this level (i.e. set
// by the PREVIOUS level's content); leave null for the entry level.

export const linuxLevels = {

  // ── level 0 — "Offboarded" ───────────────────────────────────
  // Pure ls + cat. Teaches the audit habit. Pwd discovery is in plain text.
  "level0@linux": {
    password: null,
    track: "linux",
    objective: "Audit a dev box left by an offboarded contractor. Find the credentials they stashed in their home directory so the team can rotate them.",
    lesson: "Decommissioned accounts are a leading source of credential exposure. Offboarded users routinely leave scratch files, half-finished cleanup TODOs, and backup copies of secrets behind. The first sweep any auditor (or attacker) does on a fresh box is `ls` + `cat` on every home directory. Get in the habit of doing it yourself before assuming a system is clean.",
    fs: {
      type: "dir",
      children: {
        "welcome.txt": {
          type: "file",
          content:
`Welcome to D3CYPH3R.

This is level 0 of the Linux track — the polished demo of the engine.
More levels and tracks ship in future builds.

Scenario:
  You're auditing a dev box left behind by a contractor whose access
  was revoked yesterday. Find the credentials they stored here so the
  team can rotate them before someone less friendly does.

Commands you'll need on this level:
  ls           list files in the current directory
  cat <file>   print a file's contents

When you've found the password, you've cleared the demo.
Watch the GitHub repo for new tracks as they land.`
        },

        "tasks.md": {
          type: "file",
          content:
`# Things I was supposed to do this week

- [ ] Rotate the staging DB password (final value lives in creds.txt — meant to delete after)
- [ ] Clean up the workspace before logging off
- [ ] Update the on-call doc
- [x] Submit final timesheet
- [ ] Say goodbye on Slack

I'll get to the cleanup tomorrow. Probably.`
        },

        "creds.txt": {
          type: "file",
          content:
`# staging-db.internal — current credentials
# (I was supposed to delete this file after I rotated the pass. I did not.)

user: admin
pass: please-rotate-me

Whoever inherits this box: I know, I know. It's been the staging
password for three months. Please actually change it this time.`
        },

        "notes.txt": {
          type: "file",
          content:
`Random stuff from this gig:

- Friday standups are the worst meeting on the calendar
- The coffee machine on floor 2 is broken again
- Manager keeps asking where the password sheet is, I keep telling them
  "it's in the password manager" and they keep not believing me
- Never letting myself get talked into shared accounts again

Anyway. It's been real.`
        },
      },
    },
  },

};
