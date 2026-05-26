// System-introspection commands: which / type / id / uname / date /
// uptime / hostname. Small, single-purpose utilities that mostly
// reflect engine state back at the player. None of them gate a
// puzzle; they exist for muscle-memory completeness (a player who
// types `uname -a` in a real shell expects to see a kernel line).
//
// All handlers follow the standard (level, arg, stdin?) →
// { text, cls } | null contract from js/commands/linux.js. None of
// these commands consume stdin — they ignore it cleanly when piped to.
//
// Optional per-level overrides (level.system schema field):
//   {
//     uname:    { sysname, nodename, release, version, machine },
//     id:       { uid, gid, groups: [{ id, name }] },
//     uptime:   { days, hours, minutes, users, load: [n, n, n] },
//   }
// All sub-fields are optional; sensible defaults are baked in below so
// every level "just works" without populating any of this.
//
// Circular import note: this module imports COMMANDS from
// commands/index.js (used by `which` and `type` to test command
// existence). ES module live bindings make this safe — system.js
// is loaded as part of building COMMANDS, but the binding inside
// the handler bodies is only DE-referenced at runtime, by which time
// COMMANDS is fully assembled.

import { currentLevelKey } from "../engine/state.js";
import { COMMANDS } from "./index.js";

// Same getCurrentUser helper as linux.js / resolve.js. Inlined here
// rather than imported to keep the module dependency graph shallow.
function getCurrentUser(level) {
  return level?.playerUser || currentLevelKey.split("@")[0];
}
function getCurrentHost() {
  return currentLevelKey.split("@")[1] || "localhost";
}

// Two-digit zero-pad for time strings.
function pad2(n) {
  return String(n).padStart(2, "0");
}

// Bash-style date format: "Tue May 26 13:55:42 UTC 2026". Pulled from
// the player's local time, which roughly mirrors what the player sees
// in their own terminal. The fake "UTC" suffix is intentional — every
// level's lore is timezone-agnostic, and showing the actual TZ would
// fight the in-world fiction.
function formatDate(d) {
  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mons = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dows[d.getDay()]} ${mons[d.getMonth()]} ${pad2(d.getDate())} ` +
         `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ` +
         `UTC ${d.getFullYear()}`;
}

export const systemCommands = {
  // which: locate a command in the shell's command table. Returns
  // `/usr/bin/<name>` for known commands (fabricated — we don't
  // actually have a /usr/bin) and the bash exit-with-no-output
  // behavior for unknowns (we print the standard error message
  // instead of staying silent, to match the visible UX a player
  // expects in a CTF terminal).
  which(_level, arg) {
    if (!arg) return { text: "Usage: which <command>", cls: "err" };
    const cmd = arg.trim().split(/\s+/)[0];
    if (COMMANDS[cmd] || cmd === "ssh") {
      return { text: `/usr/bin/${cmd}`, cls: "out" };
    }
    return { text: `${cmd}: command not found`, cls: "err" };
  },

  // type: command-classification mirror. Bash distinguishes builtins,
  // functions, aliases, keywords, and external binaries. We collapse
  // that to "shell builtin" since the engine doesn't have a meaningful
  // distinction between command flavors.
  type(_level, arg) {
    if (!arg) return { text: "Usage: type <command>", cls: "err" };
    const cmd = arg.trim().split(/\s+/)[0];
    if (COMMANDS[cmd] || cmd === "ssh") {
      return { text: `${cmd} is a shell builtin`, cls: "out" };
    }
    return { text: `type: ${cmd}: not found`, cls: "err" };
  },

  // id: print real / effective user-id, group, and supplementary
  // groups. Reads level.system.id if defined, otherwise synthesizes
  // sensible defaults from getCurrentUser.
  id(level) {
    const sys   = level?.system?.id || {};
    const user  = getCurrentUser(level);
    const uid   = sys.uid ?? 1000;
    const gid   = sys.gid ?? 1000;
    const groupName = level?.playerGroup || user;
    const groups = sys.groups || [{ id: gid, name: groupName }];
    const groupStr = groups.map(g => `${g.id}(${g.name})`).join(",");
    return {
      text: `uid=${uid}(${user}) gid=${gid}(${groupName}) groups=${groupStr}`,
      cls: "out",
    };
  },

  // uname: kernel / machine info. Flags compose like real uname:
  //   -s   kernel name (default)
  //   -n   nodename
  //   -r   kernel release
  //   -v   kernel version string
  //   -m   machine architecture
  //   -a   all of the above, in the canonical order
  uname(level, arg) {
    const sys = level?.system?.uname || {};
    const sysname  = sys.sysname  || "Linux";
    const nodename = sys.nodename || getCurrentHost();
    const release  = sys.release  || "5.15.0-d3cyph3r-generic";
    const version  = sys.version  || "#42-Ubuntu SMP D3CYPH3R Wed May 1 12:00:00 UTC 2026";
    const machine  = sys.machine  || "x86_64";

    const flags = (arg || "").split(/\s+/).filter(t => t.startsWith("-")).join("");
    if (flags.includes("a")) {
      return {
        text: `${sysname} ${nodename} ${release} ${version} ${machine} ${sysname.toLowerCase()}`,
        cls: "out",
      };
    }

    const parts = [];
    if (flags.includes("s")) parts.push(sysname);
    if (flags.includes("n")) parts.push(nodename);
    if (flags.includes("r")) parts.push(release);
    if (flags.includes("v")) parts.push(version);
    if (flags.includes("m")) parts.push(machine);
    if (parts.length === 0) parts.push(sysname); // bare `uname` → -s
    return { text: parts.join(" "), cls: "out" };
  },

  // date: current wall-clock time. Format mirrors GNU `date` with no
  // arg — fixed bash date format, no -u / -d / +FMT support (level
  // content doesn't need scriptable date math).
  date() {
    return { text: formatDate(new Date()), cls: "out" };
  },

  // uptime: a fake "system has been up this long" string. Reads
  // level.system.uptime to let a level customize the numbers (e.g.
  // a forensics scenario where uptime matters), otherwise produces
  // a stable plausible-looking output.
  uptime(level) {
    const sys     = level?.system?.uptime || {};
    const days    = sys.days    ?? 12;
    const hours   = sys.hours   ?? 3;
    const minutes = sys.minutes ?? 47;
    const users   = sys.users   ?? 1;
    const load    = sys.load    || [0.08, 0.05, 0.02];
    const now     = new Date();
    const timeStr = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    const upStr   = days > 0
      ? `${days} day${days === 1 ? "" : "s"}, ${pad2(hours)}:${pad2(minutes)}`
      : `${hours}:${pad2(minutes)}`;
    const userStr = `${users} user${users === 1 ? "" : "s"}`;
    return {
      text: ` ${timeStr} up ${upStr},  ${userStr},  load average: ${load.map(n => n.toFixed(2)).join(", ")}`,
      cls: "out",
    };
  },

  // hostname: print the host portion of the level key (`linux`,
  // `network`, `d3cyph3r` for the lobby, etc.). Uname's nodename
  // defaults to the same value, so the two are consistent unless a
  // level explicitly overrides one of them.
  hostname() {
    return { text: getCurrentHost(), cls: "out" };
  },
};
