# level0@network — Atlas Health Perimeter Check

**Track:** Network · **Client:** Atlas Health · **Compliance regime:** HIPAA Security Rule + HITECH

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@network`. If you haven't solved `level0@network` yet, close this tab and come back after, the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Atlas Health is one of Driftwood's largest healthcare clients: a Pacific Northwest regional provider with roughly 400,000 patient records across about 40 clinics. Marcus, the DevOps Lead, runs a team of twelve engineers. Atlas has been with Driftwood for fourteen months, and the MSA includes ongoing security support plus a quarterly perimeter verification, meaning that every three months Driftwood checks the public attack surface and writes it up.

You are new on Driftwood's internal security team. The shell calls you `secops` because that is the shared account the team uses for client recon: you, Priya and whoever else is on rotation that week all work under it, so the audit log looks the same whoever is typing. You are connected to Driftwood's network-recon jumpbox, which has `nmap` and a handful of related tools installed and a clean IP that every client SOC allowlists ahead of an audit window.

Today is Atlas Health's quarterly verification. Last quarter, in a recorded review meeting, Marcus said: *"We finished the perimeter lockdown in March. Staging is VPN-only now — anyone who needs to hit staging-db has to be on Atlas-VPN."* Priya took the note, and the summary Driftwood wrote on the strength of that statement went into Atlas's compliance file. This is the first verification since.

Priya added one more piece of context to the engagement notes. Three quarterly meetings ago, Marcus mentioned that the staging Postgres default admin password was `atlas-default-2025`, "until we finish the rotation we'll do next sprint." That was five sprints ago. Priya's note reads: *"If staging-db is still reachable, that password is probably still live. Use that information responsibly."* You can hear the weariness in it.

Atlas Health is HIPAA-covered, so the Security Rule (45 CFR Part 164, Subpart C) applies to every system that stores, processes or transmits ePHI.[^cfr-45-164] A breach starts a 60-day notification clock from discovery under the HITECH Act, and when 500 or more individuals are affected, HHS's Office for Civil Rights gets notice in the same window and the breach goes on the public list everyone calls the "Wall of Shame."[^hhs-office-for-civil-rights][^hitech-act-subtitle-d-privacy] Atlas has 400,000 patients. A confirmed exposure here does not just get reported; it gets published.

What you don't know yet is that Marcus's claim was honest in intent and wrong in fact. The staging database is still sitting on the open internet.

## §2 — The solve

Three nmap commands and one comparison against the engagement notes. The work is tiny. All of the skill is in noticing the one thing that does not match what you were told.

### Step 1: Read the brief

```bash
secops@network:~$ cat engagement-notes.md
secops@network:~$ cat atlas-perimeter.txt
```

The engagement notes give you Atlas's regime (HIPAA plus HITECH, 400,000 patients, a 60-day notification clock) and the in-scope hostnames. The perimeter scope file says what *should* be open on each: 443/https on the three public-facing hostnames, and nothing at all on `staging.atlas.health`. Anything else is a finding.

That is your answer key. Read it before you scan. Otherwise you end up staring at nmap output trying to remember what was supposed to be there, which is memory work in the wrong direction and exactly how real findings get waved through.

### Step 2: Scan the public-facing hosts

```bash
secops@network:~$ nmap portal.atlas.health
Starting Nmap scan of portal.atlas.health
PORT     STATE  SERVICE
443/tcp  open   https

secops@network:~$ nmap api.atlas.health
Starting Nmap scan of api.atlas.health
PORT     STATE  SERVICE
443/tcp  open   https

secops@network:~$ nmap vpn.atlas.health
Starting Nmap scan of vpn.atlas.health
PORT     STATE  SERVICE
443/tcp  open   https
```

Three hostnames, 443 open on each and nothing else, exactly matching the scope. Three of four targets clean, and you can start drafting the "no findings on the public-facing tier" sentence. Enjoy it while it lasts.

### Step 3: Scan the staging hostname

```bash
secops@network:~$ nmap staging.atlas.health
Starting Nmap scan of staging.atlas.health
PORT     STATE  SERVICE
22/tcp   open   ssh
443/tcp  open   https
5432/tcp open   postgresql
```

Here it is. The scope says `staging.atlas.health` should show nothing from outside the VPN. The scan shows three open ports.

22/ssh is a finding by itself, since exposed SSH on a staging host is a CIS Control 4-grade misconfiguration, though it still needs a credential to exploit. 443/https may or may not matter, depending on what is behind it; some teams park a documentation page or a 404 catch on staging. But 5432/postgresql is the headline. That is the staging *database*, on the host Marcus described as VPN-only, listening to the entire internet.

### Step 4: Identify the service version

```bash
secops@network:~$ nmap -sV staging.atlas.health
Starting Nmap scan with version detection
PORT     STATE  SERVICE     VERSION
22/tcp   open   ssh         OpenSSH 8.9p1 Ubuntu
443/tcp  open   https       nginx 1.18.0
5432/tcp open   postgresql  PostgreSQL 13.11
```

PostgreSQL 13.11 is a real, production-grade version, so there is no ambiguity: this is a working database, not a stub or a placeholder. It is the same Postgres Marcus's engineers query day to day, answering on a public IP.

### Step 5: Stop

Priya's note was explicit: do not connect to confirm. An exposed port plus the named default credential `atlas-default-2025`, which Marcus admitted to three quarters ago, *is* the finding. Logging in to prove the password works would either be unauthorized access, engagement letter or not, because the scope is "perimeter verification" and not "credentialed assessment", or, at the most charitable reading, a step beyond what Atlas authorized that turns tomorrow's conversation with Marcus into a much worse one.

The finding stands without the confirmation. Anyone, defender or attacker, looking at that nmap output next to the engagement-notes mention of `atlas-default-2025` reaches the same conclusion you just did. You do not need to turn the handle to know the door is unlocked.

### Step 6: Use the credential (in the game world only)

This is the part that would not happen in a real engagement. It happens in D3CYPH3R because the breadcrumb walks you onto the next level:

```bash
secops@network:~$ ssh level1@network
level1@network's password: atlas-default-2025
```

You are now on Atlas Health's staging-db jumphost as the staging service account, on a healthcare client's production-adjacent system, holding a credential that was supposed to be rotated three quarters ago. A real attacker who found the host on Shodan, recognised the Postgres banner and tried `postgres`/`admin`/`atlas-default-2025` would be standing exactly where you are. What they could do from here is `level1@network`, with its own walkthrough.

### If you got stuck

- If `nmap` returned "command not found," you are at the lobby shell rather than the network workstation. Run `ssh level0@network` from the lobby and try again.
- If a scan returned only one or two ports when you expected three, check the hostname spelling. The engagement is on the `atlas.health` zone, and common typos such as `atlas-health.com` come back as "host not found."
- If you went straight to `nmap -sV` without a plain `nmap` first, that works too, since `-sV` adds version detection on top of the same port scan. Plain `nmap` first is still the better habit: it is faster, gives you the shape of the ports, and lets you save the noisier version probes for the hosts that turned up something interesting.

## §3 — The vulnerability

The tempting summary is "the perimeter was wrong." That is the headline and it undersells what failed. Three separate failures are stacked here, and unless all three get fixed, next quarter's audit finds this again.

**Failure 1, a perimeter that existed only as an intention.** Marcus's team announced "staging is VPN-only" in March and updated the documentation. Nobody updated the host firewall, the security group, the upstream load balancer's source restrictions, or the database's `pg_hba.conf`. The intent was right and the enforcement layer was never touched. This is the classic convention-instead-of-configuration failure: a sentence in a meeting treated as though it were a network rule. Packets do not attend meetings.

**Failure 2, nobody watching the perimeter between audits.** Atlas leaned on Driftwood's quarterly check as its audit mechanism. Quarterly checks are fine for documentation and contractual evidence and useless as *detection*: a change made on day one of the quarter stays invisible until day ninety. Attackers running continuous internet-wide scans see the same drift within hours. That asymmetry favours the attacker every time, until the defender closes it with continuous attack-surface monitoring.

**Failure 3, a default credential nobody rotated.** This is not a perimeter problem at all; it is authentication management. `atlas-default-2025` was knowingly left in place for three quarters. Even with a perfect perimeter and a genuinely VPN-only database, a default credential is its own finding, and it would surface the moment anyone with VPN access, employee, contractor or vendor, was assessed. Each failure made the other worse. The open port turned the credential from moderate to critical, and the credential turned the open port from embarrassing to exploitable.

Each one is a finding on its own. Close 5432 at the firewall and skip the rotation, and you have closed half the window; an attacker with access to the bastion, through a compromised contractor account for example, still owns the database. Rotate the credential and leave the perimeter, and you have narrowed the window without closing it, because credential-stuffing against internet-facing PostgreSQL is a very old sport. And without continuous verification, the same conversation happens in three months about whatever the next undocumented change turns out to be.

§7 has the defender's playbook. First, some real companies who learned this the hard way.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | `staging.atlas.health` from the open internet, three ports where the scope file permits none |
| Credential in scope | The vendor default `atlas-default-2025`, flagged three quarterly reviews ago and still unrotated |
| Population at the client | Roughly 400,000 patients across about 40 clinics |
| Records demonstrably exposed | **Unknown, and that is the finding.** See below |
| Escalates to | A shell on the staging-db host as the service account, which is `level1@network` |
| Regime | HIPAA Breach Notification Rule, 45 CFR 164.400-414: individuals within 60 days, and at 500+ also HHS plus in-state media[^cfr-45-164] |

**The honest answer to "how many records" is that Atlas cannot say, and
an assessment that invents a number is worse than one that reports the
gap.** What is established is that an internet-reachable Postgres accepts
a known default credential on a production-adjacent host. Whether the
path from there into production patient data is short or long has never
been tested. "We do not know our own blast radius" is a reportable
finding in its own right, and it is the one that should drive the next
engagement.

**A false attestation is already in the compliance file, and that is a
second exposure with its own timeline.** Marcus said in a recorded review
that staging was VPN-only. Driftwood wrote a summary report on that basis
and it went into Atlas's compliance record. The perimeter finding is
today's problem; the fact that Atlas has been representing a control as
effective when it was not is a governance problem that reaches backwards
through every attestation made since March.

**The 60-day clock does not start at the scan.** HIPAA measures from
discovery of a *breach*, and an exposed service is not yet a breach.
The determination of whether unauthorised acquisition occurred is what
starts it, which is why the log-retention question ("can Atlas prove
nobody used this credential") matters more than the port scan. If Atlas
cannot answer it from records, it cannot rule the event out either.

## §4 — Real-world parallels

Atlas is fictional. An internet-facing system everyone believed was internal is not, and three real organisations show what that belief costs when it turns out to be wrong.

### The MongoDB and Elasticsearch ransom-leak campaigns — 2017 through 2020

In late 2016, a researcher at GDI Foundation began documenting cases of unauthenticated MongoDB instances on the public internet being wiped and replaced with a ransom note demanding bitcoin payment.[^gdi-foundation-mongodb-ransom-attack] The technique was trivial: the attacker ran a Shodan query for MongoDB's default port (27017), connected without credentials (older MongoDB versions defaulted to no authentication enabled), dumped or destroyed the databases, and left a single record in a `WARNING` collection demanding ~0.2 BTC for "recovery." By January 2017, the count of compromised instances had passed 28,000.

The campaign continued through 2017, expanded to Elasticsearch (port 9200), Hadoop (port 8020 and others), CouchDB (port 5984), and Cassandra. A 2020 follow-up campaign called "Meow", named for its calling card, the string `meow` appended to wiped databases, destroyed roughly 4,000 databases in a single week in July of that year,[^meow-2020] with no ransom demand at all. The attacker simply deleted what they found.

What makes this the closest parallel to the Atlas Health finding is the mechanism. The campaign was not the result of zero-day exploitation; it required no skill beyond writing a Shodan query and copy-pasting the appropriate database client command. The vulnerability was the public exposure itself. Every organization affected had a database server bound to the internet that, by some combination of intent and inattention, should not have been. The 2017 campaigns hit hospitals, school districts, dating sites, retail companies, and one US-state-level Department of Motor Vehicles. Atlas Health's exposed postgres is the same shape, with a credential layer the MongoDB and Elasticsearch campaigns mostly didn't have. If the credential were rotated, the exposed port would still be a finding, and the moment any future credential leaked into a breach corpus, the door would be open.

The response to those campaigns followed a pattern worth knowing. Most victims had no logging that would show when the attacker connected, no inventory proving which databases were in scope, and no continuous scanning to warn them about the exposure before the attacker found it. Many found out from a journalist or researcher calling for comment, which is the worst possible way to learn you have been breached.

### Universal Health Services — September 2020

In the early morning hours of September 27, 2020, Universal Health Services, a healthcare network operating roughly 400 hospitals across the United States and the United Kingdom, was hit with a Ryuk ransomware deployment that took every Windows-based clinical system at every affected facility offline simultaneously.[^universal-health-services-september-2020][^universal-health-services-sec-filings] UHS clinicians fell back to paper charting for several days. Lab results were delivered by courier. Some patients were diverted to other hospitals. The total disclosed financial impact was approximately $67 million, including remediation, lost revenue, and incident-response costs.

Initial access, according to UHS's own disclosures and later reporting, was a phishing email delivering Emotet, which delivered TrickBot, which deployed Ryuk. The phishing did not need to get past a perimeter; once a clinician clicked, the attacker was already inside. What made the blast radius catastrophic was the lateral movement afterwards. UHS's internal segmentation could not stop the ransomware spreading to every domain-joined Windows host on the network.

The relevance to Atlas comes in two layers. First, healthcare is a target on purpose. Ransomware operators go after hospital networks because operational pressure shortens negotiations: every hour of paper charting is patient-care risk and reputational damage, so the pressure to pay is unusually high. Second, the failure UHS demonstrated is not so different from the one Atlas is a single step away from. UHS's perimeter held and its *internal* network failed. Atlas's perimeter is not holding right now. If a ransomware operator tries `atlas-default-2025` against the exposed staging Postgres tomorrow, the question becomes how short the lateral-movement path from there into production data is. Atlas does not know, because nobody has tested it.

UHS was not the only big healthcare ransomware event of 2020; Cerner, Magellan Health and Crozer-Keystone were all hit in the same window. It is the one people remember because of its scale (400 facilities) and because the cost was disclosed, and it is still a standard reference point when anyone estimates what ransomware costs a healthcare organisation.[^ibm-cost-of-a-data]

### Change Healthcare — February 2024

On February 21, 2024, Change Healthcare, a subsidiary of UnitedHealth Group that processes roughly one third of all US healthcare payment transactions, was breached by the ALPHV/BlackCat ransomware affiliate program. The attacker disrupted payment processing across the US healthcare system for weeks; pharmacies could not verify insurance, providers could not submit claims, small medical practices ran out of operating cash. The Department of Health and Human Services issued emergency funding programs. UnitedHealth's CEO testified before Congress in May. The cost reported in UnitedHealth's FY2024 annual results was approximately $3.1 billion: $2.2 billion of direct response costs plus $867 million of business disruption at Optum Insight.[^change-healthcare-8k] The number of individuals whose PHI was exposed climbed across subsequent disclosures, initially reported around 100 million in October 2024, the HHS Office for Civil Rights count reached approximately 192.7 million by July 2025, making it by an enormous margin the largest US healthcare data breach on record.

The initial access vector, per UnitedHealth's congressional testimony, was a Citrix portal that did not have multi-factor authentication enforced. The attacker used a compromised credential, exact source disclosed but not central to this analysis, to log in. From there, they pivoted, escalated, deployed BlackCat across Change Healthcare's environment, and exfiltrated approximately 4 TB of data.

The Atlas Health parallel here is sharper than it first looks. Change Healthcare's *Citrix portal* was internet-exposed, and the *credential gap* (no MFA) was the exploitable condition. Atlas Health's *postgres* is internet-exposed, and the *credential gap* (default password) is the exploitable condition. The mechanism is "internet-facing service + a credential that shouldn't work but does." That's not a sophisticated technique. It's the most common shape of catastrophic incident.

The aftermath of Change Healthcare also clarifies what the regulatory and contractual cascade looks like when a healthcare exposure of this magnitude lands. UnitedHealth was required to notify affected individuals under HIPAA's Breach Notification Rule.[^cfr-45-164] Several state attorneys general opened investigations. Class-action lawsuits were filed in multiple jurisdictions. The HHS Office for Civil Rights opened a formal compliance review. Subsequent HHS HPH-CPGs (Cybersecurity Performance Goals) explicitly called out MFA on internet-facing services as an "Essential" goal, meaning every covered entity is expected to have it.[^hhs-hph-cpgs-healthcare-and] Atlas Health's staging postgres is the same risk class as Change Healthcare's Citrix portal, just with fewer zeros at the end of the patient-count.

## §5 — Frameworks, deep dive

The in-game post-mortem names six framework controls. Here is what each one actually requires, what evidence proves it is in place, and what an auditor writes up when it is not.

### HIPAA Security Rule — 45 CFR Part 164, Subpart C

The HIPAA Security Rule obliges covered entities and their business associates to safeguard electronic protected health information (ePHI). It is organised into three families of safeguards, Administrative (§164.308), Physical (§164.310) and Technical (§164.312), plus organisational and policies-and-procedures requirements. Atlas Health is a covered entity. Driftwood, as a contracted security provider with access to systems handling PHI, is a business associate under a signed Business Associate Agreement (BAA).

The Technical Safeguards section is where the Atlas Health finding lives. Two subsections matter directly:

**§164.312(a)(1), Access Control.** The covered entity must implement technical policies and procedures that allow only authorized persons or software programs to access ePHI. The control's implementation specifications require unique user identification, emergency access procedures, automatic logoff, and encryption/decryption (the last two as "addressable" rather than "required," which means the covered entity can elect not to implement them if they document a reasoned alternative). A staging database that accepts unauthenticated connections from the open internet, or accepts authenticated connections using a default credential known to two quarters' worth of consultants, does not "allow only authorized persons" in any operational reading of the rule.

**§164.312(e)(1), Transmission Security.** The covered entity must implement technical security measures to guard against unauthorized access to ePHI being transmitted over an electronic communications network. The implementation specifications include integrity controls and encryption, both addressable. Even with TLS encryption on the database connection, an authenticated attacker, one who used `atlas-default-2025` to authenticate, is "authorized" in the transit sense; the control failure is the underlying access control, not the cryptography.

Audit evidence for §164.312 includes the covered entity's documented risk assessment (§164.308(a)(1)(ii)(A)), network diagrams showing the ePHI flow, firewall rule sets reviewed and approved by a named individual, vulnerability-scan results from a defined cadence, and penetration-test reports. Common audit findings: network diagrams that don't reflect current state, firewall rules approved years ago and never reviewed, "internal-only" services that are actually reachable from the open internet because nobody validated the firewall against the diagram. Atlas's situation is the textbook example.

### HITECH Act — Pub. L. 111-5, Subtitle D

The Health Information Technology for Economic and Clinical Health Act, enacted as part of the 2009 American Recovery and Reinvestment Act, made two substantive changes to the HIPAA enforcement landscape. First, it formally extended HIPAA's penalties and obligations to business associates, meaning a security consulting firm like Driftwood is directly liable for its handling of ePHI it touches, not just contractually liable through the covered entity. Second, and more famously, it introduced the Breach Notification Rule (now codified at 45 CFR Part 164, Subpart D).[^cfr-45-164]

The Breach Notification Rule requires covered entities to notify affected individuals of a breach of unsecured PHI without unreasonable delay and in no case later than 60 calendar days after discovery. "Discovery" is the day the breach was known or should have been known by exercising reasonable diligence. For a breach affecting 500 or more individuals in a single state or jurisdiction, the covered entity must also notify HHS Office for Civil Rights in the same 60-day window, and must notify "prominent media outlets serving the state or jurisdiction." HHS OCR maintains the public Breach Portal (informally the "Wall of Shame"), where all 500+ breaches are listed indefinitely with the covered entity name, breach date, individuals affected, type of breach, and location of breached information.

For Atlas Health specifically, with 400,000 patients distributed across the Pacific Northwest (predominantly Washington and Oregon), the 500-individual threshold is not a question. A confirmed exposure of staging-database content with patient records would trigger the public-notification requirement immediately, plus state attorneys general (Washington, Oregon, and any other state of patient residence), plus a HIPAA compliance review from HHS OCR. The breach disclosure becomes a press release, the regulatory file becomes a multi-year exposure, and the contractual exposure cascades through every Business Associate Agreement Atlas has signed.

Audit evidence for HITECH compliance includes a written breach-notification procedure, identified responsible parties (legal counsel, compliance officer, communications), and documented testing of the procedure (typically annually). Atlas almost certainly has the documents; whether the documents survive contact with the reality of a 400,000-record breach is what the procedure tests are supposed to validate.

### NIST SP 800-53 Rev. 5 — SC-7: Boundary Protection

The NIST Special Publication 800-53 (current revision 5, with the most recent minor update being 5.2.0 in August 2025) is the catalog of security and privacy controls used by federal agencies and widely adopted by state and local governments, contractors handling federal data, and healthcare organizations mapping HIPAA to a more concrete control framework.[^nist-800-53] **SC-7, Boundary Protection**, requires the information system to monitor and control communications at the external boundary of the system and at key internal boundaries within the system.

SC-7's control statement is direct: "The information system: (a) Monitors and controls communications at the external boundary of the system and at key internal boundaries within the system; (b) Implements subnetworks for publicly accessible system components that are physically or logically separated from internal organizational networks; and (c) Connects to external networks or information systems only through managed interfaces consisting of boundary protection devices arranged in accordance with an organizational security architecture."

SC-7 has more than 25 control enhancements, and three of them matter here. SC-7(4), External Telecommunications Services, requires a managed interface for each external telecommunications service. SC-7(5), Deny by Default / Allow by Exception, requires the system to deny network traffic by default and allow it only by exception. SC-7(11), Restrict Incoming Communications Traffic, allows incoming traffic only from authorized sources. A staging Postgres listening on 5432 with no source-IP allowlist breaks SC-7(5) and SC-7(11) outright, and the base SC-7 control is broken by the absence of any managed interface enforcing the VPN-only rule everyone believed existed.

Audit evidence for SC-7 includes network architecture diagrams, firewall rule sets reviewed by named approvers, evidence of "deny by default" baseline configuration, and continuous monitoring data demonstrating that the boundary actually behaves as designed. Common audit findings: firewall rule sets that have accumulated "temporary" allow-rules over months and years that were never removed; "internal" services that drift to public exposure during cloud migrations; no documented review cadence for boundary rules.

### NIST SP 800-53 Rev. 5 — CM-7: Least Functionality

**CM-7, Least Functionality**, requires the organization to configure information systems to provide only essential capabilities, and to prohibit or restrict the use of nonessential functions, ports, protocols, and services. The control's intent is to shrink the attack surface to what's actually needed for the system's mission.

CM-7's straightforward application to the Atlas finding: a staging database does not need to be reachable from the open internet. The "essential capability" is reachability from Atlas's VPN concentrator and from the application servers that talk to staging-db. The "nonessential" capability is public-internet reachability of 5432. CM-7 explicitly names "ports, protocols, and services" as in-scope for the restriction.

The enhancement that matters is CM-7(1), Periodic Review, which requires reviewing the system periodically to identify unnecessary functions, ports, protocols and services. CM-7(2), Prevent Program Execution, is about software and less relevant here, and so is CM-7(5), Authorized Software / Whitelisting. Had Atlas been doing CM-7(1) on a documented cadence, the drift in `staging.atlas.health`'s exposure would have surfaced internally, long before Driftwood's quarterly check found it.

Audit evidence includes the documented list of authorized ports/protocols/services, the review cadence with timestamps, and remediation evidence for findings. Common audit findings: list documented at system go-live and never updated; review cadence is "annually" but the last review was four years ago; no formal mechanism for detecting drift.

### CIS Critical Security Controls v8.1 — Control 4 and Control 13

The Center for Internet Security publishes the CIS Critical Security Controls, currently at **version 8.1** (published 2024, adding alignment with NIST CSF 2.0's *Govern* function but preserving v8 control and safeguard numbering).[^cis-critical-security-controls-v8] The CIS Controls are an opinionated, prioritized list of 18 controls and 153 safeguards designed to defend against the most common attack patterns. They're widely adopted in healthcare, financial services, and as a baseline for state-level requirements like the New York Department of Financial Services 23 NYCRR 500.

Two safeguards apply directly to the Atlas Health finding:

**Safeguard 4.5, Implement and Manage a Firewall on End-User Devices.** Implementation group IG1, the entry-level tier for organisations with limited security maturity. It requires a host-based firewall (Windows Defender Firewall, iptables or nftables on Linux, and so on) that denies by default and allows only essential services. v8.1 scopes it literally to end-user devices, and the server-focused safeguards live under Control 12 (Network Infrastructure Management) and Control 13 (Network Monitoring and Defense), but the spirit carries straight over. What Atlas should have had is the server-tier equivalent: a host rule on the staging Postgres box denying 5432 to every source outside the Atlas-VPN range.

**Safeguard 13.10, Perform Application Layer Filtering.** IG3, the advanced tier for mature programs. It requires application-layer filtering at the network boundary, with protocol-aware inspection and policy enforcement. At Atlas's scale that usually means a WAF for HTTP/S plus protocol-aware enforcement for any database traffic that crosses the perimeter. For Atlas, though, the simple fix (deny 5432 at the perimeter, full stop) is the right IG1/IG2 control, and 13.10 is the defence-in-depth layer behind it.

Audit evidence for CIS controls includes the documented baseline configuration, deployment evidence (configuration management tooling outputs, host-by-host attestation), and continuous-monitoring data showing the baseline is maintained. Common findings: baseline documented but not deployed; deployed but not monitored for drift; monitored but no remediation SLA.

### CWE-200, CWE-668, CWE-1392

The Common Weakness Enumeration, MITRE's catalog of software weakness patterns, has three entries that map directly to the Atlas finding:

**CWE-200, Exposure of Sensitive Information to an Unauthorized Actor.**[^cwe-200] The umbrella. The Atlas database is the sensitive information, and the unauthorized actor is anyone outside Atlas's authorized users. Use it for awareness and not in a formal writeup, because MITRE marks CWE-200 **DISCOURAGED** for vulnerability mapping, and the reason is worth remembering: losing confidentiality is an *impact*, not a root cause. Hundreds of different mistakes lead to it. A finding should name the mistake.

**CWE-668, Exposure of Resource to Wrong Sphere.**[^cwe-668] The conceptual weakness: a resource (the database) reachable from a sphere (the open internet) that should never reach it. CWE-668 is the parent of more specific weaknesses, including CWE-200 and CWE-749 (exposed dangerous functions).[^cwe-749] MITRE flags it **"Discouraged" for mapping real-world vulnerabilities** too, as being too high-level a catch-all for compliance-grade citations. It is useful as an awareness reference and as the hierarchy parent. For the actual writeup, cite the most specific weakness that fits, which for the credential half is CWE-1392 below.

**CWE-1392, Use of Default Credentials.**[^cwe-1392] The credential half of the finding. The database is operating with a default credential (`atlas-default-2025`) that should have been changed at provisioning time and was not. CWE-1392 is the modern, narrowly-scoped successor to the older "default credentials" patterns, it specifically addresses the case where a product or system ships with a known-default authenticator that the operator failed to change. The closely-related **CWE-798 (Use of Hard-coded Credentials)** would also be cited if the credential were *baked into the product* rather than configured by the operator; in this case the operator chose `atlas-default-2025` themselves at install time, which fits CWE-1392 more precisely.[^cwe-798]

Audit and detection tools that surface these CWEs against an infrastructure inventory: Tenable Nessus (credentialed scans), Qualys, Rapid7 InsightVM, Microsoft Defender Vulnerability Management.[^tenable-nessus-credentialed-vulnerability-scanning] For codebase-level credential leaks (the CWE-798 cousin), the secret-scanning tools, gitleaks, TruffleHog, GitHub Secret Scanning, GitGuardian, handle the source-control side.

### OWASP Top 10 — A02:2025 Security Misconfiguration (was A05:2021)

The OWASP Top 10 is the most-cited application-security awareness document in the industry. The current edition is **OWASP Top 10:2025**, finalized in January 2026; the prior edition (2021) is now superseded.[^owasp-top-10-2025] The Atlas Health finding maps to A02:2025. Security Misconfiguration, which moved up from the 2021 A05 slot to A02:2025 specifically because security-misconfiguration findings continued to dominate web-application breach reports in the data underlying the 2025 edition.

A02:2025 covers the application's runtime configuration: default accounts and passwords still enabled, error messages revealing stack traces, security headers missing, unnecessary services enabled, security settings in application frameworks not configured to secure values. The Atlas Health finding hits "unnecessary services enabled" (the database listening on 5432 from outside the VPN) plus "default accounts and passwords still enabled" (`atlas-default-2025`). Both are explicitly named in the A02:2025 description.

The OWASP recommended mitigation for A02:2025 is a repeatable hardening process, a documented baseline configuration applied identically across environments (dev/staging/prod), automated configuration enforcement (Ansible, Chef, Puppet, Terraform with policy-as-code via Sentinel/Conftest/OPA), and continuous validation that the deployed configuration matches the baseline. For Atlas, this means staging.atlas.health's firewall configuration should be in Terraform with a CI check that enforces the source-IP allowlist, and the postgres `pg_hba.conf` should be managed by Ansible with the credential set from a Vault lookup rather than a static initialization.

Note for cross-reference: in the in-game `lessons-learned.md` post-mortem, this same OWASP entry is cited as "A05 (2021)." The 2025 reshuffle moved Security Misconfiguration up three slots; the underlying content is materially unchanged, but anyone studying for an OWASP-aligned cert in 2026 should learn the 2025 numbering.

## §6 — Cert exam relevance

Five certifications cite this material. For each: the current exam version, the objectives this level maps to, and a sample question in that exam's own style. The questions are the useful part, because nmap output reads very differently to a pentest examiner than to a GRC one.

### CompTIA Security+ — current version SY0-701

Security+ is the entry-level certification most commonly required for DoD 8570/8140 IAT Level II positions and for many state and federal government roles.[^cert-security-plus] The current exam is **SY0-701**, which superseded SY0-601 in November 2023 (SY0-601 was retired July 31, 2024). Atlas Health's level0 material maps directly to two domains.

- **Domain 2, Threats, Vulnerabilities, and Mitigations.** Objective 2.5 covers vulnerability identification, including network scanning and the difference between credentialed and uncredentialed scans. Expect a question that gives you nmap output similar to what you ran and asks which finding represents the highest-severity risk.
- **Domain 4, Security Operations.** Objective 4.1 explicitly names nmap as a tool you should be able to recognize and explain. Objective 4.3 covers vulnerability management, including external attack-surface enumeration, the practice you just performed manually for Atlas.
- **Domain 1, General Security Concepts.** Objective 1.4 covers security techniques including network segmentation and firewall rule construction. The conceptual answer to "how should Atlas have prevented this finding" lives here.

**Sample question framing:**

> A quarterly external port scan against a client's staging environment reveals an open PostgreSQL service that documentation states should be restricted to VPN traffic only. The default administrative credential for that service has been known to multiple departing consultants. Which of the following is the BEST PRIMARY recommendation?
>
> A. Rotate the default credential and document the rotation
> B. Implement source-IP allowlisting at the network perimeter to restrict access to the documented VPN range
> C. Engage a third-party penetration tester to attempt authentication
> D. Update the documentation to reflect the current network exposure

The trap is A. Rotating the credential is necessary, but it does not address the *primary* issue, which is the exposure itself. C is operationally wrong, since penetration testing confirms things after the exposure is closed, not before. D documents the failure, which is the wrong direction entirely. **B** is correct: closing the perimeter is the primary remediation, with rotation (A) as a necessary second step. Security+ is comfortable writing questions with two reasonable answers and asking you to pick the one that goes at the *primary* root cause.

### CompTIA CySA+ — exam codes CS0-003 / CS0-004

CompTIA's CySA+ (Cybersecurity Analyst) is the analyst-track cert, focused on threat-detection, vulnerability-management, and incident-response work.[^cert-cysa] CS0-003 was the in-market exam from June 2023 onward; **CS0-004 launched on 23 June 2026**, with CS0-003 retiring 22 December 2026. By the time anyone reads this much past the review date, CS0-004 will be the only sittable version, check CompTIA's exam blueprint page for the current code. Atlas Health's material maps to two domains.

- **Domain 1, Security Operations.** Objective 1.4 covers vulnerability scanning interpretation, including nmap output, Nessus output, and the workflow for prioritizing findings. Objective 1.6 covers active and passive reconnaissance. Driftwood's quarterly verification is exactly the activity this objective tests.
- **Domain 2, Threat Intelligence and Threat Hunting.** Objective 2.2 covers threat-intelligence sources, including Shodan and Censys (the tools an attacker would use to find Atlas Health's exposed postgres before Driftwood's check found it).[^censys-internet-wide-scanner]

**Sample question framing:**

> A security analyst running a quarterly external scan against a healthcare client identifies a database server with an open management port not documented in the asset inventory. The database contains ePHI subject to HIPAA. Which of the following actions should the analyst take FIRST?
>
> A. Initiate the HIPAA breach-notification process for the affected covered entity
> B. Escalate the finding to the client's security contact within the contractually-defined SLA
> C. Document the finding in the analyst's report and continue the scan
> D. Attempt to determine the scope of exposure by querying the database

CySA+ wants the *first* action; this is a procedural-discipline question. Both A and D are wrong (A is premature, discovery of an exposed port is not yet a confirmed PHI breach; D is unauthorized access). C is wrong because it deprioritizes a same-day-escalation finding to a written report. **B**, escalation under the engagement's SLA, is the correct answer. CySA+ questions consistently reward "tell the right person within the contractual time-frame" over technical resolution actions.

### CompTIA PenTest+ — current version PT0-003

CompTIA's PenTest+ is the offensive-track cert, focused on planning, scoping, executing, and reporting penetration tests.[^cert-pentest-plus] The current exam is **PT0-003**, which superseded PT0-002 in December 2024. Atlas Health's level0 material maps directly to PenTest+'s information-gathering domain, which makes this scenario unusually high-value for PenTest+ study.

- **Domain 1, Engagement Management.** Covers scoping, rules of engagement, and authorization documentation. Driftwood's MSA with Atlas constraining the scan to perimeter verification (not credentialed assessment) is the type of constraint this domain tests.
- **Domain 2, Reconnaissance and Enumeration.** Objective 2.2 covers active reconnaissance with nmap, masscan, and similar; objective 2.3 covers vulnerability identification including service-version mapping to known CVEs.
- **Domain 3, Vulnerability Discovery and Analysis.** The interpretation of the nmap output and the decision not to attempt authentication with the known credential maps directly to this domain.

**Sample question framing:**

> A penetration tester operating under a perimeter-verification statement of work identifies an internet-facing PostgreSQL service at the client's staging environment. The tester is aware, from engagement notes, that the database's default administrator credential has not been rotated. Which of the following actions falls WITHIN the scope of the engagement?
>
> A. Authenticate to the database using the known default credential to confirm exploitability
> B. Capture the service banner and version, document the exposure, and report the finding
> C. Run nmap NSE scripts that attempt PostgreSQL default-credential probes
> D. Pivot to enumerate the database's underlying operating system

PT0-003 explicitly tests scope discipline. Both A and C exceed perimeter-verification scope (A is unauthorized authentication; C is automated authentication attempts, which carries the same legal risk). D is also out of scope. **B** is the correct answer, documenting the exposure without crossing the authorization boundary is the standard practice. The "rules of engagement" framing in PT0-003's Domain 1 reinforces this question pattern.

### CISSP

CISSP is the senior-level (ISC)² certification, intended for security professionals with five or more years of experience.[^cert-cissp] The current exam follows the **2024 CBK refresh** (still current, with the next refresh expected in 2027 on the standard three-year cycle). CISSP has eight domains; Atlas Health material spans three.

- **Domain 3, Security Architecture and Engineering.** Covers secure-network-architecture, including segmentation, defense-in-depth, and the secure-by-default principle. The conceptual remediation for Atlas Health's finding lives in this domain.
- **Domain 4, Communication and Network Security.** Covers boundary devices, firewalls, intrusion detection/prevention, and network monitoring. The technical "how" of preventing the Atlas exposure lives here.
- **Domain 7, Security Operations.** Detection, response and investigations, including the continuous-monitoring layer that would have caught the drift between Marcus's March announcement and Driftwood's June verification.

CISSP question framings are notoriously oblique. They reward thinking like a security manager, not like a network engineer. The "best answer" is usually the one that addresses governance and process, not the one that solves the narrow technical problem.

**Sample question framing:**

> As the Chief Information Security Officer of a healthcare provider that recently learned, via an external quarterly review, that a production database had been exposed to the public internet for an extended period, which of the following should be your PRIMARY focus over the next 90 days?
>
> A. Implementing continuous external attack-surface management
> B. Conducting an enterprise-wide network architecture review to identify other potential exposures
> C. Establishing a documented change-management process that explicitly requires perimeter validation for any network-configuration change
> D. Notifying the HHS Office for Civil Rights of the incident

The trap is that all four are reasonable. **D** is necessary but is a near-term legal action, not a 90-day strategic focus. **A** and **B** are technical improvements, both correct. **C** is the CISSP answer, establishing the process that would prevent the recurrence, framed at the governance level. CISSP rewards the answer that addresses the institutional pattern, not the technical symptom.

### OSCP / PEN-200

The Offensive Security Certified Professional is the most-recognized hands-on offensive certification.[^cert-oscp] The exam is a 24-hour practical hands-on test against a set of target machines, with a separate report due afterward. The methodology OSCP teaches is, at its core, exactly what you just did to Atlas Health's perimeter, with the discipline that, on the OSCP exam, *you actually do attempt the credential* (because the exam scope authorizes it; the Atlas engagement scope did not).

The OSCP enumeration loop, applied to a target like Atlas Health, looks like this:

```bash
# Initial sweep
nmap -sV -sC -p- --min-rate=1000 <target>

# Targeted scan on interesting ports
nmap -sV -sC -p 22,80,443,5432 -A <target>

# Service-specific enumeration once you've identified the service
nmap --script=postgres-brute <target> -p 5432
psql -h <target> -U postgres -d postgres   # try defaults
psql -h <target> -U admin    -d postgres
psql -h <target> -U app_admin -d postgres -W   # with the recovered cred
```

The OSCP exam tests this exact sequence: enumerate broadly, identify a service, attempt the canonical attacks (default credentials, known CVEs in the version returned, common misconfigurations), pivot once you have access. The exam grades the pivot, finding the exposed postgres is worth points; using the recovered credential to authenticate, then enumerating the database for further pivots, is worth more points.

The Atlas Health scenario you just executed is the *defender's* version of the OSCP opening play. The same enumeration, with discipline about where to stop. OSCP candidates who become consulting-firm engagement leads after the cert tend to be very good at this discipline; the muscle memory of "scan first, identify what's there, decide what to do" transfers cleanly. The thing the cert doesn't teach, that consulting work does, is "stop here even though you have the credential, because the engagement letter says so." That discipline comes from the contract review side, not the technical side.

## §7 — What a defender does

Every defender at a healthcare organisation, and every engineer at anything internet-facing, eventually discovers that a system everyone calls internal is answering the whole internet. The only question is whether they find it before somebody else does.

**1. Continuous external attack-surface management, not quarterly checks.** The quarterly verification Driftwood performs is necessary for audit documentation but inadequate as a *detection* mechanism. Modern external attack-surface management (EASM) tools. Shodan Monitor, Censys ASM, Bishop Fox CAST, Microsoft Defender External ASM, Tenable Attack Surface Management, Detectify, Palo Alto Cortex Xpanse, run continuously against the organization's documented internet footprint and alert on any change. The cost is modest (~$0.50, $2 per asset per month at enterprise scale); the value is the difference between Atlas's three-month detection window and an hours-long one.

**2. Network segmentation as code, not as convention.** The "staging is VPN-only" declaration Marcus made was a verbal policy without an enforcement layer. The fix is to encode the policy as configuration: AWS Security Groups managed in Terraform with peer review on every change, Azure NSGs with similar IaC discipline, GCP firewall rules tied to a documented service-to-network mapping. The Terraform pull request for the source-IP allowlist on staging-db should be a small, reviewable diff with a clear before/after. The policy review happens at PR time, not at quarterly audit time.

**3. Default-credential scanning on every internal asset.** Even once 5432 is closed at the perimeter, `atlas-default-2025` is still a finding on the *internal* perimeter. Credentialed vulnerability scans (Tenable Nessus, Qualys, Rapid7 InsightVM, Microsoft Defender Vulnerability Management) should run monthly against every internal asset, with database default-credential checks in the policy. The first credentialed scan after rotation proves the rotation happened; the ones after that catch it quietly coming back.

**4. Bastion or just-in-time access instead of static VPN.** "VPN-only" as an access model has been increasingly displaced over the past decade by short-lived, individually-attributable connection brokers. HashiCorp Boundary, AWS Systems Manager Session Manager, Cloudflare Access, Teleport, Tailscale, any of them replaces the persistent-VPN model with per-session credentials, audit logs per session, and the ability to expire access immediately when a consultant rolls off an engagement.[^hashicorp-boundary-just-in-time] Atlas's current model puts the entire access policy on the VPN concentrator's identity provider, which works well in steady state but degrades during high-turnover periods.

**5. PostgreSQL hardening specifically.** For the database itself, the hardening checklist is short and standard: `listen_addresses` in `postgresql.conf` set to specific interface bindings (never `*`), `pg_hba.conf` configured to deny by default and allow only documented source CIDRs, `ssl = on` enforced with `hostssl` (not `host`) entries, no `trust` authentication for any host outside the local socket, role-based access with no use of the `postgres` superuser for application connections, and audit logging via the `pgaudit` extension. The CIS PostgreSQL Benchmark is the canonical checklist; Atlas's staging postgres almost certainly does not pass it as configured today.[^cis-postgresql-benchmark]

**6. Sample detection rule (generic Linux + auditd, for the host side):**

```yaml
title: Inbound connection to PostgreSQL from non-allowed source
status: experimental
description: Detects TCP connections to PostgreSQL (port 5432) from
  source IPs outside the documented Atlas-VPN range.
logsource:
  product: linux
  service: auditd
detection:
  selection:
    syscall: 'connect'
    daddr_port: 5432
  filter_allowed:
    saddr_cidr:
      - '10.42.0.0/16'    # Atlas-VPN range
      - '127.0.0.1/32'    # localhost
  condition: selection and not filter_allowed
level: high
falsepositives:
  - Legitimate internal connections from app servers (should be
    covered by the allowed_cidr list above; tune if false positives)
```

This rule, with the allowed CIDR list maintained as part of the firewall-as-code configuration, would alert on the first unauthorized connection to staging-db. The detection-as-code companion to the firewall-as-code remediation.

**7. Quarterly perimeter checks remain the audit floor.** The quarterly verification Driftwood performs continues to have value as an audit artifact and as the contractual evidence of due diligence. But it is the *floor* of the security program, not the ceiling. The ceiling is continuous monitoring; the floor is the documented quarterly walkthrough that exists so the audit report has the right signatures on it.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command pattern, `progress --detail` from any prompt lists what you've unlocked.

### The five-sprint rotation that never happened

**Trigger:** `cat engagement-notes.md` (you ran this as step 1 of the solve, so the bonus fires there)

**What it teaches:** Priya's audit-trail paragraph records Marcus saying the default credential would be rotated *"next sprint."* That note is dated five sprints ago. The "we'll do that next sprint" verbal commitment is the single most reliable leading indicator of unrotated production credentials in real consulting work, *not because engineers are dishonest*, but because verbal "next sprint" commitments are explicitly **not tracked** in the same backlog the engineer's sprint is graded on. There's no Jira ticket, no sprint board card, no PR review, no Definition of Done.

The mitigation pattern is straightforward and rarely implemented:
- Verbal commitments at quarterly reviews go into the **risk register**, not the meeting minutes
- Each risk register entry has a named owner with an explicit acknowledged due date
- The due date is reviewed (or rolled with documented justification) at every subsequent quarterly meeting

The 2025 [Verizon DBIR](https://www.verizon.com/business/resources/reports/dbir/) ties a substantial fraction of credential-driven initial-access incidents to credentials that were "known stale" before the breach, i.e., credentials a defender could have rotated but didn't, often because the rotation was on someone's list but not on someone's calendar. Marcus's `atlas-default-2025` is the textbook case: every quarterly review since Q3 2025 included a verbal "yes, next sprint", and every quarterly review *also* didn't have a place to write that down.

## §8 — Key takeaways

- **The perimeter drifted because verification was quarterly and attackers are continuous.** Three months of drift is invisible to a defender checking once a quarter, and three months is far more than an attacker running daily Shodan or Censys queries needs to find the exposure and decide what to do with it.
- **Default credentials are their own failure, not a perimeter problem.** Even with a perfect perimeter, `atlas-default-2025` would show up on any credentialed assessment. Atlas had two failures stacked on top of each other, and fixing one leaves the other.
- **In healthcare, the regulatory cascade does more damage than the breach.** HIPAA, HITECH, state AGs, HHS OCR, Business Associate notification, class-action exposure and the public Wall of Shame add up to years of consequences and millions of dollars for one misconfigured port. The technical fix is a one-line Terraform change. The institutional fix is the continuous monitoring that stops the next one.
- **The quarterly check is an audit artifact; continuous monitoring is the security control.** They exist for different reasons, and treating the audit cadence as if it were detection is exactly the habit that produced this finding.
- **OSCP teaches you how to enumerate; consulting teaches you where to stop.** Finding the open port and handling it properly are different muscles, and this level exercises both.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^cfr-45-164]: [HIPAA Security Rule — 45 CFR Part 164, Subpart C (HHS)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C).
[^hhs-office-for-civil-rights]: [HHS Office for Civil Rights — Breach Portal ("Wall of Shame")](https://ocrportal.hhs.gov/ocr/breach/breach_frontpage.jsf).
[^hitech-act-subtitle-d-privacy]: [HITECH Act — Subtitle D, Privacy (HHS Summary)](https://www.hhs.gov/hipaa/for-professionals/special-topics/hitech-act-enforcement-interim-final-rule/index.html).
[^nist-800-53]: [NIST SP 800-53 Rev. 5 — Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
[^cis-critical-security-controls-v8]: [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1).
[^cis-postgresql-benchmark]: [CIS PostgreSQL Benchmark](https://www.cisecurity.org/benchmark/postgresql).
[^cwe-200]: [CWE-200 — Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-668]: [CWE-668 — Exposure of Resource to Wrong Sphere (parent; MITRE flags as "Discouraged" for mapping)](https://cwe.mitre.org/data/definitions/668.html).
[^cwe-1392]: [CWE-1392 — Use of Default Credentials](https://cwe.mitre.org/data/definitions/1392.html).
[^cwe-798]: [CWE-798 — Use of Hard-coded Credentials (closely related)](https://cwe.mitre.org/data/definitions/798.html).
[^owasp-top-10-2025]: [OWASP Top 10:2025](https://top10.owasp.org/2025/).
[^hhs-hph-cpgs-healthcare-and]: [HHS HPH-CPGs (Healthcare and Public Health Cybersecurity Performance Goals)](https://hphcyber.hhs.gov/performance-goals.html).
[^universal-health-services-september-2020]: [Universal Health Services September 2020 ransomware — 8-K filing (direct)](https://www.sec.gov/Archives/edgar/data/352915/000156459020044863/uhs-8k_20200927.htm).
[^universal-health-services-sec-filings]: [Universal Health Services SEC filings index (EDGAR)](https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000352915&type=8-K).
[^gdi-foundation-mongodb-ransom-attack]: [Massive wave of MongoDB ransom attacks makes 26,000 new victims (BleepingComputer, 2017)](https://www.bleepingcomputer.com/news/security/massive-wave-of-mongodb-ransom-attacks-makes-26-000-new-victims/). Contemporaneous coverage of the campaign GDI Foundation researchers documented.
[^ibm-cost-of-a-data]: [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach).
[^censys-internet-wide-scanner]: [Censys — internet-wide scanner](https://search.censys.io/).
[^hashicorp-boundary-just-in-time]: [HashiCorp Boundary — just-in-time bastion](https://developer.hashicorp.com/boundary).
[^tenable-nessus-credentialed-vulnerability-scanning]: [Tenable Nessus — credentialed vulnerability scanning](https://www.tenable.com/products/nessus).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cwe-749]: [CWE-749](https://cwe.mitre.org/data/definitions/749.html).
[^change-healthcare-8k]: [UnitedHealth Group Form 10-K, FY2024 (SEC)](https://www.sec.gov/Archives/edgar/data/731766/000073176625000063/unh-20241231.htm). Reports the full-year cyberattack impact: $2.2 billion of direct response costs plus $867 million of business disruption.
[^meow-2020]: [New 'Meow' attack has deleted almost 4,000 unsecured databases (BleepingComputer, July 2020)](https://www.bleepingcomputer.com/news/security/new-meow-attack-has-deleted-almost-4-000-unsecured-databases/). Over 97% of the affected systems were Elasticsearch or MongoDB.

### Further reading

- [NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule](https://csrc.nist.gov/pubs/sp/800/66/r2/final).
- [MITRE ATT&CK — T1046: Network Service Discovery](https://attack.mitre.org/techniques/T1046/).
- [MITRE ATT&CK — T1595.002: Active Scanning: Vulnerability Scanning](https://attack.mitre.org/techniques/T1595/002/).
- [MITRE ATT&CK — T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/).
- [MITRE ATT&CK — T1078: Valid Accounts](https://attack.mitre.org/techniques/T1078/).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [Shodan — internet-wide scanner](https://www.shodan.io/).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
