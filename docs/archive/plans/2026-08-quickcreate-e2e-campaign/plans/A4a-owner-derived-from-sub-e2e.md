# A4a — owner_id derived from user_sub via UUIDv5 (e2e)

## メタデータ

- **ID**: A4a
- **Phase**: 1
- **Target repo**: `tastile-web` (spec file) + `tastile-core` (DB verification)
- **Sub-project parent**: A (Tile + Plan + Meta wire + e2e)
- **Depends on**: H1c (bridge mode cookie helper green; see `H-auth-bridge.md` §Auth contract)
- **Sibling plans**: A4b (cross-owner isolation: e2e uses 2 distinct user_sub values, this plan asserts the **owner_id rows** they produce; A4b asserts that owner A's read cannot see owner B's tile)
- **Source spec**: `04-sub-projects/A-tile-plan.md` §2 (`meta.ownerSubjectId` row in the field table) + `04-sub-projects/H-auth-bridge.md` §Auth contract (bridge mode is the only non-bypass path) + `tastile-core/crates-v1/api/src/handlers/common.rs:823` (UUIDv5 derivation site)

## 前提

- H1c green: `tastile-web/e2e/helpers/cookie-bridge.ts` (or equivalent) can set the `tastile_user_sub` cookie for a Playwright browser context, and `tastile-web/src/app/api/proxy/[...path]/route.ts` translates it to bridge headers (`x-tastile-web-bridge-secret` + `x-tastile-web-session-user`) for the upstream core call
- `bash scripts/wslc/up-v1.sh` is up; `tastile-db` container reachable via `wslc container exec tastile-db psql -U tastile -d tastile_db …`
- `E2E_BYPASS_AUTH=0` and `NEXT_PUBLIC_E2E_BYPASS_AUTH=0` in `tastile-web/.env.development` (H §Verification step 1)
- `BRIDGE_SECRET` on the core side aligned to `TASTILE_WEB_BRIDGE_SECRET` (H §Fix options A)
- DB is in a clean state for the test (H1c's TRUNCATE helper covers `v1_placement`, `v1_event`, `v1_change_set`, `v1_window`, `v1_recurring`, `v1_annotation`, `v1_tile`; A4a additionally requires `v1_subject` truncation between runs)

## 目的

`meta.ownerSubjectId` (i.e. `v1_tile.owner_id`) is the **UUIDv5 hash of the authenticated `user_sub`** at `tastile-core/crates-v1/api/src/handlers/common.rs:822-823`:

```rust
let owner_id = Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes());
```

The plan proves this end-to-end through the bridge auth path. The e2e must verify three properties that no unit test (which only inspects the helper directly) can prove:

1. The owner_id the **web QuickCreate submission** produces is the UUIDv5 hash of the `user_sub` cookie value, not a fixed placeholder.
2. Two **different** `user_sub` cookie values produce **two different** `v1_tile.owner_id` rows (no shared owner across users).
3. The **same** `user_sub` submitted twice produces the **same** `v1_tile.owner_id` (UUIDv5 is deterministic; deleting the cookie and re-creating it must not switch owners).

The bypass path (`E2E_BYPASS_AUTH=1`) returns the fixed `00000000-0000-0000-0000-000000000001` UUID and would mask all three failures; A4a explicitly disallows that path.

## 受入条件

- Spec green: `bun run test:e2e a4a-owner-derived.spec.ts` exits 0 with all assertions in §実装手順 passing
- DB state after spec run:
  - `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT DISTINCT owner_id FROM v1_tile WHERE title LIKE 'A4a%'"` returns **exactly 2 rows**, one per `user_sub`
  - `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT count(*) FROM v1_subject"` returns at least 2 rows (one per `user_sub`); each `id` equals the corresponding `v1_tile.owner_id` for the matching `user_sub` per the UUIDv5 contract
  - Submitting the **same** `user_sub` twice within one spec run (resubmit case below) produces `count(*)=1` for that `user_sub`'s `A4a-<label>` title (no duplicate tile created by the second submission under default-state QuickCreate — UUIDv5 owner stability surfaces as "same owner, idempotent tile creation rejected by the `v1_tile (owner_id, external_id)` UNIQUE / domain equivalent OR just shows 1 row because both submissions have the same title + owner and the storage layer collapses them")
- The fixed bypass UUID `00000000-0000-0000-0000-000000000001` does **not** appear in `v1_tile.owner_id WHERE title LIKE 'A4a%'`
- No `401` in the proxy or core log during the spec run

## 実装手順

1. **New spec file**: `tastile-web/e2e/a4a-owner-derived.spec.ts`
   - Top-of-file: `import { test, expect } from '@playwright/test';` + `import { setUserSubCookie, truncateDB } from './helpers/cookie-bridge';` (or equivalent names from H1c)
   - `test.beforeAll(async () => { await truncateDB({ include: ['v1_tile','v1_plan','v1_subject','v1_annotation','v1_event','v1_placement','v1_change_set','v1_window','v1_recurring'] }); });` — `v1_subject` is new for A4a and is required because the bridge helper provisions a subject row on first auth
   - **Test 1: `bridge auth: two user_sub values produce two distinct owner_id rows`**
     - `const userSubA = 'a4a-user-A-' + Date.now();`
     - `const userSubB = 'a4a-user-B-' + Date.now();`
     - Use H1c's `setUserSubCookie(page, userSubA)` to set the cookie on `page` (a fresh `browser.newContext()` per user to avoid cross-context cookie pollution; H1c helper must accept a `BrowserContext` so each test gets its own)
     - Open QuickCreate, fill `title='A4a-owner-A-' + Date.now()` + minimal `description`, leave §3-§7 at defaults (matches A-tile-plan.md §4 smoke template), submit
     - Wait for the success toast
     - Repeat in a **second** fresh browser context with `setUserSubCookie(page, userSubB)` and a `title='A4a-owner-B-' + Date.now()`
     - DB assertion (executed from within the spec via `execSync` or a helper that runs `wslc container exec tastile-db psql …`):
       ```ts
       const rows = execSync(
         `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT DISTINCT owner_id FROM v1_tile WHERE title LIKE 'A4a-%'"`
       ).toString().trim().split('\n').filter(Boolean);
       expect(rows).toHaveLength(2);
       expect(rows).not.toContain('00000000-0000-0000-0000-000000000001');
       ```
     - Cross-check: each row's value equals `crypto.createHash ? ... : ...` equivalent of `Uuid.new_v5(NAMESPACE_OID, userSubX)` — implement the same UUIDv5 derivation in `tastile-web/e2e/helpers/uuidv5.ts` (`namespace` is the canonical OID UUID `6ba7b810-9dad-11d1-80b4-00c04fd430c8`; v5 hash = SHA-1 of `namespace.concat(user_sub_bytes)` formatted per RFC 4122). The helper is small and reuses `node:crypto`. Cite `tastile-core/crates-v1/api/src/handlers/common.rs:822` as the spec for the algorithm — if the values differ, the e2e catches a silent divergence.
   - **Test 2: `bridge auth: same user_sub produces same owner_id across two submissions`**
     - Fresh `browser.newContext()`, `setUserSubCookie(page, userSubA)` (re-use `userSubA` from Test 1 — same value, same expected owner_id)
     - Submit QuickCreate with `title='A4a-resubmit'` once; capture the resulting tile row's `owner_id` via `SELECT owner_id FROM v1_tile WHERE title='A4a-resubmit'`
     - Reload the page (do **not** clear cookies), submit again with a different `title='A4a-resubmit-2'`
     - DB assertion:
       ```ts
       const ownerIds = execSync(
         `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT DISTINCT owner_id FROM v1_tile WHERE title LIKE 'A4a-resubmit%'"`
       ).toString().trim().split('\n').filter(Boolean);
       expect(ownerIds).toHaveLength(1);
       expect(ownerIds[0]).toBe(expectedOwnerIdForUserSubA);
       ```
     - The two distinct titles under the same `user_sub` must share an `owner_id`. This is the determinism pin.
   - `test.afterAll(async () => { await truncateDB({ include: ['v1_tile','v1_plan','v1_subject','v1_annotation','v1_event','v1_placement','v1_change_set','v1_window','v1_recurring'] }); });` — clean up so sibling specs in the same run do not see A4a's rows

2. **DB-verification snippet** (use inside the spec via the H1c `psql` helper, not as a separate shell command — the e2e must assert, not observe):
   ```ts
   async function distinctOwnerIdsForA4a(): Promise<string[]> {
     const out = execSync(
       'wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT DISTINCT owner_id FROM v1_tile WHERE title LIKE \'A4a%\'"',
       { encoding: 'utf8' }
     );
     return out.trim().split('\n').filter(Boolean);
   }
   ```

3. **Helper to register**: `tastile-web/e2e/helpers/uuidv5.ts` — implements the same UUIDv5 algorithm as `tastile-core/crates-v1/api/src/handlers/common.rs:822` so the e2e can compute the expected `owner_id` from `user_sub` without trusting the DB. Reference: `Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes())` in Rust = SHA-1 of the OID namespace bytes concatenated with `user_sub` bytes, then formatted per RFC 4122 §4.3. The OID namespace UUID is `6ba7b810-9dad-11d1-80b4-00c04fd430c8` (bytes form: `6b a7 b8 10 9d ad 11 d1 80 b4 00 c0 4f d4 30 c8`)

4. **Run**:
   ```bash
   cd tastile-web
   bun run test:e2e a4a-owner-derived.spec.ts
   ```
   Pass = exit 0 + all assertions above green + no 401 in core log (H §Acceptance last bullet)

## 検証手順

1. **Spec pass**: `bun run test:e2e a4a-owner-derived.spec.ts` → 2 tests Green, exit 0
2. **DB direct verification** (independent of the spec, run after the spec finishes):
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT DISTINCT owner_id FROM v1_tile WHERE title LIKE 'A4a%'"
   ```
   Expected: 2 rows, neither equal to `00000000-0000-0000-0000-000000000001`
3. **Subject table check** (proves `ensure_bridge_owner_provisioning` ran for both users):
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT id, kind FROM v1_subject ORDER BY created_at"
   ```
   Expected: at least 2 USER-kind subjects, each `id` matching the corresponding `v1_tile.owner_id` from step 2
4. **Algorithm check** (proves the value really is the UUIDv5 of the cookie value):
   ```bash
   # In a Node REPL inside tastile-web
   node -e "console.log(require('./e2e/helpers/uuidv5').v5('a4a-user-A-…'))"
   ```
   Expected output equals the `owner_id` from step 2 for the matching `user_sub`
5. **Bypass-isolation check**: `grep -c '00000000-0000-0000-0000-000000000001' core.log` → 0 hits in the spec's time window. The bypass path must not be exercised; if it sneaks in via `E2E_BYPASS_AUTH=1` leaking into the run, the spec would observe 1 owner_id across 2 user_sub values and fail
6. **No-401 check**: `grep -c '401' proxy.log core.log` during the spec window → 0 hits

## リスク

- **Test pollution between sibling specs**: A4a writes to `v1_tile` / `v1_plan` / `v1_subject` with `title LIKE 'A4a%'`. If a sibling spec (e.g. A1's smoke) does not TRUNCATE before its assertions, it may see A4a's rows. Mitigation: A4a's `afterAll` TRUNCATE covers the same table set H1c's `beforeAll` does, plus `v1_subject`. Both A1 and A4a should run with `test.describe.configure({ mode: 'serial' })` or be scheduled by the Playwright config so they never run in parallel within the same DB snapshot. (memory `feedback_integration_test_skip_masks_contract_bugs.md`: skipping this and seeing "GREEN" from a 0-row check is the most common false-positive path here.)
- **Bypass path silently absorbing the spec**: if `E2E_BYPASS_AUTH=1` is set in `tastile-web/.env.development` (H §Mismatch diagnosis shows it is the dev default), the proxy will inject the fixed UUID `00000000-...0001` instead of bridge headers, and the spec will observe 1 owner_id across 2 user_sub values — which is what we want it to fail on. Mitigation: spec must `test.beforeAll` assert `process.env.E2E_BYPASS_AUTH !== '1'` and `process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH !== '1'`, otherwise `test.skip()` with a clear message ("A4a requires bridge mode; flip E2E_BYPASS_AUTH=0 in .env.development before running"). The same check exists in H1c
- **v1_subject grow without bound**: each test run that uses a new `user_sub` (via `Date.now()`) creates a permanent `v1_subject` row. The DB will accumulate rows across runs. Mitigation: the `afterAll` TRUNCATE covers it within a single spec run; a separate `tests/cleanup-orphan-subjects.spec.ts` (out of scope for A4a, noted in 関連) is the long-term fix
- **UUIDv5 helper drift**: if `tastile-core` ever changes the namespace from `Uuid::NAMESPACE_OID` to another (e.g. `NAMESPACE_DNS` or a custom OID), the spec's `uuidv5.ts` helper will silently produce wrong expected values, and Test 1's `expect(rows[0]).toBe(expectedOwnerIdForUserSubA)` will fail with a clear error — good, that's the point. The reverse drift (helper matches, core diverges) is the dangerous case; the DB-direct verification in §検証手順 step 2 catches that because the two `owner_id` rows still need to be distinct, but won't catch a wrong namespace unless the test also asserts the literal UUID. Add a Test 3 (low priority, in scope per this plan): assert `rows[0] === expectedOwnerIdForUserSubA && rows[1] === expectedOwnerIdForUserSubB` so namespace drift surfaces immediately
- **Cookie name collision**: H mentions `feedback_cf_cookie_name_waf.md` — `tastile_user_sub=*` is blocked by CloudFlare WAF. A4a runs locally against `127.0.0.1:31400` and the dev wslc stack, so the WAF does not apply. If the spec is ever ported to a hosted environment, the cookie name must be renamed to `tastile_uid` (already done in production v2 deploy 2026-07-06 per memory). Document the local-only assumption in the spec's top comment
- **Owner_id determinism vs subject reuse**: per H §リスク, deleting and recreating a cognito user with the same sub reuses the same owner. A4a does not test this negative case (it tests the **positive** determinism). The "deletion" half is covered by H1c's `ensure_bridge_owner_provisioning` re-entry path, not A4a

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2 (`meta.ownerSubjectId` row in the field table; this plan proves the row, not the wire)
- **Auth contract**: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §Auth contract + §Bridge header spec (where the UUIDv5 derivation is defined from the web side)
- **Implementation site**: `tastile-core/crates-v1/api/src/handlers/common.rs:823` (the exact `Uuid::new_v5` line the spec must mirror)
- **Helper source**: `H1c` plan (the `cookie-bridge` helper and the `truncateDB` helper used by both A1 and A4a)
- **Sibling plan**: `A4b` (cross-owner isolation — uses A4a's 2 distinct `user_sub` context to assert owner A's read cannot see owner B's tile)
- **Memory anchors**:
  - `feedback_verify_aws_actual_state.md` (H1b cookie helper depends on bridge secret alignment being real, not assumed)
  - `feedback_observe_actual_behavior.md` (assert in a real browser, not via the unit test of the helper alone)
  - `feedback_verify_ui_in_browser.md` (the spec uses Playwright; the assertions check the DB after the form submit, not just the response status)
  - `feedback_cant_open_localhost.md` (`wslc` stack is up so the user can also `wslc container exec tastile-db psql` to spot-check)
  - `project_tastile_v1_bridge_auth_uuidv5.md` (background: the UUIDv5 derivation is what A4a is testing)
  - `feedback_bridge_owner_provisioning_20260721.md` (background: `ensure_bridge_owner_provisioning` is what creates the `v1_subject` row that A4a observes)
- **Out of scope (deferred)**: `tests/cleanup-orphan-subjects.spec.ts` (handles the v1_subject grow-without-bound risk; separate plan)
