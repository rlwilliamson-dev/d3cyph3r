# level1@osint — Aaron's Weekend Project

**Track:** OSINT · **Client:** Veridian Analytics · **Compliance regime:** HIPAA Security Rule (45 CFR Part 164, Subpart C) + HITRUST CSF v11 + NIST SP 800-66 Rev. 2 · **Builds on:** [`level0@osint`](/walkthroughs/#/osint/level0)

> ⚠ This page contains the full solve path **and** the breadcrumb credential for `level2@osint`. If you haven't solved `level1@osint` yet, close this tab and come back after. The puzzle leans on you recognizing the source-control credential-leak pattern in a public GitHub repo; reading the writeup first removes the moment.

---

## §1 — The setup

When you left the lobby at the end of `level0@osint`, Marisol Vega had Friday's HIBP finding sitting on her desk and was on her way home. The lookup against `aaron.hines.md@gmail.com` had surfaced five breach hits, with `BostonStrong#2013` recovered cleartext from both the LinkedIn 2012 (SHA-1, fully cracked years ago) and LiveJournal 2014 (MD5, also fully recovered) corpora. Two-corpus reuse is the high-confidence credential-reuse signal — not "Aaron picked the same string twice by coincidence" but "this is Aaron's password, has been Aaron's password for over a decade, and is almost certainly still Aaron's password on something that matters." Marisol took the finding home over the weekend.

By Monday morning the engagement had moved. Marisol had walked the HIBP results with Veridian's Chief People Officer on Saturday and, in summary form, with Aaron himself on Sunday. Aaron's reaction was textbook: surprised that anyone had cracked LinkedIn's SHA-1 hashes (everyone has, since about 2013), then immediately asked Marisol what else might be out there. Marisol's response was professional, but the question was useful — it gave her cover to expand the engagement scope without forcing Aaron through an awkward second consent conversation. Aaron asked, Aaron's CPO reconfirmed, Marisol emailed Priya, and by Monday morning Driftwood had written authorization for handle-pivot OSINT (`sherlock`) and source-control OSINT (the new `github` command) against Aaron's public developer footprint. Still no active credential testing, still no enumeration of family members, still the narrow public-data-read scope from Friday — but now broader along the developer-footprint axis.

The lever Marisol pulled was specific. Over the weekend Aaron had mentioned, casually, that he "tinkered with some clinical-data Python tooling back during his fellowship." Marisol's instinct said: that's the kind of side-project that ends up with secrets in source control. Public GitHub for clinical-era projects, written by a clinician with no formal secrets-management training, kept alive across multiple employer transitions, dormant but still indexed by GitHub's public search — this is the universal pattern. The Uber 2016 breach (AWS keys in GitHub), the Toyota 2022 incident (five years of GitHub-leaked DB credentials), the Mercedes-Benz 2024 GitHub PAT leak — different organizations, same mechanic. Aaron is not Uber and not Mercedes, but the question Marisol wanted answered was: does Aaron's clinical-era Python tooling exist on public GitHub, and if so, does it contain any committed credentials that haven't been rotated since the original commit. That's a thirty-minute Monday-morning OSINT engagement that potentially produces a one-line remediation request.

You're back in the same chair as Friday. `intel` on the Driftwood OSINT engagement workstation, same shared service account, same engagement file (`VER-EXP-2026-002`). The legal frame around the Veridian relationship is unchanged: HIPAA Business Associate, signed BAAs with payer and provider customers, HITRUST CSF v11 overlay, NIST SP 800-66 Rev. 2 as the operating reference, MA 201 CMR 17.00 (Massachusetts data security regulation) because Veridian's HQ and ~70% of staff sit in MA.[^nist-800-66] Today's work doesn't touch any of those directly — Aaron's personal-pgx-tool is personal, not Veridian's — but the framing matters when you write up the brief, because a personal-AWS-credential exposure that touches Aaron's clinical-era data has potential HIPAA-adjacent consequences through Aaron's prior employer (Helix Therapeutics) that Marisol will want to surface to legal before any external communication.

## §2 — The solve

The puzzle path is short and rewards reading the file tree carefully. Four files in the workspace, one new command to learn, four GitHub repos to enumerate, one of them contains the finding.

### Step 1: Open the workspace

```bash
guest@d3cyph3r:~$ ssh level1@osint
level1@osint's password: BostonStrong#2013
Connected: level1@osint
intel@osint:~$ whoami
intel
```

You used Aaron's recovered reused password as the entry gate — the meta-joke of the OSINT track, where the breadcrumb credential from level0 is the actual password being investigated. The shell drops you on the same Driftwood workstation as Friday, `intel` service account, same engagement working directory.

### Step 2: Read the four engagement files

```bash
intel@osint:~$ ls
engagement-notes.md  lessons-learned.md  subject-update.txt  welcome.md
```

Four files. Read them in order.

`welcome.md` introduces the new `github` command (three forms: profile lookup, repo metadata, file contents) and explains source-control OSINT generally — GitHub Secret Scanning's default-on posture for public repos since March 2023, the TruffleHog / GitGuardian / Gitleaks ecosystem, why `.gitignore` doesn't fix the historical-commit problem.[^github-secret-scanning][^gitleaks]

`engagement-notes.md` is Priya's update. It covers what happened between Friday and Monday — Marisol's weekend conversation with the CPO and Aaron, the scope expansion (sherlock + github now authorized), the unchanged out-of-scope boundaries (no active credential testing, no family enumeration, no Veridian-domain accounts). It also flags the specific pattern to look for: a personal-project repo with a committed `.env`, `config.yaml`, or `.aws/credentials` file. Priya's note ends with the punchline: Aaron's GitHub handle is `aaron-hines-md`, derivable from his LinkedIn bio signature ("github.com/aaron-hines-md" — he linked it years ago and never removed it).

`subject-update.txt` is the formal case-file update. Same case ID as Friday (`VER-EXP-2026-002`), now scope-expanded. The notable section is Marisol's pre-written remediation guidance: if the player finds live committed AWS credentials, Aaron rotates today via AWS console, AWS GuardDuty review for any anomalous API calls under those credentials, and — critically — if the credentials gate a bucket that contained patient-identifying data from Aaron's clinical-era work, the HIPAA-exposure analysis runs through Veridian's GC and potentially Helix's GC.[^aws-guardduty] Marisol is pre-emptively framing the conversation that may follow the finding.

### Step 3: Confirm the GitHub handle with sherlock

```bash
intel@osint:~$ sherlock aaron-hines-md
Sherlock 0.14.4
[*] Checking username "aaron-hines-md" across social platforms
──────────────────────────────────────────

[+] GitHub:    https://github.com/aaron-hines-md
[+] Strava:    https://strava.com/athletes/aaron-hines-md  (PRO subscriber, last activity 2026-04-21)
[+] Mastodon:  https://mas.to/@aaron-hines-md  (last toot 2024-11-08; mostly clinical pharmacology)
[+] Goodreads: https://goodreads.com/user/show/aaron-hines-md
[+] Strava:    https://strava.com/athletes/aaron-hines-md  (segment leaderboards: Brookline / Newton hills)
[-] Twitter:   404
[-] Reddit:    404
[-] Instagram: 404
[-] TikTok:    404

[*] Search complete.
```

Three things matter here. **First**, `aaron-hines-md` resolves on GitHub — Aaron's handle confirmed. **Second**, the Strava presence is interesting OPSEC adjacent — Aaron is a PRO subscriber with recent activity and segment leaderboards in his own neighborhood (Brookline / Newton); per the LinkedIn DM in level0 that referenced his home neighborhood, Strava is one of the public sources from which that intel would have been derived. Worth noting in the brief, but out of scope for today's narrow GitHub task. **Third**, the absence of Twitter / Reddit / Instagram / TikTok presence at this handle is itself a signal — Aaron either curates his public presence carefully or those platforms don't use his real-name-attached handle. Out of scope today; useful to know for the eventual writeup.

### Step 4: Enumerate Aaron's GitHub profile

```bash
intel@osint:~$ github aaron-hines-md
github.com — user profile lookup
──────────────────────────────────────────
  Profile:        aaron-hines-md
  Name:           Aaron Hines, MD
  Bio:            Clinical pharmacologist · PGx hobbyist · Senior CMO, Veridian Analytics · formerly Helix Therapeutics · opinions my own
  Location:       Boston, MA
  Joined:         2014-09-12
  Public repos:   4
  Followers:      28
  Following:      41

Public repositories:
  Updated      Stars   Language     Name                       Description
  ──────────   ─────   ──────────   ───────────────────────    ──────────────────────────────
  2024-03-08      3    Python       personal-pgx-tool          Personal pharmacogenomic interaction lookup tool. Uses OpenFDA + PharmGKB APIs.
  2023-11-15      1    R            marathon-pacer-log         Boston Marathon pacing spreadsheet (CSV + R notebook).
  2018-06-22      0    Markdown     pgx-residency-notes        Lecture notes from BIDMC PGx fellowship. Public domain.
  2017-04-30      0    Shell        dotfiles                   Personal .zshrc / .vimrc.
```

Aaron joined GitHub in September 2014, during his BIDMC clinical pharmacology fellowship. His follower / following counts are modest — this is a researcher's GitHub, not a developer's GitHub, used as a portfolio plus a place to park personal projects rather than as a primary identity. Four public repos, sorted by last-updated descending: `personal-pgx-tool` (the most recently touched, last commit March 2024), `marathon-pacer-log` (a CSV + R notebook for race-day pacing — interesting personal artifact but unlikely to carry secrets), `pgx-residency-notes` (lecture notes from his fellowship era), and `dotfiles` (the universal developer-vanity repo).

The interesting one is `personal-pgx-tool`. Three reasons: it's the most recently touched, it's the one Aaron implicitly mentioned ("clinical-data Python tooling back during his fellowship"), and the description ("Uses OpenFDA + PharmGKB APIs") signals that it makes outbound API calls — meaning it probably has API keys somewhere. The other three repos are decoys: a CSV + R notebook doesn't typically need credentials, Markdown lecture notes definitely don't, and a dotfiles repo only carries secrets if the developer is reckless enough to commit a `.gitconfig` with a personal access token (rare in modern practice; the GitHub PAT-in-gitconfig pattern was more common circa 2018 than today).

### Step 5: Drill into personal-pgx-tool

```bash
intel@osint:~$ github aaron-hines-md/personal-pgx-tool
github.com — repository
──────────────────────────────────────────
  Repository:     aaron-hines-md/personal-pgx-tool
  Description:    Personal pharmacogenomic interaction lookup tool. Uses OpenFDA + PharmGKB APIs.
  Language:       Python
  Created:        2023-07-14
  Updated:        2024-03-08
  Stars:          3 · Forks: 1 · License: MIT

Files at HEAD:
  .env
  .gitignore
  README.md
  app.py
  requirements.txt
  src/drug_metadata.py
  src/interactions.py
  src/pgx_lookup.py

To view a file: github aaron-hines-md/personal-pgx-tool file <path>
```

This is the moment. **`.env` is in the file tree.** That is not supposed to be the case for a public repo — `.env` files exist specifically to hold local development secrets that should never be committed. The convention is well-established and Aaron's `.gitignore` (also in the tree, indicating it exists) almost certainly lists `.env` among the ignored patterns. But `.env` is still at HEAD, which means it was committed at some point and never removed from history.

This is the universal source-control credential-leak mechanic. The likely sequence:

1. Aaron creates the repo on 2023-07-14 with the initial commit. The initial commit includes `.env` because Aaron hadn't yet set up `.gitignore` and `git add .` swept the whole directory.
2. Sometime later — possibly after a colleague's PR review pointed it out, possibly after Aaron realized himself — he adds `.gitignore` with `.env` listed.
3. But `.gitignore` only prevents *future* staging of matching files. It does not retroactively untrack a file that has already been committed. The `.env` remains in HEAD, remains in every prior commit's tree, remains in every fork and every clone.
4. The correct remediation at that point is `git rm --cached .env`, commit, push. The credential history is still in the commit log (and recoverable from any clone), but at least the file no longer exists at HEAD. Most developers don't do this step — they assume `.gitignore` "fixes" it.
5. The credential stays in the repo, public-internet-accessible, for the entire lifespan of the repo, until either the developer rotates the credential or an attacker uses it.

Aaron's repo has been public on GitHub since July 2023. That's almost three years of exposure.

### Step 6: Read the .env

```bash
intel@osint:~$ github aaron-hines-md/personal-pgx-tool file .env
github.com — aaron-hines-md/personal-pgx-tool — .env
──────────────────────────────────────────
# Personal PGx tool — local dev config
# DO NOT COMMIT — superseded by env-vars in prod
# (this got committed by accident on 2023-07-14; see issue #2)

FLASK_SECRET_KEY=devsecret-not-for-prod-aaron-2023
FLASK_DEBUG=1
DB_URL=sqlite:///pgx.db

# OpenFDA personal API key (rate-limited 1000/day)
OPENFDA_API_KEY=oFDA-aaron-personal-2023-2gqMmQrZkvL

# AWS credentials for the S3 bucket where I cache the
# PharmGKB JSON dumps — personal AWS account, NOT Veridian
AWS_ACCESS_KEY_ID=AKIAVDS3IAARONHINES23
AWS_SECRET_ACCESS_KEY=AaronHinesMD/Pers0nal+AWS/2024+BrightBlu
AWS_DEFAULT_REGION=us-east-1
S3_CACHE_BUCKET=ahines-pgx-cache
```

Four secrets, varying severity:

- **`FLASK_SECRET_KEY=devsecret-not-for-prod-aaron-2023`** — Flask session-signing key, dev-only by Aaron's own label. Low value: if Aaron's app is only ever run locally, the consequence is minimal. If Aaron ever exposed the app over a network using this dev secret, anyone could forge Flask session cookies.
- **`OPENFDA_API_KEY=oFDA-aaron-personal-2023-2gqMmQrZkvL`** — Personal OpenFDA developer key. OpenFDA is the FDA's open-data API; personal keys are rate-limited at 1000 requests/day and primarily exist for fair-use tracking. Low value: an attacker can use it to make 1000 OpenFDA queries per day attributed to Aaron, but OpenFDA data is public.
- **`AWS_ACCESS_KEY_ID=AKIAVDS3IAARONHINES23`** — AWS access key ID. The `AKIA` prefix marks it as a long-lived IAM user access key (as opposed to `ASIA` for STS temporary session tokens). This is the bad one.
- **`AWS_SECRET_ACCESS_KEY=AaronHinesMD/Pers0nal+AWS/2024+BrightBlu`** — The matching secret. This pair authenticates API calls against Aaron's personal AWS account. The `S3_CACHE_BUCKET=ahines-pgx-cache` line tells you what the credential is used for — caching PharmGKB JSON dumps in an S3 bucket Aaron owns personally.

The level2@osint breadcrumb is the AWS secret access key: `AaronHinesMD/Pers0nal+AWS/2024+BrightBlu`. In the in-game continuation, the next engagement would use that credential to enumerate Aaron's personal AWS account (`aws sts get-caller-identity`, `aws s3 ls`, etc.) under expanded authorization. That's `level2@osint` material; today the task ends at "identified and reported."

### Step 7: Verify the .gitignore irony

The lesson is sharper with the contradiction in view. Read the `.gitignore`:

```bash
intel@osint:~$ github aaron-hines-md/personal-pgx-tool file .gitignore
github.com — aaron-hines-md/personal-pgx-tool — .gitignore
──────────────────────────────────────────
# Local development
*.pyc
__pycache__/
.venv/
venv/
.DS_Store
instance/

# Secrets — DO NOT COMMIT
# (added 2023-09-02 after PR #4; pre-existing .env is still
#  tracked in history — see issue #2)
.env
.env.local
*.key
*.pem

# Local SQLite cache
pgx.db
*.sqlite3

# IDE
.vscode/
.idea/
```

The inline comment is the punchline: `.gitignore` was added on 2023-09-02, after a PR pointed out the missing patterns. The pre-existing `.env` was already in the repo's history at that point. Aaron added the line, presumably felt the issue was resolved, and never came back to actually remove the file from tracking. The reference to "issue #2" suggests someone (Aaron or a contributor) filed an issue to remediate, and the issue was never closed.

### Step 8: The hand-off

The findings report for Marisol has three components:

1. **Aaron's GitHub presence summary** — handle `aaron-hines-md`, account age ~12 years, four public repos, predominantly personal/clinical projects.
2. **The finding** — `personal-pgx-tool` `.env` at HEAD contains four committed secrets, most importantly an active AWS access-key pair for Aaron's personal AWS account (with the matching S3 bucket name `ahines-pgx-cache`). Original commit 2023-07-14; `.gitignore` added 2023-09-02 with `.env` listed but never `git rm --cached`'d. Total exposure window: ~22 months as of today.
3. **The HIPAA-adjacent escalation question** — the S3 bucket is personal, not Veridian's, and Aaron's pre-Veridian usage of the tool occurred during his Helix Therapeutics tenure. If the bucket contains any patient-identifying data from his clinical-era work, that is a separate exposure event involving Helix's GC. Marisol will route that conversation through Veridian's legal team if it surfaces.

Marisol's pre-written remediation list applies: Aaron rotates the AWS keys via the IAM console (two-minute operation), regenerates the OpenFDA API key, runs `git rm --cached .env` and force-pushes to remove from HEAD, and reviews AWS CloudTrail for any anomalous API calls under those credentials going back to 2023-07-14.[^aws-cloudtrail] AWS GuardDuty should be enabled on the personal account if it isn't already.

## §3 — The vulnerability

Two distinct vulnerabilities sit in one .env file. Both have direct CWE mappings; the consequences differ.

The structural vulnerability is **CWE-540 (Inclusion of Sensitive Information in Source Code)**, with the close-companion **CWE-798 (Use of Hard-Coded Credentials)** for the credential-handling failure mode and **CWE-312 (Cleartext Storage of Sensitive Information)** for the broader "secrets-in-plain-text" category.[^cwe-798][^cwe-540][^cwe-312] The mapping nuance: CWE-540 is about the *presence* of sensitive information in source; CWE-798 is about the *use* of hard-coded credentials in code; CWE-312 is about the *storage form* (cleartext) being inadequate. All three apply to Aaron's .env. CWE-798 appeared on the CWE Top 25 every year from 2021 through 2024, but MITRE's 2025 methodology change (removing normalization to abstract weaknesses) dropped it off the published Top 25 — the weakness pattern remains common in practitioner reporting regardless. CWE-540 and CWE-312 have not been Top 25 entries, but in practice security teams cite all three when filing findings for source-control credential leakage.

The exposure mechanism that makes this particularly persistent is structural rather than behavioral. The git data model is content-addressable: every commit's contents are immutable from the moment they're hashed, and `.gitignore` is a forward-looking instruction to the staging engine, not a retroactive instruction to history. Adding `.env` to `.gitignore` after the first commit prevents future stages but does nothing about what's already in the commit graph. The correct remediation requires:

1. `git rm --cached <file>` (untrack at HEAD)
2. Commit and push (removes from current branch tip)
3. To remove from history entirely: `git filter-repo --invert-paths --path .env`, force-push, and accept that every collaborator's existing clones still have the secret
4. **Rotate the credential anyway** because step 3 doesn't reach forks, archived clones, the GitHub Archive Program at Svalbard, or any indexer that captured the file before it was removed.

Most developers do step 1 and skip the rest, which is partially effective for a casual observer but useless against a real attacker who knows about `git log --all`, the GitHub Events API, or the GHArchive dataset.

The OSINT-side vulnerability is the symmetric consequence: any public repo on GitHub is searchable by anyone with a GitHub account, and there are mature toolchains (TruffleHog, GitGuardian, custom GHArchive scrapers) that systematically scan public repos for credential patterns. Real-world attackers run these scrapers continuously. The lag between a credential being committed and being discovered by an opportunistic scraper is typically measured in *hours* for high-value patterns (AWS keys, GitHub PATs, Stripe keys) and *days* for less-targeted secrets. Aaron's AWS key has been in a public repo for ~22 months. If it hasn't been used by an attacker yet, that's not because the credential is undiscovered — it's because the credential's blast radius (a personal AWS account with one S3 bucket) is low enough that the marginal attacker hasn't bothered.

The third related vulnerability is the consent-and-disclosure layer. Aaron's bio in his GitHub profile names his prior employer (Helix Therapeutics) and his current role (Senior CMO at Veridian Analytics). The .env's inline comment names the data category cached in the bucket (PharmGKB JSON dumps — a pharmacogenomic knowledge base). An attacker who finds the AWS credentials immediately knows whose AWS account they have access to, what kind of data is plausibly there, and what employer-stakeholders care about that data. The professional context Aaron published in his GitHub bio is itself a force-multiplier for the credential leak.

## §3.5 — Blast radius

| Dimension | This finding |
|---|---|
| Reached | A public personal GitHub repository belonging to the same individual |
| Committed at HEAD | A `.env` carrying live AWS access keys, an OpenFDA API key, and a Flask secret |
| Why `.gitignore` did not help | It was added later, and ignoring a path never untracks a file already committed |
| Scope of exposure | Public since the commit, to anyone including automated secret scanners |
| Regime | HIPAA as a Business Associate plus HITRUST CSF; a BA notifies the covered entity within 60 days, and the covered entity carries the individual-notice duty |

**Personal does not mean out of scope, and that is the uncomfortable part
of executive-protection work.** The repository is the individual's own,
built in a previous clinical role. The credentials in it are live. An
attacker does not observe the boundary between someone's personal
projects and their employer's assets, so the assessment cannot either,
while still handling the finding with the care a personal artifact
deserves.

**`.gitignore` is the most commonly misunderstood control in this
class.** It prevents *untracked* files from being staged. It has no effect
on a file git is already tracking, and none at all on history. Adding
`.env` to it after the commit produces a repository that looks correctly
configured while continuing to publish the secret at HEAD, which is
precisely the state here.

**Assume the keys are already harvested and scope accordingly.** Public
repositories are continuously scanned by automation that is faster than
any human review. The window is not "since someone noticed" but "since
the commit," and the only meaningful remediation is rotation at the
provider plus a review of what those keys touched. Deleting the file
changes nothing, as the next level demonstrates directly.

## §4 — Real-world parallels

Source-control credential leakage is one of the most documented categories of cybersecurity incident in modern history. A non-exhaustive tour:

**Uber (2014, disclosed 2015).** Uber filed an early-2015 lawsuit that ultimately attributed a 2014 data breach to AWS credentials that an Uber engineer had committed to a public GitHub Gist. The credentials gated an S3 bucket containing personal data on ~50,000 Uber drivers. The 2014 breach was disclosed to drivers February 2015; the lawsuit was settled in 2016. Uber's *second* breach in 2016 (the much larger one, ~57M users + drivers, with the $148M FTC settlement and Joe Sullivan's prosecution) had different mechanics but is often conflated with the 2014 incident; the credential-in-GitHub vector is from the *first* incident.

**GitGuardian's annual "State of Secrets Sprawl" report** has tracked source-control secret exposure year over year since 2021.[^gitguardian-state-of-secrets-sprawl] The 2024 report counted 12.8 million new secrets exposed in public commits during 2023; the **2026 report (5th edition, published March 17, 2026) tallied approximately 28.65 million new secrets exposed in public commits during 2025** — a 34% year-over-year increase — with AWS, GitHub, and database credentials consistently in the top three categories. Snyk's annual State of Open Source Security report tracks dependency vulnerabilities rather than committed secrets, but their related practitioner-survey data shows secret-in-source-code findings as a top-five category in real-world code review.

**Toyota (October 2022 disclosure, exposure 2017-2022).** Toyota disclosed that source code for its T-Connect telematics service had been publicly accessible on GitHub for nearly five years (December 2017 to September 15, 2022).[^toyota-october-2022-disclosure-t] The source included database credentials granting access to T-Connect customer email addresses and management numbers — affecting ~296,019 customers. The disclosure followed an internal review; the public GitHub upload was attributed to a development subcontractor. (A separate Toyota incident disclosed in May 2023 — the ~2.15M-customer vehicle-location leak — is sometimes conflated with this one and has different mechanics.)

**Mercedes-Benz (January 2024).** Mercedes-Benz Group disclosed that a GitHub personal access token had been leaked in a public repository in late 2023. The token belonged to a developer and granted unrestricted access to Mercedes-Benz's GitHub Enterprise Server, including source code repositories. RedHunt Labs found the token via routine scanning. Mercedes revoked the token within hours of notification; the exposure window was approximately five months.

**Microsoft AI Research (September 2023).** Wiz disclosed that a Microsoft AI research team had committed an Azure SAS token to a GitHub repository (`robust-models-transfer`) granting read/write access to 38TB of internal Microsoft data, including private GitHub data, Microsoft Teams messages, and source code. The SAS token's scope was over-permissive (full-account write rather than scoped to the intended bucket). Microsoft addressed the issue and announced new internal scanning controls.

**Samsung (March 2023).** Samsung confirmed engineers had pasted sensitive Samsung source code into ChatGPT, with the prompts then logged by OpenAI. Different mechanic from GitHub-leaked credentials but closely related to the "engineers paste secrets into the wrong system" pattern. Samsung subsequently banned generative-AI use for sensitive work.

**The EmeraldWhale campaign** documented by Sysdig in October 2024 demonstrated continuous attacker scraping of exposed Git configuration files — ~15,000 cloud credentials harvested from misconfigured public-internet-facing Git config files in a single campaign.[^sysdig-emeraldwhale-campaign-writeup-october] Subsequent 2025 supply-chain campaigns (GhostAction in September 2025, s1ngularity in August 2025, Shai-Hulud in November 2025) have shown the same pattern at scale against package-registry and GitHub-Actions metadata. The window between a credential committed publicly and a credential used by an attacker is now functionally zero for high-value patterns (AWS, GCP, Stripe, Twilio, GitHub PATs).

**Detection-side, GitHub's own data.** GitHub published transparency reports in 2023-2024 noting that its Secret Scanning service detected and partner-revoked hundreds of millions of secrets per year across public and private repositories. The partner-revocation integrations (AWS, Stripe, GCP, dozens of others) auto-disable detected credentials within minutes of the push being scanned. Push Protection, which blocks the secret at `git push` time rather than after, was rolled out as a free feature for all public repos in 2024 — but is only effective if developers don't bypass the warning.

What unites these cases is the structural inevitability of the leak: as long as humans write code that needs to authenticate, and as long as the easiest local-dev pattern is to put credentials in a config file next to the code, secrets will be committed by mistake. The defensive posture is layered (pre-commit hooks + push protection + post-push scanning + IAM hygiene + automated rotation) precisely because no single layer catches everything.

## §5 — Frameworks, deep dive

### NIST SP 800-218 — Secure Software Development Framework (SSDF) v1.1

Published February 2022 (Final). For most of 2022-2025, SSDF was treated as the de facto federal-acquisition baseline for secure software development under the OMB M-22-18 / M-23-16 attestation regime — those memoranda required federal software vendors to attest to SSDF practices on the CISA Secure Software Development Attestation Form (finalized March 2024).[^omb-m-22-18-enhancing][^cisa-secure-software-development-attestation] **OMB rescinded both M-22-18 and M-23-16 on January 23, 2026 via OMB M-26-05 ("Adopting a Risk-based Approach to Software and Hardware Security"); the Common Form is now optional rather than mandatory.** SSDF itself remains the most-referenced NIST framework for secure-development practices; agencies may still use it as part of their tailored risk-based approach, and commercial enterprise RFPs continue to cite SSDF compliance. The directly relevant practices:

- **PO.5 (Implement and Maintain Secure Development Environments)** — covers secrets-handling discipline in the development environment. Includes guidance on managing credentials for build pipelines, IDEs, and dev workstations.
- **PS.1 (Protect All Forms of Code from Unauthorized Access and Tampering)** — the broader source-control security posture. Covers access controls on repos, branch protections, and the integrity of the commit graph.
- **PW.6 (Configure the Compilation, Interpreter, and Build Processes to Improve Executable Security)** — includes the secret-management family during build / deploy.

### NIST SP 800-53 Rev. 5

The federal control catalog. Rev. 5 was published September 2020; latest release is 5.2.0 (August 2025). Directly relevant controls:

- **SA-15 (Development Process, Standards, and Tools)** — includes secrets-handling discipline as part of the SDLC.
- **IA-5 (Authenticator Management)** — including enhancement (5) "Change Authenticators Prior to Delivery" and (7) "No Embedded Unencrypted Static Authenticators." IA-5(7) is the direct mapping for "don't commit credentials to source."
- **SI-12 (Information Management and Retention)** — relevant for the credential's lifecycle once exposed.

### OWASP ASVS v5.0 — Application Security Verification Standard

Published May 30, 2025 at Global AppSec EU Barcelona. Chapter **V13 (Configuration)** covers secrets-management requirements explicitly — V13.x verifications include "secrets must not be included in application source code or included in build artifacts" and "secrets are loaded from secure secret-management systems." ASVS reorganized the secrets chapters from v4's V2 → v5's V13 — when auditing against ASVS, cite by the current v5.0 chapter numbering. (V14 in v5.0 is *Data Protection*, distinct from V13 *Configuration* — easy to conflate.)

### CIS Critical Security Controls v8.1

Released 2024 (maintenance update to v8). Directly relevant safeguards:

- **Control 16 (Application Software Security)** — including 16.4 "Establish and Manage an Inventory of Third-Party Software Components" and 16.11 "Leverage Vetted Modules or Services for Application Security Components." Secrets-management belongs to this control family.
- **Control 8 (Audit Log Management)** — for detecting anomalous use of leaked credentials post-exposure.
- **Control 6 (Access Control Management)** — 6.3 (MFA for external apps) and 6.5 (MFA for administrative access), both directly relevant to limiting the blast radius of a leaked credential.

### HIPAA Security Rule (45 CFR Part 164, Subpart C)

The regulatory frame for Veridian. Relevant sections:

- **164.308(a)(1)(ii)(B) Risk Management** — credentials in public source control are a documented risk factor and should be addressed in the risk register.
- **164.308(a)(3)(ii)(B) Workforce Clearance Procedures** — for executives with elevated access. Reinforces the "executive personal-account exposure is in scope" framing.
- **164.312(d) Person or Entity Authentication** — broken when leaked credentials are usable.

### CWE

- **CWE-798 (Use of Hard-Coded Credentials)** — primary mapping. AWS keys hardcoded in the .env file. Mapping status is **Allowed-with-Review**. CWE-798 was a regular CWE Top 25 entry from 2021-2024; the **2025 methodology change (MITRE removed normalization to abstract weaknesses) dropped CWE-798 off the published Top 25 list**, though it remains a frequently-encountered Base-level weakness in practitioner reporting.
- **CWE-540 (Inclusion of Sensitive Information in Source Code)** — the OSINT-side view: the credential's presence in source enables disclosure.
- **CWE-312 (Cleartext Storage of Sensitive Information)** — the .env stores secrets in cleartext.
- **CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)** — the umbrella parent.[^cwe-200] Note: CWE-200's mapping status is currently **Discouraged** — MITRE recommends citing the more specific child weaknesses (CWE-798 / CWE-540 / CWE-312) for direct mappings.

### GitHub Secret Scanning

GitHub Secret Scanning has been the default-on detection capability for public repositories since March 2023. It scans every push for 200+ known secret patterns and integrates with partner services (AWS, Stripe, GCP, Slack, Twilio, dozens of others) to auto-revoke detected credentials. The **Push Protection** feature blocks the credential at `git push` time and was made free for all public repositories in early 2024. Both detection and Push Protection are also available for private repositories under GitHub Advanced Security (a paid add-on).

Aaron's repo was created in July 2023, so it was Secret Scanning-eligible from creation. Either GitHub's scanner missed the AWS key pattern (the format here is slightly non-standard with the `/` separator), AWS's revocation partner integration didn't fire, or Aaron disabled the notifications. The defense-in-depth case is clear: rely on no single layer.

### TruffleHog

Open-source pre-push and CI secret scanner, maintained by Truffle Security. Entropy-based detection complements pattern-based detection; the CLI, GitHub Action, and pre-commit hook integrations are widely deployed. TruffleHog v3 (current major version as of 2025) supports 700+ detectors with verifiable credential checks (the scanner actually queries the credential's provider to confirm it's live, then reports verified credentials specifically).

### GitGuardian / Gitleaks

GitGuardian is the commercial alternative with dashboard, alerting, and threat-intel features; Gitleaks is the open-source equivalent of TruffleHog's core scanning. Most organizations adopt one or the other (or both as defense-in-depth) for their CI gates.

### detect-secrets / git-secrets / pre-commit

The pre-commit hook ecosystem. **detect-secrets** (Yelp) and **git-secrets** (AWS Labs) are the two most-deployed individual hooks; **pre-commit** (pre-commit.com) is the meta-framework that runs them.[^git-secrets-aws-labs] The defensive value is catching the credential *before* it ever enters the git history — which is the only fully-safe outcome, because once a credential is committed, the credential must be considered compromised regardless of any subsequent remediation.

### MITRE ATT&CK

The relevant techniques:

- **T1593.003 (Search Open Websites/Domains: Code Repositories)** — explicitly names GitHub.[^t1593-003] The reconnaissance technique we just executed.
- **T1552.001 (Unsecured Credentials: Credentials In Files)** — the post-compromise consequence of the finding.[^t1552-001]
- **T1078 (Valid Accounts)** — using the leaked credential against the target's account.
- **T1078.004 (Valid Accounts: Cloud Accounts)** — specifically relevant for AWS access keys.[^t1078-004]
- **T1098 (Account Manipulation)** — what an adversary might do post-compromise to establish persistence.

### MITRE ATT&CK — the two reconnaissance techniques in play

**[T1589.001 — Gather Victim Identity Information: Credentials](https://attack.mitre.org/techniques/T1589/001/)**

This is the technique the whole engagement rests on, and ATT&CK's
placement of it is instructive: it sits in Reconnaissance, before any
tactic that touches the target. Adversaries gather credentials from
breach corpora, paste sites, and public repositories precisely because
that collection is invisible to the organisation whose credentials are
being gathered. Veridian's logs contain nothing about this, and there is
no control Veridian can deploy that would change that.

What Veridian *can* control is whether a gathered credential still
works, which is why the finding converts into rotation and MFA rather
than into monitoring.

**[T1591.002 — Gather Victim Org Information: Business Relationships](https://attack.mitre.org/techniques/T1591/002/)**

The committed `.env` does more than expose keys. It names the services
the project integrated with, which is organisational intelligence in its
own right: an adversary learns which cloud provider, which third-party
APIs, and which authentication patterns a developer is accustomed to
using. When that developer joins a new employer, those habits usually
arrive with them, which is the connection this engagement is actually
investigating.

## §6 — Cert exam relevance

### SANS GOSI (GIAC Open Source Intelligence)

Source-control OSINT is core curriculum. GitHub repository enumeration, organization mapping, and committed-secrets discovery are exam topics. GOSI is a relatively new GIAC cert (launched 2021) and has rapidly become the practitioner-standard credential for OSINT work.

### SANS SEC497 (Practical Open-Source Intelligence)

The flagship SANS OSINT practitioner course, which effectively replaced SEC487 in the SANS catalog. Covers source-control OSINT, TruffleHog, the broader credential-leak ecosystem, and consent / scope discipline for engagement work. SEC497 feeds into GOSI.

### CompTIA PenTest+ (PT0-003)

PenTest+ is the offensive-leaning CompTIA cert; the current exam revision is PT0-003 (released 2024). Domain 2 (Information Gathering and Vulnerability Scanning) covers OSINT-driven source-control enumeration. Domain 3 (Attacks and Exploits) covers credential reuse and lateral movement from leaked secrets.

### CompTIA CySA+ (CS0-003 / CS0-004)

The broad SOC-analyst credential. CS0-003 was the current exam revision as of the May 2026 review date; **CompTIA released CS0-004 in early 2026 for parallel availability, with CS0-003 retiring June 2026**. Through June 2026, candidates may sit either. Domain 1 (Security Operations) covers credential-leak detection workflows; Domain 3 (Incident Response and Management) covers post-leak IR.

### CompTIA Security+ (SY0-701)

The entry-level CompTIA cert. Domain 1 (General Security Concepts) covers OSINT briefly; Domain 4 (Security Operations) covers IAM and credential management.

### GIAC GCIH (Certified Incident Handler)

The enterprise-IR cert. Credential-compromise IR pattern is in scope — "leaked credential discovered in a public repo, rotated, IR follow-up" is the canonical case. Feeds from SANS SEC504.

### ISC2 CISSP

The Common Body of Knowledge cert. Domain 3 (Security Architecture and Engineering) covers secrets-management as an architectural concern; Domain 8 (Software Development Security) covers SSDF / secure SDLC.

### AWS Certified Security — Specialty (SCS-C03)

The AWS-native security cert. AWS released SCS-C03 in late 2025 / early 2026 as the successor to SCS-C02. IAM hygiene and credential leak response are tested domains. Includes AWS GuardDuty findings (the `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.InsideAWS` and `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS` finding families) that fire on leaked-credential usage.

### EC-Council CEH (Certified Ethical Hacker)

CEH v13 is the current version (2024 release). OSINT is covered in the reconnaissance phase. CEH is broadly recognized at federal/DoD level under 8140M; less practitioner-respected than the SANS / OffSec equivalents.

## §7 — What a defender does

Three parallel remediation tracks: Aaron specifically, Veridian as the employer, and Driftwood for our own practice.

### For Aaron specifically

**Rotate the AWS access key today.** Two-minute operation via the AWS IAM console: Users → security credentials → make active access key inactive → create new access key → update Aaron's local `.env` (locally, not committed) → delete the old inactive key after confirming the new one works.[^aws-iam-access-key-best] The exposed credential is functionally revoked the moment it's deactivated; the historical credential in GitHub history becomes inert.

**Regenerate the OpenFDA API key.** The OpenFDA developer console supports key regeneration; the rate-limit reset is automatic.

**Rotate the Flask secret.** Generate a new random value, update local `.env`. The dev-only secret is low-stakes but rotating is cheap.

**Remove from HEAD.** `git rm --cached .env && git commit -m 'remove .env from tracking' && git push`. The credential is now removed from the current branch tip. Optionally `git filter-repo --invert-paths --path .env` and force-push to scrub the historical commits — but the credential is already rotated by this point, so the marginal benefit is small. The credential's continued presence in old forks and the GitHub Archive Program is unavoidable.

**Enable AWS GuardDuty.** GuardDuty has a free 30-day trial and modest ongoing cost (~$1-3/month for a small personal account). The relevant finding families that fire on leaked-credential usage are `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.InsideAWS`, `UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS`, and `UnauthorizedAccess:IAMUser/MaliciousIPCaller.Custom`.

**Audit AWS CloudTrail.** Review API call history under the exposed access key going back to 2023-07-14. CloudTrail retains 90 days by default in the AWS console; if Aaron configured a CloudTrail trail to an S3 bucket, the history may go back further. Anything anomalous (API calls from unexpected IPs, unexpected services accessed, IAM modifications) gets escalated to a real IR engagement.

**Review the S3 bucket contents.** `aws s3 ls s3://ahines-pgx-cache` and walk the contents. What's actually cached there? If patient-identifying data from his clinical-era work, that's a separate HIPAA exposure event requiring Helix's GC involvement.

### For Veridian

**Standardize developer-footprint reviews for new executive hires.** The Friday HIBP lookup + Monday GitHub lookup pattern from `VER-EXP-2026-002` should become the default for every VP+ hire's first 30 days. Cheap, repeatable, produces actionable findings.

**Enable GitHub Push Protection for the Veridian engineering org.**[^github-push-protection] This requires GitHub Advanced Security for private repos (paid) but is free for public. Push Protection catches the secret at `git push` time before it ever enters the history.

**Deploy pre-commit hooks across the engineering team.** detect-secrets or git-secrets, run via the pre-commit framework. Cheap (open-source, no per-seat cost), catches most patterns before the commit even lands locally.

**Add a CI-side scanning gate.** TruffleHog or Gitleaks in the CI pipeline, configured to fail builds on detected secrets. Last-chance catch before merge.

**Subscribe to a continuous monitoring service.** GitGuardian Internal Monitoring or similar continuously scans the org's GitHub presence for newly-committed secrets. The lookup we did manually becomes an automated alert.

**Train executives on personal-OPSEC.** Personal GitHub accounts, Strava segments, donor records, alumni directories — none of these are formally Veridian's concern but all of them feed the threat model around an executive whose name appears in an open-letter campaign.

### For Driftwood (us)

**Maintain scope discipline.** The natural pull on this engagement is to chase every thread — enumerate all four repos in detail, drill into commits, grep for other secret patterns, pivot from the AWS bucket name to enumerate Aaron's personal AWS account. Don't. Marisol authorized the public-profile enumeration and the public-file read; that's what we did. Active testing of the AWS credentials would require a separate authorization. Sticking to the scope is what makes Marisol re-hire us next quarter.

**Document the lookup procedure.** Record date, username, repo URLs, file paths examined, commit hashes at HEAD, and the findings. The brief Marisol writes for Aaron will reference our methodology; future re-runs verify whether Aaron's remediation held.

**Time-bound the finding.** GitHub repo contents change. The lookup is valid as of today; re-run quarterly for active executives as part of the ongoing engagement. Aaron's repo was last touched March 2024 (over two years dormant); his subsequent commits — if any — should be checked at the same time.

**Note the adjacent findings, don't pursue them.** The Strava presence in `sherlock` output is interesting OPSEC adjacent — Aaron's segment leaderboards in his own neighborhood are how the LinkedIn DM's "her school in Coolidge Corner" intel could have been derived. Worth flagging in the writeup as an adjacent observation; explicitly out of scope for active investigation today.

### Sample detection rule (Sigma)

Nothing about this is visible in Veridian's logs, because the exposure is
on a personal repository outside the company. What *is* visible is the
consequence: a leaked key being used.

```yaml
title: AWS access key used from outside expected networks
status: experimental
description: >
  Detects API activity authenticated by a long-lived access key from a
  source outside the organisation's known egress ranges and cloud
  regions. A key published in a public repository is typically exercised
  by automated scanners within minutes of the commit.
logsource:
  product: aws
  service: cloudtrail
detection:
  long_lived_key:
    userIdentity.type: 'IAMUser'
    userIdentity.accessKeyId|startswith: 'AKIA'
  expected_sources:
    sourceIPAddress|cidr:
      - '203.0.113.0/24'    # corporate egress
      - '198.51.100.0/24'   # CI runners
  condition: long_lived_key and not expected_sources
falsepositives:
  - Engineers working remotely with long-lived keys, which is itself the
    problem this rule keeps surfacing. The durable fix is federated
    short-lived credentials, after which any remaining AKIA usage is
    genuinely exceptional.
  - Third-party integrations authorised to call the account. Give each
    one its own principal so it can be excluded by identity rather than
    by address.
level: high
```

Two AWS-native controls do more here than any rule. Turn on
[GuardDuty](https://docs.aws.amazon.com/guardduty/latest/ug/guardduty_finding-types-iam.html),
whose credential-exfiltration findings are built for exactly this and
which detects use of a key from an unexpected principal or location
without any tuning. And know that AWS itself scans public repositories and
applies a quarantine policy to keys it finds, which is a safety net rather
than a control, but it has saved a great many accounts.

The organisational control is the uncomfortable one and belongs in the
report anyway: long-lived access keys should not exist. Federated
short-lived credentials remove the artifact that can be committed at all,
and every finding in this class is downstream of the decision to issue
`AKIA` keys to humans.

## §7.5 — Optional exploration

The credential chain works without this section. The level seeds one hidden bonus find that fires if you happen to run the sherlock command — `progress --detail` lists what you've unlocked.

### Aaron's Strava neighborhood

**Trigger:** `sherlock aaron-hines-md` (you ran this as step 3 of the solve, so the bonus fires there)

**What it teaches:** sherlock surfaces Aaron's Strava with segment leaderboards on **Brookline / Newton hills** — public training routes through his actual neighborhood. Strava heatmap exposure is a real, recurring OPSEC problem with documented mass-OSINT precedent:

- **2018 Strava global heatmap** — Strava published an aggregated activity heatmap as a fitness-engagement marketing artifact. Researchers and journalists quickly noticed that the heatmap revealed previously-classified locations including U.S. military forward-operating bases in active conflict zones, intelligence-community facilities, and embassy compound layouts. The exposure traced to individual soldiers and intelligence officers running on their bases with public Strava accounts. Strava's response was to add a "metro area only" privacy default and disable the global heatmap for new accounts, but the historical exposure remained for pre-2018 accounts that didn't opt in to the new defaults.
- **Pattern persistence**: Strava's segment-leaderboards feature, which is *separate* from the heatmap and still public by default for many accounts, exposes the same neighborhood-pattern intel. Aaron's leaderboard on a Brookline/Newton hill is a deanonymization signal — his actual residential pattern is in the public dataset for anyone running the same `sherlock` query.

For Aaron specifically, the lesson is **executive-protection adjacent**, not core to the credential-leak finding:

- A public-named CMO in a documented hostile-attention campaign should not have segment-leaderboard exposure on routes near his home.
- Marisol's executive-protection vendor (if engaged) will absolutely note this in their threat-model write-up.
- The remediation is straightforward — Strava → Privacy Controls → "Map Visibility" → set to "Followers Only" or hide identifiable segments — but it requires Aaron to do it; Veridian can't do it for him.

For the project: this is the kind of finding that sits between "out of scope" and "must report." Note it in the engagement report, flag it for Marisol's discretion, and let Veridian's exec-protection vendor pick it up if engaged. The MITRE ATT&CK framework's [T1593.001 — Search Open Websites/Domains: Social Media](https://attack.mitre.org/techniques/T1593/001/) covers the technique from the offensive side; the defender response is **accounts inventory + privacy-default audit** for any named executive in a hostile-attention scenario.

For broader awareness: every fitness app, every social media platform, every "find friends nearby" feature shipping in 2026 is the same shape. The 2018 Strava incident is the named example; the underlying pattern is general.

## §8 — Key takeaways

- **Source-control credential leakage is the single most-discovered credential-exposure vector in modern OSINT.** Not because the technique is exotic — because the structural mechanic (git's content-addressable history + `.gitignore`'s forward-only semantics) makes mistakes permanent and because GitHub is the world's largest searchable code corpus. The defensive answer is layered: pre-commit hooks + push protection + post-push scanning + IAM hygiene + automated rotation. No single layer catches everything.

- **`.gitignore` does not retroactively untrack files.** Aaron's pattern — committed `.env`, added `.gitignore` later, assumed the issue was resolved — is universal. The git data model is content-addressable: every committed object is immutable from the moment it's hashed. `.gitignore` is forward-looking. The correct sequence is `git rm --cached <file>` + commit + push, plus credential rotation (which is what actually matters; the historical file is recoverable but the rotated credential is inert).

- **GitHub Secret Scanning is default-on and free for public repos since March 2023.** Push Protection is default-on and free since 2024. If Aaron's repo had been scanned cleanly at push time AND the AWS revocation partner integration had fired, the credentials would have been auto-disabled within minutes of the push. Defense-in-depth assumes that doesn't always work, but the baseline has improved dramatically.

- **Personal-account credential exposure is an executive-OPSEC category most security programs underweight.** Public-figure executives — CMOs, CFOs, GCs, founders — accumulate personal-account footprints over decades that pre-date their current employer's security posture. The cost of a 30-minute HIBP + 30-minute GitHub OSINT engagement during onboarding is trivial; the cost of not doing one is the kind of incident where a 2023 committed AWS key becomes a 2026 breach.

- **For HIPAA-adjacent environments specifically**, personal-AWS exposure that touches clinical-era data creates a multi-party legal question. Aaron's AWS bucket is personal, not Veridian's, but if it contained patient-identifying data from his pre-Veridian employer's clinical work, the BAA / notification chain runs through that prior employer's GC. The OSINT engagement surfaces the technical exposure; the GC determines the regulatory response.

- **OSINT scope discipline is the durable differentiator.** The natural pull on a GitHub OSINT engagement is to chase every thread — enumerate every repo, drill into every commit, pivot from the bucket name to the AWS account, follow up on the Strava segments. Don't. The engagement scope was narrow ("identify committed credentials in public repos"), the deliverable was narrow ("one finding plus a remediation list"), and the next engagement (if Marisol authorizes it) can be a separate authorization for active testing. Sticking to the line is what gets you the next engagement.

- **Aaron's pattern is the universal mid-career-professional pattern.** Personal-OPSEC postures were established a decade or two ago when the professional's public footprint was smaller and the threat model was different. Year-suffix passwords (level0's `BostonStrong#2013`), committed `.env` files (today's finding), public GitHub bios that name current and prior employers — none of these are individually scandalous; their *combination* under the bright light of a public-figure-tier threat model is what makes them load-bearing. The remediation cost is mundane; the institutional habit of catching this *before* the threat model changes is the harder piece.

- **The two findings on this case (Friday's password reuse + Monday's committed AWS key) compose into a single risk picture.** Aaron almost certainly uses `BostonStrong#2013` somewhere; Aaron has live AWS credentials in a public repo. Either finding alone is remediable in minutes; together they describe an executive whose personal-credential hygiene needs a documented refresh. The Veridian recommendation is a one-week OPSEC refresh — password manager rollout, 2FA enrollment, AWS key rotation, GitHub repo audit, brief on personal-account-footprint OPSEC. ~3 hours of Aaron's time, indefinite reduction in the personal-account threat surface.

## §9 — Further reading

*Last reviewed: May 2026 — links and version-specific claims (cert exam versions, framework revisions, regulation citation IDs, NIST publication revision status, historical-case figures) verified current as of the review date. Standards drift over time; if you're reading this more than 6-12 months past the review date, double-check the cited versions before quoting them in audit work.*

[^nist-800-66]: [NIST SP 800-66 Rev. 2 — Implementing the HIPAA Security Rule](https://csrc.nist.gov/pubs/sp/800/66/r2/final). Published February 2024 (Final). The HIPAA implementation reference.
[^omb-m-22-18-enhancing]: [OMB M-22-18 — Enhancing the Security of the Software Supply Chain Through Secure Software Development Practices](https://bidenwhitehouse.archives.gov/wp-content/uploads/2022/09/M-22-18.pdf). The federal software-attestation requirement that cited SSDF. **Rescinded January 23, 2026 by OMB M-26-05** ("Adopting a Risk-based Approach to Software and Hardware Security"). Original whitehouse.gov URL now 404s; cited URL is the National Archives mirror.
[^cisa-secure-software-development-attestation]: [CISA Secure Software Development Attestation Form (finalized March 11, 2024)](https://www.cisa.gov/resources-tools/resources/secure-software-development-attestation-form). The vendor attestation document. Now optional post-M-26-05; some agencies may still collect it as part of their tailored risk-based approach.
[^github-secret-scanning]: [GitHub Secret Scanning](https://docs.github.com/en/code-security/how-tos/secure-your-secrets). Default-on for public repos since March 2023.
[^github-push-protection]: [GitHub Push Protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection). Free for public repos.
[^gitleaks]: [Gitleaks](https://github.com/gitleaks/gitleaks). Open-source equivalent of TruffleHog's core scanning. (Note: project is now in feature-complete / maintenance mode — security patches only — with the maintainer pivoting to a successor project.)
[^git-secrets-aws-labs]: [git-secrets (AWS Labs)](https://github.com/awslabs/git-secrets). Pre-commit hook focused on AWS patterns.
[^gitguardian-state-of-secrets-sprawl]: [GitGuardian "State of Secrets Sprawl" report (2026, 5th edition, published March 17, 2026)](https://www.gitguardian.com/state-of-secrets-sprawl-report-2026). Annual report tracking secrets exposure in public commits — 29M new secrets in 2025, 34% YoY increase.
[^cwe-798]: [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html). Mapping-Allowed. Frequent CWE Top 25 entry.
[^cwe-540]: [CWE-540: Inclusion of Sensitive Information in Source Code](https://cwe.mitre.org/data/definitions/540.html).
[^cwe-312]: [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html).
[^cwe-200]: [CWE-200: Exposure of Sensitive Information](https://cwe.mitre.org/data/definitions/200.html). Mapping-Discouraged — cite the more specific child CWEs above.
[^t1593-003]: [MITRE ATT&CK T1593.003 — Search Open Websites/Domains: Code Repositories](https://attack.mitre.org/techniques/T1593/003/).
[^t1552-001]: [MITRE ATT&CK T1552.001 — Unsecured Credentials: Credentials In Files](https://attack.mitre.org/techniques/T1552/001/).
[^t1078-004]: [MITRE ATT&CK T1078.004 — Valid Accounts: Cloud Accounts](https://attack.mitre.org/techniques/T1078/004/).
[^aws-iam-access-key-best]: [AWS IAM Access Key best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html). Includes "do not embed access keys in code."
[^aws-guardduty]: [AWS GuardDuty](https://aws.amazon.com/guardduty/). The CredentialExfiltration finding families.
[^aws-cloudtrail]: [AWS CloudTrail](https://aws.amazon.com/cloudtrail/). For post-exposure API call audit.
[^toyota-october-2022-disclosure-t]: [Toyota October 2022 disclosure (T-Connect)](https://blog.gitguardian.com/toyota-accidently-exposed-a-secret-key-publicly-on-github-for-five-years/). Technical writeup of the T-Connect source-code exposure; Toyota's own notice is no longer online. (A separate Toyota May 2023 disclosure — the ~2.15M-customer vehicle-location leak — is sometimes conflated with this one and has different mechanics.)
[^sysdig-emeraldwhale-campaign-writeup-october]: [Sysdig EmeraldWhale campaign writeup (October 2024)](https://www.sysdig.com/blog/emeraldwhale). Documents continuous scraping of exposed Git configuration files — ~15,000 cloud credentials harvested in a single campaign.

### Further reading

- [NIST SP 800-218 — Secure Software Development Framework (SSDF) v1.1](https://csrc.nist.gov/pubs/sp/800/218/final). February 2022, Final. The federal-acquisition baseline.
- [NIST SP 800-53 Rev. 5 — Security and Privacy Controls for Information Systems and Organizations](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final). Published September 2020; latest release 5.2.0 (August 2025).
- [OWASP ASVS v5.0](https://owasp.org/www-project-application-security-verification-standard/). Chapter V13 (Configuration) covers secrets-management. (V14 in v5.0 is *Data Protection* — easy to conflate; cite V13 for secrets specifically.)
- [CIS Critical Security Controls v8.1](https://www.cisecurity.org/controls).
- [HIPAA Security Rule (45 CFR Part 164, Subpart C)](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C).
- [TruffleHog](https://github.com/trufflesecurity/trufflehog). Open-source pre-push / CI scanner. 700+ detectors with verified-credential checks.
- [GitGuardian](https://www.gitguardian.com/). Commercial alternative with dashboard + continuous monitoring.
- [detect-secrets (Yelp)](https://github.com/Yelp/detect-secrets). Pre-commit hook with entropy-based detection.
- [pre-commit framework](https://pre-commit.com/). The meta-framework for running hooks.
- [AWS Security Token Service (STS)](https://docs.aws.amazon.com/STS/latest/APIReference/). The temporary-credential alternative to long-lived IAM access keys.
- [Uber 2014/2016 breaches — Krebs on Security retrospective](https://krebsonsecurity.com/?s=uber). Brian Krebs's archive includes the 2014 incident (AWS-keys-in-GitHub) and the 2016 follow-on.
- [Mercedes-Benz January 2024 (RedHunt Labs writeup)](https://redhuntlabs.com/blog/mercedes-benz-source-code-at-risk-github-token-mishap-sparks-major-security-concerns/). The PAT-in-public-repo finding.
- [Wiz Microsoft AI Research September 2023 writeup](https://www.wiz.io/blog/38-terabytes-of-private-data-accidentally-exposed-by-microsoft-ai-researchers). The 38TB Azure SAS exposure.
- [SANS GOSI / SEC497 reading list](https://www.sans.org/cyber-security-courses/practical-open-source-intelligence/).
- [Trace Labs CTF](https://www.tracelabs.org/). Real-world OSINT practice (missing-persons cases, with explicit ethical framing).
- [OSINT Framework (community-maintained)](https://osintframework.com/). Index of OSINT tools by category.
