# Security Policy

D3CYPH3R is a browser-based static site hosted on Azure Static Web Apps. The most likely vulnerability surfaces are:

- Cross-site scripting in the walkthrough markdown renderer (`walkthroughs/walkthrough.js` + the vendored `marked.js`)
- Content-Security-Policy bypasses (the CSP is defined in `staticwebapp.config.json`)
- Stored-state issues in `sessionStorage` handling
- Supply-chain risk in vendored dependencies (`walkthroughs/vendor/marked.esm.min.js`)

The "infrastructure" the player audits inside the game is **entirely simulated** — no real systems are reachable from the engine, and there is nothing to "compromise" inside a level. Findings against fictional Driftwood Systems / Halton / Atlas / Vesta / Meridian / Polaris / Veridian / Coverline are out of scope.

## Reporting a vulnerability

Please report security issues privately via GitHub's [private vulnerability reporting](https://github.com/rlwilliamson-dev/d3cyph3r/security/advisories/new) feature.

This is a hobby project with no formal SLA, but I'll respond within a reasonable timeframe for genuine vulnerabilities.

Routine bug reports — gameplay issues, content errors, broken external links, typos — belong in the [public issue tracker](https://github.com/rlwilliamson-dev/d3cyph3r/issues) instead.

## Scope

**In scope:**
- Code execution or data exfiltration via the `d3cyph3r.com` web application
- CSP bypasses or weakening
- Vulnerabilities in the static-asset pipeline or build process
- Supply-chain issues in vendored dependencies

**Out of scope:**
- Vulnerabilities in dependencies that are documented and acknowledged upstream
- Social-engineering attempts against the maintainer
- Issues requiring an attacker to already control the user's browser, machine, or local network
- Findings against the in-game fictional infrastructure (it's all simulated)
- Self-XSS or other issues requiring the victim to copy-paste attacker-supplied input

## Acknowledgement

There's no formal hall of fame yet. If you'd like credit for a reported vulnerability, please mention it in your report and I'll add an acknowledgement to the relevant release notes.
