// Unit tests for tools/highlight.mjs.
//
// Run: node --test tools/
//
// WHAT THIS COVERS THAT THE BUILD DOES NOT
// ----------------------------------------
// The generator already asserts that highlighting is lossless: strip the
// spans, unescape, and you must get the input back. That catches a
// tokeniser which eats or duplicates characters, which is the worst
// failure because the reader copies the command out and it does not run.
//
// It cannot catch the second failure, which is quieter. If the prompt
// pattern stopped matching, every transcript in the corpus would be
// reclassified as a plain shell block. Text still round-trips perfectly.
// Output lines would just start being painted as if the reader had typed
// them, and nothing would fail. So classification is asserted here
// directly, along with the tokeniser edges that are easy to regress.
//
// Zero dependencies: node:test and node:assert are builtins, same rule
// as the generator itself.

import { test } from "node:test";
import assert from "node:assert/strict";

import { highlight } from "./highlight.mjs";

/** Strip token spans and unescape: the inverse the generator asserts on. */
function textOf(html) {
  return html
    .replace(/<span class="tok-[a-z]+">/g, "")
    .replace(/<\/span>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

/** All token classes present, in order of appearance. */
function classes(html) {
  return [...html.matchAll(/<span class="tok-([a-z]+)">/g)].map((m) => m[1]);
}

/** The text inside the first span of a given class. */
function tok(html, cls) {
  const m = new RegExp(`<span class="tok-${cls}">([^<]*)</span>`).exec(html);
  return m ? m[1] : null;
}

test("classification: a prompt makes it a transcript", () => {
  const r = highlight("daniel@host:~$ ls -la", "bash");
  assert.equal(r.kind, "transcript");
});

test("classification: bash with no prompt is a shell block", () => {
  const r = highlight("aws iam list-users --output table", "bash");
  assert.equal(r.kind, "shell");
});

test("classification: no info string stays plain", () => {
  // The 60 unlabelled blocks in the corpus are program output. Painting
  // them would assert they are code, which is the whole thing this
  // module exists to avoid.
  const r = highlight("UserName    Arn\nsloane      arn:aws:iam::1:user/s", "");
  assert.equal(r.kind, "plain");
  assert.equal(classes(r.html).length, 0);
});

test("classification: known source languages are highlighted", () => {
  for (const lang of ["yaml", "json", "javascript", "sql", "python", "go", "powershell"]) {
    assert.equal(highlight("x", lang).kind, "source", `${lang} should be source`);
  }
});

test("transcript: output lines are left completely alone", () => {
  // The regression that a bash grammar produces: reading uid=1042(daniel)
  // as three assignments and painting `groups` like a command.
  const r = highlight(
    "daniel@host:~$ id\nuid=1042(daniel) gid=1042(daniel) groups=1042(daniel)",
    "bash"
  );
  const [, output] = r.html.split("\n");
  assert.equal(output, "uid=1042(daniel) gid=1042(daniel) groups=1042(daniel)");
  assert.equal(classes(output).length, 0);
});

test("transcript: prompt is dimmed and the typed command is lit", () => {
  const r = highlight("daniel@host:~$ ls -la", "bash");
  assert.equal(tok(r.html, "prompt"), "daniel@host:~$");
  assert.equal(tok(r.html, "cmd"), "ls");
  assert.equal(tok(r.html, "flag"), "-la");
});

test("transcript: a root prompt (#) is recognised too", () => {
  const r = highlight("root@web-01:/var/www# whoami\nroot", "bash");
  assert.equal(r.kind, "transcript");
  assert.equal(tok(r.html, "prompt"), "root@web-01:/var/www#");
});

test("transcript: the typed password is treated as input", () => {
  const r = highlight("level3@linux's password: H@lton-Snapshot-2024-Q4", "bash");
  assert.equal(tok(r.html, "str"), "H@lton-Snapshot-2024-Q4");
});

test("shell: a pipe starts a new command, so both verbs are lit", () => {
  const r = highlight("cat /etc/passwd | grep -i root", "bash");
  const cmds = [...r.html.matchAll(/<span class="tok-cmd">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(cmds, ["cat", "grep"]);
});

test("shell: # inside a quoted string is not a comment", () => {
  const r = highlight('echo "a # not a comment" && ls', "bash");
  assert.equal(tok(r.html, "str"), "&quot;a # not a comment&quot;");
  assert.equal(classes(r.html).includes("com"), false);
});

test("shell: a trailing comment IS a comment", () => {
  const r = highlight("ls -la  # list everything", "bash");
  assert.equal(tok(r.html, "com"), "# list everything");
});

test("shell: sudo does not swallow the verb it runs", () => {
  // `cat x` lights cat; `sudo cat x` must light both, or the same word is
  // coloured two ways on consecutive lines. In level3@linux the whole
  // lesson is that `cat` is what runs as root.
  const r = highlight("daniel@host:~$ sudo cat /etc/shadow", "bash");
  const cmds = [...r.html.matchAll(/<span class="tok-cmd">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(cmds, ["sudo", "cat"]);
});

test("shell: a redirect's file descriptor is not mistaken for a verb", () => {
  // The trap the rule above opens: sudo keeps the verb slot open, -l is a
  // flag, so the next bare word is `2` from `2>/dev/null`.
  const r = highlight("daniel@host:~$ sudo -l 2>/dev/null", "bash");
  const cmds = [...r.html.matchAll(/<span class="tok-cmd">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(cmds, ["sudo"]);
});

test("shell: NAME=value before the verb is not the verb", () => {
  const r = highlight("DEBUG=1 ./run.sh", "bash");
  assert.equal(tok(r.html, "cmd"), "./run.sh");
});

test("escaping: HTML metacharacters never reach the output raw", () => {
  const r = highlight('grep "<script>alert(1)</script>" f.html', "bash");
  assert.equal(r.html.includes("<script>"), false);
  assert.ok(r.html.includes("&lt;script&gt;"));
});

test("escaping: ampersands are not double-escaped", () => {
  // &amp; must survive one round trip exactly. Getting the unescape order
  // wrong turns "&amp;lt;" into "<" and silently corrupts the text.
  const src = "echo '&amp;lt; already escaped'";
  assert.equal(textOf(highlight(src, "bash").html), src);
});

test("lossless: every mode returns the input text unchanged", () => {
  const cases = [
    ["bash", "daniel@host:~$ cat a.txt | wc -l\n42"],
    ["bash", "aws s3 ls --recursive s3://bucket/"],
    ["yaml", "# c\nkey: 'val'\nn: 42\nflag: true"],
    ["json", '{"a": [1, 2], "b": "x\\"y"}'],
    ["javascript", "const s = `a ${b} c`; // note\n/* block */"],
    ["sql", "SELECT * FROM t WHERE a = 'b' -- note"],
    ["", "plain output\n  indented\ttabbed"],
    ["bash", "echo 'unterminated"],
    ["bash", ""],
    ["bash", "$HOME ${X} $(id -u) $1 $?"],
  ];
  for (const [lang, src] of cases) {
    assert.equal(textOf(highlight(src, lang).html), src, `lossless failed for ${lang}: ${src}`);
  }
});

test("termination: pathological input does not hang or drop characters", () => {
  // Every branch of the tokeniser must consume at least one character.
  const nasty = ['"'.repeat(50), "$".repeat(50), "|&><;".repeat(20), "\\".repeat(30), "'"];
  for (const src of nasty) {
    for (const lang of ["bash", "yaml", "javascript"]) {
      assert.equal(textOf(highlight(src, lang).html), src, `dropped text: ${lang} ${src}`);
    }
  }
});
