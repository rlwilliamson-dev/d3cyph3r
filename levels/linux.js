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
// Optional forward-looking metadata fields (v1.22.0).
// All four are optional today — they exist so future content sweeps
// can populate them without a schema migration once 28+ levels ship.
// Reading them before they're populated returns undefined, which
// every current consumer tolerates.
//
//   level.certificationDomains : string[] — entries shaped as
//     "<cert-short-name>:<domain-id>", e.g. ["Sec+:2.5", "CySA+:1.2",
//     "CCSP:Domain-3"]. Surfaced in a future `certs <level>` command
//     and an out-of-game CERTIFICATIONS.md crosswalk doc. Populate
//     when the cert-crosswalk doc is authored; until then, leave
//     unset on shipped levels.
//
//   level.learnerJourneyOrder : positive integer — global ordering
//     index used by a future `journey` command that prints a
//     hand-holdy recommended path across tracks for new players.
//     Populate when the journey doc is authored; lower numbers come
//     first. Sparse numbers (10, 20, 30...) are fine — leaves room
//     for inserting levels later without renumbering.
//
//   level.mobileReady : boolean — true ONLY when the level was
//     designed against the mobile-readable content style guide
//     (CONTRIBUTING.md). Set conservatively. Pre-v1.22 levels were
//     authored desktop-first and don't set this flag — that's
//     expected; leave them unset rather than retro-claiming
//     mobile-readiness. A future lobby filter can prefer
//     mobileReady levels on touch devices.
//
//   level.crossTrackHooks : string[] — track keys (lowercase: "linux",
//     "network", "crypto", "web", "forensics", "osint", "cloud")
//     referenced in flavor content on THIS level. Used to feed
//     v2.0+ cross-track narrative threading and a future
//     `references` command. Populate as cross-track narrative seeds
//     are planted; empty/unset means this level is self-contained.
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
//     "Try `cat creds.txt`. The password is in there, prefixed with `pass:`.",
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
// Optional: SUDO / PRIVILEGE ESCALATION (v2.1.0). Opts a level into a
// functional `sudo` (the handler lives in js/commands/linux.js; without
// this field `sudo` stays the canonical always-deny stub):
//
//   level.sudo: {
//     host?: "build-runner",        // shown in `sudo -l` (defaults to
//                                   // the short HOSTNAME)
//     entries: [
//       { runAs?: "root",           // target user (default "root")
//         nopasswd?: true,          // true → NOPASSWD tag in `sudo -l`
//         commands: ["/usr/bin/cat /var/backups/halton-prod/*"] },
//       ...
//     ],
//   }
//
// Each `commands` entry is a sudoers command spec: a binary path
// optionally followed by an fnmatch-style argument pattern (`*`, `?`).
// `sudo -l` renders the grants in canonical format. `sudo <cmd> <args>`
// is PERMITTED when the requested binary basename matches a grant's
// binary AND (if the grant constrains args) every requested path —
// resolved to an absolute fs path — falls under the grant's glob;
// `"ALL"` or a bare binary permits anything for that binary. A permitted
// `sudo cat` reads root-owned files (real root ignores permission bits);
// any other permitted binary prints a sandbox note rather than faking a
// root shell. Denied invocations print the canonical "user is not
// allowed to execute '...' as root" line. Teaches sudoers-misconfig
// enumeration + exploitation (CWE-250 / CWE-732 / MITRE T1548.003).
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
    // v1.22.0 cross-track narrative seed — Priya's mention of next
    // week's Atlas Health perimeter check in CLOSING THOUGHT. See
    // CONTRIBUTING.md "Worldbuilding continuity" for the pattern.
    crossTrackHooks: ["network"],
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

─── FRAMEWORKS THAT COVER THIS ────────────────────────────────

Two weaknesses, one control family, one regulator.

  CWE-798   Use of Hard-coded Credentials — the client password
            written into a flat file instead of a secrets manager.
  CWE-312   Cleartext Storage of Sensitive Information — it sat
            there in plaintext, on a laptop awaiting reimage.

  NIST SP 800-53 AC-2(3) and PS-4 are the controls: disable
  accounts and revoke authenticators when someone separates.
  Neither happened here.

  GLBA § 501(b) applies because Halton is a bank, so the rule is
  the Interagency Guidelines (12 CFR Pt. 30 App. B), not the FTC
  Safeguards Rule that covers nonbank institutions. III.C.1.a is
  access control; III.D puts oversight of service providers like
  Driftwood on Halton.

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

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. Daniel's laptop gets reimaged on Wednesday. Does that
     resolve the finding? Why not?

  2. \`notes.txt\` named three more places the same password
     lives. Why does that make it the most valuable file in
     the directory?

  3. Driftwood exposed the credential. Why does Halton carry a
     finding too?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/linux/level0.html

The walkthrough covers the full NIST and CIS control mapping,
the certification objectives, how this finding is sized for a
risk register, the real-world offboarding breaches it mirrors,
and a Sigma rule for credential files on endpoints. Answers to
the three questions above are in there.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

In a regular tech org, this is bad. In a consulting firm, this is
contractually a breach, often regulatorily a breach, and always
reputationally a breach. The firm's standing rides on every
consultant's home directory.

The disappointment, when you find one, is the lesson.

Priya heads to Atlas Health next week for a quarterly perimeter
check. Different client, different stack, same job — make sure
no one left a credential where the next person can find it.

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
    title: "Daniel's forgotten backup",
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

─── FRAMEWORKS THAT COVER THIS ────────────────────────────────

One weakness, three controls, one regulator.

  CWE-732   Incorrect Permission Assignment for Critical Resource
            — the catalog entry names config files and credential
            stores left at overly permissive modes. That is this
            finding exactly.

  NIST SP 800-53 AC-3 is the control that matters: the system must
  enforce approved authorizations. Mode 644 does not enforce;
  mode 600 does. AC-6 and SC-28 follow from it.

  GLBA § 501(b) applies because Halton is a bank, so the rule is
  the Interagency Guidelines (12 CFR Pt. 30 App. B), not the FTC
  Safeguards Rule that covers nonbank institutions. III.C.1.a is
  access control; III.D puts oversight of service providers like
  Driftwood on Halton.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1078     — Valid Accounts (the staging-account login itself)
  T1083     — File and Directory Discovery (carryover from lvl 0)
  T1552.001 — Unsecured Credentials: Credentials In Files
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

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. The original override is mode 600 and root-owned. Someone
     did that work deliberately. Why did it buy nothing?

  2. The shadow copy went undetected for five months. Which
     control does that number indict, and why is it the number
     a regulator asks about first?

  3. A *staging* credential got you onto a *production*
     jumphost. Which failure is that, and does fixing the file
     permissions address it?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/linux/level1.html

The walkthrough covers the full control mapping, the
certification objectives, how the finding is sized, the
real-world cases it mirrors, and a Sigma rule that alerts when a
sensitive system file is copied into a user's home directory.

From the terminal:    walkthrough

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

  // ── level 2 — "Daniel's Forgotten Cron" ─────────────────────────
  // Player ssh's into halton-prod-bastion with `Halton-2024-Q3!` —
  // the same string Halton uses for both the prod DB and the
  // bastion's SSH login, by policy. That cross-use (CWE-521) is
  // the only reason the level1 finding traverses into a shell here.
  // Welcome.md calls it out so the player understands the hop.
  //
  // The puzzle is cron 101 with a tombstoned-account twist:
  //   1. `ls /etc/cron.d/` reveals `halton-weekly-snapshot`
  //   2. `cat /etc/cron.d/halton-weekly-snapshot` shows it runs
  //      `/opt/halton/snapshot-config.sh` as user `daniel` (the
  //      offboarded consultant whose account was never disabled),
  //      every Sunday at 03:00 UTC, with stdout/stderr redirected
  //      to `/var/log/cron-daniel.log`
  //   3. `cat /var/log/cron-daniel.log` (mode 644) shows bash's
  //      `set -x` trace echoing `+ export SSH_KEY_PASSPHRASE='H@l…'`
  //      every Sunday for the last six months. That passphrase is
  //      the level3@linux entry credential.
  //
  // Lessons:
  //   - CWE-250 Execution with Unnecessary Privileges (daniel's
  //     account runs cron after his offboarding)
  //   - CWE-532 Sensitive Info in Log File (set -x emits the
  //     exported value to a 644-mode log)
  //   - CWE-521 Weak Password Requirements (Halton's quarterly-
  //     pattern policy has near-zero entropy; the same string
  //     gates two unrelated systems)
  //   - NIST SP 800-53 Rev. 5 PS-4 (Personnel Termination) + AC-2(3)
  //     (Disable Accounts)
  //   - MITRE ATT&CK T1078.003 (Valid Accounts: Local Accounts) and
  //     T1552.001 (Unsecured Credentials: Credentials In Files)
  //
  // Engine note: the level uses the engine's "fs root === player's
  // home dir" mapping to place system paths (etc/, var/, opt/) at
  // the fs root. `ls ~` and `ls /` show the same children;
  // `cat /etc/cron.d/halton-weekly-snapshot` and
  // `cat ~/etc/cron.d/halton-weekly-snapshot` are the same lookup.
  // Welcome.md acknowledges the audit-chroot framing so the
  // unusual layout reads as intentional rather than buggy.
  //
  // Two bonus finds (don't gate the chain):
  //   - "Daniel's account is still active" — triggered by reading
  //     /etc/passwd and seeing his line with /bin/bash shell
  //   - "Halton's quarterly-password policy" — triggered by
  //     reading /opt/halton/PASSWORD-POLICY.md (the systemic root
  //     cause behind both the level1 and level2 leaks)
  //
  // Breadcrumb out: `H@lton-Snapshot-2024-Q4` gates level3@linux
  // at the (future) `halton-build-runner` host. Q4 dating is the
  // tell: Daniel set this up six months before he rolled off and
  // never rotated it.
  "level2@linux": {
    password: "Halton-2024-Q3!",
    track: "linux",
    title: "Daniel's forgotten cron",
    estimatedMinutes: 12,
    playerUser: "audit",
    objective: "Find the cron job leaking an SSH key passphrase via its own log — and document how an offboarded consultant's account was permitted to keep running production jobs six months after he rolled off.",
    lesson: "Day three. Halton reuses the same string for the prod DB password AND the bastion login password, so 'Halton-2024-Q3!' from yesterday's staging-worker.env.bak got you root-ish access here. Welcome.md explains the password-reuse hop and the audit-chroot layout. Then walk /etc/cron.d/ — one of the jobs runs under an account that should have been disabled six months ago, and it writes its own credentials to a world-readable log every Sunday.",
    hints: [
      "Halton manages production cron via system-wide jobs, not user crontabs. `ls /etc/cron.d/` is where to look.",
      "The `halton-weekly-snapshot` job redirects its output to /var/log/cron-daniel.log. Read it.",
      "The log captures bash's `set -x` trace. Look for the line that exports SSH_KEY_PASSPHRASE — that's your level3 credential.",
    ],
    permissions: {
      "welcome.md":         { mode: "-rw-r--r--", owner: "audit",  group: "audit", size: 2348 },
      "lessons-learned.md": { mode: "-rw-r--r--", owner: "audit",  group: "audit", size: 5912 },
      ".bash_history":      { mode: "-rw-------", owner: "audit",  group: "audit", size:  412 },
      // Top-level system dirs are shown as ordinary directories in
      // ls -la output. Their CONTENTS carry the realistic modes.
      "etc":                { mode: "drwxr-xr-x", owner: "root",   group: "root",  size: 4096 },
      "var":                { mode: "drwxr-xr-x", owner: "root",   group: "root",  size: 4096 },
      "opt":                { mode: "drwxr-xr-x", owner: "root",   group: "root",  size: 4096 },
    },

    // ENV — per-level vars. AWS_PROFILE shifts from halton-staging
    // to halton-prod (you're on a different segment now). HOSTNAME
    // surfaces the bastion's full FQDN so prompt + `hostname` agree.
    env_vars: {
      EDITOR:      "nano",
      AWS_PROFILE: "halton-prod",
      HOSTNAME:    "halton-prod-bastion.driftwood.internal",
    },

    // SYSTEM INSPECTION schema. `crontab` covers user crontabs (this
    // box has none worth showing); the system-wide /etc/cron.d/
    // entries live in the fs tree because they're real readable files
    // on disk. journalctl surfaces cron.service events showing the
    // weekly fires landing.
    crontab: {
      "audit": "# crontab for audit (no scheduled jobs — production interactive use only)\n",
      "root":
`# Halton prod-bastion baseline maintenance (root)
*/5 *  *  *  * /usr/local/sbin/cron-health.sh
0    0  *  *  * /usr/sbin/logrotate /etc/logrotate.conf
0    4  *  *  * /usr/local/sbin/prune-snapshots.sh > /var/log/prune-snapshots.log 2>&1
`,
      // daniel has no USER-LEVEL crontab. His job lives under
      // /etc/cron.d/halton-weekly-snapshot (system-wide) and runs
      // AS daniel via the optional username column in cron.d entries.
      // The empty-but-present user crontab data tells the engine to
      // print "no crontab for daniel" when the player runs
      // `crontab -l -u daniel` — which is itself a teaching moment.
    },

    lastLogins: [
      { user: "audit",  tty: "pts/0", from: "10.0.7.42",  start: "Thu May 28 09:10", end: "still logged in",   duration: null     },
      { user: "audit",  tty: "pts/0", from: "10.0.7.42",  start: "Wed May 27 14:32", end: "Wed May 27 16:05",  duration: "01:33"  },
      { user: "root",   tty: "pts/0", from: "10.0.1.5",   start: "Tue May 26 11:15", end: "Tue May 26 11:42",  duration: "00:27"  },
      { user: "daniel", tty: "pts/0", from: "10.0.7.18",  start: "Fri Jan 31 16:45", end: "Fri Jan 31 17:20",  duration: "00:35"  },
      { user: "reboot", tty: "system boot", from: "6.1.0-d3cyph3r", start: "Wed Jan 15 02:00", end: "still running", duration: null },
    ],

    activeSessions: [
      { user: "audit", tty: "pts/0", from: "10.0.7.42", login: "09:10", idle: "0.00s", jcpu: "0.34s", pcpu: "0.08s", what: "w" },
    ],

    openFiles: [
      { command: "sshd",      pid: "812",   user: "root",     fd: "3u",  type: "IPv4", device: "12345", sizeOrOff: "0t0",   node: "TCP", name: "*:22 (LISTEN)" },
      { command: "sshd",      pid: "21044", user: "root",     fd: "4u",  type: "IPv4", device: "23456", sizeOrOff: "0t0",   node: "TCP", name: "10.0.4.5:22->10.0.7.42:56118 (ESTABLISHED)" },
      { command: "cron",      pid: "974",   user: "root",     fd: "cwd", type: "DIR",  device: "253,1", sizeOrOff: "4096",  node: "2",   name: "/" },
      { command: "cron",      pid: "974",   user: "root",     fd: "3r",  type: "REG",  device: "253,1", sizeOrOff: "186",   node: "131082", name: "/etc/cron.d/halton-weekly-snapshot" },
      { command: "postgres",  pid: "1142",  user: "postgres", fd: "5u",  type: "IPv4", device: "34567", sizeOrOff: "0t0",   node: "TCP", name: "*:5432 (LISTEN)" },
    ],

    sockets: [
      { netid: "tcp", state: "LISTEN", recvq: 0, sendq: 128, localAddr: "0.0.0.0",  localPort: 22,   peerAddr: "0.0.0.0",  peerPort: "*",     process: `users:(("sshd",pid=812,fd=3))` },
      { netid: "tcp", state: "LISTEN", recvq: 0, sendq: 128, localAddr: "0.0.0.0",  localPort: 5432, peerAddr: "0.0.0.0",  peerPort: "*",     process: `users:(("postgres",pid=1142,fd=5))` },
      { netid: "tcp", state: "ESTAB",  recvq: 0, sendq: 0,   localAddr: "10.0.4.5", localPort: 22,   peerAddr: "10.0.7.42", peerPort: 56118,   process: `users:(("sshd",pid=21044,fd=4))` },
    ],

    // Journal carries the most recent Sunday run of the snapshot
    // cron, plus the audit session that just started. The cron.service
    // log entries are what a defender SHOULD have caught.
    journal: [
      { timestamp: "May 24 03:00:01", host: "halton-prod-bastion", unit: "cron.service",     pid: "974",   message: "(daniel) CMD (/opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1)" },
      { timestamp: "May 24 03:00:01", host: "halton-prod-bastion", unit: "cron.service",     pid: "974",   message: "pam_unix(cron:session): session opened for user daniel(uid=1042) by (uid=0)" },
      { timestamp: "May 24 03:00:14", host: "halton-prod-bastion", unit: "cron.service",     pid: "974",   message: "pam_unix(cron:session): session closed for user daniel" },
      { timestamp: "May 17 03:00:01", host: "halton-prod-bastion", unit: "cron.service",     pid: "974",   message: "(daniel) CMD (/opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1)" },
      { timestamp: "May 17 03:00:13", host: "halton-prod-bastion", unit: "cron.service",     pid: "974",   message: "pam_unix(cron:session): session closed for user daniel" },
      { timestamp: "May 27 14:32:10", host: "halton-prod-bastion", unit: "sshd",             pid: "812",   message: "Accepted password for audit from 10.0.7.42 port 56091 ssh2" },
      { timestamp: "May 28 09:10:02", host: "halton-prod-bastion", unit: "sshd",             pid: "812",   message: "Accepted password for audit from 10.0.7.42 port 56118 ssh2" },
      { timestamp: "May 28 09:10:02", host: "halton-prod-bastion", unit: "sshd",             pid: "812",   message: "pam_unix(sshd:session): session opened for user audit(uid=1099) by (uid=0)" },
    ],

    systemdUnits: {
      "cron.service": {
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "Regular background program processing daemon",
        since: "Wed 2026-01-15 02:00:14 UTC; 4 months 13 days ago",
        enabled: true,
        preset: "enabled",
        mainPid: "974",
        command: "/usr/sbin/cron -f -P",
        tasks: "1 (limit: 4915)",
        memory: "2.1M",
        cpu: "37.412s",
        cgroup: "/system.slice/cron.service",
        logs: [
          "May 24 03:00:01 halton-prod-bastion CRON[974]: (daniel) CMD (/opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1)",
          "May 24 03:00:01 halton-prod-bastion CRON[974]: pam_unix(cron:session): session opened for user daniel(uid=1042) by (uid=0)",
          "May 24 03:00:14 halton-prod-bastion CRON[974]: pam_unix(cron:session): session closed for user daniel",
        ],
      },
      "sshd.service": {
        loadState: "loaded",
        activeState: "active",
        subState: "running",
        description: "OpenSSH server daemon",
        since: "Wed 2026-01-15 02:00:10 UTC; 4 months 13 days ago",
        enabled: true,
        preset: "enabled",
        mainPid: "812",
        command: "sshd: /usr/sbin/sshd -D [listener] 0 of 10-100 startups",
        tasks: "1 (limit: 4915)",
        memory: "4.8M",
        cpu: "2.918s",
        cgroup: "/system.slice/sshd.service",
        logs: [
          "May 28 09:10:02 halton-prod-bastion sshd[812]: Accepted password for audit from 10.0.7.42 port 56118 ssh2",
          "May 28 09:10:02 halton-prod-bastion sshd[812]: pam_unix(sshd:session): session opened for user audit(uid=1099) by (uid=0)",
        ],
      },
    },

    dmesg: [
      { timestamp: "    0.000000", message: "Linux version 6.1.0-d3cyph3r (build@d3cyph3r) (gcc 12.2.0) #1 SMP Wed Jan 15 01:59:30 UTC 2026" },
      { timestamp: "    0.001234", message: "Command line: BOOT_IMAGE=/vmlinuz-6.1.0 root=/dev/sda1 ro" },
      { timestamp: "    1.234567", message: "systemd[1]: Started Journal Service" },
      { timestamp: "    3.456789", message: "systemd[1]: Reached target Multi-User System" },
      { timestamp: "11234567.890", message: "audit: type=1106 audit(1748427001.234:42): pid=974 cron user=daniel session opened" },
    ],

    // BONUS FINDS. Both reinforce systemic-root-cause analysis
    // rather than the immediate puzzle. Discovered = +1 in `progress`.
    bonusFinds: [
      {
        id:   "tombstoned-daniel",
        name: "Daniel's account is still active",
        hint: "Halton never disabled daniel's local account when he rolled off — the snapshot cron only fires because his account still exists with /bin/bash. NIST 800-53 PS-4 / AC-2(3) failure.",
        // Triggers on `cat /etc/passwd` OR `grep daniel /etc/passwd`.
        // outputContains lands when daniel's entry is in the printed
        // bytes.
        trigger: { argMatches: /passwd/, outputContains: "daniel:x:1042" },
      },
      {
        id:   "password-cargo-cult",
        name: "Halton's quarterly-password policy",
        hint: "The mandated `<Brand>-YYYY-Q#` shape has near-zero entropy and is the systemic root cause behind both this leak and the staging one — rotation theater without actually being unpredictable.",
        trigger: { command: "cat", argMatches: /PASSWORD-POLICY/, outputContains: "Halton-YYYY-Q" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Halton Bank — Prod-Bastion Audit ──────
  Host:    halton-prod-bastion.driftwood.internal
  Acct:    audit (Driftwood internal-audit role; uid 1099)
  Date:    Thursday 2026-05-28 (engagement day three)
────────────────────────────────────────────────────────────

Priya: "Halton's CISO loved yesterday's staging-worker finding —
they pulled three more service accounts under our audit scope.
This box is one of them. Halton's prod-bastion. The credential
you found in staging-worker.env.bak got you in because Halton
reuses the same string for both the prod DB password AND the
bastion SSH login, by policy. Yes, that's another finding. Write
it up. Then look at what runs on this box — there's a cron job
that's been here for months and we already think we know what
it leaks, but we want you to find it the same way an attacker
would so the report holds up in front of their board."

Your in-world identity is \`audit\` (uid 1099, primary group
\`audit\`). Run \`id\` and \`whoami\` to confirm.

─── A NOTE ABOUT THE LAYOUT ───────────────────────────────────

Halton's prod-bastion runs the audit user inside a sandboxed
shell where the home dir and the read-only system root point at
the same node. That means \`ls ~\` shows the briefing docs
(welcome.md, lessons-learned.md) alongside the system paths
you'd usually find under \`/\` — \`etc/\`, \`var/\`, \`opt/\`.
That's intentional, not a bug. Halton's audit team scoped the
shell this way so we can only see the slice that matters for
this engagement.

The system paths work like you'd expect on any Linux box:

  cat /etc/cron.d/halton-weekly-snapshot     reads the actual file
  ls  /var/log/                              lists the actual dir
  cat /opt/halton/snapshot-config.sh         reads the actual script

─── NEW COMMANDS YOU'LL USE TODAY ─────────────────────────────

  ls /etc/cron.d/        System-wide cron entries managed by
                         packages or ops engineers. One line per
                         job. Different from user crontabs. This
                         is the one command the finding needs.

  (The two below are optional — they're for the §7.5 bonus
   exploration, not the required solve path.)

  crontab -l             Your own crontab.
  crontab -l -u <user>   Another user's crontab. (You'll see
                         this returns "no crontab" for daniel —
                         his job isn't in his user table.)

  journalctl -u <unit>   Read the systemd journal for a service.
                         Try \`journalctl -u cron.service\` to
                         see every cron fire systemd logged.

─── WHAT CRON IS, BRIEFLY ─────────────────────────────────────

Cron is the Unix scheduler. Two kinds of cron entries coexist
on a typical Linux box:

  USER CRONTABS         Managed via \`crontab -e\` (or
                        \`crontab -l\` to read). One per user,
                        stored under /var/spool/cron/. Lines are
                        five time fields + a command, executed
                        AS that user.

  SYSTEM-WIDE CRONTABS  Files under /etc/cron.d/ (and
                        /etc/cron.{hourly,daily,weekly,monthly}/).
                        Files are owned by root and dropped in
                        by packages or ops engineers. The
                        /etc/cron.d/ format adds a SIXTH column
                        between the schedule and the command:
                        the username to run the job as.

The system-wide form is more powerful because the username is
explicit — a single file can schedule jobs as different users.
It's also more dangerous because a job running as user X
doesn't require user X to be logged in, or even to know the
job exists. If user X's account survives offboarding, X's
cron jobs survive too.

Stdout and stderr from a cron job go to whoever the line says.
By default cron emails the user; with explicit redirection
(\`> /var/log/somefile.log 2>&1\`) the job's output lands in
that file with whatever permissions cron creates it as. If the
script uses bash \`set -x\` for debugging, every executed line
gets emitted to the trace — including \`export FOO=bar\` lines.
That's how credentials end up in logs.

─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat welcome.md                 You're already here.
  2.  ls /etc/cron.d/                See what's scheduled.
  3.  cat /etc/cron.d/halton-weekly-snapshot
                                     Read the entry. Who owns the
                                     job? Where does its output go?
  4.  cat /var/log/cron-daniel.log   Read the log. Look for the
                                     \`+ export SSH_KEY_PASSPHRASE=\`
                                     line — that's your breadcrumb.
  5.  cat lessons-learned.md         Post-mortem (after step 4).
  6.  exit                            Return to the lobby.

Bonus exploration when you're done:

  - \`cat /etc/passwd\` (or \`grep daniel /etc/passwd\`)
  - \`cat /opt/halton/PASSWORD-POLICY.md\`
  - \`journalctl -u cron.service\`
  - \`crontab -l\` and \`crontab -l -u daniel\`
`
        },

        ".bash_history": {
          type: "file",
          content:
`whoami
id
ls
cat welcome.md
ls /etc/cron.d/
cat /etc/cron.d/halton-weekly-snapshot
ls -l /var/log/
cat /var/log/cron-daniel.log
grep SSH_KEY_PASSPHRASE /var/log/cron-daniel.log
exit
`
        },

        // The system tree. Engine treats fs root as the home dir,
        // so these entries also appear as ~ siblings of welcome.md.
        // Welcome.md acknowledges this with the audit-chroot framing.
        "etc": {
          type: "dir",
          children: {

            "cron.d": {
              type: "dir",
              children: {

                "halton-weekly-snapshot": {
                  type: "file",
                  content:
`# Halton Bank — weekly prod-config snapshot
# Owner: daniel (originally; he set this up Q4 2024 before
#                rolling off and nobody's touched it since)
# Installed: 2024-10-13 (per package manifest)
# Purpose: ship a copy of /etc/halton + /etc/systemd to the
#          off-bastion build runner for quarterly audit
#          comparison
#
# Output is captured for retention per Halton's audit-trail
# policy. The script uses bash \`set -x\` so the run is fully
# inspectable in /var/log/cron-daniel.log.

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

# m h dom mon dow user    command
0 3 * * 0     daniel  /opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1
`
                },

              },
            },

            // /etc/passwd — bonus-find trigger. daniel still has a
            // login shell five months after rolling off. Audit user
            // is the player. The GECOS comment on daniel's row
            // documents the rollover date in human-readable form,
            // which is itself the finding.
            "passwd": {
              type: "file",
              content:
`root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
systemd-network:x:998:998:systemd Network Management:/:/usr/sbin/nologin
sshd:x:113:65534::/run/sshd:/usr/sbin/nologin
postgres:x:114:120:PostgreSQL administrator,,,:/var/lib/postgresql:/bin/bash
daniel:x:1042:1042:Daniel Vance (rolled off Halton 2025-01-31):/home/daniel:/bin/bash
audit:x:1099:1099:Driftwood Internal Audit:/home/audit:/bin/bash
`
            },

          },
        },

        "var": {
          type: "dir",
          children: {

            "log": {
              type: "dir",
              children: {

                // The smoking gun. Bash's set -x echoes every
                // executed line, including the SSH_KEY_PASSPHRASE
                // export. Six weekly runs preserved so the player
                // can see the leak is recurring, not a one-shot.
                "cron-daniel.log": {
                  type: "file",
                  content:
`=== Sun Apr 19 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-04-19
+ mkdir -p /tmp/halton-snapshot-2026-04-19
+ cp -a /etc/halton /tmp/halton-snapshot-2026-04-19/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-04-19/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-04-19/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,182,914 bytes  received 1,204 bytes  836,823.60 bytes/sec
total size is 4,180,222  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-04-19

=== Sun Apr 26 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-04-26
+ mkdir -p /tmp/halton-snapshot-2026-04-26
+ cp -a /etc/halton /tmp/halton-snapshot-2026-04-26/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-04-26/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-04-26/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,183,012 bytes  received 1,204 bytes  836,843.20 bytes/sec
total size is 4,180,320  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-04-26

=== Sun May  3 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-05-03
+ mkdir -p /tmp/halton-snapshot-2026-05-03
+ cp -a /etc/halton /tmp/halton-snapshot-2026-05-03/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-05-03/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-05-03/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,183,228 bytes  received 1,204 bytes  836,886.40 bytes/sec
total size is 4,180,536  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-05-03

=== Sun May 10 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-05-10
+ mkdir -p /tmp/halton-snapshot-2026-05-10
+ cp -a /etc/halton /tmp/halton-snapshot-2026-05-10/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-05-10/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-05-10/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,183,418 bytes  received 1,204 bytes  836,924.40 bytes/sec
total size is 4,180,726  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-05-10

=== Sun May 17 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-05-17
+ mkdir -p /tmp/halton-snapshot-2026-05-17
+ cp -a /etc/halton /tmp/halton-snapshot-2026-05-17/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-05-17/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-05-17/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,183,612 bytes  received 1,204 bytes  836,963.20 bytes/sec
total size is 4,180,920  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-05-17

=== Sun May 24 03:00:01 UTC 2026 ===
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ echo H@lton-Snapshot-2024-Q4
+ ssh-add -p /etc/halton/keys/snapshot-rsync.key
Identity added: /etc/halton/keys/snapshot-rsync.key (snapshot-2024@halton)
+ SNAPSHOT_DIR=/tmp/halton-snapshot-2026-05-24
+ mkdir -p /tmp/halton-snapshot-2026-05-24
+ cp -a /etc/halton /tmp/halton-snapshot-2026-05-24/etc-halton
+ cp -a /etc/systemd /tmp/halton-snapshot-2026-05-24/etc-systemd
+ rsync -a /tmp/halton-snapshot-2026-05-24/ daniel@halton-build-runner:/var/backups/halton-prod/
sent 4,183,818 bytes  received 1,204 bytes  837,004.40 bytes/sec
total size is 4,181,126  speedup is 1.00
+ rm -rf /tmp/halton-snapshot-2026-05-24
`
                },

                // Atmospheric — gives the dir a realistic shape.
                "syslog": {
                  type: "file",
                  content:
`May 28 09:10:02 halton-prod-bastion sshd[812]: Accepted password for audit from 10.0.7.42 port 56118 ssh2
May 28 09:10:02 halton-prod-bastion systemd-logind[623]: New session 47 of user audit.
May 28 09:00:01 halton-prod-bastion CRON[20910]: (root) CMD (/usr/local/sbin/cron-health.sh)
May 28 08:55:01 halton-prod-bastion CRON[20891]: (root) CMD (/usr/local/sbin/cron-health.sh)
May 24 03:00:14 halton-prod-bastion CRON[974]: pam_unix(cron:session): session closed for user daniel
May 24 03:00:01 halton-prod-bastion CRON[974]: (daniel) CMD (/opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1)
May 24 03:00:01 halton-prod-bastion CRON[974]: pam_unix(cron:session): session opened for user daniel(uid=1042) by (uid=0)
`
                },

              },
            },

          },
        },

        "opt": {
          type: "dir",
          children: {

            "halton": {
              type: "dir",
              children: {

                // The script the cron entry runs. Source of the leak:
                // bash \`set -x\` causes every executed line to echo,
                // and `export FOO=bar` is one of those lines. Reading
                // this file shows the player the technical mechanism
                // even without opening the log.
                "snapshot-config.sh": {
                  type: "file",
                  content:
`#!/bin/bash
# Halton weekly prod-config snapshot.
# Daniel set this up Q4 2024. Never rotated.
#
# The set -x line is intentional: Halton's audit policy
# requires a complete trace of every prod-touching job so
# the run can be reconstructed for SOX-ish review. Nobody
# has audited the TRACE FILES themselves for what they
# leak. (That's our finding today.)

set -euxo pipefail

# Passphrase for the snapshot-rsync key, which authenticates
# the rsync to halton-build-runner. ssh-add slurps it from
# the env at call time.
export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'

echo "$SSH_KEY_PASSPHRASE" | ssh-add -p /etc/halton/keys/snapshot-rsync.key

SNAPSHOT_DIR="/tmp/halton-snapshot-$(date +%F)"
mkdir -p "$SNAPSHOT_DIR"

cp -a /etc/halton   "$SNAPSHOT_DIR/etc-halton"
cp -a /etc/systemd  "$SNAPSHOT_DIR/etc-systemd"

rsync -a "$SNAPSHOT_DIR/" daniel@halton-build-runner:/var/backups/halton-prod/

rm -rf "$SNAPSHOT_DIR"
`
                },

                // BONUS-FIND TRIGGER. Halton's password-policy doc
                // mandates the `<Brand>-YYYY-Q#` shape. The bonus
                // text inside critiques the entropy. Reading it is
                // the win condition for the second bonus find.
                "PASSWORD-POLICY.md": {
                  type: "file",
                  content:
`# Halton Bank — Production Credential Naming Standard
# Document HBPC-2022-014 rev 3 (last review: 2024-09-12)
# Owner: Halton Bank Information Security Office (HBISO)
# Distribution: ops, devops, contracted consulting firms

## Purpose

Define a consistent naming pattern for production credentials
so rotation cadence is easy to track during quarterly audits.

## Pattern (mandatory)

All production-tier credentials MUST follow:

    Halton-YYYY-Q#!

where YYYY is the current calendar year and Q# is the current
quarter (Q1, Q2, Q3, Q4). The trailing exclamation point is
required by the policy engine that validates these strings on
intake.

Examples (illustrative; never store actual passwords in this
document):

    Halton-2024-Q3!         (live)
    Halton-2024-Q4!         (live during Q4 2024 only)
    Halton-2025-Q1!         (live during Q1 2025 only)

## Rationale

Predictable naming makes rotation audit-friendly: every
credential's CURRENT value implies its issue date and last
rotation. Auditors can verify rotation cadence in a single
column of a spreadsheet.

The HBISO acknowledges the entropy implication of this
pattern. The trade-off is intentional. The actual control
against guessing is RATE LIMITING + ACCOUNT LOCKOUT, not
password complexity. Rotation cadence is the secondary
control. Password content is the tertiary control.

## Exceptions

Service-account keys, SSH key passphrases, and machine-to-
machine credentials that are NOT rotated quarterly MAY use
a variant pattern:

    Halton-<purpose>-YYYY-Q#

Examples:

    Halton-Snapshot-2024-Q4         (set Q4 2024; rotation
                                     deferred per HBISO-EX-0042;
                                     re-evaluate at next audit)

## Review

This standard is reviewed annually. Next scheduled review:
2025-09-12. (Overdue as of this writing.)

## Notes for consulting partners

When auditing a Halton-issued credential, the pattern above
narrows the credential's possible-value space to roughly 12
strings per year (one per quarter for the live tier, plus
the longer-form purpose-specific variants). This is FYI for
your incident-response runbooks; it is not a finding in
itself.
`
                },

              },
            },

          },
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just chained three failures into a third-hop credential:

  1. An offboarded consultant's account (daniel) was never
     disabled. It still has a login shell and still owns a
     cron entry in /etc/cron.d/.

  2. That cron entry runs a script under bash \`set -x\` and
     redirects the trace to a world-readable log. The trace
     echoes \`export SSH_KEY_PASSPHRASE='...'\` — leaking
     the passphrase to anyone who can read /var/log/.

  3. The passphrase itself follows Halton's institutional
     pattern (Halton-<purpose>-YYYY-Q#) and hasn't been
     rotated since Q4 2024. Anyone who has READ the password
     policy knows the entropy budget — and the rotation
     cadence the policy promised was never executed.

Each failure is mundane. The combination is a credential
hand-off from an audit shell to the next system in the chain.

─── THE BLUNT VERSION ────────────────────────────────────────

CWE-532 (Insertion of Sensitive Information into Log File)
exists because this exact pattern is older than the CWE
catalog itself. Debugging output that helps engineers in the
moment becomes attacker-readable evidence the moment the
session is over. Bash's \`set -x\` is the canonical mechanism
on Unix; the Python equivalent is \`logging.DEBUG\` with
credentials in the args; the Node equivalent is a stray
\`console.log(req.headers)\` left in.

The log file's mode (644 — world-readable) is the second
half of the failure. Even if \`set -x\` were intentional,
the mitigation is "lock down where the trace lands." A 640
log readable only by the \`adm\` group would have made this
finding require a sudo prompt; 600 readable only by root
would have hidden it from this audit account entirely.

The cron-as-daniel piece is CWE-250 (Execution with
Unnecessary Privileges). Daniel left Halton five months ago.
His account on this box should have been disabled the day
his Driftwood badge was deactivated. NIST SP 800-53 PS-4
(Personnel Termination) is the control that should have
fired; AC-2(3) (Disable Accounts) is the related identity-
lifecycle control. Both were missed.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

This finding spans the Halton/Driftwood boundary in a way
that yesterday's finding did not. Yesterday Daniel left
credentials on his Driftwood laptop — that's Driftwood's
side of the MSA to control. Today Daniel's account on
HALTON'S production bastion was never disabled — that's
Halton's side. Both responsibilities are usually in the
offboarding checklist. Both got missed.

In a real engagement this becomes a remediation conversation
across two CISO offices and an external auditor. The clean
way to write it up:

  Finding 1 (Driftwood):   Offboarded consultant's laptop
                           retained client credentials.
                           Owner: Driftwood IT + Engagement
                           Manager (Priya).

  Finding 2 (Halton):      Offboarded consultant's local
                           account on prod-bastion was never
                           disabled and still owns a cron
                           job exfiltrating credentials.
                           Owner: Halton Ops + Halton HRBP.

  Finding 3 (Joint):       Cross-organization offboarding
                           checklist is incomplete on both
                           sides. A consultant's identities
                           need explicit teardown across
                           BOTH organizations' systems.

─── FRAMEWORKS THAT COVER THIS ────────────────────────────────

Three weaknesses, one control principle, one regulator.

  CWE-250   Execution with Unnecessary Privileges — a cron job
            running under a dormant account inherits that uid's
            permissions.
  CWE-521   Weakly Protected Credentials — Halton's password
            pattern is predictable enough to stand alone.
  CWE-532   Insertion of Sensitive Information into Log File —
            the shell trace wrote the passphrase to a 644 log.

  NIST SP 800-53 AU-9 (Protection of Audit Information) is the
  control the log breaches; AC-2(3) is the one the account
  breaches.

  GLBA § 501(b) applies because Halton is a bank, so the rule is
  the Interagency Guidelines (12 CFR Pt. 30 App. B), not the FTC
  Safeguards Rule that covers nonbank institutions. III.C.1.a is
  access control; III.D puts oversight of service providers like
  Driftwood on Halton.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1078.003 — Valid Accounts: Local Accounts
    daniel's account on this box is a valid local account
    surviving past its intended lifecycle. Adversaries
    routinely target dormant-but-active accounts because
    they tend not to alert on misuse the way active
    accounts do.

  T1053.003 — Scheduled Task/Job: Cron
    Cron is named ATT&CK technique for both adversary use
    (persistence) and defender hunt (detection). The
    snapshot job IS the cron technique, repurposed.

  T1552.001 — Unsecured Credentials: Credentials In Files
    The trace log is the file. The credential is the
    passphrase. T1552.001 is one of the most-frequently-
    observed sub-techniques in published incident reports.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Disable daniel's account on this box TODAY. Set
     /sbin/nologin as his shell or delete the account
     outright. Audit every other Halton-managed host for
     the same residue.

  2. Sweep /etc/cron.d/ AND every user crontab for jobs
     owned by accounts not in the current employee/
     contractor directory. Automate this with osquery,
     auditd, or a quarterly cron-vs-IDP cross-reference
     report.

  3. Lock down /var/log/cron-*.log. Default mode for
     cron-written logs should be 640 owned by root:adm at
     minimum. Halton's logrotate config should enforce
     this on rotation.

  4. Remove \`set -x\` from production scripts that touch
     secrets. If verbose tracing is required for audit,
     pipe the trace through a redaction filter that
     suppresses lines matching credential patterns
     (regex on \`export *[A-Z_]*(PASS|KEY|TOKEN|SECRET)\`).

  5. Move the snapshot job to a secrets-backend pattern:
     the script calls Vault / Secrets Manager / Doppler
     to fetch the passphrase, ssh-add reads it from a
     pipe, the value never lives in the env at all.

  6. Fix the institutional pattern: a Halton-YYYY-Q#
     credential is not a real credential. It's a
     compliance-checkbox artifact. The next contractor
     who reads PASSWORD-POLICY.md should be able to
     guess production credentials within a 12-string
     window. That's a finding in its own right and
     belongs in the executive summary.

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. \`set -x\` is documented behaviour, not a bug. So what
     exactly is the defect here?

  2. The production DB password was accepted as an SSH login.
     Which does more damage: that reuse, or the logging?

  3. Who is the affected population for a world-readable log,
     and what makes that hard to answer after the fact?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/linux/level2.html

The walkthrough covers the full NIST, CIS and OWASP mapping,
the certification objectives, how this is sized for a risk
register, the real-world cases, and a Sigma rule that alerts on
reads of job logs by accounts that do not own them.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

Most credential exfiltrations from production systems are
not exotic. They look like this: an account that should
have been disabled six months ago is running a job nobody
is paying attention to, and the job is writing its own
credentials into a log on the way past. The defender's
job is to be the person who checks anyway.

Priya: "Great catch. Three findings from one bastion is
above average. Write it up for the joint Halton + Driftwood
retro — we owe the next track its own set of eyes."

(Speaking of which: Marcus at Atlas Health flagged a cert
he can't explain on a host we didn't sweep last quarter.
Network track when you're ready.)

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

  // ── level3@linux — "Daniel's forgotten sudo" ─────────────────────
  // Gate: H@lton-Snapshot-2024-Q4 (the SSH-key passphrase leaked from
  // level2's cron trace). That passphrase unlocked Daniel's snapshot-
  // rsync key, and that key is exactly what the weekly cron used to
  // reach `daniel@halton-build-runner`. So the player lands HERE, on
  // the build-runner, logged in AS daniel — the offboarded consultant
  // whose account (surprise) was never disabled on this box either.
  //
  // NEW CONCEPT: privilege escalation via a leftover NOPASSWD sudoers
  // grant — the FOURTH distinct offboarding-failure vector in the
  // Daniel arc: laptop creds (l0) -> .env backup (l1) -> cron (l2) ->
  // sudoers (l3).
  //
  // Solve path:
  //   1. `sudo -l` enumerates daniel's grants. One survives from the
  //      2024 migration: (root) NOPASSWD: /usr/bin/cat
  //      /var/backups/halton-prod/*
  //   2. The weekly cron rsync'd prod's /etc/halton into
  //      /var/backups/halton-prod/. The build-runner re-owns delivered
  //      backups to root:root 0600 on ingest, so daniel can't read his
  //      own pushed files back without going through the grant.
  //   3. `ls` the backup tree, find the captured secrets, and
  //      `sudo cat /var/backups/halton-prod/etc-halton/secrets.d/
  //      prod-vault.env` — the VAULT_TOKEN line is the level4 gate.
  //
  // Engine: FIRST level to use `level.sudo` (see the schema note at the
  // top of this file). The functional `sudo` handler is in
  // js/commands/linux.js — `sudo -l` lists the grants; a permitted
  // `sudo cat` under the wildcard reads root-owned files.
  //
  // Lessons: CWE-250 (Execution with Unnecessary Privileges) + CWE-732
  // (Incorrect Permission Assignment — the never-removed grant) +
  // CWE-312 (Cleartext Storage — the snapshot swept live secrets into a
  // backup). NIST 800-53 AC-6 / AC-2(3) + PS-4 (offboarding, AGAIN).
  // MITRE T1548.003 (Abuse Elevation Control Mechanism: Sudo and Sudo
  // Caching) + T1078.003 (Valid Accounts: Local Accounts).
  //
  // Two bonus finds (don't gate the chain):
  //   - "Daniel's account outlived him here too" — /etc/passwd on the
  //     build-runner ALSO still lists daniel with /bin/bash. Systemic,
  //     not a one-box slip.
  //   - "The backup swept up live secrets" — the snapshot captured a
  //     prod DB connection profile (with the reused Halton-2024-Q3!
  //     password) alongside the vault token. Backups are crown jewels.
  //
  // Breadcrumb out: hvs.HALTONr00tPr0dVault2024Q4Kp7mNq — a Halton prod
  // Vault ROOT token captured in the backup, gating the (future)
  // level4@linux.
  "level3@linux": {
    password: "H@lton-Snapshot-2024-Q4",
    track: "linux",
    title: "Daniel's forgotten sudo",
    estimatedMinutes: 12,
    playerUser: "daniel",
    objective: "Escalate from Daniel's offboarded account to root by abusing a NOPASSWD sudoers grant nobody removed after the 2024 migration — and recover the production Vault token the weekly backup should never have contained.",
    lesson: "Still day three. The passphrase from cron-daniel.log unlocked Daniel's snapshot-rsync key, and that key is exactly what the weekly job used to reach halton-build-runner — so here you are, logged in AS daniel, on yet another Halton box where his account was never disabled. welcome.md covers the one new command: `sudo -l`. Daniel kept a NOPASSWD grant here from the migration. Enumerate it, then use it to read a backup that swept up secrets it was never supposed to hold.",
    hints: [
      "You're logged in as an offboarded account. The first question on any box you land on is 'what is this account still allowed to do as root?' — run `sudo -l`.",
      "The grant lets you run `cat` as root over anything under /var/backups/halton-prod/. The weekly snapshot rsync'd Halton's /etc/halton into there. `ls` around that tree and find where the captured secrets landed (there's a secrets.d/ directory).",
      "Plain `cat` on the captured secret is Permission denied — it's root-owned. Put sudo in front: `sudo cat /var/backups/halton-prod/etc-halton/secrets.d/prod-vault.env`. The VAULT_TOKEN line is your level4 credential.",
    ],
    permissions: {
      "welcome.md":         { mode: "-rw-r--r--", owner: "daniel", group: "daniel", size: 2712 },
      "lessons-learned.md": { mode: "-rw-r--r--", owner: "daniel", group: "daniel", size: 6480 },
      ".bash_history":      { mode: "-rw-------", owner: "daniel", group: "daniel", size:  184 },
      "etc":                { mode: "drwxr-xr-x", owner: "root",   group: "root",  size: 4096 },
      "var":                { mode: "drwxr-xr-x", owner: "root",   group: "root",  size: 4096 },
      // The rsync'd snapshot dirs are re-owned to root:root on ingest so
      // the pushing account can't tamper with delivered backups — which
      // is ALSO why daniel can't read them back without the sudo grant.
      "backups":            { mode: "drwxr-x---", owner: "root",   group: "root",  size: 4096 },
      "halton-prod":        { mode: "drwxr-x---", owner: "root",   group: "root",  size: 4096 },
      "etc-halton":         { mode: "drwxr-x---", owner: "root",   group: "root",  size: 4096 },
      "etc-systemd":        { mode: "drwxr-x---", owner: "root",   group: "root",  size: 4096 },
      "secrets.d":          { mode: "drwx------", owner: "root",   group: "root",  size: 4096 },
      "db":                 { mode: "drwx------", owner: "root",   group: "root",  size: 4096 },
      "halton.conf":        { mode: "-rw-r--r--", owner: "root",   group: "root",  size:  512 },
      // The captured secrets — root-owned, mode 0600. Plain `cat` is
      // denied to daniel; the permitted `sudo cat` reads them as root.
      "prod-vault.env":     { mode: "-rw-------", owner: "root",   group: "root",  size:  486 },
      "connections.yaml":   { mode: "-rw-------", owner: "root",   group: "root",  size:  612 },
      // The grant's own sudoers file — root:root 0440, unreadable to
      // daniel AND outside his cat grant, so `sudo cat` on it is denied
      // too. You enumerate the grant with `sudo -l`, not by reading it.
      "halton-daniel-snapshot": { mode: "-r--r-----", owner: "root", group: "root", size: 214 },
      "passwd":             { mode: "-rw-r--r--", owner: "root",   group: "root",  size:  704 },
    },

    env_vars: {
      EDITOR:      "nano",
      AWS_PROFILE: "halton-prod",
      HOSTNAME:    "halton-build-runner.driftwood.internal",
    },

    // FIRST level to use level.sudo. Daniel's leftover NOPASSWD grant:
    // a wildcard `cat` over the backup dir, installed for the 2024
    // migration so his snapshot cron could spot-check delivered
    // backups, never removed when he rolled off. `sudo -l` lists it;
    // `sudo cat` under the wildcard reads root-owned files. See the
    // schema note at the top of this file + js/commands/linux.js.
    sudo: {
      host: "halton-build-runner",
      entries: [
        { runAs: "root", nopasswd: true, commands: ["/usr/bin/cat /var/backups/halton-prod/*"] },
      ],
    },

    bonusFinds: [
      {
        id:   "daniel-outlived-again",
        name: "Daniel's account outlived him here too",
        hint: "It wasn't just the prod-bastion. Daniel's local account survived on the build-runner as well — /bin/bash and all. One missed offboarding is an incident; the same miss on a second box is a systemic identity-lifecycle failure (NIST PS-4 / AC-2(3)).",
        // Fires on `cat /etc/passwd` or `grep daniel /etc/passwd`.
        trigger: { argMatches: /passwd/, outputContains: "daniel:x:1042" },
      },
      {
        id:   "backup-swept-secrets",
        name: "The backup swept up live secrets",
        hint: "A backup of a config directory should never contain live production credentials. This one carried the prod DB connection profile — password and all (the same unrotated Halton-2024-Q3! string) — into a directory a low-privilege account could reach with one leftover grant. CWE-312. Backups are crown jewels; scope, encrypt, and access-control them accordingly.",
        // Fires on `sudo cat .../db/connections.yaml`.
        trigger: { command: "sudo", argMatches: /connections\.yaml/, outputContains: "Halton-2024-Q3!" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Halton Bank — Build-Runner Pivot ──────
  Host:    halton-build-runner.driftwood.internal
  Acct:    daniel (offboarded consultant — see below)
  Date:    Thursday 2026-05-28 (engagement day three, still)
────────────────────────────────────────────────────────────

Priya: "That passphrase you pulled out of the cron trace —
H@lton-Snapshot-2024-Q4 — wasn't a login password. It was the
passphrase on Daniel's snapshot-rsync SSH KEY. We loaded the
key with it and rode Daniel's own weekly-backup path onto the
build-runner. You're logged in AS daniel now. Yes: his account
was never disabled HERE either. Same offboarding miss, second
box. Prove what that account can still do — and whether the
backups it's been shipping for months are as harmless as
Halton thinks."

Your in-world identity is \`daniel\` (uid 1042, primary group
\`daniel\`). Run \`id\` and \`whoami\` to confirm. You are NOT
root — but Daniel's account may have been left able to become
root for specific commands. That's today's whole finding.

─── A NOTE ABOUT THE LAYOUT ───────────────────────────────────

Same audit-chroot shell as the bastion: the home dir and the
read-only system root point at the same node, so \`ls ~\` shows
the briefing docs (welcome.md, lessons-learned.md) next to the
system paths — \`etc/\`, \`var/\`. Intentional, not a bug.

  ls  /var/backups/halton-prod/     the delivered snapshots
  cat /etc/passwd                   the account list

─── NEW COMMAND YOU'LL USE TODAY ──────────────────────────────

  sudo -l    List what the CURRENT account is allowed to run
             via sudo — and, critically, whether any of it is
             NOPASSWD (no password prompt). This is the single
             command the finding needs. You almost never get to
             read /etc/sudoers directly (it's root-only), so
             \`sudo -l\` is how you enumerate your own grants.

─── WHAT SUDO IS, AND WHY 'sudo -l' MATTERS ───────────────────

\`sudo\` runs a command as another user — root by default —
IF the sudoers policy permits it. The policy lives in
/etc/sudoers and /etc/sudoers.d/. A single line grants a user
(or group) the right to run specific commands as a target
user:

    daniel  ALL=(root) NOPASSWD: /usr/bin/cat /var/backups/*

Read that as: "daniel may run \`/usr/bin/cat\` on anything under
/var/backups as root, without being asked for a password."

Two things make a grant like that dangerous:

  1. NOPASSWD means an attacker who lands on the account needs
     no secret at all to use it.
  2. The WILDCARD. \`cat /var/backups/*\` sounds narrow, but
     \`*\` reaches into every subdirectory. If anything
     sensitive was ever written under that path — say, a
     backup that scooped up a secrets file — the grant reads
     it as root. Least privilege (NIST AC-6) means granting
     the narrowest command on the narrowest path; a wildcard
     over a backup tree is the opposite.

Grants like this are supposed to be temporary. When the person
they were written for leaves, the line is supposed to leave
with them. Daniel's didn't.

─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat welcome.md                 You're already here.
  2.  id                             Confirm you're daniel, not root.
  3.  sudo -l                        What can this account run as root?
  4.  ls /var/backups/halton-prod/   Walk the delivered snapshot tree.
                                     The weekly cron rsync'd /etc/halton
                                     in here — find where secrets landed.
  5.  sudo cat /var/backups/halton-prod/etc-halton/secrets.d/prod-vault.env
                                     Plain \`cat\` is Permission denied
                                     (root-owned). \`sudo cat\` reads it.
                                     The VAULT_TOKEN line is your
                                     level4 credential.
  6.  cat lessons-learned.md         Post-mortem (after step 5).
  7.  exit                            Return to the lobby.

Bonus exploration when you're done:

  - \`cat /etc/passwd\` (or \`grep daniel /etc/passwd\`)
  - \`sudo cat /var/backups/halton-prod/etc-halton/db/connections.yaml\`
`
        },

        ".bash_history": {
          type: "file",
          content:
`id
sudo -l
ls -la /var/backups/halton-prod/
sudo cat /var/backups/halton-prod/etc-halton/halton.conf
ssh-add -l
exit
`
        },

        // The system tree. Engine treats fs root as the home dir, so
        // these also appear as ~ siblings of welcome.md (audit-chroot).
        "etc": {
          type: "dir",
          children: {

            // /etc/passwd — bonus trigger. daniel STILL has a login
            // shell on the build-runner, same as on the bastion. The
            // GECOS comment records the rollover date; that's the find.
            "passwd": {
              type: "file",
              content:
`root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
sshd:x:113:65534::/run/sshd:/usr/sbin/nologin
buildbot:x:1050:1050:Halton CI build agent:/var/lib/buildbot:/bin/bash
daniel:x:1042:1042:Daniel Vance (rolled off Halton 2025-01-31):/home/daniel:/bin/bash
`
            },

            // /etc/sudoers.d/ — the grant lives here. root:root 0440,
            // so daniel can't read it directly, and it's outside his
            // cat grant so `sudo cat` on it is denied too. `sudo -l`
            // is the intended enumeration path. Present so `ls
            // /etc/sudoers.d/` shows the file exists (realism).
            "sudoers.d": {
              type: "dir",
              children: {
                "halton-daniel-snapshot": {
                  type: "file",
                  content:
`# TEMP — 2024 us-east migration. Lets daniel's snapshot cron
# spot-check delivered backups on the runner. REMOVE after Q4
# 2024 cutover.  -- installed by vikram.shah 2024-10-13
daniel  halton-build-runner=(root) NOPASSWD: /usr/bin/cat /var/backups/halton-prod/*
`
                },
              },
            },

          },
        },

        "var": {
          type: "dir",
          children: {

            "backups": {
              type: "dir",
              children: {

                "halton-prod": {
                  type: "dir",
                  children: {

                    // The rsync'd snapshot of prod's /etc/halton. This
                    // is where the weekly cron (level2) delivered its
                    // payload — and where a config backup quietly
                    // scooped up live production secrets.
                    "etc-halton": {
                      type: "dir",
                      children: {

                        // Harmless config — root:root but world-readable
                        // (0644), so daniel CAN read it without sudo.
                        // The contrast with the 0600 secrets is the point.
                        "halton.conf": {
                          type: "file",
                          content:
`# Halton prod platform config (non-secret)
# Captured in weekly snapshot from halton-prod-bastion:/etc/halton
environment   = production
region        = us-east-2
audit_retention_days = 2555
snapshot_target = halton-build-runner:/var/backups/halton-prod/
# Secrets are kept in secrets.d/ and db/ (should NOT be here).
`
                        },

                        // BREADCRUMB. Root-owned 0600 — Permission
                        // denied to plain cat, readable via `sudo cat`.
                        // The VAULT_TOKEN is the level4@linux gate.
                        "secrets.d": {
                          type: "dir",
                          children: {
                            "prod-vault.env": {
                              type: "file",
                              content:
`# Halton production Vault agent environment
# /etc/halton/secrets.d/prod-vault.env
# DO NOT BACK UP. DO NOT COMMIT. (both happened anyway.)
VAULT_ADDR=https://vault.halton.internal:8200
VAULT_NAMESPACE=halton-prod
# ROOT token, issued for the 2024-Q4 migration. Ticket
# HBISO-EX-0042 said "rotate before Q1 2025." Never rotated.
VAULT_TOKEN=hvs.HALTONr00tPr0dVault2024Q4Kp7mNq
`
                            },
                          },
                        },

                        // BONUS #2. Another live secret the config
                        // backup swept up — the prod DB profile, with
                        // the reused Halton-2024-Q3! password. Root 0600.
                        "db": {
                          type: "dir",
                          children: {
                            "connections.yaml": {
                              type: "file",
                              content:
`# Halton prod DB connection profiles
# Captured in the weekly /etc/halton snapshot (it should not
# have been — this file holds live credentials).
production:
  host: halton-prod-db.halton.internal
  port: 5432
  database: halton_core
  user: halton_app
  password: Halton-2024-Q3!    # still unrotated; same string as the bastion login
reporting:
  host: halton-prod-db.halton.internal
  port: 5432
  database: halton_reporting
  user: halton_ro
  password: Halton-2024-Q3!    # reuse, again
`
                            },
                          },
                        },

                      },
                    },

                    // Atmospheric — the other half of the snapshot
                    // (/etc/systemd), so the backup tree looks real.
                    "etc-systemd": {
                      type: "dir",
                      children: {
                        "system": {
                          type: "dir",
                          children: {
                            "halton-metrics.timer": {
                              type: "file",
                              content:
`[Unit]
Description=Halton prod metrics push (captured in snapshot)

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
`
                            },
                          },
                        },
                      },
                    },

                  },
                },

              },
            },

          },
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You escalated from an offboarded consultant's account to a
root-level read with a single leftover sudoers line, and used
it to lift a production Vault ROOT token out of a backup that
should never have contained one:

  1. Daniel's account was never disabled on the build-runner —
     the same offboarding miss you already found on the
     prod-bastion, repeated on a second box. You logged in as
     him using his own snapshot-rsync key.

  2. Daniel still held a NOPASSWD sudoers grant here, written
     for the 2024 migration and flagged "REMOVE after Q4 2024
     cutover." It was never removed. \`sudo -l\` handed it to
     you: (root) NOPASSWD: /usr/bin/cat /var/backups/halton-prod/*

  3. The grant's wildcard reached into a backup the weekly
     cron had been delivering for months — a backup that
     quietly scooped up /etc/halton's live secrets. \`sudo cat\`
     read the prod Vault root token straight out of it.

Each failure is mundane. Chained, they turn a dormant account
into root-equivalent access to production's master secret.

─── THE BLUNT VERSION ────────────────────────────────────────

CWE-250 (Execution with Unnecessary Privileges) is the sudoers
line itself: an account that should have zero privileges was
left able to run a command as root. CWE-732 (Incorrect
Permission Assignment for Critical Resource) is why it still
exists — the grant was never revoked, and its wildcard scope
was never narrowed. CWE-312 (Cleartext Storage of Sensitive
Information) is the backup: production secrets sitting in
plaintext in a config snapshot, reachable by a low-privilege
account.

The wildcard is the part people underestimate. "cat one
backup directory" feels harmless until you notice the backup
contains a secrets.d/ folder. \`sudo cat /var/backups/*\` is
\`sudo cat ANYTHING that ever lands under /var/backups\`, for
as long as the line exists. Least privilege means the
narrowest command on the narrowest path — never a wildcard
over a directory whose contents you don't control.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

This is the third box on which Daniel's identity outlived his
engagement, and the failure has now graduated from "dormant
account" to "dormant account with root-equivalent reach." The
write-up:

  Finding 1 (Halton):   Offboarded consultant's local account
                        active on a SECOND production host.
                        Pattern, not incident. Owner: Halton
                        Ops + HRBP.

  Finding 2 (Halton):   NOPASSWD sudoers grant, self-labeled
                        temporary, never removed 18 months
                        after its stated expiry. Owner: Halton
                        Ops (whoever owns sudoers policy).

  Finding 3 (Halton):   Production secrets present in
                        cleartext inside routine config
                        backups. Owner: Halton platform +
                        whoever owns the backup pipeline.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

Three weaknesses, one control principle, one regulator.

  CWE-250   Execution with Unnecessary Privileges — the grant
            let a dormant account act as root.
  CWE-732   Incorrect Permission Assignment — it was never
            revoked, and its wildcard was never scoped.
  CWE-312   Cleartext Storage of Sensitive Information — live
            secrets sat in plaintext inside a config backup.

  NIST SP 800-53 AC-6 (Least Privilege) is the control this
  finding is really about. A wildcard NOPASSWD grant is the
  textbook violation of it.

  GLBA § 501(b) applies because Halton is a bank — which means
  the Interagency Guidelines (12 CFR Pt. 30 App. B), NOT the
  FTC Safeguards Rule that covers nonbank institutions. III.C.1.a
  requires access controls on customer-information systems;
  III.D puts oversight of service providers like Driftwood on
  Halton. If this becomes a notification incident, the bank has
  36 hours to tell its primary federal regulator.

The walkthrough works through the full control mapping,
the certification-exam angles, and the real-world cases.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1548.003 — Abuse Elevation Control Mechanism: Sudo and Sudo
    Caching. The NOPASSWD grant is exactly this technique:
    adversaries enumerate sudo rights and abuse permissive
    entries to run commands as root.

  T1078.003 — Valid Accounts: Local Accounts
    daniel's surviving local account is the foothold.

  T1552.001 — Unsecured Credentials: Credentials In Files
    The Vault token (and the DB password) sat in files inside
    the backup.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Remove the grant. \`visudo\` the line out of
     /etc/sudoers.d/halton-daniel-snapshot TODAY, and disable
     daniel's account on this host and every other one.

  2. Audit ALL sudoers entries for NOPASSWD and wildcards.
     A quarterly \`sudo -l\` sweep (or a config-management
     assertion) across the fleet, cross-referenced against the
     current identity directory, catches leftover grants.

  3. Rotate the exposed Vault token immediately and treat it as
     compromised. It was root-scoped and in a backup for months.

  4. Get secrets OUT of config backups. Exclude secrets.d/ and
     db/ from the snapshot, or pull them from Vault at runtime
     so they never sit on disk in a backup at all.

  5. Encrypt backups at rest and access-control the backup
     directory so a single wildcard grant can't turn it into a
     secrets buffet.

  6. Prefer short-lived, auditable privilege: sudo grants
     scoped to exact commands, logged centrally, with no
     NOPASSWD on anything that touches sensitive data.

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. \`sudo -l\` showed a grant ending in \`*\`. Why is that
     wildcard the finding, rather than the \`cat\` it permits?

  2. Halton rotates the Vault token this afternoon. Which of
     the three failures does that fix, and which two survive?

  3. The account belonged to a consultant who left a year ago.
     Whose control failed — Driftwood's or Halton's?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/linux/level3.html

The walkthrough covers what this debrief deliberately doesn't:
the full NIST / CIS / OWASP mapping, the certification
objectives, how the finding is sized for a risk register, a
Sigma rule that alerts on privileged reads of the backup tree,
and why a sudo grant scoped by path glob is a standing bet.
Answers to the three questions above are in there.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

Privilege escalation on real systems rarely needs an exploit.
It needs a grant somebody wrote for a good reason, for a person
who left, that nobody ever removed — pointed at a directory
that quietly accumulated things it shouldn't hold. The
defender's job is to be the person who runs \`sudo -l\` on the
dormant account before an attacker does.

Priya: "Root-equivalent reach on a production secret store,
from a consultant who left a year ago. That's the executive-
summary finding. Rotate that Vault token before you do anything
else — I'll start the Halton call."

(That token opens more than a build-runner. We'll want fresh
eyes on what it can actually do when you're ready.)

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
