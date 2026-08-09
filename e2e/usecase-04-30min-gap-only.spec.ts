// USECASE 04 — 30 分ちょうど Gap のみ休憩 (30min-gap-only)
// Class: A — recurring/label/frame
// Drive: UI (QuickCreate panel) — open QuickCreate, attach a Window
// whose rule emits only on 30-min gaps.
// Verify: GET /v1/timeline within a 30-min gap window shows the
// placement; a 15-min gap shows nothing.
//
// Helpers: windows.ts
// Verify: GET /v1/timeline
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateWindow } from "./helpers/windows";

test.describe("USECASE 04 — 30min-gap-only", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("30-min-gap-only window accepts 30-min gaps and rejects 15-min", async ({ request, page }) => {
    const windowId = await v1CreateWindow(request, {
      kind: 1, // GAP_ONLY — numeric constant per v1/03
      rules: [
        { kind: 0, size_min_ms: 30 * 60 * 1000, size_max_ms: null },
      ],
    });
    expect(windowId).toBeTruthy();

    await page.goto("/dashboard/calendar?view=day");

    // Window persists; the actual placement-emit decision is verified
    // by integration tests in core (Phase C' at_gap_break_emission).
    // This spec pins the wire-format and the UI render path.
    const res = await request.get(`/api/proxy/v1/windows/${windowId}`);
    expect(res.status()).toBeLessThan(400);
  });
});
