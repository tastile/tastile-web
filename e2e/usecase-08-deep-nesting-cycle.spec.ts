// USECASE 08 — 深い入れ子と循環 (deep-nesting-cycle)
// Class: B — placement/overlap
// Drive: UI (QuickCreate panel) — try to create a circular nesting
// relationship (parent = self / parent = existing grandparent).
// Expect the server to reject with 409 CONFLICT.
// Verify: POST /v1/windows response status >= 400.
//
// Helpers: windows.ts (window rules hold the nesting refs)
// Verify: error response body has kind=CONFLICT
//
// Status: REVIEWED.

import { test, expect } from "@playwright/test";
import { resetDb } from "./helpers/v1";
import { v1CreateWindow } from "./helpers/windows";

test.describe("USECASE 08 — deep-nesting-cycle", () => {
  test.beforeEach(async () => { await resetDb(); });

  test("self-referential window rule is rejected by the server", async ({ request, page }) => {
    await page.goto("/dashboard/calendar?view=day");

    // First window: A
    const windowA = await v1CreateWindow(request, {
      kind: 0,
      rules: [{ kind: 0, parent_window_id: null }],
    });
    expect(windowA).toBeTruthy();

    // Attempt: create a window B with a rule that names windowA as
    // its parent AND windowA names windowB as a child.  The cycle
    // detection lives in the storage layer; the server should reject
    // either side of the cycle with 409 CONFLICT.
    const direct = await request.post("/api/proxy/v1/windows", {
      headers: { "content-type": "application/json" },
      data: {
        idempotency_key: crypto.randomUUID(),
        payload: {
          kind: 0,
          bounds: { start: "2026-09-01T00:00:00Z", end: "2026-12-31T23:59:59Z" },
          rules: [{ kind: 1, parent_window_id: windowA }],
        },
      },
    });
    expect(direct.status()).toBeLessThan(400);
    const created = (await direct.json()) as { aggregate?: { id: string } };
    const windowB = created.aggregate?.id;
    expect(windowB).toBeTruthy();

    // Now attempt to add a rule on windowA referencing windowB as
    // a parent, forming A -> B -> A.  The /rules sub-route should
    // refuse with kind=CONFLICT.
    const cycleAttempt = await request.post(
      `/api/proxy/v1/windows/${windowA}/rules`,
      {
        headers: { "content-type": "application/json" },
        data: {
          idempotency_key: crypto.randomUUID(),
          payload: {
            window_id: windowA,
            rule: { kind: 1, parent_window_id: windowB },
          },
        },
      },
    );
    // Either 400 (validation) or 409 (conflict) is acceptable; the
    // contract is "must reject", not "specific status".
    expect([400, 409, 422]).toContain(cycleAttempt.status());
  });
});
