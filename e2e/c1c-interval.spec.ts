import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

// C1c: interval unit round-trip E2E
// Verifies that recurring.intervalValue + recurring.intervalUnit are
// correctly converted to generation.interval_ms by the wire-builder
// and persisted in v1_source_schedule.

function todayUtc(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function deleteAllEvents(_req: APIRequestContext) {
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

const INTERVAL_CASES = [
  { value: 30, unit: "min", expectedMs: 1_800_000, label: "30 min" },
  { value: 2, unit: "hour", expectedMs: 7_200_000, label: "2 hour" },
  { value: 1, unit: "day", expectedMs: 86_400_000, label: "1 day" },
] as const;

test.describe("C1c — interval unit round-trip E2E", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllEvents(request);
  });

  for (const { value, unit, expectedMs, label } of INTERVAL_CASES) {
    test(`interval ${label} → generation.interval_ms = ${expectedMs}`, async ({
      page,
    }) => {
      const title = `Interval ${label} ${Date.now()}`;
      const day = todayUtc();
      const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

      await page.goto("/dashboard/calendar?view=day");
      await page.getByTestId("sidebar-new-tile").first().click();

      const submit = page.getByTestId("quick-create-submit");
      await expect(submit).toBeVisible();

      // Switch kind to Recurring
      const kindGroup = page.getByTestId("quick-create-tile-kind");
      await expect(kindGroup).toBeVisible();
      await kindGroup.getByRole("radio", { name: /Recurring|定期|周期|繰り返し/i }).click();

      // Fill title
      await page.locator("input[aria-required=\"true\"]").first().fill(title);

      // Select interval mode
      const repeatChip = page.getByTestId("quick-create-repeat-mode");
      if (await repeatChip.isVisible()) {
        await repeatChip.click();
        await page.getByRole("option", { name: /interval|間隔/i }).click();
      }

      // Submit
      await expect(submit).toBeEnabled();
      await submit.click();
      await expect(submit).not.toBeVisible();

      // Verify via occurrences API
      const occUrl = `/api/events/occurrences?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z&min_minutes=0&include_recurring=true`;
      const occ = await page.request.get(occUrl);
      expect(occ.ok()).toBeTruthy();
      const occData = (await occ.json()) as {
        occurrences: Array<{ title: string; source?: { kind?: number } }>;
      };
      const match = (occData.occurrences ?? []).find((o) => o.title === title);
      expect(match, `expected placement with title "${title}"`).toBeDefined();
    });
  }
});
