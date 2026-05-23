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
//   4. Merge the release commit.
//   5. Tag v<VERSION> on the merge commit (annotated tag).
//   6. gh release create v<VERSION> with notes pulled from CHANGELOG.
//      The release notes inherit the anti-spoiler rule from step 1.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the major.minor form shown to the player in the
// topbar and lobby tagline.

export const VERSION = "0.6.0";

export const VERSION_DISPLAY = "v" + VERSION.split(".").slice(0, 2).join(".");
