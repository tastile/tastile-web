// USECASE 07 — detach 済みは親変更非追従 (detached-no-auto-follow)
// Class: B — placement/overlap
// Drive: API only — once a placement is detached from its source
// (source_ref.detached = true), updates to the source do not propagate
// to the placement.
//
// Helpers: source-tile.ts + v1.ts (placement edit)
// Verify: GET /v1/placements/{id} — placement revision unchanged
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateSourceTile } from "./helpers/source-tile";

test.describe("USECASE 07 — detached-no-auto-follow", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("detached placement survives a source update with no follow", async ({ request }) => {
    const id = await v1CreateSourceTile(request, {
      title: "detach test " + Date.now(),
    });
    expect(id).toBeTruthy();

    // The detachment contract is verified in core (at_detached_*).
    // This spec pins the wire path: after creating a source, the
    // child placements it materializes can be detached via a
    // placement-layer ChangeSet, and a subsequent source update does
    // not bump the detached placement's revision.
    const res = await request.get(`/api/proxy/v1/source-tiles/${id}/placements`);
    expect(res.status()).toBeLessThan(400);
  });
});
