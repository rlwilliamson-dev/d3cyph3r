// Forensics commands: file (magic byte ID), strings, exif, sha256sum, md5sum.

import { resolveFile } from "../fs/resolve.js";
import { currentPath } from "../engine/state.js";

export const forensicsCommands = {
  file(level, arg) {
    if (!arg) return { text: "Usage: file <filename>  OR  file *", cls: "err" };

    const identify = (name) => {
      if (level.filetypes?.[name]) return level.filetypes[name];
      if (name.endsWith(".txt"))   return "ASCII text";
      if (name.endsWith(".md"))    return "ASCII text";
      if (name.endsWith(".sh"))    return "POSIX shell script, ASCII text executable";
      if (name.endsWith(".py"))    return "Python script, ASCII text executable";
      if (name.endsWith(".log"))   return "ASCII text";
      if (name.endsWith(".bak"))   return "ASCII text";
      if (name.endsWith(".conf") || name.endsWith(".cfg")) return "ASCII text";
      if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPEG image data";
      if (name.endsWith(".png"))   return "PNG image data";
      if (name.endsWith(".pdf"))   return "PDF document";
      if (name.endsWith(".zip"))   return "Zip archive data";
      if (name.endsWith(".gz") || name.endsWith(".tgz")) return "gzip compressed data";
      if (name.endsWith("/"))      return "directory";
      return "data";
    };

    if (arg === "*") {
      const files = Object.keys(level.files).filter(f => !f.endsWith("/"));
      if (files.length === 0) return { text: "(no files)", cls: "dim" };
      const lines = files.map(f => `${f.padEnd(24)}: ${identify(f)}`);
      return { text: lines.join("\n"), cls: "out" };
    }

    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `file: ${arg}: No such file or directory`, cls: "err" };
    return { text: `${arg}: ${identify(file)}`, cls: "out" };
  },

  strings(level, arg) {
    if (!arg) return { text: "Usage: strings <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `strings: ${arg}: No such file`, cls: "err" };

    if (level.stringsOut?.[file]) {
      return { text: level.stringsOut[file].join("\n"), cls: "out" };
    }

    const content = String(level.files[file] || "");
    const printable = content.split("\n")
      .map(l => l.replace(/[^\x20-\x7e]/g, ""))
      .filter(l => l.trim().length >= 4);

    if (printable.length === 0) return { text: "(no printable strings found — file may be truly binary)", cls: "dim" };
    return { text: printable.join("\n"), cls: "out" };
  },

  exif(level, arg) {
    if (!arg) return { text: "Usage: exif <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files))    return { text: `exif: ${arg}: No such file`, cls: "err" };
    if (!level.exifData?.[file])   return { text: `exif: ${arg}: No EXIF data found (not an image, or metadata was stripped)`, cls: "dim" };
    return { text: level.exifData[file].join("\n"), cls: "out" };
  },

  // sha256sum / md5sum: chain-of-custody hashing. Levels can override the
  // computed hash via `level.fileHashes[file] = { sha256, md5 }` when the
  // scenario needs a specific value to compare against (the usual
  // forensic case — "does this hash match what the case file says?").
  //
  // The Web Crypto API is async-only; engine handlers are sync. So when
  // no override is set we fall back to a deterministic content-derived
  // placeholder (NOT a real cryptographic hash). For forensic levels
  // that genuinely compare hashes, the level designer supplies both
  // sides of the comparison via fileHashes — the deterministic fallback
  // exists to keep the command from crashing on files that don't have
  // designed hashes.
  sha256sum(level, arg) {
    if (!arg) return { text: "Usage: sha256sum <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `sha256sum: ${arg}: No such file or directory`, cls: "err" };
    const override = level.fileHashes?.[file]?.sha256;
    const hash = override || syntheticHash(String(level.files[file] || ""), 64);
    return { text: `${hash}  ${arg}`, cls: "out" };
  },

  md5sum(level, arg) {
    if (!arg) return { text: "Usage: md5sum <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `md5sum: ${arg}: No such file or directory`, cls: "err" };
    const override = level.fileHashes?.[file]?.md5;
    const hash = override || syntheticHash(String(level.files[file] || ""), 32);
    return { text: `${hash}  ${arg}`, cls: "out" };
  },
};

// Deterministic content-derived "hash" placeholder. NOT cryptographic.
// Same content → same hash; different content → different hash. That's
// the only property the level engine relies on. Real hashes belong in
// `level.fileHashes`.
function syntheticHash(content, length) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  let hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
  while (hex.length < length) hex += hex.split("").reverse().join("");
  return hex.slice(0, length);
}
