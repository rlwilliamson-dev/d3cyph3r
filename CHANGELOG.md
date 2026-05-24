# Changelog

All notable changes to D3CYPH3R are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.0] - 2026-05-24

First feature drop after the v1.0 Foundation milestone. Three
player-visible changes — a light / dark theme toggle, a revamped
mobile-gate, and a stylesheet cache-bust so returning visitors get
fresh styling immediately after every release.

### Added

- **Light / dark theme toggle.** New sun/moon icon button in the main
  app's topbar and the walkthroughs subsite header. Dark stays
  default. Choice persists in `localStorage` under the
  `d3cyph3r-theme` key so it survives across sessions AND across the
  main app ↔ walkthroughs subsite boundary (both share the
  d3cyph3r.com origin). Light theme uses GitHub's light palette so
  the visual identity stays consistent with the rest of the
  audience's tooling. The lobby logo's hard-coded glyph colors get
  matching light-mode variants — same five-color identity, darker
  accent shades that stay readable on white.
- **Revamped mobile-gate.** The old "ACCESS DENIED" wall-of-red is
  replaced with a themed boot sequence including a 5-second progress
  bar, a clear "Keyboard required" explanation, and a CTA to bookmark
  the page and revisit from desktop. Inherits the user's saved theme
  preference, so if a visitor toggled light on desktop and then
  reopened the URL on mobile, the gate matches. Renders a
  source-on-GitHub link as an escape hatch for mobile readers who
  want to look at the code.
- **`js/terminal/theme.js`** — small module owning the theme
  persistence pattern (`initTheme()` reads localStorage on boot;
  `toggleTheme()` flips the class and persists). An inline
  equivalent is embedded in `walkthroughs/walkthrough.js` so the
  subsite stays a self-contained ES-module bundle without
  cross-subsite imports.

### Changed

- **Stylesheet links now carry a `?v=<version>` query-string** in
  both `index.html` and `walkthroughs/index.html`. Browsers treat
  the versioned URL as a new resource on each release, so returning
  visitors get fresh CSS immediately rather than seeing up-to-4-hours
  of stale styling from cached `style.css`. Bumped at every version
  bump going forward.
- **`staticwebapp.config.json`** — index.html files (main +
  walkthroughs) now serve with `Cache-Control: no-cache,
  must-revalidate` so the HTML revalidates on every visit (using
  ETag for 304s). Combined with the versioned stylesheet links,
  this makes post-release styling drift effectively impossible.
- **`js/mobile-gate.js`** refactored to render structured HTML with
  CSS classes instead of inline `style=""` attributes. Side benefit:
  removes the CSP-violating inline styles the prior version had
  been getting away with through browser leniency.
- **README privacy note** updated to acknowledge the theme
  preference is the one persistent piece of state beyond
  sessionStorage progress tracking.

### Fixed

- Post-release stylesheet caching — see "Changed" above. Manifested
  in the v1.0.0 launch as a broken-looking footer until the user
  hard-refreshed.

## [1.0.0] - 2026-05-24

**The Foundation milestone.**

All seven tracks (Linux, Network, Crypto, Web, Forensics, OSINT,
Cloud) ship with level0 + level1 chains playable end-to-end. The
per-track credential chain works on every track — each level1 is
gated by a credential the player recovers during the corresponding
level0, and every level1 in turn leaks a credential staged for the
eventual level2. The minimum bar for a coherent v1.0 — a player can
enter any of the seven engagement slots from the lobby and progress
through at least two levels per track — is met.

v1.0.0 itself is the dedicated polish release. No new gameplay this
release; that's the v2.0 "Apprentice" milestone, which adds level2
across the tracks. Instead, this release is a comprehensive audit,
documentation, and contributor-accessibility pass to coronate the
Foundation milestone moment.

### Added

- **`CONTRIBUTING.md`** — fork-friendly contributor guide with an
  "Architecture in one screen" section covering the lobby↔level
  model, parallel per-track registries, filesystem dual
  representation, engine state and setters, command dispatch order,
  boot order, the walkthroughs subsite, and the per-track
  credential chain pattern. Includes how-to sections for adding a
  level, command, track, or walkthrough.
- **`SECURITY.md`** — vulnerability disclosure policy. Private
  reports via GitHub's private vulnerability advisory feature;
  public bug reports via the issue tracker. In-scope vs out-of-
  scope clarified (in-game fictional infrastructure is explicitly
  out of scope — it's all simulated).
- **`404.html`** — themed custom 404 page wired through Azure SWA's
  `responseOverrides` config. Offers "return to lobby" + "browse
  walkthroughs" buttons. Catches stale deep-links and typos
  cleanly rather than serving Azure's generic 404 — relevant now
  that the walkthroughs subsite is publicly discoverable.
- **`sitemap.xml`** — search-engine site index covering the main
  site and the walkthroughs subsite. Referenced from `robots.txt`.
- **Site footer** on both the main app and the walkthroughs
  subsite — GitHub source link with the official mark, "Hosted on
  Microsoft Azure" attribution, and MIT license badge. Players
  who want the source can now reach it from the UI in one click;
  previously the only path was typing `report` in the terminal.
- **AI use disclosure** in README — Claude (Anthropic) was used
  as a coding and writing assistant for code audits, automated
  test playthroughs before each commit, walkthrough drafting,
  and technical documentation. All level design (scenarios,
  recurring characters, puzzle mechanics, narrative arcs, the
  Driftwood Systems setting) is original to the project.
- **"About this project" section** in README — educational-use
  framing with explicit "don't apply these techniques against
  systems you don't own or aren't authorized to test" guidance
  citing CFAA and Computer Misuse Act jurisdictions.
- **Educational disclaimer** in the walkthroughs subsite footer —
  short version of the README disclaimer, catches readers who
  land on a walkthrough deep-link without reading the README.
- **Privacy note** in README — explicit statement that D3CYPH3R
  uses `sessionStorage` for progress tracking only, with no
  cookies, no analytics, no telemetry, and no third-party scripts.
  Closing the tab clears state.
- **Walkthroughs subsite is now publicly indexable.** The
  `noindex,nofollow,noarchive` meta and `robots.txt` Disallow
  line are removed. The in-page spoiler-warning callout at the
  top of every walkthrough remains as the in-content guard
  against accidental spoilers for players who haven't solved the
  level yet.
- **`responseOverrides` block** in `staticwebapp.config.json` to
  wire the custom 404 page.

### Changed

- **Comprehensive cross-track standards-drift refresh** across all
  seven level files. CompTIA CySA+ updated from CS0-003 to
  "CS0-003 / CS0-004" with the early-2026 launch and June-2026
  CS0-003 retirement context (10 occurrences across all tracks).
  ISC2 citation standardized — dropped `(ISC)²` and `ISC²`
  formats in favor of `ISC2` to reflect the org's late-2023
  rebrand (6 occurrences). CWE-200 "mapping-Discouraged" caveat
  added to 5 citations across level0/level1 files where the
  Discouraged note was missing. AWS Security Specialty bumped
  SCS-C02 → SCS-C03 (late-2025 / early-2026 release). Internal-
  consistency cleanup on CIS AWS Foundations Benchmark v5.0.0 in
  cloud/level0 (one residual v3 reference fixed). Internal-
  consistency cleanup on NIST SP 800-171 §03.03 (Rev. 3) numbering
  in forensics/level1. PCI-DSS bumped v4.0 → v4.0.1 in crypto/
  level0 engagement notes. IBM Cost of a Data Breach citation
  refreshed 2024 → 2025 in network/level0.
- **Cross-track walkthrough audit** — 15 corrections applied
  across 9 walkthrough files for standards, URL, and citation
  drift, including intra-file contradictions caught during the
  audit sweep.
- **Code-comment pass for forker readability.** Eight thinly-
  commented source files thickened with header comments
  documenting the module's schema field dependencies, function
  docstrings, and WHY-comments for subtle behavior. Coverage
  includes the cwd-aware command resolution helper, the dual
  fs-tree-vs-flat-files representation invariant, and the
  cursor-mirror trick that gives the terminal its custom-font
  blinking cursor. `index.html` and `style.css` now carry full
  top-of-file documentation for the DOM contract and the
  palette / semantic-class system.
- **README rewrite** — full file-tree under "How it's organized"
  (corrects the prior stale tree, adds the new top-level files),
  expanded "What you can do today" listing all 7 tracks, new
  dedicated Walkthroughs section now that the subsite is public.
- **`robots.txt`** updated — removed the `/walkthroughs/`
  Disallow line, added a Sitemap reference.
- **CHANGELOG / `shell.js` / `version.js`** — removed references
  to local-only files (maintainer cheat sheets and AI memory
  files) that forkers wouldn't have, so the public-facing
  surface doesn't point at files that don't exist in a clean
  checkout.
- **`version.js` release checklist** simplified and rewritten so
  it reads cleanly without requiring local-only context. The
  anti-spoiler rule and the link-audit requirement are
  preserved.

### Fixed

- Two stale "CRT terminal theme" references in README updated to
  "Dark terminal theme" — the visual moved off the CRT aesthetic
  some releases ago and the README description hadn't been
  refreshed.
- Walkthroughs subsite footer updated — replaced the stale
  "Hidden pre-v1.0 — do not share the URL" copy with the new
  educational disclaimer + source/hosting footer.
- `walkthroughs/README.md` author guide updated — removed
  "hidden behind URL obscurity until v1.0 ships" and "secret
  pre-v1.0" framing now that the subsite is public.

## [0.13.0] - 2026-05-24

The sixth level1 in six releases, and the last v1.0 "Foundation"
level. **All seven tracks (Linux, Network, Crypto, Web, Forensics,
OSINT, Cloud) now have level0 + level1 chains.** The v1.0
"Foundation" milestone criterion — "every track has at least
level0 AND level1 playable" — is technically met with this
release; the actual v1.0.0 tag is held for a separate dedicated
release.

Introduces one new engine command — `psql` — a minimal PostgreSQL
client (`\l`, `\dt`, SELECT with optional LIMIT) for RDS-adjacent
database-enumeration puzzles. Level designers populate
`level.postgres = { defaultDb, connection, databases: { <db>:
{ tables: { <name>: { columns, rows } } } } }`.

The walkthrough audit caught NIST CSF 2.0's URL slug change
(`-csf-` segment), NAIC's MDL-668 PDF path move, the long-standing
"PostgreSQL security.html" page that doesn't exist, an FFIEC vs OCC
attribution error on the Capital One $80M consent order, the DBIR
2024 "24% (year) vs 31% (10-year)" stolen-credentials distinction,
the CIS AWS Foundations v5.0.0 actual release date (March 31, 2025,
not December 2024) and v7.0.0 (April 2026, not "mid-2025"), and the
recurring "Database Activity Streams is Aurora-only for MySQL /
PostgreSQL" feature-scope error.

### Added

- **`level1@cloud` — "The Migration Table Nobody Dropped."** Day-3
  continuation of the Coverline SOC 2 case. After Friday's S3 audit
  closed the CC6.1 control gap and surfaced a hardcoded RDS master
  credential, Sloane's IR triage triangle (CISO + GC + outside
  counsel) wants the database enumerated before the credential is
  rotated, so the breach-notification math can cover any secondary
  exposures. Player SSHes onto Coverline's cloud-audit bastion
  (`~/.pgpass` pre-staged with the leaked credential), walks the
  `coverline_claims` schema with `psql`, and finds: a
  `migration_artifacts` table from the 2024 us-east-1 → us-east-2
  region cutover with explicit `ttl_expires_at` columns that
  intended Q2 2024 deletion but were never honored; row 2
  (broker-portal service credential) is the level2 breadcrumb —
  Coverline migrated broker-portal to Secrets Manager last year
  but kept the legacy migration credential as a "fallback in case
  Secrets Manager lookup fails" that the broker-portal team never
  confirmed could be removed. Plus a dormant terminated-employee
  account (vikram.shah, rolled off Q1 2024) still in the
  application's users table, and a single anomalous 2026-05-20
  02:14 UTC schema-enumeration query in the audit log from an
  unrecorded source IP (Coverline runs RDS audit logging in basic
  mode without pgaudit). Lesson stack: CWE-798 (Hard-Coded
  Credentials) + CWE-540 (Inclusion of Sensitive Information in
  Source Code) + CWE-312 (Cleartext Storage of Sensitive
  Information), mapped to SOC 2 CC6.1 / CC6.2 / CC6.6 / CC7.1 +
  NIST SP 800-53 Rev. 5 IA-5(7) + NAIC §4.D / §5 / §6 (72-hour
  clock) + NYDFS 23 NYCRR 500.07 / 500.13 / 500.17 + GLBA
  Safeguards 314.4(c)(4) / 314.5 (30-day clock since May 2024).
  AWS Secrets Manager + Database Activity Streams + GuardDuty RDS
  Protection + IAM Database Authentication + pgaudit as the proper
  remediation stack. MITRE T1078 (Valid Accounts) + T1213 (Data
  from Information Repositories) + T1552.001 (Credentials In Files).
- **New engine command: `psql [-d <db>] "<SQL or \\meta>"`.**
  Minimal PostgreSQL client supporting `\l` (list databases), `\dt`
  (list tables), `SELECT * FROM <table> [LIMIT N]`, and
  `SELECT <cols> FROM <table>`. Also supports `--version`, `-c`,
  and `-h` / `-U` (the connection flags are accepted for realism
  but the engine uses the level's pre-configured connection).
- **`walkthroughs/cloud/level1.md`** — long-form companion under
  the v0.7.0 walkthrough scaffolding. ~7,000 words. Covers DB-row
  credential storage as the modern source-control-credentials
  anti-pattern equivalent, the universal migration-table-cleanup
  failure mode, real-world parallels (Capital One March 2019 /
  $80M OCC consent order, Microsoft SCCM database credential
  observations, SolarWinds Orion database storing managed-device
  credentials, Microsoft Power Apps August 2021 / UpGuard /
  ~38M records across 47 portals, MOVEit / CL0P May 2023 /
  ~2,800+ orgs / ~93M records, Snowflake May-June 2024 /
  Ticketmaster ~560M / AT&T ~109M / Santander ~30M / UNC5537
  attribution, DBIR 2024 vs 2026 stolen-credentials trends),
  full framework + cert tie-ins (SOC 2 / NIST 800-53 / NIST CSF
  2.0 / CIS AWS Foundations v5/v7 / CIS PostgreSQL v15-v18 /
  NAIC / NYDFS / GLBA Safeguards), AWS-native remediation stack
  (Secrets Manager / Parameter Store / IAM Database Auth /
  Database Activity Streams / GuardDuty RDS Protection / pgaudit
  configuration), and the credential-cascade through-line across
  all six v1.0 level1s. Standard "Last reviewed: May 2026" footer.
- Playtest coverage for the new level — wrong-password rejection,
  psql `\l` / `\dt` / SELECT / LIMIT / cross-DB validation,
  breadcrumb credential assertion, dormant-account finding
  verification, anomalous-audit-log entry detection, the three
  graceful-error paths (unknown table / unknown database / DML
  refused), plus framework-citation checks in the in-game
  post-mortem.
- `help` reference entry for `psql` in the CLOUD SECURITY
  section, plus `psql`-with-no-args usage probe in the lobby
  smoke test.

## [0.12.0] - 2026-05-24

The fifth level1 in five releases. Six of the seven tracks (Linux,
Network, Crypto, Web, Forensics, **OSINT**) now have level0 +
level1 chains; one remains (Cloud) on the v1.0 "Foundation" path.
Introduces one new engine command — `github` — for source-control
OSINT, supporting profile lookup, repo metadata + file tree, and
file contents at HEAD. The walkthrough audit caught some
substantive standards drift this round: OWASP ASVS v5.0's
Configuration chapter is V13 (not V14, which is Data Protection),
ASVS v5.0 published May 2025 (not 2024), OMB rescinded both
M-22-18 and M-23-16 on January 23, 2026 via M-26-05 (the CISA
Common Form is now optional), AWS released SCS-C03 as the
successor to SCS-C02, and CWE-798 fell off the 2025 CWE Top 25
list entirely (MITRE changed methodology to remove normalization
to abstract weaknesses). Also picked up the GitGuardian "State of
Secrets Sprawl" 2026 figures (29M new secrets in 2025, 34% YoY),
the Toyota disclosure date correction (October 2022, not March
2023), the corrected Uber 2014 chronology (lawsuit 2015, settled
2016), and the SANS SEC555 rename + Gitleaks maintenance-mode
status from the prior release's audit.

### Added

- **`level1@osint` — "Aaron's Weekend Project."** Day-2
  continuation of the Veridian executive-exposure case. Marisol
  expands engagement scope over the weekend after Friday's HIBP
  finding; sherlock + the new `github` command are now in scope
  for Aaron Hines's public developer footprint. Aaron's clinical-
  era personal-pgx-tool repo on GitHub has a committed `.env`
  file at HEAD containing four secrets — most importantly a
  live, never-rotated personal AWS access-key pair (the
  `AKIAVDS...` prefix marks it as a long-lived IAM user access
  key). The `.gitignore` was added two months after the initial
  commit (and lists `.env`) but doesn't retroactively untrack
  the pre-existing file — the universal source-control credential-
  leak mechanic on display. The AWS secret access key becomes the
  level2@osint breadcrumb. Lesson stack: CWE-798 (Hard-Coded
  Credentials) + CWE-540 (Inclusion of Sensitive Information in
  Source Code) + CWE-312 (Cleartext Storage), mapped to NIST SP
  800-218 SSDF (PW.6 / PS.1 / PO.5), MITRE T1593.003 (Search Open
  Websites/Domains: Code Repositories) on the recon side and
  T1552.001 (Unsecured Credentials: Credentials In Files) on the
  post-compromise side.
- **New engine command: `github [<user>[/<repo>] [file <path>]]`.**
  Source-control OSINT primitive. Three forms: profile + repos
  list, repo metadata + file tree, file contents at HEAD. Level
  designers populate `level.github[username]` with profile +
  repos (each repo carrying description / language / created /
  updated / stars / forks / license + a `files: { path: content }`
  map; nested paths supported via slashes in the key).
- **`walkthroughs/osint/level1.md`** — long-form companion under
  the v0.7.0 walkthrough scaffolding. ~7,000 words. Covers
  source-control credential leakage in depth, the universal
  `.gitignore`-is-forward-only mechanic, real-world parallels
  (Uber 2014/2015 AWS Gist, Toyota October 2022 T-Connect,
  Mercedes-Benz January 2024 PAT, Microsoft AI Research 38TB
  SAS, Samsung ChatGPT March 2023, Sysdig's EmeraldWhale
  October 2024 campaign), the full framework + cert tie-ins
  (NIST SP 800-218 with the OMB M-26-05 rescission framing,
  800-53 IA-5(7), OWASP ASVS v5.0 §V13, CIS Controls v8.1
  Control 16, HIPAA citations), GitHub Secret Scanning + Push
  Protection coverage, TruffleHog / Gitleaks / GitGuardian /
  detect-secrets / git-secrets tooling rundown, and AWS-specific
  rotation + GuardDuty + CloudTrail audit guidance. Standard
  "Last reviewed: May 2026" footer.
- Playtest coverage for the new level — wrong-password
  rejection, sherlock handle confirmation, github profile /
  repo-tree / file-contents walk validation, breadcrumb
  credential assertion, decoy-repo enumeration, and the three
  graceful-error paths (unknown user / unknown repo / unknown
  file path), plus framework-citation checks in the in-game
  post-mortem.
- `help` reference entry for `github` in the OPEN-SOURCE INTEL
  section, plus `github`-with-no-args usage probe in the lobby
  smoke test.

## [0.11.0] - 2026-05-24

The fourth level1 in four releases. Five of the seven tracks (Linux,
Network, Crypto, Web, **Forensics**) now have level0 + level1 chains;
two remain (OSINT, Cloud) on the v1.0 "Foundation" path. Introduces
one new engine command — `evtx` — for Windows Event Log triage,
matching the EZ Tools `EvtxECmd` workflow. The walkthrough audit
caught NIST SP 800-171 Rev. 3's numbering scheme change (`§3.3.x` →
`§03.03.0x`), tightened NIST SP 800-92's revision status (Rev. 1 IPD
out for comment since Oct 2023, still no Final as of May 2026),
corrected a DFARS 252.204-7012 paragraph attribution (90-day media-
preservation lives in (e), not (m)), surfaced the CWE-200 mapping-
status downgrade to Discouraged, and noted the SANS SEC555 rename
from "SIEM with Tactical Analytics" to "Detection Engineering and
SIEM Analytics" plus the CompTIA CS0-004 launch for parallel
availability with the retiring CS0-003.

### Added

- **`level1@forensics` — "What the Logs Saw."** Day-2 continuation
  of the Reed Connolly insider-threat case. Polaris IR live-imaged
  Reed's workstation Tuesday night under FSO authority; today's
  task is triage of the extracted Windows Security event log. The
  4688 process-creation records reconstruct Reed's CUI-exfil chain
  (PowerShell `Compress-Archive` → `certutil -encode` → chrome →
  mega.nz upload), the 4663 file-access records identify the
  specific covered-defense-information artifacts he read, and a
  separate finding in the Tuesday-night IR-team activity surfaces
  a credential-handling miss documented as CWE-532 (Insertion of
  Sensitive Information into Log File). The credential leaked in
  that 4625 failed-logon event becomes the level2 breadcrumb.
  Lesson stack: CWE-532 + the LOLBin / Valid-Accounts insider-
  threat pattern, mapped to NIST 800-53 AU family controls, CMMC
  AU.L2-3.3.x practices, and DFARS 252.204-7012's 72-hour
  reporting clock to DoD (via DIBNET / DC3).
- **New engine command: `evtx [-id <ID>] <file>`.** Windows Event
  Log query primitive, modeling the EZ Tools `EvtxECmd` workflow.
  Filters by Event ID (4624 / 4625 / 4634 / 4663 / 4688 most
  commonly); dumps everything when no filter is set. Level
  designers populate `level.evtxLogs[file]` with an array of
  `{id, body}` records — pre-formatted body blocks keep the level
  designer in control of display while the command handles
  filtering and pagination headers.
- **`walkthroughs/forensics/level1.md`** — long-form companion
  under the v0.7.0 walkthrough scaffolding. ~7,700 words. Covers
  Windows event-log forensics in depth, the CMMC AU control
  family, real-world parallels (TJX, Target, Sony, OPM, SolarWinds,
  Twitter), the full framework + cert tie-ins (NIST 800-53 AU,
  800-92 Rev. 1 IPD status, 800-86, 800-171 Rev. 3 §03.03.x, CIS
  Controls v8.1 Control 8, DFARS 252.204-7012, NISPOM 32 CFR
  Part 117), LOLBAS project reference, Sysmon / Hayabusa /
  Chainsaw / EvtxECmd / KAPE tooling rundown, and a Sigma
  detection-rule example for the 4625-typed-password-as-username
  pattern. Standard "Last reviewed: May 2026" footer.
- Playtest coverage for the new level — wrong-password rejection,
  filter-by-Event-ID workflow validation (4624 / 4625 / 4688 /
  4663 / 9999-empty-state), `evtx` dump-all sanity, breadcrumb
  credential assertion, and framework-citation checks in the
  in-game post-mortem.
- `help` reference entry for `evtx` in the FORENSICS section, plus
  `evtx`-with-no-args usage probe in the lobby smoke test.

## [0.10.0] - 2026-05-24

The third level1 in three releases. Four of the seven tracks (Linux,
Network, Crypto, **Web**) now have level0 + level1 chains; three
remain (Forensics, OSINT, Cloud) on the v1.0 "Foundation" path. No
engine changes — `level1@web` uses the existing `curl` + `cookies`
command surface. The walkthrough audit on this one caught CWE
mapping-status drift, an Optus figure that had moved between
disclosure and the OAIC's August 2025 civil-penalty filing, a wrong
SEC filing URL, Casbin's move to the Apache Software Foundation,
and Oso's strategic pivot toward AI-agent authorization.

### Added

- **`level1@web` — "Carlos's Login Wall."** Day-2 follow-up to
  yesterday's Meridian backup-directory finding. Carlos shipped a
  "quick transcript download" endpoint three weeks ago, gated by
  Meridian SSO. The middleware confirms the requester has an active
  session; the handler never checks that the requested `student_id`
  matches the session's owning student. Any logged-in student can
  pull any other student's transcript by changing one URL parameter
  — IDOR via CWE-639 *Authorization Bypass Through User-Controlled
  Key*. The blast radius extends to legacy BluePier-era system
  accounts in the `M-000xxxx` ID range; one of them carries the
  level2 breadcrumb credential in its `advisor_notes` field. Lesson
  stack: CWE-639 plus CWE-862 *Missing Authorization* for the
  primary failure, CWE-312 *Cleartext Storage* for the credential
  in the free-form field, plus the sticky-account anti-pattern
  (parallel to the audit-bypass account in `level1@network` and the
  `handoff_token` JWT claim in `level1@crypto` — three different
  "convenient places" engineers chose to stash credentials, three
  different access-control failures that expose them).
- **`walkthroughs/web/level1.md`** — long-form companion under the
  v0.7.0 walkthrough scaffolding. ~7,000 words. Covers IDOR / BOLA
  history, the OWASP API1-since-2019 standing, real-world parallels
  (USPS Informed Visibility 2018 / ~60M, Optus 2022 / ~9.5M with
  ~2.1M government-ID-exposed, T-Mobile 2023 / ~37M via BOLA), the
  full framework + cert tie-ins, authorization tooling (OPA, Casbin,
  Oso, framework-native primitives), schema-level defense in depth
  (Postgres RLS, API-gateway authz, service-mesh policies). Standard
  "Last reviewed: May 2026" footer.
- Playtest coverage for the new level — wrong-password rejection,
  IDOR validation via curl-ing two real student IDs from level0's
  CSV (Aisha M-1872941 + Jordan M-1873041) plus the BluePier demo
  M-0000001, the 404 case for an unknown ID, and the breadcrumb
  credential assertion.

### Fixed (pre-merge link audit — both walkthrough and in-game)

- **Optus 2022 figures updated to the OAIC August 2025 filing**:
  ~9.5 million Australians (per the OAIC civil-penalty proceeding,
  superseding the earlier ~9.8M / "up to 10M" estimates), ~2.1M
  with government-ID-exposed, and Optus's reserved breach-
  remediation cost of approximately AUD $140 million (not the
  earlier walkthrough draft's "multi-hundred-million-AUD"
  framing). Civil-penalty proceeding corrected from "multiple
  proceedings" to "single proceeding filed in August 2025."
- **T-Mobile January 2023 SEC 8-K URL** corrected from a wrong
  accession number to `000119312523010949/d641142d8k.htm`.
- **CWE-862 MITRE mapping status** corrected from ALLOWED to
  **ALLOWED-WITH-REVIEW** (CWE-862 is a Class-level weakness;
  the catalog recommends reviewing Base-level children before
  mapping). Top 25 ranking detail added: #11 in 2023, #9 in
  2024, #4 in 2025.
- **CWE-285 mapping status** corrected from a permissive "map
  this when the question is high-level" framing to the actual
  **DISCOURAGED** status, with MITRE's recommended alternatives
  (CWE-862, CWE-863, CWE-639) cited explicitly.
- **Casbin URL** updated from the legacy `casbin.org` to
  `casbin.apache.org` (the project joined the Apache Software
  Foundation; the old domain 301-redirects).
- **Oso positioning** updated — Oso's company positioning shifted
  toward AI-agent authorization in 2025; the application-
  authorization product (Polar DSL with RBAC / ReBAC / ABAC)
  remains available but is no longer the primary marketing
  emphasis. Description softened accordingly.
- **HackerOne *Hacker-Powered Security Report*** URL updated to
  the evergreen landing page; the "Broken Access Control #1 or #2
  every year the report has been published" claim softened to
  "recent editions consistently place Broken Access Control among
  the top vulnerability categories" (earlier editions ranked XSS
  at #1 in some years).
- **USPS Informed Visibility data categories** corrected to match
  the Krebs source — email addresses, usernames, user IDs, account
  numbers, street addresses, phone numbers, mailing-campaign data
  (not "real-time package-tracking data" as the walkthrough
  originally framed).
- **MITRE T1530** dropped from the in-game lessons-learned + the
  walkthrough's further reading — T1530 (Data from Cloud Storage
  Object) is scoped to cloud storage and doesn't strictly apply to
  Carlos's database-backed Express API. T1190 + T1213 cover the
  case cleanly.

## [0.9.0] - 2026-05-23

The second level1 in two releases. With this release, three of the
seven tracks have a level1 (Linux, Network, **Crypto**); four
remain (Web, Forensics, OSINT, Cloud) on the path to v1.0
"Foundation." No engine changes — `level1@crypto` uses the existing
`jwt` command surface (already implemented but unused until now).
The walkthrough audit on this one caught a rejected CVE I had
treated as real, several CVE-to-attack mis-mappings, PCI-DSS
legacy v3.2.1 numbering, and an Auth0/Okta attribution swap.

### Added

- **`level1@crypto` — "Theo's Signature That Wasn't."** Day-2
  follow-up to the Vesta Retail base64-API-key finding. Theo
  shipped a homegrown JWT auth middleware for Vesta's internal
  admin API three weeks ago — `jwt.verify(token, SIGNING_SECRET)`
  called without an algorithms whitelist. The access log captures
  a token with `alg: none` in the header; the engine's `jwt`
  decoder surfaces the algorithm + empty-signature red flags
  automatically; the payload also carries the level2 breadcrumb
  as a custom claim (JWT payloads are NOT confidential, which is
  the secondary lesson). Lesson stack: CWE-347 *Improper
  Verification of Cryptographic Signature* plus CWE-532 *Insertion
  of Sensitive Information into Log File* for the debug logging
  that captures Authorization headers.
- **`walkthroughs/crypto/level1.md`** — long-form companion to
  the new level under the v0.7.0 walkthrough scaffolding. ~7,800
  words, 10-section template. Covers the algorithm-confusion
  family (alg:none, RS→HS, key-injection via embedded-jwk / jku /
  x5u), the McLean 2015 disclosure history, library-specific
  remediation patterns (jsonwebtoken, PyJWT, jose, go-jwt), SIEM
  detection patterns, and IdP-retrofit guidance. Standard "Last
  reviewed: May 2026" footer.
- Playtest coverage for the new level — wrong-password rejection,
  correct-password connection, file enumeration, `jwt` decode
  validation including assertions for the alg:none warning, the
  empty-signature warning, the role=admin claim, and the level2
  breadcrumb credential appearing in the decoded payload.

### Fixed (pre-merge link audit — both walkthrough and in-game)

- **CVE-2022-23529 cited as a real CVE — it was REJECTED by Mitre
  in January 2023.** Replaced with CVE-2022-23539 (the correct
  pre-v9 jsonwebtoken vulnerability paired with CVE-2022-23540).
  The walkthrough and the in-game text now both correctly cite
  the addressed-in-v9.0.0 pair and explicitly note that
  CVE-2022-23529 is rejected so future readers don't repeat the
  citation.
- **The McLean 2015 disclosure was tracked across per-library
  CVEs, not assigned a single multi-library CVE.** Earlier text
  cited CVE-2015-9235 as the alg:none CVE; CVE-2015-9235 is
  actually the node-jsonwebtoken RS→HS confusion CVE. Walkthrough
  and in-game text now correctly cite CVE-2015-2951 (php-jwt
  alg:none) alongside CVE-2015-9235 (node-jsonwebtoken RS→HS).
  McLean's affiliation also clarified — he was an independent
  researcher who guest-posted on the Auth0 blog, not an Auth0
  employee.
- **Auth0 ≠ Okta on the October 2023 support-system breach.**
  Walkthrough originally attributed the October 2023 incident to
  Auth0; the actual disclosure was Okta's, and Auth0's own support
  case management system was explicitly reported unaffected.
  Fixed; the framing now matches the (correct) Okta attribution
  in network/level1's parallel passage.
- **CVE-2018-0114 is the embedded-`jwk` key-injection
  vulnerability, not specifically a jku/x5u URL-fetching CVE.**
  Walkthrough §4 Thread 2 reframed to cover the full key-injection
  family (embedded `jwk` in the header, plus the related `jku` and
  `x5u` URL-fetching attacks tracked under their own per-library
  CVEs) with CVE-2018-0114 correctly attributed to the embedded
  variant.
- **PCI-DSS requirement numbers updated to v4.0.1 numbering.**
  Earlier text cited Req 10.5.2 (v3.2.1's audit-trail-protection
  number); v4.0.1 renumbered the control family to 10.3.x. All
  references swapped to Req 10.3.1 (read-access restriction) and
  10.3.2 (modification protection). Req 6.4.3 was also wrong (it
  covers payment-page script integrity, not public-facing app
  protection); replaced with Req 6.4.1. Req 8.3 narrowed to Req
  8.3.2 for the strong-cryptography-during-transmission framing
  specifically.
- **NIST SP 800-63B-4 Section 4 → Section 5.** Section 4 covers
  authenticator-lifecycle events; the session-token / refresh
  guidance the walkthrough was citing actually lives in Section 5
  *Session Management*.
- **CWE-347 "upper-middle bands of CWE Top 25" is wrong** — it
  isn't on the 2023, 2024, or 2025 Top 25 lists. Reframed to
  cite CWE-347 as the canonical ID with ALLOWED mapping status,
  noting that the Top 25 weaknesses that most often fire on JWT
  findings are CWE-287 and CWE-863.
- **RFC misquotes corrected.** The MUST-language for "reject
  unsupported algorithms" lives in RFC 8725 §3.1, not RFC 7519
  §6 (which only defines the unsecured JWT form). RFC 7515 §5.2
  paraphrase tightened to match the actual step-8 normative text.
  RFC 8725 §3.1 quote replaced with the actual normative
  language about libraries enabling caller-specified algorithms.
- **OWASP JWT Cheat Sheet over-claim removed** — only the Java
  version is published; the "equivalent versions exist for
  Node.js and Python" claim has been removed. The WSTG JWT
  testing chapter URL added as the language-agnostic companion.

## [0.8.0] - 2026-05-23

The first level1 of a non-Linux track lands. With this release, two
of the seven tracks (Linux + Network) have full level0 + level1
chains — the rest still have level0 only. The engine grows `dig`'s
surface to model DNS zone transfer (`dig <domain> AXFR`), a
textbook recon technique that's been on every infrastructure-audit
playbook since the 1990s. The walkthrough that ships in the same
PR pulled an unusually rich set of audit corrections — including a
fresh NIST Special Publication that superseded a 13-year-old guide
in March of this year, while the walkthrough was being written.

### Added

- **`level1@network` — "The Map Marcus Didn't Mean to Share."**
  Day-2 follow-up to the Atlas Health perimeter audit. The player
  uses the default credential surfaced at the end of level0 to ssh
  into the staging-db host (Priya has authorized a one-time,
  documented blast-radius check), discovers the host can reach
  Atlas's internal DNS resolver, and dumps the full internal zone
  with one `dig` command. The zone reveals production / PHI tier
  hostnames the staging tier shouldn't see, plus a free-form TXT
  record someone left behind during a vendor audit dry-run that
  carries a literal service-account credential. Lesson is CWE-306
  Missing Authentication for Critical Function (the AXFR
  misconfiguration) plus the sticky-vendor-account anti-pattern.
- **`dig <domain> AXFR` support** in the network command surface.
  Existing `dig` handler grows a new code branch — when AXFR is
  requested, returns the level's pre-formatted zone-file lines (or
  a `REFUSED` response when the level has no AXFR data). Models
  the real-world technique without an unrealistic abstraction;
  standard per-type `dig` queries (`A`, `NS`, `MX`, `ANY`) work
  unchanged.
- **`walkthroughs/network/level1.md`** — long-form companion to
  the new level under the v0.7.0 walkthrough scaffolding. Walks
  the five-failure compound stack, three real-world parallel
  threads (the chronic AXFR pattern, healthcare-sector ransomware
  enumeration phases, sticky vendor accounts), full framework +
  cert tie-ins, BIND / Knot / PowerDNS hardening config examples,
  and the standard "Last reviewed: Month Year" footer.
- Playtest coverage for the new level — wrong-password rejection,
  correct-password connection, file enumeration, AXFR dump
  validation (asserts the breadcrumb credential appears, that
  prod-db and phi-warehouse hostnames appear, and that the
  standard zone-transfer footer is emitted).

### Fixed (pre-merge link audit — both walkthrough and in-game)

- **NIST SP 800-81-2 → NIST SP 800-81 Rev 3.** SP 800-81-2 was
  withdrawn on 2026-03-19, the same day SP 800-81 Rev 3 was
  published as final. The walkthrough was originally written
  against the older guide; both walkthrough and in-game
  references swapped to Rev 3, with notes that Rev 3 substantially
  expands the older guide (Protective DNS, encrypted-DNS
  transports DoT / DoH / DoQ, zero-trust integration, OT / IoT,
  forensic logging).
- **OWASP Top 10 (2025) category positions** corrected in the
  walkthrough: A07 Authentication Failures (not "A04, elevated"),
  A04 Cryptographic Failures (not "Authentication Failures"),
  A03 Software Supply Chain Failures (with the word "Software"),
  and A10 Mishandling of Exceptional Conditions noted as the
  brand-new 2025 category.
- **CWE-306 Top 25 ranking** — actually #25 on the 2024 edition
  and #21 on the 2025 edition (not "in the upper third").
- **NIST SP 800-63B retitle** — the current revision is 800-63B-4
  (July 2025), retitled "Authentication and Authenticator
  Management" (from the older "Authentication and Lifecycle
  Management").
- **Four healthcare-incident figures** corrected: Change
  Healthcare 192.7M individuals per the July 2025 HHS OCR filing
  (not 190M per the January 2025 filing); CommonSpirit Health 164
  facilities + 623,774 patients (not ~150 / ~600k); UHS 400+
  facilities in the US and UK (not 250+); Scripps Health 4
  hospitals disrupted (not 24) with 147,267 patients confirmed.
- **OWASP WSTG section identifier** — DNS zone-transfer testing
  is documented under WSTG-INFO-04 (Enumerate Applications on
  Webserver), not WSTG-INFO-10 (Map Application Architecture)
  as the in-game text originally cited.
- **CIS Controls URL** corrected from the generic `/controls/v8`
  to the v8.1-specific `/controls/v8-1`.
- **RFC 5936 framing** — updates RFC 1035 (per the "Updates:
  1035" header) rather than replacing it; RFC 1035 §3.2.3,
  §4.2.2, and §6.3 remain foundational.
- **NIST SP 800-53 Rev. 5 SC-22(1) enhancement** annotated as
  having been incorporated into the SC-22 base control in Rev 5
  (was a separate enhancement in Rev 4).
- **CISA SolarWinds advisory series** broadened from
  AA20-352A-only to also reference the AR21-134A eviction
  guidance, where the service-account hygiene framing is more
  directly present.
- **Sigma rule path** corrected — the AXFR detection lives under
  `rules/windows/builtin/dns_server/`, not the nonexistent
  `rules/network/dns/` path the walkthrough originally cited.

### Fixed (cross-track sweep)

- **Verizon DBIR figures updated** in `levels/linux.js`'s
  lessons-learned: the 2024-edition "31% stolen credentials"
  framing is replaced with the 2026-edition framing where
  vulnerability exploitation overtook credential abuse to claim
  the #1 initial-access slot at 31% of breaches. Credential
  abuse remains the persistent runner-up.
- **OWASP A04 not A02 for Cryptographic Failures** corrected in
  one stale comment at the top of `levels/crypto.js` (the
  player-facing lessons-learned was already correct).

## [0.7.7] - 2026-05-23

The first level1 walkthrough lands. Eight walkthroughs total now
published under the v0.7.0 documentation scaffolding — all 7
level0s + level1@linux. No user-facing changes to the game itself.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding — the first level1 walkthrough (Linux
  track). Picks up where level0's walkthrough ended; goes deeper
  on the CWE-732 "shadow copy" pattern, with three real-world
  parallels (LastPass 2022/2023, Uber September 2022, Snowflake
  customer breach campaign 2024). Subsite client-router manifest
  updated to register the new entry.
- Pre-merge link-audit pass performed under the extended
  procedure (walkthrough + in-game). Audit findings applied
  before merge — including a corrected CWE-732 mapping-status
  claim (ALLOWED-WITH-REVIEW, not ALLOWED), a corrected AT&T
  Snowflake-breach record-count figure (~110M wireless customers,
  not the conflated ~73M from a separate AT&T breach earlier in
  2024), and a refreshed Snowflake-advisory URL.

## [0.7.6] - 2026-05-23

The final level0 walkthrough lands. With this release, **all 7
tracks have a published reference document under the documentation
scaffolding.** The pre-merge link audit on this one caught more
than any prior walkthrough — including a fabricated citation that
had been generated from training memory rather than a real source.
This is exactly why the audit step exists.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding — completing the level0 series across
  all 7 tracks. Manifest in the subsite client router updated to
  register the new entry.

### Fixed (factual errors, in both walkthrough and in-game)

- **OWASP Cloud-Native Top 10 CNAS-7 misattribution** corrected in
  both the new walkthrough AND in the pre-existing in-game post-
  mortem (which has been shipping the wrong CNAS-7 definition
  since v0.6.0). CNAS-7 is actually "Using components with known
  vulnerabilities," not "Improper Authentication and Authorization."
  The credential-leak scenario maps more precisely to **CNAS-5
  Insecure Secrets Storage** in the OWASP CN Top 10's 2022
  edition. Both files now cite CNAS-5.
- **OWASP Cloud-Native Top 10 edition year** corrected from "2023"
  to "2022" in both files. The list was published in 2022; the
  GitHub project was archived in April 2025.
- **CIS AWS Foundations Benchmark version** bumped from v3.0.0 to
  v5.0.0 (the AWS Security Hub-supported version as of late 2025;
  v7.0.0 is also published by CIS but tooling support is lagging).
  v5.0.0 consolidated the legacy v3.0.0 §2.1.6 (KMS encryption)
  into §2.1.3, so the S3 sub-control list is now five items
  rather than six. Updated in both files.
- **Capital One regulatory-cascade citation** corrected. An
  earlier draft of the new walkthrough cited a "Capital One SEC
  enforcement settlement ($4M, August 2024)" that does not exist
  — the SEC release number referenced is unrelated to Capital
  One. Removed entirely. Class-action settlement figure
  corrected to the actual public number (~$190M, late 2022) and
  the Federal Reserve's separate 2020 enforcement action (which
  was terminated in 2023 without further penalty) added as a
  more accurate adjacent citation.
- **NAIC Model Law adoption count** updated from "~25 states" to
  "~28 jurisdictions as of early 2026," reflecting continued
  state-level adoption.

### Changed (milestone definitions)

- **Milestone-name definitions updated.** The v1.0.0 "Foundation"
  milestone now explicitly requires every track to have at least
  level0 AND level1 playable, not just the Linux track. The
  earlier track-specific milestone framing ("v1.0 = Linux
  complete; v2.0 = Network + Crypto complete"; etc.) was
  abandoned once it became clear that shipping all 7 track
  level0s before any track's level1 produces a much more
  compelling pre-v1.0 product than building any single track
  deep first. The level-depth-per-track approach now drives the
  release plan.

## [0.7.5] - 2026-05-23

Four changes in one release: another content addition under the
documentation infrastructure, a small in-game citation fix from a
backfill audit, a procedure extension so the link-audit step now
covers both the walkthrough file AND the corresponding in-game
lessons-learned content, and a player-visible version-display tweak
in the topbar and lobby tagline. The post-mortems players read at
the end of each level are now in scope for every per-walkthrough
audit going forward.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.
- First pass under the new extended link-audit procedure caught
  a stale SANS course code (SEC487 retired, replaced by SEC497
  "Practical Open-Source Intelligence") that appeared in BOTH
  the walkthrough and the in-game post-mortem — exactly the
  kind of cross-file drift the extended procedure is designed
  to catch.

### Changed (player-visible)

- **Topbar and lobby tagline now show the full semver** (e.g.
  `v0.7.5`) instead of the major.minor form (`v0.7`). The patch
  level was visible only via tag/release before; it's now visible
  in the running game too, so players can tell at a glance which
  point release they're on without reading the GitHub Releases
  page. The change is in the `VERSION_DISPLAY` derivation in
  `js/engine/version.js` — one line + a comment refresh.

### Fixed (in-game post-mortem citations)

- **In-game IBM Cost of a Data Breach 2024 figure** corrected.
  The healthcare-vertical per-record figure was cited as $429
  but the 2024 IBM report actually published $408. Backfill
  audit caught the drift. Cross-industry figure also corrected
  from $164 to $165 for the same report's published number.
- **In-game SANS course citation** updated from SEC487 to SEC497
  (SEC487 retired; SEC497 "Practical Open-Source Intelligence"
  is the current SANS catalog entry).
- **In-game NIST SP 800-63B-4 subtitle** corrected from the
  old Rev. 3 subtitle ("Authentication and Lifecycle Management")
  to the current Rev. 4 subtitle ("Authentication and
  Authenticator Management"). The Rev. 4 citation itself was
  already current from the v0.7.2 cross-track audit.

### Changed

- **Link-audit procedure extended to cover in-game content.**
  Version-bump checklist in `js/engine/version.js` and the
  walkthroughs author guide (`walkthroughs/README.md`) updated:
  the pre-merge link-audit step now audits both the walkthrough
  markdown AND the corresponding `levels/<track>.js`
  lessons-learned content for the same drift categories.
  Cross-track propagation is folded into the same PR when a
  finding clearly affects multiple tracks. Walkthroughs are
  auditor-facing and can carry MITRE-meta caveats; in-game is
  player-facing and avoids framework-internal taxonomy
  noise — the procedure documents this distinction.

## [0.7.4] - 2026-05-23

Another content addition under the documentation infrastructure
introduced in v0.7.0. No user-facing changes to the game itself;
the new content lives at the same non-indexable subpath and is not
linked from anywhere player-visible.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.
- Pre-merge link-audit pass performed before first push (per the
  v0.7.1-established procedure). Ten findings applied — a notable
  legal mischaracterization (the $5M cap on 18 USC §1832 fines
  is the *organizational* maximum, not an individual cap), five
  historical-case date/attribution corrections (McAfee, Ochoa,
  BTK), and four URL/citation refreshes. Walkthroughs at this
  level of historical-case density need this audit step.

## [0.7.3] - 2026-05-23

Another content addition under the documentation infrastructure
introduced in v0.7.0. No user-facing changes to the game itself;
the new content lives at the same non-indexable subpath and is not
linked from anywhere player-visible.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.
- Pre-merge link-audit pass performed before first push; audit
  findings applied before the PR opened (a factual error on a
  cited regulatory-settlement year, a moved SEC press-release
  URL, and a primary-source link that had begun 403-ing for
  automated fetchers).

## [0.7.2] - 2026-05-23

Another content addition under the documentation infrastructure
introduced in v0.7.0, **plus** a cross-track audit of in-game
post-mortem citations that surfaced several factual errors and
version-drift issues. The post-mortem citations players read at the
end of each level are now aligned with current canonical standards
as of May 2026.

### Added

- One additional long-form reference document under the v0.7.0
  documentation scaffolding. Manifest in the subsite client
  router updated to register the new entry.
- Pre-merge link-audit pass performed per the v0.7.1-established
  procedure. Audit findings applied before merge.

### Fixed (in-game post-mortem citations)

- **level0@network — wrong CWE ID corrected.** The Atlas Health
  default-credential finding was cited as CWE-1051 ("Initialization
  with Hard-coded Default Credentials"). CWE-1051 is actually
  "Initialization with Hard-Coded Network Resource Configuration
  Data" — wrong topic. Corrected to **CWE-1392 "Use of Default
  Credentials,"** which is the precise weakness for the scenario.
- **level0@linux — NIST AC-2 enhancement clarified.** The
  post-mortem described AC-2(13) as requiring privileged-account
  termination on separation. AC-2(13) is actually "Disable
  Accounts for High-Risk Individuals" (e.g., people under
  investigation). Corrected to reference **AC-2(3) "Disable
  Accounts"** plus **PS-4 "Personnel Termination"**, which are
  the correct controls for the offboarding scenario.

### Changed (in-game post-mortem references — version drift)

- **OWASP Top 10 references** updated from the 2021 edition to
  the 2025 numbering across levels where the citation slot
  changed: A05 → A02 (Security Misconfiguration), A02 → A04
  (Cryptographic Failures), A07 renamed from "Identification and
  Authentication Failures" to "Authentication Failures."
- **CIS Critical Security Controls** updated from v8 to v8.1
  across linux (×2 levels), network, crypto, web, forensics, and
  osint post-mortems.
- **PCI-DSS** updated from v4.0 to v4.0.1 across linux and crypto
  post-mortems (v4.0 was retired Dec 31, 2024).
- **NIST SP 800-171** updated from Rev. 2 to Rev. 3 (finalized
  May 2024) across web and forensics post-mortems, including
  Rev. 3's updated control numbering format.
- **CompTIA PenTest+** updated from PT0-002 to PT0-003 across
  network and web post-mortems (PT0-002 was retired June 17, 2025).

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

This release also clarifies the versioning policy: MINOR now
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

[Unreleased]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.13.0...v1.0.0
[0.13.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.12.0...v0.13.0
[0.12.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.7...v0.8.0
[0.7.7]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.6...v0.7.7
[0.7.6]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.5...v0.7.6
[0.7.5]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.4...v0.7.5
[0.7.4]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.3...v0.7.4
[0.7.3]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.2...v0.7.3
[0.7.2]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.1...v0.7.2
[0.7.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rlwilliamson-dev/d3cyph3r/releases/tag/v0.1.0
