// Linux-track commands: filesystem and text exploration.
//
// Handler contract: every command exported here has the signature
//   (level, arg) → { text, cls } | null
// where the dispatcher (`js/engine/execute.js`) prints `text` with the
// CSS class `cls`. Returning `null` suppresses output. `arg` is the raw
// argument string after the command name (no parsing applied).
//
// Schema fields this module reads off the level object:
//   level.fs              nested tree (dirs with .children, files with
//                         .content). Source of truth for cwd-aware
//                         commands (cd / ls / cat).
//   level.files           flat map "path/to/file" → contents (or null
//                         for dirs). Derived from level.fs by
//                         `js/fs/flatten.js#initLevels`. Used by
//                         legacy / cross-cutting commands (grep / find /
//                         head / tail / stat / diff / ps).
//   level.permissions     optional { basename: { mode, owner, group,
//                         size } }. Drives `ls -l` rendering and the
//                         `cat` read-permission check.
//   level.statData        optional { basename: { mtime, atime, ctime,
//                         uid, gid, inode, modeNumeric } }. Filled in
//                         by stat() with sane defaults when missing.
//   level.processes       optional [{ pid, tty, time, cmd }] surfaced
//                         by `ps`. Absent → graceful empty state.
//   level.diffOut         optional { "f1:f2": "curated output" } that
//                         lets a level hand-author a teaching diff
//                         instead of using the computed one.
//   level.env_vars        optional { KEY: VALUE } surfaced by `env`.
//   level.playerUser      optional in-world username override (e.g.
//                         "secops"). Falls back to the engine slot
//                         name (currentLevelKey.split("@")[0]).
//   level.playerGroup     optional primary group override. Defaults
//                         to playerUser when unset.
//
// Why two representations? `level.fs` is what level authors write
// (nested + ergonomic). `level.files` is what cross-cutting commands
// need (a flat enumeration with stable keys). Both are kept in sync
// at module-init by flatten.js — never write to either at runtime.

import { currentLevelKey, currentPath, setCurrentPath } from "../engine/state.js";
import { resolvePath, getFSNode, resolveFullPath } from "../fs/resolve.js";
import { expandGlobs } from "../fs/glob.js";

// In-world identity for the current level. Levels can override the
// engine's abstract slot name (e.g. `level1` from `level1@linux`) with
// a lore-accurate username via `level.playerUser` — used by `whoami`,
// `pwd`, `find`, `ls -la` owner columns, the prompt label, and the
// `cat` permission check. `playerGroup` defaults to `playerUser`.
function getCurrentUser(level) {
  return level?.playerUser || currentLevelKey.split("@")[0];
}
function getCurrentGroup(level) {
  return level?.playerGroup || getCurrentUser(level);
}

// Compose the absolute path string shown to the player — never used
// for filesystem lookups (those go through currentPath + level.fs).
// Format: /home/<user>[/<currentPath joined with />]
function buildDisplayPath(level) {
  const user = getCurrentUser(level);
  const base = `/home/${user}`;
  return currentPath.length === 0 ? base : base + "/" + currentPath.join("/");
}

// Permission metadata helpers. `level.permissions[name]` is shaped
// { mode: "-rw-r--r--", owner: "app_admin", group: "app_admin", size: 1024 }
// — a structured object used by both `ls -l` rendering and `cat`'s
// read-permission check. Mode strings follow the standard 10-char
// format: [type][owner rwx][group rwx][other rwx].
function defaultMeta(name) {
  if (name.endsWith("/"))   return { mode: "drwxr-xr-x", owner: "user", group: "user", size: 0   };
  if (name.endsWith(".sh")) return { mode: "-rwxr-xr-x", owner: "user", group: "user", size: 128 };
  return                          { mode: "-rw-r--r--", owner: "user", group: "user", size: 256 };
}

// Simple Unix-style read check. Levels are single-user / single-group,
// so the level player belongs to a primary group named by `playerGroup`
// (which defaults to `playerUser`).
function canReadFile(meta, currentUser, currentGroup) {
  if (!meta || !meta.mode) return true;
  if (currentUser === meta.owner) return meta.mode[1] === "r";
  if (currentGroup === meta.group) return meta.mode[4] === "r";
  return meta.mode[7] === "r";
}

// Shared file reader used by both `cat` and `sudo cat`. Walks each
// requested path (after glob expansion), concatenating file contents in
// the exact { text, cls } shape `cat` has always returned. The ONLY
// difference between a normal read and a root read is the `asRoot`
// flag: real root ignores permission bits, so a *permitted* `sudo cat`
// reads owner=root / mode=0600 files that the invoking user's own
// `cat` is denied. Everything else (missing file, is-a-directory,
// symlink following via getFSNode, empty-file hint, mixed
// success/error coloring) is identical for both callers.
function catRead(level, rawArgs, asRoot = false) {
  const expanded = expandGlobs(level, currentPath, rawArgs);
  const user  = getCurrentUser(level);
  const group = getCurrentGroup(level);
  const out   = [];
  let hadError = false;
  let hadContent = false;

  for (const a of expanded) {
    const target = resolvePath(level, currentPath, a);
    const node   = getFSNode(level, target);
    if (!node)               { out.push(`cat: ${a}: No such file or directory`); hadError = true; continue; }
    if (node.type === "dir") { out.push(`cat: ${a}: Is a directory`);             hadError = true; continue; }

    const basename = target[target.length - 1];
    const meta     = level.permissions?.[basename];
    if (!asRoot && meta && !canReadFile(meta, user, group)) {
      out.push(`cat: ${a}: Permission denied`);
      hadError = true;
      continue;
    }

    if (node.content) {
      out.push(node.content);
      hadContent = true;
    }
  }

  if (!hadContent && !hadError) return { text: "(empty file)", cls: "dim" };
  return {
    text: out.join("\n"),
    cls: !hadContent && hadError ? "err" : "out",
  };
}

// ── sudo / privilege-escalation helpers (level.sudo) ─────────────────
// A level opts into a functional `sudo` by declaring `level.sudo`:
//   { host?: "build-runner",
//     entries: [ { runAs: "root", nopasswd: true,
//                  commands: ["/usr/bin/cat /opt/halton/snapshots/*"] } ] }
// Without it, `sudo` stays the canonical always-deny (see the handler).

// Render `sudo -l` output in canonical sudo format: a Defaults block
// then "User X may run the following commands", one line per grant.
function renderSudoListing(sudoCfg, user, host) {
  const lines = [
    `Matching Defaults entries for ${user} on ${host}:`,
    `    env_reset, mail_badpass,`,
    `    secure_path=/usr/local/sbin\\:/usr/local/bin\\:/usr/sbin\\:/usr/bin\\:/sbin\\:/bin`,
    ``,
    `User ${user} may run the following commands on ${host}:`,
  ];
  for (const entry of (sudoCfg.entries || [])) {
    const runAs = entry.runAs || "root";
    const tag   = entry.nopasswd ? "NOPASSWD: " : "";
    for (const c of (entry.commands || [])) lines.push(`    (${runAs}) ${tag}${c}`);
  }
  return lines.join("\n");
}

// Convert an fnmatch-style sudoers glob to an anchored RegExp. `*` and
// `?` are wildcards; every other regex metachar is escaped. Note `*`
// maps to `.*` (matches across `/`) ON PURPOSE — an over-broad wildcard
// that reaches into subdirectories IS the vulnerability the level
// teaches (CWE-732 / CWE-250).
function sudoGlobToRegExp(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                  .replace(/\*/g, ".*")
                  .replace(/\?/g, ".");
  return new RegExp("^" + esc + "$");
}

// Is `sudo <cmd> <args>` permitted by any grant in level.sudo? Matches
// the requested binary basename against each grant's binary, and — when
// the grant constrains arguments — the requested path(s) resolved to an
// absolute fs path (so `sudo cat foo` from inside the target dir still
// matches an absolute-glob grant). `ALL` and arg-less binary grants
// permit anything for that binary.
function isSudoPermitted(sudoCfg, level, cmd, cmdArgs) {
  for (const entry of (sudoCfg.entries || [])) {
    for (const spec of (entry.commands || [])) {
      if (spec === "ALL") return true;
      const parts   = spec.trim().split(/\s+/);
      const binBase = parts[0].split("/").pop();
      if (binBase !== cmd) continue;
      if (parts.length === 1) return true; // binary permitted, no arg constraint
      const re  = sudoGlobToRegExp(parts.slice(1).join(" "));
      const abs = cmdArgs.map(a => "/" + resolvePath(level, currentPath, a).join("/"));
      if (abs.length && abs.every(p => re.test(p))) return true;
    }
  }
  return false;
}

export const linuxCommands = {
  // cd: change directory. Routes the arg through the path resolver,
  // which gives us absolute paths (`/home/<user>/foo`), home expansion
  // (`~`, `~/foo`), chained parent refs (`../../bin`), no-op `.`
  // segments, and double-slash collapsing for free.
  //
  // Special-case: `cd ..` from the home root prints the familiar
  // "already at home directory" hint instead of silently no-op'ing —
  // a bash-shaped quality-of-life affordance for new players.
  cd(level, arg) {
    const trimmed = (arg || "").trim();

    // Friendly hint for the up-from-root miscue. Triggers when the
    // player is AT home and types a path made entirely of `..`
    // segments (`..`, `../..`, `../../..`, etc.). Without this trap
    // the resolver would just clamp to [] and the cd would silently
    // no-op — which is bash's actual behavior, but new players read
    // the silence as a bug.
    if (currentPath.length === 0 && /^\.\.(\/\.\.)*\/?$/.test(trimmed)) {
      return { text: "cd: already at home directory", cls: "err" };
    }

    const target = resolvePath(level, currentPath, trimmed);

    // cd with no arg = cd ~ (home root)
    if (target.length === 0) { setCurrentPath([]); return null; }

    const node = getFSNode(level, target);
    if (!node)                return { text: `cd: ${arg}: No such file or directory`, cls: "err" };
    if (node.type !== "dir")  return { text: `cd: ${arg}: Not a directory`,            cls: "err" };
    setCurrentPath(target);
    return null;
  },

  // ls: list directory entries. Targets currentPath when called with
  // no path arg; otherwise lists the directory(ies) the player asked
  // for. Flag parsing is a simple contains-check, so `-la` / `-al` /
  // `-l -a` all work. `-a` shows dotfiles; `-l` switches to long
  // format with mode/owner/group/size.
  //
  // Multi-arg + globs:
  //   `ls *.txt`            expand glob, list matches (treated as files)
  //   `ls src docs`         list each dir in turn, with a header line
  //                         when more than one target was provided
  //
  // Falls back to enumerating level.files when level.fs is absent
  // (legacy levels — currently none in shipped content).
  ls(level, arg) {
    const tokens     = (arg || "").split(/\s+/).filter(Boolean);
    const flagTokens = tokens.filter(t => t.startsWith("-"));
    const rawPaths   = tokens.filter(t => !t.startsWith("-"));
    const flags      = flagTokens.join("");
    const showHidden = flags.includes("a");
    const longFmt    = flags.includes("l");

    // Expand globs into concrete path strings. Empty input → list cwd.
    const pathArgs = rawPaths.length === 0
      ? [undefined]
      : expandGlobs(level, currentPath, rawPaths);

    // Build per-target listings. Files get a single-entry "names"
    // list (the basename); dirs get their children enumerated.
    const blocks = []; // [{ header?: string, names: string[] }]
    for (const pa of pathArgs) {
      const target = resolvePath(level, currentPath, pa);
      const node   = getFSNode(level, target);

      if (node && node.children) {
        let n = Object.keys(node.children).filter(f => showHidden || !f.startsWith("."));
        n = n.map(f => node.children[f].type === "dir" ? f + "/" : f);
        blocks.push({ header: pa, names: n, node });
      } else if (node && node.type === "file") {
        const basename = target[target.length - 1] || pa;
        blocks.push({ header: null, names: [basename], node });
      } else if (pa === undefined && level.files) {
        // No path arg and no fs tree → legacy flat-map fallback.
        const n = Object.keys(level.files).filter(f => showHidden || !f.startsWith("."));
        blocks.push({ header: null, names: n, node: null });
      } else {
        return { text: `ls: cannot access '${pa}': No such file or directory`, cls: "err" };
      }
    }

    // If multiple dir targets, bash prefixes each with "<dirname>:" and
    // a blank line between blocks. Single target is unprefixed.
    const showHeaders = blocks.filter(b => b.header && b.node?.children).length > 1;

    // Helper: render a single block's `names` list (short or long format).
    //
    // Symlink rendering (long format only):
    //   - mode prefix is `l...` (overriding any per-file permissions
    //     mode the level set, since the symlink itself never gates
    //     reads — the target's mode does)
    //   - display name becomes `name -> target` (bash convention)
    // Short format prints names as-is (no `@` suffix — we don't
    // implement the `-F` flag yet).
    const renderBlock = (block) => {
      const { names, node } = block;
      if (names.length === 0) return "(empty directory)";

      if (longFmt) {
        const perms = level.permissions || {};
        // Per-entry resolution: look up the child node so we know whether
        // it's a symlink (and what its target is for the arrow rendering).
        const entries = names.map(f => {
          const key = f.endsWith("/") ? f.slice(0, -1) : f;
          const childNode = node?.children?.[key];
          const isSymlink = childNode?.type === "symlink";
          const meta = perms[key] || defaultMeta(f);
          return {
            f,
            meta: isSymlink ? { ...meta, mode: "lrwxrwxrwx" } : meta,
            displayName: isSymlink ? `${f} -> ${childNode.target}` : f,
          };
        });
        const ownerW = Math.max(...entries.map(e => e.meta.owner.length));
        const groupW = Math.max(...entries.map(e => e.meta.group.length));
        const sizeW  = Math.max(...entries.map(e => String(e.meta.size).length));

        const lines = [];
        if (node && node.children) lines.push("total " + names.length * 8);
        entries.forEach(e => {
          const m = e.meta;
          lines.push(
            `${m.mode} 1 ${m.owner.padEnd(ownerW)} ${m.group.padEnd(groupW)} ${String(m.size).padStart(sizeW)}  ${e.displayName}`
          );
        });
        return lines.join("\n");
      }

      return names.join("  ");
    };

    // Aggregate output: header per dir (if multiple), block, blank line.
    if (showHeaders) {
      const out = [];
      blocks.forEach((b, i) => {
        if (i > 0) out.push("");
        out.push(`${b.header}:`);
        out.push(renderBlock(b));
      });
      return { text: out.join("\n"), cls: "out" };
    }

    // No-headers case: flatten all blocks' names into a single listing.
    // This covers both the single-target case (file or dir) AND the
    // multi-file case (`ls a.txt b.txt c.txt` → all three on one line,
    // no per-file headers, no "total" line). For long format, we pass
    // node=null so renderBlock skips the "total <N>" header — bash
    // omits it when ls is given explicit file args.
    const allNames = blocks.flatMap(b => b.names);
    if (allNames.length === 0) return { text: "(empty directory)", cls: "dim" };
    // If we had a single dir target, reuse its node so the long-format
    // renderer prints the "total" line.
    const synthetic = blocks.length === 1
      ? blocks[0]
      : { names: allNames, node: null };
    return { text: renderBlock(synthetic), cls: "out" };
  },

  // cat: print file contents. Supports multiple positional args and
  // glob expansion: `cat *.md` concatenates every .md in cwd;
  // `cat a b` concatenates a and b. Per-file errors (missing,
  // is-a-directory, permission denied) are interpolated into the
  // output rather than aborting the whole call, mirroring real cat's
  // "keep going" behavior with multi-file inputs.
  //
  // Two filesystem paths:
  //   1. Modern (level.fs present): resolvePath → getFSNode lookup,
  //      then an optional per-basename permission check via
  //      level.permissions.
  //   2. Legacy (no level.fs): direct lookup in the flat level.files
  //      map. No cwd resolution, no permission check, no glob.
  // The legacy branch is retained for forward-compat with externally-
  // authored levels; all shipped levels populate level.fs.
  cat(level, arg) {
    if (!arg) return { text: "Usage: cat <file>", cls: "err" };

    // Legacy flat-files fallback — single arg only, no glob support.
    if (!level.fs) {
      if (!(arg in level.files)) return { text: `cat: ${arg}: No such file or directory`, cls: "err" };
      const c = level.files[arg];
      if (c === null) return { text: `cat: ${arg}: Is a directory`, cls: "err" };
      if (c === "")   return { text: "(empty file)", cls: "dim" };
      return { text: c, cls: "out" };
    }

    // Modern path: tokenize and delegate to the shared reader. Normal
    // `cat` enforces read permissions (asRoot = false); `sudo cat`
    // routes through the same helper with asRoot = true.
    const rawArgs = arg.trim().split(/\s+/).filter(Boolean);
    return catRead(level, rawArgs, /* asRoot */ false);
  },

  // pwd / whoami / echo: trivial reflectors over engine state and
  // level.playerUser. Included for muscle-memory completeness rather
  // than because levels gate anything on them.
  pwd(level) {
    return { text: buildDisplayPath(level), cls: "out" };
  },

  whoami(level) {
    return { text: getCurrentUser(level), cls: "out" };
  },

  // sudo: privilege-escalation surface.
  //
  // Default (no `level.sudo`): the canonical always-deny stub — `sudo
  // <anything>` prints bash's "incorrect password" line without ever
  // granting root. Levels that don't model sudoers keep the old
  // behavior verbatim (the stub used to live in readonly-stubs.js).
  //
  // Opt-in (`level.sudo` present): the command becomes functional.
  //   sudo -l            enumerate the invoking user's sudoers grants
  //   sudo <cmd> <args>  if a NOPASSWD grant permits it, run <cmd> as
  //                      root; otherwise print the canonical "not
  //                      allowed to execute" deny
  // Only `cat` is wired as a root-executable target (the shipped grant
  // is a wildcard `cat` over a snapshot dir — CWE-250 / CWE-732 /
  // MITRE T1548.003). Any OTHER permitted binary prints a sandbox note
  // rather than faking a root shell — the lesson is enumerating and
  // exploiting a leftover sudoers grant, not general code execution.
  sudo(level, _arg, _stdin, argv) {
    // argv is the post-expansion ARGUMENT vector — it does NOT include
    // the command name "sudo" (argv[0] is already the first arg). So
    // for `sudo cat /path`, argv === ["cat", "/path"].
    const rest = (argv || []).filter(Boolean);

    // No sudoers model here → legacy deny (identical to the old stub).
    if (!level.sudo) {
      return { text: "[sudo] password for user:\nSorry, try again.\nsudo: 1 incorrect password attempt", cls: "err" };
    }

    const user = getCurrentUser(level);
    const host = level.sudo.host || (level.env_vars?.HOSTNAME || "localhost").split(".")[0];

    // sudo -l / sudo -ll : list privileges.
    if (rest[0] === "-l" || rest[0] === "-ll") {
      return { text: renderSudoListing(level.sudo, user, host), cls: "out" };
    }

    // Bare `sudo` (or unsupported flags) → usage, matching real sudo.
    if (rest.length === 0 || rest[0].startsWith("-")) {
      return { text: "usage: sudo -h | -K | -k | -V\nusage: sudo -l [command]\nusage: sudo [-u user] command", cls: "err" };
    }

    // sudo <cmd> <args...>
    const cmd     = rest[0];
    const cmdArgs = rest.slice(1);

    if (!isSudoPermitted(level.sudo, level, cmd, cmdArgs)) {
      const full = `/usr/bin/${cmd}${cmdArgs.length ? " " + cmdArgs.join(" ") : ""}`;
      return { text: `Sorry, user ${user} is not allowed to execute '${full}' as root on ${host}.`, cls: "err" };
    }

    // Permitted. Execute the supported reader as root.
    if (cmd === "cat") {
      if (cmdArgs.length === 0) return { text: "Usage: cat <file>", cls: "err" };
      return catRead(level, cmdArgs, /* asRoot */ true);
    }

    // Permitted but not a wired-in root target in the sandbox.
    return { text: `(sandbox: sudo would run '${cmd}' as root here; this audit terminal only wires 'cat' for root reads)`, cls: "dim" };
  },

  echo(_level, arg) {
    return { text: arg || "", cls: "out" };
  },

  // grep: case-insensitive substring search.
  //
  //   grep word              search ALL files in level (legacy *-behavior)
  //   grep word file         search one file (cwd-aware via resolvePath)
  //   grep word *.log        glob-expand and search each match
  //   <stdin> | grep word    search the piped input (no filename prefix)
  //
  // Output is one match per line. With multiple files (or the no-arg
  // global search), each match is prefixed with the filename so the
  // player can tell which file the hit came from — bash grep's
  // standard multi-file format. Stdin mode skips the prefix because
  // there's no meaningful filename to show.
  grep(level, arg, stdin) {
    const parts = (arg || "").trim().split(/\s+/).filter(Boolean);
    const USAGE = "Usage: grep [-invc] <word> [file ...]";
    if (parts.length === 0) return { text: USAGE, cls: "err" };

    // Leading flags, bundled (`-vn`) or separate (`-v -n`), as real
    // grep accepts. Parsing stops at the first non-flag token so a
    // pattern that begins with `-` still works after `--`-free usage
    // like `grep -v -- -foo` isn't supported (out of scope).
    //
    //   -i  no-op, accepted for muscle memory (see note below)
    //   -v  invert: show lines that do NOT match
    //   -n  prefix each line with its 1-based line number
    //   -c  print only the count of matching lines
    //
    // NOTE ON -i: matching in this sandbox is ALWAYS case-insensitive,
    // which predates flag support and which existing levels and tests
    // rely on. `-i` is therefore accepted and ignored rather than
    // silently changing the default to case-sensitive. Documented as
    // such in `man grep` so the behavior isn't a surprise.
    const flags = new Set();
    let idx = 0;
    while (idx < parts.length && /^-[a-zA-Z]+$/.test(parts[idx])) {
      for (const ch of parts[idx].slice(1)) flags.add(ch);
      idx++;
    }
    const unknown = [...flags].find(f => !"ivnc".includes(f));
    if (unknown) {
      return { text: `grep: invalid option -- '${unknown}'\n${USAGE}`, cls: "err" };
    }

    const rest = parts.slice(idx);
    if (rest.length === 0) return { text: USAGE, cls: "err" };

    const word       = rest[0];
    const rawTargets = rest.slice(1);
    const lc         = word.toLowerCase();
    const invert     = flags.has("v");
    const numbered   = flags.has("n");
    const countOnly  = flags.has("c");

    // A line "matches" when it contains the pattern, XOR the -v flag.
    const hits = (line) => (line.toLowerCase().includes(lc) !== invert);

    // Stdin path: no explicit file targets + piped input present.
    if (rawTargets.length === 0 && stdin !== undefined) {
      const lines   = String(stdin).split("\n");
      const matches = [];
      lines.forEach((l, i) => { if (hits(l)) matches.push(numbered ? `${i + 1}: ${l}` : l); });
      if (countOnly) return { text: String(matches.length), cls: "out" };
      if (matches.length === 0) return { text: "(no matches)", cls: "dim" };
      return { text: matches.join("\n"), cls: "warn" };
    }

    const searchFile = (name, content) => {
      if (!content) return countOnly ? [`${name}: 0`] : [];
      const lines = String(content).split("\n");
      const out   = [];
      lines.forEach((l, i) => {
        if (hits(l)) out.push(numbered ? `${name}: ${i + 1}: ${l}` : `${name}: ${l}`);
      });
      return countOnly ? [`${name}: ${out.length}`] : out;
    };

    // Legacy global-search mode: no target or explicit "*" → iterate
    // level.files (flat map). Keeps cross-directory cheating accessible
    // for players who haven't learned `cd` yet.
    let results = [];
    if (rawTargets.length === 0 || rawTargets[0] === "*") {
      Object.entries(level.files).forEach(([f, c]) => results.push(...searchFile(f, c)));
    } else {
      // Explicit file args — glob-expand, resolve each through cwd.
      const expanded = expandGlobs(level, currentPath, rawTargets);
      for (const t of expanded) {
        const target = resolvePath(level, currentPath, t);
        const node   = getFSNode(level, target);
        if (!node) {
          results.push(`grep: ${t}: No such file or directory`);
          continue;
        }
        if (node.type === "dir") {
          results.push(`grep: ${t}: Is a directory`);
          continue;
        }
        results.push(...searchFile(t, node.content || ""));
      }
    }

    if (results.length === 0) return { text: "(no matches)", cls: "dim" };
    return { text: results.join("\n"), cls: "warn" };
  },

  // find: pattern-match basenames across level.files. Accepts `-name
  // "pattern"` or `-name pattern`. Glob `*` becomes regex `.*`; `.`
  // is escaped to literal. The leading <path> arg is parsed but not
  // honored (search is always level-global) — kept in the usage
  // string so players type the real-world syntax. Output formats
  // each hit as /home/<user>/<path>.
  find(level, arg) {
    if (!arg) return { text: "Usage: find <path> -name <pattern>", cls: "err" };
    const nameMatch = arg.match(/-name\s+"?([^\s"]+)"?/);
    if (!nameMatch) return { text: "Usage: find <path> -name <pattern>", cls: "err" };

    const pattern = nameMatch[1].replace(/\./g, "\\.").replace(/\*/g, ".*");
    const regex   = new RegExp("^" + pattern + "$", "i");

    const found = Object.keys(level.files).filter(f => {
      const basename = f.replace(/\/$/, "").split("/").pop();
      return regex.test(basename);
    });

    if (found.length === 0) return { text: "(no files found)", cls: "dim" };

    const user = getCurrentUser(level);
    return { text: found.map(f => `/home/${user}/` + f).join("\n"), cls: "out" };
  },

  // readlink: print the literal target of a symlink (no resolution).
  //
  //   readlink mylink         → "../actual-file" (whatever the symlink stores)
  //   readlink regular-file   → error: "Invalid argument" (not a symlink)
  //   readlink missing        → error: "No such file or directory"
  //
  // Use `realpath` instead when you want the fully-resolved absolute
  // path; readlink stops at the first symlink hop and prints its
  // target verbatim, including any relative `..` / `~` references.
  readlink(level, arg) {
    if (!arg) return { text: "Usage: readlink <path>", cls: "err" };
    const target = resolvePath(level, currentPath, arg.trim());
    const node   = getFSNode(level, target, { noFollow: true });
    if (!node) return { text: `readlink: ${arg}: No such file or directory`, cls: "err" };
    if (node.type !== "symlink") {
      return { text: `readlink: ${arg}: Invalid argument`, cls: "err" };
    }
    return { text: node.target || "", cls: "out" };
  },

  // realpath: print the canonical absolute path of a file after
  // resolving every symlink in the chain.
  //
  //   realpath mylink         → /home/<user>/actual-file
  //   realpath regular-file   → /home/<user>/regular-file
  //   realpath dangling-link  → error: "No such file or directory"
  //
  // Symlink cycles abort with the same error (the underlying walker
  // caps resolution at MAX_SYMLINK_HOPS = 16, matching the spirit of
  // the kernel ELOOP cap).
  realpath(level, arg) {
    if (!arg) return { text: "Usage: realpath <path>", cls: "err" };
    const start = resolvePath(level, currentPath, arg.trim());
    const full  = resolveFullPath(level, start);
    if (!full) return { text: `realpath: ${arg}: No such file or directory`, cls: "err" };
    const user = getCurrentUser(level);
    const path = full.length === 0 ? `/home/${user}` : `/home/${user}/${full.join("/")}`;
    return { text: path, cls: "out" };
  },

  // basename: strip the directory portion of a path. Optional second
  // arg trims a trailing suffix:
  //   basename /a/b/c.txt        → c.txt
  //   basename /a/b/c.txt .txt   → c
  basename(_level, arg) {
    const parts = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { text: "Usage: basename <path> [suffix]", cls: "err" };
    let name = parts[0].replace(/\/+$/, "");                 // strip trailing /
    const idx = name.lastIndexOf("/");
    if (idx >= 0) name = name.slice(idx + 1);
    if (parts[1] && name.endsWith(parts[1]) && name !== parts[1]) {
      name = name.slice(0, -parts[1].length);
    }
    return { text: name, cls: "out" };
  },

  // dirname: strip the basename of a path:
  //   dirname /a/b/c.txt   → /a/b
  //   dirname c.txt        → .
  //   dirname /            → /
  dirname(_level, arg) {
    const raw = (arg || "").trim().split(/\s+/)[0];
    if (!raw) return { text: "Usage: dirname <path>", cls: "err" };
    let p = raw.replace(/\/+$/, "");                         // strip trailing /
    if (p === "") return { text: "/", cls: "out" };          // root after strip
    const idx = p.lastIndexOf("/");
    if (idx < 0)  return { text: ".", cls: "out" };          // no /, current dir
    if (idx === 0) return { text: "/", cls: "out" };         // top-level child
    return { text: p.slice(0, idx), cls: "out" };
  },

  // head / tail share the same -n parsing: `head [-n N] <file>`.
  // If -n is given as a separate token it's parsed; otherwise N defaults
  // to 10. Both commands are pipe-friendly — feed them stdin without a
  // file arg and they read from the previous pipeline stage:
  //   cat big.log | head -n 5
  //   ls -la /var/log | tail
  // Falls back to the legacy flat-map lookup if level.fs is absent
  // (forward-compat for hand-written legacy levels).
  head(level, arg, stdin) {
    const { n, file } = parseHeadTailArgs(arg || "");
    if (file === null && stdin !== undefined) {
      const content = String(stdin);
      if (!content) return { text: "(empty input)", cls: "dim" };
      return { text: content.split("\n").slice(0, n).join("\n"), cls: "out" };
    }
    if (file === null) return { text: "Usage: head [-n N] <file>", cls: "err" };
    const content = readFileForView(level, file, "head");
    if (content && typeof content === "object") return content;  // error envelope
    if (!content) return { text: "(empty file)", cls: "dim" };
    return { text: content.split("\n").slice(0, n).join("\n"), cls: "out" };
  },

  tail(level, arg, stdin) {
    const { n, file } = parseHeadTailArgs(arg || "");
    if (file === null && stdin !== undefined) {
      const content = String(stdin);
      if (!content) return { text: "(empty input)", cls: "dim" };
      return { text: content.split("\n").slice(-n).join("\n"), cls: "out" };
    }
    if (file === null) return { text: "Usage: tail [-n N] <file>", cls: "err" };
    const content = readFileForView(level, file, "tail");
    if (content && typeof content === "object") return content;
    if (!content) return { text: "(empty file)", cls: "dim" };
    return { text: content.split("\n").slice(-n).join("\n"), cls: "out" };
  },

  // stat: detailed file metadata. Pulls from level.permissions (the
  // primary metadata source) and level.statData (optional override for
  // mtime/uid/etc). Synthesizes reasonable defaults for anything missing.
  stat(level, arg) {
    if (!arg) return { text: "Usage: stat <file>", cls: "err" };
    if (!(arg in level.files)) return { text: `stat: cannot stat '${arg}': No such file or directory`, cls: "err" };
    const meta  = level.permissions?.[arg] || {};
    const extra = level.statData?.[arg]    || {};
    const size  = meta.size ?? String(level.files[arg] || "").length;
    const mode  = meta.mode  || "-rw-r--r--";
    const owner = meta.owner || getCurrentUser(level);
    const group = meta.group || getCurrentGroup(level);
    const mtime = extra.mtime || "2026-05-22 10:00:00.000000000 +0000";
    const atime = extra.atime || mtime;
    const ctime = extra.ctime || mtime;
    const blocks = Math.max(1, Math.ceil(size / 512));

    const lines = [
      `  File: ${arg}`,
      `  Size: ${String(size).padEnd(12)}  Blocks: ${String(blocks).padEnd(6)}  IO Block: 4096   regular file`,
      `Device: 252,1     Inode: ${extra.inode || "1048576"}     Links: 1`,
      `Access: (${extra.modeNumeric || "0644"}/${mode})  Uid: (${extra.uid || "1000"}/ ${owner})   Gid: (${extra.gid || "1000"}/ ${group})`,
      `Access: ${atime}`,
      `Modify: ${mtime}`,
      `Change: ${ctime}`,
      ` Birth: -`,
    ];
    return { text: lines.join("\n"), cls: "out" };
  },

  // ps: process listing. Reads level.processes (array of { pid, tty,
  // time, cmd }). Levels without a `processes` field show a graceful
  // empty-state message instead of crashing.
  ps(level) {
    const procs = level.processes;
    if (!procs || procs.length === 0) {
      return { text: "(no processes visible from this shell)", cls: "dim" };
    }
    const pidW  = Math.max(3, ...procs.map(p => String(p.pid).length));
    const ttyW  = Math.max(3, ...procs.map(p => String(p.tty || "?").length));
    const timeW = Math.max(8, ...procs.map(p => String(p.time || "00:00:00").length));
    const lines = [
      `${"PID".padStart(pidW)} ${"TTY".padEnd(ttyW)} ${"TIME".padEnd(timeW)} CMD`,
      ...procs.map(p => `${String(p.pid).padStart(pidW)} ${String(p.tty || "?").padEnd(ttyW)} ${String(p.time || "00:00:00").padEnd(timeW)} ${p.cmd}`),
    ];
    return { text: lines.join("\n"), cls: "out" };
  },

  // diff: classic line-by-line file comparison. Levels can override the
  // output with `level.diffOut["file1:file2"]` for a curated teaching
  // diff; otherwise we compute a basic per-line comparison in the
  // standard diff(1) annotation format (`Nc N`, `< old`, `---`, `> new`).
  diff(level, arg) {
    if (!arg) return { text: "Usage: diff <file1> <file2>", cls: "err" };
    const parts = arg.trim().split(/\s+/);
    if (parts.length < 2) return { text: "Usage: diff <file1> <file2>", cls: "err" };
    const [f1, f2] = parts;
    if (!(f1 in level.files)) return { text: `diff: ${f1}: No such file or directory`, cls: "err" };
    if (!(f2 in level.files)) return { text: `diff: ${f2}: No such file or directory`, cls: "err" };

    // Level-curated override
    const override = level.diffOut?.[`${f1}:${f2}`];
    if (override) return { text: override, cls: "warn" };

    const a = String(level.files[f1] || "").split("\n");
    const b = String(level.files[f2] || "").split("\n");
    if (a.join("\n") === b.join("\n")) return { text: "(files are identical)", cls: "dim" };

    const lines = [];
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (a[i] === b[i]) continue;
      if (a[i] !== undefined && b[i] !== undefined) {
        lines.push(`${i + 1}c${i + 1}`);
        lines.push(`< ${a[i]}`);
        lines.push(`---`);
        lines.push(`> ${b[i]}`);
      } else if (a[i] !== undefined) {
        lines.push(`${i + 1}d${i + 1}`);
        lines.push(`< ${a[i]}`);
      } else {
        lines.push(`${i + 1}a${i + 1}`);
        lines.push(`> ${b[i]}`);
      }
    }
    return { text: lines.join("\n"), cls: "warn" };
  },
};

// Shared file-reader for head / tail. Returns:
//   - string content on success
//   - { text, cls } error envelope on failure (caller passes it through)
//
// Cwd-aware via resolvePath. Falls back to the flat `level.files`
// lookup when level.fs is absent (forward-compat with hand-written
// legacy levels). The `cmd` arg gates the error string so head's
// "head: cannot open ..." stays distinct from tail's.
function readFileForView(level, file, cmd) {
  if (!level.fs) {
    if (!(file in level.files)) {
      return { text: `${cmd}: cannot open '${file}' for reading: No such file or directory`, cls: "err" };
    }
    return String(level.files[file] || "");
  }
  const target = resolvePath(level, currentPath, file);
  const node   = getFSNode(level, target);
  if (!node) {
    return { text: `${cmd}: cannot open '${file}' for reading: No such file or directory`, cls: "err" };
  }
  if (node.type === "dir") {
    return { text: `${cmd}: error reading '${file}': Is a directory`, cls: "err" };
  }
  return String(node.content || "");
}

// Shared parser for head / tail. Returns { n, file } or { file: null }
// on malformed/empty args. Accepts: "<file>", "-n <N> <file>",
// "<file> -n <N>" (the last form is rare but matches GNU coreutils
// behavior).
//
// Empty arg or only-flags → file stays null, so the caller routes to
// the usage error (or to the stdin branch for pipe-friendly use).
function parseHeadTailArgs(arg) {
  const parts = arg.trim().split(/\s+/).filter(Boolean);
  let n = 10;
  let file = null;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "-n" && parts[i + 1] !== undefined) {
      const parsed = parseInt(parts[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) n = parsed;
      i++;
      continue;
    }
    if (file === null) file = parts[i];
  }
  return { n, file };
}
