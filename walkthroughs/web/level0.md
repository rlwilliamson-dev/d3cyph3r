# level0@web — Meridian's Forgotten Backup Folder

**Track:** Web · **Client:** Meridian State University · **Compliance regime:** FERPA

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@web`. If you haven't solved `level0@web` yet, close this tab and come back after, the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Meridian State University is one of Driftwood's smaller clients: a public regional university in Cedarbrook, Oregon, with roughly 30,000 students. The engagement is brand new. Meridian found Driftwood through the Pacific Northwest public higher-ed mailing list after its existing vendors ran out of capacity, and Priya would very much like it to turn into ongoing work, because this is the kind of client that earns referrals across a whole sector.

The reason you are here is Meridian's cyber-insurance carrier, Cedarwood Mutual, which as of the March renewal cycle now requires a third-party web audit before it will renew. That is increasingly normal. Carriers got tired of paying out on directory-traversal and exposed-backup incidents at universities, and pushed the cost of finding them downstream by writing an audit into the renewal terms. Meridian's policy renews in July, and Priya's team has the audit window.

You are on Driftwood's web-audit workstation as `secops`, the shared service account the security team uses for client recon. It is the audit jumpbox: gobuster installed, curl preconfigured, a headers-only mode available, and a clean source IP that Carlos, Meridian's in-house web developer, has already allowlisted with Meridian's SOC for the audit window.

Carlos joined eight months ago. Before him, Meridian outsourced its public web stack to BluePier Digital, a Bay Area agency that built the current site in 2021, until the relationship ended in 2024 in a dispute over scope and final invoicing. Ever since, Carlos has been tripping over BluePier's leftovers: zipped deploy artifacts, draft content, a couple of `.env` files in places they had no business being. What he told Priya, verbatim: *"There's definitely more I haven't found. I've been doing this solo. If you're going to scan the site I'd rather you find what's left now than have the insurance carrier find it later."* Every security team should be so lucky as to have a Carlos.

Meridian is **FERPA-covered.** The Family Educational Rights and Privacy Act (20 U.S.C. § 1232g; 34 CFR Part 99) protects "education records" containing personally identifiable information about current or former students.[^cfr-34-99] FERPA is an odd beast next to HIPAA or PCI-DSS, because it has no fine schedule at all. Its enforcement mechanism is *"the federal government can withdraw your funding,"* which for a public university is not a penalty so much as an extinction event. Meridian's annual Federal Student Aid (FSA) reporting includes a compliance attestation, so a documented student-record exposure does not stay quiet. It lands in the next attestation cycle as a federal-funding risk.

What you don't know yet is that BluePier left a `/backup/` directory under DocumentRoot on Meridian's production web server, with Apache's default `mod_autoindex` switched on. Among other things it holds a CSV of 4,217 student records from 2023 and a plaintext database credential that the agency itself flagged for rotation and then never rotated.

## §2 — The solve

Three commands, and a server that is about to tell you far more than it should. Reconnaissance is mostly the skill of listening when it does.

### Step 1: Read the brief

```bash
secops@web:~$ cat engagement-notes.md
secops@web:~$ cat meridian-scope.txt
```

The engagement notes set the regulatory frame (FERPA first, GLBA for financial-aid records, HIPAA for the student health center, which is out of today's scope), the people (Carlos, the departed BluePier agency, the insurer applying pressure), and one detail worth underlining: **BluePier was never contractually obliged to clean up on exit**, because the dispute blew up before any final handoff was agreed. So there is no warranty work coming. Whatever BluePier left behind is Meridian's problem now, whoever made it.

The scope file is one line. Today's audit target: `https://www.meridian.edu`. Out of scope: any subdomain other than `www`, the student portal application (separate engagement, behind SSO), and any internal hostnames.

### Step 2: Enumerate paths with gobuster

```bash
secops@web:~$ gobuster https://www.meridian.edu
/                     (Status: 200) [Size: 412]
/about                (Status: 200) [Size: 8412]
/admin                (Status: 401) [Size: 287]
/admissions           (Status: 200) [Size: 12104]
/backup               (Status: 200) [Size: 1183]
/contact              (Status: 200) [Size: 4521]
/financial-aid        (Status: 200) [Size: 9876]
/login                (Status: 200) [Size: 2018]
/robots.txt           (Status: 200) [Size: 142]
/student-portal       (Status: 302) [Size: 0]
```

Most of these are exactly what you would expect. `/admissions`, `/about`, `/contact` and `/financial-aid` are ordinary university-marketing routes. `/student-portal` redirects, presumably into the SSO flow, which is out of scope today. `/admin` returns 401, and that is *good* news: the admin interface wants authentication and the server is correctly refusing strangers.

Two lines warrant attention:

- **`/robots.txt`**, at its standard location. Always worth a read, for reasons that will become clear in about thirty seconds.
- **`/backup`** returning HTTP 200 with a 1,183-byte response. That filename, combined with the engagement context (BluePier left artifacts on the production server), is the first finding signal.

### Step 3: Read robots.txt

```bash
secops@web:~$ curl https://www.meridian.edu/robots.txt
User-agent: *
Disallow: /admin/
Disallow: /backup/
Disallow: /staging/
Disallow: /private/

Sitemap: https://www.meridian.edu/sitemap.xml
```

This is a finding in its own right, and a classic one. The `Disallow` entries were meant to keep search engines away from sensitive paths. What they actually do is **publish a list of exactly the URLs Meridian considers sensitive** to anyone who reads robots.txt, which means every recon script and every attacker. It is such a reliable mistake that "check robots.txt first" is the standard opening move in web recon. Robots.txt is a polite request to well-behaved crawlers, not a security control, and Meridian has been using it as a map for the impolite ones.

For this audit, robots.txt has helpfully confirmed three more paths worth a look: `/staging/`, `/private/`, and `/backup/`, which gobuster had already found.

### Step 4: Look at the backup directory

```bash
secops@web:~$ curl https://www.meridian.edu/backup/
<html>
<head><title>Index of /backup</title></head>
<body>
<h1>Index of /backup</h1>
<hr>
<pre>
<a href="../">../</a>
<a href="README.txt">README.txt</a>                  2023-08-14 11:42      1.2K
<a href="db-creds.txt">db-creds.txt</a>                2023-08-14 11:43       128
<a href="students_export_2023.csv">students_export_2023.csv</a>    2023-08-14 11:38      482K
</pre>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at www.meridian.edu Port 443</address>
</body>
</html>
```

And there it is. Apache's default `mod_autoindex` is rendering a browsable listing of `/backup/` because the directory has no `index.html`. Three files: a README, a credential file, and a CSV of student records. You can grade this critical from the filenames alone. At a FERPA-covered institution, `db-creds.txt` sitting next to `students_export_2023.csv` is about the worst pairing available.

### Step 5: Confirm the README

```bash
secops@web:~$ curl https://www.meridian.edu/backup/README.txt
BluePier Digital — Meridian University engagement
Working directory for deploy artifacts and DB exports.

This directory lives on the production server's filesystem at
/var/www/meridian/public/backup/ and is excluded from the
site's static-build .gitignore. It is NOT excluded from Apache's
autoindex configuration, which is on by default in /etc/apache2/
mods-enabled/autoindex.conf for any directory under DocumentRoot
that does not contain an index.html.

Files here are leftover work-product from the 2023 deploy cycle.
Will clean up after final invoice is paid.
                                                — James, 2023-08-14
```

Read that README again, because BluePier wrote its own incident report two years early. In the agency's own words, it knew the directory sat under DocumentRoot, knew autoindex was on, and made the cleanup conditional on getting paid. The final invoice was never paid, thanks to the contract dispute in the engagement notes, so the cleanup never happened, and the directory has been open to the internet for two years as a result.

### Step 6: Confirm the credential leak

```bash
secops@web:~$ curl https://www.meridian.edu/backup/db-creds.txt
BluePier Digital — Meridian webapp environment notes
Last updated by James 2023-08-14

== Production DB (mysql) ==
Host:     db.meridian.edu (internal only, port 3306)
User:     webapp_admin
Pass:     M3rid14n!2023-prod
DB name:  meridian_portal

NOTE FOR HANDOFF: rotate this before final acceptance.
                  Carlos's team needs to pick a new value.
                  Reminder: this credential is also baked into
                  the staging deployment until we cut over.
```

`M3rid14n!2023-prod` is a live MySQL credential for Meridian's production database. James's note says to rotate it before final acceptance. Final acceptance never came, so as of this audit the credential is almost certainly still working.

That single string is the breadcrumb for `level1@web`. It is also, in a real engagement, the most urgent item on the remediation checklist that Carlos's team has to address today.

### Step 7: Confirm the FERPA-grade exposure

```bash
secops@web:~$ curl https://www.meridian.edu/backup/students_export_2023.csv
student_id,first_name,last_name,email,major,gpa
M-1872941,Aisha,Patel,patel.a@meridian.edu,Computer Science,3.91
M-1872995,Marcus,Reyes,reyes.m@meridian.edu,Biology,3.42
M-1873041,Jordan,Smith,smith.j@meridian.edu,Mechanical Engineering,2.88
M-1873100,Linh,Tran,tran.l@meridian.edu,English Literature,3.76
M-1873112,Tyler,Brooks,brooks.t@meridian.edu,Computer Science,3.05
M-1873198,Sara,Kapoor,kapoor.s@meridian.edu,Pre-Med,3.94
M-1873220,Dmitri,Volkov,volkov.d@meridian.edu,Physics,3.61
M-1873244,Olivia,Chen,chen.o@meridian.edu,Music Performance,3.88

[output truncated — file contains 4,217 records totaling 482 KB]
```

That is 4,217 student records, each with name, ID, email, major and GPA. Every field is a FERPA "education record" under 34 CFR 99.3, and the "directory information" carve-outs do not save it: GPA and academic major are specifically *not* directory information and need explicit consent to disclose. The CSV has been publicly readable at a guessable URL for approximately 22 months.

### Step 8: Use the credential (game-world only)

In a real engagement the work stops here and the finding goes to Carlos within the contractually-defined SLA. In D3CYPH3R the breadcrumb pattern continues to the next level:

```bash
secops@web:~$ ssh level1@web
level1@web's password: M3rid14n!2023-prod
```

You are now inside Meridian's webapp context, holding a live database credential that should have been rotated 22 months ago. What an attacker does next with that access is `level1@web`, with its own walkthrough.

### If you got stuck

- If `curl https://www.meridian.edu/backup/` returned an HTML page that didn't look like a directory listing, double-check the trailing slash. Some web servers require it; some don't. The game treats `/backup` and `/backup/` interchangeably.
- If the gobuster output didn't include `/backup`, you may have run a wordlist that didn't contain that path. The game's built-in gobuster uses a curated common-paths list that includes `/backup`; in real engagements, the SecLists wordlist `directory-list-2.3-medium.txt` is the workhorse.[^seclists-curated-wordlists-for-security]
- If you reached for `cat backup/db-creds.txt` instead of `curl https://www.meridian.edu/backup/db-creds.txt`, remember this is a web audit, not a filesystem audit. You are standing outside the server with `curl`, not inside it with `cat`, and the entire finding is that the file can be fetched *over HTTP* by anyone.

## §3 — The vulnerability

The tempting summary is "BluePier left files in `/backup/`." True, and the headline, and it undersells things. Three separate failures are stacked up here, and unless all three get fixed, the next vendor, or the next messy vendor exit, leaves the same exposure behind.

**Failure 1, `mod_autoindex` on in production.** When enabled, Apache's `mod_autoindex` renders an HTML directory listing for any URL that maps to a directory without an `index.html`. It ships as `LoadModule autoindex_module` in the default Ubuntu Apache install, and on many distributions, including what Meridian's server appears to run (Apache/2.4.41 on Ubuntu, per the listing's own banner), it is **on by default at install time**. The fix is either disabling the module outright (`a2dismod autoindex`) or adding `Options -Indexes` for every directory that should not be browsable. Neither was done. The listing you saw at `/backup/` is not a bug. Apache served exactly what it was configured to serve, which is the more unsettling version of events.

**Failure 2, working files under DocumentRoot.** This is the deeper one. `/backup/` lives at `/var/www/meridian/public/backup/`, and anything inside `DocumentRoot` is published to the internet at the matching URL by definition. It does not matter whether anyone shared the link, whether any page points to it, or whether autoindex is on. Fixing autoindex is necessary but secondary. The real fix is *never putting working files under DocumentRoot in the first place*. BluePier put them there because it was convenient to scp deploy artifacts to one well-known spot, and that convenience cost two years of every file in the spot being readable by anyone.

**Failure 3, robots.txt treated as security.** The `Disallow: /backup/` line was meant to keep search engines from crawling and indexing the directory, and as a search-engine signal it mostly works; Google and Bing will usually honour it. But it does nothing to a direct HTTP request, and it actively *advertises the path* in the first file any recon methodology reads. The fix is never to list a sensitive path in robots.txt at all, and to get the sensitive path out from under DocumentRoot so there is nothing to list.

Each is a finding on its own. Autoindex is the proximate cause, DocumentRoot is the root cause, and robots.txt is the institutional habit that tells attackers which doors to try. Turn autoindex off without removing the directory, and `curl /backup/db-creds.txt` still works on a direct request. Fix DocumentRoot but leave the robots.txt entries, and you have published your naming conventions for the next audit and the next attacker.

## §3.5 — Blast radius

Naming the failure is half of an assessment. The other half is sizing it:
what the finding reaches, how much is in scope, for how long, and what it
opens next. That is the part a risk register needs and the part a
vulnerability scanner cannot produce.

| Dimension | This finding |
|---|---|
| Reached | `/backup/` under `DocumentRoot`, unauthenticated, over the public internet |
| Records in scope | 4,217 student records: student ID, name, email, major, GPA |
| Population | Meridian enrols roughly 30,000 students; the CSV is a 2023 subset, not the roll |
| Exposure window | Roughly two years, from BluePier's deployment to this audit |
| Escalates to | A live production MySQL credential (`webapp_admin` on `db.meridian.edu`), reused in staging |
| Regime | FERPA education records, plus state breach-notification law for the PII[^cfr-34-99] |

Three things in that table deserve to be pulled out, because each is a
place assessments routinely go wrong.

**The record count is a floor, not a total.** 4,217 is what sits in the
CSV. The credential in the same directory reaches `meridian_portal`, the
live system behind it, which holds the rest of the student body. An
assessment that reports "4,217 records exposed" has measured the file and
missed the credential sitting beside it. The honest finding is that a
subset was disclosed and the whole was made reachable.

**The credential is reused, so the radius is wider than one host.**
James's handoff note says the same value is baked into the staging
deployment. Rotating production alone leaves staging authenticating with a
string that has been published on the internet for two years.

**FERPA does not carry a breach-notification duty, and saying otherwise
will get you corrected in the room.** It has no fine schedule and no
notification clause; enforcement runs through the Department of
Education's funding-withdrawal authority, which has never been formally
invoked, and through the annual FSA compliance attestation. The
notification obligation here comes from *state* law attaching to the PII,
not from FERPA. The two are separate exposures with separate clocks, and
conflating them produces a remediation plan that satisfies neither.

## §4 — Real-world parallels

Meridian and BluePier are fictional. Their story is not, and three real cases show where it tends to end: a vendor relationship that finishes without a proper cleanup leaves an exposure window that stays open for as long as nobody looks.

### Maricopa Community Colleges — 2013-2014

In November 2013 the Maricopa County Community College District, the largest community college system in Arizona and one of the largest in the country, discovered that personal information on approximately **2.49 million current and former students, employees, and vendors** had been exposed through a misconfigured web server. Names, dates of birth, Social Security numbers, demographic information and academic records, going back to 1980. According to the district's later disclosures and the class action that followed, the underlying security failure had been flagged internally as early as 2011 and left unfixed.

The mechanism differs from Meridian's autoindex in its details. The *institutional pattern* does not. Maricopa had outsourced parts of its IT; the vendor relationship left data scattered across several web-facing systems; an internal audit spotted the exposure; nobody remediated it; and it stayed open for years until an outside discovery forced the issue. The district paid an estimated **$26 million in breach-response costs**, including identity monitoring for affected individuals and class-action settlements running into 2018.[^maricopa-class-action]

In higher education, Maricopa is the case people reach for when explaining that the vendor may introduce the exposure, but the institution carries the regulatory and reputational weight. FERPA's enforcement mechanism, withdrawal of federal funding, came up in the post-incident commentary, although the Department of Education did not use it here.[^cfr-34-99] What Meridian's general counsel should take from it: a vendor-introduced FERPA exposure becomes the institution's problem the moment anyone finds it.

### First American Financial Corporation — May 2019

On May 24, 2019, Brian Krebs reported that First American Financial Corporation, one of the largest title-insurance providers in the US, had a website design flaw exposing approximately **885 million mortgage transaction records** going back to 2003.[^first-american-financial-corp-may] Social Security numbers, driver's license images, wire-transfer receipts, mortgage documents, tax records. The mechanism was an Insecure Direct Object Reference (IDOR): document URLs used sequential integers, so anyone who legitimately opened one document could change the number and open any other. No authentication required. Just arithmetic.

It is one of the largest known exposures by record count from a single misconfigured web application. The SEC brought an enforcement action that First American settled in June 2021 for $487,616, the SEC's first enforcement action aimed specifically at a registrant's disclosure controls around a cybersecurity vulnerability.[^first-american-sec-enforcement-action] The New York Department of Financial Services opened its own action and negotiated a separate settlement.

The parallel to Meridian is the mechanism: **predictable URLs to sensitive content, no authentication, and no access control beyond hoping nobody guesses the URL.** First American used sequential document IDs; Meridian's URL is the literal string `/backup/students_export_2023.csv`. Same weakness either way. The server publishes sensitive content at discoverable URLs, and being discoverable is the entire vulnerability. First American also settled, from a regulatory point of view, that "we didn't intend it to be public" is no defence. Once data can be reached from the internet without authentication, regulators treat it as published.

### MOVEit Transfer / Cl0p — May–June 2023

On May 31, 2023, Progress Software disclosed a critical SQL injection vulnerability in its MOVEit Transfer file-transfer product, tracked as CVE-2023-34362 with a CVSS score of 9.8.[^cve-2023-34362][^progress-software-moveit-advisory] The Cl0p ransomware group had been exploiting it for at least four days before disclosure, pulling data out of MOVEit instances across thousands of customer organizations. By the time the response settled down in late 2023, approximately **2,700 organizations had filed MOVEit-related disclosures affecting more than 93 million individuals**, and the count kept climbing through 2024 as downstream disclosures arrived.

MOVEit is the defining recent example of *vendor-driven mass exposure* in the United States. The victims included the Oregon Department of Transportation (3.5 million records), the Louisiana Office of Motor Vehicles (6 million records), Colorado State University, the University of Rochester, the New York City Department of Education (45,000 students), and dozens of other state and local agencies and schools. The data crossed every regime there is: FERPA for the schools, HIPAA for healthcare, GLBA for the banks, and state breach laws for everyone.

The technique is different from Meridian's, since MOVEit was SQL injection in vendor software and Meridian is an autoindex misconfiguration in vendor-deployed files. The *institutional shape* matches: a vendor introduced the exposure, the customers carried the regulatory and notification burden, and organizations that had only ever touched the vendor through one product found themselves in the disclosure pile anyway. Which raises an uncomfortable question for Meridian to pass on. If BluePier had other higher-ed clients, how many of them have a `/backup/` directory waiting for somebody to look?

## §5 — Frameworks, deep dive

The in-game post-mortem names six framework controls. Here is what each actually requires, what evidence proves it is in place, and what an auditor writes up when it is not.

### FERPA — 20 U.S.C. § 1232g; 34 CFR Part 99

The Family Educational Rights and Privacy Act, originally enacted in 1974 and codified at 20 U.S.C. § 1232g, is the federal statute that governs the privacy of student education records at any educational agency or institution that receives funds under any program administered by the U.S. Department of Education. The implementing regulations are at 34 CFR Part 99.[^cfr-34-99] Meridian receives federal student aid; FERPA applies to every record about every currently-enrolled and formerly-enrolled student.

Two sections of 34 CFR Part 99 bear directly on the Meridian finding:

**§ 99.31, Conditions for disclosure of personally identifiable information from education records without prior written consent.** This section lists the specific conditions under which an educational institution may disclose PII from education records *without first obtaining written consent from the student or parent*. The list is finite and exhaustive: school officials with a legitimate educational interest, other schools to which the student is transferring, specified federal/state officials for audit and evaluation purposes, parties responsible for determining financial aid, organizations conducting studies on behalf of the school, accrediting organizations, parents in case of dependent students for tax purposes, parties in compliance with a judicial order, appropriate parties in connection with an emergency, and a few additional narrow categories. "Anyone on the public internet who happens to find a guessable URL" is conspicuously not on this list. The Meridian exposure is therefore an unauthorized disclosure under § 99.31.

**§ 99.32, Recordkeeping requirements.** When an educational institution discloses PII from education records, it must maintain a record of the disclosure for as long as the records are maintained, including the parties who received the information and their legitimate interests. The Meridian exposure produces an undocumented, undated, untracked "disclosure" to an unknown number of recipients over a 22-month window, the inverse of what § 99.32 requires. There is no recoverable disclosure log for the 4,217 students whose records have been accessible at the autoindexed URL.

FERPA's enforcement mechanism is not a fine schedule. The Department of Education's Family Policy Compliance Office (FPCO) investigates complaints, issues findings, and, for institutions found in repeated or substantial non-compliance, can recommend withdrawal of federal funding. Withdrawal has never been formally invoked. The threat of withdrawal, plus the reputational and contractual exposure that follows a FERPA finding, is the de facto enforcement.

Audit evidence for FERPA compliance includes a documented privacy policy disclosed annually to students, a documented procedure for responding to records requests, a documented log of disclosures per § 99.32, training records for all staff with access to education records, and, modern best practice, a documented data-inventory exercise showing where education records live and which systems can access them. Common audit findings: privacy policy exists but is out of date; disclosure log is informal or absent; staff training is not refreshed annually; data inventory has not been refreshed since the system was last audited.

### NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information in Non-Federal Systems

NIST Special Publication 800-171, currently at **Revision 3** (finalized May 2024; supersedes Rev. 2), defines the security requirements for protecting Controlled Unclassified Information (CUI) when it resides in non-federal systems.[^nist-800-171] While FERPA is the primary regulatory frame for Meridian, NIST 800-171 is the *operational* control framework most US universities map to for federal-data handling. Meridian's federal student aid records arguably qualify as CUI; even where they don't, NIST 800-171 is the de facto control baseline for the higher-ed sector.

Rev. 3 introduced a new control-numbering format (e.g., `03.01.20` for what was `3.1.20` in Rev. 2) and reorganized several control families. Two controls apply directly to Meridian's finding:

**03.01.20, Use of External Systems.** Establish terms and conditions for connections to, and the use of, external systems; verify the implementation of required controls on external systems prior to allowing the use of, or connections to, those systems. The autoindex-exposed `/backup/` directory effectively creates an external-access path to Meridian's internal artifacts (the credential, the student records). The "external system" in this reading is the public internet itself, and the verification of required controls was not performed, autoindex was on, the directory existed, no review caught the gap.

**03.13.01, Boundary Protection.** Monitor and control communications at external managed interfaces and at key internal managed interfaces. An autoindexed public directory is, by definition, an external interface; the absence of a control restricting access to that interface (no `Options -Indexes`, no `.htaccess` `Deny from all`, no removal of the directory from under DocumentRoot) is a boundary-protection failure.

Audit evidence for NIST 800-171 Rev. 3 compliance includes a System Security Plan (SSP) documenting which 800-171 controls are implemented and how, a Plan of Action and Milestones (POA&M) for any control gaps with remediation timelines, and, for institutions undergoing CMMC certification or DoD-related contract work, a formal third-party assessment.

### NIST SP 800-53 Rev. 5 — AC-3, SC-7, CM-6

NIST 800-53 Rev. 5 (with the most recent minor update being 5.2.0 in August 2025) is the comprehensive control catalog underlying NIST 800-171 and many other frameworks.[^nist-800-53] Three controls apply to Meridian's finding:

**AC-3, Access Enforcement.** The information system must enforce approved authorizations for logical access to information and system resources. Autoindex output on a directory of sensitive content enforces no access control, the server's default behavior is to return the listing to any requester. The bar for AC-3 compliance is "the system actively enforces an authorization decision," not "the system happens to serve content by default."

**SC-7, Boundary Protection.** Monitor and control communications at the external boundary of the system. Same plain-text reading as the 800-171 03.13.01 analog: the public web server is Meridian's external boundary; the boundary should not be publishing internal artifacts; it is.

**CM-6, Configuration Settings.** Establish and document configuration settings for information system components, including settings reflecting the most restrictive mode consistent with operational requirements. Apache's `mod_autoindex` should be off in production unless the directory is explicitly intended to be a public download index, which, for the vast majority of production directories, it isn't. The CM-6 baseline-configuration item for a web server is "autoindex disabled by default; explicitly enabled only where intentional."

### CIS Critical Security Controls v8.1 — Safeguards 4.1 and 4.8

The Center for Internet Security publishes the CIS Critical Security Controls, currently at **version 8.1** (published 2024).[^cis-critical-security-controls-v8] Two safeguards apply to Meridian's finding:

**4.1, Establish and Maintain a Secure Configuration Process.** Establish and maintain a process for configuring enterprise assets, including software and operating systems, with security-relevant settings. The autoindex-off setting is a baseline-configuration item that should be applied automatically at server provisioning. Ansible, Chef, Puppet, Terraform with cloud-init, or equivalent. Meridian's web server was apparently configured manually (or by BluePier two years ago and never refreshed); 4.1 captures the configuration-as-code remediation.

**4.8, Uninstall or Disable Unnecessary Services on Enterprise Assets.** Apache's `mod_autoindex` qualifies as "unnecessary" on the vast majority of production deployments. The fix is `a2dismod autoindex` at the global Apache level, with explicit per-directory `Options +Indexes` if a public download index is genuinely needed.

### CWE-548, CWE-552, CWE-200, CWE-798

The Common Weakness Enumeration catalog has four entries that map to Meridian's finding:

**CWE-548, Exposure of Information Through Directory Listing.**[^cwe-548] The precise pattern in autoindex. The CWE entry specifies exactly this scenario: a server configured to render a directory listing for any URL that resolves to a directory without an index file, exposing the directory's contents to anyone who knows or guesses the URL.

**CWE-552, Files or Directories Accessible to External Parties.**[^cwe-552] The underlying weakness: artifacts under DocumentRoot. CWE-552 captures the more general pattern, sensitive files placed where they are accessible to parties who should not have access. It is the parent weakness to CWE-548 and applies to Meridian's finding even with autoindex disabled, because the underlying artifacts would still be accessible at their guessable URLs.

**CWE-200, Exposure of Sensitive Information to an Unauthorized Actor.**[^cwe-200] The student records themselves. The umbrella weakness for any exposure of sensitive data. Important caveat: CWE-200's MITRE mapping status is currently **Discouraged**, when filing a specific finding, MITRE recommends citing the narrower child weakness instead (here, CWE-548 for the directory listing and CWE-552 for the file-accessibility pattern). CWE-200 remains a CWE Top 25 entry, it sat at #17 on the 2024 edition and #20 on the 2025 edition, but the mapping status is independent of the Top-25 rank: the rank is data-driven (CVE counts), while the Discouraged status reflects MITRE's guidance to use more specific child weaknesses when filing.

**CWE-798, Use of Hard-coded Credentials.**[^cwe-798] The DB password in `db-creds.txt`. The credential half of the finding. The closely-related **CWE-1392 (Use of Default Credentials)** would apply if `M3rid14n!2023-prod` had been the install-default; here it was the operator-chosen value never rotated, which fits CWE-798 more precisely.[^cwe-1392]

### OWASP Top 10:2025 — A02:2025 (was A05:2021) and A01:2025

The current OWASP Top 10 edition is **OWASP Top 10:2025**, finalized in January 2026.[^owasp-top-10-2025] Two categories apply to Meridian's finding:

**A02:2025, Security Misconfiguration.**[^owasp-a02-2025] Promoted from A05:2021 in the 2025 reshuffle, this category covers improperly configured permissions on cloud services, files, and directories; unnecessary features enabled or installed (open ports, services, accounts, privileges); default accounts and passwords still enabled; missing or misconfigured security headers; verbose error messages revealing internal state. **Autoindex left on, robots.txt listing sensitive paths, working files under DocumentRoot**, all three of Meridian's failure modes, are explicit named examples in A02:2025's category description.

**A01:2025, Broken Access Control.**[^owasp-a01-2025] Unchanged from the 2021 edition's top slot. Covers any case where access controls fail to restrict authenticated and unauthenticated users to authorized resources. The Meridian records are accessible to anyone who guesses (or, via robots.txt, doesn't even need to guess) the path. The category includes a named sub-pattern for *accessing resources via predictable URLs*. Meridian's `/backup/students_export_2023.csv` is the textbook example.

The OWASP 2025 recommended mitigations for A02 are: documented hardening procedures applied identically across environments (Ansible/Terraform/etc., enforced in CI/CD), automated configuration scanning (tools that detect autoindex-on, weak ciphers, missing security headers), and explicit configuration baselines reviewed at least annually. For A01: deny by default, validate authorization at every request, log access-control failures and alert on them.

### CWE-668 — Exposure of Resource to the Wrong Control Sphere

[CWE-668](https://cwe.mitre.org/data/definitions/668.html) is the
weakness the other two sit inside, and it is the one worth carrying
away, because it survives every specific fix applied here.[^cwe-668]

A control sphere is the boundary within which a resource's access rules
are meant to apply. `DocumentRoot` is a sphere whose rule is "everything
in here is published to the internet." BluePier placed working files
inside it. Nothing was misconfigured in the sense a scanner recognises:
Apache served exactly what it was told to serve, to exactly the audience
that sphere is defined to have.

This is why disabling `mod_autoindex` is a mitigation rather than a fix.
Autoindex controls whether the directory is *browsable*; it has no
bearing on whether the files inside it are *reachable*, and
`curl /backup/db-creds.txt` still succeeds afterwards. The finding is
resolved only when the resource leaves the sphere, which means moving
the directory out from under `DocumentRoot` entirely.

Framing it this way also explains the `robots.txt` entry, which looks
like a fourth mistake and is really the same one. Listing a path there
does not move it to a different sphere; it advertises the path while
leaving its accessibility unchanged.

## §6 — Cert exam relevance

Five certifications cite this material, from entry-level to hands-on offensive. Each gets the same treatment below, and the sample questions are the part worth your time, because the same autoindex finding reads very differently to a Security+ writer and a pentest examiner.

### CompTIA Security+ — current version SY0-701

Security+ is the entry-level certification most commonly required for DoD 8570/8140 IAT Level II positions and many state/federal government roles.[^cert-security-plus] The current exam is **SY0-701**, which superseded SY0-601 in November 2023 (SY0-601 was retired July 31, 2024). The web-track material maps strongly to two domains.

- **Domain 2, Threats, Vulnerabilities, and Mitigations.** Objective 2.3 covers web application vulnerabilities including security misconfiguration. Objective 2.5 covers vulnerability identification, including web reconnaissance and the tools used for it (gobuster, ffuf, dirb are named explicitly).
- **Domain 3, Security Architecture.** Objective 3.4 covers secure web architecture, including the security implications of web-server configuration, directory traversal, and authorization controls.

**Sample question framing:**

> A security analyst performing an external web audit identifies a directory listing for a `/backup/` URL containing a CSV of student records and a plaintext credential file. The web server is Apache 2.4 with `mod_autoindex` enabled by default. Which of the following actions should the analyst recommend as the PRIMARY remediation?
>
> A. Update `robots.txt` to explicitly disallow the `/backup/` URL
> B. Add `Options -Indexes` to the Apache configuration for the `/backup/` directory
> C. Remove the directory from under DocumentRoot entirely and rotate the exposed credential
> D. Configure the directory to require Basic HTTP authentication

This is the canonical Security+ question pattern, multiple defensible answers, one that addresses the root cause. **C** is correct. A is the wrong direction entirely (publishing the path to attackers). B fixes the listing but the files remain accessible at their direct URLs. D adds authentication but still leaves the credential file's contents accessible to anyone with the credentials. The root cause is "working files under DocumentRoot"; C addresses that plus the necessary credential rotation.

### CompTIA PenTest+ — current version PT0-003

CompTIA's PenTest+ is the offensive-track certification.[^cert-pentest-plus] The current exam is **PT0-003**, which superseded PT0-002 on December 17, 2024 (PT0-002 was retired June 17, 2025). The web-track material maps to two domains.

- **Domain 2, Reconnaissance and Enumeration.** Objective 2.2 covers active reconnaissance with web-enumeration tools, and gobuster, ffuf, dirb and dirsearch are all named. The "wordlist-driven path enumeration → status-code triage → response inspection" methodology is straight out of the exam.
- **Domain 3, Vulnerability Discovery and Analysis.** Web vulnerabilities including directory listing exposure (CWE-548) and predictable-URL exposure (CWE-552).[^cwe-552][^cwe-548] Objective 3.4 covers the analysis side, what to do with a finding once you have it.

**Sample question framing:**

> A penetration tester performing an authorized web assessment identifies the following gobuster output:
>
> ```
> /backup               (Status: 200) [Size: 1183]
> /robots.txt           (Status: 200) [Size: 142]
> /admin                (Status: 401) [Size: 287]
> ```
>
> Which of the following observations is MOST significant for the engagement report?
>
> A. The 401 on `/admin` indicates a properly secured administrative interface
> B. The `/robots.txt` should be inspected to identify additional paths
> C. The 200 on `/backup` warrants direct inspection to determine the content
> D. The size of the responses suggests dynamic content rather than static files

PenTest+ rewards practical exam-canonical analysis. **C** is the most significant, a 200 response on a non-standard path warrants investigation, especially given the suggestive name. B is also correct as a follow-up step but not the *most significant* observation for the report. A is a positive finding (good defense), not a significant one. D is irrelevant guesswork. PenTest+ wants you to recognize the discovery and prioritize the follow-up; the engagement report's value is in the prioritized findings, not the comprehensive scan output.

### CompTIA CySA+ — current version CS0-003

CompTIA's CySA+ is the analyst-track certification focused on threat-detection, vulnerability-management, and incident-response work.[^cert-cysa] CS0-003 was the in-market exam from June 2023 onward; **CS0-004 launched on 23 June 2026**, with CS0-003 retiring 22 December 2026. By the time anyone reads this much past the review date, CS0-004 will be the only sittable version, check CompTIA's exam blueprint page for the current code. The web-track material maps to two domains.

- **Domain 2, Vulnerability Management.** Objective 2.4 covers the vulnerability-identification → prioritization → remediation workflow. The Meridian scenario is a textbook example.
- **Domain 1, Security Operations.** Web-attack-surface monitoring and detection of reconnaissance against your own web servers.

**Sample question framing:**

> A SOC analyst reviewing web-server access logs identifies a sequence of HTTP requests to `/admin`, `/backup`, `/staging`, `/private`, `/.git`, `/.env`, `/old`, and `/test` from a single source IP within a 90-second window. Which of the following BEST describes the activity?
>
> A. A legitimate user navigating the site
> B. A web crawler indexing the site for search-engine visibility
> C. Active reconnaissance via directory enumeration tooling (gobuster, ffuf, or similar)
> D. Browser pre-fetching of likely-navigated URLs

CySA+ tests pattern recognition in operational telemetry. **C** is correct, the specific path list, the timing, and the source-IP signature are all canonical signatures of `gobuster`-style enumeration. The other options don't match the timing (A, D) or the specific path naming convention (B, search-engine crawlers follow links from the site, they don't probe common-misconfig paths).

### CISSP

CISSP is the senior-level (ISC)² certification, intended for security professionals with five or more years of experience.[^cert-cissp] The current exam still follows the **2024 CBK refresh** (next refresh expected in 2027 on the standard three-year cycle). The web-track material spans three domains.

- **Domain 3, Security Architecture and Engineering.** Secure web architecture, defense in depth, secure-by-default principles. The conceptual remediation for the Meridian finding lives in this domain.
- **Domain 5, Identity and Access Management.** Access-control models, including the principle that resources should be denied by default and accessible only by explicit grant.
- **Domain 7, Security Operations.** Vulnerability management, including the institutional process for identifying, prioritizing, and remediating findings like the one Driftwood just produced for Meridian.

**Sample question framing:**

> As the Chief Information Security Officer of a regional university whose external web audit recently surfaced a publicly-accessible `/backup/` directory containing student records, you are presenting remediation options to the Board of Trustees. Which of the following should be your PRIMARY recommendation?
>
> A. Engage outside counsel to manage the FERPA breach-notification process
> B. Implement an automated continuous attack-surface management capability with documented review of every public-facing directory and file
> C. Mandate that every external vendor contract include explicit end-of-engagement cleanup obligations with right-to-audit provisions
> D. Procure additional cyber-insurance coverage to limit financial exposure to future incidents

The trap is that A is necessary (and the legal counsel is involved regardless), B is the technical remediation, C is the vendor-management improvement, and D is risk transfer. **C** is the CISSP answer, the *primary* recommendation at the Board level is the structural change that prevents the *next* vendor relationship from producing this same finding. B is necessary too but secondary; it catches the next finding, while C prevents the next finding's *creation*. CISSP consistently rewards the answer that builds the durable institutional control over the answer that addresses the technical symptom.

### OSCP / PEN-200

The Offensive Security Certified Professional is the most-recognized hands-on offensive certification.[^cert-oscp] The exam is a 24-hour practical hands-on test against a set of target machines. The web-track material is at the heart of the OSCP curriculum.

The methodology OSCP teaches for a web target maps directly to the Meridian solve:

```bash
# 1. Enumerate the web tree
gobuster dir -u https://target.example.edu \
  -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt \
  -t 50 -x txt,php,html,bak,zip,sql

# 2. Read robots.txt and sitemap.xml — never skip these
curl https://target.example.edu/robots.txt
curl https://target.example.edu/sitemap.xml

# 3. For every status-200 path that's non-obvious, fetch it
curl https://target.example.edu/<path>/ -L

# 4. If autoindex shows a directory listing, enumerate every file
# 5. For every file, check the content for credentials, paths, references
```

The OSCP curriculum specifically teaches "gobuster the target" as a Phase-1 web-enumeration move, with `seclists/Discovery/Web-Content/directory-list-2.3-medium.txt` as the canonical wordlist. The exam's web machines almost universally include some variant of an exposed-directory finding, `/backup`, `/admin-old`, `/.git`, `/.svn`, `/test`, `/staging`, that yields either a credential, a configuration file, or a code snippet that enables the next step. The Meridian scenario is the entry-level version of this exam pattern.

OSCP also covers the *defender's* side of the same skill: the candidate should be able to articulate why each exposed-directory finding is a misconfiguration, what control would have prevented it, and what tooling (gobuster, dirsearch, ffuf in the offensive direction; automated config scanners and CI-integrated linters in the defensive direction) would catch the issue continuously rather than at audit time.

## §7 — What a defender does

Anyone running a public-facing web property, and above all any web team whose stack has passed through several vendors over the years, will eventually face this exact question. Carlos is facing it on his own.

**1. Remove the directory. Right now.** `rm -rf /var/www/meridian/public/backup/` followed by `systemctl reload apache2` is the literal first action. The directory should not have been under DocumentRoot; deleting it removes the immediate exposure. Before the `rm`, copy the contents to an offline forensic-retention store so the access logs and the artifacts themselves are available for the breach-investigation cycle.

**2. Rotate the credential. Right now.** `M3rid14n!2023-prod` is compromised regardless of whether any access logs show retrieval. The credential has been internet-accessible for 22 months; treat it as compromised. Issue a new value, deploy it to every service that uses it (the README mentioned a staging deployment, start there), and revoke the old value.

**3. Turn off autoindex globally.** `a2dismod autoindex` on Debian/Ubuntu Apache, then `systemctl restart apache2`. After the global disable, explicitly opt in any directory that is genuinely intended to be a public download index (for most sites, that's zero directories). The default for production should be off.

**4. Audit the rest of DocumentRoot for similar artifacts.** Run gobuster against your own site with a large wordlist, `directory-list-2.3-medium.txt` minimum, ideally the full `seclists/Discovery/Web-Content/raft-large-directories.txt`. Run `find /var/www -name "*.bak" -o -name "*.sql" -o -name "*.zip" -o -name ".env*" -o -name "*backup*" -o -name "*.tar.gz"` against the filesystem. Cross-reference. Anything that looks like a leftover deployment artifact gets reviewed and either removed or moved out of DocumentRoot.

**5. Fix the robots.txt.** Remove every sensitive path from robots.txt. The right way to keep something off the public internet is to not publish it; the right way to keep it out of search engines is the same. A robots.txt should list paths that are legitimately public-facing but you don't want indexed (e.g., search-result pages, infinite-scroll endpoints, login pages); it should never list sensitive paths.

**6. Notify the affected students.** FERPA does not have a hard breach-notification clock like HIPAA's 60 days, but the Department of Education's Privacy Technical Assistance Center (PTAC) expects affected students to be notified "in a reasonable time" and publishes a notification template.[^privacy-technical-assistance-center-ptac] Coordinate with Meridian's general counsel; the federal financial-aid attestation is annual and a documented exposure must be disclosed in the next cycle.[^cfr-34-99]

**7. Continuous Attack-Surface Management (EASM).** Modern external-attack-surface tools. Censys ASM, Microsoft Defender External ASM, Detectify, Tenable Attack Surface Management, Bishop Fox CAST, Cobalt Strike's Cobalt PtaaS, Palo Alto Cortex Xpanse, run continuous gobuster-equivalent scans against your own public footprint and alert on changes. The Meridian finding is the kind of issue these tools surface in their first scan against any new customer. The cost is modest at the institutional scale; the value is the difference between Meridian's 22-month detection window and an hours-long one.

**8. Pipeline discipline going forward.** The longer-arc fix is to stand up a deployment pipeline that does not let working files land in DocumentRoot. CI/CD that builds artifacts in a build-temp directory and rsyncs only the build output to `/var/www/`. A `.htaccess` `Deny from all` in any directory not explicitly meant to be public. Code review on web-server configuration changes. Pre-commit linting that flags `.env` and `.bak` file extensions in repositories that publish to web roots.

**9. Vendor offboarding playbook.** The Meridian-BluePier dynamic, vendor relationship ends in dispute, no formal handoff, artifacts left behind indefinitely, is structurally common. Driftwood should help Meridian build a documented vendor-offboarding playbook: at the end of every vendor engagement, the institution performs (or contracts a third party to perform) a comprehensive enumeration of every system the vendor touched, with documented sign-off that cleanup is complete. The playbook lives in vendor-contract appendices so it's enforceable at renewal time.

**10. Sample detection rule (Sigma, generic web-server access log):**

```yaml
title: External access to common-misconfig path
status: experimental
description: Detects external HTTP requests to URL paths that are
  commonly associated with deployment artifacts left under
  DocumentRoot: sensitive content that, if reachable, should
  trigger investigation.
logsource:
  product: apache
  service: access-log
detection:
  selection:
    cs_uri_stem|contains:
      - '/backup/'
      - '/.git/'
      - '/.env'
      - '/.svn/'
      - '/staging/'
      - '/private/'
      - '/db-creds'
      - '/db-backup'
      - '/admin-old'
    sc_status: 200
  condition: selection
level: high
falsepositives:
  - Legitimate staff access to documented public-facing paths
    (tune per-institution; the path list should be reviewed
    against your actual site map and reduced to truly suspicious
    paths only)
```

This rule, fed into Meridian's SIEM (Splunk, Sentinel, ElasticSearch, whatever), would alert on the next external retrieval of any sensitive path, turning the audit cadence into a real-time detection.

### The same mistake on IIS and nginx

The cross-platform axis for this finding is the web server, not the
desktop OS. A macOS laptop does not serve Meridian's backup folder; a
Windows server might.

| Apache (this level) | IIS | nginx |
| --- | --- | --- |
| `Options +Indexes` generates a listing when no index file is present | Directory browsing is a separate feature and the `<directoryBrowse>` element's `enabled` attribute **defaults to `false`**, so an IIS listing is almost always something a person switched on deliberately[^ms-iis-directorybrowse] | `autoindex` is `off` by default; a listing means it was enabled in a server or location block |
| Remove the directory; then turn the option off globally and re-enable per-path only where a listing is the intended product | Set `enabled="false"` in `web.config`, or uninstall the Directory Browsing role feature so it cannot be re-enabled per-site by accident | Remove the `autoindex on;` directive |
| An index file hides the listing without fixing it | Same trap | Same trap |

Worth noting which way the defaults run. IIS and nginx both ship this
off, so a listing on either is a decision somebody made. Apache is the
one where a distribution's default configuration can hand you a listing
nobody chose, which is how this class of exposure survives a review that
asked "who turned this on" and got the answer "nobody."

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command pattern, `progress --detail` lists what you've unlocked.

### robots.txt as an attacker's site map

**Trigger:** `curl https://www.meridian.edu/robots.txt`

**What it teaches:** Meridian's `robots.txt` lists `/admin/`, `/backup/`, `/staging/`, `/private/`, every path the institution wanted hidden. `Disallow` doesn't hide; it announces. Every reconnaissance script reads `robots.txt` first because it's an indexed convention for "here are the things you weren't meant to find."

The defender's lesson is symmetric to the autoindex finding: **if a path is sensitive, the removal of a link is what hides it; the addition of a Disallow line is what advertises it.** Real-world examples:

- The HHS OCR breach repository contains multiple "Disallow led directly to the exposed asset" findings against universities, healthcare networks, and government agencies. The pattern is so consistent that some commercial attack-surface management vendors (Detectify, Censys) ship a default rule that emits a finding the moment a customer's robots.txt mentions an admin or backup path.
- Carlos's `/backup/` would have been a slightly slower find if it weren't *also* in `robots.txt`. The gobuster wordlist hits it eventually, but the robots.txt billboards it.

What to use instead:
- **Authentication on the path itself.** If `/admin/` requires SSO, putting it in `robots.txt` doesn't matter, the path is gated regardless. The risk is when the path is *served unauthenticated and merely unlisted*.
- **Server-side authorization, not security through obscurity.** Every "hidden URL" model collapses the moment a search engine, an inadvertent log line, or a tool like gobuster discovers it.
- **A clean robots.txt that lists *only* convention paths** (`/wp-admin/` for WordPress, `/api/private/`-style legitimate API gates) and absolutely no operational secrets. The robots.txt should be readable by an attacker and *tell them nothing they didn't already know*.

Using robots.txt to hide things is probably the most reliably wrong piece of web-security folk wisdom still in circulation in 2026. Carlos did not write Meridian's robots.txt. BluePier did, and Carlos inherited the advertised attack surface along with the unmaintained codebase.

## §8 — Key takeaways

- **The vendor who caused the exposure is long gone, and the institution still owns the consequences.** It is a familiar higher-ed story: an agency builds the site, the relationship ends in a dispute, the leftovers stay put, and the FERPA exposure sits there for years until somebody audits.
- **Apache's `mod_autoindex` is on by default on most Linux distributions.** This is not an obscure misconfiguration somebody had to work at. It is the default, and turning it off takes a deliberate choice. Every production web server should have it off, and plenty never get that choice made at provisioning time.
- **robots.txt is not a security control.** It is a *request* to well-behaved crawlers and a *map of sensitive paths* for everyone else. Listing `/backup/` there is about the most effective way to make sure the wrong people find it.
- **A predictable URL to sensitive content is the same as publishing it.** Autoindex, incrementing integer IDs (First American) or just a guessable filename (`students_export_2023.csv`): once a URL is reachable without authentication, the data behind it is effectively public, whatever anybody intended.
- **Mature programs catch this continuously, not at audit time.** EASM tooling, automated configuration baselines, CI-integrated linters, pre-commit hooks. Meridian's audit produced one point-in-time finding. The program's real job is the system that catches the next `/backup/` before it turns into another 22-month exposure.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^cfr-34-99]: [FERPA Regulations — 34 CFR Part 99 (eCFR)](https://www.ecfr.gov/current/title-34/subtitle-A/part-99).
[^privacy-technical-assistance-center-ptac]: [Privacy Technical Assistance Center (PTAC) — US Department of Education](https://studentprivacy.ed.gov/).
[^nist-800-171]: [NIST SP 800-171 Rev. 3 — Protecting Controlled Unclassified Information](https://csrc.nist.gov/pubs/sp/800/171/r3/final).
[^nist-800-53]: [NIST SP 800-53 Rev. 5 — Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
[^cis-critical-security-controls-v8]: [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/v8-1).
[^cwe-548]: [CWE-548 — Exposure of Information Through Directory Listing](https://cwe.mitre.org/data/definitions/548.html).
[^cwe-552]: [CWE-552 — Files or Directories Accessible to External Parties](https://cwe.mitre.org/data/definitions/552.html).
[^cwe-200]: [CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-798]: [CWE-798 — Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
[^owasp-top-10-2025]: [OWASP Top 10:2025](https://owasp.org/Top10/2025/).
[^owasp-a02-2025]: [OWASP Top 10:2025 — A02:2025 Security Misconfiguration (deep link)](https://owasp.org/Top10/2025/A02_2025-Security_Misconfiguration/).
[^owasp-a01-2025]: [OWASP Top 10:2025 — A01:2025 Broken Access Control (deep link)](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/).
[^first-american-financial-corp-may]: [First American Financial Corp. May 2019 data exposure — KrebsOnSecurity](https://krebsonsecurity.com/2019/05/first-american-financial-corp-leaked-hundreds-of-millions-of-title-insurance-records/).
[^first-american-sec-enforcement-action]: [First American — SEC enforcement action settlement (June 2021)](https://www.sec.gov/newsroom/press-releases/2021-102).
[^cve-2023-34362]: [MOVEit Transfer CVE-2023-34362 — NVD entry](https://nvd.nist.gov/vuln/detail/CVE-2023-34362).
[^progress-software-moveit-advisory]: [Progress Software MOVEit advisory](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a).
[^seclists-curated-wordlists-for-security]: [SecLists — Curated wordlists for security testing](https://github.com/danielmiessler/SecLists).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cwe-1392]: [CWE-1392](https://cwe.mitre.org/data/definitions/1392.html).
[^cwe-668]: [CWE-668](https://cwe.mitre.org/data/definitions/668.html).
[^maricopa-class-action]: [Maricopa County Community Colleges District data breach — class-action case summary (Hagens Berman)](https://www.hbsslaw.com/cases/maricopa-county-community-colleges-district-data-breach). 2.49 million records; the district's remediation spend approached $26 million.
[^ms-iis-directorybrowse]: [Directory Browse &lt;directoryBrowse&gt; — Microsoft Learn](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/directorybrowse). The `enabled` attribute defaults to `false`.

### Further reading

- [FERPA — 20 U.S.C. § 1232g (US Code text)](https://www.law.cornell.edu/uscode/text/20/1232g).
- [CIS Apache HTTP Server Benchmark](https://www.cisecurity.org/benchmark/apache_http_server).
- [MITRE ATT&CK — T1083: File and Directory Discovery](https://attack.mitre.org/techniques/T1083/).
- [MITRE ATT&CK — T1595.003: Active Scanning: Wordlist Scanning](https://attack.mitre.org/techniques/T1595/003/).
- [MITRE ATT&CK — T1190: Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/).
- [MITRE ATT&CK — T1078: Valid Accounts](https://attack.mitre.org/techniques/T1078/).
- [Apache HTTP Server — mod_autoindex documentation](https://httpd.apache.org/docs/2.4/mod/mod_autoindex.html).
- [gobuster — directory brute-forcer](https://github.com/OJ/gobuster).
- [ffuf — fast web fuzzer](https://github.com/ffuf/ffuf).
- [dirsearch — web path scanner](https://github.com/maurosoria/dirsearch).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
