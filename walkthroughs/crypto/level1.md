# level1@crypto — Theo's Signature That Wasn't

**Track:** Crypto · **Client:** Vesta Retail · **Compliance regime:** PCI-DSS v4.0.1 · **Builds on:** [`level0@crypto`](/walkthroughs/#/crypto/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@crypto`. If you haven't solved `level1@crypto` yet, close this tab and come back after. The puzzle is much more satisfying without spoilers, and the post-mortem below makes considerably more sense once you've felt the moment yourself.

---

## §1 — The setup

When you left the lobby at the end of `level0@crypto`, Vesta Retail had a tidy little incident on its hands. You'd filed the finding: Theo's commit moved the production payment-card-processor API key into a base64-encoded file and called it protection. Saanvi, Vesta's CTO, took the report, scheduled the rotation for the next change window (Friday), and Theo had a friendly, well-handled pre-meeting with Priya — Driftwood's senior consultant on the Vesta engagement. Theo, to his credit, took the news the way you want junior engineers to take this kind of news: he asked questions, wrote down the answers, and started reading RFC 4648 the same afternoon.

It was at the end of that conversation that he mentioned, almost in passing, a second project.

He'd been working on Vesta's internal admin API. The endpoints were the back-office tools — secret rotation, audit-log queries, a one-off "rotate this credential without paging the on-call" workflow — used by a small set of engineers and one or two scheduled jobs. Three weeks ago he'd shipped a new auth model for it: stateless JWTs. The previous auth was a session cookie backed by Redis; the new auth was "a quick token-based thing" using "the most-downloaded JWT library on npm." Theo's words. He thought Priya would like it because it was more modern.

Priya did not respond with the enthusiasm Theo expected. Instead she asked him to send her the verify middleware and a recent sample of the admin-API access log. The "you and I are going to look at this together tomorrow" tone wasn't lost on Theo, but he sent the artifacts over before end of day and went home to reread the JWT specs. Both artifacts are in the audit directory.

The legal frame for what you're about to do is the same as yesterday's. Saanvi authorized a controlled use of the live API key (the one Theo base64-encoded — still unrotated until Friday) for a one-time blast-radius check. Today's check uses that authorization to ssh into the payment-deploy service host, where the admin-API access logs are mirrored for observability. Your prompt reads `vesta-deploy@crypto:~$`. The same rules of engagement apply: read what's there, document what you find, don't pivot, don't forge anything, get out.

Vesta Retail's compliance regime is PCI-DSS v4.0.1. They're a Level 2 merchant (1M–6M transactions/year, scaled up from Level 3 in 2024), which means an annual self-attested SAQ D and a Qualified Security Assessor on-site review every other year. The next QSA review is six weeks out. The admin API in question is in scope for that review because it calls the secret-rotation machinery for the cardholder-data environment — anything that authenticates a caller into actions on the CDE is, by definition, in scope for the authentication requirements (Req 8) and the secure-coding requirements (Req 6.2).

What you don't know yet, walking in, is that Theo's "quick token-based auth" rejects almost nothing. Any caller — authenticated or not, employee or attacker — can craft a JWT that says `role: admin`, set the algorithm header to `none`, and Theo's verification middleware will accept it as if it were properly signed and authorized.

## §2 — The solve

The puzzle path is short. Two files to read, one command to run on one extracted token.

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

You used the still-live API key from `level0@crypto` — the value `vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3` recovered by `base64 api-key.b64` in level 0. The same access an attacker pulling the same key from Vesta's repo would have. The same access that prompted Saanvi to schedule the Friday rotation. You're sitting on `payment-deploy.vesta.internal`, where the admin-API logs are mirrored for observability.

### Step 2: Read the day-two context

```bash
vesta-deploy@crypto:~$ ls
admin-access.log     priya-note.md         verify-middleware.js
lessons-learned.md   welcome.md
```

Five files. Read them in order.

`welcome.md` is the mechanics introduction — it covers what a JWT is, what its three segments do, and what the `jwt` command does when you run it against a token. `priya-note.md` is the in-character handoff: the day-two context, what Theo said about the new auth model, what Priya wants you to check, the rules of engagement, and the PCI-DSS hooks. `verify-middleware.js` is the verification code Theo wrote — fifteen lines, including imports. `admin-access.log` is the recent admin-API access log Theo sent over for review. `lessons-learned.md` is what you'll read after you find what's there.

The critical pieces to extract before you do anything else:

- **The new tool**: `jwt <token>` decodes a JSON Web Token, prints the header and payload (both base64url-encoded inside the token), and surfaces common red flags — algorithm confusion (`alg: none`), empty signatures, expired tokens.
- **The legal frame**: same as yesterday. Reconnaissance only; don't forge a new token; don't call any admin endpoints.
- **The shape of the suspicion**: Priya doesn't say "Theo's auth is broken." She says "the same class of mistake as yesterday — confusing one cryptographic primitive for another, or applying one with the wrong parameters — shows up everywhere in junior engineers' first crypto-adjacent code." That framing is the prep — you're walking in expecting to find a mistake of that shape.

### Step 3: Read Theo's verify middleware

```bash
vesta-deploy@crypto:~$ cat verify-middleware.js
```

Fifteen lines of code. The relevant snippet:

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

The vulnerability lives on the line where Theo calls `jwt.verify(token, SIGNING_SECRET)` with exactly two arguments. The `jsonwebtoken` library's `verify()` function accepts a third `options` object where you can tell it which algorithms are acceptable: `jwt.verify(token, secret, { algorithms: ['HS256'] })`. When you omit that options argument, what happens depends on the library version, but historically — and still on enough deployed code to matter — the library reads the `alg` field from the token's header and dispatches to whichever verification routine that algorithm names.

A token claiming `alg: none` asks for verification to be skipped. The library obliges. The verifier accepts the token.

Theo's code comment reads: *"The library reads the alg from the token header so we can rotate signing algorithms later without touching client code."* That sentence is the textbook description of what NOT to want. The convenience that allows server-side algorithm rotation without client coordination is the exact mechanism that allows an attacker to send a token with `alg: none` and have the server honor it.

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

**First**: the log is debug-level verbose. It records the full `Authorization` header value, including the JWT itself. This is its own finding — debug logging that captures auth headers means anyone with read access to the log can replay any token in it. The fact that this log exists in this form, accessible from a payment-deploy host, is CWE-532 (Insertion of Sensitive Information into Log File) and a violation of PCI-DSS Requirement 10.3.1 (read access to audit logs is limited to those with a job-related need) and 10.3.2 (audit logs are protected from modification).

**Second**: the `verify-middleware loaded (jsonwebtoken @ default options)` line at startup is a tell. The library was loaded with no global options object. If the application code also calls `jwt.verify()` without an options object — and it does, you just read it — then nothing is constraining which algorithms will be accepted.

**Third**: the token is reused. The same caller hits two endpoints with the same JWT. JWTs are stateless precisely so they can be reused this way, but the reuse pattern means a single token disclosure has the blast radius of every request that token can authorize, not just the request the attacker observed.

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

Read the output carefully.

The **header** announces `alg: none`. This is a token that asks not to be verified. The fact that the access log shows the application accepted it and dispatched to `rotateSecret()` confirms the verification was indeed skipped. The vulnerability is not theoretical; you're reading evidence that it has been exercised.

The **payload** is the claim set. It carries `role: admin`, `scope: "*"`, and `actor: theo@vesta.example` — the access controls the application is supposed to enforce on the basis of this verification it didn't perform. It also carries a `handoff_token` field with the value `vesta-admin-handoff-2026`. That's a credential. It's in a JWT payload because, apparently, someone needed to pass the value along inside a token and decided the JWT envelope was a convenient place to put it. JWT payloads are base64url-encoded, not encrypted; anyone who reads the token can read the field. This is the level2 breadcrumb, and it's there because the JWT format invites this anti-pattern — payloads look opaque to humans skimming a log, but they're trivially decoded.

The **signature segment** is empty. The decoder flags it; the access log records the application accepting it; the middleware code makes both observations consistent.

The **expiration** is ten years out (2036-04-09). Long-lived service tokens are themselves a finding under modern token-management guidance (NIST SP 800-63B-4 §5 *Session Management* covers session-token lifecycle and refresh patterns), but the primary finding here is the missing signature verification.

### Step 6: Document and stop

Per Priya's rules of engagement, you do not now construct a new alg:none token of your own to test what other actions the admin API will accept. You do not query the `/admin/audit-bypass-tokens` endpoint to enumerate other tokens. What you do is write up exactly what the audit found.

The minimum report content:

1. **The admin-API JWT verifier accepts unsigned tokens.** `verify-middleware.js` calls `jwt.verify(token, SIGNING_SECRET)` without an algorithms whitelist. Tokens with `alg: none` in the header are accepted and their claims trusted.
2. **The vulnerability is being exercised in current traffic.** The access log shows a token with `alg: none` driving a `rotateSecret(target=payment-api-key)` action. Whether that traffic is legitimate (Theo's own service calling its own API with a poorly-configured client) or unauthorized cannot be determined from the log alone.
3. **The admin-API access log records Authorization headers.** Any party with read access to the log can recover and replay live JWTs. This is independent of the verification finding and would be a CWE-532 / PCI-DSS Req 10.3.1 + 10.3.2 finding even if the verification were correct.
4. **A live credential is published in a JWT payload.** The `handoff_token` claim contains `vesta-admin-handoff-2026`. Anyone who decoded the JWT — from the log, from a captured request, from a leaked client SDK — has the credential.
5. **The signing secret should be considered compromised.** Independent of whether anyone has actually exfiltrated it, the threat model now includes "any historical admin action could have been driven by a forged token, not just authenticated ones." Rotation is required as part of the incident response.

Send the report to Priya. She'll route it to Saanvi with yesterday's report attached. Exit the level.

```bash
vesta-deploy@crypto:~$ exit
```

### Step 7 (game-world only): Use the breadcrumb

In a real engagement, today ends here. In D3CYPH3R the credential chain continues into `level2@crypto`, where the `handoff_token` you extracted becomes the entry point.

```bash
guest@d3cyph3r:~$ ssh level2@crypto
level2@crypto's password: vesta-admin-handoff-2026
```

`level2@crypto` is playable, and its walkthrough picks up from here.

## §3 — The vulnerability

Today's finding looks like a single missing argument on a single function call. It's actually three failures stacked.

### Failure 1: The verifier accepts `alg: none` (CWE-347)

`jwt.verify(token, secret)` without an algorithms whitelist allows the JWT's own `alg` header to dictate what verification means. A token with `alg: HS256` is verified against the shared secret as HMAC-SHA256. A token with `alg: RS256` is verified against a public key as RSA-SHA256. A token with `alg: none` is "verified" by skipping the signature check entirely — the verifier reads the payload, trusts the claims, and returns success.

This is CWE-347, *Improper Verification of Cryptographic Signature*. The catalog entry describes the weakness as "the product does not verify, or incorrectly verifies, the cryptographic signature for data." The application's verification step exists; it returns success; the success has no cryptographic meaning. The signature was never checked.

CWE-347 is the canonical weakness ID for signature-verification failures, with MITRE mapping status ALLOWED. It isn't currently on the CWE Top 25 list (the Top 25 entries that most often fire on JWT misconfigurations are CWE-287 *Improper Authentication* and CWE-863 *Incorrect Authorization*, both Top-25 regulars). The CWE-347 pattern persists at internet scale because JWT-based authentication has spread far faster than the operational knowledge of how to verify JWTs safely. Every framework's quickstart guide shows the two-argument `verify` call; the three-argument options pattern is documented but routinely omitted.

The disclosure that introduced the JWT-library community to the alg:none and RS→HS attack families was Tim McLean's March 2015 Auth0 blog post, *"Critical vulnerabilities in JSON Web Token libraries."* McLean was an independent security researcher at the time; the post was a guest piece. The disclosure was tracked across multiple per-library CVE assignments — **CVE-2015-2951** for the php-jwt alg:none case, **CVE-2015-9235** for the node-jsonwebtoken RS→HS key-confusion case, and similar per-library numbers for the rest. The libraries patched, mostly by changing the default behavior to reject alg:none in the absence of an explicit whitelist. The vulnerability is back the moment any operator passes an empty array as `algorithms`, manually allows `none`, uses an older library version, or — most commonly — writes new code that doesn't pass an options object at all.

### Failure 2: The token payload contains a live credential (the JWT-as-confidential-envelope mistake)

The JWT payload carries `handoff_token: "vesta-admin-handoff-2026"`. Whoever wrote that claim treated the JWT as a confidential envelope — a place where a credential could be "carried" alongside the role and scope claims, presumably to avoid a separate secret-management workflow for the handoff.

JWT payloads are not confidential. RFC 7519 is explicit on this: the payload is base64url-encoded, which is reversible by anyone in possession of the token. The signed-token variant (JWS, RFC 7515) provides *integrity* — you can't change the claims without invalidating the signature — but not *confidentiality*. For confidentiality, the spec requires JWE (JSON Web Encryption, RFC 7516), which is a separate, more complex envelope.

Most production deployments of JWTs use the JWS form. Most JWT tutorials demonstrate the JWS form. Many engineers learn that the JWT is "encoded" and reach the incorrect conclusion that it's also "encrypted." It isn't. Anything in a JWT payload is readable by anyone who holds the token, anyone who can pull the token from a log, anyone who intercepts the network call, and anyone who sees the token in a debug dump.

This sub-failure maps to **CWE-540** *Inclusion of Sensitive Information in Source Code* (in spirit; the literal CWE-540 entry is source code, but the principle "sensitive data should not be placed in artifacts whose access control is not credential-grade" carries through). The narrower mapping is to the broader CWE-200 family, with the standard caveat that CWE-200 carries a "Discouraged for mapping" status in the current MITRE catalog.

### Failure 3: The admin-API log captures Authorization headers (CWE-532)

The access log records full `Authorization` headers at DEBUG level. The application is, in the same line, writing a credential and a record of its acceptance — and storing both in a file that anyone with read access to the deploy host can `cat`.

This is **CWE-532** *Insertion of Sensitive Information into Log File*. The CWE catalog entry is direct: "information written to log files can be of a sensitive nature and give valuable guidance to an attacker or expose sensitive user information." Authorization headers are the canonical example.

The fix is mechanical: redact the `Authorization` header at the proxy or middleware layer (modern WAF and API-gateway products all support header redaction; nginx's `log_format` directive supports it; OpenResty and Caddy do too; Splunk Universal Forwarder, Elastic Filebeat, Sentinel Azure Monitor Agent, and Datadog Agent all support log-scrubbing transforms on the pipeline side as a defense-in-depth backstop). The harder discipline is the rule that the application never writes a credential to its own logs in the first place — the redaction is a backstop, not the design.

### The compound effect

Each failure in isolation is a finding. Compound them, and you get today's level.

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

The mitigation tracks each failure independently:

- For failure 1: pass `{ algorithms: ['HS256'] }` to every `jwt.verify` call. Audit-grep the codebase for the two-argument form; fix every hit.
- For failure 2: move the handoff token to a real secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.). Rotate the current value. The JWT payload contains claims about the session; it does not contain other credentials.
- For failure 3: redact `Authorization` headers in the log pipeline. The application should never log the header value directly; if debug logging is needed, write only `"Authorization: Bearer <REDACTED>"`.

Each fix is mechanical. The discipline that prevents the next instance is the same in all three cases: the engineer writing the code understands what the library actually does when called without the safety arguments. RFC 8725 — JSON Web Token Best Current Practices — is the document you would print and hand to Theo.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Vesta's internal admin API, whose verify middleware calls `jwt.verify` with no algorithms allowlist |
| Consequence | Tokens presented with `alg: none` are accepted, so anyone who can craft JSON can mint an administrative identity |
| Authentication required | None. This is not a stolen credential, it is the absence of a check |
| Also disclosed | A debug log recording a token being replayed by the same caller |
| Escalates to | `level2@crypto` |
| Regime | PCI-DSS v4.0.1 — contractual, not statutory; notification runs to the acquirer and card brands |

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

JWT verification failures are one of the most consistently exploited classes of authentication vulnerabilities in modern web apps. The history is short — JWT itself is a 2015 standard (RFC 7519 was published in May 2015) — but dense.

### Thread 1: The McLean Auth0 disclosure (2015)

In late 2014, independent security researcher Tim McLean was reviewing several popular JWT libraries and noticed that they shared a vulnerable pattern: their `verify()` functions read the algorithm from the token's header and dispatched to the corresponding verification routine without checking whether the caller had asked them to do so. McLean documented two attacks against this pattern:

1. **alg:none confusion**: a token with `alg: none` in the header is dispatched to a "no signature" verification path that returns true. This is the attack you just walked through in `level1@crypto`.
2. **RS256→HS256 key confusion**: a token with `alg: HS256` is dispatched to an HMAC-SHA256 verification path that uses the server's *public key* as the HMAC secret. Since RSA public keys are, well, public, the attacker can compute a valid HMAC and produce a token the server will accept as legitimately signed.

Both attacks were published in McLean's March 2015 guest post on the Auth0 blog, *"Critical vulnerabilities in JSON Web Token libraries."* The disclosure was tracked across multiple per-library CVE assignments rather than a single multi-library CVE — **CVE-2015-2951** for the php-jwt alg:none variant, **CVE-2015-9235** for the node-jsonwebtoken RS→HS confusion, and similar per-library numbers for the rest. The libraries patched, mostly by changing default behavior to reject alg:none when no algorithm is whitelisted. McLean's blog post is, a decade later, still the canonical reference for the algorithm-confusion family of attacks.

The lesson from the McLean disclosure is the lesson Theo's middleware demonstrates: the original sin of JWT verification is letting unauthenticated input (the token header) dictate verification behavior. Every modern best-practice document — RFC 8725, the OWASP JWT cheat sheet, the OAuth 2.0 Security BCP — recommends the same defense: the verifier specifies what algorithms are acceptable; the token's claim is checked against that list and rejected if it doesn't match.

### Thread 2: Key-injection attacks — CVE-2018-0114 and the jku/x5u family

JWTs can carry their verification key in the token itself, or specify it by reference. The JWS header defines several fields for this:

- **`jwk`** (JSON Web Key): an embedded public key in the header itself.
- **`jku`** (JWK Set URL): a URL where the verifier can fetch the JSON Web Key Set that signed this token.
- **`x5u`** (X.509 URL): a URL where the verifier can fetch the X.509 certificate that signed this token.

The intended use case for the URL-fetching variants: a multi-tenant identity provider issues tokens signed with per-tenant keys; the header includes a URL the verifier can use to fetch the right public key. The intended security model: the verifier restricts fetches to a trusted domain (or doesn't honor these headers at all and resolves keys from a configured trust store).

The vulnerability class: a library that trusts the token's claimed verification key. **CVE-2018-0114** is the canonical disclosure here — Cisco's `node-jose` library accepted a `jwk` header (embedded public key) and verified the signature against the attacker-supplied key. The attack: strip the original signature, embed your own public key in the header, sign with the matching private key, send. The verifier validates against the key the attacker provided.

The `jku` / `x5u` URL-fetching variants are related but distinct attacks tracked under their own per-library CVEs over the years. The shared pattern is the same: any header field that lets the token influence the choice of verification key is a vector unless the verifier strictly constrains it.

The fix is the same shape as the alg:none fix: the verifier specifies what keys are acceptable from a configured trust store; the token's claims about its key are matched against that store, not used to fetch new material.

### Thread 3: Weak HMAC secrets — and the published cracking tools

Even when JWT verification is correctly configured to require HS256, the security of the resulting signature depends entirely on the strength of the HMAC secret. If the secret is short, dictionary-derived, or otherwise guessable, an attacker who captures any one signed token can brute-force the secret offline and then forge arbitrary new tokens.

The tooling for this is mature and freely available. The most-cited tool is **`jwt_tool`** by ticarpi (<https://github.com/ticarpi/jwt_tool>), which supports alg:none confusion, RS→HS key confusion, jku/x5u injection, and HMAC-secret brute-forcing via `hashcat` mode 16500 or its own dictionary attack. **`hashcat`** itself ships with first-class JWT support (`-m 16500`). On commodity GPU hardware, dictionary attacks against unsalted HMAC-SHA256 with a weak secret complete in seconds.

The Auth0 security blog has published several writeups over the years tracking weak-secret-driven JWT compromises in customer environments. The pattern is consistent: the application developer picked a "memorable" secret for early development, never replaced it with a high-entropy production value, and shipped to production with the dev secret intact. The fix is well-documented (use a 256-bit cryptographically random secret; rotate periodically; consider RS256 with hardware-backed keys for high-value applications) and the failure rate in industry surveys remains depressingly high.

### Thread 4: Notable named incidents (recent)

JWT misconfigurations rarely make front-page news on their own — they tend to be one finding among many in a larger breach disclosure. Recent named incidents where JWT-class issues played a documented role include:

- **Atlassian Confluence (CVE-2022-26134, June 2022)**: a server-side template injection (technically an OGNL injection) in Confluence Data Center and Server allowed unauthenticated RCE. Volexity discovered and disclosed the vulnerability during a Memorial Day incident response. The disclosure itself isn't a JWT story (the documented post-exploitation included BEHINDER implants and JSP webshells, not token forgery) — it's included here to contrast: pre-auth RCE is the catastrophic-but-rare initial-access vector; broken JWT verification is the small-but-routine version of "an attacker can act as an admin without being one." Both end in the same place; only one requires a discovered RCE.
- **Okta support-system breach (October 2023)**: Okta (not Auth0 — Auth0's own support system was explicitly reported unaffected) disclosed that an attacker had abused a service account in the support-case-management system. The initial-access vector was credentials saved by an Okta employee to a personal Google account. HAR files in support cases contained session tokens which were used to hijack five customer sessions. The shape that maps to today's level: a service-account credential ended up where it shouldn't have, and session-token material captured in support-case artifacts was reusable. The general pattern — credentials and tokens in the wrong artifact — is the same shape as Theo's `handoff_token` claim in a JWT payload.
- **Various HackerOne disclosures**: HackerOne's public bug-bounty platform has hundreds of disclosed JWT-related vulnerabilities across well-known vendors. Search the platform for `alg:none` or `jwt` for the current list. The recurring pattern is "the vendor's authentication library was correctly configured for the main API but a secondary admin endpoint was using the same library with a different (vulnerable) configuration." Theo's pattern.

The named incidents are useful for setting context, but the more important point is the *base rate*: JWT misconfigurations are routine findings in penetration tests across industries, with reporting volume that suggests the actual rate of vulnerable deployments is substantially higher than the rate of disclosed incidents.

## §5 — Frameworks, deep dive

The post-mortem at the bottom of the level (`lessons-learned.md`) walks through the high-level framework mapping. This section expands each with the specific section / control / paragraph identifiers a compliance auditor would cite, plus the exact remediation language each framework expects.

### CWE — Common Weakness Enumeration

**CWE-347: Improper Verification of Cryptographic Signature.** The primary weakness for the alg:none failure. The catalog entry describes the weakness as "the product does not verify, or incorrectly verifies, the cryptographic signature for data." MITRE mapping status: **ALLOWED** — it's a valid weakness ID for analytics and reporting. CWE-347 is the canonical ID for JWT signature-verification failures even though it isn't currently on the CWE Top 25 — the Top 25 weaknesses most often fired on JWT findings are CWE-287 *Improper Authentication* and CWE-863 *Incorrect Authorization*.

**CWE-345: Insufficient Verification of Data Authenticity.** The parent weakness in the CWE hierarchy. Use when the specific failure mechanism (signature verification, MAC verification, etc.) isn't the point being made; CWE-347 is the narrower fit when the failure is specifically about a cryptographic signature.

**CWE-287: Improper Authentication.** The umbrella authentication-bypass weakness. Map this when the question is "the wrong people got authenticated"; map CWE-347 when the question is "the signature verification step is broken."

**CWE-532: Insertion of Sensitive Information into Log File.** The secondary weakness — the admin-API log records full `Authorization` headers including JWTs. MITRE mapping status: **ALLOWED**. The catalog entry's mitigations include "do not write sensitive data to log files" (yes, really, that direct) and "if logging sensitive data is unavoidable, ensure the log files are themselves restricted-access."

**CWE-540: Inclusion of Sensitive Information in Source Code.** The literal entry is about source code, but the principle — "credentials should not appear in artifacts whose access control is not credential-grade" — applies to the JWT-payload-as-credential-envelope case here. Use as a secondary citation when discussing the `handoff_token` claim.

### PCI-DSS v4.0.1

The current revision of the Payment Card Industry Data Security Standard (released June 2024, supersedes v4.0 from March 2022). Vesta Retail is a Level 2 merchant subject to the full SAQ D scope.

**Requirement 6.2.4 — Software engineering techniques to prevent or mitigate common software attacks.** The control covers secure coding practices for bespoke and custom software, including authentication-related weaknesses. Algorithm-confusion attacks fit cleanly under the OWASP-Top-10-aligned attack categories the requirement references. Theo's middleware fails this requirement directly.

**Requirement 6.4.1 — Public-facing web applications addressed for vulnerabilities.** Public-facing applications must be reviewed for vulnerabilities (annual ASV scans plus methodology-driven reviews). Admin APIs that authenticate using JWTs are in scope when reachable from any network the application reaches. A vulnerability scan that misses a JWT verifier accepting alg:none indicates a methodology gap.

**Requirement 8.3.2 — Strong cryptography during transmission and storage of authentication factors.** An unsigned JWT is not "strong cryptography" in any meaningful sense; it is the absence of cryptography in a wrapper that resembles cryptography. When such tokens are used as authentication factors, the control is failed.

**Requirement 10.3.1 — Read access to audit logs is limited to those with a job-related need.** And **Requirement 10.3.2 — Audit log files are protected to prevent modifications by individuals.** (Both requirements live in v4.0.1's Section 10.3; v3.2.1 used the older 10.5.x numbering, which still appears in legacy documentation.) The admin-API log file containing recoverable JWTs is the artifact in scope. The fact that JWTs in the log can be replayed for live admin actions makes the access-control failure equivalent to giving the same admin actions away to anyone who can read the file.

### NIST SP 800-53 Rev. 5

NIST Special Publication 800-53 Revision 5 (the federal control catalog; widely cited outside federal scope as the most comprehensive controls reference).

**IA-2 — Identification and Authentication (Organizational Users).** The system must uniquely identify and authenticate users. Accepting alg:none tokens defeats this control because the "identity" claimed by the token is not actually verified.

**SC-8 — Transmission Confidentiality and Integrity.** Covers the integrity of authentication-bearing transmissions. A JWT whose signature is not verified provides neither confidentiality nor integrity for the authentication claim it carries.

**AU-9 — Protection of Audit Information.** The secrets-in-logs half. AU-9 requires that the system protect audit information from unauthorized access, modification, and deletion. The admin-API log with full Authorization headers is the audit artifact in scope.

**AC-3 — Access Enforcement.** The system must enforce approved authorizations for logical access. The verification middleware enforces nothing on a token with alg:none; the access is approved by virtue of the unverified `role: admin` claim. The control is failed.

### OWASP

**OWASP Top 10 (2025) — A07: Authentication Failures.** The umbrella category for authentication-related vulnerabilities. The 2025 edition retained the A07 slot from the 2021 edition; the category was renamed (from "Identification and Authentication Failures" in 2021 to simply "Authentication Failures" in 2025) but the substance is the same. JWT-specific failures are named in the category description.

**OWASP Top 10 (2025) — A02: Security Misconfiguration.** Applies to the missing algorithms whitelist as a misuse of an otherwise-correctly-implemented JWT library. The 2025 reshuffle moved Security Misconfiguration up from A05 (in the 2021 list) to A02 (in 2025).

**OWASP API Security Top 10 (2023) — API2: Broken Authentication.** OWASP's API-specific Top 10 (last updated in 2023) covers JWT misuse explicitly. The category description names alg:none confusion, weak HMAC secrets, and missing token-revocation infrastructure as the most common manifestations.

**OWASP JWT Cheat Sheet.** A focused defender-side reference (<https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html>). It began life as a Java-specific sheet and has since been generalised, so the guidance now reads language-agnostically. Contains the explicit instruction: "Always specify the algorithm to use to verify the signature." The language-agnostic complement is OWASP's WSTG chapter on testing JSON Web Tokens (<https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/06-Session_Management_Testing/10-Testing_JSON_Web_Tokens>).

### RFCs

**RFC 7519 — JSON Web Token (JWT).** The foundational specification. Section 4.1.1 covers the `alg` header parameter; Section 6 defines the "Unsecured JWT" form (`alg: none`); Section 7.2 (Validating a JWT) is where the normative guidance lives: *"unless the algorithms used in the JWT are acceptable to the application, it SHOULD reject the JWT."* (The stronger MUST-language for rejection lives in RFC 8725 §3.1; RFC 7519 itself only mandates SHOULD.) Theo's middleware violates this guidance.

**RFC 7515 — JSON Web Signature (JWS).** The signature-format specification underlying JWT. Section 5.2 covers signature verification; step 8 requires that the JWS Signature be validated "in the manner defined for the algorithm being used, which MUST be accurately represented by the value of the 'alg' (algorithm) Header Parameter, which MUST be present." Section 4.1.1 (the `alg` header parameter) adds that the algorithm value MUST be one the implementation supports.

**RFC 8725 — JSON Web Token Best Current Practices.** The BCP document specifically dedicated to JWT security, published in February 2020. Section 3.1 (*Perform Algorithm Verification*) is the most directly applicable: *"Libraries MUST enable the caller to specify a supported set of algorithms and MUST NOT use any other algorithms when performing cryptographic operations."* Theo's caller doesn't specify; the library doesn't enforce; the token's claimed algorithm is honored. RFC 8725 also covers key-injection attacks (Section 3.2), key-identifier (`kid`) attacks (Section 3.5), and signing-secret management (elsewhere in Section 3).

## §6 — Cert exam relevance

The certification industry has been teaching JWT misuse since shortly after the McLean disclosure landed in 2015. If you study any of the certs below, you've seen — or will see — alg:none and its cousins.

**CompTIA Security+ (SY0-701).** The current exam (released November 2023). Domain 1 (*General Security Concepts*) covers cryptographic primitives and their failure modes; JWT-specific examples appear in the secure-coding sub-domain of Domain 2 (*Threats, Vulnerabilities, and Mitigations*). Expect 1-2 questions touching the algorithm-confusion concept across a full exam attempt.

**CompTIA CySA+ (CS0-003).** The current exam (released June 2023). Domain 2 (*Threat Intelligence and Threat Hunting*) covers algorithm-confusion attacks in the catalog of techniques. Domain 1 (*Security Operations*) covers the defender-side detection patterns — SIEM rules for tokens with empty signatures, anomalous `alg` values, etc.

**CompTIA PenTest+ (PT0-003).** The current exam (released December 2024, replacing PT0-002 which sunset in mid-2025). Domain 3 (*Vulnerability Discovery and Analysis*) names JWT misconfigurations as a directly-tested vulnerability class. Candidates should be able to identify alg:none and weak-secret cases in a hands-on simulation.

**(ISC)² CISSP.** Domain 3 (*Security Architecture and Engineering*) covers digital signatures and the verifier's responsibility to enforce algorithm constraints. The CBK material references RFC 7519 and RFC 8725 as primary references. Domain 4 (*Communication and Network Security*) touches transport-layer authentication, including bearer-token patterns.

**(ISC)² CSSLP (Certified Secure Software Lifecycle Professional).** The secure-coding cert. The CBK chapters on authentication explicitly cover JWT verification anti-patterns, including alg:none and the missing-whitelist mistake.

**Offensive Security OSWA / OSWE.** OffSec's web-focused certs. The Web Assessor (OSWA) exam covers JWT attacks in its information-gathering and exploitation modules; the Web Expert (OSWE) exam tests candidates' ability to discover and exploit JWT vulnerabilities in real applications during the 48-hour practical. The PEN-200 (OSCP) curriculum touches JWT briefly but the deep-dive lives in the web-focused certs.

**SANS GIAC GWAPT.** *GIAC Web Application Penetration Tester* — the SANS web-pentesting cert. The course (SEC542) covers JWT-class vulnerabilities in depth, including the algorithm-confusion family, weak-secret cracking, and the key-injection variants.

## §7 — What a defender does

The bulleted version is in the in-game `lessons-learned.md`. This section expands each bullet with the specific operational details that get a defender from "I read about this" to "I have shipped the change to production."

### 1. Whitelist algorithms in every JWT.verify() call

The fix is one extra argument on every `verify` call. The harder work is finding every call.

**Node.js (`jsonwebtoken`).** The two-argument form is the vulnerability:

```javascript
// VULNERABLE — the token's alg header decides verification behavior
const claims = jwt.verify(token, SIGNING_SECRET);

// FIXED — only HS256-signed tokens are accepted
const claims = jwt.verify(token, SIGNING_SECRET, {
  algorithms: ['HS256']
});
```

**Node.js (`jose`).** The `jose` library (a more modern alternative) makes this safer by binding the key to its algorithm:

```javascript
import { jwtVerify, importJWK } from 'jose';

const key = await importJWK({ ... }, 'HS256');
const { payload } = await jwtVerify(token, key, {
  // jose still requires you to pass algorithms or it throws
  algorithms: ['HS256']
});
```

**Python (`PyJWT`).** Same pattern — the `algorithms` keyword is required when verifying:

```python
import jwt

# PyJWT 2.x raises InvalidAlgorithmError if you omit algorithms
claims = jwt.decode(token, SIGNING_SECRET, algorithms=['HS256'])
```

PyJWT was one of the libraries where, in older versions, omitting `algorithms` silently accepted any algorithm. Current versions require the parameter — but only since 2.x. If your application pins to PyJWT 1.x, this is a separate finding.

**Go (`golang-jwt/jwt`).** The Go library requires an explicit keyfunc that can inspect the alg:

```go
token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
  // Verify the alg is what we expect
  if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
    return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
  }
  return signingSecret, nil
})
```

**Audit the codebase.** A regex like `jwt\.verify\([^,]+,[^,]+\)` (Node.js) or `jwt\.decode\([^,]+,[^,]+\)` without `algorithms=` (Python) catches the two-argument form. Every hit is a finding. Static-analysis tools like Semgrep and CodeQL have community-maintained rule packs for the JWT-misconfiguration patterns; the Semgrep registry at <https://semgrep.dev/r/> has searchable rules for `javascript.jsonwebtoken`, `python.pyjwt`, and others.

### 2. Reject alg:none unconditionally

Even if you intend to accept multiple signing algorithms (HS256 for some clients, RS256 for others), `none` should never be on the whitelist. Document this in your platform's authentication standard. Modern libraries (jsonwebtoken v9+, PyJWT 2+, jose) reject alg:none by default — but the explicit whitelist remains the defense-in-depth requirement.

### 3. Rotate the JWT signing secret

The signing secret may or may not have leaked. The threat model now includes "any past admin token may have been forged with no signature at all" — meaning every action attributed to the admin API during the vulnerable window is potentially attacker-driven, not just the ones from suspicious source IPs.

The rotation playbook:

1. Generate a new 256-bit cryptographically random secret. `openssl rand -base64 32` is fine for the value; for production use a managed secret store to hold it (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault, Google Secret Manager).
2. Update the verifier to accept tokens signed with either the old or new secret during a transition window. (Most JWT libraries support a key-rotation pattern by passing both keys to the verifier.)
3. Update the issuer to sign new tokens with the new secret.
4. Wait for outstanding old-secret tokens to expire (or, better, force-expire them by short-circuiting all sessions and requiring re-login).
5. Remove the old secret from the verifier.

For Vesta specifically, the rotation should be coordinated with the Friday change window already scheduled for the level-0 API-key rotation. The two findings have related blast radius; rotate together.

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

**Log-pipeline scrubbing (Splunk example using `transforms.conf`):**
```
[redact_authorization]
REGEX = (Authorization:\s*Bearer\s+)[A-Za-z0-9-_\.]+
FORMAT = $1<REDACTED>
DEST_KEY = _raw
```

Equivalent transforms exist for Sentinel (ASim parser custom redaction), Elastic (ingest pipeline `script` processor), Datadog (log processor with `replace` action). The pipeline-side scrubbing is a defense-in-depth backstop for the cases where application code logs something it shouldn't.

### 5. Add SIEM detections for JWT-specific anomalies

The detections worth running:

- **Authorization headers carrying tokens with `alg: none` in the header segment.** Decoding the header segment of any captured JWT to JSON and matching against `"alg":"none"` is a single SIEM correlation rule.
- **Tokens with empty signature segments.** A bearer token with a trailing dot and no content after it is, by inspection, an unsigned token.
- **Tokens where the application accepted authentication after the verification middleware logged a signature-verification failure.** This catches the case where verification fails but the application bug doesn't propagate the failure — a more subtle variant.
- **Anomalous `alg` values in token headers** — any algorithm not on your accepted-algorithm list shouldn't be appearing in production traffic. Alerts here often catch misconfigured clients before they catch attackers.

The Sigma project publishes community-maintained SIEM detection rules — clone <https://github.com/SigmaHQ/sigma> and grep the `rules/` tree for `jwt` or `alg` to find the current published versions. JWT_Tool's documentation also includes Sigma-compatible rule examples for each of its attack modes.

### 6. Upgrade the JWT library

Current `jsonwebtoken` (v9.x+) rejects alg:none by default even without explicit whitelisting. The library introduced this change in v9.0.0 after a sequence of CVEs in v8.x:

- **CVE-2022-23539** — Insecure key-type handling in `jwt.verify()` (the `secretOrPublicKey` confusion variant).
- **CVE-2022-23540** — Default algorithm handling permitted alg:none acceptance under specific configurations.

Both were addressed in v9.0.0. (A third CVE, CVE-2022-23529, was initially assigned in the same advisory but was subsequently REJECTED by Mitre in January 2023 — don't carry it forward as a citation.) If Vesta's `package-lock.json` pins to v8.x or earlier, that's a separate finding requiring an upgrade plus regression testing. Equivalent legacy-version findings exist for PyJWT (pre-2.0), `node-jose` (CVE-2018-0114), and various other libraries.

### 7. Authentication-platform retrofit

If admin auth is materially important — and for systems that can rotate production credentials, it always is — JWT-as-DIY might not be the right primitive at all. The managed alternatives handle algorithm enforcement, key rotation, session revocation, token-revocation lists, audit logging, and the operational discipline around all of the above:

- **Auth0** (Okta-owned): JWT-native, programmable, enterprise-grade.
- **Okta Workforce Identity / Customer Identity**: the parent platform.
- **Microsoft Entra ID** (formerly Azure AD): the Microsoft-stack default.
- **AWS Cognito**: AWS-native, integrates with IAM.
- **Stytch**: developer-friendly modern auth-as-a-service.
- **WorkOS**: targeted at enterprise B2B identity flows.

The retrofit is non-trivial but reduces the surface dramatically. For a system that already has a JWT-based auth model, the migration path is usually "swap the verifier middleware for the IdP's SDK" — one library swap, one redeploy, plus key-rotation coordination.

### Sample detection rule (Sigma)

An `alg: none` token is trivially recognisable before it is decoded,
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

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command — `progress --detail` from any prompt lists what you've unlocked.

### "Most-downloaded npm package, should be safe"

**Trigger:** `cat priya-note.md` (you ran this as step 1 of the solve, so the bonus fires there)

**What it teaches:** Priya's day-two note quotes Theo's library-choice rationale verbatim: he picked the most-downloaded JWT package because *"everyone uses it, should be safe."* That's a real-world rationale that engineers use all the time, and it conflates two genuinely separate properties:

- **Library popularity is a useful signal for maintenance, security-review attention, and supply-chain risk.** A library with one million weekly downloads has more eyes on it than one with a thousand. CVEs in popular libraries get filed faster, patched faster, and disclosed publicly faster. There's a real reason to prefer popular libraries on those grounds.
- **Library popularity is *not* a signal that you've configured the library correctly.** Theo's bug isn't in `jsonwebtoken`; it's in his two-argument call to `jwt.verify()` that omits the algorithms whitelist. The library's default for the omitted whitelist accepts `alg:none` for backwards compatibility with old code. Theo would have hit the same bug with any of the popular JWT libraries in 2026 — the configuration-default surface is broadly similar across the ecosystem.

The pattern in real consulting work: *the library is rarely the bug; the integration is*. The CWE-1188 ("Insecure Default Initialization of Resource") and CWE-1188-adjacent insecure-default findings drive a substantial fraction of real-world JWT bypasses, OAuth misconfigurations, S3 bucket leaks, and TLS-context misconfigurations. The fix is rarely "switch libraries"; the fix is usually "audit the integration."

For JWT specifically, **always pass the `algorithms` parameter on every `verify()` call.** Modern versions of `jsonwebtoken` (9.x+) have made this stricter, but Theo's pinned dependency may not be on 9.x, and even on 9.x the configuration discipline is what saves you, not the version. Pin behavior, not version.

## §8 — Key takeaways

- **The original sin of JWT verification is letting unauthenticated input pick the algorithm.** A token's `alg` header is data. The verifier must specify the algorithms it accepts; anything else is the alg:none / key-confusion class waiting to happen. RFC 8725 Section 3.1 spells this out explicitly: implementations MUST either pin the expected algorithm or use a whitelist.

- **JWT payloads are not confidential.** They're base64url, not encrypted. JWS (the signed variant most production systems use) provides integrity but not confidentiality. Anything you put in a JWT payload — including a credential someone "stashed" in a claim — is readable by anyone who holds the token. For confidentiality you need JWE, which is a different envelope.

- **Modern libraries reject alg:none by default — but that's not enough.** The explicit whitelist remains the defense-in-depth requirement, and the moment your code pins to an older library version, accepts an attacker-controlled algorithms list, or trusts a `jku` URL it didn't validate, the attack is back.

- **Audit logs that capture Authorization headers are credential dumps in disguise.** Anyone with read access to the log can replay any token in it. Redact at the proxy, redact at the application, redact at the log pipeline — defense in depth, because the application code that should never have logged the credential will, eventually, do exactly that.

- **For PCI-DSS-scoped admin APIs, JWT-as-DIY is risk you don't have to take.** Managed identity platforms — Auth0, Okta, Entra, Cognito, Stytch — handle algorithm enforcement, key rotation, session revocation, and audit logging at a level of operational discipline that's hard to reproduce in-house. The retrofit cost is finite; the long-tail vulnerability surface of self-managed JWT verification is not.

- **Theo's pattern is not unique to Theo.** Junior engineers writing their first auth middleware reach for the most-downloaded library, copy the two-argument verify example from the README, and ship. The disciplined platform answer is a code-review checklist line ("does this verify call specify algorithms?") plus a Semgrep rule in CI ("any two-argument jwt.verify is a build failure"). Both are cheap; neither requires the junior engineer to understand the depth of what they got wrong, only to follow the guardrail until they do.

- **The same lesson scales across "junior engineer crypto mistakes."** Level 0 was "I base64-encoded the secret, so it's protected." Level 1 is "I JWT-encoded the auth, so it's authenticated." Level 2 of this track (whenever it ships) will pull on a third thread of the same yarn ball. The shared diagnosis: there is a real cryptographic primitive that does what the engineer thought they were doing, and the engineer used something else.

## §9 — Further reading

*Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

### Standards documents

- **RFC 7519 — JSON Web Token (JWT)**: <https://datatracker.ietf.org/doc/html/rfc7519>. The foundational JWT specification. Section 4 covers claims; Section 6 covers unsecured JWTs (alg:none); Section 7 covers creating and validating tokens.
- **RFC 7515 — JSON Web Signature (JWS)**: <https://datatracker.ietf.org/doc/html/rfc7515>. The signature-format spec underlying JWT. Section 5 covers signing and verification procedures.
- **RFC 7516 — JSON Web Encryption (JWE)**: <https://datatracker.ietf.org/doc/html/rfc7516>. The encryption variant. Use JWE (not JWS) when you need the payload to be confidential.
- **RFC 8725 — JSON Web Token Best Current Practices**: <https://datatracker.ietf.org/doc/html/rfc8725>. The BCP document specifically for JWT security. Section 3 is the operational meat — read 3.1 through 3.12 in order.
- **OAuth 2.0 Security Best Current Practice (RFC 9700)**: <https://datatracker.ietf.org/doc/html/rfc9700>. The 2025 BCP for OAuth 2.0 (replaces the older draft-ietf-oauth-security-topics). Relevant because JWT is the dominant OAuth 2.0 access-token format.
- **NIST SP 800-63B Rev. 4 — Digital Identity Guidelines: Authentication and Authenticator Management**: <https://csrc.nist.gov/pubs/sp/800/63/b/4/final>. Published July 2025; supersedes the 2017 edition. Covers token lifecycle, authenticator selection, AAL tiering.

### CWE / MITRE ATT&CK

- **CWE-347: Improper Verification of Cryptographic Signature**: <https://cwe.mitre.org/data/definitions/347.html>. The primary weakness for JWT alg:none and signature-skipping patterns.
- **CWE-345: Insufficient Verification of Data Authenticity**: <https://cwe.mitre.org/data/definitions/345.html>. The parent weakness.
- **CWE-287: Improper Authentication**: <https://cwe.mitre.org/data/definitions/287.html>. The umbrella authentication-bypass weakness.
- **CWE-532: Insertion of Sensitive Information into Log File**: <https://cwe.mitre.org/data/definitions/532.html>. The secrets-in-logs finding.
- **CWE-540: Inclusion of Sensitive Information in Source Code**: <https://cwe.mitre.org/data/definitions/540.html>. Useful framing for the JWT-payload-as-credential-envelope sub-pattern.
- **MITRE ATT&CK T1550.001 — Use Alternate Authentication Material: Application Access Token**: <https://attack.mitre.org/techniques/T1550/001/>.
- **MITRE ATT&CK T1078 — Valid Accounts**: <https://attack.mitre.org/techniques/T1078/>.
- **MITRE ATT&CK T1212 — Exploitation for Credential Access**: <https://attack.mitre.org/techniques/T1212/>.

### Original disclosures and reference posts

- **Tim McLean, "Critical vulnerabilities in JSON Web Token libraries"** (Auth0 blog guest post, March 2015): <https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/>. The original alg:none and RS→HS disclosure; a decade later still the canonical reference for the algorithm-confusion family. McLean was an independent researcher at the time.
- **CVE-2015-2951** (Mitre): <https://www.cve.org/CVERecord?id=CVE-2015-2951>. The php-jwt alg:none variant from McLean's disclosure — `jwt_tool` and most tooling cite this CVE for alg:none.
- **CVE-2015-9235** (Mitre): <https://www.cve.org/CVERecord?id=CVE-2015-9235>. The node-jsonwebtoken RS→HS key-confusion variant from the same disclosure.
- **CVE-2018-0114** (Mitre): <https://www.cve.org/CVERecord?id=CVE-2018-0114>. The node-jose embedded-`jwk` key-injection disclosure (Cisco).

### Compliance frameworks

- **PCI-DSS v4.0.1 full text** (PCI Security Standards Council): <https://www.pcisecuritystandards.org/document_library/>. Free registration required. The Requirement 6 and 8 sections cover authentication and secure coding directly.
- **NIST SP 800-53 Rev. 5**: <https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final>. The IA, SC, AC, and AU control families cover the controls cited above.
- **OWASP Top 10 (2025)**: <https://owasp.org/Top10/>. The current edition.
- **OWASP API Security Top 10 (2023)**: <https://owasp.org/API-Security/editions/2023/en/0x00-header/>. The API-focused companion. Last updated in 2023; the 2025 cycle is in draft.
- **OWASP JWT Cheat Sheet**: <https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html>.

### Tools

- **`jwt_tool`** (ticarpi): <https://github.com/ticarpi/jwt_tool>. The defacto JWT-attack toolkit. Supports alg:none confusion, RS→HS key confusion, jku/x5u injection, HMAC-secret brute-force, kid injection, and several other patterns.
- **`hashcat`** mode 16500 (JWT HS256): <https://hashcat.net/wiki/doku.php?id=example_hashes>. Brute-force JWT HMAC secrets on GPU.
- **jwt.io** (Auth0): <https://www.jwt.io/>. Browser-based JWT decoder. Useful for ad-hoc inspection; do NOT paste tokens from production systems into the public site (the site does not transmit the token off-machine in modern versions, but the discipline is "decode locally").
- **Semgrep registry — JWT rules**: <https://semgrep.dev/r/?q=jwt>. Community-maintained static-analysis rules for the JWT misconfiguration patterns.
- **Sigma rules — JWT detections**: <https://github.com/SigmaHQ/sigma>. Search the repo for `jwt` or `alg`.

### Background / depth

- **Auth0 — "JWT Handbook"** (free e-book): historically published as a free download; check Auth0's resources page for the current location. ~100 pages of JWT operational depth.
