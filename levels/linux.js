// Linux track levels.
//
// Each level is a fs-tree-backed scenario. The minimum required keys:
// track, objective, lesson, fs. `password` is the password REQUIRED to
// ssh into this level (set by the PREVIOUS level's content); leave null
// for the entry level.
//
// The fs tree's children are keyed by basename. Each entry is either:
//
//   { type: "dir",     children: { ...nested entries... } }
//   { type: "file",    content: "string body" }
//   { type: "symlink", target: "path" }
//
// Symlink targets follow the same path-resolution rules as anything
// the player types: absolute (`/home/<user>/foo`), home-relative
// (`~/foo`), or relative to the symlink's parent dir (`foo`,
// `../foo`). The resolver caps chain length at 16 hops to break
// cycles. `cat <symlink>` reads through; `ls -l` shows it as
// `lrwxrwxrwx ... name -> target`; `readlink` prints the literal
// target; `realpath` prints the fully-resolved absolute path.
//
// Optional: `playerUser` (and `playerGroup`, defaulting to `playerUser`)
// override the in-world identity the player sees inside the box. The
// level key (e.g. `level1@linux`) is engine bookkeeping for the SSH-hop
// metaphor; `playerUser` is what `whoami`, the prompt, `pwd`, `find`,
// and `ls -la` owner columns show. Without this override the engine
// falls back to the level key's user prefix.
//
// Optional player-orientation fields (v1.8.0 / v1.10.0):
//   level.estimatedMinutes : positive integer — typical solve time
//   level.title            : short scenario name (~25–40 chars) shown
//                            in the lobby tree's expanded view next
//                            to the `ssh ...` invocation line
//
// NOTE: as of v1.10.0, difficulty is COMPUTED from the level number
// (see `js/engine/tiers.js`). Don't add a `difficulty:` field to a
// numbered level — the tier (Routine / Live / Escalated / Critical /
// Crisis) flows from the ordinal in `level<N>@<host>` automatically.
// Pivot hosts (`pivot: true`) are non-numbered and sit off the main
// difficulty curve; they get no tier label in either the lobby tree
// or the connection banner.
//
// Surfaced in the connection banner ("Tier: Routine · Est. time:
// ~10 min") and in the lobby tree. Without a title, the lobby tree
// shows only the ssh command + tier + estimated time on each level
// row.
//
// Optional: SHELL ENVIRONMENT (v1.9.0).
//
//   level.env_vars : { NAME: "value", ... } — static per-level env
//     pre-set when the player enters this level. Overrides the live
//     built-ins (USER / HOME / PWD / …) but sits BELOW player-set
//     `export FOO=bar` in the lookup chain (so the player's writes
//     always win). Use for level-specific context like
//     `AWS_PROFILE: "ci"` or `STAGING_HOST: "10.0.0.5"`.
//
// Optional: MULTI-HOST PIVOT (v1.9.0).
//
//   level.network : { "<user>@<host>": { ... level-shape ... } }
//     Pivot hosts the player can ssh into FROM this level. Each entry
//     looks like a regular level (fs, playerUser, password,
//     env_vars, files), but is hidden from the lobby's track list.
//     ssh into one of these keys pushes the current shell onto the
//     pivot stack; `exit` pops back. Useful for in-engagement
//     lateral-movement scenarios (e.g. "you found these creds, now
//     ssh to the bastion they unlock").
//     Conflict policy: registered first-wins. Keep host-keys unique
//     across levels; pick a hostname that won't collide with future
//     real levels (e.g. `dbsvc@halton-db01.internal`).
//
// Optional: BONUS FINDS (v1.9.0).
//
//   level.bonusFinds : [
//     { id, name?, hint?, trigger: { command?, argMatches?,
//                                     outputContains? } },
//     ...
//   ]
//   Discoverable nuggets that don't gate the credential chain.
//   Trigger fires when the player runs a command whose argv[0]
//   matches `command` (optional), whose joined args match
//   `argMatches` (RegExp or substring, optional), AND whose
//   visible output matches `outputContains` (RegExp or substring,
//   optional). Each find is awarded once per level per session;
//   `progress` shows the running count.
//
// Optional: NETWORK INSPECTION schema (surfaced by the v1.7.0
// commands — ip addr / ip route / arp / ping / traceroute /
// nslookup). All sub-fields are independent; every command degrades
// to a graceful empty-state message when its data is absent. See the
// per-field shape docs at the top of `js/commands/netinspect.js`.
//
//   level.netInterfaces      : [{ name, mac, ipv4, ipv4Prefix,
//                                  broadcast?, mtu?, state?, flags?,
//                                  linkType? }]
//   level.routes             : [{ destination, via?, dev, proto?,
//                                  scope?, src?, metric? }]
//   level.arpCache           : [{ hostname?, ip, mac, type?, dev }]
//   level.pingResults        : { [host]: { resolvedIp?, rtts: [n],
//                                  ttl?, packetLoss?, reachable?,
//                                  error? } }
//   level.tracerouteResults  : { [host]: { resolvedIp?, hops: [{ n,
//                                  hostname?, ip, rtts: [n] }] } }
//   level.nslookupResults    : { [host]: { server?, addresses: [string],
//                                  canonical?, error? } }
//
// Optional: FORMAT-INSPECTION schema (v1.7.0 — openssl x509, tar,
// gunzip/zcat). See `js/commands/format.js` for the full shapes.
//
//   level.certs        : { [filename]: { version?, serial?,
//                            sigAlgorithm?, issuer, subject,
//                            notBefore, notAfter, publicKey?,
//                            san?, keyUsage?, extKeyUsage?,
//                            crlDistributionPoints?,
//                            authorityInfoAccess?, sctList? } }
//   level.tarArchives  : { [filename]: { entries: [{ mode, owner,
//                            group, size, mtime, name, type? }] } }
//   level.gzipArchives : { [filename]: "decompressed content" }
//
// Optional: SYSTEM INSPECTION schema (surfaced by the v1.6.0 commands —
// crontab, last, who, w, lsof, ss, journalctl, systemctl, dmesg).
// All sub-fields are independent; every command degrades to a polite
// empty-state message when its data is absent. See the per-field
// shape docs at the top of `js/commands/sysinspect.js`.
//
//   level.crontab        : { [username]: "...crontab text..." }
//   level.lastLogins     : [{ user, tty, from, start, end, duration }]
//   level.activeSessions : [{ user, tty, from, login, idle?, jcpu?,
//                             pcpu?, what? }]
//   level.openFiles      : [{ command, pid, user, fd, type, device,
//                             sizeOrOff, node, name }]
//   level.sockets        : [{ netid, state, recvq, sendq, localAddr,
//                             localPort, peerAddr, peerPort, process }]
//   level.journal        : [{ timestamp, host, unit, pid, message }]
//   level.systemdUnits   : { [unitName]: { loadState, activeState,
//                              subState, description, since, enabled,
//                              preset, mainPid, command, tasks, memory,
//                              cpu, cgroup, logs } }
//   level.dmesg          : [{ timestamp, message }] or [string]
//
// Optional: `hints` is an ordered list of nudges surfaced by the
// `hint` command (one per call, advancing each time). Order them
// most-subtle to most-direct — the first hint should re-orient the
// player; the last should nearly hand them the answer:
//
//   hints: [
//     "Look at all the files in the home directory, including hidden ones.",
//     "Daniel kept a credential cheat sheet — its name is on the nose.",
//     "Try `cat creds.txt`. The password is in there, prefixed with PASSWORD=.",
//   ]
//
// Per-level hint position is tracked in sessionStorage so the
// counter survives reloads within the tab session. Levels without a
// `hints` field print a "no hints for this level" message — players
// can always fall back to the walkthrough subsite.
//
// Optional: `permissions` is a map keyed by file basename (within the
// level's home directory) whose values describe the file's mode and
// ownership for `ls -l` and `cat`:
//
//   permissions: {
//     "creds.txt": { mode: "-rw-------", owner: "root", group: "root", size: 287 },
//     ...
//   }
//
// Mode follows the standard 10-char format: [type][owner rwx][group rwx]
// [other rwx]. Levels are single-user / single-group; the player belongs
// to a primary group named by `playerGroup`. `cat` returns "Permission
// denied" for files the player can't read.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm (~600 consultants, ~80 simultaneous engagements). The
// player works on Driftwood's internal security team, auditing the
// artifacts that rolled-off / departed consultants leave behind.
//
// Recurring characters across levels: Daniel (lvl 0 — rolled off
// Halton Bank), Priya (senior consultant who handles handoffs).
// Recurring clients show up as separate engagement contexts.
// Recurring technical debt (alerts@ black hole, the nickel coffee
// machine on floor 4, the scp-and-pray deploys) seeds inside jokes.

export const linuxLevels = {

  // ── level 0 — "Daniel's Last Day" ────────────────────────────
  // The new-hire's first task: audit an offboarded consultant's laptop
  // before reimaging. The credentials he left behind belong to a CLIENT
  // environment (Halton Bank), which makes this a contractual issue,
  // not just an internal one. Pure ls + cat. The lesson is in the writing.
  "level0@linux": {
    password: null,
    track: "linux",
    title: "Daniel's laptop handoff",
    estimatedMinutes: 10,
    playerUser: "daniel",
    objective: "Audit Daniel's laptop and find the client credential he left behind before IT reimages the box on Wednesday.",
    lesson: "Day one at Driftwood. A senior consultant whose engagement at Halton Bank ended Friday left his work laptop with IT for reimaging. His client access was revoked over the weekend, but the laptop hasn't been wiped yet, and his home directory hasn't been audited. Sweep it before Wednesday. Anything that looks like a client credential, you flag. Read every file. Then read lessons-learned.md.",
    hints: [
      "Use `ls` to enumerate Daniel's home directory. Then use `ls -a` to also see anything starting with a dot — `.bash_history` and friends.",
      "There are six files visible to `ls`. One of them is named after a category of secrets a consultant should never leave behind on a laptop.",
      "Try `cat creds.txt` — it's exactly what it says on the tin. The Halton Bank credential is in there in plaintext.",
    ],

    // v1.9.0 SHELL ENVIRONMENT — Daniel's leftover per-user env. The
    // player inherits these when they ssh into the level (they were
    // set in Daniel's .bashrc by IT during onboarding and never
    // touched since). `env` lists them; the player can override
    // with their own `export`.
    env_vars: {
      EDITOR:        "vi",
      HISTSIZE:      "1000",
      LESS:          "-FRX",
    },

    // v1.9.0 BONUS FINDS — small reward for the player who reads
    // .bash_history (which they often do during a defender audit
    // even when the smoking gun is already in creds.txt). Doesn't
    // gate the credential chain.
    bonusFinds: [
      {
        id:   "daniel-history-pattern",
        name: "Daniel's muscle-memory pattern",
        hint: "His .bash_history is full of `sudo systemctl status` — he was checking on the staging-worker service constantly. Pattern that bites: the same dev who copies secrets to .bak files is the one logged in everywhere.",
        trigger: { command: "cat", argMatches: /\.bash_history/, outputContains: "sudo systemctl" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`Welcome to D3CYPH3R — and welcome to Driftwood Systems.

You're the new DevOps engineer on Driftwood's internal security team.
Driftwood is a mid-sized tech consulting firm: roughly 600 consultants,
spread across roughly 80 client engagements at any given time. Your
team's job is the security-shaped part of operations — making sure
consultants don't roll off engagements with the client's credentials
still on their laptops.

Your first morning, there is already a fire. Daniel — a senior
consultant whose engagement at Halton Bank ended Friday — left his
work laptop with the IT team for reimaging. His Halton access was
revoked over the weekend, but the laptop hasn't been wiped yet, and
his home directory hasn't been audited. IT is reimaging Wednesday.
You have between now and then to find anything sensitive he left
exposed.

IT booted the laptop and logged you into Daniel's user account so
you can read everything he had access to. The shell prompt shows
\`daniel@linux\` because you're working inside his profile, not
because you are Daniel. This is how forensic audits work: when the
user is gone, you take their shoes.

Commands you'll need today:
  ls           list files in this directory
  ls -a        list files including hidden ones (start with a dot)
  cat <file>   print a file's contents

Read everything readable. When you find a credential, that's the win.
There's a debrief in lessons-learned.md once you've solved it — read
that one last.
`
        },

        "handoff.md": {
          type: "file",
          content:
`# Hand-off — Daniel → whoever picks up Halton

I'm rolling off the Halton Bank engagement Friday. Six months of
staging environment work, three production incidents, one truly
bizarre data model. The client was good. Their security team was
not.

Stuff that's important and you should pick up if Driftwood rotates
someone onto this account:

  - Halton's staging DB credentials: see creds.txt. Yes, I know.
  - The cron at 02:00 UTC on the Halton jumphost is mine — runs a
    hand-rolled backup of the staging schema. Talk to Priya, she's
    the senior consultant who knows the Halton account best, and
    her ssh key is on the receiving end.
  - The TLS cert on Halton's api-internal expires in 37 days. The
    client's ops team knows. They will not renew on time without
    multiple reminders. Trust me on this one.

Stuff that's not important but I'm telling you anyway:

  - The coffee machine on Driftwood's floor 4 takes nickels.
    Specifically nickels.
  - Yes, the Halton engagement runbook is a Notion page. I know.
  - Do not email Halton's "alerts@" list directly. It is a black
    hole. The Slack integration works. Use Slack.

Have fun. Send me a screenshot if the Halton dashboard ever finally
goes green.

— Daniel
`
        },

        "tasks.md": {
          type: "file",
          content:
`# Things I was going to get to before rolling off

- [x] Submit final timesheet for the Halton engagement
- [x] Write a handoff doc (handoff.md)
- [ ] Rotate Halton's staging DB password (real value lives in
      creds.txt — I'm leaving it so whoever rotates onto this
      account has the actual string to revoke, not a memory of it)
- [ ] Delete creds.txt after the rotation
- [ ] Clean up ~/scratch/ (it doesn't exist anymore, but the TODO does)
- [ ] Say goodbye on the #halton-eng Slack channel
- [ ] Brief Priya on the cron
- [ ] Update my Driftwood profile with the new engagement code

Realistic forecast: two of the above will happen. The other six are
somebody else's problem now.
`
        },

        "notes.txt": {
          type: "file",
          content:
`Late-night scratch from the Halton engagement:

The "deploy pipeline" I built for them is:
  1. ./build.sh on this laptop
  2. scp the artifact to Halton's prod-bastion
  3. ssh in and ./deploy.sh
  4. Pray
  5. Check the Halton Grafana

I've been telling Halton's ops team for nine months that this should
live in their GitHub Actions tenancy, or anything that isn't on my
laptop. They pay for the Actions seats. They just do not use them.
The reason is, on the client side, not interesting.

If you want to find Halton's staging DB pass without reading creds.txt:
  - check my shell history (.bash_history, if you're thorough)
  - check the env vars — I exported DB_PASS once for testing and
    forgot to unset it
  - look at the systemd override I left on the Halton jumphost for
    the staging-worker unit

But also it is, very obviously, in creds.txt.

— d
`
        },

        "creds.txt": {
          type: "file",
          content:
`# DO NOT COMMIT — Halton Bank staging-db credentials
# Goal: rotate this. Then delete this file. Neither happened.

host: staging-db.halton.internal
port: 5432
user: app_admin
pass: please-rotate-me

# I know hard-coded client creds on a Driftwood laptop is a CWE-798
# violation. I know it violates our MSA with Halton. I know the
# Driftwood audit team would write us up. I know this is precisely
# the scenario the firm's "Consultant Departure Checklist" exists
# to prevent.
# I am rolling off the engagement.
# Someone else's problem now.
`
        },

        ".bash_history": {
          type: "file",
          content:
`ls
cat /etc/os-release
htop
ssh halton-jumphost
sudo systemctl restart staging-worker
journalctl -u staging-worker -f
psql -h staging-db.halton.internal -U app_admin
export DB_PASS=please-rotate-me
./build.sh
scp build/app.tar.gz halton-prod-bastion:/tmp/
ssh halton-prod-bastion
vi creds.txt
git status
git stash
nano handoff.md
ln -s notes.txt .notes
exit
`
        },

        // Hidden symlink Daniel left behind — points at notes.txt. Doesn't
        // affect the puzzle solve (the credential is still in creds.txt),
        // but a player who runs `ls -la` will see the symlink rendering
        // and can `readlink .notes` / `realpath .notes` to inspect it.
        ".notes": {
          type: "symlink",
          target: "notes.txt",
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just found cleartext credentials for a CLIENT environment sitting
on an offboarded consultant's laptop. In a real engagement, this single
file could be the entire breach — and "we exposed the client" is the
worst kind of breach for a consulting firm.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Tech consulting introduces a security model that internal-only teams
rarely confront directly:

  - Consultants rotate engagements every 6 to 18 months
  - Each engagement grants access to a different client environment
  - Personal devices accumulate credentials, configs, and tribal
    knowledge across multiple clients over time
  - When a consultant rolls off, their laptop becomes a treasure
    chest of client data — for whoever finds it next

The Master Services Agreement (MSA) Driftwood signed with Halton
makes exposure of the client's credentials a contractual breach,
typically with notification requirements measured in hours, not
days. Financial-services clients add a regulatory layer on top of
the contract: GLBA's Safeguards Rule and PCI-DSS both treat
consultants as a covered party.

─── THE BLUNT VERSION ────────────────────────────────────────

Stolen credentials remain one of the top initial-access vectors
in real-world breach reports, year after year. Verizon's 2026
Data Breach Investigations Report documented a notable reshuffle
this cycle — vulnerability exploitation overtook credential abuse
to claim the #1 slot at 31% of breaches studied — but
credential-driven access remains the persistent runner-up and
continues to dominate incident-response casework. Insider
incidents, including former employees and contractors, continue
to account for roughly one in five confirmed breaches.

When the insider is a consultant, the blast radius expands: not
just YOUR data, but every client whose environment they had access
to.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  NIST SP 800-53 Rev. 5 — AC-2 (Account Management) + PS-4
  (Personnel Termination)
    AC-2(3) "Disable Accounts" requires accounts to be disabled
    within an organization-defined time period when no longer
    required (including separation). PS-4 "Personnel Termination"
    requires disabling system access within an organization-defined
    time period of termination and revoking authenticators
    associated with the individual. Both controls are violated
    whenever a consultant's client access isn't fully revoked at
    engagement end.

  CIS Critical Security Controls v8.1 — Control 5 (Account Management)
    5.3: disable dormant accounts. 5.4: restrict administrator
    privileges. Both apply here.

  CWE-798: Use of Hard-coded Credentials
    The specific weakness committed when Daniel wrote the client's
    password into a flat file instead of a secrets manager. One of
    the longest-standing entries in the CWE catalog.

  OWASP Top 10 (2025) — A07: Authentication Failures
    The umbrella category for the broader weakness class
    (renamed from "Identification and Authentication Failures"
    in the 2021 edition).

  GLBA Safeguards Rule (16 CFR Part 314)
    For financial-services clients like Halton, mandates "service
    provider oversight." Consulting firms are explicitly covered.
    Section 314.4(f) puts the burden on the financial institution
    to ensure their service providers safeguard customer data —
    which puts the burden on Driftwood to deserve that trust.

  PCI-DSS v4.0.1 — Requirement 12.8
    Covers third-party / consultant obligations when payment-card
    data is in scope. Halton is a bank; payment data is always in
    scope somewhere.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 4.1 (Apply common security techniques) — secrets
    management. Domain 5.3 (third-party risk management) — directly
    relevant to consulting-firm security models.

  ISC2 Certified in Cybersecurity (CC)
    Domain 5 (Security Operations) — account lifecycle.

  CISSP
    Domain 5 (Identity & Access Management), Domain 7 (Security
    Operations), and Domain 1 (Security & Risk Management — covers
    third-party assessments and contractual obligations). All three
    converge on consultant credential hygiene.

  OSCP / PEN-200
    Teaches "read every file you can read" as the first move post
    foothold. The ls-then-cat-everything loop you just executed is
    literally the opening play of every box on the OSCP exam.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1083    — File and Directory Discovery
  T1552.001 — Unsecured Credentials: Credentials In Files

These two techniques together account for an enormous share of
real-world post-compromise activity. T1552.001 in particular shows
up in nearly every credible threat report.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Disable rolled-off consultants' client access immediately on
     engagement end. Preserve the device image for audit; don't
     wipe until forensics confirms the laptop is clean.
  2. Use a real secrets manager. For consulting firms specifically:
     client credentials should never live on a consultant laptop.
     Bastion-hosted secrets, just-in-time access, or client-owned
     vaults are the standard. HashiCorp Vault, AWS Secrets Manager,
     Doppler, 1Password Secrets Automation, Bitwarden Secrets
     Manager — anything that isn't a flat file.
  3. Run credential scanners against both repos AND endpoints:
       gitleaks, trufflehog, git-secrets — for VCS
       osquery, CrowdStrike, Microsoft Purview — for endpoint
  4. Treat any credential exposed during a consultant transition
     as compromised. Rotate first; audit later.
  5. Honor MSA notification timelines. Most have 24- to 72-hour
     windows for credential exposure. Missing those is a separate
     compliance event from the exposure itself.

─── CLOSING THOUGHT ──────────────────────────────────────────

In a regular tech org, this is bad. In a consulting firm, this is
contractually a breach, often regulatorily a breach, and always
reputationally a breach. The firm's standing rides on every
consultant's home directory.

The disappointment, when you find one, is the lesson.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

  // ── level 1 — "The Backup Daniel Forgot" ────────────────────────
  // Player uses Daniel's leaked staging creds to ssh into Halton's
  // jumphost. They're now `app_admin` on a client production bastion.
  // The puzzle: the production DB password lives in a systemd override
  // owned by root (mode 600 — can't read) but Daniel left a debugging
  // copy in his home dir at mode 644 (readable). The lesson is
  // CWE-732 (Incorrect Permission Assignment) via the "shadow copy"
  // anti-pattern. Introduces `ls -l` / `ls -la` and "Permission denied".
  "level1@linux": {
    password: "please-rotate-me",
    track: "linux",
    title: "Halton Bank staging bastion",
    estimatedMinutes: 10,
    playerUser: "app_admin",
    objective: "Find the production database credential a misconfigured backup is leaking — and document the blast radius before Priya rotates it.",
    lesson: "Day two. You used the credential from Daniel's creds.txt to ssh into Halton Bank's jumphost — and Halton's ops team left the staging service account with a login shell. You're now logged in as app_admin, sitting on a client production bastion. A real attacker who pulled the same trick would be exactly here. Walk the home directory and find the production credential a careless backup has left exposed. Read welcome.md first; it explains the new permission columns you'll use today. Then lessons-learned.md once you've found it.",
    hints: [
      "Run `ls -la` to see file permissions. Two files have the same base name but different modes — that's the smoking gun.",
      "`staging-worker.env` is mode 600 owned by root — you can't read it. Its `.bak` sibling is mode 644 owned by app_admin (you).",
      "`cat staging-worker.env.bak`. The DB_PROD_PASS line is the production database credential. Note the filename: someone copied a secret file and forgot to preserve permissions.",
    ],
    permissions: {
      "welcome.md":             { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 1842 },
      "handoff.md":             { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 1956 },
      "backup.sh":              { mode: "-rwxr-xr-x", owner: "app_admin", group: "app_admin", size:  612 },
      ".bash_history":          { mode: "-rw-------", owner: "app_admin", group: "app_admin", size:  524 },
      "staging-worker.env":     { mode: "-rw-------", owner: "root",      group: "root",      size:  287 },
      "staging-worker.env.bak": { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size:  342 },
      "lessons-learned.md":     { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 4521 },
    },

    // v1.6.0 SYSTEM INSPECTION — demo data so `crontab` / `last` /
    // `who` / `w` / `lsof` / `ss` / `journalctl` / `systemctl status`
    // / `dmesg` have something realistic to render on level1@linux.
    // The journal entries below corroborate the puzzle's finding: the
    // staging-worker service fails to read the mode-600 file, falls
    // back to the mode-644 backup, and logs the fallback — a player
    // who runs `journalctl -u staging-worker` sees the bug from the
    // service's perspective.
    crontab: {
      "app_admin": "# Crontab for app_admin (no scheduled jobs)\n",
      "root":
`# Halton Bank staging-worker maintenance
*/5 * * * * /usr/local/bin/staging-worker-healthcheck.sh
0 2 * * * /usr/local/bin/backup-staging-env.sh > /var/log/backup-staging.log 2>&1
`,
    },
    lastLogins: [
      { user: "app_admin", tty: "pts/0", from: "10.0.7.42", start: "Mon May 26 14:23", end: "still logged in", duration: null },
      { user: "app_admin", tty: "pts/0", from: "10.0.7.42", start: "Fri May 23 09:15", end: "Fri May 23 17:30", duration: "08:15" },
      { user: "daniel",    tty: "pts/0", from: "10.0.7.18", start: "Thu May 22 16:00", end: "Thu May 22 16:45", duration: "00:45" },
      { user: "root",      tty: "pts/0", from: "10.0.1.5",  start: "Thu May 22 11:00", end: "Thu May 22 11:45", duration: "00:45" },
      { user: "reboot",    tty: "system boot", from: "6.1.0-d3cyph3r", start: "Thu May 22 10:55", end: "still running", duration: null },
    ],
    activeSessions: [
      { user: "app_admin", tty: "pts/0", from: "10.0.7.42", login: "14:23", idle: "0.00s", jcpu: "0.12s", pcpu: "0.05s", what: "w" },
    ],
    openFiles: [
      { command: "sshd",       pid: "842",   user: "root",      fd: "3u",  type: "IPv4", device: "12345", sizeOrOff: "0t0", node: "TCP", name: "*:22 (LISTEN)" },
      { command: "sshd",       pid: "12345", user: "root",      fd: "4u",  type: "IPv4", device: "23456", sizeOrOff: "0t0", node: "TCP", name: "10.0.7.10:22->10.0.7.42:51234 (ESTABLISHED)" },
      { command: "postgres",   pid: "1100",  user: "postgres",  fd: "5u",  type: "IPv4", device: "34567", sizeOrOff: "0t0", node: "TCP", name: "*:5432 (LISTEN)" },
      { command: "staging-w",  pid: "2300",  user: "app_admin", fd: "cwd", type: "DIR",  device: "253,1", sizeOrOff: "4096", node: "65536", name: "/home/app_admin" },
      { command: "staging-w",  pid: "2300",  user: "app_admin", fd: "6r",  type: "REG",  device: "253,1", sizeOrOff: "342", node: "1048584", name: "/home/app_admin/staging-worker.env.bak" },
    ],
    sockets: [
      { netid: "tcp", state: "LISTEN", recvq: 0, sendq: 128, localAddr: "0.0.0.0",   localPort: 22,   peerAddr: "0.0.0.0",   peerPort: "*",   process: `users:(("sshd",pid=842,fd=3))` },
      { netid: "tcp", state: "LISTEN", recvq: 0, sendq: 128, localAddr: "0.0.0.0",   localPort: 5432, peerAddr: "0.0.0.0",   peerPort: "*",   process: `users:(("postgres",pid=1100,fd=5))` },
      { netid: "tcp", state: "ESTAB",  recvq: 0, sendq: 0,   localAddr: "10.0.7.10", localPort: 22,   peerAddr: "10.0.7.42", peerPort: 51234, process: `users:(("sshd",pid=12345,fd=4))` },
    ],
    journal: [
      { timestamp: "May 22 10:55:10", host: "halton-bastion", unit: "sshd",            pid: "842",  message: "Server listening on 0.0.0.0 port 22." },
      { timestamp: "May 22 10:55:14", host: "halton-bastion", unit: "staging-worker",  pid: "2300", message: "Starting Halton staging-worker service" },
      { timestamp: "May 22 10:55:14", host: "halton-bastion", unit: "staging-worker",  pid: "2300", message: "loading config from /home/app_admin/staging-worker.env" },
      { timestamp: "May 22 10:55:14", host: "halton-bastion", unit: "staging-worker",  pid: "2300", message: "ERROR: permission denied reading /home/app_admin/staging-worker.env" },
      { timestamp: "May 22 10:55:14", host: "halton-bastion", unit: "staging-worker",  pid: "2300", message: "WARN: falling back to /home/app_admin/staging-worker.env.bak (mode 644)" },
      { timestamp: "May 22 10:55:14", host: "halton-bastion", unit: "staging-worker",  pid: "2300", message: "config loaded successfully; service ready" },
      { timestamp: "May 26 14:23:00", host: "halton-bastion", unit: "sshd",            pid: "842",  message: "Accepted publickey for app_admin from 10.0.7.42 port 51234 ssh2: ED25519 SHA256:Jk8...redacted" },
      { timestamp: "May 26 14:23:01", host: "halton-bastion", unit: "sshd",            pid: "842",  message: "pam_unix(sshd:session): session opened for user app_admin(uid=1001) by (uid=0)" },
    ],
    systemdUnits: {
      "staging-worker.service": {
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Halton staging-worker service",
        since: "Thu 2026-05-22 10:55:14 UTC; 4 days ago",
        enabled: true,
        preset: "enabled",
        mainPid: "2300",
        command: "staging-worker --config /home/app_admin/staging-worker.env",
        tasks: "3 (limit: 4915)",
        memory: "12.4M",
        cpu: "5.123s",
        cgroup: "/system.slice/staging-worker.service",
        logs: [
          "May 22 10:55:14 halton-bastion staging-worker[2300]: ERROR: permission denied reading /home/app_admin/staging-worker.env",
          "May 22 10:55:14 halton-bastion staging-worker[2300]: WARN: falling back to /home/app_admin/staging-worker.env.bak (mode 644)",
          "May 22 10:55:14 halton-bastion staging-worker[2300]: config loaded successfully; service ready",
        ],
      },
      "sshd.service": {
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "OpenSSH server daemon",
        since: "Thu 2026-05-22 10:55:10 UTC; 4 days ago",
        enabled: true,
        preset: "enabled",
        mainPid: "842",
        command: "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups",
        tasks: "1 (limit: 4915)",
        memory: "4.5M",
        cpu: "1.234s",
        cgroup: "/system.slice/sshd.service",
        logs: [
          "May 26 14:23:00 halton-bastion sshd[842]: Accepted publickey for app_admin from 10.0.7.42 port 51234 ssh2",
          "May 26 14:23:01 halton-bastion sshd[842]: pam_unix(sshd:session): session opened for user app_admin(uid=1001) by (uid=0)",
        ],
      },
    },
    dmesg: [
      { timestamp: "    0.000000", message: "Linux version 6.1.0-d3cyph3r (build@d3cyph3r) (gcc 12.2.0) #1 SMP Thu May 22 10:54:30 UTC 2026" },
      { timestamp: "    0.001234", message: "Command line: BOOT_IMAGE=/vmlinuz-6.1.0 root=/dev/sda1 ro" },
      { timestamp: "    1.234567", message: "systemd[1]: Started Journal Service" },
      { timestamp: "    3.456789", message: "systemd[1]: Reached target Multi-User System" },
      { timestamp: "10821.234567", message: "TCP: request_sock_TCP: Possible SYN flooding on port 22 (recent 2026-05-22T11:03:24Z)" },
    ],

    // v1.9.0 SHELL ENVIRONMENT — set a couple of per-level vars so a
    // curious player running `env` notices what their predecessor set
    // up. Players can `export FOO=bar` to add their own (writes win
    // over these on conflict), or `unset` to reveal the built-ins.
    env_vars: {
      EDITOR:        "nano",
      AWS_PROFILE:   "halton-staging",
      STAGING_HOST:  "halton-bastion.driftwood.internal",
    },

    // v1.9.0 MULTI-HOST PIVOT — Daniel's backup.sh scp's to
    // `halton-bastion`. The player can ssh into that downstream box
    // via the implied key-forward (no password — the bastion
    // accepts the agent-forwarded credential the way real ops
    // setups do). The pivot host is pure atmosphere: the player can
    // verify the backup landed, peek at the postgres log, and exit.
    // No credential gate; nothing on the bastion advances level1
    // chains. It's a "this is what lateral movement feels like in
    // bash" demo for the engine feature.
    network: {
      "dbsvc@halton-bastion": {
        playerUser: "dbsvc",
        // No `password` field → ssh connects without a password
        // gate. (Real bash's key-forwarding equivalent.)
        password: null,
        estimatedMinutes: 3,
        lesson: "You ssh'd into halton-bastion using agent forwarding. This is where Daniel's nightly backup lands. Walk the box; you're not looking for anything specific. `exit` returns you to staging-worker.",
        objective: "Confirm last night's backup landed at /var/backups/halton-staging/ and then `exit` back to the staging-worker shell.",
        env_vars: {
          BACKUP_RETENTION_DAYS: "14",
        },
        // The pivot host's fs is rooted at /home/dbsvc — same anchor
        // every other level uses. Service accounts often keep working
        // directories under their home (configured via pg_backup_dir
        // or similar), so the backup tree lives at ~/backups/.
        fs: {
          type: "dir",
          children: {
            "welcome.md": {
              type: "file",
              content:
`──────────────────────────────────────────────────
  halton-bastion — backups landing zone
──────────────────────────────────────────────────

You are: dbsvc (service account, no shell history)
Hostname: halton-bastion
Purpose:  receives nightly backups from staging-worker
          via Daniel's backup.sh (scp + key-forwarded
          ssh from /home/app_admin/backup.sh)

──── HOW YOU GOT HERE ───────────────────────────

You ssh'd in from staging-worker without typing a
password. SSH agent-forwarding lets a connection
authenticate using a key cached on the upstream
shell — convenient, dangerous, and the reason
"pivoting" is a thing in red-team training.

──── WHAT'S HERE ────────────────────────────────

  ~/backups/halton-staging/   nightly snapshots
  ~/logs/postgresql.log       the .log Daniel
                              mentioned in his
                              handoff note

(Daniel's setup pinned the postgres backup
landing-zone to dbsvc's home — convenient for
the service account, easier to back up than a
sprawling /var/ tree, and the reason a single
ssh-in here surfaces everything.)

──── HOW TO GO BACK ─────────────────────────────

Type \`exit\` (or \`logout\`). You'll be returned
to the staging-worker shell as app_admin. Your
env, jobs, and history on staging-worker are
preserved across the pivot; this box has its own.
`,
            },
            "backups": {
              type: "dir",
              children: {
                "halton-staging": {
                  type: "dir",
                  children: {
                    "halton-staging-2026-05-26.sql.gz": {
                      type: "file",
                      content: "(gzipped PostgreSQL dump; 4.2 MB. Use gunzip + grep to inspect.)",
                    },
                    "halton-staging-2026-05-25.sql.gz": {
                      type: "file",
                      content: "(gzipped PostgreSQL dump; 4.1 MB.)",
                    },
                    "halton-staging-2026-05-24.sql.gz": {
                      type: "file",
                      content: "(gzipped PostgreSQL dump; 4.1 MB.)",
                    },
                  },
                },
              },
            },
            "logs": {
              type: "dir",
              children: {
                "postgresql.log": {
                  type: "file",
                  content:
`2026-05-26 02:00:03 UTC LOG:  connection received: host=staging-worker.halton-staging port=51234
2026-05-26 02:00:03 UTC LOG:  connection authorized: user=halton_staging database=halton_staging
2026-05-26 02:00:03 UTC LOG:  pg_dump initiated for halton_staging
2026-05-26 02:00:12 UTC LOG:  pg_dump completed (9.234s, 4.2 MB)
2026-05-26 02:00:12 UTC LOG:  disconnection: session time: 0:00:09.243
2026-05-25 02:00:02 UTC LOG:  connection received: host=staging-worker.halton-staging port=49882
2026-05-25 02:00:02 UTC LOG:  connection authorized: user=halton_staging database=halton_staging
2026-05-25 02:00:02 UTC LOG:  pg_dump initiated for halton_staging
2026-05-25 02:00:11 UTC LOG:  pg_dump completed (8.997s, 4.1 MB)
`,
                },
              },
            },
          },
        },
      },
    },

    // v1.9.0 BONUS FINDS — optional discoverable nuggets. Won't gate
    // the credential chain; reward the player for exploring beyond
    // the smoking-gun file. Two finds here:
    //   1. Reading backup.sh — Daniel's hand-rolled job — reveals the
    //      override.conf path he sources for credentials.
    //   2. Running `journalctl -u staging-worker` and seeing the
    //      ERROR/WARN sequence proves the system is logging the bug
    //      to its own journal (a real defender's audit trail).
    bonusFinds: [
      {
        id:   "backup-script",
        name: "Daniel's backup script",
        hint: "He's pulling credentials from a systemd unit override.",
        trigger: { command: "cat", argMatches: /backup\.sh/, outputContains: "override.conf" },
      },
      {
        id:   "self-logged-bug",
        name: "Self-logged config-fallback bug",
        hint: "The staging-worker journal records its own permission denial — a defender would have seen this on day one.",
        trigger: { command: "journalctl", outputContains: "falling back to" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`Driftwood internal security — Halton Bank engagement, ongoing.

You're logged in as \`app_admin\` on Halton's jumphost — the staging
service account whose credentials you found on Daniel's laptop. This
is a different box than yesterday. Yesterday you were auditing
Daniel's laptop offline. Today you're on a live client production
bastion using credentials Daniel leaked. A real attacker who pulled
the same trick would be exactly here.

You have a job to do: find the production database credential a
misconfigured file is leaking. Read every file you can read.

New commands you'll use today:

  ls -l       Long format. Adds permission and ownership columns.
  ls -la      Long format AND hidden files (the -a from yesterday).

Each line of \`ls -l\` output starts with a permissions string that
looks like this:

  -rw-r--r--

Read it as four chunks:

  -           File type. - for regular file, d for directory.
  rw-         Owner permissions: r=read, w=write, x=execute, -=denied.
  r--         Group permissions, same letters.
  r--         Other permissions (everyone else), same letters.

A file with mode \`-rw-------\` can only be read by its owner. If you
try to cat a file you don't have read permission for, you'll get
"Permission denied" instead of the contents.

Read handoff.md next — it's Daniel's note to whoever inherits this
account. Then run \`ls -la\` and look at the column. The find is in
this directory; you just need to notice which file has permissions
it should not.
`
        },

        "handoff.md": {
          type: "file",
          content:
`# Hand-off — Daniel → whoever Halton rotates onto this account

So you ssh'd in as app_admin. That probably means you used the
creds from my old laptop. Yes, those credentials are not supposed
to give a login shell on this box. Halton's ops team configured
the staging service account with /bin/bash "for debugging." It
is what it is.

What you need to know:

  - The live production database password lives in:
      /etc/systemd/system/staging-worker.service.d/override.conf

    That file is owned by root and mode 600 — you can't cat it as
    app_admin. That's the correct configuration. (For the record:
    Halton's ops team got this part right.)

  - Last November I was debugging a staging-worker outage and I
    needed to grep the env vars without sudo. So I cp'd a copy into
    my home directory and called it \`staging-worker.env.bak\`. I
    MEANT to delete it after the incident.

    I did not.

    The copy I made retained the default mode and ended up owned by
    me — owner-readable, group-readable, world-readable. Mode 644.
    Anyone who lands on this box as app_admin can read the same
    production password the original file carefully protects.

    Run \`ls -la\` and look at the permissions column. The official
    file is locked down. My backup is not. That's the whole story.

  - Priya (the senior consultant who handles handoffs) is supposed
    to rotate the prod password as part of the engagement closeout.
    She has not. The Q3 password is still live. Yes, the one from
    Q3. Last quarter's. Currently May.

  - The cron at 02:00 UTC runs backup.sh — that's mine. Don't
    disable it; Priya's pipeline depends on it. If you ever do need
    to, her ssh key is on the receiving end at the bastion.

Things that aren't important but I'm telling you anyway:

  - Halton is still on Ubuntu 20.04. Twelve months from EOL. They
    know. They will deal with it in Q4. (Q4 of which year, unclear.)
  - The Halton dashboard is, as of this writing, still red.
  - The nickel coffee machine on Driftwood's floor 4 still takes
    nickels. The vendor is "Vendolux." I called them. They were not
    interested in changing.

— Daniel
`
        },

        "backup.sh": {
          type: "file",
          content:
`#!/bin/bash
# Halton-staging schema backup. Daniel's hand-rolled job.
# Runs at 02:00 UTC via root crontab. Output ships to the bastion
# via ssh — Priya's key is on the receiving end.

set -euo pipefail

# Load the staging-worker environment override so we have the DB
# connection string. The override file is the canonical place
# Halton's ops team stashed the credentials.
source /etc/systemd/system/staging-worker.service.d/override.conf

OUT="/tmp/halton-staging-$(date +%F).sql.gz"

pg_dump -h "$DB_STAGING_HOST" -U "$DB_STAGING_USER" halton_staging \\
  | gzip \\
  > "$OUT"

scp "$OUT" halton-bastion:/var/backups/halton-staging/
rm -f "$OUT"
`
        },

        ".bash_history": {
          type: "file",
          content:
`ls -la
sudo systemctl status staging-worker
sudo journalctl -u staging-worker -n 200
sudo cat /etc/systemd/system/staging-worker.service.d/override.conf
sudo vi /etc/systemd/system/staging-worker.service.d/override.conf
sudo systemctl restart staging-worker
sudo cp /etc/systemd/system/staging-worker.service.d/override.conf /home/app_admin/staging-worker.env.bak
sudo chown app_admin:app_admin staging-worker.env.bak
grep DB_PROD_PASS staging-worker.env.bak
psql -h prod-db.halton.internal -U svc_prod_worker
ssh halton-bastion
exit
`
        },

        "staging-worker.env": {
          type: "file",
          content:
`# Halton Bank — staging-worker production override
# This file is sourced by systemd at unit start.
# Owner: root  Mode: 600  — DO NOT loosen perms.

DB_STAGING_HOST=staging-db.halton.internal
DB_STAGING_USER=app_admin
DB_STAGING_PASS=please-rotate-me

DB_PROD_HOST=prod-db.halton.internal
DB_PROD_USER=svc_prod_worker
DB_PROD_PASS=Halton-2024-Q3!

PG_SSLMODE=require
`
        },

        "staging-worker.env.bak": {
          type: "file",
          content:
`# Halton Bank — staging-worker production override
# Daniel's debug copy from the November staging-worker incident.
# TODO: delete this. (Never did.)
# TODO: also rotate the prod creds. (Never did either.)

DB_STAGING_HOST=staging-db.halton.internal
DB_STAGING_USER=app_admin
DB_STAGING_PASS=please-rotate-me

DB_PROD_HOST=prod-db.halton.internal
DB_PROD_USER=svc_prod_worker
DB_PROD_PASS=Halton-2024-Q3!

PG_SSLMODE=require
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just found a production database credential exposed by a careless
backup. The credential itself lives in a properly protected file
(mode 600, root-owned). A debugging copy of that file — at standard
default mode 644, owned by a service account anyone with the leaked
staging creds can log in as — leaks the same secret to anyone on the
box.

The lock on the front door doesn't matter if there's a key under the
mat. Daniel locked the front door. Then he taped a copy of the key
to the wall and left.

─── THE BLUNT VERSION ────────────────────────────────────────

This is one of the most common findings in real-world security
audits, especially on systems where ops engineers debug under
pressure. The pattern always looks the same:

  1. A sensitive file is properly locked down.
  2. Someone needs to read it (debugging, config inspection, a
     forensic capture) and doesn't want to keep using sudo.
  3. They cp it somewhere readable, chown it to themselves.
  4. They get distracted. The copy never gets deleted.
  5. Months later, someone with shell access (legitimate or not)
     finds the copy.

Backups and dev copies of secrets are the source of an enormous
share of real-world credential exposures. The CWE catalog has been
flagging this for over a decade.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For a consulting firm specifically, the leak is worse than it would
be at a single-tenant org. The exposed credential here is Halton's
production database password — not Driftwood's. The Master Services
Agreement Driftwood signed with Halton makes exposure of a client
production credential a material breach with notification obligations
typically measured in hours.

The blast radius isn't just "this one box." Anyone who pivoted onto
this jumphost — through the leaked staging creds in level 0, or
through any other foothold — could have exfiltrated the prod
password months ago. The "have we been breached?" question is
suddenly an "are we sure we haven't been breached?" question, which
forensically is much harder to answer cleanly.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-732: Incorrect Permission Assignment for Critical Resource
    Exactly this finding. The catalog entry specifically calls out
    config files, key material, and credential stores left at
    overly permissive modes.

  NIST SP 800-53 Rev. 5
    AC-3 (Access Enforcement): the system must enforce approved
      authorizations. Mode 644 doesn't enforce; mode 600 does.
    AC-6 (Least Privilege): app_admin had no business being able
      to read prod credentials. The backup gave it that ability.
    SC-28 (Protection of Information at Rest): credentials are
      data at rest. The control requires either encryption or
      strict access control. Mode 644 is neither.

  CIS Critical Security Controls v8.1
    3.3 (Configure Data Access Control Lists): the canonical
      defender play against this anti-pattern.
    4.7 (Restrict access to administrative interfaces): related,
      since the jumphost shouldn't have been giving service
      accounts an interactive shell in the first place.

  OWASP Top 10 (2025) — A02: Security Misconfiguration
    The umbrella category (A05 in the 2021 edition; moved up to
    A02 in 2025). "Improperly configured permissions on cloud
    services / files / directories" is one of the named examples.

  GLBA Safeguards Rule (16 CFR Part 314)
    For Halton specifically. Safeguards Rule 314.4(c)(1) requires
    "appropriate access controls" on customer-information systems.
    This is a textbook failure to meet that standard.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 3.1 (Security architecture: hardening) — file system
    permissions and least privilege are tested directly.

  ISC2 CC / SSCP
    Access control fundamentals — owner / group / other model.

  CISSP
    Domain 5 (Identity & Access Management). Domain 7 (Sec Ops).
    Both touch this. Discretionary access control (DAC) is the
    Unix permission model in CISSP parlance.

  OSCP / PEN-200
    Privilege escalation via misconfigured files is a category. The
    classic pattern: SUID binaries, world-writable cron scripts,
    sudoers misconfigurations. Today's lesson is the credential
    variant — equally common in real engagements.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1078     — Valid Accounts (the staging-account login itself)
  T1083     — File and Directory Discovery (carryover from lvl 0)
  T1552.001 — Unsecured Credentials: Credentials In Files
  T1006     — Direct Volume Access (loosely — when an attacker
              reads files the access-control layer should have
              denied, but the layer was misconfigured)

T1552.001 in particular is one of the highest-frequency techniques
in published threat reports. It will be in every incident report
you read for the rest of your career.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Audit world-readable files in /home and /tmp for credential
     patterns. Tools that find this fast: \`grep -r\` with credential
     regexes, gitleaks/trufflehog (not just for git — they scan
     filesystems too), osquery, CrowdStrike Falcon, Microsoft
     Purview, AWS Macie / S3 sensitive-data scanning.
  2. File Integrity Monitoring (FIM) on /etc and other sensitive
     paths. AIDE, OSSEC/Wazuh, Tripwire — anything that alerts when
     /etc/systemd/system/* gets cat'd or cp'd unexpectedly.
  3. Deploy tooling that re-applies correct modes on every run.
     Ansible's \`file\` module, Chef's \`file\` resource, Puppet's
     \`File\` type — all of them let you assert "this file MUST be
     mode 600 owned by root" and remediate drift on each run.
  4. Just-in-time access via bastion/PAM tools (CyberArk, BeyondTrust,
     HashiCorp Boundary, AWS Systems Manager Session Manager). The
     fix for "this service account has a login shell" is not
     "remove the shell" — it's "remove the persistent account
     entirely; use short-lived broker-issued credentials."
  5. Secret-management retrofit. If the credential ever lived in a
     config file, ANY config file, treat it as compromised — even
     the supposedly locked one. Rotate. Then migrate to a real
     secrets backend (Vault, Secrets Manager, Doppler, etc).

─── CLOSING THOUGHT ──────────────────────────────────────────

The fix isn't a new lock. It's not having the key copies.

Every credential-exposure incident you read about in the news has
this finding somewhere in the timeline: somebody copied a secret to
make their day easier and forgot to clean up. The mistake is mundane.
The consequences are not.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
