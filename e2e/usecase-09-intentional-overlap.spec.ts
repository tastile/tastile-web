// USECASE 09 — 意図的な重なり両実行 (intentional-overlap)
// Class: B — placement/overlap
// Drive: UI (timeline) — two placements that intentionally overlap
// (e.g. exercise + shower).  Both must render in the timeline and
// both can be started independently.
// Verify: GET /v1/timeline shows both placements.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";

test.describe("USECASE 09 — intentional-overlap", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("two overlapping placements both render in the timeline", async ({ request, page }) => {
    const day = "2026-09-01";
    const a = await v1CreatePlacementAndResolve(request, {
      title: "exercise " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T09:45:00Z`,
    });
    const b = await v1CreatePlacementAndResolve(request, {
      title: "shower " + Date.now(),
      start: `${day}T09:30:00Z`,
      end: `${day}T10:00:00Z`,
    });
    expect(a.placementId).not.toBe(b.placementId);

    await page.goto("/dashboard/calendar?view=day");

    const res = await request.get(
      `/api/proxy/v1/timeline?start=${encodeURIComponent(`${day}T00:00:00Z`)}&end=${encodeURIComponent(`${day}T23:59:59Z`)}`,
    );
    expect(res.status()).toBeLessThan(400);
    const items = (await res.json()) as Array<{ placementId?: string; placement_id?: string }>;
    const ids = items.map((i) => i.placementId ?? i.placement_id);
    expect(ids).toContain(a.placementId);
    expect(ids).toContain(b.placementId);
  });
});
