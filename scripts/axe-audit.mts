// axe-audit.mjs — Run axe-core against tastile-web dashboard pages
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SCREENS = [
  { name: "dashboard-tasks", url: "/dashboard/tasks" },
];

const outDir = path.resolve("evidence/2026-07-29-dashboard-polish");
fs.mkdirSync(outDir, { recursive: true });

const results = {};

for (const screen of SCREENS) {
  console.log(`Auditing: ${screen.name} (${BASE}${screen.url})`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}${screen.url}`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1000);

  // Inject axe-core from node_modules
  const axePath = path.resolve("node_modules/axe-core/axe.min.js");
  await page.addScriptTag({ path: axePath });

  const audit = await page.evaluate(async () => {
    // @ts-ignore — axe is now on window
    return window.axe.run({ exclude: [["#__next-build-watcher"]] });
  });

  results[screen.name] = {
    violations: audit.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      description: v.description,
      nodes: v.nodes.length,
    })),
    passes: audit.passes.length,
    incomplete: audit.incomplete.length,
  };

  await browser.close();
}

fs.writeFileSync(
  path.join(outDir, "axe-audit.json"),
  JSON.stringify(results, null, 2),
);

console.log(JSON.stringify(results, null, 2));

const critical = Object.values(results).flatMap((r) =>
  r.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
);

if (critical.length > 0) {
  console.error("\n❌ AXE AUDIT FAILED: critical/serious violations present");
  console.error(JSON.stringify(critical, null, 2));
  process.exit(1);
}

console.log("\n✅ AXE AUDIT PASS: 0 critical/serious violations");
