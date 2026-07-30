// D3CYPH3R Walkthroughs — router + markdown renderer.
//
// Single shell page (`index.html`) serves the entire walkthroughs
// subsite. We use HASH-based routing rather than path-based to avoid
// any Azure Static Web Apps rewrite configuration — the server only
// ever sees `/walkthroughs/`, and the hash is JS-only:
//
//   /walkthroughs/                  → index (list of tracks)
//   /walkthroughs/#/<track>         → track index (list of levels)
//   /walkthroughs/#/<track>/<level> → fetch + render the .md file
//
// Markdown rendering goes through marked (vendored — see vendor/).
//
// A walkthrough markdown file whose first block is a blockquote
// starting with "⚠" gets that blockquote auto-classed as
// `.spoiler-warning` so the CSS callout treatment applies. Authors
// don't need to write any HTML.

import { marked } from "./vendor/marked.esm.min.js";
import { initTheme, cycleTheme, getTheme } from "../js/terminal/theme.js";

// Defense-in-depth XSS hardening (v1.24.3, extended v1.24.4).
//
// marked v12 ships with no built-in sanitizer (the deprecated `sanitize`
// option was removed in v5+). Walkthrough markdown is author-controlled
// via PR review, and production CSP (`script-src 'self'`, no
// `unsafe-inline`) already neuters <script>/onerror/onclick payloads,
// but markdown still has two routes for code execution that CSP doesn't
// block:
//
//   1. RAW HTML tokens (`<a onclick=...>`, `<style>...</style>`) — the
//      v1.24.3 `html: () => ""` renderer override drops these before
//      they reach article.innerHTML.
//
//   2. `javascript:` / `data:` / `vbscript:` URLs in markdown link
//      syntax `[text](javascript:alert(1))` — these are NOT raw HTML,
//      so the html-token override doesn't catch them. They become
//      `<a href="javascript:...">` which clicking executes. CSP doesn't
//      gate navigation. v1.24.4 adds renderer.link + renderer.image
//      overrides that reject any href whose scheme isn't one of:
//      https:, http:, mailto:, tel:, # (fragment), / (root-relative),
//      ./ or ../ (relative). Disallowed-scheme links render as plain
//      text (the link's visible text, without the href).
//
// CodeQL (default query suite) flags the `article.innerHTML = ...` line
// even with these mitigations in place because it can't statically
// trace marked's renderer config across module boundaries. The marked-
// configured-with-html-stripped-and-link-sanitized + author-controlled
// source + CSP combination is what actually makes this safe at runtime.
// The CodeQL alert is dismissed with that explanation.
//
// Walkthroughs are pure markdown — headings, lists, links, code fences,
// tables. There is no legitimate use of raw HTML in any current
// walkthrough (fenced code blocks remain unaffected because marked
// tokenizes them as `code`, not `html`). No current walkthrough uses
// links with non-http(s) schemes. If a future walkthrough needs
// styled content or non-http schemes, extend the grammar/CSS instead
// of widening these renderer overrides.

// Allowed URL schemes for both link href and image src. Anything else
// (javascript:, data:, vbscript:, file:, ftp:, etc.) gets dropped.
const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/)/i;

// Escape a string for safe inclusion in an HTML attribute value.
// Only used on the title attribute below; href is already validated
// against SAFE_URL and the renderer-supplied text is pre-rendered HTML
// (marked tokenizes inline formatting in display text and passes the
// rendered HTML in, not raw markdown).
function escAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

marked.use({
  renderer: {
    // Drop raw HTML tokens entirely (v1.24.3).
    html: () => "",
    // Sanitize link hrefs (v1.24.4 + v1.26.0 fix).
    //
    // Marked 12 calls renderer.link with POSITIONAL ARGS
    // `(href, title, text)`, not a token object. The v1.24.4 code
    // destructured `token.href` on what was actually the href string,
    // which always evaluated SAFE_URL against undefined (== false),
    // dropped every link into the sanitize-and-strip branch, then
    // crashed when `this.parser.parseInline(token.tokens)` reached for
    // a parser binding that doesn't exist in marked 12's renderer
    // call context. (The bug was masked on most walkthroughs because
    // links rendered as empty `<a>` tags rather than throwing — the
    // network/level2 markdown was the first to hit the autolinker
    // path that took the throw branch instead.) Fix: switch to the
    // documented marked 12 signature and render the safe-case link
    // ourselves rather than relying on the marked 9-era "return false
    // to fall through to default" contract that marked 12 no longer
    // honors for renderer overrides registered via marked.use().
    link(href, title, text) {
      if (!SAFE_URL.test(href || "")) {
        return text || "";
      }
      const titleAttr = title ? ` title="${escAttr(title)}"` : "";
      return `<a href="${escAttr(href)}"${titleAttr}>${text}</a>`;
    },
    // Same v1.26.0 signature fix for images. Disallowed src renders
    // as the alt text (or empty if no alt). Walkthroughs don't
    // currently embed images, but enforcing this now means a future
    // walkthrough PR can't accidentally introduce a
    // data:image/svg+xml payload (which CAN contain scripts that
    // fire on render in some browsers).
    image(href, title, text) {
      if (!SAFE_URL.test(href || "")) {
        return text || "";
      }
      const titleAttr = title ? ` title="${escAttr(title)}"` : "";
      const altAttr = text ? ` alt="${escAttr(text)}"` : "";
      return `<img src="${escAttr(href)}"${altAttr}${titleAttr}>`;
    },
  },
});

// ─── Manifest ────────────────────────────────────────────────
//
// The lookup table the index/track pages render from. Hand-edited
// when a new walkthrough ships. Order matches the lobby's track
// order for consistency.

const MANIFEST = {
  linux: {
    title: "Linux",
    blurb:
      "File reading, credential hunting, and the consultant-laptop " +
      "audit pattern. Client: Halton Bank — GLBA Safeguards Rule.",
    levels: {
      level0: {
        title: "Daniel's Last Day",
        blurb:
          "Audit an offboarded consultant's laptop before reimaging. " +
          "Find the client credential he left behind.",
      },
      level1: {
        title: "The Backup Daniel Forgot",
        blurb:
          "Day two. Using the leaked staging credential, walk Halton's " +
          "jumphost. A debug copy of a properly-locked-down systemd " +
          "override leaks the production DB password. CWE-732.",
      },
      level2: {
        title: "Daniel's Forgotten Cron",
        blurb:
          "Day three. Halton reuses the prod DB password as the bastion " +
          "SSH login. Inside, an offboarded consultant's cron job runs " +
          "weekly under bash `set -x` and writes its SSH-key passphrase " +
          "to a world-readable log. CWE-250 + CWE-532 + CWE-521.",
      },
      level3: {
        title: "Daniel's Forgotten Sudo",
        blurb:
          "Daniel's snapshot key drops you onto the build-runner as him. " +
          "`sudo -l` reveals a leftover NOPASSWD grant that survived his " +
          "offboarding; a wildcard `sudo cat` reads a prod Vault root " +
          "token the weekly backup swept up. CWE-250 + CWE-732 + CWE-312.",
      },
    },
  },
  network: {
    title: "Network",
    blurb:
      "Port scanning, perimeter audit, and DNS reconnaissance. " +
      "Client: Atlas Health — HIPAA.",
    levels: {
      level0: {
        title: "Atlas Health Perimeter Check",
        blurb:
          "Quarterly verification of a healthcare client's claim that " +
          "their staging database is VPN-only. nmap finds it isn't.",
      },
      level1: {
        title: "The Map Marcus Didn't Mean to Share",
        blurb:
          "Day two. With Priya's authorized blast-radius check, the " +
          "staging-DB host's internal DNS resolver gives up the full " +
          "data-center map plus a service-account credential stashed " +
          "in a TXT record. CWE-306 + the sticky-account anti-pattern.",
      },
      level2: {
        title: "What the Cert Knew",
        blurb:
          "Day three. The Tessera-dry-run audit-bypass cred lands the " +
          "player on a host the asset-management tool says doesn't " +
          "exist. Apache's self-signed cert documents Atlas's internal " +
          "infrastructure in its SAN list, names a service mailbox in " +
          "its OU field, and the mailbox's autoresponder log ships the " +
          "level3 temp credential in cleartext. CWE-1188 + CWE-547 + " +
          "CWE-532 plus CT-log permanence (RFC 6962).",
      },
    },
  },
  crypto: {
    title: "Crypto",
    blurb:
      "Encoding ≠ encryption, and signing ≠ verifying. " +
      "Client: Vesta Retail — PCI-DSS.",
    levels: {
      level0: {
        title: "Theo's Safer API Key",
        blurb:
          "Pre-PCI-DSS-audit review at a retailer. A junior engineer " +
          "base64-encoded a payment-processor API key and called it " +
          "protection. base64 is not protection.",
      },
      level1: {
        title: "Theo's Signature That Wasn't",
        blurb:
          "Day two. Same engineer shipped a homegrown JWT auth for " +
          "Vesta's internal admin API — verify-middleware calls " +
          "jwt.verify without an algorithms whitelist. Tokens with " +
          "alg:none get accepted. CWE-347 + CWE-532 for the secrets " +
          "in the debug log.",
      },
      level2: {
        title: "Theo's Quick Hash",
        blurb:
          "Day three. Saanvi (CISO) pulled a wider review and Priya " +
          "found Theo's commit titled \"safer than plaintext\" — 200 " +
          "unsalted MD5 hashes in the deploy repo. john --wordlist=" +
          "rockyou.txt cracks four of them in under a second; all " +
          "four are the same plaintext (TheoVesta!1), one labeled " +
          "aes-backup. CWE-916 + CWE-759 + CWE-521 + CWE-262, plus " +
          "PCI-DSS v4.0 §3.5.1 + §8.3.2 + NIST SP 800-63B-4.",
      },
      level3: {
        title: "Theo's Encrypted Backup",
        blurb:
          "Day four, and the capstone of the track. The password " +
          "john cracked is the AES passphrase on Vesta's nightly " +
          "production backup — and the login on the host holding " +
          "it. AES-256 is never broken here; the key was the whole " +
          "problem. Inside: full PANs and retained CVV, which no " +
          "amount of encryption makes permissible. CWE-326 + " +
          "CWE-522 + CWE-312, PCI-DSS v4.0.1 §3.3.1 + §3.5.1 + " +
          "§3.7, OWASP A04:2025.",
      },
    },
  },
  web: {
    title: "Web",
    blurb:
      "HTTP directory enumeration and broken access control. " +
      "Client: Meridian State University — FERPA.",
    levels: {
      level0: {
        title: "Meridian's Forgotten Backup Folder",
        blurb:
          "Pre-cyber-insurance-renewal web audit at a state university. " +
          "A dismissed agency left a backup directory under DocumentRoot " +
          "with autoindex on. 4,217 student records + a live DB credential.",
      },
      level1: {
        title: "Carlos's Login Wall",
        blurb:
          "Day two. Carlos's homegrown transcript-download endpoint is " +
          "behind SSO but never checks per-student authorization. Any " +
          "logged-in student can pull any other student's transcript. " +
          "IDOR via CWE-639 + a BluePier-era demo account whose " +
          "advisor_notes field carries the level2 breadcrumb.",
      },
      level2: {
        title: "The Search Bar That Talks",
        blurb:
          "Day three. The portal-svc credential from level1 (SSH-reused " +
          "across hosts) lands you on the catalog host, where BluePier's " +
          "2021 course-search glues the query parameter straight into a " +
          "SQL string. UNION-based SQL injection through a public, " +
          "unauthenticated search box dumps the app's config table — the " +
          "plaintext DB-admin credential — and reaches the FERPA-protected " +
          "students table. CWE-89 + verbose-error (CWE-209) leak.",
      },
    },
  },
  forensics: {
    title: "Forensics",
    blurb:
      "EXIF metadata and insider-threat analysis. Client: Polaris Defense " +
      "Systems — CMMC / NIST 800-171.",
    levels: {
      level0: {
        title: "Reed's Soccer Alibi",
        blurb:
          "Internal investigation at a defense subcontractor. A cleared " +
          "engineer's submitted alibi photo carries EXIF metadata placing " +
          "it eight months earlier and 1,000 miles south.",
      },
      level1: {
        title: "What the Logs Saw",
        blurb:
          "Day two. Polaris IR imaged Reed's workstation; the Security " +
          "event log carries his Saturday-morning CUI-exfil chain " +
          "(PowerShell Compress-Archive → certutil -encode → chrome → " +
          "mega.nz) AND an IR responder's password mistyped into the " +
          "TargetUserName field of a 4625 failed-logon record. " +
          "CWE-532 + the LOLBin / Valid-Accounts insider-threat pattern.",
      },
      level2: {
        title: "What Reed's Browser Saw",
        blurb:
          "Day three. The IR-lead credential from level1 unlocks " +
          "Polaris IR's forensic bench, where Reed's seized Chromium " +
          "History + Cookies databases sit ready to query. SQL formation " +
          "via the new sqlite3 command surfaces a 02:47 pre-dawn webmail " +
          "visit, pre-meditation searches around CUI handling rules, and " +
          "a live Google SID cookie value that gates level3. NIST SP " +
          "800-86 + CMMC Level 2 AU.L2-3.3.x audit-record discipline.",
      },
    },
  },
  osint: {
    title: "OSINT",
    blurb:
      "Open-source breach corpus and identity reconnaissance. Client: " +
      "Veridian Analytics — HIPAA / HITRUST CSF.",
    levels: {
      level0: {
        title: "Veridian's Open Letter",
        blurb:
          "Executive-protection OSINT for a newly-hired CMO at a HIPAA " +
          "Business Associate. HIBP surfaces the same cleartext password " +
          "in two breaches — the high-confidence credential-reuse signal.",
      },
      level1: {
        title: "Aaron's Weekend Project",
        blurb:
          "Day two. After Friday's HIBP finding, Marisol expands scope to " +
          "Aaron's developer footprint. His public GitHub has a clinical-" +
          "era personal project with a committed `.env` at HEAD carrying " +
          "live AWS access keys, an OpenFDA personal API key, and a Flask " +
          "secret — the .gitignore was added later (and lists `.env`) but " +
          "doesn't retroactively untrack the file. CWE-798 + CWE-540, with " +
          "the universal source-control credential-leak mechanic on display.",
      },
      level2: {
        title: "The Internet Never Forgets",
        blurb:
          "Day three. Aaron deleted the leaky repo and called it fixed — " +
          "so the `wayback` Machine becomes the proof that deletion isn't " +
          "remediation: the 2023-24 captures still serve the repo while the " +
          "live URL 404s, and the AWS key was never rotated. An archive " +
          "sweep of Aaron's scrubbed 2009 personal site recovers a " +
          "pseudonymous handle, `sherlock` maps his 'other life,' and a " +
          "homelab blog post pastes a cleartext Nextcloud admin password " +
          "that gates level3. Internet Archive permanence, alias " +
          "attribution, robots.txt as a map (WSTG-INFO-03), CWE-312.",
      },
    },
  },
  cloud: {
    title: "Cloud",
    blurb:
      "AWS S3, IAM, EC2 auditing + RDS-adjacent psql enumeration. " +
      "Client: Coverline Insurance — SOC 2 / NAIC / NYDFS / GLBA.",
    levels: {
      level0: {
        title: "Coverline's Twelfth Bucket",
        blurb:
          "Mid-SOC-2-audit gap-fill at an insurtech carrier. A six-bucket " +
          "worksheet walks cleanly until one — claims-uploads-prod — " +
          "lists publicly with PII + a hardcoded RDS password.",
      },
      level1: {
        title: "The Migration Table Nobody Dropped",
        blurb:
          "Day three. With Friday's leaked RDS master credential, " +
          "Driftwood enumerates the coverline_claims production DB to " +
          "inform Sloane's breach-notification math. A `migration_artifacts` " +
          "table from the 2024 region cutover has explicit TTL columns " +
          "intending Q2 2024 deletion that never happened — the " +
          "broker-portal service credential is the level2 breadcrumb. The " +
          "audit log also has a single anomalous schema-enumeration query " +
          "from 2026-05-20 02:14 UTC with no captured source IP " +
          "(`pgaudit` was never enabled). CWE-798 + CWE-540 + the " +
          "credentials-in-DB-rows anti-pattern.",
      },
      level2: {
        title: "The Key Nobody Turned Off",
        blurb:
          "Day three. The recovered broker-portal-svc credential turns out " +
          "to be an over-permissioned IAM user, so Driftwood runs a " +
          "least-privilege pass across Coverline's account. Among 16 " +
          "principals, a 2024-migration `legacy-deploy-bot` still carries " +
          "AdministratorAccess and a still-Active access key last used in " +
          "2024 — a dormant god-mode credential nobody turned off. Its " +
          "secret, left in a leftover bootstrap-creds file on the bastion, " +
          "is the level3 breadcrumb. Three bonus finds: an orphaned " +
          "terminated-employee account, a never-rotated 2019 key, and a " +
          "root access key. CWE-269 / CWE-250 + CIS AWS 1.4/1.12/1.16 + " +
          "MITRE T1078.004.",
      },
    },
  },
};

// ─── Routing ─────────────────────────────────────────────────

function parseRoute() {
  // Hash routing. `#/linux/level0` → { track: "linux", level: "level0" }.
  // Empty hash → index.
  let hash = location.hash || "";
  if (hash.startsWith("#")) hash = hash.slice(1);
  hash = hash.replace(/^\/+|\/+$/g, "");

  if (!hash) return { kind: "index" };

  const parts = hash.split("/");
  if (parts.length === 1) return { kind: "track", track: parts[0] };
  if (parts.length === 2) return { kind: "level", track: parts[0], level: parts[1] };
  return { kind: "unknown" };
}

// ─── Breadcrumbs ─────────────────────────────────────────────

function setCrumbs(items) {
  const crumbs = document.getElementById("crumbs");
  if (!crumbs) return;
  crumbs.innerHTML = "";
  items.forEach((item, i) => {
    if (i > 0) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "/";
      crumbs.appendChild(sep);
    }
    if (item.href) {
      const a = document.createElement("a");
      a.href = item.href;
      a.textContent = item.text;
      crumbs.appendChild(a);
    } else {
      const span = document.createElement("span");
      span.className = "current";
      span.textContent = item.text;
      crumbs.appendChild(span);
    }
  });
}

// ─── Renderers ───────────────────────────────────────────────

function renderIndex() {
  setCrumbs([{ text: "index" }]);
  document.title = "D3CYPH3R Walkthroughs";

  const article = document.getElementById("article");
  const lines = [];
  // Title uses the cascade brand to match the header. "Walkthroughs"
  // continues in normal h1 styling alongside the wordmark.
  lines.push(
    '<h1 class="index-title">' +
      '<span class="brand-cascade">' +
        '<span class="glyph-bracket">[</span>' +
        '<span class="glyph-vt323 glyph-bright">D</span>' +
        '<span class="glyph-vt323 glyph-mid">3</span>' +
        '<span class="glyph-vt323 glyph-mid">C</span>' +
        '<span class="glyph-vt323 glyph-bright">Y</span>' +
        '<span class="glyph-vt323 glyph-dim">P</span>' +
        '<span class="glyph-vt323 glyph-mid">H</span>' +
        '<span class="glyph-vt323 glyph-dim">3</span>' +
        '<span class="glyph-vt323 glyph-bright">R</span>' +
        '<span class="glyph-bracket">]</span>' +
      '</span>' +
      '<span class="index-title-sub">walkthroughs</span>' +
    '</h1>'
  );
  lines.push(
    "<p>Per-level deep dives — full solve paths plus extended " +
    "post-mortems tying each level back to the certifications, " +
    "frameworks, real-world incidents, and defender tooling " +
    "covered in the in-game lessons-learned files.</p>"
  );
  lines.push(
    '<p><em>These pages are spoiler-tolerant by design. Solve the ' +
    "level first; come back here for the study session.</em></p>"
  );
  lines.push("<h2>Tracks</h2>");
  lines.push('<ul class="track-list">');
  Object.entries(MANIFEST).forEach(([key, track]) => {
    const count = Object.keys(track.levels).length;
    const status = count === 0
      ? '<span style="color:var(--dim);font-size:0.85em;">(no walkthroughs yet)</span>'
      : `<span style="color:var(--green);font-size:0.85em;">${count} walkthrough${count === 1 ? "" : "s"}</span>`;
    if (count === 0) {
      lines.push(
        `<li><span style="color:var(--dim);">${track.title}</span> ${status}` +
        `<div class="desc">${track.blurb}</div></li>`
      );
    } else {
      lines.push(
        `<li><a href="/walkthroughs/#/${key}">${track.title}</a> ${status}` +
        `<div class="desc">${track.blurb}</div></li>`
      );
    }
  });
  lines.push("</ul>");
  article.innerHTML = lines.join("\n");
}

function renderTrack(trackKey) {
  const track = MANIFEST[trackKey];
  if (!track) return renderNotFound();
  setCrumbs([
    { text: "index", href: "/walkthroughs/" },
    { text: track.title.toLowerCase() },
  ]);
  document.title = `${track.title} — D3CYPH3R Walkthroughs`;

  const article = document.getElementById("article");
  const lines = [];
  lines.push(`<h1>${track.title} track</h1>`);
  lines.push(`<p>${track.blurb}</p>`);

  const levelKeys = Object.keys(track.levels);
  if (levelKeys.length === 0) {
    lines.push(
      '<p><em>No walkthroughs published yet for this track. ' +
      "Check back later.</em></p>"
    );
  } else {
    lines.push("<h2>Walkthroughs</h2>");
    lines.push('<ul class="level-list">');
    levelKeys.forEach((levelKey) => {
      const lvl = track.levels[levelKey];
      lines.push(
        `<li><a href="/walkthroughs/#/${trackKey}/${levelKey}">` +
        `${levelKey}@${trackKey} — ${lvl.title}</a>` +
        `<div class="desc">${lvl.blurb}</div></li>`
      );
    });
    lines.push("</ul>");
  }
  article.innerHTML = lines.join("\n");
}

async function renderLevel(trackKey, levelKey) {
  const track = MANIFEST[trackKey];
  if (!track || !track.levels[levelKey]) return renderNotFound();

  const lvl = track.levels[levelKey];
  setCrumbs([
    { text: "index", href: "/walkthroughs/" },
    { text: track.title.toLowerCase(), href: `/walkthroughs/#/${trackKey}` },
    { text: levelKey },
  ]);
  document.title = `${levelKey}@${trackKey} — ${lvl.title} — D3CYPH3R Walkthroughs`;

  const article = document.getElementById("article");
  try {
    const res = await fetch(`/walkthroughs/${trackKey}/${levelKey}.md`, {
      cache: "no-cache",
    });
    if (!res.ok) return renderNotFound();
    const md = await res.text();
    const html = marked.parse(md);
    article.innerHTML = html;
    // Tag the leading "⚠"-prefixed blockquote as the spoiler callout.
    const firstBlockquote = article.querySelector("blockquote");
    if (firstBlockquote && firstBlockquote.textContent.trim().startsWith("⚠")) {
      firstBlockquote.classList.add("spoiler-warning");
    }
    // External links open in a new tab.
    article.querySelectorAll('a[href^="http"]').forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  } catch (err) {
    article.innerHTML =
      `<h1>Couldn't load walkthrough</h1>` +
      `<p class="error">${(err && err.message) || "Network error"}</p>` +
      `<p><a href="/walkthroughs/">Back to index</a></p>`;
  }
}

function renderNotFound() {
  setCrumbs([{ text: "index", href: "/walkthroughs/" }, { text: "not found" }]);
  document.title = "Not found — D3CYPH3R Walkthroughs";
  const article = document.getElementById("article");
  article.innerHTML =
    "<h1>Not found</h1>" +
    "<p>No walkthrough exists at this URL. Try the " +
    '<a href="/walkthroughs/">index</a>.</p>';
}

// ─── Boot ────────────────────────────────────────────────────

function route() {
  const r = parseRoute();
  // Scroll to top on every navigation so a long previous page doesn't
  // leave the next one mid-scrolled.
  window.scrollTo(0, 0);
  if (r.kind === "index")       renderIndex();
  else if (r.kind === "track")  renderTrack(r.track);
  else if (r.kind === "level")  renderLevel(r.track, r.level);
  else                          renderNotFound();
}

window.addEventListener("hashchange", route);
route();

// ─── Theme bootstrap ──────────────────────────────────────────
//
// v1.13.0: imports the same THEMES registry + setTheme/cycleTheme
// helpers used by the main app's terminal (../js/terminal/theme.js)
// so the walkthroughs subsite picks up every theme without
// duplicating the registry. localStorage key is shared (d3cyph3r-
// theme), so toggling on either subsite applies to both.
//
// initTheme() reads the saved theme name (defaulting to "dark"),
// applies it via the body data-theme + data-theme-mode attributes
// CSS uses. The topbar moon/sun button on this page cycles
// through the same 11-theme list as the main app's button.

(function initThemeWalkthroughs() {
  initTheme();

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  const refreshTitle = () => {
    const t = getTheme();
    btn.title = `Theme: ${t.name} — click to cycle (or set via 'theme <name>' in the main terminal)`;
  };
  refreshTitle();
  btn.addEventListener("click", () => { cycleTheme(); refreshTitle(); });
})();
