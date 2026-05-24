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

export const webCommands = {
  // curl: two modes. `-I` returns headers from level.webHeaders;
  // bare URL returns body from level.web. Both branches use exact-
  // string URL matching (see schema notes above). A missing URL
  // surfaces a curl-shaped "(6) Could not resolve host" error to
  // match the real tool's DNS-failure output — the message a player
  // would see if they fat-fingered a hostname against the real
  // internet.
  curl(level, arg) {
    if (!arg) return { text: "Usage: curl <url>  OR  curl -I <url>", cls: "err" };

    const headerMode = arg.startsWith("-I ");
    let url = headerMode ? arg.slice(3).trim() : arg.trim();
    // Strip surrounding shell quotes if present — players (and walkthrough
    // examples) often wrap URLs with `?` in single or double quotes the
    // way they would in a real bash session. The terminal doesn't do
    // bash-style word splitting, so the quotes survive into `arg`; we
    // strip them here so the URL lookup matches level.web[url].
    url = url.replace(/^(['"])(.*)\1$/, "$2");

    if (headerMode) {
      const headers = level.webHeaders?.[url];
      if (!headers) return { text: `curl: (6) Could not resolve host: ${url.replace("http://","").split("/")[0]}`, cls: "err" };
      const lines = Object.entries(headers).map(([k, v]) => k === "HTTP/1.1" ? `HTTP/1.1 ${v}` : `${k}: ${v}`);
      return { text: lines.join("\n"), cls: "out" };
    }

    const body = level.web?.[url];
    if (!body) return { text: `curl: (6) Could not resolve host: ${url.replace(/https?:\/\//,"").split("/")[0]}`, cls: "err" };
    return { text: body, cls: "out" };
  },

  // gobuster: simulated directory brute-force. The level pre-computes
  // the "discovered" paths and their status codes; we render them
  // inside Gobuster v3.6's standard banner format so walkthrough
  // screenshots remain faithful. The wordlist string in the banner
  // is cosmetic — no actual wordlist is processed.
  gobuster(level, arg) {
    if (!arg) return { text: "Usage: gobuster <url>", cls: "err" };
    const url = arg.trim();
    const res = level.gobusterRes?.[url];
    if (!res) return { text: `gobuster: no web target configured at ${url}`, cls: "err" };

    const header = [
      `Gobuster v3.6`,
      `[+] Url:         ${url}`,
      `[+] Wordlist:    /usr/share/wordlists/dirb/common.txt`,
      `[+] Status codes:200,204,301,302,307,401,403`,
      `[+] Timeout:     10s`,
      ``,
      `Starting gobuster...`,
      `──────────────────────────────────────────`,
    ];
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
