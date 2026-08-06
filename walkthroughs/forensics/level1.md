# level1@forensics — What the Logs Saw

**Track:** Forensics · **Client:** Polaris Defense Systems · **Compliance regime:** CMMC Level 2 + NIST SP 800-171 Rev. 3 + DFARS 252.204-7012 + NISPOM 32 CFR Part 117 · **Builds on:** [`level0@forensics`](/walkthroughs/#/forensics/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@forensics`. If you haven't solved `level1@forensics` yet, close this tab and come back after. The puzzle leans on you noticing one specific anomaly in a sixteen-event log; reading the writeup first removes the moment.

---

## §1 — The setup

When the lobby spun you out of `level0@forensics` last Friday morning, the alibi photo had cracked Reed Connolly's story open and Dana Reyes had a forensic finding she could take to HR. By Friday afternoon she'd done more than that. Dana brought the EXIF report to Polaris's General Counsel, the General Counsel called Sgt. Marcus Chen (Polaris's Facility Security Officer), and Chen — in his FSO capacity rather than his line-IT capacity — invoked NISPOM 32 CFR §117.8(c) and escalated the case to the formal Insider Threat Program. Reed's DoD Secret clearance was administratively suspended same day. His badge access was revoked. He was placed on paid administrative leave pending investigation outcome. The escalation was procedurally textbook; the alibi-photo finding was the threshold and the rest of the program kicked in the way the program is supposed to.

Tuesday night, Polaris's IR team pulled a live forensic image of Reed's primary workstation. Live, not power-off, because powering Reed's machine down would have given him a visible signal that something was happening — the lit monitor and spinning fans on his desk are part of the social-engineering surface area of an insider-threat case, and tipping him off before HR has the conversation lined up is the kind of mistake that ends investigations. The acquisition ran from `IR-JUMPBOX-01` (10.42.7.18) via the workstation's out-of-band management channel. Sgt. Chen ran FTK Imager; Maya Voss, Polaris's IR Team Lead, supervised from the same jumpbox. Power-on acquisition through the management interface preserves the workstation's running state, leaves its console untouched, and — critically for chain of custody — produces an audit trail of its own that proves nobody touched the keyboard during the acquisition window.

The image came across as an EnCase E01 split set, eight segments, ~480 GB total, wrapped in a single-use password-protected archive. Chen set the handoff password to a string he generated specifically for this case — `POL-IIS-2026-0007-handoff` — and that string is what gated entry to this shell. The archive password and the triage-workspace password are the same value by design: single-use means it gets rotated and destroyed when the engagement closes, and re-using a sysadmin's daily-driver password to gate evidence custody would be the kind of cross-contamination forensic procedure exists to prevent. (Side note: this is the breadcrumb pattern from the very end of `level0@forensics`'s `case-summary.txt`, exactly where you found it.)

Today's task is narrow. Polaris IT extracted the Windows Security event log — `C:\Windows\System32\winevt\Logs\Security.evtx`, the same path on every Windows host since Vista — and dropped it in this working directory. The rest of the mounted image is on a separate analysis volume, out of scope for this engagement. Dana wants two things by COB Wednesday: a reconstruction of Reed's Saturday-morning activity inside the OS during the 13:42-15:18 UTC (09:42-11:18 EDT) badge window, and any other findings the IR team needs to know about. Priya's hand-off note in `engagement-notes.md` foreshadows the second one — *"there's a finding in the IR-team activity from Tuesday night that I noticed during my own walkthrough of the file. It's not the Reed case directly, but it IS something Polaris needs to know about"* — and a Tuesday-night-fatigue finding in an audit log is the kind of moment that distinguishes a forensic engagement from a transactional log review.

You're logged in as `secops` on Driftwood's forensics-triage workstation. Same shared service account you used in `level0@forensics`, same workstation. The continuity is deliberate: forensic capacity in a small defense contractor lives on a single hardened triage host, and the engagement keeps you in the same chair. The legal frame hasn't softened. DFARS 252.204-7012 (c) starts a 72-hour reporting clock to DoD Cyber Crime Center (DC3) the moment "compromise of covered defense information" is discovered.[^dfars-252-204-7012-safeguarding] The CUI artifacts in scope on Reed's machine — subsystem-A schematics, BOM, fab process notes — meet the covered-defense-information definition. Polaris's discovery moment is when Dana receives your report, which means the clock starts the moment you transmit it. Sgt. Chen has the DIBNET portal credentials standing by. Coordinate timing with the client before you press send.

## §2 — The solve

The puzzle path is short and rewards filter discipline. Sixteen events, four interesting Event IDs, two distinct findings to extract.

### Step 1: Open the workspace

```bash
guest@d3cyph3r:~$ ssh level1@forensics
level1@forensics's password: POL-IIS-2026-0007-handoff
Connected: level1@forensics
secops@forensics:~$ whoami
secops
secops@forensics:~$ pwd
/home/secops
```

You used the single-use handoff password Sgt. Chen set on the archive. The same string that gated the archive gates this triage workspace; that's by design and the lessons-learned will explain why.

### Step 2: Read the engagement files

```bash
secops@forensics:~$ ls
Security.evtx        engagement-notes.md   welcome.md
case-summary.txt     lessons-learned.md
```

Five files. `welcome.md` is the mechanics file: it explains the new `evtx` command and the common Security-channel Event IDs (4624 successful logon, 4625 failed logon, 4634 logoff, 4663 object access, 4688 process creation).[^event-4624][^event-4625][^event-4663][^event-4688] `engagement-notes.md` is Priya's update — the day-two narrative, what happened between Friday and Tuesday, what Dana is asking for, and the foreshadowed "second finding" you'll need to extract alongside the Reed timeline. `case-summary.txt` is the formal case file: subject metadata, acquisition chain of custody (FTK Imager v4.7.1.2, live acquisition through OOB management, EnCase E01 split, single-use handoff password, hash placeholder), and the explicit Driftwood task — *(1)* reconstruct Reed's inside-the-OS activity during the badge window, *(2)* identify CUI access/exfil, *(3)* flag any other findings.

### Step 3: First pass — dump the whole log

```bash
secops@forensics:~$ evtx Security.evtx
Event log: Security.evtx
Total events: 16

═══════════════════════════════════════════════════════════════════
Event ID:        4624 (An account was successfully logged on)
TimeCreated:     2026-03-14T13:42:11.124Z
Computer:        POL-WS-0418.polaris-ds.local
...
```

The dump is sixteen events spanning four days. Two distinct activity windows are visible by timestamp alone:

- **2026-03-14 13:42-15:18 UTC** (Saturday morning EDT 09:42-11:18) — Reed's badge window
- **2026-03-18 02:47-06:14 UTC** (Tuesday night EDT 22:47-Wednesday 02:14) — IR team's triage

Eleven events fall in the first window, five in the second. The two are easy to separate by date. Don't confuse them in your write-up — Dana cares about Reed.

### Step 4: Filter to logon events

The cleanest place to start is authentication. Logon events tell you who was where, when, and from where; everything else attaches to that scaffolding.

```bash
secops@forensics:~$ evtx -id 4624 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4624: 3 matches)
```

Three successful logons:

1. **Reed Saturday 13:42 UTC, LogonType 2 (Interactive)** — workstation console, `TargetUserName: rconnolly`, `WorkstationName: POL-WS-0418`, source IP 127.0.0.1. He sat down at his own keyboard.
2. **`lchen` Tuesday 02:47 UTC, LogonType 10 (RemoteInteractive)** — RDP session from `IR-JUMPBOX-01`, source IP 10.42.7.18. Chen logging in to run the imaging.
3. **`mvoss` Tuesday 03:02 UTC, LogonType 3 (Network)** — network resource access from the same `IR-JUMPBOX-01` / 10.42.7.18.

Reed's interactive logon is what you'd expect. The two Tuesday-night logons are Chen and Voss doing the acquisition. Nothing here is anomalous yet — but the third one, `mvoss` at 03:02 UTC, will become more interesting in a moment.

### Step 5: Filter to failed logons — the smoking gun

```bash
secops@forensics:~$ evtx -id 4625 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4625: 1 match)

═══════════════════════════════════════════════════════════════════
Event ID:        4625 (An account failed to log on)
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
  ProcessName:            -
```

Read this event slowly. Four facts matter:

1. **`SubStatus: 0xC0000064` — STATUS_NO_SUCH_USER.** Windows logged this code because the typed "username" was not a real account in the directory. (The companion code `0xC000006A`, STATUS_WRONG_PASSWORD, is what gets logged when the username DOES exist but the password is wrong. The distinction matters: `0xC0000064` means Windows literally couldn't find an account by that name.)

2. **`TargetUserName: P0l4r1s-IR-L3ad-2026!`** — that string is not a username. It's mixed case, contains digits, contains a special character (`!`), is 22 characters long. Real Polaris usernames are short, lowercase, surname-and-initial format — `lchen`, `mvoss`, `rconnolly`. This string is a password.

3. **`WorkstationName: IR-JUMPBOX-01`, `IpAddress: 10.42.7.18`** — same jumpbox, same source IP as the Tuesday-night `lchen` and `mvoss` logons. The typo came from the IR triage activity.

4. **Timestamp 03:02:14, followed 37 seconds later by `mvoss`'s successful 4624 at 03:02:51 from the same source.** Whoever was at the keyboard fumbled the credential, immediately retried, got it right.

The conclusion is uncomfortable but unambiguous: Maya Voss, Polaris's IR Team Lead, supervising Chen's acquisition at ~11pm EDT on a Tuesday, typed her own password into the username field of a network-auth prompt. Windows logged the typed string verbatim into the 4625 record's `TargetUserName` field. The string `P0l4r1s-IR-L3ad-2026!` is Voss's credential — and it's now sitting in plaintext in an audit log, and that audit log is in your working directory, ready to be handed off as evidence.

That's your second finding. It's also the breadcrumb credential for `level2@forensics`: a string the IR team needs to know about IMMEDIATELY (same-day rotation), and a string that — for the in-game continuity — represents an IR-team service account password whose rotation/recovery becomes the entry gate for the next engagement.

### Step 6: Filter to process creations — Reed's exfil chain

Now the case Dana actually asked about.

```bash
secops@forensics:~$ evtx -id 4688 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4688: 6 matches)
```

Six process-creation records. Sorted by timestamp:

1. **14:04:18** — `cmd.exe`, parent `explorer.exe`. Reed opens a shell.
2. **14:04:21** — `powershell.exe`, parent `cmd.exe`, with the command line: `Compress-Archive -Path D:\CUI\Subsystem-A\* -DestinationPath C:\Users\rconnolly\AppData\Local\Temp\sa-export.zip -Force`. Reed archives the entire CUI directory into his AppData\Temp.
3. **14:06:44** — `certutil.exe`, parent `cmd.exe`, with `certutil.exe -encode <zip> <b64>`. This is the LOLBin moment. `certutil` is a Microsoft-signed binary intended for certificate management; its `-encode` and `-decode` subcommands perform raw base64. Adversaries and insiders use them to obscure payloads from content-inspection DLP that grep for file signatures or sensitive-keyword strings. Reed has no legitimate reason to invoke certutil here. The LOLBAS project (lolbas-project.github.io) has certutil at the top of its catalog precisely because this pattern is common in real-world exfil chains.
4. **14:11:55** — `chrome.exe`, parent `explorer.exe`, `--new-window`. Reed opens a browser.
5. **14:42:08** — second `chrome.exe`, parent `chrome.exe`, `--new-tab https://mega.nz/upload`. A new tab pointed at Mega's upload page.

That's the exfil chain: collect (CUI dir reads, visible separately under 4663) → archive (PowerShell Compress-Archive) → encode (certutil base64) → upload (chrome → mega.nz). Reed used valid credentials and legitimate Microsoft-signed binaries the whole way. None of these processes are individually anomalous; the *combination* of them in a 38-minute window is what makes the chain.

### Step 7: Filter to file access — what he read

```bash
secops@forensics:~$ evtx -id 4663 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4663: 4 matches)
```

Four file-access records. Three at the start of the badge window (Reed reading the CUI files) and one at the end (certutil writing the encoded blob). The reads:

- **13:48:33** — `D:\CUI\Subsystem-A\subsystem-a-schematics.pdf` (AccessMask 0x1 = ReadData), via Adobe Acrobat Reader.
- **13:51:02** — `D:\CUI\Subsystem-A\subsystem-a-bom.xlsx` (ReadData), via Excel.
- **13:54:18** — `D:\CUI\Subsystem-A\fab-process-notes.docx` (ReadData), via Word.

These are the CUI artifacts. They match the categories Polaris's CMMC artifact inventory marks as covered defense information — design data, bills of materials, manufacturing process documentation. Once you can name the specific files Reed read, the DFARS 7012 reporting requirement is no longer conditional. Polaris has a notifiable incident.

### Step 8: The hand-off

Your report has three sections:

1. **Reed's activity timeline.** Quote the event IDs and UTC timestamps verbatim. The exfil chain, in five lines: 13:42 logon → 13:48-13:54 CUI reads → 14:04 PowerShell Compress-Archive → 14:06 certutil -encode → 14:42 chrome upload to mega.nz → 15:18 logoff.
2. **CUI exposure determination.** Yes. Cite the three filenames. Note that Reed's exit timestamp on chrome means his upload window ran for ~36 minutes; without server-side mega.nz cooperation, you cannot confirm successful transfer, but the upload tab was opened and the encoded payload was sitting in `AppData\Local\Temp\` ready to send. Dana's DFARS 7012 clock should start at her receipt of this report.
3. **Other observations.** One paragraph. The 4625 event at 03:02:14 UTC on 2026-03-18 contains a credential in the `TargetUserName` field consistent with a password typed into the wrong field by an IR responder during the live acquisition. Voss (the IR Team Lead) was on the jumpbox at the time per the surrounding 4624 records. Recommend immediate credential rotation for `mvoss` and any service account that string is keyed to, AND a SIEM detection rule for the 4625 + `0xC0000064` + password-shape `TargetUserName` pattern going forward. Same-week remediation.

Hand it to Dana. Sign and hash `Security.evtx` for chain-of-custody.

## §3 — The vulnerability

Two distinct findings sit in one log file. Both are vulnerabilities; both have CWE mappings; both deserve treatment in the report.

The first finding — Reed's exfil chain — is the textbook insider-threat scenario. From a vulnerability-class perspective it's not a flaw in any single Polaris system; it's a *missing detection* problem. Every individual action Reed took was legitimate when viewed in isolation. He had access to D:\CUI\Subsystem-A because his role gave him access. PowerShell is allowed on his workstation because it's a developer machine. certutil is shipped by Microsoft. Chrome is the corporate browser. mega.nz is on the open internet. No control was bypassed; instead, every control assumed valid intent and got valid intent, and the malicious *combination* never tripped a correlated alert because Polaris doesn't have rules that say "PowerShell Compress-Archive on a CUI directory, followed within 5 minutes by certutil -encode, followed within 30 minutes by a chrome tab to mega.nz, is a DLP-evasion exfil pattern." That detection content is what defenders write *after* incidents like this one; it's the lesson the SOC takes back to detection engineering after the case closes. The CWE mapping is awkward — there's no CWE for "the right detection wasn't in place" — but the upstream class is **CWE-1059 (Insufficient Technical Documentation)** in some framings, or just MITRE ATT&CK T1078 (Valid Accounts) without a CWE counterpart because ATT&CK techniques and CWE weaknesses don't always overlap.[^t1078]

The second finding — the 4625 typed-password-as-username — has a direct CWE mapping: **CWE-532 (Insertion of Sensitive Information into Log File)**.[^cwe-532] It's a *defensive* vulnerability rather than an offensive one: nothing was exploited, no attacker is involved, but a credential is now sitting in plaintext inside an audit artifact that will be handled by multiple parties (Polaris IR, Driftwood forensics, eventually Dana's legal team, potentially DCSA if the clearance review needs the underlying evidence, potentially federal prosecutors if the case develops criminal weight). Every handoff is an opportunity for the credential to land somewhere it shouldn't. The remediation is rotation, not redaction — once a credential has been preserved in evidence, you can't retroactively un-preserve it without breaking chain of custody. You rotate the live credential and accept that the preserved copy in evidence is what it is. Sigma-based detection rules can be retro-fitted to alert on future occurrences; the underlying user-behavior fix is short retraining on credential hygiene under fatigue.

The structural lesson: Windows event logs catch what defenders forget to look at. CMMC AU.L2-3.3.x mandates the audit infrastructure; what it doesn't mandate is that anyone actually reads it. Polaris has them on, has the reviews scheduled, has a vendor (Driftwood) who actually opens the files — and so two findings surfaced from one log in one engagement. Most CMMC-compliant environments are AU-2 compliant (the logs are generated) and AU-12 compliant (the rules say what to log), but AU-6 noncompliant in practice (the logs are not actually reviewed beyond ingest into a SIEM that fires only on a small handful of pre-built rules). Reed's chain wouldn't have alerted on most default SIEM rule sets. The 4625 typed-password would not have alerted at all. Both findings depended on a human reading the log.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | The Security event log from Reed's imaged workstation, `POL-WS-0418` |
| The chain recovered | Archive creation, encoding to text, browser launch, and upload to a consumer file-sharing host, on a Saturday |
| Data class | Controlled Unclassified Information, which is what makes this a DFARS matter rather than an HR one |
| Second finding | An IR responder's password, typed into the username field and captured verbatim in a failed-logon record |
| Regime | CMMC Level 2, NIST SP 800-171, DFARS 252.204-7012 — 72 hours to DoD via DIBNet, with images and logs preserved at least 90 days |

**This is the point where the case becomes reportable, and the clock is
72 hours from the determination.** Level0 refuted an alibi. This
establishes a sequence of actions against CUI, which is what
DFARS 252.204-7012 is written about. Polaris's obligation runs to DoD via
DIBNet, and the same clause requires preserving images and logs for at
least 90 days, so evidence handling and the reporting decision are the
same workstream.

**Every tool in the chain is legitimate, which is the detection lesson.**
Archiving, encoding, and a browser are ordinary administrative activity.
No malware is involved and no signature will fire. What distinguishes the
sequence is the combination and the timing, which means detection has to
be behavioural, and an environment tuned to catch malicious binaries will
watch this happen without objection.

**The responder's leaked password is a separate incident and needs its
own clock.** A credential mistyped into a username field is captured in
cleartext in the log record, and it belongs to someone with investigative
privileges. It has nothing to do with Reed. It must be rotated
immediately, and the forensic bench's own access reviewed, because the
investigation team is now part of the exposure it is investigating.

## §4 — Real-world parallels

Windows event log forensics shows up in essentially every major IR investigation of the last fifteen years. A non-exhaustive tour:

**TJX (2006-2007).** TJX Companies disclosed a breach affecting ~45.7 million payment cards in early 2007; subsequent legal filings put the figure significantly higher. The investigation reconstruction relied heavily on Windows event logs from TJX's retail-store domain controllers and POS infrastructure. The famous "Wi-Fi from the parking lot" entry point is the headline; the timeline of what attackers did *after* gaining a foothold — credential reuse, lateral movement, staging — was reconstructed from event-log forensics. The TJX case is on the GCIH and CHFI exam syllabi for that reason.

**Target (2013).** The Target breach (~40 million payment cards + 70 million customer records) is most famous for the Fazio Mechanical Services HVAC vendor as the initial vector, but the bulk of the published case material covers what BlackPOS malware did once inside — which the investigators reconstructed from Windows event logs across the POS environment. Krebs on Security's coverage cites event-log findings directly. The Senate Commerce Committee's March 2014 report on the breach has a process-creation timeline pulled from 4688 events.[^target-2013-breach-senate-commerce]

**Sony Pictures (2014).**[^sony-pictures-2014-fbi-update] The "Guardians of Peace" wiper attack on Sony Pictures Entertainment is interesting in the opposite direction: the WIPALL malware family used in the attack actively destroyed event logs as part of its anti-forensics behavior. The FBI's December 2014 update and Mandiant's incident report both note the event-log destruction as a deliberate IR-frustration step. The lesson defenders took from Sony was forwarding event logs in real-time to a separate collector so destruction at the source doesn't destroy the evidence — what later became codified as Windows Event Forwarding (WEF) best practice.[^windows-event-forwarding-for-intrusion]

**The 2014 Sony breach and subsequent Microsoft guidance** prompted Microsoft to ship the Advanced Audit Policy improvements that landed in Windows 8.1 / Server 2012 R2 and have been the foundation of event-log forensics since. Command-line auditing for 4688 events ("Include command line in process creation events" Group Policy setting) was promoted from optional to recommended in Microsoft's security baselines specifically because of incidents where the *what* of an attacker's process activity could not be reconstructed without it.

**OPM (2015).** The Office of Personnel Management breach (~21.5 million records of federal employees and contractors) was reconstructed in large part from event logs that OPM had been generating for compliance reasons but not actively reviewing. The House Oversight Committee report ("The OPM Data Breach: How the Government Jeopardized Our National Security for More than a Generation") cites event-log evidence throughout. The lesson echoed in OPM was the same as TJX: generating logs is not the same as reviewing them.

**SolarWinds / SUNBURST (2020).** Mandiant's December 2020 SUNBURST writeup and subsequent threat reports cite event-log forensics as a primary detection mechanism for the lateral-movement and credential-theft phases of the Russian SVR's compromise.[^mandiant-sunburst-writeup-december-2020] The IOCs included specific 4688 patterns and 4624 anomalies; many of the detection rules SOCs added to their environments in early 2021 were sigma-rule-format detections of those specific 4688 / 4624 / 4663 combinations.

**Twitter (July 2020).**[^twitter-incident-report-july-2020] The teenage hacker who took over high-profile Twitter accounts used social-engineering to compromise internal Twitter admin tools; the post-incident report Twitter published (and the subsequent investigation by the NY DFS) reconstructed the attacker's activity from internal audit logs of the admin-tool actions. Twitter's report explicitly cites the audit-trail visibility into admin actions as both what made the case investigable and what the company expanded after the incident.

**The "password in 4625 TargetUserName" pattern specifically** has been documented in SANS DFIR coursework (FOR500 / FOR508 reference materials reference it as a common finding category) and has been the subject of multiple practitioner write-ups over the past decade.[^sans-dfir-blog] Eric Conrad's SANS posts touch on it; the 13Cubed YouTube series on Windows forensics covers it; Roberto Rodriguez's HELK / Mordor project includes detection content that fires on the 0xC0000064 + password-shape combination.[^13cubed-youtube-channel][^roberto-rodriguez-cyb3rward0g-helk-mordor] The pattern is not theoretical and not rare. In practitioner surveys, "credential typed into username field" is one of the top categories of internal credential-exposure findings discovered during routine SOC log review. Most SIEM platforms don't ship the detection by default; SOCs add it after either finding it themselves or reading about another SOC finding it.

**The "certutil -encode for exfil" pattern** is documented across MITRE ATT&CK (T1027 Obfuscated Files or Information), the LOLBAS project, and a long list of post-incident reports going back to ~2016.[^t1027] The classic public references are Casey Smith's research on LOLBin techniques (his blog *subTee* and the *LOLBin* talk at Derbycon 2017), Oddvar Moe's LOLBAS project (which formally catalogs the binaries), and various Microsoft blue-team writeups noting which Living-Off-the-Land patterns produce reliably detectable event-log signatures. Reed used a pattern that has been on every detection-engineer's "things to alert on" list for nearly a decade.

What unites these cases is the asymmetry of audit-log value: the logs are cheap to generate, cheap to retain at modern storage costs, very valuable to reconstruct after-the-fact, and operationally inert until someone reads them. Polaris is not Sony or OPM; Polaris is a small DIB subcontractor whose CMMC posture happens to fund a SOC that happens to retain Driftwood that happens to actually open the file. That entire chain has to hold for the finding to emerge. It held here.

## §5 — Frameworks, deep dive

### NIST SP 800-53 Rev. 5 — Audit and Accountability (AU) family

The federal-control catalog. Rev. 5 was published in September 2020 and is the current revision. The AU family is the most directly relevant control family for this engagement:

- **AU-2 Event Logging** — what events the organization logs. This engagement exists because Polaris's AU-2 baseline includes the Security channel events 4624, 4625, 4634, 4663, and 4688. (Microsoft's default Windows audit policy is narrower; Polaris's CMMC tailoring expanded it.)
- **AU-3 Content of Audit Records** — what fields each record carries. **AU-3(1) Additional Audit Information** is the control enhancement that mandates command-line capture for process-creation events. Without AU-3(1), the 4688 records would not have shown the PowerShell or certutil cmdlines and Reed's exfil chain would have been much harder to reconstruct. Polaris had it enabled; confirm it across the rest of their fleet.
- **AU-6 Audit Record Review, Analysis, and Reporting** — the "actually look at the logs" control. The entire Driftwood engagement is AU-6 working correctly. Most CMMC-compliant environments fail AU-6 in practice (logs are generated but not actively reviewed beyond a handful of pre-built SIEM alerts).
- **AU-9 Protection of Audit Information** — the integrity of audit records. Chain of custody on `Security.evtx` is what makes the finding admissible if Reed's case develops criminal weight. Hash the file, sign the chain-of-custody affidavit, preserve the original alongside any working copies.
- **AU-12 Audit Record Generation** — the rules that govern what produces a record at the system level. The 4663 file-access events on D:\CUI\Subsystem-A exist because Polaris enabled object-access auditing on that volume specifically (Microsoft's default is OFF because of performance overhead).

### NIST SP 800-92 — Guide to Computer Security Log Management

NIST SP 800-92 was originally published in September 2006 and has remained the canonical NIST reference for enterprise log management for nearly two decades.[^nist-800-92] NIST published a Revision 1 Initial Public Draft (IPD) on October 11, 2023 to update the guidance for SIEM/SOAR-era practices, cloud-native log shipping, and the contemporary tooling landscape; public comment closed November 29, 2023. As of the May 2026 review date, Rev. 1 has **not** been finalized — NIST is still processing comments, with no Final Public Draft (FPD) yet posted. Check the NIST CSRC page (`csrc.nist.gov/pubs/sp/800/92/r1/ipd`) for current revision status before quoting specific section numbers in audit work. Section 3 (Log Management Infrastructure) and Section 5 (Operational Processes) are the most-cited sections for IR practice and remain valid in both the original publication and the in-progress IPD.

### NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response

Originally published 2006 and a co-citation alongside 800-92 in essentially every forensic engagement. Section 5.2 covers data examination including event-log triage; procedurally, it's the formal mapping of what we just did. Cited in both forensic-engagement reports and CMMC assessor guidance.

### NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information in Nonfederal Systems and Organizations

Published May 14, 2024 (Final). The current standard Polaris is audited against. The §03.03 (Audit and Accountability) family inherits directly from 800-53 AU controls, tailored for non-federal systems.[^nist-800-53] Note that Rev. 3 adopted a zero-padded, period-separated numbering scheme (`03.03.01`) — distinct from Rev. 2's `3.3.1` style:

- **§03.03.01 Event Logging** ↔ AU-2
- **§03.03.02 Audit Record Content** ↔ AU-3
- **§03.03.05 Audit Record Review, Analysis, and Reporting** ↔ AU-6
- **§03.03.08 Protection of Audit Information** ↔ AU-9

Auditors are still in the transition window; cite Rev. 3 numbers (`§03.03.0x`) but be aware older Polaris artifacts may use Rev. 2's `§3.3.x` style. The CMMC Level 2 practice notation is its own scheme — `AU.L2-3.3.x` — which mirrors the Rev. 2 numbering by historical accident and is separate from the NIST scheme.

### CMMC Level 2 (DoD CIO, finalized 2024)

The Cybersecurity Maturity Model Certification Level 2 was finalized in 2024 with a phased contract-clause rollout through 2028. Domain AU (Audit and Accountability) maps 1:1 to NIST 800-171 §3.3.[^nist-800-171] Polaris's CMMC Level 2 posture is the regulatory floor that funds the audit-log generation, retention, and (through the Driftwood retainer) review that surfaced today's findings. CMMC's value is in connecting AU-control operation to DoD contract eligibility; loss of CMMC posture would jeopardize Polaris's ability to bid on follow-on contracts.

### CIS Critical Security Controls v8.1

CIS Controls v8.1 was released in 2024 (a maintenance update to v8). Control 8 (Audit Log Management) is the whole control family relevant here:

- **8.1** Establish and maintain an audit log management process
- **8.2** Collect audit logs
- **8.4** Standardize time synchronization (essential for cross-system timeline reconstruction)
- **8.5** Collect detailed audit logs (includes process creation with command line)
- **8.10** Retain audit logs for at least 90 days
- **8.11** Conduct audit log reviews (the safeguard most environments fail in practice)

### DFARS 252.204-7012 — Safeguarding Covered Defense Information and Cyber Incident Reporting

The DFARS clause that creates the 72-hour reporting clock to DoD (functionally to DC3 / DoD Cyber Crime Center via the DIBNET portal) upon discovery of a cyber incident affecting CUI. The clause's (c) paragraph defines the reporting requirement; the (e) paragraph requires preservation of media for at least 90 days post-incident — which is why Polaris is sitting on the full E01 image in cold storage even after this engagement closes.

### NISPOM 32 CFR Part 117

The National Industrial Security Program Operating Manual, codified into 32 CFR Part 117 in December 2020 (the formal regulatory codification that replaced DoD 5220.22-M).[^cfr-32-117] NISPOM §117.8 covers reporting and investigative requirements for cleared contractors; §117.8(c) is the specific authority Sgt. Chen invoked to seize Reed's workstation. The Suspicious Contact Report and Adverse Information Report Chen will file with DCSA (Defense Counterintelligence and Security Agency) are NISPOM-mandated.

### CWE / MITRE

- **CWE-532 Insertion of Sensitive Information into Log File** — the typed-password-in-4625 finding.
- **CWE-117 Improper Output Neutralization for Logs** — adjacent; covers log-injection rather than passive sensitive-data exposure.[^cwe-117] Cited together with CWE-532 when reviewing log-handling design.
- **CWE-200 Exposure of Sensitive Information to an Unauthorized Actor** — the parent of CWE-532, and the CWE cited in `level0@forensics` for the EXIF metadata finding.[^cwe-200] (CWE-200 itself is now mapping-**Discouraged** in current CWE guidance — MITRE recommends citing the more specific child weakness, which for the typed-password finding is CWE-532.)
- **MITRE ATT&CK T1078 Valid Accounts** — Reed's use of his own valid credentials.
- **MITRE ATT&CK T1083 File and Directory Discovery** — the 4663 CUI reads as deliberate enumeration.[^t1083]
- **MITRE ATT&CK T1560.001 Archive Collected Data: Archive via Utility** — the PowerShell Compress-Archive step.[^t1560-001]
- **MITRE ATT&CK T1027 Obfuscated Files or Information** — the certutil -encode base64 step.
- **MITRE ATT&CK T1059.001 Command and Scripting Interpreter: PowerShell** — the cmdline.[^t1059-001]
- **MITRE ATT&CK T1059.003 Command and Scripting Interpreter: Windows Command Shell** — the cmd.exe parent.[^t1059-003]
- **MITRE ATT&CK T1567.002 Exfiltration Over Web Service: Exfiltration to Cloud Storage** — the chrome → mega.nz tab.[^t1567-002]

### Microsoft documentation

The "Audit Logon" and "Audit Failed Logons" subcategories of the Advanced Audit Policy. The 4624 / 4625 / 4634 split, LogonType meanings (2 Interactive, 3 Network, 4 Batch, 5 Service, 7 Unlock, 8 NetworkCleartext, 9 NewCredentials, 10 RemoteInteractive, 11 CachedInteractive), and SubStatus codes (0xC0000064 / 0xC000006A / 0xC0000234 / 0xC0000072 / 0xC0000071) are documented at learn.microsoft.com under `windows/security/threat-protection/auditing/`. The same reference covers 4663 object access and 4688 process creation in depth.

### LOLBAS Project

The Living Off The Land Binaries, Scripts and Libraries project (lolbas-project.github.io) catalogs ~200 Windows-shipped binaries with dual-use potential. certutil.exe with its -encode/-decode subcommands is one of the founding entries; the project page documents the specific cmdline patterns and the MITRE ATT&CK techniques they map to. The LOLBAS project complements MITRE ATT&CK's technique catalog with binary-level specificity.

### Sigma — SIEM-portable detection rule format

The Sigma project (sigmahq.io) defines a YAML-based detection-rule format that compiles down to platform-specific SIEM queries (Splunk SPL, Elastic ESQL, Microsoft Sentinel KQL, Chronicle YARA-L, etc.). The defensive recommendation in §7 below is written in Sigma syntax. The SigmaHQ public ruleset (github.com/SigmaHQ/sigma) ships pre-built detection rules for many of the patterns this engagement surfaced; check it before writing new content from scratch.

## §6 — Cert exam relevance

Windows event log forensics is core curriculum across the IR/DFIR certification landscape and shows up in SOC analyst, blue-team, and cleared-environment certs as well.

### GIAC GCFE — Certified Forensic Examiner

The Windows-forensics-on-disk specialist cert. Security.evtx structure and analysis is core content — both the binary EVTX format (XML-typed records, channels, providers) and the analytical patterns (logon-type taxonomy, sub-status codes, process-tree reconstruction). Feeds from SANS FOR500 (Windows Forensic Analysis), which is the most direct training-path course for what we just did. GCFE is typically the first DFIR cert practitioners earn.

### GIAC GCFA — Certified Forensic Analyst

The deeper IR/forensics cert. Event-log analysis at timeline-reconstruction scale, file-system forensics (MFT, USN journal, $LogFile), memory forensics (Volatility, Rekall). Feeds from SANS FOR508 (Advanced Incident Response, Threat Hunting and Digital Forensics). GCFA is the cert you'd typically pursue after GCFE if your role centers on IR rather than e-discovery or expert-witness testimony.

### GIAC GCIH — Certified Incident Handler

The enterprise-IR cert. Less forensics-deep, more incident-process-broad. Detection-engineering coverage of event-log monitoring lives here — the rule that would catch the 4625 typed-password pattern is the kind of content GCIH covers. Feeds from SANS SEC504 (Hacker Tools, Techniques, and Incident Handling).

### GIAC GCDA — Certified Detection Analyst

SOC/SIEM-side cert (formerly branded as "Continuous Monitoring & Security Operations Analyst"). Detection engineering, log pipeline design, threat hunting in event-log data, Sigma rules. Feeds from SANS SEC555 (recently renamed to "Detection Engineering and SIEM Analytics" — previously "SIEM with Tactical Analytics"). GCDA is the natural pursuit for someone who wants to build the detection content rather than respond to its alerts.

### CompTIA CySA+ (CS0-003 / CS0-004)

CySA+ is the broad SOC-analyst credential. CS0-003 was the current exam revision as of the May 2026 review date, **with CS0-004 launched in early 2026 for parallel availability** — CS0-003 retires June 2026, so by the time anyone reads this much past the review date, CS0-004 will be the only sittable version. Domain 1 (Security Operations) covers log analysis and SIEM correlation; Domain 3 (Incident Response and Management) covers forensic analysis including event logs. CySA+ is a non-vendor cert; it's lighter than GIAC but cheaper and more broadly recognized at entry-to-mid SOC roles.

### ISC2 CISSP

The Common Body of Knowledge cert. Domain 7 (Security Operations) includes "Conduct logging and monitoring activities" and "Conduct investigations" — both procedural-side coverage of what we just did. CISSP is conceptual rather than hands-on; you'd cite it as the framework cert, not the practical one.

### Microsoft SC-200 — Security Operations Analyst Associate

The Microsoft-native SOC cert. Microsoft Sentinel KQL queries, Microsoft Defender XDR investigation, Azure Monitor logs. The SC-200 exam covers analysis of the same Security-channel event IDs we triaged today, but in the Sentinel-pipeline context rather than at the raw .evtx level. SC-200 is the cert path for analysts in Microsoft-stack-heavy environments.

### EC-Council CHFI — Computer Hacking Forensic Investigator

Module 13 (Windows Forensics) covers event logs in depth — both the binary EVTX format and the analytical patterns. CHFI is a whole-cert forensics credential, generally considered weaker than GCFE/GCFA in the DFIR community but holds federal-recognition status (DoD 8570 / 8140 baseline cert for IAT/IAM/CSSP roles) that GCFE/GCFA don't.

## §7 — What a defender does

Two parallel remediation tracks, plus the longer-arc audit-log-program improvements.

### For the Reed case specifically

Hand Dana the timeline with verbatim event IDs and UTC timestamps. She will cite them to General Counsel and (when the DFARS clock starts at her receipt) to DC3 via the DIBNET portal. Do not speculate in the report about Reed's intent — the events show what happened, intent is Dana's call to make with HR, legal, and DCSA in the loop. Sign and hash `Security.evtx` as part of the chain-of-custody package; the hash you compute now is what proves the log wasn't altered between acquisition and any eventual proceeding.

Polaris IT's parallel containment work: rotate Reed's account credentials (already initiated under Friday's escalation), revoke his M365 / VPN tokens, audit any external systems his account touched between 2026-03-14 and 2026-03-20. Clean up `C:\Users\rconnolly\AppData\Local\Temp\sa-export.zip` and `sa-export.b64` from the workstation image's source path on Polaris's file servers (the live workstation is offline pending the formal investigation; the file artifacts on it are evidence-preserved on the E01).

### For the IR-team credential leak

Same-day rotation of `mvoss`'s password and any service account that credential string is keyed to. Same-day means before the audit-log file leaves Polaris's direct control on its way to any downstream handler. The credential preserved in the 4625 record is what it is — chain of custody prevents retroactive redaction — but the *live* credential it represents can and must be rotated immediately.

Add a SIEM detection rule for the pattern going forward. The Sigma rule is straightforward:

```yaml
title: Credential Disclosure in 4625 TargetUserName
id: pol-ir-4625-typed-password-v1
description: |
  Detects 4625 failed-logon events where SubStatus is 0xC0000064
  (no such user) and TargetUserName does NOT look like a normal
  username — i.e., contains symbols, mixed case + digits, or is
  unusually long. Typical signature of a password typed into the
  username field by mistake.
status: experimental
references:
  - https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4625
logsource:
  product: windows
  service: security
detection:
  selection:
    EventID: 4625
    SubStatus: '0xC0000064'
  filter_normal_username:
    TargetUserName|re: '^[a-zA-Z0-9._-]{1,16}$'
  condition: selection and not filter_normal_username
fields:
  - TargetUserName
  - WorkstationName
  - IpAddress
  - TimeCreated
level: high
falsepositives:
  - Service-account names that happen to be longer than 16 chars
    and contain symbols (rare; tune the regex per environment)
  - Internal pentests that deliberately spray malformed usernames
```

Light retraining for the IR team on credential hygiene under fatigue. Frame it as "the audit caught us this time" rather than punitive — this is a humans-get-tired-at-11pm finding, not a careless-individual finding. The remediation language matters: a punitive frame teaches IR responders to be defensive about audit-log review, which is exactly the opposite of what you want when the audit-log review is the control that protects the institution.

### For Polaris's longer-arc audit-log program

Confirm command-line auditing is enabled across the fleet via Group Policy (`Computer Configuration → Policies → Administrative Templates → System → Audit Process Creation → "Include command line in process creation events"`). Without this setting, the 4688 events would not carry the PowerShell or certutil command lines and Reed's exfil chain would have been substantially harder to reconstruct. Polaris had it enabled on POL-WS-0418; confirm it across the rest of the CUI-handling fleet.

Confirm 4663 file-access auditing is enabled on D:\CUI\ and equivalent CUI-handling volumes (Microsoft's default is OFF because of performance overhead; most environments enable it selectively on sensitive volumes only). Polaris had it on for the CUI volume on POL-WS-0418; that's why Reed's reads showed up. Audit the rest of the fleet for parity.

Deploy Sysmon (sysinternals.com) to extend native audit categories with richer process-tree visibility. Sysmon's Event ID 1 (process creation) includes parent process hash, image hash, and per-process full command line regardless of GPO setting. Sysmon Event ID 11 (file create) is more granular than the native 4663. For a CUI-handling environment, Sysmon is essentially free additional fidelity. The SwiftOnSecurity Sysmon configuration (github.com/SwiftOnSecurity/sysmon-config) is the practitioner-default starter config; Olaf Hartong's modular Sysmon config (github.com/olafhartong/sysmon-modular) is a more recent alternative.[^swiftonsecurity-sysmon-config][^olaf-hartong-s-sysmon-modular]

For aggregation: ship Security.evtx and Sysmon logs via Windows Event Forwarding (WEF) to a central collector, then ingest into the SIEM. Microsoft's documentation at `learn.microsoft.com/windows/security/operating-system-security/device-management/use-windows-event-forwarding-to-assist-in-intrusion-detection` covers the WEF setup. For analysis, the canonical practitioner-tool stack is:

- **EvtxECmd** (ericzimmerman.github.io) — Eric Zimmerman's EZ Tools command-line .evtx parser.[^eric-zimmerman-blog] The go-to for offline triage.
- **Hayabusa** (github.com/Yamato-Security/hayabusa) — Yamato Security's threat-hunting tool that ships with thousands of pre-built detection rules in Sigma format, applied to .evtx files in bulk.[^hayabusa]
- **Chainsaw** (github.com/WithSecureLabs/chainsaw) — WithSecure Labs' tool that searches .evtx files using YAML detection rules.[^chainsaw] Often used alongside Hayabusa for cross-validation.
- **KAPE** (kape.kroll.com) — Kroll Artifact Parser and Extractor; a triage-collection tool that pulls a curated set of forensic artifacts from a running system, including the Security log and a long list of supporting artifacts.

### For DFARS 7012 reporting

Dana coordinates with General Counsel on DC3 notification timing. The 72-hour clock is real and missing it is a contractual non-compliance event. The DIBNET portal (dibnet.dod.mil) is where the report files; Polaris's FSO has the credentials. The reporting form requires specific facts (the affected system, the timeline, the artifacts) — your timeline write-up is what Dana hands the FSO to populate the form.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command pattern — `progress --detail` lists what you've unlocked.

### certutil as a LOLBin

**Trigger:** `evtx -id 4688 Security.evtx` (a natural filter for any process-creation investigation; the bonus fires when the 4688 chain surfaces)

**What it teaches:** Reed's 4688 process-creation chain includes `certutil.exe -encode` — a Microsoft-shipped binary whose dual-use potential makes it one of the founding entries on the [LOLBAS Project](https://lolbas-project.github.io/) (Living Off the Land Binaries and Scripts). The signal isn't *that certutil ran*; it's that **certutil ran via cmd.exe with `-encode` arguments by a user who has no certificate-management reason to invoke it.**

The LOLBin pattern matters for three reasons:

1. **AV/EDR signature rules don't flag it.** certutil.exe is signed by Microsoft. Its hash matches the Windows install. Every signature-based detection treats it as legitimate. The attack pattern is the *combination* of legitimate binary + suspicious argument usage, not the binary itself.
2. **Forensic timelines look "normal" at a glance.** A 4688 event for certutil.exe looks like routine certificate operations to an analyst who isn't paying attention to the command-line arguments. The argument string is where the signal lives.
3. **Defender response is behavioral rules, not signatures.** Sigma, Velociraptor, ATT&CK-aligned hunt queries — these are how teams catch LOLBin patterns. Reed's specific sequence (cmd.exe → certutil.exe -encode → outbound to a non-Polaris domain) is detectable via behavioral rules that look at the parent-child process chain and the argument string.

The canonical LOLBin references for the Polaris IR team to add to their hunting library:

- **[LOLBAS Project](https://lolbas-project.github.io/)** — the community-maintained catalog of Windows binaries with documented dual-use potential. certutil, bitsadmin, mshta, rundll32, wmic, regsvr32, msbuild, installutil, powershell, and ~50 others.
- **[Sigma Rules Repository](https://github.com/SigmaHQ/sigma)** — open-source signature-format detection rules. The certutil-encode-with-suspicious-args pattern is well-covered in `rules/windows/process_creation/proc_creation_win_certutil_*.yml`.
- **[MITRE ATT&CK T1140 — Deobfuscate/Decode Files or Information](https://attack.mitre.org/techniques/T1140/)** — the technique covering certutil-encode usage in real campaigns. Polaris's MITRE-aligned detection coverage should include T1140 with certutil specifically called out.

For Polaris's IR runbook: a behavioral rule that fires on "certutil.exe with `-encode` argument by any user in the manufacturing-engineering OU" would have caught Reed's encoding step in near real-time. Add to the hunting library.

## §8 — Key takeaways

- **Windows event logs catch what defenders forget to look at — but only if defenders look.** CMMC AU.L2-3.3.x mandates the audit infrastructure; what it doesn't mandate is that anyone actually reads it. Most CMMC-compliant environments are AU-2/AU-12 compliant (logs are generated) but AU-6 noncompliant in practice (logs are not actively reviewed). Polaris's posture was funded by their CMMC certification; Driftwood's retainer was funded by Polaris's posture; this engagement happened because that whole chain held. None of it is automatic.

- **Reed's chain looked legitimate at every individual step.** Valid credentials, Microsoft-signed binaries, default-permitted PowerShell, default-permitted certutil, default-permitted chrome. The malicious *combination* — Compress-Archive of a CUI directory, followed by certutil -encode, followed by chrome to mega.nz — is what makes the case. The detection content that would have alerted on this combination is exactly the kind of correlation rule SOCs add *after* incidents like this one. Detection engineering is reactive by nature; the lesson the SOC takes back to its rule library is the durable output of the investigation.

- **certutil -encode is a textbook LOLBin and has been on every detection engineer's "watch this binary" list for nearly a decade.** The pattern is documented in the LOLBAS project, in MITRE ATT&CK T1027, and across dozens of post-incident reports. If your environment hasn't deployed detection content for certutil-with-encode-or-decode-flags, that's the easiest detection-engineering win in any SOC operating under CMMC, PCI-DSS, or any other audit-driven posture.

- **The 4625 typed-password-as-username pattern is a real-world finding category, not a hypothetical.** SubStatus 0xC0000064 (STATUS_NO_SUCH_USER) combined with a TargetUserName that looks like a password (mixed case + digits + symbols, length > 12-16 chars) is the signature. Most SIEM platforms don't ship the detection by default; SOCs add it after either finding it themselves or reading about another SOC finding it. The Sigma rule in §7 above is the starting point.

- **CMMC posture is what funds defensive depth in small DIB subcontractors.** Polaris is not Sony or Target — Polaris is a ~$80M-revenue defense subcontractor whose security budget exists primarily because losing CMMC certification would end their ability to bid on contracts. The audit-log program that surfaced both of today's findings is paid for by the regulatory floor. That floor matters more in DIB environments than in any other vertical; the regulatory mechanism is what closes the gap between "we technically have the controls" and "we operate the controls."

- **The audit infrastructure that catches a CUI-exfil insider is the same audit infrastructure that catches an exhausted IR responder's typo.** The system doesn't know the difference between a malicious actor and a process failure. Both findings landed in the same log file in the same engagement. Both got remediation. The lesson for IR teams: the audit log is not just a tool you use against attackers, it's a record of YOUR behavior too, and the discipline of treating it as both is what makes the institution healthier over time.

- **For DIB and other DFARS-bound environments specifically**, the 72-hour DC3 reporting clock starts at *discovery* of the CUI compromise, not at the original badge event. Discovery here is when Dana receives this engagement's report. The clock-management lesson: forensic engagements that confirm CUI exposure should be timed in coordination with General Counsel, because the discovery moment is also the notification-clock-start moment. Don't surprise the client.

- **Chain of custody is what makes the finding admissible.** Sign and hash `Security.evtx` at receipt. Preserve the original alongside any working copies. Document every tool you ran against it. The forensic finding has to survive cross-examination if Reed's case develops into a federal criminal proceeding under 18 U.S.C. § 1832 (theft of trade secrets) or § 1030 (Computer Fraud and Abuse Act). The procedural discipline you applied during this engagement is what protects both the institution and — perversely — the subject, by ensuring that whatever consequence follows is supported by evidence that was handled correctly.

- **The narrow lesson: read the failed-logon events.** Most SIEM dashboards aggregate 4625s into a count by hour and alert only on high-volume spikes (brute-force signal). Real-world findings — typo'd credentials, sprayed-username reconnaissance, abandoned-account probes — live in the *low-volume* 4625 traffic that the count-based alerting ignores. Make a habit of reading the 4625 stream by hand once a week if you don't have detection content for the long tail. The investment is small; the asymmetric upside is large.

## §9 — Further reading

*Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs, NIST publication revision status, historical-case figures) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^nist-800-53]: [NIST SP 800-53 Rev. 5 — Security and Privacy Controls for Information Systems and Organizations](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). Published September 2020; Revision 5 Update 1 published December 2023. AU family is in chapter 3.3.
[^nist-800-92]: [NIST SP 800-92 — Guide to Computer Security Log Management](https://csrc.nist.gov/pubs/sp/800/92/final).
[^nist-800-171]: [NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information](https://csrc.nist.gov/pubs/sp/800/171/r3/final). Published May 2024 (Final). §3.3 is the AU family.
[^dfars-252-204-7012-safeguarding]: [DFARS 252.204-7012 — Safeguarding Covered Defense Information and Cyber Incident Reporting](https://www.ecfr.gov/current/title-48/chapter-2/subchapter-H/part-252/subpart-252.2/section-252.204-7012.). The (c) paragraph defines the 72-hour reporting clock to DoD; the (e) paragraph requires 90-day media preservation post-incident.
[^cfr-32-117]: [NISPOM (32 CFR Part 117) — National Industrial Security Program Operating Manual](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117). §117.8 covers reporting and investigative authorities for cleared contractors.
[^cwe-532]: [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html). The defender-side mapping of the 4625 typed-password finding.
[^cwe-117]: [CWE-117: Improper Output Neutralization for Logs](https://cwe.mitre.org/data/definitions/117.html). Adjacent; covers log-injection.
[^cwe-200]: [CWE-200: Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html). Parent of CWE-532. Note: CWE-200's mapping status is currently **Discouraged** — cite CWE-532 for direct mappings.
[^t1078]: [MITRE ATT&CK T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
[^t1083]: [MITRE ATT&CK T1083 — File and Directory Discovery](https://attack.mitre.org/techniques/T1083/).
[^t1560-001]: [MITRE ATT&CK T1560.001 — Archive Collected Data: Archive via Utility](https://attack.mitre.org/techniques/T1560/001/).
[^t1027]: [MITRE ATT&CK T1027 — Obfuscated Files or Information](https://attack.mitre.org/techniques/T1027/).
[^t1059-001]: [MITRE ATT&CK T1059.001 — Command and Scripting Interpreter: PowerShell](https://attack.mitre.org/techniques/T1059/001/).
[^t1059-003]: [MITRE ATT&CK T1059.003 — Command and Scripting Interpreter: Windows Command Shell](https://attack.mitre.org/techniques/T1059/003/).
[^t1567-002]: [MITRE ATT&CK T1567.002 — Exfiltration Over Web Service: Exfiltration to Cloud Storage](https://attack.mitre.org/techniques/T1567/002/).
[^event-4624]: [Event 4624 (Logon)](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4624).
[^event-4625]: [Event 4625 (Failed Logon)](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4625). The reference for SubStatus codes including 0xC0000064 / 0xC000006A.
[^event-4663]: [Event 4663 (Object Access)](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4663).
[^event-4688]: [Event 4688 (Process Creation)](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/event-4688). Includes the command-line capture setting.
[^windows-event-forwarding-for-intrusion]: [Windows Event Forwarding for Intrusion Detection](https://learn.microsoft.com/en-us/windows/security/operating-system-security/device-management/use-windows-event-forwarding-to-assist-in-intrusion-detection).
[^swiftonsecurity-sysmon-config]: [SwiftOnSecurity Sysmon config](https://github.com/SwiftOnSecurity/sysmon-config). Practitioner-default starter configuration.
[^olaf-hartong-s-sysmon-modular]: [Olaf Hartong's sysmon-modular](https://github.com/olafhartong/sysmon-modular). Modular alternative.
[^hayabusa]: [Hayabusa](https://github.com/Yamato-Security/hayabusa). Yamato Security's threat-hunting tool with built-in Sigma rules.
[^chainsaw]: [Chainsaw](https://github.com/WithSecureLabs/chainsaw). WithSecure Labs' .evtx search tool.
[^target-2013-breach-senate-commerce]: [Target 2013 breach — Senate Commerce Committee report (March 2014)](https://www.commerce.senate.gov/wp-content/uploads/media/doc/2014%200325%20Target%20Kill%20Chain%20Analysis.pdf). Includes process-creation timeline pulled from Windows event logs.
[^sony-pictures-2014-fbi-update]: [Sony Pictures 2014 — FBI update (December 2014)](https://www.fbi.gov/news/press-releases/update-on-sony-investigation). Cites WIPALL anti-forensic event-log destruction.
[^mandiant-sunburst-writeup-december-2020]: [Mandiant SUNBURST writeup (December 2020)](https://cloud.google.com/blog/topics/threat-intelligence/sunburst-additional-technical-details/). Event-log forensics is a primary detection mechanism. (Mandiant content moved to Google Cloud post-acquisition; original `mandiant.com/resources/blog/...` URL redirects here.)
[^twitter-incident-report-july-2020]: [Twitter incident report (July 2020)](https://blog.x.com/en_us/topics/company/2020/an-update-on-our-security-incident). Reconstruction from internal audit logs. (Twitter blog migrated to X; original `blog.twitter.com/...` URL redirects here.)
[^sans-dfir-blog]: [SANS DFIR blog](https://www.sans.org/blog/?focus-area=digital-forensics). Long-running practitioner archive; many posts on event-log analysis patterns including the 4625 typed-password category.
[^13cubed-youtube-channel]: [13Cubed YouTube channel](https://www.youtube.com/@13cubed). Practitioner-friendly Windows forensics videos including event-log walkthroughs.
[^roberto-rodriguez-cyb3rward0g-helk-mordor]: [Roberto Rodriguez (Cyb3rWard0g) — HELK, Mordor, OSSEM projects](https://github.com/Cyb3rWard0g). Threat-hunting infrastructure and adversary-emulation datasets including 4625 anomaly detection content.
[^eric-zimmerman-blog]: [Eric Zimmerman blog](https://ericzimmerman.github.io/). Author of the EZ Tools forensics suite.

### Further reading

- [Original 2006 publication; Revision 1 Initial Public Draft published October 11, 2023, public comment closed November 29, 2023, no Final as of May 2026. IPD landing page at](https://csrc.nist.gov/pubs/sp/800/92/r1/ipd).
- [NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final). 2006 publication, still the canonical NIST forensics reference.
- [CMMC Final Rule (32 CFR Part 170)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-G/part-170).
- [The 2024 final rule codifying CMMC into regulation. CMMC Assessment Guide at](https://dodcio.defense.gov/CMMC/).
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls). Control 8 (Audit Log Management) is the relevant family.
- [MITRE D3FEND](https://d3fend.mitre.org/). Defender-side technique taxonomy; the complement to ATT&CK for blue-team work.
- [Advanced Security Audit Policy Settings](https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/advanced-security-audit-policy-settings). The full reference for Windows audit policy subcategories.
- [LOLBAS Project](https://lolbas-project.github.io/).
- [The catalog of Living-Off-The-Land binaries. certutil entry at](https://lolbas-project.github.io/lolbas/Binaries/Certutil/).
- [Sigma rules](https://sigmahq.io/).
- [The portable SIEM detection-rule format. SigmaHQ public ruleset at](https://github.com/SigmaHQ/sigma).
- [Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon). Microsoft Sysinternals' extended event source for Windows.
- [EvtxECmd (Eric Zimmerman's EZ Tools)](https://ericzimmerman.github.io/). The reference offline .evtx parser.
- [KAPE](https://www.kroll.com/en/publications/cyber/kroll-artifact-parser-extractor-kape). Kroll's triage-collection tool.
- [TJX 2007 breach — Krebs on Security long-form retrospective](https://krebsonsecurity.com/?s=TJX). Brian Krebs's archive of TJX-related posts covers the breach timeline and post-incident forensic findings; the original Senate Permanent Subcommittee on Investigations hearing record at the CHRG-110shrg45225 identifier is no longer reachable via govinfo.
- [OPM 2015 — House Oversight Committee report](https://oversight.house.gov/wp-content/uploads/2016/09/The-OPM-Data-Breach-How-the-Government-Jeopardized-Our-National-Security-for-More-than-a-Generation.pdf). Event-log evidence cited throughout.
