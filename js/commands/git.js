// git — local-repo inspection command.
//
// Reflects level-defined repo data (`level.gitRepos`). Unlocks the
// "credential committed to git history" puzzle pattern that's
// universal across cloud / web / OSINT engagements. The player runs
// `git log` to find a suspicious commit, `git show <hash>` to see
// what was actually committed, `git blame <file>` to trace authorship.
//
// Supported subcommands (read-only — no clone / commit / push):
//   git log [--oneline]              full or one-line log
//   git show <hash>                  full commit metadata + diff
//   git diff [<hash>] [<hash>]       diff between commits or vs HEAD
//   git status                       working-tree status
//   git blame <file>                 per-line authorship
//   git config --list                full config
//   git config <key>                 specific config key
//   git remote -v                    remote list with URLs
//   git branch                       branch list (mostly cosmetic)
//
// Repo lookup: the player's cwd is matched against the keys in
// `level.gitRepos`. The longest prefix match wins (so a level can
// have `repos/foo` and `repos/foo/subdir` and the right repo is
// picked based on where the player is). Outside any repo →
// "fatal: not a git repository".
//
// Schema (all sub-fields optional except commits / branch defaults):
//
//   level.gitRepos = {
//     "<repo-path>": {
//       branch?:  "main",
//       remotes?: [{ name, url }],
//       config?:  { "user.name": "...", "user.email": "...", ... },
//       commits:  [{ hash, abbrev?, author, email, date, message,
//                    body?, diff? }],          // newest first
//       status?:  { staged: [...], unstaged: [...], untracked: [...] },
//       blame?:   { [filepath]: [{ hash, author, date, line }] },
//     }
//   }
//
// Each commit's `diff` is rendered verbatim under `git show <hash>`;
// level authors write the diff in `--- a/path` / `+++ b/path` /
// `@@ -L,N +L,N @@` / `-removed` / `+added` format. The engine
// doesn't compute diffs from snapshots — level data is the source
// of truth.

import { currentPath, currentLevelKey } from "../engine/state.js";

// Match the player's cwd against the level's gitRepos keys. Returns
// { repoKey, repo } when inside a repo, null otherwise. Longest-prefix
// match — a repo at "repos/foo" wins over "repos" when the player is
// in repos/foo/src.
function findRepo(level) {
  if (!level?.gitRepos) return null;
  const cwd = currentPath.join("/");
  let best = null;
  for (const key of Object.keys(level.gitRepos)) {
    if (cwd === key || cwd.startsWith(key + "/") || key === "") {
      if (!best || key.length > best.length) best = key;
    }
  }
  if (best === null) return null;
  return { repoKey: best, repo: level.gitRepos[best] };
}

function notARepo() {
  return { text: "fatal: not a git repository (or any of the parent directories): .git", cls: "err" };
}

// Render one commit in the full `git log` format.
function renderLogEntry(c) {
  const lines = [];
  lines.push(`commit ${c.hash || ""}`);
  lines.push(`Author: ${c.author || "unknown"} <${c.email || "unknown@unknown"}>`);
  lines.push(`Date:   ${c.date || ""}`);
  lines.push("");
  lines.push("    " + (c.message || ""));
  if (c.body) {
    lines.push("");
    for (const ln of c.body.split("\n")) lines.push("    " + ln);
  }
  return lines.join("\n");
}

// Find a commit by full hash or abbrev. Substring match against
// either the hash or the abbreviated form (whichever was supplied).
function findCommit(repo, ref) {
  if (!repo.commits || !ref) return null;
  return repo.commits.find(c =>
    (c.hash && (c.hash === ref || c.hash.startsWith(ref))) ||
    (c.abbrev && (c.abbrev === ref || c.abbrev.startsWith(ref)))
  );
}

export const gitCommands = {
  git(level, arg, _stdin, argv) {
    const tokens = (argv && argv.length > 0) ? argv : (arg || "").trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) {
      return { text: "usage: git <command> [<args>]\n  log / show / diff / status / blame / config / remote / branch", cls: "err" };
    }

    const sub = tokens[0];
    const args = tokens.slice(1);

    const ctx = findRepo(level);
    if (!ctx && sub !== "--version") return notARepo();
    const { repo } = ctx || {};

    switch (sub) {
      case "--version":
        return { text: "git version 2.43.0", cls: "out" };

      case "log": {
        const commits = repo.commits || [];
        if (commits.length === 0) return { text: "fatal: your current branch 'main' does not have any commits yet", cls: "err" };
        const oneline = args.includes("--oneline");
        if (oneline) {
          const lines = commits.map(c => `${c.abbrev || (c.hash || "").slice(0, 7)} ${c.message || ""}`);
          return { text: lines.join("\n"), cls: "out" };
        }
        return { text: commits.map(renderLogEntry).join("\n\n"), cls: "out" };
      }

      case "show": {
        const ref = args[0];
        if (!ref) return { text: "usage: git show <commit>", cls: "err" };
        const c = findCommit(repo, ref);
        if (!c) return { text: `fatal: bad revision '${ref}'`, cls: "err" };
        const out = [renderLogEntry(c)];
        if (c.diff) { out.push(""); out.push(c.diff); }
        return { text: out.join("\n"), cls: "out" };
      }

      case "diff": {
        // Simplified: if a commit ref is given, render that commit's
        // diff (same as `git show` without the metadata block).
        const ref = args[0];
        if (ref) {
          const c = findCommit(repo, ref);
          if (!c) return { text: `fatal: bad revision '${ref}'`, cls: "err" };
          return { text: c.diff || "", cls: "out" };
        }
        // No ref → working-tree vs HEAD. Use level.gitRepos[].status.diff
        // when present; otherwise empty (clean tree).
        if (repo.workingTreeDiff) return { text: repo.workingTreeDiff, cls: "out" };
        return { text: "", cls: "out" };
      }

      case "status": {
        const branch = repo.branch || "main";
        const status = repo.status || { staged: [], unstaged: [], untracked: [] };
        const lines = [
          `On branch ${branch}`,
          `Your branch is up to date with 'origin/${branch}'.`,
          "",
        ];
        if (status.staged?.length) {
          lines.push("Changes to be committed:");
          lines.push('  (use "git restore --staged <file>..." to unstage)');
          for (const f of status.staged) lines.push(`\tmodified:   ${f}`);
          lines.push("");
        }
        if (status.unstaged?.length) {
          lines.push("Changes not staged for commit:");
          lines.push('  (use "git add <file>..." to update what will be committed)');
          for (const f of status.unstaged) lines.push(`\tmodified:   ${f}`);
          lines.push("");
        }
        if (status.untracked?.length) {
          lines.push("Untracked files:");
          lines.push('  (use "git add <file>..." to include in what will be committed)');
          for (const f of status.untracked) lines.push(`\t${f}`);
          lines.push("");
        }
        if (!status.staged?.length && !status.unstaged?.length && !status.untracked?.length) {
          lines.push("nothing to commit, working tree clean");
        }
        return { text: lines.join("\n"), cls: "out" };
      }

      case "blame": {
        const file = args[0];
        if (!file) return { text: "usage: git blame <file>", cls: "err" };
        const blame = repo.blame?.[file];
        if (!blame) return { text: `fatal: no such path '${file}' in HEAD`, cls: "err" };
        const lines = blame.map((b, i) =>
          `${(b.hash || "00000000").slice(0, 8)} (${b.author || "unknown"} ${b.date || ""} ${String(i + 1).padStart(3)}) ${b.line || ""}`
        );
        return { text: lines.join("\n"), cls: "out" };
      }

      case "config": {
        const cfg = repo.config || {};
        if (args.includes("--list") || args.includes("-l")) {
          const lines = Object.entries(cfg).map(([k, v]) => `${k}=${v}`);
          return { text: lines.join("\n") || "(no config set)", cls: "out" };
        }
        const key = args[0];
        if (!key) return { text: "usage: git config [--list] [<key>]", cls: "err" };
        const val = cfg[key];
        if (val === undefined) return { text: "", cls: "err" };  // bash git exits 1 silently
        return { text: String(val), cls: "out" };
      }

      case "remote": {
        const remotes = repo.remotes || [];
        if (args.includes("-v") || args.includes("--verbose")) {
          const lines = remotes.flatMap(r => [
            `${r.name}\t${r.url} (fetch)`,
            `${r.name}\t${r.url} (push)`,
          ]);
          return { text: lines.join("\n") || "(no remotes)", cls: "out" };
        }
        return { text: remotes.map(r => r.name).join("\n") || "(no remotes)", cls: "out" };
      }

      case "branch": {
        const branch = repo.branch || "main";
        return { text: `* ${branch}`, cls: "out" };
      }

      default:
        return { text: `git: '${sub}' is not a git command. See 'git --help'.`, cls: "err" };
    }
  },
};
