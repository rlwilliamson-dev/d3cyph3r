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
//   3. Author the level walkthrough at
//      walkthroughs/<track>/<level>.md. Use level0@linux's walkthrough
//      as the template (9 sections, 7000-9000 words). Update the
//      MANIFEST in walkthroughs/walkthrough.js so the index lists it.
//      Soft gate: the walkthrough MAY ship in a follow-up PR if the
//      writing slows the level merge — but the level isn't considered
//      "done" until its walkthrough exists.
//      ANTI-SPOILER EXCEPTION: the anti-spoiler rule in step 1 does
//      NOT apply to walkthrough content. Walkthroughs are the
//      intended destination for full solve paths and credentials;
//      spoilers belong there. Authors should still avoid copy-pasting
//      passwords into anything outside walkthroughs/.
//
//      LINK-AUDIT REQUIREMENT (pre-merge, every walkthrough PR —
//      including small content edits to an existing walkthrough):
//        a. Audit BOTH:
//             - The walkthrough's §8 Further Reading URLs and the
//               version-specific claims in §5 and §6 (cert versions,
//               framework revisions, regulation citation IDs, breach
//               incident figures, historical-case dates).
//             - The CORRESPONDING in-game lessons-learned content in
//               levels/<track>.js. The post-mortem players read at
//               the end of each level cites the same frameworks and
//               certs the walkthrough does; both files drift the
//               same way and both must stay current.
//           Standards drift — OWASP, NIST 800-63, CIS Controls,
//           PCI-DSS, certs all have multi-year refresh cycles.
//           Breach disclosures grow (Change Healthcare's affected-
//           individuals count tripled between Oct 2024 and Jul
//           2025). Historical-case attributions accumulate
//           corrections over time (McAfee 2012, BTK 2005).
//        b. Apply the corrections to both files. The audience
//           differs — walkthroughs can carry MITRE meta-taxonomy
//           caveats (e.g., "CWE-200 is Discouraged for mapping")
//           that would be noise in the player-facing post-mortem,
//           so use judgment on which annotations belong where.
//        c. Bump the "Last reviewed: <Month Year>" line at the top
//           of §8 to the current month.
//        d. The audit report goes in the PR description so the
//           review trail is preserved.
//        Soft cross-track sweep: if the audit surfaces a finding
//        that propagates beyond the track in scope (e.g., an
//        OWASP-edition shift affecting six tracks at once), do a
//        cross-track sweep in the same PR rather than tracking
//        per-track follow-ups.
//
//   4. Merge the release commit.
//   5. Tag v<VERSION> on the merge commit (annotated tag).
//   6. gh release create v<VERSION> with notes pulled from CHANGELOG.
//      The release notes inherit the anti-spoiler rule from step 1.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the player-visible form shown in the topbar
// and lobby tagline — full semver with a leading "v" (e.g. "v0.13.0").

export const VERSION = "1.10.0";

export const VERSION_DISPLAY = "v" + VERSION;
