# level1@network — The Map Marcus Didn't Mean to Share

**Track:** Network · **Client:** Atlas Health · **Compliance regime:** HIPAA Security Rule + HITECH · **Builds on:** [`level0@network`](/walkthroughs/#/network/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@network`. If you haven't solved `level1@network` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left the lobby at the end of `level0@network`, Atlas Health had a Tier-1 incident on its hands. You'd filed the perimeter finding: PostgreSQL 13.11 on `staging.atlas.health:5432`, listening on the open internet, with a named default credential — `atlas-default-2025` — that the client's DevOps lead had admitted to in a recorded quarterly meeting fifteen months ago and never rotated. The combination of the open port and the known credential gave you a HIPAA-grade exposure ready for somebody — anybody — with `nmap` and `psql`.

The night-after timeline reads like a textbook escalation. Priya took the finding to Marcus at 8:42pm. Marcus opened an internal incident at 8:47pm, woke up his on-call engineer at 8:52pm, and got the firewall ACL written by 11:30pm with a deploy slot scheduled for the next morning's maintenance window. By the time you walk back to Driftwood's audit workstation at 7:14am for what's now Day Two of the Atlas engagement, the firewall change is being staged and the credential rotation is on the calendar — for Friday's regular change window, three days out. Marcus's argument for the delay is reasonable: rotating `atlas-default-2025` will require a coordinated push to every Atlas service that has the cred baked in (there are seven), and doing that without a change-control plan would risk breaking patient-facing systems. The Friday slot already has the right reviewers on the calendar.

That decision left a gap. Three days, between now and Friday, during which:

- The firewall ACL might catch most casual exposure but won't catch any attacker who's already on the host.
- The credential is still live everywhere it was live yesterday.
- The audit trail of who has historically used the credential is essentially empty — staging-db's auth logs only go back 30 days, and the credential has been authoritative for a year and a half.

This is the conversation Priya had with Driftwood's engagement lead between 9pm and 10pm last night. The shape of the question: *we know the credential was reachable; we don't know who else used it; what do we owe the client in terms of validating actual blast radius before Friday?* The answer they landed on is the foundation of today's level.

Priya has authorized **one controlled, documented blast-radius check** using the still-live credential. The terms are tight: log in once, do reconnaissance-only enumeration (no logging into anything you discover, no scraping databases, no lateral nmap from the foothold), write up what's reachable from the compromised host, exit. The point is not to exploit; the point is to produce an accurate-scope appendix for the incident report that lands on Marcus's CISO's desk tomorrow morning, so the recovery plan is sized to the real exposure rather than the theoretical one.

This kind of controlled, authorized post-finding reconnaissance is what mature consulting firms do when they need to size an incident response. It is also legally and ethically fraught — you are technically using a live credential to access a client production environment. The authorization letter Priya wrote (with Driftwood's general counsel signing off, and Marcus's CISO countersigning by 6am this morning) is what keeps the activity inside the engagement's scope of work and outside the Computer Fraud and Abuse Act. Without that paper, today's level would be an actual crime.

You're logged in as `dbadmin` on `staging-db.atlas.health`. The host is a stock Ubuntu LTS box running PostgreSQL 13.11. The `dbadmin` account is the default vendor service account that ships with Atlas's database provisioning template; somebody enabled `/bin/bash` on it during an upgrade six months back when a junior engineer needed quick shell access for a debug session and never reverted the change. (This is also a finding — a vendor service account should not have an interactive shell — but it's not today's finding.) Your prompt reads `dbadmin@network:~$`.

The legal regime hasn't softened overnight. Atlas Health is HIPAA-covered. The Security Rule (45 CFR Part 164, Subpart C) applies to every system that touches electronic protected health information (ePHI). The HITECH Act sets the breach notification clock: 60 days from discovery to notify affected individuals; HHS Office for Civil Rights gets notice in the same window if 500 or more individuals are affected; and a breach affecting 500+ individuals in a single state or jurisdiction requires public media notice — the kind that lands on a regional news affiliate's homepage. Atlas serves roughly 400,000 patients across the Pacific Northwest. The "500+ affected" threshold is, in practice, a guarantee for any meaningful exposure here.

What you don't know yet, sitting at the shell, is that Atlas's internal DNS server is going to give up the entire data center's hostname inventory plus a service-account credential in a single `dig` command. The lesson today is that the directory of internal services is, often, the directory of internal services someone left readable to anyone who can reach the DNS resolver.

## §2 — The solve

The puzzle path is short. The reading around it is what makes the lesson land.

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

You are now logged into Atlas's staging database server as the default vendor service account. This is the same access you found leaking yesterday — the same access an attacker who ran the same perimeter scan and read the same engagement-notes leak would have. You're standing where they would stand.

Read what's in front of you before you do anything else.

### Step 2: Read the engagement context

```bash
dbadmin@network:~$ ls
.bash_history       atlas-internal.txt    lessons-learned.md
priya-note.md       welcome.md
```

Five files. Read them in order.

`welcome.md` is the mechanics file — it introduces the new tool you'll use today (`dig <domain> AXFR`) and explains what a zone transfer reveals. `priya-note.md` is the in-character handoff: the day-two engagement update, the rules of engagement, the legal frame for what you're about to do. `atlas-internal.txt` is the scope document — the list of zones Atlas runs internally, with `atlas.internal` named as the only one in scope for today's check. `.bash_history` is flavor (the `dbadmin` account's previous postgres-operations history, confirming this is a real working account someone uses for routine DBA work). `lessons-learned.md` is what you'll come back to after you find the finding.

The critical pieces to extract:

- **The new tool**: `dig <domain> AXFR` asks the DNS server to dump every record in the zone. The server *should* refuse unless you're an authorized secondary nameserver authenticating with TSIG; in practice, many servers don't refuse.
- **The internal DNS**: Atlas runs an authoritative resolver at `dns.atlas.internal` (also `10.40.0.10`) for the `atlas.internal` zone. The staging host you're on can reach it — your DNS configuration points there for internal-name resolution.
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

Twenty-two records. The SOA appears at the start and end (standard zone-transfer framing — RFC 5936 requires that any AXFR response opens and closes with the zone's SOA so the receiver knows the transfer is complete and atomic).

Read the records by tier. The IP plan tells the story.

**Infrastructure tier (10.40.0/24).** `dns.atlas.internal` (10.40.0.10) is the resolver you're querying. `mail.atlas.internal` (10.40.0.25), `jumpbox-vpn.atlas.internal` (10.40.0.20), `syslog.atlas.internal` (10.40.0.30), `ntp.atlas.internal` (10.40.0.40). Standard operational supporting services.

**Staging tier (10.40.10/24).** `staging-db.atlas.internal` is the host you're on. `staging-web` and `staging-api` are its peers. This is the segment you're authorized to know about.

**Production tier (10.40.20/24).** `prod-db`, `prod-web`, `prod-api`. The systems Atlas Health's actual patients touch. By Atlas's stated architecture, staging hosts should not be able to reach this tier. The fact that you can resolve the hostnames doesn't prove the firewall lets the packets through — but it gives a future attacker the targets to plan against. *You wouldn't have to find these. The DNS named them.*

**PHI / clinical tier (10.40.30/24).** This is the one that makes the lesson HIPAA-specific. Three hosts: `phi-warehouse.atlas.internal` is presumably the data warehouse aggregating clinical PHI for analytics; `pacs-imaging.atlas.internal` is a PACS (Picture Archiving and Communication System) — the standard storage for medical imaging (radiology, MRI, CT scans, etc.) — and PACS is one of the highest-sensitivity PHI categories under HIPAA because imaging includes facial-recognition-grade identifiers; `ehr-fhir.atlas.internal` is presumably an EHR (Electronic Health Record) system exposing FHIR (Fast Healthcare Interoperability Resources, HL7's modern interop standard) APIs. All three are systems that an attacker who reached them could exfiltrate PHI from at scale.

**Backup tier (10.40.40/24).** `backups.atlas.internal`. Backup systems are a recurring high-value target for ransomware operators specifically — the playbook for healthcare ransomware is now to encrypt or destroy backups *first* (the December 2024 update to CISA's #StopRansomware guide on the healthcare-sector advisory walks through exactly this pattern), then encrypt the production tier, leaving the victim with no recovery option except payment. A named backup host in the DNS zone is operationally a target.

**Shadow tier (10.40.99/24).** `audit-bypass.atlas.internal`. This is the smoking gun. The hostname doesn't match the tiered scheme (10.40.99/24 isn't in the staging / prod / PHI / backups plan); the name itself implies "bypass" (i.e., this exists to route around some other control); and the IP range is one segment higher than any other tier, suggesting somebody dropped it into a "miscellaneous" subnet so it wouldn't show up in tier-level inventory queries. The naming convention of `audit-bypass` paired with the unusual subnet placement is a deliberate camouflage move that wasn't subtle enough to survive an AXFR.

And then the TXT record.

```
audit-bypass.atlas.internal.     3600  IN  TXT   "audit-bypass DEPRECATED creds — user=audit-svc pass=atlas-audit-bypass-2026 — added 2025-09-12 for Tessera Q4 dry-run, scheduled removal end of Q4"
```

A free-form text record carrying a literal username, a literal password, the date it was added, the reason it was added (a vendor audit dry-run with "Tessera," whoever that is), and the scheduled-removal date that obviously passed without anyone removing it. Whoever wrote this TXT record needed somewhere to stash the credential, didn't have a secrets-management tool already wired up for this use case, and decided "well, DNS is internal anyway" was a good enough justification.

It wasn't.

### Step 4: Document and stop

Per Priya's rules of engagement, you do not now SSH into `audit-bypass.atlas.internal`. You do not query the database it provides access to. You do not pivot. What you do is write up exactly what the AXFR revealed and tie it to the incident-report appendix.

The minimum report content:

1. **AXFR is unrestricted** on `dns.atlas.internal` for the `atlas.internal` zone. This is the architectural finding.
2. **The internal hostname inventory is fully disclosed** to any host able to reach the resolver, including the staging-tier host the compromised credential reaches. The PHI tier hostnames (`phi-warehouse`, `pacs-imaging`, `ehr-fhir`) are in the disclosed list.
3. **A live credential is published in a public-readable TXT record** for an undocumented service account (`audit-bypass.atlas.internal`, user `audit-svc`, password `atlas-audit-bypass-2026`). The credential must be rotated as part of the incident response, in addition to the `atlas-default-2025` rotation already scheduled.
4. **The `audit-bypass` account itself is undocumented in Atlas's service inventory.** Atlas needs to determine who created it, when, for what purpose ("Tessera Q4 dry-run" per the TXT comment, but Tessera doesn't appear in the engagement notes), and whether it can be deprovisioned outright rather than just rotated.
5. **The blast radius of `atlas-default-2025` extends past staging-db** to anything `audit-bypass.atlas.internal` provides access to, and to anything an attacker would have done with the internal map between the credential's first exposure and Friday's rotation.

Send the report to Priya. She'll route it to Marcus's CISO with the day-one report attached. Exit the level.

```bash
dbadmin@network:~$ exit
```

### Step 5 (game-world only): Use the credential

In a real engagement, today ends here. In D3CYPH3R the credential chain continues into the eventual `level2@network`, where the audit-bypass account becomes the entry point. The mechanic is the same as it was for `level0@network → level1@network`: yesterday's leaked password gates today's level. Today's TXT-disclosed credential will gate tomorrow's.

```bash
guest@d3cyph3r:~$ ssh level2@network
level2@network's password: atlas-audit-bypass-2026
```

(At time of writing, `level2@network` hasn't shipped yet. The credential chain is staged for it.)

## §3 — The vulnerability

Today's finding looks like a single bad query response. It's actually a five-failure stack, each of which is independently a known anti-pattern, none of which is individually exotic, all of which compound into the credential disclosure you walked through above.

### Failure 1: The default credential was never rotated (CWE-1392)

`atlas-default-2025` is a vendor default. Marcus admitted to it in a Q1 2025 quarterly review and said the rotation would happen "next sprint." Five sprints later, it was still live. This is CWE-1392, *Use of Default Credentials*. It's the cleanest possible weakness — the system shipped with a credential, the documentation flagged that the credential needed to be changed, the team intended to change it, the change never happened.

CWE-1392 is the more specific successor to the broader and longer-running CWE-798 (*Use of Hard-coded Credentials*). MITRE distinguishes the two: hard-coded credentials are baked into source code or compiled binaries by developers; default credentials ship with the product and are documented as needing to be changed by the operator. The mitigation is the same on the operator side either way — change the value, prove the change took, audit periodically. But the responsibility shifts. Hard-coded credentials are a vendor failure; default credentials are an operator failure to follow vendor guidance.

Default credentials remain one of the most common findings in real-world penetration tests, despite being one of the easiest weaknesses to fix.

### Failure 2: The service account had an interactive shell (CWE-732)

A vendor-provisioned service account should not have `/bin/bash` as its login shell. Atlas's database provisioning template created `dbadmin` as a postgres-operations service account; somebody (a junior engineer, six months ago, per the change history) replaced the default `/sbin/nologin` shell with `/bin/bash` to enable interactive debugging during an upgrade and never reverted the change.

This is CWE-732, *Incorrect Permission Assignment for Critical Resource* — the same weakness that drove the level1@linux puzzle. Different surface (login shell configuration rather than file mode), same underlying anti-pattern: a permission was loosened for a one-time legitimate reason and never tightened back down. The MITRE entry for CWE-732 carries the "ALLOWED-WITH-REVIEW" mapping status — meaning it's a valid weakness ID but is frequently misused for authorization weaknesses (which actually belong under CWE-862 / CWE-863). For our finding here, CWE-732 fits cleanly: the explicit permission to log in interactively was set wrong for a service account.

### Failure 3: The DNS server allowed AXFR from any source (CWE-306)

DNS zone transfer (AXFR — Authoritative Zone Transfer, defined in RFC 5936) is the protocol mechanism by which authoritative DNS servers replicate full zone contents to other authoritative servers in the same zone. The legitimate use case is straightforward: a primary nameserver pushes its zone data to its configured secondaries so the secondaries can answer queries authoritatively. The expected enforcement: the primary should refuse AXFR requests from any client that isn't a known, authenticated secondary.

There are two enforcement modes in current use. **IP-based ACL** (`allow-transfer { 10.40.0.20; };` in BIND syntax) restricts AXFR responses to a whitelist of source IPs. This is the historical model and works fine when the secondaries are on stable, known IPs. **TSIG** (RFC 8945, formerly RFC 2845) authenticates AXFR requests cryptographically — the requester presents an HMAC over the request signed with a shared secret, and the server verifies before responding. TSIG is the modern recommendation because it survives IP changes, NAT, and source-spoofing attacks that IP-based ACLs don't. Atlas's resolver implements neither; the `allow-transfer` directive is left at its (overly permissive) default, which on most distributions amounts to "allow from any source that can connect to TCP 53."

This is CWE-306, *Missing Authentication for Critical Function*. The function — full zone replication — is critical: the response contains every record in the zone, including subdomain mappings, mail-server pointers, and any free-form text records anyone has ever attached. The authentication requirement on this function is well-documented in standards literature going back to the late 1990s. The failure to enforce it is straightforward: the operator either didn't know about the requirement, didn't configure it, or configured something that didn't take effect.

CWE-306 has been on the CWE Top 25 list multiple times — most recently the 2024 edition, where it placed #21 on the "Most Dangerous Software Weaknesses" list (see the live CWE Top 25 archive for the current year's exact placement, which shifts as the CVE-data normalization rolls forward). It is a high-frequency finding because the broader pattern (a critical function exposed without authentication) shows up across protocols and systems, not just DNS. The DNS-specific manifestation is one of the cheapest to fix and one of the most consistently overlooked.

### Failure 4: A live credential was stored in a public-readable record (CWE-200, with caveat)

Whoever needed to stash the audit-bypass credential during the Tessera dry-run picked the most convenient place they could reach without setting up new infrastructure. DNS TXT records are infinitely flexible — they can hold any printable ASCII, up to 255 characters per string with multiple strings allowed per record — and they're trivially editable by anyone with DNS administrator privileges. The convenience of "I just need to put this somewhere quickly" found its way to the convenience of "we already have DNS, let's just put it in a TXT record."

This is CWE-200, *Exposure of Sensitive Information to an Unauthorized Actor*. The catalog entry covers exactly this case: sensitive data placed where an unauthorized actor can read it. The framework-mapping caveat worth flagging: MITRE has marked CWE-200 as **"Discouraged for mapping"** in the current CWE catalog (it's listed under "Mapping Problems" with a recommendation that mappers use a more specific weakness ID when possible). CWE-200 is broad enough to apply to almost any disclosure, which makes it less useful for analytics and root-cause taxonomy. For our purposes here, CWE-200 is cited as the framework-mapping reference — the surgical-fix description is "do not store credentials in DNS records; use a real secrets manager."

The companion weakness worth citing alongside CWE-200 is CWE-540, *Inclusion of Sensitive Information in Source Code*. CWE-540 is technically about source code, but the spirit of the entry — "do not write secrets into any artifact whose visibility is governed by something other than secret-grade access control" — captures the DNS-TXT case better than CWE-200's broad disclosure framing.

### Failure 5: The "temporary" service account was never deprovisioned (the sticky-account anti-pattern)

The `audit-bypass` account was created for a one-time event (the "Tessera Q4 dry-run," presumably an external compliance audit Atlas was preparing for). It was supposed to be removed when the audit closed. It wasn't. The TXT record explicitly notes "scheduled removal end of Q4" — Q4 2025 ended five months ago at the time of the level — and the account is still live and still listed in DNS.

This is the sticky-account anti-pattern, well-documented in IAM literature and explicitly called out in several frameworks:

- **NIST SP 800-53 Rev. 5 AC-2(3)** (*Disable Accounts*) requires accounts to be disabled when no longer needed.
- **CIS Critical Security Controls v8.1 Control 5.3** (*Disable Dormant Accounts*) is the same requirement, phrased operationally.
- **NIST SP 800-63B-4** (*Digital Identity Guidelines: Authentication and Authenticator Management*, July 2025 — supersedes the 2017 edition) covers the full account lifecycle including credential deprovisioning. (The 2017 edition was titled "Authentication and Lifecycle Management"; the Rev 4 retitle reflects the broader scope.)

The pattern fails the same way at every organization that has ever set up a temporary access path: the access gets created with the best of intentions, an expiration date gets discussed in passing, no automated mechanism enforces the expiration, the people who set it up move on or forget, and the account remains live indefinitely. The IAM-platform answer (CyberArk PAM, BeyondTrust Privileged Identity, HashiCorp Vault with TTL-bound dynamic secrets) exists precisely because spreadsheets-of-expiration-dates don't work.

### The compound effect

Each failure in isolation is a manageable finding. Compound them, and you get today's level.

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

Pull any one of the five threads out of the chain and the breach becomes substantially harder to execute. Rotate the default credential and you can't get on the box. Disable the interactive shell and the credential gets you a database connection but not the DNS query. Segment staging away from internal DNS and the resolver can't be queried from the foothold. Lock down AXFR and the zone doesn't dump. Don't put credentials in DNS and the dump doesn't include the breadcrumb. The fact that no single layer holds means the engineering effort to fully remediate is five separate efforts — and each of those five efforts needs to be tracked, scheduled, and verified independently.

This is the shape of most real-world breaches. There is rarely a single dramatic vulnerability that opens the front door; there are five or six mundane misconfigurations that compound into a path. The lesson is not "lock down AXFR" — the lesson is "any one of these five would have stopped this."

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | The staging-db host's internal DNS resolver, from a shell obtained with an unrotated vendor default |
| Disclosed | Atlas's full internal data-centre map via unauthenticated zone transfer, plus a service-account credential parked in a TXT record |
| Compounding weaknesses | CWE-1392 default credential, CWE-732 interactive shell on a service account, CWE-306 missing authentication on the transfer |
| Exposure window | The default was flagged in a Q1 2025 review with rotation promised "next sprint"; five sprints later it was live |
| Escalates to | The credential recovered from DNS, which is `level2@network` |
| Regime | HIPAA Breach Notification Rule, 45 CFR 164.400-414: individuals within 60 days, and at 500+ also HHS plus in-state media |

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

DNS zone transfer is one of the longest-running classes of misconfiguration in the security catalog. The technique predates Common Vulnerabilities and Exposures (CVE) as an indexing system; AXFR enumeration is documented in security literature going back to the mid-1990s, and the first significant published red-team writeups about using it appeared around 2000-2001. What follows is not a comprehensive history (that would be a different document) but three threads worth tracing.

### Thread 1: The chronic, low-attention pattern

AXFR misconfigurations are typically discovered quietly. A security researcher runs a passive sweep using tools like Project Sonar (Rapid7's continuous internet-scanning project) or one of the public DNS-discovery services (SecurityTrails, DNSDumpster, Shodan, Censys), notices an authoritative server returning zone data to unauthenticated clients, files a disclosure report, and the operator fixes it. Most of these never become news because the data is "just" hostnames — embarrassing, but rarely a direct breach.

The shape of the problem at scale is well-documented in Rapid7's annual *National / Industry Cyber Exposure Reports* (NICER), which use Project Sonar's continuous internet-wide scanning to characterize what's reachable from anywhere. AXFR-permitting authoritative DNS servers appear in those reports every year, in the thousands. The mitigation has been published, free, in operator-grade documentation (BIND ARM, PowerDNS docs, Knot DNS docs) for decades. The persistence of the misconfiguration is not a technical problem; it is an organizational-attention problem. Internal DNS gets configured once, by whoever was there first, and nobody re-audits it.

The OWASP Web Security Testing Guide (currently v4.2) includes DNS enumeration as a standard part of its information-gathering chapter, and AXFR is one of the named techniques. Any black-box penetration test that follows OWASP's testing methodology will attempt AXFR against the target's authoritative nameservers in the first hour of engagement. The test is so routine that it's automated in major commercial scanning suites (Tenable Nessus, Qualys, Rapid7 InsightVM all include AXFR checks in their default profiles).

For an organization that has never run a black-box external pentest, the question "would AXFR work against our zones?" is almost certainly unanswered. For an organization that has, the question "did we actually remediate the finding from last year's report?" is the more useful one.

### Thread 2: Healthcare-sector network compromises and the role of internal enumeration

Healthcare has been the worst-performing sector in breach reporting for several years running. The HHS Office for Civil Rights' breach reporting portal (the "Wall of Shame," officially the *Breaches Affecting 500 or More Individuals* notice) lists hundreds of healthcare breaches per year affecting cumulative tens of millions of individuals. The 2024 calendar year was the worst on record by individuals-affected — driven heavily by the Change Healthcare ransomware attack of February 2024, which UnitedHealth Group disclosed had affected approximately 192.7 million individuals per Change Healthcare's notification to HHS OCR updated in July 2025 (revised up from the ~100 million October 2024 estimate as the forensic scope expanded).

The Change Healthcare incident, attributed to the ALPHV/BlackCat ransomware-as-a-service operation, was a credential-driven compromise: the initial access was via stolen credentials for a Citrix portal that lacked multi-factor authentication. Once inside, the operators spent nine days in the environment before deploying ransomware, and during those nine days they performed exactly the kind of internal enumeration today's level demonstrates — mapping internal services, identifying the highest-value data stores, locating and disabling backup systems. The CISA advisory and the subsequent forensic reports describe the enumeration phase in terms that match T1018 (Remote System Discovery) and T1590.002 (Gather Victim Network Information: DNS) — the same techniques the dig AXFR query in this level maps to.

The pattern shows up repeatedly in the healthcare ransomware history of the last several years:

- **CommonSpirit Health (October 2022)**: ransomware affected 164 hospitals and care sites across 21 states. 623,774 patients ultimately had their data exposed.
- **Universal Health Services (September 2020)**: a Ryuk ransomware attack affected UHS operations across its 400+ facilities in the US and UK. Patient care diverted; staff fell back to paper records for weeks. Direct loss reported as $67 million; UHS publicly stated no patient data was confirmed exfiltrated.
- **Scripps Health (May 2021)**: ransomware disrupted all four of Scripps' hospitals (two heavily). 147,267 patients had PHI stolen; recovery took roughly four weeks; total reported cost ~$113 million.
- **Ardent Health Services (November 2023)**: ransomware across 30+ hospitals in 6 states. ER diversions; surgeries postponed.

What all of these have in common, beyond the ransomware payload itself, is an internal-enumeration phase that preceded the encryption — usually using stolen credentials for an initial foothold, then walking the internal network using techniques that included DNS reconnaissance, Active Directory enumeration, and lateral SMB/RDP discovery. The "find the high-value targets" phase of a healthcare ransomware compromise looks operationally a great deal like the legal, authorized blast-radius check in today's level — same techniques, opposite intent.

### Thread 3: Vendor-engagement service accounts that outlived their use

The audit-bypass account in today's level — created for a one-time vendor audit dry-run, never deprovisioned — is a near-exact match for one of the most consistently-cited patterns in IAM literature.

The **SolarWinds Orion supply-chain compromise (disclosed December 2020)** included, among many other findings, evidence that the malicious actors used legitimate-looking service accounts to maintain persistence across customer environments. While the initial vector was a compromised build pipeline, the persistence and lateral-movement phases relied substantially on accounts that had been provisioned for legitimate operational reasons and were available because deprovisioning processes hadn't kept pace with the actual usage. CISA's SolarWinds advisory series (AA20-352A "Advanced Persistent Threat Compromise of Government Agencies, Critical Infrastructure, and Private Sector Organizations" and the AR21-134A "Eviction Guidance for Networks Affected by the SolarWinds and Active Directory/M365 Compromise") named service-account and identity-platform hygiene as recurring remediation themes.

The **Okta support-system breach (October 2023)** is another example — the initial access vector was credentials for a service account that an Okta employee had inadvertently saved to a personal Google account, which an attacker subsequently compromised. The service account had broader access than the support workflow it was originally provisioned for required. Okta's disclosure and subsequent customer notifications described both the credential exposure and the over-scoped permissions as contributing factors.

More routinely (and less famously), the pattern shows up in nearly every published penetration-test methodology guide as a category of finding: "service accounts created for vendor engagements, third-party integrations, or one-time projects, retained indefinitely with original permissions, often holding more access than the original justification required." The mitigations are standardized — registry of accounts, mandatory expiration dates, automated deprovisioning workflows, periodic recertification — and the failure rate in industry surveys is consistently above 50%. (Verizon's *Data Breach Investigations Report*, year over year, identifies credential-related compromise as one of the top initial-access vectors. The 2026 edition documented a reshuffle — vulnerability exploitation overtook credential abuse to claim the #1 slot at 31% of breaches — but credential-driven access remains the persistent runner-up, and the sticky-account variant is a meaningful slice of that total.)

The audit-bypass account in today's level is fictional, but it represents the modal real-world finding: an account created in good faith for a specific purpose, documented insufficiently, deprovisioned never. The DNS-TXT-record credential leak compounds the failure, but the underlying weakness — the account existing at all, five months past its scheduled removal — is the larger problem.

## §5 — Frameworks, deep dive

The post-mortem at the bottom of the level (`lessons-learned.md`) walks through the high-level framework mapping. This section expands each with the specific section / control / paragraph identifiers a compliance auditor would cite, plus the exact remediation language each framework expects.

### CWE — Common Weakness Enumeration

**CWE-306: Missing Authentication for Critical Function.** The primary weakness for the AXFR failure. The CWE catalog entry describes the weakness as "the product does not perform any authentication for functionality that requires a provable user identity or consumes a significant amount of resources." AXFR fits both halves: it requires a provable identity (the requester should be a known secondary nameserver) and consumes significant resources (the full zone dump). CWE-306 has been on the CWE Top 25 *Most Dangerous Software Weaknesses* list multiple times, most recently the 2024 edition. The MITRE mapping status is **ALLOWED** — it's a valid weakness ID for analytics and reporting.

**CWE-1392: Use of Default Credentials.** Maps the unrotated `atlas-default-2025`. CWE-1392 is the more recent, more specific successor to CWE-798 (*Use of Hard-coded Credentials*); use it when the credential is a vendor-shipped default that the operator failed to change, rather than a developer-baked secret. MITRE mapping status: **ALLOWED**.

**CWE-732: Incorrect Permission Assignment for Critical Resource.** Maps the `/bin/bash` shell on the `dbadmin` service account. MITRE mapping status: **ALLOWED-WITH-REVIEW** — the entry notes that CWE-732 is frequently misused for authorization weaknesses (which belong under CWE-862 *Missing Authorization* or CWE-863 *Incorrect Authorization*); the shell-mode case here fits the literal CWE-732 definition correctly.

**CWE-200: Exposure of Sensitive Information to an Unauthorized Actor.** Maps the TXT-record credential leak. MITRE mapping status: **DISCOURAGED** — the entry is "frequently misused" and is too broad to be useful for fine-grained analytics. Cite CWE-200 as the framework reference; for surgical analysis use CWE-540 (*Inclusion of Sensitive Information in Source Code* — extended in practice to "any non-secret-grade artifact") as the better-fitting weakness.

**CWE-540: Inclusion of Sensitive Information in Source Code.** The narrower, more useful weakness for the TXT-record case. The literal catalog text is about source code, but the spirit — "credentials should not appear in artifacts whose access control is not credential-grade" — fits the DNS-record case directly.

### NIST SP 800-53 Rev. 5

NIST Special Publication 800-53 Revision 5 (the federal control catalog, also widely used by the private sector) addresses today's findings across several control families.

**SC-22 — Architecture and Provisioning for Name/Address Resolution Service.** The most surgical fit for the AXFR failure. SC-22's control text requires that the system "provide name/address resolution services for organizational users that perform fault-tolerant name/address resolution services; implement internal/external role separation." (The SC-22(1) enhancement that lived separately in Rev 4 was incorporated into the SC-22 base control in Rev 5.) Atlas's resolver fails the architecture-and-provisioning requirement by not implementing the standard AXFR restriction.

**SC-7 — Boundary Protection.** The fact that `staging-db.atlas.health` can reach `dns.atlas.internal` at all is a network-segmentation finding. SC-7 requires that the system "monitor and control communications at the external boundary of the system and at key internal boundaries within the system." The internal boundary between the staging tier and the management tier (where DNS lives) is not enforced.

**AC-3 — Access Enforcement.** The DNS server is required to "enforce approved authorizations for logical access to information and system resources." Allowing AXFR from any source is a failure to enforce the (implicit) authorization that only secondary nameservers should receive zone data.

**AC-2(3) — Disable Accounts.** The audit-bypass account's continued existence past its scheduled removal date is the violation. AC-2(3) requires that accounts be disabled within an organization-defined time period when they're no longer required (the original "Tessera Q4 dry-run" purpose ended; the account didn't).

**AC-6 — Least Privilege.** The `dbadmin` service account with an interactive shell has more privilege than its operational purpose requires. AC-6's control text is "employ the principle of least privilege, allowing only authorized accesses for users (or processes acting on behalf of users) that are necessary to accomplish assigned organizational tasks."

**IA-5 — Authenticator Management.** Covers the credential-management lifecycle, including "establishing initial authenticator content for any authenticators issued by the organization" and "establishing and implementing administrative procedures for initial authenticator distribution." Default authenticators that ship with vendor products and the operator's obligation to change them fall under this control.

### NIST SP 800-81 Rev 3 — Secure Domain Name System (DNS) Deployment Guide

The authoritative federal DNS hardening guide. **NIST SP 800-81 Rev 3 was published as final on March 19, 2026**, simultaneously withdrawing the long-standing SP 800-81-2 (2013). Operators familiar with the older document should re-read; Rev 3 is a substantial expansion rather than a refresh — it adds chapters on Protective DNS (PDNS), encrypted DNS transports (DoT, DoH, DoQ), zero-trust integration, OT/IoT environments, and forensic logging, none of which were addressed in SP 800-81-2.

The AXFR guidance carries through from the 2013 document but is now in a different chapter. The recommendation remains: AXFR allowed only to known secondary nameservers, authenticated via TSIG. The BIND `allow-transfer { key tsig-key; };` syntax is unchanged. The change in Rev 3 is that AXFR sits inside a broader "zone integrity and replication" treatment that explicitly cross-references zone signing (DNSSEC) and encrypted-transport integration.

If you've been relying on SP 800-81-2 as your DNS hardening reference, swap to Rev 3 — the older document's `csrc.nist.gov/publications/detail/sp/800-81/2/final` URL still resolves but now shows the "(Withdrawn)" status banner.

### HIPAA — 45 CFR Part 164

The Privacy and Security Rules apply to Atlas Health as a HIPAA-covered entity.

**§164.312(a)(1) — Access Control (Technical Safeguard).** Requires covered entities to "implement technical policies and procedures for electronic information systems that maintain electronic protected health information to allow access only to those persons or software programs that have been granted access rights." The architectural mechanism Atlas uses for PHI access control is network segmentation between the staging tier (no PHI) and the PHI tier. Today's finding doesn't directly cross the segmentation boundary — but it discloses where the boundary is, which is the first step of any subsequent attack against the boundary.

**§164.312(e)(1) — Transmission Security (Technical Safeguard).** Covers "technical security measures to guard against unauthorized access to electronic protected health information that is being transmitted over an electronic communications network." Hostname enumeration via AXFR is the prerequisite for targeted transmission-layer attacks; the technical-safeguards control is implicated even though no PHI was directly transmitted in today's recon.

**§164.502 — Uses and Disclosures of Protected Health Information: General Rules (Privacy Rule).** The "minimum necessary" standard at §164.502(b) requires that uses, disclosures, and requests for PHI be "limited to the minimum necessary" to accomplish the intended purpose. Exposing the internal-network map of every PHI system to any host that can reach the resolver is the opposite of minimum-necessary.

**§164.530 — Administrative Requirements (Privacy Rule).** Subsection (c)(1) requires "appropriate administrative, technical, and physical safeguards to protect the privacy of protected health information." DNS zone-transfer hardening sits in the technical-safeguards bucket; the failure here is an administrative-safeguards failure as much as a technical one (no review process caught the misconfiguration).

**§164.404 (HITECH) — Notification to Individuals.** Sixty-day clock from discovery to individual notification. If today's finding leads to evidence that the credential was used by an attacker before remediation, the breach is notifiable under HITECH and the clock starts when Atlas's forensic team confirms the use.

**§164.408 (HITECH) — Notification to the Secretary.** Breaches affecting 500 or more individuals require notification to HHS Office for Civil Rights within the same 60-day window; smaller breaches get aggregated annual reporting. Atlas's patient population means any confirmed exposure here lands in the immediate-notice category.

### CIS Critical Security Controls v8.1

The Center for Internet Security's *Critical Security Controls v8.1* (released June 2024; the v8.1 minor revision updated the IG (Implementation Group) mapping and added language on cloud-native deployments without changing the core 18 controls structure introduced in v8).

**Control 4 — Secure Configuration of Enterprise Assets and Software.** Covers the broader category of "the software arrived configured wrong and we didn't fix it." Sub-controls 4.7 (Manage Default Accounts on Enterprise Assets and Software) and 4.8 (Uninstall or Disable Unnecessary Services on Enterprise Assets and Software) are both directly implicated.

**Control 5 — Account Management.** Sub-control 5.3 (Disable Dormant Accounts) covers the audit-bypass-account-never-deprovisioned finding. Sub-control 5.4 (Restrict Administrator Privileges to Dedicated Administrator Accounts) is the structural fix for the `dbadmin`-shouldn't-have-a-shell problem.

**Control 12 — Network Infrastructure Management.** Sub-control 12.2 (Establish and Maintain a Secure Network Architecture) is the umbrella for DNS hardening and segmentation. Sub-control 12.3 (Securely Manage Network Infrastructure) covers the configuration-management side — versioned, reviewed, audited config for DNS servers.

**Control 13 — Network Monitoring and Defense.** Sub-control 13.4 (Perform Traffic Filtering Between Network Segments) addresses the staging-can-reach-DNS-resolver finding. Sub-control 13.7 (Deploy a Host-Based Intrusion Detection Solution) and 13.8 (Deploy a Network Intrusion Detection Solution) would have alerted on the AXFR attempt.

### OWASP

**OWASP Web Security Testing Guide v4.2.** The current edition. Information Gathering is the first chapter; DNS enumeration techniques (including AXFR) are documented across multiple sub-sections covering footprinting and infrastructure mapping. Any OWASP-methodology black-box engagement will run AXFR in the first hour.

**OWASP Top 10 (2025).** The 2025 edition reshuffled several positions from 2021. The umbrella category for today's finding is **A02: Security Misconfiguration** (moved up from A05 in the 2021 list). The category text explicitly calls out "default accounts and their passwords still enabled and unchanged" and "unnecessary features are enabled or installed" as examples — both apply.

The 2025 Top 10 also expanded **A03: Software Supply Chain Failures** (broader than the 2021 *Vulnerable and Outdated Components* category — now covers the full software supply chain rather than just outdated dependencies) and retained **A07: Authentication Failures** (renamed from 2021's *Identification and Authentication Failures*, same position). Default credentials map into the A07 category by content and A02 by example-list inclusion; most auditors will cite both. The 2025 edition also introduces a brand-new **A10: Mishandling of Exceptional Conditions** and elevates **A04: Cryptographic Failures** (which had been A02 in 2021) — neither applies directly to today's finding, but they're worth knowing when comparing 2021-era and 2025-era audit reports against each other.

## §6 — Cert exam relevance

The certification industry has been teaching this finding for decades. If you study any of the certs below, you've seen — or will see — the DNS zone transfer example.

**CompTIA Security+ (SY0-701).** The current exam (released November 2023). Domain 4 (*Security Operations*) covers DNS enumeration as a reconnaissance technique; the official objectives list `dig`, `nslookup`, and `whois` as named tools. Domain 3 (*Security Architecture*) covers DNS hardening from the defender side. Expect 2-3 questions touching the AXFR concept across a full exam attempt.

**CompTIA CySA+ (CS0-003).** The current exam (released June 2023). Domain 2 (*Threat Intelligence and Threat Hunting*) covers the "what does an adversary see from outside?" question that AXFR is one answer to. Domain 1 (*Security Operations*) covers DNS log analysis — the AXFR-request-monitoring half of the defender story.

**CompTIA PenTest+ (PT0-003).** The current exam (released December 2024, replacing PT0-002 which sunsets in mid-2025). Domain 2 (*Reconnaissance and Enumeration*) names DNS enumeration explicitly; AXFR is among the directly-listed techniques in the official exam objectives. Domain 3 (*Vulnerability Discovery and Analysis*) covers the follow-on of identifying internal services from the enumeration.

**(ISC)² CISSP.** Domain 4 (*Communication and Network Security*) covers DNS as a protocol with documented hardening requirements; the CBK chapters on DNS specifically reference RFC 5936 (AXFR) and RFC 8945 (TSIG). Domain 3 (*Security Architecture and Engineering*) covers the architectural decisions — secure naming services, zone segregation, secondary nameserver placement.

**Offensive Security OSCP / PEN-200.** OffSec's flagship offensive cert. The PEN-200 course material covers DNS enumeration as a standard part of the information-gathering phase; the lab environment includes machines where AXFR is the intended initial-recon win. The exam itself doesn't directly test "did you find the AXFR misconfig" as a discrete question (it's a practical exam), but the methodology that gets candidates to the foothold relies on the recon habits PEN-200 teaches.

**SANS GIAC GSEC / GCIH / GCIA / GPEN.** The SANS curriculum covers DNS recon across multiple courses — GSEC's *Security Essentials*, GCIH's *Hacker Tools, Techniques, and Incident Handling*, GCIA's *Intrusion Analyst* (DNS log analysis is a substantial chapter), and GPEN's *Network Penetration Tester* (AXFR is among the named techniques). The GCIH and GPEN material is the most directly relevant.

## §7 — What a defender does

The bulleted version is in the in-game `lessons-learned.md`. This section expands each bullet with the specific operational details that get a defender from "I read about this" to "I have shipped the change to production."

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

If you have an AD-integrated DNS in your environment, audit it — the defaults are not always restrictive.

### 2. Audit existing TXT records for stashed credentials

The fast version:

```bash
dig @<your-ns> <your-zone> AXFR | grep -E '(TXT|SPF)' > /tmp/txt-audit.txt
# review /tmp/txt-audit.txt
```

Run this from a trusted host with AXFR access (after you've configured the restriction). What you're looking for: anything that doesn't match a known verification-token pattern (Google site verification, MS365 verification, DKIM, DMARC, SPF) or a known vendor-mandated record. Anything that looks like a credential, a key, an admin note, or a free-form comment is a finding.

For ongoing monitoring, a daily scheduled job that diffs the TXT records against an approved baseline catches drift. Tools like `dnscontrol` (StackExchange's DNS-as-code tool) make this trivial — the approved zone lives in version control, anything that diverges from the file gets reverted.

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
- **Identity Governance and Administration (IGA) platforms**: SailPoint IdentityIQ, Saviynt, Microsoft Entra ID Governance. These cover the lifecycle side — account creation, periodic recertification, automated deprovisioning when access requirements change.

The non-tool half is process: a registry of every service account that lists creation date, business justification, scheduled review date, and owner. Anything without a recent review or an active owner gets disabled and held in a recovery state for 30 days before deletion. The discipline is harder than the tooling, but the tooling makes the discipline enforceable.

### 6. External attack-surface management

The defender-side analog to the AXFR query you just ran. ASM platforms continuously enumerate your organization's external attack surface — domains, subdomains, exposed services, certificate inventory — and alert when something changes or appears that shouldn't be there.

Current commercial offerings: **Microsoft Defender External Attack Surface Management** (formerly RiskIQ), **Tenable Attack Surface Management**, **Bishop Fox CAST**, **Detectify**, **Censys ASM**, **Palo Alto Cortex Xpanse**. Free-tier and research-grade alternatives include **SecurityTrails** and **DNSDumpster** for ad-hoc DNS reconnaissance.

For internal-perimeter visibility specifically, **Project Sonar** (Rapid7's continuous internet-wide scanning project) publishes its data; you can query Sonar for your own org's exposed services. The value of running an ASM tool against your own org is the same as the value of running today's AXFR query — you find out what an attacker would find, before they look.

## §7.5 — Optional exploration

The credential lifts straight out of the AXFR TXT record; you don't need anything below to solve the level. This section is *bonus* — a set of cross-check commands the level supports so you can confirm in-band what the zone transfer told you out-of-band. The commands shipped with the engine in v1.7.0, but the walkthrough above predates them.

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

- **`ip addr`** — `eth0` carries staging-db's primary IPv4. The address sits inside Atlas's RFC 1918 internal segment, which is the orthogonal datapoint the AXFR query *didn't* give you. Zone-file enumeration tells you *what hostnames exist*; `ip addr` tells you *where you are in the topology that resolves them*. A real-world auditor wants both.
- **`ip route`** — the default route points at Atlas's internal gateway. Combined with `ip addr`, this is enough to draw a rough segment diagram on the engagement-notes whiteboard: staging-db lives on subnet X, routes outbound through gateway Y, and the AXFR-named internal hosts sit one hop deeper.
- **`arp -a`** — entries for the gateway and any hosts staging-db has already exchanged packets with. This is post-hoc evidence of which AXFR targets are *reachable in practice* (a Layer-2 ARP entry only forms after a successful ARP request/reply round trip), not just *named in the zone file*. The two sets often differ in real engagements: zone files have stale entries, dev hosts that were decommed but never deregistered, etc.
- **`nslookup atlas.internal`** — confirms the internal resolver from a different angle than `dig`. If you're documenting findings for an Atlas SRE who's used to nslookup output, having both renderings in the report is small-but-real polish.
- **`ping audit-bypass.atlas.internal`** — confirms the breadcrumb host responds to ICMP (it does). A "host named in AXFR but unreachable" outcome would change the threat-model interpretation: you'd flag the AXFR but downgrade the blast-radius finding from "credentials reachable" to "credentials *named* but network-segmented from staging-db." Worth verifying every time.
- **`traceroute audit-bypass.atlas.internal`** — shows the gateway hop sequence. Useful if you want to document *which* network segment the breadcrumb host lives in versus the gateway you'd traverse to reach it. For the level the answer is "one hop," but in real engagements this is how you find out whether a "reachable" host is actually multi-hop deep into a different team's environment (and therefore whose problem it is to fix).

None of this changes the solve. It does change how a written-up finding *reads* — moving from "we found a credential in the AXFR response" to "we found a credential in the AXFR response, **and** confirmed network reachability from staging-db, **and** documented the network segmentation between staging-db and the credential's host." The second framing is what a senior reviewer will ask for during peer review of your engagement report.

### Bonus find: vendor default account with /bin/bash

**Trigger:** `cat welcome.md` (you ran this as step 1)

**What it teaches:** welcome.md's parenthetical aside notes that *somebody* enabled `/bin/bash` on `dbadmin` during a vendor upgrade six months ago and never reverted to the original `nologin` shell. A real attacker doing yesterday's exact sequence ends up here, with a working interactive shell on a host the account wasn't supposed to be interactive on. Service-account shell drift is its own finding category: the original control intent was that the vendor service account could connect to PostgreSQL but **not run shell commands** if the credential leaked. That control evaporated the moment somebody needed the shell "just for this debug session." The CIS Distribution-Independent Linux Benchmark control 5.5.1 (the shell-of-service-accounts check) addresses exactly this drift; running it on a quarterly cycle, with named-owner review of every diff, is the operational answer. Worth flagging in the same engagement report as the AXFR finding — same root cause (operational shortcuts that *outlive their justification*), different surface.

## §8 — Key takeaways

- **AXFR is one of the cheapest defender wins in the catalog.** One config line plus a TSIG key, applied at every authoritative nameserver in your environment, eliminates the technique. The fact that the misconfiguration persists at internet scale is a problem of organizational attention, not of difficulty.

- **DNS TXT records are a credential dumpster.** Anything someone needs to "stash somewhere quickly" can end up in a TXT record because TXT records are infinitely flexible and trivially editable. Periodic audits — a `dig <zone> AXFR | grep TXT` from a trusted host, reviewed against an approved baseline — catch these before AXFR exposure does.

- **Service accounts created for one-time engagements are the modal sticky-account anti-pattern.** Audit-bypass accounts, vendor-engagement accounts, third-party integration accounts. They get created with good intent, an unfocused expiration discussion, and no automated enforcement; they live forever. The fix is registry-plus-automation, not spreadsheets.

- **The directory of internal services is a target.** Knowing where `prod-db` lives, where the PHI tier sits, which subnet has the backups — all of this turns "where do I attack?" into "I have a map; I can plan." Restrict who can read the directory; segment so unauthorized discovery doesn't produce useful targets even when it succeeds.

- **Compound failures are how breaches happen.** Today's finding required five mundane misconfigurations to stack: unrotated credential, interactive shell on a service account, reach to internal DNS, unrestricted AXFR, credential in TXT record. None individually is exotic. Each independently is fixable. The lesson is not "fix the AXFR" — the lesson is that any one of the five would have stopped the chain.

- **Authorized post-finding reconnaissance is real defender work.** Today's level is not an attack — it's a sized blast-radius validation, performed under written authorization, with documented rules of engagement, producing an incident-report appendix. The discipline distinguishing "controlled exception to validate scope" from "we just made the problem bigger" is paperwork, scope discipline, and the willingness to stop when the rules say stop.

- **For HIPAA-covered environments, DNS reconnaissance is HIPAA reconnaissance.** Hostname enumeration that reveals PHI-tier systems is implicated under the Security Rule's Access Control and Transmission Security technical safeguards, and under the Privacy Rule's minimum-necessary standard. The fact that no PHI was directly transmitted in today's recon does not exempt the finding from HIPAA scope.

## §9 — Further reading

*Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

### Standards documents

- **RFC 5936 — DNS Zone Transfer Protocol (AXFR)**: <https://datatracker.ietf.org/doc/html/rfc5936>. The interoperable specification for AXFR — *updates* RFC 1035's original definition (per the "Updates: 1035" header) rather than replacing it; RFC 1035 §3.2.3, §4.2.2, and §6.3 remain foundational. Read sections 2 (Transport) and 4 (Authoritative Server's AXFR Response) for the operational meat.
- **RFC 8945 — Secret Key Transaction Authentication for DNS (TSIG)**: <https://datatracker.ietf.org/doc/html/rfc8945>. The current TSIG spec (obsoletes RFC 2845, 4635). The mechanism the AXFR ACL relies on for authentication. Read sections 4 (TSIG RR format) and 5 (Protocol Details) for the implementation specifics.
- **NIST SP 800-81 Rev 3 — Secure Domain Name System (DNS) Deployment Guide**: <https://csrc.nist.gov/pubs/sp/800/81/r3/final>. The federal DNS hardening guide. Published March 2026, withdrawing SP 800-81-2 (2013) on the same date. Rev 3 substantially expands the older guide with Protective DNS, encrypted DNS (DoT/DoH/DoQ), zero-trust integration, and OT/IoT chapters. If you're working from the older SP 800-81-2 in any organizational documentation, swap to Rev 3.

### CWE / MITRE ATT&CK

- **CWE-306: Missing Authentication for Critical Function**: <https://cwe.mitre.org/data/definitions/306.html>. Includes the current mapping-status notes and the relationship to the CWE Top 25.
- **CWE-1392: Use of Default Credentials**: <https://cwe.mitre.org/data/definitions/1392.html>.
- **CWE-732: Incorrect Permission Assignment for Critical Resource**: <https://cwe.mitre.org/data/definitions/732.html>. Note the ALLOWED-WITH-REVIEW mapping status and the cautionary text about confusion with CWE-862/863.
- **CWE-200: Exposure of Sensitive Information to an Unauthorized Actor**: <https://cwe.mitre.org/data/definitions/200.html>. Note the DISCOURAGED mapping status.
- **CWE-540: Inclusion of Sensitive Information in Source Code**: <https://cwe.mitre.org/data/definitions/540.html>.
- **MITRE ATT&CK T1590.002 — Gather Victim Network Information: DNS**: <https://attack.mitre.org/techniques/T1590/002/>.
- **MITRE ATT&CK T1018 — Remote System Discovery**: <https://attack.mitre.org/techniques/T1018/>.

### Compliance frameworks

- **HIPAA Security Rule full text (45 CFR Part 164 Subpart C)**: <https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C>.
- **HHS Office for Civil Rights — Breach Reporting Portal ("Wall of Shame")**: <https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf>. The public list of healthcare breaches affecting 500+ individuals. Useful for sector-trend research and for sanity-checking your own org's exposure relative to peers.
- **NIST SP 800-53 Rev. 5 — Security and Privacy Controls for Information Systems and Organizations**: <https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final>. The federal control catalog. The most heavily-cited controls for today's finding live in the SC (System and Communications Protection) and AC (Access Control) families.
- **CIS Critical Security Controls v8.1**: <https://www.cisecurity.org/controls/v8-1>. The current revision (June 2024). Free download with email registration; the implementation-group mappings are particularly useful for sizing remediation effort against organizational maturity.
- **OWASP Top 10 (2025)**: <https://owasp.org/Top10/>. The current edition. Compare against the 2021 list when working from older documentation.
- **OWASP Web Security Testing Guide v4.2**: <https://owasp.org/www-project-web-security-testing-guide/v42/>. The current methodology. DNS enumeration lives in the Information Gathering chapter.

### Tools

- **Project Sonar (Rapid7)**: <https://www.rapid7.com/research/project-sonar/>. Continuous internet-wide scanning data; useful for "what's my external footprint actually look like."
- **SecurityTrails**: <https://securitytrails.com/>. Passive DNS and historical DNS data. Free tier covers most ad-hoc lookups.
- **DNSDumpster**: <https://dnsdumpster.com/>. Free DNS reconnaissance tool. Useful for quick "what's reachable in this zone" checks.
- **Sigma rules (community SIEM detection rules)**: <https://github.com/SigmaHQ/sigma>. The `rules/network/dns/` directory holds AXFR detection rules portable across SIEM platforms.

### Incident & analysis references

- **CISA Healthcare and Public Health Sector advisories**: <https://www.cisa.gov/topics/cybersecurity-best-practices/healthcare>. The sector-specific advisories track recent ransomware operator TTPs against healthcare, including the network-enumeration playbook.
- **Verizon Data Breach Investigations Report (annual)**: <https://www.verizon.com/business/resources/reports/dbir/>. The credential-abuse statistics referenced throughout this walkthrough come from the most recent editions.
- **HHS Office for Civil Rights — Resolution Agreements**: <https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/agreements/index.html>. The settlements OCR has negotiated with breach-affected covered entities. Useful for calibrating the financial side of "how seriously does HHS treat this category of failure."
