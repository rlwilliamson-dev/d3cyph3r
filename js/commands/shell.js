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
import { currentLevelKey, hostStack, popHost } from "../engine/state.js";
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
    "readlink <path>            – print a symlink's literal target",
    "realpath <path>            – resolve symlinks → canonical absolute path",
    "basename <path> [suffix]   – strip directory portion from a path",
    "dirname <path>             – strip basename from a path",
    "env                        – list environment variables",
    "history                    – print the command history",
    "",
    "  Shell features (v1.8.0):",
    "    cmd1 | cmd2            – pipe stdout of cmd1 to stdin of cmd2",
    "    cmd1 && cmd2           – run cmd2 only if cmd1 succeeded",
    "    cmd1 || cmd2           – run cmd2 only if cmd1 failed",
    "    cmd1 ; cmd2            – run both sequentially",
    "    *.txt  log?            – wildcards (any chars / single char)",
    "    {a,b,c}                – brace expansion (cat file{1,2}.txt)",
    "    $USER  $HOME  ${VAR}   – expand shell variables",
    "    $(cmd)                 – command substitution",
    "    $?                     – last command's exit code",
    "    'quoted'  \"quoted\"     – quote-aware tokenization",
    "",
    "  Ctrl-A / Ctrl-E          – jump to start / end of line",
    "  Ctrl-W / Ctrl-U / Ctrl-K – delete word back / clear left / kill right",
    "  Ctrl-Y                   – yank (paste) from the kill ring",
    "  Alt-B / Alt-F            – move backward / forward one word",
    "  Alt-.                    – insert last arg of previous command",
  ]},
  { track: "network", title: "NETWORK RECON", lines: [
    "nmap <host>                – port scan",
    "nmap -sV <host>            – port + service version scan",
    "netstat                    – list active connections",
    "whois <domain>             – WHOIS domain lookup",
    "dig <domain> [type]        – DNS record lookup",
    "nslookup <host>            – DNS lookup (friendlier output)",
    "ping <host>                – ICMP echo",
    "traceroute <host>          – print hop sequence",
    "ip addr / ip a             – list interfaces + IPv4 addresses",
    "ip route / ip r            – kernel routing table",
    "arp -a                     – ARP cache (hostname / IP / MAC / dev)",
    "host <name>                – minimal DNS lookup",
    "nc -zv <host> <port>       – TCP port reachability check",
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
    "sed 's/pat/repl/[g]'       – substitute pattern (use file or stdin)",
    "sed -n 'Np'                – print line N only",
    "printf 'FORMAT' ARGS       – formatted output (%s %d %x %%)",
    "jq '.path' [file]          – JSON path queries (also stdin)",
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
  { title: "SYSTEM INSPECTION", lines: [
    "crontab -l [-u <user>]     – list a user's cron jobs",
    "last                       – login history",
    "who                        – list active sessions (basic)",
    "w                          – list active sessions + idle / what",
    "lsof [-i] [-p <pid>]       – open files (-i: network only)",
    "ss [-l] [-t] [-u] [-n]     – socket stats (listening / TCP / UDP)",
    "journalctl [-u <unit>] [-n N] [-r] – systemd journal",
    "systemctl status <unit>    – service unit status",
    "dmesg                      – kernel ring buffer",
    "df [-h]                    – disk-free table",
    "du [-sh] <path>            – disk usage for a path",
    "free [-h]                  – memory + swap usage",
  ]},
  { title: "FORMAT INSPECTION", lines: [
    "openssl x509 -text -noout -in <file>  – parse + dump X.509 cert",
    "openssl rand -hex N        – random hex bytes (N is byte count)",
    "openssl dgst -sha256 <f>   – compute file digest (md5 / sha1 / sha256)",
    "openssl enc -d -<cipher> -in <f>  – decrypt a file",
    "openssl s_client -connect <h:p>   – TLS handshake info",
    "tar tvf <file>             – list contents of a tar archive",
    "tar xvf <file>             – list contents (sandbox: no actual extract)",
    "gunzip <file> | zcat <file>  – decompress a .gz file to stdout",
    "gpg --list-keys / -K       – list keys (public / secret)",
    "gpg --verify <signed-file> – verify a signed file",
    "gpg --decrypt <file>       – decrypt a file",
  ]},
  { title: "VERSION CONTROL (git)", lines: [
    "git log [--oneline]        – list commits",
    "git show <hash>            – commit metadata + diff",
    "git diff [<hash>]          – diff against working tree or commit",
    "git status                 – working-tree status",
    "git blame <file>           – per-line authorship",
    "git config [--list] [key]  – read repo config",
    "git remote -v              – list remotes",
    "git branch                 – list branches",
  ]},
  { title: "SHELL ENVIRONMENT", lines: [
    "export NAME=value          – set an environment variable",
    "export                     – list every exported variable",
    "export -n NAME             – unexport / remove",
    "env                        – print NAME=value pairs (one per line)",
    "unset NAME                 – remove a variable",
    "set                        – print every variable (same as env)",
    "FOO=bar                    – inline assignment (no `export` keyword)",
    "FOO=bar cmd args           – run cmd with FOO temporarily set",
    "",
    "  PS1 escapes: \\u user · \\h short host · \\H full host · \\w PWD",
    "               \\W basename(PWD) · \\$ literal $ · \\\\ literal \\",
    "  Example: export PS1='\\u@\\h(\\W)\\$ '",
  ]},
  { title: "JOB CONTROL", lines: [
    "cmd &                      – run in background, print [N] PID",
    "jobs [-l]                  – list known jobs",
    "fg [%N]                    – replay job N's output (defaults to last)",
    "bg [%N]                    – mark job N as running in background",
    "kill [-SIG] %N             – remove job N from the table",
    "wait [%N]                  – block until jobs complete (no-op here)",
    "disown [%N]                – silently remove jobs from the table",
    "",
    "  Commands in this sandbox run synchronously — backgrounded jobs",
    "  complete immediately. The table preserves the bash UX without",
    "  true concurrency.",
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
    "walkthrough              – open the current level's walkthrough in a new tab",
    "progress                 – visited levels + bonus-find counts",
    "progress --detail        – list discovered bonus finds by name",
    "progress save-on/off     – opt in / out of saving progress across browser sessions",
    "progress reset           – wipe visited levels, bonus finds, hint counters",
    "achievements             – list every achievement + which you've earned (v1.14.0)",
    "achievements --detail    – also show progress fractions where measurable",
    "tutorial                 – reprint the FIRST STEPS list (lobby quickstart, v1.12.0)",
    "tutorial start           – begin an interactive walk-through; 'skip' exits",
    "search <term>            – search visited levels' lessons-learned for <term>",
  ],
};

const HELP_TERMINAL = {
  title: "TERMINAL",
  lines: [
    "clear                    – clear the screen",
    "ssh <user@host>          – connect to a level",
    "exit / logout            – disconnect and return to the lobby",
    "tracks                   – show lobby-tree expand state",
    "tracks <name>            – toggle expand for one track (e.g. 'tracks linux')",
    "tracks all / reset       – expand every track / collapse every track",
    "tiers                    – show the difficulty-tier legend",
    "themes                   – list every available theme (v1.13.0)",
    "theme <name>             – switch the terminal palette by name",
    "theme next / prev        – cycle through themes in registry order",
    "report                   – show how to report bugs",
    "help                     – show this reference",
  ],
};

// Mimics an ssh logout — prints the standard close-msg and either
// unwinds a multi-host pivot (back to the previous shell) or, if the
// pivot stack is empty, drops the player back into the lobby.
// `logout` is an alias for muscle memory.
function exitToLobby() {
  if (currentLevelKey === LOBBY) {
    return { text: "Already at the lobby. Use ssh <user@host> to connect to a level.", cls: "dim" };
  }

  const from = currentLevelKey;
  print("logout", "dim");
  print(`Connection to ${from} closed.`, "dim");

  // v1.9.0: if we're inside a multi-host pivot, unwind one level
  // instead of bouncing all the way back to the lobby. The pivot was
  // pushed by connectTo() when we ssh'ed in; we pop and reconnect
  // with the unwind flag so connectTo doesn't try to re-manage the
  // stack (caller's already done it). New shell still gets fresh
  // env + jobs — those are per-shell, not per-pivot-direction.
  if (hostStack.length > 0) {
    const previous = popHost();
    setTimeout(() => connectTo(previous.levelKey, { unwind: true }), 200);
    return null;
  }

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

  // history: print the current user's command history. Surfaces the
  // level's pre-populated `.bash_history` if it exists; otherwise the
  // session's typed-command history. (sessionStorage / localStorage
  // persistence is the player's actual history layer; this command
  // shows what's "on disk" rather than what's been typed in-tab.)
  history(level) {
    // Try level.fs first — look up .bash_history wherever it is.
    const bashHistory = level?.files?.[".bash_history"];
    if (bashHistory) {
      const lines = String(bashHistory).split("\n").filter(Boolean);
      const out = lines.map((line, i) => `  ${String(i + 1).padStart(4)}  ${line}`);
      return { text: out.join("\n"), cls: "out" };
    }
    return { text: "(no command history)", cls: "dim" };
  },

  exit:   exitToLobby,
  logout: exitToLobby,
};
