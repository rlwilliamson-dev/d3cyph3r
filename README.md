# D3CYPH3R

A browser-based terminal CTF for DevOps engineers, SREs, and SysAdmins learning cybersecurity. You play a new hire at **Driftwood Systems**, a mid-sized tech consulting firm with roughly 600 consultants spread across ~80 client engagements at any given time. Each level drops you on a real-feeling box you've inherited — a rolled-off consultant's laptop, a stale client engagement environment, a forgotten audit artifact — and asks you to find what got left exposed.

The puzzles stay close to what actually happens at consulting firms with rotating engagements and shared client access. The post-mortem at the end of each level pulls the thread out to the controls (NIST 800-53, CIS Controls v8, CWE), the techniques (MITRE ATT&CK), the regs that bite (GLBA, PCI-DSS, HIPAA when relevant), and the certs (Security+, CISSP, OSCP) that cover this territory in the real world.

Recurring characters, recurring clients, recurring technical debt across levels.

This is **v0.1** — engine complete, one Linux level (`level0@linux`) shipped. New levels and tracks land one PR at a time. See [CHANGELOG.md](CHANGELOG.md) for release history.

## Running it locally

ES modules need an HTTP origin, so opening `index.html` via `file://` won't work. From the project root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Or use any other static server (`npx serve`, `live-server`, etc.).

D3CYPH3R is **desktop-only**. Mobile devices get an intentionally rude "device not supported" gate — the terminal-input model needs a real keyboard.

## What you can do today

```
guest@d3cyph3r:~$ ssh level0@linux
```

That drops you into the demo scenario — an offboarded contractor's home directory, full of credentials they shouldn't have left behind. Use `ls` and `cat` to find them.

## How it's organized

```
d3cyph3r/
├── index.html              Entry point
├── style.css               CRT terminal theme
├── js/
│   ├── main.js             Boots the app, runs mobile gate
│   ├── mobile-gate.js      Desktop-only "device not supported" screen
│   ├── terminal/           Output, input, cursor, clock, DOM refs
│   ├── engine/             Game state, SSH, lobby, progress, dispatch
│   ├── commands/           One file per track — linux, network, crypto, …
│   ├── fs/                 Filesystem tree walker + path resolver
│   └── util/               Pure helpers — rot13, hex, …
└── levels/
    ├── index.js            Registers tracks → LEVELS map
    └── linux.js            Linux track data (currently 1 level)
```

Adding a new level is a single object literal under `levels/<track>.js`. The schema is documented at the top of `levels/linux.js`.

## Adding tracks (planned)

The engine already supports seven tracks out of the box (Linux, Network, Crypto, Web, Forensics, OSINT, Cloud) — the lobby auto-detects which ones have level data and only lists those. To add a new track, drop a `levels/<track>.js` file, import it into `levels/index.js`, and add an entry to the `tracks` array in `js/engine/lobby.js`.

OSINT and Cloud will need new simulated commands added under `js/commands/`. Wire them into `js/commands/index.js`.

## Commands implemented

All commands from the original engine survive the refactor, with `exit` / `logout` added for muscle memory. See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `pwd` / `whoami` / `echo` / `grep` / `find` / `env`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig`
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor`
- **Web:** `curl` (+ `-I`) / `gobuster` / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif`
- **Shell:** `clear` / `help` / `report` / `ssh` / `exit` / `logout`

## Credit

D3CYPH3R's engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile (MIT-licensed). All level content in this repo is original.

## License

MIT — see [LICENSE](LICENSE).
