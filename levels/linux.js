// Linux track levels.
//
// Each level is a fs-tree-backed scenario. The minimum required keys:
// track, objective, lesson, fs. `password` is the password REQUIRED to
// ssh into this level (set by the PREVIOUS level's content); leave null
// for the entry level.
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

};
