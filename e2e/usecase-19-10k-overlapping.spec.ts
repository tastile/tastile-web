// USECASE 19 — 10,000 件重叠 (10k-overlapping)
// Class: C — extreme/precision/load
// Drive: API only — materialize 10,000 placements at the same window
// (or via a SourceTile with step_ms = 1 sec for ~3h coverage).
// Verify: GET /v1/timeline?page=N returns placements paginated, total
// >= 10000.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile } from "./helpers/source-tile";
import { pollUntil } from "./helpers/poll";

test.describe("USECASE 19 — 10k-overlapping", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("1-second step over ~3 hours yields >= 10k placements", async ({ request }) => {
    const stepMs = 1_000;
    const horizonStart = "2026-09-01T00:00:00Z";
    // 10,000 sec ≈ 2.78h
    const horizonEnd = "2026-09-01T02:47:00Z";
    await v1CreateSourceTile(request, {
      title: "10k " + Date.now(),
      horizonStart,
      horizonEnd,
      stepMs,
    });

    // Poll for >= 10000 timeline items.  Note: /v1/timeline has a
    // 31-day window cap (production-quality fix 2026-07-10), so the
    // request window must be <= 31 days and the per-page limit will
    // paginate.
    const url = `/api/proxy/v1/timeline?start=${encodeURIComponent(horizonStart)}&end=${encodeURIComponent(horizonEnd)}`;
    const count = await pollUntil(
      async () => {
        const res = await request.get(url);
        if (res.status() >= 400) return 0;
        const items = (await res.json()) as unknown[];
        return Array.isArray(items) ? items.length : 0;
      },
      {
        predicate: (n) => n >= 10_000,
        label: "10k materialize",
        timeoutMs: 30_000,
        intervalMs: 1_000,
      },
    );
    expect(count).toBeGreaterThanOrEqual(10_000);
  });
});
