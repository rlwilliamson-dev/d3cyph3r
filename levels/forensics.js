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
    difficulty: "Easy",
    estimatedMinutes: 10,
    playerUser: "secops",
    objective: "Forensically verify the alibi photo Reed Connolly submitted to Polaris's in-house counsel. Confirm — or refute — that the photo was taken when and where Reed claims.",
    lesson: "Polaris Defense Systems is one of Driftwood's defense-industrial clients — a mid-sized subcontractor (~$80M annual revenue, ~250 engineers) building electronics subsystems for prime contractors. CMMC Level 2 and NIST 800-171 are in scope across all production environments. Polaris's in-house counsel, Dana Reyes, opened an internal investigation last Tuesday: badge logs put one of their senior manufacturing engineers (Reed Connolly) in a secured fabrication bay on a Saturday morning that had no scheduled work. When asked informally, Reed said he was at his daughter's youth soccer tournament that morning and sent Dana a photo as proof. Dana wants forensic verification of the photo before HR escalates. You're on Driftwood's forensics-analysis workstation (the shell calls you `secops`, the shared service account the security team uses for evidence triage). Read welcome.md first — it explains how `file` and `exif` work. Then read engagement-notes.md, then case-summary.txt, then look at the photo. Read lessons-learned.md once you've decided whether the alibi holds.",

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

        "soccer-field.jpg": {
          type: "file",
          content:
`ÿØÿà..JFIF.....      Exif  II* 
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
  //      later for `lhutchins` from the same source IP /
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
    difficulty: "Hard",
    estimatedMinutes: 18,
    playerUser: "secops",
    objective: "Triage Reed Connolly's workstation Security event log. Reconstruct his Saturday-morning activity inside the OS, identify any CUI exfiltration evidence, and flag any other findings Polaris's security team needs to know about.",
    lesson: "Dana Reyes escalated the Reed case to Polaris's formal insider-threat track Friday afternoon, right after your alibi finding closed the informal phase. Sgt. Chen (Polaris FSO) authorized a live forensic image of Reed's workstation POL-WS-0418 Tuesday night, packaged the EnCase E01 set with a single-use handoff password (POL-IIS-2026-0007-handoff — the same string that just gated this shell), and pushed it to Driftwood through Polaris's secure portal. The image is mounted read-only on a separate analysis volume; for today's narrow task only the Windows Security event log was extracted into this working directory. Read welcome.md first — it explains the new `evtx` command and how Windows event logs work. Then read engagement-notes.md, then case-summary.txt, then triage Security.evtx. Dana wants two things: a reconstruction of Reed's Saturday-morning activity at the keyboard, and any other findings the IR team needs to know about. Read lessons-learned.md once you've delivered both.",

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
  TargetUserName:         lhutchins
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
Sgt. Chen was the operator, Larry Hutchins (Polaris IR Lead)
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
                   L. Hutchins (Polaris IR Lead), remote
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
Followed 37 seconds later by a 4624 success for \`lhutchins\`
from the same workstation (IR-JUMPBOX-01), same source IP
(10.42.7.18), same network logon type.

That string isn't a username. It's a password — Larry Hutchins
(Polaris's IR Team Lead, supervising Sgt. Chen's triage at
~11pm EDT) typed his password into the username field on a
network-auth prompt and Windows logged it verbatim. The 4624
success 37 seconds later is him retrying with the fields in the
right boxes. This is the classic "credential leaked in 4625
TargetUserName" pattern — documented in SANS DFIR coursework
and Microsoft's own SIEM guidance. Polaris needs to rotate
lhutchins's credentials AND any IR-team service account that
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

  1. Immediate credential rotation for lhutchins and any
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
     - Same-day rotation of lhutchins's password and any
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
       us this time" rather than "lhutchins is careless."
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

};
