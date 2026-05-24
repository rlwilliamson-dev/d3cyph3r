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

// Walk the fs tree from level root, following path parts. Returns the
// node (dir or file) at that path, or null if any segment is missing.
// Used by every cwd-aware handler (cd / ls / cat).
function getFSNode(level, pathParts) {
  if (!level.fs) return null;
  let node = level.fs;
  for (const part of pathParts) {
    if (!node.children || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}

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
  // cd: change directory. `~` or empty arg resets to level root; `..`
  // pops one segment. Other args resolve relative to currentPath (no
  // absolute path support — levels are sandboxed to /home/<user>).
  cd(level, arg) {
    if (!arg || arg === "~") { setCurrentPath([]); return { text: "", cls: "out" }; }
    if (arg === "..") {
      if (currentPath.length === 0) return { text: "cd: already at home directory", cls: "err" };
      setCurrentPath(currentPath.slice(0, -1));
      return null;
    }
    const parts = arg.replace(/^\/+/, "").split("/").filter(Boolean);
    const testPath = [...currentPath, ...parts];
    const node = getFSNode(level, testPath);
    if (!node)                return { text: `cd: ${arg}: No such file or directory`, cls: "err" };
    if (node.type !== "dir")  return { text: `cd: ${arg}: Not a directory`,            cls: "err" };
    setCurrentPath(testPath);
    return null;
  },

  // ls: list directory entries at currentPath. Flag parsing is a simple
  // contains-check, so `-la` / `-al` / `-l -a` all work. `-a` shows
  // dotfiles; `-l` switches to long format with mode/owner/group/size.
  // Falls back to enumerating level.files when level.fs is absent
  // (legacy levels — currently none in shipped content).
  ls(level, arg) {
    const flags      = (arg || "").split(" ").filter(a => a.startsWith("-")).join("");
    const showHidden = flags.includes("a");
    const longFmt    = flags.includes("l");

    const node = getFSNode(level, currentPath);
    let names;
    if (node && node.children) {
      names = Object.keys(node.children).filter(f => showHidden || !f.startsWith("."));
      names = names.map(f => node.children[f].type === "dir" ? f + "/" : f);
    } else {
      names = Object.keys(level.files).filter(f => showHidden || !f.startsWith("."));
    }

    if (names.length === 0) return { text: "(empty directory)", cls: "dim" };

    if (longFmt) {
      const perms = level.permissions || {};
      const metas = names.map(f => {
        const key = f.endsWith("/") ? f.slice(0, -1) : f;
        return perms[key] || defaultMeta(f);
      });
      const ownerW = Math.max(...metas.map(m => m.owner.length));
      const groupW = Math.max(...metas.map(m => m.group.length));
      const sizeW  = Math.max(...metas.map(m => String(m.size).length));

      const lines = ["total " + names.length * 8];
      names.forEach((f, i) => {
        const m = metas[i];
        lines.push(
          `${m.mode} 1 ${m.owner.padEnd(ownerW)} ${m.group.padEnd(groupW)} ${String(m.size).padStart(sizeW)}  ${f}`
        );
      });
      return { text: lines.join("\n"), cls: "out" };
    }

    return { text: names.join("  "), cls: "out" };
  },

  // cat: print file contents. Two paths:
  //   1. Modern (level.fs present): resolve via the nested tree, honor
  //      currentPath, then optionally enforce a per-file permission
  //      check from level.permissions.
  //   2. Legacy (no level.fs): direct lookup in the flat level.files
  //      map. No cwd resolution, no permission check.
  // The legacy branch is retained for forward-compat with externally-
  // authored levels; all shipped levels populate level.fs.
  cat(level, arg) {
    if (!arg) return { text: "Usage: cat <file>", cls: "err" };
    if (!level.fs) {
      // Legacy flat-files fallback — kept for forward-compat with hand-written levels.
      if (!(arg in level.files)) return { text: `cat: ${arg}: No such file or directory`, cls: "err" };
      const c = level.files[arg];
      if (c === null) return { text: `cat: ${arg}: Is a directory`, cls: "err" };
      if (c === "")   return { text: "(empty file)", cls: "dim" };
      return { text: c, cls: "out" };
    }
    const parts = arg.split("/").filter(Boolean);
    const node  = getFSNode(level, [...currentPath, ...parts]);
    if (!node)               return { text: `cat: ${arg}: No such file or directory`, cls: "err" };
    if (node.type === "dir") return { text: `cat: ${arg}: Is a directory`,            cls: "err" };

    // Permission check — only applies if the level defines a metadata
    // entry for this basename. Levels without `permissions` (e.g. level0)
    // behave exactly as before.
    const basename = parts[parts.length - 1];
    const meta     = level.permissions?.[basename];
    if (meta && !canReadFile(meta, getCurrentUser(level), getCurrentGroup(level))) {
      return { text: `cat: ${arg}: Permission denied`, cls: "err" };
    }

    if (!node.content) return { text: "(empty file)", cls: "dim" };
    return { text: node.content, cls: "out" };
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

  // grep: case-insensitive substring search across one file or all
  // files (`*` or omitted target). Operates on the flat level.files
  // map — does not honor currentPath, so a player can grep cross-
  // directory from any cwd. Output is one match per line, prefixed
  // with the file name (mimics GNU grep with multi-file inputs).
  grep(level, arg) {
    if (!arg) return { text: "Usage: grep <word> <file|*>", cls: "err" };
    const parts  = arg.trim().split(/\s+/);
    const word   = parts[0];
    const target = parts[1];

    const searchFile = (name, content) => {
      if (!content) return [];
      return String(content).split("\n")
        .filter(l => l.toLowerCase().includes(word.toLowerCase()))
        .map(l => `${name}: ${l}`);
    };

    let results = [];
    if (!target || target === "*") {
      Object.entries(level.files).forEach(([f, c]) => results.push(...searchFile(f, c)));
    } else {
      if (!(target in level.files)) return { text: `grep: ${target}: No such file or directory`, cls: "err" };
      results = searchFile(target, level.files[target]);
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
  // to 10. Works against level.files (flat map) for cross-level
  // consistency with grep / find.
  head(level, arg) {
    if (!arg) return { text: "Usage: head [-n N] <file>", cls: "err" };
    const { n, file } = parseHeadTailArgs(arg);
    if (file === null) return { text: "Usage: head [-n N] <file>", cls: "err" };
    if (!(file in level.files)) return { text: `head: cannot open '${file}' for reading: No such file or directory`, cls: "err" };
    const content = String(level.files[file] || "");
    if (!content) return { text: "(empty file)", cls: "dim" };
    return { text: content.split("\n").slice(0, n).join("\n"), cls: "out" };
  },

  tail(level, arg) {
    if (!arg) return { text: "Usage: tail [-n N] <file>", cls: "err" };
    const { n, file } = parseHeadTailArgs(arg);
    if (file === null) return { text: "Usage: tail [-n N] <file>", cls: "err" };
    if (!(file in level.files)) return { text: `tail: cannot open '${file}' for reading: No such file or directory`, cls: "err" };
    const content = String(level.files[file] || "");
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

// Shared parser for head / tail. Returns { n, file } or { file: null }
// on malformed args. Accepts: "<file>", "-n <N> <file>", "<file> -n <N>"
// (the last form is rare but matches GNU coreutils behavior).
function parseHeadTailArgs(arg) {
  const parts = arg.trim().split(/\s+/);
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
