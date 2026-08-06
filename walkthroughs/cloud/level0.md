# level0@cloud — Coverline's Twelfth Bucket

**Track:** Cloud · **Client:** Coverline Insurance · **Compliance regime:** SOC 2 Type II + NAIC Insurance Data Security Model Law + NYDFS 23 NYCRR 500 + GLBA Safeguards Rule

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@cloud`. If you haven't solved `level0@cloud` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Coverline Insurance is one of Driftwood's insurtech clients — a mid-sized property and casualty carrier specializing in small-business policies (general liability, commercial auto, workers' compensation, business-owners' policies). They run roughly 150 engineers, were founded in 2019, and are headquartered in Hartford, Connecticut with a satellite office in Austin. They sell direct *and* white-label their product to roughly 40 regional insurance carriers — which is the part of their business model that drives the regulatory posture you're about to encounter. **Every carrier customer contractually requires Coverline's most recent SOC 2 Type II report before they'll resell.** No SOC 2 = no carrier-customer renewals = no business.

State-insurance regs add layers on top of SOC 2. The **NAIC Insurance Data Security Model Law** has been adopted in roughly 25 of the states Coverline operates in — codifying risk assessment, written information security program, third-party service-provider oversight, and incident notification within 72 hours to the state insurance commissioner.[^naic-insurance-data-security-model] **NYDFS 23 NYCRR 500** applies because Coverline is licensed in New York, layering on annual penetration testing, biannual vulnerability assessments, MFA for privileged accounts, encryption requirements, and its own 72-hour breach-notification clock.[^nycrr-500] **GLBA Safeguards Rule** applies because insurance is a Title V financial activity; the FTC's 2023-effective amendments added MFA, encryption, written incident response plans, and qualified-individual designation requirements. **State-by-state breach-notification laws** make 50 jurisdictions a concern for any incident touching customer NPI.

Coverline came to Driftwood about eighteen months ago for SOC 2 readiness work — they were preparing for their first formal Type II audit and wanted a security partner who could help through readiness, gap remediation, and the audit fieldwork. They passed the first Type II cleanly. The ongoing engagement has shifted to general security partnership: third-party risk assessments, the annual penetration test, an incident-response retainer, and — when Coverline's internal team can't take on a piece without slipping their primary roadmap — audit-cycle gap-filling.

You're on Driftwood's cloud-audit workstation, logged in as `cloudsec` — the shared service account the cloud-security team uses for external-perspective recon against client AWS / Azure / GCP environments. The host has the AWS CLI installed and the `cloudsec` IAM role attached (a Driftwood-account read-only role used for client-engagement work). The Driftwood AWS account number (`778899012345`) is *not* a Coverline account — you'll be probing Coverline's environment from the outside, exactly the way an unauthenticated attacker would.

Today's case opened on Thursday. Jordan Nguyen — Coverline's Senior Director of Cloud Infrastructure & Platform — emailed Priya. The trigger: Coverline is mid-fieldwork on this year's SOC 2 Type II audit. The auditing firm is in its second week on-site. On Wednesday evening, the audit partner delivered a preliminary finding — flagged as a "potential control gap, not yet a deficiency" — concerning the public-access posture of Coverline's production S3 buckets.

The control in question is **SOC 2 CC6.1** (Logical and Physical Access Controls — restrict logical access to information assets). The auditor's concern: Coverline has a written policy that *"production S3 buckets shall not allow anonymous public access unless explicitly designated as a public-access asset,"* but there's no documented evidence trail of the policy being verified in practice. No periodic review, no automated check, no quarterly attestation. The policy exists; the audit artifact does not.

The auditors offered a path: produce, within the fieldwork window, a documented walk of every production S3 bucket showing its current public-access posture against the expected posture. They produced a six-bucket worksheet — representative samples of the production-bucket inventory, the ones holding claims data, customer exports, deployment artifacts. Coverline's DevOps team is fully committed on a us-east-1 → us-east-2 region cutover with a hard deadline next week. Jordan asked Driftwood to pick up the worksheet so the DevOps cutover doesn't slip and the SOC 2 audit doesn't go into deficient status.

The engagement scope is signed by Jordan and the audit firm: walk the six buckets named in `audit-worksheet.txt` with the unauthenticated probe `aws s3 ls --no-sign-request`, record the response, inspect any bucket that returns a listing rather than `AccessDenied`, document the result. Out of scope: the other ~80 production buckets, the Azure tenant, the GCP project, any IAM enumeration. The probe is the auditor's preferred external-perspective method; it is *not* "active testing" in the SOC 2 / penetration-testing sense.

What you don't know yet, walking in, is that one of the six buckets — `coverline-claims-uploads-prod` — is publicly listable and publicly readable, contains three 2024-Q1 claim files with PII (claimant names, masked SSNs, addresses), a stale 2023 region-cutover migration script with a **hardcoded RDS master password**, and the actual PostgreSQL dump that script uploaded. It is two findings stacked on one bucket: an NPI exposure and a credential-leak primitive.

## §2 — The solve

Six commands. Six rows on the worksheet. The cloud-audit discipline is in noticing the one that doesn't match and stopping there.

### Step 1: Read the brief

```bash
cloudsec@cloud:~$ cat engagement-notes.md
cloudsec@cloud:~$ cat audit-worksheet.txt
```

The engagement notes establish the regulatory frame (SOC 2 + NAIC + NYDFS + GLBA), the client context (Coverline, Jordan, Sloane Becker the CISO referenced in the chain), and the auditor's preferred procedure (`aws s3 ls --no-sign-request` from outside the Coverline account). The audit worksheet is the deliverable: six buckets, the expected public-access state for each, and a `___` column for the verification result.

The expected state per the worksheet:

| Bucket | Expected |
|---|---|
| `coverline-static-assets` | Private (Denied) |
| `coverline-backups-prod` | Private (Denied) |
| `coverline-marketing-public` | **PUBLIC (CDN)** |
| `coverline-terraform-state` | Private (Denied) |
| `coverline-customer-exports` | Private (Denied) |
| `coverline-claims-uploads-prod` | Private (Denied) |

Read the worksheet before you start probing. The audit deliverable isn't *"what did the buckets do"* — it's *"did each bucket match its expected posture, and if not, what did you find inside."* The structure matters because the audit firm uses your output as evidence.

### Step 2: Confirm you're probing from outside Coverline's account

```bash
cloudsec@cloud:~$ aws sts get-caller-identity
UserId:   AIDAEXAMPLE_DRIFTWOOD_CLOUDSEC
Account:  778899012345
Arn:      arn:aws:iam::778899012345:user/driftwood-cloudsec-readonly
```

`778899012345` is the Driftwood AWS account, not a Coverline account. This is the auditor's "external perspective" exactly — Driftwood is a third party probing Coverline's public-facing surface. The output of every subsequent `aws s3 ls --no-sign-request` would behave identically if run from any internet-connected workstation with any AWS credentials (or no AWS credentials at all — the `--no-sign-request` flag bypasses authentication entirely).

This step isn't strictly required for the walk, but the audit firm will appreciate it being in the chain-of-custody record: *"the probes were issued from AWS account 778899012345 (Driftwood, not Coverline), with the `--no-sign-request` flag, on `<date>`."*

### Step 3: Walk the private buckets

```bash
cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-static-assets
An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied

cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-backups-prod
An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied

cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-terraform-state
An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied

cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-customer-exports
An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied
```

Four buckets, four `AccessDenied`. This is exactly what the worksheet expected. The plain-English read is: *"these buckets exist (the response would be `NoSuchBucket` otherwise), but anonymous requests can't list their contents — the Public Access Block + bucket policy + IAM are all enforcing the deny."*

**`AccessDenied` is what GOOD looks like for a private bucket probed from outside.** This is the single most important framing in the entire walkthrough: a properly-secured production bucket returns `AccessDenied`, not silence and not `NoSuchBucket`. The bucket exists; the access control works. The audit's job is to confirm that response across the inventory.

Four buckets verified, two to go.

### Step 4: Walk the intentionally-public bucket

```bash
cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-marketing-public
2024-09-12 11:42:08  1842317  brochures/coverline-overview-2024.pdf
2024-09-12 11:43:21   987142  brochures/coverline-small-business-faq.pdf
2024-06-18 08:22:14    84327  logos/coverline-logo-color.png
2024-06-18 08:22:14    71248  logos/coverline-logo-white.png
2024-09-12 11:44:55  3127894  partner-kits/coverline-affiliate-deck-2024.pdf
```

Five objects, all of them either brochures, logos, or partner-kit decks. The worksheet flagged this bucket as **intentionally public** — the marketing team distributes assets to affiliates via the bucket's URL — so the listing is expected, not a finding. The cross-reference is the audit's value: confirm the listing matches the expected contents (marketing materials, no PII, no operational data). It does. **MATCHES EXPECTATION.**

This is the "context matters" beat. A public S3 bucket isn't categorically bad — for the use case of distributing public marketing assets, it's the right architecture. The findings live in the *gap between expected state and actual state*, not in any absolute property of the bucket configuration.

### Step 5: Walk the misconfigured bucket

```bash
cloudsec@cloud:~$ aws s3 ls --no-sign-request s3://coverline-claims-uploads-prod
2024-03-15 09:23:41   2147   2024-Q1-claims/claim-cl-019823.json
2024-03-15 09:24:11   2089   2024-Q1-claims/claim-cl-019824.json
2024-03-15 09:25:33   1934   2024-Q1-claims/claim-cl-019825.json
2023-11-08 14:18:22    847   legacy-deploy/migrate-rds.sh
2023-11-08 14:19:01 4827392  legacy-migration-snapshot/coverline_claims.dump
```

This is the finding.

The bucket's worksheet entry said *"Private (Denied)."* The actual response is a full directory listing. Every object in the bucket is now visible to any unauthenticated requester. The auditor's gap is no longer a "potential" — it's a confirmed deficiency.

The object names alone tell the story before we even look at contents: three claim files in `2024-Q1-claims/` (almost certainly PII), a script in `legacy-deploy/migrate-rds.sh` (almost certainly a deploy artifact — and "RDS" is the AWS managed-database service, so the script almost certainly touches a database connection string), and a 4.6 MB `legacy-migration-snapshot/coverline_claims.dump` (almost certainly the output of a `pg_dump` of the production claims database).

Three categories of finding stacked on one bucket: **PII exposure, hardcoded credential leak, and a full database snapshot.** Any one of these would be a critical SOC 2 finding; all three together raise immediate questions about whether the exposure rises to the breach-notification threshold under NAIC, NYDFS, and GLBA.

### Step 6: Inspect the claim files

```bash
cloudsec@cloud:~$ aws s3 cp s3://coverline-claims-uploads-prod/2024-Q1-claims/claim-cl-019823.json -
{
  "claim_id": "CL-019823",
  "policy_number": "CV-SB-2023-87432",
  "claim_type": "general_liability",
  "claimant": {
    "first_name": "Marcus",
    "last_name": "Reyes",
    "ssn": "XXX-XX-1847",
    "date_of_birth": "1978-03-14",
    "address": {
      "street": "1247 Cedar Lane",
      "city": "Bridgeport",
      "state": "CT",
      "zip": "06604"
    },
    "phone": "(203) 555-0142",
    "email": "marcus.reyes.consulting@example.com"
  },
  "policy_holder": "Reyes Consulting LLC",
  "incident": {
    "date": "2024-02-08",
    "location_city": "Hartford",
    "location_state": "CT",
    "description": "Slip-and-fall at insured property; claimant alleges hazardous floor condition unaddressed by property staff.",
    "estimated_damages_usd": 42500
  },
  "adjuster_assigned": "kim.chen@coverline-insurance.com",
  "status": "under_review",
  "uploaded_at": "2024-03-15T09:23:41Z"
}
```

The schema is exactly the shape of a production claims-processing record. The SSN is masked to the last four digits — Coverline's claims schema implements the **PCI-DSS-adjacent "show last four" pattern** even though they're not handling card data, because it's the same data-minimization principle. But every other field is NPI under GLBA, PII under NAIC, and personal information under every state breach-notification statute that applies to the claimant's residence (Connecticut, in this case — which means CT General Statutes § 36a-701b applies). The combination of name, date of birth, residential address, phone, email, and policy number is **more than enough** to satisfy the NAIC Model Law's definition of "nonpublic information" without needing the SSN at all.

The other two claim files in the bucket follow the same shape with different claimants (Aisha Patel in New Haven CT, Dmitri Volkov in Waterbury CT). Three confirmed exposures of NPI for Connecticut residents — which means even the conservative reading of the regulatory cascade puts Coverline on the clock for state-AG notification, NYDFS notification (because Coverline is NY-licensed), NAIC notification to the Connecticut insurance commissioner, GLBA-rule consideration, and the SOC 2 audit deficiency. Five different regulatory clocks, started by one misconfigured bucket.

### Step 7: Inspect the migration script

```bash
cloudsec@cloud:~$ aws s3 cp s3://coverline-claims-uploads-prod/legacy-deploy/migrate-rds.sh -
#!/usr/bin/env bash
# RDS bootstrap migration script
# 2023-Q4 us-east-1 → us-east-2 region cutover
# Owner: vikram@coverline-insurance.com (Sr. DevOps; rolled off Q1 2024)
# DO NOT RUN POST-MIGRATION — kept here as reference for the audit trail.

set -euo pipefail

RDS_HOST="coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com"
RDS_USER="coverline_admin"
RDS_PASSWORD='Cl41ms-Pr0d-M4st3r-2024'
DB_NAME="coverline_claims"
DUMP_BUCKET="coverline-claims-uploads-prod"
DUMP_PREFIX="legacy-migration-snapshot/"

echo "[+] Dumping ${DB_NAME} from ${RDS_HOST}..."
PGPASSWORD="${RDS_PASSWORD}" pg_dump \
  -h "${RDS_HOST}" \
  -U "${RDS_USER}" \
  -d "${DB_NAME}" \
  -F custom \
  -f /tmp/coverline_claims.dump

echo "[+] Uploading dump to s3://${DUMP_BUCKET}/${DUMP_PREFIX}..."
aws s3 cp /tmp/coverline_claims.dump "s3://${DUMP_BUCKET}/${DUMP_PREFIX}coverline_claims.dump"

echo "[+] Done."
```

The credential leak is on the eighth line: `RDS_PASSWORD='Cl41ms-Pr0d-M4st3r-2024'`. That's a live RDS master password for the `coverline_claims` production database, written into a shell script committed to a publicly-readable S3 bucket. The script was written for the 2023-Q4 us-east-1 → us-east-2 region cutover. The owner (Vikram, a senior DevOps engineer) rolled off in Q1 2024. The script was never deleted. The password was almost certainly never rotated either — *"DO NOT RUN POST-MIGRATION — kept here as reference for the audit trail"* is the kind of comment people write when they intend to come back and clean up the file and never do.

The blast radius compounds: the script reveals the RDS endpoint (`coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com`), the admin user (`coverline_admin`), the database name (`coverline_claims`), and the password. Anyone with the script can authenticate against the production claims database directly from the public internet — provided the RDS instance is reachable, which depends on its security-group configuration (out of today's scope, but a question the formal investigation will need to answer).

### Step 8: Stop

Driftwood's MSA scope is **walk the buckets, document the responses, surface deviations**. We did not authenticate against the RDS instance with the recovered credential — that would be unauthorized access regardless of the bucket exposure. We did not enumerate the other ~80 production buckets in Coverline's account — that's out of scope. We did not touch the Azure or GCP environments. The finding stands on the bucket walk alone.

The other artifact in the bucket — `legacy-migration-snapshot/coverline_claims.dump`, a 4.6 MB PostgreSQL custom-format dump — is a third category of finding. The dump is the entire claims-database state as of the 2023-Q4 cutover. Anyone with the bucket listing can download the dump and reconstruct the database offline. We confirm its existence and the file metadata; we don't download the dump (Driftwood policy: any artifact >1 MB containing client data requires explicit chain-of-custody handling before retrieval, and that gate exceeds today's engagement scope).

The worksheet is now five rows of "MATCHES EXPECTATION" and one row of "DEVIATION — see finding memo." The finding memo goes to Priya, who'll write the version that goes to Jordan, the audit firm, and Sloane (Coverline's CISO).

### Step 9: The breadcrumb (game-world only)

In a real engagement the work stops at the finding. In D3CYPH3R the breadcrumb pattern continues:

```bash
cloudsec@cloud:~$ ssh level1@cloud
level1@cloud's password: Cl41ms-Pr0d-M4st3r-2024
```

You're now inside the Coverline production database context (game-world; the real Driftwood engagement would not authenticate against RDS without separate authorization). The lesson of `level1@cloud` is what an attacker gains from a credential leak of this shape — that walkthrough comes later.

### If you got stuck

- If `aws s3 ls --no-sign-request s3://coverline-claims-uploads-prod` returned `AccessDenied`, you may be running an older D3CYPH3R build — the engine extension that models the `AccessDenied` response for properly-locked-down buckets was shipped in v0.6.0. Refresh and retry.
- If you tried `aws s3 ls s3://coverline-claims-uploads-prod` without `--no-sign-request`, the in-game CLI may or may not respond depending on the simulated identity — but the real point is that `--no-sign-request` is the auditor's preferred procedure because it mirrors what an external attacker sees. Always include the flag.
- If you went straight from the bucket listing to `ssh level1@cloud` without inspecting the claim files and the migration script, the lesson of this level is the *evidence chain* — the finding memo Marisol/Priya writes for the audit firm requires the inspection step to characterize the exposure (PII categories, credential type, blast radius). Skipping it produces a finding that names the bucket but can't quantify the breach-notification posture.

## §3 — The vulnerability

Three distinct vulnerabilities stacked on one misconfigured bucket. Remediation needs to address all three or the next cutover will introduce the next bucket-class exposure.

**Failure 1 — Public Access Block not enabled at the account level.** AWS introduced **S3 Block Public Access (BPA)** at the account level in November 2018. Enabling BPA at the account level — via the IAM console, the CLI, or (in production environments) a Service Control Policy from AWS Organizations — overrides every per-bucket setting and makes "accidentally public" structurally impossible. Coverline's `coverline-claims-uploads-prod` bucket would not be publicly listable today if account-level BPA had been on; the bucket's individual configuration would have been irrelevant. The fact that the bucket is public means BPA is not enabled at the account level. That's the root-cause configuration gap.

**Failure 2 — Working files placed in the same bucket as production claim uploads.** Even if BPA had been on, the bucket's content composition is a separate failure. The bucket exists to receive uploads from the production claims-processing app (claimants upload incident photos, statements, supporting documents through a portal). It should contain *only* those upload artifacts. The `legacy-deploy/migrate-rds.sh` script and the `legacy-migration-snapshot/coverline_claims.dump` are *operational* artifacts — they don't belong in the claims-uploads bucket. They were put there because it was convenient during the 2023 cutover, and they were never moved. This is the cloud-equivalent of the v0.7.3 Meridian/BluePier `/backup/` directory pattern — operational artifacts left in a data-bearing storage location.

**Failure 3 — Hardcoded credential in source-controlled artifact.** The migration script contains a live RDS master password. The script may not be in any git repo (it was authored for a one-time cutover), but the file system it lives on — S3 — is functionally equivalent to a source-controlled artifact store for forensic purposes. Anyone who could have read the file has the credential. The remediation is the same as level0@crypto's: move the credential to AWS Secrets Manager (or Parameter Store with KMS encryption, or HashiCorp Vault), fetch at runtime, and never store at rest in flat files. Rotate the existing credential immediately.

Each failure is independently a finding. Fixing only the bucket configuration (turn on BPA, lock the bucket) without addressing the credential leaves `Cl41ms-Pr0d-M4st3r-2024` as a still-compromised credential that anyone who downloaded the script before remediation still holds. Fixing only the credential without BPA means the next bucket misconfiguration introduces a new exposure tomorrow.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | `coverline-claims-uploads-prod`, publicly listable and publicly readable, found while walking a six-bucket worksheet |
| Data class | Claim documents containing PII, at an insurance carrier |
| Also present | A hardcoded RDS password inside a migration script left in the same bucket |
| Authentication required | None, and no attribution is available for who else listed it |
| Escalates to | The RDS master credential, which is `level1@cloud` |
| Regime | SOC 2, NAIC Model 668 and NYDFS 23 NYCRR 500 — 72 hours to the commissioner and to the superintendent respectively[^nycrr-500][^naic-insurance-data-security-model] |

**Five buckets configured correctly is not evidence of a control; it is
evidence of five correct decisions.** The worksheet walks cleanly until
one entry does not, and that asymmetry is the finding. A control that
depends on each bucket being individually right at creation time will
eventually produce this outcome, which is why the remediation is
account-level enforcement rather than fixing this bucket.

**The credential in the migration script outranks the documents.**
Publicly readable claim files are a disclosure with a countable scope. An
RDS master password is reusable access to the live system that holds
everything, including records never placed in the bucket. Assessments
that lead with the document count have ranked the smaller finding first.

**Anonymous access leaves no attribution, and the notification analysis
has to start from that.** There is no requester identity for
unauthenticated reads, so Coverline cannot enumerate who accessed what
without access logging that was not enabled. Both NAIC Model 668 and
NYDFS § 500.17 run a **72-hour** clock from the determination that a
cybersecurity event occurred, and inability to rule out unauthorised
access pushes toward that determination rather than away from it.

## §4 — Real-world parallels

Three named, well-documented S3-misconfiguration breaches. Each was a major industry event, each is documentable from primary sources, and each lands on the same lesson Coverline's finding lands on: public S3 buckets are the single most common cloud-data-exposure pattern in real consulting work, and the technical controls that prevent them have existed for years.

### Capital One — March 2019 (disclosed July 2019)

In March 2019, an attacker — Paige Thompson, a former AWS engineer operating under the handle "erratic" — exploited a misconfigured Web Application Firewall on a Capital One server-side application to perform a Server-Side Request Forgery (SSRF) attack. The SSRF allowed the attacker to query the AWS Instance Metadata Service from the WAF's perspective, retrieve the EC2 instance's temporary IAM credentials, and use those credentials to enumerate and download data from Capital One's S3 buckets. The exfiltrated data covered approximately **106 million credit-card applications** across the US and Canada, including names, addresses, dates of birth, self-reported income, credit scores, payment histories, and approximately 140,000 US Social Security numbers + 80,000 linked bank-account numbers.

Capital One disclosed the breach publicly on July 29, 2019. Thompson was arrested the same week. She was convicted in 2022 on multiple counts including wire fraud and computer fraud. (The Ninth Circuit vacated her original sentence in March 2025 as substantively unreasonable; resentencing in November 2025 imposed time-served plus five years of supervised release including three years home confinement, 250 hours of community service, with the $40.7M restitution preserved.) The regulatory cascade for Capital One was unprecedented: the Office of the Comptroller of the Currency assessed an **$80 million civil money penalty** in August 2020 — the first major federal-banking-regulator fine for a cloud-misconfiguration incident. The Federal Reserve's separate 2020 enforcement action against Capital One — concerning the same cloud-migration risk-assessment deficiencies — was terminated in 2023 without additional penalty after Capital One demonstrated remediation.[^federal-reserve-terminates-capital-one] Consumer class-action litigation added approximately **$190 million** in settlement payments in late 2022.

The Capital One breach is the canonical AWS cloud-security case study in every modern curriculum. The specific technical chain — WAF SSRF → IMDS credential retrieval → S3 enumeration — drove industry-wide changes: AWS shipped **Instance Metadata Service Version 2 (IMDSv2)** with mandatory token-based authentication, multiple cloud-security configuration frameworks added explicit checks for IMDSv1 usage, and IMDS-credential-as-attack-vector training became standard in every cloud-security cert. The lesson Coverline's situation directly inherits from Capital One: **a single misconfiguration in the cloud-infrastructure layer can produce regulator action measured in tens of millions of dollars.** Coverline's exposure is smaller in scale but qualitatively identical in shape.

### Accenture — September 2017

In September 2017, security firm UpGuard discovered four publicly-accessible Amazon S3 buckets owned by Accenture, one of the largest IT-consulting firms in the world.[^upguard-accenture-s3-buckets-exposure] The buckets — labeled `acp-deployment`, `acp-software`, `acp-ssl`, and `acpcollector` — contained Accenture's internal cloud-platform infrastructure: API authentication credentials, certificates and private keys, plaintext passwords, decryption keys, customer data, and one bucket containing approximately 137 GB of data including offline backups of database snapshots. Anyone who guessed the bucket names (or used an S3-enumeration tool) could download the contents.

Accenture remediated within hours of UpGuard's responsible-disclosure notification. The exposure window — by Accenture's account — was approximately one day; by UpGuard's analysis, it had likely been multi-week. No specific customer data exfiltration was confirmed publicly. Accenture's own statement framed the incident as a "test environment" misconfiguration; UpGuard's analysis disputed that characterization given the production-grade credential material in the buckets. Either reading produces the same conclusion: the misconfiguration was structural, and the remediation required no novel technology — just enabling Block Public Access on the buckets that should have been private from the start.

The Accenture case is the canonical *consulting-firm* parallel for Coverline. Both organizations were in the business of selling security and operational discipline to clients. Both had public S3 buckets containing credential material and operational data. Both incidents were discovered by external researchers (UpGuard for Accenture; Driftwood's audit walk for Coverline) before being exploited at scale. The technical mechanism is identical: a bucket created for an operational purpose with the wrong access-control posture, containing artifacts that should never have been in any cloud-storage location publicly readable.

For Driftwood specifically, the Accenture parallel is the reputational dimension. Accenture's brand survived the incident, but the case is cited in every cloud-security training program as the example of *"how the consulting firm got it wrong."* Coverline's incident, handled badly, would put them in a similar position with their carrier customers. The SOC 2 audit finding is the immediate exposure; the longer-arc reputational exposure is what the procedural handling of the finding determines.

### US Voter Records / Deep Root Analytics — June 2017

In June 2017, UpGuard discovered an Amazon S3 bucket owned by Deep Root Analytics — a political-data firm contracted by the Republican National Committee for the 2016 US presidential campaign — containing personal information for approximately **198 million American voters.**[^upguard-deep-root-analytics-rnc] The exposed data included voters' names, dates of birth, home and mailing addresses, phone numbers, registered party affiliations, self-reported racial demographics, and modeled voter-preference data assembled from polling and consumer-data sources. The bucket was configured for public read access. No password, no authentication, no restriction by source IP.

The exposure was estimated to cover approximately 61% of the US population at the time. Multiple class-action lawsuits followed, with the lead case (Tatum v. Deep Root Analytics) settling for an undisclosed amount in 2021. The RNC's response framed the incident as a contractor failure; Deep Root's response acknowledged the misconfiguration and described an immediate remediation. The regulatory environment for political-data exposures was — and remains — patchier than for financial or healthcare data, which is part of why the case settled without a large publicized fine. But the scale itself is the lesson: **one misconfigured bucket exposed personal information on more than half the US adult population.**

For Coverline, the parallel is the structural-scale dimension. Coverline's claims bucket exposed three records visible in the file listing; the database dump in the bucket likely contains thousands or tens of thousands of additional records. Deep Root's bucket exposed 198 million records. The mechanism is the same; only the data volume in the affected bucket differs. The lesson is that bucket-misconfiguration incidents *scale freely* — once the bucket is public, the entire bucket is public, regardless of how much data is in it. The remediation has to be the configuration, not the content.

## §5 — Frameworks, deep dive

The in-game post-mortem cites ten framework controls. Each is expanded below. Cloud is the broadest framework surface of any track because every layer of the modern cloud-security regulatory stack applies simultaneously — SOC 2 for the customer-facing assurance, NIST 800-53 for the federal-control baseline, NIST CSF 2.0 for the cybersecurity-program framing, CIS for the configuration baseline, ISO 27017 for the international cloud-specific standard, OWASP for the application-security frame, CWE for the vulnerability taxonomy, plus the insurance-vertical regulations (NAIC, NYDFS) and the financial-services backstop (GLBA).[^nist-800-53][^naic-insurance-data-security-model]

### SOC 2 Trust Services Criteria — CC6.1, CC6.6, CC6.7, CC7.1

The American Institute of CPAs (AICPA) maintains the **Trust Services Criteria** (TSC), the framework underlying SOC 2 attestations. The current version is the 2017 framework with revisions published in 2022. The TSC organizes controls into five categories: Security (the "Common Criteria," abbreviated CC), Availability, Processing Integrity, Confidentiality, and Privacy. The CC controls are mandatory for any SOC 2 engagement; the other four categories are optional based on what the customer engagement requires.

Four CC controls apply directly to Coverline's finding:

**CC6.1 — Logical and Physical Access Controls.** The TSC's plain text: *"The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events to meet the entity's objectives."* This is the control the audit firm flagged. Anonymous public access to production data — when not explicitly designated as a public-access asset — is a CC6.1 failure on its face. The audit's request for documented evidence (the worksheet walk) is the standard SOC 2 evidence-collection pattern: the auditor cannot test every bucket, so they sample, and the sampling has to be representative.

**CC6.6 — Logical Access Security Measures for Outside Threats.** *"The entity implements logical access security measures to protect against threats from sources outside its system boundaries."* The bucket policy and the Public Access Block are the implementation mechanisms for this control. CC6.6 specifically focuses on *external* threats — exactly the attack vector the `--no-sign-request` probe simulates. A bucket that is reachable from outside the Coverline AWS account boundary violates this control even if its contents are not yet known to have been exfiltrated.

**CC6.7 — Transmission and Movement of Information.** *"The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes."* This applies to data movement *into* and *out of* the bucket. Bucket policies should restrict the source of incoming uploads (typically to specific application IAM roles) and the destination of outgoing reads (typically to authenticated principals). The `coverline-claims-uploads-prod` bucket appears to have no such restrictions — the listing succeeds without authentication.

**CC7.1 — Detection of Security Events.** *"To meet its objectives, the entity uses detection and monitoring procedures to identify security events..."* This is the missing piece in Coverline's posture. Coverline had the *policy* (production buckets shall not allow anonymous public access); they didn't have the *detection*. AWS Config managed rules (`s3-bucket-public-read-prohibited`, `s3-bucket-public-write-prohibited`), AWS Macie, and AWS Trusted Advisor's "S3 Bucket Permissions" check are the standard detection-layer controls that close the CC7.1 gap.[^aws-config-managed-rule-s3][^aws-macie-sensitive-data-discovery]

Audit evidence for SOC 2 includes the documented policy, the technical control implementation (the bucket policies, the BPA settings, the Config rules), and — crucially — *the evidence trail proving the policy is verified in practice over the audit period.* The "no documented evidence trail" finding the audit firm delivered is what made this exercise a deliverable rather than an internal task.

### NIST SP 800-53 Rev. 5 — AC-3, AC-6, SC-7, AU-12

NIST SP 800-53, currently at **Revision 5 with Release 5.2.0 published August 27, 2025**, is the federal-government control catalog underlying many other frameworks (SOC 2 maps to it indirectly; NIST CSF maps to it directly; CMMC inherits its 800-171 subset). Four controls apply directly to Coverline's finding:

**AC-3 — Access Enforcement.** The information system must enforce approved authorizations for logical access to information and system resources. The bucket policy is the enforcement mechanism for the asset; an anonymous-public configuration enforces no authorization decision and thus fails AC-3. Notably, the AC-3 control text is broad enough that the violation isn't about whether *any* access happened — it's about whether the enforcement mechanism is in place at all.

**AC-6 — Least Privilege.** The principle that subjects should have only the privileges necessary to perform their authorized tasks. The bucket should grant *the minimum access required* (no anonymous, named principals only, scoped to specific actions). Even if anonymous access were restricted, AC-6 would still require evaluating whether the authenticated-access policy is appropriately scoped — the claims-app IAM role should have `s3:PutObject` on the bucket, not `s3:*`. (Out of scope for today's walk, but a follow-up for the formal remediation.)

**SC-7 — Boundary Protection.** Public Access Block + bucket policy together form the boundary. The control's plain reading: monitor and control communications at the external boundary of the system. A public bucket is, by definition, an external interface; the boundary control should be applied to that interface; it is not.

**AU-12 — Audit Generation.** The information system must provide audit-record generation capability for the auditable events specified in AU-2. For S3, the standard implementation is **S3 server-access logging** plus **CloudTrail data events** for the bucket (CloudTrail by default captures management-plane events like bucket creation; data-plane events like object reads require explicit configuration). Coverline's CC7.1 detection gap is partially an AU-12 gap — without the audit logs, the question "did anyone download the migration script?" has no defensible answer.

### NIST Cybersecurity Framework 2.0 — PR.AA, PR.DS, DE.CM

The **NIST Cybersecurity Framework 2.0** was published in February 2024, replacing the 2018 v1.1.[^nist-cybersecurity-framework-2-0] CSF 2.0 is the most-cited cybersecurity-program framework in the US private sector; it provides a common vocabulary for risk-management discussions between security teams, executives, and board members. CSF 2.0 added a new **Govern** function (joining the existing Identify, Protect, Detect, Respond, Recover functions) to explicitly cover organizational governance over cybersecurity.

Three CSF 2.0 sub-categories apply to Coverline:

**PR.AA — Identity Management, Authentication, and Access Control.** The Protect function's identity-and-access-control sub-category. Includes the principle that access permissions should be granted on the least-functionality basis — which is the CSF 2.0 framing of the same control surface NIST 800-53 covers under AC-3/AC-6 and that SOC 2 covers under CC6.1/CC6.6.

**PR.DS — Data Security.** Data-in-transit and data-at-rest protection, encryption, and access control. For Coverline's claims bucket, the data is at rest in S3; the control surface includes encryption (which S3 does by default with SSE-S3 or optionally with SSE-KMS for customer-managed keys) and access control (which is the broken half of the equation for the misconfigured bucket).

**DE.CM — Continuous Monitoring.** The Detect function's continuous-monitoring sub-category. This is the layer Coverline was missing — the automated, continuous evaluation of bucket configurations against policy. AWS Config, AWS Macie, and AWS Security Hub collectively implement DE.CM for AWS cloud assets at the production-scale Coverline operates.

### CIS AWS Foundations Benchmark v7.0.0 — §3.1.1 through §3.1.4 (S3)

The Center for Internet Security publishes the **CIS AWS Foundations Benchmark**, a prescriptive configuration baseline for AWS accounts — specific, opinionated recommendations that map to the broader CIS Controls.[^cis-aws-foundations-benchmark-current] The current release is **v7.0.0** (April 2026), which reorganized the sections: **Section 3 now covers Storage**, with subsection **3.1 covering S3 specifically** (in v5.0.0 and earlier, S3 lived in §2.1.x). One operational caveat worth knowing: **AWS Security Hub's managed CIS standard still tops out at v5.0.0**, so the findings you see in the Security Hub console will report the older §2.1.x numbering for these same controls.

Four sub-controls in §3.1 apply to Coverline's situation:

- **§3.1.1 — Ensure S3 Bucket Policy is set to deny HTTP requests.** Buckets should require TLS for all requests. Tangential to today's finding but a hygiene item.
- **§3.1.2 — Ensure MFA Delete is enabled on S3 buckets.** Prevents accidental or malicious bucket-object deletion by requiring MFA.
- **§3.1.3 — Ensure all data in S3 is discovered, classified, and secured.** The v7.0.0 control (Macie-driven data classification) that replaced the older standalone "enable encryption-at-rest with KMS" recommendation, after AWS made SSE-S3 the default for all new objects.
- **§3.1.4 — Ensure S3 is configured with 'Block Public Access' enabled.** **The headline control that would have prevented Coverline's finding entirely.** v7.0.0 merged the former account-level and bucket-level BPA controls into this single one; a setting at the AWS account root overrides every per-bucket setting, and turning it on org-wide via SCP makes "accidentally public" structurally impossible.

Audit evidence for the CIS AWS Foundations Benchmark is typically generated automatically by AWS Security Hub (which has a managed standard for the Benchmark) or by third-party CSPM tools (Prisma Cloud, Wiz, Lacework, Orca Security). The standard pattern is: deploy AWS Security Hub with the CIS Benchmark standard enabled, set finding-noncompliance alerts to page the security team, and review findings during the monthly compliance-review cadence.

### ISO/IEC 27017:2015 — Code of Practice for Cloud Services

**ISO/IEC 27017:2015** is the international standard for information-security controls specifically for cloud services.[^iso-27017] It extends ISO/IEC 27002 (the general information-security controls standard) with cloud-specific guidance. ISO 27017 is often cited in international customer contracts as the cloud-vertical analog of the ISO 27001 information-security-management standard.

Three controls apply to Coverline's case:

- **CLD.6.3.1 — Shared roles and responsibilities within a cloud environment.** The cloud customer (Coverline) and cloud provider (AWS) share responsibility for security; the customer's bucket configuration is on the customer side of the shared-responsibility model. AWS provides the BPA tooling; Coverline must enable it.
- **CLD.8.1.5 — Removal of cloud service customer assets.** Procedures for the secure removal or destruction of customer assets when no longer needed. The legacy migration script and SQL dump in the bucket — operational artifacts that should have been removed after the 2023 cutover — are exactly this control's territory.
- **CLD.9.5.1 — Segregation in virtual computing environments.** Tangentially relevant; covers VPC-level segregation, which is the network-layer analog of the storage-layer access control we're examining today.

### OWASP Cloud-Native Top 10 — CNAS-1, CNAS-2, CNAS-5

The **OWASP Cloud-Native Application Security Top 10** is a separate document from the better-known OWASP Top 10 (which we covered in level0@crypto and level0@web).[^owasp-cloud-native-application-security] The Cloud-Native Top 10 was first published in 2022 and addresses the security weaknesses specific to cloud-native application architectures. The project site repo was archived in April 2025 and the main project repo was archived on November 24, 2025; the 2022 edition remains the canonical reference, with no updated edition published as of audit date.

Three categories apply to Coverline:

**CNAS-1 — Insecure Cloud, Container, or Orchestration Configuration.** Misconfigured cloud resources — S3 buckets, IAM policies, security groups, container runtime configurations. **Coverline's bucket finding is the canonical example.**

**CNAS-2 — Injection Flaws (cloud-native versions).** Adjacent to Coverline's finding — the hardcoded RDS password in the migration script would enable injection-style lateral movement if the database were reachable. The traditional OWASP Top 10's injection category (now A03 in the 2025 edition) covers the application-layer surface; CNAS-2 covers the cloud-infrastructure variant.

**CNAS-5 — Insecure Secrets Storage.** The hardcoded RDS master password in `migrate-rds.sh` is the textbook OWASP CNAS-5 example — credentials stored in a non-secret-management location (here, an S3-hosted shell script readable from outside the account boundary). The remediation is the same as level0@crypto's: move the credential to AWS Secrets Manager or equivalent, fetch at runtime, never store at rest in flat files.

### CWE-200, CWE-732, CWE-285, CWE-798, CWE-540

The Common Weakness Enumeration catalog has five entries that map to Coverline's finding:

**CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor.**[^cwe-200] The headline. The claims-bucket exposure of NPI is the textbook CWE-200 instance. Note: CWE-200 is flagged as "Discouraged" by MITRE for direct vulnerability mapping in 2026 — it's the conceptual umbrella, but for a CVE-mapped finding the more-specific child (here, CWE-732) is the preferred citation.[^cwe-732] The in-game post-mortem cites CWE-200 for conceptual coverage, which is appropriate for player-facing pedagogy.

**CWE-732 — Incorrect Permission Assignment for Critical Resource.** The bucket-policy / Public Access Block misconfiguration. This is the more-specific CVE-mappable citation for the Coverline finding. The Public Access Block setting being off is exactly the "incorrect permission assignment" CWE-732 captures.

**CWE-285 — Improper Authorization.**[^cwe-285] The public bucket authorizes the wrong principals (every principal). The control should restrict to a defined set of authorized requesters; it doesn't.

**CWE-798 — Use of Hard-coded Credentials.**[^cwe-798] The RDS master password embedded in `migrate-rds.sh`. Same weakness pattern as level0@crypto's API key, applied to a database credential.

**CWE-540 — Inclusion of Sensitive Information in Source Code.**[^cwe-540] The script is the source-controlled artifact. CWE-540 is a more recent CWE (added to the catalog in the 2019-era expansion) that specifically addresses sensitive data committed to source-controlled artifacts; it's the right citation for the operational-script-with-credential pattern.

### NAIC Insurance Data Security Model Law (2017)

The **National Association of Insurance Commissioners' Insurance Data Security Model Law** (NAIC Model Law #668) was adopted in 2017 and has been enacted into law in approximately 28 US jurisdictions as of early 2026, with adoption continuing. The Model Law codifies minimum cybersecurity requirements for insurance licensees, including risk assessment, written information security program, designation of qualified individuals, third-party service-provider oversight, and incident notification.

Three sections apply to Coverline's case:

- **§ 4 — Information Security Program.** Requires a written program with documented controls, annual risk assessment, and a designated CISO-equivalent. Coverline's SOC 2 + HITRUST + the documented program Sloane Becker oversees collectively satisfy this section.
- **§ 5 — Investigation of a Cybersecurity Event.** Defines the obligation to investigate suspected incidents — including the determination of whether NPI was acquired by an unauthorized person. The Coverline finding triggers exactly this section's procedure.
- **§ 6 — Notification of a Cybersecurity Event.** **72-hour notification clock to the state insurance commissioner** when the licensee has determined that NPI has been (or is reasonably likely to have been) acquired. The determination clock is Coverline's, not Driftwood's — we surface the finding; Coverline's CISO + GC + outside counsel determine whether the exposure crossed the "reasonably likely acquired" threshold.

### NYDFS 23 NYCRR 500 (2017, amended 2023)

**NYDFS 23 NYCRR 500** — the New York Department of Financial Services Cybersecurity Requirements for Financial Services Companies — applies to any financial-services company licensed by NYDFS.[^nycrr-500] Coverline is NY-licensed and therefore subject. The regulation was originally promulgated in 2017 and substantially amended effective November 2023.

Six sections apply to Coverline:

- **500.03 — Cybersecurity Policy.** Written cybersecurity policy approved by the senior governing body.
- **500.05 — Penetration Testing and Vulnerability Assessments.** Annual penetration testing and biannual vulnerability assessments.
- **500.09 — Risk Assessment.** Annual risk assessment.
- **500.13 — Limitations on Data Retention.** Disposal of NPI no longer necessary for business operations. The 2023 claim files in the bucket — which are now in an active claims-handling state, so they are necessary — are not yet caught by 500.13; the 2023 migration-snapshot dump, however, is exactly the kind of stale operational artifact 500.13 targets.
- **500.15 — Encryption of Nonpublic Information.** NPI at rest and in transit must be encrypted. S3's default encryption satisfies the at-rest portion; the bucket-policy enforcement of TLS satisfies the in-transit portion.
- **500.17 — Notices to Superintendent.** **72-hour notification clock to the NYDFS Superintendent** when the licensee has a "reasonable belief that any nonpublic information was accessed or acquired by an unauthorized person." Parallel to the NAIC Model Law's § 6 trigger; same determination process.

### GLBA Safeguards Rule — 16 CFR Part 314 (FTC amendments effective 2023)

The **Gramm-Leach-Bliley Act** governs financial institutions' protection of customer information. The FTC implements GLBA's information-security requirements via the **Safeguards Rule** (16 CFR Part 314), which was substantially amended in December 2021 with enforcement effective June 2023.[^cfr-16-314] The 2023 amendments raised the bar significantly: required MFA for any individual accessing customer information, encryption of customer information at rest and in transit, written incident response plans, designation of a "Qualified Individual" responsible for the information-security program, and breach notification to the FTC for events affecting 500+ consumers.

Coverline is subject to GLBA because insurance is a Title V financial activity. The Safeguards Rule applies to Coverline directly and to Coverline's service providers (Driftwood being one).

**16 CFR 314.4** lists the required elements of the information-security program:

- (a) Designation of a Qualified Individual
- (b) Risk assessment
- (c) Specific access-control safeguards: identity management, MFA, encryption of consumer information at rest and in transit, secure development practices, audit logging
- (d) Periodic testing of safeguards
- (e) Employee training
- (f) Service-provider oversight
- (g) Written incident response plan
- (h) Annual report to the board

The Coverline finding implicates (c) specifically — the bucket exposed NPI without the access controls 314.4(c) requires. The remediation cascade includes (g) — the IR plan triggers — and (h) — the next annual board report will reference the incident.

### MITRE ATT&CK — what a public bucket enables next

The in-game post-mortem names four techniques that describe where this
goes rather than what happened, and that forward view is what a risk
assessment needs. None of them occurred here; all of them are reachable
from what was found.

**[T1530 — Data from Cloud Storage](https://attack.mitre.org/techniques/T1530/)** is
the immediate one: the objects in the bucket are readable, with no
authentication and no request identity recorded.

**[T1538 — Cloud Service Dashboard](https://attack.mitre.org/techniques/T1538/)**
becomes available the moment the RDS credential is used, because
credentials that work in one place are tried everywhere. A console
session gives an adversary the same inventory view Coverline has, which
is a substantially better position than enumerating from outside.

**[T1485 — Data Destruction](https://attack.mitre.org/techniques/T1485/)** and
**[T1486 — Data Encrypted for Impact](https://attack.mitre.org/techniques/T1486/)**
are the pair that turns a confidentiality finding into an availability
one. A bucket policy permissive enough to allow reads is worth checking
for writes, because the same misconfiguration frequently grants both,
and an insurer that cannot produce claim documents has an operational
crisis in addition to a disclosure.

**[T1567.002 — Exfiltration to Cloud Storage](https://attack.mitre.org/techniques/T1567/002/)**
closes the loop: cloud storage is also where data *leaves*, over TLS, to
a service indistinguishable from legitimate traffic.

The reason to enumerate these in a report is that "a bucket is public"
invites the response "so we made it private." The technique chain is the
argument for why the follow-up work — key rotation, write-permission
audit, egress monitoring — is not optional.

## §6 — Cert exam relevance

Equal-depth coverage for the twelve cert families cited in the in-game post-mortem. Cloud touches more certs than any other track because the cloud-security cert market has fragmented across vendor-specific (AWS, Azure, GCP), vendor-neutral (CCSP, CCSK), pentest-oriented (GCPN, OSCP), and traditional-track (Security+, CySA+, CISSP) lines.[^cert-oscp][^cert-ccsp][^cert-cissp]

### AWS Certified Security – Specialty — current exam code SCS-C03

The AWS Security Specialty cert is the AWS ecosystem's flagship security certification. AWS released **SCS-C03** on December 2, 2025 as the successor to SCS-C02 (registration opened November 18, 2025; SCS-C02 was decommissioned December 1, 2025; SCS-C02 had been in market since July 2023, itself superseding SCS-C01). The Coverline finding maps directly to two domains.

- **Domain 1 — Threat Detection and Incident Response.** Includes the AWS Config / Macie / GuardDuty / Security Hub detection layer that would have caught the bucket misconfiguration before the audit walk.
- **Domain 4 — Identity and Access Management.** Bucket policies, the Public Access Block, IAM-based access control to S3.

**Sample question framing:**

> A SOC 2 audit finding identifies an Amazon S3 bucket in your AWS account that is publicly listable and contains operational artifacts not intended for external access. Which of the following is the BEST PRIMARY remediation?
>
> A. Update the bucket's ACL to remove the public-read grant
> B. Enable S3 Block Public Access at both the account level and the bucket level, and remove the inappropriate artifacts from the bucket
> C. Add a Deny-all bucket policy targeting anonymous principals
> D. Enable AWS Macie on the bucket to detect future misconfigurations

The trap is A (legacy ACLs are the old way to control access; modern S3 is policy-based and BPA-overridden). C is half a solution (the policy denial works but BPA is the more durable control). D is detection, not remediation. **B** is the AWS Security Specialty answer — BPA at the account level *plus* bucket level provides defense-in-depth, and the artifact removal closes the immediate exposure.

### AWS Certified Solutions Architect — Associate (SAA-C03) and Professional (SAP-C02)

The AWS Solutions Architect certs are broader than the Security Specialty. The current versions are **SAA-C03** (Associate) and **SAP-C02** (Professional). Storage and security sub-domains include S3 permission models; the Professional exam expects fluency in multi-account governance (AWS Organizations + Service Control Policies). The Coverline finding would surface in the Professional-exam expectation that the candidate know how to *enforce* the bucket-public-access policy at the organization level rather than relying on per-account discipline.

### AWS Certified Cloud Practitioner — current exam code CLF-C02

The Cloud Practitioner cert is AWS's entry-level certification. The current exam is **CLF-C02** (in market since September 2023). The exam tests recognition-level understanding of the shared-responsibility model and S3 basics. The framing *"S3 is private by default but configurable to public"* is on the exam — and is the conceptual foundation for why Coverline's finding is a finding (the bucket *had to be configured* to be public; it didn't drift there by accident).

### CompTIA Security+ — current exam code SY0-701

Security+ SY0-701 (current; superseded SY0-601 November 2023, SY0-601 retired July 31, 2024).[^cert-security-plus] The cloud track maps to:

- **Domain 4 — Security Operations.** Cloud-security baseline including misconfigurations, MFA enforcement, audit logging.

### CompTIA CySA+ — exam codes CS0-003 / CS0-004

CompTIA CySA+ — CS0-003 is the legacy exam revision (in market since June 2023), and **CS0-004 launched on 23 June 2026**; CS0-003 retires 22 December 2026, so by the time anyone reads this much past the review date, CS0-004 will be the only sittable version.[^cert-cysa] The cloud track maps to:

- **Domain 1 — Security Operations.** Cloud-misconfiguration detection and response.

### (ISC)² CCSP — Certified Cloud Security Professional

The CCSP is (ISC)²'s flagship cloud-security cert, designed for security professionals working with cloud architectures. The CCSP has six domains; three apply directly to the Coverline finding.

- **Domain 2 — Cloud Data Security.** Storage architectures, data-at-rest protections, access controls.
- **Domain 3 — Cloud Platform & Infrastructure Security.** Infrastructure-layer security including the storage-layer access controls Coverline's finding implicates.
- **Domain 6 — Legal, Risk, and Compliance.** The regulatory cascade (SOC 2, GLBA, NYDFS, NAIC).[^naic-insurance-data-security-model][^cfr-16-314][^nycrr-500]

### CSA CCSK — Certificate of Cloud Security Knowledge

The Cloud Security Alliance's **CCSK** is the vendor-neutral cloud-security certification. The CSA also publishes the **Cloud Controls Matrix (CCM)** and the **Consensus Assessments Initiative Questionnaire (CAIQ)** — both have multiple controls explicitly addressing "anonymous public access to cloud storage." The CCSK exam tests recognition of these controls as part of the broader vendor-neutral cloud-security curriculum.

### SANS GCSA / SEC388 / SEC488 / SEC510

The SANS cloud-security curriculum spans multiple courses and certifications:

- **GCSA — GIAC Cloud Security Automation.** Focus on automating cloud security controls (the AWS Config / Macie / Security Hub layer that would have caught Coverline's bucket).
- **SEC388 — Introduction to Cloud Computing and Security.** Entry-level cloud-security course.
- **SEC488 — Cloud Security Essentials.** Mid-level course covering the cross-cloud security baseline.
- **SEC510 — Public Cloud Security: AWS, Azure, and GCP.** Advanced multi-cloud course covering the three-major-provider control surfaces.

Bucket-misconfiguration detection and remediation is fundamental across the SANS cloud-security curriculum. Coverline's finding is the entry-level case study every one of these courses covers.

### GIAC GCPN — Cloud Penetration Tester

The **GCPN** is the offensive-side cloud-security cert from GIAC. The exam tests offensive cloud techniques including `--no-sign-request` bucket enumeration, IAM enumeration via `aws iam list-*` calls, EC2 IMDS exploitation (the Capital One technique), and the cross-cloud equivalents.

For Coverline specifically, the GCPN candidate would have run the same `aws s3 ls --no-sign-request` probes that Driftwood just ran — except the GCPN context is offensive (find the misconfigured bucket and exfiltrate the data) rather than defensive (find the misconfigured bucket and report to the audit firm). The technical skill is identical; the engagement scope differs.

### CISSP

CISSP (2024 CBK refresh, next refresh expected 2027). The cloud track touches:

- **Domain 4 — Communication and Network Security.** Cloud network architecture including the boundary between cloud and external internet.
- **Domain 7 — Security Operations.** Continuous monitoring and the detection layer.

### Cross-cloud equivalents

- **Microsoft AZ-500 — Azure Security Engineer Associate.** Azure-side equivalent. Azure Blob Storage anonymous-read configuration is the direct Coverline-analog scenario; the AZ-500 exam tests it.
- **Google Professional Cloud Security Engineer.** GCP-side equivalent. GCP Cloud Storage bucket-level IAM with `allUsers` / `allAuthenticatedUsers` principals is the same misconfiguration pattern.

The fact that the same misconfiguration pattern exists across all three major clouds — with the same severity, the same remediation, and the same detection tools — is itself the broader lesson. The cloud cert ecosystem has converged on this pattern because the incident reports keep producing it.

## §7 — What a defender does

The Coverline scenario is not theoretical. Every defender working at an organization with non-trivial cloud presence — and especially at organizations handling regulated data — has to navigate this category of finding. Here's what the work looks like.

**1. For this specific finding, today.** Restrict `coverline-claims-uploads-prod` to private immediately. Turn on Block Public Access at the bucket level. Update the bucket policy to deny all principals except the claims-app role. Pull the S3 server-access logs and CloudTrail data events for the bucket; identify any non-Coverline source IP that has requested objects since the bucket was created. That access log is the data set that determines the breach-notification math. Rotate the RDS master password immediately. Audit RDS authentication logs (CloudWatch Logs for RDS audit logging, if enabled) for any non-Coverline source IP in the period the script's password has been in the wild. Delete the migration script and the SQL dump from the bucket once they've been preserved to an evidence-retention store. Coverline's CISO + GC + outside counsel determine the breach-notification posture across NAIC, NYDFS, GLBA, and the state laws of every claimant's jurisdiction.[^naic-insurance-data-security-model][^cfr-16-314][^nycrr-500]

**2. For Coverline's broader S3 posture, this quarter.** Enable **S3 Block Public Access at the ACCOUNT level** on every production AWS account. Single switch, account-wide, overrides every per-bucket setting. This makes "accidentally public" structurally impossible. Enforce account-level BPA via an **AWS Organizations Service Control Policy**; SCPs cannot be overridden by member-account admins. Enable **AWS Config managed rules** `s3-bucket-public-read-prohibited` and `s3-bucket-public-write-prohibited` org-wide via AWS Config Aggregator. Set noncompliance alerts to page security on detection. Enable **AWS Macie** on the production accounts — Macie surfaces buckets that contain sensitive data types (PII, PHI, financial, credentials) AND are publicly accessible, exactly the union of conditions that made Coverline's finding a finding. Enable **AWS Security Hub** with the CIS AWS Foundations Benchmark v5 + AWS Foundational Security Best Practices standards for continuous compliance scoring.

**3. For Coverline's credential-handling posture, this quarter.** Audit every production codebase, script, container image, and S3 bucket for hardcoded credentials. Tools: **gitleaks**, **TruffleHog**, **GitHub Advanced Security Secret Scanning**, **AWS Secrets Manager's "find unused secrets" automation**, **Snyk Code**, **Semgrep with the secret-detection ruleset**. Migrate every hardcoded credential to **AWS Secrets Manager** (or Parameter Store with KMS encryption, or HashiCorp Vault). Scripts read from the secret store at runtime; the secret never appears in source. Set up rotation on every Secrets Manager secret — RDS has built-in rotation via Secrets Manager; use it. Enable **IAM Access Analyzer** with the external-access finding type — detects identity-based and resource-based policy paths that grant access to external principals (including `Principal: "*"`).

**4. For Coverline's SOC 2 control evidence, going forward.** The audit walk Driftwood just did SHOULD be a quarterly automated review, not an annual manual one. AWS Config + Macie + a custom Lambda that posts the bucket inventory + public-access state to a Slack channel weekly converts *"evidence we walked it"* into *"evidence we monitor it."* The cost of the automation is days; the cost of NOT having the automation is what Coverline just lived through. Add the public-access-posture check to Coverline's internal control attestation cadence — every quarter, the cloud-platform team certifies in writing that the posture matches the documented inventory. For new buckets: bucket creation goes through Terraform with a module that enforces Block Public Access on creation. Manual creation through the AWS console is disabled via SCP.

**5. Sample detection rule (Sigma, AWS CloudTrail S3 event):**

```yaml
title: S3 bucket made publicly accessible
status: experimental
description: Detects CloudTrail events indicating an S3 bucket
  has been configured (or had its configuration changed) to allow
  anonymous public access. Should never fire in an environment
  where account-level Public Access Block is enabled via SCP.
logsource:
  product: aws
  service: cloudtrail
detection:
  selection_acl:
    eventSource: 's3.amazonaws.com'
    eventName: 'PutBucketAcl'
    requestParameters|contains: 'AllUsers'
  selection_policy:
    eventSource: 's3.amazonaws.com'
    eventName: 'PutBucketPolicy'
    requestParameters|contains|all:
      - '"Principal": "*"'
      - '"Effect": "Allow"'
  selection_bpa_disable:
    eventSource: 's3.amazonaws.com'
    eventName: 'DeletePublicAccessBlock'
  condition: selection_acl or selection_policy or selection_bpa_disable
level: critical
falsepositives:
  - Legitimate creation of an intentionally-public bucket (e.g.,
    a marketing-CDN bucket — tune per known-public-bucket
    allowlist)
```

The rule, fed into Coverline's SIEM, would alert on the next attempt to create a publicly-accessible bucket — turning the audit cadence into a real-time detection.

**6. The broader OPSEC lesson (defender side).** Public cloud storage is the modern equivalent of an unauthenticated FTP server on the internet, except it happens to companies that wouldn't dream of running an unauthenticated FTP server. The mental model is wrong; the reality is the same. *"Public"* is a feature for marketing assets, OSS artifacts, and documented public APIs. It is a defect for anything else, including any byproduct of an operational process — logs, dumps, exports, migrations, backups, snapshots, scratch. The default of *"private"* is correct; the exceptions should be explicit, named, reviewed, and continuously monitored.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run the right command — `progress --detail` lists what you've unlocked.

### Probing from outside the client's account

**Trigger:** `aws sts get-caller-identity`

**What it teaches:** `sts get-caller-identity` returns Driftwood's own account (`778899012345 / driftwood-cloudsec-readonly`), not Coverline's. For external-audit work, **confirming you are operating from an OUTSIDE account is its own auditable control.**

The bonus fires when you run the command; here's why a methodical auditor would run it BEFORE the bucket probes start:

- The audit worksheet's *premise* is that the auditor is hitting the buckets unauthenticated, using `--no-sign-request`. That premise is undermined if the auditor *also* has cached Coverline credentials in their environment — a stray `AWS_PROFILE` left from a previous engagement, an instance-profile credential leaking through environment-variable precedence, an SSO session that hasn't expired.
- The auditor probably *intends* to be unauthenticated. But the AWS CLI's credential-resolution chain is silent about which credential ended up signing each request unless you explicitly check (`aws sts get-caller-identity` is the canonical check).
- For SOC 2 evidence specifically, the auditor's workpaper should record: *the identity that performed the test* (named external auditor), *the timestamp of the test*, *the response observed*. If the response is `AccessDenied`, that's only audit-grade evidence if the auditor's account isn't Coverline's account. `sts get-caller-identity` is what produces the named external auditor row.

The longer-arc principle: **external auditors should be operating from an account that cannot accidentally be inside the audited environment.** Driftwood maintains `driftwood-cloudsec-readonly` for exactly this reason — a separate account, with no cross-account-trust relationships to client accounts, with read-only IAM, with no cached client credentials. Confirming identity before every external probe is how you produce audit evidence that the test was genuinely external.

This is also why **AWS CloudTrail captures `sts:GetCallerIdentity` as an immutable audit event** — the API call is the kind of operational check that becomes audit evidence retroactively. Run it; CloudTrail records it; the workpaper points to the CloudTrail timestamp; the evidence is reproducible.

For the broader project lesson: **the test setup matters as much as the test result.** A `AccessDenied` response from a private bucket probed from an outside account is audit-grade evidence. The same `AccessDenied` response from the same probe, where the probe was *accidentally* signed by an internal Coverline credential the auditor's environment had cached, is not audit-grade evidence — because the access-control under test was the *signing credential's policy*, not the *bucket's policy as exposed to unauthenticated requesters*.

The CIS AWS Foundations Benchmark addresses this from the *audited* side: separation of audit and operational identities at the account level. CIS Benchmark control 1.16 ("Ensure IAM policies are attached only to groups or roles") and the broader IAM-account-separation guidance speak to it.

## §8 — Key takeaways

- **`AccessDenied` is what GOOD looks like for a private S3 bucket probed from outside.** The bucket exists; the access control works. The audit's job is to confirm that response across the inventory.
- **The most damaging cloud security incidents almost never start with a sophisticated technique.** They start with a bucket that someone made public for ten minutes during a 2:00 AM deploy in 2022 and forgot to revert. The script that's been *"I'll clean that up later"* since 2023. The IAM role that has `AdministratorAccess` because the original developer didn't know which permissions they needed. The hardcoded password that worked once and got copy-pasted into every subsequent migration.
- **S3 Block Public Access at the account level — enforced via SCP — makes "accidentally public" structurally impossible.** The setting has been available since November 2018. Every organization should have it on. The reason it isn't always on isn't ignorance; it's that nobody assigned the rollout and it never reached the top of anyone's queue.
- **The regulatory cascade is the punchline, not the breach itself.** For Coverline, a single misconfigured bucket triggers SOC 2 (audit deficiency), NAIC (state insurance commissioner 72-hour clock), NYDFS (Superintendent 72-hour clock), GLBA (FTC notification at 500+ consumers), and state-by-state breach laws across every claimant's jurisdiction. The technical fix is a one-line `aws s3api put-public-access-block` command. The institutional fix is the continuous-monitoring program + the SCP enforcement that prevents the next instance.
- **For consulting work, the procedural quality is the deliverable.** Coverline's audit firm gets a clean documented walk with five "MATCHES EXPECTATION" rows and one "DEVIATION" row with a properly-scoped finding memo. That deliverable is what closes the SOC 2 control-gap finding. A messy or speculative walk would have made the audit-firm finding worse, not better.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^nist-800-53]: [NIST SP 800-53 Rev. 5 (current Release 5.2.0, August 2025)](https://csrc.nist.gov/pubs/sp/800/53/r5/final).
[^nist-cybersecurity-framework-2-0]: [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework).
[^cis-aws-foundations-benchmark-current]: [CIS AWS Foundations Benchmark (current release v7.0.0; AWS Security Hub's managed standard still implements v5.0.0)](https://www.cisecurity.org/benchmark/amazon_web_services).
[^iso-27017]: [ISO/IEC 27017:2015 — Code of practice for cloud services](https://www.iso.org/standard/43757.html).
[^owasp-cloud-native-application-security]: [OWASP Cloud-Native Application Security Top 10 (GitHub canonical — 2022 edition)](https://github.com/OWASP/Cloud-Native-Application-Security-Top-10).
[^cwe-200]: [CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor (MITRE flags as "Discouraged" for direct vulnerability mapping; CWE-732 is the preferred citation for this scenario)](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-732]: [CWE-732 — Incorrect Permission Assignment for Critical Resource](https://cwe.mitre.org/data/definitions/732.html).
[^cwe-285]: [CWE-285 — Improper Authorization](https://cwe.mitre.org/data/definitions/285.html).
[^cwe-798]: [CWE-798 — Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
[^cwe-540]: [CWE-540 — Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html).
[^naic-insurance-data-security-model]: [NAIC Insurance Data Security Model Law (#668)](https://content.naic.org/sites/default/files/model-law-668.pdf).
[^nycrr-500]: [NYDFS 23 NYCRR 500 — Cybersecurity Requirements (2017, amended November 2023)](https://www.dfs.ny.gov/industry_guidance/cybersecurity).
[^cfr-16-314]: [GLBA Safeguards Rule — 16 CFR Part 314](https://www.ftc.gov/legal-library/browse/rules/safeguards-rule).
[^aws-config-managed-rule-s3]: [AWS Config managed rule — s3-bucket-public-read-prohibited](https://docs.aws.amazon.com/config/latest/developerguide/s3-bucket-public-read-prohibited.html).
[^aws-macie-sensitive-data-discovery]: [AWS Macie — Sensitive data discovery](https://aws.amazon.com/macie/).
[^federal-reserve-terminates-capital-one]: [Federal Reserve terminates Capital One enforcement action (2023)](https://www.cybersecuritydive.com/news/fed-ends-capital-one-breach-action/686970/).
[^upguard-accenture-s3-buckets-exposure]: [UpGuard — Accenture S3 buckets exposure (September 2017)](https://www.upguard.com/breaches/cloud-leak-accenture).
[^upguard-deep-root-analytics-rnc]: [UpGuard — Deep Root Analytics / RNC voter data exposure (June 2017)](https://www.upguard.com/breaches/the-rnc-files).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-ccsp]: [ISC2 CCSP — certification exam outline](https://www.isc2.org/certifications/ccsp/ccsp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).

### Further reading

- [AICPA SOC 2 Trust Services Criteria — 2017 framework with 2022 revisions](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services).
- [MITRE ATT&CK — T1530: Data from Cloud Storage Object](https://attack.mitre.org/techniques/T1530/).
- [MITRE ATT&CK — T1602: Data from Configuration Repository](https://attack.mitre.org/techniques/T1602/).
- [MITRE ATT&CK — T1078.004: Valid Accounts: Cloud Accounts](https://attack.mitre.org/techniques/T1078/004/).
- [MITRE ATT&CK — T1213: Data from Information Repositories](https://attack.mitre.org/techniques/T1213/).
- [MITRE ATT&CK — T1580: Cloud Infrastructure Discovery](https://attack.mitre.org/techniques/T1580/).
- [AWS S3 Block Public Access — User Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html).
- [AWS Security Hub — Centralized security findings](https://aws.amazon.com/security-hub/).
- [AWS IAM Access Analyzer](https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html).
- [Capital One 2019 breach — OCC consent order ($80M penalty, August 2020)](https://www.occ.gov/news-issuances/news-releases/2020/nr-occ-2020-101.html).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
