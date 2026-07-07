# Contributing to D3CYPH3R

Thanks for the interest. D3CYPH3R is deliberately fork-friendly — pure
static ES modules, no build step, MIT-licensed engine, and a content
schema that's documented inline. This guide covers what you need to
know to extend it: adding a level, adding a command, writing a
walkthrough, or running the test harness.

## Run it locally

ES modules need an HTTP origin (opening `index.html` via `file://` won't
work). From the repo root:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Any other static server works too — `npx serve`, `live-server`, Caddy.
The app is **designed for desktop**; mobile devices see a warning gate
by default but can tap "Continue anyway" to boot into a mobile-mode
build (responsive CSS + soft-key row above the on-screen keyboard).
The site is also installable as a Progressive Web App on Chrome /
Edge / Safari 16.4+ — both surfaces shipped in v1.21.0.

To run the headless playtest:

```bash
cd tests
npm install
npx playwright install chromium    # first time only
npx playwright test                # full suite, parallel
npx playwright test linux          # one spec by filename match
npx playwright test --grep "lobby" # one test by name
npx playwright test --headed       # see the browser
```

### When CI runs the playtest

As of v1.24.2, the workflow is tuned for fast iteration:

- **PR pushes do NOT run the CI playtest.** Local playtest (`cd tests
  && npx playwright test`) is the iteration loop. PR pushes still
  deploy an SWA preview so you can verify behavior in a real browser
  before merge.
- **Push to `main` (merge commits) runs the CI playtest** as the deploy
  gate. The playtest is sharded across 4 parallel runners
  (`--shard 1/4` through `--shard 4/4`), so wall time is bounded by the
  slowest shard, not the total content. A failed shard blocks the
  prod deploy.
- **Docs-only PRs skip the workflow entirely** (paths-ignore covers
  CHANGELOG, README, CONTRIBUTING, SECURITY, LICENSE, `.gitignore`,
  and `.github/**.md`). Walkthrough markdown files are NOT in the
  ignore list because they ARE deployed and need preview.
- **Need to force CI playtest on a PR branch?** Use the manual
  escape hatch: GitHub Actions UI → "Run workflow" → pick the
  branch. Useful when you've changed CI infrastructure itself and
  want a pre-merge smoke check.

### Local development practice

Because PR CI no longer runs the playtest, **run the suite locally
before pushing.** It's fast (~70s on a 5-core dev machine):

```bash
cd tests && npx playwright test
```

For tight iteration on a single track or feature, target one spec:

```bash
npx playwright test linux              # one spec by filename
npx playwright test --grep "lobby"     # one test by name
```

A failing local run that gets pushed → merged will be caught by the
sharded merge-to-main playtest gate, but the deploy will be blocked
and you'll have to ship a fix-forward PATCH. Better to catch locally.

### How the suite is structured

The suite (v1.24.0+) uses `@playwright/test` with `fullyParallel: true`:
- **`tests/specs/`** — one spec file per track (`linux.spec.cjs`,
  `network.spec.cjs`, ..., `cloud.spec.cjs`) plus cross-cutting suites
  (`engine-surface.spec.cjs`, `shell-features.spec.cjs`,
  `shell-realism.spec.cjs`, `lobby-tree.spec.cjs`,
  `achievements.spec.cjs`, `themes-and-tutorial.spec.cjs`,
  `persistence-savecode.spec.cjs`, `mobile-pwa.spec.cjs`).
- **`tests/lib/helpers.cjs`** — shared `dispatchCmd(page, cmd)` (value-set
  + Enter dispatch, replaces per-character `keyboard.type`),
  `bootAndWait(page, "/")`, `terminalText(page)`, `resetState(page)`,
  `waitForOutput(page, text)`, plus `typeKeystrokes` / `pressKey` for
  the readline tests that need real keyboard events.
- **`tests/playwright.config.cjs`** — `fullyParallel: true` locally,
  `workers: 4` in CI (matches the ubuntu-latest runner's vCPU count),
  traces + screenshots on failure, 30s per-test timeout.

Each `test()` block gets its own browser context, so per-spec state
(sessionStorage, localStorage, viewport, mobile-bypass flag) is
isolated by default.

## Read these first

Two files carry the lore + content context every contributor needs:

1. **[README.md](README.md)** — the file-structure map under "How
   it's organized" + the per-track command inventory.
2. **`levels/linux.js` header comment** — the canonical level schema
   doc. Every level on every track follows this schema with optional
   track-specific extensions (which are documented at the top of each
   track's file — see `levels/forensics.js`, `levels/cloud.js`,
   `levels/osint.js` for examples).

Once you've read those, the section below covers everything you need
to know about the engine itself.

## Architecture in one screen

**Lobby ↔ level model.** The entire game is a map of "levels" keyed
by `"<user>@<host>"` strings (e.g. `"level0@linux"`,
`"guest@d3cyph3r"`). `guest@d3cyph3r` is the lobby — the user lands
there at boot and returns there between tracks. Switching levels is
modelled as `ssh user@host` (see `js/engine/ssh.js`); levels with a
`password` field gate entry behind a masked prompt.

**Two parallel registries, both keyed by track.** Adding a track
requires touching both:

- **Level data**: `levels/<track>.js` exports a `<track>Levels`
  object → imported and spread into `LEVELS` in `levels/index.js`.
- **Commands**: `js/commands/<track>.js` exports a `<track>Commands`
  object → imported and spread into `COMMANDS` in
  `js/commands/index.js`.

The lobby's track list (`js/engine/tracks.js`) is the third place —
it's the canonical track registry that both the lobby and the
"scaffolded but no levels yet" warm-message code read from. Each
entry carries `key`, `label`, `host`, and (v1.10.0) `description` —
the one-line blurb shown inside the lobby tree when a track is
expanded.

**Lobby tree (v1.10.0).** The lobby's AVAILABLE ENGAGEMENTS list
is rendered as a collapsible tree by `js/engine/lobby.js`:
collapsed tracks show a one-liner (entry-point ssh command + label
+ visited count + tier); expanded tracks show the track's
`description` plus per-level rows with the level's `title`,
visited mark, computed tier, and estimated time. The `tracks`
command (in `js/commands/lobby.js`) toggles state, persisted in
`sessionStorage("lobbyExpanded")`. Smart default: tracks with any
visited level auto-expand on the first lobby render of a session.

**Tier system (v1.10.0).** Difficulty is COMPUTED from the level
number — no manual `difficulty:` field. Single source of truth in
`js/engine/tiers.js`:

  - `Routine` (level 0–5) — standard quarterly audit work
  - `Live` (level 6–10) — active engagement, real contractual stakes
  - `Escalated` (level 11–15) — incident response in progress
  - `Critical` (level 16–20) — notification clocks running
  - `Crisis` (level 21+) — public-statement-grade engagement

The label describes the **operational state** of the engagement,
not raw puzzle complexity. The new `tiers` command prints the
legend in-game; the lobby footer points players at it. The
connection banner reads `Tier: Routine · Est. time: ~10 min`.
Pivot hosts (non-numbered) sit off the curve and get no tier
label in either the lobby tree or the connection banner. When
designing a new level, **match the tone to the tier** — a
Routine-tier level reads as a routine audit; an Escalated-tier
level reads as active IR.

**Cold-start gate hint + future-level tip (v1.10.0).**
`js/engine/ssh.js` routes the "level lookup miss" three ways. (1)
Scaffolded track with NO levels yet → warm "track scaffolded"
message. (2) Well-formed `level<N>@<known-host>` where N hasn't
shipped → red DNS error PLUS a yellow tip naming the track's
current shipped ceiling ("level0 through level1 currently
shipped; check back later"). (3) Anything else (typos, wrong
host, malformed user) → plain DNS error. Separately, when a
player attempts a gated `level<N>@<host>` without having visited
`level<N-1>@<host>`, the red `Permission denied` line is followed
by a yellow tip pointing at the prerequisite. Both yellow tips
mirror the same UX pattern: red error stays, friendly hint
layers underneath.

**Bonus finds on every level (v1.10.0).** `level.bonusFinds`
introduced in v1.9.0 is now seeded on all 22 shipped levels
(all 7 tracks through level2, plus level3@linux). Each level has at least one
bonus find, computed against `js/engine/bonus.js#checkBonusFinds`,
that surfaces an orthogonal lesson distinct from the credential-
chain solve. Triggers use existing in-level content (file reads,
command outputs, log entries) — no new fs nodes or schema
needed. `progress --detail` lists discovered bonuses by name
with an anti-spoiler render for un-found and unvisited cases.

**Walkthrough §7.5 Optional exploration pattern (v1.10.0).** Every
walkthrough under `walkthroughs/<track>/level<N>.md` gains a
§7.5 section between §7 (defender's playbook) and §8 (key
takeaways). The section names the level's bonus find(s), gives
the trigger command, and expands the hint into a real-world
pattern reference. This is the documented destination for
bonus-find spoilers — anti-spoiler discipline applies to
`progress --detail` (in-game) but walkthroughs are spoiler-
tolerant by design. See `walkthroughs/README.md` for the
author template.

**Filesystem tri-representation.** Level content lives as a nested
tree under `level.fs`. Three node types:

- `{ type: "dir",     children: { ... } }` — directory
- `{ type: "file",    content: "..." }`    — file with string content
- `{ type: "symlink", target: "..." }`     — symbolic link (v1.5.0+)

At module init, `js/fs/flatten.js#initLevels` walks every level's
`fs` tree and produces a flat `level.files` map
(`"path/to/file": "contents"`, dirs as `"path/": null`; symlinks are
*not* in the flat map — they only exist in the tree). Most newer
commands (`ls`, `cd`, `cat`, `head`, `tail`, `grep`) read the tree
via `getFSNode(level, pathParts)` in `js/fs/resolve.js` — which
follows symlinks transparently with a 16-hop cycle cap. Legacy /
cross-cutting commands (`base64`, `xxd`, `strings`, `file`, etc.)
read the flat map. When adding new commands, prefer the tree-aware
`getFSNode` for cwd-aware behavior; reach for `level.files` only
when you genuinely need a flat enumeration.

**Engine state lives in one module.** `js/engine/state.js` exports
`currentLevelKey`, `currentPath`, `awaitingPassword` as live
bindings, plus `setX` functions. ES module live bindings let
importers *read* the current value, but only the owning module can
reassign — so every write goes through a setter. Don't try to mutate
these from outside the module.

**Command dispatch.** `js/engine/execute.js` is the single
dispatcher called per Enter press. Order:

1. Echo the line.
2. Password mode (route to `handlePasswordInput`).
3. `ssh` special-case (can't appear in a pipe; route to `handleSSH`).
4. Parse into a statement chain (`parseLine` — splits on `&&`/`||`/
   `;`/`&` at top level; each statement is a pipeline of `|`-
   separated segments; each segment is a token list).
5. Run the chain honoring AND/OR/ALWAYS semantics + per-statement
   background flag (`&` → output captured to job table).
6. Per-segment: brace expansion → variable expansion (`$VAR`,
   `${VAR}`, `$?`, `$(cmd)`) → quote stripping → leading
   `NAME=value` assignments applied → `COMMANDS[cmd]` lookup.
7. "command not found."

Each command handler has the signature
`(level, arg, stdin?, argv?) → { text, cls } | null`. The `stdin`
parameter is `undefined` for standalone invocations and a string
when the command sits downstream of a pipe; the `argv?` parameter
is the post-expansion token array (useful when the command needs to
distinguish flags from values without re-parsing `arg`). Pipe-
friendly commands (`grep`, `head`, `tail`, `wc`, `sort`, `uniq`,
`cut`, `tr`, `awk`) read from `stdin` when no file arg is given;
non-pipe-friendly commands ignore it cleanly. Returning `null`
suppresses output; otherwise the dispatcher prints with the given
CSS class (`out`, `err`, `dim`, `warn`, `success`, `info`, `cmd`,
`ascii`, `banner`).

**Shell environment (v1.9.0).** The engine maintains a writable
env map in `js/engine/state.js#processEnv`. Player-set values
(`export FOO=bar`, `FOO=bar` assignment, `unset FOO`) live there
and override the built-in `USER` / `HOME` / `PWD` / `HOSTNAME` /
`PATH` / `SHELL` / `LANG` / `PS1` / `PS2`. The map is cleared on
every level switch — a fresh shell starts clean. Levels can also
declare a static `env_vars` map; its values sit between the
built-ins and the writable layer.

**Multi-host pivot (v1.9.0).** A level can declare `network: {
"<user>@<host>": { ... }}` — pivot hosts the player can `ssh` into
from inside the level. They're registered as hidden top-level
LEVELS entries (`pivot: true`) at module init. ssh'ing in pushes
the current shell onto `hostStack`; `exit` pops back. The lobby's
track list never shows pivot hosts.

**Job control (v1.9.0).** Trailing `&` flags a statement as
background. The dispatcher captures its stdout into a `jobs`
table entry and prints `[N] PID`. `fg %N` replays the captured
output; `jobs`/`bg`/`kill`/`wait`/`disown` operate on the table.
Commands run synchronously in the sandbox, so backgrounded jobs
complete immediately — the UX matches bash without true
concurrency.

**Boot order matters.** `js/main.js` checks `isMobile()` first; if
the device is mobile AND `isMobileBypassed()` is false (no
"Continue anyway" tap recorded in sessionStorage AND not running in
PWA standalone mode), the warning gate renders and engine modules
never load. Otherwise — desktop, or mobile-bypassed — engine modules
load via dynamic `await import()` in this order: state hydration →
theme init → command set → input handlers → clock → bonus rehydrate
→ level-timer rehydrate → beforeunload flush hook → `boot()` →
`registerServiceWorker()`. `boot()` prints the fake kernel sequence
and then `connectTo("guest@d3cyph3r")` drops the user into the
lobby. SW registration is fire-and-forget after boot so PWA install
doesn't compete with first-paint.

**Mobile mode (v1.21.0).** When the player bypasses the gate (or
launches the installed PWA in standalone mode), `state.isMobileMode`
is set to `true` and `body.mobile-mode` is added. Responsive CSS
under `@media (max-width: 768px)` plus the `body.mobile-mode` class
adjust font sizes, padding, and visibility of the soft-key row.
`js/terminal/softkeys.js` injects a horizontal-scrolling row of 18
keys (Tab, Esc, arrows, Ctrl-C, shell symbols) above the input as a
sibling of `#input-area`. Special keys synthesize real
`KeyboardEvent`s so existing readline handlers process them;
character keys splice the literal value at the cursor. A tap-to-
focus handler on `#screen` focuses the hidden `<input>` so the on-
screen keyboard opens.

**Service worker (v1.21.0).** `sw.js` uses runtime caching — only
the bootstrap shell (HTML + manifest + icons) is pre-cached on
install; everything else (engine modules, level data, walkthroughs)
caches on-demand via routing-based strategies (network-first for
HTML, stale-while-revalidate for `/js/`, `/levels/`,
`/walkthroughs/`, and `style.css`, cache-first for vendored libs +
icons). The `CACHE_VERSION` constant at the top of `sw.js` is
bumped in lockstep with `js/engine/version.js` per release; the
`activate` event nukes every cache whose name doesn't match the
current version. Player-callable `sw status` / `sw update` / `sw
clear` commands live in `js/commands/pwa.js`; `reload` triggers
`skipWaiting` if a new SW is waiting.

**Stateless progress codes (v1.20.0).** `js/engine/savecode.js`
encodes the player's progress (visited levels, achievements, bonus
finds, per-level times, hint counters, theme, onboarding flag,
lobby-expand state) into a packed-binary base64url string framed
as `D3C2-XXXX-...-CCCCCCCC`. Six **stable append-only registries**
(LEVEL / ACHIEVEMENT / THEME / TRACK / MILESTONE / BONUS) map
string ids to small integer indexes — the indexes are burned into
every code that references them, so **never reorder or delete
entries**; append only. Decoding iterates only up to the current
registry length, so codes from older versions decode cleanly and
new entries are silently ignored by old decoders.

**Per-track credential chain.** Every level leaks a credential that
the next level in its track consumes as its entry gate (`password`
field). The chain is intentional — a track feels like a continuous
engagement rather than disconnected vignettes. No cross-track
chains — `level0@network`'s credential doesn't gate `level1@web`,
by design. Players can pick tracks in any order; chains are
per-track only.

**Walkthroughs subsite.** A separate static subsite under
`/walkthroughs/` hosts long-form solve guides — one markdown file
per shipped level. It's a self-contained reader
(`walkthroughs/index.html` + `walkthrough.css` + `walkthrough.js`)
using a vendored `marked.js` for rendering and hash-based routing
(`#/track/levelN`). The `MANIFEST` constant in
`walkthroughs/walkthrough.js` lists every available walkthrough;
adding a new walkthrough means dropping the markdown file in the
right path AND adding the entry to `MANIFEST`. The subsite is
excluded from search-engine indexing via `robots.txt` and shares
Azure Static Web Apps hosting with the main app (routes documented
in `staticwebapp.config.json`).

## How to add a new level to an existing track

The minimum-viable level is a single object literal added to
`levels/<track>.js`:

```js
"level2@linux": {
  password: "the-credential-leaked-in-level1",  // null for level0s
  track: "linux",
  playerUser: "in-world-username",              // the prompt user shown
  objective: "One-sentence description of the player's task.",
  lesson:    "Multi-sentence intro shown on ssh-in. Sets the scene.",
  fs: {
    type: "dir",
    children: {
      "welcome.md":         { type: "file", content: "..." },
      "engagement-notes.md":{ type: "file", content: "..." },
      "lessons-learned.md": { type: "file", content: "..." },
      // ...puzzle artifacts...
    },
  },
},
```

The full schema is at the top of `levels/linux.js`. Key invariants:

- `password` matches the credential leaked by the prior level in the
  same track. The credential is the chain.
- `track` must match an entry in `js/engine/tracks.js` (which the
  lobby reads to decide which tracks to list).
- The `fs.children` tree is the source of truth; the engine flattens
  it to a `level.files` map at module init via `js/fs/flatten.js`.
- `welcome.md` and `lessons-learned.md` follow a shared visual
  template — box-drawing dividers (`─── HEADER ───`), no markdown
  headers (`#` / `##` render as literal text in the terminal). Use
  `level0@web` as the canonical reference.

After adding the level, add tests to the matching
`tests/specs/<track>.spec.cjs` covering the wrong-password gate,
correct-password entry, expected files listed by `ls`, the puzzle
steps, and the breadcrumb-extraction assertion. Pattern-match an
existing level block in the same file (e.g.
`tests/specs/crypto.spec.cjs` is the canonical reference for a
password-gated level with nested `describe.serial` blocks for state
that accumulates within a level). New levels rarely need any cross-
spec changes — the per-spec parallel layout keeps each level
hermetic.

## How to add a new command

Decide first whether the command is **track-specific** (only
meaningful in one track's puzzles — e.g. `nmap`, `jwt`, `evtx`) or
**infrastructure** (shell-shaped, useful everywhere — e.g. `wc`,
`uname`, `crontab`). Track commands live in `js/commands/<track>.js`;
infrastructure commands live in one of the cross-cutting modules
(`shell.js`, `text.js`, `system.js`, `sysinspect.js`, `netinspect.js`,
`format.js`, `learning.js`). Pick the module whose responsibility
matches; create a new module if none fit.

Three places to touch in either case:

1. **Command module** — add an entry to the exported `<...>Commands`
   object with the signature
   `(level, arg, stdin?) => { text, cls } | null`. `text` is the
   output string; `cls` is a CSS class (`out`, `err`, `dim`, `warn`,
   `success`, `info`, `cmd`, `ascii`, `banner`). Returning `null`
   suppresses output. If you create a new module, also wire it into
   `js/commands/index.js` (import + spread into `COMMANDS`).

2. **Help reference** (`js/commands/shell.js`) — add a line to the
   appropriate section. Track-keyed sections live in `HELP_SECTIONS`
   (one per track + dimmed for tracks-without-levels-yet);
   infrastructure sections live in `HELP_INFRA` (TEXT PROCESSING,
   SYSTEM INFO, SYSTEM INSPECTION, FORMAT INSPECTION) and `HELP_LEARNING`
   (hint / man / what-is) / `HELP_TERMINAL` (clear / ssh / exit /
   report / help). The `help` command renders these at runtime.

3. **Manpage** (`js/commands/man-pages.js`) — add an entry to the
   `MAN_PAGES` map so `man <newcmd>` doesn't 404. Follow the
   NAME / SYNOPSIS / DESCRIPTION / EXAMPLES format used by the
   ~70 existing entries.

4. **Playtest coverage** — add tests in the appropriate spec file
   under `tests/specs/`. Cross-cutting commands (text processing,
   system info, etc.) belong in `tests/specs/engine-surface.spec.cjs`
   (graceful-at-lobby smoke) and `tests/specs/shell-realism.spec.cjs`
   (in-level behavior). Track-specific commands belong in the
   matching `<track>.spec.cjs`. The shared helpers in
   `tests/lib/helpers.cjs` (`dispatchCmd`, `bootAndWait`,
   `terminalText`, `waitForOutput`) handle the per-input transport;
   tests should focus on assertions, not plumbing.

If the command reads per-level data, document the schema at the top
of the relevant track file so future authors know what to populate.
Examples already shipped: `evtxLogs` (forensics), `github` (osint),
`postgres` (cloud), `system` (system.js — uname / id / uptime
overrides), `crontab` / `lastLogins` / `activeSessions` / `openFiles`
/ `sockets` / `journal` / `systemdUnits` / `dmesg` (sysinspect.js,
documented at the top of `levels/linux.js`),
`netInterfaces` / `routes` / `arpCache` / `pingResults` /
`tracerouteResults` / `nslookupResults` (netinspect.js, same
location), `certs` / `tarArchives` / `gzipArchives` (format.js),
`hints` (learning.js).

## How to add a new track

Five places:

1. `levels/<newtrack>.js` — exports `<newtrack>Levels` object.
2. `levels/index.js` — import and spread into `LEVELS`.
3. `js/commands/<newtrack>.js` — exports `<newtrack>Commands` object.
4. `js/commands/index.js` — import and spread into `COMMANDS`.
5. `js/engine/tracks.js` — add the track to the `tracks` array
   (lobby uses this to decide which to list).

The lobby auto-detects which tracks have at least one level and
dims/hides the others, so the new track stays out of the lobby
until you ship its first level. The `help` command will still list
the new track's commands; sections without any level data render
dimmed.

## How to write a walkthrough

Each shipped level has a long-form companion walkthrough under
`walkthroughs/<track>/<level>.md`. Use any existing walkthrough as a
template — they all follow the same nine-numbered-section structure (§1–§9, plus the spoiler header and §7.5):

1. **§1 The setup** — narrative continuation from the prior level
2. **§2 The solve** — step-by-step solution path
3. **§3 The vulnerability** — vulnerability-class deep-dive
4. **§4 Real-world parallels** — historical incidents that hit the
   same pattern
5. **§5 Frameworks that cover this** — NIST / SOC 2 / CIS / OWASP /
   CWE / regulator-specific (HIPAA / GLBA / NAIC / NYDFS / FERPA /
   CMMC / etc.)
6. **§6 Where this shows up on certifications** — SANS GIAC / CompTIA
   / ISC2 / EC-Council / vendor-specific
7. **§7 What a defender should actually do** — remediation
   prioritization
8. **§8 Further reading** — curated link list with a "Last reviewed:
   <Month Year>" footer
9. **§9 Key takeaways** — bullet-list summary

Target length: ~7,000-9,000 words. The §8 "Last reviewed" footer
matters — it lets readers know when the citations were verified
against the regulatory + tooling landscape (which drifts year over
year).

After writing the walkthrough, register it in
`walkthroughs/walkthrough.js`'s `MANIFEST` constant with a track
blurb + per-level title + summary. The walkthrough subsite reads from
`MANIFEST` to render its index page.

**Anti-spoiler rule:** walkthroughs are the *only* sanctioned
destination for full solve paths and actual credential values. Never
paste actual passwords, breadcrumb credentials, or API keys into
CHANGELOG.md, README.md, PR descriptions, GitHub Release notes, or
commit messages. Describe the mechanism, not the value.

## Worldbuilding continuity

All current levels are set at **Driftwood Systems**, a fictional
mid-sized tech consulting firm (~600 consultants, ~80 client
engagements). Recurring characters carry across levels (Priya is the
Driftwood handler; Marcus, Theo, Carlos, Dana, Marisol, Jordan are
client counterparts). Each track has a specific client + compliance
regime:

| Track | Client | Compliance |
|---|---|---|
| Linux | Halton Bank | GLBA |
| Network | Atlas Health | HIPAA |
| Crypto | Vesta Retail | PCI-DSS |
| Web | Meridian State University | FERPA |
| Forensics | Polaris Defense Systems | CMMC / NIST 800-171 |
| OSINT | Veridian Analytics | HIPAA / HITRUST CSF |
| Cloud | Coverline Insurance | SOC 2 / NAIC / NYDFS / GLBA |

When adding a new level, preserve the worldbuilding rather than
introducing a generic scenario. The continuity is part of what makes
the post-mortems land — the compliance regime is bound to the client.

## Localization (i18n)

**D3CYPH3R is English-only by design.** All player-facing strings —
level content, command output, error messages, walkthroughs, UI chrome —
ship in English. There is no localization layer, no string extraction
infrastructure, and no plan to add one.

This is a deliberate decision (committed v1.22.0), not an oversight:

- The audience is professional cybersecurity learners — English is the
  working language for every certification body, framework spec, MITRE
  taxonomy, and CWE reference the levels cite. Translating those would
  defeat the post-mortems' point.
- A hobby project can't sustain the maintenance burden of N translated
  copies of every level's welcome.md / lessons-learned.md, plus the
  walkthroughs (well over 100k words), plus drift management as
  citations get updated.
- The engine has no string-extraction conventions. Player-facing
  strings live inline in command handlers, level data, and UI modules
  with no `t("key")` wrapper or `messages.<lang>.json` files.

**Implication for contributors:** keep strings inline; don't half-
implement i18n discipline (extraction-friendly conventions without the
actual extraction) because that's the worst of both worlds — engineering
discipline cost without payoff. If you'd want to fork D3CYPH3R as the
base for a localized cybersecurity-training product, the engine
architecture supports it cleanly, but it's downstream-fork work, not
upstream-contribution work.

## Mobile-readable content style guide

The mobile-mode build shipped in v1.21.0 lets players boot D3CYPH3R on
a touch device after tapping "Continue anyway." Existing content was
authored desktop-first and works mobile-acceptably; new content authored
*against* this style guide will work mobile-well. Set `mobileReady: true`
on a level only after confirming the level was authored against these
guidelines.

### Line width

- **ASCII art and box-drawing dividers: max 64 characters wide.** The
  default mobile viewport renders ~60-65 chars per line; wider art wraps
  and breaks. Use shorter `─── HEADER ───` runs and lean on
  pipe-separated columns instead of wide fixed-width tables.
- **Paragraphs: prefer 70-90 char hard wrap** rather than long lines. The
  engine's `.line` CSS uses `overflow-wrap: anywhere` so long lines
  *will* wrap, but the wrap points are then arbitrary; pre-wrapped
  paragraphs read better.
- **`ls -l` listings and similar fixed-column output: fine as-is.**
  Mobile players are used to scrolling horizontally for terminal output
  that genuinely needs it. The art is "narrative content should fit
  without horizontal scrolling; data output can require it."

### Output shape

- **Prefer short paragraphs over walls of text.** Mobile screen real
  estate rewards punchy three-to-five-line blocks separated by blank
  lines.
- **Avoid wide-by-tall tables.** A 6-column 30-row table that fits a
  desktop terminal is a fingerprint-zoom problem on mobile. Split into
  multiple narrower tables or use a flat key-value listing.
- **`welcome.md` HOW TO PLAY sections: bullet lists, not prose
  paragraphs.** Each bullet ≤ 80 chars where possible.

### File and directory names

- **Short names play better.** A directory called
  `coverline-claims-uploads-prod-legacy-deploy-2024-q2-migration/`
  works on desktop but wraps awkwardly in narrow `ls` output. If the
  name carries narrative weight, fine; if it's incidental, prefer
  something shorter (`legacy-deploy/`, `q2-migration/`).
- Same goes for filenames inside levels — `migration-artifacts.txt`
  beats `coverline-2024-q2-migration-artifacts-and-broker-portal-creds.txt`.

### When to set `mobileReady: true`

A level qualifies as `mobileReady: true` when:

1. All welcome.md / lessons-learned.md / engagement-notes.md content
   fits the line-width and paragraph-shape guidance above.
2. The command outputs the puzzle requires (`ls`, `cat <file>`, etc.)
   fit narrow viewports without rendering as a jumbled wall.
3. The level's bonus find can be discovered with mobile-feasible
   typing (no 80-character pipelines required).

Pre-v1.22 levels are NOT retro-flagged. That's intentional — the flag is
a forward-looking signal, not a claim about existing content. A future
lobby filter can prefer mobileReady levels on touch devices when there
are enough of them to filter meaningfully (probably v2.0+).

## Submitting changes

This is a hobby project; there's no formal review process. If you're
adding content (a new level, a new walkthrough, a content fix):

1. Fork the repo.
2. Branch off `main` with a descriptive name.
3. Run the playtest locally and confirm it passes.
4. Open a PR with a clear description of what changed and why.

If you're adding engine surface (new commands, schema changes,
infrastructure), match the conventions in the existing files — header
comments, schema docs, playtest coverage, and the per-track
registration pattern.

## License

MIT — see [LICENSE](LICENSE). All level content in this repo is
original; the engine architecture is a refactor of
[Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil
Sagalgile (also MIT-licensed) and credits Shellscape in the README.
