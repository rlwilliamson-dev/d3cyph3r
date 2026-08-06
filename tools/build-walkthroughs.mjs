// D3CYPH3R — static walkthrough site generator.
//
// PURPOSE
// -------
// Renders the 24 markdown walkthroughs into real, crawlable HTML pages
// at real URLs, replacing the former hash-routed single-page reader.
//
//   walkthroughs/<track>/<level>.md   ->  walkthroughs/<track>/<level>.html
//
// Links use the explicit .html suffix so the site works identically on
// Azure SWA and on a bare `python3 -m http.server`. See levelUrl().
//
// It also emits the track index pages, the root index, sitemap.xml,
// llms.txt, and the client-side search index.
//
// WHY STATIC RATHER THAN A CLIENT-SIDE ROUTER
// -------------------------------------------
// The previous reader was a single HTML shell that read location.hash,
// fetched the markdown, and injected it with innerHTML. That shape had
// four structural costs, all of which disappear here:
//
//   1. SEO. Everything after "#" is never sent to the server, so every
//      walkthrough shared one URL and one empty 6KB shell. robots.txt
//      declared the subsite "intentionally discoverable"; it could not
//      be. 24 real URLs fixes that, and sitemap.xml now lists them.
//   2. Deep links. The router owned the fragment, so "#frameworks"
//      could not coexist with "#/linux/level3". Real pages free the
//      fragment for its actual purpose: anchors.
//   3. Accessibility. innerHTML-swapping a 7,000-word article inside an
//      aria-live region made screen readers announce the whole document
//      on every navigation. Real page loads have no live region at all.
//   4. First paint. No fetch-then-parse-then-inject waterfall.
//
// ZERO DEPENDENCIES
// -----------------
// This script imports only Node builtins plus the marked bundle already
// vendored at walkthroughs/vendor/marked.esm.min.js, the exact same
// renderer the browser used before, so output matches what readers saw.
// There is no tools/package.json and nothing to npm install. Run it with:
//
//     node tools/build-walkthroughs.mjs
//
// WHEN TO RUN IT
// --------------
// After editing any walkthrough markdown, the MANIFEST, or the page
// template below. Generated .html files are COMMITTED alongside their
// .md sources; CI re-runs this and fails if the result differs, so a
// markdown edit without a regenerate cannot reach main.
//
// SAFETY POSTURE
// --------------
// The renderer keeps the link/image scheme allowlist and raw-HTML strip
// from the previous client-side reader. At build time the threat model
// is weaker (input is author-controlled, reviewed markdown), but keeping
// the overrides means generated output is identical to what the audited
// client renderer produced, and a future contributor cannot smuggle raw
// HTML or a javascript: URL into a page through a walkthrough PR.

import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Marked } from "../walkthroughs/vendor/marked.esm.min.js";
import { MANIFEST } from "../walkthroughs/manifest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(ROOT, "walkthroughs");
const SITE = "https://www.d3cyph3r.com";

/**
 * Build the public URL for one walkthrough.
 *
 * The ".html" suffix is DELIBERATE and load-bearing for portability.
 * Azure SWA happily serves "/walkthroughs/linux/level3" extensionless
 * (verified against production), but Python's http.server does not, and
 * neither do most plain static file servers. Since the project's stated
 * design value is that a clone runs under `python3 -m http.server` with
 * no toolchain, extensionless links would 404 for every forker and for
 * the local playtest while working fine in production. That is exactly
 * the kind of environment-dependent breakage worth spending four
 * characters to avoid.
 *
 * Anyone who types the extensionless form still lands on the right page
 * via SWA; the canonical tag points here, so search engines index one.
 */
function levelUrl(trackKey, levelKey) {
  return `/walkthroughs/${trackKey}/${levelKey}.html`;
}

/** Track index URL. Directory indexes work on every static server. */
function trackUrl(trackKey) {
  return `/walkthroughs/${trackKey}/`;
}

// Average adult reading speed for technical prose. Deliberately
// conservative: these documents are dense with citations and code, and
// over-promising a short read is worse than under-promising.
const WORDS_PER_MINUTE = 200;

// ─── Canonical section slugs ──────────────────────────────────────
//
// Every one of the 24 walkthroughs carries the identical 10 H2 headings
// (verified: each string appears exactly 24 times across the corpus).
// That total consistency means section anchors can be CURATED rather
// than auto-slugged, which buys three things:
//
//   - Readable, guessable URLs (#frameworks, not #5--frameworks-deep-dive)
//   - Stability: retitling "§5 — Frameworks, deep dive" in the markdown
//     does not break every published link to it.
//   - Cross-document consistency: #frameworks means the same section on
//     all 24 pages, so a reader can compare them by editing the path.
//
// A heading not in this map falls through to the auto-slugger below.
// If a future walkthrough adds a new standard section, add it here.
const SECTION_SLUGS = {
  "§1 — The setup":              "setup",
  "§2 — The solve":              "solve",
  "§3 — The vulnerability":      "vulnerability",
  "§3.5 — Blast radius":         "blast-radius",
  "§4 — Real-world parallels":   "real-world-parallels",
  "§5 — Frameworks, deep dive":  "frameworks",
  "§6 — Cert exam relevance":    "certifications",
  "§7 — What a defender does":   "defender",
  "§7.5 — Optional exploration": "optional-exploration",
  "§8 — Key takeaways":          "takeaways",
  "§9 — Further reading":        "further-reading",
};

// The required section skeleton, in required order.
//
// Derived from the authoring template in walkthroughs/README.md. Every
// walkthrough must carry all ten, exactly once, in this order. The
// generator ENFORCES this rather than assuming it (see validate()):
// the whole reader depends on the structure being uniform, so a
// walkthrough that silently omits a section would produce a page with
// a gap in its TOC and a hole in the search index.
//
// Object key order is insertion order for string keys, so this is the
// same list as SECTION_SLUGS above, read in sequence.
const REQUIRED_SECTIONS = Object.keys(SECTION_SLUGS);

// Short labels for the TOC rail. The full heading text ("§5 —
// Frameworks, deep dive") is too long for a 240px rail, and the "§N"
// prefix is rendered separately as a dim ordinal.
const SECTION_LABELS = {
  setup:                 "The setup",
  solve:                 "The solve",
  vulnerability:         "The vulnerability",
  "blast-radius":        "Blast radius",
  "real-world-parallels":"Real-world parallels",
  frameworks:            "Frameworks",
  certifications:        "Cert exam relevance",
  defender:              "What a defender does",
  "optional-exploration":"Optional exploration",
  takeaways:             "Key takeaways",
  "further-reading":     "Further reading",
};

// ─── Small helpers ────────────────────────────────────────────────

/** Escape a string for use in HTML text or a double-quoted attribute. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Flatten inline markdown and stray tags down to plain text.
 *
 * NOT A SANITIZER, and nothing downstream treats it as one. Output goes
 * to <title>, meta description, listing blurbs, and search-index bodies,
 * every one of which is escaped with esc() at the point of use or
 * assigned through textContent. Escaping at the sink is the actual
 * control; this function exists so that markup does not show up as
 * literal noise in places that render text verbatim.
 *
 * The tag strip still loops to a fixed point rather than running once.
 * A single pass is the classic incomplete-sanitization bug: given
 * "<<script>script>", removing the inner tag leaves a working
 * "<script>" behind. That is not reachable through any current caller,
 * but a one-pass strip that looks like a sanitizer is the kind of thing
 * this project spends 24 levels teaching people to catch, so it does
 * not get to ship here. The loop terminates because each iteration
 * either removes characters or changes nothing.
 */
function plain(s) {
  let out = String(s);
  let prev;
  do {
    prev = out;
    out = out.replace(/<[^>]*>/g, "");
  } while (out !== prev);

  return out
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Flatten a block of markdown into readable plain prose.
 *
 * plain() only strips INLINE syntax, which is all that titles and meta
 * descriptions ever contain. Search-index bodies are whole sections, so
 * they also carry block-level markers, and those leak into result
 * snippets as literal noise ("### NIST SP 800-53 Rev. 5 — Audit and
 * Accountability (AU) family The federal-control catalog...").
 *
 * Fenced code is dropped rather than flattened: command transcripts and
 * config dumps make terrible search snippets, and a reader looking for
 * a concept wants the prose around the code, not the code itself. The
 * words inside a fence are still reachable through the prose that
 * introduces it.
 */
function plainBody(md) {
  return plain(
    String(md)
      .replace(/```[\s\S]*?```/g, " ")   // fenced code blocks
      .replace(/^\s{0,3}#{1,6}\s+/gm, "") // ATX heading markers
      .replace(/^\s{0,3}>\s?/gm, "")      // blockquote markers
      .replace(/^\s{0,3}[-*+]\s+/gm, "")  // bullet markers
      .replace(/^\s{0,3}\|.*\|\s*$/gm, " ") // table rows
      .replace(/^\s{0,3}[-=]{3,}\s*$/gm, " ") // setext rules / dividers
  );
}

/**
 * Fallback slugger for H3s, whose text varies per walkthrough (6 to 40
 * of them per file). Lowercases, strips anything that is not a word
 * character or space, collapses runs to single hyphens.
 *
 * The `used` set makes slugs unique within a page: several walkthroughs
 * repeat an H3 title across sections (e.g. "CISSP" under both §5 and
 * §6), and duplicate ids would make the earlier one unreachable.
 */
function slugify(text, used) {
  let base = plain(text)
    .toLowerCase()
    .replace(/§/g, "s")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) base = "section";
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

/**
 * Check one walkthrough against the authoring template.
 *
 * Returns an array of human-readable problems; empty means conforming.
 * Enforced at build time rather than left to review, because the reader
 * treats the section skeleton as a contract:
 *
 *   - the TOC rail renders the ten canonical sections
 *   - anchors like #frameworks are promised to mean the same thing on
 *     every page, so a reader can compare levels by editing the URL
 *   - the search index stores one entry per section and silently drops
 *     headings it does not recognise
 *
 * A walkthrough missing §7.5 would therefore ship with a gap in its
 * rail and a hole in search, with nothing failing loudly. Now it fails
 * the build, and since CI runs the generator, it cannot reach main.
 *
 * Checks structure only, never prose. Length, tone, and citation
 * quality stay editorial judgement (see walkthroughs/README.md).
 */
function validate(md, label, shipped) {
  const problems = [];

  // Heading text in document order, H2 only.
  const found = [...md.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);

  for (const want of REQUIRED_SECTIONS) {
    const n = found.filter((h) => h === want).length;
    if (n === 0) problems.push(`missing section: "## ${want}"`);
    else if (n > 1) problems.push(`section appears ${n} times: "## ${want}"`);
  }

  // Unknown H2s are an error too: a section outside the template gets
  // an auto-slugged anchor and no TOC entry, so it would be invisible
  // in the rail while occupying a chunk of the page.
  for (const h of found) {
    if (!REQUIRED_SECTIONS.includes(h)) {
      problems.push(
        `unexpected section: "## ${h}" ` +
          `(not in the template; add it to SECTION_SLUGS if intended)`
      );
    }
  }

  // Order matters: the rail lists sections in document order, so an
  // out-of-sequence file would present §7 before §5 with no warning.
  const inTemplate = found.filter((h) => REQUIRED_SECTIONS.includes(h));
  const expected = REQUIRED_SECTIONS.filter((h) => found.includes(h));
  if (inTemplate.join("|") !== expected.join("|")) {
    problems.push(
      `sections are out of order.\n` +
        `      found:    ${inTemplate.join(" -> ")}\n` +
        `      expected: ${expected.join(" -> ")}`
    );
  }

  // The spoiler callout is the one piece of chrome a reader may hit
  // before they have solved the level. Its absence is a content bug
  // with real consequences, so it is checked as well.
  const firstBq = md.match(/^>\s*(.+)$/m);
  if (!firstBq || !firstBq[1].trimStart().startsWith("⚠")) {
    problems.push(
      `missing spoiler warning (a blockquote whose first character is "⚠", above §1)`
    );
  }

  // §7 must carry a usable detection rule.
  //
  // Checked by required FIELDS rather than by heading text, because the
  // rules predating v2.5.1 introduce themselves as a bold numbered item
  // and the newer ones as an h3. The heading style is cosmetic; what
  // makes a rule usable is not.
  //
  // `falsepositives` is enforced deliberately. A rule shipped without one
  // gets disabled the first week it fires, so omitting it produces
  // something that looks like a deliverable and functions as noise.
  const RULE_FIELDS = [
    "title:",
    "logsource:",
    "detection:",
    "condition:",
    "falsepositives:",
    "level:",
  ];
  const missingRuleFields = RULE_FIELDS.filter((f) => !md.includes(f));
  if (missingRuleFields.length) {
    problems.push(
      `detection rule incomplete or absent (§7) — missing: ` +
        missingRuleFields.map((f) => f.replace(":", "")).join(", ")
    );
  }

  // Stale forward references.
  //
  // A walkthrough written before the next level existed describes it as
  // "a future level3@linux" or says it "hasn't been built yet". When that
  // level ships, nothing goes back to correct the prose, so the corpus
  // accumulates statements that were true once and are now flatly wrong.
  // A reader following linux/level1 was told level2 was unbuilt for two
  // releases after it became playable.
  //
  // The generator already knows which levels exist, so it can simply
  // check. Anything claiming a shipped level is unbuilt fails the build,
  // which means shipping a new level forces the correction rather than
  // relying on someone remembering.
  const futureRefs = [...md.matchAll(/a future `(level\d+@[a-z]+)`/g)];
  for (const m of futureRefs) {
    if (shipped.has(m[1])) {
      problems.push(
        `calls \`${m[1]}\` "a future" level, but it has shipped ` +
          `(drop "a future" and check the surrounding prose)`
      );
    }
  }

  // The prose forms, which are worse than the spoiler line because they
  // tell a reader the level is unreachable.
  const UNBUILT_CLAIMS = [
    /(`?level\d+@[a-z]+`?)[^.\n]{0,60}(hasn't been built|isn't built|has not been built|is not built)/i,
    /(hasn't been built|isn't built)[^.\n]{0,60}(`?level\d+@[a-z]+`?)/i,
    /no level\d+ is currently solvable/i,
    /the level content is forthcoming/i,
  ];
  for (const re of UNBUILT_CLAIMS) {
    const m = md.match(re);
    if (m) {
      const named = (m[0].match(/level\d+@[a-z]+/) || [])[0];
      if (!named || shipped.has(named)) {
        problems.push(
          `claims a level is unbuilt: "${m[0].trim().slice(0, 70)}..." ` +
            `(verify against the shipped set and rewrite)`
        );
      }
    }
  }

  return problems.map((p) => `  ${label}: ${p}`);
}

/** Human-readable estimated reading time from a raw word count. */
function readingTime(words) {
  const mins = Math.max(1, Math.round(words / WORDS_PER_MINUTE));
  return `${mins} min read`;
}

// ─── Markdown rendering ───────────────────────────────────────────

// Scheme allowlist, carried over verbatim from the client reader.
const SAFE_URL = /^(?:https?:|mailto:|tel:|#|\/|\.\.?\/)/i;

/**
 * Render one walkthrough's markdown.
 *
 * Returns { html, toc, words } where `toc` is a nested array of
 * { id, label, ordinal, children[] } describing the page's H2/H3
 * structure. The TOC is collected DURING rendering rather than by a
 * second parse so the ids in the markup and the ids in the rail are
 * guaranteed to agree.
 */
function renderMarkdown(md) {
  const toc = [];
  const used = new Set();
  // Only the first blockquote is eligible for the spoiler treatment.
  let seenBlockquote = false;

  const renderer = {
    // Assign an id to every heading and record H2/H3 in the TOC.
    heading(text, level, raw) {
      const clean = plain(raw);
      let id;
      let ordinal = "";

      if (level === 2 && SECTION_SLUGS[clean]) {
        id = SECTION_SLUGS[clean];
        used.add(id);
        // Split "§5 — Frameworks, deep dive" into ordinal + label so the
        // rail can dim the "§5" and the heading can keep its full text.
        const m = clean.match(/^(§[\d.]+)/);
        ordinal = m ? m[1] : "";
        toc.push({
          id,
          ordinal,
          label: SECTION_LABELS[id] || clean.replace(/^§[\d.]+\s*—\s*/, ""),
          children: [],
        });
      } else {
        id = slugify(raw, used);
        if (level === 3 && toc.length) {
          toc[toc.length - 1].children.push({ id, label: clean });
        }
      }

      // The anchor link sits INSIDE the heading so it inherits the
      // heading's baseline, and is hidden until the heading is hovered
      // or the link itself is focused (CSS handles both states).
      return (
        `<h${level} id="${esc(id)}">${text}` +
        `<a class="anchor" href="#${esc(id)}" aria-label="Link to this section">#</a>` +
        `</h${level}>\n`
      );
    },
    /**
     * Tag the leading warning blockquote as the spoiler callout.
     *
     * Authors write a plain blockquote whose first character is "⚠";
     * the CSS then renders it as the red, bordered, impossible-to-miss
     * callout rather than a normal muted quote. The previous client
     * reader did this with a post-render DOM query; doing it at build
     * time means the class is present in the served HTML, so the
     * callout is styled correctly even before (or without) JavaScript.
     *
     * Scoped to the FIRST blockquote only. Several walkthroughs use
     * ordinary blockquotes later on (the §9 "Last reviewed" footer is
     * one), and those must keep the muted treatment.
     */
    blockquote(quote) {
      if (!seenBlockquote) {
        seenBlockquote = true;
        if (plain(quote).trimStart().startsWith("⚠")) {
          return `<blockquote class="spoiler-warning">\n${quote}</blockquote>\n`;
        }
      }
      return `<blockquote>\n${quote}</blockquote>\n`;
    },
    // Drop raw HTML tokens entirely.
    html: () => "",
    link(href, title, text) {
      if (!SAFE_URL.test(href || "")) return text || "";
      const t = title ? ` title="${esc(title)}"` : "";
      // External links open in a new tab. The client reader did this
      // with a post-render DOM sweep; doing it at build time means the
      // attribute is present in the served HTML.
      const ext = /^https?:/i.test(href)
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${esc(href)}"${t}${ext}>${text}</a>`;
    },
    image(href, title, text) {
      if (!SAFE_URL.test(href || "")) return text || "";
      const t = title ? ` title="${esc(title)}"` : "";
      const a = text ? ` alt="${esc(text)}"` : "";
      return `<img src="${esc(href)}"${a}${t}>`;
    },
  };

  // A fresh Marked instance per file. Reusing a global one would let
  // the `used` slug set and `toc` array leak across walkthroughs, since
  // the renderer closes over both.
  const inst = new Marked();
  inst.use({ renderer });

  const html = inst.parse(md);
  const words = md.split(/\s+/).filter(Boolean).length;
  return { html, toc, words };
}

// ─── Page template ────────────────────────────────────────────────

/**
 * The shared page chrome.
 *
 * NOTE ON CSP: the site sends `script-src 'self'` with no
 * 'unsafe-inline', so this template must never emit an inline <script>.
 * All behaviour ships as external modules (reader.js, search.js).
 * Inline <style> is likewise avoided; walkthrough.css carries it all.
 */
function page({ title, description, canonical, crumbs, body, bodyClass = "", scripts = [] }) {
  const crumbHtml = crumbs
    .map((c, i) => {
      const sep = i > 0 ? '<span class="sep" aria-hidden="true">/</span>' : "";
      return c.href
        ? `${sep}<a href="${esc(c.href)}">${esc(c.text)}</a>`
        : `${sep}<span class="current">${esc(c.text)}</span>`;
    })
    .join("");

  const scriptTags = scripts
    .map((s) => `  <script type="module" src="${esc(s)}"></script>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="D3CYPH3R">
  <meta name="twitter:card" content="summary">
  <meta name="theme-color" content="#0d1117">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="stylesheet" href="/walkthroughs/walkthrough.css?v=${CSS_VERSION}">
</head>
<body${bodyClass ? ` class="${esc(bodyClass)}"` : ""}>

  <a class="skip-link" href="#main">Skip to content</a>

  <header id="site-header">
    <div class="brand">
      <a href="/" class="brand-mark-link" aria-label="Back to d3cyph3r.com">
        <span class="brand-mark">${BRAND_GLYPHS}</span>
      </a>
      <a href="/walkthroughs/" class="brand-sub-link">
        <span class="brand-sub">walkthroughs</span>
      </a>
    </div>
    <nav id="crumbs" aria-label="Breadcrumb">${crumbHtml}</nav>
    <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle light / dark theme" title="Toggle light / dark">
      <svg class="theme-icon theme-icon-moon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
        <path d="M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.78.78 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.78.78 0 0 1 6 .278"/>
      </svg>
      <svg class="theme-icon theme-icon-sun" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
        <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708"/>
      </svg>
    </button>
  </header>

${body}

  <footer id="site-footer">
    <p class="footer-disclaimer">
      For educational use. Don't run these techniques against systems
      you don't own or aren't authorized to test.
    </p>
    <p class="footer-links">
      <a href="/" class="footer-link">&larr; Back to d3cyph3r.com</a>
      <span class="footer-sep" aria-hidden="true">&middot;</span>
      <a href="https://github.com/rlwilliamson-dev/d3cyph3r" target="_blank" rel="noopener noreferrer" class="footer-link" aria-label="View source on GitHub">
        <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82a7.62 7.62 0 0 0-2-.27c-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/>
        </svg>
        <span>Source on GitHub</span>
      </a>
      <span class="footer-sep" aria-hidden="true">&middot;</span>
      <a href="https://azure.microsoft.com/" target="_blank" rel="noopener noreferrer" class="footer-link" aria-label="Hosted on Microsoft Azure">
        <svg width="13" height="13" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M10.61 2L4.05 14.4l5.6.04 1.5-2.92 4.9 2.88L10.61 2z" fill="#0078D4"/>
        </svg>
        <span>Hosted on Microsoft Azure</span>
      </a>
    </p>
  </footer>

${scriptTags}
</body>
</html>
`;
}

// The [D3CYPH3R] wordmark, brightness-cascaded to match the main app's
// lobby logo. Kept as one constant so the 32 generated pages cannot
// drift from each other.
const BRAND_GLYPHS =
  '<span class="glyph-bracket">[</span>' +
  '<span class="glyph-vt323 glyph-bright">D</span>' +
  '<span class="glyph-vt323 glyph-mid">3</span>' +
  '<span class="glyph-vt323 glyph-mid">C</span>' +
  '<span class="glyph-vt323 glyph-bright">Y</span>' +
  '<span class="glyph-vt323 glyph-dim">P</span>' +
  '<span class="glyph-vt323 glyph-mid">H</span>' +
  '<span class="glyph-vt323 glyph-dim">3</span>' +
  '<span class="glyph-vt323 glyph-bright">R</span>' +
  '<span class="glyph-bracket">]</span>';

// Bumped in lockstep with js/engine/version.js so a release busts the
// stylesheet cache for returning readers (release checklist step 2b).
const CSS_VERSION = "2.5.0";

// ─── TOC rail ─────────────────────────────────────────────────────

/**
 * Render the sticky "On this page" rail.
 *
 * H2s are always listed. H3s are nested but hidden by default and
 * revealed only for the section the reader is currently in: the
 * progressive-disclosure pattern. Without it the rail would be
 * unusable on the densest walkthroughs (cloud/level1 has 40 H3s).
 *
 * The <nav> is duplicated in mobile layout as a <details> above the
 * article; CSS decides which one is visible, so there is exactly one
 * source of truth in the markup.
 */
function tocRail(toc) {
  const items = toc
    .map((sec) => {
      const kids = sec.children.length
        ? `<ul class="toc-sub">` +
          sec.children
            .map(
              (c) =>
                `<li><a href="#${esc(c.id)}">${esc(c.label)}</a></li>`
            )
            .join("") +
          `</ul>`
        : "";
      return (
        `<li data-section="${esc(sec.id)}">` +
        `<a href="#${esc(sec.id)}">` +
        (sec.ordinal ? `<span class="toc-ord">${esc(sec.ordinal)}</span>` : "") +
        `<span class="toc-label">${esc(sec.label)}</span></a>` +
        kids +
        `</li>`
      );
    })
    .join("");

  return (
    `<nav class="toc" id="toc" aria-label="On this page">` +
    `<p class="toc-title">On this page</p>` +
    `<ul class="toc-list">${items}</ul>` +
    `<a class="toc-top" href="#main">Back to top</a>` +
    `</nav>`
  );
}

// ─── Page builders ────────────────────────────────────────────────

/** Ordered [track, level] pairs in play order, for prev/next. */
function levelSequence() {
  const seq = [];
  for (const [trackKey, track] of Object.entries(MANIFEST)) {
    for (const levelKey of Object.keys(track.levels)) {
      seq.push({ trackKey, levelKey });
    }
  }
  return seq;
}

/**
 * Prev/next within a track only.
 *
 * Deliberately does NOT wrap across tracks: the per-track credential
 * chain means level3@linux does not lead to level0@network in any
 * narrative sense, and pretending otherwise would mislead. At a track
 * boundary the pager points at the track index instead.
 */
function pagerFor(trackKey, levelKey) {
  const track = MANIFEST[trackKey];
  const keys = Object.keys(track.levels);
  const i = keys.indexOf(levelKey);

  const prev =
    i > 0
      ? {
          href: levelUrl(trackKey, keys[i - 1]),
          label: `${keys[i - 1]}@${trackKey}`,
          title: track.levels[keys[i - 1]].title,
        }
      : {
          href: trackUrl(trackKey),
          label: `${track.title} track`,
          title: "All walkthroughs in this track",
        };

  const next =
    i < keys.length - 1
      ? {
          href: levelUrl(trackKey, keys[i + 1]),
          label: `${keys[i + 1]}@${trackKey}`,
          title: track.levels[keys[i + 1]].title,
        }
      : null;

  return { prev, next };
}

function pagerHtml({ prev, next }) {
  const cell = (item, dir) => {
    if (!item) return `<div class="pager-cell pager-empty"></div>`;
    const arrow = dir === "prev" ? "&larr;" : "&rarr;";
    return (
      `<a class="pager-cell pager-${dir}" href="${esc(item.href)}">` +
      `<span class="pager-dir">${arrow} ${dir === "prev" ? "Previous" : "Next"}</span>` +
      `<span class="pager-label">${esc(item.label)}</span>` +
      `<span class="pager-title">${esc(item.title)}</span>` +
      `</a>`
    );
  };
  return (
    `<nav class="pager" aria-label="Walkthrough navigation">` +
    cell(prev, "prev") +
    cell(next, "next") +
    `</nav>`
  );
}

/** Build one walkthrough page. */
async function buildLevel(trackKey, levelKey) {
  const track = MANIFEST[trackKey];
  const lvl = track.levels[levelKey];
  const mdPath = join(WT, trackKey, `${levelKey}.md`);
  const md = await readFile(mdPath, "utf8");

  const { html, toc, words } = renderMarkdown(md);
  const canonical = `${SITE}${levelUrl(trackKey, levelKey)}`;
  const title = `${levelKey}@${trackKey} — ${lvl.title} — D3CYPH3R Walkthroughs`;

  const meta =
    `<p class="doc-meta">` +
    `<span class="doc-meta-item">${esc(readingTime(words))}</span>` +
    `<span class="doc-meta-sep" aria-hidden="true">&middot;</span>` +
    `<span class="doc-meta-item">${words.toLocaleString("en-US")} words</span>` +
    `<span class="doc-meta-sep" aria-hidden="true">&middot;</span>` +
    `<span class="doc-meta-item">${esc(track.title)} track</span>` +
    `</p>`;

  // Mobile TOC: same links, collapsed into a <details> above the
  // article. CSS shows this below 1100px and the rail above it.
  const mobileToc =
    `<details class="toc-mobile">` +
    `<summary>On this page</summary>` +
    `<ul class="toc-list">` +
    toc
      .map(
        (s) =>
          `<li><a href="#${esc(s.id)}">` +
          (s.ordinal ? `<span class="toc-ord">${esc(s.ordinal)}</span>` : "") +
          `<span class="toc-label">${esc(s.label)}</span></a></li>`
      )
      .join("") +
    `</ul></details>`;

  // Order matters: the document title has to come first, then its
  // metadata, then the mobile TOC, then the prose. Emitting meta and
  // TOC before the rendered markdown would put them above the <h1>,
  // which reads as though the page began mid-thought.
  //
  // The rendered markdown always opens with the h1 (every walkthrough
  // starts with a single "# level<N>@<track> — Title" line), so split
  // it off and re-insert the chrome behind it. If that assumption ever
  // breaks, the regex simply does not match and the chrome falls back
  // to the top, which is ugly but not broken.
  const h1Match = html.match(/^\s*<h1[^>]*>[\s\S]*?<\/h1>\s*/);
  const afterH1 = h1Match
    ? h1Match[0] + meta + mobileToc + html.slice(h1Match[0].length)
    : meta + mobileToc + html;

  const body =
    `  <div class="layout">\n` +
    `    <main id="main" class="doc">\n` +
    afterH1 +
    pagerHtml(pagerFor(trackKey, levelKey)) +
    `    </main>\n` +
    `    <aside class="rail">${tocRail(toc)}</aside>\n` +
    `  </div>`;

  const out = page({
    title,
    description: plain(lvl.blurb).slice(0, 300),
    canonical,
    crumbs: [
      { text: "index", href: "/walkthroughs/" },
      { text: track.title.toLowerCase(), href: trackUrl(trackKey) },
      { text: levelKey },
    ],
    body,
    bodyClass: "page-doc",
    scripts: ["/walkthroughs/reader.js"],
  });

  await writeFile(join(WT, trackKey, `${levelKey}.html`), out, "utf8");
  return { toc, words, title, canonical, trackKey, levelKey };
}

/** Build one track index page. */
async function buildTrack(trackKey) {
  const track = MANIFEST[trackKey];
  const levelKeys = Object.keys(track.levels);

  const items = levelKeys
    .map((k) => {
      const l = track.levels[k];
      return (
        `<li><a href="${esc(levelUrl(trackKey, k))}">` +
        `${esc(k)}@${esc(trackKey)} — ${esc(l.title)}</a>` +
        `<div class="desc">${esc(plain(l.blurb))}</div></li>`
      );
    })
    .join("\n");

  const body =
    `  <main id="main" class="doc doc-narrow">\n` +
    `<h1>${esc(track.title)} track</h1>\n` +
    `<p>${esc(plain(track.blurb))}</p>\n` +
    `<h2>Walkthroughs</h2>\n` +
    `<ul class="level-list">\n${items}\n</ul>\n` +
    `  </main>`;

  const out = page({
    title: `${track.title} — D3CYPH3R Walkthroughs`,
    description: plain(track.blurb).slice(0, 300),
    canonical: `${SITE}${trackUrl(trackKey)}`,
    crumbs: [
      { text: "index", href: "/walkthroughs/" },
      { text: track.title.toLowerCase() },
    ],
    body,
    scripts: ["/walkthroughs/reader.js"],
  });

  await writeFile(join(WT, trackKey, "index.html"), out, "utf8");
}

/** Build the root walkthroughs index. */
async function buildIndex() {
  const items = Object.entries(MANIFEST)
    .map(([key, track]) => {
      const count = Object.keys(track.levels).length;
      const status = count
        ? `<span class="count">${count} walkthrough${count === 1 ? "" : "s"}</span>`
        : `<span class="count count-empty">(none yet)</span>`;
      const inner = count
        ? `<a href="${esc(trackUrl(key))}">${esc(track.title)}</a> ${status}`
        : `<span class="dim">${esc(track.title)}</span> ${status}`;
      return `<li>${inner}<div class="desc">${esc(plain(track.blurb))}</div></li>`;
    })
    .join("\n");

  const body =
    `  <main id="main" class="doc doc-narrow">\n` +
    `<h1 class="index-title">` +
    `<span class="brand-cascade">${BRAND_GLYPHS}</span>` +
    `<span class="index-title-sub">walkthroughs</span></h1>\n` +
    `<p>Per-level deep dives: full solve paths plus extended post-mortems ` +
    `tying each level back to the certifications, frameworks, real-world ` +
    `incidents, and defender tooling covered in the in-game ` +
    `lessons-learned files.</p>\n` +
    `<p><em>These pages are spoiler-tolerant by design. Solve the level ` +
    `first; come back here for the study session.</em></p>\n` +
    `<div class="search-wrap">\n` +
    `  <label class="search-label" for="search-input">Search all walkthroughs</label>\n` +
    `  <input type="search" id="search-input" class="search-input" ` +
    `placeholder="Try: CWE-532, PCI-DSS, sudo, DMARC" autocomplete="off" ` +
    `aria-describedby="search-hint">\n` +
    `  <p id="search-hint" class="search-hint">Searches section headings and body text across all 24 walkthroughs.</p>\n` +
    `  <div id="search-results" class="search-results" aria-live="polite"></div>\n` +
    `</div>\n` +
    `<h2>Tracks</h2>\n` +
    `<ul class="track-list">\n${items}\n</ul>\n` +
    `  </main>`;

  const out = page({
    title: "D3CYPH3R Walkthroughs",
    description:
      "Long-form solve guides for D3CYPH3R levels: solve paths, " +
      "vulnerability deep-dives, framework and certification mappings, " +
      "MITRE ATT&CK, and defender remediation.",
    canonical: `${SITE}/walkthroughs/`,
    crumbs: [{ text: "index" }],
    body,
    scripts: ["/walkthroughs/reader.js", "/walkthroughs/search.js"],
  });

  await writeFile(join(WT, "index.html"), out, "utf8");
}

// ─── Sidecar artifacts ────────────────────────────────────────────

/**
 * sitemap.xml covering the main app plus all 32 walkthrough URLs.
 *
 * The previous sitemap listed two URLs and the 24 documents were
 * unreachable to crawlers behind hash routing. This is the other half
 * of that fix: real URLs plus a sitemap that declares them.
 */
async function buildSitemap(levels) {
  const urls = [
    { loc: `${SITE}/`, priority: "1.0", changefreq: "monthly" },
    { loc: `${SITE}/walkthroughs/`, priority: "0.8", changefreq: "monthly" },
    ...Object.keys(MANIFEST).map((t) => ({
      loc: `${SITE}${trackUrl(t)}`,
      priority: "0.6",
      changefreq: "monthly",
    })),
    ...levels.map((l) => ({
      loc: l.canonical,
      priority: "0.7",
      changefreq: "yearly",
    })),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n` +
          `    <loc>${u.loc}</loc>\n` +
          `    <changefreq>${u.changefreq}</changefreq>\n` +
          `    <priority>${u.priority}</priority>\n` +
          `  </url>\n`
      )
      .join("") +
    `</urlset>\n`;

  await writeFile(join(ROOT, "sitemap.xml"), xml, "utf8");
  return urls.length;
}

/**
 * llms.txt — a markdown index for AI crawlers and agents.
 *
 * Not an official web standard and not a ranking signal, but a cheap,
 * stable way to advertise that the underlying markdown exists and where
 * it lives. Since every walkthrough's SOURCE is already markdown served
 * at a public URL, pointing at it costs nothing and saves an agent from
 * scraping the rendered HTML.
 */
async function buildLlmsTxt(levels) {
  const lines = [
    "# D3CYPH3R",
    "",
    "> Terminal-based security training for DevOps and SRE engineers.",
    "> 24 hands-on scenarios across 7 tracks, each mapping findings to",
    "> NIST 800-53, MITRE ATT&CK, CWE, CIS Benchmarks, and OWASP.",
    "",
    "The walkthroughs below are long-form post-mortems, one per level.",
    "Each follows an identical 10-section structure and carries a review",
    "date with citations verified against primary sources.",
    "Markdown source for any page is the same path with a .md suffix.",
    "",
  ];

  for (const [trackKey, track] of Object.entries(MANIFEST)) {
    lines.push(`## ${track.title}`);
    lines.push("");
    lines.push(plain(track.blurb));
    lines.push("");
    for (const levelKey of Object.keys(track.levels)) {
      const l = track.levels[levelKey];
      lines.push(
        `- [${levelKey}@${trackKey} — ${l.title}](${SITE}${levelUrl(trackKey, levelKey)}): ${plain(l.blurb)}`
      );
    }
    lines.push("");
  }

  await writeFile(join(ROOT, "llms.txt"), lines.join("\n"), "utf8");
}

/**
 * Client-side search index.
 *
 * One entry per SECTION rather than per document, so a hit on "CWE-532"
 * resolves to /walkthroughs/linux/level2#vulnerability instead of
 * dumping the reader at the top of a 6,000-word page. Body text is
 * truncated per section to keep the index small enough to ship as a
 * single static file.
 */
async function buildSearchIndex(levels) {
  const docs = [];

  for (const l of levels) {
    const md = await readFile(
      join(WT, l.trackKey, `${l.levelKey}.md`),
      "utf8"
    );
    const track = MANIFEST[l.trackKey];
    const lvl = track.levels[l.levelKey];

    // Split the markdown on H2 boundaries so each section's text can be
    // attributed to its own anchor.
    const parts = md.split(/^## /m).slice(1);
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const headingText = part.slice(0, nl).trim();
      const id = SECTION_SLUGS[headingText];
      if (!id) continue;
      const bodyText = plainBody(part.slice(nl)).slice(0, 4000);
      docs.push({
        t: `${l.levelKey}@${l.trackKey}`,
        n: lvl.title,
        k: l.trackKey,
        s: id,
        h: SECTION_LABELS[id] || headingText,
        u: `${levelUrl(l.trackKey, l.levelKey)}#${id}`,
        b: bodyText,
      });
    }
  }

  await writeFile(
    join(WT, "search-index.json"),
    JSON.stringify({ v: 1, docs }),
    "utf8"
  );
  return docs.length;
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  const seq = levelSequence();

  // Validate the whole corpus BEFORE writing anything.
  //
  // Two reasons to gate rather than fail lazily mid-build: a partial
  // write would leave the committed pages half-updated and trip the CI
  // drift check for an unrelated reason, and an author who has broken
  // three files wants all three reported in one run, not one per fix.
  // Every level that exists right now, as "<level>@<track>" strings.
  // validate() uses this to catch prose that still describes a shipped
  // level as unbuilt.
  const shipped = new Set(seq.map((x) => `${x.levelKey}@${x.trackKey}`));

  const problems = [];
  for (const { trackKey, levelKey } of seq) {
    const md = await readFile(join(WT, trackKey, `${levelKey}.md`), "utf8");
    problems.push(...validate(md, `${trackKey}/${levelKey}.md`, shipped));
  }
  if (problems.length) {
    console.error(
      `\nWalkthrough template violations (${problems.length}):\n`
    );
    console.error(problems.join("\n"));
    console.error(
      `\nEvery walkthrough must carry the same ${REQUIRED_SECTIONS.length} sections ` +
        `in the same order.\nSee the template table in walkthroughs/README.md. ` +
        `Nothing was written.\n`
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `template: ${seq.length}/${seq.length} walkthroughs conform ` +
      `(${REQUIRED_SECTIONS.length} sections, in order, plus spoiler warning)`
  );

  const levels = [];
  for (const { trackKey, levelKey } of seq) {
    levels.push(await buildLevel(trackKey, levelKey));
  }
  for (const trackKey of Object.keys(MANIFEST)) {
    await buildTrack(trackKey);
  }
  await buildIndex();

  const urlCount = await buildSitemap(levels);
  await buildLlmsTxt(levels);
  const sectionCount = await buildSearchIndex(levels);

  const words = levels.reduce((a, l) => a + l.words, 0);
  console.log(
    `walkthroughs: ${levels.length} level pages, ` +
      `${Object.keys(MANIFEST).length} track pages, 1 index`
  );
  console.log(`sitemap.xml: ${urlCount} URLs`);
  console.log(`search-index.json: ${sectionCount} sections`);
  console.log(`llms.txt: written`);
  console.log(`total corpus: ${words.toLocaleString("en-US")} words`);
}

main().catch((err) => {
  console.error("build-walkthroughs failed:", err);
  process.exitCode = 1;
});
