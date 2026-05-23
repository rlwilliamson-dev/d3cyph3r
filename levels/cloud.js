// Cloud track levels.
//
// See levels/linux.js for the full schema documentation. Cloud-specific
// fields used by js/commands/cloud.js (the fake `aws` CLI surface):
//
//   cloud: {
//     s3: {
//       bucketCreatedDate: "2024-08-12 09:14:22",   // optional, formatting only
//       deniedBuckets: ["bucket-a", "bucket-b"],    // properly-locked-down
//                                                   // buckets — `aws s3 ls`
//                                                   // returns AccessDenied
//                                                   // (the bucket exists but
//                                                   // the caller is denied).
//       buckets: {
//         "<bucket-name>": {
//           "key/path": { content: "...", size: 1234, date: "2024-08-12 09:14:22" },
//           ...
//         },
//         ...
//       },
//     },
//     iam: {
//       users: [
//         { user_name: "service-account", arn: "arn:aws:iam::1234:user/service-account" },
//         ...
//       ],
//       attachedUserPolicies: {
//         "service-account": [
//           { PolicyName: "AdministratorAccess", PolicyArn: "arn:aws:iam::aws:policy/AdministratorAccess" },
//           ...
//         ],
//       },
//       policies: {
//         "arn:aws:iam::aws:policy/AdministratorAccess": {
//           PolicyName: "AdministratorAccess",
//           Description: "Provides full access to AWS services and resources.",
//           DefaultVersionId: "v1",
//           Document: { Version: "2012-10-17", Statement: [...] },
//         },
//       },
//     },
//     ec2: {
//       instances: [
//         {
//           InstanceId: "i-0abc123",
//           InstanceType: "t3.medium",
//           State: "running",
//           PublicIp: "54.x.x.x",
//           PrivateIp: "10.0.0.x",
//           SecurityGroups: ["sg-0abc"],
//           IamInstanceProfile: "arn:aws:iam::1234:instance-profile/web-tier",
//           Tags: { Name: "web-01", Env: "prod" },
//         },
//         ...
//       ],
//       securityGroups: [
//         {
//           GroupId: "sg-0abc",
//           GroupName: "web-tier-sg",
//           Description: "Web tier ingress",
//           IngressRules: [
//             { protocol: "tcp", fromPort: 443, toPort: 443, sources: ["0.0.0.0/0"] },
//             { protocol: "tcp", fromPort: 22,  toPort: 22,  sources: ["0.0.0.0/0"] },  // bad
//           ],
//         },
//         ...
//       ],
//     },
//     sts: {
//       UserId: "AIDAEXAMPLEUSERID",
//       Account: "123456789012",
//       Arn:     "arn:aws:iam::123456789012:user/service-account",
//     },
//   }
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts.

export const cloudLevels = {

  // ── level 0 — "Coverline's Twelfth Bucket" ──────────────────────
  // The player's first cloud-audit task: a SOC 2 Type II auditor has
  // handed Coverline Insurance a 6-bucket worksheet that must be
  // verified non-public to close a control gap. Coverline's DevOps
  // team is committed on an unrelated migration; Driftwood is asked
  // to walk the worksheet. The player runs `aws s3 ls --no-sign-request`
  // against each bucket. Four return AccessDenied (correctly locked
  // down). One returns a brochure listing — the worksheet flags this
  // bucket as intentionally public ("PUBLIC (marketing CDN)"), so it's
  // not a finding. One — `coverline-claims-uploads-prod` — returns an
  // unexpected listing of claims-processing files (PII: claimant
  // names, masked SSNs, addresses, claim amounts) AND a stale 2023
  // migration script with a hardcoded RDS master password. The
  // lesson is the public-S3-bucket-as-pwn-primitive — the single most
  // common cloud-data-exposure pattern in real consulting work —
  // mapped to SOC 2 Trust Services Criteria (CC6 / CC7), CIS AWS
  // Foundations Benchmark v5.0.0 (§2.1), NIST SP 800-53 Rev. 5
  // (AC-3 / SC-7), NIST CSF 2.0 (PR.AA / PR.DS), ISO 27017 (Cloud
  // services security), NAIC Insurance Data Security Model Law, NYDFS
  // 23 NYCRR 500, CWE-200 / CWE-732 / CWE-285, OWASP Cloud-Native Top
  // 10 (CNAS-1: Insecure Cloud, Container, or Orchestration Config),
  // and MITRE T1530 (Data from Cloud Storage Object) / T1602 /
  // T1078.004. Introduces the `aws s3 ls --no-sign-request` and
  // `aws s3 cp` workflow.
  "level0@cloud": {
    password: null,
    track: "cloud",
    playerUser: "cloudsec",
    objective: "Walk Coverline's 6-bucket SOC 2 audit worksheet from outside the Coverline account. For each bucket, run an unauthenticated `aws s3 ls --no-sign-request` probe and record the response. Flag any bucket that isn't behaving the way the worksheet says it should.",
    lesson: "Coverline Insurance is one of Driftwood's insurtech clients — a mid-sized property & casualty carrier specializing in small-business policies (~150 engineers, founded 2019, HQ in Hartford, Connecticut). They sell direct AND white-label their product to ~40 regional insurance carriers, which is why the SOC 2 Type II report is non-negotiable — every carrier customer requires it before they'll resell. State-insurance regs add layers: NAIC Insurance Data Security Model Law has been adopted in ~25 states Coverline operates in, and NYDFS 23 NYCRR 500 applies because they're licensed in New York. Coverline is mid-SOC-2-cycle right now and the audit firm flagged a gap last week: there's no documented evidence trail for the 'S3 bucket public-access review' control (CC6.1). The auditors produced a 6-bucket worksheet with the expected access state for each, and Coverline needs each one walked and the response recorded as evidence. Coverline's DevOps team is fully committed on an us-east-1-to-us-east-2 cutover; Jordan Nguyen (Coverline's Sr. Director of Cloud Infrastructure) asked Driftwood to fill in. You're on Driftwood's cloud-audit workstation (the shell calls you `cloudsec`, the shared service account the cloud-security team uses for client recon). Read welcome.md first — it explains how the unauthenticated S3 probe works. Then read engagement-notes.md, then audit-worksheet.txt, then walk the buckets. Read lessons-learned.md once you've found the bucket that doesn't match the worksheet.",
    cloud: {
      s3: {
        bucketCreatedDate: "2024-08-12 09:14:22",
        deniedBuckets: [
          "coverline-static-assets",
          "coverline-backups-prod",
          "coverline-terraform-state",
          "coverline-customer-exports",
        ],
        buckets: {
          // Intentionally public — marketing CDN, no PII, expected to
          // list. Player sees this and (per the worksheet) marks it
          // "matches expectation, no finding."
          "coverline-marketing-public": {
            "brochures/coverline-overview-2024.pdf": {
              date: "2024-09-12 11:42:08",
              size: 1842317,
              content: "%PDF-1.7\n[binary PDF content — 1.8 MB on disk —\n omitted from terminal display. This is a marketing brochure\n intended for public download; no PII or sensitive data.]",
            },
            "brochures/coverline-small-business-faq.pdf": {
              date: "2024-09-12 11:43:21",
              size: 987142,
              content: "%PDF-1.7\n[binary PDF content — 964 KB on disk —\n omitted from terminal display. Public-facing FAQ document.]",
            },
            "logos/coverline-logo-color.png": {
              date: "2024-06-18 08:22:14",
              size: 84327,
              content: "[binary PNG content — 82 KB on disk — omitted from\n terminal display. Public logo asset for partners /\n affiliate marketing kits.]",
            },
            "logos/coverline-logo-white.png": {
              date: "2024-06-18 08:22:14",
              size: 71248,
              content: "[binary PNG content — 70 KB on disk — omitted from\n terminal display. Public logo asset, alternate variant.]",
            },
            "partner-kits/coverline-affiliate-deck-2024.pdf": {
              date: "2024-09-12 11:44:55",
              size: 3127894,
              content: "%PDF-1.7\n[binary PDF content — 3.0 MB on disk —\n omitted from terminal display. Public-facing partner /\n affiliate sales deck.]",
            },
          },

          // THE FIND — misconfigured public bucket. The worksheet
          // expected this to be private. It isn't. Contains 2024-Q1
          // claims files (PII: claimant names, masked SSNs, addresses,
          // claim amounts) and a stale 2023 migration script with a
          // hardcoded RDS master password. This is a FERPA-grade-
          // equivalent insurance-PII exposure (NAIC / NYDFS-grade) and
          // a credential-leak primitive on top.
          "coverline-claims-uploads-prod": {
            "2024-Q1-claims/claim-cl-019823.json": {
              date: "2024-03-15 09:23:41",
              size: 2147,
              content:
`{
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
}`,
            },
            "2024-Q1-claims/claim-cl-019824.json": {
              date: "2024-03-15 09:24:11",
              size: 2089,
              content:
`{
  "claim_id": "CL-019824",
  "policy_number": "CV-SB-2022-41187",
  "claim_type": "commercial_auto",
  "claimant": {
    "first_name": "Aisha",
    "last_name": "Patel",
    "ssn": "XXX-XX-3392",
    "date_of_birth": "1985-08-29",
    "address": {
      "street": "88 Park Avenue",
      "city": "New Haven",
      "state": "CT",
      "zip": "06511"
    },
    "phone": "(203) 555-0188",
    "email": "a.patel@example.com"
  },
  "policy_holder": "Patel Logistics Inc.",
  "incident": {
    "date": "2024-02-22",
    "location_city": "Stamford",
    "location_state": "CT",
    "description": "Rear-end collision involving insured delivery vehicle; third-party claim against policy.",
    "estimated_damages_usd": 18750
  },
  "adjuster_assigned": "kim.chen@coverline-insurance.com",
  "status": "approved_pending_payment",
  "uploaded_at": "2024-03-15T09:24:11Z"
}`,
            },
            "2024-Q1-claims/claim-cl-019825.json": {
              date: "2024-03-15 09:25:33",
              size: 1934,
              content:
`{
  "claim_id": "CL-019825",
  "policy_number": "CV-SB-2024-11042",
  "claim_type": "workers_compensation",
  "claimant": {
    "first_name": "Dmitri",
    "last_name": "Volkov",
    "ssn": "XXX-XX-9981",
    "date_of_birth": "1991-11-04",
    "address": {
      "street": "412 Maple Street, Apt 3B",
      "city": "Waterbury",
      "state": "CT",
      "zip": "06702"
    },
    "phone": "(203) 555-0204",
    "email": "dvolkov.work@example.com"
  },
  "policy_holder": "Volkov Construction LLC",
  "incident": {
    "date": "2024-03-04",
    "location_city": "Hartford",
    "location_state": "CT",
    "description": "On-site workplace injury; employee fell from scaffolding during framing work.",
    "estimated_damages_usd": 64800
  },
  "adjuster_assigned": "kim.chen@coverline-insurance.com",
  "status": "under_review",
  "uploaded_at": "2024-03-15T09:25:33Z"
}`,
            },
            "legacy-deploy/migrate-rds.sh": {
              date: "2023-11-08 14:18:22",
              size: 847,
              content:
`#!/usr/bin/env bash
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

echo "[+] Dumping \${DB_NAME} from \${RDS_HOST}..."
PGPASSWORD="\${RDS_PASSWORD}" pg_dump \\
  -h "\${RDS_HOST}" \\
  -U "\${RDS_USER}" \\
  -d "\${DB_NAME}" \\
  -F custom \\
  -f /tmp/coverline_claims.dump

echo "[+] Uploading dump to s3://\${DUMP_BUCKET}/\${DUMP_PREFIX}..."
aws s3 cp /tmp/coverline_claims.dump "s3://\${DUMP_BUCKET}/\${DUMP_PREFIX}coverline_claims.dump"

echo "[+] Done."`,
            },
            "legacy-migration-snapshot/coverline_claims.dump": {
              date: "2023-11-08 14:19:01",
              size: 4827392,
              content: "PGDMP\n[binary PostgreSQL custom-format dump — 4.6 MB on disk —\n omitted from terminal display. This is a full DB snapshot of\n the coverline_claims production database as of the 2023-Q4\n region cutover; contains every claim record, policy holder\n record, and adjuster note for the period covered.]",
            },
          },
        },
      },
      // The Driftwood `cloudsec` workstation has its own AWS identity
      // — Driftwood account, read-only role used for client recon.
      // The player can optionally run `aws sts get-caller-identity`
      // to confirm they're probing from outside Coverline's account.
      sts: {
        UserId: "AIDAEXAMPLE_DRIFTWOOD_CLOUDSEC",
        Account: "778899012345",
        Arn: "arn:aws:iam::778899012345:user/driftwood-cloudsec-readonly",
      },
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Cloud Audit Workstation ───────────────

You're logged in as \`cloudsec\` — the cloud-security team's shared
service account. The host \`cloud\` is our cloud-audit workstation,
where we run external-perspective recon against client AWS / Azure
/ GCP environments.

Today's client: Coverline Insurance. Their SOC 2 Type II auditors
have flagged a gap — Coverline doesn't have documented evidence
that their production S3 buckets are properly locked down. The
auditor handed them a worksheet of 6 buckets that need to be
verified. Coverline's DevOps team is busy on a migration; we're
filling in.


─── NEW COMMANDS ──────────────────────────────────────────────

  aws s3 ls --no-sign-request s3://<bucket>
                     List the contents of an S3 bucket WITHOUT
                     using credentials — exactly what an outside
                     attacker would do. The bucket either replies
                     with a listing (it's public) or returns
                     AccessDenied (it's locked down — good).

  aws s3 cp s3://<bucket>/<key> -
                     Download an object from a (public) bucket and
                     print it to stdout (the \`-\` destination is
                     "write to terminal" — same as Unix cp / scp).
                     Use this to actually look at what's exposed.

  aws sts get-caller-identity
                     Show whose AWS identity you're using. Useful
                     for confirming you're probing from your own
                     account, not the client's.


─── WHAT \`--no-sign-request\` DOES ─────────────────────────────

The real AWS CLI signs every request with your access key. With
\`--no-sign-request\`, it skips that step — the request goes out
unsigned, exactly like an anonymous internet user would make it.

This is the canonical way to test "what does the public see when
they look at this bucket?" — the question SOC 2, NAIC, NYDFS,
HIPAA, PCI-DSS, and every other regulatory regime cares about.

The three responses you'll see:

  AccessDenied         Bucket exists but anonymous requests
                       can't list / read it. THIS IS WHAT GOOD
                       LOOKS LIKE for a private bucket. The
                       Public Access Block + bucket policy + IAM
                       all agree: outsiders get nothing.
  NoSuchBucket         Bucket doesn't exist at all (or, more
                       commonly, you typo'd the name).
  Listing returns      Bucket is publicly listable. Whether this
                       is a finding depends on what's IN it —
                       brochures are fine, claims files are not.

Real-world tooling for this kind of audit at scale: \`s3scanner\`,
\`bucket_finder\`, \`s3recon\`, AWS Config managed rule
\`s3-bucket-public-read-prohibited\`, AWS Macie, and Trusted
Advisor's "S3 Bucket Permissions" check. Today we're walking the
6-bucket list manually because it's an audit deliverable, not a
zero-day finding — the auditors want the procedure recorded.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Coverline / Jordan / SOC 2
  2.  cat audit-worksheet.txt     The 6 buckets to verify, with
                                  the expected access state for
                                  each
  3.  aws s3 ls --no-sign-request s3://<each-bucket>
                                  Walk the worksheet. Most should
                                  return AccessDenied.
  4.  aws s3 cp s3://<bucket>/<key> -
                                  When a bucket returns a
                                  listing, actually look at what's
                                  in it. Cross-reference against
                                  the worksheet to decide if it's
                                  a finding.
  5.  cat lessons-learned.md      Post-mortem (read after step 4)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Coverline Insurance — engagement notes

Client: Coverline Insurance, Inc.
Vertical: Insurtech — property & casualty (P&C) insurance for
          small businesses (general liability, commercial auto,
          workers' compensation, business owners' policies);
          ~150 engineers, founded 2019, HQ in Hartford, CT
          (~120 staff in-office), satellite office in Austin
Engagement: ~18 months, ongoing
Driftwood handler: Priya
Client counterpart (this case): Jordan Nguyen (Sr. Director of
                                Cloud Infrastructure & Platform,
                                Coverline; also liaising for
                                Sloane Becker, the CISO)
Compliance regime: SOC 2 Type II — every carrier customer
                   contractually requires Coverline's most recent
                   SOC 2 report before they'll resell Coverline's
                   white-label product. Coverline's annual SOC 2
                   audit is the cornerstone deliverable of their
                   security program. Layered regs:
                     - NAIC Insurance Data Security Model Law
                       (adopted in ~25 of the states Coverline
                       operates in; codifies risk assessment,
                       written infosec program, third-party
                       service-provider oversight, incident
                       notification within 72 hours to the state
                       insurance commissioner)
                     - NYDFS 23 NYCRR 500 (applies because
                       Coverline is licensed in New York;
                       requires written cybersecurity policy,
                       designated CISO, annual risk assessment,
                       MFA for privileged accounts, encrypted
                       PII at rest and in transit, 72-hour breach
                       notification to NYDFS, annual penetration
                       testing, biannual vulnerability assessment)
                     - State-by-state data-breach notification
                       laws (50 jurisdictions, varying timelines
                       and triggering thresholds)
                     - GLBA Safeguards Rule (applies because
                       insurance is a Title V financial activity;
                       the FTC's amended Safeguards Rule effective
                       2023 added MFA, encryption, written
                       incident response plan, and qualified-
                       individual designation)

## The relationship

Coverline came to Driftwood ~18 months ago for SOC 2 readiness
work — they were preparing for their FIRST Type II audit (they'd
done a Type I the prior year) and wanted a security partner who
could help them through the readiness assessment and the
remediation cycle. We sat alongside Coverline's small in-house
security team (then 2 people, now 4) through the gap analysis,
the control implementation, and the audit fieldwork itself.

They passed their first Type II audit cleanly, and the ongoing
engagement has shifted to general security partnership: third-
party risk assessments, the annual penetration test, incident
response retainer, and — increasingly — audit-cycle gap-filling
when Coverline's internal team can't take a piece on without
slipping their primary roadmap.

## This engagement

Jordan Nguyen emailed Priya last Thursday afternoon. The trigger:
Coverline is mid-fieldwork on this year's SOC 2 Type II audit.
The auditing firm (a Big Four practice; the specific partner
isn't material here) is in their second week onsite and
delivering preliminary findings. One of those findings,
delivered Wednesday evening as a "potential control gap, not yet
a deficiency," concerned the public-access posture of Coverline's
production S3 buckets.

The control in question is SOC 2 CC6.1 (Logical and Physical
Access Controls — restrict logical access to information assets).
The auditor's concern: Coverline has a written policy that
"production S3 buckets shall not allow anonymous public access
unless explicitly designated as a public-access asset," but
there's no documented evidence trail of the policy being
verified in practice. No periodic review, no automated check,
no quarterly attestation. The policy exists; the audit
artifact does not.

The auditors are willing to close the gap if Coverline can
produce, within the fieldwork window, a documented walk of
every production S3 bucket showing its current public-access
posture against the expected posture. They produced a worksheet
listing 6 representative production buckets (the ones holding
claims data, customer exports, deployment artifacts, etc.) and
the expected state for each. Coverline's task: walk it, record
the response, attest.

Coverline's DevOps team is fully committed on a region cutover
(us-east-1 → us-east-2) that has a hard deadline next week.
Jordan asked Priya if Driftwood could pick up the worksheet so
the DevOps cutover doesn't slip and the SOC 2 audit doesn't go
into deficient status. Standard scope, well-defined deliverable,
quick turnaround. We said yes.

## Scope (signed by Jordan + the audit firm)

  IN SCOPE:
    - The 6 buckets listed in audit-worksheet.txt. Walk each one
      with \`aws s3 ls --no-sign-request s3://<bucket>\`
      (unauthenticated probe — the auditor's preferred external-
      perspective method).
    - For any bucket that returns a listing rather than
      AccessDenied: \`aws s3 cp s3://<bucket>/<key> -\` to
      examine specific objects.
    - Document the response for each bucket (the audit firm
      will use the documentation; Driftwood retains a copy for
      our records).

  OUT OF SCOPE:
    - The other ~80 S3 buckets in Coverline's production
      accounts. This audit cycle is bounded to the worksheet;
      a broader inventory review is the next engagement.
    - Any active enumeration tooling (s3scanner, bucket_finder,
      etc.). The walk is manual + documented; tooling can find
      things that aren't on the worksheet, which expands scope
      beyond what's authorized.
    - Coverline's Azure tenant and GCP project (Coverline runs
      ~5% of workloads on Azure for one regulatory carve-out
      and ~2% on GCP for an analytics POC; out of SOC 2 scope
      for this audit cycle, both audited separately).
    - Any IAM enumeration. If the bucket walk surfaces an IAM
      issue, document and stop — that's a follow-on engagement.

  AUTHORIZATION:
    Jordan has authorization from the audit firm and from
    Coverline's CISO (Sloane Becker). The unauthenticated probe
    is the same one the audit firm would use externally; this is
    not "active testing" in the SOC 2 / penetration-testing sense.

## A note on tone

The worksheet is an audit deliverable, not a vulnerability
hunt. Coverline's whole org is watching the SOC 2 outcome,
because the carrier customers are watching the SOC 2 outcome.
The deliverable is "documented walk + response for each bucket"
— not "look how many findings I can stack up." If a finding
surfaces, surface it; otherwise the value of this engagement is
the boring procedural completeness.

That said: if you find something that DOES go beyond the
worksheet's expected state, surface it carefully. SOC 2 fieldwork
is the wrong time for a surprise.

— Priya`
        },

        "audit-worksheet.txt": {
          type: "file",
          content:
`# SOC 2 Type II audit deliverable
# Control: CC6.1 — Logical and Physical Access Controls
# Sub-control: S3 bucket public-access posture review
# Issued: 2026-05-13 by audit firm (lead: M. Holcombe)
# Coverline ref: COV-SOC2-2026-EVID-014

## Procedure

For each bucket below, the auditor requests:

  1. Execute \`aws s3 ls --no-sign-request s3://<bucket>\`
     from a system OUTSIDE the Coverline AWS accounts. (Driftwood's
     cloud-audit workstation is acceptable per pre-engagement
     letter dated 2026-05-12.)
  2. Record the verbatim response.
  3. Compare the response against the "Expected" column below.
  4. Annotate as either "MATCHES EXPECTATION" or "DEVIATION".
  5. For any "DEVIATION", inspect contents and produce a finding
     memo. (Use \`aws s3 cp s3://<bucket>/<key> -\` to inspect
     specific objects.)

## Buckets in scope

  Bucket                              Expected            Verify
  ─────────────────────────────────────────────────────────────
  coverline-static-assets             Private (Denied)    ___
  coverline-backups-prod              Private (Denied)    ___
  coverline-marketing-public          PUBLIC (CDN)        ___
  coverline-terraform-state           Private (Denied)    ___
  coverline-customer-exports          Private (Denied)    ___
  coverline-claims-uploads-prod       Private (Denied)    ___

## Notes per bucket

  coverline-static-assets
    Hosts the static-asset bundle (CSS, JS, fonts) for the
    Coverline app shell. Served through CloudFront with OAI
    (Origin Access Identity), so the bucket itself should
    deny anonymous and only the OAI principal should read.

  coverline-backups-prod
    Encrypted application-data backups (RDS snapshots, EBS
    snapshots, app-tier file backups). KMS-encrypted at rest;
    bucket policy denies all principals except the backup-
    automation role.

  coverline-marketing-public
    Marketing CDN: brochures, partner kits, logos. INTENTIONALLY
    public — the marketing team distributes assets to affiliates
    via the bucket URL. No PII or operational data; should
    contain only PDFs and image assets.

  coverline-terraform-state
    Terraform state files for production environment. Bucket
    policy denies all principals except the IaC-runner role.
    State files contain resource IDs / ARNs; their compromise
    would map our entire production topology.

  coverline-customer-exports
    Customer-requested data exports (CSV / JSON dumps of policy
    holder records, claim history). Served via signed presigned
    URLs with 15-minute TTL; the bucket itself should deny
    anonymous.

  coverline-claims-uploads-prod
    Production claims-processing uploads — claimants upload
    incident photos, statements, supporting documents through
    the claims portal. Bucket policy is documented as denying
    anonymous; the claims app accesses it via an STS-issued
    temporary credential per session.

## Completion

When the walk is complete, the auditor expects six annotated
rows. "MATCHES EXPECTATION" for the five private buckets and
the marketing CDN; any "DEVIATION" requires a finding memo.

Deliverable due to the audit firm by end-of-day Friday.

— Coverline Compliance, on behalf of Jordan Nguyen
   (Sr. Director, Cloud Infrastructure & Platform)`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that one of Coverline's six worksheet buckets
— \`coverline-claims-uploads-prod\` — is publicly listable and
publicly readable, despite being documented as private in the
SOC 2 control attestation. The bucket contains:

  - Three 2024-Q1 claim files in \`2024-Q1-claims/\`. Each is a
    JSON document with the claimant's first/last name, date of
    birth, residential address, phone number, email, the policy
    number, the incident description and damages, and the
    adjuster's email address. The SSN field is masked to the
    last four digits in the production schema — but the
    remaining fields are still NPI / PII under GLBA, and the
    combination is more than enough to satisfy the NAIC Model
    Law definition of "nonpublic information."

  - A stale 2023 migration script (\`legacy-deploy/migrate-rds.sh\`)
    that hardcodes the RDS master password for the
    \`coverline_claims\` production database. The script was
    written for a region-cutover migration that completed in
    late 2023 and was never removed; the password it embeds
    almost certainly has not been rotated since.

  - The actual SQL dump that the migration script uploaded
    (\`legacy-migration-snapshot/coverline_claims.dump\`, 4.6 MB
    PostgreSQL custom-format). That's the entire claims-
    database state as of the cutover.

This is two findings stacked: (a) a public-S3-bucket exposure
of NPI / PII (Coverline's SOC 2, GLBA, NAIC, NYDFS, and state-
breach-notification posture all care), and (b) a hardcoded
credential leak in a file that was discoverable by walking the
exposed bucket (the credential-leak primitive that drives most
post-compromise lateral movement in real cloud incidents).

The four other private buckets responded with AccessDenied as
expected. The marketing bucket listed brochures and logos as
expected. The worksheet is now five rows of "MATCHES EXPECTATION"
and one row of "DEVIATION — see finding memo."

Your job ends here. The finding memo goes to Priya, who'll write
the formal version that goes to Jordan, the audit firm, and
Coverline's CISO.


─── THE BLUNT VERSION ────────────────────────────────────────

The public S3 bucket is the single most common cloud-data-
exposure pattern in real consulting work. Verizon's annual DBIR
and the Verizon Cloud Security Report have, every year since
2017, identified S3 misconfigurations (and the equivalent Azure
Blob Storage / GCP Cloud Storage misconfigurations) as a
leading cause of public-data exposure. The pattern is mundane:

  1. A developer creates a bucket for a specific task — a
     migration, a one-off export, an analytics dump.
  2. They flip a permission to "make it work" — sometimes a
     bucket policy change, sometimes the legacy ACL approach,
     sometimes by disabling part of the Public Access Block
     for "just an hour."
  3. The task completes. The bucket is forgotten.
  4. Six months later, the auditor's worksheet finds it.
     Or — worse — someone using \`s3scanner\` finds it first.

The defensive controls are well-known and free or near-free:

  - S3 Block Public Access at the ACCOUNT level — a single
    setting at the AWS account root that overrides every
    bucket-level setting. Turning this on org-wide (via Service
    Control Policy from AWS Organizations) makes "accidentally
    public" structurally impossible. The setting has been
    available since 2018; it should be on by default for every
    account from day one.
  - AWS Config managed rule
    \`s3-bucket-public-read-prohibited\` (and \`-write-prohibited\`)
    — automated, continuous evaluation, alarms on any
    non-compliant resource.
  - AWS Macie — surfaces buckets that hold sensitive data
    types (PII, PHI, financial data, credentials) AND are
    publicly accessible. Continuously evaluates content
    against a managed set of detectors.
  - AWS Trusted Advisor "S3 Bucket Permissions" check —
    available even on the Basic support tier; flags publicly
    accessible buckets.

Coverline ran zero of those automatic checks against this
bucket. The reason isn't ignorance — Jordan's team knows about
all of them. It's that the bucket pre-dated their current
governance rollout, and the rollout never went back to retrofit
older buckets. The migration script that lived in the bucket
made it across a region cutover; the bucket's permission state
did not.

The credential half of the finding lands the same way. Hard-
coding a database password in a deploy script is not a 2024
problem — it's a 2008 problem that keeps showing up because
the alternatives (Secrets Manager / Parameter Store / Vault /
KMS-encrypted env file) require a deliberate engineering choice
that nobody assigned to the migration scripted in 2023. The
script worked; the script shipped; the script never got
rotated out.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Coverline is a SOC 2 Type II shop in active fieldwork. The
finding lands in a specific procedural context:

  - The audit firm asked for the walk explicitly to close CC6.1
    evidence. The worksheet was the audit firm's deliverable
    spec, not Coverline's. Our finding goes to the audit firm
    too — the firm decides whether it's a "control deficiency"
    (rated severity) or a "matter for management's attention"
    (lower-rated). Coverline's SOC 2 report will reflect that
    decision.

  - The MSA between Driftwood and Coverline scopes this engagement
    tightly: walk the 6 buckets, document the response, surface
    deviations. We did NOT enumerate every bucket in Coverline's
    production account (out of scope). We did NOT touch the
    Azure or GCP environments (out of scope). We did NOT use the
    credential we found to authenticate against the RDS instance
    (firmly out of scope; that would be unauthorized access).

  - The NAIC Insurance Data Security Model Law requires
    notification to the state insurance commissioner within 72
    hours of determining that NPI has been (or is likely to
    have been) acquired by an unauthorized person. The
    determination clock is Coverline's, not Driftwood's. We
    surface the finding; Coverline's CISO + GC + outside
    counsel determine whether the exposure window crossed the
    "likely acquired" threshold. The clock starts at THAT
    determination, not at our finding.

  - GLBA Safeguards Rule (FTC amendments effective 2023)
    requires written incident response procedure including
    notification of the FTC for breach events affecting 500+
    consumers' NPI. Coverline's IR runbook covers this; the
    question is whether the exposure satisfies the triggering
    threshold.

  - NYDFS 23 NYCRR 500.17(a) requires notification to the
    Superintendent within 72 hours when a covered entity has
    "a reasonable belief that any nonpublic information was
    accessed or acquired by an unauthorized person." Same
    determination process as NAIC.

  - State data-breach notification laws kick in across every
    state of residence represented in the affected dataset.
    Connecticut (where all three claimants in the visible
    sample live) requires written notification "without
    unreasonable delay" — typically interpreted as within
    60-90 days of the incident discovery.

That entire regulatory ladder is what Coverline's CISO and GC
are going to be working through on Monday. The forensic finding
we produced today is the first artifact in a several-week
process. The blast radius from a single misconfigured bucket
travels far past the bucket itself.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  SOC 2 Trust Services Criteria (2017, refreshed 2022)
    CC6.1  Logical and Physical Access Controls — the control
      that drove this audit walk. Anonymous public access to
      production data violates the control whenever it isn't
      intentional.
    CC6.6  Logical access security measures for outside
      threats — bucket policies and IAM are the
      implementation.
    CC6.7  Transmission and movement of information — applies
      to data movement into and out of the bucket; bucket
      policies should restrict by source.
    CC7.1  Detection of security events — the missing piece
      here. Coverline had the policy; they didn't have the
      detection. AWS Config managed rules / Macie / Trusted
      Advisor close this gap.

  NIST SP 800-53 Rev. 5
    AC-3   Access Enforcement — the bucket policy is the
      access-enforcement mechanism for the asset.
    AC-6   Least Privilege — the bucket should grant the
      minimum access required (no anonymous, named principals
      only).
    SC-7   Boundary Protection — Public Access Block + bucket
      policy together form the boundary.
    AU-12  Audit Generation — S3 server-access logging and
      CloudTrail data-event logging produce the audit record.

  NIST Cybersecurity Framework 2.0
    PR.AA  Identity Management, Authentication, and Access
      Control — including the "least functionality necessary"
      sub-category.
    PR.DS  Data Security — the in-transit and at-rest
      protections; encryption + access control.
    DE.CM  Continuous Monitoring — the detection layer
      Coverline was missing.

  CIS AWS Foundations Benchmark v5.0.0
  (the Security Hub-supported version as of late 2025; CIS
   has also published v7.0.0 but tooling support is lagging)
    §2.1.1  Ensure S3 Bucket Policy is set to deny HTTP
      requests (TLS-only). Tangential here but relevant
      hygiene.
    §2.1.2  Ensure MFA Delete is enabled on S3 buckets.
    §2.1.3  Ensure all S3 buckets employ encryption-at-rest
      with KMS (v5 consolidated the legacy v3 §2.1.6 KMS
      requirement into §2.1.3).
    §2.1.4  Ensure S3 Block Public Access setting is enabled
      at the account level — the headline control that
      would have prevented this finding.
    §2.1.5  Ensure S3 Block Public Access setting is enabled
      at the bucket level (defense-in-depth).

  ISO/IEC 27017:2015 (Code of practice for information security
  controls based on ISO/IEC 27002 for cloud services)
    CLD.6.3.1  Shared roles and responsibilities within a
      cloud environment.
    CLD.8.1.5  Removal of cloud service customer assets.
    CLD.9.5.1  Segregation in virtual computing environments.

  OWASP Cloud-Native Top 10 (2022)
    CNAS-1: Insecure Cloud, Container, or Orchestration
      Configuration — this finding is the canonical example.
    CNAS-2: Injection Flaws (cloud-native versions) — adjacent;
      the hardcoded RDS password would enable injection-style
      lateral movement.
    CNAS-5: Insecure Secrets Storage — the hardcoded RDS
      master password in migrate-rds.sh is the textbook
      example of credentials stored in a non-secret-store
      location.

  CWE
    CWE-200  Exposure of Sensitive Information to an
      Unauthorized Actor — the headline.
    CWE-732  Incorrect Permission Assignment for Critical
      Resource — the bucket-policy / Public Access Block
      misconfiguration.
    CWE-285  Improper Authorization — the public bucket
      authorizes the wrong principals (every principal).
    CWE-798  Use of Hard-Coded Credentials — the RDS master
      password in the migration script.
    CWE-540  Inclusion of Sensitive Information in Source
      Code — the script.

  NAIC Insurance Data Security Model Law (2017)
    §4   Information Security Program — written program;
      annual risk assessment; documented controls.
    §5   Investigation of a Cybersecurity Event — including
      the determination of whether NPI was acquired.
    §6   Notification of a Cybersecurity Event — 72-hour
      notification to the state insurance commissioner.

  NYDFS 23 NYCRR 500 (2017, amended 2023)
    500.03   Cybersecurity policy.
    500.05   Penetration testing and vulnerability assessments.
    500.09   Risk assessment.
    500.13   Limitations on data retention.
    500.15   Encryption of nonpublic information.
    500.17   Notices to Superintendent (72-hour clock).

  GLBA Safeguards Rule (FTC, amended December 2021,
  enforcement effective June 2023)
    16 CFR 314.4  Required elements of an information security
      program. Includes designation of a qualified individual,
      access controls, encryption of consumer information at
      rest and in transit, MFA for any individual accessing
      consumer information.


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  AWS Certified Security – Specialty (SCS-C02)
    Whole-cert relevant. Domain 1 (Threat Detection and
    Incident Response) and Domain 4 (Identity and Access
    Management) directly cover bucket policies, Public Access
    Block, Macie, Config, GuardDuty.

  AWS Certified Solutions Architect (Associate / Professional)
    Storage and security sub-domains include S3 permission
    models. The Professional exam expects fluency in
    multi-account governance (Organizations + SCPs).

  AWS Certified Cloud Practitioner (CLF-C02)
    Entry-level; covers the shared-responsibility model and
    S3 basics. The "S3 is private by default but configurable
    to public" framing is on the exam.

  CompTIA Security+ (SY0-701)
    Domain 4 (Security Operations) — cloud-security baseline
    including misconfigurations.

  CompTIA CySA+ (CS0-003)
    Domain 1 (Security Operations) — cloud-misconfiguration
    detection and response.

  ISC² CCSP (Certified Cloud Security Professional)
    Whole-cert relevant. Domains 2 (Cloud Data Security), 3
    (Cloud Platform & Infrastructure Security), and 6 (Legal,
    Risk, and Compliance) all cover this scenario.

  CSA CCSK (Certificate of Cloud Security Knowledge)
    The vendor-neutral cloud-security cert. The CSA Cloud
    Controls Matrix (CCM) and Consensus Assessments Initiative
    Questionnaire (CAIQ) both have multiple controls for
    "anonymous public access to cloud storage."

  SANS GCSA (Cloud Security Automation), SEC388 (Introduction
  to Cloud Computing and Security), SEC488 (Cloud Security
  Essentials), SEC510 (Public Cloud Security)
    Hands-on cloud-security cert family. Bucket-misconfig
    detection and remediation is fundamental.

  GIAC GCPN (Cloud Penetration Tester)
    Tests offensive cloud techniques including
    \`--no-sign-request\` bucket enumeration.

  CISSP
    Domain 4 (Communication and Network Security) and Domain
    7 (Security Operations) both touch cloud-misconfiguration
    detection.

  Cross-cloud equivalents: Microsoft AZ-500 (Azure Security
    Engineer Associate), Google Professional Cloud Security
    Engineer — both certs include the equivalent storage-
    permission misconfiguration scenarios (Azure Blob
    Storage anonymous read; GCS bucket-level IAM with
    allUsers / allAuthenticatedUsers principals).


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  Reconnaissance / Initial Access (what an external attacker
  with the same view we just had would do):

  T1530      Data from Cloud Storage Object — the technique.
             Verbatim from the technique description: "Adversaries
             may access data objects from improperly secured
             cloud storage." This is the exact match.
  T1602      Data from Configuration Repository — the migration
             script contained credential material; treating
             cloud storage as a config-repository surface fits.
  T1078.004  Valid Accounts: Cloud Accounts — what an attacker
             would do AFTER recovering the RDS credential from
             the script (lateral movement into the database).
  T1213      Data from Information Repositories — broader
             technique covering the kind of insider-or-external
             scrape this exposure enables.
  T1485      Data Destruction — out of scope here, but the
             flip side: a public-writable bucket invites
             destructive action too.

  Discovery (the attacker's view from the leaked credential):

  T1538      Cloud Service Dashboard — once an attacker has the
             RDS credential, the next discovery step is the
             database itself (table enumeration, schema dump).
  T1580      Cloud Infrastructure Discovery — the RDS endpoint
             reveals AWS account information.

  Impact (where this could go):

  T1485      Data Destruction
  T1486      Data Encrypted for Impact — the ransomware path.
  T1567.002  Exfiltration Over Web Service: Exfiltration to
             Cloud Storage — sometimes the same bucket the
             attacker is reading FROM becomes the bucket they
             stage exfil INTO.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For this specific finding, today:
     - Restrict \`coverline-claims-uploads-prod\` to private
       immediately. Turn on Block Public Access at the bucket
       level. Update the bucket policy to deny all principals
       except the claims-app role.
     - Pull the access logs (S3 server-access logging,
       CloudTrail data events for the bucket) and audit who
       (if anyone outside Coverline) requested objects since
       the bucket was created. The access log is the data set
       that determines the breach-notification math.
     - Rotate the RDS master password immediately. Audit RDS
       authentication logs (CloudWatch Logs for RDS audit
       logging, if enabled) for any non-Coverline source IP
       in the period the script's password has been in the
       wild.
     - Delete the migration script and the SQL dump from the
       bucket once they've been preserved to an evidence-
       retention store.
     - The Coverline CISO + GC + outside counsel determine
       the breach-notification posture across NAIC, NYDFS,
       GLBA, and the state laws of every claimant's
       jurisdiction.

  2. For Coverline's broader S3 posture, this quarter:
     - Enable S3 Block Public Access at the ACCOUNT level on
       every production AWS account. Single switch, account-
       wide, overrides every per-bucket setting. This makes
       "accidentally public" structurally impossible.
     - Enforce account-level Block Public Access via an AWS
       Organizations Service Control Policy. SCPs cannot be
       overridden by member-account admins.
     - Enable AWS Config managed rules
       \`s3-bucket-public-read-prohibited\` and
       \`s3-bucket-public-write-prohibited\` org-wide via
       AWS Config Aggregator. Set noncompliance alerts to
       page security on detection.
     - Enable AWS Macie on the production accounts. Macie
       surfaces buckets that contain sensitive data types
       (PII, PHI, financial, credentials) AND are publicly
       accessible — exactly the union of conditions that
       made this finding a finding. Cost is modest;
       comparable to a tier of GuardDuty.
     - Enable AWS Security Hub with the CIS AWS Foundations
       Benchmark v3 + AWS Foundational Security Best
       Practices standards. Continuous compliance scoring.

  3. For Coverline's credential-handling posture, this quarter:
     - Audit every production codebase + script + container
       image for hardcoded credentials. Tools: \`gitleaks\`,
       \`trufflehog\`, GitHub Advanced Security Secret Scanning,
       AWS Secrets Manager's "find unused secrets" automation,
       Snyk Code, Semgrep with the secret-detection ruleset.
     - Migrate every hardcoded credential to AWS Secrets
       Manager (or Parameter Store with KMS encryption, or
       HashiCorp Vault). Scripts read from the secret store
       at runtime; the secret never appears in source.
     - Set up rotation on every Secrets Manager secret. RDS
       has built-in rotation via Secrets Manager; use it.
     - Enable IAM Access Analyzer with the external-access
       finding type. Detects identity-based and resource-
       based policy paths that grant access to external
       principals (including \`Principal: "*"\`).

  4. For Coverline's SOC 2 control evidence, going forward:
     - The audit walk we just did SHOULD be a quarterly
       automated review, not an annual manual one. AWS Config
       + Macie + a custom Lambda that posts the bucket
       inventory + public-access state to a Slack channel
       weekly converts "evidence we walked it" into "evidence
       we monitor it." The cost of the automation is days; the
       cost of NOT having the automation is what we just lived
       through.
     - Add the public-access-posture check to Coverline's
       internal control attestation cadence — every quarter,
       the cloud-platform team certifies in writing that the
       posture matches the documented inventory.
     - For new buckets: bucket creation goes through Terraform
       with a module that enforces Block Public Access on
       creation. Manual creation through the AWS console is
       disabled via SCP.

  5. For the broader OPSEC lesson (defender side):
     - Public cloud storage is the modern equivalent of an
       unauthenticated FTP server on the internet, except it
       happens to companies that wouldn't dream of running an
       unauthenticated FTP server. The mental model is wrong;
       the reality is the same.
     - "Public" is a feature for marketing assets, OSS
       artifacts, and documented public APIs. It is a defect
       for anything else, including any byproduct of an
       operational process (logs, dumps, exports, migrations,
       backups, snapshots, scratch). The default of "private"
       is correct; the exceptions should be explicit, named,
       and reviewed.


─── CLOSING THOUGHT ──────────────────────────────────────────

The most damaging cloud security incidents almost never start
with a sophisticated technique. They start with a bucket that
someone made public for ten minutes during a 2:00 AM deploy in
2022 and forgot to revert. The script that's been "I'll clean
that up later" since 2023. The IAM role that has
\`AdministratorAccess\` because the original developer didn't
know which permissions they needed. The hardcoded password
that worked once and got copy-pasted into every subsequent
migration.

The technical fixes are mostly free, mostly five-minute
changes, and almost universally under-applied. The reason
isn't ignorance — every cloud engineer at Coverline could
articulate Block Public Access if you asked them. The reason
is that there's no continuous structural force pulling the
permission posture back to the policy. Audit cycles are the
crude version of that force; automated detection (Config,
Macie, Security Hub, IAM Access Analyzer) is the
continuous version.

Today's finding cost Coverline a 72-hour notification clock,
a several-week breach-notification workflow across multiple
regulators, an audit deficiency that might or might not land
in the SOC 2 report, a credential rotation, and an internal
postmortem. None of that was malicious; it was a 2023
migration script that nobody got back to.

The forensic finding is small. The system around it is what
makes it consequential.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
