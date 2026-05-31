# level1@cloud — The Migration Table Nobody Dropped

**Track:** Cloud · **Client:** Coverline Insurance · **Compliance regime:** SOC 2 Type II + NAIC Insurance Data Security Model Law + NYDFS 23 NYCRR 500 + GLBA Safeguards Rule (16 CFR Part 314) · **Builds on:** [`level0@cloud`](/walkthroughs/#/cloud/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@cloud`. If you haven't solved `level1@cloud` yet, close this tab and come back after. The puzzle rewards walking the schema in order and noticing which row in which table actually matters; reading the writeup first removes the moment.

---

## §1 — The setup

When the lobby spun you out of `level0@cloud` last Friday afternoon, Coverline Insurance had a clean SOC 2 audit deliverable on its desk — five rows of "MATCHES EXPECTATION" and one row of "DEVIATION — see finding memo." The deviation was `coverline-claims-uploads-prod`: a bucket the worksheet said was private, the unauthenticated probe said wasn't, and the contents said held three Q1 2024 claim files with NPI plus a 2023 region-cutover migration script with a hardcoded RDS master password (`Cl41ms-Pr0d-M4st3r-2024`). Containment happened within the hour — bucket Public Access Block enabled, bucket policy updated to deny all principals except the claims-app role, S3 server-access logs and CloudTrail data events pulled for the full ~30-month exposure window from bucket creation through Friday 16:42 ET.

Containment closed the gap; it didn't close the question. Coverline's CISO (Sloane Becker) convened the IR triage call Saturday morning with Jordan Nguyen (Sr. Director, Cloud Infrastructure), the in-house GC, and Coverline's outside counsel. The question on the table was the breach-notification math: what to disclose, to whom, on what timeline. NAIC §6, NYDFS 23 NYCRR 500.17(a), the GLBA Safeguards 16 CFR 314.5 notification provision (effective May 2024 for events affecting 500+ consumers), and the 50-state breach-notification patchwork all key off the same triggering determination — that NPI was accessed or acquired by an unauthorized person, or that there's a reasonable belief it was. The determination clock is Coverline's to start; the notification clocks tick from there.

Outside counsel's pull-string by Sunday afternoon was specific: before the RDS master credential gets rotated, Driftwood enumerates the database. If the master credential opens secondary credentials stashed in row data — the universal "we'll move it to Secrets Manager later" anti-pattern — those secondary credentials extend the exposure window and the notification scope. If the database contains records of unauthorized access during the exposure window, that's the determination-trigger right there. If anything else suggests the breach is bigger than "three Q1 2024 claims + a credential to one production database," counsel wants to know before the notifications go out, not after.

Jordan signed authorization Monday morning. Engagement reference number: `DW-CLOUD-COV-2026-008-FOLLOWUP-A` (continuation of the Friday S3 audit `DW-CLOUD-COV-2026-008`). The leaked credential was pre-staged in a `~/.pgpass` file on Coverline's cloud-audit bastion host (`jumpbox-cloud-audit.coverline-internal`) — that's the shell you SSH into when you enter `level1@cloud`. The bastion has VPC peering to the production RDS cluster, so the security group permits the connection from there even though Coverline's RDS isn't reachable from the open internet. `psql` is pre-installed; the pgpass takes care of the credential plumbing; you provide only the SQL.

You're back as `cloudsec` — same Driftwood service account, same engagement file, different physical workstation (the bastion replaces the local cloud-audit machine for this engagement so the queries route through Coverline's audit-logged path rather than the open internet). The legal frame is unchanged: SOC 2 Type II in active fieldwork, NAIC Model Law applicable across the ~25 states Coverline operates in, NYDFS applicable because Coverline is licensed in New York, GLBA Safeguards applicable because insurance is a Title V financial activity. What's new today is the urgency: every query you run informs the breach-notification math, which has 72-hour and 30-day clocks attached depending on the jurisdiction, all keyed to Coverline's discovery moment, which is this engagement's findings memo.

The interesting table is one Coverline created for legitimate operational reasons — a 2024 region-cutover migration needed somewhere to park credentials temporarily while the new region's services came online. The table has `ttl_expires_at` columns intending Q2 2024 cleanup. The design acknowledged the risk; the execution failed. That table is where the broker-portal credential lives, and that broker-portal credential is the level2 breadcrumb.

## §2 — The solve

The puzzle path is short and rewards reading the schema in order rather than guessing.

### Step 1: Enter the bastion

```bash
guest@d3cyph3r:~$ ssh level1@cloud
level1@cloud's password: Cl41ms-Pr0d-M4st3r-2024
Connected: level1@cloud
cloudsec@cloud:~$ whoami
cloudsec
```

You used the credential exposed in Friday's `migrate-rds.sh` script. Same credential Coverline is about to rotate. While it's live, the bastion's `~/.pgpass` resolves it automatically for any `psql` invocation — you don't need to pass `-h` or `-U` on the command line.

### Step 2: Read the four engagement files

```bash
cloudsec@cloud:~$ ls
bastion-handoff.txt   lessons-learned.md
engagement-notes.md   welcome.md
```

`welcome.md` introduces the new `psql` command, explains the three meta-commands (`\l`, `\dt`, `\d`) and the SELECT patterns supported, and lays out the workflow. `engagement-notes.md` is Priya's update with what happened between Friday's finding and Monday morning — the IR triage call, outside counsel's pull-string, the scope addendum. `bastion-handoff.txt` is Jordan's connection brief with the cluster endpoint, the explicit out-of-scope reminders (no INSERT/UPDATE/DELETE/DROP/ALTER, no `coverline_billing` cross-DB queries, no IAM enumeration), and the deliverable deadline (COB Tuesday).

### Step 3: Confirm the connection

```bash
cloudsec@cloud:~$ psql --version
psql (PostgreSQL) 15.4
cloudsec@cloud:~$ psql "\l"
                  List of databases
       Name        |      Owner      | Encoding
-------------------+-----------------+----------
 coverline_claims  | coverline_admin | UTF8
 coverline_billing | coverline_admin | UTF8
 postgres          | rdsadmin        | UTF8
 template0         | rdsadmin        | UTF8
 template1         | rdsadmin        | UTF8

(5 rows)
```

Five databases on the cluster. Two Coverline application databases (`coverline_claims` and `coverline_billing`) and three PostgreSQL system databases (`postgres`, `template0`, `template1` — standard on any RDS PostgreSQL cluster). The bastion-handoff brief scopes today's work to `coverline_claims` only; `coverline_billing` is a separate engagement.

### Step 4: List tables in coverline_claims

```bash
cloudsec@cloud:~$ psql -d coverline_claims "\dt"
            List of relations
 Schema |        Name         | Type  |      Owner
--------+---------------------+-------+-----------------
 public | adjusters           | table | coverline_admin
 public | audit_log           | table | coverline_admin
 public | claims              | table | coverline_admin
 public | customers           | table | coverline_admin
 public | integrations        | table | coverline_admin
 public | migration_artifacts | table | coverline_admin
 public | policies            | table | coverline_admin
 public | users               | table | coverline_admin

(8 rows)
```

Eight tables. The obvious operational ones — `claims`, `customers`, `policies`, `adjusters` — are the canonical source for the data exposed in Friday's S3 finding. Worth reading once to confirm the data category but not where the actionable findings live.

The interesting ones for today are `integrations` (covers the credential-handling pattern Coverline uses for active integrations), `migration_artifacts` (the table whose name is a tell), `users` (account-lifecycle audit surface), and `audit_log` (historical-activity surface).

### Step 5: Read `integrations` first — establishes Coverline's baseline

```bash
cloudsec@cloud:~$ psql -d coverline_claims "SELECT * FROM integrations"
 integration_id |    service_name    |                  api_endpoint                  |  status  |           credential_ref            | updated_at
----------------+--------------------+------------------------------------------------+----------+-------------------------------------+------------
 INT-001        | naic-data-exchange | https://api.naic.org/data-exchange/v2/         | active   | secrets-manager:naic-api-prod       | 2026-04-15
 INT-002        | broker-portal      | https://brokers.coverline-insurance.com/api/v1/| active   | secrets-manager:broker-portal-prod  | 2026-05-10
 INT-003        | mailchimp          | https://us21.api.mailchimp.com/3.0/            | active   | secrets-manager:marketing-mailchimp | 2026-03-20
 INT-004        | stripe-payments    | https://api.stripe.com/v1/                     | active   | secrets-manager:stripe-payments-prod| 2026-05-01
 INT-005        | polaris-payroll    | (deprecated 2025-Q4 vendor change)             | inactive | secrets-manager:polaris-payroll-LEGACY | 2025-12-01

(5 rows)
```

Two things matter here. **First**, every active integration references its credentials via `secrets-manager:<name>` pointers rather than embedding the credential in the row. Coverline IS using AWS Secrets Manager for current credential storage. The pattern is correct; the table is well-designed.

**Second**, integration INT-002 (broker-portal) points at `secrets-manager:broker-portal-prod`. Remember that name — it will become important in the next table.

### Step 6: Read `migration_artifacts` — the smoking gun

```bash
cloudsec@cloud:~$ psql -d coverline_claims "SELECT * FROM migration_artifacts"
 id |       artifact_type        |     artifact_name      |        credential_value         |                                              notes                                              | created_at | ttl_expires_at
----+----------------------------+------------------------+---------------------------------+-------------------------------------------------------------------------------------------------+------------+----------------
  1 | service_account_password   | rds-migration-runner   | rds-mig-2024-svc-Tmp9pQ7rT      | Service account for RDS Aurora us-east-1 -> us-east-2 migration. Used by vikram.shah's deploy pipeline. Delete after Q2 2024 once cutover is verified.                                                                                                              | 2024-02-15 | 2024-06-30
  2 | broker_portal_credential   | broker-portal-svc      | Cv-BrokerSvc-Pr0d-2024-Migration| Used to seed broker-portal service accounts during data backfill phase of the migration. Migrate consumers to Secrets Manager and delete after broker reconciliation completes (target Q2 2024).                                                                  | 2024-02-15 | 2024-06-30
  3 | sftp_naic_handoff          | naic-sftp-handoff      | naic-handoff-2024-Q1-7Kp9       | One-time SFTP credential for NAIC quarterly data handoff cutover. Rotated 2024-04-15 per NAIC quarterly schedule; this row is historical only.                                                                                                                    | 2024-02-15 | 2024-04-15

(3 rows)
```

Three rows. Read the `notes` column on each.

**Row 1** — `rds-migration-runner`: A service-account password used by Vikram Shah's deploy pipeline during the region cutover. TTL says Q2 2024 deletion. The cutover completed in late 2023 (per Friday's `migrate-rds.sh` comment); the deploy pipeline's service account presumably isn't running today. But the credential is still in the row, the TTL date passed eighteen months ago, and there's no evidence anyone went back to clean up. Vikram is the senior DevOps engineer who rolled off Coverline in Q1 2024 (also per Friday's script comment).

**Row 2** — `broker-portal-svc`: This is the one. Read the notes column carefully. The credential was created to seed broker-portal service accounts during the data-backfill phase of the 2024 migration. The instruction in the notes says: "Migrate consumers to Secrets Manager and delete after broker reconciliation completes (target Q2 2024)." Cross-reference with what `integrations` table row INT-002 just told us: broker-portal IS using Secrets Manager (`secrets-manager:broker-portal-prod`). The first half of the instruction was completed. The second half (delete the legacy credential) was not. The broker-portal team most likely kept the migration-era credential as a "fallback in case Secrets Manager lookup fails" pattern — a fallback that gets retained because removing it requires confirming Secrets Manager is fully load-bearing, and that confirmation never gets scheduled.

The credential is `Cv-BrokerSvc-Pr0d-2024-Migration`. That string is the level2 breadcrumb. In the in-game continuation, a follow-on engagement would use it to authenticate against the broker portal (`https://brokers.coverline-insurance.com/api/v1/`) and enumerate what's there.

**Row 3** — `naic-sftp-handoff`: A one-time SFTP credential for the NAIC quarterly data handoff cutover. The notes say "Rotated 2024-04-15 per NAIC quarterly schedule; this row is historical only." This one is properly handled — the credential was rotated on schedule, the row in `migration_artifacts` is historical (the actual rotation happened in the upstream system; the row content is no longer the live credential). Good behavior on Coverline's part. Worth flagging in the report as "this is what the cleanup pattern should look like for rows 1 and 2."

### Step 7: Read `users` — the dormant-account finding

```bash
cloudsec@cloud:~$ psql -d coverline_claims "SELECT * FROM users"
 user_id |    username     |                  email                   |     role      |   status   |     last_login
---------+-----------------+------------------------------------------+---------------+------------+---------------------
 USR-001 | kim.chen        | kim.chen@coverline-insurance.com         | adjuster      | active     | 2026-05-22 09:14:08
 USR-002 | sarah.mitchell  | sarah.mitchell@coverline-insurance.com   | adjuster      | active     | 2026-05-22 11:42:31
 USR-003 | james.okafor    | james.okafor@coverline-insurance.com     | adjuster      | active     | 2026-05-21 16:08:55
 USR-004 | vikram.shah     | vikram.shah@coverline-insurance.com      | senior_devops | terminated | 2024-01-31 18:22:14
 USR-005 | jordan.nguyen   | jordan.nguyen@coverline-insurance.com    | director      | active     | 2026-05-22 14:55:18
 USR-006 | coverline_admin | rds-admin@no-email                       | rds_master    | active     | 2026-05-20 02:14:42

(6 rows)
```

Two notable rows here.

**USR-004 (vikram.shah)** is terminated as of 2024-01-31 (matching the Friday script's "rolled off Q1 2024" comment), but the database account is still present — status is "terminated" but the row exists in the application's users table, which means the application's authorization logic still has this user's identity to reference. This is a CC6.2 (System User Management) gap: terminated employees' application-tier credentials should be removed, not just marked. The standard SaaS pattern (SCIM-based deprovisioning) doesn't extend natively to RDS; Coverline needs a custom Lambda subscribed to the HR-system termination event to deactivate the RDS account.

**USR-006 (coverline_admin)** is the RDS master account — the one whose credential was leaked. The `last_login` timestamp is **2026-05-20 02:14:42**. Hold that timestamp in mind for the next query.

### Step 8: Read `audit_log` — the maybe-someone-already-used-it finding

```bash
cloudsec@cloud:~$ psql -d coverline_claims "SELECT * FROM audit_log"
  event_id  |        event_type        |                actor                 |        target         |     timestamp
------------+--------------------------+--------------------------------------+-----------------------+---------------------
 EVT-1029401| claim_status_changed     | kim.chen@coverline-insurance.com     | CL-019824             | 2024-03-15 14:22:08
 EVT-1029402| policy_renewed           | system                               | CV-SB-2022-41187      | 2024-03-16 02:00:00
 EVT-1029403| schema_query_pg_catalog  | coverline_admin (unrecognized source)| pg_catalog.pg_tables  | 2026-05-20 02:14:42

(3 rows)
```

Three entries (the audit_log is sparse in this triage-only schema; production has many more). The first two are routine operational events. The third one is the finding.

**EVT-1029403** at 2026-05-20 02:14:42 UTC. The event type is `schema_query_pg_catalog` — a query against `pg_catalog.pg_tables`, which is PostgreSQL's system catalog table that lists every table in the database. This is *exactly* what an attacker does after gaining DB access: enumerate the schema before deciding what to query.

The actor field is `coverline_admin (unrecognized source)`. The `(unrecognized source)` annotation is telling: the application-side audit logger captures the database user (`coverline_admin`) but cannot map the connection back to a recognized internal Coverline source. Coverline's RDS audit logging is configured to "basic" mode, which doesn't include source IP capture; the `pgaudit` extension is not enabled. That's a CC7.1 (Detection of security events) gap that the IR engagement should also flag.

The `last_login` for the `coverline_admin` user in the `users` table — 2026-05-20 02:14:42 — is the **same timestamp**. So someone (Coverline knows their database identity was `coverline_admin`, the RDS master account; doesn't know their source IP or what client they used) logged in at that moment and immediately enumerated the schema. Two days before Coverline made the bucket private. Two days before the credential rotation was queued.

The next step for Coverline's IR team is to correlate this timestamp against:
- **CloudTrail data events** for the RDS cluster, which capture API calls against the cluster (including connection attempts, with source IP if the request came through an AWS-tracked path).
- **VPC Flow Logs** for the subnet hosting the RDS cluster, which capture every connection with source IP.
- **(If they were enabled) Database Activity Streams**, which would capture the SQL query text in real time.

The correlation tells Coverline whether the 2026-05-20 query came from inside Coverline's network (legitimate operations engineer doing late-night maintenance) or from outside (an unauthorized party who got the credential from the public S3 bucket). That correlation is the determination moment for the breach-notification clocks.

### Step 9: The hand-off

The findings memo for Sloane has four components:

1. **Schema summary**: 8 tables in `coverline_claims`, with row counts and one-line descriptions.
2. **Credentials in row data**: two unrotated credentials in `migration_artifacts` (rows 1 and 2). Row 2 (`Cv-BrokerSvc-Pr0d-2024-Migration`) is the broker-portal credential and is the highest-priority remediation — it gates the broker-portal API; legacy fallback to Secrets Manager; should be revoked TODAY along with confirmation from the broker-portal team that Secrets Manager is fully load-bearing. Row 1 (`rds-mig-2024-svc-Tmp9pQ7rT`) is the migration runner service account; lower priority but should also be revoked and the IAM service account behind it disabled.
3. **Dormant account**: `vikram.shah` user row should be deleted from the application's `users` table; the application's identity-resolution logic shouldn't have a terminated employee in its directory.
4. **Possible unauthorized access**: the 2026-05-20 02:14:42 UTC schema-enumeration query is the determination-trigger candidate. Coverline's IR team correlates against CloudTrail + VPC Flow Logs to identify the source IP. If the source IP is not on Coverline's internal subnet or VPN, that's the unauthorized-acquisition moment under NAIC §5/§6 and NYDFS 500.17.

Plus the negative scope: did NOT run any INSERT / UPDATE / DELETE / DROP / ALTER. Did NOT cross-query into `coverline_billing`. Did NOT enumerate IAM / S3 / EC2. The negative scope is as important as the positive findings.

## §3 — The vulnerability

Two vulnerabilities, one finding pattern.

The structural vulnerability is **credentials stored in database row values** — the modern equivalent of credentials in source-control config files, but with a different storage medium and a similar persistence model. The primary CWE mapping is **CWE-798 (Use of Hard-Coded Credentials)**: database rows are functionally "hard-coded" because the credential is stored in a fixed, cleartext location accessible via a known SQL lookup. **CWE-540 (Inclusion of Sensitive Information in Source Code)** applies if you treat the database schema + content as part of the source-controlled application state (which most DevOps practices do — schema migrations live in source, the data accumulates around them). **CWE-312 (Cleartext Storage of Sensitive Information)** applies to the storage form: the `credential_value` column is a plain VARCHAR with no application-layer encryption.

The exposure mechanism that makes this particularly persistent is the credential's lifecycle isolation from its purpose. The credential was created for a specific narrow task (the 2024 region cutover); the task completed; the credential remained in the database because nothing in the deployment pipeline enforces a TTL. The intent was correct — the `ttl_expires_at` column on the `migration_artifacts` table explicitly named the expected cleanup date. The execution failed — no scheduled job actually queries `WHERE ttl_expires_at < NOW()` and drops the rows. The design acknowledged the risk; the implementation didn't close the loop.

The broker-portal credential's sub-pattern is worth a separate callout. Coverline DID migrate the broker-portal credential to Secrets Manager — the `integrations` table proves it. But the legacy migration credential was kept as a "fallback in case Secrets Manager lookup fails." That fallback pattern is structurally durable: removing it requires the broker-portal team to confirm that Secrets Manager is the single source of truth, which requires a deliberate cutover plan and an acceptance moment that nobody schedules. The fallback survives indefinitely. The same pattern shows up across the D3CYPH3R credential-chain family — the network/level1 audit-bypass account that "Tessera Q4 dry-run team forgot to scrub," the crypto/level1 JWT `handoff_token` claim, the web/level1 BluePier demo account, the forensics/level1 IR-team typed-password, the osint/level1 committed AWS keys in personal-pgx-tool. Different storage surfaces, identical anti-pattern.

The second vulnerability is the **detection gap** in Coverline's RDS audit logging. Coverline runs RDS audit logging in "basic" mode, which captures the SQL-user identity but not the source IP. The `pgaudit` extension supports source-IP capture but requires explicit enablement at the cluster parameter-group level. The 2026-05-20 anomalous query landed in the audit log with the user (`coverline_admin`) but not the IP, which is why the engagement's findings memo has to defer the "was this an unauthorized party?" question to CloudTrail + VPC Flow Logs correlation. The fix is one parameter group setting plus enabling `pgaudit.log = 'all'` and `pgaudit.log_client = on`. Five-minute change, large forensic value.

The third, indirectly: the **dormant-account lifecycle gap** in Coverline's application-side `users` table. The `vikram.shah` row has `status: terminated` since 2024-01-31 but the row still exists, which means the application's identity-resolution logic still has the identity. This isn't directly tied to today's exposure — vikram.shah's RDS credentials (if they ever had any) aren't the leaked master credential — but it's a CC6.2 gap that's worth surfacing.

## §4 — Real-world parallels

Database row-value credential leakage is less publicized than source-control credential leakage but happens at comparable rates. A non-exhaustive tour:

**Capital One (March 2019, disclosed July 2019).** The Capital One breach (~106 million records, $80M OCC consent order — the Office of the Comptroller of the Currency was the enforcement agency; FFIEC is the parent interagency council and doesn't issue orders directly) is most famous for the SSRF-into-IMDSv1 entry vector, but the post-compromise lateral movement leveraged credentials stored in S3 bucket configurations and in CloudFormation templates left in source. Paige Thompson was convicted in 2022; the Ninth Circuit vacated her original sentence in March 2025, and November 2025 resentencing imposed time-served plus five years supervised release (three years home confinement) and 250 hours of community service, with the $40.7M restitution preserved. The Capital One Senate testimony cited multiple credential-storage anti-patterns surfacing post-acquisition; the case is a recurring case study in cloud-security curricula precisely because the technical fault chain involves multiple credential-handling layers, each of which should have been caught independently.

**Microsoft (October 2019).** Microsoft's BlueKeep / DejaBlue patching cycle exposed a different version of the same anti-pattern: SCCM (System Center Configuration Manager) databases at multiple enterprise customers contained service-account credentials in cleartext rows. The credentials were used by the configuration-management agents to enroll endpoints; SCCM's schema stored them in plain text by default. Mandiant's IR engagements through 2019-2020 found dozens of customers with exposed SCCM databases — the database itself didn't need to be misconfigured to be exposed; an SCCM admin compromise produced full-fleet credential exfiltration.

**SolarWinds Orion (December 2020 disclosure).** Mandiant's SUNBURST writeup and the subsequent CISA / NIST advisories documented that the post-compromise lateral movement in SUNBURST relied on multiple credential surfaces, including SolarWinds Orion's internal credentials stored in the Orion database. The Orion database stored monitoring-system credentials for managed devices in plaintext rows; access to the Orion database was access to every managed device's credentials. The mitigation guidance recommended (a) encrypting the credential columns at the application layer, (b) moving credentials to a dedicated secret store, and (c) implementing rotation.

**Microsoft Power Apps (August 2021).** UpGuard disclosed that Microsoft Power Apps portals shipped with a default configuration that exposed table data publicly via OData APIs. Multiple enterprise customers, including American Airlines, Ford, and the Indiana Department of Health, had Power Apps tables containing credentials, PII, and operational data publicly accessible. Microsoft changed the default to private in late 2021. The relevant lesson here is that "the database is private because the application is private" is a brittle assumption.

**MOVEit Transfer (May 2023).** The CL0P ransomware group exploited an SQL injection vulnerability in Progress Software's MOVEit Transfer product to access MOVEit's internal database. The database stored credentials for the various transfer integrations MOVEit mediates — SFTP, S3, Azure Blob — in cleartext rows. Once CL0P had the database, they had every integration credential. The downstream exfiltration affected approximately 2,700+ organizations and ~93 million records (CISA's broader estimate puts the population at 3,000+ US, 8,000+ globally). The mitigation pattern: applications that mediate credentials for downstream systems should store those credentials in dedicated secret stores, not in their own operational databases.

**Snowflake customer compromises (May-June 2024).** The Snowflake customer breaches (Ticketmaster ~560M, AT&T ~110M, Santander ~30M, others) showed a related pattern in the opposite direction. The Snowflake instances themselves weren't breached; individual Snowflake customer accounts were accessed using credentials harvested from infostealer malware on customer-side workstations. The credentials were valid Snowflake user passwords; many of the affected accounts lacked MFA. The lesson: a database's security is bounded by the security of the credentials that access it, and credentials accumulate in places (browser password stores, developer machines, CI configurations) outside the database's own control.

**The recurring "Verizon DBIR credential" finding.** Every annual DBIR since approximately 2016 has identified credentials as a top breach-vector category. The 2025 DBIR (covering Nov 2023-Oct 2024 data) reported stolen credentials as the #1 initial-access vector at 22% of breaches in its report period; the 2026 edition (May 2026) tracked vulnerability exploitation taking #1 at 31% for the first time, with credential abuse falling to ~13% behind phishing. The compounding effect of "credentials leaked in one place are usable in many places" is one of the DBIR's most-cited findings year over year.

What unites these cases is the structural similarity to today's finding: databases accumulate credentials over time because operational tasks require credentials and the path of least resistance is "put it in a row." The defensive posture is to redirect that path of least resistance through a dedicated secret store (Secrets Manager, Parameter Store, Vault) so the database never sees a cleartext credential in the first place. Application code reads from the secret store at runtime; the secret never persists in the operational data.

## §5 — Frameworks, deep dive

### SOC 2 Trust Services Criteria (2017, refreshed 2022)

The trust services criteria are AICPA's. Coverline's SOC 2 Type II audit is built around them. The directly relevant criteria:

- **CC6.1 (Logical and Physical Access Controls)** — the criterion driving Friday's audit walk. Coverline's policy ("credentials shall not be embedded in source / configuration / data rows") exists; the audit evidence was what Friday's engagement produced.
- **CC6.2 (System User Management)** — covers user-lifecycle management. The dormant `vikram.shah` account is a CC6.2 gap.
- **CC6.6 (Logical access security measures for outside threats)** — the leaked-credential exposure window from Friday's finding falls under CC6.6.
- **CC7.1 (Detection of security events)** — Coverline's missing `pgaudit` source-IP capture is a CC7.1 gap. The 2026-05-20 anomalous query landed in the audit log but couldn't be attributed to a source.

### NIST SP 800-53 Rev. 5

Published September 2020; latest release is 5.2.0 (August 2025). The directly relevant controls:

- **IA-5 (Authenticator Management)** and especially **IA-5(7) (No Embedded Unencrypted Static Authenticators)** — the direct control mapping for credentials in database rows. IA-5(7)'s text: "The information system does not allow static authenticators to be stored in source code, configuration files, or other unencrypted media." Database rows count as "other unencrypted media."
- **AC-2 (Account Management)** — covers the dormant-account lifecycle gap (vikram.shah).
- **AC-3 (Access Enforcement)** — the credential is the access-enforcement mechanism.
- **AU-12 (Audit Generation)** — the missing source-IP capture in RDS audit logs is an AU-12 implementation gap.

### NIST Cybersecurity Framework 2.0

Released February 2024. Relevant functions and categories:

- **PR.AA (Identity Management, Authentication, and Access Control)** — the IA + AC control family at the framework level.
- **PR.DS (Data Security)** — including PR.DS-01 (Protection of Data-at-Rest), which the unencrypted credential rows violate.
- **DE.CM (Continuous Monitoring)** — the detection capability gap that left the 2026-05-20 query un-attributed.

### CIS AWS Foundations Benchmark v5.0.0

Released March 31, 2025; the version AWS Security Hub natively supports (Security Hub adopted v5.0.0 in October 2025). CIS published v7.0.0 in April 2026 — Security Hub support for v7 is still consolidating as of the May 2026 review date. Relevant safeguards:

- **§1.14** — Ensure access keys are rotated every 90 days or less. Credentials in database rows have effectively infinite rotation cadence and fail this safeguard structurally.
- **§2.1.4 / §2.1.5** — S3 Block Public Access (the remediation already completed in Friday's containment).
- **§4.x** family — Monitoring (CloudTrail / CloudWatch / GuardDuty) covering the detection layer that today's finding exposed as gap-filled.

### CIS PostgreSQL Benchmark (v15 through v18)

The PostgreSQL-specific hardening guide is maintained per PostgreSQL major version; v15, v16, and v17 benchmarks all exist as of mid-2026 (with v9.5+ historical versions still available for legacy estates). Relevant sections (numbering consistent across the modern versions):

- **§3.x (Logging and Monitoring)** — including pgaudit configuration. Coverline's missing source-IP capture is a §3.1.x miss.
- **§5.x (Authentication)** — including IAM database authentication for RDS. The recommended posture is "no static passwords"; Coverline's RDS master is the opposite.

### CWE

- **CWE-798 (Use of Hard-Coded Credentials)** — primary mapping. Database rows with cleartext credential values are "hard-coded" in the sense the CWE intends (fixed location, retrievable via known lookup). Mapping status is **Allowed-with-Review**. Note: CWE-798 was on the CWE Top 25 list every year 2021-2024 but MITRE's methodology change in 2025 (removed normalization to abstract weaknesses) dropped CWE-798 off the published Top 25 — it remains a frequently-encountered Base-level weakness in practitioner reporting.
- **CWE-540 (Inclusion of Sensitive Information in Source Code)** — applies if you treat DB schema + content as source.
- **CWE-312 (Cleartext Storage of Sensitive Information)** — the rows are stored in plaintext VARCHAR columns.
- **CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)** — umbrella parent. Note: CWE-200's mapping status is **Discouraged** in current MITRE guidance — cite the more specific CWE-798 / CWE-540 / CWE-312 for direct mappings.

### NAIC Insurance Data Security Model Law (2017)

Adopted in approximately 28 of the states Coverline operates in. Sections in play:

- **§4 (Information Security Program)** — including **§4.D (Risk Assessment)** which requires ongoing reassessment of risks. Credentials past their stated TTL in a database row are a documented risk factor.
- **§5 (Investigation of a Cybersecurity Event)** — including the determination of whether NPI was acquired.
- **§6 (Notification of a Cybersecurity Event)** — 72-hour notification to the state insurance commissioner upon determination that NPI has been (or is likely to have been) acquired by an unauthorized person.

### NYDFS 23 NYCRR 500 (2017, amended November 2023)

Applies because Coverline is licensed in New York. Sections:

- **§500.07 (Access Privileges and Management)** — covers credential lifecycle including dormant-account remediation. The vikram.shah row is a 500.07 implementation gap.
- **§500.13 (Limitations on data retention)** — DB rows past their stated TTL are a 500.13 violation (the regulation requires retention "only to the extent necessary").
- **§500.17 (Notices to Superintendent)** — 72-hour notification upon "reasonable belief" of unauthorized access or acquisition of nonpublic information.

### GLBA Safeguards Rule (16 CFR Part 314)

Applies because insurance is a Title V financial activity. The FTC's amended Safeguards Rule was finalized December 2021 with enforcement effective June 2023; the notification-of-security-events provision (314.5) was added in October 2023 with enforcement effective May 13, 2024. Sections:

- **§314.4(c)(4)** — Encrypt customer information at rest. The broker-portal credential row is unencrypted at rest.
- **§314.5 (Notification of Security Events)** — 30-day notification to the FTC for security events affecting 500+ consumers' information.

### MITRE ATT&CK

Relevant techniques:

- **T1078 (Valid Accounts)** — using the leaked RDS master credential to authenticate. Same technique as the level0 finding's downstream exposure.
- **T1213 (Data from Information Repositories)** — DB enumeration as the modern equivalent of wiki / SharePoint scrape. Reading the schema, the integrations table, the migration_artifacts table.
- **T1552 (Unsecured Credentials)** family — broadly applies. The closest sub-technique:
  - **T1552.001 (Credentials In Files)** — database rows are not literally "files" but the technique's intent (credentials stored in unprotected locations accessible via known lookup) applies. Some practitioners argue for a separate sub-technique for DB-row credentials; T1552.001 is the closest current ATT&CK match.
- **T1078.001 (Default Accounts)** — adjacent for the RDS master account scenario.
- **T1098 (Account Manipulation)** — what an adversary might do post-compromise.

## §6 — Cert exam relevance

### AWS Certified Security – Specialty (SCS-C03)

AWS released SCS-C03 on December 2, 2025 as the successor to SCS-C02 (which was decommissioned December 1, 2025). Domain 1 (Threat Detection and Incident Response) and Domain 4 (Identity and Access Management) cover the relevant AWS-native controls — Secrets Manager, GuardDuty RDS Protection, Database Activity Streams, IAM database authentication, AWS Config managed rules for RDS.

### AWS Certified Database – Specialty (DBS-C01)

Retired April 30, 2024. The database-security content folded into Solutions Architect Professional and the Security Specialty.

### AWS Certified Solutions Architect – Professional (SAP-C02)

Includes database-security architecture as part of the broader cloud-architecture domain.

### ISC2 CCSP (Certified Cloud Security Professional)

Domain 2 (Cloud Data Security) and Domain 3 (Cloud Platform & Infrastructure Security) cover database encryption, key management, and secret management at the cloud-architecture level.

### CSA CCSK (Certificate of Cloud Security Knowledge) v5

The Cloud Security Alliance's Cloud Controls Matrix (CCM) has multiple controls in the CCM-CEK (Cryptography, Encryption, and Key Management) family that map to credential lifecycle.

### GIAC GCPN (Cloud Penetration Tester)

Tests offensive cloud techniques including DB enumeration from leaked credentials.

### GIAC GCDA (Continuous Monitoring & Security Operations Analyst)

The detection-engineering side. Pgaudit configuration, RDS log streaming to a SIEM, and anomaly detection on DB query patterns are in scope.

### CompTIA CySA+ (CS0-003 / CS0-004)

CS0-004 launched in early 2026 for parallel availability; CS0-003 retires June 2026. Domain 1 (Security Operations) covers credential-leak detection and response workflows.

### ISC2 CISSP

Domain 5 (Identity and Access Management) covers the credential lifecycle including the user-management gap. Domain 3 (Security Architecture and Engineering) covers secret-management as an architectural concern.

### PostgreSQL-specific

There's no formal vendor certification for PostgreSQL administration in the way Oracle has OCP. EnterpriseDB (EDB) offers PostgreSQL certifications that include security as a topic, and the PostgreSQL community itself maintains the [Postgres Security documentation](https://www.postgresql.org/docs/current/security.html).

## §7 — What a defender does

Three parallel remediation tracks: Coverline today, Coverline this quarter, and the broader institutional lesson.

### For Coverline today, in priority order

1. **Rotate the RDS master credential immediately** (`coverline_admin`). Sloane's team has the rotation queued; this engagement's findings are the green light. Use AWS Secrets Manager's RDS rotation feature so the new credential lives in Secrets Manager from the start; the application reads from there.

2. **Rotate the broker-portal migration credential** (`Cv-BrokerSvc-Pr0d-2024-Migration`). Coordinate with the broker-portal team to confirm the Secrets Manager-sourced credential (`secrets-manager:broker-portal-prod`) is the only credential the portal accepts; remove the legacy fallback. This is the level2-engagement entry point — close it before anyone outside Coverline enters it.

3. **Rotate the RDS migration runner credential** (`rds-mig-2024-svc-Tmp9pQ7rT`). Lower priority because the service account is likely defunct since vikram.shah rolled off, but rotate and disable for completeness. Audit any service principals that reference this credential.

4. **Drop the `migration_artifacts` table entirely.** Its legitimate purpose ended in Q2 2024. Preserve a snapshot to cold storage for evidence retention, then `DROP TABLE migration_artifacts`. The migration table that nobody dropped is the one that fueled this finding.

5. **Disable / delete the dormant `vikram.shah` database account** (and the application-side `users` row).

6. **Pull the source IP for the 2026-05-20 02:14 anomalous query** from CloudTrail + VPC Flow Logs. Sloane's team needs this for the breach-notification analysis. If the source IP is on Coverline's internal subnet (an operations engineer doing late-night maintenance), the finding is procedural. If the source IP is external, the breach-notification clocks start.

7. **Enable `pgaudit` on the RDS cluster** with source-IP capture (`pgaudit.log = 'all'`, `pgaudit.log_client = on`). The configuration gap that made the 2026-05-20 finding hard to attribute should not persist.

### For Coverline this quarter

- **Audit every production database for credentials stored in row values.** Targeted SQL queries against columns named like `password`, `secret`, `credential`, `token`, `key`, `api_*`; entropy-based row-content scanners (a custom Lambda with a Shannon-entropy detector against varchar columns is sufficient).
- **Migrate all in-flight credentials to AWS Secrets Manager.** Enable automatic rotation on every secret. Drop the "migration fallback" pattern as architectural policy — Secrets Manager is the only source of truth, the rest is technical debt to be eliminated.
- **Adopt IAM Database Authentication for RDS where feasible.** Application-tier code uses temporary IAM tokens rather than long-lived passwords; rotations become structural. The IAM-database-auth feature has been GA for PostgreSQL and MySQL on RDS since 2018; adoption is bounded only by application-side support, which is universal in modern frameworks.
- **Enable AWS Database Activity Streams** on production Aurora clusters (and on RDS for Oracle / SQL Server where applicable; Database Activity Streams supports Aurora MySQL/PostgreSQL plus RDS for Oracle and SQL Server — but *not* RDS for PostgreSQL/MySQL). Real-time audit of every query, with source IP, query text, and result row count.
- **Enable AWS GuardDuty RDS Protection.** Surfaces anomalous DB authentication patterns including suspicious source locations and credential-misuse signals. GA for Aurora since March 2023; RDS for PostgreSQL support added later.

### For Coverline's user-lifecycle process

The dormant `vikram.shah` row is a user-management gap. Coverline needs an automated quarterly review that flags database accounts whose corresponding HR record shows terminated employment. The standard SaaS pattern (SCIM-based deprovisioning) doesn't extend natively to RDS; a custom Lambda subscribed to the HR-system termination event can deactivate the RDS account in real time. Without that, "deletion of terminated employee accounts" is a manual cleanup task that competes with every other manual cleanup task for attention.

### For Driftwood's documentation

Every query we ran today, with the timestamp, the database, the table queried, and the row count returned. The audit trail supports Coverline's chain of custody for the breach-notification analysis. The findings memo for Sloane explicitly enumerates what we did NOT do (no INSERT / UPDATE / DELETE; no cross-DB queries; no IAM enumeration); the negative scope matters for the regulatory record.

### For the longer-arc lesson

Database rows are a credential-storage anti-pattern that organizations underestimate. The intuition is "the database is protected by the application, so row contents are safe." That intuition breaks the moment any credential that opens the database leaks — at which point every credential STORED IN the database also leaks. The defensive answer is layered: never put credentials in the database in the first place (use Secrets Manager / Parameter Store / Vault), enforce that policy through automated detection (entropy scanners, schema-column-name scanners), and treat any historical credential-row finding as a structural sign that the prevention layer is broken upstream.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you query `migration_artifacts` — `progress --detail` lists what you've unlocked.

### TTL columns without enforcement

**Trigger:** `psql -d coverline_claims "SELECT * FROM migration_artifacts"` (or any psql query against that table; runs naturally during step 5 of the solve)

**What it teaches:** `migration_artifacts` was designed RIGHT — a `ttl_expires_at` column on every row, with Q2 2024 deletion intent stamped at row creation. The schema *acknowledges the risk*: this data is temporary, here's when it should be deleted, the database knows the answer. What failed was **enforcement**.

There's no cron job that reads `ttl_expires_at` and deletes expired rows. There's no deployment-pipeline check that gates new code on the table being below a size threshold. There's no quarterly review process where someone scans expired rows and confirms deletion. The TTL column is *documented intent*, not a *control*. Two are different.

This pattern shows up everywhere in real production work, and it's worth naming:

- **S3 bucket lifecycle policies** — the bucket can have a "delete objects older than 90 days" policy attached. Without the policy, the bucket's `created_at` metadata on each object is documented intent that nothing acts on.
- **DynamoDB Time-To-Live feature** — explicitly automated. You set the TTL attribute name; DynamoDB sweeps expired items. The feature exists because manual cron-based TTL enforcement is a known failure pattern.
- **Application-layer session expiration** — the session record has an `expires_at`. The application is supposed to check it on every request. The application sometimes doesn't (because the check is in some paths but not others, or it's in a wrapper that some new code paths bypass).

For Coverline specifically:

1. **Add a cron job** (or AWS Lambda EventBridge schedule) that runs daily and deletes `migration_artifacts` rows where `ttl_expires_at < NOW()`. Half a day to write and ship.
2. **Add a CloudWatch alarm** that fires if `migration_artifacts` table row count exceeds (say) 1000 rows. The alarm is a sentinel that catches the case where the cron job stops running for any reason — silently failing crons are a known anti-pattern.
3. **Quarterly schema review** that lists every table in production with a TTL/expiration column and confirms each has an active enforcement mechanism. The review produces a list; tables without enforcement get a JIRA ticket and a deadline.

The longer-arc lesson: **documented intent is a planning artifact; an automated job that reads the same column and acts on it is a control.** This is the difference between "we said we'd delete it" and "we deleted it." Auditors and regulators care about the second one. SOC 2 specifically wants evidence that retention controls *fire*, not just that retention controls *are documented*. NYDFS 23 NYCRR 500.13 (Limitations on Data Retention) implicitly assumes enforcement; explicit enforcement is what survives an examination.

For Coverline's CC6.1 control re-attestation work post-this-engagement: every TTL or retention column in every customer-facing table needs an enforcement-mechanism inventory, and any gap is a near-term remediation.

## §8 — Key takeaways

- **Credentials stored in database row values are the modern equivalent of credentials in source-control config files.** Different storage medium, identical anti-pattern: the path of least resistance puts a credential in a row, the task that needed the credential completes, the row outlives the task. The fix is to redirect the path of least resistance through a dedicated secret store (Secrets Manager, Parameter Store, Vault) so the database never sees a cleartext credential in the first place.

- **`migration_artifacts` and tables like it accumulate credential debt.** The intent was right — explicit TTL columns acknowledged the cleanup obligation. The execution failed — nothing in the pipeline enforced the TTL. Designs that name a risk and don't enforce its mitigation are designs that pretend to address the risk. The fix is either (a) deletion-by-default with manual extension, enforced by a scheduled job, or (b) don't put credentials in the table in the first place.

- **"Fallback credentials" outlive their fallback purpose.** Coverline's broker-portal team kept the migration-era credential "in case Secrets Manager lookup fails." That fallback never gets removed because removing it requires confirming Secrets Manager is fully load-bearing, and that confirmation never happens. The same pattern surfaces in network/level1's audit-bypass account, web/level1's BluePier demo account, osint/level1's committed-but-rotated-elsewhere AWS keys. Migration to a new credential system has to include explicit deletion of the old credentials as a discrete completion step.

- **The audit log told the story, but only partially.** Coverline's RDS audit logging captured the database user (`coverline_admin`) for the 2026-05-20 anomalous schema query but not the source IP — `pgaudit` wasn't enabled with source-IP capture. The fix is one parameter group setting and one configuration line. Five-minute change, large forensic value. Most enterprise environments have RDS audit logging in basic mode; few have pgaudit configured for IR-grade source attribution.

- **For SOC 2 / NAIC / NYDFS / GLBA-bound environments specifically**, the breach-notification clocks key off the *determination* moment, not the *discovery* moment. The CISO + GC + outside counsel triangle determines whether the exposure satisfies "reasonable belief of unauthorized acquisition" — and the triangle's determination is informed by exactly the kind of enumeration this engagement produced. The forensic finding is the determination's input; the regulatory clock starts at the triangle's call.

- **The dormant-account pattern is universal across enterprise environments.** Coverline's vikram.shah row is one example; every enterprise has dozens to hundreds of equivalent rows accumulated over years. The fix is automated lifecycle deprovisioning — a custom Lambda subscribed to the HR-system termination event for environments where SCIM doesn't reach (RDS, on-prem systems, legacy SaaS). Without automation, "deletion of terminated employee accounts" is a manual cleanup task that competes with every other manual cleanup task for attention. It always loses.

- **For Coverline specifically**, this week's two findings (Friday's public S3 bucket + today's DB enumeration) produce a budget line for next quarter: Secrets Manager rollout across every production credential surface, Database Activity Streams on every production RDS cluster, GuardDuty RDS Protection enabled, automated user-lifecycle deprovisioning, quarterly automated review of database tables for credential-shaped row contents, and `pgaudit` properly configured with source-IP capture. That budget line is the price of avoiding the next version of this same finding in 2027.

- **The credential-leak cascade is the through-line of this engagement.** Friday's S3 bucket exposed an RDS master credential. Today's DB walk used that credential to find a broker-portal credential. A future level2 engagement using the broker-portal credential could find broker-mediated credentials for downstream insurance carriers. Each link in the chain is structurally similar — a credential created for a specific narrow purpose that outlived its narrow purpose. The system-level fix is rotating secrets through dedicated stores, but the cultural fix is treating credential lifecycle as a continuous ownership rather than an occasional audit-driven cleanup.

- **The forensic finding is small. The system around it is what makes it actionable.** The two findings on this Coverline case took ~3 hours of Driftwood time across two engagements. The system around them — Coverline's SOC 2 posture, Driftwood's retainer, outside counsel's pull-string, the breach-notification regulatory ladder — is what converts the findings into Coverline's documented breach-response posture. The technical work is the small visible part of a much larger institutional process.

## §9 — Further reading

> *Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs, NIST publication revision status, historical-case figures) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

### AWS-specific

- **AWS Secrets Manager**: <https://aws.amazon.com/secrets-manager/>. The primary AWS-native secret store with automatic rotation for RDS and other services.
- **AWS Systems Manager Parameter Store**: <https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html>. The cheaper alternative for non-RDS secrets.
- **AWS RDS IAM Database Authentication**: <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html>. The static-password-free authentication mode for RDS PostgreSQL and MySQL.
- **AWS Database Activity Streams**: <https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/DBActivityStreams.html>. Real-time DB query audit (Aurora MySQL/PostgreSQL, RDS for Oracle, RDS for SQL Server).
- **AWS GuardDuty RDS Protection**: <https://docs.aws.amazon.com/guardduty/latest/ug/rds-protection.html>. Anomaly detection for DB authentication.
- **PostgreSQL pgaudit extension on RDS**: <https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.pgaudit.html>. Source-IP-capable PostgreSQL audit logging.

### Standards documents

- **NIST SP 800-53 Rev. 5**: <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>. The federal control catalog (latest release 5.2.0, August 2025). IA-5(7) is the direct mapping for embedded credentials.
- **NIST Cybersecurity Framework 2.0**: <https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final>. Published February 2024. PR.AA / PR.DS / DE.CM are the relevant function/category mappings.
- **AICPA SOC 2 / Trust Services Criteria**: <https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2>. The 2017 criteria, refreshed 2022.
- **NAIC Insurance Data Security Model Law**: <https://content.naic.org/sites/default/files/model-law-668.pdf>. The 2017 model with state-by-state adoption status.
- **NYDFS 23 NYCRR 500 (current text)**: <https://www.dfs.ny.gov/industry_guidance/cybersecurity>. November 2023 amendment is the current version.
- **GLBA Safeguards Rule (16 CFR Part 314)**: <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314>. FTC amendments (December 2021, with notification provision §314.5 effective May 2024).
- **CIS AWS Foundations Benchmark**: <https://www.cisecurity.org/benchmark/amazon_web_services>. v5.0.0 is the Security Hub-supported version; v6.0.0 and v7.0.0 have shipped on cisecurity.org but Security Hub tooling support is lagging.
- **CIS PostgreSQL Benchmark**: <https://www.cisecurity.org/benchmark/postgresql>. Per-version hardening guides for v15, v16, and v17 (plus historical versions for legacy estates).

### CWE / MITRE ATT&CK

- **CWE-798: Use of Hard-Coded Credentials**: <https://cwe.mitre.org/data/definitions/798.html>. Allowed-with-Review.
- **CWE-540: Inclusion of Sensitive Information in Source Code**: <https://cwe.mitre.org/data/definitions/540.html>.
- **CWE-312: Cleartext Storage of Sensitive Information**: <https://cwe.mitre.org/data/definitions/312.html>.
- **CWE-200: Exposure of Sensitive Information**: <https://cwe.mitre.org/data/definitions/200.html>. Mapping-Discouraged.
- **MITRE ATT&CK T1078 — Valid Accounts**: <https://attack.mitre.org/techniques/T1078/>.
- **MITRE ATT&CK T1213 — Data from Information Repositories**: <https://attack.mitre.org/techniques/T1213/>.
- **MITRE ATT&CK T1552 — Unsecured Credentials**: <https://attack.mitre.org/techniques/T1552/> (parent technique with sub-techniques).
- **MITRE ATT&CK T1552.001 — Credentials In Files**: <https://attack.mitre.org/techniques/T1552/001/>.

### Detection / monitoring tooling

- **HashiCorp Vault** (alternative to Secrets Manager for multi-cloud / on-prem): <https://developer.hashicorp.com/vault>.
- **PostgreSQL pgaudit project**: <https://www.pgaudit.org/>. The community-maintained source for the extension RDS runs.
- **PostgreSQL security documentation (vulnerability reporting + advisories)**: <https://www.postgresql.org/support/security/>. For configuration-side topics (authentication, encryption, row-level security), see the specific subsection pages — <https://www.postgresql.org/docs/current/auth-methods.html>, <https://www.postgresql.org/docs/current/ddl-rowsecurity.html>, <https://www.postgresql.org/docs/current/encryption-options.html>.

### Incident references

- **Capital One 2019 — Senate testimony and OCC consent order**: <https://www.senate.gov/>. Senate Committee on Banking, Housing, and Urban Affairs hearings. The $80M civil money penalty was issued by the OCC (Office of the Comptroller of the Currency); FFIEC is the parent interagency council and doesn't issue enforcement orders directly.
- **MOVEit Transfer 2023 (CL0P) — CISA advisory**: <https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a>. The June 2023 CISA + FBI joint advisory.
- **Snowflake customer compromises 2024 — Mandiant writeup**: <https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion/>. The UNC5537 threat-actor attribution.
- **Verizon DBIR 2026** (latest edition as of the review date): <https://www.verizon.com/business/resources/reports/dbir/>.
