// Forensics commands: file (magic byte ID), strings, exif, evtx (Windows
// Event Log query), sha256sum, md5sum.

import { resolveFile } from "../fs/resolve.js";
import { currentPath } from "../engine/state.js";

export const forensicsCommands = {
  file(level, arg) {
    if (!arg) return { text: "Usage: file <filename>  OR  file *", cls: "err" };

    const identify = (name) => {
      if (level.filetypes?.[name]) return level.filetypes[name];
      if (name.endsWith(".txt"))   return "ASCII text";
      if (name.endsWith(".md"))    return "ASCII text";
      if (name.endsWith(".sh"))    return "POSIX shell script, ASCII text executable";
      if (name.endsWith(".py"))    return "Python script, ASCII text executable";
      if (name.endsWith(".log"))   return "ASCII text";
      if (name.endsWith(".bak"))   return "ASCII text";
      if (name.endsWith(".conf") || name.endsWith(".cfg")) return "ASCII text";
      if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "JPEG image data";
      if (name.endsWith(".png"))   return "PNG image data";
      if (name.endsWith(".pdf"))   return "PDF document";
      if (name.endsWith(".zip"))   return "Zip archive data";
      if (name.endsWith(".gz") || name.endsWith(".tgz")) return "gzip compressed data";
      if (name.endsWith("/"))      return "directory";
      return "data";
    };

    if (arg === "*") {
      const files = Object.keys(level.files).filter(f => !f.endsWith("/"));
      if (files.length === 0) return { text: "(no files)", cls: "dim" };
      const lines = files.map(f => `${f.padEnd(24)}: ${identify(f)}`);
      return { text: lines.join("\n"), cls: "out" };
    }

    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `file: ${arg}: No such file or directory`, cls: "err" };
    return { text: `${arg}: ${identify(file)}`, cls: "out" };
  },

  strings(level, arg) {
    if (!arg) return { text: "Usage: strings <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `strings: ${arg}: No such file`, cls: "err" };

    if (level.stringsOut?.[file]) {
      return { text: level.stringsOut[file].join("\n"), cls: "out" };
    }

    const content = String(level.files[file] || "");
    const printable = content.split("\n")
      .map(l => l.replace(/[^\x20-\x7e]/g, ""))
      .filter(l => l.trim().length >= 4);

    if (printable.length === 0) return { text: "(no printable strings found — file may be truly binary)", cls: "dim" };
    return { text: printable.join("\n"), cls: "out" };
  },

  exif(level, arg) {
    if (!arg) return { text: "Usage: exif <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files))    return { text: `exif: ${arg}: No such file`, cls: "err" };
    if (!level.exifData?.[file])   return { text: `exif: ${arg}: No EXIF data found (not an image, or metadata was stripped)`, cls: "dim" };
    return { text: level.exifData[file].join("\n"), cls: "out" };
  },

  // evtx: Windows Event Log query. Models the EZ Tools `EvtxECmd`-style
  // workflow without trying to parse a real .evtx binary. Pre-formatted
  // event blocks live in `level.evtxLogs[file]` as an array of
  // `{ id, body }` records. The command dumps everything by default; with
  // `-id <N>` it filters to a single Event ID.
  //
  // Common Security-channel IDs the level designer might use:
  //   4624  An account was successfully logged on
  //   4625  An account failed to log on
  //   4634  An account was logged off
  //   4663  An attempt was made to access an object
  //   4688  A new process has been created
  evtx(level, arg) {
    if (!arg || arg === "-h" || arg === "--help") {
      return {
        text: [
          "Usage: evtx [-id <EventID>] <file>",
          "",
          "Parse a Windows Event Log (.evtx) and print structured event",
          "records. With no flag, dumps every event in chronological order.",
          "With -id, filters to a single Event ID.",
          "",
          "Common Security-channel Event IDs:",
          "  4624   An account was successfully logged on",
          "  4625   An account failed to log on",
          "  4634   An account was logged off",
          "  4663   An attempt was made to access an object",
          "  4688   A new process has been created",
          "",
          "Examples:",
          "  evtx Security.evtx                # dump everything",
          "  evtx -id 4625 Security.evtx       # only failed logons",
          "  evtx -id 4688 Security.evtx       # only process creations",
        ].join("\n"),
        cls: "out",
      };
    }

    let filterId = null;
    let fileArg = arg;
    const parts = arg.trim().split(/\s+/).filter(Boolean);
    if (parts[0] === "-id") {
      if (parts.length < 3) {
        return { text: "evtx: -id requires both an Event ID and a file (try `evtx -h`)", cls: "err" };
      }
      const idVal = parseInt(parts[1], 10);
      if (Number.isNaN(idVal)) {
        return { text: `evtx: -id: "${parts[1]}" is not a valid Event ID`, cls: "err" };
      }
      filterId = idVal;
      fileArg = parts.slice(2).join(" ");
    }

    const file = resolveFile(level, fileArg, currentPath);
    if (!(file in level.files)) {
      return { text: `evtx: ${fileArg}: No such file or directory`, cls: "err" };
    }
    if (!level.evtxLogs?.[file]) {
      return { text: `evtx: ${fileArg}: not a recognized event log (no EVTX structure parsed)`, cls: "err" };
    }

    const events = level.evtxLogs[file];
    const matched = filterId === null ? events : events.filter(e => e.id === filterId);

    if (matched.length === 0) {
      return {
        text: `evtx: ${file}: no events with Event ID ${filterId} (${events.length} total events in file)`,
        cls: "dim",
      };
    }

    const sep = "═".repeat(67);
    const header = `Event log: ${file}\nTotal events: ${events.length}` +
      (filterId !== null
        ? `   (filtered to ID ${filterId}: ${matched.length} match${matched.length === 1 ? "" : "es"})`
        : "") +
      "\n";

    const blocks = matched.map(e => sep + "\n" + e.body).join("\n");
    return { text: header + blocks + "\n" + sep, cls: "out" };
  },

  // sha256sum / md5sum: chain-of-custody hashing. Levels can override the
  // computed hash via `level.fileHashes[file] = { sha256, md5 }` when the
  // scenario needs a specific value to compare against (the usual
  // forensic case — "does this hash match what the case file says?").
  //
  // The Web Crypto API is async-only; engine handlers are sync. So when
  // no override is set we fall back to a deterministic content-derived
  // placeholder (NOT a real cryptographic hash). For forensic levels
  // that genuinely compare hashes, the level designer supplies both
  // sides of the comparison via fileHashes — the deterministic fallback
  // exists to keep the command from crashing on files that don't have
  // designed hashes.
  sha256sum(level, arg) {
    if (!arg) return { text: "Usage: sha256sum <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `sha256sum: ${arg}: No such file or directory`, cls: "err" };
    const override = level.fileHashes?.[file]?.sha256;
    const hash = override || syntheticHash(String(level.files[file] || ""), 64);
    return { text: `${hash}  ${arg}`, cls: "out" };
  },

  md5sum(level, arg) {
    if (!arg) return { text: "Usage: md5sum <file>", cls: "err" };
    const file = resolveFile(level, arg, currentPath);
    if (!(file in level.files)) return { text: `md5sum: ${arg}: No such file or directory`, cls: "err" };
    const override = level.fileHashes?.[file]?.md5;
    const hash = override || syntheticHash(String(level.files[file] || ""), 32);
    return { text: `${hash}  ${arg}`, cls: "out" };
  },

  // sqlite3 (v1.23.0): read-only SQLite query interface for forensic
  // analysis of browser-artifact DBs (places.sqlite, History, Cookies)
  // and the SQLite-backed application databases that show up across
  // most modern systems. Real sqlite3 is a full RDBMS client; this is
  // a deliberately small subset focused on the SELECT/.tables/.schema
  // queries that matter for browser forensics teaching.
  //
  // Levels declare data via:
  //   level.sqlite_dbs[file] = {
  //     tables: {
  //       <tableName>: {
  //         schema:  "CREATE TABLE ...",   // one line, optional
  //         columns: ["col1", "col2", ...], // ordered for SELECT *
  //         rows:    [ { col1: ..., col2: ... }, ... ]
  //       }
  //     }
  //   }
  //
  // Supported surface:
  //   sqlite3 <file> ".tables"
  //   sqlite3 <file> ".schema [<table>]"
  //   sqlite3 <file> ".help"
  //   sqlite3 <file> "SELECT [DISTINCT] cols FROM table
  //                    [WHERE col = 'val' | col LIKE '%pat%']
  //                    [ORDER BY col [ASC|DESC]]
  //                    [LIMIT n]"
  //   sqlite3 <file> "SELECT COUNT(*) FROM table"
  //
  // Output flags:
  //   -header     include column names in the first row
  //   -column     render as an aligned table (default is pipe-separated,
  //               matching real sqlite3's .mode list)
  //
  // Not supported (intentional — keep teachable): JOIN, GROUP BY,
  // HAVING, subqueries, UNION, INSERT/UPDATE/DELETE, transactions,
  // interactive REPL, attached databases. Real forensic tooling
  // (SQLite Browser, EZ Tools' SQLECmd, Volatility plugins) handles
  // all of this; we're teaching query formation, not SQL breadth.
  sqlite3(level, arg, stdin, argv) {
    if (!arg) {
      return { text: "Usage: sqlite3 [-header | -column] <file> <command-or-query>  (try `sqlite3 --help`)", cls: "err" };
    }

    // Walk argv so quoted SQL strings stay intact (the `arg` string
    // collapses whitespace + quotes and is unreliable for SQL). The
    // dispatcher passes `argv.slice(cursor+1)` as the 4th parameter,
    // so argv[0] here is the FIRST arg after the command (the file or
    // first flag), NOT the command itself.
    const args = (argv || []).slice();
    let header = false, columnMode = false;
    while (args[0] === "-header" || args[0] === "-column") {
      if (args[0] === "-header") header = true;
      if (args[0] === "-column") columnMode = true;
      args.shift();
    }
    if (args.length < 2) {
      return { text: "sqlite3: need a file AND a command/query (try `sqlite3 --help`)", cls: "err" };
    }

    const fileArg = args[0];
    const cmd     = args.slice(1).join(" ").trim();
    if (!cmd) {
      return { text: "sqlite3: missing command or query", cls: "err" };
    }

    const file = resolveFile(level, fileArg, currentPath);
    if (!(file in level.files)) {
      return { text: `sqlite3: ${fileArg}: No such file or directory`, cls: "err" };
    }
    const db = level.sqlite_dbs?.[file];
    if (!db) {
      return { text: `sqlite3: ${fileArg}: file is not a recognized SQLite database`, cls: "err" };
    }

    // Dot-commands (.tables / .schema / .help)
    if (cmd.startsWith(".")) {
      const dot = cmd.split(/\s+/);
      const verb = dot[0].toLowerCase();

      if (verb === ".tables") {
        const names = Object.keys(db.tables || {}).sort();
        if (names.length === 0) return { text: "(no tables)", cls: "dim" };
        return { text: names.join("\n"), cls: "out" };
      }

      if (verb === ".schema") {
        const target = dot[1];
        if (target) {
          const t = db.tables?.[target];
          if (!t) return { text: `Error: no such table: ${target}`, cls: "err" };
          return { text: t.schema || `CREATE TABLE ${target}(/* schema omitted */);`, cls: "out" };
        }
        const names = Object.keys(db.tables || {}).sort();
        if (names.length === 0) return { text: "(no tables)", cls: "dim" };
        const all = names.map(n => db.tables[n].schema || `CREATE TABLE ${n}(/* schema omitted */);`);
        return { text: all.join("\n"), cls: "out" };
      }

      if (verb === ".help") {
        return {
          text: [
            ".tables             List tables in the database",
            ".schema [TABLE]     Show CREATE TABLE statement(s)",
            ".help               This help text",
            "",
            "For SELECT queries, run `sqlite3 --help` to see the supported SQL grammar.",
          ].join("\n"),
          cls: "out",
        };
      }

      return { text: `Error: unknown dot-command: ${verb}`, cls: "err" };
    }

    // SQL SELECT
    const result = executeSelect(db, cmd);
    if (result.error) {
      return { text: `Error: ${result.error}`, cls: "err" };
    }
    return { text: renderSqlRows(result.columns, result.rows, header, columnMode), cls: "out" };
  },
};

// Tiny SQL SELECT executor for the sqlite3 command. Grammar (case-
// insensitive keywords):
//
//   SELECT [DISTINCT] (* | <cols> | COUNT(*)) FROM <table>
//          [WHERE <col> = '<value>' | <col> LIKE '<pattern>'
//                | <col> = <number>]
//          [ORDER BY <col> [ASC|DESC]]
//          [LIMIT <n>]
//
// Returns { columns, rows } on success, { error } on parse/execute
// failure. The matching is regex-driven; we intentionally don't ship
// a full SQL parser. If the player's query falls outside this grammar
// they get an explicit "syntax error" pointing them at `sqlite3 --help`.
//
// The level designer guarantees row data shape via level.sqlite_dbs.
// No JOINs, no GROUP BY, no aggregates other than COUNT(*) — see the
// command-block comment above for the rationale.
function executeSelect(db, sql) {
  const trimmed = sql.trim().replace(/;\s*$/, "");

  const m = /^\s*SELECT\s+(DISTINCT\s+)?(.+?)\s+FROM\s+([A-Za-z_]\w*)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+([A-Za-z_]\w*)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?\s*$/i.exec(trimmed);
  if (!m) {
    return { error: "syntax error in SELECT query (try `sqlite3 --help` for supported grammar)" };
  }
  const [, distinct, colSpec, tableName, whereClause, orderCol, orderDir, limitStr] = m;

  const table = db.tables?.[tableName];
  if (!table) return { error: `no such table: ${tableName}` };

  let rows = Array.isArray(table.rows) ? [...table.rows] : [];

  // WHERE
  if (whereClause) {
    const w = parseWhere(whereClause.trim());
    if (w.error) return { error: w.error };
    rows = rows.filter(r => w.predicate(r));
  }

  // ORDER BY
  if (orderCol) {
    const sign = (orderDir || "ASC").toUpperCase() === "DESC" ? -1 : 1;
    rows.sort((a, b) => {
      const va = a[orderCol], vb = b[orderCol];
      if (va === undefined && vb === undefined) return 0;
      if (va === undefined) return -sign;
      if (vb === undefined) return sign;
      if (va < vb) return -sign;
      if (va > vb) return sign;
      return 0;
    });
  }

  // LIMIT
  if (limitStr) {
    const limit = parseInt(limitStr, 10);
    if (limit >= 0) rows = rows.slice(0, limit);
  }

  // Projection
  let columns, projectedRows;
  const cols = colSpec.trim();

  const countMatch = /^COUNT\s*\(\s*\*\s*\)\s*$/i.exec(cols);
  if (countMatch) {
    // COUNT(*) returns a single 1-row, 1-column result.
    columns = ["COUNT(*)"];
    projectedRows = [{ "COUNT(*)": rows.length }];
  } else if (cols === "*") {
    columns = table.columns || (rows[0] ? Object.keys(rows[0]) : []);
    projectedRows = rows;
  } else {
    columns = cols.split(",").map(c => c.trim()).filter(Boolean);
    projectedRows = rows.map(r => {
      const out = {};
      columns.forEach(c => { out[c] = r[c]; });
      return out;
    });
  }

  // DISTINCT
  if (distinct) {
    const seen = new Set();
    const unique = [];
    for (const row of projectedRows) {
      const key = columns.map(c => String(row[c])).join("\x00");
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(row);
      }
    }
    projectedRows = unique;
  }

  return { columns, rows: projectedRows };
}

// Parse the body of a WHERE clause. Supports: col = 'string', col =
// "string", col = number, col LIKE 'pattern' (with % and _ wildcards).
// Returns { predicate } on success, { error } otherwise.
function parseWhere(clause) {
  let m = /^([A-Za-z_]\w*)\s*=\s*'([^']*)'$/.exec(clause);
  if (m) {
    const [, col, val] = m;
    return { predicate: r => String(r[col] ?? "") === val };
  }
  m = /^([A-Za-z_]\w*)\s*=\s*"([^"]*)"$/.exec(clause);
  if (m) {
    const [, col, val] = m;
    return { predicate: r => String(r[col] ?? "") === val };
  }
  m = /^([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)$/.exec(clause);
  if (m) {
    const col = m[1], val = parseFloat(m[2]);
    return { predicate: r => Number(r[col]) === val };
  }
  m = /^([A-Za-z_]\w*)\s+LIKE\s+'([^']*)'$/i.exec(clause);
  if (m) {
    const col = m[1], pat = m[2];
    // Convert SQL LIKE pattern to a regex. % → .* ; _ → . ;
    // escape any other regex-special chars.
    const re = new RegExp("^" + pat
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/%/g, ".*")
      .replace(/_/g, ".") + "$", "i");
    return { predicate: r => re.test(String(r[col] ?? "")) };
  }
  return { error: `unsupported WHERE clause: ${clause}` };
}

// Render the SELECT result set. Defaults to pipe-separated rows (real
// sqlite3's `.mode list` default). `-header` adds column names as the
// first row. `-column` switches to aligned-table mode.
function renderSqlRows(columns, rows, header, columnMode) {
  if (rows.length === 0) return "(no rows)";

  if (columnMode) {
    const widths = columns.map(c =>
      Math.max(c.length, ...rows.map(r => String(r[c] ?? "").length))
    );
    const out = [];
    out.push(columns.map((c, i) => c.padEnd(widths[i])).join("  "));
    out.push(widths.map(w => "-".repeat(w)).join("  "));
    rows.forEach(r => {
      out.push(columns.map((c, i) => String(r[c] ?? "").padEnd(widths[i])).join("  "));
    });
    return out.join("\n");
  }

  const out = [];
  if (header) out.push(columns.join("|"));
  rows.forEach(r => {
    out.push(columns.map(c => String(r[c] ?? "")).join("|"));
  });
  return out.join("\n");
}

// Deterministic content-derived "hash" placeholder. NOT cryptographic.
// Same content → same hash; different content → different hash. That's
// the only property the level engine relies on. Real hashes belong in
// `level.fileHashes`.
function syntheticHash(content, length) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  let hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
  while (hex.length < length) hex += hex.split("").reverse().join("");
  return hex.slice(0, length);
}
