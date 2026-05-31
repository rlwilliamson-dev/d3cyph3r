# level2@crypto — Theo's Quick Hash

**Track:** Crypto · **Client:** Vesta Retail (continued) · **Compliance regime:** PCI-DSS v4.0.1 + (post-finding) PCI QSA Phase-2 remediation

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level3@crypto`. If you haven't solved `level2@crypto` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough also assumes you've worked through `level0@crypto` and `level1@crypto`; this level continues their narrative directly.

---

## §1 — The setup

Day three at Vesta Retail. Yesterday's level1 finding (Theo's homegrown JWT middleware accepting `alg: none` tokens) closed clean on the technical side — Theo took the news, his patched verify middleware is in code review, and the rotation is scheduled. But Saanvi (CISO) escalated. After Priya walked her through the JWT decode in the morning, Saanvi pulled the PCI QSA call forward to noon and gave the same instruction she always gives in that situation: *"I want to know what else Theo shipped recently that I should be looking at."* Priya spent an hour walking Theo's recent commits with her. Most are fine. One is not.

From the deploy repo, six months ago:

```
commit a9c1f0e Theo Hassan
Date:   2024-06-15 14:22
Subject: backup-passwords: safer than plaintext

Md5'd all the production passwords so they're not
plaintext in the repo anymore. Hashes are safer right?
Don't share lol.
```

The file is `backup-passwords.txt` — 200 lines, two columns. The left column is an MD5 hash. The right column is a label naming the production system the password gates. Theo's commit comment is the entire engineering rationale.

You used the `vesta-admin-handoff-2026` token from yesterday's JWT decode to ssh into Vesta's admin host (`admin.vesta.internal`). The prompt now reads `vesta-admin@admin:~$`. Saanvi has 15 minutes before the QSA call and wants the exact number of cracked hashes, the exact plaintexts, and the exact label-to-plaintext mapping. The QSA needs to know whether the AES backup encryption Theo did last quarter is, by the control's definition, encrypted.

Three failures stack here. Each one alone would be a finding; together they produce an instant-Phase-2-remediation conversation.

1. **Yesterday's CWE-347 alg:none JWT** — covered in level1; produced the cred that landed you on this box.
2. **Theo's choice of MD5 unsalted** — modern GPUs hash MD5 at ~50 billion/s. Against the 14M-entry rockyou wordlist that's roughly 300 microseconds of compute. The "hash" provides zero work-factor protection (CWE-916, the canonical CWE for this exact failure mode).
3. **Theo's password reuse** — the four hashes that crack all share the same plaintext. One plaintext gates the admin login, the prod-DB account, the AES backup encryption key, and the S3 read-only service. Rotating one means rotating four (CWE-521 + CWE-262, plus PCI-DSS v4.0 §8.3 explicitly).

Priya, briefing you in chat as you SSH'd in: *"hash-id, then john. Read the FULL john output — the QSA call wants the exact number of cracked hashes and the exact plaintexts. Multiple labels with the same plaintext is the finding Saanvi's going to lead with. The aes-backup label specifically — Theo encrypted last quarter's payment-card token backup with that password. If the plaintext is in the crackable set, the encrypted backup is functionally plaintext from a PCI standpoint."* That's your scope.

Cross-track foreshadowing: Halton Bank's track produced a structurally identical pattern from the opposite direction. Halton's password POLICY mandated the same string format across the DB and the bastion login, so one leaked file traversed multiple systems by design (level2@linux). Vesta has the same blast-radius math from a different cause — Theo's individual choice rather than institutional policy. Both reach the same place. The lobby's structure where you can walk these tracks in any order is real; the *narrative* is also real — they're a shared Driftwood book of business, with shared engineering antipatterns.

## §2 — The solve

Four commands. The crypto-track discipline this level is in reading the john output slowly. The first thing the player wants to do after running `john` is grab the breadcrumb and pivot — but every cracked line is part of the finding Saanvi has to take to the QSA call.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level2@crypto
level2@crypto's password: vesta-admin-handoff-2026
```

The password is the `handoff_token` claim you decoded from yesterday's alg:none JWT in `admin-access.log`. The token's empty signature didn't matter; the value was right there in the payload, base64url-encoded. Theo's homegrown verify middleware passed the token because `alg: none` told it not to verify. Atlas's logging caught the issue; Saanvi pulled the wider review. Same chain: every Driftwood crypto-track finding ends up surfacing the next one.

The connection banner identifies the host (`admin.vesta.internal`) and the tier (Routine, ~15 min). Read `welcome.md` first — it introduces `hash-id` and `john`, explains why hashes aren't a safety net, and outlines the order of operations.

```bash
vesta-admin@admin:~$ cat welcome.md
```

`welcome.md` documents the day-three context, the new commands, and the conceptual frame ("a hash function is not a safety net if the input is in a wordlist somebody already has"). The 5-step HOW TO PLAY block names the exact command sequence.

### Step 2: Read Priya's note + the backup-passwords file

```bash
vesta-admin@admin:~$ cat priya-note.md
vesta-admin@admin:~$ cat backup-passwords.txt
```

Priya's note carries the rules of engagement (don't ssh anywhere else, don't authenticate to production with anything you crack — the QSA wants the *finding*, not the *demonstration*) and the framing Saanvi will use for the QSA call. The note specifically calls out the `aes-backup` label as the high-priority item: if the plaintext for that label cracks, the encrypted payment-card token backup is functionally plaintext from a PCI standpoint.

`backup-passwords.txt` opens with Theo's commit comment as a header, then 200 hash-and-label rows. The header reads:

```
# backup-passwords.txt
# Theo's safer prod creds file (md5'd) — 2024-06-15 commit
# (don't share lol)
# format: <md5-hex>  <label>
```

The first few data rows:

```
e10adc3949ba59abbe56e057f20f883e  theo@admin
21232f297a57a5a743894a0e4a801fc3  theo@db-prod
482c811da5d5b4bc6d497ffa98491e38  aes-backup
da25e54ef34fb0d8a35a78fcbb8db95f  s3-readonly
ee11cbb19052e40b07aac0ca060c23ee  monitoring-svc
...
```

The label column is the production system the password gates. The MD5 column is what Theo "made safe."

### Step 3: hash-id confirms MD5

```bash
vesta-admin@admin:~$ hash-id backup-passwords.txt
Analyzing: e10adc3949ba59abbe56e057f20f883e
(file contains 38 hashes — analyzing the first)

[+] Possible algorithms:
    MD5         (most likely — 32 hex chars, very common)
    MD4
    NTLM

[!] MD5 is cryptographically broken. Crack with: john backup-passwords.txt
```

The 32-hex-character pattern matches MD5, MD4, and NTLM. NTLM is Windows-side, MD4 is rare. In a 2024-vintage password file committed by a web developer, MD5 is the overwhelming default. The hint at the bottom is the engine's prompt — `john backup-passwords.txt` is the next step.

(The "38 hashes" line is the engine's count of visible hash rows in the on-disk file; Theo's actual file contains 200 — the displayed truncation is for readability. The `hash-id` extension shipped in v1.27.0 was added specifically so multi-hash files surface this count rather than failing to detect a format from the first non-comment line.)

### Step 4: john cracks four hashes — all the same plaintext

```bash
vesta-admin@admin:~$ john backup-passwords.txt
Using default input encoding: UTF-8
Loaded 200 password hashes (Raw-MD5)
Using wordlist: /usr/share/wordlists/rockyou.txt
Press CTRL-C to abort, almost any other key for status

[+] Running dictionary attack...
[+] Trying top 1000 most common passwords...

TheoVesta!1          (theo@admin)
TheoVesta!1          (theo@db-prod)
TheoVesta!1          (aes-backup)
TheoVesta!1          (s3-readonly)

4g 0:00:00:00 DONE (2024-01-01 12:00) 4/200 cracked
Session completed.

  ✦ Bonus find unlocked: The same plaintext cracks four of Theo's hashes
    john's session summary shows 4g cracked — four hashes, all the same plaintext (TheoVesta!1). Theo reused one weak password across the admin login, the prod-DB account, the AES backup encryption, and the S3 read-only credential. Same-string-different-system collapses four security boundaries into one credential rotation; CWE-521 + CWE-262 in textbook form. (Halton Bank's policy in the linux track has the same shape — different industry, same antipattern.)
```

Four observations.

**Observation one: 4 out of 200 cracked in zero seconds of wall-clock time.** That's a 2% crack rate against the default rockyou wordlist with no mangling rules applied. With rockyou's mangling rule set (john's `--rules` flag invokes the default Single rule, which produces a few hundred mutations per dictionary word: capitalization, common digit-and-symbol appends like `!`, `1`, `123`, leet-speak substitutions like `o→0` / `a→@`), the crack rate against an unsalted-MD5 file like Theo's would climb into the 15-30% range in another minute. The four hashes that cracked first are the ones whose plaintexts are exact matches for entries in the wordlist's main body — i.e., common passwords by any definition.

**Observation two: all four cracks are the same plaintext.** `TheoVesta!1` gates the admin login (`theo@admin`), the prod-DB account (`theo@db-prod`), the AES backup encryption (`aes-backup`), and the S3 read-only service (`s3-readonly`). Four production systems, one credential string. This is the same-string-different-system antipattern (CWE-521 + CWE-262) and it's the finding Saanvi promised to lead with at the QSA call. It's also the textbook example for why CWE-759 (Use of a One-Way Hash without a Salt) matters: per-password salt would have produced four distinct hash outputs for the same plaintext, and john would have cracked one of them — not all four simultaneously.

**Observation three: `aes-backup` is in the cracked set.** Last quarter's payment-card token backup was encrypted with `TheoVesta!1`. PCI-DSS v4.0.1 §3.5.1 requires strong cryptography for stored account data; the working PCI Council definition of "strong cryptography" includes BOTH the cipher AND the key. The cipher Theo used (AES-128) qualifies. The key (`TheoVesta!1`, recoverable in <1 second from rockyou.txt) does not. The encrypted backup is, by the control's definition, functionally plaintext.

**Observation four: the bonus banner.** The Theo-password-reuse bonus fires on the `4g` session-summary string in the john output. The bonus name and hint articulate the four-systems-one-rotation math directly.

### Step 5: The 2009 RockYou provenance (optional exploration)

```bash
vesta-admin@admin:~$ cat /usr/share/wordlists/README.rockyou
```

The wordlist next to `rockyou.txt` ships a README documenting where the dictionary came from. The opening paragraph names the 2009 RockYou.com SQL-injection breach (~14.3M plaintext passwords), the technical reason it became the canonical wordlist for offline dictionary attacks (large, plaintext, mangling-rule-friendly, free), and the historical context (RockYou had been storing passwords unhashed; the SQL injection exposed the entire production user database).

```
README.rockyou — distribution notes

The rockyou.txt wordlist shipped with this distribution is
derived from the December 2009 RockYou.com SQL-injection breach,
which exposed approximately 14,341,564 plaintext passwords from
the RockYou social-game accounts database.
...

  ✦ Bonus find unlocked: The rockyou.txt wordlist on disk is the 2009 RockYou.com leak
```

The point of the bonus isn't trivia. The argument "we used a unique password" only holds against an attacker whose wordlist is a known fixed set. rockyou.txt has been in the public domain for 15+ years; every modern wordlist-based attack chain still descends from it; "unique" against rockyou requires demonstrating your password is not a near-neighbor of any of the 14 million entries (or any combination produced by standard mangling rules against any of them). That's a higher bar than most users understand.

### Step 6: Return to the lobby with the finding

```bash
vesta-admin@admin:~$ exit
```

You have the finding. Saanvi has the meeting. The deliverable is short: 4 hashes cracked in zero seconds; 1 plaintext (`TheoVesta!1`) gates 4 systems including the AES backup; the AES backup is functionally plaintext from a PCI standpoint; coordinated rotation across all four systems is non-negotiable; longer-term remediation is move-to-Argon2id + adopt a secrets manager + repo-credential scanning at the commit gate.

## §3 — The vulnerability

The lesson the level teaches in one sentence: **a hash function is not a safety net if the input domain is enumerable and the function is fast.**

The longer version has three stacked layers.

**Layer one — hash-vs-encryption confusion.** A cryptographic hash function maps an arbitrary-length input to a fixed-length output that's "one-way" — you can't invert it cryptographically. That property is useful for integrity checking (the SHA-256 in TLS certificate fingerprints, the BLAKE2 in `git` object IDs, the SHA-256 in file checksums) because verifying that two values produce the same hash is a cheap operation that proves the values match. The property is also useful for *authentication of values you already know*: a server stores `hash(password+salt)` and verifies a login attempt by computing `hash(attempt+salt)` and comparing. Theo's confusion — and it's common — is that the one-way property makes the hash "safe" against an attacker who has the hash file. It doesn't. The attacker doesn't need to invert the hash cryptographically; they need to *guess plaintexts that hash to the value they have*. If the input domain is small (e.g., user-chosen passwords drawn from human-recognizable text), guessing is cheap.

**Layer two — fast hash functions are a force multiplier for the attacker.** MD5 was designed in 1991 for integrity checking, not password storage. On modern GPU hardware it computes at roughly 50 billion hashes/second per top-tier consumer GPU and ~250 billion/second on dedicated password-cracking hardware. The 14M-entry rockyou wordlist therefore takes about 300 microseconds of compute time to hash end-to-end. With mangling rules (which expand the wordlist by 100-1000x), the attack still completes in seconds. The same math applies to SHA-1 (~30 billion/s on GPU), SHA-256 (~10 billion/s), and any other "general-purpose" hash. The mitigation isn't "use a stronger hash" — it's "use a function that's *deliberately* slow."

**Layer three — salt + per-password salts + memory-hard cost factors.** The deliberately-slow-function family is called the "Password-Based Key Derivation Functions" (PBKDFs) and the current best-practice members are:

- **Argon2id** — winner of the Password Hashing Competition (2013-2015), specified in [RFC 9106](https://datatracker.ietf.org/doc/html/rfc9106). Tunable parameters: iterations, memory cost (Argon2 is memory-hard, meaning the attacker has to allocate significant RAM per guess, which negates GPU parallelism), parallelism. Default 2025-era starting parameters: 2-3 iterations, 64 MiB memory, parallelism 1. The named recommendation in NIST SP 800-63B-4 §5.1.1.2 and OWASP ASVS V2.4.
- **scrypt** — older (2009), memory-hard. Parameters: N (CPU/memory cost), r (block size), p (parallelism). Used by Dogecoin, Litecoin, and (historically) some KDF libraries.
- **bcrypt** — older still (1999), based on Blowfish. Cost-factor parameter (`$2b$12$...` is cost 12). Not memory-hard, but the cost factor is well-understood and the function is mature. Widely deployed (Django, Laravel, Spring Security, Ruby's `BCrypt::Password`).
- **PBKDF2** — oldest (RFC 2898, 2000; updated in [RFC 8018, 2017](https://datatracker.ietf.org/doc/html/rfc8018)). Not memory-hard. Used because it's FIPS-approved and required for some federal compliance contexts ([the PBKDF2 Wikipedia entry summarising NIST SP 800-132](https://en.wikipedia.org/wiki/PBKDF2) is the federal recommendation).

All four use a per-password salt (a random 16-32 byte value stored alongside the hash output) so that identical plaintexts hash to distinct outputs. The salt defeats rainbow-table attacks (which precompute hash→plaintext mappings for common passwords) AND defeats john's bulk-cracking parallelism (each guess has to be hashed independently against the target's salt).

Theo used MD5 with no salt, which combines all three failure modes. The four hashes that share a plaintext all produce the same output, so cracking one cracks four. The function is fast, so cracking is microseconds. The input is in rockyou, so the search space is bounded. Every modern password-storage doctrine exists specifically to make at least one of those three conditions false; Theo's "I made it safe" commit made none of them false.

## §4 — Real-world parallels

**LinkedIn 2012 (and 2016).** In June 2012 LinkedIn confirmed a breach exposing ~6.5 million SHA-1 unsalted password hashes. The breach was originally thought to be the full scope until 2016, when a credential broker offered ~117 million LinkedIn hashes from the same incident for sale on the dark web. SHA-1 unsalted has the same operational properties Theo's MD5 unsalted file does — fast, per-password-distinct-only-if-the-plaintexts-differ, vulnerable to bulk dictionary attacks. The 2016 disclosure led to forced password resets for every LinkedIn user that hadn't changed their password since 2012. [Have I Been Pwned's LinkedIn page](https://haveibeenpwned.com/PwnedWebsites#LinkedIn) summarizes the breach metadata; LinkedIn's own [2012 security advisory](https://blog.linkedin.com/2012/06/09/an-update-on-taking-steps-to-protect-our-members) is preserved in their blog.

**RockYou 2009 — the wordlist itself.** In December 2009 the social-game company RockYou suffered an SQL injection that exposed approximately 14,341,564 plaintext passwords from its accounts database. The company had been storing passwords unhashed; the SQL injection returned the full table. The fact that the plaintexts were available, large in number, and represented real human password choices made the leaked dataset the canonical wordlist for every offline dictionary attack since. It's the wordlist john pointed at to crack Theo's hashes. The [TechCrunch coverage of the disclosure](https://techcrunch.com/2009/12/14/rockyou-hacked/) and [the Wikipedia case study](https://en.wikipedia.org/wiki/RockYou) carry the consolidated record, including the subsequent FTC settlement covering COPPA violations.

**Adobe 2013.** In October 2013 Adobe disclosed a breach affecting ~153 million accounts. The passwords had been encrypted (not hashed) with 3DES in ECB mode — and ECB-mode encryption with no per-record IV produces identical ciphertext for identical plaintexts (the same structural failure as MD5 unsalted, on a different cipher). The breach also exposed password hints, which combined with the ECB ciphertext patterns made bulk plaintext recovery dramatically easier than the cipher alone would have allowed. [Sophos's analysis](https://nakedsecurity.sophos.com/2013/11/04/anatomy-of-a-password-disaster-adobes-giant-sized-cryptographic-blunder/) and the [XKCD-style visualization of ECB on the Adobe data](https://nakedsecurity.sophos.com/2013/11/04/anatomy-of-a-password-disaster-adobes-giant-sized-cryptographic-blunder/) are the most-cited references.

**Yahoo 2013 (3 billion accounts) and 2014 (500M).** Yahoo disclosed two breaches in 2016 affecting respectively all 3 billion Yahoo accounts (the 2013 breach, revised upward in 2017) and 500 million accounts (the 2014 breach). The 2013 breach exposed unsalted MD5 hashes — the same primitive Theo used. The [Wikipedia consolidated case study](https://en.wikipedia.org/wiki/Yahoo_data_breaches) documents the scope and the underlying SEC 8-K filings.

**Ashley Madison 2015.** The Ashley Madison breach disclosed in August 2015 exposed ~36M user records. The site had used bcrypt (cost 12) for password storage on the modern auth path — but had ALSO retained a legacy MD5 hash for ~11M users from an earlier auth version that was supposed to be deprecated. The MD5 hashes were cracked at industrial scale within weeks; the bcrypt-only accounts remained mostly uncracked because of bcrypt's cost factor. The case is the textbook example of why "we switched to bcrypt" without removing legacy weak hashes leaves the weak hashes as the operative security boundary. [CynoSure Prime's writeup](https://cynosureprime.blogspot.com/2015/09/how-we-cracked-millions-of-ashley.html) documents the technical work; [Wikipedia's article](https://en.wikipedia.org/wiki/Ashley_Madison_data_breach) carries the broader case study.

**Have I Been Pwned + the Pwned Passwords API.** Troy Hunt's [Have I Been Pwned](https://haveibeenpwned.com/) service aggregates breach corpora into a queryable database; the [Pwned Passwords API](https://haveibeenpwned.com/Passwords) specifically exposes the union of all passwords that have appeared in any breach corpus. As of 2025 the database contains ~850 million unique passwords. Modern auth platforms (Cloudflare Zero Trust, 1Password, Bitwarden, JumpCloud, Okta) integrate Pwned Passwords lookups at registration to block known-bad password choices. NIST SP 800-63B-4 §5.1.1 codifies this approach: the standard requires verifiers to reject passwords found in a "list of values known to be commonly-used, expected, or compromised," and HIBP is the de-facto implementation. Vesta does not run this check today; if they did, Theo's password choice would have been rejected at creation.

## §5 — Frameworks, deep dive

**CWE-916: Use of Password Hash With Insufficient Computational Effort.** The surgical CWE for the MD5-on-GPU failure. The catalog entry's recommended mitigations name Argon2, scrypt, bcrypt, PBKDF2 explicitly. ([MITRE CWE-916](https://cwe.mitre.org/data/definitions/916.html))

**CWE-759: Use of a One-Way Hash without a Salt.** The reason john cracked four hashes simultaneously. The catalog entry mandates per-password random salt. ([MITRE CWE-759](https://cwe.mitre.org/data/definitions/759.html))

**CWE-521: Weak Password Requirements.** `TheoVesta!1` passes a "8+ chars, contains a symbol" policy and fails any modern entropy-aware policy. The catalog entry references NIST SP 800-63B's blocklist-based approach. ([MITRE CWE-521](https://cwe.mitre.org/data/definitions/521.html))

**CWE-262: Not Using Password Aging.** Six months on disk for a password committed to source control. The catalog entry's framing of "credentials that should rotate but don't" applies. ([MITRE CWE-262](https://cwe.mitre.org/data/definitions/262.html))

**CWE-798: Use of Hard-coded Credentials.** The hash-not-plaintext distinction does not move the mapping. The credentials were in source control with read access for everyone with repo permissions. ([MITRE CWE-798](https://cwe.mitre.org/data/definitions/798.html))

**NIST SP 800-63B-4 — Digital Identity Guidelines: Authentication and Lifecycle Management.** Final document published August 2025 ([NIST CSRC SP 800-63B-4](https://pages.nist.gov/800-63-4/)). §5.1.1 (Memorized Secret Verifiers) is the canonical authority for password storage in federal-adjacent contexts. The mandated approach: an approved one-way memory-hard function with a randomly-generated salt at least 32 bits long, an additional secret keyed-hash (HMAC) component stored outside the database. MD5 is explicitly not approved.

**NIST SP 800-132 — Recommendation for Password-Based Key Derivation.** December 2010, the FIPS-approved PBKDF2 specification (covered in [the PBKDF2 Wikipedia entry](https://en.wikipedia.org/wiki/PBKDF2) alongside the algorithm itself). Recommended iteration counts are well understood to need periodic adjustment (the original 2010 recommendation of 1,000 iterations is now considered insufficient; OWASP's current floor is 600,000 iterations for SHA-256-PBKDF2).

**RFC 9106 — Argon2.** September 2021 ([IETF datatracker (RFC 9106)](https://datatracker.ietf.org/doc/html/rfc9106)). The Argon2id specification, including parameter selection guidance. The 2025-era starting parameters (2-3 iterations, 64 MiB memory, parallelism 1) are derived from this RFC plus subsequent OWASP guidance.

**PCI-DSS v4.0.1 §3.5.1 — Strong Cryptography for Account Data.** Account data (PAN, cardholder name, expiration, sensitive authentication data) stored at rest requires strong cryptography. The working PCI Council definition of "strong cryptography" requires BOTH cipher AND key strength. AES-128 with a 12-character password recoverable in <1 second does not qualify. The encrypted token backup Theo created is, per the control, functionally plaintext.

**PCI-DSS v4.0.1 §8.3.2 — Strong Cryptography for Password Hashing.** Requires a one-way cryptographic function that includes a salt. Theo's MD5 unsalted fails both clauses. The PCI QSA's job on Vesta's audit includes confirming that authentication credentials are stored per §8.3.2; the file you just found is the negative finding.

**OWASP Top 10 (2025) — A02 Security Misconfiguration + A04 Cryptographic Failures.** Both apply. A02 covers the broad class "credentials in source control with weak protection." A04 (the modern name for "Sensitive Data Exposure") covers the specific MD5-unsalted choice. ([OWASP Top 10](https://owasp.org/Top10/))

**OWASP Application Security Verification Standard (ASVS) v4.0.3.** V2.4 (Credential Storage) verifies that any password hash uses Argon2 / bcrypt / scrypt / PBKDF2 with appropriate parameters AND includes salt. ([OWASP ASVS GitHub repo](https://github.com/OWASP/ASVS))

**OWASP Password Storage Cheat Sheet.** The most-cited single page on this topic. Recommends Argon2id as the default modern choice, with bcrypt/scrypt/PBKDF2 as situationally-appropriate alternatives. Names the parameter floors. ([OWASP Cheat Sheet Series — Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html))

**CIS Critical Security Controls v8.1.**
- Control 5.2 — Use Unique Passwords. The four hashes being the same plaintext is a direct violation.
- Control 16.4 — Establish and Maintain an Inventory of Application Authorization Methods. Theo's repo-committed credentials bypass the inventory.
- Control 18.6 — Train Workforce on Authentication Best Practices. The "hashes are safer than plaintext, right?" reasoning is what this control exists to update.

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701).** Domain 1.4 (Cryptographic concepts) — symmetric vs hash primitives, salting, PBKDFs. Domain 4.5 (Modify enterprise capabilities to enhance security) — credential management. Wordlist-based dictionary attacks named explicitly. ([CompTIA Security+ cert page](https://www.comptia.org/en-us/certifications/security/))

**CompTIA CySA+ (CS0-003 / CS0-004).** CS0-004 launched in early 2026 for parallel availability; CS0-003 retires June 2026. Domain 1 (Security Operations) — incident response on credential exposure. Domain 4 (Reporting & Communication) — the "what would you tell the auditor" question.

**CompTIA PenTest+ (PT0-003).** Domain 3 (Attacks and Exploits) — Hashcat / John / Hydra naming, rockyou.txt as a named wordlist, salt-aware vs salt-unaware crack approaches.

**(ISC)² CISSP.** Domain 3 (Security Architecture and Engineering) — modern password hashing. Domain 5 (Identity and Access Management) — credential lifecycle.

**OffSec OSCP / PEN-200.** Standard primitive on every lab box. The exam-objective bullets explicitly name `john` and `hashcat` as required tooling. The 2023 curriculum revision added Argon2id as a brief defender-side mention.

**EC-Council CEH v13.** Module 5 (Vulnerability Analysis) and Module 6 (System Hacking) cover hash extraction + dictionary attacks. The v13 release (April 2024) refreshed the password-hashing-recommendations section.

## §7 — What a defender does

**Rotate all four immediately.** The cracked credentials are fungible; attackers harvesting Vesta's repo got all four with one wordlist run. Coordinated rotation is non-negotiable. The token backup the aes-backup password encrypts has to be re-encrypted with a new (strong, unique) key, then the original backup destroyed. The S3 service account requires application-side coordination. The prod-DB password requires connection-string rotation across every consumer.

**Move to Argon2id.** Modern frameworks default to it: Django auth (since 1.10), Spring Security (since 5.7), Laravel (since 5.5 via the `argon` driver), Node's `argon2` npm package, Python's `argon2-cffi`, Ruby's `argon2` gem. The work-factor parameters are the actual security boundary; the OWASP Password Storage Cheat Sheet's 2025 floors (Argon2id: 2 iterations, 19 MiB memory minimum; the level data uses the more conservative 64 MiB starting point) are well-tested. Function name without parameter tuning is theater.

**Per-credential salt at the application layer.** Or — equivalently — adopt a framework's built-in password storage that handles salting transparently. The opt-OUT-of-salting path requires more code than the opt-IN path in every modern framework.

**Block rockyou-class passwords at registration.** [Have I Been Pwned's Pwned Passwords API](https://haveibeenpwned.com/Passwords) is the de-facto implementation; integration is typically ~20 lines of code. The API returns a count of how many breaches the candidate password has appeared in; rejecting any candidate with count > 0 is the standard implementation. NIST SP 800-63B-4 §5.1.1 codifies this requirement; OWASP ASVS V2.1.7 verifies it.

**Scan repos for committed credentials.** [gitleaks](https://github.com/gitleaks/gitleaks), [trufflehog](https://github.com/trufflesecurity/trufflehog), [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning), [GitLab Secret Detection](https://docs.gitlab.com/ee/user/application_security/secret_detection/). All flag hash files. `backup-passwords.txt` would have been caught at pre-commit by any of these.

**Move secrets out of repos entirely.** [HashiCorp Vault](https://developer.hashicorp.com/vault/docs/secrets), [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html), [GCP Secret Manager](https://cloud.google.com/secret-manager/docs), [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview), [Doppler](https://docs.doppler.com/), [1Password Business + 1Password Secrets Automation](https://developer.1password.com/docs/secrets-automation/). The pattern Theo's commit fulfills ("I needed to share creds across environments so I put them in the repo") is what these tools exist to replace. Ops cost: ~one day. Replacement value: the entire repo-credential-exposure class of finding.

**Educate.** The `hash-id` → `john` → `cat README.rockyou` sequence is identical to what every intro-tier red-team / blue-team training program teaches. Engineers shipping production credentials should be aware of how cheap the offline attack is. [The HashCat wiki](https://hashcat.net/wiki/) and [Hashcat Crackstation](https://hashcat.net/wiki/doku.php?id=cracking_wpawpa2) have the canonical defender-side reference material.

## §7.5 — Optional exploration

Both bonus finds in this level surface auxiliary lessons the main finding doesn't directly require. Each captures a distinct dimension of the broader password-storage problem space.

**Bonus find — Theo's password reuse.** The four-systems-one-rotation finding is the headline of the QSA call, but the deeper lesson is structural: same-string-different-system is the recurring pattern that turns a single weak credential into a multi-system blast radius. The math is the same regardless of how the reuse arose — Theo chose it individually here; Halton Bank's password policy mandates it institutionally in the linux track. The mitigation is the same too: cryptographically-random per-credential strings, machine-generated, managed via a secrets manager that the humans never type into a file. The CWE-521 + CWE-262 catalog entries are the conceptual hooks; the operational fix is a tooling choice.

**Bonus find — RockYou 2009 provenance.** The wordlist's age is the point. "We used a unique password" is a defensible claim against an attacker with a 1000-entry wordlist; it's a meaningless claim against an attacker with a 14M-entry wordlist plus 15 years of mangling-rule development against it. NIST SP 800-63B-4's blocklist-based approach (§5.1.1) is the policy-side mitigation: rather than rely on user-chosen "unique" passwords, verify the candidate against the known breach corpus and reject any match. HIBP's Pwned Passwords API is the implementation. The educational artifact for this bonus is the README.rockyou file itself, which captures the provenance that turns "unique password" from a defensible claim into a measurable claim against a known-bad list.

## §8 — Key takeaways

1. **A hash function is not a safety net for an enumerable input domain.** The cryptographic one-wayness of MD5/SHA-1/SHA-256 doesn't protect a password file when the attacker can guess plaintexts and hash them faster than your system can do meaningful work.

2. **Fast hashes are a force multiplier for the attacker.** MD5 at ~50 billion/s on a single consumer GPU + rockyou.txt's 14M entries = the entire wordlist hashes end-to-end in ~300 microseconds. The mitigation is *deliberately slow* functions (Argon2id, scrypt, bcrypt, PBKDF2).

3. **Per-password salt is non-optional.** Without it, identical plaintexts hash to identical outputs and bulk-cracking parallelism wins. The salt is what makes "four hashes from one wordlist run" into "four hashes that each require independent cracking work."

4. **Password reuse collapses security boundaries.** Four cracked plaintexts that share one value gate four production systems with one rotation. Cryptographically-random per-credential strings via a secrets manager is the operational fix.

5. **rockyou.txt is part of the threat model.** "We used a unique password" only holds if you can prove the password isn't a near-neighbor of any of the ~14 million entries. NIST SP 800-63B-4 codifies the blocklist approach; HIBP's Pwned Passwords API is the implementation. Vesta does not run this check today; if they did, Theo's password would have been rejected at creation.

6. **Repo-committed credentials are repo-committed credentials.** The hash-not-plaintext distinction does not move the CWE-798 mapping. Secrets managers exist to eliminate the pattern entirely; modern pre-commit hooks (gitleaks, trufflehog, GitHub Secret Scanning) catch it at the gate.

7. **PCI-DSS v4.0.1 §3.5.1 requires BOTH strong cipher and strong key.** AES-128 with a 12-character rockyou-class password is, by the control's definition, plaintext. The QSA's job on Vesta's audit includes confirming that the encryption Theo did last quarter meets §3.5.1; the file you just found is the negative finding.

The level3 credential — `TheoVesta!1` — is the AES backup encryption password (label: `aes-backup`) that Theo also reused for the admin login, the prod-DB account, and the S3 read-only service. The breadcrumb to level3 is not a leak the way the JWT was; it's the *finding* — same plaintext, four systems, one rotation event.

## §9 — Further reading

*Last reviewed: April 2026.*

**Modern password hashing**

- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/) — Digital Identity Guidelines: Authentication and Lifecycle Management (August 2025). §5.1.1 covers Memorized Secret Verifiers.
- [the PBKDF2 Wikipedia entry summarising NIST SP 800-132](https://en.wikipedia.org/wiki/PBKDF2) — Recommendation for Password-Based Key Derivation (December 2010).
- [RFC 9106](https://datatracker.ietf.org/doc/html/rfc9106) — Argon2 Memory-Hard Function (September 2021).
- [RFC 8018](https://datatracker.ietf.org/doc/html/rfc8018) — PKCS #5: Password-Based Cryptography Specification v2.1 (January 2017).
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) — the most-cited single page on the topic.
- [OWASP ASVS](https://github.com/OWASP/ASVS) — V2.4 (Credential Storage) verification requirements.

**Offline cracking + wordlists**

- [Hashcat wiki](https://hashcat.net/wiki/) — canonical reference for the most-used GPU-side cracking tool.
- [John the Ripper documentation](https://www.openwall.com/john/) — Solar Designer's classic CPU-side cracker.
- [Have I Been Pwned](https://haveibeenpwned.com/) — Troy Hunt's aggregate breach database.
- [Have I Been Pwned — Pwned Passwords API](https://haveibeenpwned.com/Passwords) — the de-facto implementation for the NIST 800-63B-4 §5.1.1 blocklist requirement.

**Real-world cases**

- LinkedIn 2012 — [HIBP page](https://haveibeenpwned.com/PwnedWebsites#LinkedIn); [LinkedIn 2012 security advisory](https://blog.linkedin.com/2012/06/09/an-update-on-taking-steps-to-protect-our-members).
- RockYou 2009 — [TechCrunch coverage](https://techcrunch.com/2009/12/14/rockyou-hacked/); [Wikipedia case study](https://en.wikipedia.org/wiki/RockYou) covering the subsequent FTC COPPA settlement.
- Adobe 2013 — [Sophos Naked Security analysis](https://nakedsecurity.sophos.com/2013/11/04/anatomy-of-a-password-disaster-adobes-giant-sized-cryptographic-blunder/).
- Yahoo 2013 / 2014 — [Wikipedia consolidated case study](https://en.wikipedia.org/wiki/Yahoo_data_breaches).
- Ashley Madison 2015 — [CynoSure Prime crack writeup](https://cynosureprime.blogspot.com/2015/09/how-we-cracked-millions-of-ashley.html); [Wikipedia case study](https://en.wikipedia.org/wiki/Ashley_Madison_data_breach).

**Secrets management + repo scanning**

- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs/secrets) — internal secrets-management.
- [AWS Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html).
- [GCP Secret Manager](https://cloud.google.com/secret-manager/docs).
- [Azure Key Vault](https://learn.microsoft.com/en-us/azure/key-vault/general/overview).
- [Doppler docs](https://docs.doppler.com/).
- [gitleaks](https://github.com/gitleaks/gitleaks) — pre-commit + repo-history secret scanner.
- [trufflesecurity / trufflehog](https://github.com/trufflesecurity/trufflehog) — entropy-aware secret scanner.
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning) — platform-side scanning.

**Compliance**

- [PCI Security Standards Council document library](https://www.pcisecuritystandards.org/document_library/) — PCI-DSS v4.0.1 §3.5.1 (Strong Cryptography for Account Data) + §8.3.2 (Strong Cryptography for Password Hashing).
- [OWASP Top 10:2025](https://owasp.org/Top10/) — A02 Security Misconfiguration, A04 Cryptographic Failures.
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls/cis-controls-list) — Controls 5.2, 16.4, 18.6 covered above.

**MITRE ATT&CK references**

- [T1110.002 — Brute Force: Password Cracking](https://attack.mitre.org/techniques/T1110/002/).
- [T1552.001 — Credentials In Files](https://attack.mitre.org/techniques/T1552/001/).
- [T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/).
- [T1003.008 — OS Credential Dumping: /etc/passwd and /etc/shadow](https://attack.mitre.org/techniques/T1003/008/).
- [T1187 — Forced Authentication](https://attack.mitre.org/techniques/T1187/).

**CWE catalog**

- [CWE-916 — Use of Password Hash With Insufficient Computational Effort](https://cwe.mitre.org/data/definitions/916.html).
- [CWE-759 — Use of a One-Way Hash without a Salt](https://cwe.mitre.org/data/definitions/759.html).
- [CWE-521 — Weak Password Requirements](https://cwe.mitre.org/data/definitions/521.html).
- [CWE-262 — Not Using Password Aging](https://cwe.mitre.org/data/definitions/262.html).
- [CWE-798 — Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html).
