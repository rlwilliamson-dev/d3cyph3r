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
    playerUser: "secops",
    objective: "Verify Atlas Health's claim that their staging environment is VPN-only — and document what's exposed if it isn't.",
    lesson: "Atlas Health is one of Driftwood's largest healthcare clients — they handle PHI for ~400,000 patients across the Pacific Northwest. Their DevOps lead, Marcus, told Priya last quarter that staging.atlas.health is now VPN-only. We do a routine perimeter verification on every client engagement every quarter; today is Atlas's turn. You're on Driftwood's audit workstation (the shell calls you `secops`, the shared service account the security team uses for these checks). Read welcome.md first — it explains nmap. Then read the engagement notes, then start scanning. When you've found what's wrong, read lessons-learned.md.",
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
    4.5  Implement and Manage a Firewall on Servers — the
      mitigation. Atlas should have host- or network-level
      firewalls enforcing "VPN-only" rather than relying on
      undocumented intent.
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
    playerUser: "dbadmin",
    objective: "Validate the blast radius reachable from the staging-db host before Marcus's team rotates the default credential — and document everything Atlas's internal DNS gives up to a guest with shell access.",
    lesson: "Day two of the Atlas Health audit. Last night's perimeter finding was escalated; Marcus's team patches the firewall this morning and rotates the default credential in Friday's change window. Priya has authorized a one-time, documented blast-radius check. You used `atlas-default-2025` to ssh into staging-db.atlas.health and you're now logged in as `dbadmin` — the default vendor service account, configured with /bin/bash because somebody needed the shell for an upgrade six months ago and never reverted. Read welcome.md (it explains the new tool you'll need today); then priya-note.md for the rules of engagement; then start from the internal DNS resolver. When you've documented the scope, read lessons-learned.md.",
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

};
