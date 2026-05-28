# Changelog

All notable changes to D3CYPH3R are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.23.1] - 2026-05-28

**Walkthrough for `level2@forensics` ships — closes out v1.23.0.**
PATCH release; pure documentation. No engine, schema, command, or CSS
changes. The walkthrough at `walkthroughs/forensics/level2.md` carries
the full solve path, vulnerability deep-dive, real-world parallels, the
NIST SP 800-86 / 800-171 Rev 3 / CMMC L2 / NISPOM / CUI Program
framework stack, certification map (GCFE / GCFA / CHFI / Sec+ / CySA+),
defender's playbook, bonus-find context, and ~50 curated external
references (last reviewed: May 2026).

This is the closing PATCH for the v1.23.0 → v1.23.1 split that shipped
`level2@forensics` without its walkthrough. The pattern is one-time:
going forward, walkthroughs gate new level work (see `js/engine/
version.js` step 3 for the tightened rule).

### Added

- **`walkthroughs/forensics/level2.md`** — 6,874 words across the
  standard 9-section template (§1 setup, §2 step-by-step solve, §3
  vulnerability framing, §4 real-world parallels, §5 frameworks,
  §6 certifications, §7 defender's playbook, §7.5 bonus-find context,
  §8 further reading, §9 takeaways).
- **MANIFEST entry** under the forensics track in
  `walkthroughs/walkthrough.js` so the subsite index lists the new page.

### Changed

- **Release checklist tightened** (`js/engine/version.js` step 3):
  walkthroughs may ship in a follow-up PATCH PR ONLY when it's the
  immediate next PR with zero level work between. The "skeleton-then-
  fast-follow" pattern used in v1.23.0 is now explicitly a one-time
  exception. Future level work — same track or different — is gated
  on the previous level's walkthrough being merged.

## [1.23.0] - 2026-05-28

**level2@forensics ships — Phase 1 of the Routine-tier sweep begins.**
First level2 across all 7 tracks (per LEVEL_ROADMAP.md's shipping
order), introducing the `sqlite3` command alongside it. Day three
of the Reed Connolly case: the player uses the IR-lead credential
recovered from level1's evtx 4625 finding to ssh into Polaris IR's
forensic analysis bench, then queries Reed's seized browser-artifact
databases (Chromium History + Cookies) to reconstruct his online
activity in the hours before the Bay 4 badge-in. The smoking-gun
session token gates level3 (when level3 ships).

Walkthrough fast-follows as v1.23.1 (per the soft-gate rule in
version.js step 3). The level itself is fully playable end-to-end
in v1.23.0; the long-form solve guide ships next.

### Added

- **`level2@forensics` — "What Reed's browser saw (sqlite3)"** (~20
  min, Routine tier). Player logs in as `ir-audit` on the Polaris IR
  forensic bench, queries Reed's recovered `History.sqlite` and
  `Cookies.sqlite` databases via the new `sqlite3` command. Surfaces
  a 02:47 Saturday-morning Gmail visit (seven hours before the Bay 4
  badge-in), pre-meditation evidence in the searches Reed ran, and
  a Gmail SID cookie row whose value is the level3 breadcrumb.
  Bonus find: a `downloads` row showing a PowerShell archive script
  pulled from Reed's personal Dropbox nine days earlier — confirms
  the level1 4688 PowerShell chain from a second artifact source.
- **`sqlite3` command (new engine surface).** Read-only SQLite
  query interface for browser-artifact and application-database
  forensics. Subset SQL grammar: SELECT [DISTINCT] cols FROM table
  with WHERE (= , LIKE), ORDER BY, LIMIT, and COUNT(*). Dot-commands
  `.tables`, `.schema [TABLE]`, `.help`. Output flags `-header`
  (column names) and `-column` (aligned table). `level.sqlite_dbs`
  schema field carries the per-file table definitions + row data.
  Intentionally minimal grammar (no JOIN, no aggregates beyond
  COUNT, no INSERT/UPDATE/DELETE) — real forensic tooling handles
  the breadth; this teaches query formation.
- **Manpage entry** for `sqlite3` covering the supported grammar
  with examples. Glossary entries for SQLITE, PLACES.SQLITE, and
  BROWSER-FORENSICS surface via `what-is`.
- **Chain-of-custody hashing demo** in level2's `chain-of-custody.txt`
  + `level.fileHashes`. Player runs `sha256sum Reed/History.sqlite`
  before querying and confirms against the baseline — modelled on
  real NIST SP 800-86 §3.3 forensic-process discipline.

### Changed

- Forensics track is now level0 + level1 + level2 (was level0 +
  level1). 15 levels shipped across 7 tracks.
- v1.18.0 welcome-back summary regex updated for the new level count.

## [1.22.0] - 2026-05-28

**Foundation cleanup before the Routine-tier level2/3/4/5 sweep.**
No new gameplay; this release reserves forward-compatibility schema
slots, commits to the project's English-only localization stance,
adds a mobile-readable content style guide for contributors, and
plants the first cross-track narrative seeds so the seven tracks
start to feel like a shared Driftwood universe rather than seven
isolated bubbles. Pure prep — the next release brings new puzzles.

### Added

- **Four new optional level-schema fields** (`certificationDomains`,
  `learnerJourneyOrder`, `mobileReady`, `crossTrackHooks`).
  Documented in the schema header of `levels/linux.js`. All four are
  forward-looking — they exist so future content sweeps can populate
  them without a schema migration once 28+ levels ship. Reading an
  unset field returns `undefined`, which every current consumer
  tolerates.
- **`crossTrackHooks` populated on 4 shipped levels** (`level0@linux`,
  `level0@network`, `level0@crypto`, `level0@cloud`). Each one
  carries a one-line cross-track reference in the level's CLOSING
  THOUGHT block — Priya mentions next week's Atlas Health
  perimeter check at Halton; Atlas's drift pattern echoes Halton's
  rotation snapshot; Vesta's "I'll clean that up later" pattern
  parallels Coverline's hardcoded-password problem; Coverline's
  bucket misconfigs parallel Vesta's encoding-as-encryption
  mistake. Establishes the pattern; remaining tracks get seeded
  in future content touches.
- **Localization stance in CONTRIBUTING.md.** Committed to
  English-only — no localization layer, no extraction conventions,
  no half-implementation. Keeps strings inline. Documented why
  (audience is professional cybersecurity learners reading English
  cert / framework / MITRE references; hobby project can't sustain
  N-language drift management).
- **Mobile-readable content style guide in CONTRIBUTING.md.** Line
  width (~64 chars for ASCII art), pipe-separated tables over
  fixed-width columns, short paragraphs, narrow indents, when to
  set `mobileReady: true`. Pre-v1.22 levels remain unflagged on
  purpose — the flag is forward-looking.

### Changed

- **Level5→6 tier-shift mechanisms in `LEVEL_ROADMAP.md` are now
  distinct per track** (gitignored planning doc). Previously all
  seven hand-offs were "client returns engagement token"; now each
  triggers via a different mechanism (contract escalation,
  detected intrusion, regulator escalation, legal-counsel
  determination, statutory clock, threat-actor attribution,
  auditor question as disclosure trigger). Level2-4 narrative
  threads in the upcoming sweep should lead to the relevant
  trigger.

## [1.21.0] - 2026-05-27

**Progressive Web App + mobile support.** D3CYPH3R is now
installable as a desktop / phone app via the browser's "Install"
button — gets its own dock icon, runs in a borderless window, and
works offline after first visit (subway, airplane, network outage,
all fine). The mobile gate became a warning rather than a hard
block: phone players can tap "Continue anyway" to enter the
engine, where a soft-key row above the on-screen keyboard adds
Tab / Esc / Ctrl-C / `|` / `&&` / `$` / `_` / etc. — the
characters that are painful to type on phone keyboards.

### Added

- **PWA install path.** New `manifest.webmanifest` declares the app
  name, icons, theme color, and display mode. Chrome / Edge /
  Safari 16.4+ show an "Install" button after a few visits. Once
  installed, the app gets its own dock icon, opens in a borderless
  window, and is alt-tab-focusable like a native app. Icons in 4
  sizes (192/512/maskable-512/iOS-180) with the `> $_` chevron
  prompt design on a high-contrast black background.
- **Service worker (`sw.js`).** Pre-caches the bootstrap shell on
  first visit; everything else (engine modules, level data,
  walkthroughs) caches on-demand via runtime caching. Strategy is
  routing-based: network-first for HTML, stale-while-revalidate
  for JS/CSS, cache-first for vendored libs + icons. Cross-origin
  requests bypass the SW. **Cache name is versioned**
  (`d3cyph3r-v1.21.0`) so each release cleanly retires the
  previous version's cache during the activate event. Future
  content additions (new levels, new commands) require zero
  changes to the SW — runtime caching discovers them automatically
  on first fetch.
- **`sw` command** — inspect / control the service worker from the
  terminal. `sw` / `sw status` shows registration state + active
  version + scope + waiting-update state. `sw update` forces an
  immediate check for a new version. `sw clear` is the panic
  button: unregisters + wipes every D3CYPH3R cache, after which
  a page reload registers a fresh SW.
- **`reload` command** — refresh the page. If a new SW is waiting,
  triggers skipWaiting so the new version activates immediately
  instead of being deferred. Equivalent to F5 / Cmd-R otherwise.
- **Update detection.** When a new SW finishes installing while
  the old one is still controlling the page, the engine prints
  a yellow terminal banner inviting the player to type `reload`.
  Polite — never auto-applies mid-level.
- **Mobile-gate "Continue anyway" button.** After the boot
  sequence completes, mobile players see a primary action
  button below the warning copy. Tapping it sets
  `localStorage["d3cyph3r-mobile-bypass"] = "1"` and reloads
  into the normal engine with `body.mobile-mode` set + the
  `state.isMobileMode` flag exported. PWAs launched in
  `display-mode: standalone` auto-bypass (installing is
  consent).
- **Soft-key row (`js/terminal/softkeys.js`).** Horizontal
  scrolling strip above the on-screen keyboard, visible only when
  `body.mobile-mode` is set. 18 keys: Tab, Esc, ↑, ↓, ^C, `|`,
  `&&`, `||`, `;`, `>`, `$`, `_`, `/`, `~`, `*`, `.`, `-`, `=`.
  Special keys (Tab, Esc, arrows, Ctrl-C) synthesize real
  `KeyboardEvent`s so existing readline handlers process them
  correctly; character keys splice the literal value at the
  cursor. Data-driven KEYS array makes adding new keys a one-line
  append. Tap targets meet the 44×44 minimum from Apple HIG.
- **Tap-to-focus handler.** Tapping anywhere on the terminal
  background focuses the hidden `<input>` element, which triggers
  the on-screen keyboard on iOS / Android. Skipped if the tap
  landed on selected text (selection-then-focus would collapse
  the selection).
- **Responsive CSS (`@media (max-width: 768px)`).** Triggers below
  768px viewport: tighter topbar padding, smaller terminal font
  (11px so 80-col output fits iPhone-portrait), smaller chip
  badges, smaller tab-hint, full-width input. Desktop UI
  unaffected.

### Changed

- **`mobile-gate.js`** — gate is now a WARNING, not a hard block.
  Boot sequence still fires (sets expectations); the final block
  now includes the Continue-anyway button + an explanatory note
  about the soft-key row.
- **`main.js` boot order** — adds `setMobileMode()` early so
  modules that need it see it before they render, and
  `registerServiceWorker()` AFTER `boot()` so SW registration
  doesn't compete with first-paint.
- **`staticwebapp.config.json`** — adds cache-header routes for
  `/sw.js` (no-cache + `Service-Worker-Allowed: /`), `/manifest.webmanifest`
  (no-cache + `Content-Type: application/manifest+json`),
  `/icon-*.png` and `/favicon.svg` (immutable, 1-year max-age).

### Testing

- Playtest grows by 22 assertions (811 → 833). New coverage:
  manifest 200, sw.js 200 with expected body, SW reaches
  `active` state, `sw status` output, `sw --help` block, `sw clear`
  panic flow, mobile-gate renders at narrow viewport,
  Continue-anyway sets the bypass flag, body.mobile-mode +
  soft-key row appear after bypass, soft-key character + multi-
  char insertion (`|` and ` && `) lands in the input correctly,
  bypass persists across reload.

### Browser support

- **Chromium-based** (Chrome / Edge / Brave / Opera / Vivaldi):
  full PWA support, install button appears.
- **Safari 16.4+ macOS**: full PWA support since Sonoma (Mar 2023).
- **Firefox 113+**: service worker registers + offline cache works,
  but install prompt is off by default (browser choice — gated
  behind `about:config`).
- **Safari iOS**: install via "Add to Home Screen"; mobile-gate
  still applies but Continue-anyway works.

## [1.20.0] - 2026-05-27

**Stateless progress codes — portable `save` / `restore`.** A
self-contained code that encodes the player's progress (visited
levels, achievements, bonus finds, per-level times, hint counters,
theme, onboarding flag, lobby-tree expand state) into a string they
can paste into D3CYPH3R running on any other browser/device to
resume from the same point. No server, no account, no telemetry —
the code lives wherever the player puts it (notes app, email to
themselves, paper). The pattern is the password-save mechanic from
1980s NES-era games, adapted to a much larger payload.

### Added

- **`js/engine/savecode.js`** — Pure module owning the
  encode/decode/checksum logic. Format is
  `"D3C2-XXXXXXXX-...-CCCCCCCC"`: 4-char magic ("D3" brand + "C2"
  format version), base64url-encoded **packed binary** payload
  grouped into 8-char hyphenated blocks for visual readability,
  and an 8-char CRC32 hex checksum tail. Hyphens and whitespace
  in the code are decorative — the decoder strips both before
  parsing, so the code can be wrapped or line-broken freely
  when copy-pasting. CRC32 catches typos, truncation, and
  accidental concatenation of two separate codes.
- **Stable append-only registries** for the wire format's small-
  integer indexes: `LEVEL_REGISTRY` (14 levels → 4-bit index),
  `ACHIEVEMENT_REGISTRY` (20 achievements → 1-bit slot in a uint32
  mask), `THEME_REGISTRY` (11 themes → 4-bit index),
  `TRACK_REGISTRY` (7 tracks → 1-bit slot in a uint8 mask),
  `MILESTONE_REGISTRY` (6 booleans → 1-bit slot in a uint8 mask),
  and `BONUS_REGISTRY` (per-level bonus-find ids → 1-bit slot in
  per-level uint8 masks). HARD RULE: once shipped, NEVER reorder
  or delete entries; new entries APPEND to the end. The numeric
  index of an existing entry is burned into every code that
  references it.
- **Code size impact** (measured against fixture states):

  | Player state              | Code length |
  |---------------------------|-------------|
  | Brand new (no progress)   | 35 chars    |
  | Solved level0+1 on one track | 52 chars |
  | Mid-game (5 visited, 4 bonuses, 6 achievements) | 84 chars |
  | Completionist (all 14 levels, all 20 achievements) | 182 chars |

  A completionist's code now fits on a single line in any notes
  app — even potentially typeable in a pinch — instead of the
  ~3KB JSON blob an earlier draft of the format would have
  produced. The savings come from encoding levels / achievements
  / themes as small integer indexes (instead of long string
  IDs), packing per-level flags into 1-byte bitfields, varint-
  encoding time fields with second-resolution quantization,
  and dropping all JSON structural overhead.
- **`save` command** — Generates a code from the current
  session's state and prints it inside divider lines for easy
  copy. Surfaces a usage hint underneath.
- **`restore <code>` command** — Validates a code, prints a
  before-vs-after diff (current state vs. restored state), and
  prompts `[y/N]` before overwriting. Typing `y`/`yes` applies the
  payload and reloads the page so the engine boots into the
  restored state from a clean slate; anything else cancels. Works
  from anywhere (lobby OR inside a level).
- **`restore --preview <code>`** — Decodes + summarizes a code
  without touching state. Useful for sanity-checking a code from
  old notes before committing to overwrite.
- **Confirmation gate `awaitingRestoreConfirmation` in
  `js/engine/state.js`** — Mirrors the existing
  `awaitingPersistenceConsent` and `awaitingPassword` gates. The
  dispatcher in `execute.js` routes the next-typed line to the
  restore confirmation handler when the gate is set.
- **MAN_PAGES + HELP_STRINGS entries for `save` and `restore`** —
  Curated `--help` blocks plus full manpages. Both commands are
  added to the LEARNING AIDS section of `help`.

### Privacy posture

- Codes do NOT contain level passwords or bonus content. They
  encode FACTS about progress (visited level keys, achievement
  ids), not the secrets that gate progress. Knowing the player
  visited `level3@linux` doesn't reveal how to solve
  `level2@linux`.
- Codes do NOT include the v1.11.0 localStorage persistence
  opt-in flag. Opting in to automatic save is a per-device
  privacy choice; restoring a code on a fresh browser does not
  silently opt the player into localStorage persistence on that
  device.

### Testing

- Playtest grows by 28 assertions (782 → 810), covering: code
  format (D3CY1 prefix, CRC32 suffix, length floor), error
  rejection (no args, missing magic, mangled checksum), preview
  no-mutation guarantee, [y/N] confirmation with cancel + apply
  paths, and a multi-field round-trip that stages 3 visited
  levels, 2 achievements, a bonus-find marker, and a hint counter
  before saving, then verifies every field comes back after
  reset + restore + reload.

## [1.19.0] - 2026-05-27

**Lobby visual polish — chip badges + bolder chevrons.** Second of
three lobby-polish releases (after v1.18.0's content polish). The
engagement-list rows now render progress + tier + time as inline-
colored chips instead of plain text, and the expand chevrons swap
from bracketed `[▾]`/`[▸]`/`[✓]` to bare bolder glyphs `▼`/`▶`/`✓`.

### Added

- **`printRich(segments, baseCls)` helper in
  `js/terminal/output.js`** — Accepts an array of strings + `{text,
  cls}` segments and builds a single `.line` div with one or more
  styled spans. Used by the lobby's chip rendering; safely escapes
  text content so untrusted input (none today) would still render
  as plain text.
- **Chip CSS classes** in `style.css`:
  - `.chip` (base — font-weight + slight letter-spacing)
  - Progress: `.chip-progress-empty` (dim), `.chip-progress-partial`
    (yellow), `.chip-progress-complete` (green)
  - Tier: `.chip-tier-routine` (accent), `.chip-tier-live` (yellow),
    `.chip-tier-escalated` (bold yellow), `.chip-tier-critical`
    (red), `.chip-tier-crisis` (bold red)
  - `.chip-time` (dim, for `[~10 min]` estimates)
  - `.chip-title` (bright, for level titles in expanded rows)
  - All colors flip correctly across all 11 themes via existing
    CSS variables.
- **Cache-bust bumped to `?v=1.19.0`** on the main app's
  stylesheet link (walkthroughs/walkthrough.css unchanged so the
  walkthroughs subsite stays at `?v=1.13.0`).

### Changed

- **`js/engine/lobby.js#engagementList`** — Track headers + per-
  level expanded rows now return `{ segments, cls }` shape that
  routes to `printRich`. Scaffolded-only fallback + description +
  blank-separator rows keep the original `{ line, cls }` shape and
  route to `print` — both shapes coexist in the returned array.
- **`js/engine/lobby.js#showLobby`** — Engagement-list loop
  branches on row shape (`row.segments` vs `row.line`) and calls
  the appropriate helper.
- **Chevrons swap** from 3-char bracketed `[▾]`/`[▸]`/`[✓]` to
  bolder bare `▼`/`▶`/`✓` followed by 2 spaces of padding so
  column alignment is preserved exactly.
- **`tests/playtest.cjs`** — 5 new v1.19.0 assertions plus 2
  updated v1.18.0 chevron regex patterns (782 / 782 total).

### Forker notes

- The `printRich` helper is a new public API in
  `js/terminal/output.js`. Forks adding new chip-styled surfaces
  (e.g., a tier display in the connection banner, the progress
  command's per-level rows) can use the same helper without
  changes.
- Chip color choices live in `style.css` only — no JS coupling.
  Re-theming chips is a CSS edit; the engine doesn't care.
- Tier classes are defined for all five tiers even though only
  Routine ships today. The classes light up automatically when
  level6+ ships in v2.0+ and crosses tier boundaries.

## [1.18.0] - 2026-05-27

**Lobby polish bundle for returning players.** The first-visit lobby
walls (WELCOME / FIRST STEPS / FIRST ASSIGNMENT) only fire once;
returning visitors used to land in a near-empty version-tagline + the
engagement list. v1.18.0 fills that gap with a tight progress summary,
a next-up recommendation, a completion glyph on fully-cleared tracks,
and an achievements footer teaser.

### Added

- **Welcome-back greeting for returning visits.** A `WELCOME BACK`
  block replaces the 3-block first-visit intro on second+ visits.
  Compact single-line summary: `N/14 levels visited  ·  N/M bonus
  finds  ·  N/20 achievements  ·  <time> engaged`. Time bit is
  omitted when total elapsed is zero (very-early-session).
- **"Continue: ssh level<N+1>@<track>" next-up recommendation.**
  Computed from the visited set: finds the lowest unvisited
  `level<N+1>@<track>` whose predecessor `level<N>@<track>` has
  been visited. Ranked deterministically (lowest ordinal, then
  alphabetical track). Skipped when the player has no progress yet
  (FIRST STEPS still guides them via the engagement list) or has
  reached all reachable shipped levels.
- **Completion glyph `[✓]` on fully-visited tracks.** When
  `visitedCount === shippedCount` for a track, the header glyph
  swaps from `[▸]`/`[▾]` to `[✓]` and the line uses the success-green
  CSS class. Track is still expandable via `tracks` — the chevron
  just signals "you're done here".
- **Achievements teaser in the lobby footer.** One-line surface for
  the v1.14.0 achievement layer. Shape depends on earned count:
    - earned > 0: `★ N/20 achievements earned — type 'achievements' to view.`
    - earned == 0: `Type 'achievements' to see what's available — they unlock as you play.`

### Changed

- **`js/engine/lobby.js`** — `computeLobbySummary()` aggregates the
  numbers shown in the welcome-back line (reads from sessionStorage
  + the achievements / leveltimer modules). `findNextUpLevel()`
  computes the next-up recommendation. Both pure functions; no DOM
  coupling.
- **`engagementList()`** — track header reads `[✓]` for fully-
  visited tracks and applies the success class.
- **`tests/playtest.cjs`** — 9 new v1.18.0 assertions covering
  the welcome-back banner, the bonus-finds + achievement summary
  bits, completion glyph on a fully-visited track, untouched-track
  chevron preservation, no-next-up when done, footer teaser
  presence, and next-up fires correctly with mid-progress state.

### Forker notes

- The welcome-back greeting is gated on `sessionStorage.seenOnboarding
  === "true"`. The flag is set during the first-visit block, so the
  branch is automatic — no per-fork wiring needed.
- `findNextUpLevel()` is strict: only `level<N+1>@<same-track>` is
  considered a candidate. Forks with non-numbered level chains will
  need a different signal (consider a `next?: "<key>"` field on
  the level schema and reading it from `findNextUpLevel()`).
- Recommended-tier hint (item 10 from the original v1.18.0 scope)
  intentionally deferred — all 14 shipped levels are Routine tier,
  so there'd be nothing to suggest yet. Wire it up when level6+
  ships in v2.0+ and crosses the Routine → Live boundary.

## [1.17.0] - 2026-05-27

**Standardized `cmd --help` across every command.** Third and final
of the small engine-polish MINORs queued between the v1.11–v1.14 QoL
arc and the v2.0 "Apprentice" level2 push. Every command in COMMANDS
now responds to `--help` with a 3-5 line usage block: one-line
description, usage signature, and a pointer to `man <cmd>` for full
details. Closes the Group B engine-polish set — v1.18+ moves on to
v2.0 level2 work.

### Added

- **`js/commands/help-strings.js`** — New module owning the
  HELP_STRINGS curated-override map and `getCommandHelp(cmd)`
  resolver. Curated entries win; the resolver auto-synthesizes a
  block from the corresponding MAN_PAGES entry (NAME + SYNOPSIS
  sections) when no override exists. Every shipped command has a
  MAN_PAGES entry, so coverage is automatically complete.
- **~15 curated HELP_STRINGS overrides** for high-traffic +
  multi-subcommand commands where the auto-extracted version
  wouldn't surface the useful surface area:
  - `progress`, `git`, `openssl`, `theme`, `achievements`,
    `tutorial`, `hint` (subcommand-heavy)
  - All 13 read-only sandbox stubs (`chmod`, `chown`, `mv`, `cp`,
    `rm`, `mkdir`, `rmdir`, `touch`, `ln`, `sudo`, `su`,
    `useradd`, `passwd`) — short stub-friendly message rather than
    the manpage extraction.

### Changed

- **`js/engine/execute.js#runSegment`** — Intercepts `--help`
  before calling the handler when:
  - The command exists (typos still get "command not found" +
    v1.15.0 did-you-mean).
  - The segment is a STANDALONE invocation, not mid-pipeline.
    `echo --help | wc -c` still echoes the literal "--help" through
    the pipe; only `echo --help` (standalone) shows the help block.
    Command substitution `$(cmd --help)` skips the hook entirely
    because runForOutput inlines its own dispatch.
  - argv post-command actually contains `--help`.
- **`js/engine/execute.js#runPipeline`** — Passes `isStandalone`
  (true when `segments.length === 1`) into runSegment so the
  --help check knows whether to intercept.
- **`tests/playtest.cjs`** — 12 new v1.17.0 assertions covering
  auto-extracted blocks (ls, grep), curated overrides (progress,
  git, chmod, theme, achievements, openssl), typo + --help guard,
  and the pipeline pass-through (`echo --help | wc -c`).

### Forker notes

- Adding a new command: write its MAN_PAGES entry as you would
  today and it picks up `--help` automatically via the
  auto-extraction path. For high-value commands (multi-subcommand,
  unusual flag set), add a curated HELP_STRINGS override for a
  tighter block.
- The interception is a single check in `runSegment` — easy to
  rip out, replace, or augment (e.g., add `-h` as an alias would
  be a 4-character edit).
- `extractSection()` in `help-strings.js` parses the existing
  manpage format (column-0 section headers, indented content,
  blank lines between sections). If you change MAN_PAGES'
  structure, update the extractor accordingly.

## [1.16.0] - 2026-05-27

**Per-level time tracking + solve detection.** Second of three small
engine-polish MINORs after the v1.11–v1.14 QoL arc. Records how long
the player has spent in each level (total across visits) and captures
the elapsed time at the moment of first solve. Zero new schema on
levels — solve detection rides on the existing per-track credential
chain: visiting `level<N+1>@<track>` proves you solved
`level<N>@<track>` and stamps its first-solve time.

### Added

- **`js/engine/leveltimer.js`** — New module owning the in-memory
  levelTimes registry + sessionStorage mirror, the entry/exit
  accumulator, solve detection via `isNextInChain()`, the
  `formatTime()` helper (`< 1s` / `<S>s` / `<M>m <S>s` / `<H>h <M>m`),
  and the beforeunload flush hook. Pure module; depends only on
  persistence.js for `mirrorSession`.
- **`progress --detail` per-level time tags** — Each visited level
  row now shows `   <total>` (and `(solve: <elapsed>)` for solved
  levels). Live-running clock for the currently-active level.
- **Connection banner "Previous solve time"** — When revisiting a
  solved level, the banner adds a dim `Previous solve time: 12m 34s`
  line under the existing Tier / Est. time bits.
- **beforeunload flush** — `js/main.js` registers a `beforeunload`
  listener that flushes the running elapsed into storage so closing
  the tab doesn't drop the time accumulated in the currently-open
  level. Best-effort — some browsers skip beforeunload during hard
  tab close, but the common refresh-and-navigate case is captured.

### Changed

- **`js/engine/ssh.js#connectTo`** — Calls `stopLevelTimer(key)`
  before `setCurrentLevelKey` on top-level navigations (skipping
  pivot entry and unwind paths so pivots ride on the parent's
  timer). After the new key is set, calls `startLevelTimer(key)`
  for non-pivot, non-lobby destinations. Banner section adds the
  "Previous solve time" surface for solved levels.
- **`js/engine/persistence.js`** — `d3cyph3r:levelTimes` added to
  `TRACKED_KEYS.static` so opted-in players' per-level times
  survive across sessions.
- **`js/commands/learning.js#progress`** — `--detail` renderer
  appends the time-tag per visited level. `progress reset` calls
  `clearLevelTimes()` to wipe the in-memory map (the sessionStorage
  + localStorage wipe is handled by the existing `clearAllProgress`
  via TRACKED_KEYS).
- **`js/main.js`** — `initLevelTimer()` runs after
  `loadBonusesFromStorage()` to rehydrate the registry; the
  beforeunload listener is wired here too.
- **`tests/playtest.cjs`** — 10 new v1.16.0 assertions (T1–T7)
  covering first-visit-no-banner, solve detection via
  `level0→level1`, terminal-level no-solve-tag, sessionStorage
  blob shape, and the revisit banner.

### Forker notes

- Terminal levels (last in their track, no level<N+1> shipped yet)
  don't get a solve time by design — there's no next-in-chain
  trigger. When you ship `level2`s in v2.0, the existing level1s
  will retroactively become solveable via the same mechanism.
- The format thresholds in `formatTime()` are tuned for sub-hour
  sessions: seconds resolution under a minute, minute+seconds
  under an hour, hours+minutes past that. Tweak the cutoffs if
  your audience consistently spends multi-hour blocks per level.
- `isNextInChain()` is strict: it only matches `level<N+1>@<same-
  track>`. Forks with non-numbered level chains will need a
  different signal — consider adding a `solveTrigger?` field to
  the level schema and checking it in `stopLevelTimer`.

## [1.15.0] - 2026-05-27

**Did-you-mean typo suggestions on unknown commands.** First of three
small engine-polish MINORs queued after the v1.11–v1.14 Quality-of-Life
arc and before the v2.0 "Apprentice" level2 push. When a player types
something the dispatcher doesn't recognize, the existing red "command
not found" line now gets a yellow follow-up suggesting the closest
registered command — when one is close enough. Conservative on purpose:
no false-positive nudges on genuine nonsense input.

### Added

- **`js/engine/suggest.js`** — New module owning Levenshtein distance,
  the per-length threshold rule, and the best-match picker. Pure
  functions; no DOM or state coupling. Easy to unit-test, easy to
  swap algorithms later (e.g., Damerau-Levenshtein for transposition
  awareness) without touching the dispatcher.
- **Conservative threshold rule:** distance ≤ 1 for typed strings of
  length 1–3, distance ≤ 2 for length 4+. Short-string tightening
  prevents nonsense like `xy → ls` (distance 2 in raw Levenshtein,
  absurd as a suggestion) from triggering.
- **Case-insensitive matching with explicit case-mismatch tip:** `LS`
  matches `ls` at distance 0 — but rather than print a confusing
  "Did you mean: ls?" loop, the dispatcher recognizes the
  same-string-different-case pattern and prints
  `Did you mean: ls? (command names are lowercase)` instead.
- **Candidate pool includes ssh**, which lives outside `COMMANDS`
  but is a real command from the player's point of view. `sshh`
  → `ssh`.
- **Tie-breaking:** when multiple candidates share the best
  distance, the shorter one wins (`lss` → `ls`, not `lsof`); on
  equal length, alphabetical (deterministic for tests).

### Changed

- **`js/engine/execute.js`** — `runSegment()`'s "command not found"
  branch now consults `suggestCommand()` and prints a yellow tip
  underneath the red error when a match exists. The not-found
  message itself is unchanged; the tip is purely additive. The
  `$(...)` substitution path in `runForOutput()` deliberately
  skips suggestions — substitution failures are programmatic, not
  interactive typos.
- **`tests/playtest.cjs`** — 5 new v1.15.0 assertions covering
  the four suggestion shapes (typo → command, case-mismatch tip,
  ssh in candidate pool) and a no-false-positive guard against
  the existing `definitelynotacommand` nonsense input.

### Forker notes

- Threshold rule lives in `thresholdFor(length)` in
  `js/engine/suggest.js` — one-line tweak to widen or tighten.
  If you're shipping a fork with shorter command names overall,
  consider raising the short-string threshold to 2; the current
  pool's median command length is ~5 chars so 1/2 works well.
- The candidate iterable is whatever you pass into
  `suggestCommand()`. The current dispatcher uses `ALL_CMDS`
  (the COMMANDS keys + `"ssh"`); if you want to include aliases
  or per-level commands later, just extend the iterable.

## [1.14.0] - 2026-05-27

**20-achievement layer over bonus finds.** Fourth and final of the
Quality-of-Life MINORs queued before the v2.0 "Apprentice" level2
push. Layers 20 achievements on top of existing tracked state
(visited levels + bonus finds + hint counters + theme + persistence
flag) plus a small "milestones" flag store for "ever done X"
tracking. Achievement criteria are visible from the start —
they're motivation, not hidden objectives.

### Added

- **`js/engine/achievements.js`** — New module owning the 20-row
  registry, milestone flag tracking, the achievement check + unlock
  banner, and the derived-state aggregator that achievement check
  functions read. Single source of truth; new achievements are
  one-row appends.
- **20 achievements across 4 tiers:**
  - *Easy:* First Steps, First Discovery, Going Deep, Branching
    Out, Pipe Apprentice, Asked for Help, Studious, Tutorial
    Graduate, Style Points, 1985, Persistent Player
  - *Medium:* All Hands, Sleuth, Multi-Host Pivot, Job Runner
  - *Hard:* Thorough, Polymath, The Hint Avoider
  - *Completionist:* Track Master, Completionist
- **`achievements` command** + `achievements --detail` — Lists every
  achievement grouped by tier with `★` (success-green) for earned
  and `·` (dim) for unearned. `--detail` adds a progress fraction
  for the 8 achievements where progress is measurable.
- **Unlock banner** — When an achievement is first earned, a yellow
  callout fires inline:
  ```
  ★ Achievement unlocked: <Name>
    <Description>
  ```
- **Milestone tracking** — Lightweight "have you ever done X?"
  flags in sessionStorage, populated by `recordMilestone(key)` calls
  scattered through 7 existing handlers. Used by the achievements
  whose criteria aren't otherwise derivable from existing state
  (Pipe Apprentice, Asked for Help, Studious, Tutorial Graduate,
  Style Points themes-tried, Multi-Host Pivot, Job Runner).

### Changed

- **`js/engine/execute.js`** — Post-dispatch `checkAchievements()`
  call runs once per top-level dispatch, alongside the existing
  `checkBonusFinds()` hook. Pipe + background-job detection wired
  in (one-line `recordMilestone()` for each).
- **`js/engine/ssh.js`** — Explicit `checkAchievements()` call at
  the end of `connectTo()` because ssh short-circuits before the
  execute.js post-dispatch hook. `pushHost()` site records the
  `multiHostPivot` milestone.
- **`js/engine/persistence.js`** — Persistence consent handler
  (the `y/N` prompt path) explicitly fires `checkAchievements()`
  after enabling so "Persistent Player" unlocks immediately on
  opt-in (the consent path bypasses execute.js). Two new keys
  added to TRACKED_KEYS: `d3cyph3r:earnedAchievements` and
  `d3cyph3r:milestones`.
- **`js/terminal/theme.js`** — `setTheme()` records the new theme
  to the milestone store's themes-seen array. Dynamic import to
  avoid the circular dependency between achievements.js and
  theme.js (achievements.js reads the current theme name).
- **`js/commands/learning.js`** — `man` handler records the
  `manRead` milestone on successful lookup; `walkthrough` handler
  records `walkthroughOpened`.
- **`js/commands/tutorial.js`** — Tour-complete branch (final step
  of `tutorial start`) records the `tutorialCompleted` milestone.
- **`js/commands/man-pages.js`** — Added `man achievements`.
- **`js/commands/shell.js`** — Help reference adds `achievements`
  + `achievements --detail` rows.
- **`tests/playtest.cjs`** — 15 new v1.14.0 assertions covering
  the `achievements` command surface, tier sections, 4 spot-checks
  on registry names, 1985 + First Steps + Asked for Help unlock
  detection, `--detail` progress fractions, localStorage mirror
  on opt-in. The pre-existing v1.11.0 D3 assertion was updated
  from "blob === null after reset" to "blob doesn't carry
  visited/bonuses/hint keys" to reflect the new re-earn behavior
  (Persistent Player re-grants immediately after `progress reset`
  because the opt-in flag is preserved by design).

### Notes for forkers

- **The registry is one constant.** To add a 21st achievement, add
  a row to `ACHIEVEMENTS` in `js/engine/achievements.js` with id /
  name / tier / description / check function. The check receives
  a derived-state object — see `computeAggregates()` for what's
  exposed; extend it if you need a new aggregate. The command
  surface, unlock banner, persistence, and `--detail` rendering
  all pick the new row up automatically.
- **Anti-spoiler rule does NOT apply here.** Bonus finds and
  `progress --detail` carefully hide undiscovered finds; achievements
  are public from the start. The criteria for "Polymath: find a
  bonus on every track" doesn't spoil any puzzle — it tells the
  player what they're working toward. Forkers should preserve this
  posture if extending the registry.
- **Re-earning after reset is intentional.** `progress reset` wipes
  the earned-achievements key alongside everything else, but the
  post-reset achievement check immediately re-grants any
  achievements whose criteria still hold (e.g. Persistent Player
  if the opt-in flag is still set). This is correct: the player
  IS still persistent, they just lost their visit/bonus history.

## [1.13.0] - 2026-05-27

**11-theme picker.** Third of four Quality-of-Life MINORs queued
before the v2.0 "Apprentice" level2 push. Replaces the binary
dark↔light toggle with a registry of 11 themes spanning the
D3CYPH3R originals, retro-terminal looks (CRT phosphor, VT220
amber), modern cyberpunk (synthwave), classic dev community
favorites (Solarized dark + light, Nord, Gruvbox, Dracula), and
accessibility (high-contrast). Themes carry across both the main
terminal and the walkthroughs subsite, persist via localStorage,
and switch via the topbar cycle button OR the new player-facing
`theme` / `themes` commands.

### Added

- **`js/commands/themes.js`** — New module exposing two commands.
  `themes` (plural) lists every available theme with a one-line
  description and marks the current one with `→`. `theme` (no
  arg) prints the active theme and how to switch. `theme <name>`
  switches by name (case-insensitive). `theme next` / `theme prev`
  cycle through the registry order. Unknown names error
  gracefully without changing the active theme.
- **9 new themes** in `style.css` + `walkthroughs/walkthrough.css`:
  `crt-green` (phosphor on near-black, iconic hacker-movie
  aesthetic), `amber` (VT220 / IBM 3270 retro Unix), `synthwave`
  (outrun neon on deep purple), `solarized-dark` and
  `solarized-light` (Ethan Schoonover's classics, dark + daytime
  siblings), `high-contrast` (pure white on pure black with
  saturated accents — accessibility AND movie-hacker look),
  `nord` (calm icy palette), `gruvbox` (warm earthy), and
  `dracula` (popular dev theme). Existing `dark` (default) and
  `light` are kept as-is. Total: 11 themes.
- **`data-theme-mode` body attribute.** Each theme is classified
  as `dark` or `light` based on surface luminance; this drives
  the topbar moon ↔ sun icon swap (was: hardcoded to the
  `body.light` class). Returning users on the light theme see
  the sun; everyone on the 9 dark variants sees the moon.
- **23 new playtest assertions.** Cover the full theme surface:
  `themes` lists all 11, `theme` reports current, `theme <name>`
  switches the body attribute, mode flips correctly for light
  themes, invalid names don't change state, `theme next` / `prev`
  cycle, localStorage round-trips across reload, the topbar click
  cycles. Total: 726 checks, all passing.

### Changed

- **`js/terminal/theme.js`** — Rewritten from the binary
  `toggleTheme()` / `initTheme()` pair to a multi-theme API:
  `THEMES` registry export, `setTheme(name)`, `getTheme()`,
  `cycleTheme(direction)`, `findTheme(name)`, `initTheme()`.
  `setTheme` applies both `data-theme` and `data-theme-mode`
  attributes to body. localStorage key unchanged (`d3cyph3r-theme`)
  for backwards compatibility — pre-v1.13.0 saved values of
  `"dark"` or `"light"` round-trip cleanly through the new
  registry.
- **`style.css`** — Removed the `body.light` overlay block and
  the dead `.glyph-white/.glyph-green/.glyph-cyan/.glyph-accent/
  .glyph-yellow/.glyph-red` legacy classes (unused since the
  v1.10.0 wordmark refresh; confirmed via grep that no JS
  references them). Replaced with 10 `body[data-theme="<name>"]`
  blocks (light + 9 new themes) that override the full palette +
  wordmark glyph variables in one place. The `:root` block is
  now the canonical "dark" theme.
- **`walkthroughs/walkthrough.css`** — Mirror of the main app's
  per-theme blocks (without the `--glyph-*` family, since the
  subsite has no lobby logo). Adds the `--bg-card` variable per
  theme for the docs-reader card surface.
- **`js/main.js`** — Topbar button now calls `cycleTheme()` and
  refreshes the button's `title` after each click to show the
  current theme name on hover.
- **`js/commands/man-pages.js`** — Added `man theme` and
  `man themes` entries covering the full command surface and the
  three-group taxonomy of available themes.
- **`js/commands/shell.js`** — Help reference adds `themes`,
  `theme <name>`, and `theme next / prev` rows in the TERMINAL
  section alongside `tiers`, `tracks`, `report`.
- **`index.html` + `walkthroughs/index.html`** — Stylesheet
  cache-bust queries bumped to `?v=1.13.0` so returning visitors
  pick up the new CSS without the typical 4-hour Cloudflare-CDN
  stale-cache window.

### Notes for forkers

- **Theme registry is one constant.** Adding a 12th theme:
  add a row to `THEMES` in `js/terminal/theme.js`, add matching
  `body[data-theme="<name>"]` blocks in both stylesheets, bump
  the CSS cache-bust query in both `index.html` files. The
  `theme`/`themes` commands and the topbar cycle button pick it
  up automatically — no further wiring.
- **Cross-subsite theming.** Both stylesheets reference the same
  CSS variable names (`--bg`, `--fg`, etc) for the same purposes,
  so each `body[data-theme="<name>"]` block is duplicated across
  the two files. Future cleanup could extract a shared
  `themes.css` both subsites link, but that's a v3.x architecture
  consideration; for v1.13.0 the duplication is intentional and
  documented at the top of each per-theme block.
- **Glyph cascade variables (`--glyph-bright/--glyph-mid/
  --glyph-dim/--glyph-bracket`) live in the main app's
  `style.css` only.** The walkthroughs subsite has no lobby
  wordmark, so duplicating them there would be dead weight.
- **The `data-theme-mode` attribute is computed, not configured.**
  It's set by `setTheme()` based on the theme's `mode` field in
  the registry. CSS uses it to swap the topbar icon (moon vs
  sun) and could be used by future styles that depend on
  surface luminance (focus rings, accent saturation, etc).

## [1.12.0] - 2026-05-26

**First-visit guided tour.** Second of four Quality-of-Life MINORs
queued before the v2.0 "Apprentice" level2 push. Layers two new
surfaces on top of the existing first-visit welcome banner: an
annotated FIRST STEPS quickstart that appears automatically on a
new player's first lobby render, and an opt-in interactive
walk-through (`tutorial start`) that hand-holds them through their
first four commands. Returning players who skip both surfaces see
no UX change.

### Added

- **`js/commands/tutorial.js`** — New module owning the tour. Exports
  the `tutorial` command (with subcommands: no-arg reprints the
  FIRST STEPS list, `start` enters the interactive walk-through,
  `skip` exits the walk-through, `reset` clears the welcome-banner
  gate), the `FIRST_STEPS_LINES` shared content (imported by lobby.js
  so the banner and the command never drift), and the dispatch
  helpers `handleTourInput`, `reprintStepAfterAdvance`,
  `printTourCompleteBanner`.
- **Annotated FIRST STEPS section** in the lobby first-visit welcome
  banner. Five numbered commands: `help`, `tracks`, `tiers`,
  `progress`, `ssh level0@linux`. Each one is meaningfully useful
  for a new player and the list is read-once, not a state machine —
  so a returning player who already knows the basics can skim past
  it without interruption. The block tells the player about
  `tutorial start` for the interactive option.
- **Interactive walk-through** triggered by `tutorial start`. Four
  steps: type `help` → `tracks` → `tiers` → `ssh level0@linux`. Each
  step prints its own intro in yellow, waits for the expected
  command, advances when matched, and prints a one-line nudge if a
  different command is typed (but still lets the typed command
  run — the player is never trapped). Typing `skip` or `tutorial
  skip` exits cleanly at any prompt. The completion banner prints
  before the final ssh dispatch so it appears above the level-entry
  chrome (connection banner, lesson, objective, persistence prompt)
  rather than buried beneath it.
- **`tourStep` state binding** in `js/engine/state.js`. `-1` when
  no tour is running; `0..N-1` for the current step. Mirrors the
  existing `awaitingPassword` / `awaitingPersistenceConsent`
  pattern.
- **22 new playtest assertions.** Smoke checks on the FIRST STEPS
  banner content (numbered commands present, `tutorial start`
  named); a dedicated v1.12.0 block exercises the interactive tour
  end-to-end including the mismatch-nudge-doesn't-advance behavior,
  the four-step walk, the order-check (completion banner BEFORE
  connection banner), `skip` cleanup, and the lobby-only guardrail
  on `tutorial start`. Total: 703 checks, all passing.

### Changed

- **`js/engine/lobby.js`** — Imports `FIRST_STEPS_LINES` from
  `tutorial.js` and prints them as a new FIRST STEPS section in the
  first-visit welcome banner, between the Driftwood-world intro and
  the existing FIRST ASSIGNMENT section. FIRST ASSIGNMENT was
  trimmed slightly since the ssh invocation now appears in FIRST
  STEPS as step 5 (it kept the credential-chain context line).
- **`js/engine/state.js`** — Added `tourStep` + `setTourStep`.
- **`js/engine/execute.js`** — New dispatch route between the
  persistence-consent short-circuit and the ssh special-case.
  Branches on the tour outcome: SKIP suppresses dispatch (the input
  was 'skip', not a real command); COMPLETE prints the banner
  BEFORE dispatch; ADVANCE prints the next step's instructions AFTER
  dispatch; STAY / INACTIVE pass through to normal dispatch.
- **`js/commands/index.js`** — Registers `tutorialCommands`.
- **`js/commands/shell.js`** — Help reference adds `tutorial` and
  `tutorial start` rows alongside `progress`.
- **`js/commands/man-pages.js`** — New `man tutorial` page covering
  all four subcommands, the lobby-only guardrail, and the
  relationship to the welcome-banner gate.
- **README.md** — Learning-aids inline reference picks up
  `tutorial` and `tutorial start` with their v1.12.0 marker.
- **`style.css`** — Terminal-area font sizes scaled to ~80% of
  the prior values so the app looks right at 100% browser zoom
  instead of expecting players to zoom out to 80% themselves.
  Affected: body (14→11px), topbar (12→10px), logo wordmark
  (42→34px), input wrapper + caret-input mirror (14→11px each),
  tab hint (13→10px), site footer (11→9px). Error pages and
  the mobile gate were left at their existing sizes since
  they're not part of the terminal flow. Cache-bust query in
  `index.html` (`style.css?v=1.12.0`) bumped accordingly.

### Notes for forkers

- The tour's per-step content is a small array of objects in
  `tutorial.js#TOUR_STEPS`. Each entry is `{ instruction, expected,
  humanized? }`. To extend or modify the tour, edit that array — no
  changes to the dispatch loop or state machine required. The
  `expected` field accepts a string (exact match after trim) or a
  RegExp (anchored, whitespace-tolerant). RegExp authors should
  supply a `humanized` string so the mismatch-nudge message stays
  readable.
- The walk-through does NOT have a "you've completed this" flag —
  it's always replayable via `tutorial start`. The annotated banner
  IS gated, by the existing `seenOnboarding` sessionStorage key
  (which the v1.11.0 persistence layer already mirrors to
  localStorage for opted-in players). Players who want to re-see
  the banner without rejoining as a fresh user run `tutorial reset`.
- Dispatch loop ordering: the tour check runs AFTER the
  `awaitingPassword` / `awaitingPersistenceConsent` short-circuits
  in `execute.js`. This means the password and consent gates always
  take priority — you can never get trapped in a tour state while
  a password is pending.

## [1.11.0] - 2026-05-26

**Opt-in localStorage progress persistence.** First of four Quality-
of-Life MINORs queued before the v2.0 "Apprentice" level2 push (the
others: first-visit guided tour, multi-theme picker, achievement
layer over bonus finds). Default behavior is unchanged — every
returning player who opts out (or never opts in) keeps the
sessionStorage-only model: progress survives reloads within the
tab but resets when the tab closes. Opting in mirrors progress to
localStorage so it survives across browser sessions on the same
device.

### Added

- **`js/engine/persistence.js`** — New module owning the opt-in
  persistence layer. Exports `mirrorSession(key, value)` (writes
  to sessionStorage AND, if enabled, to a single JSON blob in
  localStorage), `hydrateFromLocal()` (called from `main.js` boot
  order before `loadBonusesFromStorage()`, copies the blob back
  into sessionStorage), `enablePersistence()` /
  `disablePersistence()` / `clearAllProgress()`, plus the prompt
  helpers `maybePromptForPersistence()` and
  `handlePersistenceConsent()`. Single chokepoint for every
  tracked write — the registry of tracked keys is one constant at
  the top of the file.
- **Opt-in prompt** — Fires once per session, immediately after
  the first successful non-lobby connect (post-banner, post-
  lesson, post-objective). Yellow callout with the privacy posture
  spelled out: stored only in this browser on this device, never
  sent to a server, never visible to other players, never used
  for analytics; clear any time with `progress reset` or the
  browser's site-data clear button. Defaults to opt-OUT — only
  explicit "y"/"yes" enables; anything else (including blank
  Enter) skips. The cautious default matches the privacy-conscious
  posture the rest of the project takes.
- **`progress save-on` / `save-off` / `reset` subcommands** —
  Player-facing controls for the persistence layer. `save-on`
  enables mirroring and snapshots whatever progress already
  exists in the current session (so opting in mid-play doesn't
  lose what came before). `save-off` disables mirroring AND
  deletes the localStorage blob (current tab's sessionStorage is
  untouched). `reset` wipes every tracked sessionStorage key plus
  the blob; the opt-in flag is preserved so future progress is
  still saved if the player had previously opted in.
- **`awaitingPersistenceConsent` state flag** — Routes the next
  Enter press to `handlePersistenceConsent` instead of normal
  dispatch. Mirrors the existing `awaitingPassword` pattern.
  Blank-Enter handling intentionally bypasses the
  `if (!input) return;` early-exit in `execute.js` so that
  Enter-as-skip works exactly as the prompt promises.
- **23 new playtest assertions** — Smoke checks for the prompt
  + privacy-posture copy + `[y/N]` defaulting at the entry point;
  a dedicated v1.11.0 block at the end of the playtest exercises
  the full opt-in roundtrip (opt-in → reload → progress survives;
  prompt does NOT re-fire when already enabled), `save-on` /
  `save-off` / `reset` semantics including flag preservation
  across reset, and storage isolation (the existing
  `d3cyph3r-theme` / `d3cyph3r-history` localStorage keys are NOT
  touched by any persistence command). Total: 681 checks, all
  passing.

### Changed

- **`js/engine/state.js`** — Added `awaitingPersistenceConsent`
  live binding + `setAwaitingPersistenceConsent()` setter
  alongside the existing `awaitingPassword` infrastructure.
  `markBonusFound()`'s sessionStorage write now routes through
  `mirrorSession()`. Added `clearInMemoryProgress()` so
  `progress reset` can drop the in-memory `foundBonuses` Set
  without forcing a reload.
- **`js/engine/progress.js`** — `markVisited()` writes through
  `mirrorSession()`. Header comment updated to reference the
  optional persistence layer.
- **`js/engine/lobby.js`** — Three tracked write sites converted:
  the seed-from-visited path inside `readExpandedTracks()`, the
  `writeExpandedTracks()` setter, and `seenOnboarding`.
- **`js/engine/ssh.js`** — `connectTo()` calls
  `maybePromptForPersistence()` at the end of every successful
  non-lobby connect. Skipped silently when already enabled or
  already prompted this session.
- **`js/engine/execute.js`** — Short-circuit route added after the
  password handler: `awaitingPersistenceConsent → handlePersistenceConsent()`.
  The blank-input early-return at the top of `execute()` now
  bypasses for consent mode so the prompt's "Enter to skip"
  promise actually works.
- **`js/main.js`** — Added `hydrateFromLocal()` call between
  `initTheme()` and `loadBonusesFromStorage()` so the rehydrated
  blob is in place before any downstream module reads
  sessionStorage.
- **`js/commands/learning.js`** — `progress` command extended with
  three new subcommands and a dynamic footer that reflects whether
  persistence is currently enabled (replaces the static
  "Progress is per-tab" footer). Hint-counter write site routes
  through `mirrorSession()`.
- **`js/commands/man-pages.js`** — `man progress` updated with the
  new SYNOPSIS lines + a paragraph describing the persistence
  privacy posture.
- **`js/commands/shell.js`** — `help` learning-aids section adds
  `progress save-on/off` and `progress reset` entries.
- **README.md** — Learning-aids inline reference picks up the new
  `progress` subcommands with their v1.11.0 marker.

### Notes for forkers

- The persistence module is the new chokepoint for any
  sessionStorage write that should survive across sessions for
  opted-in players. New sessionStorage keys: add them to
  `TRACKED_KEYS` in `js/engine/persistence.js` (static set OR
  prefix family) AND route writes through `mirrorSession(key, value)`.
  Reads continue to use sessionStorage directly — the layer is
  asymmetric on purpose.
- Conflict policy on hydration: sessionStorage wins. If both
  stores have a value for a tracked key, the in-tab value is
  treated as authoritative. This makes `hydrateFromLocal()`
  idempotent and prevents stale localStorage data from clobbering
  the current tab's in-progress work.
- All storage operations are wrapped in try/catch and silently
  degrade on failure. Persistence is a convenience, not a hard
  requirement — private-browsing players, players with site data
  disabled, and players whose localStorage quota is exhausted
  keep playing without any errors surfaced to them.

## [1.10.1] - 2026-05-26

**Docs catch-up + dead-code purge.** Patch release covering
documentation surfaces that landed in v1.10.0's later commits but
didn't propagate to the contributor-facing docs, plus a swept
dead-code audit that removed ~90 lines of code unreachable since
the v1.10.0 tier system + cross-track bonus rollout settled.

### Changed (docs)

- **CONTRIBUTING.md** — Added sections covering the v1.10.0 tier
  system (Routine / Live / Escalated / Critical / Crisis computed
  from level number), the cold-start gate hint + future-level tip
  three-way ssh routing logic, the cross-track bonus-finds rollout,
  and the §7.5 walkthrough author pattern.
- **walkthroughs/README.md** — Added an `§7.5 Optional exploration`
  row to the section template plus a dedicated author guide
  explaining the pattern (anti-spoiler discipline applies to
  `progress --detail`, NOT to walkthroughs; structure each §7.5
  intro paragraph + per-bonus subsection with trigger and expanded
  lesson + real-world pattern reference).

### Removed (dead code)

- **`js/engine/validate.js`** — Dropped the `DIFFICULTY_LEVELS`
  constant + the `level.difficulty` enum-validation block + the
  header-comment bullet documenting them. v1.10.0 removed the
  manual `difficulty:` field from every shipped level; tier is
  computed via `tierForLevel(N)`, so the validator's enum check
  was misleading any forker who read the source.
- **`js/terminal/output.js`** — Dropped unused `printAscii()` and
  `printBanner()` exports (no callers; the lobby wordmark uses
  direct DOM in `js/engine/lobby.js#renderLogo`).
- **`js/engine/tiers.js`** — Dropped unused `tierDescription()`
  helper (the `tiers` command iterates `TIERS` directly).
- **`js/engine/state.js`** — Dropped unused `getEnvVar()` export
  (all reads go through `getEnv()` in expand.js for the merged
  3-layer view).
- **`js/commands/env.js`** — Dropped the unused `processEnv` import.
- **`js/commands/sysinspect.js`** — Dropped the unused `parseArgs()`
  helper (~33 lines). Defined but never called; every handler in
  the module does its own ad-hoc token split, as the function's
  own comment admitted.
- **`js/commands/linux.js`** — Dropped the legacy `env` handler
  that v1.9.0's `envCommands.env` had been silently shadowing
  since the v1.9.0 spread order in `js/commands/index.js`.

### Changed (refactor)

- **Lobby-expand state is now single-sourced.** `EXPAND_STORAGE_KEY`
  + `readExpandedTracks()` + `writeExpandedTracks()` all live in
  `js/engine/lobby.js` and are imported by `js/commands/lobby.js`.
  Previously the storage key and a parallel reader were duplicated
  across the two modules; they could drift on rename.

### Fixed (docs)

- **`js/terminal/dom.js`** — Corrected stale comment on the
  `levelBadge` element ("level + difficulty" → "current level
  key" — the badge never showed difficulty/tier).
- **`js/engine/bonus.js`** — Corrected stale comment claiming
  `progress` reads `state.foundBonuses` directly (it queries
  through `isBonusFound`).

Playtest: 654/654 (unchanged from v1.10.0 — purge had no behavioral
impact, all changes were dead-code paths).

### Changed (CI/deploy hygiene)

- **Prune dev/docs files from the CDN deploy** — Added a step to
  `.github/workflows/azure-static-web-apps-…yml` that removes the
  following from the deploy payload before SWA uploads it:
  `tests/`, `CHANGELOG.md`, `README.md`, `CONTRIBUTING.md`,
  `walkthroughs/README.md`, `.gitignore`. These were accidentally
  CDN-served because SWA's `app_location: "/"` ships the entire
  repo. Expected ~14% reduction in deployed size (~313 KB) without
  affecting any player-facing surface. `LICENSE` and `SECURITY.md`
  remain served (legal + security-disclosure conventions).

## [1.10.0] - 2026-05-26

**Lobby polish + cold-start UX + cross-track bonus finds.** The first
MINOR after v1.9.0 wraps the engine-polish run. AVAILABLE ENGAGEMENTS
becomes a collapsible tree so the lobby scales gracefully as
level2/level3 land per-track; `progress` learns a `--detail` flag
for in-game review of unlocked bonus finds; a cold-start gate hint
nudges players who try to enter a gated level without having visited
the prerequisite.

**Bonus finds reach every shipped level.** v1.9.0 introduced
`level.bonusFinds` but only seeded data on the two linux levels.
v1.10.0 rolls out a bonus find on each of the 12 non-linux levels —
each a small orthogonal lesson surfaced from existing in-level
content (Priya's audit-trail asides, welcome.md side notes, EXIF
fields players often skim past, robots.txt billboarding, the Adobe
2013 hint-field intel layer, Strava neighborhood exposure, and more).
Every walkthrough gains a §7.5 "Optional exploration" section that
names each bonus, gives its trigger, and expands the lesson into the
broader real-world pattern.

### Added

- **Lobby tree** — AVAILABLE ENGAGEMENTS renders as a collapsible
  tree (`js/engine/lobby.js#engagementList`). Each track is one
  line by default (entry-point `ssh level0@<host>` + label +
  visited count + level0's difficulty); expanded tracks add the
  track's `description` plus indented per-level rows showing the
  level's `title`, visited mark, and estimated time.
- **`tracks` command** (`js/commands/lobby.js`) — toggles
  per-track expand state. `tracks` (status), `tracks <name>`
  (toggle one), `tracks all` (expand every track), `tracks reset`
  (collapse every track). Expand state persists in
  sessionStorage. Smart default on the first lobby render of a
  session: tracks containing any visited level auto-expand.
- **`progress --detail`** — lists per-level bonus finds by name
  when unlocked (✦ marker) and as "[?] hidden — keep exploring"
  when not yet found. Anti-spoiler: unvisited levels show only
  "(visit the level to discover what's here)" — no per-find
  titles surface until the player has entered the level. The
  default `progress` view now also shows a `[bonuses N/M]`
  counter on every level that declares bonus finds + an aggregate
  "N / M bonus finds discovered" summary line.
- **Cold-start gate hint** (`js/engine/ssh.js#prerequisiteHint`) —
  when a player attempts `level<N>@<host>` without having visited
  `level<N-1>@<host>`, the red "Permission denied" line is now
  followed by a yellow tip pointing at the prerequisite ("Tip:
  this level gates on a credential discovered in level<N-1>@<host>.
  Try \`ssh level<N-1>@<host>\` first."). Pivot hosts and any
  non-`level<N>@host` target are exempted.
- **Future-level "check back later" tip** — `ssh level<N>@<host>`
  where N is well-formed and the host is a known scaffolded track,
  but level<N> itself hasn't shipped yet, now prints the standard
  red "Could not resolve hostname" line AND a yellow follow-up
  tip naming the track's current shipped ceiling ("The linux
  track currently ships level0 through level1. Check back later
  — new levels release as MINOR bumps, one track at a time.").
  Real typos (`leve4@linux`, `lvl4@linux`) stay on the plain DNS
  error since they're typos, not missing levels.
- **Per-level `title` field** — optional schema field surfaced in
  the lobby tree's expanded view next to each level's `ssh`
  invocation. Backfilled on all 14 shipped levels.
- **Per-track `description` field** in `js/engine/tracks.js` —
  one-line blurb shown when the track is expanded. Backfilled on
  all 7 tracks.
- **12 new bonus finds on the non-linux levels** — one per shipped
  level (network/level0+1, crypto/level0+1, web/level0+1,
  forensics/level0+1, osint/level0+1, cloud/level0+1). Each uses
  existing in-level content as the trigger (no new schema, no new
  fs nodes). Examples: Priya's "next sprint" audit-trail note on
  network/level0; `robots.txt` as an attacker's site map on
  web/level0; the EXIF `GPSImgDirection` field beside lat/long on
  forensics/level0; Adobe 2013's cleartext password-hint field on
  osint/level0; the `migration_artifacts.ttl_expires_at` column
  without enforcement on cloud/level1.
- **Walkthrough §7.5 — Optional exploration** sections added to
  all 14 walkthroughs. Each names the bonus(es) in the level,
  gives the trigger, and expands the hint into a real-world
  pattern reference (MITRE ATT&CK techniques, LOLBAS, 2018 Strava
  heatmap incident, the Snowflake UNC5537 long-TTL session
  campaign, Adobe 2013 storage flaws, etc.). Also includes:
  - `walkthroughs/linux/level1.md` §7.5 — "Optional exploration:
    the pivot host" documents the agent-forwarded SSH workflow
    into `dbsvc@halton-bastion`, the backup landing zone shipped
    in v1.9.0. The solve path doesn't require the pivot.
  - `walkthroughs/network/level1.md` §7.5 — "Optional
    verification: walk the perimeter you just enumerated" covers
    `ip addr`, `ip route`, `arp -a`, `nslookup`, `ping`,
    `traceroute` against the demo data shipped in v1.7.0. Useful
    for writing up findings in real engagement language; not part
    of the solve.

### Changed

- **Difficulty becomes a computed tier.** Manual `level.difficulty`
  is gone. Replaced with a 5-tier curve computed from the level
  number in `js/engine/tiers.js`:
  - `Routine` (level 0–5) — standard quarterly audit work
  - `Live` (level 6–10) — active engagement, real contractual
    stakes
  - `Escalated` (level 11–15) — incident response in progress
  - `Critical` (level 16–20) — notification clocks running
  - `Crisis` (level 21+) — public-statement-grade engagement

  The label describes the *operational state* the player is
  inside, not just puzzle complexity. The new `tiers` command
  prints the legend; the lobby footer points at it. The
  connection banner now reads `Tier: Routine · Est. time: ~10
  min` instead of `Difficulty: Easy · Est. time: ~10 min`. The
  expanded lobby tree shows a `[Routine]` tag per level row.
  Pivot hosts (non-numbered) get no tier label since they sit
  off the main curve.
- **`estimatedMinutes:` rolled out cross-track.** This v1.8.0
  schema field existed but was only populated on the linux
  track. Backfilled on all 12 non-linux levels so the lobby
  tree's est-time annotation works everywhere.
- **TERMINAL help section** lists the new `tracks` command,
  `tiers` command, and the `progress --detail` flag.

### Fixed

- (No fixes — v1.10.0 is purely additive.)

## [1.9.0] - 2026-05-26

**Engine realism — the bash UX players carry in from a real shell.**
The last engine-polish release before v2.0 turns to level2 content.
Closes out the realism extensions that didn't make the v1.8.0 cut:
writable env vars (`export` / `unset` / `set` / `FOO=bar` inline
assignment), PS1-driven prompt customization, job control (`&` /
`jobs` / `fg` / `bg` / `kill`), kill-ring yank (`Ctrl-Y`) + Alt-key
word movement + last-arg recall (`Alt-.`), extended `dig` / `curl`
/ `gobuster` flags, a multi-host pivot mechanism via `level.network`,
and optional discoverable bonus-finds via `level.bonusFinds`.

After this release, a player coming from a real bash shell can type
the patterns they have muscle memory for — `export PS1='> '`,
`AWS_PROFILE=prod aws s3 ls`, `sleep 5 & jobs`, `dig +short @8.8.8.8
example.com`, `curl -X POST -H "Content-Type: application/json" -d
'{}' http://api/path`, `Ctrl-Y`, `Alt-.` — and the engine does what
they expect.

### Added

- **Shell environment** — writable env vars layered over the
  built-ins. `export FOO=bar`, bare `FOO=bar` assignment,
  `env FOO=bar cmd args` (assignment only — sandbox can't fork),
  `unset NAME`, `set` (alias for env in listing mode). Per-level
  static env via `level.env_vars`. Built-ins (USER / HOME / PWD /
  HOSTNAME / PATH / SHELL / LANG / PS1 / PS2) computed live, can
  be overridden, and re-appear on `unset`. Every level switch
  resets the writable layer — a fresh shell starts clean.
- **PS1 customization** — `export PS1='\u@\h(\W)\$ '` (or whatever
  format the player likes). Escape codes supported: `\u`, `\h`,
  `\H`, `\w`, `\W`, `\$`, `\\`, `\[`/`\]`, `\n`. Default PS1 still
  reproduces the historical `.at`/`.host`/`.dollar` colored layout.
  The prompt re-renders after every dispatched command + level
  switch (cd / export / unset / PS1 changes all reflect immediately).
- **Job control** — trailing `&` flags a statement as background;
  the dispatcher captures its stdout into a job-table entry and
  prints `[N] PID`. `jobs` / `fg` / `bg` / `kill` / `wait` /
  `disown` operate on the table. Commands run synchronously in
  the sandbox, so backgrounded jobs complete immediately — the
  bash UX matches without true concurrency.
- **Readline shortcuts** — `Ctrl-Y` yank from kill ring (populated
  by `Ctrl-W`/`Ctrl-U`/`Ctrl-K`, capped at 10 entries). `Alt-B` /
  `Alt-F` word-back / word-forward. `Alt-.` (or `Esc-.`) inserts
  the last argument of the previous command. Detected via
  `e.code` so the keys work consistently on macOS where Option
  produces modified characters.
- **Extended `dig` flags** — `dig @8.8.8.8 host`, `dig -t MX host`,
  `dig -x 10.0.0.5` (reverse PTR), `dig host +short` (answer-only),
  `dig host +trace` (simulated root → TLD → authoritative path).
- **Extended `curl` flags** — `-X METHOD`, `-d DATA` / `--data D`,
  `-H "Header: Value"` (repeatable), `-L` (follow Location:
  redirects up to 5 hops), `-o FILE` (warned + printed inline),
  `-k` / `-s` (accepted as no-ops), `-v` (verbose, prints request +
  response headers). Method-aware response lookup via
  `level.webRequests[`METHOD URL`]` with backward-compat fallback
  to `level.web[URL]`.
- **Extended `gobuster` syntax** — real-bash `gobuster dir -u URL
  -w wordlist -x exts -t threads` accepted; the cosmetic flags
  surface in the banner. Legacy `gobuster <url>` still works.
- **Multi-host pivot** — `level.network: { "user@host": { ... }}`
  declares pivot hosts the player can ssh into from inside a
  level. The pivot pushes the current shell onto a stack; `exit`
  pops back. Useful for modeling lateral-movement scenarios
  ("you found these creds, now ssh to the bastion they unlock")
  without leaving the level boundary.
- **Bonus finds** — `level.bonusFinds: [{ id, name, hint, trigger
  }]` declares discoverable nuggets the player MAY uncover. The
  trigger fires when a command + its args + its output match
  optional regex/substring patterns. Doesn't gate the credential
  chain; surfaces a discovery banner + a per-level count in
  `progress`. sessionStorage-backed so the count survives reloads.
- **Manpages + glossary entries** — `man export` / `man env` /
  `man unset` / `man set` / `man jobs` / `man fg` / `man bg` /
  `man kill` / `man wait` / `man disown`. Glossary entries for
  "ENV VAR", "PS1", "KILL RING", "JOB CONTROL", "PIVOT".
- **Help reference** — new SHELL ENVIRONMENT and JOB CONTROL
  sections; readline shortcuts in LINUX BASICS extended with
  `Ctrl-Y` / `Alt-B` / `Alt-F` / `Alt-.`.
- **Schema documentation** — `levels/linux.js` header documents
  the new `env_vars` / `network` / `bonusFinds` fields with
  examples. Seed demo data lives on `level1@linux`: two env_vars
  (EDITOR + AWS_PROFILE), and two bonus-finds (one cat-triggered,
  one journalctl-triggered).

### Changed

- **Handler signature** — extended from `(level, arg, stdin?)` to
  `(level, arg, stdin?, argv?)`. The new `argv?` parameter is the
  post-expansion token array, useful when a command needs to
  distinguish flags from values without re-tokenizing the joined
  `arg` string. Existing handlers ignore `argv?` and work
  unchanged; new flag-rich commands (`dig`, `curl`, `gobuster`,
  `export`, `env`, `unset`, `set`, `jobs`, `fg`, `bg`, `kill`,
  `disown`) use it.
- **Prompt rendering** — the static `prompt-user`/`prompt-host`
  spans in `index.html` were replaced by a single dynamic
  `#prompt-label` rendered by `js/terminal/prompt.js#renderPrompt`.
  Default PS1 (`\u@\h:\w\$ `) reproduces the prior colored
  layout; custom PS1 renders as plain text.

### Fixed

- **Command-line echo** — the transcript line printed before
  each command now derives `user@host:path$` live from the env
  (including any custom `\w` path), rather than reading from the
  static prompt spans that no longer exist.

## [1.8.1] - 2026-05-26

**Cache-control patch for JS modules.** Post-deploy, returning
visitors were seeing up-to-4-hour-stale JS because Azure SWA's
default `Cache-Control` for static assets is `public,
max-age=14400, must-revalidate`. The `?v=<version>` cache-bust
on the stylesheet `<link>` tag immunized CSS, but the engine's
ES-module `<script type="module" src="js/main.js">` (plus the
dozens of dynamic `await import()` calls inside) had no
equivalent mechanism. The result: ship a new release, browser
keeps running the old engine for hours.

### Fixed

- **`staticwebapp.config.json`** — added explicit
  `Cache-Control: no-cache, must-revalidate` routes for `/js/*`,
  `/levels/*`, and `/walkthroughs/walkthrough.js`. All engine /
  level / subsite JS now revalidates on every page load (matching
  the HTML behavior). Vendored libraries (`/walkthroughs/vendor/*`)
  and the favicon / OG image stay cached at the SWA default —
  they're stable across releases.

The CSS cache-bust convention is unchanged — `?v=<version>` on
the stylesheet links continues to be the right mechanism for
the few releases that change `style.css` or
`walkthrough.css`. JS no longer needs a version-string
mechanism since it now revalidates on every request.

## [1.8.0] - 2026-05-26

**Author polish + realism.** The largest single engine release since
the Foundation milestone. Shell composition (`&&` / `||` / `;`), real
quoting + `$(...)` command substitution + `$?` exit code, brace
expansion, schema validator, level metadata fields, replay mode,
and ~25 new commands across git / jq / gpg / openssl extensions /
small bash standards / read-only-fs stubs / structural helpers.

After this release, every command a defender would reach for at a
real Linux shell — filesystem, text processing, shell features,
introspection at every layer, learning aids, and the major
out-of-the-box tools (git / jq / gpg / openssl / awk / sed) — is
present in the engine. Level authoring before v1.8.0 was already
viable; after v1.8.0 it's pleasant.

### Added — Shell composition (engine)

- **Real parser** (`js/engine/parse.js`) — quote-aware tokenizer +
  statement chain splitter. Replaces the v1.3.0 ad-hoc whitespace
  split that didn't preserve quoted args.
- **`cmd1 && cmd2` / `cmd1 || cmd2` / `cmd1 ; cmd2`** — chain
  operators. `&&` runs the right side only if the left side
  succeeded (exit 0), `||` only if it failed.
- **`$(cmd)` command substitution** — runs the inner command and
  substitutes its captured stdout. Works inside double quotes
  and unquoted (skipped inside single quotes).
- **`$?` exit code** — last command's exit code. 0 on success,
  1 on error, 127 on command-not-found.
- **Brace expansion** — `cat {a,b,c}.txt` expands to `cat a.txt
  b.txt c.txt`. Quote-aware (braces inside `'...'` or `"..."`
  are literal — bash behavior).
- **Quote-aware tokenization** — `cut -d ' '`, `awk '{print $1}'`,
  `grep "needle in haystack"` all preserve quoted args with
  spaces. Quote markers stripped before reaching command handlers.

### Added — Author quality

- **Schema validator** (`js/engine/validate.js`) — runs at module
  init. Surfaces missing required fields, unknown track values,
  orphaned `permissions` / `certs` / `tarArchives` / `gzipArchives`
  entries that don't reference real files, malformed hints arrays,
  bad `difficulty` enum values, non-positive `estimatedMinutes`,
  invalid usernames in `playerUser`, broken credential-chain
  breadcrumbs (`level<N>.password` not appearing in `level<N-1>`'s
  content). Warnings emit to `console.warn` — site keeps booting
  even on authoring bugs.
- **`level.difficulty`** + **`level.estimatedMinutes`** schema
  fields — surface in the connection banner so players can pick
  where to spend a session. Both optional.
- **`level.gitRepos`**, **`level.gpg`**, **`level.opensslEnc`**,
  **`level.opensslSClient`**, **`level.opensslHash`**,
  **`level.ncResults`**, **`level.df` / `level.du` / `level.free`**
  schema fields — drive the new commands.

### Added — Commands (~25 new)

- **`git`** (`js/commands/git.js`) — log / show / diff / status /
  blame / config / remote / branch. Reads `level.gitRepos`.
  Unlocks the "credential committed to git history" puzzle pattern
  that future levels can use. Repo lookup is cwd-aware (longest-
  prefix match against gitRepos keys).
- **`jq`** (`js/commands/structured.js`) — JSON path queries. Supports
  `.`, `.key`, `.key.nested`, `.arr[N]`, `.arr[]`, filter pipes
  (`. | .foo`), `-r` raw output, `-c` compact output. Stdin or
  file. Should have been in v1.6 — cloud / API / log puzzles
  produce JSON.
- **`gpg`** (`js/commands/structured.js`) — `--list-keys` /
  `--list-secret-keys` / `--verify` / `--decrypt` / `--fingerprint`
  / `--import`. Reads `level.gpg`. Unlocks asymmetric-crypto puzzle
  shapes the crypto track never had.
- **`openssl` extensions** — `rand -hex N`, `dgst -sha256 <file>`,
  `enc -d -<cipher> -in <file>`, `s_client -connect <host:port>`.
  Joins the v1.7.0 `x509` subcommand. All in `js/commands/structured.js`
  (overriding the format.js openssl since v1.8.0).
- **`printf`** (`js/commands/text.js`) — `%s`/`%d`/`%x`/`%%` format
  specifiers, `\n`/`\t` escapes.
- **`sed`** (`js/commands/text.js`) — `s/pat/repl/[g]` substitution
  + `-n 'Np'` / `-n 'M,Np'` print-by-line-number.
- **`history`** (`js/commands/shell.js`) — print the level's
  `.bash_history` file in `history`-shape numbered format.
- **`nc -zv HOST PORT`** (`js/commands/netinspect.js`) — TCP
  port-reachability check. Reads `level.ncResults`.
- **`host`** (`js/commands/netinspect.js`) — friendlier DNS lookup
  (companion to nslookup, shares `level.nslookupResults` schema).
- **`df`** / **`du`** / **`free`** (`js/commands/sysinspect.js`) —
  disk + memory introspection.
- **Read-only-fs stubs** (`js/commands/readonly-stubs.js`) — `chmod`,
  `chown`, `mv`, `cp`, `rm`, `mkdir`, `rmdir`, `touch`, `ln`,
  `sudo`, `su`, `useradd`, `passwd`. All return the canonical
  bash error for "Read-only file system" / "incorrect password
  attempt". Players type these from muscle memory; better to error
  cleanly than 404.
- **`walkthrough`** (`js/commands/learning.js`) — open the matching
  walkthrough URL in a new tab. Quick path from in-game to the
  long-form solve guide.
- **`progress`** (`js/commands/learning.js`) — list every visited
  level this session (per-track checklist) + overall solve count.
- **`search <term>`** (`js/commands/learning.js`) — cross-level
  content search across visited levels' lessons-learned + welcome
  + handoff files. Case-insensitive. Spoiler-safe (only searches
  levels the player has entered).

### Added — UX

- **Persistent command history** (localStorage). Survives tab close.
  Capped at 200 entries.
- **Bash readline shortcuts** (`js/terminal/input.js`):
  - **Ctrl-A** — jump to start of line
  - **Ctrl-E** — jump to end of line
  - **Ctrl-W** — delete word back (whitespace-aware)
  - **Ctrl-U** — clear from cursor to start
  - **Ctrl-K** — kill from cursor to end
- **Replay mode** (`js/engine/ssh.js`) — re-entering a level you've
  already visited this session skips the password gate. The
  credential discovery is the puzzle; making players re-do it on
  every revisit punishes exploration. Tab close resets.

### Added — Docs

- **Manpages** for all 25+ new commands (`js/commands/man-pages.js`).
- **Glossary entries** for `jq`, `gpg`, `sed`, `bash`, `ANSI`
  (`js/commands/glossary.js`).
- **`help` reference** reorganized: new VERSION CONTROL section,
  expanded TEXT PROCESSING / SYSTEM INSPECTION / FORMAT INSPECTION /
  NETWORK RECON / LEARNING AIDS with the new commands, and a
  "Shell features (v1.8.0)" block under LINUX BASICS covering
  pipes / chaining / wildcards / brace / vars / substitution /
  exit code / quoting / readline shortcuts.

### Changed

- **Command handler signature** extends to `(level, arg, stdin, argv)`
  — fourth param is the expanded, quote-stripped token array.
  Handlers that need quote-aware parsing (like `awk`) now use
  `argv`. Existing handlers using `arg` keep working.
- **Parser refactor** consumed `js/engine/expand.js` — the previous
  whole-line `expandVars` is gone, replaced by per-token quote-aware
  `expandTokenVars`. Single-quoted regions are literal; double-quoted
  and unquoted regions expand `$VAR` / `${VAR}` / `$?` / `$(...)`.
- **Brace expansion** runs BEFORE variable expansion, only on tokens
  without any quote marks (so `cat 'file{a,b}'` is literal but
  `cat file{a,b}` expands).
- **Engine state**: `lastExitCode` added (with setter), tracking
  `$?` across the statement chain.

### Playtest

542 → 563 checks (+21 new). Shell composition + quoting + `$(...)` +
brace + read-only stubs + git/jq/gpg/openssl-rand/printf/sed/nc/host/df/free
empty-state + walkthrough/search at lobby.

### Deferred to v1.9.0 (still pre-level2)

- `ls --color` / `grep --color` — needs ANSI escape interpretation
  in output.js. Bigger output-renderer refactor.
- Ctrl-R reverse-i-search — input-mode toggle. Medium effort.
- Extended `dig +short/+trace`, `curl -X POST/-d/-H`, `gobuster dns/vhost`.
- Multi-host pivoting (ssh-from-shell within a track).
- Bonus-finds / side quests per level.

## [1.7.0] - 2026-05-26

**Network + Format tools + cross-doc audit.** Eleven new commands
across three categories (network inspection, format inspection, path
utilities) and a cross-doc audit pass over `README.md`, `CONTRIBUTING.md`,
and `CLAUDE.md` to catch staleness from the v1.3-v1.6 engine
expansion era.

### Added — Network inspection (`js/commands/netinspect.js`)

- **`ip addr` / `ip a`** — list local interfaces + IPv4 addresses,
  MTU, state, link-layer info. Loopback is auto-injected if the
  level doesn't define one. Reads `level.netInterfaces`.
- **`ip route` / `ip r`** — kernel routing table. Reads `level.routes`.
- **`arp -a`** — print the ARP cache (hostname / IP / MAC / dev).
  Reads `level.arpCache`.
- **`ping HOST`** — simulated ICMP echo (4 packets + min/avg/max/mdev
  stats summary). Reads `level.pingResults`. Unresolvable hosts
  return the standard name-resolution error.
- **`traceroute HOST`** — IP hop sequence with three RTT samples per
  hop. Silent hops render as `* * *`. Reads `level.tracerouteResults`.
- **`nslookup HOST`** — friendlier DNS lookup (companion to the
  network-track `dig` command). Reads `level.nslookupResults`.

### Added — Format inspection (`js/commands/format.js`)

- **`openssl x509 -text -noout -in <file>`** — parse and dump
  X.509 certificate fields: Version, Serial, Signature Algorithm,
  Issuer, Subject, validity dates, X.509v3 extensions including
  SAN / Key Usage / Extended Key Usage / CRL Distribution Points /
  Authority Information Access / SCT list. Reads `level.certs`.
- **`tar tvf FILE`** / **`tar xvf FILE`** — list contents of a tar
  archive in real-tar verbose format. Reads `level.tarArchives`.
  Note: the sandbox is read-only, so `xvf` lists with an `x ` prefix
  but doesn't actually write the extracted files.
- **`gunzip FILE`** / **`zcat FILE`** — decompress a `.gz` file to
  stdout. Both aliases behave identically in the sandbox (the
  sandbox is read-only, so we can't write the decompressed file
  alongside the original). Reads `level.gzipArchives`.

### Added — Path utilities (`js/commands/linux.js`)

- **`basename PATH [SUFFIX]`** — strip the directory portion of a
  path. Optional suffix trims a trailing extension.
- **`dirname PATH`** — strip the final path segment.

### Added — Schema + content

- **Six new schema fields** documented at the top of `levels/linux.js`:
  `netInterfaces`, `routes`, `arpCache`, `pingResults`,
  `tracerouteResults`, `nslookupResults`. Plus three format-related
  fields: `certs`, `tarArchives`, `gzipArchives`.
- **Demo data on level1@network** — staging-db's eth0 interface,
  default-gateway route, ARP cache including the gateway and two
  internal hosts, pingable / traceroute-able reachability to the
  same internal-zone targets the AXFR puzzle surfaced.
- **Manpages** for all 11 new commands.
- **Glossary entries** for `ARP`, `ICMP`, `X.509`, `TLS`, `gzip`,
  `CIDR`. Available via `what-is <term>`.
- **Help reference** gains a new FORMAT INSPECTION section and
  extends NETWORK RECON with the inspection commands; LINUX BASICS
  gains `basename` and `dirname`.

### Changed — Cross-doc audit

- **`CLAUDE.md`** — handler signature corrected to
  `(level, arg, stdin?)` (was `(level, arg)`); filesystem
  representation updated from dual to tri (adds symlinks); track
  registry location corrected from `js/engine/lobby.js` to
  `js/engine/tracks.js`; dispatch order updated to mention
  shell-var expansion + pipe-splitting; infrastructure command
  modules (`text.js`, `system.js`, `sysinspect.js`, `netinspect.js`,
  `format.js`, `learning.js`) explicitly enumerated so the
  "all commands live in per-track files" implication doesn't
  mislead. Removed dead references to two local-only files
  (`feedback-level-credential-chain.md`, `PASSWORDS.md`) that
  the v1.0.0 cleanup missed.
- **`CONTRIBUTING.md`** — same handler-signature + filesystem-tri
  updates as CLAUDE.md. The "How to add a new command" section
  rewritten to cover both track-specific files and the
  infrastructure modules, plus the new manpage-and-playtest steps.
  Dispatch order updated to mention shell vars + pipes.
- **`README.md`** — file tree and Commands Implemented section
  updated with `netinspect.js`, `format.js`, and the 11 new
  commands.

### Playtest

- 511 → 542 checks (+31 new). Lobby smoke (graceful empty-state)
  for the format / network commands; level1@network real-data
  assertions for `ip addr` / `ip route` / `arp -a` / `ping` /
  `traceroute` / `nslookup`; pure-string verification of
  `basename` and `dirname` from the lobby.

## [1.6.0] - 2026-05-26

**Forensics expansion.** Nine new system-inspection commands —
`crontab -l`, `last`, `who`, `w`, `lsof`, `ss`, `journalctl`,
`systemctl status`, `dmesg` — that unlock Linux-host compromise
investigation and persistence-detection puzzles. Each is a pure
reflector over a level-defined schema field; the handlers render
real-bash output format so the muscle memory transfers.

The new commands open up scenarios v1.0 couldn't tell: finding
the cron line a former employee installed, tracing a session in
the wtmp history, matching a network socket to a backdoor
process, reading the systemd unit logs that corroborate a
filesystem finding. Level1@linux is seeded with a small but
realistic system-state snapshot so the commands have something
to chew on; the journal entries corroborate the file-permission
bug the level is teaching.

### Added

- **`js/commands/sysinspect.js`** — new command module bundling
  the nine inspection commands. Each is a pure reflector with no
  shared state.
- **`crontab -l [-u USER]`** — print a user's crontab. Reads
  `level.crontab[username]`. Empty → `no crontab for <user>`.
- **`last`** — login history in reverse-chronological order.
  Reads `level.lastLogins`. Handles "still logged in" sessions and
  reboot pseudo-events.
- **`who`** — basic listing of currently-active sessions (user /
  TTY / login / source IP). Reads `level.activeSessions`.
- **`w`** — extended session listing with uptime header + idle /
  JCPU / PCPU / WHAT columns. Reads the same `level.activeSessions`
  array as `who`, plus the optional extended fields.
- **`lsof [-i] [-p PID]`** — open files table. `-i` filters to
  network sockets (IPv4 / IPv6); `-p` filters to one process.
  Reads `level.openFiles`.
- **`ss [-l] [-t] [-u] [-n] [-a]`** — socket statistics
  (netstat replacement). Flags compose. Reads `level.sockets`.
- **`journalctl [-u UNIT] [-n N] [-r]`** — systemd journal
  query. Filters by unit (sshd OR sshd.service both work), keeps
  only the most recent N entries, reverses chronological order.
  Reads `level.journal`.
- **`systemctl status UNIT`** — service unit status block:
  load / active / sub states, since-timestamp, main PID, command,
  task / memory / CPU / cgroup, and the recent journal lines for
  the unit. Both `sshd` and `sshd.service` resolve to the same
  unit. Reads `level.systemdUnits[unit]`. Only the `status`
  subcommand is implemented — start / stop / enable / restart
  are real OS actions the sandbox can't honor.
- **`dmesg`** — kernel ring buffer. Reads `level.dmesg` (array of
  `{ timestamp, message }` entries or plain strings).
- **Eight schema fields** documented at the top of `levels/linux.js`:
  `crontab`, `lastLogins`, `activeSessions`, `openFiles`, `sockets`,
  `journal`, `systemdUnits`, `dmesg`. Per-field shape docs at the
  top of `js/commands/sysinspect.js`.
- **Demo data on level1@linux** for every new command. The journal
  entries are story-aware: they show the staging-worker service
  hitting permission-denied on the mode-600 file and falling back
  to the mode-644 backup — the same bug the player resolves via
  `cat staging-worker.env.bak`. A player who runs `journalctl -u
  staging-worker` corroborates the finding from the service's
  perspective.
- **Manpages** for all 9 new commands. `man crontab` / `man last`
  / `man who` / `man w` / `man lsof` / `man ss` / `man journalctl`
  / `man systemctl` / `man dmesg`.
- **Glossary entries** for `cron`, `systemd`, `journal`, `dmesg`,
  `lsof`, `ss`. Available via `what-is <term>`.
- **`help` reference** gains a new SYSTEM INSPECTION section
  between SYSTEM INFO and LEARNING AIDS.
- **Playtest coverage**: 480 → 511 checks (+31 new). Lobby
  smoke tests for graceful empty-state on every new command;
  level1@linux tests for real-data rendering (crontab reveals the
  staging-worker healthcheck job; last shows the reboot
  pseudo-event with kernel version; who/w show the active session;
  lsof -i shows sshd LISTEN on :22 and postgres on :5432; ss -lt
  shows LISTEN-state TCP sockets; journalctl -u staging-worker
  shows the permission-denied fallback; systemctl status renders
  the active glyph + log block; dmesg shows kernel boot lines).

## [1.5.0] - 2026-05-26

**Symlinks.** The level filesystem now supports a third node type
alongside dirs and files: `{ type: "symlink", target: "..." }`. The
path resolver follows symlinks transparently (with cycle detection),
`ls -l` renders them with the canonical `lrwxrwxrwx ... name ->
target` format, and two new commands — `readlink` and `realpath` —
let players inspect symlink chains.

Adding symlinks to the engine unlocks the lookup-misdirection puzzle
shapes future levels will lean on (a dangling pointer that hints at
a deleted file, a chain of redirections that misleads the player,
a hidden shortcut to a file behind tighter permissions). v1.5.0 ships
the engine surface and one demo symlink on level0@linux as a
reference; future levels can use the schema however the scenario
calls for.

### Added

- **`level.fs` symlink entries**: `{ type: "symlink", target: "..." }`
  alongside the existing `{ type: "dir", children }` and `{ type:
  "file", content }` shapes. Schema documented at the top of
  `levels/linux.js`.
- **Symlink-aware path resolver** (`js/fs/resolve.js`):
  - `getFSNode()` follows symlinks transparently during the walk.
    When the walk hits a symlink node, its `target` is resolved
    against the symlink's parent directory (so relative targets
    like `../bin` work) and the walk restarts. Hop count is capped
    at MAX_SYMLINK_HOPS = 16 to detect cycles — chains exceeding
    the cap return null (the resolver's equivalent of ELOOP).
  - `getFSNode(level, parts, { noFollow: true })` opts out of
    following the FINAL segment, used by `readlink` and `ls -l`
    to inspect the symlink itself.
  - **`resolveFullPath()`** — new helper that returns the
    canonicalized parts array (every symlink resolved). Used by
    `realpath` to produce the absolute-path output.
- **`readlink <path>`** command — prints the literal `target`
  string stored in a symlink, with no resolution. Errors on
  non-symlink and missing-path arguments with the canonical
  bash error strings.
- **`realpath <path>`** command — prints the fully-resolved
  canonical absolute path (`/home/<user>/...`) after following
  every symlink in the chain. Errors on broken targets / cycles.
- **`ls -l` symlink rendering** — entries whose type is `symlink`
  show with mode prefix `l` (`lrwxrwxrwx`) and the canonical
  arrow notation (`name -> target`) appended to the display name.
  Short-format `ls` continues to list symlinks by name only (no
  trailing marker — we don't implement the `-F` flag).
- **Demo symlink on level0@linux** — hidden `.notes -> notes.txt`,
  visible in `ls -la`. Doesn't change the level's puzzle (the
  credential is still in creds.txt), but gives players + the
  playtest a real symlink to interact with.
- **Manpages** for `readlink` and `realpath`.
- **Glossary entry**: `what-is symlink`.
- **Playtest coverage**: 472 → 480 (+8 new). Verifies `ls -la`
  shows the symlink with `lrwxrwxrwx` prefix and arrow notation,
  `readlink` on a symlink prints the literal target, `readlink`
  on non-symlinks errors cleanly, `readlink` on missing files
  errors cleanly, `realpath` resolves through the symlink, `cat`
  through the symlink reads the target's content.

### Changed

- `js/commands/linux.js` — `ls -l` renders symlinks differently
  (see above). `cd`, `cat`, `grep`, `head`, `tail` continue to
  use `getFSNode` and pick up symlink-following transparently
  through the resolver — no handler changes needed.
- LINUX BASICS help reference gains `readlink` and `realpath`.

## [1.4.0] - 2026-05-26

**Learning aids + awk.** Three player-facing self-help commands
(`hint`, `man`, `what-is`) and one new pipe-friendly text utility
(`awk`). A stuck player can now get a progressive nudge without
opening the walkthrough, look up any command's syntax in the
terminal, and search a built-in glossary of the frameworks /
regulations / CWE IDs / MITRE techniques the lessons-learned
post-mortems cite.

The new commands ship as engine surface; per-level hint content is
authored alongside (`level.hints` schema field). v1.4.0 seeds
hints on the two linux levels as a reference pattern; the other 12
shipped levels can get hints in a follow-up content PR — empty
levels print a polite "no hints — see walkthrough" message.

### Added

- **`hint` command** (`js/commands/learning.js`) — surface the next
  hint for the current level. Hints are arranged most-subtle to
  most-direct; each call advances the position. `hint reset`
  rewinds to the first hint; `hint list` reports progress without
  spoiling unseen hints. Per-level position is tracked in
  sessionStorage so it survives reloads within the same tab session.
- **`level.hints` schema field** — ordered array of string nudges
  per level. Documented at the top of `levels/linux.js`. Levels
  without `hints` print a graceful "no hints" message with a
  pointer to the walkthrough.
- **`man <cmd>` command** — manual pages for every shipped command
  (~65 entries in `js/commands/man-pages.js`) following the standard
  NAME / SYNOPSIS / DESCRIPTION / EXAMPLES format. Unknown command
  → `No manual entry for <cmd>`.
- **`what-is <term>` command** — concept glossary
  (`js/commands/glossary.js`) covering frameworks (NIST 800-53,
  800-171, 800-63, 800-218, CSF, OWASP Top 10, ASVS, WSTG, MITRE
  ATT&CK, CIS Controls), regulations (PCI-DSS, HIPAA, FERPA, GLBA,
  CMMC, SOC 2, NAIC, NYDFS, DFARS), certifications (Security+,
  CySA+, CISSP, OSCP, SCS-C03), CWE entries cited in lessons-
  learned (CWE-200 / 798 / 639 / 862 / 285 / 347 / 532 / 306 /
  548), MITRE technique IDs cited in lessons-learned (T1078 /
  T1110.004 / T1190 / T1213 / T1552.001 / T1567.002 / T1593.003),
  and core technical concepts (JWT, IDOR, BOLA, AXFR, MFA, IAM,
  RBAC, ABAC, ReBAC, RLS, KMS, evtx, SIEM, IoC). ~50 entries to
  start; lookups are case-insensitive.
- **`awk` command** in `js/commands/text.js` — simplified column-
  extracting text processor. Supports `{print $N}`,
  `{print $N, $M}`, optional `/pattern/` or `!/pattern/` filter
  before the action block, and `-F SEP` for custom field
  separator. Stdin-aware like the rest of the pipe-friendly text
  commands. Only `print` actions; variable assignments and
  BEGIN/END blocks are out of scope (level content doesn't need
  them, and the parser has a clean extension point if a future
  level does).
- **Seeded hints on level0@linux + level1@linux** as a reference
  pattern for level authors. Three hints each, most-subtle to
  most-direct, ending at the specific file / command that
  resolves the puzzle.
- **`help` reference** gains a new LEARNING AIDS section
  (hint / man / what-is) between the per-track sections and the
  TERMINAL block. `awk` is added to TEXT PROCESSING.
- **Playtest coverage**: 448 → 472 checks (+24 new). Verifies
  hint progression on level0@linux (3 hints + exhaustion +
  walkthrough fallback + reset behavior), man on known + unknown
  commands, what-is on known + unknown terms + case-insensitivity,
  and awk in stdin / file / pattern-filter / -F-separator modes.

### Changed

- Help reference reorganized so LEARNING AIDS lives between the
  track sections and TERMINAL — players who type `help` discover
  the self-help layer in the natural position.

## [1.3.0] - 2026-05-26

**Shell realism.** Twelve engine-surface additions that make the
terminal behave a lot more like an actual bash session — paths,
wildcards, pipes, shell variables, twelve new commands, and richer
tab-completion. No new levels in this release; the existing shipped
content is unchanged but plays differently now that pipelines and
absolute paths work.

The shell features compose: `cat $HOME/*.md | grep TODO | wc -l`
is a single command line that exercises variable expansion, glob
expansion, two pipe stages, stdin-aware grep, and stdin-aware wc.
Each subsystem was added with a dedicated module so future engine
work (sed, awk, multi-line pipes) has a clean place to extend.

### Added

- **Path resolution** (`js/fs/resolve.js`) — `resolvePath()` turns
  any path string into an absolute parts array. Handles absolute
  paths (`/home/<user>/foo`), home expansion (`~`, `~/foo`),
  chained parent refs (`../../bin`), no-op `.` segments, double
  slashes, and trailing slashes. `cd`, `ls`, `cat`, `grep`,
  `head`, `tail`, and tab-completion all route through the new
  resolver, so absolute-path navigation works everywhere.
- **Wildcards** (`js/fs/glob.js`) — `expandGlob()` and
  `expandGlobs()` translate `*` (any chars except `/`) and `?`
  (single char) into matching paths. Patterns can target a sub-
  directory (`src/*.txt`). Hidden files are skipped unless the
  pattern starts with a literal `.`. Used by `ls`, `cat`, `grep`.
  No-match returns the literal pattern, matching bash default.
- **Pipes** (`js/engine/execute.js`) — `cmd1 | cmd2 | cmd3` runs
  segments left-to-right, threading each stage's stdout into the
  next stage's stdin. Pipe-friendly commands consume stdin when
  no file arg is given; non-pipe-friendly commands ignore stdin
  cleanly. Handler contract extends from `(level, arg)` to
  `(level, arg, stdin?)`.
- **Shell variables** (`js/engine/expand.js`) — `$USER`, `$HOME`,
  `$HOSTNAME`, `$PWD`, `$PATH`, `$SHELL`, `$LANG`, `$LOGNAME`,
  plus any custom `level.env_vars` entries. `${VAR}` bracketed
  form. `$$` escapes to a literal `$`. Expansion runs before
  tokenization so vars work in any position (`cat $HOME/*.md`).
- **Tab autocomplete for paths** (`js/terminal/input.js`) —
  pressing Tab after a space now completes filesystem paths
  against the level's fs tree + cwd. Single match fills the
  basename (with trailing `/` for directories); multiple matches
  fill the longest common prefix so progressive Tab still makes
  progress. Command-name completion (first word) unchanged.
- **Five new pipe-friendly text commands** (`js/commands/text.js`):
  - `wc [-l] [-w] [-c] [file]` — line / word / char counts
  - `sort [-n] [-r] [-u] [file]` — sort lines, optionally numeric /
    reverse / unique (stable sort)
  - `uniq [-c] [-d] [-u] [file]` — collapse adjacent duplicates,
    optionally with counts or duplicate-only / unique-only filtering
  - `cut -d <delim> -f <fields> [file]` — extract delimited columns,
    range syntax supported (`-f 1,3-5`)
  - `tr <set1> <set2>` / `tr -d <set>` / `tr -s <set>` —
    character-class translate / delete / squeeze, with range
    expansion (`a-z`)
- **Seven new system-introspection commands**
  (`js/commands/system.js`):
  - `which <cmd>` — locate a command in the shell command table
  - `type <cmd>` — classify a command (builtin / not found)
  - `id` — print uid / gid / supplementary groups
  - `uname [-a/-s/-n/-r/-v/-m]` — kernel / machine info
  - `date` — current date and time in standard format
  - `uptime` — system uptime + load average
  - `hostname` — print the current host
- **`level.system` schema field** for per-level overrides of `uname`,
  `id`, and `uptime` outputs (all optional — every command works
  fine without any level data).
- **`grep`, `head`, `tail` are now stdin-aware** — feed them piped
  input and they read from stdin when no file arg is given. `grep`
  also gained multi-file + glob support (`grep word *.log` works).
- **`ls` accepts a path arg** (`ls src`, `ls /home/<user>/notes`)
  and supports glob expansion (`ls *.md`). Multiple positional
  args are listed in a single flat block (bash behavior for
  explicit-file lists; no "total" header line).
- **`cat` accepts multiple files and globs** (`cat *.md`, `cat a b
  c`). Per-file errors are interpolated into the output rather
  than aborting the whole call, matching bash's "keep going"
  behavior on multi-file inputs.
- **`help` reference** gained two new groups — "TEXT PROCESSING
  (pipe-friendly)" and "SYSTEM INFO" — plus a "Shell features"
  sub-block under LINUX BASICS documenting pipes, wildcards, and
  variable expansion.
- **Playtest coverage** for every new feature — absolute / home /
  parent-ref path navigation, wildcard expansion, shell-var
  expansion (bare, bracketed, `$$` escape), single- and multi-
  stage pipes, path autocomplete, and smoke tests for every new
  text and system command. Total checks: 412 → 448.

### Changed

- **Handler signature** for all commands extends from
  `(level, arg)` to `(level, arg, stdin?)`. The third arg is
  `undefined` for standalone invocations and a string when the
  command sits downstream of a pipe stage. Existing commands that
  ignore stdin pass through unchanged.
- **`cd ..` and `cd ../..` (any all-parent-refs path) from home**
  now print the same "already at home directory" hint — the prior
  code only caught the bare `cd ..` case, letting the resolver
  silently clamp longer up-chains to a no-op.
- **`js/commands/index.js`** gains `text.js` and `system.js`
  imports / spreads. Forkers adding new infrastructure-style
  command modules should follow the same pattern (per-track
  modules continue to ship under their track key).

## [1.2.0] - 2026-05-24

**Brand refresh.** The wordmark is now a unified `[ D3CYPH3R ]`
cascade across every surface of the product — uniform VT323 terminal
font with a three-level brightness cascade across the eight
characters (D bright · 3 mid · C mid · Y bright · P dim · H mid · 3
dim · R bright), framed by dim JetBrains Mono brackets. Replaces the
prior mixed-font "partially decrypted fragment" wordmark that used
five different fonts and five different brand colors per glyph. The
cascade is theme-aware — brightness palette flips automatically
between dark and light mode via CSS variables, with the bracket
sitting between the dim and mid range as a frame rather than a
wordmark character.

The unified treatment fixes a long-standing visual inconsistency:
the prior wordmark only appeared in the lobby; the walkthroughs
subsite header used a plain bold "D3CYPH3R", the 404 page had no
wordmark at all, the mobile-gate boot screen used a different
Share Tech Mono treatment, and the social-share OG image used the
old mixed-font style. v1.2.0 puts the same cascade on all five.

### Changed

- **Lobby wordmark** (`js/engine/lobby.js`) — `LOGO_GLYPHS` array
  rewritten to use the brightness cascade instead of the mixed
  font/color pattern. `renderLogo()` now wraps the wordmark in
  `[ ]` brackets.
- **Walkthroughs subsite header brand** (`walkthroughs/index.html`,
  `walkthroughs/walkthrough.css`) — `.brand-mark` updated from
  plain bold text to the cascade pattern. `walkthrough.css` gains
  `VT323` to its Google Fonts import and the same theme-flippable
  cascade CSS variables as the main app.
- **Walkthroughs index hero title**
  (`walkthroughs/walkthrough.js`) — `renderIndex()` now emits the
  cascade brand as the h1 instead of plain "D3CYPH3R Walkthroughs"
  text, with a "walkthroughs" sub-label in dim monospace.
- **404 page** (`404.html`) — adds the cascade brand above the giant
  404 number; gains an inline theme-init script so the page
  respects the visitor's saved dark/light preference.
- **Mobile-gate boot screen** (`js/mobile-gate.js`) — the
  `.mobile-gate-brand` h1 now contains the cascade glyphs instead
  of a plain "D3CYPH3R" string; size + letter-spacing tuned for
  the mobile viewport.
- **Open Graph image** (`assets/og-template.html` + `og-image.png`)
  — wordmark updated to the cascade; PNG regenerated. Social-share
  link previews on Twitter / LinkedIn / Slack / Discord / etc.
  now show the new brand.
- **`og:image:alt` text** (`index.html`) — rewritten to describe
  the cascade wordmark for accessibility / screen readers /
  spiders that read alt text.
- **Stylesheet cache-bust** bumped to `?v=1.2.0` on both `index
  .html` and `walkthroughs/index.html` since the cascade adds new
  CSS that returning visitors need to fetch immediately.

### Added

- **CSS-variable cascade palette** in both `style.css` and
  `walkthroughs/walkthrough.css`: `--glyph-bright`, `--glyph-mid`,
  `--glyph-dim`, `--glyph-bracket`. Set in `:root` for the dark
  palette and overridden in `body.light` for the light palette.
  Letting the brightness levels flip via CSS variables (rather
  than hardcoded per-class colors) is what makes the cascade
  theme-aware in one declaration.
- **`.glyph-bright` / `.glyph-mid` / `.glyph-dim` / `.glyph-bracket`
  classes** in both stylesheets — the new brand primitives.
  Legacy `.glyph-white` / `.glyph-green` / `.glyph-cyan` / `.glyph-
  accent` / `.glyph-red` classes are kept in `style.css` for
  future logo experiments but are no longer referenced by shipping
  code.

### Fixed

- Walkthroughs subsite header brand was a plain bold "D3CYPH3R"
  string — visually inconsistent with the main app's wordmark.
- 404 page had no brand mark at all — a brand-less dead-end.
- Mobile-gate boot screen used Share Tech Mono, not the lobby
  font choice — visually disconnected from the playable site.
- OG image alt text described the prior mixed-font wordmark
  rather than the cascade.

## [1.1.1] - 2026-05-24

Documentation patch. The site is proxied through Cloudflare, which
auto-injects an analytics beacon (`static.cloudflareinsights.com/
beacon.min.js`) and a bot-detection script (`/cdn-cgi/challenge-
platform/scripts/jsd/main.js`) onto the served HTML. Both are
correctly blocked by the existing CSP (`script-src 'self'`) — the
site continues to work — but the rejections show up as CSP errors
in browser DevTools, which an audience-of-cybersecurity-people will
notice and may misread as actual breakage. This patch documents the
posture in the README and adds a one-line `console.info` on page
load so DevTools openers see the explanation immediately.

### Added

- **`console.info` on page load** explaining that any CSP errors
  from `static.cloudflareinsights.com` or `/cdn-cgi/*` are
  Cloudflare auto-injections being correctly blocked by the site's
  security policy. Styled with the project's accent color on the
  "D3CYPH3R" prefix so it reads as part of the brand, not as a
  debug log. Visible to anyone who opens the browser console;
  invisible to everyone else.
- **README "Privacy" section paragraph** describing the same: which
  third-party scripts Cloudflare attempts to inject, why we don't
  control that without changing CDNs, and that the CSP rejection is
  the privacy promise being enforced by the browser. Frames visible
  CSP errors as proof-of-posture rather than a defect.

### Changed

- **`js/engine/version.js` release checklist** refined: the
  cache-bust query-string bump in step 2b is now conditional on
  whether `style.css` or `walkthrough.css` actually changed in the
  release. Bumping unnecessarily forces returning visitors to
  re-fetch identical bytes; leaving the prior version preserves
  cache validity. The smarter rule is "bump when CSS changes," not
  "bump every release."

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

[Unreleased]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.23.1...HEAD
[1.23.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.23.0...v1.23.1
[1.23.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.22.0...v1.23.0
[1.22.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.21.0...v1.22.0
[1.21.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.20.0...v1.21.0
[1.20.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.19.0...v1.20.0
[1.19.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.18.0...v1.19.0
[1.18.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.17.0...v1.18.0
[1.17.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.16.0...v1.17.0
[1.16.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.15.0...v1.16.0
[1.15.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.14.0...v1.15.0
[1.14.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.10.1...v1.11.0
[1.10.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.10.0...v1.10.1
[1.10.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.8.1...v1.9.0
[1.8.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.8.0...v1.8.1
[1.8.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v1.1.0...v1.1.1
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
