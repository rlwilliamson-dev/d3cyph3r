# level2@osint — The Internet Never Forgets

**Track:** OSINT · **Client:** Veridian Analytics · **Compliance regime:** HIPAA Security Rule (45 CFR Part 164, Subpart C) + HITRUST CSF v11 + NIST SP 800-66 Rev. 2 · **Builds on:** [`level1@osint`](/walkthroughs/#/osint/level1)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level3@osint`. If you haven't solved `level2@osint` yet, close this tab and come back after. The level's whole point is the moment you realize the "deleted" repo is still readable and the scrubbed handle is still in the archive — reading the writeup first removes it.

---

## §1 — The setup

You enter `level2@osint` by typing `AaronHinesMD/Pers0nal+AWS/2024+BrightBlu` at the password prompt — the AWS secret access key you pulled out of Aaron's committed `.env` in `level1@osint`. That's not a coincidence and it's not just a gate gimmick: the fact that the key still works is the first finding of this level. Aaron's AWS access key was committed to a public repo in July 2023 and, as of this engagement, has never been rotated. A leaked secret stays valid until it's revoked at the provider, and nobody revoked this one. Keep that in your head as you work — the password that let you in is itself evidence.

The engagement clock has moved to Thursday, 2026-05-21. Here's what happened since `level1@osint`. Wednesday at close of business you delivered the GitHub finding to Marisol Vega: a live `AKIA`-prefixed IAM user access key, an OpenFDA personal API key, and a Flask secret, all committed to `aaron-hines-md/personal-pgx-tool`'s `.env` at HEAD since 2023-07-14, with a `.gitignore` added two months later (listing `.env`) that never retroactively untracked the file. Your recommendation, in order, was the standard one: rotate the AWS key today, review CloudTrail/GuardDuty for misuse, and only *then* worry about cleaning the git history.

Aaron — anxious, well-meaning, and not a security person — did the satisfying thing instead of the correct thing. Thursday morning at 07:50 he deleted the entire `personal-pgx-tool` repository from GitHub and emailed Marisol: "Taken care of, the repo's gone." He did not mention rotating the key, because in his mental model deleting the repo *is* the fix. The repo held the secret; the repo is gone; therefore the secret is gone. That mental model is wrong in two independent ways, and showing Marisol exactly *how* it's wrong is the job today.

Marisol's note to Priya framed two tasks. First, the remediation check: prove what the Internet Archive still serves for the deleted repo, because if the capture still carries the `.env`, "I deleted it" demonstrably didn't make the secret unreadable — and it certainly didn't make it invalid. Second, a light archive sweep: Aaron has been online since his residency and is exactly the type to have a personal site and half-forgotten side projects from fifteen years ago. Find anything still exposed that he's stopped thinking about. Same scope discipline as the prior two tasks — public data only, read-only, Aaron alone, no family, no active testing of anything.

You're in the same chair: `intel` on the Driftwood OSINT engagement workstation, same shared service account, same case file (`VER-EXP-2026-002`). The Veridian legal frame is unchanged (HIPAA Business Associate, BAAs with payer/provider customers, HITRUST CSF v11 overlay, NIST SP 800-66 Rev. 2 reference, MA 201 CMR 17.00). As before, today's specific findings are about Aaron's *personal* footprint rather than Veridian's systems — but the framing matters for the brief, because the throughline of all three Veridian tasks is one competent person's personal security model lagging a decade behind his exposure.

## §2 — The solve

The path is a clean archive-recon chain: prove the deletion didn't remediate, then pivot from an old archived page to a forgotten identity, then read what that identity leaked. The new tool is `wayback`; you'll reuse `curl` to read archived snapshots and `sherlock` to pivot on a handle.

### Step 1: Open the workspace with the AWS key

```bash
guest@d3cyph3r:~$ ssh level2@osint
level2@osint's password: AaronHinesMD/Pers0nal+AWS/2024+BrightBlu
Connected: level2@osint
intel@osint:~$ whoami
intel
```

The gate password is the secret access key from level1's `.env`. It works because the key was never rotated — which is the entire deletion-vs-rotation lesson in a single login.

### Step 2: Read the three engagement files

```bash
intel@osint:~$ ls
engagement-notes.md  lessons-learned.md  subject-update.txt  welcome.md
```

`welcome.md` introduces the `wayback` command and explains what the Internet Archive does: it decouples "what's online now" from "what was ever online," and deleting content at the origin doesn't remove the captures. `engagement-notes.md` is Priya's update — Aaron deleted the repo, didn't confirm rotation, and Marisol wants the deletion-vs-rotation distinction made unmissable plus a light archive sweep. `subject-update.txt` is the formal case-file update carrying the two URLs in scope: the deleted repo and Aaron's old personal site (`http://www.aaronhines.net`, in the Wayback Machine since 2009 — it's how level0 dated his Gmail).

### Step 3: wayback the "deleted" repo — the remediation check

```bash
intel@osint:~$ wayback https://github.com/aaron-hines-md/personal-pgx-tool
Internet Archive — Wayback Machine
URL: https://github.com/aaron-hines-md/personal-pgx-tool
──────────────────────────────────────────
  Timestamp            Status   Snapshot URL
  2023-08-02 14:11:50  200      https://web.archive.org/web/20230802141150/https://github.com/aaron-hines-md/personal-pgx-tool
  2023-11-19 09:42:03  200      https://web.archive.org/web/20231119094203/https://github.com/aaron-hines-md/personal-pgx-tool
  2024-03-09 22:05:31  200      https://web.archive.org/web/20240309220531/https://github.com/aaron-hines-md/personal-pgx-tool
  2026-05-21 11:38:02  404      https://web.archive.org/web/20260521113802/https://github.com/aaron-hines-md/personal-pgx-tool

4 snapshots archived.
```

There it is. The 2026-05-21 row is a `404` — that's the archive capturing the now-deleted live page *after* Aaron's Thursday-morning delete. But the 2023 and 2024 rows are all `200`, and they're still served. **Deleting the live repo did nothing to the existing captures.** Anyone can open the 2024-03-09 snapshot and browse the repo's file tree — including the `.env` — exactly as it stood at HEAD. The deletion changed only one thing: it made the *current* URL 404. It did not unpublish the repo, and it did not touch the only thing that actually matters — rotating the key.

This fires the **Deletion theatre** bonus find (see §7.5).

### Step 4: wayback the old personal site — start the sweep

```bash
intel@osint:~$ wayback http://www.aaronhines.net
Internet Archive — Wayback Machine
URL: http://www.aaronhines.net
──────────────────────────────────────────
  Timestamp            Status   Snapshot URL
  2009-10-15 08:30:12  200      https://web.archive.org/web/20091015083012/http://www.aaronhines.net/
  2011-02-10 16:15:00  200      https://web.archive.org/web/20110210161500/http://www.aaronhines.net/robots.txt
  2011-06-14 09:32:10  200      https://web.archive.org/web/20110614093210/http://www.aaronhines.net/
  2013-04-22 19:48:55  200      https://web.archive.org/web/20130422194855/http://www.aaronhines.net/

4 snapshots archived.
```

Aaron's pre-residency personal site, captured from 2009 to 2013. Two captures are interesting: the 2011 homepage (the version of Aaron that linked his hobby accounts before he went professional) and a `robots.txt` capture (a map of what he wanted hidden — the bonus path in §7.5).

### Step 5: curl the 2011 homepage — recover the scrubbed handle

```bash
intel@osint:~$ curl https://web.archive.org/web/20110614093210/http://www.aaronhines.net/
[ Wayback Machine — captured 2011-06-14 09:32:10 ]
[ Archived from: http://www.aaronhines.net/ ]

  Aaron Hines
  [ About ]  [ Research ]  [ Running ]  [ Sailing ]  [ Links ]
  ...
  ── Around the web ──────────────────────────────────────────
  I try to keep my professional and personal lives separate, so
  most of these are under a handle rather than my name:

    - Code (GitHub):          github.com/aaron-hines-md
    - Sailing + homelab blog:  saltyhelm.net   <- that one's me;
                               I post as "saltyhelm"
    - Running log:             on Strava (ask me for the link)
  ...
    aaron.hines.md@gmail.com
```

This is the pivot. The 2011 Aaron, before he had a professional reputation to manage, wrote down the link between his real-name identity and his pseudonymous one: `saltyhelm`, on `saltyhelm.net`. His *current* professional profiles don't link the blog — he scrubbed it when he became Dr. Aaron Hines, MD. But the 2011 page is in the archive, and the archive kept the version where he told everyone. Note the corroborating selector too: the same `aaron.hines.md@gmail.com` from level0 ties the page to Aaron without ambiguity. **A pseudonym someone disconnected years ago is usually still sitting in a decade-old snapshot, one hop from their real name.**

### Step 6: sherlock the recovered handle — map the other life

```bash
intel@osint:~$ sherlock saltyhelm
Sherlock 0.14.4
[*] Checking username "saltyhelm" across social platforms
──────────────────────────────────────────

[+] Blog:       http://www.saltyhelm.net  (self-hosted; latest post: /posts/self-hosting-the-boat-logs , 2022-03-19)
[+] GitHub:     https://github.com/saltyhelm  (3 repos — homelab dotfiles + a Nextcloud compose; last push 2022-09)
[+] Mastodon:   https://mas.to/@saltyhelm  (homelab + sailing; last toot 2023-05-30)
[+] Reddit:     https://reddit.com/user/saltyhelm  (active in r/selfhosted, r/sailing)
[-] Twitter:    404
[-] Instagram:  404
[-] TikTok:     404

[*] Search complete.
```

A whole second footprint: a self-hosted blog, a GitHub under the alias, Mastodon, Reddit. This is "Aaron's other lives" — the hobby identity he kept walled off from his professional one. The blog's latest post is flagged right there: `/posts/self-hosting-the-boat-logs`.

### Step 7: curl the homelab blog post — extract the level3 breadcrumb

```bash
intel@osint:~$ curl http://www.saltyhelm.net/posts/self-hosting-the-boat-logs
saltyhelm.net — Self-hosting my boat-maintenance logs on the cabin Pi
posted 2022-03-19 by saltyhelm
...
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
means I did, in fact, expose this box to the open internet ...
```

The homelab post pastes Aaron's `docker-compose` to help other people doing the same thing — and the compose includes `NEXTCLOUD_ADMIN_PASSWORD=S4ltyHelm-Nextcloud-2022!` in cleartext, on a box his own update admits he exposed to the internet. **That value is the `level3@osint` breadcrumb.** It's the same failure mode as level1 (a credential in publicly-posted text), wearing a different hat: this time it's a "personal / hobby" channel rather than a professional repo, which is exactly why Aaron was even more careless with it.

The chain across the OSINT track is now complete and consistent: `BostonStrong#2013` (reused password) → `AaronHinesMD/Pers0nal+AWS/2024+BrightBlu` (committed AWS key) → `S4ltyHelm-Nextcloud-2022!` (pasted homelab password). Three credentials, three channels, one person whose exposure has been quietly compounding for years.

### Step 8: the hand-off

Your report for Marisol has two findings:

1. **The remediation check failed.** The deleted `personal-pgx-tool` repo is still fully served from its 2023-2024 Wayback captures, including the `.env`. Deleting the repo reduced casual discoverability but remediated nothing; the AWS key (still valid — it's the login to this workstation) must be **rotated at AWS**, today, and the account reviewed via CloudTrail/GuardDuty for misuse since 2023-07-14.
2. **A second, separate exposure.** Aaron's pseudonymous `saltyhelm` identity — recovered from his own scrubbed 2011 page in the archive — includes a homelab blog post that pastes a working Nextcloud admin credential on an internet-exposed host. Rotate that credential, take the post down (knowing the archive keeps a copy), patch/retire the exposed box, and fold the alias into the monitoring scope.

You did not use the AWS key, you did not log into the Nextcloud, you did not connect to the exposed host. Marisol writes the brief; she decides whether any of this becomes a separate active-testing engagement.

## §3 — The vulnerability

There are three distinct weaknesses here, and only one of them is a "credential in a file" in the level1 sense. The more interesting two are conceptual.

**Deletion is not remediation (the core lesson).** When a secret leaks to a public surface, two things are true and both must be addressed. (a) *The artifact is effectively permanent.* The Internet Archive, archive.today, search-engine caches, GitHub's fork network and events API, third-party clones, and the GitHub Arctic Code Vault all survive an origin delete. You cannot reliably un-publish. (b) *Independent of any artifact, the secret is compromised.* The only action that actually shrinks the exposure is rotating/revoking the credential at the provider so the leaked value stops authenticating. Aaron did (a) badly (the archive kept the repo) and skipped (b) entirely (the key still works). This isn't a CWE so much as an incident-response failure mode, and it's one of the most common ones there is: the instinct under pressure is to make the visible thing disappear, and the rotation step — the only one that matters — gets skipped.

**Alias attribution via selector reuse (CWE-200 family).**[^cwe-200] Pseudonymity is not anonymity and neither is privacy. People link their separate identities somewhere — an old bio, an "about/links" page, a reused avatar, a reused contact email, a distinctive writing style — and the link tends to survive in a place they've forgotten. Here the link was a page Aaron wrote himself and later scrubbed; the archive preserved the scrubbed version, and the reused `aaron.hines.md@gmail.com` removed any doubt. Once the alias is attributed, the "personal" content is read with the same eyes as the professional content — and hobby projects are where people are most careless precisely because they believe nobody is looking.

**Cleartext credential in publicly-posted content (CWE-312 / CWE-540).**[^cwe-312][^cwe-540] The Nextcloud admin password is pasted, in cleartext, in a public blog post, inside a `docker-compose` snippet. **CWE-312 (Cleartext Storage of Sensitive Information)** is the primary mapping; **CWE-540 (Inclusion of Sensitive Information in Source Code)** covers the configuration-as-published angle; **CWE-798 (Use of Hard-Coded Credentials)** carries over from the un-rotated AWS key.[^cwe-798] **CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)** is the umbrella but is mapping-Discouraged in current MITRE guidance — cite the specific children. The "developer pastes a working config to ask for / offer help" pattern is its own evergreen leak vector: Stack Overflow answers, GitHub issues, Discord pastes, and personal blogs are full of real credentials that the author assumed were either fake, internal, or nobody's business.

The robots.txt finding (see §7.5) is a fourth, smaller weakness: using a *disclosure-control* mechanism (robots.txt tells crawlers what to skip) as if it were an *access-control* mechanism (it does nothing to stop a human from reading the listed paths).

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Internet Archive captures, a scrubbed 2009 personal site, and a homelab blog post |
| What deletion achieved | Nothing. The live URL 404s while 2023-24 captures still serve the repository, and the AWS key was never rotated |
| Identity linkage | Archived content recovers a pseudonymous handle, which maps to further accounts |
| Also disclosed | A cleartext Nextcloud admin password pasted into a blog post |
| Regime | HIPAA as a Business Associate plus HITRUST CSF; a BA notifies the covered entity within 60 days, and the covered entity carries the individual-notice duty |

**Deletion is not remediation, and this level exists to make that
undeniable.** The repository was removed and the finding was considered
closed. The captures still serve the same `.env`, and the key it contains
still authenticates because nobody rotated it. Removing the copy you know
about while leaving the credential valid is the single most common false
remediation in this entire corpus.

**Alias linkage widens scope past the person's professional footprint.**
A handle recovered from a scrubbed decade-old site connects accounts that
no employer inventory lists, on platforms nobody thought to review. This
is the mechanism that turns a contained credential finding into a
standing exposure, and it is also where the assessment's ethical
obligations tighten: the goal is to determine reach, not to compile a
dossier on a private individual.

**The blog password is the reachable one, and it should be triaged
first.** An archived AWS key is a rotation problem. A cleartext admin
password for a self-hosted service is a live door, and self-hosted
homelab infrastructure is typically unpatched, unmonitored, and reusing
credentials with everything else the person runs. Age is not a control:
it means nobody has been watching.

## §4 — Real-world parallels

**Deleting a GitHub repo doesn't delete the data — Truffle Security's CFOR (July 2024).** Truffle Security documented that data from *deleted* repositories, *deleted* forks, and even *private* repositories on GitHub remains accessible — by design — through the fork network and the public events API. They coined the term **Cross Fork Object Reference (CFOR)** and, reviewing three widely-forked public repos from large AI companies, recovered **40 valid API keys from deleted forks**. GitHub's response to the disclosure was that this is "an intentional design decision and is working as expected." This is the exact lesson of this level, on the exact platform: Aaron deleted the repo, but on GitHub specifically, "deleted" is not "gone" — and the only safe assumption for any committed secret is that it is permanently public and must be rotated.

**Selector reuse deanonymized the Silk Road founder — Ross Ulbricht / "altoid" (2013).**[^ross-ulbricht-altoid-deanonymization-wikipedia] The canonical alias-attribution case. In Silk Road's earliest days, a user named **"altoid"** posted on the Bitcoin Talk and Shroomery forums promoting the new marketplace. Months later, an "altoid" post soliciting an "IT pro" asked interested parties to email **rossulbricht@gmail.com** — Ulbricht's real-name personal address. IRS investigator **Gary Alford**, working the case in 2013, found the link by searching the open web for early mentions of the site and pivoting on the reused handle. A reused username plus one reused email collapsed a pseudonymous identity into a real name. Aaron's `saltyhelm` → real-name link is the same shape, just lower-stakes and recovered from an archive instead of a live forum.

**The archive landscape is wider than people think — and Google pointed at it.** In **late January / February 2024**, Google removed the "Cached" link from its search results; Search Liaison Danny Sullivan confirmed the retirement and explicitly suggested the **Internet Archive's** capture as the replacement people should reach for.[^google-retires-the-cached-link] The practical effect: even as one historical-snapshot source went away, the dominant one (archive.org) got *more* central, and `archive.today` remains a fully independent third archive. There is no single "delete" button that reaches all of them. The **Internet Archive** itself has been capturing the web since its founding in **1996**, with the public **Wayback Machine launching in October 2001** — meaning a target's footprint may be archived across a quarter-century of captures they have no control over.

**Forgotten old accounts and location leaks — the Strava 2018 heatmap.** The recurring "the oldest, most-forgotten account is the most exposed" pattern. In January 2018, Strava's published global activity heatmap inadvertently revealed the layout and location of military forward-operating bases and intelligence facilities, traced to individual personnel running on-base with public default settings.[^strava-global-heatmap-exposure-january] The mechanism that matters here isn't fitness data specifically — it's that durable, low-attention personal accounts accumulate sensitive patterns the owner stops thinking about. For a publicly-named executive in a hostile-attention campaign, the forgotten footprint is the soft target.

What unites these cases: the web has a long memory and several independent ones. Removal at the source is necessary but never sufficient, and the only durable defenses are *rotation* (for secrets) and *not creating the linkage in the first place* (for identity).

## §5 — Frameworks, deep dive

### The Internet Archive / archive permanence (the mechanic, not a control)

archive.org (founded 1996; Wayback Machine public since October 2001) is a non-profit digital library. Site owners can request exclusion of their *own* captures, but it's opt-in, manual, and reaches neither other archives (archive.today) nor the GitHub fork network nor anyone's local clone. The correct mental model for OSINT and for incident response alike: **treat anything ever published as permanently captured**, and build remediation on rotation rather than removal.

### robots.txt — Robots Exclusion Protocol (RFC 9309, September 2022)

The Robots Exclusion Protocol — originally Martijn Koster's 1994 convention — became a formal IETF standard, **RFC 9309**, in September 2022.[^rfc-9309] The critical property for security work: robots.txt is a *politeness signal to well-behaved crawlers* about what not to index. It is **not an access control**. Every path listed in a `Disallow:` line is fully reachable by anyone who reads the file, and well-behaved is optional — crawlers can ignore it. OWASP's testing guide says it directly: robots.txt "should not be considered as a mechanism to enforce restrictions on how web content is accessed." Listing `/backup/` or a draft directory in robots.txt advertises exactly where the sensitive material is.

### OWASP

- **WSTG-INFO-03 (Review Webserver Metafiles for Information Leakage)** — the Web Security Testing Guide test that covers robots.txt, sitemap.xml, security.txt, and similar metafiles as information-leakage sources. The defensive takeaway: move private content off the public server entirely; don't "hide" it with a `Disallow` line.
- **OWASP Top 10 — A07:2025 (Authentication Failures)** — pseudonymous personal accounts with reused or pasted credentials feed the same credential-stuffing and account-takeover threat as anything else; the rename from "Identification and Authentication Failures" (2021) kept the slot.

### Secret rotation as the real remediation

- **NIST SP 800-53 Rev. 5, IA-5 (Authenticator Management)** — including IA-5(1).[^nist-800-53] When an authenticator is compromised, it must be revoked/replaced. A credential that has touched a public surface is a compromised authenticator by definition, regardless of whether the page it leaked from still exists.
- **NIST SP 800-218 (SSDF v1.1), PW.6 / PS.1** — secrets management and protecting code; the response to an exposed secret is rotation, not just removal from HEAD.[^nist-800-218]
- **AWS IAM guidance for an exposed access key** is explicit and ordered: deactivate the key, create a replacement, update applications, delete the exposed key, then review usage. "Delete the repository" appears nowhere on that list.

### MITRE ATT&CK

- **T1593 (Search Open Websites/Domains)** — the parent reconnaissance technique.[^t1593] The Internet Archive is the textbook open-website source for content no longer on the live origin.
- **T1593.002 (Search Engines)** — search-engine-style querying of archived/indexed content for leaked or sensitive material maps here.[^t1593-002]
- **T1593.001 (Social Media)** — the `sherlock` handle pivot across the alias's platforms.[^t1593-001]
- **T1589.001 (Gather Victim Identity Information: Credentials)** — both the still-archived AWS key and the pasted Nextcloud password are credentials recovered from open sources.[^t1589-001]
- **T1552.001 (Unsecured Credentials: Credentials In Files)** and **T1078 (Valid Accounts)** are the post-recon, attacker-side continuations — and the line our scope does not cross.

### CWE

- **CWE-312 (Cleartext Storage of Sensitive Information)** — the pasted Nextcloud password. Primary mapping for the breadcrumb finding.
- **CWE-540 (Inclusion of Sensitive Information in Source Code)** — the published `docker-compose` snippet.
- **CWE-798 (Use of Hard-Coded Credentials)** — carryover: the un-rotated AWS key, still a hard-coded, now-public credential.
- **CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)** — the umbrella; mapping-Discouraged in current MITRE guidance, so cite the specific children above.

### MITRE ATT&CK — archived material as an intelligence source

**[T1591 — Gather Victim Org Information](https://attack.mitre.org/techniques/T1591/)**

The technique is ordinary. What this level demonstrates is that its
source material does not expire.

An organisation's understanding of its own exposure is almost always
based on what is *currently* published. Aaron deleted the repository and
scrubbed the 2009 site, and by any live check both were gone. Neither
action reduced what an adversary can gather, because the Internet
Archive is not a copy of the current web; it is a record of the web as
it was, and it is indifferent to what the origin does afterwards.

For an assessment, this changes the question from "what does the
organisation publish" to "what has the organisation ever published."
Those are very different sets, the second is strictly larger and only
grows, and the practical consequence is that remediation for anything
found this way is always rotation and never deletion. Deletion changes
what a live check returns and nothing about what an adversary holds.

## §6 — Cert exam relevance

### SANS SEC497 (Practical Open-Source Intelligence) + GIAC GOSI

Archive-based recon (Wayback pivoting, deleted-content recovery), username / alias attribution, and identity deconfliction are core OSINT curriculum. "Deleted isn't gone" and "pivot on a reused selector" are first-week lessons. SEC497 is the flagship SANS OSINT practitioner course (effectively replaced SEC487 in the catalog); GOSI is the matching GIAC credential.

### CompTIA PenTest+ (PT0-003)

The current exam revision (released 2024). Domain 1 (Engagement Management) covers scoping and OSINT in pre-engagement; Domain 2 (Reconnaissance and Enumeration) covers passive recon and metadata review (robots.txt / sitemap / archived content).

### CompTIA CySA+ (CS0-003 / CS0-004)

The SOC-analyst credential. CS0-003 was current as of the May 2026 review date; **CompTIA released CS0-004 in early 2026 for parallel availability, with CS0-003 retiring June 2026** — through that window, candidates may sit either. Domain 1 (Security Operations) covers OSINT-driven threat intelligence and exposed-asset discovery.

### CompTIA Security+ (SY0-701)

The entry-level cert. Domain 2 (Threats, Vulnerabilities, and Mitigations) covers reconnaissance and OSINT; Domain 4 (Security Operations) covers identity and credential management, including rotation.

### ISC2 CISSP

Domain 1 (Security and Risk Management) covers threat intelligence / OSINT; Domain 2 (Asset Security) covers the data lifecycle, retention, and the reality that "delete" rarely means destroyed.

### GIAC GCIH (Certified Incident Handler)

The leaked-credential IR pattern is squarely in scope — and so is its classic failure mode: removing the artifact instead of rotating the secret. The "leaked credential → rotate → audit usage" workflow is the canonical case.

## §7 — What a defender does

Three tracks: Aaron specifically, Veridian as employer, and Driftwood for our own practice.

### For Aaron specifically

**Rotate the AWS access key now.** This is the actual remediation for the level1 finding; the repo deletion was not. Deactivate the exposed key in the IAM console, create a replacement, update his local `.env` (uncommitted), confirm, delete the old key. The moment it's deactivated, the historical copies in the Wayback capture become inert.

**Rotate the Nextcloud admin password and the OpenFDA key**, and take the `saltyhelm` blog post down — accepting that the archive keeps a copy, because rotation (not removal) is what neutralizes it.

**Treat the exposed homelab host as compromised until proven otherwise.** A years-old `nextcloud:24` container reachable from the internet via dynamic DNS has almost certainly been scanned and probed. Patch or replace the image, put it behind a VPN or take it off the internet, and review it for unauthorized access.

**Audit and close the forgotten footprint.** The `saltyhelm` GitHub, Mastodon, and Reddit accounts the sweep surfaced are old, low-attention, and likely share weak/reused passwords with no MFA. Inventory them, secure or close them, and stop reusing the handle across the personal/professional wall.

### For Veridian

**Add an archive sweep to the new-executive exposure playbook**, alongside the HIBP (task 1) and GitHub (task 2) steps. It's cheap and it catches the "forgotten old identity" surface that live-web checks miss entirely.

**Build the deletion-vs-rotation distinction into incident-response training.** The instinct to "take it down" is universal; the rotation step is the one that gets skipped under pressure. Make "rotate first, then clean up" the muscle memory.

**For Veridian-org GitHub specifically**, the Truffle Security CFOR finding means "delete the repo/fork" is not a valid response to a committed secret. The valid response is always: rotate the credential, then optionally clean history. Enable Push Protection to stop the leak at `git push` in the first place.

### For Driftwood (us)

**Hold the read-only line.** Attributing the `saltyhelm` alias from Aaron's own archived page is in scope. Logging into the Nextcloud to "confirm" the password works, or using the AWS key to "verify" it's live, is not — each crosses from passive OSINT into active testing, a different authorization and (for the exposed host) potentially a different legal posture. The temptation to "just check" is exactly the line a professional doesn't cross without paper.

**Document the snapshot URLs and capture dates.** The brief's persuasive force is the dated archive evidence — a 2024 capture of a repo Aaron deleted in 2026. Cite the snapshot URLs precisely so Aaron can verify them himself; that's what converts "deletion doesn't remediate" from an abstract claim into something he can see.

**Stop at the first concrete finding.** Marisol asked for a *light* sweep. You found a live credential exposure; that's the deliverable. Enumerating Aaron's entire pseudonymous life beyond the security finding is scope creep, and (for any third parties who appear in his hobby spaces) an ethics problem.

### Sample detection rule (Sigma)

The lesson of this level is that deleting the repository changed nothing,
because the key was never rotated. The detection that matters is
therefore about key age and dormancy, not about the archive.

```yaml
title: Access key used after prolonged dormancy
status: experimental
description: >
  Detects API activity from an access key with no recorded use in the
  preceding 90 days. A credential that goes quiet and then wakes up is
  either a forgotten integration or somebody who has just found it, and
  both warrant an answer.
logsource:
  product: aws
  service: cloudtrail
detection:
  key_activity:
    userIdentity.type: 'IAMUser'
    userIdentity.accessKeyId|startswith: 'AKIA'
  known_active_keys:
    userIdentity.accessKeyId:
      - 'AKIA_CI_RUNNER_KEY'
      - 'AKIA_BACKUP_AGENT_KEY'
  condition: key_activity and not known_active_keys
falsepositives:
  - Genuinely seasonal automation, such as annual reporting jobs. These
    should be enumerated in known_active_keys with a comment recording
    their cadence, so the exclusion is a decision rather than an
    accumulation.
level: medium
```

Detection is the weaker half here, and the report should say so. The
preventive control is a credential-lifecycle policy enforced by an
[IAM credential report](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html):
list every key with its age and last-used date, and disable anything that
crosses the threshold. That converts "we would notice if it were used"
into "it cannot be used," which is a materially different assurance.

There is also a control this level demonstrates has no detection at all.
Once a secret reaches a public archive it stays reachable regardless of
what the origin does, so the only remediation is rotation at the provider.
Any plan whose first step is "remove the content" has the order wrong, and
the Wayback captures in this level exist to make that concrete.

## §7.5 — Optional exploration

The credential chain works without this section. `level2@osint` seeds two bonus finds; `progress --detail` lists what you've unlocked.

### Deletion theatre

**Trigger:** `wayback https://github.com/aaron-hines-md/personal-pgx-tool` (step 3 of the solve, so you've already hit it).

**What it teaches:** the deleted repo is still served from its 2023-2024 captures while the live URL 404s — and, more important than the archive copy, the AWS key was never rotated (which is why it's the password that let you in). Takedown is not remediation; rotation/revocation at the provider is the only fix for a leaked secret. The real-world anchor is Truffle Security's [CFOR research (July 2024)](https://trufflesecurity.com/blog/anyone-can-access-deleted-and-private-repo-data-github): on GitHub specifically, data from deleted repos and forks is recoverable forever, by design — they pulled 40 valid API keys from deleted forks. Treat every committed secret as permanently public and rotate it.

### robots.txt as a treasure map

**Trigger:** `curl https://web.archive.org/web/20110210161500/http://www.aaronhines.net/robots.txt`

**What it teaches:** the archived 2011 `robots.txt` lists `Disallow:` paths pointing at exactly what Aaron wanted hidden — an old CV PDF, a `/backup/` directory, and a draft of the `saltyhelm` sailing blog (which corroborates the alias pivot independently of the homepage). robots.txt tells crawlers what to skip; it tells a human analyst precisely where to look. It's a *disclosure* control, never an *access* control — formalized in [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309.html) and tested under OWASP [WSTG-INFO-03](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/03-Review_Webserver_Metafiles_for_Information_Leakage). The defender fix is to move private content off the public server, not to `Disallow` it.

## §8 — Key takeaways

- **Deletion is not remediation.** For a leaked secret, removing the page it leaked from does nothing about the secret. Two truths: the artifact is effectively permanent (the Wayback Machine, archive.today, GitHub's fork network, clones, and caches all survive a delete), and the credential is compromised regardless. The only action that shrinks the exposure is **rotation/revocation at the provider**. Aaron deleted the repo and skipped the rotation; the AWS key still works, which is why it was the password to this level.

- **On GitHub specifically, "deleted" provably isn't gone.** Truffle Security's 2024 CFOR research showed deleted repos, deleted forks, and even private repos remain accessible by design — they recovered 40 live API keys from deleted forks. The correct response to a committed secret is never "delete the repo"; it's "rotate the credential, then optionally clean history."

- **Pseudonymity is not anonymity.** People link their separate identities somewhere — and the link survives in a place they've forgotten. Aaron's `saltyhelm` handle was recovered from a page he wrote and later scrubbed; the archive kept the scrubbed version, and a reused email removed all doubt. The canonical case is Ross Ulbricht, deanonymized by a reused "altoid" handle and a forum post carrying his real-name Gmail. Reused selectors collapse identities.

- **The oldest, most-forgotten account is the most exposed.** Old accounts carry the weakest passwords, no MFA, and the most personal data — and nobody remembers to close them. For a publicly-named executive in a hostile-attention campaign, that forgotten footprint is the soft target. Inventory it; close the dead accounts; never reuse a handle across the personal/professional wall.

- **robots.txt is a disclosure control, not an access control.** Every path in a `Disallow:` line is fully readable by anyone who opens the file — and the file is a map of what the owner wanted hidden. Move private content off the public server; don't advertise it with a `Disallow` line (RFC 9309 / OWASP WSTG-INFO-03).[^owasp-wstg-info-03-review]

- **OSINT scope discipline is the durable differentiator.** Attributing the alias from Aaron's own archived page is in scope; logging into the Nextcloud or using the AWS key to "verify" is not. The deliverable was two findings and a remediation list, stopped at the first concrete exposure. Holding that line — read, don't touch — is what makes the client trust you with the next engagement.

- **The three Veridian OSINT tasks compose into one picture.** Reused password → committed AWS key → pasted homelab credential: three channels, one person whose personal security model was built for a quieter career and never updated for his current public-figure exposure. None of the findings is exotic; their accumulation, assembled in the right order, is the story. OSINT done well is mostly that — assembling the ordinary before an adversary does.

## §9 — Further reading

*Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, RFC/standard IDs, historical-case dates, CWE/MITRE mapping status) verified current as of the review date. Standards drift; if you're reading this more than 6-12 months past the review date, re-check the cited versions before quoting them in audit work.*

[^google-retires-the-cached-link]: [Google retires the "Cached" link (Feb 2024)](https://searchengineland.com/google-search-officially-retires-cache-link-437122). Search Liaison Danny Sullivan confirmed the removal and suggested the Internet Archive as the replacement.
[^rfc-9309]: [RFC 9309 — Robots Exclusion Protocol (September 2022)](https://www.rfc-editor.org/rfc/rfc9309.html). The IETF standardization of robots.txt.
[^owasp-wstg-info-03-review]: [OWASP WSTG-INFO-03 — Review Webserver Metafiles for Information Leakage](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/03-Review_Webserver_Metafiles_for_Information_Leakage).
[^ross-ulbricht-altoid-deanonymization-wikipedia]: [Ross Ulbricht / "altoid" deanonymization (Wikipedia, with the `rossulbricht@gmail.com` forum-post detail)](https://en.wikipedia.org/wiki/Ross_Ulbricht).
[^strava-global-heatmap-exposure-january]: [Strava global heatmap exposure (January 2018)](https://www.theguardian.com/world/2018/jan/28/fitness-tracking-app-gives-away-location-of-secret-us-army-bases). The forgotten-footprint / location-leak pattern.
[^nist-800-53]: [NIST SP 800-53 Rev. 5 — IA-5 (Authenticator Management)](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). Revoke/replace a compromised authenticator.
[^nist-800-218]: [NIST SP 800-218 — SSDF v1.1](https://csrc.nist.gov/pubs/sp/800/218/final). Secrets management (PW.6 / PS.1).
[^cwe-312]: [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html).
[^cwe-540]: [CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html).
[^cwe-798]: [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
[^cwe-200]: [CWE-200: Exposure of Sensitive Information (mapping-Discouraged — cite the specific children)](https://cwe.mitre.org/data/definitions/200.html).
[^t1593]: [MITRE ATT&CK T1593 — Search Open Websites/Domains](https://attack.mitre.org/techniques/T1593/).
[^t1593-001]: [T1593.001 — Social Media](https://attack.mitre.org/techniques/T1593/001/).
[^t1593-002]: [T1593.002 — Search Engines](https://attack.mitre.org/techniques/T1593/002/).
[^t1589-001]: [T1589.001 — Gather Victim Identity Information: Credentials](https://attack.mitre.org/techniques/T1589/001/).

### Further reading

- [Internet Archive / Wayback Machine](https://web.archive.org/). Founded 1996; Wayback Machine public since October 2001.
- [archive.today (overview)](https://en.wikipedia.org/wiki/Archive.today). An independent web archive — reachable at archive.today / archive.ph — whose captures persist separately from the Internet Archive.
- [Truffle Security — "Anyone can Access Deleted and Private Repository Data on GitHub" (CFOR, July 2024)](https://trufflesecurity.com/blog/anyone-can-access-deleted-and-private-repo-data-github).
- [The Register coverage of the GitHub deleted-data finding (25 July 2024)](https://www.theregister.com/security/2024/07/25/data-from-deleted-github-repos-may-not-really-be-deleted/804909).
- [Vice — "If You're Running an Illicit Drug Site, Maybe Don't Use Your Real Email"](https://www.vice.com/en/article/irs-found-accused-silk-road-masterminds-email-by-googling-silk-road/). The IRS investigator's pivot on the reused handle + email.
- [AWS — What to Do If You Inadvertently Expose an AWS Access Key (AWS Security Blog)](https://aws.amazon.com/blogs/security/what-to-do-if-you-inadvertently-expose-an-aws-access-key/). Deactivate → replace → delete → review; deletion of the repo is not on the list.
- [SANS SEC497 (Practical OSINT)](https://www.sans.org/cyber-security-courses/practical-open-source-intelligence/).
- [OSINT Framework (community index)](https://osintframework.com/).
