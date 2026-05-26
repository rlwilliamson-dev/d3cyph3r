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
  // OWASP A04 Cryptographic Failures (2025 edition; was A02 in 2021).
  // Introduces `base64` and
  // `base64 -d`.
  "level0@crypto": {
    password: null,
    track: "crypto",
    title: "Vesta's base64'd API key",
    difficulty: "Easy",
    estimatedMinutes: 8,
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
Compliance regime: PCI-DSS v4.0.1. Vesta is a Level 2 merchant
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

  PCI-DSS v4.0.1
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

  OWASP Top 10 (2025) — A04: Cryptographic Failures
    Renamed from "Sensitive Data Exposure" in the 2021 edition
    (where it sat at A02 before moving down to A04 in 2025)
    specifically because so many failures in this category come
    from misuse of cryptography (or non-cryptography mistaken
    for cryptography), not absence of it.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — cryptographic concepts
    including the distinction between encoding, encryption, and
    hashing. Tested directly.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 1 — credential exposure
    patterns.

  ISC2 CC / SSCP
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

  // ── level 1 — "Theo's Signature That Wasn't" ─────────────────────
  // Day 2 at Vesta Retail. Theo's level0 base64 finding was filed
  // clean; in conversation he mentioned a second project — a "quick
  // token-based auth" for Vesta's internal admin API he shipped three
  // weeks ago. He sent Priya the verify middleware and a recent
  // admin-API access log. Player uses the still-live API key from
  // level0 to ssh into the payment-deploy host, reads Theo's
  // verify-middleware.js (jwt.verify called without the algorithms
  // whitelist), pulls a JWT out of the access log, runs `jwt <token>`,
  // sees alg:none + empty signature, realizes any caller can forge
  // admin tokens. The JWT payload also carries the level2 breadcrumb
  // (handoff_token claim) — JWT payloads are NOT confidential, which
  // is the secondary lesson. Maps to CWE-347 (Improper Verification
  // of Cryptographic Signature) plus CWE-532 (Insertion of Sensitive
  // Information into Log File) for the secrets-in-logs anti-pattern.
  // No engine changes — the jwt handler already detects alg:none and
  // empty signatures.
  "level1@crypto": {
    password: "vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3",
    track: "crypto",
    title: "Theo's alg:none JWT",
    difficulty: "Hard",
    estimatedMinutes: 18,
    playerUser: "vesta-deploy",
    objective: "Audit Theo's homegrown JWT auth on Vesta's internal admin API — decide whether the tokens in the access log are actually being verified, and document the blast radius if they aren't.",
    lesson: "Day two of Vesta's pre-QSA audit. Yesterday's base64-encoded-API-key finding closed clean; Theo took the news well and the rotation is on the calendar for Friday. During the conversation Theo mentioned a second project — a 'quick token-based auth' he shipped for Vesta's internal admin API three weeks ago. Saanvi authorized you to use the still-live API key from yesterday to ssh into the payment-deploy host where the admin-API logs are mirrored. You're now logged in as `vesta-deploy`. Read welcome.md first (it introduces the `jwt` command and what JWTs are); then priya-note.md for the day-two context; then look at verify-middleware.js and admin-access.log. When you've worked out what's wrong, read lessons-learned.md.",
    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Vesta Retail / payment-deploy.vesta.internal (vesta-deploy) ──

Day two. Yesterday's level0 finding (Theo's base64-encoded API
key) closed clean. Saanvi authorized the still-live API key for
a controlled blast-radius check; you used it to ssh into the
payment-deploy host you're sitting on now. Friday is when the
rotation lands, so the credential is live until then.

But the API key isn't today's lesson. During Priya's
conversation with Theo yesterday, he mentioned a second project
he'd been working on — a "quick token-based auth" for Vesta's
internal admin API. He shipped it three weeks ago. Saanvi asked
us to review it.

Theo sent over his verify middleware (verify-middleware.js) and
a sample from the admin-API access log (admin-access.log) for
the audit. Both are in this directory.


─── NEW COMMANDS ──────────────────────────────────────────────

  jwt <token>           Decode a JSON Web Token. Prints the
                        header + payload (both base64url-encoded
                        in the token) and surfaces common red
                        flags — algorithm confusion (alg=none),
                        empty signatures, expired tokens.


─── WHAT A JWT IS (AND ISN'T) ─────────────────────────────────

A JSON Web Token (RFC 7519) is three base64url-encoded segments
joined by dots:

    header . payload . signature

  - HEADER:    tiny JSON describing the token type ("typ":"JWT")
               and the signing algorithm ("alg": "HS256" /
               "RS256" / "none" / ...).
  - PAYLOAD:   the claims — who the token is for, when it
               expires, what permissions it grants. ALSO
               base64url — anyone with the token can decode it.
               JWT payloads are NOT confidential.
  - SIGNATURE: the cryptographic proof that the issuer signed
               the header+payload with a key the server can
               verify. The signature is what makes the token
               tamper-evident.

The trap modern web apps fall into: the SERVER must check the
signature using an algorithm the SERVER chooses, not whatever
algorithm the token's header claims. A token that says
\`alg: none\` is asking the server to skip verification. Some
JWT libraries (and many sloppy configurations) honor that
request. When they do, anyone who knows the trick can forge
any token they want with any claims they want.


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat priya-note.md           Day-two context.
  2.  cat verify-middleware.js    Theo's 15-line JWT verify code.
  3.  cat admin-access.log        Recent admin-API access log.
  4.  jwt <token-from-log>        Decode the JWT.
  5.  Read the engine's red-flag notes carefully — the algorithm,
       the signature, the claims.
  6.  cat lessons-learned.md      Post-mortem (after step 5).
`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Vesta Retail — engagement update (day two)

Yesterday's finding (the base64-encoded API key) closed clean.
Theo took the news well — he's the kind of engineer who
actually wants to know when he's done something wrong. Saanvi
got the report; the key rotation is scheduled for the Friday
change window.

But during the conversation Theo mentioned, almost in passing,
a second project: he'd built "a quick token-based auth" for
Vesta's internal admin API three weeks ago. Stack: he picked
the most-downloaded npm package for JWTs ("everyone uses it,
should be safe"), wrote a verification middleware, deployed it
to the cluster.

I asked him to send me the verify middleware and a sample of
the recent admin-API access log. Both are in this directory.

## What I want you to check

The same class of mistake as yesterday — confusing one
cryptographic primitive for another, or applying one with the
wrong parameters — shows up everywhere in junior engineers'
first crypto-adjacent code. Theo is bright but doesn't know
what he doesn't know about token-based auth.

  1. Read verify-middleware.js. It's short (~15 lines).
  2. Look at admin-access.log. There's a JWT in there.
  3. Run \`jwt <token>\` on it. Read the engine's red-flag
     notes carefully.
  4. If what you find is what I think you'll find, write it
     up with the same care as yesterday — Theo gets the
     meeting first, before the QSA.

## Rules of engagement

Same as yesterday's controlled-exception authorization. Do
not forge a new token. Do not call any of Vesta's admin
endpoints. This is reconnaissance + report. The token in the
log is already evidence; we don't need to create more.

## Compliance angle

If admin-API JWTs are unsigned-or-as-good-as-unsigned, that
is a PCI-DSS Requirement 6.2 (secure coding for authentication
functions) and Req 8.3 (strong authentication for cardholder-
data environments) finding. Same QSA review window as the
level0 finding. We file this in the same incident-report
appendix.

— Priya
  2026-04-09, 9:42am
`
        },

        "verify-middleware.js": {
          type: "file",
          content:
`// Vesta admin API — JWT auth middleware
// Owner: Theo (backend-platform team)
// Last updated: 2026-03-19
//
// Switched from session cookies to JWT to make the admin
// API stateless. Using the jsonwebtoken npm package — most-
// downloaded JWT library on npm, should be safe.

import jwt from "jsonwebtoken";
import { SIGNING_SECRET } from "./config.js";

export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });

  try {
    // Verify with our signing secret. The library reads the
    // alg from the token header so we can rotate signing
    // algorithms later without touching client code.
    const claims = jwt.verify(token, SIGNING_SECRET);
    if (claims.role !== "admin") {
      return res.status(403).json({ error: "not admin" });
    }
    req.adminClaims = claims;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid token" });
  }
}
`
        },

        "admin-access.log": {
          type: "file",
          content:
`[2026-04-09T07:14:23Z] admin-svc startup on :8443 (config: secrets v3.2)
[2026-04-09T07:14:23Z] verify-middleware loaded (jsonwebtoken @ default options)
[2026-04-09T07:42:01Z] req=req_4K2J9 GET /admin/health → 200 (no auth — public endpoint)
[2026-04-09T08:14:23Z] req=req_8H7K4 POST /admin/rotate-secret → 200
[2026-04-09T08:14:23Z] req=req_8H7K4 DEBUG Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJ2ZXN0YS1hZG1pbi1zdmMiLCJzdWIiOiJhZG1pbi1zdmMtZGVwbG95IiwiYXVkIjoidmVzdGEtYWRtaW4tYXBpIiwiaWF0IjoxNzc1NzIyNDQwLCJleHAiOjIwOTEzNDE2NDAsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiKiIsImFjdG9yIjoidGhlb0B2ZXN0YS5leGFtcGxlIiwiaGFuZG9mZl90b2tlbiI6InZlc3RhLWFkbWluLWhhbmRvZmYtMjAyNiJ9.
[2026-04-09T08:14:23Z] req=req_8H7K4 DEBUG jwt.verify returned: claims with role=admin
[2026-04-09T08:14:24Z] req=req_8H7K4 rotateSecret(target=payment-api-key) succeeded
[2026-04-09T08:17:42Z] req=req_M5R2X GET /admin/audit-bypass-tokens → 200 (same caller, same token replayed)
[2026-04-09T08:17:42Z] req=req_M5R2X audit-bypass-tokens query returned 1 active token
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just confirmed that Vesta Retail's internal admin API
accepts unsigned JWTs as if they were verified. Any caller —
authenticated or not, employee or attacker — can craft a
token, set role=admin in the payload, set alg:none in the
header, and Theo's middleware will accept it and execute
admin-only actions. The token in the log doesn't even need to
have been issued by Vesta. The "verification" step is, in
effect, "any base64url-encoded JSON is a valid admin token."

Two separate failures stack here:

  1. The verify middleware doesn't whitelist algorithms.
     \`jwt.verify(token, secret)\` without an
     \`{algorithms: [...]}\` options object allows the
     token's own header to dictate verification behavior.
     A token claiming alg:none asks for verification to be
     skipped. Older versions of jsonwebtoken honor that
     request directly; modern versions reject it by
     default, but the explicit whitelist is the defense-in-
     depth requirement either way.

  2. The admin-API access log records Authorization headers
     at DEBUG level. Even if the JWTs were properly verified,
     anyone with read access to the log can pull live tokens
     out of it and replay them. Secrets in logs is its own
     anti-pattern (CWE-532, covered below).

─── THE BLUNT VERSION ────────────────────────────────────────

JSON Web Tokens (RFC 7519) are a stateless authentication
mechanism. The token is a tiny JSON document signed by the
issuer; the verifier checks the signature with a key it
trusts. The point of the signature is to make the token
tamper-evident: change the payload, the signature no longer
matches, the verifier rejects.

The "alg" header field tells the verifier which algorithm
the issuer used to sign. The standard registers many
algorithms: HS256 (HMAC-SHA256), RS256 (RSA-SHA256), ES256
(ECDSA P-256), PS256 (RSA-PSS), and others. It also
registers \`none\`, meaning "no signature." \`none\` was
intended for cases where the token is already protected by
another layer (e.g., transmitted over an authenticated
channel) and the signature is redundant.

What \`none\` was NOT intended for: replacing the verification
step on a server that expected a signed token. But that's
exactly what happens when verification code reads the alg
from the token header and dispatches accordingly. A token's
header is unauthenticated input. Letting unauthenticated
input pick the algorithm is the original sin of JWT
verification.

This vulnerability class was first documented publicly in
2015 (Tim McLean's guest post on the Auth0 blog, "Critical
vulnerabilities in JSON Web Token libraries"). The
disclosure was tracked across multiple per-library CVEs —
notably CVE-2015-2951 for the php-jwt alg:none variant and
CVE-2015-9235 for the node-jsonwebtoken RS→HS confusion. It
has been remediated in most current JWT libraries — but
"remediated" usually means "the library rejects alg:none
by default if you don't pass an algorithms whitelist." The
moment an operator passes an empty whitelist, manually
allows \`none\`, or uses an older library version, the
attack is back.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

For Vesta specifically, this is a Tier-1 PCI-DSS finding.
The admin API in question is the same one that called
\`rotateSecret(target=payment-api-key)\` in the log entry
you just read — so the admin API has access to the
cardholder-data environment's secret-rotation machinery. An
attacker who forges an admin JWT can rotate production
credentials. The only authorization check is the broken JWT
verification.

For Driftwood: this finding is materially worse than
yesterday's. Yesterday was a credential exposure (one key,
one rotation needed). Today is an authentication bypass
(anyone can claim to be an admin without needing any prior
credential at all). The remediation also scales — rotate
the signing secret, audit every JWT-validating code path in
Vesta's stack for the same pattern, prove the admin-API
logs don't carry tokens, and add JWT-specific detection
rules to Vesta's SIEM.

Saanvi will want the conversation with Theo today, not
tomorrow.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-347: Improper Verification of Cryptographic Signature
    The primary weakness. The verifier accepted a token
    whose signature it did not actually verify.

  CWE-345: Insufficient Verification of Data Authenticity
    The parent weakness. The token's authenticity was not
    verified before its claims were trusted.

  CWE-287: Improper Authentication
    The umbrella authentication-bypass weakness. Anyone can
    impersonate an admin without authenticating.

  CWE-532: Insertion of Sensitive Information into Log File
    The secondary weakness — the admin-API log records full
    Authorization headers, including the JWT itself. Even
    if the JWTs were properly verified, this would still
    be a finding.

  PCI-DSS v4.0.1
    Requirement 6.2.4 — detect, prevent, and address common
      software attacks (the OWASP Top 10 + the secure-
      coding requirements). Algorithm-confusion attacks are
      named in the supporting guidance.
    Requirement 8.3 — strong cryptography for authentication
      credentials. An unsigned token is not strong cryptography.
    Requirement 10.3.1 / 10.3.2 — restrict read access to
      audit logs to those with a job-related need; protect
      audit log files from modification. (Maps to the
      secrets-in-logs half. Note: v3.2.1 used 10.5.x for
      this control family; v4.0.1 renumbered to 10.3.x.)

  NIST SP 800-53 Rev. 5
    IA-2 (Identification and Authentication) — the system
      must uniquely identify and authenticate users.
      Accepting alg:none defeats this.
    SC-8 (Transmission Confidentiality and Integrity) —
      the integrity of the token is not protected when the
      signature is not verified.
    AU-9 (Protection of Audit Information) — the secrets-
      in-logs half.

  OWASP Top 10 (2025)
    A07: Authentication Failures — the umbrella category.
    A02: Security Misconfiguration — applies to the missing
      algorithms whitelist as a misuse of the JWT library.

  OWASP API Security Top 10 (2023)
    API2: Broken Authentication — JWT-specific examples
      are called out, including alg:none confusion and weak
      signing secrets.

  RFC 8725 — JSON Web Token Best Current Practices
    Section 3.1 ("Perform Algorithm Verification"):
    "Libraries MUST enable the caller to specify a
    supported set of algorithms and MUST NOT use any other
    algorithms when performing cryptographic operations."
    Theo's caller doesn't specify; the library follows the
    token's claim instead.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — cryptographic
    primitives and their failure modes. JWT-specific
    examples appear in the secure-coding sub-domain.

  CompTIA CySA+ (CS0-003 / CS0-004)
    CS0-004 launched in early 2026 for parallel availability;
    CS0-003 retires June 2026. Domain 2 (Threat Intelligence)
    — algorithm-confusion attacks are in the catalog of
    techniques covered.

  CompTIA PenTest+ (PT0-003)
    Domain 3 (Vulnerability Discovery and Analysis) — JWT
    misconfigurations are a directly-named test target.

  ISC2 CISSP
    Domain 3 (Security Architecture and Engineering) —
    digital signatures and the verifier's responsibility
    to enforce algorithm constraints.

  Offensive Security OSWA / OSWE
    OffSec's web-focused certs spend significant curriculum
    time on JWT attacks (alg:none, key confusion RS→HS,
    weak HMAC secrets).

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1550.001 — Use Alternate Authentication Material:
              Application Access Token. JWT-specific
              sub-technique.
  T1078     — Valid Accounts (the role=admin claim acts
              as a valid account in the verifier's view).
  T1212     — Exploitation for Credential Access. The
              algorithm-confusion attack falls in this
              category when used to forge credentials.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Whitelist algorithms in every JWT.verify() call. In
     jsonwebtoken: \`jwt.verify(token, secret,
     { algorithms: ['HS256'] })\`. In jose: pass the
     verification key as a KeyLike with the algorithm
     bound. Audit the codebase with a regex like
     \`jwt\\.verify\\([^,]+,[^,]+\\)\` — every two-arg
     match that omits the options object is a finding.
  2. Reject alg:none unconditionally. Even if you intend
     to accept multiple signing algorithms, \`none\` should
     never be on the whitelist. Document this in the
     platform's authentication standard.
  3. Rotate the JWT signing secret. The secret may or may
     not have leaked, but the threat model now includes
     "any past admin token may have been forged." Treat
     the secret as compromised; issue a new one; short-
     TTL the new tokens (15 minutes, refresh from a real
     session backend).
  4. Stop logging Authorization headers. Restrict log
     verbosity at the proxy / middleware level, never at
     the application level. If debug logging is needed,
     redact the credential portions — gitleaks-style
     regexes against the log pipeline catch unredacted
     JWTs. Splunk, Sentinel, Elastic, Datadog all support
     log-scrubbing transforms.
  5. Add SIEM detections for JWT-specific anomalies:
       - Authorization headers carrying tokens with
         alg:none in the header segment
       - Tokens with empty signature segments
       - Tokens whose signatures fail verification but are
         still accepted by the application (correlation
         between auth-middleware logs and downstream
         actions)
     The Sigma project publishes community-maintained
     JWT-attack rules — clone https://github.com/SigmaHQ/sigma
     and grep for \`jwt\` and \`alg\` to find them.
  6. Upgrade the JWT library. Current jsonwebtoken (v9.x+)
     rejects alg:none by default even without explicit
     whitelisting, but the explicit whitelist remains the
     defense-in-depth requirement. If Vesta's package-lock
     pins to v8.x or earlier, that's a separate finding
     (CVE-2022-23539 and CVE-2022-23540 were both
     addressed in v9.0.0; CVE-2022-23529 was originally
     assigned alongside them but was REJECTED by Mitre).
  7. Authentication-platform retrofit. If admin auth is
     materially important — and it always is — JWT-as-DIY
     might not be the right primitive at all. Auth0, Okta,
     Cognito, Microsoft Entra, Stytch — pick a managed
     IdP that handles algorithm enforcement, key rotation,
     session revocation, and audit logging.

─── CLOSING THOUGHT ──────────────────────────────────────────

Cryptographic signatures only work when the verifier checks
them. The verifier's responsibility is to refuse to take its
verification orders from the data it's supposed to verify.
A token's "alg" header is data. Letting unauthenticated data
control verification logic is the recurring pattern under
most authentication bypasses you'll see this decade. JWT
alg:none is just the most common dialect of that pattern.

The fix isn't exotic. The fix is "tell the library what
algorithms you accept, and don't accept the ones that mean
'don't verify me.'"

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
