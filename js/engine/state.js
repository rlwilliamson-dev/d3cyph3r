// Engine state.
//
// ES modules give us live bindings on direct imports, but importers can't
// reassign them. The setters live here so writes always go through the
// owning module.
//
// State that survives a level switch: hostStack (so `exit` can unwind a
// multi-host pivot). State that resets on level switch: processEnv (a
// new shell == fresh env in bash), bonusFinds for the new level, jobs
// (jobs are per-shell — switching level == switching shell).

import { mirrorSession } from "./persistence.js";

export let currentLevelKey   = "guest@d3cyph3r";
export let currentPath       = [];   // dir parts relative to fs root
export let awaitingPassword  = null; // { target, password } or null
export let awaitingPersistenceConsent = false; // routes next input to consent handler
export let lastExitCode      = 0;    // $? — last statement's exit code

// User-writable env vars (export / FOO=bar). Layered ABOVE the built-in
// var map computed in expand.js, so `export USER=root` overrides the
// derived built-in. Reset on level switch (a new shell starts clean).
export let processEnv = new Map();

// Pivot stack — when ssh into a host defined in level.network, the
// previous shell state is pushed here. `exit` pops back. The lobby
// (guest@d3cyph3r) is never pushed; it's the bottom of the world.
//
// Entry shape: { levelKey, path, env (Map), playerUser? }
export let hostStack = [];

// Lightweight job table for & / jobs / fg / bg / kill. Commands run
// synchronously in this sandbox so jobs are mostly cosmetic — we
// record the command line and captured output, then `fg %N` replays
// it. Reset on level switch.
//
// Entry shape: { id, command, status: "Done"|"Running"|"Stopped", output: string }
export let jobs = [];
let nextJobId = 1;

// Bonus-finds discovered in the current session. sessionStorage-backed
// so a reload preserves the count. Key: `${levelKey}:${findId}`.
export let foundBonuses = new Set();

export function setCurrentLevelKey(k) { currentLevelKey = k; }
export function setCurrentPath(p)     { currentPath = p; }
export function resetPath()           { currentPath = []; }
export function setAwaitingPassword(v){ awaitingPassword = v; }
export function setAwaitingPersistenceConsent(v) { awaitingPersistenceConsent = v; }
export function setLastExitCode(n)    { lastExitCode = n; }

// Env-var ops.
export function setEnvVar(k, v)   { processEnv.set(k, String(v)); }
export function unsetEnvVar(k)    { processEnv.delete(k); }
export function clearProcessEnv() { processEnv = new Map(); }

// Pivot stack ops.
export function pushHost(entry)   { hostStack.push(entry); }
export function popHost()         { return hostStack.pop(); }

// Job-table ops.
export function addJob(command, output) {
  const job = { id: nextJobId++, command, status: "Done", output: output || "" };
  jobs.push(job);
  return job;
}
export function getJob(id)        { return jobs.find(j => j.id === id); }
export function removeJob(id) {
  const idx = jobs.findIndex(j => j.id === id);
  if (idx >= 0) { jobs.splice(idx, 1); return true; }
  return false;
}
export function clearJobs() { jobs = []; nextJobId = 1; }

// Bonus-find ops.
export function markBonusFound(levelKey, findId) {
  foundBonuses.add(`${levelKey}:${findId}`);
  try {
    const key = "d3cyph3r:bonusFinds";
    const prev = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (!prev.includes(`${levelKey}:${findId}`)) {
      prev.push(`${levelKey}:${findId}`);
      mirrorSession(key, JSON.stringify(prev));
    }
  } catch (_) { /* sessionStorage unavailable in tests */ }
}
export function isBonusFound(levelKey, findId) {
  return foundBonuses.has(`${levelKey}:${findId}`);
}
export function loadBonusesFromStorage() {
  try {
    const key = "d3cyph3r:bonusFinds";
    const arr = JSON.parse(sessionStorage.getItem(key) || "[]");
    foundBonuses = new Set(arr);
  } catch (_) { /* sessionStorage unavailable */ }
}

/**
 * Reset every in-memory progress structure to its empty state.
 * Called by `progress reset` (in js/commands/learning.js) after the
 * persistence layer has wiped the underlying sessionStorage + the
 * localStorage blob — without this, the next `progress` render would
 * still see the in-memory bonus-find Set even though storage is
 * clean.
 *
 * Doesn't touch hint counters (read on demand from sessionStorage),
 * visited levels (read on demand), or processEnv (level-scoped, will
 * reset on next ssh).
 */
export function clearInMemoryProgress() {
  foundBonuses = new Set();
}
