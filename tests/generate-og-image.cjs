// Generate og-image.png from assets/og-template.html.
//
// Usage:
//   cd tests
//   node generate-og-image.cjs
//
// Output is written to og-image.png at the repo root. The PNG is
// committed; regenerate after any brand/version changes.

const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

  const templatePath = path.resolve(__dirname, "../assets/og-template.html");
  await page.goto("file://" + templatePath);

  // Google Fonts are fetched at runtime. Wait for them to load so the
  // wordmark renders in the correct typefaces.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const outPath = path.resolve(__dirname, "../og-image.png");
  await page.screenshot({ path: outPath, fullPage: false });

  console.log("Wrote", outPath);
  await browser.close();
})();
