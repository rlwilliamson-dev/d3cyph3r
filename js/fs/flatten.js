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
//
// In v1.9.0 we also promote each level's `network` entries (multi-host
// pivot targets) to top-level LEVELS entries. They get a `pivot: true`
// marker so the lobby doesn't list them as engagements, and their `fs`
// is flattened the same way. Conflict policy: if a network host-key is
// already registered (either as a real level or by another parent's
// network map), it's left as-is — first registration wins. Level
// authors should keep network host-keys unique across levels.
export function initLevels(levels) {
  for (const level of Object.values(levels)) {
    if (level.fs) level.files = flattenFS(level.fs);
    if (!level.files) level.files = {};
  }

  // Promote network hosts. Iterate over a snapshot of entries because
  // we're mutating `levels` during the walk.
  const parentEntries = Object.entries(levels);
  for (const [parentKey, parentLevel] of parentEntries) {
    if (!parentLevel.network) continue;
    for (const [hostKey, host] of Object.entries(parentLevel.network)) {
      if (levels[hostKey]) continue; // already registered — skip
      const promoted = {
        ...host,
        pivot: true,
        track: null,         // pivot hosts don't belong to a track
        password: host.password ?? null,
      };
      if (promoted.fs) promoted.files = flattenFS(promoted.fs);
      if (!promoted.files) promoted.files = {};
      levels[hostKey] = promoted;
    }
  }
  return levels;
}
