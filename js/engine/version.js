// Canonical version source. Bump VERSION on release, then:
//
//   1. Update CHANGELOG.md ([Unreleased] → [<VERSION>] - <date>);
//      add a new empty [Unreleased] section; update the comparison
//      links at the bottom.
//      ANTI-SPOILER RULE: never paste actual level passwords /
//      breadcrumb credentials / API keys into CHANGELOG entries,
//      release notes, PR descriptions, or commit messages. Describe
//      the mechanism ("the credential leaked in `db-creds.txt`",
//      "the password recovered from the LinkedIn 2012 corpus") — not
//      the value. The public-facing changelog should be readable by
//      a future player without burning the puzzle.
//
//   2. Update README.md's "This is **vX.Y** — ..." line in the intro
//      with the new version and a one-clause summary of what changed
//      for users (new level count, new commands, etc.). Same anti-
//      spoiler rule applies — no passwords in the README.
//
//   2b. If style.css or walkthrough.css changed in this release,
//       bump the `?v=<version>` cache-bust query-string on the
//       stylesheet `<link>` tags — one in `index.html` and one in
//       `walkthroughs/index.html`. Without this bump, returning
//       visitors see up to 4 hours of stale CSS after the deploy
//       (browser cache TTL). The HTML itself revalidates on every
//       visit per `staticwebapp.config.json`'s no-cache headers, so
//       the version bump in the link href immediately takes effect.
//       If neither stylesheet changed, leave the query-string at the
//       previous version so the cached CSS stays valid for returning
//       visitors — bumping unnecessarily forces a re-fetch of
//       identical bytes.
//
//       As of v2.4.0 the walkthrough stylesheet link is emitted by
//       the generator, so this bump is made by editing CSS_VERSION in
//       `tools/build-walkthroughs.mjs` and re-running it, NOT by
//       hand-editing `walkthroughs/index.html` (which is generated
//       and would be overwritten).
//
//       JS files do NOT need a version-string cache-bust. As of
//       v1.8.1, `staticwebapp.config.json` serves `/js/*` and
//       `/levels/*` with `Cache-Control: no-cache, must-revalidate`,
//       so every page load revalidates the engine modules. (Pre-
//       v1.8.1, Azure's default 4-hour cache TTL meant returning
//       visitors ran the prior release's engine for hours after a
//       deploy.) As of v2.4.0 a `/walkthroughs/*` catch-all covers
//       the generated pages plus reader.js / search.js /
//       search-index.json. Vendored libraries under
//       `/walkthroughs/vendor/*` are matched by an EARLIER route and
//       stay immutable — SWA routes match in order, first wins, so
//       that rule must stay above the catch-all.
//
//   2c. As of v1.21.0, ALSO bump the `CACHE_VERSION` constant near
//       the top of `sw.js` to match the new release version. The
//       service worker uses this as the cache key; bumping it tells
//       installed-PWA users to retire the previous version's cache
//       and rebuild from scratch on next visit. Skipping this step
//       isn't catastrophic (the SW does a network-first / stale-
//       while-revalidate strategy that catches up within a page
//       load), but bumping keeps the update latency minimal.
//
//   3. Author the level walkthrough at
//      walkthroughs/<track>/<level>.md. Use level0@linux's walkthrough
//      as the template (10 sections, 4000-8000 words — band widened in
//      v2.4.0 to match the corpus; shorter is usually better). Add the
//      entry to MANIFEST in walkthroughs/manifest.mjs, then run
//      `node tools/build-walkthroughs.mjs` and COMMIT the generated
//      .html files alongside the .md.
//
//      The generator enforces the section template: all 11 sections,
//      exactly once, in order, plus the leading spoiler blockquote and a
//      complete Sigma detection rule in §7. A deviation fails the build
//      and writes nothing. CI additionally re-runs the generator and
//      fails if committed output is stale, so a markdown edit without a
//      regenerate cannot merge.
//
//      It also enforces CITATIONS (v2.7.0). Checkable claims carry a
//      [^key] marker that resolves to a numbered source at the bottom
//      of the page; the authoring format is in walkthroughs/README.md
//      under "Citations". An unknown key, a duplicate or malformed
//      definition, or a source that is defined but never cited all
//      fail the build. That last rule is the load-bearing one: it is
//      what keeps §9 a list of sources the walkthrough actually used
//      rather than a pile of links. Anything worth listing but not
//      tied to a claim goes under "### Further reading", unnumbered.
//
//      It also catches STALE FORWARD REFERENCES. A walkthrough written
//      before the next level existed calls it "a future levelN@track";
//      once that level ships the statement is wrong, and the build fails
//      until it is corrected. Shipping a new level therefore forces the
//      previous walkthrough's wording to be fixed rather than relying on
//      anyone remembering. Expect to touch the prior level's walkthrough
//      in the same PR as a new level.
//
//      WALKTHROUGH GATE (tightened 2026-05-28 after v1.23.0 shipped
//      a level without its walkthrough): the walkthrough may ship in
//      its own PR (as a PATCH bump immediately after the level
//      release) BUT no new level work may start until that walkthrough
//      PR has merged. The user articulated this as "we always want to
//      do the walkthrough before building a new level." The pattern
//      "ship level data → start next level → come back to walkthrough
//      later" is forbidden; walkthroughs gate forward progress on
//      the level pipeline.
//
//      Two acceptable shipping shapes:
//        (A) Same PR: level data + walkthrough together in one MINOR
//            release. Most level PRs to date (v0.8-v0.13) followed
//            this pattern.
//        (B) Split: level data in MINOR release N.M.0, walkthrough
//            in PATCH release N.M.1 IMMEDIATELY AFTER, with zero
//            level work between them. The skeleton-then-fast-follow
//            split used in v1.23.0 was a one-time exception while
//            this rule was being negotiated; v1.23.1 is the
//            walkthrough closing it out.
//
//      ANTI-SPOILER EXCEPTION: the anti-spoiler rule in step 1 does
//      NOT apply to walkthrough content. Walkthroughs are the
//      intended destination for full solve paths and credentials;
//      spoilers belong there. Authors should still avoid copy-pasting
//      passwords into anything outside walkthroughs/.
//
//      CONTENT-AUDIT REQUIREMENT — TIMING IS DURING WRITING, NOT
//      POST-PUSH (tightened 2026-05-28 after v1.23.1 shipped a
//      walkthrough with URL-only audit and no factual-content audit;
//      the user pushed back that the rule had always meant
//      content-rigor, not just URL reachability).
//
//      The audit MUST be performed AS the walkthrough is being
//      written, BEFORE the branch is pushed to GitHub the first
//      time. It is NOT a pre-merge gate, NOT a post-preview
//      checklist, NOT a follow-up cleanup. If facts haven't been
//      verified, the walkthrough isn't ready to push.
//
//      SCOPE IS THE WHOLE CORPUS, NOT THE NEW LEVEL (tightened
//      2026-08-06). Certification versions and framework revisions move
//      on their own schedule; a claim written a year ago goes stale
//      whether or not anyone edits its file. Auditing only the level
//      being shipped is what allowed a CySA+ retirement date to be
//      wrong in thirteen walkthroughs simultaneously, a PenTest+ launch
//      year to be off by one, and two files to sit at "Last reviewed:
//      April 2026" while their neighbours said July.
//
//      The build enforces it: a walkthrough whose review date falls
//      more than three months behind the freshest one in the corpus
//      fails, as does one missing the line. The comparison is against
//      the corpus rather than against today, so a clone built years
//      from now does not fail on checkout; what it catches is one
//      walkthrough being re-audited while the rest are left behind.
//
//      Audit BOTH on every walkthrough PR (including small content
//      edits to an existing walkthrough):
//        a. The walkthrough itself:
//             - Run `node tools/verify-citations.mjs <track>/<level>`.
//               Zero MISMATCH is the bar. This is the check that a
//               citation points at the page it CLAIMS: check-links only
//               proves a URL resolves, and a citation reading
//               "[CWE-250](.../205.html)" resolves perfectly while being
//               wrong. Read the WEAK list too; that is where a title
//               over-claiming what a page contains turns up. UNVERIFIED
//               entries (bot walls, PDFs) need opening by hand.
//             - Run `node tools/check-links.mjs <track>/<level>`.
//               Zero DEAD is the bar. Read the MOVED list by hand:
//               a redirect that lands on a blog home page means the
//               article is gone even though the link "works", and a
//               200 is not proof of life on sites that answer scripts
//               with a bot-challenge page (justice.gov does).
//               This is the MECHANICAL half only. It says nothing
//               about whether the version or figure you cited is
//               still current, which is what the rest of this list
//               is for.
//             - §5 and §6 version-specific claims: cert versions
//               (SY0-701, CS0-003, etc.), framework revisions (NIST
//               SP numbers + revisions, ISO/IEC publication years,
//               CMMC level definitions), regulation CFR / U.S.C.
//               cites, breach-incident affected-population figures,
//               historical-case dates, named-vendor product line
//               versions.
//             - §4 real-world parallels: case timelines, indictment
//               dates, settlement dates, court-decision dates.
//        b. The CORRESPONDING in-game lessons-learned content in
//           levels/<track>.js. The post-mortem players read at
//           the end of each level cites the same frameworks and
//           certs the walkthrough does; both files drift the
//           same way and both must stay current.
//           Standards drift — OWASP, NIST 800-63, CIS Controls,
//           PCI-DSS, certs all have multi-year refresh cycles.
//           Breach disclosures grow (Change Healthcare's affected-
//           individuals count tripled between Oct 2024 and Jul
//           2025). Historical-case attributions accumulate
//           corrections over time (McAfee 2012, BTK 2005).
//        c. Apply the corrections to both files. The audience
//           differs — walkthroughs can carry MITRE meta-taxonomy
//           caveats (e.g., "CWE-200 is Discouraged for mapping")
//           that would be noise in the player-facing post-mortem,
//           so use judgment on which annotations belong where.
//        d. Bump the "Last reviewed: <Month Year>" line at the top
//           of §9 to the current month.
//        e. The audit report goes in the PR description so the
//           review trail is preserved.
//        Soft cross-track sweep: if the audit surfaces a finding
//        that propagates beyond the track in scope (e.g., an
//        OWASP-edition shift affecting six tracks at once), do a
//        cross-track sweep in the same PR rather than tracking
//        per-track follow-ups.
//
//   3b. PRE-MERGE DOCS SWEEP (added v1.22.0 after a doc-drift catch-
//       up exposed that CLAUDE.md, README.md's mobile-only claim,
//       and CONTRIBUTING.md's boot-order paragraph had quietly gone
//       stale across v1.11–v1.21). Before merging ANY release PR,
//       grep the five contributor-facing docs for anything the
//       current release changes:
//
//         - README.md         — file-tree listings, feature list,
//                                privacy section, mobile/desktop
//                                statements
//         - CONTRIBUTING.md   — architecture-in-one-screen section,
//                                boot order, "how to add a command"
//                                if the new release added engine
//                                surface
//         - CLAUDE.md         — architecture sections (one per
//                                feature area); add a new
//                                **(vX.Y.Z)** section per release
//                                that introduces a new module or
//                                player-visible mechanic
//         - SECURITY.md       — attack-surface bullets if the
//                                release adds a new data store
//                                (localStorage, service worker, an
//                                IndexedDB, etc.) or a new code
//                                path that parses untrusted input
//         - walkthroughs/README.md — only if the walkthrough author
//                                template / section structure
//                                changed
//
//       Checklist per file: (1) does any sentence describe behavior
//       that this release CHANGED? (2) does the new release ADD a
//       module / command / data store / surface that isn't mentioned
//       yet? Apply both edits in the release PR — not a follow-up.
//
//       Common scenarios to look for:
//         - New LEVEL shipped (the MOST common release type — read
//           this one first). A new level is an ENTRY in several
//           enumerations, not just a number. Bumping "N levels" is
//           NOT sufficient; you must ADD THE LEVEL to each list it
//           belongs in. Concretely, in README.md:
//             (a) the per-track LEVEL TABLE — add the `levelN@track`
//                 cell (with its Title-Case walkthrough title) to the
//                 track's row;
//             (b) the level-count sentence in the intro paragraph;
//             (c) the file-tree comment for `levels/<track>.js`
//                 ("Linux track (level0 + level1 + ...)");
//             (d) the Roadmap paragraph;
//             (e) the "N total" walkthrough count in the file tree.
//           And in CONTRIBUTING.md: the shipped-level count / "through
//           levelN" phrasing. (The walkthrough MANIFEST + savecode
//           registries are separate build steps, not this sweep.)
//           RULE OF THUMB: grep every doc for the track's PREVIOUS top
//           level (e.g. `level2@linux`) and make sure the NEW level
//           appears everywhere the old one does. The recurring miss
//           — caught again at v2.1.0, when the README level-table row
//           was left at level2 even though the count read 22 — is
//           bumping the COUNT but forgetting the TABLE ROW. Treat the
//           count and the enumeration as TWO SEPARATE edits; a changed
//           number is not a changed list. Prefer count-free phrasings
//           ("every level's ...") in rhetorical sentences so they
//           can't go stale at all.
//         - New module under js/engine/ or js/commands/ → mention
//           in README's file tree AND CONTRIBUTING's
//           architecture-in-one-screen AND CLAUDE.md.
//         - New player-callable command → mention in README's
//           "Commands implemented" inventory AND in the command-
//           list bullet for the relevant section.
//         - Mobile / desktop / browser-support behavior change →
//           re-read README's intro paragraphs + CONTRIBUTING's
//           "Run it locally" section for stale claims.
//         - New storage key or storage layer → SECURITY.md attack-
//           surface bullets + README's "Privacy" paragraph.
//
//       The reason this step exists at all: v1.11-v1.21 each
//       updated CHANGELOG and the README feature-list line, but
//       NONE updated CLAUDE.md's architecture sections or the
//       README's mobile-only privacy claim. The drift accumulated
//       silently across ten releases before being caught in a
//       single cleanup pass. Doing it per-release is cheap; doing
//       it as a back-fill sweep is not.
//
//   4. Merge the release commit.
//   5. Tag v<VERSION> on the merge commit (annotated tag).
//   6. gh release create v<VERSION> with notes pulled from CHANGELOG.
//      The release notes inherit the anti-spoiler rule from step 1.
//
//   7. POST-RELEASE CodeQL ALERT SWEEP (added v1.25.0 after the
//      inaugural CodeQL triage of 9 accumulated alerts following
//      v1.24.3; user articulated the standing rule as "lets make
//      sure we take a look at all those alerts after every release
//      so we can adress anything that pops up"). After step 6,
//      AFTER prod is verified (`curl https://www.d3cyph3r.com/js/
//      engine/version.js` returns the new VERSION) AND after
//      CodeQL's per-push scan on `main` completes (typically 3-5
//      minutes after the SWA deploy finishes), check the open-
//      alert count:
//
//        gh api repos/<owner>/<repo>/code-scanning/alerts \
//          --jq '[.[] | select(.state == "open")] | length'
//
//      Expected output: `0`. If non-zero, list with rule.id +
//      severity + file + line and triage per finding:
//
//        - Real → open a follow-up PATCH PR same day (treat like
//          any other CodeQL-driven release — see v1.24.4 as the
//          canonical shape).
//        - False positive → dismiss via
//          `gh api -X PATCH .../code-scanning/alerts/{N}
//            -f state=dismissed -f dismissed_reason='false positive'
//            -f dismissed_comment='...'`
//          NOTE: `dismissed_comment` has a 280-character limit.
//        - Won't fix → use `dismissed_reason="won't fix"`.
//        - Used in tests → use `dismissed_reason='used in tests'`.
//
//      Accepted reasons (GitHub API): `false positive`, `won't fix`,
//      `used in tests`. No others. Each requires a comment under
//      280 chars explaining the call. Real findings without a
//      ready fix STAY OPEN and get flagged in the next release's
//      notes — don't dismiss to clear the dashboard.
//
//      The point: catch new alerts the same release they're
//      introduced while the diff is fresh. Letting alerts
//      accumulate across releases is what made the inaugural
//      9-alert sweep painful; doing 1-2 per release is cheap.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the player-visible form shown in the topbar
// and lobby tagline — full semver with a leading "v" (e.g. "v0.13.0").

export const VERSION = "2.12.0";

export const VERSION_DISPLAY = "v" + VERSION;
