// Crypto-track commands: base64, rot13, xxd, decode-hex, hash-id, john, xor, jwt.

import { rot13 } from "../util/rot13.js";
import { hexToAscii, isHexString, formatHexDump } from "../util/hex.js";
import { resolveFile } from "../fs/resolve.js";
import { currentPath } from "../engine/state.js";

export const cryptoCommands = {
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

  rot13(level, arg) {
    if (!arg) return { text: "Usage: rot13 <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files))   return { text: `rot13: ${arg}: No such file`, cls: "err" };
    if (level.rot13Out?.[file])   return { text: level.rot13Out[file], cls: "success" };
    return { text: rot13(level.files[file]), cls: "success" };
  },

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

  "decode-hex"(level, arg) {
    if (!arg) return { text: "Usage: decode-hex <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `decode-hex: ${arg}: No such file`, cls: "err" };
    const ascii = hexToAscii(level.files[file]);
    if (!ascii) return { text: "decode-hex: could not decode — invalid hex data", cls: "err" };
    return { text: ascii, cls: "success" };
  },

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
