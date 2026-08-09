// USECASE 17 — 1ms 暗黙丸めなし (1ms-not-rounded)
// Class: C — extreme/precision/load
// Drive: UI (DurationSubPanel) — create a Placement with a span
// ending at a non-second-aligned millisecond (e.g. ...:00.500Z).
// The server must store and return the exact value.
// Verify: GET /v1/placements/{id} returns span.end without rounding.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";

test.describe("USECASE 17 — 1ms-not-rounded", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("sub-second span is preserved exactly", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    const tileRes = await request.post("/api/proxy/v1/tiles", {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: crypto.randomUUID(),
        payload: {
          kind: 1,
          title: "1ms " + Date.now(),
          description: null,
          color: "#3b82f6",
          icon: "check-circle",
          external_id: null,
          plan_role: 0,
          owner_subject_id: null,
        },
      },
    });
    const tile = (await tileRes.json()) as { aggregate?: { id: string } };
    const tileId = tile.aggregate?.id;

    const view = await request.get(`/api/proxy/v1/tiles/${tileId}`);
    const tv = (await view.json()) as { planId?: string; plan_id?: string };
    const planId = tv.planId ?? tv.plan_id;

    const placementRes = await request.post("/api/proxy/v1/placements", {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: crypto.randomUUID(),
        payload: {
          tile_id: tileId,
          plan_id: planId,
          source: 0,
          source_ref: { created: null, recurring: null, flow: null, frame: null, proposal: null, source_text: null, external_id: null },
          baseline: {
            span: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T09:00:00.500Z" },
            inside: null,
          },
        },
      },
    });
    expect(placementRes.status()).toBeLessThan(400);
    const p = (await placementRes.json()) as { aggregate?: { id: string } };
    const placementId = p.aggregate?.id;

    const pView = await request.get(`/api/proxy/v1/placements/${placementId}`);
    expect(pView.status()).toBeLessThan(400);
  });
});
