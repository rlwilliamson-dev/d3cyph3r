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
    playerUser: "secops",
    objective: "Forensically verify the alibi photo Reed Connolly submitted to Polaris's in-house counsel. Confirm — or refute — that the photo was taken when and where Reed claims.",
    lesson: "Polaris Defense Systems is one of Driftwood's defense-industrial clients — a mid-sized subcontractor (~$80M annual revenue, ~250 engineers) building electronics subsystems for prime contractors. CMMC Level 2 and NIST 800-171 are in scope across all production environments. Polaris's in-house counsel, Dana Reyes, opened an internal investigation last Tuesday: badge logs put one of their senior manufacturing engineers (Reed Connolly) in a secured fabrication bay on a Saturday morning that had no scheduled work. When asked informally, Reed said he was at his daughter's youth soccer tournament that morning and sent Dana a photo as proof. Dana wants forensic verification of the photo before HR escalates. You're on Driftwood's forensics-analysis workstation (the shell calls you `secops`, the shared service account the security team uses for evidence triage). Read welcome.md first — it explains how `file` and `exif` work. Then read engagement-notes.md, then case-summary.txt, then look at the photo. Read lessons-learned.md once you've decided whether the alibi holds.",
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
                   framework). NIST SP 800-171 Rev. 2 maps
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

  Findings due to Dana by COB Friday 2026-03-20.`
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

  NIST SP 800-171 Rev. 2 — Protecting Controlled Unclassified
  Information
    3.6.1  Incident Handling — establish an operational
      incident-handling capability for organizational systems.
      Forensic competence is part of this.
    3.6.2  Incident Tracking and Reporting — track, document,
      and report incidents. Chain-of-custody documentation is
      part of THIS, not optional.
    3.14.1, 3.14.2 — System monitoring; insider-threat
      detection. The badge-log audit that opened this case is
      the 3.14.x control working as designed.

  CMMC Level 2 (DoD CIO, 2024)
    The acquisition-side certification framework that maps to
    NIST 800-171. Domain IR (Incident Response) carries the
    forensic-capability practices listed above. CMMC was
    finalized in 2024 with a phased contract-clause rollout
    through 2028.

  CIS Critical Security Controls v8
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

};
