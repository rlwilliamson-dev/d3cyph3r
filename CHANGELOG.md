# Changelog

All notable changes to D3CYPH3R are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.2] - 2026-05-23

Another content addition under the documentation infrastructure
introduced in v0.7.0. No user-facing changes to the game itself;
the new content lives at the same non-indexable subpath and is not
linked from anywhere player-visible.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.
- Pre-merge link-audit pass performed per the v0.7.1-established
  procedure. Audit findings (if any) applied before merge.

## [0.7.1] - 2026-05-23

Content addition under the documentation infrastructure introduced
in v0.7.0. No user-facing changes to the game itself; the new
content lives at the same non-indexable subpath and is not linked
from anywhere player-visible.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.

## [0.7.0] - 2026-05-23

Internal documentation infrastructure. No user-facing changes to the
game itself in this release; the work scaffolds a long-form content
surface that will be revealed in a later release. Game behavior is
unchanged — the lobby, every existing track, and every existing level
behave identically to v0.6.

### Added

- Documentation scaffolding under a non-indexable subpath. Not linked
  from the main site, the lobby, the README, or anywhere else the
  player can encounter it. `robots.txt` and a `noindex,nofollow,noarchive`
  meta tag keep it out of search engines. Per-level content will land
  here over time; user-facing surfacing waits for a later release.
- Vendored markdown renderer (`marked` v12.0.2, MIT-licensed,
  self-hosted) so the CSP `script-src 'self'` policy stays intact —
  no CDN dependencies, no policy relaxation.
- Hash-based client routing for the new subsite, so no Azure Static
  Web Apps rewrite configuration is required.
- Author guide for the new content surface, documenting format,
  voice, length expectations, and sourcing rules for future
  contributors (including a 10-section template with equal-depth
  treatment of each cited certification).
- First reference document published under the new scaffolding. Not
  linked from anywhere player-visible.

### Changed

- Version-bump checklist (in `js/engine/version.js` header) extended
  with a soft-gate step for the new content surface as part of the
  per-level shipping process. The anti-spoiler rule from the existing
  checklist explicitly does NOT apply to content under the new
  subpath (which is designed to be the intended destination for full
  solve detail).
- `robots.txt` added at the repo root: main site stays indexable; the
  new subpath is disallowed for all user-agents.

## [0.6.0] - 2026-05-22

"All seven engagement slots playable." The Cloud track ships its
first level, which is also the seventh and final track to get one.
Every track that was wired into the lobby now has at least one
playable level0; the next phase of the roadmap shifts to level1
content across the tracks that have breadcrumb credentials staged.

This release also extends the cloud engine slightly to model the
real-AWS `AccessDenied` response for properly-locked-down S3 buckets
— a small but pedagogically important addition, because for an
auditor-perspective bucket review, "AccessDenied is what GOOD looks
like" is the headline lesson.

### Added

- `level0@cloud` — "Coverline's Twelfth Bucket." First level of the
  Cloud track (and the seventh and final track to get a level0 — all
  seven engagement slots are now playable). Driftwood is asked by
  Coverline Insurance (mid-sized insurtech, SOC 2 Type II in scope,
  NAIC Insurance Data Security Model Law + NYDFS 23 NYCRR 500 + GLBA
  Safeguards Rule layered on top) to walk a SOC 2 auditor's worksheet
  of 6 production S3 buckets. Player runs
  `aws s3 ls --no-sign-request s3://<bucket>` against each. Four
  return `AccessDenied` (correctly locked down), one is intentionally
  public (marketing CDN — flagged as expected in the worksheet, the
  "context matters" beat), and one — `coverline-claims-uploads-prod`
  — returns an unexpected listing containing 2024-Q1 claims files
  (PII: claimant names, masked SSNs, addresses, claim amounts) AND
  a stale 2023 region-cutover migration script with a hardcoded RDS
  master password. Teaches the `aws s3 ls --no-sign-request` and
  `aws s3 cp` workflow. Maps to SOC 2 Trust Services Criteria
  (CC6.1, CC6.6, CC6.7, CC7.1), NIST SP 800-53 Rev. 5 (AC-3 / AC-6 /
  SC-7 / AU-12), NIST CSF 2.0 (PR.AA / PR.DS / DE.CM), CIS AWS
  Foundations Benchmark v3.0.0 (§2.1.1–2.1.6), ISO/IEC 27017,
  OWASP Cloud-Native Top 10 (CNAS-1, CNAS-7), CWE-200 / CWE-732 /
  CWE-285 / CWE-798 / CWE-540, NAIC Insurance Data Security Model
  Law, NYDFS 23 NYCRR 500.03 / 500.15 / 500.17, GLBA Safeguards Rule
  (16 CFR 314.4), and MITRE T1530 (Data from Cloud Storage Object) /
  T1602 / T1078.004 / T1213 / T1580. The hardcoded credential in the
  migration script is the natural breadcrumb gate for a future
  `level1@cloud`, matching the per-track credential-chain pattern.
- New client: **Coverline Insurance** — insurtech (P&C insurance for
  small businesses, ~150 engineers, founded 2019, headquartered in
  Hartford CT), SOC 2 Type II in active fieldwork, NAIC / NYDFS /
  GLBA in scope. Introduces two new recurring characters: Jordan
  Nguyen (Sr. Director of Cloud Infrastructure & Platform, the
  engagement counterpart) and a brief reference to Sloane Becker
  (CISO).
- **Engine extension** — `js/commands/cloud.js` gains a small
  `deniedBuckets` schema field on `level.cloud.s3`. When a bucket
  name is in the list, both `aws s3 ls` and `aws s3 cp` return the
  real-AWS-shaped `An error occurred (AccessDenied) when calling
  the <op> operation: Access Denied` response instead of the
  previous `NoSuchBucket` (which was wrong for "exists but
  locked down"). Teaches that `AccessDenied` is what GOOD looks
  like for a properly-secured bucket probed from outside.
- Playtest grows 190 → 226 (+36 checks): full `level0@cloud`
  walkthrough — connect with the `cloudsec` shared service account,
  file listing, engagement-notes / audit-worksheet / lessons-learned
  content citations (SOC 2 Type II, NAIC, NYDFS, Jordan continuity),
  AccessDenied response on each of the four locked-down buckets,
  expected-public listing on the marketing bucket, unexpected listing
  on the misconfigured claims bucket, `aws s3 cp` reads on the PII
  claim file and the migration script, defense-in-depth check that
  `aws s3 cp` against a denied bucket also returns AccessDenied, and
  post-mortem citations (SOC 2 CC6.1, CWE-200, CWE-798, MITRE T1530,
  CIS AWS Foundations Benchmark, AWS Block Public Access). The two
  scaffolded-track smoke checks (lobby `(no levels yet)` dimming +
  the friendly `This track is scaffolded…` ssh response) are removed
  — every track now has at least one level, so the scaffolded-only
  state is unreachable through normal play.

## [0.5.0] - 2026-05-22

"OSINT goes live." First playable OSINT level lands — the engine
surface that shipped scaffolded in v0.4.0 now has its first level
content consuming it. Six tracks of seven now have at least one
shipped level; Cloud is the last remaining commands-wired-but-no-
levels track.

### Added

- `level0@osint` — "Veridian's Open Letter." First level of the OSINT
  track. Driftwood is hired by Veridian Analytics (mid-sized healthcare-
  analytics SaaS, HIPAA Business Associate) for a personal-credential
  exposure check on their newly-hired Chief Medical Officer, who has
  surfaced in an open-letter campaign about a controversial Phase III
  trial at his previous employer. Player runs `hibp` against the
  executive's known personal Gmail and finds five breach hits — two of
  which surface the SAME cleartext password (recovered from the
  cracked LinkedIn 2012 and LiveJournal 2014 corpora), the high-
  confidence credential-reuse signal. Teaches `hibp`. Maps to
  CWE-521 (Weak Password Requirements), CWE-262, CWE-309, OWASP A07
  (Identification and Authentication Failures), NIST SP 800-63B (breach-
  list screening, §5.1.1.2), HIPAA Security Rule §164.308(a)(5)(ii)(D),
  HITRUST CSF v11 (01.b / 01.q), NIST SP 800-66 Rev. 2, CIS Controls
  v8 (5.4, 6.3, 6.5), MA 201 CMR 17.04, HHS HPH-CPGs, and MITRE T1078 /
  T1110.004 / T1589.001 / T1593. The breadcrumb password is the
  natural gate for a future `level1@osint`, matching the per-track
  credential-chain pattern.
- New client: **Veridian Analytics** — healthcare-analytics SaaS
  company (~250 engineers, founded 2018, Boston/Cambridge MA), HIPAA
  Business Associate, HITRUST CSF v11 certified. Introduces two new
  recurring characters: Marisol Vega (Veridian General Counsel,
  running the personal-exposure request) and Dr. Aaron Hines (Veridian
  CMO, the subject of the lookup — first executive-level subject in
  the recurring cast).
- Playtest grows 164 → 190 (+26 checks): full `level0@osint`
  walkthrough — connect with the `intel` shared service account, file
  listing, engagement-notes / subject-brief / lessons-learned content
  citations (HIPAA Security Rule, HITRUST overlay, Marisol continuity),
  `hibp aaron.hines.md@gmail.com` returns the five breach hits including
  the LinkedIn / LiveJournal cracked-corpus cleartext and the CONFIRMED
  REUSE flag, `hibp` on the Veridian work email gracefully returns "no
  breaches found" (verifies scope discipline), post-mortem cites
  800-63B / CWE-521 / T1110.004. The scaffolded-track friendly-error
  smoke test moved from OSINT (now shipping a level) to Cloud (still
  the last commands-wired-but-no-level-data track).

## [0.4.0] - 2026-05-22

"Engine surface expansion." Two new tracks scaffolded (OSINT, Cloud)
with full command surfaces ready to be consumed by future levels. Plus
a handful of cross-cutting utility commands (`head`, `tail`, `stat`,
`ps`, `diff`, `sha256sum`, `md5sum`, `jwt`) that will be useful across
the rest of the existing tracks.

This release also clarifies the bump rules in CLAUDE.md: MINOR now
explicitly covers "new engine surface that meaningfully expands
player-callable commands or per-level schema fields," not just new
levels. Engine-surface expansion is a real category that the rules
previously didn't capture cleanly.

The lobby's AVAILABLE ENGAGEMENTS list now also surfaces scaffolded
tracks (OSINT, Cloud) as dimmed entries with a `(no levels yet)` hint,
mirroring how the `help` command works. Players see the full roadmap
in the lobby, not just what's playable today. `ssh level0@osint` and
`ssh level0@cloud` return a friendly "scaffolded — levels coming"
message instead of the generic DNS-style hostname error.

### Added

- **OSINT command surface** — `js/commands/osint.js` ships with seven new
  commands ready to be consumed by future levels:
  - `sherlock <username>` — username enumeration across social platforms
    (reads `level.sherlockResults`)
  - `hibp <email>` — Have I Been Pwned breach lookup (reads
    `level.hibpResults`)
  - `wayback <url>` — Internet Archive snapshot history (reads
    `level.waybackResults`)
  - `crtsh <domain>` — certificate-transparency subdomain discovery
    (reads `level.crtshResults`)
  - `theharvester <domain>` — email / subdomain / host harvesting (reads
    `level.harvesterResults`)
  - `shodan <query>` — Shodan host / service search (reads
    `level.shodanResults`)
  - `ipinfo <ip>` — IP geolocation / ASN / org lookup (reads
    `level.ipinfoResults`)
- **Cloud command surface** — `js/commands/cloud.js` ships a fake AWS CLI
  with multi-service dispatch. Subcommands implemented:
  - `aws s3 ls [s3://bucket]` and `aws s3 cp s3://bucket/key <local|->`
  - `aws iam list-users`, `aws iam list-attached-user-policies --user-name X`,
    `aws iam get-policy --policy-arn X`
  - `aws ec2 describe-instances`, `aws ec2 describe-security-groups`
  - `aws sts get-caller-identity` (AWS-side `whoami`)
  - Global flags `--no-sign-request`, `--profile <name>`, `--region <name>`,
    `--output <fmt>` parse cleanly as no-ops so realistic command-lines
    don't error
  - All reads from `level.cloud = { s3, iam, ec2, sts }`
- New track scaffolding: `levels/osint.js` and `levels/cloud.js` registered
  in `levels/index.js`, each with full schema documentation at the top of
  the file and an empty `Levels = {}` export ready for the first level
  build. The lobby auto-detects when levels appear; the `help` command's
  `OPEN-SOURCE INTEL` and `CLOUD SECURITY` sections now render dimmed
  (with the standard "no levels yet" hint) until a level lands.
- **Cross-cutting utility commands across existing tracks:**
  - `head <file> [-n N]` and `tail <file> [-n N]` (linux) — print first /
    last N lines (default 10)
  - `stat <file>` (linux) — detailed file metadata; pulls from
    `level.permissions` and an optional `level.statData` override
  - `ps` (linux) — process listing; reads `level.processes` array of
    `{ pid, tty, time, cmd }`
  - `diff <file1> <file2>` (linux) — classic `diff(1)`-style line
    comparison; levels can override via `level.diffOut`
  - `sha256sum <file>` and `md5sum <file>` (forensics) — chain-of-custody
    hashing; levels can override via `level.fileHashes[file].sha256` /
    `.md5`. Deterministic content-derived synthetic fallback when no
    override is set (NOT cryptographic — real hashing needs Web Crypto
    which is async-only and incompatible with the sync handler signature)
  - `jwt <token>` (crypto) — decode JWT header + payload (handles
    base64url, JSON parses both segments), surface common red flags
    (`alg: none`, empty signature, expired `exp`)
- **`help` command** updated to include the OSINT and CLOUD track sections
  plus the new commands within existing track sections. The auto-dim logic
  for tracks-without-levels still works — OSINT and CLOUD render dimmed
  with the "no levels yet" hint.
- Playtest grows 129 → 164 (+35 checks): comprehensive smoke test for
  the new engine surface, run from the lobby (where no level data
  exists). Verifies (a) `help` includes the new sections and new
  commands per track; (b) each new command prints its usage string when
  called with no args; (c) `ps` and `aws s3 ls` degrade gracefully when
  no level data exists rather than crashing; (d) `aws` prints its
  multi-service usage block; (e) `jwt` actually decodes a real test
  token end-to-end without requiring level data (pure utility, no level
  data needed); (f) the lobby lists OSINT and Cloud as scaffolded
  tracks with the `(no levels yet)` marker; (g) `ssh level0@osint`
  produces the friendly scaffolded-track message and leaves the player
  in the lobby.
- `js/engine/tracks.js` — single-source-of-truth track registry
  consumed by both `lobby.js` (for the engagement list) and `ssh.js`
  (for the scaffolded-track-friendly-error detection). Removes the
  duplicated hardcoded track list that previously lived only in
  `lobby.js`.

## [0.3.0] - 2026-05-22

"Pre-Foundation iteration." Four new level0s — one each for the
Network, Crypto, Web, and Forensics tracks — plus four new clients
covering HIPAA, PCI-DSS, FERPA, and CMMC / NIST 800-171 compliance
regimes. Site security hardening (9 response headers, A+ rating on
securityheaders.com). Visual harmonization of all welcome.md and
lessons-learned.md files. Per-track credential-chain pattern
formalized so every level cleanly leaks the password for the next.

### Added

- `level0@forensics` — "Reed's Soccer Alibi." First level of the
  forensics track. Driftwood is hired by Polaris Defense Systems
  (defense subcontractor) for an internal-investigation engagement: a
  senior engineer's badge logs show after-hours access to a secured
  fabrication bay, and his alibi photo needs forensic verification.
  Player runs `file` to confirm the artifact is a JPEG, then `exif` —
  and the EXIF metadata reveals the photo was taken eight months earlier
  in Key Largo, Florida (~1,000 miles from the claimed Centreville, VA
  soccer field). Teaches `file` and `exif`. Maps to CWE-200 (Exposure
  of Sensitive Information), NIST SP 800-86 (Guide to Integrating
  Forensic Techniques into Incident Response), NIST 800-171 Rev. 2,
  CMMC Level 2 (IR domain), DFARS 252.204-7012, and MITRE T1078 /
  T1583 / T1592. `case-summary.txt` also leaks a forensic-archive
  handoff password as the natural breadcrumb for a future
  `level1@forensics`, matching the per-track credential-chain
  pattern used by all other tracks.
- New client: **Polaris Defense Systems** — defense industrial-base
  subcontractor (~$80M revenue, ~250 engineers; Reston VA / Manassas
  VA), CMMC Level 2 / NIST 800-171 in scope, DoD Secret-cleared
  facility. Introduces a new recurring character (Dana Reyes, in-house
  counsel running the internal investigation — first non-engineer
  client-side character in the recurring cast).
- `level0@web` — "Meridian's Forgotten Backup Folder." First level of
  the web track. Player audits Meridian State University's public web
  stack ahead of a cyber-insurance renewal; `gobuster` reveals an
  autoindexed `/backup/` directory left by a dismissed agency, holding
  a 4,217-row student-records CSV (FERPA-grade exposure) and a
  plaintext DB credential note. Teaches `gobuster` and `curl`. Maps to
  CWE-548 (Information Exposure Through Directory Listing), CWE-552,
  CWE-200, CWE-798, FERPA (34 CFR Part 99), NIST 800-171, OWASP A05
  (Security Misconfiguration), and MITRE T1083 / T1595.003 / T1190.
- New client: **Meridian State University** — Pacific Northwest public
  regional university (~30,000 students), FERPA in scope. Introduces a
  new recurring character (Carlos, Meridian's in-house web developer;
  inherited the public web stack from a dismissed agency that left
  artifacts strewn across the production server).
- `level0@crypto` — "Theo's Safer API Key." First level of the crypto
  track. Player audits a Vesta Retail payment-deploy script ahead of
  the client's PCI-DSS re-attestation; a junior backend engineer
  "secured" the production API key by base64-encoding it. Teaches
  `base64` and `base64 -d`. Maps to CWE-261 (Weak Encoding for
  Password), CWE-326, CWE-256, PCI-DSS 3.5 / 3.6, OWASP A02
  (Cryptographic Failures), and MITRE T1027.013.
- New client: **Vesta Retail** — Level 2 e-commerce merchant ($200M
  annual revenue), PCI-DSS in scope. Introduces two new recurring
  characters: Theo (Vesta backend engineer; well-intentioned, missing
  the encoding-vs-encryption distinction) and Saanvi (Vesta CTO).
- `level0@network` — "Atlas Health Perimeter Check." First level of the
  network track. Player verifies a healthcare client's claim that their
  staging environment is VPN-only; `nmap` reveals a production-grade
  PostgreSQL still exposed to the internet, and the engagement notes
  name a default credential that was never rotated. Teaches `nmap` and
  `nmap -sV`. Maps to CWE-200 / CWE-668 (exposure of sensitive resource
  to wrong sphere), HIPAA Security Rule, NIST SC-7, and MITRE T1046 /
  T1190.
- New client: **Atlas Health** — Pacific Northwest healthcare provider
  (~400k patients), HIPAA in scope. Introduces a new recurring character
  (Marcus, the Atlas DevOps lead).
- New track scaffolding: `levels/network.js`, `levels/crypto.js`,
  `levels/web.js`, and `levels/forensics.js` registered in
  `levels/index.js`. The lobby auto-detects the new tracks and the
  `help` command's `NETWORK RECON`, `CRYPTOGRAPHY`, `WEB RECON`, and
  `FORENSICS` sections now render un-dimmed.
- 1200×630 `og-image.png` for link unfurls in Slack, Discord, iMessage,
  and Twitter (`og:image` + `twitter:image`; `twitter:card` upgraded
  from `summary` to `summary_large_image`). Source template lives at
  `assets/og-template.html`; regenerate the PNG with
  `node tests/generate-og-image.cjs`.

### Security

- Hardened HTTP response headers via a new `staticwebapp.config.json`:
  - **Content-Security-Policy** — strict allow-list. `default-src 'self'`,
    `script-src 'self'`, `style-src 'self' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`, `img-src 'self' data:`,
    `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
    `base-uri 'self'`, `form-action 'self'`, plus `upgrade-insecure-requests`.
    No `'unsafe-inline'` anywhere.
  - **Strict-Transport-Security** — `max-age=31536000; includeSubDomains`
    (1 year, all subdomains).
  - **X-Content-Type-Options: nosniff** — block MIME-sniffing.
  - **Referrer-Policy: strict-origin-when-cross-origin** — limit referer
    leakage on cross-origin navigation.
  - **Permissions-Policy** — opts out of camera, microphone, geolocation,
    payment, USB, accelerometer/gyroscope/magnetometer, FLoC interest
    cohorts, and Topics API.
  - **Cross-Origin-Opener-Policy: same-origin** — isolates browsing
    context from cross-origin window references.
  - **Cross-Origin-Embedder-Policy: require-corp** — every cross-origin
    embedded resource must opt in via CORS or CORP. Verified that both
    Google Fonts endpoints (`fonts.googleapis.com` for the CSS and
    `fonts.gstatic.com` for the font files) ship `CORP: cross-origin`,
    so the wordmark fonts still load.
  - **Cross-Origin-Resource-Policy: cross-origin** — set permissively
    on our own responses so OG-image embeds (Slack, Discord, Twitter
    cards) keep working. The site has no sensitive resources at
    well-known URLs, so strict CORP would harden nothing here.
  - **X-Permitted-Cross-Domain-Policies: none** — legacy Adobe header,
    included for completeness.
- Removed the one inline `style="width:0%"` attribute on `#progress-fill`
  in `index.html` (moved to a CSS rule on the same element) so the strict
  CSP can ship without an `'unsafe-inline'` style-src loophole.

### Fixed

- Copy-paste from terminal output now works. The global click-to-refocus
  handler used to steal focus into `#cmd-input` on every click, including
  the mouseup that ends a text-selection drag — which tore the selection
  before the player could hit Cmd+C. The handler now skips the refocus
  when there's an active text selection, so the player can select and
  copy a base64 blob (or any other content) out of the terminal.

### Changed

- Level-content files (`welcome.md`, `lessons-learned.md`) reformatted
  into a shared visual template using box-drawing-character dividers,
  since the terminal doesn't render markdown.
  - `welcome.md` (level0 only — level0@linux predates the template and
    is sufficiently different in shape that retrofitting is left for
    later) gets four labeled sections separated by `─── HEADER ───`
    dividers matching the lobby's aesthetic: a one-line workstation
    header + one-sentence scene-set, a clean NEW COMMANDS block, a
    "what this tool does" conceptual section, and a numbered HOW TO
    PLAY checklist at the bottom. Compresses ~70 lines of running
    prose into ~50 lines with strong visual hierarchy. Scenario
    backstory that lived in welcome.md now lives only in
    engagement-notes.md (single source of truth).
  - `lessons-learned.md` (every level) opens with a `═══ POST-MORTEM
    ═══` heavy-rule banner, then uses 7 single-rule `─── SECTION ───`
    dividers in a consistent order: THE BLUNT VERSION → THE CONSULTING-
    FIRM ANGLE → FRAMEWORKS THAT COVER THIS → WHERE THIS SHOWS UP ON
    CERTIFICATIONS → MITRE ATT&CK MAPPING → WHAT A DEFENDER SHOULD
    ACTUALLY DO → CLOSING THOUGHT. Section content (CWE / framework /
    MITRE / cert citations) is preserved — the change is visual only.
  - Future level builds must follow the same template.
- `help` command grouped by track with an availability indicator: tracks
  with shipped level data render in their normal color; tracks the engine
  supports but has no level data for yet render dimmed with a
  "(no levels yet — commands available; no level to use them on)" hint.
  Player now sees the roadmap at a glance without confusion about what
  actually works today.
- Playtest grows from 50 → 129 checks: new lobby-detection assertions
  for all four new tracks, a level0@network walkthrough (connect, prompt
  identity, file listing, nmap finding, `nmap -sV` version detection,
  recurring-character continuity), a level0@crypto walkthrough (connect,
  files, `base64 <file>` decode, `base64 -d <string>` decode, PCI-DSS /
  CWE-261 post-mortem citations), a level0@web walkthrough (connect,
  `gobuster` against www.meridian.edu, `/admin` properly gated as 401,
  `curl` on the `/backup/` autoindex, FERPA-grade CSV finding, leaked
  db-creds.txt credential, CWE-548 / OWASP A05 post-mortem citations),
  and a level0@forensics walkthrough (connect, `file` and `exif` on
  the alibi photo, DateTimeOriginal mismatch, Key Largo GPS coordinates,
  iPhone 14 Pro device identification, CMMC / NIST 800-171 / 800-86 /
  CWE-200 post-mortem citations, and forensic-archive handoff password
  breadcrumb for the future `level1@forensics`).

## [0.2.0] - 2026-05-21

### Added

- `level1@linux` — "The Backup Daniel Forgot." Player uses the credential
  found in level0 to ssh into Halton Bank's jumphost, then chases a
  production database password leaked by a misconfigured backup. Teaches
  Unix file permissions (`ls -l` / `ls -la`, mode-string reading, owner /
  group / other) and the CWE-732 shadow-copy anti-pattern. Recurring
  characters Priya and Daniel referenced.
- Permission-aware filesystem on the engine side:
  - `ls -l` / `ls -la` render real `-rw-r--r--`-style mode strings from
    per-file `{ mode, owner, group, size }` metadata declared on the level.
  - `cat` returns "Permission denied" for files the current level user
    lacks read access to (Unix-style owner/group/other check, single-user
    single-group model).
  - Backward-compatible: levels without a `permissions` map (e.g. level0)
    behave exactly as before.
- Canonical version source at `js/engine/version.js`. Topbar title and
  lobby tagline now read from it so future bumps are a one-file edit.
- Levels can override the player's in-world identity via `playerUser`
  (and optional `playerGroup`). When set, `whoami`, `ls -la` owner
  columns, the prompt label, `pwd`, and `find` output all show the
  lore-accurate identity instead of the engine's slot name. Applied to:
  - **level0** — `playerUser: "daniel"`, since the player is sitting at
    Daniel's offboarded laptop reading his files. Welcome.md gains a
    paragraph explaining the forensic-audit framing.
  - **level1** — `playerUser: "app_admin"`, matching the Halton-jumphost
    scenario where the player has used Daniel's leaked staging-account
    creds.
- Headless Playwright playtest (`tests/playtest.cjs`) running 30 end-to-end
  checks against `level0@linux` — lobby render, ssh transitions, `ls` / `cat`
  / tab completion / history, `exit` and `logout` flows, no console errors.
- Gating in the Azure Static Web Apps workflow: the deploy job now declares
  `needs: playtest_job`, so a failing playtest blocks production.
- SVG favicon — `>_` glyph in `--green` on `--bg`, matching the lobby's
  success styling and progress bar.
- Open Graph and Twitter Card meta tags so links unfurl in Slack, Discord,
  iMessage, and Twitter with a title and description. Text-only for now;
  `og:image` will land in a follow-up.
- `<meta name="description">` and `<meta name="theme-color">` for basic SEO
  and mobile-chrome theming.

### Changed

- Lobby home screen rewritten with a lore-forward Driftwood Systems
  welcome (first-visit only). The persistent `AVAILABLE TRACKS` heading
  is now `AVAILABLE ENGAGEMENTS`. The tagline line and `START HERE` /
  `YOUR GOAL` onboarding blocks are reframed as `WELCOME TO DRIFTWOOD
  SYSTEMS` and `FIRST ASSIGNMENT`. Auto-detection of available tracks
  from the `LEVELS` map is unchanged.
- Darker theme: `--bg` drops from `#0d1117` to `#06080b`; the old `--bg`
  shifts down into `--bg-elev` so the progress bar and other layered
  surfaces still read against the page.
- Lobby wordmark rendered char-by-char with each glyph in its own
  terminal-family font (JetBrains Mono, VT323, Share Tech Mono,
  Courier New) and saturated ANSI console color (white / matrix green
  / cyan / blue / dark red). Evokes a "code being deciphered" feel.
  Per-font size compensation keeps visual cap-heights aligned. Glyph
  styling lives in `.glyph-*` utility classes; recipe lives in
  `js/engine/lobby.js`.
- `<title>` lengthened from "D3CYPH3R" to
  "D3CYPH3R — Terminal CTF for infrastructure people" so link previews and
  search-result snippets carry the tagline.
- Workflow tooling: `actions/checkout` v3 → v6, Node 24 pinned via
  `actions/setup-node@v6` (Node 20 is being deprecated on GitHub runners).
- Playtest assertions updated to match the new lobby copy; one new check
  (Driftwood welcome appears on first visit) brings the suite to 31.
- Playtest now also exercises level1 end-to-end (18 new checks: password
  gate, ssh into Halton jumphost, prompt label shows `app_admin`, `ls -la`
  perm strings, `cat` permission denied on the root-mode-600 file, the
  find on the mode-644 backup, recurring-character continuity). The
  level0 block gains one new check for the `daniel` prompt label. Suite
  total: 50 checks.

## [0.1.0] - 2026-05-21

Initial public release. The engine is complete; one Linux level ships with it.

### Added

- Lobby ↔ level model keyed by `"<user>@<host>"` strings, with `ssh` and
  password-gated entry.
- Seven track slots wired into the lobby (Linux, Network, Crypto, Web,
  Forensics, OSINT, Cloud); the lobby auto-detects which have level data.
- `level0@linux` — "Daniel's Last Day," an offboarded contractor's home
  directory full of credentials they shouldn't have left behind.
- Commands across the engine: `ls` / `cd` / `cat` / `pwd` / `whoami` /
  `echo` / `grep` / `find` / `env` / `nmap` / `netstat` / `whois` / `dig` /
  `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` /
  `curl` / `gobuster` / `cookies` / `file` / `strings` / `exif` /
  `clear` / `help` / `report` / `ssh` / `exit` / `logout`.
- Terminal niceties: tab completion with inline hint, ArrowUp/ArrowDown
  command history, CRT-style theme, fake kernel boot sequence.
- Desktop-only gate — touch devices get an intentionally rude rejection
  screen since the input model needs a real keyboard.
- Deployment to [www.d3cyph3r.com](https://www.d3cyph3r.com) via Azure
  Static Web Apps with GitHub Actions auto-deploy on push to `main`.

[Unreleased]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.2...HEAD
[0.7.2]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rlwilliamson-dev/d3cyph3r/releases/tag/v0.1.0
