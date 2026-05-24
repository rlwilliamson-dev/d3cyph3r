// Theme toggle — dark (default) and light.
//
// Two-state toggle persisted to localStorage so the choice survives
// across sessions AND across the main app ↔ walkthroughs subsite
// boundary (both share the d3cyph3r.com origin, so the storage key
// is visible from both contexts).
//
// The actual color flip is pure CSS — `body.light` overrides the
// CSS custom properties defined in style.css's :root block. This
// module just toggles the class and writes the persistence flag.
//
// localStorage is the ONE persistent thing this app uses (sessionStorage
// covers level-progress; everything else is ephemeral). The privacy
// note in README is explicit about this.

const KEY = "d3cyph3r-theme";

/**
 * Read saved preference and apply on page load. Called once from
 * main.js before any rendering. No-op if the user has never toggled
 * (dark stays default).
 */
export function initTheme() {
  try {
    if (localStorage.getItem(KEY) === "light") {
      document.body.classList.add("light");
    }
  } catch (_) {
    // localStorage may throw in private-browsing mode or when site
    // storage is disabled. Fall back to default (dark).
  }
}

/**
 * Flip the current theme and persist the choice. Returns the new
 * state ("light" | "dark") in case the caller wants to update icon
 * visibility or similar.
 */
export function toggleTheme() {
  const isLight = document.body.classList.toggle("light");
  try {
    localStorage.setItem(KEY, isLight ? "light" : "dark");
  } catch (_) {
    // Persistence failure is non-fatal — the class is still toggled
    // for the rest of the session, the choice just won't survive a
    // reload.
  }
  return isLight ? "light" : "dark";
}
