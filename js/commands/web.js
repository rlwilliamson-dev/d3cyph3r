// Web-recon commands: curl, gobuster, cookies.
//
// Handler contract: every command exported here has the signature
//   (level, arg) → { text, cls } | null
// (See js/commands/linux.js for the broader contract description.)
//
// Like the network module, every "response" is faked from per-level
// static maps. URL matching is exact-string — the level author decides
// every fetchable URL up front, and players must use the exact form
// shown in the level's leaked clues / hints.
//
// Schema fields this module reads off the level object:
//   level.web          { url: "response body" }. Plain GET responses.
//   level.webHeaders   { url: { "HTTP/1.1": "200 OK",
//                               "Content-Type": "text/html", ... } }
//                      Headers returned by `curl -I`. The pseudo-key
//                      "HTTP/1.1" carries the status line; everything
//                      else renders as `Key: Value`.
//   level.gobusterRes  { url: ["/admin (Status: 301)",
//                              "/backup (Status: 200)", ...] }
//                      Pre-formatted result lines for gobuster output.
//                      Status codes / sizes are level-authored.
//   level.cookieData   { url: { name: "value", ... } }
//                      Cookie jar surfaced by `cookies <url>`. The
//                      handler emits a "Tip: base64 -d <value>" hint
//                      after the table because base64-looking session
//                      cookies are a recurring teaching pattern.
//   level.sqli         { "<base-url>": { param, template, columns,
//                                        dbVersion, dbUser, dbName, tables } }
//                      A *vulnerable* GET endpoint (v1.28.0). When `curl`
//                      hits a URL whose path matches one of these keys, the
//                      raw query-param value is concatenated into the
//                      endpoint's SQL `template` (at the `{INJECT}` marker)
//                      and the resulting query is ACTUALLY EXECUTED against
//                      the in-memory `tables` by js/commands/sqli.js. That
//                      makes SQL injection behave like the real thing — a
//                      lone quote throws a syntax error, a tautology dumps
//                      every row, a bad UNION column count errors out — which
//                      an exact-string URL map (level.web) cannot do for the
//                      open-ended payload space of injection. See sqli.js for
//                      the full endpoint shape + supported SQL grammar.

import { runInjectableQuery } from "./sqli.js";

// Strip outer matching quotes from a URL the player typed. Real bash
// would have stripped these during tokenization; the engine's parse
// layer already does that, but legacy single-string `arg` strings still
// pass through this helper for safety.
function dequote(s) {
  return s.replace(/^(['"])(.*)\1$/, "$2");
}

export const webCommands = {
  // curl: realistic flag handling (v1.9.0). Supports:
  //
  //   -X METHOD           — request method (default GET; -I implies HEAD)
  //   -d DATA, --data D   — request body (implies POST if -X is unset)
  //   -H "Name: Value"    — extra header (repeatable)
  //   -I, --head          — HEAD: just print response headers
  //   -L, --location      — follow Location: redirects (max 5 hops)
  //   -o FILE             — also "save to FILE" (sandbox: warned, output
  //                         still printed)
  //   -k, --insecure      — accept any TLS cert (no-op here; just accepted)
  //   -s, --silent        — silent progress (we're already silent; accepted)
  //   -v, --verbose       — print request + response headers as well
  //
  // Response lookup priority for a request `METHOD URL`:
  //   1. level.webRequests[`${METHOD} ${URL}`]  — { body, headers, status }
  //   2. level.web[URL]                          — body string (legacy)
  // (-I uses level.webHeaders[URL] as it always did.)
  curl(level, _arg, _stdin, argv) {
    const args = (argv || []).slice();
    if (args.length === 0) return { text: "Usage: curl [-X METHOD] [-d DATA] [-H HEADER] [-I] [-L] [-o FILE] [-kvs] <url>", cls: "err" };

    let method   = "GET";
    let body     = null;
    let headMode = false;
    let follow   = false;
    let outFile  = null;
    let verbose  = false;
    const extraHeaders = [];
    let url = null;

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-X" && args[i+1])                { method = args[++i].toUpperCase(); continue; }
      if (a === "-d" || a === "--data")           { body   = dequote(args[++i] || ""); if (method === "GET") method = "POST"; continue; }
      if (a.startsWith("--data="))                { body   = dequote(a.slice("--data=".length)); if (method === "GET") method = "POST"; continue; }
      if (a === "-H" && args[i+1])                { extraHeaders.push(dequote(args[++i])); continue; }
      if (a === "-I" || a === "--head")           { headMode = true; method = "HEAD"; continue; }
      if (a === "-L" || a === "--location")       { follow = true; continue; }
      if (a === "-o" && args[i+1])                { outFile = args[++i]; continue; }
      if (a === "-k" || a === "--insecure")       { continue; }
      if (a === "-s" || a === "--silent")         { continue; }
      if (a === "-v" || a === "--verbose")        { verbose = true; continue; }
      if (a.startsWith("-"))                      { continue; } // tolerate unknown flags
      if (!url)                                   { url = dequote(a); continue; }
    }
    if (!url) return { text: "Usage: curl [-X METHOD] [-d DATA] [-H HEADER] [-I] [-L] [-o FILE] [-kvs] <url>", cls: "err" };

    // Build the verbose request preamble (when -v).
    const reqLines = [];
    if (verbose) {
      reqLines.push(`> ${method} ${url} HTTP/1.1`);
      reqLines.push(`> Host: ${url.replace(/^https?:\/\//, "").split("/")[0]}`);
      reqLines.push(`> User-Agent: curl/8.5.0`);
      reqLines.push(`> Accept: */*`);
      extraHeaders.forEach(h => reqLines.push(`> ${h}`));
      if (body != null) reqLines.push(`> Content-Length: ${body.length}`);
      reqLines.push(`>`);
      if (body != null) reqLines.push(body);
    }

    // -I / HEAD: just headers.
    if (headMode) {
      const headers = level.webHeaders?.[url];
      if (!headers) return { text: `curl: (6) Could not resolve host: ${url.replace(/https?:\/\//, "").split("/")[0]}`, cls: "err" };
      const lines = Object.entries(headers).map(([k, v]) => k === "HTTP/1.1" ? `HTTP/1.1 ${v}` : `${k}: ${v}`);
      if (reqLines.length) return { text: [...reqLines, "", ...lines].join("\n"), cls: "out" };
      return { text: lines.join("\n"), cls: "out" };
    }

    // Vulnerable SQLi endpoint (v1.28.0). If the URL's path matches a
    // registered level.sqli endpoint, execute the injected query for real
    // (see sqli.js) rather than doing an exact-string body lookup. GET only —
    // the teaching payloads all live in the `?q=` query string.
    if (method === "GET") {
      const hit = matchSqliEndpoint(level, url);
      if (hit) {
        const { body, status } = renderSqliResponse(hit.endpoint, hit.value);
        const out = [];
        if (reqLines.length) out.push(...reqLines, "");
        if (verbose) {
          out.push(`< HTTP/1.1 ${status}`);
          out.push(`< Content-Type: application/json`);
          out.push(`<`);
        }
        out.push(body);
        return { text: out.join("\n"), cls: "out" };
      }
    }

    // -L: walk Location: redirects up to 5 hops.
    let hops = 0;
    let currentUrl = url;
    const trail = [];
    while (true) {
      if (++hops > 5) {
        return { text: `curl: (47) Maximum (5) redirects followed`, cls: "err" };
      }
      // Look up method-aware first, then plain body.
      const reqResp = level.webRequests?.[`${method} ${currentUrl}`];
      const respBody  = reqResp ? reqResp.body : level.web?.[currentUrl];
      const respHdrs  = reqResp ? (reqResp.headers || {}) : (level.webHeaders?.[currentUrl] || {});
      const status    = reqResp ? (reqResp.status  || "200 OK") : (respHdrs["HTTP/1.1"] || "200 OK");

      if (respBody == null && !reqResp) {
        return { text: `curl: (6) Could not resolve host: ${currentUrl.replace(/https?:\/\//, "").split("/")[0]}`, cls: "err" };
      }

      // Should we follow?
      const isRedirect = /^(301|302|303|307|308)\b/.test(status);
      if (follow && isRedirect && respHdrs.Location) {
        trail.push(`Followed: ${currentUrl} → ${respHdrs.Location} (${status})`);
        currentUrl = respHdrs.Location;
        continue;
      }

      // Build output. Verbose mode adds response headers as `< ...`.
      const out = [];
      if (reqLines.length) out.push(...reqLines, "");
      if (trail.length)    out.push(...trail.map(t => `* ${t}`));
      if (verbose) {
        out.push(`< HTTP/1.1 ${status}`);
        for (const [k, v] of Object.entries(respHdrs)) {
          if (k === "HTTP/1.1") continue;
          out.push(`< ${k}: ${v}`);
        }
        out.push(`<`);
      }
      if (respBody != null) out.push(respBody);
      if (outFile) {
        out.unshift(`curl: -o ${outFile}: file writes are no-ops in this sandbox; output printed inline.`);
      }
      return { text: out.join("\n"), cls: "out" };
    }
  },

  // gobuster: simulated directory brute-force. Real gobuster syntax
  // is now accepted (v1.9.0):
  //
  //   gobuster dir -u <url> [-w wordlist] [-x exts] [-t threads]
  //   gobuster <url>                                — legacy shortcut
  //
  // All flags except -u are cosmetic — the banner reflects them so
  // walkthroughs that show real syntax don't drift. -u (or the
  // positional URL) is what we use for the lookup.
  gobuster(level, _arg, _stdin, argv) {
    const args = (argv || []).slice();
    if (args.length === 0) return { text: "Usage: gobuster dir -u <url> [-w wordlist] [-x exts] [-t threads]", cls: "err" };

    // Subcommand: gobuster dir / dns / vhost. We only model dir.
    let i = 0;
    if (["dir", "dns", "vhost", "fuzz"].includes(args[0])) i = 1;

    let url      = null;
    let wordlist = "/usr/share/wordlists/dirb/common.txt";
    let exts     = null;
    let threads  = 10;
    let codes    = "200,204,301,302,307,401,403";

    for (; i < args.length; i++) {
      const a = args[i];
      if (a === "-u" && args[i+1])        { url      = args[++i]; continue; }
      if (a === "-w" && args[i+1])        { wordlist = args[++i]; continue; }
      if (a === "-x" && args[i+1])        { exts     = args[++i]; continue; }
      if (a === "-t" && args[i+1])        { threads  = parseInt(args[++i], 10) || 10; continue; }
      if (a === "--status-codes" && args[i+1]) { codes = args[++i]; continue; }
      if (a.startsWith("-"))              { continue; }
      if (!url)                           { url = a; continue; }
    }
    if (!url) return { text: "Usage: gobuster dir -u <url> [-w wordlist] [-x exts] [-t threads]", cls: "err" };

    const res = level.gobusterRes?.[url];
    if (!res) return { text: `gobuster: no web target configured at ${url}`, cls: "err" };

    const header = [
      `Gobuster v3.6`,
      `[+] Url:           ${url}`,
      `[+] Method:        GET`,
      `[+] Threads:       ${threads}`,
      `[+] Wordlist:      ${wordlist}`,
      `[+] Status codes:  ${codes}`,
    ];
    if (exts) header.push(`[+] Extensions:    ${exts}`);
    header.push(`[+] Timeout:       10s`);
    header.push(``);
    header.push(`Starting gobuster...`);
    header.push(`──────────────────────────────────────────`);
    return { text: [...header, ...res, "", "Finished."].join("\n"), cls: "warn" };
  },

  // cookies: dump the per-URL cookie jar as a name=value table.
  // Always appends the "base64 -d" hint regardless of jar contents —
  // levels routinely seed session cookies as base64 strings to teach
  // the encoding-isn't-encryption lesson, and the hint nudges players
  // toward decoding them rather than treating the cookies as opaque.
  cookies(level, arg) {
    if (!arg) return { text: "Usage: cookies <url>", cls: "err" };
    const url = arg.trim();
    const jar = level.cookieData?.[url];
    if (!jar) return { text: `cookies: no cookies found for ${url}`, cls: "err" };

    const lines = [
      `Cookies for: ${url}`,
      `──────────────────────────────────────────`,
    ];
    Object.entries(jar).forEach(([name, val]) => {
      lines.push(`  ${name.padEnd(20)} = ${val}`);
    });
    lines.push("", "Tip: base64-looking values can be decoded with: base64 -d <value>");
    return { text: lines.join("\n"), cls: "out" };
  },
};

// ── SQLi endpoint plumbing (v1.28.0) ───────────────────────────────────────

// Does this URL hit a registered vulnerable endpoint? Returns
// { endpoint, value } (value = the decoded injection param) or null.
//
// Matching is on the PATH portion only (everything before the first "?"),
// exact-string against the level.sqli keys (one trailing-slash difference is
// tolerated). The query string is then split on "&"/"=" to pull the
// endpoint's parameter; a missing value defaults to "" (an empty search,
// which the template renders as `LIKE '%%'` → match-all, exactly like a real
// search box with no term).
function matchSqliEndpoint(level, url) {
  if (!level.sqli) return null;
  const qIdx = url.indexOf("?");
  const base = qIdx === -1 ? url : url.slice(0, qIdx);
  const qs   = qIdx === -1 ? "" : url.slice(qIdx + 1);

  const key = Object.keys(level.sqli).find(
    k => k === base || `${k}/` === base || k === `${base}/`,
  );
  if (!key) return null;

  const endpoint = level.sqli[key];
  const param = endpoint.param || "q";
  let raw = "";
  for (const pair of qs.split("&")) {
    const eq = pair.indexOf("=");
    const name = eq === -1 ? pair : pair.slice(0, eq);
    if (name === param) { raw = eq === -1 ? "" : pair.slice(eq + 1); break; }
  }
  return { endpoint, value: lenientPercentDecode(raw) };
}

// Percent-decode only well-formed %XX escapes; leave a stray "%" alone (SQLi
// payloads are full of bare "%" from LIKE wildcards, and decodeURIComponent on
// the whole string would throw on those). This lets BOTH `' OR 1=1` typed
// literally AND its %27%20… URL-encoded form reach the evaluator intact.
function lenientPercentDecode(s) {
  return String(s).replace(/%[0-9A-Fa-f]{2}/g, (m) => {
    try { return decodeURIComponent(m); } catch { return m; }
  });
}

// Run the injected query and render the HTTP response body. On success →
// a JSON results array (each row mapped positionally onto endpoint.columns,
// so UNION-injected data surfaces in the app's normal output slots). On
// failure → a JSON error body that leaks the raw DB error AND the constructed
// query (the CWE-209 "verbose errors in production" anti-pattern the bonus
// keys on). Syntax errors are rendered in MySQL's canonical 1064 form so the
// learner can fingerprint the backend.
function renderSqliResponse(endpoint, rawValue) {
  const r = runInjectableQuery(endpoint, rawValue);
  if (r.error) {
    const dberr = /You have an error in your SQL syntax/i.test(r.error)
      ? `You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near '${r.near}' at line 1`
      : r.error;
    const body = JSON.stringify({
      status: "error",
      message: "Database query failed",
      error: dberr,
      query: r.query,
    }, null, 2);
    return { body, status: "500 Internal Server Error" };
  }
  const results = r.rows.map((row) => {
    const obj = {};
    endpoint.columns.forEach((c, i) => { obj[c] = row[i] === undefined ? null : row[i]; });
    return obj;
  });
  const body = JSON.stringify({ results, count: results.length }, null, 2);
  return { body, status: "200 OK" };
}
