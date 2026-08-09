# level0@linux — Daniel's Last Day

**Track:** Linux · **Client:** Halton Bank · **Compliance regime:** GLBA § 501(b) (Interagency Guidelines)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@linux`. If you haven't solved `level0@linux` yet, close this tab and come back after. The puzzle is much better without spoilers, and the post-mortem below lands properly once you have felt the moment yourself.

---

## §1 — The setup

Driftwood Systems is a mid-sized tech consulting firm: around 600 consultants working about 80 client engagements at any given time. Each engagement hands a consultant access to a different client's environment, and every six to eighteen months they roll off one and onto the next. That rotation is what the firm sells. It is also where its worst security problems come from.

You are the new hire on Driftwood's internal security team, day one. Your team exists to make sure consultants don't roll off an engagement with the client's credentials still sitting on their laptop.

The first morning, the fire is already lit. Daniel Yoo, a senior consultant whose Halton Bank engagement ended Friday, dropped his work laptop with IT for reimaging. His Halton access was revoked over the weekend, but the laptop hasn't been wiped and his home directory hasn't been audited. IT reimages on Wednesday. Until then you have a window to find whatever he left exposed.

IT booted the laptop into Daniel's account so you can read everything he could. The prompt says `daniel@linux` because you are standing where he stood, which is how a forensic audit works. He is gone; his files are not.

Halton Bank is a regional bank, and that detail decides which rulebook applies. As a bank it falls under **GLBA § 501(b)** as implemented by the federal banking agencies' Interagency Guidelines, not the FTC Safeguards Rule that covers nonbank lenders and brokers. The Guidelines put oversight of service providers like Driftwood squarely on Halton, at III.D. Halton's regulator clock is measured in hours: 36 of them, counted from the moment it determines a notification incident has occurred. On top of that, the Master Services Agreement Driftwood signed makes credential exposure a contractual breach in its own right. Contract and regulation are both live before you have opened a single file.

What you don't know walking in is that Daniel kept passwords in plaintext files.

## §2 — The solve

The whole level is `ls` plus `cat`. The lesson is in noticing what's in front of you.

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

Five files, none of them screaming "credential." Except `creds.txt`, which should stop you. Attackers do grep for `creds*`, but that is the defender's framing. The simpler point is that the file is named after what it holds, and it was left in plain view.

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

1. *"Halton's staging DB credentials: see creds.txt. Yes, I know."* Daniel is acknowledging in writing that the file is a problem, and leaving it anyway. For an auditor that is worse than carelessness, because the record shows he understood the risk and accepted it.
2. He mentions a 02:00 UTC cron job on Halton's jumphost, which becomes the entry point for level1.
3. The voice. Daniel sounds tired, like a competent person who has stopped caring about one particular policy. Security models that assume the consultant will do the right thing on their last day fail for exactly this reason.

### Step 5: Read the rest

```bash
daniel@linux:~$ cat tasks.md
daniel@linux:~$ cat notes.txt
```

`tasks.md` is Daniel's to-do list. Two items confirm the finding:

- *"Rotate Halton's staging DB password (real value lives in creds.txt — I'm leaving it so whoever rotates onto this account has the actual string to revoke, not a memory of it)"*
- *"Delete creds.txt after the rotation"*

Both unchecked. He intended to delete the file. He didn't.

`notes.txt` is engineering scratch about Daniel's Halton workflow, including a production deploy pipeline ("scp the artifact, ssh in, ./deploy.sh, pray") that is its own finding for a different day. More usefully, the notes list every place the staging DB password leaks beyond `creds.txt`: `.bash_history`, an exported `DB_PASS` variable, and a systemd override on Halton's jumphost. Daniel wrote an exposure map and left it on the laptop.

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

The password is `please-rotate-me`, which reads like a sticky note reminding somebody to deal with it later. Daniel knew it needed rotating and knew the file needed deleting, then rolled off the engagement with both still outstanding.

It is also the credential that gets you into `level1@linux`. Every level in D3CYPH3R leaks the password for the next one in the same track, and Halton's staging DB credential doubles as level1's gate.

### Step 7: Use the credential

```bash
daniel@linux:~$ ssh level1@linux
level1@linux's password: please-rotate-me
```

You are now on Halton Bank's jumphost as `app_admin`, sitting on a client production bastion with credentials that should have been rotated months ago. An attacker who recovered the same workstation, found `creds.txt`, and tried the staging DB password against the jumphost would be standing in the same place. That is level1's subject, covered in its own walkthrough.

### If you got stuck

- If `cat creds.txt` says "No such file or directory," you're probably not in `/home/daniel`. Run `pwd` to confirm, then `cd ~` to return home.
- If `ls` shows no files, you may be at the wrong shell level. The lobby prompt is `guest@d3cyph3r`; the level prompt is `daniel@linux`. If you see `guest@d3cyph3r`, re-enter the level with `ssh level0@linux`.
- If you found `creds.txt` but couldn't read it, the file should be world-readable on this level (the permission lock-down is the next level's lesson, not this one). Re-run `cat creds.txt`; if it still fails, refresh the page (sessionStorage may be in a weird state).

## §3 — The vulnerability

The easy summary is "Daniel kept passwords in a flat file," which is true and undersells it. Three separate failures are stacked here, and fixing one of them leaves the other two intact.

**Failure 1, account lifecycle.** Daniel's `level0` local account was never disabled after his rolloff. In a well-run shop the account goes dead the day the engagement ends and the laptop is quarantined for audit before anyone else logs in. Instead IT logged you into his still-active account. That is convenient and forensically wrong: your activity now commingles with his, which contaminates the audit trail and says plainly that the laptop-handling procedure is not being followed.

**Failure 2, plaintext credential storage.** The credential sat in a default-readable file on a consumer laptop with no verified full-disk encryption, no vault, no password manager, no scoped environment variable. Daniel knew: the CWE-798 acknowledgement is in the file's own header comment.[^cwe-798]

**Failure 3, no rotation forcing function.** The password is called `please-rotate-me`. Nothing in the system ever made him do it. Halton's ops team enforced no rotation policy on Driftwood's consultants, and Driftwood ran no scan of consultant home directories at engagement closeout. The task lived in `tasks.md` on Daniel's laptop, so when Daniel left, the task left with him.

Each one is a finding on its own, and each one alone is insufficient. Rotate the credential without fixing the lifecycle and the same thing happens at the next rolloff. Disable ex-employee accounts without credential scanning and you find the next `creds.txt` six months later on a different laptop. Deploy scanning without a rotation policy and you get a tidy inventory of credentials nobody rotates.

§7 has the defender's playbook. First, the parallels.

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

Three named incidents follow this pattern, and all three are documented in primary sources you can read yourself.

### Cash App Investing — April 2022

On April 4, 2022, Block Inc., Cash App's parent company, filed an SEC 8-K disclosing a breach affecting approximately 8.2 million current and former Cash App Investing customers.[^block-cash-app-investing-sec] A former employee who once had legitimate access to internal reports downloaded customer data after leaving. Nobody had revoked the access.

The exposed data covered customer names, brokerage account numbers, portfolio values, holdings and trading activity. No Social Security numbers, dates of birth or payment information were involved, and the financial details were still enough to drive class-action litigation that Block settled for $15 million in 2024.[^block-cash-app-investing-sec]

The data category is not what makes this the closest parallel to level0@linux, since Cash App is brokerage rather than banking. The vector is: a former employee kept working access because offboarding did not actually revoke it.

Block's handling drew nearly as much criticism as the breach. Roughly four months passed between detecting the unauthorized access in December 2021 and notifying customers in April 2022. Many state breach-notification laws set a 60-day limit, and New York's NYDFS Part 500 requires 72 hours from covered entities. Disclosure speed is its own regulatory exposure, and Cash App demonstrated that by getting it wrong.

### Twitter / "Mudge" Zatko whistleblower disclosure — August 2022

On August 23, 2022, Peiter "Mudge" Zatko, formerly Twitter's head of security, filed an 84-page whistleblower complaint with the Securities and Exchange Commission, the Federal Trade Commission and the Department of Justice, alleging systemic security failures.[^peiter-zatko-mudge-whistleblower-disclosure] The Washington Post and CNN made it public, and Mudge testified before the Senate Judiciary Committee on September 13, 2022.

The most-quoted finding was that over 4,000 Twitter employees, engineers included, held admin-level access to systems that could read or modify any account on the platform. The part that matters here is quieter: Mudge alleged the company had no reliable inventory of who had access to what, and that departed employees frequently kept access to internal tools. By his account, Twitter could not have produced a defensible answer to "did any ex-employee have access to internal systems on date X?"

That widens the lens. Cash App was one ex-employee exploiting one lapse. Mudge described a population of accounts nobody could enumerate, which is a continuous attack surface rather than a single incident.

The comparison is uncomfortable for Driftwood. Six hundred consultants rotating across 80 engagements is harder to track than a 7,500-employee social network, and the IAM controls Twitter was alleged to lack are precisely the ones Driftwood's internal security team is meant to provide.

### Uber — September 2022

On September 15, 2022, an attacker publicly calling themselves "teapot," later linked to the Lapsus$ group, breached Uber. Initial access came from MFA fatigue: spamming an employee's phone with push approvals until one was accepted. That part is not what concerns us.

What happened next is. Once on Uber's VPN, the attacker found a PowerShell script on an internal network share holding hardcoded administrator credentials for Uber's Thycotic privileged-access management system. The script was world-readable and the credentials inside it were long overdue for rotation. That took the attacker from one compromised VPN session to effectively everything, including Uber's HackerOne instance, which meant reading every previously-disclosed vulnerability report against Uber's own systems.

Uber published a detailed post-mortem within days, which is why the incident is so widely studied. The CISA advisory referencing it named `T1552.001`, Unsecured Credentials: Credentials In Files, as the technique that turned one employee's compromise into a network-wide breach.

That is what you just did to Daniel's laptop. A credential sits in a flat file, somebody who should not have it reads the file, and the credential grants access it was never meant to grant. Each step is small and the sequence is a breach.

T1552.001 is among the highest-frequency techniques in the public threat intelligence corpus.[^t1552-001] Read three breach post-mortems without seeing it cited and you have been unlucky; read a fourth.

## §5 — Frameworks, deep dive

The in-game post-mortem cited six framework controls. Each is expanded below: what the control requires, what evidence proves it is in place, and what auditors write up when it isn't.

### NIST SP 800-53 Rev 5 — AC-2: Account Management

`AC-2` is the foundational access-control control in the NIST 800-53 catalog.[^nist-800-53] It requires the organization to identify and document account types, assign account managers, establish conditions for group/role membership, require approvals for account creation, monitor accounts, and disable accounts under defined conditions. It has more than thirteen control enhancements specifying different aspects.

The enhancement that fits this level is `AC-2(3)`, Disable Accounts, which requires accounts to be disabled within an organization-defined period when they have expired, are no longer associated with a user or individual, violate organizational policy, or have gone inactive past a defined threshold. For a consulting firm the second condition triggers the moment a consultant rolls off. The in-game post-mortem cites `AC-2(13)`, "Disable Accounts for High-Risk Individuals," which is aimed more narrowly at people who pose elevated risk, during an investigation for instance. The rolled-off-consultant case is still squarely covered, through `AC-2(3)` and the complementary controls below.

Proving AC-2 is in place takes an account inventory that reconciles against HR's roster of employees and contractors, a defined SLA for disabling access after departure (usually 24 hours, less for privileged accounts), and log evidence that the SLA is actually met. An auditor pulls the inventory, samples 20 accounts, and checks each terminated user's disable date against their HR departure date. The write-ups repeat themselves: accounts disabled but never deleted, which builds cleanup debt; an SLA that is documented but unmeasured, so nothing proves it is met; HR data not wired into IAM, so the disable signal never arrives.

Driftwood has an extra wrinkle. "Departure" means two things at a consulting firm: leaving the company, and rolling off a client. AC-2 was written for the first. The second is the one that gets missed, and it is where most consultant-driven breaches start.

### NIST SP 800-53 Rev 5 — PS-4: Personnel Termination

PS-4 is the personnel-security control specifically governing what happens when an individual leaves the organization. It requires organizations to disable system access **before or during** the termination process (not after), conduct exit interviews, retrieve all organizational property (laptops, badges, tokens), and notify the organization within a defined period.

PS-4 is the answer to "Daniel left Friday but his laptop was logged in Monday morning." The control text requires disablement before the termination event, not days afterward when somebody remembers. The "before or during" phrasing is deliberate, and the window it allows is measured in minutes.

Evidence for PS-4 is an offboarding ticket trail whose access-disable timestamps precede or match the official HR departure timestamp. Typical findings: access disabled hours or days late; a partial disable where corporate accounts are closed and client-side accounts are forgotten; and no documented process treating a rolloff as a last day at all. PS-4 was not written with that last case in mind, so consulting firms have to bridge it themselves.

### NIST SP 800-53 Rev 5 — IA-5: Authenticator Management

IA-5 governs the lifecycle of authenticators (passwords, tokens, keys, certificates). It requires organizations to verify identity before issuing authenticators, establish initial authenticator content, change/refresh authenticators at organization-defined intervals, protect authenticator content from unauthorized disclosure and modification, and require users to take reasonable steps to safeguard their authenticators.

`please-rotate-me` violates IA-5 several times over. It was never rotated, so the refresh interval was ignored. It sat in a world-readable file, so protection from unauthorized disclosure failed. And Daniel took no reasonable step to safeguard it, having written it down in a file called `creds.txt`. The name is its own indictment: he knew it needed rotating and nothing in the system made him do it.

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

The entry dates to roughly 2006 and appeared on every annual Top 25 Most Dangerous Software Weaknesses list from 2019 through 2024. The 2025 Top 25 dropped it entirely, after MITRE changed its methodology and stopped normalizing to abstract weaknesses. Nothing about the underlying problem changed; practitioner surveys and vendor reporting still put hardcoded credentials near the top of breach causes. The ranking moved, not the risk. Secrets managers have existed for years and this weakness still fills post-mortems.

Daniel's `creds.txt` is textbook: a credential in a flat file, unencrypted, readable by anyone on the system. It is not source code, but CWE-798 covers configuration files and any persistent storage. The fix is a secrets manager (Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler) with credentials fetched at runtime rather than parked on disk.[^aws-secrets-manager-user-guide]

Two neighbouring entries are worth recognising. CWE-256, Plaintext Storage of a Password, is the narrower version about credentials specifically. CWE-312, Cleartext Storage of Sensitive Information, is the wider one covering any sensitive data.[^cwe-312][^cwe-256] Auditors and scanners cite whichever fits their context, and all three describe the same mistake.

### OWASP Top 10 (2025) — A07: Authentication Failures

The OWASP Top 10 is the most-cited application-security awareness document going. The current edition, OWASP Top 10:2025, was finalized in January 2026 and kept authentication at A07 while renaming it from the 2021 edition's *Identification and Authentication Failures* to just *Authentication Failures*.[^owasp-top-10-2025] The working group folded identification, meaning knowing who the user is, into the broader access-control concerns of A01, which left A07 to cover credential and authentication lifecycle weaknesses on their own. The same edition added A03 (Software Supply Chain Failures) and A10 (Mishandling of Exceptional Conditions), and A01 Broken Access Control stayed at number one while absorbing SSRF.

A07 covers brute-force exposure, default or weak passwords, ineffective credential recovery, missing or weak multi-factor authentication, and session identifiers exposed in URLs or anywhere else they can leak. Daniel's scenario lands here because the staging credential, once written into `creds.txt`, works as an authenticator with no MFA and no rate limit for anyone who opens the file. Functionally it is a default password: read it and the authentication is already bypassed.

OWASP's mitigations for A07 stack up. Enforce multi-factor authentication, preferring phishing-resistant authenticators such as FIDO2 and passkeys per NIST SP 800-63B-4. Don't ship default credentials. Check candidate passwords against known-weak lists. Match length and rotation policy to NIST SP 800-63B-4, which sets a 15-character minimum and drops forced periodic rotation unless there is evidence of compromise. Limit failed login attempts.[^nist-800-63b]

### GLBA § 501(b) — Interagency Guidelines (12 CFR Pt. 30 App. B)

The Gramm-Leach-Bliley Act of 1999 requires financial institutions to safeguard the confidentiality of customer information. Two different regulators implement § 501(b) for two different populations, and choosing the wrong one is the most common citation error in bank work. The Federal Trade Commission's Safeguards Rule (16 CFR Part 314) covers *nonbank* financial institutions.[^cfr-16-314] Banks answer to the federal banking agencies instead, under the Interagency Guidelines Establishing Information Security Standards: 12 CFR Pt. 30 App. B for OCC-supervised banks, Pt. 208 App. D-2 for Fed members, Pt. 364 App. B for FDIC-supervised banks.[^cfr-12-30] Halton is a regional bank, so the Guidelines are its rule.

The substantive requirements track each other closely. Where the FTC rule says § 314.4(c)(1), the Guidelines say III.C.1.a: *"Access controls on customer information systems, including controls to authenticate and permit access only to authorized individuals."* III.C.1.f requires *"monitoring systems and procedures to detect actual and attempted attacks on or intrusions into customer information systems."* III.C.1.g requires *"response programs that specify actions to be taken when the bank suspects or detects that unauthorized individuals have gained access to customer information systems, including appropriate reports to regulatory and law enforcement agencies."* III.D covers oversight of service provider arrangements, which is the provision that reaches Driftwood.

Several sections apply directly to level0@linux:

- **§ 314.4(a), Designation of a Qualified Individual.** A named, qualified person has to own the information security program. At Driftwood that is the internal security team's lead.
- **§ 314.4(c)(1), Access controls.** "Place access controls on customer information systems, including controls to authenticate and permit access only to authorized users, and controls to monitor activity, detect unauthorized access, and prevent unauthorized access." A world-readable credential on a consultant laptop violates this outright.
- **§ 314.4(c)(6), Secure disposal.** "Develop, implement, and maintain procedures for the secure disposal of customer information." A laptop reimaged Wednesday with credential files still sitting on it, unaudited since Monday, is a gap in that procedure.
- **§ 314.4(f), Service provider oversight.** The section that covers consultants directly. Financial institutions have to require safeguards from their service providers by contract and assess them periodically. If Halton's vendor-risk team ran that assessment properly, Driftwood has to prove it meets the standard. If they didn't, both companies are exposed.

One caution on which GLBA rule applies, since this is the mis-citation that shows up most often in bank engagements. The FTC's Safeguards Rule (16 CFR Part 314), including the 2023 amendment requiring notice to the FTC within 30 days for events affecting 500 or more consumers, governs *nonbank* institutions under FTC jurisdiction. Halton is a bank and therefore carved out: its § 501(b) obligations run through the Interagency Guidelines instead. Its clock is tighter than the FTC's rather than looser. Under the Computer-Security Incident Notification Rule (12 CFR Pt. 53, Pt. 225 Subpart N, Pt. 304 Subpart C) a banking organization has 36 hours to notify its primary federal regulator once it determines a notification incident has occurred.[^cfr-12-53] Customer notice then follows the 2005 Interagency Guidance on Response Programs.[^interagency-guidance-on-response-programs] Driftwood is not directly subject to either as a service provider, but the MSA usually sets a contractual notification window in hours, sized so Halton can still make its 36.

### PCI-DSS v4.0.1 — Requirement 12.8

PCI-DSS (Payment Card Industry Data Security Standard) governs any organization that stores, processes, or transmits cardholder data. **Requirement 12.8** specifically covers third-party service providers: organizations must maintain a list of providers with cardholder data access, have a written agreement that acknowledges the provider's responsibility for the security of cardholder data, follow a documented due-diligence process before engaging, and monitor provider PCI-DSS compliance status at least annually.

Halton is a regional bank, so payment-card data lives somewhere in its environment. Wherever Daniel's engagement gave him access to systems touching cardholder data, Req 12.8 puts Driftwood on Halton's third-party-service-provider list and requires contract terms covering credential handling.

PCI-DSS v4.0.1 is the only version the PCI SSC currently supports. v4.0 was published in March 2022 and retired on December 31, 2024. v4.0.1, published June 2024, is a clarifying revision that tightened wording without changing requirements.[^pci-dss-v4-0-1] Every future-dated requirement introduced in v4.0, including the strengthened Req 12.8 expectations around explicit monitoring and documented agreements, became mandatory on March 31, 2025. Driftwood's contractual posture is therefore assessed against v4.0.1 in full, not v3.2.1's lighter baseline.

Evidence for Req 12.8 is the provider list, the executed agreement setting out security responsibilities, pre-engagement due-diligence reports, and the provider's most recent attestation, usually a SAQ or RoC. Frequent findings: entries missing from the provider list, agreements that never state security responsibilities clearly, and no monitoring of provider compliance once the engagement is underway.

## §6 — Cert exam relevance

Equal-depth coverage for the four certifications cited in the in-game post-mortem. For each: current exam version, the most-tested objectives related to this material, and a sample question framing in the style of that cert's actual exam.

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

The trap is that A, C and D are all good controls and all sound right in isolation. The breach pattern here is credentials retained by ex-personnel. MFA on the database would not have helped: the ex-consultant knew the password and would clear MFA himself if he is the attacker, and if the credential leaked instead, whether MFA stops the attacker depends on which factor is being checked. Rotation shrinks the window without closing it. Encryption at rest is irrelevant, since the credential authenticates to the database rather than unlocking a disk. **B** is correct, because this is a personnel-security failure rather than an authentication or encryption one.

That is how Security+ writes: several defensible answers, one that addresses the root cause of the specific scenario.

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

CISSP framings are famously oblique and reward thinking like a manager rather than an engineer. The best answer is usually the one addressing the broader risk-management context, not the one that solves the narrow technical problem.

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

This scenario is not theoretical. Every defender at a consulting firm, and every IAM, IT and security engineer at any large enterprise, has to answer it concretely.

**1. Automate Joiner-Mover-Leaver (JML).** The IAM industry's name for the access-lifecycle process. Tools like Okta Lifecycle Management, Microsoft Entra ID Governance (formerly Azure AD Identity Governance) and SailPoint IdentityIQ connect to HR systems such as Workday, BambooHR and ADP, then provision and deprovision accounts off HR events. HR is the source of truth: it records the termination, IAM disables the access, the laptop gets flagged for return, and the SIEM logs the deauthorization for audit. Without automation this is a manual ticket chain, and manual chains fail at a rate that scales with the number of systems and the number of leavers.

**2. Treat the workstation as a witness.** A rolled-off consultant's laptop is evidence, not stock. Image the disk for forensic preservation first (FTK Imager, EnCase, or `dd` with a write-blocker), run an automated credential scanner against the image, and reimage after that. Audit, then wipe. Driftwood's process is meant to enforce that order, and the fact that you are doing it by hand on your first day says it isn't automated.

**3. Run credential scanners against home directories, not just repos.** Most secret-scanning tools were built for source repositories, but gitleaks, TruffleHog, GitHub secret scanning and GitGuardian all work on filesystems.[^trufflehog-secret-scanning] Point them at `/home/*` on workstations at engagement closeout. The findings will be uncomfortable and they will also be correct.

```bash
# Example: scan all home directories for credential patterns
gitleaks dir /home --report-path /tmp/scan.json --no-git
```

The first run against a representative sample of consultant laptops always goes badly, which is the reason to do it. The second run goes better, because consultants now know the firm checks.

**4. Vault credentials at the firm level, not the laptop level.** Driftwood should run a vault (HashiCorp Vault, AWS Secrets Manager, 1Password Secrets Automation, Doppler, Bitwarden Secrets Manager) that consultants check credentials out of and that audits every access.[^hashicorp-vault-getting-started] People keep client credentials in files on their laptop because the vault is friction. Lower the friction until the vault is the easiest path.

**5. Forensic-grade access logs.** The day after a breach surfaces, Halton's lawyer asks Driftwood's lawyer whether `creds.txt` was ever copied to an external device or uploaded somewhere. The only acceptable answer is a forensic-grade access log from the laptop's EDR, whether that is CrowdStrike Falcon, SentinelOne, Microsoft Defender for Endpoint or Carbon Black. It needs to be tamper-evident, retained for a defined period (12 months or more is typical), and produceable on demand.

**6. Quarterly attestation walks.** Even with automation, once a quarter a human walks a sample of consultant home directories with a credential scanner and an audit checklist. The walk catches drift: the gap in the automation, the client-specific file path the scanner has never seen, the one consultant routing around the vault because they think it is slow. Treat it as a measure of whether the security program works, not just as remediation.

**7. Tabletop the breach.** Run an annual exercise on exactly this scenario: a rolling-off consultant's laptop is found to contain client credentials, walk us through the response. It surfaces which playbooks are written down, which assumptions the team is carrying, which legal and contractual notifications apply, and which clients have to be told. The first one goes badly, which is the point of running it before a real incident does.

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

**What it teaches:** Daniel's shell history is full of `sudo systemctl status`, because he was checking the staging-worker service constantly. That repetition is the signal. The developer who copies secrets to `.bak` files is often the same one logged into every box, and a real incident-response sweep does not stop at finding the credential. It asks who else was working on these machines with the same fingerprints, because muscle memory is a behavioural signature that survives a password rotation. `.bash_history` is one of the cheapest places to read it.

It is also why the CIS Linux Benchmark treats `HISTSIZE` and `HISTFILESIZE` as settings worth thinking about on shared service accounts. Daniel's box had `HISTSIZE=1000`, which you may have spotted earlier when you ran `env`. For a busy DevOps engineer that is roughly five days of activity, enough for the trail to still be useful when somebody finally audits it.

The bonus is a small joke about the discipline gap. The same commands (`sudo systemctl`, `cat secret.env`, `cp secret.env.bak`) recur throughout, and `.bash_history` is mode 600 owned by Daniel: readable by the person about to be audited, and written by someone who never considered that anyone would read it later. Nobody thinks of themselves as the audience for their own shell history.

## §8 — Key takeaways

- **The credential file was the entire breach.** Three stacked failures, account lifecycle, plaintext storage and no rotation forcing function, combine into one finding that violates AC-2, IA-5, CWE-798, OWASP A07, GLBA and PCI-DSS at once.
- **Verizon's annual DBIR keeps putting "use of stolen credentials" among the top three initial-access vectors.** The 2026 edition recorded a reshuffle, with vulnerability exploitation taking the top slot from credential abuse, but credential-driven access remains the persistent runner-up and still dominates incident-response casework. This is not an obscure failure mode.
- **The OSCP enumeration loop is also the attacker's first move after a foothold.** `ls`, `cat`, `grep`. The methodology that earns the cert is the methodology that produces breaches when defenders don't run it first.
- **At a consulting firm the blast radius is your clients' data, not your own.** That raises the legal, contractual and reputational stakes by an order of magnitude.
- **The fix is the process around the tool rather than the tool.** A vault nobody is required to use, a scanner with no quarterly walk behind it, JML automation that was never wired into the HR system: each fails in a predictable way. Closing those loops is the job.

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
