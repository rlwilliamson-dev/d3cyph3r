# level2@forensics — What Reed's Browser Saw

**Track:** Forensics · **Client:** Polaris Defense Systems · **Compliance regime:** CMMC Level 2 + NIST SP 800-171 Rev. 3 + DFARS 252.204-7012 + NISPOM 32 CFR Part 117 + 32 CFR Part 2002 (CUI Program) · **Builds on:** [`level1@forensics`](/walkthroughs/#/forensics/level1)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level3@forensics`. If you haven't solved `level2@forensics` yet, close this tab and come back after. The puzzle teaches browser-artifact forensics through SQL formation; reading the writeup first removes the discovery moment when the smoking-gun row comes back from a `SELECT` you composed yourself.

---

## §1 — The setup

When the lobby spun you out of `level1@forensics` on Friday afternoon, two findings went into the day-two deliverable: Reed Connolly's Saturday-morning CUI-exfil chain (the 4688 process-creation events showing PowerShell `Compress-Archive` staging `D:\CUI\Subsystem-A\*` into `%TEMP%\sa-export.zip`, then certutil-encoding it, then a Chrome upload to mega.nz), and the awkward second finding nobody had been looking for — a 4625 failed-logon record where Polaris's IR-team lead, Maya Voss, had typed her own account password into the `TargetUserName` field of a network-auth prompt during the Tuesday-night acquisition. The first finding was the case. The second was a procedural breach the IR team needed to know about same-day.

Both got reported. Sgt. Marcus Chen (Polaris's FSO and the formal case lead) received the package by close-of-business Friday. Larry Hutchins (Polaris's CISO and Maya's manager) was looped in within three hours. Maya rotated her primary account credential before she left the office, escalated the procedural finding to Hutchins on her own initiative — "I want this on the record from me before it shows up on a report" — and stayed late to walk her team through the operational discipline that should have caught it (no password-into-username typos during high-pressure acquisition work; the IR-team buddy-check protocol is supposed to catch exactly this and didn't). The procedural finding closes there. The forensic finding does not.

Over the weekend, Dana Reyes (Polaris's in-house counsel) walked the day-two deliverable through outside counsel for the next phase. The DFARS 252.204-7012 (c) 72-hour clock had started Friday when Polaris formally discovered the CUI compromise; by Monday morning the DC3 report had been filed via DIBNET and the case was officially a DoD-coordinated insider-threat matter.[^dfars-252-204-7012-safeguarding] Outside counsel also opened a separate, parallel track: a subpoena to Google Workspace seeking Reed's `rconnolly.personal@gmail.com` account history for the relevant time window. That subpoena is in flight. While it processes, Dana wants Driftwood to take the next forensic pass — the one the Friday deliverable hinted at but didn't yet do.

On Friday, Maya had mentioned in passing that during her own initial walk of Reed's seized workstation image she'd noticed a 02:47 personal-webmail visit on Saturday — pre-dawn, seven hours before the 09:42 Bay 4 badge-in. She hadn't pursued it because the day-two scope was the OS-level audit trail (Security event log), not the user-profile artifacts (browser, mail client, application state). The user-profile data lives in a different layer of the EnCase image, requires a different toolchain to query, and frankly requires the kind of patience that comes after the 72-hour reporting clock stops being the priority. Monday morning is that moment.

Maya's authorization for the deeper pass is in writing. The two SQLite-backed browser-artifact files — Chromium's `History` database (renamed `History.sqlite` in this engine for clarity) and `Cookies` database — have been extracted from Reed's user profile (`\Users\rconnolly\AppData\Local\Google\Chrome\User Data\Default\`) and copied to Polaris's IR forensic-analysis workstation (host: `evidence.polaris.local`, internal). Maya provisioned a service account (`ir-audit`) on that bench specifically for Driftwood's continued work, with read-only access scoped to the case directory. The password for that service account is the credential you just used to gate this shell — `P0l4r1s-IR-L3ad-2026!`. The fact that the `ir-audit` password matches the pattern of the credential that leaked in level1's 4625 record is itself a finding, and it's flagged explicitly in this level's `lessons-learned.md`. Maya's a self-aware IR lead; she put the awkward thing in the open rather than letting it surface in someone else's report.

The legal frame hasn't changed since Friday. CUI artifacts are in scope; DFARS reporting has occurred; NISPOM 32 CFR §117.8(c) insider-threat-program controls are active; the case file is POL-IIS-2026-0007 (continuing). The new layer that engaged this morning is 32 CFR Part 2002 (the CUI Program regulation under the National Archives), which makes Polaris responsible for documenting the scope of any actual or suspected CUI disclosure under §2002.48.[^cfr-32-2002][^national-archives-cui-program] The browser-artifact pass you're about to run is part of that documentation: if Reed accessed personal services to stage exfiltration, the timeline matters for the disclosure scope.

Your task today is narrow, and the deliverable is correspondingly narrow. Maya wants the timeline reconstruction of Reed's online activity in the 24 hours before the 09:42 Bay 4 badge-in. Specifically: what services did he visit, when, in what order, and is there a live session token she can pass to outside counsel to expedite the Google subpoena. The token is the deliverable. Reading the message bodies in Reed's inbox is explicitly out of scope; that's a separate authorization that the subpoena exists to obtain. Today is "find the token, document the timeline, don't open the mail."

The host you're on — `evidence.polaris.local` — runs read-only on the analysis volume. The `.sqlite` files are real database files (binary, 720KB + 340KB) but you'll never `cat` them; you'll query them with the engine's new `sqlite3` command. The chain-of-custody hashes for both files are in `chain-of-custody.txt`. Maya's expectation is that you confirm the SHA-256 baseline before your first query and again after your last query. If the hash diverges, you stop and call her; the analysis bench is configured read-only, so divergence would mean a tooling fault that needs investigation before the queries you ran can be relied on.

You're logged in as `ir-audit` on a host you've never touched before. The continuity with level0/level1 is the client (Polaris), the case (POL-IIS-2026-0007), and the cast (Reed, Dana, Sgt. Chen, Maya, Hutchins). The discontinuity is the artifact source: events vs. databases, OS-level vs. user-profile, time-series vs. tables. Different layer of the same incident. Different toolchain.

---

## §2 — The solve

The solve path is five queries plus a sanity check. None of them require SQL you haven't seen as a SQL Server / Postgres user with intermediate experience, and the engine's `sqlite3` command implements a deliberately small grammar so the queries you compose stay tight to forensic-relevant forms.

### Step 1 — Land + orient

```
ssh level2@forensics
P0l4r1s-IR-L3ad-2026!
```

The shell prompt switches to `ir-audit@forensics:~`. You're on Polaris IR's forensic-analysis workstation as the service account Maya provisioned. Run `ls` to see what's in the working directory:

```
welcome.md
case-notes.md
chain-of-custody.txt
Reed/
lessons-learned.md
```

The `Reed/` subdirectory holds the two browser-artifact files; the rest is documentation. Read in this order:

```
cat welcome.md           # explains the new sqlite3 command
cat case-notes.md        # Maya's brief for today
cat chain-of-custody.txt # the hash baseline
```

`welcome.md` introduces the `sqlite3` command and the subset SQL grammar it supports. `case-notes.md` is Maya's scope: query the History DB for Reed's recent online activity, pivot to Cookies if you find a webmail visit worth following up, extract any live session token, do NOT read message content. `chain-of-custody.txt` gives you the SHA-256 baseline.

### Step 2 — Confirm the hash baseline

Forensic procedure: hash before, hash after, compare. Both must match for any query result to be relied on as evidence.

```
sha256sum Reed/History.sqlite
```

Expected output (matches the `chain-of-custody.txt` baseline):

```
8c4f1d2e93b56a087c1f4a72d9e83c61a5f2b40e7c93a18d6f25b91e7d34a8c2  Reed/History.sqlite
```

Same exercise for `Reed/Cookies.sqlite`:

```
sha256sum Reed/Cookies.sqlite
# 3a7d92f5b8e14c620d9f471a8e63b95c2d1e84f0a76b3e5c9d28f147b62a503e  Reed/Cookies.sqlite
```

Both match. You can query. (In a real engagement, the analysis bench's sqlite3 client opens the file in `mode=ro` or `immutable=1` form; this engine doesn't expose that flag because the command is read-only by design — but in real forensic work the explicit-read-only open is the discipline.)

### Step 3 — Map the History database schema

You've never seen this particular schema before. `sqlite3`'s `.tables` dot-command lists the tables, and `.schema` shows the `CREATE TABLE` statement for any one of them:

```
sqlite3 Reed/History.sqlite ".tables"
```

```
downloads
keyword_search_terms
urls
visits
```

Four tables. The names follow Chromium's actual `History` file schema (the same names Chrome has used since the 2010 unification of bookmark + history storage). The four tables that matter for activity reconstruction:

- `urls` — every URL ever visited (one row per distinct URL, with cumulative visit_count + last_visit_time)
- `visits` — one row per individual navigation event (timestamped + linked back to urls via foreign key)
- `downloads` — one row per file downloaded
- `keyword_search_terms` — search-box queries (linked to the corresponding URL in `urls`)

`.schema urls` shows the columns you'll query:

```
sqlite3 Reed/History.sqlite ".schema urls"
```

```sql
CREATE TABLE urls(
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  url             LONGVARCHAR,
  title           LONGVARCHAR,
  visit_count     INTEGER DEFAULT 0 NOT NULL,
  typed_count     INTEGER DEFAULT 0 NOT NULL,
  last_visit_time INTEGER NOT NULL,
  hidden          INTEGER DEFAULT 0 NOT NULL
);
```

`last_visit_time` is the column you'll sort on; `url` and `title` are the columns you'll filter on; `typed_count` is interesting (it counts when the URL was typed into the omnibox vs. clicked from a link or autocompleted from history — high typed_count + low visit_count signals the URL was something the user actively went out of their way to type, not stumbled across).

### Step 4 — Sweep recent activity

You don't know what you're looking for yet; you know the badge-in was 09:42 Saturday and you know Maya saw something at 02:47. Sort the urls table by `last_visit_time` descending and show the most-recent activity:

```
sqlite3 -header Reed/History.sqlite "SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 20"
```

The `-header` flag adds a column-name row so the output is readable. You see ~15 URLs ordered by most-recent first. Normal Friday-evening browsing (ESPN, Reddit subreddit for Reed's soccer parents group, weather, Amazon). Then — interleaved into the chronology — a cluster of entries at 02:47 and 02:51 on Saturday morning that don't fit:

```
https://mail.google.com/mail/u/0/         Inbox (4) - rconnolly.personal@gmail.com  2026-03-14 02:47:21
https://mail.google.com/mail/u/0/#sent    Sent Mail - rconnolly.personal@gmail.com  2026-03-14 02:51:08
```

Reed accessed his personal Gmail at 02:47 Saturday morning. That's seven hours before he badged into Bay 4. The title field gives you the account: `rconnolly.personal@gmail.com`. This is the lead.

Two more entries from the same morning's search history are interleaved a few minutes later:

```
https://www.google.com/search?q=encryption+export+controls+EAR+penalties      2026-03-14 03:12:55
https://www.google.com/search?q=CUI+how+to+identify+if+a+document+is+marked   2026-03-14 03:14:38
```

These are exactly the searches a person who knows they're about to do something against the rules runs when they want to know how serious the rules are. Pre-meditation evidence. Not a smoking gun on its own (anyone with curiosity could run these searches), but in context — between a 02:47 personal-webmail visit and a 09:42 secured-bay badge-in — they read as deliberation.

### Step 5 — Filter to the webmail visits

Tighten the query to just webmail:

```
sqlite3 Reed/History.sqlite "SELECT url, title FROM urls WHERE url LIKE '%mail.google%'"
```

Three rows: the 02:47 inbox visit, the 02:51 sent-folder visit, and a 11:33 drafts-folder visit (post-badge-in, a 90-minute return to the same account). The 11:33 timestamp is the staging or send moment. The 02:47 timestamp is the channel pre-positioning.

The `title` column on the first row identifies the account: Reed accessed `rconnolly.personal@gmail.com`. This is the account outside counsel is subpoenaing. You're on the right thread.

### Step 6 — Pivot to Cookies for the session token

The Google subpoena will produce mail content under legal process eventually, but Maya wants a session token TODAY so outside counsel can expedite the review with Google's compliance team. Session tokens are in the Cookies database, keyed by `host_key`.

```
sqlite3 Reed/Cookies.sqlite ".tables"
```

```
cookies
```

One table. `.schema cookies` shows the structure (Chromium's cookies file has the same column layout it's used since the 2014 redesign — `host_key`, `name`, `value`, `path`, `expires_utc`, `is_secure`, `is_httponly`, `last_access_utc`, plus a few flags). Filter for the Gmail host:

```
sqlite3 -header Reed/Cookies.sqlite "SELECT host_key, name, value FROM cookies WHERE host_key LIKE '%mail.google%'"
```

One row:

```
host_key         |name |value
mail.google.com  |SID  |RC-Gmail-PreDawn-2026-03-14-T0247Z
```

`SID` is Google's primary session cookie name. The `value` is the session token. The token's creation timestamp matches the 02:47 inbox visit; the `last_access_utc` (which you can pull in a second query if you want the timeline detail) matches the 11:33 drafts-folder visit. The cookie is alive and aligned to Reed's activity window.

That value — `RC-Gmail-PreDawn-2026-03-14-T0247Z` — is the deliverable. Document it in the case notes; pass it to Maya, who forwards to outside counsel, who uses it to coordinate with Google's legal-process team. (Subpoena enforcement at Google is faster when a live session anchor is provided; the company can confirm account activity windows without waiting for the subpoena to traverse their normal legal-response queue. Real-world: Google's [Legal Investigations Support](https://support.google.com/transparencyreport/answer/9713961) page documents this.)

The credential string is also the entry password for `level3@forensics` — the next puzzle, where Reed's outbound mail headers go under the microscope. The chain stays intact.

### Step 7 — Final hash + lessons-learned

Re-run the hashes to confirm the analysis didn't perturb the files:

```
sha256sum Reed/History.sqlite Reed/Cookies.sqlite
```

Both match the baseline. The deliverable is defensible. Read `lessons-learned.md`:

```
cat lessons-learned.md
```

The post-mortem is in the next four sections.

---

## §3 — The vulnerability

The "vulnerability" framing is unusual here. Reed isn't a system; his browser isn't a software vendor; there's no CVE number to chase. The thing that's "vulnerable" in this engagement — exposed to forensic recovery — is Reed's intent, captured by the browser he used every day and stored in databases he didn't know he was creating.

Browser forensics works because every modern browser maintains a *user-activity ledger* by default. Every URL visited, every download, every form value autofilled, every search-box query typed — captured with timestamps, stored in SQLite databases that live in well-known paths under the user's profile directory. The Chromium project (which underpins Chrome, Edge, Brave, Opera, Vivaldi, and others) [publishes the schema for these files](https://chromium.googlesource.com/chromium/src/+/main/components/history/). Mozilla does the same for Firefox's `places.sqlite`. Apple is less generous but the [WebKit project](https://webkit.org/) is open enough that the equivalents in Safari's `History.db` are well-documented in forensic literature.

The properties that make this a forensic asymmetry:

**The data is captured by default.** Browsers prioritize "user can find the page they visited last week" over "user has no evidence trail of what they did last week." Building a browser without a history database would be technically trivial; no commercial browser ships that way because the feature is what users expect. The forensic side benefits.

**The data persists beyond user-visible clearing.** "Clear browsing data" does what its name says, but SQLite's [Write-Ahead Logging (WAL)](https://www.sqlite.org/wal.html) journal pages and the [VACUUM](https://www.sqlite.org/lang_vacuum.html) deferral mean that historical row data often survives. Many forensic tools recover records from WAL pages even after a user has cleared history. The 13Cubed and Magnet forensic blogs are full of case studies on this; SANS FOR500 spends a module on it.[^sans-for500]

**The data is structured.** Unlike file-system timestamps (which carry one or two dimensions of time per file) or memory dumps (which require expert interpretation), browser-history databases are *queryable*. Anyone who can compose a SQL SELECT can ask questions like "did this user visit this domain in this time window" and get an unambiguous yes/no with timestamps. The cognitive lift to extract evidence from a browser DB is much lower than the lift to extract equivalent evidence from a Windows event log or a memory image.

**The data is portable.** A 720 KB History.sqlite file can be copied off a seized image in seconds and queried on any analyst workstation. No special tools beyond the standard `sqlite3` client, which ships with macOS, every Linux distribution, and is one click away on Windows. The forensic-tool ecosystem (Autopsy, FTK Imager, EnCase, Magnet AXIOM, Cellebrite UFED) treats SQLite browser DBs as first-class artifacts but doesn't require any of them — a competent analyst with `sqlite3` and patience can do the work.

The CWE most often cited for the "vulnerability" framing is [CWE-200](https://cwe.mitre.org/data/definitions/200.html) (Exposure of Sensitive Information to an Unauthorized Actor), applied from the suspect's perspective: Reed didn't intend the browser to retain a forensic record of his pre-dawn webmail visit, but it did, and the unauthorized actor (the investigators acting under authorization Reed didn't consent to) recovers it. CWE catalogues weaknesses in software, not weaknesses in user behavior, but the pattern is consistent enough that the framing transfers. [CWE-359](https://cwe.mitre.org/data/definitions/359.html) (Exposure of Private Personal Information) is the more precise variant when the recovered data is identifiably personal.

The point is not that browsers are designed badly. They're designed for users who want their browsing history. The "vulnerability" is the gap between the user's mental model of what a browser remembers and what it actually remembers — and that gap is approximately the size of the entire SQLite database, including the WAL pages the user can't even see in Chrome's UI.

---

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Chromium History and Cookies databases from the seized workstation |
| What they establish | A pre-dawn webmail visit hours before the badge-in, and searches about CUI handling rules that speak to intent |
| Also recovered | A live session cookie for a personal webmail account |
| Investigative value | The cookie identifies **which account** to name in legal process |
| Regime | CMMC Level 2, NIST SP 800-171, DFARS 252.204-7012 — 72 hours to DoD via DIBNet, with images and logs preserved at least 90 days[^nist-800-171][^dfars-252-204-7012-safeguarding] |

**Searches about the rules go to intent, and intent is what separates a
policy violation from a deliberate act.** Timeline and technique were
established in the previous level. Someone reading up on what is and is
not permitted, shortly before doing the thing, changes the character of
the finding and is the sort of artifact that outside counsel will care
about more than the file transfer itself.

**The live cookie must not be used, and the restraint is the entire
professional point.** Replaying a seized session to browse a suspect's
mailbox contaminates the evidence and may itself be an offence. Its
correct use is narrow and administrative: it names the account, which is
what a preservation request and a subsequent court order are written
against. The next level works from the provider's lawful production, not
from this artifact.

**Browser artifacts are corroboration, not proof of who was typing.**
History records the profile's activity, not the human at the keyboard. It
sits alongside the badge log, the event log, and the mail headers, and its
strength comes from agreeing with them. A case resting on browser history
alone has a shared-workstation problem it cannot answer.

## §4 — Real-world parallels

Browser-artifact forensics has been pivotal in several high-profile cases over the past two decades. A short selection, chosen because each one shows a different angle of the same underlying technique.

**Scott Peterson (2002-2003).** [The murder trial of Scott Peterson](https://en.wikipedia.org/wiki/Murder_of_Laci_Peterson) included extensive browser-history evidence — among other items, MapQuest searches for the Berkeley Marina (where Peterson claimed to be fishing the day his wife disappeared) and searches for water depths and currents in that area. The prosecution introduced the browser-history evidence to establish premeditation; the searches had occurred in the weeks before the disappearance. The case is a foundational reference in forensic-investigation curricula because it predates the modern SQLite-based browser schemas (Netscape and Internet Explorer used flat files at the time), and the techniques to recover the data were correspondingly less polished, but the principle was identical: the browser had remembered what the user no longer remembered telling it.

**Casey Anthony (2008-2011).** [The Caylee Anthony case](https://en.wikipedia.org/wiki/Death_of_Caylee_Anthony) introduced an enduring controversy in browser forensics. The prosecution alleged that Casey Anthony had searched for "chloroform" 84 times on the family computer; the defense argued (and a forensic analyst later confirmed, post-trial) that the searches had actually been performed once — the count came from a tool that double-counted browser-history records. The case is a teaching reference because it shows the asymmetry from the other direction: forensic tools can mis-report what a database contains if the analyst doesn't verify the underlying schema. Anthony was acquitted of the murder charges; the chloroform-search forensic error is part of why.

**Paige Thompson / Capital One (2019).** [Capital One's 2019 breach](https://www.justice.gov/usao-wdwa/united-states-v-paige-thompson) — 100 million customer records exfiltrated by a former AWS engineer — was investigated in part through Thompson's browser and chat artifacts. Her Slack-channel posts and GitHub gist activity (also stored in SQLite-backed application databases) provided the timeline the DOJ used at trial. Thompson was convicted in 2022.

**Cambridge Analytica (2018).** Not a criminal investigation per se, but the [FTC's 2019 settlement with Facebook](https://www.ftc.gov/news-events/news/press-releases/2019/07/ftc-imposes-5-billion-penalty-sweeping-new-privacy-restrictions-facebook) leaned on the discoverability of browser-history data via data-broker arrangements. Facebook had access to user browsing activity beyond the Facebook domain via Like-button beacons and Pixel integrations; that activity was stored, queryable, and ultimately the subject of a $5B penalty.

**Strava heatmap (2018).** [Not a browser case, but parallel discipline.](https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases) Strava published an aggregate global heatmap of user activity derived from its mobile-app activity database (also SQLite-backed under iOS / Android). The heatmap inadvertently revealed the locations of U.S. military installations in Iraq, Syria, and Afghanistan because the only people running in those locations were the personnel. The lesson is identical to the browser-DB lesson: persistent activity logs exist for a feature reason (the user wants to see their own runs); the forensic / OSINT side benefits from the same persistence.

**Mobile-forensics paradigm broadly.** The Cellebrite UFED and GrayKey product lines, which dominate the mobile-forensics market, are essentially SQLite parsers at their core. iOS app data, Android app data, and the OS-level databases on both platforms — all SQLite, all queryable. Cellebrite's [UFED](https://cellebrite.com/en/products/cellebrite-inseyets/ufed/) extraction line is built around recovering and parsing exactly these databases, write-ahead logs included — the same forensic discipline, scaled to mobile.

The thread running through all these cases is the same: SQLite is the universal user-activity ledger across modern computing, and the forensic implications follow from that.

---

## §5 — Frameworks, deep dive

The forensic side of this engagement sits inside a stack of overlapping frameworks. Reading them top-down:

### NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response

[NIST SP 800-86](https://csrc.nist.gov/pubs/sp/800/86/final) (published 2006, final / still current as of May 2026 — there is no Rev. 2 and the document remains the canonical U.S. government reference for the forensic process). §3 lays out a four-phase model: collection → examination → analysis → reporting. The examination phase (§3.3) explicitly covers "data sources" and names browser activity records as one of the canonical sources, alongside file-system metadata, memory artifacts, network logs, and operating-system event logs. The 800-86 framing of "preserve the original, work on a verified copy, document each step" is precisely the discipline the `chain-of-custody.txt` baseline and the pre/post hash comparison are modeling in this level.

The document is 121 pages and worth reading end-to-end if you're going to work in incident response. The §3.3 examination section is the closest thing to a single-source reference for what you just did in the solve.

### NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information

[NIST SP 800-171 Rev. 3](https://csrc.nist.gov/pubs/sp/800/171/r3/final) (published May 2024, fully replacing Rev. 2) is the U.S. government control set that applies to defense contractors handling CUI. The control family relevant to this level is **AU (Audit and Accountability)** — specifically AU-2 (event logging), AU-6 (audit record review, analysis, and reporting), and AU-12 (audit record generation). Browser History databases qualify under AU-2's "audit-record source" definition because they capture user activity at a granularity appropriate for accountability. Polaris is responsible under AU-6 for ensuring those records are reviewable and reviewed; the day-three pass you ran is one instance of that review actually happening.

The shift from Rev. 2 to Rev. 3 tightened several of the AU controls (Rev. 3 added explicit requirements around audit-record retention durations and tamper-protection). Real CMMC Level 2 assessments now look for evidence of those tightened controls during the audit; the analysis-bench discipline this level demonstrates is the kind of evidence assessors want.

### CMMC Level 2 — AU domain

[CMMC Level 2](https://dodcio.defense.gov/CMMC/) (published in final rule form 2024-10-15, effective for new DoD contracts starting 2025) maps NIST SP 800-171's AU controls into the AU.L2-3.3.x assessment objectives.[^nist-800-171] Browser-DB forensics doesn't have its own line item, but the discipline of pulling artifacts from a seized image, hashing them, querying them under documented procedure, and producing a defensible deliverable is exactly what AU.L2-3.3.6 (review and analysis of audit records to identify inappropriate or unusual activity) and AU.L2-3.3.8 (protect audit information and audit logging tools from unauthorized access, modification, and deletion) ask for.

### NISPOM 32 CFR Part 117 + 32 CFR Part 2002 (CUI Program)

[NISPOM (32 CFR Part 117)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117) is the National Industrial Security Program Operating Manual — the regulation that governs cleared facilities like Polaris. Part 117.8(c) requires reporting of insider-threat indicators and adverse information about cleared personnel. The browser-history finding on Reed (specifically the searches around CUI handling rules) is reportable adverse information under that section.

[32 CFR Part 2002](https://www.ecfr.gov/current/title-32/subtitle-B/chapter-XX/part-2002) is the CUI Program regulation under the National Archives, which makes Polaris responsible under §2002.48 for documenting the scope of any suspected CUI disclosure. The browser-artifact timeline you just produced is part of that documentation: if the personal-webmail visit was the staging channel, the disclosure scope is bounded by what was actually exfiltrated through that channel, and the timeline narrows the window the disclosure analysis has to cover.

### DoDI 5205.16 — DoD Insider Threat Program

[DoDI 5205.16](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520516p.pdf) (reissued December 20, 2024 as a DoD Instruction, previously DoD Directive 5205.16) establishes the DoD-wide Insider Threat Program and is the parent authority NISPOM 32 CFR §117.8 implements at the cleared-contractor level. Polaris's investigation runs under the program; the forensic deliverable you just produced becomes part of the program's case record.

### DoDI 5200.48 — Controlled Unclassified Information

[DoDI 5200.48](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520048p.PDF) (issued March 2020 as a DoD Instruction; the trade press often refers to it as "DoDM 5200.48" but the canonical issuance type is Instruction; PDF is at the DoD Washington Headquarters Services issuances site, which is browser-only) is the DoD implementation of the broader CUI program, alongside the [National Archives CUI Program landing](https://www.archives.gov/cui) which is the authoritative cross-government reference. It defines what CUI is, how it must be marked, how it must be handled, and what to do when it's compromised. The "CUI how to identify if a document is marked" search Reed ran at 03:14 is — read against this document — the search of someone trying to figure out whether what he was about to handle was the legally-protected kind.

### ISO/IEC 27037 + 27042

[ISO/IEC 27037:2012](https://www.iso.org/standard/44381.html) (Guidelines for identification, collection, acquisition, and preservation of digital evidence) and [ISO/IEC 27042:2015](https://www.iso.org/standard/44406.html) (Guidelines for the analysis and interpretation of digital evidence) are the international equivalents to NIST SP 800-86.[^nist-800-86] They cover the same four-phase model with slightly different terminology and are referenced in many non-U.S. forensic-process certifications. If your work crosses jurisdictions, both documents are worth knowing.

### CWE references

[CWE-200](https://cwe.mitre.org/data/definitions/200.html) (Exposure of Sensitive Information) and [CWE-359](https://cwe.mitre.org/data/definitions/359.html) (Exposure of Private Personal Information) are the closest CWE entries to the suspect-side "vulnerability" framing. CWE-200 is marked Discouraged for mapping by MITRE because it's too broad; CWE-359 is the more precise variant.

### MITRE ATT&CK

Two techniques in MITRE ATT&CK's Enterprise matrix capture what Reed did:

- [T1119 — Automated Collection.](https://attack.mitre.org/techniques/T1119/) Reed's `rc-archive-helper.ps1` is a textbook custom-collector example. The Dropbox download (recovered in the bonus-find) is when the tool landed; the Bay 4 invocation is when it ran.
- [T1567 — Exfiltration Over Web Service.](https://attack.mitre.org/techniques/T1567/) Personal webmail (Gmail in this case) is the most common single-vector for low-volume CUI exfiltration; the 02:47 session opening is the channel pre-positioning.

A third technique is relevant on the defender side:

- [T1083 — File and Directory Discovery](https://attack.mitre.org/techniques/T1083/). The "CUI how to identify if a document is marked" Google search is the defender's window into Reed's awareness level about what he was about to handle.

---

### CWE-539 — Use of Persistent Cookies Containing Sensitive Information

[CWE-539](https://cwe.mitre.org/data/definitions/539.html) is the
weakness class the recovered session artifact belongs to, and it cuts
both ways in this level.

A persistent cookie survives the browser session by design, which is
what makes "remember me" work. The cost is that the authentication
material now sits on disk, in a database an investigator can query, for
as long as its expiry allows. From the provider's perspective this is a
usability decision with a documented weakness attached. From Reed's
perspective it is the artifact that identified his account.

Two things follow, and they should be kept separate in the write-up.

For **Polaris as a defender**, the finding is that a cleared workstation
retained authentication material for a personal service in recoverable
form. That is a control gap regardless of this investigation: any
attacker with disk access, and any future forensic examiner, obtains the
same artifact.

For **the investigation**, the cookie's evidentiary value is entirely in
what it *names* rather than what it *opens*. Using it would contaminate
the evidence and likely constitute unauthorised access. CWE-539 explains
why the artifact exists; it does not license using it, and the
restraint here is the professional standard being taught.

## §6 — Cert exam relevance

Forensic curricula align tightly to the techniques this level demonstrates. A non-exhaustive list of where you'll see browser-DB / SQLite forensics tested:

**GIAC GCFE (Certified Forensic Examiner).** [SANS FOR500: Windows Forensic Analysis](https://www.sans.org/cyber-security-courses/windows-forensic-analysis/) is the upstream course; [GCFE](https://www.giac.org/certifications/certified-forensic-examiner-gcfe/) is the cert. Browser-artifact forensics is one of the dominant exam domains. Both Chromium-family and Firefox schemas are explicitly covered, as is WAL-page recovery, cookie-database analysis, and the kind of cross-artifact reconstruction this level demonstrates. If you finish this level cleanly, you've performed roughly half of a typical GCFE practical-exam question.

**GIAC GCFA (Certified Forensic Analyst).** [SANS FOR508: Advanced Incident Response, Threat Hunting, and Digital Forensics](https://www.sans.org/cyber-security-courses/advanced-incident-response-threat-hunting-training/) is the upstream course; [GCFA](https://www.giac.org/certifications/certified-forensic-analyst-gcfa/) is broader-scoped than GCFE — endpoint forensics in general, with browser artifacts as one source among many. Comparable rigor; broader surface.

**EC-Council CHFI (Computer Hacking Forensic Investigator).** [CHFI](https://www.eccouncil.org/train-certify/computer-hacking-forensic-investigator-chfi-north-america/) is the vendor-neutral cert most often required by U.S. federal agencies under [DoD 8140](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodm/814003p.pdf). Browser DBs feature in the artifact-collection domain. Less rigorous than GCFE on the SQL formation side; broader coverage of legal procedure.

**CompTIA Security+ (SY0-701).** [Security+](https://www.comptia.org/en-us/certifications/security/) Domain 4 (Security Operations) covers digital-forensics fundamentals including "data sources" — browser artifacts are explicitly named. Sec+ is the entry-level reference; if you're doing security work and don't have it, the test is two hours and forty-five questions and worth the morning to take.

**CompTIA CySA+ (CS0-003).** [CySA+](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/) covers forensic analysis within the broader security-operations role; browser-artifact handling is one section. Intermediate-level cert.

**(ISC)² SSCP / CISSP.**[^cert-sscp][^cert-cissp] [SSCP](https://www.isc2.org/Certifications/SSCP) and [CISSP](https://www.isc2.org/Certifications/CISSP) cover digital forensics at the policy / process level rather than the SQL / artifact level. The frameworks discussed in §5 above are the SSCP / CISSP vocabulary.

**AccessData ACE / Magnet AX200 / Magnet AXIOM Certified Examiner (MCE).** Tool-specific certs. ACE is for FTK; the Magnet certs are for AXIOM (the dominant commercial browser-forensics tool in mobile + endpoint work). All three test on the same underlying schemas this level uses; they differ on the toolchain.

**SANS-CERT FOR585 (Smartphone Forensic Analysis In-Depth).** [FOR585](https://www.sans.org/cyber-security-courses/advanced-smartphone-mobile-device-forensics) is the deep-dive course on mobile forensics, which is approximately 80% SQLite parsing in practice. If you're going to do iOS / Android forensic work, this is the course.

The pattern across all of these: SQL formation against SQLite-backed application databases is the workhorse skill. Tools (FTK, EnCase, AXIOM, Cellebrite, Autopsy) automate the heavy lifting, but the analyst who can compose the queries directly is the one who can answer questions the tool didn't anticipate.

---

## §7 — What a defender does

Polaris's forensic posture comes out of this case looking pretty good. Maya's IR team had the discipline to image the workstation under correct procedure; Sgt. Chen escalated correctly under NISPOM; Dana coordinated outside counsel; the chain-of-custody discipline held through three days of analysis. The walkthrough is critical of the IR-team-password reuse anti-pattern (and so is Maya — she put it in the lessons-learned), but procedurally the case is textbook.

What Polaris (and any defender wanting to be ready for an equivalent case) should do PROACTIVELY:

### Endpoint browser policy enforcement

On managed devices in any cleared facility, Chrome Enterprise (or Edge Enterprise) should enforce policies that constrain the personal-use surface area:[^chrome-enterprise-policy-list]

- **`RestrictSigninToPattern`** — limits Chrome sign-in to a specific tenant domain. [Chrome Enterprise documentation](https://chromeenterprise.google/policies/#RestrictSigninToPattern). Set to `*@polaris-ds.local` (or equivalent) and Reed couldn't have signed into Chrome with his personal Google account. The personal-Gmail visit would still technically work in a guest profile, but the session token wouldn't persist past browser close and the artifact trail would be much thinner.
- **`URLBlocklist`** — blocks specific URL patterns. [Documentation](https://chromeenterprise.google/policies/#URLBlocklist). Entries for `mail.google.com`, `dropbox.com`, `drive.google.com` (personal-account flag), `mega.nz`, `mediafire.com`, and the long tail of consumer cloud-storage hosts.
- **`IncognitoModeAvailability`** — set to `Disabled` so a user can't bypass policy-tracked browsing by going incognito.
- **`DownloadDirectory`** — set to a monitored path so endpoint DLP can watch what gets downloaded.

These are enforced via Group Policy on Windows or via Chrome Enterprise's [cloud policy console](https://chromeenterprise.google/). The configuration is essentially a 30-minute exercise for a competent IT team.

### DLP rules on file-staging paths

Reed's exfil chain staged through `C:\Users\rconnolly\AppData\Local\Temp\sa-export.zip`. The pattern is recognizable: archive into Temp, then exfiltrate. Endpoint DLP products (Microsoft Purview, Trellix DLP, Forcepoint, etc.) can fire rules on this specific shape:

```
RULE: archive-stage-from-CUI
  CONDITION: a .zip / .7z / .rar / .tar file is created
             AND the source files came from a path under D:\CUI\
             AND the destination is in %TEMP% or %APPDATA%
  ACTION: block the archive operation + alert SOC
```

Polaris's environment didn't have this rule. A version of it would have caught Reed's chain in level1's 4688 window before the Compress-Archive completed.

### Browser-history retention policy

Cleared facilities should NOT clear browser histories on logoff. The forensic value of persistent histories is exactly what this engagement just demonstrated. Conversely, non-cleared environments may want a policy that periodically clears histories to limit the privacy surface — that's a privacy-posture decision, not a security one, and the decision should be conscious.

[Chrome's documented behavior](https://chromium.googlesource.com/chromium/src/+/main/components/history/core/browser/expire_history_backend.h) is to retain histories for 90 days by default and to vacuum the SQLite databases periodically. Forensic-retention policy can override this via [`SyncDisabled`](https://chromeenterprise.google/policies/#SyncDisabled) + [`HistoryDeletion` family of policies](https://chromeenterprise.google/policies/), which can prevent users from clearing their own histories. Document the policy choice; it has employee-monitoring legal implications under [GDPR (where applicable)](https://gdpr.eu/) and various U.S. state laws.

### Forensic readiness as policy

ISO/IEC 27037 calls this "forensic readiness."[^iso-27037] The idea: configure systems in advance so that when an incident happens, the data needed to investigate it is already preserved, in known locations, with known retention properties. Polaris's posture is in this neighborhood — they had image-acquisition tooling ready (FTK Imager licensed and on the IR jumpbox), a documented chain-of-custody process, a pre-defined handoff-password convention. Other organizations should aim for the same.

### IR-team password discipline

The awkward note from level1's 4625 record + the awkward note from this level's `ir-audit` service account password matching pattern — Maya's already on this. The general lesson: high-pressure roles (IR, sysadmin, security) attract password patterns because the operators are tired and the cognitive load is high. The defense is **password managers + hardware tokens**, not awareness training. Polaris should issue Yubikey-equivalent hardware tokens to every IR-team member and route service-account credentials through a vaulted system (HashiCorp Vault, CyberArk, Bitwarden Enterprise, etc.) so the password muscle-memory never re-emerges in the first place.

### Subpoena-readiness with cloud providers

The fact that outside counsel had a Google subpoena in flight Monday morning, ready to be expedited by a session-token deliverable, is operational maturity. Many organizations don't have established relationships with the major-cloud-provider legal-process teams; the first subpoena is the one that takes six weeks to traverse the queue. Polaris's outside counsel had the [Google Legal Investigations Support](https://support.google.com/transparencyreport/answer/9713961) channel pre-positioned. The general lesson: don't first-meet your cloud provider's legal team during an incident. Establish the channel during quiet periods.

---

### Sample detection rule (Sigma)

This level examines artifacts after the fact. The detection worth building
is the one that would have fired at the time, and the strongest signal in
the timeline is not any single action but when it happened.

```yaml
title: Off-hours interactive logon followed by consumer cloud-storage access
status: experimental
description: >
  Correlates an interactive logon outside business hours with subsequent
  traffic to consumer file-sharing hosts from the same workstation. Each
  half is unremarkable alone; together, on a cleared workstation holding
  CUI, they are the shape of staging-then-exfiltration.
logsource:
  product: windows
  service: security
detection:
  offhours_logon:
    EventID: 4624
    LogonType:
      - 2    # interactive, at the console
      - 10   # RemoteInteractive
  business_hours:
    UtcTime|re: 'T(1[3-9]|2[0-2]):'   # 13:00-22:59 UTC covers a US workday
  cleared_workstation:
    Computer|startswith: 'POL-WS-'
  condition: offhours_logon and cleared_workstation and not business_hours
falsepositives:
  - Legitimate after-hours work, which is common enough that this rule is
    an enrichment signal rather than a standalone alert. It earns its
    place when correlated with the network half below, not on its own.
  - Scheduled maintenance windows and on-call response. Exclude by
    change-ticket window rather than by account.
level: low
```

Rated `low` deliberately, and that rating is the point. Working late is not
an offence and a rule that pages on it will be turned off within a week.
Its value is as a correlation input: joined with proxy or firewall logs
showing the same host reaching a consumer file-sharing domain inside the
same session, the combination is worth waking somebody for.

The stronger control on a CUI system is not detection at all. Block
consumer file-sharing at the egress point and require an exception
process, so the interesting event becomes a blocked connection with a
name attached rather than a successful upload found in an image weeks
later.

## §7.5 — Optional exploration

This level carries one bonus find, accessible via the `progress --detail` command after you discover it. It's orthogonal to the credential-chain solve (you can complete the level without finding it) but it's the kind of artifact that turns a forensic engagement into a thorough one.

### The PowerShell exfil downloader in the downloads table

The `downloads` table in `History.sqlite` carries entries for every file Reed downloaded through Chrome. The query:

```
sqlite3 -header Reed/History.sqlite "SELECT target_path, url, start_time FROM downloads"
```

Returns three rows. Two of them are unremarkable (a quarterly-budget XLSX from the Polaris intranet, a soccer-tournament schedule PDF from the Centreville Sports Complex). The third is the bonus find:

```
target_path                                                | url                                                  | start_time
C:\Users\rconnolly\Downloads\rc-archive-helper.ps1         | https://www.dropbox.com/scl/fi/rc-archive-helper.ps1 | 2026-03-05 19:42:11
```

A PowerShell script named `rc-archive-helper.ps1`, downloaded from a personal Dropbox account, nine days before the Bay 4 incident. The same script that ran in level1's 4688 process-creation chain (Reed's PowerShell `Compress-Archive` invocation against `D:\CUI\Subsystem-A\*`).

This is independent corroborating evidence. The 4688 event log in level1 showed the script EXECUTING; this History.sqlite row shows it being PRE-STAGED. Two artifact sources, two timestamps, two angles on the same behavior. In forensic terms: when two independent artifact sources agree on the existence and timing of a behavior, the prosecution's case writes itself.

The MITRE ATT&CK technique is [T1119 (Automated Collection)](https://attack.mitre.org/techniques/T1119/) on the staging side and [T1567 (Exfiltration Over Web Service)](https://attack.mitre.org/techniques/T1567/) on the egress side. The pre-staging timestamp also matters for the legal framing: a behavior performed nine days in advance can't be characterized as a spur-of-the-moment lapse. It's a planned act.

The bonus find awards a marker in the engine's progress tracking and surfaces an aside in `progress --detail`. Mechanically it does nothing else — but the real-world lesson is the more substantial reward: when you're doing forensic work, **query orthogonally**. The credential-chain solve only required the `cookies` table. The bonus find required querying a table that was related but not strictly necessary. The discipline of running "what's in the downloads table?" without knowing what you'll find is the discipline of catching the second finding that turns a thin case into a strong one.

---

## §8 — Key takeaways

- **SQLite is the universal user-activity ledger.** Every browser, every mobile OS, every desktop app that stores local state — all SQLite. Whenever an investigation asks "what did this user do on this machine," there is almost always a SQLite database holding the answer.
- **The forensic asymmetry favors the defender.** A suspect can clear browsing data and log out of accounts, but SQLite WAL pages, cookie last_access timestamps, and download target_path strings survive far longer than the suspect's mental model expects.[^sqlite-wal-mode] Reed knew he was being investigated by 03:14 Saturday (the "CUI how to identify if a document is marked" search proves it). He didn't clear his history. He didn't sign out of Gmail. The asymmetry favored the defender on this case.
- **Hash before, hash after.** Chain-of-custody discipline is what makes forensic findings defensible under cross-examination. The `chain-of-custody.txt` baseline + the pre-query and post-query `sha256sum` runs are the procedural form. If the hashes diverge, the analysis is contaminated and STOPS. This isn't optional ceremony; it's the difference between a finding that holds up in a deposition and one that doesn't.
- **Don't read content unless authorized.** Today's task was the session-token deliverable, not the message content. The discipline of saying "out of scope" and meaning it is what distinguishes the firm.
- **When two artifacts agree, the case writes itself.** The level1 4688 PowerShell chain and this level's downloads-table `rc-archive-helper.ps1` row are independent artifact sources pointing at the same behavior. One artifact could be coincidence; two is rehearsal. Always query orthogonally to find the second source.
- **SQL formation is the workhorse skill.** Forensic tools (FTK, EnCase, AXIOM, Cellebrite, Autopsy) automate the heavy lifting, but the analyst who can compose queries directly is the one who can answer questions the tool didn't anticipate. The grammar this level taught (SELECT … FROM … WHERE LIKE … ORDER BY … LIMIT … COUNT(\*)) is enough for ~80% of practical forensic queries.
- **The framework stack matters.** NIST SP 800-86 (forensic process) + NIST SP 800-171 Rev 3 (CUI controls) + CMMC Level 2 (assessment) + NISPOM (cleared-facility regulation) + DoD CUI program (data-handling regulation) are the layered authority Polaris is operating under. The deliverable you produced sits inside that stack and is reviewable against it.
- **Defender hygiene is endpoint policy + DLP + forensic readiness.** Chrome Enterprise policies, file-staging DLP rules, browser-history retention discipline, and pre-positioned cloud-provider legal-process relationships are what turn a possible incident into a manageable one. None of these are expensive; all of them require operational maturity to actually deploy.
- **The walkthrough closes the level.** This document is what makes `level2@forensics` a finished engagement rather than a half-shipped exercise. Per the rule that took effect at v1.23.1: walkthroughs gate new level work. The next forensics level (`level3@forensics` — Reed's outbound mail headers) won't open until this writeup is merged.

Return to the lobby: `ssh guest@d3cyph3r`. The next breadcrumb is in your hand.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^nist-800-86]: [NIST SP 800-86 — Guide to Integrating Forensic Techniques into Incident Response](https://csrc.nist.gov/pubs/sp/800/86/final). The canonical U.S. government reference for the forensic process; §3.3 is the closest single-source reference for what this level demonstrates.
[^nist-800-171]: [NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information in Nonfederal Systems and Organizations](https://csrc.nist.gov/pubs/sp/800/171/r3/final). The CUI control set Polaris is operating under; the AU family is the relevant subset.
[^iso-27037]: [ISO/IEC 27037:2012 — Guidelines for identification, collection, acquisition and preservation of digital evidence](https://www.iso.org/standard/44381.html). International equivalent to 800-86; covers the same four-phase model.
[^cfr-32-2002]: [32 CFR Part 2002 — Controlled Unclassified Information](https://www.ecfr.gov/current/title-32/subtitle-B/chapter-XX/part-2002). The CUI Program regulation under the National Archives.
[^national-archives-cui-program]: [National Archives CUI Program](https://www.archives.gov/cui). Cross-government program landing; canonical reference for the CUI Marking Handbook and category index.
[^dfars-252-204-7012-safeguarding]: [DFARS 252.204-7012 — Safeguarding Covered Defense Information and Cyber Incident Reporting](https://www.ecfr.gov/current/title-48/chapter-2/subchapter-H/part-252/subpart-252.2/section-252.204-7012.). 72-hour reporting clock authority.
[^sqlite-wal-mode]: [SQLite WAL mode](https://www.sqlite.org/wal.html). The journal-page mechanism that lets historical row data survive deletion.
[^sans-for500]: [SANS FOR500](https://www.sans.org/cyber-security-courses/windows-forensic-analysis/).
[^chrome-enterprise-policy-list]: [Chrome Enterprise policy list](https://chromeenterprise.google/policies/). The catalog defenders should configure.
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-sscp]: [ISC2 SSCP — Systems Security Certified Practitioner](https://www.isc2.org/certifications/sscp).

### Further reading

- [ISO/IEC 27042:2015 — Guidelines for the analysis and interpretation of digital evidence](https://www.iso.org/standard/44406.html). Companion document to 27037.
- [NISPOM (32 CFR Part 117)](https://www.ecfr.gov/current/title-32/subtitle-A/chapter-I/subchapter-D/part-117). National Industrial Security Program Operating Manual.
- [DoDI 5205.16 — DoD Insider Threat Program](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520516p.pdf). Parent directive (reissued as an Instruction Dec 20, 2024; previously DoDD) for cleared-contractor insider-threat programs.
- [DoDI 5200.48 — Controlled Unclassified Information](https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520048p.PDF). DoD implementation of the CUI program (browser-only PDF at WHS).
- [DoD CMMC Final Rule (2024)](https://dodcio.defense.gov/CMMC/). CMMC Level 2 assessment objectives.
- [Chromium History database schema](https://chromium.googlesource.com/chromium/src/+/main/components/history/). The actual source code that creates the urls / visits / downloads / keyword_search_terms tables you queried.
- [Chromium Cookies schema](https://chromium.googlesource.com/chromium/src/+/main/net/cookies/). Same for the cookies file.
- [SQLite documentation](https://www.sqlite.org/docs.html). Authoritative reference for the database format.
- [SQLite VACUUM](https://www.sqlite.org/lang_vacuum.html). The compaction operation that eventually clears WAL pages (often deferred or never invoked).
- [T1119 — Automated Collection](https://attack.mitre.org/techniques/T1119/).
- [T1567 — Exfiltration Over Web Service](https://attack.mitre.org/techniques/T1567/).
- [T1567.001 — Exfiltration to Code Repository](https://attack.mitre.org/techniques/T1567/001/).
- [T1567.002 — Exfiltration to Cloud Storage](https://attack.mitre.org/techniques/T1567/002/). )
- [T1083 — File and Directory Discovery](https://attack.mitre.org/techniques/T1083/).
- [GIAC GCFE — Certified Forensic Examiner](https://www.giac.org/certifications/certified-forensic-examiner-gcfe/).
- [GIAC GCFA — Certified Forensic Analyst](https://www.giac.org/certifications/certified-forensic-analyst-gcfa/).
- [SANS FOR508](https://www.sans.org/cyber-security-courses/advanced-incident-response-threat-hunting-training/).
- [SANS FOR585 — Smartphone Forensic Analysis In-Depth](https://www.sans.org/cyber-security-courses/advanced-smartphone-mobile-device-forensics).
- [EC-Council CHFI](https://www.eccouncil.org/train-certify/computer-hacking-forensic-investigator-chfi-north-america/).
- [CompTIA Security+ (SY0-701)](https://www.comptia.org/en-us/certifications/security/).
- [CompTIA CySA+ (CS0-003)](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
- [13Cubed YouTube channel](https://www.youtube.com/@13cubed). Long-running forensic-tutorial channel; SQLite browser-DB recovery is a recurring topic.
- [Forensic Focus](https://www.forensicfocus.com/). Community of practice for digital-forensic examiners; the article archive is searchable by topic.
- [SANS DFIR Blog](https://www.sans.org/blog/?focus-area=digital-forensics-incident-response). Authoritative source for current research.
- [Magnet Forensics Research](https://www.magnetforensics.com/resource-center/). Vendor blog but technically substantive; AXIOM team writes about new artifact discoveries.
- [Murder of Laci Peterson — Wikipedia](https://en.wikipedia.org/wiki/Murder_of_Laci_Peterson). MapQuest browser-history evidence.
- [Death of Caylee Anthony — Wikipedia](https://en.wikipedia.org/wiki/Death_of_Caylee_Anthony). Browser-history evidence error in the prosecution case.
- [2019 Capital One data breach — Wikipedia](https://www.justice.gov/usao-wdwa/united-states-v-paige-thompson). Paige Thompson conviction (2022).
- [Strava heatmap controversy — The Guardian (2018)](https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases). Activity-database persistence at scale.
- [FTC Facebook 2019 settlement](https://www.ftc.gov/news-events/news/press-releases/2019/07/ftc-imposes-5-billion-penalty-sweeping-new-privacy-restrictions-facebook). Cambridge Analytica fallout.
- [CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html). Discouraged for mapping; use CWE-359 when applicable.
- [CWE-359 — Exposure of Private Personal Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/359.html). Precise variant for personal-information leakage.
- [Google Legal Investigations Support](https://support.google.com/transparencyreport/answer/9713961). The cloud-provider legal-process channel referenced in the solve.

---
