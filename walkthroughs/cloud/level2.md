# level2@cloud — The Key Nobody Turned Off

A study companion for the third Coverline Insurance cloud engagement. Read it after you've solved the level.

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level3@cloud`. If you haven't solved `level2@cloud` yet, close this tab and come back after. The level's whole point is the moment you realize the credential with god-mode over the entire AWS account is one nobody has used since 2024, and nobody turned off. Reading the writeup first removes that moment.

## §1 — The setup

You are `cloudsec` again, a Driftwood cloud-security auditor, three days into the Coverline Insurance engagement, and the first two days have set a pattern. On Friday a public S3 bucket gave up claims data and a hardcoded RDS master password. On Monday that password opened the production database, which turned out to hold *more* credentials in its rows, including `broker-portal-svc`, a service credential parked in an abandoned migration table.

Every finding so far traces back to one event: the 2024 migration of Coverline's infrastructure from `us-east-1` to `us-east-2`, run by a senior DevOps engineer named Vikram Shah. The migration spun up temporary credentials, temporary service accounts and temporary tooling, and almost none of it was torn down. Vikram left Coverline on 2024-01-31, before the migration had even finished, and the cleanup had no other owner.

Today's twist is that `broker-portal-svc` is not just a database login. Coverline's IAM team has confirmed it is also an IAM **user** with programmatic access keys, provisioned during the migration and never scoped down. Those keys are your shell's default AWS profile, so every `aws` call you make runs as `broker-portal-svc`. That a "broker portal service" can read the entire IAM account is, as the welcome note puts it, finding zero.

Sloane Becker, Coverline's CISO, wants Driftwood to use that over-broad read access to answer one question before Coverline rotates everything the engagement has surfaced: **which principals can do what, and which ones from the 2024 migration were never torn down?**

This is an IAM least-privilege audit, the most common kind of cloud-security review and one of the most consequential. There is no clever bug to exploit. You run read-only enumeration commands and notice which answers are wrong.

## §2 — The solve

### Step 0 — Enter the level

From the lobby:

```bash
ssh level2@cloud
# Password: Cv-BrokerSvc-Pr0d-2024-Migration
```

That password is the breadcrumb from yesterday's `migration_artifacts` table in `coverline_claims`, and it belongs to `broker-portal-svc`.

`cat welcome.md` introduces three new `aws iam` reads, and `cat engagement-notes.md` is Sloane's tasking. The notes scope the hunt: the non-human service identities from the 2024 migration, keys that are dormant but still active, orphaned accounts, and account-level posture. They also tell you where to start, because Vikram's migration tooling is still on this bastion under `~/migration-2024`.

### Step 1 — Confirm who you are

```bash
aws sts get-caller-identity
```

```
UserId:   AIDABROKERPORTALSVC01
Account:  390210448812
Arn:      arn:aws:iam::390210448812:user/broker-portal-svc
```

You are operating *inside* Coverline's AWS account (`390210448812`) as `broker-portal-svc`. A portal service with enough IAM read to run the rest of this audit is a least-privilege failure in its own right, but it is the failure that lets you find the bigger one.

### Step 2 — Enumerate every principal

```bash
aws iam list-users
```

```
UserName              Arn
--------------------  -----------------------------------------------------
sloane.becker         arn:aws:iam::390210448812:user/sloane.becker
jordan.nguyen         arn:aws:iam::390210448812:user/jordan.nguyen
priya.raman           arn:aws:iam::390210448812:user/priya.raman
marcus.webb           arn:aws:iam::390210448812:user/marcus.webb
kim.chen              arn:aws:iam::390210448812:user/kim.chen
sarah.mitchell        arn:aws:iam::390210448812:user/sarah.mitchell
james.okafor          arn:aws:iam::390210448812:user/james.okafor
vikram.shah           arn:aws:iam::390210448812:user/vikram.shah
broker-portal-svc     arn:aws:iam::390210448812:user/broker-portal-svc
legacy-deploy-bot     arn:aws:iam::390210448812:user/legacy-deploy-bot
migration-runner-bot  arn:aws:iam::390210448812:user/migration-runner-bot
ci-deploy-svc         arn:aws:iam::390210448812:user/ci-deploy-svc
backup-svc            arn:aws:iam::390210448812:user/backup-svc
naic-exchange-svc     arn:aws:iam::390210448812:user/naic-exchange-svc
terraform-ci          arn:aws:iam::390210448812:user/terraform-ci
monitoring-svc        arn:aws:iam::390210448812:user/monitoring-svc
```

Sixteen principals: eight humans (`firstname.lastname`) and eight machine identities (`*-svc`, `*-bot`, `*-ci`). Two names should make you sit up:

- `vikram.shah`: yesterday's `users` table said he was *terminated* on 2024-01-31. Why does he still have an IAM user?
- `legacy-deploy-bot`: "legacy" plus "bot" is exactly the kind of name a migration leaves behind.

The engagement notes say to start with the migration-era service accounts, so start there.

### Step 3 — Inspect attached policies (the finding)

For each suspect, list what is attached:

```bash
aws iam list-attached-user-policies --user-name legacy-deploy-bot
```

```
AttachedPolicies:

  PolicyName:  AdministratorAccess
  PolicyArn:   arn:aws:iam::aws:policy/AdministratorAccess
```

There it is. `legacy-deploy-bot`, a "temporary" deploy identity from the 2024 migration, has the AWS-managed `AdministratorAccess` policy attached. Confirm what that grants:

```bash
aws iam get-policy --policy-arn arn:aws:iam::aws:policy/AdministratorAccess
```

```
Policy:
  PolicyName:       AdministratorAccess
  Arn:              arn:aws:iam::aws:policy/AdministratorAccess
  DefaultVersionId: v1
  Description:      Provides full access to AWS services and resources.
  Document:
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": "*",
          "Resource": "*"
        }
      ]
    }
```

`"Action": "*"` on `"Resource": "*"`: every action, on every resource, in the account. That is the whole blast radius. Read every bucket, assume every role, mint every credential, delete every log.

Now compare a service account the same migration created *correctly*:

```bash
aws iam list-attached-user-policies --user-name migration-runner-bot
# -> coverline-migration-s3-scoped

aws iam get-policy --policy-arn arn:aws:iam::390210448812:policy/coverline-migration-s3-scoped
```

```
  Document:
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "MigrationBucketsOnly",
          "Effect": "Allow",
          "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
          "Resource": [
            "arn:aws:s3:::coverline-migration-*",
            "arn:aws:s3:::coverline-migration-*/*"
          ]
        }
      ]
    }
```

`migration-runner-bot` can perform three actions, on the migration buckets and nothing else. That is least privilege done right. The two bots did the same job at the same time, and one got a scalpel while the other got a master key. **Checking the policy, not the name, is the whole skill**: nothing in the names tells you that `legacy-deploy-bot` is dangerous and `migration-runner-bot` is fine.

### Step 4 — Is the key live, and is it used?

A god-mode policy on a bot whose key is long dead is harmless. A god-mode policy on a bot whose key still works is a standing catastrophe. Check:

```bash
aws iam list-access-keys --user-name legacy-deploy-bot
```

```
AccessKeyMetadata:

  UserName:     legacy-deploy-bot
  AccessKeyId:  AKIA7X4DEPLOYB0T2024
  Status:       Active
  CreateDate:   2024-02-15
```

`Status: Active`. The key still opens the door. Now for the most important question in any credential-hygiene pass: *is anyone actually using it?*

```bash
aws iam get-access-key-last-used --access-key-id AKIA7X4DEPLOYB0T2024
```

```
UserName:  legacy-deploy-bot
AccessKeyLastUsed:
  LastUsedDate:  2024-03-02 07:41:55
  ServiceName:   s3
  Region:        us-east-2
```

Last used **2024-03-02**, more than two years ago. The key is Active and completely dormant. No pipeline uses it and no human logs in as it. It is pure downside: a credential with full control of the account that nobody uses, nobody is likely watching, and nobody remembered to turn off. This is the finding.

> `list-access-keys` reports a key's *status and age*; `get-access-key-last-used` reports its *last activity*. They are separate calls because AWS tracks the two facts separately, and the gap between "Active" and "last used in 2024" is exactly what a credential-hygiene audit exists to find. At account scale, the IAM credential report and the AWS Config rule `iam-user-unused-credentials-check` surface the same last-used data.

### Step 5 — Recover the secret (the level3 breadcrumb)

You have shown that `legacy-deploy-bot` is the dangerous identity. To carry the demonstration into level3 you need its **secret** access key, and this is where the level stays realistic: AWS will never give it to you. A secret access key is shown once, at creation, and no API returns it afterwards. `list-access-keys` gives you the key *ID* and its status, never the secret.

So where do secrets leak from? The same place dormant admin keys always do: a file someone left behind. The engagement notes pointed you at Vikram's migration tooling:

```bash
ls migration-2024/
# README.txt  bootstrap-iam-keys.env

cat migration-2024/bootstrap-iam-keys.env
```

```
# ... DELETE THIS FILE AFTER CUTOVER. — vshah, 2024-02-15
# (cutover verified 2024-04-30; this file was never deleted)

BROKER_PORTAL_SVC_ACCESS_KEY_ID=AKIABRKRPORTALSVC024
BROKER_PORTAL_SVC_SECRET_ACCESS_KEY=Cv-BrokerSvc-Pr0d-2024-Migration

MIGRATION_RUNNER_BOT_ACCESS_KEY_ID=AKIAMIGRUNNERB0T024X
MIGRATION_RUNNER_BOT_SECRET_ACCESS_KEY=8fJ2migRunner+ScopedS3/cutover2024Qk

LEGACY_DEPLOY_BOT_ACCESS_KEY_ID=AKIA7X4DEPLOYB0T2024
LEGACY_DEPLOY_BOT_SECRET_ACCESS_KEY=Ldb0t/Adm1nDeploy+Migr8/2024+us-east-2XQ

CI_DEPLOY_SVC_ACCESS_KEY_ID=AKIA3RC1DEPLOY2019XQ
CI_DEPLOY_SVC_SECRET_ACCESS_KEY=ciDeploy2019+longLived/neverR0tatedXQ8

BACKUP_SVC_ACCESS_KEY_ID=AKIABACKUPSVC2023RDS
BACKUP_SVC_SECRET_ACCESS_KEY=bkupSvc+RDSsnapshot/2023scoped/Xq7Lm2
```

The file is a bulk credential dump: five service accounts' key pairs, in cleartext, on a shared bastion. (Notice that `broker-portal-svc`'s secret is the credential you logged in with, the same value the database row held.) This is *why* the IAM enumeration mattered. The file hands you five secrets, and only the enumeration tells you which one is dangerous. `legacy-deploy-bot`'s `AccessKeyId` here (`AKIA7X4DEPLOYB0T2024`) matches the Active, dormant, AdministratorAccess key you confirmed in Step 4.

**The breadcrumb to `level3@cloud` is `legacy-deploy-bot`'s secret access key:**

```
Ldb0t/Adm1nDeploy+Migr8/2024+us-east-2XQ
```

In level3 you will assume that identity and find out what an attacker who picked up this key in 2024 would have held: full control, for two years, with nobody watching.

### If you got stuck

- **"There are 16 users. Do I check all of them?"** You can, and a thorough auditor does. But the engagement notes scope it: start with the non-human service accounts from the migration, where `legacy-deploy-bot` is the standout name.
- **"`list-access-keys` didn't give me a secret."** Correct, and it never will. No AWS API returns a secret after creation. The secret leaks from the leftover file, not from AWS.
- **"Which of the five keys in the file is the breadcrumb?"** The one whose `AccessKeyId` matches the user you found to be Active, AdministratorAccess and dormant: `legacy-deploy-bot`.

## §3 — The vulnerability

This level stacks three separate failures, and the same missing process sits under all of them.

1. **Excessive privilege (CWE-269 / CWE-250).**[^cwe-269] `legacy-deploy-bot` was granted `AdministratorAccess`, full `*:*`, to "unblock the migration."[^cwe-250] Attaching the broadest possible policy is faster than working out what a task actually needs, so under deadline pressure that is what happens, and nobody narrowed the grant afterwards. `broker-portal-svc` with account-wide IAM read is the same failure in a smaller costume.

2. **A dormant credential left enabled (NIST AC-2(3); CIS AWS 2.11).** The bot's access key has not been used since March 2024 and is still `Active`. Organizations staff *granting* access heavily, because work stops without it, and staff *removing* it barely, because nothing breaks when it is skipped. A credential nobody uses but anybody could is pure risk.

3. **The secret stored in cleartext in a leftover file (CWE-312 / CWE-798).**[^cwe-798][^cwe-312] Five service-account secrets sit in `bootstrap-iam-keys.env` on a shared host, two years after the file's own author wrote "DELETE THIS FILE AFTER CUTOVER." Long-lived static secrets are the credential type most likely to end up somewhere they shouldn't: a git history, a CI log, a backup, a bastion.

What connects them is **an identity lifecycle with a "create" step and no "destroy" step.** The bot took thirty seconds to create and would have taken thirty seconds to delete. What made it dangerous was the two years in between, when noticing it was nobody's job. The person who owned the teardown, Vikram Shah, left before the migration finished, the task had no other owner, and least privilege quietly decayed into standing admin.

There is a fourth, account-level failure too, which you will surface in §7.5: the AWS account root user still has an access key (CIS 2.4) and no MFA (CIS 2.5).

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | A least-privilege review across 16 IAM principals in Coverline's account |
| The finding | A 2024-migration `legacy-deploy-bot` still holding `AdministratorAccess`, with a still-Active access key last used in 2024 |
| Where the secret was | A leftover bootstrap-credentials file on the bastion |
| Effective scope | Administrator, which is the whole account rather than any part of it |
| Also surfaced | An orphaned terminated-employee account, a never-rotated 2019 key, and a root access key |
| Regime | SOC 2, NAIC Model 668 and NYDFS 23 NYCRR 500, 72 hours to the commissioner and to the superintendent respectively[^nycrr-500] |

**An unused administrator key is not a smaller finding than a used one.**
"Last used 2024" describes what happened, not what is possible. The
credential is Active, so its reach is the entire account: every bucket,
every database, every log group, including the logs that would record its
use. Scoping by observed activity systematically understates dormant
credentials, and dormancy is exactly what makes them attractive.

**A root access key belongs at the top of the remediation list
regardless of everything else here.** IAM policy cannot scope it, and it
is the one credential AWS's own guidance says
should not exist. It appears as a bonus find in this level, and in a real
report it would lead the executive summary.

**The pattern across all four accounts is the actual deliverable.**
A migration bot, a terminated employee, a 2019 key, and a root key are
not four unrelated items; they are one identity-lifecycle process that
creates principals and never retires them. Deactivating these four leaves
the process that produced them intact, and the next migration will produce
the next set. That is the finding a carrier's board needs to hear, and it
is the one NYDFS and NAIC examiners will test against.

## §4 — Real-world parallels

**Capital One, 2019: the over-privileged role that read 100 million records.** A former AWS engineer exploited a Server-Side Request Forgery flaw through a misconfigured web application firewall to obtain the credentials of the IAM role attached to it. That role had far more S3 permission than a WAF needs; it could list and read buckets holding about 100 million U.S. and 6 million Canadian credit-card-application records. It is the canonical least-privilege cloud failure. The SSRF was the door, but the *blast radius* came from a role granted more than its job required. The Office of the Comptroller of the Currency assessed an $80 million penalty in 2020, and the attacker was convicted in 2022.[^occ-capital-one-penalty] Scope that role to the objects the WAF actually touched and the same SSRF leaks far less.

**Cisco, 2018 (guilty plea 2020): access that outlived the job.**[^doj-cisco-webex] A Cisco engineer resigned in about April 2018. That September he got into Cisco's AWS-hosted infrastructure without permission and deployed code that deleted 456 virtual machines running WebEx Teams, taking more than 16,000 accounts offline for up to two weeks and costing Cisco roughly $2.4 million in staff time and customer refunds. He pleaded guilty in August 2020. The Justice Department's account does not say how he got back in, so read it as a cautionary tale rather than a confirmed orphaned-credential case. The lesson holds either way: five months after leaving, a former engineer could still reach production, and the gap between "left the company" and "lost access" was the whole vulnerability. `vikram.shah`'s still-Active IAM user is the same gap.

**EleKtra-Leak, 2023: long-lived keys harvested at machine speed.** Palo Alto Networks' Unit 42 documented a campaign that continuously scanned public GitHub repositories for exposed long-lived AWS access keys and, in observed cases, started using newly committed keys within *minutes*, spinning up EC2 instances for cryptomining.[^aws-iam-security-best-practices][^palo-alto-networks-unit-42] The lesson maps straight onto this level. A long-lived static key sitting in a file is not a theoretical risk; there is an active, automated market for exactly that artifact, and the gap between "the secret reached somewhere it shouldn't" and "the secret is being abused" is measured in minutes. `bootstrap-iam-keys.env` is five of them in one file.

## §5 — Frameworks, deep dive

### NIST SP 800-53 Rev. 5

**AC-6 Least Privilege** is the control at the center of this level. The base control allows "only authorized accesses for users (or processes acting on behalf of users) that are necessary to accomplish assigned organizational tasks." `AdministratorAccess` on a deploy bot is the textbook violation: the task, a one-time migration, needed a handful of S3 and database actions, not control of the whole account. The relevant enhancements:

- **AC-6(1) Authorize Access to Security Functions**: privileged access, and administering IAM is privileged, must be explicitly authorized, not handed out to unblock a deadline.
- **AC-6(2) Non-Privileged Access for Non-Security Functions**: routine work runs under non-privileged identities. A deploy pipeline is a non-security function and has no business holding security-function privilege.
- **AC-6(5) Privileged Accounts**: privileged accounts are restricted to a defined, minimal set of people or roles. A "legacy" bot is not on anyone's list of intended administrators.
- **AC-6(9) Log Use of Privileged Functions**: privileged actions are audited. An admin key nobody monitors fails this in the way that matters, because nobody would notice it being used.

The audit evidence is an entitlement review that maps each principal's effective permissions to a documented business need, plus CloudTrail logs showing privileged actions are recorded. Auditors flag any `*:*` grant, any privileged account without a named owner, and any service principal with broader access than its workload demonstrably uses.

**AC-2 Account Management**, especially **AC-2(3) Disable Accounts**, which disables accounts inactive beyond a defined period (the dormant key). The terminated employee falls under **PS-4 Personnel Termination**, which requires disabling system access and revoking credentials when someone leaves. **IA-4 Identifier Management** and **IA-5 Authenticator Management** (whose base control requires changing or refreshing authenticators on a defined schedule) cover the never-rotated 2019 CI key.

### CIS AWS Foundations Benchmark v7.0.0 — §2 Identity and Access Management

The CIS AWS Foundations Benchmark is the most directly applicable checklist here, and nearly every recommendation in §2 fails in this account.[^cis-aws-foundations-benchmark] (The IAM controls moved from Section 1 to Section 2 in v7.0.0, when a new Organizations section was added, so older write-ups citing "1.x" numbers are using a previous edition.)

- **2.4, Ensure no 'root' user account access key exists.** `get-account-summary` reports `AccountAccessKeysPresent: 1`. IAM policies do not apply to the root user, so inside the account nothing constrains that key; the only outside brake is a Service Control Policy, which needs AWS Organizations and never applies to the management account.
- **2.5, Ensure MFA is enabled for the 'root' user.** `AccountMFAEnabled: 0`.
- **2.11, Ensure credentials unused for 45 days or more are disabled.** `legacy-deploy-bot`'s key has been idle since March 2024.
- **2.12, Ensure access keys are rotated every 90 days or less.** `ci-deploy-svc`'s key dates to 2019.
- **2.14, Ensure IAM policies that allow full "*:*" administrative privileges are not attached.** That is `legacy-deploy-bot`, precisely.

The audit evidence is the IAM credential report (a CSV of every user with their keys, key ages and last-use dates) plus AWS Config rule evaluations. CIS numbering shifts between Benchmark versions, so always cite the version with the control.

### NIST CSF 2.0

**PR.AA (Identity Management, Authentication, and Access Control)** is the category in play. **PR.AA-01** (identities and credentials are managed) covers the orphaned account and the unrotated key; **PR.AA-05** (access permissions are managed, incorporating least privilege and separation of duties) covers the admin-bound bot.

### SOC 2 (Trust Services Criteria)

Coverline's SOC 2 attestation leans on the **CC6 (Logical and Physical Access)** series. **CC6.2** covers issuing credentials only to registered, authorized users and removing them when access is no longer authorized, which is the terminated employee. **CC6.3** covers authorizing, modifying and removing access based on roles, with least privilege in mind, which is the admin-bound bot. Both are gaps an auditor will write up.

### Regulatory (insurance)

**NYDFS 23 NYCRR 500.07 (Access Privileges and Management)**, as amended by the Second Amendment (effective November 2023, with provisions phased in through 2025), requires covered entities to limit privileged accounts, review access privileges at least annually, and remove or disable access that is no longer necessary. A dormant `AdministratorAccess` bot is a clean violation.[^nycrr-500] The **NAIC Insurance Data Security Model Law** imposes parallel access-control obligations, as part of the information security program, in the states that have adopted it.

### CWE

- **CWE-269 Improper Privilege Management**: the admin-bound bot.[^cwe-269] MITRE marks CWE-269 *discouraged for mapping* because it is a high-level class; the Base-level **CWE-250** below is the more precise root cause for "ran with more privilege than needed."
- **CWE-250 Execution with Unnecessary Privileges**: the migration ran with far more privilege than it needed.
- **CWE-798 Use of Hard-coded Credentials** / **CWE-312 Cleartext Storage of Sensitive Information**: the five plaintext secrets in `bootstrap-iam-keys.env`.

### MITRE ATT&CK — the persistence chain admin unlocks

A dormant administrator key is not dangerous because of what it did. It
is dangerous because of the sequence it makes available, and the in-game
post-mortem names that sequence deliberately.

**[T1098.001, Account Manipulation: Additional Cloud Credentials](https://attack.mitre.org/techniques/T1098/001/)**[^t1098-001]

The first thing an adversary does with admin is stop depending on the
credential that got them in. Minting a new access key on a *different*
principal means revoking `legacy-deploy-bot` accomplishes nothing, and
this is why incident response in cloud environments starts with
enumerating recently-created credentials rather than with disabling the
one that was found.

**[T1098.003, Account Manipulation: Additional Cloud Roles](https://attack.mitre.org/techniques/T1098/003/)**[^t1098-003]

Attaching policies or extending trust relationships spreads the
privilege across identities that individually look unremarkable. A role
whose trust policy quietly gained an extra principal is far harder to
spot than a user holding `AdministratorAccess`.

**[T1136.003, Create Account: Cloud Account](https://attack.mitre.org/techniques/T1136/003/)**[^t1136-003]

A newly created identity has no history to look anomalous against, and
in an account that already contains a terminated employee and a
seven-year-old key, one more plausible-looking principal is unlikely to
be questioned.

**[T1530, Data from Cloud Storage](https://attack.mitre.org/techniques/T1530/)**

The objective. Administrator reads every bucket in the account,
including the ones holding the claim documents from `level0@cloud`.

Read in order, the chain explains why the remediation in this level is
not "deactivate the key." It is deactivate the key, then enumerate
everything that key could have created, on the assumption that it may
already have.

## §6 — Cert exam relevance

**AWS Certified Security, Specialty (SCS-C03).** Identity and Access Management is the heart of this exam, and this level is an SCS-C03 scenario in miniature (SCS-C03 replaced SCS-C02 on December 1, 2025, and IAM's exam weight rose to 20%). Expect questions on least-privilege policy design, detecting unused credentials (the IAM credential report, IAM Access Analyzer's unused-access findings), managed versus inline policies, and Service Control Policies and permissions boundaries as account-wide guardrails. A representative item: *"A security review finds a service account with the AdministratorAccess managed policy whose access key has not been used in 18 months. Which combination of actions remediates the finding with least disruption?"* The answer: deactivate the key (don't delete it yet), confirm nothing breaks, then delete the user and give the workload a least-privilege role instead.

**AWS Certified Solutions Architect, Associate (SAA-C03).** IAM fundamentals run all through it: users versus roles, managed versus inline policies, least privilege as a design default, and the architecturally correct answer to this whole level, which is preferring short-lived role credentials (`sts:AssumeRole`, roles for instances and service accounts) over long-lived access keys, so there is no static secret to leak or rotate.

**CompTIA Security+ (SY0-701).**[^cert-security-plus] Domain 4 (Security Operations) covers identity and access management: provisioning and deprovisioning, account types, least privilege and privileged access management. A representative framing: *"A service account created for a one-time data migration still holds administrative rights several months later. Which principle was violated?"* Least privilege, with deprovisioning and account management as the supporting controls.

**ISC2 CCSP.**[^cert-ccsp] Domain 5 (Cloud Security Operations) and the IAM material in Domain 3 cover the identity lifecycle, periodic entitlement reviews and privileged-access management in cloud environments, which are exactly the program-level controls whose absence produced `legacy-deploy-bot`.

## §7 — What a defender does

**Immediately (contain the specific finding):**

1. Deactivate `legacy-deploy-bot`'s access key (`aws iam update-access-key --status Inactive`). Deactivating before deleting lets you confirm nothing legitimate breaks before the user goes entirely. Rotate every key listed in `bootstrap-iam-keys.env`, then shred the file and remove the directory.
2. Remove the root access key and enable root MFA (CIS 2.4 / 2.5).
3. Disable `vikram.shah`'s IAM user. He left in January 2024.

**Detective / continuous (find the next one automatically):**

- **AWS IAM Access Analyzer.**[^aws-iam-access-analyzer-review] Its *unused access* findings surface unused roles, users and access keys on a schedule, which turns this manual audit into a dashboard. Its *policy generation* goes further, proposing a least-privilege policy from up to 90 days of a principal's CloudTrail activity. For `legacy-deploy-bot` the proposal would come back empty, because the key has been idle for two years, and an empty proposal is its own answer: delete the user.
- **AWS Config managed rules**: `iam-user-unused-credentials-check`, `access-keys-rotated`, `iam-policy-no-statements-with-admin-access`, `iam-root-access-key-check`, `mfa-enabled-for-iam-console-access`. They evaluate continuously and alert on drift.
- **The IAM credential report and `aws iam get-account-summary`** on a cadence, plus **Trusted Advisor's** IAM checks (root MFA, access-key rotation).

**Preventive (make the failure impossible, not just visible):**

- **Service Control Policies (SCPs)** in AWS Organizations that deny attaching `AdministratorAccess` except to a named break-glass role, and restrict the root user of member accounts. With an SCP in place, "just attach admin to unblock the migration" stops being something a hurried engineer can do.
- **Permissions boundaries** that cap what any service account can be granted, whatever policy someone attaches.
- **Short-lived credentials over static keys.** Replace `legacy-deploy-bot`'s access key with a role the pipeline assumes (OIDC federation from the CI system, or an instance profile). Short-lived credentials expire on their own; there is no dormant key to find because there is no static key at all.
- **Wire HR offboarding to cloud deprovisioning.** Move people off IAM users and onto IAM Identity Center, fed by the identity provider over SCIM, so a termination revokes cloud access automatically. That closes the joiner-mover-leaver gap that left `vikram.shah` live.
- **GuardDuty** for anomalous credential use. A dormant key that suddenly wakes up from a new region or ASN is a high-fidelity alert.

### Sample detection rule (Sigma)

A dormant administrator key is dangerous precisely because nothing about
it generates events until the day it does. Two rules are worth running:
one on the credential, one on the privilege.

```yaml
title: Privileged action by a dormant or legacy IAM principal
status: experimental
description: >
  Detects API activity from principals outside the current operational
  set, particularly those holding broad managed policies. Migration bots,
  departed employees, and long-lived automation accumulate because
  nothing retires them, and each remains as capable as the day it was
  created.
logsource:
  product: aws
  service: cloudtrail
detection:
  legacy_principals:
    userIdentity.userName|contains:
      - 'legacy-'
      - 'deploy-bot'
      - 'migration'
  privileged_action:
    eventName|startswith:
      - 'Create'
      - 'Delete'
      - 'Put'
      - 'Attach'
      - 'Assume'
  condition: legacy_principals and privileged_action
falsepositives:
  - Automation that is genuinely still in service under a legacy name.
    That is a naming problem worth fixing rather than an exclusion worth
    adding, and each instance should be renamed or retired.
level: high
```

The second rule needs no tuning and should be enabled everywhere: alert on
**any** use of the account root credential. AWS's own guidance is that
root access keys should not exist, so the correct expected volume is zero
and any hit is either an emergency or an incident.

Detection is the weaker control here, and the finding should be written to
say so. The pattern across the four accounts in this level is a single
identity-lifecycle process that creates principals and never retires them,
and no alert fixes that. An
[IAM credential report](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html)
reviewed on a schedule, plus automated disablement past a dormancy
threshold, addresses the class. Deactivating these four addresses the
instances, and the next migration will produce the next set.

## §7.5 — Optional exploration

The credential chain works without this section; recovering `legacy-deploy-bot`'s key from `bootstrap-iam-keys.env` is all level3 needs. But `level2@cloud` hides **three** bonus finds that fire when you run specific commands during the audit, and `progress --detail` from any prompt lists what you have unlocked.

### Ghost of a terminated admin

**Trigger:** any `aws` command that inspects `vikram.shah`, such as `aws iam list-access-keys --user-name vikram.shah` or `aws iam list-attached-user-policies --user-name vikram.shah`.

`vikram.shah` left Coverline on 2024-01-31 (he is the terminated `USR-004` from yesterday's `users` table). His IAM user is still here with `PowerUserAccess`, which is full access to everything *except* IAM and Organizations management: not admin, but not far off. It also holds an access key created in 2022 that is still `Active`, last used two days before he left. Disabling a departing employee *everywhere* is the "leaver" half of joiner-mover-leaver, and it is easy to skip because HR offboarding and cloud IAM deprovisioning are rarely the same workflow. In ATT&CK terms this is **T1078.004 (Valid Accounts: Cloud Accounts)**: a valid credential nobody revoked is the cleanest persistence an attacker can inherit, with no malware and no exploit.[^t1078-004] The Cisco case in §4 shows what a departed engineer with working access can do.

### A key older than the cloud team

**Trigger:** `aws iam list-access-keys --user-name ci-deploy-svc` (the output shows a 2019 `CreateDate`).

`ci-deploy-svc`'s access key was created on 2019-06-03 and is still `Active` in 2026: seven years old and never rotated. Unlike `legacy-deploy-bot`'s key it *is* in regular use, so the finding is age, not dormancy. **CIS AWS Foundations Benchmark 2.12** calls for rotating access keys every 90 days or less, and both Trusted Advisor and the IAM credential report show key age. The deeper point is that a key that has existed for seven years has had seven years of chances to leak into a git history, a CI log, a laptop backup or a screenshot. The modern fix is not "rotate it more often". It is to get rid of the long-lived key in favor of short-lived role credentials (OIDC federation from the CI system), so there is no static secret whose age you have to manage.

### Root still has an access key

**Trigger:** `aws iam get-account-summary` (the `SummaryMap` shows `AccountAccessKeysPresent: 1`).

The account summary reports that the AWS account **root user** has a long-lived access key, and that root MFA is off (`AccountMFAEnabled: 0`). This is **CIS AWS Foundations Benchmark 2.4**, and it is about as serious as account-level findings get. The root user is the account's original identity and IAM policies do not apply to it; only an SCP can restrict it, and only in a member account of an AWS Organization. A leaked root key is close to the worst credential an attacker can hold. Best practice is unambiguous: the root user should have **no** access keys, should have MFA, and should be used only for the handful of tasks that genuinely require it (closing the account, changing the support plan and a few others). Everything else runs through IAM principals you can actually constrain.

## §8 — Key takeaways

- **Least privilege is a continuous subtraction, not a one-time setting.** Grants accumulate and almost nothing removes them. Without a process that keeps asking "does this principal still need this?", access only ever grows.
- **Check the policy, not the name.** `legacy-deploy-bot` and `migration-runner-bot` came out of the same migration for similar jobs; one got `AdministratorAccess` and the other got three scoped S3 actions. Only reading what is attached tells them apart.
- **"Active" and "last used" are different questions, so ask both.** A credential that is enabled but unused for months is all risk and no upside. `list-access-keys` answers the first; `get-access-key-last-used` answers the second.
- **AWS never returns a secret after creation, so dormant keys leak from files, not APIs.** The realistic places to find a secret are a leftover bootstrap file, a CI variable dump, a backup or a git history. Get rid of long-lived static keys (roles, short-lived credentials) and there is no secret to leak.
- **The "leaver" half of joiner-mover-leaver is the half that gets skipped.** Wire offboarding to deprovisioning, or terminated employees keep working credentials, sometimes for years.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, CIS Benchmark control numbers, regulation citation IDs, breach-case figures and dates) verified current as of the review date. Standards drift; if you're reading this more than 6-12 months past the review date, re-check the cited versions before quoting them in audit work.*

[^aws-iam-security-best-practices]: [AWS IAM security best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html).
[^aws-iam-access-analyzer-review]: [AWS IAM Access Analyzer: review unused access](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-manage-unused.html).
[^cis-aws-foundations-benchmark]: [CIS AWS Foundations Benchmark](https://www.cisecurity.org/benchmark/amazon_web_services).
[^t1078-004]: [MITRE ATT&CK T1078.004 Valid Accounts: Cloud Accounts](https://attack.mitre.org/techniques/T1078/004/).
[^cwe-269]: [MITRE CWE-269: Improper Privilege Management](https://cwe.mitre.org/data/definitions/269.html).
[^palo-alto-networks-unit-42]: [Palo Alto Networks Unit 42 EleKtra-Leak: AWS access keys harvested from public GitHub](https://unit42.paloaltonetworks.com/malicious-operations-of-exposed-iam-keys-cryptojacking/).
[^nycrr-500]: [NYDFS 23 NYCRR 500 (Cybersecurity Requirements, amended)](https://www.dfs.ny.gov/industry_guidance/cybersecurity).
[^cert-ccsp]: [ISC2 CCSP — certification exam outline](https://www.isc2.org/certifications/ccsp/ccsp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cwe-250]: [CWE-250](https://cwe.mitre.org/data/definitions/250.html).
[^cwe-312]: [CWE-312](https://cwe.mitre.org/data/definitions/312.html).
[^cwe-798]: [CWE-798](https://cwe.mitre.org/data/definitions/798.html).
[^t1098-001]: [MITRE ATT&CK — T1098.001: Account Manipulation: Additional Cloud Credentials](https://attack.mitre.org/techniques/T1098/001/).
[^t1098-003]: [MITRE ATT&CK — T1098.003: Account Manipulation: Additional Cloud Roles](https://attack.mitre.org/techniques/T1098/003/).
[^t1136-003]: [MITRE ATT&CK — T1136.003: Create Account: Cloud Account](https://attack.mitre.org/techniques/T1136/003/).
[^doj-cisco-webex]: [Former Cisco engineer sentenced for deleting 16,000 WebEx accounts (DOJ, N.D. Cal.)](https://www.justice.gov/usao-ndca/pr/san-jose-man-sentenced-two-years-imprisonment-damaging-cisco-s-network). 456 virtual machines deleted; 16,000 accounts down for up to two weeks; $1.4 million in restoration and over $1 million refunded.
[^occ-capital-one-penalty]: [OCC assesses $80 million civil money penalty against Capital One (2020)](https://www.occ.gov/news-issuances/news-releases/2020/nr-occ-2020-101.html).

### Further reading

- [AWS Generate least-privilege policies from CloudTrail activity](https://docs.aws.amazon.com/IAM/latest/UserGuide/access-analyzer-policy-generation.html).
- [AWS Root user best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html).
- [NIST SP 800-53 Rev. 5 (AC-6 Least Privilege)](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
- [NIST Cybersecurity Framework 2.0](https://www.nist.gov/cyberframework).
