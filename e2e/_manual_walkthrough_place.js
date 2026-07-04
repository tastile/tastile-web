/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const SHOT = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log("[place]", ...a);
async function shot(page, name) {
  const file = path.join(SHOT, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log("  shot ->", name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1200 },
    deviceScaleFactor: 2,
    extraHTTPHeaders: { "x-owner-id": "00000000-0000-0000-0000-000000000001", "x-actor-id": "00000000-0000-0000-0000-000000000001" },
  });
  const page = await ctx.newPage();
  const requestLog = [];
  const responseLog = [];
  page.on("request", (r) => {
    const u = r.url();
    if (u.includes("/v1/") || u.includes("/api/events") || u.includes("/api/proxy/v1/")) {
      requestLog.push({ method: r.method(), url: u.replace("http://127.0.0.1:3000", "") });
    }
  });
  page.on("response", async (r) => {
    const u = r.url();
    if (u.includes("/v1/") || u.includes("/api/events") || u.includes("/api/proxy/v1/")) {
      let body = "";
      try { body = (await r.text()).slice(0, 400); } catch {}
      responseLog.push({ status: r.status(), url: u.replace("http://127.0.0.1:3000", ""), body });
    }
  });
  page.on("pageerror", (e) => log("PAGEERROR", e.message));

  await page.goto("http://127.0.0.1:3000/dashboard/calendar", { waitUntil: "networkidle" });
  await sleep(1500);

  // Open new-tile
  await page.getByTestId("sidebar-new-tile").first().click();
  await sleep(800);

  // Configure for placement with explicit time
  // 1) Disable allDay
  const allDayBtn = page.getByRole("button", { name: "終日" });
  if (await allDayBtn.count() > 0) {
    await allDayBtn.first().click({ force: true });
    await sleep(300);
  }
  // 2) Title
  const title = "PLACE-WALK-" + Date.now();
  await page.locator('input[type="text"]').first().click();
  await page.locator('input[type="text"]').first().fill(title);
  await sleep(300);
  await shot(page, "place01-title");

  // 3) Set time to 14:30 - 15:30
  // Look for time input controls
  const timeInputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, [contenteditable]'))
      .filter(e => e.offsetParent)
      .map(e => ({ tag: e.tagName, type: e.getAttribute('type'), value: e.value, placeholder: e.placeholder, name: e.name, aria: e.getAttribute('aria-label') }));
  });
  log("visible inputs:", JSON.stringify(timeInputs, null, 2));

  // 4) Submit
  await page.getByRole("button", { name: "作成" }).first().click({ force: true });
  await sleep(2500);
  await shot(page, "place02-after-submit");

  log("=== REQUESTS ===");
  for (const r of requestLog) log("  REQ", r.method, r.url);
  log("=== RESPONSES ===");
  for (const r of responseLog) log("  RES", r.status, r.url, "->", r.body);

  // Check day-view event blocks
  const ev = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('[data-testid^="day-event-"]'));
    return els.map(el => ({
      id: el.getAttribute('data-testid'),
      text: el.innerText,
      rect: el.getBoundingClientRect().toJSON(),
    }));
  });
  log("=== EVENTS ===");
  for (const e of ev) log("  EV", JSON.stringify(e));

  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
