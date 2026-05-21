// Web-recon commands: curl, gobuster, cookies.

export const webCommands = {
  curl(level, arg) {
    if (!arg) return { text: "Usage: curl <url>  OR  curl -I <url>", cls: "err" };

    const headerMode = arg.startsWith("-I ");
    const url = headerMode ? arg.slice(3).trim() : arg.trim();

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
