# D3CYPH3R

> **Play it live: https://www.d3cyph3r.com**

A browser-based terminal CTF for DevOps engineers, SREs, and SysAdmins learning cybersecurity. You play a new hire at **Driftwood Systems**, a mid-sized tech consulting firm with roughly 600 consultants spread across ~80 client engagements at any given time. Each level drops you on a real-feeling box you've inherited — a rolled-off consultant's laptop, a stale client engagement environment, a forgotten audit artifact, an alibi photograph submitted to in-house counsel — and asks you to find what got left exposed.

The puzzles stay close to what actually happens at consulting firms with rotating engagements and shared client access. The post-mortem at the end of each level pulls the thread out to the controls (NIST 800-53, NIST 800-171, CIS Controls v8, CIS AWS Foundations Benchmark, CWE), the techniques (MITRE ATT&CK), the regs that bite (GLBA, PCI-DSS, HIPAA, FERPA, CMMC, SOC 2, NAIC, NYDFS), and the certs (Security+, CySA+, PenTest+, CISSP, OSCP, CHFI, GCFE / GCFA, AWS Security Specialty, CCSP, CCSK) that cover this territory in the real world.

Recurring characters, recurring clients, recurring technical debt across levels.

All seven tracks (Linux, Network, Crypto, Web, Forensics, OSINT, Cloud) ship level0 + level1 chains playable end-to-end; Linux and Forensics ship through level2 (v1.23.0 + v1.25.0). 16 levels across all 7 tracks. Each level introduces one new concept and drops the player into a different client engagement with a different compliance regime in scope:

| Track | Levels shipped | Client | Compliance |
|---|---|---|---|
| Linux | `level0@linux` ("Daniel's Last Day"), `level1@linux` ("The Backup Daniel Forgot"), `level2@linux` ("Daniel's Forgotten Cron") | Halton Bank | GLBA |
| Network | `level0@network` ("Atlas Health Perimeter Check"), `level1@network` ("The Map Marcus Didn't Mean to Share") | Atlas Health | HIPAA |
| Crypto | `level0@crypto` ("Theo's Safer API Key"), `level1@crypto` ("Theo's Signature That Wasn't") | Vesta Retail | PCI-DSS |
| Web | `level0@web` ("Meridian's Forgotten Backup Folder"), `level1@web` ("Carlos's Login Wall") | Meridian State University | FERPA |
| Forensics | `level0@forensics` ("Reed's Soccer Alibi"), `level1@forensics` ("What the Logs Saw"), `level2@forensics` ("What Reed's Browser Saw") | Polaris Defense Systems | CMMC / NIST 800-171 |
| OSINT | `level0@osint` ("Veridian's Open Letter"), `level1@osint` ("Aaron's Weekend Project") | Veridian Analytics | HIPAA / HITRUST CSF |
| Cloud | `level0@cloud` ("Coverline's Twelfth Bucket"), `level1@cloud` ("The Migration Table Nobody Dropped") | Coverline Insurance | SOC 2 / NAIC / NYDFS / GLBA |

## Running it locally

ES modules need an HTTP origin, so opening `index.html` via `file://` won't work. From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or use any other static server (`npx serve`, `live-server`, etc.).

D3CYPH3R is **designed for desktop**. The puzzles assume a real keyboard — Tab autocomplete, Ctrl-shortcuts, long pipelines. Mobile devices see a warning gate by default; tapping **Continue anyway** boots the engine in mobile mode with a soft-key row above the on-screen keyboard for Tab / Esc / Ctrl-C / `|` / `&&` / `$` / `_` / etc. (v1.21.0). The site is also installable as a **Progressive Web App** — Chrome / Edge / Safari 16.4+ show an Install button after a few visits, after which the app gets its own dock icon, opens in a borderless window, and works offline.

## What you can do today

Pick a track from the lobby — all seven are entry-point reachable with no password:

```
guest@d3cyph3r:~$ ssh level0@linux        # File reading / credential hunting
guest@d3cyph3r:~$ ssh level0@network      # Port scanning / perimeter audit
guest@d3cyph3r:~$ ssh level0@crypto       # Encoding ≠ encryption
guest@d3cyph3r:~$ ssh level0@web          # HTTP directory enumeration
guest@d3cyph3r:~$ ssh level0@forensics    # EXIF metadata / insider-threat
guest@d3cyph3r:~$ ssh level0@osint        # Breach-corpus credential reuse
guest@d3cyph3r:~$ ssh level0@cloud        # S3 misconfiguration / SOC 2 audit
```

Each track's `level0` is an entry point — no password, walks you through one new concept, and ends with a post-mortem citing the relevant CWE / framework / MITRE technique. The level1 in each track is gated by a credential the player recovers during level0 (Daniel's `creds.txt`, Marcus's unrotated default, the decoded base64 API key, Meridian's leaked DB password, Sgt. Chen's handoff archive password, Aaron's reused breach-corpus password, and Coverline's hardcoded RDS master). Every level1 in turn leaks a credential staged for the eventual level2 — the per-track credential chain is the through-line.

The lobby (`guest@d3cyph3r`) renders the engagement list as a collapsible tree (v1.10.0): each track is one line by default; `tracks <name>` expands a track to show its level lineup with titles, computed difficulty tier (Routine / Live / Escalated / Critical / Crisis — type `tiers` for definitions), and estimated time. Tracks with any visited level auto-expand on the next lobby render. First-time visitors see a guided FIRST STEPS block and can run `tutorial start` for a hand-held walk-through (v1.12.0); returning visitors see a welcome-back summary with a "Continue: ssh level<N+1>@<track>" recommendation (v1.18.0). Other player surfaces: `progress --detail` lists discovered bonus finds + per-level times, `achievements` lists the 20-achievement layer (v1.14.0), `themes` switches between 11 palettes (v1.13.0), `save` emits a portable progress code (v1.20.0). Type `help` inside any level for the full command reference.

## Walkthroughs

Each level ships with a long-form companion walkthrough under the `/walkthroughs/` subsite:

```
https://www.d3cyph3r.com/walkthroughs/
```

The walkthroughs (~7,000 words each, 9 sections) cover the solve path, the vulnerability class in depth, real-world parallels (Uber 2014 / Optus 2022 / Toyota 2022 / SolarWinds / MOVEit / Snowflake, etc.), framework + cert tie-ins (SOC 2 / NIST / NAIC / NYDFS / GLBA / OWASP / CIS / CWE), MITRE ATT&CK mapping, defender-action recommendations, and curated further reading. They're spoiler-bearing — only read a walkthrough after solving the level.

The subsite is publicly indexable as of v1.0.0 — search-engine traffic finding the walkthroughs is desired behavior, and the spoiler-warning callout at the top of each walkthrough guards against accidental spoilers. Hash-based routing means direct walkthrough URLs are bookmarkable.

## How it's organized

```
d3cyph3r/
├── index.html               Entry point — boots the engine
├── 404.html                 Themed 404 page (Azure SWA fallback)
├── style.css                Dark terminal theme (+ 10 alt themes, v1.13.0)
├── favicon.svg              D3CYPH3R favicon
├── og-image.png             Open Graph preview image (1200×630)
├── manifest.webmanifest     PWA manifest — name / icons / display (v1.21.0)
├── sw.js                    Service worker — runtime caching (v1.21.0)
├── icon-192.png             PWA icon (Android home screen, v1.21.0)
├── icon-512.png             PWA icon (high-res, splash, v1.21.0)
├── icon-maskable.png        PWA icon (Android adaptive shape, v1.21.0)
├── icon-180.png             PWA icon (iOS apple-touch-icon, v1.21.0)
├── robots.txt               Crawl policy + sitemap pointer
├── sitemap.xml              Search-engine site index
├── staticwebapp.config.json Azure SWA routing + headers + 404 override
├── README.md                You're here
├── CHANGELOG.md             Release history (Keep a Changelog format)
├── CONTRIBUTING.md          Guide for forkers / first-time contributors
├── SECURITY.md              Vulnerability disclosure policy
├── LICENSE                  MIT
├── assets/
│   └── og-template.html     HTML source used to render og-image.png
├── js/
│   ├── main.js              Boots the app, runs mobile gate, registers SW
│   ├── mobile-gate.js       Mobile warning + "Continue anyway" bypass (v1.21.0)
│   ├── terminal/            Output, input, cursor, clock, DOM refs
│   │   ├── clock.js         Top-bar clock tick
│   │   ├── dom.js           Cached DOM-element references
│   │   ├── input.js         Keystroke handling + Tab autocomplete + history
│   │   ├── output.js        Print-to-terminal helpers + CSS classes (+ printRich, v1.19.0)
│   │   ├── prompt.js        PS1 escape-code rendering (v1.9.0)
│   │   ├── softkeys.js      Mobile soft-key row above on-screen keyboard (v1.21.0)
│   │   └── theme.js         11-theme registry + setTheme/cycleTheme (v1.13.0)
│   ├── engine/              Game state, SSH, lobby, dispatch
│   │   ├── state.js         Live bindings (currentLevelKey, processEnv, isMobileMode, ...)
│   │   ├── execute.js       Per-Enter dispatch (echo → ssh → commands)
│   │   ├── ssh.js           Connect / disconnect / password-prompt / pivot flow
│   │   ├── lobby.js         Lobby render + first-visit onboarding + welcome-back summary
│   │   ├── tracks.js        Track metadata (track key → display name, etc.)
│   │   ├── tiers.js         Computed difficulty tiers (Routine → Crisis) (v1.10.0)
│   │   ├── progress.js      sessionStorage persistence (visited levels)
│   │   ├── persistence.js   Opt-in localStorage mirror layer (v1.11.0)
│   │   ├── leveltimer.js    Per-level time tracking + solve detection (v1.16.0)
│   │   ├── achievements.js  20-achievement registry + checker (v1.14.0)
│   │   ├── bonus.js         Bonus-find trigger matcher (v1.9.0)
│   │   ├── suggest.js       Levenshtein "did you mean" suggestion (v1.15.0)
│   │   ├── savecode.js      Packed-binary save/restore encode + decode (v1.20.0)
│   │   ├── pwa.js           Service-worker registration + update detection (v1.21.0)
│   │   ├── expand.js        Per-token expansion ($VAR / ${VAR} / $? / $(...))
│   │   ├── parse.js         Tokenizer + statement chain (&&/||/;), quote-aware
│   │   ├── validate.js      Schema validator (warns on level data bugs at init)
│   │   └── version.js       Canonical VERSION + release checklist comment
│   ├── commands/            One file per track + a shell-builtins file
│   │   ├── index.js         Assembles COMMANDS map from per-track modules
│   │   ├── linux.js         ls / cd / cat / grep / find / ps / …
│   │   ├── network.js       nmap / netstat / whois / dig
│   │   ├── crypto.js        base64 / rot13 / xxd / john / xor / jwt / …
│   │   ├── web.js           curl / gobuster / cookies
│   │   ├── forensics.js     file / strings / exif / evtx / sqlite3 / sha256sum / …
│   │   ├── osint.js         sherlock / hibp / wayback / crtsh / github / …
│   │   ├── cloud.js         aws (s3/iam/ec2/sts) + psql
│   │   ├── text.js          wc / sort / uniq / cut / tr / awk (pipe-friendly)
│   │   ├── system.js        which / type / id / uname / date / uptime / hostname
│   │   ├── sysinspect.js    crontab / last / who / w / lsof / ss / journalctl / systemctl / dmesg
│   │   ├── netinspect.js    ip / arp / ping / traceroute / nslookup / host / nc
│   │   ├── format.js        tar / gunzip / zcat (+ shared X.509 renderer)
│   │   ├── structured.js    jq / gpg / openssl (multi-subcommand)
│   │   ├── git.js           git log / show / diff / status / blame / config
│   │   ├── readonly-stubs.js  chmod / mv / rm / sudo / su (read-only errors)
│   │   ├── learning.js      hint / man / what-is / walkthrough / progress / search
│   │   ├── env.js           export / env / unset / set (v1.9.0)
│   │   ├── jobs.js          jobs / fg / bg / kill / wait / disown (v1.9.0)
│   │   ├── lobby.js         tracks / tiers (lobby-tree controls, v1.10.0)
│   │   ├── tutorial.js      tutorial + first-visit guided tour (v1.12.0)
│   │   ├── themes.js        theme / themes commands (v1.13.0)
│   │   ├── achievements.js  achievements + --detail (v1.14.0)
│   │   ├── savecode.js      save / restore commands (v1.20.0)
│   │   ├── pwa.js           sw / reload commands (v1.21.0)
│   │   ├── help-strings.js  --help block registry + auto-extractor (v1.17.0)
│   │   ├── man-pages.js     NAME/SYNOPSIS/DESCRIPTION/EXAMPLES for every command
│   │   ├── glossary.js      what-is term definitions (frameworks / regs / CWEs)
│   │   └── shell.js         help / clear / report / exit / logout
│   ├── fs/                  Per-level filesystem helpers
│   │   ├── flatten.js       Walks the level.fs tree → level.files flat map
│   │   ├── glob.js          Wildcard expansion (* and ?) for path-aware commands
│   │   └── resolve.js       cwd-aware path resolution (cd/cat/ls)
│   └── util/                Pure helpers
│       ├── hex.js           Hex encode / decode
│       └── rot13.js         ROT13 cipher
├── levels/
│   ├── index.js             Registers tracks → LEVELS map; flatten init
│   ├── linux.js             Linux track (level0 + level1 + level2) — Halton Bank / GLBA
│   ├── network.js           Network track (level0 + level1) — Atlas Health / HIPAA
│   ├── crypto.js            Crypto track (level0 + level1) — Vesta Retail / PCI-DSS
│   ├── web.js               Web track (level0 + level1) — Meridian State U / FERPA
│   ├── forensics.js         Forensics track (level0 + level1 + level2) — Polaris DS / CMMC
│   ├── osint.js             OSINT track (level0 + level1) — Veridian / HIPAA + HITRUST
│   └── cloud.js             Cloud track (level0 + level1) — Coverline / SOC 2 + NAIC
├── walkthroughs/            Long-form solve guides (separate subsite)
│   ├── index.html           Walkthrough reader shell
│   ├── walkthrough.css      Docs-reader theme (distinct from main terminal)
│   ├── walkthrough.js       Hash router + markdown renderer (vendored marked.js)
│   ├── vendor/marked.esm.min.js  Markdown → HTML library (CC-BY-3.0 attribution in vendor/)
│   ├── linux/level0.md      One walkthrough per shipped level — 14 total as of v1.0.0
│   └── (etc., one per level)
├── tests/                   @playwright/test suite + OG-image generator
│   ├── playwright.config.cjs Per-spec parallelism config (v1.24.0+)
│   ├── lib/helpers.cjs      Shared dispatchCmd / bootAndWait / waitForOutput
│   ├── specs/*.spec.cjs     One spec file per track + cross-cutting suites
│   ├── generate-og-image.cjs Renders assets/og-template.html → og-image.png
│   ├── package.json         @playwright/test + chromium dependencies
│   └── package-lock.json
└── .github/
    └── workflows/           Azure SWA CI/CD — sharded playtest_job on push to main (v1.24.2+)
```

Adding a new level is a single object literal under `levels/<track>.js`. The base schema is documented at the top of `levels/linux.js`; per-track extensions (forensics' `evtxLogs`, osint's `github`, cloud's `postgres`, etc.) are documented at the top of each track's level file.

For deeper context on the engine architecture, command-dispatch model, and per-track conventions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

All seven tracks ship level0 + level1; Linux and Forensics now ship through level2 (v1.25.0 + v1.23.0). The next phase continues filling level2 across the remaining tracks. Every shipped level1 already leaks a breadcrumb credential staged for its level2; the credential-chain stays consistent track-to-track even as the level2 content gets built one track at a time. New levels land one PR at a time — see [CHANGELOG.md](CHANGELOG.md) for release history.

## About this project

D3CYPH3R is a cybersecurity learning tool. The puzzles teach defensive auditing skills in a safe sandbox — the techniques cited (MITRE ATT&CK, CWE, NIST 800-53, CIS Controls) are the same ones professional security teams use every day to *find* this kind of exposure on their own infrastructure. **Don't apply these techniques against systems you don't own or aren't authorized to test.** Unauthorized access is illegal in most jurisdictions (CFAA in the US, Computer Misuse Act in the UK, similar elsewhere).

**Privacy.** D3CYPH3R uses `sessionStorage` for progress tracking by default — close the tab and progress resets. `localStorage` is used for three items: your theme preference (v1.13.0), your command history (~50 entries for ↑/↓ recall), and — only if you explicitly opt in via the `progress save-on` command (v1.11.0) — a mirrored copy of session progress so it survives across browser sessions on the same device. A short-lived sessionStorage flag (v1.21.0) remembers if you've tapped "Continue anyway" on the mobile gate for the current tab. As of v1.20.0, the `save` command emits a portable progress code you can paste into any other browser via `restore <code>` — no account, no server, no telemetry. As of v1.21.0, a service worker caches static assets for offline play; the cache is namespaced per version and cleared by `sw clear`. No cookies, no analytics, no telemetry, no third-party scripts.

If you open DevTools on the live site you may see CSP errors blocking scripts from `static.cloudflareinsights.com` (a Cloudflare Web Analytics beacon) or `/cdn-cgi/challenge-platform/...` (Cloudflare's bot-detection script). Those are Cloudflare auto-injecting things onto the proxied domain — outside our direct control without changing CDN providers. Our `Content-Security-Policy: script-src 'self'` intentionally blocks them. **The errors are visible proof that the "no third-party scripts" claim is enforced by the browser, not just stated in this README.** A `console.info` line on page load points readers at this paragraph so they don't mistake the blocks for actual breakage.

## Commands implemented

See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `head` / `tail` / `stat` / `ps` / `diff` / `pwd` / `whoami` / `echo` / `grep` / `find` / `readlink` / `realpath` / `basename` / `dirname` / `env` / `history`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig` (+ `@server` / `-t TYPE` / `-x IP` / `+short` / `+trace` / `AXFR`)
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` / `jwt`
- **Web:** `curl` (+ `-X` / `-d` / `-H` / `-I` / `-L` / `-o` / `-kvs`) / `gobuster` (+ `-u` / `-w` / `-x` / `-t`) / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif` / `evtx` (+ `-id`) / `sqlite3` (read-only SQLite queries — `.tables`, `.schema`, SELECT with WHERE/LIKE/ORDER BY/LIMIT/COUNT) / `sha256sum` / `md5sum`
- **OSINT:** `sherlock` / `hibp` / `wayback` / `crtsh` / `theharvester` / `shodan` / `ipinfo` / `github` (+ `/repo` + `file <path>`)
- **Cloud:** `aws s3 ls` / `aws s3 cp` / `aws iam list-users` / `aws iam list-attached-user-policies` / `aws iam get-policy` / `aws ec2 describe-instances` / `aws ec2 describe-security-groups` / `aws sts get-caller-identity` / `psql` (+ `-d` / `\l` / `\dt` / `SELECT … FROM … [LIMIT N]`)
- **Text processing (pipe-friendly):** `wc` / `sort` / `uniq` / `cut` / `tr` / `awk` / `sed` (`s/pat/repl/[g]`, `-n 'Np'`) / `printf` / `jq` (`.path` queries, `-r` / `-c`)
- **System info:** `which` / `type` / `id` / `uname` / `date` / `uptime` / `hostname`
- **System inspection:** `crontab -l` / `last` / `who` / `w` / `lsof` / `ss` / `journalctl` / `systemctl status` / `dmesg` / `df` / `du` / `free`
- **Network inspection:** `ip addr` / `ip route` / `arp -a` / `ping` / `traceroute` / `nslookup` / `host` / `nc -zv`
- **Format inspection:** `openssl x509` / `openssl rand` / `openssl dgst` / `openssl enc -d` / `openssl s_client` / `tar tvf` / `tar xvf` / `gunzip` / `zcat`
- **Version control:** `git log` / `git show` / `git diff` / `git status` / `git blame` / `git config` / `git remote` / `git branch`
- **Crypto inspection:** `gpg --list-keys` / `gpg --verify` / `gpg --decrypt`
- **Read-only stubs** (sandbox-friendly errors): `chmod` / `chown` / `mv` / `cp` / `rm` / `mkdir` / `rmdir` / `touch` / `ln` / `sudo` / `su` / `useradd` / `passwd`
- **Learning aids:** `hint` (+ `reset` / `list`) / `man <cmd>` / `what-is <term>` / `walkthrough` / `progress` (+ `--detail` for bonus-find listing, v1.10.0; + `save-on` / `save-off` / `reset` for opt-in localStorage persistence, v1.11.0) / `tutorial` (+ `start` for the interactive walk-through, v1.12.0) / `achievements` (+ `--detail` for progress fractions, 20-achievement layer over bonus finds, v1.14.0) / `search <term>`
- **Stateless save/restore (v1.20.0):** `save` (emits a portable progress code) / `restore <code>` (validates + diffs + prompts) / `restore --preview <code>` (decodes without mutating)
- **PWA controls (v1.21.0):** `sw` (+ `status` / `update` / `clear`) inspects and controls the service worker / `reload` refreshes the page, applying any waiting SW update
- **Shell environment (v1.9.0):** `export` / `env` / `unset` / `set` / `FOO=bar` / `FOO=bar cmd` / `PS1` substitution (`\u`, `\h`, `\H`, `\w`, `\W`, `\$`)
- **Job control (v1.9.0):** `cmd &` / `jobs` / `fg` / `bg` / `kill` / `wait` / `disown`
- **Universal `--help` (v1.17.0):** every command responds to `--help` with a 3-5 line usage block + pointer to `man <cmd>` for full details
- **Shell:** `clear` / `help` / `report` / `ssh` / `exit` / `logout` / `tracks` (lobby tree expand/collapse, v1.10.0) / `tiers` (difficulty-tier legend, v1.10.0) / `themes` + `theme <name>` + `theme next`/`prev` (11-theme picker, v1.13.0)

The terminal supports a real bash-shaped composition layer (v1.8.0 + v1.9.0):

- Pipes: `cmd1 | cmd2 | cmd3`
- Chaining: `cmd1 && cmd2`, `cmd1 || cmd2`, `cmd1 ; cmd2`
- Background: `cmd &` (captured to job table; synchronous in this sandbox)
- Wildcards: `*.txt`, `log?`
- Brace expansion: `cat file{1,2,3}.txt`
- Shell variables: `$USER`, `$HOME`, `${VAR}`, `$$` (literal `$`)
- Writable env vars: `export FOO=bar`, `FOO=bar`, `unset FOO`
- Customizable prompt: `export PS1='> '` (PS1 escape codes: `\u`/`\h`/`\w`/`\$`)
- Multi-host pivot: `ssh user@internal-host` from inside a level, `exit` unwinds
- Last exit code: `$?`
- Command substitution: `$(cmd)`
- Quote-aware tokenization: `'single'` is literal, `"double"` expands vars
- Readline shortcuts: `Ctrl-A` / `Ctrl-E` / `Ctrl-W` / `Ctrl-U` / `Ctrl-K` / `Ctrl-Y` / `Alt-B` / `Alt-F` / `Alt-.`
- Persistent command history across tab sessions (localStorage)
- Replay mode: re-entering a solved level skips the password gate
- Bonus finds: optional discoverable nuggets surfaced in `progress`
- Typo suggestions: closest-match "Did you mean: `<cmd>`?" on unknown commands (v1.15.0)
- Per-level time tracking: total time + first-solve elapsed, surfaced in `progress --detail` and the connection banner on revisit (v1.16.0)
- Standardized `cmd --help` across every command — short usage block + pointer to `man <cmd>` (v1.17.0)
- Lobby polish for returning players: welcome-back summary, next-up suggestion, completion glyph on fully-cleared tracks, achievements teaser (v1.18.0)
- Lobby visual polish: chip-styled progress/tier badges in the engagement list, bolder bare-glyph chevrons (▼/▶/✓) replacing the bracketed `[▾]`/`[▸]`/`[✓]` (v1.19.0)
- Stateless progress codes: `save` generates a portable string encoding visited levels, achievements, bonus finds, per-level times, hint counters, theme, onboarding flag, lobby-expand state — a brand-new player's code is ~35 chars, a completionist's is ~180. `restore <code>` validates + diffs + prompts `[y/N]` before applying; `restore --preview <code>` decodes without changing anything. Same privacy posture as the rest of the engine — no server, no account (v1.20.0)
- Installable as a Progressive Web App: own dock icon, borderless window, works offline after first visit. `sw` command inspects the service worker; `reload` applies any pending PWA update. Mobile players can tap "Continue anyway" through the gate to play on phones, with a soft-key row above the on-screen keyboard for Tab / Esc / Ctrl-C / `|` / `&&` / `$` / `_` (v1.21.0)

The terminal also supports the shell features players carry in from bash:

- **Pipes** — `cmd1 | cmd2 | cmd3` runs left-to-right, threading stdout into stdin. `grep` / `head` / `tail` / `wc` / `sort` / `uniq` / `cut` / `tr` all read piped input.
- **Wildcards** — `*` (any chars except `/`) and `?` (single char). Works with `ls`, `cat`, `grep` (`ls *.md`, `cat *.txt`, `grep TODO *.log`).
- **Path resolution** — absolute paths (`/home/<user>/notes.txt`), home expansion (`~`, `~/foo`), chained parent refs (`../../bin`), all normalized.
- **Shell variables** — `$USER`, `$HOME`, `$HOSTNAME`, `$PWD`, `$PATH`, `$SHELL`, `${VAR}` bracketed form, `$$` escapes to literal `$`. Per-level `env_vars` extend the set.
- **Tab autocomplete** — completes command names on the first word; completes filesystem paths after a space (single match fills basename + `/` for dirs; multi-match fills the longest common prefix).

## Credit

D3CYPH3R's engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile (MIT-licensed). All level content in this repo is original.

## AI use disclosure

Claude (Anthropic) was used as a coding and writing assistant across this project — auditing code, running automated test playthroughs before each commit, drafting walkthrough markdown, and writing the technical documentation. **All level design is original to this project** — the Driftwood Systems setting, the recurring characters (Daniel, Priya, Theo, Marcus, Carlos, Marisol, Jordan, Aaron, Sloane, Lara), the per-track client engagements, the puzzle mechanics, and every narrative beat are authored by the project maintainer.

## License

MIT — see [LICENSE](LICENSE).
