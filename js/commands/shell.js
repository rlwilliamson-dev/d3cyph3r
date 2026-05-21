// Shell built-ins: help, clear, report.

import { termEl } from "../terminal/dom.js";

export const shellCommands = {
  help() {
    return { cls: "info", text: `
LINUX BASICS
  ls / ls -a / ls -l     – list files (all / long format)
  cd <dir>               – change into a directory
  cd ..                  – go up one directory
  cat <file>             – print file contents
  pwd                    – print working directory
  whoami                 – print current user
  echo <text>            – print text to terminal
  grep <word> <file|*>   – search for word in file(s)
  find <path> -name <pat>– find files matching pattern
  env                    – list environment variables

NETWORK RECON
  nmap <host>            – port scan
  nmap -sV <host>        – port + service version scan
  netstat                – list active connections
  whois <domain>         – WHOIS domain lookup
  dig <domain> [type]    – DNS record lookup

CRYPTOGRAPHY
  base64 <file>          – decode base64 file
  base64 -d <string>     – decode base64 string directly
  rot13 <file>           – ROT13 decode file
  xxd <file>             – hex dump viewer
  decode-hex <file>      – decode hex string → ASCII
  hash-id <file>         – identify hash algorithm
  john <hashfile>        – dictionary attack on hash
  xor <file> <key>       – XOR decrypt (key e.g. 0x5A)

WEB RECON
  curl <url>             – fetch a URL
  curl -I <url>          – fetch HTTP headers only
  gobuster <url>         – brute-force hidden directories
  cookies <url>          – inspect session cookies

FORENSICS
  file <filename>        – identify true file type
  file *                 – identify all files at once
  strings <file>         – extract printable strings
  exif <file>            – read EXIF metadata

TERMINAL
  clear                  – clear the screen
  ssh <user@host>        – connect to a level
  report                 – show how to report bugs
  help                   – show this reference
`.trim() };
  },

  clear() {
    termEl.innerHTML = "";
    return null;
  },

  report() {
    return { cls: "info", text:
`Found a bug or have feedback?
Open an issue: https://github.com/YOUR_USERNAME/d3cyph3r/issues
(replace YOUR_USERNAME with the GitHub handle for this fork)` };
  },
};
