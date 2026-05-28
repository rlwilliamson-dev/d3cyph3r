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
// For levels that need a PostgreSQL puzzle (e.g., RDS-adjacent
// DB enumeration from a leaked master credential), populate the
// separate `postgres` field used by the `psql` command:
//
//   postgres: {
//     defaultDb: "<db>",                  // db used when -d isn't given
//     connection: {
//       host: "<rds-endpoint>",
//       user: "<db-user>",
//     },
//     databases: {
//       "<dbName>": {
//         tables: {
//           "<tableName>": {
//             columns: ["col1", "col2", ...],
//             rows: [
//               [v1, v2, ...],
//               ...
//             ],
//           },
//           ...
//         },
//       },
//       postgres:  { tables: {} },        // include the system DBs so
//       template0: { tables: {} },        // `\l` looks like a real
//       template1: { tables: {} },        // RDS instance
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
    title: "Coverline's S3 audit",
    estimatedMinutes: 12,
    // v1.22.0 cross-track narrative seed — Vesta's parallel
    // base64-encoding-treated-as-encryption pattern in CLOSING
    // THOUGHT.
    crossTrackHooks: ["crypto"],
    playerUser: "cloudsec",
    objective: "Walk Coverline's 6-bucket SOC 2 audit worksheet from outside the Coverline account. For each bucket, run an unauthenticated `aws s3 ls --no-sign-request` probe and record the response. Flag any bucket that isn't behaving the way the worksheet says it should.",
    lesson: "Coverline Insurance is one of Driftwood's insurtech clients — a mid-sized property & casualty carrier specializing in small-business policies (~150 engineers, founded 2019, HQ in Hartford, Connecticut). They sell direct AND white-label their product to ~40 regional insurance carriers, which is why the SOC 2 Type II report is non-negotiable — every carrier customer requires it before they'll resell. State-insurance regs add layers: NAIC Insurance Data Security Model Law has been adopted in ~25 states Coverline operates in, and NYDFS 23 NYCRR 500 applies because they're licensed in New York. Coverline is mid-SOC-2-cycle right now and the audit firm flagged a gap last week: there's no documented evidence trail for the 'S3 bucket public-access review' control (CC6.1). The auditors produced a 6-bucket worksheet with the expected access state for each, and Coverline needs each one walked and the response recorded as evidence. Coverline's DevOps team is fully committed on an us-east-1-to-us-east-2 cutover; Jordan Nguyen (Coverline's Sr. Director of Cloud Infrastructure) asked Driftwood to fill in. You're on Driftwood's cloud-audit workstation (the shell calls you `cloudsec`, the shared service account the cloud-security team uses for client recon). Read welcome.md first — it explains how the unauthenticated S3 probe works. Then read engagement-notes.md, then audit-worksheet.txt, then walk the buckets. Read lessons-learned.md once you've found the bucket that doesn't match the worksheet.",

    // v1.10.0 BONUS FINDS — confirming you're probing from your own
    // Driftwood account, not Coverline's. Orthogonal to the bucket
    // finding; doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "sts-identity-confirmation",
        name: "Probing from outside the client's account",
        hint: "`aws sts get-caller-identity` returns Driftwood's own account (driftwood-cloudsec-readonly), not Coverline's. For external-audit work, confirming you are operating from an OUTSIDE account is its own auditable control — the worksheet's `--no-sign-request` premise is undermined if the auditor accidentally has cached Coverline credentials. Confirm identity before every external probe.",
        trigger: { command: "aws", argMatches: /sts get-caller-identity/, outputContains: "driftwood-cloudsec-readonly" },
      },
    ],
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
      Unauthorized Actor — the umbrella parent (note: CWE-200
      is mapping-Discouraged in current MITRE guidance; cite
      the more specific CWE-732 or CWE-285 below for direct
      mappings).
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

  AWS Certified Security – Specialty (SCS-C03)
    AWS released SCS-C03 in late 2025 / early 2026 as the
    successor to SCS-C02. Whole-cert relevant. Domain 1
    (Threat Detection and Incident Response) and Domain 4
    (Identity and Access Management) directly cover bucket
    policies, Public Access Block, Macie, Config, GuardDuty.

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

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 1 (Security Operations)
    — cloud-misconfiguration detection and response.

  ISC2 CCSP (Certified Cloud Security Professional)
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
       Benchmark v5.0.0 + AWS Foundational Security Best
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

Driftwood's e-commerce client Vesta hit the same anti-pattern in
their payments deploy: a junior engineer base64-encoded an API
key thinking it counted as encryption. Different domain, same
shape — security treated as a post-hoc cleanup task. The fix is
structural (secrets manager + code review), not a clever choice
of encoding or cryptosystem.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

  // ── level 1 — "The Migration Table Nobody Dropped" ──────────────
  // The credential-leak cascade continues. Friday's S3 audit closed
  // the CC6.1 control gap but surfaced a hardcoded RDS master
  // credential in the public bucket. Coverline's CISO + GC + outside
  // counsel spent the weekend on the breach-notification math; before
  // rotating the credential, they want Driftwood to enumerate the DB
  // to identify any secondary exposures (other credentials in row
  // data, dormant employee accounts, anomalous audit-log entries).
  //
  // The player SSHes into Coverline's cloud-audit bastion (jumpbox
  // pre-staged with the leaked credential in ~/.pgpass), walks the
  // coverline_claims schema with the new `psql` command, and finds:
  //
  //   1. An `integrations` table showing Coverline DOES use AWS
  //      Secrets Manager for current creds — but the pattern is
  //      partial, not complete.
  //   2. A `migration_artifacts` table created on 2024-02-15 with
  //      explicit TTL columns intending Q2 2024 deletion. Three
  //      rows, two unrotated and live, one properly rotated. Row 2
  //      (broker-portal service credential) is the level2 breadcrumb
  //      — Coverline migrated the broker portal to Secrets Manager
  //      but kept the legacy migration credential as a "fallback in
  //      case Secrets Manager lookup fails" that nobody removed.
  //   3. An `audit_log` with a single anomalous entry: an
  //      unauthorized schema-enumeration query on 2026-05-20 02:14
  //      UTC from an unrecorded source IP (Coverline's RDS audit
  //      logging is basic-only, missing source-IP capture — its own
  //      finding worth surfacing).
  //   4. A `users` table with a terminated former employee
  //      (vikram.shah, rolled off Q1 2024 per the level0 migration
  //      script's comment) whose DB account is dormant but not
  //      deleted.
  //
  // Lesson: credentials in DB row values are the same anti-pattern
  // as credentials in source-control files. CWE-798 + CWE-540 +
  // CWE-312. T1078 + T1213 + T1552.001 (DB rows as the credentials-
  // in-files analog). SOC 2 CC6.1/CC6.2/CC6.6/CC7.1 +
  // NIST SP 800-53 Rev. 5 IA-5(7) + NAIC §4.D/§6 + NYDFS 500.7/500.17
  // + GLBA Safeguards 314.4(c)(4)/314.5. AWS Secrets Manager +
  // Database Activity Streams + GuardDuty RDS Protection +
  // IAM Database Authentication as the proper alternatives.
  // Introduces `psql`.
  "level1@cloud": {
    password: "Cl41ms-Pr0d-M4st3r-2024",
    track: "cloud",
    title: "The migration table (psql)",
    estimatedMinutes: 20,
    playerUser: "cloudsec",
    objective: "Enumerate the coverline_claims production database with the leaked RDS master credential. Identify any other credentials stored in row data, dormant employee accounts, or anomalous audit-log entries that change the breach-notification math. Read-only audit only — no INSERT/UPDATE/DELETE.",
    lesson: "After Friday's S3 finding closed the CC6.1 control gap, Coverline's CISO (Sloane Becker) + GC + outside counsel spent the weekend on the breach-notification math. The leaked RDS master credential (Cl41ms-Pr0d-M4st3r-2024) is rotation-pending; before they rotate, Sloane wants Driftwood to enumerate what's actually in the database — every abandoned migration artifact, every dormant employee account, every credential stashed in row data — so the notification analysis can cover the full secondary-exposure surface. Jordan Nguyen authorized the follow-on engagement Monday morning and pre-staged the leaked credential in `~/.pgpass` on Coverline's cloud-audit bastion host (the shell you're on now). Read welcome.md first — it explains the new `psql` command. Then read engagement-notes.md and bastion-handoff.txt. Walk the coverline_claims schema with `psql`. Read lessons-learned.md once you've surfaced the findings.",

    // v1.10.0 BONUS FINDS — surfaces the ttl_expires_at column
    // pattern in migration_artifacts (designed-right, enforcement-
    // never-shipped). Orthogonal to the credentials-in-rows finding;
    // doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "ttl-without-enforcement",
        name: "TTL columns without enforcement",
        hint: "`migration_artifacts` was designed RIGHT — a `ttl_expires_at` column on every row, with Q2 2024 deletion intent. The design acknowledged the risk. What failed was enforcement: no cron, no deployment-pipeline check, no quarterly review actually reads the TTL column and deletes expired rows. Documented intent is not a control; an automated job that reads the same column and acts on it is.",
        trigger: { command: "psql", argMatches: /migration_artifacts/, outputContains: "ttl_expires_at" },
      },
    ],
    postgres: {
      defaultDb: "coverline_claims",
      connection: {
        host: "coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com",
        user: "coverline_admin",
      },
      databases: {
        coverline_claims: {
          tables: {
            claims: {
              columns: ["claim_id", "policy_number", "claimant_name", "ssn_last4", "status", "claim_amount_usd", "created_at"],
              rows: [
                ["CL-019823", "CV-SB-2023-87432", "Marcus Reyes",  "1847", "under_review",             42500, "2024-03-15"],
                ["CL-019824", "CV-SB-2022-41187", "Aisha Patel",   "3392", "approved_pending_payment", 18750, "2024-03-15"],
                ["CL-019825", "CV-SB-2024-11042", "Dmitri Volkov", "9981", "under_review",             64800, "2024-03-15"],
                ["CL-019826", "CV-SB-2024-11043", "Joon Park",     "2114", "paid",                     12300, "2024-03-16"],
                ["CL-019827", "CV-SB-2023-99821", "Hannah Liu",    "7732", "denied",                    8950, "2024-03-16"],
              ],
            },
            customers: {
              columns: ["customer_id", "business_name", "email", "state", "policies_count", "signup_date"],
              rows: [
                ["CUS-00001", "Reyes Consulting LLC",    "marcus.reyes.consulting@example.com", "CT", 1, "2023-04-12"],
                ["CUS-00002", "Patel Logistics Inc.",    "a.patel@example.com",                 "CT", 2, "2022-08-09"],
                ["CUS-00003", "Volkov Construction LLC", "dvolkov.work@example.com",            "CT", 3, "2024-01-15"],
                ["CUS-00004", "Park Bakery Co",          "joon.park@example.com",               "CT", 1, "2024-02-01"],
                ["CUS-00005", "Liu Strategy Partners",   "hannah.liu@example.com",              "CT", 1, "2023-11-20"],
              ],
            },
            policies: {
              columns: ["policy_number", "customer_id", "policy_type", "annual_premium_usd", "effective_date"],
              rows: [
                ["CV-SB-2023-87432", "CUS-00001", "general_liability",    2400, "2023-04-12"],
                ["CV-SB-2022-41187", "CUS-00002", "commercial_auto",      4800, "2022-08-09"],
                ["CV-SB-2024-11042", "CUS-00003", "workers_compensation", 8200, "2024-01-15"],
                ["CV-SB-2024-11043", "CUS-00004", "business_owners",      1800, "2024-02-01"],
                ["CV-SB-2023-99821", "CUS-00005", "general_liability",    2200, "2023-11-20"],
              ],
            },
            adjusters: {
              columns: ["adjuster_id", "name", "email", "region", "hired_at"],
              rows: [
                ["ADJ-001", "Kim Chen",       "kim.chen@coverline-insurance.com",       "Northeast",    "2022-06-15"],
                ["ADJ-002", "Sarah Mitchell", "sarah.mitchell@coverline-insurance.com", "Northeast",    "2023-09-08"],
                ["ADJ-003", "James Okafor",   "james.okafor@coverline-insurance.com",   "Mid-Atlantic", "2021-11-02"],
              ],
            },
            integrations: {
              columns: ["integration_id", "service_name", "api_endpoint", "status", "credential_ref", "updated_at"],
              rows: [
                ["INT-001", "naic-data-exchange", "https://api.naic.org/data-exchange/v2/",            "active",   "secrets-manager:naic-api-prod",         "2026-04-15"],
                ["INT-002", "broker-portal",      "https://brokers.coverline-insurance.com/api/v1/",   "active",   "secrets-manager:broker-portal-prod",    "2026-05-10"],
                ["INT-003", "mailchimp",          "https://us21.api.mailchimp.com/3.0/",               "active",   "secrets-manager:marketing-mailchimp",   "2026-03-20"],
                ["INT-004", "stripe-payments",    "https://api.stripe.com/v1/",                        "active",   "secrets-manager:stripe-payments-prod",  "2026-05-01"],
                ["INT-005", "polaris-payroll",    "(deprecated 2025-Q4 vendor change)",                "inactive", "secrets-manager:polaris-payroll-LEGACY","2025-12-01"],
              ],
            },
            migration_artifacts: {
              columns: ["id", "artifact_type", "artifact_name", "credential_value", "notes", "created_at", "ttl_expires_at"],
              rows: [
                [1, "service_account_password", "rds-migration-runner", "rds-mig-2024-svc-Tmp9pQ7rT",       "Service account for RDS Aurora us-east-1 -> us-east-2 migration. Used by vikram.shah's deploy pipeline. Delete after Q2 2024 once cutover is verified.",                                                "2024-02-15", "2024-06-30"],
                [2, "broker_portal_credential", "broker-portal-svc",    "Cv-BrokerSvc-Pr0d-2024-Migration", "Used to seed broker-portal service accounts during data backfill phase of the migration. Migrate consumers to Secrets Manager and delete after broker reconciliation completes (target Q2 2024).", "2024-02-15", "2024-06-30"],
                [3, "sftp_naic_handoff",        "naic-sftp-handoff",    "naic-handoff-2024-Q1-7Kp9",        "One-time SFTP credential for NAIC quarterly data handoff cutover. Rotated 2024-04-15 per NAIC quarterly schedule; this row is historical only.",                                                "2024-02-15", "2024-04-15"],
              ],
            },
            users: {
              columns: ["user_id", "username", "email", "role", "status", "last_login"],
              rows: [
                ["USR-001", "kim.chen",        "kim.chen@coverline-insurance.com",        "adjuster",       "active",     "2026-05-22 09:14:08"],
                ["USR-002", "sarah.mitchell",  "sarah.mitchell@coverline-insurance.com",  "adjuster",       "active",     "2026-05-22 11:42:31"],
                ["USR-003", "james.okafor",    "james.okafor@coverline-insurance.com",    "adjuster",       "active",     "2026-05-21 16:08:55"],
                ["USR-004", "vikram.shah",     "vikram.shah@coverline-insurance.com",     "senior_devops",  "terminated", "2024-01-31 18:22:14"],
                ["USR-005", "jordan.nguyen",   "jordan.nguyen@coverline-insurance.com",   "director",       "active",     "2026-05-22 14:55:18"],
                ["USR-006", "coverline_admin", "rds-admin@no-email",                      "rds_master",     "active",     "2026-05-20 02:14:42"],
              ],
            },
            audit_log: {
              columns: ["event_id", "event_type", "actor", "target", "timestamp"],
              rows: [
                ["EVT-1029401", "claim_status_changed",       "kim.chen@coverline-insurance.com",         "CL-019824",            "2024-03-15 14:22:08"],
                ["EVT-1029402", "policy_renewed",             "system",                                   "CV-SB-2022-41187",     "2024-03-16 02:00:00"],
                ["EVT-1029403", "schema_query_pg_catalog",    "coverline_admin (unrecognized source)",   "pg_catalog.pg_tables", "2026-05-20 02:14:42"],
              ],
            },
          },
        },
        coverline_billing: { tables: {} },
        postgres:  { tables: {} },
        template0: { tables: {} },
        template1: { tables: {} },
      },
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Cloud Audit Workstation ───────────────

Still \`cloudsec\`, but you're no longer on Driftwood's local
workstation — your shell is on Coverline's cloud-audit bastion
host (\`jumpbox-cloud-audit.coverline-internal\`). Jordan Nguyen
authorized the move Monday morning so Driftwood could run psql
against Coverline's RDS cluster from inside Coverline's VPC,
where the security group allows it. The bastion's \`~/.pgpass\`
is pre-staged with the credential you used to enter this shell;
psql resolves the connection automatically.

Day two of the Coverline engagement. Friday's S3 audit closed
the CC6.1 control gap, but it surfaced a hardcoded RDS master
credential in the public bucket. Coverline's CISO + GC + outside
counsel spent the weekend on the breach-notification math.
Before they rotate the credential, Sloane wants the DB enumerated
to identify any secondary exposures — other credentials, dormant
accounts, anomalous activity. That's today's task.


─── NEW COMMAND ───────────────────────────────────────────────

  psql                              Usage
  psql --version                    psql version string
  psql "\\l"                         List databases
  psql -d <db> "\\dt"                List tables in <db>
  psql -d <db> "SELECT * FROM <table>"
                                    Read every row
  psql -d <db> "SELECT * FROM <table> LIMIT N"
                                    First N rows
  psql -d <db> "SELECT <cols> FROM <table>"
                                    Specific columns
  psql -c "<SQL>"                   Same as positional SQL
  psql -h <host> -U <user> -d <db>  Explicit conn (host/user are
                                    ignored — engine uses the
                                    bastion's pre-configured
                                    connection)


─── WHAT psql REVEALS ─────────────────────────────────────────

When a database master credential leaks, the immediate question
for any IR engagement is: what does the credential open, and
what's inside? Databases are the highest-value target on most
networks — they hold customer records, business state, audit
history, and (often) other credentials that the application
stack stashed "temporarily" during some prior migration.

The standard enumeration pattern:

  1. \`\\l\` — list databases. Confirms the connection and shows
     the multi-tenant scope (some clusters host one database;
     some host many).
  2. \`\\dt\` — list tables in a database. Schema surface =
     roadmap of what's in there.
  3. \`SELECT * FROM <table>\` for each interesting table.

Tables worth always looking at:
  - \`users\` / \`accounts\` — terminated employees with active
    DB credentials, dormant service accounts, role drift.
  - \`integrations\` / \`api_keys\` / \`config\` — credentials
    cached in schema rows (the anti-pattern).
  - \`audit_log\` / \`events\` — historical access patterns,
    looking for anomalies (off-hour activity, schema
    enumeration queries, unusual actors).
  - Anything named \`*_migration\`, \`*_legacy\`, \`*_temp\`,
    \`*_backup\`, \`*_artifact\` — these accumulate cruft
    from deployment cycles and rarely get cleaned up.

Defensive controls Coverline should have (and partially does):
  - AWS Secrets Manager + automatic rotation (RDS first-class
    integration; rotation can be hands-off)
  - AWS Systems Manager Parameter Store + KMS encryption
  - IAM Database Authentication (no static password at all;
    principals authenticate via short-lived IAM tokens)
  - AWS GuardDuty RDS Protection (anomalous DB auth patterns)
  - AWS Database Activity Streams (real-time per-query audit)
  - HashiCorp Vault for multi-cloud / on-prem secret stores


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Coverline update + scope addendum
  2.  cat bastion-handoff.txt     Jordan's connection brief
  3.  psql "\\l"                   List databases. Confirms the
                                  connection and shows what's
                                  hosted on this cluster.
  4.  psql -d coverline_claims "\\dt"
                                  See the schema surface.
  5.  psql -d coverline_claims "SELECT * FROM <table>"
                                  Walk the tables. One of them
                                  is named after what it holds.
  6.  cat lessons-learned.md      Post-mortem (after step 5)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Coverline Insurance — engagement notes (continued)

Client: Coverline Insurance (SOC 2 Type II + NAIC + NYDFS + GLBA)
Case ID: DW-CLOUD-COV-2026-008-FOLLOWUP-A (continuation of the
         Friday S3 audit, DW-CLOUD-COV-2026-008)
Driftwood handler: Priya
Client counterpart: Jordan Nguyen (Sr. Director, Cloud
                    Infrastructure & Platform); Sloane Becker
                    (CISO); outside counsel via Sloane

## What happened since the last task

Friday afternoon 2026-05-22: We delivered the S3 audit findings
to Jordan and to the audit firm. The deviation row
(\`coverline-claims-uploads-prod\`) was real and material —
three Q1 2024 claim files with claimant NPI plus a 2023
migration script (\`legacy-deploy/migrate-rds.sh\`) with a
hardcoded RDS master credential. The audit firm logged the
finding; Coverline's containment kicked in within the hour.

Friday evening 2026-05-22 16:42 ET: Bucket containment
completed. Public Access Block enabled at the bucket level,
bucket policy updated to deny all principals except the
claims-app role. S3 server-access logs and CloudTrail data
events pulled for the period 2023-11-08 (bucket creation date
for the migration artifacts) through 2026-05-22 16:42 ET (when
the bucket was locked down). That's ~30 months of potential
exposure window for analysis.

Saturday morning: Sloane convened the IR triage call. Jordan,
the in-house GC, outside counsel. Question on the table: what's
the breach-notification math, and what's the appropriate scope
of disclosure under NAIC §6, NYDFS 500.17, GLBA Safeguards
notification, and the state-by-state breach laws.

Sunday: Outside counsel asked for "everything the leaked
credential opens" before agreeing on the notification scope.
If the database itself contains other credentials or other PII
surfaces gated by the master credential, the notification
analysis has to cover those secondary exposures too. That
question requires walking the database.

Monday morning 2026-05-25: Jordan signed authorization for the
follow-on engagement (DW-CLOUD-COV-2026-008-FOLLOWUP-A) and
pre-staged the leaked credential in a \`~/.pgpass\` file on the
cloud-audit bastion host. RDS master credential rotation is
queued in Coverline's change-management system, scheduled for
execution as soon as the enumeration completes.

## Scope for this engagement

Sloane wants three things by COB Tuesday:

  1. The list of tables in the production claims database
     (\`coverline_claims\`) with row counts and a one-line
     description of what each table holds.

  2. Any credentials, API keys, or secrets stored in database
     row values (the "we'll move it to Secrets Manager later"
     anti-pattern). If found, document the credential type,
     where it lives, and a recommended remediation timeline.

  3. Any audit-log entries during the exposure window
     (2023-11-08 through 2026-05-22) that look anomalous —
     unexpected logins, schema-enumeration queries, off-hour
     activity. This is the data Sloane needs to determine
     whether the leaked credential was actually used by an
     unauthorized party.

## A note from Priya

The bastion's pgpass is pre-staged with the leaked credential.
The credential will be rotated within hours of your findings
report. While it's live, do NOT run any modification queries —
INSERT / UPDATE / DELETE / DROP / ALTER are all out of scope
and would compromise the chain of custody on Coverline's
evidence collection.

The interesting table is named after what it holds. You'll
recognize it when you see it. Don't get lost reading the
claims / customers / policies / adjusters tables for too long
— they're useful background but the actionable finding is
elsewhere.

If you find the category of credentials I'm expecting you'll
find, the next-engagement credential is in there too — the
broker-portal service credential, which Coverline migrated to
Secrets Manager last year but kept the legacy migration-era
copy as a "fallback in case Secrets Manager lookup fails."
That fallback never gets removed because removing it requires
the broker-portal team to confirm Secrets Manager is fully
load-bearing, and that confirmation never happens. Surface it.

— Priya`
        },

        "bastion-handoff.txt": {
          type: "file",
          content:
`COVERLINE INSURANCE — BASTION-HOST IR-AUDIT CONNECTION DETAILS
Issued by:        Jordan Nguyen (Sr. Director, Cloud Infrastructure)
Date:             2026-05-25 08:00 ET (Monday)
Coverline ref:    COV-SOC2-2026-EVID-014-FOLLOWUP-A
Driftwood ref:    DW-CLOUD-COV-2026-008-FOLLOWUP-A

PRIOR FINDING (FRIDAY)
─────────────────────────────────────────────────────────────
  S3 audit DW-CLOUD-COV-2026-008 closed the CC6.1 control gap
  by walking the 6 worksheet buckets. One bucket
  (\`coverline-claims-uploads-prod\`) was unexpectedly public,
  containing 3 Q1 2024 claim files with claimant PII AND a
  2023 migration script (\`legacy-deploy/migrate-rds.sh\`) with
  a hardcoded RDS master password:

      Cl41ms-Pr0d-M4st3r-2024

  Status: bucket made private 2026-05-22 16:42 ET. S3 access
  logs pulled and being analyzed. RDS master credential
  rotation pending the enumeration work below.

THIS ENGAGEMENT (TODAY)
─────────────────────────────────────────────────────────────
  Before the credential is rotated, Coverline needs to know
  what's IN the database. Specifically:

    1. Whether any OTHER credentials are stashed in database
       rows (the universal "we'll move this to Secrets Manager
       later" anti-pattern).
    2. Whether the audit log shows any anomalous access during
       the exposure window. The 2023 migration script has been
       in the public bucket since 2023-11-08; the credential
       has been recoverable from that bucket since then.
    3. Any other abandoned-artifact categories — temporary
       tables, sandbox schemas, backup copies — that expand
       the exposure beyond the master credential itself.

  Sloane + Jordan + outside counsel are using this enumeration
  to inform the breach-notification math: what to disclose, to
  whom, and on what timeline.

CONNECTION DETAILS
─────────────────────────────────────────────────────────────
  Bastion host:     jumpbox-cloud-audit.coverline-internal
                    (you're already on it — this shell)
  PSQL config:      ~/.pgpass pre-populated with the leaked
                    credential. The \`psql\` command on this
                    host resolves the connection automatically;
                    you don't need to pass -h / -U.
  Target cluster:   coverline-prod.cluster-xyz.us-east-2.rds.amazonaws.com
  Master user:      coverline_admin
  Master password:  Cl41ms-Pr0d-M4st3r-2024 (the leaked one;
                    will be rotated immediately after enum
                    completes)
  Default DB:       coverline_claims

  Other databases visible from this user:
                    coverline_billing (not in scope today —
                    focus on coverline_claims)

PROCEDURE
─────────────────────────────────────────────────────────────
  1. Confirm the connection: \`psql "\\l"\` — should list ~5
     databases (the two Coverline DBs plus the PostgreSQL
     system DBs).
  2. List tables in coverline_claims:
     \`psql -d coverline_claims "\\dt"\`
  3. Read each table:
     \`psql -d coverline_claims "SELECT * FROM <table>"\`
  4. Document any credentials found in row data, any terminated-
     employee accounts still active, any audit-log entries that
     look anomalous.
  5. Surface to Priya for the formal IR report.

DELIVERABLE
─────────────────────────────────────────────────────────────
  Findings memo by COB Tuesday 2026-05-26. Sloane is on the
  call with outside counsel Wednesday morning to decide the
  breach-notification posture.

OUT OF SCOPE
─────────────────────────────────────────────────────────────
  - INSERT / UPDATE / DELETE / DROP / ALTER. Read-only audit.
  - The coverline_billing database (separate engagement if
    needed).
  - Cross-database queries.
  - Any IAM / EC2 / S3 enumeration. This engagement is
    psql-only.

— Jordan Nguyen, on behalf of Sloane Becker (CISO)`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You walked the \`coverline_claims\` database (7 tables) and
found:

  1. Three tables of legitimate operational data — \`claims\`,
     \`customers\`, \`policies\`, \`adjusters\` — containing
     the claimant PII you'd expect for a P&C insurer. Same
     data category as the JSON files exposed in Friday's S3
     finding; the database is the canonical source for them.

  2. An \`integrations\` table showing 5 external service
     integrations, 4 active and 1 deprecated. All five
     reference their credentials via
     \`secrets-manager:<name>\` pointers rather than embedding
     the credential in the row. Coverline IS using AWS Secrets
     Manager for current credential storage; the pattern is
     correct here.

  3. A \`migration_artifacts\` table with 3 rows. THIS is the
     interesting one. Created on 2024-02-15 to park credentials
     temporarily during the us-east-1 → us-east-2 cutover, with
     explicit \`ttl_expires_at\` columns intending deletion by
     Q2 2024. ONE of the three credentials was rotated as
     intended (the NAIC SFTP credential, rotated Q1 2024 per
     the standard quarterly schedule). TWO were not:
       - The RDS migration runner service account
         (\`rds-mig-2024-svc-Tmp9pQ7rT\`).
       - The broker-portal service credential
         (\`Cv-BrokerSvc-Pr0d-2024-Migration\`). This one is
         particularly notable: Coverline migrated the broker-
         portal credential to Secrets Manager last year (see
         the \`integrations\` row for broker-portal pointing
         at \`secrets-manager:broker-portal-prod\`), but the
         legacy migration credential was retained as a
         "fallback in case Secrets Manager lookup fails."
         That fallback was never removed because removing it
         requires the broker-portal team to confirm Secrets
         Manager is fully load-bearing, and that confirmation
         never happens.

  4. An \`audit_log\` with a single anomalous entry:
       EVT-1029403 — schema_query_pg_catalog
       Actor:  coverline_admin (unrecognized source)
       Target: pg_catalog.pg_tables
       When:   2026-05-20 02:14:42 UTC
     The source IP wasn't captured at that timestamp because
     Coverline's RDS audit logging is basic-only (no pgaudit
     extension). This entry suggests someone used the leaked
     credential to enumerate the schema on 2026-05-20, two
     days before Coverline made the bucket private. Cross-
     reference with CloudTrail + VPC Flow Logs to identify
     the source IP.

  5. The \`users\` table shows a terminated former employee
     (\`vikram.shah\`, role \`senior_devops\`, terminated
     2024-01-31) whose DB account is dormant but not deleted.
     Unrelated to Friday's S3 finding directly but is its own
     access-management lapse worth flagging.

This is the second layer of the credential-leak cascade.
Friday's S3 audit found the public bucket and the hardcoded
RDS master credential. Today's psql walk used the master
credential to enumerate the DB and found three more
credentials embedded in database rows, one of which (the
broker-portal credential) is actively in production use as
the legacy fallback for the Secrets Manager-managed primary.
The cascade can continue from there — a level2 engagement
against the broker portal would use that credential.

Your job ends here. The findings memo goes to Priya, who'll
write the formal version that goes to Sloane, Jordan, the
audit firm, outside counsel, and (depending on the breach-
notification determination) the state insurance commissioners
of every state of residence represented in the affected
dataset.


─── THE BLUNT VERSION ────────────────────────────────────────

Credentials stored in database row values are the modern
equivalent of credentials stored in source-control config
files. Different storage medium, identical anti-pattern:

  1. A team needs a credential for a specific task — a
     migration, a one-off backfill, a sandbox load.
  2. The credential is "temporarily" stored in a database
     row instead of going through the proper secret-store
     process, because the proper process feels heavy and
     the deadline is tight.
  3. The task completes. The row is forgotten.
  4. Months or years later, an audit / incident / curiosity-
     driven query surfaces it.

Coverline's \`migration_artifacts\` table is actually
relatively well-designed for the anti-pattern: it has explicit
\`ttl_expires_at\` columns intending deletion. The design
acknowledged the risk. The execution failed — the rows past
their TTL were not actually deleted, because nothing in the
deployment pipeline enforces TTL enforcement, and quarterly
manual review of the table was not on anyone's roadmap.

The broker-portal credential is a particularly nasty subcase
because Coverline DID complete the migration to Secrets
Manager (the \`integrations\` table proves it). But the
legacy migration credential was kept as a fallback, and
"kept as a fallback" became "kept indefinitely" when no
process ever removed it. The same pattern recurs across the
D3CYPH3R credential-chain family — the network/level1 audit-
bypass account, the crypto/level1 JWT handoff_token claim,
the web/level1 BluePier demo account, the forensics/level1
IR-team typed-password, the osint/level1 committed AWS keys.
Different surfaces, identical anti-pattern: a credential
created for a narrow purpose that outlived its narrow purpose.

The defensive controls are well-known:

  - AWS Secrets Manager with automatic rotation enabled.
    RDS has first-class integration; rotation is hands-off
    if you set it up that way.
  - AWS Systems Manager Parameter Store with KMS encryption
    for non-RDS secrets. Cheaper than Secrets Manager, same
    auditability via CloudTrail.
  - HashiCorp Vault for multi-cloud / on-prem.
  - IAM Database Authentication for RDS — eliminates the
    static password entirely; application principals
    authenticate using short-lived IAM tokens.
  - AWS GuardDuty RDS Protection — surfaces anomalous DB
    auth patterns (suspicious source locations, credential
    misuse signals).
  - AWS Database Activity Streams — real-time audit of every
    DB query, including source IP, query text, and result
    row count. Complements RDS audit logs.

The audit-log finding (the 2026-05-20 schema enumeration
from an unrecorded source IP) is also a configuration gap
worth calling out. RDS audit logging supports source-IP
capture when the \`pgaudit\` extension is enabled at full
granularity; Coverline runs basic logging only, which is
why the source IP of the suspicious query isn't in the log.
The fix is enabling pgaudit with the source-IP-capture
settings — small effort, large forensic value.


─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Coverline is SOC 2 Type II + NAIC + NYDFS + GLBA bound. The
findings stack from the two engagements:

  - Friday: S3 misconfiguration + hardcoded credential in
    public bucket. CC6.1 gap.
  - Today: secondary credentials in DB rows, dormant employee
    account, possible unauthorized schema-enumeration query.
    CC6.2 (System User Management) gap; CC7.1 (Detection)
    gap as well.

The breach-notification math now turns on:

  1. Whether the 2026-05-20 02:14:42 UTC schema-enumeration
     query was followed by data exfiltration. The
     \`pg_tables\` query alone is reconnaissance; if
     subsequent queries SELECTed from claims / customers /
     policies, that's a different story. CloudTrail + VPC
     Flow Logs + (if enabled) Database Activity Streams
     together determine this.

  2. Whether the broker-portal migration credential
     (\`Cv-BrokerSvc-Pr0d-2024-Migration\`) was used by any
     unauthorized party to authenticate against the broker
     portal during the credential's exposure window. That's
     the level2-engagement question.

  3. Whether the dormant \`vikram.shah\` account was used by
     any party (legitimate Coverline IT, or anyone else)
     post-termination. Audit question.

The notification timelines in play:

  - NAIC Insurance Data Security Model Law §6: 72 hours from
    determination that NPI has been (or is likely to have
    been) acquired by an unauthorized person.
  - NYDFS 23 NYCRR 500.17(a): 72 hours from a "reasonable
    belief" that nonpublic information was accessed or
    acquired.
  - GLBA Safeguards Rule 16 CFR 314.5 (Notification of
    Security Events): 30 days from discovery for events
    affecting 500+ consumers' information. (FTC amendment
    in effect since May 2024.)
  - State data-breach notification laws: 50 jurisdictions,
    varying timelines.

The notification CLOCK starts at Coverline's determination
moment, not at Driftwood's finding moment. The CISO + GC +
outside counsel triangle determines the start.

For Driftwood, the engagement's value-add is the documented
chain of custody. Every query we ran, every table we read,
every credential we surfaced — recorded against the engagement
file. If the case develops legal weight (insurance-
commissioner enforcement, civil class action, regulatory
fine), Driftwood's documentation supports Coverline's
position that the breach response was procedurally sound.


─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  SOC 2 Trust Services Criteria (2017, refreshed 2022)
    CC6.1  Logical and Physical Access Controls — Coverline's
      policy ("credentials shall not be embedded in source /
      configuration / data rows") exists; the audit evidence
      was the question.
    CC6.2  System User Management — covers user-lifecycle
      management. The dormant vikram.shah account is a CC6.2
      gap.
    CC6.6  Logical access security measures for outside
      threats — the leaked-credential exposure window.
    CC7.1  Detection of security events — the missing pgaudit
      source-IP capture is a CC7.1 gap.

  NIST SP 800-53 Rev. 5
    IA-5(7)  Authenticator Management: No Embedded Unencrypted
      Static Authenticators — the direct control. Database
      rows count as an "embedded location" for this purpose.
    AC-2     Account Management — covers the dormant-account
      lifecycle gap.
    AC-3     Access Enforcement — the credential is the
      access-enforcement mechanism.
    AU-12    Audit Generation — the missing source-IP capture
      is an AU-12 implementation gap.

  NIST Cybersecurity Framework 2.0
    PR.AA  Identity Management, Authentication, and Access
      Control — IA + AC family.
    PR.DS  Data Security.
    DE.CM  Continuous Monitoring — the missing detection
      capability for the 2026-05-20 query.

  CIS AWS Foundations Benchmark v5.0.0
    §1.14  Ensure access keys are rotated every 90 days or
      less — credentials in database rows have effectively
      infinite rotation cadence.
    §2.1.4 / §2.1.5  S3 Block Public Access (the level0
      remediation that's already complete).

  CIS PostgreSQL Benchmark v15 / v16
    §3.x   Audit logging configuration including pgaudit
      setup.
    §5.x   Authentication configuration including IAM
      database authentication.

  CWE
    CWE-798  Use of Hard-Coded Credentials — primary mapping.
      Database rows count as "hard-coded" when the credential
      is stored in cleartext and accessed via fixed lookup.
    CWE-540  Inclusion of Sensitive Information in Source
      Code — applies if you treat DB schema + rows as
      "source" in the broad sense.
    CWE-312  Cleartext Storage of Sensitive Information —
      the credential rows are stored in plaintext varchar
      columns with no application-layer encryption.
    CWE-200  Exposure of Sensitive Information to an
      Unauthorized Actor — umbrella parent (note: mapping-
      Discouraged in current MITRE guidance; cite the more
      specific child CWEs above for direct mappings).

  NAIC Insurance Data Security Model Law (2017)
    §4.D   Information Security Program — including ongoing
      reassessment of risks. Credentials past their TTL in
      a database row are a documented risk factor.
    §5     Investigation of a Cybersecurity Event.
    §6     Notification of a Cybersecurity Event — 72-hour
      clock.

  NYDFS 23 NYCRR 500 (2017, amended 2023)
    500.07   Access Privileges and Management — covers
      credential lifecycle including dormant-account
      remediation.
    500.13   Limitations on data retention — DB rows past
      their stated TTL are a 500.13 violation.
    500.17   Notices to Superintendent — 72-hour clock.

  GLBA Safeguards Rule (16 CFR 314, amended December 2021,
  enforcement effective June 2023; notification amendment
  effective May 2024)
    314.4(c)(4)  Encrypt customer information at rest — the
      broker-portal credential row is unencrypted at rest.
    314.5        Notification of security events affecting
      500+ consumers (30-day clock from discovery).


─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  AWS Certified Security – Specialty (SCS-C03)
    AWS released SCS-C03 in late 2025 / early 2026 as the
    successor to SCS-C02. Domain 1 (Threat Detection and
    Incident Response) and Domain 4 (Identity and Access
    Management) cover Secrets Manager, GuardDuty RDS
    Protection, Database Activity Streams, and IAM database
    authentication.

  AWS Certified Database – Specialty (DBS-C01)
    Retired April 30, 2024. Database-security content was
    folded into Solutions Architect Professional and the
    Security Specialty.

  AWS Certified Solutions Architect (Professional) (SAP-C02)
    Database security as part of the architecture domain.

  ISC2 CCSP (Certified Cloud Security Professional)
    Domain 2 (Cloud Data Security) and Domain 3 (Cloud
    Platform & Infrastructure Security) cover database
    encryption, key management, and secret management.

  CSA CCSK (Certificate of Cloud Security Knowledge) v5
    The CSA Cloud Controls Matrix has multiple controls for
    credential lifecycle (CCM-CEK family).

  GIAC GCPN (Cloud Penetration Tester)
    Tests offensive cloud techniques including DB enumeration
    from leaked credentials.

  GIAC GCDA (Continuous Monitoring & Security Operations
  Analyst)
    Detection-engineering side for the kind of anomalous
    query pattern we found at 2026-05-20 02:14.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 1 (Security Operations)
    covers credential-leak detection and response.

  ISC2 CISSP
    Domain 5 (Identity and Access Management) — credential
    lifecycle, including the user-management gap.

  PostgreSQL-specific: there's no formal vendor cert for
    Postgres administration in the way Oracle has OCP, but
    the EDB (EnterpriseDB) Postgres certifications include
    Postgres security as a topic.


─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  What we just did:

  T1078        Valid Accounts — using the leaked RDS master
               credential to authenticate. Same technique as
               the level0 finding's downstream exposure.
  T1213        Data from Information Repositories — DB
               enumeration as the modern equivalent of
               wiki / SharePoint scrape. Reading the schema,
               the integrations table, the migration_artifacts
               table.
  T1552.001    Unsecured Credentials: Credentials In Files —
               DB rows are not literally "files" but the
               technique's intent (credentials stored in
               unprotected locations accessible via known
               lookup) applies. Some practitioners argue for
               treating DB-row credentials as a separate
               sub-technique; T1552.001 is the closest match
               in current ATT&CK.

  What an adversary would do with the broker-portal
  credential (level2 path):

  T1078        Valid Accounts.
  T1213        Data from Information Repositories — broker
               portal would be the next info-repo.
  T1090        Proxy — if the broker portal mediates access
               to insurance-broker data, lateral movement
               can chain further.


─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. For Coverline today, in priority order:
     - Rotate the RDS master credential IMMEDIATELY
       (\`coverline_admin\`). Sloane's team has the rotation
       queued; this engagement's findings are the green
       light.
     - Rotate the broker-portal migration credential
       (\`Cv-BrokerSvc-Pr0d-2024-Migration\`). Confirm with
       the broker-portal team that the Secrets Manager-
       sourced credential is the only credential the portal
       accepts; remove the legacy fallback. This is the
       level2-engagement entry point — close it before
       anyone outside Coverline enters it.
     - Rotate the RDS migration runner credential
       (\`rds-mig-2024-svc-Tmp9pQ7rT\`). Less urgent because
       the service account is likely defunct, but rotate and
       disable for completeness.
     - DROP the \`migration_artifacts\` table entirely.
       Legitimate purpose ended in Q2 2024. Preserve a
       snapshot in cold storage for evidence retention.
     - Disable / delete the dormant \`vikram.shah\` database
       account.
     - Pull the source IP for the 2026-05-20 02:14 anomalous
       query from CloudTrail + VPC Flow Logs. Sloane's team
       needs this for the breach-notification analysis.
     - Enable pgaudit on the RDS cluster with source-IP
       capture. The configuration gap that made the 2026-
       05-20 finding hard to attribute should not persist.

  2. For Coverline's broader secrets-handling posture, this
     quarter:
     - Audit every production database for credentials stored
       in row values. Targeted SQL queries against columns
       named like \`password\`, \`secret\`, \`credential\`,
       \`token\`, \`key\`, \`api_*\`; entropy-based row-
       content scanners (a custom Lambda is sufficient).
     - Migrate all in-flight credentials to AWS Secrets
       Manager. Enable automatic rotation on every secret.
       Drop the "migration fallback" pattern as architectural
       policy — Secrets Manager is the only source of truth.
     - Adopt IAM Database Authentication for RDS where
       feasible. Application-tier code uses temporary IAM
       tokens rather than long-lived passwords; rotations
       become structural.
     - Enable AWS Database Activity Streams on production
       Aurora clusters (Database Activity Streams supports
       Aurora MySQL/PostgreSQL + RDS for Oracle/SQL Server,
       but not RDS for PostgreSQL/MySQL). Real-time audit of
       every query, with source IP, query text, and result
       row count.
     - Enable AWS GuardDuty RDS Protection — surfaces
       anomalous DB authentication patterns.

  3. For Coverline's user-lifecycle process:
     - The dormant \`vikram.shah\` row is a user-management
       gap. Coverline needs an automated quarterly review
       that flags database accounts whose corresponding HR
       record shows terminated employment. The standard
       SaaS pattern (SCIM-based deprovisioning) doesn't
       extend natively to RDS; a custom Lambda subscribed
       to the HR-system termination event can deactivate
       the RDS account.

  4. For Driftwood's documentation:
     - Every query we ran today, with the timestamp, the
       database, the table queried, and the row count
       returned. The audit trail supports Coverline's
       chain of custody for the breach-notification
       analysis.
     - The findings memo for Sloane should explicitly
       enumerate what we did NOT do (no INSERT / UPDATE /
       DELETE; no cross-DB queries; no IAM enumeration);
       the negative scope is as important as the positive
       findings.

  5. For the longer-arc lesson:
     - Database rows are a credential-storage anti-pattern
       organizations underestimate. The intuition is "the
       database is protected by the application, so row
       contents are safe." That intuition breaks the moment
       any credential that opens the database leaks — at
       which point every credential STORED IN the database
       also leaks.


─── CLOSING THOUGHT ──────────────────────────────────────────

The two findings on this case — Friday's public S3 bucket
with the hardcoded RDS credential, today's broker-portal
credential and dormant employee account in the database —
are the same finding twice. Both are about credentials that
were created for a specific narrow purpose and survived past
that purpose because no process actively removes them. The
mechanism that creates these credentials is well-known and
documented in every SDLC framework. The mechanism that
cleans them up... mostly isn't.

What separates an organization that gets through this kind
of finding cleanly from one that gets through it badly is
not the technical sophistication of the controls. Both
Coverline and a hypothetical worse-positioned org could
catch this with the same AWS-native tools (Macie, GuardDuty,
Secrets Manager, Database Activity Streams). What separates
them is whether someone actually owns "production secrets
lifecycle" as a continuous responsibility, the way someone
owns "production database availability" or "production deploy
pipeline health." When secrets lifecycle is a quarterly audit
deliverable instead of a continuous ownership, the failure
mode is always "the migration script that nobody got back to."

For Coverline specifically: this week's incident produces a
budget line for next quarter — Secrets Manager rollout across
every production credential surface, Database Activity Streams
on every production RDS cluster, GuardDuty RDS Protection
enabled, automated user-lifecycle deprovisioning, and
quarterly automated review of database tables for
credential-shaped row contents. That budget line is the price
of avoiding the next version of this same finding in 2027.

The forensic finding is small. The system around it is what
makes it actionable.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
