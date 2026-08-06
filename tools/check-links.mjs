// D3CYPH3R — external link checker for the walkthrough corpus.
//
// PURPOSE
// -------
// Every walkthrough ends in a numbered source list, and the value of that
// list is entirely in whether the links still resolve. Standards bodies
// reorganise, vendors retire blog platforms, and CVE trackers move; a
// citation that 404s is worse than no citation, because it looks
// authoritative right up until someone clicks it.
//
// This script reads every URL out of walkthroughs/<track>/<level>.md,
// requests each one, and reports what it finds. Run it with:
//
//     node tools/check-links.mjs                  # check everything
//     node tools/check-links.mjs linux/level3     # check one file
//     node tools/check-links.mjs --json           # machine-readable
//
// WHY IT IS NOT IN THE BLOCKING BUILD
// -----------------------------------
// Deliberately separate from tools/build-walkthroughs.mjs. That script is
// hermetic: same input, same output, no network, so CI can require it to
// pass on every PR. Folding a network check into it would make an
// unrelated PR fail because a government website chose that morning to
// rate-limit, which trains people to ignore red builds.
//
// So link rot is checked on a schedule instead (.github/workflows/
// link-check.yml, weekly) and by hand during a level build, per the
// release checklist in js/engine/version.js. The STRUCTURAL half of
// citations (every [^key] resolves, no duplicate keys, no uncited
// definitions) is verified in the generator, where it belongs, because
// that part is deterministic and offline.
//
// ZERO DEPENDENCIES
// -----------------
// Node builtins only, using the global fetch in Node 18+.
//
// WHAT COUNTS AS A FAILURE
// ------------------------
// Only a response that tells us the document is gone: 404, 410, and DNS
// or TLS failures. Everything else is reported but does not fail the run:
//
//   - 403 / 429 are usually bot protection (Cloudflare, Akamai, ISO.org),
//     not a dead page. Reported as BLOCKED so a human can eyeball it.
//   - 3xx to a different path is reported as MOVED with the destination,
//     since the citation should be updated to point at the real home even
//     though it currently works.
//   - 5xx is retried, then reported as FLAKY rather than broken. A
//     standards site being down for ten minutes is not link rot.
//
// The point is a report a person acts on, not a gate that cries wolf.
//
// KNOWN BLIND SPOT
// ----------------
// A clean 200 is not proof the document exists. justice.gov, for one,
// answers every request from a non-browser client with a JavaScript
// interstitial challenge served under a 200, for real and imaginary
// paths alike. So this script can confirm that a link is DEAD, and it
// can confirm a redirect, but it cannot confirm that a 200 is the page
// you meant. Citations behind that kind of bot wall still need a human
// to open them, which is why the release checklist asks for a spot
// check rather than treating a green run as the whole answer.

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WT = join(ROOT, "walkthroughs");

// Tuning. Kept conservative on purpose: this hits real public
// infrastructure, much of it government-run and not especially fast.
const TIMEOUT_MS = 20_000;
const MAX_CONCURRENT = 8; // across all hosts
const PER_HOST_DELAY_MS = 250; // gap between requests to one host
const RETRIES = 2; // additional attempts after the first

// A browser User-Agent. Several standards sites (ISO, ANSI, a few
// vendor blogs) return 403 to anything that self-identifies as a script,
// which would fill the report with false alarms.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// ─── Extraction ───────────────────────────────────────────────────

/**
 * Pull every external URL out of one markdown file.
 *
 * Handles both link forms the corpus uses: inline `[text](url)` and
 * autolink `<url>`. Returns [{ url, line }] with duplicates preserved,
 * so the report can name every place a dead link appears rather than
 * just the first.
 *
 * Trailing punctuation is stripped because prose routinely ends a
 * sentence right after an autolink ("...see <https://example.com/x>.").
 */
function extractUrls(md) {
  const out = [];
  const lines = md.split("\n");

  lines.forEach((line, i) => {
    // Inline links: the ] ( ... ) form. Stop at whitespace or ) so a
    // title attribute or a nested paren does not get swallowed.
    for (const m of line.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)) {
      out.push({ url: clean(m[1]), line: i + 1 });
    }
    // Autolinks: the < ... > form.
    for (const m of line.matchAll(/<(https?:\/\/[^\s>]+)>/g)) {
      out.push({ url: clean(m[1]), line: i + 1 });
    }
  });

  return out;
}

/** Strip trailing sentence punctuation a URL should never end in. */
function clean(url) {
  return url.replace(/[.,;:]+$/, "");
}

/** Every walkthrough markdown path, sorted, as track/level pairs. */
async function walkthroughFiles(filter) {
  const dirs = (await readdir(WT, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && d.name !== "vendor")
    .map((d) => d.name)
    .sort();

  const files = [];
  for (const track of dirs) {
    const mds = (await readdir(join(WT, track)))
      .filter((f) => f.endsWith(".md"))
      .sort();
    for (const f of mds) {
      const label = `${track}/${f.replace(/\.md$/, "")}`;
      if (!filter || label.includes(filter)) {
        files.push({ label, path: join(WT, track, f) });
      }
    }
  }
  return files;
}

// ─── Checking ─────────────────────────────────────────────────────

/**
 * Request one URL and classify the result.
 *
 * Tries HEAD first because it is cheap and most of this corpus points at
 * large PDF and HTML documents. A surprising number of servers either do
 * not implement HEAD or handle it badly (405, 501, or a bare 403), so
 * anything other than a clean answer falls through to a ranged GET.
 *
 * The GET asks for the first byte only. That is enough to see the status
 * line and the redirect chain without pulling a 12MB NIST PDF; servers
 * that ignore Range simply send the body, which we never read.
 *
 * Returns { status, code, finalUrl, note }.
 */
async function probe(url) {
  let last = null;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * attempt);

    // HEAD, then GET. A HEAD that returns 4xx is not trusted: it is more
    // often an unimplemented verb than a missing document.
    for (const method of ["HEAD", "GET"]) {
      const res = await request(url, method);
      last = res;

      if (res.error) continue; // network-level; try the next method
      if (method === "HEAD" && res.code >= 400) continue; // re-ask with GET
      return classify(url, res);
    }

    // Both verbs failed at the network level. Retry unless the failure is
    // one that will never succeed.
    if (last?.error && isPermanentNetworkError(last.error)) break;
  }

  if (last?.error) {
    return {
      status: isPermanentNetworkError(last.error) ? "BROKEN" : "FLAKY",
      code: 0,
      finalUrl: url,
      note: last.error,
    };
  }
  return classify(url, last);
}

/** One HTTP request, with a timeout that actually aborts the socket. */
async function request(url, method) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        // Ask for the first byte only; see probe().
        ...(method === "GET" ? { Range: "bytes=0-0" } : {}),
      },
    });
    return { code: res.status, finalUrl: res.url || url };
  } catch (e) {
    return { error: describeError(e) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Map a status code onto one of the five report buckets.
 *
 * The MOVED check compares normalised paths rather than whole URLs so a
 * bare http->https upgrade, a added trailing slash, or a tracking query
 * does not get reported as a move. Those are noise; a genuine relocation
 * to a different path is the thing worth acting on.
 */
function classify(url, res) {
  const { code, finalUrl } = res;

  if (code === 404 || code === 410) {
    return { status: "BROKEN", code, finalUrl, note: "" };
  }
  // 418 belongs here rather than in the 4xx-is-broken bucket below.
  // Several anti-bot layers (freedesktop.org's among them) answer a
  // script with "I'm a teapot" and a challenge page, which is a refusal
  // to serve us, not a statement that the document is missing.
  if (code === 403 || code === 429 || code === 401 || code === 418) {
    return { status: "BLOCKED", code, finalUrl, note: "likely bot protection" };
  }
  if (code >= 500) {
    return { status: "FLAKY", code, finalUrl, note: "server error" };
  }
  if (code >= 400) {
    return { status: "BROKEN", code, finalUrl, note: "" };
  }

  if (finalUrl && normalisePath(finalUrl) !== normalisePath(url)) {
    return { status: "MOVED", code, finalUrl, note: "" };
  }
  return { status: "OK", code, finalUrl, note: "" };
}

/** Host + path, lowercased, without a trailing slash or query string. */
function normalisePath(u) {
  try {
    const p = new URL(u);
    return (p.host + p.pathname).toLowerCase().replace(/\/+$/, "");
  } catch {
    return u;
  }
}

/**
 * Errors that mean the URL is wrong, not that the network hiccuped.
 *
 * DNS failure and certificate-name mismatch will not fix themselves on a
 * retry, so they are reported as BROKEN. Timeouts, resets, and socket
 * hangups are transient and get the FLAKY treatment.
 */
function isPermanentNetworkError(msg) {
  return /ENOTFOUND|EAI_AGAIN|ERR_TLS_CERT_ALTNAME|unable to verify|certificate/i.test(
    msg
  );
}

/** fetch() wraps the useful part in a cause chain; dig it out. */
function describeError(e) {
  if (e?.name === "AbortError") return `timeout after ${TIMEOUT_MS}ms`;
  const cause = e?.cause;
  if (cause?.code) return `${cause.code}${cause.hostname ? ` (${cause.hostname})` : ""}`;
  return cause?.message || e?.message || String(e);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Scheduling ───────────────────────────────────────────────────

/**
 * Run `job` over `items` with a global concurrency cap and a per-host
 * gap.
 *
 * The per-host gap matters more than the global cap here: the corpus
 * points ~100 URLs at cwe.mitre.org and ~60 at csrc.nist.gov, so an
 * unthrottled run is a burst against two hosts and looks exactly like
 * something that ought to be rate-limited. Serialising per host keeps
 * the run polite and, incidentally, keeps the results trustworthy.
 */
async function pool(items, job) {
  const lastHitAt = new Map();
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const item = items[cursor++];
      const host = hostOf(item);

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

function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// ─── Report ───────────────────────────────────────────────────────

const ICON = {
  OK: "ok  ",
  MOVED: "MOVE",
  BLOCKED: "BLOK",
  FLAKY: "FLKY",
  BROKEN: "DEAD",
};

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const filter = args.find((a) => !a.startsWith("--"));

  const files = await walkthroughFiles(filter);
  if (!files.length) {
    console.error(`no walkthroughs matched "${filter}"`);
    process.exit(2);
  }

  // url -> [{ file, line }]
  const sites = new Map();
  for (const f of files) {
    const md = await readFile(f.path, "utf8");
    for (const { url, line } of extractUrls(md)) {
      if (!sites.has(url)) sites.set(url, []);
      sites.get(url).push({ file: f.label, line });
    }
  }

  const urls = [...sites.keys()].sort();
  if (!asJson) {
    console.log(
      `checking ${urls.length} unique URLs across ${files.length} walkthroughs\n`
    );
  }

  const results = new Map();
  let done = 0;
  await pool(urls, async (url) => {
    const r = await probe(url);
    results.set(url, r);
    done++;
    if (!asJson && r.status !== "OK") {
      console.log(
        `${ICON[r.status]}  ${String(r.code || "").padStart(3)}  ${url}` +
          (r.status === "MOVED" ? `\n            -> ${r.finalUrl}` : "") +
          (r.note ? `\n            (${r.note})` : "")
      );
    }
    if (!asJson && done % 50 === 0) {
      process.stderr.write(`  ...${done}/${urls.length}\n`);
    }
  });

  const by = (s) => urls.filter((u) => results.get(u).status === s);
  const broken = by("BROKEN");

  if (asJson) {
    console.log(
      JSON.stringify(
        urls.map((u) => ({ url: u, ...results.get(u), cited: sites.get(u) })),
        null,
        2
      )
    );
  } else {
    console.log(
      `\n${"─".repeat(64)}\n` +
        `  ok ${by("OK").length}   moved ${by("MOVED").length}   ` +
        `blocked ${by("BLOCKED").length}   flaky ${by("FLAKY").length}   ` +
        `broken ${broken.length}\n${"─".repeat(64)}`
    );

    // Dead links get the full treatment: every file and line that cites
    // them, so the fix is a single pass rather than a hunt.
    for (const u of broken) {
      console.log(`\nDEAD  ${u}  (${results.get(u).code || results.get(u).note})`);
      for (const c of sites.get(u)) console.log(`      ${c.file}.md:${c.line}`);
    }
  }

  process.exit(broken.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
