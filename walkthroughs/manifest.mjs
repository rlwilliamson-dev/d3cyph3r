// D3CYPH3R Walkthroughs — the manifest of tracks and levels.
//
// Single source of truth for what walkthroughs exist, their titles,
// and their blurbs. Imported by BOTH:
//
//   - tools/build-walkthroughs.mjs (Node, at generation time) to emit
//     the static pages, sitemap, and search index.
//   - walkthroughs/search.js (browser, at runtime) for result labels.
//
// Track order matches the lobby's track order in js/engine/tracks.js.
// Level order within a track is the play order, which the generator
// relies on to compute prev/next navigation.
//
// Adding a walkthrough means adding its entry here AND dropping the
// markdown file at walkthroughs/<track>/<level>.md, then re-running
// the generator: `node tools/build-walkthroughs.mjs`

export const MANIFEST = {
  linux: {
    title: "Linux",
    blurb:
      "File reading, credential hunting, and the consultant-laptop " +
      "audit pattern. Client: Halton Bank — GLBA Safeguards Rule.",
    levels: {
      level0: {
        title: "Daniel's Last Day",
        blurb:
          "Audit an offboarded consultant's laptop before reimaging. " +
          "Find the client credential he left behind.",
      },
      level1: {
        title: "The Backup Daniel Forgot",
        blurb:
          "Day two. Using the leaked staging credential, walk Halton's " +
          "jumphost. A debug copy of a properly-locked-down systemd " +
          "override leaks the production DB password. CWE-732.",
      },
      level2: {
        title: "Daniel's Forgotten Cron",
        blurb:
          "Day three. Halton reuses the prod DB password as the bastion " +
          "SSH login. Inside, an offboarded consultant's cron job runs " +
          "weekly under bash `set -x` and writes its SSH-key passphrase " +
          "to a world-readable log. CWE-250 + CWE-532 + CWE-521.",
      },
      level3: {
        title: "Daniel's Forgotten Sudo",
        blurb:
          "Daniel's snapshot key drops you onto the build-runner as him. " +
          "`sudo -l` reveals a leftover NOPASSWD grant that survived his " +
          "offboarding; a wildcard `sudo cat` reads a prod Vault root " +
          "token the weekly backup swept up. CWE-250 + CWE-732 + CWE-312.",
      },
    },
  },
  network: {
    title: "Network",
    blurb:
      "Port scanning, perimeter audit, and DNS reconnaissance. " +
      "Client: Atlas Health — HIPAA.",
    levels: {
      level0: {
        title: "Atlas Health Perimeter Check",
        blurb:
          "Quarterly verification of a healthcare client's claim that " +
          "their staging database is VPN-only. nmap finds it isn't.",
      },
      level1: {
        title: "The Map Marcus Didn't Mean to Share",
        blurb:
          "Day two. With Priya's authorized blast-radius check, the " +
          "staging-DB host's internal DNS resolver gives up the full " +
          "data-center map plus a service-account credential stashed " +
          "in a TXT record. CWE-306 + the sticky-account anti-pattern.",
      },
      level2: {
        title: "What the Cert Knew",
        blurb:
          "Day three. The Tessera-dry-run audit-bypass cred lands the " +
          "player on a host the asset-management tool says doesn't " +
          "exist. Apache's self-signed cert documents Atlas's internal " +
          "infrastructure in its SAN list, names a service mailbox in " +
          "its OU field, and the mailbox's autoresponder log ships the " +
          "level3 temp credential in cleartext. CWE-1188 + CWE-547 + " +
          "CWE-532 plus CT-log permanence (RFC 6962).",
      },
    },
  },
  crypto: {
    title: "Crypto",
    blurb:
      "Encoding ≠ encryption, and signing ≠ verifying. " +
      "Client: Vesta Retail — PCI-DSS.",
    levels: {
      level0: {
        title: "Theo's Safer API Key",
        blurb:
          "Pre-PCI-DSS-audit review at a retailer. A junior engineer " +
          "base64-encoded a payment-processor API key and called it " +
          "protection. base64 is not protection.",
      },
      level1: {
        title: "Theo's Signature That Wasn't",
        blurb:
          "Day two. Same engineer shipped a homegrown JWT auth for " +
          "Vesta's internal admin API — verify-middleware calls " +
          "jwt.verify without an algorithms whitelist. Tokens with " +
          "alg:none get accepted. CWE-347 + CWE-532 for the secrets " +
          "in the debug log.",
      },
      level2: {
        title: "Theo's Quick Hash",
        blurb:
          "Day three. Saanvi (CISO) pulled a wider review and Priya " +
          "found Theo's commit titled \"safer than plaintext\" — 200 " +
          "unsalted MD5 hashes in the deploy repo. john --wordlist=" +
          "rockyou.txt cracks four of them in under a second; all " +
          "four are the same plaintext (TheoVesta!1), one labeled " +
          "aes-backup. CWE-916 + CWE-759 + CWE-521 + CWE-262, plus " +
          "PCI-DSS v4.0 §3.5.1 + §8.3.2 + NIST SP 800-63B-4.",
      },
      level3: {
        title: "Theo's Encrypted Backup",
        blurb:
          "Day four, and the capstone of the track. The password " +
          "john cracked is the AES passphrase on Vesta's nightly " +
          "production backup — and the login on the host holding " +
          "it. AES-256 is never broken here; the key was the whole " +
          "problem. Inside: full PANs and retained CVV, which no " +
          "amount of encryption makes permissible. CWE-326 + " +
          "CWE-522 + CWE-312, PCI-DSS v4.0.1 §3.3.1 + §3.5.1 + " +
          "§3.7, OWASP A04:2025.",
      },
    },
  },
  web: {
    title: "Web",
    blurb:
      "HTTP directory enumeration and broken access control. " +
      "Client: Meridian State University — FERPA.",
    levels: {
      level0: {
        title: "Meridian's Forgotten Backup Folder",
        blurb:
          "Pre-cyber-insurance-renewal web audit at a state university. " +
          "A dismissed agency left a backup directory under DocumentRoot " +
          "with autoindex on. 4,217 student records + a live DB credential.",
      },
      level1: {
        title: "Carlos's Login Wall",
        blurb:
          "Day two. Carlos's homegrown transcript-download endpoint is " +
          "behind SSO but never checks per-student authorization. Any " +
          "logged-in student can pull any other student's transcript. " +
          "IDOR via CWE-639 + a BluePier-era demo account whose " +
          "advisor_notes field carries the level2 breadcrumb.",
      },
      level2: {
        title: "The Search Bar That Talks",
        blurb:
          "Day three. The portal-svc credential from level1 (SSH-reused " +
          "across hosts) lands you on the catalog host, where BluePier's " +
          "2021 course-search glues the query parameter straight into a " +
          "SQL string. UNION-based SQL injection through a public, " +
          "unauthenticated search box dumps the app's config table — the " +
          "plaintext DB-admin credential — and reaches the FERPA-protected " +
          "students table. CWE-89 + verbose-error (CWE-209) leak.",
      },
    },
  },
  forensics: {
    title: "Forensics",
    blurb:
      "EXIF metadata and insider-threat analysis. Client: Polaris Defense " +
      "Systems — CMMC / NIST 800-171.",
    levels: {
      level0: {
        title: "Reed's Soccer Alibi",
        blurb:
          "Internal investigation at a defense subcontractor. A cleared " +
          "engineer's submitted alibi photo carries EXIF metadata placing " +
          "it eight months earlier and 1,000 miles south.",
      },
      level1: {
        title: "What the Logs Saw",
        blurb:
          "Day two. Polaris IR imaged Reed's workstation; the Security " +
          "event log carries his Saturday-morning CUI-exfil chain " +
          "(PowerShell Compress-Archive → certutil -encode → chrome → " +
          "mega.nz) AND an IR responder's password mistyped into the " +
          "TargetUserName field of a 4625 failed-logon record. " +
          "CWE-532 + the LOLBin / Valid-Accounts insider-threat pattern.",
      },
      level2: {
        title: "What Reed's Browser Saw",
        blurb:
          "Day three. The IR-lead credential from level1 unlocks " +
          "Polaris IR's forensic bench, where Reed's seized Chromium " +
          "History + Cookies databases sit ready to query. SQL formation " +
          "via the new sqlite3 command surfaces a 02:47 pre-dawn webmail " +
          "visit, pre-meditation searches around CUI handling rules, and " +
          "a live Google SID cookie value that gates level3. NIST SP " +
          "800-86 + CMMC Level 2 AU.L2-3.3.x audit-record discipline.",
      },
      level3: {
        title: "What Reed's Mail Proved",
        blurb:
          "Day four. The session artifact named the account for a " +
          "2703(d) order, and Google's production is on the bench. " +
          "Reed's counsel produced an email authorizing everything — " +
          "so compare it against a genuine message from the same " +
          "sender. The From: header is free text; the Received: chain " +
          "is written by servers and read bottom-up, and it says the " +
          "message was composed 34 hours after its own Date: claims. " +
          "CWE-290, SPF/DKIM/DMARC (RFC 9989), NIST SP 800-177.",
      },
    },
  },
  osint: {
    title: "OSINT",
    blurb:
      "Open-source breach corpus and identity reconnaissance. Client: " +
      "Veridian Analytics — HIPAA / HITRUST CSF.",
    levels: {
      level0: {
        title: "Veridian's Open Letter",
        blurb:
          "Executive-protection OSINT for a newly-hired CMO at a HIPAA " +
          "Business Associate. HIBP surfaces the same cleartext password " +
          "in two breaches — the high-confidence credential-reuse signal.",
      },
      level1: {
        title: "Aaron's Weekend Project",
        blurb:
          "Day two. After Friday's HIBP finding, Marisol expands scope to " +
          "Aaron's developer footprint. His public GitHub has a clinical-" +
          "era personal project with a committed `.env` at HEAD carrying " +
          "live AWS access keys, an OpenFDA personal API key, and a Flask " +
          "secret — the .gitignore was added later (and lists `.env`) but " +
          "doesn't retroactively untrack the file. CWE-798 + CWE-540, with " +
          "the universal source-control credential-leak mechanic on display.",
      },
      level2: {
        title: "The Internet Never Forgets",
        blurb:
          "Day three. Aaron deleted the leaky repo and called it fixed — " +
          "so the `wayback` Machine becomes the proof that deletion isn't " +
          "remediation: the 2023-24 captures still serve the repo while the " +
          "live URL 404s, and the AWS key was never rotated. An archive " +
          "sweep of Aaron's scrubbed 2009 personal site recovers a " +
          "pseudonymous handle, `sherlock` maps his 'other life,' and a " +
          "homelab blog post pastes a cleartext Nextcloud admin password " +
          "that gates level3. Internet Archive permanence, alias " +
          "attribution, robots.txt as a map (WSTG-INFO-03), CWE-312.",
      },
    },
  },
  cloud: {
    title: "Cloud",
    blurb:
      "AWS S3, IAM, EC2 auditing + RDS-adjacent psql enumeration. " +
      "Client: Coverline Insurance — SOC 2 / NAIC / NYDFS / GLBA.",
    levels: {
      level0: {
        title: "Coverline's Twelfth Bucket",
        blurb:
          "Mid-SOC-2-audit gap-fill at an insurtech carrier. A six-bucket " +
          "worksheet walks cleanly until one — claims-uploads-prod — " +
          "lists publicly with PII + a hardcoded RDS password.",
      },
      level1: {
        title: "The Migration Table Nobody Dropped",
        blurb:
          "Day three. With Friday's leaked RDS master credential, " +
          "Driftwood enumerates the coverline_claims production DB to " +
          "inform Sloane's breach-notification math. A `migration_artifacts` " +
          "table from the 2024 region cutover has explicit TTL columns " +
          "intending Q2 2024 deletion that never happened — the " +
          "broker-portal service credential is the level2 breadcrumb. The " +
          "audit log also has a single anomalous schema-enumeration query " +
          "from 2026-05-20 02:14 UTC with no captured source IP " +
          "(`pgaudit` was never enabled). CWE-798 + CWE-540 + the " +
          "credentials-in-DB-rows anti-pattern.",
      },
      level2: {
        title: "The Key Nobody Turned Off",
        blurb:
          "Day three. The recovered broker-portal-svc credential turns out " +
          "to be an over-permissioned IAM user, so Driftwood runs a " +
          "least-privilege pass across Coverline's account. Among 16 " +
          "principals, a 2024-migration `legacy-deploy-bot` still carries " +
          "AdministratorAccess and a still-Active access key last used in " +
          "2024 — a dormant god-mode credential nobody turned off. Its " +
          "secret, left in a leftover bootstrap-creds file on the bastion, " +
          "is the level3 breadcrumb. Three bonus finds: an orphaned " +
          "terminated-employee account, a never-rotated 2019 key, and a " +
          "root access key. CWE-269 / CWE-250 + CIS AWS 1.4/1.12/1.16 + " +
          "MITRE T1078.004.",
      },
    },
  },
};
