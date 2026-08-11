import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function deleteAllEvents(_page: Page) { 
  // /api/events is now 410 (v0 removed).  Wipe the v1 placement+plan rows
  // directly via docker exec so the day view is fully empty for the next test.
  execFileSync(
    "docker",
    [
      "exec", "tastile-core-db-1",
      "psql", "-U", "tastile", "-d", "tastile_db", "-c",
      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;",
    ],
    { stdio: "ignore" },
  );
}

test.describe.skip("quick tile create — project / tag / memo round-trip", () => {
  test.beforeEach(async ({ page }) => {
    await deleteAllEvents(page);
  });

  test("fill project + tag + memo, commit, occurrence contains all four fields", async ({ page }) => {
    const title = "Meta roundtrip " + Date.now();
    const project = "Project Alpha " + Date.now();
    const tag = "design" + Date.now().toString().slice(-4);
    const memo = "this is the memo body " + Date.now();

    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();

    await page.locator("input[aria-required='true']").first().fill(title);

    const projectInput = page.locator(
      "input[aria-label='Project name'], input[aria-label='プロジェクト名']",
    );
    await projectInput.fill(project);

    const tagInput = page.locator(
      "input[aria-label='Tag name'], input[aria-label='タグ名']",
    );
    await tagInput.fill(tag);
    await tagInput.press("Enter");

    const memoAddButton = page
      .getByRole("button", { name: /memoAdd|memoPlaceholder|Add a note|メモを追加|補足メモ/ })
      .first();
    await memoAddButton.click();
    const memoTextarea = page.locator(
      "textarea[aria-label='Add a note'], textarea[aria-label='補足メモ']",
    );
    await expect(memoTextarea).toBeVisible();
    await memoTextarea.fill(memo);

    const submit = page.getByTestId("quick-create-submit");
    const waitV1 = page.waitForResponse(
      (r) => r.url().includes("/v1/tiles") && r.request().method() === "POST",
    );
    const waitBridge = page.waitForResponse(
      (r) => r.url().endsWith("/api/events") && r.request().method() === "POST",
    );
    await submit.click();
    const [v1Res, bridgeRes] = await Promise.all([waitV1, waitBridge]);
    expect(v1Res.status()).toBeLessThan(400);
    expect(bridgeRes.status()).toBeLessThan(400);

    const occUrl = `/api/events/occurrences?start=${todayUtc()}T00:00:00.000Z&end=${todayUtc()}T23:59:59.999Z&min_minutes=6&include_recurring=true`;
    const occ = await page.request.get(occUrl);
    const occData = (await occ.json()) as {
      occurrences: Array<{
        id: string;
        title: string;
        project: string | null;
        tags: string[];
        memo: string | null;
      }>;
    };
    const matches = (occData.occurrences ?? []).filter((o) => o.title === title);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const found = matches[0]!;
    expect(found.project).toBe(project);
    expect(found.tags ?? []).toContain(tag);
    expect(found.memo).toBe(memo);
  });

  test("edit mode hides immutable fields (kind / role / windows) and exposes Delete", async ({ page }) => {
    const title = "Edit hide " + Date.now();
    await page.goto("/dashboard/calendar?view=day");

    await page.getByTestId("sidebar-new-tile").first().click();
    await page.locator("input[aria-required='true']").first().fill(title);
    await page.getByTestId("quick-create-submit").click();

    await expect(page.getByTestId("quick-create-submit")).toBeHidden();

    const dayTile = page.locator("button[data-tile-id]").filter({ hasText: title });
    await expect(dayTile.first()).toBeVisible();
    await dayTile.first().click();

    await expect(page.getByTestId("quick-create-delete")).toBeVisible();
    expect(await page.getByTestId("quick-create-tile-kind").count()).toBe(0);
    expect(await page.getByTestId("quick-create-plan-role").count()).toBe(0);
  });
});
