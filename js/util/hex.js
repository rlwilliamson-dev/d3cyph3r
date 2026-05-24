// Hex helpers shared by xxd / decode-hex / xor.
//
// Three exported helpers + one internal one. All operate on string
// input that may carry whitespace, newlines, or colon separators
// (common in pcap / openssl / hex-dump output) — the cleaning step
// strips those before parsing.
//
// Exports:
//   isHexString(s)       — true if `s` is a valid even-length hex stream
//                          after cleaning. Used by xxd to surface a
//                          "Tip: decode-hex" hint when the file looks
//                          like hex rather than raw bytes.
//   hexToAscii(hex)      — decode hex pairs to ASCII; non-printable
//                          bytes render as `.`
//   formatHexDump(s)     — xxd-style dump: 16 bytes / row + address
//                          column + ASCII gutter

// Strip whitespace and colons, then test for a valid even-length hex stream.
export function isHexString(content) {
  const clean = String(content).replace(/[\s:]/g, "");
  return /^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0;
}

// Treat input as hex bytes if it looks like hex; otherwise as raw chars.
// Returns an array of byte values. The dual interpretation is what
// makes formatHexDump useful both for "this file is hex" (xxd of a
// .hex file) and "this file is binary" (xxd of an unknown file) — the
// dump looks identical from the player's perspective either way.
function bytesOf(content) {
  const clean = String(content).replace(/[\s:]/g, "");
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0) {
    const out = [];
    for (let i = 0; i < clean.length; i += 2) out.push(parseInt(clean.slice(i, i + 2), 16));
    return out;
  }
  const out = [];
  for (let i = 0; i < content.length; i++) out.push(content.charCodeAt(i) & 0xff);
  return out;
}

// Decode hex pairs into ASCII. Non-printable bytes (outside the
// 0x20-0x7E range) become `.` to mirror xxd's ASCII gutter and
// `decode-hex`'s output — the player sees consistent rendering
// regardless of which tool they reach for first.
export function hexToAscii(hex) {
  const clean = String(hex).replace(/[\s:]/g, "");
  let out = "";
  for (let i = 0; i < clean.length - 1; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (!isNaN(byte)) out += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".";
  }
  return out;
}

// xxd-style hex dump: 16 bytes per row, address column, ASCII gutter.
export function formatHexDump(content) {
  const bytes = bytesOf(content);
  const lines = [];
  for (let off = 0; off < bytes.length; off += 16) {
    const chunk = bytes.slice(off, off + 16);
    const addr  = off.toString(16).padStart(8, "0");
    const hex1  = chunk.slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join(" ");
    const hex2  = chunk.slice(8).map(b => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = chunk.map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : ".").join("");
    lines.push(`${addr}: ${hex1.padEnd(23)}  ${hex2.padEnd(23)}  |${ascii}|`);
  }
  return lines.join("\n");
}
