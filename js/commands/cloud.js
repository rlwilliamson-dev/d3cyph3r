// Cloud-track commands: fake AWS CLI surface + a minimal PostgreSQL
// client (`psql`) for RDS-adjacent puzzles.
//
// `aws` is a single command with multi-service dispatch. Covers the
// subcommands a cloud-security audit actually uses:
//
//   aws s3 ls [s3://bucket]
//   aws s3 cp s3://bucket/key -
//   aws iam list-users
//   aws iam list-attached-user-policies --user-name <user>
//   aws iam get-policy --policy-arn <arn>
//   aws iam list-access-keys --user-name <user>
//   aws iam get-access-key-last-used --access-key-id <id>
//   aws iam get-account-summary
//   aws ec2 describe-instances
//   aws ec2 describe-security-groups
//   aws sts get-caller-identity
//
// The three access-key / account-summary `iam` reads (added in
// v1.30.0 for level2@cloud) are the real AWS commands an auditor
// uses to answer "is this credential active, and when was it last
// used?" — list-access-keys reports Status + CreateDate but NOT the
// secret (AWS never returns a secret after creation), get-access-
// key-last-used reports the dormancy signal Trusted Advisor keys
// off, and get-account-summary surfaces account-wide posture flags
// like AccountAccessKeysPresent (a root access key — CIS 1.4).
//
// Reads from `level.cloud = { s3, iam, ec2, sts }`, where `iam` now
// also carries `accessKeys` (per-user key metadata), `accessKeyLast-
// Used` (per-key last-used record), and `accountSummary` (the
// SummaryMap). Treats
// `--no-sign-request` and `--profile <name>` as no-ops (the player
// can include them for realism without breaking the command).
//
// `psql` is a minimal PostgreSQL client supporting the meta-commands
// and SELECT patterns a DB-enumeration puzzle needs:
//
//   psql                                  Usage
//   psql --version                        Version string
//   psql "\l"                             List databases
//   psql -d <db> "\dt"                    List tables in <db>
//   psql -d <db> "SELECT * FROM <table>"  Query table
//   psql -d <db> "SELECT <cols> FROM <table> [LIMIT N]"
//   psql -c "<SQL>"                       Same as positional SQL
//   psql -h <host> -U <user> -d <db> "<SQL>"
//                                         Explicit conn — host/user
//                                         are ignored (engine uses
//                                         the pre-configured
//                                         connection); -d still
//                                         honored.
//
// Reads from `level.postgres = { defaultDb, connection, databases }`.
//
// Schema for each subkey is documented in levels/cloud.js.

function stripGlobalFlags(parts) {
  // Strip --no-sign-request (flag) and --profile <name> / --region <name>
  // / --output <fmt> (flag + value) from anywhere in the argv. Mirrors
  // how the real aws CLI parses these as global options.
  const out = [];
  const flagsWithValue = new Set(["--profile", "--region", "--output"]);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "--no-sign-request") continue;
    if (flagsWithValue.has(parts[i])) { i++; continue; }
    out.push(parts[i]);
  }
  return out;
}

function awsHelp() {
  return { cls: "err", text:
`usage: aws [options] <command> <subcommand> [parameters]

Available services:

  s3   ls [s3://bucket]
       cp s3://bucket/key <local|->

  iam  list-users
       list-attached-user-policies --user-name <user>
       get-policy --policy-arn <arn>
       list-access-keys --user-name <user>
       get-access-key-last-used --access-key-id <id>
       get-account-summary

  ec2  describe-instances
       describe-security-groups

  sts  get-caller-identity

Global options (parsed, no-op):
  --no-sign-request           skip request signing (anonymous access)
  --profile <name>            named profile from ~/.aws/config
  --region <name>             override default region
  --output <json|text|table>  output format (ignored — output is plain)` };
}

function awsS3Ls(level, rest) {
  const cloud = level.cloud || {};
  const target = rest[0];

  if (!target) {
    // List buckets at account scope
    const buckets = Object.keys(cloud.s3?.buckets || {});
    if (buckets.length === 0) return { text: "(no buckets visible with the current credentials)", cls: "dim" };
    const dateCol = cloud.s3?.bucketCreatedDate || "2026-01-15 14:23:51";
    return { text: buckets.map(b => `${dateCol} ${b}`).join("\n"), cls: "out" };
  }

  const m = target.match(/^s3:\/\/([^/]+)\/?(.*)/);
  if (!m) return { text: `aws: invalid S3 URI: ${target}`, cls: "err" };
  const [, bucket, prefix] = m;

  // Locked-down bucket: real AWS returns AccessDenied (the bucket exists,
  // but the caller's IAM / bucket policy / Public Access Block configuration
  // denies the ListObjectsV2 operation). This is the "correct response" for
  // a properly-secured bucket probed unauthenticated.
  if (cloud.s3?.deniedBuckets?.includes(bucket)) {
    return { text: `An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied`, cls: "err" };
  }

  const contents = cloud.s3?.buckets?.[bucket];
  if (!contents) {
    return { text: `An error occurred (NoSuchBucket) when calling the ListObjectsV2 operation: The specified bucket does not exist`, cls: "err" };
  }
  const entries = Object.entries(contents)
    .filter(([k]) => !prefix || k.startsWith(prefix))
    .map(([k, meta]) => ({
      date: meta?.date || "2026-01-15 14:23:51",
      size: meta?.size ?? String(meta?.content || "").length,
      key:  k,
    }));
  if (entries.length === 0) return { text: "(empty)", cls: "dim" };

  const sizeW = Math.max(...entries.map(e => String(e.size).length));
  const lines = entries.map(e => `${e.date}  ${String(e.size).padStart(sizeW)}  ${e.key}`);
  return { text: lines.join("\n"), cls: "out" };
}

function awsS3Cp(level, rest) {
  const [src, dst] = rest;
  if (!src || !dst) return { text: "Usage: aws s3 cp <source> <destination>", cls: "err" };
  const m = src.match(/^s3:\/\/([^/]+)\/(.+)/);
  if (!m) return { text: `aws: invalid S3 URI: ${src}`, cls: "err" };
  const [, bucket, key] = m;

  // Same access-denied path as ls: a locked-down bucket denies GetObject too.
  if (level.cloud?.s3?.deniedBuckets?.includes(bucket)) {
    return { text: `An error occurred (AccessDenied) when calling the GetObject operation: Access Denied`, cls: "err" };
  }

  const obj = level.cloud?.s3?.buckets?.[bucket]?.[key];
  if (!obj) {
    return { text: `An error occurred (NoSuchKey) when calling the GetObject operation: The specified key does not exist`, cls: "err" };
  }
  if (dst === "-") {
    return { text: obj.content || "(empty file)", cls: "out" };
  }
  return { text: `download: ${src} to ${dst}`, cls: "out" };
}

function awsIamListUsers(level) {
  const users = level.cloud?.iam?.users || [];
  if (users.length === 0) return { text: "(no users)", cls: "dim" };
  const userW = Math.max(...users.map(u => String(u.user_name).length));
  const lines = [
    `${"UserName".padEnd(userW)}  Arn`,
    `${"".padEnd(userW, "-")}  ${"".padEnd(60, "-")}`,
    ...users.map(u => `${String(u.user_name).padEnd(userW)}  ${u.arn}`),
  ];
  return { text: lines.join("\n"), cls: "out" };
}

function awsIamListAttachedUserPolicies(level, rest) {
  const idx = rest.indexOf("--user-name");
  if (idx < 0 || !rest[idx + 1]) {
    return { text: "Usage: aws iam list-attached-user-policies --user-name <user>", cls: "err" };
  }
  const user = rest[idx + 1];
  const policies = level.cloud?.iam?.attachedUserPolicies?.[user];
  if (!policies) {
    return { text: `An error occurred (NoSuchEntity) when calling the ListAttachedUserPolicies operation: The user with name ${user} cannot be found.`, cls: "err" };
  }
  if (policies.length === 0) return { text: "(no attached policies)", cls: "dim" };
  const lines = ["AttachedPolicies:"];
  policies.forEach(p => {
    lines.push(``);
    lines.push(`  PolicyName:  ${p.PolicyName}`);
    lines.push(`  PolicyArn:   ${p.PolicyArn}`);
  });
  return { text: lines.join("\n"), cls: "out" };
}

function awsIamGetPolicy(level, rest) {
  const idx = rest.indexOf("--policy-arn");
  if (idx < 0 || !rest[idx + 1]) {
    return { text: "Usage: aws iam get-policy --policy-arn <arn>", cls: "err" };
  }
  const arn = rest[idx + 1];
  const policy = level.cloud?.iam?.policies?.[arn];
  if (!policy) {
    return { text: `An error occurred (NoSuchEntity) when calling the GetPolicy operation: Policy not found`, cls: "err" };
  }
  const lines = [
    "Policy:",
    `  PolicyName:       ${policy.PolicyName || "(unknown)"}`,
    `  Arn:              ${arn}`,
    `  DefaultVersionId: ${policy.DefaultVersionId || "v1"}`,
    `  Description:      ${policy.Description || ""}`,
    `  Document:`,
  ];
  if (policy.Document) {
    const docLines = JSON.stringify(policy.Document, null, 2).split("\n");
    docLines.forEach(l => lines.push(`    ${l}`));
  } else {
    lines.push(`    (no document attached)`);
  }
  return { text: lines.join("\n"), cls: "out" };
}

// `aws iam list-access-keys --user-name <user>` — list the access
// keys provisioned for an IAM user. Mirrors the real API's
// AccessKeyMetadata: each entry carries the AccessKeyId, the Status
// (Active | Inactive), and the CreateDate — but NEVER the secret
// (AWS only ever returns a secret once, at creation time). Reads
// from `level.cloud.iam.accessKeys[user]`, an array of
// `{ AccessKeyId, Status, CreateDate }`. A user with no keys returns
// an empty AccessKeyMetadata; an unknown user returns NoSuchEntity
// (matching the other iam reads).
function awsIamListAccessKeys(level, rest) {
  const idx = rest.indexOf("--user-name");
  if (idx < 0 || !rest[idx + 1]) {
    return { text: "Usage: aws iam list-access-keys --user-name <user>", cls: "err" };
  }
  const user = rest[idx + 1];
  const keys = level.cloud?.iam?.accessKeys?.[user];
  if (!keys) {
    return { text: `An error occurred (NoSuchEntity) when calling the ListAccessKeys operation: The user with name ${user} cannot be found.`, cls: "err" };
  }
  if (keys.length === 0) return { text: "AccessKeyMetadata: (no access keys for this user)", cls: "dim" };
  const lines = ["AccessKeyMetadata:"];
  keys.forEach(k => {
    lines.push(``);
    lines.push(`  UserName:     ${user}`);
    lines.push(`  AccessKeyId:  ${k.AccessKeyId}`);
    lines.push(`  Status:       ${k.Status}`);
    lines.push(`  CreateDate:   ${k.CreateDate}`);
  });
  return { text: lines.join("\n"), cls: "out" };
}

// `aws iam get-access-key-last-used --access-key-id <id>` — the
// dormancy signal. Reports when an access key was last used to call
// AWS, by which service, in which region. This is the data AWS
// Trusted Advisor's "unused IAM credentials" check and the IAM
// credential report key off. A key can be Status: Active yet have a
// LastUsedDate two years in the past — that's the exact "dormant but
// not disabled" finding this level teaches. Reads from
// `level.cloud.iam.accessKeyLastUsed[accessKeyId]` =
// `{ UserName, LastUsedDate, ServiceName, Region }`. A key that has
// NEVER been used reports LastUsedDate absent + ServiceName/Region
// = "N/A" (we render any falsy field as "N/A", matching real AWS).
function awsIamGetAccessKeyLastUsed(level, rest) {
  const idx = rest.indexOf("--access-key-id");
  if (idx < 0 || !rest[idx + 1]) {
    return { text: "Usage: aws iam get-access-key-last-used --access-key-id <id>", cls: "err" };
  }
  const id = rest[idx + 1];
  const lu = level.cloud?.iam?.accessKeyLastUsed?.[id];
  if (!lu) {
    return { text: `An error occurred (NoSuchEntity) when calling the GetAccessKeyLastUsed operation: The Access Key with id ${id} cannot be found.`, cls: "err" };
  }
  const lines = [
    `UserName:  ${lu.UserName}`,
    `AccessKeyLastUsed:`,
    `  LastUsedDate:  ${lu.LastUsedDate || "N/A"}`,
    `  ServiceName:   ${lu.ServiceName || "N/A"}`,
    `  Region:        ${lu.Region || "N/A"}`,
  ];
  return { text: lines.join("\n"), cls: "out" };
}

// `aws iam get-account-summary` — account-wide IAM posture. Mirrors
// the real API's SummaryMap: a flat map of account-level counts and
// boolean flags (encoded as 0/1 by AWS). The security-relevant ones:
//   AccountAccessKeysPresent  1 = the root user has an access key
//                             (CIS AWS Foundations 1.4 — should be 0)
//   AccountMFAEnabled         0 = root MFA is off (CIS 1.5)
//   Users / Policies / etc.   inventory counts
// Reads the map verbatim from `level.cloud.iam.accountSummary` and
// renders it aligned. Order is preserved from the level data so the
// author controls which flag the player sees first.
function awsIamGetAccountSummary(level) {
  const summary = level.cloud?.iam?.accountSummary;
  if (!summary) {
    return { text: "(account summary not available with the current credentials)", cls: "dim" };
  }
  const keys = Object.keys(summary);
  if (keys.length === 0) return { text: "SummaryMap: (empty)", cls: "dim" };
  const w = Math.max(...keys.map(k => k.length));
  const lines = ["SummaryMap:"];
  keys.forEach(k => lines.push(`  ${(k + ":").padEnd(w + 1)}  ${summary[k]}`));
  return { text: lines.join("\n"), cls: "out" };
}

function awsEc2DescribeInstances(level) {
  const instances = level.cloud?.ec2?.instances || [];
  if (instances.length === 0) return { text: "(no instances)", cls: "dim" };
  const lines = ["Reservations:"];
  instances.forEach(i => {
    lines.push(``);
    lines.push(`  InstanceId:        ${i.InstanceId}`);
    lines.push(`  InstanceType:      ${i.InstanceType}`);
    lines.push(`  State:             ${i.State}`);
    lines.push(`  PublicIpAddress:   ${i.PublicIp || "(none)"}`);
    lines.push(`  PrivateIpAddress:  ${i.PrivateIp || "(none)"}`);
    lines.push(`  SecurityGroups:    ${(i.SecurityGroups || []).join(", ") || "(none)"}`);
    if (i.IamInstanceProfile) lines.push(`  IamInstanceProfile: ${i.IamInstanceProfile}`);
    if (i.Tags) {
      const tagLines = Object.entries(i.Tags).map(([k, v]) => `${k}=${v}`).join(", ");
      lines.push(`  Tags:              ${tagLines}`);
    }
  });
  return { text: lines.join("\n"), cls: "out" };
}

function awsEc2DescribeSecurityGroups(level) {
  const groups = level.cloud?.ec2?.securityGroups || [];
  if (groups.length === 0) return { text: "(no security groups)", cls: "dim" };
  const lines = ["SecurityGroups:"];
  groups.forEach(g => {
    lines.push(``);
    lines.push(`  GroupId:        ${g.GroupId}`);
    lines.push(`  GroupName:      ${g.GroupName}`);
    lines.push(`  Description:    ${g.Description || ""}`);
    lines.push(`  IngressRules:`);
    (g.IngressRules || []).forEach(r => {
      const portRange = r.fromPort === r.toPort ? String(r.fromPort) : `${r.fromPort}-${r.toPort}`;
      lines.push(`    ${String(r.protocol).padEnd(6)} port ${portRange.padEnd(11)} from ${(r.sources || []).join(", ") || "(none)"}`);
    });
  });
  return { text: lines.join("\n"), cls: "out" };
}

function awsStsGetCallerIdentity(level) {
  const sts = level.cloud?.sts;
  if (!sts) {
    return { text: `Unable to locate credentials. You can configure credentials by running "aws configure".`, cls: "err" };
  }
  const lines = [
    `UserId:   ${sts.UserId}`,
    `Account:  ${sts.Account}`,
    `Arn:      ${sts.Arn}`,
  ];
  return { text: lines.join("\n"), cls: "out" };
}

// ── psql (PostgreSQL client) ──────────────────────────────────────

const PSQL_VERSION_DEFAULT = "psql (PostgreSQL) 15.4";

function psqlUsage() {
  return { cls: "out", text:
`Usage: psql [OPTION]... ["<SQL or meta-command>"]

Connection options (host / user honored from the level's pre-
configured connection; -d may override the default database):
  -h, --host=HOSTNAME      database server host
  -U, --username=USERNAME  database user name
  -d, --dbname=DBNAME      database name to connect to
  -c, --command=COMMAND    run only single command and exit

Examples:
  psql "\\l"                          # list databases
  psql -d coverline_claims "\\dt"     # list tables in db
  psql -d coverline_claims "SELECT * FROM claims LIMIT 5"
  psql -h <host> -U <user> -d <db> "<SQL>"   # explicit conn` };
}

// Tokenize a psql command line, preserving "double-quoted" and
// 'single-quoted' substrings as single tokens. Inside a quoted
// string we only interpret \" / \' / \\ as escapes; everything else
// (including \l, \dt, \d, and other psql meta-command leaders) is
// passed through verbatim so the player can type `psql "\l"` and
// have the engine see the literal `\l`.
function psqlTokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === '"' || s[i] === "'") {
      const q = s[i++];
      let buf = "";
      while (i < s.length && s[i] !== q) {
        if (s[i] === "\\" && i + 1 < s.length && (s[i + 1] === q || s[i + 1] === "\\")) {
          // Only \" / \' / \\ are escapes inside the quoted string.
          buf += s[i + 1];
          i += 2;
        } else {
          buf += s[i++];
        }
      }
      i++; // skip close quote
      out.push(buf);
    } else {
      let buf = "";
      while (i < s.length && !/\s/.test(s[i])) buf += s[i++];
      out.push(buf);
    }
  }
  return out;
}

function psqlFormatTable(cols, rows, title) {
  const widths = cols.map((c, i) => Math.max(
    String(c).length,
    ...rows.map(r => String(r[i] ?? "").length),
  ));
  const header = cols.map((c, i) => " " + String(c).padEnd(widths[i] + 1)).join("|");
  const sep    = widths.map(w => "-".repeat(w + 2)).join("+");
  const data   = rows.map(r =>
    r.map((v, i) => " " + String(v ?? "").padEnd(widths[i] + 1)).join("|")
  );
  const lines = [];
  if (title) lines.push(title);
  lines.push(header, sep, ...data, ``, `(${rows.length} row${rows.length === 1 ? "" : "s"})`);
  return { text: lines.join("\n"), cls: "out" };
}

function psqlListDatabases(pg) {
  const dbs = Object.keys(pg.databases || {});
  const owner = pg.connection?.user || "postgres";
  const rows = dbs.map(d =>
    ["postgres", "template0", "template1"].includes(d)
      ? [d, "rdsadmin", "UTF8"]
      : [d, owner, "UTF8"]
  );
  return psqlFormatTable(["Name", "Owner", "Encoding"], rows, "                  List of databases");
}

function psqlListTables(dbObj) {
  const tables = Object.keys(dbObj.tables || {});
  if (tables.length === 0) {
    return { text: "Did not find any relations.", cls: "dim" };
  }
  const owner = "coverline_admin"; // matched to the lore default
  const rows = tables.map(t => ["public", t, "table", owner]);
  return psqlFormatTable(["Schema", "Name", "Type", "Owner"], rows, "            List of relations");
}

function psqlSelect(dbObj, sql) {
  // SELECT <cols> FROM <table> [LIMIT N] [;]
  const m = sql.match(/^select\s+(.+?)\s+from\s+(\w+)(?:\s+limit\s+(\d+))?\s*;?\s*$/i);
  if (!m) {
    const firstWord = sql.trim().split(/\s+/)[0];
    return { text: `ERROR: syntax error at or near "${firstWord}"\nLINE 1: ${sql}`, cls: "err" };
  }
  const [, colSpec, tableName, limitStr] = m;
  const table = dbObj.tables?.[tableName];
  if (!table) {
    return { text: `ERROR: relation "${tableName}" does not exist\nLINE 1: ${sql}`, cls: "err" };
  }
  let cols, colIdx;
  if (colSpec.trim() === "*") {
    cols = table.columns;
    colIdx = cols.map((_, i) => i);
  } else {
    cols = colSpec.split(",").map(c => c.trim());
    colIdx = cols.map(c => table.columns.indexOf(c));
    const badAt = colIdx.findIndex(i => i < 0);
    if (badAt >= 0) {
      return { text: `ERROR: column "${cols[badAt]}" does not exist\nLINE 1: ${sql}`, cls: "err" };
    }
  }
  let rows = table.rows.map(r => colIdx.map(i => r[i]));
  if (limitStr) rows = rows.slice(0, parseInt(limitStr, 10));
  return psqlFormatTable(cols, rows);
}

function psqlCmd(level, arg) {
  if (!arg) return psqlUsage();
  if (arg === "-h" || arg === "--help") return psqlUsage();
  if (arg === "--version") return { text: PSQL_VERSION_DEFAULT, cls: "out" };

  if (!level.postgres) {
    return { text: `psql: could not connect to server: Connection refused\n\tIs the server running and accepting TCP/IP connections?`, cls: "err" };
  }

  // Parse args: extract flag values, find the SQL string
  const tokens = psqlTokenize(arg);
  let db = level.postgres.defaultDb || "postgres";
  let sql = "";
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "-h" || t === "--host" || t === "-U" || t === "--username") {
      i++; continue; // value present, ignored (engine uses configured connection)
    }
    if (t.startsWith("--host=") || t.startsWith("--username=")) continue;
    if (t === "-d" || t === "--dbname") { db = tokens[++i] || db; continue; }
    if (t.startsWith("--dbname=")) { db = t.slice("--dbname=".length); continue; }
    if (t === "-c" || t === "--command") { sql = tokens[++i] || ""; continue; }
    if (t.startsWith("--command=")) { sql = t.slice("--command=".length); continue; }
    // Anything else is the SQL / meta-command (positional). Join rest.
    sql = tokens.slice(i).join(" ");
    break;
  }

  if (!sql) {
    // Real psql would drop into interactive mode here. Engine has
    // no persistent shell, so give the player a hint.
    return {
      text: [
        `psql (PostgreSQL) 15.4`,
        `Connected to: ${level.postgres.connection?.host || "(unknown host)"}`,
        `Database:     ${db}`,
        `User:         ${level.postgres.connection?.user || "(unknown user)"}`,
        ``,
        `(no command provided — run \`psql -h\` for usage, or pass a SQL`,
        ` string or meta-command like \`psql "\\\\l"\` to query)`,
      ].join("\n"),
      cls: "dim",
    };
  }

  const trim = sql.trim();

  // \l / \list — works regardless of -d (real psql ignores db context here)
  if (trim === "\\l" || trim === "\\list") {
    return psqlListDatabases(level.postgres);
  }

  // Need a valid db for everything below
  const dbObj = level.postgres.databases?.[db];
  if (!dbObj) {
    return { text: `psql: FATAL:  database "${db}" does not exist`, cls: "err" };
  }

  // \dt / \dt+ / \d
  if (trim === "\\dt" || trim === "\\dt+" || trim === "\\d") {
    return psqlListTables(dbObj);
  }

  // SELECT version()
  if (/^select\s+version\s*\(\s*\)\s*;?\s*$/i.test(trim)) {
    return { text: " version\n----------------------------------------------------------------\n PostgreSQL 15.4 on x86_64-pc-linux-gnu, compiled by gcc 7.5.0\n(1 row)", cls: "out" };
  }

  // SELECT ... FROM ...
  if (/^select\s/i.test(trim)) {
    return psqlSelect(dbObj, trim);
  }

  // Unsupported (DDL, INSERT, etc.)
  const firstWord = trim.split(/\s+/)[0];
  return { text: `ERROR: psql in this environment supports SELECT and meta-commands only (got "${firstWord}")`, cls: "err" };
}

export const cloudCommands = {
  aws(level, arg) {
    if (!arg) return awsHelp();
    const parts = stripGlobalFlags(arg.trim().split(/\s+/));
    const [svc, sub, ...rest] = parts;

    if (svc === "s3" && sub === "ls") return awsS3Ls(level, rest);
    if (svc === "s3" && sub === "cp") return awsS3Cp(level, rest);

    if (svc === "iam" && sub === "list-users")                   return awsIamListUsers(level);
    if (svc === "iam" && sub === "list-attached-user-policies")  return awsIamListAttachedUserPolicies(level, rest);
    if (svc === "iam" && sub === "get-policy")                   return awsIamGetPolicy(level, rest);
    if (svc === "iam" && sub === "list-access-keys")             return awsIamListAccessKeys(level, rest);
    if (svc === "iam" && sub === "get-access-key-last-used")     return awsIamGetAccessKeyLastUsed(level, rest);
    if (svc === "iam" && sub === "get-account-summary")          return awsIamGetAccountSummary(level);

    if (svc === "ec2" && sub === "describe-instances")        return awsEc2DescribeInstances(level);
    if (svc === "ec2" && sub === "describe-security-groups")  return awsEc2DescribeSecurityGroups(level);

    if (svc === "sts" && sub === "get-caller-identity")  return awsStsGetCallerIdentity(level);

    return awsHelp();
  },

  psql: psqlCmd,
};
