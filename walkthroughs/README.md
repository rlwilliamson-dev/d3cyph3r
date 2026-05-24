# D3CYPH3R Walkthroughs — author guide

This directory hosts the **walkthroughs subsite**: long-form study
companions for D3CYPH3R levels. Publicly available at
`https://www.d3cyph3r.com/walkthroughs/`. Meant to be the canonical
destination for "I solved this level, now teach me everything
around it."

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

The walkthroughs subsite is **publicly indexable** as of v1.0.
Search engines may surface walkthroughs directly. The spoiler-warning
callout at the top of every walkthrough is the in-page guard against
accidental spoilers; the subsite itself is intentionally discoverable
so search-engine-driven traffic finds the material when they're
ready for it.

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
- [ ] Real-world parallels are linked in §9 Further Reading
- [ ] No raw HTML in the markdown — pure markdown only
- [ ] Locally rendered via `python3 -m http.server` and visually
      reviewed for layout issues
- [ ] **Link audit pass run via a general-purpose research agent**
      (see "Link audit" section below). Apply any corrections; bump
      the "Last reviewed" date at the top of §9.
- [ ] Anti-spoiler exception: walkthrough is allowed to contain
      passwords / breadcrumb credentials (this is intentional). The
      anti-spoiler rule applies only to CHANGELOG, README, release
      notes, PR descriptions, and commit messages — NOT to
      walkthroughs themselves.

## Link audit (required pre-merge, every walkthrough PR)

Standards drift. OWASP refreshes every ~4 years (2017 → 2021 → 2025).
NIST 800-63 refreshed Rev 3 → Rev 4 in 2025. NIST 800-171 refreshed
Rev 2 → Rev 3 in May 2024. CIS Controls v8 → v8.1 in 2024. PCI-DSS
v4.0 → v4.0.1 in 2024 (with v4.0 retired Dec 2024). PenTest+
PT0-002 → PT0-003 in Dec 2024 (PT0-002 retired June 2025). CompTIA
refreshes each cert on a ~3-year cycle. Breach disclosures grow
over time — Change Healthcare's affected-individuals count tripled
between October 2024 and July 2025. CWE entries get re-classified
(CWE-668 became "Discouraged for mapping"; the old CWE-1051-as-
credentials usage was actually wrong — the correct ID is CWE-1392).
Historical-case attributions accumulate corrections over time
(McAfee's hotel attribution, BTK's metadata-recovery attribution).

Every walkthrough PR — *including small edits to an existing
walkthrough* — must run a link-audit pass before merge.

**The audit covers BOTH files:**

- The walkthrough markdown (`walkthroughs/<track>/<level>.md`)
- The corresponding in-game lessons-learned content in
  `levels/<track>.js`

These two files cite the same frameworks, certs, and standards.
Both drift the same way. Both must stay current.

**Procedure:**

1. Spawn a general-purpose research agent (the `Agent` tool with
   `subagent_type: general-purpose`) and give it BOTH file paths
   (walkthrough + level), plus today's date.
2. Ask it to verify, for each citation in both files: current
   canonical version (is the version cited still the latest?),
   current canonical URL (does it still resolve?), and any
   body-text claims tied to those sources (cert exam codes,
   control numbers, regulation citation IDs, breach incident
   figures, historical-case dates and attributions).
3. The agent should report as a structured list — one entry per
   item with status (✓ current / ⚠ needs update / ✗ broken),
   corrected URL/version if needed, and a one-line "what to change"
   recommendation when applicable, with the specific file the
   change belongs in.
4. Apply the corrections. Use judgment on which annotations belong
   in which file — the walkthrough is auditor-facing and can carry
   MITRE meta-taxonomy caveats (e.g., "CWE-668 is Discouraged for
   mapping"); the in-game post-mortem is player-facing and should
   not be cluttered with framework-internal taxonomy debates.
5. Update the "Last reviewed: <Month Year>" line at the top of §9
   in the walkthrough to the current month-year.
6. Paste the agent's audit report (or a summary of it) into the PR
   description so the review trail is preserved.

**Cross-track propagation:** If the audit surfaces a finding that
clearly propagates beyond the track in scope (e.g., an OWASP
edition shift, a PCI-DSS version bump, a CWE re-classification
that affects six tracks at once), do a cross-track sweep in the
same PR rather than leaving per-track follow-ups.

The audit is cheap — typically 1–3 minutes of agent time + 5–10
minutes of edit application — and catches drift that would
otherwise embarrass us with a future reader.

## "Last reviewed" footer convention

Every §9 begins with an italic single-line footer:

> *Last reviewed: <Month Year>. External standards versions and
> incident facts verified against current canonical sources as of
> this date. Report stale links via the project's GitHub issues
> tracker.*

The date is bumped at each link-audit pass (i.e., every walkthrough
PR that touches the file, and on any standalone re-audit PR). When
a walkthrough has been untouched for >12 months, schedule a
re-audit PR even without other content changes — standards drift
doesn't wait for PRs.
