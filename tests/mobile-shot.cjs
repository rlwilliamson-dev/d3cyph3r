// Throwaway: take a screenshot of the post-bypass mobile layout
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const url = process.env.D3CYPH3R_URL || "http://localhost:8000/";
  await page.goto(url);
  await page.evaluate(() => { localStorage.setItem("d3cyph3r-mobile-bypass", "1"); });
  await page.reload();
  await page.waitForTimeout(2000);
  const out = path.join(__dirname, "mobile-shot.png");
  await page.screenshot({ path: out, fullPage: false });
  console.log("Screenshot saved:", out);
  await browser.close();
})();
