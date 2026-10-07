# level1@cloud — The Migration Table Nobody Dropped

**Track:** Cloud · **Client:** Coverline Insurance · **Compliance regime:** SOC 2 Type II + NAIC Insurance Data Security Model Law + NYDFS 23 NYCRR 500 + GLBA Safeguards Rule (16 CFR Part 314) · **Builds on:** [`level0@cloud`](/walkthroughs/#/cloud/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@cloud`. If you haven't solved `level1@cloud` yet, close this tab and come back after. The puzzle rewards walking the schema in order and noticing which row in which table actually matters; reading the writeup first removes the moment.

---

## §1 — The setup

When you left `level0@cloud` on Friday afternoon, Coverline Insurance had a clean SOC 2 deliverable on its desk: five rows of "MATCHES EXPECTATION" and one row of "DEVIATION — see finding memo." The deviation was `coverline-claims-uploads-prod`, a bucket the worksheet called private, the unauthenticated probe called public, and the contents revealed to hold three Q1 2024 claim files with NPI plus a migration script left over from the region cutover, with a hardcoded RDS master password (`Cl41ms-Pr0d-M4st3r-2024`). Containment came within the hour. Public Access Block went on, the bucket policy was rewritten to deny every principal except the claims-app role, and S3 server-access logs and CloudTrail data events were pulled for the whole ~30-month exposure window, from bucket creation to Friday 16:42 ET.

Containment closed the hole. It did not answer the question. Coverline's CISO, Sloane Becker, convened an IR triage call on Saturday morning with Jordan Nguyen (Sr. Director, Cloud Infrastructure), the in-house GC and outside counsel, and the only item on the agenda was the breach-notification math: what to disclose, to whom, and by when. NAIC §6, NYDFS 23 NYCRR 500.17(a), the GLBA Safeguards Rule's notification requirement at 16 CFR 314.4(j) (effective May 13, 2024, for events affecting 500 or more consumers), and the 50-state breach-law patchwork all hinge on the same determination: that NPI was accessed or acquired by an unauthorized person, or that there is reasonable belief it was.[^nycrr-500][^cfr-16-314] Coverline starts that clock by making the determination, and every notification clock runs from it.

By Sunday afternoon outside counsel had a specific ask: before the RDS master credential is rotated, Driftwood enumerates the database. If the master credential unlocks secondary credentials stashed in row data, the classic "we'll move it to Secrets Manager later", those extend both the exposure window and the notification scope. If the database records unauthorized access during the window, that alone triggers the determination. And if anything suggests the breach is bigger than "three Q1 2024 claims plus a credential to one production database", counsel wants to know before the notifications go out rather than after.

Jordan signed the authorization on Monday morning, engagement reference `DW-CLOUD-COV-2026-008-FOLLOWUP-A`, a continuation of Friday's S3 audit `DW-CLOUD-COV-2026-008`. The leaked credential is pre-staged in a `~/.pgpass` file on Coverline's cloud-audit bastion (`jumpbox-cloud-audit.coverline-internal`), which is the shell you land in when you enter `level1@cloud`. The bastion has VPC peering to the production RDS cluster, so the security group allows the connection from there even though RDS is not reachable from the open internet. `psql` is installed and the pgpass handles the credential plumbing. All you supply is SQL.

You are `cloudsec` again, same Driftwood service account and same engagement file, on a different machine: the bastion stands in for the local cloud-audit workstation so your queries travel Coverline's audit-logged path instead of the open internet. The legal frame is unchanged. SOC 2 Type II is in active fieldwork, the NAIC Model Law applies across the ~25 states Coverline operates in, NYDFS applies because Coverline holds a New York license, and the GLBA Safeguards Rule applies because insurance is a Title V financial activity. What is new is the urgency. Every query you run feeds the notification math, which carries 72-hour and 30-day clocks depending on jurisdiction, all keyed to Coverline's moment of discovery, and that moment is this engagement's findings memo.

The interesting table was created for perfectly legitimate reasons. The region-cutover migration needed somewhere to park credentials while the new region's services came online, so someone built a table for it, complete with a `ttl_expires_at` column on every row and Q2 2024 cleanup intent. The design acknowledged the risk. The execution never got around to it. That table is where the broker-portal credential lives, and the broker-portal credential is the level2 breadcrumb.

## §2 — The solve

The path is short, and it rewards reading the schema in order instead of guessing at table names.

### Step 1: Enter the bastion

```bash
guest@d3cyph3r:~$ ssh level1@cloud
level1@cloud's password: Cl41ms-Pr0d-M4st3r-2024
Connected: level1@cloud
cloudsec@cloud:~$ whoami
cloudsec
```

That is the password from Friday's `migrate-rds.sh`, the same one Coverline is about to rotate. While it still works, the bastion's `~/.pgpass` handles it, so `psql` connects without you passing a host, a user or a password.

### Step 2: Read the four engagement files

```bash
cloudsec@cloud:~$ ls
bastion-handoff.txt   lessons-learned.md
engagement-notes.md   welcome.md
```

`welcome.md` introduces `psql`: the three meta-commands (`\l`, `\dt`, `\d`), the SELECT patterns the sandbox supports, and the workflow. `engagement-notes.md` is Priya's catch-up on the weekend, covering the IR triage call, counsel's request and the scope addendum. `bastion-handoff.txt` is Jordan's connection brief, with the cluster endpoint, the out-of-scope list (no INSERT/UPDATE/DELETE/DROP/ALTER, no queries into `coverline_billing`, no IAM enumeration) and the deadline, COB Tuesday.

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

Five databases. Two belong to Coverline (`coverline_claims` and `coverline_billing`); the other three (`postgres`, `template0`, `template1`) are the defaults every PostgreSQL cluster ships with. Jordan's brief scopes today to `coverline_claims`. Billing is somebody else's engagement.

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

Eight tables. Four of them (`claims`, `customers`, `policies`, `adjusters`) are the system of record behind the files that leaked from S3 on Friday. Read them once to confirm the data category, then move on, because the findings are elsewhere.

The ones that matter today are `integrations` (how Coverline handles credentials for live integrations), `migration_artifacts` (a table name that should make any auditor sit up), `users` (account lifecycle) and `audit_log` (what has already happened).

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

Two things stand out. Every active integration points at its credential with a `secrets-manager:<name>` reference instead of storing the secret in the row, so Coverline already uses AWS Secrets Manager for live credentials.[^aws-secrets-manager] This table is designed correctly.

The other thing: INT-002, the broker portal, points at `secrets-manager:broker-portal-prod`. Keep that name in mind for the next table.

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

Three rows, and the `notes` column is where the story is.

**Row 1**, `rds-migration-runner`, is a service-account password for Vikram Shah's deploy pipeline, created for the region cutover with deletion planned for Q2 2024 "once cutover is verified." Friday's script header called it a 2023-Q4 cutover, but these rows were created in February 2024, so it clearly ran long. The pipeline is presumably long gone. The password is not: it is still in the row, its TTL expired nearly two years ago, and nothing suggests anyone came back for it. Vikram is the senior DevOps engineer the script header says rolled off Coverline in Q1 2024.

**Row 2**, `broker-portal-svc`, is the one that matters. It seeded broker-portal service accounts during the migration's data backfill, and its note is a two-part instruction: "Migrate consumers to Secrets Manager and delete after broker reconciliation completes (target Q2 2024)." Now look back at INT-002. The broker portal does read its credential from Secrets Manager, so the first half got done. The second half never did. The likely reason is a familiar one: the old credential stayed as a fallback in case the Secrets Manager lookup failed, and removing a fallback means first proving the new path carries the whole load, which is a meeting nobody ever books.

The credential is `Cv-BrokerSvc-Pr0d-2024-Migration`, and it is your password into `level2@cloud`, where it turns out to unlock a good deal more than the broker portal.

**Row 3**, `naic-sftp-handoff`, is a one-time SFTP credential for the NAIC quarterly data handoff, and it is the decoy. The note says "Rotated 2024-04-15 per NAIC quarterly schedule; this row is historical only." The rotation happened in the upstream system on schedule, so the value in this row is dead. Coverline got this one right, and it belongs in the report as the model for what rows 1 and 2 should have looked like.

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

Two rows deserve a second look.

**USR-004 (vikram.shah)** was terminated on 2024-01-31, which fits the "rolled off Q1 2024" line in Friday's script. The row is still here, marked `terminated` rather than removed, so the application still holds his identity and every code path has to remember to check the status. That is a SOC 2 CC6.2 gap: credentials are supposed to be removed when access is no longer authorized, and a status flag is not removal. SCIM-based deprovisioning, the usual SaaS answer, does not reach an application table inside RDS, so Coverline needs something custom, such as a Lambda subscribed to the HR system's termination event.

**USR-006 (coverline_admin)** is the RDS master account, the one whose password leaked. Its `last_login` is **2026-05-20 02:14:42**. Remember that timestamp.

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

Three entries. The table is sparse because this is a triage snapshot; production holds far more. The first two are routine. The third is the finding.

**EVT-1029403**, at 2026-05-20 02:14:42 UTC, is a `schema_query_pg_catalog` event: a read of `pg_catalog.pg_tables`, the system catalog that lists every table in the database. It is the first thing anyone does with fresh database access. You look at the map before you decide where to dig.

The actor is `coverline_admin (unrecognized source)`. The application's audit logger knows which database user ran the query but cannot tie the connection to any known Coverline source. Coverline runs RDS logging in basic mode with no `pgaudit`, and nothing in that configuration recorded the client address. That is a SOC 2 CC7.2 gap (monitoring for anomalies), and the IR engagement should flag it too.

Now look back at `users`. The `last_login` for `coverline_admin` is 2026-05-20 02:14:42, the **same second**. Someone logged in as the RDS master account and went straight for the catalog. Coverline knows which account they used; it does not know their address or their client. And it happened two days before the bucket was locked down, with the credential rotation not yet even queued.

The IR team's next move is to set that timestamp against other evidence:
- **VPC Flow Logs** for the subnet that hosts the cluster, if they were enabled. To AWS a PostgreSQL login is a TCP connection on port 5432, and flow logs record where it came from.
- **CloudTrail** for the same window. It will not show the login, because CloudTrail records RDS API calls (modifying the cluster, resetting the master password, changing a security group) and not database sessions. It can show whether anyone touched the cluster's configuration around the same time.
- **Database Activity Streams**, had they been enabled, which would have captured the SQL itself as it ran.

That answer is the one everything else waits on. If the 02:14 connection came from inside Coverline's network, it was probably an engineer doing late-night maintenance. If it came from outside, someone found the credential in the public bucket and used it, and making that call is the determination that starts the notification clocks.

### Step 9: The hand-off

The findings memo for Sloane has four parts:

1. **Schema summary**: the eight tables in `coverline_claims`, with row counts and a line on each.
2. **Credentials in row data**: two unrotated credentials in `migration_artifacts`. Row 2 (`Cv-BrokerSvc-Pr0d-2024-Migration`) comes first. It is a legacy fallback sitting beside the Secrets Manager path, it gates the broker-portal API, and it should be revoked today, as soon as the broker-portal team confirms Secrets Manager carries the whole load. Row 1 (`rds-mig-2024-svc-Tmp9pQ7rT`), the migration runner's service account, is lower priority, but it should also be revoked and the service account behind it disabled.
3. **Dormant account**: delete the `vikram.shah` row from `users`. A terminated employee has no business in the application's identity directory.
4. **Possible unauthorized access**: the 2026-05-20 02:14:42 UTC catalog query is the candidate trigger for the determination. The IR team checks VPC Flow Logs for its source address. If that address is not on Coverline's internal ranges or VPN, it is the unauthorized access that NAIC §5/§6 and NYDFS 500.17 key on.

The memo also states what you did not do: no INSERT, UPDATE, DELETE, DROP or ALTER; no queries into `coverline_billing`; no IAM, S3 or EC2 enumeration. When the work feeds a legal determination, the negative scope matters as much as the findings.

## §3 — The vulnerability

Three problems, and one habit behind all of them: something built for a job outlived the job.

The structural one is **credentials stored as database row values**, the old credentials-in-config-files problem moved into a different kind of storage with the same staying power. The primary CWE mapping is **CWE-798 (Use of Hard-Coded Credentials)**: a password in a fixed, cleartext location that anyone with the right SELECT can read is hard-coded in every sense that matters.[^cwe-798] **CWE-540 (Inclusion of Sensitive Information in Source Code)** is a looser fit that works if you count schema migrations and seed data as part of the application's source, which is where most teams keep them.[^cwe-540] **CWE-312 (Cleartext Storage of Sensitive Information)** covers the storage form: `credential_value` is a plain VARCHAR with no application-layer encryption.[^cwe-312]

What makes it last is that the credential's lifecycle came loose from its purpose. It was made for one narrow job, the region cutover. The job finished and the credential stayed, because nothing in the pipeline enforces a TTL. The intent is right there in the schema: `ttl_expires_at` names a cleanup date on every row. But no scheduled job ever runs `WHERE ttl_expires_at < NOW()` and deletes anything. The design saw the risk coming, and the implementation never closed the loop.

The broker-portal row deserves its own note. Coverline did move the broker portal to Secrets Manager, and the `integrations` table proves it. The migration credential stayed behind as a fallback, and fallbacks are remarkably durable. Removing one means the owning team has to declare the new path the single source of truth, which takes a plan and a sign-off that nobody ever schedules, so the fallback just stays. Its relatives turn up on other tracks, such as the network track's audit account that was added for a vendor's dry run and never cleaned up. Different storage, same failure.

The second problem is the **detection gap**. Coverline runs RDS logging in basic mode, which recorded who ran the 02:14 query (`coverline_admin`) but not where it came from, and that is why the findings memo has to hand the "was this an outsider?" question to the network evidence. The fix is small. RDS already stamps every PostgreSQL log line with the client's host and port (its fixed `log_line_prefix` includes `%r`), so turning on `log_connections` records every login with its source, and loading `pgaudit` through the parameter group adds statement-level audit lines with the same prefix. It costs a parameter-group change and a reboot, and it is worth a great deal the next time someone has to answer this question.

The third is less direct: the **dormant-account gap** in the application's `users` table. `vikram.shah` has been `terminated` since 2024-01-31 and the row is still there, so the application's identity logic still knows him. It is not tied to today's exposure (whatever access he had, it was not the leaked master credential), but it is a CC6.2 gap and it belongs in the report.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | The `coverline_claims` production database, entered with the RDS credential recovered from the public bucket |
| The finding | A `migration_artifacts` table from the 2024 region cutover, carrying explicit TTL columns that scheduled its own deletion for Q2 2024 |
| Contents | A broker-portal service credential, stored as a row in a database table |
| The other signal | A single anomalous schema-enumeration query from 2026-05-20 02:14 UTC, with **no captured source IP** |
| Escalates to | The broker-portal credential, which is `level2@cloud` |
| Regime | SOC 2, NAIC Model 668 and NYDFS 23 NYCRR 500, 72 hours to the commissioner and to the superintendent respectively[^nycrr-500] |

**The table documented its own expiry and outlived it by nearly two years.**
Someone thought about lifecycle, wrote the TTL columns, and built nothing
that acted on them. Intent expressed as a column is not a control; it is a
comment that happens to be typed. This is a governance finding about data
retention that is independent of how the credential got read.

**A credential stored as a table row inherits none of a secret store's
properties.** It is in every backup, every replica, every export, and
every developer's local restore, and it is visible to anyone with read on
the schema. Rotation reaches the live row and none of the copies, which is
why the remediation is a secrets manager rather than an `UPDATE`.

**The unattributed query is the most urgent line in the table.** Someone
enumerated the schema at 02:14 UTC and Coverline cannot say who, because
`pgaudit` was never enabled. That missing source IP is simultaneously a
control gap and the reason the incident cannot be closed as benign. For a
72-hour regulator clock, "we cannot determine whether unauthorized access
occurred" is not a neutral answer, and the logging gap will be the first
thing examined.

## §4 — Real-world parallels

Credentials stored as database rows get less press than credentials committed to source control, but they are not rare. A few cases worth knowing, some of them close cousins rather than exact matches:

**Capital One (March 2019, disclosed July 2019).** The entry was SSRF through a misconfigured WAF into the instance metadata service, and the prize was the temporary credential of the WAF's IAM role, which could list and read far more of S3 than a WAF ever needed. About 106 million credit-card applications left, and the OCC assessed an $80 million civil money penalty in August 2020.[^capital-one-2019-senate-testimony] What transfers to Coverline is less about storage than about reach: whoever finds a credential inherits everything it can touch, which is exactly the question Sloane is asking about the RDS master password. The `level0@cloud` walkthrough covers the case in full.

**Microsoft Power Apps portals (disclosed August 2021).**[^upguard-power-apps-2021] UpGuard found Power Apps portals whose OData feeds served list data to anyone who asked, because list-level table permissions were off by default. Across the portals it found, that came to 38 million records, from organizations including American Airlines, J.B. Hunt, Microsoft, and public bodies in Indiana, Maryland and New York City. Microsoft then switched table permissions on by default. The lesson for Coverline is that "the database is private because the application is private" is an assumption, and assumptions are what audits are for.

**MOVEit Transfer (May 2023).**[^moveit-transfer-2023-cl0p-cisa] CL0P exploited a SQL injection flaw in Progress Software's MOVEit Transfer and dropped a web shell, LEMURLOOT, that could download files, pull MOVEit's Azure system settings, and create or delete users. The campaign reached thousands of organizations downstream. The pattern worth carrying away: an application that brokers access to other systems tends to keep the keys to those systems close by, and whoever owns the application inherits them. Those keys belong in a secret store, not in the application's own tables.

**Snowflake customer compromises (2024).**[^snowflake-customer-compromises-2024-mandiant] This one runs the other way. Snowflake itself was not breached. Attackers logged into individual customer accounts with passwords that infostealer malware had harvested from customer-side machines, and many of those accounts had no MFA. AT&T, Ticketmaster and Santander were among the victims. The lesson: a database is only as safe as the credentials that open it, and those credentials pile up in places the database cannot see, such as browser password stores, developer laptops and CI configuration.

**The Verizon DBIR.**[^verizon-dbir-2026-latest-edition] Credentials have sat at or near the top of the DBIR's initial-access rankings for years. The 2025 edition, covering November 2023 to October 2024, put credential abuse first at 22% of breaches. The 2026 edition reshuffled things: exploitation of vulnerabilities took first place for the first time, at 31%, with phishing at 16% and credential abuse at 13%. That is a ranking of front doors, though, not a verdict on credentials. A leaked password is still a working key whichever door happens to be busiest.

What ties these together is the path of least resistance. Operational work needs credentials, and the easiest place to put one is a row. The defense is to make a secret store (Secrets Manager, Parameter Store, Vault) the easier path, so the application reads the secret at runtime and it never lands in operational data at all.

## §5 — Frameworks, deep dive

### SOC 2 Trust Services Criteria (2017, refreshed 2022)

The trust services criteria are AICPA's, and Coverline's SOC 2 Type II audit is built on them. The ones in play:

- **CC6.1 (Logical and Physical Access Controls)**, the criterion behind Friday's audit walk. Coverline's policy ("credentials shall not be embedded in source / configuration / data rows") exists; Friday's engagement produced the evidence of how well it is followed.
- **CC6.2 (registering and removing users)**: credentials are to be removed when access is no longer authorized. The dormant `vikram.shah` row is a CC6.2 gap.
- **CC6.6 (security measures against threats from outside the system boundary)**: the window in which the leaked credential sat in a public bucket falls here.
- **CC7.2 (monitoring for anomalies)**: the 2026-05-20 query landed in the audit log and nobody could say where it came from. Missing source capture is a CC7.2 gap. (CC7.1, often quoted for detection, is specifically about catching configuration changes and newly discovered vulnerabilities. That was Friday's bucket, not today's login.)

### NIST SP 800-53 Rev. 5

Published September 2020; the latest release is 5.2.0 (August 2025). The controls in play:

- **IA-5 (Authenticator Management)**, and above all **IA-5(7) (No Embedded Unencrypted Static Authenticators)**, which requires that unencrypted static authenticators are not embedded *"in applications or other forms of static storage."* A database row is static storage.
- **AC-2 (Account Management)**: the dormant-account gap (`vikram.shah`).
- **AC-3 (Access Enforcement)**: the credential is the enforcement mechanism, so whoever holds it passes.
- **AU-3 (Content of Audit Records)**, which requires audit records to establish the source of each event. A record with a user and no client address does not.

### NIST Cybersecurity Framework 2.0

Released February 2024. The categories in play:

- **PR.AA (Identity Management, Authentication, and Access Control)**: the IA and AC families at framework level.
- **PR.DS (Data Security)**, including PR.DS-01 (protecting data at rest), which the cleartext credential rows fail.
- **DE.CM (Continuous Monitoring)**: the detection gap that left the 2026-05-20 query unattributed.

### CIS AWS Foundations Benchmark v7.0.0

The current release is v7.0.0 (April 2026). One practical catch: AWS Security Hub's managed CIS standard still stops at **v5.0.0** (adopted October 2025), so its findings use the older numbering. The safeguards in play:

- **§2.12** (access keys rotated every 90 days or less). Strictly this is about IAM access keys, but the principle carries: a credential parked in a database row has no rotation at all. (`§1.14` in the v5.0.0 numbering Security Hub still reports.)
- **§3.1.4** (S3 Block Public Access), already applied during Friday's containment.
- **The logging and monitoring sections** (CloudTrail, CloudWatch, GuardDuty), which cover the detection layer today's finding showed to be missing.

### CIS PostgreSQL Benchmark (v15 through v17)

CIS publishes the PostgreSQL hardening guide per major version. The v15, v16 and v17 benchmarks are current, with older versions still available for legacy estates, and the section numbering holds across them:

- **§3 (Logging, Monitoring and Auditing)**, which covers connection logging, the log line prefix and pgaudit. Coverline's missing source capture is a miss here.
- **§5 (Connection and Login)**, which covers how clients authenticate. The CIS guide is written for self-managed PostgreSQL; on RDS the nearest thing to "no static passwords" is IAM database authentication, and Coverline's RDS master is the opposite.

### CWE

- **CWE-798 (Use of Hard-Coded Credentials)**, the primary mapping.[^cwe-798] A cleartext credential in a known row is hard-coded in the sense the CWE means: fixed location, retrievable by a known lookup. MITRE marks it **Allowed-with-Review** for vulnerability mapping. It sat on the CWE Top 25 every year from 2021 to 2024 and is not on the 2025 list.
- **CWE-540 (Inclusion of Sensitive Information in Source Code)**, if you count schema and seed data as source.[^cwe-540]
- **CWE-312 (Cleartext Storage of Sensitive Information)**: the values sit in plaintext VARCHAR columns.[^cwe-312]
- **CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)**, the umbrella parent.[^cwe-200] MITRE marks it **Discouraged** for mapping, so cite CWE-798, CWE-540 or CWE-312 when you need a direct one.

### NAIC Insurance Data Security Model Law (2017)

Adopted, in some form, by roughly half the states. The sections in play:

- **§4 (Information Security Program)**, including **§4.C (Risk Assessment)**, which requires identifying foreseeable threats and assessing whether the safeguards in place are sufficient. A credential that has outlived its own TTL is exactly the kind of risk that assessment exists to catch.
- **§5 (Investigation of a Cybersecurity Event)**, including identifying any nonpublic information that may have been involved.
- **§6 (Notification of a Cybersecurity Event)**: notify the commissioner within 72 hours of determining that a cybersecurity event has occurred, when the event meets the section's thresholds (the state of domicile, or 250 or more consumers in the state plus a reporting or material-harm condition).

### NYDFS 23 NYCRR 500 (2017, amended November 2023)

Applies because Coverline is licensed in New York. The sections:

- **§500.07 (Access Privileges and Management)**, which covers the credential lifecycle, dormant accounts included. The `vikram.shah` row is a 500.07 gap.
- **§500.13 (Asset Management and Data Retention)** is the tempting citation for a row that outlived its TTL, and it does not quite fit: its disposal requirement covers nonpublic information about individuals, not service credentials. The TTL failure belongs under 500.07 and the risk assessment instead.
- **§500.17 (Notices to Superintendent)**: notify within 72 hours of determining that a cybersecurity incident has occurred.

### GLBA Safeguards Rule (16 CFR Part 314)

Applies because insurance is a Title V financial activity. The FTC's amended Safeguards Rule was finalized in December 2021 with enforcement from June 2023; the notification requirement, §314.4(j), was added by the amendment published in November 2023 (88 FR 77509) and took effect on May 13, 2024. Sections:

- **§314.4(c)(3)**: encrypt customer information at rest and in transit over external networks. The credential row is not customer information itself, but it opens a database full of it, and it sits there in cleartext.
- **§314.4(j) (Notification of Security Events)**: notify the FTC within 30 days of discovering a security event involving 500 or more consumers' information.

### MITRE ATT&CK

The techniques in play:

- **T1078 (Valid Accounts)**: logging in with the leaked RDS master credential.[^t1078] The same technique sits downstream of the level0 finding.
- **T1213 (Data from Information Repositories)**: enumerating a database is the same move as scraping a wiki or SharePoint, aimed at a different store.[^t1213] Here it covers reading the schema, `integrations` and `migration_artifacts`.
- **T1552 (Unsecured Credentials)**, which applies broadly.[^t1552] The closest sub-technique:
  - **T1552.001 (Credentials In Files)**. A database row is not literally a file, but the technique's intent (credentials left in an unprotected place that a known lookup retrieves) fits, and it is the closest current ATT&CK match.[^t1552-001]
- **T1078.001 (Default Accounts)**, a loose fit: the RDS master user is created at provisioning rather than shipped, but it plays the part of a built-in admin.[^t1078-001]
- **T1098 (Account Manipulation)**, what an adversary would likely do next.

## §6 — Cert exam relevance

### AWS Certified Security – Specialty (SCS-C03)

AWS released SCS-C03 on December 2, 2025, replacing SCS-C02 (decommissioned December 1, 2025). The detection, incident response, and identity and access management domains cover the AWS-native controls in this level: Secrets Manager, GuardDuty RDS Protection, Database Activity Streams, IAM database authentication and AWS Config rules for RDS.

### AWS Certified Database – Specialty (DBS-C01)

Retired April 30, 2024. It is listed for anyone who already holds it; there is no direct successor, so the database-security material now turns up across the Security Specialty and the architect exams.

### AWS Certified Solutions Architect – Professional (SAP-C02)

Database security shows up here as one part of the wider architecture questions: where secrets live, how services authenticate to data stores, and how to design rotation in rather than bolt it on.

### ISC2 CCSP (Certified Cloud Security Professional)

Domain 2 (Cloud Data Security) and Domain 3 (Cloud Platform and Infrastructure Security) cover database encryption, key management and secrets management at the architecture level.[^cert-ccsp]

### CSA CCSK (Certificate of Cloud Security Knowledge) v5

The CCSK is built on CSA's Security Guidance, and the Cloud Controls Matrix that sits beside it covers this ground in two domains: IAM (Identity and Access Management) for the credential lifecycle, and CEK (Cryptography, Encryption and Key Management) for how secrets are stored.

### GIAC GCPN (Cloud Penetration Tester)

The offensive side of the same story. The GCPN is about attacking cloud environments from a foothold, and a leaked database credential is exactly that.

### GIAC GCDA (Certified Detection Analyst)

The detection-engineering side: getting logs like RDS's into a SIEM and writing analytics that notice a catalog query at 02:14. The Sigma rule in §7 is the kind of thing this exam expects you to write.

### CompTIA CySA+ (CS0-003 / CS0-004)

CS0-004 launched on 23 June 2026; CS0-003 retires 22 December 2026.[^cert-cysa] Domain 1 (Security Operations) covers detecting and responding to leaked credentials.

### ISC2 CISSP

Domain 5 (Identity and Access Management) covers the credential lifecycle, the dormant-account gap included.[^cert-cissp] Domain 3 (Security Architecture and Engineering) covers secrets management as an architectural decision.

### PostgreSQL-specific

PostgreSQL has no single vendor certification in the way Oracle has the OCP. EnterpriseDB (EDB) offers PostgreSQL certifications that include security, and the PostgreSQL community maintains the [Postgres security documentation](https://www.postgresql.org/support/security/).

## §7 — What a defender does

Three remediation tracks run in parallel: Coverline today, Coverline this quarter, and the lesson that outlasts both.

### For Coverline today, in priority order

1. **Rotate the RDS master credential now** (`coverline_admin`). Sloane's team has the rotation queued, and this engagement's findings are the green light. Use Secrets Manager's RDS rotation so the new credential lives there from day one and the application reads it from there.

2. **Rotate the broker-portal migration credential** (`Cv-BrokerSvc-Pr0d-2024-Migration`). Get the broker-portal team to confirm that the Secrets Manager credential (`secrets-manager:broker-portal-prod`) is the only one the portal accepts, then remove the fallback. This is the way into the level2 engagement, so close it before anyone outside Coverline finds it.

3. **Rotate the RDS migration runner credential** (`rds-mig-2024-svc-Tmp9pQ7rT`). Lower priority, since the service account has probably been idle since Vikram left, but rotate it, disable it, and check for any service principal that still references it.

4. **Drop the `migration_artifacts` table.** Its legitimate purpose ended in Q2 2024. Snapshot it to cold storage for evidence, then `DROP TABLE migration_artifacts`. The table nobody dropped is the one that fueled this finding.

5. **Remove the dormant `vikram.shah` account**: the application-side `users` row, and any database login he had.

6. **Find the source of the 2026-05-20 02:14 query** in the VPC Flow Logs, with CloudTrail alongside for any configuration changes in the same window. Sloane's team needs it for the notification analysis. An internal address (an engineer doing late-night maintenance) makes this a procedural finding. An external one starts the clocks.

7. **Turn on connection and statement logging.** Set `log_connections` and enable `pgaudit` with `pgaudit.log` covering the classes you need (`read`, `write`, `ddl` and `role` are a sensible start). RDS's log prefix already records the client address, so this alone would have answered the 02:14 question.

### For Coverline this quarter

- **Audit every production database for credentials stored in rows.** Targeted queries against columns named like `password`, `secret`, `credential`, `token`, `key` or `api_*`, plus an entropy scan of text columns (a scheduled Lambda with a Shannon-entropy check is enough).
- **Move every live credential into Secrets Manager** with automatic rotation on, and retire the "migration fallback" as a matter of policy. Secrets Manager is the single source of truth; anything else is debt with a due date.
- **Adopt IAM database authentication where it fits.** Applications connect with short-lived IAM tokens (15 minutes) instead of long-lived passwords, so there is no static password to leak. Check AWS's connection-rate guidance before putting it on a busy service.
- **Enable Database Activity Streams** on production Aurora clusters. The feature covers Aurora MySQL and PostgreSQL plus RDS for Oracle and SQL Server, but *not* RDS for PostgreSQL or MySQL, which is worth knowing before you promise it to anyone.[^aws-database-activity-streams] It audits every query in near real time, with the client address, the statement text and the row count.
- **Enable GuardDuty RDS Protection.**[^aws-guardduty-rds-protection] It watches login activity for anomalies such as unfamiliar source locations and signs of credential misuse. It went GA for Aurora in March 2023, with RDS for PostgreSQL support added later.

### For Coverline's user-lifecycle process

The `vikram.shah` row is a process failure, not a one-off. Coverline needs an automated review that flags accounts whose owner's HR record says terminated, and ideally a hook on the HR system's termination event that deactivates them the same day. SCIM won't reach an application table in RDS, so this part has to be built. Without it, removing leavers' accounts is a manual chore competing with every other manual chore, and it loses.

### For Driftwood's documentation

Log every query we ran today with its timestamp, database, table and row count. That trail supports Coverline's chain of custody for the notification analysis. The memo for Sloane also lists what we did not do (no INSERT, UPDATE or DELETE; no cross-database queries; no IAM enumeration), because the negative scope matters for the regulatory record.

### For the longer-arc lesson

Organizations underestimate database rows as a place where credentials hide. The intuition is that the application protects the database, so whatever is in the rows is safe. That holds until any credential that opens the database leaks, and then every credential stored inside it leaks too. The answer comes in layers: keep credentials out of the database entirely (Secrets Manager, Parameter Store, Vault), enforce that with automated detection (entropy scans, column-name scans), and treat any credential found in a row as evidence that prevention broke somewhere upstream.

### Sample detection rule (Sigma)

The anomalous query in this level has no source IP because `pgaudit` was
never enabled, so the honest first step is not a rule but a prerequisite:
without statement-level audit logging there is nothing for a rule to read.

```yaml
title: Database schema enumeration from an application credential
status: experimental
description: >
  Detects catalogue and metadata queries issued by accounts that exist to
  serve an application. Application code queries its own tables by name
  and has no reason to enumerate the schema; a human or a tool exploring
  the database does exactly that first.
  Requires pgaudit: shared_preload_libraries = 'pgaudit',
  pgaudit.log = 'read,ddl,misc'
logsource:
  product: postgresql
  service: pgaudit
detection:
  enumeration:
    statement|contains:
      - 'information_schema.tables'
      - 'information_schema.columns'
      - 'pg_catalog.pg_tables'
      - '\\dt'
  application_accounts:
    user:
      - 'coverline_app'
      - 'coverline_reporting'
  condition: enumeration and application_accounts
falsepositives:
  - ORM startup and migration tooling, which legitimately inspects the
    schema on connect. Exclude by the specific statements those tools
    emit rather than by disabling the rule for the account.
  - Schema-diff and monitoring agents. Give them their own database role
    so they can be excluded by identity.
level: high
```

Add an off-hours condition and the rule sharpens considerably, because the
event in this level occurred at 02:14 UTC. Schema enumeration by an
application credential in the middle of the night is a very specific
shape, and it is worth alerting on even when the daytime equivalent is
only logged.

The regulatory point belongs in the write-up alongside the technical one.
Both NAIC Model 668 and NYDFS § 500.17 run a 72-hour clock from the
determination that a cybersecurity event (NAIC) or incident (NYDFS) occurred, and Coverline cannot
make that determination here because the source address was never
captured. A logging gap is not a neutral finding when the alternative to
"we confirmed it was benign" is "we could not tell."[^nycrr-500]

## §7.5 — Optional exploration

The credential chain works without this section. The level hides one bonus find, which fires when you query `migration_artifacts`, and `progress --detail` lists what you have unlocked.

### TTL columns without enforcement

**Trigger:** `psql -d coverline_claims "SELECT * FROM migration_artifacts"`, or any psql query against that table. You will hit it naturally in step 6 of the solve.

**What it teaches:** `migration_artifacts` was designed well. Every row carries a `ttl_expires_at`, with Q2 2024 deletion stamped in at creation. The schema *acknowledges the risk*: this data is temporary, here is when it should go, and the database knows the answer. What failed was **enforcement**.

No job reads `ttl_expires_at` and deletes expired rows. No pipeline check gates a deploy on the table being empty. No quarterly review looks for expired rows and confirms they are gone. The TTL column is *documented intent*, not a *control*, and the two are different things.

You will meet this pattern constantly, so it helps to know the versions that work and the version that doesn't:

- **S3 lifecycle rules** expire objects after a set number of days with no human in the loop. That is enforcement.
- **DynamoDB TTL** is enforcement too. You name an attribute and DynamoDB deletes expired items itself, typically within a few days of expiry rather than to the second.
- **Application-layer session expiry** is the fragile one. The session record has an `expires_at`, and the application is supposed to check it on every request. Sometimes it doesn't, because the check lives in some code paths and not others, or in a wrapper that new code bypasses.

For Coverline specifically:

1. **Add a scheduled job** (cron, or a Lambda on an EventBridge schedule) that runs daily and deletes `migration_artifacts` rows where `ttl_expires_at < NOW()`. Half a day to write and ship.
2. **Watch the watcher.** Publish a daily count of expired rows as a CloudWatch metric and alarm when it is above zero. That catches the day the cleanup job quietly stops running, which is how scheduled jobs usually fail.
3. **Review the schema quarterly**: list every production table with a TTL or expiry column and confirm each one has something enforcing it. Tables without enforcement get a ticket and a deadline.

The lesson that outlasts this engagement: **documented intent is a planning artifact; an automated job that reads the same column and acts on it is a control.** It is the difference between "we said we'd delete it" and "we deleted it," and auditors care about the second. A SOC 2 Type II examination tests whether controls operated over the period, so a retention rule that exists only on paper is a finding waiting to happen.

For Coverline's CC6.1 re-attestation after this engagement, every TTL or retention column in every customer-facing table needs an inventory of what enforces it, and any gap is near-term remediation.

## §8 — Key takeaways

- **Credentials stored as database rows are the new credentials-in-config-files.** The storage changed and the failure didn't: a credential goes in a row because that is easiest, the task that needed it finishes, and the row outlives the task. The fix is to make a secret store (Secrets Manager, Parameter Store, Vault) the easiest path, so the database never sees a cleartext credential at all.

- **`migration_artifacts` and tables like it accumulate credential debt.** The intent was right: explicit TTL columns acknowledged the cleanup obligation. The execution failed, because nothing enforced the TTL. A design that names a risk without enforcing the mitigation only looks like it addresses the risk. Either delete by default and make extensions a deliberate act, enforced by a scheduled job, or keep credentials out of the table to begin with.

- **Fallback credentials outlive the thing they were a fallback for.** Coverline's broker-portal team kept the migration-era credential in case the Secrets Manager lookup failed, and removing it would have meant confirming Secrets Manager carries the whole load, which nobody ever did. The network track's leftover audit account and the web track's BluePier demo account are the same story. Moving to a new credential system has to include deleting the old credentials as its own explicit completion step.

- **The audit log told half the story.** Coverline's RDS logging captured the database user for the 2026-05-20 catalog query but not where it came from, because neither connection logging nor `pgaudit` was on. The fix is a parameter-group change and a reboot, and it turns "we could not tell" into an answer.

- **Under SOC 2, NAIC, NYDFS and GLBA, the notification clocks key off the *determination*, not the *discovery*.** The CISO, the GC and outside counsel decide whether the exposure amounts to unauthorized access or acquisition, and they decide it on evidence like this engagement's enumeration. The forensic finding is the input; the clock starts at their call.

- **Dormant accounts are everywhere.** Coverline's `vikram.shah` row is one; most organizations with a few years behind them have plenty more. The fix is automated deprovisioning, with something custom (such as a Lambda on the HR system's termination event) wherever SCIM doesn't reach: RDS, on-prem systems, legacy SaaS. Left to manual cleanup, it competes with every other manual cleanup and loses.

- **For Coverline, this week's two findings write next quarter's budget line**: Secrets Manager across every production credential, Database Activity Streams on every production Aurora cluster, GuardDuty RDS Protection, automated deprovisioning, a recurring scan of database tables for credential-shaped values, and connection plus `pgaudit` logging on every cluster. That is the price of not having this same finding again in 2027.

- **The cascade is the through-line.** Friday's S3 bucket exposed an RDS master credential. Today's database walk used it to find a broker-portal credential, which in `level2@cloud` turns out to reach a good deal further than its name suggests. Every link has the same shape: a credential created for one narrow purpose that outlived it. Dedicated secret stores are the system-level fix. The cultural fix is treating credential lifecycle as something a team owns continuously, not something an audit cleans up now and then.

- **The finding is small; the system around it is what makes it matter.** The two Coverline findings took about three hours of Driftwood time across two engagements. Coverline's SOC 2 posture, Driftwood's retainer, outside counsel's questions and the notification rules are what turn those hours into a documented breach response. The technical work is the visible tip of a much larger process.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs, NIST publication revision status, historical-case figures) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^aws-secrets-manager]: [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/). The primary AWS-native secret store with automatic rotation for RDS and other services.
[^aws-database-activity-streams]: [AWS Database Activity Streams](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/DBActivityStreams.html). Real-time DB query audit (Aurora MySQL/PostgreSQL, RDS for Oracle, RDS for SQL Server).
[^aws-guardduty-rds-protection]: [AWS GuardDuty RDS Protection](https://docs.aws.amazon.com/guardduty/latest/ug/rds-protection.html). Anomaly detection for DB authentication.
[^nycrr-500]: [NYDFS 23 NYCRR 500 (current text)](https://www.dfs.ny.gov/industry_guidance/cybersecurity). November 2023 amendment is the current version.
[^cfr-16-314]: [GLBA Safeguards Rule (16 CFR Part 314)](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314). FTC amendments (December 2021; the notification requirement, §314.4(j), took effect May 13, 2024).
[^cwe-798]: [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html). Allowed-with-Review.
[^cwe-540]: [CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html).
[^cwe-312]: [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html).
[^cwe-200]: [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html). Mapping-Discouraged.
[^t1078]: [MITRE ATT&CK T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
[^t1213]: [MITRE ATT&CK T1213 — Data from Information Repositories](https://attack.mitre.org/techniques/T1213/).
[^t1552]: [MITRE ATT&CK T1552 — Unsecured Credentials](https://attack.mitre.org/techniques/T1552/). (parent technique with sub-techniques).
[^t1552-001]: [MITRE ATT&CK T1552.001 — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/).
[^capital-one-2019-senate-testimony]: [OCC assesses $80 million civil money penalty against Capital One (2020)](https://www.occ.gov/news-issuances/news-releases/2020/nr-occ-2020-101.html). The penalty was issued by the OCC, the Office of the Comptroller of the Currency; FFIEC is the parent interagency council and does not issue enforcement orders directly.
[^upguard-power-apps-2021]: [By Design: How Default Permissions on Microsoft Power Apps Exposed Millions](https://www.upguard.com/breaches/power-apps). UpGuard's August 2021 disclosure, including Microsoft's change to enable table permissions by default.
[^moveit-transfer-2023-cl0p-cisa]: [MOVEit Transfer 2023 (CL0P) — CISA advisory](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a). The June 2023 CISA + FBI joint advisory.
[^snowflake-customer-compromises-2024-mandiant]: [Snowflake customer compromises 2024 — Mandiant writeup](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion/). The UNC5537 threat-actor attribution.
[^verizon-dbir-2026-latest-edition]: [Verizon DBIR 2026 (latest edition as of the review date)](https://www.verizon.com/business/resources/reports/dbir/).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-ccsp]: [ISC2 CCSP — certification exam outline](https://www.isc2.org/certifications/ccsp/ccsp-certification-exam-outline).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^t1078-001]: [MITRE ATT&CK — T1078.001: Valid Accounts: Default Accounts](https://attack.mitre.org/techniques/T1078/001/).

### Further reading

- [AWS Systems Manager Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html). The cheaper alternative for non-RDS secrets.
- [AWS RDS IAM Database Authentication](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html). The static-password-free authentication mode for RDS PostgreSQL and MySQL.
- [PostgreSQL pgaudit extension on RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.pgaudit.html). Source-IP-capable PostgreSQL audit logging.
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). The federal control catalog (latest release 5.2.0, August 2025). IA-5(7) is the direct mapping for embedded credentials.
- [NIST Cybersecurity Framework 2.0](https://csrc.nist.gov/pubs/cswp/29/the-nist-cybersecurity-framework-csf-20/final). Published February 2024. PR.AA / PR.DS / DE.CM are the relevant function/category mappings.
- [AICPA SOC 2 / Trust Services Criteria](https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services). The 2017 criteria, refreshed 2022.
- [NAIC Insurance Data Security Model Law](https://content.naic.org/sites/default/files/model-law-668.pdf). The 2017 model with state-by-state adoption status.
- [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services). v7.0.0 is the current release (S3 in §3.1, IAM in §2); AWS Security Hub's managed standard still implements v5.0.0, so console findings show the older §2.1.x / §1.x numbering.
- [CIS PostgreSQL Benchmark](https://www.cisecurity.org/benchmark/postgresql). Per-version hardening guides for v15, v16, and v17 (plus historical versions for legacy estates).
- [HashiCorp Vault (alternative to Secrets Manager for multi-cloud / on-prem)](https://developer.hashicorp.com/vault).
- [PostgreSQL pgaudit project](https://www.pgaudit.org/). The community-maintained source for the extension RDS runs.
- [PostgreSQL security documentation (vulnerability reporting + advisories)](https://www.postgresql.org/support/security/).
- [PostgreSQL — authentication methods](https://www.postgresql.org/docs/current/auth-methods.html). The configuration-side reference for authentication, encryption and row-level security.
