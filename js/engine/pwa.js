// PWA glue — registers the service worker, listens for updates, and
// exposes a small API the `sw` command uses (v1.21.0).
//
// MODULE SPLIT
// ------------
// The actual cache strategy lives in /sw.js (top-level static asset
// because service workers must be served from the path they intend
// to scope). This module is the PAGE side — it kicks off SW
// registration on boot, listens for "new SW available" events, and
// gives the `sw` command something to inspect.
//
// UPDATE DETECTION
// ----------------
// Service workers have a precise lifecycle:
//   installing → installed (waiting) → activated
// The waiting state means "a new SW is ready but an old one is
// still controlling the page." We watch for that transition and
// surface a yellow terminal banner inviting the player to reload.
// On reload, they get the new SW + new engine version atomically.
//
// FEATURE DETECTION
// -----------------
// Service workers are gated behind HTTPS (or localhost). Older
// browsers may lack the API entirely. We feature-detect both before
// touching anything; absence is a no-op, not a crash.

import { print } from "../terminal/output.js";

// ── Internal state (module-private) ───────────────────────────────

let registration   = null;   // ServiceWorkerRegistration once installed
let lastUpdateCheck = null;  // timestamp of the most recent registration.update()

/**
 * Register the service worker. Called once from main.js after the
 * engine finishes booting (so the SW registration doesn't compete
 * with first-paint).
 *
 * Returns a promise that resolves when registration completes, or
 * rejects on registration failure. Callers should not block on it —
 * the SW is a nice-to-have, not a blocker for engine boot.
 */
export async function registerServiceWorker() {
  // Feature detection: must be a secure context (HTTPS or localhost).
  if (!("serviceWorker" in navigator)) {
    return null;
  }
  // Local file:// origin (someone opened index.html directly) — SW
  // registration would throw. Stay quiet.
  if (location.protocol === "file:") {
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    wireUpdateListener(registration);
    return registration;
  } catch (e) {
    // Don't blow up the engine if SW registration fails — the page
    // still works, just without offline support. Log to console for
    // anyone debugging, but no terminal banner (privacy posture: we
    // don't want to clutter the boot screen with failures).
    if (typeof console !== "undefined") {
      console.warn("[D3CYPH3R] Service worker registration failed:", e);
    }
    return null;
  }
}

/**
 * Wire the registration's lifecycle events so we surface an in-
 * terminal banner whenever a new SW arrives in the "waiting" state.
 *
 * The flow:
 *   1. Browser detects sw.js has changed (different bytes vs cached)
 *   2. New SW starts installing
 *   3. New SW finishes installing → state becomes "installed"
 *   4. If there's already an active SW: new one stays in "waiting"
 *      (this is the case we want to notify on)
 *   5. We post a yellow banner: "v1.x.y available — type 'reload' to
 *      apply, or refresh the page"
 */
function wireUpdateListener(reg) {
  reg.addEventListener("updatefound", () => {
    const newWorker = reg.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      // We care about the transition INTO "installed" AND the page
      // already has an active controller. If there's no controller,
      // this is the first-ever install (no notification needed —
      // nothing was stale, just freshly cached).
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        printUpdateBanner(newWorker);
      }
    });
  });

  // Also handle the case where a new SW has ALREADY entered the
  // waiting state by the time we register (e.g. the player closed +
  // reopened the tab between when the new SW downloaded and when
  // they came back). Surface the banner immediately.
  if (reg.waiting && navigator.serviceWorker.controller) {
    printUpdateBanner(reg.waiting);
  }
}

/**
 * Print the "new version available" banner and stash the worker
 * reference so the player's "reload" can tell it to skipWaiting.
 *
 * The banner is intentionally polite — we don't auto-apply because
 * the player might be mid-level. A nudge with a clear action is
 * less rude than yanking the engine out from under them.
 */
let _pendingWorker = null;
function printUpdateBanner(worker) {
  _pendingWorker = worker;
  print("", "out");
  print("  ── A new version of D3CYPH3R is available.", "warn");
  print("     Type 'reload' to apply, or refresh the page when you're at a good", "dim");
  print("     stopping point. (Your progress will survive the update.)", "dim");
  print("", "out");
}

/**
 * Apply the pending SW update if one is waiting. Wired to the
 * "reload" command in js/commands/pwa.js — when the player types it
 * we tell the new SW to skipWaiting (so it takes over) and then
 * reload the page.
 *
 * If there's no update waiting, this is a no-op + plain reload.
 */
export function applyUpdateIfPending() {
  if (_pendingWorker) {
    try { _pendingWorker.postMessage({ type: "SKIP_WAITING" }); } catch (_) { /* silent */ }
  }
  // Give the SW a moment to switch, then reload.
  setTimeout(() => {
    try { window.location.reload(); } catch (_) { /* non-browser env */ }
  }, 250);
}

// ── Status API (consumed by the `sw` command) ──────────────────────

/**
 * Snapshot of the current SW state for the `sw status` command.
 * Returns null when service workers aren't supported in this
 * environment.
 */
export async function getSwStatus() {
  if (!("serviceWorker" in navigator)) {
    return { supported: false };
  }

  const reg = registration || (await navigator.serviceWorker.getRegistration("/"));
  if (!reg) {
    return {
      supported: true,
      registered: false,
    };
  }

  // Ask the active SW for its embedded version string. The MessageChannel
  // gives us a one-shot reply path; we resolve with whatever the SW posts
  // back, or "unknown" if it doesn't respond within a beat.
  let activeVersion = "unknown";
  if (reg.active) {
    activeVersion = await askWorkerForVersion(reg.active);
  }

  return {
    supported: true,
    registered: true,
    activeVersion,
    state: reg.active ? "active" : reg.installing ? "installing" : reg.waiting ? "waiting" : "unknown",
    hasWaiting: !!reg.waiting,
    scope: reg.scope,
    lastUpdateCheck,
  };
}

function askWorkerForVersion(worker) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    let resolved = false;
    channel.port1.onmessage = (event) => {
      if (resolved) return;
      resolved = true;
      if (event.data && event.data.type === "VERSION") {
        resolve(event.data.version || "unknown");
      } else {
        resolve("unknown");
      }
    };
    try {
      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    } catch (_) {
      resolve("unknown");
    }
    // Safety timeout
    setTimeout(() => { if (!resolved) { resolved = true; resolve("unknown"); } }, 750);
  });
}

/**
 * Force-check for a new SW. The browser does this automatically every
 * 24h or so, but the `sw update` command lets impatient players check
 * NOW (useful right after we deploy a fix and want to confirm it's
 * propagated). Records lastUpdateCheck so `sw status` can show it.
 */
export async function forceUpdate() {
  if (!("serviceWorker" in navigator)) return { ok: false, reason: "not supported" };
  const reg = registration || (await navigator.serviceWorker.getRegistration("/"));
  if (!reg) return { ok: false, reason: "not registered" };
  try {
    await reg.update();
    lastUpdateCheck = new Date();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e && e.message ? e.message : "unknown" };
  }
}

/**
 * Panic button — unregister the service worker AND nuke every
 * D3CYPH3R cache. Used by `sw clear`. After this completes, a page
 * reload will re-register a fresh SW and rebuild the cache from
 * scratch.
 *
 * This is the safety net for "the SW got into a weird state" — the
 * single in-engine recovery path before players have to dive into
 * DevTools.
 */
export async function unregisterAndClear() {
  let registrationCleared = false;
  let cachesCleared = 0;

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) {
        await r.unregister();
        registrationCleared = true;
      }
    }
  } catch (_) { /* silent */ }

  try {
    if ("caches" in window) {
      const names = await caches.keys();
      for (const n of names) {
        if (n.startsWith("d3cyph3r-")) {
          await caches.delete(n);
          cachesCleared++;
        }
      }
    }
  } catch (_) { /* silent */ }

  registration = null;
  return { registrationCleared, cachesCleared };
}
