// USECASE 03 — 5h ごと日付境界並列 Worker (5h-worker-horizon)
// Class: A — recurring/label/frame
// Drive: API only — SourceTile with step_ms = 5h crossing a date
// boundary must produce a placement every 5h even across midnight.
// Verify: GET /v1/timeline shows >= 4 placements (5h × 4 = 20h
// coverage, including the midnight crossing).
//
// Helpers: source-tile.ts + poll.ts
// Verify: GET /v1/timeline
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile } from "./helpers/source-tile";
import { pollUntil } from "./helpers/poll";

test.describe("USECASE 03 — 5h-worker-horizon", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("5h step emits a placement every 5h, crossing midnight", async ({ request }) => {
    const stepMs = 5 * 60 * 60 * 1000;
    const horizonStart = "2026-08-09T20:00:00Z"; // crosses midnight to 10/09T01:00:00Z
    const horizonEnd = "2026-08-10T16:00:00Z";
    await v1CreateSourceTile(request, {
      title: "5h worker " + Date.now(),
      horizonStart,
      horizonEnd,
      stepMs,
    });

    const url = `/api/proxy/v1/timeline?start=${encodeURIComponent(horizonStart)}&end=${encodeURIComponent(horizonEnd)}`;
    const items = await pollUntil(
      async () => {
        const res = await request.get(url);
        expect(res.status(), "GET /v1/timeline").toBeLessThan(400);
        return (await res.json()) as Array<{ placement_id: string }>;
      },
      {
        predicate: (items) => items.length >= 4,
        label: "5h-worker materialize",
        timeoutMs: 10_000,
      },
    );
    expect(items.length).toBeGreaterThanOrEqual(4);
  });
});
