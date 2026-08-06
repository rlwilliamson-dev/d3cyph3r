# D3CYPH3R

**Live: https://www.d3cyph3r.com**

A browser-based terminal that teaches infrastructure engineers to find security exposure in systems they have inherited, and to write up what they find in the language of control frameworks.

**Who it is for.** DevOps engineers, SREs, and sysadmins who already run production systems and need the security half of the job: recognising a misconfiguration, tracing its blast radius, and mapping it to a control that an auditor, a customer questionnaire, or a regulator will recognise.

**The problem it solves.** Most security training splits badly. Capture-the-flag platforms teach exploitation against artificial targets and stop at the flag. Compliance training teaches control language with no technical substance behind it. Neither produces the thing the job actually needs, which is the ability to look at a real system, find the defect, and say precisely which control failed and what the exposure is worth.

D3CYPH3R closes that gap. Every level is a realistic inherited system: an offboarded consultant's laptop, a production bastion, a seized workstation image, a cloud account mid-migration. You investigate with faithful simulations of the real tools. Each level then ends with a written post-mortem that traces the finding to specific CWE weaknesses, NIST 800-53 controls, MITRE ATT&CK techniques, and the regulatory regime governing that client.

24 levels across 7 tracks. 135 player-callable commands. No backend, no accounts, no telemetry.

---

## Architecture

The system is four layers with a strict dependency direction: scenario data knows nothing about the engine, commands know nothing about each other, and the engine knows nothing about any individual level.

### Terminal and dispatch

`js/engine/execute.js` is the single dispatcher, invoked once per Enter press. The pipeline is deliberate and ordered:

```
echo input -> password-gate check -> ssh special case -> parseLine into a
statement chain -> per-statement: brace expansion -> variable expansion ->
quote stripping -> leading NAME=value assignments -> COMMANDS lookup -> print
```

`js/engine/parse.js` is a real quote-aware tokenizer producing a statement chain with `&&`, `||`, `;`, and background `&`, each carrying exit-code semantics. `js/engine/expand.js` implements `$VAR`, `${VAR}`, `$?`, and `$(...)` command substitution over a three-layer environment: live built-ins, static per-level `env_vars`, and a writable `processEnv` the player mutates with `export`. Pipelines thread stdout into the next command's `stdin` parameter.

Every command handler has one signature, `(level, arg, stdin?, argv?)`, returning `{ text, cls }` or `null`. That uniformity is what makes 135 commands tractable: there is no per-command wiring in the engine.

### Command layer

30 modules under `js/commands/`, composed into a single `COMMANDS` map by spread order in `index.js`. Later spreads intentionally override earlier ones, which is how the multi-subcommand `openssl` supersedes the X.509-only version.

Commands divide into two classes, and the distinction is the honest description of what "simulated" means here:

**Evaluators** parse and execute player input rather than matching it against expected answers. `js/commands/sqli.js` is 721 lines implementing a tokenizer, `UNION` handling, `WHERE` with `LIKE` and boolean tautologies, the `information_schema` virtual tables, and quote-aware comment stripping. It runs the injected query for real, which is why an arbitrary correct payload works and a malformed one returns the genuine MySQL 1064 error. `sqlite3` projects, filters, sorts, and limits over in-memory tables. `jq`, `awk`, `grep`, the `openssl enc` passphrase gate, and the `sudo` sudoers glob matcher are likewise evaluated, not looked up.

**Renderers** format level-declared data into canonical tool output. `nmap` reads `level.net[host]`, honours `-sV` by changing the column layout, and returns real error strings such as `No route to host`. The data is authored; the presentation and flag behaviour are faithful.

Where a simulation diverges from the real tool, it is documented in `man <command>` rather than hidden. `grep` matching is always case-insensitive and `-i` is an accepted no-op. `openssl enc` is decrypt-only, because the filesystem is read-only. `sqlite3` and `jq` implement documented subsets with no joins and no writes.

### Virtual filesystem

Each level declares a nested `fs` tree of three node types: `dir`, `file`, and `symlink`. At module init, `js/fs/flatten.js` derives a flat `path -> content` map alongside it. Both representations are read-only after boot.

`js/fs/resolve.js` provides `resolvePath` (user input to an absolute parts array, handling `~`, `..`, and `.`) and `getFSNode` (walk the tree, following symlinks with a 16-hop cycle cap). `js/fs/glob.js` expands `*` and `?`. Files carry mode, owner, and group, and `cat` enforces a real Unix read-permission check against the level's `playerUser`, which is what makes permission-based puzzles possible.

### Scenario data

Levels are pure data: one object literal per level in `levels/<track>.js`, keyed `<user>@<host>`. Commands read optional declarative fields, so adding a scenario requires no engine change. The contract spans 78 distinct fields, 72 of them read by command modules, including `fs`, `permissions`, `env_vars`, `net`, `dnsData`, `sqlite_dbs`, `sqli`, `sudo`, `cloud`, `postgres`, `gitRepos`, and `evtxLogs`. A command degrades to a graceful empty state when its field is absent, which is why a level declares only what its scenario needs. `js/engine/validate.js` checks level data at init and warns on schema violations.

Progress is derived state. `sessionStorage` holds visited levels, bonus finds, hint counters, per-level times, and achievements; `js/engine/persistence.js` provides an opt-in `localStorage` mirror through a single `TRACKED_KEYS` registry, with sessionStorage authoritative on conflict so hydration is idempotent. `js/engine/savecode.js` encodes the whole progress set into a portable code using append-only registries and a CRC32 checksum, so progress moves between browsers without an account.

---

## Control framework mapping

Every level ends with a structured post-mortem written as an audit deliverable: the finding, the weakness class, the controls that should have caught it, the ATT&CK technique an adversary would be using, and the regulatory consequence for that client.

Coverage is measured, not asserted:

| Framework | Levels citing it |
|---|---|
| MITRE ATT&CK | 24 of 24 |
| CWE | 24 of 24 |
| NIST 800-53 | 18 of 24 |
| CIS Critical Security Controls | 18 of 24 |
| OWASP Top 10 | 18 of 24 |

Regulatory regime is assigned per track and applied consistently, because the same technical defect carries different consequences depending on the data involved:

| Track | Client | Regime |
|---|---|---|
| Linux | Halton Bank | GLBA § 501(b) (Interagency Guidelines) |
| Network | Atlas Health | HIPAA |
| Crypto | Vesta Retail | PCI-DSS |
| Web | Meridian State University | FERPA |
| Forensics | Polaris Defense Systems | CMMC, NIST 800-171 |
| OSINT | Veridian Analytics | HIPAA, HITRUST CSF |
| Cloud | Coverline Insurance | SOC 2, NAIC, NYDFS |

### Worked example: `level3@linux`

The player lands on a build server as `daniel`, an account belonging to a consultant who rolled off the engagement a year earlier and was never deprovisioned.

**Investigation.** `sudo -l` enumerates the account's rights and returns one surviving grant:

```
User daniel may run the following commands on halton-build-runner:
    (root) NOPASSWD: /usr/bin/cat /var/backups/halton-prod/*
```

The grant was written for a 2024 migration and marked for removal after cutover. A plain `cat` of the backup returns `Permission denied` because ingest re-owns delivered files to `root:root` mode 0600. Prefixing `sudo` reads them as root, and the backup, a routine snapshot of a config directory, contains a production Vault root token in cleartext.

**Mapping produced by the level's post-mortem:**

| Layer | Citation | Why |
|---|---|---|
| Weakness | CWE-250, Execution with Unnecessary Privileges | The grant let a dormant account act as root |
| Weakness | CWE-732, Incorrect Permission Assignment for Critical Resource | The grant was never revoked or scoped; the wildcard reaches anything written under that path |
| Weakness | CWE-312, Cleartext Storage of Sensitive Information | Live secrets sat in plaintext inside a config backup |
| Control | NIST 800-53 Rev. 5 AC-6, Least Privilege | A wildcard NOPASSWD grant is the textbook violation; AC-6(1) and AC-6(2) push privileged commands onto separate audited accounts |
| Control | NIST 800-53 AC-2(3), Disable Accounts | The account survived offboarding on a second host, making it a systemic identity-lifecycle failure rather than a one-host slip |
| Control | NIST 800-53 PS-4, Personnel Termination | Requires revoking access and authenticators; his SSH key still worked |
| Control | NIST 800-53 CM-6 and SC-28 | The backup should have been encrypted and its secrets excluded |
| Technique | MITRE ATT&CK T1548.003, Abuse Elevation Control Mechanism: Sudo and Sudo Caching | Adversaries enumerate sudo rights and abuse permissive entries; the level's solve path is the technique |
| Technique | MITRE ATT&CK T1078.003, Valid Accounts: Local Accounts | The surviving local account is the foothold |
| Regime | GLBA § 501(b), Interagency Guidelines | Halton is a bank, so its rule is 12 CFR Pt. 30 App. B rather than the FTC Safeguards Rule that covers nonbank institutions; III.C.1.a access control and III.C.1.f monitoring attach, and a notification incident carries a 36-hour regulator clock |

The corresponding walkthrough carries this further into remediation sequencing, detection engineering, and the distinction between a control gap and a documented control the organisation did not follow.

Each level also ships a long-form walkthrough under `/walkthroughs/`, one per level, all 24 conforming to the same eleven-section structure: setup, solve, vulnerability class, blast radius, real-world parallels, framework deep dive, certification relevance, defender actions, optional exploration, key takeaways, and cited further reading. Conformance is enforced by the generator rather than by review: a walkthrough missing a section, repeating one, or ordering them differently fails the build. External citations carry a review date and are verified against primary sources when written.

---

## Design decisions

**No backend.** The application is static files. There is no server to compromise, no database holding player data, no authentication surface, and no session state to hijack. `connect-src 'self'` in the Content-Security-Policy means the running application makes no outbound requests at all. The trade-off is accepted deliberately: no server-side validation, therefore no scored competition and no leaderboard. Given that the product is a training tool, that trade is worth making, and the section below on credential storage follows directly from it.

**Zero runtime JavaScript dependencies.** There is no root `package.json`, no bundler, and no CDN script tag. `index.html` loads exactly one module, `js/main.js`, and everything else is native ES module imports. `script-src 'self'` enforces it at the browser. The motivation is supply chain: a dependency you do not have cannot be compromised, typosquatted, or abandoned. Playwright is a development-only dependency under `tests/`, and the walkthrough reader vendors `marked.js` locally rather than fetching it from a CDN.

Nothing is compiled to serve the site: a clone runs under `python3 -m http.server` with no toolchain. One generator exists, `tools/build-walkthroughs.mjs`, which renders the walkthrough markdown into static pages. It is deliberately kept off the deploy path. Its output is committed, so deployment stays a file copy and cannot fail a build step, and CI re-runs it purely to verify the committed pages still match their sources. It has no dependencies of its own, using Node builtins plus the already-vendored `marked`.

One exception, stated because the claim is otherwise misleading: `style.css` imports three typefaces from Google Fonts, so `fonts.googleapis.com` and `fonts.gstatic.com` are permitted in CSP and are the only third-party origins the application contacts. Self-hosting those files would reduce the application to a single origin and is on the roadmap.

**Security headers as a first-class artifact.** `staticwebapp.config.json` sets Content-Security-Policy, Strict-Transport-Security, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy, Cross-Origin-Embedder-Policy, Cross-Origin-Resource-Policy, and `X-Permitted-Cross-Domain-Policies`. This is a security teaching tool, so its own posture is part of the artifact.

That posture is observably enforced rather than merely declared. Opening DevTools on the live site shows CSP violations blocking `static.cloudflareinsights.com` and Cloudflare's bot-detection script, both injected by the CDN onto the proxied domain. The blocks are the browser proving the no-third-party-scripts claim, and a `console.info` on load points readers at the explanation so the errors are not mistaken for breakage.

**Static hosting on Azure Static Web Apps.** Deployment is a GitHub Actions workflow. Pull requests get an isolated preview environment; the full test suite gates merges to main; production deploys from main only.

**Data as data.** Levels are declarative objects rather than code, which keeps content contributions out of the engine, allows schema validation at init, and means the 17,500 lines of scenario data carry no execution risk.

---

## Credential storage and threat model

Level gates are plaintext strings in the scenario data, compared directly in the browser:

```js
if (val === password) { /* grant */ }
```

They are trivially readable. This is verifiable against production in one command:

```bash
curl -s https://www.d3cyph3r.com/levels/linux.js | grep -oE 'password: "[^"]*"'
```

That is stated plainly because it is a deliberate position, not an oversight.

Hashing the comparison would be security theater. The credential that gates each level is also present, by design, in the level content the player is instructed to read: `level0@linux` gates on a string that appears inside `creds.txt` as `pass: please-rotate-me`, because *finding* that credential is the entire puzzle. Hashing the gate field would protect a value sitting in cleartext in the adjacent file. Genuinely concealing it would require encrypting the scenario content, which would destroy the teaching mechanism.

The threat model has no adversary. There is no score, no ranking, no reward, and no shared state between players. A recovered credential unlocks the next level of a fictional scenario and has no meaning outside the sandbox. There is nothing to protect, so a control protecting it would add complexity and defeat the teaching purpose while mitigating no risk.

If the project ever adds scored or competitive play, the correct fix is server-side validation, not client-side hashing, because any client-side check is defeatable by the party who controls the client. Recording that reasoning is the point: identifying that a control is unnecessary, and knowing which control would actually be required if the requirement changed, is the same judgement the rest of this project is built to teach.

---

## Verification

381 automated tests across 15 Playwright specs drive the real terminal in a browser: real keystrokes, real dispatch, real DOM assertions. They cover every level's solve path, its credential gate, its bonus finds, and the engine surfaces including pipelines, expansion, persistence, save codes, and the lobby.

Merges to main are gated on the full suite, sharded across four parallel runners. Pull requests deploy a preview environment. CodeQL runs on main.

```bash
python3 -m http.server 8000          # ES modules require an HTTP origin
cd tests && npm install && npx playwright install chromium
npx playwright test
```

---

## Status and roadmap

Current release is v2.7.0. All seven tracks are playable through level2. Level3 has shipped for linux, crypto, and forensics.

**Level3 across the remaining four tracks** (network, web, osint, cloud). Each already has its breadcrumb credential staged in the shipped level2, so the chain is continuous when the content lands.

**Systematic NIST CSF 2.0 mapping.** CSF references currently appear in the cloud track and in several walkthroughs, but the coverage is ad hoc rather than complete. The work is to map every level to CSF 2.0 Functions and Categories alongside the existing 800-53 control citations, and to publish the crosswalk as a document rather than leaving it distributed across post-mortems.

**ISO/IEC 27001 and 27002 mapping.** ISO is referenced in one track today. The same crosswalk treatment applies, which matters for readers whose organisations certify against ISO rather than operating under a US federal control catalogue.

**Risk quantification.** No level currently expresses a finding in loss-exposure terms. Adding a FAIR-style treatment to the post-mortems, framing frequency and magnitude rather than a severity label, is the largest single improvement available to the teaching model, because "critical" is not a decision input and an expected loss range is.

**Self-hosted typefaces**, removing the last third-party origin.

Release history is in [CHANGELOG.md](CHANGELOG.md). Engine internals and content conventions are in [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Repository layout

```
index.html                 Single entry point; loads js/main.js
staticwebapp.config.json   Routing, security headers, 404
js/
  main.js                  Boot sequence: mobile gate, theme, engine, lobby
  engine/                  Dispatch, parsing, expansion, state, ssh, lobby,
                           progress, persistence, save codes, validation
  commands/                30 modules composed into one COMMANDS map
  fs/                      Path resolution, symlink walking, glob expansion
  terminal/                DOM refs, input handling, output, prompt, themes
levels/                    Scenario data, one file per track
walkthroughs/              Long-form solve guides, one per level
  <track>/<level>.md       Source
  <track>/<level>.html     Generated, committed, verified by CI
tools/
  build-walkthroughs.mjs   Renders walkthroughs to static pages
tests/                     Playwright suite
```

Adding a level is a single object literal in `levels/<track>.js`. The schema is documented at the top of `levels/linux.js`, with per-track extensions documented in each track file.

---

## Credit

The engine architecture is a refactor of, and was inspired by, [Shellscape](https://github.com/5H4RV1L/shellscape) by Sharvil Sagalgile, MIT-licensed. All level content in this repository is original.

## AI use disclosure

Claude (Anthropic) was used as a coding and writing assistant: auditing code, running automated test playthroughs before commits, drafting walkthrough markdown, and writing technical documentation. All level design is original to this project, including the Driftwood Systems setting, the recurring characters and clients, the puzzle mechanics, and every narrative beat.

## Authorised use

The techniques taught here are the ones defensive teams use to find exposure on infrastructure they own. Do not apply them against systems you do not own or are not authorised to test. Unauthorised access is illegal in most jurisdictions, including under the CFAA in the United States and the Computer Misuse Act in the United Kingdom.

## Privacy

No account, no server, no telemetry, no analytics, no cookies, no third-party scripts. Progress lives in `sessionStorage` and resets when the tab closes. `localStorage` holds a theme preference, command history, and, only after explicit opt-in via `progress save-on`, a mirror of session progress. The `save` command emits a portable progress code so progress can move between browsers without an account.

## License

MIT. See [LICENSE](LICENSE).
