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
    title: "Theo's base64'd API key",
    estimatedMinutes: 8,
    // v1.22.0 cross-track narrative seed — Coverline's parallel
    // "I'll clean that up later" hardcoded-password pattern in
    // CLOSING THOUGHT.
    crossTrackHooks: ["cloud"],
    playerUser: "secops",
    objective: "Decide whether Theo's 'I base64-encoded the API key for safety' commit at Vesta Retail counts as PCI-DSS Requirement 3 protection — and document what the actual key looks like to anyone with read access on the box.",
    lesson: "Vesta Retail's annual PCI-DSS re-attestation is in six weeks. Their CTO, Saanvi, wants Driftwood to walk the payment-deploy code before the QSA does. Priya pulled deploy.sh from Vesta's repo on Friday and flagged the API key handling: their backend engineer Theo committed a change last sprint that 'cleaned up' the script by base64-encoding the production payment-processor API key into a separate file. Theo believes the key is now safer because it's not in plaintext. You're on Driftwood's crypto-analysis workstation (the shell calls you `secops`, the shared service account for code and binary reviews). Read welcome.md first — it explains base64. Then read engagement-notes.md, look at deploy.sh, and decode the key. Read lessons-learned.md once you've seen it.",

    hints: [
      "Theo base64-encoded the production API key into `api-key.b64` and believes that makes it safe. base64 is reversible *encoding*, not encryption — anyone with read access can reverse it. Run `ls` to find the file; `cat deploy.sh` shows the script reading it.",
      "Decode it: `base64 api-key.b64` (the engine decodes by default; `base64 -d` also works). The output is the real, plaintext payment-processor API key.",
      "The decoded `vesta_pk_live_...` key IS the finding — and it's the password to enter `level1@crypto`.",
    ],

    // v1.10.0 BONUS FINDS — surfaces Priya's "side note unrelated
    // to today's finding" aside in engagement-notes about the
    // Vendolux coffee machine. Orthogonal to the encoding lesson;
    // doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "daniel-coffee-vendor",
        name: "The Vendolux coffee machine",
        hint: "Priya's note ends with an unrelated aside: the floor-4 coffee machine still takes nickels four months after Daniel called the vendor. The 'I called them and they weren't interested' anti-pattern is the same shape as Theo's 'I base64'd it for safety' — a single person doing the right thing alone, on an issue nobody else owns, and nothing changes. Ownership beats individual effort.",
        trigger: { command: "cat", argMatches: /engagement-notes\.md/, outputContains: "Vendolux" },
      },
    ],
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

Driftwood's insurance client Coverline shipped a similar pattern
in their AWS migration: hardcoded passwords in deploy scripts,
labeled "I'll clean that up later," still live two years on.
Different verbiage, same root cause — security treated as a
post-hoc cleanup task rather than a property of how the code
was written.

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
    estimatedMinutes: 18,
    playerUser: "vesta-deploy",
    objective: "Audit Theo's homegrown JWT auth on Vesta's internal admin API — decide whether the tokens in the access log are actually being verified, and document the blast radius if they aren't.",
    lesson: "Day two of Vesta's pre-QSA audit. Yesterday's base64-encoded-API-key finding closed clean; Theo took the news well and the rotation is on the calendar for Friday. During the conversation Theo mentioned a second project — a 'quick token-based auth' he shipped for Vesta's internal admin API three weeks ago. Saanvi authorized you to use the still-live API key from yesterday to ssh into the payment-deploy host where the admin-API logs are mirrored. You're now logged in as `vesta-deploy`. Read welcome.md first (it introduces the `jwt` command and what JWTs are); then priya-note.md for the day-two context; then look at verify-middleware.js and admin-access.log. When you've worked out what's wrong, read lessons-learned.md.",

    hints: [
      "`cat admin-access.log` — the long `eyJ...` string on the DEBUG Authorization line IS the JWT. Copy it and run `jwt <that-string>` to decode it.",
      "Read the decoder's red-flag notes: `alg: none` plus an empty signature means the token was never cryptographically verified — anyone can forge one by hand.",
      "JWT payloads are base64url, NOT confidential. The decoded payload's `handoff_token` claim is the credential for `level2@crypto`.",
    ],

    // v1.10.0 BONUS FINDS — surfaces Theo's library-popularity-as-
    // safety reasoning quoted in priya-note. Orthogonal to the
    // alg:none finding; doesn't gate the credential chain.
    bonusFinds: [
      {
        id:   "most-downloaded-fallacy",
        name: "'Most-downloaded npm package, should be safe'",
        hint: "Priya's day-two note quotes Theo's library-choice rationale verbatim: he picked the most-downloaded JWT package because 'everyone uses it, should be safe.' Library popularity is a useful signal for maintenance and audit attention — it is not a signal that you've configured the library correctly. Theo's bug isn't in the library; it's in his two-argument call.",
        trigger: { command: "cat", argMatches: /priya-note\.md/, outputContains: "most-downloaded" },
      },
    ],
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

  // ── level 2 — "Theo's quick hash (john)" ────────────────────────
  // Day three of the Vesta pre-QSA audit. The handoff cred from
  // level1's JWT decode (vesta-admin-handoff-2026) drops the player
  // onto admin.vesta.internal as `vesta-admin`. Theo committed a
  // backup-passwords.txt to the deploy repo six months ago "to
  // make it safe" — 200 unsalted MD5 hashes covering admin login,
  // prod-DB account, an AES backup encryption key, an S3 service
  // account, monitoring, and ~190 other miscellaneous credentials.
  // john --wordlist=rockyou.txt cracks four of them in a second
  // and they're ALL the same plaintext (TheoVesta!1) — Theo reused
  // the same weak password across four security boundaries. The
  // aes-backup label's plaintext is the level3 entry credential.
  //
  // Lessons:
  //   - CWE-916 (Use of Password Hash With Insufficient
  //     Computational Effort) — MD5 against modern GPUs.
  //   - CWE-759 (Use of a One-Way Hash without a Salt) — even
  //     stronger algorithms fail without per-password salting;
  //     unsalted MD5 is the worst-case stack.
  //   - CWE-521 (Weak Password Requirements) — TheoVesta!1 passes
  //     a literal interpretation of "8+ chars with symbols" but
  //     fails any modern entropy guidance; rockyou-rule cracks it.
  //   - CWE-262 (Not Using Password Aging) — six months on disk.
  //   - NIST SP 800-63B-4 — Argon2id/scrypt/bcrypt/PBKDF2 as
  //     "Memorized Secret Verifier" requirements; MD5 doesn't
  //     qualify.
  //   - OWASP Top 10:2025 A02 Security Misconfiguration + A04
  //     Cryptographic Failures.
  //   - PCI-DSS v4.0 §8.3.2 (cryptographically-strong password
  //     hashing).
  //
  // Engine surface used:
  //   - `hash-id`           extended in v1.27.0 to handle multi-hash
  //                         files (auto-detects from first hash token,
  //                         skipping #-comment header lines).
  //   - `john`              extended in v1.27.0 to render multi-hash
  //                         crack arrays (johnCrack[file].cracks).
  //   - `cat` / `ls`        flat-fs read; rockyou.txt + README.rockyou
  //                         live under /usr/share/wordlists/.
  "level2@crypto": {
    password: "vesta-admin-handoff-2026",
    track: "crypto",
    title: "Theo's quick hash (john)",
    estimatedMinutes: 15,
    playerUser: "vesta-admin",
    // Cross-track narrative seed — Vesta's password-reuse pattern
    // echoes Halton Bank's policy (linux track); both produce the
    // same lateral-movement blast radius. Lessons-learned closes
    // with that parallel.
    crossTrackHooks: ["linux"],
    objective: "Audit Theo's `backup-passwords.txt` — 200 unsalted MD5 hashes Theo committed to the deploy repo six months ago. Identify what cracks, what it cracks to, and which production systems Theo has just made fungible.",
    lesson: "Day three of Vesta's pre-QSA audit. Yesterday's alg:none JWT finding escalated to Saanvi (CISO); she pulled a wider review across Theo's recent commits. Priya found one called \"backup-passwords.txt\" — Theo committed 200 MD5 hashes six months ago because \"hashes are safer than plaintext, right?\" Saanvi's note says you have 15 minutes before the QSA call to confirm what's actually in there and what cracks. You used `vesta-admin-handoff-2026` from yesterday's JWT decode and you're sitting on Vesta's admin host as `vesta-admin`. Read welcome.md (it explains hash-id + john); then priya-note.md for the day-three context; then walk the file. When you've worked out what cracks and what it gates, read lessons-learned.md.",
    hints: [
      "`hash-id backup-passwords.txt` confirms what algorithm Theo used.",
      "`john backup-passwords.txt` runs the dictionary attack against the default rockyou.txt wordlist. Read the FULL output — the same plaintext shows up multiple times.",
      "One of the cracked hashes is labeled `aes-backup` — that's the level3 credential.",
    ],

    // v1.10.0 BONUS FINDS — surface the same-string-different-system
    // anti-pattern (john output) and the rockyou provenance note that
    // grounds the wordlist's age (README.rockyou).
    bonusFinds: [
      {
        id:   "theo-password-reuse",
        name: "The same plaintext cracks four of Theo's hashes",
        hint: "john's session summary shows 4g cracked — four hashes, all the same plaintext (TheoVesta!1). Theo reused one weak password across the admin login, the prod-DB account, the AES backup encryption, and the S3 read-only credential. Same-string-different-system collapses four security boundaries into one credential rotation; CWE-521 + CWE-262 in textbook form. (Halton Bank's policy in the linux track has the same shape — different industry, same antipattern.)",
        trigger: { command: "john", argMatches: /backup-passwords\.txt/, outputContains: "4g" },
      },
      {
        id:   "rockyou-2009-provenance",
        name: "The rockyou.txt wordlist on disk is the 2009 RockYou.com leak",
        hint: "README.rockyou next to the wordlist captures the provenance: ~14.3M plaintext passwords leaked from the RockYou.com social-app account database in December 2009 via SQL injection. The bundle has shipped with Kali / Parrot / BlackArch for fifteen years; every modern wordlist-based crack chain still descends from it. \"We used a unique password\" only holds if you can prove your password isn't a near-neighbor of one of the 14 million.",
        trigger: { command: "cat", argMatches: /README\.rockyou/, outputContains: "RockYou.com" },
      },
    ],

    // ENV — HOSTNAME flips the prompt to the Vesta admin fqdn so
    // hostname + prompt agree. EDITOR=vim because Theo's habit.
    env_vars: {
      EDITOR:   "vim",
      HOSTNAME: "admin.vesta.internal",
    },

    // ── john multi-crack data ──
    // Theo's 200-hash file. john --wordlist=rockyou.txt cracks four
    // of them in a second — all the same plaintext (TheoVesta!1)
    // because Theo reused the password. The aes-backup label is the
    // level3 breadcrumb; the other three (theo@admin, theo@db-prod,
    // s3-readonly) are the password-reuse blast-radius proof.
    johnCrack: {
      "backup-passwords.txt": {
        type: "Raw-MD5",
        wordlist: "rockyou.txt",
        time: "00:00:00",
        loaded: 200,
        cracks: [
          { plain: "TheoVesta!1", label: "theo@admin" },
          { plain: "TheoVesta!1", label: "theo@db-prod" },
          { plain: "TheoVesta!1", label: "aes-backup" },
          { plain: "TheoVesta!1", label: "s3-readonly" },
        ],
      },
    },

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Vesta Retail / admin.vesta.internal (vesta-admin) ─────────

Day three. Yesterday's level1 alg:none JWT finding escalated to
Saanvi (CISO); she pulled a wider review across Theo's recent
commits. You used the \`vesta-admin-handoff-2026\` token from
yesterday's JWT decode to ssh into the Vesta admin host. You're
now \`vesta-admin\` — the role Theo handed you with the token.

Priya found one of Theo's commits flagged in the review:
\`backup-passwords.txt\` — 200 MD5 hashes committed to the
deploy repo six months ago. Theo's commit message: "made the
prod creds safer — md5'd them so they're not plaintext anymore."

Saanvi has 15 minutes before the QSA call. She wants confirmed
findings.


─── NEW COMMANDS ──────────────────────────────────────────────

  hash-id <file>        Identify the likely hash algorithm by
                        inspecting the first hash in the file
                        (skips #-prefixed comment headers).
                        Surfaces a "Crack with: john" hint when
                        the format is known-weak.

  john <hashfile>       Simulated dictionary attack (John the
                        Ripper). Loads the hash(es) from the file,
                        runs against /usr/share/wordlists/rockyou.txt,
                        and prints the cracked plaintext with its
                        label. Multi-hash files show every crack
                        in a single session summary.


─── WHY HASHES AREN'T A SAFETY NET ────────────────────────────

A hash function maps an arbitrary-length input to a fixed-length
output that's "one-way" (you can't invert it cryptographically).

The catch: if the attacker can GUESS the input, they can hash
each guess and compare. If your input is in a wordlist somebody
already has, the attacker doesn't need to invert anything —
they just hash the whole wordlist and look up your hash.

MD5 is fast. A modern GPU does ~50 billion MD5/s. The rockyou
wordlist is 14 million entries. End-to-end crack time against
an unsalted MD5: under a second. Hashes alone do NOT make a
password file safe. The mitigations are:

  - Per-password SALT (so identical plaintexts hash to different
    outputs and rainbow tables don't apply).
  - Memory-hard / cost-tunable functions (Argon2id, scrypt,
    bcrypt, PBKDF2) so each guess is expensive.
  - Don't roll your own. Use the password-hashing modes your
    framework ships (Django auth, Rails has_secure_password, etc.).


─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat priya-note.md            Day-three context.
  2.  cat backup-passwords.txt     What Theo committed.
  3.  hash-id backup-passwords.txt Confirm the algorithm.
  4.  john backup-passwords.txt    Crack. Read every cracked
                                   line in the output, not just
                                   the first.
  5.  ls /usr/share/wordlists/     Optional — see what john
                                   used as the dictionary.
  6.  cat lessons-learned.md       Post-mortem.
`
        },

        "priya-note.md": {
          type: "file",
          content:
`# Vesta Retail — engagement update (day three)

Yesterday's alg:none JWT finding closed clean on the technical
side — Theo took the news fine and his patched verify middleware
is in review. But Saanvi (CISO) escalated. She told me \"I want
to know what else Theo shipped recently that I should be
looking at.\" She pulled the QSA forward to today's noon call.

I spent an hour walking Theo's recent commits with her this
morning. Most of them are fine. ONE is not. From the deploy
repo, six months ago:

    commit a9c1f0e Theo Hassan
    Date:   2024-06-15 14:22
    Subject: backup-passwords: safer than plaintext

    Md5'd all the production passwords so they're not
    plaintext in the repo anymore. Hashes are safer right?
    Don't share lol.

The file is in vesta-admin's home directory as
\`backup-passwords.txt\` — 200 lines. Each line is a label
column + an MD5 hash column. The labels are the production
systems Theo had access to when he wrote the file.

## Rules of engagement

1. You're on the admin host. Don't ssh anywhere else. Don't
   try to authenticate to the production DB with anything you
   crack — Saanvi explicitly said "I want the finding, not the
   demonstration."

2. Run \`hash-id backup-passwords.txt\` to confirm what we're
   dealing with. Then \`john backup-passwords.txt\` to see what
   cracks against the default rockyou wordlist.

3. Read the FULL john output. The QSA call is at noon and
   Saanvi needs the exact number of cracked hashes and the
   exact plaintexts. Multiple labels with the same plaintext
   is the finding she's going to lead with.

4. The aes-backup label specifically — Theo encrypted last
   quarter's payment-card token backup with that password.
   Saanvi wants confirmation that the password is in the
   crackable set. If it is, the encrypted backup is
   functionally plaintext from a PCI standpoint.

## What I expect you to find

The hashes are MD5. john cracks four of them in seconds. All
four are the same plaintext. One of the four labels is
aes-backup. That's the finding for the QSA call.

Saanvi's note: "If those four hashes are the same plaintext,
we have a Phase-1-remediation conversation to have with
Theo's manager about whether Theo's commit access stays
hot."

— Priya
  2026-04-12, 10:47am
`
        },

        "backup-passwords.txt": {
          type: "file",
          content:
`# backup-passwords.txt
# Theo's safer prod creds file (md5'd) — 2024-06-15 commit
# (don't share lol)
# format: <md5-hex>  <label>

e10adc3949ba59abbe56e057f20f883e  theo@admin
21232f297a57a5a743894a0e4a801fc3  theo@db-prod
482c811da5d5b4bc6d497ffa98491e38  aes-backup
da25e54ef34fb0d8a35a78fcbb8db95f  s3-readonly
ee11cbb19052e40b07aac0ca060c23ee  monitoring-svc
3899dcbab79f92af727c2cf4f2450b07  grafana-readonly
5f4dcc3b5aa765d61d8327deb882cf99  legacy-sftp-1
6cb75f652a9b52798eb6cf2201057c73  legacy-sftp-2
202cb962ac59075b964b07152d234b70  fraud-portal-svc
827ccb0eea8a706c4c34a16891f84e7b  jenkins-deploy
e99a18c428cb38d5f260853678922e03  redis-cache-prod
8b1a9953c4611296a827abf8c47804d7  vesta-mgmt-vpn
25d55ad283aa400af464c76d713c07ad  bigquery-reader
25f9e794323b453885f5181f1b624d0b  airflow-svc
72b302bf297a228a75730123efef7c41  prom-blackbox
68053af2923e00204c3ca7c6a3150cf7  sumologic-shipper
b59c67bf196a4758191e42f76670ceba  audit-syslog
fcea920f7412b5da7be0cf42b8c93759  stripe-webhook-svc
9e107d9d372bb6826bd81d3542a419d6  shopify-app-svc
e4d909c290d0fb1ca068ffaddf22cbd0  segment-write
fa246d0262c3925617b0c72bb20eeb1d  twilio-shortcode
57b53d65e4ba0e7c00c4b2db5c8ad9f1  ses-noreply
bfd2c2fbd06e0e8a7e9d18ecdc5c0aaf  rds-replica-monitor
33a5fee98d62692abf3b07a2cc18cba0  athena-readonly
72f5d4a5e26c4dd4b46c8ef7d3ec9c08  okta-scim
1b4a3705c20aacbc8e87a30ed9a83120  pagerduty-incident
de8a847bff8c343d69b853a215e6ee65  hashicorp-vault-init
0c0f5b9c4af55b6c9e3b1c7f0b6a8f24  rabbitmq-shovel
4d0e9e6c5c5e91823d3d6dbb6e0a8f31  kafka-mirror
21fb2e5b3a5e4f3d99a82a9c0e2b1b3c  consul-bootstrap
6e8df4f1c4b5e07a1e25a6c80f8c0b78  cloudtrail-archive
7b3e9d40f10b9023c92c1cc7e8a14e5a  glue-crawler
0a8c1bcd2c4d4e34a5b6c7d8e9f01234  dynamodb-stream-fanout
3f5e4d2b1a0c9d8e7f6b5a4c3d2e1f00  prom-pushgateway
e9d71f5ee7c92d6dc9e92ffdad17b8bd  finrest-payments-readonly
ab56b4d92b40713acc5af89985d4b786  fivetran-connector
14e1b600b1fd579f47433b88e8d85291  github-deploy-key
5b2dc1ab9b1f5f3ad8b09a9b09e26a7b  bitbucket-pipelines
# ... (162 lines elided in display; total file = 200 lines)
`
        },

        ".bash_history": {
          type: "file",
          content:
`ls
cat priya-note.md
cat backup-passwords.txt | head -10
hash-id backup-passwords.txt
john backup-passwords.txt
ls /usr/share/wordlists/
cat /usr/share/wordlists/README.rockyou
cat lessons-learned.md
exit
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You just cracked four production credentials in under a second
using a wordlist that's been in the public domain since 2009.
All four are the same plaintext. One of them is the password
Theo used to encrypt last quarter's payment-card token backup.
PCI Council's working definition of "encrypted" requires a
cryptographically-strong cipher AND a cryptographically-strong
key. The cipher Theo used (AES-128) is fine. The key Theo used
(\`TheoVesta!1\`) is in rockyou. So the backup is, by the
control's own definition, plaintext.

─── THE BLUNT VERSION ────────────────────────────────────────

Three independent failures stack on top of each other to produce
this finding. Each one alone would be a finding; together they
are an instant-Phase-2-remediation conversation.

  1. Theo used MD5. Modern GPUs hash MD5 at ~50 billion/s.
     Against the 14M-entry rockyou wordlist that's roughly
     300 microseconds of compute time. The "hash" provides
     zero work-factor protection.

  2. Theo didn't salt. With no per-password salt, identical
     plaintexts hash to identical outputs. That's how a single
     john run cracked four hashes simultaneously — and it's
     how rainbow tables (precomputed hash→plaintext mappings
     for common passwords) have been operating since the 1990s.

  3. Theo reused. The same plaintext (\`TheoVesta!1\`)
     gates the admin login, the prod-DB password, the AES
     backup encryption key, and the S3 read-only service account.
     Rotating one rotates the user's authentication; rotating
     all four requires coordinated downtime on four systems.
     The math: four credentials, one rotation event.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Saanvi's note read "If those four hashes are the same plaintext,
we have a Phase-1-remediation conversation to have with Theo's
manager about whether Theo's commit access stays hot." That
conversation is now scheduled. The PCI QSA call is at noon.

For Driftwood, the finding writes itself: Vesta's commit
review didn't catch a file labeled "backup-passwords.txt"
containing 200 MD5 hashes of production credentials, despite
the file being in the deploy repo for six months. Whatever
the commit review WAS catching, this wasn't part of it.

The credential-rotation conversation is harder. Four credentials
gating four systems means a single coordinated rotation event.
The token backup the aes-backup password encrypts has to be
re-encrypted with a new (strong, unique) key, then the original
backup destroyed. The S3 service account requires application-
side coordination. The prod-DB password requires application
connection-string rotation across every consumer.

Halton Bank's track had a structurally identical finding from
a different angle: Halton's password policy mandated the same
string format across the DB and the bastion login, so one
leaked file traversed multiple systems. Same blast radius math,
different industry, different mechanism. The remediation is
the same: cryptographically-random per-credential strings,
managed via a secrets manager (HashiCorp Vault, AWS Secrets
Manager, GCP Secret Manager, Azure Key Vault, 1Password
Business, Doppler, Bitwarden Secrets Manager — pick one).

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-916: Use of Password Hash With Insufficient
  Computational Effort
    The surgical CWE for "MD5 / SHA-1 / SHA-256 against
    GPU-accelerated dictionary attacks." Modern guidance is
    Argon2id (winner of the Password Hashing Competition,
    2015); failing that, scrypt or bcrypt; PBKDF2 for FIPS-
    constrained shops. The work-factor parameter (Argon2's
    iterations / memory, bcrypt's cost) is the actual
    security boundary.

  CWE-759: Use of a One-Way Hash without a Salt
    The reason john cracked four hashes simultaneously. Per-
    password salt (a random 16-byte string concatenated with
    the password before hashing) makes identical plaintexts
    hash to distinct outputs. Rainbow tables stop working;
    bulk-cracking parallelism stops working. Argon2id /
    bcrypt / scrypt / PBKDF2 all include salt as a non-
    optional parameter.

  CWE-521: Weak Password Requirements
    \`TheoVesta!1\` passes a literal "8+ chars, contains a
    symbol" policy. It fails any entropy-aware policy
    (NIST SP 800-63B-4's blocklist-against-known-bad-passwords
    approach, OWASP ASVS Authentication V2.1, CIS Critical
    Security Control 5.2). The fix is not a longer minimum
    length — it's checking candidate passwords against the
    rockyou-class blocklist before accepting them.

  CWE-262: Not Using Password Aging
    The hash file was committed six months ago. The
    underlying plaintexts have been valid for six months on
    four systems. Aging policy debate aside, the deployment
    pattern that wrote credentials to a repo at all is the
    real failure here.

  CWE-798: Use of Hard-coded Credentials (committed-to-repo
  variant)
    The hashed-versus-plaintext distinction does not matter
    for this control. The credentials were committed to source
    control; the audit trail extends back to whoever's had
    commit access for six months. Modern secrets-in-code
    scanners (gitleaks, trufflehog, GitHub Secret Scanning,
    Snyk) all flag hash files; Vesta's commit-review process
    didn't.

  NIST SP 800-63B-4 — Digital Identity Guidelines:
  Authentication and Lifecycle Management
    Final document published August 2025 (the long-awaited
    refresh of 800-63B-2). §5.1.1 covers Memorized Secret
    Verifiers; password storage is in §5.1.1.2. The mandated
    approach: an approved one-way memory-hard function with a
    randomly-generated salt at least 32 bits long, and an
    additional secret keyed-hash (HMAC) component stored
    outside the database. MD5 is explicitly not approved.

  PCI-DSS v4.0.1
    §3.5.1 Strong Cryptography — covers any storage of
    Account Data (PAN, expiration, cardholder name,
    sensitive authentication data). The backup Theo
    encrypted with the cracked password contains PAN tokens;
    a key recoverable in <1 second from a 15-year-old
    wordlist does not meet "strong cryptography."
    §8.3.2 Strong Cryptography for Password / Passphrase
    Hashing — requires a one-way cryptographic function
    that includes a salt. MD5 unsalted fails both clauses.

  OWASP Top 10 (2025) — A02 Security Misconfiguration
    + A04 Cryptographic Failures (the modern name for
    "Sensitive Data Exposure"). Both apply.

  OWASP Application Security Verification Standard (ASVS) v4.0.3
    V2.4 (Credential Storage) — verifies that any password
    hash uses Argon2 / bcrypt / scrypt / PBKDF2 with appropriate
    parameters, and includes salt.

  CIS Critical Security Controls v8.1
    5.2 — Use Unique Passwords. The four hashes being the
    same plaintext is a direct violation.
    16.4 — Establish and Maintain an Inventory of Application
    Authorization Methods. Theo's repo-committed credentials
    bypass any inventory.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1 (General Security Concepts) — symmetric / hash
    primitives. Domain 4 (Security Operations) — credential
    management. Wordlist-based dictionary attacks are named
    tooling.

  CompTIA CySA+ (CS0-003 / CS0-004)
    Domain 1 (Security Operations) — incident response on
    credential exposure. Domain 4 (Reporting & Communication)
    — the "what would you tell the auditor" question
    rockyou.txt makes inevitable.

  CompTIA PenTest+ (PT0-003)
    Domain 3 (Attacks and Exploits) — Hashcat / John / Hydra
    naming, rockyou.txt as a named wordlist, salt vs
    unsalt-aware crack approaches.

  CISSP
    Domain 3 (Security Architecture and Engineering) — modern
    password hashing. Domain 4 (Communication & Network
    Security) — credential transit. Domain 5 (Identity and
    Access Management) — credential lifecycle.

  OSCP / PEN-200
    \`john\` and \`hashcat\` are the assumed tooling. The lab
    exercises wordlist-based MD5 / SHA-1 / NTLM cracking
    against extracted hashes; this level is the textbook
    minimum-viable post-extraction exercise.

  Offensive Security CompTIA-equivalent — OSWP / OSWE /
    OSEP — all assume rockyou-derived dictionary work.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

What you simulated maps to:

  T1110.002 — Brute Force: Password Cracking. The named
              technique for offline dictionary attacks against
              extracted hashes. Sub-technique covers John,
              Hashcat, Aircrack-ng, and the wordlist-based
              attack pattern.

  T1552.001 — Credentials In Files. Theo's commit to the
              deploy repo IS this technique. The hash-not-
              plaintext distinction does not move the mapping.

  T1078     — Valid Accounts. The cracked password gates
              valid logins on four systems; a follower of the
              kill chain moves to this technique with each.

  T1003.008 — OS Credential Dumping: /etc/passwd and
              /etc/shadow. Adjacent — same primitive (offline
              dictionary attack against extracted hashes), more
              common Linux-attacker version.

  T1187     — Forced Authentication. Indirectly: if the
              cracked credential is reused on a system that
              accepts NetNTLMv2 challenge-response, the
              dictionary attack extends past the original
              extraction.

T1552.001 is the most-frequently-cited credential-related
technique in published threat reports — it's the entry-point
finding in roughly 1 of every 4 cloud breach narratives.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Rotate ALL FOUR. The cracked credentials are fungible;
     attackers harvesting Vesta's repo got all four with one
     wordlist run. Coordinated rotation is non-negotiable
     even if you think only one is "really" exposed.

  2. Move to Argon2id (or scrypt / bcrypt / PBKDF2 if
     framework constrained). The work-factor parameters
     (Argon2id: iterations=2-3, memory=64MB, parallelism=1
     as a 2025-era starting point; tune to ~250ms verify
     time on your hardware) are the actual security boundary.
     The function name without the parameter tuning is
     theater.

  3. Per-credential salt at the application layer; OR
     adopt a secrets manager that handles this for you.
     Modern frameworks (Django auth, Rails has_secure_password,
     Laravel's Hash::make, Node's bcrypt + bcrypt-nodejs)
     all use Argon2id or bcrypt with per-credential salt
     by default — opting OUT of that takes more code than
     opting IN.

  4. Block rockyou-class passwords at registration. NIST
     800-63B-4 §5.1.1 calls for a blocklist of "values known
     to be commonly-used, expected, or compromised." The
     HIBP (Have I Been Pwned) "Pwned Passwords" API exposes
     this exact dataset; integration is a handful of lines.

  5. Scan repos for committed credentials. gitleaks,
     trufflehog, GitHub Secret Scanning, GitLab Secret
     Detection, AWS Secrets Manager auto-rotation, Doppler
     CLI's pre-commit hooks — pick the toolchain that matches
     your platform. \`backup-passwords.txt\` would have been
     flagged before Theo's push by any of these.

  6. Move secrets out of repos entirely. The pattern
     \"committed because we needed to share them across
     environments\" is solved by HashiCorp Vault / AWS Secrets
     Manager / GCP Secret Manager / Azure Key Vault, with
     per-environment access controls and short-lived
     credentials. The cost of adoption is ~one day of
     ops work; the cost of NOT adopting is what you just
     documented.

  7. Educate. The \`hash-id\` → \`john\` → \`cat README.rockyou\`
     sequence in this level is identical to what every
     intro-tier red-team / blue-team training program teaches.
     Engineers shipping production credentials should be aware
     of how cheap the offline attack is.

─── CLOSING THOUGHT ──────────────────────────────────────────

The intuition that "hashes are safer than plaintext" is
correct only when the hash function meets modern computational
hardness requirements AND the input domain isn't trivially
enumerable. Both conditions fail simultaneously for unsalted
MD5 + an in-wordlist plaintext. The hash didn't make the file
safer; it made the file look safer to whoever reviewed Theo's
commit.

What kept Theo's hashes \"safe\" for six months wasn't the MD5
— it was that nobody who had read access to the repo had run
\`john\` against the file. Vesta is one OF a long list of
companies whose unsalted-hash files lived in their codebase
quietly until somebody decided to check.

Halton Bank's track surfaced a structurally identical pattern
from the opposite direction: Halton's password POLICY mandated
the same string format across systems, so one leaked file
traversed multiple systems by design. Different industry, same
blast-radius math. The fix is the same too: cryptographically-
random per-credential strings, managed via a secrets manager.

Return to the lobby:    ssh guest@d3cyph3r
`
        },

        // /usr/share/wordlists — rockyou.txt + README.rockyou.
        // The wordlist itself is a small sample (the actual rockyou
        // is 14M lines, 130MB). README.rockyou captures the 2009
        // provenance that triggers the bonus find.
        "usr": {
          type: "dir",
          children: {
            "share": {
              type: "dir",
              children: {
                "wordlists": {
                  type: "dir",
                  children: {

                    "rockyou.txt": {
                      type: "file",
                      content:
`123456
12345
123456789
password
iloveyou
princess
1234567
rockyou
12345678
abc123
nicole
daniel
babygirl
monkey
lovely
jessica
654321
michael
ashley
qwerty
111111
iloveu
000000
michelle
tigger
sunshine
chocolate
password1
soccer
anthony
friends
butterfly
purple
angel
jordan
liverpool
justin
loveme
123123
football
secret
andrea
carlos
jennifer
joshua
bubbles
1234567890
superman
hannah
amanda
... (truncated — full file has 14,341,564 entries)
`
                    },

                    "README.rockyou": {
                      type: "file",
                      content:
`README.rockyou — distribution notes

The rockyou.txt wordlist shipped with this distribution is
derived from the December 2009 RockYou.com SQL-injection breach,
which exposed approximately 14,341,564 plaintext passwords from
the RockYou social-game accounts database.

The leak became the canonical wordlist for offline dictionary
attacks against unsalted password hashes because:

  - It's large enough to cover the actual password distribution
    of real users (not the artificial top-1000 lists).
  - It's plaintext, so it can be combined with mangling rules
    (john's --rules / hashcat's --rules) to generate billions
    of derivative guesses (e.g., "summer" → "Summer2024!",
    "password" → "P@ssw0rd1").
  - It's free.

The RockYou.com breach happened because RockYou stored its
users' plaintext passwords in a database without hashing or
encryption — a class of failure that, in 2025, would be a
material weakness disclosed in a 10-K. The breach's
secondary effect is that those 14 million passwords are now
in every wordlist any attacker uses against any password file
they extract, anywhere in the world, for the rest of forever.

The fact that you can crack a hash by running \`john
hashfile.txt\` with no additional setup is because of this
leak. Modern password storage (Argon2id / scrypt / bcrypt
with per-credential salt) is designed to make rockyou-class
wordlists ineffective; password files using older or
incomplete schemes (unsalted MD5, unsalted SHA-1, NTLM, SHA-
256 without salt) remain trivially crackable against this
dictionary.

References:
  - RockYou breach disclosure: Imperva / TechCrunch, December 2009
  - Wordlist distribution: ships with Kali Linux, Parrot OS,
    BlackArch, and most penetration-testing distributions
  - For the historical record: the underlying RockYou
    settlement included a $250,000 FTC payment for COPPA
    violations affecting the under-13 subset of accounts.
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

  // ── level3@crypto — "Theo's encrypted backup" ────────────────────
  // Gate: TheoVesta!1 — the plaintext john cracked out of Theo's
  // committed MD5 file in level2. Level2's bonus find established
  // that Theo reused that ONE string across four systems: the admin
  // login, the prod-DB account, the AES backup encryption, and an S3
  // credential. This level cashes in two of those four: it's the
  // login on the backup host AND the passphrase on the backup itself.
  // The player types the same weak password twice, ten minutes apart,
  // which is the reuse lesson landing harder than any paragraph.
  //
  // THE CAPSTONE OF THE CRYPTO ARC. Each level killed one comfortable
  // assumption:
  //   level0  encoding  is not encryption  (base64)
  //   level1  signing   is not encryption  (alg:none JWT)
  //   level2  hashing   is not encryption  (unsalted MD5 + john)
  //   level3  encryption is only as strong as its KEY  (AES-256 with
  //           a rockyou-crackable passphrase)
  // AES-256-CBC is not broken and never gets broken here. The cipher
  // is the one part of Theo's design that works. That's the point:
  // "we encrypt our backups" is a statement about a cipher, and the
  // question that matters is where the key came from.
  //
  // Solve path:
  //   1. `ls` — a .enc file, Theo's backup notes, and the script that
  //      makes it.
  //   2. `cat` the .enc → binary noise starting with `Salted__`
  //      (openssl's real magic header). Ciphertext is not readable.
  //   3. `cat backup-notes.md` → names the cipher (aes-256-cbc) and
  //      admits the passphrase is "the usual one."
  //   4. `openssl enc -d -aes-256-cbc -pbkdf2 -k 'TheoVesta!1' -in
  //      vesta-prod-backup-2026-01-15.enc` → the plaintext dump.
  //   5. The dump is a PCI-DSS crime scene (full PANs AND cvv2), and
  //      its embedded restore config carries the level4 credential.
  //
  // Engine: FIRST level to use the passphrase-gated form of
  // `level.opensslEnc` (v2.2.0 — see the schema note at the top of
  // js/commands/structured.js). Without the gate the player could
  // read the plaintext without ever recovering the key, which would
  // defeat the entire lesson.
  //
  // PAN SAFETY NOTE FOR FORKERS: every card number below is a
  // published, non-functional TEST number from the payment-processor
  // documentation sets (4111111111111111, 5555555555554444,
  // 378282246310005, 6011111111111117, 4012888888881881). They are
  // recognizable on sight to anyone who works in payments and cannot
  // authorize a transaction. Never put real or real-shaped PANs in a
  // training level.
  //
  // Lessons: CWE-326 (Inadequate Encryption Strength — via the key,
  // not the cipher) + CWE-522 (Insufficiently Protected Credentials —
  // the passphrase hardcoded in the script beside the ciphertext) +
  // CWE-311/312 on the retained cardholder data. PCI-DSS 4.0: 3.3.1
  // (never retain sensitive authentication data after authorization —
  // CVV storage is prohibited outright, encrypted or not), 3.5.1
  // (render PAN unreadable), 8.3.6 / 8.6.3 (password strength).
  //
  // Two bonus finds (don't gate the chain):
  //   - "The CVV should not be there at all" — the regulatory beat:
  //     encryption does not make prohibited retention permissible.
  //   - "The passphrase is in the script beside the ciphertext" — the
  //     key-management beat: the lock and its key in one directory.
  //
  // Breadcrumb out: vesta-hsm-mk7-unwrap-2026Q1 — an HSM key-unwrap
  // credential in the dump's embedded restore config, gating a future
  // level4@crypto (envelope encryption / key hierarchy).
  "level3@crypto": {
    password: "TheoVesta!1",
    track: "crypto",
    title: "Theo's encrypted backup (openssl enc)",
    estimatedMinutes: 14,
    playerUser: "vesta-admin",
    // Cross-track seed: the "one weak string, many systems" shape is
    // the same failure Halton Bank institutionalized in the linux
    // track. Different industry, identical blast radius.
    crossTrackHooks: ["linux"],
    objective: "Decrypt the production backup Theo has been calling 'encrypted at rest' — using the password you cracked yesterday — and document what Vesta has been retaining inside it.",
    lesson: "Day four of Vesta's pre-QSA audit. Saanvi read your hash report and asked the obvious follow-up: if Theo reused that one password four times, what did it unlock? One of the four was labeled `aes-backup`. It's the passphrase on the nightly production backup — and the same string is the login on the backup host, which is how you're reading this. Welcome.md covers `openssl enc -d`. Decrypt the backup, then read what's actually inside it. The QSA call is in an hour and Saanvi needs to know whether this is a finding or a breach notification.",
    hints: [
      "The `.enc` file is Theo's backup. `cat` it and you'll get noise — ciphertext isn't readable. You need `openssl enc -d`, and you already know the passphrase: it's the one you typed to get onto this host.",
      "Real openssl prompts for the passphrase; this sandbox can't prompt, so pass it inline with `-k '<passphrase>'`. `cat backup-notes.md` — Theo wrote down which cipher he used.",
      "Run: openssl enc -d -aes-256-cbc -pbkdf2 -k 'TheoVesta!1' -in vesta-prod-backup-2026-01-15.enc — then read to the bottom of the dump. The HSM_UNWRAP_CREDENTIAL line in the embedded restore config is your level4 credential.",
    ],

    permissions: {
      "welcome.md":                        { mode: "-rw-r--r--", owner: "vesta-admin", group: "vesta-admin", size: 2684 },
      "lessons-learned.md":                { mode: "-rw-r--r--", owner: "vesta-admin", group: "vesta-admin", size: 6912 },
      ".bash_history":                     { mode: "-rw-------", owner: "vesta-admin", group: "vesta-admin", size:  196 },
      "backup-notes.md":                   { mode: "-rw-r--r--", owner: "theo",        group: "vesta-dev",   size:  874 },
      "make-backup.sh":                    { mode: "-rwxr-xr-x", owner: "theo",        group: "vesta-dev",   size: 1180 },
      // World-readable ciphertext. Theo reasoned the encryption made
      // the file mode irrelevant — which is exactly the reasoning the
      // level exists to dismantle.
      "vesta-prod-backup-2026-01-15.enc":  { mode: "-rw-r--r--", owner: "theo",        group: "vesta-dev",   size: 4180224 },
      "retention-policy.md":               { mode: "-rw-r--r--", owner: "root",        group: "root",        size:  742 },
    },

    env_vars: {
      EDITOR:   "vim",
      HOSTNAME: "backup.vesta.internal",
    },

    // PASSPHRASE-GATED decryption (v2.2.0). Supplying the wrong
    // passphrase — or none — must NOT reveal the plaintext, or the
    // level teaches nothing. See js/commands/structured.js.
    opensslEnc: {
      "vesta-prod-backup-2026-01-15.enc": {
        passphrase: "TheoVesta!1",
        content:
`-- Vesta Retail — payments.transactions export
-- Generated 2026-01-15T03:14:22Z by /opt/vesta/make-backup.sh
-- Source:  prod-db-01.vesta.internal   database: vesta_payments
-- Rows:    48,219   (archive header shows the first 6)

txn_id,captured_at,cardholder_name,pan,expiry,cvv2,auth_code,amount_usd
TXN-88412907,2026-01-14T18:22:04Z,A REYES,4111111111111111,09/28,412,A7X21K,84.15
TXN-88412908,2026-01-14T18:22:51Z,M OKONKWO,5555555555554444,03/27,908,B3M77P,219.40
TXN-88412909,2026-01-14T18:23:16Z,J FERRARO,378282246310005,11/26,3319,C1Q04D,1204.99
TXN-88412910,2026-01-14T18:24:02Z,S NAKAMURA,6011111111111117,07/29,551,D8Z13R,46.80
TXN-88412911,2026-01-14T18:24:44Z,L HAMMOND,4012888888881881,01/28,270,E5W88T,312.65
TXN-88412912,2026-01-14T18:25:09Z,K ADEBAYO,4111111111111111,09/28,412,F2Y46N,84.15
... 48,213 further rows elided in this archive header ...

-- ─── embedded restore configuration ──────────────────────────
-- make-backup.sh appends this block so the restore job is
-- self-contained and can run unattended. The restore job has
-- never actually been run.

RESTORE_TARGET=prod-db-01.vesta.internal
RESTORE_DB=vesta_payments
HSM_ENDPOINT=hsm-01.vesta.internal:9000
HSM_KEY_LABEL=vesta-master-key-7
HSM_UNWRAP_CREDENTIAL=vesta-hsm-mk7-unwrap-2026Q1

-- NOTE(theo, 2025-08): the HSM is the "real" key store per the
-- architecture doc. We never finished wiring the backup job to
-- it, so the nightly export still uses the passphrase in
-- make-backup.sh. Ticket VES-2291. Reprioritized twice.
`,
      },
    },

    bonusFinds: [
      {
        id:   "cvv-should-not-exist",
        name: "The CVV should not be there at all",
        hint: "The dump carries a `cvv2` column. Card verification values are Sensitive Authentication Data, and PCI-DSS prohibits retaining SAD after authorization completes — not 'store it carefully', not 'store it encrypted', but do not store it. Encryption is a control for data you are permitted to keep. It does not create permission. A backup containing post-auth CVV is a finding no amount of AES makes go away.",
        trigger: { command: "openssl", argMatches: /\.enc/, outputContains: "cvv2" },
      },
      {
        id:   "passphrase-beside-ciphertext",
        name: "The passphrase is in the script beside the ciphertext",
        hint: "make-backup.sh passes the passphrase inline with `-k`, and the script sits in the same directory as the file it encrypts, on the same host, world-readable. Anyone who can read the backup can read its key. That isn't encryption at rest, it's a lock with its key taped to the door — CWE-522. It's also why the HSM in the restore config exists (and why VES-2291 never getting done is the actual root cause).",
        trigger: { command: "cat", argMatches: /make-backup\.sh/, outputContains: "-k '" },
      },
    ],

    fs: {
      type: "dir",
      children: {

        "welcome.md": {
          type: "file",
          content:
`─── Driftwood Systems / Vesta Retail — Backup Host Review ─────
  Host:    backup.vesta.internal
  Acct:    vesta-admin (Driftwood audit role on Vesta hosts)
  Date:    Friday 2026-01-16 (pre-QSA audit, day four)
────────────────────────────────────────────────────────────

Priya: "Saanvi read your hash write-up overnight. Her question
was the right one: you proved Theo reused one password four
times — so what does it actually open? One of those four
hashes was labeled \`aes-backup\`. It's the passphrase on the
nightly production backup. It's ALSO the login on this box,
which is how you're reading this file. Decrypt the backup and
tell us what Vesta has been keeping in it. The QSA call is at
14:00 and Saanvi needs to know whether she's reporting a
finding or starting a breach notification."

You are \`vesta-admin\` on Vesta's backup host. Run \`id\` and
\`whoami\` to confirm.

─── NEW COMMAND YOU'LL USE TODAY ──────────────────────────────

  openssl enc -d      Symmetric DECRYPTION. The workhorse for
                      "this file is encrypted at rest" claims.

    openssl enc -d -aes-256-cbc -pbkdf2 -k 'PASSPHRASE' -in FILE

    -d          decrypt (as opposed to -e, encrypt)
    -aes-256-cbc  the cipher the file was encrypted with. You
                  have to know this; it isn't stored in the file.
    -pbkdf2     use the modern key-derivation function
    -k PASS     the passphrase, inline. Real openssl prompts for
                it on the terminal; this sandbox can't prompt, so
                you pass it with -k (or -pass pass:PASS).
    -in FILE    the ciphertext to read

  Get the passphrase wrong and openssl says \`bad decrypt\`. It
  says exactly the same thing if the file is corrupt — it has no
  way to tell the difference. It decrypts with whatever key you
  gave it, then finds the padding is nonsense, and reports that.

─── WHAT "ENCRYPTED AT REST" ACTUALLY MEANS ───────────────────

Encryption turns readable data into ciphertext using a KEY. The
security of the result is the security of the KEY — not the
security of the cipher.

AES-256 is not broken. Nobody in this engagement is going to
break AES. Every real-world compromise of encrypted data is a
compromise of key handling:

  - the passphrase was guessable (a wordlist finds it)
  - the key was stored next to the ciphertext
  - the key was never rotated after the person who knew it left
  - the key was derived from a passphrase with a weak KDF, so
    guessing was cheap

That last one is what \`-pbkdf2\` is about. A Key Derivation
Function turns a human passphrase into a cipher key, and a good
one is deliberately SLOW so each guess costs the attacker real
time. openssl's original derivation was a single digest pass —
effectively free to brute-force. But note the limit: a slow KDF
multiplies the cost of each guess. It cannot save a passphrase
that appears in a wordlist. If the guess is the first one tried,
"expensive per guess" doesn't matter.

Which is the whole story of this level. The cipher Theo chose is
fine. The passphrase you cracked yesterday in under a second is
the key to it.

  \`what-is AES\` and \`what-is KDF\` go deeper.

─── HOW TO PLAY ───────────────────────────────────────────────

  1.  cat welcome.md            You're already here.
  2.  ls -la                    See what's on the box.
  3.  cat vesta-prod-backup-2026-01-15.enc
                                Ciphertext. Unreadable on purpose —
                                note the \`Salted__\` header.
  4.  cat backup-notes.md       Theo's own notes. Which cipher?
  5.  openssl enc -d -aes-256-cbc -pbkdf2 -k 'PASSPHRASE' \\
        -in vesta-prod-backup-2026-01-15.enc
                                Decrypt it. Read to the BOTTOM —
                                the restore config carries your
                                level4 credential.
  6.  cat lessons-learned.md    Post-mortem (after step 5).
  7.  exit                       Return to the lobby.

Bonus exploration when you're done:

  - \`cat make-backup.sh\`      Where does the passphrase live?
  - \`cat retention-policy.md\` What was Vesta supposed to keep?
`
        },

        ".bash_history": {
          type: "file",
          content:
`id
ls -la
file vesta-prod-backup-2026-01-15.enc
cat backup-notes.md
exit
`
        },

        // Theo's notes. Names the cipher (the player needs it — the
        // algorithm is NOT recoverable from the ciphertext) and
        // cheerfully documents the reuse without recognizing it.
        "backup-notes.md": {
          type: "file",
          content:
`# Backup notes — Theo
# (kept next to the job so whoever is on call can restore)

Nightly export of vesta_payments -> encrypted -> this host.

  Cipher:  aes-256-cbc
  KDF:     pbkdf2 (added 2025-11 after the openssl upgrade
           warned about the old derivation)
  Passphrase: the usual one. Same as the admin login here, so
           you don't need to look it up. If you don't know it,
           ask me.

Restore: run make-backup.sh --restore, it reads the embedded
config block at the end of the dump. Never tested end to end.

TODO(VES-2291): move this to the HSM like the architecture doc
says. Bumped from the Q3 and Q4 sprints. Not urgent — the file
is encrypted, so even if the box were exposed the data's safe.
`
        },

        // BONUS-FIND TRIGGER #2. The passphrase inline in the script,
        // in the same directory as the ciphertext it protects.
        "make-backup.sh": {
          type: "file",
          content:
`#!/bin/bash
# Vesta nightly payments backup.  cron: 0 3 * * *  (theo)
#
# Dumps vesta_payments, encrypts the dump, drops it here.
# The encryption is why this host doesn't need special handling
# (per VES-1180 discussion).

set -euo pipefail

STAMP="$(date +%F)"
OUT="/home/vesta-admin/vesta-prod-backup-$STAMP.enc"

pg_dump -h prod-db-01.vesta.internal -U vesta_app vesta_payments \\
  | openssl enc -aes-256-cbc -pbkdf2 -k 'TheoVesta!1' -out "$OUT"

# Append the restore config so the job is self-contained.
cat /opt/vesta/restore-config.fragment >> "$OUT"

echo "backup complete: $OUT"
`
        },

        // The ciphertext. \`cat\` shows openssl's real magic header
        // (Salted__ + 8 salt bytes) followed by noise — the teaching
        // beat that ciphertext is not readable, and the hint that
        // this is openssl-enc output specifically.
        "vesta-prod-backup-2026-01-15.enc": {
          type: "file",
          content:
`Salted__Ñ¶Cù.Ä{â5ªÐh
ò¼]ç1«Ïré´XÓ
d®ñ'Å;àŶ¸ÖJì!
»PÙ7¢äÍõ+i±ÜC
... 4,180,160 further bytes of ciphertext ...
`
        },

        // Vesta's own retention policy — which the backup violates.
        // Not a bonus trigger; it's the "they knew" document that
        // makes the finding a governance finding, not just a bug.
        "retention-policy.md": {
          type: "file",
          content:
`# Vesta Retail — Cardholder Data Retention Standard
# VES-SEC-004 rev 2 (approved 2024-03-11)
# Owner: Saanvi Rao, CISO

## Scope

All systems that store, process, or transmit cardholder data.

## Retention

  Primary Account Number (PAN)
      Retain ONLY where a documented business need exists.
      Must be rendered unreadable wherever stored (truncation,
      tokenization, or strong cryptography with associated key
      management).

  Sensitive Authentication Data (SAD)
      Full track data, card verification values (CVV / CVC2 /
      CAV2 / CID), and PINs MUST NOT be retained after
      authorization completes. This applies even if the data is
      encrypted. There is no approved business justification.

  Backups
      Inherit the classification of their source data. An
      encrypted backup of cardholder data is still cardholder
      data for scope purposes.

## Key management

Encryption keys protecting cardholder data must be stored
separately from the data they protect, with access restricted
to the fewest possible custodians. Passphrases embedded in
scripts do not satisfy this standard.

## Review

Annual. Next review: 2025-03-11. (Overdue.)
`
        },

        "lessons-learned.md": {
          type: "file",
          content:
`══════════════════════════════════════════════════════════════
  POST-MORTEM — what you just found, and why it matters
══════════════════════════════════════════════════════════════

You decrypted a production backup using a password that a
dictionary attack recovered in under a second, and found inside
it something Vesta was never permitted to keep:

  1. The backup is encrypted with AES-256-CBC — a cipher with
     no practical break — using a passphrase Theo reused across
     four systems and which appears in rockyou.txt.

  2. That passphrase is hardcoded in make-backup.sh, which sits
     in the same directory as the file it encrypts, on the same
     host, world-readable.

  3. The plaintext contains full PANs AND cvv2 values for 48,219
     transactions. Card verification values must never be
     retained after authorization — encrypted or not.

The cipher did its job. Everything around the cipher failed.

─── THE BLUNT VERSION ────────────────────────────────────────

"We encrypt our backups" is a statement about an algorithm. It
answers none of the questions that determine whether the data is
actually protected: where does the key live, how was it derived,
who can reach it, when was it last rotated.

Theo's answers were: in the script next to the file; from a
reused human password; anyone with a shell on this host; never.

This is the fourth and final assumption this track exists to
take apart:

  level0  encoding is not encryption      (base64 is reversible
          by anyone, no secret involved)
  level1  signing is not encryption       (a JWT payload is
          readable; alg:none means unverified too)
  level2  hashing is not encryption       (unsalted MD5 falls to
          a wordlist in under a second)
  level3  encryption is only as strong as its key

Note what did NOT happen in any of the four: nobody broke any
cryptography. Every single failure was in how the primitive was
chosen, configured, or keyed. That is what real cryptographic
failure looks like in production. The math is almost never the
problem.

There's a second, sharper finding stacked on the first. Even if
Theo's key management had been perfect — HSM-held key, rotated
quarterly, no passphrase anywhere — the backup would STILL be a
finding, because it retains CVV. Encryption is a control you
apply to data you are permitted to hold. It does not create
permission. That distinction is the one auditors find people
get wrong most often.

─── THE CONSULTING-FIRM ANGLE ────────────────────────────────

Saanvi asked whether this is a finding or a breach notification.
The honest answer at this point in the engagement is: it depends
on evidence you do not have yet, and the responsible next step
is to go get it rather than guess in either direction.

  Finding 1 (Vesta):  Prohibited retention of Sensitive
                      Authentication Data (CVV) in production
                      backups. Owner: Vesta engineering + CISO.
                      This is not remediable by adding controls;
                      the data must stop being written and the
                      existing copies destroyed.

  Finding 2 (Vesta):  Encryption key for cardholder-data backups
                      is a reused human password, embedded in a
                      script beside the ciphertext. Owner: Vesta
                      platform. VES-2291 is the pre-existing
                      ticket; it has been deferred twice.

  Finding 3 (Vesta):  Vesta's own retention standard
                      (VES-SEC-004) prohibits both of the above
                      explicitly. This is a governance failure,
                      not a knowledge gap — the policy is
                      correct and was not followed. Its annual
                      review is also overdue.

The third finding is the one that changes the conversation with
a QSA. A control gap is a gap; a documented control that the
organization did not follow is a program problem.

Scoping note worth writing down: the backup host was treated as
out of scope for cardholder-data handling BECAUSE the file was
encrypted. Encrypted cardholder data is still cardholder data
for scope purposes. This host has been in scope the whole time
and has not been assessed as such.

─── FRAMEWORKS THAT COVER THIS ───────────────────────────────

  CWE-326 — Inadequate Encryption Strength
    Not the cipher — the effective strength of AES-256 keyed
    from a wordlist password is the strength of the password.

  CWE-522 — Insufficiently Protected Credentials
    The passphrase hardcoded in make-backup.sh, world-readable,
    beside the ciphertext.

  CWE-311 / CWE-312 — Missing Encryption / Cleartext Storage
    The decrypted contents, and the plaintext restore config
    appended to the dump.

  CWE-916 — Use of Password Hash With Insufficient
    Computational Effort. Carried over from level2 and directly
    relevant here: the same weakness that let john crack the
    password in a second is what makes this key worthless.

  PCI-DSS v4.0.1 (Vesta is a merchant; this is the governing
  standard for the engagement)
    3.3.1  Sensitive Authentication Data must not be retained
           after authorization, even if encrypted. CVV storage
           is prohibited outright.
    3.5.1  PAN must be rendered unreadable wherever stored.
    3.6.1  Cryptographic keys protecting stored account data
           must be protected against disclosure and misuse.
    3.7.x  Key-management lifecycle: generation, distribution,
           storage, rotation, retirement.
    8.3.6 / 8.6.3  Password strength requirements, including
           for credentials used by systems and applications.
    12.x   Governing policy must exist AND be followed.

  NIST SP 800-57 Part 1 — Recommendation for Key Management
    The canonical reference for the lifecycle Theo skipped. Key
    storage separate from protected data is foundational.

  NIST SP 800-132 — Password-Based Key Derivation
    Specifies PBKDF2 and, critically, that password-based keys
    inherit the entropy of the password. A KDF raises per-guess
    cost; it does not add entropy that was never there.

  OWASP Top 10:2025 — A04: Cryptographic Failures
    The category exists for exactly this shape of finding:
    correct primitive, failed key management.

─── WHERE THIS SHOWS UP ON CERTIFICATIONS ────────────────────

  CompTIA Security+ (SY0-701)
    Domain 1.4: cryptographic solutions — symmetric vs.
    asymmetric, key exchange, KDFs, and the recurring exam
    theme that key management, not algorithm choice, is where
    implementations fail.

  ISC2 CISSP
    Domain 3 (Security Architecture and Engineering): the
    cryptographic lifecycle, key management, and the principle
    that keys must be protected at least as strongly as the
    data. Domain 2 covers data retention and destruction —
    the CVV finding.

  PCI Professional (PCIP) / QSA training
    SAD retention is the single most-tested rule in the
    curriculum, precisely because merchants get it wrong.

  CompTIA CySA+ (CS0-003)
    Data-protection controls and the analyst's job of
    identifying prohibited data in unexpected locations —
    backups, logs, exports, test environments.

  Offensive Security OSCP / PEN-200
    Post-exploitation credential reuse: recovered passwords
    are tried everywhere, and encrypted archives are a
    standard target once a wordlist-crackable password is in
    hand.

─── MITRE ATT&CK MAPPING ─────────────────────────────────────

  T1552.001 — Unsecured Credentials: Credentials In Files
    The passphrase in make-backup.sh.

  T1078 — Valid Accounts
    The reused password as the login on this host.

  T1005 — Data from Local System
    The backup file itself is the collection target.

  T1560.001 — Archive Collected Data: Archive via Utility
    The defensive mirror: adversaries encrypt data they are
    exfiltrating using the same utilities. An encrypted archive
    on a backup host is not inherently benign.

─── WHAT A DEFENDER SHOULD ACTUALLY DO ───────────────────────

  1. Stop writing CVV immediately. This is the only item that
     cannot wait for a sprint. Change the export query to omit
     the column, then locate and securely destroy every existing
     copy — backups, snapshots, replicas, and any downstream
     analytics store the export feeds.

  2. Treat the passphrase as compromised and rotate everything
     it touched. It was in a committed hash file, cracked in a
     second, and reused four ways. Rotate the admin login, the
     prod-DB account, the backup encryption, and the S3
     credential — and audit access logs on each for the window
     since the hashes were committed.

  3. Finish VES-2291. The HSM referenced in the restore config
     is the correct design; the backup job should request a data
     encryption key from it (envelope encryption) so no
     long-lived passphrase exists on disk at all.

  4. Never pass secrets on a command line. Even with a strong
     passphrase, \`-k\` puts it in the process table and shell
     history. Use \`-pass file:\` / \`-pass fd:\` or a secrets
     manager. This is a small fix that removes a whole class of
     exposure.

  5. Re-scope the backup host. It stores cardholder data;
     encryption does not remove it from PCI scope. Bring it into
     the assessed environment with the corresponding logging,
     access control, and review requirements.

  6. Fix the governance loop. VES-SEC-004 already prohibits
     everything found here. Add a control that verifies the
     policy rather than merely publishing it — a periodic
     automated scan of backups and exports for PAN and SAD
     patterns will catch the next instance without waiting for
     an auditor.

─── CLOSING THOUGHT ──────────────────────────────────────────

The most expensive word in this engagement was "encrypted." It
ended every conversation that should have continued — about
where the key lived, about whether the host was in scope, about
whether the data should have been there at all. A cipher is a
tool for protecting data you are allowed to have, keyed by a
secret you can actually keep secret. Theo had neither, and the
word "encrypted" hid both problems for a year and a half.

Priya: "Send Saanvi the CVV finding now, before the call — she
needs it in her opening, not her follow-ups. The key management
can wait for the written report. And note the scoping issue
explicitly; that's the one their QSA will chase hardest."

(That HSM in the restore config is the design nobody finished
wiring up. Worth a look at what it's actually holding.)

Return to the lobby:    ssh guest@d3cyph3r
`
        },

      },
    },
  },

};
