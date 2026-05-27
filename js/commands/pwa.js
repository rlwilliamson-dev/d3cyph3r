// `sw` and `reload` commands — PWA / service worker controls (v1.21.0).
//
// The engine dispatcher calls command handlers synchronously and
// doesn't await Promises (see js/engine/execute.js#runSegment). So
// async work — SW registration queries, registration.update(), cache
// iteration during clear — happens inside fire-and-forget Promises
// that print via print() when they resolve. The handler itself
// returns null synchronously so the dispatcher proceeds cleanly.
//
// This pattern matches how `walkthrough` (in js/commands/learning.js)
// kicks off a setTimeout-driven navigation and returns null.

import { print } from "../terminal/output.js";
import {
  getSwStatus, forceUpdate, unregisterAndClear, applyUpdateIfPending,
} from "../engine/pwa.js";

// ── Async work, fire-and-forget — each prints to the terminal
//    when its promise resolves, after the handler has already
//    returned null to the dispatcher. ──────────────────────────

async function runStatus() {
  try {
    const s = await getSwStatus();
    if (!s.supported) {
      print("sw: service workers not supported in this browser (offline + install unavailable).", "dim");
      return;
    }
    if (!s.registered) {
      print("sw: not registered. Reload the page to register; if it still fails, your browser may have SW disabled (private mode? Firefox about:config?).", "warn");
      return;
    }
    print("  Service worker status:", "out");
    print(`    State:           ${s.state}`, "out");
    print(`    Active version:  ${s.activeVersion}`, "out");
    print(`    Scope:           ${s.scope}`, "out");
    print(`    Update waiting:  ${s.hasWaiting ? "yes — type 'reload' to apply" : "no"}`, "out");
    print(`    Last update chk: ${s.lastUpdateCheck ? s.lastUpdateCheck.toISOString() : "(none this session)"}`, "out");
    print("", "out");
    print("  Subcommands:", "dim");
    print("    sw update   force-check for a new version now", "dim");
    print("    sw clear    unregister + wipe caches (panic button)", "dim");
  } catch (e) {
    print(`sw: error reading status — ${e && e.message ? e.message : "unknown"}`, "err");
  }
}

async function runUpdate() {
  try {
    const res = await forceUpdate();
    if (res.ok) {
      print("sw: update check complete. If a new version was available, you'll see a yellow banner shortly inviting you to reload.", "success");
    } else {
      print(`sw: update check failed — ${res.reason}`, "err");
    }
  } catch (e) {
    print(`sw: update threw — ${e && e.message ? e.message : "unknown"}`, "err");
  }
}

async function runClear() {
  try {
    print("  Unregistering service worker + clearing caches…", "dim");
    const res = await unregisterAndClear();
    print(`  Done — unregistered: ${res.registrationCleared ? "yes" : "none"}, caches deleted: ${res.cachesCleared}.`, "success");
    print("  Reload the page to register a fresh service worker.", "dim");
    print("", "out");
  } catch (e) {
    print(`sw clear: error — ${e && e.message ? e.message : "unknown"}`, "err");
  }
}

export const pwaCommands = {
  /**
   * `sw [status|update|clear]` — inspect / control the service
   * worker that backs offline support + PWA install.
   *
   * Returns null synchronously; async work prints via print() once
   * the underlying SW promises resolve. The dispatcher echoes the
   * input line before this handler runs, so the player sees:
   *
   *   user@host:~$ sw
   *     Service worker status:
   *       State:           active
   *       ...
   *
   * with the body appearing a beat after the prompt comes back.
   */
  sw(_level, arg) {
    const sub = (arg || "").trim().split(/\s+/)[0] || "status";

    if (sub === "status" || sub === "") {
      runStatus();
      return null;
    }
    if (sub === "update") {
      runUpdate();
      return null;
    }
    if (sub === "clear") {
      runClear();
      return null;
    }
    return {
      text: `sw: unknown subcommand '${sub}'. Try 'sw', 'sw update', or 'sw clear'.`,
      cls: "err",
    };
  },

  /**
   * `reload` — refresh the page. If a new SW is waiting to activate,
   * this triggers skipWaiting first so the reload picks up the new
   * version instead of the cached old one.
   *
   * Bare `reload` is also useful as a discoverable way to refresh
   * the engine without having to know about Cmd-R / F5 / Ctrl-R.
   */
  reload() {
    print("  Reloading…", "dim");
    applyUpdateIfPending();  // posts SKIP_WAITING to pending SW then calls location.reload
    return null;
  },
};
