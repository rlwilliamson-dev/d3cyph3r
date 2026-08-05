// D3CYPH3R Walkthroughs — reader behaviour.
//
// Loaded by every generated page. Two jobs:
//
//   1. Theme bootstrap. Shares the main app's THEMES registry and its
//      localStorage key, so switching theme in the terminal applies
//      here and vice versa.
//   2. TOC scroll-spy. Highlights the section the reader is currently
//      in and reveals that section's subheadings.
//
// WHY THIS IS A SEPARATE FILE
// ---------------------------
// The site sends `script-src 'self'` with no 'unsafe-inline', so none
// of this can be an inline <script>. That is deliberate: the CSP is the
// enforcement mechanism behind the project's zero-runtime-dependency
// claim, and weakening it for convenience would undercut that.
//
// PROGRESSIVE ENHANCEMENT
// -----------------------
// Every page is complete, readable, and fully navigable with this file
// blocked or failed. The TOC is real anchor links in the served HTML;
// scroll-spy only adds the "you are here" highlight. Nothing here is
// load-bearing for reading the content.

import { initTheme, cycleTheme, getTheme } from "../js/terminal/theme.js";

// ─── Legacy hash-route redirect ───────────────────────────────────
//
// Before v2.4.0 the subsite was a hash-routed single page:
//
//   /walkthroughs/#/linux            -> track index
//   /walkthroughs/#/linux/level3     -> a walkthrough
//
// Those URLs are published in past release notes, linked from older
// versions of the in-game `walkthrough` command, and may be bookmarked.
// They now resolve to the static index, so translate and redirect.
//
// The test is unambiguous: legacy routes always begin "#/", and a real
// section anchor (#frameworks, #setup) never starts with a slash.
//
// Runs FIRST, before theme or scroll-spy setup, so a redirected reader
// does not briefly paint the index before moving on. replace() rather
// than assign() keeps the dead URL out of session history, so Back
// returns where the reader actually came from.
(function redirectLegacyHash() {
  const h = location.hash;
  if (!h.startsWith("#/")) return;

  const parts = h.slice(2).replace(/\/+$/, "").split("/");
  const track = parts[0];
  const level = parts[1];

  // Validate shape only. An unknown track or level falls through to a
  // normal 404 rather than being silently rewritten to something wrong.
  if (!/^[a-z]+$/.test(track || "")) return;

  const dest = level && /^level\d+$/.test(level)
    ? `/walkthroughs/${track}/${level}.html`
    : `/walkthroughs/${track}/`;

  location.replace(dest);
})();

// ─── Theme ────────────────────────────────────────────────────────

initTheme();

const themeBtn = document.getElementById("theme-toggle");
if (themeBtn) {
  const refresh = () => {
    const t = getTheme();
    themeBtn.title =
      `Theme: ${t.name} — click to cycle ` +
      `(or set via 'theme <name>' in the main terminal)`;
  };
  refresh();
  themeBtn.addEventListener("click", () => {
    cycleTheme();
    refresh();
  });
}

// ─── TOC scroll-spy ───────────────────────────────────────────────

const toc = document.getElementById("toc");
const main = document.getElementById("main");

if (toc && main) {
  // Only the 10 canonical H2 sections drive the spy. H3s are revealed
  // as a group when their parent section is active, rather than each
  // competing to be "current". With up to 40 H3s on the densest
  // walkthroughs, per-H3 tracking makes the rail flicker constantly
  // and tells the reader nothing useful.
  const sections = [...main.querySelectorAll("h2[id]")];
  const entries = toc.querySelectorAll("li[data-section]");

  if (sections.length && entries.length) {
    const byId = new Map();
    entries.forEach((li) => byId.set(li.dataset.section, li));

    let activeId = null;

    /** Mark one section current, clearing the previous one. */
    function setActive(id) {
      if (id === activeId) return;
      if (activeId && byId.has(activeId)) {
        byId.get(activeId).classList.remove("is-active");
      }
      activeId = id;
      if (id && byId.has(id)) {
        const li = byId.get(id);
        li.classList.add("is-active");
        // Keep the active entry visible when the rail itself has
        // overflowed (long track pages on short viewports).
        if (li.offsetTop < toc.scrollTop ||
            li.offsetTop > toc.scrollTop + toc.clientHeight) {
          li.scrollIntoView({ block: "nearest" });
        }
      }
    }

    // Cached document-space offset of each section heading.
    //
    // Measuring here rather than inside the scroll handler means the
    // handler performs no layout reads at all: it is pure arithmetic
    // over ten numbers, which is cheap enough to run on every scroll
    // event without throttling.
    let tops = [];
    function measure() {
      tops = sections.map((h) => {
        let y = 0;
        let el = h;
        // offsetTop is relative to offsetParent, so walk the chain to
        // get a document-space coordinate. Cannot use
        // getBoundingClientRect here because that is viewport-relative
        // and would need re-reading on every scroll, which is the cost
        // this cache exists to avoid.
        while (el) {
          y += el.offsetTop;
          el = el.offsetParent;
        }
        return y;
      });
    }

    /**
     * Pick the current section from cached offsets.
     *
     * An IntersectionObserver reports which headings are *visible*, but
     * these sections run far taller than the viewport, so mid-section
     * the answer is "none of them" and the highlight drops out. Choosing
     * the last heading above a trigger line gives a stable answer
     * everywhere, including inside a 3,000-word stretch with no heading
     * on screen.
     */
    function update() {
      // Trigger line sits a third of the way down the viewport: far
      // enough that a heading scrolling into view feels "arrived at",
      // close enough that the last section can still activate near the
      // bottom of the page.
      const line = window.scrollY + window.innerHeight / 3;

      let idx = 0;
      for (let i = 0; i < tops.length; i++) {
        if (tops[i] <= line) idx = i;
        else break;
      }

      // At the very bottom, force the final section active. Short last
      // sections (§9 is usually just a link list) can never cross the
      // trigger line on a tall viewport, which would otherwise leave
      // the rail stuck on §8 at the end of the page.
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      ) {
        idx = sections.length - 1;
      }

      setActive(sections[idx] ? sections[idx].id : null);
    }

    // NOTE: deliberately NOT requestAnimationFrame-throttled.
    //
    // Throttling exists to avoid doing expensive work per scroll event,
    // and the usual expensive work is layout reads. Because offsets are
    // cached above, update() is a scan over ten numbers plus at most one
    // class toggle, which is cheaper than the bookkeeping a throttle
    // would add. Dropping the rAF wrapper also removes a failure mode:
    // any "already scheduled" flag cleared inside a callback stops
    // updating for good if that callback is never delivered.
    window.addEventListener("scroll", update, { passive: true });

    // Re-measure whenever geometry can have changed. Offsets shift when
    // the viewport resizes (reflow) and when late-arriving webfonts
    // change text metrics, so a load-time-only measurement drifts.
    function remeasure() {
      measure();
      update();
    }
    window.addEventListener("resize", remeasure, { passive: true });
    window.addEventListener("load", remeasure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure).catch(() => {});
    }

    remeasure();

    // Clicking a rail link should activate it immediately rather than
    // waiting for smooth-scrolling to finish.
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='#']");
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      if (byId.has(id)) setActive(id);
    });
  }
}
