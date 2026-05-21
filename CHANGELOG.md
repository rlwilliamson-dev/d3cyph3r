# Changelog

All notable changes to D3CYPH3R are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Headless Playwright playtest (`tests/playtest.cjs`) running 30 end-to-end
  checks against `level0@linux` — lobby render, ssh transitions, `ls` / `cat`
  / tab completion / history, `exit` and `logout` flows, no console errors.
- Gating in the Azure Static Web Apps workflow: the deploy job now declares
  `needs: playtest_job`, so a failing playtest blocks production.
- SVG favicon — `>_` glyph in `--green` on `--bg`, matching the lobby's
  success styling and progress bar.
- Open Graph and Twitter Card meta tags so links unfurl in Slack, Discord,
  iMessage, and Twitter with a title and description. Text-only for now;
  `og:image` will land in a follow-up.
- `<meta name="description">` and `<meta name="theme-color">` for basic SEO
  and mobile-chrome theming.

### Changed

- Lobby home screen rewritten with a lore-forward Driftwood Systems
  welcome (first-visit only). The persistent `AVAILABLE TRACKS` heading
  is now `AVAILABLE ENGAGEMENTS`. The tagline line and `START HERE` /
  `YOUR GOAL` onboarding blocks are reframed as `WELCOME TO DRIFTWOOD
  SYSTEMS` and `FIRST ASSIGNMENT`. Auto-detection of available tracks
  from the `LEVELS` map is unchanged.
- `<title>` lengthened from "D3CYPH3R" to
  "D3CYPH3R — Terminal CTF for infrastructure people" so link previews and
  search-result snippets carry the tagline.
- Workflow tooling: `actions/checkout` v3 → v6, Node 24 pinned via
  `actions/setup-node@v6` (Node 20 is being deprecated on GitHub runners).
- Playtest assertions updated to match the new lobby copy; one new check
  (Driftwood welcome appears on first visit) brings the suite to 31.

## [0.1.0] - 2026-05-21

Initial public release. The engine is complete; one Linux level ships with it.

### Added

- Lobby ↔ level model keyed by `"<user>@<host>"` strings, with `ssh` and
  password-gated entry.
- Seven track slots wired into the lobby (Linux, Network, Crypto, Web,
  Forensics, OSINT, Cloud); the lobby auto-detects which have level data.
- `level0@linux` — "Daniel's Last Day," an offboarded contractor's home
  directory full of credentials they shouldn't have left behind.
- Commands across the engine: `ls` / `cd` / `cat` / `pwd` / `whoami` /
  `echo` / `grep` / `find` / `env` / `nmap` / `netstat` / `whois` / `dig` /
  `base64` / `rot13` / `xxd` / `decode-hex` / `hash-id` / `john` / `xor` /
  `curl` / `gobuster` / `cookies` / `file` / `strings` / `exif` /
  `clear` / `help` / `report` / `ssh` / `exit` / `logout`.
- Terminal niceties: tab completion with inline hint, ArrowUp/ArrowDown
  command history, CRT-style theme, fake kernel boot sequence.
- Desktop-only gate — touch devices get an intentionally rude rejection
  screen since the input model needs a real keyboard.
- Deployment to [www.d3cyph3r.com](https://www.d3cyph3r.com) via Azure
  Static Web Apps with GitHub Actions auto-deploy on push to `main`.

[Unreleased]: https://github.com/rlwilliamson-dev/d3cyph3r/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/rlwilliamson-dev/d3cyph3r/releases/tag/v0.1.0
