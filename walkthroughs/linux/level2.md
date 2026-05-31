# level2@linux — Daniel's Forgotten Cron

**Track:** Linux · **Client:** Halton Bank (continued) · **Compliance regime:** GLBA Safeguards Rule

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level3@linux`. If you haven't solved `level2@linux` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough also assumes you've worked through `level0@linux` and `level1@linux`; this level continues their narrative directly.

---

## §1 — The setup

Day three at Driftwood Systems. Yesterday you used Daniel's leaked staging-DB credential to reach Halton Bank's staging jumphost, and inside `staging-worker.env.bak` you recovered `Halton-2024-Q3!` — the production database password. Halton's CISO took the finding well. Well enough that he pulled three more production-side service accounts under the Driftwood audit scope and asked Priya to escalate. The first of those three is `halton-prod-bastion.driftwood.internal`.

The shell prompt now reads `audit@halton-prod-bastion`. You're logged in as `audit`, Driftwood's internal-audit role on Halton-side hosts, sitting on the production bastion that fronts Halton's internal-banking network. You got here using the same string you found yesterday: `Halton-2024-Q3!`. The same string Daniel wrote into `DB_PROD_PASS` in his shadow-copy env file.

That cross-use is the first finding before you've run a single command, and Halton volunteered it as the briefing was being scoped. Halton's HBISO (Information Security Office) maintains a public-internal credential-naming standard — document HBPC-2022-014 rev 3 — that mandates *every* production-tier credential follows the pattern `Halton-YYYY-Q#!`. The standard does not require that distinct systems use distinct values. The standard does not promise that the string is reliably rotated. The standard delivers exactly one thing: predictability for auditors checking rotation in a spreadsheet. The trade-off was made knowingly; it is documented in §Rationale of the policy itself. You'll re-encounter that document later in this walkthrough as the second bonus find.

For now, internalize the implication: when Daniel wrote `Halton-2024-Q3!` into a backup env file in November of the year prior, he also wrote the production *bastion's SSH login password* into that file — because the bastion login uses the same string Halton's DB policy mandates. The credential you carry forward today wears two hats. It is database password and shell password simultaneously. That's CWE-521 (Weak Password Requirements) and CWE-262 (Not Using Password Aging) layered on the original CWE-732 / CWE-200 stack from yesterday, and it's why a leak on the staging side traverses cleanly into a shell on the production side. Walkthroughs of secure-credential design routinely include the phrase "same string different system" as an antipattern; this is what it looks like in the wild.

Three failures, from yesterday plus this morning, put you at an `audit@halton-prod-bastion` prompt:

1. **Yesterday's CWE-732 shadow copy** (Daniel's `staging-worker.env.bak` at mode 644) — covered in level1.
2. **Halton's CWE-521 / CWE-262 password policy** — `Halton-YYYY-Q#!` provides ~12 possible strings per year, with the same string permitted across unrelated systems. The credential surface of every Halton-managed host collapses to whichever quarter's value happens to be live.
3. **Halton's bastion-login configuration** — accepting password authentication on a production bastion (instead of requiring SSH key + MFA) is itself a CIS Critical Security Controls v8.1 control 6.3 gap. Combined with the credential-reuse policy, password auth on the bastion turns one leaked env file into shell access on any host inside Halton's network whose login the policy covers.

That's the threat model of *getting* to this prompt. The lesson of this level is about what's running *on* the prompt.

Priya, briefing you in chat as you SSH'd in: *"Halton's CISO loved yesterday's staging finding — they pulled three more service accounts under our audit scope. This box is one of them. Walk the cron infrastructure. We already think we know what it leaks; we want you to find it the same way an attacker would so the report holds up in front of their board."* That's your scope. Find what cron is exfiltrating on this bastion.

Cross-track foreshadowing: Marcus Kovacs at Atlas Health flagged a cert he can't explain on a host Driftwood didn't sweep last quarter — that engagement opens after this one closes (and connects to `level2@network`). The Polaris Reed Connolly forensics case is at IR-team triage on a separate bench (`level2@forensics`). The lobby's structure where you can walk these tracks in any order is real; the *narrative* is also real — they're a shared Driftwood book of business, in chronological flow.

## §2 — The solve

Six commands. The Linux discipline is in reading the cron entry slowly — `who owns the job`, `where does its output go`, `is the destination a file the player can read` — before you run the command that prints the credential.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level2@linux
level2@linux's password: Halton-2024-Q3!
```

The password is the `DB_PROD_PASS` value you recovered from `staging-worker.env.bak` yesterday. Halton's password-reuse policy makes the same string the bastion login. The connection banner identifies the host (`halton-prod-bastion.driftwood.internal`) and the tier (Routine, ~12 min). Read `welcome.md` first — it sets up the audit-chroot layout (your home directory and the read-only system root point at the same node, which is why `ls ~` shows both briefing docs *and* system paths like `etc/`, `var/`, `opt/` as siblings).

```bash
audit@halton-prod-bastion:~$ cat welcome.md
```

`welcome.md` documents the engagement (Halton CISO scope, audit-user identity, the chroot framing), introduces the new commands you'll need today (`crontab -l -u <user>`, `journalctl -u <unit>`, `cat /etc/cron.d/*`), and orients you toward the puzzle without revealing the breadcrumb. It also documents the convention that `cat /etc/cron.d/halton-weekly-snapshot` works the same here as it would on any Linux box — the unusual `ls ~` output is a sandboxing artifact, not a path-resolution oddity.

### Step 2: Enumerate the system-wide cron entries

```bash
audit@halton-prod-bastion:~$ ls /etc/cron.d/
halton-weekly-snapshot
```

One file. On a typical production-bastion you'd expect a few — package-shipped cron entries (logrotate's, anacron's, the distribution's daily maintenance), plus whatever the operations team has dropped in over time. Halton's prod-bastion has exactly one *custom* entry. That's the file you came to inspect.

Two background facts worth absorbing here. First, `/etc/cron.d/` is *one of* the system-wide cron locations on a Debian-family Linux box. The others are `/etc/crontab` (the legacy system crontab), `/etc/cron.{hourly,daily,weekly,monthly}/` (run-parts directories that fire on the named schedule), and `/var/spool/cron/` (per-user crontabs, managed via `crontab -e`). `/etc/cron.d/` is favored by package maintainers and ops engineers for jobs that need explicit time-of-day scheduling and want to run as a specific user — because the `/etc/cron.d/` format adds a sixth column between the schedule and the command: the username to run the job as. Per-user crontabs in `/var/spool/cron/` don't have that column because they're implicitly run as their owning user. `/etc/cron.d/` is the only place outside of root's own crontab where you can schedule a job to run *as someone else*. That's the property of `/etc/cron.d/` that matters for this finding.

Second: the modern Linux scheduling primitive is *systemd timers*, not cron — systemd unit timers replace `/etc/cron.d/` entries in distributions that have fully transitioned to systemd-everything. Halton's bastion runs Debian-style cron because Daniel set this up in 2024 and didn't migrate. That's not a finding in itself, but it does mean `systemctl list-timers` won't show you this job — you have to enumerate `/etc/cron.d/` directly.

### Step 3: Read the cron entry

```bash
audit@halton-prod-bastion:~$ cat /etc/cron.d/halton-weekly-snapshot
# Halton Bank — weekly prod-config snapshot
# Owner: daniel (originally; he set this up Q4 2024 before
#                rolling off and nobody's touched it since)
# Installed: 2024-10-13 (per package manifest)
# Purpose: ship a copy of /etc/halton + /etc/systemd to the
#          off-bastion build runner for quarterly audit
#          comparison
#
# Output is captured for retention per Halton's audit-trail
# policy. The script uses bash `set -x` so the run is fully
# inspectable in /var/log/cron-daniel.log.

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
MAILTO=""

# m h dom mon dow user    command
0 3 * * 0     daniel  /opt/halton/snapshot-config.sh >> /var/log/cron-daniel.log 2>&1
```

Three independently-bad facts.

**Fact one: the job runs as `daniel`.** Daniel is the consultant whose laptop you audited in level0. He rolled off Halton's engagement five months ago. The comment block on the cron file documents the install date (Q4 2024) and notes that "nobody's touched it since" — including the offboarding-checklist step that should have disabled his account on this box. That's NIST SP 800-53 Rev. 5 control PS-4 (Personnel Termination), missed. The cron entry only fires because daniel's local account on `halton-prod-bastion` still exists with a working login shell. (Confirm this with the first bonus find later; for now, hold the hypothesis.)

**Fact two: the redirect target is a single, world-readable log file.** `>> /var/log/cron-daniel.log 2>&1` appends both stdout and stderr to a file under `/var/log/`. The default mode of a file cron creates on first write is 644 — owner-readable-writable, group-and-world readable. There's no logrotate config restricting access; there's no daemon (like rsyslog) interposing on the path; there's just a plain file. Anyone with shell access on this box can `cat` it.

**Fact three: the script the cron runs uses `set -x`.** This is the part you don't know yet, because you haven't read the script — but the cron-file header comment block tells you. The audit-trail rationale ("output captured for retention per Halton's audit-trail policy") is the reason `set -x` was *added*. Whoever decided that knew bash trace mode echoes every executed command line to stderr, and chose to use it deliberately. The choice produces the log file Halton's audit policy wants. It also produces a log file that contains every `export FOO=...` line in the script. If the script exports a credential, the trace puts the credential in the log.

Before reading the log, let's confirm the third fact:

```bash
audit@halton-prod-bastion:~$ cat /opt/halton/snapshot-config.sh
#!/bin/bash
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
```

`set -euxo pipefail` — the `x` is the trace flag. Every executed command is echoed to stderr (or, here, to the redirected log). Including the `export SSH_KEY_PASSPHRASE='...'` line. The script's comment block explicitly acknowledges the trace mode is intentional for audit retention, and explicitly notes that *nobody has audited the trace files themselves for what they leak*. That sentence is the finding, written by the engineer who built the bug. (Daniel's signature self-aware-but-undocumented anti-pattern, from level0 and level1, continues.)

The breadcrumb credential `H@lton-Snapshot-2024-Q4` is now visible to you. You've technically solved the level. But the puzzle's *audit* requires you to also observe what an attacker would see in the log file — because the executive summary needs to read *"the credential leaked weekly into a 644-mode log going back six months,"* not *"the credential was hardcoded in a script."* Both are true; the log is the worse finding, because the attacker doesn't need read access to `/opt/halton/snapshot-config.sh` to extract it.

### Step 4: Read the log

```bash
audit@halton-prod-bastion:~$ cat /var/log/cron-daniel.log
=== Sun Apr 19 03:00:01 UTC 2026 ===
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
...
```

Six weeks of weekly runs, each preserving the same `+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'` trace line. (The log actually goes back further than that, but logrotate truncates older history; the most recent six weeks are what survives in the current file.) The credential is shown explicitly *every* Sunday at 03:00:01 UTC — and every one of those events was a free copy for anyone with shell access on this box.

If you want just the leaking line without the surrounding noise:

```bash
audit@halton-prod-bastion:~$ grep SSH_KEY_PASSPHRASE /var/log/cron-daniel.log
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
+ export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'
```

Six identical lines — same passphrase, six weeks in a row. The breadcrumb credential for `level3@linux` is `H@lton-Snapshot-2024-Q4`. Hold it; you'll use it after the next level ships.

### Step 5: Read the post-mortem

```bash
audit@halton-prod-bastion:~$ cat lessons-learned.md
```

`lessons-learned.md` walks the same three-failure stack from the start of this section in the language of a written audit deliverable: blunt version → consulting-firm angle → frameworks → certs → MITRE → defender action → closing. That's the canonical layout of the in-game post-mortem; it's also approximately the shape of the executive summary you'd hand to Halton's CISO + Driftwood's engagement-management retro. The in-game version cites the specific control IDs your written report would cite; reading it once on each level is how the muscle memory builds.

### Step 6: Return to the lobby

```bash
audit@halton-prod-bastion:~$ exit
guest@d3cyph3r:~$
```

`exit` (or `logout`, or `Ctrl-D`) returns you to the lobby. Your level-2 solve time gets recorded against the level timer; `progress --detail` from anywhere will show the run.

## §3 — The vulnerability

This level lands four CWEs stacked into one bastion. Three are direct-mappable (you'd use them in a formal write-up); the fourth is structural (defines *why* the others were allowed to happen).

**CWE-250: Execution with Unnecessary Privileges.** Daniel's cron job runs as the user `daniel`. The user `daniel` no longer has any business performing operations on Halton's production bastion. His engagement ended on 2026-01-31 per the GECOS field in `/etc/passwd`. Every Sunday at 03:00 UTC since then, an offboarded contractor's local-account credentials have been invoked by the kernel scheduler to execute a script touching `/etc/halton` and `/etc/systemd`. The privileges aren't elevated above Daniel's pre-offboarding posture — but Daniel's pre-offboarding posture itself became "unnecessary" the moment he rolled off, and the cron picked up nothing else to compensate. The control that should have nullified the privilege is account disabling at offboarding time (CIS Critical Security Controls v8.1 control 5.3, NIST SP 800-53 PS-4, NIST SP 800-53 AC-2(3)).

**CWE-532: Insertion of Sensitive Information into Log File.** The snapshot script uses bash `set -x`, which writes a literal copy of every command line — including `export FOO=secret` — to standard error. Standard error is redirected by the cron entry to `/var/log/cron-daniel.log`. The log file ends up at mode 644 because that's the default umask cron writes new files with. Result: the SSH-key passphrase is captured, in plaintext, in a world-readable file, on every weekly run. CWE-532 is a long-standing canonical CWE — it's been in the catalog since the early 2000s — and is one of the most frequently observed sub-techniques in published incident reports. The MITRE mapping is T1552.001 (Unsecured Credentials: Credentials In Files).

**CWE-521: Weak Password Requirements.** Halton's policy mandates the `Halton-YYYY-Q#!` shape. That structure produces approximately twelve unique strings per year (four quarters × the current year, plus a small set of recent years that may still be live somewhere in the estate). The entropy is too low for a meaningful brute-force-resistance budget. The policy document *acknowledges* this — and chooses rotation cadence + rate limiting + account lockout as the mitigating controls instead of complexity. Both of those compensating controls have empirical failure cases. Rotation cadence relies on rotations actually happening (Daniel's snapshot key passphrase has been "Q4 2024" since the SSH-key passphrase was set in late 2024 and has been live in production cron through May 2026). Rate-limiting and lockout only help against online attacks; an attacker with the log file in hand has already bypassed both.

The structural CWE — **CWE-1188 (Insecure Default Initialization of Resource)** is the closest mapping — covers the choice to deploy cron-managed scripts with `set -x` and a redirect to a 644 log as the default operational pattern. Cron itself isn't inherently insecure; cron+`set -x`+644 is a default-mode configuration choice. Most production-bastion scripts in real ops shops should NEITHER use `set -x` with secret-bearing exports NOR redirect to plain files in `/var/log/`; the right modern primitives are systemd journal (`StandardOutput=journal+console` in the unit file) and structured logging with redaction filters. Halton's bastion uses neither.

## §4 — Real-world parallels

Tombstoned accounts, log-file credential leaks, and the joint-mode (a tombstoned account exfiltrating its own credentials via a job nobody is monitoring) are recurring fact patterns in published breach reports.

**Code Spaces (June 2014)** is the canonical "credentials persist long enough for an attacker to use them" cautionary tale. An attacker gained access to a Code Spaces AWS console account, demanded a ransom, and — when Code Spaces tried to revoke the access — deleted the company's S3 buckets, EBS volumes, and most of its EC2 instances. Code Spaces ceased operations within days. The technical posture at the time of the breach was a small company storing customer code without multi-account isolation, with the AWS root credential's password reused across multiple personal accounts the attacker had pre-compromised. The structural lesson, often paraphrased in the years since, is that *if a single credential is the failure boundary between "business operating normally" and "business not operating at all," that credential should be vaulted, MFA-gated, and rotated*. Halton's `Halton-2024-Q3!` is structurally a small-S Code Spaces credential: one string, multiple systems, single failure boundary.

**LADWP and other municipal IT offboarding gaps.** A series of mid-2010s through early-2020s incidents documented dormant credentials of departed contractors continuing to work months and sometimes years after the departure. The technical pattern is uniform across the reports: the IDP-side offboarding fired correctly (the badge was deactivated, the email was disabled, the laptop was retrieved) but per-system local accounts created during the original engagement were never enumerated against the offboarding checklist. Daniel's account on `halton-prod-bastion` is the same fact pattern: a local Linux user with a working shell, surviving the offboarding event because no Halton process cross-referenced `/etc/passwd` against the current HR roster.

**The Twitter (X) 2023 internal-data dump.** In early 2023, multiple gigabytes of internal Twitter source code and configuration material were posted on a GitHub repository. Reporting indicated that some of the material included production-environment credentials surfaced via debug logs and CI/CD pipeline artifacts that had been committed during routine development. The specific failure mode varies across the leaked-data corpus, but a recurring subset is *log files containing trace output that included credential values*. The lesson is that "logs" are not a magically safe destination for engineer-debug output; they are a normal storage layer that obeys all the same access-control and exfiltration risks any other file does.

**The Snowflake / UNC5537 campaign (June 2024).** Mandiant's June 2024 advisory documented a credential-theft campaign in which attackers used credentials harvested *years* earlier from victim devices — credentials that had not been rotated, were not protected by MFA, and continued to grant access to Snowflake customer instances long after they were originally taken. The institutional control that would have prevented impact was credential rotation tied to known compromise events on victim devices. Halton's snapshot passphrase has now been live and exposed for the same kind of multi-quarter window. If an attacker pulled the log file in late 2024 — say, during the initial Q4 install when the cron was actively logging fresh runs — the passphrase has been usable since then.

The four parallels share a structural feature: **a credential that should have been short-lived was treated as if it were operationally permanent**, with the operational permanence enforced by the absence of any process to ratchet it down. Real-world rotation-cadence policy fails when nothing is checking it. Real-world account-lifecycle policy fails when nothing is checking it. The defender's job, on any production-bastion you walk into for the first time, is to *be the something that checks*.

## §5 — Frameworks, deep dive

Five frameworks land hard on this finding. The intersection is unusually dense for a single level.

**NIST SP 800-53 Rev. 5** is the federal-system security-control catalog (current release 5.2.0 as of August 2025, with periodic public updates that don't renumber the controls). PS-4 (Personnel Termination) requires that within an organization-defined time period of termination, system access be disabled and authenticators (passwords, SSH keys, smart cards) associated with the individual be revoked. AC-2(3) (Disable Accounts) extends the requirement to accounts more generally, including those that have become dormant. AU-9 (Protection of Audit Information) requires that the audit-trail data the snapshot is generating be protected commensurate with its sensitivity — a mode-644 plain file in `/var/log/` does not meet AU-9 when the trail contains credentials. AC-6 (Least Privilege) is the structural backstop: daniel's continued group memberships gave him exactly the read-and-execute access required to keep the cron functioning, and AC-6's intent is to drive that access back to zero at offboarding time.

**NIST SP 800-63B-4** (Digital Identity Guidelines, Authentication and Authenticator Management; current revision is the 4th revision finalized in 2024) is where to point Halton's HBISO when they push back on the `Halton-YYYY-Q#!` finding. SP 800-63B explicitly recommends *against* mandatory periodic password changes for memorized secrets unless evidence of compromise exists — a guidance update from the 2017 SP 800-63B Rev. 3 that was reaffirmed in the 2024 4th revision. The reasoning: forced periodic rotation drives users to predictable patterns (exactly the `<Brand>-YYYY-Q#!` shape Halton has built into policy). Rotation cadence is not a substitute for credential strength; it actively erodes credential strength when policy mandates predictable structures. NIST's current guidance is to compose memorized secrets that resist guessing (long, varied, ideally from a blocklist of known compromised values), accept them indefinitely, and rotate *on evidence* — not on a calendar.

**CIS Critical Security Controls v8.1** has been the operational checklist most ops teams reference since v8 dropped in May 2021; the v8.1 revision (June 2024) is current. Control 5 (Account Management) is the umbrella; 5.3 specifically requires disabling dormant accounts on an organization-defined cadence (the v8.1 prescription is 45 days of no activity, lowered from earlier editions). Control 6 (Access Control Management) covers the role-and-membership posture; 6.7 (Centralize Access Control) recommends a centralized identity store as the architectural answer to the per-system-orphaned-account class of failure. Control 8 (Audit Log Management) covers the logging hygiene; 8.4 mandates that audit logs be stored on a system separate from the system being audited, which would have moved Halton's snapshot trace out of the readable-by-shell-users path entirely.

**OWASP Top 10:2025** puts this finding under **A02:2025 — Security Misconfiguration** (the 644-mode log + the cron defaults that produced it), **A06:2025 — Insecure Design** (the architectural choice to redirect a `set -x` trace into a plain log path), and **A09:2025 — Security Logging and Alerting Failures** (the absence of a defender process noticing the credentials in the log over six months of weekly recurrence). The 2025 edition renumbered several categories relative to the 2021 edition; equivalent failures previously sat under A05 (Misconfiguration), A04 (Insecure Design), and A09 (Logging Failures). When citing OWASP in a Halton-facing audit deliverable, prefer the 2025 ordering — Halton's ops team will have moved to the current edition by the time the report lands.

**GLBA Safeguards Rule** (16 CFR Part 314, applicable because Halton is a covered financial institution) gives this finding regulatory teeth. §314.4(c)(1) requires "access controls" on customer-information systems; daniel's continued account on a system that touches the bastion-to-production network is a failure to control access at the system level. §314.4(c)(3) requires that the firm "limit and monitor who can access" those systems; dormant-but-active accounts subvert the monitoring posture by failing to surface as "in use" in any reasonable audit. §314.4(f) puts service-provider oversight squarely on Halton; Driftwood is the service provider, and Driftwood's contractor (Daniel) is the failure boundary that the §314.4(f) language was specifically designed to govern. The 2023 FTC amendments to GLBA reduced the consumer-records threshold for notification reporting from 5,000 to 500 customers, and shortened the deadline from "as soon as possible" to *30 days from determination*. That clock starts the day Halton's CISO concludes that there's a reasonable basis to believe customer data was accessed, not the day the underlying bug was introduced.

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701)** Domain 4.1 covers account-management practices, including the deprovisioning step that should have disabled daniel's account at offboarding. The exam tests this directly: questions on "what control would have prevented this scenario?" expect the candidate to recognize the dormant-account class and cite either least-privilege or termination-procedures as the answer. Domain 5.2 covers password management policy; the `Halton-YYYY-Q#!` pattern is a textbook example of a misaligned policy (rotation cadence prioritized over content quality). The exam framing here is usually inverted — *"which of the following password policies is least secure?"* — and candidates who recognize the rotation-without-randomness antipattern will score this question.

**CompTIA CySA+ (CS0-003)** Domain 1.4 covers threat intelligence and threat-hunting, including hunts for dormant-account misuse. The detection patterns are concrete: cross-reference active-directory or LDAP accounts against payroll/HR rosters; cross-reference per-system local accounts against the centralized identity store; flag accounts with login activity that doesn't match an active employee. The exam tests the analyst's ability to design a hunt query for these patterns. Halton's cron job is a candidate detection: a process running as `daniel` on a Tuesday in May 2026 is a high-confidence alert because Daniel has been off-roster for five months.

**ISC2 CISSP** Domain 5 (Identity and Access Management) covers provisioning and deprovisioning lifecycle in detail. The CBK (Common Body of Knowledge) calls out per-system local-account enumeration as a frequently-missed step in the deprovisioning checklist; CISSP exam questions on this domain test for the candidate's awareness that "centralized identity teardown" doesn't automatically clean up Unix `/etc/passwd` entries on individual hosts. Domain 6 (Security Assessment and Testing) covers the audit and assurance posture; a `getent passwd` or `cat /etc/passwd | awk -F: '{print $1}'` sweep across the production estate, compared against the HR roster, is the canonical audit query the CISSP body covers.

**CompTIA CASP+ / SecurityX (CAS-005)** Domain 1 covers governance, risk, and compliance, including the kind of cross-organization findings (Halton-side account-disable failure plus Driftwood-side credential exposure) that don't fit cleanly into a single org's response process. The exam scenarios at this level routinely involve joint-responsibility frameworks (MSAs, service-level agreements, vendor risk-management programs) and test the candidate's ability to scope a finding to the responsible party.

**Offensive Security OSCP / PEN-200** treats cron and scheduled tasks as a privilege-escalation category; the canonical OSCP cron-privesc questions involve world-writable scripts referenced from `/etc/cron.d/` (running as root, modifiable by the player, executed automatically at the next scheduling tick). Today's finding is the inverse — the script isn't world-writable, but its *output* leaks credentials — and it's a different category of finding (credential-theft vs. privilege-escalation). The OSCP curriculum covers both, and recent additions to the PEN-200 materials have specifically named log-readable credentials as a foothold-extraction pattern worth practicing.

**ISC2 CC** (Certified in Cybersecurity, entry-level) covers identity-lifecycle fundamentals — provisioning, modification, deprovisioning, deactivation, deletion — at a conceptual level. The exam doesn't probe the specifics of `/etc/passwd` hygiene, but the framing of "what happens to accounts when an employee leaves?" is on the exam, and the right answer is "they're disabled, ideally automatically, with audit-logged confirmation."

## §7 — What a defender does

Five remediation actions, ordered by reversibility (most-reversible first; the irreversible ones go last).

**1. Disable daniel's local account on this bastion *today*.** Set `/sbin/nologin` (or `/usr/sbin/nologin`) as his shell in `/etc/passwd`, then `passwd -l daniel` to lock the password hash. The cron job will fail on the next Sunday run because the user invocation can't acquire a shell, and the failure will appear in the cron journal — which is also the right alerting destination for "a job that should have been quiet is suddenly noisy." (Real-world remediation hygiene says: don't *delete* the user, lock it. A locked account preserves the forensic trail; a deleted account loses the audit thread.)

**2. Sweep `/etc/cron.d/` and every per-user crontab across the production estate.** A quick implementation: `ls /etc/cron.d/ && for u in $(awk -F: '{print $1}' /etc/passwd); do crontab -l -u $u 2>/dev/null && echo "--- $u above ---"; done`. Cross-reference the unique user owners against Halton's HR roster of current employees and contractors. Anyone in the cron table who isn't in the roster is a finding. Productionize this with a daily diff: any new cron entry, or any cron entry whose owner is not in the active roster, fires an alert.

**3. Lock down `/var/log/cron-*.log`.** Default mode for cron-written logs should be 640 owned by `root:adm` at minimum (Debian's standard adm-group convention) — readable by humans with adm membership but not by every user. Halton's logrotate config should enforce this on rotation via the `create 0640 root adm` directive in `/etc/logrotate.d/cron`. Apply the same hardening to `/var/log/syslog`, `/var/log/auth.log`, and any other journal-bypass paths.

**4. Remove `set -x` from production scripts that touch secrets.** If verbose tracing is genuinely required for audit compliance (Halton's stated rationale), the trace should pass through a redaction filter: pipe the trace output through `sed` or a small awk filter that suppresses lines matching credential patterns. A regex like `^\+ export +[A-Z_]+(PASS|PASSWORD|KEY|TOKEN|SECRET)=` covers the common shapes. The redaction filter approach preserves the audit value (the trace is still complete; non-secret commands are still visible) while removing the leak surface.

**5. Migrate the snapshot job to a secrets backend.** This is the structural fix. The script today carries `export SSH_KEY_PASSPHRASE='H@lton-Snapshot-2024-Q4'` as a literal string. The right pattern is: the script invokes a secrets-management CLI (`vault kv get`, `aws secretsmanager get-secret-value`, `op item get` for 1Password Connect, `doppler secrets get` etc.) to fetch the passphrase at runtime, passes it directly to `ssh-add` via stdin, and never lets the value materialize in the environment. The trace then shows `export SSH_KEY_PASSPHRASE=$(vault kv get ...)` — interesting *fact*, useless *value*.

**6. Fix the institutional pattern.** A `Halton-YYYY-Q#!` credential is not really a credential — it's a compliance-checkbox artifact. The remediation conversation with HBISO needs to land NIST SP 800-63B-4's guidance: rotation cadence is not a substitute for credential strength; calendar-driven rotation is actively harmful when it drives users to predictable structures. The right policy mandates *length and content variety*, blocks the top-N most-common compromised values via a passlist check at intake, and rotates on evidence (compromise detected, role changed, employee offboarded) rather than on a quarterly cadence. This is the slowest fix because it requires HBISO to revise a 2022-vintage standard, but it's the finding that prevents the *next* leak.

**Bonus: monitor what you're already capturing.** Halton's audit policy required the snapshot trace to exist. The trace existing is fine. The trace *not being audited* is the structural finding. The minimum bar is a periodic (daily, weekly, on-rotation) scan of recently-written log files in `/var/log/` for credential patterns. CrowdStrike Falcon, SentinelOne, gitleaks, trufflehog, and Microsoft Purview's data-loss-prevention engine all do this; pick one and run it.

## §7.5 — Optional exploration

Two bonus finds on this level seed orthogonal lessons. `progress --detail` from anywhere shows your discovered list. Neither find changes the breadcrumb chain.

**1. Daniel's account is still active** — Trigger: `cat /etc/passwd` (or `grep daniel /etc/passwd`). The output contains the line `daniel:x:1042:1042:Daniel Vance (rolled off Halton 2025-01-31):/home/daniel:/bin/bash`. Five fields are worth reading carefully: (a) the username `daniel`, (b) the GECOS comment which *documents the rollover date in plain text*, (c) the shell `/bin/bash` — not `/sbin/nologin` — meaning the account can still take an interactive login, (d) the home directory `/home/daniel` which still exists on the filesystem, and (e) the UID 1042 which has continued to own filesystem objects and run scheduled jobs. The bonus find is the explicit failure of NIST SP 800-53 PS-4 + AC-2(3); the bonus *lesson* is that account-lifecycle hygiene needs to be a continuously-running process, not a one-time-at-offboarding checklist. If you're auditing a production estate, *every* shell host should be cross-referenced against the active roster on a defined cadence.

**2. Halton's quarterly-password policy** — Trigger: `cat /opt/halton/PASSWORD-POLICY.md`. The document is the literal Halton HBISO standard for credential naming. Reading it surfaces the institutional rationale ("predictable naming makes rotation audit-friendly") and the explicit acknowledgment ("the HBISO acknowledges the entropy implication of this pattern. The trade-off is intentional."). The bonus *finding* is that the policy itself is the systemic root cause behind both yesterday's leak and today's leak: the same pattern produces the same string in different contexts (`Halton-2024-Q3!` for the DB *and* the bastion login), and the same string remains live indefinitely when the rotation cadence stops happening (`Halton-Snapshot-2024-Q4` for the SSH-key passphrase). Citing the policy by document ID in your Halton-facing report ("HBPC-2022-014 rev 3, §Rationale") turns a technical observation into a governance finding the CISO can act on.

If you want to see the parallel between this level's findings and real-world reporting, the **MITRE ATT&CK T1078.003 — Valid Accounts: Local Accounts** technique writeup is the canonical reference for the "dormant-but-active" account class. The procedure examples in that writeup include several APT-attributed campaigns that specifically targeted orphaned local accounts on production hosts (rather than the centralized identity store) because the IDP-side detections didn't trigger.

The bonus finds exist to let curious players exercise the systemic-root-cause analysis pattern without leaving the engagement; **the credential chain works without them.** If you're racing through the level once and only once, skip this section. If you're using this to practice for an audit certification or a real engagement, the bonus finds are where the muscle memory builds.

## §8 — Key takeaways

- **A credential in a log is a credential in production.** CWE-532 (Insertion of Sensitive Information into Log File) is one of the most-cited weakness classes in published threat reports because the failure mode is mundane: a developer adds `set -x` for debugging, ships it, and the next ops engineer never thinks about it. The defender's job is to assume credentials are in logs unless proven otherwise — and to scan for them on a cadence.
- **Account-lifecycle hygiene is continuous, not point-in-time.** Disabling an account at offboarding is necessary but not sufficient. Production hosts accumulate local accounts that the centralized IDP doesn't know about, and those local accounts survive offboarding events. The defender's job is to cross-reference the per-host `/etc/passwd` (or its equivalent on every host class) against the active roster on a defined cadence — daily is reasonable for a small estate, weekly is the minimum.
- **Password policies that mandate predictability create predictable passwords.** NIST SP 800-63B-4 is unambiguous: rotation cadence is not a substitute for credential strength, and policy structures that produce predictable strings (`<Brand>-YYYY-Q#!`) actively erode the security posture they claim to provide. The right policy mandates length and variety, blocks compromised values at intake, and rotates *on evidence* rather than on a calendar.
- **The audit policy that produced the leak is not the same as the audit policy that catches the leak.** Halton's existing audit-trail policy required `set -x` to be enabled for trace retention. That policy did its job — the trace exists. What's missing is the *audit-of-the-audit-trail*: a second policy that says "scan the trace destinations for credential patterns at a defined cadence." Most real-world ops shops have the first half and lack the second half.
- **One leaked credential, multiple systems.** The `Halton-2024-Q3!` finding from level1 traversed into shell access here only because Halton's policy reused the string across DB and bastion login. The defender's lesson is to treat any credential that *could* be reused across systems as if it *has been* reused — and to design the credential-revocation playbook for breadth rather than depth.

## §9 — Further reading

*Last reviewed: May 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

- [CWE-250 — Execution with Unnecessary Privileges](https://cwe.mitre.org/data/definitions/250.html)
- [CWE-532 — Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- [CWE-521 — Weak Password Requirements](https://cwe.mitre.org/data/definitions/521.html)
- [CWE-262 — Not Using Password Aging](https://cwe.mitre.org/data/definitions/262.html)
- [CWE-1188 — Insecure Default Initialization of Resource](https://cwe.mitre.org/data/definitions/1188.html)
- [CWE-732 — Incorrect Permission Assignment for Critical Resource (the level1 root cause)](https://cwe.mitre.org/data/definitions/732.html)
- [NIST SP 800-53 Rev. 5 (current Release 5.2.0, August 2025)](https://csrc.nist.gov/pubs/sp/800/53/r5/final)
- [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1)
- [CIS Linux Benchmarks — Ubuntu / RHEL / CentOS distribution-specific configuration baselines](https://www.cisecurity.org/cis-benchmarks)
- [OWASP Top 10:2025 — A02:2025 Security Misconfiguration](https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration/)
- [OWASP Top 10:2025 — A06:2025 Insecure Design](https://owasp.org/Top10/2025/A06_2025-Insecure_Design/)
- [OWASP Top 10:2025 — A09:2025 Security Logging and Alerting Failures](https://owasp.org/Top10/2025/A09_2025-Security_Logging_and_Alerting_Failures/)
- [GLBA Safeguards Rule — 16 CFR Part 314 (FTC)](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule)
- [FTC Safeguards Rule — 2023 amendments (security event notification, 30-day reporting clock)](https://www.ftc.gov/business-guidance/blog/2023/10/ftc-safeguards-rule-what-your-business-needs-know)
- [MITRE ATT&CK — T1078.003: Valid Accounts: Local Accounts](https://attack.mitre.org/techniques/T1078/003/)
- [MITRE ATT&CK — T1053.003: Scheduled Task/Job: Cron](https://attack.mitre.org/techniques/T1053/003/)
- [MITRE ATT&CK — T1552.001: Unsecured Credentials — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/)
- [Code Spaces (June 2014) — AWS account takeover and company shutdown (Threatpost coverage)](https://threatpost.com/aws-console-breach-leads-to-demise-of-service-with-no-backups/106839/)
- [Twitter (X) source-code leak (March 2023) — The New York Times reporting](https://www.nytimes.com/2023/03/26/business/twitter-leak-source-code.html)
- [Mandiant — UNC5537 Snowflake customer campaign (June 2024 advisory)](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion)
- [Snowflake (Brad Jones, CISO) — Detecting and Preventing Unauthorized User Access (June 2024 customer advisory)](https://medium.com/snowflake/detecting-and-preventing-unauthorized-user-access-d67be8bd66f6)
- [CISA Alert — Snowflake Recommends Customers Take Steps to Prevent Unauthorized Access (June 3, 2024)](https://www.cisa.gov/news-events/alerts/2024/06/03/snowflake-recommends-customers-take-steps-prevent-unauthorized-access)
- [Have I Been Pwned — credential-stuffing impact and the password-reuse failure mode](https://haveibeenpwned.com/)
- [gitleaks — credential-pattern scanner for logs and filesystems](https://github.com/gitleaks/gitleaks)
- [trufflehog — credential-pattern scanner with verification](https://github.com/trufflesecurity/trufflehog)
- [HashiCorp Vault — Getting Started (database secrets engine)](https://developer.hashicorp.com/vault/tutorials/db-credentials/database-secrets)
- [AWS Secrets Manager — User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [Doppler — secrets-management platform](https://docs.doppler.com/docs)
- [auditd — Linux audit framework configuration](https://man7.org/linux/man-pages/man8/auditctl.8.html)
- [logrotate — log-file rotation, compression, and mode hardening](https://man7.org/linux/man-pages/man8/logrotate.8.html)
- [systemd journal — `StandardOutput=journal` for unit-managed processes](https://www.freedesktop.org/software/systemd/man/systemd.exec.html)
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
