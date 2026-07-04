/* eslint-disable @typescript-eslint/no-require-imports */
// Manual walkthrough v2: actually create a recurring tile through the UI,
// then trigger materialize, then verify a placement shows up in the day view.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const SHOT_DIR = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const log = (...a) => console.log("[walk2]", ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function shot(page, name) {
  const file = path.join(SHOT_DIR, `${Date.now()}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log("  shot ->", name);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { "x-owner-id": "00000000-0000-0000-0000-000000000001", "x-actor-id": "00000000-0000-0000-0000-000000000001" },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));

  // Direct-to-dashboard
  log("STEP 1: /dashboard/calendar");
  await page.goto(`${BASE}/dashboard/calendar`, { waitUntil: "networkidle" });
  await sleep(2000);
  await shot(page, "step1-dashboard");

  // Open new tile panel
  log("STEP 2: click sidebar new-tile");
  await page.getByTestId("sidebar-new-tile").first().click();
  await sleep(800);
  await shot(page, "step2-new-tile-panel");

  // Switch to 定期 (Recurring) tab
  log("STEP 3: click \u5b9a\u671f tab");
  const recTab = page.getByRole("button", { name: /\u5b9a\u671f/i }).first();
  if (await recTab.count() > 0) {
    await recTab.click();
    await sleep(600);
    await shot(page, "step3-recurring-tab");
  } else {
    log("  no recurring tab found");
  }

  // Fill title
  log("STEP 4: type title");
  const titleInput = page.locator("input[aria-required='true']").first();
  if (await titleInput.count() > 0) {
    await titleInput.fill("WALK-REC-" + Date.now());
    await sleep(200);
    await shot(page, "step4-title-typed");
  }

  // Submit / create
  log("STEP 5: click create/submit");
  const submit = page.getByTestId("quick-create-submit");
  if (await submit.count() > 0) {
    const waitV1 = page.waitForResponse(
      (r) => r.url().includes("/v1/tiles") && r.request().method() === "POST",
      { timeout: 10000 },
    ).catch(() => null);
    const waitBridge = page.waitForResponse(
      (r) => r.url().endsWith("/api/events") && r.request().method() === "POST",
      { timeout: 10000 },
    ).catch(() => null);
    await submit.click();
    const [v1, br] = await Promise.all([waitV1, waitBridge]);
    log("  v1/tiles POST:", v1 ? v1.status() : "no-response");
    log("  /api/events POST:", br ? br.status() : "no-response");
    await sleep(1500);
    await shot(page, "step5-after-submit");
  } else {
    log("  no submit");
  }

  // Look for the new tile in /v1/tiles
  const tilesRes = await page.request.get("http://127.0.0.1:31400/v1/tiles", {
    headers: { "x-owner-id": "00000000-0000-0000-0000-000000000001", "x-actor-id": "00000000-0000-0000-0000-000000000001" },
  });
  const tiles = await tilesRes.json();
  log("STEP 6: /v1/tiles -> " + tiles.length + " tiles; kinds:", tiles.map((t) => t.kind).join(","));
  log("  recent titles:", tiles.slice(0, 3).map((t) => t.title));

  // Check occurrences
  const today = new Date().toISOString().slice(0, 10);
  const occRes = await page.request.get(`${BASE}/api/events/occurrences?start=${today}T00:00:00.000Z&end=${today}T23:59:59.999Z&min_minutes=6&include_recurring=true`);
  const occ = await occRes.json();
  log("STEP 7: /api/events/occurrences -> " + (occ.occurrences || []).length + " items");
  for (const o of (occ.occurrences || []).slice(0, 5)) {
    log("    - " + (o.title || "?") + "  start=" + (o.start || "?") + "  end=" + (o.end || "?"));
  }

  await sleep(1500);
  await shot(page, "step8-final-day-view");

  // Click a calendar slot to test materialization flow
  log("STEP 9: hover & inspect 09:00 slot to see if anything draws");
  const slotInfo = await page.evaluate(() => {
    const slots = Array.from(document.querySelectorAll("[data-testid*='time-'], [data-hour], [class*='time-']"));
    return slots.slice(0, 5).map((s) => ({ testid: s.dataset.testid, text: s.textContent.trim().slice(0, 40) }));
  });
  log("  slot elements:", JSON.stringify(slotInfo, null, 2));

  log("---");
  log("CONSOLE ERRORS (" + errors.length + "):");
  for (const e of errors) log("  - " + e.slice(0, 200));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
