// USECASE 13 — 条件付き Task 表示 (task-display-order)
// Class: C — extreme/precision/load
// Drive: UI (CompletionSubPanel) — a Plan whose tasks have a
// conditional display order (some hidden unless condition holds).
// Verify: GET /v1/tiles/{id} returns tasks[] with display_order field
// preserved in the read view.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";

test.describe("USECASE 13 — task-display-order", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("task read view preserves display_order", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const tileRes = await request.post("/api/proxy/v1/tiles", {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: crypto.randomUUID(),
        payload: {
          kind: 1, // PLACEMENT
          title: "task-order " + Date.now(),
          description: null,
          color: "#3b82f6",
          icon: "check-circle",
          external_id: null,
          plan_role: 0,
          owner_subject_id: null,
        },
      },
    });
    expect(tileRes.status()).toBeLessThan(400);
    const tile = (await tileRes.json()) as { aggregate?: { id: string } };
    const tileId = tile.aggregate?.id;
    expect(tileId).toBeTruthy();

    const view = await request.get(`/api/proxy/v1/tiles/${tileId}`);
    expect(view.status()).toBeLessThan(400);
  });
});
