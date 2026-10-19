# G4b — E2E helper TRUNCATE list extension

## メタデータ

- **ID**: G4b
- **Phase**: 0
- **Target repo**: `tastile-web`
- **Sub-project parent**: G (stack-up)
- **Depends on**: G4a (helper must be in wslc form first)
- **Source spec**: `04-sub-projects/G-stack-up.md` §4
- **Sibling plans**: G4a, G5a, G5b

## 前提

- G4a is merged and `tastile-web/e2e/helpers/v1.ts` now executes database cleanup through wslc.
- The six tables currently listed in the helper's TRUNCATE statement are correct: `v1_placement`, `v1_event`, `v1_change_set`, `v1_window`, `v1_recurring` and the existing source table entry in the current helper.
- `v1_tile` is the source-of-truth table for tile data. Verify this against `tastile-core/v1/02-domain-model.md` before implementation.
- This task extends only the cleanup list; the Docker-to-wslc rewrite belongs to G4a.

## 目的

Add `v1_tile` and `v1_annotation` to the TRUNCATE list in `tastile-web/e2e/helpers/v1.ts`, so teardown leaves the test database clean and prevents source tiles and user annotations from leaking into later E2E runs.

## 受入条件

- The TRUNCATE list change is confined to the relevant line range in `tastile-web/e2e/helpers/v1.ts`.
- All eight required tables are listed: `v1_placement`, `v1_event`, `v1_change_set`, `v1_window`, `v1_recurring`, `v1_tile`, `v1_annotation`, plus the existing eighth table entry as confirmed in G4a/current helper.
- Existing table ordering is preserved; `v1_tile` and `v1_annotation` are added without reordering the existing entries.

## 実装手順

1. Read `tastile-core/v1/02-domain-model.md` and confirm that `v1_tile` is the canonical source-of-truth table for tile data.
2. Open `tastile-web/e2e/helpers/v1.ts` at the current TRUNCATE list (the line range containing the cleanup SQL, expected near the helper's database teardown function).
3. Add `v1_tile` and `v1_annotation` to that list, preserving the existing order of all pre-existing table names and the SQL's current formatting.
4. Confirm the diff contains only the requested list extension and no G4a Docker-to-wslc changes.

## 検証手順

1. Confirm both tables exist in the target PostgreSQL schema:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name IN ('v1_tile', 'v1_annotation')
   ORDER BY table_name;
   ```
   Expected result: two rows, `v1_annotation` and `v1_tile`.
2. Run `quick-tile-create-e2e.spec.ts` once through the G4a wslc-backed helper and confirm teardown succeeds.
3. Run the same `quick-tile-create-e2e.spec.ts` immediately a second time against the same database.
4. After the second teardown, query:
   ```sql
   SELECT COUNT(*) AS remaining_tiles FROM v1_tile;
   ```
   Expected result: `0`, demonstrating that source tiles do not pollute the follow-up run. Also confirm the annotation cleanup path leaves no user-set annotations from the prior run.

## リスク

- **Test-order dependency**: Tests may have been passing only because leaked source tiles or annotations remained available. Running the spec twice in sequence can expose hidden ordering assumptions; fix only failures caused by this cleanup contract in the relevant test setup.
- **Missing other tables**: The current cleanup list may not cover every future derived or auxiliary table. Do not expand scope speculatively; record any additional leak observed during verification for a follow-up plan.

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md` §4
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Parent plan: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md`
- Implementation file: `tastile-web/e2e/helpers/v1.ts`
