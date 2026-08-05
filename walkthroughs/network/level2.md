# level2@network — What the Cert Knew

**Track:** Network · **Client:** Atlas Health (continued) · **Compliance regime:** HIPAA Security Rule + HITECH breach notification + (per Atlas's SOC 2 fieldwork) AICPA Trust Services Criteria CC6

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level3@network`. If you haven't solved `level2@network` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough also assumes you've worked through `level0@network` and `level1@network`; this level continues their narrative directly.

---

## §1 — The setup

Day three at Atlas Health. The first day you used `nmap` against `staging.atlas.health` and found a postgres still answering on 5432/tcp three months after Marcus Kovacs swore the staging environment was VPN-only. The second day you used Atlas's own internal DNS resolver against itself — `dig atlas.internal AXFR` returned the entire zone, and one of the TXT records was a free-form note from somebody named Tessera who'd been engaged for a Q4 2025 dry-run. The note read, verbatim, `audit-bypass DEPRECATED creds — user=audit-svc pass=atlas-audit-bypass-2026 — added 2025-09-12 for Tessera Q4 dry-run, scheduled removal end of Q4`. Q4 of 2025 ended on December 31. Today is April 10, 2026. The credential was not removed.

Priya's overnight authorization note in chat: *"Marcus's team rotated `atlas-default-2025` on Friday — one week behind schedule but it's done. The audit-bypass account from yesterday's TXT-record leak is still LIVE because Marcus wanted to do that one carefully. He has a change review tomorrow. So that cred — `atlas-audit-bypass-2026`, our cred — is still atomic. I authorized you to use it once, today, to finish documenting what `audit-bypass.atlas.internal` actually IS. We thought it was just a dead host. It isn't."* The MDM inventory has the host tagged "decommissioned, awaiting reimage" since 2024-Q1. The firewall still routes to it. Apache 2.4 still serves :443 on it. Nobody at Atlas remembers setting up the redirect; nobody at Atlas remembers tearing it down. The cert it presents is the artifact you came to read.

The prompt now reads `audit-svc@audit-bypass:~$`. You're logged in as `audit-svc`, the deprecated Tessera dry-run identity, on a host the asset-management tool says doesn't exist. Yesterday's lesson was about DNS recon producing the internal hostname map. Today's lesson is about TLS cert recon producing the same map — *from inside a single TLS handshake*, plus a cleartext credential delivered to a mailbox the cert's metadata identified, plus a CT-log catalogue of every cert Atlas has ever ordered from a public CA. Three independent disclosure channels, all sourced from cryptographic infrastructure that nobody at Atlas thought was sensitive.

For now, internalize the framing: a certificate is a public document. The TLS handshake REQUIRES the server to hand it to any client that opens a connection. The X.509 spec lets the issuer stuff arbitrary metadata into the cert, and people have been using that capacity as a junk drawer since 1988 (RFC 1422 is the original PEM spec). The defenses against information leakage in certs all reduce to "don't put the information in the cert in the first place" — and Atlas's 2023-vintage internal CA habit, set up by the same DevOps team that runs everything else Marcus signs off on, very much did.

Three failures, from yesterday plus this morning, put you at an `audit-svc@audit-bypass` prompt:

1. **Yesterday's CWE-200 zone-transfer leak** — `dig atlas.internal AXFR` returned the audit-bypass TXT record's literal credential. Covered in level1.
2. **Atlas's CWE-1188 default-initialization habit** — the audit-bypass host was set up in 2023 for a vendor engagement and was supposed to be removed at the end of Q4 2024. The "remove me at the end of Q4" reminder was a free-form note in DNS instead of a ticket in an asset-lifecycle tool. The ticket didn't exist. The host still serves.
3. **Atlas's CWE-547 cert-metadata-as-junk-drawer convention** — the 2023 self-signed cert encodes Atlas's internal infrastructure map in its SAN list AND carries a literal "DELETE BEFORE PROD" reminder in the Organization field that nobody acted on, AND names a service mailbox (`devops-ci@atlas.health`) in the OU field whose autoresponder still ships cleartext credentials in response to password-reset requests.

That's the threat model of *getting* to this prompt. The lesson of this level is about what's *in* the cert and what the cert points at.

Priya, briefing you in chat as you SSH'd in: *"Walk Apache's config. Read the cert. The SAN list will tell you what this host was set up to BELIEVE it serves; the real serving behavior is whatever Apache's vhost config says, which is much less. The cert's OU field is non-standard — RFC 5280 calls OU optional and free-form. Atlas's CA habit was apparently to stuff an internal service email in there. Look at what THAT mailbox has been doing — `/var/log/exim/autoresponder.log` on this host captures the local exim instance's outbound replies. Yes, this host runs its OWN exim instance. That's the kind of thing nobody decommissions a 'deprecated' host over."* That's your scope.

Cross-track foreshadowing: Polaris Defense's Reed Connolly investigation surfaced a structurally identical pattern — a "decommissioned" forensic-bench VLAN that wasn't actually decommissioned still allowed traffic the asset-inventory tool said couldn't reach it. Different industry, same MDM-says-dead / firewall-says-alive split. The lobby's structure where you can walk these tracks in any order is real; the *narrative* is also real — they're a shared Driftwood book of business, in chronological flow.

## §2 — The solve

Six commands. The Network track's discipline this level is in reading X.509 extensions slowly — `what does the SAN list authorize this cert to claim`, `who does the Subject's OU identify`, `is the cert self-signed (issuer == subject) or chain-validated` — before you connect the cert's metadata to the autoresponder log that uses the same identifiers.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level2@network
level2@network's password: atlas-audit-bypass-2026
```

The password is the `audit-svc` credential you extracted from yesterday's AXFR TXT record on `audit-bypass.atlas.internal`. The Tessera Q4 dry-run note that left the cred in DNS also identified you as the user that would use it. Atlas's "scheduled removal end of Q4" promise was a free-form text comment with no follow-up workflow attached; the host is still here and the credential still works. The connection banner identifies the host (`audit-bypass.atlas.internal`) and the tier (Routine, ~12 min). Read `welcome.md` first — it explains the three new commands (`openssl s_client`, `openssl x509`, `crtsh`) and frames what a TLS cert actually contains.

```bash
audit-svc@audit-bypass:~$ cat welcome.md
```

`welcome.md` documents the engagement context, introduces `openssl s_client` (handshake debugger), `openssl x509` (cert parser), and `crtsh` (CT-log search), explains the SAN list and CT-log concepts, and orients you toward the puzzle. It also reminds you that the cert was installed in 2023 for the same Tessera dry-run yesterday's TXT record mentioned — same date, same engineers, same forgotten-cleanup pattern.

### Step 2: Read Priya's note + the scope file

```bash
audit-svc@audit-bypass:~$ cat priya-note.md
audit-svc@audit-bypass:~$ cat atlas-cert-scope.md
```

Priya's note carries the rules of engagement (same as yesterday — document and report, don't pivot off the host to neighboring services the cert names). The scope file documents what Apache is configured to do on this host: a vhost on :443 with TLS termination that forwards everything to `https://helpdesk-ticket.atlas.internal/`, an upstream that's been returning 502 since 2024-Q2. The host is functionally a TLS-handshake-then-502 forwarder. The cert it presents during the handshake is what we care about.

### Step 3: openssl s_client — handshake-level view

```bash
audit-svc@audit-bypass:~$ openssl s_client -connect localhost:443
CONNECTED(00000003)
depth=0 C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal
verify return:0
---
Certificate chain
 0 s:C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal
   i:C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023
---
SSL handshake has read 0 bytes and written 0 bytes
---
New, TLSv1.2, Cipher is ECDHE-RSA-AES256-GCM-SHA384
Server public key is 2048 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
SSL-Session:
    Protocol  : TLSv1.2
    Cipher    : ECDHE-RSA-AES256-GCM-SHA384
    Verification: self signed certificate
---
```

Three observations before you've even opened the cert file.

**Observation one: `verify return:0` plus `Verification: self signed certificate`.** OpenSSL is telling you the chain doesn't validate against any trusted root. The cert's Issuer (line `i:`) is byte-for-byte identical to its Subject (line `s:`) — the cert signed itself, which means there's no third party attesting to its identity. Self-signed certs aren't a vulnerability in themselves (every internal CA's root cert is self-signed by definition), but a leaf cert that's self-signed is unusual in production environments. The usual leaf-cert chain runs from a leaf cert UP to an intermediate UP to a root; this leaf is its own root.

**Observation two: the Subject's `O=` field carries the literal string `DELETE BEFORE PROD 2023`.** Whoever set this cert up in 2023 left a reminder-to-self inside the cert metadata. Three years on, the reminder is still readable by anyone who handshakes with this server. (This will fire the `self-signed-ca-blunder` bonus when you confirm it with `openssl x509`.)

**Observation three: the Subject's `OU=` field carries an email address — `devops-ci@atlas.health`.** RFC 5280 specifies the X.500 name attribute types and explicitly allows free-form OU values; in practice, organizations use OU for departmental names (`Sales`, `IT-Operations`, `Engineering`). Atlas's habit is to stuff an internal service email in there instead. The mailbox at that address is, per Priya's note, the autoresponder we'll be reading shortly.

The `New, TLSv1.2` line is also worth noting. Apache 2.4 default config on a 2023-vintage host won't necessarily have TLS 1.3 enabled (Apache's SSL config defaults vary by distribution and were progressively tightened across 2.4.x point releases). TLS 1.2 is still acceptable under NIST SP 800-52 Rev 2 §3.1 (the recommended TLS configuration), but the Forum's drift toward TLS-1.3-only baselines means a 2023-vintage TLS 1.2 endpoint is increasingly an audit finding by itself.

### Step 4: openssl x509 — the full cert dump

```bash
audit-svc@audit-bypass:~$ openssl x509 -text -noout -in /etc/apache2/ssl/audit-bypass.crt
Certificate:
    Data:
        Version: 3 (0x2)
        Serial Number:
            01:7d:e2:4a:f9:00:00:01
        Signature Algorithm: sha256WithRSAEncryption
        Issuer: C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=Atlas Health Self-Signed Root 2023
        Validity
            Not Before: Jan 12 14:02:11 2023 GMT
            Not After : Jan 12 14:02:11 2033 GMT
        Subject: C=US, ST=Washington, O=Atlas Health Internal CA - DELETE BEFORE PROD 2023, OU=devops-ci@atlas.health, CN=audit-bypass.atlas.internal
        Subject Public Key Info:
            RSA Public-Key: (2048 bit)
        X509v3 extensions:
            X509v3 Subject Alternative Name:
                DNS:audit-bypass.atlas.internal, DNS:*.atlas.internal,
                DNS:devops-ci.atlas.internal, DNS:helpdesk-ticket.atlas.internal,
                DNS:tessera-bridge.atlas.internal, DNS:prod-db.atlas.internal,
                DNS:prod-web.atlas.internal, DNS:prod-api.atlas.internal,
                DNS:staging-db.atlas.internal, DNS:staging-web.atlas.internal,
                DNS:staging-api.atlas.internal, DNS:phi-warehouse.atlas.internal,
                DNS:pacs-imaging.atlas.internal, DNS:ehr-fhir.atlas.internal,
                DNS:backups.atlas.internal, DNS:syslog.atlas.internal,
                DNS:jumpbox-vpn.atlas.internal, DNS:ntp.atlas.internal,
                DNS:mail.atlas.internal, DNS:dns.atlas.internal
            X509v3 Key Usage: critical
                Digital Signature, Key Encipherment
            X509v3 Extended Key Usage:
                TLS Web Server Authentication, TLS Web Client Authentication

  ✦ Bonus find unlocked: Wildcard *.atlas.internal in the SAN list
  ✦ Bonus find unlocked: Self-signed CA with 'DELETE BEFORE PROD' in the Subject
```

Five facts in one command output.

**Fact one: the validity is 10 years.** Not-Before is January 12, 2023. Not-After is January 12, 2033. The CA/Browser Forum baseline requirements have been progressively tightening server-cert lifetimes — 825 days (2018), 398 days (2020), with a phased reduction toward 47 days being voted forward in 2025 for completion by 2029. A 10-year self-signed cert is an order of magnitude over the modern public-CA baseline. Internal CAs aren't *required* to mirror the Forum's baseline, but the longer the cert lifetime the larger the blast radius of any single private-key compromise — which is exactly what NIST SP 800-57 Part 1 Rev 5 §5.3.6 (cryptoperiod selection) is saying when it warns against unbounded cryptoperiods.

**Fact two: the SAN list documents Atlas's internal infrastructure.** Twenty entries. Every host you discovered in yesterday's AXFR plus several you didn't — `helpdesk-ticket.atlas.internal`, `tessera-bridge.atlas.internal`, `devops-ci.atlas.internal`, the entire PHI tier (`phi-warehouse`, `pacs-imaging`, `ehr-fhir`). The Subject Alternative Name extension exists so a single cert can authoritatively cover multiple hostnames the operator intends to serve. Whoever issued this cert *enumerated every hostname they wanted it to cover*. That enumeration is now in the cert. Anyone who TCP-connects to :443 on this host gets the enumeration in the handshake.

**Fact three: a wildcard SAN entry — `DNS:*.atlas.internal`.** The wildcard authorizes ANY future hostname under `atlas.internal` without re-issuance. From the operator's perspective this is convenient: new internal services can come online without a CA round-trip. From an attacker's perspective this is a force multiplier: a compromised copy of THIS cert's private key authenticates the attacker AS any internal host the wildcard covers. NIST SP 800-52 Rev 2 §3.1.3 specifically warns against wildcard usage when the wildcard's blast radius exceeds the service's operational need; this is the canonical example. (This fires the `wildcard-cert-sprawl` bonus.)

**Fact four: the Organization field carries an operational reminder.** `Atlas Health Internal CA - DELETE BEFORE PROD 2023`. Three years on, the reminder is still readable in every TLS handshake the server completes. CWE-547 (Use of Hard-coded, Security-relevant Constants) is the catalog reference; the more direct framing is that cert metadata is permanent for the cert's lifetime, and a "I'll change this later" comment in a 10-year cert is a "I'll change this later" comment that survives for ten years. (This fires the `self-signed-ca-blunder` bonus.)

**Fact five: the Subject's OU field — `devops-ci@atlas.health`.** RFC 5280 §4.1.2.4 specifies the subject field as a distinguished-name encoding from X.501, and §4.1.2.6 covers the subject's free-form attributes. Email addresses in OU are non-standard but valid syntactically; some certificate-management tooling will warn ("OU should be a department name, not an email address"), and most will accept the cert anyway. Atlas's habit of using OU for service emails means the cert metadata itself names the operational contact — useful for in-org coordination, catastrophic for adversary recon when the named mailbox is misconfigured.

The Key Usage and Extended Key Usage extensions are unsurprising for a TLS server cert. `Digital Signature, Key Encipherment` are the standard server-cert key usages; `TLS Web Server Authentication, TLS Web Client Authentication` indicates the cert is configured for BOTH server-side termination AND client-side mutual TLS. The client-auth flag is unusual for a "redirect to upstream" host and suggests the original 2023 design contemplated mTLS that was never wired up.

### Step 5: crtsh — what's in the public CT logs

```bash
audit-svc@audit-bypass:~$ crtsh atlas.health
crt.sh — certificate transparency search

Subdomain                          Issuer                             Issued
----------                         ------                             ------
portal.atlas.health                Let's Encrypt (R10)                2026-03-15
api.atlas.health                   Let's Encrypt (R10)                2026-03-15
vpn.atlas.health                   Let's Encrypt (R10)                2026-03-15
www.atlas.health                   Let's Encrypt (R10)                2026-03-15
staging.atlas.health               Let's Encrypt (R3)                 2025-09-08
tessera-bridge.atlas.health        GoDaddy Secure CA-G2               2025-09-12
marcus-test.atlas.health           Let's Encrypt (R3)                 2025-04-22
patientportal-uat.atlas.health     Let's Encrypt (R3)                 2024-06-14
*.atlas.health                     DigiCert SHA2 Secure Server        2023-11-02
```

Nine entries. Three of them are smoking guns.

**`staging.atlas.health` issued 2025-09-08.** Marcus told us in level0 (and on the Q1 2026 quarterly call) that staging was VPN-only "as of Q1 2026." That's not actually true — Atlas requested a Let's Encrypt cert for `staging.atlas.health` in September 2025, which means Atlas wanted public-CA validation of a hostname that's supposed to be VPN-only. Either the VPN-only claim was always aspirational, or somebody at Atlas requested a cert for a hostname they shouldn't have. Either way, the CT log catalogued the fact that `staging.atlas.health` *exists* and is operated by Atlas. CT logs are append-only by design (RFC 6962 §3); the fact can't be unpublished.

**`tessera-bridge.atlas.health` issued 2025-09-12.** Yesterday's TXT-record date plus four days. Tessera was a vendor engagement we kept hearing about from the leftover credentials and dry-run notes. The CT log catalogued the fact that Atlas requested a public cert for a Tessera-themed hostname five months ago. GoDaddy issued it (a different CA than the modern Let's Encrypt issuances — GoDaddy was Atlas's pre-2024 CA of choice). The cert tells us the engagement was real and produced public-facing infrastructure that nobody told us about.

**`marcus-test.atlas.health` issued 2025-04-22.** Marcus tested something. He used Let's Encrypt because that's the easiest CA to request a cert from. He didn't realize that requesting an LE cert PUBLISHES the hostname to crt.sh permanently. Whatever `marcus-test` was, the fact it existed is now in the public record. The cert issuance also implies Marcus had the ability to satisfy LE's domain-control validation (HTTP-01 or DNS-01 challenge), which means in April 2025 he had administrative control over the `atlas.health` zone. This is the kind of "in-the-middle-of-the-night testing" CT log entry that should generate an alert from Atlas's external-attack-surface monitoring — if Atlas has any. Almost certainly they don't.

### Step 6: The autoresponder log — the breadcrumb

```bash
audit-svc@audit-bypass:~$ cat /var/log/exim/autoresponder.log
```

The log captures three outbound auto-reply bodies from the local exim instance, scoped to `devops-ci@atlas.health` (the mailbox the cert's OU named). Two are noise — a generic "we moved the queue to platform-eng" reply, and a Marcus-to-Marcus ACK about the post-AXFR cleanup ticket. The middle one is the finding:

```
2026-04-09 11:08:45 -- autoresponse body for devops-ci@atlas.health --
  PASSWORD RESET AUTORESPONDER — ticket HD-2026-Q2-8814

  Service account:      devops-ci@atlas.health
  Reset requested by:   m.hassan@atlas.health (helpdesk operator)
  Reset method:         temp-cred (72-hour validity)
  Temporary credential: T3mp-DevopsCI-HD8814!q2
  Valid until:          2026-04-12 11:08:00 UTC

  Use this temporary credential to ssh devops-ci@devops-ci.atlas.internal,
  then rotate immediately via `passwd`. The helpdesk operator who
  opened ticket HD-2026-Q2-8814 will be notified on rotation.
```

`T3mp-DevopsCI-HD8814!q2`. That's your level3 credential — the temporary password for `devops-ci@devops-ci.atlas.internal`, issued April 9 with 72-hour validity expiring April 12. As of "right now in the engagement timeline" (April 10, 2026) the cred is good for another two days. The autoresponder shipped it in cleartext to the helpdesk noreply address; the local exim instance logged the cleartext to disk; anyone with read access on this host (`audit-svc`, root, anyone in the `adm` group) gets the cred.

That's CWE-532 (Insertion of Sensitive Information into Log File) at the autoresponder layer, layered on top of a separate finding — the autoresponder is *configured* to ship temporary credentials in the reply body in the first place. That's a process-design failure that the SIEM should flag and the helpdesk runbook should never have authorized. The defender section walks through what a modern password-reset flow looks like (portal-link-driven, IdP-mediated, never cleartext-in-email) but the short version is: this autoresponder pattern is roughly fifteen years out of date.

### Step 7: Document scope, return to lobby

```bash
audit-svc@audit-bypass:~$ exit
```

You found the cert. You found the SAN list. You found the OU field. You found the autoresponder log. You have the level3 credential. The deliverable to Priya is a memo: *the audit-bypass host is still serving production-grade TLS using a 2023-vintage self-signed cert that documents internal infrastructure in its SAN list and identifies a misconfigured autoresponder mailbox in its OU field; the autoresponder has been shipping cleartext temporary credentials to a helpdesk-noreply address; the temporary credential it shipped on 2026-04-09 is still valid through 2026-04-12*. The escalation path is Tier-1 (24-hour client notification, Atlas CISO loop-in, Marcus's manager).

## §3 — The vulnerability

The lesson the level teaches in one sentence: **a TLS cert is metadata-rich public infrastructure documentation that the server hands to every client who connects, and most organizations forget that the metadata is operational ground truth — until it isn't.**

The longer version has two stacked layers.

**Layer one — cert metadata as inventory.** X.509 (the cert format) was designed in 1988 by ITU-T to carry identity attestations for X.500 directory entries. The SAN extension was added in 1999 (RFC 2459) and broadened over the next decade because the original CN-based naming was insufficient for the multi-host TLS deployments the web demanded. The SAN list lets one cert authoritatively cover multiple hostnames, which is operationally cheap; the side effect is that the cert is now a list of every hostname the operator intended to cover. For internal CAs and self-signed certs, "intended to cover" usually means "every hostname I could think of when I generated the cert" — which produces the kitchen-sink SAN lists that mirror the internal hostname inventory.

**Layer two — cert metadata as ID document.** RFC 5280 makes the Subject's distinguished-name fields free-form: C (country), ST (state), L (locality), O (organization), OU (organizational unit), CN (common name), plus email-address attributes. People have been using OU as a free-form note field since the 1990s. Atlas's habit is to put a service email there; other organizations put departmental notes, internal ticket IDs, deployment dates, build numbers. Anything in the Subject is permanent for the cert's lifetime; cert metadata is operational documentation that survives every deploy that doesn't include a cert rotation.

Stack the two layers and you get Atlas's audit-bypass cert: a 10-year metadata document that names every internal host plus a free-form mailbox plus a literal "DELETE BEFORE PROD" reminder — and the metadata is encoded in a way that every TLS-aware tool from `openssl` to `curl -v` to `nmap --script ssl-cert` reads correctly.

Certificate Transparency makes this worse for public-facing certs. RFC 6962 (2013) and its successor RFC 9162 (December 2021) require CAs in browser-trusted root programs to log every issued cert to public append-only CT logs; the major browser vendors enforce this for new certs (Chrome since 2018, Apple since 2021, Mozilla gating new certs starting 2024). crt.sh, run by Sectigo, is the public query interface over the aggregate CT log feed. Any cert any browser-trusted CA has issued for a domain you control is in those logs forever. Revoking the cert doesn't unpublish the log entry. Rotating the cert doesn't unpublish the log entry. The CT log is the permanent record of every hostname any cert ever covered.

The defenses against all of this are mature and documented; nobody at Atlas applied them.

## §4 — Real-world parallels

**Mandiant UNC5537 / Snowflake 2024.** In June 2024 Mandiant attributed a campaign hitting Snowflake customer instances to UNC5537, a financially-motivated threat actor. The campaign compromised dozens of Snowflake customers including AT&T, Ticketmaster, and Santander. The initial-access mechanism was credential stuffing against Snowflake customer URLs that the attackers had enumerated via several recon paths — including DNS / subdomain enumeration and credential reuse from infostealer logs. Mandiant's [June 2024 advisory](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion) documents external-recon as the first stage of the kill chain. Atlas's CT-log exposure of `staging.atlas.health` and `marcus-test.atlas.health` is exactly the recon surface UNC5537 capitalized on.

**DigiNotar 2011.** A Dutch root CA was compromised in mid-2011 by an attacker who issued forged wildcard certs for `*.google.com`, `*.skype.com`, and over 500 other high-value domains. The forged certs were used to intercept Iranian Gmail traffic. DigiNotar was removed from major browser trust stores in September 2011 and filed for bankruptcy a week later. The lesson Atlas should take from DigiNotar is that *issuance authority is power*: an internal CA that issues 10-year wildcards covering every internal hostname concentrates that power in one private key, and the private key for Atlas's self-signed cert is sitting on a host the asset-management tool says doesn't exist. Mozilla's [Fraudulent Google.com Certificate post](https://blog.mozilla.org/security/2011/08/29/fraudulent-google-com-certificate/) and the [DigiNotar removal follow-up](https://blog.mozilla.org/security/2011/09/02/diginotar-removal-follow-up/) cover the response timeline; [the Wikipedia article](https://en.wikipedia.org/wiki/DigiNotar) carries the consolidated case study.

**Sony Pictures 2014.** The Sony Pictures Entertainment breach in November 2014 — attributed by the FBI to North Korea's Lazarus Group — included an extensive reconnaissance phase before the destructive Wiper payload deployed. The phase included internal network enumeration via tools the attackers introduced after initial access; the community-of-practice writeups emphasize that the cataloguing of internal infrastructure prior to the destructive phase made the destructive phase comprehensive. The map preceded the burn. The [Wikipedia case study](https://en.wikipedia.org/wiki/Sony_Pictures_hack) is a usable summary; the original US-CERT alert (TA14-353A) circulates as a PDF in archives. Internal-CA-cert SAN lists are catalogues of exactly the kind the attackers would otherwise spend weeks building.

**The general "subdomain takeover via dangling CT-log data" class.** SANS, Bugcrowd, and HackerOne have all published case studies on the pattern: a company requests a cert for `marketing-prod-2018.example.com`, deploys the service, eventually decommissions it, and forgets to either remove the DNS entry or delete the cloud-CDN configuration that the DNS pointed at. The CT-log entry remains. An attacker watching the CT logs for `*.example.com` sees the entry, tries the hostname, finds the dangling CDN config, registers it themselves, and now controls a subdomain on a brand the original company owned. Patrik Hudak's [research blog](https://0xpatrik.com/subdomain-takeover/) is the canonical primer. Atlas's `patientportal-uat.atlas.health` CT entry is exactly the pattern: a UAT hostname that no longer resolves, still publicly enumerable via CT, with whatever DNS / CDN configuration it points at probably long-defunct and waiting to be claimed.

**Internal-CA misconfiguration at scale.** SpecterOps's [Certified Pre-Owned ADCS research](https://specterops.io/blog/2021/06/17/certified-pre-owned/) by Will Schroeder and Lee Christensen catalogues Active Directory Certificate Services misconfigurations that allow privilege escalation via cert issuance — different threat model than Atlas's self-signed Apache cert but the same underlying principle that "the CA's issuance behavior is the security boundary". When the CA misissues, the entire trust hierarchy underneath it inherits the misissuance. Atlas's CA habit ("OU is for service emails", "ten-year validity is fine for internal certs", "every internal host goes in the SAN list") is the procedural equivalent of an ADCS template misconfiguration.

## §5 — Frameworks, deep dive

**CWE-200 — Exposure of Sensitive Information to an Unauthorized Actor.** The umbrella weakness MITRE flags as "Discouraged for mapping" in current CWE guidance, because CWE-200 is too broad to be surgical. The surgical CWEs are below.

**CWE-1188 — Insecure Default Initialization of Resource.** The Apache vhost was set up with a self-signed 10-year cert as the *default* configuration, then never reconfigured. Defaults are policy: whatever the operator typed at setup is what the system runs in perpetuity. The CWE-1188 framing is "the default initialization is insufficient" — Atlas's default was `openssl req -new -x509 -days 3650 -keyout audit-bypass.key -out audit-bypass.crt -subj '/C=US/ST=Washington/O=Atlas Health Internal CA - DELETE BEFORE PROD 2023/OU=devops-ci@atlas.health/CN=audit-bypass.atlas.internal'`, and the default has been live ever since.

**CWE-547 — Use of Hard-coded, Security-relevant Constants.** The wildcard `*.atlas.internal` SAN entry plus the literal `DELETE BEFORE PROD 2023` Organization field are hard-coded security-relevant constants. They encode operational policy ("this cert covers everything", "this cert is temporary") in immutable cert metadata. The cert can't be edited; it can only be replaced. Nobody replaced it.

**CWE-532 — Insertion of Sensitive Information into Log File.** The exim autoresponder logs the cleartext temporary-credential reply body to `/var/log/exim/autoresponder.log`. The cred is in the log because the autoresponder was configured to ship it in the reply body, but the LOGGING of the cleartext reply body is a separate insecure-design choice on top of the disclosure-by-email choice.

**NIST SP 800-52 Rev 2 — Guidelines for the Selection, Configuration, and Use of Transport Layer Security (TLS) Implementations.** August 2019 publication ([NIST CSRC](https://csrc.nist.gov/pubs/sp/800/52/r2/final)). §3.1.3 covers wildcard usage and warns against wildcard certs whose scope exceeds operational need. §3.2.2 covers certificate validity periods and aligns with the CA/Browser Forum baseline. Atlas's cert fails both controls.

**NIST SP 800-57 Part 1 Rev 5 — Recommendation for Key Management: Part 1 — General.** May 2020 publication ([NIST CSRC](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)). §5.3.6 covers cryptoperiod selection: the recommended cryptoperiod for a TLS-server private key is short (1-3 years for high-assurance use). A 10-year cert exceeds the cryptoperiod by a wide margin.

**RFC 5280 — Internet X.509 Public Key Infrastructure Certificate and CRL Profile.** May 2008 publication, the canonical reference for the X.509 v3 cert format used today. §4.1.2 defines the cert content (Issuer, Subject, Validity, public key, extensions); §4.2.1.6 specifically defines the Subject Alternative Name extension. The free-form OU field is permitted; Atlas's use of email-in-OU is non-standard but syntactically valid.

**RFC 6962 — Certificate Transparency.** June 2013 publication ([IETF datatracker](https://datatracker.ietf.org/doc/html/rfc6962)) — the protocol that introduced append-only CT logs as the cryptographic record of every public-CA-issued cert. The follow-up RFC 9162 ("Certificate Transparency Version 2.0") was published December 2021. CT is what makes `staging.atlas.health`'s 2025-09-08 cert permanently public.

**HIPAA Security Rule (45 CFR Part 164, Subpart C).** §164.312(e)(2)(ii) — encryption is required for ePHI in transit when deemed reasonable and appropriate. TLS termination with a self-signed 10-year cert nobody validates downstream meets the literal control while failing the spirit. §164.312(b) — audit controls. Atlas's autoresponder shipping cleartext credentials should have been flagged by audit controls; it wasn't, because the audit controls don't extend to exim auto-reply behavior on hosts the asset-management tool says don't exist. The 2024 HIPAA Security Rule NPRM proposes [stronger explicit encryption requirements](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) (published January 6, 2025; comment period closed March 7, 2025); if the NPRM finalizes, "encryption appropriate to address known threats" becomes a near-mandatory baseline.

**HITECH Act + Breach Notification Rule (45 CFR Part 164, Subpart D).** Breaches of ePHI must be reported to HHS Office for Civil Rights within 60 days; breaches affecting 500+ individuals trigger media notification under §164.408. Atlas's cert leakage doesn't directly disclose PHI, but the SAN list catalogues the PHI-tier hostnames (`phi-warehouse`, `pacs-imaging`, `ehr-fhir`), which is reconnaissance enabling future PHI access. The breach notification clock starts on *discovery*; Driftwood discovering this on April 10 starts Atlas's clock April 10 if PHI access is determined to have occurred.

**OWASP Top 10 (2025) — A02: Security Misconfiguration.** The cert is the misconfiguration; the autoresponder is a separate misconfiguration; the still-serving "decommissioned" host is a third. Misconfiguration moved from A05 (2021) to A02 (2025) because it remains the most common root cause of breaches across OWASP's source-data partners.

**OWASP Top 10 (2025) — A04: Cryptographic Failures.** "Data exposed via flawed cryptographic posture." TLS misconfiguration is the canonical example. Wildcard sprawl + self-signed-with-no-validation chain both apply.

**OWASP TLS Cheat Sheet.** The [Transport Layer Protection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html) tracks CA/Browser Forum + Mozilla server-side TLS recommendations: short-lived certs, ACME automation (cert-manager, acme.sh), wildcard avoidance, modern cipher suites.

**CIS Critical Security Controls v8.1.** [Control 3.10](https://www.cisecurity.org/controls/cis-controls-list) — Encrypt Sensitive Data in Transit. Control 4.6 — Securely Manage Enterprise Assets and Software (the "decommissioned but still serving" host fails this). Control 12.5 — Centralize Network AAA (the per-host exim autoresponder routes around centralized auth). v8.1 published May 2024.

**CA/Browser Forum Baseline Requirements.** Public-CA issuance baseline ([CA/Browser Forum](https://cabforum.org/baseline-requirements/)). The Forum's baseline currently caps server-cert validity at 398 days; in April 2025 the Forum passed Ballot SC-081v3 introducing a phased reduction schedule that ends at 47-day validity by March 2029. The full baseline document at the linked page carries the current cap and the schedule reference. Atlas's 10-year self-signed cert is 9× the current public baseline; the gap will be 76× when the phased reduction completes.

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701).** Current revision is SY0-701, available since November 2023; predecessor SY0-601 retired July 2024. Domain 1.4 (Cryptographic concepts) and Domain 4.5 (Modify enterprise capabilities to enhance security — specifically TLS/SSL and certificate-management). The exam-objective bullets explicitly name "wildcard certificates" and "self-signed certificates" as topics. The [CompTIA Security+ cert page](https://www.comptia.org/en-us/certifications/security/) is the official scope reference and links to the current objectives PDF.

**CompTIA CySA+ (CS0-003 / CS0-004).** CS0-004 launched in early 2026 for parallel availability; CS0-003 retires June 2026. Domain 1 (Security Operations) covers TLS posture audit; Domain 2 (Threat Intelligence & Threat Hunting) covers CT-log monitoring as a defender discipline. CS0-004 explicitly adds CT-log-monitoring to the threat-hunting techniques covered.

**CompTIA PenTest+ (PT0-003).** Current revision is PT0-003, available since December 2023. Domain 2 (Reconnaissance and Enumeration) names crt.sh + SAN enumeration as in-scope tooling. The level you just played is the textbook PenTest+ recon scenario.

**(ISC)² CISSP.** Domain 3 (Security Architecture and Engineering) — PKI, cryptographic protocols, cert lifecycle. Domain 4 (Communication and Network Security) — TLS as a protocol, what cert metadata reveals. The CISSP CBK was substantively refreshed in May 2024 and the cert-lifecycle topic was expanded to cover CT and short-lived-cert automation.

**OffSec OSCP / PEN-200.** Standard recon move on any HTTPS endpoint in the lab. The 2023 PEN-200 curriculum revision moved CT-log enumeration earlier in the recon module; every PEN-200 student now learns `crt.sh` and `subfinder` as basic-tier tools.

**EC-Council CEH v13.** Module 4 (Enumeration) covers DNS + cert enumeration as recon techniques. The v13 release (April 2024) added explicit CT-log coverage.

## §7 — What a defender does

**Inventory ALL internal-CA-issued certificates.** Pick a tool: [HashiCorp Vault PKI](https://developer.hashicorp.com/vault/docs/secrets/pki), [Smallstep step-ca](https://smallstep.com/docs/step-ca/), [AWS Private CA](https://docs.aws.amazon.com/privateca/latest/userguide/), or [cert-manager](https://cert-manager.io) for Kubernetes. Document the issuance pipeline. Audit existing on-disk certs against that pipeline; anything that isn't pipeline-issued gets rotated through the pipeline. The pipeline is the security boundary.

**Short-lived certs by default.** 90-day certs with ACME automation are the modern default. Let's Encrypt has been operating on 90-day cert lifetimes since 2015; cert-manager + ACME makes that operationally trivial. The Forum's drift toward 47 days will close the gap further. The shorter the cert lifetime, the smaller the blast radius of any single private-key compromise — and the more reflexive the rotation muscle is.

**Per-service SAN scope.** Each cert covers exactly the hostnames the service actually serves. The argument for wildcards ("we can't predict the next hostname") is the argument against wildcards ("the cert authenticates as hostnames we never thought about"). Mandiant, CrowdStrike, and the [Verizon Data Breach Investigations Report (DBIR)](https://www.verizon.com/business/resources/reports/dbir/) have all noted internal-CA wildcards in lateral-movement post-mortems; the 2025 DBIR calls out cert hygiene as one of the cheaper defender wins.

**Monitor CT logs for your own domain.** crt.sh queries return JSON; [Censys CT-log monitoring](https://search.censys.io/certificates), [SecurityTrails](https://securitytrails.com/), [Cert Spotter](https://sslmate.com/certspotter/), and [Hardenize](https://www.hardenize.com/) all publish services that alert on unexpected issuances. The `marcus-test.atlas.health` entry on 2025-04-22 should have generated an alert in 2025-04. Most organizations don't set this up because it requires a small operational decision about where alerts route; the alternative is finding out about unauthorized issuances when an external party reports them.

**Decommissioned hosts get reimaged or torn down, not left at "awaiting reimage."** The MDM-says-dead / firewall-says-alive split is recurring across industries. Close it by coupling MDM state to firewall ACLs: [Tailscale ACLs](https://tailscale.com/kb/1018/acls), [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/), or AWS Security Groups managed by an asset-inventory tool that knows host state. The asset-inventory tool becomes the source of truth; the firewall reads from it.

**Autoresponders never ship cleartext credentials.** If a mailbox needs to issue a temp cred, it does so through a portal link the requester clicks while authenticated, not via reply-body cleartext. Modern alternatives: Atlassian Jira Service Management's password-reset workflow, [JumpCloud Self-Service](https://jumpcloud.com/) reset, [Okta Workflows](https://www.okta.com/products/workflows/), any IdP-tier reset. The autoresponder pattern is roughly fifteen years out of date and most modern compliance frameworks treat reply-body cleartext credentials as an explicit finding.

**Audit exim / postfix outbound for cleartext-credential patterns.** SIEM rules in Splunk / Sentinel / Elastic looking for `password is`, `temp credential`, `valid for 72 hours`, `T3mp-`-prefixed strings across SMTP relay logs catch the pattern proactively. Atlas's autoresponder pattern would have been flagged by any of these rules; nobody set them up.

**Generate a TLS configuration with the Mozilla TLS generator.** The [Mozilla TLS Generator](https://ssl-config.mozilla.org/) produces ready-to-paste Apache / nginx / HAProxy / Caddy configs for the modern (intermediate / modern) TLS profiles. The "modern" profile aligns with NIST SP 800-52 Rev 2 and CIS Control 3.10. Operators who use the generator land on safe-by-default configs; operators who copy-paste a 2019 stackoverflow answer land on Atlas's 2023 config.

## §7.5 — Optional exploration

Both bonus finds trigger on the same `openssl x509 -text -noout -in /etc/apache2/ssl/audit-bypass.crt` command. They surface the two specific failures that make the cert worse than a generic "old self-signed cert" finding.

**Bonus find — Wildcard *.atlas.internal in the SAN list.** The wildcard authorizes any present-or-future hostname under `atlas.internal` without re-issuance. The NIST SP 800-52 Rev 2 §3.1.3 framing is the textbook reference: wildcards are explicitly warned-against when the wildcard's blast radius exceeds operational need. The deeper lesson is about the difference between "operational convenience" and "security boundary" — wildcard certs trade explicit issuance overhead (one cert per hostname) for blast-radius growth (one private key authenticates as the entire wildcarded zone). In high-assurance environments (HIPAA, PCI-DSS, FedRAMP) the trade-off is no longer acceptable; the modern automation tooling (cert-manager, step-ca with ACME) makes per-hostname issuance cheap enough that wildcards are no longer the operational shortcut they once were.

**Bonus find — Self-signed CA with 'DELETE BEFORE PROD' in the Subject.** The Organization field carries an operational reminder that nobody acted on. The deeper lesson is about cert metadata being permanent: the cert can't be edited in place, only replaced, and replacement requires the same kind of follow-through that the original "DELETE BEFORE PROD" reminder was trying to prompt. CWE-547 catalogues this as "Use of Hard-coded, Security-relevant Constants" — the cert's metadata encodes operational policy in a way the operational tooling can't read or enforce, and the encoding is durable for the cert's lifetime. The modern fix is procedural: cert issuance goes through a pipeline (Vault PKI, step-ca, cert-manager) that knows about cert lifetime AND about the asset-management state of the host the cert covers, and the pipeline refuses to issue 10-year certs in the first place.

## §8 — Key takeaways

1. **TLS certs are public documents the server hands to every client.** Don't put information in them you don't want disclosed. The Subject's distinguished-name fields, the SAN list, the Extensions section — all are readable by anyone who can TCP-connect to the server.

2. **Self-signed leaf certs aren't a vulnerability in themselves, but they signal an unmanaged CA process.** Production environments should run an internal CA (Vault PKI / step-ca / AWS Private CA) with a proper issuance pipeline that knows about cert lifetime, hostname scope, and host lifecycle.

3. **Wildcard certs are blast-radius multipliers.** One private key authenticates as the entire wildcarded zone. NIST SP 800-52 Rev 2 §3.1.3 warns against the pattern; the modern automation tooling makes per-hostname issuance cheap.

4. **Cert metadata is permanent for the cert's lifetime.** "I'll change this later" comments in a 10-year cert survive for ten years. Either rotate quickly (short-lived certs + ACME automation) or don't put operational reminders in cert metadata in the first place.

5. **Certificate Transparency makes public-CA-issued cert metadata permanent forever.** crt.sh queries return every hostname any CA ever issued a cert for. Monitor your own CT log entries; alert on unexpected issuances; treat the CT log as part of your external attack surface.

6. **Decommissioned hosts that the firewall still routes to are still attack surface.** Couple MDM state to firewall ACLs. The asset-inventory tool becomes the source of truth; the firewall reads from it.

7. **Cleartext credentials in email reply bodies are a fifteen-year-out-of-date pattern.** Modern password-reset flows use portal-link-mediated, IdP-authenticated reset workflows that never put credentials on the wire in cleartext.

The level3 credential — `T3mp-DevopsCI-HD8814!q2` — is in `/var/log/exim/autoresponder.log` because Atlas's autoresponder was configured to ship temporary credentials in cleartext and the local exim instance was configured to log the auto-reply body. The breadcrumb to level3 isn't a leak the way yesterday's TXT record was a leak; it's a leak by design.

## §9 — Further reading

*Last reviewed: April 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

**TLS cert hygiene and modern PKI**

- [NIST SP 800-52 Rev 2](https://csrc.nist.gov/pubs/sp/800/52/r2/final) — Guidelines for TLS Implementations (August 2019).
- [NIST SP 800-57 Part 1 Rev 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final) — Recommendation for Key Management Part 1 (May 2020).
- [RFC 5280](https://datatracker.ietf.org/doc/html/rfc5280) — Internet X.509 Public Key Infrastructure Certificate and CRL Profile (May 2008).
- [RFC 6962](https://datatracker.ietf.org/doc/html/rfc6962) — Certificate Transparency (June 2013).
- [RFC 9162](https://datatracker.ietf.org/doc/html/rfc9162) — Certificate Transparency Version 2.0 (December 2021).
- [Mozilla Server-Side TLS Configuration Generator](https://ssl-config.mozilla.org/) — modern / intermediate / old profiles for Apache, nginx, HAProxy, Caddy.
- [CA/Browser Forum Baseline Requirements](https://cabforum.org/baseline-requirements/) — public-CA issuance baseline.
- [HashiCorp Vault PKI Secrets Engine](https://developer.hashicorp.com/vault/docs/secrets/pki) — internal-CA tooling.
- [Smallstep step-ca](https://smallstep.com/docs/step-ca/) — internal-CA tooling with ACME.
- [cert-manager](https://cert-manager.io) — Kubernetes-native cert automation.
- [AWS Private Certificate Authority](https://docs.aws.amazon.com/privateca/latest/userguide/) — managed internal CA.

**Certificate Transparency monitoring + recon**

- [Sectigo crt.sh CT-log search](https://crt.sh/) — public CT-log query interface.
- [Censys Certificates Search](https://search.censys.io/certificates) — academic + commercial CT-log search.
- [Cert Spotter](https://sslmate.com/certspotter/) — open-source CT monitor + SaaS.
- [SecurityTrails](https://securitytrails.com/) — DNS + CT historical data.
- [Hardenize](https://www.hardenize.com/) — TLS + DNS hygiene scoring with CT monitoring.
- Patrik Hudak — [subdomain-takeover primer](https://0xpatrik.com/subdomain-takeover/) (the canonical class-of-vuln reference).

**Real-world cases**

- Mandiant — [UNC5537 / Snowflake 2024 advisory](https://cloud.google.com/blog/topics/threat-intelligence/unc5537-snowflake-data-theft-extortion).
- Mozilla — [Fraudulent Google.com Certificate (August 2011 DigiNotar post)](https://blog.mozilla.org/security/2011/08/29/fraudulent-google-com-certificate/) and [DigiNotar removal follow-up (September 2011)](https://blog.mozilla.org/security/2011/09/02/diginotar-removal-follow-up/).
- Wikipedia — [DigiNotar consolidated case study](https://en.wikipedia.org/wiki/DigiNotar).
- Wikipedia — [Sony Pictures hack 2014](https://en.wikipedia.org/wiki/Sony_Pictures_hack) (the original US-CERT TA14-353A advisory now circulates as a PDF in archives).
- SpecterOps — [Certified Pre-Owned: Active Directory Certificate Services attack surface](https://specterops.io/blog/2021/06/17/certified-pre-owned/) by Will Schroeder and Lee Christensen.

**OWASP and CIS**

- [OWASP Top 10:2025](https://owasp.org/Top10/) — A02 Security Misconfiguration, A04 Cryptographic Failures.
- [OWASP Transport Layer Protection Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html) — modern TLS configuration guide.
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/cis-controls-list) — Controls 3.10, 4.6, 12.5 covered above.

**HIPAA + healthcare-vertical**

- [HIPAA Security Rule (45 CFR Part 164, Subpart C)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C) — §164.312 covers Technical Safeguards.
- [HIPAA Security Rule NPRM (January 2025)](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) — proposed strengthening of encryption requirements (comment period closed March 7, 2025).
- HHS — [Breach Notification Rule reporting portal](https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf).

**MITRE ATT&CK references**

- [T1596.003 — Search Open Technical Databases: Digital Certificates](https://attack.mitre.org/techniques/T1596/003/).
- [T1590.001 — Gather Victim Network Information: Domain Properties](https://attack.mitre.org/techniques/T1590/001/).
- [T1190 — Exploit Public-Facing Application](https://attack.mitre.org/techniques/T1190/).
- [T1213.005 — Data from Information Repositories: Messaging Applications](https://attack.mitre.org/techniques/T1213/005/).
- [T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
