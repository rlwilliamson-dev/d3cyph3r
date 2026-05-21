// Linux track levels.
//
// Each level is a fs-tree-backed scenario. The minimum required keys:
// track, objective, lesson, fs. `password` is the password REQUIRED to
// ssh into this level (set by the PREVIOUS level's content); leave null
// for the entry level.
//
// Optional: `playerUser` (and `playerGroup`, defaulting to `playerUser`)
// override the in-world identity the player sees inside the box. The
// level key (e.g. `level1@linux`) is engine bookkeeping for the SSH-hop
// metaphor; `playerUser` is what `whoami`, the prompt, `pwd`, `find`,
// and `ls -la` owner columns show. Without this override the engine
// falls back to the level key's user prefix.
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
    objective: "Audit Daniel's laptop and find the client credential he left behind before IT reimages the box on Wednesday.",
    lesson: "Day one at Driftwood. A senior consultant whose engagement at Halton Bank ended Friday left his work laptop with IT for reimaging. His client access was revoked over the weekend, but the laptop hasn't been wiped yet, and his home directory hasn't been audited. Sweep it before Wednesday. Anything that looks like a client credential, you flag. Read every file. Then read lessons-learned.md.",
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
exit
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`# Post-mortem: what you just found, and why it matters

You just found cleartext credentials for a CLIENT environment sitting
on an offboarded consultant's laptop. In a real engagement, this single
file could be the entire breach — and "we exposed the client" is the
worst kind of breach for a consulting firm.

## The consulting-firm angle

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

## The blunt version

Stolen credentials are, every year, the leading way attackers get
into networks. Verizon's 2024 Data Breach Investigations Report put
"use of stolen credentials" at 31% of breaches studied, even after
excluding human-error cases. Insider incidents — including former
employees and contractors — account for roughly one in five of all
confirmed breaches.

When the insider is a consultant, the blast radius expands: not
just YOUR data, but every client whose environment they had access
to.

## Frameworks that cover this

  NIST SP 800-53 Rev. 5 — AC-2 (Account Management)
    Specifically AC-2(13): privileged accounts must be terminated
    "immediately" on separation. The control violated whenever a
    consultant's client access isn't fully revoked at engagement
    end.

  CIS Critical Security Controls v8 — Control 5 (Account Management)
    5.3: disable dormant accounts. 5.4: restrict administrator
    privileges. Both apply here.

  CWE-798: Use of Hard-coded Credentials
    The specific weakness committed when Daniel wrote the client's
    password into a flat file instead of a secrets manager. One of
    the longest-standing entries in the CWE catalog.

  OWASP Top 10 (2021) — A07: Identification and Authentication Failures
    The umbrella category for the broader weakness class.

  GLBA Safeguards Rule (16 CFR Part 314)
    For financial-services clients like Halton, mandates "service
    provider oversight." Consulting firms are explicitly covered.
    Section 314.4(f) puts the burden on the financial institution
    to ensure their service providers safeguard customer data —
    which puts the burden on Driftwood to deserve that trust.

  PCI-DSS v4.0 — Requirement 12.8
    Covers third-party / consultant obligations when payment-card
    data is in scope. Halton is a bank; payment data is always in
    scope somewhere.

## Where this shows up on certifications

  CompTIA Security+ (SY0-701)
    Domain 4.1 (Apply common security techniques) — secrets
    management. Domain 5.3 (third-party risk management) — directly
    relevant to consulting-firm security models.

  (ISC)² Certified in Cybersecurity (CC)
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

## MITRE ATT&CK mapping

What you simulated maps to:

  T1083    — File and Directory Discovery
  T1552.001 — Unsecured Credentials: Credentials In Files

These two techniques together account for an enormous share of
real-world post-compromise activity. T1552.001 in particular shows
up in nearly every credible threat report.

## What a defender should actually do about this

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

## Closing thought

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
    playerUser: "app_admin",
    objective: "Find the production database credential a misconfigured backup is leaking — and document the blast radius before Priya rotates it.",
    lesson: "Day two. You used the credential from Daniel's creds.txt to ssh into Halton Bank's jumphost — and Halton's ops team left the staging service account with a login shell. You're now logged in as app_admin, sitting on a client production bastion. A real attacker who pulled the same trick would be exactly here. Walk the home directory and find the production credential a careless backup has left exposed. Read welcome.md first; it explains the new permission columns you'll use today. Then lessons-learned.md once you've found it.",
    permissions: {
      "welcome.md":             { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 1842 },
      "handoff.md":             { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 1956 },
      "backup.sh":              { mode: "-rwxr-xr-x", owner: "app_admin", group: "app_admin", size:  612 },
      ".bash_history":          { mode: "-rw-------", owner: "app_admin", group: "app_admin", size:  524 },
      "staging-worker.env":     { mode: "-rw-------", owner: "root",      group: "root",      size:  287 },
      "staging-worker.env.bak": { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size:  342 },
      "lessons-learned.md":     { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 4521 },
    },
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
`# Post-mortem: what you just found, and why it matters

You just found a production database credential exposed by a careless
backup. The credential itself lives in a properly protected file
(mode 600, root-owned). A debugging copy of that file — at standard
default mode 644, owned by a service account anyone with the leaked
staging creds can log in as — leaks the same secret to anyone on the
box.

The lock on the front door doesn't matter if there's a key under the
mat. Daniel locked the front door. Then he taped a copy of the key
to the wall and left.

## The blunt version

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

## The consulting-firm angle

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

## Frameworks that cover this

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

  CIS Critical Security Controls v8
    3.3 (Configure Data Access Control Lists): the canonical
      defender play against this anti-pattern.
    4.7 (Restrict access to administrative interfaces): related,
      since the jumphost shouldn't have been giving service
      accounts an interactive shell in the first place.

  OWASP Top 10 (2021) — A05: Security Misconfiguration
    The umbrella category. "Improperly configured permissions on
    cloud services / files / directories" is one of the named
    examples.

  GLBA Safeguards Rule (16 CFR Part 314)
    For Halton specifically. Safeguards Rule 314.4(c)(1) requires
    "appropriate access controls" on customer-information systems.
    This is a textbook failure to meet that standard.

## Where this shows up on certifications

  CompTIA Security+ (SY0-701)
    Domain 3.1 (Security architecture: hardening) — file system
    permissions and least privilege are tested directly.

  (ISC)² CC / SSCP
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

## MITRE ATT&CK mapping

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

## What a defender should actually do about this

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

## Closing thought

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
