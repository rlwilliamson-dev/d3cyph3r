// Crypto-track commands: base64, rot13, xxd, decode-hex, hash-id,
// john, xor, jwt.
//
// Handler contract: every command exported here has the signature
//   (level, arg) → { text, cls } | null
// (See js/commands/linux.js for the broader contract description.)
//
// Each of these reads from the flat level.files map via resolveFile()
// — the helper does cwd-relative resolution against currentPath, so a
// player can run `base64 deploy.sh` from anywhere in the level (the
// helper falls back to a level-wide search if there's no cwd hit).
//
// Schema fields this module reads off the level object:
//   level.files        flat path → content map. Primary input for
//                      every handler that takes a file argument.
//   level.rot13Out     optional { filename: "curated output" }. Lets
//                      a level pin a specific decoded string when the
//                      computed ROT13 would round-trip noise (e.g. a
//                      mixed-encoding file).
//   level.johnCrack    { filename: { type, plain, wordlist, time } }
//                      The crack result, plaintext, attack metadata.
//                      Required for `john <file>` to succeed; absent
//                      means the level chose not to make this hash
//                      crackable.
//   level.jwtDecode    optional { token: "curated output" } override
//                      for jwt(). Used when a level wants a narrative
//                      layered on top of the decoded JWT (annotations
//                      about CVE class, expiry, etc.) instead of the
//                      generic decoder output.

import { rot13 } from "../util/rot13.js";
import { hexToAscii, isHexString, formatHexDump } from "../util/hex.js";
import { resolveFile } from "../fs/resolve.js";
import { currentPath } from "../engine/state.js";

export const cryptoCommands = {
  // base64: two modes. `base64 -d <string>` decodes a literal string
  // (no file lookup). `base64 <file>` reads the file via resolveFile
  // and decodes its trimmed content. Uses the browser's atob — which
  // is sync, throws on bad input, and accepts standard base64 (NOT
  // base64url; use the jwt handler for base64url decoding).
  base64(level, arg) {
    if (!arg) return { text: "Usage: base64 <file>  OR  base64 -d <string>", cls: "err" };

    if (arg.startsWith("-d ")) {
      const str = arg.slice(3).trim();
      try { return { text: atob(str), cls: "success" }; }
      catch { return { text: "base64: invalid base64 string", cls: "err" }; }
    }

    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `base64: ${arg}: No such file`, cls: "err" };
    try { return { text: atob(level.files[file].trim()), cls: "success" }; }
    catch { return { text: "base64: file content is not valid base64", cls: "err" }; }
  },

  // rot13: file-only (no -d string form). Levels can override the
  // computed output via level.rot13Out — useful when the raw file
  // contains noise the ROT13 round-trip would garble (e.g. a base64
  // string inside the ROT13'd cleartext).
  rot13(level, arg) {
    if (!arg) return { text: "Usage: rot13 <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files))   return { text: `rot13: ${arg}: No such file`, cls: "err" };
    if (level.rot13Out?.[file])   return { text: level.rot13Out[file], cls: "success" };
    return { text: rot13(level.files[file]), cls: "success" };
  },

  // xxd: hex-dump viewer (16 bytes/row + address column + ASCII gutter).
  // Detects hex-encoded input and surfaces a "Tip: decode-hex" hint —
  // a deliberate breadcrumb to teach the difference between viewing a
  // file as hex and decoding hex back to bytes.
  xxd(level, arg) {
    if (!arg) return { text: "Usage: xxd <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `xxd: ${arg}: No such file`, cls: "err" };
    const content = level.files[file];
    if (!content) return { text: "(empty file)", cls: "dim" };

    const dump = formatHexDump(content);
    const tip  = isHexString(content)
      ? "\nTip: this looks like a hex-encoded string. Try: decode-hex " + arg
      : "";
    return { text: dump + tip, cls: "out" };
  },

  // decode-hex: convert a hex-string file to ASCII. Non-printable
  // bytes (outside 0x20-0x7E) render as `.` — mirrors xxd's gutter
  // behavior so the player sees identical "decoded" output regardless
  // of which tool they reach for first.
  "decode-hex"(level, arg) {
    if (!arg) return { text: "Usage: decode-hex <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `decode-hex: ${arg}: No such file`, cls: "err" };
    const ascii = hexToAscii(level.files[file]);
    if (!ascii) return { text: "decode-hex: could not decode — invalid hex data", cls: "err" };
    return { text: ascii, cls: "success" };
  },

  // hash-id: identify the likely hash algorithm by inspecting the
  // file contents. Recognizes MD5 / SHA-1 / SHA-256 (length-based)
  // and bcrypt / SHA-512crypt (prefix-based). Surfaces a "crack with:
  // john <file>" hint when the hash type is known-weak — the same
  // breadcrumb pattern used by xxd → decode-hex.
  "hash-id"(level, arg) {
    if (!arg) return { text: "Usage: hash-id <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `hash-id: ${arg}: No such file`, cls: "err" };
    const h = level.files[file].trim();

    const lines = [`Analyzing: ${h}`, ""];
    if (/^[0-9a-f]{32}$/i.test(h)) {
      lines.push("[+] Possible algorithms:");
      lines.push("    MD5         (most likely — 32 hex chars, very common)");
      lines.push("    MD4");
      lines.push("    NTLM");
      lines.push("");
      lines.push("[!] MD5 is cryptographically broken. Crack with: john " + arg);
    } else if (/^[0-9a-f]{40}$/i.test(h)) {
      lines.push("[+] SHA-1 (40 hex chars)");
      lines.push("[!] SHA-1 is deprecated. Crack with: john " + arg);
    } else if (/^[0-9a-f]{64}$/i.test(h)) {
      lines.push("[+] SHA-256 (64 hex chars) — stronger, but still crackable via wordlists");
    } else if (h.startsWith("$2b$") || h.startsWith("$2y$")) {
      lines.push("[+] bcrypt (cost factor embedded) — resistant to GPU cracking");
    } else if (h.startsWith("$6$")) {
      lines.push("[+] SHA-512crypt — Linux /etc/shadow format");
    } else {
      lines.push("[-] Unknown hash format");
    }
    return { text: lines.join("\n"), cls: "warn" };
  },

  // john: simulated dictionary attack. Reads the crack outcome from
  // level.johnCrack[file] (type / plain / wordlist / time) and prints
  // it inside John's standard banner. Levels that omit johnCrack mean
  // "this hash is not crackable in-game" — typically because the
  // narrative wants the player to chase a different lead instead.
  john(level, arg) {
    if (!arg) return { text: "Usage: john <hashfile>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!level.johnCrack || !level.johnCrack[file]) {
      return { text: `john: ${arg}: no crackable hash found on this level`, cls: "err" };
    }
    const { type, plain, wordlist, time } = level.johnCrack[file];
    const lines = [
      `Using default input encoding: UTF-8`,
      `Loaded 1 password hash (${type})`,
      `Using wordlist: /usr/share/wordlists/${wordlist}`,
      `Press CTRL-C to abort, almost any other key for status`,
      ``,
      `[+] Running dictionary attack...`,
      `[+] Trying top 1000 most common passwords...`,
      ``,
      `${plain.padEnd(20)} (${arg})`,
      ``,
      `1g 0:${time} DONE (2024-01-01 12:00) 100% guesses`,
      `Session completed.`,
    ];
    return { text: lines.join("\n"), cls: "success" };
  },

  // xor: single-byte XOR decryption. File content is interpreted as
  // hex bytes (whitespace stripped); the key is one byte parsed as
  // hex when prefixed `0x` / `0X`, otherwise decimal. Non-printable
  // result bytes render as `.` to match the xxd / decode-hex pattern.
  xor(level, arg) {
    if (!arg) return { text: "Usage: xor <file> <key>  (key e.g. 0x5A or 90)", cls: "err" };
    const parts = arg.trim().split(/\s+/);
    if (parts.length < 2) return { text: "Usage: xor <file> <key>", cls: "err" };

    const [filename, keyStr] = parts;
    const file = resolveFile(level, filename, currentPath);
    if (!(file in level.files)) return { text: `xor: ${filename}: No such file`, cls: "err" };

    const key = keyStr.startsWith("0x") || keyStr.startsWith("0X")
      ? parseInt(keyStr, 16)
      : parseInt(keyStr, 10);
    if (isNaN(key)) return { text: `xor: invalid key '${keyStr}'`, cls: "err" };

    const hex   = level.files[file].replace(/\s/g, "");
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) bytes.push(parseInt(hex.slice(i, i + 2), 16));

    const result = bytes.map(b => {
      const xb = b ^ key;
      return xb >= 32 && xb < 127 ? String.fromCharCode(xb) : ".";
    }).join("");

    return { text: `XOR result (key=0x${key.toString(16).toUpperCase().padStart(2,"0")}): ${result}`, cls: "success" };
  },

  // jwt: decode a JWT (header + payload, signature shown raw). Handles
  // the base64url variant correctly (+→-, /→_, padding stripped) and
  // surfaces common red flags (alg=none, expired, empty signature).
  //
  // Levels can optionally override the output via
  //   level.jwtDecode[token] = "...curated output..."
  // when they want a specific narrative around a known token; otherwise
  // the decoder runs and prints whatever's in the JWT.
  jwt(level, arg) {
    if (!arg) return { text: "Usage: jwt <token>", cls: "err" };
    const token = arg.trim();

    if (level.jwtDecode?.[token]) {
      return { text: level.jwtDecode[token], cls: "warn" };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { text: "jwt: invalid token format (expected three dot-separated segments: header.payload.signature)", cls: "err" };
    }
    const [headerB64, payloadB64, signatureB64] = parts;

    // base64url → base64 → ASCII (atob is sync; perfect for our handlers).
    const decodeB64Url = (s) => {
      const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice(0, (4 - s.length % 4) % 4);
      try { return atob(b64); } catch (_) { return null; }
    };

    const headerJson  = decodeB64Url(headerB64);
    const payloadJson = decodeB64Url(payloadB64);
    if (headerJson === null || payloadJson === null) {
      return { text: "jwt: failed to base64url-decode header or payload segment", cls: "err" };
    }

    let header, payload;
    try { header  = JSON.parse(headerJson);  } catch (_) { header  = { _raw: headerJson  }; }
    try { payload = JSON.parse(payloadJson); } catch (_) { payload = { _raw: payloadJson }; }

    const indent = (s) => s.split("\n").map(l => "  " + l).join("\n");
    const lines = [
      `Decoded JWT`,
      `──────────────────────────────────────────`,
      ``,
      `Header:`,
      indent(JSON.stringify(header, null, 2)),
      ``,
      `Payload:`,
      indent(JSON.stringify(payload, null, 2)),
      ``,
      `Signature (raw, ${signatureB64.length} bytes):`,
      `  ${signatureB64 || "(empty)"}`,
    ];

    // Surface common red flags so the player doesn't have to memorize CVE classes.
    const notes = [];
    const alg = header?.alg;
    if (typeof alg === "string" && alg.toLowerCase() === "none") {
      notes.push(`[!] alg: '${alg}' — server-side acceptance of an unsigned token is a known CVE class (alg=none confusion). Anyone can forge claims.`);
    }
    if (!signatureB64) {
      notes.push(`[!] Signature is empty. Verify the server is actually checking it.`);
    }
    if (payload?.exp && typeof payload.exp === "number") {
      const expMs = payload.exp * 1000;
      const isExpired = expMs < Date.now();
      notes.push(`[*] exp: ${new Date(expMs).toISOString()} (${isExpired ? "EXPIRED" : "valid"})`);
    }
    if (notes.length) {
      lines.push(``, `Notes:`);
      notes.forEach(n => lines.push(`  ${n}`));
    }

    return { text: lines.join("\n"), cls: "warn" };
  },
};
