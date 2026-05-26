// System-inspection commands: crontab, last, who, w, lsof, ss,
// journalctl, systemctl status, dmesg.
//
// Every command in this module is a pure reflector over a level-
// defined data structure. Level authors populate the schema field
// (documented at the top of `levels/linux.js`); the handlers render
// the data in real-bash output format.
//
// Why a new file rather than extending `system.js`? `system.js`
// holds tiny single-line reflectors (id / uname / date / etc.).
// The commands here are deeper investigation primitives — each one
// reads a richer schema and emits multi-line tabular output. Keeping
// them together makes the help reference cleaner (one "SYSTEM
// INSPECTION" group) and gives level authors a clear surface for
// host-compromise / persistence-detection puzzles.
//
// Schema fields read off the level object (all optional — every
// command degrades to a graceful empty-state message when its data
// is absent):
//
//   level.crontab        : { [username]: string }
//                          Cron table contents per user. Surfaced by
//                          `crontab -l` and `crontab -l -u <user>`.
//
//   level.lastLogins     : [{ user, tty, from, start, end, duration }]
//                          Login history surfaced by `last`. Use
//                          `end: "still logged in"` and a falsy
//                          duration to render the in-progress session
//                          line. Reboot pseudo-events use
//                          `user: "reboot", from: "<kernel ver>",
//                          tty: "system boot"`.
//
//   level.activeSessions : [{ user, tty, from, login, idle?, jcpu?,
//                             pcpu?, what? }]
//                          Live sessions surfaced by both `who` (basic
//                          form) and `w` (extended form, reading the
//                          optional fields).
//
//   level.openFiles      : [{ command, pid, user, fd, type, device,
//                             sizeOrOff, node, name }]
//                          Open-file table for `lsof`. The `-i` filter
//                          shows only network sockets (entries whose
//                          type is IPv4 / IPv6).
//
//   level.sockets        : [{ netid, state, recvq, sendq, localAddr,
//                             localPort, peerAddr, peerPort, process }]
//                          Socket table for `ss`. `-l` shows only
//                          LISTEN-state entries; `-t` filters to TCP
//                          (netid === "tcp"); `-u` filters to UDP.
//
//   level.journal        : [{ timestamp, host, unit, pid, message }]
//                          systemd journal for `journalctl`. `-u <unit>`
//                          filters to one unit; `-n N` keeps only the
//                          most-recent N entries.
//
//   level.systemdUnits   : { [unitName]: { loadState, activeState,
//                             subState, description, since, mainPid,
//                             command, tasks, memory, cpu, cgroup,
//                             logs } }
//                          Status text rendered by `systemctl status
//                          <unit>`. The `logs` field is an array of
//                          recent journal lines for the unit (rendered
//                          below the status block).
//
//   level.dmesg          : [{ timestamp, level, message }]
//                          Kernel ring buffer for `dmesg`. `timestamp`
//                          is the bracketed `[   1.234567]` decimal-
//                          seconds-since-boot string.

import { currentLevelKey } from "../engine/state.js";

function getCurrentUser(level) {
  return level?.playerUser || currentLevelKey.split("@")[0];
}

// Pad helper used by tabular output. Right-pads to width.
function pad(s, w) { return String(s).padEnd(w); }

// Parse a token-list arg into a small flags+positional structure. Used
// by the commands that take optional flags (-l, -u, -t, -n N).
function parseArgs(arg) {
  const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
  const flags = new Set();
  const named = {};   // -u root → named.u = "root"
  const positional = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      // --since "yesterday" — store as a single named entry
      const k = t.slice(2);
      if (tokens[i + 1] !== undefined && !tokens[i + 1].startsWith("-")) {
        named[k] = tokens[++i];
      } else {
        flags.add(k);
      }
    } else if (t.startsWith("-") && t.length > 1) {
      // Could be `-u root` (named) or `-l` (flag). Heuristic: if
      // there's a follower that doesn't start with `-`, treat as
      // named. Commands that take only flags (like ss -lt) opt out
      // by NOT calling parseArgs and parsing flags directly from
      // tokens themselves.
      const k = t.slice(1);
      if (k.length === 1 && tokens[i + 1] !== undefined && !tokens[i + 1].startsWith("-")) {
        named[k] = tokens[++i];
      } else {
        for (const ch of k) flags.add(ch);
      }
    } else {
      positional.push(t);
    }
  }
  return { flags, named, positional };
}

export const sysInspectCommands = {
  // crontab -l: print the current user's crontab. Real crontab also
  // supports -u <user> for root to read another user's table; we
  // honor that flag without any privilege check (the sandbox is
  // single-user).
  //
  //   crontab -l              print current user's crontab
  //   crontab -l -u root      print root's crontab (if level provides it)
  crontab(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.includes("-l")) {
      return { text: "Usage: crontab -l [-u <user>]", cls: "err" };
    }
    let user = getCurrentUser(level);
    const uIdx = tokens.indexOf("-u");
    if (uIdx !== -1 && tokens[uIdx + 1]) user = tokens[uIdx + 1];

    const ct = level?.crontab?.[user];
    if (!ct) {
      return { text: `no crontab for ${user}`, cls: "dim" };
    }
    return { text: ct, cls: "out" };
  },

  // last: login history. Lines emit in reverse-chronological order
  // (newest first) — same as real `last`. The 'wtmp begins' footer
  // is added for realism.
  last(level) {
    const entries = level?.lastLogins;
    if (!entries || entries.length === 0) {
      return { text: "wtmp begins (no recorded logins)", cls: "dim" };
    }
    // Column widths derived from the data so long usernames / TTYs
    // don't overflow the header.
    const uW  = Math.max(8, ...entries.map(e => (e.user  || "").length));
    const tW  = Math.max(8, ...entries.map(e => (e.tty   || "").length));
    const fW  = Math.max(16, ...entries.map(e => (e.from || "").length));
    const lines = entries.map(e => {
      const trail = e.end && e.end !== "still logged in"
        ? `${e.start} - ${e.end}  (${e.duration || ""})`
        : `${e.start || ""}   ${e.end || "still logged in"}`;
      return `${pad(e.user || "", uW)} ${pad(e.tty || "", tW)} ${pad(e.from || "", fW)} ${trail}`;
    });
    lines.push("", "wtmp begins " + (entries[entries.length - 1]?.start || "(unknown)"));
    return { text: lines.join("\n"), cls: "out" };
  },

  // who: list active sessions in the basic columnar format. `w` is the
  // richer variant (separate handler below) that adds the uptime
  // header and idle / JCPU / PCPU / WHAT columns.
  who(level) {
    const sessions = level?.activeSessions;
    if (!sessions || sessions.length === 0) {
      return { text: "(no active sessions)", cls: "dim" };
    }
    const uW = Math.max(8, ...sessions.map(s => (s.user || "").length));
    const tW = Math.max(8, ...sessions.map(s => (s.tty  || "").length));
    const lines = sessions.map(s =>
      `${pad(s.user || "", uW)} ${pad(s.tty || "", tW)} ${s.login || ""}${s.from ? " (" + s.from + ")" : ""}`
    );
    return { text: lines.join("\n"), cls: "out" };
  },

  // w: uptime header + per-session columnar listing including idle /
  // JCPU / PCPU / WHAT. Reads the same `level.activeSessions` array as
  // `who`; missing extended fields fall back to "-" / "0.00s".
  w(level) {
    const sessions = level?.activeSessions;
    const uptimeBits = level?.system?.uptime || { days: 12, hours: 3, minutes: 47, users: sessions?.length || 0, load: [0.08, 0.05, 0.02] };
    const now = new Date();
    const pad2 = n => String(n).padStart(2, "0");
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const upStr = uptimeBits.days > 0
      ? `${uptimeBits.days} day${uptimeBits.days === 1 ? "" : "s"}, ${pad2(uptimeBits.hours)}:${pad2(uptimeBits.minutes)}`
      : `${uptimeBits.hours}:${pad2(uptimeBits.minutes)}`;
    const userStr = `${uptimeBits.users || (sessions?.length || 0)} user${(uptimeBits.users || sessions?.length || 0) === 1 ? "" : "s"}`;
    const loadStr = (uptimeBits.load || [0,0,0]).map(n => Number(n).toFixed(2)).join(", ");
    const header = ` ${timeStr} up ${upStr},  ${userStr},  load average: ${loadStr}`;

    if (!sessions || sessions.length === 0) {
      return { text: header + "\n(no active sessions)", cls: "out" };
    }
    const uW = Math.max(8, ...sessions.map(s => (s.user || "").length));
    const tW = Math.max(8, ...sessions.map(s => (s.tty  || "").length));
    const fW = Math.max(16, ...sessions.map(s => (s.from || "").length));
    const lines = [
      header,
      `${pad("USER", uW)} ${pad("TTY", tW)} ${pad("FROM", fW)} LOGIN@   IDLE   JCPU   PCPU WHAT`,
      ...sessions.map(s =>
        `${pad(s.user || "", uW)} ${pad(s.tty || "", tW)} ${pad(s.from || "", fW)} ${pad(s.login || "", 8)} ${pad(s.idle || "-", 6)} ${pad(s.jcpu || "0.00s", 6)} ${pad(s.pcpu || "0.00s", 6)} ${s.what || "-"}`
      ),
    ];
    return { text: lines.join("\n"), cls: "out" };
  },

  // lsof: list open files. With -i, restrict to network sockets
  // (entries whose type is IPv4/IPv6). With -p <PID>, restrict to one
  // process. Without flags, dumps the whole table. The header is the
  // real lsof header for consistency with what a defender expects to
  // grep against.
  lsof(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    const onlyNet = tokens.includes("-i");
    let pidFilter = null;
    const pIdx = tokens.indexOf("-p");
    if (pIdx !== -1 && tokens[pIdx + 1]) pidFilter = String(tokens[pIdx + 1]);

    const open = level?.openFiles;
    if (!open || open.length === 0) {
      return { text: "(no open files visible from this shell)", cls: "dim" };
    }

    let rows = open;
    if (onlyNet)    rows = rows.filter(r => r.type === "IPv4" || r.type === "IPv6");
    if (pidFilter)  rows = rows.filter(r => String(r.pid) === pidFilter);
    if (rows.length === 0) {
      return { text: "(no open files match the filter)", cls: "dim" };
    }

    const cW = Math.max(7, ...rows.map(r => String(r.command || "").length));
    const pW = Math.max(5, ...rows.map(r => String(r.pid || "").length));
    const uW = Math.max(4, ...rows.map(r => String(r.user || "").length));
    const fW = Math.max(4, ...rows.map(r => String(r.fd || "").length));
    const tW = Math.max(4, ...rows.map(r => String(r.type || "").length));
    const dW = Math.max(6, ...rows.map(r => String(r.device || "").length));
    const sW = Math.max(8, ...rows.map(r => String(r.sizeOrOff || "").length));
    const nW = Math.max(4, ...rows.map(r => String(r.node || "").length));

    const lines = [
      `${pad("COMMAND", cW)} ${pad("PID", pW)} ${pad("USER", uW)} ${pad("FD", fW)} ${pad("TYPE", tW)} ${pad("DEVICE", dW)} ${pad("SIZE/OFF", sW)} ${pad("NODE", nW)} NAME`,
      ...rows.map(r =>
        `${pad(r.command || "", cW)} ${pad(r.pid || "", pW)} ${pad(r.user || "", uW)} ${pad(r.fd || "", fW)} ${pad(r.type || "", tW)} ${pad(r.device || "", dW)} ${pad(r.sizeOrOff || "", sW)} ${pad(r.node || "", nW)} ${r.name || ""}`
      ),
    ];
    return { text: lines.join("\n"), cls: "out" };
  },

  // ss: socket statistics. Flags compose:
  //   -l   listen-state only
  //   -t   TCP only
  //   -u   UDP only
  //   -n   numeric (engine output is already numeric; flag accepted)
  //   -a   include non-listening (default behavior already)
  //   -p   include process info (always shown in our output)
  ss(level, arg) {
    const flagText = (arg || "").trim().split(/\s+/).filter(t => t.startsWith("-")).join("");
    const onlyListen = flagText.includes("l");
    const onlyTcp    = flagText.includes("t");
    const onlyUdp    = flagText.includes("u");

    const socks = level?.sockets;
    if (!socks || socks.length === 0) {
      return { text: "(no sockets visible from this shell)", cls: "dim" };
    }
    let rows = socks;
    if (onlyListen) rows = rows.filter(r => r.state === "LISTEN");
    if (onlyTcp)    rows = rows.filter(r => r.netid === "tcp");
    if (onlyUdp)    rows = rows.filter(r => r.netid === "udp");
    if (rows.length === 0) {
      return { text: "(no sockets match the filter)", cls: "dim" };
    }

    const nW = Math.max(5, ...rows.map(r => String(r.netid || "").length));
    const sW = Math.max(6, ...rows.map(r => String(r.state || "").length));
    const laW = Math.max(20, ...rows.map(r => (`${r.localAddr || ""}:${r.localPort ?? ""}`).length));
    const paW = Math.max(20, ...rows.map(r => (`${r.peerAddr  || ""}:${r.peerPort  ?? ""}`).length));

    const lines = [
      `${pad("Netid", nW)} ${pad("State", sW)} Recv-Q Send-Q ${pad("Local Address:Port", laW)} ${pad("Peer Address:Port", paW)} Process`,
      ...rows.map(r => {
        const local = `${r.localAddr || ""}:${r.localPort ?? ""}`;
        const peer  = `${r.peerAddr  || ""}:${r.peerPort  ?? ""}`;
        return `${pad(r.netid || "", nW)} ${pad(r.state || "", sW)} ${pad(r.recvq ?? 0, 6)} ${pad(r.sendq ?? 0, 6)} ${pad(local, laW)} ${pad(peer, paW)} ${r.process || ""}`;
      }),
    ];
    return { text: lines.join("\n"), cls: "out" };
  },

  // journalctl: systemd journal. Common forms:
  //   journalctl                     dump entire journal
  //   journalctl -u sshd.service     filter to one unit
  //   journalctl -n 20               last 20 entries
  //   journalctl -r                  reverse (newest first)
  journalctl(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    let unit = null;
    let n = null;
    let reverse = false;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === "-u" && tokens[i + 1]) { unit = tokens[++i]; continue; }
      if (tokens[i] === "-n" && tokens[i + 1]) { n = parseInt(tokens[++i], 10) || null; continue; }
      if (tokens[i] === "-r" || tokens[i] === "--reverse") { reverse = true; continue; }
    }

    const entries = level?.journal;
    if (!entries || entries.length === 0) {
      return { text: "-- No entries --", cls: "dim" };
    }
    let rows = entries;
    if (unit) rows = rows.filter(e => e.unit === unit || e.unit === unit.replace(/\.service$/, ""));
    if (rows.length === 0) {
      return { text: `-- No entries for unit '${unit}' --`, cls: "dim" };
    }
    if (reverse) rows = [...rows].reverse();
    if (n && rows.length > n) rows = rows.slice(rows.length - n);

    const lines = rows.map(e => {
      const tag = e.unit ? `${e.unit}${e.pid ? "[" + e.pid + "]" : ""}` : (e.process || "");
      return `${e.timestamp || ""} ${e.host || ""} ${tag}: ${e.message || ""}`;
    });
    return { text: lines.join("\n"), cls: "out" };
  },

  // systemctl: bare entry point. We only implement `systemctl status
  // <unit>` for the level surface (start / stop / enable / restart are
  // OS-level actions the sandbox can't honor).
  systemctl(level, arg) {
    const tokens = (arg || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0 || tokens[0] !== "status") {
      return { text: "Usage: systemctl status <unit>", cls: "err" };
    }
    const unit = tokens[1];
    if (!unit) return { text: "Usage: systemctl status <unit>", cls: "err" };

    const units = level?.systemdUnits || {};
    // Accept both 'sshd' and 'sshd.service' as keys.
    const key = units[unit] ? unit : (units[unit + ".service"] ? unit + ".service" : null);
    if (!key) {
      return { text: `Unit ${unit}${unit.includes(".") ? "" : ".service"} could not be found.`, cls: "err" };
    }
    const u = units[key];
    const statusGlyph = u.activeState === "active" ? "●" :
                        u.activeState === "failed" ? "×" : "○";
    const lines = [
      `${statusGlyph} ${key} - ${u.description || ""}`,
      `     Loaded: ${u.loadState || "loaded"} (/usr/lib/systemd/system/${key}; ${u.enabled ? "enabled" : "disabled"}; preset: ${u.preset || "enabled"})`,
      `     Active: ${u.activeState || "inactive"} (${u.subState || "dead"})${u.since ? " since " + u.since : ""}`,
    ];
    if (u.mainPid) lines.push(`   Main PID: ${u.mainPid}${u.command ? " (" + u.command + ")" : ""}`);
    if (u.tasks)   lines.push(`      Tasks: ${u.tasks}`);
    if (u.memory)  lines.push(`     Memory: ${u.memory}`);
    if (u.cpu)     lines.push(`        CPU: ${u.cpu}`);
    if (u.cgroup)  lines.push(`     CGroup: ${u.cgroup}`);
    if (u.logs && u.logs.length) {
      lines.push("");
      for (const log of u.logs) lines.push(log);
    }
    return { text: lines.join("\n"), cls: "out" };
  },

  // df: disk free. Reads level.df (a pre-formatted multi-line string)
  // and prints it. `-h` is accepted but cosmetic — the level decides
  // how to format the numbers. No data → graceful empty-state.
  df(level) {
    const data = level?.df;
    if (!data) {
      return { text: "(disk-usage data unavailable from this shell)", cls: "dim" };
    }
    return { text: String(data).trimEnd(), cls: "out" };
  },

  // du: directory usage. `du -sh <path>` looks up the path in
  // level.du[path] (a pre-formatted line like "1.4G  /var/log").
  du(level, _arg, _stdin, argv) {
    const tokens = (argv || []).slice();
    const positional = tokens.filter(t => !t.startsWith("-"));
    const path = positional[0] || ".";
    const data = level?.du?.[path];
    if (data === undefined) {
      return { text: `(no du data for ${path})`, cls: "dim" };
    }
    return { text: String(data).trimEnd(), cls: "out" };
  },

  // free: memory + swap usage. Reads level.free (pre-formatted
  // string) and prints it. `-h` cosmetic.
  free(level) {
    const data = level?.free;
    if (!data) {
      return { text: "(memory usage data unavailable from this shell)", cls: "dim" };
    }
    return { text: String(data).trimEnd(), cls: "out" };
  },

  // dmesg: kernel ring buffer. Each entry has a bracketed seconds-
  // since-boot timestamp + a message. `-T` would humanize the time
  // but our level data is already friendly; we accept the flag and
  // ignore it for compatibility.
  dmesg(level) {
    const entries = level?.dmesg;
    if (!entries || entries.length === 0) {
      return { text: "(dmesg ring buffer empty or restricted)", cls: "dim" };
    }
    const lines = entries.map(e =>
      typeof e === "string" ? e : `[${e.timestamp || ""}] ${e.message || ""}`
    );
    return { text: lines.join("\n"), cls: "out" };
  },
};
