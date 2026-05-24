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
  lines.push("<h1>D3CYPH3R Walkthroughs</h1>");
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

// ─── Theme toggle ─────────────────────────────────────────────
//
// Inline theme bootstrap (rather than importing the main app's
// js/terminal/theme.js) keeps the walkthroughs subsite a fully
// self-contained ES-module bundle. Same localStorage key as the
// main app so the choice carries across the lobby ↔ walkthroughs
// boundary.

const THEME_KEY = "d3cyph3r-theme";

(function initThemeWalkthroughs() {
  try {
    if (localStorage.getItem(THEME_KEY) === "light") {
      document.body.classList.add("light");
    }
  } catch (_) { /* localStorage unavailable — default to dark */ }

  const btn = document.getElementById("theme-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light");
    try {
      localStorage.setItem(THEME_KEY, isLight ? "light" : "dark");
    } catch (_) { /* persistence failure non-fatal */ }
  });
})();
