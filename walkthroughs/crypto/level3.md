# level3@crypto — Theo's Encrypted Backup

**Track:** Crypto · **Client:** Vesta Retail (continued) · **Compliance regime:** PCI-DSS v4.0.1

> ⚠ This page contains the full solve path **and** the breadcrumb credential for a future `level4@crypto`. If you haven't solved `level3@crypto` yet, close this tab and come back after — the puzzle is much more satisfying without spoilers. This walkthrough assumes you've worked through `level0@crypto` through `level2@crypto`; this level is the capstone of their argument.

---

## §1 — The setup

Day four of Vesta Retail's pre-QSA audit. Yesterday you ran `john` against `backup-passwords.txt` — 200 unsalted MD5 hashes Theo committed to the deploy repo six months ago — and it cracked four of them in under a second. All four resolved to the same plaintext: `TheoVesta!1`. The four labels told you where that one string was in use: the admin login, the prod-DB account, an S3 credential, and one labeled `aes-backup`.

Saanvi Rao, Vesta's CISO, read the write-up overnight and asked the only question that mattered: *if he reused it four times, what does it actually open?*

This level answers the fourth label. `aes-backup` is the passphrase on Vesta's nightly production backup. It is also the login on the backup host — which is how you're reading `welcome.md` in the first place. You will type the same weak password twice, about ten minutes apart, for two completely different purposes. That is not a puzzle contrivance; it is precisely what credential reuse does to a blast radius, and feeling it twice in one level is the point.

**This level is the capstone of the crypto track**, and it's worth naming the argument the four levels have been building:

| Level | The comfortable assumption | What killed it |
|---|---|---|
| level0 | "It's encoded, so it's protected" | base64 is reversible by anyone; no secret is involved |
| level1 | "It's signed, so it's trustworthy" | a JWT payload is readable, and `alg:none` means unverified too |
| level2 | "It's hashed, so it's safe" | unsalted MD5 falls to a wordlist in under a second |
| level3 | "It's encrypted, so it's safe" | **encryption is only as strong as its key** |

Notice what does not happen in any of the four: nobody breaks any cryptography. AES-256-CBC is not broken in this level and will not be. The cipher Theo chose is the one part of his design that works correctly. Every failure across the whole track is in how a primitive was chosen, configured, or keyed — which is what cryptographic failure actually looks like in production. The math is almost never the problem.

There is a second finding stacked on the first, and it is the one that will dominate the QSA call. Even if Theo's key management had been flawless — key in the HSM, rotated quarterly, no passphrase anywhere on disk — the backup would *still* be a critical finding, because of what's inside it. Hold that thought until §2 step 5.

Cross-track note: the "one weak string, many systems" shape here is the same failure Halton Bank institutionalized as *policy* in the Linux track (`Halton-YYYY-Q#!`). Different industry, identical blast radius. Vesta got there by accident; Halton got there on purpose. Both end in the same place.

## §2 — The solve

Seven steps. The whole level turns on one command — `openssl enc -d` — and one idea: a cipher is a statement about an algorithm, and the question that decides whether data is protected is *where the key came from*.

### Step 1: Use the breadcrumb to enter the box

```bash
guest@d3cyph3r:~$ ssh level3@crypto
level3@crypto's password: TheoVesta!1
```

The password is the plaintext `john` recovered in level2. It works here because Theo set the backup host's admin login to the same string he used everywhere else. The connection banner names the host (`backup.vesta.internal`) and the tier (Routine, ~14 min).

```bash
vesta-admin@backup:~$ cat welcome.md
```

`welcome.md` introduces `openssl enc -d`, explains what "encrypted at rest" does and does not tell you, and — importantly — explains why you have to supply the passphrase inline in this sandbox.

### Step 2: See what's on the box

```bash
vesta-admin@backup:~$ ls -la
```

Five things matter: `vesta-prod-backup-2026-01-15.enc` (the ciphertext, and note it is mode 644 — world-readable), `backup-notes.md` (Theo's notes), `make-backup.sh` (the job that produces the backup), `retention-policy.md` (Vesta's own standard), and the usual briefing docs.

The file mode on the ciphertext is already a small finding, and Theo's reasoning for it is in his notes: the file is encrypted, so who cares who can read it? That reasoning is defensible *only* if the key is genuinely out of reach. Hold it against what you find in step 6.

### Step 3: Confirm that ciphertext is not readable

```bash
vesta-admin@backup:~$ cat vesta-prod-backup-2026-01-15.enc
Salted__Ñ¶Cù.Ä{â5ªÐh
ò¼]ç1«Ïré´XÓ
...
```

Noise, as expected — but read the first eight bytes. `Salted__` is openssl's real magic header: when `openssl enc` derives a key from a passphrase it generates a random salt, and it writes the literal string `Salted__` followed by the eight salt bytes at the front of the output so decryption can recover it later.

That header is a genuine forensic tell. If you find a file in an incident that starts with `Salted__`, you are looking at openssl-`enc` output specifically, not GPG, not a zip, not LUKS. It tells you which tool made it — and therefore which flags you need to read it back.

What the header does *not* tell you is the cipher. AES-256-CBC, AES-128-CBC and DES all produce a file that starts the same way. You have to know the algorithm from somewhere else, which is why Theo's notes matter.

### Step 4: Get the cipher from Theo's notes

```bash
vesta-admin@backup:~$ cat backup-notes.md
```

```
  Cipher:  aes-256-cbc
  KDF:     pbkdf2 (added 2025-11 after the openssl upgrade
           warned about the old derivation)
  Passphrase: the usual one. Same as the admin login here, so
           you don't need to look it up. If you don't know it,
           ask me.
```

Three things to extract.

**The cipher is AES-256-CBC.** You need this for the decrypt command; it is not recoverable from the file.

**He added `-pbkdf2` in November.** This is the most interesting line in the file, because Theo did something *right* and it bought him almost nothing. A Key Derivation Function turns a human passphrase into a cipher key, and PBKDF2 is deliberately slow so each guess costs an attacker real time. openssl's original derivation (`EVP_BytesToKey`) used a **single** digest iteration — effectively free to brute-force — which is why modern usage passes `-pbkdf2` explicitly. Theo saw the upgrade warning and fixed it.

But a KDF multiplies the cost *per guess*. It cannot add entropy that was never in the passphrase. `TheoVesta!1` is a rockyou-class password; the wordlist finds it in the first handful of guesses. Ten thousand PBKDF2 iterations times "the first few guesses" is still a rounding error. **A strong KDF plus a weak passphrase is still a weak key.** Type `what-is KDF` in game for the longer version.

**"The usual one."** The passphrase is documented as being the same as the admin login. Theo wrote down the reuse, in a file next to the backup, without recognizing it as a finding.

### Step 5: Decrypt

```bash
vesta-admin@backup:~$ openssl enc -d -aes-256-cbc -pbkdf2 -k 'TheoVesta!1' -in vesta-prod-backup-2026-01-15.enc
```

Flag by flag: `-d` decrypt (as opposed to `-e`); `-aes-256-cbc` the cipher from Theo's notes; `-pbkdf2` the key-derivation function it was encrypted with (get this wrong and the key comes out different, so it fails); `-k` the passphrase inline; `-in` the ciphertext.

On a real terminal you would normally omit `-k` and let openssl prompt, so the passphrase never lands in your shell history or the process table. This sandbox can't prompt, so `-k` is how you pass it here — but see §7 item 4, because "never put a secret on a command line" is a real-world habit worth building.

The output:

```
-- Vesta Retail — payments.transactions export
-- Generated 2026-01-15T03:14:22Z by /opt/vesta/make-backup.sh
-- Source:  prod-db-01.vesta.internal   database: vesta_payments
-- Rows:    48,219   (archive header shows the first 6)

txn_id,captured_at,cardholder_name,pan,expiry,cvv2,auth_code,amount_usd
TXN-88412907,2026-01-14T18:22:04Z,A REYES,4111111111111111,09/28,412,A7X21K,84.15
TXN-88412908,2026-01-14T18:22:51Z,M OKONKWO,5555555555554444,03/27,908,B3M77P,219.40
...
```

Stop and read the column headers, because this is the finding that outranks everything else in the level.

`pan` is the Primary Account Number — the card number. `cvv2` is the card verification value. **PCI-DSS prohibits retaining CVV after authorization completes, full stop, even if it is encrypted.** Not "store it carefully." Not "store it with strong crypto." Do not store it. There is no compensating control, and no merchant business justification exists. 48,219 rows of it are sitting in a nightly backup.

This is why the second finding outranks the first: *encryption is a control you apply to data you are permitted to hold. It does not create permission.* Fixing Theo's key management would leave this finding completely untouched.

(The card numbers in the dump are the standard published test PANs — `4111111111111111`, `5555555555554444`, `378282246310005`, and friends — that appear in every payment processor's documentation. They are non-functional and instantly recognizable to anyone who works in payments. A training level should never contain real or real-shaped card data.)

### Step 6: Read to the bottom — the level4 breadcrumb

Keep reading past the rows:

```
-- ─── embedded restore configuration ──────────────────────────
RESTORE_TARGET=prod-db-01.vesta.internal
RESTORE_DB=vesta_payments
HSM_ENDPOINT=hsm-01.vesta.internal:9000
HSM_KEY_LABEL=vesta-master-key-7
HSM_UNWRAP_CREDENTIAL=vesta-hsm-mk7-unwrap-2026Q1

-- NOTE(theo, 2025-08): the HSM is the "real" key store per the
-- architecture doc. We never finished wiring the backup job to
-- it, so the nightly export still uses the passphrase in
-- make-backup.sh. Ticket VES-2291. Reprioritized twice.
```

`vesta-hsm-mk7-unwrap-2026Q1` is your `level4@crypto` credential. Hold it.

Theo's note is the root cause stated by the person who caused it. Vesta *has* a hardware security module. The architecture document *says* the backup key belongs in it. The ticket to do that work exists and has a number. It was deprioritized twice, and in the meantime a passphrase on disk stood in for a key-management program for a year and a half. Most real cryptographic findings look exactly like this: not a wrong decision, an unfinished one.

If you want just the breadcrumb without scrolling, pipe it:

```bash
vesta-admin@backup:~$ openssl enc -d -aes-256-cbc -pbkdf2 -k 'TheoVesta!1' -in vesta-prod-backup-2026-01-15.enc | grep HSM
```

### Step 7: Post-mortem, then out

```bash
vesta-admin@backup:~$ cat lessons-learned.md
vesta-admin@backup:~$ exit
```

`exit` returns you to the lobby and records your solve time; `progress --detail` shows the run and any bonus finds.

## §3 — The vulnerability

Three CWEs, and the way they interact is the lesson.

**CWE-326: Inadequate Encryption Strength.** This one is routinely misread as "they used a weak cipher." Vesta didn't. AES-256-CBC has no practical break. The *effective* strength of an encryption scheme is bounded by the weakest link in the chain — cipher, mode, key derivation, key entropy, key handling — and here the binding constraint is key entropy. A key derived from a password that appears in `rockyou.txt` has, for practical purposes, the strength of that wordlist lookup. Writing "AES-256" in the architecture diagram describes one link and tells you nothing about the other four.

**CWE-522: Insufficiently Protected Credentials.** `make-backup.sh` passes the passphrase with `-k 'TheoVesta!1'`, and the script sits in the same directory as the ciphertext it protects, on the same host, world-readable. Anyone who can read the backup can read its key. The encryption converts a confidentiality problem into a key-management problem, and then the key management hands the problem straight back. There's a second, subtler exposure in the same line: a passphrase on a command line appears in the process table (`ps`) while the job runs and in shell history if a human ever runs it by hand.

**CWE-311 / CWE-312: Missing Encryption / Cleartext Storage of Sensitive Information.** The decrypted contents, and — separately — the restore configuration appended to the dump in plaintext, which carries the HSM unwrap credential. That block is a credential for the *actual* key store, sitting inside a file whose protection is a cracked password. The key hierarchy is inverted: the weakly-protected thing contains the credential to the strongly-protected thing.

**And the one that isn't a CWE at all.** The CVV retention is not a software weakness; it is a prohibited practice. PCI-DSS 3.3.1 forbids storing sensitive authentication data after authorization *even if encrypted*, and it applies everywhere the data lands — databases, logs, and backups alike. No control makes it acceptable. This distinction — between "data that needs protecting" and "data you may not keep" — is the single most common conceptual error auditors encounter, and it is exactly the error Theo made when he concluded that encrypting the export resolved the question.

One more structural note that will matter more to Vesta than any of the above: the backup host was treated as **out of scope** for cardholder data *because the file was encrypted*. Encrypted cardholder data is still cardholder data for scope purposes. This host has been in the cardholder data environment the entire time and has never been assessed as such — which means its logging, access control, and review requirements have never been applied.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | Vesta's nightly production backup, AES-256 encrypted, decrypted with a passphrase recovered in the previous level |
| Records in scope | 48,219 transaction rows |
| Fields present | Cardholder name, **full PAN**, expiry, **CVV2**, auth code, amount |
| Key management | The passphrase is also the host login, and was one of the four MD5 hashes cracked in `level2@crypto` |
| Regime | PCI-DSS v4.0.1 — contractual, not statutory; notification runs to the acquirer and card brands |

**AES-256 was never broken, and saying the backup was "encrypted" is not a
mitigating fact.** The cipher performed exactly as designed. The
passphrase protecting it was a reused password sitting as an unsalted MD5
in a git repository, so the effective strength of the control is the
strength of that password, not the strength of the algorithm. A control
is only as strong as its key management, and this is the cleanest
demonstration of that principle in the corpus.

**The retained CVV2 is not a weakness. It is a prohibited practice, and
it is categorically worse than the rest of the finding.** PCI-DSS v4.0.1
requirement 3.3.1 states that sensitive authentication data is not stored
after authorization completes, **even if encrypted**. There is no
compensating control, no encryption standard, and no key-management
practice that makes this permissible. Every other item here is a control
that failed; this is data that should not exist. Requirement 3.5.1
separately governs the PAN, which must be rendered unreadable wherever it
is stored.

**Scope is the whole backup set, not one file.** These are nightly
backups, so the correct question is how many nights of retained archives
carry the same fields under the same passphrase, and where those archives
live. Remediation is three separate tracks that must not be conflated:
purge the SAD, re-key the archives under managed keys, and end the
password reuse that made the passphrase recoverable in the first place.

## §4 — Real-world parallels

**LastPass (2022) — the canonical encrypted-backup failure.** In a two-stage intrusion, attackers first took source code and technical documentation from a development environment, then compromised a senior DevOps engineer's home computer, obtained credentials from it, and exfiltrated backups of customer password vaults. The vaults were encrypted; LastPass's initial messaging leaned on that fact. The problem was underneath it. Vault keys are derived from the user's master password with PBKDF2-SHA-256, and while LastPass raised the default iteration count to 100,100 in 2018, **it did not apply that change retroactively** — so a large population of legacy accounts was still at 5,000 iterations when the backups walked out the door. Once an attacker holds the ciphertext, all defenses are offline: they guess as fast as their hardware allows, forever, with no rate limiting and no lockout. In 2025 LastPass settled a class action for $24.5 million, and reporting has linked large cryptocurrency thefts to credentials recovered from those vaults.

The structural lesson maps onto Vesta almost line for line: an encrypted archive left the perimeter, and everything that decided the outcome — passphrase entropy, KDF work factor, whether old material was ever re-keyed — had been settled long beforehand. Once the ciphertext is out, you cannot improve any of those things retroactively.

**Adobe (2013) — encryption used where hashing belonged.** Around 153 million account records were exposed, each containing a username, email, an *encrypted* password, and a plaintext password hint. Adobe had encrypted passwords with 3DES in **ECB** mode rather than hashing them. ECB encrypts each block independently, so identical plaintexts produce identical ciphertexts — meaning the dump leaked which accounts shared a password. Combined with the plaintext hints (many users simply wrote the password into the hint), analysts recovered the most common passwords within hours. It is the reference example of every layer of this level's lesson at once: right family of primitive, wrong primitive for the job, wrong mode, and a design that leaked structure even when it "worked."

**The recurring shape.** Both incidents, and Vesta's, share a sequence: an organization satisfies itself with the sentence "it's encrypted," that sentence ends the conversation that should have continued, and the questions it foreclosed — where does the key live, how was it derived, who can reach it, is the data even permitted here — turn out to be the ones that decided the outcome. The defender's job is to treat "it's encrypted" as the *beginning* of the assessment.

## §5 — Frameworks, deep dive

**PCI-DSS v4.0.1** is the governing standard here (Vesta is a merchant; v4.0.1 is the current limited revision of v4.0, published June 2024, and its future-dated requirements became mandatory on 31 March 2025).

- **3.3.1** — Sensitive Authentication Data is not stored after authorization, **even if encrypted**. SAD covers full track data, card verification values (CVV/CVC2/CAV2/CID), and PINs/PIN blocks, and the prohibition reaches every location the data lands, including logs and backups. (v4.0.1 clarifies a narrow exception for issuers and issuer-supporting entities with a legitimate, documented business need. A retail merchant is not that.) This is the finding that must stop today.
- **3.5.1** — PAN must be rendered unreadable anywhere it is stored, by one-way hash of the entire PAN, truncation, or strong cryptography with associated key management. v4.0.1 clarifies that where hashing is used it must be a **keyed** cryptographic hash (HMAC-style), and that the requirement covers non-primary storage such as audit logs, not just databases.
- **3.6.1** — Cryptographic keys protecting stored account data must be protected against disclosure and misuse. A passphrase in a world-readable script beside its own ciphertext fails this as directly as it is possible to fail it.
- **3.7.x** — Key-management lifecycle: generation, secure distribution, secure storage, rotation, retirement, and split knowledge / dual control for manual clear-text operations. Vesta has an HSM and an architecture document describing this; what it does not have is the implementation (VES-2291).
- **8.3.6 / 8.6.3** — Password and passphrase strength requirements, including for credentials used by systems and applications. `TheoVesta!1` fails on content, and its use across four systems compounds it.
- **12.x** — Governing policies must exist *and be followed*. VES-SEC-004 already prohibits everything found in this level, and its annual review is overdue. A control gap is a gap; a documented control the organization did not follow is a program problem, and QSAs treat the second far more seriously.

**NIST SP 800-57 Part 1 Rev. 5** (Recommendation for Key Management, May 2020) is the canonical reference for the lifecycle Theo skipped. Its foundational principle here: keys must be protected at least as strongly as the data they protect, and stored separately from it.

**NIST SP 800-132** (Recommendation for Password-Based Key Derivation) specifies PBKDF2 and states the constraint this level is built on — a password-based key inherits the entropy of the password. Iteration count raises the cost per guess; it does not manufacture entropy that was never present.

**OWASP Top 10:2025 — A04: Cryptographic Failures.** The category was renumbered from A02 in the 2021 edition; when citing it in a client deliverable, use the current A04 designation. It exists for exactly this shape of finding: correct primitive, failed key management. (The related weakness set also covers exposed keys and secrets, deprecated algorithms, and missing encryption at rest and in transit.)

### MITRE ATT&CK — what the recovered password reaches

**[T1078 — Valid Accounts](https://attack.mitre.org/techniques/T1078/)**

The password `john` recovered is not one credential. It is the host
login, the admin login, and the archive passphrase, which means a single
cracked hash produced valid-account access across three different trust
boundaries. That is the mechanism reuse actually exploits: not that a
password is weak, but that its blast radius is the union of everywhere
it was accepted.

**[T1005 — Data from Local System](https://attack.mitre.org/techniques/T1005/)**

Once authenticated, the archive is just a file to be read. There is no
exploitation step in this level and no tooling more exotic than
`openssl`. ATT&CK's framing is useful here precisely because it is
unglamorous: collection from a local system is a documented adversary
behaviour that requires nothing but access, and the entire defensive
question is what a legitimately-authenticated identity is permitted to
read. Cardholder data sitting under a passphrase that a shared password
unlocks answers that badly.

## §6 — Cert exam relevance

**CompTIA Security+ (SY0-701)** Domain 1.4 covers cryptographic solutions — symmetric versus asymmetric, block cipher modes, key exchange, and key derivation. The exam returns repeatedly to the theme that key management, not algorithm selection, is where implementations fail; questions shaped as "the data was encrypted with AES-256, so why was it compromised?" expect you to reach for key handling. Domain 4 covers the data-lifecycle side, including retention and secure destruction.

**ISC2 CISSP** Domain 3 (Security Architecture and Engineering) covers the full cryptographic lifecycle and the principle that keys must be protected at least as strongly as what they protect. Domain 2 (Asset Security) covers data retention, classification, and destruction — the CVV finding lives there, and the CBK is explicit that classification follows the data into backups.

**PCI Professional (PCIP)** and QSA training treat SAD retention as a foundational rule, precisely because merchants get it wrong so often. If you take one fact from this level into an exam room: *CVV must not be stored after authorization, encryption is not a mitigating control, and there is no merchant business justification.*

**CompTIA CySA+ (CS0-003)** covers the analyst's job of finding prohibited or sensitive data in places it was never supposed to reach — backups, logs, exports, test fixtures, analytics stores. The hunt technique is a pattern scan (PAN regexes with Luhn validation, CVV-adjacent column names) across storage that is nominally out of scope.

**Offensive Security OSCP / PEN-200** covers the offensive half: recovered credentials are sprayed everywhere, and encrypted archives found during post-exploitation are standard targets once any wordlist-crackable password is in hand. `openssl enc -d` and John/hashcat against archive formats are routine tooling.

## §7 — What a defender does

Six actions, ordered by urgency rather than effort.

**1. Stop writing CVV. Today.** This is the only item that cannot wait for a sprint boundary. Change the export query to drop the column, then find and securely destroy every existing copy — nightly backups, filesystem snapshots, database replicas, and any downstream analytics or reporting store the export feeds. Retention of prohibited data is not remediated by adding controls around it; the data has to stop existing.

**2. Treat the passphrase as compromised and rotate everything it touched.** It sat in a committed hash file, it cracked in under a second, and it was reused four ways. Rotate the admin login, the prod-DB account, the backup encryption, and the S3 credential — then review access logs on each for the entire window since the hashes were committed, because "when was it exposed" is now a real investigative question rather than a hypothetical.

**3. Finish VES-2291.** The HSM in the restore config is the correct design. The backup job should request a data encryption key from the HSM (envelope encryption: the HSM holds a master key and wraps a per-backup data key, so no long-lived passphrase exists on disk at all). This converts key compromise from "read a script" into "compromise a hardware module."

**4. Never put a secret on a command line.** Even with a strong passphrase, `-k` exposes it in the process table while the job runs and in shell history when a human runs it manually. Use `-pass file:` or `-pass fd:`, or pull the secret from a secrets manager at runtime. Small change, whole class of exposure removed.

**5. Re-scope the backup host.** It stores cardholder data; encryption does not remove it from PCI scope. Bring it into the assessed cardholder data environment with the corresponding logging, access control, monitoring, and review requirements — and re-examine any other system that was scoped out on the same reasoning.

**6. Close the governance loop.** VES-SEC-004 already prohibits everything found here, which means publishing the policy was not the missing piece. Add a control that *verifies* it: a scheduled automated scan of backups, exports, and logs for PAN and SAD patterns, alerting on hits. That catches the next instance in days instead of at the next annual assessment.

### Sample detection rule (Sigma)

A passphrase supplied on the command line is visible in the process table
to every user on the host and lands in shell history, so the decryption
event and a second credential exposure happen together.

```yaml
title: Backup archive decrypted with a passphrase on the command line
status: experimental
description: >
  Detects openssl enc decryption where the passphrase is passed via -k or
  -pass pass:, which exposes it in ps output and shell history. Also
  flags decryption of archives outside the backup service account, which
  is the access that matters for cardholder data.
logsource:
  product: linux
  service: auditd
detection:
  openssl_decrypt:
    type: 'EXECVE'
    proctitle|contains|all:
      - 'openssl'
      - 'enc'
      - '-d'
  passphrase_on_cli:
    proctitle|contains:
      - ' -k '
      - '-pass pass:'
  backup_service:
    uid:
      - '1200'   # backup-restore service account
  condition: openssl_decrypt and not backup_service
falsepositives:
  - Authorised restore testing. This should run under the backup service
    account on a schedule; a restore test under an engineer's own UID is
    worth a question even when the answer is benign.
level: high
```

Two independent findings are visible in one event, and they should be
reported separately. `-k` on the command line is a credential-handling
defect that applies to every invocation regardless of who runs it. The
decryption by a non-backup account is an access question about cardholder
data. Fixing the first does nothing about the second.

The detection is also the wrong layer to be relying on, and the report
should say so. Archives holding cardholder data should be encrypted under
keys held in a managed KMS with per-principal access policies and their
own audit trail, at which point the question "who decrypted this" is
answered by the key store rather than inferred from process arguments.

## §7.5 — Optional exploration

Two bonus finds. `progress --detail` shows your discovered list. Neither changes the breadcrumb chain.

**1. The CVV should not be there at all** — Trigger: the successful `openssl enc -d` decrypt (the `cvv2` column appears in the output). This is the regulatory beat of the level, and it is deliberately awarded for the same command that solves the puzzle, because the intended experience is decrypting the file, feeling good about it, and *then* reading the column headers. PCI-DSS 3.3.1 prohibits retaining sensitive authentication data after authorization even when encrypted; the prohibition follows the data into logs and backups. The transferable habit: when you gain access to a data store during an assessment, read the *schema* before the rows. What the columns are named is frequently a bigger finding than what they contain.

**2. The passphrase is in the script beside the ciphertext** — Trigger: `cat make-backup.sh`. The job passes `-k 'TheoVesta!1'` inline, and the script lives in the same world-readable directory as the file it encrypts. This is the key-management beat: anyone who can read the backup can read its key, so the encryption reduces to obfuscation (CWE-522). It also explains why the HSM exists in the restore config and why VES-2291 is the actual root cause rather than the passphrase itself. In a real engagement this is the finding you write up as systemic — one hardcoded key implies a process that permits hardcoded keys, so the remediation is a secrets-management program, not a single edit.

For the wider pattern behind both, the in-game glossary entries `what-is AES` and `what-is KDF` cover why cipher choice is rarely the weak point and why key derivation is where passphrase-based encryption actually lives or dies.

The bonus finds exist to exercise the schema-reading and key-tracing habits without leaving the engagement; **the credential chain works without them.**

## §8 — Key takeaways

- **"It's encrypted" is the beginning of an assessment, not the end of one.** The sentence describes an algorithm. The questions that decide whether data is protected are: where does the key live, how was it derived, who can reach it, and when was it last rotated. Vesta's answers were: next to the ciphertext, from a reused human password, anyone with a shell, never.
- **Encryption is a control for data you are permitted to hold; it does not create permission.** Storing CVV after authorization is prohibited outright — encrypted or not, in the database or in a backup. Fixing Theo's key management would leave that finding entirely untouched, which is why it outranks everything else in the level.
- **A strong KDF cannot rescue a weak passphrase.** PBKDF2 multiplies the attacker's cost *per guess*. If the passphrase is in a wordlist, the number of guesses is tiny and the multiplier is irrelevant. Strong KDF *and* high-entropy secret is the only combination that works — and once ciphertext leaves your perimeter, neither can be improved retroactively.
- **The cipher is almost never the problem.** Across four levels of this track, nothing cryptographic was broken. Every failure was in selection, configuration, or keying. Spend your review time on key handling and data flow, not on debating AES-256 versus AES-128.
- **Encrypted sensitive data is still sensitive data for scope.** Scoping a system out because "the file is encrypted" is how hosts end up holding regulated data for years without the logging, access control, or assessment that status requires.

## §9 — Further reading

*Last reviewed: July 2026. External standards versions, requirement numbers, and incident facts verified against current canonical sources as of this date. Report stale links via the project's GitHub issues tracker.*

- [CWE-326 — Inadequate Encryption Strength](https://cwe.mitre.org/data/definitions/326.html)
- [CWE-522 — Insufficiently Protected Credentials](https://cwe.mitre.org/data/definitions/522.html)
- [CWE-311 — Missing Encryption of Sensitive Data](https://cwe.mitre.org/data/definitions/311.html)
- [CWE-312 — Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html)
- [CWE-916 — Use of Password Hash With Insufficient Computational Effort](https://cwe.mitre.org/data/definitions/916.html)
- [PCI DSS v4.0.1 (PCI Security Standards Council document library)](https://www.pcisecuritystandards.org/document_library/)
- [PCI SSC — Summary of Changes, PCI DSS v3.2.1 to v4.0](https://listings.pcisecuritystandards.org/documents/PCI-DSS-v3-2-1-to-v4-0-Summary-of-Changes-r1.pdf)
- [NIST SP 800-57 Part 1 Rev. 5 — Recommendation for Key Management](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final)
- [NIST SP 800-132 — Recommendation for Password-Based Key Derivation](https://csrc.nist.gov/pubs/sp/800/132/final)
- [NIST FIPS 197 — Advanced Encryption Standard (AES)](https://csrc.nist.gov/pubs/fips/197/final)
- [OWASP Top 10:2025 — A04: Cryptographic Failures](https://owasp.org/Top10/2025/A04_2025-Cryptographic_Failures/)
- [OWASP Cheat Sheet — Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [OWASP Cheat Sheet — Key Management](https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html)
- [OpenSSL — `openssl-enc` manual page](https://docs.openssl.org/master/man1/openssl-enc/)
- [OpenSSL — `EVP_BytesToKey` (the legacy single-iteration derivation)](https://docs.openssl.org/1.0.2/man3/EVP_BytesToKey/)
- [LastPass — Notice of Recent Security Incident (December 2022 update)](https://blog.lastpass.com/posts/notice-of-recent-security-incident)
- [Wikipedia — 2022 LastPass data breach](https://en.wikipedia.org/wiki/2022_LastPass_data_breach)
- [Almost Secure (Wladimir Palant) — LastPass breach: the significance of these password iterations](https://palant.info/2022/12/28/lastpass-breach-the-significance-of-these-password-iterations/)
- [Krebs on Security — Feds Link $150M Cyberheist to 2022 LastPass Hacks](https://krebsonsecurity.com/2025/03/feds-link-150m-cyberheist-to-2022-lastpass-hacks/)
- [Schneier on Security — Cryptographic Blunders Revealed by Adobe's Password Leak](https://www.schneier.com/blog/archives/2013/11/cryptographic_b.html)
- [Have I Been Pwned — Adobe (2013) breach record](https://haveibeenpwned.com/Breach/Adobe)
- [MITRE ATT&CK — T1552.001: Unsecured Credentials: Credentials In Files](https://attack.mitre.org/techniques/T1552/001/)
- [MITRE ATT&CK — T1560.001: Archive Collected Data: Archive via Utility](https://attack.mitre.org/techniques/T1560/001/)
- [HashiCorp Vault — envelope encryption / transit secrets engine](https://developer.hashicorp.com/vault/docs/secrets/transit)
- [AWS KMS — envelope encryption concepts](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html)

---

*Return to [walkthroughs index](/walkthroughs/) — or back to [d3cyph3r.com](/)*
