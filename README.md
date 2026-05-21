# D3CYPH3R

A browser-based terminal CTF training game. You ssh into simulated boxes, run real-feeling commands (`ls`, `grep`, `nmap`, `john`, `curl`, `strings` ...) and find the password hidden in each scenario.

This is **v0.1** — the engine is complete and one demo level (`level0@linux`) is shipped. New tracks and levels land one at a time.

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

All commands from the original engine survive the refactor. See `help` inside the terminal for the full reference. Track-by-track:

- **Linux:** `ls` / `cd` / `cat` / `pwd` / `whoami` / `echo` / `grep` / `find` / `env`
- **Network:** `nmap` (+ `-sV`) / `netstat` / `whois` / `dig`
- **Crypto:** `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor`
- **Web:** `curl` (+ `-I`) / `gobuster` / `cookies`
- **Forensics:** `file` (+ `*`) / `strings` / `exif`
- **Shell:** `clear` / `help` / `report` / `ssh`

## Customizing the `report` command

`js/commands/shell.js` has a `YOUR_USERNAME` placeholder for the GitHub issues URL. Replace it with your GitHub handle once you push the repo.

## Credit

D3CYPH3R's engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile (MIT-licensed). All level content in this repo is original.

## License

MIT — see [LICENSE](LICENSE).
