# level3@forensics — What Reed's Mail Proved

**Track:** Forensics · **Client:** Polaris Defense Systems (continued) · **Compliance regime:** CMMC / NIST SP 800-171

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level4@forensics`. If you haven't solved `level3@forensics` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough assumes you've worked through `level0@forensics` through `level2@forensics`; this level continues their narrative directly.

---

## §1 — The setup

Day four of the Reed Connolly case at Polaris Defense Systems. Yesterday you queried the browser artifacts recovered from Reed's seized workstation and found an authenticated session cookie for his personal Gmail, timestamped 02:47 on Saturday morning — roughly seven hours before the 09:42 badge-in at Bay 4.

That cookie did **not** get used to log into anything. This matters, and the level says so out loud in `subpoena-return.txt`. What the artifact did was identify *which account* to name in legal process. Sgt. Chen served a preservation request under 18 U.S.C. § 2703(f), a court order under § 2703(d) followed, and Google produced the mailbox contents. You are working from that production. An investigator who replays a seized session cookie to browse a suspect's live mailbox has contaminated the evidence and probably committed an offense; the discipline of going through process is part of the job, not paperwork around it.

Overnight, the case changed shape. Reed's counsel produced an email they say authorizes everything — Larry Hutchins, Director of Programs, telling Reed to take the project drive home for the weekend. Hutchins says he never wrote it.

So today's question is narrow and answerable: **did Larry Hutchins send that message?**

The skill that answers it is email header analysis, and the whole discipline rests on one asymmetry:

> The sender controls the headers a human reads. The servers control the headers that record what actually happened. When those two disagree, the servers win — because the sender could not reach into the receiving infrastructure to change them.

Everything below is `cat` and `grep`. Email headers are plain text, and reading them by eye is how this is done when a parser isn't handy.

## §2 — The solve

Eight steps, but really one move repeated: for every claim the disputed message makes, find the server-written header that either corroborates it or contradicts it.

### Step 1: Enter with the breadcrumb

```bash
guest@d3cyph3r:~$ ssh level3@forensics
level3@forensics's password: RC-Gmail-PreDawn-2026-03-14-T0247Z
```

You land as `ir-audit` on the Polaris IR bench. Read `welcome.md` — it explains the sender-controlled versus server-written split, the three authentication checks, and the one rule people get backwards on their first header (see step 5).

### Step 2: Read the production cover sheet

```bash
ir-audit@polaris-ir:~$ cat subpoena-return.txt
```

Three things to take from it.

**The legal basis**, covered above. Note the explicit sentence that the session artifact was used to identify the account and *not* to access it.

**Timestamp normalization.** Everything in the production has been normalized to US/Eastern so it can be laid directly against the badge and VPN logs already in evidence. February messages show EST (UTC−05:00) and March messages show EDT (UTC−04:00). Real productions often arrive in the provider's own timezone (Google's infrastructure typically stamps Pacific), and **normalizing timestamps before comparing timelines is a genuine forensic step** — cross-timezone comparison is one of the most common ways an analyst reaches a confidently wrong conclusion.

**The integrity hash and the existing timeline**: session established 02:47, badge-in 09:42.

### Step 3: Read the disputed message

```bash
ir-audit@polaris-ir:~$ ls mail/
01-authorization-claimed.eml  02-hutchins-genuine-2026-02-11.eml  03-outbound-0253.eml

ir-audit@polaris-ir:~$ cat mail/01-authorization-claimed.eml
```

The body reads exactly as counsel described — Hutchins clearing Reed to take the drive home, telling him not to worry about the paperwork. If you stop at the body, the defense holds.

Now read the header block. Four things are wrong, and each is independently sufficient.

**Return-Path disagrees with From.**

```
Return-Path: <reed.connolly@gmail.com>
From: "Hutchins, Larry" <l.hutchins@polaris-defense.com>
```

`From:` is the letterhead — free text the composer types. `Return-Path` records the SMTP *envelope* sender, the address the sending server actually declared during the delivery transaction. Delivery worked, so that value had to be real. The message was sent by Reed's own Gmail account, and the name at the top says otherwise. This is the fastest spoof check in existence and it costs one line of reading.

**All three authentication checks fail.**

```
Authentication-Results: mx.google.com;
        dkim=none;
        spf=fail (... does not designate 209.85.222.180 as permitted sender)
        dmarc=fail (p=REJECT sp=REJECT dis=NONE) header.from=polaris-defense.com
```

`spf=fail` — the sending server is not authorized to send for polaris-defense.com. `dkim=none` — note this is an *absence*, not a failed verification; there was no signature to check at all, and genuine Polaris mail is signed. `dmarc=fail` against a domain publishing `p=REJECT`, meaning Polaris explicitly instructs receivers to reject mail that fails alignment.

**The Message-ID is from the wrong system.**

```
Message-ID: <CAJ8v2mQ...@mail.gmail.com>
```

Message-IDs are assigned by the system that first accepts a message. A genuine Polaris message gets an `@polaris-defense.com` ID. This one was minted by Gmail. Whatever composed this message never touched Polaris infrastructure.

**The clock contradicts itself.** This is the strongest one, and step 5 walks it.

### Step 4: Pull a known-good — the move that makes it a finding

Resist the urge to conclude yet. A single failing message is arguable: forwarded mail breaks SPF constantly, mailing lists break DKIM, misconfigured relays exist. Opposing counsel will make exactly that argument, and on one sample they might win.

So get a genuine message from the same claimed sender:

```bash
ir-audit@polaris-ir:~$ cat mail/02-hutchins-genuine-2026-02-11.eml
```

Everything the disputed message fails, this one passes:

| | Disputed (01) | Genuine (02) |
|---|---|---|
| Return-Path | `reed.connolly@gmail.com` | `l.hutchins@polaris-defense.com` |
| SPF | fail | pass |
| DKIM | none | pass (`s=pds2024`, real signature) |
| DMARC | fail | pass |
| Message-ID domain | `@mail.gmail.com` | `@polaris-defense.com` |
| Relay path | Gmail submission only | `EXCH07` → `mx04.polaris-defense.com` → Google |

Now there is no innocent explanation left. Hutchins's real mail authenticates cleanly and traverses Polaris's Exchange server and corporate MX on the way out. The disputed message did neither.

**This comparison is the actual skill of the level.** Anyone can read `spf=fail`. The analyst's contribution is establishing what *normal* looks like for this sender, on this infrastructure, so that the anomaly is provable rather than merely suspicious.

(There's a second, quieter finding in the genuine message. Hutchins writes: *"please stop sending work material to your personal address."* A month before the incident, a director flagged the exact behavior in writing. Nothing followed. Hold that for §7.)

### Step 5: Read the chain bottom-up

Here is the rule everyone gets backwards the first time.

Each server that handles a message **prepends** its `Received:` line. The block is therefore in *reverse* chronological order: the **bottom** entry is the **first** hop, and the top is the last server before delivery. Read it top-down and you will confidently identify the recipient's own mail server as the origin.

Walk the disputed message's chain with line numbers:

```bash
ir-audit@polaris-ir:~$ grep -n received mail/01-authorization-claimed.eml
```

Reading bottom-up, the earliest hop is:

```
Received: from [100.64.18.203] ([100.64.18.203])
        by smtp.gmail.com with ESMTPSA id ...
        Sat, 14 Mar 2026 02:51:06 -0400 (EDT)
```

`ESMTPSA` is the tell: the **A** is *authenticated submission*. This is not a relay forwarding someone else's mail — it is a logged-in user handing Gmail a message to send. The message entered the world through an authenticated session on Reed's account, from Reed's address, at 02:51 on Saturday morning.

Now compare that to what the sender claimed:

```
Date: Thu, 12 Mar 2026 16:04:22 -0400
```

The `Date:` header says Thursday afternoon. The servers say Saturday at 02:51 — roughly 34 hours later. A sender can put anything in `Date:`; it is client-supplied text. A sender cannot reach into Google's infrastructure and change the time it recorded accepting the message. **The backdating is the intent.** An accidental misconfiguration doesn't set the clock back to a date that would make a story plausible.

### Step 6: What was actually sent

```bash
ir-audit@polaris-ir:~$ cat mail/03-outbound-0253.eml
```

Two minutes after the forged authorization is stamped, at 02:53:44:

```
From: Reed Connolly <reed.connolly@gmail.com>
To: m.arroyo@ridgeline-consulting.net
Subject: files
```

```
  https://filedrop.example.net/d/8f21c40e
  passphrase: RC-FileDrop-2026-03-14-T0253Z
```

…and, in Reed's own words, *"I've got cover on my end for having the drive, so the timing shouldn't look strange if anyone asks."*

Note this message authenticates perfectly — `spf=pass`, `dkim=pass`, `dmarc=pass`. That is not a contradiction. It passes because Reed really is `reed.connolly@gmail.com` and Gmail really did send it. Authentication proves a message came from the domain it claims; it says nothing about whether the contents are legitimate. Passing SPF/DKIM/DMARC is not a trust signal, and treating it as one is its own category of mistake.

`RC-FileDrop-2026-03-14-T0253Z` is your `level4@forensics` credential.

### Step 7: The two-minute sequence

Lay the timeline out and the case tells itself:

| Time (US/Eastern) | Event | Source |
|---|---|---|
| 02:47 | Authenticated Gmail session established | Cookies.sqlite (level2) |
| 02:51 | Forged "authorization" composed and sent to himself | Received chain, msg 01 |
| 02:53 | Project material sent to external recipient | msg 03 |
| 09:42 | Badge-in, Bay 4 | Badge log |

He built the alibi *before* doing the thing the alibi was meant to excuse. Ordering is the argument.

### Step 8: Post-mortem, then out

```bash
ir-audit@polaris-ir:~$ cat lessons-learned.md
ir-audit@polaris-ir:~$ exit
```

## §3 — The vulnerability

The weakness class is **CWE-290: Authentication Bypass by Spoofing** — asserting an identity in a field nothing authenticates.

SMTP was specified for a network where every host was known and trusted, and it carries that assumption structurally. The `From:` header has no cryptographic or protocol relationship to the account that submitted the message; it is display text. Anyone with a mail client can put any name and address in it. That is not a bug in an implementation — it is the design, and it is why every countermeasure here is a later addition layered on top.

The three additions and what each actually covers:

**SPF** (RFC 7208, Proposed Standard) publishes in DNS which servers may send for a domain. Its blind spot is that it validates the **envelope** sender, not the `From:` header the human reads — so a message can pass SPF while displaying someone else's name entirely.

**DKIM** (RFC 6376, an Internet Standard — the highest maturity level in the IETF process) attaches a cryptographic signature over selected headers and the body, verified against a public key in DNS. It proves the domain signed the message and that the signed parts weren't altered. Its blind spot is that an *unsigned* message doesn't fail — `dkim=none` means there was nothing to check.

**DMARC** ties the other two to the visible `From:` domain (**alignment**) and publishes what a receiver should do on failure. It is the piece that closes both blind spots, which is why `dmarc=fail` against `p=REJECT` is the load-bearing header in this level. DMARC was Informational for a decade as RFC 7489; it became Standards Track in May 2026 as **RFC 9989**, with RFC 9990 and RFC 9991 covering aggregate and failure reporting. Deployed policies in the wild — including Polaris's — still overwhelmingly reflect the 7489 era.

The `Received:` ordering rule that makes chain reading possible comes from **RFC 5322** (Internet Message Format): each relay prepends its trace field. That single convention is what turns a header block into a timeline.

There is also a non-technical dimension here that changes the character of the case. Up through yesterday this was a data-handling incident. Producing a fabricated exculpatory document is a different category of act, and fabricating evidence is generally a separate offense from the underlying conduct. **That determination belongs to counsel, not to the analyst.** Your deliverable states what the artifacts show; it does not characterize intent or recommend charges. Analysts who editorialize in a forensic report hand the other side something to attack that isn't the evidence.

## §4 — Real-world parallels

**Business Email Compromise is the industrial-scale version of exactly this.** The FBI's Internet Crime Complaint Center puts BEC losses at **$2.94B (2023), $2.77B (2024), and $3.05B (2025)** — the most financially destructive enterprise-targeted category, with per-complaint losses averaging over $120,000 and the large majority of funds moving by wire or ACH. Every one of those incidents begins the way this level does: a recipient believes a `From:` header.

**Facebook and Google, 2013–2015.** Evaldas Rimasauskas, a Lithuanian national, incorporated a company sharing a name with Quanta Computer — a real Taiwanese hardware supplier both companies did business with — then sent fraudulent invoices from spoofed domains. The scheme took in **more than $120 million** (roughly $99M from Facebook, $23M from Google) before it was caught. He pleaded guilty in 2019, was sentenced to five years, and was ordered to forfeit nearly $50M and pay over $26M in restitution; both companies recovered most or all of the funds. Two sophisticated technology companies, with excellent security teams, paid nine figures because the invoices *looked* like they came from a known supplier. If it can happen there, "our staff would notice" is not a control.

**The forwarding problem.** The most instructive counter-example is mundane: legitimate mail fails SPF all the time. A message forwarded by a mailing list or an auto-forward rule arrives from a server the original domain never authorized, and SPF fails on perfectly genuine mail. This is precisely why the known-good comparison in §2 step 4 isn't optional ceremony. An analyst who treats every `spf=fail` as fraud will generate false accusations at a steady clip — and will be correctly torn apart by anyone competent on cross-examination.

**What makes the Polaris case cheap to prove:** DMARC at `p=REJECT`. Had Polaris published `p=none`, receivers would still have *recorded* the failure, but the forgery would have been far easier to argue away as a relay misconfiguration. Enforcement is what converts "suspicious" into "provable" — a point worth making to anyone who has been sitting at `p=none` for two years "to avoid breaking things."

## §5 — Frameworks, deep dive

**The email authentication RFCs**, in the order you should read them: **RFC 5322** (Internet Message Format — the header block and the prepend rule), **RFC 7208** (SPF), **RFC 6376** (DKIM), and **RFC 9989** (DMARC, obsoleting RFC 7489, with RFC 9990 and RFC 9991 for reporting).

**NIST SP 800-177 Rev. 1 — Trustworthy Email** is the consolidated federal guidance on deploying all three. It's the document to cite when you need to argue internally for moving from `p=none` to enforcement, because it makes the recommendation in a form procurement and compliance functions recognize.

**NIST SP 800-86 — Integrating Forensic Techniques into Incident Response** is the methodology backdrop for the whole forensics track: collection, examination, analysis, reporting. Its central discipline — that conclusions must be reproducible from preserved artifacts by someone who wasn't there — is exactly what the known-good comparison and the timestamp normalization serve.

**NIST SP 800-171 Rev. 3 / CMMC** governs Polaris because it handles Controlled Unclassified Information. The relevant families for the control-side finding: **3.1.3** (control the flow of CUI), **3.1.20** (limit connection to and use of external systems — the personal Gmail account and the external file-drop service are both this), and the **3.3.x** audit and accountability requirements that made the badge, VPN, and endpoint records available to correlate against. CMMC Level 2 assessment maps to these practices directly, and a defense contractor's certification status is a contractual, revenue-bearing question — which is why Polaris's response is not merely an HR matter.

**Stored Communications Act, 18 U.S.C. § 2701 et seq.** is the legal machinery in the background. § 2703(f) preservation requests freeze provider-held data while process is obtained; § 2703(d) orders and warrants compel production. The analyst-relevant point: provider-held content is generally not something an investigator may reach on their own initiative, and possessing a session token does not create authority to use it.

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701)** tests SPF, DKIM, and DMARC directly, usually as "which control prevents this?" or by showing a header excerpt and asking what it demonstrates. Know that SPF checks the envelope, DKIM signs, and DMARC aligns them to the visible `From:` — that triad answers most questions on the topic.

**CompTIA CySA+ (CS0-003)** treats header analysis as a hands-on analyst skill: you're shown a block and asked to identify the true origin or the spoofing indicator. Practice reading chains bottom-up until it's automatic, because the exam rewards the correct direction and punishes the intuitive one.

**GIAC GCFA / GCIH** cover email as an evidence source, including chain reconstruction, provider records, and the legal-process side of obtaining them. The distinction between artifacts you may examine and accounts you may access is examinable material, not just professional etiquette.

**ISC2 CISSP** Domain 7 (Security Operations) covers investigations, evidence handling, and admissibility — including the requirement that findings survive adversarial scrutiny. Domain 4 covers the secure communications side.

**EnCE / AccessData ACE** and similar tool certifications assume the underlying header literacy this level teaches; the tools parse the chain for you, but you still have to know what it means when `Date:` and the trace fields disagree.

## §7 — What a defender does

**1. Preserve first, analyze second.** Work from the production copy, keep the provider-supplied hash, and record who touched what and when. Everything downstream is worthless if the provenance of the artifact is arguable. The hash in `subpoena-return.txt` isn't decoration — it's what lets someone else verify you analyzed what Google actually sent.

**2. Never conclude from a single message.** Obtain a genuine message from the same claimed sender and compare authentication results, Message-ID domain, and relay path. One failing message invites an argument about misconfiguration; a matched pair forecloses it.

**3. Read chains bottom-up and normalize timestamps.** Convert everything to a single timezone — UTC is the safe default — before correlating against badge, VPN, or EDR data. Cross-timezone comparison is a leading cause of confidently wrong timelines.

**4. Publish DMARC at enforcement.** `p=none` observes; `p=quarantine` and `p=REJECT` act. Start at `p=none` with aggregate reporting to find your legitimate senders, fix them, then move to enforcement on a schedule with an owner. Sitting at `p=none` indefinitely is the common failure — you get the reports and none of the protection.

**5. Alert on the header conditions, don't just log them.** Inbound mail whose `From:` domain is your own but which fails DMARC is among the highest-signal detections available and is usually a one-line rule. Add display-name-impersonation detection for executives, and flag external mail visibly in the client so "looks internal" stops being persuasive on its own.

**6. Close the actual control gap.** In this case the only finding Polaris owns is the third one: a director flagged personal-address use in writing a month before the incident, and nothing followed. A flagged behavior with no owner and no follow-up is a control failure independent of what the employee later chose to do. Route those observations into a tracked process — DLP policy, an offboarding-style review, *something* with a ticket number.

**7. Write the report so it survives opposition.** State what each artifact shows, cite the artifact, avoid characterizing intent, and make every conclusion reproducible by someone working from the same evidence. "The Date header is inconsistent with the receiving server's trace field by approximately 34 hours" survives cross-examination. "Reed faked it" does not.

## §7.5 — Optional exploration

Two bonus finds. `progress --detail` shows your discovered list. Neither changes the breadcrumb chain.

**1. The envelope disagrees with the letterhead** — Trigger: `cat mail/01-authorization-claimed.eml`. `Return-Path: <reed.connolly@gmail.com>` against `From: "Hutchins, Larry" <l.hutchins@polaris-defense.com>`. The envelope sender is what the sending server declared for delivery to actually happen; the `From:` header is composer-supplied display text. When they disagree, believe the envelope. This is the single fastest spoof check available and it is one line of reading — worth building into muscle memory, because in a real inbox you'll often have only seconds of attention to spend.

**2. You compared against a known-good** — Trigger: `cat mail/02-hutchins-genuine-2026-02-11.eml`. The find is awarded for the *analyst behavior*, not for a fact in the file. Establishing what normal looks like for this sender on this infrastructure is what converts an observation into a finding that holds up. Everything else in the level is reading; this is the part that is judgment.

Worth doing while you're here: run the chain-walk on both messages back to back —

```bash
grep -n received mail/01-authorization-claimed.eml
grep -n received mail/02-hutchins-genuine-2026-02-11.eml
```

— and notice that the genuine message has an extra hop (`EXCH07` → `mx04.polaris-defense.com`) that the forgery has no way to fabricate. Hop *count* and hop *identity* are both evidence.

## §8 — Key takeaways

- **The `From:` header is a claim; the `Received:` chain is a record.** The sender controls what a human reads and none of what the servers wrote after the message left their hands. Every email investigation is an exercise in reading the parts the sender couldn't touch.
- **Read `Received:` chains bottom-up.** Each hop prepends, so the oldest is at the bottom. Reading top-down reliably produces the wrong origin, and it produces it *confidently*.
- **A single failing message proves very little.** Legitimate mail fails SPF constantly through forwarding. Always pull a known-good sample from the same claimed sender before calling anything forged — that comparison is the difference between a finding and an accusation.
- **Authentication passing is not a trust signal.** Reed's exfiltration message passed SPF, DKIM, and DMARC perfectly, because he really was who he claimed to be. The checks prove origin, not legitimacy.
- **DMARC enforcement is what makes forgery provable.** `p=none` records the failure and delivers anyway. `p=REJECT` is why this case took an afternoon instead of a deposition.

## §9 — Further reading

*Last reviewed: July 2026. RFC status, statutory citations, and incident figures verified against current canonical sources as of this date — note in particular that RFC 7489 (DMARC) was obsoleted by RFC 9989/9990/9991 in May 2026. Report stale links via the project's GitHub issues tracker.*

- [CWE-290 — Authentication Bypass by Spoofing](https://cwe.mitre.org/data/definitions/290.html)
- [RFC 5322 — Internet Message Format](https://datatracker.ietf.org/doc/html/rfc5322)
- [RFC 7208 — Sender Policy Framework (SPF)](https://datatracker.ietf.org/doc/html/rfc7208)
- [RFC 6376 — DomainKeys Identified Mail (DKIM), Internet Standard](https://datatracker.ietf.org/doc/html/rfc6376)
- [RFC 9989 — DMARC (obsoletes RFC 7489)](https://datatracker.ietf.org/doc/rfc9989/)
- [RFC 7489 — DMARC (obsoleted; the decade of deployed policy reflects this document)](https://datatracker.ietf.org/doc/rfc7489/)
- [dmarc.org — Summary of Changes in DMARCbis](https://dmarc.org/2025/12/summary-of-changes-in-dmarcbis/)
- [NIST SP 800-177 Rev. 1 — Trustworthy Email](https://csrc.nist.gov/pubs/sp/800/177/r1/final)
- [NIST SP 800-86 — Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final)
- [NIST SP 800-171 Rev. 3 — Protecting CUI in Nonfederal Systems](https://csrc.nist.gov/pubs/sp/800/171/r3/final)
- [CMMC — DoD Chief Information Officer program page](https://dodcio.defense.gov/CMMC/)
- [18 U.S.C. § 2703 — Required disclosure of customer communications or records](https://www.law.cornell.edu/uscode/text/18/2703)
- [FBI IC3 — 2025 Internet Crime Report](https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf)
- [FBI IC3 — Business Email Compromise public service announcement](https://www.ic3.gov/PSA/2024/PSA240911)
- [DOJ — Lithuanian man sentenced for $120M business email compromise (Rimasauskas)](https://www.justice.gov/usao-sdny/pr/lithuanian-man-sentenced-5-years-prison-theft-over-120-million-fraudulent-business)
- [FBI — Ringleader of Business Email Compromise Scheme Sentenced](https://www.fbi.gov/news/stories/ringleader-of-business-email-compromise-scheme-sentenced-012820)
- [MITRE ATT&CK — T1114: Email Collection](https://attack.mitre.org/techniques/T1114/)
- [MITRE ATT&CK — T1534: Internal Spearphishing](https://attack.mitre.org/techniques/T1534/)
- [MITRE ATT&CK — T1567: Exfiltration Over Web Service](https://attack.mitre.org/techniques/T1567/)
- [MITRE ATT&CK — T1070: Indicator Removal](https://attack.mitre.org/techniques/T1070/)
- [M3AAWG — Sender Best Common Practices](https://www.m3aawg.org/published-documents)
- [Google — Email sender guidelines (authentication requirements for bulk senders)](https://support.google.com/a/answer/81126)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
