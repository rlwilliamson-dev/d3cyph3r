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
    },
  },
  network: {
    title: "Network",
    blurb:
      "Port scanning and perimeter audit. Client: Atlas Health — HIPAA.",
    levels: {},
  },
  crypto: {
    title: "Crypto",
    blurb:
      "Encoding ≠ encryption. Client: Vesta Retail — PCI-DSS.",
    levels: {},
  },
  web: {
    title: "Web",
    blurb:
      "HTTP directory enumeration. Client: Meridian State University — FERPA.",
    levels: {},
  },
  forensics: {
    title: "Forensics",
    blurb:
      "EXIF metadata and insider-threat analysis. Client: Polaris Defense " +
      "Systems — CMMC / NIST 800-171.",
    levels: {},
  },
  osint: {
    title: "OSINT",
    blurb:
      "Open-source breach corpus and identity reconnaissance. Client: " +
      "Veridian Analytics — HIPAA / HITRUST CSF.",
    levels: {},
  },
  cloud: {
    title: "Cloud",
    blurb:
      "AWS S3, IAM, EC2 auditing. Client: Coverline Insurance — SOC 2 / " +
      "NAIC / NYDFS / GLBA.",
    levels: {},
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
