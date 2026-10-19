# E5a — Condition tree basic e2e spec

## メタデータ

- **ID**: E5a
- **Phase**: 3 (acceptance)
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: E2a (Condition AST editor), E2b (shared AST serialiser), G5b (TRUNCATE helper)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §6
- **Sibling plans**: E5b (time-requirement-editor), E5c (task-definition), E5d (metric-decision)

## 前提

- `tastile-web` Playwright harness already green on E1a/E1b level (single-tile create, no condition)
- E2a merged: `src/features/create-tile/ui/ConditionEditor.tsx` exists with ALL/ANY/NOT/TERM operators and the 6 Term kind picker (Reference / Metric / Time / Task / Gap / Calendar) wired into the QuickCreate store
- E2b merged: shared `serialiseConditionAST()` helper lives in `src/features/create-tile/lib/condition-serde.ts` and matches the Rust shape in `crates-v1/domain/src/condition.rs` line numbers TBD-by-E2b
- G5b merged: `e2e/helpers/truncate.ts` exports `truncateAllTables(page)` which round-trips through `POST /admin/truncate` (no direct SQL on the e2e path)
- Bridge stack G1a–G8b is up; `app.tastile.app` is reachable on the canonical dev port; wslc `tastile-v1-api` is serving
- Test user `e5a-condition-basic@e2e.local` is provisioned via G2 (owner + bridge provisioning) and has one empty calendar

## 目的

End-to-end prove that the ConditionEditor surfaces in QuickCreate round-trip into core's `v1_plan.plan.completion.root` column without silent drop — the same silent-drop class of bug E's §2 was designed to surface. Single spec, single AST shape (`ALL: [timeReq, taskRef]`), one DB row assertion, no combinatorial matrix.

## 受入条件

- `tastile-web/e2e/condition-tree-basic.spec.ts` exists, registers under Playwright config `projects.chrome.serial`, and is GREEN in `bunx playwright test` (exit 0, `1 passed`)
- After the spec runs, the most recent row in `v1_plan.plan->'completion'->'root'` (queried via `psql` against the wslc Postgres on the e2e database) deserialises to `{op:"ALL", terms:[<timeReq-shape>, <taskRef-shape>]}` — i.e. the AST is intact, not flattened to `null` or `TERM:pass`
- The `recurring.condition` silent drop is **not** under test here (per parent §2-A, deferred to Phase 4); only `plan.completion.root` is asserted

## 実装手順

1. Create the spec file at `tastile-web/e2e/condition-tree-basic.spec.ts:1-180` (size estimate):
   - `import { test, expect } from '@playwright/test'`
   - `import { truncateAllTables, seedSingleUser, loginViaCognito } from './helpers'`
   - `test.describe.serial('Condition tree basic')` block with one `test('ALL with timeReq + taskRef round-trips', ...)`
2. Add the test data fixtures to `tastile-web/e2e/helpers/fixtures.ts` (new exports):
   - `const timeReqTerm = { kind: 'time', required_minutes: { min: 30, max: 90 } }` (matches `v1/13:60-92`)
   - `const taskRefTerm = { kind: 'task', task_id: '<uuid-of-mark-done-task>' }` (matches `v1/13:122-180` §`TaskReference`)
3. In the test body, seed the test user and log in (re-use `loginViaCognito` from G3):
   - `await truncateAllTables(page)`
   - `await seedSingleUser(page, { email: 'e5a-condition-basic@e2e.local' })`
   - `await loginViaCognito(page, 'e5a-condition-basic@e2e.local')`
4. Open QuickCreate:
   - `await page.goto('/dashboard/timeline')`
   - `await page.getByRole('button', { name: /Quick create|新規タイル/ }).click()`
   - `await expect(page.getByTestId('quick-create-panel')).toBeVisible()`
5. Fill the base fields (title + start):
   - Title input: `Condition Basic E5a`
   - Start: today 09:00 (pick the QuickCreate `dateStart` control)
6. Open the ConditionEditor and build `ALL: [timeReq, taskRef]`:
   - Click `Add completion condition` button → ConditionEditor appears in completion slot
   - Operator select → `ALL`
   - First term row → `TimeRequirement` → required minutes `30` – `90`
   - `Add term` → second row → `TaskReference` → pick the auto-created "Mark done" task from the dropdown
   - Assert the JSON preview textbox under the editor shows `{"op":"ALL","terms":[{...},{...}]}` (the ConditionEditor ships a dev preview pane per E2a)
7. Submit the form:
   - `await page.getByRole('button', { name: /Create|作成/ }).click()`
   - `await expect(page.getByText(/Created|Successfully/i)).toBeVisible({ timeout: 10_000 })`
8. Verify via the API (not the UI — the UI timeline is a separate concern):
   - `const list = await page.request.get('/api/proxy/v1/timeline?from=...&to=...')`
   - `expect(list.status()).toBe(200)`
   - Pull the first `plan_id` from `list.body().plans[]` and `GET /v1/plans/{plan_id}` to grab the exact JSON
9. Capture the `plan.completion.root` shape and dump it to a test attachment for SQL cross-check:
   - `await test.info().attach('completion-root.json', { body: JSON.stringify(root, null, 2), contentType: 'application/json' })`
10. SQL cross-check (manual, run from `tastile-core` repo against the wslc Postgres):
    ```sql
    SELECT plan->'completion'->'root' AS root
    FROM v1_plan
    WHERE plan->>'title' = 'Condition Basic E5a'
    ORDER BY created_at DESC
    LIMIT 1;
    ```
    Expect: `{"op": "ALL", "terms": [{"kind": "time", ...}, {"kind": "task", ...}]}`.

## 検証手順

```bash
# 1. Spec runs green
cd tastile-web
bunx playwright test e2e/condition-tree-basic.spec.ts --reporter=line
# 期待: "1 passed (Xs)" — Playwright line reporter

# 2. SQL cross-check (the load-bearing assertion; spec green alone is not enough)
#    Use the wslc Postgres connection string from tastile-core/.env (DATABASE_URL).
cd tastile-core
psql "$DATABASE_URL" -c "SELECT plan->'completion'->'root' FROM v1_plan WHERE plan->>'title' = 'Condition Basic E5a' ORDER BY created_at DESC LIMIT 1;"
# 期待: JSON object with op=ALL and two terms (time, task); NOT NULL, NOT {"op":"TERM"}

# 3. (Optional but recommended) JSON shape diff between the test attachment and the SQL row
#    Both must show identical "op" and "terms[*].kind" — this is the round-trip proof.
```

If step 1 passes but step 2 shows `NULL` or a flattened shape, the spec is a false positive and the wire builder (`tastile-web/src/features/create-tile/lib/quick-create-schedule-wire.ts` build function) is silently dropping `plan.completion` — file a follow-up against E2b before merging E5a.

## リスク

- **Combinatorial input collapse**: even though E5a only exercises one AST shape (`ALL` × `[time, task]`), the test must not become the de-facto oracle for all 4 operators × 6 term kinds. If the JSON preview assertion in step 6 is too lenient (e.g. `expect(...).toContain('"op"')`), it will pass against a degraded shape. Keep the assertion strict: exact `op` and `terms.length` match.
- **Helper-coupling rot**: `truncateAllTables` (G5b) and `seedSingleUser` (G2) are assumed green. If G5b regresses, E5a will look flaky (race on `v1_plan` row not yet committed when SQL runs). Mitigation: the SQL cross-check uses `ORDER BY created_at DESC LIMIT 1`, which is robust to ordering but not to a missing row — add a precondition `expect(rows).toHaveLength(1)` in the SQL step.
- **AST drift between web and core**: `condition-serde.ts` and `crates-v1/domain/src/condition.rs` can drift silently; the only signal is the SQL cross-check. Recommend running the spec on every PR that touches either file (Playwright `testMatch` already covers it, but document the dependency in the E2b plan).
- **UI selector drift**: the `Add completion condition` button label and the JSON preview textbox test-id must be locked in via E2a. If E2a renames them, E5a breaks at selector resolution time, not at assertion time — keep selectors centralised in `tastile-web/e2e/helpers/selectors.ts` (E2a convention) instead of inline strings.

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §6
- Editor component: `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx` (built in E2a)
- AST serialiser: `tastile-web/src/features/create-tile/lib/condition-serde.ts` (built in E2b)
- Wire builder: `tastile-web/src/features/create-tile/lib/quick-create-schedule-wire.ts` (silent-drop investigation site)
- Domain model: `tastile-core/v1/05` (Condition AST) + `tastile-core/v1/13` (Plan.completion, TimeRequirement, TaskDefinition)
- TRUNCATE helper: `tile-create-e2e-wiring/04-plans/G5b-spec-truncate-extend.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling E5b–E5d cover the remaining e2e specs from parent §6
