import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { v1AuthHeaders } from "./helpers/v1";

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents(_page: Page) {
  // /api/events is now 410 (v0 removed).  Wipe the v1 placement+plan rows
  // directly via wslc container exec so the day view is fully empty for the next test.
  execFileSync(
    "wslc",
    [
      "container", "exec", "tastile-dev-api",
      "psql", "-U", "tastile", "-d", "tastile", "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation RESTART IDENTITY CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

test.describe("quick tile create e2e", () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test("sidebar + opens panel, fills title, submits, and event appears on day view", async ({ page }) => {
    const title = "E2E sidebar " + Date.now();
    await page.goto("/dashboard/calendar?view=day");

    await page.getByTestId("sidebar-new-tile").first().click();
    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    const beforeDisabled = await submit.isDisabled();
    expect(beforeDisabled).toBe(true);

    await page.locator("input[aria-required=\"true\"]").first().fill(title);

    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(submit).not.toBeVisible();

    // Query a 48h window around today in Tokyo so a placement landed at
    // the panel default "next 30-min boundary" (which may sit on the
    // UTC day boundary near midnight JST) is always in range.
    const day = todayUtc();
    const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // The title must appear in the v1 timeline (read path).
    // /api/events/occurrences is v0 (410 Gone) — replaced by
    // /api/proxy/v1/timeline returning EffectivePlacement[].
    const tlRes = await page.request.get(
      `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z`,
      { headers: v1AuthHeaders() },
    );
    expect(tlRes.ok()).toBeTruthy();
    const tlData = (await tlRes.json()) as Array<{ content?: { title?: string } }>;
    const tlTitles = (tlData ?? []).map((p) => p.content?.title);
    expect(tlTitles).toContain(title);
  });
});

