# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

No build, no package.json, no tests. Pure static ES modules served over HTTP:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

ES module imports fail under `file://` — a server is required. Desktop-only by design; `js/mobile-gate.js` renders a rejection screen for touch devices.

State persistence (visited levels, onboarding flag) uses `sessionStorage`, so a tab close resets progress. Clear it via DevTools to re-test the first-visit lobby.

## Architecture

**Lobby ↔ level model.** The entire game is a map of "levels" keyed by `"<user>@<host>"` strings (e.g. `"level0@linux"`, `"guest@d3cyph3r"`). `guest@d3cyph3r` is the lobby — the user lands there at boot and returns there between tracks. Switching levels is modelled as `ssh user@host` (see `js/engine/ssh.js`); levels with a `password` field gate entry behind a masked prompt.

**Two parallel registries, both keyed by track.** Adding a track requires touching both:

- **Level data**: `levels/<track>.js` exports a `<track>Levels` object → imported and spread into `LEVELS` in `levels/index.js`.
- **Commands**: `js/commands/<track>.js` exports a `<track>Commands` object → imported and spread into `COMMANDS` in `js/commands/index.js`.

The lobby's "AVAILABLE TRACKS" list (`js/engine/lobby.js`) is the third place — it filters its hard-coded track list by whether any level with that `track` field exists. So adding a track also means adding it to the `tracks` array in `lobby.js`, otherwise the new track won't appear in the lobby even after data exists.

**Filesystem dual representation.** Level content lives as a nested tree under `level.fs` (dirs with `children`, files with `content`). At module init, `js/fs/flatten.js#initLevels` walks every level's `fs` tree and produces a flat `level.files` map (`"path/to/file": "contents"`, dirs as `"path/": null`). Most newer commands (`ls`, `cd`, `cat`) read the tree; legacy/cross-cutting commands (`grep`, `find`, `base64`, `xxd`, etc.) read the flat map. When adding new commands, prefer the tree via `getFSNode(level, pathParts)` for cwd-aware behavior; reach for `level.files` only when you genuinely need a flat enumeration.

**Engine state lives in one module.** `js/engine/state.js` exports `currentLevelKey`, `currentPath`, `awaitingPassword` as live bindings, plus `setX` functions. ES module live bindings let importers *read* the current value, but only the owning module can reassign — so every write goes through a setter. Don't try to mutate these from outside the module.

**Command dispatch.** `js/engine/execute.js` is the single dispatcher called per Enter press. Order: echo the line → password mode (route to `handlePasswordInput`) → `ssh` (route to `handleSSH`) → `COMMANDS[cmd]` lookup → "command not found". Each command handler has the signature `(level, arg) → { text, cls } | null`. Returning `null` suppresses output; otherwise the dispatcher prints with the given CSS class (`out`, `err`, `dim`, `warn`, `success`, `info`, `cmd`, `ascii`, `banner`).

**Boot order matters.** `js/main.js` short-circuits on mobile *before* importing engine modules (dynamic `await import()`), so the engine never executes on mobile. On desktop the order is: command set → input handlers → clock → boot. `boot()` prints the fake kernel sequence and then `connectTo("guest@d3cyph3r")` drops the user into the lobby.

## Conventions when editing levels

The schema for a level entry is documented at the top of `levels/linux.js` — read it before adding levels. Key points: `password` is the password required to *enter* this level (set by the previous level's content, `null` for the first level in a track); `track` must match one of the keys the lobby knows about; the nested `fs` tree is the source of truth and the flat `files` map is generated.

Continuity matters: all current levels are set at "Driftwood Systems," a fictional consulting firm. Recurring characters and clients carry across levels. When adding levels, preserve the worldbuilding rather than introducing isolated, generic scenarios.

## Known placeholder

`js/commands/shell.js` has `YOUR_USERNAME` in the `report` command's GitHub issues URL — a fork-time placeholder, not a bug.
