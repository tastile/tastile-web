# A1c — §7 Meta (minimum) lands: `ownerSubjectId` is UUIDv5(user_sub)

## メタデータ

- **ID**: A1c
- **Phase**: 1
- **Target repo**: `tastile-web` (spec file) + `tastile-core` (DB verification)
- **Sub-project parent**: A (Tile + Plan + Meta wire + e2e)
- **Depends on**: A1a (smoke spec green; default-state QuickCreate persists one `v1_tile` row + one `v1_plan` row), H1a (bridge header contract landed)
- **Sibling plans**: A4a (the extended owner-derived e2e — 2 user_subs, distinct + determinism; A1c is the **minimum** pin that single-user submissions resolve `meta.ownerSubjectId` to the UUIDv5 hash of the cookie value)
- **Source spec**: `04-sub-projects/A-tile-plan.md` §2 (`meta.ownerSubjectId` row in the field table — "header-derived, `handlers/common.rs:823` (UUIDv5), ✓ via H")

## 前提

- A1a green: `tastile-web/e2e/quick-tile-create-e2e.spec.ts` (or equivalent) successfully persists one `v1_tile` row + one `v1_plan` row from default-state QuickCreate against `bash scripts/wslc/up-v1.sh`-started core.
- H1a green: the bridge header contract is wired — `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` reach core's `handlers::common::authenticate` and resolve a non-bypass `owner_id`.
- `tastile-core/scripts/wslc/up-v1.sh` is up; `tastile-db` container reachable via `wslc container exec tastile-db psql -U tastile -d tastile_db …`.
- DB is in a clean state for this spec run; A1a's `beforeAll` truncate helper covers `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation, v1_tile`. A1c additionally requires the test to use a **single fixed `user_sub`** for the whole run so the expected owner_id is a single known value (no `Date.now()` suffix).
- Test `user_sub` chosen: a fixed string like `a1c-meta-min-owner` (deterministic, easy to recompute in `psql`).
- `BRIDGE_SECRET` on core side aligned to `TASTILE_WEB_BRIDGE_SECRET` (H §Fix options A; see G6b).
- `E2E_BYPASS_AUTH=0` and `NEXT_PUBLIC_E2E_BYPASS_AUTH=0` in `tastile-web/.env.development` — bypass mode returns the fixed `00000000-0000-0000-0000-000000000001` UUID and would mask this test (the test would observe that fixed UUID and pass vacuously).

## 目的

`meta.ownerSubjectId` resolves server-side to a `v1_tile.owner_id` value that is the **UUIDv5 hash of the authenticated `user_sub`** at `tastile-core/crates/v1/api/src/handlers/common.rs:823`:

```rust
let owner_id = Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes());
```

A1c proves the **minimum** contract: one fixed `user_sub` → one known UUIDv5 hash → one `v1_tile.owner_id` row that equals that hash. A4a later extends this to 2 user_subs (distinct) + resubmit (deterministic).

The plan additionally confirms parent §2 row 3 ("`Tile.content.description = identity.description ∨ meta.memo`") by checking that when the wire folds `meta.memo` into the payload, the persisted `v1_tile.content->>'description'` matches the merged value.

## 受入条件

- Spec green: `bun run test:e2e a1c-meta-min.spec.ts` exits 0 with all assertions in §実装手順 passing.
- DB state after spec run, single fixed `user_sub = 'a1c-meta-min-owner'`:
  - `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT owner FROM v1_tile WHERE title='A1c-meta-min'"` returns **exactly one row**, and that row equals the UUIDv5 hash of `'a1c-meta-min-owner'` computed with the OID namespace (`6ba7b810-9dad-11d1-80b4-00c04fd430c8`).
  - Same row is **not** the bypass placeholder `00000000-0000-0000-0000-000000000001`.
- `meta.memo` merge check: when QuickCreate is submitted with `description` blank but `meta.memo = 'A1c memo text'`, the persisted row's `v1_tile.content->>'description' = 'A1c memo text'` (i.e. the wire folded memo into description per parent §2 row 3).
- No `401` in the proxy or core log during the spec run.

## 実装手順

1. **New spec file**: `tastile-web/e2e/a1c-meta-min.spec.ts`
   - Top-of-file: `import { test, expect } from '@playwright/test';` + `import { setUserSubCookie, truncateDB } from './helpers/cookie-bridge';` (helpers from H1a / A1a's existing fixture; A1c adds a memo variant).
   - `test.beforeAll(async () => { await truncateDB({ include: ['v1_placement','v1_event','v1_change_set','v1_window','v1_recurring','v1_annotation','v1_tile','v1_subject'] }); });` — `v1_subject` is included because the bridge helper provisions a subject row on first auth; without truncating it, residual subjects from previous runs may match the new owner_id and silently appear "correct".
   - `test.beforeAll` also asserts `process.env.E2E_BYPASS_AUTH !== '1'` and `process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH !== '1'`; if either is `'1'`, `test.skip()` with the message `"A1c requires bridge mode; flip E2E_BYPASS_AUTH=0 in .env.development before running"`. This prevents bypass mode from masking the assertion (the spec would otherwise observe `00000000-...0001` and either fail confusingly or, if the helper also folds memo, silently produce the wrong expected value).

2. **Test 1: `meta.ownerSubjectId = UUIDv5(NAMESPACE_OID, user_sub)` for a single fixed `user_sub`**
   - `const userSub = 'a1c-meta-min-owner';` (fixed, no `Date.now()` — the expected owner_id must be reproducible from this constant alone).
   - Fresh `browser.newContext()`; `setUserSubCookie(page, userSub)`.
   - Open QuickCreate, fill `title='A1c-meta-min'` + `description='A1c base description'`, leave §3-§6 at defaults, leave §7 (`meta`) at defaults (no memo). Submit.
   - Wait for the success toast.
   - DB assertion (executed from within the spec via `execSync` or a `psql` helper):
     ```ts
     const ownerRow = execSync(
       `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT owner FROM v1_tile WHERE title='A1c-meta-min'"`
     ).toString().trim();
     expect(ownerRow).toBe(expectedOwnerIdForUserSub(userSub));
     expect(ownerRow).not.toBe('00000000-0000-0000-0000-000000000001');
     ```
   - `expectedOwnerIdForUserSub(userSub)` is the UUIDv5 hash of `userSub` under the OID namespace; computed by the helper in step 3. The expected value is the **literal UUID** matching what `Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes())` produces at `tastile-core/crates/v1/api/src/handlers/common.rs:823`.

3. **Helper to register / extend**: `tastile-web/e2e/helpers/uuidv5.ts` (the same file A4a introduces — A1c lands it first so A4a inherits the verified helper)
   - Implements RFC 4122 §4.3 UUIDv5 using `node:crypto`'s SHA-1.
   - The OID namespace UUID `6ba7b810-9dad-11d1-80b4-00c04fd430c8` is encoded as bytes `6b a7 b8 10 9d ad 11 d1 80 b4 00 c0 4f d4 30 c8` and prepended to the name bytes (`user_sub.as_bytes()`); SHA-1 the concatenation; set version to 5 in the high nibble of byte 6; set variant to RFC 4122 (10xx) in the high two bits of byte 8; format the 16 bytes as a UUID string.
   - Cite `tastile-core/crates/v1/api/src/handlers/common.rs:822-823` as the algorithm spec.
   - Exported function: `v5(name: string): string` (returns the lowercase hyphenated UUID form).
   - Reference expected value (computed once, hard-coded for regression): `v5('a1c-meta-min-owner')` is a fixed string; record it in the spec as `EXPECTED_OWNER_FOR_A1C = '<computed-uuid>'` and update by re-running the helper if the algorithm ever changes. The test asserts `ownerRow === EXPECTED_OWNER_FOR_A1C`.

4. **Test 2: `meta.memo` folds into `content.description` per parent §2 row 3**
   - Reuse the same `userSub = 'a1c-meta-min-owner'` (do **not** clear the cookie; the same cookie → same owner_id → idempotent assertion surface).
   - Reload the page (or open QuickCreate in the same context); fill `title='A1c-meta-min-memo'`; **leave `description` blank**; set `meta.memo = 'A1c memo text'` (the QuickCreate memo field, not the description textarea). Submit.
   - DB assertion:
     ```ts
     const desc = execSync(
       `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT content->>'description' FROM v1_tile WHERE title='A1c-meta-min-memo'"`
     ).toString().trim();
     expect(desc).toBe('A1c memo text');
     ```
   - Cross-check the owner_id is still `EXPECTED_OWNER_FOR_A1C` (same user_sub → same owner):
     ```ts
     const ownerRow = execSync(
       `wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT owner FROM v1_tile WHERE title='A1c-meta-min-memo'"`
     ).toString().trim();
     expect(ownerRow).toBe(EXPECTED_OWNER_FOR_A1C);
     ```
   - The two tests together prove: (a) memo-folding is live, (b) owner derivation is stable across submissions for the same `user_sub`.

5. **Test cleanup**: `test.afterAll(async () => { await truncateDB({ include: ['v1_placement','v1_event','v1_change_set','v1_window','v1_recurring','v1_annotation','v1_tile','v1_subject'] }); });` — keeps sibling specs in the same run from observing A1c's rows.

6. **Run**:
   ```bash
   cd tastile-web
   bun run test:e2e a1c-meta-min.spec.ts
   ```
   Pass = exit 0 + both tests green + no 401 in core log.

## 検証手順

1. **Spec pass**: `bun run test:e2e a1c-meta-min.spec.ts` → 2 tests Green, exit 0.
2. **DB direct verification** (independent of the spec, run after the spec finishes; useful for first-time sanity):
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT title, owner, content->>'description' AS description FROM v1_tile WHERE title LIKE 'A1c-meta-min%' ORDER BY title"
   ```
   Expected: 2 rows.
   - `A1c-meta-min` → `owner = <EXPECTED_OWNER_FOR_A1C>`, `description = 'A1c base description'`.
   - `A1c-meta-min-memo` → `owner = <EXPECTED_OWNER_FOR_A1C>`, `description = 'A1c memo text'`.
3. **Algorithm check** (proves the value really is the UUIDv5 of the cookie value, not a fixed dev placeholder):
   ```bash
   node -e "console.log(require('./e2e/helpers/uuidv5').v5('a1c-meta-min-owner'))"
   ```
   Expected output equals the `owner` from step 2 for both rows.
4. **Bypass-isolation check**: `grep -c '00000000-0000-0000-0000-000000000001' core.log` during the spec window → 0 hits. If it appears, bypass mode leaked into the run and the spec should have skipped (per step 1).
5. **No-401 check**: `grep -c '401' proxy.log core.log` during the spec window → 0 hits.
6. **Memo-fold cross-check** (regression-proofs parent §2 row 3 in isolation): run Test 2 again with `description` non-empty and `meta.memo` non-empty to confirm the merge logic prefers one or concatenates — note the current merge behavior in the spec comment so future drift surfaces. (Out of scope for A1c's pass criteria; recorded in `関連` as a follow-up.)

## リスク

- **UUID namespace mismatch**: if `tastile-core` ever changes the namespace from `Uuid::NAMESPACE_OID` (`6ba7b810-9dad-11d1-80b4-00c04fd430c8`) to another (e.g. `NAMESPACE_DNS` or a custom OID), the spec's `uuidv5.ts` helper will silently produce a different expected value and the assertion `ownerRow === EXPECTED_OWNER_FOR_A1C` will fail with a clear diff. **Conversely**, if both sides silently switch namespace together, the test passes vacuously. Mitigation: the §検証手順 step 3 algorithm check recomputes the expected value from scratch (no `EXPECTED_OWNER_FOR_A1C` constant) and compares; record the OID namespace UUID as a **literal constant** in `uuidv5.ts` and grep the helper for it in code review. If the namespace must change, that's a breaking change touching H §Auth contract — flag it explicitly.
- **Bypass path silently absorbing the spec**: if `E2E_BYPASS_AUTH=1` is set in `tastile-web/.env.development`, the proxy will inject the fixed UUID `00000000-...0001` instead of bridge headers. The spec would observe that UUID and either fail (good — clear signal) or, if the test author weakens the assertion, silently pass. Mitigation: step 1's `beforeAll` assertion that `E2E_BYPASS_AUTH !== '1'` makes this a hard skip with a clear message; the §検証手順 step 4 grep catches any accidental leakage.
- **Memo-folding rule ambiguity**: parent §2 row 3 says "description ∨ memo" — does the wire prefer description, prefer memo, or concatenate? The current QuickCreate behavior in `tastile-web/src/lib/wire/quick-create-schedule-wire.ts:344` is "description wins; memo is dropped when description is non-empty" (per sibling memory `quick-create-schedule-wire` review). A1c's Test 2 leaves description blank precisely to force the memo path; if the merge rule ever flips to "memo always wins" or "concat", Test 2 will surface that as an immediate diff. Mitigation: keep Test 2 in the spec permanently; do not relax to "description contains memo text in any form".
- **`v1_tile.owner` column vs `v1_tile.owner_id`**: A1c reads `owner`, A4a reads `owner_id`. The spec must use the column name that actually exists in the table; if the schema uses `owner_id`, A1c's SQL is wrong and will return zero rows. Mitigation: cross-check the column name with `tastile-core/v1/10` or `crates/v1/migrations/` before writing the SQL; record the actual column name in the spec comment. (The parent's §2 row says `meta.ownerSubjectId` maps to `v1_tile.owner` — verify against the live schema in §検証手順 step 2 first; if the column is actually `owner_id`, change the SQL and the spec's assertion lines.)
- **Cookie name collision** (memory `feedback_cf_cookie_name_waf.md`): `tastile_user_sub=*` is blocked by CloudFlare WAF. A1c runs locally against `127.0.0.1:31400` and the dev wslc stack, so the WAF does not apply. If the spec is ever ported to a hosted environment, the cookie name must be renamed to `tastile_uid` (already done in production v2 deploy 2026-07-06 per memory). Document the local-only assumption in the spec's top comment.
- **Test pollution between sibling specs**: A1c writes to `v1_tile` / `v1_plan` / `v1_subject` with `title LIKE 'A1c%'`. If a sibling spec (e.g. A4a's 2-user-sub spec) does not TRUNCATE before its assertions, it may see A1c's rows. Mitigation: A1c's `afterAll` TRUNCATE covers the same table set; both A1c and A4a should run with `test.describe.configure({ mode: 'serial' })` or be scheduled by the Playwright config so they never run in parallel within the same DB snapshot.

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2 (`meta.ownerSubjectId` row + `content.description = identity.description ∨ meta.memo` row 3)
- **Auth contract**: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §Auth contract + §Bridge header spec
- **Implementation site**: `tastile-core/crates/v1/api/src/handlers/common.rs:823` (the exact `Uuid::new_v5` line A1c mirrors)
- **Wire site**: `tastile-web/src/lib/wire/quick-create-schedule-wire.ts:344` (memo-fold location per parent §2 row 3)
- **Helper source**: H1a plan (`cookie-bridge` helper + `truncateDB` helper used here)
- **Sibling plans**:
  - A1a (default-state smoke that persists `v1_tile` + `v1_plan`; A1c builds on it)
  - A4a (extended owner-derived e2e: 2 user_subs, distinct + determinism; A1c is the minimum pin that single-user submissions resolve `meta.ownerSubjectId` to the UUIDv5 hash of the cookie value)
- **Memory anchors**:
  - `project_tastile_v1_bridge_auth_uuidv5.md` (background: the UUIDv5 derivation is what A1c is testing)
  - `feedback_bridge_owner_provisioning_20260721.md` (background: the bridge auth helper provisions `v1_subject`; A1c's `v1_subject` truncation is required because of this)
  - `feedback_observe_actual_behavior.md` (assert in a real browser + real DB, not via the unit test of the helper alone)
  - `feedback_verify_ui_in_browser.md` (the spec uses Playwright; the assertions check the DB after the form submit, not just the response status)
  - `feedback_cant_open_localhost.md` (`wslc` stack is up so the user can also `wslc container exec tastile-db psql` to spot-check)
  - `feedback_integration_test_skip_masks_contract_bugs.md` (the `E2E_BYPASS_AUTH=1` skip path is the most common way A1c would silently report GREEN; the §実装手順 step 1 guard and the §検証手順 step 4 grep are the defenses)
- **Out of scope (deferred)**:
  - A4a (extended 2-user-sub distinct + determinism assertions; A1c deliberately stops at single-user)
  - Description-vs-memo priority edge cases (Test 2 covers the "description blank, memo non-empty" case; the "both non-empty" case is recorded in §リスク but not asserted)
  - `v1_subject` grow-without-bound across runs (`tests/cleanup-orphan-subjects.spec.ts` — separate plan, not A1c)
