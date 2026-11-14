# A2b — Plan.planning + Plan.references wire audit

## メタデータ

- **ID**: A2b
- **Phase**: 1
- **Sub-project parent**: A (tile-plan-meta)
- **Depends on**: A1a (wire scaffold verified), A1b (core schema mapped)
- **Target repos**: `tastile-web`
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2 対象フィールド rows for `Plan.planning`, `Plan.references[]`
- **Sibling plans**: A2a (role + completion), A2c (metrics + decisions), A3a/b (DB e2e), A4a/b (e2e runner), A5a/b (regression + CI)

## 前提

- A1a/A1b で対象 wire ファイル `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts` の全体構造が読み取り済みである
- core 側 `crates/v1/api/src/commands.rs` の `CreateSourcePlanPayload` 定義が読み取り済みである
- spec `tastile-core/v1/02-domain-model.md` の Plan 形状（`:50-90` 付近、特に `references[]` の UUIDv7-only 条項 `:61` 周辺）が読み取り済みである
- DB は `wslc container exec tastile-db psql -U tastile -d tastile_db` で到達可能
- core daemon は `wslc container run … tastile-v1-api:latest` で起動済み（port 31400）

## 目的

QuickCreate の §2 Plan セクションの **後半 2 フィールド**（`Plan.planning.{placement_rules,nesting_rules}` と `Plan.references[]`）が default-state で core の `v1_plan` テーブルに正しく保存され、特に `references[]` が UUIDv7 のみで永続化されることを file:line レベルで証明する。default state では `references[]` は空配列、`planning` は最小構造で e2e が green になることがゴール。

## 受入手順

- wire 側 `quick-create-schedule-wire.ts:351`（`plan.references[]`）と `:354-355`（`plan.placement_rules` / `plan.nesting_rules`）の組み立て式を特定できる
- `:308-324` の `reference_targets` 派生ロジック（UUID 生成/抽出）を Read で確認できる
- form 側（planning rules editor + references picker）の file:line を Grep で特定し、default 挙動が空配列・最小 planning オブジェクトであることを確認できる
- core 側 `CreateSourcePlanPayload` の `planning` / `references` フィールドが `v1/02:50-90` と `v1/02:61` 周辺に整合していることを Read で確認できる
- default-state で submit した結果、`v1_plan.placement_rules` / `v1_plan.nesting_rules` が最小構造で保存され、`v1_plan.references` が空配列（`[]`）で保存されることを DB query で確認できる
- `references[]` の UUID-only 制約（spec `v1/02:61`）に対するスキーマレベル assertion（カラム型が `uuid[]` であること）

## 実装手順

### 1. wire 側 file:line の確定

- `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts` を開き、`:351` 周辺（`plan.references[]`）と `:354-355` 周辺（`plan.placement_rules` / `plan.nesting_rules`）の 5 行前後を Read で読む
- `:308-324` の `reference_targets` 派生ロジックを Read で読む
  - 期待される文字列リテラル: `reference_targets`、`uuid`、`v7`、`references`
  - default state でどう振る舞うか（空配列を返すのか、`null` を返すのか）を特定する
- `:213` 起点の `buildQuickCreateSchedulePayload` で、`planning` と `references` がフォーム入力経由か default 経由かを Grep で確認する
- wire が default state で `references[]` を `[]` として組み立てる経路と、`planning` を `{ placement_rules: [], nesting_rules: [] }` のような最小オブジェクトとして組み立てる経路を文字列リテラル単位で記録する

### 2. form 側 file:line の確定

- `tastile-web/src/features/quick-create/` 配下を Grep `placement_rules` `nesting_rules` し、planning rules editor（rule 追加 UI）の file:line を特定する
  - 期待: rule 行を追加する UI コンポーネントの file:line
- 同様に Grep `references` `reference_targets` し、references picker の file:line を特定する
  - sub-project A では editor は scope 外（spec §5 参照）のため、UI が見つからない場合は「default のみ emit する経路」を wire 側で追跡する
- フォームが default で `references[]` を emit しない（または空配列を emit する）ことを Read で確認する

### 3. core 側 consumer の特定

- `tastile-core/crates/v1/api/src/commands.rs` を Read し、`CreateSourcePlanPayload` の `planning: PlanPlanning` / `references: Vec<Uuid>` フィールド定義の file:line を記録する
- core 側バリデータが `references` を UUID パース／`v7` 制約で検査するかを Grep `parse_uuid` `uuid_v7` `validate_references` 等で確認する
- `tastile-core/v1/02-domain-model.md:61` 周辺の `references[]` の UUIDv7-only 条項を Read で確認し、core 実装と一致していることを記録する
- `v1_plan.references` カラムの型が `uuid[]` であることを DDL（migration ファイル）から確認する

### 4. e2e sub-step の追記

- `tastile-web/e2e/quick-tile-create-e2e.spec.ts` を開き、本 A2b 用の sub-step ブロックを識別可能な test name（例: `Plan.planning + Plan.references default-state`）で追加する
- sub-step の中身:
  1. default state で submit（A2a と同じ payload を使い回せる）
  2. DB から `v1_tile.id` を取得
  3. `v1_plan.placement_rules` / `v1_plan.nesting_rules`（JSONB）を query し、default 最小構造であることを assertion
  4. `v1_plan.references`（`uuid[]`）を query し、長さ = 0（`array_length(..., 1) = 0`）を assertion
  5. DDL レベル assertion: `information_schema.columns` から `v1_plan.references` の型が `ARRAY` で要素型が `uuid` であることを確認
- A2a sub-step の後に本 sub-step を挿入する位置を記録する

## 検証手順

```bash
# 1. wire 側 file:line の存在確認
rg -n "plan.planning|plan.references|placement_rules|nesting_rules|reference_targets" \
  tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts
# 期待: :351 付近に plan.references、:354-355 付近に placement_rules / nesting_rules
# 期待: :308-324 に reference_targets 派生ロジック

# 2. form 側 file:line の存在確認
rg -n "placement_rules|nesting_rules|references" tastile-web/src/features/quick-create/
# 期待: フォーム schema / UI コンポーネントの file:line
# editor 未実装なら default emit 経路のみが wire 側に存在することを確認

# 3. core 側 consumer の存在確認
rg -n "PlanPlanning|references|CreateSourcePlanPayload" tastile-core/crates/v1/api/src/commands.rs
# 期待: planning / references フィールド定義と validator 呼び出し

# 4. DDL 型確認
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT column_name, data_type, udt_name FROM information_schema.columns \
   WHERE table_name='v1_plan' AND column_name IN ('placement_rules','nesting_rules','references');"
# 期待: placement_rules / nesting_rules は jsonb / jsonb、references は ARRAY (要素型 uuid)

# 5. e2e 実行
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation, v1_tile RESTART IDENTITY CASCADE;"
cd tastile-web
bun run test:e2e quick-tile-create-e2e.spec.ts -t "Plan.planning + Plan.references default-state"
# 期待: green / 0 failed
```

確認ポイント:

- wire `:351` の `references[]` が default で `[]`（または `null` だが core 側で `[]` に正規化される）
- wire `:354-355` の `placement_rules` / `nesting_rules` が default で最小構造（空配列もしくは spec 許容の null）
- DB の `v1_plan.references` が `ARRAY[]::uuid[]`、要素数 = 0
- DB の `v1_plan.placement_rules` / `v1_plan.nesting_rules` が JSONB で `{}` または最小構造

## リスク

- **`references[]` の UUID 検証リスク**: web 側が raw 文字列を emit する場合、core 側の UUIDv7 バリデータで拒否される。default state では空配列なので e2e は通るが、references editor 実装時には本 A2b を起点に再監査が必要（spec `v1/02:61` の厳密さを確認する）
- **`reference_targets` 派生ロジック `:308-324` が default で非空配列を返す可能性**: フォームが空でも wire 側でなんらかの reference（例: 直近の source tile）を自動挿入する経路があると、default-state e2e が「想定外の reference 1 件」で fail する。Read で空入力時の挙動を必ず確認する
- **`planning.placement_rules` / `nesting_rules` の default が spec 必須フィールド欠落**: spec `v1/02:50-90` で `placement_rules` がオブジェクト型必須（`null` 不可）の場合、wire が `null` を渡すと core が拒否する。DDL 側 default または wire 側 default のどちらで補填するかを確認し、e2e で 200 + DB 行存在を assertion する

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2（特に `Plan.references[]` / `Plan.planning.{placement_rules,nesting_rules}` 行）§5（references editor は scope 外）
- Sibling plan A2a: `tile-create-e2e-wiring/04-plans/A2a-plan-role-completion.md`
- 親 sub-project 概要: `tile-create-e2e-wiring/00-overview.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Domain model: `tastile-core/v1/02-domain-model.md:50-90`（Plan 形状）、`v1/02:61` 付近（references UUIDv7-only 条項）
- Wire: `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts`（`:213-450`, `:308-324`, `:351`, `:354-355`）
- Core payload: `tastile-core/crates/v1/api/src/commands.rs`（`CreateSourcePlanPayload` 周辺）
- E2E spec: `tastile-web/e2e/quick-tile-create-e2e.spec.ts`
- DDL: `v1_plan` テーブル migration（`references` の `uuid[]` 定義）

## 受入条件

_(このセクションは plan 本文では未記載。issue 化のためにスタブを挿入した。実体は plan 着手時に追記する。)_
