# level0@linux — Daniel's Last Day

**Track:** Linux · **Client:** Halton Bank · **Compliance regime:** GLBA § 501(b) (Interagency Guidelines)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@linux`. If you haven't solved `level0@linux` yet, close this tab and come back after. The puzzle is much better without spoilers, and the post-mortem below lands properly once you have felt the moment yourself.

---

## §1 — The setup

Driftwood Systems is a mid-sized tech consulting firm: around 600 consultants working about 80 client engagements at any given time. Each engagement hands a consultant access to a different client's environment, and every six to eighteen months they roll off one and onto the next. That rotation is what the firm sells. It is also where its worst security problems come from.

You are the new hire on Driftwood's internal security team. It is day one, and your entire job is stopping consultants from rolling off an engagement with a client's credentials still sitting on their laptop. You will be very busy.

Because the fire is already lit. Daniel Yoo, a senior consultant whose Halton Bank engagement ended Friday, handed his laptop to IT for reimaging. His Halton access was revoked over the weekend, so somebody did *something* right. But the disk hasn't been wiped and nobody has looked in his home directory. IT reimages Wednesday. You have until then.

IT booted the laptop into Daniel's own account so you can see what he saw, which is why the prompt says `daniel@linux`. You are not Daniel. You are standing in his shoes reading his mail, which is roughly what a forensic audit feels like from the inside. He is gone; his files are not.

One detail decides which rulebook you are working under: Halton is a regional *bank*. That puts it under **GLBA § 501(b)** as implemented by the federal banking agencies' Interagency Guidelines, and not under the FTC Safeguards Rule that covers nonbank lenders and brokers. People mix these up constantly, and §5 will explain why the mix-up is expensive. The Guidelines also drop oversight of service providers like Driftwood squarely on Halton at III.D, so the bank is on the hook for your firm's habits. Its regulator clock runs in hours: 36 of them, from the moment it decides a notification incident has occurred. Meanwhile the Master Services Agreement makes credential exposure a contractual breach all on its own. Contract and regulation are both live and you have not opened a single file yet.

What nobody has told you is that Daniel kept passwords in plaintext.

## §2 — The solve

The whole level is `ls` and `cat`. Two commands, no exploit, no clever trick. The difficulty is entirely in noticing what is sitting in front of you, which is also true of a depressing share of real findings.

### Step 1: Orient

```bash
daniel@linux:~$ pwd
/home/daniel
```

`pwd` ("print working directory") tells you where you are in the filesystem. You are in Daniel's home directory, `/home/daniel`. Every file here was either made by him or copied here by him.

### Step 2: List what's there

```bash
daniel@linux:~$ ls
creds.txt  handoff.md  notes.txt  tasks.md  welcome.md
```

Five files. Four of them look like ordinary work. The fifth is called `creds.txt`.

Take a second with that. Attackers do grep for `creds*`, and you will hear that framing a lot, but it slightly misses the point. Nobody had to be clever here. The file announces its own contents in its filename and then sits in the open where anyone with a shell can read it.

The `-a` flag exposes hidden files (anything whose name starts with `.`):

```bash
daniel@linux:~$ ls -a
.   ..   .bash_history   creds.txt   handoff.md   notes.txt   tasks.md   welcome.md
```

`.bash_history` is the shell's per-user log of every command Daniel typed, which means it is a diary he did not know he was keeping. That is the second find. We come back to it in §7.5.

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

1. *"Halton's staging DB credentials: see creds.txt. Yes, I know."* Read that "Yes, I know" again. Daniel is not oblivious. He is writing a note to his successor that acknowledges the problem, shrugs, and moves on. For an auditor that is worse than carelessness, because the record now shows he understood the risk and accepted it on the client's behalf.
2. A 02:00 UTC cron job on Halton's jumphost gets a passing mention. File that away; it is the entry point for level1.
3. The voice. Daniel sounds tired. Not malicious, not incompetent, just a good engineer who has quietly stopped caring about one specific policy in his last week. Any security model that depends on the consultant doing the right thing on their final Friday is going to meet a lot of Daniels.

### Step 5: Read the rest

```bash
daniel@linux:~$ cat tasks.md
daniel@linux:~$ cat notes.txt
```

`tasks.md` is Daniel's to-do list. Two items confirm the finding:

- *"Rotate Halton's staging DB password (real value lives in creds.txt — I'm leaving it so whoever rotates onto this account has the actual string to revoke, not a memory of it)"*
- *"Delete creds.txt after the rotation"*

Both unchecked. He intended to delete the file. He didn't.

`notes.txt` is engineering scratch about Daniel's Halton workflow. It includes his production deploy pipeline, which he documents as "scp the artifact, ssh in, ./deploy.sh, pray." That is a finding for a different day and possibly a different consultant.

The useful part is that the notes list every other place the staging DB password lives: `.bash_history`, an exported `DB_PASS` variable, and a systemd override on Halton's jumphost. Daniel, in effect, wrote the attacker's shopping list and left it next to the credentials. He meant it as a reminder to himself. It works just as well for anyone else.

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

The password is `please-rotate-me`.

Sit with that one. Somebody chose a password that is a written request to change the password, put it in a file whose header says "DO NOT COMMIT," added a second comment reading "Goal: rotate this. Then delete this file. Neither happened," and then went home. The credential is not hidden. It is not encoded. It is begging, in plain English, to be dealt with, and it stayed exactly where it was until you turned up on a Monday.

It is also your ticket into `level1@linux`. Every level in D3CYPH3R leaks the password for the next one in its track, and Halton's staging DB credential is level1's front door.

### Step 7: Use the credential

```bash
daniel@linux:~$ ssh level1@linux
level1@linux's password: please-rotate-me
```

And there you are: on Halton Bank's jumphost as `app_admin`, standing on a client production bastion, holding a password that should have been retired months ago.

Notice how little that took. No exploit, no vulnerability, no CVE. You read a file and typed what it said. An attacker who bought the same laptop at auction, opened `creds.txt`, and tried the staging credential against the jumphost would be exactly where you are now, with exactly as much effort. Level1 picks up from here.

### If you got stuck

- If `cat creds.txt` says "No such file or directory," you're probably not in `/home/daniel`. Run `pwd` to confirm, then `cd ~` to return home.
- If `ls` shows no files, you may be at the wrong shell level. The lobby prompt is `guest@d3cyph3r`; the level prompt is `daniel@linux`. If you see `guest@d3cyph3r`, re-enter the level with `ssh level0@linux`.
- If you found `creds.txt` but couldn't read it, the file should be world-readable on this level (the permission lock-down is the next level's lesson, not this one). Re-run `cat creds.txt`; if it still fails, refresh the page (sessionStorage may be in a weird state).

## §3 — The vulnerability

The easy summary is "Daniel kept passwords in a flat file." True, and it undersells things badly. Three separate failures are stacked on top of each other here, and each one would have been enough to keep the credential alive on its own. Fix one, keep the other two, still get breached.

**Failure 1, account lifecycle.** Daniel's `level0` local account was never disabled after his rolloff. In a well-run shop the account goes dead the day the engagement ends and the laptop is quarantined for audit before anyone else logs in. Instead IT logged you into his still-active account. That is convenient and forensically wrong: your activity now commingles with his, which contaminates the audit trail and says plainly that the laptop-handling procedure is not being followed.

**Failure 2, plaintext credential storage.** The credential sat in a default-readable file on a consumer laptop with no verified full-disk encryption, no vault, no password manager, no scoped environment variable. Daniel knew: the CWE-798 acknowledgement is in the file's own header comment.[^cwe-798]

**Failure 3, no rotation forcing function.** The password is called `please-rotate-me` and nothing in the entire system ever made anyone rotate it. Halton's ops team enforced no rotation policy on Driftwood's consultants. Driftwood scanned no home directories at closeout. The one place the task existed was `tasks.md`, on Daniel's laptop, in Daniel's handwriting. When Daniel left, the reminder left with him. The only system tracking this credential was a man who no longer worked there.

Each failure is a finding by itself, and none of them is sufficient by itself. Rotate the credential and skip the lifecycle fix, and the next rolloff reproduces the whole thing. Disable ex-employee accounts and skip the scanning, and you meet the next `creds.txt` in six months on somebody else's laptop. Deploy the scanner and skip the rotation policy, and congratulations: you now have a beautifully catalogued list of credentials that nobody rotates.

§7 has the defender's playbook. First, three companies who lived this.

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

A few things separate a useful finding here from a shallow one.

**The credential is the blast radius, not the laptop.** Scoping this as
"one workstation pending reimage" sounds contained, and it is wrong. The
same string authenticates on a different host in a different
environment, which is what the next level is about. Reimaging resolves
none of that.

**`notes.txt` is the most valuable file in the directory**, because it
lists everywhere else the password lives. Remediation that deletes
`creds.txt` and stops leaves shell history, an environment variable and a
production systemd override untouched while closing the ticket. Deleting
the copy you happened to find is not rotation.

**Two organisations carry this.** Driftwood exposed the credential, but
III.D of the Interagency Guidelines puts oversight of service provider
arrangements on Halton, so the bank owns its failure to verify its
consultant's controls, and the MSA adds a contractual breach on top. A
service-provider finding rarely stays the service provider's problem.

## §4 — Real-world parallels

Daniel is fictional. The pattern is not. Three companies you have heard of ran this exact play, and all three are documented in primary sources you can go read yourself.

### Cash App Investing — April 2022

On April 4, 2022, Block Inc., Cash App's parent company, filed an SEC 8-K disclosing a breach affecting approximately 8.2 million current and former Cash App Investing customers.[^block-cash-app-investing-sec] A former employee who once had legitimate access to internal reports downloaded customer data after leaving. Nobody had revoked the access.

The exposed data covered customer names, brokerage account numbers, portfolio values, holdings and trading activity. No Social Security numbers, dates of birth or payment information were involved, and the financial details were still enough to drive class-action litigation that Block settled for $15 million in 2024.[^block-cash-app-investing-sec]

The data category is not what makes this the closest parallel, since Cash App is brokerage and Halton is a bank. The vector is. A former employee kept working access because offboarding said it revoked access and did not.

Block's handling drew nearly as much criticism as the breach. Roughly four months passed between detecting the unauthorized access in December 2021 and notifying customers in April 2022. Many state breach-notification laws set a 60-day limit, and New York's NYDFS Part 500 requires 72 hours from covered entities. Disclosure speed is its own regulatory exposure, and Cash App demonstrated that by getting it wrong.

### Twitter / "Mudge" Zatko whistleblower disclosure — August 2022

On August 23, 2022, Peiter "Mudge" Zatko, formerly Twitter's head of security, filed an 84-page whistleblower complaint with the Securities and Exchange Commission, the Federal Trade Commission and the Department of Justice, alleging systemic security failures.[^peiter-zatko-mudge-whistleblower-disclosure] The Washington Post and CNN made it public, and Mudge testified before the Senate Judiciary Committee on September 13, 2022.

The headline number was that over 4,000 Twitter employees, engineers included, held admin-level access to systems that could read or modify any account on the platform. That is the finding everyone quoted. The one that should worry you is quieter: Mudge alleged the company had no reliable inventory of who had access to what, and that departed employees routinely kept their access to internal tools. Asked "did any ex-employee have access to internal systems on date X," Twitter could not have answered defensibly.

Sit with the difference between the two cases. Cash App is one ex-employee walking through one open door. Mudge is describing a building where nobody has a list of the doors.

Which is the uncomfortable comparison for Driftwood, because 600 consultants rotating across 80 engagements is a harder tracking problem than a 7,500-employee social network. The IAM controls Twitter was alleged to lack are the exact controls your new team is supposed to be.

### Uber — September 2022

On September 15, 2022, an attacker publicly calling themselves "teapot," later linked to the Lapsus$ group, breached Uber. Initial access came from MFA fatigue: spamming an employee's phone with push approvals until one was accepted. That part is not what concerns us.

What happened next is. Once on Uber's VPN, the attacker found a PowerShell script on an internal network share holding hardcoded administrator credentials for Uber's Thycotic privileged-access management system. The script was world-readable and the credentials inside it were long overdue for rotation. That took the attacker from one compromised VPN session to effectively everything, including Uber's HackerOne instance, which meant reading every previously-disclosed vulnerability report against Uber's own systems.

Uber published a detailed post-mortem within days, which is why the incident is so widely studied. The CISA advisory referencing it named `T1552.001`, Unsecured Credentials: Credentials In Files, as the technique that turned one employee's compromise into a network-wide breach.

Which is what you just did to Daniel's laptop, minus the MFA fatigue and the international press coverage. A credential sits in a flat file. Somebody who should not have it opens the file. The credential works. Every individual step is unremarkable, and the sequence is a breach.

T1552.001 is among the highest-frequency techniques in the public threat intelligence corpus.[^t1552-001] If you read three breach post-mortems and none of them cites it, you got unlucky. Read a fourth.

## §5 — Frameworks, deep dive

The in-game post-mortem name-dropped six framework controls. Name-dropping controls is easy and nearly useless, so here is each one properly: what it actually demands, what evidence convinces an auditor you are doing it, and what gets written up when you aren't.

### NIST SP 800-53 Rev 5 — AC-2: Account Management

`AC-2` is the foundational access-control control in the NIST 800-53 catalog.[^nist-800-53] It requires the organization to identify and document account types, assign account managers, establish conditions for group/role membership, require approvals for account creation, monitor accounts, and disable accounts under defined conditions. It has more than thirteen control enhancements specifying different aspects.

The enhancement that fits this level is `AC-2(3)`, Disable Accounts, which requires accounts to be disabled within an organization-defined period when they have expired, are no longer associated with a user or individual, violate organizational policy, or have gone inactive past a defined threshold. For a consulting firm the second condition triggers the moment a consultant rolls off. The in-game post-mortem cites `AC-2(13)`, "Disable Accounts for High-Risk Individuals," which is aimed more narrowly at people who pose elevated risk, during an investigation for instance. The rolled-off-consultant case is still squarely covered, through `AC-2(3)` and the complementary controls below.

Proving AC-2 is in place takes an account inventory that reconciles against HR's roster of employees and contractors, a defined SLA for disabling access after departure (usually 24 hours, less for privileged accounts), and log evidence that the SLA is actually met. An auditor pulls the inventory, samples 20 accounts, and checks each terminated user's disable date against their HR departure date. The write-ups repeat themselves: accounts disabled but never deleted, which builds cleanup debt; an SLA that is documented but unmeasured, so nothing proves it is met; HR data not wired into IAM, so the disable signal never arrives.

Driftwood has an extra wrinkle, and it is the one that bites consulting firms specifically. "Departure" means two different things here: leaving the company, and rolling off a client. AC-2 was written with the first in mind. Daniel never triggered it, because he never left Driftwood. He just stopped being Halton's problem, which nobody's IAM system treats as an event. That gap is where most consultant-driven breaches begin.

### NIST SP 800-53 Rev 5 — PS-4: Personnel Termination

PS-4 is the personnel-security control specifically governing what happens when an individual leaves the organization. It requires organizations to disable system access **before or during** the termination process (not after), conduct exit interviews, retrieve all organizational property (laptops, badges, tokens), and notify the organization within a defined period.

PS-4 is the answer to "Daniel left Friday but his laptop was logged in Monday morning." The control text requires disablement before the termination event, not days afterward when somebody remembers. The "before or during" phrasing is deliberate, and the window it allows is measured in minutes.

Evidence for PS-4 is an offboarding ticket trail whose access-disable timestamps precede or match the official HR departure timestamp. Typical findings: access disabled hours or days late; a partial disable where corporate accounts are closed and client-side accounts are forgotten; and no documented process treating a rolloff as a last day at all. PS-4 was not written with that last case in mind, so consulting firms have to bridge it themselves.

### NIST SP 800-53 Rev 5 — IA-5: Authenticator Management

IA-5 governs the lifecycle of authenticators (passwords, tokens, keys, certificates). It requires organizations to verify identity before issuing authenticators, establish initial authenticator content, change/refresh authenticators at organization-defined intervals, protect authenticator content from unauthorized disclosure and modification, and require users to take reasonable steps to safeguard their authenticators.

`please-rotate-me` manages to violate IA-5 three separate ways in a single string. It was never rotated, so the refresh interval is fiction. It sat in a world-readable file, so protection from unauthorized disclosure failed. And "reasonable steps to safeguard the authenticator" is a hard argument to make about a password written into a file named `creds.txt`. The password's own text is the confession.

Evidence for IA-5 is a credential inventory with rotation timestamps, plus a rotation policy with enforcement behind it, whether that is automatic forced rotation, ticket-driven manual rotation, or scanner-driven reissuance. Recurring findings: credentials never rotated since the system was built, credentials recorded in unencrypted files, and service-account credentials with no owner, so nobody can answer who is supposed to rotate them.

### CIS Critical Security Controls v8.1 — Control 5: Account Management

The CIS Controls are an opinionated set of prioritized recommendations originally published by SANS, now maintained by the Center for Internet Security. The current version is **v8.1** (published 2024), which added explicit alignment with NIST CSF 2.0's new *Govern* function but preserved the v8 control and safeguard numbering. Control 5 covers account management. Its safeguards include:

- **5.1**: Establish and Maintain an Inventory of Accounts
- **5.2**: Use Unique Passwords (per account)
- **5.3**: Disable Dormant Accounts
- **5.4**: Restrict Administrator Privileges to Dedicated Administrator Accounts
- **5.5**: Establish and Maintain an Inventory of Service Accounts
- **5.6**: Centralize Account Management

The in-game post-mortem cites 5.3 and 5.4. Safeguard 5.3, Disable Dormant Accounts, matches Daniel's level0 account exactly, since it stayed active after his rolloff. Safeguard 5.4, Restrict Administrator Privileges, is a looser fit but still applies: the leaked credential belongs to `app_admin`, an administrative database account. CIS says administrator access belongs to dedicated administrator accounts that are themselves managed carefully, rather than to a service account somebody adopted for day-to-day work.

Evidence for Control 5 is dormant-account reporting (usually no login in 30, 60 or 90 days, depending on policy), the ratio of administrator to regular accounts, and IAM tooling that enforces one account per person. The findings that keep coming up: shared administrator credentials, which `level1@linux` goes into properly; dormant accounts nobody disabled because nobody was looking; and service accounts multiplying with no inventory behind them.

### CWE-798: Use of Hard-coded Credentials

CWE, the Common Weakness Enumeration, is MITRE's catalog of software weaknesses. CWE-798, Use of Hard-coded Credentials, describes a credential embedded directly in source code, configuration or scripts, where anyone who can read the file can take it.[^cwe-798]

The entry dates to roughly 2006 and made every annual Top 25 Most Dangerous Software Weaknesses list from 2019 through 2024. Then the 2025 Top 25 dropped it completely, which sounds like progress and isn't. MITRE changed its methodology and stopped normalizing to abstract weaknesses. Practitioner surveys and vendor reporting still put hardcoded credentials near the top of breach causes. The ranking moved; the risk stayed exactly where it was. Twenty years and an entire industry of secrets managers later, this weakness is still filling post-mortems.

Daniel's `creds.txt` is textbook: a credential in a flat file, unencrypted, readable by anyone on the system. It is not source code, but CWE-798 covers configuration files and any persistent storage. The fix is a secrets manager (Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler) with credentials fetched at runtime rather than parked on disk.[^aws-secrets-manager-user-guide]

Two neighbouring entries are worth recognising. CWE-256, Plaintext Storage of a Password, is the narrower version about credentials specifically. CWE-312, Cleartext Storage of Sensitive Information, is the wider one covering any sensitive data.[^cwe-312][^cwe-256] Auditors and scanners cite whichever fits their context, and all three describe the same mistake.

### OWASP Top 10 (2025) — A07: Authentication Failures

The OWASP Top 10 is the most-cited application-security awareness document going. The current edition, OWASP Top 10:2025, was finalized in January 2026 and kept authentication at A07 while renaming it from the 2021 edition's *Identification and Authentication Failures* to just *Authentication Failures*.[^owasp-top-10-2025] The working group folded identification, meaning knowing who the user is, into the broader access-control concerns of A01, which left A07 to cover credential and authentication lifecycle weaknesses on their own. The same edition added A03 (Software Supply Chain Failures) and A10 (Mishandling of Exceptional Conditions), and A01 Broken Access Control stayed at number one while absorbing SSRF.

A07 covers brute-force exposure, default or weak passwords, ineffective credential recovery, missing or weak multi-factor authentication, and session identifiers exposed in URLs or anywhere else they can leak. Daniel's scenario lands here because the staging credential, once written into `creds.txt`, works as an authenticator with no MFA and no rate limit for anyone who opens the file. Functionally it is a default password: read it and the authentication is already bypassed.

OWASP's mitigations for A07 stack up. Enforce multi-factor authentication, preferring phishing-resistant authenticators such as FIDO2 and passkeys per NIST SP 800-63B-4. Don't ship default credentials. Check candidate passwords against known-weak lists. Match length and rotation policy to NIST SP 800-63B-4, which sets a 15-character minimum and drops forced periodic rotation unless there is evidence of compromise. Limit failed login attempts.[^nist-800-63b]

### GLBA § 501(b) — Interagency Guidelines (12 CFR Pt. 30 App. B)

The Gramm-Leach-Bliley Act of 1999 requires financial institutions to safeguard the confidentiality of customer information. Simple enough, until you notice that two different regulators implement § 501(b) for two different populations. Cite the wrong one in front of a bank's compliance team and you have announced that you do not work in this sector. It is the most common citation error in bank engagements and it is entirely avoidable. The Federal Trade Commission's Safeguards Rule (16 CFR Part 314) covers *nonbank* financial institutions.[^cfr-16-314] Banks answer to the federal banking agencies instead, under the Interagency Guidelines Establishing Information Security Standards: 12 CFR Pt. 30 App. B for OCC-supervised banks, Pt. 208 App. D-2 for Fed members, Pt. 364 App. B for FDIC-supervised banks.[^cfr-12-30] Halton is a regional bank, so the Guidelines are its rule.

The substantive requirements track each other closely. Where the FTC rule says § 314.4(c)(1), the Guidelines say III.C.1.a: *"Access controls on customer information systems, including controls to authenticate and permit access only to authorized individuals."* III.C.1.f requires *"monitoring systems and procedures to detect actual and attempted attacks on or intrusions into customer information systems."* III.C.1.g requires *"response programs that specify actions to be taken when the bank suspects or detects that unauthorized individuals have gained access to customer information systems, including appropriate reports to regulatory and law enforcement agencies."* III.D covers oversight of service provider arrangements, which is the provision that reaches Driftwood.

Several sections apply directly to level0@linux:

- **§ 314.4(a), Designation of a Qualified Individual.** A named, qualified person has to own the information security program. At Driftwood that is the internal security team's lead.
- **§ 314.4(c)(1), Access controls.** "Place access controls on customer information systems, including controls to authenticate and permit access only to authorized users, and controls to monitor activity, detect unauthorized access, and prevent unauthorized access." A world-readable credential on a consultant laptop violates this outright.
- **§ 314.4(c)(6), Secure disposal.** "Develop, implement, and maintain procedures for the secure disposal of customer information." A laptop reimaged Wednesday with credential files still sitting on it, unaudited since Monday, is a gap in that procedure.
- **§ 314.4(f), Service provider oversight.** The section that covers consultants directly. Financial institutions have to require safeguards from their service providers by contract and assess them periodically. If Halton's vendor-risk team ran that assessment properly, Driftwood has to prove it meets the standard. If they didn't, both companies are exposed.

One caution on which GLBA rule applies, since this is the mis-citation that shows up most often in bank engagements. The FTC's Safeguards Rule (16 CFR Part 314), including the 2023 amendment requiring notice to the FTC within 30 days for events affecting 500 or more consumers, governs *nonbank* institutions under FTC jurisdiction. Halton is a bank and therefore carved out: its § 501(b) obligations run through the Interagency Guidelines instead. Its clock is tighter than the FTC's rather than looser. Under the Computer-Security Incident Notification Rule (12 CFR Pt. 53, Pt. 225 Subpart N, Pt. 304 Subpart C) a banking organization has 36 hours to notify its primary federal regulator once it determines a notification incident has occurred.[^cfr-12-53] Customer notice then follows the 2005 Interagency Guidance on Response Programs.[^interagency-guidance-on-response-programs] Driftwood is not directly subject to either as a service provider, but the MSA usually sets a contractual notification window in hours, sized so Halton can still make its 36.

### PCI-DSS v4.0.1 — Requirement 12.8

PCI-DSS (Payment Card Industry Data Security Standard) governs any organization that stores, processes, or transmits cardholder data. **Requirement 12.8** specifically covers third-party service providers: organizations must maintain a list of providers with cardholder data access, have a written agreement that acknowledges the provider's responsibility for the security of cardholder data, follow a documented due-diligence process before engaging, and monitor provider PCI-DSS compliance status at least annually.

Halton is a regional bank, so cardholder data lives somewhere in that environment whether or not anyone has drawn it on a diagram. Wherever Daniel's engagement touched those systems, Req 12.8 puts Driftwood on Halton's third-party-service-provider list and requires contract terms covering credential handling.

PCI-DSS v4.0.1 is the only version the PCI SSC currently supports. v4.0 was published in March 2022 and retired on December 31, 2024. v4.0.1, published June 2024, is a clarifying revision that tightened wording without changing requirements.[^pci-dss-v4-0-1] Every future-dated requirement introduced in v4.0, including the strengthened Req 12.8 expectations around explicit monitoring and documented agreements, became mandatory on March 31, 2025. Driftwood's contractual posture is therefore assessed against v4.0.1 in full, not v3.2.1's lighter baseline.

Evidence for Req 12.8 is the provider list, the executed agreement setting out security responsibilities, pre-engagement due-diligence reports, and the provider's most recent attestation, usually a SAQ or RoC. Frequent findings: entries missing from the provider list, agreements that never state security responsibilities clearly, and no monitoring of provider compliance once the engagement is underway.

## §6 — Cert exam relevance

Four certifications cited the material in this level, and each one tests it in a completely different accent. Below: the current exam version, the objectives this level maps to, and a sample question written in that cert's actual voice. If you are studying for any of them, the sample questions are the useful part, because knowing the content and knowing how a cert *asks* about the content are separate skills.

### CompTIA Security+ — current version SY0-701

CompTIA refreshed Security+ from SY0-601 to **SY0-701** in November 2023; SY0-601 was retired July 31, 2024.[^cert-security-plus] SY0-701 is the only version currently testable. Anyone studying for the cert today should be using SY0-701 study materials. The exam has five domains; level0@linux's material maps directly to two.

- **Domain 4.1, Apply common security techniques to computing resources.** The technical-controls domain, testing secrets management, configuration enforcement and access management directly. Expect a question about which control stops credentials being readable in a flat file. The answer involves a secrets manager; the usual distractor is "encrypt the file," which is not wrong but is worse, because it leaves the credential on disk.
- **Domain 5.3, Explain the processes associated with third-party risk management.** Vendor agreements, vendor monitoring and consulting-style service provider relationships. GLBA notification requirements, MSA security clauses and right-to-audit clauses all sit here.[^cfr-16-314][^cfr-12-30]
- **Domain 4.6, Implement and maintain identity and access management.** Account lifecycle: provisioning, deprovisioning, dormant accounts.
- **Domain 5.4, Summarize elements of effective security compliance.** Frameworks (NIST CSF, CIS Controls, PCI-DSS, GLBA, HIPAA) at recognition level.[^pci-dss-v4-0-1]

**Sample question framing:**

> A consultant departs the company after a client engagement. Two months later, an attacker accesses the client's database using credentials that match the consultant's prior access. Which of the following controls would have BEST prevented this?
>
> A. Multi-factor authentication on the database
> B. A formal offboarding process that disables and audits departing personnel access on the day of departure
> C. Quarterly rotation of database credentials
> D. Encryption at rest on the database server

Every wrong answer here is a good control, which is the trap. Read them again and notice that A, C and D are all things you would genuinely recommend.

They still lose. The breach pattern is credentials retained by ex-personnel. MFA on the database does nothing when the ex-consultant *is* the attacker and clears his own second factor, and if the credential leaked to someone else, whether MFA helps depends on which factor gets checked. Rotation shrinks the window without closing it. Encryption at rest is answering a question nobody asked, since the credential authenticates to the database rather than unlocking a disk. **B** wins because this is a personnel-security failure wearing a technical costume.

That is the Security+ house style: several defensible answers, one that goes at the root cause of the specific scenario in front of you.

### (ISC)² Certified in Cybersecurity (CC)

(ISC)²'s Certified in Cybersecurity (CC) is the entry-level certification (ISC)² introduced in 2022 to compete with Security+ as a first-cert option, with the long-term goal of building a pipeline into CISSP.[^cert-cissp] It has five domains; level0@linux's material concentrates in two.

- **Domain 3, Access Control Concepts.** Account lifecycle, least privilege, and the identification / authentication / authorization model.
- **Domain 5, Security Operations.** Asset disposal, configuration management, incident handling, security awareness training.

CC questions are simpler and more definitional than Security+. Expect:

> The principle that requires user access to be revoked immediately upon termination of employment is BEST described as:
>
> A. Least privilege
> B. Separation of duties
> C. Account lifecycle management
> D. Mandatory access control

The answer is **C**, account lifecycle management. "Least privilege" sounds adjacent enough to argue for, but "revoked upon termination" is a lifecycle question. Least privilege governs what an active account may do, not whether the account should exist.

CC leans hard on vocabulary recognition. Studying for it means memorising the exact terms, "joiner-mover-leaver," "deprovisioning," "deauthorization," "account lifecycle management," and knowing which superficially similar concept is which.

### CISSP

CISSP is the senior (ISC)² cert, aimed at people with five or more years in the field. The current exam still follows the 2024 CBK refresh; (ISC)² revises the CBK on roughly a three-year cadence, so the next one is expected in 2027. Of its eight domains, level0@linux touches three, which makes it unusually good value as a study scenario.

- **Domain 1, Security and Risk Management.** The broadest domain: compliance frameworks such as GLBA and PCI-DSS, regulatory obligations, third-party assessments, and contractual obligations like MSAs. The Halton and Driftwood relationship is precisely the vendor risk this domain covers.
- **Domain 5, Identity and Access Management.** Account lifecycle from provisioning through deprovisioning, plus federation, single sign-on and privileged access management. The IAM questions go deep here, into specific PAM tooling such as CyberArk and BeyondTrust, just-in-time access patterns, and the differences between role-based, attribute-based and discretionary access control.
- **Domain 7, Security Operations.** Investigations, incident management, personnel safety. Offboarding straddles Domains 5 and 7: the process belongs to 5, the operational handling of a departing-employee incident belongs to 7.

CISSP framings are famously oblique, and the trick to them is to stop thinking like an engineer. The best answer is almost never the one that fixes the immediate technical problem. It is the one a person with budget authority would give.

> A consulting firm's CIO is reviewing a recent incident in which an offboarded consultant left credentials for a client environment on a personal device. As the firm's Chief Information Security Officer, which of the following should be your PRIMARY focus going forward?
>
> A. Implementing a credential scanner across all consultant endpoints
> B. Establishing a contractual right-to-audit clause with all clients
> C. Revising the firm's policy and process for consultant rolloffs to require credential audits before device handoff
> D. Notifying the affected client of the credential exposure

**C** is correct. The trap is that A, B and D are all reasonable, but the question asks for the primary focus *going forward*, which makes it a process question. D is necessary right now, since the client has to be told about this exposure, but it is not a forward-looking answer. A is a tactical implementation. B is contractual and does not touch the root cause. C fixes the policy and process failure that allowed the incident, which is the executive-level response. That is the CISSP voice: governance and process over technical symptom.

### OSCP / PEN-200

The Offensive Security Certified Professional is the most recognised hands-on offensive certification.[^cert-oscp] Its exam is not multiple choice. It is a 24-hour practical test: the candidate gets access to a set of target machines and has to compromise them, and the cert is awarded on the report submitted afterward.

The methodology it teaches is what you just did to Daniel's laptop:

1. **Enumerate.** List every file, directory, running process and open port.
2. **Read.** `cat` every file you have permission to read.
3. **Pivot.** When you find a credential, try it everywhere plausible: SSH, FTP, web logins, database connections, internal apps.
4. **Document.** Keep notes good enough to write the report from.

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

OSCP also tests whether you recognise that a found credential should be tried laterally, which is what you did running `ssh level1@linux` with the staging-DB password. The exam grades that pivot explicitly.

## §7 — What a defender does

Everything above diagnoses. This part is the actual job. Every defender at a consulting firm, and every IAM, IT and security engineer at any large enterprise, eventually has to answer this one with a budget and a timeline attached.

**1. Automate Joiner-Mover-Leaver (JML).** The IAM industry's name for the access-lifecycle process. Tools like Okta Lifecycle Management, Microsoft Entra ID Governance (formerly Azure AD Identity Governance) and SailPoint IdentityIQ connect to HR systems such as Workday, BambooHR and ADP, then provision and deprovision accounts off HR events. HR is the source of truth: it records the termination, IAM disables the access, the laptop gets flagged for return, and the SIEM logs the deauthorization for audit. Without automation this is a manual ticket chain, and manual chains fail at a rate that scales with the number of systems and the number of leavers.

**2. Treat the workstation as a witness.** A rolled-off consultant's laptop is evidence before it is inventory. Image the disk for forensic preservation first (FTK Imager, EnCase, or `dd` with a write-blocker), run a credential scanner against the image, and only then reimage. Audit, then wipe, in that order, every time. Driftwood's process is supposed to enforce this, and the fact that you are doing it by hand on your first morning tells you exactly how well that is going.

**3. Run credential scanners against home directories, not just repos.** Most secret-scanning tools were built for source repositories, but gitleaks, TruffleHog, GitHub secret scanning and GitGuardian all work on filesystems.[^trufflehog-secret-scanning] Point them at `/home/*` on workstations at engagement closeout. The findings will be uncomfortable and they will also be correct.

```bash
# Example: scan all home directories for credential patterns
gitleaks dir /home --report-path /tmp/scan.json --no-git
```

Brace for the first run. Point a scanner at a representative sample of consultant laptops and the results are always grim, which is precisely why you do it. The second run looks better, and not because anyone deployed a tool. It looks better because word got round that the firm checks now.

**4. Vault credentials at the firm level, not the laptop level.** Driftwood should run a vault (HashiCorp Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler, Bitwarden Secrets Manager) that consultants check credentials out of, with every access audited.[^hashicorp-vault-getting-started] People keep client credentials in a text file because your vault is annoying and the text file is not. That is the whole reason, and you will not out-argue it with policy. Lower the friction until the vault is genuinely the easiest option, and the text files go away by themselves.

**5. Forensic-grade access logs.** The day after a breach surfaces, Halton's lawyer will ask Driftwood's lawyer one question: was `creds.txt` ever copied to a USB stick or uploaded anywhere? "We don't know" is not an answer anybody survives. What you need is a forensic-grade access log from the laptop's EDR, whether that is CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint or Carbon Black, and it needs to be tamper-evident, retained for a defined period (12 months or more is typical), and produceable on demand.

**6. Quarterly attestation walks.** Automation drifts, so once a quarter a human walks a sample of consultant home directories with a scanner and a checklist. The walk is what finds the gap in the automation, the client-specific file path the scanner has never been taught, and the one consultant quietly routing around the vault because they think it is slow. Treat the results as a measure of whether the program works, not as a to-do list.

**7. Tabletop the breach.** Once a year, run this exact scenario at a table: a rolling-off consultant's laptop turns out to contain client credentials, walk us through the response. You will find out fast which playbooks exist in writing, which live in one person's head, which notifications are legally required, and which clients have to be phoned. Your first tabletop will be a mess. Far better to have that morning in a conference room than during an actual incident.

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

Tune it by raising "medium" to "high" for service accounts, and by dropping the `/home/` filter where credentials have no business existing outside the vault at all. That gives you the kind of detection a SOC deploys at scale.

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

This section is bonus. The credential chain works without it and the post-mortem above stands without it. The level seeds one hidden find that fires if you happen to run a particular command. Type `progress --detail` from the lobby to see what is in your discovered list.

### Daniel's muscle-memory pattern

**Trigger:** `cat .bash_history`

**What it teaches:** Daniel's shell history is wall-to-wall `sudo systemctl status`, because he spent his last months anxiously poking the staging-worker service. The repetition is the interesting part. The developer who copies secrets into `.bak` files is very often the same person logged into every box in the estate, and a good incident-response sweep does not stop once it has the credential. It asks who else was working these machines and leaving the same fingerprints. Muscle memory is a behavioural signature, and unlike a password it survives rotation. `.bash_history` is the cheapest place on the system to read one.

This is also why the CIS Linux Benchmark bothers to have an opinion about `HISTSIZE` and `HISTFILESIZE` on shared service accounts. Daniel's box was set to `HISTSIZE=1000`, which you may have caught earlier if you ran `env`. For an engineer at his pace that is about five days of history, which is just enough to still be worth reading when someone finally audits the machine.

There is a quiet joke buried in the file permissions. The same handful of commands (`sudo systemctl`, `cat secret.env`, `cp secret.env.bak`) repeat down the page, and `.bash_history` is mode 600, owned by Daniel. Locked down, private, his. Written by a man who never once pictured a stranger reading it on a Monday morning. Almost nobody thinks of themselves as the audience for their own shell history, which is why it is such good evidence.

## §8 — Key takeaways

- **One text file was the entire breach.** Three stacked failures (account lifecycle, plaintext storage, no rotation forcing function) produce a single finding that manages to violate AC-2, IA-5, CWE-798, OWASP A07, GLBA and PCI-DSS simultaneously. That is efficient, in the worst way.
- **This is the most boring attack in security, and it keeps working.** Verizon's annual DBIR has put "use of stolen credentials" among the top three initial-access vectors for years running. The 2026 edition saw a reshuffle, with vulnerability exploitation taking the top slot, but credential abuse is the permanent runner-up and still dominates incident-response casework.
- **The OSCP enumeration loop is also the attacker's opening move.** `ls`, `cat`, `grep`. The methodology that earns you the certificate is the methodology that produces breaches when defenders never run it on themselves first.
- **At a consulting firm, the blast radius is your clients' data.** Not yours. That single fact moves the legal, contractual and reputational stakes by an order of magnitude, and it is why this job exists.
- **Buying the tool is the easy 10%.** A vault nobody is required to use, a scanner with no quarterly walk behind it, JML automation that was never wired into HR: each of those is a purchase order pretending to be a control. Closing the loop is the actual work, and it is unglamorous, and it is the job.

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
