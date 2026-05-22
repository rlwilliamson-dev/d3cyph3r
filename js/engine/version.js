// Canonical version source. Bump VERSION on release, then:
//   1. Update CHANGELOG.md ([Unreleased] → [<VERSION>] - <date>);
//      add a new empty [Unreleased] section; update the comparison
//      links at the bottom.
//   2. Update README.md's "This is **vX.Y** — ..." line in the intro
//      with the new version and a one-clause summary of what changed
//      for users (new level count, new commands, etc.).
//   3. Review the local PASSWORDS.md cheat sheet (gitignored, repo
//      root) and update any rows that changed in this release —
//      e.g. a new credential breadcrumb shipped, a level1 actually
//      built, or a "(Track not built)" note flipping to "Engine ready"
//      because the commands shipped for a scaffolded track.
//   4. Merge the release commit.
//   5. Tag v<VERSION> on the merge commit (annotated tag).
//   6. gh release create v<VERSION> with notes pulled from CHANGELOG.
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the major.minor form shown to the player in the
// topbar and lobby tagline.

export const VERSION = "0.4.0";

export const VERSION_DISPLAY = "v" + VERSION.split(".").slice(0, 2).join(".");
