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
    estimatedMinutes: 12,
    playerUser: "intel",
    objective: "Run a personal-credential exposure check on Veridian's new CMO, Dr. Aaron Hines. Marisol Vega wants to know what's in public breach corpora against his known personal email before she decides whether to escalate to executive protection.",
    lesson: "Veridian Analytics is one of Driftwood's healthcare-vertical clients — a mid-sized healthcare-analytics SaaS company headquartered in Boston (~250 engineers, founded 2018). They handle claims and outcomes data on behalf of insurers and provider networks, which makes them a HIPAA Business Associate under signed BAAs with each customer. PHI handling is in scope across their entire production environment, and they layer HITRUST CSF v11 on top for the customer-facing assurance their insurance-carrier customers require. Their General Counsel, Marisol Vega, opened this engagement last Friday. Their newly-hired Chief Medical Officer, Dr. Aaron Hines, has surfaced in an open-letter campaign about a controversial clinical trial he ran at his previous employer (Helix Therapeutics); the campaign has produced one identifiable LinkedIn DM with a snippet of Aaron's personal information in it, and Marisol wants a baseline read on Aaron's public credential exposure before deciding whether to engage an executive-protection vendor. You're on Driftwood's OSINT-engagement workstation (the shell calls you `intel`, the shared service account the recon team uses for client-side intel work). Read welcome.md first — it explains how `hibp` works. Then read engagement-notes.md, then subject-brief.txt, then run the lookup. Read lessons-learned.md once you've seen what's in the breach corpus.",

    hints: [
      "`cat subject-brief.txt` for Aaron's known email address, then `hibp <that-email>` to check it against the public breach corpora.",
      "Read the breach hits closely — look for the SAME cleartext password appearing in more than one breach. Two breaches with one password is a high-confidence reuse signal.",
      "That reused password (recovered from both the LinkedIn and LiveJournal corpora) is the credential to flag — and it's your password into `level1@osint`.",
    ],

    // v1.10.0 BONUS FINDS — Adobe 2013 hint field as OSINT-grade
    // intel layer. Orthogonal to the password-reuse finding;
    // doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "adobe-hint-as-intel",
        name: "Adobe's cleartext password hints",
        hint: "Aaron's Adobe 2013 record carries the hint 'city we lived in for residency' — Adobe stored hints in cleartext alongside encrypted passwords. Even when the password itself isn't recovered, the hint is OSINT-grade intel for building a targeted guess list. Aaron's public bio names BIDMC in Boston as his residency; the hint plus the bio narrows his Adobe-era password to a small candidate set.",
        trigger: { command: "hibp", argMatches: /aaron\.hines\.md@gmail\.com/, outputContains: "city we lived in" },
      },
    ],
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

One weakness, and it belongs to a person rather than a system.

  CWE-262   Not Using Password Aging — the closest catalog entry,
            though the finding is really about a REUSE HABIT
            rather than any single system's configuration.

  NIST SP 800-63B is the standard that matters: it recommends
  screening candidate passwords against known-breached corpora,
  which is precisely the check that surfaced this.

  Veridian is a HIPAA Business Associate, so a compromise here
  propagates outward: the BA notifies the covered entity within
  60 days, and the covered entity then owns the individual
  notice. One reused credential can start clocks inside
  companies Veridian does not control. HITRUST CSF is the
  assurance framework its customers will ask about.

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


─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. Nothing of Veridian's was touched here. So what exactly is
     the finding?

  2. The same password appears in two breaches rather than one.
     Why does that second appearance change the conclusion?

  3. Veridian is a Business Associate. Whose notification clocks
     could one reused password eventually start?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/osint/level0.html

The walkthrough covers the full control mapping, the
certification objectives, breach-corpus methodology and its
ethical limits, the real-world credential-stuffing cases, and a
Sigma rule for authentication patterns that indicate reuse.

From the terminal:    walkthrough

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
    estimatedMinutes: 18,
    playerUser: "intel",
    objective: "Map Aaron Hines's public developer footprint. Marisol expanded scope after Friday's HIBP finding — `sherlock` and the new `github` command are in scope. Identify any committed credentials or sensitive disclosures in Aaron's public GitHub.",
    lesson: "Friday's HIBP lookup confirmed Aaron's password-reuse signal (BostonStrong#2013 recovered from both LinkedIn 2012 and LiveJournal 2014). Marisol Vega expanded engagement scope over the weekend after seeing the finding: source-control OSINT (the new `github` command) and handle-pivot OSINT (`sherlock`) are now authorized for Aaron's public developer footprint. Authorization basis unchanged — Aaron + Veridian's Chief People Officer consent reconfirmed Monday morning — broader public-data lookup, still no active testing of any account, still no enumeration of family members. Today: walk Aaron's public GitHub presence and identify any sensitive disclosures (committed credentials, internal references, personal-AWS exposure) that warrant remediation. Read welcome.md first — it explains the new `github` command. Then read engagement-notes.md and subject-update.txt. Use `sherlock aaron-hines-md` to confirm the GitHub handle, then `github aaron-hines-md` to enumerate his public repos. Read lessons-learned.md once you've found what's there.",

    hints: [
      "`sherlock aaron-hines-md` confirms the GitHub handle, then `github aaron-hines-md` lists his public repos. `engagement-notes.md` names the file types worth hunting (`.env`, config, credentials).",
      "Dig into the `personal-pgx-tool` repo: `github aaron-hines-md/personal-pgx-tool` shows its file tree. Note the committed `.env` — adding `.gitignore` later does NOT untrack a file already committed.",
      "`github aaron-hines-md/personal-pgx-tool file .env` prints it — the live AWS secret access key inside is the finding, and it's your password into `level2@osint`.",
    ],

    // v1.10.0 BONUS FINDS — Strava segment leaderboards as residential-
    // pattern leak. Orthogonal to the GitHub credential finding;
    // doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "strava-segment-pattern",
        name: "Aaron's Strava neighborhood",
        hint: "sherlock surfaces Aaron's Strava with segment leaderboards on Brookline / Newton hills — public training routes through his actual neighborhood. Strava heatmaps have been used in real OPSEC incidents (2018 Strava global heatmap revealed forward-operating bases) to deanonymize home, work, and travel patterns. For a publicly-named executive in a hostile-attention campaign, a public Strava is a residential-pattern leak.",
        trigger: { command: "sherlock", argMatches: /aaron-hines-md/, outputContains: "Brookline / Newton hills" },
      },
    ],
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

Two weaknesses, and one widely misunderstood control.

  CWE-798   Use of Hard-coded Credentials — live keys committed
            at HEAD.
  CWE-312   Cleartext Storage of Sensitive Information.

  .gitignore is the misunderstood part: it prevents UNTRACKED
  files from being staged and has no effect on a file git is
  already tracking, nor on history. NIST SP 800-218 (Secure
  Software Development Framework) covers the practice that
  prevents this, which is scanning before the commit lands.

  Veridian is a HIPAA Business Associate, so a compromise here
  propagates outward: the BA notifies the covered entity within
  60 days, and the covered entity then owns the individual
  notice. One reused credential can start clocks inside
  companies Veridian does not control. HITRUST CSF is the
  assurance framework its customers will ask about.

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


─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. The .gitignore lists .env. Why did that not help?

  2. The repository is personal, not Veridian's. Why is it in
     scope anyway?

  3. How long have these keys been exposed — and what is the
     only remediation that changes an attacker's position?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/osint/level1.html

The walkthrough covers the full control mapping, the
certification objectives, git history and why deletion does not
reach it, the real-world key-leak incidents, and a Sigma rule
for access keys used from unexpected networks.

From the terminal:    walkthrough

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

  // ── level 2 — "Aaron's Other Lives" ─────────────────────────────
  // Third task on the Veridian engagement. After Wednesday's GitHub
  // finding (a live AWS access key committed in personal-pgx-tool/.env),
  // Aaron's remediation instinct was to DELETE the repo — without
  // rotating the key. This level teaches that takedown is not
  // remediation, and that the Internet Archive decouples "online now"
  // from "ever online": deleting the origin does nothing to the captures.
  //
  // New concept: archive-driven OSINT + identity correlation. The new
  // tool is `wayback` (Internet Archive). The level REUSES `curl` (to
  // read an archived snapshot's body) and `sherlock` (to pivot onto a
  // newly-discovered handle) — no new engine command, pure level data.
  // That deliberately satisfies the "audit existing commands before
  // adding one" rule: the wayback->curl->sherlock workflow is exactly
  // how an analyst reads archived pages and pivots on a found alias.
  //
  // Player path:
  //   1. wayback the "deleted" repo  -> 2023-24 captures still 200 while
  //      the live URL now 404s. Deletion didn't remove the capture, and
  //      the key was never rotated (which is why that same key was the
  //      password that let the player in). [bonus: deletion-theatre]
  //   2. wayback Aaron's old personal site (captured since 2009).
  //   3. curl the 2011 homepage snapshot -> it names a pseudonymous
  //      handle ("saltyhelm") that Aaron scrubbed from his current
  //      profile but the archive kept. [bonus path: curl the archived
  //      robots.txt -> Disallow: lines map what he wanted hidden]
  //   4. sherlock saltyhelm -> the alias's live footprint ("other lives").
  //   5. curl the saltyhelm homelab blog post -> Aaron pasted a Nextcloud
  //      docker-compose with NEXTCLOUD_ADMIN_PASSWORD in cleartext. That
  //      value (S4ltyHelm-Nextcloud-2022!) is the level3@osint breadcrumb.
  //
  // Lesson stack: deletion != remediation (rotate/revoke is the only
  // fix); archive permanence (archive.org / archive.today / Google
  // Cache); alias attribution + selector reuse (pseudonymous != private);
  // robots.txt as a disclosure control, never an access control; secrets
  // pasted into public help/blog content. CWE-312 (Cleartext Storage) +
  // CWE-540 (Sensitive Info in Source) + CWE-798 (carryover: the
  // unrotated key). MITRE T1593 (Search Open Websites/Domains) +
  // T1593.001 (Social Media) + T1589.001 (Gather Victim Identity
  // Information: Credentials). Gated on the AWS secret key from level1.
  "level2@osint": {
    password: "AaronHinesMD/Pers0nal+AWS/2024+BrightBlu",
    track: "osint",
    title: "Aaron's other handle (wayback)",
    estimatedMinutes: 20,
    playerUser: "intel",
    objective: "Aaron deleted his personal-pgx-tool repo after Wednesday's AWS-key finding. Marisol wants two things: confirm whether deleting it actually remediated the exposure, and sweep the Internet Archive for anything else in Aaron's footprint he's forgotten about.",
    lesson: "Wednesday you delivered the GitHub finding — a live AWS access key committed in Aaron's public `personal-pgx-tool` repo since July 2023, never rotated. (That same secret access key is what you just typed to get in here: it still works, which tells you Aaron never rotated it.) Aaron's reaction Thursday morning was to delete the whole repo and call it fixed. Marisol's question now: did that actually remediate anything — and while you're in the archive, is there anything else of Aaron's still exposed that he's long since forgotten? Authorization basis unchanged: Aaron + CPO consent, read-only public-data OSINT, no active testing, no family. Today's new tool is `wayback` — the Internet Archive's Wayback Machine. Read welcome.md first. Then `wayback` the deleted repo to see what the archive kept, `wayback` Aaron's old personal site (it's been captured since 2009), `curl` the archived snapshots to read them, and pivot with `sherlock` on whatever handle turns up. Read lessons-learned.md once you've found Aaron's other life.",

    hints: [
      "Two starting URLs are in `subject-update.txt` — `wayback` each: the deleted `personal-pgx-tool` repo and Aaron's old personal site `www.aaronhines.net`.",
      "On the old site, `curl` the 2011 homepage capture (not the robots.txt one). Copy the snapshot URL exactly as `wayback` printed it — the archive serves that exact URL.",
      "The archived homepage names a handle Aaron later scrubbed from his professional identity. `sherlock <that-handle>` maps where else the alias appears.",
      "`curl` the homelab blog post sherlock surfaces — Aaron pasted a Nextcloud admin password into a docker-compose. That cleartext credential is the breadcrumb into `level3@osint`.",
    ],

    // v1.10.0 BONUS FINDS.
    //   1. deletion-theatre: the "deleted" repo is still served from
    //      archive.org captures; deletion is not remediation (and the
    //      key was never rotated). Triggered by waybacking the repo.
    //   2. robots-txt-map: the archived robots.txt enumerates the very
    //      paths Aaron wanted hidden. Triggered by curling the archived
    //      robots.txt snapshot. Neither gates the credential chain.
    bonusFinds: [
      {
        id:   "deletion-theatre",
        name: "Deletion theatre",
        hint: "wayback shows aaron-hines-md/personal-pgx-tool still served from its 2023-2024 captures even though the live repo now 404s — Aaron deleted it Thursday morning. Deleting a repo doesn't purge existing Wayback captures, and it does nothing about the real problem: the committed AWS key was never rotated (that's why it still worked as your way in). Takedown is not remediation; rotation/revocation at the provider is the only fix for a leaked secret. Real pattern: GitHub's own guidance plus GitGuardian's State of Secrets Sprawl reporting — a secret stays valid until it is revoked, regardless of whether the repo still exists.",
        trigger: { command: "wayback", argMatches: /personal-pgx-tool/, outputContains: "archived" },
      },
      {
        id:   "robots-txt-map",
        name: "robots.txt as a treasure map",
        hint: "The archived 2011 robots.txt for aaronhines.net lists Disallow: paths pointing at exactly the things Aaron wanted hidden — an old CV PDF, a /backup/ directory, and a draft of the 'saltyhelm' sailing blog. robots.txt tells crawlers what to skip; it tells a human analyst precisely where to look. Real pattern: robots.txt / sitemap review (OWASP WSTG-INFO-03, 'Review Webserver Metafiles for Information Leakage') — the file is a disclosure control, never an access control.",
        trigger: { command: "curl", argMatches: /robots\.txt/, outputContains: "Disallow" },
      },
    ],

    // Wayback Machine timelines. The repo's last row is a post-deletion
    // 404 (live URL gone) while the 2023-24 rows are still 200 (captures
    // persist) — the visual core of the deletion-theatre lesson. The old
    // personal site includes a robots.txt capture (the robots bonus hook)
    // and a 2011 homepage capture (the alias-pivot hook).
    waybackResults: {
      "https://github.com/aaron-hines-md/personal-pgx-tool": [
        { timestamp: "2023-08-02 14:11:50", status: 200, snapshot_url: "https://web.archive.org/web/20230802141150/https://github.com/aaron-hines-md/personal-pgx-tool" },
        { timestamp: "2023-11-19 09:42:03", status: 200, snapshot_url: "https://web.archive.org/web/20231119094203/https://github.com/aaron-hines-md/personal-pgx-tool" },
        { timestamp: "2024-03-09 22:05:31", status: 200, snapshot_url: "https://web.archive.org/web/20240309220531/https://github.com/aaron-hines-md/personal-pgx-tool" },
        { timestamp: "2026-05-21 11:38:02", status: 404, snapshot_url: "https://web.archive.org/web/20260521113802/https://github.com/aaron-hines-md/personal-pgx-tool" },
      ],
      "http://www.aaronhines.net": [
        { timestamp: "2009-10-15 08:30:12", status: 200, snapshot_url: "https://web.archive.org/web/20091015083012/http://www.aaronhines.net/" },
        { timestamp: "2011-02-10 16:15:00", status: 200, snapshot_url: "https://web.archive.org/web/20110210161500/http://www.aaronhines.net/robots.txt" },
        { timestamp: "2011-06-14 09:32:10", status: 200, snapshot_url: "https://web.archive.org/web/20110614093210/http://www.aaronhines.net/" },
        { timestamp: "2013-04-22 19:48:55", status: 200, snapshot_url: "https://web.archive.org/web/20130422194855/http://www.aaronhines.net/" },
      ],
    },

    // Handle-pivot: sherlock on the pseudonym surfaced by the archived
    // homepage. Shows a whole pseudonymous footprint ("other lives") and
    // points at the homelab blog post carrying the breadcrumb.
    sherlockResults: {
      "saltyhelm": [
        "[+] Blog:       http://www.saltyhelm.net  (self-hosted; latest post: /posts/self-hosting-the-boat-logs , 2022-03-19)",
        "[+] GitHub:     https://github.com/saltyhelm  (3 repos — homelab dotfiles + a Nextcloud compose; last push 2022-09)",
        "[+] Mastodon:   https://mas.to/@saltyhelm  (homelab + sailing; last toot 2023-05-30)",
        "[+] Reddit:     https://reddit.com/user/saltyhelm  (active in r/selfhosted, r/sailing)",
        "[-] Twitter:    404",
        "[-] Instagram:  404",
        "[-] TikTok:     404",
      ],
    },

    // curl-able pages. Keys are the EXACT snapshot/blog URLs the player
    // copies out of wayback / sherlock output (curl does exact-string
    // matching against level.web — see js/commands/web.js). Three entries:
    // the archived 2011 homepage (names the pseudonym), the archived
    // robots.txt (robots bonus), and the live saltyhelm blog (index +
    // the homelab post that carries the level3 breadcrumb).
    web: {
      "https://web.archive.org/web/20110614093210/http://www.aaronhines.net/":
`[ Wayback Machine — captured 2011-06-14 09:32:10 ]
[ Archived from: http://www.aaronhines.net/ ]

  Aaron Hines

  [ About ]  [ Research ]  [ Running ]  [ Sailing ]  [ Links ]

  Hi — I'm Aaron. I'm a resident in internal medicine at MGH here
  in Boston. Outside the hospital I run (slowly), sail (badly),
  and tinker with small computers (enthusiastically). This little
  site is where I keep the stuff that doesn't fit on a CV.

  ── Around the web ──────────────────────────────────────────
  I try to keep my professional and personal lives separate, so
  most of these are under a handle rather than my name:

    - Code (GitHub):          github.com/aaron-hines-md
    - Sailing + homelab blog:  saltyhelm.net   <- that one's me;
                               I post as "saltyhelm"
    - Running log:             on Strava (ask me for the link)

  The sailing blog is mostly boat-maintenance notes and write-ups
  of the little self-hosting projects I run off the Raspberry Pi
  in the boat's nav station. Nerdy. You've been warned.

  ── Contact ─────────────────────────────────────────────────
    aaron.hines.md@gmail.com

  (c) 2011 Aaron Hines. Powered by hand-written HTML and coffee.`,

      "https://web.archive.org/web/20110210161500/http://www.aaronhines.net/robots.txt":
`[ Wayback Machine — captured 2011-02-10 16:15:00 ]
[ Archived from: http://www.aaronhines.net/robots.txt ]

User-agent: *
Disallow: /private/
Disallow: /cv/aaron-hines-cv-2011.pdf
Disallow: /backup/
Disallow: /sailing/saltyhelm-blog-draft/
Sitemap: http://www.aaronhines.net/sitemap.xml

# note to self: "Disallow" keeps Google from indexing these, it
# does NOT keep anyone from reading them. they're still public.
# move the real private stuff off the web server. -- AH, 2011`,

      "http://www.saltyhelm.net":
`saltyhelm.net — salt, sailing, and self-hosting

  Recent posts
  ──────────────────────────────────────────
  - Self-hosting my boat-maintenance logs on the cabin Pi
      /posts/self-hosting-the-boat-logs        (2022-03-19)
  - Solar + LiFePO4: a week at the mooring off-grid
      /posts/solar-week-at-the-mooring         (2022-07-02)
  - Why I moved my git off GitHub (a small rant)
      /posts/why-i-moved-my-git-off-github     (2022-09-11)

  About: I'm "saltyhelm." I sail a tired old 30-footer out of
  Boston and run a few small servers I probably shouldn't. Posts
  are mostly notes-to-self. No tracking, no ads, no comments
  section to moderate.`,

      "http://www.saltyhelm.net/posts/self-hosting-the-boat-logs":
`saltyhelm.net — Self-hosting my boat-maintenance logs on the cabin Pi
posted 2022-03-19 by saltyhelm

I finally got tired of losing maintenance notes to a dead phone,
so I stood up a little Nextcloud on the Raspberry Pi 4 in the
boat's nav station. Solar power, a cellular hotspot at the
mooring, dynamic DNS so I can reach it from the dock. Works
great for logging oil changes and engine hours.

Posting my docker-compose here in case it helps anyone doing the
same thing. Yes, I know I should use a secrets file instead of
inline env — this is a boat, not prod, and (I told myself) the
Pi isn't reachable from the internet. Don't @ me.

    version: "3"
    services:
      nextcloud:
        image: nextcloud:24
        ports:
          - "8080:80"
        environment:
          - NEXTCLOUD_ADMIN_USER=saltyhelm
          - NEXTCLOUD_ADMIN_PASSWORD=S4ltyHelm-Nextcloud-2022!
          - NEXTCLOUD_TRUSTED_DOMAINS=helm.saltyhelm.net
        volumes:
          - ./nc-data:/var/www/html/data

UPDATE (2022-08): a couple of folks pointed out that setting
NEXTCLOUD_TRUSTED_DOMAINS=helm.saltyhelm.net plus the dynamic DNS
means I did, in fact, expose this box to the open internet
without thinking it through. It's fine, it's just boat logs.

(It is not fine. Do not paste working admin passwords on your
blog. Do not expose a Pi running a years-old container image to
the internet. Past me was an idiot. -- present me, still saltyhelm)`,
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / OSINT Engagement Workstation ──────────

Still \`intel\` on the same OSINT workstation. Day three of the
Veridian engagement. Wednesday's GitHub finding went to Marisol:
a live AWS access key committed in Aaron's public
\`personal-pgx-tool\` repo since July 2023, never rotated. Aaron's
response Thursday morning was to delete the repo and call it
fixed.

You're here because Marisol asked two questions: did deleting
the repo actually remediate anything, and is there anything else
of Aaron's still exposed in the Internet Archive that he's long
since forgotten? Same authorization basis (Aaron + CPO consent),
read-only public-data OSINT, no active testing, no family.


─── NEW TOOL ──────────────────────────────────────────────────

  wayback <url>     Query the Internet Archive's Wayback Machine
                    for archived snapshots of a URL. Returns a
                    timeline of captures: the date, the HTTP
                    status at capture time, and the permanent
                    snapshot URL for each one.

  You'll also use a tool you've already met:

  curl <url>        Fetch a URL and print the response body. Here
                    you point it at the snapshot URLs wayback
                    hands you, to read the archived page itself.


─── WHAT THE WAYBACK MACHINE DOES ─────────────────────────────

The Internet Archive (archive.org, founded 1996) crawls and
permanently stores snapshots of public web pages. The Wayback
Machine (live since 2001) is its front end: give it a URL and it
shows you every capture it holds, going back two decades.

For OSINT this is one of the highest-value sources, for a single
reason: it decouples "what's online now" from "what was ever
online." When a target deletes something — a repo, a blog post,
an old personal site, a careless link — the live copy disappears,
but the archived captures remain, served from archive.org's own
infrastructure. Deletion at the origin does NOT remove the
capture. The same is true of archive.today and (historically)
Google Cache.

Two patterns make this brutal for a target who thinks they
"cleaned up":

  1. DELETION ISN'T REMEDIATION.  Deleting a repo that leaked a
     credential does nothing about the credential. The capture
     still carries it — and, far more important, the credential
     stays VALID until it's rotated/revoked at the provider.

  2. THE ARCHIVE REMEMBERS WHO YOU WERE.  Old captures preserve
     the handles, links, and aliases people scrub from their
     current profiles. A pseudonym someone disconnected years
     ago is often still sitting in a decade-old snapshot, one
     hop from their real name.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md   Veridian update + Thursday scope
  2.  cat subject-update.txt    The two URLs to check + reminders
  3.  wayback https://github.com/aaron-hines-md/personal-pgx-tool
                                Is the "deleted" repo really gone?
  4.  wayback http://www.aaronhines.net
                                Aaron's old site (archived since 2009)
  5.  curl <the 2011 homepage snapshot URL from step 4>
                                Read the archived page; note the handle
  6.  sherlock <the handle you find>
                                Pivot: map that handle's footprint
  7.  curl <the blog-post URL sherlock surfaces>
                                Read what Aaron pasted there
  8.  cat lessons-learned.md    Post-mortem (read after step 7)

  Tip: copy the snapshot URL exactly as wayback prints it (the
  long web.archive.org/... string) when you curl it.

  Optional: curl the archived robots.txt snapshot from step 4 —
  a robots.txt is a map of what a site owner wanted hidden.`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Veridian Analytics — engagement notes (continued)

Client: Veridian Analytics (HIPAA Business Associate; HITRUST
        CSF v11; NIST SP 800-66 Rev. 2 reference)
Case ID: VER-EXP-2026-002 — Aaron Hines exposure check
         (continuation, task 3)
Driftwood handler: Priya
Client counterpart: Marisol Vega (General Counsel)
Driftwood task ID: DW-OSINT-VER-2026-005 (continued)

## What happened since the last task

Wednesday 2026-05-20, COB: We delivered the GitHub finding to
Marisol — a live AWS access key (AKIA-prefixed IAM user key)
committed in Aaron's public \`personal-pgx-tool\` repo on
2023-07-14, still present at HEAD, never rotated. Recommended
remediation, in order: (1) rotate the key at AWS immediately,
(2) review CloudTrail / GuardDuty for misuse, (3) optionally
clean the git history.

Thursday 2026-05-21, 07:50: Aaron — anxious, well-meaning, and
not a security person — deleted the entire \`personal-pgx-tool\`
repository from GitHub. He emailed Marisol: "Taken care of, the
repo's gone." He did NOT mention rotating the key.

That last detail is the whole reason for today's task. Marisol's
note to Priya:

  "Aaron thinks deleting the repo fixed it. I don't think it did,
   and I want to be able to tell him exactly why before he files
   this as closed. Two things:

   1. Show me what the Internet Archive still serves for that
      repo. If the capture still carries the .env, the 'fix'
      fixed nothing — and the key needs rotating regardless of
      whether the repo exists.

   2. While you're in the archive: Aaron has been online since
      his residency. He's exactly the type to have a personal
      site and half-forgotten side projects from fifteen years
      ago. Do a LIGHT sweep for anything still exposed that he's
      stopped thinking about. Same scope as before — public
      data, read-only, Aaron only, no family."

## Scope (Thursday addendum)

  IN SCOPE:
    - Internet Archive / Wayback Machine lookups against Aaron's
      known URLs (the deleted repo; his old personal site).
    - Reading archived snapshots (curl against archive.org
      snapshot URLs is reading public archived content).
    - Handle-pivot OSINT (sherlock) on any of Aaron's OWN
      handles that surface.

  STILL OUT OF SCOPE:
    - Veridian-issued credentials / accounts.
    - Active testing of any account or service. Do NOT log in,
      do NOT connect to a host, do NOT submit a credential —
      not the AWS key, not anything you find archived. We read;
      we don't touch.
    - Aaron's family members.

  AUTHORIZATION: Aaron + CPO consent, unchanged.

## A note from Priya

The teaching point Marisol wants in the brief is the one most
people get wrong: for a leaked secret, "I deleted it" is not a
remediation. The only remediation is rotation / revocation at
the provider. The archive is just the proof — it lets us show
Aaron that the deleted repo is still readable, so "I deleted it"
plainly didn't make the secret unreadable, let alone invalid.

On the sweep: keep it light and keep it Aaron. His old personal
site (aaronhines.net — it's in subject-update.txt) has been
captured since 2009. People link their other handles from old
"about / links" pages and then scrub those links when they go
professional. The archive keeps the scrubbed version. If a
handle turns up, sherlock it, see where it's still live, read
what's there, and stop at the first concrete finding. We don't
need Aaron's whole life — just whatever's still exposed.

— Priya`
        },

        "subject-update.txt": {
          type: "file",
          content:
`VERIDIAN ANALYTICS — SUBJECT EXPOSURE BRIEF (UPDATE 2)
Case ID:           VER-EXP-2026-002
Status:            ACTIVE — archive sweep + remediation check
Updated by:        Marisol Vega (General Counsel)
Date:              2026-05-21 (Thursday)
Driftwood ref:     DW-OSINT-VER-2026-005 (continuation, task 3)

PRIOR FINDINGS
─────────────────────────────────────────────────────────────
  Task 1 (Fri 05-15): HIBP — BostonStrong#2013 reused across the
    LinkedIn 2012 and LiveJournal 2014 breach corpora.
  Task 2 (Wed 05-20): GitHub — a live AWS access key committed
    in personal-pgx-tool/.env on 2023-07-14, never rotated.

  Thursday 07:50: Aaron deleted the personal-pgx-tool repo. He
  did NOT confirm key rotation. THAT is the open item.

URLs TO CHECK (IN SCOPE)
─────────────────────────────────────────────────────────────
  Deleted repo (verify the remediation actually remediated):
    https://github.com/aaron-hines-md/personal-pgx-tool

  Aaron's old personal site (archive sweep):
    http://www.aaronhines.net
      Per Task 1's brief, this has been in the Wayback Machine
      since at least 2009 (it's how we dated his Gmail). It
      predates his professional profiles — it's the version of
      Aaron that linked his hobby accounts in public, before he
      cleaned them off his current bio.

WHAT WE ARE BEING ASKED
─────────────────────────────────────────────────────────────
  1. Show what the Internet Archive still serves for the deleted
     repo. If the capture still carries the file tree / .env,
     the deletion did not remediate the credential exposure.

  2. Sweep Aaron's archived old-site footprint for any handle,
     account, or project he's stopped maintaining and forgotten
     is still public. Pivot with sherlock on any handle that's
     his. Read what's there. Stop at the first concrete exposure.

METHOD REMINDER
─────────────────────────────────────────────────────────────
  - wayback <url>        lists captures + their permanent
                         snapshot URLs.
  - curl <snapshot-url>  reads the archived page itself. Copy the
                         snapshot URL exactly as wayback prints it.
  - Read-only. Do not use, submit, or log in with anything you
    find. Findings go to Marisol; she writes Aaron's brief.

  Findings due COB Friday 2026-05-22.`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You ran the archive sweep and turned up two distinct findings.

First, the remediation check: \`wayback\` on the "deleted"
\`personal-pgx-tool\` repo shows it's still served from the
2023-2024 captures, even though the live URL now 404s. Aaron
deleted the repository; he did not delete the captures (he
can't — they live on archive.org's infrastructure), and far
more importantly he did not ROTATE the AWS key. You know the key
is still valid because it was the password that let you into
this workstation. "I deleted the repo" remediated nothing.

Second, the sweep: Aaron's old personal site (aaronhines.net,
captured since 2009) has a 2011 "Around the web" page that names
a handle — "saltyhelm" — he kept off his professional profiles.
\`sherlock saltyhelm\` mapped a whole second footprint (a blog, a
GitHub, Mastodon, Reddit), and the homelab blog post pastes a
working Nextcloud admin password in a docker-compose, on a box
he admits he exposed to the internet. A pseudonym is not a
secret, and "personal / hobby" content leaks credentials exactly
like professional content does.

Your job ends at the finding. You did not use the AWS key, you
did not log into the Nextcloud, you did not connect to anything.
Marisol writes the brief; she decides whether any of this becomes
an active-testing engagement.


─── THE BLUNT VERSION ────────────────────────────────────────

Two myths died on this task.

MYTH 1: "I deleted it, so it's handled." Deletion is not
remediation for a leaked secret, for two independent reasons.
(a) The artifact persists. The Internet Archive, archive.today,
Google's historical cache, forks, clones, and anyone's local
copy all survive an origin delete. You cannot un-publish. (b)
Even if every copy vanished, the SECRET is still valid. A
committed AWS key, API token, or password is compromised the
instant it touches a public surface; the only fix is to rotate
or revoke it at the provider so the leaked value stops working.
Aaron did the satisfying-but-useless thing (delete the repo) and
skipped the only thing that mattered (rotate the key). This is
one of the most common incident-response mistakes there is.

MYTH 2: "It's under a pseudonym, so it's private." Pseudonymity
is not anonymity, and neither is privacy. People link their
"other" handles from somewhere — an old bio, an about page, a
reused avatar, a reused contact email, a writing style — and the
link is usually preserved in a place they've forgotten. Here the
link was literally a 2011 web page Aaron wrote himself and later
scrubbed; the archive kept the scrubbed version. Once the alias
is attributed, the "personal" content gets read with the same
eyes as the professional content — and hobby projects are where
people are most careless, because they think nobody's looking.

The throughline of this whole engagement (reused password ->
committed AWS key -> pasted Nextcloud password) is one person's
security model lagging a decade behind his exposure. The fixes
are all the same shape: rotate, use a password manager and a
secrets manager, and assume that anything ever published is
permanent.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

The brief Marisol writes has to make the deletion-vs-rotation
distinction unmissable, because the client (Aaron) already
believes the problem is closed. The persuasive move is the
archive snapshot: you can SHOW him the "deleted" repo, still
readable, dated after he deleted it. That converts an abstract
argument ("deletion doesn't remediate") into a screenshot. The
recommended language for the brief:

  - The repo deletion reduced casual discoverability. It did not
    remediate the credential. ROTATE the AWS access key today;
    until then, treat it as compromised and monitor the account
    (GuardDuty / CloudTrail) for misuse.
  - The saltyhelm finding is a SEPARATE exposure: a working
    credential for a personal service, published on a public
    blog, on a host Aaron exposed to the internet. Rotate that
    too, take the post down (knowing the archive keeps it), and
    fold the alias into the monitoring scope.

Scope discipline still applies, and it's load-bearing here. We
attributed the saltyhelm alias to Aaron from his own archived
page — that's read-only OSINT on the authorized subject. We did
NOT log into the Nextcloud to "confirm" the password, we did NOT
use the AWS key, and we did NOT enumerate the exposed host. Each
of those would cross from passive OSINT into active testing — a
different authorization, a different statement of work, and
(for the Nextcloud and the host) potentially a different legal
posture entirely. The temptation to "just verify it works" is
exactly the line a professional doesn't cross without paper.

A note on minors and bystanders, repeated from the prior tasks:
the sweep is Aaron only. The blog has no comment section and no
third parties; if it had, we'd read only what bears on Aaron's
exposure and nothing else.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

Three weaknesses, and a property of the internet.

  CWE-312   Cleartext Storage of Sensitive Information — the
            Nextcloud admin password pasted into a blog post.
  CWE-540   Inclusion of Sensitive Information in Source Code.
  CWE-200   Exposure of Sensitive Information.

  No control framework covers the actual mechanism, which is
  that public archives are permanent and indifferent to what the
  origin does afterwards. NIST SP 800-53 IA-5 (Authenticator
  Management) covers the only remediation that works: rotation.

  Veridian is a HIPAA Business Associate, so a compromise here
  propagates outward: the BA notifies the covered entity within
  60 days, and the covered entity then owns the individual
  notice. One reused credential can start clocks inside
  companies Veridian does not control. HITRUST CSF is the
  assurance framework its customers will ask about.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Reconnaissance phase — what we just did:

  T1593      Search Open Websites/Domains — the Internet Archive
             is the textbook "open website" recon source for
             content that's no longer on the live origin.
  T1593.001  Search Open Websites/Domains: Social Media — the
             sherlock handle pivot across the alias's platforms.
  T1589.001  Gather Victim Identity Information: Credentials —
             both the still-archived AWS key and the pasted
             Nextcloud password are credentials recovered from
             open sources.
  T1591      Gather Victim Org Information — Aaron's archived
             pages tie his identity, employer history, and
             contact details together.

  Credential Access / Initial Access — what an adversary would
  do next (and where our scope ends):

  T1552.001  Unsecured Credentials: Credentials In Files — the
             archived .env and the pasted compose file.
  T1078      Valid Accounts — using either recovered credential.
             We did NOT do this; it's the active-testing boundary.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For Aaron specifically:
     - ROTATE the AWS access key now (deactivate, delete, create
       a replacement). This is the actual remediation for the
       Task 2 finding; the repo deletion was not.
     - Rotate the Nextcloud admin password and the OpenFDA key,
       and take the saltyhelm blog post down (accepting that the
       archive keeps a copy — rotation is what neutralizes it).
     - Treat the exposed homelab host as compromised until
       proven otherwise: patch/replace the years-old container
       image, put it behind a VPN or take it off the internet,
       and review it for unauthorized access.
     - Audit the forgotten footprint: close or secure the old
       accounts the sweep surfaced (unique passwords, MFA).

  2. For Veridian:
     - Add an archive sweep to the new-executive exposure
       playbook alongside the HIBP and GitHub steps. It's cheap
       and it catches the "forgotten old identity" surface that
       the live-web checks miss.
     - Build the deletion-vs-rotation distinction into incident
       response training. The instinct to "take it down" is
       universal and the rotation step is the one that gets
       skipped under pressure.

  3. For Driftwood (us):
     - Hold the read-only line. Attributing the alias from
       Aaron's own archived page is in scope; logging into the
       Nextcloud or using the AWS key to "confirm" is not.
     - Document the snapshot URLs and capture dates. The brief's
       persuasive force is the dated archive evidence; cite it
       precisely so Aaron can verify it himself.

  4. For the broader OPSEC lesson (defender side):
     - Assume permanence. Anything published to a public surface
       — code, config, a credential, a link to an alias — should
       be treated as captured forever the moment it's live.
     - Manage identity sprawl. The accounts that hurt you are
       the ones you forgot you had. Inventory them, close the
       dead ones, and never reuse a handle or a password across
       the "professional" and "personal" walls — the wall is
       thinner than it looks, and the archive remembers both
       sides.


─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. The repository was deleted and the finding was closed. What
     was wrong with that conclusion?

  2. An archived AWS key and a cleartext Nextcloud password.
     Which do you triage first, and why?

  3. Alias linkage widened the scope past Aaron's professional
     footprint. Where does the assessment's obligation stop?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/osint/level2.html

The walkthrough covers the full control mapping, the
certification objectives, Internet Archive methodology and
alias attribution, the ethics of executive-protection OSINT, and
a Sigma rule for dormant credentials waking up.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

The most useful thing this task produced wasn't the saltyhelm
password — it was the screenshot of a "deleted" repo that's
still readable. That single artifact closes the argument Aaron
was about to lose to himself: that deleting something makes it
gone. It doesn't. The web has a long memory and several
independent ones, and the only move that actually shrinks your
exposure is invalidating the thing that leaked, not hiding the
page it leaked from.

The wider pattern across all three Veridian tasks is worth
saying plainly. Aaron isn't careless; he's a competent person
whose personal security model was built for a quieter life and
never updated when he became a publicly-named executive of a
HIPAA business associate. The reused password, the committed
key, the pasted homelab credential, the forgotten alias — none
of them is exotic. They're the ordinary residue of a normal
digital life, sitting in public, waiting for someone to assemble
them. OSINT done well is mostly that: assembling the ordinary,
in the right order, before an adversary does.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
