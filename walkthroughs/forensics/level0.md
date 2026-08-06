# level0@forensics — Reed's Soccer Alibi

**Track:** Forensics · **Client:** Polaris Defense Systems · **Compliance regime:** CMMC Level 2 + DFARS 252.204-7012 + NIST 800-171 Rev. 3

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@forensics`. If you haven't solved `level0@forensics` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Polaris Defense Systems is one of Driftwood's defense-industrial-base (DIB) clients — a mid-tier subcontractor building electronics subsystems for prime contractors, with roughly $80M in annual revenue, about 250 engineers, headquarters in Reston, Virginia, and a fabrication facility in Manassas. They've been a Driftwood client for about twenty-six months. Driftwood helped them through their initial CMMC Level 2 assessment in 2024 and has stayed on as their security partner for ongoing CUI handling, incident response, and — increasingly — internal investigations.

Defense subcontractors at Polaris's scale tend to run lean. Polaris has a four-person internal security team and no dedicated forensics capability of their own; for evidence triage they call Driftwood.

You're on Driftwood's forensics-analysis workstation, logged in as `secops` — the shared service account the security team uses when handling client-furnished evidence. The host is set up for evidence triage: magic-byte file identification, EXIF metadata extraction, hash computation, strings extraction, and the canonical chain-of-custody documentation tools.

Today's case is Polaris's. Dana Reyes, Polaris's in-house counsel, opened an internal investigation on Tuesday. The trigger was a routine seven-day badge-log audit by Polaris's SOC that flagged an anomaly: Reed Connolly — a Senior Manufacturing Engineer, DoD Secret-cleared, with Polaris since 2021 — badged into **Bay 4** (a secured fabrication area handling CUI-tagged subsystem components) on Saturday morning **2026-03-14**, between **09:42:11 and 11:18:47** local time. No scheduled work was on the books for that bay that morning. No work order was opened. No supervisor was on-site.

When Dana brought Reed in for an informal conversation on Monday, he was relaxed about it. He said he had stopped by the office briefly to grab a personal item from his locker, and that he could account for the rest of the morning because he was at his daughter's youth soccer tournament at Centreville Sports Complex in Centreville, Virginia from roughly 09:00 to 12:30. The badge timing (96 minutes inside Bay 4, not the "five minutes, in and out" Reed described) didn't match the locker story, but Dana didn't press the discrepancy in the informal session.

On request, Reed sent Dana a single photograph he said he took at the tournament that morning. He emailed it from his Polaris-issued Microsoft 365 mailbox to Dana at 19:42 on the Monday, with the filename `soccer-field.jpg`. Polaris IT confirmed the M365 transit preserved the file without resizing or re-encoding — the artifact you're examining is byte-for-byte the same as what Reed's phone produced.

Dana's question to Driftwood, verbatim from the call: *"Before I take this to HR I want a forensic read on the photo. If the metadata is consistent with what Reed said, the informal conversation closes and we move on. If it's not, I need to know before I'm sitting across from him with HR in the room."*

The scope is narrow. Driftwood is not being asked to determine whether Reed did something improper inside Bay 4 — the badge log establishes that he was there; the *why* is Dana's question to answer through Polaris's formal Insider Threat Program process. Driftwood is being asked one thing: does the photograph's metadata corroborate Reed's account of where he was Saturday morning?

This is a particular kind of engagement. Reed is a real person with a real career and a real clearance. The forensic finding will land in a way that affects an HR conversation, possibly a Defense Counterintelligence and Security Agency (DCSA) notification, possibly a referral to the FBI under 18 U.S.C. § 1832.[^18-u-s-c-1832] Driftwood's contribution is a *finding*, not a *conclusion* — what the metadata says, captured in language a judicial proceeding could survive. Dana writes conclusions. We write findings.

What you don't know yet, walking in, is that the EXIF metadata on `soccer-field.jpg` places the photograph eight months in the past and approximately a thousand miles south of where Reed said he was.

## §2 — The solve

Two commands. The forensic discipline is in *not* drawing conclusions beyond what the metadata supports.

### Step 1: Read the brief and the case summary

```bash
secops@forensics:~$ cat engagement-notes.md
secops@forensics:~$ cat case-summary.txt
```

The engagement notes establish the regulatory frame (CMMC Level 2, DFARS 252.204-7012 with its 72-hour-from-discovery reporting clock to DC3, NIST 800-171 Rev. 3 as the operating reference, NISPOM 32 CFR Part 117 for the cleared-facility specifics), the client context (Polaris, Dana, the badge-log anomaly), the subject (Reed, his role, his clearance), and the scoping discipline ("we are not being asked to determine whether Reed actually entered Bay 4 to do something improper... the photo is a separate question").[^nist-800-171][^cfr-32-117]

The case summary file is more formal — the kind of document that gets attached to Polaris's Insider Threat Program case file. Case ID, subject identifiers, badge data, the timestamp of Reed's photo, the SHA-256 of the artifact, and Polaris IT's attestation that M365 transit preserved the file. The summary also flags the **next engagement** (workstation forensic image, password `POL-IIS-2026-0007-handoff`) — which is the breadcrumb for `level1@forensics` but explicitly out of today's scope.

Read this before touching the artifact. The forensic-examination playbook is sequential: brief first, artifact second, never the other way around. Examining the artifact without the procedural context produces findings that can't be defended in cross-examination because they weren't generated under documented procedure.

### Step 2: Confirm the file type

```bash
secops@forensics:~$ file soccer-field.jpg
soccer-field.jpg: JPEG image data, EXIF standard
```

`file` reads the first few bytes of the file (its **magic bytes**) and reports the format. For JPEG files the magic bytes are `FF D8 FF E0` (or `FF D8 FF E1` for JPEGs with EXIF). The `file` command's output confirms two things: the file is genuinely a JPEG (not a maliciously-renamed binary), and it carries EXIF metadata. Both confirmations matter.

Without the file-type check, you'd be running EXIF extraction blind against a file that might or might not be what its extension claims. With it, you've got procedural cover for the next step: "examined SHA-verified artifact, confirmed JPEG/EXIF via magic-byte identification, then extracted metadata."

### Step 3: Extract the EXIF metadata

```bash
secops@forensics:~$ exif soccer-field.jpg
EXIF metadata for: soccer-field.jpg
────────────────────────────────────────────────────────
  Make                         Apple
  Model                        iPhone 14 Pro
  Software                     iOS 17.5.1
  Orientation                  Horizontal (normal)
  XResolution                  72
  YResolution                  72
  ResolutionUnit               inches
  DateTime                     2025:07:18 14:23:51
  DateTimeOriginal             2025:07:18 14:23:51
  DateTimeDigitized            2025:07:18 14:23:51
  OffsetTime                   -04:00
  ExposureTime                 1/1600 sec
  FNumber                      f/1.78
  ISO                          50
  FocalLength                  6.86 mm (35 mm equivalent: 24 mm)
  Flash                        Off, did not fire
  WhiteBalance                 Auto
  ImageWidth                   4032
  ImageHeight                  3024
  ColorSpace                   sRGB
  GPSLatitude                  25.0865°
  GPSLatitudeRef               N
  GPSLongitude                 80.4473°
  GPSLongitudeRef              W
  GPSAltitude                  3.2 m
  GPSTimeStamp                 18:23:51 UTC
  GPSDateStamp                 2025:07:18
  GPSSpeed                     0.00 km/h
  GPSImgDirection              218.4°

Approximate location (reverse-geocode):
  Key Largo, Monroe County, Florida, USA
  ~1,000 miles SSW of Reston, Virginia.
```

This is the finding.

Two fields determine everything: `DateTimeOriginal` and the GPS pair (`GPSLatitude` + `GPSLatitudeRef` + `GPSLongitude` + `GPSLongitudeRef`).

**`DateTimeOriginal: 2025:07:18 14:23:51`** — the camera's record of when the shutter fired. This is **July 18, 2025**, with a `-04:00` timezone offset (Eastern Daylight Time — matches a Florida or Virginia Saturday in mid-summer). Reed claimed the photo was taken Saturday morning, **2026-03-14**. The metadata says it was taken approximately eight months earlier than Reed's claimed Saturday.

**`GPSLatitude: 25.0865° N`, `GPSLongitude: 80.4473° W`** — the camera's record of where the shutter fired. Reverse-geocoded, those coordinates resolve to Key Largo, Monroe County, Florida. Reed claimed the photo was taken at Centreville Sports Complex in Centreville, Virginia (approximately 38.84° N, 77.43° W). The metadata places the photo approximately **1,000 miles south-southwest** of where Reed said he was.

The cross-check of `GPSTimeStamp` (18:23:51 UTC) against `DateTimeOriginal` (14:23:51 with `-04:00` offset) is consistent (UTC = local + 04:00), which suggests the metadata is the camera's native record rather than an injection or partial forge. The `GPSAltitude` of 3.2 meters (~10 feet) is consistent with a Florida Keys location at near-sea-level; Centreville VA is at approximately 95 meters. The `Make`/`Model`/`Software` fields confirm an iPhone 14 Pro running iOS 17.5.1, which is consistent with a phone that existed and would have been running that software in July 2025.

Every internal consistency check supports the conclusion that the metadata is the photograph's authentic record. The photograph was taken on July 18, 2025, in Key Largo, Florida. It is being presented in March 2026 as evidence of Reed's whereabouts at Centreville, Virginia.

### Step 4: Stop

The forensic finding stands at this point. Dana decides what Polaris does with it. The forensic examiner's contribution is the metadata extract, the chain-of-custody record (how the file was received, its hash, the tools used to examine it, the absence of modification), and a *plain reading* of what the metadata says.

In a real engagement you would not write "Reed Connolly fabricated his alibi." You would write something like:

> The artifact's embedded EXIF metadata records `DateTimeOriginal` of 2025-07-18 14:23:51 (with `-04:00` timezone offset) and GPS coordinates 25.0865° N, 80.4473° W (reverse-geocoded to Key Largo, Florida). These values are inconsistent with the subject's stated account of having taken the photograph at Centreville Sports Complex, Centreville, Virginia on 2026-03-14. The metadata's internal consistency (GPS timestamp aligns with local time and offset; GPS altitude consistent with Florida Keys; device fields consistent with the iPhone 14 Pro running iOS 17.5.1) supports the metadata as the camera's authentic capture record rather than a forgery, though forgery cannot be conclusively excluded without examining the device's storage directly.

That paragraph is what Dana will base her decision on. The judgment about whether Reed lied — and what Polaris does about it — is hers.

### Step 5: The breadcrumb (game-world only)

In a real engagement the work stops at the finding. In D3CYPH3R the breadcrumb pattern continues to the next level, where the workstation forensic image gets examined:

```bash
secops@forensics:~$ ssh level1@forensics
level1@forensics's password: POL-IIS-2026-0007-handoff
```

You're now positioned to examine the disk image of Reed's workstation that Polaris IT pulled under the Insider Threat Program escalation. That examination — and what it does or doesn't find — is `level1@forensics`'s lesson, in its own walkthrough.

### If you got stuck

- If `exif soccer-field.jpg` printed nothing or an error, the JPEG might genuinely lack EXIF metadata. In a real engagement, that absence is itself a finding — most modern smartphones write EXIF by default; a photo with no metadata at all suggests deliberate stripping (`exiftool -all=`, `mat2`, Signal's image upload, etc.), which is its own forensic indicator.
- If you tried to `cat soccer-field.jpg` to read the contents and got binary garbage, that's expected — JPEG is a binary format. `cat` on a JPEG won't help; `file` identifies the type, and `exif` (or `exiftool` in the real world) reads the metadata.
- If you were tempted to ssh into `level1@forensics` immediately without first reading the EXIF data on `soccer-field.jpg`, the lesson of this level is the methodology, not the speed. The forensic examiner who skips the metadata extraction in favor of opening the workstation image is, in a real proceeding, the examiner whose chain of custody is unrecoverable.

## §3 — The vulnerability

There are two analytical lenses on this case, and both matter.

**Lens 1 — From Reed's perspective: he did not know what his phone tells on him.** This is the OPSEC failure that defines the case. Reed almost certainly did not understand that every photo from his iPhone embeds, by default, a timestamp accurate to the second and GPS coordinates accurate to about three meters. He used a photo from a previous vacation, sent it to Dana, and treated it as proof. The metadata says otherwise. The category of mistake is universal — most people don't know how much their devices reveal — but the consequence here is unusual: Reed has a Secret clearance, a CUI-handling role, and a badge log to explain. The OPSEC gap that would be embarrassing in a personal context becomes career-ending in a cleared-facility context.

This is not technically a *vulnerability* in any system Polaris owns. It is, instead, an exposure of how much modern devices reveal about their users — and that exposure, when the user has reason to want privacy, becomes an asymmetric advantage for the investigator. The forensic discipline assumes the subject doesn't know what their devices say about them.

**Lens 2 — From Polaris's perspective: the formal investigation runs on procedural rails.** The badge-log audit that surfaced the anomaly is the **`AC` / `AU` family of NIST 800-171 Rev. 3** working as designed (specifically `03.14.06` System Monitoring and `03.14.07` Unauthorized Use Detection). The forensic examination Driftwood performs is the **incident-handling capability under `03.06.01`** working as designed. The chain-of-custody preservation is `03.06.02`. The decision Dana takes from the finding sits under Polaris's Insider Threat Program — which is itself a NITTF (National Insider Threat Task Force) minimum-standards requirement for any cleared contractor.[^nittf-national-insider-threat-task]

What's *missing* — and what Polaris's CISO should consider after the case closes — is preventive layering. Polaris had detective controls (badge log + audit cadence + forensic capability via Driftwood). It did not have, for example: a documented *second-person rule* requiring two-cleared-personnel access to Bay 4 after hours; an automated correlation between badge events and workstation activity (which would have surfaced whether Reed used systems in Bay 4 during the 96-minute window); or training that explicitly told cleared personnel that their personal-device photographs are forensically inspectable when used as evidence in an internal investigation. The case's value to Polaris's program is not just the finding on Reed's photo — it's the institutional question of which additional controls would have caught the underlying activity earlier.

Each lens matters for the writeup. The Lens 1 framing is what makes the McAfee parallel (next section) instructive. The Lens 2 framing is what makes the post-case institutional review tractable.

## §3.5 — Blast radius

This level differs from the rest of the corpus: nothing was misconfigured
and no control failed. The exposure is an insider's, and what is being
sized is the strength of an alibi.

| Dimension | This finding |
|---|---|
| Reached | Metadata embedded in a photograph Reed submitted as his own alibi |
| What it establishes | The image was captured roughly eight months earlier and about a thousand miles south of where the alibi places him |
| What it does **not** establish | Where Reed actually was, or that he took anything |
| Evidentiary standing | Voluntarily produced by the subject, which is the strongest possible provenance |
| Regime | CMMC Level 2, NIST SP 800-171, DFARS 252.204-7012 — 72 hours to DoD via DIBNet, with images and logs preserved at least 90 days |

**Refuting an alibi is not proving an act, and conflating the two is how
internal investigations go wrong.** The EXIF proves the photograph cannot
depict the day it was offered for. It says nothing about Reed's actual
whereabouts and nothing about CUI. The correct finding is narrow: the
submitted evidence is not what it was represented to be. Everything
further requires the artifacts the later levels examine.

**The provenance is what makes this hold up.** Reed produced the file
himself, which removes any argument about collection method, chain of
custody, or investigator tampering. An investigation that had seized this
image would spend its energy defending how it was obtained; one that was
handed it spends that energy on the analysis instead.

**Nothing is reportable to DoD yet, and that restraint is the
professional judgement being taught.** DFARS 252.204-7012 attaches to a
cyber incident affecting covered defense information, and a
misrepresented photograph is not one. The 72-hour clock has not started.
What has started is an internal matter for Polaris's counsel and its
Facility Security Officer, and the temptation to escalate early is
exactly what a defensible investigation resists.

## §4 — Real-world parallels

Three named, well-documented cases where embedded metadata in a digital artifact revealed information the subject did not intend to reveal. Each case became a public lesson in OPSEC and forensic methodology.

### John McAfee — Guatemala, December 2012

In November 2012, antivirus-software founder John McAfee was being sought by Belize police for questioning in connection with the murder of his neighbor in Belize. McAfee fled the country, evading capture for weeks, and began posting to his personal blog about his life on the run. In early December 2012, two journalists from Vice magazine — Robert King and Rocco Castoro — traveled with McAfee briefly and published an article on December 3, 2012, accompanied by a photograph captioned in part: "We are with John McAfee right now, suckers."[^vice-december-3-2012-we]

The photograph was a self-portrait of McAfee and Castoro. It was published to Vice's website at full resolution, with its EXIF metadata intact — Vice's editorial workflow did not strip the metadata before publication. Within hours, *third-party readers* extracted the GPS coordinates from the EXIF data and geolocated the photograph to **Río Dulce, Guatemala** — early reporting cited a swimming pool near a Ranchón Mary restaurant in Parque Nacional Río Dulce, and follow-on analysis commonly identifies the location as the Nana Juana Hotel Marina nearby. McAfee was arrested by Guatemalan authorities in Guatemala City on **December 5, 2012** for illegal entry from Belize.

The McAfee case is the canonical EXIF-OPSEC-failure story for the modern era. Vice's editorial team did not strip metadata before publication; the photographer did not know to do it; McAfee himself, despite being a security-software founder, did not realize the photograph would expose his location. The story became the standard worked example in OPSEC training: a single uncropped, unmodified photograph from a smartphone reveals the photographer's location to anyone with the technical curiosity to look. McAfee was eventually released by Guatemalan authorities, deported to the United States, and the case never reached a Belizean court. The lesson, however, remained.

For the Reed case at Polaris, the structural parallel is exact. Both subjects used a photograph as evidence (McAfee implicitly through publication; Reed explicitly to Dana). Both subjects did not know that the metadata would contradict the framing of the photograph. Both subjects' devices were doing exactly what they were designed to do: tag photographs with timestamp and location for the convenience of the user. The mistake in both cases was treating the photograph as a presentation layer when it was, in fact, a forensic artifact.

### Higinio O. Ochoa III — FBI capture, March 2012

Earlier in 2012, in February and March, Higinio O. Ochoa III — a hacker operating under the handle "w0rmer" associated with the Anonymous-linked CabinCr3w collective — defaced or compromised several US police-department websites and posted the results to Twitter under the handle `@AnonW0rmer`. In one of those posts, on March 24, 2012, Ochoa included a photograph: a woman's torso, holding a sheet of paper with the message "PwNd by w0rmer & CabinCr3w <3 u BiTch's!"

The photograph carried EXIF GPS metadata pinpointing the location of the woman holding the sign — Ochoa's girlfriend — to a residence in **Wantirna South, Victoria, Australia**. Within days, the FBI had cross-referenced the location to known Anonymous-linked aliases and identified the girlfriend. Within additional weeks, they had identified Ochoa himself, working as a software engineer in Galveston, Texas. The FBI arrested Ochoa on **March 20, 2012**. He pleaded guilty in July 2012 to one count of accessing a protected computer without authorization and was sentenced in **August 2012 to 27 months in federal prison plus three years of supervised release**, with $14,062.17 in restitution.[^fbi-san-antonio-field-office]

The Ochoa case is the OPSEC-failure case for the hacker subculture. It produced a now-canonical maxim in security-research circles: "if you're going to post a picture of your girlfriend, scrub the EXIF first." More broadly, the case is the parallel for any scenario where a subject who is *highly motivated to remain anonymous* is identified through metadata they didn't think to remove. Ochoa was technically sophisticated — he was successfully compromising police websites — and he still made the metadata mistake. The lesson scales: technical sophistication does not protect against OPSEC mistakes; only deliberate, comprehensive process does.

For Reed at Polaris, the relevance is the *technical-sophistication-doesn't-help* dimension. Reed is a senior engineer at a defense subcontractor. He has a clearance. He works around CUI handling. He has spent years thinking about information security in a structured way. None of that prevented him from sending an unscrubbed photograph as evidence — because the OPSEC discipline against metadata exposure isn't something most technical training covers. It has to be taught explicitly.

### BTK killer Dennis Rader — capture via document metadata, February 2005

The BTK ("Bind, Torture, Kill") murders began in Wichita, Kansas in 1974 and continued, with multi-year quiet periods, into the early 2000s. The killer, who taunted police and local media with letters and packages, was never identified through the murders themselves. In 2004 and 2005, BTK re-emerged after a decade of silence, sending new communications. In early 2005, Rader sent the Wichita police a communication asking whether a floppy disk could be electronically traced. The police ran a classified ad in the *Wichita Eagle* telling him it could not — a deliberate ruse. Rader subsequently sent a floppy disk, which Wichita PD forensic examiner Randy Stone (with FBI assistance) examined.

The floppy contained a deleted Microsoft Word document. The document's embedded metadata — fields the Word application writes by default into every saved file — included the author name "Dennis" and a reference to "Christ Lutheran Church" in the document's properties. The investigators cross-referenced the church's records against parishioners named Dennis. They identified **Dennis Rader**, a 59-year-old compliance officer for the city of Park City, Kansas, and longtime president of the church council at Christ Lutheran.[^dennis-rader-btk-killer-wikipedia] The metadata recovery and subsequent investigation led to Rader's arrest on February 25, 2005. He pleaded guilty on June 27, 2005 to ten counts of first-degree murder and is currently serving ten consecutive life sentences.

The BTK case is the canonical document-metadata-OPSEC-failure case in modern American law enforcement. It is also, instructively, a case where the suspect *explicitly asked* whether the disk's communication channel was traceable, was told (incorrectly, as it turned out) that floppy disks were safe, and continued. The lesson of the case is two-fold: every digital artifact carries metadata that its creator may not be aware of; and the *adversary's confidence in their OPSEC* is not a substitute for the actual OPSEC. Rader believed the disk was safe. The Microsoft Word document's properties pane said otherwise.

For Polaris's Insider Threat Program more broadly, the BTK lesson is structural: the routine telemetry that organizations capture (and that subjects forget about) is the most reliable evidence channel in any internal investigation. Reed's photograph wasn't carefully constructed as evidence; it was sent casually, in the same way that Dennis Rader's floppy disk was. In both cases, the casual mode meant the OPSEC discipline that might have protected the subject simply wasn't applied. The investigator's job is, in part, to recognize and exploit exactly that asymmetry.

## §5 — Frameworks, deep dive

The in-game post-mortem cites six framework controls. Each is expanded below: what the control actually requires, what audit evidence proves it's in place, and what auditors flag when it's not.

### NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response

NIST SP 800-86, published in August 2006, remains the canonical federal-government reference for procedurally-sound digital forensics in an enterprise / incident-response context.[^nist-800-86] It has not been formally revised since publication — which is unusual for a NIST guide of its age, but reflects how foundational its procedural model is rather than how dated its tooling advice has become. The procedural framework holds; the tooling references have been overtaken by every commercial forensics product released in the intervening twenty years.

Four sections of SP 800-86 bear directly on the Reed case:

**Section 3 — Establishing and Organizing a Forensics Capability.** The guide describes the institutional preconditions for forensic competence: documented procedures, trained personnel, available tooling, defined chain-of-custody handling, and pre-engagement legal review for the categories of investigation the organization expects to perform. Polaris's arrangement with Driftwood — *we don't have in-house forensics; we have a retainer relationship with a contracted partner who does* — is one of the SP 800-86-acknowledged organizational patterns for smaller organizations that can't justify a full in-house forensics function.

**Section 4 — Performing the Forensic Process.** The four-phase model: **collection, examination, analysis, reporting**. The Reed case touches all four — collection happened when Reed sent the photograph to Dana via M365 (Polaris IT preserved the file as received, with chain-of-custody documentation that the file was not altered in transit); examination is what Driftwood just did with `file` and `exif`; analysis is the cross-reference between the metadata and Reed's stated account; reporting is the written finding that goes to Dana. The discipline of keeping these four phases procedurally separate — including separate documentation for each phase — is what makes the forensic finding survive cross-examination.

**Section 5 — Using Data from Files.** The guide's specific discussion of file-system and embedded-metadata forensics. EXIF metadata extraction is explicitly named as an examination technique. The guide's procedural note — *examine metadata before content* — is the sequence we followed in §2: `file` identifies the artifact type, `exif` extracts the metadata, content inspection (the pixels of the photograph) is a secondary step that the Reed case doesn't even reach.

**Section 6 — Using Data from Network Traffic, Applications, and Operating Systems.** Tangential to the Reed case (the photograph was transferred over M365; we did not need to examine the SMTP-equivalent transit) but central to the *next* engagement on the workstation image.

Audit evidence for NIST 800-86 compliance includes documented forensic-handling procedures, training records for forensic examiners, chain-of-custody documentation for past cases, and tooling-validation records (the forensic tool list and version-control records demonstrating that the tools produce reproducible output). Common audit findings: procedures documented but not followed; chain-of-custody gaps in the artifact-receipt phase; tool versions undocumented or inconsistent across cases.

### NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information

NIST Special Publication 800-171, currently at **Revision 3** (finalized May 2024; supersedes Rev. 2), defines the security requirements for protecting Controlled Unclassified Information (CUI) when it resides in non-federal systems. For Polaris specifically, NIST 800-171 Rev. 3 is the operational control baseline that maps underneath CMMC Level 2 — the controls Polaris has to demonstrate are implemented at the time of CMMC assessment.

Four controls apply directly to the Reed case:

**03.06.01 — Incident Handling.** Establish an operational incident-handling capability for organizational systems that includes adequate preparation, detection, analysis, containment, recovery, and user-response activities. The Driftwood retainer is part of Polaris's incident-handling capability under this control — specifically the *analysis* phase. The audit evidence is the documented MSA with Driftwood plus prior case files demonstrating the capability has been exercised.

**03.06.02 — Incident Monitoring, Reporting, and Response Assistance.** Track, document, and report incidents to designated officials and authorities. **Chain-of-custody documentation is part of this control, not optional.** The Reed case's chain-of-custody log starts at "Polaris IT received `soccer-field.jpg` via Reed's M365 mailbox at 19:42 on 2026-03-18" and continues through every Driftwood touchpoint. Common audit failure: chain-of-custody documentation exists but doesn't capture the artifact's hash at each handoff, leaving a gap a defense attorney can exploit.

**03.14.06 — System Monitoring.** Monitor information systems to detect attacks and indicators of potential attacks; identify unauthorized use. The seven-day badge-log audit that surfaced the Bay 4 anomaly is the **`03.14.06` control working as designed** — routine telemetry review identified an anomalous event before it would have surfaced through any other channel. This is the canonical case study of why detective controls justify their cost.

**03.14.07 — Unauthorized Use Detection.** Detect unauthorized use of information systems. The badge event alone is an anomaly; whether it represents unauthorized use is what the formal investigation will determine. The control's value is in the surfacing, not the determination.

Audit evidence for NIST 800-171 Rev. 3 includes the System Security Plan (SSP) documenting which 800-171 controls are implemented and how, Plans of Action and Milestones (POA&M) for any control gaps with remediation timelines, and — for CMMC certification — a formal third-party assessment.

### CMMC Level 2 — Cybersecurity Maturity Model Certification

The Cybersecurity Maturity Model Certification (CMMC) is the Department of Defense's acquisition-side framework that maps to NIST 800-171 underneath. CMMC was finalized in 2024 with a phased contract-clause rollout through 2028. **Level 2** is the tier most defense subcontractors handling CUI must achieve; it requires the full set of NIST 800-171 controls and a third-party assessment by a CMMC Third Party Assessment Organization (C3PAO).

For Polaris specifically, the CMMC Level 2 certification is tied to their ability to bid on DoD contracts. A documented insider-threat incident handled badly — gaps in chain of custody, undocumented procedures, missing controls — would be a findings event on their next reassessment. The Reed case's procedural quality is, in this sense, an audit deliverable beyond its immediate investigative value.

CMMC organizes its practices into **domains** that map to NIST 800-171 control families. The Reed case touches three:

- **IR (Incident Response)** — the practices in this domain cover the incident-handling capability that produces the forensic examination, chain-of-custody documentation, and reporting trail.
- **AC (Access Control)** — the badge-log infrastructure is the AC domain's physical-access-control component working as designed.
- **AU (Audit and Accountability)** — the seven-day audit cadence and the persistent log records are AU domain controls.

Audit evidence for CMMC compliance includes documented practices for each domain at the maturity level claimed, evidence of practice operation (case files, audit logs, training records), and the C3PAO assessment report itself. Common audit findings: practices documented but not consistently operated; gaps between the documented procedure and the observed practice during the assessment.

### NISPOM — 32 CFR Part 117

The National Industrial Security Program Operating Manual (NISPOM) is the federal regulation governing cleared contractors' protection of classified information. NISPOM was moved into the Code of Federal Regulations at **32 CFR Part 117** in 2021 (it was previously a Department of Defense manual, DoD 5220.22-M); the current text is the regulatory authority for all cleared-contractor obligations.

For Polaris, NISPOM's relevance to the Reed case sits primarily in two areas:

- **Section 117.10 — Reporting Requirements.** Cleared contractors must report certain categories of suspected insider-threat events to the Defense Counterintelligence and Security Agency (DCSA). The badge-log anomaly by itself is not a reportable event; if the formal investigation develops evidence of compromised CUI or trade-secret exfiltration, DCSA notification obligations attach.
- **Section 117.12 — Personnel Security.** Cleared personnel are subject to ongoing eligibility review. An adverse finding from an internal investigation — even one that doesn't itself rise to a criminal referral — produces a "Significant Adverse Information" report under DoDD 5220.6 / DoD Manual 5200.02 that the DCSA reviews in the next clearance reauthorization cycle.

Audit evidence for NISPOM compliance includes the contractor's Facility Security Officer (FSO) documentation, the personnel-security file structure (who has what clearance, when was it last reviewed, what reportable events are on record), and the cleared-personnel training records. Polaris's FSO is in the Reed case's loop from the moment the badge-log audit flagged the anomaly.

### CIS Critical Security Controls v8.1 — Control 17 and Control 14

The Center for Internet Security publishes the CIS Critical Security Controls, currently at **version 8.1** (published 2024).[^cis-critical-security-controls-v8] Two controls apply to the Reed case:

**Control 17 — Incident Response Management.** Establishes the foundation for institutional forensic capability. Safeguards 17.1 (designate personnel for incident response), 17.2 (define contact information for incident-response personnel), 17.3 (establish reporting procedures for incidents), and 17.4 (document incident-response procedures) collectively describe the institutional readiness that makes the Reed-case examination possible. Polaris's arrangement with Driftwood is the practical instantiation of 17.1's "designated personnel" clause — for a small org without in-house forensics, the designated personnel can be a contracted partner under a documented retainer agreement.

**Control 14 — Security Awareness and Skills Training.** Includes the OPSEC-training component the Reed case suggests is missing. Safeguard 14.5 covers training on the dangers of credential reuse; more broadly, Control 14 covers institutional training on the threat model that includes metadata-bearing artifacts. Polaris's annual cleared-personnel training should include explicit instruction that personal-device photographs (and documents, and audio, and any other digital artifact) carry forensic metadata, and that the use of such artifacts in an internal investigation will be subject to metadata examination. The training cost is low; the operational impact is "the next Reed knows what their phone says about them."

### CWE-200 and CWE-359

The Common Weakness Enumeration catalog has two entries that apply to the Reed case, both with an unusual twist: they apply *to the subject*, not to a defended system.

**CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor.**[^cwe-200] The umbrella weakness pattern. In the standard CWE-200 framing, an organization unintentionally exposes its information to outsiders. In the Reed case, the inverted framing applies: *Reed* unintentionally exposed his own location and timestamp information to *Dana* (and through Dana, to Polaris's investigation process) by reusing a metadata-bearing artifact. CWE-200 covers this case too — the weakness pattern is "information was exposed in a context where the exposure was not authorized by the information's owner."

**CWE-359 — Exposure of Private Personal Information.** A more specific weakness covering personal information specifically.[^cwe-359] Reed's GPS coordinates and timestamp are personal information about Reed; the artifact's exposure of those values to a third party (Dana) is the CWE-359 pattern.

Both CWEs are unusual to cite from the *defender's* side of an insider-threat investigation, but they capture the asymmetric advantage modern forensic technique provides: the subject's own information-handling practices produce the evidence trail.

### 18 U.S.C. § 1832 — Theft of Trade Secrets

Title 18 § 1832 of the United States Code is the federal criminal statute covering the theft of trade secrets. The statute requires proving that the defendant knowingly stole, or without authorization appropriated, took, carried away, or concealed, or by fraud, artifice, or deception obtained, a trade secret with the intent that it benefit anyone other than the owner. **Penalties for individuals: up to ten years' imprisonment plus a fine under the standard Title 18 fine schedule. Penalties for organizations: a fine of up to $5 million, or three times the value of the trade secret to the organization (including the value of avoided research and development costs and any reproduction costs), whichever is greater.** The much-cited "$5M" figure is the *organizational* maximum, not an individual penalty cap.

For Polaris, the relevance to the Reed case is conditional. If the formal investigation develops findings that Reed accessed Bay 4 to exfiltrate or photograph CUI-bearing subsystem components — and if the CUI in question qualifies as a "trade secret" under the statute's economic-value test — federal criminal exposure attaches and Polaris's procedure handles the referral decision. The forensic examination of Reed's photograph does not itself produce any trade-secret-theft evidence; that determination would come from the workstation forensic image and any subsequent enterprise-data-loss-prevention review.

The 18 U.S.C. § 1832 citation in the in-game post-mortem is forward-looking: it names the regulatory category that *might* attach if the formal investigation develops in that direction, not a category that necessarily applies based on the badge log and photograph alone. The chain-of-custody discipline applied to the forensic examination is, in part, what makes any future § 1832 referral defensible.

## §6 — Cert exam relevance

Equal-depth coverage for the six certifications cited in the in-game post-mortem. The forensics track is unusual in that several certs are *whole-cert relevant* to this scenario — most notably the GIAC forensics family.

### CompTIA CySA+ — exam codes CS0-003 / CS0-004

CompTIA's CySA+ is the analyst-track certification focused on threat-detection, vulnerability-management, and incident-response work. CS0-003 was the in-market exam from June 2023 onward; **CS0-004 launched in early 2026 for parallel availability**, with CS0-003 retiring June 2026. By the time anyone reads this much past the review date, CS0-004 will be the only sittable version — check CompTIA's exam blueprint page for the current code. The forensics-track material maps to two domains.

- **Domain 3 — Incident Response and Management.** Objective 3.2 covers incident-response procedures including chain of custody, evidence handling, and the analyst's role in the IR cycle. The Reed case is the textbook example of a CySA+ incident-response scenario.
- **Domain 4 — Reporting and Communication.** Objective 4.1 covers technical communication for security incidents. The forensic-finding-as-written-report discipline lives here.

**Sample question framing:**

> A security analyst receives a JPEG image artifact from an organizational counsel for forensic examination as part of an internal investigation. The analyst's chain-of-custody documentation should include all of the following EXCEPT:
>
> A. The SHA-256 hash of the artifact at the moment of receipt
> B. The full name of every person who has had physical or digital access to the artifact, with timestamps
> C. The analyst's professional opinion regarding the subject's likely guilt or innocence
> D. The tool list (with versions) used to examine the artifact

The trap is C. CySA+ tests the discipline that *the forensic examiner does not write conclusions* — the chain of custody captures what happened to the artifact, not what the examiner thinks about the subject. **C** is the EXCEPT. A, B, and D are all required elements of chain-of-custody documentation; the examiner's opinion on guilt is not, and including it would compromise the artifact's value as evidence.

### GIAC GCFE — Certified Forensic Examiner

The GIAC Certified Forensic Examiner is the entry-level forensics certification in the GIAC family. It focuses specifically on **Windows artifacts**, file-system forensics, and the categories of digital evidence most common in enterprise insider-threat and litigation-support work. EXIF metadata extraction, image-file forensics, file-system metadata analysis, and chain-of-custody documentation are all covered in depth.

The Reed case maps directly to GCFE's first two domains:

- **Digital Forensics Fundamentals** — chain of custody, evidence handling, the four-phase forensic process from NIST 800-86.
- **Windows Forensic Analysis (and adjacent: smartphone artifact analysis)** — file-system artifacts, registry analysis, deleted-file recovery, and the embedded-metadata standards (EXIF for images, document metadata for Office files, etc.).

**Sample question framing:**

> During examination of a JPEG image submitted as evidence in an internal HR investigation, an examiner extracts the following EXIF fields:
>
> ```
> DateTimeOriginal: 2025:07:18 14:23:51
> OffsetTime: -04:00
> GPSTimeStamp: 18:23:51 UTC
> GPSDateStamp: 2025:07:18
> ```
>
> Which of the following BEST describes the relationship between the timestamps?
>
> A. The timestamps are inconsistent and suggest the metadata has been forged
> B. The timestamps are consistent: local time (14:23:51 EDT, UTC-4) equals UTC (18:23:51) minus the timezone offset
> C. The GPSTimeStamp records the time the GPS receiver was powered on; it is unrelated to image capture
> D. The DateTimeOriginal is in UTC; the OffsetTime indicates the display timezone

GCFE tests metadata-interpretation fluency. **B** is correct. The relationship `UTC = local + 4` (because Eastern Daylight Time is UTC-4) checks: 14:23:51 + 4 hours = 18:23:51. The internal consistency of timestamps across multiple EXIF fields is exactly the integrity check that distinguishes authentic camera metadata from forged metadata. The trap (A) flips the conclusion — the consistency *supports* authenticity, not forgery. C and D misrepresent the EXIF standard.

### GIAC GCFA — Certified Forensic Analyst

The GIAC Certified Forensic Analyst is the more advanced forensics certification, focused on **memory forensics, advanced file-system forensics, timeline analysis, and network-forensics correlation**. Where GCFE covers the artifact-by-artifact examination, GCFA covers the cross-artifact synthesis that produces a coherent incident narrative.

For the Reed case, GCFA-level depth becomes relevant in the *next* engagement — the workstation forensic image (`level1@forensics`). The GCFE-level work of extracting the photograph's EXIF metadata is necessary but not sufficient for the full investigation; the GCFA-level work of building a timeline that cross-references badge events, workstation activity, file-system changes, and external-communication metadata is what produces the institutional narrative Dana ultimately writes.

GCFA candidates are expected to be fluent with tools like **The Sleuth Kit**, **Autopsy**, **FTK Imager** and **FTK**, **EnCase**, **Volatility** for memory forensics, **Plaso/log2timeline** for super-timeline construction, and the SANS DFIR poster collection generally.[^sans-dfir-digital-forensics-and][^the-sleuth-kit-autopsy-open][^ftk-imager-free-disk-imaging] The exam includes a substantial practical component.

### GIAC GCIH — Certified Incident Handler

The GIAC Certified Incident Handler covers the incident-response side rather than the forensic-examination side — the procedural and operational discipline of running an incident from detection through closure. The Reed case touches GCIH in three places:

- **Preparation phase** — the institutional readiness Polaris demonstrated by having a documented retainer with Driftwood for forensic capability.
- **Identification phase** — the badge-log audit cadence that detected the anomaly.
- **Containment, eradication, recovery, and lessons-learned phases** — the procedural handling from Dana's perspective.

The GCIH curriculum specifically covers the *handler's* role in an insider-threat case: the unique procedural elements (legal hold, attorney-client privilege considerations, HR coordination, possible law-enforcement referral) that distinguish insider cases from external-attacker cases.

### EC-Council CHFI — Computer Hacking Forensic Investigator

The EC-Council Computer Hacking Forensic Investigator is the EC-Council's flagship forensics certification, often required for law-enforcement-adjacent and federal-contractor forensic roles. The certification is broad — covering Windows, Linux, and mobile-device forensics; image-file forensics; email and web-application forensics; network forensics; and dark-web investigation.

For the Reed case, CHFI's relevance is primarily in two domains:

- **Investigating Digital Media** — including EXIF metadata extraction and the broader category of "the artifact's metadata as primary evidence." Image-file forensics is explicitly named in the curriculum.
- **Reporting and Testimony** — including the procedural and ethical considerations for a forensic examiner who may have to testify in a legal proceeding. The "examiner writes findings, not conclusions" discipline is explicitly taught.

CHFI is also more legally-oriented than the GIAC certifications — its coverage of admissibility standards (Daubert in US federal court, Frye in some state courts) and the broader chain-of-custody requirements is more thorough.

### CISSP

CISSP is the senior-level (ISC)² certification. The current exam still follows the **2024 CBK refresh** (next refresh expected in 2027). The forensics track touches CISSP in one domain primarily.

- **Domain 7 — Security Operations.** Covers "Conduct investigations" (including digital forensics) and "Conduct logging and monitoring activities" (the detective layer that produces the badge-log anomaly). The CISSP framing is governance-level: how an institution organizes its forensic capability, how it integrates forensic findings into broader incident response, how it manages the legal-and-regulatory cascade that follows a finding.

**Sample question framing:**

> As the CISO of a defense contractor handling Controlled Unclassified Information, you receive a forensic finding from a contracted partner indicating that a cleared employee's submitted alibi photograph in an internal investigation is inconsistent with their stated account. The badge-log audit that triggered the investigation found the employee was in a CUI-handling area at an unscheduled time. Which of the following should you do FIRST?
>
> A. Notify the Defense Counterintelligence and Security Agency (DCSA) under NISPOM reporting requirements
> B. Refer the case to the FBI for criminal investigation under 18 U.S.C. § 1832
> C. Convene the institutional Insider Threat Program working group with the General Counsel and the Facility Security Officer
> D. Suspend the employee's clearance and badge access pending further investigation

The trap is that A, B, and D are all eventual actions; CISSP tests for the institutional *first* action. **C** is the CISSP answer — the Insider Threat Program working group is the convening structure that determines which of A, B, and D apply, in what order, on what timeline. Premature DCSA notification on a still-developing case (A) can backfire; FBI referral (B) is the eventual outcome only if criminal exposure is established; immediate suspension (D) tips the subject off and complicates the formal investigation. The institutional process is the first move.

## §7 — What a defender does

The Reed case is not theoretical. Every defender working at a cleared contractor — and every internal-investigations team at any organization handling sensitive data — has to navigate this category of case. Here's what the work looks like.

**1. Hand Dana the forensic finding, in writing, today.** The deliverable is a memo: the artifact's hash, how it was received, the tools used, the EXIF extraction in full, a plain reading of the metadata, the chain-of-custody log, and an explicit "this report does not draw conclusions about the subject's culpability." Dana reads the memo, makes the institutional decision, writes the conclusions. The forensic examiner's name appears on the memo as the technical author; Dana's name appears on the institutional decision.

**2. Polaris's broader Insider Threat Program review (not Driftwood's work, but Driftwood should advise).** The badge-log audit caught this case. What additional layers would have caught it earlier — or prevented the underlying activity? Workstation-activity correlation (Microsoft Purview, CrowdStrike Falcon Insight, Varonis, Code42 Incydr) that ties badge events to subsequent file-system activity. Second-person rules for after-hours CUI-bay access. DLP rules that flag transfer of CUI-tagged content out of designated zones. The institutional question is not "how do we punish Reed" — Dana handles that — but "what would make the next case surface in five minutes instead of seven days."

**3. The OPSEC training for cleared personnel.** Polaris should add to its annual cleared-personnel training an explicit module on metadata in personal-device artifacts. Most personnel do not know that their phones embed GPS and timestamp into every photograph by default. Most do not know that Microsoft Word documents carry author and "last edited by" metadata that survives PDF conversion in some cases. Most do not know that iMessage, Slack, and email all preserve metadata that the sender does not see. The training cost is hours; the operational impact is that future investigations don't pivot on a subject's failure to know what their devices reveal.

**4. Metadata-stripping tooling for org-managed devices.** For cleared environments specifically, organizations sometimes mandate that photographs taken on org-managed devices be passed through a metadata-stripping shortcut (iOS Shortcuts running `exiftool -all=` or `mat2` on share). This is not appropriate for personal devices, but for any photograph that crosses into the cleared environment (e.g., documentation photography of a fab-floor configuration), the stripping is standard practice.

**5. Sample detection rule (Sigma, generic Microsoft 365 audit log):**

```yaml
title: Image artifact submitted as evidence in internal investigation contains GPS metadata
status: experimental
description: Detects JPEG/PNG/HEIC attachments sent to designated
  investigation-coordinator mailboxes that contain GPS EXIF
  metadata. The presence of GPS metadata in a submitted-as-
  evidence image is a forensic flag; the absence is also a flag
  (suggests deliberate stripping). Either case warrants
  investigator awareness.
logsource:
  product: m365
  service: audit
detection:
  selection:
    operation: 'MessageReceived'
    recipient_address|contains:
      - 'investigations@'
      - 'counsel@'
      - 'hr-investigations@'
    attachment_type:
      - 'image/jpeg'
      - 'image/png'
      - 'image/heic'
  has_gps_exif: true
  condition: selection and has_gps_exif
level: medium
falsepositives:
  - Legitimate documentary photography submitted to investigations
    (review per-case; flag is for awareness, not interdiction)
```

The rule would not have stopped Reed from submitting the photograph — that's not its purpose. The rule's purpose is to ensure the *investigator* knows the metadata is there and processes it accordingly, rather than reading the pixels of the photograph and skipping the metadata extraction.

**6. The longer-arc institutional habit.** Insider-threat investigations have a specific procedural shape *because their findings can result in firings, clearance revocations, and criminal referrals.* The shape protects both the institution and the subject. Do not shortcut it. Do not let a forensic examiner volunteer an opinion on guilt. Do not let an HR team act before the institutional Insider Threat Program working group has met. Do not let the subject be confronted before the forensic finding is in writing. Each procedural rail exists because at some point in the history of similar cases, skipping the rail produced a worse outcome than following it.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command — `progress --detail` lists what you've unlocked.

### Camera direction in EXIF

**Trigger:** `exif soccer-field.jpg` (you ran this as step 4 of the solve, so the bonus fires there)

**What it teaches:** The EXIF dump includes `GPSImgDirection 218.4°` — the compass bearing the camera was pointed when the shutter fired. Lat/long and timestamp are the headline alibi-falsifiers; `GPSImgDirection` is the bonus, and it's important.

Modern phones embed *more* than when and where. Recent iPhones and Android flagships record:

- **GPSImgDirection** — the compass bearing the lens was pointing (true north or magnetic, depending on the field used)
- **GPSDestBearing** — for some camera apps, the heading the photographer was moving toward
- **GPSSpeed** — instantaneous velocity at the moment of capture (in km/h or knots)
- **GPSAltitude** — meters above sea level
- **GPSImgDirectionRef** — the reference frame ("T" for true north, "M" for magnetic)
- **GPSSatellites** — the number of GPS satellites the receiver had a lock on (useful for assessing fix quality)

Beyond the *time-and-place* falsification the level scores on, a defender mapping the photo to a *specific vantage point at a known location* can confirm or refute claims about WHO took the photo, not just whether the location is right. If Reed's alibi photo's GPSImgDirection were 218.4° but the soccer field stands are NOT at bearing 218.4° from the on-field position the photo's lat/long claims, that's *additional* evidence the photo couldn't have been taken from the claimed angle.

The longer-arc lesson is that **EXIF is a richer forensic artifact than most investigators use**. On the offensive side, the closest MITRE ATT&CK mapping for EXIF stripping is [T1070 — Indicator Removal](https://attack.mitre.org/techniques/T1070/) (attackers sanitizing metadata before exfil); defensively, the same metadata fields are what let you *prove* a claim about where, when, and how a photo was actually taken.

For the project: when you train forensic examiners, train them on every EXIF field, not just the obvious time/place. The photo Reed submitted is rich with metadata he didn't think to consider. So is every photo every suspect ever submits to in-house counsel.

## §8 — Key takeaways

- **The forensic examiner writes findings, not conclusions.** The chain-of-custody discipline, the procedural rails, and the "examiner does not opine on guilt" rule are not bureaucratic theater — they are the structural requirements that make the finding survive cross-examination. Dana writes the conclusion. We write what the metadata says.
- **Metadata is the most reliable evidence channel because subjects forget about it.** McAfee, Ochoa, Rader, and Reed all reused or submitted artifacts whose embedded metadata contradicted the framing they intended. The pattern is universal because most people don't know how much their devices reveal.
- **The detective layer (badge audit, file-system audit, log review) justifies its cost in cases like this.** Polaris's seven-day badge audit is the entire reason this case exists. The audit cost is recurring engineering hours; the case it surfaced would otherwise have remained invisible.
- **Insider-threat cases run on procedural rails because the consequences are serious.** Firings, clearance revocations, criminal referrals. The procedure protects the institution from a wrongful action and protects the subject from a wrongful accusation. Every step matters; skip none.
- **For a cleared environment, the investigator's contribution scales with the procedural quality of the contribution.** A small, exact, correctly-formatted forensic finding lets the institutional process proceed on accurate footing. A speculative or sloppy finding compromises every subsequent decision. The discipline is the value.

## §9 — Further reading

*Last reviewed: May 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^nist-800-86]: [NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final).
[^nist-800-171]: [NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information](https://csrc.nist.gov/pubs/sp/800/171/r3/final).
[^cfr-32-117]: [NISPOM — 32 CFR Part 117 (eCFR)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117).
[^nittf-national-insider-threat-task]: [NITTF — National Insider Threat Task Force](https://archive.dni.gov/index.php/ncsc-how-we-work/ncsc-nittf).
[^cis-critical-security-controls-v8]: [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1).
[^cwe-200]: [CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor (MITRE flags as "Discouraged" for direct vulnerability mapping; cited here for conceptual familiarity — the more-specific CWE-359 is the preferred citation)](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-359]: [CWE-359 — Exposure of Private Personal Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/359.html).
[^18-u-s-c-1832]: [18 U.S.C. § 1832 — Theft of Trade Secrets (Cornell)](https://www.law.cornell.edu/uscode/text/18/1832).
[^sans-dfir-digital-forensics-and]: [SANS DFIR — Digital Forensics and Incident Response (community resources)](https://www.sans.org/cyber-security-courses?focus-area=digital-forensics-incident-response).
[^the-sleuth-kit-autopsy-open]: [The Sleuth Kit + Autopsy — Open-source forensic toolkit](https://www.sleuthkit.org/).
[^ftk-imager-free-disk-imaging]: [FTK Imager — Free disk-imaging tool from AccessData](https://www.exterro.com/digital-forensics-software/ftk-imager).
[^vice-december-3-2012-we]: [Vice — December 3, 2012: "We are with John McAfee right now, suckers." (the EXIF-revealed McAfee photograph)](https://www.vice.com/en/article/we-are-with-john-mcafee-right-now-suckers/).
[^fbi-san-antonio-field-office]: [FBI San Antonio Field Office — Press release on Ochoa sentencing (August 2012)](https://archives.fbi.gov/archives/sanantonio/press-releases/2012/galveston-man-sentenced-to-federal-prison-for-computer-hacking).
[^dennis-rader-btk-killer-wikipedia]: [Dennis Rader / BTK Killer — Wikipedia (consolidated reference; the original Wichita Eagle coverage from Feb 26, 2005 may no longer resolve at its original URL)](https://en.wikipedia.org/wiki/Dennis_Rader).

### Further reading

- [NIST SP 800-53 Rev. 5 (current Release 5.2.0, August 2025)](https://csrc.nist.gov/pubs/sp/800/53/r5/final).
- [CMMC Program — DoD Cybersecurity Maturity Model Certification](https://dodcio.defense.gov/CMMC/).
- [DCSA — Defense Counterintelligence and Security Agency](https://www.dcsa.mil/).
- [EXIF Specification — JEITA CP-3451 (Exchangeable Image File Format)](https://www.jeita.or.jp/cgi-bin/standard_e/list.cgi?cateid=1&subcateid=4).
- [exiftool — Phil Harvey's perl-based EXIF reader (de facto reference implementation)](https://exiftool.org/).
- [mat2 — Metadata anonymization toolkit (upstream archived 2024-2025; still functional but unmaintained — distro-packaged forks may continue)](https://0xacab.org/jvoisin/mat2).
- [Wired — 2012 coverage: "Anonymous Hacker Caught After Posting Girlfriend's Boobs Online" (Higinio O. Ochoa III case)](https://en.wikipedia.org/wiki/Higinio_Ochoa).
- [GIAC GCFE — Certified Forensic Examiner](https://www.giac.org/certifications/certified-forensic-examiner-gcfe/).
- [GIAC GCFA — Certified Forensic Analyst](https://www.giac.org/certifications/certified-forensic-analyst-gcfa/).
- [GIAC GCIH — Certified Incident Handler](https://www.giac.org/certifications/certified-incident-handler-gcih/).
- [EC-Council CHFI — Computer Hacking Forensic Investigator](https://www.eccouncil.org/train-certify/computer-hacking-forensic-investigator-chfi-north-america/).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
