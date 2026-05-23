# D3CYPH3R Walkthroughs — author guide

This directory hosts the **walkthroughs subsite**: long-form study
companions for D3CYPH3R levels. Hidden behind URL obscurity until
v1.0 ships; meant to be the canonical destination for "I solved
this level, now teach me everything around it."

Read this file before writing a walkthrough.

## How it's served

```
walkthroughs/
├── index.html              Shell page (loads on every URL).
├── walkthrough.css         Clean docs reader theme.
├── walkthrough.js          Hash-router + markdown renderer.
├── vendor/marked.esm.min.js  Vendored markdown parser (CSP-safe).
├── README.md               This file (not rendered).
└── <track>/
    └── <level>.md          One markdown file per walkthrough.
```

Routing is hash-based — `/walkthroughs/#/<track>/<level>` — so no
server-side configuration is needed. The shell page parses the hash
and fetches the matching `.md` file at runtime.

Whenever a new walkthrough lands, update the `MANIFEST` constant at
the top of `walkthrough.js` so the index and track-listing pages
know it exists.

## Anti-spoiler posture

Walkthroughs are the **only** D3CYPH3R surface where spoilers belong.
Passwords, breadcrumb credentials, full solve paths — everything goes
in. The reader is here because they've solved the level (or has
chosen to peek). The spoiler-warning callout at the top of every
walkthrough makes that choice explicit.

The walkthroughs subsite is itself **secret pre-v1.0** — do not link
to it from the main site, the README, the CHANGELOG, release notes,
or any social-share copy until v1.0 ships. `robots.txt` and the
`noindex` meta keep search engines out.

## The 10-section template

Every walkthrough follows the same structure. Use
`walkthroughs/linux/level0.md` as the reference; copy-paste its
section dividers when starting a new file.

| § | Section                | Purpose                                                                  |
|---|------------------------|--------------------------------------------------------------------------|
| 1 | Spoiler warning        | A blockquote starting with `⚠` — auto-styled as a red callout            |
| 2 | The setup (in-world)   | Driftwood + client + character context. Sets the stage                   |
| 3 | The solve (mechanical) | Step-by-step commands with outputs. Include "If you got stuck" sub-note  |
| 4 | The vulnerability      | Name the stacked failures. Why each is independently a finding           |
| 5 | Real-world parallels   | 2–3 named, well-documented incidents. Include the *response* angle       |
| 6 | Framework deep dive    | Every NIST/CWE/MITRE/regulation cited in the in-game post-mortem         |
| 7 | Cert exam relevance    | Equal-depth treatment of every cert cited. Sample exam-question framings |
| 8 | What a defender does   | Concrete tools, sample detection rules, audit evidence                   |
| 9 | Key takeaways          | 3–5 bullet study-guide summary                                           |
| 10 | Further reading       | Primary sources, vendor docs, books — links only, no commentary needed   |

### Section formatting

- Use `##` for the section title (e.g. `## §3 — The solve`).
- Use `###` for subsections.
- Code blocks: triple-backtick fenced, with `bash` or `text` language
  tag. Terminal sessions use `bash`.
- Inline code for commands, file paths, control IDs (e.g. `AC-2`).
- External links open in a new tab automatically.

## Voice

- **Second person**, breaking the fourth wall. *"You logged in as
  Daniel because his account was never disabled."*
- The in-world frame (Driftwood, recurring characters) is preserved
  as context in §2; the rest of the walkthrough pulls back to the
  meta layer and addresses the reader as a student.
- Tone: confident, mildly opinionated, never preachy. The same voice
  as the in-game `lessons-learned.md` files, just longer.

## Sourcing rules for real-world parallels (§5)

- Cite **named, well-documented incidents** — SEC filings, court
  documents, vendor post-mortems, mainstream press of record.
- No invented breaches, no anonymized "a major retailer in 2019."
- Include enough detail that a reader can verify the parallel: dated
  references, primary-source links in §10.
- Three is the sweet spot. Two is the minimum. Four+ becomes a list,
  which dilutes the lesson.

## Sourcing rules for framework citations (§6)

- Each control gets:
  - The exact control identifier (e.g. `NIST SP 800-53 Rev 5 AC-2(13)`)
  - A faithful summary of what the control requires (not a quote — the
    full text is copyrighted in some cases; a summary is safer)
  - What audit evidence proves the control is in place
  - Common failure modes auditors actually flag
- Aim for 2–4 paragraphs per control. Anything less than 2 isn't a
  deep dive; anything more than 4 is over-elaborated.

## Sourcing rules for cert exam relevance (§7)

- **Equal depth for every cert cited** in the in-game post-mortem.
- For each cert: name the current exam version (e.g. Security+
  SY0-701 — CompTIA refreshes objectives every 3 years), the
  objective number, and a *sample question framing* (paraphrased
  CompTIA-style, not a verbatim exam question).
- Skip the cert if its connection to the level is genuinely tenuous,
  but explain in a comment why it was skipped.

## Length expectations

- Total walkthrough: **6,000–8,000 words**.
- §6 (frameworks) and §7 (certs) are typically the longest sections,
  each running 1,500–2,500 words depending on how many citations the
  in-game post-mortem made.
- Writing time: realistically 3–5 hours of focused work per
  walkthrough, including fact-checking real-world parallels and
  verifying exam objective numbers against current cert blueprints.

## Pre-merge checklist for a new walkthrough

- [ ] Markdown file at `walkthroughs/<track>/<level>.md`
- [ ] `MANIFEST` in `walkthrough.js` updated with `title` and `blurb`
- [ ] Spoiler warning is the first content block (starts with `⚠`)
- [ ] Every framework/cert cited in the in-game `lessons-learned.md`
      has a corresponding subsection
- [ ] Real-world parallels are linked in §10
- [ ] No raw HTML in the markdown — pure markdown only
- [ ] Locally rendered via `python3 -m http.server` and visually
      reviewed for layout issues
- [ ] Anti-spoiler exception: walkthrough is allowed to contain
      passwords / breadcrumb credentials (this is intentional). The
      anti-spoiler rule applies only to CHANGELOG, README, release
      notes, PR descriptions, and commit messages — NOT to
      walkthroughs themselves.
