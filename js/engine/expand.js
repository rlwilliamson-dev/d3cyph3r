// Shell variable expansion. Applied to raw input AFTER history /
// echo, but BEFORE tokenization and pipe-splitting in execute().
//
// Supported forms:
//   $USER  $HOME  $HOSTNAME  $PATH  $PWD       — common bash vars
//   ${VAR}                                     — bracketed form
//   $UPPER_CASE   $with_underscore_123         — any identifier-style name
//
// Where the values come from (in priority order):
//   1. level.env_vars[NAME]   — per-level overrides (the same map
//                               the `env` command surfaces)
//   2. Built-ins derived from engine state:
//      USER      → level.playerUser or the engine slot name
//      HOME      → /home/<USER>
//      HOSTNAME  → currentLevelKey.split("@")[1]
//      PWD       → buildDisplayPath equivalent
//      PATH      → "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
//   3. If undefined, expansion produces the empty string (bash default).
//
// What we DON'T do:
//   - Command substitution `$(cmd)` / backticks. Would require running
//     a sub-execute() inline; not needed for level content.
//   - Arithmetic substitution `$((expr))`.
//   - Default-value forms `${VAR:-default}`.
//   - Quoting / escape rules. The engine doesn't support quoted strings
//     yet — single/double quotes pass through verbatim. Players who
//     need a literal `$` in echo can use `$$` (substituted to literal $).
//
// Why expansion happens at the dispatcher level: shell vars are a
// player-facing convenience that should work for ANY command without
// the command having to opt in. Doing it here keeps every command
// handler unchanged.

import { currentLevelKey, currentPath } from "./state.js";

/**
 * Compute the level-scoped variable map, including built-ins.
 *
 * Built-ins are derived from engine state and don't depend on which
 * command is running. Per-level env_vars override built-ins of the
 * same name (so a level can pin USER for a teaching scenario).
 */
function getEnv(level) {
  const user = level?.playerUser || currentLevelKey.split("@")[0];
  const host = currentLevelKey.split("@")[1] || "localhost";
  const home = `/home/${user}`;
  const pwd  = currentPath.length === 0 ? home : home + "/" + currentPath.join("/");

  const builtins = {
    USER:      user,
    LOGNAME:   user,
    HOME:      home,
    HOSTNAME:  host,
    PWD:       pwd,
    SHELL:     "/bin/bash",
    PATH:      "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    LANG:      "en_US.UTF-8",
  };

  // Per-level env_vars override built-ins of the same name.
  return { ...builtins, ...(level?.env_vars || {}) };
}

/**
 * Expand `$VAR` and `${VAR}` references in `input` against the level's
 * variable map. Returns the expanded string (or the original if no
 * substitutions applied).
 *
 * Names match the bash identifier rules: [A-Za-z_][A-Za-z0-9_]*. So
 * `$1foo` doesn't expand (digits can't lead), and `$VAR-suffix` only
 * expands `$VAR` (the `-` breaks the identifier).
 *
 * Special: `$$` expands to a literal `$` (escape hatch for players
 * who want to put a dollar sign through `echo` without invoking
 * variable expansion).
 *
 * @param {string} input - The raw command line.
 * @param {object} level - The current level (for env_vars / playerUser).
 * @returns {string} Expanded input.
 */
export function expandVars(input, level) {
  if (!input || (!input.includes("$"))) return input;
  const env = getEnv(level);

  // Single regex that captures all three forms in one pass:
  //   $$            literal-dollar escape       → group 1 = "$"
  //   ${name}       bracketed                   → group 2 = name
  //   $name         bare identifier             → group 3 = name
  return input.replace(/\$(\$)|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_match, dollar, bracketed, bare) => {
      if (dollar) return "$";
      const name  = bracketed || bare;
      const value = env[name];
      // Bash default: undefined vars expand to "" (no warning).
      return value === undefined ? "" : String(value);
    });
}
