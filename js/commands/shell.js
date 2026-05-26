// Shell built-ins: help, clear, report, exit (+ logout alias).
//
// Handler contract: same (level, arg) → { text, cls } | null signature
// as every other command module. (See js/commands/linux.js for the
// broader contract description.)
//
// This module owns the "infrastructure" commands — the ones every
// track shares, that the engine ships with rather than being defined
// per-track. The `help` reference is the canonical surface a player
// sees when running `help` from any prompt.
//
// Forkers note: the `report` command embeds a GitHub issues URL
// pointing at this repo. When forking, update the URL below (or
// disable `report` entirely) so reports don't land on upstream's
// tracker.

import { termEl } from "../terminal/dom.js";
import { print } from "../terminal/output.js";
import { connectTo } from "../engine/ssh.js";
import { currentLevelKey } from "../engine/state.js";
import { LEVELS } from "../../levels/index.js";

const LOBBY = "guest@d3cyph3r";

// Help reference, grouped by track. Sections whose track has no level
// data render dimmed with a "no levels yet" annotation, so the player
// can see what the engine supports without thinking the unshipped
// commands are broken. To add a new track (see CONTRIBUTING.md for
// the full walkthrough):
//   1. Push level data under `levels/<track>.js`.
//   2. Add a section here with `track:` matching that file's level
//      `track:` field — the help dispatcher uses the value verbatim
//      to test for "track has shipped levels".
//   3. Add the same track key to `js/engine/tracks.js` (which the
//      lobby reads to decide which tracks to list).
const HELP_SECTIONS = [
  { track: "linux", title: "LINUX BASICS", lines: [
    "ls / ls -a / ls -l         – list files (all / long format)",
    "ls <dir>                   – list a specific directory",
    "cd <dir>                   – change into a directory (~, .., abs paths ok)",
    "cat <file> [file ...]      – print file contents (multi-file + globs)",
    "head <file> [-n N]         – print first N lines (default 10)",
    "tail <file> [-n N]         – print last N lines (default 10)",
    "stat <file>                – detailed file metadata",
    "diff <file1> <file2>       – show differences between two files",
    "ps                         – list running processes",
    "pwd                        – print working directory",
    "whoami                     – print current user",
    "echo <text>                – print text to terminal",
    "grep <word> [file ...]     – search for word in file(s), stdin, or *",
    "find <path> -name <pat>    – find files matching pattern",
    "env                        – list environment variables",
    "",
    "  Shell features:",
    "    cmd1 | cmd2            – pipe stdout of cmd1 to stdin of cmd2",
    "    *.txt  log?            – wildcards (any chars / single char)",
    "    $USER  $HOME  ${VAR}   – expand shell variables",
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
    "github <user>[/repo]       – GitHub profile, repos, file contents",
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
    "psql [-d <db>] \"<SQL or \\meta>\"  – PostgreSQL client",
  ]},
];

// Infrastructure command groups — text-processing and system-info
// commands that are part of the engine surface (not a specific
// track). These render between LINUX BASICS and the per-track sections
// so a player browsing `help` sees them where they intuit them in a
// real shell.
const HELP_INFRA = [
  { title: "TEXT PROCESSING (pipe-friendly)", lines: [
    "wc [-lwc] [file]           – count lines / words / chars",
    "sort [-n] [-r] [-u] [file] – sort lines (numeric / reverse / unique)",
    "uniq [-c] [file]           – dedupe adjacent lines (-c shows counts)",
    "cut -d <delim> -f <N> ...  – extract delimited columns",
    "tr <set1> <set2>           – translate chars (e.g. a-z A-Z)",
    "tr -d <set>                – delete chars",
    "awk 'PROGRAM' [file]       – column extract + filter (print, $N, /regex/)",
  ]},
  { title: "SYSTEM INFO", lines: [
    "which <cmd>                – locate a command",
    "type <cmd>                 – classify a command (builtin / external)",
    "id                         – print uid / gid / groups",
    "uname [-a/-s/-n/-r/-m]     – kernel / machine info",
    "date                       – current date & time",
    "uptime                     – system uptime + load average",
    "hostname                   – print current host",
  ]},
];

// Learning-aid commands — surface alongside TERMINAL so a player who
// types `help` discovers the self-help layer without having to know
// to look for hint/man/what-is by name.
const HELP_LEARNING = {
  title: "LEARNING AIDS",
  lines: [
    "hint                     – nudge for the current level (advances each call)",
    "hint reset               – rewind hint counter to the first hint",
    "hint list                – show how many hints exist + how many you've seen",
    "man <cmd>                – manual page for a command (NAME / SYNOPSIS / …)",
    "what-is <term>           – glossary lookup (CWE / OWASP / MITRE / FERPA / …)",
  ],
};

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
  // help: dump the per-track command reference. Streams via print()
  // rather than returning a single { text, cls } block because the
  // output mixes CSS classes (per-section headers, body lines, the
  // "no levels yet" annotation). Returns null to suppress the
  // dispatcher's default print.
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

      // Insert the infrastructure groups right after LINUX BASICS so
      // players see text-processing / system-info commands in the
      // intuitive position (alongside the bash basics they extend).
      if (section.title === "LINUX BASICS") {
        for (const infra of HELP_INFRA) {
          print(`  ${infra.title}`, "success");
          for (const line of infra.lines) print("    " + line, "out");
          print("", "out");
        }
      }
    }
    print(`  ${HELP_LEARNING.title}`, "success");
    for (const line of HELP_LEARNING.lines) print("    " + line, "out");
    print("", "out");
    print(`  ${HELP_TERMINAL.title}`, "success");
    for (const line of HELP_TERMINAL.lines) print("    " + line, "out");
    print("", "out");
    return null;
  },

  // clear: wipe the terminal viewport. Mutates DOM directly (cheaper
  // than re-rendering through print()), then returns null so the
  // dispatcher doesn't re-print anything afterwards.
  clear() {
    termEl.innerHTML = "";
    return null;
  },

  // report: surface the bug-report destination. Forkers should change
  // the URL to point at their own issues tracker — see file-header
  // note. `cls: "info"` colors the message blue to distinguish from
  // command output / errors.
  report() {
    return { cls: "info", text:
`Found a bug or have feedback?
Open an issue: https://github.com/rlwilliamson-dev/d3cyph3r/issues` };
  },

  exit:   exitToLobby,
  logout: exitToLobby,
};
