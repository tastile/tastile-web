import { test, expect } from "@playwright/test";
import { v1AuthHeaders, resetDb } from "./helpers/v1";
import { execFileSync } from "node:child_process";

// UI-driven end-to-end test for the periodic (Recurring) tile -> placement
// tile flow: open the QuickTileCreate panel, switch the kind picker to
// Recurring, fill title + start/end, submit, and assert the placement
// is materialized and visible in /v1/timeline with source.kind = 1.

function todayUtc(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function isoAtUtc(date: string, hour: number, minute: number): string {
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;
}

function wslcPsql(sql: string): string {
  return execFileSync(
    "wslc",
    ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-tA", "-c", sql],
    { encoding: "utf8", timeout: 15_000 },
  ).trim();
}

test.describe("quick tile create — recurring e2e", () => {
  test.beforeEach(async () => {
    // recurring source tiles (v1_tile) + v1_annotation get cleared
    // alongside placements — see helpers/v1.ts resetDb()
    await resetDb();
  });

  test("sidebar + opens panel, switches kind to Recurring, fills title, submits, placement appears in timeline", async ({
    page,
  }) => {
    const title = "Daily Recurring " + Date.now();
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

    // v1 /v1/timeline is the only post-submit verification —
    // /api/events/occurrences is v0 (410 Gone). The recurring's first
    // placement should appear today with source.kind = 1.
    const tlRes = await page.request.get(
      `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${next}T23:59:59.999Z`,
      { headers: v1AuthHeaders() },
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

  test("canonical weekly Mon-Fri produces ~10 placements over 14 days", async ({
    page,
  }) => {
    const title = "Canonical Mon-Fri " + Date.now();
    const day = todayUtc();
    const start = day;
    const end = new Date(new Date(day + "T00:00:00Z").getTime() + 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const prev = new Date(new Date(day + "T00:00:00Z").getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const windowEnd = new Date(new Date(end + "T00:00:00Z").getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();

    const submit = page.getByTestId("quick-create-submit");
    await expect(submit).toBeVisible();

    // Switch kind to Recurring.
    const kindGroup = page.getByTestId("quick-create-tile-kind");
    await kindGroup.getByRole("radio", { name: /Recurring|定期|周期|繰り返し/i }).click();

    // Fill title.
    await page.locator("input[aria-required=\"true\"]").first().fill(title);

    // Fill recurring fields: weekly Mon-Fri (weekdayMask 31), life 14d.
    await page.getByTestId("quick-create-recurring-weekday-mask").fill("31");
    await page.getByTestId("quick-create-recurring-life-start").fill(start);
    await page.getByTestId("quick-create-recurring-life-end").fill(end);

    await submit.click();
    await expect(submit).not.toBeVisible();

    // Wait for worker to materialize placements (poll loop, ~10s max).
    const expected = 10; // 14d × Mon-Fri = 10 weekdays, 0 Sundays in window
    let count = 0;
    for (let i = 0; i < 20; i++) {
      const res = await page.request.get(
        `/api/proxy/v1/timeline?start=${prev}T00:00:00.000Z&end=${windowEnd}T23:59:59.999Z`,
        { headers: v1AuthHeaders() },
      );
      expect(res.ok()).toBeTruthy();
      const tl = (await res.json()) as Array<{ content: { title: string } }>;
      count = (tl ?? []).filter((p) => p.content?.title === title).length;
      if (count >= expected) break;
      await page.waitForTimeout(500);
    }
    expect(count, `expected ${expected} placements for Mon-Fri over 14d`).toBeGreaterThanOrEqual(expected);

    // DB-level assertion: SourceTile fields via wslc psql.
    // Canonical columns: generation_kind, generation_weekday_mask,
    // generation_interval_ms, generation_offset_min, generation_date_range_end,
    // split_kind, priority (all flat columns on v1_source_tile).
    const scheduleRow = wslcPsql(
      "SELECT generation_kind::text, generation_weekday_mask::text, " +
        "generation_interval_ms::text, generation_offset_min::text, " +
        "generation_date_range_end::text, split_kind::text, priority::text " +
        "FROM v1_source_tile WHERE generation_weekday_mask = 31 " +
        "ORDER BY created_at DESC LIMIT 1;",
    );
    const fields = scheduleRow.split("|");
    expect(fields[0], "generation_kind").toBe("1");
    expect(fields[1], "generation_weekday_mask").toBe("31");
    expect(fields[2], "generation_interval_ms").toBe("1800000");
    expect(fields[3], "generation_offset_min").toBe("540");
    expect(fields[4], "generation_date_range_end").toBe(end);
    expect(fields[5], "split_kind").toBe("0");
    expect(fields[6], "priority").toBe("5");

    // DB-level assertion: placement count matches expected weekdays.
    const placementCount = Number(wslcPsql(
      "SELECT count(*) FROM v1_placement p " +
      "JOIN v1_source_tile s ON p.source_tile_id = s.source_tile_id " +
      "WHERE s.generation_weekday_mask = 31;",
    ));
    expect(placementCount, `expected ~${expected} placements with weekday_mask=31`).toBeGreaterThanOrEqual(expected);
  });
});
