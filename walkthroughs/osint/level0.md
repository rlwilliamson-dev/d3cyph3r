# level0@osint — Veridian's Open Letter

**Track:** OSINT · **Client:** Veridian Analytics · **Compliance regime:** HIPAA Business Associate + HITRUST CSF v11

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@osint`. If you haven't solved `level0@osint` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Veridian Analytics is one of Driftwood's healthcare-vertical clients — a mid-sized healthcare-analytics SaaS company, roughly 250 engineers, founded in 2018, headquartered in Boston with a smaller R&D office in Cambridge. They process claims and outcomes data on behalf of insurance carriers and provider networks, which makes them a **HIPAA Business Associate** under signed Business Associate Agreements with each customer. PHI handling is in scope across their entire production environment. They layer **HITRUST CSF v11** on top for the customer-facing assurance their insurance-carrier customers require — a HITRUST certification is the price of admission to most major-payer vendor contracts in the healthcare-analytics market.

Veridian came to Driftwood about fourteen months ago for HITRUST CSF readiness work — they were preparing for their first formal assessment ahead of a major payer-customer renewal that required it. We helped them through gap remediation and the assessment itself; they passed and validated certification in May. The engagement has since shifted to general security partnership: their internal security team is two people, and they call us for anything that exceeds in-house bandwidth.

OSINT and executive-protection work is a smaller but growing piece of Driftwood's practice. Healthcare and life-sciences clients pull us in when a clinical or commercial executive attracts public attention — favorable, unfavorable, or simply *visible* — and the General Counsel's office wants a baseline read on the executive's public footprint before the situation develops further.

You're on Driftwood's OSINT-engagement workstation, logged in as `intel` — the shared service account the recon team uses for client-side intelligence work. The host is set up for open-source-intelligence lookups: breach-corpus aggregators, certificate transparency tooling, certificate-issuance monitoring, IP-geolocation services, and the canonical `hibp` (Have I Been Pwned) interface plus the paid corpus-enrichment layer that surfaces cracked-hash recoveries.

Today's case opened on Friday afternoon. Marisol Vega, Veridian's General Counsel, emailed Priya. The trigger: Veridian's newly-hired Chief Medical Officer, **Dr. Aaron Hines**, has surfaced in an open-letter campaign organized by a patient-advocacy group called the "Trial Transparency Action Network." The letter, posted to Substack on 2026-05-08 and co-signed by 41 listed individuals (mostly patient-advocacy figures plus three bioethics academics), concerns a Phase III oncology-adjuvant trial Aaron's team ran at his previous employer, Helix Therapeutics, between 2021 and 2023. The trial — HLX-204 — is alleged in the letter to have had methodologically opaque adverse-event reporting. Aaron is named.

In the past week, Aaron received one identifiable LinkedIn DM from an account that referenced his home neighborhood (he lives in Brookline) and his daughter's school district (Coolidge Corner). He forwarded the DM to Veridian IT and to Marisol. The account that sent it has since gone dormant. No subsequent contact, no physical events.

Marisol's question to Driftwood, paraphrased from the call:

> *"Before I take this to the board and recommend an executive-protection vendor, I want a baseline read on Aaron's public credential exposure. If his personal accounts are wide open I want to know — both to estimate the threat actor's likely capability and to give Aaron's IT a remediation list. Don't touch his Veridian account; that's covered by our internal monitoring. Just his publicly-known personal addresses."*

The scope is unusually narrow. **In scope:** Aaron's known personal email address (`aaron.hines.md@gmail.com`), public breach-corpus lookup only, read-only OSINT. **Out of scope:** Veridian-issued credentials (the work email, his M365 account, his EHR-related accounts — Veridian's internal monitoring covers that surface, and the BAA Veridian holds with its customers obligates a specific incident-response process if a Veridian-domain credential were exposed); active testing of any account (no credential stuffing, no password spray, no anything that touches a service); Aaron's family members (the DM mentioned his daughter — **Driftwood's MSA template explicitly excludes minors from any OSINT scope**, and this is industry-standard at every reputable consultancy); social-media enumeration beyond the LinkedIn DM that triggered the engagement (no `sherlock` username pivots, no `theharvester` domain enumeration — that's a separate authorized engagement if Marisol asks for it later).

The tone Marisol wants is care. Aaron is going to learn — from the brief Marisol writes — how exposed his personal life is in public corpora. Marisol writes the brief; we deliver findings to her. Aaron does not receive raw output. The intermediation is procedurally important: a third-party consultant telling an executive *"your password is in a breach"* lands worse than the same fact from their own General Counsel.

What you don't know yet, walking in, is that Aaron's personal email appears in five breaches, and two of them surface the same cleartext password — `BostonStrong#2013`. Two distinct corpora with matching cleartexts is the high-confidence credential-reuse signal. Aaron didn't choose that string twice by coincidence.

## §2 — The solve

One command. The OSINT discipline is in what *not* to do next.

### Step 1: Read the brief

```bash
intel@osint:~$ cat engagement-notes.md
intel@osint:~$ cat subject-brief.txt
```

The engagement notes establish the regulatory frame (HIPAA Business Associate, HITRUST CSF v11, MA 201 CMR 17.00 for the Massachusetts-headquartered data security regulation, NIST 800-66 Rev. 2 as the HIPAA implementation guide), the client context (Veridian, Marisol, the Trial Transparency Action Network letter, the LinkedIn DM), and the **scope discipline** — what is and isn't authorized for today's lookup.

The subject-brief is the formal artifact: Case ID `VER-EXP-2026-002`, Aaron's biographical summary (Boston University Medical School MD 2009, MGH residency, Beth Israel Deaconess fellowship, marathon runner, recreational sailor), and the **single in-scope email address**: `aaron.hines.md@gmail.com`. It also explicitly names the out-of-scope work email (`ahines@veridian-analytics.com`) with a *do not query* instruction.

Read these before touching the lookup. The OSINT-engagement playbook is sequential: brief first, lookup second. Examining the breach corpus without the scope confirmation in hand produces findings that may have been authorized but cannot be easily proven authorized — and OSINT engagements live or die on the prove-authorized question if anything in the lookup later becomes contested.

### Step 2: Run the HIBP lookup

```bash
intel@osint:~$ hibp aaron.hines.md@gmail.com
```

The output lists five breaches Aaron's address appears in. Each entry has the breach name, the disclosure date, the exposed-data categories, and — where the paid corpus enrichment has surfaced a cleartext recovery — a description noting which cracked-hash dump contained the recovered password.

**The five breaches:**

1. **LinkedIn (2012-05).** Email addresses, passwords (SHA-1, unsalted), names, employment history. *Cleartext password recovered from cracked-hash corpus: `BostonStrong#2013`* — flagged as candidate for credential-reuse testing.

2. **Adobe (2013-10).** Email addresses, password hints (cleartext!), encrypted passwords, usernames. The Adobe breach was unusual in that the password hints themselves were stored in cleartext while the passwords were encrypted with 3DES in ECB mode — which means matching ciphertext blobs reveal matching plaintexts even without breaking the encryption. Aaron's hint is recorded as *"city we lived in for residency"* — that's its own intel value to an attacker building a guess list.

3. **MyFitnessPal (2018-02).** Email addresses, IP addresses, usernames, passwords (bcrypt). The bcrypt cost-12 hashes are largely uncracked — bcrypt with high iteration counts is computationally hostile to GPU-accelerated cracking. No cleartext in corpus for this one.

4. **LiveJournal (2014-01, disclosed 2020).** Email addresses, usernames, passwords (MD5, unsalted). *Cleartext password recovered from cracked-hash corpus: `BostonStrong#2013`*. **CONFIRMED REUSE** — same password as the LinkedIn breach.

5. **Collection #1 (2019-01).** Email addresses, passwords (aggregated cleartext). Collection #1 is an aggregator dump combining 2,000+ prior breaches. Aaron appears with seven distinct historical password fragments; the LinkedIn / LiveJournal reused value is among them.

### Step 3: Notice the reuse signal

The headline finding is in the description fields of entries 1 and 4: **the same cleartext value, `BostonStrong#2013`, recovered from two independent breaches**. The LinkedIn dump (SHA-1, fully cracked by the underground community years ago) surfaces it. The LiveJournal dump (MD5, also fully cracked) surfaces it. Aaron used the same password on both services.

Two breaches with matching cleartexts is the high-confidence reuse signal. One cleartext value in one breach could be a one-off — a service that wasn't important to the user, a throwaway. Two breaches with matching cleartexts is a *habit*. The statistical inference is that Aaron almost certainly uses some variant of `BostonStrong#YYYY` (or just `BostonStrong#2013` directly) across multiple personal accounts that he's been managing in roughly the same way for over a decade.

The supporting context strengthens the inference: the password root (`BostonStrong`) is a publicly-derivable token. Aaron is publicly a Boston resident, a marathon runner, a documented donor to the Boston Marathon Foundation. *Anyone* building a guess list against him from his publicly-available bio would generate `Boston*`, `Marathon*`, `Brookline*` candidates within the first hundred entries of a personalized wordlist. `BostonStrong#2013` (the year-suffix pattern + a personal identifier root) is the most common shape of bad password in every credential-corpus study published in the last decade. Aaron's password reuse plus public-persona derivability plus year-suffix predictability is a triple stack.

### Step 4: Stop

The work ends here. We do not test the credential. Active credential-stuffing testing is a separate authorization boundary; even with Marisol's authorization for the lookup, the credential-testing step would require a fresh statement-of-work amendment and (depending on the targets) the consent of the platforms being tested. We also do not pivot to Aaron's family members. The DM mentioned his daughter. *We do not OSINT minors.* This is Driftwood policy, industry-standard policy, and the MSA's explicit exclusion.

The forensic finding stands. Marisol decides next steps. The remediation recommendation is universal: every account Aaron owns gets a unique random password from a manager; every account that supports 2FA gets 2FA on (ideally phishing-resistant FIDO2/passkey, fallback to TOTP, never SMS for the high-value accounts); Veridian's identity controls assume Aaron's personal-side credentials are compromised and design accordingly.

### Step 5: The breadcrumb (game-world only)

In a real engagement the work stops at the finding. In D3CYPH3R the breadcrumb pattern continues:

```bash
intel@osint:~$ ssh level1@osint
level1@osint's password: BostonStrong#2013
```

This is the part that wouldn't happen in a real engagement (because we just said we don't test the credential). In the game-world, `level1@osint` simulates the next stage of the threat model: the credential actually works somewhere, and now we're examining what Aaron's reused-password footprint actually unlocked. The lesson of `level1@osint` is what an attacker gains from successful credential stuffing — that walkthrough comes later.

### If you got stuck

- If `hibp aaron.hines.md@gmail.com` returned no results, double-check the email — `aaron.hines.md@gmail.com` (with the `.md` suffix in the local part). The lookup is case-insensitive but typo-sensitive.
- If the output didn't show cleartext password values in the description fields, you may be looking at the public HIBP free-tier output; the paid corpus enrichment is what surfaces cracked-hash recoveries. In real engagements, paid services like Dehashed, IntelX, Constella Intelligence, and SpyCloud are the layer that produces the cleartext-recovery view of the breach corpora. D3CYPH3R simulates the enriched output to mirror what a real OSINT engagement workstation produces.
- If you went straight from the lookup to `ssh level1@osint` without reading `subject-brief.txt` first, the lesson of this level is the *scope discipline* — the brief is the artifact that proves the lookup was authorized. In an audit setting, the order of operations matters as much as the result.

## §3 — The vulnerability

There are three distinct vulnerabilities stacked here, and remediation needs to address all three or Aaron's threat model stays the same after this case closes.

**Failure 1 — Password reuse.** The cleartext value `BostonStrong#2013` appears in two independent breach corpora. That's the primary finding. The remediation is straightforward in principle (unique passwords from a manager) and difficult in practice (Aaron has accumulated 15+ years of personal accounts, many of them long-forgotten, and "rotate every password to a unique value" requires either reading through his full digital footprint or generating new unique values lazily as he encounters each account in normal use). The defensive forcing function — a password manager that flags reuse and generates unique replacements on the spot — is the single highest-leverage intervention.

**Failure 2 — Publicly-derivable password root.** Even if Aaron rotates his reused password to a new value, if the *new* value follows the same pattern (`BostonProud#2026`, `Brookline#2026`, `Marathon42K`), the credential-stuffing rule-mutator wordlist that defeated the first password will defeat the second. The OPSEC discipline here isn't *"don't reuse passwords"* — it's *"don't derive passwords from publicly-known facts about yourself."* The password manager solves this too (random strings have no derivable root), but only if Aaron actually uses it rather than mentally generating "memorable" replacements.

**Failure 3 — No second-factor authentication on personal accounts.** The credential-stuffing attack technique that exploits this entire failure category specifically targets accounts that have *only* password authentication. Any account with 2FA enabled — even SMS-fallback 2FA, despite SMS's well-known weaknesses — is structurally resistant to credential stuffing because the stuffer only has the password, not the second factor. The remediation is to enable 2FA on every account that supports it. For high-value personal accounts (primary email, financial, healthcare portals), the preference order is phishing-resistant authenticators first (FIDO2 hardware keys, passkeys), TOTP authenticator apps second, SMS only as a last resort.

Each failure is independently a finding. Fixing only the reuse without addressing the publicly-derivable root means the next round of compromise looks the same. Fixing both without enabling 2FA means a subsequent credential-corpus expansion (which happens roughly annually) reopens the same exposure surface. The defender's playbook lives in §7.

## §4 — Real-world parallels

Three named, well-documented incidents where credential reuse — recovered from breach corpora and used in credential-stuffing attacks against subsequent accounts — produced significant downstream consequences.

### 23andMe — October 2023

In early October 2023, attackers used credential stuffing against the genetic-testing service 23andMe, accessing approximately 14,000 user accounts directly. The compromise itself was unremarkable in scale — credential-stuffing attacks of that magnitude happen daily across the consumer internet. What made the 23andMe case notable was the *secondary blast radius*: 23andMe's relative-sharing features, which let users opt into sharing limited genetic data with relatives in the service's database, meant that the ~14,000 directly-compromised accounts gave the attackers access to data fragments for approximately **6.9 million additional users** — roughly **5.5 million** via DNA Relatives profiles plus another **1.4 million** via Family Tree profiles — who had shared with the compromised accounts.

23andMe confirmed the breach publicly on October 6, 2023. Investigation took until December for the company to begin notifying affected users. The exposed data included names, profile photos, ancestry-percentage breakdowns, locations, and (in some cases) DNA segment information — the kind of personal data that is uniquely sensitive because it does not change and cannot be rotated. Class-action litigation followed; 23andMe settled the consolidated cases for **$30 million in September 2024**. The company also filed for Chapter 11 bankruptcy in March 2025, citing the breach's financial and reputational impact as a contributing factor.

The relevance to Aaron is the underlying technique. 23andMe wasn't breached through any vulnerability in their own infrastructure. The attackers used credentials *that had been reused* from prior breaches — names like LinkedIn, MyFitnessPal, Yahoo, Adobe (the same breaches Aaron appears in) — and tested them against 23andMe's login system. Accounts where the user's 23andMe password was the same as their LinkedIn-2012 password got compromised. The remediation 23andMe imposed post-incident was mandatory 2FA on all accounts, which would have prevented the attack regardless of the password-reuse failure.

For Aaron's threat model, if `BostonStrong#2013` was reused on a healthcare-portal account, a financial-services account, or his primary email provider, those accounts are similarly exposed. The 23andMe case is the canonical proof that credential-stuffing attacks operate at scale and produce real consequences for organizations that look nothing like the original breached company.

### Norton LifeLock — January 2023

In early January 2023, Gen Digital (then Norton LifeLock's parent company) disclosed that approximately **6,450 customer accounts** had been compromised in a credential-stuffing attack between December 1, 2022 and December 12, 2022. The attackers used credentials previously exposed in third-party breaches to log into Norton LifeLock customers' accounts. For accounts that had reused passwords across the prior breach and the Norton LifeLock service, the attackers gained access to whatever was stored there — which, for some customers, included **Norton Password Manager vaults**.

The irony is the lesson. **Norton LifeLock is the identity-monitoring product.** Its customers were people who had specifically paid for a service designed to alert them to identity-theft risks. The product's premise was that consumers could outsource the vigilance — let LifeLock do the watching. And the consumers' own personal accounts, on the LifeLock product itself, were compromised because they had reused passwords across other services. The product couldn't protect them from their own credential hygiene.

Norton notified affected customers in mid-January 2023 and forced password resets on all affected accounts. The disclosure was filed with multiple state attorneys general (Maine, Vermont, others) where breach-notification statutes required it. The breach was relatively small as numbers go, but its symbolic resonance — *the identity-monitoring company can't protect itself from credential stuffing if its customers reuse passwords* — made it widely cited in subsequent credential-hygiene awareness campaigns.

For Aaron specifically, the parallel is the breadth of services where reused credentials are exploitable. Aaron has been managing personal accounts since the late 2000s. The set of services where he might have used `BostonStrong#2013` includes every credential-protected account he set up between approximately 2010 and the date he started using a password manager (if he ever did). That set is probably long — likely in the dozens, possibly in the hundreds. Some fraction of those accounts contain meaningful information about him. Without a password manager and 2FA, the entire set is exposed.

### Mat Honan — "Epic hacking" — August 2012

In August 2012, *Wired* writer Mat Honan published an extended account of an attack against his digital life. The attacker, motivated by a desire to take over his three-letter Twitter handle (`@mat`), executed a chain of compromises that took roughly an hour to complete:

1. Looked up Honan's billing address from publicly-available property records.
2. Called Amazon customer service, used the billing address plus other publicly-derivable details to add a credit card to Honan's account.
3. Called Amazon back, used the newly-added credit card as proof of identity to request a new password emailed to an attacker-controlled address.
4. Used the Amazon account's saved credit-card last-four-digits to call Apple's customer-service line and claim ownership of Honan's Apple ID, obtaining a temporary password.
5. Used the Apple ID to access Honan's iCloud, which had Find My Mac enabled.
6. Initiated remote wipes of Honan's iPhone, iPad, and MacBook simultaneously.
7. Used Apple-ID-recovery access to Honan's Gmail to extract password-reset emails for his other accounts.
8. Used the cascading access to commandeer his Twitter account.

The technical mechanism wasn't credential reuse from a breach corpus — it was a chain of customer-service-rep social engineering against Apple and Amazon, each step using one company's published verification policy against another company's published verification policy. But the *result* was identical to a credential-stuffing chain: cascading compromise across multiple personal accounts of a single individual, starting from public information, requiring no actual passwords initially.

The Honan case is the canonical case study of *cascading personal-account compromise*. It made the cover of *Wired*'s November 2012 issue under the headline "The Death of Passwords." It is cited in nearly every modern password-and-identity-management policy document. Apple and Amazon both changed their identity-verification procedures within days of the article's publication. The lesson Apple specifically drew — that account-recovery shouldn't rely on details derivable from public records — became the foundational principle of modern account-recovery design.

For Aaron at Veridian, the Honan case is the *threat model amplification* parallel. The 23andMe case shows what credential stuffing achieves at scale against one service. The Honan case shows what a determined attacker achieves against *one individual* by chaining multiple credential and identity-verification weaknesses. If a hostile party — say, someone affiliated with the Trial Transparency Action Network campaign — wanted to specifically target Aaron, the credentials we just surfaced are step one in a chain that mirrors Honan's. The lesson Marisol will draw is that protecting Aaron requires not just the credential-rotation work but the harder identity-verification work — alerting on account-recovery attempts, enabling phishing-resistant authentication, treating his personal-account ecosystem as collectively exposed.

## §5 — Frameworks, deep dive

The in-game post-mortem cites eight framework controls. Each is expanded below.

### NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management

NIST Special Publication 800-63B, currently at **Revision 4** (finalized 2025; supersedes Rev. 3), defines the federal-government baseline for authenticator selection, authentication-event handling, and credential lifecycle management. Rev. 4 introduced significant changes from Rev. 3 — a minimum-length recommendation increased from 8 characters to 15 for memorized secrets, formalization of phishing-resistant authenticators (FIDO2/passkeys as the recommended path), and explicit elimination of forced periodic rotation absent evidence of compromise.

Three sections apply directly to Aaron's case:

**5.1.1.2 — Memorized Secret Verifiers.** Verifiers SHALL compare prospective secrets against a list of values known to be commonly used, expected, or compromised. The breach-corpus screening here is explicit and named in the spec — it's exactly why services like HIBP's k-anonymity Pwned Passwords API exist. A modern password-creation flow that doesn't check the proposed password against a breach corpus is violating 800-63B-4's plain text. Aaron's personal-account services almost certainly do this now; the legacy accounts where he set the password in 2013 do not retroactively check, which is why the reuse persists.

**5.1.1.4 — Memorized Secret Compromise Response.** When a memorized secret is changed, verifiers SHALL re-check against the breach list. The intent is to catch the case where a user picks a "new" password that happens to also be in the breach corpus. For Aaron, the rotation work has to actually produce a value that doesn't appear in any corpus — a password manager's random output trivially satisfies this; a memorable replacement like `BostonStrong#2026` almost certainly doesn't.

**5.2.2 — Rate Limiting and Anomaly Detection.** Verifiers SHALL implement controls to limit credential-stuffing attacks at the authentication endpoint: rate-limiting, IP-reputation scoring, geographic-anomaly detection, device-fingerprint persistence. This is the *defender's* control on the relying-party side. Aaron can't enforce this on the services he uses — but the services he uses *do* implement these controls in 2026, which is why mass credential-stuffing campaigns produce single-digit success rates per password tested. The risk to Aaron is concentrated on services that haven't implemented these controls (typically older, less-maintained personal services) and on accounts where the credential-stuffer's session looks operationally indistinguishable from Aaron's own (e.g., logins from the United States during business hours).

800-63B-4 also covers Authenticator Assurance Levels (AAL1/AAL2/AAL3). AAL2 — multi-factor with one phishing-resistant factor — is the recommended floor for any account that handles non-public personal information. For Aaron's healthcare-portal accounts and his Veridian-domain account, AAL2 should be the minimum.

Audit evidence for 800-63B-4 compliance includes a documented authenticator policy that maps to the AAL tiers, technical implementation evidence (the password-creation flow checks against a breach corpus, the rate-limiter is configured and tested, the MFA enforcement is documented for the account categories that require it), and periodic review.

### HIPAA Security Rule — 45 CFR Part 164, Subpart C

The HIPAA Security Rule (45 CFR Part 164, Subpart C) defines the technical safeguards for protecting electronic protected health information (ePHI). Veridian is a HIPAA Business Associate by virtue of processing PHI on behalf of its insurance-carrier and provider-network customers. The Security Rule applies to every Veridian system that touches PHI, and — by extension — to the credentials used to access those systems.

Three sections bear on Aaron's case:

**§ 164.308(a)(1)(ii)(B) — Risk Management.** Implement security measures sufficient to reduce risks and vulnerabilities to a reasonable and appropriate level. Aaron's personal-credential exposure is a documented risk factor under any reasonable risk-assessment methodology — if his personal credentials are reused on Veridian-domain accounts or on any service that controls access to Veridian's systems, the risk to PHI is direct. The control's audit evidence is the documented risk assessment that includes executive personal-account exposure as a category.

**§ 164.308(a)(5)(ii)(D) — Password Management.** Procedures for creating, changing, and safeguarding passwords. The modern implementation of this control is **breach-list screening + 2FA enforcement on privileged accounts**. A covered entity or business associate that does not implement these is not compliant in spirit even if they technically satisfy the rule's vague language by having "procedures."

**§ 164.312(d) — Person or Entity Authentication.** Verify that the person or entity seeking access is the one claimed. Credential-stuffing attacks defeat this control directly when reused passwords succeed — the attacker, having authenticated, is from the system's perspective the legitimate user. The control's only defense against this attack class is the AAL2-equivalent multi-factor requirement; password-only authentication satisfies the control's bare wording but not its intent.

Audit evidence for the HIPAA Security Rule includes the covered entity / business associate's documented risk assessment, technical-control implementation evidence, BAA records, and — for any Veridian-side security event — the incident-response procedure that triggered.

### HITRUST CSF v11

The HITRUST CSF (Common Security Framework) is the de facto certification framework healthcare organizations use to attest to multi-source compliance (HIPAA + NIST 800-53 + ISO 27001 + state regulations) in a single audited program. Veridian's HITRUST certification is the gating credential for several of their major-payer customer renewals.

HITRUST CSF v11 has three control families that apply directly to Aaron's case:

**01.b — Identification and Authentication.** Covers the full identity-and-access-management control surface: password complexity, breach-screening, MFA enforcement, account lifecycle, session management. HITRUST's authoritative-source mapping ties this back to HIPAA Security Rule § 164.312(d), NIST 800-53 IA-5, ISO 27001 A.5.16, and PCI-DSS Req 8. For Veridian's audit cycle, the control's implementation must be demonstrable across all in-scope systems.

**01.q — User Identification and Authentication for Privileged Accounts.** Heightened requirements for accounts with elevated access. A CMO's accounts at a healthcare-analytics SaaS qualify — Aaron will have legitimate access to PHI-handling systems in the course of his role. The control requires stronger authentication (typically AAL2 minimum, AAL3 preferred), additional logging, and shorter session timeouts for privileged accounts.

**13.b — Awareness and Training.** Security awareness training requirements. The personal-OPSEC component — *the executives reading this brief are the same people whose password-reuse habits put the company at risk* — belongs in the annual training cycle for VP+ tier roles. HITRUST's audit expectation is documented training delivery + measurable retention (typically via post-training assessment).

Audit evidence for HITRUST includes the documented HITRUST MyCSF assessment (the platform Veridian uses to track control implementation), the external assessor's report, and any interim self-assessments. HITRUST certification has both validated (third-party assessed) and self-assessed tiers; Veridian holds the validated certification.

### NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule

NIST SP 800-66 Rev. 2 (published February 2024; supersedes Rev. 1) is the implementation guide for HIPAA covered entities and business associates. It maps each HIPAA Security Rule requirement to specific NIST 800-53 controls and provides practical implementation guidance. Section 4 (Administrative Safeguards) covers the risk-management and password-management practices that apply to Aaron's case; Section 5 (Technical Safeguards) covers the authentication controls.

Veridian uses 800-66 Rev. 2 as the operating-procedural reference for HIPAA compliance — the document translates the Security Rule's somewhat-vague language into specific implementable controls. The reference matters because audit findings against HIPAA tend to cite the Rule's text but be resolvable by implementing the 800-66-described controls.

### CIS Critical Security Controls v8.1 — Controls 5, 6, 14

The Center for Internet Security publishes the CIS Critical Security Controls, currently at **version 8.1** (published 2024). Three controls apply to Aaron's case:

**Control 5 — Account Management.** Including safeguard 5.4 (use unique passwords per account). The control's plain reading targets organizational accounts, but the principle extends to the personal-account ecosystem when those personal accounts have crossover-risk with organizational systems. For Aaron, 5.4 is the safeguard whose violation is the headline finding.

**Control 6 — Access Control Management.** Safeguards 6.3 (require MFA for externally-exposed applications) and 6.5 (require MFA for administrative access). For Aaron's Veridian-domain accounts, these are the controls Veridian must enforce; for his personal accounts, these are the controls his personal-side services should implement and that he should enable where available.

**Control 14 — Security Awareness and Skills Training.** Safeguard 14.5 specifically covers training on the dangers of credential reuse. The training cost is modest; the operational impact is that future Aaron-equivalents arrive at Veridian with the password-manager-and-2FA habits already in place.

### OWASP Top 10:2025 — A07:2025 Authentication Failures

The OWASP Top 10:2025 edition is the current standard. A07:2025 — Authentication Failures (renamed from "Identification and Authentication Failures" in the 2021 edition; slot unchanged) — covers the application-layer weaknesses that enable credential-stuffing attacks: permitting brute-force attempts, permitting credential stuffing, ineffective credential recovery, missing or ineffective multi-factor authentication, default or weak passwords, exposing session identifiers in URLs.

The 2025 edition's reshuffle moved Security Misconfiguration up to A02 (from A05 in 2021) and added two new categories — Software Supply Chain Failures at A03, and Mishandling of Exceptional Conditions at A10. Cryptographic Failures moved down to A04. Authentication Failures held its A07 slot but got a slight renaming.

For Aaron's case, A07:2025's most-relevant content is the credential-stuffing prevention guidance: rate-limiting at the application layer, breach-list screening at password set, mandatory MFA for accounts handling sensitive data, anomaly detection on login patterns. These are the controls Veridian's HIPAA-handling systems should already implement; they are also the controls Aaron's personal-account ecosystem should implement (and largely does, in modern 2026 — the legacy accounts where the reuse persists are the gap).

### CWE-521, CWE-262, CWE-309

The Common Weakness Enumeration catalog has three entries that apply to Aaron's case:

**CWE-521 — Weak Password Requirements.** The application allows a password that does not satisfy modern strength requirements. `BostonStrong#2013` would actually satisfy many length-and-character-class checks (15 characters, mixed case, digits, symbol) — but those checks miss the more relevant weakness, which is that the password appears in published breach corpora. Modern CWE-521 mitigation includes breach-list screening, not just complexity checking.

**CWE-262 — Not Using Password Aging.** The legacy weakness pattern — a password that is never rotated. Modern guidance (800-63B-4) has actually *deprecated* forced periodic rotation absent evidence of compromise; the current best practice is *event-driven rotation*, where rotation is triggered by a credential's appearance in a new breach corpus or by a suspicious-login event. The CWE-262 entry remains useful as the historical reference but should be read with the modern context.

**CWE-309 — Use of Password System for Primary Authentication.** A more recent weakness flagging the *category* of password-only authentication as itself a vulnerability in 2024+. The mitigation is multi-factor authentication, ideally phishing-resistant. For Aaron's high-value accounts, password-only authentication is the underlying weakness that makes any credential-corpus exposure exploitable.

### MA 201 CMR 17.04 — Massachusetts Data Security Regulation

Massachusetts has the United States' strongest state-level data security regulation: **201 CMR 17.00**, codifying minimum security standards for any person or entity that owns or licenses personal information about a Massachusetts resident. Veridian is headquartered in Boston with approximately 70% of its staff in Massachusetts, so 201 CMR 17.00 applies to the company directly — and because the regulation also applies to entities that *do business with* Massachusetts residents (regardless of the entity's own location), it applies to Veridian's customer base too.

**17.04(1)(b) — Secure user authentication protocols.** Requires control over user passwords, including assignment, secure transmission, and reasonable controls against unauthorized access. The modern interpretation includes breach-list screening + MFA for accounts handling personal information. Massachusetts breach-notification requirements (M.G.L. c. 93H) trigger on any unauthorized access to "personal information" of a Massachusetts resident — which includes credentials in combination with name and identifier — within "as soon as practicable and without unreasonable delay."

For Aaron specifically, Massachusetts residence (Brookline) means 201 CMR 17.00 protections apply to Aaron *as a data subject* if any of his Veridian-side credentials were exposed; for the Veridian-side compliance posture, 201 CMR 17.00 requires the controls Veridian has presumably already implemented through HIPAA + HITRUST.

### HHS HPH-CPGs — Healthcare and Public Health Cybersecurity Performance Goals

The Department of Health and Human Services published the **Healthcare and Public Health Cybersecurity Performance Goals (HPH-CPGs)** in 2024, with subsequent updates through 2025-2026. The CPGs are tiered into *Essential Goals* (the baseline expected of every healthcare entity) and *Enhanced Goals* (the more advanced controls for larger or higher-risk entities).

Two Essential Goals apply to Aaron's case:

- **2.H — Phishing-Resistant Multi-Factor Authentication.** MFA on email, remote access, and privileged accounts. Phishing-resistant (FIDO2/passkeys) is the named target. For Veridian's privileged-account population — including Aaron — this is the Essential-tier expectation.
- **Strong and Unique Passwords.** Across the organization. Personal-account hygiene for organizational leaders sits in the Enhanced tier, which Veridian targets given its mid-sized scale and Business-Associate status.

The HPH-CPGs are not regulatory mandates in themselves — they are HHS recommendations. But they are increasingly cited in cyber-insurance underwriting questionnaires and in BAA contract terms; the gap between "recommendation" and "expected baseline" closes as the document matures.

## §6 — Cert exam relevance

Equal-depth coverage for the eight certifications cited in the in-game post-mortem. OSINT touches more certs than most tracks because the discipline spans offensive (PenTest+, OSCP), defensive (CySA+, CISSP), and OSINT-specialty (GIAC GOSI, SANS SEC487) cert paths.

### CompTIA Security+ — current version SY0-701

Security+ SY0-701 (current; superseded SY0-601 in November 2023, SY0-601 retired July 31, 2024) covers credential-based attacks in two domains.

- **Domain 1 — General Security Concepts.** Objective 1.4 covers cryptographic solutions, including hash functions and the relationship between hash storage and credential recovery. The exam tests recognition of password-hashing schemes (MD5, SHA-1, bcrypt, scrypt, Argon2) and their relative resistance to GPU-accelerated cracking.
- **Domain 4 — Security Operations.** Objective 4.6 covers identity and access management, including MFA, password policy, and breach-screening. Objective 4.1 covers IOC-driven detection — the credential-stuffing detection layer.

**Sample question framing:**

> A security analyst reviewing a recent breach corpus identifies the same cleartext password recovered from two separate breaches dated 2012 and 2014, both associated with the same email address. Which of the following BEST describes this finding?
>
> A. A coincidence; common passwords appear in many breaches independently
> B. A high-confidence credential-reuse signal warranting account-specific remediation
> C. Evidence that the user's password manager was compromised
> D. An indication that both services shared the same authentication backend

The trap is A. **B** is correct. Two breaches with matching cleartexts is the standard credential-reuse-detection heuristic; Security+ tests this. C is unsupported. D is implausible (LinkedIn and LiveJournal don't share infrastructure).

### CompTIA PenTest+ — current version PT0-003

PenTest+ PT0-003 (current; superseded PT0-002 on December 17, 2024, PT0-002 retired June 17, 2025). The OSINT track maps to two domains:

- **Domain 1 — Engagement Management.** Scoping and rules-of-engagement discipline. The Veridian engagement's narrow scope (one email address, read-only, no minors, no active testing) is the kind of constraint Domain 1 explicitly tests — *what can you legally do, given this authorization?*
- **Domain 2 — Reconnaissance and Enumeration.** Objective 2.2 covers passive reconnaissance, including breach-data corpora, public-records pivoting, and identity enumeration. HIBP and the broader breach-aggregator ecosystem (Dehashed, IntelX, Constella, SpyCloud) are named tools in the curriculum.

### CompTIA CySA+ — current version CS0-003

CompTIA CySA+ CS0-003 (current as of May 2026; CS0-004 launching mid-2026 — anyone studying after June 2026 should check CompTIA's blueprint for the current code). The OSINT track maps to:

- **Domain 1 — Security Operations.** Objective 1.6 covers OSINT-driven threat intelligence, including breach-corpus enrichment for executive-protection use cases.
- **Domain 3 — Incident Response and Management.** Credential-compromise detection and the response workflow when a personal-credential exposure is identified.

### SANS GOSI — GIAC Open Source Intelligence

SANS GIAC's **GOSI** certification is the formal OSINT-discipline cert from the GIAC family. The exam covers the breach-corpus aggregator ecosystem (HIBP, Dehashed, IntelX, Constella, SpyCloud), identity-pivoting techniques (sherlock, Maigret, the public-records lookup pattern), the broader OSINT-tradecraft toolkit, and — importantly for engagement work — the *reporting and scope discipline* that turns OSINT findings into client-deliverable briefs.

The Veridian engagement is the textbook GOSI exam scenario: defined scope (single subject, single email), defined output (a finding-not-conclusion brief delivered to the engagement's authorizing counsel), explicit OOS items (family members, organizational accounts, active testing). GOSI candidates are tested on the discipline of *staying inside the scope even when the lookup surfaces tempting follow-up threads.*

### SANS SEC497 — Practical Open-Source Intelligence (OSINT)

**SEC497** (which replaced the retired SEC487 in the SANS catalog) is SANS's flagship practitioner OSINT course. It is not a certification by itself (the matching cert is GOSI) but the course curriculum is the closest thing the industry has to a standardized OSINT-engagement training program. The course covers HIBP and the paid-corpus-enrichment ecosystem, the legal and ethical considerations for OSINT engagements (including the minors exclusion, the active-testing boundary, the right-to-be-forgotten interactions in GDPR-covered jurisdictions), and the reporting discipline.

For Driftwood internally, SEC497 is the recommended baseline for any consultant doing OSINT engagement work. The Veridian scope discipline — exactly what we just did in §2 — is the kind of procedural reflex SEC497 trains.

### OSCP / OSWE

The Offensive Security Certified Professional (OSCP) and the more advanced Offensive Security Web Expert (OSWE) both treat OSINT as the first-phase activity in any engagement. The OSCP exam allocates time to information-gathering before active exploitation; the OSWE exam similarly expects pre-engagement OSINT.

For credential-reuse exploitation specifically, both certs teach the canonical workflow: identify the target's email addresses (via OSINT), check those addresses against breach corpora (HIBP free tier plus paid enrichment for the cleartext recoveries), generate a credential-stuffing wordlist from the recovered values plus rule-mutated variants, test against the in-scope authentication endpoints under the engagement's authorization.

The Veridian engagement does *not* execute the credential-stuffing step (out of scope) — but the OSCP candidate who runs the same lookup on a target machine would absolutely use the recovered `BostonStrong#2013` value as the first password to try.

### CISSP

CISSP (current 2024 CBK refresh; next refresh expected 2027). The OSINT track touches two domains.

- **Domain 1 — Security and Risk Management.** Threat intelligence as a discipline, including OSINT-driven personal-exposure assessments for organizational leaders. The procedural framing (the General Counsel's role, the scope authorization, the brief-not-raw-output delivery pattern) lives in this domain.
- **Domain 5 — Identity and Access Management.** Password policy, breach-screening, MFA. The technical controls that mitigate the Aaron finding.

**Sample question framing:**

> As the CISO of a HIPAA-covered Business Associate, you receive a finding from your security partner indicating that a newly-hired executive has a publicly-recovered cleartext password that appears in two breach corpora and matches a publicly-derivable personal token. Which of the following should be your PRIMARY focus?
>
> A. Compel the executive to immediately rotate all personal account passwords
> B. Implement phishing-resistant MFA enforcement on all Veridian-domain executive accounts and standardize personal-exposure checks for all new executive hires as part of onboarding
> C. Notify the affected executive's HR file and consider whether the finding warrants reconsideration of the hire
> D. Engage outside counsel to determine HIPAA notification obligations

The CISSP answer is the structural one. **B** is correct — the *primary focus* at the CISO level is the institutional control + the onboarding process change. A is the executive's own work (and the CISO can recommend it, but can't compel personal account rotations). C is inappropriate (a personal-credential finding is not an HR matter). D is premature (no PHI has been confirmed exposed). CISSP consistently rewards the answer that builds the durable institutional control.

### GIAC GCIH — Certified Incident Handler

GIAC GCIH covers the incident-response side of credential-stuffing attacks. The exam includes the detection-and-response workflow for credential-stuffing campaigns — recognizing the IOC signature (high-volume login attempts from distributed IPs, single-attempt-per-account patterns, geographic anomalies), responding to confirmed compromise (forced password rotation, MFA enforcement, session invalidation), and the post-incident analysis (which credentials were used, where else they might be reused, what services should be notified).

The Veridian engagement is *pre-incident* OSINT, not incident response — but the GCIH curriculum's IR-side handling of credential-stuffing events is the operational mirror of what Aaron's personal services are presumably implementing on the defensive side.

## §7 — What a defender does

The Veridian scenario is not theoretical. Every defender working at a healthcare organization handling sensitive data — and every General Counsel coordinating an executive-protection engagement — has to navigate this category of case. Here's what the work looks like.

**1. Deliver the finding to Marisol, in writing, with care for tone.** The deliverable is a brief: the lookup methodology, the corpora checked, the date and authorization, the five breaches Aaron's address appears in, the two-corpus cleartext match, the reuse-inference framing, and explicit out-of-scope statements ("we did not query Veridian-domain accounts; we did not active-test the recovered credential; we did not enumerate family members"). Marisol takes the brief, writes the version that reaches Aaron, makes the decision about executive-protection escalation. The forensic examiner's contribution is the small, exact data point — not the conclusion about what Veridian should do.

**2. For Aaron specifically.** Enroll every account he holds in 2FA where available, with the preference order: FIDO2 hardware key (Yubikey 5, Titan) or platform passkey for the high-value accounts; TOTP authenticator app (Microsoft Authenticator, Google Authenticator, Authy) for everything else; SMS only as a last-resort fallback (and never as the *only* second factor — SMS is itself vulnerable to SIM-swap attacks). Migrate to a password manager (1Password, Bitwarden, Dashlane — any of them) and generate unique random passwords for every account. Rotate any password that contains a publicly-derivable token like `Boston*`, `Marathon*`, `Brookline*` — these get enumerated automatically by credential-stuffing rule-mutators. For high-impact accounts (primary email, financial, healthcare portals), enable login-anomaly notifications and review the login history monthly.

**3. For Veridian.** Standardize personal-exposure checks as part of every executive-hire onboarding cycle. The cost is modest (~$50-200 per check via paid corpus-enrichment services, or free with HIBP plus internal effort), and the value is the baseline that catches the Aaron-class finding before the hire shows up to a board meeting. For privileged Veridian-domain accounts (CMO, CFO, CTO, CEO, CISO, GC, COO), enforce phishing-resistant MFA — don't accept OTP-only on those tiers. Subscribe to a continuous-monitoring service for executive personal addresses (Constella Intelligence, Recorded Future, SpyCloud, Have I Been Pwned's enterprise tier) so the manual lookup we just did becomes a daily automated alert.

**4. For the broader executive-OPSEC layer.** Train executives on the personal-OPSEC threat model. Most executives don't know that their personal-account ecosystem is connected to their professional-account ecosystem through password reuse, recovery-email chaining, or shared device exposure. The training is 30 minutes of focused content per year for VP+ tier roles: what's in the breach corpora; how publicly-derivable passwords get enumerated; how to use a password manager day-to-day; how to recognize and respond to credential-recovery-targeting social engineering. Pair the training with internal materials specifically aimed at the personal-OPSEC layer.

**5. For the threat-actor side of the Aaron case.** Document the open-letter campaign and the LinkedIn DM as a low-confidence hostile-intent indicator, attached to Aaron's individual risk profile. If anything escalates — additional DMs, in-person sightings, social-media targeting of family members — the indicators move from low-confidence to medium-confidence, and the incident-response runbook routes to a coordinated executive-protection response (which may include private-security retention, residential-security review, and law-enforcement notification depending on the credible-threat threshold).

**6. Sample detection rule (Sigma, generic credential-stuffing event against an externally-exposed application):**

```yaml
title: Possible credential-stuffing attempt against externally-exposed authentication endpoint
status: experimental
description: Detects authentication-event patterns consistent with
  credential-stuffing campaigns — high-volume distinct username
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

The rule's value is recognizing the *signature* — many usernames, few attempts per username, high failure rate, single source — which is the credential-stuffing pattern regardless of which specific corpus the attacker is testing against.

## §8 — Key takeaways

- **Two breach corpora with matching cleartexts is the high-confidence credential-reuse signal.** One value in one breach could be a one-off. Two values matching is a *habit* — the user almost certainly uses the same password (or a trivially-mutated variant) across many other personal accounts.
- **Publicly-derivable password roots get enumerated automatically.** Even if Aaron rotates `BostonStrong#2013` to a new value, if the new value follows the same `<personal-token>#<year>` pattern, the credential-stuffing rule-mutator that defeated the first password will defeat the second. The remediation is *random* passwords from a manager, not memorable replacements.
- **OSINT engagements run on scope discipline.** The natural pull on any OSINT engagement is to keep going — sherlock the username, theharvester the domain, pivot to family members. Don't. The Veridian scope says one email, read-only, no minors. The finding stays defensible because the lookup stayed in scope.
- **The forensic examiner writes findings, not conclusions.** Marisol decides what Veridian does about the finding. Aaron hears the result from Marisol, not from Driftwood. The intermediation protects both the engagement's defensibility and the executive's dignity.
- **Executive personal exposure is a real and growing attack surface.** Public-figure status now arrives faster and to more people than it did. A CMO at a Series-C health-tech company can become the named subject of an organized campaign in a week. The personal-credential surface that quietly built for fifteen years is suddenly load-bearing. The lookups we ran today are the cheapest, most repeatable piece of the work that catches up to that reality.

## §9 — Further reading

*Last reviewed: May 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

- [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [NIST SP 800-63B-4 (CSRC pub page)](https://csrc.nist.gov/pubs/sp/800/63/b/4/final)
- [HIPAA Security Rule — 45 CFR Part 164, Subpart C (HHS)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C)
- [NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule](https://csrc.nist.gov/pubs/sp/800/66/r2/final)
- [HITRUST CSF v11 (HITRUST Alliance)](https://hitrustalliance.net/product-tool/hitrust-csf/)
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1)
- [OWASP Top 10:2025 — A07:2025 Authentication Failures (deep link)](https://owasp.org/Top10/2025/A07_2025-Authentication_Failures/)
- [CWE-521 — Weak Password Requirements](https://cwe.mitre.org/data/definitions/521.html)
- [CWE-262 — Not Using Password Aging](https://cwe.mitre.org/data/definitions/262.html)
- [CWE-309 — Use of Password System for Primary Authentication](https://cwe.mitre.org/data/definitions/309.html)
- [MITRE ATT&CK — T1589.001: Gather Victim Identity Information: Credentials](https://attack.mitre.org/techniques/T1589/001/)
- [MITRE ATT&CK — T1593: Search Open Websites/Domains](https://attack.mitre.org/techniques/T1593/)
- [MITRE ATT&CK — T1110.004: Credential Stuffing](https://attack.mitre.org/techniques/T1110/004/)
- [MITRE ATT&CK — T1078: Valid Accounts](https://attack.mitre.org/techniques/T1078/)
- [MITRE ATT&CK — T1078.004: Valid Accounts: Cloud Accounts](https://attack.mitre.org/techniques/T1078/004/)
- [Have I Been Pwned (HIBP)](https://haveibeenpwned.com/)
- [HIBP Pwned Passwords API (k-anonymity, free)](https://haveibeenpwned.com/Passwords)
- [Massachusetts 201 CMR 17.00 — Standards for the Protection of Personal Information](https://www.mass.gov/regulations/201-CMR-1700-standards-for-the-protection-of-personal-information-of-residents-of-the-commonwealth)
- [HHS Healthcare and Public Health Cybersecurity Performance Goals (HPH-CPGs)](https://hphcyber.hhs.gov/performance-goals.html)
- [23andMe credential-stuffing breach — 23andMe customer notice (October 2023)](https://blog.23andme.com/articles/addressing-data-security-concerns)
- [23andMe settlement filing — In re 23andMe Inc. Customer Data Security Breach Litigation (Sept 2024)](https://www.courtlistener.com/docket/68160775/in-re-23andme-inc-customer-data-security-breach-litigation/)
- [Norton LifeLock January 2023 credential-stuffing notice — Vermont AG filing](https://ago.vermont.gov/sites/ago/files/documents/2023-01-13%20Gen%20Digital%20Notice%20of%20Data%20Breach%20to%20Consumers.pdf)
- [Mat Honan — "How Apple and Amazon Security Flaws Led to My Epic Hacking" — Wired, August 6, 2012](https://www.wired.com/2012/08/apple-amazon-mat-honan-hacking/)
- [Dehashed — paid breach-corpus aggregator](https://dehashed.com/)
- [IntelX — breach-data search engine](https://intelx.io/)
- [Constella Intelligence — executive-protection threat intelligence](https://constella.ai/)
- [SpyCloud — credential-monitoring platform](https://spycloud.com/)
- [SANS GIAC GOSI — Open Source Intelligence certification](https://www.giac.org/certifications/open-source-intelligence-gosi/)
- [SANS SEC497 — Practical Open-Source Intelligence (OSINT) — replaced retired SEC487](https://www.sans.org/cyber-security-courses/practical-open-source-intelligence/)
- [1Password — password manager (consumer + business)](https://1password.com/)
- [Bitwarden — open-source password manager](https://bitwarden.com/)
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/)
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
