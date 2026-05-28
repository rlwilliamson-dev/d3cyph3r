// tests/playwright.config.cjs
//
// Playwright Test runner config for the D3CYPH3R playtest suite.
// Replaces the v1.23.x single-file `node tests/playtest.cjs` monolith
// with a per-spec layout that runs in parallel workers.
//
// Run locally:
//   cd tests && npx playwright test            # all specs, parallel
//   cd tests && npx playwright test --headed   # see the browser
//   cd tests && npx playwright test linux      # one spec (filename match)
//   cd tests && npx playwright test --grep "lobby"  # one test by name
//
// Pre-req: a local server on :8000 (or set D3CYPH3R_URL):
//   (cd .. && python3 -m http.server 8000)
//
// CI: the workflow runs `npx playwright test --reporter=list` from
// the tests/ directory. The server must be up before the test step.

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  // Each spec file under specs/ is one worker-eligible suite. Parallel
  // workers are bounded by CPU count locally; CI gets a smaller cap to
  // avoid runner-machine starvation on shared infrastructure.
  testDir: "./specs",
  testMatch: "**/*.spec.cjs",

  // fullyParallel: every test() in every file is a parallel unit.
  // Each gets its own browser context (no state bleed), which is what
  // makes the per-spec split safe — sessionStorage and localStorage are
  // context-scoped, so two workers visiting / at the same time can't
  // step on each other's persistence layer.
  fullyParallel: true,

  // Workers: auto-detect locally (one per core).
  //
  // In CI, GitHub-hosted `ubuntu-latest` runners now provide 4 vCPUs
  // (Standard_D4_v3 class as of October 2024 — see
  // https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md
  // for the current spec). The original v1.24.0 setting of 2 was
  // overcautious — measurement on v1.24.0 showed the test step
  // running 194s with workers=2, vs the v1.23.x monolith's 123s on
  // the same runner class. Bumping to 4 puts CI on par with local
  // multi-core performance.
  //
  // If a future runner image change re-introduces flake (saturated
  // CPU → race-condition assertions), drop back to 3 before lowering
  // to 2.
  workers: process.env.CI ? 4 : undefined,

  // Retry: in CI, give a single retry to absorb transient flake from
  // the static-server cold start or network blips. Locally, 0 retries
  // keeps the iteration loop tight (a flake should be debugged, not
  // hidden).
  retries: process.env.CI ? 1 : 0,

  // Per-test timeout. The mobile-gate test has a 5800ms required wait
  // (the gate's FINAL_DELAY); everything else completes in seconds.
  // 30s is generous headroom without hiding genuine hangs.
  timeout: 30 * 1000,

  // Reporter: list is fast + readable in CI logs. HTML reporter is
  // useful for local triage of failures (run `npx playwright show-report`
  // afterward) but adds ~1s overhead so we keep it off by default.
  reporter: process.env.CI ? "list" : "list",

  // Shared use{} options. baseURL lets test files write
  // `page.goto("/")` instead of repeating the absolute URL everywhere.
  use: {
    baseURL: process.env.D3CYPH3R_URL || "http://localhost:8000",
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5000,
    // Trace + screenshot on failure — invaluable for diagnosing the
    // occasional content-drift assertion (e.g., a level's welcome.md
    // text changed and a spec didn't get updated).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  // Single project: headless Chromium. The engine targets desktop, and
  // adding Firefox/WebKit would triple CI time for marginal value
  // (the mobile-bypass tests already exercise a 375x812 viewport).
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
