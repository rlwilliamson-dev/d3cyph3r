// Structured-data commands: jq + gpg. Plus extended openssl
// subcommands beyond the v1.7.0 x509-only support.
//
// "Structured" because these all operate on data that has a
// machine-parseable shape (JSON, GPG-keyring, X.509, raw entropy)
// rather than free-form text. Bundled together because they share
// the same authoring model — level data provides the parsed/derived
// view; the command renders it in canonical tool output.
//
// Schema fields read off the level object (all optional):
//
//   level.gpg = {
//     keys: {
//       public: [{ uid, keyId, fingerprint, created, expires?, type }],
//       secret: [...]
//     },
//     decrypt: { [filename]: "decrypted content" },
//     verify:  { [filename]: { status: "good"|"bad", signer, date } },
//   }
//
//   level.opensslEnc = { [filename]: "decrypted content" }
//   level.opensslSClient = { "<host:port>": {
//     protocol, cipher, cert: { subject, issuer, validity },
//     verification: "OK" | "self-signed" | "expired",
//   } }
//
//   level.opensslHash = { [filename]: { sha256?, sha1?, md5? } }
//
// jq has no schema — operates on JSON content from a file or stdin.

import { currentPath } from "../engine/state.js";
import { resolvePath, getFSNode } from "../fs/resolve.js";
import { renderX509 } from "./format.js";

// ─── jq ────────────────────────────────────────────────────────────

// Minimal jq filter implementation:
//   .                identity (return whole input)
//   .key             object key access
//   .key.nested      chained access
//   .[index]         array index
//   .[]              array iteration (emit each element)
//   .key[]           chained iteration
//   filter | filter  chain filters
//
// Not supported: select(), map(), arithmetic, string interpolation,
// recursive descent, regex, --arg / --argjson, JSON path expressions
// (`paths`, `leaf_paths`). The simplified set covers ~80% of
// CTF / log-triage use cases.

function applyJqFilter(input, filter) {
  // Split on top-level pipes (we don't allow brackets in filter
  // identifiers, so a simple split is fine).
  const stages = filter.split("|").map(s => s.trim()).filter(Boolean);
  let values = [input];
  for (const stage of stages) {
    const next = [];
    for (const v of values) {
      const out = applyJqStage(v, stage);
      if (Array.isArray(out)) next.push(...out);
      else                    next.push(out);
    }
    values = next;
  }
  return values;
}

function applyJqStage(value, stage) {
  if (stage === "." || stage === "") return value;

  // Walk the stage token by token. Each token is one of:
  //   .ident       → object property
  //   [N]          → array index
  //   []           → array iteration (returns array of elements)
  //   .[N], .[]    → same as above with leading .
  let cur = value;
  let i = 0;
  while (i < stage.length) {
    const c = stage[i];
    if (c === ".") { i++; continue; }
    if (c === "[") {
      const close = stage.indexOf("]", i);
      if (close === -1) return null;
      const inner = stage.slice(i + 1, close).trim();
      i = close + 1;
      if (inner === "") {
        // Array iteration → emit each element
        if (!Array.isArray(cur)) return null;
        return cur;
      }
      const idx = parseInt(inner, 10);
      if (isNaN(idx)) {
        // Object key access via `.["key"]`
        const key = inner.replace(/^["']|["']$/g, "");
        cur = (cur && typeof cur === "object") ? cur[key] : null;
        continue;
      }
      cur = Array.isArray(cur) ? cur[idx] : null;
      continue;
    }
    // Identifier
    let j = i;
    while (j < stage.length && /[A-Za-z0-9_]/.test(stage[j])) j++;
    const ident = stage.slice(i, j);
    cur = (cur && typeof cur === "object") ? cur[ident] : null;
    i = j;
  }
  return cur;
}

function loadJsonInput(level, file, stdin) {
  let text;
  if (file) {
    if (level?.fs) {
      const node = getFSNode(level, resolvePath(level, currentPath, file));
      if (!node || node.type !== "file") {
        return { error: `jq: error: Could not open file ${file}: No such file or directory` };
      }
      text = node.content || "";
    } else if (level?.files && file in level.files) {
      text = level.files[file] || "";
    } else {
      return { error: `jq: error: Could not open file ${file}: No such file or directory` };
    }
  } else if (stdin !== undefined) {
    text = String(stdin);
  } else {
    return { error: "jq: error: empty input" };
  }
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { error: `jq: error: Parse error: Invalid JSON (${e.message.split("\n")[0]})` };
  }
}

function formatJqOutput(value, raw, compact) {
  if (raw && typeof value === "string") return value;
  if (value === undefined || value === null) return "null";
  if (compact) return JSON.stringify(value);
  return JSON.stringify(value, null, 2);
}

// ─── openssl extensions ────────────────────────────────────────────
// (the x509 path lives in format.js since v1.7.0; here we add rand,
// dgst, enc, s_client.)

function opensslRand(args) {
  // `openssl rand [-hex] N`
  const hex = args.includes("-hex");
  const nIdx = args.findIndex(t => !t.startsWith("-"));
  const n = nIdx >= 0 ? parseInt(args[nIdx], 10) : NaN;
  if (isNaN(n) || n <= 0 || n > 4096) return { text: "openssl: rand: invalid byte count", cls: "err" };
  const bytes = new Uint8Array(n);
  for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  if (hex) {
    return { text: Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join(""), cls: "out" };
  }
  // base64 default
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return { text: btoa(s), cls: "out" };
}

function opensslDgst(level, args) {
  // `openssl dgst -sha256 <file>` / `openssl dgst -md5 <file>`
  const alg = args.find(t => t.startsWith("-"))?.replace(/^-/, "") || "sha256";
  const file = args.find(t => !t.startsWith("-"));
  if (!file) return { text: `Usage: openssl dgst -${alg} <file>`, cls: "err" };

  // Prefer level-defined hash (so the level author controls the
  // value). Fall back to a notice that no hash is configured.
  const fileHash = level?.opensslHash?.[file];
  if (!fileHash || !fileHash[alg]) {
    return { text: `openssl dgst: no '${alg}' hash configured for ${file}`, cls: "err" };
  }
  return { text: `${alg.toUpperCase()}(${file})= ${fileHash[alg]}`, cls: "out" };
}

function opensslEnc(level, args) {
  // `openssl enc -d -aes-256-cbc -in <file> [-out <out>]` (sandbox: decrypt only)
  if (!args.includes("-d")) {
    return { text: "openssl enc: read-only sandbox supports -d (decrypt) only", cls: "err" };
  }
  const inIdx = args.indexOf("-in");
  const file  = inIdx !== -1 ? args[inIdx + 1] : null;
  if (!file) return { text: "Usage: openssl enc -d -<cipher> -in <file>", cls: "err" };
  const dec = level?.opensslEnc?.[file];
  if (dec === undefined) {
    return { text: `bad decrypt\n140000000000000:error:0606506D:digital envelope routines:EVP_DecryptFinal_ex:wrong final block length:`, cls: "err" };
  }
  return { text: String(dec), cls: "out" };
}

function opensslSClient(level, args) {
  // `openssl s_client -connect host:port [-servername ...]`
  const connIdx = args.indexOf("-connect");
  const target  = connIdx !== -1 ? args[connIdx + 1] : null;
  if (!target) return { text: "Usage: openssl s_client -connect <host:port>", cls: "err" };

  const data = level?.opensslSClient?.[target];
  if (!data) {
    return { text: `connect: Connection refused\nconnect:errno=111`, cls: "err" };
  }

  const lines = [
    `CONNECTED(00000003)`,
    `depth=0 ${data.cert?.subject || "(no subject)"}`,
    `verify return:${data.verification === "OK" ? 1 : 0}`,
    `---`,
    `Certificate chain`,
    ` 0 s:${data.cert?.subject || ""}`,
    `   i:${data.cert?.issuer || ""}`,
    `---`,
    `SSL handshake has read 0 bytes and written 0 bytes`,
    `---`,
    `New, TLSv${(data.protocol || "1.3").replace(/^TLSv/, "")}, Cipher is ${data.cipher || "TLS_AES_256_GCM_SHA384"}`,
    `Server public key is 2048 bit`,
    `Secure Renegotiation IS NOT supported`,
    `Compression: NONE`,
    `Expansion: NONE`,
    `No ALPN negotiated`,
    `SSL-Session:`,
    `    Protocol  : ${data.protocol || "TLSv1.3"}`,
    `    Cipher    : ${data.cipher || "TLS_AES_256_GCM_SHA384"}`,
    `    Verification: ${data.verification === "OK" ? "OK" : data.verification || "self-signed"}`,
    `---`,
  ];
  return { text: lines.join("\n"), cls: "out" };
}

// ─── gpg ───────────────────────────────────────────────────────────

function gpgListKeys(level, secret) {
  const keys = secret ? level?.gpg?.keys?.secret : level?.gpg?.keys?.public;
  if (!keys || keys.length === 0) {
    return { text: "gpg: (no keys)", cls: "dim" };
  }
  const path = secret ? "~/.gnupg/private-keys-v1.d" : "/home/.gnupg/pubring.kbx";
  const lines = [path, "-".repeat(path.length)];
  for (const k of keys) {
    lines.push(`${secret ? "sec" : "pub"}   ${k.type || "rsa2048"} ${k.created || ""} [${k.usage || "SCE"}] [expires: ${k.expires || "never"}]`);
    lines.push(`      ${k.fingerprint || ""}`);
    lines.push(`uid           [ultimate] ${k.uid || ""}`);
    lines.push(``);
  }
  return { text: lines.join("\n").trimEnd(), cls: "out" };
}

function gpgVerify(level, args) {
  const sigfile = args.find(t => !t.startsWith("-"));
  if (!sigfile) return { text: "Usage: gpg --verify <signed-file>", cls: "err" };
  const result = level?.gpg?.verify?.[sigfile];
  if (!result) {
    return { text: `gpg: verify signatures failed: No data`, cls: "err" };
  }
  const sigDate = result.date || "(unknown date)";
  const signer  = result.signer || "(unknown signer)";
  if (result.status === "good") {
    return {
      text:
`gpg: Signature made ${sigDate}
gpg:                using RSA key ${result.keyId || ""}
gpg: Good signature from "${signer}" [ultimate]`,
      cls: "out",
    };
  }
  return {
    text:
`gpg: Signature made ${sigDate}
gpg: BAD signature from "${signer}"`,
    cls: "err",
  };
}

function gpgDecrypt(level, args) {
  const file = args.find(t => !t.startsWith("-"));
  if (!file) return { text: "Usage: gpg --decrypt <file>", cls: "err" };
  const dec = level?.gpg?.decrypt?.[file];
  if (dec === undefined) {
    return { text: `gpg: decrypt_message failed: No secret key`, cls: "err" };
  }
  return { text: String(dec), cls: "out" };
}

// ─── Exports ───────────────────────────────────────────────────────

export const structuredCommands = {
  jq(level, _arg, stdin, argv) {
    const tokens = (argv || []).slice();
    if (tokens.length === 0) return { text: "Usage: jq [-r] [-c] '<filter>' [file]", cls: "err" };
    const raw     = tokens.includes("-r");
    const compact = tokens.includes("-c");
    const positional = tokens.filter(t => !t.startsWith("-"));
    const filter = positional[0];
    const file   = positional[1];
    if (filter === undefined) return { text: "Usage: jq [-r] [-c] '<filter>' [file]", cls: "err" };

    const loaded = loadJsonInput(level, file, stdin);
    if (loaded.error) return { text: loaded.error, cls: "err" };

    const values = applyJqFilter(loaded.value, filter);
    const lines = values.map(v => formatJqOutput(v, raw, compact));
    return { text: lines.join("\n"), cls: "out" };
  },

  gpg(level, _arg, _stdin, argv) {
    const tokens = (argv || []).slice();
    if (tokens.length === 0) {
      return { text: "Usage: gpg --list-keys | --verify <file> | --decrypt <file>", cls: "err" };
    }
    if (tokens.includes("--list-keys") || tokens.includes("-k") || tokens.includes("--list-public-keys")) {
      return gpgListKeys(level, false);
    }
    if (tokens.includes("--list-secret-keys") || tokens.includes("-K")) {
      return gpgListKeys(level, true);
    }
    if (tokens.includes("--verify")) {
      const after = tokens.slice(tokens.indexOf("--verify") + 1);
      return gpgVerify(level, after);
    }
    if (tokens.includes("--decrypt") || tokens.includes("-d")) {
      const flagIdx = Math.max(tokens.indexOf("--decrypt"), tokens.indexOf("-d"));
      const after   = tokens.slice(flagIdx + 1);
      return gpgDecrypt(level, after);
    }
    if (tokens.includes("--fingerprint")) {
      return gpgListKeys(level, false);  // shows the fingerprint line already
    }
    if (tokens.includes("--import")) {
      return { text: "gpg: key imported (sandbox: no actual keyring write)", cls: "dim" };
    }
    return { text: `gpg: unknown option '${tokens.join(" ")}'`, cls: "err" };
  },

  // ↓ Extends the format.js openssl handler. We register the same
  // command name; the dispatcher's last-write-wins means whichever
  // module spreads last into COMMANDS owns the function. We define
  // a unified handler here that delegates to the x509 path (for
  // back-compat) or one of the new subcommands.
  openssl(level, _arg, _stdin, argv) {
    const tokens = (argv || []).slice();
    if (tokens.length === 0) {
      return {
        text:
`Usage: openssl <subcommand> [options]
  x509       parse a certificate (-text -noout -in <file>)
  rand       generate random bytes (-hex N)
  dgst       compute a digest (-sha256 / -md5 <file>)
  enc        decrypt a file (-d -<cipher> -in <file>)
  s_client   TLS handshake info (-connect <host:port>)`,
        cls: "err",
      };
    }
    const sub  = tokens[0];
    const rest = tokens.slice(1);
    switch (sub) {
      case "x509": {
        const inIdx = rest.indexOf("-in");
        const file  = inIdx !== -1 ? rest[inIdx + 1] : null;
        if (!file) return { text: "Usage: openssl x509 -text -noout -in <file>", cls: "err" };
        return renderX509(level, file);
      }
      case "rand":     return opensslRand(rest);
      case "dgst":     return opensslDgst(level, rest);
      case "enc":      return opensslEnc(level, rest);
      case "s_client": return opensslSClient(level, rest);
      default:
        return { text: `openssl: '${sub}' subcommand not supported in this sandbox`, cls: "err" };
    }
  },
};
