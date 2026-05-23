// Cloud-track commands: fake AWS CLI surface.
//
// Single `aws` command with multi-service dispatch. Covers the
// subcommands a cloud-security audit actually uses:
//
//   aws s3 ls [s3://bucket]
//   aws s3 cp s3://bucket/key -
//   aws iam list-users
//   aws iam list-attached-user-policies --user-name <user>
//   aws iam get-policy --policy-arn <arn>
//   aws ec2 describe-instances
//   aws ec2 describe-security-groups
//   aws sts get-caller-identity
//
// Reads from `level.cloud = { s3, iam, ec2, sts }`. Treats
// `--no-sign-request` and `--profile <name>` as no-ops (the player
// can include them for realism without breaking the command).
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

    if (svc === "ec2" && sub === "describe-instances")        return awsEc2DescribeInstances(level);
    if (svc === "ec2" && sub === "describe-security-groups")  return awsEc2DescribeSecurityGroups(level);

    if (svc === "sts" && sub === "get-caller-identity")  return awsStsGetCallerIdentity(level);

    return awsHelp();
  },
};
