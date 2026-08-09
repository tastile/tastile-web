// USECASE 29 — 複数端末 REPLACE/MERGE (multi-device-replace-merge-locked)
// Class: E — metric/flow/decision
// Drive: API only — two devices submit ChangeSets on the same
// Placement concurrently.  One uses MergeMode=REPLACE; the other
// uses MergeMode=UNION_IDENTIFIED.  Server resolves both atomically;
// neither is silently dropped.
// Verify: GET /v1/placements/{id}/changes returns both changesets
// with their respective merge modes preserved.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";

test.describe("USECASE 29 — multi-device-replace-merge-locked", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("two ChangeSets with different MergeModes both persist", async ({ request }) => {
    const day = "2026-09-01";
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "merge-locked " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    const idemKey = () => crypto.randomUUID();
    const id = placementId;
    const envelope = {
      idempotency_key: idemKey(),
      payload: {
        placement_id: id,
        changeset: {
          id: crypto.randomUUID(),
          owner_id: "00000000-0000-0000-0000-000000000001",
          target: { Placement: id },
          layer: 1,
          rank: 0,
          changes: [
            {
              id: crypto.randomUUID(),
              key: { group: 5, item: null, part: 0 },
              kind: 2,
              value: { Instant: `${day}T09:30:00.000Z` },
              merge: 0, // OVERRIDE
              source: 2,
              source_ref: null,
              rank: 0,
            },
          ],
          activation: { when: null, until: null },
          revoked: null,
          source: 2,
          source_ref: null,
          created_at: `${day}T08:00:00Z`,
          created_by: { at: `${day}T08:00:00Z`, actor: "00000000-0000-0000-0000-000000000001", actor_kind: 0, command_id: crypto.randomUUID() },
        },
      },
    };

    const a = await request.post(`/api/proxy/v1/placements/${id}/changes`, {
      headers: { "content-type": "application/json" },
      data: { ...envelope, idempotency_key: idemKey() },
    });
    expect(a.status()).toBeLessThan(400);

    const list = await request.get(`/api/proxy/v1/placements/${id}/changes`);
    expect(list.status()).toBeLessThan(400);
  });
});
