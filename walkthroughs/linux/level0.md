# level0@linux — Daniel's Last Day

**Track:** Linux · **Client:** Halton Bank · **Compliance regime:** GLBA § 501(b) (Interagency Guidelines)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@linux`. If you haven't solved `level0@linux` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Driftwood Systems is a mid-sized tech consulting firm: ~600 consultants, ~80 simultaneous client engagements at any given time. Every engagement gives the consultant access to a different client's environment. Every six to eighteen months a consultant rolls off one engagement and onto another. That rotation is the entire premise of the business model — and it is also the source of the firm's worst category of security problem.

You're the new hire on Driftwood's internal security team. Day one. Your team is the group that exists to make sure consultants don't roll off engagements with the client's credentials still on their laptops.

The first morning, the fire is already lit. Daniel Yoo, a senior consultant whose engagement at Halton Bank ended Friday, dropped his work laptop with IT for reimaging. His Halton access was revoked over the weekend. But the laptop hasn't been wiped yet, and his home directory hasn't been audited. IT is reimaging on Wednesday. Between now and then, you have a window to find anything sensitive Daniel left exposed.

IT booted the laptop into Daniel's account so you can read everything he had access to. The shell prompt reads `daniel@linux` not because you are Daniel, but because you're standing in his shoes — which is how forensic audits work. The person is gone. The evidence isn't.

Halton Bank is a regional bank. That matters more than it sounds. As a bank it falls under **GLBA § 501(b)** as implemented by the federal banking agencies' Interagency Guidelines, not the FTC Safeguards Rule that covers nonbank lenders and brokers, and the Guidelines put oversight of service providers like Driftwood squarely on Halton (III.D). Halton's own regulator clock is measured in hours: 36 of them, from the moment it determines a notification incident has occurred. The Master Services Agreement Driftwood signed with Halton makes credential exposure a contractual breach on top of the regulatory one. So the stakes for the audit you're about to do are: contract, regulation, and reputation, in that order.

What you don't know yet, walking in, is that Daniel was the kind of consultant who kept passwords in plaintext files.

## §2 — The solve

The whole level is `ls` plus `cat`. The lesson is in noticing what's in front of you.

### Step 1: Orient

```bash
daniel@linux:~$ pwd
/home/daniel
```

`pwd` ("print working directory") tells you where you are in the filesystem. You're sitting in Daniel's home directory — `/home/daniel`. Every file you find here was either created by him or copied by him from somewhere else.

### Step 2: List what's there

```bash
daniel@linux:~$ ls
creds.txt  handoff.md  notes.txt  tasks.md  welcome.md
```

Five files. None of them shout "credential." But notice `creds.txt` — that name should immediately register. Not because attackers grep for `creds*` (they do — but that's the *defender's* observation about what attackers do). Because the file is named after what it contains, and someone left it sitting in plain view.

The `-a` flag exposes hidden files (anything whose name starts with `.`):

```bash
daniel@linux:~$ ls -a
.   ..   .bash_history   creds.txt   handoff.md   notes.txt   tasks.md   welcome.md
```

`.bash_history` is the shell's per-user log of every command Daniel typed. That's the second find. We'll come back to it.

### Step 3: Read the briefing

```bash
daniel@linux:~$ cat welcome.md
```

This is the engine's in-world introduction. It explains who you are, where you are, and the commands you need today. In a real audit, you'd read the engagement brief before touching anything; the walkthrough mirrors that.

### Step 4: Read the handoff document

```bash
daniel@linux:~$ cat handoff.md
```

This is Daniel's note to whoever picks up the Halton account next. Three things stand out:

1. *"Halton's staging DB credentials: see creds.txt. Yes, I know."* — Daniel is explicitly acknowledging that the file is a problem. He knew. He left it anyway. This is not an inattentive breach; it's a documented one. Auditorially, that's worse.
2. He mentions a 02:00 UTC cron job on Halton's jumphost — which becomes the entry point for level1.
3. The voice. Daniel sounds tired, like a competent person who has stopped caring about a particular policy. The lesson here is that exhaustion and apathy are vulnerabilities. Security models that depend on "the consultant will do the right thing on their last day" routinely fail.

### Step 5: Read the rest

```bash
daniel@linux:~$ cat tasks.md
daniel@linux:~$ cat notes.txt
```

`tasks.md` is Daniel's to-do list. Two items confirm the finding:

- *"Rotate Halton's staging DB password (real value lives in creds.txt — I'm leaving it so whoever rotates onto this account has the actual string to revoke, not a memory of it)"*
- *"Delete creds.txt after the rotation"*

Both unchecked. He intended to delete the file. He didn't.

`notes.txt` is engineering scratch notes about Daniel's Halton workflow — the production deploy pipeline ("scp the artifact, ssh in, ./deploy.sh, pray") which is its own finding for a different day. The notes also list *every place* the staging DB password leaks beyond `creds.txt`: in `.bash_history`, in an exported `DB_PASS` env var, in a systemd override on Halton's jumphost. Daniel essentially wrote a credential exposure map for an attacker before leaving.

### Step 6: Read the credential file

```bash
daniel@linux:~$ cat creds.txt
# DO NOT COMMIT — Halton Bank staging-db credentials
# Goal: rotate this. Then delete this file. Neither happened.

host: staging-db.halton.internal
port: 5432
user: app_admin
pass: please-rotate-me
```

This is the win condition.

The password is `please-rotate-me` — the file is literally named like a sticky note that says "DELETE THIS." Daniel knew it should be rotated. Daniel knew it should be deleted. Daniel rolled off the engagement. Now it's someone else's problem.

It is also the credential you'll use to enter `level1@linux`. The breadcrumb pattern in D3CYPH3R is that every level leaks the password for the next level in the same track — and you just found Halton's staging DB credential, which doubles as level1's gate.

### Step 7: Use the credential

```bash
daniel@linux:~$ ssh level1@linux
level1@linux's password: please-rotate-me
```

You're now on Halton Bank's jumphost, logged in as `app_admin`, sitting on a client production bastion using credentials that should have been rotated and weren't. A real attacker who pulled the same trick — recovered a workstation, found `creds.txt`, tried the staging DB cred against the jumphost — would be exactly here. That's the lesson of level1, and we'll cover it in its own walkthrough.

### If you got stuck

- If `cat creds.txt` says "No such file or directory," you're probably not in `/home/daniel`. Run `pwd` to confirm, then `cd ~` to return home.
- If `ls` shows no files, you may be at the wrong shell level. The lobby prompt is `guest@d3cyph3r`; the level prompt is `daniel@linux`. If you see `guest@d3cyph3r`, re-enter the level with `ssh level0@linux`.
- If you found `creds.txt` but couldn't read it, the file should be world-readable on this level (the permission lock-down is the next level's lesson, not this one). Re-run `cat creds.txt`; if it still fails, refresh the page (sessionStorage may be in a weird state).

## §3 — The vulnerability

It's tempting to summarize this level as "Daniel kept passwords in a flat file." That's true, but it undersells the finding. There are three distinct failures stacked here, and a defender who fixes only one without the others has not fixed the problem.

**Failure 1 — Account lifecycle.** Daniel's `level0` local account on this laptop was never disabled after his rolloff. In a properly-run IT shop, his account would have been disabled the same day his engagement ended, with the laptop quarantined for audit before a new user (you) was logged in. Instead, IT logged a new user into Daniel's still-active account, which is operationally convenient but forensically wrong — it commingles your activity with his, contaminates the audit trail, and demonstrates the laptop handling SOP isn't working.

**Failure 2 — Plaintext credential storage.** The credential itself lived in a file at default-readable mode on a consumer-grade laptop with no full-disk encryption verification. No vault, no encrypted password manager, no environment variable scoping. Daniel knew this was wrong — the CWE-798 acknowledgement is literally in the file's own header comment — and did it anyway.[^cwe-798]

**Failure 3 — No rotation forcing function.** The password is named `please-rotate-me`. Daniel was begging the system to make him rotate it. The system did not. Halton Bank's ops team had no quarterly credential rotation policy that they enforced on Driftwood's consultants. Driftwood had no automated check that scanned consultant home directories for credential patterns at engagement closeout. The "rotate this credential" task was tracked in Daniel's `tasks.md` on Daniel's laptop. When Daniel went away, the task went away.

Each is independently a finding. A defender who, say, rotates the credential but doesn't fix the lifecycle failure will have the same problem when the next consultant rolls off. A defender who disables ex-employee accounts but doesn't deploy credential scanning will find the next `creds.txt` six months later on a different laptop. A defender who deploys credential scanning but doesn't establish a rotation policy will have correctly-scanned-but-unrotated credentials forever.

The defender's playbook against this category of finding is in §7. First, the parallels.

## §3.5 — Blast radius

Naming the failure is half of an assessment. The other half is sizing it:
what the finding reaches, how much is in scope, for how long, and what it
opens next.

| Dimension | This finding |
|---|---|
| Reached | Daniel's home directory on a returned laptop: `creds.txt`, `.bash_history`, `notes.txt` |
| Credential in scope | `app_admin` on `staging-db.halton.internal:5432`, in cleartext |
| Other copies | `notes.txt` names three more locations for the same string: shell history, an exported `DB_PASS`, and a systemd override on Halton's jumphost |
| Exposure window | Never rotated. The laptop itself sat unaudited from Friday's roll-off to Wednesday's reimage |
| Escalates to | The same string is the login on Halton's jumphost, which is `level1@linux` |
| Regime | GLBA § 501(b) via the Interagency Guidelines; Halton's regulator clock is 36 hours[^cfr-12-30] |

Three things separate a useful finding here from a shallow one.

**The laptop is not the blast radius. The credential is.** It is tempting
to scope this as "one workstation pending reimage," which sounds
contained and reassuring. But the same string authenticates on a
different host in a different environment, which is the entire lesson of
the next level. Reimaging the laptop resolves nothing about that.

**`notes.txt` is an exposure map, and it is the most valuable file in
the directory.** It lists every other place the password lives.
Remediation that deletes `creds.txt` and stops has left shell history, an
environment variable, and a production systemd override untouched, while
generating a ticket that says the issue is closed. Deleting the copy you
found is not rotation.

**Two organisations carry this, not one.** Driftwood exposed it, but
III.D of the Interagency Guidelines puts oversight of service provider
arrangements on Halton, so the bank owns the failure to verify its
consultant's controls. The MSA adds a contractual breach on top. That is
why a service-provider finding never stays a service-provider problem.

## §4 — Real-world parallels

Three named, well-documented incidents follow this exact pattern. Each was a major news event; each is documentable from primary sources you can read yourself.

### Cash App Investing — April 2022

On April 4, 2022, Block Inc. (Cash App's parent company) filed an SEC 8-K disclosing a breach affecting approximately **8.2 million current and former Cash App Investing customers**.[^block-cash-app-investing-sec] The cause: a former employee who had previously had legitimate access to internal reports downloaded customer data after departing the company. Their access had not been revoked.

The exposed data included customer names, brokerage account numbers, portfolio values, holdings, and stock trading activity. No Social Security numbers, dates of birth, or payment information were exposed — but the financial details alone were sufficient to drive class-action litigation that Block ultimately settled for $15 million in 2024.[^block-cash-app-investing-sec]

What makes this the most direct parallel to level0@linux is not the data category (it's different — Cash App is brokerage, not banking). It's the precise vector: **a former employee retained working access after departure because the offboarding process did not actually revoke their access.** Same failure mode, real consequences.

The follow-on critique of Block's response was almost as damaging as the breach itself: the company waited approximately four months between detecting the unauthorized access (December 2021) and notifying affected customers (April 2022). Many states have breach-notification laws requiring notification within 60 days; New York's NYDFS Part 500 requires 72 hours for covered entities. The lesson, which Cash App's response demonstrated negatively, is that the speed of disclosure is as much a regulatory exposure as the breach itself.

### Twitter / "Mudge" Zatko whistleblower disclosure — August 2022

On August 23, 2022, Peiter "Mudge" Zatko — the former head of security at Twitter — filed an 84-page whistleblower complaint with the Securities and Exchange Commission, the Federal Trade Commission, and the Department of Justice, alleging systemic security failures at the company.[^peiter-zatko-mudge-whistleblower-disclosure] The complaint became public via The Washington Post and CNN; Mudge testified before the Senate Judiciary Committee on September 13, 2022.

The most-cited finding in the disclosure was that Twitter had over 4,000 employees — including engineers — with admin-level access to internal systems that could read or modify any account on the platform. More relevant to this walkthrough: Mudge alleged that the company had no reliable inventory of who had access to what, and that **departed employees frequently retained access to internal tools after leaving.** Twitter's offboarding process, in his telling, was unreliable enough that it could not produce a defensible answer to the question "did any ex-employee have access to internal systems on date X?"

The Twitter case widened the lens on this category of failure. Cash App was about one specific ex-employee acting maliciously. Mudge's allegation was about an entire class of accounts that the company couldn't account for. The risk model is different — instead of one person taking advantage of one lapse, it's a population of accounts representing a continuous attack surface.

For Driftwood, the Twitter analogy is uncomfortable. A consulting firm with 600 consultants rotating across 80 engagements is structurally even harder to track than a 7,500-employee social network. The IAM controls Twitter was alleged to lack are the controls Driftwood's internal security team is supposed to be the answer to.

### Uber — September 2022

On September 15, 2022, an attacker (publicly identifying as "teapot," later linked to the Lapsus$ group) breached Uber. The initial-access vector was MFA fatigue — the attacker spammed an employee's phone with push-notification approval requests until the employee approved one. That part of the story isn't directly relevant to level0@linux.

What happened *after* initial access is the parallel. Once on Uber's VPN, the attacker found a **PowerShell script on an internal network share that contained hardcoded administrator credentials for Uber's Thycotic privileged-access management system.** The script was world-readable on the share. The credentials inside it had not been rotated for a long time. With those credentials, the attacker escalated from one compromised VPN session to "access to everything," including Uber's HackerOne instance (which let them read every previously-disclosed vulnerability report against Uber's own systems — a multiplier on the breach).

Uber's response was widely studied because the company published a detailed post-mortem within days. The CISA advisory referencing the incident specifically called out **`T1552.001` (Unsecured Credentials: Credentials In Files)** as the lateral-movement technique that turned a single-employee compromise into a full network breach.

This is the exact technique you simulated in level0. A credential lives in a flat file. A person who shouldn't have it reads the file. The credential lets them do something they shouldn't be able to do. The chain of single-step failures becomes a breach.

The pattern shows up in nearly every credible breach report. T1552.001 is one of the highest-frequency MITRE ATT&CK techniques in the public threat intelligence corpus.[^t1552-001] If you read three breach post-mortems and don't see this technique cited, it's a coincidence — read a fourth.

## §5 — Frameworks, deep dive

The in-game post-mortem cited six framework controls. Each is expanded below: what the control actually requires, what audit evidence proves it's in place, and what auditors flag when it's not.

### NIST SP 800-53 Rev 5 — AC-2: Account Management

`AC-2` is the foundational access-control control in the NIST 800-53 catalog.[^nist-800-53] It requires the organization to identify and document account types, assign account managers, establish conditions for group/role membership, require approvals for account creation, monitor accounts, and disable accounts under defined conditions. It has more than thirteen control enhancements specifying different aspects.

The enhancement most directly applicable to this level is **`AC-2(3) — Disable Accounts`**, which requires accounts to be disabled within an organization-defined time period when: (a) they have expired, (b) they are no longer associated with a user or individual, (c) they violate organizational policy, or (d) they are inactive for an organization-defined time period. For consulting firms, condition (b) — the account is no longer associated with a user — applies the moment a consultant rolls off. The in-game post-mortem references `AC-2(13)`, which is "Disable Accounts for High-Risk Individuals" — that enhancement is more specifically about accounts of people who pose elevated risk (e.g., during an investigation), but the broader AC-2 framework absolutely covers the rolled-off-consultant case via `AC-2(3)` and via complementary controls below.

What audit evidence proves AC-2 is in place: an account inventory that reconciles against HR's roster of current employees and contractors, with a defined SLA for disable-after-departure (typically 24 hours for standard accounts, shorter for privileged), and audit-log evidence that the SLA is met in practice. Auditors will pull the inventory, sample 20 accounts, and verify the disable date for each terminated user is within the SLA from their HR-recorded departure date. Common findings: accounts disabled but not deleted (creates cleanup debt); SLA documented but not measured (no metric proves it's being met); HR data not integrated with IAM (so the IAM system never receives the disable signal).

For Driftwood specifically, the consulting-firm wrinkle is that "departure" has two meanings — leaving the firm entirely, and rolling off a client engagement. AC-2 was written with the first meaning in mind. The second is what gets missed, and it's the source of most consultant-driven breaches.

### NIST SP 800-53 Rev 5 — PS-4: Personnel Termination

PS-4 is the personnel-security control specifically governing what happens when an individual leaves the organization. It requires organizations to disable system access **before or during** the termination process (not after), conduct exit interviews, retrieve all organizational property (laptops, badges, tokens), and notify the organization within a defined period.

PS-4 is the regulation's answer to the "Daniel left Friday but his laptop was logged in Monday morning" pattern. The control's plain text requires access disablement before the termination event, not days later when someone happens to think of it. The "before or during" phrasing is deliberate: a five-minute window exists by design.

The audit evidence for PS-4: an offboarding ticket trail showing access-disable timestamps that precede or coincide with the official departure timestamp from HR. Common findings: access disabled hours or days late; partial disable (corporate accounts disabled but client-side accounts forgotten); no documented process for "the consultant's last day is the rolloff from a client, not the end of employment with the firm" — which is the gap PS-4 was not specifically designed for and which consulting firms have to bridge themselves.

### NIST SP 800-53 Rev 5 — IA-5: Authenticator Management

IA-5 governs the lifecycle of authenticators (passwords, tokens, keys, certificates). It requires organizations to verify identity before issuing authenticators, establish initial authenticator content, change/refresh authenticators at organization-defined intervals, protect authenticator content from unauthorized disclosure and modification, and require users to take reasonable steps to safeguard their authenticators.

The credential `please-rotate-me` violates IA-5 on at least three counts: it was never rotated (refresh interval ignored), it was disclosed by being stored in a world-readable file (protection from unauthorized disclosure failed), and the user (Daniel) took no reasonable steps to safeguard it — he literally wrote it down in a file named `creds.txt`. The naming pattern is itself an indictment: Daniel knew the credential needed rotation and had no forcing function to make him rotate it.

Audit evidence for IA-5: a credential inventory with rotation timestamps and a rotation policy with documented enforcement (automatic forced-rotation, ticket-driven manual rotation, or scanner-driven re-issuance). Common findings: credentials that have never been rotated since system creation; credentials documented in unencrypted files; service-account credentials with no defined owner ("who's supposed to rotate this?").

### CIS Critical Security Controls v8.1 — Control 5: Account Management

The CIS Controls are an opinionated set of prioritized recommendations originally published by SANS, now maintained by the Center for Internet Security. The current version is **v8.1** (published 2024), which added explicit alignment with NIST CSF 2.0's new *Govern* function but preserved the v8 control and safeguard numbering. Control 5 covers account management. Its safeguards include:

- **5.1**: Establish and Maintain an Inventory of Accounts
- **5.2**: Use Unique Passwords (per account)
- **5.3**: Disable Dormant Accounts
- **5.4**: Restrict Administrator Privileges to Dedicated Administrator Accounts
- **5.5**: Establish and Maintain an Inventory of Service Accounts
- **5.6**: Centralize Account Management

The in-game post-mortem cites 5.3 and 5.4 specifically. **5.3 (Disable Dormant Accounts)** is the direct match for Daniel's level0 account, which remained active after his rolloff. **5.4 (Restrict Administrator Privileges)** is a slightly broader fit: the credential Daniel leaked is for `app_admin`, an administrative database account. The CIS guidance is that administrator access should be reserved for dedicated administrator accounts that are themselves carefully managed — not service accounts that someone happened to be using for general work.

Audit evidence for CIS Control 5: dormant-account reports (typically anything with no login in 30, 60, or 90 days, depending on org policy), administrator-account-vs.-regular-account ratios, and IAM tooling that enforces unique account-to-user mapping. Common findings: shared administrator credentials (which the next walkthrough's level1@linux will dive into deeper); dormant accounts that nobody disabled because nobody noticed; service-account proliferation with no inventory.

### CWE-798: Use of Hard-coded Credentials

CWE (Common Weakness Enumeration) is MITRE's catalog of software weaknesses. **CWE-798 — Use of Hard-coded Credentials** captures the exact pattern of embedding a credential directly in source code, configuration files, or scripts, where any reader of the file can extract it.[^cwe-798]

The CWE-798 entry has been in the catalog since the early days of CWE (entry created circa 2006) and was one of the longest-standing entries in MITRE's "Top 25 Most Dangerous Software Weaknesses" rankings — it appeared on every annual Top 25 list from 2019 through 2024. The **2025 CWE Top 25 dropped CWE-798 off the published list entirely** when MITRE changed its methodology (removing normalization to abstract weaknesses); the weakness pattern itself remains as widespread as ever — practitioner surveys and tooling-vendor reports continue to identify hardcoded credentials as a top breach contributor — but the formal Top 25 ranking no longer reflects that prominence. The weakness is well-documented, well-publicized, and continues to dominate breach post-mortems despite the prevalence of secrets-management tools that solve it.

Daniel's `creds.txt` is a textbook CWE-798 instance. The credential is in a flat file, with no encryption at rest, in a location readable by anyone on the system. The file is not source code — but CWE-798 explicitly includes configuration files and "any persistent storage" within its scope. The remediation is to use a secrets manager (Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler, etc.) and retrieve credentials at runtime, never store them at rest in flat files.[^aws-secrets-manager-user-guide]

There are related CWEs worth knowing: **CWE-256 (Plaintext Storage of a Password)** is the narrower form specifically about credentials in cleartext; **CWE-312 (Cleartext Storage of Sensitive Information)** is the broader form covering any sensitive data.[^cwe-312][^cwe-256] Auditors and security tools may cite any of the three depending on context. They all map to the same underlying mistake.

### OWASP Top 10 (2025) — A07: Authentication Failures

The OWASP Top 10 is the most-cited application-security awareness document in the industry. The current edition is **OWASP Top 10:2025**, finalized in January 2026, which kept the auth slot at A07 but renamed it from the 2021 edition's *Identification and Authentication Failures* to simply *Authentication Failures*.[^owasp-top-10-2025] The renaming reflects how the working group consolidated identification (knowing who the user is) under broader access-control concerns in A01, leaving A07 to focus specifically on credential and authentication lifecycle weaknesses. The 2025 edition also introduced a new A03 (Software Supply Chain Failures) and A10 (Mishandling of Exceptional Conditions); A01 Broken Access Control retained the #1 slot and absorbed SSRF from the previous edition.

A07 includes weaknesses such as: permitting brute-force attacks, default or weak passwords, ineffective credential recovery, missing or ineffective multi-factor authentication, and **exposing session identifiers in the URL** (and, by extension, anywhere they can leak). The Daniel scenario sits inside A07 because the staging credential, once exposed in `creds.txt`, functions as a no-MFA, no-rate-limit authenticator that any reader of the file can use. It's effectively the same as a default password — the moment anyone reads it, the authentication is bypassed.

The OWASP recommendation for A07 mitigations is layered: enforce multi-factor authentication (and prefer phishing-resistant authenticators like FIDO2/passkeys, per NIST SP 800-63B-4), don't deploy with default credentials, implement weak-password checks, align password length/complexity/rotation policies with **NIST SP 800-63B-4**'s modern guidelines (15-character minimum, no forced periodic rotation unless there's evidence of compromise), and limit failed-login attempts.[^nist-800-63b]

### GLBA § 501(b) — Interagency Guidelines (12 CFR Pt. 30 App. B)

The Gramm-Leach-Bliley Act, passed in 1999, requires financial institutions to safeguard the confidentiality of customer information. GLBA § 501(b) is implemented by two different regulators for two different populations, and picking the wrong one is the most common citation error in bank work. The Federal Trade Commission's Safeguards Rule (16 CFR Part 314) covers *nonbank* financial institutions.[^cfr-16-314] Banks are supervised by the federal banking agencies instead, under the Interagency Guidelines Establishing Information Security Standards (12 CFR Pt. 30 App. B for OCC-supervised banks, Pt. 208 App. D-2 for Fed members, Pt. 364 App. B for FDIC-supervised banks).[^cfr-12-30] Halton is a regional bank, so the Guidelines are its rule.

The substantive requirements track each other closely. Where the FTC rule says § 314.4(c)(1), the Guidelines say III.C.1.a: *"Access controls on customer information systems, including controls to authenticate and permit access only to authorized individuals."* III.C.1.f requires *"monitoring systems and procedures to detect actual and attempted attacks on or intrusions into customer information systems."* III.C.1.g requires *"response programs that specify actions to be taken when the bank suspects or detects that unauthorized individuals have gained access to customer information systems, including appropriate reports to regulatory and law enforcement agencies."* III.D covers oversight of service provider arrangements, which is the provision that reaches Driftwood.

Several sections apply directly to level0@linux:

- **§ 314.4(a) — Designation of a Qualified Individual.** A named, qualified person must be responsible for overseeing the information security program. For Driftwood, this is the internal security team's lead.
- **§ 314.4(c)(1) — Access controls.** "Place access controls on customer information systems, including controls to authenticate and permit access only to authorized users, and controls to monitor activity, detect unauthorized access, and prevent unauthorized access." A credential sitting world-readable on a consultant laptop violates this directly.
- **§ 314.4(c)(6) — Secure disposal.** "Develop, implement, and maintain procedures for the secure disposal of customer information." A laptop that gets reimaged Wednesday with credential files still present and unaudited Monday is a disposal-process gap.
- **§ 314.4(f) — Service provider oversight.** This is the section that explicitly covers consultants. Financial institutions must require their service providers (consulting firms like Driftwood) to implement appropriate safeguards by contract and periodically assess them. If Halton's vendor-risk team did this assessment well, Driftwood is on the hook to prove they meet the standard. If Halton didn't, both companies have exposure.

A caution on which GLBA rule applies here, because it is the single most common mis-citation in bank engagements. The FTC's Safeguards Rule (16 CFR Part 314), including its 2023 amendment requiring notice to the FTC within 30 days for events affecting 500+ consumers, governs *nonbank* financial institutions under FTC jurisdiction. Halton is a regional bank, so it is carved out: its GLBA § 501(b) obligations run through the Interagency Guidelines Establishing Information Security Standards (12 CFR Pt. 30 App. B for OCC-supervised banks, Pt. 208 App. D-2 for Fed members, Pt. 364 App. B for FDIC-supervised banks). Its clock is tighter than the FTC's, not looser: under the Computer-Security Incident Notification Rule (12 CFR Pt. 53 / Pt. 225 Subpart N / Pt. 304 Subpart C), a banking organization must notify its primary federal regulator within **36 hours** of determining a notification incident has occurred.[^cfr-12-53] Customer notice follows the 2005 Interagency Guidance on Response Programs.[^interagency-guidance-on-response-programs] Driftwood as service provider is not directly subject to either, but the MSA with Halton typically sets a contractual notification window measured in hours, sized so Halton can meet that 36-hour clock.

### PCI-DSS v4.0.1 — Requirement 12.8

PCI-DSS (Payment Card Industry Data Security Standard) governs any organization that stores, processes, or transmits cardholder data. **Requirement 12.8** specifically covers third-party service providers: organizations must maintain a list of providers with cardholder data access, have a written agreement that acknowledges the provider's responsibility for the security of cardholder data, follow a documented due-diligence process before engaging, and monitor provider PCI-DSS compliance status at least annually.

Halton Bank is a regional bank — payment-card data is in scope somewhere in its environment. To the extent Daniel's Halton engagement gave him access to systems that touch cardholder data, PCI-DSS Req 12.8 puts Driftwood on Halton's third-party-service-provider list and obligates contract terms covering credential handling.

**PCI-DSS v4.0.1** is the only version currently supported by the PCI SSC. v4.0 was originally published in March 2022 and retired December 31, 2024; v4.0.1 (published June 2024) is a clarifying revision that did not change the requirements but tightened wording in several places.[^pci-dss-v4-0-1] All of the future-dated requirements introduced in v4.0 — including the strengthened Req 12.8 expectations around explicit monitoring and documented agreements — became mandatory March 31, 2025. Driftwood's contractual posture with Halton is therefore evaluated against v4.0.1's full requirement set, not v3.2.1's lighter baseline.

Audit evidence for Req 12.8: the third-party provider list, the executed agreement specifying security responsibilities, due-diligence reports from before engagement, and the most recent compliance attestation (typically a SAQ or RoC from the provider). Common findings: provider list missing entries; agreements that don't specify security responsibilities clearly; no monitoring of provider compliance after the initial engagement.

## §6 — Cert exam relevance

Equal-depth coverage for the four certifications cited in the in-game post-mortem. For each: current exam version, the most-tested objectives related to this material, and a sample question framing in the style of that cert's actual exam.

### CompTIA Security+ — current version SY0-701

CompTIA refreshed Security+ from SY0-601 to **SY0-701** in November 2023; SY0-601 was retired July 31, 2024.[^cert-security-plus] SY0-701 is the only version currently testable. Anyone studying for the cert today should be using SY0-701 study materials. The exam has five domains; level0@linux's material maps directly to two.

- **Domain 4.1 — Apply common security techniques to computing resources.** This is the technical-controls domain. Within it, secrets management, configuration enforcement, and access management are tested directly. Expect a question asking which control would prevent credentials from being readable in a flat file (correct answer involves a secrets manager; common distractors include "encrypt the file" — which is technically also right but a worse answer because it doesn't address the root cause of credentials being on disk at all).
- **Domain 5.3 — Explain the processes associated with third-party risk management.** This domain explicitly covers vendor agreements, vendor monitoring, and consulting-firm-style service provider relationships. GLBA-style notification requirements, MSA security clauses, and right-to-audit clauses all live here.[^cfr-16-314][^cfr-12-30]
- **Domain 4.6 — Implement and maintain identity and access management.** Account lifecycle (provisioning, deprovisioning, dormant accounts) is tested.
- **Domain 5.4 — Summarize elements of effective security compliance.** Frameworks (NIST CSF, CIS Controls, PCI-DSS, GLBA, HIPAA) are the body of this domain; recognition-level knowledge is expected.[^pci-dss-v4-0-1]

**Sample question framing:**

> A consultant departs the company after a client engagement. Two months later, an attacker accesses the client's database using credentials that match the consultant's prior access. Which of the following controls would have BEST prevented this?
>
> A. Multi-factor authentication on the database
> B. A formal offboarding process that disables and audits departing personnel access on the day of departure
> C. Quarterly rotation of database credentials
> D. Encryption at rest on the database server

The trap in this question is that A, C, and D are all good controls — they sound right in isolation. But the breach pattern is "credentials retained by ex-personnel." MFA on the database wouldn't have helped (the ex-consultant *knew* the password and would clear MFA themselves if they're the attacker, or — if the credential leaked — the attacker would still be approaching the database in a way that MFA might or might not stop, depending on which authentication factor is being checked). Rotation would shrink the window but not close it. Encryption at rest doesn't apply (the credential is for accessing the database; the attacker isn't reading the disk). The correct answer is **B** — the breach is fundamentally a personnel-security failure, not an authentication or encryption failure.

This is the kind of question Security+ writes: multiple defensible answers, one that addresses the *root cause* of the specific scenario.

### (ISC)² Certified in Cybersecurity (CC)

(ISC)²'s Certified in Cybersecurity (CC) is the entry-level certification (ISC)² introduced in 2022 to compete with Security+ as a first-cert option, with the long-term goal of building a pipeline into CISSP.[^cert-cissp] It has five domains; level0@linux's material concentrates in two.

- **Domain 3 — Access Control Concepts.** Account lifecycle, principle of least privilege, identification/authentication/authorization model.
- **Domain 5 — Security Operations.** Asset disposal, configuration management, handling of incidents, security awareness training.

CC questions are simpler and more definitional than Security+. Expect:

> The principle that requires user access to be revoked immediately upon termination of employment is BEST described as:
>
> A. Least privilege
> B. Separation of duties
> C. Account lifecycle management
> D. Mandatory access control

The answer is **C — Account lifecycle management.** The trap is that "least privilege" sounds adjacent and could conceivably be argued, but the specific phrase "revoked upon termination" maps to account lifecycle, not least privilege (which is about what an active account is permitted to do, not when an account exists).

The CC exam is heavy on recognition of vocabulary. A student studying for it should focus on memorizing the specific terms — "joiner-mover-leaver," "deprovisioning," "deauthorization," "account lifecycle management" — and the difference between superficially similar concepts.

### CISSP

CISSP is the senior-level (ISC)² cert, intended for security professionals with 5+ years of experience. The current exam still follows the 2024 CBK refresh — (ISC)² runs the CBK on a roughly three-year cadence, with the next refresh expected in 2027. CISSP has eight domains; level0@linux's material spans three of them, which makes it a high-value scenario for CISSP study.

- **Domain 1 — Security and Risk Management.** This is the broadest domain and includes compliance frameworks (GLBA, PCI-DSS), regulatory obligations, third-party assessments, and contractual obligations like MSAs. The Halton-Driftwood relationship is exactly the kind of vendor risk CISSP Domain 1 covers in detail.
- **Domain 5 — Identity and Access Management.** Account lifecycle from provisioning through deprovisioning, federation, single sign-on, privileged access management. The IAM-lifecycle questions in CISSP go deep — expect questions about specific PAM tooling (CyberArk, BeyondTrust), Just-In-Time access patterns, and the difference between role-based, attribute-based, and discretionary access control.
- **Domain 7 — Security Operations.** Investigations, incident management, personnel safety. Offboarding sits at the intersection of Domain 5 and Domain 7 — the *process* is Domain 5, the *operational handling* of a departing-employee incident is Domain 7.

CISSP question framings are notoriously oblique. They reward thinking like a manager, not like an engineer. The "best answer" is usually the one that addresses the broader risk-management context, not the one that solves the narrow technical problem.

> A consulting firm's CIO is reviewing a recent incident in which an offboarded consultant left credentials for a client environment on a personal device. As the firm's Chief Information Security Officer, which of the following should be your PRIMARY focus going forward?
>
> A. Implementing a credential scanner across all consultant endpoints
> B. Establishing a contractual right-to-audit clause with all clients
> C. Revising the firm's policy and process for consultant rolloffs to require credential audits before device handoff
> D. Notifying the affected client of the credential exposure

The correct answer is **C**. The CISSP trap here is that A, B, and D are all reasonable actions — but the question asks for the *primary focus going forward*, which is a process question, not a technical or notification question. D is necessary now (notifying the client of *this* exposure), but isn't a "going forward" answer. A is a tactical implementation. B is a contractual concern but not the root cause. C addresses the policy and process failure that enabled the incident — the appropriate executive-level response. This is the CISSP voice: the answer is the one that addresses governance and process, not the one that addresses the technical symptom.

### OSCP / PEN-200

The Offensive Security Certified Professional is the most-recognized hands-on offensive certification.[^cert-oscp] Unlike Security+ or CISSP, OSCP's exam is not multiple-choice — it's a 24-hour practical hands-on test where the candidate is given access to a set of target machines and must compromise them. The cert is awarded based on the report submitted afterward.

The methodology OSCP teaches is, at its core, exactly what you just did to Daniel's laptop:

1. **Enumerate** — list every file, every directory, every running process, every open port.
2. **Read** — `cat` every file you have permission to read.
3. **Pivot** — when you find a credential, try it everywhere reasonable: SSH, FTP, web logins, database connections, internal apps.
4. **Document** — keep meticulous notes so you can write the report.

The OSCP exam includes Linux privilege-escalation machines where the "trick" is some variant of "look in files." Common patterns the exam tests:

- Credentials in `.bash_history`
- Credentials in `*.conf` files under `/etc/`
- Credentials in `/var/www/html/*.php` (web-app config files)
- Credentials in `/home/<user>/.git-credentials`
- Credentials in environment variables (`env` or `cat /proc/<pid>/environ`)
- Credentials in cron job scripts owned by other users
- Credentials in old shell-history files (`.zsh_history`, `.ash_history`)
- SUID binaries that read protected files and print their contents

Level0@linux is essentially the entry-level OSCP enumeration drill. The OSCP candidate would, at minimum, run:

```bash
ls -la ~
cat ~/.bash_history
cat ~/.zsh_history 2>/dev/null
grep -r -i "pass\|pwd\|secret\|api[_-]key\|token" ~/ 2>/dev/null
find / -name "*.conf" -readable 2>/dev/null | head
find / -name "*creds*" -readable 2>/dev/null
env | grep -i "pass\|key\|token"
```

The grep one-liner is the OSCP-canonical move for credentials-in-files. Anyone studying for OSCP should be able to write that line from memory.

OSCP also tests the *recognition* that a found credential should be tried laterally — which is what you did when you ran `ssh level1@linux` with the staging-DB password. The exam grades that pivot explicitly.

## §7 — What a defender does

The level0@linux scenario isn't theoretical. Every defender working at a consulting firm — and every IAM, IT, and security engineer at any large enterprise — has to answer this question concretely. Here's what the work looks like.

**1. Automate Joiner-Mover-Leaver (JML).** The IAM industry's term for the access-lifecycle process. Modern JML automation tools — Okta Lifecycle Management, Microsoft Entra ID Governance (formerly Azure AD Identity Governance), SailPoint IdentityIQ — connect to HR systems (Workday, BambooHR, ADP) and automatically provision/deprovision accounts based on HR events. The signal is the source of truth: HR records the termination → IAM disables the access → laptop is flagged for return → SIEM logs the deauthorization for audit. Without automation, this is a manual ticket chain, and manual chains fail at a rate that scales with how many systems and how many leavers you have.

**2. Treat the workstation as a witness.** When a consultant rolls off, the laptop is evidence, not stock. Before reimaging, image the disk for forensic preservation (FTK Imager, EnCase, or the open-source `dd` plus a write-blocker). Then run an automated credential scanner against the image. *Then* reimage. The "audit-then-wipe" sequence is what Driftwood's process is supposed to enforce — the fact that you're doing it manually on day one of your job means the process isn't automated.

**3. Run credential scanners against home directories, not just repos.** Most secret-scanning tools were built for source-code repositories. gitleaks, TruffleHog, GitHub secret scanning, GitGuardian — all of them work on filesystems too.[^trufflehog-secret-scanning] Configure them to scan `/home/*` on workstations at engagement closeout. The findings will be uncomfortable. They will also be the correct findings.

```bash
# Example: scan all home directories for credential patterns
gitleaks dir /home --report-path /tmp/scan.json --no-git
```

The first time a firm runs this against a representative sample of consultant laptops, the results are universally bad. That's the value of doing it. The second time it's run, the results are better, because consultants have learned that the firm checks.

**4. Vault credentials at the firm level, not the laptop level.** Driftwood should run a vault — HashiCorp Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler, Bitwarden Secrets Manager — that consultants check credentials *out* of when they need them and that audits every access.[^hashicorp-vault-getting-started] Consultants who keep client credentials in files on their laptop are doing it because the alternative (the vault) is friction. Lower the friction. Make the vault the easiest path.

**5. Forensic-grade access logs.** When the question becomes "was Daniel's `creds.txt` ever copied to an external device or uploaded somewhere?" — which is the question Halton's lawyer asks Driftwood's lawyer the day after a breach surfaces — the only acceptable answer is a forensic-grade access log from the laptop's EDR (CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint, Carbon Black). The log should be tamper-evident, retained for a defined period (typically 12+ months), and produceable on demand.

**6. Quarterly attestation walks.** Even with automation, every quarter, a human walks a sample of consultant home directories with a credential scanner and a forensic audit checklist. The walk catches drift — the automation gap, the new client-specific file path that the scanner doesn't know about yet, the one consultant who's working around the vault because they think it's slow. The walk is a metric for the security program's effectiveness, not just a remediation activity.

**7. Tabletop the breach.** Run an annual tabletop exercise where the scenario is exactly level0@linux: "A rolling-off consultant's laptop is found to contain client credentials. Walk us through the response." The exercise reveals which playbooks are documented, which aren't, which assumptions the team is making, which legal and contractual notifications are required, and which clients have to be told. The first time a firm runs this tabletop, it goes badly. That's the point — to find the gaps before the real incident does.

**Sample detection rule (Sigma, generic Linux file-access):**[^sigma-generic-signature-format-for]

```yaml
title: Credential file accessed in user home directory
status: experimental
description: Detects access to files matching common credential naming patterns
  in user home directories on Linux endpoints.
logsource:
  product: linux
  service: auditd
detection:
  selection:
    type: 'PATH'
    name|contains:
      - '/home/'
    name|endswith:
      - 'creds.txt'
      - 'credentials.json'
      - '.aws/credentials'
      - 'id_rsa'
      - '.git-credentials'
      - '.netrc'
  condition: selection
level: medium
falsepositives:
  - Legitimate use by the home directory's owner
```

This rule, tuned by replacing "medium" with "high" for service accounts and dropping the `/home/` filter for cases where credentials shouldn't be anywhere outside the vault, is the kind of detection a SOC would deploy at scale.

### The same control on Windows and macOS

Daniel's credentials were sitting in a file and in shell history. Neither
of those is a Linux idea, and the Windows version has a wrinkle worth
knowing.

| Linux (this level) | Windows | macOS |
| --- | --- | --- |
| `~/.bash_history` records every command verbatim, secrets included | PSReadLine writes `ConsoleHost_history.txt` under `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine`, and it *tries* to protect you: lines containing `password`, `token`, `apikey`, `secret` or `asplaintext` are never written, and since 2.2.0 it parses the command's syntax tree rather than matching strings[^ms-psreadline] | `~/.zsh_history`, with no filtering of any kind |
| Credentials pasted into a flat file in `$HOME` | Same failure, same discovery. The filter above only sees the *command*; a secret written into a file is invisible to it | Same, and the store that should have been used instead is the keychain[^apple-keychain] |
| Scan home directories, not just repos | The same scanners run here; point them at user profiles | The same scanners; add the keychain export path to the review |

Read that Windows row carefully, because it is the kind of control that
creates false confidence. PSReadLine's filter is real and it is better
than nothing, but it matches the shape of a command. A credential passed
positionally, embedded in a URL, or written to a file lands in history or
on disk exactly as it does on Linux. "Windows scrubs that for you" is the
belief the filter tends to produce, and it is wrong in precisely the
cases this level is about.

## §7.5 — Optional exploration

This section is bonus. The credential chain works without it; the post-mortem above stands without it. The level seeds one hidden bonus find that fires if you happen to run a particular command — type `progress --detail` from the lobby to see what's in your discovered list.

### Daniel's muscle-memory pattern

**Trigger:** `cat .bash_history`

**What it teaches:** Daniel's shell history is full of `sudo systemctl status` — he was checking on the staging-worker service constantly. That's the meta-signal. The same developer who *copies secrets to .bak files* is often the developer *logged into every box*. A real incident-response sweep doesn't stop at "find the credential"; it asks "who else was running on these boxes with their fingerprints on the same patterns?" — because muscle memory is a behavioral signature that survives password rotation. `.bash_history` is one of the cheapest places to read that signature.

This is also why the **CIS Linux Benchmark** recommends configuring `HISTSIZE` and `HISTFILESIZE` thoughtfully on shared service accounts — the audit trail is the security control. Daniel's box had `HISTSIZE=1000` (you may have noticed this earlier when you ran `env`). That's roughly five days of shell activity for a busy DevOps engineer, which is plenty for the trail to remain useful at the moment of audit.

The bonus is a small wink at the discipline gap: the same set of commands (`sudo systemctl`, `cat secret.env`, `cp secret.env.bak`) appear in `.bash_history` over and over, and `.bash_history` itself is mode 600 owned by Daniel — readable by the user who's about to be audited, but written without him thinking about who'd read it later. That asymmetry — "I'm not the audience for my own shell history" — is the pattern.

## §8 — Key takeaways

- **The credential file was the entire breach.** Three stacked failures (account lifecycle, plaintext storage, no rotation forcing function) combine into one finding that violates AC-2, IA-5, CWE-798, OWASP A07, GLBA, and PCI-DSS simultaneously.
- **Verizon's annual DBIR consistently puts "use of stolen credentials" among the top three initial-access vectors year over year.** The 2026 DBIR documented a notable reshuffle — vulnerability exploitation overtook credential abuse to claim the #1 slot — but credential-driven access remains the persistent runner-up that dominates incident-response casework. This is not an obscure failure mode.
- **The OSCP enumeration loop — `ls`, `cat`, `grep` — is also the attacker's first move post-foothold.** The same methodology that earns the cert is the methodology that drives breaches when defenders don't run it themselves first.
- **For consulting firms specifically, the blast radius isn't your data — it's your clients' data.** That changes the legal, contractual, and reputational stakes by an order of magnitude.
- **The fix isn't a new tool — it's the process around the tool.** Vault deployment without enforced use, scanner deployment without quarterly walks, JML automation without HR-system integration — all of these fail in predictable ways. The defender's job is to close the process loops.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^nist-800-53]: [NIST SP 800-53 Rev. 5 — Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
[^nist-800-63b]: [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html).
[^cwe-798]: [CWE-798 — Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
[^owasp-top-10-2025]: [OWASP Top 10:2025](https://owasp.org/Top10/2025/).
[^cfr-12-30]: [Interagency Guidelines Establishing Information Security Standards — 12 CFR Pt. 30 App. B](https://www.ecfr.gov/current/title-12/chapter-I/part-30/appendix-Appendix%20B%20to%20Part%2030).
[^cfr-12-53]: [Computer-Security Incident Notification Rule — 12 CFR Part 53 (36-hour clock)](https://www.ecfr.gov/current/title-12/chapter-I/part-53).
[^interagency-guidance-on-response-programs]: [Interagency Guidance on Response Programs and Customer Notice (2005)](https://www.federalregister.gov/documents/2005/03/29/05-5980/interagency-guidance-on-response-programs-for-unauthorized-access-to-customer-information-and).
[^cfr-16-314]: [GLBA Safeguards Rule — 16 CFR Part 314 (FTC; nonbank institutions, shown for contrast)](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule).
[^pci-dss-v4-0-1]: [PCI-DSS v4.0.1 — PCI Security Standards Council document library](https://www.pcisecuritystandards.org/document_library/).
[^t1552-001]: [MITRE ATT&CK — T1552.001: Unsecured Credentials — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/).
[^block-cash-app-investing-sec]: [Block (Cash App Investing) — SEC Form 8-K filed April 4, 2022 (direct filing)](https://www.sec.gov/Archives/edgar/data/1512673/000119312522095215/d343042d8k.htm).
[^peiter-zatko-mudge-whistleblower-disclosure]: [Peiter Zatko ("Mudge") whistleblower disclosure — Senate Judiciary Committee hearing, September 13, 2022](https://www.judiciary.senate.gov/committee-activity/hearings/data-security-at-risk-testimony-from-a-twitter-whistleblower).
[^hashicorp-vault-getting-started]: [HashiCorp Vault — Getting Started](https://developer.hashicorp.com/vault/tutorials/get-started).
[^aws-secrets-manager-user-guide]: [AWS Secrets Manager — User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
[^trufflehog-secret-scanning]: [TruffleHog — secret scanning](https://github.com/trufflesecurity/trufflehog).
[^sigma-generic-signature-format-for]: [Sigma — generic signature format for SIEM systems](https://github.com/SigmaHQ/sigma).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cwe-256]: [CWE-256](https://cwe.mitre.org/data/definitions/256.html).
[^cwe-312]: [CWE-312](https://cwe.mitre.org/data/definitions/312.html).
[^ms-psreadline]: [about_PSReadLine — Microsoft Learn](https://learn.microsoft.com/en-us/powershell/module/psreadline/about/about_psreadline). Documents the history file location and the sensitive-data filtering that omits lines containing `password`, `token`, `apikey`, `secret` or `asplaintext`.
[^apple-keychain]: [Keychain data protection — Apple Platform Security](https://support.apple.com/guide/security/keychain-data-protection-secb0694df1a/web). The system store for passwords, keys and secure notes.

### Further reading

- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1).
- [MITRE ATT&CK — T1083: File and Directory Discovery](https://attack.mitre.org/techniques/T1083/).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [Uber September 2022 security incident — Uber official statement](https://www.uber.com/us/en/newsroom/security-update/).
- [gitleaks — secret scanning](https://github.com/gitleaks/gitleaks).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
