// Crypto-track commands: base64, rot13, xxd, decode-hex, hash-id, john, xor.

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
};
