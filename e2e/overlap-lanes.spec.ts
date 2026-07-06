import { test, expect } from "@playwright/test";
import { truncateV1, v1CreatePlacement } from "./helpers/v1";

function todayUtc(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

test.describe("overlap lane assignment", () => {
  test.beforeEach(async () => {
    await truncateV1();
  });

  test("three overlapping events in day view get distinct lanes", async ({ page }) => {
    const day = todayUtc();
    const mk = (title: string, startH: number, endH: number, color: string) =>
      v1CreatePlacement(page, {
        title,
        start: day + "T" + String(startH).padStart(2, "0") + ":00:00.000Z",
        end: day + "T" + String(endH).padStart(2, "0") + ":00:00.000Z",
        color,
      });

    const a = await mk("LaneTest A", 10, 12, "blue");
    const b = await mk("LaneTest B", 11, 13, "green");
    const c = await mk("LaneTest C", 11, 12, "orange");
    expect(a.placementId).toBeTruthy();
    expect(b.placementId).toBeTruthy();
    expect(c.placementId).toBeTruthy();

    await page.goto("/dashboard/calendar?view=day");
    await expect(page.getByTestId("calendar-main")).toBeVisible();

    const aBtn = page.getByTestId(/^day-event-/).filter({ hasText: "LaneTest A" });
    const bBtn = page.getByTestId(/^day-event-/).filter({ hasText: "LaneTest B" });
    const cBtn = page.getByTestId(/^day-event-/).filter({ hasText: "LaneTest C" });
    await expect(aBtn).toBeVisible();
    await expect(bBtn).toBeVisible();
    await expect(cBtn).toBeVisible();

    const aBox = await aBtn.boundingBox();
    const bBox = await bBtn.boundingBox();
    const cBox = await cBtn.boundingBox();
    expect(aBox).not.toBeNull();
    expect(bBox).not.toBeNull();
    expect(cBox).not.toBeNull();
    if (!aBox || !bBox || !cBox) return;

    const widths = [aBox.width, bBox.width, cBox.width].sort((x, y) => x - y);
    const tolerance = 8;
    expect(widths[2]! - widths[0]!).toBeLessThanOrEqual(tolerance);

    const centers = [aBox.x + aBox.width / 2, bBox.x + bBox.width / 2, cBox.x + cBox.width / 2].sort((x, y) => x - y);
    const span = centers[2]! - centers[0]!;
    expect(span).toBeGreaterThan(20);
  });

  test("5-minute break is hidden by default (min_minutes=6)", async ({ page }) => {
    const day = todayUtc();
    await v1CreatePlacement(page, {
      title: "Short break",
      start: day + "T10:00:00.000Z",
      end: day + "T10:05:00.000Z",
      color: "gray",
    });
    await page.goto("/dashboard/calendar?view=day");
    const chip = page.getByTestId(/^day-event-/).filter({ hasText: "Short break" });
    await expect(chip).toHaveCount(0);
  });
});