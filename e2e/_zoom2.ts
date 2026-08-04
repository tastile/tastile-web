/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2,
    extraHTTPHeaders: { "x-owner-id": "00000000-0000-0000-0000-000000000001", "x-actor-id": "00000000-0000-0000-0000-000000000001" },
  });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:3000/dashboard/calendar", { waitUntil: "networkidle" });
  await new Promise(r => setTimeout(r, 3000));
  const ev = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid^="day-event-"]'));
    return els.map(el => ({
      id: el.getAttribute('data-testid'),
      rect: el.getBoundingClientRect().toJSON(),
      text: el.innerText
    }));
  });
  console.log(JSON.stringify(ev, null, 2));
  if (ev.length) {
    // Take a fullpage screenshot
    await page.screenshot({ path: "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots\\postfix-full.png", fullPage: true });
  }
  await browser.close();
})();
