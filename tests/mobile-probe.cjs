// Throwaway: dump the actual DOM tree of #screen at a mobile viewport
// after bypassing the gate, so we can SEE what's wrong.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });

  // Pre-set the bypass flag so we skip the gate immediately
  await page.goto("http://localhost:8000/");
  await page.evaluate(() => { localStorage.setItem("d3cyph3r-mobile-bypass", "1"); });
  await page.reload();
  await page.waitForTimeout(1500);

  const dump = await page.evaluate(() => {
    const screen = document.getElementById("screen");
    if (!screen) return { error: "no #screen" };

    function describe(el) {
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: el.className || null,
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
        })(),
        childCount: el.children.length,
      };
    }
    const children = Array.from(screen.children).map(describe);
    const inputArea = document.getElementById("input-area");
    const inputAreaKids = inputArea ? Array.from(inputArea.children).map(describe) : null;
    const softkey = document.getElementById("softkey-row");

    return {
      bodyClasses: document.body.className,
      mobileMode: document.body.classList.contains("mobile-mode"),
      screenDisplay: getComputedStyle(screen).display,
      screenFlexDir: getComputedStyle(screen).flexDirection,
      screenChildren: children,
      inputAreaChildren: inputAreaKids,
      softkeyExists: !!softkey,
      softkeyParent: softkey ? softkey.parentNode.id : null,
      softkeyComputedDisplay: softkey ? getComputedStyle(softkey).display : null,
      softkeyRect: softkey ? (() => {
        const r = softkey.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })() : null,
    };
  });

  console.log(JSON.stringify(dump, null, 2));
  await browser.close();
})();
