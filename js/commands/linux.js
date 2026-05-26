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

    // Modern path: tokenize, expand globs, fetch each, concat outputs.
    const rawArgs = arg.trim().split(/\s+/).filter(Boolean);
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
      if (meta && !canReadFile(meta, user, group)) {
        out.push(`cat: ${a}: Permission denied`);
        hadError = true;
        continue;
      }

      if (node.content) {
        out.push(node.content);
        hadContent = true;
      }
    }

    // Single-file empty content → graceful "(empty file)" hint.
    if (!hadContent && !hadError) return { text: "(empty file)", cls: "dim" };
    return {
      text: out.join("\n"),
      // If everything was an error, use the error color. Mixed
      // success+error still uses "out" so the body content is
      // legible — errors are clearly tagged in-text by the
      // "cat: <name>: ..." prefix.
      cls: !hadContent && hadError ? "err" : "out",
    };
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
    if (parts.length === 0) return { text: "Usage: grep <word> [file ...]", cls: "err" };

    const word       = parts[0];
    const rawTargets = parts.slice(1);
    const lc         = word.toLowerCase();

    // Stdin path: no explicit file targets + piped input present.
    if (rawTargets.length === 0 && stdin !== undefined) {
      const matches = String(stdin).split("\n")
        .filter(l => l.toLowerCase().includes(lc));
      if (matches.length === 0) return { text: "(no matches)", cls: "dim" };
      return { text: matches.join("\n"), cls: "warn" };
    }

    const searchFile = (name, content) => {
      if (!content) return [];
      return String(content).split("\n")
        .filter(l => l.toLowerCase().includes(lc))
        .map(l => `${name}: ${l}`);
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

  // env: dump level.env_vars. Levels use this to leak credentials /
  // tokens / API keys in the same shape they appear in real engagements
  // (LD_PRELOAD, AWS_*, DB_*, etc.). Levels without env_vars get a
  // graceful empty-state message rather than empty output.
  env(level) {
    const vars = level.env_vars;
    if (!vars) return { text: "(no environment variables set on this level)", cls: "dim" };
    const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
    return { text: lines.join("\n"), cls: "warn" };
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
