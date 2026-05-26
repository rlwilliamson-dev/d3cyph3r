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
};
