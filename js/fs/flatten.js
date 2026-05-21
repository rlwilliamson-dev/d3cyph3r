// Flatten a nested fs tree into the legacy flat-file map used by
// content-reading commands (grep, find, base64, rot13, xxd, etc.).
// Directory entries are stored as `path/: null` for `ls -a` parity.
export function flattenFS(node, prefix = "") {
  const out = {};
  if (!node || !node.children) return out;
  for (const [name, child] of Object.entries(node.children)) {
    const path = prefix ? prefix + "/" + name : name;
    if (child.type === "dir") {
      out[path + "/"] = null;
      Object.assign(out, flattenFS(child, path));
    } else {
      out[path] = child.content ?? "";
    }
  }
  return out;
}

// Build the runtime `files` flat map for every level after the level
// data is defined. Called once at module init.
export function initLevels(levels) {
  for (const level of Object.values(levels)) {
    if (level.fs) level.files = flattenFS(level.fs);
    if (!level.files) level.files = {};
  }
  return levels;
}
