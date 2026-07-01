// Interactive manual-walkthrough harness: drives a real Chromium the way
// a human would (clicks, types, waits, watches console), captures
// screenshots, and prints a per-step verdict.  This is NOT a pass/fail
// test \u2014 it's a screen-recording-style sanity check the human can review.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const SHOT_DIR = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });

const BASE = "http://127.0.0.1:3000";
const log = (...a) => console.log("[walk]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  const file = path.join(SHOT_DIR, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log("  shot ->", file);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { "x-owner-id": "00000000-0000-0000-0000-000000000001", "x-actor-id": "00000000-0000-0000-0000-000000000001" },
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push("[pageerror] " + err.message));

  // --- Step 1: land on /login?error=no_session (matches the URL the user opened) ---
  log("STEP 1: GET /login?error=no_session");
  const r1 = await page.goto(`${BASE}/login?error=no_session`, { waitUntil: "networkidle" });
  log("  status", r1.status());
  log("  url", page.url());
  await shot(page, "01-login");
  const titleText = await page.locator("h1, h2, [data-testid=login-title]").first().textContent().catch(() => null);
  log("  visible title/heading:", JSON.stringify(titleText));

  // --- Step 2: read the sign-in form elements ---
  const formInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input,button")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      name: el.name || null,
      testid: el.dataset && el.dataset.testid ? el.dataset.testid : null,
      label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 60),
      visible: !!(el.offsetParent),
    }));
    return inputs;
  });
  log("  form elements:", JSON.stringify(formInfo, null, 2));

  // --- Step 3: try a "sign in" / submit ---
  log("STEP 3: try to submit the sign-in form");
  const submitBtn = page.locator("button[type=submit],button:has-text(\"Sign in\"),button:has-text(\"\u30b5\u30a4\u30f3\u30a4\u30f3\")").first();
  if (await submitBtn.count() > 0) {
    log("  found submit button, clicking");
    await submitBtn.click().catch((e) => log("  click failed:", e.message));
    await sleep(2000);
    log("  url after submit:", page.url());
    await shot(page, "02-after-submit");
  } else {
    log("  no submit button visible");
  }

  // --- Step 4: navigate to dashboard with bypass headers (what dev users actually do) ---
  log("STEP 4: GET /dashboard/calendar (with x-owner-id header from context)");
  const r2 = await page.goto(`${BASE}/dashboard/calendar`, { waitUntil: "networkidle" });
  log("  status", r2.status());
  log("  url", page.url());
  await sleep(2000);
  await shot(page, "03-dashboard-calendar");

  // --- Step 5: read what's on the calendar page ---
  const pageInfo = await page.evaluate(() => {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,[role=heading]")).map((el) => el.textContent.trim()).filter(Boolean);
    const tileCount = document.querySelectorAll("[data-testid^='tile-'], [data-testid=placement-tile], [data-testid=tile-card]").length;
    const sidebarBtns = Array.from(document.querySelectorAll("button")).slice(0, 10).map((b) => b.textContent.trim().slice(0, 40));
    return { headings, tileCount, sidebarBtns };
  });
  log("  page info:", JSON.stringify(pageInfo, null, 2));

  // --- Step 6: try clicking "new tile" / "sidebar-new-tile" ---
  log("STEP 6: click sidebar new-tile button");
  const newTile = page.getByTestId("sidebar-new-tile").first();
  if (await newTile.count() > 0) {
    await newTile.click().catch((e) => log("  click failed:", e.message));
    await sleep(1000);
    await shot(page, "04-after-new-tile-click");
    const panel = await page.evaluate(() => {
      const p = document.querySelector("[data-testid=quick-create-backdrop],[data-testid=quick-create],aside, dialog");
      return p ? { tag: p.tagName, testid: p.dataset?.testid, visible: !!(p.offsetParent) } : null;
    });
    log("  panel:", panel);
  } else {
    log("  no sidebar-new-tile visible");
  }

  // --- final: print collected console errors ---
  log("---");
  log("CONSOLE ERRORS COLLECTED (" + consoleErrors.length + "):");
  for (const e of consoleErrors) log("  - " + e.slice(0, 240));

  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
