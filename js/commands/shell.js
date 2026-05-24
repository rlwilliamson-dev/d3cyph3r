// Shell built-ins: help, clear, report, exit.

import { termEl } from "../terminal/dom.js";
import { print } from "../terminal/output.js";
import { connectTo } from "../engine/ssh.js";
import { currentLevelKey } from "../engine/state.js";
import { LEVELS } from "../../levels/index.js";

const LOBBY = "guest@d3cyph3r";

// Help reference, grouped by track. Sections whose track has no level
// data render dimmed with a "no levels yet" annotation, so the player
// can see what the engine supports without thinking the unshipped
// commands are broken.
const HELP_SECTIONS = [
  { track: "linux", title: "LINUX BASICS", lines: [
    "ls / ls -a / ls -l         – list files (all / long format)",
    "cd <dir>                   – change into a directory",
    "cd ..                      – go up one directory",
    "cat <file>                 – print file contents",
    "head <file> [-n N]         – print first N lines (default 10)",
    "tail <file> [-n N]         – print last N lines (default 10)",
    "stat <file>                – detailed file metadata",
    "diff <file1> <file2>       – show differences between two files",
    "ps                         – list running processes",
    "pwd                        – print working directory",
    "whoami                     – print current user",
    "echo <text>                – print text to terminal",
    "grep <word> <file|*>       – search for word in file(s)",
    "find <path> -name <pat>    – find files matching pattern",
    "env                        – list environment variables",
  ]},
  { track: "network", title: "NETWORK RECON", lines: [
    "nmap <host>                – port scan",
    "nmap -sV <host>            – port + service version scan",
    "netstat                    – list active connections",
    "whois <domain>             – WHOIS domain lookup",
    "dig <domain> [type]        – DNS record lookup",
  ]},
  { track: "crypto", title: "CRYPTOGRAPHY", lines: [
    "base64 <file>              – decode base64 file",
    "base64 -d <string>         – decode base64 string directly",
    "rot13 <file>               – ROT13 decode file",
    "xxd <file>                 – hex dump viewer",
    "decode-hex <file>          – decode hex string → ASCII",
    "hash-id <file>             – identify hash algorithm",
    "john <hashfile>            – dictionary attack on hash",
    "xor <file> <key>           – XOR decrypt (key e.g. 0x5A)",
    "jwt <token>                – decode JWT header + payload",
  ]},
  { track: "web", title: "WEB RECON", lines: [
    "curl <url>                 – fetch a URL",
    "curl -I <url>              – fetch HTTP headers only",
    "gobuster <url>             – brute-force hidden directories",
    "cookies <url>              – inspect session cookies",
  ]},
  { track: "forensics", title: "FORENSICS", lines: [
    "file <filename>            – identify true file type",
    "file *                     – identify all files at once",
    "strings <file>             – extract printable strings",
    "exif <file>                – read EXIF metadata",
    "evtx [-id N] <file>        – Windows Event Log query (4624/4625/4688)",
    "sha256sum <file>           – print SHA-256 hash of a file",
    "md5sum <file>              – print MD5 hash of a file",
  ]},
  { track: "osint", title: "OPEN-SOURCE INTEL", lines: [
    "sherlock <username>        – check username across social platforms",
    "hibp <email>               – Have I Been Pwned breach lookup",
    "wayback <url>              – Internet Archive snapshot history",
    "crtsh <domain>             – cert-transparency subdomain discovery",
    "theharvester <domain>      – harvest emails, subdomains, hosts",
    "shodan <query>             – Shodan host / service search",
    "ipinfo <ip>                – IP geolocation / ASN / org lookup",
  ]},
  { track: "cloud", title: "CLOUD SECURITY", lines: [
    "aws s3 ls [s3://bucket]    – list buckets or bucket contents",
    "aws s3 cp s3://path -      – fetch S3 object to stdout",
    "aws iam list-users         – list IAM users",
    "aws iam list-attached-user-policies --user-name <user>",
    "aws iam get-policy --policy-arn <arn>",
    "aws ec2 describe-instances",
    "aws ec2 describe-security-groups",
    "aws sts get-caller-identity",
  ]},
];

const HELP_TERMINAL = {
  title: "TERMINAL",
  lines: [
    "clear                    – clear the screen",
    "ssh <user@host>          – connect to a level",
    "exit / logout            – disconnect and return to the lobby",
    "report                   – show how to report bugs",
    "help                     – show this reference",
  ],
};

// Mimics an ssh logout — prints the standard close-msg and drops the
// player back into the lobby. `logout` is an alias for muscle memory.
function exitToLobby() {
  if (currentLevelKey === LOBBY) {
    return { text: "Already at the lobby. Use ssh <user@host> to connect to a level.", cls: "dim" };
  }
  const from = currentLevelKey;
  print("logout", "dim");
  print(`Connection to ${from} closed.`, "dim");
  setTimeout(() => connectTo(LOBBY), 200);
  return null;
}

export const shellCommands = {
  help() {
    print("", "out");
    for (const section of HELP_SECTIONS) {
      const hasLevels = Object.values(LEVELS).some(l => l.track === section.track);
      const headerCls = hasLevels ? "success" : "dim";
      const bodyCls   = hasLevels ? "out"     : "dim";
      const suffix    = hasLevels ? ""        : "  (no levels yet — commands available; no level to use them on)";
      print(`  ${section.title}${suffix}`, headerCls);
      for (const line of section.lines) print("    " + line, bodyCls);
      print("", "out");
    }
    print(`  ${HELP_TERMINAL.title}`, "success");
    for (const line of HELP_TERMINAL.lines) print("    " + line, "out");
    print("", "out");
    return null;
  },

  clear() {
    termEl.innerHTML = "";
    return null;
  },

  report() {
    return { cls: "info", text:
`Found a bug or have feedback?
Open an issue: https://github.com/rlwilliamson-dev/d3cyph3r/issues` };
  },

  exit:   exitToLobby,
  logout: exitToLobby,
};
