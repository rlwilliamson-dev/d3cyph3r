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
//       JS files do NOT need a version-string cache-bust. As of
//       v1.8.1, `staticwebapp.config.json` serves `/js/*`,
//       `/levels/*`, and `/walkthroughs/walkthrough.js` with
//       `Cache-Control: no-cache, must-revalidate`, so every page
//       load revalidates the engine modules. (Pre-v1.8.1, Azure's
//       default 4-hour cache TTL meant returning visitors ran the
//       prior release's engine for hours after a deploy.) Vendored
//       libraries under `/walkthroughs/vendor/*` stay cached at the
//       SWA default — they're stable across releases.
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
//      as the template (9 sections, 7000-9000 words). Update the
//      MANIFEST in walkthroughs/walkthrough.js so the index lists it.
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
//      Audit BOTH on every walkthrough PR (including small content
//      edits to an existing walkthrough):
//        a. The walkthrough itself:
//             - §8 Further Reading URLs (every link resolves; if a
//               canonical source blocks curl, note browser-only).
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
//           of §8 to the current month.
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

export const VERSION = "2.3.1";

export const VERSION_DISPLAY = "v" + VERSION;
