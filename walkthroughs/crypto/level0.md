# level0@crypto — Theo's Safer API Key

**Track:** Crypto · **Client:** Vesta Retail · **Compliance regime:** PCI-DSS

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level1@crypto`. If you haven't solved `level0@crypto` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers, and the post-mortem below makes far more sense once you've felt the moment yourself.

---

## §1 — The setup

Vesta Retail is one of Driftwood's e-commerce clients: an online retailer doing roughly $200M in annual revenue across roughly 12 million transactions a year. They accept Visa, Mastercard, AmEx, and Discover; they process the bulk of those transactions via Stripe but maintain a small in-house gateway for a handful of high-volume B2B accounts. The merchant-card-handling profile pushed them from PCI-DSS Level 3 to Level 2 in 2024 — they're now in the 1-6 million transactions per year bracket, which means an annual Self-Assessment Questionnaire (SAQ D) and an on-site Qualified Security Assessor (QSA) review every other year.

Their annual PCI-DSS re-attestation is six weeks out. Saanvi, Vesta's CTO, asked Priya for a pre-walkthrough — Driftwood reviews the payment-handling code before the QSA does, surfaces findings, gives Theo's team a chance to fix them, and the formal audit goes quickly with a short findings list. This is a play Saanvi uses every year, and it works because the QSA's job is easier when the obvious issues are already gone.

You're on Driftwood's crypto-analysis workstation, logged in as `secops` — the shared service account the security team uses for code and binary reviews. The host is set up for static analysis: file-type detection, binary string extraction, hex viewing, hash identification, and the encoding/decoding tooling you'll need for today's review.

Theo is one of Vesta's backend engineers, eighteen months in. He's been working on the payment-deploy pipeline for the last quarter. The engagement notes Priya wrote describe him as "competent at his level" and "new to the 'this code has to survive a PCI auditor' stage of his career." That framing matters for tomorrow's conversation. Theo's commit message on the change Priya flagged is a window into his thinking:

> *"Cleaned up the deploy script and moved the API key into api-key.b64 — it's base64 now so the value doesn't show up in git diffs. Should make code review easier."*

Theo did not know that base64 is not encryption. He believed he had made the key safer. The work in front of you is to demonstrate the gap — to him, to Saanvi, and to the QSA file — using nothing more than the standard `base64` decoder that ships with every Unix system.

What you'll find when you decode the file is a production Stripe-style API key prefixed `vesta_pk_live_…`, which is the exact value that any reader of Vesta's git repository, any CI runner that checked out the code, any developer laptop that had a clone, and any backup that captured the repo state has been carrying around for the past sprint.

## §2 — The solve

Three commands. The cryptographic discipline is in noticing what they tell you.

### Step 1: Read the brief

```bash
secops@crypto:~$ cat engagement-notes.md
```

The engagement notes name the client (Vesta Retail), the compliance regime (PCI-DSS Level 2), the characters (Saanvi as CTO, Theo as the engineer who made the commit, Priya as the Driftwood handler), and — most importantly — the verbatim quote from Theo's commit message. The quote is the entire setup for the finding. Read it before you look at the script, so you understand what Theo *thought* he was doing.

### Step 2: Read the deploy script

```bash
secops@crypto:~$ cat deploy.sh
```

The script is small. Three operative lines matter:

```bash
API_KEY=$(base64 -d < /opt/vesta/payment/api-key.b64)
export VESTA_PAYMENT_API_KEY="${API_KEY}"
kubectl -n payment set env deployment/payment-worker \
  VESTA_PAYMENT_API_KEY="${VESTA_PAYMENT_API_KEY}" \
  ...
```

The script reads `api-key.b64`, decodes it from base64, exports the result as `VESTA_PAYMENT_API_KEY`, and pushes the value into the payment-worker Kubernetes deployment as an environment variable. The decoding happens at deploy time, on the deploy host, in plain shell, with no key, no secret, and no cryptographic operation of any kind.

This is the moment a reviewer notices that "base64" is doing the work of "encryption" in Theo's mental model. The two operations have the same shape from outside — bytes go in, different bytes come out — but they belong to different categories, and the categories matter for whether the data has any protection at all.

### Step 3: Decode the key

```bash
secops@crypto:~$ base64 api-key.b64
vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3
```

There it is. The "secured" API key is `vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3` — a Stripe-style live publishable key prefix glued to a random suffix, exactly the format that authorizes the Vesta payment processor to charge cards on Vesta's behalf. Anyone who can read `api-key.b64` (which is everyone with access to the repo, every CI runner, every developer machine, every backup of any of those) can produce this same output with this same one-line command. There is no key needed. There is no secret involved in the decode. Base64 has performed exactly the operation it was designed to perform — convert printable-ASCII back to its original byte content — and zero operations of any cryptographic protection.

You've now recovered the live API key. The finding is documented.

### Step 4: Use the credential (in the game world only)

This is the part that would not happen in a real engagement — Saanvi explicitly authorized only the static analysis, not active use of the credential — but does happen in D3CYPH3R because the breadcrumb pattern walks you onto the next level:

```bash
secops@crypto:~$ ssh level1@crypto
level1@crypto's password: vesta_pk_live_HxK4nP9qR2vT8YwBmC5dE3
```

You're now inside the Vesta payment-worker context, holding the API key that should not have been recoverable from a base64-encoded file. The lesson of level1@crypto is what an attacker does with such a key — the deeper consequences of the "encoding-as-protection" mistake — and we'll cover it in its own walkthrough.

### If you got stuck

- If `base64 api-key.b64` returned a string that looks like more random bytes rather than a readable key, you may be encoding rather than decoding. Check that the file already contains base64-encoded text (it does — open it with `cat` first), and that the `base64` invocation in this game's environment decodes by default. In real GNU coreutils, plain `base64 file` encodes; `base64 -d file` decodes. The game's `base64` command accepts both — try `base64 -d api-key.b64` if the plain form doesn't read.
- If you tried `cat api-key.b64` and saw a printable string starting with `dmVz…`, that's the base64 form: the first byte `d` (= 0x64) decodes to `v` (Latin lowercase v, the first letter of "vesta_pk_live_…"). You can convince yourself the file is base64 by spotting that distinctive prefix pattern — `dmVz` will appear at the start of any base64-encoded string that begins with "ves".
- If `ssh level1@crypto` rejected the password, copy-paste error in the key suffix is the most likely culprit. The key is case-sensitive: `HxK4nP9qR2vT8YwBmC5dE3` with the exact capitalization shown.

## §3 — The vulnerability

It is tempting to call this "Theo encoded the key instead of encrypting it." That's true and it's the headline, but it under-specifies the failure. There are three distinct failures stacked in this finding, and remediation needs to address all three or the next sprint will reintroduce the same pattern.

**Failure 1 — Conceptual: encoding confused with encryption.** Theo treated base64 as if it were a key-protected secrecy operation. It isn't. Base64 is a *transport encoding* — it maps arbitrary bytes onto a 65-character printable-ASCII alphabet (A-Z, a-z, 0-9, +, /, plus `=` as padding) so binary data can ride safely through systems that expect text. There is no key, no secret material, and no cryptographic property beyond "the output is a valid byte sequence." The mapping is specified in RFC 4648 and is the same on every computer.[^rfc-4648] This is a *category error*, not an implementation error: no amount of careful base64-encoding will produce a secret, because base64 is not a category of operation that produces secrets.

The category error is forgivable in a junior engineer who hasn't been formally trained on the cryptographic-versus-encoding distinction. It is also extremely common — every credential-exposure forensic report ever published contains some version of this finding. The mistake is mundane; the lesson is the speed and clarity with which an experienced engineer recognizes the pattern in code review.

**Failure 2 — Operational: the secret is in source control.** Even if Theo had used real encryption — AES-256-GCM with a managed key, say — the encrypted blob sitting in `api-key.b64.enc` in the same repo as the decryption logic in `deploy.sh` would only be one step removed from the current state. The blob would be safe from anyone without the key; but the key would have to live somewhere the script could read it, which means either the same repo (no improvement), an env var on the deploy host (better but still file-readable), or a secrets manager (the actual answer). The deeper failure is the absence of a secrets manager. The remediation isn't "encrypt the file"; it's "the key never lives in the repo, encoded or encrypted."

**Failure 3 — Process: the code reached production without the review that would have caught it.** Vesta has a CI/CD pipeline. The pipeline did not include a credential scanner. The PR that introduced `api-key.b64` was reviewed and approved by a teammate who did not flag the encoding-as-protection mistake. The merge happened. The code shipped. The credential lived in the production deployment pipeline for an unknown but probably-multi-day window before Priya pulled the script on Friday. Each of those touch-points (CI, peer review, merge gate) is a layer that should have caught the finding before it reached the production deploy host. None of them did.

Each failure is independently a finding. Fixing only one — say, rotating the key without addressing the deployment-pipeline practice that produced the situation — guarantees the same conversation in a future sprint when a different engineer makes a different but isomorphic mistake. The defender's playbook lives in §7. First, the parallels.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Vesta's deploy repository, where the key sits in `api-key.b64` |
| Credential in scope | A **live** payment-processor key, `vesta_pk_live_…`, base64-encoded and nothing else |
| Effective protection | None. Base64 is a transport encoding with a published algorithm and no key |
| Exposure window | Every clone, every fork, and the full git history since the commit |
| Escalates to | The credential chain into `level1@crypto` |
| Regime | PCI-DSS v4.0.1 — contractual, not statutory; notification runs to the acquirer and card brands[^pci-dss-v4-0-1-2][^pci-dss-v4-0-1] |

**Encoding the value made the exposure worse, not better, and the commit
message explains why.** Theo's stated goal was that the key stop showing
up in git diffs. It worked: the string no longer trips a reviewer's eye or
a naive secret scanner looking for `pk_live_`. The credential is exactly
as available as before to anyone who runs `base64 -d`, and is now
invisible to the controls most likely to have caught it. A control that
defeats detection while preserving access has negative value.

**Git history is the real scope, and rotation is the only remediation.**
Deleting the file in a new commit leaves the value in every prior object,
every clone anyone has taken, and every fork. There is no edit that
un-publishes it. The only action that changes the attacker's position is
issuing a new key and revoking this one, and any remediation plan whose
first step is "remove the file" has the order wrong.

**"Publishable" in the key name is not a scoping argument.** The right
question for the assessment is what this specific credential can do
against Vesta's processor account, answered from the processor's own
documentation rather than from the prefix. Guessing generously about a
live payment credential is how a finding gets downgraded and then
re-litigated after an incident.

## §4 — Real-world parallels

Three named, well-documented incidents follow this exact pattern. Each was a major industry event, each is documentable from primary sources you can read, and each lands on the same lesson Theo's commit lands on: the moment a secret touches source control (encoded or not), it is no longer a secret.

### CircleCI — January 2023

On January 4, 2023, CircleCI — one of the largest CI/CD providers, used by tens of thousands of engineering organizations — disclosed via its blog that an attacker had compromised an employee's laptop with information-stealing malware, captured a valid 2FA-backed session cookie, escalated to production-system access, and exfiltrated customer environment variables, project-level API tokens, and stored secrets for an undisclosed number of customer projects between December 16, 2022 and January 4, 2023.

CircleCI's response was extensive and unusual in its honesty. The company rotated GitHub OAuth tokens for all affected customers, instructed every customer to rotate every secret stored in CircleCI immediately, and published detailed post-incident transparency reports. CircleCI's own incident summary stated that *fewer than five* customers reported confirmed downstream unauthorized access to third-party systems as a result of the compromise; the much larger population of customers rotated their entire stored-secrets surface as a precaution. The precautionary rotations exposed, across the industry, how much credential material was being stored "encoded" rather than "managed by a secrets backend" — which is the half of the story that matters for the Vesta parallel.

The relevance to Vesta is sharp: CircleCI's customers had stored credentials in CircleCI's environment-variable surface, and many of those credentials were base64-encoded "for safety" before being stored — exactly Theo's pattern, just one platform up. When the platform itself was compromised, the base64-encoding gave the secrets exactly zero additional protection. The attacker decoded everything. CircleCI's own write-up explicitly named the lesson: encoding is not encryption, secrets-manager-grade storage is.

The longer-tail consequence was an industry-wide recalibration of how CI/CD secrets get handled. The post-CircleCI guidance — from CircleCI itself, from GitHub, from GitLab, from every credible CI vendor — moved decisively toward short-lived, identity-based credentials issued just-in-time (OIDC federation to cloud providers), away from long-lived API keys stored as environment variables. Vesta's deploy.sh sits on the wrong side of that recalibration.

### Uber — September 2022

Uber's September 15, 2022 breach is the same story we cited in the level0@linux walkthrough — but a different part of it matters here. The attacker, after the MFA-fatigue initial access, found a PowerShell script on Uber's internal network share that contained **hardcoded administrator credentials** for Uber's Thycotic privileged-access-management system. The credentials were in plaintext, in a file under DocumentRoot of an internal network share, world-readable, and had not been rotated for a long time. With those credentials, the attacker pivoted from "one compromised VPN session" to "administrative access to Uber's secrets vault" — which contained, by design, every other secret Uber operated.

The post-incident analysis from Uber and from CISA explicitly mapped the lateral-movement technique to **MITRE ATT&CK T1552.001 (Unsecured Credentials: Credentials In Files)**.[^t1552-001] The same technique applies to Vesta's `api-key.b64`. The Uber file was plaintext; Theo's file was base64-encoded. The difference in attacker effort between recovering the credential is roughly zero — a one-line `base64 -d` against a known-encoding file is not a meaningful obstacle.

What makes the Uber parallel particularly useful for Vesta is the *scale of consequence*. Uber's PAM admin credentials gave the attacker Uber's HackerOne instance — which let them read every previously-disclosed vulnerability against Uber's own systems. The leak compounded. Vesta's API key, if recovered by an attacker, doesn't just charge cards on Vesta's behalf — it likely also reveals operational metadata about Vesta's Stripe configuration, payment flow, and customer-account structure. The blast radius of a payment-processor API key is its operational footprint plus everything the key authorizes the attacker to learn about the system it's authorized against. T1552.001 isn't a small finding when the credential is high-privilege.

### Cisco Type-7 password "encryption" — the canonical case study

The most pedagogically pure parallel to Theo's mistake is decades old and predates the modern cloud era. Since at least the mid-1990s, Cisco IOS — the operating system on Cisco's switches and routers — has supported a feature called **"Type 7" password encoding**, used in configuration files to obscure interface passwords, SNMP community strings, and similar credentials. The feature was documented from the beginning by Cisco itself as *not* an encryption scheme, but as an obfuscation intended to prevent shoulder-surfing or trivial accidental disclosure.

The Type-7 algorithm is a simple XOR with a known constant key. The decoding is trivial: it requires no secret, no specialized tooling, and roughly six lines of Python (or a free web tool that's been online since 1996). Despite this, generations of network engineers — and a non-trivial number of cybersecurity students — have looked at Type-7 strings in Cisco configs and concluded that the passwords were "encrypted." They were not. They were encoded with a published, deterministic, reversible transformation that the Cisco documentation has called "obfuscation, not encryption" for thirty years.

Cisco eventually added **Type-5** (MD5 hashing, properly cryptographic but now considered weak), **Type-8** (PBKDF2 with SHA-256), and **Type-9** (scrypt) password schemes — all of which are actual cryptographic operations. But Type-7 strings still appear in production configurations across the industry, and the misconception that they provide meaningful protection persists. The Cisco Type-7 episode shows up in OSCP study materials, in PenTest+ exam prep, in CISSP review sessions, in network-engineering certifications generally, as the standard worked example of "encoding is not encryption."[^cert-oscp][^cert-cissp]

Theo's `api-key.b64` is a 2026 version of the same mistake. The category error — believing that a reversible byte-transformation provides protection because the output looks unfamiliar — is the same error, just applied to a different encoding (base64 instead of Cisco Type-7 XOR) and a different secret (a payment-processor API key instead of an interface password). The lesson is the same. The fix is the same. The cert curriculum has been teaching the lesson for a generation, which means there's no excuse for it to keep recurring in production code — and yet it does.

## §5 — Frameworks, deep dive

The in-game post-mortem cites seven framework controls. Each is expanded below: what the control actually requires, what audit evidence proves it's in place, and what auditors flag when it's not.

### PCI-DSS v4.0.1 — Requirement 3.5, 3.6, 8.3

The Payment Card Industry Data Security Standard governs any organization that stores, processes, or transmits cardholder data. **PCI-DSS v4.0.1**, published June 2024, is the current standard; v4.0 was originally published in March 2022 and retired December 31, 2024.[^pci-dss-v4-0-1][^pci-dss-v4-0-1-2] The future-dated requirements introduced in v4.0 became mandatory March 31, 2025, so Vesta's annual re-attestation will evaluate against the full v4.0.1 requirement set.

Three requirements bear directly on Theo's `api-key.b64`:

**Requirement 3.5 — Protect Stored Account Data.** The control requires that the primary account number (PAN) be rendered unreadable wherever it is stored, using one of: strong cryptography (with associated key management), truncation, one-way hashing, or tokenization. The control sub-requirements extend to the *keys* that protect cardholder data: those keys themselves must also be protected against disclosure and misuse. Base64 is none of the named protection mechanisms. Vesta's payment-processor API key, while not technically a PAN itself, falls under the protection requirements applying to keys that enable access to systems handling PANs.

**Requirement 3.6 — Documented Cryptographic Key Management.** The control requires documented and implemented procedures for: secure key generation, secure key distribution, secure key storage, periodic key rotation, key custody and split-knowledge requirements for keys with manual handling, and secure key destruction at end-of-life. A base64-encoded file committed to a repository satisfies none of these. The "key" is generated wherever Theo wrote it, distributed by `git pull`, stored by `git`, rotated never, and never destroyed.

**Requirement 8.3 — Strong Authentication for All Access to Cardholder Data Environments.** The control specifies multi-factor authentication requirements, account-management procedures, and the protection of authentication credentials. A live payment-processor API key is an authentication credential under this requirement; its exposure in a repository is a control failure independent of whether anyone has yet exploited the exposure.

Audit evidence for PCI-DSS Req 3.5/3.6/8.3 includes a documented secrets-management procedure, evidence of secrets-manager deployment, key-rotation logs with timestamps, and code-review attestations that ensure secrets do not appear in source-controlled files. Common findings on a real QSA review of code like Vesta's: secrets-manager deployed but bypassed in scripts; rotation policy documented but not implemented; code-review checklist exists but doesn't include credential-scanning. Vesta's `api-key.b64` would be flagged within the first hour of the QSA's code review.

### NIST SP 800-53 Rev. 5 — SC-28: Protection of Information at Rest

**SC-28, Protection of Information at Rest**, requires the organization to protect the confidentiality and integrity of information at rest using one or both of: cryptographic mechanisms or physical security controls. The control has several enhancements; SC-28(1) requires cryptographic protection specifically, and SC-28(2) requires offline storage of unattended information at rest.

Base64-encoded data is *not* a cryptographic protection mechanism — base64 has no key, no integrity check, and provides confidentiality only against an attacker who lacks the ability to run `base64 -d`. The credential in `api-key.b64` is, for SC-28 purposes, stored unencrypted at rest. SC-28's plain reading is unambiguous about this.

Audit evidence for SC-28 includes a documented inventory of information-at-rest categories, the cryptographic controls applied to each, and the key-management infrastructure backing the cryptography. Common findings: encryption enabled but with default or weak algorithms; encryption enabled but with keys also stored unprotected; "encryption" claimed but actually performed by an encoding scheme. Vesta's situation is the third common finding.

### NIST SP 800-53 Rev. 5 — IA-5: Authenticator Management

**IA-5, Authenticator Management**, governs the lifecycle of authenticators — passwords, tokens, keys, certificates. It requires verification of identity before issuing authenticators, establishment of initial authenticator content, change/refresh at organization-defined intervals, protection of authenticator content from unauthorized disclosure and modification, and steps to safeguard the authenticators throughout their lifecycle.

The Vesta API key violates IA-5 on several counts: it was never rotated since the commit that introduced the encoded version, it was disclosed by being committed to a repository (the protection-from-disclosure requirement), and the operator (Theo) took no reasonable steps to safeguard it — the protective step Theo *believed* he was taking (base64-encoding) was a category error that produced no protection.

Audit evidence for IA-5 includes a credential inventory with rotation timestamps and a documented rotation policy with enforcement evidence (automatic forced rotation, ticket-driven manual rotation, or scanner-driven re-issuance). Common findings: credentials that have never been rotated since system creation; credentials documented in unencrypted files; service-account credentials with no defined owner.

### NIST SP 800-57 Part 1 — Recommendation for Key Management

NIST SP 800-57 is the canonical reference for how to actually manage cryptographic keys at every stage of their lifecycle.[^nist-800-57] **Part 1, General**, is now in its **fifth revision (Rev. 5, May 2020)**. Rev. 5 is still current as of this writing; subsequent special publications (SP 800-131A, SP 800-152) reference 800-57 Rev.[^nist-800-152] 5 as the foundation document.[^nist-800-131a]

The whole publication is relevant to Vesta's situation, but two sections are particularly instructive for the Theo conversation tomorrow:

- **Section 6 — Key Establishment, Storage, Use, and Destruction.** The publication's articulation of what key-management *means* operationally. The requirements for key storage explicitly call out that keys must be protected from disclosure using cryptographic mechanisms or physical access controls — not by encoding or obfuscation.
- **Section 8 — Cryptoperiods.** The publication establishes that every key has a defined lifetime, after which it must be rotated. The lifetime depends on the algorithm, the operational threat model, and the consequence of compromise. For a live payment-processor API key, the recommended cryptoperiod is short — typically months, not years.

Audit evidence for NIST 800-57 compliance includes a documented key-management policy that references 800-57's specific sections, a key inventory with lifecycle attributes, and audit logs from a key-management infrastructure that demonstrate the policy in operation. Vesta does not yet have the key-management infrastructure that 800-57 describes; the remediation will include standing one up.

### CWE-261, CWE-326, CWE-256, CWE-798

The Common Weakness Enumeration catalog has four entries that map directly to Theo's mistake:

**CWE-261 — Weak Encoding for Password.**[^cwe-261] The precise weakness pattern. The CWE entry describes exactly this scenario: a credential protected by an encoding scheme (base64, ROT-13, hex, Cisco Type-7, etc.) rather than a cryptographic scheme. The entry has been in the catalog since the early days of CWE and is the textbook citation for the Vesta finding.

**CWE-326 — Inadequate Encryption Strength.** A broader weakness covering any case where the cryptographic protection applied to data is insufficient.[^cwe-326] Base64 has zero cryptographic strength (it is not encryption), so CWE-326 applies as a sibling citation. The two together — CWE-261 (this is the wrong category of protection) and CWE-326 (and even if it were the right category, this one provides no strength) — bracket the failure precisely.

**CWE-256 — Plaintext Storage of a Password.**[^cwe-256] For threat-model purposes, a base64-encoded credential is functionally identical to a plaintext-stored credential — the attacker effort to recover it differs by one shell command. CWE-256 frames the finding the way an adversary would. In an incident report, CWE-256 is the citation that captures "an attacker could read the credential off disk in real time."

**CWE-798 — Use of Hard-coded Credentials.**[^cwe-798] The underlying pattern Theo's "fix" was trying to address but didn't. Theo recognized that putting a credential directly in `deploy.sh` would be a hard-coded-credentials problem (CWE-798) and tried to remediate by relocating the value to a separate file. The relocation did nothing to address the underlying weakness — the credential is still in source control, still readable by anyone with repo access, and still subject to the same CWE-798 finding. The actual remediation is removing the credential from source control entirely, not relocating it.

### OWASP Top 10:2025 — A04:2025 Cryptographic Failures (was A02:2021)

The OWASP Top 10 is the most-cited application-security awareness document in the industry. The current edition is **OWASP Top 10:2025**, finalized in January 2026.[^owasp-top-10-2025] The 2021 edition cited in the in-game post-mortem put cryptographic failures at A02 — the second-highest slot. The 2025 reshuffle moved the category down to **A04:2025**, where it sits today.[^owasp-a04-2025] The relative drop does not reflect the category becoming less common in production code; it reflects the 2025 reshuffle elevating two newer concerns (Software Supply Chain Failures at A03, Mishandling of Exceptional Conditions at A10) and promoting Security Misconfiguration up to A02 based on the larger data corpus underlying the 2025 edition. Anyone studying for an OWASP-aligned cert in 2026 should learn the 2025 numbering: cryptographic failures is A04, not A02.

The substance of the cryptographic-failures category — exposure of sensitive data due to absent, weak, or misapplied cryptography — remains the same. The Vesta finding sits inside this category: the data is sensitive (a live payment-processor API key), the cryptography is absent (base64 is not cryptography), and the result is exposure. The OWASP recommendation for this category has been consistent across editions: use authenticated encryption (AES-GCM, ChaCha20-Poly1305) with managed keys from a key-management infrastructure; never roll your own cryptography; never substitute an encoding scheme for an encryption scheme; and at a higher level, design systems so that sensitive data does not need to be stored in places that require this kind of protection in the first place (a credential that lives in a secrets manager and is fetched JIT does not need to be encrypted at rest in the application repository, because it isn't there).

The mitigation OWASP recommends maps directly to the Vesta remediation: move the credential to a secrets manager (AWS Secrets Manager, HashiCorp Vault, Doppler, or equivalent), fetch the credential at runtime via an authenticated identity (IAM role for AWS, AppRole for Vault, etc.), and remove the encoded file from the repository — and from the repository's history, via a coordinated repo-rewrite using `git filter-repo` or BFG Repo-Cleaner.[^hashicorp-vault-getting-started][^aws-secrets-manager-user-guide][^doppler-universal-secrets-platform][^bfg-repo-cleaner-git-history]

## §6 — Cert exam relevance

Equal-depth coverage for the five certifications cited in the in-game post-mortem.

### CompTIA Security+ — current version SY0-701

Security+ is the entry-level certification most commonly required for DoD 8570/8140 IAT Level II positions and many state/federal government roles.[^cert-security-plus] The current exam is **SY0-701**, which superseded SY0-601 in November 2023 (SY0-601 was retired July 31, 2024). The crypto-track material maps strongly to one domain in particular.

- **Domain 1 — General Security Concepts.** Objective 1.4 covers cryptographic solutions in depth: the differences between encoding (base64, URL encoding, hex), encryption (symmetric vs. asymmetric, AES, RSA, ECC), and hashing (SHA-2, SHA-3, bcrypt, Argon2). The encoding-vs-encryption distinction is tested directly and often. Security+ also covers PKI fundamentals, certificate management, and the use of TLS — all of which sit in this domain.
- **Domain 4 — Security Operations.** Objective 4.4 covers identity and access management; secrets management and the difference between persistent and ephemeral credentials live here.

**Sample question framing:**

> A developer commits the following file to a version-controlled repository, claiming the file is "encrypted" because its contents are not human-readable:
>
> `dmVzdGFfcGtfbGl2ZV9IeEs0blA5cVIydlQ4WXdCbUM1ZEUz`
>
> Which of the following BEST describes the actual protection provided?
>
> A. AES-256 encryption with the developer's public key
> B. Base64 encoding, which provides no cryptographic protection
> C. A salted SHA-256 hash, suitable for credential storage
> D. RSA encryption with a 4096-bit modulus

This question pattern is canonical Security+. The answer is **B**. The traps are A, C, D — all real cryptographic operations, none of which would produce a string with base64's distinctive alphabet and padding shape. Recognition of the alphabet is the testable skill. The exam wants you to know base64 by sight and to know that it is not cryptography.

### CompTIA CySA+ — exam codes CS0-003 / CS0-004

CompTIA's CySA+ is the analyst-track cert focused on threat-detection, vulnerability-management, and incident-response work.[^cert-cysa] CS0-003 was the in-market exam from June 2023 onward; **CS0-004 launched on 23 June 2026**, with CS0-003 retiring 22 December 2026. By the time anyone reads this much past the review date, CS0-004 will be the only sittable version — check CompTIA's exam blueprint page for the current code. The crypto-track material maps to Domain 1.

- **Domain 1 — Security Operations.** Specifically the analyst's role in identifying credential-exposure events in code reviews, in CI/CD pipeline logs, and in incident-response casework. Secret-scanning tools (gitleaks, TruffleHog, GitHub Secret Scanning) are named tools in the domain.[^trufflehog-secret-scanning]

**Sample question framing:**

> A security analyst reviewing a CI/CD pipeline notices that an application's deployment script reads a base64-encoded file at deploy time and exports the decoded contents as an environment variable containing an API key. Which of the following actions should the analyst recommend FIRST?
>
> A. Rotate the affected API key and remove the encoded file from the repository history
> B. Update the script to use AES-256 encryption with a hardcoded key
> C. Configure the CI/CD platform to mask the environment variable in logs
> D. Document the finding for the next quarterly security review

The trap is B — substituting one in-repo "protection" for another. C is real but secondary. D defers a same-day-action finding. **A** is correct: the credential is compromised the moment it lived in the repo, encoded or otherwise; rotation is mandatory, and the historical exposure must be cleaned from git history (`git filter-repo` or BFG Repo-Cleaner; the file shows up forever in `git log -p` until the history is rewritten and force-pushed). CySA+ rewards "treat it as compromised, rotate first" as the canonical incident-response reflex.

### (ISC)² Certified in Cybersecurity (CC) and SSCP

(ISC)²'s Certified in Cybersecurity (CC) is the entry-level cert (ISC)² introduced in 2022 as a Security+ alternative and a feeder pipeline into CISSP.[^cert-sscp][^cert-cissp] (ISC)²'s SSCP (Systems Security Certified Practitioner) is the operational-practitioner cert one rung up. Both certs cover cryptography in their respective syllabi.

- **CC Domain 5 — Security Operations.** Cryptography fundamentals, including the encoding-vs-encryption distinction, are introduced at the recognition level. CC questions are simpler and more definitional than Security+ — expect direct questions like "Which of the following is *not* a cryptographic operation?" with base64 among the choices.
- **SSCP Domain 5 — Cryptography.** Deeper coverage including symmetric/asymmetric primitives, key management, PKI, and digital signatures. SSCP candidates should be able to explain why base64 is a transport encoding, why ROT-13 is a substitution cipher with effectively no key, why XOR with a fixed constant (Cisco Type-7's mechanism) is not encryption in any modern sense, and what the actual algorithm boundaries are.

**Sample question framing (CC):**

> Which of the following correctly describes Base64?
>
> A. A symmetric encryption algorithm using a 64-bit key
> B. A hash function producing a 64-byte output
> C. An encoding scheme that maps binary data to printable ASCII characters
> D. A public-key cryptosystem based on elliptic curves

The answer is **C**. The CC exam is heavy on terminology recognition; the question is testing whether the candidate can correctly classify base64. The traps (A, B, D) are real things but they're entirely different categories of operation.

### CISSP

CISSP is the senior-level (ISC)² certification, intended for security professionals with five or more years of experience. The current exam still follows the **2024 CBK refresh** (next refresh expected in 2027 on the standard three-year cycle). CISSP has eight domains; the crypto-track material concentrates in one of them.

- **Domain 3 — Security Architecture and Engineering.** This domain covers cryptography in depth. CISSP candidates are expected to articulate: cryptographic primitives (symmetric, asymmetric, hash, MAC, AEAD); failure modes (algorithm weakness, key-management failure, side-channel attacks, implementation bugs, *category errors* like Theo's); the role of key-management infrastructure; and the broader question of when to use cryptography versus when to design the problem out of existence.

CISSP question framings are notoriously oblique. They reward thinking like an architect or a CISO, not like an engineer. The "best answer" is usually the one that addresses governance and design, not the one that solves the narrow technical problem.

**Sample question framing:**

> As the CISO of a PCI-DSS-regulated organization, you are reviewing a post-incident report finding that a junior engineer base64-encoded a production payment-processor API key in a deployment script, believing this constituted encryption. The credential was not exfiltrated. Going forward, which of the following should be your PRIMARY focus?
>
> A. Disciplinary action against the engineer
> B. Mandatory cryptography training for all engineering staff
> C. Implementation of a secrets-management platform with mandatory integration into the CI/CD pipeline, plus pre-commit credential scanning as a non-negotiable code-review gate
> D. Hiring of a dedicated application-security engineer

The trap is that A, B, and D are all reasonable executive responses. **C** is the CISSP answer — it addresses the *structural* gap that allowed the finding to reach production. A is punitive without preventive value. B is necessary but not sufficient. D is a hire that takes months; C is a system that prevents the recurrence regardless of which engineer is at the keyboard. CISSP consistently rewards the answer that builds the durable control.

### OSCP / PEN-200

The Offensive Security Certified Professional is the most-recognized hands-on offensive certification.[^cert-oscp] The exam is a 24-hour practical hands-on test against a set of target machines, with a separate report due afterward.

The OSCP methodology applied to the Vesta scenario is a textbook example of the "credential-recovery in source-controlled artifacts" play. The OSCP curriculum specifically teaches:

```bash
# Once you have repo access (cloned, leaked, or recovered)
grep -r -i "api[_-]key\|secret\|password\|token" .
grep -r -E "[A-Za-z0-9+/]{40,}={0,2}" .   # base64-looking strings
find . -name "*.b64" -o -name "*.encoded" -o -name "*.enc"
git log --all -p -S "API_KEY"             # search history for the string
git log --all -p -- "**/*.b64"            # search history for files
```

The combination of (find the encoded file) and (decode it with one command) is OSCP entry-level credential recovery. The exam grades the *pivot* — finding the API key is worth points; using it to authenticate against the live service is worth more. The candidate who pulls the API key out of `api-key.b64` and then immediately tries it against the corresponding service's authentication endpoint is doing the canonical OSCP enumeration loop.

The OSCP curriculum also covers `git filter-repo` and BFG Repo-Cleaner as the *defender's* tools for cleaning credentials out of git history, with the understanding that until those tools are run, the credential is available to anyone who can `git clone --mirror` the repo. This is the half of the lesson that distinguishes the offensive view (credential is in scope until proven otherwise) from the defensive view (credential is in scope until cleaned from history and rotated).

## §7 — What a defender does

The Vesta scenario is not theoretical. Every defender working on a payment-handling system — and every engineer working on any production code at any scale — has to answer this question concretely. Here's what the work looks like.

**1. Move every credential to a secrets manager.** AWS Secrets Manager, HashiCorp Vault, Doppler, 1Password Secrets Automation, Bitwarden Secrets Manager, Akeyless, Infisical — any of them. The credential lives in the secrets manager; the application fetches it at runtime via an authenticated identity (IAM role for AWS, AppRole for Vault, OIDC for cloud-native CI). The credential never appears in source control, never appears in a configuration file checked into a repository, never appears in environment variables that get copied around. For Vesta specifically, AWS Secrets Manager is the obvious choice if Vesta is on AWS (which most likely they are — the deploy.sh hands off to kubectl, suggesting EKS or similar). The Stripe-side API-key rotation has a built-in "rotate without downtime" workflow; Secrets Manager can drive the rotation automatically.

**2. Rotate the exposed key, immediately and completely.** Once a credential has lived in a repository — encoded or otherwise — it must be treated as compromised. Stripe (and Vesta's in-house gateway) supports issuing a new key, running both old and new in parallel for a brief cut-over window, and then revoking the old key. The cut-over should happen in hours, not days. The rotation log goes into the IR documentation and the PCI-DSS evidence trail.[^pci-dss-v4-0-1-2][^pci-dss-v4-0-1]

**3. Clean the credential from git history.** Until the credential is removed from history, anyone with `git clone --mirror` access can recover it. The tools are `git filter-repo` (the modern, recommended successor to `git filter-branch`) or BFG Repo-Cleaner. The procedure rewrites history, requires a force-push, and breaks every existing clone — which is why it should be done as a coordinated event with the engineering team, not silently. After the rewrite, the team destroys local clones and re-clones from the cleaned remote.

**4. Add credential scanning to the CI/CD pipeline as a non-negotiable gate.** gitleaks, TruffleHog, GitHub Advanced Security Secret Scanning, GitLab Secret Detection, GitGuardian — any of them runs as a pre-commit hook and as a CI gate.[^gitguardian-secret-detection] Configure the rules to flag (a) recognized credential patterns (Stripe keys, AWS access keys, Google API keys, JWT structure, etc.), (b) base64-shaped strings of certain lengths in source files, and (c) explicit anti-patterns (any file named `*.b64`, `*.encoded`, `*.secret` checked into the repo). Configure the gate to *block* the merge, not just warn — warnings get ignored.

**5. Pre-commit hooks at the developer-workstation level.** The CI gate catches the merge attempt; a pre-commit hook catches the commit attempt before it ever reaches the remote. The `pre-commit` framework (https://pre-commit.com) plus the gitleaks pre-commit hook covers this. The hook adds maybe 200ms to each commit and saves real incidents.

**6. Training for the team, not punishment for the engineer.** Theo's mistake is a category error — encoding confused with encryption. The training-budget item is small: a 30-minute workshop on the encoding/encryption/hashing trichotomy, with worked examples (base64, ROT-13, Cisco Type-7 on the encoding side; AES, ChaCha20 on the encryption side; SHA-256, bcrypt, Argon2 on the hashing side), plus a one-page internal-wiki article ("base64 is not encryption" linked from the code-review checklist). The training cost is hours. The control-improvement cost of NOT doing the training is the next Theo making the next base64 mistake in six months.

**7. Sample detection rule (Sigma, generic source-control commit):**

```yaml
title: Base64-encoded credential pattern committed to repository
status: experimental
description: Detects commits that introduce files matching common
  encoded-credential anti-patterns, including base64-shaped strings
  of sufficient length to plausibly be a credential.
logsource:
  product: git
  service: pre-commit
detection:
  file_extension:
    extension:
      - 'b64'
      - 'encoded'
      - 'enc'
  base64_in_content:
    content|re: '^[A-Za-z0-9+/]{40,}={0,2}$'
  condition: file_extension or base64_in_content
level: high
falsepositives:
  - Legitimate base64-encoded test fixtures, marked as such
  - Image data inadvertently included in test payloads
```

This rule, run as a pre-commit hook against staged files, would have flagged Theo's commit before it merged.

**8. Audit cadence.** Quarterly credential-scanning audits across the entire repository inventory. Annually, a full source-control sweep with history scanning enabled (the credentials that pre-date the credential scanner are the ones most likely to still be there). The audit produces a list of findings; remediation has a defined SLA.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run a particular command — `progress --detail` from any prompt lists what you've unlocked.

### The Vendolux coffee machine

**Trigger:** `cat engagement-notes.md` (you ran this as step 1 of the solve, so the bonus fires there)

**What it teaches:** Priya's notes end with a deliberately unrelated aside about the floor-4 coffee machine that still takes nickels four months after Daniel called the vendor. That coffee-machine paragraph is *the same shape* as Theo's base64 API-key story. In both:

- One competent person identifies a problem.
- One competent person tries to do the right thing about it.
- That person has no organizational backing — no ticket, no follow-up cadence, no named-owner accountability for the outcome.
- The problem persists indefinitely.

The pattern name in real consulting work is **lone effort without organizational ownership**. It is not solved by *more effort from the lone person* (Daniel calling Vendolux a second time will not fix the coffee machine; Theo writing a more thoroughly base64'd key will not fix his key-handling). It is solved by **moving the problem into an organizational queue with an owner**: a ticket in the team's backlog, a name attached, a date attached, escalation path defined. Then the issue lives or dies on its own merit instead of on the willingness of one person to keep calling Vendolux.

This is also the shape of why secret-management migrations stall at most consulting clients. The engineer who's bothered enough to advocate for HashiCorp Vault or AWS Secrets Manager is rarely the engineer with the time, authority, or political capital to lead the migration. Same coffee-machine pattern, larger blast radius.

## §8 — Key takeaways

- **Encoding is not encryption.** Base64 is a transport format. Hex is a transport format. ROT-13 is a substitution cipher with no key. Cisco Type-7 is XOR with a known constant. None of these provide cryptographic protection; all of them have been mistaken for encryption in production code, including in code that handles credentials. The encoding-vs-encryption distinction is a foundational concept in every cybersecurity cert curriculum because it is a foundational mistake in every credential-exposure incident report.
- **The moment a secret touches source control, it is no longer a secret.** Encoded, encrypted, or not, the credential's exposure window starts at the commit and ends only after rotation plus a history-cleaning rewrite. There is no "fix in next commit" path that preserves the original credential's secrecy.
- **The category of mistake matters more than the value of the credential.** Theo's API key happens to be a payment-processor key; the same category error with a database password, an SSH key, a JWT signing key, or an OAuth client secret would land in the same place. The defender's playbook is the same regardless of what the credential authorizes.
- **Junior engineers will make this mistake. The system's job is to catch it before it reaches production.** Pre-commit hooks, CI/CD gates, secret scanners, and code-review checklists are not redundancies — they are layers, each catching what the prior layer missed. The mature engineering organization has all of them.
- **The conversation with Theo is the deliverable, not just the finding.** Saanvi wants the technical issue surfaced AND the engineer brought up to speed without making him feel small. The cited frameworks (CWE-261, PCI-DSS 3.5, the Cisco Type-7 historical parallel) are the language that makes the conversation precise and impersonal. The lesson lands when the engineer leaves the meeting understanding the category error, not when they leave feeling bad about the commit.

## §9 — Further reading

*Last reviewed: August 2026. External standards versions and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

[^pci-dss-v4-0-1]: [PCI-DSS v4.0.1 — PCI Security Standards Council document library](https://www.pcisecuritystandards.org/document_library/).
[^pci-dss-v4-0-1-2]: [PCI-DSS v4.0.1 announcement (PCI SSC blog)](https://blog.pcisecuritystandards.org/just-published-pci-dss-v4-0-1).
[^nist-800-57]: [NIST SP 800-57 Part 1 Rev. 5 — Recommendation for Key Management, General](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final).
[^nist-800-131a]: [NIST SP 800-131A Rev. 2 — Transitioning the Use of Cryptographic Algorithms](https://csrc.nist.gov/pubs/sp/800/131/a/r2/final).
[^rfc-4648]: [RFC 4648 — The Base16, Base32, and Base64 Data Encodings](https://datatracker.ietf.org/doc/html/rfc4648).
[^cwe-261]: [CWE-261 — Weak Encoding for Password](https://cwe.mitre.org/data/definitions/261.html).
[^cwe-326]: [CWE-326 — Inadequate Encryption Strength](https://cwe.mitre.org/data/definitions/326.html).
[^cwe-256]: [CWE-256 — Plaintext Storage of a Password](https://cwe.mitre.org/data/definitions/256.html).
[^cwe-798]: [CWE-798 — Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
[^owasp-top-10-2025]: [OWASP Top 10:2025](https://owasp.org/Top10/2025/).
[^owasp-a04-2025]: [OWASP Top 10:2025 — A04:2025 Cryptographic Failures (deep link)](https://owasp.org/Top10/2025/A04_2025-Cryptographic_Failures/).
[^t1552-001]: [MITRE ATT&CK — T1552.001: Unsecured Credentials — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/).
[^hashicorp-vault-getting-started]: [HashiCorp Vault — Getting Started](https://developer.hashicorp.com/vault/tutorials/get-started).
[^aws-secrets-manager-user-guide]: [AWS Secrets Manager — User Guide](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
[^doppler-universal-secrets-platform]: [Doppler — Universal secrets platform](https://www.doppler.com/).
[^trufflehog-secret-scanning]: [TruffleHog — Secret scanning](https://github.com/trufflesecurity/trufflehog).
[^gitguardian-secret-detection]: [GitGuardian — Secret detection](https://www.gitguardian.com/).
[^bfg-repo-cleaner-git-history]: [BFG Repo-Cleaner — Git history rewriting](https://rtyley.github.io/bfg-repo-cleaner/).
[^cert-cissp]: [ISC2 CISSP — certification exam outline](https://www.isc2.org/certifications/cissp/cissp-certification-exam-outline).
[^cert-sscp]: [ISC2 SSCP — Systems Security Certified Practitioner](https://www.isc2.org/certifications/sscp).
[^cert-security-plus]: [CompTIA Security+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/security/).
[^cert-cysa]: [CompTIA CySA+ — certification page and exam objectives](https://www.comptia.org/en-us/certifications/cybersecurity-analyst/).
[^cert-oscp]: [OffSec PEN-200 / OSCP — course syllabus and exam guide](https://www.offsec.com/courses/pen-200/).
[^nist-800-152]: [SP 800-152 — A Profile for U.S. Federal Cryptographic Key Management Systems](https://csrc.nist.gov/pubs/sp/800/152/final).

### Further reading

- [NIST SP 800-53 Rev. 5 — Security and Privacy Controls](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final).
- [MITRE ATT&CK — T1027: Obfuscated Files or Information](https://attack.mitre.org/techniques/T1027/).
- [MITRE ATT&CK — T1027.013: Encrypted/Encoded File](https://attack.mitre.org/techniques/T1027/013/).
- [CircleCI Security Incident — January 2023 (CircleCI blog post-mortem)](https://circleci.com/blog/jan-4-2023-incident-report/).
- [Uber September 2022 security incident — Uber Newsroom](https://www.uber.com/us/en/newsroom/security-update/).
- [Cisco — "Cisco IOS Password Encryption Facts" (Type 7 vs Type 5/8/9 documentation)](https://www.cisco.com/c/en/us/support/docs/security-vpn/remote-authentication-dial-user-service-radius/107614-64.html).
- [gitleaks — Secret scanning](https://github.com/gitleaks/gitleaks).
- [pre-commit framework — Pre-commit hook orchestration](https://pre-commit.com/).
- [git-filter-repo — Git history rewriting (BFG successor)](https://github.com/newren/git-filter-repo).
- [Verizon Data Breach Investigations Report (DBIR) — annual](https://www.verizon.com/business/resources/reports/dbir/).
- [IBM Cost of a Data Breach Report — annual](https://www.ibm.com/reports/data-breach).

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
