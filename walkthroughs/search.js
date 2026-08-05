// D3CYPH3R Walkthroughs — client-side search.
//
// Loaded only by the walkthroughs index page. Fetches the generated
// search-index.json and filters it in memory.
//
// WHY SECTION-LEVEL, NOT DOCUMENT-LEVEL
// --------------------------------------
// The corpus is 170,000 words across 24 documents averaging 7,000 words
// each. A document-level hit ("CWE-532 appears in level2@linux") drops
// the reader at the top of a very long page with no idea where to look.
// The generator emits one entry per SECTION instead (240 total, since
// all 24 walkthroughs share the same 10-section structure), so a result
// links straight to /walkthroughs/linux/level2#vulnerability.
//
// WHY NOT A SEARCH LIBRARY
// ------------------------
// Lunr, FlexSearch, and friends would each add a runtime dependency to
// a project whose stated posture is zero runtime JavaScript dependencies
// enforced by `script-src 'self'`. At 240 documents the naive approach
// is genuinely fast enough: scoring the whole index takes well under a
// millisecond, which is far below the threshold where a reader would
// notice. Reach for a real index only if the corpus grows an order of
// magnitude.
//
// PROGRESSIVE ENHANCEMENT
// -----------------------
// The input is hidden by default (CSS `.search-wrap { display: none }`)
// and revealed only once the index has loaded. A reader whose fetch
// fails sees the normal track listing rather than a dead search box.

import { MANIFEST } from "./manifest.mjs";

const input = document.getElementById("search-input");
const results = document.getElementById("search-results");
const wrap = document.querySelector(".search-wrap");

if (input && results && wrap) {
  /** @type {{t:string,n:string,k:string,s:string,h:string,u:string,b:string}[]} */
  let docs = [];

  fetch("/walkthroughs/search-index.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((data) => {
      docs = data.docs || [];
      // Only now is the control usable, so only now is it shown.
      wrap.classList.add("search-ready");
    })
    .catch(() => {
      // Leave the search UI hidden. The page is fully functional
      // without it and an inert input would be worse than none.
    });

  /**
   * Per-section relevance prior.
   *
   * Raw term frequency systematically over-ranks §9 Further reading.
   * That section is a bibliography, so a citation titled "CWE-532:
   * Insertion of Sensitive Information into Log File" contains the term
   * without explaining anything. Measured across five common queries
   * (cwe-532, pci-dss, dmarc, mitre, nist), further-reading took 7 of
   * 15 top-three slots, outranking the sections that actually teach the
   * concept.
   *
   * These multipliers restore the intended ordering: explain first,
   * cite last. The bibliography is still reachable, it just stops
   * beating the explanation.
   */
  const SECTION_WEIGHT = {
    vulnerability: 1.3,           // what the flaw IS
    solve: 1.25,                  // how it was found
    frameworks: 1.2,              // control mappings
    "real-world-parallels": 1.1,
    defender: 1.1,
    takeaways: 1.0,
    certifications: 1.0,
    "optional-exploration": 1.0,
    setup: 0.9,                   // scene-setting, rarely the answer
    "further-reading": 0.55,      // bibliography, not explanation
  };

  /**
   * Score one index entry against the query terms.
   *
   * Weighting rationale, highest first:
   *   - level id ("level2@linux") so a reader can jump by name
   *   - section heading, which is the most specific structural signal
   *   - walkthrough title
   *   - body text, which is the least precise
   *
   * The per-term total is then scaled by the section prior above.
   *
   * Every term must appear somewhere (AND semantics). Searching
   * "sudo wildcard" should not return every page mentioning sudo.
   */
  function score(doc, terms) {
    let total = 0;
    const id = doc.t.toLowerCase();
    const heading = doc.h.toLowerCase();
    const name = doc.n.toLowerCase();
    const body = doc.b.toLowerCase();

    for (const term of terms) {
      let s = 0;
      if (id.includes(term)) s += 40;
      if (heading.includes(term)) s += 25;
      if (name.includes(term)) s += 15;
      if (body.includes(term)) {
        // Frequency helps, but with sharply diminishing returns: a
        // section that says "CWE-532" nine times is more relevant than
        // one passing mention, but not nine times more.
        const hits = body.split(term).length - 1;
        s += Math.min(12, 4 + hits);
      }
      // AND semantics: one missing term disqualifies the entry.
      if (s === 0) return 0;
      total += s;
    }
    return total * (SECTION_WEIGHT[doc.s] ?? 1);
  }

  /** Build a short snippet around the first match, for context. */
  function snippet(body, term) {
    const i = body.toLowerCase().indexOf(term);
    if (i < 0) return body.slice(0, 140).trim() + "…";
    const start = Math.max(0, i - 60);
    const end = Math.min(body.length, i + 100);
    return (
      (start > 0 ? "…" : "") +
      body.slice(start, end).trim() +
      (end < body.length ? "…" : "")
    );
  }

  /**
   * Render results.
   *
   * Uses textContent for every piece of index-derived data rather than
   * innerHTML. The index is generated from repo-controlled markdown, so
   * this is defence in depth rather than a live threat, but it means a
   * future walkthrough cannot inject markup into this page through a
   * section body.
   */
  function render(matches, terms) {
    results.replaceChildren();

    if (!matches.length) {
      const p = document.createElement("p");
      p.className = "search-empty";
      p.textContent = "No matches.";
      results.appendChild(p);
      return;
    }

    const count = document.createElement("p");
    count.className = "search-count";
    count.textContent =
      `${matches.length} section${matches.length === 1 ? "" : "s"}`;
    results.appendChild(count);

    const ul = document.createElement("ul");
    ul.className = "search-list";

    for (const m of matches.slice(0, 40)) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = m.u;

      const head = document.createElement("span");
      head.className = "search-hit-head";
      head.textContent = `${m.t} — ${m.n}`;

      const sec = document.createElement("span");
      sec.className = "search-hit-section";
      sec.textContent = m.h;

      const snip = document.createElement("span");
      snip.className = "search-hit-snippet";
      snip.textContent = snippet(m.b, terms[0]);

      a.append(head, sec, snip);
      li.appendChild(a);
      ul.appendChild(li);
    }

    results.appendChild(ul);
  }

  function run() {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) {
      results.replaceChildren();
      return;
    }
    const terms = q.split(/\s+/).filter(Boolean);
    const matches = docs
      .map((d) => ({ d, s: score(d, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.d);
    render(matches, terms);
  }

  // Debounced so a fast typist scores the index once per pause rather
  // than once per keystroke.
  let timer = null;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });

  // Escape clears, which is the conventional affordance for a search
  // field and avoids trapping keyboard users in a filtered view.
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      results.replaceChildren();
    }
  });
}
