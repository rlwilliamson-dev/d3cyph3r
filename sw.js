// D3CYPH3R service worker — runtime caching + offline support (v1.21.0).
//
// PURPOSE
// -------
// Makes the site work offline once it's been loaded at least once
// (subway, airplane, network outage), and gives the PWA install
// flow something to register against.
//
// DESIGN: RUNTIME CACHING (not hardcoded asset list)
// --------------------------------------------------
// Most PWA tutorials show:
//   const ASSETS_TO_CACHE = ["/index.html", "/js/main.js", ...];
//   self.addEventListener("install", e => e.waitUntil(
//     caches.open(C).then(c => c.addAll(ASSETS_TO_CACHE))
//   ));
//
// That approach breaks the moment we ship a new file (e.g. a new
// command module, a new level data file, a new bonus-find walkthrough)
// because the SW doesn't know it exists and won't pre-cache it.
// Returning installed-PWA users see stale state while desktop-web
// users see the fix.
//
// We use RUNTIME caching instead: install() pre-caches only the
// bootstrap shell (HTML + manifest + icons), and the fetch handler
// caches every other request the page makes ON DEMAND. Adding a new
// level / command / theme requires zero changes here.
//
// VERSION-AWARE INVALIDATION
// --------------------------
// CACHE_VERSION is bumped in lockstep with js/engine/version.js. The
// activate event nukes every cache that doesn't match the current
// version, so a v1.22.0 deploy cleanly retires v1.21.0's cache.
//
// CACHE STRATEGY BY CONTENT TYPE
// ------------------------------
//   HTML (navigation requests)        : network-first, cache fallback
//   JS / level data / walkthrough.js  : stale-while-revalidate
//   CSS                               : stale-while-revalidate
//   Vendored libs (marked.js)         : cache-first
//   Icons / manifest / favicon        : cache-first
//   Cross-origin                      : SW bypass (let browser handle)
//   Anything else (defensive)         : network-first
//
// The stale-while-revalidate strategy is critical for the engine
// modules: returning visitors get the cached version instantly
// (snappy load) AND a background fetch refreshes the cache, so the
// NEXT visit will reflect the latest deploy. Combined with SWA's
// no-cache headers on /js/*, this keeps update latency to one extra
// page load after a release.
//
// SKIP_WAITING
// ------------
// When a new SW is installed but an old one is still controlling the
// page, the new one sits in the "waiting" state. The page-side
// pwa.js module posts {type: "SKIP_WAITING"} to activate it
// immediately when the player chooses to reload. Without this, the
// new SW only activates after every tab of the site is closed.
//
// SAFETY: if this SW ever has a bug, players can recover via:
//   1. The `sw clear` engine command — unregisters + nukes caches.
//   2. DevTools → Application → Service Workers → Unregister.
//   3. A future SW that does `self.unregister()` (kill-switch deploy).

// Bumped per-commit during active iteration to force a fresh cache.
// Format: vMAJOR.MINOR.PATCH[-rN] where -rN is an in-flight revision
// counter for hotfixes WITHIN the same release version.
const CACHE_VERSION = "v1.21.0-r3";
const CACHE_NAME    = `d3cyph3r-${CACHE_VERSION}`;

// Minimum bootstrap set — just enough to render index.html and load
// the manifest if the very first visit somehow happens offline. The
// engine modules are deliberately NOT in this list; they get cached
// on first request via runtime caching.
const BOOTSTRAP = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install: pre-cache the bootstrap shell ─────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        await cache.addAll(BOOTSTRAP);
      } catch (_) {
        // First-visit offline or partial-pre-cache failure shouldn't
        // block installation — runtime caching will fill the gaps as
        // soon as the page comes back online.
      }
      // Activate the new SW immediately rather than waiting for all
      // tabs of the site to close. Paired with clients.claim() in
      // activate so the active page hands control over right away.
      self.skipWaiting();
    })()
  );
});

// ── Activate: delete old caches + take control ─────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("d3cyph3r-") && n !== CACHE_NAME)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

// ── Message: respond to SKIP_WAITING from page ─────────────────────
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "GET_VERSION") {
    // Respond synchronously via the MessagePort. The page uses this
    // for the `sw status` command's "active SW version" line.
    if (event.source) {
      event.source.postMessage({ type: "VERSION", version: CACHE_VERSION });
    }
  }
});

// ── Fetch: routing-based caching strategy ──────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Bypass non-GET requests (POST / PUT / DELETE) — we don't have any
  // mutating endpoints today, but defensive against future additions.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Bypass cross-origin entirely (Cloudflare beacons, Google Fonts on
  // walkthroughs subsite, etc.). The browser handles them via its
  // normal cache + CSP layer.
  if (url.origin !== self.location.origin) return;

  // Routing
  const path = url.pathname;
  const isNavigation =
    req.mode === "navigate" ||
    (req.method === "GET" && req.headers.get("accept") || "").includes("text/html");

  if (isNavigation || path.endsWith(".html")) {
    event.respondWith(networkFirst(req));
  } else if (path.startsWith("/walkthroughs/vendor/")) {
    event.respondWith(cacheFirst(req));
  } else if (
    path === "/manifest.webmanifest" ||
    path === "/favicon.svg" ||
    /\/icon-\d+\.png$/.test(path) ||
    /\/icon-maskable\.png$/.test(path)
  ) {
    event.respondWith(cacheFirst(req));
  } else if (
    path.startsWith("/js/") ||
    path.startsWith("/levels/") ||
    path === "/style.css" ||
    path.startsWith("/walkthroughs/") // walkthrough.js + walkthrough.css + the markdown content
  ) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    // Fall-through: anything else (sw.js itself, robots.txt, etc.)
    // goes network-first with cache fallback.
    event.respondWith(networkFirst(req));
  }
});

// ── Cache strategies ───────────────────────────────────────────────

/**
 * Try the network first; if it succeeds, refresh the cache and serve
 * the network response. If the network fails (offline), serve the
 * cached copy. Used for HTML where freshness matters more than speed.
 */
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    // Only cache successful responses (200) — caching a 404 / 500
    // would pin players to that error response indefinitely.
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Last-ditch: if the player requests "/" or any HTML and we have
    // nothing cached at all, serve the index shell so the engine has
    // a chance to render its own offline UX.
    if (req.mode === "navigate") {
      const fallback = await cache.match("/index.html");
      if (fallback) return fallback;
    }
    throw _;
  }
}

/**
 * Serve from cache if present, otherwise fetch + cache + serve.
 * Used for assets that never change between releases (vendored libs,
 * icons) — once cached they're permanent until the version-version
 * cache purge.
 */
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch (_) {
    // No cached copy and offline — let the browser show its own error.
    throw _;
  }
}

/**
 * Serve the cached copy IMMEDIATELY for snappy loads, then refresh
 * the cache in the background so the next request gets the latest.
 * Used for engine modules and CSS — the player sees fast loads now
 * and the cache catches up to the latest deploy by the next page
 * load. Combined with SWA's no-cache headers on /js/*, this gives us
 * one-page-load update latency after a release.
 */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((fresh) => {
      if (fresh && fresh.ok) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    })
    .catch(() => {
      // Network failed; cached response (if any) is what the user
      // sees. No re-throw — we don't want to break the request.
      return null;
    });
  // Return cached if available, otherwise wait for the network.
  // If both fail, the promise rejection propagates naturally.
  return cached || fetchPromise;
}
