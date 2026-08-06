# D3CYPH3R Walkthroughs — author guide

This directory hosts the **walkthroughs subsite**: long-form study
companions for D3CYPH3R levels. Publicly available at
`https://www.d3cyph3r.com/walkthroughs/`. Meant to be the canonical
destination for "I solved this level, now teach me everything
around it."

Read this file before writing a walkthrough.

## How it's served

As of v2.4.0 the subsite is **statically generated**. Each markdown
file is rendered to a real HTML page at a real URL:

```
walkthroughs/
├── index.html              GENERATED — index + search UI.
├── manifest.mjs            Track/level registry. Hand-edited.
├── walkthrough.css         Reader theme (measure, TOC rail, pager).
├── reader.js               Theme bootstrap + TOC scroll-spy.
├── search.js               Client-side search over the index.
├── search-index.json       GENERATED — one entry per section.
├── vendor/marked.esm.min.js  Vendored markdown parser (CSP-safe).
├── README.md               This file (not rendered).
└── <track>/
    ├── index.html          GENERATED — track listing.
    ├── <level>.md          SOURCE — one per walkthrough.
    └── <level>.html        GENERATED from the .md beside it.
```

URLs are `/walkthroughs/<track>/<level>.html`. The `.html` suffix is
deliberate: Azure SWA serves the extensionless form too, but a plain
`python3 -m http.server` does not, and the project's promise is that a
clone runs under any static server.

### Regenerating

```bash
node tools/build-walkthroughs.mjs
```

Zero dependencies, nothing to install. It uses Node builtins plus the
already-vendored `marked`. Run it after editing **any** walkthrough
markdown or `manifest.mjs`, and commit the generated files alongside
the source. CI re-runs the generator and fails the build if the output
differs from what was committed, so stale pages cannot reach main.

The generator also emits `sitemap.xml`, `llms.txt`, and
`search-index.json` at the repo root or subsite root as appropriate.

Whenever a new walkthrough lands, add it to `MANIFEST` in
`manifest.mjs` so the index, track listing, prev/next pager, sitemap,
and search index all pick it up.

### Why not the old hash router

Before v2.4.0 this was a single shell page that read `location.hash`
and injected markdown with `innerHTML`. Everything after `#` is never
sent to the server, so all 24 walkthroughs shared one URL and one empty
6KB shell: none of them were indexable, and `#frameworks` could not
coexist with `#/linux/level3`, so no section was linkable either.
Static pages fix both, and remove the `aria-live` region that made
screen readers announce a whole 7,000-word document on every
navigation.

### Section anchors

Every walkthrough shares the same 10 section anchors, so the same
fragment means the same thing on all 24 pages:

`#setup` `#solve` `#vulnerability` `#real-world-parallels`
`#frameworks` `#certifications` `#defender` `#optional-exploration`
`#takeaways` `#further-reading`

These are curated in `SECTION_SLUGS` in the generator rather than
derived from heading text, so retitling a heading does not break
published links. Subheadings get auto-generated slugs.

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

## The 12-section template

Every walkthrough follows the same structure. Use
`walkthroughs/linux/level0.md` as the reference; copy-paste its
section dividers when starting a new file.

| § | Section                       | Purpose                                                                  |
|---|-------------------------------|--------------------------------------------------------------------------|
| — | Spoiler warning               | An unnumbered blockquote starting with `⚠`, above §1 — auto-styled as a red callout |
| 1 | The setup (in-world)          | Driftwood + client + character context. Sets the stage                   |
| 2 | The solve (mechanical)        | Step-by-step commands with outputs. "If you got stuck" sub-note **required for level0 and level1**, optional beyond (see note) |
| 3 | The vulnerability             | Name the stacked failures. Why each is independently a finding           |
| 3.5 | Blast radius                | Size the finding: what it reaches, how much is in scope, for how long, what it opens next, and which regime applies. Table of six dimensions plus 2–3 judgement pull-outs. Every figure sourced from level content; regime per the reference table below |
| 4 | Real-world parallels          | 2–3 named, well-documented incidents. Include the *response* angle       |
| 5 | Frameworks, deep dive         | Every NIST/CWE/MITRE/regulation cited in the in-game post-mortem         |
| 6 | Cert exam relevance           | Equal-depth treatment of every cert cited. Sample exam-question framings |
| 7 | What a defender does          | Concrete tools, audit evidence, and a **required** `### Sample detection rule (Sigma)` subsection (see note) |
| 7.5 | Optional exploration        | Bonus finds + any optional content (pivot hosts, verification commands). Spoiler-tolerant section; see template below |
| 8 | Key takeaways                 | 3–5 bullet study-guide summary                                           |
| 9 | Further reading              | Primary sources, vendor docs, books — links only, no commentary needed   |

### §7.5 Optional exploration — author guide (v1.10.0)

Every shipped level has at least one `bonusFinds` entry that fires
on a deterministic command pattern. The walkthrough's §7.5 is the
documented destination for spoiling those bonuses:

- **Anti-spoiler discipline applies to `progress --detail`, NOT to
  walkthroughs.** Walkthroughs are intended to be read after solving
  the credential chain; once a player is in §7.5 they've earned the
  spoiler.
- **Structure each §7.5:**
  1. One-paragraph intro: "The credential chain works without this
     section. The level seeds N hidden bonus find(s) that fire if
     you happen to run a specific command pattern — `progress
     --detail` from any prompt lists what you've unlocked."
  2. Per bonus, a `### <Bonus name>` subsection with:
     - **Trigger**: exact command + arg pattern + a note on where in
       the solve flow it naturally fires (if applicable)
     - **What it teaches**: expanded hint (3–5 paragraphs) including
       a real-world pattern reference (MITRE ATT&CK technique,
       LOLBAS entry, named incident, framework control) that
       contextualizes the bonus
- **Also covers non-bonus optional content** when relevant — e.g.
  `walkthroughs/linux/level1.md` §7.5 documents both the multi-host
  pivot demo AND the level's two bonus finds; `walkthroughs/network/
  level1.md` §7.5 documents optional ip/arp/ping/nslookup
  verification commands that aren't part of the solve.
- **Section anchor is literally `## §7.5 — Optional exploration`**,
  placed between §7 (What a defender does) and §8 (Key takeaways).

### "If you got stuck" — required for level0 and level1 only

The rule used to say every §2 carries one. In practice nine of 24 did,
and all nine were level0 or level1. That was not drift; it was the right
instinct applied inconsistently. A reader on `level3@crypto` has solved
three levels in that track and does not need to be told how to check
their working directory, while a reader on any level0 may be seeing the
terminal for the first time.

So the rule now matches the instinct: required on level0 and level1,
optional after. Add one to a later level when the solve has a genuine
trap, not as a formality.

### The detection rule is required, and it has a shape

Every §7 carries a `### Sample detection rule (Sigma)` subsection. Nine
walkthroughs had one before v2.5.1 and fifteen did not, which meant §7
was uniformly good advice but only sometimes actionable.

Each rule must carry `title`, `logsource`, `detection` with an explicit
`condition`, `falsepositives`, and `level`. The `falsepositives` block is
not optional padding: a rule shipped without one is a rule the receiving
team will disable the first week it fires, and naming the benign causes is
what makes it survivable.

Three things worth doing in the prose around the rule:

- **Say what the rule does not fix.** Most of these are tripwires covering
  the interval until a real control ships. Write that down, so the
  detection is never mistaken for the remediation.
- **Rate honestly, and explain a low rating.** `forensics/level2`'s rule is
  `level: low` because after-hours work is not an offence and a rule that
  pages on it gets switched off. That reasoning belongs next to the rule.
- **Prefer the native control where one exists.** GuardDuty, an IAM
  credential report, CT-log monitoring, or a pre-receive secret scan will
  often beat anything a SIEM rule can do, and saying so is more useful
  than pretending the rule is the whole answer.

### Forward references go stale, and the build now catches them

A walkthrough written before the next level existed naturally describes it
as "a future `level3@linux`", or says it "hasn't been built yet". When
that level ships, nothing goes back to correct the prose. The corpus then
carries statements that were true once and are now wrong.

This is not hypothetical. `linux/level1` told readers that `level2@linux`
was unbuilt and unreachable for two releases after it became playable, and
`crypto/level2` and `linux/level2` carried the same staleness in their
spoiler lines. All were fixed in v2.5.1.

The generator now knows which levels exist and fails the build on any
sentence that names a **shipped** level alongside not-yet-built language.
The vocabulary was assembled from an actual sweep rather than guessed,
because the first version of this check caught only two phrasings and
missed the two that accounted for most of the corpus:

```
hasn't been built    has not been built   isn't built
is not built         not yet built        hasn't shipped
has not shipped      isn't shipped        not yet shipped
doesn't exist        does not exist       no entry point
forthcoming          will eventually      eventually explore
the eventual         staged for it        when it ships
once it ships        not yet available    to be built
```

Plus the fixed phrases "no levelN is currently solvable" and "the level
content is forthcoming".

**Add to that list whenever a new euphemism turns up.** A false positive
costs one rewording; a miss costs a reader being told to stop at a level
that is playable

**So the workflow is automatic.** Shipping a new level makes the previous
walkthrough's forward reference fail, and the build will not pass until it
is corrected. Nobody has to remember.

Writing "a future `levelN@track`" is still correct and expected for a
level that genuinely does not exist yet. The check only objects once the
statement stops being true.

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

## Per-track regulatory reference (verified August 2026)

The regime is fixed per track, because the same technical defect carries
different consequences depending on whose data it is. Get the regime
wrong and every downstream claim in §3.5 and §5 inherits the error.

Verified against primary sources on the date above. **Re-verify before
citing**, and note the two entries flagged below, which are the ones
authors most often get wrong.

| Track | Client | Regime | Notification duty |
|---|---|---|---|
| Linux | Halton Bank | GLBA §501(b) via the **Interagency Guidelines**, 12 CFR Pt. 30 App. B (OCC), Pt. 208 App. D-2 (Fed), Pt. 364 App. B (FDIC) | **36 hours** to the primary federal regulator (12 CFR Pt. 53 / Pt. 225 Subpart N / Pt. 304 Subpart C). Customer notice per the 2005 Interagency Guidance on Response Programs |
| Network | Atlas Health | HIPAA, 45 CFR 164.400-414 | Individuals within 60 days. 500+ in scope: HHS without unreasonable delay and media notice in the affected state. Under 500: HHS annually, within 60 days of year end |
| Crypto | Vesta Retail | PCI-DSS v4.0.1 | Contractual, not statutory. Acquirer and card brands per the merchant agreement |
| Web | Meridian State University | FERPA, 20 U.S.C. § 1232g / 34 CFR Part 99 | **None under FERPA.** See the warning below |
| Forensics | Polaris Defense Systems | CMMC, NIST SP 800-171, DFARS 252.204-7012 | **72 hours** to DoD via DIBNet. Preserve images and logs at least 90 days |
| OSINT | Veridian Analytics | HIPAA as a Business Associate, HITRUST CSF | BA notifies the covered entity within 60 days; the covered entity carries the individual-notice duty |
| Cloud | Coverline Insurance | SOC 2, NAIC Model 668, NYDFS 23 NYCRR 500, GLBA | NYDFS § 500.17: **72 hours** to the superintendent, plus 24 hours for an extortion payment and an annual certification by April 15. NAIC § 6: **72 hours** to the commissioner |

### Two traps

**Halton is a bank, so the FTC Safeguards Rule does not apply to it.**
16 CFR Part 314 governs *nonbank* financial institutions under FTC
jurisdiction; banks are carved out because the federal banking agencies
supervise them. The 2023 amendment's 500-consumer, 30-day FTC
notification is therefore the wrong clock for this client, and the right
one is the 36-hour rule above, which is both accurate and a sharper
teaching beat. The Linux track carried the FTC citation until v2.5.0.

**FERPA has no breach-notification requirement and no fine schedule.**
Enforcement runs through the Department of Education's authority to
withdraw federal funding, which has never been formally invoked, plus the
annual FSA compliance attestation. Any notification clock in a Meridian
scenario comes from *state* law attaching to the PII, never from FERPA
itself. These are separate exposures with separate deadlines.

### Sources

- [12 CFR Part 53 — Computer-Security Incident Notification](https://www.ecfr.gov/current/title-12/chapter-I/part-53)
- [Interagency Guidance on Response Programs (2005)](https://www.federalregister.gov/documents/2005/03/29/05-5980/interagency-guidance-on-response-programs-for-unauthorized-access-to-customer-information-and)
- [45 CFR Part 164 Subpart D — Breach Notification](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-D)
- [DFARS 252.204-7012](https://www.ecfr.gov/current/title-48/chapter-2/subchapter-H/part-252/subpart-252.2/section-252.204-7012)
- [23 NYCRR 500](https://www.dfs.ny.gov/system/files/documents/2023/03/23NYCRR500_0.pdf)
- [NAIC Model 668](https://content.naic.org/sites/default/files/model-law-668.pdf)
- [PCI DSS v4.0.1](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1)
- [FERPA — 34 CFR Part 99](https://www.ecfr.gov/current/title-34/subtitle-A/part-99)

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

- Total walkthrough: **4,000–8,000 words**, and shorter is usually
  better within that band.
- §5 (frameworks) and §6 (certs) are typically the longest sections,
  each running 1,500–2,500 words depending on how many citations the
  in-game post-mortem made.
- Writing time: realistically 3–5 hours of focused work per
  walkthrough, including fact-checking real-world parallels and
  verifying exam objective numbers against current cert blueprints.

The band was **6,000–8,000** through v2.3.1, but the corpus had already
outgrown it: at the v2.4.0 audit only 9 of 24 files complied, with 8
over and 7 under. The pattern was not sloppiness. The oldest
walkthroughs run long (`cloud/level0` at 9,963 words, `network/level1`
at 9,887) while every level3 came in tight (3,904 to 4,675) because
later writing leaned on tables and stopped restating framework text
that the linked source already carries. The tighter files read better,
so the standard was moved to match the practice rather than the
practice bent back to the standard.

Treat a draft pushing past 8,000 words as a signal to cut, most often
by replacing a prose enumeration of controls with a table.

**Where the corpus actually sits.** Adding §3.5 to every walkthrough in
v2.5.0 cost roughly 350 words each, which pushed twelve files above
8,000. They are not being rewritten to fit: the band is a target for new
work and a trim signal for existing work, not a rule the corpus is
retro-fitted to. The twelve are the oldest and longest walkthroughs, and
they are the right candidates when someone next has an editing pass to
spend. Do not widen this band again to accommodate growth; cut instead.

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

Every §9 begins with a plain italic line, **not** a blockquote:

```markdown
*Last reviewed: <Month Year>. External standards versions and incident
facts verified against current canonical sources as of this date.
Report stale links via the project's GitHub issues tracker.*
```

Write `*Last reviewed: ...*`. Do **not** prefix it with `>`.

This was ambiguous until v2.4.0, because the example above used to be
shown inside a markdown quote, which read as though the `>` were part
of the convention. It split the corpus 16 plain to 8 blockquoted, and
the two render visibly differently: a blockquote picks up a left border
and muted styling, so the same element looked like two different things
depending on which file you opened. Plain italic won because it is what
most files already did and because the footer is a note about the
section, not a quotation.

Two invariants, both currently 24/24:

1. Plain italic, never a blockquote.
2. Opens `*Last reviewed: <Month> <Year>`, so the date is greppable
   across the corpus with a single pattern.

After that opening the wording may vary. Sixteen files continue with a
period and the standard sentence above; eight continue with an em-dash
and a caveat specific to that walkthrough (`forensics/level3` flags the
RFC 7489 obsolescence, `cloud/level2` flags CIS Benchmark control
numbering). Both are fine and both render identically. Reach for the
specific form when a reader quoting this file in audit work would be
misled without the caveat.

The date is bumped at each link-audit pass (i.e., every walkthrough
PR that touches the file, and on any standalone re-audit PR). When
a walkthrough has been untouched for >12 months, schedule a
re-audit PR even without other content changes — standards drift
doesn't wait for PRs.
