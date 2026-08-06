# level3@linux — Daniel's Forgotten Sudo

**Track:** Linux · **Client:** Halton Bank (continued) · **Compliance regime:** GLBA § 501(b) (Interagency Guidelines)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level4@linux`. If you haven't solved `level3@linux` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough assumes you've worked through `level0@linux` through `level2@linux`; this level continues their narrative directly.

---

## §1 — The setup

Still day three at Driftwood Systems. An hour ago you were on `halton-prod-bastion`, reading a weekly cron job's `set -x` trace out of a world-readable log. The credential that trace kept spilling — `H@lton-Snapshot-2024-Q4` — turned out not to be a login password at all. It was the *passphrase on an SSH key*: `/etc/halton/keys/snapshot-rsync.key`, the key Daniel's snapshot cron used to `rsync` its payload to a second box, `halton-build-runner`. Priya's team loaded the key with the passphrase and rode Daniel's own backup path across the wire. That's where you are now.

The prompt reads `daniel@halton-build-runner`. Read that carefully. You are not `audit` anymore — you're logged in **as Daniel**, the consultant who rolled off Halton's engagement on 2026-01-31. His account was never disabled on the bastion (that was level2's first bonus find), and — you're about to confirm — it was never disabled *here* either. The offboarding failure isn't a one-box slip. It's a pattern, and this is the second box it shows up on.

There is an important shift in what "the finding" means on this level. Levels 0 through 2 were **credential-discovery** puzzles: read the right file, extract the string, carry it forward. This level is a **privilege-escalation** puzzle. You already have a foothold (Daniel's account). The question is no longer "where's the credential" — it's "*what can this account still do that it shouldn't be able to*, and how do I turn that into access to something that matters." That is the single most common shape of real Linux post-exploitation work, and its first move is always the same command.

A note on the layout, because it's the same as the bastion: `halton-build-runner` runs the audit shell in a sandboxed chroot where your home directory and the read-only system root point at the same node. `ls ~` shows `welcome.md` and `lessons-learned.md` alongside system paths like `etc/` and `var/`. `cat /etc/passwd` and `cat ~/etc/passwd` are the same lookup. That's intentional scoping, not a path bug.

Priya, in chat as you land: *"That passphrase wasn't a login — it was the passphrase on Daniel's snapshot key, and the key put us on the build-runner as him. His account's still here too. Find out what it can still do, and whether the backups it's been shipping for months are as harmless as Halton thinks."* Your scope: escalate, and prove what the escalation reaches.

Cross-track note: the Atlas Health cert engagement (`level2@network`) and the Polaris / Reed Connolly forensics case (`level2@forensics`) are still open on adjacent benches. You can walk the tracks in any order; the narrative is a single Driftwood book of business in chronological flow.

## §2 — The solve

Seven steps, but the whole level turns on one command — `sudo -l` — and one idea: a permission that was granted for a good reason, to a person who left, and never taken away.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level3@linux
level3@linux's password: H@lton-Snapshot-2024-Q4
```

The password is the SSH-key passphrase you recovered from `cron-daniel.log` on the bastion. The connection banner identifies the host (`halton-build-runner.driftwood.internal`) and the tier (Routine, ~12 min). Read `welcome.md` first:

```bash
daniel@halton-build-runner:~$ cat welcome.md
```

`welcome.md` sets up the engagement (you're Daniel, via his snapshot key), reiterates the audit-chroot layout, and introduces the one new command you need: `sudo -l`. It also plants the framing you should internalize before you run anything — *you are not root, but Daniel's account may have been left able to become root for specific commands.*

### Step 2: Confirm who you are

```bash
daniel@halton-build-runner:~$ id
uid=1042(daniel) gid=1042(daniel) groups=1042(daniel)

daniel@halton-build-runner:~$ whoami
daniel
```

You're `daniel`, uid 1042 — the same uid the bastion's `/etc/passwd` carried for the offboarded consultant. You have a normal, unprivileged account. Nothing you've done so far touches root. Establishing your starting privilege level explicitly is not busywork; it's the baseline the *next* command is measured against.

### Step 3: Enumerate what this account can run as root

This is the command the whole level exists to teach:

```bash
daniel@halton-build-runner:~$ sudo -l
Matching Defaults entries for daniel on halton-build-runner:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User daniel may run the following commands on halton-build-runner:
    (root) NOPASSWD: /usr/bin/cat /var/backups/halton-prod/*
```

`sudo -l` ("list") prints the sudoers grants the *current* account holds. You almost never get to read `/etc/sudoers` directly — it's mode 0440, root-only — so `sudo -l` is how you (or an attacker, or a defender doing a hygiene sweep) enumerate a user's privilege surface. On a well-run box, an offboarded consultant's account returns nothing here. Daniel's returns one line, and every token in it is a finding:

- **`(root)`** — the command runs as root.
- **`NOPASSWD:`** — no password prompt. An attacker who lands on this account needs no additional secret to use the grant. This is what turns "I have Daniel's shell" into "I have a root-level primitive" with zero friction.
- **`/usr/bin/cat /var/backups/halton-prod/*`** — the grant is `cat`, constrained to a path. It *reads* as root. It doesn't obviously give you a shell. That feels narrow — which is exactly why it survived. Whoever reviewed sudoers (if anyone did) saw "cat a backup directory" and moved on.

The dangerous token is the `*`. A wildcard over a directory means "anything that ever lands under `/var/backups/halton-prod/`, for as long as this line exists." You don't control what gets written there — the weekly cron does. The moment that backup contains something sensitive, this grant reads it as root. Least privilege (NIST AC-6) means the narrowest command on the *narrowest* path; a wildcard over a directory whose contents you don't control is the opposite of narrow.

### Step 4: Walk the backup the grant points at

Recall from level2 what the snapshot cron actually shipped here: `cp -a /etc/halton` and `cp -a /etc/systemd`, `rsync`'d to `daniel@halton-build-runner:/var/backups/halton-prod/`. So the grant's wildcard covers a weekly copy of Halton's production `/etc/halton` config tree. Walk it:

```bash
daniel@halton-build-runner:~$ ls /var/backups/halton-prod/
etc-halton  etc-systemd

daniel@halton-build-runner:~$ ls /var/backups/halton-prod/etc-halton/
db  halton.conf  secrets.d

daniel@halton-build-runner:~$ ls /var/backups/halton-prod/etc-halton/secrets.d/
prod-vault.env
```

A directory literally named `secrets.d/` sits inside a *config backup*. That is the finding forming under your hands: a routine snapshot of `/etc/halton` swept up a live secrets directory. `halton.conf` is harmless (and, being world-readable, you can `cat` it without sudo — go ahead and confirm the contrast). `secrets.d/prod-vault.env` and `db/` are not harmless.

### Step 5: Read the secret — but notice you *can't*, until you escalate

Try the obvious thing first:

```bash
daniel@halton-build-runner:~$ cat /var/backups/halton-prod/etc-halton/secrets.d/prod-vault.env
cat: /var/backups/halton-prod/etc-halton/secrets.d/prod-vault.env: Permission denied
```

Permission denied. When `halton-build-runner` ingests a delivered backup, a root process re-owns everything under `/var/backups/halton-prod/` to `root:root`, mode 0600 — a common hardening so the pushing account can't tamper with backups after delivery. The irony is that the same hardening means Daniel can't read back the files his own cron shipped. Normally that's a wall.

Except Daniel has the grant. Put `sudo` in front:

```bash
daniel@halton-build-runner:~$ sudo cat /var/backups/halton-prod/etc-halton/secrets.d/prod-vault.env
# Halton production Vault agent environment
# /etc/halton/secrets.d/prod-vault.env
# DO NOT BACK UP. DO NOT COMMIT. (both happened anyway.)
VAULT_ADDR=https://vault.halton.internal:8200
VAULT_NAMESPACE=halton-prod
# ROOT token, issued for the 2024-Q4 migration. Ticket
# HBISO-EX-0042 said "rotate before Q1 2025." Never rotated.
VAULT_TOKEN=hvs.HALTONr00tPr0dVault2024Q4Kp7mNq
```

There it is. `sudo cat` ran as root, which ignores the file's permission bits, so the root-owned `0600` file reads cleanly. `VAULT_TOKEN=hvs.HALTONr00tPr0dVault2024Q4Kp7mNq` is a **production Vault ROOT token** — the master credential for Halton's secrets store — sitting in plaintext inside a config backup, reachable by an offboarded contractor's account through a single leftover grant. It's also (per the comment, and per the `2024Q4` tell baked into the string) a token that was supposed to be rotated 18 months ago and never was.

That token is the breadcrumb for `level4@linux`. Hold it. Also notice what you did NOT need: you never needed a sudo *password*, and you never needed a real exploit. You needed `sudo -l` and a wildcard.

### Step 6: Read the post-mortem

```bash
daniel@halton-build-runner:~$ cat lessons-learned.md
```

`lessons-learned.md` walks the failure stack in audit-deliverable language: blunt version → consulting-firm angle → frameworks → certs → MITRE → defender action → closing. Read it once per level; it's the shape of the executive summary you'd hand Halton's CISO.

### Step 7: Return to the lobby

```bash
daniel@halton-build-runner:~$ exit
guest@d3cyph3r:~$
```

`exit` (or `logout`, or `Ctrl-D`) returns you to the lobby and records your level-3 solve time. `progress --detail` shows the run and any bonus finds you triggered.

## §3 — The vulnerability

This level stacks three CWEs, and the way they compound is the lesson.

**CWE-250: Execution with Unnecessary Privileges.** The sudoers grant lets Daniel's account run a command as root. Daniel's account has had no legitimate reason to exist on this host since 2026-01-31. Every privilege attached to it after that date is, by definition, unnecessary. A NOPASSWD root grant on a dormant account is the maximal form of this weakness: the account should have zero privilege, and instead it has a frictionless root-read primitive. The control that should have nullified it is account teardown at offboarding (NIST PS-4, AC-2(3)); the control that should have caught it afterward is a periodic least-privilege review of sudoers (NIST AC-6).

**CWE-732: Incorrect Permission Assignment for Critical Resource.** The sudoers entry itself is the mis-assigned permission. Two things are wrong with it independently. First, it was granted to the wrong principal for the current state of the world — it should have been removed when Daniel left. Second, its *scope* was wrong from the day it was written: `/usr/bin/cat /var/backups/halton-prod/*` is a wildcard over a directory whose contents are controlled by a different process (the weekly cron). A grant is only as narrow as the least-narrow thing that can ever appear under its wildcard. The instant a secrets directory appeared in the backup, the grant's effective scope became "read Halton's production secrets as root." Nobody re-evaluated the grant when the thing it pointed at changed.

**CWE-312: Cleartext Storage of Sensitive Information.** The Vault root token — and the DB credentials you can find as a bonus — sit in plaintext inside a routine config backup. `secrets.d/` should never have been in a snapshot of `/etc/halton` in the first place; secrets belong in a secrets manager and should be *excluded* from filesystem backups (or the backup should be encrypted at rest with keys the pushing account can't reach). A backup is a copy of your crown jewels by definition; treating it as low-sensitivity because "it's just a backup" is the design error.

The three compound like this: CWE-732 (the over-broad grant) turns CWE-250 (the dormant account) into a root-read primitive, and CWE-312 (secrets in the backup) is what that primitive happens to read. Remove any one and the chain breaks — disable the account, and the grant is unreachable; scope the grant to a specific non-secret file, and the wildcard can't reach `secrets.d/`; keep secrets out of the backup, and `sudo cat` finds nothing worth having. Defense-in-depth is exactly the observation that you should not have to get all three right, because you will not.

One thing this level is *not*: it is not a sudo software vulnerability. `sudo` the program did precisely what its configuration told it to. The finding is entirely in the policy (who may run what, as whom, over which paths) and in what the wildcard was allowed to reach. That distinction matters when you write it up — the remediation is `visudo`, not `apt upgrade sudo`.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Halton's build-runner as `daniel`, an account belonging to a consultant who rolled off a year earlier and was never deprovisioned |
| Grant in scope | A surviving `NOPASSWD` sudo rule permitting `cat` over a wildcard path in the production backup tree |
| Data reached | A Vault **root** token, swept into the weekly backup from a file marked "DO NOT BACK UP" |
| Exposure window | Issued for the 2024-Q4 migration, with a ticket saying rotate before Q1 2025. Never rotated |
| Escalates to | Vault root is the top of Halton's secret hierarchy, not a step in it |
| Regime | GLBA § 501(b) via the Interagency Guidelines; Halton's regulator clock is 36 hours |

**A Vault root token is not one more credential, and reporting it as one
understates it by an order of magnitude.** Every secret Vault brokers is
reachable from it, including secrets for systems this engagement never
touched. The correct scoping question is not "what does this token open"
but "what did Vault hold," and the answer is the reason this finding
outranks everything else in the track.

**The wildcard is the whole grant.** `cat /var/backups/halton-prod/*`
reads as narrow, and it is not: it is unrestricted read of whatever the
backup process places in that directory, as root, forever, decided by a
process nobody reviewed against the sudoers rule. Sudo grants scoped by
path glob are a standing bet that the directory's future contents stay
harmless. That bet lost here.

**The offboarding failure is the control finding; the token is the
consequence.** Daniel's account outliving his engagement by a year is a
III.C.1.a access-control failure that no amount of secret rotation fixes,
and III.D puts the oversight of that service-provider arrangement on
Halton. Rotating the token and leaving the account closes the incident
and preserves the vulnerability.

## §4 — Real-world parallels

Leftover and over-broad sudo grants, dormant privileged accounts, and secrets-in-backups are all heavily represented in published incident data.

**Malware that writes its own NOPASSWD line.** MITRE ATT&CK documents T1548.003 (Sudo and Sudo Caching) with real procedure examples that are the offensive mirror of this level. The **Dok** macOS malware appends `admin ALL=(ALL) NOPASSWD: ALL` to `/etc/sudoers` to grant itself persistent passwordless root; the **Proton** macOS backdoor disables `tty_tickets` so a cached sudo timestamp can be abused from any terminal. Attackers *manufacture* exactly the condition Halton left lying around by accident: a NOPASSWD grant on an account they control. When a real intrusion finds a NOPASSWD line already present, it saves them a step — which is why a leftover grant on a dormant account is a gift to an attacker who already has a foothold.

**CVE-2021-3156 ("Baron Samedit").** Disclosed by Qualys on 26 January 2021, this was a heap-based buffer overflow in `sudo` itself (an off-by-one in command-line argument unescaping) that had been hiding in the code since a July 2011 commit. It affected sudo 1.8.2 through 1.8.31p2 and 1.9.0 through 1.9.5p1 in their default configurations, and let *any* local user get root regardless of whether they had any sudoers entry at all. Baron Samedit is the reminder that `sudo` is a large SUID-root C program on the most sensitive trust boundary a Linux box has — worth patching promptly — but note the contrast with today's level: Baron Samedit was a *code* bug, and this level is a *config* bug. In the wild you'll meet far more of the second kind than the first.

**CVE-2019-14287 (the `-u#-1` runas bypass).** Reported by Apple's Joe Vennix in October 2019: if a sudoers rule permitted a user to run a command as any user *except* root (a `(ALL, !root)` runas spec that admins wrote thinking it was a safe restriction), `sudo -u#-1` (or `-u#4294967295`) resolved to uid 0 and ran the command as root anyway. It's the canonical example of sudoers policy being subtler than it looks — an admin's intuition about what a rule permits and what the rule *actually* permits diverging in a way that hands over root.

**The offboarded-insider-with-lingering-access pattern.** A long line of incidents — municipal IT contractors, the 2018 Cisco ex-employee who deleted 456 WebEx VMs months after departing using access that was never revoked, and the recurring cast of "former admin still had a working account" breach reports — share Daniel's exact shape: the identity-provider-side offboarding fired (badge, email, laptop), but per-system local state (a Unix account, a sudoers line, an SSH key, a cron entry) was never enumerated against the departure. The technical lesson is uniform: **offboarding is not a single event at the IDP; it's a sweep across every system the person ever touched.**

**Secrets swept into backups and snapshots.** Backup and snapshot exposure is a steady drumbeat in breach reporting — from mis-scoped database dumps to VM snapshots and container images that captured `.env` files, private keys, and cloud credentials that were live in the source system. The failure is always the same reasoning error: a backup is treated as lower-sensitivity than the thing it copies, when it is in fact an exact, often less-monitored, replica of it. Halton's config backup scooping up `secrets.d/` is a small, clean instance of a very large category.

The parallels share one structural feature: **a privilege or a secret outlived the assumptions that made it safe.** The grant was safe when Daniel was employed and the backup held no secrets. The token was safe when it was going to be rotated in Q1 2025. Nothing checked whether those assumptions still held. The defender's job, walking onto any box for the first time, is to be the thing that checks.

## §5 — Frameworks, deep dive

**NIST SP 800-53 Rev. 5** (current Release 5.2.0, August 2025) lands on this finding from several directions. **AC-6 (Least Privilege)** is the spine: organizations must employ the principle of least privilege, allowing only authorized accesses necessary to accomplish assigned tasks. A NOPASSWD wildcard `cat` grant on a departed contractor's account fails AC-6 on both axes — wrong principal, over-broad scope. The control enhancements are where the remediation lives: **AC-6(1)** (authorize access to security functions and security-relevant information — the Vault token is exactly this), **AC-6(2)** (require non-privileged accounts for non-security functions), **AC-6(5)** (restrict privileged accounts to a defined set of personnel), and **AC-6(9)/(10)** (log the execution of privileged functions and prevent non-privileged users from executing privileged functions). **AC-2(3)** (Disable Accounts) and **PS-4 (Personnel Termination)** are the offboarding controls Daniel's surviving account violates, again. **CM-6 (Configuration Settings)** covers the sudoers baseline, and **SC-28 (Protection of Information at Rest)** covers the unencrypted secrets in the backup.

**CIS Critical Security Controls v8.1** (June 2024 revision) is the operational checklist. **Safeguard 5.3** requires disabling dormant accounts (the v8.1 prescription is 45 days of inactivity) — Daniel's account is five months dormant. **Safeguard 5.4** ("Restrict Administrator Privileges to Dedicated Administrator Accounts") says privileged access should live on dedicated admin accounts, not be bolted onto a general user account via a sudoers line — the exact anti-pattern here. **Safeguard 4.7** covers managing default and temporary accounts and grants; the sudoers line was self-labeled temporary ("REMOVE after Q4 2024 cutover") and became permanent through neglect. **Safeguard 3.11** ("Encrypt Sensitive Data at Rest") is the control the plaintext backup violates.

**OWASP Top 10:2025** puts this under **A01:2025 — Broken Access Control**, which has held the #1 slot since the 2021 edition. An over-broad sudoers wildcard is a textbook broken-access-control primitive: an authorization rule that grants materially more than its author intended. There's a secondary read under **A04 — Insecure Design** (the decision to route a `/etc/halton` snapshot, secrets and all, into a directory reachable by a low-privilege grant is a design defect, not just a config slip).

**GLBA § 501(b)** applies because Halton is a covered financial institution; as a bank its implementing rule is the Interagency Guidelines Establishing Information Security Standards (12 CFR Pt. 30 App. B for OCC-supervised banks, Pt. 208 App. D-2 for Fed members, Pt. 364 App. B for FDIC-supervised banks), not the FTC Safeguards Rule that governs nonbank institutions. III.C.1.a requires access controls on customer-information systems, and a NOPASSWD root grant on a dormant account is an access-control failure at the system level. III.C.1.f requires monitoring to detect attempted intrusions; a grant that survived offboarding and reaches production secrets is both an access failure and a monitoring failure. III.D puts service-provider oversight on Halton, and Driftwood is the service provider the provision was written to govern.

The reporting clock is the part worth committing to memory, because it is far tighter than the FTC's and applies to a different population. Under the Computer-Security Incident Notification Rule, Halton has **36 hours** from determining that a notification incident has occurred to notify its primary federal regulator. A Vault root token sitting in an attacker-reachable backup is precisely the kind of finding that starts that determination.

## §6 — Cert exam relevance

**Offensive Security OSCP / PEN-200** treats this level as bread and butter. `sudo -l` is the *first* command in the Linux privilege-escalation playbook — before SUID hunting (`find / -perm -4000`), before cron inspection, before kernel-exploit triage. The PEN-200 materials teach that any sudoers entry is a candidate escalation path, and **GTFOBins** (gtfobins.github.io) is the reference for which sudo-allowed binaries can be escaped to a root shell. `cat` isn't in the "spawn a shell" category — but it *is* an arbitrary-file-read primitive, and GTFOBins lists `cat` precisely for the "read a root-only file" case. The exam tests whether you recognize a permissive grant as a foothold, not whether you can pop a shell from it.

**CompTIA Security+ (SY0-701)** Domain 4.1 (security techniques for computing resources) and the least-privilege material across Domains 3–4 test the account-hardening side: recognizing that privilege should live on dedicated accounts, that dormant accounts are a risk, and that "least privilege" means narrowing grants to the minimum. Questions framed as "which control would have prevented this?" expect least-privilege / account-deprovisioning answers.

**CompTIA CySA+ (CS0-003)** Domain 1 covers threat-hunting for exactly this: a hunt that enumerates `sudo -l` (or parses `/etc/sudoers` and `/etc/sudoers.d/`) across the fleet, flags every NOPASSWD entry and every wildcard, and cross-references grant owners against the active roster. Daniel's grant is a high-confidence hit on all three signals.

**ISC2 CISSP** Domain 5 (Identity and Access Management) covers privileged-access management and the deprovisioning lifecycle in depth; the CBK specifically calls out per-system privilege remnants (local accounts, sudoers entries, key material) as frequently-missed deprovisioning steps. Domain 3 covers protecting data at rest, the backup-encryption angle.

**Linux Foundation LFCS / Red Hat RHCSA** test sudoers management directly as a hands-on objective: editing `/etc/sudoers` safely with `visudo`, scoping commands, understanding `NOPASSWD`, and using `/etc/sudoers.d/` drop-ins. The defensive half of this level — *how a competently-managed sudoers policy is supposed to look* — is squarely on those exams. **CompTIA Linux+ (XK0-005)** covers the same ground at an associate level.

## §7 — What a defender does

Six actions, ordered most-reversible first.

**1. Remove the grant.** `visudo -f /etc/sudoers.d/halton-daniel-snapshot` and delete the line today (use `visudo`, never a plain editor — it syntax-checks before saving, and a broken sudoers file can lock everyone out of root). This is instantly reversible if you kept the file under configuration management, which you should.

**2. Disable Daniel's account on this host and every other one.** `usermod -L daniel && usermod -s /usr/sbin/nologin daniel` locks the password and removes the login shell; don't delete the account (deletion loses the forensic trail). Then sweep the fleet: this is the second box Daniel survived on, so assume there are more.

**3. Rotate the Vault token immediately and treat it as compromised.** It was root-scoped and sitting in an attacker-reachable backup for months. `vault token revoke hvs.HALTONr00tPr0dVault2024Q4Kp7mNq`, issue a fresh short-TTL token to whatever legitimately needed it, and review Vault's audit log for any use of the old token you can't account for.

**4. Audit every sudoers entry across the fleet for NOPASSWD and wildcards.** A quick sweep: `for h in $(cat hosts.txt); do ssh $h 'sudo -n cat /etc/sudoers /etc/sudoers.d/* 2>/dev/null'; done | grep -E 'NOPASSWD|\*'`. Every NOPASSWD line and every wildcard path is a review item; cross-reference each grant's principal against the active roster. Productionize it as a config-management assertion (Ansible/Puppet/Chef) so drift is caught within a converge cycle, not at the next pentest.

**5. Get secrets out of the backup.** Exclude `secrets.d/` and `db/` from the snapshot (`rsync --exclude`), or — better — stop snapshotting secrets to disk at all and have consumers pull them from Vault at runtime so they never sit in a file the backup can sweep up. If the backup genuinely must contain sensitive data, encrypt it at rest with a key the pushing account cannot read (CIS 3.11, NIST SC-28).

**6. Prefer short-lived, scoped, audited privilege.** The durable fix for the whole class is architectural: no NOPASSWD on anything that touches secrets; sudo grants scoped to exact commands (not wildcarded paths); privileged actions logged centrally (`AC-6(9)`); and, where possible, just-in-time elevation (a broker that grants a time-boxed, audited grant on request) instead of standing sudoers lines that outlive the reason they were written. A grant that expires on its own can't be the thing an attacker finds 18 months later.

### Sample detection rule (Sigma)

Two things are worth alerting on here, and they arrive in order:
enumeration first, then the privileged read. Catching the first buys time;
catching the second is the incident.

```yaml
title: Privileged read of production backup material via sudo
status: experimental
description: >
  Detects sudo-executed reads of files under the production backup tree.
  Wildcard sudoers grants scoped by path glob permit any file the backup
  process later places there, so the grant cannot be evaluated safely
  from the sudoers entry alone and must be watched at use time.
logsource:
  product: linux
  service: auditd
detection:
  sudo_read:
    type: 'USER_CMD'
    cmd|contains|all:
      - '/bin/cat'
      - '/var/backups/'
  platform_team:
    uid:
      - '1001'   # backup-verification service account
  condition: sudo_read and not platform_team
falsepositives:
  - Scheduled backup-verification runs. These execute under a known
    service account and on a predictable cadence; exclude by UID and
    review any run that falls outside its window.
level: high
```

A second, cheaper rule catches the reconnaissance: alert on `sudo -l` from
any interactive account outside the platform team. Legitimate operators
already know what they can run. An account enumerating its own privileges
is either a new engineer or somebody establishing what a foothold is
worth, and both are worth a look.

The detection does not fix the grant. A `NOPASSWD` rule ending in a
wildcard is a standing bet that the directory's future contents stay
harmless, and rewriting it to name specific files is the actual
remediation. Detection is what covers the window between now and then.

## §7.5 — Optional exploration

Two bonus finds seed orthogonal lessons. `progress --detail` shows your discovered list. Neither changes the breadcrumb chain.

**1. Daniel's account outlived him here too** — Trigger: `cat /etc/passwd` (or `grep daniel /etc/passwd`). The output carries `daniel:x:1042:1042:Daniel Vance (rolled off Halton 2025-01-31):/home/daniel:/bin/bash` — the same offboarding miss you found on the bastion, on a *second* production host, `/bin/bash` shell and all. The point of surfacing it again is that a single dormant account is an incident; the identical miss on a second box is a *systemic* identity-lifecycle failure (NIST PS-4 / AC-2(3)) — it means Halton has no process that enumerates per-host local accounts against the roster, so there are almost certainly more. In your report, this is the difference between "fix this account" and "fix your offboarding process."

**2. The backup swept up live secrets** — Trigger: `sudo cat /var/backups/halton-prod/etc-halton/db/connections.yaml`. Beyond the Vault token, the config snapshot also captured Halton's production DB connection profiles — host, database, user, and a plaintext `password: Halton-2024-Q3!` (the same unrotated string from level1/level2, reused yet again). The finding is that a backup of a *config* directory is quietly a backup of *live credentials*, and the reused-password pattern from earlier in the track is still live in production a year later. CWE-312, and a direct callback to Halton's cargo-cult password policy.

For the offensive-reference version of this level's technique, the canonical reading is **GTFOBins** (gtfobins.github.io) — search any binary to see whether a sudo grant on it can be escaped to a root shell or abused for a root-level file read. `cat` appears there under the "read a root-owned file" primitive, which is exactly what the grant handed you. The defensive mirror of GTFOBins is: assume any sudo-allowed binary is escapable until you've proven it isn't, and never grant sudo on a binary (or a wildcard) you haven't checked against it.

The bonus finds exist to exercise the systemic-root-cause pattern without leaving the engagement; **the credential chain works without them.** If you're racing the level, skip this. If you're building audit muscle memory, this is where it builds.

## §8 — Key takeaways

- **`sudo -l` is the first move.** On any Linux box where you have a foothold — as an attacker proving impact, or a defender doing a hygiene sweep — the first question is "what can this account already do as root?" A dormant account that answers with a NOPASSWD grant is a finished privilege-escalation path, no exploit required.
- **A grant is only as narrow as the widest thing its wildcard can reach.** `cat /var/backups/*` looks like "read one directory." It's actually "read anything that ever appears in that directory, forever." Least privilege means scoping to exact resources, and re-reviewing grants when the thing they point at changes — not just when the person changes.
- **Privileges and secrets outlive the assumptions that made them safe.** The grant was safe while Daniel was employed and the backup held no secrets; the Vault token was safe while it was going to be rotated on schedule. Nothing checked whether those assumptions still held. Build the thing that checks — periodic least-privilege reviews, dormant-account sweeps, rotation-on-evidence.
- **A backup is a copy of your crown jewels.** Treat snapshots and backups with the same sensitivity as the source: exclude secrets, encrypt at rest, and access-control the destination so one leftover grant can't turn a config backup into a secrets buffet.
- **Config bugs outnumber code bugs on the sudo boundary.** Baron Samedit was real and worth patching, but you'll meet a hundred over-broad or leftover sudoers lines for every heap overflow. The remediation for this level is `visudo`, not `apt upgrade`.

## §9 — Further reading

*Last reviewed: July 2026. External standards versions, CVE identifiers, and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

- [CWE-250 — Execution with Unnecessary Privileges](https://cwe.mitre.org/data/definitions/250.html)
- [CWE-732 — Incorrect Permission Assignment for Critical Resource](https://cwe.mitre.org/data/definitions/732.html)
- [CWE-312 — Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html)
- [CWE-269 — Improper Privilege Management](https://cwe.mitre.org/data/definitions/269.html)
- [MITRE ATT&CK — T1548.003: Abuse Elevation Control Mechanism: Sudo and Sudo Caching](https://attack.mitre.org/techniques/T1548/003/)
- [MITRE ATT&CK — T1078.003: Valid Accounts: Local Accounts](https://attack.mitre.org/techniques/T1078/003/)
- [GTFOBins — sudo/SUID abuse reference (search any binary)](https://gtfobins.github.io/)
- [GTFOBins — cat (root-owned file read via sudo)](https://gtfobins.github.io/gtfobins/cat/)
- [CVE-2021-3156 "Baron Samedit" — Qualys advisory (26 Jan 2021)](https://blog.qualys.com/vulnerabilities-threat-research/2021/01/26/cve-2021-3156-heap-based-buffer-overflow-in-sudo-baron-samedit)
- [CVE-2021-3156 — NVD detail](https://nvd.nist.gov/vuln/detail/CVE-2021-3156)
- [CVE-2019-14287 — sudo runas `-u#-1` bypass (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2019-14287)
- [Sudo project — security advisories](https://www.sudo.ws/security/advisories/)
- [Sudo manual — sudoers(5)](https://www.sudo.ws/docs/man/sudoers.man/)
- [NIST SP 800-53 Rev. 5 — AC-6 Least Privilege (current Release 5.2.0)](https://csrc.nist.gov/pubs/sp/800/53/r5/final)
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1)
- [CIS Controls Navigator — Safeguards 5.3 / 5.4 / 4.7 / 3.11](https://www.cisecurity.org/controls/cis-controls-navigator)
- [OWASP Top 10:2025 — A01:2025 Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/)
- [Interagency Guidelines Establishing Information Security Standards — 12 CFR Pt. 30 App. B](https://www.ecfr.gov/current/title-12/chapter-I/part-30/appendix-Appendix%20B%20to%20Part%2030)
- [Computer-Security Incident Notification Rule — 12 CFR Part 53 (36-hour clock)](https://www.ecfr.gov/current/title-12/chapter-I/part-53)
- [Interagency Guidance on Response Programs and Customer Notice (2005)](https://www.federalregister.gov/documents/2005/03/29/05-5980/interagency-guidance-on-response-programs-for-unauthorized-access-to-customer-information-and)
- [GLBA Safeguards Rule — 16 CFR Part 314 (FTC; nonbank institutions, shown for contrast)](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule)
- [FTC Safeguards Rule — 2023 amendments (security-event notification, 30-day clock)](https://www.ftc.gov/business-guidance/blog/2023/10/ftc-safeguards-rule-what-your-business-needs-know)
- [HashiCorp Vault — token management and revocation](https://developer.hashicorp.com/vault/docs/concepts/tokens)
- [Cisco ex-employee WebEx deletion (2018) — DOJ press release](https://www.justice.gov/usao-ndca/pr/san-jose-man-pleads-guilty-damaging-cisco-s-network)
- [Have I Been Pwned — password-reuse failure mode](https://haveibeenpwned.com/)
- [visudo(8) — safe sudoers editing](https://man7.org/linux/man-pages/man8/visudo.8.html)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
