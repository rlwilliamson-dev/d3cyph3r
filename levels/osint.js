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
//   github           — { username: { profile: { name, bio, location,
//                      joined, publicRepos, followers, following },
//                      repos: { repoName: { description, language,
//                      created, updated, stars, forks, license,
//                      files: { "path/to/file": "content" } } } } }
//                      Source-control OSINT. Used by the `github`
//                      command for profile / repo-tree / file-contents
//                      lookup. Files map can include nested paths.
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
    title: "Aaron's online footprint (HIBP)",
    difficulty: "Easy",
    estimatedMinutes: 12,
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
  Authentication and Authenticator Management
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

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 1 (Security Operations)
      — OSINT-driven threat intelligence. Domain 3 (Incident
      Response and Management) — credential-compromise
      detection and response.

  SANS GOSI (GIAC Open Source Intelligence)
    Whole-cert relevant. Breach-data corpora are a covered
    OSINT source. Identity pivoting, deconfliction, and
    reporting-to-counsel scope discipline are exam topics.

  SANS SEC497 (Practical Open-Source Intelligence (OSINT))
    The flagship OSINT practitioner course (replaced the
    retired SEC487). Covers HIBP, IntelX, Dehashed, Constella,
    and the broader breach-corpus ecosystem.

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

  // ── level 1 — "Aaron's Weekend Project" ─────────────────────────
  // The Reed-equivalent for OSINT: Friday's HIBP reuse-signal finding
  // gave Marisol enough to expand scope. Over the weekend she
  // authorized handle-pivot (sherlock) and source-control (github)
  // OSINT against Aaron's developer footprint. The player walks
  // Aaron's public GitHub presence — a clinical-era personal project
  // repo (`personal-pgx-tool`) has a committed `.env` file with an
  // active personal AWS access key + secret + an OpenFDA personal API
  // key. The .env got committed in the very first commit (2023-07-14),
  // BEFORE .gitignore was set up; the .gitignore added later (with
  // `.env` listed) doesn't retroactively untrack the file. Classic
  // "history is forever" source-control credential-leak pattern.
  //
  // The AWS_SECRET_ACCESS_KEY value is the level2@osint breadcrumb
  // (where the player can `aws sts get-caller-identity` against
  // Aaron's personal AWS to map his exposure surface).
  //
  // Lesson: source-control OSINT + the secrets-in-source-code anti-
  // pattern. CWE-798 (Hard-Coded Credentials) + CWE-540 (Inclusion
  // of Sensitive Information in Source Code) + CWE-312 (Cleartext
  // Storage). MITRE T1593.003 (Search Open Websites/Domains: Code
  // Repositories) on the recon side; T1552.001 (Unsecured
  // Credentials: Credentials In Files) on the post-compromise side.
  // NIST SP 800-218 SSDF (PW.6 / PO.5) for the defender controls
  // (secret scanning, pre-commit hooks, CI gates). Introduces
  // `github`.
  "level1@osint": {
    password: "BostonStrong#2013",
    track: "osint",
    title: "Aaron's weekend project (GitHub)",
    difficulty: "Medium",
    estimatedMinutes: 18,
    playerUser: "intel",
    objective: "Map Aaron Hines's public developer footprint. Marisol expanded scope after Friday's HIBP finding — `sherlock` and the new `github` command are in scope. Identify any committed credentials or sensitive disclosures in Aaron's public GitHub.",
    lesson: "Friday's HIBP lookup confirmed Aaron's password-reuse signal (BostonStrong#2013 recovered from both LinkedIn 2012 and LiveJournal 2014). Marisol Vega expanded engagement scope over the weekend after seeing the finding: source-control OSINT (the new `github` command) and handle-pivot OSINT (`sherlock`) are now authorized for Aaron's public developer footprint. Authorization basis unchanged — Aaron + Veridian's Chief People Officer consent reconfirmed Monday morning — broader public-data lookup, still no active testing of any account, still no enumeration of family members. Today: walk Aaron's public GitHub presence and identify any sensitive disclosures (committed credentials, internal references, personal-AWS exposure) that warrant remediation. Read welcome.md first — it explains the new `github` command. Then read engagement-notes.md and subject-update.txt. Use `sherlock aaron-hines-md` to confirm the GitHub handle, then `github aaron-hines-md` to enumerate his public repos. Read lessons-learned.md once you've found what's there.",
    sherlockResults: {
      "aaron-hines-md": [
        "[+] GitHub:    https://github.com/aaron-hines-md",
        "[+] Strava:    https://strava.com/athletes/aaron-hines-md  (PRO subscriber, last activity 2026-04-21)",
        "[+] Mastodon:  https://mas.to/@aaron-hines-md  (last toot 2024-11-08; mostly clinical pharmacology)",
        "[+] Goodreads: https://goodreads.com/user/show/aaron-hines-md",
        "[+] Strava:    https://strava.com/athletes/aaron-hines-md  (segment leaderboards: Brookline / Newton hills)",
        "[-] Twitter:   404",
        "[-] Reddit:    404",
        "[-] Instagram: 404",
        "[-] TikTok:    404",
      ],
    },
    github: {
      "aaron-hines-md": {
        profile: {
          name: "Aaron Hines, MD",
          bio: "Clinical pharmacologist · PGx hobbyist · Senior CMO, Veridian Analytics · formerly Helix Therapeutics · opinions my own",
          location: "Boston, MA",
          joined: "2014-09-12",
          publicRepos: 4,
          followers: 28,
          following: 41,
        },
        repos: {
          "personal-pgx-tool": {
            description: "Personal pharmacogenomic interaction lookup tool. Uses OpenFDA + PharmGKB APIs.",
            language: "Python",
            created: "2023-07-14",
            updated: "2024-03-08",
            stars: 3,
            forks: 1,
            license: "MIT",
            files: {
              "README.md":
`# personal-pgx-tool

Personal pharmacogenomic interaction lookup tool. Built as a
weekend project during my BIDMC fellowship-era refresher, kept
alive since for personal use against OpenFDA + PharmGKB to
surface drug-interaction warnings keyed to a CYP-genotype
profile.

⚠ This is a hobby project. NOT validated for clinical use.
Do not feed real patient data into this. The caching layer
uses my personal AWS S3 for the PharmGKB JSON dumps;
rate-limited by my personal OpenFDA API key.

## Setup

\`\`\`bash
pip install -r requirements.txt
cp .env.example .env   # populate API keys + AWS creds
python app.py
\`\`\`

## License

MIT — see LICENSE.

## Contact

aaron.hines.md@gmail.com — issues/PRs welcome but I check
GitHub maybe once a quarter.
`,
              "requirements.txt":
`Flask==2.3.3
boto3==1.34.0
requests==2.31.0
python-dotenv==1.0.0
`,
              ".gitignore":
`# Local development
*.pyc
__pycache__/
.venv/
venv/
.DS_Store
instance/

# Secrets — DO NOT COMMIT
# (added 2023-09-02 after PR #4; pre-existing .env is still
#  tracked in history — see issue #2)
.env
.env.local
*.key
*.pem

# Local SQLite cache
pgx.db
*.sqlite3

# IDE
.vscode/
.idea/
`,
              ".env":
`# Personal PGx tool — local dev config
# DO NOT COMMIT — superseded by env-vars in prod
# (this got committed by accident on 2023-07-14; see issue #2)

FLASK_SECRET_KEY=devsecret-not-for-prod-aaron-2023
FLASK_DEBUG=1
DB_URL=sqlite:///pgx.db

# OpenFDA personal API key (rate-limited 1000/day)
OPENFDA_API_KEY=oFDA-aaron-personal-2023-2gqMmQrZkvL

# AWS credentials for the S3 bucket where I cache the
# PharmGKB JSON dumps — personal AWS account, NOT Veridian
AWS_ACCESS_KEY_ID=AKIAVDS3IAARONHINES23
AWS_SECRET_ACCESS_KEY=AaronHinesMD/Pers0nal+AWS/2024+BrightBlu
AWS_DEFAULT_REGION=us-east-1
S3_CACHE_BUCKET=ahines-pgx-cache
`,
              "app.py":
`"""Personal PGx tool — Flask entry point.

Local-only Flask app for personal pharmacogenomic interaction
lookups. Not for clinical use. See README.
"""
from flask import Flask, request, jsonify
from src.pgx_lookup import lookup_interactions
import os

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", "")
app.config["DEBUG"] = bool(int(os.environ.get("FLASK_DEBUG", "0")))


@app.route("/api/lookup", methods=["POST"])
def lookup():
    body = request.get_json() or {}
    drugs = body.get("drugs", [])
    genotype = body.get("genotype", {})
    if not drugs:
        return jsonify({"error": "missing 'drugs'"}), 400
    return jsonify(lookup_interactions(drugs, genotype))


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050)
`,
              "src/pgx_lookup.py":
`"""PGx lookup orchestrator — queries OpenFDA + PharmGKB caches."""
import os
import boto3
from .interactions import compute_interaction_risk
from .drug_metadata import lookup_drug_metadata

S3_BUCKET = os.environ.get("S3_CACHE_BUCKET", "")
s3 = boto3.client("s3")


def lookup_interactions(drugs, genotype):
    metadata = [lookup_drug_metadata(d) for d in drugs]
    return {
        "drugs": drugs,
        "metadata": metadata,
        "interactions": compute_interaction_risk(metadata, genotype),
    }
`,
              "src/interactions.py":
`"""Interaction-risk computation. Stub — local heuristic only."""


def compute_interaction_risk(drug_metadata, genotype):
    # Toy heuristic for the personal tool
    return [
        {"severity": "low", "note": "Stub implementation"},
    ]
`,
              "src/drug_metadata.py":
`"""Drug metadata lookup — wraps OpenFDA query."""
import os
import requests

OPENFDA_KEY = os.environ.get("OPENFDA_API_KEY", "")


def lookup_drug_metadata(drug_name):
    url = "https://api.fda.gov/drug/label.json"
    params = {"search": f"openfda.brand_name:{drug_name}", "limit": 1}
    if OPENFDA_KEY:
        params["api_key"] = OPENFDA_KEY
    r = requests.get(url, params=params, timeout=10)
    return r.json() if r.ok else {}
`,
            },
          },
          "marathon-pacer-log": {
            description: "Boston Marathon pacing spreadsheet (CSV + R notebook).",
            language: "R",
            created: "2018-02-04",
            updated: "2023-11-15",
            stars: 1,
            forks: 0,
            license: "MIT",
            files: {
              "README.md":
`# marathon-pacer-log

Boston Marathon pacing spreadsheet. CSV + R notebook for
per-mile pace planning. Race-day reference for my own runs;
some friends have forked it.

Last updated for the 2023 race; will re-baseline after
spring 2025 training block.
`,
              "pacing-2023.csv":
`mile,target_pace,gradient_adj,split
1,7:45,+0:05,7:50
2,7:42,+0:03,7:45
3,7:40,0:00,7:40
4,7:38,-0:02,7:36
5,7:38,0:00,7:38
`,
            },
          },
          "pgx-residency-notes": {
            description: "Lecture notes from BIDMC PGx fellowship. Public domain.",
            language: "Markdown",
            created: "2016-08-19",
            updated: "2018-06-22",
            stars: 0,
            forks: 0,
            license: "CC0-1.0",
            files: {
              "README.md":
`# pgx-residency-notes

Lecture notes from my BIDMC clinical pharmacology fellowship
(2014-2016). Public domain — share freely. Mostly Markdown
with embedded references to UpToDate, PharmGKB CPIC
guidelines, and the Beers Criteria.

Topics covered:
  - CYP2D6 / CYP2C9 / CYP2C19 variant pharmacology
  - Warfarin dosing (pre-DOAC era reference)
  - Clopidogrel response prediction
  - Tamoxifen + CYP2D6 (the case literature)
`,
            },
          },
          "dotfiles": {
            description: "Personal .zshrc / .vimrc / .gitconfig.",
            language: "Shell",
            created: "2015-03-21",
            updated: "2017-04-30",
            stars: 0,
            forks: 0,
            license: "MIT",
            files: {
              "README.md":
`# dotfiles

My personal .zshrc, .vimrc, .gitconfig. Boring.
`,
            },
          },
        },
      },
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / OSINT Engagement Workstation ──────────

Still \`intel\` on the same OSINT workstation. Day two of the
Veridian engagement. Friday's HIBP lookup gave Marisol enough
to expand scope — over the weekend she authorized broader
public-data enumeration against Aaron's developer footprint.
Same authorization basis (Aaron + CPO consent reconfirmed),
broader public-data scope, still no active credential testing
and still no family-member enumeration.

Today's narrow task: map Aaron's public GitHub presence,
identify any committed credentials or sensitive disclosures
that warrant same-week remediation.


─── NEW COMMAND ───────────────────────────────────────────────

  github <user>                       Profile + public repos.
  github <user>/<repo>                Repo metadata + file tree.
  github <user>/<repo> file <path>    File contents at HEAD.

      Examples:
        github octocat
        github octocat/hello-world
        github octocat/hello-world file README.md
        github -h          (full usage)


─── WHAT GITHUB-OSINT REVEALS ─────────────────────────────────

Public GitHub is one of the highest-yield OSINT sources in
existence. Developers commit secrets to source control by
mistake on a daily basis; once committed, the secret is in the
repo's history forever (or until a deliberate \`git filter-repo\`
rewrite + force-push + key rotation, which most committers
never do). Adding the secret's filename to \`.gitignore\` AFTER
the first commit doesn't help — gitignore only prevents future
staging, not historical removal.

The industry-standard remediation stack:

  GitHub Secret Scanning      Free since March 2023 for all
                              public repos. Scans every push for
                              ~200+ known secret patterns and
                              auto-revokes credentials with
                              partner integrations (AWS, GCP,
                              Stripe, Slack, dozens of others).
  TruffleHog                  Open-source pre-push / CI scanner.
                              Entropy-based + pattern-based.
  GitGuardian / Gitleaks      Commercial / open-source alternatives.
  Pre-commit hooks            detect-secrets, git-secrets.

For OSINT-side recon, the questions are: which of the target's
public repos exist, what's in them, and is there a committed
secret that hasn't been rotated. Real-world examples include:
the Uber 2014 breach (AWS keys in a public GitHub Gist;
disclosed 2015), the Toyota October 2022 incident (5 years of
GitHub-leaked DB credentials affecting ~296k customers), and
Mercedes-Benz January 2024 (PAT leaked in a public repo).
Aaron's not Uber, but the pattern is the same.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Veridian update + scope change
  2.  cat subject-update.txt      Aaron's GitHub handle + brief
  3.  sherlock aaron-hines-md     Confirm the handle across
                                  platforms (now in scope)
  4.  github aaron-hines-md       Profile + 4 public repos
  5.  github <user>/<repo>        Drill into the interesting one
  6.  github <user>/<repo> file <path>   Read what's committed
  7.  cat lessons-learned.md      Post-mortem (after step 6)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Veridian Analytics — engagement notes (continued)

Client: Veridian Analytics (HIPAA Business Associate; HITRUST
        CSF v11; NIST SP 800-66 Rev. 2 reference)
Case ID: VER-EXP-2026-002 — Aaron Hines exposure check
         (continuation)
Driftwood handler: Priya
Client counterpart: Marisol Vega (General Counsel); CPO
                    (consent reconfirmation only)
Driftwood task ID: DW-OSINT-VER-2026-005 (continued)

## What happened since the last task

Friday afternoon 2026-05-15: We delivered the HIBP finding to
Marisol — Aaron's personal Gmail surfaces in five breach
corpora, with BostonStrong#2013 recovered cleartext from both
LinkedIn 2012 (SHA-1, fully cracked) and LiveJournal 2014
(MD5, fully recovered). Two-corpus reuse is the high-confidence
signal.

Friday evening: Marisol shared the finding with Veridian's CPO
and (in summary form only) with Aaron. Aaron's reaction was the
expected one — surprised, then immediately asked what else
might be out there.

Saturday morning: Marisol emailed Priya asking to expand scope.
Specifically: she wants Aaron's developer footprint mapped,
because Aaron mentioned over the weekend that he "tinkered with
some clinical-data Python tooling back during his fellowship"
and Marisol's instinct said that's the kind of side-project
that ends up with secrets in source control. She wants to know
if anything is exposed in his public GitHub before deciding on
remediation priorities.

Sunday: Authorization paperwork updated. The scope addendum
covers:

  IN SCOPE (added):
    - Handle-pivot OSINT (\`sherlock\` and equivalent) against
      Aaron's known personal identifiers.
    - Source-control OSINT — public GitHub specifically. The
      \`github\` command (newly authorized) reads public profile
      data + public repo file contents at HEAD.

  STILL OUT OF SCOPE:
    - Veridian-issued credentials (his work email, M365, EHR-
      related accounts).
    - Active testing of any account (no credential-stuffing,
      no password-spray).
    - Aaron's family members.
    - Anything BEHIND login walls on social platforms (sherlock
      returns the public profile URLs only; we do not log in).

  AUTHORIZATION:
    Aaron + CPO consent reconfirmed Monday morning.

## Scope for this engagement

Marisol wants two things by COB Wednesday:

  1. A summary of Aaron's public GitHub presence: handle,
     account age, repo count, what kinds of projects.

  2. Any committed credentials, internal references, or
     sensitive disclosures in his public repos. If a personal-
     AWS or personal-SaaS API key is exposed in a public repo,
     it's a same-week rotation item. The HIPAA-adjacent
     consideration: if any of Aaron's personal repos cached
     real patient data (even from his clinical-era projects),
     that's a separate HIPAA exposure item — flag it
     separately for legal review.

## A note from Priya

Aaron's GitHub handle isn't immediately obvious. Two ways to
find it:

  - His LinkedIn bio signature: "github.com/aaron-hines-md"
    (he linked it from his bio years ago and never removed it).
  - \`sherlock aaron-hines-md\` will confirm the GitHub
    presence — along with whatever other platforms his handle
    appears on. Run sherlock first to validate before
    pivoting into the github command.

The pattern we're looking for is the universal one: a personal-
project repo (probably dormant) with a committed \`.env\`,
\`config.yaml\`, or \`.aws/credentials\` file. The aging pattern
matters too — if the repo is from 2023-2024 and the credentials
haven't been rotated since, they may still be active.

— Priya`
        },

        "subject-update.txt": {
          type: "file",
          content:
`VERIDIAN ANALYTICS — SUBJECT EXPOSURE BRIEF (UPDATE 1)
Case ID:           VER-EXP-2026-002
Status:            ACTIVE — scope expanded to developer footprint
Updated by:        Marisol Vega (General Counsel)
Date:              2026-05-18 (Monday)
Driftwood ref:     DW-OSINT-VER-2026-005 (continuation)

PRIOR FINDING (FRIDAY)
─────────────────────────────────────────────────────────────
  HIBP lookup against aaron.hines.md@gmail.com surfaced five
  breach hits. Cleartext password BostonStrong#2013 recovered
  from both LinkedIn 2012 and LiveJournal 2014 corpora —
  high-confidence credential-reuse signal.

  Delivered to Marisol 2026-05-15 17:42 EDT. Marisol reviewed
  the finding over the weekend with the CPO and (in summary
  form) with Aaron.

SCOPE EXPANSION (MONDAY)
─────────────────────────────────────────────────────────────
  Aaron disclosed over the weekend that he ran personal
  Python tooling for pharmacogenomic interaction lookups
  during his BIDMC fellowship and kept the side-project
  going for personal use after he moved to Helix Therapeutics.
  Marisol's question: is any of that public, and does any of
  it contain committed credentials.

  Newly authorized scope (effective Monday morning):
    - Handle-pivot OSINT (sherlock)
    - Source-control OSINT — public GitHub (github command)

  Authorization basis unchanged: Aaron + CPO consent.

SUBJECT'S KNOWN GITHUB HANDLE
─────────────────────────────────────────────────────────────
  aaron-hines-md
    Linked from his LinkedIn bio signature
    ("github.com/aaron-hines-md"). Run \`sherlock\` against
    this handle to confirm presence and surface any other
    platforms it appears on.

TODAY'S TASK
─────────────────────────────────────────────────────────────
  1. Confirm Aaron's GitHub handle is reachable.
     \`sherlock aaron-hines-md\`

  2. Enumerate his public repositories.
     \`github aaron-hines-md\`

  3. Drill into any repo that looks like a personal project
     with a meaningful chance of carrying committed secrets
     (the pharmacogenomic tool Aaron mentioned is the
     obvious one).
     \`github aaron-hines-md/<repo>\`

  4. Read configuration files (\`.env\`, \`config.yaml\`,
     \`.aws/credentials\`, etc.) for committed credentials.
     \`github aaron-hines-md/<repo> file <path>\`

  5. If you find a credential that looks live: STOP and
     report. Do not attempt to use it. Marisol decides
     whether to engage a separate active-testing engagement
     to confirm liveness.

  Findings due to Marisol by COB Wednesday 2026-05-20.

A NOTE FROM MARISOL
─────────────────────────────────────────────────────────────
  If you find committed AWS credentials and you confirm they
  haven't been rotated since the original commit date, our
  recommended remediation is:

    1. Aaron rotates the credentials TODAY via his AWS console.
    2. AWS GuardDuty review for any anomalous API calls under
       those credentials going back to the original commit
       date (GuardDuty retains 90 days; CloudTrail may have
       longer if Aaron enabled it).
    3. The exposed credentials filing — if the bucket the
       credentials gate contained any patient identifiers
       from his clinical-era work, this becomes a HIPAA
       exposure event and the BAA notification process
       applies. Veridian's BAA covers Veridian's PHI; Aaron's
       personal-project data is governed separately, and
       Aaron's prior employer (Helix Therapeutics) may
       have a stake in it.

  Do NOT attempt to enumerate Aaron's AWS account. Read-only
  OSINT today; AWS active enumeration would be a separate
  authorization boundary.`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You walked Aaron Hines's public GitHub footprint (four
repositories: personal-pgx-tool, marathon-pacer-log,
pgx-residency-notes, dotfiles) and found exactly the pattern
Priya warned you to look for. The repo \`personal-pgx-tool\`
contains a committed \`.env\` file at HEAD with four secrets:

  FLASK_SECRET_KEY      devsecret-not-for-prod-aaron-2023
                        (dev-only Flask session key; low value)
  OPENFDA_API_KEY       oFDA-aaron-personal-2023-2gqMmQrZkvL
                        (personal OpenFDA developer key; low-
                         value, rate-limited 1000/day)
  AWS_ACCESS_KEY_ID     AKIAVDS3IAARONHINES23
  AWS_SECRET_ACCESS_KEY AaronHinesMD/Pers0nal+AWS/2024+BrightBlu
                        (personal AWS account; gates the
                         ahines-pgx-cache S3 bucket per the
                         S3_CACHE_BUCKET variable)

The .env was committed in the very first commit on 2023-07-14.
The .gitignore was added later (per its inline comment, "added
2023-09-02 after PR #4") with .env explicitly listed — but
adding a file to .gitignore doesn't retroactively untrack
already-committed files. The .env remains in the repo's history
and at HEAD, has been there for over two years, has been
public-internet-accessible the whole time, and there's no
evidence in the repo that Aaron ever rotated the credentials
or filter-repo'd the history.

The headline for Marisol: Aaron has live AWS credentials sitting
in a public GitHub repo since July 2023. The AWS_ACCESS_KEY_ID
prefix AKIA marks it as a long-lived IAM user access key (not
an STS session token). Personal AWS account, not Veridian's,
but the HIPAA-adjacent consideration is real: the
S3_CACHE_BUCKET variable says \`ahines-pgx-cache\` — if Aaron
cached any real patient data into that bucket during his
clinical-era usage of the tool, that's a separate exposure
event under HIPAA, with Aaron's prior employer (Helix
Therapeutics) potentially having a stake. Marisol will route
that question through Veridian's General Counsel and Helix's
GC if it surfaces during follow-up.

Your job ends here. Do NOT attempt to use the AWS credentials
to enumerate Aaron's account — that would be a separate
authorization boundary. Marisol decides whether to engage an
active-testing engagement.


─── THE BLUNT VERSION ────────────────────────────────────────

Source-control credential leakage is the single most-discovered
credential-exposure vector in modern OSINT. GitHub's own
public-repo Secret Scanning service (free, default-on since
March 2023) detects and partner-revokes hundreds of millions
of secrets per year. The TruffleHog / GitGuardian / Gitleaks
ecosystem exists because the leak pattern is constant. Industry
research consistently identifies AWS keys, GitHub PATs, and
database connection strings as the most common credential
categories committed by accident.

The mechanic that makes this so persistent isn't carelessness
in any single moment — it's that .gitignore doesn't retroactively
untrack files. Aaron's pattern is universal: commit the .env
during initial setup before .gitignore exists, realize the
mistake later, add .env to .gitignore, never come back to
rewrite history because rewriting history is intimidating and
the credential "isn't really sensitive" (until the day it is).
The secret stays in the repo's HEAD AND in every prior commit
hash AND in every fork AND in any clone anyone made along the
way. The only correct remediation is to assume the credential
is compromised, ROTATE IT, and then optionally clean up the
history.

For OSINT-side recon, the workflow is exactly what you ran:
profile → repo list → file tree → read the .env. Real-world
attackers automate the whole pipeline with TruffleHog or
custom scrapers against GitHub's search API.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

The Veridian-side regulatory framing requires care here. Aaron's
personal-pgx-tool repo and the leaked credentials are PERSONAL,
not Veridian-issued. Veridian's BAAs with its payer and
provider customers do not cover Aaron's personal AWS account
or personal-project source code. The exposure is real, but the
notifiable-incident analysis runs through different rails:

  - For Veridian as an employer of Aaron: the exposure becomes
    a Veridian concern if there's evidence the personal-account
    compromise has crossed into Veridian-side assets. As of
    today's finding there's no such evidence; the credentials
    are in a separate AWS account ("personal AWS account, NOT
    Veridian" per the .env's own inline comment).

  - For Helix Therapeutics: if Aaron used the personal-pgx-tool
    against any patient-identifying data during his Helix
    employment (2018-2026), Helix has a stake. The S3 bucket
    \`ahines-pgx-cache\` is the artifact to interrogate — what
    did Aaron cache there. That conversation is between
    Marisol's office and Helix's GC; Driftwood doesn't drive it.

  - For Aaron personally: rotate, today. The AWS console makes
    rotation a two-minute operation. Once rotated, the
    historical credentials in GitHub are revoked; the .env
    contents stay in the repo's history but are no longer
    actionable.

  - For the BAA notification question: the BAAs Veridian holds
    with its customers obligate notification of credential
    compromise affecting Veridian's PHI handling. Aaron's
    personal-account compromise doesn't trigger BAA
    notification on its own. If anomalous activity is
    discovered on his Veridian-domain accounts in the
    follow-up review, THAT does.

Marisol will write the brief that goes to Aaron and to Veridian's
exec team. The framing for the brief is: low-likelihood-of-
material-impact, high-actionability, low-cost-to-remediate. The
finding is real and the fix is short.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  NIST SP 800-218 — Secure Software Development Framework (SSDF)
  v1.1 (Final, February 2022)
    PW.6  Configure the Compilation, Interpreter, and Build
          Processes to Improve Executable Security — includes
          secret-management discipline.
    PO.5  Implement and Maintain Secure Development
          Environments — covers secrets handling in the dev
          environment.
    PS.1  Protect All Forms of Code from Unauthorized Access
          and Tampering — includes the broader source-control
          security posture.
    SSDF was the de facto federal-acquisition baseline under
    the OMB M-22-18 / M-23-16 attestation regime through 2025.
    OMB rescinded both memoranda on January 23, 2026 via
    M-26-05; the CISA attestation Common Form is now optional.
    SSDF itself remains the most-referenced NIST framework
    for secure-development practice and continues to show up
    in commercial procurement RFPs.

  NIST SP 800-53 Rev. 5
    SA-15 (Development Process, Standards, and Tools) — includes
      secrets-handling discipline as part of the SDLC.
    IA-5 (Authenticator Management) — including (5) "Change
      Authenticators Prior to Delivery" and (7) "No Embedded
      Unencrypted Static Authenticators" — directly relevant
      to "don't commit credentials to source."

  OWASP ASVS v5.0 — Application Security Verification Standard
    Published May 30, 2025 at Global AppSec EU Barcelona.
    V13 (Configuration) — including secrets-management
      requirements. V13.x covers ensuring secrets are not in
      application source code or in build artifacts. (ASVS
      v5.0 reorganized the secrets-management chapters from
      v4's V2 → v5's V13; V14 in v5.0 is Data Protection,
      easy to conflate. Cite by current v5.0 numbering.)

  CIS Critical Security Controls v8.1
    Control 16 (Application Software Security) — including
      16.4 "Establish and Manage an Inventory of Third-Party
      Software Components" and 16.11 "Leverage Vetted
      Modules or Services for Application Security Components"
      — secrets-management belongs to this control family.

  HIPAA Security Rule (45 CFR Part 164, Subpart C)
    164.308(a)(3)(ii)(B) Workforce Clearance Procedures — for
      executives with elevated access. Not directly about
      source-control hygiene, but reinforces the "executive
      personal-account exposure is in scope" framing.
    164.308(a)(1)(ii)(B) Risk Management — credentials in
      public source control are a documented risk factor.

  CWE
    CWE-798  Use of Hard-Coded Credentials — the primary
      mapping. Hardcoded AWS keys in source are textbook
      CWE-798.
    CWE-540  Inclusion of Sensitive Information in Source Code
      — the OSINT-side view: the credential's presence in
      source enables disclosure.
    CWE-312  Cleartext Storage of Sensitive Information —
      adjacent; the .env stores secrets in cleartext.
    CWE-200  Exposure of Sensitive Information to an
      Unauthorized Actor — the umbrella parent (note: CWE-200
      is mapping-Discouraged in current MITRE guidance —
      cite the more specific CWE-798 or CWE-540 for direct
      mappings).

  GitHub Secret Scanning
    Default-on for all public repositories since March 2023.
    Detects 200+ provider-specific secret patterns. Partner
    integrations (AWS, GCP, Stripe, Slack, Twilio, dozens
    of others) auto-revoke detected credentials. The Push
    Protection feature (free for public repos, paid for
    private) blocks the push at the git-push step.

  TruffleHog (open-source)
    Industry-standard pre-push and CI secret scanner.
    Entropy-based detection complements pattern-based
    detection. CLI + GitHub Action + pre-commit hook.

  GitGuardian / Gitleaks
    Commercial / open-source alternatives. Gitleaks is the
    open-source default (now in feature-complete / maintenance
    mode — security patches only); GitGuardian adds dashboard,
    enterprise features, and paid threat-intel feeds.

  detect-secrets / git-secrets / pre-commit (the framework)
    Pre-commit hook ecosystem. detect-secrets (Yelp) and
    git-secrets (AWS Labs) are the two most-deployed.
    pre-commit (pre-commit.com) is the meta-framework that
    runs them.


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  SANS GOSI (GIAC Open Source Intelligence)
    Source-control OSINT is core curriculum. GitHub repo
    enumeration, organization mapping, committed-secrets
    discovery are exam topics.

  SANS SEC497 (Practical Open-Source Intelligence)
    The flagship OSINT practitioner course (replaced the
    retired SEC487). Covers source-control OSINT, TruffleHog,
    and the broader credential-leak ecosystem.

  CompTIA PenTest+ (PT0-003)
    Domain 2 (Information Gathering and Vulnerability
    Scanning) — OSINT-driven source-control enumeration.
    Domain 3 (Attacks and Exploits) — credential reuse and
    lateral movement from leaked secrets.

  CompTIA CySA+ (CS0-003 / CS0-004)
    Domain 1 (Security Operations) — credential-leak
    detection workflows. CS0-004 launched in early 2026 for
    parallel availability; CS0-003 retires June 2026.

  CompTIA Security+ (SY0-701)
    Domain 1 covers OSINT briefly; Domain 4 covers IAM and
    credential management.

  GIAC GCIH (Certified Incident Handler)
    Credential-compromise IR pattern is in scope. The "leaked
    credential discovered in a public repo, rotated, IR
    follow-up" workflow is the canonical case.

  ISC2 CISSP
    Domain 3 (Security Architecture and Engineering) — covers
    secrets-management as an architectural concern. Domain 8
    (Software Development Security) covers SSDF / secure SDLC.

  AWS Certified Security — Specialty (SCS-C03)
    AWS released SCS-C03 in late 2025 / early 2026 as the
    successor to SCS-C02. IAM hygiene and credential leak
    response are tested domains. Includes AWS GuardDuty
    findings ("UnauthorizedAccess:IAMUser/Instance
    CredentialExfiltration.InsideAWS" and similar) that fire
    on leaked-credential usage.


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Reconnaissance phase (what we just did):

  T1593.003   Search Open Websites/Domains: Code Repositories
              — explicitly names GitHub. Searching public
              source for credentials is the textbook example
              of this technique.
  T1589.001   Gather Victim Identity Information: Credentials
              — the broader category; covers HIBP from
              level0 and the GitHub finding here.
  T1591.002   Gather Victim Org Information: Business
              Relationships — Aaron's GitHub bio names his
              prior employer (Helix Therapeutics) and current
              role (Veridian CMO); that's organizational
              relationship data adversaries collect.

  Initial Access / Credential Access — what an adversary would
  do with the finding:

  T1552.001   Unsecured Credentials: Credentials In Files —
              the leaked AWS keys in the .env. Direct mapping.
  T1078       Valid Accounts — using the AWS credentials.
  T1078.004   Valid Accounts: Cloud Accounts — specifically
              relevant for the AWS access-key usage.
  T1098       Account Manipulation — what an adversary might
              do post-compromise to persist (creating an IAM
              user, attaching policies).


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For Aaron specifically:
     - ROTATE the AWS access key today via the AWS console
       (IAM → Users → security credentials → make inactive →
       create new access key). Two-minute operation.
     - Rotate the OpenFDA personal API key (the OpenFDA
       developer console supports regeneration).
     - Run \`git rm --cached .env\` + commit + force-push to
       remove from HEAD. The credential is still in history
       hashes but is now revoked and inert. Optionally
       \`git filter-repo\` the history to fully scrub, though
       the credential is already public — rotating is what
       matters.
     - Enable AWS GuardDuty on the personal account if not
       already. The "UnauthorizedAccess:IAMUser/..." finding
       families catch leaked-credential usage.
     - Review the S3 bucket \`ahines-pgx-cache\` contents.
       What's actually in there? If patient-identifying data,
       that's a separate HIPAA exposure event.
     - Audit AWS CloudTrail for the access key's API call
       history going back to 2023-07-14. CloudTrail retains
       90 days by default; if Aaron set up longer retention,
       use it.

  2. For Veridian:
     - Standardize developer-footprint reviews for new
       executive hires. Add \`github\` enumeration to the
       Friday-HIBP-lookup pattern from VER-EXP-2026-002. Same
       authorization scope, same brief format.
     - For Veridian-domain GitHub accounts (the engineering
       team's work GitHub presence under the veridian-
       analytics GitHub org): enable Push Protection (paid
       feature for private repos under GitHub Advanced
       Security). Catches the leak at \`git push\`.
     - Pre-commit hooks across the engineering team
       (detect-secrets or git-secrets). Cheap, catches
       most patterns before they get committed.
     - CI gate via TruffleHog or Gitleaks in the pipeline.
       Last-chance catch.

  3. For Driftwood (us, doing this kind of work):
     - Maintain scope discipline. The natural pull on the
       github finding is to enumerate every repo, drill into
       every commit, grep every file. Don't. Marisol
       authorized the public-profile enumeration and the
       public-file read; that's what we did. Active testing
       of the AWS credentials would be a separate
       authorization.
     - Document the github lookup procedure with date,
       commit hash at HEAD, and file path of the finding.
       Future re-runs verify whether Aaron's remediation
       held.

  4. For the broader OPSEC lesson (defender side):
     - GitHub Secret Scanning is default-on and free for
       public repos. If Aaron's repo had been created after
       March 2023 with current Secret Scanning posture, the
       AWS credentials would have been flagged at push time
       AND auto-revoked by AWS via the GitHub-AWS partner
       integration. The repo was created July 2023 so it WAS
       eligible; either the scanning didn't catch this
       particular pattern (the AWS key format here is mildly
       non-standard) or Aaron disabled the notifications.
       Either way, defense-in-depth.
     - Personal-account secrets are an executive-exposure
       category most security programs underweight. The
       Friday HIBP lookup + the Monday GitHub lookup
       together cost ~90 minutes of Driftwood time and
       produced two distinct, actionable, remediable
       findings.


─── CLOSING THOUGHT ──────────────────────────────────────────

The pattern that emerges across both findings on this case —
Friday's reused password and today's committed AWS key — is
the same pattern, surfacing in different ways. Aaron's personal-
credential hygiene was built for a previous era of his career
(a clinical fellow with a low-stakes public footprint) and
hasn't been updated for his current era (a public-facing CMO
of a HIPAA Business Associate, surfaced in an open-letter
campaign). The fix in both cases is the same shape: rotation,
modern controls (2FA / Secret Scanning / a password manager),
and a documented expectation that public-figure-tier executives
get a different OPSEC baseline than they did ten years ago.

For the OSINT engagement specifically: the scope discipline
matters. We found exactly what Marisol authorized us to look
for and we stopped at the boundary she defined. That's why
this kind of engagement gets repeat business — clients trust
that we won't follow the thread past the line they drew, even
when the next link looks interesting.

In the longer arc: source-control credential leakage is one
of those problem categories that will not be solved by tooling
alone. GitHub's Secret Scanning is the strongest single
intervention available and it still misses things. The
durable fix is institutional: pre-commit hooks AND CI gates
AND organization-wide rotation policies AND executive-tier
personal-OPSEC training, layered so that no single failure
exposes the credential for two years.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
