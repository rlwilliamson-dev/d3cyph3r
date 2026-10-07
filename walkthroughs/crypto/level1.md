# level1@crypto — Theo's Signature That Wasn't

**Track:** Crypto · **Client:** Vesta Retail · **Compliance regime:** PCI-DSS v4.0.1 · **Builds on:** [`level0@crypto`](/walkthroughs/#/crypto/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@crypto`. If you haven't solved `level1@crypto` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left `level0@crypto`, Vesta Retail had a tidy little incident on its hands. You had filed the finding: Theo's commit moved the production payment-card-processor API key into a base64-encoded file and called that protection. Saanvi, Vesta's CTO, took the report and scheduled the rotation for the next change window (Friday), and Theo had a friendly, well-handled pre-meeting with Priya, Driftwood's senior consultant on the Vesta engagement. To his credit, Theo took the news the way you want a junior engineer to take it: he asked questions, wrote down the answers, and started reading RFC 4648 that same afternoon.[^rfc-4648]

At the end of that conversation he mentioned, almost in passing, a second project.

He had been working on Vesta's internal admin API: the back-office tools for secret rotation, audit-log queries and a one-off "rotate this credential without paging the on-call" workflow, used by a handful of engineers and one or two scheduled jobs. Three weeks ago he shipped a new auth model for it, stateless JWTs, replacing a session cookie backed by Redis. In his words it was "a quick token-based thing" built on the most-downloaded JWT library on npm, and he thought Priya would like it because it was more modern.

Priya did not respond with the enthusiasm Theo expected. She asked him to send her the verify middleware and a recent sample of the admin-API access log. The "you and I are going to look at this together tomorrow" tone was not lost on him, but he sent both before end of day and went home to reread the JWT specs. Both artifacts are in the audit directory.

The legal frame is the same as yesterday's. Saanvi authorized a controlled use of the live API key (the one Theo base64-encoded, still unrotated until Friday) for a one-time blast-radius check, and today's check uses that authorization to ssh into the payment-deploy host, where the admin-API access logs are mirrored for observability. Your prompt reads `vesta-deploy@crypto:~$`. The rules of engagement haven't changed either: read what is there, document what you find, don't pivot, don't forge anything, get out.

Vesta's compliance regime is PCI-DSS v4.0.1.[^pci-dss-v4-0-1] Vesta is a Level 2 merchant (1 to 6 million Visa transactions a year, since levels are counted per card brand; up from Level 3 in 2024), which in its acquirer's arrangement means an annual self-assessed SAQ D and a Qualified Security Assessor on site every other year. The next QSA review is six weeks out, and the admin API is in scope for it because it drives the secret-rotation machinery for the cardholder-data environment. Anything that authenticates a caller into actions on the CDE falls under the authentication requirements (Req 8) and the secure-development requirements (Req 6.2).

What you don't know yet, walking in, is that Theo's "quick token-based auth" rejects almost nothing. Any caller, employee or attacker, authenticated or not, can write a JWT that says `role: admin`, set the algorithm header to `none`, and Theo's middleware will accept it as though it were properly signed.

## §2 — The solve

The path is short: two files to read and one command to run against one token.

### Step 1: Confirm the credential and what it bought you

```bash
guest@d3cyph3r:~$ ssh level1@crypto
level1@crypto's password: vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3
Connected: level1@crypto
vesta-deploy@crypto:~$ whoami
vesta-deploy
vesta-deploy@crypto:~$ pwd
/home/vesta-deploy
```

You used the still-live API key from `level0@crypto`, `vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3`, which `base64 api-key.b64` decoded in level 0. It is the same access an attacker who pulled the key from Vesta's repo would have, and the reason Saanvi scheduled the Friday rotation. You are on `payment-deploy.vesta.internal`, where the admin-API logs are mirrored.

### Step 2: Read the day-two context

```bash
vesta-deploy@crypto:~$ ls
admin-access.log     priya-note.md         verify-middleware.js
lessons-learned.md   welcome.md
```

Five files. Read them in order.

`welcome.md` covers the mechanics: what a JWT is, what its three segments do, and what the `jwt` command does with one. `priya-note.md` is the in-character handoff, with the day-two context, what Theo said about the new auth model, what Priya wants checked, the rules of engagement and the PCI-DSS hooks. `verify-middleware.js` is Theo's verification code, fifteen lines including imports. `admin-access.log` is the recent access log Theo sent over. `lessons-learned.md` is for after you have found what is there.

Three things to take away before you touch anything:

- **The new tool**: `jwt <token>` decodes a JSON Web Token, prints the header and payload (both base64url-encoded inside the token) and flags the common problems: `alg: none`, an empty signature, an expired token.
- **The legal frame**: same as yesterday. Reconnaissance only. Don't forge a token, and don't call any admin endpoint.
- **The shape of the suspicion**: Priya doesn't say "Theo's auth is broken." She says "the same class of mistake as yesterday — confusing one cryptographic primitive for another, or applying one with the wrong parameters — shows up everywhere in junior engineers' first crypto-adjacent code." You walk in expecting a mistake of that shape.

### Step 3: Read Theo's verify middleware

```bash
vesta-deploy@crypto:~$ cat verify-middleware.js
```

Fifteen lines. The part that matters:

```javascript
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
```

The bug is on the line where Theo calls `jwt.verify(token, SIGNING_SECRET)` with exactly two arguments. The `jsonwebtoken` library's `verify()` takes a third `options` object where you say which algorithms are acceptable: `jwt.verify(token, secret, { algorithms: ['HS256'] })`. Leave it out and older versions of the library read the `alg` field from the token's own header and dispatch to whatever verification routine it names. That is the version this middleware is running.

A token claiming `alg: none` asks for verification to be skipped. The library obliges, and the verifier accepts the token.

Theo's code comment reads: *"The library reads the alg from the token header so we can rotate signing algorithms later without touching client code."* That sentence describes exactly what you don't want. The convenience that lets the server change algorithms without coordinating with clients is the same mechanism that lets an attacker send `alg: none` and have the server honor it.

### Step 4: Read the access log

```bash
vesta-deploy@crypto:~$ cat admin-access.log
```

```
[2026-04-09T07:14:23Z] admin-svc startup on :8443 (config: secrets v3.2)
[2026-04-09T07:14:23Z] verify-middleware loaded (jsonwebtoken @ default options)
[2026-04-09T07:42:01Z] req=req_4K2J9 GET /admin/health → 200 (no auth — public endpoint)
[2026-04-09T08:14:23Z] req=req_8H7K4 POST /admin/rotate-secret → 200
[2026-04-09T08:14:23Z] req=req_8H7K4 DEBUG Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJ2ZXN0YS1hZG1pbi1zdmMiLCJzdWIiOiJhZG1pbi1zdmMtZGVwbG95IiwiYXVkIjoidmVzdGEtYWRtaW4tYXBpIiwiaWF0IjoxNzc1NzIyNDQwLCJleHAiOjIwOTEzNDE2NDAsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiKiIsImFjdG9yIjoidGhlb0B2ZXN0YS5leGFtcGxlIiwiaGFuZG9mZl90b2tlbiI6InZlc3RhLWFkbWluLWhhbmRvZmYtMjAyNiJ9.
[2026-04-09T08:14:23Z] req=req_8H7K4 DEBUG jwt.verify returned: claims with role=admin
[2026-04-09T08:14:24Z] req=req_8H7K4 rotateSecret(target=payment-api-key) succeeded
[2026-04-09T08:17:42Z] req=req_M5R2X GET /admin/audit-bypass-tokens → 200 (same caller, same token replayed)
[2026-04-09T08:17:42Z] req=req_M5R2X audit-bypass-tokens query returned 1 active token
```

Three things to notice before you decode anything.

The log is debug-level verbose. It records the full `Authorization` header, JWT included, which is a finding of its own: anyone who can read the log can replay any token in it. A log like this, readable from a payment-deploy host, is CWE-532 (Insertion of Sensitive Information into Log File) and breaks PCI-DSS Requirements 10.3.1 (read access to audit logs limited to those with a job-related need) and 10.3.2 (audit logs protected from modification).[^cwe-532]

The `verify-middleware loaded (jsonwebtoken @ default options)` line at startup is a tell. The library was loaded with no global options, and since the application code also calls `jwt.verify()` without options (you just read it), nothing constrains which algorithms are accepted.

And the token is reused: the same caller hits two endpoints with the same JWT. Statelessness is what makes JWTs reusable like this, but it also means one disclosed token carries the blast radius of every request it can authorize, not just the one somebody observed.

### Step 5: Decode the token

```bash
vesta-deploy@crypto:~$ jwt eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpc3MiOiJ2ZXN0YS1hZG1pbi1zdmMiLCJzdWIiOiJhZG1pbi1zdmMtZGVwbG95IiwiYXVkIjoidmVzdGEtYWRtaW4tYXBpIiwiaWF0IjoxNzc1NzIyNDQwLCJleHAiOjIwOTEzNDE2NDAsInJvbGUiOiJhZG1pbiIsInNjb3BlIjoiKiIsImFjdG9yIjoidGhlb0B2ZXN0YS5leGFtcGxlIiwiaGFuZG9mZl90b2tlbiI6InZlc3RhLWFkbWluLWhhbmRvZmYtMjAyNiJ9.
```

The decoder output:

```
Decoded JWT
──────────────────────────────────────────

Header:
  {
    "alg": "none",
    "typ": "JWT"
  }

Payload:
  {
    "iss": "vesta-admin-svc",
    "sub": "admin-svc-deploy",
    "aud": "vesta-admin-api",
    "iat": 1775722440,
    "exp": 2091341640,
    "role": "admin",
    "scope": "*",
    "actor": "theo@vesta.example",
    "handoff_token": "vesta-admin-handoff-2026"
  }

Signature (raw, 0 bytes):
  (empty)

Notes:
  [!] alg: 'none' — server-side acceptance of an unsigned token is a known CVE class (alg=none confusion). Anyone can forge claims.
  [!] Signature is empty. Verify the server is actually checking it.
  [*] exp: 2036-04-09T08:14:00.000Z (valid)
```

Read it carefully.

The **header** announces `alg: none`, a token asking not to be verified. The access log shows the application accepted it and dispatched to `rotateSecret()`, so verification really was skipped. This is not theoretical; you are reading evidence that it has been exercised.

The **payload** is the claim set: `role: admin`, `scope: "*"`, `actor: theo@vesta.example`, all the access decisions the application is supposed to make on the strength of a verification it never did. It also carries a `handoff_token` field holding `vesta-admin-handoff-2026`. That is a credential, sitting in a JWT payload because someone needed to pass a value along and decided the token was a handy envelope. JWT payloads are base64url-encoded, not encrypted, so anyone who reads the token can read the field. This is the level2 breadcrumb, and the format practically invites it: payloads look opaque to someone skimming a log, and they decode in one command.

The **signature segment** is empty. The decoder flags it, the access log records the application accepting it, and the middleware code explains both.

The **expiration** is ten years out (2036-04-09). Long-lived tokens are a finding of their own under modern guidance (NIST SP 800-63B-4 §5, *Session Management*, covers session lifetime and reauthentication), but the primary finding here is the missing signature check.[^nist-800-63b]

### Step 6: Document and stop

Under Priya's rules of engagement you do not now build an `alg: none` token of your own to see what else the admin API will accept, and you do not query `/admin/audit-bypass-tokens` to enumerate other tokens. You write up exactly what the audit found.

The report needs at least this:

1. **The admin-API JWT verifier accepts unsigned tokens.** `verify-middleware.js` calls `jwt.verify(token, SIGNING_SECRET)` with no algorithms allowlist, so tokens with `alg: none` are accepted and their claims trusted.
2. **The vulnerability is being exercised in current traffic.** The access log shows an `alg: none` token driving `rotateSecret(target=payment-api-key)`. Whether that is legitimate (Theo's own service calling its own API with a badly configured client) or not cannot be decided from the log alone.
3. **The admin-API access log records Authorization headers.** Anyone with read access to the log can recover and replay live JWTs. That is independent of the verification bug, and would be a CWE-532 and PCI-DSS 10.3.1/10.3.2 finding even if verification were correct.
4. **A live credential is sitting in a JWT payload.** The `handoff_token` claim holds `vesta-admin-handoff-2026`, and anyone who decoded the token, from the log, a captured request or a leaked client SDK, has it.
5. **Treat the signing secret as compromised.** Whether or not anyone actually took it, the threat model now has to include "any historical admin action could have been driven by a forged token." Rotation belongs in the incident response, even though (see §3.5) rotation alone fixes nothing.

Send the report to Priya, who will route it to Saanvi with yesterday's attached, and exit the level.

```bash
vesta-deploy@crypto:~$ exit
```

### Step 7 (game-world only): Use the breadcrumb

In a real engagement the day ends here. In D3CYPH3R the credential chain continues into `level2@crypto`, where the `handoff_token` you extracted is the way in.

```bash
guest@d3cyph3r:~$ ssh level2@crypto
level2@crypto's password: vesta-admin-handoff-2026
```

`level2@crypto` is playable, and its walkthrough picks up from here.

## §3 — The vulnerability

Today's finding looks like one missing argument on one function call. It is really three failures stacked.

### Failure 1: The verifier accepts `alg: none` (CWE-347)

`jwt.verify(token, secret)` without an algorithms allowlist lets the JWT's own `alg` header decide what verification means. An `HS256` token is checked against the shared secret as HMAC-SHA256. An `RS256` token is checked against a public key as RSA-SHA256. An `alg: none` token is "verified" by skipping the signature check entirely: the verifier reads the payload, trusts the claims and returns success.

This is CWE-347, *Improper Verification of Cryptographic Signature*, which MITRE describes as a product that "does not verify, or incorrectly verifies, the cryptographic signature for data."[^cwe-347] The verification step exists and returns success, but the success means nothing cryptographically, because the signature was never checked.

CWE-347 is the canonical ID for signature-verification failures, and MITRE marks it ALLOWED for mapping. It is not on the CWE Top 25. JWT findings also get filed under the broader CWE-287 *Improper Authentication*, which dropped off the 2025 list after years on it,[^cwe-287] and CWE-863 *Incorrect Authorization*, which is on it.[^cwe-863] The weakness persists because JWT-based authentication spread faster than the knowledge of how to verify JWTs safely.

The disclosure that introduced the JWT-library world to the `alg: none` and RS→HS attack families was Tim McLean's March 2015 guest post on the Auth0 blog, *"Critical vulnerabilities in JSON Web Token libraries."*[^tim-mclean-critical-vulnerabilities-in] It was tracked through separate per-library CVEs rather than one umbrella ID: **CVE-2015-2951** for a PHP library (F21 JWT) that let crafted tokens bypass signature verification, **CVE-2015-9235** for the node-jsonwebtoken RS→HS key-confusion case, and others for the rest.[^cve-2015-2951][^cve-2015-9235] The libraries patched, mostly by refusing `alg: none` unless the caller explicitly allows it. The bug comes back whenever someone allows `none` on purpose, passes an allowlist that is too generous, or runs an old library version. Theo's case is the last one: `jsonwebtoken` 8.5.1 and earlier fell back to `none` when `verify()` was called without an algorithms list, which is CVE-2022-23540 (§7 covers the upgrade).[^cve-2022-23540]

### Failure 2: The token payload contains a live credential (the JWT-as-confidential-envelope mistake)

The JWT payload carries `handoff_token: "vesta-admin-handoff-2026"`. Whoever wrote that claim treated the JWT as a confidential envelope, a place to carry a credential alongside the role and scope claims, presumably to skip a separate secret-management step for the handoff.

JWT payloads are not confidential. The payload is base64url-encoded, which anyone holding the token can reverse, and RFC 7519 says plainly that a JWT carrying sensitive information needs protecting against disclosure.[^rfc-7519] The signed form (JWS, RFC 7515) gives you *integrity*, since you cannot change the claims without breaking the signature, but not *confidentiality*.[^rfc-7515] Confidentiality needs JWE (JSON Web Encryption, RFC 7516), a separate and more complex envelope.[^rfc-7516]

Most production JWTs are JWS, and so are most tutorials. Plenty of engineers learn that a JWT is "encoded" and conclude it must also be "encrypted." It is not. Anything in the payload is readable by whoever holds the token, whoever can pull it from a log, whoever intercepts the call and whoever sees it in a debug dump.

No CWE fits this one cleanly. **CWE-540** *Inclusion of Sensitive Information in Source Code* captures the principle if you read it loosely: sensitive data does not belong in an artifact whose access control is weaker than the data's.[^cwe-540] The broader CWE-200 family covers it too, with the usual caveat that MITRE marks CWE-200 Discouraged for mapping.[^cwe-200]

### Failure 3: The admin-API log captures Authorization headers (CWE-532)

The access log records full `Authorization` headers at DEBUG level. In a single line, the application writes down a credential and the fact that it accepted it, in a file anyone with read access to the deploy host can `cat`.

This is **CWE-532** *Insertion of Sensitive Information into Log File*, whose catalog description is as direct as it gets: "The product writes sensitive information to a log file." Authorization headers are the canonical example.

The fix is mechanical. Redact the `Authorization` header at the proxy or middleware layer, and as a backstop have the log pipeline mask it before storage; most API gateways, web servers and log shippers can do one or the other. The harder discipline is never writing a credential to the application's own logs in the first place. Redaction is the backstop, not the design.

### The compound effect

Each failure is a finding on its own. Stack them and you get today's level.

```
  Tokens with alg:none accepted (no signature verified)
    +
  Live credential placed in token payload
    +
  Tokens dumped to logs at DEBUG level
    =
  Any reader of the log can forge admin tokens AND
  recover a separate live credential without forging anything.
```

The fixes track each failure separately:

- Failure 1: pass `{ algorithms: ['HS256'] }` to every `jwt.verify` call. Grep the codebase for the two-argument form and fix every hit, then upgrade the library.
- Failure 2: move the handoff token into a real secrets manager (AWS Secrets Manager, HashiCorp Vault) and rotate the current value. A JWT payload holds claims about the session, not other credentials.
- Failure 3: redact `Authorization` headers in the log pipeline. The application should never log the value; if debug logging is needed, write `"Authorization: Bearer <REDACTED>"`.

Each fix is mechanical. What prevents the next one is the same in all three cases: the engineer understands what the library does when called without its safety arguments. RFC 8725, *JSON Web Token Best Current Practices*, is the document to print out and hand to Theo.[^rfc-8725]

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Vesta's internal admin API, whose verify middleware calls `jwt.verify` with no algorithms allowlist |
| Consequence | Tokens presented with `alg: none` are accepted, so anyone who can craft JSON can mint an administrative identity |
| Authentication required | None. This is not a stolen credential, it is the absence of a check |
| Also disclosed | A debug log recording a token being replayed by the same caller |
| Escalates to | `level2@crypto` |
| Regime | PCI-DSS v4.0.1, contractual, not statutory; notification runs to the acquirer and card brands[^pci-dss-v4-0-1] |

**There is no credential to rotate here, which changes the entire
remediation shape.** Every other finding in this track is fixed by
issuing a new secret. This one cannot be, because the attacker never
needed a secret. Until the allowlist is added, rotating signing keys
accomplishes nothing at all: an `alg: none` token does not carry a
signature to check against them.

**Assume exploitation and work backwards, because the population of
possible attackers is "anyone who could reach the endpoint."** Scoping
questions that begin "who had valid credentials" do not apply. The
useful questions are which network positions could reach the admin API,
for how long the middleware has been in this state, and whether request
logs retain enough to distinguish a forged token from a legitimate one
after the fact.

**The replay in the debug log is evidence, and it should be treated as
such immediately.** The same caller presenting the same token twice
against an administrative endpoint is exactly the pattern this
vulnerability produces. It may be benign. Determining which it is comes
before the code fix in priority order, because if it is not benign then
Vesta's obligations to its acquirer have already started.

## §4 — Real-world parallels

JWT verification failures have a short history, because JWT only became a standard in May 2015 (RFC 7519), but it is a dense one.[^rfc-7519]

### Thread 1: The McLean Auth0 disclosure (2015)

Tim McLean, an independent security researcher, was reviewing several popular JWT libraries when he noticed they shared a vulnerable pattern: their `verify()` functions read the algorithm from the token's header and dispatched to the matching routine without checking whether the caller had asked for it. He documented two attacks against that pattern:

1. **`alg: none` confusion**: a token with `alg: none` in the header is dispatched to a "no signature" path that returns true. This is the attack you just walked through.
2. **RS256→HS256 key confusion**: a token with `alg: HS256` is dispatched to an HMAC-SHA256 path that uses the server's *public key* as the HMAC secret. RSA public keys are, well, public, so the attacker can compute a valid HMAC and produce a token the server accepts as properly signed.

Both appeared in McLean's March 2015 guest post on the Auth0 blog, *"Critical vulnerabilities in JSON Web Token libraries,"* and were tracked through per-library CVEs rather than a single multi-library one: **CVE-2015-2951** for F21's PHP JWT library, **CVE-2015-9235** for node-jsonwebtoken's RS→HS confusion, and others for the rest.[^cve-2015-9235][^cve-2015-2951] The libraries patched, mostly by refusing `alg: none` unless the caller allows it. A decade on, McLean's post is still the reference for the algorithm-confusion family.

Theo's middleware teaches the same lesson McLean did: the original sin of JWT verification is letting unauthenticated input, the token header, decide how verification works. The modern guidance, RFC 8725 and the OWASP JWT cheat sheet among it, gives the same defense. The verifier decides which algorithms are acceptable, and a token claiming anything else is rejected.[^owasp-jwt-cheat-sheet][^rfc-8725]

### Thread 2: Key-injection attacks — CVE-2018-0114 and the jku/x5u family

A JWT can carry its verification key inside the token or point to it by reference. The JWS header defines several fields for this:

- **`jwk`** (JSON Web Key): an embedded public key in the header itself.
- **`jku`** (JWK Set URL): a URL where the verifier can fetch the JSON Web Key Set that signed this token.
- **`x5u`** (X.509 URL): a URL where the verifier can fetch the X.509 certificate that signed this token.

The URL-fetching variants exist for multi-tenant identity providers that sign with per-tenant keys: the header carries a URL where the verifier can fetch the right public key. The intended security model is that the verifier only fetches from a trusted domain, or ignores these headers entirely and resolves keys from a configured trust store.

The vulnerability class is a library that trusts the token's own claim about which key verifies it. **CVE-2018-0114** is the canonical case: Cisco's `node-jose` library accepted a `jwk` header (an embedded public key) and verified the signature against it.[^cve-2018-0114] The attack is to strip the original signature, embed your own public key, sign with the matching private key and send. The verifier checks the token against the key the attacker supplied.

The `jku` and `x5u` URL-fetching variants are related but distinct, and have their own per-library CVEs. The shared pattern is that any header field letting the token influence the choice of verification key is a vector unless the verifier tightly constrains it.

The fix has the same shape as the `alg: none` fix: the verifier takes keys from a configured trust store, and the token's claims about its key are matched against that store, never used to fetch new material.

### Thread 3: Weak HMAC secrets — and the published cracking tools

Even when verification is correctly pinned to HS256, the signature is only as strong as the HMAC secret. If the secret is short, dictionary-derived or otherwise guessable, an attacker who captures a single signed token can brute-force it offline and then forge whatever tokens they like.

The tooling is mature and free. The most-cited tool is **`jwt_tool`** by ticarpi (<https://github.com/ticarpi/jwt_tool>), which handles `alg: none`, RS→HS key confusion, jku/x5u injection and HMAC-secret cracking. **`hashcat`** has first-class JWT support too (`-m 16500`), and on commodity GPU hardware a dictionary attack against a weak secret can finish in seconds.

The usual story is mundane: a memorable secret chosen during development that nobody replaced before production. The fix is well documented. Use a cryptographically random secret of at least 256 bits, rotate it, and for high-value applications consider RS256 or ES256 with keys held in hardware.

### Thread 4: Notable named incidents (recent)

JWT misconfigurations rarely make front-page news by themselves; they tend to be one finding among many in a larger breach. A few named incidents give useful context:

- **Atlassian Confluence (CVE-2022-26134, June 2022)**: an OGNL injection in Confluence Server and Data Center allowed unauthenticated remote code execution.[^cve-2022-26134] Volexity found it while responding to an incident over the US Memorial Day weekend. It is not a JWT story (the post-exploitation involved BEHINDER implants and JSP webshells, not token forgery), and it is here as a contrast. Pre-auth RCE is the rare, catastrophic way to act as an admin without being one; broken JWT verification is the small, routine way. Both end in the same place, and only one needs a newly discovered RCE.
- **Okta support-system breach (October 2023)**: Okta disclosed that an attacker had abused a service account stored in its support-case system (Auth0's support system was reported unaffected). The credentials for that account had been saved to an employee's personal Google account, and HAR files uploaded to support cases held session tokens that were used to hijack five customers' sessions. The parallel to today is a credential, and session-token material, ending up in an artifact where it did not belong, which is exactly what Theo's `handoff_token` claim is.
- **HackerOne disclosures**: the platform's public reports include JWT bugs across many programs. Search for `alg:none` or `jwt` to see current examples; secondary and admin endpoints configured differently from the main API are a recurring theme, and that is Theo's situation.

The named incidents give context, but the more useful point is that a misconfigured JWT verifier is an ordinary penetration-test finding, not an exotic one.

## §5 — Frameworks, deep dive

The in-game post-mortem (`lessons-learned.md`) names the framework mappings. This section expands each one with the section, control or paragraph an auditor would cite and the remediation each framework expects.

### CWE — Common Weakness Enumeration

**CWE-347: Improper Verification of Cryptographic Signature.**[^cwe-347] The primary weakness for the `alg: none` failure: the product "does not verify, or incorrectly verifies, the cryptographic signature for data." MITRE mapping status is **ALLOWED**, so it is a valid ID for analytics and reporting. It is the canonical ID for JWT signature failures even though it is not on the CWE Top 25.

**CWE-345: Insufficient Verification of Data Authenticity.**[^cwe-345] The parent in the hierarchy. Use it when the specific mechanism (signature, MAC and so on) isn't the point; CWE-347 is the narrower fit when the failure is specifically a cryptographic signature.

**CWE-287: Improper Authentication.** The umbrella authentication-bypass weakness. Map it when the point is "the wrong people got authenticated"; map CWE-347 when the point is "the signature check is broken."

**CWE-532: Insertion of Sensitive Information into Log File.**[^cwe-532] The secondary weakness: the admin-API log records full `Authorization` headers, JWTs included. MITRE mapping status: **ALLOWED**. The mitigations are refreshingly blunt, starting with "Do not write secrets into the log files," followed by removing debug logs before production and protecting log files from unauthorized access.

**CWE-540: Inclusion of Sensitive Information in Source Code.**[^cwe-540] The literal entry is about source code, but the principle (credentials don't belong in artifacts whose access control is weaker than the credential's) applies to the `handoff_token` claim. Use it as a secondary citation there.

### PCI-DSS v4.0.1

The current revision of the Payment Card Industry Data Security Standard (released June 2024, superseding v4.0 from March 2022). Vesta is a Level 2 merchant working to the full SAQ D scope.

**Requirement 6.2.4, Software engineering techniques to prevent or mitigate common software attacks.** This covers secure development of bespoke and custom software, and the requirement lists the attack types to defend against, including attacks on cryptography usage and attempts to bypass or abuse authentication. Algorithm confusion is both, and Theo's middleware fails this directly.

**Requirements 6.4.1 and 6.4.2, public-facing web applications.** 6.4.1 allowed either a vulnerability review at least every 12 months and after significant changes, or an automated solution in front of the application. Since 31 March 2025 it has been superseded by 6.4.2, which requires the automated solution (a WAF, in practice) that detects and prevents web attacks. Either way, it only reaches the admin API if that API is exposed to the internet, which is worth confirming rather than assuming.

**Requirement 8.3.2, Strong cryptography renders authentication factors unreadable in transmission and storage.** A debug log full of replayable bearer tokens stores authentication factors in the clear, which is a direct 8.3.2 failure on top of the 10.3 findings.

**Requirement 10.3.1, Read access to audit logs is limited to those with a job-related need,** and **Requirement 10.3.2, Audit log files are protected to prevent modifications by individuals.** (Both sit in v4.0.1's Section 10.3; v3.2.1 used the older 10.5.x numbering, which still turns up in legacy documentation.) The admin-API log full of recoverable JWTs is the artifact in scope, and because those tokens replay as live admin actions, anyone who can read the file effectively holds the admin API.

### NIST SP 800-53 Rev. 5

NIST Special Publication 800-53 Revision 5, the federal control catalog and, outside federal scope, the most comprehensive controls reference in common use.[^nist-800-53]

**IA-2, Identification and Authentication (Organizational Users).** The system must uniquely identify and authenticate users. Accepting `alg: none` tokens defeats this, because the identity a token claims is never verified.

**SC-23, Session Authenticity.** The system must protect the authenticity of communications sessions. A bearer token whose signature is never checked offers no session authenticity at all.

**AU-9, Protection of Audit Information.** The secrets-in-logs half: audit information must be protected from unauthorized access, modification and deletion, and the admin-API log holding full Authorization headers is the artifact in scope.

**AC-3, Access Enforcement.** The system must enforce approved authorizations for logical access. The middleware enforces nothing on an `alg: none` token; access is granted on the strength of an unverified `role: admin` claim.

### OWASP

**OWASP Top 10 (2025), A07: Authentication Failures.**[^owasp-top-10-2025] The umbrella category for authentication bugs. The 2025 edition kept it at A07 and shortened the name from 2021's "Identification and Authentication Failures."

**OWASP Top 10 (2025), A02: Security Misconfiguration.** Covers the missing algorithms allowlist as misuse of an otherwise sound library. The 2025 reshuffle moved Security Misconfiguration up from A05 to A02.

**OWASP API Security Top 10 (2023), API2: Broken Authentication.**[^owasp-api-security-top-10] The API-specific list, last updated in 2023, names JWT misuse explicitly: accepting unsigned or weakly signed tokens (`{"alg":"none"}`), not validating expiry, and weak keys.

**OWASP JWT Cheat Sheet.** The focused defender reference (<https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html>). On algorithm confusion its advice is to "hardcode the accepted algorithms" and not mix public-key signature algorithms with MAC algorithms. The tester's companion is OWASP's WSTG chapter on testing JSON Web Tokens (<https://wstg.owasp.org/latest/4-Web_Application_Security_Testing/06-Session_Management/10-JSON_Web_Tokens/>).

### RFCs

**RFC 7519, JSON Web Token (JWT).**[^rfc-7519] The foundational specification. Section 6 defines the "Unsecured JWT" (`alg: none`), and Section 7.2 (Validating a JWT) carries the normative guidance: *"unless the algorithms used in the JWT are acceptable to the application, it SHOULD reject the JWT."* RFC 7519 only says SHOULD; the stronger MUST lives in RFC 8725 §3.1. Theo's middleware ignores both.[^rfc-8725]

**RFC 7515, JSON Web Signature (JWS).**[^rfc-7515] The signature format underneath JWT. Section 5.2, step 8, requires the signature to be validated "in the manner defined for the algorithm being used, which MUST be accurately represented by the value of the 'alg' (algorithm) Header Parameter, which MUST be present." Section 4.1.1 adds that a signature is not valid if `alg` does not name a supported algorithm.

**RFC 8725, JSON Web Token Best Current Practices.** The BCP dedicated to JWT security, published February 2020. Section 3.1 (*Perform Algorithm Verification*) applies most directly: *"Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations."* Theo's caller doesn't specify, the library doesn't enforce, and the token's claimed algorithm wins. RFC 8725 also covers key entropy (Section 3.5, the weak-secret problem) and untrusted header fields such as `kid`, `jku` and `x5u` (Section 3.10).

## §6 — Cert exam relevance

Most security certs with a web or application component cover `alg: none` and its cousins, directly or through the concepts underneath.

**CompTIA Security+ (SY0-701).**[^cert-security-plus] The current exam, released November 2023, covers the concepts underneath this level: digital signatures and what verifying one means (Domain 1, *General Security Concepts*), and cryptographic and application attacks (Domain 2, *Threats, Vulnerabilities, and Mitigations*).

**CompTIA CySA+ (CS0-003 / CS0-004).**[^cert-cysa] CS0-004 launched on 23 June 2026 and CS0-003 retires on 22 December 2026. On CS0-003, Domain 1 (*Security Operations*) covers the defender's detection work, such as SIEM rules for empty signatures and unexpected `alg` values, and Domain 2 (*Vulnerability Management*) covers the vulnerability class itself.

**CompTIA PenTest+ (PT0-003).**[^cert-pentest-plus] The current exam, released December 2024 (PT0-002 retired in mid-2025). Web application attacks sit in Domain 4 (*Attacks and Exploits*), and token tampering of this kind belongs there; Domain 3 (*Vulnerability Discovery and Analysis*) covers finding it.

**ISC2 CISSP.**[^cert-cissp] Domain 3 (*Security Architecture and Engineering*) covers digital signatures and what it takes to verify one properly, and Domain 5 (*Identity and Access Management*) covers session and token management.

**ISC2 CSSLP (Certified Secure Software Lifecycle Professional).** The secure-software cert. Its implementation and testing domains are where authentication code like Theo's middleware gets examined.

**OffSec OSWA / OSWE.**[^cert-oswe] OffSec's web certs are where this gets hands-on: WEB-200 (OSWA) and WEB-300 (OSWE) both center on finding and exploiting web authentication flaws, and the OSWE exam is a roughly 48-hour practical against real applications. OSCP (PEN-200) is the broader pentest cert; the web depth lives in the other two.[^cert-oscp]

**SANS GIAC GWAPT.**[^cert-gwapt] *GIAC Web Application Penetration Tester*. SEC542, the course behind it, covers authentication and session-token attacks, which is where JWT flaws live.

## §7 — What a defender does

The in-game `lessons-learned.md` has the short version. This section adds the operational detail that gets a defender from "I read about this" to "I shipped the change."

### 1. Whitelist algorithms in every JWT.verify() call

The fix is one extra argument on every `verify` call. The harder work is finding every call.

**Node.js (`jsonwebtoken`).** The two-argument form is the vulnerability:

```javascript
// VULNERABLE: the token's alg header decides verification behavior
const claims = jwt.verify(token, SIGNING_SECRET);

// FIXED: only HS256-signed tokens are accepted
const claims = jwt.verify(token, SIGNING_SECRET, {
  algorithms: ['HS256']
});
```

**Node.js (`jose`).** The `jose` library, a more modern alternative, is safer by design because it ties the key to its algorithm:

```javascript
import { jwtVerify, importJWK } from 'jose';

const key = await importJWK({ ... }, 'HS256');
const { payload } = await jwtVerify(token, key, {
  // jose still requires you to pass algorithms or it throws
  algorithms: ['HS256']
});
```

**Python (`PyJWT`).** Same pattern; the `algorithms` keyword is required when verifying:

```python
import jwt

# PyJWT 2.x raises InvalidAlgorithmError if you omit algorithms
claims = jwt.decode(token, SIGNING_SECRET, algorithms=['HS256'])
```

In PyJWT 1.x, omitting `algorithms` accepted whatever the token claimed. Version 2.0 made the parameter required, so an application still pinned to 1.x has a separate finding.

**Go (`golang-jwt/jwt`).** The Go library requires an explicit keyfunc that can inspect the algorithm:

```go
token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
  // Verify the alg is what we expect
  if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
    return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
  }
  return signingSecret, nil
})
```

**Audit the codebase.** A regex like `jwt\.verify\([^,]+,[^,]+\)` (Node.js), or `jwt\.decode\([^,]+,[^,]+\)` without `algorithms=` (Python), catches the two-argument form, and every hit is a finding. Static-analysis tools do this better: the Semgrep registry at <https://semgrep.dev/r/> has searchable JWT rules for the Node and Python libraries.[^semgrep-registry-jwt-rules]

### 2. Reject alg:none unconditionally

Even if you accept several signing algorithms (HS256 for some clients, RS256 for others), `none` never goes on the list. Write that into your platform's authentication standard. Current libraries (jsonwebtoken v9+, PyJWT 2+, jose) refuse `none` by default, but the explicit allowlist is still the defense-in-depth requirement.

### 3. Rotate the JWT signing secret

The signing secret may or may not have leaked. Either way, the threat model now includes "any past admin token may have been forged with no signature at all," which makes every admin action during the vulnerable window potentially attacker-driven, not just the ones from suspicious addresses.

The rotation playbook:

1. Generate a new 256-bit random secret. `openssl rand -base64 32` is fine for the value; in production, keep it in a managed secret store (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, Google Secret Manager).
2. Let the verifier accept tokens signed with either the old or the new secret for a transition window. Most libraries let you choose the key by `kid`, so both can coexist.
3. Update the issuer to sign new tokens with the new secret.
4. Wait for outstanding old-secret tokens to expire or, better, force every session to log in again.
5. Remove the old secret from the verifier.

For Vesta, coordinate this with the Friday change window already booked for the level0 API-key rotation. The two findings share a blast radius, so rotate them together.

### 4. Stop logging Authorization headers

The redaction is mechanical:

**nginx access log:**
```
log_format main_redacted '$remote_addr - $remote_user [$time_local] '
                        '"$request" $status $body_bytes_sent '
                        '"$http_referer" "$http_user_agent" '
                        '"<REDACTED>"';   # don't log Authorization
access_log /var/log/nginx/access.log main_redacted;
```

**Application-level (Node.js example with `morgan`):**
```javascript
morgan.token('redactedAuth', (req) => {
  return req.headers.authorization ? '<REDACTED>' : '-';
});
app.use(morgan(':method :url :status :res[content-length] :redactedAuth'));
```

**Log-pipeline scrubbing (Splunk example using `transforms.conf`, referenced from `props.conf` with a `TRANSFORMS-` line; it runs where data is parsed, on an indexer or heavy forwarder, not on a universal forwarder):**
```
[redact_authorization]
REGEX = ^(.*Authorization:\s*Bearer\s+)[A-Za-z0-9_.-]+(.*)$
FORMAT = $1<REDACTED>$2
DEST_KEY = _raw
```

Other pipelines have equivalents: ingestion-time transformations in a data collection rule for Sentinel and Azure Monitor, an ingest pipeline with the `redact` or `gsub` processor in Elastic, and Sensitive Data Scanner in Datadog. Pipeline scrubbing is the backstop for the day application code logs something it shouldn't.

### 5. Add SIEM detections for JWT-specific anomalies

The detections worth running:

- **Authorization headers carrying tokens with `alg: none` in the header segment.** Decode the header segment of each captured JWT and match `"alg":"none"`; it is a single correlation rule.
- **Tokens with an empty signature segment.** A bearer token ending in a dot with nothing after it is unsigned on sight.
- **Accepted requests that follow a signature-verification failure** logged by the middleware. This catches the subtler variant where verification fails but an application bug doesn't propagate the failure.
- **Unexpected `alg` values in token headers.** Any algorithm not on your accepted list should not appear in production traffic, and these alerts often catch misconfigured clients before they catch attackers.

The Sigma project publishes community-maintained detection rules: clone <https://github.com/SigmaHQ/sigma> and grep the `rules/` tree for `jwt` to see what is current.

### 6. Upgrade the JWT library

Current `jsonwebtoken` (v9.x+) refuses `alg: none` by default even without an explicit allowlist. That change arrived in v9.0.0, after these CVEs against 8.5.1 and earlier:

- **CVE-2022-23539**: legacy, insecure key types could be used for verification, for example a DSA key with RS256.[^cve-2022-23539]
- **CVE-2022-23540**: calling `jwt.verify()` without an algorithms list could default to `none` and bypass signature validation. This is Theo's bug.[^cve-2022-23540]

Both were fixed in v9.0.0. (A third ID, CVE-2022-23529, was assigned in the same round and later REJECTED as not a vulnerability, so don't carry it forward as a citation.) If Vesta's `package-lock.json` pins 8.x or earlier, that is a separate finding needing an upgrade plus regression testing.[^cve-2022-23529] The same kind of legacy-version finding exists for PyJWT before 2.0, for `node-jose` (CVE-2018-0114), and for plenty of other libraries.[^cve-2018-0114]

### 7. Authentication-platform retrofit

For a system that can rotate production credentials, admin authentication always matters, and hand-rolled JWT verification may not be the right primitive at all. Managed identity platforms handle algorithm enforcement, key rotation, session and token revocation, audit logging, and the operational discipline around all of it:

- **Auth0** (Okta-owned): JWT-native, programmable, enterprise-grade.
- **Okta Workforce Identity / Customer Identity**: the parent platform.
- **Microsoft Entra ID** (formerly Azure AD): the Microsoft-stack default.
- **AWS Cognito**: AWS-native, integrates with IAM.
- **Stytch**: developer-friendly modern auth-as-a-service.
- **WorkOS**: targeted at enterprise B2B identity flows.

The retrofit is real work, but it shrinks the surface dramatically. For a system that already uses JWTs, the path is often "swap the verifier middleware for the provider's SDK," plus a redeploy and some key-rotation coordination.

### Sample detection rule (Sigma)

An `alg: none` token is trivially recognizable before it is decoded,
because the JOSE header is base64url of a short, fixed JSON object. That
makes this one of the few authentication flaws with a reliable signature.

```yaml
title: JWT presented with the "none" algorithm
status: stable
description: >
  Detects Authorization headers carrying a JWT whose header declares
  alg "none". base64url of {"alg":"none" begins eyJhbGciOiJub25lIg,
  and of {"alg":"None" begins eyJhbGciOiJOb25lIg. Case variants exist
  because some libraries compare the algorithm name case-insensitively.
logsource:
  category: proxy
  product: nginx
detection:
  none_alg:
    cs-header|contains:
      - 'eyJhbGciOiJub25lIg'
      - 'eyJhbGciOiJOb25lIg'
      - 'eyJhbGciOiJOT05FIg'
  condition: none_alg
falsepositives:
  - Security scanners and internal penetration tests. These should be
    correlated to a scheduled engagement, and their absence from the
    schedule is itself the finding.
level: critical
```

Severity is `critical` rather than `high` because a match is not a
suspicious pattern that needs interpreting. There is no legitimate reason
for a client to present an unsigned token to an API that expects signed
ones. Every hit is either an attack or a test.

Two caveats worth carrying into the SIEM work. The rule inspects the
header the client sends, so it fires whether or not the application
accepts the token, which is what you want: rejected attempts are the
early warning. And it only sees tokens in a header the proxy logs, so
tokens moved into a cookie or a POST body need a corresponding rule
against whatever field carries them.

None of this substitutes for the fix. Until `jwt.verify` is called with an
explicit algorithms allowlist, the application is accepting forged
identities and the rule is only telling you how often.

## §7.5 — Optional exploration

The credential chain works without this section. The level hides one bonus find that fires when you run a particular command, and `progress --detail` from any prompt lists what you have unlocked.

### "Most-downloaded npm package, should be safe"

**Trigger:** `cat priya-note.md`. You ran this in step 2 of the solve, so the bonus fires there.

**What it teaches:** Priya's day-two note quotes Theo's reason for his library choice verbatim: he picked the most-downloaded JWT package because *"everyone uses it, should be safe."* Engineers say this all the time, and it blurs two separate properties:

- **Popularity is a useful signal for maintenance, security attention and supply-chain risk.** A library with a million weekly downloads tends to have more eyes on it than one with a thousand, and its vulnerabilities tend to be found, patched and disclosed faster. That is a real reason to prefer popular libraries.
- **Popularity says nothing about whether *you* configured the library correctly.** Theo's bug is not really in `jsonwebtoken`; it is his two-argument `jwt.verify()` call on an old version whose default for a missing allowlist was to accept `alg: none`. On a current version of any popular JWT library the default would have protected him. On the version he pinned, the default was the bug.

The pattern in consulting work: *the library is rarely the bug; the integration is*. CWE-1188 (Initialization of a Resource with an Insecure Default) names the family, and it runs well beyond JWTs, through OAuth misconfigurations, public S3 buckets and permissive TLS contexts.[^cwe-1188] The fix is rarely "switch libraries". It is "audit the integration."

For JWT specifically, **always pass the `algorithms` parameter on every `verify()` call.** Current `jsonwebtoken` is stricter, but Theo's pinned dependency is not current, and even on 9.x it is the configuration discipline that protects you, not the version number. Pin behavior, not versions.

## §8 — Key takeaways

- **The original sin of JWT verification is letting unauthenticated input pick the algorithm.** A token's `alg` header is data. The verifier decides which algorithms it accepts, and anything looser is the `alg: none` and key-confusion class waiting to happen. RFC 8725 Section 3.1 is explicit: libraries MUST let the caller specify the supported algorithms and MUST NOT use any others.

- **JWT payloads are not confidential.** They are base64url, not encrypted. JWS, the signed form most systems use, gives integrity but not confidentiality, so anything in the payload, including a credential someone "stashed" in a claim, is readable by whoever holds the token. Confidentiality needs JWE, a different envelope.

- **Modern libraries refuse `alg: none` by default, and that is not enough.** The explicit allowlist is still the defense-in-depth requirement. The moment your code pins an old library, accepts an attacker-influenced algorithms list or trusts a `jku` URL it didn't validate, the attack is back.

- **Audit logs that capture Authorization headers are credential dumps in disguise.** Anyone who can read the log can replay any token in it. Redact at the proxy, in the application and in the log pipeline, because application code that should never log a credential will eventually do exactly that.

- **For PCI-DSS-scoped admin APIs, hand-rolled JWT verification is a risk you don't have to take.** Managed identity platforms (Auth0, Okta, Entra, Cognito, Stytch) handle algorithm enforcement, key rotation, session revocation and audit logging with a discipline that is hard to match in-house. The retrofit cost is finite; the long tail of self-managed verification bugs is not.

- **Theo's pattern is not unique to Theo.** Engineers writing their first auth middleware reach for the most-downloaded library, copy the two-argument verify example from the README, and ship. The platform answer is cheap: a code-review checklist line ("does this verify call specify algorithms?") and a Semgrep rule in CI that fails the build on a two-argument `jwt.verify`. Neither requires the junior engineer to understand the full depth of the mistake, only to follow the guardrail until they do.

- **The same lesson runs through the whole track.** Level 0 was "I base64-encoded the secret, so it's protected." Level 1 is "I put the auth in a JWT, so it's authenticated." Level 2 pulls the next thread. The shared diagnosis: a real cryptographic primitive does what the engineer thought they were doing, and the engineer used something else.

## §9 — Further reading

*Last reviewed: August 2026, links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^rfc-7519]: [RFC 7519 — JSON Web Token (JWT)](https://datatracker.ietf.org/doc/html/rfc7519). The foundational JWT specification. Section 4 covers claims; Section 6 covers unsecured JWTs (alg:none); Section 7 covers creating and validating tokens.
[^rfc-7515]: [RFC 7515 — JSON Web Signature (JWS)](https://datatracker.ietf.org/doc/html/rfc7515). The signature-format spec underlying JWT. Section 5 covers signing and verification procedures.
[^rfc-7516]: [RFC 7516 — JSON Web Encryption (JWE)](https://datatracker.ietf.org/doc/html/rfc7516). The encryption variant. Use JWE (not JWS) when you need the payload to be confidential.
[^rfc-8725]: [RFC 8725 — JSON Web Token Best Current Practices](https://datatracker.ietf.org/doc/html/rfc8725). The BCP document specifically for JWT security. Section 3 is the operational meat — read 3.1 through 3.12 in order.
[^nist-800-63b]: [NIST SP 800-63B Rev. 4 — Digital Identity Guidelines: Authentication and Authenticator Management](https://csrc.nist.gov/pubs/sp/800/63/b/4/final). Published July 2025; supersedes the 2017 edition. Covers token lifecycle, authenticator selection, AAL tiering.
[^cwe-347]: [CWE-347: Improper Verification of Cryptographic Signature](https://cwe.mitre.org/data/definitions/347.html). The primary weakness for JWT alg:none and signature-skipping patterns.
[^cwe-345]: [CWE-345: Insufficient Verification of Data Authenticity](https://cwe.mitre.org/data/definitions/345.html). The parent weakness.
[^cwe-287]: [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html). The umbrella authentication-bypass weakness.
[^cwe-532]: [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html). The secrets-in-logs finding.
[^cwe-540]: [CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html). Useful framing for the JWT-payload-as-credential-envelope sub-pattern.
[^tim-mclean-critical-vulnerabilities-in]: [Tim McLean, "Critical vulnerabilities in JSON Web Token libraries" (Auth0 blog guest post, March 2015)](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/). The original alg:none and RS→HS disclosure; a decade later still the canonical reference for the algorithm-confusion family. McLean was an independent researcher at the time.
[^cve-2015-2951]: [CVE-2015-2951 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2015-2951). The php-jwt alg:none variant from McLean's disclosure — `jwt_tool` and most tooling cite this CVE for alg:none.
[^cve-2015-9235]: [CVE-2015-9235 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2015-9235). The node-jsonwebtoken RS→HS key-confusion variant from the same disclosure.
[^cve-2018-0114]: [CVE-2018-0114 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2018-0114). The node-jose embedded-`jwk` key-injection disclosure (Cisco).
[^pci-dss-v4-0-1]: [PCI-DSS v4.0.1 full text (PCI Security Standards Council)](https://www.pcisecuritystandards.org/document_library/). Free registration required. The Requirement 6 and 8 sections cover authentication and secure coding directly.
[^nist-800-53]: [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). The IA, SC, AC, and AU control families cover the controls cited above.
[^owasp-top-10-2025]: [OWASP Top 10 (2025)](https://top10.owasp.org/). The current edition.
[^owasp-api-security-top-10]: [OWASP API Security Top 10 (2023)](https://api-security.owasp.org/editions/2023/en/0x00-header/). The API-focused companion. Last updated in 2023; the 2025 cycle is in draft.
[^owasp-jwt-cheat-sheet]: [OWASP JWT Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html).
[^semgrep-registry-jwt-rules]: [Semgrep registry — JWT rules](https://semgrep.dev/r/?q=jwt). Community-maintained static-analysis rules for the JWT misconfiguration patterns.
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-pentest-plus]: [CompTIA PenTest+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/pentest/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^cert-oswe]: [OffSec WEB-300 / OSWE — course syllabus](https://www.offsec.com/courses/web-300/).
[^cert-gwapt]: [GIAC GWAPT — Web Application Penetration Tester](https://www.giac.org/certifications/web-application-penetration-tester-gwapt).
[^cwe-863]: [CWE-863](https://cwe.mitre.org/data/definitions/863.html).
[^cwe-200]: [CWE-200](https://cwe.mitre.org/data/definitions/200.html).
[^cwe-1188]: [CWE-1188](https://cwe.mitre.org/data/definitions/1188.html).
[^cve-2022-26134]: [CVE-2022-26134 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2022-26134).
[^cve-2022-23539]: [CVE-2022-23539 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2022-23539).
[^cve-2022-23540]: [CVE-2022-23540 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2022-23540).
[^cve-2022-23529]: [CVE-2022-23529 (NVD)](https://nvd.nist.gov/vuln/detail/CVE-2022-23529).
[^rfc-4648]: [RFC 4648 — RFC 4648 - The Base16, Base32, and Base64 Data Encodings](https://datatracker.ietf.org/doc/html/rfc4648).

### Further reading

- [OAuth 2.0 Security Best Current Practice (RFC 9700)](https://datatracker.ietf.org/doc/html/rfc9700). The 2025 BCP for OAuth 2.0 (replaces the older draft-ietf-oauth-security-topics). Relevant because JWT is the dominant OAuth 2.0 access-token format.
- [MITRE ATT&CK T1550.001 — Use Alternate Authentication Material: Application Access Token](https://attack.mitre.org/techniques/T1550/001/).
- [MITRE ATT&CK T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
- [MITRE ATT&CK T1212 — Exploitation for Credential Access](https://attack.mitre.org/techniques/T1212/).
- [`jwt_tool` (ticarpi)](https://github.com/ticarpi/jwt_tool). The defacto JWT-attack toolkit. Supports alg:none confusion, RS→HS key confusion, jku/x5u injection, HMAC-secret brute-force, kid injection, and several other patterns.
- [`hashcat` mode 16500 (JWT HS256)](https://hashcat.net/wiki/doku.php?id=example_hashes). Brute-force JWT HMAC secrets on GPU.
- [jwt.io (Auth0)](https://www.jwt.io/). Browser-based JWT decoder. Useful for ad-hoc inspection; do NOT paste tokens from production systems into the public site (the site does not transmit the token off-machine in modern versions, but the discipline is "decode locally").
- [Sigma rules — JWT detections](https://github.com/SigmaHQ/sigma). Search the repo for `jwt` or `alg`.
