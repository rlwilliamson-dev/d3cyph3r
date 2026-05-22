// Web track levels.
//
// See levels/linux.js for the full schema documentation. Web-specific
// fields used by js/commands/web.js:
//
//   web           — map of URL → response body string (for `curl <url>`).
//   webHeaders    — map of URL → headers object (for `curl -I <url>`).
//                   The HTTP/1.1 status goes in under the special key
//                   "HTTP/1.1", e.g. { "HTTP/1.1": "200 OK", ... }.
//   gobusterRes   — map of URL → array of result lines for `gobuster <url>`.
//                   Each entry is a single line like
//                   "/admin                (Status: 401) [Size: 287]".
//   cookieData    — map of URL → { name: value } cookie jar (for `cookies`).
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts (FERPA here, for the
// Meridian State University engagement).

export const webLevels = {

  // ── level 0 — "Meridian's Forgotten Backup Folder" ───────────────
  // The player's first web-recon task: a cyber-insurance carrier has
  // asked Meridian State University for a third-party web audit ahead
  // of policy renewal. The university's in-house web dev (Carlos)
  // inherited a public web stack from a dismissed agency (BluePier
  // Digital). gobuster reveals that BluePier left a /backup/ directory
  // with autoindex on, containing a CSV of student records (FERPA
  // violation) and a plaintext DB credential breadcrumb. The lesson is
  // CWE-548 (Information Exposure Through Directory Listing) / CWE-552
  // (Files or Directories Accessible to External Parties), mapped to
  // FERPA (34 CFR Part 99), NIST 800-171, and OWASP A05 (Security
  // Misconfiguration). Introduces `gobuster` and `curl`.
  "level0@web": {
    password: null,
    track: "web",
    playerUser: "secops",
    objective: "Audit Meridian State University's public web stack ahead of their cyber-insurance renewal. Find anything BluePier Digital left behind that the carrier's reviewer would flag.",
    lesson: "Meridian State University is one of Driftwood's smaller clients — public regional uni in Oregon, ~30,000 students, FERPA in scope across all student-record systems. Their cyber-insurance policy is up for renewal and the carrier requires a third-party web audit as a renewal condition. Carlos, Meridian's in-house web developer, inherited the public web stack from a dismissed agency (BluePier Digital) that left work-product files scattered on the production server. He's been cleaning them up but suspects he hasn't caught all of them. You're on Driftwood's web-audit workstation (the shell calls you `secops`, the shared service account the security team uses for client recon). Read welcome.md first — it explains gobuster. Then read engagement-notes.md, then meridian-scope.txt, then start enumerating. Read lessons-learned.md once you've found the FERPA-grade exposure.",
    web: {
      "https://www.meridian.edu":
`<!DOCTYPE html>
<html lang="en">
<head><title>Meridian State University — A public university in the Pacific Northwest</title></head>
<body>
<h1>Meridian State University</h1>
<p>Founded 1893. ~30,000 students. Cedarbrook, Oregon.</p>
<nav>
  <a href="/about">About</a>
  <a href="/admissions">Admissions</a>
  <a href="/financial-aid">Financial Aid</a>
  <a href="/student-portal">Student Portal</a>
  <a href="/contact">Contact</a>
</nav>
<p>Welcome to Meridian. Apply by January 15 for fall enrollment.</p>
</body>
</html>`,
      "https://www.meridian.edu/":
`<!DOCTYPE html>
<html lang="en">
<head><title>Meridian State University — A public university in the Pacific Northwest</title></head>
<body>
<h1>Meridian State University</h1>
<p>Founded 1893. ~30,000 students. Cedarbrook, Oregon.</p>
<nav>
  <a href="/about">About</a>
  <a href="/admissions">Admissions</a>
  <a href="/financial-aid">Financial Aid</a>
  <a href="/student-portal">Student Portal</a>
  <a href="/contact">Contact</a>
</nav>
<p>Welcome to Meridian. Apply by January 15 for fall enrollment.</p>
</body>
</html>`,
      "https://www.meridian.edu/robots.txt":
`User-agent: *
Disallow: /admin/
Disallow: /backup/
Disallow: /staging/
Disallow: /private/

Sitemap: https://www.meridian.edu/sitemap.xml`,
      "https://www.meridian.edu/admin":
`<html>
<head><title>401 Unauthorized</title></head>
<body>
<h1>401 Unauthorized</h1>
<p>Authentication is required to access this resource. Contact the Meridian IT helpdesk if you need access.</p>
</body>
</html>`,
      "https://www.meridian.edu/backup":
`<html>
<head><title>Index of /backup</title></head>
<body>
<h1>Index of /backup</h1>
<hr>
<pre>
<a href="../">../</a>
<a href="README.txt">README.txt</a>                  2023-08-14 11:42      1.2K
<a href="db-creds.txt">db-creds.txt</a>                2023-08-14 11:43       128
<a href="students_export_2023.csv">students_export_2023.csv</a>    2023-08-14 11:38      482K
</pre>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at www.meridian.edu Port 443</address>
</body>
</html>`,
      "https://www.meridian.edu/backup/":
`<html>
<head><title>Index of /backup</title></head>
<body>
<h1>Index of /backup</h1>
<hr>
<pre>
<a href="../">../</a>
<a href="README.txt">README.txt</a>                  2023-08-14 11:42      1.2K
<a href="db-creds.txt">db-creds.txt</a>                2023-08-14 11:43       128
<a href="students_export_2023.csv">students_export_2023.csv</a>    2023-08-14 11:38      482K
</pre>
<hr>
<address>Apache/2.4.41 (Ubuntu) Server at www.meridian.edu Port 443</address>
</body>
</html>`,
      "https://www.meridian.edu/backup/README.txt":
`BluePier Digital — Meridian University engagement
Working directory for deploy artifacts and DB exports.

This directory lives on the production server's filesystem at
/var/www/meridian/public/backup/ and is excluded from the
site's static-build .gitignore. It is NOT excluded from Apache's
autoindex configuration, which is on by default in /etc/apache2/
mods-enabled/autoindex.conf for any directory under DocumentRoot
that does not contain an index.html.

Files here are leftover work-product from the 2023 deploy cycle.
Will clean up after final invoice is paid.
                                                — James, 2023-08-14`,
      "https://www.meridian.edu/backup/db-creds.txt":
`BluePier Digital — Meridian webapp environment notes
Last updated by James 2023-08-14

== Production DB (mysql) ==
Host:     db.meridian.edu (internal only, port 3306)
User:     webapp_admin
Pass:     M3rid14n!2023-prod
DB name:  meridian_portal

NOTE FOR HANDOFF: rotate this before final acceptance.
                  Carlos's team needs to pick a new value.
                  Reminder: this credential is also baked into
                  the staging deployment until we cut over.`,
      "https://www.meridian.edu/backup/students_export_2023.csv":
`student_id,first_name,last_name,email,major,gpa
M-1872941,Aisha,Patel,patel.a@meridian.edu,Computer Science,3.91
M-1872995,Marcus,Reyes,reyes.m@meridian.edu,Biology,3.42
M-1873041,Jordan,Smith,smith.j@meridian.edu,Mechanical Engineering,2.88
M-1873100,Linh,Tran,tran.l@meridian.edu,English Literature,3.76
M-1873112,Tyler,Brooks,brooks.t@meridian.edu,Computer Science,3.05
M-1873198,Sara,Kapoor,kapoor.s@meridian.edu,Pre-Med,3.94
M-1873220,Dmitri,Volkov,volkov.d@meridian.edu,Physics,3.61
M-1873244,Olivia,Chen,chen.o@meridian.edu,Music Performance,3.88

[output truncated — file contains 4,217 records totaling 482 KB]`,
    },
    webHeaders: {
      "https://www.meridian.edu": {
        "HTTP/1.1": "200 OK",
        "Server": "Apache/2.4.41 (Ubuntu)",
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Length": "412",
      },
      "https://www.meridian.edu/backup/": {
        "HTTP/1.1": "200 OK",
        "Server": "Apache/2.4.41 (Ubuntu)",
        "Content-Type": "text/html; charset=UTF-8",
      },
      "https://www.meridian.edu/admin": {
        "HTTP/1.1": "401 Unauthorized",
        "Server": "Apache/2.4.41 (Ubuntu)",
        "WWW-Authenticate": "Basic realm=\"Meridian Admin\"",
        "Content-Type": "text/html; charset=UTF-8",
      },
    },
    gobusterRes: {
      "https://www.meridian.edu": [
        "/                     (Status: 200) [Size: 412]",
        "/about                (Status: 200) [Size: 8412]",
        "/admin                (Status: 401) [Size: 287]",
        "/admissions           (Status: 200) [Size: 12104]",
        "/backup               (Status: 200) [Size: 1183]",
        "/contact              (Status: 200) [Size: 4521]",
        "/financial-aid        (Status: 200) [Size: 9876]",
        "/login                (Status: 200) [Size: 2018]",
        "/robots.txt           (Status: 200) [Size: 142]",
        "/student-portal       (Status: 302) [Size: 0]",
      ],
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Web Audit Workstation ─────────────────

You're logged in as \`secops\` — the security team's shared service
account. The host \`web\` is our audit workstation for client web
reconnaissance.

Today's client: Meridian State University. Their cyber-insurance
carrier requires a third-party web audit before policy renewal.
Carlos (their in-house web dev) suspects a dismissed agency left
artifacts on the production server he hasn't cleaned up. Find
them.


─── NEW COMMANDS ──────────────────────────────────────────────

  gobuster <url>     Brute-force-discover hidden URL paths using
                     a built-in wordlist of common names.

  curl <url>         Fetch a URL and print the response body.
                     The browser-less way to look at a page.

  curl -I <url>      Fetch only the response headers (no body).


─── WHAT GOBUSTER DOES ────────────────────────────────────────

Web servers expose URLs. Some are linked from the site nav
(/about, /admissions). Others aren't linked anywhere but still
respond when asked: an old admin panel, a staging API, a backup
directory nobody removed.

gobuster fires HTTP requests at ~4,600 common path names from
/usr/share/wordlists/dirb/common.txt and reports which ones the
server answered for.

Status codes you'll see:

  200    OK — path exists, server returned content.
         Anything 200 you didn't intend to expose is a finding.
  302    Redirect — path exists; server sends you elsewhere.
         Usually fine (e.g. login walls, http → https).
  401    Unauthorized — path exists, requires auth. Good.
  403    Forbidden — path exists, access blocked. Also fine.
  404    Not found — gobuster filters these out by default.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Meridian / Carlos / FERPA
  2.  cat meridian-scope.txt      The URL in scope today
  3.  gobuster <that URL>         Enumerate paths
  4.  curl <interesting path>     Confirm the finding
  5.  cat lessons-learned.md      Post-mortem (read after step 4)`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Meridian State University — engagement notes

Client: Meridian State University
Vertical: Higher education (public regional university, ~30,000
          students, Cedarbrook, Oregon)
Engagement: New (this is our first piece of work for them)
Driftwood handler: Priya
Client counterpart: Carlos (in-house web developer, ~8 months
                    in role)
Compliance regime: FERPA (Family Educational Rights and Privacy
                   Act, 20 U.S.C. § 1232g; 34 CFR Part 99).
                   Applies to all "education records" containing
                   personally-identifiable information about
                   currently-enrolled or formerly-enrolled
                   students. Meridian receives federal financial
                   aid, so FERPA is non-negotiable. GLBA also
                   applies to the financial aid office's records;
                   HIPAA applies to the student health center.
                   Today's audit is scoped to FERPA-bearing
                   surface area on the public web.

## How this engagement happened

Meridian's cyber-insurance carrier (Cedarwood Mutual) notified
them in March that their policy is up for renewal in July and
that the renewal terms now require a third-party web audit. This
is becoming the norm across cyber-insurance — the carriers got
tired of paying out on directory-traversal and exposed-backup
incidents at universities and started writing audits into the
renewal checklist.

Meridian asked their existing vendors first; none had capacity in
this quarter. They found Driftwood through the Pacific Northwest
public-higher-ed mailing list. This is our first engagement with
them, and Priya is keen on it converting into ongoing work.

## What Carlos told us

Carlos came on as Meridian's in-house web developer eight months
ago. Before him, Meridian outsourced the public web stack to
BluePier Digital — a Bay Area agency that built the current site
in 2021. The relationship ended in 2024 after a contract dispute
about scope and final invoicing.

When Carlos took over the production server, he found a sprawl
of leftover work-product files: zipped deploy artifacts, draft
content, scratch directories, a couple of \`.env\` files in
places they shouldn't have been. He's been finding and removing
them as he runs into them. He told Priya, verbatim:

  "There's definitely more I haven't found. I've been doing this
   solo. If you're going to scan the site I'd rather you find
   what's left now than have the insurance carrier find it later."

Carlos is sympathetic. He inherited a mess. The agency that made
the mess is no longer reachable and was not contractually obligated
to clean up at exit (the contract dispute happened before any final
handoff was agreed).

## Scope for today

See meridian-scope.txt. One hostname (the main public site).
Carlos has authorized active recon against it — he's already
told the SOC that scans from Driftwood's source IP block are
expected this week.

## Why FERPA matters here

FERPA is a different beast from HIPAA or PCI-DSS — it has no fine
schedule. The enforcement mechanism is "the federal government can
withdraw your funding," which is existential for a public
university. Roughly: any disclosure of a student's "education
record" (grades, enrollment, financial aid, disciplinary records,
contact info beyond directory data) to a party without legitimate
educational interest is a violation. Meridian's annual FSA
(Federal Student Aid) reporting includes a compliance attestation.

If we find student records exposed to the open internet, that's
not just an insurance-renewal risk — it's a federal-funding risk.
Surface it with the right urgency.

— Priya`
        },

        "meridian-scope.txt": {
          type: "file",
          content:
`# Meridian State University — web audit scope
# Public-facing hostname authorized for active recon under
# this engagement.

  https://www.meridian.edu   main public site (marketing, admissions,
                             student portal entry, financial-aid info)

# Out of scope (per Carlos):
#   - Any *.meridian.edu hostname other than www.
#   - The student portal application itself (portal.meridian.edu)
#     — that's behind SSO and contractually a separate audit.
#   - Internal hostnames (db.*, jumphost.*, etc).
#
# Today's audit is "what does the open internet see when it looks
# at www.meridian.edu?" Enumerate paths with gobuster, fetch the
# interesting ones with curl, write up what shouldn't be there.
#
# Last updated: 2026-05-20 — Priya (post-kickoff with Carlos)`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`# Post-mortem: what you just found, and why it matters

You just confirmed that Meridian State University's public web
server is hosting — at a guessable URL with autoindex enabled —
a CSV of 4,217 student records (names, IDs, emails, majors, GPAs)
left behind by a dismissed agency two years ago. You also found
a plaintext database credential in the same directory that the
agency's parting note explicitly said needed rotation, and which
almost certainly was never rotated.

The student records alone are a FERPA-grade exposure. The
combination — exposure plus a live credential to the internal
database — is the kind of finding that becomes a published
breach disclosure if an attacker gets there before a defender does.

## The blunt version

Two distinct failures stack on top of each other in this finding,
and both are textbook:

  1. AUTOINDEX. Apache (and nginx, and IIS) will, by default in
     many distributions, render a browseable directory listing
     for any URL that resolves to a directory containing no
     \`index.html\`. A request to \`/backup/\` returns the contents
     of the filesystem directory at \`/var/www/.../backup/\`.
     Nobody linked to that URL. Nobody published it. The web
     server published it the moment the directory was created
     without an index file.

  2. STORING ARTIFACTS UNDER DOCUMENTROOT. The directory shouldn't
     have been served at all. The agency put working files in a
     subdirectory of the public web root because that was the
     most convenient place to scp things to. Once a file lives
     under DocumentRoot, it is — by definition — published on the
     internet, regardless of whether anyone shared the URL.

Each of these is a security misconfiguration. Together, they are
the most common cause of "credential leak from a public web
server" incidents in published breach reports. Source-code
backups, .git directories, database dumps, .env files, and "old
admin panel I forgot about" all show up here.

The robots.txt entry is, separately, an own goal:

    Disallow: /backup/

That line was meant to keep crawlers out of /backup/. What it
actually does is publish a list of the exact URLs the defender
considers sensitive. Every reconnaissance script reads robots.txt
first. "Security through robots.txt" is a category mistake.

## The consulting-firm angle

For Meridian specifically, this finding lands in two places at
once:

  - INSURANCE: Cedarwood Mutual asked for an audit before
    renewal. The audit found exactly the class of issue the
    carriers are pricing into renewals. The right play is to
    surface this to Carlos today, give him 24 hours to remediate
    (the fix is "rm -r /var/www/meridian/public/backup && systemctl
    reload apache2 && rotate the DB credential"), and then write
    up the finding plus the remediation in the same document.
    The carrier sees that the audit caught the issue AND that
    remediation happened; renewal goes through.

  - FERPA: Student records were exposed to anyone with curl and
    a guessable URL. Meridian's general counsel needs to know
    today. FERPA does not have a hard breach-notification clock
    like HIPAA's 60 days, but the Department of Education's
    Privacy Technical Assistance Center expects affected students
    to be notified "in a reasonable time" and offers a notification
    template. The federal financial aid attestation is annual; a
    documented exposure has to be disclosed in the next cycle.

For Driftwood: Carlos is sympathetic. The mess wasn't his — he
inherited it. The conversation should not start with "you have a
problem"; it should start with "we found what BluePier left."
That tonal difference is the difference between Driftwood landing
ongoing work with Meridian and not landing it.

## Frameworks that cover this

  FERPA (20 U.S.C. § 1232g; 34 CFR Part 99)
    34 CFR 99.31  — conditions for disclosure of PII from
      education records. A publicly-readable URL is not on the
      list of authorized disclosure mechanisms.
    34 CFR 99.32  — recordkeeping requirements for disclosures.
      An exposed CSV creates an undocumented, undated, untracked
      "disclosure" to an unknown number of recipients.

  NIST SP 800-171 Rev. 2 (Protecting CUI in non-federal systems —
  the standard most US universities map to for federal-data
  handling)
    3.1.20  — Verify and control / limit connections to and use
      of external information systems. A public autoindex
      satisfies neither verification nor limitation.
    3.13.1  — Monitor, control, and protect organizational
      communications at the external boundaries.

  NIST SP 800-53 Rev. 5
    AC-3   Access Enforcement — autoindex enforces no access
      control on a directory containing sensitive data.
    SC-7   Boundary Protection — the public web server is the
      boundary; it's the wrong place to keep internal artifacts.
    CM-6   Configuration Settings — autoindex should be off on
      production unless a directory is explicitly intended to
      be a public download index.

  CIS Critical Security Controls v8
    4.1   Establish and Maintain a Secure Configuration Process
      — autoindex-off is a baseline-config item.
    4.8   Uninstall or Disable Unnecessary Services on
      Enterprise Assets — Apache's mod_autoindex is "unnecessary"
      on the vast majority of production deployments.

  CWE
    CWE-548  Exposure of Information Through Directory Listing
      — the precise pattern in autoindex.
    CWE-552  Files or Directories Accessible to External Parties
      — the underlying weakness: artifacts under DocumentRoot.
    CWE-200  Exposure of Sensitive Information to an Unauthorized
      Actor — the student records.
    CWE-798  Use of Hard-coded Credentials — the DB password in
      db-creds.txt.

  OWASP Top 10 (2021)
    A05  Security Misconfiguration — autoindex left on, robots.txt
         listing sensitive paths, artifacts in the web root: this
         is the canonical example.
    A01  Broken Access Control — the records are accessible to
         anyone who guesses the path.

## Where this shows up on certifications

  CompTIA Security+ (SY0-701)
    Domain 2 (Threats, Vulnerabilities, and Mitigations) — web
    application vulnerabilities, security misconfiguration.

  CompTIA PenTest+ (PT0-002)
    Domain 3 (Attacks and Exploits) — directory enumeration is a
    named technique. Domain 2 (Information Gathering) — web
    reconnaissance with gobuster / ffuf / dirb is on the exam.

  CompTIA CySA+ (CS0-003)
    Domain 2 — reconnaissance detection.

  CISSP
    Domain 3 (Security Architecture and Engineering) — secure
    web architecture, defense in depth. Domain 7 (Security
    Operations) — vulnerability management.

  OSCP / PEN-200
    "gobuster / ffuf the target" is on every published OSCP
    walkthrough. Finding /backup, /admin-old, /.git, or /.svn
    on a public web server is one of the highest-yield
    openings in the exam labs and in real engagements.

## MITRE ATT&CK mapping

What you simulated maps to:

  T1083    — File and Directory Discovery. Enumerating paths
             on the target, which is what gobuster does.
  T1595.003 — Active Scanning: Wordlist Scanning. The specific
             sub-technique for directory brute-forcing.
  T1190    — Exploit Public-Facing Application. What an
             attacker does with the credential leak you found.
  T1078    — Valid Accounts. The DB credential combined with
             the internal database reachable from any host
             inside Meridian's network.

T1595.003 is the canonical opening move in published reports of
"attacker exfiltrated database via exposed credentials in a
publicly-accessible backup directory." That's not a rare incident
pattern; it's a weekly one.

## What a defender should actually do about this

  1. Remove the directory. \`rm -r /var/www/meridian/public/backup/\`
     then reload Apache. Nothing in /backup/ should ever have been
     under DocumentRoot.

  2. Turn off autoindex globally. \`a2dismod autoindex\` on Debian
     /Ubuntu Apache. Then explicitly opt in any directory that's
     genuinely meant to be a public download index (most sites
     have zero such directories). The default for production
     should be off.

  3. Rotate the database credential. The value in db-creds.txt
     should be considered burned regardless of whether anyone
     was reading the file. Issue a new password, deploy it to
     every service that uses it (Carlos will need to find them
     all — start with the staging deployment the README mentioned),
     then revoke the old one.

  4. Scan the rest of DocumentRoot for similar artifacts. The
     agency's pattern is unlikely to have produced exactly one
     orphan. Tools: dirsearch / gobuster / ffuf against your own
     site with a large wordlist. \`find /var/www -name "*.bak"
     -o -name "*.sql" -o -name "*.zip" -o -name ".env*"\` against
     the filesystem. Set up Continuous Attack Surface Management
     (Detectify, Tenable ASM, Censys, Bishop Fox CAST, Microsoft
     Defender External ASM) so the next orphan is caught when
     it appears, not two years later.

  5. Fix the robots.txt. Don't list sensitive paths there. The
     way to keep something off the public internet is to not
     publish it; the way to keep it out of search engines is the
     same.

  6. Notify affected students. FERPA expects "reasonable" timing.
     The Privacy Technical Assistance Center (PTAC) at the
     Department of Education publishes a notification template;
     the general counsel will know the local IRB process.

  7. Long-term: stand up a deployment pipeline that does not let
     working files land in DocumentRoot. CI/CD that builds in
     /tmp and rsyncs only the build output to /var/www. A
     .htaccess deny-all in any directory not explicitly meant to
     be public. Code review on web-server config changes.

## Closing thought

The agency that did this is gone. The mistake stayed for two
years. That gap — between "the people who made the decision
left" and "the consequence of the decision shows up" — is the
gap every web audit lives in. The fix is mundane: delete the
directory, rotate the credential, turn autoindex off, and don't
put internal files in the public web root. The harder part is
the institutional habit of catching it the first time it
happens, instead of two years later when the cyber-insurance
carrier asks.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
