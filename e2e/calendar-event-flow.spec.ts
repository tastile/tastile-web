import { test, expect, type Page } from "@playwright/test";
import { truncateV1, v1CreatePlacement, type V1TimelineItem } from "./helpers/v1";

function uniqueTitle(prefix: string): string {
  return prefix + " " + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

async function listPlacements(page: Page, start: string, end: string): Promise<V1TimelineItem[]> {
  const res = await page.request.get(
    "/api/proxy/v1/timeline?start=" + encodeURIComponent(start) + "&end=" + encodeURIComponent(end),
  );
  return (await res.json()) as V1TimelineItem[];
}

test.describe("calendar event flow", () => {
  test.beforeEach(async () => {
    await truncateV1();
  });

  test.skip("create -> list-view -> edit -> delete", async ({ page }) => {
    const title = uniqueTitle("Team sync");
    const updatedTitle = uniqueTitle("Team sync v2");
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
    const start = day + "T10:00:00.000Z";
    const end = day + "T11:00:00.000Z";

    await page.goto("/dashboard/calendar");
    await expect(page.getByTestId("calendar-main")).toBeVisible();
    await expect(page.getByTestId("cal-title")).toBeVisible();

    await page.getByTestId("cal-view-list").click();
    await expect(page.getByTestId("event-list")).toBeVisible();
    await expect(page.getByTestId("event-list")).toContainText(
      "No events yet. Click + to create one.",
    );

    await page.getByTestId("cal-create").click();
    const dialog = page.getByTestId("event-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("event-title").fill(title);
    await page.getByTestId("event-location").fill("Conference room A");
    await page.getByTestId("event-description").fill("Initial agenda");
    await page.getByTestId("event-color-green").click();
    await page.getByTestId("event-save").click();
    await expect(dialog).not.toBeVisible();

    const after = await listPlacements(page, start, end);
    expect(after).toHaveLength(1);
    expect(after[0]?.content?.title).toBe(title);
    const placementId = after[0]?.placementId ?? after[0]?.placement_id ?? "";

    const listItem = page.getByTestId("event-list-item-" + placementId);
    await expect(listItem).toBeVisible();
    await expect(listItem).toContainText(title);
    await expect(listItem).toContainText("Conference room A");

    await listItem.click();
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("event-title")).toHaveValue(title);
    await page.getByTestId("event-title").fill(updatedTitle);
    await page.getByTestId("event-save").click();
    await expect(dialog).not.toBeVisible();

    const after2 = await listPlacements(page, start, end);
    expect(after2).toHaveLength(1);
    expect(after2[0]?.content?.title).toBe(updatedTitle);

    const updatedItem = page.getByTestId("event-list-item-" + placementId);
    await updatedItem.click();
    await expect(dialog).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await page.getByTestId("event-delete").click();
    await expect(dialog).not.toBeVisible();

    const after3 = await listPlacements(page, start, end);
    expect(after3).toHaveLength(0);
  });

  test.skip("month view shows event on correct day", async ({ page }) => {
    const title = uniqueTitle("All-hands");
    const today = new Date();
    const yyyy = today.getUTCFullYear();
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const dayStr = yyyy + "-" + mm + "-" + dd;

    await v1CreatePlacement(page, {
      title,
      start: dayStr + "T15:00:00.000Z",
      end: dayStr + "T16:00:00.000Z",
    });

    await page.goto("/dashboard/calendar");
    await page.getByTestId("cal-view-month").click();
    const monthDay = page.getByTestId("month-day-" + dayStr);
    await expect(monthDay).toBeVisible();
    await expect(monthDay).toContainText(title);
  });
});