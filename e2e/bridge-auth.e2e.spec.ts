// Bridge auth contract verification (H4b)
//
// Verifies the contract described in
// `tastile-core/crates-v1/api/src/handlers/common.rs::ensure_bridge_owner_provisioning`:
//   1. On first authenticated request with bridge headers, the handler must
//      provision (a) a `v1_subject` row with `kind=0 (USER)` whose `id` is
//      UUIDv5(NAMESPACE_OID, user_sub) and whose `external_subject` starts
//      with `"bridge:"`, and (b) the V1_015 default `休憩` Recurring tile
//      seed (via `seed_default_break_recurring_for_owner`).  Both are
//      inserted in the same transaction.
//   2. On a subsequent request with the same `user_sub`, no additional
//      `v1_subject` row is inserted (idempotency).
//
// `playwright.config.ts` pins `COOKIE_USER_SUB="e2e-bridge-test-user"` and
// `TASTILE_WEB_BRIDGE_SECRET="dev-e2e-secret"` in the webServer env.  The
// `/api/proxy/v1/tiles` proxy injects those as bridge headers, so the API
// resolves the bridge auth path with a stable user_sub.

import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { v5 as uuidv5 } from "uuid";

// ---------------------------------------------------------------------------
// Constants — keep in sync with playwright.config.ts and common.rs:822
// ---------------------------------------------------------------------------

const TEST_USER_SUB = "e2e-bridge-test-user";
// UUIDv5(NAMESPACE_OID, b"e2e-bridge-test-user").  Pinned offline so the spec
// does not depend on any uuid library at runtime.
const EXPECTED_OWNER_ID = "f4ffe1cc-03e0-56c4-99a4-1a7d00577e07";

const PSQL_CONTAINER = "tastile-db";
const PSQL_DB = "tastile_db";
const PSQL_USER = "tastile";

function wslcPsql(sql: string): string {
  return execFileSync(
    "wslc",
    [
      "container", "exec", PSQL_CONTAINER,
      "psql", "-U", PSQL_USER, "-d", PSQL_DB, "-tA", "-c", sql,
    ],
    { encoding: "utf8", timeout: 15_000 },
  ).trim();
}

function assertExpectedOwnerId(): void {
  // Re-derive offline using the same algorithm the Rust side uses, and
  // compare.  This protects the test against silent drift in either side.
  const derived = uuidv5(TEST_USER_SUB, "6ba7b810-9dad-11d1-80b4-00c04fd430c8"); // NAMESPACE_OID
  expect(derived).toBe(EXPECTED_OWNER_ID);
}

async function postBridgeTile(
  request: import("@playwright/test").APIRequestContext,
  title: string,
): Promise<import("@playwright/test").APIResponse> {
  return request.post("/api/proxy/v1/tiles", {
    headers: { "content-type": "application/json" },
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        kind: 1, // PLACEMENT — auto-creates a v1_plan; exercises the bridge auth path
        title,
        description: null,
        color: "#3b82f6",
        icon: "check-circle",
        external_id: null,
        plan_role: 0, // EXECUTABLE
        owner_subject_id: null,
      },
    },
  });
}

test.describe("bridge auth contract (H4b)", () => {
  test.beforeAll(() => {
    assertExpectedOwnerId();
  });

  test.beforeEach(() => {
    // Clear only the tables this contract touches.  v1_recurring is on the
    // list because V1_015 seeds a default `休憩` tile whose row lives there
    // (and `休憩` is a regular Recurring, not a discriminator).
    wslcPsql("TRUNCATE v1_subject, v1_recurring RESTART IDENTITY CASCADE");
  });

  test("first bridge request provisions subject + break recurring", async ({ request }) => {
    // Sanity: nothing in the DB before the first call.
    const before = Number(wslcPsql("SELECT count(*) FROM v1_subject"));
    expect(before).toBe(0);

    const tileRes = await postBridgeTile(request, `H4b smoke ${Date.now()}`);
    expect(tileRes.status(), "POST /api/proxy/v1/tiles").toBeLessThan(400);

    // 1. v1_subject row was created exactly once with kind=0 (USER) and
    //    the UUIDv5-derived id.
    const subjectCount = Number(
      wslcPsql("SELECT count(*) FROM v1_subject WHERE kind = 0"),
    );
    expect(subjectCount).toBe(1);

    const subjectId = wslcPsql(
      "SELECT id FROM v1_subject WHERE kind = 0 ORDER BY created_at DESC LIMIT 1",
    );
    expect(subjectId).toBe(EXPECTED_OWNER_ID);

    const externalSubject = wslcPsql(
      "SELECT external_subject FROM v1_subject WHERE id = '" + EXPECTED_OWNER_ID + "'",
    );
    expect(externalSubject).toBe("bridge:" + TEST_USER_SUB);

    // 2. V1_015 default `休憩` Recurring exists for this subject (via the
    //    v1_tile row linked to the owner).
    const breakTileCount = Number(wslcPsql(
      "SELECT count(*) FROM v1_tile WHERE owner_id = '" + EXPECTED_OWNER_ID +
        "'::uuid AND title = '休憩'",
    ));
    expect(breakTileCount).toBeGreaterThanOrEqual(1);

    //    And that tile has a v1_recurring row (the seed creates both).
    const breakRecurringCount = Number(wslcPsql(
      "SELECT count(*) FROM v1_recurring r " +
        "JOIN v1_tile t ON t.id = r.tile_id " +
        "WHERE t.owner_id = '" + EXPECTED_OWNER_ID + "'::uuid AND t.title = '休憩'",
    ));
    expect(breakRecurringCount).toBeGreaterThanOrEqual(1);
  });

  test("idempotent: second bridge request does not duplicate subject row", async ({ request }) => {
    // First request — provisions v1_subject + V1_015 休憩 seed.
    const r1 = await postBridgeTile(request, `H4b idempotent 1 ${Date.now()}`);
    expect(r1.status()).toBeLessThan(400);

    const after1 = Number(wslcPsql("SELECT count(*) FROM v1_subject"));
    expect(after1).toBe(1);

    const breakAfter1 = Number(wslcPsql(
      "SELECT count(*) FROM v1_tile WHERE owner_id = '" + EXPECTED_OWNER_ID +
        "'::uuid AND title = '休憩'",
    ));
    expect(breakAfter1).toBeGreaterThanOrEqual(1);

    // Second request — same user_sub (cookie pinned by playwright config).
    // Must not create another v1_subject row, and must not duplicate 休憩.
    const r2 = await postBridgeTile(request, `H4b idempotent 2 ${Date.now()}`);
    expect(r2.status()).toBeLessThan(400);

    const after2 = Number(wslcPsql("SELECT count(*) FROM v1_subject"));
    expect(after2).toBe(after1); // idempotency

    const breakAfter2 = Number(wslcPsql(
      "SELECT count(*) FROM v1_tile WHERE owner_id = '" + EXPECTED_OWNER_ID +
        "'::uuid AND title = '休憩'",
    ));
    expect(breakAfter2).toBe(breakAfter1); // 休憩 seed is also idempotent
  });
});
