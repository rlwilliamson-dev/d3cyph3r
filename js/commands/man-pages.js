// Manual pages for every command shipped by the engine. Surfaced by
// `man <cmd>` (see js/commands/learning.js). Forkers adding a new
// command should also add a MAN_PAGES entry here so the in-game
// reference stays complete.
//
// Format follows the real `man` convention:
//   NAME         <cmd> — one-line summary
//   SYNOPSIS     usage skeleton with flags / args in brackets
//   DESCRIPTION  what it does, what each flag means
//   EXAMPLES     2-4 realistic invocations
//
// Keep entries concise — 8-14 lines is the target. Players who want
// deeper context can read the lessons-learned post-mortem at the end
// of each level or the full walkthrough at /walkthroughs/.
//
// Forker note: writing manpages in JS template strings keeps the
// content alongside the codebase (no separate static-asset fetch).
// The entries are exported as one flat map keyed by command name; the
// `man` handler does a simple lookup.

export const MAN_PAGES = {
  // ─── Linux track ──────────────────────────────────────────────────
  ls: `NAME
    ls — list directory contents

SYNOPSIS
    ls [-a] [-l] [PATH ...]

DESCRIPTION
    Lists the entries in the named directory (or the current directory
    when no path is given). With no flags, only non-hidden entries are
    shown. Supports glob wildcards (\`ls *.txt\`).

    -a   Include entries whose names begin with '.' (dotfiles).
    -l   Long format: mode, owner, group, size, and name.

EXAMPLES
    ls
    ls -la
    ls *.md
    ls /home/daniel
    ls src docs`,

  cd: `NAME
    cd — change the working directory

SYNOPSIS
    cd [PATH]

DESCRIPTION
    Changes the shell's working directory to PATH. With no argument
    or with '~', returns to the level's home directory. Supports
    absolute paths (/home/<user>/...), home expansion (~/foo), and
    chained parent refs (../../bin).

EXAMPLES
    cd src
    cd ..
    cd ../..
    cd ~
    cd /home/daniel`,

  cat: `NAME
    cat — concatenate and print files

SYNOPSIS
    cat FILE [FILE ...]

DESCRIPTION
    Prints the contents of each FILE in sequence. Supports glob
    expansion (\`cat *.md\` concatenates every .md file). Per-file
    errors (missing file, is-a-directory, permission denied) are
    interpolated into the output and the remaining files still
    print, matching real cat's keep-going behavior.

EXAMPLES
    cat notes.txt
    cat welcome.md handoff.md
    cat *.md
    cat $HOME/creds.txt`,

  head: `NAME
    head — print the first lines of a file

SYNOPSIS
    head [-n N] FILE
    <stdin> | head [-n N]

DESCRIPTION
    Prints the first N lines of FILE (default 10). With no FILE arg
    and a pipe upstream, reads from stdin instead.

    -n N   Print the first N lines (must be a positive integer).

EXAMPLES
    head log.txt
    head -n 5 access.log
    cat big.log | head -n 20`,

  tail: `NAME
    tail — print the last lines of a file

SYNOPSIS
    tail [-n N] FILE
    <stdin> | tail [-n N]

DESCRIPTION
    Prints the last N lines of FILE (default 10). With no FILE arg
    and a pipe upstream, reads from stdin instead.

    -n N   Print the last N lines.

EXAMPLES
    tail audit.log
    tail -n 50 messages
    journalctl | tail -n 3`,

  grep: `NAME
    grep — search for a pattern in files

SYNOPSIS
    grep WORD [FILE ...]
    <stdin> | grep WORD

DESCRIPTION
    Case-insensitive substring search. Prints every matching line.
    With multiple files (or glob expansion), each match is prefixed
    with the filename. With no FILE args, searches every file in the
    level (legacy '*' behavior). Piped input is searched without a
    filename prefix.

EXAMPLES
    grep password creds.txt
    grep -r TODO *.md
    grep FAIL *.log
    cat audit.log | grep ERROR`,

  find: `NAME
    find — search for files by pattern

SYNOPSIS
    find PATH -name PATTERN

DESCRIPTION
    Searches the level filesystem for entries whose basenames match
    PATTERN. The pattern supports glob wildcards (* matches any chars,
    ? matches a single char). The PATH argument is parsed but ignored
    — search is always level-global.

EXAMPLES
    find . -name "*.log"
    find /home -name secrets.json
    find . -name "*.key"`,

  pwd: `NAME
    pwd — print the current working directory

SYNOPSIS
    pwd

DESCRIPTION
    Prints the absolute path of the current directory in the form
    /home/<user>[/<subdirs>]. Reflects the in-world identity (level
    .playerUser when set, otherwise the engine slot name).

EXAMPLES
    pwd`,

  whoami: `NAME
    whoami — print the in-world username

SYNOPSIS
    whoami

DESCRIPTION
    Prints the current user's name. Reflects level.playerUser when
    the level defines one (e.g. 'daniel' on level0@linux), otherwise
    the engine slot name (e.g. 'level0', 'guest').

EXAMPLES
    whoami`,

  echo: `NAME
    echo — print text to the terminal

SYNOPSIS
    echo TEXT ...

DESCRIPTION
    Prints its arguments separated by spaces. Shell-var expansion
    runs before echo sees its args, so \$USER / \$HOME / \${VAR} all
    work. Use \$\$ for a literal '\$'.

EXAMPLES
    echo hello world
    echo \$USER
    echo "logged in as \${USER}@\${HOSTNAME}"`,

  env: `NAME
    env — print environment variables

SYNOPSIS
    env

DESCRIPTION
    Prints the level's env_vars map (one KEY=VALUE per line). Levels
    use this to surface fake API keys, deploy tokens, or service
    credentials that the player's session 'inherits' from the
    shell's environment.

EXAMPLES
    env`,

  stat: `NAME
    stat — display detailed file metadata

SYNOPSIS
    stat FILE

DESCRIPTION
    Prints inode-level metadata: size, blocks, mode, uid/gid, atime
    /mtime/ctime. Defaults are synthesized for fields the level
    doesn't override (via level.statData).

EXAMPLES
    stat creds.txt
    stat /var/log/secure`,

  diff: `NAME
    diff — compare two files line by line

SYNOPSIS
    diff FILE1 FILE2

DESCRIPTION
    Reports the per-line differences between FILE1 and FILE2 in the
    classic diff(1) annotation format (Nc N, < old, ---, > new).
    Identical files print '(files are identical)'.

EXAMPLES
    diff staging.env production.env
    diff before.txt after.txt`,

  readlink: `NAME
    readlink — print a symlink's literal target

SYNOPSIS
    readlink PATH

DESCRIPTION
    If PATH is a symbolic link, print its target verbatim (no
    resolution — the string stored in the symlink, including any
    relative \`..\` / \`~\` references). If PATH exists but isn't a
    symlink, prints 'Invalid argument'. If PATH doesn't exist,
    prints 'No such file or directory'.

    Use \`realpath\` instead when you want the fully-resolved
    canonical path.

EXAMPLES
    readlink /usr/bin/python
    readlink .notes`,

  realpath: `NAME
    realpath — resolve a path through symlinks to its canonical form

SYNOPSIS
    realpath PATH

DESCRIPTION
    Prints the canonical absolute path of PATH after resolving every
    symlink in the chain. Symlink cycles abort after 16 hops with
    'No such file or directory'.

    Compare \`readlink\` (one-hop, literal target).

EXAMPLES
    realpath ~/notes
    realpath ../bin/python`,

  ps: `NAME
    ps — list running processes

SYNOPSIS
    ps

DESCRIPTION
    Prints the level's process table (level.processes). Each entry
    shows PID, controlling TTY, accumulated CPU time, and the
    command line. Levels without processes return a graceful empty
    state.

EXAMPLES
    ps`,

  // ─── Network track ────────────────────────────────────────────────
  nmap: `NAME
    nmap — port scanner

SYNOPSIS
    nmap [-sV] HOST

DESCRIPTION
    Scans HOST for open TCP ports. With -sV, additionally probes for
    service / version information. Level designers configure the
    response via level.nmap[host].

    -sV   Service / version detection.

EXAMPLES
    nmap staging.atlas.health
    nmap -sV prod-db.atlas.internal`,

  netstat: `NAME
    netstat — show active network connections

SYNOPSIS
    netstat

DESCRIPTION
    Lists the active TCP connections and listening sockets on the
    current host. Output mimics the legacy 'netstat -tan' format
    most defenders learned on.

EXAMPLES
    netstat`,

  whois: `NAME
    whois — WHOIS domain registry lookup

SYNOPSIS
    whois DOMAIN

DESCRIPTION
    Queries the registry's WHOIS data for DOMAIN. Returns registrar,
    registration / expiry / updated dates, name servers, abuse
    contacts, and DNSSEC status when present.

EXAMPLES
    whois atlas.health
    whois meridian.edu`,

  dig: `NAME
    dig — DNS lookup

SYNOPSIS
    dig DOMAIN [TYPE]

DESCRIPTION
    Looks up DNS records for DOMAIN. TYPE defaults to 'A'; common
    values include A, AAAA, NS, MX, TXT, CNAME, SOA, ANY. The
    special TYPE 'AXFR' attempts a zone transfer — succeeds when
    the level marks the zone as misconfigured-AXFR-allowed,
    otherwise returns REFUSED.

EXAMPLES
    dig atlas.health A
    dig atlas.health TXT
    dig atlas.internal AXFR`,

  // ─── Crypto track ─────────────────────────────────────────────────
  base64: `NAME
    base64 — base64 encode/decode

SYNOPSIS
    base64 FILE
    base64 -d STRING

DESCRIPTION
    Decodes base64-encoded content. With a FILE arg, reads the
    file and decodes its contents. With -d <STRING>, decodes the
    string directly (useful for tokens pasted from the terminal).

    -d   Decode a literal base64 string instead of a file.

EXAMPLES
    base64 api-key.b64
    base64 -d dmVzdGFfcGtfbGl2ZV9...`,

  rot13: `NAME
    rot13 — ROT13 substitution cipher

SYNOPSIS
    rot13 FILE

DESCRIPTION
    Decodes (and equivalently encodes — ROT13 is self-inverse)
    a file whose contents have been shifted by 13 places in the
    Latin alphabet. Non-letter characters pass through unchanged.

EXAMPLES
    rot13 message.txt`,

  xxd: `NAME
    xxd — hexadecimal dump

SYNOPSIS
    xxd FILE

DESCRIPTION
    Prints a side-by-side hex + ASCII view of FILE, 16 bytes per
    line. Useful for inspecting binary files or hunting for magic
    bytes / embedded strings the 'file' command might miss.

EXAMPLES
    xxd suspicious.bin
    xxd photo.jpg | head -n 5`,

  "decode-hex": `NAME
    decode-hex — decode hex string to ASCII

SYNOPSIS
    decode-hex FILE

DESCRIPTION
    Treats FILE's contents as a hex string (whitespace ignored) and
    decodes it back to its original byte sequence, printed as ASCII.
    Errors out cleanly on invalid hex.

EXAMPLES
    decode-hex stash.hex`,

  "hash-id": `NAME
    hash-id — identify a hash algorithm

SYNOPSIS
    hash-id FILE

DESCRIPTION
    Inspects the hash strings in FILE and reports the likely
    algorithm (MD5, SHA-1, SHA-256, NTLM, bcrypt, etc.) based on
    length and format. Useful when an audit log dumped a hash and
    you don't know what cracker to point at it.

EXAMPLES
    hash-id /etc/shadow`,

  john: `NAME
    john — dictionary attack on password hashes

SYNOPSIS
    john HASHFILE

DESCRIPTION
    Attempts a fake dictionary attack against the hashes in HASHFILE.
    Real john-the-ripper runs an actual wordlist; the engine returns
    the level's pre-configured cracking result so the puzzle is
    deterministic.

EXAMPLES
    john shadow.hashes`,

  xor: `NAME
    xor — XOR decrypt with single-byte key

SYNOPSIS
    xor FILE KEY

DESCRIPTION
    XORs each byte of FILE with KEY and prints the result. KEY is
    a single byte expressed as 0xNN (hex) or a decimal integer.

EXAMPLES
    xor encoded.bin 0x5A
    xor secret.xor 42`,

  jwt: `NAME
    jwt — decode a JSON Web Token

SYNOPSIS
    jwt TOKEN

DESCRIPTION
    Splits TOKEN on '.', base64url-decodes the header and payload
    JSON, and prints both. Highlights red flags: 'alg: none',
    empty signature segment, and any other obvious anti-patterns.
    Does NOT verify the signature — that's the puzzle in many JWT
    levels.

EXAMPLES
    jwt eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ...`,

  // ─── Web track ────────────────────────────────────────────────────
  curl: `NAME
    curl — HTTP client

SYNOPSIS
    curl [-I] URL

DESCRIPTION
    Fetches URL and prints the response body to stdout. With -I,
    fetches only the response headers (HEAD request).

    -I   Send a HEAD request; print headers, no body.

EXAMPLES
    curl https://www.meridian.edu/backup/
    curl -I https://api.coverline.example/health
    curl 'https://portal/api/transcript?student_id=M-1872941'`,

  gobuster: `NAME
    gobuster — directory / file brute-forcer

SYNOPSIS
    gobuster URL

DESCRIPTION
    Walks a common-paths wordlist against URL and reports which
    paths return non-404 status codes. Each line shows the path and
    the HTTP status (Status: 200 / 401 / 403 / 301 / ...).

EXAMPLES
    gobuster https://www.meridian.edu`,

  cookies: `NAME
    cookies — inspect HTTP cookies for a URL

SYNOPSIS
    cookies URL

DESCRIPTION
    Sends a request to URL and prints the Set-Cookie headers that
    come back. Useful for confirming session-cookie names, scope
    (Domain / Path), HttpOnly / Secure / SameSite flags, and
    expiration policy.

EXAMPLES
    cookies https://portal.meridian.edu`,

  // ─── Forensics track ──────────────────────────────────────────────
  file: `NAME
    file — identify a file's true type

SYNOPSIS
    file FILE
    file *

DESCRIPTION
    Inspects the magic bytes of FILE and reports the file type
    (JPEG, PNG, PDF, gzip, ELF, etc.) regardless of the extension
    on disk. With '*', identifies every file in the current
    directory at once.

EXAMPLES
    file evidence.jpg
    file *`,

  strings: `NAME
    strings — extract printable strings from a binary

SYNOPSIS
    strings FILE

DESCRIPTION
    Prints every run of printable ASCII characters at least 4 bytes
    long that appears in FILE. Standard first-pass triage technique
    on suspicious binaries / memory dumps / firmware images.

EXAMPLES
    strings suspicious.bin
    strings /usr/bin/sudo | grep VERSION`,

  exif: `NAME
    exif — read EXIF metadata from an image

SYNOPSIS
    exif FILE

DESCRIPTION
    Prints the EXIF tags embedded in FILE: camera make/model, capture
    date, GPS coordinates (lat/long), exposure / focal-length /
    f-stop, and software version. The smoking gun in image-based
    insider-threat investigations.

EXAMPLES
    exif soccer-field.jpg
    exif vacation-photo.jpg`,

  evtx: `NAME
    evtx — Windows Event Log query

SYNOPSIS
    evtx [-id N] FILE

DESCRIPTION
    Parses a Windows Security event log (FILE) and prints its
    records. With -id <N>, filters to records matching Event ID N.
    Common Security-channel IDs: 4624 (logon success), 4625 (logon
    failure), 4634 (logoff), 4663 (object access), 4688 (process
    creation).

EXAMPLES
    evtx Security.evtx
    evtx -id 4625 Security.evtx
    evtx -id 4688 Security.evtx`,

  sha256sum: `NAME
    sha256sum — compute SHA-256 hash of a file

SYNOPSIS
    sha256sum FILE

DESCRIPTION
    Prints the SHA-256 hash of FILE in the conventional
    '<hash>  <file>' format used by sha256sum / shasum -a 256.
    Useful for IoC matching against threat-intel feeds.

EXAMPLES
    sha256sum suspicious.exe`,

  md5sum: `NAME
    md5sum — compute MD5 hash of a file

SYNOPSIS
    md5sum FILE

DESCRIPTION
    Prints the MD5 hash of FILE. MD5 is broken for any
    cryptographic use; it remains useful for non-adversarial
    integrity checks and historical-IoC comparison.

EXAMPLES
    md5sum old-backup.tar`,

  // ─── OSINT track ──────────────────────────────────────────────────
  sherlock: `NAME
    sherlock — username enumeration across social platforms

SYNOPSIS
    sherlock USERNAME

DESCRIPTION
    Checks whether USERNAME is registered on each of ~30 social
    platforms (Twitter, Instagram, LinkedIn, GitHub, Reddit, Strava,
    etc.). Returns the resolved URL for each hit.

EXAMPLES
    sherlock aaron-hines-md`,

  hibp: `NAME
    hibp — Have I Been Pwned breach lookup

SYNOPSIS
    hibp EMAIL

DESCRIPTION
    Queries the HIBP corpus for breaches that exposed EMAIL.
    Returns the breach name, year, date of disclosure, and a flag
    indicating cleartext-credential exposure (vs. salted-hash only).
    Also surfaces CONFIRMED REUSE when the same password appears in
    multiple breaches.

EXAMPLES
    hibp aaron.hines.md@gmail.com`,

  wayback: `NAME
    wayback — Internet Archive snapshot history

SYNOPSIS
    wayback URL

DESCRIPTION
    Lists archived snapshots of URL in the Internet Archive's
    Wayback Machine, with capture date and resulting status code.
    Use to reconstruct a page's prior state, find removed content,
    or pivot on legacy URL paths.

EXAMPLES
    wayback https://veridian-analytics.com`,

  crtsh: `NAME
    crtsh — certificate-transparency subdomain enumeration

SYNOPSIS
    crtsh DOMAIN

DESCRIPTION
    Queries the public certificate-transparency logs (crt.sh) for
    every certificate issued for any subdomain of DOMAIN. Returns
    the subdomain list — often surfaces dev / staging / internal
    hostnames the public DNS hides.

EXAMPLES
    crtsh atlas.health
    crtsh meridian.edu`,

  theharvester: `NAME
    theharvester — email / subdomain / host harvester

SYNOPSIS
    theharvester DOMAIN

DESCRIPTION
    Pulls publicly-visible emails, hostnames, and IPs associated
    with DOMAIN from search engines / WHOIS / DNS sources. Standard
    OSINT-recon starting point.

EXAMPLES
    theharvester veridian.example`,

  shodan: `NAME
    shodan — Shodan host / service search

SYNOPSIS
    shodan QUERY

DESCRIPTION
    Queries Shodan's index of internet-connected devices. QUERY can
    be a hostname, IP, port:N filter, product name, or any combination
    Shodan supports. Returns the matching hosts with port / banner /
    geo / org metadata.

EXAMPLES
    shodan port:5432 product:PostgreSQL
    shodan org:"Veridian Analytics"`,

  ipinfo: `NAME
    ipinfo — IP geolocation + ASN lookup

SYNOPSIS
    ipinfo IP

DESCRIPTION
    Returns the geographic location, ASN, hosting organization,
    and reverse-DNS for IP. Useful for pivoting on a log line that
    only has a source IP.

EXAMPLES
    ipinfo 198.51.100.42`,

  github: `NAME
    github — GitHub OSINT primitive

SYNOPSIS
    github USER
    github USER/REPO
    github USER/REPO file PATH

DESCRIPTION
    Three forms. With just USER, prints the profile and lists the
    user's public repos. With USER/REPO, prints repo metadata and
    the file tree. With 'file PATH', prints the file's contents at
    HEAD.

EXAMPLES
    github aaron-hines-md
    github aaron-hines-md/personal-pgx-tool
    github aaron-hines-md/personal-pgx-tool file .env`,

  // ─── Cloud track ──────────────────────────────────────────────────
  aws: `NAME
    aws — AWS CLI

SYNOPSIS
    aws s3 ls [s3://BUCKET]
    aws s3 cp s3://PATH -
    aws iam list-users
    aws iam list-attached-user-policies --user-name USER
    aws iam get-policy --policy-arn ARN
    aws ec2 describe-instances
    aws ec2 describe-security-groups
    aws sts get-caller-identity

DESCRIPTION
    Cloud-track sandbox of the real aws CLI. Level designers populate
    level.cloud with mock buckets / IAM users / EC2 inventory; the
    handler renders the canonical aws CLI output format.

EXAMPLES
    aws s3 ls
    aws s3 ls --no-sign-request s3://coverline-marketing-public
    aws iam list-users
    aws sts get-caller-identity`,

  psql: `NAME
    psql — PostgreSQL interactive client (read-only sandbox)

SYNOPSIS
    psql [-d DB] "QUERY-OR-META"

DESCRIPTION
    Connects to the level's PostgreSQL instance and runs a single
    SQL statement or meta-command. Supports \\l (list databases),
    \\dt (list tables), and SELECT (with optional LIMIT). DML
    (INSERT / UPDATE / DELETE) is rejected — the sandbox is
    read-only.

EXAMPLES
    psql "\\l"
    psql -d coverline_claims "\\dt"
    psql -d coverline_claims "SELECT * FROM users LIMIT 5"`,

  // ─── Text processing ──────────────────────────────────────────────
  wc: `NAME
    wc — count lines, words, and characters

SYNOPSIS
    wc [-l] [-w] [-c] [FILE]
    <stdin> | wc [...]

DESCRIPTION
    Counts lines, words, and characters in FILE or stdin. With no
    flags, prints all three. Flags compose.

    -l   Lines only.
    -w   Words only.
    -c   Characters only.

EXAMPLES
    wc README.md
    cat *.log | wc -l
    ls | wc -l`,

  sort: `NAME
    sort — sort lines of text

SYNOPSIS
    sort [-n] [-r] [-u] [FILE]
    <stdin> | sort [...]

DESCRIPTION
    Stable line-sort. With no flags, sorts alphabetically.

    -n   Numeric sort (parse leading number; non-numeric → 0).
    -r   Reverse the result.
    -u   Deduplicate (only print unique lines).

EXAMPLES
    sort names.txt
    cat scores.txt | sort -n -r
    cat duplicates.txt | sort -u`,

  uniq: `NAME
    uniq — collapse adjacent duplicate lines

SYNOPSIS
    uniq [-c] [-d] [-u] [FILE]
    <stdin> | uniq [...]

DESCRIPTION
    Collapses runs of identical adjacent lines. Note: catches only
    ADJACENT duplicates — pipe through 'sort' first to catch all.

    -c   Prefix each output line with its run count.
    -d   Print only lines that were duplicated (one per run).
    -u   Print only lines that appeared exactly once.

EXAMPLES
    sort access.log | uniq -c
    sort ips.txt | uniq -d`,

  cut: `NAME
    cut — extract delimited columns

SYNOPSIS
    cut -d DELIM -f FIELDS [FILE]
    <stdin> | cut -d DELIM -f FIELDS

DESCRIPTION
    Splits each line on DELIM (default: tab) and prints the FIELDS
    (comma-separated, 1-indexed; ranges with '-' supported). Missing
    fields render empty.

    -d  Field delimiter (single character).
    -f  Fields to print (e.g. '1,3', '2-4', '1,3-5').

EXAMPLES
    cut -d : -f 1 /etc/passwd
    cut -d , -f 2,4 export.csv
    cat scores.txt | cut -f 1-3`,

  tr: `NAME
    tr — translate or delete characters

SYNOPSIS
    tr SET1 SET2
    tr -d SET
    tr -s SET
    <stdin> | tr [...]

DESCRIPTION
    Translates each character in SET1 to the corresponding character
    in SET2, character-by-character. Ranges like 'a-z' are expanded.
    Reads from stdin only.

    -d   Delete characters in SET instead of translating.
    -s   Squeeze runs of repeated chars in SET to one.

EXAMPLES
    echo hello | tr a-z A-Z
    cat csv.txt | tr , \\t
    echo "  spaced  " | tr -s ' '`,

  awk: `NAME
    awk — column-extracting text processor

SYNOPSIS
    awk 'PROGRAM' [FILE]
    <stdin> | awk 'PROGRAM'

DESCRIPTION
    Simplified awk supporting the most common pattern: extracting
    columns from delimited text. The PROGRAM is one of:

      '{print \$N}'                   print field N from every line
      '{print \$N, \$M}'              print fields N and M (space-joined)
      '/PATTERN/ {print \$N}'        print field N only on matching lines
      '!/PATTERN/ {print \$N}'       print field N on non-matching lines

    The default field separator is whitespace; use -F to change.

    -F SEP   Use SEP as the field separator instead of whitespace.

EXAMPLES
    awk '{print \$1}' access.log
    cat /etc/passwd | awk -F: '{print \$1, \$3}'
    cat audit.log | awk '/ERROR/ {print \$1, \$4}'`,

  // ─── System info ──────────────────────────────────────────────────
  which: `NAME
    which — locate a command

SYNOPSIS
    which CMD

DESCRIPTION
    Prints the path that the shell would execute for CMD. In this
    sandbox, every command is a builtin so the path is fabricated
    as /usr/bin/<cmd>.

EXAMPLES
    which ls
    which grep`,

  type: `NAME
    type — classify a command

SYNOPSIS
    type CMD

DESCRIPTION
    Classifies CMD as a shell builtin, function, alias, or external
    binary. In this sandbox, all known commands report as shell
    builtins.

EXAMPLES
    type ls
    type cd`,

  id: `NAME
    id — print user and group identity

SYNOPSIS
    id

DESCRIPTION
    Prints the current user's uid, primary gid, and supplementary
    groups in the standard 'uid=N(name) gid=N(name) groups=N(name)'
    format.

EXAMPLES
    id`,

  uname: `NAME
    uname — kernel / machine info

SYNOPSIS
    uname [-a] [-s] [-n] [-r] [-v] [-m]

DESCRIPTION
    Prints kernel / system information. With no flags, prints just
    the kernel name (Linux).

    -a   All info, canonical order.
    -s   Kernel name.
    -n   Network node name (hostname).
    -r   Kernel release.
    -v   Kernel version string.
    -m   Machine architecture.

EXAMPLES
    uname
    uname -a
    uname -r`,

  date: `NAME
    date — print current date and time

SYNOPSIS
    date

DESCRIPTION
    Prints the current wall-clock date and time in a fixed
    bash-style format ('Tue May 26 13:55:42 UTC 2026').

EXAMPLES
    date`,

  uptime: `NAME
    uptime — system uptime and load average

SYNOPSIS
    uptime

DESCRIPTION
    Prints the current time, how long the system has been up, the
    logged-in user count, and the 1/5/15-minute load average.

EXAMPLES
    uptime`,

  hostname: `NAME
    hostname — print the system's host name

SYNOPSIS
    hostname

DESCRIPTION
    Prints the host portion of the current level identifier
    (e.g. 'linux' when ssh'd into level0@linux, 'd3cyph3r' at the
    lobby).

EXAMPLES
    hostname`,

  // ─── Network inspection ───────────────────────────────────────────
  ip: `NAME
    ip — show local interfaces and routes (subset)

SYNOPSIS
    ip addr        (alias: ip a)
    ip route       (alias: ip r)

DESCRIPTION
    Modern iproute2 family — we implement two subcommands:

    addr / a   List network interfaces with their IPv4 addresses,
               MTU, state, and link-layer info.
    route / r  Print the kernel routing table.

    Replaces the legacy \`ifconfig\` and \`route\` commands which
    are deprecated on modern systems.

EXAMPLES
    ip addr
    ip a
    ip route`,

  arp: `NAME
    arp — display the kernel ARP cache (-a form)

SYNOPSIS
    arp -a

DESCRIPTION
    Lists entries in the BSD-style ARP cache (hostname / IP / MAC /
    interface). The modern equivalent on Linux is \`ip neigh\`, but
    \`arp -a\` survives in muscle memory and documentation.

EXAMPLES
    arp -a`,

  ping: `NAME
    ping — send ICMP ECHO_REQUEST to a host

SYNOPSIS
    ping HOST

DESCRIPTION
    Sends 4 ICMP echo requests and prints the replies + a summary
    block with min/avg/max/mdev RTTs. Without a name-resolution
    entry, prints "Name or service not known". For unreachable
    hosts, level data can model "Destination Host Unreachable".

EXAMPLES
    ping staging.atlas.health
    ping 10.40.10.5`,

  traceroute: `NAME
    traceroute — print the route packets take to a network host

SYNOPSIS
    traceroute HOST

DESCRIPTION
    Prints the IP hop sequence to HOST with three RTT samples per
    hop. Silent hops render as "* * *". Unresolvable hosts get the
    standard name-resolution error.

EXAMPLES
    traceroute prod-db.atlas.internal
    traceroute 10.40.20.5`,

  nslookup: `NAME
    nslookup — query the DNS resolver

SYNOPSIS
    nslookup HOST

DESCRIPTION
    Prints the resolver address followed by the A record(s) for
    HOST. Companion to the network-track \`dig\` command (which
    supports more record types + zone-transfer queries via AXFR).
    Without a resolver entry for HOST, returns NXDOMAIN.

EXAMPLES
    nslookup atlas.health
    nslookup prod-db.atlas.internal`,

  // ─── Format inspection ────────────────────────────────────────────
  openssl: `NAME
    openssl — cryptography toolkit (x509 subset)

SYNOPSIS
    openssl x509 -text -noout -in FILE

DESCRIPTION
    Real openssl supports dozens of subcommands; the sandbox
    implements one common form: parsing a certificate file and
    printing its fields in human-readable form. Useful for
    inspecting validity dates, subject / issuer DNs, Subject
    Alternative Names (SAN), and X.509v3 extensions.

EXAMPLES
    openssl x509 -text -noout -in portal.crt
    openssl x509 -text -noout -in /etc/ssl/certs/server.pem`,

  tar: `NAME
    tar — archive listing / extraction

SYNOPSIS
    tar tvf FILE     (list contents, verbose)
    tar xvf FILE     (extract — verbose, listing only in this sandbox)

DESCRIPTION
    Real tar manages tape archives — packing, unpacking, listing.
    The sandbox supports two read-only forms: tvf (list every entry
    in the archive with permissions / size / mtime / name) and xvf
    (the same list with an "x " extraction prefix; no actual
    extraction since the level fs is read-only).

EXAMPLES
    tar tvf backup-2026-05-22.tar
    tar xvf staging-export.tar`,

  gunzip: `NAME
    gunzip — decompress a gzip file (sandbox version: prints to stdout)

SYNOPSIS
    gunzip FILE

DESCRIPTION
    Decompress FILE and print the contents. Real gunzip writes a
    new file alongside the original; the sandbox is read-only, so
    this command behaves like zcat — prints decompressed data to
    stdout.

EXAMPLES
    gunzip access.log.gz
    gunzip backup.sql.gz | head -n 10`,

  zcat: `NAME
    zcat — print decompressed contents of a gzip file

SYNOPSIS
    zcat FILE

DESCRIPTION
    Identical to \`gunzip\` in this sandbox — prints the decompressed
    contents of FILE to stdout. Pipe it into grep / head / awk for
    inline analysis without staging the decompressed file on disk.

EXAMPLES
    zcat access.log.gz | grep ERROR
    zcat backup.sql.gz | wc -l`,

  basename: `NAME
    basename — strip directory and suffix from a path

SYNOPSIS
    basename PATH [SUFFIX]

DESCRIPTION
    Prints the final path segment. With an optional SUFFIX arg,
    additionally strips that suffix from the end (typically used to
    drop an extension).

EXAMPLES
    basename /home/daniel/notes.txt          # → notes.txt
    basename /home/daniel/notes.txt .txt     # → notes
    basename src/utils/helper.js .js         # → helper`,

  dirname: `NAME
    dirname — strip the final path segment

SYNOPSIS
    dirname PATH

DESCRIPTION
    Prints the path with its final component removed. Useful in
    shell scripts that need to operate on the directory containing
    a file argument.

EXAMPLES
    dirname /home/daniel/notes.txt   # → /home/daniel
    dirname src/utils/helper.js      # → src/utils
    dirname helper.js                # → .`,

  // ─── System inspection ────────────────────────────────────────────
  crontab: `NAME
    crontab — list a user's cron jobs

SYNOPSIS
    crontab -l [-u USER]

DESCRIPTION
    Prints the named user's crontab (or the current user's by default).
    The sandbox is single-user, so -u <user> works without a privilege
    check. Levels populate \`level.crontab[username]\` with the full
    crontab text.

EXAMPLES
    crontab -l
    crontab -l -u root`,

  last: `NAME
    last — login history

SYNOPSIS
    last

DESCRIPTION
    Prints the recent login history in reverse-chronological order:
    user, TTY, source IP, start / end timestamps, session duration.
    System-boot pseudo-events render as 'reboot   system boot   <kernel>'.

EXAMPLES
    last`,

  who: `NAME
    who — list currently logged-in users (basic)

SYNOPSIS
    who

DESCRIPTION
    Prints one line per active session: user, TTY, login time, source
    address (in parens). See \`w\` for the richer variant with idle /
    JCPU / PCPU / WHAT columns.

EXAMPLES
    who`,

  w: `NAME
    w — currently logged-in users with extended info

SYNOPSIS
    w

DESCRIPTION
    Prints an uptime / load-average header followed by one line per
    active session: user, TTY, source IP, login time, idle time,
    accumulated session CPU (JCPU), foreground process CPU (PCPU),
    and the currently-running command (WHAT).

EXAMPLES
    w`,

  lsof: `NAME
    lsof — list open files

SYNOPSIS
    lsof [-i] [-p PID]

DESCRIPTION
    Prints the open-files table: COMMAND / PID / USER / FD / TYPE /
    DEVICE / SIZE/OFF / NODE / NAME. With -i, restricts to network
    sockets (IPv4 / IPv6). With -p <pid>, restricts to one process.

    -i      Show only network sockets.
    -p PID  Show only files opened by the named process.

EXAMPLES
    lsof
    lsof -i
    lsof -p 842`,

  ss: `NAME
    ss — socket statistics

SYNOPSIS
    ss [-l] [-t] [-u] [-n] [-a] [-p]

DESCRIPTION
    Modern replacement for netstat. Prints the socket table with state,
    queue depths, local / peer addresses, and the owning process. Flags
    compose:

    -l   only LISTEN-state sockets
    -t   only TCP
    -u   only UDP
    -n   numeric (no DNS) — engine output is already numeric
    -a   include non-LISTEN sockets (default already does)
    -p   include process info (always shown)

EXAMPLES
    ss -lt
    ss -tuln`,

  journalctl: `NAME
    journalctl — query the systemd journal

SYNOPSIS
    journalctl [-u UNIT] [-n N] [-r]

DESCRIPTION
    Prints lines from the systemd journal. Without flags, dumps the
    full journal in chronological order.

    -u UNIT   only entries from the named unit (sshd.service or just
              sshd both work)
    -n N      keep only the most recent N entries
    -r        reverse order (newest first)

EXAMPLES
    journalctl
    journalctl -u sshd.service
    journalctl -u staging-worker -n 5
    journalctl -r -n 10`,

  systemctl: `NAME
    systemctl — query systemd unit state (status subset)

SYNOPSIS
    systemctl status UNIT

DESCRIPTION
    Prints the status block for the named unit: load / active / sub
    states, since-timestamp, main PID, command line, task count,
    memory, CPU, cgroup, and the most-recent journal lines for that
    unit. Both 'sshd' and 'sshd.service' resolve to the same unit.

    Only the 'status' subcommand is implemented — start / stop /
    enable / restart are real OS actions the sandbox can't honor.

EXAMPLES
    systemctl status sshd
    systemctl status staging-worker.service`,

  dmesg: `NAME
    dmesg — print the kernel ring buffer

SYNOPSIS
    dmesg

DESCRIPTION
    Prints kernel-level events from the ring buffer: boot messages,
    driver loads, OOM kills, link-state changes, SYN-flood warnings.
    Each line is prefixed with a bracketed seconds-since-boot
    timestamp.

EXAMPLES
    dmesg
    dmesg | tail -n 20`,

  // ─── Version control ──────────────────────────────────────────────
  git: `NAME
    git — local git-repo inspection (read-only)

SYNOPSIS
    git log [--oneline]
    git show <commit>
    git diff [<commit>]
    git status
    git blame <file>
    git config [--list] [<key>]
    git remote -v
    git branch

DESCRIPTION
    The sandbox supports read-only git operations against
    level-defined repo data (level.gitRepos). The classic "credential
    committed to git history" puzzle uses this: \`git log --oneline\`
    surfaces the suspect commit, \`git show <hash>\` reveals what was
    actually committed, \`git blame <file>\` traces authorship.

EXAMPLES
    git log --oneline
    git show 3a4f2e1
    git blame app.py
    git config user.email`,

  // ─── Structured data / crypto ────────────────────────────────────
  jq: `NAME
    jq — JSON path query (simplified)

SYNOPSIS
    jq [-r] [-c] 'FILTER' [FILE]
    <stdin> | jq [...] 'FILTER'

DESCRIPTION
    Apply a JSON filter to FILE (or stdin) and print the matched
    values. Supported filter syntax:

      .            identity (whole input)
      .key         object key access
      .key.nested  chained access
      .arr[N]      array index
      .arr[]       array iteration (emit each element)
      a | b        pipe filters

    -r   raw output (strip quotes on string results)
    -c   compact output (no pretty-print)

EXAMPLES
    cat audit.json | jq '.events[]'
    jq '.users[0].email' members.json
    aws s3 ls --json | jq '.buckets[] | .Name'`,

  gpg: `NAME
    gpg — GnuPG (key inspection / signature verify / decrypt)

SYNOPSIS
    gpg --list-keys        (alias: -k)
    gpg --list-secret-keys (alias: -K)
    gpg --verify <signed-file>
    gpg --decrypt <file>   (alias: -d)
    gpg --fingerprint
    gpg --import <keyfile>

DESCRIPTION
    Inspect the GPG keyring or verify / decrypt files. Read-only —
    no real cryptographic ops; level data is the source of truth.
    Useful for the "verify this signed log" or "decrypt this
    private-key-encrypted file" puzzle shapes.

EXAMPLES
    gpg --list-keys
    gpg --verify advisory.asc
    gpg --decrypt staging.env.gpg`,

  // ─── Small commands ──────────────────────────────────────────────
  printf: `NAME
    printf — formatted output

SYNOPSIS
    printf 'FORMAT' [ARG ...]

DESCRIPTION
    Print formatted output. Format specifiers: %s (string), %d (int),
    %x / %X (hex), %% (literal %). Escapes \\n and \\t are honored.

EXAMPLES
    printf '%s\\n' hello
    printf 'host=%s port=%d\\n' localhost 5432`,

  sed: `NAME
    sed — simplified stream editor

SYNOPSIS
    sed 's/PAT/REPL/[g]' [FILE]
    sed -n 'Np' [FILE]
    sed -n 'M,Np' [FILE]
    <stdin> | sed [...]

DESCRIPTION
    Per-line substitution or print-by-line-number. Real sed is much
    richer (multiple commands via -e, hold space, addresses) — the
    sandbox supports the two most common forms.

EXAMPLES
    cat log | sed 's/ERROR/WARN/g'
    sed -n '5,10p' /etc/passwd`,

  history: `NAME
    history — print command history

SYNOPSIS
    history

DESCRIPTION
    Print the current user's .bash_history (numbered). On the
    sandbox, this surfaces level-pre-populated history rather than
    the current session's typed commands.

EXAMPLES
    history`,

  nc: `NAME
    nc — netcat (TCP port reachability)

SYNOPSIS
    nc -zv HOST PORT

DESCRIPTION
    Test whether HOST:PORT accepts TCP connections. The sandbox
    supports the -zv form only (zero-I/O scan, verbose output).
    Real nc can pipe arbitrary data; the sandbox doesn't support
    interactive I/O.

EXAMPLES
    nc -zv staging.atlas.health 5432
    nc -zv 10.40.10.5 22`,

  host: `NAME
    host — friendly DNS lookup

SYNOPSIS
    host NAME

DESCRIPTION
    Look up NAME and print resolved IP(s) in a compact format.
    Shares schema with nslookup but renders fewer lines.

EXAMPLES
    host atlas.health
    host prod-db.atlas.internal`,

  df: `NAME
    df — disk free

SYNOPSIS
    df [-h]

DESCRIPTION
    Print disk-space usage per filesystem. -h is cosmetic (level
    data is pre-formatted).

EXAMPLES
    df -h`,

  du: `NAME
    du — disk usage

SYNOPSIS
    du [-sh] PATH

DESCRIPTION
    Print disk usage for PATH. -s reports a total (not per-file
    breakdown); -h humanizes the numbers.

EXAMPLES
    du -sh /var/log
    du -sh .`,

  free: `NAME
    free — memory + swap usage

SYNOPSIS
    free [-h]

DESCRIPTION
    Print system memory + swap usage. -h cosmetic.

EXAMPLES
    free -h`,

  // ─── Read-only-fs stubs ──────────────────────────────────────────
  chmod: `NAME
    chmod — change file permissions (READ-ONLY in this sandbox)

SYNOPSIS
    chmod MODE FILE

DESCRIPTION
    The sandbox's filesystem is intentionally read-only (this is an
    audit context, not a live system). \`chmod\` prints the bash
    "Read-only file system" error. To change a file's effective
    permission for a puzzle, the LEVEL AUTHOR sets
    \`level.permissions[FILE]\`.

EXAMPLES
    chmod 600 secrets.env`,

  chown: `NAME
    chown — change file owner (READ-ONLY in this sandbox)

SYNOPSIS
    chown OWNER FILE

DESCRIPTION
    Read-only sandbox — returns "Read-only file system". The level
    author controls file ownership via \`level.permissions[FILE]\`.

EXAMPLES
    chown root creds.txt`,

  mv: `NAME
    mv — move / rename (READ-ONLY in this sandbox)

SYNOPSIS
    mv SOURCE DEST

DESCRIPTION
    Read-only sandbox — returns "Read-only file system". The level
    fs is fixed at module init.

EXAMPLES
    mv old.txt new.txt`,

  cp: `NAME
    cp — copy (READ-ONLY in this sandbox)

SYNOPSIS
    cp SOURCE DEST

DESCRIPTION
    Read-only sandbox — returns "Read-only file system".

EXAMPLES
    cp file.bak file.new`,

  rm: `NAME
    rm — remove (READ-ONLY in this sandbox)

SYNOPSIS
    rm FILE

DESCRIPTION
    Read-only sandbox — returns "Read-only file system".

EXAMPLES
    rm scratch.tmp`,

  mkdir: `NAME
    mkdir — create directory (READ-ONLY in this sandbox)

SYNOPSIS
    mkdir DIR

DESCRIPTION
    Read-only sandbox — returns "Read-only file system".

EXAMPLES
    mkdir new`,

  rmdir: `NAME
    rmdir — remove empty directory (READ-ONLY in this sandbox)

SYNOPSIS
    rmdir DIR

DESCRIPTION
    Read-only sandbox — returns "Read-only file system".

EXAMPLES
    rmdir empty`,

  touch: `NAME
    touch — change file timestamps / create empty file (READ-ONLY)

SYNOPSIS
    touch FILE

DESCRIPTION
    Read-only sandbox — returns "Read-only file system".

EXAMPLES
    touch new.txt`,

  ln: `NAME
    ln — create link (READ-ONLY in this sandbox)

SYNOPSIS
    ln [-s] TARGET LINK

DESCRIPTION
    Read-only sandbox — returns "Read-only file system". Pre-existing
    symlinks defined in level.fs work normally; new ones can't be
    created at runtime.

EXAMPLES
    ln -s notes.txt shortcut`,

  sudo: `NAME
    sudo — execute a command as another user (NO REAL ESCALATION)

SYNOPSIS
    sudo COMMAND [ARGS ...]

DESCRIPTION
    The sandbox has no privilege model. \`sudo <anything>\` prints
    the "incorrect password" error pattern. The terminal exists
    inside an audit context; players who think a level needs root
    have likely misread the puzzle.

EXAMPLES
    sudo cat /etc/shadow`,

  su: `NAME
    su — switch user (NO REAL ESCALATION)

SYNOPSIS
    su [-] [USER]

DESCRIPTION
    Same disposition as \`sudo\` — no real auth, no real shell
    switch. Returns "Authentication failure".`,

  useradd: `NAME
    useradd — create a new user (READ-ONLY in this sandbox)

SYNOPSIS
    useradd USERNAME

DESCRIPTION
    Read-only sandbox — returns the canonical /etc/passwd-lock
    error.`,

  passwd: `NAME
    passwd — change password (READ-ONLY in this sandbox)

SYNOPSIS
    passwd [USERNAME]

DESCRIPTION
    Read-only sandbox — returns the canonical token-manipulation
    error.`,

  // ─── Structural / learning extensions ────────────────────────────
  walkthrough: `NAME
    walkthrough — open the current level's walkthrough in a new tab

SYNOPSIS
    walkthrough

DESCRIPTION
    Open the matching markdown walkthrough at /walkthroughs/#/track/level
    in a new tab. Walkthroughs are spoiler-bearing — only read them
    after solving the level.

EXAMPLES
    walkthrough`,

  achievements: `NAME
    achievements — show every achievement and which you've earned (v1.14.0)

SYNOPSIS
    achievements
    achievements --detail

DESCRIPTION
    Print every achievement available in this version of D3CYPH3R,
    grouped by tier (Easy / Medium / Hard / Completionist). Earned
    achievements show a ★ marker in success green; unearned ones
    show · in dim grey. The description for each is always visible
    — achievements are public motivation, not hidden objectives.

    Run with '--detail' to also see a progress fraction for the
    achievements where progress is measurable (e.g. Polymath "4/7
    tracks with at least one bonus", Sleuth "3/5 bonus finds").
    Boolean-only achievements (e.g. Persistent Player, 1985) show
    no progress line — they're earned or they aren't.

    When an achievement's criteria are first met, an unlock banner
    fires inline:

      ★ Achievement unlocked: <Name>
        <Description>

    Earned achievements persist via the existing v1.11.0
    localStorage mirror — if you've opted in to persistence, the
    earned set survives closing the tab. 'progress reset' clears
    them along with the rest of the tracked state.

EXAMPLES
    achievements
    achievements --detail`,

  theme: `NAME
    theme — switch the terminal palette (v1.13.0)

SYNOPSIS
    theme
    theme <name>
    theme next
    theme prev

DESCRIPTION
    With no arguments, print the currently-active theme. With a
    theme name, switch the entire UI palette — both the main
    terminal and the walkthroughs subsite — to that theme and
    persist the choice to localStorage so it survives reloads
    and tab closes.

    'theme next' / 'theme prev' cycle through the registry order
    (same as clicking the topbar moon/sun icon, which is wired to
    'theme next' under the hood). Wraps at both ends.

    Theme names are case-insensitive. Unknown names print an
    error and leave the current theme untouched. Run 'themes'
    (plural) for the full list with one-line descriptions.

EXAMPLES
    theme
    theme crt-green
    theme synthwave
    theme solarized-light
    theme next`,

  themes: `NAME
    themes — list every available theme (v1.13.0)

SYNOPSIS
    themes

DESCRIPTION
    Print a per-theme one-liner for all 11 themes shipped in
    v1.13.0. The currently-active theme is marked with a '→'
    arrow at the left. Use 'theme <name>' to switch.

    The 11 themes break into three groups:
      * D3CYPH3R originals — dark, light
      * Retro terminal     — crt-green, amber
      * Dev-community favs — synthwave, solarized-dark,
                             solarized-light, high-contrast,
                             nord, gruvbox, dracula

    Each theme spans the entire UI (terminal + walkthroughs
    subsite) and persists across reloads via localStorage.

EXAMPLES
    themes`,

  tutorial: `NAME
    tutorial — guided introduction for new players (v1.12.0)

SYNOPSIS
    tutorial
    tutorial start
    tutorial skip
    tutorial reset

DESCRIPTION
    With no arguments, reprint the FIRST STEPS quickstart list — a
    numbered set of commands ('help', 'tracks', 'tiers', 'progress',
    'ssh level0@linux') that orient a new player in the lobby. The
    same list is shown automatically in the lobby's first-visit
    welcome banner; this command exists so returning players can
    surface it on demand.

    'tutorial start' begins an interactive walk-through that waits
    for the player to type each of those commands in order. If a
    different command is typed, a one-line nudge prints suggesting
    the expected next step but the typed command still runs — the
    walk-through never traps the player. At any prompt, 'skip' (or
    'tutorial skip') exits the walk-through cleanly.

    The walk-through is replayable any time — there's no completion
    flag tied to it. The first-visit welcome banner IS gated, by the
    'seenOnboarding' sessionStorage flag (mirrored to localStorage
    for opted-in players), and 'tutorial reset' clears that flag so
    the banner shows again on the next lobby render (mostly a debug
    aid for forkers).

EXAMPLES
    tutorial
    tutorial start
    tutorial skip
    tutorial reset`,

  progress: `NAME
    progress — list visited levels, bonus finds, and persistence state

SYNOPSIS
    progress
    progress --detail
    progress save-on
    progress save-off
    progress reset

DESCRIPTION
    Print a per-track checklist of every level, marked with ✓ for
    visited or · for not-yet-visited. Levels that declare bonus
    finds also display a [bonuses N/M] counter showing how many
    you've unlocked.

    With --detail, each level's bonus finds are expanded:
    discovered finds list by name with a ✦ marker; un-discovered
    finds render as "[?] hidden — keep exploring" so the listing
    can't be used as a spoiler walkthrough. Unvisited levels show
    only a generic "(visit the level to discover what's here)"
    line — no per-find titles surface until you've entered the
    level once.

    By default, progress lives in sessionStorage — closing the tab
    resets the visited list, bonus finds, and hint counters.
    'progress save-on' opts in to a localStorage mirror so progress
    survives across browser sessions. The data is stored only in
    this browser, never sent to a server, never visible to other
    players. 'progress save-off' stops mirroring AND deletes the
    stored blob (the current tab's sessionStorage is untouched).
    'progress reset' wipes every tracked progress key in BOTH
    stores; the opt-in flag stays as it was, so future progress is
    still saved if you previously opted in.

EXAMPLES
    progress
    progress --detail
    progress save-on
    progress save-off
    progress reset`,

  tiers: `NAME
    tiers — print the difficulty-tier legend

SYNOPSIS
    tiers

DESCRIPTION
    Print the 5-tier difficulty legend (v1.10.0). Each level's tier
    is computed from its level number, not stored manually:

      Routine    (level 0–5)     standard quarterly audit work
      Live       (level 6–10)    active engagement, real contractual
                                 stakes
      Escalated  (level 11–15)   incident response in progress
      Critical   (level 16–20)   notification clocks running, outside
                                 counsel on the call
      Crisis     (level 21+)     the kind of engagement that produces
                                 a public statement

    The label describes the operational state of the engagement
    inside the box, not raw puzzle complexity. A 'Live' level isn't
    merely harder than a 'Routine' one — it carries real time
    pressure and contractual stakes.

    Pivot hosts (multi-host pivot destinations, v1.9.0) are
    non-numbered and therefore have no tier; the lobby tree and
    connection banner suppress the tier label for them.

EXAMPLES
    tiers`,

  tracks: `NAME
    tracks — toggle per-track expand state in the lobby tree

SYNOPSIS
    tracks
    tracks NAME
    tracks all
    tracks reset

DESCRIPTION
    The lobby's AVAILABLE ENGAGEMENTS list renders as a collapsible
    tree (v1.10.0). Each track shows as a one-liner with a chevron;
    expanding a track reveals its per-level ssh invocations, a
    visited/unvisited mark, and the estimated time per level.

    \`tracks\` with no argument prints the current expand state.

    \`tracks NAME\` toggles the named track — if collapsed it
    expands; if expanded it collapses. NAME must match a track key
    from \`js/engine/tracks.js\` (linux, network, crypto, web,
    forensics, osint, cloud).

    \`tracks all\` expands every track.

    \`tracks reset\` (also \`tracks none\`, \`tracks collapse\`)
    collapses every track.

    Expand state persists in sessionStorage; closing the tab
    resets it. Smart default: on the first lobby render of a
    session, tracks containing at least one visited level are
    auto-expanded — once you've started a track, it stays open
    until you explicitly collapse it.

EXAMPLES
    tracks
    tracks linux
    tracks all
    tracks reset`,

  search: `NAME
    search — search visited levels' content for a term

SYNOPSIS
    search TERM

DESCRIPTION
    Search every file in every level you've visited this session
    for TERM (case-insensitive). Prints up to 50 matching lines
    with file path + line number. Spoiler-safe: unvisited levels
    are NOT scanned, so the search doesn't leak content from
    levels you haven't entered.

EXAMPLES
    search CWE-798
    search "Halton"`,

  // ─── Learning aids ────────────────────────────────────────────────
  hint: `NAME
    hint — get a nudge on the current level

SYNOPSIS
    hint
    hint reset
    hint list

DESCRIPTION
    Prints the next hint for the current level. Hints are arranged
    most-subtle to most-direct, so 'hint' once gives a gentle
    pointer; calling it again narrows the search.

    reset   Rewind the hint counter and re-show the first hint.
    list    Show how many hints exist and how many you've seen.

EXAMPLES
    hint
    hint reset
    hint list`,

  man: `NAME
    man — display a command's manual page

SYNOPSIS
    man CMD

DESCRIPTION
    Prints the NAME / SYNOPSIS / DESCRIPTION / EXAMPLES manual page
    for CMD. Try 'man man' for an example, 'man hint' for the
    learning-aid layer, or 'man <any-cmd-from-help>' for any
    shipped command.

EXAMPLES
    man ls
    man jwt
    man hint`,

  "what-is": `NAME
    what-is — glossary lookup

SYNOPSIS
    what-is TERM

DESCRIPTION
    Looks up a term in the in-engine glossary. Covers frameworks
    (NIST, OWASP, MITRE, CIS), regulations (PCI-DSS, HIPAA, FERPA,
    GLBA, CMMC, SOC 2, NAIC, NYDFS), certifications (Security+,
    CySA+, CISSP, OSCP), and core technical concepts (JWT, IDOR,
    AXFR, CWE numbers, MITRE technique IDs).

EXAMPLES
    what-is CWE
    what-is JWT
    what-is CWE-798
    what-is FERPA`,

  // ─── Shell builtins ───────────────────────────────────────────────
  help: `NAME
    help — show the command reference

SYNOPSIS
    help

DESCRIPTION
    Prints the full per-track command reference. Sections for tracks
    you haven't shipped yet render dimmed so you know what's wired
    but unused.

EXAMPLES
    help`,

  clear: `NAME
    clear — clear the terminal screen

SYNOPSIS
    clear

DESCRIPTION
    Wipes the terminal viewport. Doesn't affect command history —
    arrow-up still recalls prior commands.

EXAMPLES
    clear`,

  report: `NAME
    report — show where to report bugs

SYNOPSIS
    report

DESCRIPTION
    Prints the URL of the project's GitHub issue tracker so you can
    file a bug or feature request.

EXAMPLES
    report`,

  ssh: `NAME
    ssh — connect to a level

SYNOPSIS
    ssh USER@HOST

DESCRIPTION
    Connects to a level. USER@HOST identifiers are listed in the
    lobby ('ssh level0@linux', 'ssh level0@network', etc.).
    Password-gated levels prompt for the credential leaked by the
    previous level in the same track.

EXAMPLES
    ssh level0@linux
    ssh level1@network`,

  exit: `NAME
    exit — disconnect and return to the lobby

SYNOPSIS
    exit

DESCRIPTION
    Closes the current connection and drops back to the lobby
    (guest@d3cyph3r). Equivalent to 'logout'.

EXAMPLES
    exit`,

  logout: `NAME
    logout — disconnect and return to the lobby

SYNOPSIS
    logout

DESCRIPTION
    Closes the current connection and drops back to the lobby.
    Alias for 'exit' — provided for muscle memory.

EXAMPLES
    logout`,

  // ─── Shell environment (v1.9.0) ─────────────────────────────────
  export: `NAME
    export — set environment variables

SYNOPSIS
    export NAME[=value] ...
    export -n NAME ...
    export -p
    export

DESCRIPTION
    Sets variables in the current shell's environment. In bash, exported
    variables are inherited by child processes; this sandbox has no
    children, so 'export FOO=bar' and 'FOO=bar' both have the same
    effect (set the variable).

    Variables set via export OVERRIDE the engine's built-in values
    (USER, HOME, PWD, HOSTNAME, PATH, SHELL, LANG, PS1) until you
    'unset' them or switch levels.

    -n   Unexport / remove from the environment.
    -p   Print all exports in 'declare -x NAME=value' form.
    (none) With no arguments, equivalent to -p.

EXAMPLES
    export PS1='\\u@\\h$ '
    export AWS_PROFILE=prod
    export -n AWS_PROFILE
    export`,

  env: `NAME
    env — print or modify the environment

SYNOPSIS
    env [NAME=value ...]
    env

DESCRIPTION
    Without arguments, prints every variable in the merged environment
    in NAME=value form. With NAME=value prefixes, sets those variables
    in the current shell (the trailing 'command [args]' form supported
    by real bash is not implemented — set the variables, then run the
    command on the next line).

EXAMPLES
    env
    env PATH=/sbin:/bin
    env | grep ^AWS`,

  unset: `NAME
    unset — remove variables from the environment

SYNOPSIS
    unset [-v | -f] NAME ...

DESCRIPTION
    Removes each NAME from the shell environment. After 'unset USER',
    the variable resolves back to its built-in value (USER from the
    engine's slot identity). -v and -f are accepted but ignored
    (the sandbox doesn't distinguish shell vars from function names).

EXAMPLES
    unset AWS_PROFILE
    unset PS1   # restores the default prompt`,

  set: `NAME
    set — print the shell environment / set shell options

SYNOPSIS
    set
    set [+-]<flag>...

DESCRIPTION
    With no arguments, prints every variable in the merged environment
    in NAME=value form (same output as 'env'). When called with shell
    flags (-e, -u, -o pipefail, +e, ...) the flags are accepted but
    not acted on — most realistic scripts assume they exist.

EXAMPLES
    set
    set -e
    set -o pipefail`,

  // ─── Job control (v1.9.0) ───────────────────────────────────────
  jobs: `NAME
    jobs — list background jobs

SYNOPSIS
    jobs [-l]

DESCRIPTION
    Lists jobs the shell knows about. Each entry shows job ID, marker
    (+ for current, - for previous, blank otherwise), status, and the
    command line. -l also shows a fake PID.

    NOTE: commands in this sandbox run synchronously, so 'background'
    jobs complete immediately. The job table preserves the bash UX
    (jobs / fg / kill) without true concurrency.

EXAMPLES
    sleep 10 &
    jobs
    jobs -l`,

  fg: `NAME
    fg — bring a background job to the foreground

SYNOPSIS
    fg [%N]

DESCRIPTION
    Removes job %N from the job table and replays its captured output.
    Without an argument, targets the most recent job (%+).

EXAMPLES
    fg %1
    fg`,

  bg: `NAME
    bg — resume a job in the background

SYNOPSIS
    bg [%N]

DESCRIPTION
    Marks job %N as running in the background. In this sandbox the
    job has already completed by the time it appears in the table —
    bg is a no-op acknowledgement.

EXAMPLES
    bg %1
    bg`,

  kill: `NAME
    kill — send a signal to a job or process

SYNOPSIS
    kill [-SIGNAL] %N | PID ...
    kill -s SIGSPEC %N | PID ...

DESCRIPTION
    Removes job %N from the job table. PIDs are not tracked, so
    targeting a numeric PID always reports "No such process".
    The signal flag (-9, -KILL, -s SIGTERM, etc.) is accepted but
    ignored — every signal terminates the job entry.

EXAMPLES
    kill %1
    kill -9 %2
    kill -s TERM %3`,

  wait: `NAME
    wait — block until background jobs complete

SYNOPSIS
    wait [%N]

DESCRIPTION
    All jobs in this sandbox complete synchronously, so 'wait' returns
    immediately. Provided for script compatibility.

EXAMPLES
    wait
    wait %1`,

  disown: `NAME
    disown — remove jobs from the job table

SYNOPSIS
    disown [%N ...]

DESCRIPTION
    Removes the named jobs without printing anything. With no arguments
    clears the entire job table.

EXAMPLES
    disown %1
    disown`,
};
