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
The app is desktop-only by design; mobile devices get a "device not
supported" gate.

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
+ visited count + level0's difficulty); expanded tracks show the
track's `description` plus per-level rows with the level's `title`,
visited mark, and estimated time. The `tracks` command (in
`js/commands/lobby.js`) toggles state, persisted in
`sessionStorage("lobbyExpanded")`. Smart default: tracks with any
visited level auto-expand on the first lobby render of a session.

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

**Boot order matters.** `js/main.js` short-circuits on mobile
*before* importing engine modules (dynamic `await import()`), so the
engine never executes on mobile. On desktop the order is: command
set → input handlers → clock → boot. `boot()` prints the fake
kernel sequence and then `connectTo("guest@d3cyph3r")` drops the
user into the lobby.

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
