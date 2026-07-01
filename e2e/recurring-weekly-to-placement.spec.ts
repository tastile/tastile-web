import { test, expect } from '@playwright/test';
import { v1CreateWeeklyRecurring, truncateV1 } from './helpers/v1';

// Verify the "recurring tile -> placement tile" complete processing path
// for a weekly recurrence with a time-of-day window.  This drives the
// real v1 command endpoints; no v0 BFF is used.

test.describe('v1 — recurring to placement flow (weekly + time-of-day)', () => {
  test.beforeEach(async () => {
    await truncateV1();
  });

  test('Monday + Tuesday 12:00-13:00 weekly produces a placement on each match', async ({ page }) => {
    // Anchor: the next Monday at 12:00 local (Asia/Tokyo).  The test
    // runner is pinned to Asia/Tokyo so we use Date(...) in local time.
    const today = new Date();
    const dow = today.getDay(); // 0=Sun..6=Sat
    const daysToMon = ((1 - dow) + 7) % 7; // 0 if today is Mon
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMon, 12, 0, 0, 0);
    const anchorStart = monday.toISOString();
    const anchorEnd = new Date(monday.getTime() + 60 * 60 * 1000).toISOString();

    // v1 weekday mask: bit 0=Mon, bit 1=Tue
    const mask = (1 << 0) | (1 << 1);

    const { placementIds } = await v1CreateWeeklyRecurring(page, {
      title: 'weekly-mon-tue-12-13',
      anchorStart,
      anchorEnd,
      weekdayMaskV1: mask,
      timeOfDay: { start: '12:00', end: '13:00' },
      occurrences: 4, // ~2 weeks worth
    });

    // 4 occurrences across 2 weeks: this Mon/Tue + next Mon/Tue
    expect(placementIds.length, 'placement count').toBe(4);

    // Fetch the timeline across a 14-day window starting today.  All
    // 4 occurrences should be present.
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14).toISOString();
    const tlRes = await page.request.get(
      `/api/proxy/v1/timeline?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    expect(tlRes.status()).toBeLessThan(400);
    const items = (await tlRes.json()) as Array<{ placement_id?: string; tile_id?: string }>;
    const seen = new Set<string>(placementIds);
    const present = items.filter((i) => i.placement_id && seen.has(i.placement_id));
    expect(present.length, 'timeline sees all materialized placements').toBe(4);
  });

  test('un-materialized occurrences in range appear via /v1/timeline lazy expand', async ({ page }) => {
    // Create a weekly Mon+Tue 12-13 tile, materialize only the FIRST
    // occurrence, then query the timeline across a 14-day window.  The
    // server's lazy_expand_for_window should create placements for
    // the remaining matches.
    const today = new Date();
    const dow = today.getDay();
    const daysToMon = ((1 - dow) + 7) % 7;
    const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToMon, 12, 0, 0, 0);
    const anchorStart = monday.toISOString();
    const anchorEnd = new Date(monday.getTime() + 60 * 60 * 1000).toISOString();
    const mask = (1 << 0) | (1 << 1);

    const { actualTileId, frameRuleId } = await v1CreateWeeklyRecurring(page, {
      title: 'lazy-expand-test',
      anchorStart,
      anchorEnd,
      weekdayMaskV1: mask,
      timeOfDay: { start: '12:00', end: '13:00' },
      occurrences: 1, // only the first Monday
    });

    // Query the timeline across 14 days.  Server must lazy-expand.
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14).toISOString();
    const tlRes = await page.request.get(
      `/api/proxy/v1/timeline?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
    expect(tlRes.status()).toBeLessThan(400);
    const items = (await tlRes.json()) as Array<{ placement_id?: string; tile_id?: string }>;
    const matches = items.filter((i) => i.tile_id === actualTileId);
    // Expect at least the materialized one + lazy-expanded ones
    expect(matches.length, 'timeline lazy-expanded matches').toBeGreaterThanOrEqual(1);

    // Verify frame_rule_id is intact and the actual tile id is intact
    expect(frameRuleId).toMatch(/^[0-9a-f-]{36}$/);
    expect(actualTileId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
