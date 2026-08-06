// Forensics track levels.
//
// See levels/linux.js for the full schema documentation. Forensics-
// specific fields used by js/commands/forensics.js:
//
//   filetypes     — optional map of "filename" → "magic-byte ID
//                   string" for the `file` command. Overrides the
//                   default extension-based identification.
//   stringsOut    — optional map of "filename" → [array of lines]
//                   that the `strings` command returns instead of
//                   walking the file's raw content. Used for files
//                   whose `level.files[name]` is intentionally
//                   binary-looking and where the player should see
//                   a curated set of recovered strings.
//   exifData      — map of "filename" → [array of EXIF output
//                   lines] returned by the `exif` command. If a
//                   file has no entry here, `exif` returns the
//                   "no EXIF data" error.
//   evtxLogs      — map of "filename" → [array of {id, body}
//                   records] used by the `evtx` command. Each
//                   record is one Windows event; `id` is the
//                   Event ID (integer, used for -id filtering),
//                   `body` is the pre-formatted multi-line block
//                   the player sees. If a file is queried with
//                   `evtx` but has no entry here, the command
//                   returns "not a recognized event log."
//   sqlite_dbs    — map of "filename" → { tables: { <name>:
//                   { schema, columns, rows }}}. Used by the
//                   `sqlite3` command (v1.23.0+). `schema` is the
//                   raw CREATE TABLE text the player sees via
//                   `.schema`. `columns` is the ordered column-name
//                   array used by SELECT *. `rows` is an array of
//                   plain row objects keyed by column name. The
//                   executor handles WHERE = / LIKE, ORDER BY,
//                   LIMIT, COUNT(*) in-memory — no real SQLite
//                   engine. See js/commands/forensics.js#sqlite3
//                   for the supported grammar.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized
// tech consulting firm. Each track introduces a new client engagement
// to diversify the post-mortems' compliance contexts (CMMC / NIST
// 800-171 here, for the Polaris Defense Systems engagement).

export const forensicsLevels = {

  // ── level 0 — "Reed's Soccer Alibi" ─────────────────────────────
  // The player's first forensics task: a defense subcontractor's
  // in-house counsel has asked Driftwood to forensically verify an
  // alibi photograph in an internal investigation. Badge logs put
  // a senior engineer in a secured fabrication bay on a Saturday
  // morning he claimed he was at his daughter's youth soccer
  // tournament. The "proof" photo he submitted has EXIF metadata
  // showing it was taken eight months earlier, on a family vacation
  // in the Florida Keys (~1,000 miles from the claimed location).
  // The lesson is forensic methodology — metadata persists, alibis
  // don't survive examination — mapped to NIST SP 800-86, NIST
  // 800-171, CMMC Level 2 (IR domain), and CWE-200 (Exposure of
  // Sensitive Information; defender-side this time, where the
  // suspect's own metadata is the exposed information). Introduces
  // `file` and `exif`.
  "level0@forensics": {
    password: null,
    track: "forensics",
    title: "Reed's soccer alibi (EXIF)",
    estimatedMinutes: 10,
    playerUser: "secops",
    objective: "Forensically verify the alibi photo Reed Connolly submitted to Polaris's in-house counsel. Confirm — or refute — that the photo was taken when and where Reed claims.",
    lesson: "Polaris Defense Systems is one of Driftwood's defense-industrial clients — a mid-sized subcontractor (~$80M annual revenue, ~250 engineers) building electronics subsystems for prime contractors. CMMC Level 2 and NIST 800-171 are in scope across all production environments. Polaris's in-house counsel, Dana Reyes, opened an internal investigation last Tuesday: badge logs put one of their senior manufacturing engineers (Reed Connolly) in a secured fabrication bay on a Saturday morning that had no scheduled work. When asked informally, Reed said he was at his daughter's youth soccer tournament that morning and sent Dana a photo as proof. Dana wants forensic verification of the photo before HR escalates. You're on Driftwood's forensics-analysis workstation (the shell calls you `secops`, the shared service account the security team uses for evidence triage). Read welcome.md first — it explains how `file` and `exif` work. Then read engagement-notes.md, then case-summary.txt, then look at the photo. Read lessons-learned.md once you've decided whether the alibi holds.",

    hints: [
      "Start with `cat case-summary.txt` for Reed's alibi claim, then `file soccer-field.jpg` to confirm the artifact and `exif soccer-field.jpg` to read its embedded metadata.",
      "Compare the photo's `DateTimeOriginal` and `GPSLatitude`/`GPSLongitude` against Reed's claimed time and place — the camera stamps where and when the shutter actually fired.",
      "The metadata contradicts the alibi — that's the finding. The IR-track handoff credential to proceed to `level1@forensics` is recorded in `case-summary.txt`.",
    ],

    // v1.10.0 BONUS FINDS — surfaces GPSImgDirection from the EXIF
    // dump (often skimmed past beside the more obvious lat/long).
    // Orthogonal to the alibi finding; doesn't gate the credential
    // chain.
    bonusFinds: [
      {
        id:   "exif-image-direction",
        name: "Camera direction in EXIF",
        hint: "The EXIF dump includes GPSImgDirection 218.4° — the compass bearing the camera was pointed when the shutter fired. Beyond when and where, modern phones embed which way the camera was facing. A defender mapping a photo to a specific vantage point at a known location can confirm or refute claims about WHO took the photo, not just whether the location is right.",
        trigger: { command: "exif", argMatches: /soccer-field\.jpg/, outputContains: "GPSImgDirection" },
      },
    ],
    filetypes: {
      "soccer-field.jpg": "JPEG image data, EXIF standard",
    },
    exifData: {
      "soccer-field.jpg": [
        "EXIF metadata for: soccer-field.jpg",
        "────────────────────────────────────────────────────────",
        "  Make                         Apple",
        "  Model                        iPhone 14 Pro",
        "  Software                     iOS 17.5.1",
        "  Orientation                  Horizontal (normal)",
        "  XResolution                  72",
        "  YResolution                  72",
        "  ResolutionUnit               inches",
        "  DateTime                     2025:07:18 14:23:51",
        "  DateTimeOriginal             2025:07:18 14:23:51",
        "  DateTimeDigitized            2025:07:18 14:23:51",
        "  OffsetTime                   -04:00",
        "  ExposureTime                 1/1600 sec",
        "  FNumber                      f/1.78",
        "  ISO                          50",
        "  FocalLength                  6.86 mm (35 mm equivalent: 24 mm)",
        "  Flash                        Off, did not fire",
        "  WhiteBalance                 Auto",
        "  ImageWidth                   4032",
        "  ImageHeight                  3024",
        "  ColorSpace                   sRGB",
        "  GPSLatitude                  25.0865°",
        "  GPSLatitudeRef               N",
        "  GPSLongitude                 80.4473°",
        "  GPSLongitudeRef              W",
        "  GPSAltitude                  3.2 m",
        "  GPSTimeStamp                 18:23:51 UTC",
        "  GPSDateStamp                 2025:07:18",
        "  GPSSpeed                     0.00 km/h",
        "  GPSImgDirection              218.4°",
        "",
        "Approximate location (reverse-geocode):",
        "  Key Largo, Monroe County, Florida, USA",
        "  ~1,000 miles SSW of Reston, Virginia.",
      ],
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Forensics Analysis Workstation ────────

You're logged in as \`secops\` — the security team's shared service
account. The host \`forensics\` is our evidence-triage workstation,
where we examine artifacts client legal/HR/IR teams hand us in the
course of an investigation.

Today's client: Polaris Defense Systems. Their in-house counsel,
Dana Reyes, has opened an internal investigation. The case turns
on whether a single submitted alibi photograph is genuine. Your
job: forensically verify it.


─── NEW COMMANDS ──────────────────────────────────────────────

  file <filename>      Identify what kind of file something is by
                       its magic bytes (the first few bytes of a
                       file, which encode its true type — not the
                       extension, which lies).

  exif <filename>      Read EXIF metadata from an image. Cameras
                       and phones embed dozens of metadata fields
                       into every photo they take: timestamp, GPS
                       coordinates, device make/model, software
                       version, exposure settings, and more.


─── WHAT EXIF METADATA REVEALS ────────────────────────────────

Every modern camera and smartphone tags photos with structured
metadata at capture time, embedded directly into the image file.
The metadata standard is EXIF (Exchangeable Image File Format,
JEITA CP-3451). Common fields:

  DateTimeOriginal     When the shutter fired (camera's local
                       clock, with timezone offset).
  GPSLatitude          Where the photo was taken — to about
  GPSLongitude         3-meter precision on a modern phone.
  Make / Model         Which device. Often identifies the owner.
  Software             OS / firmware version at capture.

EXIF is preserved by default through copy, email, AirDrop, cloud
backup, most chat apps, and most file shares. It is stripped
intentionally by some social-media platforms (Twitter / Instagram
strip on upload) and a few messaging apps (Signal strips). It is
NOT stripped by "I sent the original via Slack/email."

The forensic value: a photo's metadata is harder to forge than the
pixels are. Anyone can fake what's IN a photo. Faking the metadata
requires deliberate tooling (exiftool, mat2) AND knowing what to
forge — and most subjects of investigation don't.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Polaris / Dana / CMMC context
  2.  cat case-summary.txt        Reed's claim, the badge-log gap
  3.  file soccer-field.jpg       Confirm the artifact type
  4.  exif soccer-field.jpg       Read the metadata. Compare it
                                  against what Reed claimed.
  5.  cat lessons-learned.md      Post-mortem (after step 4)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Polaris Defense Systems — engagement notes

Client: Polaris Defense Systems
Vertical: Defense industrial base (DIB) — mid-tier subcontractor
          building electronics subsystems for prime contractors;
          ~$80M annual revenue, ~250 engineers; Reston, Virginia
          HQ with a fabrication facility in Manassas
Engagement: ~26 months, ongoing
Driftwood handler: Priya
Client counterpart (this case): Dana Reyes (in-house counsel,
                                running the investigation)
Compliance regime: CMMC Level 2 (Cybersecurity Maturity Model
                   Certification, the DoD acquisition-side
                   framework). NIST SP 800-171 Rev. 3 maps
                   underneath. DFARS 252.204-7012 requires
                   incident reporting to DC3 within 72 hours
                   of discovery. CUI (Controlled Unclassified
                   Information) handling is in scope across
                   the entire manufacturing environment.

## The relationship

Polaris has been a Driftwood client for ~26 months. We helped
them through their initial CMMC Level 2 assessment in 2024 and
have stayed on as their security partner for ongoing CUI handling,
incident response, and — increasingly — internal investigations.

Defense subcontractors run lean. Polaris has a 4-person internal
security team and no dedicated forensics capability of their own.
For evidence triage they call us.

## This engagement

Dana Reyes opened an internal investigation last Tuesday. The
trigger: routine badge-log audit flagged that Reed Connolly
(Senior Manufacturing Engineer, Polaris employee since 2021,
DoD Secret-cleared) badged into Bay 4 (a secured fabrication
area handling CUI-tagged subsystem components) on Saturday
2026-03-14, between 09:42 and 11:18 local. No scheduled work
was on the books for that bay on that morning. No work order
was opened. No supervisor was on-site.

When Dana brought Reed in for an informal conversation on
Monday, he was relaxed about it. He said he had stopped by the
office briefly to grab a personal item from his locker, and
that he could account for the rest of the morning because he
was at his daughter's youth soccer tournament at Centreville
Sports Complex in Centreville, VA from roughly 09:00 to 12:30.

On request, Reed sent Dana a single photograph he said he took
at the tournament that morning: the file you'll find in this
working directory as soccer-field.jpg.

Dana's question to Driftwood, verbatim from the call:

  "Before I take this to HR I want a forensic read on the photo.
   If the metadata is consistent with what Reed said, the
   informal conversation closes and we move on. If it's not, I
   need to know before I'm sitting across from him with HR in
   the room."

## What we are NOT being asked

We are not being asked to determine whether Reed actually entered
Bay 4 to do something improper. The badge log establishes that
Reed was there; we don't know why. The photo is a separate
question: does it corroborate Reed's account of his Saturday
morning?

If the photo holds up, Reed's locker story stands and the case
is procedurally weak. If the photo does not hold up, Polaris has
forensic basis to escalate to a formal investigation under their
Insider Threat Program (which has its own NIST 800-171 / CMMC
controls and process — Dana will run that side, not us).

## A note on tone

Dana is careful. She has not concluded that Reed has done anything
wrong, and she does not want us to either. The job is to read the
metadata and report what we find. If the metadata supports Reed's
account, write that up. If it doesn't, write that up. We do not
write conclusions; we write findings. Dana writes conclusions.

— Priya`
        },

        "case-summary.txt": {
          type: "file",
          content:
`POLARIS DEFENSE SYSTEMS — INTERNAL INVESTIGATION CASE SUMMARY
Case ID:           POL-IIS-2026-0007
Status:            ACTIVE — forensic verification pending
Opened by:         Dana Reyes (in-house counsel)
Date opened:       2026-03-19
Driftwood ref:     DW-FORENSICS-POL-2026-014

SUBJECT
─────────────────────────────────────────────────────────────
  Name:            Connolly, Reed M.
  Title:           Senior Manufacturing Engineer
  Department:      Electronics Subsystems, Bay 4
  Hire date:       2021-08-30
  Clearance:       DoD Secret (current)
  Badge ID:        POL-0418

TRIGGERING EVENT
─────────────────────────────────────────────────────────────
  Date:            Saturday 2026-03-14
  Badge access:    POL-0418 used to enter Bay 4 at 09:42:11
                   and exit at 11:18:47 local time.
  Work scheduled:  None. Bay 4 was unattended.
  Work-order log:  No open ticket.
  Supervisor:      None on-site.
  Pre-flagged?     No — surfaced in routine 7-day badge audit
                   on Tuesday 2026-03-17 by Polaris SOC.

SUBJECT'S ACCOUNT (informal interview, Dana Reyes, 2026-03-18)
─────────────────────────────────────────────────────────────
  Stated reason for Bay 4 entry: "Stopped by to grab a personal
    item from my locker. Five minutes, in and out." (Note: badge
    timing shows 96 minutes, not five.)

  Stated whereabouts 09:00 - 12:30: "At my daughter's soccer
    tournament. Centreville Sports Complex. Watched all three
    of her games. Lots of other parents there. Took some
    pictures, including one I'm happy to send you."

  Photographic evidence offered: One JPEG, file name
    "soccer-field.jpg", sent via Polaris-issued M365 to
    dana.reyes@polaris-ds.com at 19:42 on 2026-03-18.

ARTIFACT IN SCOPE
─────────────────────────────────────────────────────────────
  File:            soccer-field.jpg
  Source:          Reed Connolly (subject), via M365 mail
  Hash (sha256):   5f4dcc3b5aa765d61d8327deb882cf99c1e3b...
  Original?:       Polaris IT confirms M365 received the
                   original file without resizing or
                   re-encoding.

DRIFTWOOD TASK
─────────────────────────────────────────────────────────────
  Examine soccer-field.jpg and report:

  1. What the artifact is (file type, expected vs actual).
  2. What its embedded metadata says.
  3. Whether the metadata is consistent with the subject's
     stated account.

  Do NOT draw conclusions about the subject's guilt or
  innocence. Report findings only. Dana draws conclusions.

  Findings due to Dana by COB Friday 2026-03-20.

PENDING — FOLLOW-UP ARTIFACT (next engagement)
─────────────────────────────────────────────────────────────
  Polaris IT pulled a forensic image of the subject's primary
  workstation (host POL-WS-0418, asset tag PC-4118) on Tuesday
  night under the insider-threat program escalation. The image
  was packaged as a password-protected forensic archive (E01
  split, ~480 GB total) and uploaded to Polaris's secure
  transfer portal for Driftwood pickup.

  Archive password (one-time, set by Polaris FSO Sgt. Chen for
  this case handoff — DO NOT reuse, this is single-engagement):

      POL-IIS-2026-0007-handoff

  Next engagement (already booked on Driftwood's side):
  download the image, mount read-only, examine for evidence
  of unauthorized CUI access or exfiltration. Dana wants the
  workstation findings by next Friday.

  This file in scope: soccer-field.jpg. Workstation image
  examination is NOT in scope for today — that's the
  follow-up.`
        },

        // The \x00 escapes below are DELIBERATE and must stay escaped.
        // This string simulates a JPEG's leading bytes (JFIF + Exif
        // magic), and those bytes genuinely include NULs — `strings`
        // and `file` read this content, so the runtime value has to
        // keep them. Writing them as RAW 0x00 bytes in the source is
        // what we must avoid: it makes this whole file classify as
        // binary, after which `grep`/`rg` skip it SILENTLY (no match,
        // no warning) and any repo-wide search quietly misses every
        // forensics level. `\x00` evaluates to the identical
        // character while keeping the source plain text.
        "soccer-field.jpg": {
          type: "file",
          content:
`ÿØÿà..JFIF.....\x00\x00\x00\x00\x00\x00Exif\x00\x00II*\x00
[binary JPEG content — 2.4 MB on disk — omitted from terminal display.
 Use \`file\` to identify the artifact type, or \`exif\` to read
 embedded metadata. \`cat\` on a JPEG will not be useful here.]
ÿÙ`,
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that Reed Connolly's alibi photograph cannot
have been taken when and where he said it was. The EXIF metadata
embedded in soccer-field.jpg gives:

  DateTimeOriginal:  2025:07:18 14:23:51    (July 18, 2025)
  GPSLatitude/Long:  25.0865°N, 80.4473°W  (Key Largo, Florida)

Reed claimed the photograph was taken Saturday morning
2026-03-14 at Centreville Sports Complex in Centreville, VA
(approximately 38.84°N, 77.43°W). The metadata places the photo
eight months earlier and roughly 1,000 miles south of where Reed
said he was. Either the metadata is forged — and forging EXIF
deliberately is a learnable but unusual skill that leaves its own
forensic traces — or the photograph is from a previous trip and
Reed used it to manufacture an alibi.

Your job ends here. Dana Reyes will decide what Polaris does with
the finding. The forensic record stands on its own.


─── THE BLUNT VERSION ────────────────────────────────────────

Most people do not know how much metadata their devices embed.
Most people who DO know forget about it in the moment.

Every photograph from a modern smartphone is, by default,
tagged at capture with: a timestamp accurate to the second; GPS
coordinates accurate to ~3 meters when GPS is available; the
device make and model (which is often the owner's known device);
the OS version; the orientation; the camera's exposure settings.
That metadata travels with the file by default through every
common transport — email, AirDrop, Slack, M365, iMessage,
Signal-without-stripping, every cloud drive.

When someone reuses an old photo as proof of where they were
today, the metadata almost always exposes the lie. The very few
who know to strip it tend to ALSO strip it on photos they had
no reason to scrub — which becomes its own forensic flag
("why does this person sanitize photos?"). The mistake is
mundane on both sides.

For an investigator, the lesson is procedural: when offered a
photographic artifact, always read the metadata before you
read the pixels. Adversaries — including malicious insiders —
underestimate what the camera tells on them.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Polaris is a defense-industrial-base subcontractor. The
regulatory layer that sits on top of every internal
investigation here is heavier than at most non-DIB clients:

  CMMC Level 2  — Polaris's certification is tied to their
                   ability to bid on DoD contracts. A documented
                   insider-threat incident, handled badly, is a
                   findings event on their next reassessment.

  DFARS 252.204-7012 — incident reporting to DoD Cyber Crime
                   Center (DC3) within 72 hours of discovery
                   IF the incident involves the compromise of
                   covered defense information. The badge-log
                   anomaly alone is not yet a "compromise" — it's
                   an indicator. If the formal investigation
                   develops into a CUI exposure finding, the
                   72-hour clock starts at THAT discovery, not
                   the earlier badge-log audit.

  NISPOM (32 CFR Part 117) — for cleared facilities, security
                   officer notification requirements apply to
                   suspected insider-threat events involving
                   cleared personnel. Reed has a Secret
                   clearance. Polaris's FSO is in the loop.

  Insider Threat Program (NITTF Minimum Standards) — required
                   for any cleared contractor. Defines the
                   internal-process side of how Polaris handles
                   this from here.

For Driftwood: we're the forensics piece, not the investigation
itself. The MSA scope is bounded — we examine artifacts Dana
hands us, we report findings, we don't conclude. Stepping
outside that scope (e.g., asking to look at Reed's workstation
without authorization, or volunteering an opinion on Reed's
culpability) damages both the engagement and any future legal
proceeding. The MSA exists in part to protect chain of custody.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  NIST SP 800-86 — Guide to Integrating Forensic Techniques
  into Incident Response
    The canonical reference for procedurally-sound digital
    forensics in an enterprise / incident-response context.
    Section 4 covers data acquisition and preservation;
    Section 5 covers examination and analysis; Section 6 covers
    reporting. The "examine metadata before content" sequence
    is named explicitly.

  NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified
  Information (finalized May 2024; supersedes Rev. 2)
    03.06.01 Incident Handling — establish an operational
      incident-handling capability for organizational systems.
      Forensic competence is part of this.
    03.06.02 Incident Monitoring, Reporting, and Response
      Assistance — track, document, and report incidents.
      Chain-of-custody documentation is part of THIS, not
      optional.
    03.14.06, 03.14.07 — System monitoring and unauthorized-use
      detection. The badge-log audit that opened this case is
      the 03.14.x family working as designed.

  CMMC Level 2 (DoD CIO, 2024)
    The acquisition-side certification framework that maps to
    NIST 800-171. Domain IR (Incident Response) carries the
    forensic-capability practices listed above. CMMC was
    finalized in 2024 with a phased contract-clause rollout
    through 2028.

  CIS Critical Security Controls v8.1
    Control 17  Incident Response Management — establishes the
      foundation for forensic capability. 17.1 (designate
      personnel), 17.2 (define contact information), 17.3
      (establish reporting), 17.4 (document procedures).
    Control 14  Security Awareness — including OPSEC training
      for the metadata problem on the defender side.

  CWE
    CWE-200  Exposure of Sensitive Information to an Unauthorized
      Actor — applies on the SUBJECT side: Reed exposed his own
      location/timestamp by reusing a metadata-bearing artifact.
    CWE-359  Exposure of Private Personal Information — same
      pattern, slightly different framing.

  18 U.S.C. § 1832 — Theft of Trade Secrets
    If the formal investigation develops into a finding that
    Reed accessed Bay 4 to exfiltrate CUI or trade-secret
    information, federal criminal exposure attaches. Polaris's
    procedure handles when (and whether) to refer to FBI.


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA CySA+ (CS0-003)
    Domain 4 (Reporting and Communication) — chain of custody,
    evidence handling. Domain 3 (Incident Response and
    Management) — forensic procedures.

  GIAC GCFE (Certified Forensic Examiner)
    EXIF metadata extraction is on the exam. Image-forensics
    artifacts more broadly are a core domain.

  GIAC GCFA (Certified Forensic Analyst)
    The deeper version. File system / memory / network
    forensics in depth, including chain-of-custody and report
    writing.

  GIAC GCIH (Certified Incident Handler)
    The incident-response side. Procedural forensics in an
    enterprise IR context.

  EC-Council CHFI (Computer Hacking Forensic Investigator)
    Whole-cert relevant. EXIF / image forensics is in the
    "Investigating Digital Media" domain.

  CISSP
    Domain 7 (Security Operations) — includes "Conduct
    investigations" and "Conduct logging and monitoring
    activities." Forensic procedure is tested.

  Industry-internal: legal-hold and e-discovery training.
    Anyone who runs internal investigations professionally
    will encounter this category of artifact regularly.


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Insider-threat investigations don't map to MITRE ATT&CK
  techniques the way external-attacker incidents do — ATT&CK is
  designed around adversary behavior in a network, not human
  intent at a workplace. But for Reed's case the relevant
  attacker-side techniques to be aware of, IF the formal
  investigation develops in that direction, are:

  T1078     — Valid Accounts. The threat model where a
              legitimate-credentialed insider uses their own
              access to do something improper.
  T1583     — Acquire Infrastructure. The pre-compromise
              category that includes "Develop Capabilities" —
              e.g., reusing a previously-captured photograph as
              an alibi prop falls under capability development.
  T1592     — Gather Victim Host Information. The
              reconnaissance technique an insider may have
              performed before the badge event.

  None of these are confirmed by the forensic finding alone.
  They become relevant only if the formal investigation finds
  evidence of intent to exfiltrate.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For Polaris specifically, on this case: hand Dana the
     forensic finding (the EXIF output, your read of it, and
     a chain-of-custody note covering how we received the file
     and that we did not alter it). Dana decides next steps.

  2. For Polaris's insider-threat program generally:
     - The badge-log audit that surfaced this anomaly is the
       insider-threat control working correctly. Keep doing it.
       Weekly audits on after-hours badge events in CUI-handling
       bays is the norm in CMMC-certified facilities.
     - Pair badge-log anomalies with workstation-activity audit
       (Microsoft Purview, CrowdStrike Falcon Insight, Varonis,
       Code42 Incydr — anything that correlates physical access
       with subsequent host activity).
     - The forensic-examination capability that resolved this
       case is Driftwood-provided. Polaris should have an
       in-house or retainer-side forensics function — either
       internal team or contractual right of access to one,
       documented in their CMMC artifacts.

  3. For the broader OPSEC lesson (defender side):
     - Train cleared personnel on metadata persistence. People
       routinely share photos professionally without
       understanding what's embedded. The training cost is low;
       the operational impact of "an engineer photographed the
       fab floor and posted it" is high.
     - Issue metadata-stripping tooling on org-managed devices
       where photos may be shared externally. Image-stripping
       extensions / iOS Shortcuts that run mat2 or exiftool
       on share. Most defense contractors mandate this for
       photos that leave a controlled environment.
     - For the badge / physical-security layer, ensure that
       after-hours access to CUI bays requires a documented
       work-order. Some facilities go further: require a
       second-person rule (no solo after-hours bay access).
       The 800-171 / CMMC controls allow either approach if
       documented.

  4. For investigators using forensic artifacts (Driftwood
     side):
     - ALWAYS examine metadata before content. The artifact
       might be legitimate, in which case metadata corroborates;
       if it isn't, metadata is usually where the discrepancy
       shows up first.
     - Preserve chain of custody. Record how you received the
       artifact, when, in what form, what hash, what tools you
       ran against it. The forensic finding has to survive
       cross-examination if the case develops legal weight.
     - Use exiftool (Phil Harvey's, perl-based) as the default
       reference. mat2 for stripping. Autopsy or FTK Imager for
       deeper image/disk forensics.

  5. For the longer-arc lesson: insider-threat investigations
     have a specific procedural shape because their findings
     can result in firings, clearance revocations, and criminal
     referrals. The shape protects both the institution and the
     subject. Don't shortcut it.


─── CLOSING THOUGHT ──────────────────────────────────────────

There is a tendency, when you find the lie, to want to be the
one who confronts the person. Resist it. The forensic finding
is the artifact. Dana is the one who has to look Reed in the
eye and explain why HR is now in the room. The forensic
examiner's contribution is the small, exact piece of evidence
that lets the conversation happen on accurate footing.

In a real engagement this entire case takes Driftwood about
ninety minutes. The badge audit took a Polaris SOC analyst
fifteen. The damage Polaris would have absorbed if Reed had
been doing what Dana now suspects he was doing — and the case
had gone unexamined for another six months — would have been
measured in months of legal and contract exposure, possibly
in lost clearances, possibly in DoD acquisition consequences
that would outlive several Polaris employees.

The forensic finding is small. The system around it is what
makes it useful.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

  // ── level 1 — "What the Logs Saw" ───────────────────────────────
  // The Reed case has escalated. Polaris's insider-threat program
  // authorized a workstation seizure under NISPOM 32 CFR §117;
  // FSO Sgt. Chen pulled a live forensic image of POL-WS-0418
  // Tuesday night and packaged it in a password-protected EnCase
  // E01 set. The single-use handoff password is the breadcrumb
  // staged in level0@forensics's case-summary.txt — it gates entry
  // to this shell. The Windows Security event log was extracted
  // for first-pass triage. Two findings the player should surface:
  //
  //   1. Reed's CUI-exfil chain — reconstructed from 4663 file-
  //      access reads on D:\CUI\Subsystem-A, 4688 process-creation
  //      events for PowerShell Compress-Archive and certutil
  //      -encode (a documented LOLBin obfuscation pattern), and
  //      a chrome.exe upload to mega.nz. Frame: T1078 (Valid
  //      Accounts) + T1560.001 (Archive via Utility) + T1027
  //      (Obfuscated Files) + T1567.002 (Exfiltration to Cloud
  //      Storage).
  //
  //   2. The IR-team credential leak. A single 4625 failed-logon
  //      event in the Tuesday-night triage activity has
  //      TargetUserName = a typed password (Polaris IR Lead's
  //      cred, mistyped into the username field on a network
  //      auth prompt at ~11pm), with SubStatus 0xC0000064
  //      (STATUS_NO_SUCH_USER). The 4624 success 37 seconds
  //      later for `mvoss` from the same source IP /
  //      workstation confirms it's a typo, not an attack. The
  //      typed string IS the breadcrumb credential for
  //      level2@forensics. CWE-532 (Insertion of Sensitive
  //      Information into Log File) on the defender side.
  //
  // Lesson: Windows Security event log forensics under CMMC AU.L2-
  // 3.3.x audit-record controls. Introduces `evtx`.
  "level1@forensics": {
    password: "POL-IIS-2026-0007-handoff",
    track: "forensics",
    title: "What the logs saw (evtx)",
    estimatedMinutes: 18,
    playerUser: "secops",
    objective: "Triage Reed Connolly's workstation Security event log. Reconstruct his Saturday-morning activity inside the OS, identify any CUI exfiltration evidence, and flag any other findings Polaris's security team needs to know about.",
    lesson: "Dana Reyes escalated the Reed case to Polaris's formal insider-threat track Friday afternoon, right after your alibi finding closed the informal phase. Sgt. Chen (Polaris FSO) authorized a live forensic image of Reed's workstation POL-WS-0418 Tuesday night, packaged the EnCase E01 set with a single-use handoff password (POL-IIS-2026-0007-handoff — the same string that just gated this shell), and pushed it to Driftwood through Polaris's secure portal. The image is mounted read-only on a separate analysis volume; for today's narrow task only the Windows Security event log was extracted into this working directory. Read welcome.md first — it explains the new `evtx` command and how Windows event logs work. Then read engagement-notes.md, then case-summary.txt, then triage Security.evtx. Dana wants two things: a reconstruction of Reed's Saturday-morning activity at the keyboard, and any other findings the IR team needs to know about. Read lessons-learned.md once you've delivered both.",

    hints: [
      "Filter the Windows Security log by event ID. `evtx -id 4688` (process creation) reconstructs Reed's Saturday exfil chain — watch for Compress-Archive, certutil, and a mega.nz upload.",
      "There's a subtler second activity window: the IR team's Tuesday-night acquisition. Run `evtx -id 4625` (failed logons) and read that one record closely.",
      "Its `TargetUserName` field isn't a username — `STATUS_NO_SUCH_USER` means a password was typed into the username box. That leaked string is your password into `level2@forensics`.",
    ],

    // v1.10.0 BONUS FINDS — certutil.exe -encode in the 4688 chain
    // is a textbook LOLBin pattern. Orthogonal to the IR-credential
    // leak finding; doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "certutil-lolbin-pattern",
        name: "certutil as a LOLBin",
        hint: "Reed's 4688 process-creation chain includes certutil.exe -encode — a Microsoft-shipped binary whose dual-use potential makes it one of the founding entries on the LOLBAS project. The signal isn't that certutil ran; it's that certutil ran via cmd.exe with -encode arguments by a user who has no certificate-management reason to invoke it. Behavioural rules, not signature rules, catch this.",
        trigger: { command: "evtx", argMatches: /-id 4688/, outputContains: "certutil.exe" },
      },
    ],
    filetypes: {
      "Security.evtx": "Microsoft Windows Event Log, version 3 (EVTX)",
    },
    evtxLogs: {
      "Security.evtx": [
        // ── Saturday 2026-03-14 — Reed's exfil window (EDT 09:42-11:18 = UTC 13:42-15:18) ──
        {
          id: 4624,
          body:
`Event ID:        4624 (An account was successfully logged on)
TimeCreated:     2026-03-14T13:42:11.124Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        POL-WS-0418$
  SubjectDomainName:      POLARIS
  TargetUserName:         rconnolly
  TargetDomainName:       POLARIS
  LogonType:              2 (Interactive)
  LogonProcessName:       User32
  AuthenticationPackage:  Negotiate
  WorkstationName:        POL-WS-0418
  IpAddress:              127.0.0.1
  ProcessName:            C:\\Windows\\System32\\winlogon.exe`,
        },
        {
          id: 4663,
          body:
`Event ID:        4663 (An attempt was made to access an object)
TimeCreated:     2026-03-14T13:48:33.402Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  ObjectType:             File
  ObjectName:             D:\\CUI\\Subsystem-A\\subsystem-a-schematics.pdf
  AccessMask:             0x1 (ReadData)
  ProcessName:            C:\\Program Files\\Adobe\\Acrobat Reader\\AcroRd32.exe`,
        },
        {
          id: 4663,
          body:
`Event ID:        4663 (An attempt was made to access an object)
TimeCreated:     2026-03-14T13:51:02.118Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  ObjectType:             File
  ObjectName:             D:\\CUI\\Subsystem-A\\subsystem-a-bom.xlsx
  AccessMask:             0x1 (ReadData)
  ProcessName:            C:\\Program Files\\Microsoft Office\\root\\Office16\\EXCEL.EXE`,
        },
        {
          id: 4663,
          body:
`Event ID:        4663 (An attempt was made to access an object)
TimeCreated:     2026-03-14T13:54:18.881Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  ObjectType:             File
  ObjectName:             D:\\CUI\\Subsystem-A\\fab-process-notes.docx
  AccessMask:             0x1 (ReadData)
  ProcessName:            C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-14T14:04:18.812Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Windows\\System32\\cmd.exe
  NewProcessId:           0x2a4c
  ParentProcessName:      C:\\Windows\\explorer.exe
  TokenElevationType:     %%1938 (TokenElevationTypeLimited)
  CommandLine:            "C:\\Windows\\System32\\cmd.exe"`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-14T14:04:21.044Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe
  NewProcessId:           0x3b18
  ParentProcessName:      C:\\Windows\\System32\\cmd.exe
  TokenElevationType:     %%1938 (TokenElevationTypeLimited)
  CommandLine:            powershell.exe -Command "Compress-Archive -Path D:\\CUI\\Subsystem-A\\* -DestinationPath C:\\Users\\rconnolly\\AppData\\Local\\Temp\\sa-export.zip -Force"`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-14T14:06:44.029Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Windows\\System32\\certutil.exe
  NewProcessId:           0x4c22
  ParentProcessName:      C:\\Windows\\System32\\cmd.exe
  TokenElevationType:     %%1938 (TokenElevationTypeLimited)
  CommandLine:            certutil.exe -encode C:\\Users\\rconnolly\\AppData\\Local\\Temp\\sa-export.zip C:\\Users\\rconnolly\\AppData\\Local\\Temp\\sa-export.b64`,
        },
        {
          id: 4663,
          body:
`Event ID:        4663 (An attempt was made to access an object)
TimeCreated:     2026-03-14T14:09:17.502Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  ObjectType:             File
  ObjectName:             C:\\Users\\rconnolly\\AppData\\Local\\Temp\\sa-export.b64
  AccessMask:             0x2 (WriteData)
  ProcessName:            C:\\Windows\\System32\\certutil.exe`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-14T14:11:55.901Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
  NewProcessId:           0x5d44
  ParentProcessName:      C:\\Windows\\explorer.exe
  TokenElevationType:     %%1938 (TokenElevationTypeLimited)
  CommandLine:            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --new-window`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-14T14:42:08.318Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        rconnolly
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
  NewProcessId:           0x6a18
  ParentProcessName:      C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe
  TokenElevationType:     %%1938 (TokenElevationTypeLimited)
  CommandLine:            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --new-tab https://mega.nz/upload`,
        },
        {
          id: 4634,
          body:
`Event ID:        4634 (An account was logged off)
TimeCreated:     2026-03-14T15:18:47.221Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  TargetUserName:         rconnolly
  TargetDomainName:       POLARIS
  LogonType:              2 (Interactive)`,
        },

        // ── Tuesday night 2026-03-17 EDT → Wednesday 2026-03-18 UTC — IR triage activity ──
        {
          id: 4624,
          body:
`Event ID:        4624 (An account was successfully logged on)
TimeCreated:     2026-03-18T02:47:09.018Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        POL-WS-0418$
  SubjectDomainName:      POLARIS
  TargetUserName:         lchen
  TargetDomainName:       POLARIS
  LogonType:              10 (RemoteInteractive)
  LogonProcessName:       User32
  AuthenticationPackage:  Negotiate
  WorkstationName:        IR-JUMPBOX-01
  IpAddress:              10.42.7.18
  ProcessName:            C:\\Windows\\System32\\winlogon.exe`,
        },
        {
          id: 4625,
          body:
`Event ID:        4625 (An account failed to log on)
TimeCreated:     2026-03-18T03:02:14.881Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        -
  SubjectDomainName:      -
  TargetUserName:         P0l4r1s-IR-L3ad-2026!
  TargetDomainName:       POLARIS
  LogonType:              3 (Network)
  LogonProcessName:       NtLmSsp
  AuthenticationPackage:  NTLM
  WorkstationName:        IR-JUMPBOX-01
  IpAddress:              10.42.7.18
  Status:                 0xC000006D (STATUS_LOGON_FAILURE)
  SubStatus:              0xC0000064 (STATUS_NO_SUCH_USER — typed
                            "username" does not exist in directory)
  FailureReason:          %%2313 (Unknown user name or bad password)
  ProcessName:            -`,
        },
        {
          id: 4624,
          body:
`Event ID:        4624 (An account was successfully logged on)
TimeCreated:     2026-03-18T03:02:51.402Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        -
  SubjectDomainName:      -
  TargetUserName:         mvoss
  TargetDomainName:       POLARIS
  LogonType:              3 (Network)
  LogonProcessName:       NtLmSsp
  AuthenticationPackage:  NTLM
  WorkstationName:        IR-JUMPBOX-01
  IpAddress:              10.42.7.18
  ProcessName:            -`,
        },
        {
          id: 4688,
          body:
`Event ID:        4688 (A new process has been created)
TimeCreated:     2026-03-18T03:14:00.213Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  SubjectUserName:        lchen
  SubjectDomainName:      POLARIS
  NewProcessName:         C:\\Program Files\\AccessData\\FTK Imager\\FTK Imager.exe
  NewProcessId:           0x71a4
  ParentProcessName:      C:\\Windows\\explorer.exe
  TokenElevationType:     %%1936 (TokenElevationTypeFull)
  CommandLine:            "C:\\Program Files\\AccessData\\FTK Imager\\FTK Imager.exe"`,
        },
        {
          id: 4634,
          body:
`Event ID:        4634 (An account was logged off)
TimeCreated:     2026-03-18T06:14:08.881Z
Computer:        POL-WS-0418.polaris-ds.local
Channel:         Security
Provider:        Microsoft-Windows-Security-Auditing
Level:           Information

  TargetUserName:         lchen
  TargetDomainName:       POLARIS
  LogonType:              10 (RemoteInteractive)`,
        },
      ],
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Forensics Analysis Workstation ────────

Still \`secops\` on the same forensics-triage workstation. Day
two of the Polaris case. The alibi finding went to Dana Reyes
last Friday — she escalated to the formal insider-threat track
exactly as the workflow expects. Polaris's FSO (Sgt. Chen) pulled
a live forensic image of Reed Connolly's workstation (host
POL-WS-0418) on Tuesday night under the insider-threat program,
packaged the E01 set with a single-use password, and handed it
off through Polaris's secure portal.

That handoff password (\`POL-IIS-2026-0007-handoff\`, set by
Sgt. Chen in his case-summary.txt at the end of the prior
engagement) is what just gated entry to this shell. Same string
gates both the archive and this triage workspace, by design.
Single-use means it gets rotated/destroyed after this engagement
closes.

Today's narrow task: examine the Windows Security event log
extracted from Reed's workstation image and reconstruct what
he did inside the OS during the Saturday-morning badge-log
window.


─── NEW COMMAND ───────────────────────────────────────────────

  evtx [-id <ID>] <file>
      Parse a Windows Event Log (.evtx) file and print structured
      event records. With no flag, dumps every event in
      chronological order. With -id, filters to a single Event ID.

      Examples:
        evtx Security.evtx              dump everything
        evtx -id 4625 Security.evtx     only failed logons
        evtx -h                         full usage + ID reference


─── WHAT WINDOWS EVENT LOGS REVEAL ────────────────────────────

Windows writes audit records to four primary channels:

  Security        Authentication, authorization, object access,
                  process execution. The single most useful
                  log for IR.
  System          OS-level events (driver loads, service
                  start/stop, reboots, time changes).
  Application     Per-application diagnostic events (mostly
                  noise from an IR perspective).
  Setup           OS installation / servicing events.

Today's artifact is the Security channel — Security.evtx,
extracted from Reed's workstation image at the standard path
C:\\Windows\\System32\\winevt\\Logs\\Security.evtx. CMMC L2
control AU.L2-3.3.1 mandates that audited events be sufficient
to support after-the-fact investigations; NIST SP 800-171 §3.3.1
carries the same requirement underneath. The fact that this
file is examinable IS the audit-and-accountability control
working as designed.

Common Security-channel Event IDs worth knowing:

  4624   An account was successfully logged on
  4625   An account FAILED to log on
  4634   An account was logged off
  4663   An attempt was made to access an object (file/registry)
  4688   A new process has been created (includes command line,
         when command-line auditing is enabled via Group Policy)

Each record carries a TimeCreated timestamp (UTC), a Computer
name, and a set of typed fields (TargetUserName, ObjectName,
CommandLine, LogonType, SubStatus, etc.). The combination of
file-access (4663) and process-creation (4688) records is what
usually reconstructs what someone DID inside the OS — beyond
just when they logged in.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Polaris update from Priya
  2.  cat case-summary.txt        New case state, scope for today
  3.  evtx Security.evtx          Dump everything to get the lay
                                  of the land. ~16 events total,
                                  spanning two distinct windows.
  4.  evtx -id <ID> Security.evtx Filter to specific event types
                                  (4624 / 4625 / 4663 / 4688).
  5.  Reconstruct Reed's Saturday-morning activity AND identify
      any other finding the IR team needs to know about. The
      Reed timeline becomes obvious from the 4688 process-
      creation chain. The other finding is subtler — look at
      the failed-logon events carefully.
  6.  cat lessons-learned.md      Post-mortem (after step 5)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Polaris Defense Systems — engagement notes (continued)

Client: Polaris Defense Systems (CMMC L2, NIST 800-171 Rev. 3)
Case ID: POL-IIS-2026-0007 — Reed Connolly insider-threat
         investigation (continuation)
Driftwood handler: Priya
Client counterpart: Dana Reyes (in-house counsel); Sgt. Marcus
                    Chen (Polaris FSO, evidence custody)
Driftwood task ID: DW-FORENSICS-POL-2026-014 (forensic image
                   examination, continuation)

## What happened since the last task

Friday 2026-03-20 morning: We delivered the EXIF finding on
the alibi photograph to Dana — the photo was taken 2025-07-18
in Key Largo, Florida, eight months before Reed claimed to
have taken it at the Centreville soccer tournament. Forensic
record signed and hashed; chain of custody held.

Friday 2026-03-20 late afternoon: Dana escalated the case to
Polaris's formal Insider Threat Program. Sgt. Chen, in his
capacity as Polaris's Facility Security Officer (FSO), took
custody of the evidence trail and authorized a workstation
seizure under NISPOM 32 CFR §117.8(c) (cleared-contractor
investigative authority). Reed's clearance was administratively
suspended same day; his badge access was revoked; he was placed
on paid administrative leave pending investigation outcome.

Tuesday night 2026-03-17 → Wednesday morning 2026-03-18 UTC:
Polaris IR team pulled a live forensic image of POL-WS-0418
(Reed's primary workstation) using FTK Imager. The acquisition
ran from IR-JUMPBOX-01 (10.42.7.18) via out-of-band management;
Sgt. Chen was the operator, Maya Voss (Polaris IR Lead)
was supervising. Live acquisition was chosen over power-off
because powering Reed's workstation down would have alerted him
in the morning; the IR-jumpbox channel keeps the activity quiet
while the formal process proceeds.

The image is an EnCase E01 split set, 8 segments, ~480 GB total,
packaged in a password-protected archive. Sgt. Chen set a
single-use password for the handoff:

    POL-IIS-2026-0007-handoff

(Same string that just gated this shell. The triage workspace
and the archive share the same single-use credential by design.
Both get rotated/destroyed when the engagement closes.)

## Scope for this engagement

Dana wants two things by COB Wednesday:

  1. A reconstruction of what Reed did INSIDE the OS during
     the Saturday 2026-03-14 13:42-15:18 UTC (09:42-11:18 EDT)
     badge-log window. The badge log proves he was IN Bay 4
     for ~96 minutes. The question is what he did at the
     keyboard during that time.

  2. Any indicators that CUI (Controlled Unclassified
     Information) was exfiltrated. If yes, DFARS 252.204-7012
     starts a 72-hour reporting clock to DoD Cyber Crime Center
     (DC3) at THAT discovery moment.

Polaris IT extracted the Windows Security event log
(Security.evtx, normally at
C:\\Windows\\System32\\winevt\\Logs\\Security.evtx) from the
mounted image and dropped it in this working directory. The
full mounted E01 is available on a separate analysis volume,
but for today's narrow task the Security log should be
sufficient to answer Dana's two questions.

## A note from Priya

The IR triage Sgt. Chen ran Tuesday night was thorough but not
quiet — the workstation was live-imaged and there's some post-
Reed-shift activity in the log that's NOT Reed. Be careful to
distinguish:

  - Saturday morning UTC events (Reed)
  - Wednesday-early-morning UTC events (Polaris IR team
    triaging the workstation under Sgt. Chen's supervision)

Both show up in this Security.evtx because both happened on the
same machine. Don't confuse Tuesday-night IR-team activity with
Saturday-morning Reed activity in your write-up. Dana cares
about Reed.

Also — and this is awkward — there's a finding in the IR-team
activity from Tuesday night that I noticed during my own
walkthrough of the file. It's not the Reed case directly, but
it IS something Polaris needs to know about. Polaris's IR team
has their own follow-on remediation to do. Flag it when you
find it; don't sit on it. The lessons-learned at the end of
this engagement will frame how to present it to Dana so it
doesn't get lost.

— Priya`
        },

        "case-summary.txt": {
          type: "file",
          content:
`POLARIS DEFENSE SYSTEMS — INTERNAL INVESTIGATION CASE SUMMARY
Case ID:           POL-IIS-2026-0007
Status:            ACTIVE — workstation forensic examination
Opened by:         Dana Reyes (in-house counsel)
Escalated:         2026-03-20 — formal insider-threat track
Driftwood ref:     DW-FORENSICS-POL-2026-014

SUBJECT
─────────────────────────────────────────────────────────────
  Name:            Connolly, Reed M.
  Title:           Senior Manufacturing Engineer
  Department:      Electronics Subsystems, Bay 4
  Clearance:       DoD Secret — administratively suspended
                   pending investigation outcome (effective
                   2026-03-20, per Sgt. Chen)
  Badge ID:        POL-0418 — access revoked 2026-03-20
  Workstation:     POL-WS-0418 (Dell OptiPlex 7090; asset
                   tag PC-4118; assigned Q3 2023)
  Employment:      Paid administrative leave, effective
                   2026-03-20, pending investigation outcome.

ACQUISITION CHAIN OF CUSTODY
─────────────────────────────────────────────────────────────
  Imaging tool:    FTK Imager v4.7.1.2
  Imaging window:  2026-03-17 22:47 EDT (logon)
                   → 2026-03-18 02:14 EDT (logoff)
                   = 2026-03-18 02:47-06:14 UTC
  Imaged by:       L. Chen (Polaris FSO), supervised by
                   M. Voss (Polaris IR Lead), remote
                   acquisition from IR-JUMPBOX-01 (10.42.7.18)
  Acquisition:     Live, OOB-management-mediated, read-only
                   target volume. Source machine remained
                   powered and connected to corp network to
                   preserve memory-resident state and to
                   avoid alerting subject.
  Image format:    EnCase E01 split, 8 segments, ~480 GB total
  Hash (sha256):   d4f7b8e2a9c1f5e6...
                   [hash recorded in Polaris evidence-tracking;
                    full value in DW-FORENSICS-POL-2026-014]
  Transferred to:  Driftwood secure portal, 2026-03-18 06:30 UTC
  Archive:         POL-IIS-2026-0007.7z (password-protected)
                   Single-use handoff password (set by Sgt. Chen):
                       POL-IIS-2026-0007-handoff

ARTIFACTS IN SCOPE (THIS TASK)
─────────────────────────────────────────────────────────────
  File:            Security.evtx
  Source path:     C:\\Windows\\System32\\winevt\\Logs\\Security.evtx
                   (extracted from mounted image)
  Size:            8,388,608 bytes (8 MB), 16 events parsed
  Date range:      2026-03-14 13:42 UTC → 2026-03-18 06:14 UTC

DRIFTWOOD TASK
─────────────────────────────────────────────────────────────
  Examine Security.evtx and report:

  1. Activity timeline INSIDE the OS during the Saturday
     2026-03-14 13:42-15:18 UTC (09:42-11:18 EDT) badge-log
     window. What did Reed do at the keyboard.

  2. Whether the activity suggests CUI access or
     exfiltration. Cite specific events.

  3. Any other findings in the log that Polaris's security
     team needs to be aware of, whether or not they relate to
     Reed. (Per Priya's note — there is a finding in the
     post-Reed IR-triage activity from Tuesday night that
     requires same-week follow-up.)

  Findings due to Dana by COB Wednesday 2026-03-25.

NEXT ENGAGEMENT (already booked)
─────────────────────────────────────────────────────────────
  Pending Dana's review, the next planned task is full-image
  triage on the mounted E01: prefetch, MFT/USN timeline,
  browser history, USB-insertion artifacts (Registry USBSTOR
  + setupapi.dev.log), Recycle Bin parsing. Coordinate with
  Sgt. Chen for the next jumpbox access window.`
        },

        "Security.evtx": {
          type: "file",
          content:
`ElfFile\\x00\\x00\\x10\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x10\\x00...
[binary Windows Event Log content — 8.4 MB on disk — omitted
 from terminal display. Use \`evtx Security.evtx\` to parse and
 view the structured event records. Try \`evtx -h\` for filter
 syntax. \`cat\` on a .evtx file will not be useful here.]`,
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You found two distinct things in Security.evtx.

The first was the case Dana asked about. Reed Connolly's
Saturday-morning activity, reconstructed from the audit log:

  13:42 UTC   4624 Interactive logon (workstation console)
  13:48-13:54 4663 Reads of three CUI artifacts on D:\\
              (subsystem-a schematics, BOM, fab-process-notes)
  14:04 UTC   4688 cmd.exe → 4688 powershell.exe with a
              Compress-Archive cmdline that gathered the CUI
              directory into sa-export.zip in his AppData\\Temp
  14:06 UTC   4688 certutil.exe -encode of that zip into
              sa-export.b64 (the "encode" subcommand is a
              well-known LOLBin obfuscation pattern; certutil
              has no other reason to be invoked here)
  14:09 UTC   4663 write of the .b64 file
  14:11-14:42 4688 chrome.exe launched, then a second chrome
              process opened with a --new-tab argument pointing
              at https://mega.nz/upload
  15:18 UTC   4634 logoff

That's not "stopped by to grab a personal item from my locker."
That's a CUI exfiltration chain — collected → archived →
encoded (to defeat content-inspection DLP that looks for file
signatures or keyword strings) → uploaded to a personal file-
sharing service. The badge log put Reed in Bay 4 for 96 minutes;
the event log shows what he did at the keyboard while he was
there.

The second finding was the awkward one Priya warned you about.
In the 4625 failed-logon events from Tuesday night's IR triage,
one record has this TargetUserName field:

      P0l4r1s-IR-L3ad-2026!

With SubStatus 0xC0000064 (STATUS_NO_SUCH_USER), meaning the
typed string did not exist in the directory as a username.
Followed 37 seconds later by a 4624 success for \`mvoss\`
from the same workstation (IR-JUMPBOX-01), same source IP
(10.42.7.18), same network logon type.

That string isn't a username. It's a password — Maya Voss
(Polaris's IR Team Lead, supervising Sgt. Chen's triage at
~11pm EDT) typed her password into the username field on a
network-auth prompt and Windows logged it verbatim. The 4624
success 37 seconds later is him retrying with the fields in the
right boxes. This is the classic "credential leaked in 4625
TargetUserName" pattern — documented in SANS DFIR coursework
and Microsoft's own SIEM guidance. Polaris needs to rotate
mvoss's credentials AND any IR-team service account that
password is connected to, NOW, before the log gets handed off
to anyone outside the chain-of-custody loop.


─── THE BLUNT VERSION ────────────────────────────────────────

Windows writes auditable records for every meaningful thing
that happens at the OS layer — logons, file access, process
starts (with full command line, when Group Policy "Include
command line in process creation events" is enabled), service
state changes, registry modifications, privilege use. The
Security channel is where most of the IR-relevant records
land.

If the events are turned on, they catch almost everything an
insider does. Most enterprise environments leave them turned
off by default — or worse, turn them on but never query them.
Polaris has them on because CMMC AU.L2-3.3.x mandates it.
That's why this finding exists.

The 4625-typed-password pattern is one of those things that
defenders learn about, joke about for half a class, and then
find in the wild within a year. Real people, including IR
analysts, mistype passwords into username fields. When the
SubStatus is 0xC0000064 (no such user) AND the TargetUserName
field looks like a password (mixed case + digits + symbols,
length over ~12 chars), that's the signature. Some SIEM
platforms have built-in detection rules for it; most don't.
Worth adding one.

The certutil -encode pattern is also worth knowing on sight.
Microsoft ships certutil.exe for certificate-management
purposes, but it has -encode/-decode subcommands that perform
base64 conversion. Threat actors and insiders use those
subcommands to obscure payloads from content-inspection tools.
The LOLBAS project (Living Off The Land Binaries, Scripts and
Libraries — lolbas-project.github.io) catalogs ~200 such
binaries shipped with Windows that have dual-use potential.
certutil is at the top of that list.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Polaris is CMMC Level 2 / NIST 800-171 Rev. 3 / DFARS-bound.
The findings you just delivered carry specific regulatory
weight:

  DFARS 252.204-7012 (c) — the 72-hour reporting clock to
  DoD Cyber Crime Center (DC3) starts at discovery of "any
  cyber incident affecting [a covered contractor information
  system] that involves the compromise of covered defense
  information." The CUI artifacts Reed read (subsystem-a
  schematics, BOM, fab-process-notes) are covered defense
  information. Polaris's discovery moment is when Dana receives
  THIS finding — which means the clock starts when you transmit
  the report. Dana coordinates with Polaris's General Counsel
  and FSO on DC3 notification timing.

  NIST SP 800-171 Rev. 3 §03.03.01, §03.03.02 — Polaris's
  audit-logging program is what made this case examinable. Cite
  this engagement as evidence of effective control operation
  during the next CMMC re-assessment. (Rev. 3 adopted a
  zero-padded numbering scheme — \`03.03.x\` — distinct from
  Rev. 2's \`3.3.x\` style.)

  NIST SP 800-171 Rev. 3 §03.06 (Incident Response family) —
  the formal IR procedures Polaris is running on Reed include
  containment (badge revocation: done 2026-03-20; clearance
  suspension: done; workstation isolation: done as of the live
  image), eradication (rotate Reed's account credentials, M365
  / VPN tokens), and recovery (cleanup of his AppData\\Temp, audit
  of any external systems he touched during the exfil window).

  NISPOM 32 CFR Part 117 — Polaris's FSO has clearance-side
  reporting obligations. Sgt. Chen will file a Suspicious
  Contact Report (SCR) and an Adverse Information Report with
  DCSA (Defense Counterintelligence and Security Agency) on
  Reed's clearance. Separate process from the DFARS notification;
  both run in parallel.

The IR-team credential-leak finding has its own consulting
angle. It's a process miss, not a malicious act — an exhausted
responder at 11pm EDT. The remediation has three parts:

  1. Immediate credential rotation for mvoss and any
     IR-team service account that password was attached to.
     Same-day, before any audit-log handoff to external
     parties (including Driftwood) that might preserve the log
     outside Polaris's direct control.
  2. SIEM rule addition: alert on 4625 + SubStatus 0xC0000064
     + TargetUserName matching password-shape patterns.
     (Implementation note: most SIEM platforms don't ship
     this by default.)
  3. Light retraining for the IR team on credential hygiene
     under fatigue. Frame it as "the audit caught us this
     time" rather than punitive — this is a humans-get-tired-
     at-11pm finding, not a careless-individual finding.

For Driftwood: when you write the engagement report for Dana,
the Reed exfil section is the primary deliverable; the 4625
finding goes under a separate "Other observations" header.
Don't bury it (it requires action) and don't elevate it above
the Reed case (it's procedural). One-sentence framing:
"Separately, during examination of the same log file, we
noticed a credential-handling lapse in the post-acquisition
IR activity that warrants a same-week remediation. Detail
in §X."


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  NIST SP 800-53 Rev. 5 — AU family (Audit and Accountability)
    AU-2  Event Logging — what gets logged.
    AU-3  Content of Audit Records — what fields each record
          carries. AU-3(1) is command-line capture (Reed's
          PowerShell and certutil cmdlines are AU-3(1)
          operating as designed).
    AU-6  Audit Record Review, Analysis, and Reporting — the
          "actually look at the logs" control. This whole
          engagement is AU-6 working correctly.
    AU-9  Protection of Audit Information — the integrity of
          Security.evtx itself. Chain of custody on this
          file is what makes the finding admissible if the
          case develops criminal weight.
    AU-12 Audit Record Generation — the rules that govern
          what generates an audit record at the system level.

  NIST SP 800-92 — Guide to Computer Security Log Management
    The canonical reference for enterprise log management.
    Originally published 2006; NIST published a Revision 1
    Initial Public Draft on October 11, 2023 to align with
    SIEM/SOAR practices, but as of mid-2026 no Final has been
    released — NIST is still processing public comments.
    Section 3 (Log Management Infrastructure) and Section 5
    (Operational Processes) are the active sections for IR.

  NIST SP 800-86 — Guide to Integrating Forensic Techniques
  into Incident Response
    Already cited in the prior engagement (Reed's alibi
    photo). Section 5.2 covers data examination including
    event-log triage. Procedurally what we just did.

  NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified
  Information
    §03.03 (Audit and Accountability) family — direct
    inheritance from 800-53 AU controls, profiled for
    non-federal systems handling CUI. What Polaris is
    audited against. (Rev. 3 numbering uses zero-padded
    \`03.03.x\` form, distinct from Rev. 2's \`3.3.x\`.)

  CMMC Level 2 (DoD CIO, finalized 2024)
    Domain AU — Audit and Accountability practices map 1:1
    to NIST 800-171 §03.03 (Rev. 3 numbering; §3.3 in the
    Rev. 2 form CMMC tooling still surfaces alongside the
    update). Polaris's CMMC posture is what funds the SOC
    capacity that runs these audits in the first place.

  CIS Critical Security Controls v8.1
    Control 8  Audit Log Management — the whole control.
      8.1 (establish audit log management process), 8.2
      (collect audit logs), 8.4 (standardize time
      synchronization), 8.5 (collect detailed audit logs),
      8.10 (retain audit logs), 8.11 (conduct audit log
      reviews). 8.11 is the "actually look" safeguard.

  CWE
    CWE-532  Insertion of Sensitive Information into Log File
      — the 4625-typed-password-as-username finding. Worth
      knowing this CWE by number; it shows up in log-
      handling design reviews regularly.
    CWE-117  Improper Output Neutralization for Logs —
      adjacent; covers log injection rather than passive
      sensitive-data exposure.
    CWE-200  Exposure of Sensitive Information to an
      Unauthorized Actor — parent of CWE-532. Note: CWE-200
      itself is now mapping-Discouraged; cite the more
      specific CWE-532 for direct mappings.

  Microsoft documentation
    The "Audit Logon" and "Audit Failed Logons" subcategories
    of the Advanced Audit Policy. The 4624 / 4625 split,
    LogonType meanings (2 Interactive, 3 Network, 10
    RemoteInteractive, etc.), and SubStatus codes
    (0xC0000064 / 0xC000006A / 0xC0000234 / 0xC0000072) are
    documented at learn.microsoft.com under
    "windows/security/threat-protection/auditing".

  LOLBAS Project (lolbas-project.github.io)
    Community-maintained catalog of Living-Off-The-Land
    binaries shipped with Windows. certutil.exe with its
    -encode/-decode subcommands is one of the founding
    entries in the database.


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  GIAC GCFE (Certified Forensic Examiner)
    The Windows-forensics-on-disk specialist cert.
    Security.evtx structure and analysis is core content.
    Feeds from SANS FOR500.

  GIAC GCFA (Certified Forensic Analyst)
    The deeper IR/forensics cert. Event-log analysis at
    timeline-reconstruction depth. Feeds from SANS FOR508.

  GIAC GCIH (Certified Incident Handler)
    The enterprise-IR cert. Detection-engineering side
    of event-log monitoring (designing the rule that
    fires on 4625 + 0xC0000064 + password-shape
    TargetUserName). Feeds from SANS SEC504.

  GIAC GCDA (Continuous Monitoring & Security Operations
  Analyst)
    SOC/SIEM-side cert. Detection engineering, log pipeline
    design, threat hunting in event-log data. Feeds from
    SANS SEC555 (recently renamed "Detection Engineering and
    SIEM Analytics" — previously "SIEM with Tactical
    Analytics").

  CompTIA CySA+ (CS0-003 / CS0-004)
    Domain 1 (Security Operations) — log analysis and SIEM
    correlation. Domain 3 (Incident Response and Management)
    — forensic analysis including event logs. CS0-004 launched
    in early 2026 for parallel availability; CS0-003 retires
    June 2026.

  ISC2 CISSP
    Domain 7 (Security Operations) — includes "Conduct
    logging and monitoring activities" and "Conduct
    investigations." Procedural side of what we did today.

  Microsoft SC-200 (Security Operations Analyst Associate)
    The Microsoft-native SOC cert. Microsoft Sentinel KQL
    queries, Microsoft Defender XDR investigation. Where
    the modern Microsoft-stack defender lives.

  EC-Council CHFI (Computer Hacking Forensic Investigator)
    Module 13 (Windows Forensics) covers event logs in
    depth. Whole-cert forensics-focused.


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Reed's Saturday-morning activity (attacker-side):

    T1078       Valid Accounts — Reed used his own valid
                domain credentials. Single most common
                technique in insider-threat ATT&CK mappings.
    T1083       File and Directory Discovery — the 4663
                reads on D:\\CUI\\Subsystem-A indicate
                deliberate enumeration of the CUI share.
    T1560.001   Archive Collected Data: Archive via Utility
                — Reed's PowerShell Compress-Archive of the
                CUI directory.
    T1027       Obfuscated Files or Information — Reed's
                certutil -encode of the zip into base64.
                Base64 isn't strong obfuscation; it defeats
                naive content-inspection DLP that greps for
                file signatures or sensitive-keyword strings,
                which is the actual goal here.
    T1059.001   Command and Scripting Interpreter:
                PowerShell — the Compress-Archive cmdline.
    T1059.003   Command and Scripting Interpreter: Windows
                Command Shell — cmd.exe parent process.
    T1567.002   Exfiltration Over Web Service: Exfiltration
                to Cloud Storage — Reed's chrome.exe
                --new-tab to https://mega.nz/upload.

  Defender-side framing:

    The IR-team credential-in-4625 finding is not an ATT&CK
    technique (it wasn't malicious). It's a detection-
    engineering moment: the audit infrastructure caught a
    credential-hygiene failure that no other control would
    have surfaced. File it under D3FEND defender taxonomy
    rather than ATT&CK, or just under "audit-log review
    surfaced an internal process miss" in your write-up.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For the Reed case specifically:
     - Hand Dana the timeline. Include the exact event IDs
       and timestamps; let her cite them to General Counsel.
     - Sign and hash Security.evtx as part of the chain-of-
       custody package. The hash you compute now is what
       proves the log wasn't altered between acquisition
       and any eventual proceeding.
     - Do NOT speculate in the report about Reed's intent.
       The events show what happened; intent is Dana's call
       to make with HR / legal / DCSA in the loop.

  2. For the IR-team credential leak:
     - Same-day rotation of mvoss's password and any
       service-account credential keyed to it.
     - Write a SIEM detection rule. Sigma format (portable
       across SIEM platforms):

           detection:
             selection:
               EventID: 4625
               SubStatus: '0xC0000064'
             filter:
               TargetUserName|re: '^[a-zA-Z0-9._-]{1,16}$'
             condition: selection and not filter

       (Anything matching 4625 + 0xC0000064 with a
        TargetUserName that does NOT look like a normal
        username — i.e., contains symbols, mixed case +
        digits, or is unusually long — fires the alert.)

     - Short retraining for the IR team on credential
       hygiene under fatigue. Frame it as "the audit caught
       us this time" rather than "mvoss is careless."
       Hygiene under fatigue, not character.

  3. For Polaris's longer-arc audit-log program:
     - Confirm command-line auditing is enabled via Group
       Policy (Computer Configuration → Policies →
       Administrative Templates → System → Audit Process
       Creation → "Include command line in process creation
       events"). Without it, the 4688 events wouldn't have
       carried the PowerShell or certutil cmdlines and this
       case would have been much harder to make. Polaris had
       it on; confirm it across the rest of the fleet.
     - Confirm 4663 file-access auditing is enabled on
       D:\\CUI\\ at minimum (Microsoft's default is OFF;
       file-access auditing has measurable performance
       overhead, so most environments disable it broadly and
       enable it on specific sensitive shares). Polaris had
       it on for the CUI volume; that's why Reed's reads
       showed up.
     - Sysmon (sysinternals.com) extends the native audit
       categories with richer process-tree visibility
       (Sysmon Event ID 1 for process creation includes
       parent process hash, image hash, and per-process full
       cmdline regardless of GPO setting). For a CUI-handling
       environment, Sysmon is essentially free additional
       fidelity. Polaris should deploy it if they haven't.
     - For SIEM aggregation: ship Security.evtx via Windows
       Event Forwarding (WEF) to a central collector, then
       ingest into the SIEM. EZ Tools' EvtxECmd
       (ericzimmerman.github.io) for manual analysis;
       Hayabusa (github.com/Yamato-Security/hayabusa) and
       Chainsaw (github.com/WithSecureLabs/chainsaw) for
       hunting at scale.

  4. For DFARS 7012 reporting:
     - Dana coordinates with General Counsel on DC3
       notification timing. The 72-hour clock is real;
       missing it is a contractual non-compliance event.
     - The DIBNET portal (dibnet.dod.mil) is where the
       report files. Polaris's FSO has the credentials.

  5. For the broader lesson:
     - Insider-threat detection in cleared environments
       depends on audit-log infrastructure that's been
       properly configured, properly aggregated, AND
       properly reviewed. None of those three are free.
       Polaris's CMMC posture is what funds the SOC capacity
       that runs the reviews; the CMMC posture is what
       protected this CUI from going undetected for months.


─── CLOSING THOUGHT ──────────────────────────────────────────

You found two things. The first was the case Dana opened. The
second was a procedural lapse Polaris's own team made during
the response to the case. Both matter. Both go in the report.

The temptation is to lead with the dramatic finding — Reed's
exfil chain reconstructed from event timestamps is the story
everyone will want to talk about. Lead with that. But don't
bury the IR-team credential leak in the appendix. It needs to
surface to Sgt. Chen and Larry Hutchins same-day, and surfacing
it cleanly is what distinguishes a forensics report from a
finger-pointing exercise.

The infrastructure that catches a CUI-exfil insider is the
same infrastructure that catches an exhausted IR analyst's
typo. The system doesn't know the difference. You're the one
who reads what the system recorded and decides what each
finding requires. Both go in.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

  // ── level 2 — "What Reed's Browser Saw" ─────────────────────────
  // Day three of the Reed Connolly case. The level1 evtx finding has
  // closed: the IR-team responder credential leak was surfaced same-
  // day to Sgt. Chen and Larry Hutchins. Maya Voss (Polaris IR-lead,
  // whose credential leaked in level1's 4625) rotated her account
  // and authorized a deeper forensic pass on Reed's seized workstation
  // image. Today's task: query the browser-artifact SQLite databases
  // recovered from Reed's user profile and reconstruct what he did
  // online in the hours before the 09:42 Bay 4 badge-in. The lesson
  // is browser-database forensics — places.sqlite / Chromium History
  // / Cookies as the de-facto user-activity ledger every modern
  // device maintains — under NIST SP 800-86 (Guide to Integrating
  // Forensic Techniques into Incident Response). Mapped to CMMC
  // AU.L2-3.3.x audit-record controls + NIST 800-171 3.3.1 (System
  // Audit Records). Introduces `sqlite3`.
  //
  // Player credential gating: P0l4r1s-IR-L3ad-2026! is the level1
  // breadcrumb (Maya's leaked password). Maya rotated her primary
  // account, but the `ir-audit` service account on the IR forensic
  // bench retained the same password pattern — an IR-team password-
  // hygiene anti-pattern that the level surfaces obliquely
  // (lessons-learned calls it out). The player ssh's in as that
  // service account.
  //
  // Breadcrumb out: Reed's Google session cookie value
  // (RC-Gmail-PreDawn-2026-03-14-T0247Z), extracted from the
  // Cookies.sqlite database via SELECT. The string is a session
  // token that gates level3@forensics (where the player will
  // examine Reed's outbound webmail headers).
  "level2@forensics": {
    password: "P0l4r1s-IR-L3ad-2026!",
    track: "forensics",
    title: "What Reed's browser saw (sqlite3)",
    estimatedMinutes: 20,
    playerUser: "ir-audit",
    objective: "Query Reed Connolly's recovered browser-artifact databases (History + Cookies) to reconstruct his online activity in the hours before the 09:42 Bay 4 badge-in. Surface any session token, login state, or download record that could be useful evidence and that the Polaris IR team can follow up on.",
    lesson: "Day three of the Reed case. Friday closed clean: the evtx finding was packaged for Sgt. Chen, the IR-credential leak surfaced to Larry Hutchins inside three hours, and Maya Voss (Polaris's IR-lead) rotated her primary account. Maya then authorized a deeper pass on Reed's seized workstation image — specifically the user-profile artifacts the EnCase E01 set carried over but level1 didn't touch. Sgt. Chen pushed those artifacts (Reed's Chromium browser-profile databases) to Polaris's IR forensic bench, where you're now logged in as the `ir-audit` service account. (Awkward note: Maya's `ir-audit` service account still carries the same password pattern that just gated this shell. That's a finding too — separate from today's task, but the lessons-learned file flags it.) Your job: query History.sqlite and Cookies.sqlite to reconstruct what Reed did online in the hours before the 09:42 Bay 4 badge-in. Read welcome.md first; it introduces the new `sqlite3` command. Then case-notes.md for the scope, then chain-of-custody.txt for the hash baseline. When you've surfaced the smoking-gun session token, read lessons-learned.md.",

    crossTrackHooks: ["linux"],

    hints: [
      "Browse the working directory with `ls`. The Reed/ subdirectory holds two .sqlite files. Run `sqlite3 Reed/History.sqlite \".tables\"` to see what tables the Chromium History DB carries (urls, visits, downloads, keyword_search_terms — the same names Chrome has used since ~2010).",
      "The `urls` table has a `last_visit_time` column. Sort it descending and look at the most-recent 20 entries: `sqlite3 -header Reed/History.sqlite \"SELECT url, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 20\"`. One row from 02:47 Saturday morning will stand out — Reed accessed personal webmail seven hours before the Bay 4 badge-in. That's the lead. Follow it into Cookies.sqlite.",
      "Cookies.sqlite has a `cookies` table keyed by `host_key`. Filter for the webmail host you found in History: `sqlite3 -header Reed/Cookies.sqlite \"SELECT host_key, name, value FROM cookies WHERE host_key LIKE '%mail.google%'\"`. One cookie row's `value` column carries an explicit session-token string. That string is your breadcrumb out — it's the credential level3 needs to verify Reed's outbound mail.",
    ],

    // BONUS FIND — a Compress-Archive-via-PowerShell downloader
    // record sitting in History.sqlite's `downloads` table. Confirms
    // the level1 evtx finding (the 4688 PowerShell exfil chain) from
    // an orthogonal artifact source. Doesn't gate the credential
    // chain; surfaces only when the player explicitly queries
    // `downloads`.
    bonusFinds: [
      {
        id:   "exfil-downloader-in-history",
        name: "PowerShell exfil downloader in downloads table",
        hint: "Reed's downloads table carries an entry for a PowerShell archive script pulled from a personal Dropbox link 9 days before the Bay 4 incident. Same `Compress-Archive -Path D:\\CUI\\Subsystem-A\\*` pattern level1's 4688 chain captured — but now sourced from a DIFFERENT artifact (browser-history-stored download record, not Security event log). When two independent artifact sources show the same behavior, the chain-of-custody narrative writes itself: this wasn't a one-off, this was rehearsed.",
        trigger: { command: "sqlite3", argMatches: /downloads/i, outputContains: "rc-archive-helper" },
      },
    ],

    filetypes: {
      "Reed/History.sqlite": "SQLite 3.x database",
      "Reed/Cookies.sqlite": "SQLite 3.x database",
    },

    // Pre-computed hashes for chain-of-custody verification. Player
    // can run `sha256sum Reed/History.sqlite` and confirm against
    // chain-of-custody.txt to demonstrate the artifact hasn't been
    // tampered with during analysis.
    fileHashes: {
      "Reed/History.sqlite": {
        sha256: "8c4f1d2e93b56a087c1f4a72d9e83c61a5f2b40e7c93a18d6f25b91e7d34a8c2",
      },
      "Reed/Cookies.sqlite": {
        sha256: "3a7d92f5b8e14c620d9f471a8e63b95c2d1e84f0a76b3e5c9d28f147b62a503e",
      },
    },

    sqlite_dbs: {
      "Reed/History.sqlite": {
        tables: {
          urls: {
            schema:
`CREATE TABLE urls(
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  url             LONGVARCHAR,
  title           LONGVARCHAR,
  visit_count     INTEGER DEFAULT 0 NOT NULL,
  typed_count     INTEGER DEFAULT 0 NOT NULL,
  last_visit_time INTEGER NOT NULL,
  hidden          INTEGER DEFAULT 0 NOT NULL
);`,
            columns: ["id", "url", "title", "visit_count", "typed_count", "last_visit_time", "hidden"],
            rows: [
              // Normal workplace browsing — context
              { id: 1, url: "https://intranet.polaris-ds.local/wiki/onboarding", title: "Onboarding | Polaris Intranet", visit_count: 12, typed_count: 0, last_visit_time: "2026-03-13 09:14:22", hidden: 0 },
              { id: 2, url: "https://intranet.polaris-ds.local/calendar", title: "Calendar | Polaris Intranet", visit_count: 87, typed_count: 0, last_visit_time: "2026-03-13 17:32:08", hidden: 0 },
              { id: 3, url: "https://teams.microsoft.com/", title: "Microsoft Teams", visit_count: 412, typed_count: 0, last_visit_time: "2026-03-13 17:58:41", hidden: 0 },
              { id: 4, url: "https://outlook.office.com/mail/", title: "Mail - Reed Connolly - Outlook", visit_count: 1832, typed_count: 1, last_visit_time: "2026-03-13 17:59:12", hidden: 0 },
              // Friday night browsing — non-work but unremarkable
              { id: 5, url: "https://www.espn.com/nba/", title: "NBA Scores - ESPN", visit_count: 23, typed_count: 0, last_visit_time: "2026-03-13 22:48:51", hidden: 0 },
              { id: 6, url: "https://www.reddit.com/r/PolarisFC/", title: "Polaris FC : Soccer Tournament Forum", visit_count: 8, typed_count: 0, last_visit_time: "2026-03-13 23:11:04", hidden: 0 },
              // SMOKING GUN — Saturday 02:47 personal webmail visit
              { id: 7, url: "https://mail.google.com/mail/u/0/", title: "Inbox (4) - rconnolly.personal@gmail.com", visit_count: 6, typed_count: 1, last_visit_time: "2026-03-14 02:47:21", hidden: 0 },
              { id: 8, url: "https://mail.google.com/mail/u/0/#sent", title: "Sent Mail - rconnolly.personal@gmail.com", visit_count: 3, typed_count: 0, last_visit_time: "2026-03-14 02:51:08", hidden: 0 },
              // Saturday morning escalation — searches showing intent
              { id: 9, url: "https://www.google.com/search?q=encryption+export+controls+EAR+penalties", title: "encryption export controls EAR penalties - Google Search", visit_count: 1, typed_count: 0, last_visit_time: "2026-03-14 03:12:55", hidden: 0 },
              { id: 10, url: "https://www.google.com/search?q=CUI+how+to+identify+if+a+document+is+marked", title: "CUI how to identify if a document is marked - Google Search", visit_count: 1, typed_count: 0, last_visit_time: "2026-03-14 03:14:38", hidden: 0 },
              // Dropbox download (parallel evidence to level1's 4688 chain)
              { id: 11, url: "https://www.dropbox.com/scl/fi/rc-archive-helper.ps1", title: "Dropbox - rc-archive-helper.ps1", visit_count: 2, typed_count: 0, last_visit_time: "2026-03-05 19:42:11", hidden: 0 },
              // Saturday post-badge-in — return to webmail
              { id: 12, url: "https://mail.google.com/mail/u/0/#drafts", title: "Drafts (1) - rconnolly.personal@gmail.com", visit_count: 4, typed_count: 0, last_visit_time: "2026-03-14 11:33:47", hidden: 0 },
              // Sunday — normal browsing resumed
              { id: 13, url: "https://www.weather.com/weather/today/", title: "Weather Today - The Weather Channel", visit_count: 41, typed_count: 0, last_visit_time: "2026-03-15 07:18:02", hidden: 0 },
              { id: 14, url: "https://www.amazon.com/orders", title: "Your Orders - Amazon.com", visit_count: 19, typed_count: 0, last_visit_time: "2026-03-15 14:22:33", hidden: 0 },
              { id: 15, url: "https://news.ycombinator.com/", title: "Hacker News", visit_count: 67, typed_count: 0, last_visit_time: "2026-03-15 20:45:18", hidden: 0 },
            ],
          },
          visits: {
            schema:
`CREATE TABLE visits(
  id          INTEGER PRIMARY KEY,
  url         INTEGER NOT NULL,    -- FK -> urls.id
  visit_time  INTEGER NOT NULL,
  from_visit  INTEGER,
  transition  INTEGER DEFAULT 0 NOT NULL,
  visit_duration INTEGER DEFAULT 0 NOT NULL
);`,
            columns: ["id", "url", "visit_time", "from_visit", "transition", "visit_duration"],
            rows: [
              { id: 101, url: 7,  visit_time: "2026-03-14 02:47:21", from_visit: null, transition: 1, visit_duration: 217 },
              { id: 102, url: 8,  visit_time: "2026-03-14 02:51:08", from_visit: 101,  transition: 0, visit_duration: 142 },
              { id: 103, url: 9,  visit_time: "2026-03-14 03:12:55", from_visit: null, transition: 1, visit_duration: 89  },
              { id: 104, url: 10, visit_time: "2026-03-14 03:14:38", from_visit: 103,  transition: 0, visit_duration: 124 },
              { id: 105, url: 12, visit_time: "2026-03-14 11:33:47", from_visit: null, transition: 1, visit_duration: 412 },
            ],
          },
          downloads: {
            schema:
`CREATE TABLE downloads(
  id              INTEGER PRIMARY KEY,
  target_path     LONGVARCHAR,
  url             LONGVARCHAR,
  start_time      INTEGER NOT NULL,
  end_time        INTEGER NOT NULL,
  received_bytes  INTEGER NOT NULL,
  total_bytes     INTEGER NOT NULL,
  state           INTEGER NOT NULL,
  danger_type     INTEGER NOT NULL DEFAULT 0,
  mime_type       VARCHAR(255) DEFAULT ""
);`,
            columns: ["id", "target_path", "url", "start_time", "end_time", "received_bytes", "total_bytes", "state", "danger_type", "mime_type"],
            rows: [
              { id: 201, target_path: "C:\\Users\\rconnolly\\Downloads\\rc-archive-helper.ps1", url: "https://www.dropbox.com/scl/fi/rc-archive-helper.ps1", start_time: "2026-03-05 19:42:11", end_time: "2026-03-05 19:42:14", received_bytes: 4218, total_bytes: 4218, state: 1, danger_type: 0, mime_type: "text/plain" },
              { id: 202, target_path: "C:\\Users\\rconnolly\\Downloads\\2026-Q1-team-budget.xlsx", url: "https://intranet.polaris-ds.local/finance/exports/2026-Q1-team-budget.xlsx", start_time: "2026-03-10 11:08:47", end_time: "2026-03-10 11:08:48", received_bytes: 89432, total_bytes: 89432, state: 1, danger_type: 0, mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
              { id: 203, target_path: "C:\\Users\\rconnolly\\Downloads\\daughter-soccer-schedule.pdf", url: "https://www.centrevillesportscomplex.com/schedules/U10-spring-2026.pdf", start_time: "2026-03-11 18:32:09", end_time: "2026-03-11 18:32:11", received_bytes: 234101, total_bytes: 234101, state: 1, danger_type: 0, mime_type: "application/pdf" },
            ],
          },
          keyword_search_terms: {
            schema:
`CREATE TABLE keyword_search_terms(
  keyword_id     INTEGER NOT NULL,
  url_id         INTEGER NOT NULL,
  term           LONGVARCHAR NOT NULL,
  normalized_term LONGVARCHAR NOT NULL
);`,
            columns: ["keyword_id", "url_id", "term", "normalized_term"],
            rows: [
              { keyword_id: 1, url_id: 9,  term: "encryption export controls EAR penalties", normalized_term: "encryption export controls ear penalties" },
              { keyword_id: 1, url_id: 10, term: "CUI how to identify if a document is marked", normalized_term: "cui how to identify if a document is marked" },
            ],
          },
        },
      },
      "Reed/Cookies.sqlite": {
        tables: {
          cookies: {
            schema:
`CREATE TABLE cookies(
  creation_utc     INTEGER NOT NULL,
  host_key         TEXT NOT NULL,
  name             TEXT NOT NULL,
  value            TEXT NOT NULL,
  path             TEXT NOT NULL,
  expires_utc      INTEGER NOT NULL,
  is_secure        INTEGER NOT NULL,
  is_httponly      INTEGER NOT NULL,
  last_access_utc  INTEGER NOT NULL,
  has_expires      INTEGER NOT NULL DEFAULT 1,
  is_persistent    INTEGER NOT NULL DEFAULT 1,
  priority         INTEGER NOT NULL DEFAULT 1,
  samesite         INTEGER NOT NULL DEFAULT -1
);`,
            columns: ["creation_utc", "host_key", "name", "value", "path", "expires_utc", "is_secure", "is_httponly", "last_access_utc"],
            rows: [
              // Workplace cookies — context
              { creation_utc: "2025-09-04 08:14:22", host_key: ".microsoft.com",      name: "MSAL_session",  value: "eyJhbGciOiJIUzI1NiJ9.workplace_redacted",                           path: "/", expires_utc: "2026-09-04 08:14:22", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-13 17:58:41" },
              { creation_utc: "2025-09-04 08:14:23", host_key: ".outlook.office.com", name: "OutlookSession", value: "AQA1234567890workplace",                                            path: "/", expires_utc: "2026-09-04 08:14:23", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-13 17:59:12" },
              { creation_utc: "2025-11-22 19:42:11", host_key: ".espn.com",           name: "ESPN_USER_ID",  value: "anon-7c4b-9f12-d843",                                              path: "/", expires_utc: "2027-11-22 19:42:11", is_secure: 0, is_httponly: 0, last_access_utc: "2026-03-13 22:48:51" },
              { creation_utc: "2025-12-08 10:33:55", host_key: ".reddit.com",         name: "reddit_session", value: "U2FsdGVkX19personalbrowser",                                       path: "/", expires_utc: "2026-12-08 10:33:55", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-13 23:11:04" },
              // SMOKING GUN — Reed's personal Gmail session
              { creation_utc: "2026-03-14 02:47:21", host_key: "mail.google.com",     name: "SID",           value: "RC-Gmail-PreDawn-2026-03-14-T0247Z",                                path: "/", expires_utc: "2026-09-14 02:47:21", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-14 11:33:47" },
              { creation_utc: "2026-03-14 02:47:21", host_key: ".google.com",         name: "HSID",          value: "AeQ8mP4_personalGmailHelperToken",                                   path: "/", expires_utc: "2026-09-14 02:47:21", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-14 11:33:47" },
              { creation_utc: "2025-08-30 12:05:43", host_key: ".amazon.com",         name: "session-token", value: "amazon_personal_session_truncated",                                 path: "/", expires_utc: "2026-08-30 12:05:43", is_secure: 1, is_httponly: 1, last_access_utc: "2026-03-15 14:22:33" },
              { creation_utc: "2025-06-12 09:14:22", host_key: ".weather.com",        name: "wxlocation",    value: "us:VA:Centreville:20121",                                          path: "/", expires_utc: "2027-06-12 09:14:22", is_secure: 0, is_httponly: 0, last_access_utc: "2026-03-15 07:18:02" },
            ],
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
`─── Driftwood Systems / Polaris IR Forensic Bench ─────────────
  Host:    polaris-ir-bench.evidence.polaris.local
  Acct:    ir-audit (Polaris IR service account)
  Image:   Reed Connolly workstation E01 set, mounted read-only
  Date:    Monday 2026-03-23 (case day three)
────────────────────────────────────────────────────────────

─── NEW COMMANDS ──────────────────────────────────────────────

  sqlite3 — read-only SQLite query interface

      sqlite3 <file> ".tables"
      sqlite3 <file> ".schema [<table>]"
      sqlite3 <file> "SELECT ... FROM <table> ..."
      sqlite3 -header <file> "..."   # include column names
      sqlite3 -column <file> "..."   # render as aligned table

  Try \`sqlite3 --help\` for the full grammar, or \`man sqlite3\`
  for a deeper reference including supported WHERE expressions
  and the COUNT(*) / DISTINCT / LIKE forms.

─── WHAT SQLITE IS ────────────────────────────────────────────

SQLite is the most-deployed database in the world. It ships
inside every browser, every iOS / Android app, every mail
client, every desktop tool that needs to store local state.
Each .sqlite file is a complete database — no daemon, no
network listener, no auth layer. Just a file that holds tables
of rows.

For forensics, that means: whenever an investigation asks
"what did this user do on this machine," there is almost
always a SQLite database holding the answer. Browser history,
cookies, autofill, downloads, mail-client offline caches,
chat-app message histories — all SQLite.

Chromium-family browsers (Chrome, Edge, Brave, Opera) keep
their per-profile state in files like \`History\`, \`Cookies\`,
\`Login Data\`, \`Web Data\`, \`Bookmarks\`. The \`History\`
file (called History.sqlite in this engine for clarity) holds
four tables that matter for incident reconstruction:

  urls                  Every URL ever visited
                        (id, url, title, visit_count, last_visit_time)
  visits                One row per navigation event
                        (id, url FK, visit_time, from_visit, transition)
  downloads             One row per file downloaded
                        (id, target_path, url, start_time, mime_type)
  keyword_search_terms  Search box queries
                        (keyword_id, url_id, term)

The \`Cookies\` file (Cookies.sqlite here) holds a single
table — \`cookies\` — keyed by host_key. Each row is one
cookie: its host, name, value, expiration, secure/httponly
flags, last-access timestamp. A live cookie row with a
non-expired session value is the same as having the user's
session on that site (subject, of course, to legal
authorization, which Sgt. Chen and Dana have explicitly
granted for this case).

─── HOW TO PLAY ───────────────────────────────────────────────

  1. ls                              See the working directory
  2. cat welcome.md                  Re-read this if needed
  3. cat case-notes.md               Sgt. Chen's brief for today
  4. cat chain-of-custody.txt        Hash baseline before you query
  5. sha256sum Reed/History.sqlite   Confirm the artifact's hash
  6. sqlite3 Reed/History.sqlite ".tables"
  7. sqlite3 -header Reed/History.sqlite "SELECT ... FROM urls ..."
  8. Follow Reed's Saturday-morning activity through urls + visits
  9. Pivot to Cookies.sqlite when you find the webmail host
 10. cat lessons-learned.md          Once you've found the session token
 11. ssh guest@d3cyph3r              Return to the lobby

If you get stuck, type \`hint\` for a graduated nudge or
\`man sqlite3\` for the full command reference. The walkthrough
subsite (when shipped) carries the spoiler-rich solve path.`
        },

        "case-notes.md": {
          type: "file",
          content:
`POLARIS DEFENSE SYSTEMS — INTERNAL INVESTIGATION CASE NOTES
Case ID:           POL-IIS-2026-0007
Status:            ACTIVE — formal investigation (day three)
Opened by:         Dana Reyes (in-house counsel)
Case lead:         Sgt. Chen (FSO)
IR-team lead:      Maya Voss
Driftwood ref:     DW-FORENSICS-POL-2026-014

DAY THREE TASKING
─────────────────────────────────────────────────────────────
  Friday closed clean. The day-two evtx pass surfaced two
  findings:

    (a) Reed Connolly's 09:42-11:18 Bay 4 activity captured
        in Security event log: a Compress-Archive PowerShell
        chain producing C:\\Users\\rconnolly\\AppData\\Local\\
        Temp\\sa-export.zip from D:\\CUI\\Subsystem-A\\*.

    (b) A 4625 failed-logon record from the Tuesday-night IR
        acquisition where Maya Voss typed her account password
        into the username field of a network-auth prompt. Her
        primary account was rotated Friday afternoon; same-day
        notification went to Larry Hutchins (Polaris CISO).

  Today's narrower task: examine the browser-artifact databases
  recovered from Reed's user profile. The E01 image mount-point
  copied them to this bench at \`Reed/\` (paths preserved for
  audit). Sgt. Chen has not articulated a hypothesis; the
  reasonable read is that the 02:47 personal-webmail visit
  Maya noticed during her own initial pass deserves a closer
  look, but interpret the data as it shows.

SCOPE — what we're being asked to do
─────────────────────────────────────────────────────────────
  • Query History.sqlite for Reed's online activity in the
    24-hour window before the 09:42 Bay 4 badge-in.
  • Query Cookies.sqlite for any live session tokens on
    personal (i.e. non-Polaris-domain) sites that overlap
    with that window.
  • If you find a Gmail session token, extract its value.
    Outside counsel will use it for level3's analysis of
    Reed's Sent folder (subject to subpoena to Google, which
    Dana has already filed — the session token expedites the
    review).

SCOPE — what we're NOT being asked to do
─────────────────────────────────────────────────────────────
  • Don't read the message content. The session token is the
    deliverable; reading Reed's mail inside this analysis
    bench would violate scope and contaminate the evidence
    chain. That's level3's job under a different authorization.
  • Don't write to the .sqlite files. They're mounted read-
    only on the analysis volume, but the sqlite3 command shells
    used today are read-only by design as well (no
    INSERT/UPDATE/DELETE support).

CONSTRAINTS
─────────────────────────────────────────────────────────────
  • Hash before and after. Run \`sha256sum\` against each
    .sqlite file before your first query and after your last.
    The hash on chain-of-custody.txt is the day-three baseline.
  • Log queries. Maya wants the exact SELECT statements you
    ran in the deliverable (so the procedure can be re-run
    under outside-counsel oversight if challenged).
  • Don't pivot to any other artifact source today. If the
    queries surface something interesting beyond webmail —
    say, a download record showing pre-meditation — flag it
    in the lessons-learned but don't open it. Day four is
    when scope expands.

— Maya Voss
  Polaris IR Lead`
        },

        "chain-of-custody.txt": {
          type: "file",
          content:
`POL-IIS-2026-0007 — CHAIN OF CUSTODY (DAY THREE BASELINE)
─────────────────────────────────────────────────────────────

Artifacts extracted from Reed Connolly workstation E01 image
(POL-WS-0418, acquired Tuesday 2026-03-17 19:42 EDT, hash
preserved per case-summary.txt). The following user-profile
files were copied to this analysis bench, read-only:

  Reed/History.sqlite
    sha256: 8c4f1d2e93b56a087c1f4a72d9e83c61a5f2b40e7c93a18d6f25b91e7d34a8c2
    size:   ~720KB
    source: \\Users\\rconnolly\\AppData\\Local\\Google\\Chrome\\
            User Data\\Default\\History

  Reed/Cookies.sqlite
    sha256: 3a7d92f5b8e14c620d9f471a8e63b95c2d1e84f0a76b3e5c9d28f147b62a503e
    size:   ~340KB
    source: \\Users\\rconnolly\\AppData\\Local\\Google\\Chrome\\
            User Data\\Default\\Network\\Cookies

Procedure for today's analyst (you):

  1. Confirm the hash above matches \`sha256sum Reed/History.sqlite\`.
  2. Run queries via \`sqlite3\`.
  3. Confirm the hash hasn't changed after your last query.
  4. Document the queries in lessons-learned.md or in the
     deliverable.

If the hash diverges at step 3, STOP and notify Sgt. Chen.
The analysis bench is configured read-only, so divergence
would indicate a tooling fault that needs investigation
before the case can rely on the queries you ran.

— Maya Voss, 2026-03-23`
        },

        "Reed": {
          type: "dir",
          children: {
            "History.sqlite": {
              type: "file",
              // Binary-looking placeholder — players inspect this
              // file via the `sqlite3` command, not via `cat` /
              // `strings`. The actual queryable data lives in
              // level.sqlite_dbs above.
              content: "SQLite format 3\x00\x10\x00\x01\x01\x00@  \x00\x00\x00\x03[binary]"
            },
            "Cookies.sqlite": {
              type: "file",
              content: "SQLite format 3\x00\x10\x00\x01\x01\x00@  \x00\x00\x00\x02[binary]"
            },
          },
        },

        "lessons-learned.md": {
          type: "file",
          content:
`═══ POST-MORTEM: SQLITE IS THE USER-ACTIVITY LEDGER ═══

─── THE BLUNT VERSION ────────────────────────────────────────

Reed Connolly accessed personal Gmail at 02:47 Saturday
morning, seven hours before the 09:42 Bay 4 badge-in. He
searched for "encryption export controls EAR penalties" and
"CUI how to identify if a document is marked" between
03:12 and 03:14. He downloaded a PowerShell archive
script from his personal Dropbox account nine days earlier
(2026-03-05 19:42), which the Cookies/History pair confirms
he physically downloaded to his workstation — not just
visited. The 4688 Compress-Archive chain level1's evtx
finding captured on Saturday morning is rehearsed behavior.

The smoking-gun artifact is the Gmail SID cookie row in
Cookies.sqlite (RC-Gmail-PreDawn-2026-03-14-T0247Z). Outside
counsel will use that session token to subpoena Google for
Reed's Sent-folder content under day-four authorization.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Browser-database forensics is a quietly massive lever for
internal-investigation work. The discipline at consulting
shops looks like this:

  1. ALWAYS hash before you query. The sqlite3 command is
     read-only in this engine but a real \`sqlite3 file.db\`
     CLI can write — the analyst's chain-of-custody rigor
     comes from never assuming the tool is safe. Compute
     the SHA-256, write it to the case file, query, compute
     again, confirm equality.

  2. Run queries you can reproduce. Outside counsel may
     re-run them under subpoena pressure six months later.
     The deliverable lists the exact SELECT statements.

  3. Don't read content unless authorized. Reed's webmail
     INBOX content is out of scope today; the session token
     IS in scope because counsel has a Google subpoena in
     flight. Saying "out of scope" and meaning it
     distinguishes the firm.

  4. When two artifacts agree, the case writes itself. The
     level1 4688 Compress-Archive chain and the level2
     downloads-table rc-archive-helper.ps1 row are
     independent artifacts pointing at the same behavior.
     One could be coincidence; both is rehearsal.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-539 — Use of Persistent Cookies Containing Sensitive
    Information. The session token you recovered is still
    valid in a database on disk, long after Reed would say
    he had "logged out." Persistence is the defender's gift
    here and the attacker's on any machine they reach; the
    same artifact that makes this investigation possible is
    what makes a stolen browser profile worth stealing.

  CWE-200 — Exposure of Sensitive Information to an
    Unauthorized Actor. The browser profile stores
    authentication material in a location readable by
    anything running as that user. Full-disk encryption
    protects it at rest and nothing protects it once the
    session is unlocked.

  NIST SP 800-86 — Guide to Integrating Forensic Techniques
    into Incident Response. Browser artifacts are listed as
    one of the canonical endpoint-forensics data sources
    (alongside file-system metadata, memory, network
    artifacts, and event logs). §3.3 on Examining Data lays
    out the "preserve original, work on a copy, document
    each step" workflow this case follows.

  NIST SP 800-171 Rev. 3 — 3.3.1 (System Audit Records).
    The browser History database meets the spirit of "create
    and retain system audit records sufficient to monitor,
    analyze, investigate, and report unlawful or unauthorized
    system activity." Chrome's per-profile retention is
    indefinite by default; clearing browsing data doesn't
    fully wipe (WAL journal pages persist until vacuum).

  CMMC Level 2 — AU.L2-3.3.x audit-record family. Polaris is
    expected to retain audit records that include user-level
    activity sufficient to support a forensic investigation
    like this one. Browser artifacts qualify.

  Insider Threat Program — DoD 5205.16. CUI handling
    obligations (DoDM 5200.48) interact with NISPOM (32 CFR
    Part 117) for cleared facilities like Polaris. The
    investigation is authorized; the artifact-handling
    discipline above is what makes the authorization stand
    up to challenge.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  GCFE (GIAC Certified Forensic Examiner) — browser-artifact
    forensics is a major domain. The exam's Chrome / Firefox
    history-database modules cover exactly the queries you
    just ran.

  GCFA (GIAC Certified Forensic Analyst) — broader endpoint
    forensics; browser artifacts as one of ~12 data sources.

  CHFI (Computer Hacking Forensic Investigator) — vendor-
    neutral forensic-process cert; lists browser DBs in its
    artifact-collection domain.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1119 — Automated Collection. Reed's rc-archive-helper.ps1
    is a textbook example of a custom collector pre-staged
    on a workstation. The 2026-03-05 Dropbox download is
    when the tooling landed; the 2026-03-14 Bay 4 invocation
    is when it ran.

  T1567 — Exfiltration Over Web Service. Personal webmail
    (Gmail in this case) is the most common single web
    service used for low-volume CUI exfiltration. The 02:47
    session opening pre-positions the channel; the 11:33
    drafts-folder visit is plausibly the staging or send
    moment.

  T1083 — File and Directory Discovery (defender side). The
    "CUI how to identify if a document is marked" Google
    search is the defender's window into Reed's level of
    awareness about what he was about to handle.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  Browser-policy enforcement. Polaris's Chrome Enterprise
    policy could block personal-Gmail sign-in on managed
    devices (\`RestrictSigninToPattern\`), or block consumer
    cloud-storage hosts (\`URLBlocklist\` entries for
    dropbox.com, drive.google.com personal accounts).
    Today's case is investigated; tomorrow's case is
    prevented.

  DLP on file-staging. The Temp\\sa-export.zip path Reed used
    is a known staging spot for archive-then-exfil. Endpoint
    DLP rules on \`%TEMP%\\*.zip\` near \`D:\\CUI\\*\` reads
    fire on this pattern within minutes of the Compress-
    Archive call.

  Periodic Chrome-profile retention review. Many enterprises
    don't realize their endpoint policy doesn't reset Chrome
    histories on logoff, so every workstation accumulates a
    multi-year activity ledger. For cleared facilities this
    is a feature (forensics); for non-cleared environments
    it's a privacy posture decision.

  IR-team password discipline. The awkward note about the
    \`ir-audit\` service account password pattern matching
    Maya's primary account credential — that's a finding.
    Service-account passwords should not pattern-match
    individual user credentials. Maya's already on this; the
    finding goes in the day-three deliverable explicitly
    rather than getting filed quietly.

─── CLOSING THOUGHT ──────────────────────────────────────────

The investigative lever browser forensics gives you is
asymmetric. A motivated suspect can scrub the obvious — clear
browsing data, log out of personal accounts, close suspicious
tabs. But the SQLite databases that back those features keep
artifacts in WAL journal pages, in cookie last_access
timestamps, in download target_path strings that survive
even when the source URL is forgotten. The Chromium project
docs the underlying schema publicly; the forensic community
documents the artifacts that persist past "Clear data" clicks.

Reed knew he was being investigated; the 03:14 search for
"CUI how to identify if a document is marked" tells you he
was aware enough to be concerned. He didn't clear his
history. He didn't sign out of Gmail. The asymmetry favored
the defender on this case.

Driftwood's banking client Halton had a different version of
the same pattern last year: a departing consultant's
laptop got reimaged before its Chrome profile was preserved.
A subsequent contract-breach allegation would have been
much easier to defend if those artifacts had survived to
investigation time. Different lesson, same root cause —
artifact-preservation discipline is what makes
investigation discipline possible.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

  // ── level3@forensics — "What Reed's mail proved" ─────────────────
  // Gate: RC-Gmail-PreDawn-2026-03-14-T0247Z — the Gmail SID cookie
  // recovered from Reed's seized Cookies.sqlite in level2. In-world
  // that cookie is not used to log in (that would be unlawful); it is
  // the ACCESS MECHANISM named in the preservation letter and 2703(d)
  // order served on Google, and this level opens on what Google
  // produced in response.
  //
  // NEW CONCEPT: email header forensics. Specifically that the From:
  // header is free text a sender can type anything into, while the
  // Received: chain is appended by each server the message passes
  // through AFTER it leaves the sender's control — so the two can be
  // put in opposition, and the chain wins.
  //
  // Solve path:
  //   1. `cat subpoena-return.txt` — what Google produced, and the
  //      note that all timestamps were normalized to US/Eastern.
  //   2. `ls mail/` — three messages.
  //   3. `cat mail/01-authorization-claimed.eml` — Reed's defense
  //      exhibit: Hutchins "authorizing" him to take the drive home.
  //   4. `cat mail/02-hutchins-genuine-2026-02-11.eml` — a real
  //      Hutchins message, as the known-good baseline to compare
  //      against. THIS is the analyst move the level teaches.
  //   5. The comparison collapses the defense: on 01, spf=fail,
  //      dkim=none, dmarc=fail, Return-Path is Reed's own Gmail, the
  //      Message-ID is @mail.gmail.com rather than corporate, and the
  //      Received chain says Sat 14 Mar 02:51 while the Date: header
  //      claims Thu 12 Mar 16:04. On 02, everything passes.
  //   6. `cat mail/03-outbound-0253.eml` — two minutes after forging
  //      his cover story, Reed sent the actual payload out. The
  //      file-drop passphrase in that message is the level4 gate.
  //
  // Engine: NO new command. Headers are plain text; `cat` and `grep`
  // are the whole toolchain, which is exactly how this is done for
  // real when a parser isn't handy. (v2.3.0 did add -i/-v/-n/-c to
  // grep, because `grep -n received` is the natural way to walk a
  // chain and the flags previously parsed as the search pattern.)
  //
  // READ THE CHAIN BOTTOM-UP. Each hop PREPENDS its Received: line,
  // so the oldest hop is at the bottom and the newest at the top.
  // Players consistently read it top-down and reach the wrong origin;
  // welcome.md and the walkthrough both call this out explicitly.
  //
  // Lessons: CWE-290 (Authentication Bypass by Spoofing) as the
  // mechanism, plus the evidentiary angle — a fabricated exculpatory
  // artifact is itself evidence, and obstruction is a separate
  // offense from the underlying exfiltration. SPF (RFC 7208), DKIM
  // (RFC 6376), DMARC (RFC 7489). MITRE T1534 (Internal Spearphishing)
  // and T1114 (Email Collection) as the adjacent adversary behaviors;
  // Polaris is CMMC / NIST SP 800-171 scoped.
  //
  // Two bonus finds (don't gate the chain):
  //   - "The envelope disagrees with the letterhead" — Return-Path vs
  //     From:, the single fastest spoof tell.
  //   - "You compared against a known-good" — awarded for reading the
  //     genuine Hutchins message, because comparison IS the skill.
  //
  // Breadcrumb out: RC-FileDrop-2026-03-14-T0253Z — the file-drop
  // passphrase in Reed's outbound message, gating a future
  // level4@forensics.
  "level3@forensics": {
    password: "RC-Gmail-PreDawn-2026-03-14-T0247Z",
    track: "forensics",
    title: "What Reed's mail proved (headers)",
    estimatedMinutes: 18,
    playerUser: "ir-audit",
    objective: "Examine the mail Google produced under the 2703(d) order and determine whether the authorization Reed Connolly's counsel is relying on is genuine — then document what he actually sent, and to whom.",
    lesson: "Day four of the Reed case. The session cookie you pulled out of Cookies.sqlite told Sgt. Chen which account to name in the preservation letter, and Google's production came back overnight. Reed's counsel has meanwhile produced an email they say authorizes everything: Larry Hutchins telling Reed to take the drive home. Maya Voss wants that email checked before Polaris concedes anything. Read welcome.md first — it covers how to read a Received: chain, which is the one skill today needs. Compare the disputed message against a real one from Hutchins. Then read what Reed sent at 02:53.",
    hints: [
      "Start with `cat subpoena-return.txt` for what Google produced, then `ls mail/`. Read the disputed message first: `cat mail/01-authorization-claimed.eml`.",
      "Don't try to judge it in isolation — you need a known-good. `cat mail/02-hutchins-genuine-2026-02-11.eml` is a real message from the same person. Put the two side by side and compare the Authentication-Results, the Return-Path, and the Message-ID domain.",
      "The Received: chain is added by the servers, not the sender — read it BOTTOM-UP. On the disputed message it says Sat 14 Mar 02:51 while the Date: header claims Thu 12 Mar. Then `cat mail/03-outbound-0253.eml`: the file-drop passphrase in the body is your level4 credential.",
    ],

    crossTrackHooks: ["osint"],

    bonusFinds: [
      {
        id:   "envelope-vs-letterhead",
        name: "The envelope disagrees with the letterhead",
        hint: "On the disputed message the Return-Path is reed.connolly@gmail.com while the From: header claims l.hutchins@polaris-defense.com. Return-Path records the SMTP envelope sender — what the sending server actually declared — and From: is display text the composer types. When they disagree, the envelope is the one that had to be true for delivery to work. It is the single fastest spoof tell in a header block, and it costs one line of reading.",
        trigger: { command: "cat", argMatches: /01-authorization-claimed/, outputContains: "Return-Path: <reed.connolly@gmail.com>" },
      },
      {
        id:   "known-good-baseline",
        name: "You compared against a known-good",
        hint: "Reading the genuine Hutchins message is the move that turns an opinion into a finding. On its own, 'spf=fail' invites an argument about misconfigured relays. Next to a real message from the same sender showing dkim=pass, spf=pass, dmarc=pass, a corporate Message-ID and a polaris-defense.com relay in the chain, the disputed message has no innocent explanation left. Always pull a known-good sample from the same claimed sender before you call anything forged.",
        trigger: { command: "cat", argMatches: /02-hutchins-genuine/, outputContains: "dkim=pass" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Polaris Defense Systems — IR Forensic Bench ───────────────
  Case:    POL-IIS-2026-0007 (Connolly)
  Acct:    ir-audit (Polaris IR service account)
  Date:    Tuesday 2026-03-17 (case day four)
────────────────────────────────────────────────────────────

Maya Voss (Polaris IR lead): "The cookie you recovered from
Reed's browser profile gave Sgt. Chen the account to name in
the preservation letter. Google's production came back
overnight and it's on the bench.

Here's what changed while you slept. Reed's counsel produced an
email they say authorizes all of it — Larry Hutchins telling
Reed to take the drive home over the weekend. Larry says he
never wrote it. Before Polaris concedes a thing, I need that
message examined properly. Google's production includes what
was actually in Reed's mailbox, so we can check the claim
against the record."

You are \`ir-audit\` on the Polaris IR bench. Run \`id\` and
\`whoami\` to confirm.

─── NO NEW COMMANDS TODAY ─────────────────────────────────────

Email headers are plain text. Everything today is \`cat\` and
\`grep\`, which is also how it's done for real when you don't
have a parser handy. Two flags help:

  grep -n received mail/01-authorization-claimed.eml
        -n numbers the lines, so you can see the ORDER of the
        hops rather than just their content.

  grep -c received mail/01-authorization-claimed.eml
        -c counts them. How many servers touched this?

─── HOW TO READ AN EMAIL HEADER ───────────────────────────────

A message is headers, one blank line, then the body. The
headers a sender controls and the headers servers add are two
completely different categories of evidence, and the whole
discipline is knowing which is which.

WHAT THE SENDER TYPES (trivially forgeable — it is just text):

  From:      Display name and address. Anyone can put anything
             here. It is the letterhead, not the postmark.
  Subject:   Free text.
  Date:      The composing client's claim about when it was
             written. Also just text.

WHAT THE SERVERS ADD (much harder to fake):

  Received:  Every server that handles the message PREPENDS one
             of these. They accumulate as the message travels.
  Return-Path:  The SMTP envelope sender — the address the
             sending server actually declared during delivery.
             Delivery had to work, so this had to be real.
  Authentication-Results:  The receiving server's verdict on
             SPF, DKIM and DMARC. Written by the recipient's
             own infrastructure.
  Message-ID:  Assigned by the system that first accepted the
             message. Its domain tells you which system that was.

─── READ THE CHAIN BOTTOM-UP ──────────────────────────────────

This is the part everyone gets backwards the first time.

Because each hop PREPENDS its line, the chain is in reverse
chronological order. The BOTTOM Received: is the FIRST hop —
where the message entered the mail system. The TOP one is the
last server before delivery.

So when you want to know where a message really came from, you
read to the bottom of the Received: block. Read it top-down and
you'll confidently identify the recipient's own mail server as
the origin, which is how people talk themselves into the wrong
answer.

─── THE THREE AUTHENTICATION CHECKS ───────────────────────────

  SPF    "Is this server allowed to send for this domain?"
         The domain publishes a DNS record listing its
         legitimate senders. Checks the ENVELOPE sender.

  DKIM   "Was this message signed by the domain, and is it
         unmodified?" A cryptographic signature verified
         against a public key in DNS. dkim=none means there
         was no signature at all to check.

  DMARC  "Do SPF/DKIM line up with the From: header the human
         actually sees, and what should I do if not?" This is
         the check that ties the other two to the visible
         From:, which is why it matters here.

All three verdicts are recorded in Authentication-Results by
the receiving server — for Reed's Gmail account, that's Google.

A failure is not automatically fraud; misconfigured relays and
forwarded mail produce failures constantly. That is precisely
why you compare against a known-good message from the same
sender before drawing a conclusion.

─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat welcome.md              You're already here.
  2.  cat subpoena-return.txt     What Google produced, and why
                                  the timestamps look the way
                                  they do.
  3.  ls mail/                    Three messages.
  4.  cat mail/01-authorization-claimed.eml
                                  The disputed exhibit.
  5.  cat mail/02-hutchins-genuine-2026-02-11.eml
                                  A REAL message from Hutchins.
                                  Compare them. This is the job.
  6.  cat mail/03-outbound-0253.eml
                                  What Reed sent two minutes
                                  after the disputed message is
                                  stamped. The passphrase in the
                                  body is your level4 credential.
  7.  cat lessons-learned.md      Post-mortem (after step 6).
  8.  exit                         Return to the lobby.

Useful while you work:

  grep -n received mail/01-authorization-claimed.eml
  grep -n received mail/02-hutchins-genuine-2026-02-11.eml
  grep dmarc mail/01-authorization-claimed.eml
`
        },

        ".bash_history": {
          type: "file",
          content:
`id
ls
cat subpoena-return.txt
ls mail/
exit
`
        },

        "subpoena-return.txt": {
          type: "file",
          content:
`POLARIS DEFENSE SYSTEMS — INCIDENT RESPONSE
Evidence intake record — case POL-IIS-2026-0007 (Connolly)

ITEM:      POL-0007-E14
RECEIVED:  2026-03-17 06:12 (US/Eastern)
FROM:      Google LLC, Legal Investigations Support
VIA:       Sgt. A. Chen, Polaris FSO (chain of custody attached
           to the physical case file)

LEGAL BASIS
  Preservation request under 18 U.S.C. 2703(f) served
  2026-03-15. Production compelled by court order under
  18 U.S.C. 2703(d), signed 2026-03-16.

  The account was identified from the authenticated session
  artifact recovered from the seized workstation image
  (item POL-0007-E09, Chromium Cookies database). The artifact
  was used to IDENTIFY the account for legal process. It was
  not used to access the account. Investigator access to the
  account contents is by production only.

SCOPE OF PRODUCTION
  Mailbox contents for the account reed.connolly@gmail.com
  covering 2026-02-01 through 2026-03-15, limited to messages
  sent or received between 2026-03-13 18:00 and 2026-03-14
  12:00, plus any earlier message from the domain
  polaris-defense.com retained in the account.

  Three messages responsive. Full headers included as
  produced — headers are the point of this request.

TIMESTAMP NORMALIZATION
  All timestamps in this production have been normalized to
  US/Eastern per the production request, so they can be read
  directly against the Polaris badge and VPN logs already in
  evidence. Note that February messages are EST (UTC-05:00)
  and March messages are EDT (UTC-04:00); the offset shown on
  each line is authoritative.

INTEGRITY
  SHA-256 of the production archive, as provided by Google and
  as recomputed on receipt (values match):
    9f2c41ab7d8e05c3b6a19f4d2e7c8051b3ad6e9f4c2b7180d5a3e6c9b8f4712a

RELATED TIMELINE ALREADY IN EVIDENCE
  2026-03-14 02:47  authenticated session established
                    (item POL-0007-E09)
  2026-03-14 09:42  badge-in, Bay 4 (item POL-0007-E02)
`
        },

        "mail": {
          type: "dir",
          children: {

            // THE DISPUTED EXHIBIT. Every forgery tell lives here:
            // envelope/header mismatch, spf=fail + dkim=none +
            // dmarc=fail, a consumer Message-ID domain, and a Date:
            // header that contradicts the server-stamped chain.
            "01-authorization-claimed.eml": {
              type: "file",
              content:
`Delivered-To: reed.connolly@gmail.com
Received: by 2002:a05:6512:3b8a:b0:519:e6a2:1f3c with SMTP id
        g10csp991204lfv; Sat, 14 Mar 2026 02:51:09 -0400 (EDT)
Return-Path: <reed.connolly@gmail.com>
Received: from mail-qk1-f180.google.com (mail-qk1-f180.google.com.
        [209.85.222.180]) by mx.google.com with ESMTPS id
        s7-20020a17090a2f8700b002a1c4d81e3fmr9182233pjd.4;
        Sat, 14 Mar 2026 02:51:08 -0400 (EDT)
Received: from [100.64.18.203] ([100.64.18.203])
        by smtp.gmail.com with ESMTPSA id
        k4-20020a170902c40400b001a3f2e91d77sm2214417plk.88;
        Sat, 14 Mar 2026 02:51:06 -0400 (EDT)
Received-SPF: fail (google.com: domain of l.hutchins@polaris-defense.com
        does not designate 209.85.222.180 as permitted sender)
        client-ip=209.85.222.180;
Authentication-Results: mx.google.com;
        dkim=none;
        spf=fail (google.com: domain of l.hutchins@polaris-defense.com
          does not designate 209.85.222.180 as permitted sender)
          smtp.mailfrom=reed.connolly@gmail.com;
        dmarc=fail (p=REJECT sp=REJECT dis=NONE)
          header.from=polaris-defense.com
Message-ID: <CAJ8v2mQ7kR4_pW3nT9xZ2bH6cLdE8fY1gM0sV5uK@mail.gmail.com>
Date: Thu, 12 Mar 2026 16:04:22 -0400
Subject: Re: taking the drive home this weekend
From: "Hutchins, Larry" <l.hutchins@polaris-defense.com>
To: reed.connolly@gmail.com
Content-Type: text/plain; charset="UTF-8"

Reed,

Following up on our conversation. You're cleared to take the
project drive home this weekend to finish the integration
notes. I'll square it with the FSO on Monday, don't worry
about the paperwork.

Appreciate you pushing on this.

Larry Hutchins
Director, Programs
Polaris Defense Systems
`
            },

            // THE KNOWN-GOOD BASELINE. Same claimed sender, and
            // everything the disputed message fails, this one passes.
            // Its existence is what converts "looks odd" into a
            // defensible finding.
            "02-hutchins-genuine-2026-02-11.eml": {
              type: "file",
              content:
`Delivered-To: reed.connolly@gmail.com
Received: by 2002:a05:6512:3b8a:b0:519:e6a2:1f3c with SMTP id
        g10csp284471lfv; Wed, 11 Feb 2026 17:22:44 -0500 (EST)
Return-Path: <l.hutchins@polaris-defense.com>
Received: from mx04.polaris-defense.com (mx04.polaris-defense.com.
        [198.51.100.24]) by mx.google.com with ESMTPS id
        b12-20020a656ccc0000b005637f1a2e44mr7712009pgw.9
        (version=TLS1_3 cipher=TLS_AES_256_GCM_SHA384);
        Wed, 11 Feb 2026 17:22:43 -0500 (EST)
Received: from EXCH07.corp.polaris-defense.com (10.30.4.17)
        by mx04.polaris-defense.com (198.51.100.24) with
        Microsoft SMTP Server id 15.2.1544.4;
        Wed, 11 Feb 2026 17:22:41 -0500 (EST)
Received-SPF: pass (google.com: domain of l.hutchins@polaris-defense.com
        designates 198.51.100.24 as permitted sender)
        client-ip=198.51.100.24;
Authentication-Results: mx.google.com;
        dkim=pass header.i=@polaris-defense.com header.s=pds2024;
        spf=pass (google.com: domain of l.hutchins@polaris-defense.com
          designates 198.51.100.24 as permitted sender)
          smtp.mailfrom=l.hutchins@polaris-defense.com;
        dmarc=pass (p=REJECT sp=REJECT dis=NONE)
          header.from=polaris-defense.com
DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed;
        d=polaris-defense.com; s=pds2024; t=1770848561;
        h=from:to:subject:date:message-id;
        bh=8Kq2mV9xR4tW7nZ1cL6dY0fH3gJ5sB8uP2eA4kQ7iM=;
        b=Rj7mQ2vK9xT4nW8pL3cZ6dH1fY5gB0sV
Message-ID: <a4f21e08-3c7b-4d19-9f22-1b8e4c7d0a63@polaris-defense.com>
Date: Wed, 11 Feb 2026 17:22:38 -0500
Subject: Re: Friday all-hands slides
From: "Hutchins, Larry" <l.hutchins@polaris-defense.com>
To: reed.connolly@gmail.com
Content-Type: text/plain; charset="UTF-8"

Reed — slides look good. Trim the third section and we're set
for Friday.

One note: please stop sending work material to your personal
address. Use the Polaris account. I know the VPN is painful
from home; raise it with IT rather than routing around it.

Larry Hutchins
Director, Programs
Polaris Defense Systems
`
            },

            // THE ACTUAL EXFILTRATION, two minutes after the cover
            // story. Carries the level4 breadcrumb.
            "03-outbound-0253.eml": {
              type: "file",
              content:
`Return-Path: <reed.connolly@gmail.com>
Received: from [100.64.18.203] ([100.64.18.203])
        by smtp.gmail.com with ESMTPSA id
        p9-20020a63d4090000b005637a1c8e22mr4410872pgh.31;
        Sat, 14 Mar 2026 02:53:44 -0400 (EDT)
Authentication-Results: mx.google.com;
        dkim=pass header.i=@gmail.com header.s=20230601;
        spf=pass (google.com: domain of reed.connolly@gmail.com
          designates 209.85.222.180 as permitted sender)
          smtp.mailfrom=reed.connolly@gmail.com;
        dmarc=pass (p=NONE sp=QUARANTINE dis=NONE)
          header.from=gmail.com
Message-ID: <CAJ8v2mR9tY6_qX4mU1wV7cJ3dK5nP8sB2aL0eG@mail.gmail.com>
Date: Sat, 14 Mar 2026 02:53:41 -0400
Subject: files
From: Reed Connolly <reed.connolly@gmail.com>
To: m.arroyo@ridgeline-consulting.net
Content-Type: text/plain; charset="UTF-8"

Marco,

Uploaded. It's the full integration set plus the test
harness — everything we talked about Thursday.

  https://filedrop.example.net/d/8f21c40e
  passphrase: RC-FileDrop-2026-03-14-T0253Z

Link is good for 14 days. Don't forward it, download it and
let me know when it's off the service.

I've got cover on my end for having the drive, so the timing
shouldn't look strange if anyone asks.

Reed
`
            },

          },
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

The authorization Reed's counsel produced was written by Reed.

Four independent indicators say so, and they agree:

  1. ENVELOPE vs LETTERHEAD. Return-Path is
     reed.connolly@gmail.com; From: claims
     l.hutchins@polaris-defense.com. The envelope sender is
     what the sending server actually declared for delivery to
     work. The From: header is text the composer typed.

  2. AUTHENTICATION. spf=fail, dkim=none, dmarc=fail — against
     a domain publishing p=REJECT. The genuine message from the
     same sender passes all three and carries a real
     DKIM-Signature.

  3. WRONG SYSTEM. The Message-ID is @mail.gmail.com. Genuine
     Polaris mail gets an @polaris-defense.com Message-ID and a
     chain that runs EXCH07 -> mx04.polaris-defense.com ->
     Google. The disputed message never touched Polaris
     infrastructure at all.

  4. THE CLOCK. The Date: header claims Thursday 12 March
     16:04. The Received: chain — written by servers, not by
     the sender — says Saturday 14 March 02:51. A sender can
     backdate Date:. A sender cannot reach back into the
     receiving server's log and change when it accepted the
     message.

And then the timeline closes it. The disputed message is
stamped 02:51. At 02:53 — two minutes later — Reed sent the
integration set to an external recipient with a file-drop
passphrase, and wrote "I've got cover on my end." He composed
the authorization first, then did the thing it was supposed to
authorize.

─── THE BLUNT VERSION ────────────────────────────────────────

Email was designed in an era when every host on the network
was trusted. The From: header is free text; nothing in the
original protocol ties it to anything. SPF, DKIM and DMARC were
bolted on afterward, and they work — but they are checks a
recipient performs and records, not properties the message
carries.

That distinction is the whole level. The message Reed produced
"is from" Larry Hutchins in exactly the sense that a letter is
from whoever typed the name at the bottom. Everything with
evidentiary weight was added by machines after the message left
his control, and all of it disagrees with him.

The practical version of this for defenders: NEVER trust the
display name. Every business-email-compromise investigation
starts the same way, with someone certain that a message came
from the CFO because it said so at the top.

One more thing worth stating plainly, because it changes the
character of the case. Up to yesterday this was a data-handling
incident: an employee took material he shouldn't have. Producing
a fabricated authorization is a different thing. Fabricating
evidence is generally a separate offense from the underlying
conduct, and it is frequently the one that does the most damage
to the person who does it. That determination belongs to
counsel and to Sgt. Chen, not to us. Our job was to establish
what the artifacts show, in a way that survives someone
competent arguing the other side.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Write this so it holds up when opposed. Three findings:

  Finding 1 (evidentiary):  The message produced as
                    authorization did not originate from
                    Polaris infrastructure and fails SPF, DKIM
                    and DMARC against a p=REJECT domain. Its
                    server-stamped receipt time contradicts its
                    Date: header by approximately 34 hours.

  Finding 2 (evidentiary):  At 02:53 the same account
                    transmitted project material to an external
                    recipient with an accompanying access
                    passphrase. Recipient and service are named
                    in the message.

  Finding 3 (control):  Polaris publishes DMARC p=REJECT, which
                    is correct and which is why the forgery is
                    provable. The gap is that no control
                    prevented the material from being on a
                    personal endpoint in the first place — and
                    Hutchins had flagged personal-address use in
                    writing a month earlier, with no follow-up.

Finding 3 is the one Polaris can act on. The first two are for
counsel.

Note what made this case cheap to prove: Polaris had DMARC at
enforcement. If the domain published p=none, the receiving
server would still have recorded the failure, but the forgery
would have been far easier to argue away as a misconfiguration.
Enforcement is what turns "suspicious" into "provable."

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-290 — Authentication Bypass by Spoofing
    The mechanism: asserting an identity in a field that
    nothing authenticates.

  RFC 7208 — Sender Policy Framework (SPF)
    Publishes, in DNS, which servers may send for a domain.
    Checks the ENVELOPE sender, which is why SPF alone does not
    protect the From: header a human reads.

  RFC 6376 — DomainKeys Identified Mail (DKIM) — Internet Standard
    Cryptographic signature over selected headers and body,
    verified against a public key in DNS. dkim=none means no
    signature existed to verify — an absence, not a failure.

  RFC 9989 — DMARC (obsoletes RFC 7489)
    Ties SPF and DKIM results to the visible From: domain
    (alignment) and publishes what the recipient should do on
    failure: p=none, p=quarantine, or p=REJECT. DMARC was
    Informational for a decade as RFC 7489; it became Standards
    Track in May 2026 as RFC 9989, with RFC 9990 and RFC 9991
    covering aggregate and failure reporting. Deployed policies
    in the wild — Polaris's included — still overwhelmingly
    reflect the 7489 era.

  RFC 5322 — Internet Message Format
    Defines the header block itself, including the rule that
    each relay PREPENDS its Received: line. That ordering rule
    is what makes the chain readable as a timeline.

  NIST SP 800-177 Rev. 1 — Trustworthy Email
    The federal guidance consolidating SPF/DKIM/DMARC
    deployment. Reasonable reading if you have to argue for
    enforcement internally.

  NIST SP 800-171 / CMMC
    Polaris handles Controlled Unclassified Information, so
    3.1.3 (control CUI flow), 3.1.20 (limit connections to
    external systems), and 3.3.x (audit and accountability)
    are the controls in scope for Finding 3.

  NIST SP 800-86 — Integrating Forensic Techniques into
    Incident Response. The methodology backdrop for this whole
    track: acquire, examine, analyze, report.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Email security controls — SPF, DKIM, DMARC — are directly
    tested, usually as "which control would have prevented
    this?" or "what does this header tell you?"

  CompTIA CySA+ (CS0-003)
    Header analysis appears as a hands-on analyst skill. Expect
    to be shown a header block and asked to identify the true
    origin or the spoof indicator.

  GIAC GCFA / GCIH
    Email as an evidence source, including chain reconstruction
    and the legal-process side of obtaining provider records.

  ISC2 CISSP
    Domain 7 (Security Operations): investigations, evidence
    handling, and the difference between an internal finding
    and something that has to survive a courtroom.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1114 — Email Collection
    Mail as both the target and the evidence source.

  T1534 — Internal Spearphishing
    The adversary equivalent of what Reed did: a message
    crafted to appear internal in order to be believed.

  T1567 — Exfiltration Over Web Service
    The file-drop service in the 02:53 message.

  T1070 — Indicator Removal / evidence tampering
    The adjacent behavior. Fabricating an artifact is the
    inverse of deleting one, and both are attacks on the
    record rather than on a system.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Preserve before you analyze. The production is the
     evidence; work from a copy, keep the hash, and record who
     touched what and when. Everything below is worthless if
     the provenance of the artifact is arguable.

  2. Always pull a known-good. Before calling any message
     forged, obtain a genuine message from the same claimed
     sender and compare authentication results, Message-ID
     domain, and relay path. A single failing message invites
     an argument about misconfiguration; a matched pair does
     not.

  3. Read Received: chains bottom-up, and normalize the
     timestamps. Different hops report different offsets;
     convert everything to one timezone (UTC is the safe
     default) before you compare against badge, VPN, or EDR
     timelines.

  4. Publish DMARC at enforcement. p=none records failures but
     permits delivery. Polaris being at p=REJECT is the reason
     this forgery is provable rather than merely suspicious —
     and it also means the message was never delivered to a
     Polaris mailbox, which is itself corroborating.

  5. Alert on the header conditions, don't just log them.
     Inbound mail whose From: domain is your own but which
     fails DMARC is one of the highest-signal detections
     available, and it is usually a one-line rule.

  6. Close the actual gap. Finding 3 is the only one Polaris
     controls. Hutchins put the personal-address concern in
     writing a month before the incident and nothing followed.
     A flagged behavior with no owner and no follow-up is a
     control failure regardless of what the employee later did.

─── CLOSING THOUGHT ──────────────────────────────────────────

The forged message was the strongest evidence in the case, and
Reed created it himself. He controlled every part of that email
he could see — the name, the address, the subject, the date —
and none of the parts he couldn't. Investigations turn on that
asymmetry more often than on anything technical: people manage
the story and forget the machines were taking notes the whole
time.

Maya: "Package the header comparison for Chen exactly as you
walked it — disputed message, known-good, chain, clock. Don't
characterize intent anywhere in the document; state what the
artifacts show and let counsel do the rest."

(There's a file-drop link in the 02:53 message with fourteen
days on the clock, and it was sent three days ago.)

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
