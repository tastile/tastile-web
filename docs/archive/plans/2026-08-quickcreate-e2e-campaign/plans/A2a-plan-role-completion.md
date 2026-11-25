# A2a — Plan.role + Plan.completion wire audit

## メタデータ

- **ID**: A2a
- **Phase**: 1
- **Sub-project parent**: A (tile-plan-meta)
- **Depends on**: A1a (wire scaffold verified), A1b (core schema mapped)
- **Target repos**: `tastile-web`
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2 対象フィールド rows for `Plan.role`, `Plan.completion`
- **Sibling plans**: A2b (planning + references), A2c (metrics + decisions), A3a/b (DB e2e), A4a/b (e2e runner), A5a/b (regression + CI)

## 前提

- A1a/A1b で対象 wire ファイル `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts` の全体構造（`buildQuickCreateSchedulePayload` が `:213-450` に存在すること、`publishScheduleDefinition` 呼び出し、core への envelope 変換）が読み取り済みである
- core 側 `crates/v1/api/src/commands.rs` の `CreateSourcePlanPayload` / `CreateSourceTilePayload` 定義（`:112` 周辺、`command.rs:198` 周辺）が読み取り済みである
- spec `tastile-core/v1/02-domain-model.md` の Plan 形状（`:50-90` 付近）と `tastile-core/v1/13` 不変条件が読み取り済みである
- DB は `wslc container exec tastile-db psql -U tastile -d tastile_db` で到達可能
- core daemon は `wslc container run … tastile-v1-api:latest` で起動済み（port 31400）

## 目的

QuickCreate の §2 Plan セクションの **前半 2 フィールド**（`Plan.role` と `Plan.completion.{root,timeRequirements,tasks}`）が default-state で実際に core の `v1_plan` テーブルに到達し、spec 不変条件に違反しないことを file:line レベルで証明する。e2e の green を出すことがゴール。

## 受入条件

- wire 側 `quick-create-schedule-wire.ts:350`（`plan.role`）と `:352`（`plan.completion.*`）の代入式が spec どおり default 値（`role: "primary"` ∨ `meta.isLabelOnly`、completion は最小 "Mark done" タスク）で組み立てられることを Read で確認できる
- form 側（`plan.role` セレクタ + `plan.completion` ビルダー）の対応 file:line を Grep で特定し、デフォルト挙動が wire の default と一致することを確認できる
- core 側 `CreateSourcePlanPayload` の `role` / `completion` フィールドが `commands.rs` 内で `v1/02:50-90` の Plan 形状に整合していることを Read で確認できる
- default-state で QuickCreate を 1 回 submit した結果、`v1_plan.role` カラムが許容 enum 内の値で保存され、`v1_plan.completion`（JSONB カラム）内に folding された "Mark done" タスク 1 件が入ることを行レベルで確認できる
- `v1/13` 不変条件（completion ツリーの root 必須・task 1 件以上）に違反しない（`select … from v1_plan` 結果に対する assertion）

## 実装手順

### 1. wire 側 file:line の確定

- `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts` を開き、`:350` 周辺（`plan.role` の組み立て）と `:352` 周辺（`plan.completion` ブロック組み立て）の 5 行前後を Read で読む
- `:269-276` の folding ロジック（default "Mark done" タスク注入）を Read で読む
  - 期待される文字列リテラル: `"Mark done"`、`tasks`、`root`、`timeRequirements`
- `:213` 起点の `buildQuickCreateSchedulePayload` シグネチャを確認し、`role` と `completion` が引数経由ではなく内部 default 組み立てか呼び出し元注入かを Grep で特定する
- wire が `Plan.role` をどう決めているか（`meta.isLabelOnly` 経由の導出か、固定 `"primary"` か）を string literal 単位で記録する

### 2. form 側 file:line の確定

- `tastile-web/src/features/quick-create/` 配下を Grep `plan.role` し、UI コントロール（ドロップダウン/ラジオ/チェックボックス）の file:line を特定する
- 同様に Grep `plan.completion` / `Mark done` し、completion builder（task 追加 UI、root 設定 UI）の file:line を特定する
- 特定したフォームコントロールが default で何を emit するか（ラベルオンリー時の `role: "label"`、通常時の `role: "primary"`、completion の最小構造）を Read で確認する
- フォームの submit ハンドラが呼ぶ wire 関数名を Grep し、wire 側 default との接続を確認する

### 3. core 側 consumer の特定

- `tastile-core/crates/v1/api/src/commands.rs` を Read し、`CreateSourcePlanPayload` の `role: PlanRole` / `completion: PlanCompletion` フィールド定義の file:line を記録する
- core 側バリデータ（該当コマンドを処理する handler）が `role` の許容値（spec で定義された enum）と `completion.root` / `tasks` の必須性をどう検査するかを Grep `validate_role` `require_root` `tasks_not_empty` 等で確認する
- `tastile-core/v1/02-domain-model.md:50-90` の Plan 形状（role 型、completion サブスキーマ）と core 実装が一致していることを Read で確認する
- `tastile-core/v1/13` 不変条件の章番号・条文を確認し、本 A2a で assert すべき条文（completion root 必須、tasks ≥ 1 等）をリスト化する

### 4. e2e sub-step の追記

- `tastile-web/e2e/quick-tile-create-e2e.spec.ts` を開き、本 A2a 用の sub-step ブロックを識別可能な test name（例: `Plan.role + Plan.completion round-trip`）で追加する
- sub-step の中身:
  1. default state で submit
  2. DB から当該 `v1_tile.id` を取得（title 一致で lookup）
  3. `v1_plan` を `tile_id = …` で取得し、`role` カラム値を assertion（`"primary"` ∨ spec 許容値の配列に含まれる）
  4. `v1_plan.completion` を `jsonb` として query し、`root` ノードの存在と `tasks` 配列長 ≥ 1 を assertion
  5. `v1/13` の該当不変条件に対する assertion（`tasks[].state` が spec どおり、`timeRequirements` の有無等）
- A1 系 sub-step の後に本 sub-step を挿入する位置を記録する

## 検証手順

```bash
# 1. wire 側 file:line の存在確認
rg -n "plan.role|plan.completion" tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts
# 期待: :350 付近に plan.role、:352 付近に plan.completion.* の代入行
# 期待: :269-276 に "Mark done" を含む folding ロジック

# 2. form 側 file:line の存在確認
rg -n "plan.role|plan.completion|Mark done" tastile-web/src/features/quick-create/
# 期待: UI コントロールの file:line と form schema (zod/yup) の file:line

# 3. core 側 consumer の存在確認
rg -n "PlanRole|PlanCompletion|CreateSourcePlanPayload" tastile-core/crates/v1/api/src/commands.rs
# 期待: role / completion フィールド定義と validator 呼び出し

# 4. e2e 実行
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation, v1_tile RESTART IDENTITY CASCADE;"
cd tastile-web
bun run test:e2e quick-tile-create-e2e.spec.ts -t "Plan.role + Plan.completion round-trip"
# 期待: green / 0 failed
```

確認ポイント:

- wire `:350` の `role` が `meta.isLabelOnly === true` のとき `"label"`、それ以外 `"primary"` になる（spec 許容値内）
- wire `:352` の `completion` が `:269-276` の folding を経由して `tasks.length === 1` で `"Mark done"` を含む
- DB の `v1_plan.role` が許容値、`v1_plan.completion->'tasks'` の JSONB 配列長 ≥ 1

## リスク

- **default-task folding が `v1/13` 不変条件と衝突する可能性**: wire `:269-276` は最小 1 件の "Mark done" タスクを folding するが、spec `v1/13` が `tasks[0].kind` や `timeRequirements` の特定形を要求する場合、folding 結果が拒否される。`v1/13` の該当条文を Read で確認し、e2e で status code 200 + DB に行が入ることをもって「不変条件違反なし」と判定する
- **`Plan.role` の default が spec のラベルオンリー解釈と齟齬**: `meta.isLabelOnly` 経由の導出と、spec の `role` のセマンティクス（plan kind の primary vs label）が一致しているか `v1/02:50-90` の定義と wire のロジック双方で再確認する
- **completion folding が副作用として `timeRequirements` を null にする**: デフォルト "Mark done" タスクが `timeRequirements` を要求する場合、wire 側で空オブジェクトにするか null にするかで validator の挙動が変わる。core 側テスト `commands.rs` 周辺の該当 unit test が通っていることを Read で確認する

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §2（特に `Plan.role` / `Plan.completion.{root,timeRequirements,tasks}` 行）
- Sibling plan A2b: `tile-create-e2e-wiring/04-plans/A2b-plan-planning-references.md`
- 親 sub-project 概要: `tile-create-e2e-wiring/00-overview.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Domain model: `tastile-core/v1/02-domain-model.md:50-90`
- 不変条件: `tastile-core/v1/13`（章番号は Read で確定）
- Wire: `tastile-web/src/features/quick-create/wire/quick-create-schedule-wire.ts`（`:213-450`, `:269-276`, `:350`, `:352`）
- Core payload: `tastile-core/crates/v1/api/src/commands.rs`（`CreateSourcePlanPayload` 周辺）
- E2E spec: `tastile-web/e2e/quick-tile-create-e2e.spec.ts`