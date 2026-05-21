// Forensics commands: file (magic byte ID), strings, exif.

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
};
