# level0@osint — Veridian's Open Letter

**Track:** OSINT · **Client:** Veridian Analytics · **Compliance regime:** HIPAA Business Associate + HITRUST CSF v11

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@osint`. If you haven't solved `level0@osint` yet, close this tab and come back after, the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Veridian Analytics is one of Driftwood's healthcare clients: a mid-sized healthcare-analytics SaaS company of roughly 250 engineers, founded in 2018, headquartered in Boston with a smaller R&D office in Cambridge. It processes claims and outcomes data for insurance carriers and provider networks, which makes it a **HIPAA Business Associate** under a signed Business Associate Agreement with every customer, and puts PHI in scope across the entire production environment. On top of that it carries **HITRUST CSF v11**, because its insurance-carrier customers want the assurance and because, in healthcare analytics, a HITRUST certification is the price of admission to most major-payer contracts.[^hitrust-csf-v11-hitrust-alliance]

Veridian came to Driftwood about fourteen months ago for HITRUST readiness. They were preparing for their first formal assessment ahead of a major payer renewal that required it, and Driftwood saw them through gap remediation and the assessment itself. They passed and validated certification in May. Since then it has become a general security partnership, for a simple reason: Veridian's internal security team is two people, so anything beyond their bandwidth comes to us.

OSINT and executive-protection work is a smaller, growing piece of Driftwood's practice. Healthcare and life-sciences clients call when one of their clinical or commercial executives attracts public attention, whether favourable, hostile, or merely *visible*, and the General Counsel wants a baseline read on that person's public footprint before things develop further.

You are on Driftwood's OSINT workstation as `intel`, the shared service account the recon team uses for client intelligence work. It is set up for open-source lookups: breach-corpus aggregators, certificate transparency tooling, certificate-issuance monitoring, IP geolocation, and the canonical `hibp` (Have I Been Pwned) interface along with the paid corpus-enrichment layer that surfaces cracked-hash recoveries.[^have-i-been-pwned-hibp]

The case opened on Friday afternoon, when Marisol Vega, Veridian's General Counsel, emailed Priya. Veridian's newly hired Chief Medical Officer, **Dr. Aaron Hines**, has turned up in an open-letter campaign run by a patient-advocacy group called the "Trial Transparency Action Network." The letter went up on Substack on 2026-05-08, co-signed by 41 listed individuals, mostly patient-advocacy figures plus three bioethics academics. It concerns HLX-204, a Phase III oncology-adjuvant trial Aaron's team ran at his previous employer, Helix Therapeutics, between 2021 and 2023, and it alleges the trial's adverse-event reporting was methodologically opaque. Aaron is named.

Then it got personal. In the past week Aaron received one identifiable LinkedIn DM from an account that mentioned his home neighbourhood (he lives in Brookline) and his daughter's school district (Coolidge Corner). He forwarded it to Veridian IT and to Marisol. The account has since gone quiet: no further contact, no physical events. Which is reassuring right up until you remember that quiet is also what preparation looks like.

Marisol's question to Driftwood, paraphrased from the call:

> *"Before I take this to the board and recommend an executive-protection vendor, I want a baseline read on Aaron's public credential exposure. If his personal accounts are wide open I want to know — both to estimate the threat actor's likely capability and to give Aaron's IT a remediation list. Don't touch his Veridian account; that's covered by our internal monitoring. Just his publicly-known personal addresses."*

The scope is unusually narrow, and every boundary in it is deliberate. **In scope:** Aaron's known personal email address (`aaron.hines.md@gmail.com`), public breach-corpus lookup only, read-only OSINT. **Out of scope:** anything Veridian issued him (work email, M365 account, EHR-related accounts), because Veridian's internal monitoring covers that surface and its BAAs require a specific incident-response process if a Veridian-domain credential is ever exposed. Active testing of any account: no credential stuffing, no password spray, nothing that touches a live service. Aaron's family: the DM mentioned his daughter, and **Driftwood's MSA template explicitly excludes minors from any OSINT scope**, which is standard at every reputable consultancy. And no social-media enumeration beyond the LinkedIn DM that started this, so no `sherlock` username pivots and no `theharvester` domain sweeps; that is a separate engagement if Marisol asks for one later.

Marisol wants this handled with care, and the delivery chain reflects it. Aaron is about to learn, from a brief Marisol writes, how much of his personal life sits in public breach corpora. Driftwood delivers findings to Marisol, Marisol writes the brief, and Aaron never sees raw output. The intermediation is deliberate. A third-party consultant telling an executive *"your password is in a breach"* lands very differently from the same fact delivered by his own General Counsel, who also happens to have a plan.

What nobody knows yet is that Aaron's personal email appears in five breaches, and two of them surface the same cleartext password: `BostonStrong#2013`. Two unrelated corpora agreeing on a cleartext is the high-confidence signal for password reuse. People do not pick that exact string twice by coincidence.

## §2 — The solve

One command. That is the easy part. Everything this level teaches is about what you do *not* do after it.

### Step 1: Read the brief

```bash
intel@osint:~$ cat engagement-notes.md
intel@osint:~$ cat subject-brief.txt
```

The engagement notes set the regulatory frame (HIPAA Business Associate, HITRUST CSF v11, MA 201 CMR 17.00 for the Massachusetts data-security regulation, and NIST SP 800-66 Rev. 2 as the HIPAA implementation guide), the people and events (Veridian, Marisol, the Trial Transparency Action Network letter, the LinkedIn DM), and above all the **scope**: exactly what today's lookup is and is not allowed to touch.[^nist-800-66]

The subject-brief is the formal artifact: Case ID `VER-EXP-2026-002`, Aaron's biographical summary (Boston University Medical School MD 2009, MGH residency, Beth Israel Deaconess fellowship, marathon runner, recreational sailor), and the **single in-scope email address**: `aaron.hines.md@gmail.com`. It also explicitly names the out-of-scope work email (`ahines@veridian-analytics.com`) with a *do not query* instruction.

Read both before you run anything. The OSINT playbook is strictly sequential, brief first and lookup second, and the reason is defensive. A lookup run before the scope confirmation is in hand may well have been authorized, but you will struggle to *prove* it was, and if anything about this engagement is ever contested, provable authorization is the only thing that matters.

### Step 2: Run the HIBP lookup

```bash
intel@osint:~$ hibp aaron.hines.md@gmail.com
```

The output lists five breaches Aaron's address appears in. Each entry has the breach name, the disclosure date, the exposed-data categories, and, where the paid corpus enrichment has surfaced a cleartext recovery, a description noting which cracked-hash dump contained the recovered password.

**The five breaches:**

1. **LinkedIn (2012-05).** Email addresses, passwords (SHA-1, unsalted), names, employment history. *Cleartext password recovered from cracked-hash corpus: `BostonStrong#2013`*, flagged as candidate for credential-reuse testing.

2. **Adobe (2013-10).** Email addresses, password hints (in cleartext!), encrypted passwords, usernames. Adobe is the odd one. The hints were stored in plain text while the passwords were encrypted with 3DES in ECB mode, so identical ciphertext blobs reveal identical plaintexts without anyone breaking the encryption. Aaron's hint is recorded as *"city we lived in for residency"*, which is a gift to anyone building a guess list.

3. **MyFitnessPal (2018-02).** Email addresses, IP addresses, usernames, passwords (bcrypt). These cost-12 bcrypt hashes are largely uncracked, because bcrypt at a high cost factor is deliberately hostile to GPU cracking. No cleartext in the corpus for this one. This is what a breach looks like when somebody did their job.

4. **LiveJournal (2014-01, disclosed 2020).** Email addresses, usernames, passwords (MD5, unsalted). *Cleartext password recovered from cracked-hash corpus: `BostonStrong#2013`*. **CONFIRMED REUSE**, same password as the LinkedIn breach.

5. **Collection #1 (2019-01).** Email addresses, passwords (aggregated cleartext). Collection #1 is an aggregator dump combining 2,000+ prior breaches. Aaron appears with seven distinct historical password fragments; the LinkedIn / LiveJournal reused value is among them.

### Step 3: Notice the reuse signal

The finding is sitting in the description fields of entries 1 and 4: **the same cleartext, `BostonStrong#2013`, recovered from two independent breaches.** The LinkedIn dump (SHA-1, cracked wholesale by the underground years ago) gives it up. So does the LiveJournal dump (MD5, likewise cracked). Aaron used the same password on both services.

That is the signal. One cleartext in one breach could be a one-off, a throwaway on a site he never cared about. The same cleartext in two unrelated breaches is a *habit*. The reasonable inference is that Aaron uses `BostonStrong#2013`, or some `BostonStrong#YYYY` variant, across a good number of personal accounts he has been managing the same way for over a decade.

And the context makes it worse. `BostonStrong` is a publicly derivable token. Aaron is publicly a Boston resident, a marathon runner, and a documented donor to the Boston Marathon Foundation, so *anyone* building a guess list from his public bio would generate `Boston*`, `Marathon*` and `Brookline*` candidates within the first hundred entries of a personalized wordlist. A personal root plus a year suffix is about the most common shape a weak password takes. Reuse, a root anyone can derive from his bio, and a guessable year: each one alone is a weakness, and Aaron has all three in one string.

### Step 4: Stop

This is where the work ends, and it is the step people skip. You do not test the credential. Active credential testing is a separate authorization boundary: even with Marisol's sign-off for the lookup, testing would need a fresh statement-of-work amendment and, depending on the targets, the consent of the platforms involved. You also do not pivot to Aaron's family. The DM mentioned his daughter, and *we do not OSINT minors*. That is Driftwood policy, it is industry practice, and it is written into the MSA.

The finding stands as it is, and Marisol decides what happens next. The remediation advice is the same for everyone: a unique random password from a password manager on every account Aaron owns; 2FA wherever it is offered (ideally phishing-resistant FIDO2 or passkeys, TOTP as the fallback, never SMS on the high-value accounts); and Veridian's identity controls should assume his personal credentials are compromised and be designed accordingly.

### Step 5: The breadcrumb (game-world only)

In a real engagement the work stops at the finding. In D3CYPH3R the breadcrumb pattern continues:

```bash
intel@osint:~$ ssh level1@osint
level1@osint's password: BostonStrong#2013
```

This is the part that would never happen in a real engagement, given you just read why you do not test the credential. In the game world, `level1@osint` plays out the next stage of the threat model: the password works somewhere, and the question becomes what Aaron's reuse actually unlocked. That is `level1@osint`'s subject, and it has its own walkthrough.

### If you got stuck

- If `hibp aaron.hines.md@gmail.com` returned no results, double-check the email, `aaron.hines.md@gmail.com` (with the `.md` suffix in the local part). The lookup is case-insensitive but typo-sensitive.
- If the output didn't show cleartext password values in the description fields, you may be looking at the public HIBP free-tier output; the paid corpus enrichment is what surfaces cracked-hash recoveries. In real engagements, paid services like Dehashed, IntelX, Constella Intelligence, and SpyCloud are the layer that produces the cleartext-recovery view of the breach corpora.[^dehashed-paid-breach-corpus-aggregator][^intelx-breach-data-search-engine][^constella-intelligence-executive-protection-threat][^spycloud-credential-monitoring-platform] D3CYPH3R simulates the enriched output to mirror what a real OSINT engagement workstation produces.
- If you went straight from the lookup to `ssh level1@osint` without reading `subject-brief.txt` first, you have missed the actual lesson. The brief is the artifact that proves the lookup was authorized, and in an audit the order you did things in matters as much as what you found.

## §3 — The vulnerability

Three separate weaknesses are stacked in that one password, and unless all three get fixed, Aaron's threat model looks exactly the same after this case closes as it did before.

**Failure 1, password reuse.** `BostonStrong#2013` appears in two independent breach corpora, and that is the primary finding. The fix is easy to say and miserable to do. Unique passwords from a manager, certainly, but Aaron has 15+ years of personal accounts, many long forgotten, and "rotate every password to a unique value" means either auditing his entire digital footprint or replacing passwords lazily as each account turns up in normal use. Realistically it will be the second. That is why the single highest-leverage intervention is a password manager that flags reuse and generates a unique replacement the moment he logs in somewhere.

**Failure 2, a password root anyone can derive.** Suppose Aaron rotates the reused password and picks something new like `BostonProud#2026`, `Brookline#2026` or `Marathon42K`. The same rule-mutator wordlist that cracked the first one will crack the replacement, because the problem was never only reuse. It was building passwords out of publicly known facts about himself. A password manager fixes this too, since a random string has no root to derive, but only if he actually uses it instead of inventing a "memorable" replacement in his head, which is exactly what most people do.

**Failure 3, no second factor on personal accounts.** Credential stuffing specifically targets accounts protected by a password and nothing else. Turn on 2FA, even SMS-fallback 2FA with all its well-known weaknesses, and stuffing stops working, because the attacker holds the password and not the second factor. So: 2FA on every account that supports it. For the high-value personal accounts (primary email, financial, healthcare portals) the preference order is phishing-resistant authenticators first (FIDO2 hardware keys, passkeys), TOTP apps second, SMS only as a last resort.

Each one is a finding on its own. Fix the reuse but keep the derivable root, and the next compromise looks the same. Fix both but skip 2FA, and the next expansion of the breach corpora, which tends to happen about once a year, reopens the whole surface. §7 has the playbook.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Public breach corpora only. Nothing belonging to Veridian was touched |
| What it establishes | The same cleartext password appears for one individual in two separate breaches |
| Why two matters | One appearance is an exposed password; two is evidence of a reuse *habit* |
| Subject | A newly-hired executive at a HIPAA Business Associate handling analytics for covered entities[^nist-800-66][^cfr-45-164] |
| Regime | HIPAA as a Business Associate plus HITRUST CSF; a BA notifies the covered entity within 60 days, and the covered entity carries the individual-notice duty[^hitrust-csf-v11-hitrust-alliance] |

**Nothing here is a breach of Veridian, and the report must say so
plainly.** Every artifact came from public sources. What the finding
establishes is elevated likelihood, not an incident: a specific person
with privileged access has demonstrably reused credentials before, which
raises the probability that a Veridian credential shares that fate. This
is a risk input, and writing it up as an incident would be both wrong and
damaging to the person involved.

**The habit is the finding, not the password.** A single breach
appearance tells you a third party was compromised. The same plaintext in
two unrelated corpora tells you something about how this individual
manages secrets, and that generalises to systems the corpora never
touched. It is the difference between "this key is burned" and "keys of
this shape are likely burned."

**A Business Associate's blast radius is measured in its customers.**
Veridian holds PHI on behalf of covered entities, so a credential
compromise here propagates outward to organisations that have their own
notification duties and their own regulators. Under HIPAA the BA notifies
the covered entity within 60 days; the covered entity then owns the
individual notice. One reused password can start clocks inside companies
Veridian does not control.

## §4 — Real-world parallels

Aaron is fictional. Password reuse is not, and it has a long and expensive public record. Three cases follow, each one a password recovered from an old breach doing damage somewhere new.

### 23andMe — October 2023

In early October 2023, attackers ran credential stuffing against the genetic-testing service 23andMe and got directly into approximately 14,000 user accounts.[^23andme-credential-stuffing-breach-23andme] On its own that is an ordinary-sized stuffing incident. What made it famous was the *secondary blast radius*. 23andMe's relative-sharing features let users opt in to sharing limited genetic data with relatives on the service, so those ~14,000 accounts opened data fragments for approximately **6.9 million additional users**: roughly **5.5 million** through DNA Relatives profiles and another **1.4 million** through Family Tree profiles, every one of them people who had shared with a compromised account and reused nothing.

23andMe confirmed the breach on October 6, 2023, and did not begin notifying affected users until December. The exposed data included names, profile photos, ancestry-percentage breakdowns, locations and, in some cases, DNA segment information, which is uniquely awful to lose because it never changes and cannot be rotated. Class actions followed. 23andMe first settled the consolidated cases for **$30 million in September 2024**, a figure later revised to **$50 million** with final court approval on **January 30, 2026**, post-bankruptcy.[^23andme-settlement] The company had filed for Chapter 11 in March 2025, citing the breach's financial and reputational damage as a contributing factor.

Here is why it matters for Aaron. Nothing in 23andMe's own infrastructure was breached. The attackers took credentials *reused* from earlier breaches, LinkedIn, MyFitnessPal, Yahoo, Adobe, the same corpora Aaron turns up in, and tried them on 23andMe's login page. Anyone whose 23andMe password matched their LinkedIn-2012 password was in. Afterwards 23andMe made 2FA mandatory on every account, which would have stopped the attack cold regardless of how many people reused passwords.

So if `BostonStrong#2013` also guards a healthcare portal, a financial account, or Aaron's primary email, those accounts are exposed in exactly the same way. 23andMe is the standing proof that stuffing works at scale, and that the damage lands on companies that have nothing to do with the original breach.

### Norton LifeLock — January 2023

In early January 2023, Gen Digital, then Norton LifeLock's parent company, disclosed that approximately **6,450 customer accounts** had been compromised by credential stuffing between December 1 and December 12, 2022.[^norton-lifelock-january-2023-credential] The attackers used credentials exposed in third-party breaches, and where a customer had reused a password on Norton LifeLock, they got whatever was stored behind it. For some customers, that included **Norton Password Manager vaults**.

The irony is hard to miss. **Norton LifeLock is an identity-monitoring product.** Its customers were people who had specifically paid for a service designed to alert them to identity-theft risks. The product's premise was that consumers could outsource the vigilance, let LifeLock do the watching. And the consumers' own personal accounts, on the LifeLock product itself, were compromised because they had reused passwords across other services. The product couldn't protect them from their own credential hygiene.

Norton notified affected customers in mid-January 2023, forced password resets on every affected account, and filed with the state attorneys general whose breach statutes required it (Maine, Vermont and others). By the numbers it was a small breach. It got cited far beyond its size because of what it said: *the identity-monitoring company cannot protect its own customers from credential stuffing if they reuse passwords.*

For Aaron specifically, the parallel is the breadth of services where reused credentials are exploitable. Aaron has been managing personal accounts since the late 2000s. The set of services where he might have used `BostonStrong#2013` includes every credential-protected account he set up between approximately 2010 and the date he started using a password manager (if he ever did). That set is probably long, likely in the dozens, possibly in the hundreds. Some fraction of those accounts contain meaningful information about him. Without a password manager and 2FA, the entire set is exposed.

### Mat Honan — "Epic hacking" — August 2012

In August 2012, *Wired* writer Mat Honan published an extended account of an attack against his digital life.[^mat-honan-how-apple-and] The attacker, motivated by a desire to take over his three-letter Twitter handle (`@mat`), executed a chain of compromises that took roughly an hour to complete:

1. Looked up Honan's billing address from publicly-available property records.
2. Called Amazon customer service, used the billing address plus other publicly-derivable details to add a credit card to Honan's account.
3. Called Amazon back, used the newly-added credit card as proof of identity to request a new password emailed to an attacker-controlled address.
4. Used the Amazon account's saved credit-card last-four-digits to call Apple's customer-service line and claim ownership of Honan's Apple ID, obtaining a temporary password.
5. Used the Apple ID to access Honan's iCloud, which had Find My Mac enabled.
6. Initiated remote wipes of Honan's iPhone, iPad, and MacBook simultaneously.
7. Used Apple-ID-recovery access to Honan's Gmail to extract password-reset emails for his other accounts.
8. Used the cascading access to commandeer his Twitter account.

Strictly, this was not credential reuse from a breach corpus. It was a chain of social engineering against Apple and Amazon customer-service staff, each step using one company's published verification policy against another's. The *result* was the same as a stuffing chain, though: cascading compromise across one person's accounts, starting from public information, with no password needed at the start.

Honan is the standard case study for *cascading personal-account compromise*, and it is still widely cited in password and identity-management guidance. Apple and Amazon both changed their identity-verification procedures within days of the article. The lesson Apple drew, that account recovery must not depend on details anyone can pull from public records, is now a basic principle of account-recovery design.

For Aaron, Honan is the parallel that should make Marisol uncomfortable. 23andMe shows what stuffing achieves at scale against one service. Honan shows what one determined person achieves against *one individual* by chaining credential and identity-verification weaknesses together. If someone hostile, say someone in the orbit of the Trial Transparency Action Network campaign, decided to go after Aaron personally, the credential you just surfaced is step one of a chain that looks a lot like Honan's. Protecting him means more than rotating passwords. It means alerting on account-recovery attempts, moving to phishing-resistant authentication, and treating his whole personal-account ecosystem as exposed at once.

## §5 — Frameworks, deep dive

The in-game post-mortem names eight framework controls. Naming them is the cheap part, so here is what each one actually asks of Veridian.

### NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management

NIST Special Publication 800-63B, currently at **Revision 4** (finalized 2025; supersedes Rev. 3), defines the federal-government baseline for authenticator selection, authentication-event handling, and credential lifecycle management.[^nist-800-63b][^nist-800-63b-nist-4] Rev. 4 introduced significant changes from Rev. 3, a minimum-length recommendation increased from 8 characters to 15 for memorized secrets, formalization of phishing-resistant authenticators (FIDO2/passkeys as the recommended path), and explicit elimination of forced periodic rotation absent evidence of compromise.

Three sections apply directly to Aaron's case:

**5.1.1.2, Memorized Secret Verifiers.** Verifiers SHALL compare prospective secrets against a list of values known to be commonly used, expected, or compromised. The breach-corpus screening here is explicit and named in the spec, it's exactly why services like HIBP's k-anonymity Pwned Passwords API exist. A modern password-creation flow that doesn't check the proposed password against a breach corpus is violating 800-63B-4's plain text. Aaron's personal-account services almost certainly do this now; the legacy accounts where he set the password in 2013 do not retroactively check, which is why the reuse persists.

**5.1.1.4, Memorized Secret Compromise Response.** When a memorized secret is changed, verifiers SHALL re-check against the breach list. The intent is to catch the case where a user picks a "new" password that happens to also be in the breach corpus. For Aaron, the rotation work has to actually produce a value that doesn't appear in any corpus, a password manager's random output trivially satisfies this; a memorable replacement like `BostonStrong#2026` almost certainly doesn't.

**5.2.2, Rate Limiting and Anomaly Detection.** Verifiers SHALL implement controls to limit credential-stuffing attacks at the authentication endpoint: rate-limiting, IP-reputation scoring, geographic-anomaly detection, device-fingerprint persistence. This is the *defender's* control on the relying-party side. Aaron can't enforce this on the services he uses, but the services he uses *do* implement these controls in 2026, which is why mass credential-stuffing campaigns produce single-digit success rates per password tested. The risk to Aaron is concentrated on services that haven't implemented these controls (typically older, less-maintained personal services) and on accounts where the credential-stuffer's session looks operationally indistinguishable from Aaron's own (e.g., logins from the United States during business hours).

800-63B-4 also covers Authenticator Assurance Levels (AAL1/AAL2/AAL3). AAL2, multi-factor with one phishing-resistant factor, is the recommended floor for any account that handles non-public personal information. For Aaron's healthcare-portal accounts and his Veridian-domain account, AAL2 should be the minimum.

Audit evidence for 800-63B-4 compliance includes a documented authenticator policy that maps to the AAL tiers, technical implementation evidence (the password-creation flow checks against a breach corpus, the rate-limiter is configured and tested, the MFA enforcement is documented for the account categories that require it), and periodic review.

### HIPAA Security Rule — 45 CFR Part 164, Subpart C

The HIPAA Security Rule (45 CFR Part 164, Subpart C) defines the technical safeguards for protecting electronic protected health information (ePHI).[^cfr-45-164] Veridian is a HIPAA Business Associate by virtue of processing PHI on behalf of its insurance-carrier and provider-network customers. The Security Rule applies to every Veridian system that touches PHI, and, by extension, to the credentials used to access those systems.

Three sections bear on Aaron's case:

**§ 164.308(a)(1)(ii)(B), Risk Management.** Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level. Aaron's personal-credential exposure is a documented risk factor under any reasonable risk-assessment methodology, if his personal credentials are reused on Veridian-domain accounts or on any service that controls access to Veridian's systems, the risk to PHI is direct. The control's audit evidence is the documented risk assessment that includes executive personal-account exposure as a category.

**§ 164.308(a)(5)(ii)(D), Password Management.** Procedures for creating, changing, and safeguarding passwords. The modern implementation of this control is **breach-list screening + 2FA enforcement on privileged accounts**. A covered entity or business associate that does not implement these is not compliant in spirit even if they technically satisfy the rule's vague language by having "procedures."

**§ 164.312(d), Person or Entity Authentication.** Verify that the person or entity seeking access is the one claimed. Credential-stuffing attacks defeat this control directly when reused passwords succeed, the attacker, having authenticated, is from the system's perspective the legitimate user. The control's only defense against this attack class is the AAL2-equivalent multi-factor requirement; password-only authentication satisfies the control's bare wording but not its intent.

Audit evidence for the HIPAA Security Rule includes the covered entity / business associate's documented risk assessment, technical-control implementation evidence, BAA records, and, for any Veridian-side security event, the incident-response procedure that triggered.

### HITRUST CSF v11

The HITRUST CSF (Common Security Framework) is the de facto certification framework healthcare organizations use to attest to multi-source compliance (HIPAA + NIST 800-53 + ISO 27001 + state regulations) in a single audited program.[^hitrust-csf-v11-hitrust-alliance] Veridian's HITRUST certification is the gating credential for several of their major-payer customer renewals.

HITRUST CSF v11 has three control families that apply directly to Aaron's case:

**01.b, Identification and Authentication.** Covers the full identity-and-access-management control surface: password complexity, breach-screening, MFA enforcement, account lifecycle, session management. HITRUST's authoritative-source mapping ties this back to HIPAA Security Rule § 164.312(d), NIST 800-53 IA-5, ISO 27001 A.5.16, and PCI-DSS Req 8. For Veridian's audit cycle, the control's implementation must be demonstrable across all in-scope systems.

**01.q, User Identification and Authentication for Privileged Accounts.** Heightened requirements for accounts with elevated access. A CMO's accounts at a healthcare-analytics SaaS qualify. Aaron will have legitimate access to PHI-handling systems in the course of his role. The control requires stronger authentication (typically AAL2 minimum, AAL3 preferred), additional logging, and shorter session timeouts for privileged accounts.

**13.b, Awareness and Training.** Security awareness training requirements. The personal-OPSEC piece belongs in the annual training cycle for VP-and-above roles, for an awkward reason: *the executives reading this brief are the same people whose password-reuse habits put the company at risk.* HITRUST's audit expectation is documented training delivery plus measurable retention, usually through a post-training assessment.

Audit evidence for HITRUST includes the documented HITRUST MyCSF assessment (the platform Veridian uses to track control implementation), the external assessor's report, and any interim self-assessments. HITRUST certification has both validated (third-party assessed) and self-assessed tiers; Veridian holds the validated certification.

### NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule

NIST SP 800-66 Rev. 2 (published February 2024; supersedes Rev. 1) is the implementation guide for HIPAA covered entities and business associates.[^nist-800-66] It maps each HIPAA Security Rule requirement to specific NIST 800-53 controls and provides practical implementation guidance. Section 4 (Administrative Safeguards) covers the risk-management and password-management practices that apply to Aaron's case; Section 5 (Technical Safeguards) covers the authentication controls.

Veridian uses 800-66 Rev. 2 as the operating-procedural reference for HIPAA compliance, the document translates the Security Rule's somewhat-vague language into specific implementable controls. The reference matters because audit findings against HIPAA tend to cite the Rule's text but be resolvable by implementing the 800-66-described controls.

### CIS Critical Security Controls v8.1 — Controls 5, 6, 14

The Center for Internet Security publishes the CIS Critical Security Controls, currently at **version 8.1** (published 2024).[^cis-critical-security-controls-v8] Three controls apply to Aaron's case:

**Control 5, Account Management.** Including safeguard 5.4 (use unique passwords per account). The control's plain reading targets organizational accounts, but the principle extends to the personal-account ecosystem when those personal accounts have crossover-risk with organizational systems. For Aaron, 5.4 is the safeguard whose violation is the headline finding.

**Control 6, Access Control Management.** Safeguards 6.3 (require MFA for externally-exposed applications) and 6.5 (require MFA for administrative access). For Aaron's Veridian-domain accounts, these are the controls Veridian must enforce; for his personal accounts, these are the controls his personal-side services should implement and that he should enable where available.

**Control 14, Security Awareness and Skills Training.** Safeguard 14.5 specifically covers training on the dangers of credential reuse. The training cost is modest; the operational impact is that future Aaron-equivalents arrive at Veridian with the password-manager-and-2FA habits already in place.

### OWASP Top 10:2025 — A07:2025 Authentication Failures

The OWASP Top 10:2025 is the current edition. A07:2025, Authentication Failures (renamed from "Identification and Authentication Failures" in 2021, same slot), covers the application-layer weaknesses that make credential stuffing work: permitting brute-force attempts, permitting credential stuffing itself, ineffective credential recovery, missing or ineffective multi-factor authentication, default or weak passwords, and session identifiers exposed in URLs.[^owasp-a07-2025]

The 2025 edition's reshuffle moved Security Misconfiguration up to A02 (from A05 in 2021) and added two new categories. Software Supply Chain Failures at A03, and Mishandling of Exceptional Conditions at A10. Cryptographic Failures moved down to A04. Authentication Failures held its A07 slot but got a slight renaming.

For Aaron's case, A07:2025's most-relevant content is the credential-stuffing prevention guidance: rate-limiting at the application layer, breach-list screening at password set, mandatory MFA for accounts handling sensitive data, anomaly detection on login patterns. These are the controls Veridian's HIPAA-handling systems should already implement; they are also the controls Aaron's personal-account ecosystem should implement (and largely does, in modern 2026, the legacy accounts where the reuse persists are the gap).

### CWE-521, CWE-262, CWE-309

The Common Weakness Enumeration catalog has three entries that apply to Aaron's case:

**CWE-521, Weak Password Requirements.**[^cwe-521] The application allows a password that does not satisfy modern strength requirements. `BostonStrong#2013` would actually satisfy many length-and-character-class checks (15 characters, mixed case, digits, symbol), but those checks miss the more relevant weakness, which is that the password appears in published breach corpora. Modern CWE-521 mitigation includes breach-list screening, not just complexity checking.

**CWE-262, Not Using Password Aging.**[^cwe-262] The legacy weakness: a password that is never rotated. Read it with modern eyes, because NIST SP 800-63B-4 has *deprecated* forced periodic rotation absent evidence of compromise. Current practice is *event-driven rotation*, triggered when a credential shows up in a new breach corpus or a suspicious login fires. Aaron's case is exactly that kind of event. CWE-262 is still a useful historical reference; it just no longer describes best practice.

**CWE-309, Use of Password System for Primary Authentication.** A more recent weakness flagging the *category* of password-only authentication as itself a vulnerability in 2024+.[^cwe-309] The mitigation is multi-factor authentication, ideally phishing-resistant. For Aaron's high-value accounts, password-only authentication is the underlying weakness that makes any credential-corpus exposure exploitable.

### MA 201 CMR 17.04 — Massachusetts Data Security Regulation

Massachusetts has the United States' strongest state-level data security regulation: **201 CMR 17.00**, codifying minimum security standards for any person or entity that owns or licenses personal information about a Massachusetts resident. Veridian is headquartered in Boston with approximately 70% of its staff in Massachusetts, so 201 CMR 17.00 applies to the company directly, and because the regulation also applies to entities that *do business with* Massachusetts residents (regardless of the entity's own location), it applies to Veridian's customer base too.

**17.04(1)(b), Secure user authentication protocols.** Requires control over user passwords, including assignment, secure transmission, and reasonable controls against unauthorized access. The modern interpretation includes breach-list screening + MFA for accounts handling personal information. Massachusetts breach-notification requirements (M.G.L. c. 93H) trigger on any unauthorized access to "personal information" of a Massachusetts resident, which includes credentials in combination with name and identifier, within "as soon as practicable and without unreasonable delay."

For Aaron specifically, Massachusetts residence (Brookline) means 201 CMR 17.00 protections apply to Aaron *as a data subject* if any of his Veridian-side credentials were exposed; for the Veridian-side compliance posture, 201 CMR 17.00 requires the controls Veridian has presumably already implemented through HIPAA + HITRUST.

### HHS HPH-CPGs — Healthcare and Public Health Cybersecurity Performance Goals

The Department of Health and Human Services published the **Healthcare and Public Health Cybersecurity Performance Goals (HPH-CPGs)** in 2024, with subsequent updates through 2025-2026.[^hhs-healthcare-and-public-health] The CPGs are tiered into *Essential Goals* (the baseline expected of every healthcare entity) and *Enhanced Goals* (the more advanced controls for larger or higher-risk entities).

Two Essential Goals apply to Aaron's case:

- **The Essential CPG on Phishing-Resistant Multi-Factor Authentication.** MFA on email, remote access, and privileged accounts. Phishing-resistant (FIDO2/passkeys) is the named target. For Veridian's privileged-account population, including Aaron, this is the Essential-tier expectation. (HHS has renumbered CPG identifiers across document revisions; refer to the current HPH-CPG document at hphcyber.hhs.gov for the live identifier.)
- **Strong and Unique Passwords.** Across the organization. Personal-account hygiene for organizational leaders sits in the Enhanced tier, which Veridian targets given its mid-sized scale and Business-Associate status.

The HPH-CPGs are not regulatory mandates in themselves, they are HHS recommendations. But they are increasingly cited in cyber-insurance underwriting questionnaires and in BAA contract terms; the gap between "recommendation" and "expected baseline" closes as the document matures.

### MITRE ATT&CK — reconnaissance as a documented tactic

**[T1591.002, Gather Victim Org Information: Business Relationships](https://attack.mitre.org/techniques/T1591/002/)**[^t1591-002]

It is worth noticing that ATT&CK has a whole tactic for what this level
does. Reconnaissance is not a preamble to the attack; it is part of it,
and it is the phase where a defender has the least visibility because
none of it touches their infrastructure.

Business relationships matter specifically for Veridian because it is a
Business Associate. An adversary who learns which covered entities
Veridian serves has learned which organisations a Veridian credential
reaches, and that mapping is usually assembled from entirely public
material: case studies, press releases, conference talks, job postings
naming the systems a team integrates with.

The defensive response is not secrecy, which is neither achievable nor
desirable for a company that must market itself. It is assuming the
relationship map is known and making it worthless, by ensuring that
compromising Veridian does not confer standing access to any customer's
environment.

## §6 — Cert exam relevance

Eight certifications cite this material. OSINT reaches further across the cert map than most tracks because the discipline itself straddles offence (PenTest+, OSCP), defence (CySA+, CISSP) and its own specialty paths (GIAC GOSI, SANS SEC487).[^cert-oscp][^cert-cissp] Same treatment for each below, and the sample questions are the useful part, since a pentest exam and a GRC exam will ask about the same leaked password in very different ways.

### CompTIA Security+ — current version SY0-701

Security+ SY0-701 (current; superseded SY0-601 in November 2023, SY0-601 retired July 31, 2024) covers credential-based attacks in two domains.[^cert-security-plus]

- **Domain 1, General Security Concepts.** Objective 1.4 covers cryptographic solutions, including hash functions and the relationship between hash storage and credential recovery. The exam tests recognition of password-hashing schemes (MD5, SHA-1, bcrypt, scrypt, Argon2) and their relative resistance to GPU-accelerated cracking.
- **Domain 4, Security Operations.** Objective 4.6 covers identity and access management, including MFA, password policy, and breach-screening. Objective 4.1 covers IOC-driven detection, the credential-stuffing detection layer.

**Sample question framing:**

> A security analyst reviewing a recent breach corpus identifies the same cleartext password recovered from two separate breaches dated 2012 and 2014, both associated with the same email address. Which of the following BEST describes this finding?
>
> A. A coincidence; common passwords appear in many breaches independently
> B. A high-confidence credential-reuse signal warranting account-specific remediation
> C. Evidence that the user's password manager was compromised
> D. An indication that both services shared the same authentication backend

The trap is A. **B** is correct. Two breaches with matching cleartexts is the standard credential-reuse-detection heuristic; Security+ tests this. C is unsupported. D is implausible (LinkedIn and LiveJournal don't share infrastructure).

### CompTIA PenTest+ — current version PT0-003

PenTest+ PT0-003 (current; superseded PT0-002 on December 17, 2024, PT0-002 retired June 17, 2025).[^cert-pentest-plus] The OSINT track maps to two domains:

- **Domain 1, Engagement Management.** Scoping and rules-of-engagement discipline. The Veridian engagement's narrow scope (one email address, read-only, no minors, no active testing) is the kind of constraint Domain 1 explicitly tests, *what can you legally do, given this authorization?*
- **Domain 2, Reconnaissance and Enumeration.** Objective 2.2 covers passive reconnaissance, including breach-data corpora, public-records pivoting, and identity enumeration. HIBP and the broader breach-aggregator ecosystem (Dehashed, IntelX, Constella, SpyCloud) are named tools in the curriculum.

### CompTIA CySA+ — exam codes CS0-003 / CS0-004

CompTIA CySA+, CS0-003 was the legacy exam revision (in market since June 2023); **CS0-004 launched on 23 June 2026**, with CS0-003 retiring 22 December 2026.[^cert-cysa] By the time anyone reads this much past the review date, CS0-004 will be the only sittable version. The OSINT track maps to:

- **Domain 1, Security Operations.** Objective 1.6 covers OSINT-driven threat intelligence, including breach-corpus enrichment for executive-protection use cases.
- **Domain 3, Incident Response and Management.** Credential-compromise detection and the response workflow when a personal-credential exposure is identified.

### SANS GOSI — GIAC Open Source Intelligence

SANS GIAC's **GOSI** certification is the formal OSINT-discipline cert from the GIAC family.[^sans-giac-gosi-open-source] The exam covers the breach-corpus aggregator ecosystem (HIBP, Dehashed, IntelX, Constella, SpyCloud), identity-pivoting techniques (sherlock, Maigret, the public-records lookup pattern), the broader OSINT-tradecraft toolkit, and, importantly for engagement work, the *reporting and scope discipline* that turns OSINT findings into client-deliverable briefs.

The Veridian engagement is the textbook GOSI exam scenario: defined scope (single subject, single email), defined output (a finding-not-conclusion brief delivered to the engagement's authorizing counsel), explicit OOS items (family members, organizational accounts, active testing). GOSI candidates are tested on the discipline of *staying inside the scope even when the lookup surfaces tempting follow-up threads.*

### SANS SEC497 — Practical Open-Source Intelligence (OSINT)

**SEC497** (which effectively replaced SEC487 in the SANS catalog) is SANS's flagship practitioner OSINT course. It is not a certification by itself (the matching cert is GOSI) but the course curriculum is the closest thing the industry has to a standardized OSINT-engagement training program. The course covers HIBP and the paid-corpus-enrichment ecosystem, the legal and ethical considerations for OSINT engagements (including the minors exclusion, the active-testing boundary, the right-to-be-forgotten interactions in GDPR-covered jurisdictions), and the reporting discipline.

For Driftwood internally, SEC497 is the recommended baseline for any consultant doing OSINT engagement work. The Veridian scope discipline, exactly what we just did in §2, is the kind of procedural reflex SEC497 trains.

### OSCP / OSWE

The Offensive Security Certified Professional (OSCP) and the more advanced Offensive Security Web Expert (OSWE) both treat OSINT as the first-phase activity in any engagement.[^cert-oswe] The OSCP exam allocates time to information-gathering before active exploitation; the OSWE exam similarly expects pre-engagement OSINT.

For credential-reuse exploitation specifically, both certs teach the canonical workflow: identify the target's email addresses (via OSINT), check those addresses against breach corpora (HIBP free tier plus paid enrichment for the cleartext recoveries), generate a credential-stuffing wordlist from the recovered values plus rule-mutated variants, test against the in-scope authentication endpoints under the engagement's authorization.

The Veridian engagement does *not* execute the credential-stuffing step (out of scope), but the OSCP candidate who runs the same lookup on a target machine would absolutely use the recovered `BostonStrong#2013` value as the first password to try.

### CISSP

CISSP (current 2024 CBK refresh; next refresh expected 2027). The OSINT track touches two domains.

- **Domain 1, Security and Risk Management.** Threat intelligence as a discipline, including OSINT-driven personal-exposure assessments for organizational leaders. The procedural framing (the General Counsel's role, the scope authorization, the brief-not-raw-output delivery pattern) lives in this domain.
- **Domain 5, Identity and Access Management.** Password policy, breach-screening, MFA. The technical controls that mitigate the Aaron finding.

**Sample question framing:**

> As the CISO of a HIPAA-covered Business Associate, you receive a finding from your security partner indicating that a newly-hired executive has a publicly-recovered cleartext password that appears in two breach corpora and matches a publicly-derivable personal token. Which of the following should be your PRIMARY focus?
>
> A. Compel the executive to immediately rotate all personal account passwords
> B. Implement phishing-resistant MFA enforcement on all Veridian-domain executive accounts and standardize personal-exposure checks for all new executive hires as part of onboarding
> C. Notify the affected executive's HR file and consider whether the finding warrants reconsideration of the hire
> D. Engage outside counsel to determine HIPAA notification obligations

The CISSP answer is the structural one. **B** is correct, the *primary focus* at the CISO level is the institutional control + the onboarding process change. A is the executive's own work (and the CISO can recommend it, but can't compel personal account rotations). C is inappropriate (a personal-credential finding is not an HR matter). D is premature (no PHI has been confirmed exposed). CISSP consistently rewards the answer that builds the durable institutional control.

### GIAC GCIH — Certified Incident Handler

GIAC GCIH covers the incident-response side of credential-stuffing attacks.[^cert-gcih] The exam includes the detection-and-response workflow for credential-stuffing campaigns, recognizing the IOC signature (high-volume login attempts from distributed IPs, single-attempt-per-account patterns, geographic anomalies), responding to confirmed compromise (forced password rotation, MFA enforcement, session invalidation), and the post-incident analysis (which credentials were used, where else they might be reused, what services should be notified).

The Veridian engagement is *pre-incident* OSINT, not incident response, but the GCIH curriculum's IR-side handling of credential-stuffing events is the operational mirror of what Aaron's personal services are presumably implementing on the defensive side.

## §7 — What a defender does

Every defender at a healthcare organization holding sensitive data, and every General Counsel who has had to commission an executive-protection review, eventually works a case like this. Usually with less warning than Marisol had.

**1. Deliver the finding to Marisol, in writing, with care for tone.** The deliverable is a brief: the lookup methodology, the corpora checked, the date and authorization, the five breaches Aaron's address appears in, the two-corpus cleartext match, the reuse-inference framing, and explicit out-of-scope statements ("we did not query Veridian-domain accounts; we did not active-test the recovered credential; we did not enumerate family members"). Marisol takes the brief, writes the version that reaches Aaron, makes the decision about executive-protection escalation. The forensic examiner's contribution is the small, exact data point, not the conclusion about what Veridian should do.

**2. For Aaron specifically.** Put every account he holds behind 2FA where it is offered, in this order of preference: a FIDO2 hardware key (Yubikey 5, Titan) or a platform passkey for the high-value accounts; a TOTP authenticator app (Microsoft Authenticator, Google Authenticator, Authy) for everything else; SMS only as a last-resort fallback, and never as the *only* second factor, because SMS falls to SIM-swap attacks. Move him onto a password manager (1Password, Bitwarden, Dashlane, it barely matters which) with a unique random password per account.[^1password-password-manager-consumer-business][^bitwarden-open-source-password-manager] Rotate anything containing a publicly derivable token like `Boston*`, `Marathon*` or `Brookline*`, since credential-stuffing rule mutators enumerate exactly those automatically. For the high-impact accounts (primary email, financial, healthcare portals) turn on login-anomaly notifications and review login history monthly.

**3. For Veridian.** Standardize personal-exposure checks as part of every executive-hire onboarding cycle. The cost is modest (~$50-200 per check via paid corpus-enrichment services, or free with HIBP plus internal effort), and the value is the baseline that catches the Aaron-class finding before the hire shows up to a board meeting. For privileged Veridian-domain accounts (CMO, CFO, CTO, CEO, CISO, GC, COO), enforce phishing-resistant MFA, don't accept OTP-only on those tiers. Subscribe to a continuous-monitoring service for executive personal addresses (Constella Intelligence, Recorded Future, SpyCloud, Have I Been Pwned's enterprise tier) so the manual lookup we just did becomes a daily automated alert.

**4. For the broader executive-OPSEC layer.** Train executives on the personal-OPSEC threat model. Most executives don't know that their personal-account ecosystem is connected to their professional-account ecosystem through password reuse, recovery-email chaining, or shared device exposure. The training is 30 minutes of focused content per year for VP+ tier roles: what's in the breach corpora; how publicly-derivable passwords get enumerated; how to use a password manager day-to-day; how to recognize and respond to credential-recovery-targeting social engineering. Pair the training with internal materials specifically aimed at the personal-OPSEC layer.

**5. For the threat-actor side of the Aaron case.** Document the open-letter campaign and the LinkedIn DM as a low-confidence hostile-intent indicator, attached to Aaron's individual risk profile. If anything escalates, additional DMs, in-person sightings, social-media targeting of family members, the indicators move from low-confidence to medium-confidence, and the incident-response runbook routes to a coordinated executive-protection response (which may include private-security retention, residential-security review, and law-enforcement notification depending on the credible-threat threshold).

**6. Sample detection rule (Sigma, generic credential-stuffing event against an externally-exposed application):**

```yaml
title: Possible credential-stuffing attempt against externally-exposed authentication endpoint
status: experimental
description: Detects authentication-event patterns consistent with
  credential-stuffing campaigns: high-volume distinct username
  attempts from a single source or from a botnet-distributed set
  of sources, each attempt with a single password try (low ratio
  of attempts per username), and a high rate of failures.
logsource:
  product: application
  service: authentication
detection:
  selection:
    event_type: 'AuthenticationAttempt'
  time_window: 5m
  group_by: source_ip
  condition: selection
  thresholds:
    distinct_usernames: '> 50'
    attempts_per_username: '<= 2'
    failure_rate: '> 0.85'
level: high
falsepositives:
  - Legitimate corporate authentication from a NAT-shared egress IP
    (review against known corporate egress ranges)
  - Automated testing or load-generation traffic from CI/CD
```

The rule's value is recognizing the *signature*, many usernames, few attempts per username, high failure rate, single source, which is the credential-stuffing pattern regardless of which specific corpus the attacker is testing against.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run the right command, `progress --detail` lists what you've unlocked.

### Adobe's cleartext password hints

**Trigger:** `hibp aaron.hines.md@gmail.com` (you ran this as the headline solve command, so the bonus fires there)

**What it teaches:** Aaron's Adobe 2013 record carries the hint *"city we lived in for residency."* This is the second layer of breach-corpus intelligence, and people forget it exists. Adobe's 2013 breach is famous for two failures. First, the password storage was structurally broken: ECB-mode 3DES with the *same key* for every password, which turns the whole corpus into one big substitution cipher. Second, the **password hint field was stored in cleartext** right next to the encrypted password, so users helpfully left notes explaining their own passwords.

The hint field collapses the password-recovery problem entirely:

- Even if the encryption hadn't been broken, the hint *names the password* often enough to be useful.
- When the encryption *was* broken (cryptanalysis of the ECB pattern was a months-long community effort), the hint corroborated each recovered plaintext.
- For passwords that *couldn't* be recovered (unique enough patterns to resist statistical analysis), the hint *plus* OSINT on the user often narrowed the candidate set to a handful of guesses.

For Aaron specifically: his hint is "city we lived in for residency." His public bio names BIDMC in Boston as his residency. The hint plus the bio narrows his Adobe-era password to a small candidate set (`Boston123`, `Boston2010`, `BIDMC2010`, etc.). For a 2025 OSINT engagement looking for credential-reuse leverage across multiple breach corpora, that's a tighter target than a brute-force ever produces.

The historical lesson is for product designers: **never store password hints in cleartext** (or, ideally, don't have a hints feature at all, the security cost vastly exceeds the user-convenience benefit). The current-day lesson is for OSINT operators: **read every field of every breach record, not just the password.** Birth dates, security-question answers, hint fields, security-Q&A pairs, account-creation IP addresses, every one of these is a separate intel layer that compounds with the others.

[Have I Been Pwned's documentation page on the Adobe breach](https://haveibeenpwned.com/PwnedWebsites#Adobe) discusses both the encryption flaw and the hint-field exposure; reading the page in full is the canonical 2026 starting point for any analyst who needs to explain to a non-technical stakeholder why "we changed our password" doesn't fix the Adobe-era exposure for anyone.

## §8 — Key takeaways

- **Two breach corpora agreeing on a cleartext is the reuse signal.** One value in one breach could be a one-off. The same value in two unrelated breaches is a *habit*, and it means the same password, or a trivially mutated version, almost certainly guards plenty of other personal accounts.
- **Publicly-derivable password roots get enumerated automatically.** Even if Aaron rotates `BostonStrong#2013` to a new value, if the new value follows the same `<personal-token>#<year>` pattern, the credential-stuffing rule-mutator that defeated the first password will defeat the second. The remediation is *random* passwords from a manager, not memorable replacements.
- **OSINT engagements live and die on scope.** The pull on every OSINT job is to keep going: sherlock the username, theharvester the domain, look at the family. Don't. Veridian's scope says one email, read-only, no minors, and the finding stays defensible precisely because the lookup stayed inside it.
- **Write findings and let the client draw the conclusions.** Marisol decides what Veridian does next, and Aaron hears it from her rather than from Driftwood. That protects the engagement's defensibility and, just as much, Aaron's dignity.
- **An executive's personal accounts are part of the company's attack surface now.** Public attention arrives faster and reaches more people than it used to. A CMO at a Series-C health-tech company can become the named subject of an organized campaign within a week, and fifteen years of quietly accumulated personal credentials suddenly matter a great deal. The lookup you ran today is the cheapest, most repeatable piece of catching up.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^nist-800-63b]: [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html).
[^nist-800-63b-nist-4]: [NIST SP 800-63B-4 (CSRC pub page)](https://csrc.nist.gov/pubs/sp/800/63/b/4/final).
[^cfr-45-164]: [HIPAA Security Rule — 45 CFR Part 164, Subpart C (HHS)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C).
[^nist-800-66]: [NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule](https://csrc.nist.gov/pubs/sp/800/66/r2/final).
[^hitrust-csf-v11-hitrust-alliance]: [HITRUST CSF v11 (HITRUST Alliance)](https://hitrustalliance.net/hitrust-framework).
[^cis-critical-security-controls-v8]: [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1).
[^owasp-a07-2025]: [OWASP Top 10:2025 — A07:2025 Authentication Failures (deep link)](https://top10.owasp.org/2025/A07_2025-Authentication_Failures/).
[^cwe-521]: [CWE-521 — Weak Password Requirements](https://cwe.mitre.org/data/definitions/521.html).
[^cwe-262]: [CWE-262 — Not Using Password Aging](https://cwe.mitre.org/data/definitions/262.html).
[^cwe-309]: [CWE-309 — Use of Password System for Primary Authentication](https://cwe.mitre.org/data/definitions/309.html).
[^have-i-been-pwned-hibp]: [Have I Been Pwned (HIBP)](https://haveibeenpwned.com/).
[^hhs-healthcare-and-public-health]: [HHS Healthcare and Public Health Cybersecurity Performance Goals (HPH-CPGs)](https://hphcyber.hhs.gov/).
[^23andme-credential-stuffing-breach-23andme]: [23andMe credential-stuffing breach — 23andMe customer notice (October 2023)](https://www.23andme.org/blog/articles/addressing-data-security-concerns/).
[^norton-lifelock-january-2023-credential]: [Norton LifeLock January 2023 credential-stuffing incident](https://www.bleepingcomputer.com/news/security/nortonlifelock-warns-that-hackers-breached-password-manager-accounts/).
[^mat-honan-how-apple-and]: [Mat Honan — "How Apple and Amazon Security Flaws Led to My Epic Hacking" — Wired, August 6, 2012](https://www.wired.com/2012/08/apple-amazon-mat-honan-hacking/).
[^dehashed-paid-breach-corpus-aggregator]: [Dehashed — paid breach-corpus aggregator](https://dehashed.com/).
[^intelx-breach-data-search-engine]: [Intelligence X (IntelX) — breach-data search engine](https://intelx.io/).
[^constella-intelligence-executive-protection-threat]: [Constella Intelligence — executive-protection threat intelligence](https://constella.ai/).
[^spycloud-credential-monitoring-platform]: [SpyCloud — credential-monitoring platform](https://spycloud.com/).
[^sans-giac-gosi-open-source]: [SANS GIAC GOSI — Open Source Intelligence certification](https://www.giac.org/certifications/open-source-intelligence-gosi/).
[^1password-password-manager-consumer-business]: [1Password — password manager (consumer + business)](https://1password.com/).
[^bitwarden-open-source-password-manager]: [Bitwarden — open-source password manager](https://bitwarden.com/).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cert-oswe]: [OffSec WEB-300 / OSWE — course syllabus](https://www.offsec.com/courses/web-300/).
[^cert-gcih]: [GIAC GCIH — Certified Incident Handler](https://www.giac.org/certifications/certified-incident-handler-gcih).
[^t1591-002]: [MITRE ATT&CK — T1591.002: Gather Victim Org Information: Business Relationships](https://attack.mitre.org/techniques/T1591/002/).
[^23andme-settlement]: [23andMe settlement filing — In re 23andMe Inc. Customer Data Security Breach Litigation (Sept 2024)](https://www.courtlistener.com/docket/68160775/in-re-23andme-inc-customer-data-security-breach-litigation/).

### Further reading

- [MITRE ATT&CK — T1589.001: Gather Victim Identity Information: Credentials](https://attack.mitre.org/techniques/T1589/001/).
- [MITRE ATT&CK — T1593: Search Open Websites/Domains](https://attack.mitre.org/techniques/T1593/).
- [MITRE ATT&CK — T1110.004: Credential Stuffing](https://attack.mitre.org/techniques/T1110/004/).
- [MITRE ATT&CK — T1078: Valid Accounts](https://attack.mitre.org/techniques/T1078/).
- [MITRE ATT&CK — T1078.004: Valid Accounts: Cloud Accounts](https://attack.mitre.org/techniques/T1078/004/).
- [HIBP Pwned Passwords API (k-anonymity, free)](https://haveibeenpwned.com/Passwords).
- [Massachusetts 201 CMR 17.00 — Standards for the Protection of Personal Information](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-residents-of-the-commonwealth).
- [SANS SEC497 — Practical Open-Source Intelligence (OSINT) — effectively replaced SEC487](https://www.sans.org/cyber-security-courses/practical-open-source-intelligence/).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
