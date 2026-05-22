# Changelog

All notable changes to D3CYPH3R are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  handoff password (`POL-IIS-2026-0007-handoff`) as the natural
  breadcrumb for a future `level1@forensics`, matching the per-track
  credential-chain pattern used by all other tracks (linux's
  `please-rotate-me`, network's `atlas-default-2025`, crypto's
  Vesta API key, web's `M3rid14n!2023-prod`).
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

[Unreleased]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rlwilliamson-dev/d3cyph3r/releases/tag/v0.1.0
