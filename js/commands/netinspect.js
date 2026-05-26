// Network-introspection commands: ip, arp, ping, traceroute, nslookup.
//
// Companion to `js/commands/sysinspect.js` — same pattern (pure
// reflectors over level-defined schema fields, real-bash output
// format), but the data is network-layer rather than process-layer.
// Together with the existing `nmap` / `netstat` / `whois` / `dig`
// (Network track) and `ss` / `lsof -i` (v1.6.0 sysinspect), the
// engine now covers most of the textbook Linux net-recon surface.
//
// Why a new file rather than extending `network.js`? `network.js`
// holds the Network TRACK's puzzle commands (nmap / dig / whois /
// netstat — outward-facing reconnaissance). The commands here are
// engine-wide local-machine introspection — `ip addr` tells you
// about THIS host's interfaces, regardless of which track you're
// in. Keeping them separate keeps the per-track help section focused.
//
// Schema fields read off the level object (all optional — every
// command degrades to a graceful empty-state message when its data
// is absent):
//
//   level.netInterfaces  : [{ name, mac, ipv4, ipv4Prefix, broadcast?,
//                             mtu?, state?, flags?, linkType? }]
//                          Local interface table for `ip addr`.
//                          Defaults: mtu 1500, state UP, flags
//                          BROADCAST,MULTICAST,UP,LOWER_UP for non-lo
//                          interfaces. `lo` is auto-injected if the
//                          level doesn't provide it explicitly.
//
//   level.routes         : [{ destination, via?, dev, proto?, scope?,
//                             src?, metric? }]
//                          Routing table for `ip route`. `destination`
//                          is either "default" or a CIDR like
//                          "10.0.7.0/24".
//
//   level.arpCache       : [{ hostname?, ip, mac, type?, dev }]
//                          ARP cache for `arp -a`. `type` defaults to
//                          "ether"; `hostname` is shown when present,
//                          IP-only otherwise (mirrors arp(8)).
//
//   level.pingResults    : { [host]: { resolvedIp?, rtts: number[],
//                                       ttl?, packetLoss?, reachable?,
//                                       error? } }
//                          Per-target ping outcomes. Without an entry
//                          for HOST, ping returns "Name or service
//                          not known". Set reachable=false + error to
//                          model "Destination Host Unreachable".
//
//   level.tracerouteResults : { [host]: { resolvedIp?, hops: [{ n,
//                                  hostname?, ip, rtts: number[] }] } }
//                          Per-target hop sequences. Use a hop with
//                          ip="* * *" (or rtts: null) to represent a
//                          silent hop in the path.
//
//   level.nslookupResults : { [host]: { server?, addresses: string[],
//                                        canonical?, error? } }
//                          DNS lookups for `nslookup`. Without an
//                          entry, returns NXDOMAIN.

// ─── Helpers ──────────────────────────────────────────────────────
function pad(s, w) { return String(s).padEnd(w); }

// Default loopback descriptor — injected if level.netInterfaces
// doesn't include one. Real `ip addr` always lists lo first.
const DEFAULT_LO = {
  name: "lo",
  index: 1,
  mac: "00:00:00:00:00:00",
  ipv4: "127.0.0.1",
  ipv4Prefix: 8,
  mtu: 65536,
  state: "UNKNOWN",
  flags: "LOOPBACK,UP,LOWER_UP",
  linkType: "loopback",
};

export const netInspectCommands = {
  // ip: small subset of iproute2's `ip` family. Supported forms:
  //   ip addr  / ip a   → list interfaces with their IPv4 addresses
  //   ip route / ip r   → print the kernel routing table
  // Any other subcommand prints a brief usage line.
  ip(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const sub = tokens[0];

    if (sub === "addr" || sub === "a") {
      const provided = level?.netInterfaces || [];
      const hasLo = provided.some(i => i.name === "lo");
      const ifaces = hasLo ? provided : [DEFAULT_LO, ...provided];

      const blocks = ifaces.map((i, idx) => {
        const index = i.index ?? (idx + 1);
        const flags = i.flags || (i.name === "lo"
          ? "LOOPBACK,UP,LOWER_UP"
          : "BROADCAST,MULTICAST,UP,LOWER_UP");
        const mtu = i.mtu ?? 1500;
        const state = i.state || "UP";
        const linkType = i.linkType || (i.name === "lo" ? "loopback" : "ether");
        const mac = i.mac || (i.name === "lo" ? "00:00:00:00:00:00" : "00:00:00:00:00:00");
        const brd = i.broadcast || (i.name === "lo" ? "00:00:00:00:00:00" : "ff:ff:ff:ff:ff:ff");

        const lines = [
          `${index}: ${i.name}: <${flags}> mtu ${mtu} qdisc fq_codel state ${state} group default qlen 1000`,
          `    link/${linkType} ${mac} brd ${brd}`,
        ];
        if (i.ipv4) {
          const prefix = i.ipv4Prefix ?? 24;
          const ipBroadcast = i.broadcast && i.broadcast.includes(".")
            ? ` brd ${i.broadcast}`
            : "";
          const scope = i.name === "lo" ? "host" : "global";
          lines.push(`    inet ${i.ipv4}/${prefix}${ipBroadcast} scope ${scope} ${i.name}`);
          lines.push("       valid_lft forever preferred_lft forever");
        }
        return lines.join("\n");
      });

      return { text: blocks.join("\n"), cls: "out" };
    }

    if (sub === "route" || sub === "r") {
      const routes = level?.routes;
      if (!routes || routes.length === 0) {
        return { text: "(routing table empty)", cls: "dim" };
      }
      const lines = routes.map(r => {
        const parts = [r.destination];
        if (r.via)    parts.push(`via ${r.via}`);
        if (r.dev)    parts.push(`dev ${r.dev}`);
        if (r.proto)  parts.push(`proto ${r.proto}`);
        if (r.scope)  parts.push(`scope ${r.scope}`);
        if (r.src)    parts.push(`src ${r.src}`);
        if (r.metric) parts.push(`metric ${r.metric}`);
        return parts.join(" ");
      });
      return { text: lines.join("\n"), cls: "out" };
    }

    return { text: "Usage: ip {addr|route}", cls: "err" };
  },

  // arp: print the ARP cache. Only the `-a` form (BSD-style entries)
  // is implemented — that's the form virtually every real-world
  // playbook actually uses. Linux iproute2's `ip neigh` is the modern
  // replacement, but `arp -a` lives on in muscle memory and
  // documentation.
  arp(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.includes("-a") && tokens.length > 0) {
      return { text: "Usage: arp -a", cls: "err" };
    }
    const cache = level?.arpCache;
    if (!cache || cache.length === 0) {
      return { text: "(arp cache empty)", cls: "dim" };
    }
    const lines = cache.map(e => {
      const name = e.hostname || "?";
      const type = e.type || "ether";
      return `${name} (${e.ip}) at ${e.mac} [${type}] on ${e.dev || "eth0"}`;
    });
    return { text: lines.join("\n"), cls: "out" };
  },

  // ping: ICMP echo (simulated). Renders 4 echo replies followed by
  // the standard summary block. Without a level.pingResults entry
  // for HOST, returns the canonical name-resolution error.
  //
  // For unreachable hosts, set reachable=false (and optionally error)
  // to render the "Destination Host Unreachable" pattern.
  ping(level, arg) {
    const host = (arg || "").trim().split(/\s+/)[0];
    if (!host) return { text: "Usage: ping <host>", cls: "err" };

    const result = level?.pingResults?.[host];
    if (!result) {
      return { text: `ping: ${host}: Name or service not known`, cls: "err" };
    }
    const ip = result.resolvedIp || host;
    const ttl = result.ttl ?? 64;

    if (result.reachable === false) {
      return {
        text: `PING ${host} (${ip}) 56(84) bytes of data.\n${result.error || "From " + ip + " icmp_seq=1 Destination Host Unreachable"}`,
        cls: "err",
      };
    }

    const rtts = result.rtts || [0.234, 0.187, 0.201, 0.195];
    const lines = [`PING ${host} (${ip}) 56(84) bytes of data.`];
    rtts.forEach((rtt, i) => {
      lines.push(`64 bytes from ${host} (${ip}): icmp_seq=${i + 1} ttl=${ttl} time=${rtt.toFixed(3)} ms`);
    });
    const min = Math.min(...rtts);
    const max = Math.max(...rtts);
    const avg = rtts.reduce((a, b) => a + b, 0) / rtts.length;
    const variance = rtts.reduce((a, b) => a + (b - avg) ** 2, 0) / rtts.length;
    const mdev = Math.sqrt(variance);
    const transmitted = rtts.length;
    const received = transmitted; // No simulated loss unless level says otherwise
    lines.push("");
    lines.push(`--- ${host} ping statistics ---`);
    lines.push(`${transmitted} packets transmitted, ${received} received, ${result.packetLoss ?? 0}% packet loss, time ${transmitted * 1000 + 45}ms`);
    lines.push(`rtt min/avg/max/mdev = ${min.toFixed(3)}/${avg.toFixed(3)}/${max.toFixed(3)}/${mdev.toFixed(3)} ms`);
    return { text: lines.join("\n"), cls: "out" };
  },

  // traceroute: print the hop sequence to HOST. Each hop emits the
  // standard 3-RTT line; a hop with no RTTs (or ip="* * *") prints
  // the silent-hop pattern.
  traceroute(level, arg) {
    const host = (arg || "").trim().split(/\s+/)[0];
    if (!host) return { text: "Usage: traceroute <host>", cls: "err" };
    const result = level?.tracerouteResults?.[host];
    if (!result) {
      return { text: `traceroute: ${host}: Name or service not known`, cls: "err" };
    }
    const ip = result.resolvedIp || host;
    const hops = result.hops || [];
    const lines = [`traceroute to ${host} (${ip}), 30 hops max, 60 byte packets`];
    for (const h of hops) {
      const name = h.hostname ? `${h.hostname} (${h.ip})` : (h.ip || "* * *");
      const rtts = (h.rtts && h.rtts.length)
        ? h.rtts.map(r => r.toFixed(3) + " ms").join("  ")
        : "* * *";
      lines.push(` ${String(h.n).padStart(2)}  ${name}  ${rtts}`);
    }
    return { text: lines.join("\n"), cls: "out" };
  },

  // nc: netcat. Sandbox supports `nc -zv host port` only — port-
  // reachability check. Reads level.ncResults[`${host}:${port}`]
  // (`{ open: bool, error? }`). Unconfigured targets default to
  // "Connection refused" so the playtest sees a deterministic error.
  nc(level, _arg, _stdin, argv) {
    const tokens = (argv || []).slice();
    const flags  = tokens.filter(t => t.startsWith("-")).join("");
    const positional = tokens.filter(t => !t.startsWith("-"));
    if (!flags.includes("z") || positional.length < 2) {
      return { text: "Usage: nc -zv <host> <port>", cls: "err" };
    }
    const host = positional[0];
    const port = positional[1];
    const key  = `${host}:${port}`;
    const r = level?.ncResults?.[key];
    if (r === undefined) {
      return { text: `nc: connect to ${host} port ${port} (tcp) failed: Connection refused`, cls: "err" };
    }
    if (r.open === false) {
      return { text: `nc: connect to ${host} port ${port} (tcp) failed: ${r.error || "Connection refused"}`, cls: "err" };
    }
    return { text: `Connection to ${host} ${port} port [tcp/*] succeeded!`, cls: "out" };
  },

  // host: simpler DNS lookup (companion to nslookup). Reads the same
  // `level.nslookupResults` map so both commands share schema.
  host(level, _arg, _stdin, argv) {
    const target = (argv && argv[0]) || "";
    if (!target) return { text: "Usage: host <name>", cls: "err" };
    const r = level?.nslookupResults?.[target];
    if (!r) return { text: `Host ${target} not found: 3(NXDOMAIN)`, cls: "err" };
    const lines = (r.addresses || []).map(a => `${target} has address ${a}`);
    if (r.canonical) lines.unshift(`${target} is an alias for ${r.canonical}.`);
    return { text: lines.join("\n") || `Host ${target} not found: 3(NXDOMAIN)`, cls: "out" };
  },

  // nslookup: DNS lookup. Returns the resolver address and the
  // resolved IPv4 record(s). Without a level.nslookupResults entry,
  // returns NXDOMAIN. Companion to the `dig` command on the network
  // track — same idea, friendlier output, no zone-transfer support.
  nslookup(level, arg) {
    const host = (arg || "").trim().split(/\s+/)[0];
    if (!host) return { text: "Usage: nslookup <host>", cls: "err" };
    const result = level?.nslookupResults?.[host];
    if (!result) {
      return {
        text: `Server:\t\t1.1.1.1\nAddress:\t1.1.1.1#53\n\n** server can't find ${host}: NXDOMAIN`,
        cls: "err",
      };
    }
    const server = result.server || "1.1.1.1";
    const lines = [
      `Server:\t\t${server}`,
      `Address:\t${server}#53`,
      "",
    ];
    if (result.canonical) {
      lines.push("Non-authoritative answer:");
      lines.push(`${host}\tcanonical name = ${result.canonical}`);
    } else {
      lines.push("Non-authoritative answer:");
    }
    lines.push(`Name:\t${host}`);
    for (const addr of (result.addresses || [])) {
      lines.push(`Address: ${addr}`);
    }
    return { text: lines.join("\n"), cls: "out" };
  },
};
