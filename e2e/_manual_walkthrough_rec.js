const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const SHOT = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots";
fs.mkdirSync(SHOT, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log("[rec]", ...a);
async function shot(page, name) {
  const file = path.join(SHOT, `${Date.now()}-${name}.png`);
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
      try { body = (await r.text()).slice(0, 200); } catch {}
      responseLog.push({ status: r.status(), url: u.replace("http://127.0.0.1:3000", ""), body });
    }
  });
  page.on("console", (m) => log("CONSOLE", m.type(), m.text()));
  page.on("pageerror", (e) => log("PAGEERROR", e.message));

  await page.goto(`${BASE}/dashboard/calendar`, { waitUntil: "networkidle" });
  await sleep(2000);
  await shot(page, "rec01-dashboard");

  // Open new tile panel
  await page.getByTestId("sidebar-new-tile").first().click();
  await sleep(800);
  await shot(page, "rec02-new-tile");

  // Click 定期 radio
  const recRadio = page.locator('button[role=radio]').filter({ hasText: /^定期$/ });
  const count = await recRadio.count();
  log("recurring radio count:", count);
  if (count > 0) {
    await recRadio.first().click({ force: true });
    await sleep(400);
    await shot(page, "rec03-after-click-recurring");
  }

  // Set title
  const title = "REC-WALK-" + Date.now();
  const titleInput = page.locator('input[type="text"]').first();
  await titleInput.click();
  await titleInput.fill(title);
  await sleep(300);
  await shot(page, "rec04-title");

  // Click 作成
  const submit = page.getByRole("button", { name: "作成" });
  const subCount = await submit.count();
  log("submit count:", subCount);
  if (subCount > 0) {
    await submit.first().click({ force: true });
    await sleep(2500);
    await shot(page, "rec05-after-submit");
  }

  log("=== REQUESTS ===");
  for (const r of requestLog) log("  REQ", r.method, r.url);
  log("=== RESPONSES ===");
  for (const r of responseLog) log("  RES", r.status, r.url, "->", r.body);

  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
