// D3CYPH3R — does each citation point at the page it claims?
//
// PURPOSE
// -------
// tools/check-links.mjs answers "does this URL resolve". That is a
// weaker question than it looks. A citation reading
//
//     [CWE-250 — Execution with Unnecessary Privileges](https://cwe.mitre.org/data/definitions/205.html)
//
// resolves perfectly and is wrong: 205 is not 250. A redirect that
// lands on a vendor's blog index also resolves perfectly, and so does a
// bot-challenge page served under a 200. None of those are caught by a
// status code.
//
// This script fetches each cited page and checks that the thing the
// citation SAYS it is actually appears there. Run it with:
//
//     node tools/verify-citations.mjs                  # whole corpus
//     node tools/verify-citations.mjs linux/level3     # one walkthrough
//     node tools/verify-citations.mjs --json
//
// HOW A CITATION IS VERIFIED
// --------------------------
// Strongest signal first:
//
//   1. IDENTIFIER. If the citation title names a CWE, ATT&CK technique,
//      CVE, RFC, NIST SP, CFR part, ISO standard or OWASP entry, that
//      identifier must appear in the fetched page. This is close to
//      airtight: CWE-250's page says "CWE-250" and no other page does.
//   2. TITLE OVERLAP. Otherwise, the distinctive words of the citation
//      title are matched against the page's <title>, <h1> and opening
//      text. A majority must appear.
//
// Anything the script cannot read (bot walls, PDFs, JavaScript-rendered
// pages) is reported as UNVERIFIED rather than guessed at, because the
// entire point is to stop asserting things that were never checked.
//
// WHY NOT IN THE BLOCKING BUILD
// -----------------------------
// Same reason as check-links: it is a network check, and the generator
// stays hermetic so CI can require it on every PR. This runs during a
// walkthrough build and on the weekly schedule.

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(ROOT, "walkthroughs");

const TIMEOUT_MS = 25_000;
const MAX_CONCURRENT = 6;
const PER_HOST_DELAY_MS = 400;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ─── What a citation claims ───────────────────────────────────────

/**
 * Identifiers that, if present in a citation title, MUST appear on the
 * page it points at.
 *
 * Each entry returns the strings to look for. Several formats are
 * accepted per identifier because publishers are inconsistent: MITRE
 * writes "T1548.003" in the title and "T1548/003" in the URL, NIST
 * writes both "SP 800-53" and "SP800-53".
 */
function identifiers(title) {
  const out = [];
  const add = (...alts) => out.push(alts.filter(Boolean));

  let m;
  if ((m = /\bCWE-(\d+)\b/i.exec(title))) add(`CWE-${m[1]}`, `CWE ${m[1]}`);
  if ((m = /\bCVE-(\d{4})-(\d{4,7})\b/i.exec(title)))
    add(`CVE-${m[1]}-${m[2]}`);
  if ((m = /\bT(\d{4})\.(\d{3})\b/.exec(title)))
    add(`T${m[1]}.${m[2]}`, `T${m[1]}/${m[2]}`);
  else if ((m = /\bT(\d{4})\b/.exec(title))) add(`T${m[1]}`);
  if ((m = /\bRFC\s*(\d{3,5})\b/i.exec(title)))
    add(`RFC ${m[1]}`, `RFC${m[1]}`, `rfc${m[1]}`);
  if ((m = /\bSP\s*800-(\d+)([A-Za-z])?\b/i.exec(title)))
    add(`800-${m[1]}${m[2] || ""}`, `800${m[1]}${m[2] || ""}`);
  if ((m = /\b(\d+)\s*CFR\s*(?:Part\s*|Pt\.?\s*)?(\d+)/i.exec(title)))
    add(`${m[1]} CFR ${m[2]}`, `Part ${m[2]}`, `${m[1]} CFR Part ${m[2]}`);
  if ((m = /\bISO\/IEC\s*(\d{4,5})\b/i.exec(title))) add(`${m[1]}`);
  if ((m = /\bA(\d{2}):(\d{4})\b/.exec(title))) add(`A${m[1]}`, `A${m[1]}:${m[2]}`);
  if (/\b23\s*NYCRR\s*500/i.test(title)) add("23 NYCRR 500", "Part 500");

  return out;
}

// Words too common to distinguish one page from another.
const STOP = new Set(
  ("the a an and or of for to in on with without at by from as is are was " +
    "were be been being this that these those it its into over under new " +
    "current latest guide guidance overview documentation docs reference " +
    "manual page site home about security cyber data information report " +
    "rule rules standard standards framework control controls edition " +
    "version release notes blog news article post project series what how " +
    "why when where which who your you our their").split(" ")
);

/** Distinctive lowercase words from a citation title. */
function titleWords(title) {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9+#./-]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w))
    ),
  ];
}

// ─── Fetching ─────────────────────────────────────────────────────

/** Fetch a page and return readable text, or an error reason. */
async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (res.status === 403 || res.status === 429 || res.status === 418) {
      return { skip: `blocked (${res.status})`, finalUrl: res.url };
    }
    if (!res.ok) return { skip: `HTTP ${res.status}`, finalUrl: res.url };

    const type = res.headers.get("content-type") || "";
    if (!/text|html|xml|json/i.test(type)) {
      // PDFs and the like: the URL path is the only readable signal.
      return { skip: `binary (${type.split(";")[0] || "unknown"})`, finalUrl: res.url };
    }

    const raw = await res.text();

    // A bot-challenge page served under 200. justice.gov does this for
    // every path, real or imaginary, so treating its 200 as proof of
    // anything would be a mistake.
    if (
      /triggerInterstitialChallenge|Checking you are not a bot|Just a moment\.\.\.|cf-browser-verification/i.test(
        raw
      )
    ) {
      return { skip: "bot challenge under 200", finalUrl: res.url };
    }

    const title = (raw.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i) || [])[1] || "";
    const text = raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ");

    return { title: title.replace(/\s+/g, " ").trim(), text, finalUrl: res.url };
  } catch (e) {
    return { skip: e?.name === "AbortError" ? "timeout" : (e?.cause?.code || e.message) };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Verdict ──────────────────────────────────────────────────────

/**
 * Compare what the citation claims against what the page contains.
 *
 * Identifier evidence outranks title overlap: a page either says
 * "CWE-250" or it does not, whereas word overlap is a judgement call
 * about how a publisher chose to phrase a heading.
 */
function verify(citation, page) {
  if (page.skip) return { status: "UNVERIFIED", why: page.skip };

  const haystack = `${page.title} ${page.text}`.toLowerCase();
  const ids = identifiers(citation.title);

  if (ids.length) {
    const missing = ids.filter(
      (alts) => !alts.some((a) => haystack.includes(a.toLowerCase()))
    );
    if (!missing.length) return { status: "OK", why: "identifier present" };
    return {
      status: "MISMATCH",
      why: `page never mentions ${missing.map((a) => a[0]).join(", ")}`,
    };
  }

  // No identifier: fall back to how much of the title the page echoes.
  const words = titleWords(citation.title);
  if (!words.length) return { status: "UNVERIFIED", why: "title carries no testable signal" };

  const hit = words.filter((w) => haystack.includes(w));
  const ratio = hit.length / words.length;
  if (ratio >= 0.5) return { status: "OK", why: `${hit.length}/${words.length} title words` };
  if (ratio >= 0.3)
    return { status: "WEAK", why: `only ${hit.length}/${words.length} title words` };
  return {
    status: "MISMATCH",
    why: `page echoes ${hit.length}/${words.length} title words (${page.title.slice(0, 60)})`,
  };
}

// ─── Corpus walk ──────────────────────────────────────────────────

/** Every citation in the corpus: definitions and further-reading alike. */
async function collect(filter) {
  const dirs = (await readdir(WT, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name !== "vendor")
    .map((d) => d.name)
    .sort();

  const out = [];
  for (const track of dirs) {
    for (const f of (await readdir(join(WT, track))).filter((x) => x.endsWith(".md")).sort()) {
      const label = `${track}/${f.replace(/\.md$/, "")}`;
      if (filter && !label.includes(filter)) continue;
      const md = await readFile(join(WT, track, f), "utf8");

      // Numbered sources.
      for (const m of md.matchAll(/^\[\^([^\]]+)\]:\s*\[([^\]]+)\]\((https?:[^)\s]+)\)/gm)) {
        out.push({ file: label, key: m[1], title: m[2], url: m[3] });
      }
      // Unnumbered further reading.
      const nine = md.slice(md.search(/^## .*Further reading/m));
      for (const m of nine.matchAll(/^-\s+\[([^\]]+)\]\((https?:[^)\s]+)\)/gm)) {
        out.push({ file: label, key: "(further reading)", title: m[1], url: m[2] });
      }
    }
  }
  return out;
}

async function pool(items, job) {
  const lastHitAt = new Map();
  let cursor = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      let host = item.url;
      try {
        host = new URL(item.url).host;
      } catch {}
      const since = Date.now() - (lastHitAt.get(host) || 0);
      if (since < PER_HOST_DELAY_MS) await sleep(PER_HOST_DELAY_MS - since);
      lastHitAt.set(host, Date.now());
      await job(item);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT, items.length) }, worker)
  );
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const filter = args.find((a) => !a.startsWith("--"));

  const citations = await collect(filter);

  // One fetch per URL, shared by every citation that uses it.
  const byUrl = new Map();
  for (const c of citations) {
    if (!byUrl.has(c.url)) byUrl.set(c.url, []);
    byUrl.get(c.url).push(c);
  }
  const urls = [...byUrl.keys()];

  if (!asJson) {
    console.log(
      `verifying ${citations.length} citations over ${urls.length} unique URLs\n`
    );
  }

  const results = [];
  let done = 0;
  await pool(urls, async (url) => {
    const page = await fetchText(url);
    for (const c of byUrl.get(url)) {
      const v = verify(c, page);
      results.push({ ...c, ...v, finalUrl: page.finalUrl });
      if (!asJson && (v.status === "MISMATCH" || v.status === "WEAK")) {
        console.log(`${v.status}  ${c.file}  [^${c.key}]`);
        console.log(`     claims: ${c.title}`);
        console.log(`     url:    ${c.url}`);
        console.log(`     ${v.why}\n`);
      }
    }
    done++;
    if (!asJson && done % 60 === 0) process.stderr.write(`  ...${done}/${urls.length}\n`);
  });

  const by = (s) => results.filter((r) => r.status === s);

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log(
      `${"─".repeat(64)}\n` +
        `  ok ${by("OK").length}   weak ${by("WEAK").length}   ` +
        `mismatch ${by("MISMATCH").length}   unverified ${by("UNVERIFIED").length}\n` +
        `${"─".repeat(64)}`
    );
    const un = by("UNVERIFIED");
    if (un.length) {
      const reasons = {};
      for (const r of un) reasons[r.why] = (reasons[r.why] || 0) + 1;
      console.log(`\nnot machine-checkable (open these by hand):`);
      for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${String(n).padStart(3)}  ${why}`);
      }
    }
  }

  process.exit(by("MISMATCH").length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
