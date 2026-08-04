// axe-audit-detail.mjs — Detailed axe-core audit with node info
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const page = await (await chromium.launch({ headless: true })).newPage();
await page.goto(`${BASE}/dashboard/tasks`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);

const axePath = path.resolve("node_modules/axe-core/axe.min.js");
await page.addScriptTag({ path: axePath });

const audit = await page.evaluate(async () => {
  return window.axe.run({ exclude: [["#__next-build-watcher"]] });
});

// Show details for critical + serious violations
for (const v of audit.violations) {
  if (v.impact === "critical" || v.impact === "serious") {
    console.log(`\n=== ${v.id} (${v.impact}) ===`);
    console.log(`Help: ${v.help}`);
    console.log(`Description: ${v.description}`);
    for (const node of v.nodes) {
      console.log(`\n  Target: ${node.target.join(", ")}`);
      console.log(`  HTML: ${node.html?.substring(0, 200)}`);
      if (node.any?.length) console.log(`  Issues: ${node.any.map(a => a.message).join("; ")}`);
      if (node.all?.length) console.log(`  All: ${node.all.map(a => a.message).join("; ")}`);
    }
  }
}

await page.close();
process.exit(0);
