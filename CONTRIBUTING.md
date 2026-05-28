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
node playtest.cjs                   # against http://localhost:8000
```

CI runs this on every PR (`.github/workflows/azure-static-web-apps-*.yml`,
the `playtest_job`). A red playtest blocks the Azure SWA deploy.

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
introduced in v1.9.0 is now seeded on all 14 shipped levels
(linux + the 12 non-linux tracks). Each level has at least one
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

After adding the level, append a playtest block in
`tests/playtest.cjs` covering the wrong-password gate, correct-password
entry, expected files listed by `ls`, the puzzle steps, and the
breadcrumb-extraction assertion. Pattern-match an existing
level1 block.

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

4. **Playtest coverage** (`tests/playtest.cjs`) — add a lobby smoke
   test that the command degrades gracefully when its level data is
   absent (a usage line, an empty-state message, or both). For
   commands that read per-level data, also seed a level (or use an
   existing one) and assert on the rendered output.

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
template — they all follow the same 9-section structure:

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
