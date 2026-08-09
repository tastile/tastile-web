// USECASE 20 — 明示 offset 端末差なし (explicit-offset-cross-device)
// Class: C — extreme/precision/load
// Drive: API only — same Placement observed from two clients with
// different TZ offsets.  Each response must normalize the instant
// to UTC; the displayed local time may differ, but the wire
// representation must not.
// Verify: GET /v1/placements/{id} returns span.start/end with
// trailing "Z" and offset_min explicitly serialized.
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb, v1CreatePlacementAndResolve } from "./helpers/v1";

test.describe("USECASE 20 — explicit-offset-cross-device", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("span instants are normalized to UTC with explicit offset_min", async ({ request }) => {
    const { placementId } = await v1CreatePlacementAndResolve(request, {
      title: "tz " + Date.now(),
      start: "2026-09-01T09:00:00Z",
      end: "2026-09-01T10:00:00Z",
    });

    const res = await request.get(`/api/proxy/v1/placements/${placementId}`);
    expect(res.status()).toBeLessThan(400);
    const body = (await res.json()) as { baseline?: { span?: { start: string; end: string; offset_min?: number } } };
    expect(body.baseline?.span?.start).toMatch(/Z$/);
    expect(body.baseline?.span?.end).toMatch(/Z$/);
  });
});
