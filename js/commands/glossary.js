// Glossary entries surfaced by `what-is <term>` (see learning.js).
//
// Coverage targets the terms that show up in:
//   - the in-game lessons-learned post-mortems (every level ends with one)
//   - the walkthrough Further Reading sections
//   - the help reference text
//
// Forkers: add new entries here when a level introduces a term the
// glossary doesn't cover yet. Keep entries to 4-10 lines — players
// who want deeper context should read the walkthrough.
//
// Keys are UPPER_CASE so the handler's `term.toUpperCase()` lookup
// works for any casing the player types. Compound keys with spaces
// or hyphens are entered as-typed (e.g. "NIST 800-53").
//
// Format convention:
//   TERM — short expansion
//
//   1-2 sentence definition.
//
//   2-3 sentence context: when it applies, why it matters, who maintains it.
//
//   See also: <one URL>

export const GLOSSARY = {
  // ─── Catalog frameworks ──────────────────────────────────────────
  CWE: `CWE — Common Weakness Enumeration

A community-developed list of software and hardware weakness types,
maintained by MITRE. Each CWE entry has a numeric ID, a brief
description, and a mapping status (ALLOWED, ALLOWED-WITH-REVIEW,
DISCOURAGED, or PROHIBITED) that signals whether it's the right
level of abstraction for mapping a specific finding.

CWE entries are the "what kind of bug" half of the security-finding
vocabulary; CVEs are the "what specific instance." A vulnerability
gets a CVE; the class it belongs to gets a CWE.

See also: https://cwe.mitre.org/`,

  CVE: `CVE — Common Vulnerabilities and Exposures

A catalog of specific, public vulnerabilities, maintained by MITRE
as the CVE List and mirrored by NVD with severity scoring. Each CVE
has the form CVE-YYYY-NNNN and points to a specific bug in a
specific product / version.

CVEs are instances; CWEs are classes. A finding might cite both
('CVE-2022-23529 was an instance of CWE-347 Improper Verification
of Cryptographic Signature').

See also: https://www.cve.org/`,

  MITRE: `MITRE

A US-based not-for-profit that operates federally funded research
and development centers. In the security space, MITRE maintains
several public taxonomies: CWE (software weakness types), CAPEC
(attack-pattern catalog), ATT&CK (real-world adversary tactics
and techniques), D3FEND (defensive countermeasures), and the CVE
program (vulnerability identifiers).

See also: https://www.mitre.org/`,

  "MITRE ATT&CK": `MITRE ATT&CK — Adversarial Tactics, Techniques, and Common Knowledge

A globally accessible knowledge base of adversary tactics and
techniques based on real-world observations. Organized as a matrix
of tactics (the "why" — what the adversary is trying to achieve)
and techniques (the "how" — specific procedures), each technique
labeled with a Txxxx identifier.

Used by detection engineers to map blue-team coverage gaps and by
red teams to plan engagements. The Enterprise matrix covers
Windows / Linux / macOS / cloud / network / containers.

See also: https://attack.mitre.org/`,

  OWASP: `OWASP — Open Worldwide Application Security Project

A nonprofit that publishes free application-security guidance. The
flagship lists are the OWASP Top 10 (web), API Top 10, Mobile Top
10, ASVS (Application Security Verification Standard), and WSTG
(Web Security Testing Guide). All published under permissive
licenses.

The Top 10 lists are not a comprehensive standard — they're a
"start here" awareness document for prioritizing remediation
effort.

See also: https://owasp.org/`,

  NIST: `NIST — National Institute of Standards and Technology

A US Department of Commerce agency that publishes federal
information-security standards under the 800-series Special
Publications. Key documents include SP 800-53 (Security Controls),
SP 800-171 (Controlled Unclassified Info), SP 800-63 (Digital
Identity), and SP 800-218 (Secure Software Development).

SP 800-53 is the canonical control catalog for US federal systems;
SP 800-171 is its sister document for non-federal systems handling
CUI under DFARS / CMMC.

See also: https://csrc.nist.gov/publications/sp`,

  "NIST 800-53": `NIST SP 800-53 — Security and Privacy Controls

The canonical control catalog for US federal information systems
(Rev. 5, September 2020). Contains ~1,000 controls organized into
20 families (AC Access Control, AU Audit, IA Identification, SI
System & Info Integrity, etc.). Each control has selectable
enhancements that tailor it to a system's impact level.

Used directly by federal systems; cited as a reference by SOC 2,
HITRUST, CMMC, and most other commercial frameworks.

See also: https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final`,

  "NIST 800-171": `NIST SP 800-171 — Protecting CUI in Non-Federal Systems

The control set non-federal organizations must implement to handle
Controlled Unclassified Information (CUI) under DFARS 252.204-7012
and CMMC. Rev. 3 (May 2024) renumbered the families from §3.x to
§03.0x.0x and harmonized the controls more directly with NIST
800-53 Rev. 5 baselines.

Defense contractors handling CUI must self-attest (or be assessed
under CMMC) to 110 controls across 14 control families.

See also: https://csrc.nist.gov/pubs/sp/800/171/r3/final`,

  "NIST 800-63": `NIST SP 800-63 — Digital Identity Guidelines

The federal standard for digital identity proofing, authentication,
and federation. Current revision is 800-63B-4 (July 2025), retitled
"Authentication and Authenticator Management". Defines three
Authenticator Assurance Levels (AAL1 / AAL2 / AAL3).

AAL2+ requires multi-factor authentication; AAL3 additionally
requires hardware-backed factors and verifier impersonation
resistance.

See also: https://pages.nist.gov/800-63-4/`,

  "NIST 800-218": `NIST SP 800-218 — Secure Software Development Framework (SSDF)

A high-level framework for secure software development published
in 2022. Organizes practices into four groups: Prepare the
Organization (PO), Protect Software (PS), Produce Well-Secured
Software (PW), and Respond to Vulnerabilities (RV).

Originally referenced by OMB M-22-18 / M-23-16 for federal-supplier
attestation; both memos were rescinded January 2026 via M-26-05.
SSDF remains the de facto reference framework for software supply-
chain security.

See also: https://csrc.nist.gov/pubs/sp/800/218/final`,

  "NIST CSF": `NIST Cybersecurity Framework

A voluntary framework for managing cybersecurity risk. Version 2.0
(February 2024) added the GOVERN function to the original five
(IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER). Each function
contains categories and subcategories that map to specific
controls in NIST 800-53, CIS Controls, and ISO 27001.

Widely used as a board-level reporting structure because the
function names are accessible to non-technical audiences.

See also: https://www.nist.gov/cyberframework`,

  "CIS Controls": `CIS Controls — Center for Internet Security Critical Security Controls

A prioritized, simplified set of 18 actions an organization should
take to defend against the most common cyberattacks. Current
revision is v8.1 (June 2024). Three Implementation Groups (IG1 /
IG2 / IG3) scale the safeguards to organization size and risk.

CIS Benchmarks (the configuration hardening guides for specific
platforms) are a separate but complementary publication from the
same organization.

See also: https://www.cisecurity.org/controls`,

  "OWASP TOP 10": `OWASP Top 10 — Most Critical Web Application Security Risks

The flagship awareness document for web-application security
risks, refreshed every 3-4 years based on a survey of contributing
data partners. The 2025 edition (released October 2025) led with
A01 Broken Access Control. Brand-new in 2025: A10 Mishandling of
Exceptional Conditions.

The list is awareness-grade, not comprehensive — it ranks
prevalence and exploitability, not all known web risks.

See also: https://owasp.org/Top10/`,

  ASVS: `OWASP ASVS — Application Security Verification Standard

A detailed, exhaustive checklist for verifying the security of an
application across 14 chapters (V1 Architecture through V14
Configuration in v5.0). Three levels: L1 (opportunistic), L2
(standard), L3 (high-assurance). Current version is v5.0,
published May 2025.

Used as a contract requirement, audit checklist, or pen-test
scoping document. Much more comprehensive than the Top 10.

See also: https://owasp.org/www-project-application-security-verification-standard/`,

  WSTG: `OWASP WSTG — Web Security Testing Guide

A penetration-testing methodology and reference for web
applications. Organized by category (Information Gathering,
Configuration Management, Authentication, Session Management,
Authorization, etc.), each test labeled with a WSTG-CAT-NN
identifier.

Companion to the Testing Guide is the MASTG (Mobile Application
Security Testing Guide).

See also: https://owasp.org/www-project-web-security-testing-guide/`,

  // ─── Specific CWEs (the ones cited most in lessons-learned) ──────
  "CWE-200": `CWE-200 — Exposure of Sensitive Information to Unauthorized Actor

A high-level class covering any unintended disclosure of sensitive
data to a party that shouldn't have it. MITRE marks CWE-200 as
DISCOURAGED for new findings — it's too abstract; prefer a more
specific child (CWE-201 in Response, CWE-202 in Sent Data,
CWE-208 by Timing Discrepancy, CWE-209 in Error Message, etc.).

Still cited in older catalogs and remediation guides as the parent
of the disclosure family.`,

  "CWE-798": `CWE-798 — Use of Hard-coded Credentials

A credential (password, key, token) baked into source code,
configuration, or a backup file. The product authenticates with
the credential whether or not it should — and anyone who reads
the artifact gets the credential too. ALLOWED mapping status.

Fell off the 2025 CWE Top 25 (MITRE methodology change to remove
normalization to abstract weaknesses), but the underlying pattern
remains one of the most-frequent root causes of breach.`,

  "CWE-639": `CWE-639 — Authorization Bypass Through User-Controlled Key

The application uses a key (typically a path parameter or query
string) to look up a record but doesn't verify that the requester
is allowed to access THAT key. The canonical IDOR (Insecure
Direct Object Reference) bug pattern. Top 25 #4 in 2025.

Listed as a child of CWE-862 Missing Authorization; map CWE-639
when the requester is authenticated and the missing check is the
ownership / scope check.`,

  "CWE-862": `CWE-862 — Missing Authorization

A higher-level class covering any case where the application
doesn't perform an authorization check it needed to perform.
ALLOWED-WITH-REVIEW — review Base-level children (CWE-639,
CWE-285, CWE-275) before mapping to this class.

Top 25 #4 in 2025 (up from #9 in 2024 and #11 in 2023).`,

  "CWE-285": `CWE-285 — Improper Authorization

The application performs an authorization check, but the check
is incorrect — allowing access that should be denied. DISCOURAGED
mapping status; prefer a more specific child (CWE-862 Missing
Authz, CWE-863 Incorrect Authz, CWE-639 IDOR).`,

  "CWE-347": `CWE-347 — Improper Verification of Cryptographic Signature

The application accepts data labeled as cryptographically signed
without correctly verifying the signature — or with a verifier
that can be tricked into using attacker-controlled parameters.
ALLOWED mapping status.

The 'alg: none' JWT family lives here; so does signature stripping
on JAR / APK files and algorithm-confusion attacks on JWE / JWT.`,

  "CWE-532": `CWE-532 — Insertion of Sensitive Information into Log File

Credentials, session tokens, API keys, or PII end up written to a
log line. Common forms: a debug logger that captures the entire
HTTP request including Authorization headers; an exception that
includes the failed username (whose typo turns out to be the
typed password); a query log capturing parameter values.

The fix is structural: redact at the logger, not at the call site.`,

  "CWE-306": `CWE-306 — Missing Authentication for Critical Function

A function that should require authentication doesn't check for
it. Includes services that listen on a network with no auth
configured (Redis on 0.0.0.0:6379, Elasticsearch with security off,
DNS zone transfers from any client). ALLOWED mapping status.

Top 25 #25 in 2024, #21 in 2025.`,

  "CWE-548": `CWE-548 — Exposure of Information Through Directory Listing

An autoindex feature (nginx 'autoindex on;', Apache 'Options
+Indexes') is enabled on a directory that contains files not meant
for public listing. The classic "open backup directory" finding.
ALLOWED mapping status.`,

  // ─── MITRE techniques (the ones cited most in lessons-learned) ────
  "T1078": `T1078 — Valid Accounts

An adversary obtains and uses credentials of existing accounts as
a means of gaining Initial Access, Persistence, Privilege
Escalation, or Defense Evasion. Sub-techniques cover Default
Accounts (.001), Domain Accounts (.002), Local Accounts (.003),
and Cloud Accounts (.004).

The credential-reuse problem in OSINT / breach corpus lookups
lands here. So does any "the password was leaked in a previous
breach" finding.

See also: https://attack.mitre.org/techniques/T1078/`,

  "T1110.004": `T1110.004 — Brute Force: Credential Stuffing

Adversaries reuse credentials obtained from data breaches against
unrelated accounts, betting on password reuse. The defensive
control is breach-list screening at password creation / rotation
(NIST 800-63B-4 §5.1.1.2 explicitly requires checking against
known compromised lists).

See also: https://attack.mitre.org/techniques/T1110/004/`,

  "T1190": `T1190 — Exploit Public-Facing Application

The adversary exploits a weakness in an internet-facing application
to gain initial access. Covers SQL injection, command injection,
deserialization, file upload, and any other code-execution or
data-access bug in a publicly-reachable web/API tier.

See also: https://attack.mitre.org/techniques/T1190/`,

  "T1213": `T1213 — Data from Information Repositories

Adversaries leverage information repositories (Confluence,
SharePoint, wikis, internal portals) to mine sensitive details
such as credentials, technical documentation, and internal
project information.

See also: https://attack.mitre.org/techniques/T1213/`,

  "T1552.001": `T1552.001 — Unsecured Credentials: Credentials In Files

Adversaries search local file systems and remote shares for files
containing insecurely stored credentials. Includes scripts with
hardcoded passwords, application configs, version-control
artifacts, and shell-history files.

See also: https://attack.mitre.org/techniques/T1552/001/`,

  "T1567.002": `T1567.002 — Exfiltration Over Web Service: Exfiltration to Cloud Storage

Adversaries exfiltrate data to a cloud-storage service (Dropbox,
Mega, Google Drive) they control rather than to a traditional C2.
The exfil traffic blends with normal web browsing, evading network
ACLs and DLP rules that focus on known malicious infrastructure.

See also: https://attack.mitre.org/techniques/T1567/002/`,

  "T1593.003": `T1593.003 — Search Open Websites/Domains: Code Repositories

Adversaries search public code repositories for information about
victims that can be used during targeting. Source-control credential
leaks (the universal '.env committed before .gitignore') are the
classic example.

See also: https://attack.mitre.org/techniques/T1593/003/`,

  // ─── Regulations ─────────────────────────────────────────────────
  "PCI-DSS": `PCI-DSS — Payment Card Industry Data Security Standard

The contractual standard merchants must meet to handle credit-card
data, maintained by the PCI Security Standards Council. Current
version is v4.0.1 (June 2024). Twelve Requirements cover network
controls, access controls, encryption, vulnerability management,
logging, and policy.

PCI assessors (QSAs) audit against the standard annually for
Level 1 merchants and self-assessment questionnaires for smaller
ones.

See also: https://www.pcisecuritystandards.org/`,

  HIPAA: `HIPAA — Health Insurance Portability and Accountability Act

The US federal law governing the privacy and security of
Protected Health Information (PHI). The HIPAA Security Rule (45
CFR §164.302-318) requires administrative, physical, and technical
safeguards. Covered Entities (health providers, plans,
clearinghouses) and their Business Associates must comply.

Breach Notification Rule requires affected-individual disclosure
within 60 days of discovery; >500-affected breaches trigger HHS
OCR notification.

See also: https://www.hhs.gov/hipaa/`,

  FERPA: `FERPA — Family Educational Rights and Privacy Act

The US federal law governing the privacy of student education
records. Applies to any educational institution receiving federal
funds. Parents (or students 18+) must consent to disclosure of
education records to third parties, with limited exceptions for
school officials with "legitimate educational interest".

Enforced by the US Department of Education's Student Privacy
Policy Office. Violations are theoretically punished by loss of
federal funding (which has never happened in practice).

See also: https://studentprivacy.ed.gov/`,

  GLBA: `GLBA — Gramm-Leach-Bliley Act

The US federal law governing the privacy of consumer financial
information at financial institutions. The Safeguards Rule
(16 CFR Part 314) requires a written information security program;
the Privacy Rule (16 CFR Part 313) governs the privacy notices
financial institutions must send customers.

The 2023 Safeguards Rule amendment introduced a 30-day breach-
notification clock (effective May 2024) for incidents affecting
500+ consumers.

See also: https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act`,

  CMMC: `CMMC — Cybersecurity Maturity Model Certification

The DoD's certification program for defense contractors handling
Federal Contract Information (FCI) or Controlled Unclassified
Information (CUI). Level 1 (basic safeguarding) maps to FAR
52.204-21; Level 2 maps to NIST 800-171; Level 3 maps to a subset
of NIST 800-172.

CMMC 2.0 was the proposed restructuring; final rule published in
the DFARS implementation phase.

See also: https://dodcio.defense.gov/CMMC/`,

  "SOC 2": `SOC 2 — Service Organization Control 2

An AICPA attestation report on a service organization's controls
relevant to security, availability, processing integrity,
confidentiality, and privacy (the five Trust Services Criteria).
Type I is a point-in-time design assessment; Type II covers
operating-effectiveness over a 6-12 month period.

The de facto B2B trust signal for SaaS / cloud / managed-service
providers. Auditors are licensed CPAs.

See also: https://www.aicpa-cima.com/topic/audit-assurance/soc`,

  NAIC: `NAIC — National Association of Insurance Commissioners

The standard-setting and regulatory-support organization of US
insurance commissioners. Its Insurance Data Security Model Law
(MDL-668, adopted October 2017) requires insurers to implement
written information-security programs, conduct risk assessments,
and notify within 72 hours of a cybersecurity event. Adopted by
~28 jurisdictions as of early 2026.

See also: https://content.naic.org/cipr-topics/cybersecurity`,

  NYDFS: `NYDFS — New York Department of Financial Services

The state regulator for financial-services companies operating in
New York. 23 NYCRR 500 (Cybersecurity Requirements for Financial
Services Companies, effective March 2017, amended November 2023)
requires risk assessments, written cybersecurity programs, MFA,
72-hour breach notification, and annual CISO certifications.

The 2023 amendment added Class A companies (large), CISO
qualifications, and incident-response-plan requirements.

See also: https://www.dfs.ny.gov/industry_guidance/cybersecurity`,

  DFARS: `DFARS — Defense Federal Acquisition Regulation Supplement

The DoD's supplement to the Federal Acquisition Regulation (FAR).
DFARS 252.204-7012 (Safeguarding Covered Defense Information)
requires contractors handling CUI to implement NIST 800-171, report
cyber incidents within 72 hours, and preserve media for 90 days
(per paragraph (e)).

See also: https://www.acquisition.gov/dfars`,

  // ─── Certifications ──────────────────────────────────────────────
  "SECURITY+": `Security+ — CompTIA SY0-701

The entry-level vendor-neutral security certification. Covers
attacks/threats, architecture, implementation, operations &
incident response, governance/risk/compliance. SY0-701 launched
November 2023, replacing SY0-601 (which retires July 2024).

Often the first cert hire requirement for SOC analyst roles.

See also: https://www.comptia.org/certifications/security`,

  "CYSA+": `CySA+ — CompTIA Cybersecurity Analyst

Mid-level vendor-neutral cert focused on threat intelligence,
detection, and incident response. CS0-003 launched June 2023;
CS0-004 launched early 2026 with CS0-003 retiring June 2026.
Parallel availability gives candidates time to choose.

Common requirement for SOC analyst tier 2 / detection engineering
roles.

See also: https://www.comptia.org/certifications/cybersecurity-analyst`,

  CISSP: `CISSP — Certified Information Systems Security Professional

The flagship ISC2 certification for security leadership and
management. Covers eight domains: Security & Risk Management,
Asset Security, Architecture/Engineering, Communication & Network
Security, IAM, Assessment/Testing, Operations, Software
Development Security.

Requires five years of cumulative paid full-time work experience
in two of the eight domains.

See also: https://www.isc2.org/Certifications/CISSP`,

  OSCP: `OSCP — Offensive Security Certified Professional

A hands-on penetration-testing certification from OffSec. The
exam is a 24-hour proctored practical test where the candidate
compromises target machines and submits a professional report.
The PEN-200 course (Penetration Testing with Kali Linux) is the
canonical preparation.

OSCP is heavy on persistence and methodology — its tagline is
"Try Harder."

See also: https://www.offsec.com/courses/pen-200/`,

  "SCS-C03": `AWS Security Specialty — SCS-C03

The AWS Certified Security – Specialty certification. SCS-C03
launched late 2025 / early 2026 as the successor to SCS-C02.
Validates expertise in identity & access, infrastructure security,
data protection, incident response, monitoring & logging, and
governance / compliance on AWS.

See also: https://aws.amazon.com/certification/certified-security-specialty/`,

  // ─── Core technical concepts ─────────────────────────────────────
  JWT: `JWT — JSON Web Token

A compact, URL-safe token format consisting of three base64url-
encoded segments separated by dots: header.payload.signature. The
header declares the signing algorithm; the payload carries claims;
the signature authenticates header + payload.

JWT payloads are NOT confidential — they're base64-encoded, not
encrypted. Anyone who has the token can read its claims.

Common bug: 'alg: none' in the header tricks naive verifiers into
accepting an unsigned token. RFC 8725 §3.1 mandates rejecting
unsupported algorithms.

See also: https://datatracker.ietf.org/doc/html/rfc7519`,

  IDOR: `IDOR — Insecure Direct Object Reference

A bug pattern where the application uses a user-supplied identifier
(URL path parameter, query string, form field) to look up a
record but doesn't verify that the requester is authorized to
access THAT specific record. The canonical "change the ID in the
URL and get someone else's data" finding.

Maps to CWE-639 Authorization Bypass Through User-Controlled Key.
Listed as OWASP API1 Broken Object Level Authorization (BOLA) in
the API Top 10.`,

  BOLA: `BOLA — Broken Object Level Authorization

The API-context name for IDOR. OWASP API Security Top 10 #1 since
2019 (BOLA is "API1"). Same root cause: the API doesn't verify
that the authenticated requester owns or has access to the
specific object referenced by an identifier in the request.`,

  AXFR: `AXFR — DNS Zone Transfer

A DNS protocol operation that lets one name server pull an entire
DNS zone from another (the primary). Designed for primary-to-
secondary replication; should be restricted to authorized
secondaries.

A zone transfer that succeeds against an arbitrary client is a
classic perimeter-recon finding — it dumps every record in the
zone, including internal-only hostnames the public DNS hides.
Maps to CWE-306 Missing Authentication for Critical Function.`,

  MFA: `MFA — Multi-Factor Authentication

Authentication using two or more independent factor categories
(something you know / something you have / something you are).
NIST 800-63B-4 requires MFA at AAL2+. Phishing-resistant MFA
(WebAuthn, FIDO2 hardware tokens) is the gold standard;
TOTP / SMS / push are weaker.

NIST 800-63B explicitly deprecates SMS as an out-of-band
authenticator (since the 2017 revision).`,

  IAM: `IAM — Identity and Access Management

The collective term for the systems that manage user identities,
authentication, authorization, and lifecycle (provisioning,
de-provisioning). At the cloud-provider level, IAM refers to the
service that issues roles, policies, and credentials (AWS IAM,
Google Cloud IAM, Azure Entra ID).

Modern IAM mantras: least privilege, just-in-time access, no
long-lived access keys, federate over assume-role.`,

  RBAC: `RBAC — Role-Based Access Control

An authorization model where permissions are attached to roles,
and users are assigned roles. Simpler than ABAC but coarser —
RBAC struggles with context-dependent permissions ("this
analyst can access claims for the customers their team owns").

ABAC (Attribute-Based) and ReBAC (Relationship-Based) are the
finer-grained alternatives.`,

  ABAC: `ABAC — Attribute-Based Access Control

An authorization model where access decisions are computed from
attributes of the subject, resource, action, and environment.
More flexible than RBAC for context-dependent policies (department
matching, time-of-day restrictions, geographic constraints).

The cost is policy-evaluation complexity — ABAC engines (OPA,
Casbin) sit in the request path.`,

  REBAC: `ReBAC — Relationship-Based Access Control

An authorization model where access is determined by relationships
in a graph (Zanzibar-style). Google's internal Zanzibar paper
(2019) is the canonical reference; OpenFGA, SpiceDB, and Permify
are open-source implementations.

Excels at "social-graph" permissions where the path between subject
and resource matters (document sharing, organizational hierarchies,
parent-child resource ownership).`,

  RLS: `RLS — Row-Level Security

A database feature where access policies are enforced at the row
level inside the database engine. PostgreSQL RLS uses POLICY
statements; MySQL doesn't have native RLS (use views or
application-layer enforcement).

The cleanest defense-in-depth against IDOR — even if the
application layer skips an authorization check, the database
refuses to return rows the user isn't allowed to see.`,

  KMS: `KMS — Key Management Service

A managed service that creates, stores, and uses cryptographic
keys without exposing the key material. AWS KMS, Google Cloud
KMS, and Azure Key Vault are the cloud-provider implementations.

KMS-managed keys never leave the service in plaintext — clients
call Encrypt / Decrypt / Sign / Verify APIs. Customer Master
Keys (CMKs) can be tied to IAM policies that gate which
identities can use them.`,

  // ─── Telemetry / detection ───────────────────────────────────────
  EVTX: `evtx — Windows Event Log file format

The binary file format Windows uses to store its event logs since
Windows Vista. Each .evtx file contains records with EventID,
Provider, Channel (Security / System / Application / Setup), and
EventData. Forensic tools (EvtxECmd, Hayabusa, Chainsaw) parse
.evtx for incident-response triage.

In D3CYPH3R the \`evtx\` command parses pre-staged level data;
on a real Windows system, Get-WinEvent or wevtutil are the native
parsers.`,

  SIEM: `SIEM — Security Information and Event Management

A platform that aggregates security telemetry from multiple
sources (endpoints, network, identity, cloud), normalizes it, and
runs detection rules against the stream. Splunk, Sentinel, Chronicle,
Sumo Logic, Elastic Security are the major commercial / open-
source options.

The "detection engineering" discipline writes and tunes the rules
that fire on the SIEM stream.`,

  CRON: `cron — Unix job scheduler

The classic Unix daemon for running scheduled tasks. Each user has
a crontab (cron table) listing time specs + command lines:

    # m  h  dom mon dow  command
    */5 *  *   *   *    /usr/local/bin/healthcheck.sh

System-wide jobs live in /etc/cron.d/ and /etc/crontab. Anacron
handles jobs that can run "around" a time rather than on it.
View your crontab with \`crontab -l\`; modern setups have largely
moved to systemd timers for the same job.`,

  SYSTEMD: `systemd — Linux init / service manager

The de facto init system on most modern Linux distros (Debian /
Ubuntu / RHEL / Fedora / Arch / SUSE). Manages units (services,
timers, sockets, mounts, devices) defined under
/etc/systemd/system/ and /usr/lib/systemd/system/.

Key commands: \`systemctl start|stop|status|enable|disable <unit>\`,
\`journalctl -u <unit>\` for that unit's logs. systemd-timers
replace classic cron for new-school scheduled jobs.

Created by Lennart Poettering at Red Hat (initial release 2010).
Controversial in 2014-2016 for replacing sysvinit; now ubiquitous.`,

  JOURNAL: `journald — systemd's binary log store

The systemd journal is a structured, binary log database written
by journald to /var/log/journal/. Each entry has typed fields
(MESSAGE, PRIORITY, _SYSTEMD_UNIT, _PID, _HOSTNAME, etc.) rather
than free-form text. Query with \`journalctl\` — filter by unit
(-u), priority (-p), time (--since / --until), or any field
(_PID=842).

Coexists with /var/log/syslog: rsyslog and journald often run
in tandem, with rsyslog forwarding to remote SIEMs while
journald keeps a local structured store.`,

  DMESG: `dmesg — kernel ring buffer dump

Prints the contents of the kernel's circular log buffer:
boot-time hardware probing, driver loads, OOM kills, link-state
changes, SYN-flood warnings, segfaults. Each line carries a
bracketed seconds-since-boot timestamp.

On modern systemd-based systems the same content is also
forwarded into the journal (\`journalctl -k\`). Buffer size is
configurable via /proc/sys/kernel/printk_ratelimit and friends.`,

  LSOF: `lsof — list open files

A diagnostic tool that lists every open file across every process.
"Files" in Unix includes regular files, directories, sockets,
pipes, FIFOs, device nodes, and locks — so \`lsof\` is also the
canonical way to see "what's listening on port 80" (\`lsof -i :80\`)
or "what process has this file open" (\`lsof /var/log/secure\`).

A defender's first call when investigating an unknown process,
suspicious file handle, or "why can't I unmount this disk".`,

  SS: `ss — socket statistics (netstat replacement)

The modern utility for inspecting sockets, replacing the
deprecated \`netstat\`. Reads directly from the kernel's
netlink-based socket diagnostics interface (much faster than
parsing /proc/net/* like netstat did).

Common invocations:
  ss -tuln     listening TCP + UDP sockets, numeric
  ss -tunap    + process info for each socket
  ss -t state established   established TCP connections

Ships as part of the iproute2 package on Linux.`,

  SYMLINK: `Symbolic Link (symlink)

A filesystem object whose content is a path string pointing to
another file or directory. Reading the symlink follows the
pointer to the target; the symlink itself has no other content.

In ls -l output, symlinks render with mode prefix 'l' and the
arrow notation \`name -> target\`. Use \`readlink\` to print the
literal target string (no resolution), or \`realpath\` to print
the fully-resolved canonical path after following every symlink
in the chain.

Hard links are different: they create a second directory entry
pointing at the same inode, so they survive deletion of the
original name. Symlinks break when their target is moved.`,

  IOC: `IoC — Indicator of Compromise

A piece of evidence that an intrusion has occurred or is ongoing.
Hashes (file SHA-256), IPs, domains, URLs, email addresses,
mutex names, registry-key paths. Distributed via STIX/TAXII
feeds, ISAC / ISAO sharing groups, or vendor threat-intel
products.

Hash IoCs are brittle (one byte change breaks them); behavioral
IoCs (TTPs, IoBs) survive evasion attempts longer.`,
};
