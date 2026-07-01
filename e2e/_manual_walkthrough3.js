// Manual walkthrough v3: deep-inspect the quick-create panel for the
// \u5b9a\u671f / Recurring tab.  The previous run couldn't find it.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const SHOT_DIR = "C:\\Users\\rebui\\Desktop\\tastile\\tastile-web\\manual-shots";
fs.mkdirSync(SHOT_DIR, { recursive: true });
const BASE = "http://127.0.0.1:3000";
const log = (...a) => console.log("[walk3]", ...a);
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
  await page.goto(`${BASE}/dashboard/calendar`, { waitUntil: "networkidle" });
  await sleep(2000);

  // Open new-tile panel
  await page.getByTestId("sidebar-new-tile").first().click();
  await sleep(800);
  await shot(page, "v3-panel");

  // Dump every button + role on the panel.
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button, [role=radio], [role=tab], [role=button]"))
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        testid: el.dataset?.testid,
        text: (el.textContent || "").trim().slice(0, 40),
        aria: el.getAttribute("aria-label"),
        ariaPressed: el.getAttribute("aria-pressed"),
        ariaSelected: el.getAttribute("aria-selected"),
        visible: !!(el.offsetParent),
      }))
      .filter((b) => b.visible);
  });
  log("VISIBLE BUTTONS / RADIOS / TABS:");
  for (const b of buttons) log("  " + JSON.stringify(b));

  // Specifically find anything mentioning \u5b9a\u671f
  const recCandidates = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all
      .filter((el) => {
        const t = (el.textContent || "").trim();
        return (t === "\u5b9a\u671f" || t === "Recurring" || t.includes("Recurring") || t.includes("\u5b9a\u671f")) && (el.tagName === "BUTTON" || el.getAttribute("role") === "radio" || el.getAttribute("role") === "tab" || el.tagName === "LABEL" || el.tagName === "SPAN" || el.tagName === "DIV");
      })
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        testid: el.dataset?.testid,
        text: el.textContent.trim().slice(0, 30),
        classes: el.className.slice(0, 80),
        ariaPressed: el.getAttribute("aria-pressed"),
        dataState: el.getAttribute("data-state"),
      }));
  });
  log("RECURRING-CANDIDATES:");
  for (const c of recCandidates) log("  " + JSON.stringify(c));

  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
