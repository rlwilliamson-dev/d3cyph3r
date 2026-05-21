// Linux-track commands: filesystem and text exploration.
// Each handler: (level, arg) → { text, cls } | null

import { currentLevelKey, currentPath, setCurrentPath } from "../engine/state.js";

// Walk the fs tree from level root, following path parts.
function getFSNode(level, pathParts) {
  if (!level.fs) return null;
  let node = level.fs;
  for (const part of pathParts) {
    if (!node.children || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}

function buildDisplayPath() {
  const user = currentLevelKey.split("@")[0];
  const base = `/home/${user}`;
  return currentPath.length === 0 ? base : base + "/" + currentPath.join("/");
}

// Permission metadata helpers. `level.permissions[name]` is shaped
// { mode: "-rw-r--r--", owner: "level1", group: "level1", size: 1024 }
// — a structured object used by both `ls -l` rendering and `cat`'s
// read-permission check. Mode strings follow the standard 10-char
// format: [type][owner rwx][group rwx][other rwx].
function defaultMeta(name) {
  if (name.endsWith("/"))   return { mode: "drwxr-xr-x", owner: "user", group: "user", size: 0   };
  if (name.endsWith(".sh")) return { mode: "-rwxr-xr-x", owner: "user", group: "user", size: 128 };
  return                          { mode: "-rw-r--r--", owner: "user", group: "user", size: 256 };
}

// Simple Unix-style read check. Levels are single-user / single-group,
// so we treat the current level user as also belonging to a primary
// group named the same as the user.
function canReadFile(meta, currentUser) {
  if (!meta || !meta.mode) return true;
  if (currentUser === meta.owner) return meta.mode[1] === "r";
  if (currentUser === meta.group) return meta.mode[4] === "r";
  return meta.mode[7] === "r";
}

export const linuxCommands = {
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
    if (meta && !canReadFile(meta, currentLevelKey.split("@")[0])) {
      return { text: `cat: ${arg}: Permission denied`, cls: "err" };
    }

    if (!node.content) return { text: "(empty file)", cls: "dim" };
    return { text: node.content, cls: "out" };
  },

  pwd() {
    return { text: buildDisplayPath(), cls: "out" };
  },

  whoami() {
    return { text: currentLevelKey.split("@")[0], cls: "out" };
  },

  echo(_level, arg) {
    return { text: arg || "", cls: "out" };
  },

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

    const user = currentLevelKey.split("@")[0];
    return { text: found.map(f => `/home/${user}/` + f).join("\n"), cls: "out" };
  },

  env(level) {
    const vars = level.env_vars;
    if (!vars) return { text: "(no environment variables set on this level)", cls: "dim" };
    const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`);
    return { text: lines.join("\n"), cls: "warn" };
  },
};
