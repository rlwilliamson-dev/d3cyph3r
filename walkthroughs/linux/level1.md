# level1@linux — The Backup Daniel Forgot

**Track:** Linux · **Client:** Halton Bank (continued) · **Compliance regime:** GLBA Safeguards Rule

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level2@linux`. If you haven't solved `level1@linux` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough also assumes you've read or solved `level0@linux` first; the setup picks up where that one ended.

---

## §1 — The setup

Day two at Driftwood Systems. Yesterday you audited Daniel's offboarded laptop and recovered the Halton Bank staging-DB credential he'd left in `creds.txt`. Today you're using that credential — `please-rotate-me` — to walk a *different* box. Not a forensics-recovered laptop sitting on a forensic workstation; an actively-deployed client production bastion that you just SSH'd into using a credential that should have been revoked at engagement closeout and wasn't.

The shell prompt now reads `app_admin@linux`. That's not your name. `app_admin` is the staging-worker service account on Halton Bank's jumphost — the account whose password Daniel committed to `creds.txt` and which Halton Bank's ops team never rotated. You are logged in as a *service identity*, on a *production bastion*, at a *client*, using *leaked credentials*. That sentence is the threat model of this entire level.

Three layered failures put you here, and they're worth naming explicitly before the technical content starts:

1. **Daniel's CWE-798 (Use of Hard-coded Credentials)** — covered in level0. The credential lived in a plaintext file on a workstation.
2. **The Halton-side credential lifecycle failure** — the password Daniel had at engagement-start in early 2024 is the same password live in March 2026. Two-plus years without rotation on a service-account credential that crosses the Driftwood/Halton trust boundary.
3. **Halton's service-account configuration anti-pattern** — and this one is on the client side: `app_admin` has `/bin/bash` as its login shell rather than `/usr/sbin/nologin` or `/bin/false`. Halton's ops team configured the staging service account with a login shell "for debugging" two years ago. That configuration choice means the leaked credential isn't just a database credential — it's an interactive-shell credential. A real attacker who recovered `please-rotate-me` from a `creds.txt` somewhere is exactly where you are right now.

The MSA between Driftwood and Halton contractually requires Driftwood to surface any client-environment finding within 24 hours of discovery. The conversation Priya is going to have with Halton's ops lead tomorrow morning is going to be uncomfortable: *"You gave a service account an interactive shell, your former Driftwood contractor left the password in cleartext on his workstation, and the same password still works two years later."* All three failures contributed; remediation has to address all three.

Halton Bank is GLBA-covered (Gramm-Leach-Bliley Act Safeguards Rule, 16 CFR Part 314). The 2023 FTC amendments raised the bar for what counts as compliance — and a *production-database credential exposure* triggers the FTC's 30-day-from-determination notification clock if 500+ consumers' nonpublic personal information is potentially accessed. Halton processes deposits and loans for what's almost certainly hundreds of thousands of customers; the breach-math is unambiguous.

What you don't know yet, walking onto this box, is that the *production* database password lives in a properly locked-down systemd override file on this same machine — and that Daniel left a debug copy of that same override file in his home directory with default permissions. The properly-protected file is unreadable to you as `app_admin`. The debug copy isn't. The credential you're about to recover doesn't open the staging DB you came here through; it opens the *production* DB sitting behind it.

## §2 — The solve

Four commands. The Linux discipline is in reading the permissions column before the contents column.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level1@linux
level1@linux's password: please-rotate-me
app_admin@linux:~$
```

The password `please-rotate-me` is the credential you recovered from `creds.txt` at the end of `level0@linux`. The fact that it *works* — that nothing has rotated it, that no MFA stops you, that no anomaly-detection layer flagged the SSH from Driftwood's audit IP block — is the first finding of the level. The MSA-required quarterly credential rotation that Halton's ops team committed to in their last attestation cycle clearly did not happen.

### Step 2: Orient

```bash
app_admin@linux:~$ pwd
/home/app_admin

app_admin@linux:~$ whoami
app_admin
```

You're in `app_admin`'s home directory. The prompt confirms `app_admin@linux`, not `daniel@linux`. This is a *different shell context* than level0 — different identity, different host. Yesterday you were sitting on Daniel's offboarded laptop as Daniel's still-active local account; today you're sitting on Halton's jumphost as Halton's still-active staging service account. The threat-model difference matters: yesterday's exposure was an audit liability that hadn't yet been exploited; today's exposure *is being exploited* (by you, with authorization, as part of the engagement — but functionally identical to what an attacker would be doing).

### Step 3: Read the welcome briefing

```bash
app_admin@linux:~$ cat welcome.md
```

The welcome file explains the new commands you'll use today: **`ls -l`** (long format, adding permission and ownership columns) and **`ls -la`** (long format plus hidden files). It also walks through how to read the ten-character permissions string at the start of each `ls -l` line — file type, owner permissions (rwx), group permissions, other permissions. If you're new to Unix permissions, this is the time to read carefully. The level's entire technical content lives in noticing the difference between two specific permission strings: `-rw-------` (owner-only read) and `-rw-r--r--` (everyone read).

### Step 4: Read Daniel's handoff note

```bash
app_admin@linux:~$ cat handoff.md
```

This is Daniel's note to whoever rotates onto this account. Three things in it matter for today's solve:

1. *"The live production database password lives in `/etc/systemd/system/staging-worker.service.d/override.conf`. That file is owned by root and mode 600 — you can't cat it as app_admin. That's the correct configuration."* Daniel is acknowledging that the systemd override file is properly protected. He's also (helpfully, for the audit) documenting where the production credential actually lives.

2. *"Last November I was debugging a staging-worker outage and I needed to grep the env vars without sudo. So I cp'd a copy into my home directory and called it `staging-worker.env.bak`. I MEANT to delete it after the incident. I did not."* This is the entire finding, narrated by the engineer who committed it. The shadow copy exists at `~/staging-worker.env.bak` with default permissions — owner-readable, group-readable, world-readable.

3. *"The cron at 02:00 UTC runs `backup.sh` — that's mine. Don't disable it; Priya's pipeline depends on it."* Tangential to today's solve but worth noting — there's a `backup.sh` in the home directory that the cron runs as `app_admin`. We'll look at it briefly.

The handoff note is documenting the exact failure path. That's the consultancy version of helpful, and it's also the kind of internal evidence that defense counsel hates because it establishes that the engineer knew what they were doing was wrong.

### Step 5: Read the permissions column

```bash
app_admin@linux:~$ ls -la
total 64
drwxr-xr-x  4 app_admin app_admin  4096 2026-03-15 03:42 .
drwxr-xr-x  3 root      root       4096 2024-08-14 11:20 ..
-rw-------  1 app_admin app_admin   524 2026-03-15 02:01 .bash_history
-rwxr-xr-x  1 app_admin app_admin   612 2025-09-22 14:11 backup.sh
-rw-r--r--  1 app_admin app_admin  1956 2024-08-14 11:42 handoff.md
-rw-r--r--  1 app_admin app_admin  4521 2026-02-08 09:17 lessons-learned.md
-rw-------  1 root      root        287 2024-08-14 11:20 staging-worker.env
-rw-r--r--  1 app_admin app_admin   342 2025-11-12 22:18 staging-worker.env.bak
-rw-r--r--  1 app_admin app_admin  1842 2024-08-14 11:42 welcome.md
```

The cross-reference between two specific lines is the finding:

- `-rw-------  1 root      root        287 ... staging-worker.env`
- `-rw-r--r--  1 app_admin app_admin   342 ... staging-worker.env.bak`

The first file is the legitimate copy of the systemd override — owned by root, mode 600 (owner can read and write; group and other can do nothing). The presence of a root-owned mode-600 file in `app_admin`'s home is unusual but explainable: when Daniel did the `sudo cp` of the systemd override into `~`, the source file's ownership was preserved by default, but the destination filename was different. (Or the `cp -p` preserve-ownership flag was used. Or the file was placed there by a separate sudo command — the exact mechanism doesn't matter for the finding.)

The second file — the `.bak` — is the *shadow copy*. Owned by `app_admin`, mode 644 (owner read-write, group read, other read). The world-readable mode is Apache `umask 022` default behavior; when Daniel chowned the copy to himself with `sudo chown app_admin:app_admin staging-worker.env.bak`, the file's mode wasn't changed and stayed at the default Daniel's session umask produced. This is the CWE-732 instance — *Incorrect Permission Assignment for Critical Resource* — and it's the entire technical content of the level.

### Step 6: Confirm the legitimate file is locked down

```bash
app_admin@linux:~$ cat staging-worker.env
cat: staging-worker.env: Permission denied
```

The kernel's file-system layer rejects the read. As `app_admin` (not root, not in the root group), you have no permission to read a mode-600 root-owned file. This is the access-enforcement layer working *exactly as designed*. NIST 800-53 AC-3 *(Access Enforcement)* is being honored here; the legitimate file's protection is operationally correct. Halton's ops team did the right thing for this specific file at this specific location.

### Step 7: Read the shadow copy

```bash
app_admin@linux:~$ cat staging-worker.env.bak
# Halton Bank — staging-worker production override
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
```

There it is. **`Halton-2024-Q3!`** is the production database password for Halton Bank — the credential the legitimate systemd-override file was designed to protect. The shadow copy carries the same data the protected file carries; the permission misconfiguration on the shadow copy means *the protection on the legitimate file is meaningless*. The lock on the front door doesn't matter when there's a key under the mat.

A few additional things to notice in the file content:

- `DB_STAGING_PASS=please-rotate-me` — the same staging credential you used to enter this box, confirming the credential chain.
- `DB_PROD_HOST=prod-db.halton.internal` — the production database hostname. The fact that you can reach `prod-db.halton.internal` from this jumphost is a *separate* network-segmentation question (Halton's production DB should arguably not be reachable from a staging-worker jumphost at all), but it's adjacent to today's finding rather than the finding itself.
- `DB_PROD_USER=svc_prod_worker` — a different service account from `app_admin`. The prod database has its own service identity, presumably more tightly scoped.
- The two `# TODO:` comments at the top of the file confirm Daniel knew the file shouldn't be there and that the credentials it contained needed rotation. Both intents were documented; neither was acted on. The handoff note we read in Step 4 is the audit trail of *why* the file was created (the November debugging incident); these TODO comments are the audit trail of *Daniel knew it was a problem and didn't fix it*.

### Step 8: Confirm via `.bash_history`

```bash
app_admin@linux:~$ cat .bash_history
ls -la
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
```

The history confirms the exact sequence of commands that produced the finding:

1. `sudo cat` the legitimate override file (confirms Daniel had root via sudo on this box — a separate AC-6 *Least Privilege* finding, since the staging service account shouldn't have unrestricted sudo).
2. `sudo cp` the override file into `~/staging-worker.env.bak` (the shadow copy is created).
3. `sudo chown` the copy to `app_admin:app_admin` (the ownership change; mode stayed at the umask default of 644).
4. `grep DB_PROD_PASS staging-worker.env.bak` (Daniel reading the credential out of the shadow copy — the very pattern the finding now exposes to anyone with `app_admin` access).
5. `psql -h prod-db.halton.internal -U svc_prod_worker` (Daniel actually using the recovered prod credential to authenticate against the production database).

That last command line is worth its own paragraph. The shell history doesn't include the password — but it shows Daniel using `svc_prod_worker` against the production database, which is the exact pattern a hostile actor with the leaked credential would execute. The credential leak isn't theoretical; it has been demonstrated to work, on the production system, by the engineer who later left the credential in a readable file.

### Step 9: Look at backup.sh (briefly)

```bash
app_admin@linux:~$ cat backup.sh
#!/bin/bash
# Halton-staging schema backup. Daniel's hand-rolled job.
# Runs at 02:00 UTC via root crontab. Output ships to the bastion
# via ssh — Priya's key is on the receiving end.

set -euo pipefail

# Load the staging-worker environment override so we have the DB
# connection string. The override file is the canonical place
# Halton's ops team stashed the credentials.
source /etc/systemd/system/staging-worker.service.d/override.conf

OUT="/tmp/halton-staging-$(date +%F).sql.gz"

pg_dump -h "$DB_STAGING_HOST" -U "$DB_STAGING_USER" halton_staging \
  | gzip \
  > "$OUT"

scp "$OUT" halton-bastion:/var/backups/halton-staging/
rm -f "$OUT"
```

`backup.sh` `source`s the systemd override file at runtime. It runs from the root crontab, so it has the privilege to read the mode-600 override. The script itself is documented and well-formed — it's not a finding. It's worth noting because:

- It explains the legitimate purpose of the staging-worker override file (the script needs database connection info, sourced from the override at script start).
- It demonstrates the *right* pattern for accessing the override: a privileged-context script `source`ing the file with proper permissions, rather than a debug copy with loosened permissions.
- It's the artifact that would be missed if Halton's remediation team simply deletes the override file. The legitimate use case persists; the remediation has to be *move the credential to a secrets manager, not delete the override*.

### Step 10: The breadcrumb (future game-world)

`Halton-2024-Q3!` is the breadcrumb credential for a future `level2@linux`. That level hasn't been built yet — but the in-game post-mortem you'll read after this walkthrough notes that a real attacker who recovered this credential would pivot to `prod-db.halton.internal` directly, which is the threat model `level2@linux` will eventually explore. The credential chain is in place; the level content is forthcoming.

For now, the walkthrough ends at *the finding*. Halton's ops team needs to rotate the production credential immediately, delete the shadow copy, audit `app_admin`'s sudo configuration to remove the unrestricted root access that allowed the original `sudo cp`, and migrate the credential management to a secrets backend (HashiCorp Vault, AWS Secrets Manager, etc.).

### If you got stuck

- If `ls -la` showed the files but you couldn't tell which one was the shadow copy, look at the **ownership columns** (`app_admin app_admin` vs `root root`) and the **permission strings** (`-rw-r--r--` vs `-rw-------`). The level's pedagogical point is that *those two columns are where the finding lives* — not the filename, not the size, not the date.
- If `cat staging-worker.env.bak` showed only the staging credentials (not the prod credentials), you may be running an older D3CYPH3R build. Refresh and retry; the file content should match the snippet above.
- If you tried `cat staging-worker.env` and it succeeded with content, the permission engine in your local build may be misconfigured. The mode-600 file should reject the read. Re-clone or re-deploy.
- If you tried `ssh level2@linux`, that level isn't built yet — there's no entry point in the lobby's `LEVELS` map for it. The credential is staged for a future build; no level2 is currently solvable.

## §3 — The vulnerability

It is tempting to summarize this level as "Daniel left a debug copy of a sensitive file." That's true and it's the headline, but it under-specifies the failure. There are four distinct vulnerabilities stacked here, and the right remediation has to address all four.

**Failure 1 — `app_admin` was granted a login shell.** This is the root failure that put any of this in play. The staging-worker service account, by every modern best practice (and by the explicit guidance of the CIS Linux Benchmark, the NIST 800-53 IA-2 Identification and Authentication enhancements, and every Linux-hardening guide ever published), should have `/usr/sbin/nologin` or `/bin/false` as its login shell. A service account exists to run a specific daemon (the staging-worker systemd service); it does not need to be SSH-able by any human. Halton's ops team configured `app_admin` with `/bin/bash` "for debugging" — and once the bash shell exists, anyone who recovers the credential can SSH in. The remediation is *remove the login shell on the service account*, full stop.

**Failure 2 — `app_admin` had unrestricted `sudo` access.** The `.bash_history` shows Daniel running `sudo cat`, `sudo cp`, `sudo chown`, `sudo systemctl restart` against the systemd override. For a *staging-worker service account*, even one that mistakenly has a login shell, having unrestricted `sudo` is a separate AC-6 *Least Privilege* failure. The legitimate sudo needs for the staging-worker daemon are narrow — restart the service, read its logs — and should be expressed as specific `sudoers.d` rules permitting `systemctl restart staging-worker` and `journalctl -u staging-worker` only. The unrestricted `ALL=(ALL) ALL` line that almost certainly exists in `/etc/sudoers.d/app_admin` is what enabled Daniel to make the shadow copy in the first place. Without that, the entire incident doesn't happen.

**Failure 3 — The systemd override file was placed where it could be sudo-copied to a less-privileged location.** This is more nuanced and more philosophical. The legitimate systemd override file is in the canonical systemd-override location and is properly locked down. But it's *on the same filesystem* as `app_admin`'s home directory. A privileged `cp` from one location to the other is one command. The structural fix — beyond fixing the immediate sudo and shell issues — is to move the credential out of the local filesystem entirely. **Secrets managers (HashiCorp Vault, AWS Secrets Manager, Doppler, 1Password Secrets Automation, Akeyless, Infisical)** retrieve credentials at runtime, never write them to disk in the running container/host, and audit every access. The staging-worker daemon's systemd unit can fetch the credential from a vault at start, hold it only in process memory, and never write it to a file at all. The shadow-copy attack surface disappears entirely.

**Failure 4 — The credential was never rotated.** The `staging-worker.env.bak` file has a `TODO` comment from Daniel acknowledging that the prod credential needs to be rotated. The file's date in the listing is November 2025 — five months before today's audit. The credential `Halton-2024-Q3!` is, by its own name, dated to Q3 of 2024. That makes the credential approximately 18 months old as of today. NIST SP 800-63B Rev 4 explicitly *deprecates* forced periodic rotation absent evidence of compromise — but this credential has evidence of compromise (the shadow copy has been world-readable to anyone on this jumphost for five months), and the modern best practice is *event-driven rotation* triggered by breach indicators. The breach indicator is the shadow copy itself.

Each of these four failures is independently a finding. Fixing only one — say, deleting the shadow copy — leaves the sudo configuration and the login-shell configuration intact, which means *the next engineer in this role makes a different but isomorphic mistake six months from now*. The remediation needs to address all four, and the audit deliverable needs to surface all four to Halton's ops lead.

## §4 — Real-world parallels

Three named, well-documented incidents where a "shadow copy of a properly-protected secret" or a "developer-convenience cache of credentials" produced significant downstream consequences. Each was a major industry event, each is documentable from primary sources, and each demonstrates that the specific pattern of *"the engineer copied the credential somewhere convenient and forgot"* is one of the most repeated patterns in modern credential-exposure incidents.

### LastPass — November 2022 / January 2023 breach pair

LastPass disclosed an initial breach in late August 2022 involving compromised developer credentials and access to portions of its development environment. The incident appeared, at the time, contained. Three months later, in November 2022, LastPass disclosed a *second* incident — and the second incident is the one that matters for level1@linux's lesson.

The November 2022 breach, formally disclosed across multiple updates through January and February 2023, involved an attacker leveraging information stolen in the first August 2022 incident to target *a single senior DevOps engineer's home computer*. The attacker exploited a vulnerable Plex Media Server installation on the engineer's home machine (CVE-2020-5741) to gain code execution, then installed a keylogger that captured the engineer's LastPass master password during their day-to-day work. With that master password — which protected a corporate LastPass vault — the attacker accessed *production decryption keys for LastPass's customer-data backups*. The corporate vault contained, per LastPass's January 2023 customer notice, "decryption keys needed to access AWS S3 LastPass production backups, other cloud-based storage resources, and some related critical database backups."

The exact details are extraordinary for how directly they parallel level1@linux's finding. A *senior DevOps engineer* — exactly the role Daniel held — kept *production credential material* in a *personal location* (home computer's password manager) *for convenience* (so they could do their job without having to re-authenticate every time). The credential material was *theoretically protected* (master password + LastPass vault encryption) but the *protection surface had been extended* to a less-secure location (the engineer's home machine with a vulnerable Plex installation). The attacker didn't have to defeat LastPass's vault encryption — they defeated the *less-protected location where the engineer had cached access*.

LastPass's response cycle ran through 2023. Customer trust took years to recover; the company's market position in the consumer password-manager space declined materially. Multiple class-action lawsuits were filed; a consolidated multidistrict litigation settled in late 2024 for an undisclosed amount. The longer-arc lesson — explicit in LastPass's own retrospectives — was that *credential-handling discipline has to apply uniformly across every location a credential can exist*, not just the canonical protected location.

For Halton's situation, the parallel is exact in shape if smaller in scale. Daniel kept production credential material in a less-protected location (his home directory on the jumphost) for convenience (so he could `grep DB_PROD_PASS` without `sudo`). The credential was *theoretically protected* by the systemd-override file's mode 600. The *protection surface had been extended* to a less-secure location. An attacker (or in this case, today's audit) didn't have to defeat the systemd-override protection — they defeated the *less-protected location where the engineer had cached access*. Same shape, smaller blast radius.

### Uber — September 2022 (the PowerShell-script angle)

The September 2022 Uber breach is cited in the level0@linux walkthrough for the broader credential-stuffing initial-access vector. The specific aspect that matters for level1's lesson is the *lateral-movement step*: after the attacker established VPN access via MFA fatigue, they found a **PowerShell script on Uber's internal SMB network share** that contained hardcoded administrator credentials for Thycotic, Uber's privileged-access-management product.

The PowerShell script was, by every account in the post-incident analysis, a *developer-convenience artifact*. Some engineer at Uber had needed to interact with the Thycotic PAM system programmatically, found that interactive authentication was inconvenient for whatever automation they were building, and cached the admin credential in a PowerShell script on a network share their team could access. The script presumably had a legitimate operational purpose at the time it was written. The credential was *theoretically protected* — Thycotic's whole reason for existing is to protect privileged credentials. The *protection surface had been extended* to a less-secure location (an SMB network share, world-readable inside Uber's corporate network). The attacker didn't have to defeat Thycotic's vault; they grabbed the cached copy.

Industry post-incident analysis of the Uber breach mapped the lateral-movement step to **MITRE ATT&CK T1552.001 (Unsecured Credentials: Credentials In Files)** — the canonical technique ID for "credentials cached in operational files an attacker can read after gaining file-system access." The mitigations the security-press post-mortems converged on are exactly the controls level1@linux's remediation list specifies: secrets-management deployment with no cached credentials, file-integrity monitoring on operational scripts, employee training on the difference between *the credential's canonical protected location* and *cached copies thereof*.

For Halton, the structural parallel is identical. Daniel's `staging-worker.env.bak` is the same artifact category as Uber's PowerShell script — a convenience cache of credentials whose canonical copy is properly protected. The blast radius differs (Uber's was an enterprise-PAM-admin credential; Halton's is a database service-account credential), but the mechanism and the remediation are the same.

### Snowflake customer breach campaign — April–July 2024

In April 2024, a threat-actor group (initially identified as ShinyHunters, later linked to UNC5537) began compromising Snowflake customer accounts at scale by exploiting credentials that had been **cached on infected employee or ex-employee devices** sometimes years prior. The pattern, per Mandiant's published incident reports and Snowflake's own customer advisories, was consistent: a current or former employee of a Snowflake-customer organization had at some point cached their Snowflake credentials in a browser, a credential manager, or a desktop application. That device subsequently became infected with **info-stealer malware** (Lumma, RisePro, RedLine, Vidar — multiple families involved across the campaign). The stealer exfiltrated the cached credentials to the threat actor's collection infrastructure. The threat actor then used the cached Snowflake credentials — sometimes 3-5 years after the original caching event — to access the customer's Snowflake data warehouse and exfiltrate data.

The scale was extraordinary. Confirmed compromised Snowflake customers included AT&T (~110 million wireless customers' call and text records, disclosed July 2024 — distinct from the separate ~73M-record AT&T breach disclosed earlier the same year), Ticketmaster (~560 million records), Santander Bank, LendingTree, Advance Auto Parts, Neiman Marcus, and dozens of others. Mandiant's published advisory reported approximately **165 Snowflake customer organizations** notified as potentially exposed; the aggregate count of affected individual records across those customers reached well into the hundreds of millions.

The specific structural lesson for level1@linux: **credentials cached outside their canonical protected location can compromise the canonical system years after the caching event.** Daniel's `staging-worker.env.bak` was created in November 2025. We're auditing in March 2026 — five months later. The credential `Halton-2024-Q3!` has been in a world-readable file on a jumphost for five months. If any of the people with `app_admin` access during that window had a compromised device, or used the credential value in any other context (typed into an SSH session that was being keylogged, copied into a clipboard manager that was syncing to a compromised cloud account, etc.), the credential is potentially out in the wild already. The Snowflake-campaign mechanism is exactly this: cached credentials, long-tail compromise window, mass exploitation.

The Snowflake campaign also drove a structural shift in how the industry thinks about credential-event timelines. The 2024 incident-response retrospectives almost universally concluded that *credential rotation cadence cannot rely on "we'll know when there's a breach,"* because the breach detection itself is downstream of the credential's exposure — sometimes by years. The modern best practice that emerged is **continuous credential-rotation automation** (Vault, Secrets Manager, etc.) combined with **endpoint detection that flags credentials moved out of their canonical protected location**.

For Halton, the takeaway is that today's discovery of the shadow copy doesn't tell us *when* the credential was first exposed to potential capture — only that it has been world-readable for at least five months. The remediation has to assume the credential is compromised regardless of whether we have evidence of specific exploitation.

## §5 — Frameworks, deep dive

The in-game post-mortem cites five framework controls. Each is expanded below: what the control actually requires, what audit evidence proves it's in place, and what auditors flag when it's not.

### CWE-732 — Incorrect Permission Assignment for Critical Resource

**CWE-732** is the precise weakness category for level1@linux's finding. The CWE catalog entry describes the weakness as: *"The product specifies permissions for a security-critical resource in a way that allows that resource to be read or modified by unintended actors."* The shadow-copy pattern — a file containing security-critical data (the production database password) with overly permissive read access (world-readable, mode 644) — is the textbook CWE-732 instance.

CWE-732 has been in the catalog since the early CWE program (entry created in 2006) and was on MITRE's Top 25 Most Dangerous Software Weaknesses lists in 2020 and 2021; it has since dropped off the annual Top 25 but remains an actively-maintained canonical entry with frequent real-world mappings. Its mapping status is **ALLOWED-WITH-REVIEW** (the second-strongest CWE mapping tier — MITRE's note is that the entry can be used to map real-world vulnerabilities but warrants careful review because it is frequently misused for authorization rather than permission-assignment weaknesses). Unlike CWE-200 or CWE-668 (both marked Discouraged for direct vulnerability mapping), CWE-732 remains valid as a mapping target — and for the formal remediation report to Halton, it is the canonical citation.

The CWE entry also names common mitigations: *"When using a critical resource such as a configuration file, check to see if the resource has insecure permissions, e.g., world-writable... If insecure permissions are detected, warn the user and/or exit the program."* The defender's playbook in §7 expands on these.

Related CWEs worth knowing in the same family: **CWE-276 (Incorrect Default Permissions)** is the specific variant where the *default* permissions at file-creation time are wrong; **CWE-281 (Improper Preservation of Permissions)** covers the case where a tool that copies a file fails to preserve the source's restricted permissions; **CWE-732** is the umbrella for both. For the Halton finding, CWE-281 specifically applies — Daniel's `cp` did not preserve the source's mode 600, and the destination defaulted to the session umask's 644.

### NIST SP 800-53 Rev. 5 — AC-3, AC-6, SC-28

NIST SP 800-53 Rev. 5, currently at **Release 5.2.0 (August 27, 2025)**, is the federal-government control catalog. Three controls apply directly to the Halton finding:

**AC-3 — Access Enforcement.** The information system must enforce approved authorizations for logical access to information and system resources. **The legitimate `staging-worker.env` file at mode 600 is AC-3 working as designed** — the access-enforcement layer correctly denies the `app_admin` user's read attempt. The control failure is not on the legitimate file; it's on the shadow copy, where the access-enforcement layer is *configured to permit the read* because the file's mode is 644. AC-3 requires the access-enforcement decision to be *correct for the resource's sensitivity*, not just *enforced consistently*. The shadow copy's permission configuration produces an AC-3 failure because the enforcement decision (permit read by any user) is wrong for the resource's sensitivity (production credential material).

**AC-6 — Least Privilege.** Subjects should have only the privileges necessary to perform their authorized tasks. Two AC-6 failures stack here. First, `app_admin` had no legitimate need to be able to read production credential material — its job is to run the staging-worker daemon, which accesses the staging DB, not the prod DB. The shadow copy gave `app_admin` access it should not have had. Second, `app_admin` had unrestricted sudo, which is itself an AC-6 violation — the staging service account's legitimate sudo needs are narrow (restart its own service, read its own logs) and should be scoped accordingly.

AC-6 has 13 control enhancements; **AC-6(2) — Non-Privileged Access for Nonsecurity Functions** is particularly relevant. It requires that privileged accounts be used *only* for security functions, and that non-security tasks be performed with non-privileged accounts. Daniel's `sudo cp` of the systemd override into his home directory was a non-security task (debugging convenience) performed via a privileged mechanism (sudo). That's exactly the AC-6(2) pattern.

**SC-28 — Protection of Information at Rest.** Information at rest must be protected for confidentiality and integrity. SC-28 specifies two implementation mechanisms: cryptographic protection (SC-28(1)) or physical security controls. Flat-file storage of unencrypted credentials in any location — protected or otherwise — fails SC-28 unless the file is on encrypted storage. The legitimate systemd override is technically also a flat file storing unencrypted credentials; if the host's filesystem isn't encrypted-at-rest, that's its own SC-28 finding. The shadow copy compounds the issue by exposing the same content at less-restrictive permissions.

The right SC-28 remediation isn't to add more files at tighter permissions — it's to remove the credential from at-rest filesystem storage entirely. Secrets managers retrieve credentials at runtime, hold them only in process memory, and never write them to disk. That's the SC-28-compliant pattern; the override-file pattern (even at mode 600) is a compromise that satisfies SC-28 only conditionally.

### CIS Critical Security Controls v8.1 — Safeguards 3.3 and 4.7

The Center for Internet Security publishes the **CIS Critical Security Controls v8.1** (published 2024, adding alignment with NIST CSF 2.0's *Govern* function but preserving v8 control and safeguard numbering). Two safeguards apply directly:

**3.3 — Configure Data Access Control Lists.** Implementation tier IG2 (the intermediate tier). The safeguard requires data access controls on local file systems, databases, and application servers based on the principle of least privilege. The shadow-copy finding is exactly what 3.3's remediation is designed to catch — file-system access controls should be tight enough that a casual `cp` doesn't create a less-protected copy of sensitive data.

**4.7 — Restrict access to administrative interfaces.** Implementation tier IG2. The safeguard covers restricting interactive access to administrative interfaces — including, by reasonable reading, *interactive shell access for service accounts*. `app_admin`'s `/bin/bash` login shell is exactly the configuration this safeguard targets for restriction. The modern best practice — and the safeguard's intended remediation — is that administrative interfaces require named-user authentication with MFA, not shared service-account credentials with interactive shells.

### OWASP Top 10:2025 — A02:2025 Security Misconfiguration (was A05:2021)

The current OWASP Top 10 edition is **OWASP Top 10:2025**, finalized in January 2026. The Halton finding maps to **A02:2025 — Security Misconfiguration**, which moved up from the 2021 A05 slot specifically because security-misconfiguration findings continued to dominate web-application and infrastructure breach reports in the data underlying the 2025 edition.

A02:2025's category description includes a sub-pattern that directly captures Halton's situation: *"Files or directories with overly permissive access permissions"* and *"Default accounts and passwords still enabled."* Both apply — the shadow copy is the overly-permissive file, the credential's two-year non-rotation aligns with the spirit of the default-password sub-pattern (a credential that has not been changed since initial setup).

The OWASP 2025 recommended mitigation for A02 is *a documented hardening process applied identically across environments, enforced via configuration-as-code in CI/CD, with automated configuration scanning detecting drift.* For Halton, that translates to: Ansible / Chef / Puppet (or AWS Systems Manager Configuration Compliance, or equivalent) managing file permissions across the production fleet, with continuous monitoring detecting any file in a sensitive directory whose mode drifts from the documented baseline.

### GLBA Safeguards Rule — 16 CFR Part 314 §§ 314.4(c)(1)

The Gramm-Leach-Bliley Act Safeguards Rule (16 CFR Part 314) applies to Halton as a financial institution. The 2023-effective FTC amendments raised the bar for what counts as compliance. **§ 314.4(c)(1) — Access Controls** specifically requires *"placing access controls on customer information systems, including controls to authenticate and permit access only to authorized users, and controls to monitor activity, detect unauthorized access, and prevent unauthorized access."*

The Halton finding implicates 314.4(c)(1) on every reading. The shadow copy of the production-database credential is *unauthorized access to customer information systems' authentication material*. The fact that the access has not yet been demonstrably exploited (no smoking-gun log entry of an unauthorized `psql` connection) doesn't satisfy the control — the control requires *controls to monitor activity, detect unauthorized access, and prevent unauthorized access*, and Halton's posture clearly didn't *prevent* the shadow-copy creation, didn't *detect* it for five months, and (we'd have to check) probably isn't *monitoring* file-system events on jumphosts at the granularity that would have caught it.

The Safeguards Rule's 2023 amendments also added an explicit breach-notification requirement: financial institutions must report a security event affecting 500+ consumers' nonpublic personal information to the FTC within 30 days of determining that such an event has occurred. Halton has hundreds of thousands of customer accounts; if the formal investigation concludes that the production-database credential exposure created a reasonable likelihood of NPI access, the 30-day clock starts at *that determination*, not at the discovery of the shadow copy. The determination process is Halton's general counsel's work, not Driftwood's — we surface the finding; they decide whether the threshold is crossed.

## §6 — Cert exam relevance

Equal-depth coverage for the four certifications cited in the in-game post-mortem.

### CompTIA Security+ — current version SY0-701

CompTIA Security+ SY0-701 (current; superseded SY0-601 November 2023, SY0-601 retired July 31, 2024). The level1@linux material maps directly to **Domain 3 — Security Architecture**, particularly objective 3.1 (Compare and contrast security implications of different architecture models — specifically the *hardening* sub-domain that covers file-system permissions, default account management, and access-control configuration).

Security+ tests the recognition that *the correct response to "this credential is exposed in a less-protected location" is rotation plus structural fix, not just deletion of the exposed copy.* Expect a question like:

> A security analyst discovers a file on a production jumphost containing a copy of a database credential that is properly protected (mode 600, root-owned) in its canonical location elsewhere on the system. The discovered copy is at mode 644 and owned by a service account. Which of the following actions should the analyst recommend FIRST?
>
> A. Delete the exposed copy and restore the canonical file's permissions
> B. Rotate the database credential, delete the exposed copy, audit the sudo configuration that allowed its creation, and migrate credential storage to a secrets manager
> C. Notify the database administrator and request additional audit logging on the canonical file
> D. Update the security awareness training material to include the "shadow copy" anti-pattern

The trap is A (too narrow — addresses the immediate exposure but not the root causes). C is reasonable but not *first*. D is long-term. **B** is correct — the multi-layer remediation is what Security+ expects at the analyst level.

### (ISC)² Certified in Cybersecurity (CC) / SSCP — Access Control Fundamentals

The (ISC)² Certified in Cybersecurity (CC) and the more-advanced Systems Security Certified Practitioner (SSCP) certifications both cover the fundamentals of access control, including the Unix permission model (owner/group/other × read/write/execute). The shadow-copy pattern is the textbook teaching example for the *discretionary access control (DAC)* model that Unix permissions implement.

The CC and SSCP curricula specifically test:

- The mechanics of how the kernel evaluates a file-access request (UID match → owner permissions; primary or supplementary GID match → group permissions; otherwise → other permissions).
- The default umask behavior (typically 022 on modern Linux distributions, producing default file modes of 644 and default directory modes of 755).
- The conditions under which a tool that copies a file does or doesn't preserve permissions (`cp` without `-p` does not preserve; `cp -p` preserves; `cp -a` is `cp -p -R --preserve=all` shorthand).

For the SSCP candidate specifically, the Halton scenario is a high-value worked example: the legitimate `cp` operation that Daniel ran (`sudo cp /etc/systemd/.../override.conf /home/app_admin/staging-worker.env.bak`) without the `-p` flag is *exactly* the kind of operation that creates a CWE-732 finding. The remediation discipline — *every operation that handles sensitive data has to be deliberate about permission preservation* — is what SSCP-level competence looks like.

### CISSP — Domain 5 (IAM), Domain 7 (Security Operations)

CISSP (current 2024 CBK refresh, next refresh expected 2027) covers the Halton scenario across two domains.

**Domain 5 — Identity and Access Management.** Discretionary access control (DAC) is the Unix permission model in CISSP parlance. The Domain 5 curriculum specifically covers *the policy and governance layer above the permission mechanics* — how an organization establishes which roles can access which data, how those role-to-data mappings are enforced via permission-management automation, how exceptions are documented and reviewed, how the access-control program produces audit evidence.

**Domain 7 — Security Operations.** The detective and responsive controls around the access-control program. Specifically, *file-integrity monitoring* (the FIM tools — AIDE, OSSEC/Wazuh, Tripwire, Microsoft Defender for Endpoint's FIM capability — that would have alerted on the creation of the shadow copy), *log review cadence* (the SOC analyst process that should have caught the audit-log entries showing the sudo cp + chown sequence), and *incident response* (the procedural process Halton would invoke once the finding lands).

CISSP question framings are oblique. They reward thinking like a CISO or a senior architect, not like a Linux admin. **The "best answer" is usually the one that addresses governance and durable institutional control, not the one that solves the immediate technical problem.**

> As the CISO of a financial institution that has just been informed by a third-party auditor that a senior contractor left a debug copy of a production-database credential in a service-account home directory on a production jumphost — and that the credential has been world-readable for five months — which of the following should be your PRIMARY focus over the next 90 days?
>
> A. Mandatory rotation of all production credentials touched by the affected contractor during their tenure
> B. Implementation of a secrets-management platform with mandatory integration into the operational deployment pipeline, plus continuous file-integrity monitoring on sensitive paths with automated alerting
> C. Termination review for the responsible contractor and updates to the contractor onboarding security training
> D. Engagement of outside counsel to assess GLBA Safeguards Rule notification obligations

The CISSP answer is **B**. A is necessary but tactical. C is punitive without preventive value at the institutional level. D is required immediately (Halton's outside counsel is in the room within hours) but isn't a *90-day strategic focus*. **B** is the durable institutional control — the secrets-management deployment plus FIM is what prevents *the next* shadow copy from being created and undetected, regardless of which contractor is on the keyboard.

### OSCP / PEN-200 — Privilege Escalation via Misconfigured Files

The Offensive Security Certified Professional is the most-recognized hands-on offensive certification. The exam is a 24-hour practical hands-on test against a set of target machines, with a separate report due afterward.

The OSCP curriculum specifically teaches **Linux privilege escalation via misconfigured files** as a standalone module — and the level1@linux scenario is the textbook entry-level example. The OSCP candidate's standard post-compromise enumeration sweep includes:

```bash
# Look for files with sensitive content in unusual locations
find /home -type f \( -name "*.env*" -o -name "*config*" -o -name "*backup*" -o -name "*creds*" -o -name "*pass*" -o -name "*.bak" -o -name "*.tmp" \) 2>/dev/null
# Look for files readable by the current user containing credential-like patterns
grep -r -i "pass\|pwd\|secret\|api[_-]key\|token" /home 2>/dev/null | head -50
# Look at sudoers configuration
sudo -l 2>/dev/null
# Look at command history for any user whose history is readable
cat /home/*/.bash_history 2>/dev/null
# Look for SUID binaries that might allow privilege escalation
find / -perm -u=s -type f 2>/dev/null
```

The Halton scenario specifically demonstrates two patterns the OSCP candidate would recognize immediately:

1. **The shadow-copy pattern** (CWE-732): credentials in unusual locations with default permissions. The `find` and `grep` one-liners above are the standard tools.
2. **The credential-chain pattern**: the credential recovered at one privilege level (`app_admin` in this case) unlocks a higher privilege level (`svc_prod_worker` on the production database). The OSCP exam scoring explicitly rewards the lateral-movement pivot — finding the credential is worth points; using it to access the next system is worth more points.

The OSCP curriculum also covers the *defender's* side of the same skill. The defender's enumeration is identical to the attacker's enumeration; the only difference is what happens with the finding. An OSCP-level pentester finding the Halton shadow copy in a real engagement would document it in the report and continue the engagement; a SOC analyst doing routine system audit finding the same thing would surface it to the incident-response cycle.

## §7 — What a defender does

The Halton scenario is not theoretical. Every defender working at a financial institution — and every IT and security engineer at any organization with production-bastion infrastructure — has to navigate this category of finding. Here's what the work looks like.

**1. For this specific finding, today (within 24 hours per the MSA).**

- Rotate `Halton-2024-Q3!` immediately. The credential is compromised regardless of whether we have evidence of specific exploitation. Issue a new value, deploy it to every service that uses it (starting with the staging-worker daemon's systemd override), and revoke the old value via PostgreSQL's `ALTER USER svc_prod_worker WITH PASSWORD '<new>'`.
- Delete the shadow copy: `rm /home/app_admin/staging-worker.env.bak`. Before the `rm`, preserve a forensic copy to an evidence-retention store (the file's hash, timestamps, and permissions chain matter for the formal investigation).
- Audit the access logs. Halton's PostgreSQL audit logging (if `pgaudit` is enabled — and if it isn't, that's its own finding) should be reviewed for any `svc_prod_worker` authentication from a non-staging-worker source IP during the five-month window the shadow copy existed.
- Audit `app_admin`'s `~/.bash_history` and the system's audit-log subsystem for any other suspicious activity during the same window.
- Disable `app_admin`'s interactive shell. `usermod -s /usr/sbin/nologin app_admin` is the immediate command; the systemd-service daemon doesn't need an interactive shell to function.
- Restrict `app_admin`'s sudo configuration. The current unrestricted `app_admin ALL=(ALL) ALL` becomes a narrowly-scoped allowlist: `app_admin ALL=(root) NOPASSWD: /bin/systemctl restart staging-worker, /bin/systemctl status staging-worker, /usr/bin/journalctl -u staging-worker`.

**2. For Halton's broader credential-handling posture, this quarter.**

- Stand up a **secrets-management platform**. AWS Secrets Manager, HashiCorp Vault, Doppler, 1Password Secrets Automation, Bitwarden Secrets Manager, Akeyless, Infisical — any of them. Migrate every production credential currently in flat-file storage (systemd overrides, `.env` files, Kubernetes Secrets stored unencrypted, etc.) to the vault. Update the application/systemd configurations to fetch from the vault at process start.
- Enable **PostgreSQL credential-rotation automation** integrated with the secrets manager. AWS Secrets Manager has built-in rotation for RDS; equivalent automation exists for HashiCorp Vault's database secrets engine. The end state is *credentials rotate on a scheduled cadence (e.g., 30 days) without engineering intervention.*
- Deploy **file-integrity monitoring** on production systems. AIDE, OSSEC/Wazuh, or Microsoft Defender for Endpoint's FIM capability watching sensitive paths — `/etc/`, `/home/*/.ssh/`, `/etc/systemd/system/*.d/`, the secrets-manager agent's local cache directory. The FIM produces an alert when anything in scope changes; the alert routes to the SOC for triage.
- Configure **`auditd` to log sudo operations involving file copies of sensitive files**. The Linux audit subsystem can match on specific syscalls (`open`, `read`, `write`) against specific paths. Adding a rule like `-w /etc/systemd/system/staging-worker.service.d/ -p rwa -k systemd_override_access` produces an audit-log entry every time the directory is touched. The audit logs then flow to a SIEM where they're correlated with sudo-session metadata.

**3. For Halton's broader service-account hygiene, this quarter.**

- **Inventory all service accounts** across the production fleet. For each, document: the daemon it exists to run, the legitimate sudo needs, the legitimate file-system access needs, and the current login-shell configuration. The output is a service-account inventory artifact that the next SOC 2 / GLBA / NYDFS audit can reference.
- **Restrict login shells on service accounts.** Default to `/usr/sbin/nologin` or `/bin/false`. Exceptions documented and reviewed.
- **Scope sudo permissions narrowly.** Per-account `sudoers.d` files with specific command allowlists. The legacy "`app_admin ALL=(ALL) ALL`" pattern is the anti-pattern; every staging or production service account should follow the narrow-allowlist pattern.

**4. Sample detection rule (Sigma, generic Linux auditd):**

```yaml
title: Sensitive system file copied to user home directory
status: experimental
description: Detects sudo cp operations where the source is a sensitive
  system path and the destination is a user home directory. The
  "shadow copy" anti-pattern that produces CWE-732 findings.
logsource:
  product: linux
  service: auditd
detection:
  selection:
    type: 'EXECVE'
    proctitle|contains:
      - 'cp '
      - 'cp\\ '
    args|contains|all:
      - '/etc/systemd/system/'
      - '/home/'
  selection_alt:
    type: 'EXECVE'
    proctitle|contains:
      - 'cp '
    args|contains:
      - '/etc/shadow'
      - '/etc/ssh/'
      - '.ssh/id_'
  uid|not:
    - '0'   # exclude legitimate root operations
  euid:
    - '0'   # but flag if running with sudo-escalated effective UID
  condition: (selection or selection_alt) and euid
level: high
falsepositives:
  - Legitimate forensic-imaging operations by authorized incident-
    response personnel (review against IR ticket list)
```

The rule, fed into Halton's SIEM, would alert on the next `sudo cp` operation that moves a sensitive system file into a user's home directory. The detection is what closes the gap between *the file's creation* and *its discovery five months later by an external audit*.

**5. The longer-arc institutional habit.**

- **Pair the file-integrity monitoring with named-owner review.** Every alert routes to a specific named owner (the service-account team lead, the production-platform engineer, etc.) who acknowledges within a defined SLA. Anonymous-pool SIEM ticket queues produce alert fatigue; named-owner accountability produces actual triage.
- **Train the engineering team on the shadow-copy pattern specifically.** It's the most common single-engineer convenience anti-pattern in modern production systems. A 30-minute internal-wiki article + a quarterly "spot-check" exercise (find the shadow copies on a sample of production systems) closes the institutional gap.
- **For contractors and consultants specifically:** the engagement-closeout checklist should include *audit the contractor's home directory and `~/.bash_history` for any sensitive content before the laptop is wiped and the access is revoked.* This is exactly what level0@linux's audit found on Daniel's laptop; the same discipline applied at engagement-end at *every* client would have caught the shadow copy on the Halton jumphost months earlier.

## §7.5 — Optional exploration: the pivot host

The solve above ends when you've recovered the production DB credential and read `lessons-learned.md`. Everything in this section is *bonus* — no breadcrumb to level2 lives down this path, and you can skip it without missing anything load-bearing.

That said, the staging-worker box (this level) isn't the *destination* of Daniel's exfil pattern; it's the *source*. Daniel's nightly `backup.sh` script (referenced in `cron.d/`) tar's the staging-worker home directory and ships the archive to a separate host. That host is reachable from here via agent-forwarded SSH:

```bash
ssh dbsvc@halton-bastion
```

No password — Daniel set up agent forwarding so the cron job could run unattended. You'll land in `dbsvc`'s home directory with read access to the backup landing zone (`~/backups/`) and the staging-worker service journal that ships alongside (`~/logs/postgresql.log`).

What's there that's useful:

1. **The backup archive itself** — confirms what Daniel was *actually* pulling off the staging box every night. The contents are the same files you just audited from the other side, which gives you a chain-of-custody record: at every backup-creation moment, the shadow copy was already in place. The credential exposure window is *months*, not "since the last incident."
2. **The postgresql.log excerpt** — staging-worker's own journal records a permission-denial sequence when it falls back from the production env file (mode 600, can't read) to the shadow copy (mode 644, can). The system was logging its own bug to the journal continuously; a defender pulling routine log review would have seen this on day one. This is the same "self-logged bug" the bonus-find banner surfaces if you `journalctl -u staging-worker` on the way to the solve.
3. **`exit` returns you to the staging-worker shell** — the pivot is a stacked SSH session, not a level-switch. Your job table, environment variables, and current working directory on staging-worker are preserved across the round trip. (This is the engine's multi-host pivot semantics, new in v1.9.0; the player-facing UX is bash-identical.)

If you want to see this lateral-movement pattern documented in the wild, the **MITRE ATT&CK T1021.004 — Remote Services: SSH** technique writeup is the canonical reference. The agent-forwarded-cron variant specifically is one of the most common single-engineer convenience patterns that produces real-world lateral access (and one of the hardest to detect without explicit `AllowAgentForwarding no` policy + named-host audit).

This pivot exists in level1@linux specifically to let curious players exercise the multi-host workflow without leaving the engagement; **the credential chain works without it.** If you're racing to level2 once it ships, skip this section.

### Bonus finds on this level

Two hidden bonus finds seed orthogonal lessons. `progress --detail` from anywhere shows your discovered list.

**1. Daniel's backup script** — Trigger: `cat backup.sh`. The script reads its database connection string from a *systemd unit override file* (`override.conf`), not from a `.env` or a shell variable or a Vault lookup. The teaching is the systemd-as-credential-store anti-pattern: drop-in override files are a real production surface where credentials accumulate, are often readable by every user on the box (mode 644 is the default unless you `chmod` them), and are *easy* to miss in a credential audit because they don't live where credentials are conventionally expected. CIS Linux Benchmarks 5.x address `/etc/systemd/system/*.d/` audit posture for exactly this reason.

**2. Self-logged config-fallback bug** — Trigger: `journalctl -u staging-worker`. The staging-worker journal contains a recurring ERROR/WARN sequence: the service tries to open `staging-worker.env` (mode 600, owned by root, fails with EACCES), then *falls back* to `.bak`, then logs *both events* to the journal. The system is logging its own bug. A defender pulling the staging-worker journal in any routine review window from the past five months would have seen the falling back to staging-worker.env.bak message, traced it back to the permission mismatch, and closed the gap before the audit found it. The teaching is that **services log their own misbehavior; defenders just have to read.** `journalctl -u <service>` should be in every operational runbook.

## §8 — Key takeaways

- **The lock on the front door doesn't matter when there's a key under the mat.** The legitimate `staging-worker.env` file at mode 600 was properly protected; the shadow copy at mode 644 carrying the same content nullified that protection entirely. Permission misconfiguration is the most common single source of CWE-732 findings in real consulting work.
- **CWE-732 is marked ALLOWED-WITH-REVIEW for direct vulnerability mapping.** Unlike CWE-200 and CWE-668 (both Discouraged), CWE-732 remains a valid canonical citation when permission misconfigurations expose sensitive content — provided the finding is genuinely a permission-assignment failure (and not, e.g., an authorization-logic flaw the entry is sometimes misused to cover). Use it when the finding warrants a formal CVE-style mapping.
- **The four-failure stack matters more than any single failure.** Fixing the shadow copy without addressing the login-shell, the unrestricted sudo, the lack of secrets-management migration, and the missing FIM produces a remediation that catches *this* incident but not the next one. The defender's playbook addresses all four layers.
- **Credentials cached outside their canonical protected location have a long-tail exposure window.** The Snowflake-campaign 2024 precedent specifically demonstrates that credentials can be exfiltrated from a compromised cache years after the caching event. Rotation policy has to assume compromise of any credential that has ever existed outside its canonical protected location, not just credentials with smoking-gun evidence of exploitation.
- **The handoff note is the audit trail.** Daniel's `handoff.md` documents exactly when the shadow copy was created, why it was created, and why it wasn't deleted. The same artifact is the engineer's reasonable attempt at internal documentation *and* the institutional evidence that the engineer knew what they were doing was wrong. Both readings are true; both end up in the formal investigation report.

## §9 — Further reading

*Last reviewed: May 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

- [CWE-732 — Incorrect Permission Assignment for Critical Resource](https://cwe.mitre.org/data/definitions/732.html)
- [CWE-276 — Incorrect Default Permissions](https://cwe.mitre.org/data/definitions/276.html)
- [CWE-281 — Improper Preservation of Permissions](https://cwe.mitre.org/data/definitions/281.html)
- [CWE-798 — Use of Hard-coded Credentials (the level0 root cause)](https://cwe.mitre.org/data/definitions/798.html)
- [NIST SP 800-53 Rev. 5 (current Release 5.2.0, August 2025)](https://csrc.nist.gov/pubs/sp/800/53/r5/final)
- [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1)
- [CIS Linux Benchmarks — Ubuntu / RHEL / CentOS distribution-specific configuration baselines](https://www.cisecurity.org/cis-benchmarks)
- [OWASP Top 10:2025 — A02:2025 Security Misconfiguration (deep link)](https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration/)
- [GLBA Safeguards Rule — 16 CFR Part 314 (FTC)](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule)
- [MITRE ATT&CK — T1078: Valid Accounts](https://attack.mitre.org/techniques/T1078/)
- [MITRE ATT&CK — T1083: File and Directory Discovery](https://attack.mitre.org/techniques/T1083/)
- [MITRE ATT&CK — T1552.001: Unsecured Credentials — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/)
- [LastPass — Notice of Recent Security Incident (December 2022 customer notification)](https://blog.lastpass.com/posts/2022/12/notice-of-recent-security-incident)
- [LastPass — Incident 2 of 2 (March 2023 follow-up disclosure; identifies the senior DevOps engineer's home computer and "vulnerable third-party software" as the entry vector — the specific identification of Plex Media Server and CVE-2020-5741 came via subsequent CISA KEV listing and security-press reporting)](https://blog.lastpass.com/posts/2023/03/security-incident-update-recommended-actions)
- [Uber September 2022 security incident — Uber Newsroom](https://www.uber.com/newsroom/security-update/)
- [Mandiant — UNC5537 Snowflake customer campaign (June 2024 advisory)](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion)
- [Snowflake (Brad Jones, CISO) — Detecting and Preventing Unauthorized User Access (June 2024 customer advisory)](https://medium.com/snowflake/detecting-and-preventing-unauthorized-user-access-d67be8bd66f6)
- [CISA Alert — Snowflake Recommends Customers Take Steps to Prevent Unauthorized Access (June 3, 2024)](https://www.cisa.gov/news-events/alerts/2024/06/03/snowflake-recommends-customers-take-steps-prevent-unauthorized-access)
- [HashiCorp Vault — Getting Started (database secrets engine)](https://developer.hashicorp.com/vault/tutorials/db-credentials/database-secrets)
- [AWS Secrets Manager — User Guide (RDS rotation)](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [Linux `auditd` — Configuring file-watch rules](https://man7.org/linux/man-pages/man8/auditctl.8.html)
- [OSSEC / Wazuh — Host-based intrusion detection and file-integrity monitoring](https://wazuh.com/)
- [AIDE — Advanced Intrusion Detection Environment (FIM)](https://aide.github.io/)
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/)
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
