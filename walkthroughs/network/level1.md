# level1@network — The Map Marcus Didn't Mean to Share

**Track:** Network · **Client:** Atlas Health · **Compliance regime:** HIPAA Security Rule + HITECH · **Builds on:** [`level0@network`](/walkthroughs/#/network/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@network`. If you haven't solved `level1@network` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left `level0@network`, Atlas Health had a Tier-1 incident on its hands. You had filed the perimeter finding: PostgreSQL 13.11 on `staging.atlas.health:5432`, listening on the open internet, guarded by a named default credential, `atlas-default-2025`, which Atlas's DevOps lead admitted to in a recorded Q1 2025 quarterly review and never rotated. An open port plus a known password is a HIPAA-grade exposure waiting for anybody with `nmap`, `psql` and a free evening.

The night after reads like a textbook escalation. Priya took the finding to Marcus at 8:42pm. Marcus opened an internal incident at 8:47pm, woke his on-call engineer at 8:52pm, and had a firewall ACL written by 11:30pm, with a deploy slot booked for the next morning's maintenance window. So when you walk back to Driftwood's audit workstation at 7:14am for Day Two, the firewall change is being staged and the credential rotation is on the calendar for Friday's regular change window, three days away. Marcus's reasoning is sound. Rotating `atlas-default-2025` means a coordinated push to all seven Atlas services that have it baked in, and doing that without a change-control plan risks breaking patient-facing systems. The Friday slot already has the right reviewers booked.

Sound reasoning, but it leaves a three-day gap between now and Friday, during which:

- The firewall ACL might stop most casual exposure, and does nothing about an attacker already on the host.
- The credential is still live everywhere it was live yesterday.
- The record of who has used the credential is essentially empty. Staging-db's auth logs go back 30 days, and the credential has been live for far longer than that.

Priya spent an hour on exactly that last night with Driftwood's engagement lead, between 9pm and 10pm. The question, roughly: *we know the credential was reachable and we don't know who else used it, so what do we owe the client in terms of checking the real blast radius before Friday?* Their answer is today's level.

Priya has authorized **one controlled, documented blast-radius check** using the still-live credential, on tight terms. Log in once. Do reconnaissance-only enumeration: no logging into anything you discover, no scraping databases, no lateral nmap from the foothold. Write up what is reachable from the compromised host, and leave. The point is not exploitation. It is an accurately scoped appendix for the incident report that lands on Marcus's CISO's desk tomorrow morning, so the recovery plan is sized to the real exposure and not the imagined one.

Mature consulting firms do this kind of authorized post-finding reconnaissance when they need to size an incident response, and it is legally and ethically delicate, because you are, technically, using a live credential to get into a client's production environment. The authorization letter Priya wrote, signed off by Driftwood's general counsel and countersigned by Marcus's CISO by 6am this morning, is what keeps the activity inside the scope of work and outside the Computer Fraud and Abuse Act. Without that paper, today's level would be a crime. With it, it is a Tuesday.

You are logged in as `dbadmin` on `staging-db.atlas.health`, a stock Ubuntu LTS box running PostgreSQL 13.11. `dbadmin` is the vendor service account that ships with Atlas's database provisioning template. Six months ago, during an upgrade, a junior engineer needed quick shell access for a debug session, somebody enabled `/bin/bash` on it, and nobody turned it back off. (That is a finding too, since a vendor service account has no business with an interactive shell, but it is not today's.) Your prompt reads `dbadmin@network:~$`.

The legal regime has not softened overnight. Atlas is HIPAA-covered, so the Security Rule (45 CFR Part 164, Subpart C) applies to every system touching electronic protected health information (ePHI).[^cfr-45-164] The HITECH Act sets the clock: 60 days from discovery to notify affected individuals; notice to HHS's Office for Civil Rights in the same window if 500 or more are affected; and public media notice for a breach of 500+ in a single state or jurisdiction, which means the regional news site's homepage.[^hhs-office-for-civil-rights-2] Atlas serves roughly 400,000 patients across the Pacific Northwest, so any meaningful exposure clears the 500 threshold before lunch.

What you don't know yet is that Atlas's internal DNS server is about to hand you the whole data centre's hostname inventory, plus a service-account credential, in a single `dig` command. Today's lesson is that the directory of internal services is often, also, a directory anyone who can reach the resolver is allowed to read.

## §2 — The solve

The puzzle itself is one command long. The reading around it is where the lesson lives.

### Step 1: Confirm the credential and what it bought you

```bash
guest@d3cyph3r:~$ ssh level1@network
level1@network's password: atlas-default-2025
Connected: level1@network
dbadmin@network:~$ whoami
dbadmin
dbadmin@network:~$ pwd
/home/dbadmin
```

You are on Atlas's staging database server as the default vendor service account. This is the access you watched leaking yesterday, and the same access any attacker who ran the same scan and read the same notes would have. You are standing exactly where they would stand.

Read what is in front of you before you touch anything.

### Step 2: Read the engagement context

```bash
dbadmin@network:~$ ls
.bash_history       atlas-internal.txt    lessons-learned.md
priya-note.md       welcome.md
```

Five files. Read them in order.

`welcome.md` covers mechanics: the new tool (`dig <domain> AXFR`) and what a zone transfer reveals. `priya-note.md` is the in-character handoff, with the day-two update, the rules of engagement and the legal frame for what you are about to do. `atlas-internal.txt` is the scope document listing Atlas's internal zones, with `atlas.internal` named as the only one in scope today. `.bash_history` is colour, showing `dbadmin`'s routine Postgres work and confirming this is a real working account. `lessons-learned.md` is for after you find the finding.

The critical pieces to extract:

- **The new tool**: `dig <domain> AXFR` asks the DNS server for every record in the zone. The server *should* refuse unless you are an authorized secondary nameserver authenticating with TSIG. In practice, a lot of them simply don't.
- **The internal DNS**: Atlas runs an authoritative resolver at `dns.atlas.internal` (`10.40.0.10`) for the `atlas.internal` zone, and the host you are on can reach it, because your DNS configuration points there for internal names.
- **The rules**: enumerate only; do not log into anything you discover; do not pivot.

### Step 3: Run the zone transfer

One command:

```bash
dbadmin@network:~$ dig atlas.internal AXFR
```

What comes back is the full zone, top to bottom:

```
; <<>> DiG 9.18.4 <<>> atlas.internal AXFR
;; global options: +cmd

atlas.internal.                  3600  IN  SOA   dns.atlas.internal. ops.atlas.health. 2026040901 7200 3600 1209600 3600
atlas.internal.                  3600  IN  NS    dns.atlas.internal.
atlas.internal.                  3600  IN  MX    10 mail.atlas.internal.
dns.atlas.internal.              3600  IN  A     10.40.0.10
mail.atlas.internal.             3600  IN  A     10.40.0.25
jumpbox-vpn.atlas.internal.      3600  IN  A     10.40.0.20
syslog.atlas.internal.           3600  IN  A     10.40.0.30
ntp.atlas.internal.              3600  IN  A     10.40.0.40
staging-db.atlas.internal.       3600  IN  A     10.40.10.5
staging-web.atlas.internal.      3600  IN  A     10.40.10.10
staging-api.atlas.internal.      3600  IN  A     10.40.10.15
prod-db.atlas.internal.          3600  IN  A     10.40.20.5
prod-web.atlas.internal.         3600  IN  A     10.40.20.10
prod-api.atlas.internal.         3600  IN  A     10.40.20.15
phi-warehouse.atlas.internal.    3600  IN  A     10.40.30.8
pacs-imaging.atlas.internal.     3600  IN  A     10.40.30.10
ehr-fhir.atlas.internal.         3600  IN  A     10.40.30.20
backups.atlas.internal.          3600  IN  A     10.40.40.12
audit-bypass.atlas.internal.     3600  IN  A     10.40.99.7
audit-bypass.atlas.internal.     3600  IN  TXT   "audit-bypass DEPRECATED creds — user=audit-svc pass=atlas-audit-bypass-2026 — added 2025-09-12 for Tessera Q4 dry-run, scheduled removal end of Q4"
atlas.internal.                  3600  IN  TXT   "v=spf1 ip4:10.40.0.0/16 -all"
atlas.internal.                  3600  IN  SOA   dns.atlas.internal. ops.atlas.health. 2026040901 7200 3600 1209600 3600

;; Query time: 12 msec
;; XFR size: 22 records
```

Twenty-two records. The SOA appears at both the start and the end, which is standard zone-transfer framing: RFC 5936 requires every AXFR response to open and close with the zone's SOA, so the receiver knows the transfer is complete.[^rfc-5936]

Now read it by tier, because the IP plan tells a story Atlas never meant to publish.

**Infrastructure tier (10.40.0/24).** `dns.atlas.internal` (10.40.0.10) is the resolver you are querying. Then `mail.atlas.internal` (10.40.0.25), `jumpbox-vpn.atlas.internal` (10.40.0.20), `syslog.atlas.internal` (10.40.0.30) and `ntp.atlas.internal` (10.40.0.40): the usual supporting services.

**Staging tier (10.40.10/24).** `staging-db.atlas.internal` is where you are; `staging-web` and `staging-api` are its neighbours. This is the segment you are authorized to know about.

**Production tier (10.40.20/24).** `prod-db`, `prod-web`, `prod-api`: the systems Atlas's real patients touch. By Atlas's stated architecture, staging should not be able to reach this tier at all. Resolving a hostname does not prove the firewall will pass the packets, but it hands a future attacker a target list. *You did not have to find these. DNS named them for you.*

**PHI / clinical tier (10.40.30/24).** This is the tier that makes the lesson specifically about HIPAA. Three hosts. `phi-warehouse.atlas.internal` is presumably the data warehouse aggregating clinical PHI for analytics. `pacs-imaging.atlas.internal` is a PACS (Picture Archiving and Communication System), the standard store for medical imaging such as radiology, MRI and CT, and imaging is among the most sensitive PHI there is, since an image can identify a person as surely as a name does. `ehr-fhir.atlas.internal` is presumably an EHR (Electronic Health Record) system exposing FHIR (Fast Healthcare Interoperability Resources, HL7's modern interoperability standard) APIs. Reach any of the three and you can exfiltrate PHI at scale.

**Backup tier (10.40.40/24).** `backups.atlas.internal`. Backups are a favourite target for ransomware operators, because the healthcare playbook now goes after them *first*: encrypt or destroy the backups, then encrypt production, and leave the victim no way back except paying. A backup host named in the zone file is, operationally, a target with a label on it.

**Shadow tier (10.40.99/24).** `audit-bypass.atlas.internal`. This is the one. It does not fit the tier scheme (10.40.99/24 is not part of the staging / prod / PHI / backups plan), the name says "bypass", as in something built to route around another control, and the subnet sits well above every other tier, as though someone parked it in a miscellaneous range to keep it out of tier-level inventory queries. Whether or not that was deliberate camouflage, it did not survive an AXFR.

And then the TXT record.

```
audit-bypass.atlas.internal.     3600  IN  TXT   "audit-bypass DEPRECATED creds — user=audit-svc pass=atlas-audit-bypass-2026 — added 2025-09-12 for Tessera Q4 dry-run, scheduled removal end of Q4"
```

A free-form text record holding a literal username, a literal password, the date it was added, why it was added (a vendor audit dry-run with "Tessera", whoever that is), and a scheduled-removal date that came and went with nobody removing anything. Whoever wrote it needed somewhere to stash a credential, had no secrets manager wired up for the job, and decided "well, DNS is internal anyway" was good enough.

It wasn't.

### Step 4: Document and stop

Priya's rules of engagement apply here, and they are the point of the level. You do not SSH into `audit-bypass.atlas.internal`. You do not query whatever database it fronts. You do not pivot. You write up exactly what the AXFR revealed and attach it to the incident-report appendix.

The minimum report content:

1. **AXFR is unrestricted** on `dns.atlas.internal` for the `atlas.internal` zone. This is the architectural finding.
2. **The internal hostname inventory is fully disclosed** to any host able to reach the resolver, including the staging-tier host the compromised credential reaches. The PHI tier hostnames (`phi-warehouse`, `pacs-imaging`, `ehr-fhir`) are in the disclosed list.
3. **A live credential is published in a public-readable TXT record** for an undocumented service account (`audit-bypass.atlas.internal`, user `audit-svc`, password `atlas-audit-bypass-2026`). The credential must be rotated as part of the incident response, in addition to the `atlas-default-2025` rotation already scheduled.
4. **The `audit-bypass` account itself is undocumented in Atlas's service inventory.** Atlas needs to determine who created it, when, for what purpose ("Tessera Q4 dry-run" per the TXT comment, but Tessera doesn't appear in the engagement notes), and whether it can be deprovisioned outright rather than just rotated.
5. **The blast radius of `atlas-default-2025` extends past staging-db** to anything `audit-bypass.atlas.internal` provides access to, and to anything an attacker would have done with the internal map between the credential's first exposure and Friday's rotation.

Send it to Priya, who routes it to Marcus's CISO with yesterday's report attached. Then exit the level.

```bash
dbadmin@network:~$ exit
```

### Step 5 (game-world only): Use the credential

In a real engagement, today ends there. In D3CYPH3R the credential chain continues into `level2@network`, with the audit-bypass account as the way in. Same mechanic as before: yesterday's leaked password gated today's level, and today's TXT-record credential gates tomorrow's.

```bash
guest@d3cyph3r:~$ ssh level2@network
level2@network's password: atlas-audit-bypass-2026
```

`level2@network` is playable, and its walkthrough picks up from here.

## §3 — The vulnerability

Today's finding looks like one bad DNS response. It is actually five failures stacked up, each a well-known anti-pattern, none of them exotic, and together they add up to the credential you just walked out with.

### Failure 1: The default credential was never rotated (CWE-1392)

`atlas-default-2025` is a vendor default. Marcus admitted to it in a Q1 2025 quarterly review and promised rotation "next sprint", and five sprints later it was still live. This is CWE-1392, *Use of Default Credentials*,[^cwe-1392] and it is about the cleanest weakness there is: the system shipped with a credential, the documentation said to change it, the team meant to change it, and nobody did.

CWE-1392 is the more specific successor to the older and broader CWE-798, *Use of Hard-coded Credentials*.[^cwe-798] MITRE draws a useful line between them. Hard-coded credentials are baked into source or binaries by developers; default credentials ship with a product and are documented as something the operator must change. The operator's fix is identical either way (change it, prove the change took, audit periodically), but the blame moves. A hard-coded credential is the vendor's failure. A default credential left in place is the operator's failure to follow the vendor's instructions.

Default credentials are still among the most common findings in real penetration tests, despite being one of the easiest weaknesses in existence to fix.

### Failure 2: The service account had an interactive shell (CWE-732)

A vendor-provisioned service account should not have `/bin/bash` as its login shell. Atlas's provisioning template created `dbadmin` as a Postgres-operations service account with `/sbin/nologin`. Six months ago, according to the change history, a junior engineer swapped in `/bin/bash` to debug an upgrade and never swapped it back.

That is CWE-732, *Incorrect Permission Assignment for Critical Resource*, the same weakness behind level1@linux.[^cwe-732] Different surface (a login shell rather than a file mode), same anti-pattern: a permission loosened for a one-off legitimate reason and never tightened again. MITRE gives CWE-732 an "ALLOWED-WITH-REVIEW" mapping status because people misuse it for authorization weaknesses that really belong under CWE-862 or CWE-863.[^cwe-863] Here it fits cleanly, since the permission to log in interactively was simply set wrong for a service account.

### Failure 3: The DNS server allowed AXFR from any source (CWE-306)

DNS zone transfer (AXFR, Authoritative Zone Transfer, specified in RFC 5936) is how authoritative DNS servers replicate a whole zone to one another. The legitimate use is simple: a primary pushes its zone to its configured secondaries so they can answer authoritatively too. The expected enforcement is just as simple: refuse AXFR from anything that is not a known, authenticated secondary.

Two enforcement modes are in common use. An **IP-based ACL** (`allow-transfer { 10.40.0.20; };` in BIND syntax) restricts transfers to a whitelist of source IPs, the historical model, and fine as long as the secondaries sit on stable, known addresses. **TSIG** (RFC 8945, formerly RFC 2845) authenticates transfers cryptographically: the requester presents an HMAC over the request using a shared secret, and the server checks it before answering.[^rfc-8945] TSIG is the modern recommendation because it survives IP changes, NAT and source spoofing, all of which defeat an IP ACL. Atlas's resolver does neither. Its `allow-transfer` is left at a permissive default, which in practice means anyone who can reach TCP 53 gets the zone.

That is CWE-306, *Missing Authentication for Critical Function*.[^cwe-306] Full zone replication is about as critical as DNS functions get, since the response contains every record in the zone, every hostname, every mail pointer and every free-form text record anybody ever attached. The requirement to authenticate it has been in the standards literature since the late 1990s. Failing to enforce it is mundane: the operator did not know, did not configure it, or configured something that never took effect.

CWE-306 has appeared on the CWE Top 25 repeatedly, because the general pattern of a critical function exposed without authentication turns up across every kind of protocol and system. The DNS version is one of the cheapest to fix and one of the most consistently overlooked.

### Failure 4: A live credential was stored in a public-readable record (CWE-200, with caveat)

Whoever needed to stash the audit-bypass credential for the Tessera dry-run picked the most convenient place within reach. TXT records will hold almost anything printable, up to 255 characters per string with several strings allowed per record, and anyone with DNS admin rights can edit them. "I just need to put this somewhere quickly" met "we already have DNS", and the rest is in your terminal.

This is CWE-200, *Exposure of Sensitive Information to an Unauthorized Actor*,[^cwe-200] whose entry covers exactly this: sensitive data placed where an unauthorized actor can read it. The caveat worth flagging is that MITRE marks CWE-200 **"Discouraged for mapping"** and asks mappers to use something more specific, because disclosure is an impact rather than a cause and CWE-200 fits almost any leak. So it serves here as the framework reference, and the actual fix is plainer: never store credentials in DNS records, and use a real secrets manager.

A useful companion is CWE-540, *Inclusion of Sensitive Information in Source Code*.[^cwe-540] Strictly it is about source code, but its spirit, never write a secret into an artifact whose visibility is controlled by something other than secret-grade access control, describes the DNS TXT case better than CWE-200's broad disclosure framing does.

### Failure 5: The "temporary" service account was never deprovisioned (the sticky-account anti-pattern)

The `audit-bypass` account was created for a one-off event, the "Tessera Q4 dry-run", presumably an external compliance audit Atlas was preparing for, and was supposed to disappear when that audit closed. It did not. The TXT record itself says "scheduled removal end of Q4". Q4 2025 ended five months before this level, and the account is still live and still advertised in DNS.

This is the sticky-account anti-pattern, well documented in IAM literature and named in several frameworks:

- **NIST SP 800-53 Rev. 5 AC-2(3)** (*Disable Accounts*) requires accounts to be disabled when no longer needed.[^nist-800-53]
- **CIS Critical Security Controls v8.1 Control 5.3** (*Disable Dormant Accounts*) is the same requirement, phrased operationally.[^cis-critical-security-controls-v8]
- **NIST SP 800-63B-4** (*Digital Identity Guidelines: Authentication and Authenticator Management*, July 2025, supersedes the 2017 edition) covers the full account lifecycle including credential deprovisioning.[^nist-800-63b] (The 2017 edition was titled "Authentication and Lifecycle Management"; the Rev 4 retitle reflects the broader scope.)

It fails the same way everywhere. A temporary access path gets created with good intentions, an expiry date gets mentioned in passing, nothing automated enforces the expiry, the people involved move on or forget, and the account lives forever. PAM platforms (CyberArk PAM, BeyondTrust Privileged Identity, HashiCorp Vault with TTL-bound dynamic secrets) exist precisely because a spreadsheet of expiry dates does not expire anything.

### The compound effect

Each failure on its own is a manageable finding. Stack them and you get today's level.

```
  unrotated default credential
    ↓
  service account with interactive shell
    ↓
  reach to the internal DNS resolver
    ↓
  AXFR allowed from any source
    ↓
  TXT record containing live credential
    ↓
  undocumented account with elevated access
```

Pull any one of the five out and the breach gets much harder. Rotate the default credential and you never get on the box. Remove the interactive shell and the credential buys a database connection but no DNS query. Segment staging away from the internal resolver and there is nothing to ask. Lock down AXFR and the zone does not dump. Keep credentials out of DNS and the dump carries no breadcrumb. The flip side is that full remediation is five separate pieces of work, each of which needs tracking, scheduling and verifying on its own.

Plenty of real breaches have exactly this shape. There is rarely one dramatic vulnerability holding the front door open. There are five or six mundane misconfigurations that happen to line up into a path. Locking down AXFR is good advice. The more useful lesson is that any one of these five would have stopped you.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | The staging-db host's internal DNS resolver, from a shell obtained with an unrotated vendor default |
| Disclosed | Atlas's full internal data-centre map via unauthenticated zone transfer, plus a service-account credential parked in a TXT record |
| Compounding weaknesses | CWE-1392 default credential, CWE-732 interactive shell on a service account, CWE-306 missing authentication on the transfer[^cwe-732][^cwe-1392][^cwe-306] |
| Exposure window | The default was flagged in a Q1 2025 review with rotation promised "next sprint"; five sprints later it was live |
| Escalates to | The credential recovered from DNS, which is `level2@network` |
| Regime | HIPAA Breach Notification Rule, 45 CFR 164.400-414: individuals within 60 days, and at 500+ also HHS plus in-state media[^cfr-45-164] |

**A zone transfer is not a data breach, and treating it as one will get
the finding dismissed.** No patient record moved. What moved is the map:
hostnames, addressing, and naming conventions for infrastructure Atlas
never intended to publish. The correct characterisation is that
reconnaissance which should have cost an attacker weeks now costs one
query, and that every subsequent finding in this track is cheaper because
of it.

**The credential in the TXT record is the more serious half, and it is
there for an ordinary reason.** DNS is a convenient key-value store that
every host can already reach, which is exactly why people use it as one.
It also answers to anyone who asks, keeps no meaningful access log, and
is rarely in scope for secret-scanning. A secret placed there is not
hidden; it is published to a service designed to distribute things.

**Three weaknesses had to align, and only one of them looks like a
security decision.** Rotating the default fixes the entry. Removing the
shell fixes the foothold. Restricting transfers fixes the disclosure.
Each is independently a finding, and remediation that addresses the
loudest one leaves the chain intact, which is what III.C.1.f-style
monitoring exists to catch and did not.

## §4 — Real-world parallels

Open zone transfers are one of the oldest misconfigurations in the catalog. AXFR enumeration was being written about in security literature in the mid-1990s, before CVE existed as an indexing system. What follows is not a history, which would be a different document, but three threads worth following.

### Thread 1: The chronic, low-attention pattern

Most open AXFR servers are found quietly. A researcher runs a passive sweep with Project Sonar (Rapid7's continuous internet-scanning project) or one of the public DNS-discovery services (SecurityTrails, DNSDumpster, Shodan, Censys), notices an authoritative server handing zone data to strangers, files a disclosure, and the operator fixes it.[^project-sonar-rapid7][^securitytrails][^dnsdumpster] Hardly any of these make the news, because the data is "just" hostnames: embarrassing, rarely a breach in itself. Today's TXT record is what happens when it is not just hostnames.

Rapid7's *National / Industry Cyber Exposure Reports* (NICER), built on Project Sonar's internet-wide scanning, have documented the scale of it, with AXFR-permitting authoritative servers turning up in large numbers. The fix has been published, free, in operator documentation (the BIND ARM, the PowerDNS docs, the Knot DNS docs) for decades. So the persistence is not a technical problem. It is an attention problem. Internal DNS gets configured once, by whoever was there first, and nobody looks at it again.

The OWASP Web Security Testing Guide (currently v4.2) puts DNS enumeration in its information-gathering chapter, with AXFR among the named techniques, so a black-box pentest following that methodology will try AXFR against the target's authoritative nameservers early on. It is routine enough to be automated in the major commercial scanners; Tenable Nessus, Qualys and Rapid7 InsightVM all include AXFR checks.

If your organization has never had a black-box external pentest, the question "would AXFR work against our zones?" is almost certainly unanswered. If it has, the better question is "did we actually fix last year's finding?"

### Thread 2: Healthcare-sector network compromises and the role of internal enumeration

Healthcare has been the worst-performing sector in breach reporting for years. HHS's Office for Civil Rights breach portal (the "Wall of Shame", officially *Breaches Affecting 500 or More Individuals*) lists hundreds of healthcare breaches a year affecting tens of millions of people in total.[^hhs-office-for-civil-rights] 2024 was the worst year on record by individuals affected, driven largely by the February 2024 Change Healthcare ransomware attack, which UnitedHealth Group disclosed had affected approximately 192.7 million individuals per Change Healthcare's notification to HHS OCR as updated in July 2025, up from the ~100 million estimate of October 2024 as the forensic scope widened.

Change Healthcare, attributed to the ALPHV/BlackCat ransomware-as-a-service operation, was a credential-driven compromise. Initial access came through stolen credentials for a Citrix portal with no multi-factor authentication, and the operators then spent nine days inside before deploying ransomware. Nine days is plenty of time for exactly what this level demonstrates: mapping internal services, finding the most valuable data stores, finding the backups. That enumeration phase maps to T1018 (Remote System Discovery) and T1590.002 (Gather Victim Network Information: DNS), the same techniques your `dig AXFR` maps to.[^t1590-002][^t1018]

The same pattern runs through recent healthcare ransomware:

- **CommonSpirit Health (October 2022)**: ransomware affected 164 hospitals and care sites across 21 states. 623,774 patients ultimately had their data exposed.[^commonspirit-2022]
- **Universal Health Services (September 2020)**: a Ryuk ransomware attack affected UHS operations across its 400+ facilities in the US and UK. Patient care diverted; staff fell back to paper records for weeks. Direct loss reported as $67 million; UHS publicly stated no patient data was confirmed exfiltrated.[^uhs-2020-ryuk]
- **Scripps Health (May 2021)**: ransomware disrupted all four of Scripps' hospitals (two heavily). 147,267 patients had PHI stolen; recovery took roughly four weeks; total reported cost ~$113 million.[^scripps-2021]
- **Ardent Health Services (November 2023)**: ransomware across 30+ hospitals in 6 states. ER diversions; surgeries postponed.

Beyond the payload itself, what these share is an internal-enumeration phase before the encryption: a foothold from stolen credentials, then a walk around the internal network using DNS reconnaissance, Active Directory enumeration and lateral SMB or RDP discovery. The "find the valuable targets" phase of a healthcare ransomware attack looks a great deal like the authorized blast-radius check you just did. Same techniques, opposite intent, and one signed letter of difference.

### Thread 3: Vendor-engagement service accounts that outlived their use

The audit-bypass account, created for a one-off vendor audit dry-run and never removed, is a close match for one of the most consistently cited patterns in identity management.

The **SolarWinds Orion supply-chain compromise (disclosed December 2020)** started with a compromised build pipeline, but the remediation guidance that followed kept coming back to identity. CISA's advisories, AA20-352A ("Advanced Persistent Threat Compromise of Government Agencies, Critical Infrastructure, and Private Sector Organizations") and AR21-134A ("Eviction Guidance for Networks Affected by the SolarWinds and Active Directory/M365 Compromise"), treat service-account and identity-platform hygiene as recurring remediation themes.

The **Okta support-system breach (October 2023)** is a cousin of today's finding. The initial access came through credentials for a service account that an Okta employee had saved to a personal Google account, which an attacker then compromised. A service account's credential, living somewhere it never should have been, became the way in.

Far more often, and far less famously, it turns up as a routine pentest finding: service accounts created for a vendor engagement, an integration or a one-off project, kept indefinitely with their original permissions, often holding more access than the original reason ever needed. The mitigations are well established (an account registry, mandatory expiry dates, automated deprovisioning, periodic recertification) and widely skipped. Verizon's *Data Breach Investigations Report* keeps ranking credential-related compromise among the top initial-access vectors. The 2026 edition recorded a reshuffle, with vulnerability exploitation taking the top slot at 31% of breaches, but credential-driven access remains the persistent runner-up, and sticky accounts are part of why.[^verizon-dbir]

The audit-bypass account is fictional, and it is also the most ordinary finding imaginable: created in good faith for a specific purpose, documented poorly, deprovisioned never. The TXT-record leak makes it worse, but the underlying weakness is the account existing at all, five months past its own scheduled removal date.

## §5 — Frameworks, deep dive

The in-game post-mortem (`lessons-learned.md`) gives the high-level framework mapping. This section adds what an auditor actually cites: the specific section, control and paragraph identifiers, plus the remediation language each framework expects to see.

### CWE — Common Weakness Enumeration

**CWE-306: Missing Authentication for Critical Function.**[^cwe-306] The primary weakness for the AXFR failure. The CWE catalog entry describes the weakness as "the product does not perform any authentication for functionality that requires a provable user identity or consumes a significant amount of resources." AXFR fits both halves: it requires a provable identity (the requester should be a known secondary nameserver) and consumes significant resources (the full zone dump). CWE-306 has been on the CWE Top 25 *Most Dangerous Software Weaknesses* list multiple times, most recently the 2024 edition. The MITRE mapping status is **ALLOWED**, it's a valid weakness ID for analytics and reporting.

**CWE-1392: Use of Default Credentials.**[^cwe-1392] Maps the unrotated `atlas-default-2025`. CWE-1392 is the more recent, more specific successor to CWE-798 (*Use of Hard-coded Credentials*); use it when the credential is a vendor-shipped default that the operator failed to change, rather than a developer-baked secret. MITRE mapping status: **ALLOWED**.

**CWE-732: Incorrect Permission Assignment for Critical Resource.**[^cwe-732] Maps the `/bin/bash` shell on the `dbadmin` service account. MITRE mapping status: **ALLOWED-WITH-REVIEW**, the entry notes that CWE-732 is frequently misused for authorization weaknesses (which belong under CWE-862 *Missing Authorization* or CWE-863 *Incorrect Authorization*); the shell-mode case here fits the literal CWE-732 definition correctly.

**CWE-200: Exposure of Sensitive Information to an Unauthorized Actor.**[^cwe-200] Maps the TXT-record credential leak. MITRE mapping status: **DISCOURAGED**, the entry is "frequently misused" and is too broad to be useful for fine-grained analytics. Cite CWE-200 as the framework reference; for surgical analysis use CWE-540 (*Inclusion of Sensitive Information in Source Code*, extended in practice to "any non-secret-grade artifact") as the better-fitting weakness.[^cwe-540]

**CWE-540: Inclusion of Sensitive Information in Source Code.** The narrower, more useful weakness for the TXT-record case. The literal catalog text is about source code, but the spirit, "credentials should not appear in artifacts whose access control is not credential-grade", fits the DNS-record case directly.

### NIST SP 800-53 Rev. 5

NIST Special Publication 800-53 Revision 5 (the federal control catalog, also widely used by the private sector) addresses today's findings across several control families.[^nist-800-53]

**SC-22, Architecture and Provisioning for Name/Address Resolution Service.** The most surgical fit for the AXFR failure. SC-22's control text requires that the system "provide name/address resolution services for organizational users that perform fault-tolerant name/address resolution services; implement internal/external role separation." (The SC-22(1) enhancement that lived separately in Rev 4 was incorporated into the SC-22 base control in Rev 5.) Atlas's resolver fails the architecture-and-provisioning requirement by not implementing the standard AXFR restriction.

**SC-7, Boundary Protection.** The fact that `staging-db.atlas.health` can reach `dns.atlas.internal` at all is a network-segmentation finding. SC-7 requires that the system "monitor and control communications at the external boundary of the system and at key internal boundaries within the system." The internal boundary between the staging tier and the management tier (where DNS lives) is not enforced.

**AC-3, Access Enforcement.** The DNS server is required to "enforce approved authorizations for logical access to information and system resources." Allowing AXFR from any source is a failure to enforce the (implicit) authorization that only secondary nameservers should receive zone data.

**AC-2(3), Disable Accounts.** The audit-bypass account's continued existence past its scheduled removal date is the violation. AC-2(3) requires that accounts be disabled within an organization-defined time period when they're no longer required (the original "Tessera Q4 dry-run" purpose ended; the account didn't).

**AC-6, Least Privilege.** The `dbadmin` service account with an interactive shell has more privilege than its operational purpose requires. AC-6's control text is "employ the principle of least privilege, allowing only authorized accesses for users (or processes acting on behalf of users) that are necessary to accomplish assigned organizational tasks."

**IA-5, Authenticator Management.** Covers the credential-management lifecycle, including "establishing initial authenticator content for any authenticators issued by the organization" and "establishing and implementing administrative procedures for initial authenticator distribution." Default authenticators that ship with vendor products and the operator's obligation to change them fall under this control.

### NIST SP 800-81 Rev 3 — Secure Domain Name System (DNS) Deployment Guide

The authoritative federal DNS hardening guide. **NIST SP 800-81 Rev 3 was published as final on March 19, 2026**, simultaneously withdrawing the long-standing SP 800-81-2 (2013).[^nist-800-81] Operators familiar with the older document should re-read; Rev 3 is a substantial expansion rather than a refresh, it adds chapters on Protective DNS (PDNS), encrypted DNS transports (DoT, DoH, DoQ), zero-trust integration, OT/IoT environments, and forensic logging, none of which were addressed in SP 800-81-2.

The AXFR guidance carries through from the 2013 document but is now in a different chapter. The recommendation remains: AXFR allowed only to known secondary nameservers, authenticated via TSIG. The BIND `allow-transfer { key tsig-key; };` syntax is unchanged. The change in Rev 3 is that AXFR sits inside a broader "zone integrity and replication" treatment that explicitly cross-references zone signing (DNSSEC) and encrypted-transport integration.

If you've been relying on SP 800-81-2 as your DNS hardening reference, swap to Rev 3, the older document's `csrc.nist.gov/publications/detail/sp/800-81/2/final` URL still resolves but now shows the "(Withdrawn)" status banner.

### HIPAA — 45 CFR Part 164

The Privacy and Security Rules apply to Atlas Health as a HIPAA-covered entity.[^cfr-45-164]

**§164.312(a)(1), Access Control (Technical Safeguard).** Requires covered entities to "implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights." The architectural mechanism Atlas uses for PHI access control is network segmentation between the staging tier (no PHI) and the PHI tier. Today's finding doesn't directly cross the segmentation boundary, but it discloses where the boundary is, which is the first step of any subsequent attack against the boundary.

**§164.312(e)(1), Transmission Security (Technical Safeguard).** Covers "technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network." Hostname enumeration via AXFR is the prerequisite for targeted transmission-layer attacks; the technical-safeguards control is implicated even though no PHI was directly transmitted in today's recon.

**§164.502, Uses and Disclosures of Protected Health Information: General Rules (Privacy Rule).** The "minimum necessary" standard at §164.502(b) requires that uses, disclosures, and requests for PHI be "limited to the minimum necessary" to accomplish the intended purpose. Exposing the internal-network map of every PHI system to any host that can reach the resolver is the opposite of minimum-necessary.

**§164.530, Administrative Requirements (Privacy Rule).** Subsection (c)(1) requires "appropriate administrative, technical, and physical safeguards to protect the privacy of protected health information." DNS zone-transfer hardening sits in the technical-safeguards bucket; the failure here is an administrative-safeguards failure as much as a technical one (no review process caught the misconfiguration).

**§164.404 (HITECH), Notification to Individuals.** Sixty-day clock from discovery to individual notification. If today's finding leads to evidence that the credential was used by an attacker before remediation, the breach is notifiable under HITECH and the clock starts when Atlas's forensic team confirms the use.

**§164.408 (HITECH), Notification to the Secretary.** Breaches affecting 500 or more individuals require notification to HHS Office for Civil Rights within the same 60-day window; smaller breaches get aggregated annual reporting. Atlas's patient population means any confirmed exposure here lands in the immediate-notice category.

### CIS Critical Security Controls v8.1

The Center for Internet Security's *Critical Security Controls v8.1* (released June 2024; the v8.1 minor revision updated the IG (Implementation Group) mapping and added language on cloud-native deployments without changing the core 18 controls structure introduced in v8).

**Control 4, Secure Configuration of Enterprise Assets and Software.** Covers the broader category of "the software arrived configured wrong and we didn't fix it." Sub-controls 4.7 (Manage Default Accounts on Enterprise Assets and Software) and 4.8 (Uninstall or Disable Unnecessary Services on Enterprise Assets and Software) are both directly implicated.

**Control 5, Account Management.** Sub-control 5.3 (Disable Dormant Accounts) covers the audit-bypass-account-never-deprovisioned finding. Sub-control 5.4 (Restrict Administrator Privileges to Dedicated Administrator Accounts) is the structural fix for the `dbadmin`-shouldn't-have-a-shell problem.

**Control 12, Network Infrastructure Management.** Sub-control 12.2 (Establish and Maintain a Secure Network Architecture) is the umbrella for DNS hardening and segmentation. Sub-control 12.3 (Securely Manage Network Infrastructure) covers the configuration-management side, versioned, reviewed, audited config for DNS servers.

**Control 13, Network Monitoring and Defense.** Sub-control 13.4 (Perform Traffic Filtering Between Network Segments) addresses the staging-can-reach-DNS-resolver finding. Sub-control 13.7 (Deploy a Host-Based Intrusion Detection Solution) and 13.8 (Deploy a Network Intrusion Detection Solution) would have alerted on the AXFR attempt.

### OWASP

**OWASP Web Security Testing Guide v4.2.**[^owasp-web-security-testing-guide] The current edition. Information Gathering is the first chapter; DNS enumeration techniques (including AXFR) are documented across multiple sub-sections covering footprinting and infrastructure mapping. Any OWASP-methodology black-box engagement will run AXFR in the first hour.

**OWASP Top 10 (2025).**[^owasp-top-10-2025] The 2025 edition reshuffled several positions from 2021. The umbrella category for today's finding is **A02: Security Misconfiguration** (moved up from A05 in the 2021 list). The category text explicitly calls out "default accounts and their passwords still enabled and unchanged" and "unnecessary features are enabled or installed" as examples, both apply.

The 2025 Top 10 also expanded **A03: Software Supply Chain Failures** (broader than the 2021 *Vulnerable and Outdated Components* category, now covers the full software supply chain rather than just outdated dependencies) and retained **A07: Authentication Failures** (renamed from 2021's *Identification and Authentication Failures*, same position). Default credentials map into the A07 category by content and A02 by example-list inclusion; most auditors will cite both. The 2025 edition also introduces a brand-new **A10: Mishandling of Exceptional Conditions** and elevates **A04: Cryptographic Failures** (which had been A02 in 2021), neither applies directly to today's finding, but they're worth knowing when comparing 2021-era and 2025-era audit reports against each other.

### MITRE ATT&CK — the two techniques the credential enables

The zone transfer is reconnaissance. What the recovered credential
enables afterwards is the part that matters for scoping, and the
in-game post-mortem names both halves.

**[T1078, Valid Accounts](https://attack.mitre.org/techniques/T1078/)**

A working credential is the cleanest access primitive an adversary can
hold: no exploit, no malware, no anomaly in any signature-based control.
ATT&CK lists it under Initial Access, Persistence, Privilege Escalation
*and* Defense Evasion, which is unusual and is the point. One artifact
serves four tactics at once, and every action it enables looks like
legitimate use in the logs. This is why the unrotated default in this
level is a more serious finding than the zone transfer that disclosed
the map.

**[T1133, External Remote Services](https://attack.mitre.org/techniques/T1133/)**

The service account was reachable from outside with an interactive
shell, which is the combination this technique describes. Atlas's
perimeter was asserted to be VPN-only; it was not. An adversary using
valid credentials against an externally-reachable service generates no
exploitation signal at all, so detection has to come from the account's
*behaviour* rather than from the connection itself: where it
authenticates from, at what hour, and whether a service identity has any
business running an interactive session.

## §6 — Cert exam relevance

The certification industry has been teaching this finding for decades. If you study any of the certs below, you've seen, or will see, the DNS zone transfer example.

**CompTIA Security+ (SY0-701).**[^cert-security-plus] The current exam (released November 2023). Domain 4 (*Security Operations*) covers DNS enumeration as a reconnaissance technique; the official objectives list `dig`, `nslookup`, and `whois` as named tools. Domain 3 (*Security Architecture*) covers DNS hardening from the defender side. Expect 2-3 questions touching the AXFR concept across a full exam attempt.

**CompTIA CySA+ (CS0-003).**[^cert-cysa] The current exam (released June 2023). Domain 2 (*Threat Intelligence and Threat Hunting*) covers the "what does an adversary see from outside?" question that AXFR is one answer to. Domain 1 (*Security Operations*) covers DNS log analysis, the AXFR-request-monitoring half of the defender story.

**CompTIA PenTest+ (PT0-003).**[^cert-pentest-plus] The current exam (released December 2024, replacing PT0-002 which sunsets in mid-2025). Domain 2 (*Reconnaissance and Enumeration*) names DNS enumeration explicitly; AXFR is among the directly-listed techniques in the official exam objectives. Domain 3 (*Vulnerability Discovery and Analysis*) covers the follow-on of identifying internal services from the enumeration.

**(ISC)² CISSP.**[^cert-cissp] Domain 4 (*Communication and Network Security*) covers DNS as a protocol with documented hardening requirements; the CBK chapters on DNS specifically reference RFC 5936 (AXFR) and RFC 8945 (TSIG).[^rfc-8945][^rfc-5936] Domain 3 (*Security Architecture and Engineering*) covers the architectural decisions, secure naming services, zone segregation, secondary nameserver placement.

**Offensive Security OSCP / PEN-200.**[^cert-oscp] OffSec's flagship offensive cert. The PEN-200 course material covers DNS enumeration as a standard part of the information-gathering phase; the lab environment includes machines where AXFR is the intended initial-recon win. The exam itself doesn't directly test "did you find the AXFR misconfig" as a discrete question (it's a practical exam), but the methodology that gets candidates to the foothold relies on the recon habits PEN-200 teaches.

**SANS GIAC GSEC / GCIH / GCIA / GPEN.**[^cert-gpen][^cert-gcia][^cert-gsec][^cert-gcih] The SANS curriculum covers DNS recon across multiple courses. GSEC's *Security Essentials*, GCIH's *Hacker Tools, Techniques, and Incident Handling*, GCIA's *Intrusion Analyst* (DNS log analysis is a substantial chapter), and GPEN's *Network Penetration Tester* (AXFR is among the named techniques). The GCIH and GPEN material is the most directly relevant.

## §7 — What a defender does

The short version is in the in-game `lessons-learned.md`. This expands each point into the operational detail that gets a defender from "I read about this" to "I shipped the change to production".

### 1. Restrict AXFR at the authoritative nameserver

The configuration is one line in the right place. The harder work is identifying which nameserver software you're actually running and what its config syntax is.

**BIND (ISC BIND 9.x).** The most common authoritative DNS implementation. In `named.conf` (or the per-zone include):

```
zone "atlas.internal" {
    type primary;
    file "atlas.internal.zone";
    allow-transfer { key "tsig-atlas-internal"; };
    notify yes;
    also-notify { 10.40.0.11; 10.40.0.12; };
};

key "tsig-atlas-internal" {
    algorithm hmac-sha256;
    secret "<base64-encoded-shared-secret>";
};
```

The shared secret is configured on both the primary and each secondary (the secondaries reference the key in their `masters` block). Rotate the secret periodically; treat it as credential-grade.

**Knot DNS.** Knot's `knot.conf` syntax:

```yaml
key:
  - id: tsig-atlas-internal
    algorithm: hmac-sha256
    secret: <base64-encoded-shared-secret>

acl:
  - id: acl_xfr_atlas
    address: [10.40.0.11, 10.40.0.12]
    key: tsig-atlas-internal
    action: transfer

zone:
  - domain: atlas.internal
    file: atlas.internal.zone
    acl: acl_xfr_atlas
```

Knot is increasingly common in deployments that have outgrown BIND's memory profile or want the more modern operational tooling.

**PowerDNS Authoritative.** PowerDNS uses a backend-driven model (zone data in a database, typically MySQL/PostgreSQL). AXFR restriction is set per-zone in the database or via `pdns.conf` directives:

```
allow-axfr-ips=10.40.0.11,10.40.0.12
also-notify=10.40.0.11,10.40.0.12
```

TSIG keys are managed via `pdnsutil add-tsig-key` and assigned to zones via metadata. The setup is more involved than BIND but gives finer-grained per-zone control.

**Microsoft Active Directory DNS.** Often forgotten because it's "just AD," but Windows DNS supports AXFR and the default for AD-integrated zones is "to any server" in some configuration paths. The PowerShell remediation:

```powershell
Set-DnsServerPrimaryZone -Name "atlas.internal" -SecureSecondaries TransferToZoneNameServer
```

Or for zones with explicit secondaries:

```powershell
Set-DnsServerPrimaryZone -Name "atlas.internal" -SecureSecondaries TransferToSecureServers -SecondaryServers <list>
```

If you have an AD-integrated DNS in your environment, audit it, the defaults are not always restrictive.

### 2. Audit existing TXT records for stashed credentials

The fast version:

```bash
dig @<your-ns> <your-zone> AXFR | grep -E '(TXT|SPF)' > /tmp/txt-audit.txt
# review /tmp/txt-audit.txt
```

Run this from a trusted host with AXFR access (after you've configured the restriction). What you're looking for: anything that doesn't match a known verification-token pattern (Google site verification, MS365 verification, DKIM, DMARC, SPF) or a known vendor-mandated record. Anything that looks like a credential, a key, an admin note, or a free-form comment is a finding.

For ongoing monitoring, a daily scheduled job that diffs the TXT records against an approved baseline catches drift. Tools like `dnscontrol` (StackExchange's DNS-as-code tool) make this trivial, the approved zone lives in version control, anything that diverges from the file gets reverted.

### 3. Monitor for AXFR attempts

BIND logs AXFR requests under the `xfer-out` log category. Enable structured logging in `named.conf`:

```
logging {
    channel xfer-log {
        file "/var/log/named/xfer.log";
        severity info;
        print-time yes;
        print-category yes;
    };
    category xfer-in  { xfer-log; };
    category xfer-out { xfer-log; };
};
```

Route the log file to your SIEM (Splunk Universal Forwarder, Elastic Filebeat, Sentinel via Azure Monitor Agent, your tool of choice). The alert rule: "AXFR request from a source IP that isn't on the secondary-nameserver allowlist."

Knot logs similarly through its systemd journal output; PowerDNS through its standard logging pipeline. The Sigma project (vendor-neutral SIEM detection rules) publishes AXFR detection patterns in <https://github.com/SigmaHQ/sigma>; the Windows-DNS-Server failed-zone-transfer rule lives at `rules/windows/builtin/dns_server/win_dns_server_failed_dns_zone_transfer.yml`, and grepping the broader `rules/` tree for "AXFR" or "zone transfer" turns up the current cross-platform variants.

For a higher-signal detection, alert on "AXFR succeeded from a source IP not on the allowlist." Failed AXFR attempts are commonplace background noise (scanners hit every authoritative server); succeeded AXFR attempts from unexpected sources are the actually-interesting events.

### 4. Network segmentation between tiers

The architectural fix for the "staging-db can reach internal DNS" half of the finding. The general rule: data-plane traffic stays inside its tier; management-plane traffic (which includes DNS resolution for internal hostnames) flows through a controlled and audited path.

In an AWS environment, this is enforced through VPC subnet design, Security Groups, NACLs, and (for the DNS-specific case) Route 53 Resolver endpoint placement. In Azure: VNet subnets, NSGs, Azure Private DNS Resolver. In Google Cloud: VPC subnets, firewall rules, Cloud DNS private zones.

For on-prem deployments (what Atlas is presumably running, given the IP-range scheme): firewall rules between VLANs, with the DNS resolver placed in a management-tier VLAN that staging hosts cannot reach for arbitrary purposes. The staging-tier resolver should be a forwarder that only knows how to resolve staging-tier and public names; it should not be authoritative for any production-tier zone.

### 5. Service-account hygiene and the sticky-account problem

The audit-bypass account is the half of today's finding that's hardest to fix structurally, because it requires organizational discipline rather than a config change. The toolchain is well-developed:

- **Privileged Access Management (PAM) platforms**: CyberArk PAM, BeyondTrust Privileged Identity, Delinea (formerly Thycotic) Secret Server. These platforms centralize service-account credential management with mandatory expiration, automatic rotation, and access-audit trails.
- **Secrets-management platforms with TTL-bound credentials**: HashiCorp Vault is the canonical example. Vault's database secrets engine can issue dynamic, short-TTL database credentials on demand, eliminating the need for long-lived service-account passwords entirely. AWS Secrets Manager and Azure Key Vault have analogous capabilities for their respective ecosystems.
- **Identity Governance and Administration (IGA) platforms**: SailPoint IdentityIQ, Saviynt, Microsoft Entra ID Governance. These cover the lifecycle side, account creation, periodic recertification, automated deprovisioning when access requirements change.

The non-tool half is process: a registry of every service account that lists creation date, business justification, scheduled review date, and owner. Anything without a recent review or an active owner gets disabled and held in a recovery state for 30 days before deletion. The discipline is harder than the tooling, but the tooling makes the discipline enforceable.

### 6. External attack-surface management

The defender-side analog to the AXFR query you just ran. ASM platforms continuously enumerate your organization's external attack surface, domains, subdomains, exposed services, certificate inventory, and alert when something changes or appears that shouldn't be there.

Current commercial offerings: **Microsoft Defender External Attack Surface Management** (formerly RiskIQ), **Tenable Attack Surface Management**, **Bishop Fox CAST**, **Detectify**, **Censys ASM**, **Palo Alto Cortex Xpanse**. Free-tier and research-grade alternatives include **SecurityTrails** and **DNSDumpster** for ad-hoc DNS reconnaissance.

For internal-perimeter visibility specifically, **Project Sonar** (Rapid7's continuous internet-wide scanning project) publishes its data; you can query Sonar for your own org's exposed services. The value of running an ASM tool against your own org is the same as the value of running today's AXFR query, you find out what an attacker would find, before they look.

### Sample detection rule (Sigma)

Zone transfer is a legitimate protocol operation with a very small set of
legitimate initiators, which makes it one of the cleanest detections in
this corpus: enumerate the secondaries, alert on everyone else.

```yaml
title: DNS zone transfer requested by a host that is not a secondary
status: stable
description: >
  Detects AXFR and IXFR requests from sources outside the authorised
  secondary-nameserver allowlist. A successful transfer discloses the
  full contents of the zone, which for internal DNS is an inventory of
  the estate and, where TXT records are used as a key-value store, may
  include credential material.
logsource:
  product: zeek
  service: dns
detection:
  transfer:
    qtype_name:
      - 'AXFR'
      - 'IXFR'
  authorised_secondaries:
    id.orig_h:
      - '10.20.0.11'
      - '10.20.0.12'
  condition: transfer and not authorised_secondaries
falsepositives:
  - A newly provisioned secondary not yet added to the allowlist. This is
    the expected false positive and is the reason the rule is allowlist
    based: the fix is a one-line change made deliberately, not a
    broadening of the detection.
  - Monitoring or inventory tooling configured to pull zones. Give it a
    dedicated source address and allowlist that instead of the subnet.
level: high
```

The rule detects the request whether or not the server honours it, which
matters: a refused transfer from an unexpected source is reconnaissance
worth investigating even though nothing was disclosed.

Detection is the backstop, not the control. Restricting transfers to the
secondaries with `allow-transfer` (BIND) or the equivalent, and using TSIG
so the allowlist is cryptographic rather than address-based, is what
closes the finding. Separately, and independently of DNS configuration:
audit TXT records for secrets, because DNS answers anyone who asks, keeps
no meaningful access log, and is rarely in scope for secret scanning.

## §7.5 — Optional exploration

The credential lifts straight out of the AXFR TXT record; you don't need anything below to solve the level. This section is *bonus*, a set of cross-check commands the level supports so you can confirm in-band what the zone transfer told you out-of-band. The commands shipped with the engine in v1.7.0, but the walkthrough above predates them.

After the solve, on `staging-db.atlas.health`, you can run:

```bash
ip addr            # confirm you're on Atlas's internal staging segment
ip route           # see which gateway you'd traverse to reach the puzzle targets
arp -a             # ARP cache shows hosts staging-db has already talked to
nslookup atlas.internal
ping audit-bypass.atlas.internal
traceroute audit-bypass.atlas.internal
```

What you'll see:

- **`ip addr`**, `eth0` carries staging-db's primary IPv4. The address sits inside Atlas's RFC 1918 internal segment, which is the orthogonal datapoint the AXFR query *didn't* give you.[^rfc-1918] Zone-file enumeration tells you *what hostnames exist*; `ip addr` tells you *where you are in the topology that resolves them*. A real-world auditor wants both.
- **`ip route`**, the default route points at Atlas's internal gateway. Combined with `ip addr`, this is enough to draw a rough segment diagram on the engagement-notes whiteboard: staging-db lives on subnet X, routes outbound through gateway Y, and the AXFR-named internal hosts sit one hop deeper.
- **`arp -a`**, entries for the gateway and any hosts staging-db has already exchanged packets with. This is post-hoc evidence of which AXFR targets are *reachable in practice* (a Layer-2 ARP entry only forms after a successful ARP request/reply round trip), not just *named in the zone file*. The two sets often differ in real engagements: zone files have stale entries, dev hosts that were decommed but never deregistered, etc.
- **`nslookup atlas.internal`**, confirms the internal resolver from a different angle than `dig`. If you're documenting findings for an Atlas SRE who's used to nslookup output, having both renderings in the report is small-but-real polish.
- **`ping audit-bypass.atlas.internal`**, confirms the breadcrumb host responds to ICMP (it does). A "host named in AXFR but unreachable" outcome would change the threat-model interpretation: you'd flag the AXFR but downgrade the blast-radius finding from "credentials reachable" to "credentials *named* but network-segmented from staging-db." Worth verifying every time.
- **`traceroute audit-bypass.atlas.internal`**, shows the gateway hop sequence. Useful if you want to document *which* network segment the breadcrumb host lives in versus the gateway you'd traverse to reach it. For the level the answer is "one hop," but in real engagements this is how you find out whether a "reachable" host is actually multi-hop deep into a different team's environment (and therefore whose problem it is to fix).

None of this changes the solve. It does change how a written-up finding *reads*, moving from "we found a credential in the AXFR response" to "we found a credential in the AXFR response, **and** confirmed network reachability from staging-db, **and** documented the network segmentation between staging-db and the credential's host." The second framing is what a senior reviewer will ask for during peer review of your engagement report.

### Bonus find: vendor default account with /bin/bash

**Trigger:** `cat welcome.md` (you ran this as step 1)

**What it teaches:** welcome.md's parenthetical aside notes that *somebody* enabled `/bin/bash` on `dbadmin` during a vendor upgrade six months ago and never reverted to the original `nologin` shell. A real attacker doing yesterday's exact sequence ends up here, with a working interactive shell on a host the account wasn't supposed to be interactive on. Service-account shell drift is its own finding category: the original control intent was that the vendor service account could connect to PostgreSQL but **not run shell commands** if the credential leaked. That control evaporated the moment somebody needed the shell "just for this debug session." The CIS Distribution-Independent Linux Benchmark control 5.5.1 (the shell-of-service-accounts check) addresses exactly this drift; running it on a quarterly cycle, with named-owner review of every diff, is the operational answer. Worth flagging in the same engagement report as the AXFR finding, same root cause (operational shortcuts that *outlive their justification*), different surface.

## §8 — Key takeaways

- **Closing AXFR is about the cheapest win a defender will ever get.** One config line and a TSIG key on every authoritative nameserver and the technique is gone. That it survives at internet scale says something about attention, not difficulty.

- **DNS TXT records are where credentials go to be forgotten.** Anything someone needs to "stash somewhere quickly" can end up in one, because TXT records take nearly anything and are trivial to edit. A periodic `dig <zone> AXFR | grep TXT` from a trusted host, checked against an approved baseline, finds these before an attacker's AXFR does.

- **One-off accounts are the classic sticky accounts.** Audit-bypass accounts, vendor-engagement accounts, third-party integration accounts: created in good faith, with a vague conversation about expiry and nothing to enforce it, and then they live forever. The fix is a registry plus automation, never a spreadsheet.

- **The directory of internal services is a target in its own right.** Knowing where `prod-db` lives, where the PHI tier sits and which subnet holds the backups turns "where do I attack?" into "I have a map, let me plan". Restrict who can read the directory, and segment so that a successful discovery still produces nothing worth targeting.

- **Breaches are usually stacks, not single holes.** This one needed five mundane misconfigurations to line up: an unrotated credential, an interactive shell on a service account, reach to internal DNS, unrestricted AXFR, and a credential in a TXT record. None is exotic and each is fixable on its own, which is the encouraging part: any one fix would have broken the chain.

- **Authorized post-finding reconnaissance is real defender work.** Today was not an attack. It was a sized blast-radius check, done under written authorization with documented rules of engagement, producing an appendix for an incident report. What separates "a controlled exception to confirm scope" from "we just made it worse" is paperwork, scope discipline, and being willing to stop when the rules say stop.

- **In a HIPAA-covered environment, mapping the PHI tier is part of the breach story.** Hostnames are not PHI, but enumeration that names the PHI warehouse, the PACS and the EHR is the reconnaissance step toward PHI, and the Security Rule's access-control and transmission-security safeguards exist to protect exactly those systems. That no PHI moved today does not take the finding out of HIPAA scope.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^rfc-5936]: [RFC 5936 — DNS Zone Transfer Protocol (AXFR)](https://datatracker.ietf.org/doc/html/rfc5936). The interoperable specification for AXFR — *updates* RFC 1035's original definition (per the "Updates: 1035" header) rather than replacing it; RFC 1035 §3.2.3, §4.2.2, and §6.3 remain foundational. Read sections 2 (Transport) and 4 (Authoritative Server's AXFR Response) for the operational meat.
[^rfc-8945]: [RFC 8945 — Secret Key Transaction Authentication for DNS (TSIG)](https://datatracker.ietf.org/doc/html/rfc8945). The current TSIG spec (obsoletes RFC 2845, 4635). The mechanism the AXFR ACL relies on for authentication. Read sections 4 (TSIG RR format) and 5 (Protocol Details) for the implementation specifics.
[^nist-800-81]: [NIST SP 800-81 Rev 3 — Secure Domain Name System (DNS) Deployment Guide](https://csrc.nist.gov/pubs/sp/800/81/r3/final). The federal DNS hardening guide. Published March 2026, withdrawing SP 800-81-2 (2013) on the same date. Rev 3 substantially expands the older guide with Protective DNS, encrypted DNS (DoT/DoH/DoQ), zero-trust integration, and OT/IoT chapters. If you're working from the older SP 800-81-2 in any organizational documentation, swap to Rev 3.
[^cwe-306]: [CWE-306: Missing Authentication for Critical Function](https://cwe.mitre.org/data/definitions/306.html). Includes the current mapping-status notes and the relationship to the CWE Top 25.
[^cwe-1392]: [CWE-1392: Use of Default Credentials](https://cwe.mitre.org/data/definitions/1392.html).
[^cwe-732]: [CWE-732: Incorrect Permission Assignment for Critical Resource](https://cwe.mitre.org/data/definitions/732.html). Note the ALLOWED-WITH-REVIEW mapping status and the cautionary text about confusion with CWE-862/863.
[^cwe-200]: [CWE-200: Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html). Note the DISCOURAGED mapping status.
[^cwe-540]: [CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html).
[^t1590-002]: [MITRE ATT&CK T1590.002 — Gather Victim Network Information: DNS](https://attack.mitre.org/techniques/T1590/002/).
[^t1018]: [MITRE ATT&CK T1018 — Remote System Discovery](https://attack.mitre.org/techniques/T1018/).
[^cfr-45-164]: [HIPAA Security Rule full text (45 CFR Part 164 Subpart C)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C).
[^hhs-office-for-civil-rights]: [HHS Office for Civil Rights — Breach Reporting Portal ("Wall of Shame")](https://ocrportal.hhs.gov/ocr/breach/breach_frontpage.jsf). The public list of healthcare breaches affecting 500+ individuals. Useful for sector-trend research and for sanity-checking your own org's exposure relative to peers.
[^nist-800-53]: [NIST SP 800-53 Rev. 5 — Security and Privacy Controls for Information Systems and Organizations](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). The federal control catalog. The most heavily-cited controls for today's finding live in the SC (System and Communications Protection) and AC (Access Control) families.
[^cis-critical-security-controls-v8]: [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1). The current revision (June 2024). Free download with email registration; the implementation-group mappings are particularly useful for sizing remediation effort against organizational maturity.
[^owasp-top-10-2025]: [OWASP Top 10 (2025)](https://top10.owasp.org/). The current edition. Compare against the 2021 list when working from older documentation.
[^owasp-web-security-testing-guide]: [OWASP Web Security Testing Guide v4.2](https://wstg.owasp.org/v4.2/). The current methodology. DNS enumeration lives in the Information Gathering chapter.
[^project-sonar-rapid7]: [Project Sonar (Rapid7)](https://www.rapid7.com/research/project-sonar/). Continuous internet-wide scanning data; useful for "what's my external footprint actually look like."
[^securitytrails]: [SecurityTrails](https://securitytrails.com/). Passive DNS and historical DNS data. Free tier covers most ad-hoc lookups.
[^dnsdumpster]: [DNSDumpster](https://dnsdumpster.com/). Free DNS reconnaissance tool. Useful for quick "what's reachable in this zone" checks.
[^hhs-office-for-civil-rights-2]: [HHS Office for Civil Rights — Resolution Agreements](https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/agreements/index.html). The settlements OCR has negotiated with breach-affected covered entities. Useful for calibrating the financial side of "how seriously does HHS treat this category of failure."
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cert-gcih]: [GIAC GCIH — Certified Incident Handler](https://www.giac.org/certifications/certified-incident-handler-gcih).
[^cert-gsec]: [GIAC GSEC — Security Essentials](https://www.giac.org/certifications/security-essentials-gsec).
[^cert-gcia]: [GIAC GCIA — Certified Intrusion Analyst](https://www.giac.org/certifications/certified-intrusion-analyst-gcia).
[^cert-gpen]: [GIAC GPEN — Penetration Tester](https://www.giac.org/certifications/penetration-tester-gpen).
[^cwe-798]: [CWE-798](https://cwe.mitre.org/data/definitions/798.html).
[^cwe-863]: [CWE-863](https://cwe.mitre.org/data/definitions/863.html).
[^rfc-1918]: [RFC 1918 — RFC 1918 - Address Allocation for Private Internets](https://datatracker.ietf.org/doc/html/rfc1918).
[^nist-800-63b]: [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://csrc.nist.gov/pubs/sp/800/63/b/4/final).
[^commonspirit-2022]: [More than 623,000 patients affected by the CommonSpirit Health ransomware attack (HIPAA Journal)](https://www.hipaajournal.com/more-than-623000-patients-affected-by-commonspirit-health-ransomware-attack/). Reported to HHS OCR on 1 December 2022 as affecting 623,774 individuals across 164 facilities.
[^uhs-2020-ryuk]: [Universal Health Services lost $67 million to the Ryuk ransomware attack (BleepingComputer)](https://www.bleepingcomputer.com/news/security/universal-health-services-lost-67-million-due-to-ryuk-ransomware-attack/). UHS reported no evidence of unauthorised access to patient or employee data.
[^scripps-2021]: [Scripps Health ransomware attack cost rises to almost $113 million (HIPAA Journal)](https://www.hipaajournal.com/scripps-health-ransomware-attack-cost-113-million/). $91.6 million of lost revenue plus $21.1 million of incremental costs; 147,267 patients notified.
[^verizon-dbir]: [Verizon Data Breach Investigations Report](https://www.verizon.com/business/resources/reports/dbir/). The 2026 edition analysed more than 22,000 confirmed breaches across 145 countries.

### Further reading

- [Sigma rules (community SIEM detection rules)](https://github.com/SigmaHQ/sigma). The `rules/network/dns/` directory holds AXFR detection rules portable across SIEM platforms.
- [CISA Healthcare and Public Health Sector advisories](https://www.cisa.gov/topics/cybersecurity-best-practices/healthcare). The sector-specific advisories track recent ransomware operator TTPs against healthcare, including the network-enumeration playbook.
