// Crypto track levels.
//
// See levels/linux.js for the full schema documentation. Crypto-specific
// fields used by js/commands/crypto.js:
//
//   files                — flat map of "filename" → "content" (auto-built
//                          from `fs` by initLevels, but used directly by
//                          base64 / rot13 / xxd / decode-hex / hash-id /
//                          john / xor since these commands operate on
//                          file content, not the tree).
//   rot13Out             — optional per-file override map for rot13 output
//                          when you need a specific decoded string rather
//                          than the naive 13-shift of the file's content.
//   johnCrack            — map of filename → { type, plain, wordlist, time }
//                          telling the `john` command what to "crack" the
//                          file's hash to.
//
// Continuity: all levels are set at Driftwood Systems, a mid-sized tech
// consulting firm. Each track introduces a new client engagement to
// diversify the post-mortems' compliance contexts (PCI-DSS here).

export const cryptoLevels = {

  // ── level 0 — "Theo's Safer API Key" ────────────────────────────
  // Player audits a Vesta Retail deploy script before the client's
  // annual PCI-DSS re-attestation. A junior Vesta engineer (Theo)
  // committed a "fix" that moved the payment-processor API key into
  // a base64-encoded file, believing this counted as protection. The
  // lesson is CWE-261 (Weak Encoding for Password) / CWE-326
  // (Inadequate Encryption Strength) via the classic
  // "base64 ≠ encryption" misconception, mapped to PCI-DSS 3.5 and
  // OWASP A02 Cryptographic Failures. Introduces `base64` and
  // `base64 -d`.
  "level0@crypto": {
    password: null,
    track: "crypto",
    playerUser: "secops",
    objective: "Decide whether Theo's 'I base64-encoded the API key for safety' commit at Vesta Retail counts as PCI-DSS Requirement 3 protection — and document what the actual key looks like to anyone with read access on the box.",
    lesson: "Vesta Retail's annual PCI-DSS re-attestation is in six weeks. Their CTO, Saanvi, wants Driftwood to walk the payment-deploy code before the QSA does. Priya pulled deploy.sh from Vesta's repo on Friday and flagged the API key handling: their backend engineer Theo committed a change last sprint that 'cleaned up' the script by base64-encoding the production payment-processor API key into a separate file. Theo believes the key is now safer because it's not in plaintext. You're on Driftwood's crypto-analysis workstation (the shell calls you `secops`, the shared service account for code and binary reviews). Read welcome.md first — it explains base64. Then read engagement-notes.md, look at deploy.sh, and decode the key. Read lessons-learned.md once you've seen it.",
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Crypto Audit Workstation ──────────────

You're logged in as \`secops\` — the security team's shared service
account. The host \`crypto\` is our static-analysis station where
we review client scripts, configs, and binary artifacts.

Today's client: Vesta Retail. Their PCI-DSS re-attestation is six
weeks out. Priya pulled Theo's deploy.sh from Vesta's repo and
dropped it here for review. The script is small — and wrong, but
maybe not in the way Theo thought he was wrong-proofing it.


─── NEW COMMANDS ──────────────────────────────────────────────

  base64 <file>        Decode a base64-encoded file.
  base64 -d <string>   Decode a base64 string directly.


─── WHAT BASE64 IS (AND ISN'T) ────────────────────────────────

Base64 is an ENCODING, not encryption. It maps arbitrary bytes
onto a 65-character ASCII alphabet (A-Z, a-z, 0-9, +, /, plus
'=' padding) so binary data can ride safely through systems that
expect text: email, URLs, headers, JSON, env vars, config files.

It is explicitly NOT a way to make secrets unreadable. The
mapping is deterministic and public. There is no key. Anyone can
decode a base64 blob in one line.

Spotting base64 by eye: a long-ish string using only A-Z / a-z /
0-9 / + / / and ending in zero, one, or two '=' signs.

  SGVsbG8sIHdvcmxkIQ==    decodes to:   Hello, world!

You'd be surprised how many engineers think base64-encoding their
API key counts as "securing" it.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat engagement-notes.md     Vesta / Theo / Saanvi / PCI-DSS
  2.  cat deploy.sh               The script under review
  3.  base64 api-key.b64          Decode the "secured" API key
  4.  cat lessons-learned.md      Post-mortem (after step 3)
`
        },

        "engagement-notes.md": {
          type: "file",
          content:
`# Vesta Retail — engagement notes

Client: Vesta Retail
Vertical: E-commerce (online retail, ~$200M annual revenue,
          ~12 million transactions/year; accepts Visa / MC / AmEx /
          Discover; processes via Stripe + a small in-house
          gateway for high-volume B2B accounts)
Engagement: ~9 months, ongoing
Driftwood handler: Priya
Client counterparts: Theo (backend engineer, ~18 months at Vesta)
                     Saanvi (CTO)
Compliance regime: PCI-DSS v4.0. Vesta is a Level 2 merchant
                   (1M-6M transactions/year, scaled up from
                   Level 3 in 2024). Annual Self-Assessment
                   Questionnaire (SAQ D); QSA on-site review
                   every other year.

## The relationship

Vesta is mid-engagement. We're not running their security
operations, but we are the contracted advisors on their PCI-DSS
re-attestation track. Saanvi likes a clean pre-audit walkthrough
where we surface findings before the QSA notices them — that
way the formal audit goes quickly and the QSA's findings list
is short.

Theo is one of Vesta's backend engineers, ~18 months in,
competent at his level. He's been working on the payment-deploy
pipeline for the last quarter. He's bright. He's also new to
the "this code has to survive a PCI auditor" stage of his
career.

## What Priya flagged

She pulled deploy.sh from Vesta's repo on Friday and noticed the
API key handling. Saanvi has been told there's a finding; the
conversation with Theo happens tomorrow morning if we can confirm
the severity.

A direct quote from Theo's commit message:

  "Cleaned up the deploy script and moved the API key into
   api-key.b64 — it's base64 now so the value doesn't show up in
   git diffs. Should make code review easier."

Theo did not realize base64 is not encryption. He almost certainly
believes the key is now "safer" because it's not plaintext in the
script. The point of this audit, before the QSA gets here, is to
demonstrate that base64-encoding a production payment-card-
processor API key counts for exactly zero in PCI-DSS Requirement 3.

## Tone for the conversation tomorrow

Theo is not a bad engineer. He made a junior-grade mistake. Saanvi
knows; Theo will once we show him. Be specific about WHY this is
wrong (CWE-261, PCI-DSS 3.5.1), not just that it is. The
lessons-learned.md in this directory has the citations you'll
need to bring to the meeting.

## A side note unrelated to today's finding

The coffee machine on Driftwood's floor 4 still takes nickels.
The vendor is named "Vendolux." Daniel called them four months
ago. They were not interested.

— Priya
`
        },

        "deploy.sh": {
          type: "file",
          content:
`#!/usr/bin/env bash
# Vesta Retail — payment-deploy script
# Owned by: backend-platform team (Theo)
# Last updated: 2026-04-30 (Theo: base64-encoded the API key
# so it doesn't show in git diffs anymore)

set -euo pipefail

ENV="\${1:-staging}"
echo "Deploying payment-worker to \${ENV}..."

# Load the API key. It's base64-encoded in api-key.b64 so the
# raw value never appears in this script or in git history.
# Decoded just-in-time at deploy.
API_KEY=\$(base64 -d < /opt/vesta/payment/api-key.b64)
export VESTA_PAYMENT_API_KEY="\${API_KEY}"

# Hand off to the cluster.
kubectl -n payment set env deployment/payment-worker \\
  VESTA_PAYMENT_API_KEY="\${VESTA_PAYMENT_API_KEY}" \\
  VESTA_ENV="\${ENV}"

kubectl -n payment rollout restart deployment/payment-worker
kubectl -n payment rollout status  deployment/payment-worker

echo "Done."
`
        },

        "api-key.b64": {
          type: "file",
          content: "dmVzdGFfcGtfbGl2ZV9IeEs0blA5cVIydlQ4WXdCbUM1ZEUz",
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that Vesta Retail's production payment-card-
processor API key is "secured" by being base64-encoded in a
file alongside a deploy script that base64-decodes it on every
deploy. Anyone with read access on a build host — or on any
git mirror, CI cache, or filesystem snapshot that contains the
file — can recover the live key in a single command.

This is the canonical example of a class of mistake that shows
up in every credential-exposure report ever published: confusing
ENCODING (a reversible, public mapping) with ENCRYPTION
(a key-protected secrecy operation).

─── THE BLUNT VERSION ────────────────────────────────────────

Base64 is a transport format. It exists so that bytes can ride
safely through systems that expect printable ASCII. It is
specified, in detail, in RFC 4648. The encoding and decoding
tables are PUBLIC. There is no key. Anyone who sees a base64
blob can decode it.

When a credential is "protected" with base64, the protection
provided is exactly zero. The credential is fully recoverable
by anyone with read access to the encoded file. The encoding
is in fact a tell that a secret is nearby — credential scanners
specifically look for base64 patterns in source-controlled files.

The right way to handle a secret depends on the use case, but
the categories are:

  - At rest in source control:    don't. Use a secrets manager.
  - In transit between services:  TLS, plus an authenticated
                                  envelope (mTLS, signed JWT,
                                  HMAC-signed payload).
  - At rest on a deploy host:     a secrets manager + just-in-
                                  time fetch at process start,
                                  scoped to the runtime identity.
  - At rest in a backup:          encrypted with a real key
                                  managed by a KMS, with audit
                                  logging on key access.

Base64 is not on any of those lists. It is on the "transport
encoding" list, and the protection list is a different list.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For Vesta specifically, this finding is a PCI-DSS issue, not just
a security hygiene issue. PCI-DSS Requirement 3.5 says credentials
used to protect cardholder data must themselves be protected by
strong cryptography wherever they are stored. Requirement 3.6 says
key-management procedures must be documented and implemented. A
base64 blob in a repo satisfies neither, and a Qualified Security
Assessor will flag this in two minutes flat.

For Driftwood: this is exactly why Saanvi wants the pre-walk. The
remediation (move the key to AWS Secrets Manager / HashiCorp Vault
/ Doppler / etc., rotate it, update deploy.sh to fetch JIT) is two
days of engineering. Cheaper to do now, before the QSA's report,
than to add a finding to a remediation plan.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  PCI-DSS v4.0
    Requirement 3.5  — Render cardholder data (and the keys that
      protect it) unreadable wherever stored. Base64 does not
      render anything unreadable.
    Requirement 3.6  — Document and implement procedures to protect
      keys used to secure stored cardholder data against disclosure
      and misuse. Committing the key (even encoded) to a repo
      violates this directly.
    Requirement 8.3  — Strong authentication for all access to
      cardholder data environments. The key in question is the
      authentication artifact; its exposure is an authentication
      failure.

  NIST SP 800-53 Rev. 5
    SC-28 (Protection of Information at Rest) — base64 is not
      "protection." Encrypted-at-rest with a managed key is.
    IA-5  (Authenticator Management) — production credentials
      must be protected commensurate with the risk of disclosure.

  NIST SP 800-57 (Recommendation for Key Management)
    The canonical reference for how to actually handle the keys
    that protect data. Whole-document relevant.

  CWE
    CWE-261  Weak Encoding for Password — the precise pattern in
      this file.
    CWE-326  Inadequate Encryption Strength — base64 has zero
      strength because it is not encryption.
    CWE-256  Plaintext Storage of a Password — base64 is, for
      threat-model purposes, identical to plaintext storage.
    CWE-798  Use of Hard-coded Credentials — the underlying
      pattern Theo's "fix" was trying to address but didn't.

  OWASP Top 10 (2021) — A02: Cryptographic Failures
    Renamed from "Sensitive Data Exposure" in OWASP 2021
    specifically because so many failures in this category come
    from misuse of cryptography (or non-cryptography mistaken
    for cryptography), not absence of it.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — cryptographic concepts
    including the distinction between encoding, encryption, and
    hashing. Tested directly.

  CompTIA CySA+ (CS0-003)
    Domain 1 — credential exposure patterns.

  (ISC)² CC / SSCP
    Domain 5 (Cryptography) — encoding vs encryption is a
    foundational distinction.

  CISSP
    Domain 3 (Security Architecture and Engineering) —
    cryptography in depth, including the failure modes of
    misapplied schemes.

  OSCP / PEN-200
    base64-encoded credentials in source-controlled files are
    one of the highest-yield finds in real engagements. The
    opening play is \`grep -r 'base64' .\` against any repo
    you've pulled.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1552.001 — Unsecured Credentials: Credentials In Files
              (the underlying weakness)
  T1027     — Obfuscated Files or Information
              (the technique Theo *thought* he was using to
              defend against this; the attacker side of the
              same coin uses it too)
  T1027.013 — Encrypted/Encoded File
              (the specific sub-technique — base64 is the
              canonical example)

T1027 is one of the most frequently observed defense-evasion
techniques in published threat reports. The fact that defenders
and attackers both use base64 — defenders erroneously, attackers
deliberately — is the whole point.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Move the API key to a real secrets backend. Vesta is on
     AWS; AWS Secrets Manager + IAM-scoped runtime identity is
     the right shape. Other valid options: HashiCorp Vault,
     Doppler, 1Password Secrets Automation, Bitwarden Secrets
     Manager, Akeyless, Infisical.
  2. Rotate the exposed key. base64-encoded ≠ secret; the
     current key value should be considered burned. Stripe
     (and any other vendor whose API key Vesta uses) has a
     "rotate without downtime" workflow — issue a new key,
     deploy with the new key live, revoke the old one. Don't
     skip the rotation just because remediation feels like
     overkill.
  3. Update the deploy script to fetch from the secrets
     manager at deploy time (or, better, source the env from
     the secrets manager into the running pod via the cluster's
     CSI driver / external secrets operator).
  4. Run a credential scanner on the entire repo history, not
     just the current tip. The key existed at the moment of
     the offending commit; it remains in git history until
     someone rewrites the branch. gitleaks, trufflehog,
     gh-secret-scanning, and GitGuardian all do this. Pair
     them with pre-commit hooks so the next attempt is caught
     before it ships.
  5. Train Theo. The skill gap here ("what does encoded mean
     vs encrypted") is fixable in one focused conversation and
     a short reading list (RFC 4648 + NIST 800-57 chapter 1).
     Add a one-paragraph internal wiki entry titled "base64 is
     not encryption" and link it from the code-review checklist.
     This will save a future Theo from making the same mistake.

─── CLOSING THOUGHT ──────────────────────────────────────────

The mistake is mundane. "I obscured the value" feels like a
security improvement; "I obscured the value via a published,
deterministic transform with no key" is the actual content.
Every PCI-DSS audit and every credential-exposure post-mortem
includes some version of this finding somewhere. The fix is
not a clever cryptosystem. The fix is a secrets manager and
a colleague who can explain the distinction without making
the colleague who needed the distinction feel small.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
