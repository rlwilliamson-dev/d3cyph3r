# D3CYPH3R

> **Play it live: https://www.d3cyph3r.com**

A browser-based terminal CTF for DevOps engineers, SREs, and SysAdmins learning cybersecurity. You play a new hire at **Driftwood Systems**, a mid-sized tech consulting firm with roughly 600 consultants spread across ~80 client engagements at any given time. Each level drops you on a real-feeling box you've inherited — a rolled-off consultant's laptop, a stale client engagement environment, a forgotten audit artifact, an alibi photograph submitted to in-house counsel — and asks you to find what got left exposed.

The puzzles stay close to what actually happens at consulting firms with rotating engagements and shared client access. The post-mortem at the end of each level pulls the thread out to the controls (NIST 800-53, NIST 800-171, CIS Controls v8, CIS AWS Foundations Benchmark, CWE), the techniques (MITRE ATT&CK), the regs that bite (GLBA, PCI-DSS, HIPAA, FERPA, CMMC, SOC 2, NAIC, NYDFS), and the certs (Security+, CySA+, PenTest+, CISSP, OSCP, CHFI, GCFE / GCFA, AWS Security Specialty, CCSP, CCSK) that cover this territory in the real world.

Recurring characters, recurring clients, recurring technical debt across levels.

All seven tracks (Linux, Network, Crypto, Web, Forensics, OSINT, Cloud) ship level0 + level1 chains playable end-to-end — 14 levels across all 7 tracks. Each level introduces one new concept and drops the player into a different client engagement with a different compliance regime in scope:

| Track | Levels shipped | Client | Compliance |
|---|---|---|---|
| Linux | `level0@linux` ("Daniel's Last Day"), `level1@linux` ("The Backup Daniel Forgot") | Halton Bank | GLBA |
| Network | `level0@network` ("Atlas Health Perimeter Check"), `level1@network` ("The Map Marcus Didn't Mean to Share") | Atlas Health | HIPAA |
| Crypto | `level0@crypto` ("Theo's Safer API Key"), `level1@crypto` ("Theo's Signature That Wasn't") | Vesta Retail | PCI-DSS |
| Web | `level0@web` ("Meridian's Forgotten Backup Folder"), `level1@web` ("Carlos's Login Wall") | Meridian State University | FERPA |
| Forensics | `level0@forensics` ("Reed's Soccer Alibi"), `level1@forensics` ("What the Logs Saw") | Polaris Defense Systems | CMMC / NIST 800-171 |
| OSINT | `level0@osint` ("Veridian's Open Letter"), `level1@osint` ("Aaron's Weekend Project") | Veridian Analytics | HIPAA / HITRUST CSF |
| Cloud | `level0@cloud` ("Coverline's Twelfth Bucket"), `level1@cloud` ("The Migration Table Nobody Dropped") | Coverline Insurance | SOC 2 / NAIC / NYDFS / GLBA |

## Running it locally

ES modules need an HTTP origin, so opening `index.html` via `file://` won't work. From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or use any other static server (`npx serve`, `live-server`, etc.).

D3CYPH3R is **desktop-only**. Mobile devices get an intentionally rude "device not supported" gate — the terminal-input model needs a real keyboard.

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

The lobby (`guest@d3cyph3r`) auto-detects which tracks have shipped levels and only lists those; type `help` inside any level for the full command reference.

## Walkthroughs

Each level ships with a long-form companion walkthrough under the `/walkthroughs/` subsite:

```
https://www.d3cyph3r.com/walkthroughs/
```

The walkthroughs (~7,000 words each, 9 sections) cover the solve path, the vulnerability class in depth, real-world parallels (Uber 2014 / Optus 2022 / Toyota 2022 / SolarWinds / MOVEit / Snowflake, etc.), framework + cert tie-ins (SOC 2 / NIST / NAIC / NYDFS / GLBA / OWASP / CIS / CWE), MITRE ATT&CK mapping, defender-action recommendations, and curated further reading. They're spoiler-bearing — only read a walkthrough after solving the level.

The subsite is excluded from search-engine indexing (`robots.txt`) and uses hash-based routing so direct walkthrough URLs are bookmarkable.

## How it's organized

```
d3cyph3r/
├── index.html               Entry point — boots the engine
├── 404.html                 Themed 404 page (Azure SWA fallback)
├── style.css                Dark terminal theme
├── favicon.svg              D3CYPH3R favicon
├── og-image.png             Open Graph preview image (1200×630)
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
│   ├── main.js              Boots the app, runs mobile gate
│   ├── mobile-gate.js       Desktop-only "device not supported" screen
│   ├── terminal/            Output, input, cursor, clock, DOM refs
│   │   ├── clock.js         Top-bar clock tick
│   │   ├── dom.js           Cached DOM-element references
│   │   ├── input.js         Keystroke handling + Tab autocomplete + history
│   │   └── output.js        Print-to-terminal helpers + CSS classes
│   ├── engine/              Game state, SSH, lobby, dispatch
│   │   ├── state.js         Live bindings (currentLevelKey, currentPath, ...)
│   │   ├── execute.js       Per-Enter dispatch (echo → ssh → commands)
│   │   ├── ssh.js           Connect / disconnect / password-prompt flow
│   │   ├── lobby.js         Lobby render + first-visit onboarding
│   │   ├── tracks.js        Track metadata (track key → display name, etc.)
│   │   ├── progress.js      sessionStorage persistence (visited levels)
│   │   ├── expand.js        Shell variable expansion ($USER, $HOME, ${VAR}, $$)
│   │   └── version.js       Canonical VERSION + release checklist comment
│   ├── commands/            One file per track + a shell-builtins file
│   │   ├── index.js         Assembles COMMANDS map from per-track modules
│   │   ├── linux.js         ls / cd / cat / grep / find / ps / …
│   │   ├── network.js       nmap / netstat / whois / dig
│   │   ├── crypto.js        base64 / rot13 / xxd / john / xor / jwt / …
│   │   ├── web.js           curl / gobuster / cookies
│   │   ├── forensics.js     file / strings / exif / evtx / sha256sum / …
│   │   ├── osint.js         sherlock / hibp / wayback / crtsh / github / …
│   │   ├── cloud.js         aws (s3/iam/ec2/sts) + psql
│   │   ├── text.js          wc / sort / uniq / cut / tr / awk (pipe-friendly)
│   │   ├── system.js        which / type / id / uname / date / uptime / hostname
│   │   ├── learning.js      hint / man / what-is (player self-help layer)
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
│   ├── linux.js             Linux track (level0 + level1) — Halton Bank / GLBA
│   ├── network.js           Network track (level0 + level1) — Atlas Health / HIPAA
│   ├── crypto.js            Crypto track (level0 + level1) — Vesta Retail / PCI-DSS
│   ├── web.js               Web track (level0 + level1) — Meridian State U / FERPA
│   ├── forensics.js         Forensics track (level0 + level1) — Polaris DS / CMMC
│   ├── osint.js             OSINT track (level0 + level1) — Veridian / HIPAA + HITRUST
│   └── cloud.js             Cloud track (level0 + level1) — Coverline / SOC 2 + NAIC
├── walkthroughs/            Long-form solve guides (separate subsite)
│   ├── index.html           Walkthrough reader shell
│   ├── walkthrough.css      Docs-reader theme (distinct from main terminal)
│   ├── walkthrough.js       Hash router + markdown renderer (vendored marked.js)
│   ├── vendor/marked.js     Markdown → HTML library (CC-BY-3.0 attribution in vendor/)
│   ├── linux/level0.md      One walkthrough per shipped level — 14 total as of v1.0
│   └── (etc., one per level)
├── tests/                   Playwright playtest + OG-image generator
│   ├── playtest.cjs         Headless playthrough of every shipped level (412 assertions)
│   ├── generate-og-image.cjs Renders assets/og-template.html → og-image.png
│   ├── package.json         playwright + chromium dependencies
│   └── package-lock.json
└── .github/
    └── workflows/           Azure SWA CI/CD — runs playtest_job on every PR
```

Adding a new level is a single object literal under `levels/<track>.js`. The base schema is documented at the top of `levels/linux.js`; per-track extensions (forensics' `evtxLogs`, osint's `github`, cloud's `postgres`, etc.) are documented at the top of each track's level file.

For deeper context on the engine architecture, command-dispatch model, and per-track conventions, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Roadmap

All seven tracks ship level0 + level1 today. The next phase adds level2 across the tracks. Every level1 already leaks a breadcrumb credential staged for its level2; the credential-chain stays consistent track-to-track even as the level2 content gets built one track at a time. New levels land one PR at a time — see [CHANGELOG.md](CHANGELOG.md) for release history.

## About this project

D3CYPH3R is a cybersecurity learning tool. The puzzles teach defensive auditing skills in a safe sandbox — the techniques cited (MITRE ATT&CK, CWE, NIST 800-53, CIS Controls) are the same ones professional security teams use every day to *find* this kind of exposure on their own infrastructure. **Don't apply these techniques against systems you don't own or aren't authorized to test.** Unauthorized access is illegal in most jurisdictions (CFAA in the US, Computer Misuse Act in the UK, similar elsewhere).

**Privacy.** D3CYPH3R uses `sessionStorage` for progress tracking and `localStorage` for one item only — your theme preference (dark or light). No cookies, no analytics, no telemetry, no third-party scripts. Closing the tab clears progress; theme preference survives across sessions because that's what people expect from a theme toggle.

If you open DevTools on the live site you may see CSP errors blocking scripts from `static.cloudflareinsights.com` (a Cloudflare Web Analytics beacon) or `/cdn-cgi/challenge-platform/...` (Cloudflare's bot-detection script). Those are Cloudflare auto-injecting things onto the proxied domain — outside our direct control without changing CDN providers. Our `Content-Security-Policy: script-src 'self'` intentionally blocks them. **The errors are visible proof that the "no third-party scripts" claim is enforced by the browser, not just stated in this README.** A `console.info` line on page load points readers at this paragraph so they don't mistake the blocks for actual breakage.

## Commands implemented

See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `head` / `tail` / `stat` / `ps` / `diff` / `pwd` / `whoami` / `echo` / `grep` / `find` / `readlink` / `realpath` / `env`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig` (+ `AXFR`)
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` / `jwt`
- **Web:** `curl` (+ `-I`) / `gobuster` / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif` / `evtx` (+ `-id`) / `sha256sum` / `md5sum`
- **OSINT:** `sherlock` / `hibp` / `wayback` / `crtsh` / `theharvester` / `shodan` / `ipinfo` / `github` (+ `/repo` + `file <path>`)
- **Cloud:** `aws s3 ls` / `aws s3 cp` / `aws iam list-users` / `aws iam list-attached-user-policies` / `aws iam get-policy` / `aws ec2 describe-instances` / `aws ec2 describe-security-groups` / `aws sts get-caller-identity` / `psql` (+ `-d` / `\l` / `\dt` / `SELECT … FROM … [LIMIT N]`)
- **Text processing (pipe-friendly):** `wc` (+ `-l` / `-w` / `-c`) / `sort` (+ `-n` / `-r` / `-u`) / `uniq` (+ `-c` / `-d` / `-u`) / `cut` (+ `-d <delim>` / `-f <fields>`) / `tr` (+ `-d` / `-s`) / `awk` (`'{print $N}'`, `'/pat/ {print $N}'`, `-F SEP`)
- **System info:** `which` / `type` / `id` / `uname` (+ `-a` / `-s` / `-n` / `-r` / `-v` / `-m`) / `date` / `uptime` / `hostname`
- **Learning aids:** `hint` (+ `reset` / `list`) / `man <cmd>` / `what-is <term>`
- **Shell:** `clear` / `help` / `report` / `ssh` / `exit` / `logout`

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
