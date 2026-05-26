// Network-recon commands: nmap, netstat, whois, dig.
//
// Handler contract: every command exported here has the signature
//   (level, arg) → { text, cls } | null
// (See js/commands/linux.js for the broader contract description.)
//
// All data is per-level static — no real network calls happen. Levels
// fabricate plausible scan / WHOIS / DNS output so the player can
// pivot off the same information they would harvest in a real
// engagement.
//
// Schema fields this module reads off the level object:
//   level.net          { host: [{ port, state, service, version? }] }
//                      Per-host port table. Drives nmap output.
//                      Absent → nmap reports the host as down.
//   level.netstatData  [{ proto, local, foreign, state, pid }]
//                      Active-connection table for netstat. Absent →
//                      dim empty-state message.
//   level.whoisData    { domain: [line, line, ...] }
//                      Pre-formatted WHOIS lines. The lookup is exact
//                      string match — no zone-style fallback to a
//                      parent domain.
//   level.dnsData      { domain: { TYPE: [values], AXFR?: [lines] } }
//                      Per-domain record table. TYPE is uppercase
//                      (A / AAAA / MX / TXT / CNAME / NS / SOA / ...).
//                      AXFR is a special pseudo-type: its value is
//                      already-formatted zone-file lines (one per
//                      record) rather than a list of RDATA values,
//                      because zone transfers include subdomain rows
//                      that the standard ANSWER-SECTION single-name
//                      format can't represent.

export const networkCommands = {
  // nmap: simulated port scan. `-sV` enables version detection (renders
  // an extra VERSION column when the level provides p.version strings).
  // Header / footer are crafted to match Nmap 7.94 output closely so
  // walkthrough screenshots look authentic.
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

  // netstat: dump active connections as a fixed-width table. Mimics
  // Linux netstat's "-ant" output (proto / local / foreign / state /
  // PID). Levels that don't model running connections get a dim
  // empty-state message rather than a misleading empty table.
  netstat(level) {
    if (!level.netstatData) return { text: "netstat: no network connections on this level", cls: "dim" };
    const header = "Proto  Local Address          Foreign Address        State        PID/Program";
    const sep    = "─────  ─────────────────────  ─────────────────────  ───────────  ─────────────";
    const rows = level.netstatData.map(c =>
      [c.proto.padEnd(6), c.local.padEnd(22), c.foreign.padEnd(22), c.state.padEnd(12), c.pid].join(" ")
    );
    return { text: [header, sep, ...rows].join("\n"), cls: "warn" };
  },

  // whois: exact-match lookup in level.whoisData. No suffix-strip /
  // parent-domain fallback — if the level wants `whois sub.example.com`
  // and `whois example.com` to both return data, both keys must be
  // populated. Lines are joined verbatim, so levels control formatting
  // (typical structure: registrar block / registrant block / nameserver
  // block, separated by blank lines).
  whois(level, arg) {
    if (!arg) return { text: "Usage: whois <domain>", cls: "err" };
    if (!level.whoisData || !level.whoisData[arg]) {
      return { text: `whois: ${arg}: no WHOIS data available on this level`, cls: "err" };
    }
    return { text: level.whoisData[arg].join("\n"), cls: "out" };
  },

  // dig: DNS lookup. Now (v1.9.0) supports real-bash syntax beyond
  // the bare `dig domain [TYPE]` shape:
  //
  //   dig @8.8.8.8 example.com         — query a specific resolver
  //   dig -t MX example.com            — explicit type flag form
  //   dig -x 10.0.0.5                  — reverse PTR lookup
  //   dig example.com AXFR             — zone transfer (handled below)
  //   dig example.com +trace           — trace from root (faked sequence)
  //   dig example.com +short           — answer-only output
  //
  // Without a type arg, defaults to A. ANY iterates every populated
  // type for the domain (skipping the AXFR pseudo-type — it has a
  // different output format). AXFR is handled specially because the
  // zone-transfer output format includes subdomain owner names that
  // the standard ANSWER-SECTION format can't represent.
  dig(level, _arg, _stdin, argv) {
    const args = (argv || []).slice();
    if (args.length === 0) return { text: "Usage: dig [@server] [-t TYPE | -x IP] <domain> [TYPE] [+opt]", cls: "err" };

    // Parse flags. We tolerate any ordering, mirroring real dig.
    let server  = null;
    let recType = null;
    let domain  = null;
    let reverse = false;
    const dotOpts = new Set();   // +trace / +short / +noall / etc.

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith("@"))        { server  = a.slice(1); continue; }
      if (a.startsWith("+"))        { dotOpts.add(a);       continue; }
      if (a === "-t" && args[i+1])  { recType = args[++i].toUpperCase(); continue; }
      if (a === "-x" && args[i+1])  { reverse = true; domain = args[++i]; continue; }
      if (!domain)                  { domain = a; continue; }
      if (!recType)                 { recType = a.toUpperCase(); continue; }
    }
    if (!domain) return { text: "Usage: dig [@server] [-t TYPE | -x IP] <domain> [TYPE] [+opt]", cls: "err" };

    // Reverse-lookup: synthesize the in-addr.arpa name from the IP,
    // then look up PTR records on the level. Levels can populate
    // dnsData["5.0.0.10.in-addr.arpa"].PTR = ["host.example.com."]
    // or use the simpler dnsData[ip].PTR form (we check both).
    if (reverse) {
      const ip = domain;
      const ptrName = ip.split(".").reverse().join(".") + ".in-addr.arpa";
      const recs = (level.dnsData && (level.dnsData[ptrName] || level.dnsData[ip])) || null;
      if (!recs || !recs.PTR) {
        return { text: `dig: ${ip}: NXDOMAIN — no PTR record`, cls: "err" };
      }
      const lines = [
        `; <<>> DiG 9.18.4 <<>> -x ${ip}`,
        `;; ANSWER SECTION:`,
        "",
        ...recs.PTR.map(v => `${ptrName.padEnd(36)} 300  IN  PTR    ${v}`),
        "",
        ";; Query time: 6 msec",
        `;; SERVER: ${server || "8.8.8.8"}`,
      ];
      return { text: lines.join("\n"), cls: "out" };
    }

    if (!level.dnsData || !level.dnsData[domain]) {
      return { text: `dig: ${domain}: NXDOMAIN — no records found`, cls: "err" };
    }
    const records = level.dnsData[domain];
    if (!recType) recType = "A";

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

    // +trace: simulate the iterative resolution path from the root.
    // We synthesize plausible root + TLD answers, then hand off to
    // the authoritative answer. Pure flavor — useful for teaching
    // how DNS resolution actually works.
    if (dotOpts.has("+trace")) {
      const tld = (domain.split(".").slice(-1)[0] || "com").toLowerCase();
      const records2 = records;
      const lines = [
        `; <<>> DiG 9.18.4 <<>> ${domain} +trace`,
        `;; global options: +cmd`,
        `.                       86400   IN  NS   a.root-servers.net.`,
        `;; Received 239 bytes from 8.8.8.8#53(8.8.8.8) in 12 ms`,
        ``,
        `${tld}.                 86400   IN  NS   a.gtld-servers.net.`,
        `;; Received 489 bytes from 198.41.0.4#53(a.root-servers.net) in 32 ms`,
        ``,
        `${domain}.              86400   IN  NS   ns1.${domain}.`,
        `;; Received 137 bytes from 192.5.6.30#53(a.gtld-servers.net) in 48 ms`,
        ``,
      ];
      const vals = records2[recType] || records2.A || [];
      vals.forEach(v => lines.push(`${domain.padEnd(24)} 300  IN  ${recType.padEnd(5)} ${v}`));
      lines.push(`;; Received 67 bytes from 192.0.2.1#53(ns1.${domain}) in 18 ms`);
      return { text: lines.join("\n"), cls: "out" };
    }

    // +short: answer-only output (no header, no footer, no zone-file
    // padding). Real dig +short returns one value per line.
    if (dotOpts.has("+short")) {
      const types = recType === "ANY" ? Object.keys(records) : [recType];
      const out = [];
      types.forEach(t => {
        if (t === "AXFR") return;
        (records[t] || []).forEach(v => out.push(v));
      });
      if (out.length === 0) return { text: "", cls: "out" };
      return { text: out.join("\n"), cls: "out" };
    }

    const lines = [
      `; <<>> DiG 9.18.4 <<>> ${(server ? `@${server} ` : "")}${(recType !== "A" ? `-t ${recType} ` : "")}${domain}`,
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
    lines.push("", ";; Query time: 4 msec", `;; SERVER: ${server || "8.8.8.8"}`);
    return { text: lines.join("\n"), cls: "out" };
  },
};
