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
     ($408/record vs $165 cross-industry, IBM Cost of a Data
     Breach 2024).
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
      Unauthorized Actor — the database itself.
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

  CompTIA CySA+ (CS0-003)
    Domain 2 (Threat Intelligence & Threat Hunting) — active
    recon. Domain 1 (Security Operations) — perimeter monitoring.

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

};
