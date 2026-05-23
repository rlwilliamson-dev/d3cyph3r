// Canonical version source. Bump VERSION on release, then:
//   1. Update CHANGELOG.md ([Unreleased] → [<VERSION>] - <date>);
//      add a new empty [Unreleased] section; update the comparison
//      links at the bottom.
//      ANTI-SPOILER RULE: never paste actual level passwords /
//      breadcrumb credentials / API keys into CHANGELOG entries,
//      release notes, PR descriptions, or commit messages. Describe
//      the mechanism ("the credential leaked in `db-creds.txt`",
//      "the password recovered from the LinkedIn 2012 corpus") — not
//      the value. The public-facing changelog should be readable by
//      a future player without burning the puzzle. The canonical
//      registry of actual passwords lives in the local
//      PASSWORDS.md cheat sheet (gitignored) and in the
//      `feedback-level-credential-chain.md` memory.
//   2. Update README.md's "This is **vX.Y** — ..." line in the intro
//      with the new version and a one-clause summary of what changed
//      for users (new level count, new commands, etc.). Same anti-
//      spoiler rule applies — no passwords in the README.
//   3. Review the local PASSWORDS.md cheat sheet (gitignored, repo
//      root) and update any rows that changed in this release —
//      e.g. a new credential breadcrumb shipped, a level1 actually
//      built, or a "(Track not built)" note flipping to "Engine ready"
//      because the commands shipped for a scaffolded track.
//   4. Author the level walkthrough at
//      walkthroughs/<track>/<level>.md. Use level0@linux's walkthrough
//      as the template (10 sections, 6000-8000 words). Update the
//      MANIFEST in walkthroughs/walkthrough.js so the index lists it.
//      Soft gate: the walkthrough MAY ship in a follow-up PR if the
//      writing slows the level merge — but the level isn't considered
//      "done" until its walkthrough exists.
//      ANTI-SPOILER EXCEPTION: the anti-spoiler rule in step 1 does
//      NOT apply to walkthrough content. Walkthroughs are the
//      intended destination for full solve paths and credentials;
//      spoilers belong there. Authors should still avoid copy-pasting
//      passwords into anything outside walkthroughs/.
//      LINK-AUDIT REQUIREMENT (pre-merge, every walkthrough PR —
//      including small content edits to an existing walkthrough):
//        a. Delegate a research agent (general-purpose Agent tool +
//           WebFetch/WebSearch) to audit every URL in §9 Further
//           Reading and every version-specific claim in §5 and §6
//           (cert versions, framework revisions, regulation
//           citation IDs, breach incident figures). Standards drift
//           — OWASP, NIST 800-63, CIS Controls, PCI-DSS, certs all
//           have multi-year refresh cycles. Breach disclosures grow
//           (Change Healthcare's affected-individuals count tripled
//           between Oct 2024 and Jul 2025 — these are the kinds of
//           drifts to catch).
//        b. Apply the corrections.
//        c. Bump the "Last reviewed: <Month Year>" line at the top
//           of §9 to the current month.
//        d. The audit report goes in the PR description so the
//           review trail is preserved.
//   5. Merge the release commit.
//   6. Tag v<VERSION> on the merge commit (annotated tag).
//   7. gh release create v<VERSION> with notes pulled from CHANGELOG.
//      The release notes inherit the anti-spoiler rule from step 1.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the major.minor form shown to the player in the
// topbar and lobby tagline.

export const VERSION = "0.7.2";

export const VERSION_DISPLAY = "v" + VERSION.split(".").slice(0, 2).join(".");
