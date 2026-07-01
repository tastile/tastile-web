import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";

// UI-driven end-to-end test for the periodic (Recurring) tile -> placement
// tile flow: open the QuickTileCreate panel, switch the kind picker to
// Recurring, fill title + start/end, submit, and assert the placement
// is materialized and visible in /api/events/occurrences with
// source.kind = 1 (recurring-sourced).

function todayUtc(): string {
  // Use the date in the user's local timezone (the test runner is
  // pinned to Asia/Tokyo). UTC-vs-local would otherwise drop events
  // created at the day boundary because the day view queries
  // [localMidnight, localMidnight+24h).
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function isoAtUtc(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

async function deleteAllEvents(_req: APIRequestContext) {
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

test.describe("quick tile create — recurring e2e", () => {
  test.beforeEach(async ({ request }) => {
    await deleteAllEvents(request);
  });

  test("sidebar + opens panel, switches kind to Recurring, fills title, submits, placement appears in occurrences", async ({
    page,
  }) => {
    const title = "Daily Recurring " + Date.now();
    // Query a 48h window around today in Tokyo so the placement landed at
  // the panel's default "next 30-min boundary" (which may sit on the
  // UTC day boundary near midnight JST) is always in range.
  const day = todayUtc();
  const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const next = new Date(new Date(day + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
    const startIso = isoAtUtc(day, 9, 0);
    const endIso = isoAtUtc(day, 10, 0);

    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    // Switch the kind picker to Recurring.
    const kindGroup = page.getByTestId("quick-create-tile-kind");
    await expect(kindGroup).toBeVisible();
    await kindGroup.getByRole("radio", { name: /Recurring|定期|周期|繰り返し/i }).click();

    // Fill title.
    await page.locator("input[aria-required=\"true\"]").first().fill(title);

    // Submit.
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(submit).not.toBeVisible();

    // The recurring's first placement should appear in occurrences
    // today (9:00-10:00 UTC) with source.kind = 1.
    const occUrl = `/api/events/occurrences?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z&min_minutes=0&include_recurring=true`;
    const occ = await page.request.get(occUrl);
    expect(occ.ok()).toBeTruthy();
    const occData = (await occ.json()) as {
      occurrences: Array<{ title: string; source?: { kind?: number } }>;
    };
    const match = (occData.occurrences ?? []).find((o) => o.title === title);
    expect(match, `expected placement with title "${title}" in occurrences`).toBeDefined();
    expect(match?.source?.kind, "expected source.kind = 1 (recurring)").toBe(1);

    // And the v1 /v1/timeline should include a placement sourced from
    // the new recurring tile.
    const ownerId = "00000000-0000-0000-0000-000000000001";
    const actorId = "00000000-0000-0000-0000-000000000001";
    const tlRes = await page.request.get(
      `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z`,
      { headers: { "x-owner-id": ownerId, "x-actor-id": actorId } },
    );
    expect(tlRes.ok()).toBeTruthy();
    const tl = (await tlRes.json()) as Array<{
      content: { title: string };
      source: { kind: number };
    }>;
    const tlMatch = (tl ?? []).find((p) => p.content?.title === title);
    expect(tlMatch, "expected placement in /v1/timeline").toBeDefined();
    expect(tlMatch?.source.kind, "expected /v1/timeline source.kind = 1 (recurring)").toBe(1);
  });
});
