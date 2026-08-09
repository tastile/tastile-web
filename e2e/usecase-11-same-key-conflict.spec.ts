// USECASE 11 — 同一 layer/rank/Key 競合 (same-key-conflict)
// Class: C — extreme/precision/load
// Drive: API only — append two ChangeSets with the same (layer,
// rank, key) tuple but different values.  The second must be
// rejected with kind=CONFLICT.
// Verify: POST /v1/placements/{id}/changes second response status >= 400.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";

test.describe("USECASE 11 — same-key-conflict", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("same key, same layer, same rank, different value -> CONFLICT", async ({ request }) => {
    const day = "2026-09-01";
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "conflict test " + Date.now(),
      start: `${day}T09:00:00Z`,
      end: `${day}T10:00:00Z`,
    });

    const idemKey = () => crypto.randomUUID();
    const changeKey = { group: 5, item: null, part: 0 }; // span.start
    const baseChange = {
      id: crypto.randomUUID(),
      key: changeKey,
      kind: 2, // PUT
      merge: 0, // OVERRIDE
      source: 2, // USER
      source_ref: null,
      rank: 0,
    };

    // First ChangeSet: PUT span.start = 09:30:00Z.  Should succeed.
    const first = await request.post(`/api/proxy/v1/placements/${placementId}/changes`, {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: idemKey(),
        payload: {
          placement_id: placementId,
          changeset: {
            id: crypto.randomUUID(),
            owner_id: "00000000-0000-0000-0000-000000000001",
            target: { Placement: placementId },
            layer: 1, // PLACEMENT
            rank: 0,
            changes: [{ ...baseChange, value: { Instant: `${day}T09:30:00.000Z` } }],
            activation: { when: null, until: null },
            revoked: null,
            source: 2,
            source_ref: null,
            created_at: `${day}T08:00:00Z`,
            created_by: { at: `${day}T08:00:00Z`, actor: "00000000-0000-0000-0000-000000000001", actor_kind: 0, command_id: crypto.randomUUID() },
          },
        },
      },
    });
    expect(first.status()).toBeLessThan(400);

    // Second ChangeSet: same key, layer, rank, but a different value
    // (08:00:00Z).  Server should reject.
    const second = await request.post(`/api/proxy/v1/placements/${placementId}/changes`, {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: idemKey(),
        payload: {
          placement_id: placementId,
          changeset: {
            id: crypto.randomUUID(),
            owner_id: "00000000-0000-0000-0000-000000000001",
            target: { Placement: placementId },
            layer: 1,
            rank: 0,
            changes: [{ ...baseChange, value: { Instant: `${day}T08:00:00.000Z` } }],
            activation: { when: null, until: null },
            revoked: null,
            source: 2,
            source_ref: null,
            created_at: `${day}T08:01:00Z`,
            created_by: { at: `${day}T08:01:00Z`, actor: "00000000-0000-0000-0000-000000000001", actor_kind: 0, command_id: crypto.randomUUID() },
          },
        },
      },
    });
    expect(second.status()).toBeGreaterThanOrEqual(400);
  });
});
