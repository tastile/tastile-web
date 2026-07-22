// Verify dashboard behavior using a real Chrome browser talking raw CDP over
// Bun's native WebSocket (avoids Playwright's transport quirks on this host).
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const URL = "http://127.0.0.1:3000";
const OUT = "C:/Users/rebui/Desktop/tastile/tastile-web/.verify-screenshots";
const CHROME = "C:/Users/rebui/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe";
const PORT = 9334;
mkdirSync(OUT, { recursive: true });

async function fetchJson(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  if (!r.ok) {
    throw new Error(`fetchJson ${path} failed: ${r.status}`);
  }
  return r.json();
}

async function waitForChrome(ms = 30000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const v = await fetchJson("/json/version");
      if (v?.webSocketDebuggerUrl) return v;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("chrome did not start");
}

let nextId = 1;
const pending = new Map();
const sessions = new Map();

function makeClient(wsUrl, label) {
  const ws = new WebSocket(wsUrl);
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method && msg.sessionId) {
      sessions.set(msg.sessionId, label);
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", (e) => reject(e));
  });
}

function call(ws, method, params = {}, sessionId) {
  const id = nextId++;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify(payload));
  });
}

async function main() {
  // Start Chrome
  const child = spawn(CHROME, [
    `--remote-debugging-port=${PORT}`,
    "--no-sandbox",
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=C:/Users/rebui/AppData/Local/Temp/chrome-tastile2",
    "about:blank",
  ], { stdio: ["ignore", "ignore", "ignore"] });

  const v = await waitForChrome();
  console.log("chrome version:", v.Browser);

  const browser = await makeClient(v.webSocketDebuggerUrl, "browser");

  // Create new tab (target)
  const target = await call(browser, "Target.createTarget", { url: "about:blank" });
  const sessionId = target.sessionId;
  const targetWs = v.webSocketDebuggerUrl.replace(/\/browser\/.*/, `/page/${sessionId}`);

  // Wait — sessionId isn't returned from createTarget in this form.
  // Use Target.attachToTarget via browser ws with sessionId-as-string.
  // Easier: get target list, find one, attach.
  const targets = await call(browser, "Target.getTargets");
  console.log("targets:", targets.targetInfos.map((t) => ({ id: t.id, type: t.type, url: t.url })));

  const pageTarget = targets.targetInfos.find((t) => t.type === "page") ?? targets.targetInfos[0];
  const attach = await call(browser, "Target.attachToTarget", { targetId: pageTarget.targetId, flatten: true });
  const sid = attach.sessionId;
  console.log("attached to page targetId=", pageTarget.targetId, "sessionId=", sid);

  async function cdp(method, params = {}) {
    return call(browser, method, params, sid);
  }

  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("DOM.enable");
  await cdp("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });

  const navigationResponses = [];
  const cdp2 = await import("node:events");

  async function visit(path, name) {
    const navP = new Promise((resolve) => {
      const handler = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.method === "Network.responseReceived" && m.sessionId === sid) {
          const r = m.params.response;
          if (r.url.startsWith(URL) && !navigationResponses.some((x) => x.url === r.url)) {
            navigationResponses.push({ url: r.url, status: r.status });
          }
        }
        if (m.method === "Page.loadEventFired" && m.sessionId === sid) resolve();
      };
      browser.addEventListener("message", handler);
      setTimeout(() => { browser.removeEventListener("message", handler); resolve(); }, 15000);
    });
    await cdp("Page.navigate", { url: `${URL}${path}` });
    await navP;
    await new Promise((r) => setTimeout(r, 800));

    const tree = await cdp("DOM.getDocument", { depth: -1 });
    const title = await cdp("Runtime.evaluate", { expression: "document.title" });
    const heading = await cdp("Runtime.evaluate", {
      expression: "document.querySelector('h1,h2,h3')?.textContent ?? ''",
      returnByValue: true,
    });
    const url = await cdp("Runtime.evaluate", { expression: "location.href", returnByValue: true });
    const bodyLen = await cdp("Runtime.evaluate", {
      expression: "document.body?.innerText?.length ?? 0",
      returnByValue: true,
    });
    const ss = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(ss.data, "base64"));

    return {
      path,
      status: 200,
      finalUrl: url.result.value,
      title: title.result.value,
      heading: heading.result.value,
      bodyLen: bodyLen.result.value,
    };
  }

  const results = [];
  results.push(await visit("/", "01-root"));
  results.push(await visit("/dashboard", "02-dashboard"));
  if (!results[1].finalUrl.includes("/login")) {
    results.push(await visit("/dashboard/timeline", "03-timeline"));
    results.push(await visit("/dashboard/schedule", "04-schedule"));
    results.push(await visit("/dashboard/tasks", "05-tasks"));
  }

  // Probe the API paths that the dashboard calls
  const apiChecks = [];
  async function api(path, expected = 200) {
    const r = await fetch(`${URL}${path}`, { redirect: "manual" });
    if (r.status !== expected) {
      // Unexpected status — capture status + body slice for the diagnostic log.
      return { path, status: r.status, body: (await r.text()).slice(0, 200) };
    }
    const body = (await r.text()).slice(0, 200);
    return { path, status: r.status, body };
  }
  apiChecks.push(await api("/api/auth/session"));
  apiChecks.push(await api("/api/me"));

  console.log("\n=== page visits ===");
  for (const r of results) console.log(r);
  console.log("\n=== API checks ===");
  for (const r of apiChecks) console.log(r);

  child.kill();
  const allOk = results.every((r) => r.status === 200 && !r.finalUrl.includes("/login"));
  console.log(allOk ? "\nALL GREEN" : "\nFAIL");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
