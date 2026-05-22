// Canonical version source. Bump VERSION on release, then:
//   1. Update CHANGELOG.md ([Unreleased] → [<VERSION>] - <date>);
//      add a new empty [Unreleased] section; update the comparison
//      links at the bottom.
//   2. Update README.md's "This is **vX.Y** — ..." line in the intro
//      with the new version and a one-clause summary of what changed
//      for users (new level count, new commands, etc.).
//   3. Merge the release commit.
//   4. Tag v<VERSION> on the merge commit (annotated tag).
//   5. gh release create v<VERSION> with notes pulled from CHANGELOG.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the major.minor form shown to the player in the
// topbar and lobby tagline.

export const VERSION = "0.4.0";

export const VERSION_DISPLAY = "v" + VERSION.split(".").slice(0, 2).join(".");
