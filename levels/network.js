// Network track levels.
//
// See levels/linux.js for the full schema documentation. Network-specific
// fields used by js/commands/network.js:
//
//   net           — map of hostname → array of { port, state, service, version? }
//                   for the nmap command.
//   netstatData   — array of { proto, local, foreign, state, pid } rows for netstat.
//   whoisData     — map of domain → array of WHOIS output lines.
//   dnsData       — map of domain → { A: [...], MX: [...], TXT: [...], ... } for dig.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm (~600 consultants, ~80 simultaneous engagements). Each
// track introduces a new client engagement to diversify the post-mortems'
// compliance contexts (HIPAA here, GLBA for Halton in the Linux track, etc).

export const networkLevels = {

  // ── level 0 — "Atlas Health Perimeter Check" ────────────────────
  // The player's first network-recon task: verify a healthcare client's
  // claim that their staging environment is VPN-only. nmap reveals that
  // a production-grade postgres is still exposed to the internet, and
  // the engagement notes name a default credential that was never
  // rotated. The lesson is CWE-200 / CWE-668 (Exposure of Sensitive
  // Information / Resource to Wrong Sphere) via the "perimeter drift"
  // anti-pattern, mapped to HIPAA Security Rule and NIST 800-53 SC-7.
  // Introduces `nmap` and `nmap -sV`.
  "level0@network": {
    password: null,
    track: "network",
    title: "Atlas Health VPN audit",
    estimatedMinutes: 12,
    // v1.22.0 cross-track narrative seed — Halton's parallel
    // credential-rotation snapshot in CLOSING THOUGHT.
    crossTrackHooks: ["linux"],
    playerUser: "secops",
    objective: "Verify Atlas Health's claim that their staging environment is VPN-only — and document what's exposed if it isn't.",
    lesson: "Atlas Health is one of Driftwood's largest healthcare clients — they handle PHI for ~400,000 patients across the Pacific Northwest. Their DevOps lead, Marcus, told Priya last quarter that staging.atlas.health is now VPN-only. We do a routine perimeter verification on every client engagement every quarter; today is Atlas's turn. You're on Driftwood's audit workstation (the shell calls you `secops`, the shared service account the security team uses for these checks). Read welcome.md first — it explains nmap. Then read the engagement notes, then start scanning. When you've found what's wrong, read lessons-learned.md.",

    hints: [
      "`cat atlas-perimeter.txt` (the worksheet) lists what each host SHOULD expose. Then `nmap <host>` each one and compare — anything beyond the expected ports is the finding.",
      "Run `nmap -sV` against the staging host to fingerprint the unexpected service. It's a database port that should never face the public internet.",
      "The exposed service is PostgreSQL (5432). The default vendor credential the engagement notes flag as still-live and pending rotation is your password into `level1@network` — read the notes for it.",
    ],

    // v1.10.0 BONUS FINDS — orthogonal lesson surfaced from Priya's
    // engagement-notes audit-trail paragraph. Doesn't gate the
    // credential chain.
    bonusFinds: [
      {
        id:   "five-sprint-rotation",
        name: "The five-sprint rotation that never happened",
        hint: "Priya's audit-trail note records Marcus saying the default credential would be rotated 'next sprint' — five sprints ago. The 'we'll do that next sprint' commitment is the single most reliable predictor of unrotated production credentials. Track promises in the risk register, not Slack.",
        trigger: { command: "cat", argMatches: /engagement-notes\.md/, outputContains: "five sprints" },
      },
    ],

    net: {
      "staging.atlas.health": [
        { port: 22,   state: "open", service: "ssh",        version: "OpenSSH 8.9p1 Ubuntu" },
        { port: 443,  state: "open", service: "https",      version: "nginx 1.18.0"          },
        { port: 5432, state: "open", service: "postgresql", version: "PostgreSQL 13.11"      },
      ],
      "portal.atlas.health": [
        { port: 443, state: "open", service: "https", version: "nginx 1.18.0 (Cloudflare front)" },
      ],
      "api.atlas.health": [
        { port: 443, state: "open", service: "https", version: "nginx 1.18.0 (Cloudflare front)" },
      ],
      "vpn.atlas.health": [
        { port: 443, state: "open", service: "https", version: "OpenVPN 2.5.7 (TLS-Crypt)" },
      ],
    },
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Network Audit Workstation ─────────────

You're logged in as \`secops\` — the security team's shared service
account. The host \`network\` is our network-recon jumpbox for
client perimeter checks.

Today's client: Atlas Health. Last quarter they told us their
staging environment is VPN-only. Today is their quarterly
verification — we check whether that's actually true. If it
isn't, depending on what's exposed, that's a HIPAA breach.


─── NEW COMMANDS ──────────────────────────────────────────────

  nmap <hostname>       Port scan. Lists ports the host has open.
  nmap -sV <hostname>   Same, plus service-version detection.


─── WHAT A PERIMETER AUDIT DOES ───────────────────────────────

When a service runs on a server, it binds to a numbered port and
listens for connections. Common ones:

  22     ssh (admin login)
  80     http (web, unencrypted)
  443    https (web, TLS)
  3306   mysql
  5432   postgresql
  3389   rdp (Windows remote desktop)

The audit asks one question: which ports are open to the internet
on each host? Cross-reference what SHOULD be open (per engagement
docs) against what ACTUALLY is. The gap is the finding.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Atlas Health / Marcus / HIPAA
  2.  cat atlas-perimeter.txt     Hosts in scope + expected ports
  3.  nmap <each host>            Find unexpected open ports
  4.  nmap -sV <surprising host>  Identify the service version
  5.  cat lessons-learned.md      Post-mortem (after step 3-4)
`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Atlas Health — engagement notes

Client: Atlas Health
Vertical: Healthcare (Pacific Northwest regional provider,
          ~400,000 patient records, ~40 clinics)
Engagement: ~14 months, ongoing
Driftwood handler: Priya
Client counterpart: Marcus (DevOps Lead)
Compliance regime: HIPAA Privacy + Security Rules. PHI in scope
                   across all production systems. HITECH breach
                   notification timing applies (60 days max from
                   discovery, faster if 500+ individuals affected).

## The relationship

Atlas Health runs ~200 internal engineers and a DevOps team of 12
that Marcus heads. They've been a Driftwood client for 14 months —
we did their initial cloud migration and have since rolled into
ongoing security support.

Marcus is competent, well-meaning, perpetually under-resourced.
His Slack response time is excellent. His follow-through on
post-meeting action items is not.

## What Atlas told us last quarter

Q1 2026, in a quarterly review meeting, Marcus said the following
on the record:

  "We finished the perimeter lockdown in March. Staging is
   VPN-only now — anyone who needs to hit staging-db has to be on
   Atlas-VPN. No more public exposure of anything in
   staging.*.atlas.health except the VPN endpoint itself."

Priya took the note. The Driftwood quarterly summary went out
based on that statement.

This is the first perimeter verification since that meeting.

## Hosts in scope

See atlas-perimeter.txt. Four hostnames in scope for today's check.

## A thing Marcus said that I'm flagging for the audit trail

Three quarterly meetings ago, Marcus said the staging postgres'
default admin password was \`atlas-default-2025\` "until we finish
the rotation we'll do next sprint." It's been five sprints. If
staging-db is still reachable, that password is probably still
live.

Use that information responsibly. If staging-db turns out to be
reachable from outside the VPN, that combination — exposed port
PLUS a default credential — is a HIPAA-grade finding that needs
same-day escalation. Don't actually connect to confirm; document
the exposure and let Marcus's team do the validation under
controlled conditions.

— Priya
`
        },

        "atlas-perimeter.txt": {
          type: "file",
          content:
`# Atlas Health — perimeter scope
# Hosts Driftwood security audits each quarter, with what SHOULD
# be reachable from outside the Atlas-VPN.
#
# Anything other than 443/https on the public-facing hosts is a
# finding. ANY non-VPN port on staging.* is a finding.

  portal.atlas.health        443         patient portal (public-facing)
  api.atlas.health           443         mobile app API (public-facing)
  vpn.atlas.health           443         VPN endpoint (public-facing)
  staging.atlas.health       (none)      VPN-only as of Q1 2026 per Marcus

# Last updated: 2026-04-08 — Priya (post-quarterly-review)
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just discovered that Atlas Health's staging database is still
exposed to the open internet, three months after their DevOps lead
told us it was VPN-only. The port itself (5432/postgresql) is
enough for a finding. Combined with the default credential Marcus
mentioned and never rotated, it's an active, easily-exploitable
data exposure with HIPAA implications.

─── THE BLUNT VERSION ────────────────────────────────────────

Public-facing database servers are one of the most reliable
indicators of compromise readiness in real-world breach reports.
Shodan and Censys both maintain continuous catalogs of every
postgresql/mysql/mongodb/elasticsearch instance reachable from
the open internet. Attackers query those catalogs by service +
version + geography and walk the results. If your database is on
that list, the question is when, not if.

For a healthcare org specifically, "when" answers in two ways:

  1. Patient data on the wire. PHI is a high-value target for
     extortion and resale. Healthcare breaches command the
     highest per-record costs in industry-wide breach reports
     ($408/record vs $165 cross-industry baseline, IBM Cost
     of a Data Breach 2025; healthcare remains the highest-
     cost industry per the report's 2025 edition).
  2. HITECH notification timing. Atlas would have ~60 days from
     discovery to notify affected individuals, with reporting to
     HHS Office for Civil Rights, and — for breaches affecting
     500+ individuals — public notification via prominent media.
     Atlas has 400,000 patients. A confirmed breach here is
     front-page news.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

The pattern that made this happen is mundane:

  1. Engineering announces a security improvement in a meeting.
  2. Engineering deprioritizes the actual implementation.
  3. Engineering does most of the implementation.
  4. Engineering says it's done, because it's mostly done.
  5. Nothing verifies the claim.
  6. Drift accumulates.

The quarterly perimeter check is the cheap-and-easy version of
step 5. It works because attackers do this same scan continuously.
Defenders should at least do it as often as attackers do.

Driftwood's role here is contractual. The MSA with Atlas requires
us to surface this kind of finding within 24 hours of discovery,
and Priya needs to be in the room when it's communicated to
Marcus — the conversation goes better when there's no surprise.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  HIPAA Security Rule (45 CFR 164.312)
    164.312(a)(1) Access Control — implement technical policies
      that limit electronic access to PHI to authorized parties.
      A publicly-reachable database with default credentials
      fails this control.
    164.312(e)(1) Transmission Security — implement technical
      measures to guard against unauthorized access during
      electronic transmission. Even with TLS, an authenticated
      attacker is "authorized" in transit terms.

  HITECH Act (P.L. 111-5)
    Breach notification: 60 days from discovery to affected
    individuals; HHS OCR notice for 500+ affected; media notice
    for 500+ in the same state/jurisdiction.

  NIST SP 800-53 Rev. 5
    SC-7  Boundary Protection — control the flow of information
      at managed interfaces. The fix is "don't expose 5432 on
      a public IP." This control names that specifically.
    CM-7  Least Functionality — configure systems to provide
      only essential capabilities. Public-internet exposure of
      a staging DB is not essential.

  CIS Critical Security Controls v8.1
    4.5  Implement and Manage a Firewall on End-User Devices —
      the IG1 host-firewall pattern. v8.1's literal scope is
      end-user devices; the equivalent server-tier controls live
      under Control 12 (Network Infrastructure Management) and
      Control 13 (Network Monitoring and Defense). The intent
      Atlas should have honored at the server tier: host- or
      network-level firewalls enforcing "VPN-only" rather than
      relying on undocumented intent.
    13.10 Perform Application Layer Filtering — the right
      enforcement layer for "this DB is reachable only via
      VPN-issued source IPs."

  CWE
    CWE-200 Exposure of Sensitive Information to an
      Unauthorized Actor — the umbrella parent for the
      database exposure (note: CWE-200 is mapping-Discouraged
      in current MITRE guidance; cite the more specific
      CWE-668 / CWE-1392 below for direct mappings).
    CWE-668 Exposure of Resource to Wrong Sphere — the network
      perimeter mistake.
    CWE-1392 Use of Default Credentials — the unrotated
      \`atlas-default-2025\`.

  OWASP Top 10 (2025) — A02: Security Misconfiguration
    Covers public exposure of services that should be internal
    (A05 in the 2021 edition; moved up to A02 in 2025).

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 4 (Security Operations) — vulnerability scanning,
    network reconnaissance tools. nmap is named directly.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 2 (Threat Intelligence
    & Threat Hunting) — active recon. Domain 1 (Security
    Operations) — perimeter monitoring.

  CompTIA PenTest+ (PT0-003)
    Domain 2 (Reconnaissance and Enumeration).

  CISSP
    Domain 3 (Security Architecture and Engineering) — secure
    network architecture. Domain 7 (Security Operations) — incident
    detection and response.

  OSCP / PEN-200
    The first command on every box on the exam is essentially
    \`nmap -sV <target>\`. You just ran the opening play.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1046     — Network Service Discovery. nmap against a target.
  T1595.002 — Active Scanning: Vulnerability Scanning. nmap -sV
              identifying service versions for vulnerability
              correlation.
  T1190     — Exploit Public-Facing Application. What a real
              attacker would do with the finding you just made.
  T1078     — Valid Accounts. The default-credential half of the
              finding maps here too.

T1046 is one of the most common opening techniques in published
threat reports. T1190 is what shows up when the finding goes
unfixed.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Continuous external attack-surface management, not quarterly
     perimeter checks. Tools: Shodan Monitor, Censys ASM, Bishop
     Fox CAST, Microsoft Defender External ASM, Tenable Attack
     Surface Management, Detectify. These run continuously
     against your own perimeter and alert on changes.
  2. Network segmentation enforced at the firewall layer, not
     by convention. AWS Security Groups, GCP firewall rules,
     Azure NSGs, Cloudflare Access — any of them, but the rule
     "staging.* allows only Atlas-VPN source ranges" should
     exist as code that's version-controlled and reviewed.
  3. Bastion / just-in-time access instead of "VPN" as the
     control. HashiCorp Boundary, AWS Systems Manager Session
     Manager, Cloudflare Access, Teleport, Tailscale. These
     replace persistent VPN access with short-lived,
     individually-attributable connections.
  4. Default-credential scanners on every internal asset
     inventory pass. The fact that \`atlas-default-2025\` was
     still live is a separately auditable failure, independent
     of the perimeter exposure. Tools: gitleaks (for code),
     trufflehog (for code + filesystems), Tenable Nessus
     (for hosts via credentialed scans), AWS Inspector, GCP
     Security Command Center.
  5. Quarterly perimeter checks remain the floor, not the
     ceiling. Continuous monitoring is the ceiling.

─── CLOSING THOUGHT ──────────────────────────────────────────

In security, "we've done that" and "it's continuously verified"
mean different things. Marcus's claim was a snapshot. The
quarterly check is the verification. Atlas's perimeter drift is
the gap between the two — and three months of drift was enough
to leave a healthcare production database open to anyone with
nmap and a default credential to try.

Driftwood's banking client Halton ran into a near-identical
pattern: "we rotated those credentials" turned out to mean Q4 of
the previous year, not Q1 of the audit year. Snapshot-as-truth is
a category error, not a one-off.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

  // ── level 1 — "The Map Marcus Didn't Mean to Share" ─────────────
  // Player uses the leaked default credential atlas-default-2025 to
  // ssh into Atlas Health's staging-db host. Priya has authorized a
  // controlled, documented blast-radius check. From the staging-db
  // host, the player can query Atlas's internal DNS resolver — which
  // honors zone-transfer requests from any client. AXFR dumps the
  // full internal map plus a TXT record on `audit-bypass.atlas.internal`
  // that leaks a service-account credential someone stashed during a
  // vendor audit dry-run and never cleaned up. The lesson is CWE-306
  // (Missing Authentication for Critical Function) via the "AXFR-
  // from-anywhere" anti-pattern, plus CWE-200 for the TXT-record
  // credential leak. Introduces `dig <domain> AXFR` as a new flag on
  // an existing command.
  "level1@network": {
    password: "atlas-default-2025",
    track: "network",
    title: "Marcus's leaked DNS map (AXFR)",
    estimatedMinutes: 15,
    playerUser: "dbadmin",
    objective: "Validate the blast radius reachable from the staging-db host before Marcus's team rotates the default credential — and document everything Atlas's internal DNS gives up to a guest with shell access.",
    lesson: "Day two of the Atlas Health audit. Last night's perimeter finding was escalated; Marcus's team patches the firewall this morning and rotates the default credential in Friday's change window. Priya has authorized a one-time, documented blast-radius check. You used `atlas-default-2025` to ssh into staging-db.atlas.health and you're now logged in as `dbadmin` — the default vendor service account, configured with /bin/bash because somebody needed the shell for an upgrade six months ago and never reverted. Read welcome.md (it explains the new tool you'll need today); then priya-note.md for the rules of engagement; then start from the internal DNS resolver. When you've documented the scope, read lessons-learned.md.",

    hints: [
      "Start at the internal DNS resolver. welcome.md's new tool is the zone transfer: `dig atlas.internal AXFR` dumps every record in the zone at once (real servers should restrict this; this one doesn't).",
      "Read the AXFR output top to bottom — the TXT records are the junk drawer where people stash notes that should never have gone into DNS.",
      "One TXT record leaks an `audit-svc` credential — that's your password into `level2@network`.",
    ],

    // v1.10.0 BONUS FINDS — surfaces the welcome.md aside about the
    // vendor service account that still carries /bin/bash. Orthogonal
    // to the AXFR finding; doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "dbadmin-shell-drift",
        name: "Vendor default account with /bin/bash",
        hint: "welcome.md notes that somebody enabled /bin/bash on this vendor service account during an upgrade six months ago and never reverted. A real attacker doing yesterday's exact sequence ends up here. Service accounts should have nologin shells; the 'just for this debug session' exception is how every shipped shell got there.",
        trigger: { command: "cat", argMatches: /welcome\.md/, outputContains: "/bin/bash" },
      },
    ],

    dnsData: {
      "atlas.internal": {
        // AXFR is the payload. Pre-formatted zone-file lines exactly as
        // they should print — the dig handler dumps them between the
        // standard zone-transfer header and footer when AXFR is requested.
        // The audit-bypass TXT record carries the level2 credential
        // breadcrumb (atlas-audit-bypass-2026); the player extracts it
        // from the zone dump rather than from a file on disk.
        AXFR: [
          "atlas.internal.                  3600  IN  SOA   dns.atlas.internal. ops.atlas.health. 2026040901 7200 3600 1209600 3600",
          "atlas.internal.                  3600  IN  NS    dns.atlas.internal.",
          "atlas.internal.                  3600  IN  MX    10 mail.atlas.internal.",
          "dns.atlas.internal.              3600  IN  A     10.40.0.10",
          "mail.atlas.internal.             3600  IN  A     10.40.0.25",
          "jumpbox-vpn.atlas.internal.      3600  IN  A     10.40.0.20",
          "syslog.atlas.internal.           3600  IN  A     10.40.0.30",
          "ntp.atlas.internal.              3600  IN  A     10.40.0.40",
          "staging-db.atlas.internal.       3600  IN  A     10.40.10.5",
          "staging-web.atlas.internal.      3600  IN  A     10.40.10.10",
          "staging-api.atlas.internal.      3600  IN  A     10.40.10.15",
          "prod-db.atlas.internal.          3600  IN  A     10.40.20.5",
          "prod-web.atlas.internal.         3600  IN  A     10.40.20.10",
          "prod-api.atlas.internal.         3600  IN  A     10.40.20.15",
          "phi-warehouse.atlas.internal.    3600  IN  A     10.40.30.8",
          "pacs-imaging.atlas.internal.     3600  IN  A     10.40.30.10",
          "ehr-fhir.atlas.internal.         3600  IN  A     10.40.30.20",
          "backups.atlas.internal.          3600  IN  A     10.40.40.12",
          "audit-bypass.atlas.internal.     3600  IN  A     10.40.99.7",
          'audit-bypass.atlas.internal.     3600  IN  TXT   "audit-bypass DEPRECATED creds — user=audit-svc pass=atlas-audit-bypass-2026 — added 2025-09-12 for Tessera Q4 dry-run, scheduled removal end of Q4"',
          'atlas.internal.                  3600  IN  TXT   "v=spf1 ip4:10.40.0.0/16 -all"',
          "atlas.internal.                  3600  IN  SOA   dns.atlas.internal. ops.atlas.health. 2026040901 7200 3600 1209600 3600",
        ],
        // Standard non-AXFR queries still resolve, so curious players who
        // try `dig atlas.internal` first see normal-looking output before
        // they discover the AXFR vector.
        A: ["10.40.0.10"],
        NS: ["dns.atlas.internal."],
      },
    },

    // v1.7.0 NETWORK INSPECTION — local interface / routing / ARP /
    // reachability data so the dbadmin shell on staging-db.atlas.health
    // can demonstrate `ip addr`, `ip route`, `arp -a`, `ping`,
    // `traceroute`, and `nslookup`. The reachable hosts are the same
    // internal-zone targets the AXFR puzzle surfaced — players can
    // verify reachability after enumerating the zone.
    netInterfaces: [
      { name: "eth0", mac: "52:54:00:12:34:56", ipv4: "10.40.10.5", ipv4Prefix: 24, broadcast: "10.40.10.255" },
    ],
    routes: [
      { destination: "default",      via: "10.40.10.1", dev: "eth0", proto: "dhcp",   src: "10.40.10.5", metric: 100 },
      { destination: "10.40.10.0/24",                    dev: "eth0", proto: "kernel", scope: "link", src: "10.40.10.5" },
    ],
    arpCache: [
      { hostname: "gateway",                       ip: "10.40.10.1",  mac: "52:54:00:12:34:01", dev: "eth0" },
      { hostname: "staging-web.atlas.internal",    ip: "10.40.10.10", mac: "52:54:00:ab:cd:11", dev: "eth0" },
      { hostname: "staging-api.atlas.internal",    ip: "10.40.10.15", mac: "52:54:00:ab:cd:22", dev: "eth0" },
    ],
    pingResults: {
      "10.40.10.1":                      { resolvedIp: "10.40.10.1",  rtts: [0.234, 0.187, 0.201, 0.195] },
      "staging-web.atlas.internal":      { resolvedIp: "10.40.10.10", rtts: [0.412, 0.398, 0.405, 0.421] },
      "prod-db.atlas.internal":          { resolvedIp: "10.40.20.5",  rtts: [1.245, 1.198, 1.221, 1.265] },
      "phi-warehouse.atlas.internal":    { resolvedIp: "10.40.30.8",  rtts: [1.534, 1.512, 1.498, 1.523] },
      "audit-bypass.atlas.internal":     { resolvedIp: "10.40.99.7",  rtts: [2.012, 1.987, 2.001, 2.034] },
    },
    tracerouteResults: {
      "prod-db.atlas.internal": {
        resolvedIp: "10.40.20.5",
        hops: [
          { n: 1, hostname: "gateway",                     ip: "10.40.10.1",  rtts: [0.234, 0.198, 0.187] },
          { n: 2, hostname: "core-router.atlas.internal",  ip: "10.40.0.1",   rtts: [0.456, 0.412, 0.398] },
          { n: 3, hostname: "prod-db.atlas.internal",      ip: "10.40.20.5",  rtts: [1.245, 1.198, 1.221] },
        ],
      },
      "audit-bypass.atlas.internal": {
        resolvedIp: "10.40.99.7",
        hops: [
          { n: 1, hostname: "gateway",                     ip: "10.40.10.1",  rtts: [0.234, 0.198, 0.187] },
          { n: 2, hostname: "core-router.atlas.internal",  ip: "10.40.0.1",   rtts: [0.456, 0.412, 0.398] },
          { n: 3, hostname: "deprecated-bypass-host.atlas.internal", ip: "10.40.99.7", rtts: [2.012, 1.987, 2.001] },
        ],
      },
    },
    nslookupResults: {
      "atlas.internal":                  { server: "10.40.0.10", addresses: ["10.40.0.10"] },
      "prod-db.atlas.internal":          { server: "10.40.0.10", addresses: ["10.40.20.5"] },
      "phi-warehouse.atlas.internal":    { server: "10.40.0.10", addresses: ["10.40.30.8"] },
      "audit-bypass.atlas.internal":     { server: "10.40.0.10", addresses: ["10.40.99.7"] },
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Atlas Health / staging-db.atlas.health (dbadmin) ──────────

Day two. You used the default credential from yesterday's
perimeter finding — \`atlas-default-2025\`, the cred Marcus
mentioned three quarterly meetings ago and never rotated — and
you're now sitting on staging-db.atlas.health as the \`dbadmin\`
service account. Somebody enabled /bin/bash on this vendor
default account during an upgrade six months back and never put
it back. A real attacker doing the exact same sequence as
yesterday's audit would be exactly here.

Priya has authorized a controlled blast-radius check. Rules of
engagement are in priya-note.md. Read those before you do
anything.


─── NEW COMMANDS ──────────────────────────────────────────────

  dig <domain>         DNS lookup (you've seen this one).
  dig <domain> AXFR    Zone transfer — ask the DNS server to
                       dump every record in the zone. Servers
                       SHOULD restrict this to known secondary
                       nameservers via TSIG or IP ACL. Many
                       don't.


─── WHAT A ZONE TRANSFER REVEALS ──────────────────────────────

A successful AXFR returns every record the zone holds:

  A      hostname → IP mappings (the full internal map)
  CNAME  hostname → hostname aliases
  MX     mail server pointers
  TXT    free-form text records — SPF, DKIM, vendor verification
         tokens, and (more often than anyone wants to admit)
         literal admin notes someone stashed because they had
         nowhere better to put them
  SOA / NS   zone authority metadata, printed at start and end

The TXT-record half is the one that bites. TXT records are a
junk drawer. Whatever someone "just needed to stash quickly"
ends up there. Zone transfer hands you all of them at once.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat priya-note.md           Day-two context + rules.
  2.  cat atlas-internal.txt      The internal zones in scope.
  3.  dig atlas.internal AXFR     The whole zone, if it's open.
  4.  Read the output carefully. A records show you what hosts
       exist. TXT records show you what people stashed.
  5.  cat lessons-learned.md      Post-mortem.
`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Atlas Health — engagement update (day two)

Yesterday's finding is escalated. Marcus's team opened an
incident at 8:42pm last night after our report came in; they're
patching the firewall this morning. The \`atlas-default-2025\`
credential is still live — Friday's change window is when they
rotate. That's three more days of exposure window.

I've authorized a controlled blast-radius check from
staging-db.atlas.health. The credential gives us access; that's
the same access an attacker has had since whenever the staging
DB was first exposed. We don't get to know how long that was.
What we CAN do is document exactly what's reachable from the
compromised host, so the incident report has accurate scope and
we know what else might need rotating.

## Rules of engagement — REREAD THESE BEFORE YOU TYPE

1. Get on the box with \`atlas-default-2025\`. Done — you're
   logged in as \`dbadmin\`.

2. Enumerate what's reachable from here. DNS, network reach,
   any name-resolution-revealed services. Reconnaissance only.

3. Document. DO NOT log into anything you discover, do not
   nmap into deeper tiers, do not scrape databases. Pivoting
   further from a confirmed-exposed credential is what turns
   "we validated scope" into "we made the problem bigger." We
   are auditors today, not attackers.

4. When you have the scope, ssh back to the lobby. Marcus's
   team takes the actual containment from there.

## Where to start

Atlas runs an internal DNS resolver on \`dns.atlas.internal\`
(also reachable as 10.40.0.10) that's authoritative for the
\`atlas.internal\` zone. Standard internal-name resolution for
their data center. Start with what the zone exposes — that's
the cheapest signal for "what would an attacker on this host
discover next."

The internal scope list is in atlas-internal.txt.

## Why this matters for HIPAA

Atlas's PHI systems live behind a different segmentation
boundary than staging. The architectural premise is that
staging hosts cannot reach PHI hosts. If something you find
from this box undermines that premise — even just by revealing
where the PHI tier lives — write it large in the report. That's
a §164.312(a) and §164.502 finding, and it changes the
disclosure timeline.

— Priya
  2026-04-09, 7:14am
`
        },

        "atlas-internal.txt": {
          type: "file",
          content:
`# Atlas Health — internal zones in scope for blast-radius validation
# Driftwood security audit, day 2 follow-up
#
# Per Atlas's network architecture doc (last reviewed 2024-Q3):
#
#   atlas.internal       primary internal zone — all data-center
#                        hosts. DNS authority: dns.atlas.internal.
#   atlas-corp.local     corporate / office network. OUT of scope
#                        for this DC-side audit.
#   atlas-vpn.internal   vpn-issued client zone. OUT of scope.
#
# Only atlas.internal is in scope for today's blast-radius check.
# That's where the staging tier lives; that's where this host
# resolves names against.
#
# If atlas.internal returns AXFR to arbitrary clients, that itself
# is a finding regardless of what the zone contains. Document the
# attempt and the result either way.
#
# — Priya, 2026-04-09
`
        },

        ".bash_history": {
          type: "file",
          content:
`ls
psql -h localhost -U postgres
sudo systemctl status postgresql
sudo systemctl restart postgresql
journalctl -u postgresql -n 100
df -h
free -h
ps auxf | grep postgres
psql -h localhost -U postgres -d atlas_staging -c "VACUUM ANALYZE;"
exit
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just dumped Atlas Health's entire internal name space with a
single command. AXFR returned every hostname, every IP, every
TXT record — including a free-form note that a previous engineer
left in audit-bypass.atlas.internal's TXT record because they
"needed to stash that somewhere quickly." That note carries the
credential for an undocumented service account created for a
vendor audit dry-run and never removed.

The DNS server should have refused the transfer. It didn't. The
credential should never have been written into a public-readable
record. It was. The cleanup should have happened when the vendor
audit closed. It didn't. Three independent failures compounded
into "Driftwood now has Atlas's internal map plus a live
service-account credential."

─── THE BLUNT VERSION ────────────────────────────────────────

DNS zone transfer is one of the longest-running classes of
misconfiguration in the catalog. The technique is older than
most working security engineers. It's listed in OWASP's Web
Security Testing Guide. It's a named technique in MITRE ATT&CK
(T1590.002). It's been in nmap's NSE scripts since 2007. The
reason it keeps showing up in real engagements is not that the
technique is hard to defend against. It's that internal DNS
gets set up once, by whoever was there first, and nobody
re-audits it.

What you got with one command:

  1. The complete internal hostname map. An attacker doesn't
     have to guess prod-db exists — the zone confirmed it.
  2. The IP ranges by tier. 10.40.10/24 is staging. 10.40.20/24
     is prod. 10.40.30/24 is the PHI / clinical tier (PACS, EHR,
     FHIR warehouse). 10.40.40/24 is backups. An attacker can
     plan lateral movement against documented infrastructure.
  3. The "shadow" hostnames — services that exist but aren't
     documented elsewhere. audit-bypass.atlas.internal is in
     this category. So is anything with a hostname like "old-",
     "test-", "tmp-", "debug-".
  4. Anything anyone ever stuffed into a TXT record. SPF policy.
     The audit-bypass credential.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For Driftwood specifically, this finding is materially worse
than yesterday's. Yesterday was a perimeter drift — one host,
one port, one credential. Today is a full internal-map
disclosure plus a live undocumented credential. Atlas's incident
response now has to answer:

  - Who else has run this exact AXFR query against atlas.internal?
    (DNS query logs would tell us — if Atlas keeps them for
    AXFR specifically. Probably not, routinely.)
  - How long has the zone allowed unauthenticated transfer?
    (Almost certainly since whenever the BIND/Knot/PowerDNS
    config was first written. Untouched since.)
  - Who else has the audit-bypass credential? (Anyone who ran
    AXFR. Anyone Marcus shared the post-dry-run "we'll clean
    up" todo with. Anyone who attended the dry-run meeting.)

That third bullet is the one that makes incident response
sweat. The blast radius is not "the host we found" — it's
"everyone who ever queried DNS this way," which is unbounded.

Driftwood's MSA with Atlas treats internal-network-disclosure
as a Tier-1 incident: 24-hour client notification, same-day
escalation to Marcus's CISO, and an incident memo attached to
the next quarterly review. Priya is already drafting.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-306: Missing Authentication for Critical Function
    The DNS server allowed zone transfer to any source without
    authentication. AXFR is a critical function — it dumps
    every record in the zone. The control "require TSIG or IP
    ACL" is standard; failure to apply it is exactly CWE-306.

  CWE-200: Exposure of Sensitive Information to an
  Unauthorized Actor
    The TXT-record credential leak. (Note: CWE-200 is broad
    enough that MITRE's catalog now flags it as "Discouraged
    for mapping" — better to cite the more specific weakness
    where one fits. We cite it here as the historical framework
    reference; the surgical fix is "don't put credentials in
    DNS records.")

  NIST SP 800-53 Rev. 5
    SC-22 — Architecture and Provisioning for Name / Address
      Resolution Service. Explicitly requires authoritative
      DNS to be configured per the organization-defined
      external-network specification. AXFR-from-anywhere fails
      this control.
    SC-7  — Boundary Protection. The fact that staging-db can
      reach internal DNS at all is a segmentation failure on
      top of the AXFR failure.
    AC-3  — Access Enforcement. The DNS server must enforce
      approved authorizations on the AXFR operation. It didn't.

  NIST SP 800-81 Rev 3 — Secure DNS Deployment Guide (March 2026)
    The authoritative federal guidance on DNS hardening,
    superseding the long-standing SP 800-81-2 (withdrawn the
    same day Rev 3 was published). The recommended posture for
    AXFR carries through: allowed only to known secondary
    nameservers, authenticated via TSIG. Atlas's resolver
    appears to use the looser "allow from anywhere internal"
    model — which is "allow from anyone with a route to the
    resolver," which today included you.

  HIPAA Security Rule (45 CFR 164.312)
    164.312(a)(1) Access Control — Atlas is required to limit
      access to PHI to authorized parties. The architectural
      mechanism is network segmentation; segmentation is
      undermined when an attacker knows where the PHI tier
      lives because the DNS told them.
    164.312(e)(1) Transmission Security — hostname enumeration
      is the first step of any subsequent transmission-layer
      compromise.

  HIPAA Privacy Rule (45 CFR 164.502)
    "Minimum necessary" standard: uses, disclosures, and
    requests for PHI should be limited to the minimum necessary
    for the purpose. Exposing the internal map of every PHI
    system to anyone who can query DNS is the opposite of
    minimum-necessary.

  CIS Critical Security Controls v8.1
    4.9 — Configure Trusted DNS Servers on Enterprise Assets.
      The client-side complement; the server-side equivalent
      lives in 12.2.
    12.2 — Establish and Maintain a Secure Network Architecture.
      Covers segmentation, DNS hardening, and the general
      "don't let any host talk to any other host" principle.
    13.4 — Perform Traffic Filtering Between Network Segments.
      Staging hosts shouldn't be able to reach the internal
      DNS resolver in the first place.

  OWASP Web Security Testing Guide v4.2
    WSTG-INFO-04 (Enumerate Applications on Webserver)
    documents DNS zone transfers explicitly under its "DNS
    Zone Transfers" subsection. Any competent web/infra
    pentest engagement runs AXFR checks in the first hour.

  OWASP Top 10 (2025) — A02: Security Misconfiguration
    The umbrella category. "Unnecessary features are enabled
    or installed" + "default accounts and their passwords are
    still enabled" both apply.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 4 (Security Operations) — DNS as a recon vector,
    DNS hardening. Domain 3 (Security Architecture) — secure
    network services.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 2 (Threat Intelligence
    & Threat Hunting) — covers the "what does the adversary
    see from outside?" question that AXFR answers in one
    query.

  CompTIA PenTest+ (PT0-003)
    Domain 2 (Reconnaissance and Enumeration) — DNS enumeration
    is named and tested; AXFR is one of the directly-listed
    techniques.

  CISSP
    Domain 4 (Communication and Network Security) — DNS as a
    protocol with documented hardening requirements.
    Domain 3 (Security Architecture and Engineering) — secure
    network services.

  OSCP / PEN-200
    Standard early-recon move on any internal engagement. Every
    PEN-200 lab box that runs an internal DNS gets AXFR-checked
    in the first 30 minutes.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1590.002 — Gather Victim Network Information: DNS. The
              technique specifically names zone transfer among
              the data-gathering methods.
  T1018     — Remote System Discovery. The "now we know every
              host" outcome of the AXFR.
  T1078     — Valid Accounts. The audit-bypass credential is
              this technique waiting to be picked up.
  T1133     — External Remote Services. The audit-bypass
              account is an undocumented remote-service entry
              point.

T1590.002 is one of the most frequently named techniques in
reconnaissance-phase threat reports. It's also one of the
cheapest defender wins on this whole catalog: lock down AXFR,
the technique stops working.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Restrict AXFR. BIND: \`allow-transfer { key tsig-key; };\`
     plus a TSIG key shared only with legitimate secondary
     nameservers. PowerDNS: \`allow-axfr-ips\` + TSIG. Knot DNS:
     similar TSIG pattern. The change is one config line plus a
     key rotation. (Unbound isn't authoritative; doesn't apply.)
  2. Audit existing TXT records. Anything that looks like a
     verification token, a temporary note, or a literal
     credential should be removed and (if a credential) rotated.
     \`dig <domain> ANY\` from a trusted host enumerates them
     quickly.
  3. Monitor for AXFR attempts. BIND logs zone-transfer requests
     under the \`xfer-out\` category; route those to a SIEM and
     alert on "AXFR from a non-secondary IP." Splunk, Sentinel,
     Elastic — any of them work.
  4. Network segmentation between tiers. Staging hosts should
     not have a route to internal DNS for production. The
     general rule: staging touches staging-only services;
     production touches production-only services; the
     intersection is a small, audited management plane.
  5. Service-account hygiene. Audit-bypass accounts created for
     vendor-engagement dry-runs are notoriously sticky. Track
     them in a registry with an expiration date and an owner;
     automate removal when the date passes; alert when they're
     still in use after expiration. CyberArk, BeyondTrust,
     HashiCorp Vault — pick a tool, don't track this in a
     spreadsheet.
  6. External attack-surface management tools also do passive
     DNS reconnaissance against your own perimeter — Shodan,
     Censys, SecurityTrails, Detectify. They tell you what your
     DNS is leaking before someone less friendly notices.

─── CLOSING THOUGHT ──────────────────────────────────────────

DNS is supposed to be the directory. It became, somewhere
along the way, the directory PLUS the bulletin board PLUS the
place people stash things they don't have anywhere better to
put. Zone transfer is the one query that reveals all three
layers at once.

The fix is not exotic. The fix is "stop letting strangers read
the whole directory." That fix has been documented since the
1990s. It's still the finding that pays the most rent in
internal-network audits.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

  // ── level 2 — "Marcus's leaky cert (openssl)" ───────────────────
  // The audit-bypass account from level1's TXT-record leak grants
  // entry to audit-bypass.atlas.internal — a 2023 dry-run host that
  // was tagged "decommissioned, awaiting reimage" in 2024-Q1 and
  // never actually reimaged. Apache 2.4 terminates TLS for a
  // long-dead internal admin-portal redirect using a self-signed
  // 10-year cert installed during the original 2023 setup. The
  // cert's Subject Alternative Name list reads like the internal
  // network map — explicit prod-* and PHI-tier hostnames plus a
  // *.atlas.internal wildcard. The Subject's OU field carries an
  // internal service email (devops-ci@atlas.health), and the local
  // exim instance autoresponds — captured in
  // /var/log/exim/autoresponder.log — to a recent password-reset
  // request, leaking a 72-hour temp credential in cleartext that
  // becomes the level3 entry breadcrumb.
  //
  // Lessons taught:
  //   - CWE-200 (information disclosure; parent — "mapping
  //     discouraged" per current MITRE guidance, surgical fixes
  //     are CWE-1188 + CWE-547 + CWE-532 below)
  //   - CWE-1188 (Insecure Default Initialization of Resource) —
  //     the 10-year self-signed cert nobody rotated
  //   - CWE-547 (Use of Hard-coded Security-relevant Constants) —
  //     the *.atlas.internal wildcard + "DELETE BEFORE PROD"
  //     subject string
  //   - CWE-532 (Insertion of Sensitive Information into Log File)
  //     — the exim autoresponder cleartext-cred reply body
  //   - Certificate Transparency permanence (RFC 6962 / RFC 9162)
  //   - OWASP Top 10 (2025) A04 Cryptographic Failures + A05
  //     Security Misconfiguration
  //   - HIPAA Security Rule §164.312(e)(2)(ii) (encryption posture)
  //     + §164.312(b) (audit controls)
  //
  // No new engine commands — openssl s_client lives in
  // structured.js, openssl x509 lives in format.js (called via
  // structured.js's `openssl` dispatcher), and crtsh lives in
  // osint.js. All three shipped pre-v1.8.0.
  "level2@network": {
    password: "atlas-audit-bypass-2026",
    track: "network",
    title: "Marcus's leaky cert (openssl)",
    estimatedMinutes: 12,
    playerUser: "audit-svc",
    // Cross-track narrative seed — the "MDM-says-dead /
    // firewall-says-alive" split in CLOSING THOUGHT echoes Polaris's
    // forensic-bench VLAN from the forensics track. Same pattern,
    // different industry.
    crossTrackHooks: ["forensics"],
    objective: "Inventory what audit-bypass.atlas.internal's Apache TLS posture documents — what the SAN list maps, what the OU field names, and what the local autoresponder spills into its own log.",
    lesson: "Day three. The TXT-record cred from yesterday's AXFR (audit-svc / atlas-audit-bypass-2026) drops you onto audit-bypass.atlas.internal — a 2023 dry-run jumpbox tagged 'decommissioned, awaiting reimage' in 2024-Q1 and still serving production-grade TLS at 2026-04-10. Apache here terminates TLS on a self-signed wildcard cert that looks innocuous from outside but documents the entire internal infrastructure in its X.509 extensions. Read welcome.md (it explains openssl s_client / x509 + crtsh). Then walk the cert, walk the exim autoresponder log, then back to the lobby — Marcus is asking for the report at lunch.",
    hints: [
      "Apache's cert lives at /etc/apache2/ssl/audit-bypass.crt. Use `openssl x509 -text -noout -in <file>` to dump the X.509 extensions.",
      "The Subject Alternative Name list IS the internal infrastructure inventory. Read every line.",
      "The OU field of the Subject names a service email (devops-ci@atlas.health). The local exim instance's autoresponder log captures what that mailbox auto-replied to — /var/log/exim/autoresponder.log.",
    ],

    // v1.10.0 BONUS FINDS — both trigger on the openssl x509 cert
    // dump. The wildcard-sprawl bonus fires on the SAN list's
    // explicit `DNS:*.atlas.internal` entry; the self-signed-CA
    // bonus fires on the literal "DELETE BEFORE PROD" string the
    // 2023 issuer stuffed into the Organization field as a
    // reminder-to-self. Both are orthogonal to the credential
    // chain — finding them doesn't change the level3 cred.
    bonusFinds: [
      {
        id:   "wildcard-cert-sprawl",
        name: "Wildcard *.atlas.internal in the SAN list",
        hint: "The SAN list includes a `DNS:*.atlas.internal` entry covering every internal hostname the zone could ever name. Wildcard certs are tempting because they keep the CA bill down; the trade-off is that one compromised key authenticates the attacker as ANY internal host. NIST SP 800-52 Rev 2 §3.1.3 warns against the wildcard convenience pattern.",
        trigger: { command: "openssl", argMatches: /audit-bypass\.crt/, outputContains: "DNS:*.atlas.internal" },
      },
      {
        id:   "self-signed-ca-blunder",
        name: "Self-signed CA with 'DELETE BEFORE PROD' in the Subject",
        hint: "The cert's Issuer is identical to its Subject — it's its own CA. The Subject's Organization field reads 'DELETE BEFORE PROD 2023'. Whoever set this cert up in 2023 left a literal note in the cert metadata reminding themselves to clean it up. Three years on, the note is still readable in every TLS handshake the server completes.",
        trigger: { command: "openssl", argMatches: /audit-bypass\.crt/, outputContains: "DELETE BEFORE PROD" },
      },
    ],

    // ENV — HOSTNAME surfaces the fqdn so prompt + `hostname` agree.
    // EDITOR is `vi` because this is a 2023-era jumpbox; nothing
    // newer has been installed.
    env_vars: {
      EDITOR:   "vi",
      HOSTNAME: "audit-bypass.atlas.internal",
    },

    // ── openssl s_client target table ──
    // Two entries point at the same handshake — `localhost:443`
    // matches Apache's listen socket; the fqdn:443 form matches
    // what `openssl s_client -connect audit-bypass.atlas.internal:443`
    // would resolve to. The cert subject/issuer pair surfaces the
    // self-signed + OU=devops-ci posture in the handshake before
    // the player ever opens the cert file.
    opensslSClient: {
      "localhost:443": {
        protocol: "TLSv1.2",
        cipher: "ECDHE-RSA-AES256-GCM-SHA384",
        verification: "self signed certificate",
        cert: {
          subject: "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal",
          issuer:  "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023",
        },
      },
      "audit-bypass.atlas.internal:443": {
        protocol: "TLSv1.2",
        cipher: "ECDHE-RSA-AES256-GCM-SHA384",
        verification: "self signed certificate",
        cert: {
          subject: "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal",
          issuer:  "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023",
        },
      },
    },

    // ── openssl x509 source table ──
    // Two keys point at the same cert payload because format.js's
    // renderX509 looks up `level.certs[<literal-name-typed>]` and
    // doesn't resolve relative paths to absolute. Players who type
    // the absolute path AND players who cd into the ssl dir first
    // and type the basename both hit the same record.
    certs: {
      "/etc/apache2/ssl/audit-bypass.crt": {
        version: 3,
        serial: "01:7d:e2:4a:f9:00:00:01",
        sigAlgorithm: "sha256WithRSAEncryption",
        issuer:    "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023",
        subject:   "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal",
        notBefore: "Jan 12 14:02:11 2023 GMT",
        notAfter:  "Jan 12 14:02:11 2033 GMT",
        publicKey: "RSA Public-Key: (2048 bit)",
        san: [
          "DNS:audit-bypass.atlas.internal",
          "DNS:*.atlas.internal",
          "DNS:devops-ci.atlas.internal",
          "DNS:helpdesk-ticket.atlas.internal",
          "DNS:tessera-bridge.atlas.internal",
          "DNS:prod-db.atlas.internal",
          "DNS:prod-web.atlas.internal",
          "DNS:prod-api.atlas.internal",
          "DNS:staging-db.atlas.internal",
          "DNS:staging-web.atlas.internal",
          "DNS:staging-api.atlas.internal",
          "DNS:phi-warehouse.atlas.internal",
          "DNS:pacs-imaging.atlas.internal",
          "DNS:ehr-fhir.atlas.internal",
          "DNS:backups.atlas.internal",
          "DNS:syslog.atlas.internal",
          "DNS:jumpbox-vpn.atlas.internal",
          "DNS:ntp.atlas.internal",
          "DNS:mail.atlas.internal",
          "DNS:dns.atlas.internal",
        ],
        keyUsage:    ["Digital Signature, Key Encipherment"],
        extKeyUsage: ["TLS Web Server Authentication, TLS Web Client Authentication"],
      },
      "audit-bypass.crt": {
        version: 3,
        serial: "01:7d:e2:4a:f9:00:00:01",
        sigAlgorithm: "sha256WithRSAEncryption",
        issuer:    "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023",
        subject:   "C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal",
        notBefore: "Jan 12 14:02:11 2023 GMT",
        notAfter:  "Jan 12 14:02:11 2033 GMT",
        publicKey: "RSA Public-Key: (2048 bit)",
        san: [
          "DNS:audit-bypass.atlas.internal",
          "DNS:*.atlas.internal",
          "DNS:devops-ci.atlas.internal",
          "DNS:helpdesk-ticket.atlas.internal",
          "DNS:tessera-bridge.atlas.internal",
          "DNS:prod-db.atlas.internal",
          "DNS:prod-web.atlas.internal",
          "DNS:prod-api.atlas.internal",
          "DNS:staging-db.atlas.internal",
          "DNS:staging-web.atlas.internal",
          "DNS:staging-api.atlas.internal",
          "DNS:phi-warehouse.atlas.internal",
          "DNS:pacs-imaging.atlas.internal",
          "DNS:ehr-fhir.atlas.internal",
          "DNS:backups.atlas.internal",
          "DNS:syslog.atlas.internal",
          "DNS:jumpbox-vpn.atlas.internal",
          "DNS:ntp.atlas.internal",
          "DNS:mail.atlas.internal",
          "DNS:dns.atlas.internal",
        ],
        keyUsage:    ["Digital Signature, Key Encipherment"],
        extKeyUsage: ["TLS Web Server Authentication, TLS Web Client Authentication"],
      },
    },

    // ── crt.sh certificate-transparency log results ──
    // What Atlas's PUBLIC perimeter looks like to anyone with a
    // browser. The pedagogical bullets the player should notice:
    //   - portal / api / vpn / www — expected, public-facing.
    //   - staging.atlas.health on 2025-09-08 — published a cert
    //     for a hostname Marcus claimed (level0) was VPN-only.
    //     The CT-log entry is permanent regardless of whether the
    //     hostname is now firewalled.
    //   - patientportal-uat.atlas.health on 2024-06-14 — a UAT
    //     hostname that no longer resolves, still publicly
    //     enumerable via CT.
    //   - tessera-bridge.atlas.health on 2025-09-12 — matches the
    //     Tessera Q4 dry-run date from level1's TXT record. Ties
    //     the dry-run thread together; the CT log catalogued the
    //     "temporary" infra.
    //   - marcus-test.atlas.health 2025-04-22 — Marcus tested
    //     something publicly via Let's Encrypt and didn't realize
    //     the issuance was permanent.
    //   - *.atlas.health 2023 — a 2-year wildcard from a previous
    //     CA that overlaps the current Let's Encrypt issuances.
    crtshResults: {
      "atlas.health": [
        { subdomain: "portal.atlas.health",            issuer: "Let's Encrypt (R10)",          issued: "2026-03-15" },
        { subdomain: "api.atlas.health",               issuer: "Let's Encrypt (R10)",          issued: "2026-03-15" },
        { subdomain: "vpn.atlas.health",               issuer: "Let's Encrypt (R10)",          issued: "2026-03-15" },
        { subdomain: "www.atlas.health",               issuer: "Let's Encrypt (R10)",          issued: "2026-03-15" },
        { subdomain: "staging.atlas.health",           issuer: "Let's Encrypt (R3)",           issued: "2025-09-08" },
        { subdomain: "tessera-bridge.atlas.health",    issuer: "GoDaddy Secure CA-G2",         issued: "2025-09-12" },
        { subdomain: "marcus-test.atlas.health",       issuer: "Let's Encrypt (R3)",           issued: "2025-04-22" },
        { subdomain: "patientportal-uat.atlas.health", issuer: "Let's Encrypt (R3)",           issued: "2024-06-14" },
        { subdomain: "*.atlas.health",                 issuer: "DigiCert SHA2 Secure Server",  issued: "2023-11-02" },
      ],
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Atlas Health / audit-bypass.atlas.internal (audit-svc) ────

Day three. The 'DEPRECATED — added 2025-09-12 for Tessera Q4
dry-run' TXT record from yesterday's AXFR was, of course, not
removed at end of Q4. audit-bypass.atlas.internal is still here
five months later. You're now logged in as \`audit-svc\` on it,
using the cred the TXT record leaked.

This host runs Apache 2.4 terminating TLS for an internal
admin-portal redirect that nobody at Atlas remembers setting up.
The cert is self-signed and lives at /etc/apache2/ssl/. Read it.


─── NEW COMMANDS ──────────────────────────────────────────────

  openssl s_client -connect <host>:<port>
                       TLS handshake debugger. Shows the cert
                       chain, cipher negotiated, and verification
                       result.

  openssl x509 -text -noout -in <file>
                       Parse a PEM-encoded cert file and dump
                       its X.509 extensions in human-readable
                       form. The Subject Alternative Name (SAN)
                       list is where the interesting metadata
                       lives.

  crtsh <domain>       Certificate-transparency log search. Every
                       publicly-issued cert is logged to a public,
                       append-only audit log forever (RFC 6962).
                       crt.sh is the public query interface.


─── WHAT A TLS CERT REVEALS ───────────────────────────────────

A certificate isn't just a public key. The X.509 spec lets the
issuer attach a small bundle of metadata to the key:

  Subject          who the cert is for (CN + O + OU)
  Issuer           who signed it (the CA's name)
  Validity         not-before / not-after (the cert lifetime)
  Public Key       the actual cryptographic material
  Extensions       Subject Alternative Names, Key Usage,
                   Extended Key Usage, CRL Distribution Points

The SAN list is the high-signal field for recon. Whoever issued
the cert had to enumerate every hostname they wanted it to
cover. On a wildcard cert, the wildcard itself authorizes a
whole zone. On an enumerated cert, the SAN list IS the internal
hostname inventory.

Certificate Transparency makes this worse for public certs.
Every cert any browser-trusted CA issues since ~2018 has to be
logged to a public append-only CT log or browsers reject it.
crt.sh queries those logs. Once a cert with a hostname is
logged, the fact that hostname exists is public forever — even
if the cert is later revoked, even if the hostname is rotated.


─── HOW TO PLAY ───────────────────────────────────────────────

  1. cat priya-note.md            Why we're here, what's in scope.
  2. cat atlas-cert-scope.md      What Apache is configured to do.
  3. openssl s_client -connect localhost:443
                                  Handshake-level view of the cert
                                  Apache is serving.
  4. openssl x509 -text -noout -in /etc/apache2/ssl/audit-bypass.crt
                                  The full X.509 extensions, SAN
                                  list and all.
  5. crtsh atlas.health           What's public via CT logs.
  6. cat /var/log/exim/autoresponder.log
                                  What the OU field's mailbox has
                                  been auto-replying to.
  7. cat lessons-learned.md       Post-mortem.
`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Atlas Health — engagement update (day three)

Marcus's team rotated atlas-default-2025 on Friday's change
window — one week behind schedule but it's done. The audit-bypass
account flagged in yesterday's report is still LIVE because Marcus
wanted to "do that one carefully" and his team has a change
review tomorrow. So that cred — atlas-audit-bypass-2026, our cred —
is still atomic. I authorized you to use it once, today, to finish
documenting what audit-bypass.atlas.internal actually IS.

We thought it was just a dead host. It isn't.

The Atlas devops team's MDM inventory has audit-bypass.atlas.internal
listed as "decommissioned, awaiting reimage" since 2024-Q1. The
firewall says otherwise; it's reachable from staging and it answers
on 443. Apache is up. Something's serving TLS. We don't know what.

## Rules of engagement — same as yesterday

1. You're on the host. Don't pivot off it. Don't \`ssh\` to
   neighboring hosts the cert mentions. Don't try the
   helpdesk-ticket URL. We are document-and-report, not
   walk-the-blast-radius.

2. Walk Apache's config. Read the cert. The SAN list will tell
   you what this host was set up to BELIEVE it serves; the real
   serving behavior is whatever Apache's vhost config says,
   which is much less.

3. The cert's OU field is non-standard. RFC 5280 calls OU
   optional and free-form. Atlas's CA habit was apparently to
   stuff an internal service email in there. Look at what THAT
   mailbox has been doing — /var/log/exim/autoresponder.log on
   this host captures the local exim instance's outbound replies.
   (Yes, this host runs its OWN exim instance. That's the kind of
   thing nobody decommissions a "deprecated" host over.)

4. When you've documented scope, return to the lobby. Marcus
   wants the report at lunch and I'd like time to clean it up
   first.

## What I expect you to find

The cert. The OU email. What the autoresponder replied to.
Whether the SAN list documents anything Atlas's network inventory
doesn't already account for. The Tessera Q4 dry-run thread that
started in yesterday's TXT record almost certainly continues here
— same dates, same engineers, same forgotten cleanup.

— Priya
  2026-04-10, 9:47am
`
        },

        "atlas-cert-scope.md": {
          type: "file",
          content:
`# Atlas Health — what audit-bypass.atlas.internal is configured to do
# (per Apache's own config files on this host)
# Driftwood security audit, day 3

The httpd-2.4 process listens on :443 with TLS termination, then
redirects everything to https://helpdesk-ticket.atlas.internal/ —
a service that Atlas's IT helpdesk ran for ticket intake during
the 2023 vendor-onboarding push.

helpdesk-ticket.atlas.internal currently returns 502 (the
upstream service was retired 2024-Q2 per Atlas's MDM notes). So
audit-bypass.atlas.internal is functionally a TLS-handshake-
then-502 forwarder.

But Apache is still presenting a TLS cert during the handshake
BEFORE it forwards. THAT cert is what we care about. It's been
in place since the original 2023 deployment and was never
rotated, never re-issued, and never replaced with a Let's Encrypt
cert when the public-facing services migrated.

Apache config locations on this host:

  /etc/apache2/sites-enabled/audit-bypass.conf
                          vhost definition + cert path
  /etc/apache2/ssl/audit-bypass.crt
                          the self-signed cert itself

Walk both. The cert is the finding; the vhost confirms what
Apache thinks it's doing.

— Priya, 2026-04-10
`
        },

        ".bash_history": {
          type: "file",
          content:
`ls
cat priya-note.md
cat atlas-cert-scope.md
ls /etc/apache2/sites-enabled/
cat /etc/apache2/sites-enabled/audit-bypass.conf
openssl s_client -connect localhost:443
openssl x509 -text -noout -in /etc/apache2/ssl/audit-bypass.crt
crtsh atlas.health
cat /var/log/exim/autoresponder.log
exit
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just inventoried a self-signed Apache TLS cert that doubles
as a free internal network map. The SAN list documents every
host the original 2023 issuer wanted the cert to cover —
production DB, PHI warehouse, EHR FHIR endpoint, every tier —
plus a *.atlas.internal wildcard that authorizes ANY future
internal host without re-issuance. The Subject's OU field
carries an internal service email (devops-ci@atlas.health) and
the local exim instance has been quietly auto-replying to
password-reset requests for THAT mailbox with temporary
credentials in cleartext.

Three failures compounded: the cert was self-signed and never
rotated; the cert's metadata was used as a junk drawer; the
autoresponder was configured to ship cleartext credentials.
Combined, they hand a reader of this host the internal
infrastructure map plus a fresh credential to log into the
next hop.

─── THE BLUNT VERSION ────────────────────────────────────────

TLS certificates are not opaque. They're metadata-rich documents
the spec REQUIRES the server to hand to every client that opens
a connection. Every recon framework on the planet teaches
\`openssl s_client -connect\` as the first command on any
unfamiliar TLS endpoint. The SAN list is the most-read field in
that output for a reason.

For internal-facing TLS the trade-off looks like:

  - A unique cert per service per environment, properly issued
    by an internal CA, with a SAN list limited to that service's
    operational hostnames.
  - vs. one wildcard or "kitchen-sink" cert that covers every
    host the issuer could imagine, with the SAN list functioning
    as the inventory.

The kitchen-sink approach is cheap to deploy and cheap to
maintain. It is also the inventory document anyone with TLS
access to ANY of the hosts in scope walks away with.

Public-facing TLS is even worse: Certificate Transparency makes
the SAN list permanent. RFC 6962 — and its v2 successor
RFC 9162 (published Dec 2021) — require CAs in major browser
roots to log every issued cert to public append-only CT logs;
the major browsers (Chrome since 2018, Apple since 2021, Mozilla
gating new certs starting 2024) reject certs that aren't logged.
crt.sh queries those logs. Once your cert is logged, the listed
hostnames are in the public record forever, even if the cert is
revoked.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For Driftwood and Atlas this finding stacks on top of the last
two. Day 1 was perimeter drift. Day 2 was DNS zone-transfer
disclosure plus an undocumented credential. Day 3 is internal
infrastructure documented inside the TLS handshake plus a
cleartext-credential autoresponder. The cumulative pattern is
the same engineer (Marcus) running the same playbook ("set it
up, mark it temporary, never come back") across three different
layers of the stack.

Atlas's incident response now has to answer:

  - Who else has connected to audit-bypass.atlas.internal:443
    during the three years since deployment? Apache's access
    log would tell us. Did anyone keep it three years deep?
    (Probably not. Log retention typically caps at 30–90 days.)
  - Who has ever queried crt.sh for atlas.health? That data is
    permanently public; the answer is "anyone who wanted to."
    Permanent public discoverability is not auditable.
  - How many temporary credentials has the devops-ci@atlas.health
    autoresponder shipped in cleartext? The exim log on THIS host
    has the answer; aggregated across the org, nobody knows.

Driftwood's MSA treats credential-disclosure-by-shipped-message
as a Tier-1 finding — 24-hour client notification, escalated to
Atlas's CISO and to Marcus's manager. Priya is already drafting;
Marcus's "let's discuss in tomorrow's review" approach to the
audit-bypass account just got overtaken by events.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-200: Exposure of Sensitive Information to an
  Unauthorized Actor
    The umbrella weakness. MITRE flags CWE-200 as "Discouraged
    for mapping" in current guidance because it's too broad to
    be surgical. The surgical CWEs below.

  CWE-1188: Insecure Default Initialization of Resource
    The 10-year-validity self-signed cert installed in 2023 and
    never rotated. The "default" for a temporary host is whatever
    the engineer typed during setup; \`openssl req -newkey
    -days 3650\` was the typed command. Three years on, the
    "temporary" cert is still serving.

  CWE-547: Use of Hard-coded, Security-relevant Constants
    The wildcard *.atlas.internal SAN entry plus the literal
    "DELETE BEFORE PROD 2023" string in the Organization field.
    The cert encodes operational reminders that nobody acted on.

  CWE-532: Insertion of Sensitive Information into Log File
    The exim autoresponder logs the cleartext temp-cred reply
    body before delivery. Anyone with read on the exim log
    (audit-svc, root, the adm group) gets the cred.

  NIST SP 800-52 Rev 2 (Guidelines for TLS Implementations)
    §3.1.3 covers wildcard usage — server certs SHOULD NOT use
    wildcard DNS names in the SAN when the wildcard's blast
    radius is wider than the operational need. Atlas's cert is
    the textbook example: a wildcard that covers 100% of
    internal hosts including future ones.
    §3.2.2 — server certs SHOULD have validity ≤ the current
    CA/Browser Forum baseline (398 days through early 2026; the
    Forum has voted phased reductions toward 47 days by 2029).
    A 10-year self-signed cert is an order of magnitude over the
    modern limit.

  NIST SP 800-57 Part 1 Rev 5 (Recommendation for Key Management)
    §5.3.6 covers cryptoperiod selection. A 10-year cert exceeds
    the recommended cryptoperiod for any TLS-server-authentication
    key purpose.

  Certificate Transparency — RFC 6962 (and the v2 successor
    RFC 9162, published Dec 2021)
    The protocol that makes public-facing TLS cert issuance
    permanently public via append-only logs. Required for
    browser trust by Chrome (since 2018), Apple (since 2021),
    Mozilla (gating new certs starting 2024). Atlas can't undo
    what crt.sh has logged.

  HIPAA Security Rule (45 CFR 164.312)
    §164.312(e)(2)(ii) Encryption — encryption is required when
    deemed reasonable and appropriate; TLS termination with a
    self-signed cert nobody validates downstream meets the letter
    of "encrypted in transit" while failing the spirit.
    §164.312(b) Audit Controls — the autoresponder's cleartext
    credential ship is exactly the kind of activity the audit
    controls are supposed to surface for review.

  CIS Critical Security Controls v8.1
    3.10 — Encrypt Sensitive Data in Transit. The cert presence
    satisfies the literal control; the wildcard scope undermines
    the control's purpose.
    4.6 — Securely Manage Enterprise Assets and Software. The
    "decommissioned, awaiting reimage since 2024-Q1" asset that
    is still serving production-grade TLS at 2026-04-10 is a
    direct failure of asset management.
    12.5 — Centralize Network Authentication, Authorization, and
    Auditing (AAA). The per-host exim autoresponder shipping
    creds out-of-band routes around any centralized authn flow
    Atlas might have.

  OWASP Top 10 (2025) — A02: Security Misconfiguration
    The cert is the misconfiguration; the autoresponder is a
    separate misconfiguration; the still-serving "decommissioned"
    host is a third.

  OWASP Top 10 (2025) — A04: Cryptographic Failures
    Covers the broad class "data exposed via flawed cryptographic
    posture." TLS misconfiguration is the canonical example.
    Wildcard sprawl + self-signed-with-no-validation chain both
    apply.

  OWASP TLS Cheat Sheet
    Tracks the CA/Browser Forum baseline + Mozilla server-side
    TLS recommendations. Names wildcard avoidance, short-lived
    certs, and the modern automation playbook (ACME / cert-manager
    / step-ca) for internal CA hygiene.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — PKI fundamentals.
    Domain 4 (Security Operations) — TLS hardening, cert
    lifecycle management. The exam-objective bullets name
    "wildcard certificates" and "self-signed certificates"
    explicitly.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 2 (Threat Intelligence
    & Threat Hunting) — CT-log monitoring as a defender
    discipline. Domain 1 (Security Operations) — TLS posture
    audit.

  CompTIA PenTest+ (PT0-003)
    Domain 2 (Reconnaissance and Enumeration). crt.sh + SAN
    enumeration are named tooling.

  CISSP
    Domain 3 (Security Architecture and Engineering) — PKI,
    cryptographic protocols, cert lifecycle.
    Domain 4 (Communication and Network Security) — TLS as a
    protocol, what cert metadata reveals.

  OSCP / PEN-200
    Standard recon move on any HTTPS endpoint. Every PEN-200
    lab box with TLS gets \`openssl s_client\` run against it in
    the first ten minutes.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1596.003 — Search Open Technical Databases: Digital
              Certificates. The named technique for crt.sh and
              CT-log enumeration. Adversaries enumerate certs
              to find candidate target subdomains and short-lived
              staging hostnames that leaked into CT logs.

  T1590.001 — Gather Victim Network Information: Domain
              Properties. SAN-list enumeration sits squarely
              here — the cert documents the domain's internal
              hostnames.

  T1190     — Exploit Public-Facing Application. The
              not-quite-decommissioned audit-bypass host still
              answering on 443 is exactly this; an attacker
              doing the same recon you just did moves to
              exploitation here.

  T1213.005 — Data from Information Repositories: Messaging
              Applications. The exim autoresponder log is the
              messaging-application repository for this host;
              reading it gets you the cleartext temp cred.

  T1078     — Valid Accounts. The temp cred the autoresponder
              shipped is a valid account waiting to be used.

T1596.003 is one of the most commonly named CT-log-recon
techniques in published threat reports — it shows up in every
modern external-reconnaissance brief from Mandiant, CrowdStrike,
and Dragos.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Inventory ALL internal-CA-issued certificates. step-ca,
     HashiCorp Vault PKI, AWS Private CA, Smallstep — pick a
     tool, document the issuance pipeline, and audit the existing
     on-disk certs against that pipeline. Anything that isn't
     pipeline-issued gets rotated through the pipeline.

  2. Short-lived certs by default. CA/Browser Forum baseline is
     trending toward 47 days by 2029; internal CAs should mirror.
     90-day certs with ACME automation (cert-manager, acme.sh)
     are increasingly the default. The shorter the cert lifetime,
     the smaller the blast radius of any single leak — and the
     more reflexive the rotation muscle is.

  3. Per-service SAN scope. Each cert covers exactly the
     hostnames the service actually serves. The argument for
     wildcards ("we can't predict the next hostname") is the
     argument against wildcards ("the cert authenticates as
     hostnames we never thought about").

  4. Monitor CT logs for your own domain. crt.sh queries return
     JSON; Censys + SecurityTrails + Hardenize all publish
     CT-log monitoring services that alert on unexpected
     issuances. The "marcus-test.atlas.health" entry should have
     generated an alert in 2025-04.

  5. Decommissioned hosts get reimaged or torn down, not left
     at "awaiting reimage." The MDM-says-dead / firewall-says-
     alive split is recurring; close it by coupling MDM state
     to firewall ACLs (Tailscale ACLs, Cloudflare Access
     policies, AWS Security Groups managed by an asset-inventory
     tool that knows the host state).

  6. Autoresponders never ship cleartext credentials. If a
     mailbox needs to issue a temp cred, it does so through a
     portal link the requester clicks while authenticated, not
     via reply-body cleartext. Modern alternatives: Atlassian
     Jira Service Management's password-reset workflow,
     JumpCloud / Okta self-service reset, any SSO-tier IdM.

  7. Audit exim / postfix outbound delivery for cleartext-
     credential patterns. Splunk / Sentinel / Elastic SIEM rules
     looking for "password is", "temp credential", "valid for
     72 hours" across SMTP relay logs catch the pattern
     proactively.

─── CLOSING THOUGHT ──────────────────────────────────────────

A TLS cert is supposed to authenticate the server to the client.
It became, somewhere along the way, the most readable
infrastructure inventory the server hands out. Anyone who can
TCP-connect to :443 gets the cert metadata before the actual
service responds. Internal CAs and self-signed certs both
inherit this property.

The Atlas case stacks three independent failures: the cert
itself documented everything, the cert's OU named a mailbox, and
the mailbox shipped creds. Pull any one of those threads and the
breadcrumb chain breaks. The fix is not exotic — it is a
per-service cert pipeline that nobody set up because the
"temporary" host from 2023 outlived everyone's "temporary" plans.

Polaris Defense ran into a structurally identical pattern during
Reed Connolly's investigation: a "decommissioned" forensic-bench
VLAN that wasn't actually decommissioned still allowed traffic
the asset-inventory tool said couldn't reach it. Different
industry, same MDM-vs-firewall split. The fix is the same too:
couple the asset-inventory state to the network-access state
automatically.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

        // The Apache config tree. The cert itself is a PEM blob
        // (the X.509 structured data is in level.certs, which is
        // what `openssl x509 -text -noout -in <file>` actually
        // reads — the PEM here is decorative but makes `cat` of
        // the cert file return something that looks right).
        "etc": {
          type: "dir",
          children: {

            "apache2": {
              type: "dir",
              children: {

                "ssl": {
                  type: "dir",
                  children: {

                    "audit-bypass.crt": {
                      type: "file",
                      content:
`-----BEGIN CERTIFICATE-----
MIIE5jCCA86gAwIBAgIIAX3iSvkAAAEwDQYJKoZIhvcNAQELBQAwgZ8xCzAJBgNV
BAYTAlVTMRMwEQYDVQQIDApXYXNoaW5ndG9uMTowOAYDVQQKDDFBdGxhcyBIZWFs
dGggSW50ZXJuYWwgQ0EgLSBERUxFVEUgQkVGT1JFIFBST0QgMjAyMzEgMB4GA1UE
CwwXZGV2b3BzLWNpQGF0bGFzLmhlYWx0aDEpMCcGA1UEAwwgQXRsYXMgSGVhbHRo
IFNlbGYtU2lnbmVkIFJvb3QgMjAyMzAeFw0yMzAxMTIxNDAyMTFaFw0zMzAxMTIx
NDAyMTFaMIGqMQswCQYDVQQGEwJVUzETMBEGA1UECAwKV2FzaGluZ3RvbjE6MDgG
A1UECgwxQXRsYXMgSGVhbHRoIEludGVybmFsIENBIC0gREVMRVRFIEJFRk9SRSBQ
Uk9EIDIwMjMxIDAeBgNVBAsMF2Rldm9wcy1jaUBhdGxhcy5oZWFsdGgxKDAmBgNV
BAMMH2F1ZGl0LWJ5cGFzcy5hdGxhcy5pbnRlcm5hbDCCASIwDQYJKoZIhvcNAQEB
BQADggEPADCCAQoCggEBANJYJ4wj0H7G7Yu4LD/+9R8WPdLkNzCJqQB4z2qvKQ8R
[... 28 lines of base64 elided in this sandbox display ...]
-----END CERTIFICATE-----
`
                    },

                  },
                },

                "sites-enabled": {
                  type: "dir",
                  children: {

                    "audit-bypass.conf": {
                      type: "file",
                      content:
`# Apache vhost — audit-bypass.atlas.internal
# Installed 2023-09-12 for Tessera Q4 dry-run handoff.
# Marked for decommission 2024-Q1 (per Atlas MDM ticket
# OPS-2024-0034). NOT decommissioned as of 2026-04-10.

<VirtualHost *:443>
    ServerName audit-bypass.atlas.internal
    ServerAdmin devops-ci@atlas.health

    SSLEngine on
    SSLCertificateFile     /etc/apache2/ssl/audit-bypass.crt
    SSLCertificateKeyFile  /etc/apache2/ssl/audit-bypass.key

    # Forward everything to the help-desk ticket portal.
    # Upstream returned 502 since 2024-Q2 — the host is now
    # functionally a TLS-handshake-then-502 forwarder.
    ProxyPass        / https://helpdesk-ticket.atlas.internal/
    ProxyPassReverse / https://helpdesk-ticket.atlas.internal/

    ErrorLog  \${APACHE_LOG_DIR}/audit-bypass.error.log
    CustomLog \${APACHE_LOG_DIR}/audit-bypass.access.log combined
</VirtualHost>
`
                    },

                  },
                },

              },
            },

          },
        },

        // The exim log tree. autoresponder.log is the breadcrumb —
        // it captures the cleartext-cred body of a password-reset
        // auto-reply that devops-ci@atlas.health emitted on
        // 2026-04-09. mainlog is filler that gives `ls /var/log/exim/`
        // some additional realism without being a red herring.
        "var": {
          type: "dir",
          children: {

            "log": {
              type: "dir",
              children: {

                "exim": {
                  type: "dir",
                  children: {

                    "autoresponder.log": {
                      type: "file",
                      content:
`# Exim 4 autoresponder log — /var/log/exim/autoresponder.log
# Captures outbound auto-reply bodies before they hit the queue.
# Format: exim4 standard message-id lines, then the literal reply
# body indented two spaces.

2026-04-08 14:22:09 1pHGtR-0003Lk-Jx <= devops-ci@atlas.health U=mailman P=local
2026-04-08 14:22:09 1pHGtR-0003Lk-Jx => kpark@atlas.health <kpark@atlas.health> R=dnslookup T=remote_smtp
2026-04-08 14:22:10 1pHGtR-0003Lk-Jx Completed
2026-04-08 14:22:10 -- autoresponse body for devops-ci@atlas.health --
  Hi Kira,

  Thanks for the ticket. The devops-ci queue is currently
  unmonitored; ops moved CI maintenance to the platform-eng
  rotation in 2024-Q2. Please open a fresh ticket at
  https://helpdesk-ticket.atlas.internal/ (you may need to
  reach out via vpn-ng if the new portal is still rolling).

  -- Atlas IT autoresponder

2026-04-09 11:08:44 1pHfTm-0002Bx-Aa <= devops-ci@atlas.health U=mailman P=local
2026-04-09 11:08:44 1pHfTm-0002Bx-Aa => helpdesk-noreply@atlas.health <helpdesk-noreply@atlas.health> R=dnslookup T=remote_smtp
2026-04-09 11:08:45 1pHfTm-0002Bx-Aa Completed
2026-04-09 11:08:45 -- autoresponse body for devops-ci@atlas.health --
  PASSWORD RESET AUTORESPONDER — ticket HD-2026-Q2-8814

  Service account:      devops-ci@atlas.health
  Reset requested by:   m.hassan@atlas.health (helpdesk operator)
  Reset method:         temp-cred (72-hour validity)
  Temporary credential: T3mp-DevopsCI-HD8814!q2
  Valid until:          2026-04-12 11:08:00 UTC

  Use this temporary credential to ssh devops-ci@devops-ci.atlas.internal,
  then rotate immediately via \`passwd\`. The helpdesk operator who
  opened ticket HD-2026-Q2-8814 will be notified on rotation.

  -- Atlas IT autoresponder
  (do not reply; this mailbox is auto-monitored)

2026-04-09 16:35:18 1pHkOR-0007Yt-Bd <= devops-ci@atlas.health U=mailman P=local
2026-04-09 16:35:18 1pHkOR-0007Yt-Bd => msuarez@atlas.health <msuarez@atlas.health> R=dnslookup T=remote_smtp
2026-04-09 16:35:19 1pHkOR-0007Yt-Bd Completed
2026-04-09 16:35:19 -- autoresponse body for devops-ci@atlas.health --
  Hi Marcus,

  ACK on the post-AXFR cleanup ticket. The audit-bypass account
  is queued for removal in tomorrow's change window per our call
  this morning. The cert itself (self-signed, 2023-vintage) is a
  separate item on the dec-temp-infra punchlist; we'll hit it
  when the Tessera engagement closes out.

  -- Atlas IT autoresponder (devops-ci@atlas.health)

# (end of file)
`
                    },

                    "mainlog": {
                      type: "file",
                      content:
`2026-04-10 08:55:01 cwd=/var/spool/exim args=/usr/sbin/exim4 -q
2026-04-10 08:55:01 Start queue run: pid=2841
2026-04-10 08:55:01 End queue run: pid=2841
2026-04-10 09:10:14 1pHmQa-0001Cp-Yz <= audit-svc@audit-bypass.atlas.internal U=audit-svc P=local S=412
2026-04-10 09:10:14 1pHmQa-0001Cp-Yz => priya@driftwood.io <priya@driftwood.io> R=dnslookup T=remote_smtp
2026-04-10 09:10:15 1pHmQa-0001Cp-Yz Completed
`
                    },

                  },
                },

              },
            },

          },
        },

      },
    },
  },

};
