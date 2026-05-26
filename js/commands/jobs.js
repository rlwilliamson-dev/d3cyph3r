// Job-control commands: jobs / fg / bg / kill / wait / disown.
//
// The sandbox runs commands synchronously, so true concurrent jobs are
// impossible. What we DO implement is the bash UX:
//
//   - Trailing `&` on a command (handled in execute.js) runs the command
//     immediately but captures its output into a job entry instead of
//     printing it. The job is marked Done because we never actually
//     pause.
//   - `jobs` lists those entries.
//   - `fg %N` replays the captured output and removes the job from the
//     table.
//   - `bg %N` no-ops (the job is already "running" instantly).
//   - `kill %N` removes the entry.
//   - `wait` no-ops (everything's done).
//   - `disown %N` removes from job table without printing.
//
// This is enough to teach the concept and to make scripts that use job
// control not error out. Real-time job control would require an async
// dispatcher rewrite; out of scope for v1.9.0.

import { jobs, getJob, removeJob, clearJobs } from "../engine/state.js";

/**
 * Parse `%N` (job spec) into a numeric ID. Returns NaN on bad input.
 * Accepts plain `N` too (bash is lenient).
 */
function parseJobSpec(spec) {
  if (!spec) return NaN;
  const s = spec.startsWith("%") ? spec.slice(1) : spec;
  if (s === "+" || s === "%") return jobs[jobs.length - 1]?.id ?? NaN;
  if (s === "-") return jobs[jobs.length - 2]?.id ?? NaN;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : NaN;
}

/** jobs [-l] — list all known jobs. */
function jobsCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];
  const longForm = args.includes("-l");
  if (jobs.length === 0) return null;
  const lines = jobs.map((j, i) => {
    const marker = (i === jobs.length - 1) ? "+" : (i === jobs.length - 2 ? "-" : " ");
    const idPart = longForm ? `[${j.id}] ${marker} ${10000 + j.id}` : `[${j.id}] ${marker}`;
    return `${idPart}  ${j.status.padEnd(8)}  ${j.command}`;
  });
  return { text: lines.join("\n"), cls: "out" };
}

/** fg [%N] — bring job to foreground (= replay captured output). */
function fgCmd(_level, arg, _stdin, argv) {
  if (jobs.length === 0) {
    return { text: "fg: current: no such job", cls: "err" };
  }
  const args = argv || [];
  const spec = args[0] || `%${jobs[jobs.length - 1].id}`;
  const id = parseJobSpec(spec);
  if (!Number.isFinite(id)) {
    return { text: `fg: ${spec}: no such job`, cls: "err" };
  }
  const job = getJob(id);
  if (!job) return { text: `fg: ${spec}: no such job`, cls: "err" };

  // Replay: print the command (bash does), then the captured output.
  const lines = [job.command];
  if (job.output) lines.push(job.output);
  removeJob(id);
  return { text: lines.join("\n"), cls: "out" };
}

/** bg [%N] — resume job in background. No-op (already "done"). */
function bgCmd(_level, _arg, _stdin, argv) {
  if (jobs.length === 0) {
    return { text: "bg: current: no such job", cls: "err" };
  }
  const args = argv || [];
  const spec = args[0] || `%${jobs[jobs.length - 1].id}`;
  const id = parseJobSpec(spec);
  if (!Number.isFinite(id)) return { text: `bg: ${spec}: no such job`, cls: "err" };
  const job = getJob(id);
  if (!job) return { text: `bg: ${spec}: no such job`, cls: "err" };
  return { text: `[${job.id}]+ ${job.command} &`, cls: "out" };
}

/** kill [-SIG] %N | PID — remove from job table; reject unknown PIDs. */
function killCmd(_level, arg, _stdin, argv) {
  const args = argv || [];
  if (args.length === 0) {
    return { text: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...", cls: "err" };
  }

  // Skip leading signal flag (-9, -KILL, -s SIGTERM, -n 15).
  let i = 0;
  if (args[i].startsWith("-")) {
    if (args[i] === "-s" || args[i] === "-n") i += 2;
    else i += 1;
  }

  const targets = args.slice(i);
  if (targets.length === 0) {
    return { text: "kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ...", cls: "err" };
  }

  const errs = [];
  for (const t of targets) {
    if (t.startsWith("%")) {
      const id = parseJobSpec(t);
      if (!Number.isFinite(id) || !removeJob(id)) {
        errs.push(`kill: ${t}: no such job`);
      }
    } else {
      // Pretend PIDs we don't know about always fail (we don't track them).
      errs.push(`kill: (${t}) - No such process`);
    }
  }
  if (errs.length) return { text: errs.join("\n"), cls: "err" };
  return null;
}

/** wait — block until all background jobs complete. No-op here. */
function waitCmd() {
  // All jobs are synchronous, so wait is always immediate.
  return null;
}

/** disown [%N] — remove from job table without notice. */
function disownCmd(_level, _arg, _stdin, argv) {
  const args = argv || [];
  if (args.length === 0) {
    clearJobs();
    return null;
  }
  for (const spec of args) {
    const id = parseJobSpec(spec);
    if (Number.isFinite(id)) removeJob(id);
  }
  return null;
}

export const jobCommands = {
  jobs:   jobsCmd,
  fg:     fgCmd,
  bg:     bgCmd,
  kill:   killCmd,
  wait:   waitCmd,
  disown: disownCmd,
};
