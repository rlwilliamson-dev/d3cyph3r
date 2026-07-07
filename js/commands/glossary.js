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

  PRIVESC: `PRIVESC — Privilege Escalation

Turning limited access into more access — most commonly a normal
user account into root (Linux) or SYSTEM / Administrator (Windows).

On Linux the first three checks are almost always:
  - sudo -l                 what may this account run as root?
  - find / -perm -4000      SUID binaries owned by root
  - cron / systemd timers   root-run jobs on writable scripts

A permissive sudoers grant is the most common finding: a NOPASSWD
entry, a wildcard path, or an allowed binary that can be "escaped"
to a shell. GTFOBins (gtfobins.github.io) catalogs which allowed
binaries hand you a root shell. The defensive mirror is least
privilege (NIST AC-6): grant the narrowest command on the narrowest
path, never NOPASSWD on anything that touches secrets, and revoke
grants when the person they were written for leaves.

MITRE ATT&CK: T1548.003 (Abuse Elevation Control Mechanism: Sudo
and Sudo Caching). CWE-250 / CWE-269 / CWE-732.`,

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

  JQ: `jq — JSON command-line processor

A streaming JSON manipulation tool. Filters, projects, and
transforms JSON documents with a query language. Like sed/awk
for JSON. Critical for cloud-API exploration where every
response is JSON: AWS CLI \`--output json\`, kubectl output,
CloudTrail logs, S3 inventory reports.

Common patterns:
  jq '.users[].email'              project all emails from an array
  jq '.[] | select(.role==\"admin\")' filter to admins
  jq -r '.id'                       raw output (no quotes)

Real jq has way more (variables, functions, regex, recursion).
The sandbox supports the path-extraction subset.`,

  GPG: `GnuPG (gpg) — Free OpenPGP implementation

The de facto open-source OpenPGP suite — generates / manages
asymmetric keypairs, signs / verifies, encrypts / decrypts.
Used to sign Linux distro packages, verify advisory bulletins,
encrypt files for specific recipients, sign git commits.

OpenPGP is RFC 4880 (replaced by RFC 9580 in July 2024). The
"web of trust" model — peers signing each other's keys — has
mostly been superseded in practice by centralized keyservers
+ TOFU (Trust On First Use).

The Snowden archive disclosed that NSA targets PGP users for
metadata collection; the protocol itself remains uncompromised
when used correctly with modern algorithms.`,

  SED: `sed — Stream EDitor

A line-oriented text transformation tool. Reads input line by
line, applies the program to each, prints the result. The
canonical Unix substitution tool. \`sed 's/foo/bar/g'\` is the
gold standard for "replace X with Y everywhere."

The full grammar is rich: addresses (line numbers or regex),
multiple commands, hold/pattern space manipulation, branches.
The sandbox supports the most common forms: per-line
substitution and print-by-line-number. For richer
transformation, players reach for awk.`,

  BASH: `bash — Bourne Again Shell

The GNU project's free re-implementation of the Bourne shell
(sh), shipped as the default login shell on most Linux
distros. POSIX-compatible but extended: brace expansion,
arrays, regex matching, process substitution, integer math.

The shell language sits at three layers:
  1. Tokenization (quoting, splitting)
  2. Expansion (vars, command substitution, globs, braces)
  3. Execution (pipelines, redirection, control flow)

Modern alternatives: zsh (macOS default since Catalina),
fish (interactive-focused), pwsh (cross-platform PowerShell).
But bash remains the universal lowest-common-denominator —
every CI image, every Docker container, every cloud VM has it.`,

  ANSI: `ANSI Escape Codes — Terminal Color / Formatting

The ECMA-48 / ANSI X3.64 standard for terminal control
sequences. Strings starting with \`\\033[\` (ESC \`[\`) plus
parameters and a terminator. Used for color, cursor movement,
screen clearing, and (originally) modem control.

Color codes:
  \\033[30m–37m   foreground (black/red/green/yellow/blue/...)
  \\033[40m–47m   background
  \\033[90m–97m   bright foreground
  \\033[0m        reset

Combined with semicolons: \\033[1;31m = bold red.

Modern terminals support 256-color (\\033[38;5;Nm) and
24-bit truecolor (\\033[38;2;R;G;Bm) extensions. The D3CYPH3R
terminal sandbox treats output as plain text — ANSI codes
appear as literal escape sequences (a feature, not a bug:
it makes attacker-injected color codes in log files visible
to the auditor).`,

  ARP: `ARP — Address Resolution Protocol

The Layer-2 protocol that maps IPv4 addresses to MAC addresses on
a local network. When a host needs to send a packet to an IP on
the same broadcast domain, it ARP-broadcasts "who has <ip>?" and
the owner replies with its MAC.

The ARP cache (\`arp -a\` / \`ip neigh\`) shows the recent
hostname / IP / MAC mappings the kernel learned. ARP spoofing
attacks poison this cache to intercept traffic — defenders
detect them with static ARP entries or 802.1X / DHCP snooping.
IPv6 uses Neighbor Discovery (NDP) instead.`,

  ICMP: `ICMP — Internet Control Message Protocol

The signaling layer of IP. Carries the messages \`ping\` and
\`traceroute\` use (Echo Request / Echo Reply / Time Exceeded /
Destination Unreachable / Redirect / etc.). Sits at the same
protocol level as TCP and UDP — directly on top of IP.

Many firewalls block ICMP at the perimeter (which breaks legit
diagnostics) or only allow specific message types (a reasonable
middle ground). Inside a network, ICMP is critical: PMTUD
relies on Fragmentation-Needed, and \`tracert\` relies on
Time-Exceeded.`,

  X509: `X.509 — Public Key Certificate Format

The ITU-T standard for digital certificates. Defines the
certificate structure (Subject, Issuer, Serial Number, Validity,
Public Key, Extensions) that TLS/HTTPS, S/MIME, code signing,
client authentication, and most other "what's their public key"
systems use.

Inspect a cert with \`openssl x509 -text -noout -in <file>\` —
key fields to audit: Subject Alternative Names (SAN), validity
window, key usage extensions, CRL distribution points. The
Web PKI's certificate-transparency logs (crt.sh) make every
publicly-issued cert auditable retroactively.`,

  TLS: `TLS — Transport Layer Security

The encryption protocol behind HTTPS, secure SMTP, IMAPS, secure
DNS (DoT), and many other "TLS over X" stacks. Current spec is
TLS 1.3 (RFC 8446, August 2018) — successor to TLS 1.2 (RFC 5246,
2008) and the long-obsolete SSL family.

TLS 1.3 dropped a lot of attack surface from earlier versions:
no RSA key exchange, no static DH, no compression, no SHA-1 in
the certificate chain by default. The handshake is one round-trip
faster too. Modern deployments should be TLS 1.2+ only;
PCI-DSS requires it.`,

  GZIP: `gzip — Lossless compression (RFC 1952)

The lossless data-compression format used for .gz files, HTTP
Content-Encoding: gzip, and the wire format of git's packfiles.
Based on DEFLATE (LZ77 + Huffman coding, RFC 1951).

Decompress with \`gunzip <file>\` (creates a sibling file) or
\`zcat <file>\` (prints to stdout — pipe-friendly). Tarballs are
typically gzipped: \`tar tvzf foo.tar.gz\` decompresses + lists in
one step. The newer zstd format outperforms gzip on most modern
workloads, but gzip remains the universal default.`,

  CIDR: `CIDR — Classless Inter-Domain Routing

The IP-address-with-prefix-length notation: \`10.0.0.0/8\` means
"the network whose first 8 bits are 10.0.0.0" — 16,777,216
addresses. Replaced the legacy Class-A/B/C scheme in the 1990s.

Common subnets:
  /32  single host
  /30  point-to-point link (4 addrs, 2 usable)
  /29  small subnet (8 addrs, 6 usable)
  /24  classic /24 LAN (256 addrs, 254 usable)
  /16  /16 network (65,536 addrs)

Used in routing tables, firewall rules, ACLs, AWS security
groups — anywhere you need to describe a range of addresses
compactly.`,

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

  // ─── Shell concepts (v1.9.0) ───────────────────────────────────────
  "ENV VAR": `Environment variable

A NAME=value pair the shell maintains and exposes to commands.
Bash distinguishes shell variables (set in the current shell)
from environment variables (inherited by child processes); for
this sandbox there are no children, so the distinction collapses.

Set in this engine via:
  export FOO=bar    — full bash form
  FOO=bar           — POSIX-style assignment
  env FOO=bar       — set in env-listing mode (no command form)
Read via:
  echo $FOO  /  echo "\${FOO}"
Remove via:
  unset FOO

Built-in variables (USER, HOME, PWD, HOSTNAME, PATH, SHELL,
LANG, PS1, PS2) are computed live from engine state; user-set
exports OVERRIDE them. Every level switch starts with a clean
shell — exports don't survive an ssh hop.`,

  PS1: `PS1 — primary prompt string

Bash reads PS1 every time it prints a prompt and substitutes the
following escapes before display:

  \\u   current user
  \\h   short hostname (truncated at first .)
  \\H   full hostname
  \\w   current PWD (with $HOME collapsed to ~)
  \\W   basename of \\w
  \\$   $ (or # for uid=0; we always show $)
  \\\\   literal backslash

Default in this engine: \\u@\\h:\\w\\$ — matches the pre-v1.9.0
hard-coded layout. Set your own with \`export PS1='> '\` or
\`export PS1='\\u@\\h(\\W)\\$ '\`.

Sister variable PS2 ('> ' by default) is the continuation prompt
for multi-line commands — currently unused since the engine
doesn't support multi-line input.`,

  "KILL RING": `Kill ring — readline yank buffer

Bash maintains a small stack of recently killed (deleted) text.
Three keystrokes push onto it:
  Ctrl-W   delete previous word
  Ctrl-U   delete from cursor to start of line
  Ctrl-K   kill from cursor to end of line
And one keystroke pops it:
  Ctrl-Y   yank — paste the top entry at the cursor

The engine matches bash's default ring size (10 entries). Older
entries are reachable in real bash via Alt-y (yank-pop); the
engine doesn't implement that — keeps the model simple.`,

  "JOB CONTROL": `Job control — & / jobs / fg / bg / kill

In bash, trailing & on a command line runs it in the background;
the shell prints a job ID and PID and returns immediately. The
\`jobs\` builtin lists known jobs; \`fg %N\` brings job N back
to the foreground; \`bg %N\` resumes it suspended; \`kill %N\`
signals it.

This engine runs commands synchronously — no actual concurrency
— but reproduces the UX: & captures the command's output into a
job-table entry, jobs/fg/bg/kill operate on that table, and
\`fg %N\` replays the captured output. Useful for muscle-memory
practice and for letting realistic scripts run without erroring.

Real bash signal semantics (SIGSTOP, SIGCONT, SIGINT) aren't
modeled — every signal you send to a job just removes the entry.`,

  PIVOT: `Pivot — lateral movement to another host

In red-team / attacker terminology, a pivot is the moment you
move from one compromised box to another inside the same
engagement. ssh'ing from a jumphost into an internal database,
SOCKS-proxying through a beachhead, RDP'ing from a developer
workstation to a domain controller — all pivots.

In this engine, a level can define \`level.network\`: a map of
in-engagement hosts the player can ssh into. ssh-ing a network
host pushes the current shell onto a pivot stack; \`exit\` pops
back. The stack lets a level model multi-hop scenarios (level
landing host → internal database → log aggregator) without
breaking the credential-chain mental model players use to track
their progress.`,

  SQLITE: `SQLite — embedded SQL database engine

SQLite is the most-deployed database in the world. It ships
inside every iOS / Android app, every macOS / Windows / Linux
install, every browser (Chrome's History, Firefox's
places.sqlite, Safari's Browser History.db), and almost every
desktop application that stores structured local data. Unlike
PostgreSQL or MySQL — which run as separate server processes —
SQLite is a library that reads and writes a single file. No
service, no port, no auth.

For forensics, that means: whenever an investigation involves
"what did this user do on this machine," there is almost
always a SQLite database holding the answer. Browser history,
downloads, autofill, saved passwords (decryption keys aside),
chat-app message histories, mail-client offline caches,
photo-app metadata, dev-tool databases (npm, yarn, Docker),
voice-assistant transcripts — all SQLite.

This engine's \`sqlite3\` command implements a teaching subset:
SELECT (with WHERE, ORDER BY, LIMIT, COUNT(*), DISTINCT, LIKE),
.tables / .schema dot-commands, pipe-separated and aligned-table
output modes. JOINs, aggregates beyond COUNT, and subqueries
are not supported — real forensic tooling (SQLite Browser,
SQLECmd, Autopsy plugins) handles the full grammar. The goal
here is teaching query formation, not SQL breadth.`,

  "PLACES.SQLITE": `places.sqlite — Firefox browser history database

The single SQLite file Firefox uses to store every URL visited,
every bookmark, every favicon, and every visit timestamp.
Lives under the user's profile directory:
  macOS:   ~/Library/Application Support/Firefox/Profiles/<id>/places.sqlite
  Windows: %APPDATA%\\Mozilla\\Firefox\\Profiles\\<id>\\places.sqlite
  Linux:   ~/.mozilla/firefox/<id>/places.sqlite

Key tables for forensics:
  moz_places       URL + title + visit_count + last_visit_date
  moz_historyvisits  per-visit timestamp + visit_type + referrer
  moz_bookmarks    user bookmark tree
  moz_anno_attributes / moz_annos    annotations (favicons, etc.)

Chromium-family browsers (Chrome, Edge, Brave, Opera) use a
similar schema in a file called \`History\` (no extension),
with tables named \`urls\`, \`visits\`, \`downloads\`,
\`keyword_search_terms\`. The schema differs in details but
the forensic principle is identical: every navigation event
is timestamped and retained until the user explicitly clears
history (and often after, in WAL journal pages — see
SQLITE-WAL-FORENSICS for that rabbit hole).

The default investigator query is "what URLs were visited in
the time window matching the incident?" Add WHERE filters on
visit_time for the window and ORDER BY visit_time for a
chronological narrative.`,

  "BROWSER-FORENSICS": `Browser forensics — analysis of browser artifacts

The investigative discipline of recovering user activity from
browser-resident state. Three artifact families dominate:

1. HISTORY databases — URLs, downloads, autofill values, search
   terms, form data. All SQLite. Survives normal "Clear browsing
   data" partially (WAL pages, vacuum deferrals). See
   PLACES.SQLITE for the Firefox shape; Chromium's \`History\`
   file has a similar role.

2. COOKIES — session tokens, tracking IDs, login state. Also
   SQLite (Firefox's cookies.sqlite, Chromium's Cookies). A
   live cookie row with a non-expired session value lets an
   investigator impersonate the user on that site (subject to
   legal authorization).

3. CACHE — recently-fetched page resources. File-system
   structured, not SQLite. Useful for recovering content the
   user viewed even if the site has since changed or been
   taken down.

Why forensics cares: a browser is the most accurate
behavioral surveillance device a user installs voluntarily.
Every search query, every URL visited, every form field
auto-filled, every time the user lingered on a tab vs. closed
it immediately — all logged with timestamps. Combined with
mobile-device location data, this often is the timeline of
what someone did on a given day.

NIST SP 800-86 (Guide to Integrating Forensic Techniques into
Incident Response) treats browser artifacts as one of the
canonical data sources for endpoint forensics.`,
};
