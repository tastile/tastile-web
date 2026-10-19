# C5a — `priority` field と overlap arbitration の検証

## メタデータ

- **ID**: C5a
- **Phase**: 1
- **Target repo**: `tastile-web`（store + wire） + `tastile-core`（domain + arbiter）
- **Sub-project parent**: C（Recurring + SourceSchedule）
- **Depends on**: A（identity）、B（time）、C1a〜C4（kind/weekday/interval/split の round-trip 完了）
- **Source spec**: `04-sub-projects/C-recurring-source.md` §`priority` 行 + `crates/v1/domain/src/source_schedule.rs:20`
- **Sibling plans**: C3a（source priority offset）、C4a（split policy enum）

## 前提

- `crates/v1/domain/src/source_schedule.rs:20` にて `SourceSchedule.priority: i32` が定義されている
- DB 列 `v1_recurring.priority`（または JSONB 経由）が `integer` (i32)
- core 側 arbiter（`crates/v1/domain/src/arbiter.rs` 相当）が「**2 つの placement が overlap したとき、`priority` が高い方を勝ち、残りを drop または defer**」というルールを持つ
- 現状 `priority` フィールドのワイヤは ✓ 済み（`04-sub-projects/C-recurring-source.md` §対象フィールド）。本計画は **arbiter 動作の e2e レベル証明**まで踏み込む

## 目的

UI 入力の `source.priority`（整数値）が `v1_recurring.priority` に round-trip することを保証し、加えて「同一時間帯に 2 件の placement が overlap する場合、`priority` が高い方の tile が core arbiter で勝る」ことを integration test で証明する。現状は field round-trip のみ確認されており、arbiter 動作のテストは薄い。

## 受入条件

- UI `priority = 5` → wire `source_schedule.priority = 5` → DB `v1_recurring.priority = 5` → re-fetch `5`
- UI `priority = 0` → wire `0` → DB `0` → re-fetch `0`
- UI `priority = -1` → wire `-1` → DB `-1` → re-fetch `-1`（負値も許容）
- core integration test で以下が成立:
  - 2 件の recurring tile を、`priority_high` (priority=10) と `priority_low` (priority=1) で作成、両者の `weekday_mask` ＝ Mon-Fri、`interval_ms` ＝ 60min、同じ `start_date`
  - core arbiter 実行後、`v1_decision_run` または同等の決定ログ（`v1/14` §read model 参照）に `priority_high` が勝ち、`priority_low` が drop/defer される記録が残る
- e2e: 同一時間帯の 2 tile を `priority = 5` と `priority = 10` で作成 → UI の `/api/events/occurrences` レスポンスで priority=10 の tile のみが返る（priority=5 は suppressed）

## 実装手順

1. **wire-builder の priority パススルー確認**:
   - 該当箇所: `quick-create-schedule-wire.ts` 内、`source_schedule.priority` に値を代入するブロック
   - 期待: `priority: source.priority` または `priority: Number(source.priority)` の単純代入
   - 型変換の明示: `source.priority` が string で来る場合は `Number(source.priority)` か `parseInt`、number ならそのまま。型安全のため 1 行修正（本計画の境界）

2. **unit test 追加**:
   - 配置: `tastile-web/app/lib/quick-create/__tests__/schedule-wire.priority.test.ts`
   - ケース:
     - `source.priority = 5` → `payload.source_schedule.priority === 5`
     - `source.priority = 0` → `0`
     - `source.priority = -1` → `-1`
     - `source.priority = "10"`（文字列で来た場合）→ `10`（型変換される）
     - `source.priority = "garbage"` → `0`（fallback、無警告）

3. **DB DDL の確認**:
   - `v1_recurring.priority integer NOT NULL DEFAULT 0` の存在
   - DEFAULT が無い場合、本計画で `ALTER TABLE ... SET DEFAULT 0` を別 migration で追加（任意）

4. **core integration test 追加**:
   - 配置: `crates/v1/api/tests/priority_arbitration_e2e.rs` または既存 test へ追加
   - シナリオ:
     - 同一 source に紐づく 2 件の `Recurring`（identical weekday_mask + interval、identical date range）を作成、片方の `priority = 10`、他方を `priority = 1`
     - core の tick planner（`flow_tick_planner.rs`）を実行
     - 生成された `v1_placement` 行を見て、`priority = 10` 側に紐づく placement が残り、`priority = 1` 側は suppress または defer される
   - 検証 SQL:
     ```
     SELECT s.priority, count(p.id) AS placements
     FROM v1_recurring r
     JOIN v1_source_schedule s ON r.id = s.recurring_id  -- 仮 FK
     LEFT JOIN v1_placement p ON p.source_schedule_id = s.id
     WHERE r.id IN ($1, $2)
     GROUP BY s.priority;
     ```
   - 期待: priority=10 の count が 0 より大きい、priority=1 の count が 0（または priority=10 より明確に少ない）

5. **arbiter ルールの確認** (`crates/v1/domain/src/arbiter.rs` 相当):
   - 「`priority` の値が大きい方を選ぶ」実装があるか
   - もし実装が無い場合、本計画スコープ外（arbiter の新規実装は別チケット）
   - 既存実装が「**同 priority なら先着優先**」「**負値は無効**」などの方言を持つ場合は spec に明記

6. **e2e 補強**:
   - 起動条件: G サブプロジェクト完了
   - 手順:
     1. tile A 作成: title="Study", `priority=5`, time 09:00-10:00 daily
     2. tile B 作成: title="Work", `priority=10`, time 09:30-10:30 daily（同じ時間帯で overlap）
     3. `/api/events/occurrences` を 09:30 のタイムスタンプで fetch
   - 検証: レスポンスに tile B (priority=10) のみが含まれ、tile A は suppress される
   - 失敗時のデバッグ: `wslc container exec tastile-db psql ...` で `v1_placement` と `v1_decision_run` を直接観測

## 検証手順

```bash
# 1. wire-builder priority 経路
rg -n "priority" tastile-web/app/lib/quick-create-schedule-wire.ts
# 期待: source_schedule.priority への代入が見える

# 2. unit test
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/schedule-wire.priority.test.ts
# 期待: 5 tests passed

# 3. core arbiter ルール確認
rg -n "priority" tastile-core/crates/v1/domain/src/arbiter.rs
# 期待: priority 大小比較ロジックが見える

# 4. core integration test (wslc 内)
cd tastile-core.wslc
cargo test --test priority_arbitration_e2e
# 期待: "test result: ok. 1 passed; 0 failed"

# 5. e2e
cd tastile-web
bun run test:e2e -- e2e/quick-create-recurring-e2e.spec.ts
# 期待: occurrences API が priority=10 側のみ返す
```

## リスク

- **arbiter が priority を見ていない**: 現状の arbiter が「先着優先」「全 overlap 拒否」「ランダム」など別のルールである場合、本計画の e2e は fail する。fail したら core 側 arbiter の修正が別チケットで必要（sub-project C のリスクにも「**priority 反映は別タスク**」と書いておくのが安全）
- **負値 priority の意味論**: `priority = -1` を「明示的に抑制」として扱うか、「未指定のゼロより弱いもの」として扱うかは arbiter 依存。本計画は「**保存できる**」までしか保証しない、arbiter 動作は test 4 に分離
- **`/api/events/occurrences` の応答フォーマット**: occurrences API が priority-aware で suppressed を返すか、conflict として複数返すかは `v1/14` §read model の仕様に依存。仕様確認の上で期待値を記述
- **DEFAULT 制約追加による既存データ影響**: ALTER TABLE が大型の場合、online 環境ではロック競合。dev 環境のみで実施、本番 migration は別タスク
- **wire spec に `priority` が無い**: もし wire spec 掲載漏れなら、本計画は `decisions.md` に「wire spec に priority 追加」と記録、v1/14 のドラフト更新を提案

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §`priority` 行 + §リスク「arbiter 動作未確認」
- Domain spec: `tastile-core/v1/08-recurring.md` §priority 意味論 + `v1/04-arbiter.md` §overlap 解消ルール
- Source file: `crates/v1/domain/src/source_schedule.rs:20`
- Arbiter file: `crates/v1/domain/src/arbiter.rs`（存在する場合）
- Wire spec: `tastile-core/v1/14-wire-schedule-definition.md` `source_schedule.priority`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C5 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - C3a（source priority offset）
  - C4a（split policy enum）
  - C7a（recurring weekly e2e green）
