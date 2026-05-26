// Format-inspection commands: openssl x509, tar (tvf / xvf), gunzip,
// zcat.
//
// All three are reflectors over level-defined schema fields. None of
// them actually parse the underlying binary format — level authors
// supply the structured data and the handlers render it in real-tool
// output format. The puzzle value is in WHAT the level chooses to put
// in the certificate / archive / gzip payload (a hidden SAN entry, a
// secret file in the tarball, a cred in a gzipped backup), not in
// the binary parsing itself.
//
// Schema fields read off the level object (all optional):
//
//   level.certs        : { [filename]: {
//                           version?, serial?, sigAlgorithm?,
//                           issuer, subject, notBefore, notAfter,
//                           publicKey?, san?: string[],
//                           keyUsage?: string[], extKeyUsage?: string[],
//                           crlDistributionPoints?: string[],
//                           authorityInfoAccess?: string[],
//                           sctList?: string[],
//                         } }
//                       Rendered by `openssl x509 -text -noout -in <file>`.
//
//   level.tarArchives  : { [filename]: {
//                           entries: [{ mode, owner, group, size,
//                                       mtime, name, type? }],
//                         } }
//                       Rendered by `tar tvf <file>` (verbose list)
//                       and `tar xvf <file>` (same list with the
//                       "x " extraction prefix; no actual write —
//                       the level fs is read-only).
//
//   level.gzipArchives : { [filename]: string }
//                       Decompressed content. Rendered by both
//                       `gunzip <file>` and `zcat <file>` (they
//                       print to stdout in this sandbox; real
//                       gunzip would write to a new file).

import { currentPath } from "../engine/state.js";
import { resolvePath, getFSNode } from "../fs/resolve.js";

// Look up a file by name. Tries the cwd-aware path resolver first,
// then falls back to the level's flat-files map (matches how legacy
// commands like base64 / strings / file resolve their arg).
function locateFile(level, name) {
  if (!name) return null;
  if (level?.fs) {
    const node = getFSNode(level, resolvePath(level, currentPath, name));
    if (node?.type === "file") return name;
  }
  if (level?.files && name in level.files) return name;
  return null;
}

export const formatCommands = {
  // openssl: real openssl is huge; the engine implements one common
  // form — `openssl x509 -text -noout -in <file>`. Renders certificate
  // metadata in canonical openssl output, including SAN entries,
  // key usage flags, and validity dates.
  openssl(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);

    if (tokens.length === 0) {
      return { text: "Usage: openssl x509 -text -noout -in <file>", cls: "err" };
    }
    if (tokens[0] !== "x509") {
      return { text: "openssl: only the 'x509' subcommand is supported in this sandbox", cls: "err" };
    }

    // Find -in <file>; the flag may appear anywhere after `x509`.
    const inIdx = tokens.indexOf("-in");
    const file  = inIdx !== -1 ? tokens[inIdx + 1] : null;
    if (!file) {
      return { text: "Usage: openssl x509 -text -noout -in <file>", cls: "err" };
    }

    const resolved = locateFile(level, file);
    if (!resolved) {
      return { text: `Can't open ${file} for reading, No such file or directory`, cls: "err" };
    }

    const cert = level?.certs?.[file] || level?.certs?.[resolved];
    if (!cert) {
      return { text: `unable to load certificate\n140000000000000:error:0908F066:PEM routines:get_name:bad end line:`, cls: "err" };
    }

    const v = cert.version ?? 3;
    const lines = [
      "Certificate:",
      "    Data:",
      `        Version: ${v} (0x${(v - 1).toString(16)})`,
      `        Serial Number:`,
      `            ${cert.serial || "00:00:00:00"}`,
      `        Signature Algorithm: ${cert.sigAlgorithm || "sha256WithRSAEncryption"}`,
      `        Issuer: ${cert.issuer || "(unknown)"}`,
      "        Validity",
      `            Not Before: ${cert.notBefore || ""}`,
      `            Not After : ${cert.notAfter || ""}`,
      `        Subject: ${cert.subject || "(unknown)"}`,
    ];
    if (cert.publicKey) {
      lines.push("        Subject Public Key Info:");
      lines.push(`            ${cert.publicKey}`);
    }
    if (cert.san || cert.keyUsage || cert.extKeyUsage || cert.crlDistributionPoints || cert.authorityInfoAccess) {
      lines.push("        X509v3 extensions:");
      if (cert.san) {
        lines.push("            X509v3 Subject Alternative Name:");
        lines.push(`                ${cert.san.join(", ")}`);
      }
      if (cert.keyUsage) {
        lines.push("            X509v3 Key Usage: critical");
        lines.push(`                ${cert.keyUsage.join(", ")}`);
      }
      if (cert.extKeyUsage) {
        lines.push("            X509v3 Extended Key Usage:");
        lines.push(`                ${cert.extKeyUsage.join(", ")}`);
      }
      if (cert.crlDistributionPoints) {
        lines.push("            X509v3 CRL Distribution Points:");
        for (const cdp of cert.crlDistributionPoints) lines.push(`                ${cdp}`);
      }
      if (cert.authorityInfoAccess) {
        lines.push("            Authority Information Access:");
        for (const aia of cert.authorityInfoAccess) lines.push(`                ${aia}`);
      }
    }
    if (cert.sctList) {
      lines.push("        CT Precertificate SCTs:");
      for (const sct of cert.sctList) lines.push(`            ${sct}`);
    }
    return { text: lines.join("\n"), cls: "out" };
  },

  // tar: archive operations. Two modes supported:
  //   tar tvf <file>    list contents (long format with permissions)
  //   tar xvf <file>    list with `x ` extraction prefix
  //                     (no actual extraction — the level fs is
  //                      read-only; see schema note above)
  // Any other flag combination prints a usage line.
  tar(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length < 2) {
      return { text: "Usage: tar {tvf|xvf} <file>", cls: "err" };
    }
    const flags = tokens[0];
    const file  = tokens[1];

    const isList    = /^[-]?t/.test(flags) && /v/.test(flags) && /f/.test(flags);
    const isExtract = /^[-]?x/.test(flags) && /v/.test(flags) && /f/.test(flags);
    if (!isList && !isExtract) {
      return { text: "Usage: tar tvf <file>  (list)\n   or: tar xvf <file>  (extract — verbose)", cls: "err" };
    }

    const resolved = locateFile(level, file);
    if (!resolved) {
      return { text: `tar: ${file}: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now`, cls: "err" };
    }
    const arc = level?.tarArchives?.[file] || level?.tarArchives?.[resolved];
    if (!arc || !arc.entries) {
      return { text: `tar: ${file}: This does not look like a tar archive`, cls: "err" };
    }

    const ownerColW = Math.max(8, ...arc.entries.map(e => `${e.owner || "root"}/${e.group || "root"}`.length));
    const sizeColW  = Math.max(5, ...arc.entries.map(e => String(e.size || 0).length));
    const lines = arc.entries.map(e => {
      const og = `${e.owner || "root"}/${e.group || "root"}`;
      const mode = e.mode || (e.type === "dir" ? "drwxr-xr-x" : "-rw-r--r--");
      const sz   = String(e.size || 0).padStart(sizeColW);
      const dt   = e.mtime || "2026-05-22 12:00";
      const prefix = isExtract ? "x " : "";
      return `${prefix}${mode} ${og.padEnd(ownerColW)} ${sz} ${dt} ${e.name}`;
    });
    return { text: lines.join("\n"), cls: "out" };
  },

  // gunzip / zcat: decompress a .gz file and print to stdout. Real
  // gunzip would write a new file; the sandbox is read-only so we
  // match zcat's "print to stdout" semantics for both names.
  gunzip(level, arg) {
    return decompressAndPrint(level, arg, "gunzip");
  },
  zcat(level, arg) {
    return decompressAndPrint(level, arg, "zcat");
  },
};

// Shared implementation for gunzip / zcat. Looks up the file's
// decompressed content in level.gzipArchives, returns it verbatim.
function decompressAndPrint(level, arg, cmd) {
  const file = (arg || "").trim().split(/\s+/)[0];
  if (!file) return { text: `Usage: ${cmd} <file.gz>`, cls: "err" };

  const resolved = locateFile(level, file);
  if (!resolved) {
    return { text: `${cmd}: ${file}: No such file or directory`, cls: "err" };
  }
  const content = level?.gzipArchives?.[file] ?? level?.gzipArchives?.[resolved];
  if (content === undefined) {
    return { text: `${cmd}: ${file}: not in gzip format`, cls: "err" };
  }
  return { text: String(content), cls: "out" };
}
