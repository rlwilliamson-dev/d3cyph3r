// OSINT track levels.
//
// See levels/linux.js for the full schema documentation. OSINT-specific
// fields used by js/commands/osint.js:
//
//   sherlockResults  — { username: ["Twitter: https://...", "GitHub: ...", ...] }
//                      Each entry is a single result line as Sherlock prints it.
//   hibpResults      — { email: [{ breach, date, exposed, description? }, ...] }
//                      Have I Been Pwned breach lookup. The `description`
//                      field is shown as "Notes:" by the command and is a
//                      good place for "cracked password recovered from
//                      corpus" enrichment notes for level breadcrumbs.
//   waybackResults   — { url: [{ timestamp, snapshot_url, status }, ...] }
//                      Internet Archive snapshot timeline.
//   crtshResults     — { domain: [{ subdomain, issuer, issued }, ...] }
//                      Certificate transparency search results.
//   harvesterResults — { domain: { emails: [], subdomains: [], hosts: [] } }
//                      theHarvester output.
//   shodanResults    — { query: [{ ip, hostname, org, country, ports, banner?, tags? }, ...] }
//                      Shodan host search.
//   ipinfoResults    — { ip: { hostname, city, region, country, loc, org, postal, timezone, asn? } }
//                      ipinfo.io IP geolocation / ASN.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts (HIPAA / NIST 800-63B
// / HITRUST CSF here, for the Veridian Analytics engagement).

export const osintLevels = {

  // ── level 0 — "Veridian's Open Letter" ──────────────────────────
  // The player's first OSINT task: a HIPAA-covered healthcare-analytics
  // SaaS client's General Counsel has asked Driftwood for a personal-
  // credential exposure check on a newly-hired executive who has
  // surfaced in an open-letter campaign about a controversial trial
  // at his previous employer. The player runs `hibp` against the
  // executive's known personal email and finds five breach entries,
  // two of which surface THE SAME cleartext password — a strong
  // signal of credential reuse and the breadcrumb that gates level1.
  // The lesson is credential-reuse exposure mapped to NIST SP 800-63B
  // (breach-list screening), HIPAA Security Rule §164.308 (admin
  // safeguards), HITRUST CSF, OWASP A07 (Identification and
  // Authentication Failures), and CWE-521 (Weak Password
  // Requirements). Introduces `hibp`.
  "level0@osint": {
    password: null,
    track: "osint",
    playerUser: "intel",
    objective: "Run a personal-credential exposure check on Veridian's new CMO, Dr. Aaron Hines. Marisol Vega wants to know what's in public breach corpora against his known personal email before she decides whether to escalate to executive protection.",
    lesson: "Veridian Analytics is one of Driftwood's healthcare-vertical clients — a mid-sized healthcare-analytics SaaS company headquartered in Boston (~250 engineers, founded 2018). They handle claims and outcomes data on behalf of insurers and provider networks, which makes them a HIPAA Business Associate under signed BAAs with each customer. PHI handling is in scope across their entire production environment, and they layer HITRUST CSF v11 on top for the customer-facing assurance their insurance-carrier customers require. Their General Counsel, Marisol Vega, opened this engagement last Friday. Their newly-hired Chief Medical Officer, Dr. Aaron Hines, has surfaced in an open-letter campaign about a controversial clinical trial he ran at his previous employer (Helix Therapeutics); the campaign has produced one identifiable LinkedIn DM with a snippet of Aaron's personal information in it, and Marisol wants a baseline read on Aaron's public credential exposure before deciding whether to engage an executive-protection vendor. You're on Driftwood's OSINT-engagement workstation (the shell calls you `intel`, the shared service account the recon team uses for client-side intel work). Read welcome.md first — it explains how `hibp` works. Then read engagement-notes.md, then subject-brief.txt, then run the lookup. Read lessons-learned.md once you've seen what's in the breach corpus.",
    hibpResults: {
      "aaron.hines.md@gmail.com": [
        {
          breach: "LinkedIn (2012)",
          date: "2012-05",
          exposed: "Email addresses, passwords (SHA-1, unsalted), names, employment history",
          description: "Cleartext password recovered from cracked-hash corpus: BostonStrong#2013 — flagged as candidate for credential-reuse testing.",
        },
        {
          breach: "Adobe (2013)",
          date: "2013-10",
          exposed: "Email addresses, password hints (cleartext!), encrypted passwords, usernames",
          description: "Hint stored on record: 'city we lived in for residency'. Encrypted password not yet recovered (3DES, ECB).",
        },
        {
          breach: "MyFitnessPal (2018)",
          date: "2018-02",
          exposed: "Email addresses, IP addresses, usernames, passwords (bcrypt)",
          description: "bcrypt cost-12 — not recovered. No cleartext in corpus.",
        },
        {
          breach: "LiveJournal (2014, disclosed 2020)",
          date: "2014-01",
          exposed: "Email addresses, usernames, passwords (MD5, unsalted)",
          description: "Cleartext password recovered from cracked-hash corpus: BostonStrong#2013. CONFIRMED REUSE — same password as the LinkedIn breach above. This is the password to flag.",
        },
        {
          breach: "Collection #1 (2019)",
          date: "2019-01",
          exposed: "Email addresses, passwords (aggregated cleartext)",
          description: "Aggregated dump of 2,000+ prior breaches. aaron.hines.md@gmail.com appears with 7 distinct historical password fragments; the LinkedIn / LiveJournal reused value is among them.",
        },
      ],
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / OSINT Engagement Workstation ──────────

You're logged in as \`intel\` — the recon team's shared service
account. The host \`osint\` is our open-source-intelligence
workstation, where we run public-data lookups for clients who
want a read on their executives' / brand's / domain's exposure
to the open internet.

Today's client: Veridian Analytics. Their General Counsel,
Marisol Vega, has asked us for a personal-credential exposure
check on their new Chief Medical Officer before escalating to
executive protection. Your job: see what's in public breach
corpora against his known personal email.


─── NEW COMMANDS ──────────────────────────────────────────────

  hibp <email>      Look up an email address against the
                    Have I Been Pwned breach aggregator (and our
                    paid corpus enrichment, which surfaces
                    cleartext passwords when they were recovered
                    from cracked-hash dumps). Returns one entry
                    per breach the email appears in.


─── WHAT HIBP DOES ────────────────────────────────────────────

Have I Been Pwned (haveibeenpwned.com, Troy Hunt, 2013) is the
canonical public aggregator of credential-breach data. It ingests
breach corpora as they surface — LinkedIn 2012, Adobe 2013,
MyFitnessPal 2018, the Collection #1-5 dumps, hundreds of others
— and exposes a free email-lookup API and a Pwned Passwords
service.

Public HIBP confirms presence in a breach. Commercial enrichment
services (Dehashed, IntelX, Constella, Recorded Future) layer on
top: they ingest the same corpora AND the cracked-hash recoveries
the underground community has produced over the years. That means
for older hashed breaches (LinkedIn SHA-1 2012, LiveJournal MD5
2014, etc.) they can surface cleartext passwords that have been
recovered from the hash dumps.

For consulting work, the typical OSINT-side question isn't "is
this person in a breach?" — almost everyone is. The actionable
question is: "do their reused passwords still work anywhere?"
That's where credential-reuse-driven account takeovers come from,
and that's the question this lookup is meant to answer.

Two breaches with the SAME cleartext password is a high-
confidence reuse signal. One cleartext value in one breach could
be a one-off. Two breaches with matching cleartexts is a habit.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Veridian / Marisol / HIPAA
  2.  cat subject-brief.txt       Aaron Hines's known personal
                                  email + persona summary
  3.  hibp <his personal email>   Run the breach lookup
  4.  cat lessons-learned.md      Post-mortem (read after step 3)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Veridian Analytics — engagement notes

Client: Veridian Analytics, Inc.
Vertical: Healthcare analytics / claims processing SaaS
          (~250 engineers, founded 2018, headquartered in
          Boston with a smaller R&D office in Cambridge, MA)
Engagement: ~14 months, ongoing
Driftwood handler: Priya
Client counterpart (this case): Marisol Vega (General Counsel,
                                running the personal-exposure
                                request for the new CMO)
Compliance regime: HIPAA Security Rule (45 CFR §§ 164.302 -
                   164.318) — Veridian is a HIPAA Business
                   Associate. Signed BAAs with all customer
                   payers and providers. HITRUST CSF v11 is
                   layered on top for customer-facing assurance.
                   NIST SP 800-66 Rev. 2 (the HIPAA Security
                   Rule implementation guide) is the operating
                   reference for control mapping. State law
                   adds: MA 201 CMR 17.00 (Massachusetts data
                   security regulation, applies because the HQ
                   and ~70% of staff are in MA).

## The relationship

Veridian came to Driftwood ~14 months ago for HITRUST CSF
readiness work — they were preparing for their first HITRUST
assessment ahead of a major payer-customer renewal that required
it. We helped them through gap remediation and the assessment
itself (passed, validated certification in May). The ongoing
engagement has shifted to general security partnership: their
internal security team is two people, and they call us for
anything that exceeds in-house bandwidth — incident response,
threat modeling, third-party assessments, and (now) executive-
exposure work.

OSINT / executive-protection work is a smaller but growing piece
of our practice. Healthcare and life-sciences clients pull us in
on it specifically when a clinical or commercial executive
attracts public attention — favorable, unfavorable, or simply
visible — and the General Counsel's office wants a baseline
read on their public footprint.

## This engagement

Marisol Vega emailed Priya last Friday afternoon. The trigger:
Veridian's new Chief Medical Officer, Dr. Aaron Hines (joined
six weeks ago from Helix Therapeutics, where he ran clinical
operations), has surfaced in an open-letter campaign organized
by a patient-advocacy group. The campaign concerns a Phase III
trial Aaron's team ran at Helix between 2021 and 2023; the
group alleges the trial's adverse-event reporting was
methodologically opaque. Aaron's name is named in the letter.

In the past week, Aaron has received one identifiable LinkedIn
DM from an account that referenced his home neighborhood (he
lives in Brookline) and his daughter's school district. He
forwarded the DM to Veridian IT and to Marisol. The account that
sent it has since gone dormant.

Marisol's question to Driftwood, paraphrased from the call:

  "Before I take this to the board and recommend an executive-
   protection vendor, I want a baseline read on Aaron's public
   credential exposure. If his personal accounts are wide open
   I want to know — both to estimate the threat actor's likely
   capability and to give Aaron's IT a remediation list. Don't
   touch his Veridian account; that's covered by our internal
   monitoring. Just his publicly-known personal addresses."

## Scope (signed by Marisol)

  IN SCOPE:
    - Aaron's known personal email addresses (in
      subject-brief.txt).
    - Public breach-corpus lookup only. Read-only OSINT.

  OUT OF SCOPE:
    - Veridian-issued credentials (his work email, his Veridian
      Microsoft 365 account, his EHR-related accounts).
    - Active testing of any account (no credential-stuffing, no
      password-spray, no anything that would touch a service).
    - Aaron's family members. The DM mentioned his daughter; we
      do not OSINT minors.
    - Social-media enumeration beyond the LinkedIn DM that
      triggered this. (\`sherlock\` and similar handle-pivot
      tools are out of scope today.)

  AUTHORIZATION:
    Marisol has authorization from Aaron and from Veridian's
    Chief People Officer. Aaron asked to be kept informed of
    findings but not to receive raw output; Marisol will write
    up the brief that goes to him.

## A note on tone

This is the kind of finding that lands harder than a technical
one. Aaron is going to learn — from the brief Marisol writes —
how exposed his personal life is in public corpora. Stick to the
artifacts. Don't editorialize about Aaron's personal-OPSEC
choices; the brief should say what's exposed and what to do
about it, not how he should feel about it.

— Priya`
        },

        "subject-brief.txt": {
          type: "file",
          content:
`VERIDIAN ANALYTICS — SUBJECT EXPOSURE BRIEF (CONFIDENTIAL)
Case ID:           VER-EXP-2026-002
Status:            ACTIVE — OSINT collection
Opened by:         Marisol Vega (General Counsel)
Date opened:       2026-05-15
Driftwood ref:     DW-OSINT-VER-2026-005

SUBJECT
─────────────────────────────────────────────────────────────
  Name:            Hines, Aaron M., MD
  Role:            Chief Medical Officer, Veridian Analytics
                   (start date: 2026-04-06, six weeks tenure)
  Prior employer:  Helix Therapeutics — Director of Clinical
                   Operations, 2018 to 2026 (eight years).
                   Ran the Phase III trial named in the open
                   letter (HLX-204, oncology adjuvant, 2021-
                   2023).
  Residence:       Brookline, Massachusetts
  Public bio:      Boston University Medical School (MD, 2009),
                   Massachusetts General Hospital residency in
                   internal medicine (completed 2014), Beth
                   Israel Deaconess fellowship in clinical
                   pharmacology (2014-2016). Identifies in his
                   Veridian bio as a Boston native, marathon
                   runner, recreational sailor.

KNOWN PERSONAL EMAIL (IN SCOPE)
─────────────────────────────────────────────────────────────
  aaron.hines.md@gmail.com
    Primary personal Gmail. In use since at least 2009 (per
    Wayback Machine of his pre-residency personal website).
    The address on his Boston Marathon Foundation donor record
    (publicly searchable). The address on his Harvard alumni
    directory entry (publicly searchable).

  This is the address Marisol has authorized for HIBP lookup.

WORK EMAIL (OUT OF SCOPE — REFERENCE ONLY)
─────────────────────────────────────────────────────────────
  ahines@veridian-analytics.com
    Veridian-issued M365 account. Do NOT query this address.
    Veridian's internal monitoring (Defender for Cloud +
    Microsoft Sentinel) covers credential-exposure surveillance
    on Veridian-domain accounts. Marisol has confirmed that no
    breach hits exist against this address as of last week's
    sweep.

CAMPAIGN CONTEXT (FROM MARISOL'S BRIEF)
─────────────────────────────────────────────────────────────
  - Open letter posted 2026-05-08 on the "Trial Transparency
    Action Network" Substack. Co-signed by 41 listed
    individuals, mostly patient-advocacy figures and three
    bioethics academics.
  - Letter calls for an independent audit of HLX-204 adverse-
    event reporting. Names Aaron as the trial's clinical-
    operations lead.
  - LinkedIn DM 2026-05-13 from now-dormant account ("DTC-
    bioethics"). Contained: a screenshot of Aaron's Brookline
    address from a publicly-indexed donor record, and a
    reference to "her school in Coolidge Corner" (Aaron's
    daughter's school district).
  - No physical events, no other contact since.

WHAT WE ARE BEING ASKED
─────────────────────────────────────────────────────────────
  Confirm:
  1. Whether Aaron's known personal email
     (aaron.hines.md@gmail.com) appears in any public breach
     corpora.
  2. For breaches that surface a cleartext password (recovered
     from cracked-hash dumps), identify any password Aaron
     appears to have reused — same value across two or more
     breaches is the high-confidence signal.
  3. Whether the reused value, if any, is the kind of password
     a non-technical person would likely still be using today.

  Findings due to Marisol by COB Wednesday 2026-05-20. She'll
  write the brief for Aaron from our raw output.

PROCEDURE
─────────────────────────────────────────────────────────────
  Run the HIBP lookup on Aaron's personal Gmail. Read what
  comes back. Note any cleartext password that appears in
  more than one breach. Do nothing further today — Marisol
  will decide whether reuse confirmation testing happens, and
  if so, that will be a separate authorized engagement.`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that Veridian's new Chief Medical Officer
has the same cleartext password (BostonStrong#2013) recovered
from two separate breach corpora — the 2012 LinkedIn dump
(SHA-1, unsalted, fully cracked years ago) and the 2014
LiveJournal dump (MD5, also fully recovered). Two independent
breaches surfacing the same value is the high-confidence
credential-reuse signal: Aaron didn't pick that string twice
by coincidence; that is his password.

You also confirmed his presence in three other breaches
(Adobe 2013, MyFitnessPal 2018, Collection #1 2019). Adobe's
encrypted passwords (3DES-ECB) are mostly not recovered; the
hint field ("city we lived in for residency") is itself a
useful piece of intel for an attacker building a guess list.
MyFitnessPal's bcrypt-cost-12 hashes have largely not been
cracked. Collection #1 is an aggregator dump that surfaces
fragments from many prior breaches, including the LinkedIn /
LiveJournal cleartext.

The headline: Aaron almost certainly still uses BostonStrong#2013
somewhere. Public breach data has just handed an adversary a
specific, testable credential against any account Aaron owns
that doesn't enforce 2FA, breach-list-screening, or both.

Your job ends here. Marisol decides next steps. The recommended
remediation is universal: every account Aaron owns gets a
unique password from a manager, every account that supports
2FA has 2FA on, and Veridian's identity controls assume that
his personal-side credentials are compromised.


─── THE BLUNT VERSION ────────────────────────────────────────

Almost everyone is in HIBP. That alone is not a finding. The
finding is that the same person used the same password across
two breaches — which is statistically equivalent to "this person
uses the same password everywhere they go." Verizon's annual
DBIR has, for over a decade, identified credential reuse as the
single most consequential cause of breach impact: an attacker
who already has one of your passwords from somewhere else
doesn't need to compromise anything technical to reach your
real-world accounts. They just type.

The two patterns that show up here are textbook:

  1. THE YEAR-SUFFIX PATTERN.  \`BostonStrong#2013\` is the
     single most common bad-password shape: a personal
     identifier + a number that means something to the user
     + a token character. People feel like the suffix makes
     the password "fresh" even when the root is permanent.
     Credential-stuffing rule-mutators (Hashcat \`-r\` rules,
     Hydra mutators) generate every reasonable variant of
     \`BostonStrong#YYYY\` automatically — so reuse plus a
     trivial year-bump still doesn't help.

  2. THE PUBLIC-PERSONA ROOT.  Aaron is publicly a Boston
     resident, public marathon runner, public donor to the
     Boston Marathon Foundation. An attacker building a guess
     list for him doesn't need to know him personally — they
     scrape his public bio and generate "Boston*", "Marathon*",
     "BMF*", "Brookline*" candidates. \`BostonStrong#2013\` would
     be in any such list.

The fix is mundane: a password manager assigns unique random
strings to every account, eliminating reuse as a category. 2FA
on the accounts that support it (which is nearly everything
that matters now) defeats credential-stuffing at the auth step.
The fix is well-known, low-cost, and disproportionately under-
adopted at the executive level — which is why personal-exposure
checks for newly-public executives keep being a useful
deliverable.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Veridian is a HIPAA Business Associate handling PHI on behalf
of its insurer and provider customers. That sets the regulatory
backdrop, but the OSINT engagement we just completed has a more
careful scope than the regulatory frame suggests:

  - We did NOT touch Veridian-domain accounts. The work email
    is out of scope; Veridian's internal monitoring covers
    that surface area, and the BAA Veridian holds with its
    customers obligates a specific incident-response process
    if a Veridian-domain credential were exposed. Stepping
    into that without prior authorization would compromise
    both the engagement and the BAA chain.

  - We did NOT test the reused credential against any account.
    Active credential testing is a separate authorization
    boundary — one that, if Marisol asks for it later, would
    require a fresh statement-of-work amendment and (depending
    on the targets) the consent of the platforms involved.
    OSINT is read-only by scope.

  - We did NOT enumerate Aaron's family. The DM mentioned his
    daughter. We do not OSINT minors. Driftwood's MSA template
    explicitly excludes minors from any OSINT scope; this is
    industry-standard at every reputable consultancy and is
    enforced even when a client casually suggests otherwise.

  - We deliver findings; Marisol writes the brief that reaches
    Aaron. The intermediation is procedurally important —
    employees being told "your password is in a breach" by a
    third-party consultant they don't know lands worse than
    being told by their own General Counsel, and the brief is
    GC-privileged in a way our raw output isn't.

The blast-radius reasoning Veridian cares about isn't directly
about the breach corpus — almost every Veridian executive is in
HIBP. It's about whether the executive's reused password could
end up granting access to a PHI-handling system through some
account Aaron owns personally (a personal email reused on a
healthcare-portal admin password, for example). That's the
threat model. The lookup we just ran is the first step.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  NIST SP 800-63B (Rev. 4) — Digital Identity Guidelines:
  Authentication and Lifecycle Management
    5.1.1.2  Verifiers SHALL compare prospective secrets
      against a list of values known to be commonly used,
      expected, or compromised (this is "breach-list
      screening" — explicitly called out in 800-63B and the
      reason HIBP's k-anonymity Pwned Passwords API exists).
    5.1.1.4  When a memorized secret is changed, verifiers
      SHALL re-check against the breach list.
    5.2.2    Verifiers SHALL implement controls to limit
      credential-stuffing (rate-limiting, anomaly detection,
      IP reputation).
    Multi-factor authentication is recommended throughout
    800-63B for any AAL2+ account. Personal accounts of
    privileged users are not formally in scope of 800-63B —
    the scope is the verifier (the service operator) — but
    the threat model 800-63B describes applies symmetrically.

  HIPAA Security Rule (45 CFR Part 164, Subpart C)
    164.308(a)(1)(ii)(B)  Risk Management — implement security
      measures sufficient to reduce risks to PHI to a
      reasonable and appropriate level. Reused credentials on
      executive personal accounts are a documented risk
      factor and should be addressed in the risk register.
    164.308(a)(5)(ii)(D)  Password Management — procedures
      for creating, changing, and safeguarding passwords.
      Breach-list screening and 2FA enforcement are the
      modern implementation of this control.
    164.312(d)              Person or Entity Authentication —
      verify that the person or entity seeking access is the
      one claimed. Credential-stuffing defeats this control
      directly when reused passwords succeed.

  HITRUST CSF v11
    01.b (Identification and Authentication) — covers the
      full identity-and-access-management control family,
      including password complexity, breach-screening, and
      MFA. HITRUST's authoritative-source mapping ties this
      back to HIPAA, NIST 800-53, and ISO 27001 controls.
    01.q (User Identification and Authentication for
      Privileged Accounts) — heightened requirements for
      privileged accounts. A CMO's accounts qualify.
    13.b (Awareness and Training) — security awareness
      training, including password hygiene and personal-
      account exposure.

  NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule
    The implementation guide for HIPAA covered entities and
    business associates. Section 4 (Administrative Safeguards)
    maps directly to the breach-screening / MFA practices
    above.

  CIS Critical Security Controls v8.1
    Control 5  Account Management — including 5.4 (use
      unique passwords).
    Control 6  Access Control Management — including 6.3
      (require MFA for externally-exposed applications) and
      6.5 (require MFA for administrative access).
    Control 14 Security Awareness and Skills Training —
      14.5 (train on the dangers of credential reuse).

  OWASP Top 10 (2025)
    A07:2025 Authentication Failures —
      includes "permits credential stuffing" and "permits
      brute-force attacks" as application weaknesses. Renamed
      from "Identification and Authentication Failures" in the
      2021 edition; slot unchanged.

  CWE
    CWE-521  Weak Password Requirements
    CWE-262  Not Using Password Aging  (adjacent — though
      modern guidance is to remove forced rotation and
      replace with breach-screening)
    CWE-309  Use of Password System for Primary Authentication
      (cautionary in 2024+: password-only auth is the
      vulnerability, MFA is the mitigation)

  MA 201 CMR 17.00 — Massachusetts data security regulation
    17.04(1)(b)  Secure user authentication protocols —
      requires control over user passwords, including
      assignment, secure transmission, and reasonable
      controls against unauthorized access. The breach-list-
      screening interpretation is now standard.

  HHS HPH-CPGs (Healthcare and Public Health Cybersecurity
  Performance Goals)
    Essential Goal: Mitigate Known Vulnerabilities — including
      MFA on email, remote access, and privileged accounts.
    Essential Goal: Strong and Unique Passwords — across the
      organization. Personal-account hygiene for
      organizational leaders is in the enhanced tier.


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — credential-based
      attacks. Domain 4 (Security Operations) — identity
      and access management, MFA, password policy.

  CompTIA PenTest+ (PT0-003)
    Domain 1 (Planning and Scoping) — OSINT is the first
      phase. Domain 2 (Information Gathering and
      Vulnerability Scanning) — passive recon, breach-data
      enumeration, public-records pivoting.

  CompTIA CySA+ (CS0-003)
    Domain 1 (Security Operations) — OSINT-driven threat
      intelligence. Domain 3 (Incident Response and
      Management) — credential-compromise detection and
      response.

  SANS GOSI (GIAC Open Source Intelligence)
    Whole-cert relevant. Breach-data corpora are a covered
    OSINT source. Identity pivoting, deconfliction, and
    reporting-to-counsel scope discipline are exam topics.

  SANS SEC487 (Open-Source Intelligence Gathering and
  Analysis)
    The flagship OSINT course. Covers HIBP, IntelX, Dehashed,
    Constella, and the broader breach-corpus ecosystem.

  OSCP / OSWE
    OSINT comes up in reporting and in the pre-engagement
    phase. Credential reuse is a recurring exploitation
    pattern.

  CISSP
    Domain 1 (Security and Risk Management) — threat
    intelligence. Domain 5 (Identity and Access Management) —
    password policy, breach-screening, MFA.

  GIAC GCIH (Certified Incident Handler)
    Credential-stuffing attack patterns and IR response are
    in the body of knowledge.

  Industry-internal: executive-protection and threat-
  intelligence vendor certifications (Pinkerton, Control
  Risks, Recorded Future Threat Intelligence Analyst). Real
  executive-exposure work happens here too.


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Reconnaissance phase — what we just did:

  T1589.001  Gather Victim Identity Information: Credentials
             (querying breach corpora for a target's
             credentials is the textbook example of this
             technique).
  T1593      Search Open Websites/Domains (HIBP / IntelX /
             Dehashed are explicitly named in the technique
             description).
  T1591.002  Gather Victim Org Information: Business
             Relationships (Aaron's prior employer, his
             public donor records, his alumni directory
             entry all support this technique on the
             attacker side; we mirrored the same lookups
             defensively).

  Initial Access — what an adversary would do with the
  finding:

  T1078      Valid Accounts — using a reused password to
             authenticate as Aaron on any of his accounts.
  T1110.004  Credential Stuffing — automated testing of
             recovered cleartext against many services.
  T1078.004  Valid Accounts: Cloud Accounts — particularly
             relevant if Aaron reuses the credential on his
             personal Microsoft / Google / Apple ID.

  Pre-engagement (PRE-ATT&CK):

  T1583      Acquire Infrastructure — the adversary's
             preparation. Out of scope for our lookup but
             named here to complete the chain.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For Aaron specifically:
     - Enroll every account he holds in 2FA where available.
       Microsoft Authenticator / Google Authenticator / a
       FIDO2 hardware key (Yubikey 5 / Titan) for the
       high-value accounts. SMS is the fallback of last
       resort and is itself vulnerable to SIM-swap.
     - Migrate to a password manager (1Password, Bitwarden,
       Dashlane). Generate unique random passwords for every
       account. Phase out the legacy reused value entirely.
     - Rotate any remaining password that contains a
       personal token. Year-suffix patterns, sports-team
       names, family names — all easy to enumerate.
     - For high-impact accounts (primary email, financial,
       social, healthcare portals): enable login-anomaly
       notifications and review the login history monthly.

  2. For Veridian:
     - Standardize personal-exposure checks for every new
       executive hire as part of the onboarding security
       brief. Cheap, easy, sets expectations.
     - For privileged Veridian-domain accounts (CMO,
       CFO, CTO, CEO, CISO, GC): enforce phishing-resistant
       MFA (WebAuthn / FIDO2). Don't allow OTP-only on
       those tiers.
     - Subscribe to a paid breach-corpus enrichment service
       (Constella, Recorded Future, SpyCloud) for
       continuous monitoring of executive personal addresses
       on a documented authorization basis. The lookup we
       just did manually becomes a daily automated alert.
     - Train executives on the personal-OPSEC layer:
       publicly-derivable password roots, year-suffix
       patterns, breach-list-screening, password-manager
       adoption. Make it part of the new-hire orientation
       for VP+ roles.
     - For the threat-actor side: document the open-letter
       campaign and the LinkedIn DM as a low-confidence
       hostile-intent indicator. If anything escalates,
       Veridian's incident-response runbook should route to
       executive protection and (if there's a physical or
       credible cyber dimension) to law enforcement.

  3. For Driftwood (us, doing this kind of work):
     - Maintain scope discipline. The natural pull on an
       OSINT engagement is to keep going — sherlock the
       username, theharvester the domain, pivot to family
       members, enumerate every social. Don't. Marisol's
       authorization said personal email only.
     - Document the lookup procedure. Which corpora were
       checked, on what date, against what email, with what
       result. The brief Marisol writes for Aaron will
       reference our methodology section.
     - Time-bound the finding. Breach corpora grow daily.
       The lookup is valid as of today; it should be
       repeated periodically (quarterly is reasonable for
       active executives) as part of the ongoing
       engagement.

  4. For the broader OPSEC lesson (defender side):
     - Executive personal exposure is a real and growing
       attack surface. Public-figure executives in
       healthcare, finance, biotech, and defense are
       targeted disproportionately. The cost of a personal-
       exposure check is low; the cost of NOT doing one
       and learning about reuse from an incident is high.
     - Pair this with a broader executive-protection
       program if the threat model warrants — physical
       security review, residential security, family
       security awareness training, monitored social-media
       footprints.


─── CLOSING THOUGHT ──────────────────────────────────────────

There is a temptation, in OSINT work, to mistake breadth for
value. You can spend a week pulling on every public thread
about a target and produce a hundred-page report. That report
will usually NOT be useful. The useful finding is the small,
exact one — the password recovered from two breaches, the
domain registered last Tuesday, the GitHub commit from 2017
that names an internal service — that lands in front of the
right person and makes a decision easier.

For Aaron specifically: a thirty-minute breach lookup has
produced a specific, testable, remediable finding. The fix
is a password manager and 2FA enrollment. The decision in
front of Marisol — whether to escalate to executive
protection — is now informed by a concrete data point about
his exposure surface rather than a general anxiety about it.
That is the contribution of an OSINT engagement done well.

In the longer arc: public-figure status now arrives faster and
to more people than it used to. A CMO of a Series-C health-
tech company can become the named subject of an organized
campaign in a week. The personal-credential surface that was
quietly building for fifteen years is suddenly load-bearing.
The lookups we ran today are the cheapest, most repeatable
piece of the work that catches up to that reality.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
