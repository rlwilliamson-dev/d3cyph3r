// OSINT-track commands: open-source intelligence gathering.
//
// All commands read from per-level data fields:
//
//   sherlockResults  — { username: ["Twitter: https://...", ...] }
//   hibpResults      — { email: [{ breach, date, exposed }, ...] }
//   waybackResults   — { url: [{ timestamp, snapshot_url, status }, ...] }
//   crtshResults     — { domain: [{ subdomain, issuer, issued }, ...] }
//   harvesterResults — { domain: { emails, subdomains, hosts } }
//   shodanResults    — { query: [{ ip, hostname, org, country, ports, banner }, ...] }
//   ipinfoResults    — { ip: { hostname, city, region, country, loc, org, postal, timezone } }
//   github           — { username: { profile: {...}, repos: { repoName: { meta, files: { path: content } } } } }
//                      Source-control OSINT — see the github() command
//                      below for the full schema. Files map keys can
//                      include slashes for nested paths.
//
// Each handler returns the canonical "command not configured for this
// target" message when no data is present, so the lobby smoke-test
// passes and unconfigured levels degrade gracefully.

export const osintCommands = {
  sherlock(level, arg) {
    if (!arg) return { text: "Usage: sherlock <username>", cls: "err" };
    const username = arg.trim();
    const res = level.sherlockResults?.[username];
    if (!res) return { text: `sherlock: no results found for '${username}'`, cls: "dim" };

    const header = [
      `Sherlock 0.14.4`,
      `[*] Checking username "${username}" across social platforms`,
      `──────────────────────────────────────────`,
      ``,
    ];
    return { text: [...header, ...res, ``, `[*] Search complete.`].join("\n"), cls: "warn" };
  },

  hibp(level, arg) {
    if (!arg) return { text: "Usage: hibp <email>", cls: "err" };
    const email = arg.trim();
    const res = level.hibpResults?.[email];
    if (!res) return { text: `hibp: no breaches found for '${email}'`, cls: "out" };

    const lines = [
      `Have I Been Pwned — breach lookup`,
      `Email: ${email}`,
      `──────────────────────────────────────────`,
    ];
    res.forEach(b => {
      lines.push(``);
      lines.push(`  Breach:    ${b.breach}`);
      lines.push(`  Date:      ${b.date}`);
      lines.push(`  Exposed:   ${b.exposed}`);
      if (b.description) lines.push(`  Notes:     ${b.description}`);
    });
    lines.push(``, `${res.length} breach${res.length === 1 ? "" : "es"} found for this address.`);
    return { text: lines.join("\n"), cls: "warn" };
  },

  wayback(level, arg) {
    if (!arg) return { text: "Usage: wayback <url>", cls: "err" };
    const url = arg.trim();
    const res = level.waybackResults?.[url];
    if (!res) return { text: `wayback: no snapshots found for '${url}'`, cls: "dim" };

    const lines = [
      `Internet Archive — Wayback Machine`,
      `URL: ${url}`,
      `──────────────────────────────────────────`,
      `  Timestamp            Status   Snapshot URL`,
    ];
    res.forEach(s => {
      lines.push(`  ${String(s.timestamp).padEnd(20)} ${String(s.status).padEnd(8)} ${s.snapshot_url}`);
    });
    lines.push(``, `${res.length} snapshot${res.length === 1 ? "" : "s"} archived.`);
    return { text: lines.join("\n"), cls: "out" };
  },

  crtsh(level, arg) {
    if (!arg) return { text: "Usage: crtsh <domain>", cls: "err" };
    const domain = arg.trim();
    const res = level.crtshResults?.[domain];
    if (!res) return { text: `crtsh: no certificates found for '${domain}'`, cls: "dim" };

    const lines = [
      `crt.sh — certificate transparency search`,
      `Domain: ${domain}`,
      `──────────────────────────────────────────`,
      `  Common Name                                    Issuer                    Issued`,
    ];
    res.forEach(c => {
      lines.push(`  ${String(c.subdomain).padEnd(46)} ${String(c.issuer).padEnd(25)} ${c.issued}`);
    });
    lines.push(``, `${res.length} certificate${res.length === 1 ? "" : "s"} matched. Subdomains discovered via CT are public by design — anything in a TLS cert log is internet-discoverable.`);
    return { text: lines.join("\n"), cls: "out" };
  },

  theharvester(level, arg) {
    if (!arg) return { text: "Usage: theharvester <domain>", cls: "err" };
    const domain = arg.trim();
    const res = level.harvesterResults?.[domain];
    if (!res) return { text: `theharvester: no results found for '${domain}'`, cls: "dim" };

    const lines = [
      `theHarvester 4.4.4`,
      `Target domain: ${domain}`,
      `──────────────────────────────────────────`,
    ];
    if (res.emails?.length) {
      lines.push(``, `[*] Emails found (${res.emails.length}):`);
      res.emails.forEach(e => lines.push(`    ${e}`));
    }
    if (res.subdomains?.length) {
      lines.push(``, `[*] Subdomains found (${res.subdomains.length}):`);
      res.subdomains.forEach(s => lines.push(`    ${s}`));
    }
    if (res.hosts?.length) {
      lines.push(``, `[*] Hosts found (${res.hosts.length}):`);
      res.hosts.forEach(h => lines.push(`    ${h}`));
    }
    if (!res.emails?.length && !res.subdomains?.length && !res.hosts?.length) {
      lines.push(``, `[*] No artifacts found.`);
    }
    return { text: lines.join("\n"), cls: "warn" };
  },

  shodan(level, arg) {
    if (!arg) return { text: "Usage: shodan <query>", cls: "err" };
    const query = arg.trim();
    const res = level.shodanResults?.[query];
    if (!res) return { text: `shodan: no hosts found for query '${query}'`, cls: "dim" };

    const lines = [
      `Shodan — host search`,
      `Query: ${query}`,
      `──────────────────────────────────────────`,
    ];
    res.forEach(h => {
      lines.push(``);
      lines.push(`  IP:          ${h.ip}`);
      lines.push(`  Hostname:    ${h.hostname || "(none)"}`);
      lines.push(`  Org:         ${h.org || "(unknown)"}`);
      lines.push(`  Country:     ${h.country || "(unknown)"}`);
      lines.push(`  Ports:       ${(h.ports || []).join(", ") || "(none listed)"}`);
      if (h.banner) lines.push(`  Banner:      ${h.banner}`);
      if (h.tags) lines.push(`  Tags:        ${h.tags.join(", ")}`);
    });
    lines.push(``, `${res.length} host${res.length === 1 ? "" : "s"} matched.`);
    return { text: lines.join("\n"), cls: "warn" };
  },

  ipinfo(level, arg) {
    if (!arg) return { text: "Usage: ipinfo <ip>", cls: "err" };
    const ip = arg.trim();
    const res = level.ipinfoResults?.[ip];
    if (!res) return { text: `ipinfo: no information found for ${ip}`, cls: "dim" };

    const lines = [
      `ipinfo.io — ${ip}`,
      `──────────────────────────────────────────`,
      `  IP:          ${ip}`,
      `  Hostname:    ${res.hostname || "(none)"}`,
      `  City:        ${res.city || "(unknown)"}`,
      `  Region:      ${res.region || "(unknown)"}`,
      `  Country:     ${res.country || "(unknown)"}`,
      `  Loc:         ${res.loc || "(unknown)"}`,
      `  Org:         ${res.org || "(unknown)"}`,
      `  Postal:      ${res.postal || "(unknown)"}`,
      `  Timezone:    ${res.timezone || "(unknown)"}`,
    ];
    if (res.asn) lines.push(`  ASN:         ${res.asn}`);
    if (res.privacy) lines.push(`  Privacy:     ${res.privacy}`);
    return { text: lines.join("\n"), cls: "out" };
  },

  // github: source-control OSINT primitive. Three forms:
  //
  //   github <username>                    profile + public repos list
  //   github <username>/<repo>             repo metadata + file tree
  //   github <username>/<repo> file <path> show file contents at HEAD
  //
  // Level designers populate `level.github[username]` with:
  //   {
  //     profile: { name, bio, location, joined, publicRepos, followers,
  //                following },
  //     repos: {
  //       <repoName>: {
  //         description, language, created, updated, stars, forks,
  //         license, files: { "<path>": "<content>", ... }
  //       },
  //     },
  //   }
  //
  // The file map keys can include slashes for nested paths
  // (e.g., "src/foo.py"); the tree-display sorts paths alphabetically.
  github(level, arg) {
    if (!arg || arg === "-h" || arg === "--help") {
      return {
        text: [
          "Usage: github <user>",
          "       github <user>/<repo>",
          "       github <user>/<repo> file <path>",
          "",
          "Look up a GitHub user's public profile and repositories, then",
          "drill into a repo's file tree and view file contents at HEAD.",
          "",
          "Examples:",
          "  github octocat                            # profile + repos",
          "  github octocat/hello-world                # repo metadata + tree",
          "  github octocat/hello-world file README.md # file contents",
        ].join("\n"),
        cls: "out",
      };
    }

    const trimmed = arg.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const target = parts[0];

    // Profile lookup: `github <user>`
    if (!target.includes("/")) {
      const username = target;
      const userData = level.github?.[username];
      if (!userData) {
        return { text: `github: no GitHub profile for '${username}'`, cls: "dim" };
      }
      const p = userData.profile || {};
      const repos = userData.repos || {};
      const repoEntries = Object.entries(repos);

      const lines = [
        `github.com — user profile lookup`,
        `──────────────────────────────────────────`,
        `  Profile:        ${username}`,
        `  Name:           ${p.name || "(not set)"}`,
        `  Bio:            ${p.bio || "(no bio)"}`,
        `  Location:       ${p.location || "(not set)"}`,
        `  Joined:         ${p.joined || "(unknown)"}`,
        `  Public repos:   ${p.publicRepos ?? repoEntries.length}`,
        `  Followers:      ${p.followers ?? "(unknown)"}`,
        `  Following:      ${p.following ?? "(unknown)"}`,
      ];

      if (repoEntries.length === 0) {
        lines.push(``, `(no public repositories)`);
      } else {
        lines.push(``, `Public repositories:`);
        lines.push(`  Updated      Stars   Language     Name                       Description`);
        lines.push(`  ──────────   ─────   ──────────   ───────────────────────    ──────────────────────────────`);
        // Sort by updated desc
        const sorted = repoEntries.slice().sort((a, b) =>
          String(b[1].updated || "").localeCompare(String(a[1].updated || ""))
        );
        for (const [repoName, meta] of sorted) {
          const updated = String(meta.updated || "(unknown)").padEnd(11);
          const stars = String(meta.stars ?? 0).padStart(4);
          const lang = String(meta.language || "(none)").padEnd(11);
          const name = repoName.padEnd(26);
          const desc = meta.description || "";
          lines.push(`  ${updated}  ${stars}   ${lang}  ${name} ${desc}`);
        }
      }
      return { text: lines.join("\n"), cls: "out" };
    }

    // Split user/repo
    const slashIdx = target.indexOf("/");
    const username = target.slice(0, slashIdx);
    const repoName = target.slice(slashIdx + 1);
    const userData = level.github?.[username];
    if (!userData) {
      return { text: `github: no GitHub profile for '${username}'`, cls: "dim" };
    }
    const repo = userData.repos?.[repoName];
    if (!repo) {
      return { text: `github: repository '${username}/${repoName}' not found`, cls: "dim" };
    }

    // File-contents form: `github user/repo file <path>`
    if (parts.length >= 3 && parts[1] === "file") {
      const filepath = parts.slice(2).join(" ");
      const content = repo.files?.[filepath];
      if (content === undefined) {
        return { text: `github: file '${filepath}' not found in ${username}/${repoName}`, cls: "dim" };
      }
      const header = [
        `github.com — ${username}/${repoName} — ${filepath}`,
        `──────────────────────────────────────────`,
      ];
      return { text: header.join("\n") + "\n" + content, cls: "out" };
    }

    // Repo metadata + tree form: `github user/repo`
    const filesObj = repo.files || {};
    const fileList = Object.keys(filesObj).sort();

    const meta = [
      `github.com — repository`,
      `──────────────────────────────────────────`,
      `  Repository:     ${username}/${repoName}`,
      `  Description:    ${repo.description || "(no description)"}`,
      `  Language:       ${repo.language || "(unknown)"}`,
      `  Created:        ${repo.created || "(unknown)"}`,
      `  Updated:        ${repo.updated || "(unknown)"}`,
      `  Stars:          ${repo.stars ?? 0} · Forks: ${repo.forks ?? 0} · License: ${repo.license || "(none)"}`,
      ``,
      `Files at HEAD:`,
    ];
    if (fileList.length === 0) {
      meta.push(`  (no files)`);
    } else {
      for (const f of fileList) meta.push(`  ${f}`);
    }
    meta.push(``, `To view a file: github ${username}/${repoName} file <path>`);
    return { text: meta.join("\n"), cls: "out" };
  },
};
