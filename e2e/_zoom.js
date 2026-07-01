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
  await new Promise(r => setTimeout(r, 1500));
  // Find the REC-WALK event block and capture its bounding box
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
    const r = ev[0].rect;
    await page.screenshot({
      path: "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots\\zoom-rec.png",
      clip: { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 20), width: r.width + 40, height: r.height + 40 }
    });
  }
  await browser.close();
})();
