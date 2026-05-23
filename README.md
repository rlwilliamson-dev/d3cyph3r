# D3CYPH3R

> **Play it live: https://www.d3cyph3r.com**

A browser-based terminal CTF for DevOps engineers, SREs, and SysAdmins learning cybersecurity. You play a new hire at **Driftwood Systems**, a mid-sized tech consulting firm with roughly 600 consultants spread across ~80 client engagements at any given time. Each level drops you on a real-feeling box you've inherited — a rolled-off consultant's laptop, a stale client engagement environment, a forgotten audit artifact, an alibi photograph submitted to in-house counsel — and asks you to find what got left exposed.

The puzzles stay close to what actually happens at consulting firms with rotating engagements and shared client access. The post-mortem at the end of each level pulls the thread out to the controls (NIST 800-53, NIST 800-171, CIS Controls v8, CIS AWS Foundations Benchmark, CWE), the techniques (MITRE ATT&CK), the regs that bite (GLBA, PCI-DSS, HIPAA, FERPA, CMMC, SOC 2, NAIC, NYDFS), and the certs (Security+, CySA+, PenTest+, CISSP, OSCP, CHFI, GCFE / GCFA, AWS Security Specialty, CCSP, CCSK) that cover this territory in the real world.

Recurring characters, recurring clients, recurring technical debt across levels.

This is **v0.7.7** — **all 7 engagement slots playable, all 7 level0s have published walkthroughs (hidden pre-v1.0), and the first level1 walkthrough lands.** 8 levels shipped across all 7 tracks. Each level introduces one new concept and drops the player into a different client engagement with a different compliance regime in scope:

| Track | Levels shipped | Client | Compliance |
|---|---|---|---|
| Linux | `level0@linux` ("Daniel's Last Day"), `level1@linux` ("The Backup Daniel Forgot") | Halton Bank | GLBA |
| Network | `level0@network` ("Atlas Health Perimeter Check") | Atlas Health | HIPAA |
| Crypto | `level0@crypto` ("Theo's Safer API Key") | Vesta Retail | PCI-DSS |
| Web | `level0@web` ("Meridian's Forgotten Backup Folder") | Meridian State University | FERPA |
| Forensics | `level0@forensics` ("Reed's Soccer Alibi") | Polaris Defense Systems | CMMC / NIST 800-171 |
| OSINT | `level0@osint` ("Veridian's Open Letter") | Veridian Analytics | HIPAA / HITRUST CSF |
| Cloud | `level0@cloud` ("Coverline's Twelfth Bucket") | Coverline Insurance | SOC 2 / NAIC / NYDFS / GLBA |

The next phase is level1 across the tracks — five tracks have their breadcrumb credentials staged from level0 and are waiting on level1 content. New levels land one PR at a time. See [CHANGELOG.md](CHANGELOG.md) for release history.

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
guest@d3cyph3r:~$ ssh level0@linux        # File reading / credential hunting
guest@d3cyph3r:~$ ssh level0@network      # Port scanning / perimeter audit
guest@d3cyph3r:~$ ssh level0@crypto       # Encoding ≠ encryption
guest@d3cyph3r:~$ ssh level0@web          # HTTP directory enumeration
guest@d3cyph3r:~$ ssh level0@forensics    # EXIF metadata / insider-threat
```

Each track's `level0` is an entry point — no password, walks you through one new concept, and ends with a post-mortem citing the relevant CWE / framework / MITRE technique. After level0 of the Linux track, follow the credential breadcrumb in Daniel's home directory to `ssh level1@linux` and walk a client jumphost.

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
    ├── linux.js            Linux track (2 levels)
    ├── network.js          Network track (1 level)
    ├── crypto.js           Crypto track (1 level)
    ├── web.js              Web track (1 level)
    ├── forensics.js        Forensics track (1 level)
    ├── osint.js            OSINT track (engine ready; no levels yet)
    └── cloud.js            Cloud track (engine ready; no levels yet)
```

Adding a new level is a single object literal under `levels/<track>.js`. The schema is documented at the top of `levels/linux.js`.

## Tracks scaffolded but no levels yet

Both the **OSINT** and **Cloud** tracks have their command surfaces shipped (see "Commands implemented" below) but no level data yet. The next level0 for either track can land as pure content — no further engine work needed.

The lobby auto-detects which tracks have level data and only lists those, so adding the first level0 for OSINT or Cloud will automatically un-dim their `help` sections and add them to the engagement list.

## Commands implemented

All commands from the original engine survive the refactor, with `exit` / `logout` added for muscle memory. See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `head` / `tail` / `stat` / `ps` / `diff` / `pwd` / `whoami` / `echo` / `grep` / `find` / `env`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig`
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` / `jwt`
- **Web:** `curl` (+ `-I`) / `gobuster` / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif` / `sha256sum` / `md5sum`
- **OSINT:** `sherlock` / `hibp` / `wayback` / `crtsh` / `theharvester` / `shodan` / `ipinfo`
- **Cloud:** `aws s3 ls` / `aws s3 cp` / `aws iam list-users` / `aws iam list-attached-user-policies` / `aws iam get-policy` / `aws ec2 describe-instances` / `aws ec2 describe-security-groups` / `aws sts get-caller-identity`
- **Shell:** `clear` / `help` / `report` / `ssh` / `exit` / `logout`

## Credit

D3CYPH3R's engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile (MIT-licensed). All level content in this repo is original.

## License

MIT — see [LICENSE](LICENSE).
