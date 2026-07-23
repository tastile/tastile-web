import { test, expect, type Page } from "@playwright/test";

/**
 * Pilot coverage for the TanStack Query migration of useV1ActiveTile.
 *
 * The dashboard layout mounts `DashboardQueryProvider`, so every
 * /v1/active-tile read should be served from one shared cache. This
 * spec intercepts the proxy endpoint and verifies:
 *   - the active-tile is fetched once on mount
 *   - the V1ExecutionControls render once a snapshot with an
 *     execution_id is returned
 *   - dispatching `tastile:execution-changed` triggers exactly one
 *     additional refetch (no thundering herd from per-hook timers)
 *
 * Uses `page.route` so the test does not require a live daemon.
 */

const ACTIVE_TILE = {
  tile_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8e",
  placement_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8f",
  execution_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d90",
  title: "Plan the launch",
  span_start: "2026-07-23T09:00:00.000Z",
  span_end: "2026-07-23T10:00:00.000Z",
};

async function interceptActiveTile(page: Page, body: unknown) {
  await page.route("**/api/proxy/read/active-tile", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

test.describe("useV1ActiveTile (TanStack Query pilot)", () => {
  test("renders controls on first fetch and refetches once on execution-changed", async ({ page }) => {
    const calls: string[] = [];
    await page.route("**/api/proxy/read/active-tile", async (route) => {
      calls.push(Date.now().toString());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ACTIVE_TILE),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Pause execution" })).toBeVisible({ timeout: 10_000 });
    expect(calls.length).toBe(1);

    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
    });

    // Allow the invalidate-driven refetch to settle but well under
    // the 5-second polling interval, so any extra call would be the
    // invalidation only.
    await page.waitForFunction(
      () => document.querySelectorAll('[aria-label="Pause execution"]').length > 0,
      undefined,
      { timeout: 2_000 },
    );
    await page.waitForTimeout(500);

    expect(calls.length).toBe(2);
  });

  test("renders no-controls state when the server reports no active tile", async ({ page }) => {
    await interceptActiveTile(page, null);

    await page.goto("/dashboard");
    await expect(page.getByText("実行なし")).toBeVisible({ timeout: 10_000 });
  });

  test("renders no-controls state when the payload is malformed", async ({ page }) => {
    await page.route("**/api/proxy/read/active-tile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ tile_id: "not-a-uuid", title: 42 }),
      });
    });

    await page.goto("/dashboard");
    await expect(page.getByText("実行なし")).toBeVisible({ timeout: 10_000 });
  });
});
