// Read-only filesystem error stubs.
//
// Real bash has dozens of commands that MODIFY state: chmod, chown,
// mv, cp, rm, mkdir, touch, ln, sudo, su, useradd, passwd, etc.
// D3CYPH3R's sandbox is intentionally read-only — the level fs is
// frozen at boot. But players type these commands constantly from
// muscle memory, and "command not found" is worse UX than "you're
// in a read-only audit context, here's the canonical error."
//
// This module provides stub handlers that print bash's actual error
// messages for each. The level data is unchanged — there's no
// fake-success path. Players quickly learn the sandbox is read-only
// without being mystified by missing commands.
//
// Forker note: if your fork adds a real read-write layer (sessionStorage-
// backed virtual fs), replace these stubs with the actual operations.
//
// Privileged ops (sudo, su) are stubbed similarly but use the
// "sorry, try again" + "1 incorrect password attempt" output to keep
// the in-world fiction of a real shell. They're not actually
// password-gated — the goal is "the command exists and produces
// believable output", not interactive auth.

const READONLY_FS_ERROR = "Read-only file system";

function readonly(cmd, target) {
  return {
    text: `${cmd}: cannot ${cmd === "rm" ? "remove" :
                              cmd === "mv" ? "move" :
                              cmd === "cp" ? "copy" :
                              cmd === "mkdir" ? "create directory" :
                              cmd === "touch" ? "touch" :
                              cmd === "chmod" ? "change permissions of" :
                              cmd === "chown" ? "change ownership of" :
                              "operate on"} '${target || "(target)"}': ${READONLY_FS_ERROR}`,
    cls: "err",
  };
}

function firstPositional(argv) {
  return (argv || []).find(t => !t.startsWith("-")) || "";
}

export const readonlyStubCommands = {
  // File-modifying operations — all return "Read-only file system"
  // with the bash error shape per command.
  chmod(_l, _a, _s, argv) { return readonly("chmod", firstPositional(argv)); },
  chown(_l, _a, _s, argv) { return readonly("chown", firstPositional(argv)); },
  mv(_l, _a, _s, argv)    { return readonly("mv",    firstPositional(argv)); },
  cp(_l, _a, _s, argv)    { return readonly("cp",    firstPositional(argv)); },
  rm(_l, _a, _s, argv)    { return readonly("rm",    firstPositional(argv)); },
  mkdir(_l, _a, _s, argv) { return readonly("mkdir", firstPositional(argv)); },
  rmdir(_l, _a, _s, argv) { return readonly("rmdir", firstPositional(argv)); },
  touch(_l, _a, _s, argv) { return readonly("touch", firstPositional(argv)); },
  ln(_l, _a, _s, argv)    { return readonly("ln",    firstPositional(argv)); },

  // sudo / su — print the canonical "incorrect password" line and
  // exit. The sandbox has no real privilege model; the goal is just
  // that `sudo -i`, `sudo cat /etc/shadow`, etc. don't trigger
  // "command not found". A player who needs root sees that the gate
  // exists; the lesson is in the level content, not in actually
  // bypassing the gate.
  sudo() {
    return { text: "[sudo] password for user:\nSorry, try again.\nsudo: 1 incorrect password attempt", cls: "err" };
  },
  su() {
    return { text: "Password:\nsu: Authentication failure", cls: "err" };
  },

  // useradd / passwd — write operations on the user db. Read-only.
  useradd(_l, _a, _s, argv) {
    return { text: `useradd: cannot lock /etc/passwd; try again later.\n(sandbox: this terminal is a read-only audit context)`, cls: "err" };
  },
  passwd() {
    return { text: `passwd: Authentication token manipulation error\n(sandbox: this terminal is a read-only audit context)`, cls: "err" };
  },
};
