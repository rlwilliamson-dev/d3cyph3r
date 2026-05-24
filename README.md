# D3CYPH3R

> **Play it live: https://www.d3cyph3r.com**

A browser-based terminal CTF for DevOps engineers, SREs, and SysAdmins learning cybersecurity. You play a new hire at **Driftwood Systems**, a mid-sized tech consulting firm with roughly 600 consultants spread across ~80 client engagements at any given time. Each level drops you on a real-feeling box you've inherited — a rolled-off consultant's laptop, a stale client engagement environment, a forgotten audit artifact, an alibi photograph submitted to in-house counsel — and asks you to find what got left exposed.

The puzzles stay close to what actually happens at consulting firms with rotating engagements and shared client access. The post-mortem at the end of each level pulls the thread out to the controls (NIST 800-53, NIST 800-171, CIS Controls v8, CIS AWS Foundations Benchmark, CWE), the techniques (MITRE ATT&CK), the regs that bite (GLBA, PCI-DSS, HIPAA, FERPA, CMMC, SOC 2, NAIC, NYDFS), and the certs (Security+, CySA+, PenTest+, CISSP, OSCP, CHFI, GCFE / GCFA, AWS Security Specialty, CCSP, CCSK) that cover this territory in the real world.

Recurring characters, recurring clients, recurring technical debt across levels.

This is **v0.13.0** — **the sixth level1 lands: `level1@cloud`. All seven tracks (Linux, Network, Crypto, Web, Forensics, OSINT, Cloud) now have level0 + level1 chains.** The v1.0 "Foundation" milestone criterion ("every track has at least level0 AND level1 playable") is met with this release; the dedicated v1.0.0 tag is held for a separate release. One new engine command this release — `psql`, a minimal PostgreSQL client (`\l` / `\dt` / `SELECT * FROM … [LIMIT N]`) for RDS-adjacent database-enumeration puzzles. 14 levels shipped across all 7 tracks. Each level introduces one new concept and drops the player into a different client engagement with a different compliance regime in scope:

| Track | Levels shipped | Client | Compliance |
|---|---|---|---|
| Linux | `level0@linux` ("Daniel's Last Day"), `level1@linux` ("The Backup Daniel Forgot") | Halton Bank | GLBA |
| Network | `level0@network` ("Atlas Health Perimeter Check"), `level1@network` ("The Map Marcus Didn't Mean to Share") | Atlas Health | HIPAA |
| Crypto | `level0@crypto` ("Theo's Safer API Key"), `level1@crypto` ("Theo's Signature That Wasn't") | Vesta Retail | PCI-DSS |
| Web | `level0@web` ("Meridian's Forgotten Backup Folder"), `level1@web` ("Carlos's Login Wall") | Meridian State University | FERPA |
| Forensics | `level0@forensics` ("Reed's Soccer Alibi"), `level1@forensics` ("What the Logs Saw") | Polaris Defense Systems | CMMC / NIST 800-171 |
| OSINT | `level0@osint` ("Veridian's Open Letter"), `level1@osint` ("Aaron's Weekend Project") | Veridian Analytics | HIPAA / HITRUST CSF |
| Cloud | `level0@cloud` ("Coverline's Twelfth Bucket"), `level1@cloud` ("The Migration Table Nobody Dropped") | Coverline Insurance | SOC 2 / NAIC / NYDFS / GLBA |

**The v1.0 "Foundation" milestone is now met** — all seven tracks have level0 + level1 shipped. The next phase is the v2.0 "Apprentice" milestone, which adds level2 across the tracks. Every level1 leaks a breadcrumb credential staged for its level2; the credential-chain registry is the source of truth for what each level2 will gate. New levels land one PR at a time. See [CHANGELOG.md](CHANGELOG.md) for release history.

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

Each track's `level0` is an entry point — no password, walks you through one new concept, and ends with a post-mortem citing the relevant CWE / framework / MITRE technique. After level0 of the Linux track, follow the credential breadcrumb in Daniel's home directory to `ssh level1@linux` and walk a client jumphost. After level0 of the Network track, follow the unrotated default credential to `ssh level1@network` and validate Atlas's internal blast radius via DNS zone transfer. After level0 of the Crypto track, the decoded base64 API key gates `ssh level1@crypto` — where you'll audit a homegrown JWT auth that accepts `alg:none` and find what's hiding in the access log. After level0 of the Web track, the leaked DB credential gates `ssh level1@web` — where Carlos's "SSO-is-enough" transcript endpoint demonstrates the difference between authentication and authorization. After level0 of the Forensics track, FSO Sgt. Chen's single-use handoff password gates `ssh level1@forensics` — where the new `evtx` command parses Reed's workstation Security event log and surfaces both his CUI-exfil chain and a separate credential-handling miss from the IR team's own response. After level0 of the OSINT track, Aaron Hines's recovered reused password gates `ssh level1@osint` — where the new `github` command walks his developer footprint and finds a personal-project repo with committed AWS credentials at HEAD that the `.gitignore` (added later) doesn't retroactively untrack. After level0 of the Cloud track, the hardcoded RDS master credential from the leaked migration script gates `ssh level1@cloud` — where the new `psql` command enumerates the production claims database and surfaces both an abandoned `migration_artifacts` table with a still-live broker-portal credential and an anomalous schema-enumeration query in the audit log.

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
    ├── forensics.js        Forensics track (2 levels)
    ├── osint.js            OSINT track (2 levels)
    └── cloud.js            Cloud track (2 levels)
```

Adding a new level is a single object literal under `levels/<track>.js`. The schema is documented at the top of `levels/linux.js`.

## v1.0 "Foundation" milestone status

**Met as of v0.13.0.** All seven tracks have level0 + level1 shipped. The next milestone is v2.0 "Apprentice" — level2 across the tracks. Every level1 leaks a breadcrumb credential staged for its level2; the credential-chain stays consistent track-to-track even as the level2 content gets built one track at a time.

## Commands implemented

All commands from the original engine survive the refactor, with `exit` / `logout` added for muscle memory. See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `head` / `tail` / `stat` / `ps` / `diff` / `pwd` / `whoami` / `echo` / `grep` / `find` / `env`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig` (+ `AXFR`)
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` / `jwt`
- **Web:** `curl` (+ `-I`) / `gobuster` / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif` / `evtx` (+ `-id`) / `sha256sum` / `md5sum`
- **OSINT:** `sherlock` / `hibp` / `wayback` / `crtsh` / `theharvester` / `shodan` / `ipinfo` / `github` (+ `/repo` + `file <path>`)
- **Cloud:** `aws s3 ls` / `aws s3 cp` / `aws iam list-users` / `aws iam list-attached-user-policies` / `aws iam get-policy` / `aws ec2 describe-instances` / `aws ec2 describe-security-groups` / `aws sts get-caller-identity` / `psql` (+ `-d` / `\l` / `\dt` / `SELECT … FROM … [LIMIT N]`)
- **Shell:** `clear` / `help` / `report` / `ssh` / `exit` / `logout`

## Credit

D3CYPH3R's engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile (MIT-licensed). All level content in this repo is original.

## License

MIT — see [LICENSE](LICENSE).
