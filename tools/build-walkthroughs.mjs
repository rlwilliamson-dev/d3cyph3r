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
import { highlight } from "./highlight.mjs";

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
 * Exact inverse of highlighting: strip the token spans, undo esc().
 *
 * Used only to assert that highlighting is lossless (see the `code`
 * renderer). It is safe to be this literal because the input is never
 * arbitrary HTML: it is output this build just produced, whose only tags
 * are the <span class="tok-*"> wrappers the highlighter emits.
 *
 * Entity order matters and is the reverse of esc(): &amp; must be undone
 * LAST, otherwise "&amp;lt;" unescapes to "<" instead of "&lt;" and a
 * block legitimately containing that text would report a false mismatch.
 */
function unhighlight(html) {
  return html
    .replace(/<span class="tok-[a-z]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
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
    // Citation markers and definition labels. Both would otherwise reach
    // search snippets and meta descriptions as literal "[^cwe-250]"
    // noise. Has to run before the link strip below, which does not
    // match a marker (no "(url)" part) and would leave it behind.
    .replace(/\[\^[A-Za-z0-9][A-Za-z0-9._-]*\]:?/g, "")
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

  // Review staleness.
  //
  // Every §9 opens with "Last reviewed: <Month> <Year>", and the value
  // of that line is entirely in whether anyone acts on it. They did not:
  // two walkthroughs sat at April 2026 through four releases, while
  // their neighbours said July, and nothing anywhere noticed. Meanwhile
  // the corpus accumulated real drift — a CySA+ retirement date off by
  // six months, a PenTest+ launch year off by one, a CEH release off by
  // five months, a CISSP outline refresh off by a month.
  //
  // Cert vendors and standards bodies move on a roughly annual cycle,
  // so a review older than MAX_REVIEW_AGE_MONTHS is treated as expired
  // and fails the build. The fix is to re-audit and re-date, which is
  // exactly the work the line was supposed to prompt.
  //
  // Deliberately checked against the newest date in the corpus rather
  // than against today. A clone built two years from now should not
  // fail on a fresh checkout, and a repository whose walkthroughs were
  // all reviewed together should not go red simply for sitting still.
  // What this catches is DIVERGENCE: one walkthrough being re-audited
  // while its neighbours are left behind, which is the actual failure
  // mode observed.
  const reviewed = md.match(/Last reviewed:\s*([A-Z][a-z]+)\s+(\d{4})/);
  if (!reviewed) {
    problems.push(
      `missing the "Last reviewed: <Month> <Year>" line at the top of §9`
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
  // tell a reader the level is unreachable rather than merely unwritten.
  //
  // This vocabulary was assembled from an actual sweep rather than
  // guessed. The first pass caught only "a future" and "hasn't been
  // built", and missed "the eventual levelN" and "at time of writing,
  // levelN hasn't shipped yet", which between them accounted for six of
  // the seven stale references in the corpus. Add to this list whenever
  // a new euphemism turns up; the cost of a false positive is one
  // rewording, and the cost of a miss is a reader being told to stop.
  const UNBUILT_VOCAB =
    "hasn't been built|has not been built|isn't built|is not built|" +
    "not yet built|hasn't shipped|has not shipped|isn't shipped|" +
    "not yet shipped|hasn't yet shipped|doesn't exist|does not exist|" +
    "no entry point|forthcoming|will eventually|eventually explore|" +
    "the eventual|staged for it|when it ships|once it ships|" +
    "not yet available|currently solvable|to be built|will be built";

  const UNBUILT_CLAIMS = [
    new RegExp(`(\`?level\\d+@[a-z]+\`?)[^.\\n]{0,80}(${UNBUILT_VOCAB})`, "i"),
    new RegExp(`(${UNBUILT_VOCAB})[^.\\n]{0,80}(\`?level\\d+@[a-z]+\`?)`, "i"),
    /no level\d+ is currently solvable/i,
    /the level content is forthcoming/i,
  ];
  for (const re of UNBUILT_CLAIMS) {
    const m = md.match(re);
    if (m) {
      // Only a problem when the sentence names a level that EXISTS.
      // "a future level4@linux" is correct while level4 is unwritten.
      const named = (m[0].match(/level\d+@[a-z]+/) || [])[0];
      if (!named || shipped.has(named)) {
        problems.push(
          `claims a level is unbuilt: "${m[0].trim().slice(0, 80)}..." ` +
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

// ─── Citations ────────────────────────────────────────────────────
//
// A walkthrough makes a lot of checkable claims: that a regulator gives
// you 72 hours, that a named breach cost a named amount, that a standard
// says a specific thing in a specific control. Before this, §9 carried a
// pile of links at the bottom and the reader had to guess which link
// backed which sentence. Now a claim carries a numbered marker and the
// marker jumps to the source.
//
// AUTHORING
// ---------
// In the body, put the marker directly after the claim it supports:
//
//     DFARS gives contractors 72 hours to report.[^dfars-7012]
//
// In §9, define it once:
//
//     [^dfars-7012]: [DFARS 252.204-7012](https://www.ecfr.gov/...).
//         Optional sentence about what the source is good for.
//
// That is GitHub-flavoured footnote syntax, chosen so the raw .md files
// stay readable on GitHub, where the same markers render as a numbered
// reference list with backlinks. Nothing here is a private dialect.
//
// Numbering is by order of first citation, assigned during rendering, so
// authors never write a number and cannot get one wrong.
//
// Sources worth listing but not tied to a specific claim (a tool, a
// course, a standing reference) go in a plain bullet list under a
// "### Further reading" H3 inside §9. Those are pointers, not citations,
// and they stay unnumbered.
//
// WHAT IS ENFORCED
// ----------------
// Unknown key, duplicate definition, uncited definition, malformed
// definition, and a marker inside a definition all fail the build. The
// uncited rule is the load-bearing one: it is what keeps §9 a list of
// sources that were actually used rather than a pile of links that
// accumulate because deleting one feels like losing something.

// Identifiers a reader can look up, and which therefore must resolve to
// a source somewhere in §9. Deliberately limited to unambiguous ones:
// each has a canonical, per-identifier page, so "named but unsourced"
// is a fact rather than an opinion.
const CITABLE_IDS = [
  [/\bCWE-(\d+)\b/g, (m) => `CWE-${m[1]}`],
  [/\bCVE-(\d{4})-(\d{4,7})\b/g, (m) => `CVE-${m[1]}-${m[2]}`],
  [/\bT(\d{4})\.(\d{3})\b/g, (m) => `T${m[1]}.${m[2]}`],
  [/\bRFC\s?(\d{3,5})\b/g, (m) => `RFC ${m[1]}`],
  [/\bSP\s?800-(\d+[A-Za-z]?)\b/g, (m) => `SP 800-${m[1]}`],
];

/**
 * Identifiers the prose names that §9 never lists.
 *
 * Code is excluded: a `CWE-79` inside a command transcript or a config
 * dump is sample data, not a claim the walkthrough is making.
 *
 * Matching against §9 is done on several spellings of the same
 * identifier because publishers disagree with each other. MITRE writes
 * "T1548.003" in prose and "T1548/003" in a URL; NIST writes "SP
 * 800-53" and "800/53". A citation is present if any spelling appears.
 */
function uncitedIdentifiers(md, label) {
  const nineAt = md.search(/^## .*Further reading/m);
  if (nineAt < 0) return [];

  const body = md
    .slice(0, nineAt)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ");
  const nine = md.slice(nineAt);

  const missing = new Set();
  for (const [re, fmt] of CITABLE_IDS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body))) {
      const id = fmt(m);
      const spellings = [
        id,
        id.replace(".", "/"),
        id.replace(/^SP /, ""),
        id.replace(/\s/g, ""),
      ];
      if (!spellings.some((s) => nine.includes(s))) missing.add(id);
    }
  }

  if (!missing.size) return [];
  return [
    `  ${label}: names ${[...missing].sort().join(", ")} in the prose but ` +
      `lists no source for ${missing.size === 1 ? "it" : "them"} in §9`,
  ];
}

// A figure a reader could check: money, or a count of people or systems.
//
// The negative lookahead on 19xx/20xx keeps years out. "pre-2018
// accounts that didn't opt in" is a date, not a population, and the
// first version of this read it as one.
const FIGURE =
  /\$[\d,.]+ ?(?:million|billion|bn\b)|\b(?!(?:19|20)\d\d\s)\d[\d,]{2,}(?:\.\d+)? ?(?:million|billion)?\s*(?:records|accounts|customers|individuals|patients|users|victims|servers|databases|instances|machines)\b/i;

// The fictional consultancy and its clients. Figures about Driftwood's
// own engagements are authored worldbuilding, and demanding a source for
// "roughly $80M in annual revenue" at a company that does not exist
// would be absurd.
// Case-insensitive on purpose: the same names appear as hostnames and
// identifiers in lowercase (`meridian_portal`, `halton-prod-bastion`),
// and a paragraph discussing the fictional CSV by its table name is
// still discussing fiction.
const IN_WORLD =
  /Halton|Atlas|Vesta|Meridian|Polaris|Veridian|Coverline|Driftwood|BluePier|Reed|Daniel|Theo|Priya|Saanvi|Dana|Marisol/i;

/**
 * Paragraphs asserting a real-world figure with no citation anywhere in
 * them.
 *
 * §3.5 and §4 are full of dollar amounts, record counts and penalty
 * figures, and those are the most checkable claims a walkthrough makes
 * and the easiest to get subtly wrong. This corpus had a Change
 * Healthcare cost frozen at a mid-year estimate ($2.4bn against a final
 * $3.1bn) and a $148 million settlement attributed to the FTC when it
 * was a fifty-state attorneys-general action. Both sat unsourced.
 *
 * Checked per PARAGRAPH rather than per sentence: a figure usually
 * appears in a run of sentences about one incident, and one citation on
 * that run is the right density. Requiring one per sentence would push
 * authors toward the citation clutter this is meant to avoid.
 */
function uncitedFigures(md, label) {
  const nineAt = md.search(/^## .*Further reading/m);
  if (nineAt < 0) return [];

  const body = md.slice(0, nineAt).replace(/```[\s\S]*?```/g, " ");
  const bad = [];

  for (const para of body.split(/\n{2,}/)) {
    if (para.includes("[^")) continue;
    if (para.trimStart().startsWith("|")) continue; // handled by §3.5's own rows
    if (!FIGURE.test(para)) continue;
    if (IN_WORLD.test(para)) continue;

    const hit = para.match(FIGURE)[0];
    bad.push(hit.trim());
  }

  if (!bad.length) return [];
  return [
    `  ${label}: states ${bad.map((b) => `"${b}"`).join(", ")} about a ` +
      `real-world incident with no source in the paragraph`,
  ];
}

// Placeholder swapped for the rendered reference list after parsing.
//
// Position, not string surgery on the output: markdown rendering moves
// everything around, so the only reliable way to put the list exactly
// where the definitions were is to leave a token behind and substitute
// it afterwards. Deliberately alphanumeric, so no markdown construct and
// no HTML escaping can touch it in transit.
const REFS_TOKEN = "D3CREFERENCELISTANCHOR7F3A";

// A definition line: [^key]: content, at the start of a line.
const DEF_RE = /^\[\^([A-Za-z0-9][A-Za-z0-9._-]*)\]:[ \t]*(.*)$/;

/**
 * Split citation definitions out of a walkthrough's markdown.
 *
 * Returns { md, defs, problems } where `md` has the definition block
 * replaced by REFS_TOKEN and `defs` maps key -> raw markdown content.
 *
 * Definitions may wrap onto continuation lines indented by two or more
 * spaces, which is what keeps a long annotation from becoming an
 * unreadable single line in the source file.
 */
function extractDefinitions(md, label) {
  const problems = [];
  const defs = new Map();
  const lines = md.split("\n");
  const kept = [];
  let firstDefAt = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = DEF_RE.exec(lines[i]);
    if (!m) {
      kept.push(lines[i]);
      continue;
    }

    const [, key, head] = m;
    if (firstDefAt < 0) firstDefAt = kept.length;

    // Absorb indented continuation lines.
    const parts = [head.trim()];
    while (i + 1 < lines.length && /^[ \t]{2,}\S/.test(lines[i + 1])) {
      parts.push(lines[++i].trim());
    }
    const content = parts.join(" ").trim();

    if (defs.has(key)) {
      problems.push(`duplicate citation definition: [^${key}]`);
      continue;
    }
    if (!content) {
      problems.push(`empty citation definition: [^${key}]`);
      continue;
    }
    // One link, so the reference list always has exactly one destination
    // and "go to the source" is never ambiguous.
    const links = content.match(/\]\((https?:\/\/[^\s)]+)\)|<(https?:\/\/[^\s>]+)>/g) || [];
    if (links.length === 0) {
      problems.push(`citation [^${key}] has no link (needs one [title](url))`);
    } else if (links.length > 1) {
      problems.push(
        `citation [^${key}] has ${links.length} links; split it into ` +
          `one definition per source`
      );
    }
    if (/\[\^/.test(content)) {
      problems.push(`citation [^${key}] contains a marker; definitions cannot cite`);
    }
    defs.set(key, content);
  }

  // Drop blank lines left where the block used to be, then mark the spot.
  if (firstDefAt >= 0) {
    let start = firstDefAt;
    while (start > 0 && kept[start - 1].trim() === "") start--;
    let end = firstDefAt;
    while (end < kept.length && kept[end].trim() === "") end++;
    kept.splice(start, end - start, "", REFS_TOKEN, "");
  }

  return { md: kept.join("\n"), defs, problems: problems.map((p) => `  ${label}: ${p}`) };
}

/**
 * Build the reference list markup.
 *
 * `numbers` is key -> assigned number and `counts` is key -> how many
 * times the key was cited, both filled in during rendering. Entries come
 * out ordered by number, which is order of first citation.
 *
 * Each entry links back to every place it was cited. With one citation
 * that is a single arrow; with several it is a lettered run (a, b, c),
 * the convention Wikipedia uses, because numbering the backlinks would
 * collide visually with the reference numbers themselves.
 */
function renderRefList(defs, numbers, counts, renderInline) {
  const ordered = [...numbers.entries()]
    .filter(([key]) => defs.has(key))
    .sort((a, b) => a[1] - b[1]);

  if (!ordered.length) return "";

  const items = ordered
    .map(([key, num]) => {
      const n = counts.get(key) || 1;
      const back =
        n === 1
          ? `<a class="ref-back" href="#cite-${esc(key)}-1" ` +
            `aria-label="Back to the citation of source ${num}">&#8617;</a>`
          : `<span class="ref-back-group">` +
            Array.from({ length: n }, (_, i) =>
              `<a class="ref-back" href="#cite-${esc(key)}-${i + 1}" ` +
                `aria-label="Back to citation ${i + 1} of source ${num}">` +
                `${String.fromCharCode(97 + (i % 26))}</a>`
            ).join("") +
            `</span>`;

      return (
        `<li id="ref-${num}">${back}` +
        `<span class="ref-text">${renderInline(defs.get(key))}</span></li>`
      );
    })
    .join("\n");

  return (
    `<section class="refs">\n` +
    `<h3 id="sources">Sources</h3>\n` +
    `<ol class="ref-list">\n${items}\n</ol>\n` +
    `</section>\n`
  );
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
function renderMarkdown(md, label = "") {
  const toc = [];
  const used = new Set();
  // Only the first blockquote is eligible for the spoiler treatment.
  let seenBlockquote = false;

  // Reserved so an author's H3 cannot slug-collide with the generated
  // "Sources" heading and steal its anchor.
  used.add("sources");

  const { md: body, defs, problems } = extractDefinitions(md, label);

  // key -> reference number, assigned on first citation; key -> how many
  // times cited, for the backlinks. Both are filled by the renderer
  // below, which marked calls in document order.
  const numbers = new Map();
  const counts = new Map();
  const unknown = new Set();

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
    /**
     * Highlight a fenced block, then prove the highlighting changed only
     * the markup and not a single character of the code.
     *
     * The invariant is the point. A tokeniser that drops a character, or
     * emits one twice, produces a block that still LOOKS plausible: it is
     * monospaced, coloured, and subtly wrong, and the reader who copies
     * the command out is the one who finds out. So the rendered HTML is
     * stripped back down to text here and compared against the input. A
     * mismatch is a build failure, not a warning.
     *
     * See tools/highlight.mjs for why this is transcript-aware rather
     * than a general syntax highlighter.
     */
    code(text, infostring) {
      const { html: inner, kind } = highlight(text, infostring);

      if (unhighlight(inner) !== text) {
        problems.push(
          `  ${label}: highlighting altered the text of a ${kind} code block ` +
            `(starts "${text.slice(0, 40).replace(/\n/g, "\\n")}")`
        );
      }

      // The language and the chosen mode both land on the element, so a
      // test can assert the classification instead of eyeballing colours.
      const lang = String(infostring || "").trim().split(/\s+/)[0];
      const langCls = lang ? ` language-${esc(lang)}` : "";
      return (
        `<pre data-kind="${esc(kind)}"><code class="hl${langCls}">` +
        `${inner}\n</code></pre>\n`
      );
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

  // The inline extension that turns [^key] into a numbered marker.
  //
  // Registered as an extension rather than handled by a pre-pass regex
  // because marked runs extension tokenizers as part of normal inline
  // lexing, which means a marker inside a code span or a fenced block is
  // left alone for free. A regex sweep over the raw markdown would
  // rewrite `[^x]` inside a shell example, and several of these
  // walkthroughs quote regexes.
  const citation = {
    name: "citation",
    level: "inline",
    start(src) {
      const i = src.indexOf("[^");
      return i < 0 ? undefined : i;
    },
    tokenizer(src) {
      const m = /^\[\^([A-Za-z0-9][A-Za-z0-9._-]*)\]/.exec(src);
      if (m) return { type: "citation", raw: m[0], key: m[1] };
      return undefined;
    },
    renderer(token) {
      const { key } = token;

      // An undefined key is a build failure, but rendering has to
      // produce something. Emitting the raw marker keeps the sentence
      // readable in the (unreachable, because the build fails) output
      // rather than dropping the text on the floor.
      if (!defs.has(key)) {
        unknown.add(key);
        return `[^${esc(key)}]`;
      }

      if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
      const num = numbers.get(key);
      const nth = (counts.get(key) || 0) + 1;
      counts.set(key, nth);

      return (
        `<sup class="cite">` +
        `<a id="cite-${esc(key)}-${nth}" href="#ref-${num}" ` +
        `aria-label="Source ${num}">${num}</a></sup>`
      );
    },
  };

  // A fresh Marked instance per file. Reusing a global one would let
  // the `used` slug set and `toc` array leak across walkthroughs, since
  // the renderer closes over both.
  const inst = new Marked();
  inst.use({ renderer, extensions: [citation] });

  let html = inst.parse(body);

  // The reference list is rendered after the body so the numbering is
  // settled. parseInline on the same instance means definitions get the
  // same link treatment as the rest of the page (scheme allowlist,
  // target=_blank), rather than a second, subtly different renderer.
  const refs = renderRefList(defs, numbers, counts, (s) => inst.parseInline(s));
  html = html.replace(new RegExp(`<p>\\s*${REFS_TOKEN}\\s*</p>\\s*`), refs);

  for (const key of unknown) {
    problems.push(`  ${label}: cites [^${key}], which has no definition in §9`);
  }
  for (const key of defs.keys()) {
    if (!numbers.has(key)) {
      problems.push(
        `  ${label}: [^${key}] is defined but never cited ` +
          `(cite it in the body, or move it to the "Further reading" list)`
      );
    }
  }

  // The OTHER direction: a claim that names a source nobody can look up.
  //
  // Everything above verifies that each listed source gets used. That is
  // only half the relationship, and checking only that half is how 53
  // identifiers ended up named in prose with no source anywhere in the
  // walkthrough — CWE-863, CVE-2022-26134, T1098.001, RFC 4648 and the
  // rest were simply asserted. Both properties matter and they are not
  // the same: "every source is used" says nothing about "every claim has
  // a source".
  //
  // Scoped to identifiers because those are unambiguous. A reader who
  // meets "CWE-863" can reasonably expect a link; prose claims need
  // editorial judgement and stay out of the build.
  problems.push(...uncitedIdentifiers(md, label));
  problems.push(...uncitedFigures(md, label));
  if (defs.size && html.includes(REFS_TOKEN)) {
    problems.push(`  ${label}: internal error, the reference-list anchor survived rendering`);
  }

  // Word count comes from the original markdown so adding citations does
  // not silently inflate the reading-time estimate.
  const words = md.split(/\s+/).filter(Boolean).length;
  return { html, toc, words, problems, citations: numbers.size };
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
const CSS_VERSION = "2.12.0";

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

/**
 * Build one walkthrough page.
 *
 * `rendered` is the result main() already produced during validation.
 * Rendering is where citation problems surface, and main() promises to
 * validate the whole corpus before writing anything, so the render has
 * to happen up there; passing it back down avoids doing it twice.
 */
async function buildLevel(trackKey, levelKey, rendered) {
  const track = MANIFEST[trackKey];
  const lvl = track.levels[levelKey];

  const { html, toc, words } = rendered;
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

/**
 * Extract a level's in-game post-mortem text from levels/<track>.js.
 *
 * The content lives inside a JS template literal, so the scan has to
 * respect backslash escapes: these files use \` for inline code, and a
 * naive search for the closing backtick truncates most of them at the
 * first one. That bug produced a 100x spread in measured lengths before
 * it was caught, so the walk below is deliberate rather than a regex.
 *
 * Returns a Map of "<level>@<track>" -> post-mortem text.
 */
async function readPostMortems() {
  const out = new Map();
  for (const trackKey of Object.keys(MANIFEST)) {
    let src;
    try {
      src = await readFile(join(ROOT, "levels", `${trackKey}.js`), "utf8");
    } catch (_) {
      continue; // a track with no level file yet is not an error here
    }
    const re =
      /"lessons-learned\.md":\s*\{\s*type:\s*"file",\s*content:\s*`/g;
    let m;
    while ((m = re.exec(src))) {
      let i = m.index + m[0].length;
      let body = "";
      while (i < src.length) {
        if (src[i] === "\\") { body += src.slice(i, i + 2); i += 2; continue; }
        if (src[i] === "`") break;
        body += src[i]; i += 1;
      }
      // Attribute to the nearest preceding level key.
      const before = src.slice(0, m.index);
      const keys = [...before.matchAll(/"(level\d+@\w+)":\s*\{/g)];
      if (keys.length) out.set(keys[keys.length - 1][1], body);
    }
  }
  return out;
}

/**
 * Cross-check citations between a level's in-game post-mortem and its
 * walkthrough.
 *
 * The contract as of v2.5.2 is "the post-mortem NAMES a weakness, the
 * walkthrough EXPLAINS it". That only holds if every identifier the
 * in-game text names is actually covered somewhere in the walkthrough,
 * so this asserts containment in one direction: post-mortem ⊆
 * walkthrough. The walkthrough is free to go further, which it always
 * does.
 *
 * This is not hypothetical maintenance theatre. CWE-539 was added to
 * level2@forensics's post-mortem in v2.3.1 and never added to its
 * walkthrough, and nothing noticed until the citation sets were compared
 * by hand months later.
 */
// The in-game post-mortem's section banners, in required order.
//
// These are player-facing and read in a terminal, so consistency is more
// visible than it is in the walkthroughs: a reader moving between levels
// notices immediately when one is shaped differently. Two files used
// short banner names where 22 used long ones, and level0@linux had its
// first two sections in the opposite order, since it was written first
// and the convention settled afterwards. Neither was caught by review.
const PM_BANNERS = [
  "THE BLUNT VERSION",
  "THE CONSULTING-FIRM ANGLE",
  "FRAMEWORKS THAT COVER THIS",
  "MITRE ATT&CK MAPPING",
  "WHAT A DEFENDER SHOULD ACTUALLY DO",
  "CHECK YOURSELF",
  "GO DEEPER",
  "CLOSING THOUGHT",
];

/**
 * Check one post-mortem against the debrief template.
 *
 * Enforces the banner set and order, and the two things the debrief
 * contract requires that nothing else would catch: a link to the
 * level's own walkthrough, and retrieval prompts. Three tracks shipped
 * with no walkthrough reference at all before v2.6.0, so a player could
 * finish them without ever learning the deeper material existed.
 */
function validatePostMortem(pm, level, track, slot) {
  const problems = [];
  const found = [...pm.matchAll(/───\s+([A-Z][A-Z0-9 ,'\-/&()]+?)\s+─+/g)]
    .map((m) => m[1].trim());

  if (found.join("|") !== PM_BANNERS.join("|")) {
    const missing = PM_BANNERS.filter((b) => !found.includes(b));
    const extra = found.filter((b) => !PM_BANNERS.includes(b));
    problems.push(
      `post-mortem sections wrong` +
        (missing.length ? `, missing: ${missing.join(", ")}` : "") +
        (extra.length ? `, unexpected: ${extra.join(", ")}` : "") +
        (!missing.length && !extra.length ? ` (out of order)` : "")
    );
  }

  if (!pm.includes(`walkthroughs/${track}/${slot}`)) {
    problems.push(
      `post-mortem does not link its own walkthrough ` +
        `(GO DEEPER must name walkthroughs/${track}/${slot}.html)`
    );
  }

  return problems.map((p) => `  ${level}: ${p}`);
}

function crossCheckCitations(postMortem, walkthrough, label) {
  const ids = (t) =>
    new Set([
      ...(t.match(/CWE-\d+/g) || []),
      ...(t.match(/T\d{4}(?:\.\d{3})?/g) || []),
    ]);
  const inGame = ids(postMortem);
  const inWt = ids(walkthrough);
  const orphans = [...inGame].filter((id) => !inWt.has(id));
  if (!orphans.length) return [];
  return [
    `  ${label}: cited in-game but absent from the walkthrough: ` +
      `${orphans.sort().join(", ")} ` +
      `(the post-mortem names it; the walkthrough must explain it)`,
  ];
}

// How far a walkthrough's review date may lag the freshest one in the
// corpus before the build treats it as abandoned. Three months is one
// release cycle here, which is long enough to ship a level without
// tripping over this and short enough that a track cannot quietly fall
// a year behind.
const MAX_REVIEW_LAG_MONTHS = 3;

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** "Last reviewed: August 2026" -> a comparable month ordinal. */
function reviewOrdinal(md) {
  const m = md.match(/Last reviewed:\s*([A-Z][a-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1].toLowerCase());
  if (mi < 0) return null;
  return { n: Number(m[2]) * 12 + mi, label: `${m[1]} ${m[2]}` };
}

/**
 * Fail walkthroughs whose review date has fallen behind the corpus.
 *
 * The user's instruction was that the audit happens for ALL walkthroughs
 * on every level build, not just the new one, "so it stays the most
 * current". Left to memory that lasted exactly as long as it took to
 * ship the next level: at the time this was written, two walkthroughs
 * still said April 2026 while three said July, and the April ones were
 * carrying four separate factual errors about certification versions.
 *
 * Comparing each file against the FRESHEST file rather than against
 * today is what makes this a divergence check. Re-auditing one
 * walkthrough and not its neighbours is the thing that goes wrong, and
 * that is precisely what this makes impossible to merge.
 */
function checkReviewDates(entries) {
  const dated = entries.filter((e) => e.ord);
  if (!dated.length) return [];

  const newest = Math.max(...dated.map((e) => e.ord.n));
  const problems = [];
  for (const e of dated) {
    const lag = newest - e.ord.n;
    if (lag > MAX_REVIEW_LAG_MONTHS) {
      problems.push(
        `  ${e.label}: last reviewed ${e.ord.label}, ${lag} months behind ` +
          `the rest of the corpus.\n` +
          `      Re-audit its certification versions, framework revisions, and\n` +
          `      regulation citations, then update the "Last reviewed" line.`
      );
    }
  }
  return problems;
}

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

  const postMortems = await readPostMortems();

  const problems = [];
  const rendered = new Map();
  const reviews = [];
  for (const { trackKey, levelKey } of seq) {
    const md = await readFile(join(WT, trackKey, `${levelKey}.md`), "utf8");
    const label = `${trackKey}/${levelKey}.md`;
    problems.push(...validate(md, label, shipped));
    reviews.push({ label, ord: reviewOrdinal(md) });

    // Rendering doubles as citation validation: unknown keys and
    // uncited definitions are only knowable once the body has been
    // walked. Held for buildLevel() rather than recomputed.
    const r = renderMarkdown(md, label);
    problems.push(...r.problems);
    rendered.set(`${trackKey}/${levelKey}`, r);

    const pm = postMortems.get(`${levelKey}@${trackKey}`);
    if (pm) {
      problems.push(...crossCheckCitations(pm, md, label));
      problems.push(
        ...validatePostMortem(pm, `${levelKey}@${trackKey}`, trackKey, levelKey)
      );
    }
  }
  problems.push(...checkReviewDates(reviews));

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
    levels.push(
      await buildLevel(trackKey, levelKey, rendered.get(`${trackKey}/${levelKey}`))
    );
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

  const cites = [...rendered.values()].reduce((a, r) => a + r.citations, 0);
  const uncited = levels.filter(
    (l) => !rendered.get(`${l.trackKey}/${l.levelKey}`).citations
  );
  console.log(
    `citations: ${cites} sources cited across ` +
      `${levels.length - uncited.length}/${levels.length} walkthroughs` +
      (uncited.length
        ? `\n  no citations yet: ${uncited
            .map((l) => `${l.trackKey}/${l.levelKey}`)
            .join(", ")}`
        : "")
  );
  console.log(`total corpus: ${words.toLocaleString("en-US")} words`);
}

main().catch((err) => {
  console.error("build-walkthroughs failed:", err);
  process.exitCode = 1;
});
