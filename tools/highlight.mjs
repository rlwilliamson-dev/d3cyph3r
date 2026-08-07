// Syntax highlighting for walkthrough code blocks, done at build time.
//
// WHY THIS IS NOT A SYNTAX HIGHLIGHTER
// ------------------------------------
// Reaching for highlight.js or Prism was the obvious move and it was the
// wrong one, because it misreads what these blocks are. Counted across
// the corpus:
//
//   181 ```bash blocks, of which 161 contain a shell prompt
//    60 blocks with NO info string
//    44 blocks of real source (yaml, json, javascript, sql, ...)
//
// So the dominant block is not bash source. It is a TRANSCRIPT: a prompt,
// a command the reader is meant to type, and the program's reply. Run a
// bash grammar over one of those and it does damage. In
//
//   daniel@halton-build-runner:~$ id
//   uid=1042(daniel) gid=1042(daniel) groups=1042(daniel)
//
// a bash lexer reads the second line as three variable assignments and
// paints `groups` like a command. That is not "imperfect highlighting",
// it is the page asserting something false about which half the reader is
// supposed to type.
//
// And the 60 unlabelled blocks are almost all program output too (AWS CLI
// tables, key-value dumps). Colouring output as if it were code is the
// same error in a different costume, so those stay plain on purpose.
//
// WHAT THIS DOES INSTEAD
// ----------------------
// It highlights the distinction a solve guide actually needs: what you
// type versus what comes back. A transcript gets a dimmed prompt, a
// highlighted command, and untouched output. That is the single most
// useful signal on the page and no off-the-shelf grammar emits it.
//
// Real source blocks get a modest pass (comments, strings, numbers,
// keywords). Deliberately shallow. These are illustrative snippets, and
// a half-correct deep parse is worse than an obviously-shallow one.
//
// SAFETY
// ------
// Tokenising happens on RAW text and escaping happens at emit, once, per
// token. The reverse order (escape the block, then regex over the HTML)
// is the classic way to produce broken markup: `&quot;` and `&amp;` start
// matching as string delimiters and entities get torn in half. Nothing
// here ever pattern-matches against already-escaped text.
//
// Exports: highlight(code, infostring) -> HTML string for <code>'s inside.
// Zero dependencies, Node builtins only, and deterministic: the same
// input must always produce the same bytes or the CI drift check fails.

/** HTML-escape. Must match the generator's own esc() exactly. */
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap escaped text in a token span, or emit bare text for class null. */
function span(text, cls) {
  if (!text) return "";
  return cls ? `<span class="${cls}">${esc(text)}</span>` : esc(text);
}

/** Join [{t, c}] segments into HTML. The single escape sink. */
function emit(segs) {
  return segs.map((s) => span(s.t, s.c)).join("");
}

// A shell prompt as these walkthroughs write them:
//
//   guest@d3cyph3r:~$ ssh level3@linux
//   daniel@halton-build-runner:~/logs$ ls -la
//   root@web-prod-01:/var/www# cat config.php
//
// user@host, an optional :path, then $ or # and a space. The path stops
// at the first $ or # so a prompt cannot swallow the command, and the
// trailing space is required so a bare "user@host:~$" with nothing after
// it is still recognised while an email address in output prose is not.
const PROMPT = /^([\w.-]+@[\w.-]+(?::[^\n$#]*)?[$#])( +)/;

// Continuation of a typed command: "> " or "$ " at line start. Also the
// masked-password convention, "<something>'s password: ...", which the
// walkthroughs print verbatim and which is typed, not output.
const PASSWORD_LINE = /^([^\n:]*'s password:)( *)(.*)$/;

// Commands that RUN another command. The verb after one of these is
// still a verb, so `sudo cat x` lights both words.
//
// Without this, `cat x` lights `cat` and `sudo cat x` does not, and the
// same word is coloured two different ways on consecutive lines of the
// same page. Worse for this corpus specifically: level3@linux turns on
// the reader noticing that `cat` is what runs as root. Painting it like
// an argument to sudo argues against the lesson.
//
// The corpus only ever uses the bare form (`sudo cat`, `sudo systemctl`)
// plus `sudo -l`, never `sudo -u USER cmd`. That matters because the
// simple rule below would light USER as the command. If that form is
// ever written, this needs to learn which flags take values.
const PREFIX_COMMANDS = new Set([
  "sudo",
  "doas",
  "env",
  "time",
  "nohup",
  "xargs",
  "watch",
  "nice",
  "command",
  "exec",
]);

/** Reserved words per language. Shallow by design. */
const KEYWORDS = {
  javascript:
    "await async break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield true false null undefined",
  json: "true false null",
  python:
    "and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield True False None self",
  go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false",
  sql:
    "select from where and or not null is in like between order by group having limit offset union all as join left right inner outer on insert into values update set delete create table drop alter add primary key foreign references distinct count sum avg min max desc asc",
  powershell:
    "if else elseif switch foreach for while do until break continue return function param begin process end try catch finally throw filter in true false null",
  yaml: "true false null yes no on off",
};

/** Case-insensitive keyword lookup for SQL and PowerShell. */
const CASELESS = new Set(["sql", "powershell"]);

/**
 * Tokenise one typed shell command into segments.
 *
 * Not a shell parser. It labels the first bare word as the command, then
 * flags, quoted strings, comments, variables, operators and numbers. The
 * order of the branches below is the whole correctness story: comments
 * and strings are consumed before anything can look inside them, so a `#`
 * in a quoted string does not start a comment and a flag inside quotes
 * stays a string.
 *
 * @param {string} src   raw command text (no prompt, no newline)
 * @param {boolean} first  true if the next bare word is the command name
 * @returns {{t:string,c:(string|null)}[]}
 */
function shellSegments(src, first = true) {
  const out = [];
  let i = 0;
  let wantCommand = first;

  const push = (t, c) => {
    if (t) out.push({ t, c });
  };

  while (i < src.length) {
    const rest = src.slice(i);
    let m;

    // Whitespace passes through untouched so indentation survives.
    if ((m = /^\s+/.exec(rest))) {
      push(m[0], null);
      i += m[0].length;
      continue;
    }

    // Comment to end of line. Only when # starts a word, so that a URL
    // fragment or an "id#1" in an argument is not eaten.
    if (rest[0] === "#" && (i === 0 || /\s/.test(src[i - 1]))) {
      push(rest, "tok-com");
      break;
    }

    // Quoted strings, single and double. An unterminated quote consumes
    // the remainder rather than falling through and being re-scanned as
    // operators, which is what a transcript that shows a broken command
    // actually looks like.
    if (rest[0] === '"' || rest[0] === "'") {
      const q = rest[0];
      let j = 1;
      while (j < rest.length && rest[j] !== q) {
        if (rest[j] === "\\" && q === '"') j++;
        j++;
      }
      const lit = rest.slice(0, Math.min(j + 1, rest.length));
      push(lit, "tok-str");
      i += lit.length;
      wantCommand = false;
      continue;
    }

    // Variables: $NAME, ${NAME}, $(cmd), $1, $?
    if ((m = /^\$(\{[^}]*\}|\([^)]*\)|[A-Za-z_][\w]*|[0-9]+|[?$#@*!-])/.exec(rest))) {
      push(m[0], "tok-var");
      i += m[0].length;
      wantCommand = false;
      continue;
    }

    // Flags: -x, -xvf, --long, --long=value (value tokenised separately).
    if ((m = /^--?[A-Za-z][\w-]*/.exec(rest)) && (i === 0 || /\s/.test(src[i - 1]))) {
      push(m[0], "tok-flag");
      i += m[0].length;
      wantCommand = false;
      continue;
    }

    // Operators. A pipe or && ends the current command, so the next bare
    // word is a verb again: `cat x | grep y` colours both.
    //
    // A REDIRECT does not. What follows `>` is a filename, so treating it
    // like a pipe paints /dev/null in `sudo -l 2>/dev/null` as a command.
    // Splitting on whether the operator contains < or > covers `>`, `>>`,
    // `<`, and `2>&1` without enumerating them.
    if ((m = /^(\|\||&&|[|;&><]+)/.exec(rest))) {
      push(m[0], "tok-op");
      i += m[0].length;
      wantCommand = !/[<>]/.test(m[0]);
      continue;
    }

    // A bare word: command name if we are expecting one, else an argument.
    if ((m = /^[^\s"'|;&><$#]+/.exec(rest))) {
      const word = m[0];
      // A bare number is never a command, even where one is expected.
      // `sudo -l 2>/dev/null` reaches here with the verb slot still open
      // (sudo is a prefix command and -l is a flag), and without this the
      // redirect's file descriptor gets painted as the verb.
      if (wantCommand && !/^\d+$/.test(word)) {
        // NAME=value before the verb is an env assignment, not the verb.
        if (/^[A-Za-z_][\w]*=/.test(word)) {
          const eq = word.indexOf("=");
          push(word.slice(0, eq + 1), "tok-var");
          push(word.slice(eq + 1), "tok-str");
        } else {
          push(word, "tok-cmd");
          // `sudo cat x`: the word after a prefix command is still a verb.
          wantCommand = PREFIX_COMMANDS.has(word);
        }
      } else if (/^\d[\d.]*$/.test(word)) {
        push(word, "tok-num");
      } else {
        push(word, null);
      }
      i += word.length;
      continue;
    }

    // Anything unmatched advances by one so the loop always terminates.
    push(src[i], null);
    i++;
  }

  return out;
}

/**
 * Render a terminal transcript.
 *
 * Line-oriented, because that is how a transcript is structured: a line
 * either starts with a prompt (so the rest is typed) or it does not (so
 * it is output). Guessing per-token instead is exactly the mistake that
 * makes a bash grammar paint program output as code.
 */
function renderTranscript(code) {
  const lines = code.split("\n");
  const out = [];

  for (const line of lines) {
    const p = PROMPT.exec(line);
    if (p) {
      const typed = line.slice(p[0].length);
      out.push(
        emit([
          { t: p[1], c: "tok-prompt" },
          { t: p[2], c: null },
          ...shellSegments(typed, true),
        ])
      );
      continue;
    }

    // "level3@linux's password: H@lton-..." is printed by ssh but the
    // secret after it is typed, so it reads as input and is coloured so.
    const pw = PASSWORD_LINE.exec(line);
    if (pw && pw[3]) {
      out.push(
        emit([
          { t: pw[1], c: "tok-prompt" },
          { t: pw[2], c: null },
          { t: pw[3], c: "tok-str" },
        ])
      );
      continue;
    }

    // Everything else is program output. Left completely alone: no class,
    // no spans, just escaped text.
    out.push(esc(line));
  }

  return out.join("\n");
}

/** Render a block of bare shell commands (no prompts). */
function renderShell(code) {
  return code
    .split("\n")
    .map((line) => emit(shellSegments(line, true)))
    .join("\n");
}

/**
 * Render a source block: comments, strings, numbers, keywords.
 *
 * One tokeniser for every language, parameterised by comment syntax and
 * keyword list. Seven languages appear across the corpus and six of them
 * appear once or twice; a per-language grammar for those would be a lot
 * of surface for almost no reader.
 */
function renderSource(code, lang) {
  const words = KEYWORDS[lang] || "";
  const caseless = CASELESS.has(lang);
  const kw = new Set(words.split(/\s+/).filter(Boolean));

  // YAML and the shell family use #; the C family uses //. Keeping this a
  // lookup rather than a regex alternation means a # inside a JS string
  // is never even considered as a comment start.
  const hashComment = lang === "yaml" || lang === "powershell" || lang === "python";
  const slashComment =
    lang === "javascript" || lang === "json" || lang === "go" || lang === "sql";

  const segs = [];
  let i = 0;
  const push = (t, c) => {
    if (t) segs.push({ t, c });
  };

  while (i < code.length) {
    const rest = code.slice(i);
    let m;

    if ((m = /^\s+/.exec(rest))) {
      push(m[0], null);
      i += m[0].length;
      continue;
    }

    // Comments first, so nothing inside one is tokenised further.
    if (hashComment && rest[0] === "#") {
      const end = rest.indexOf("\n");
      const lit = end < 0 ? rest : rest.slice(0, end);
      push(lit, "tok-com");
      i += lit.length;
      continue;
    }
    if (slashComment && (rest.startsWith("//") || (lang === "sql" && rest.startsWith("--")))) {
      const end = rest.indexOf("\n");
      const lit = end < 0 ? rest : rest.slice(0, end);
      push(lit, "tok-com");
      i += lit.length;
      continue;
    }
    if (slashComment && rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      const lit = end < 0 ? rest : rest.slice(0, end + 2);
      push(lit, "tok-com");
      i += lit.length;
      continue;
    }

    // Strings. Backslash escapes are honoured inside double quotes only,
    // matching every language here (YAML single quotes escape by doubling,
    // which this treats as two adjacent strings; visually identical).
    if (rest[0] === '"' || rest[0] === "'" || rest[0] === "`") {
      const q = rest[0];
      let j = 1;
      while (j < rest.length && rest[j] !== q) {
        if (rest[j] === "\\") j++;
        if (rest[j] === "\n" && q !== "`") break; // unterminated: stop at EOL
        j++;
      }
      const lit = rest.slice(0, Math.min(j + 1, rest.length));
      push(lit, "tok-str");
      i += lit.length;
      continue;
    }

    // Numbers, including decimals and hex.
    if ((m = /^(0[xX][0-9a-fA-F]+|\d[\d_]*(\.\d+)?)/.exec(rest))) {
      push(m[0], "tok-num");
      i += m[0].length;
      continue;
    }

    // Identifiers, then keyword lookup.
    if ((m = /^[A-Za-z_$][\w$.-]*/.exec(rest))) {
      const word = m[0];
      const probe = caseless ? word.toLowerCase() : word;
      push(word, kw.has(probe) ? "tok-key" : null);
      i += word.length;
      continue;
    }

    // A YAML key ("name:" at the start of a line) reads as structure.
    if (rest[0] === ":" && lang === "yaml") {
      push(":", "tok-op");
      i++;
      continue;
    }

    push(code[i], null);
    i++;
  }

  return emit(segs);
}

/** Languages that get the source treatment. Everything else stays plain. */
const SOURCE_LANGS = new Set([
  "yaml",
  "yml",
  "json",
  "javascript",
  "js",
  "sql",
  "python",
  "go",
  "powershell",
]);

/**
 * Highlight one fenced block.
 *
 * @param {string} code        raw block contents, unescaped
 * @param {string} infostring  the fence's language tag, possibly empty
 * @returns {{html:string, kind:string}}  escaped HTML and the chosen mode
 *
 * `kind` is returned so the caller can put it on the <pre>, which makes
 * the classification visible in the served HTML and therefore checkable
 * by a test rather than by eyeball.
 */
export function highlight(code, infostring) {
  const lang = String(infostring || "").trim().toLowerCase().split(/\s+/)[0];

  if (lang === "bash" || lang === "sh" || lang === "shell" || lang === "console") {
    // A password line counts as a transcript signal on its own. In the
    // corpus one always follows an `ssh` line, so the block has a prompt
    // anyway, but a block quoting only the password exchange would
    // otherwise fall through to shell mode, where "level3@linux's
    // password:" tokenises as the command `level3@linux` followed by an
    // unterminated string. Classifying on either signal costs one test
    // and removes the whole failure mode.
    const looksTyped = PROMPT.test(code) || code.split("\n").some((l) => PASSWORD_LINE.test(l));
    return looksTyped
      ? { html: renderTranscript(code), kind: "transcript" }
      : { html: renderShell(code), kind: "shell" };
  }

  if (SOURCE_LANGS.has(lang)) {
    const norm = lang === "yml" ? "yaml" : lang === "js" ? "javascript" : lang;
    return { html: renderSource(code, norm), kind: "source" };
  }

  // No info string, or one we do not model. Almost always program output.
  // Escaped and otherwise untouched.
  return { html: esc(code), kind: "plain" };
}

export { esc as _esc, shellSegments as _shellSegments, PROMPT as _PROMPT };
