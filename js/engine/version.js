// Canonical version source. Bump VERSION on release, then:
//   1. Update CHANGELOG.md ([Unreleased] → [<VERSION>] - <date>)
//   2. Merge the release commit
//   3. Tag v<VERSION> on the merge commit
//   4. gh release create v<VERSION> with notes pulled from CHANGELOG
//
// VERSION is the full semver string (used by tooling and the tag).
// VERSION_DISPLAY is the major.minor form shown to the player in the
// topbar and lobby tagline.

export const VERSION = "0.2.0";

export const VERSION_DISPLAY = "v" + VERSION.split(".").slice(0, 2).join(".");
