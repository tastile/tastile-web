import { test, expect } from "@playwright/test";

test.skip("debug quick tile submit with network capture", async ({ page }) => {
  const reqs: unknown[] = [];
  const resps: unknown[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/v1/tiles") || r.url().includes("/v1/placements") || r.url().includes("/api/proxy/v1/")) {
      reqs.push({ url: r.url(), method: r.method(), postData: r.postData() });
    }
  });
  page.on("response", async (r) => {
    if (r.url().includes("/v1/tiles") || r.url().includes("/v1/placements") || r.url().includes("/api/proxy/v1/")) {
      let body = null;
      try { body = await r.text(); } catch (e) { void e; }
      resps.push({ url: r.url(), status: r.status(), body });
    }
  });

  await page.goto("/dashboard/calendar?view=day");
  await page.getByTestId("sidebar-new-tile").first().click();
  const submit = page.getByTestId("quick-create-submit");
  await expect(submit).toBeVisible();
  await page.locator("input[aria-required=\"true\"]").first().fill("Debug title " + Date.now());
  await expect(submit).toBeEnabled();
  await submit.click();

  await page.waitForTimeout(2000);
  console.log("REQUESTS=" + JSON.stringify(reqs, null, 2));
  console.log("RESPONSES=" + JSON.stringify(resps, null, 2));
});
