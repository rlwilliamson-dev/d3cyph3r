# level1@forensics — What the Logs Saw

**Track:** Forensics · **Client:** Polaris Defense Systems · **Compliance regime:** CMMC Level 2 + NIST SP 800-171 Rev. 3 + DFARS 252.204-7012 + NISPOM 32 CFR Part 117 · **Builds on:** [`level0@forensics`](/walkthroughs/#/forensics/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@forensics`. If you haven't solved `level1@forensics` yet, close this tab and come back after. The puzzle leans on you noticing one specific anomaly in a sixteen-event log; reading the writeup first removes the moment.

---

## §1 — The setup

When you left `level0@forensics` on Friday morning, the alibi photo had broken Reed Connolly's story open and Dana Reyes had a finding she could take to HR. By Friday afternoon she had gone further. She took the EXIF report to Polaris's General Counsel, the General Counsel called Sgt. Marcus Chen, Polaris's Facility Security Officer, and Chen, acting as FSO rather than as line IT, invoked NISPOM 32 CFR §117.8(c) and escalated the case into the formal Insider Threat Program. Reed's DoD Secret clearance was administratively suspended the same day, his badge was revoked, and he went on paid administrative leave pending the outcome. Textbook. The photo finding crossed the threshold, and the rest of the program did exactly what it is designed to do.

On Tuesday night Polaris's IR team pulled a live forensic image of Reed's primary workstation. Live rather than powered off, because shutting the machine down would have told Reed something was happening; a lit monitor and spinning fans on his desk are part of the social-engineering surface of an insider-threat case, and tipping off the subject before HR has its conversation lined up is how investigations die. The acquisition ran from `IR-JUMPBOX-01` (10.42.7.18) over the workstation's out-of-band management channel, with Sgt. Chen running FTK Imager and Maya Voss, Polaris's IR Team Lead, supervising from the same jumpbox. Acquiring through the management interface keeps the machine's running state, leaves its console untouched, and, crucially for chain of custody, produces its own audit trail proving nobody touched the keyboard during the acquisition.

The image arrived as an EnCase E01 split set, eight segments and ~480 GB in total, inside a single-use password-protected archive. Chen generated the handoff password specifically for this case, `POL-IIS-2026-0007-handoff`, and that is what let you into this shell. The archive password and the triage-workspace password are the same value on purpose. Single-use means it is rotated and destroyed when the engagement closes, and gating evidence custody with somebody's everyday sysadmin password is precisely the cross-contamination forensic procedure exists to prevent. (It is also the breadcrumb from the end of `level0@forensics`'s `case-summary.txt`, exactly where you found it.)

Today's task is narrow. Polaris IT extracted the Windows Security event log, `C:\Windows\System32\winevt\Logs\Security.evtx` (the same path on every Windows host since Vista), and dropped it in this working directory; the rest of the image sits on a separate analysis volume, out of scope. Dana wants two things by COB Wednesday: a reconstruction of Reed's Saturday-morning activity inside the OS during the 13:42-15:18 UTC (09:42-11:18 EDT) badge window, and anything else the IR team needs to know. Priya's hand-off note in `engagement-notes.md` hints at that second item, *"there's a finding in the IR-team activity from Tuesday night that I noticed during my own walkthrough of the file. It's not the Reed case directly, but it IS something Polaris needs to know about"*, and spotting a fatigue mistake in an audit log is exactly what separates a forensic engagement from a transactional log review.

You are `secops` on Driftwood's forensics-triage workstation again, same shared account, same machine as `level0@forensics`. That continuity is deliberate; a small defense contractor's forensic capacity lives on one hardened triage host, and the engagement keeps you in the same chair. The legal frame has not softened either. DFARS 252.204-7012(c) starts a 72-hour reporting clock to the DoD Cyber Crime Center (DC3) the moment "compromise of covered defense information" is discovered.[^dfars-252-204-7012-safeguarding] The CUI on Reed's machine (subsystem-A schematics, the BOM, fab process notes) meets that definition, and Polaris's moment of discovery is when Dana receives your report. In other words, the clock starts when you press send. Sgt. Chen has the DIBNET portal credentials ready, so agree the timing with the client first.

## §2 — The solve

Sixteen events, four Event IDs worth caring about, two findings to pull out. The path is short, and it rewards one habit above all: filter before you read.

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

That is the single-use handoff password Sgt. Chen set on the archive. The same string gates the archive and this workspace by design, and the lessons-learned file explains why.

### Step 2: Read the engagement files

```bash
secops@forensics:~$ ls
Security.evtx        engagement-notes.md   welcome.md
case-summary.txt     lessons-learned.md
```

Five files. `welcome.md` covers mechanics: the new `evtx` command and the common Security-channel Event IDs (4624 successful logon, 4625 failed logon, 4634 logoff, 4663 object access, 4688 process creation).[^event-4624][^event-4625][^event-4663][^event-4688] `engagement-notes.md` is Priya's day-two update: what happened between Friday and Tuesday, what Dana wants, and that hint about a "second finding". `case-summary.txt` is the formal case file, with subject metadata, the acquisition's chain of custody (FTK Imager v4.7.1.2, live acquisition over OOB management, EnCase E01 split, single-use handoff password, hash placeholder) and Driftwood's explicit task: *(1)* reconstruct Reed's activity inside the OS during the badge window, *(2)* identify CUI access or exfiltration, *(3)* flag anything else.

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

Sixteen events across four days, and the timestamps alone split them into two activity windows:

- **2026-03-14 13:42-15:18 UTC** (Saturday morning EDT 09:42-11:18). Reed's badge window
- **2026-03-18 02:47-06:14 UTC** (Tuesday night EDT 22:47-Wednesday 02:14). IR team's triage

Eleven events in the first window, five in the second. Easy to tell apart by date, and very important not to blur in the write-up. Dana's question is about Reed.

### Step 4: Filter to logon events

Start with authentication. Logons tell you who was where, when, and from where, and everything else hangs off that scaffolding.

```bash
secops@forensics:~$ evtx -id 4624 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4624: 3 matches)
```

Three successful logons:

1. **Reed, Saturday 13:42 UTC, LogonType 2 (Interactive)**: the workstation console, `TargetUserName: rconnolly`, `WorkstationName: POL-WS-0418`, source IP 127.0.0.1. He sat down at his own keyboard.
2. **`lchen`, 02:47 UTC Wednesday (Tuesday night EDT), LogonType 10 (RemoteInteractive)**: an RDP session from `IR-JUMPBOX-01`, source IP 10.42.7.18. Chen logging in to run the imaging.
3. **`mvoss`, 03:02 UTC Wednesday, LogonType 3 (Network)**: network resource access from the same `IR-JUMPBOX-01` / 10.42.7.18.

Reed's interactive logon is exactly what you would expect, and the two overnight logons are Chen and Voss doing the acquisition. Nothing anomalous yet. But keep an eye on that third one, `mvoss` at 03:02 UTC.

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

1. **`SubStatus: 0xC0000064`, STATUS_NO_SUCH_USER.** Windows logged this because the typed "username" does not exist in the directory. Its sibling, `0xC000006A` (STATUS_WRONG_PASSWORD), is what you see when the username is real and the password is wrong. The difference matters: `0xC0000064` means Windows could not find an account by that name at all.

2. **`TargetUserName: P0l4r1s-IR-L3ad-2026!`**. That is not a username. It is mixed case, has digits and a special character (`!`), and runs to 21 characters. Real Polaris usernames are short, lowercase, surname-and-initial: `lchen`, `mvoss`, `rconnolly`. This string is a password.

3. **`WorkstationName: IR-JUMPBOX-01`, `IpAddress: 10.42.7.18`**: the same jumpbox and source IP as the overnight `lchen` and `mvoss` logons. The mistake came from the IR triage.

4. **Timestamp 03:02:14, then `mvoss`'s successful 4624 at 03:02:51 from the same source, 37 seconds later.** Someone fumbled the credential, tried again straight away, and got it right.

The conclusion is uncomfortable and not in doubt. Maya Voss, Polaris's IR Team Lead, supervising Chen's acquisition at about 11pm EDT on a Tuesday, typed her own password into the username field of a network-auth prompt. Windows recorded the typed string verbatim in the 4625 record's `TargetUserName`. So `P0l4r1s-IR-L3ad-2026!` is Voss's credential, sitting in plaintext in an audit log, and that audit log is in your working directory, about to be handed over as evidence. Everyone who will ever review this evidence now has her password.

That is your second finding. It is also the breadcrumb for `level2@forensics`: something the IR team needs to hear about *today* so the password can be rotated, and, for in-game continuity, the IR-team credential whose rotation and recovery become the entry gate for the next engagement.

### Step 6: Filter to process creations — Reed's exfil chain

Now the case Dana actually asked about.

```bash
secops@forensics:~$ evtx -id 4688 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4688: 6 matches)
```

Six process-creation records. Sorted by timestamp:

1. **14:04:18**, `cmd.exe`, parent `explorer.exe`. Reed opens a shell.
2. **14:04:21**, `powershell.exe`, parent `cmd.exe`, with the command line: `Compress-Archive -Path D:\CUI\Subsystem-A\* -DestinationPath C:\Users\rconnolly\AppData\Local\Temp\sa-export.zip -Force`. Reed archives the entire CUI directory into his AppData\Temp.
3. **14:06:44**, `certutil.exe`, parent `cmd.exe`, with `certutil.exe -encode <zip> <b64>`. This is the LOLBin moment. `certutil` is a Microsoft-signed binary meant for certificate management, and its `-encode` and `-decode` subcommands do raw base64. Attackers and insiders use them to hide payloads from content-inspection DLP that looks for file signatures or sensitive keywords. Reed has no legitimate reason to run certutil here. The LOLBAS project (lolbas-project.github.io) catalogues it for exactly this reason: it keeps turning up in real exfil chains.
4. **14:11:55**, `chrome.exe`, parent `explorer.exe`, `--new-window`. Reed opens a browser.
5. **14:42:08**, second `chrome.exe`, parent `chrome.exe`, `--new-tab https://mega.nz/upload`. A new tab pointed at Mega's upload page.

There is the exfil chain: collect (the CUI reads, visible separately under 4663), archive (PowerShell Compress-Archive), encode (certutil base64), upload (Chrome to mega.nz). Valid credentials and Microsoft-signed binaries the whole way. No single process here is anomalous. The *sequence* inside a 38-minute window is the finding.

### Step 7: Filter to file access — what he read

```bash
secops@forensics:~$ evtx -id 4663 Security.evtx
Event log: Security.evtx
Total events: 16   (filtered to ID 4663: 4 matches)
```

Four file-access records: three at the start of the badge window, Reed reading the CUI, and one at the end, certutil writing the encoded blob. The reads:

- **13:48:33**, `D:\CUI\Subsystem-A\subsystem-a-schematics.pdf` (AccessMask 0x1 = ReadData), via Adobe Acrobat Reader.
- **13:51:02**, `D:\CUI\Subsystem-A\subsystem-a-bom.xlsx` (ReadData), via Excel.
- **13:54:18**, `D:\CUI\Subsystem-A\fab-process-notes.docx` (ReadData), via Word.

These are the CUI artifacts, and they match the categories Polaris's CMMC inventory marks as covered defense information: design data, bills of materials, manufacturing process documentation. Once you can name the exact files Reed read, the DFARS 7012 reporting requirement stops being conditional. Polaris has a notifiable incident.

### Step 8: The hand-off

Your report has three sections:

1. **Reed's activity timeline.** Quote Event IDs and UTC timestamps verbatim. The chain on one line: 13:42 logon → 13:48-13:54 CUI reads → 14:04 PowerShell Compress-Archive → 14:06 certutil -encode → 14:42 Chrome upload to mega.nz → 15:18 logoff.
2. **CUI exposure determination.** Yes. Cite the three filenames. Note that Reed's exit timestamp on chrome means his upload window ran for ~36 minutes; without server-side mega.nz cooperation, you cannot confirm successful transfer, but the upload tab was opened and the encoded payload was sitting in `AppData\Local\Temp\` ready to send. Dana's DFARS 7012 clock should start at her receipt of this report.
3. **Other observations.** One paragraph. The 4625 event at 03:02:14 UTC on 2026-03-18 contains a credential in the `TargetUserName` field, consistent with an IR responder typing a password into the wrong field during the live acquisition. The surrounding 4624 records put Voss, the IR Team Lead, on the jumpbox at the time. Recommend immediate rotation of `mvoss` and any service account keyed to that string, plus a SIEM rule for the 4625 + `0xC0000064` + password-shaped `TargetUserName` pattern. Same-week remediation.

Hand it to Dana. Sign and hash `Security.evtx` for chain-of-custody.

## §3 — The vulnerability

One log file, two separate findings, and they could hardly be more different. One is an insider walking out with CUI. The other is the people investigating him leaking a password into the evidence. Both get a CWE and both go in the report.

Reed's exfil chain is the textbook insider-threat case, and as a vulnerability class it is not a flaw in any Polaris system at all. It is a *missing detection*. Every action Reed took was legitimate on its own. He could read `D:\CUI\Subsystem-A` because his role required it. PowerShell is allowed on his workstation because it is a developer machine. Microsoft ships certutil. Chrome is the corporate browser. mega.nz is on the open internet. Nothing was bypassed. Every control assumed valid intent and saw valid intent, and the malicious *combination* never tripped an alert because Polaris has no rule saying "PowerShell Compress-Archive on a CUI directory, then certutil -encode within 5 minutes, then a Chrome tab to mega.nz within 30, is a DLP-evasion exfil pattern." Defenders write that rule *after* a case like this one, which is the lesson the SOC carries back to detection engineering when the case closes. There is no clean CWE for this, because no CWE describes "the right detection wasn't there", and forcing one would mislead. MITRE ATT&CK T1078 (Valid Accounts) describes what happened better: Reed used access he legitimately had. ATT&CK has no CWE counterpart for that, because ATT&CK techniques and CWE weaknesses only partly overlap.[^t1078]

The second finding, the password typed into the username field, maps cleanly: **CWE-532 (Insertion of Sensitive Information into Log File)**.[^cwe-532] It is a *defensive* failure rather than an offensive one. Nothing was exploited and no attacker is involved, but a credential now sits in plaintext inside an audit artifact that will pass through many hands: Polaris IR, Driftwood forensics, Dana's legal team, possibly DCSA if the clearance review wants the underlying evidence, possibly federal prosecutors if the case turns criminal. Every handoff is another place for it to end up. And the fix is rotation, not redaction. Once a credential is preserved in evidence you cannot un-preserve it without breaking chain of custody, so you rotate the live credential and accept that the preserved copy is what it is. A Sigma rule can catch the next occurrence, and the human fix is a short refresher on credential hygiene when tired.

The structural lesson is that Windows event logs record what defenders forget to look at. CMMC AU.L2-3.3.x mandates the audit infrastructure. It does not mandate that anybody read it. Polaris has the logs on, the reviews scheduled, and a vendor who actually opens the files, which is how two findings came out of one log in one engagement. Plenty of CMMC-compliant environments are AU-2 compliant (logs are generated) and AU-12 compliant (rules say what to log) and quietly AU-6 noncompliant in practice, because nothing reviews the logs beyond ingest into a SIEM firing on a handful of stock rules. Reed's chain would not have tripped most default rule sets. The typed password would not have tripped anything. Both findings needed a human reading the log.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | The Security event log from Reed's imaged workstation, `POL-WS-0418` |
| The chain recovered | Archive creation, encoding to text, browser launch, and upload to a consumer file-sharing host, on a Saturday |
| Data class | Controlled Unclassified Information, which is what makes this a DFARS matter rather than an HR one[^dfars-252-204-7012-safeguarding] |
| Second finding | An IR responder's password, typed into the username field and captured verbatim in a failed-logon record |
| Regime | CMMC Level 2, NIST SP 800-171, DFARS 252.204-7012, 72 hours to DoD via DIBNet, with images and logs preserved at least 90 days[^nist-800-171] |

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

Audit logs turn up in real incidents in two roles: as the record that lets investigators say exactly what happened, and as the warning nobody read. A few cases:

**Target (2013).**[^target-2013-breach-senate-commerce] About 40 million payment cards and personal information on up to 70 million customers were taken, and the way in, credentials stolen from a small HVAC contractor, is the famous part. The part that matters here is in the Senate Commerce Committee's kill-chain analysis from March 2014, which relays Bloomberg Businessweek's reporting that Target's FireEye malware-detection system raised alerts as the attackers installed their malware, and that nobody acted on them. The evidence was recorded in time. Nobody read it.

**Sony Pictures (2014).**[^sony-pictures-2014-fbi-update] The FBI's December 2014 update describes an attack that destroyed systems and stole large quantities of data, using data-deletion malware the Bureau linked to North Korean actors. When the machines themselves are wiped, any log that lived only on them goes too. That is the case for forwarding events to a separate collector as they happen, which Microsoft documents as Windows Event Forwarding.[^windows-event-forwarding-for-intrusion]

**Command-line auditing** is the setting that made this level solvable. The "Include command line in process creation events" Group Policy setting, which puts the arguments into 4688 events, arrived with Windows 8.1 and Server 2012 R2.[^event-4688] Without it, a 4688 records *that* `certutil.exe` ran and not *what it was told to do*, which is the difference between an anomaly and a finding. It is now standard advice in security baselines, for the plain reason that too many investigations have stalled on a log that recorded the binary and lost the arguments.

**Twitter (July 2020).**[^twitter-incident-report-july-2020] Attackers phone-phished a small number of employees, used their credentials to reach Twitter's internal support tools, and took over high-profile accounts. About two weeks later Twitter could say exactly what they had done: 130 accounts targeted, Tweets sent from 45, DM inboxes accessed on 36, and the Twitter Data of 7 downloaded. That kind of precision comes from a record of what each support-tool session did, the same kind of record that makes Reed's Saturday reconstructable.

**The password-in-4625 pattern** needs no exotic explanation. Event 4625 records the account name the user tried to log on with, which is simply whatever was typed into the username box.[^event-4625] Type a password one field too early and it is written into the Security log in plaintext, readable by anyone who can read that log. A detection for it is cheap to write: flag failed logons whose username looks like a password rather than an account name.

**The `certutil -encode` pattern** is about as well documented as attacker tradecraft gets. The LOLBAS project, which catalogs the Windows binaries attackers use in place of their own tools, lists certutil's encode function, maps it to ATT&CK's obfuscation technique (T1027), and links the public Sigma, Elastic and Splunk rules that catch it in process-creation logs.[^t1027][^lolbas-certutil] Ready-made detections exist, which is exactly why Polaris not having one is a finding.

What unites these cases is how lopsided the value of audit logs is. They are cheap to generate, cheap to keep at today's storage prices, enormously valuable after the fact, and completely inert until somebody reads them. Polaris is not Sony or Target. It is a small DIB subcontractor whose CMMC obligations happen to fund a SOC, which happens to retain Driftwood, which happens to actually open the file. Every link in that chain had to hold for these findings to surface. This time, it did.

## §5 — Frameworks, deep dive

### NIST SP 800-53 Rev. 5 — Audit and Accountability (AU) family

The federal-control catalog. Rev. 5 was published in September 2020 and is the current revision. The AU family is the most directly relevant control family for this engagement:

- **AU-2 Event Logging**, what events the organization logs. This engagement exists because Polaris's AU-2 baseline includes the Security channel events 4624, 4625, 4634, 4663, and 4688. (Microsoft's default Windows audit policy is narrower; Polaris's CMMC tailoring expanded it.)
- **AU-3 Content of Audit Records** , what fields each record carries. **AU-3(1) Additional Audit Information** is the control enhancement that mandates command-line capture for process-creation events. Without AU-3(1), the 4688 records would not have shown the PowerShell or certutil cmdlines and Reed's exfil chain would have been much harder to reconstruct. Polaris had it enabled; confirm it across the rest of their fleet.
- **AU-6 Audit Record Review, Analysis, and Reporting**, the "actually look at the logs" control. The entire Driftwood engagement is AU-6 working correctly. Most CMMC-compliant environments fail AU-6 in practice (logs are generated but not actively reviewed beyond a handful of pre-built SIEM alerts).
- **AU-9 Protection of Audit Information**, the integrity of audit records. Chain of custody on `Security.evtx` is what makes the finding admissible if Reed's case develops criminal weight. Hash the file, sign the chain-of-custody affidavit, preserve the original alongside any working copies.
- **AU-12 Audit Record Generation**, the rules that govern what produces a record at the system level. The 4663 file-access events on D:\CUI\Subsystem-A exist because Polaris enabled object-access auditing on that volume specifically (Microsoft's default is OFF because of performance overhead).

### NIST SP 800-92 — Guide to Computer Security Log Management

NIST SP 800-92 was originally published in September 2006 and has remained the canonical NIST reference for enterprise log management for nearly two decades.[^nist-800-92] NIST published a Revision 1 Initial Public Draft (IPD) on October 11, 2023 to update the guidance for SIEM/SOAR-era practices, cloud-native log shipping, and the contemporary tooling landscape; public comment closed November 29, 2023. As of the May 2026 review date, Rev. 1 has **not** been finalized. NIST is still processing comments, with no Final Public Draft (FPD) yet posted. Check the NIST CSRC page (`csrc.nist.gov/pubs/sp/800/92/r1/ipd`) for current revision status before quoting specific section numbers in audit work. Section 3 (Log Management Infrastructure) and Section 5 (Operational Processes) are the most-cited sections for IR practice and remain valid in both the original publication and the in-progress IPD.

### NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response

Originally published 2006 and a co-citation alongside 800-92 in essentially every forensic engagement. Section 5.2 covers data examination including event-log triage; procedurally, it's the formal mapping of what we just did. Cited in both forensic-engagement reports and CMMC assessor guidance.

### NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information in Nonfederal Systems and Organizations

Published May 14, 2024 (Final). The current standard Polaris is audited against. The §03.03 (Audit and Accountability) family inherits directly from 800-53 AU controls, tailored for non-federal systems.[^nist-800-53] Note that Rev. 3 adopted a zero-padded, period-separated numbering scheme (`03.03.01`), distinct from Rev. 2's `3.3.1` style:

- **§03.03.01 Event Logging** ↔ AU-2
- **§03.03.02 Audit Record Content** ↔ AU-3
- **§03.03.05 Audit Record Review, Analysis, and Reporting** ↔ AU-6
- **§03.03.08 Protection of Audit Information** ↔ AU-9

Auditors are still in the transition window; cite Rev. 3 numbers (`§03.03.0x`) but be aware older Polaris artifacts may use Rev. 2's `§3.3.x` style. The CMMC Level 2 practice notation is its own scheme, `AU.L2-3.3.x`, which mirrors the Rev. 2 numbering by historical accident and is separate from the NIST scheme.

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

The DFARS clause that creates the 72-hour reporting clock to DoD (functionally to DC3 / DoD Cyber Crime Center via the DIBNET portal) upon discovery of a cyber incident affecting CUI.[^dfars-252-204-7012-safeguarding] The clause's (c) paragraph defines the reporting requirement; the (e) paragraph requires preservation of media for at least 90 days post-incident, which is why Polaris is sitting on the full E01 image in cold storage even after this engagement closes.

### NISPOM 32 CFR Part 117

The National Industrial Security Program Operating Manual, codified into 32 CFR Part 117 in December 2020 (the formal regulatory codification that replaced DoD 5220.22-M).[^cfr-32-117] NISPOM §117.8 covers reporting and investigative requirements for cleared contractors; §117.8(c) is the specific authority Sgt. Chen invoked to seize Reed's workstation. The Suspicious Contact Report and Adverse Information Report Chen will file with DCSA (Defense Counterintelligence and Security Agency) are NISPOM-mandated.

### CWE / MITRE

- **CWE-532 Insertion of Sensitive Information into Log File**, the typed-password-in-4625 finding.[^cwe-532]
- **CWE-117 Improper Output Neutralization for Logs**, adjacent; covers log-injection rather than passive sensitive-data exposure.[^cwe-117] Cited together with CWE-532 when reviewing log-handling design.
- **CWE-200 Exposure of Sensitive Information to an Unauthorized Actor** , the parent of CWE-532, and the CWE cited in `level0@forensics` for the EXIF metadata finding.[^cwe-200] (CWE-200 itself is now mapping-**Discouraged** in current CWE guidance. MITRE recommends citing the more specific child weakness, which for the typed-password finding is CWE-532.)
- **MITRE ATT&CK T1078 Valid Accounts**. Reed's use of his own valid credentials.[^t1078]
- **MITRE ATT&CK T1083 File and Directory Discovery**, the 4663 CUI reads as deliberate enumeration.[^t1083]
- **MITRE ATT&CK T1560.001 Archive Collected Data: Archive via Utility**, the PowerShell Compress-Archive step.[^t1560-001]
- **MITRE ATT&CK T1027 Obfuscated Files or Information**, the certutil -encode base64 step.[^t1027]
- **MITRE ATT&CK T1059.001 Command and Scripting Interpreter: PowerShell**, the cmdline.[^t1059-001]
- **MITRE ATT&CK T1059.003 Command and Scripting Interpreter: Windows Command Shell**, the cmd.exe parent.[^t1059-003]
- **MITRE ATT&CK T1567.002 Exfiltration Over Web Service: Exfiltration to Cloud Storage**, the chrome → mega.nz tab.[^t1567-002]

### Microsoft documentation

The "Audit Logon" and "Audit Failed Logons" subcategories of the Advanced Audit Policy. The 4624 / 4625 / 4634 split, LogonType meanings (2 Interactive, 3 Network, 4 Batch, 5 Service, 7 Unlock, 8 NetworkCleartext, 9 NewCredentials, 10 RemoteInteractive, 11 CachedInteractive), and SubStatus codes (0xC0000064 / 0xC000006A / 0xC0000234 / 0xC0000072 / 0xC0000071) are documented at learn.microsoft.com under `windows/security/threat-protection/auditing/`. The same reference covers 4663 object access and 4688 process creation in depth.

### LOLBAS Project

The Living Off The Land Binaries, Scripts and Libraries project (lolbas-project.github.io) catalogs ~200 Windows-shipped binaries with dual-use potential. certutil.exe with its -encode/-decode subcommands is one of the founding entries; the project page documents the specific cmdline patterns and the MITRE ATT&CK techniques they map to. The LOLBAS project complements MITRE ATT&CK's technique catalog with binary-level specificity.

### Sigma — SIEM-portable detection rule format

The Sigma project (sigmahq.io) defines a YAML-based detection-rule format that compiles down to platform-specific SIEM queries (Splunk SPL, Elastic ESQL, Microsoft Sentinel KQL, Chronicle YARA-L, etc.). The defensive recommendation in §7 below is written in Sigma syntax. The SigmaHQ public ruleset (github.com/SigmaHQ/sigma) ships pre-built detection rules for many of the patterns this engagement surfaced; check it before writing new content from scratch.

## §6 — Cert exam relevance

Windows event-log forensics is core curriculum across the IR and DFIR certifications, and it turns up in SOC-analyst, blue-team and cleared-environment certs too. If you are studying for any of these, the Event IDs in this level are worth knowing cold.

### GIAC GCFE — Certified Forensic Examiner

The Windows-forensics-on-disk specialist cert.[^cert-gcfe] Security.evtx structure and analysis is core content, both the binary EVTX format (XML-typed records, channels, providers) and the analytical patterns (logon-type taxonomy, sub-status codes, process-tree reconstruction). Feeds from SANS FOR500 (Windows Forensic Analysis), which is the most direct training-path course for what we just did. GCFE is typically the first DFIR cert practitioners earn.

### GIAC GCFA — Certified Forensic Analyst

The deeper IR/forensics cert.[^cert-gcfa] Event-log analysis at timeline-reconstruction scale, file-system forensics (MFT, USN journal, $LogFile), memory forensics (Volatility, Rekall). Feeds from SANS FOR508 (Advanced Incident Response, Threat Hunting and Digital Forensics). GCFA is the cert you'd typically pursue after GCFE if your role centers on IR rather than e-discovery or expert-witness testimony.

### GIAC GCIH — Certified Incident Handler

The enterprise-IR cert.[^cert-gcih] Less forensics-deep, more incident-process-broad. Detection-engineering coverage of event-log monitoring lives here, the rule that would catch the 4625 typed-password pattern is the kind of content GCIH covers. Feeds from SANS SEC504 (Hacker Tools, Techniques, and Incident Handling).

### GIAC GCDA — Certified Detection Analyst

The SOC and SIEM side: detection engineering, log pipeline design, threat hunting in event-log data, Sigma rules. It pairs with SANS SEC555 (now "Detection Engineering and SIEM Analytics", previously "SIEM with Tactical Analytics"). GCDA is the natural pursuit for someone who wants to build the detection content rather than respond to its alerts.

### CompTIA CySA+ (CS0-003 / CS0-004)

CySA+ is the broad SOC-analyst credential.[^cert-cysa] CS0-003 was the current exam revision as of the May 2026 review date, **with CS0-004 launched on 23 June 2026**. CS0-003 retires 22 December 2026, so by the time anyone reads this much past the review date, CS0-004 will be the only sittable version. Domain 1 (Security Operations) covers log analysis and SIEM correlation; Domain 3 (Incident Response and Management) covers forensic analysis including event logs. CySA+ is a non-vendor cert; it's lighter than GIAC but cheaper and more broadly recognized at entry-to-mid SOC roles.

### ISC2 CISSP

The Common Body of Knowledge cert.[^cert-cissp] Domain 7 (Security Operations) includes "Conduct logging and monitoring activities" and "Conduct investigations", both procedural-side coverage of what we just did. CISSP is conceptual rather than hands-on; you'd cite it as the framework cert, not the practical one.

### Microsoft SC-200 — Security Operations Analyst Associate

The Microsoft-native SOC cert. Microsoft Sentinel KQL queries, Microsoft Defender XDR investigation, Azure Monitor logs. The SC-200 exam covers analysis of the same Security-channel event IDs we triaged today, but in the Sentinel-pipeline context rather than at the raw .evtx level. SC-200 is the cert path for analysts in Microsoft-stack-heavy environments.

### EC-Council CHFI — Computer Hacking Forensic Investigator

Module 13 (Windows Forensics) covers event logs in depth, both the binary EVTX format and the analytical patterns.[^cert-chfi] CHFI is a whole-cert forensics credential, generally considered weaker than GCFE/GCFA in the DFIR community but holds federal-recognition status (DoD 8570 / 8140 baseline cert for IAT/IAM/CSSP roles) that GCFE/GCFA don't.

## §7 — What a defender does

Two parallel remediation tracks, plus the longer-arc audit-log-program improvements.

### For the Reed case specifically

Hand Dana the timeline with verbatim event IDs and UTC timestamps. She will cite them to General Counsel and (when the DFARS clock starts at her receipt) to DC3 via the DIBNET portal.[^dfars-252-204-7012-safeguarding] Do not speculate in the report about Reed's intent, the events show what happened, intent is Dana's call to make with HR, legal, and DCSA in the loop. Sign and hash `Security.evtx` as part of the chain-of-custody package; the hash you compute now is what proves the log wasn't altered between acquisition and any eventual proceeding.

Polaris IT's parallel containment work: rotate Reed's account credentials (already initiated under Friday's escalation), revoke his M365 / VPN tokens, audit any external systems his account touched between 2026-03-14 and 2026-03-20. Clean up `C:\Users\rconnolly\AppData\Local\Temp\sa-export.zip` and `sa-export.b64` from the workstation image's source path on Polaris's file servers (the live workstation is offline pending the formal investigation; the file artifacts on it are evidence-preserved on the E01).

### For the IR-team credential leak

Same-day rotation of `mvoss`'s password and any service account that credential string is keyed to. Same-day means before the audit-log file leaves Polaris's direct control on its way to any downstream handler. The credential preserved in the 4625 record is what it is, chain of custody prevents retroactive redaction, but the *live* credential it represents can and must be rotated immediately.

Add a SIEM detection rule for the pattern going forward. The Sigma rule is straightforward:

```yaml
title: Credential Disclosure in 4625 TargetUserName
id: pol-ir-4625-typed-password-v1
description: |
  Detects 4625 failed-logon events where SubStatus is 0xC0000064
  (no such user) and TargetUserName does NOT look like a normal
  username, i.e. contains symbols, mixed case + digits, or is
  unusually long. Typical signature of a password typed into the
  username field by mistake.
status: experimental
references:
  - https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4625
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

Light retraining for the IR team on credential hygiene under fatigue. Frame it as "the audit caught us this time" rather than punitive, this is a humans-get-tired-at-11pm finding, not a careless-individual finding. The remediation language matters: a punitive frame teaches IR responders to be defensive about audit-log review, which is exactly the opposite of what you want when the audit-log review is the control that protects the institution.

### For Polaris's longer-arc audit-log program

Confirm command-line auditing is enabled across the fleet via Group Policy (`Computer Configuration → Policies → Administrative Templates → System → Audit Process Creation → "Include command line in process creation events"`). Without this setting, the 4688 events would not carry the PowerShell or certutil command lines and Reed's exfil chain would have been substantially harder to reconstruct. Polaris had it enabled on POL-WS-0418; confirm it across the rest of the CUI-handling fleet.

Confirm 4663 file-access auditing is enabled on D:\CUI\ and equivalent CUI-handling volumes (Microsoft's default is OFF because of performance overhead; most environments enable it selectively on sensitive volumes only). Polaris had it on for the CUI volume on POL-WS-0418; that's why Reed's reads showed up. Audit the rest of the fleet for parity.

Deploy Sysmon (sysinternals.com) to extend native audit categories with richer process-tree visibility. Sysmon's Event ID 1 (process creation) includes parent process hash, image hash, and per-process full command line regardless of GPO setting. Sysmon Event ID 11 (file create) is more granular than the native 4663. For a CUI-handling environment, Sysmon is essentially free additional fidelity. The SwiftOnSecurity Sysmon configuration (github.com/SwiftOnSecurity/sysmon-config) is the practitioner-default starter config; Olaf Hartong's modular Sysmon config (github.com/olafhartong/sysmon-modular) is a more recent alternative.[^swiftonsecurity-sysmon-config][^olaf-hartong-s-sysmon-modular]

For aggregation: ship Security.evtx and Sysmon logs via Windows Event Forwarding (WEF) to a central collector, then ingest into the SIEM. Microsoft's documentation at `learn.microsoft.com/windows/security/operating-system-security/device-management/use-windows-event-forwarding-to-assist-in-intrusion-detection` covers the WEF setup. For analysis, the canonical practitioner-tool stack is:

- **EvtxECmd** (ericzimmerman.github.io). Eric Zimmerman's EZ Tools command-line .evtx parser.[^eric-zimmerman-blog] The go-to for offline triage.
- **Hayabusa** (github.com/Yamato-Security/hayabusa). Yamato Security's threat-hunting tool that ships with thousands of pre-built detection rules in Sigma format, applied to .evtx files in bulk.[^hayabusa]
- **Chainsaw** (github.com/WithSecureOpenSource/chainsaw). WithSecure Labs' tool that searches .evtx files using YAML detection rules.[^chainsaw] Often used alongside Hayabusa for cross-validation.
- **KAPE** (kape.kroll.com). Kroll Artifact Parser and Extractor; a triage-collection tool that pulls a curated set of forensic artifacts from a running system, including the Security log and a long list of supporting artifacts.

### For DFARS 7012 reporting

Dana coordinates with General Counsel on DC3 notification timing. The 72-hour clock is real and missing it is a contractual non-compliance event. The DIBNET portal (dibnet.dod.mil) is where the report files; Polaris's FSO has the credentials. The reporting form requires specific facts (the affected system, the timeline, the artifacts), your timeline write-up is what Dana hands the FSO to populate the form.

### The same evidence on macOS and Linux

This case is a Windows workstation, so the artefacts are Windows
artefacts. The reason to know the other two is that the *question* does
not change when the endpoint does, and a DFIR analyst handed a Mac gets
asked for the same timeline.

| Windows (this case) | macOS | Linux |
| --- | --- | --- |
| `Security.evtx`, read by event ID: 4624 successful logon, 4625 failed logon | The unified log, queried with `log show` and a predicate. It is a ring buffer rather than a file you seize, which changes acquisition: collect early, because it rolls[^apple-unified-logging] | `/var/log/auth.log` on Debian-family systems, or `journalctl -u sshd` where logging is journald-native |
| Logon type distinguishes interactive from network from service | The authorisation subsystem records the equivalent distinction, though not as a single tidy numeric field | `sshd` names the method in the message text; `pam` records the rest |
| The file is the evidence: hash it, and the hash proves it was not altered | Export to a file first, then hash. The thing you hash is your extract, not the source, and your notes must say so | Same as macOS where journald is in play; `auth.log` can be hashed directly |

The middle column carries a real chain-of-custody consequence and it is
the one people get wrong. An `.evtx` file is a discrete object you can
seize and hash. macOS's unified log is not: you hash an export you
produced, which means your report has to record the query, the time, and
the tool, or the number proves nothing about the system.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command pattern, `progress --detail` lists what you've unlocked.

### certutil as a LOLBin

**Trigger:** `evtx -id 4688 Security.evtx` (a natural filter for any process-creation investigation; the bonus fires when the 4688 chain surfaces)

**What it teaches:** Reed's 4688 process-creation chain includes `certutil.exe -encode`, a Microsoft-shipped binary whose dual-use potential makes it one of the founding entries on the [LOLBAS Project](https://lolbas-project.github.io/) (Living Off the Land Binaries and Scripts). The signal isn't *that certutil ran*; it's that **certutil ran via cmd.exe with `-encode` arguments by a user who has no certificate-management reason to invoke it.**

The LOLBin pattern matters for three reasons:

1. **AV/EDR signature rules don't flag it.** certutil.exe is signed by Microsoft. Its hash matches the Windows install. Every signature-based detection treats it as legitimate. The attack pattern is the *combination* of legitimate binary + suspicious argument usage, not the binary itself.
2. **Forensic timelines look "normal" at a glance.** A 4688 event for certutil.exe looks like routine certificate operations to an analyst who isn't paying attention to the command-line arguments. The argument string is where the signal lives.
3. **Defender response is behavioral rules, not signatures.** Sigma, Velociraptor, ATT&CK-aligned hunt queries, these are how teams catch LOLBin patterns. Reed's specific sequence (cmd.exe → certutil.exe -encode → outbound to a non-Polaris domain) is detectable via behavioral rules that look at the parent-child process chain and the argument string.

The canonical LOLBin references for the Polaris IR team to add to their hunting library:

- **[LOLBAS Project](https://lolbas-project.github.io/)**, the community-maintained catalog of Windows binaries with documented dual-use potential. certutil, bitsadmin, mshta, rundll32, wmic, regsvr32, msbuild, installutil, powershell, and ~50 others.
- **[Sigma Rules Repository](https://github.com/SigmaHQ/sigma)**, open-source signature-format detection rules. The certutil-encode-with-suspicious-args pattern is well-covered in `rules/windows/process_creation/proc_creation_win_certutil_*.yml`.
- **[MITRE ATT&CK T1140, Deobfuscate/Decode Files or Information](https://attack.mitre.org/techniques/T1140/)**, the mirror image of Reed's step. Reed *encoded* (T1027); T1140 covers certutil's `-decode` side, which is how a payload hidden that way gets turned back into a file at the other end. Polaris's ATT&CK-aligned detection coverage should name certutil under both.

For Polaris's IR runbook: a behavioral rule that fires on "certutil.exe with `-encode` argument by any user in the manufacturing-engineering OU" would have caught Reed's encoding step in near real-time. Add to the hunting library.

## §8 — Key takeaways

- **Event logs catch what defenders forget to look at, but only if somebody looks.** CMMC AU.L2-3.3.x mandates the audit infrastructure and says nothing about anyone reading it. Plenty of CMMC-compliant shops are AU-2/AU-12 compliant (logs generated) and AU-6 noncompliant in practice (logs never reviewed). Polaris's CMMC posture funded its SOC, the SOC funded Driftwood's retainer, and this engagement happened because that whole chain held. None of it is automatic.

- **Reed's chain looked legitimate at every single step.** Valid credentials, Microsoft-signed binaries, and PowerShell, certutil and Chrome all permitted by default. The *combination* is the case: Compress-Archive of a CUI directory, then certutil -encode, then Chrome to mega.nz. The correlation rule that would have caught it is exactly the kind SOCs write after incidents like this, because detection engineering is reactive by nature, and the rule that comes back to the library is the investigation's most durable output.

- **`certutil -encode` is a textbook LOLBin.** It is documented in the LOLBAS project and in MITRE ATT&CK T1027, and public detection rules for it already exist. If your environment has no detection for certutil with encode or decode flags, that is about the easiest detection-engineering win available to a SOC under CMMC, PCI-DSS or any other audit-driven regime.

- **A password typed into the username field is a real finding category, not a thought experiment.** The signature is SubStatus 0xC0000064 (STATUS_NO_SUCH_USER) plus a `TargetUserName` that looks like a password: mixed case, digits, symbols, longer than a real username. Most SIEMs do not ship this detection out of the box; SOCs add it after finding one themselves or hearing about someone else's. The Sigma rule in §7 is a starting point.

- **In small DIB subcontractors, CMMC is what pays for defence in depth.** Polaris is not Sony or Target. It is a ~$80M-revenue subcontractor whose security budget exists mostly because losing CMMC certification would end its ability to bid. The audit-log program that surfaced both of today's findings is paid for by that regulatory floor, which is what turns "we technically have the controls" into "we actually run them."

- **The log that catches an insider stealing CUI also catches an exhausted responder's typo.** It cannot tell a malicious actor from a process failure, and it should not. Both findings came from the same file in the same engagement and both got remediated. For IR teams the lesson is a little humbling: the audit log is a tool you use on attackers, and it is also a record of *you*.

- **For DIB and other DFARS-bound environments specifically**, the 72-hour DC3 reporting clock starts at *discovery* of the CUI compromise, not at the original badge event. Discovery here is when Dana receives this engagement's report. The clock-management lesson: forensic engagements that confirm CUI exposure should be timed in coordination with General Counsel, because the discovery moment is also the notification-clock-start moment. Don't surprise the client.

- **Chain of custody is what makes the finding admissible.** Sign and hash `Security.evtx` on receipt, keep the original alongside any working copies, and record every tool you ran against it. If Reed's case becomes a federal prosecution under 18 U.S.C. § 1832 (theft of trade secrets) or § 1030 (the Computer Fraud and Abuse Act), the finding has to survive cross-examination. That discipline protects the institution and, a little perversely, the subject too, by making sure whatever happens to him rests on evidence handled correctly.

- **Read the failed-logon events.** Most SIEM dashboards roll 4625s up into an hourly count and alert only on brute-force spikes. The interesting findings (typed credentials, sprayed-username reconnaissance, probes against abandoned accounts) live in the *low-volume* 4625 traffic that count-based alerting ignores. If you have no detection for that long tail, read the 4625 stream by hand once a week. It costs very little, and occasionally it hands you a password.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs, NIST publication revision status, historical-case figures) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

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
[^lolbas-certutil]: [LOLBAS: Certutil.exe](https://lolbas-project.github.io/lolbas/Binaries/Certutil/). Encode and decode functions with their ATT&CK mappings, and links to public Sigma, Elastic and Splunk detections.
[^t1059-001]: [MITRE ATT&CK T1059.001 — Command and Scripting Interpreter: PowerShell](https://attack.mitre.org/techniques/T1059/001/).
[^t1059-003]: [MITRE ATT&CK T1059.003 — Command and Scripting Interpreter: Windows Command Shell](https://attack.mitre.org/techniques/T1059/003/).
[^t1567-002]: [MITRE ATT&CK T1567.002 — Exfiltration Over Web Service: Exfiltration to Cloud Storage](https://attack.mitre.org/techniques/T1567/002/).
[^event-4624]: [Event 4624 (Logon)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4624).
[^event-4625]: [Event 4625 (Failed Logon)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4625). The reference for SubStatus codes including 0xC0000064 / 0xC000006A.
[^event-4663]: [Event 4663 (Object Access)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4663).
[^event-4688]: [Event 4688 (Process Creation)](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/event-4688). Includes the command-line capture setting.
[^windows-event-forwarding-for-intrusion]: [Windows Event Forwarding for Intrusion Detection](https://learn.microsoft.com/en-us/windows/security/operating-system-security/device-management/use-windows-event-forwarding-to-assist-in-intrusion-detection).
[^swiftonsecurity-sysmon-config]: [SwiftOnSecurity Sysmon config](https://github.com/SwiftOnSecurity/sysmon-config). Practitioner-default starter configuration.
[^olaf-hartong-s-sysmon-modular]: [Olaf Hartong's sysmon-modular](https://github.com/olafhartong/sysmon-modular). Modular alternative.
[^hayabusa]: [Hayabusa](https://github.com/Yamato-Security/hayabusa). Yamato Security's threat-hunting tool with built-in Sigma rules.
[^chainsaw]: [Chainsaw](https://github.com/WithSecureOpenSource/chainsaw). WithSecure Labs' .evtx search tool.
[^target-2013-breach-senate-commerce]: [Target 2013 breach — Senate Commerce Committee report (March 2014)](https://www.commerce.senate.gov/wp-content/uploads/media/doc/2014%200325%20Target%20Kill%20Chain%20Analysis.pdf). Includes process-creation timeline pulled from Windows event logs.
[^sony-pictures-2014-fbi-update]: [Sony Pictures 2014 — FBI update (December 2014)](https://www.fbi.gov/news/press-releases/update-on-sony-investigation). Cites WIPALL anti-forensic event-log destruction.
[^twitter-incident-report-july-2020]: [Twitter incident report (July 2020)](https://blog.x.com/en_us/topics/company/2020/an-update-on-our-security-incident). Reconstruction from internal audit logs. (Twitter blog migrated to X; original `blog.twitter.com/...` URL redirects here.)
[^eric-zimmerman-blog]: [Eric Zimmerman blog](https://ericzimmerman.github.io/). Author of the EZ Tools forensics suite.
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-gcfa]: [GIAC GCFA — Certified Forensic Analyst](https://www.giac.org/certifications/certified-forensic-analyst-gcfa).
[^cert-gcfe]: [GIAC GCFE — Certified Forensic Examiner](https://www.giac.org/certifications/certified-forensic-examiner-gcfe).
[^cert-gcih]: [GIAC GCIH — Certified Incident Handler](https://www.giac.org/certifications/certified-incident-handler-gcih).
[^cert-chfi]: [EC-Council CHFI — Computer Hacking Forensic Investigator](https://www.eccouncil.org/train-certify/computer-hacking-forensic-investigator-chfi-north-america/).
[^apple-unified-logging]: [Logging — Apple Developer Documentation](https://developer.apple.com/documentation/os/logging). The unified logging system, read from the command line with `log`.

### Further reading

- [Mandiant SUNBURST writeup (December 2020)](https://cloud.google.com/blog/topics/threat-intelligence/sunburst-additional-technical-details/). Event-log forensics is a primary detection mechanism. (Mandiant content moved to Google Cloud post-acquisition; original `mandiant.com/resources/blog/...` URL redirects here.)
- [SANS DFIR blog](https://www.sans.org/blog/?focus-area=digital-forensics). Long-running practitioner archive; many posts on event-log analysis patterns including the 4625 typed-password category.
- [13Cubed YouTube channel](https://www.youtube.com/@13cubed). Practitioner-friendly Windows forensics videos including event-log walkthroughs.
- [Roberto Rodriguez (Cyb3rWard0g) — HELK, Mordor, OSSEM projects](https://github.com/Cyb3rWard0g). Threat-hunting infrastructure and adversary-emulation datasets including 4625 anomaly detection content.
- [NIST SP 800-92 Rev. 1 — Cybersecurity Log Management Planning Guide (Initial Public Draft)](https://csrc.nist.gov/pubs/sp/800/92/r1/ipd). Original published 2006; Revision 1 IPD released 11 October 2023, public comment closed 29 November 2023, still no Final as of August 2026.
- [NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final). 2006 publication, still the canonical NIST forensics reference.
- [CMMC Final Rule (32 CFR Part 170)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-G/part-170).
- [CMMC Program final rule — 32 CFR Part 170 (89 FR 83214, 15 October 2024)](https://www.federalregister.gov/documents/2024/10/15/2024-22905/cybersecurity-maturity-model-certification-cmmc-program). Effective 16 December 2024; the DoD CIO CMMC hub carries the Assessment Guides.
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls). Control 8 (Audit Log Management) is the relevant family.
- [MITRE D3FEND](https://d3fend.mitre.org/). Defender-side technique taxonomy; the complement to ATT&CK for blue-team work.
- [Advanced Security Audit Policy Settings](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-10/security/threat-protection/auditing/advanced-security-audit-policy-settings). The full reference for Windows audit policy subcategories.
- [LOLBAS Project](https://lolbas-project.github.io/).
- [Sigma rules](https://sigmahq.io/).
- [SigmaHQ — public rule repository](https://github.com/SigmaHQ/sigma). The portable SIEM detection-rule format.
- [Sysmon](https://learn.microsoft.com/en-us/sysinternals/downloads/sysmon). Microsoft Sysinternals' extended event source for Windows.
- [EvtxECmd (Eric Zimmerman's EZ Tools)](https://ericzimmerman.github.io/). The reference offline .evtx parser.
- [KAPE](https://www.kroll.com/en/publications/cyber/kroll-artifact-parser-extractor-kape). Kroll's triage-collection tool.
- [TJX 2007 breach — Krebs on Security long-form retrospective](https://krebsonsecurity.com/?s=TJX). Brian Krebs's archive of TJX-related posts covers the breach timeline and post-incident forensic findings; the original Senate Permanent Subcommittee on Investigations hearing record at the CHRG-110shrg45225 identifier is no longer reachable via govinfo.
- [OPM 2015 — House Oversight Committee report](https://oversight.house.gov/wp-content/uploads/2016/09/The-OPM-Data-Breach-How-the-Government-Jeopardized-Our-National-Security-for-More-than-a-Generation.pdf). Event-log evidence cited throughout.
