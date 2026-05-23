// Network-recon commands: nmap, netstat, whois, dig.
// All data is per-level static — no real network calls.

export const networkCommands = {
  nmap(level, arg) {
    if (!arg)       return { text: "Usage: nmap [-sV] <host>", cls: "err" };
    if (!level.net) return { text: `nmap: Note: Host seems down. Try: nmap -sV ${arg}`, cls: "err" };

    const versionScan = arg.includes("-sV");
    const host  = arg.replace(/-sV\s*/g, "").trim();
    const ports = level.net[host];
    if (!ports) return { text: `nmap: ${host}: No route to host`, cls: "err" };

    const header = [
      `Starting Nmap 7.94 ( https://nmap.org )`,
      `Nmap scan report for ${host}`,
      `Host is up (0.0021s latency).`,
      "",
      versionScan
        ? "PORT      STATE     SERVICE     VERSION"
        : "PORT      STATE     SERVICE",
    ];
    const rows = ports.map(p => {
      const port    = String(p.port + "/tcp").padEnd(9);
      const state   = p.state.padEnd(9);
      const service = p.service.padEnd(11);
      return versionScan && p.version
        ? `${port} ${state} ${service} ${p.version}`
        : `${port} ${state} ${service}`;
    });
    const footer = ["", `Nmap done: 1 IP address (1 host up) scanned in 1.23 seconds`];
    return { text: [...header, ...rows, ...footer].join("\n"), cls: "warn" };
  },

  netstat(level) {
    if (!level.netstatData) return { text: "netstat: no network connections on this level", cls: "dim" };
    const header = "Proto  Local Address          Foreign Address        State        PID/Program";
    const sep    = "─────  ─────────────────────  ─────────────────────  ───────────  ─────────────";
    const rows = level.netstatData.map(c =>
      [c.proto.padEnd(6), c.local.padEnd(22), c.foreign.padEnd(22), c.state.padEnd(12), c.pid].join(" ")
    );
    return { text: [header, sep, ...rows].join("\n"), cls: "warn" };
  },

  whois(level, arg) {
    if (!arg) return { text: "Usage: whois <domain>", cls: "err" };
    if (!level.whoisData || !level.whoisData[arg]) {
      return { text: `whois: ${arg}: no WHOIS data available on this level`, cls: "err" };
    }
    return { text: level.whoisData[arg].join("\n"), cls: "out" };
  },

  dig(level, arg) {
    if (!arg) return { text: "Usage: dig <domain> [record_type]", cls: "err" };
    const parts   = arg.trim().split(/\s+/);
    const domain  = parts[0];
    const recType = (parts[1] || "A").toUpperCase();

    if (!level.dnsData || !level.dnsData[domain]) {
      return { text: `dig: ${domain}: NXDOMAIN — no records found`, cls: "err" };
    }
    const records = level.dnsData[domain];

    // AXFR is "transfer the whole zone." Real nameservers should restrict
    // this via TSIG or IP ACL; when they don't, an attacker gets the full
    // internal map. The level expresses an unrestricted zone by populating
    // `dnsData[domain].AXFR` with pre-formatted zone-file lines (each line
    // carries its own owner name, since AXFR returns subdomain records too
    // — the standard ANSWER SECTION format we use for single-type queries
    // doesn't fit). The handler dumps those lines verbatim between dig's
    // standard zone-transfer header and footer. If AXFR isn't populated,
    // simulate a properly-configured "REFUSED" response.
    if (recType === "AXFR") {
      if (!records.AXFR) {
        return {
          text: [
            `; <<>> DiG 9.18.4 <<>> ${domain} AXFR`,
            `;; Connection to ${domain}#53 failed: REFUSED`,
            `; Transfer failed.`,
          ].join("\n"),
          cls: "err",
        };
      }
      const out = [
        `; <<>> DiG 9.18.4 <<>> ${domain} AXFR`,
        `;; global options: +cmd`,
        "",
        ...records.AXFR,
        "",
        ";; Query time: 12 msec",
        ";; XFR size: " + records.AXFR.length + " records",
      ];
      return { text: out.join("\n"), cls: "warn" };
    }

    const lines = [
      `; <<>> DiG 9.18.4 <<>> ${domain} ${recType}`,
      `;; ANSWER SECTION:`,
      "",
    ];
    const types = recType === "ANY" ? Object.keys(records) : [recType];
    let found = false;
    types.forEach(t => {
      // Skip AXFR pseudo-records when iterating real types (e.g., ANY).
      if (t === "AXFR") return;
      const vals = records[t];
      if (!vals || vals.length === 0) return;
      found = true;
      vals.forEach(v => lines.push(`${domain.padEnd(24)} 300  IN  ${t.padEnd(5)} ${v}`));
    });
    if (!found) lines.push(`;; (no records of type ${recType})`);
    lines.push("", ";; Query time: 4 msec", `;; SERVER: 8.8.8.8`);
    return { text: lines.join("\n"), cls: "out" };
  },
};
