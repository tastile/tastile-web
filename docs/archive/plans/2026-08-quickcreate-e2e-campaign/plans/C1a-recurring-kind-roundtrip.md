# C1a — Recurring.kind enum round-trip（NONE=0 / DAILY=1 / WEEKLY=2 / MONTHLY=3）

## メタデータ

- **ID**: C1a
- **Phase**: 1
- **Target repo**: `tastile-web`（store + wire） + `tastile-core`（domain）
- **Sub-project parent**: C（Recurring + SourceSchedule）
- **Depends on**: A（basic identity 完了）、B（time wiring 完了）
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"対象フィールド" `generation.kind` 行 + `tastile-core/v1/08-recurring.md` §25-39
- **Sibling plans**: C1b（weekday mask roundtrip）、C1c（interval unit roundtrip）、C2a（validInstant helpers）

## 前提

- `crates/v1/domain/src/source_schedule.rs` に `RecurringKind`（または同等の enum）が以下 4 値で定義されている前提:
  - `NONE = 0`
  - `DAILY = 1`
  - `WEEKLY = 2`
  - `MONTHLY = 3`
- DB 列 `v1_recurring.kind` は `smallint`（enum 禁止規約、`tastile-core/v1/10` §"no enum types in PostgreSQL"）
- wire-builder `:75-110` にて UI 側の `repeatMode` が `generation.kind` に変換される既存ブロックが存在
- core handler 側で `kind` 値が 0..3 の範囲外なら 400 を返す validation が実装済み

## 目的

UI の `recurring.repeatMode` 値（文字列: `"none"` / `"daily"` / `"weekly"` / `"monthly"`、もしくは web ドメインの既存の literal）から core の `generation.kind` の i16 数値表現へのマッピングを、4 値全てについて round-trip で保証する。E2E にて UI → wire → DB → 再 fetch → UI の各段階で値が一致することを証明する。

## 受入条件

- UI の `"none"` → wire `generation.kind = 0` → DB `v1_recurring.kind = 0` → 再 fetch で `0` で観測
- UI の `"daily"` → wire `1` → DB `1` → fetch `1`
- UI の `"weekly"` → wire `2` → DB `2` → fetch `2`
- UI の `"monthly"` → wire `3` → DB `3` → fetch `3`（monthly の UI は本計画スコープでは「選択肢として出すが placements 生成は C 計画の別サブで扱う」前提）
- wire-builder `:75-110` の switch / map で 4 値全てがハンドルされ、未対応値（例: `"condition"`、Phase C/D で扱う）が来た場合は silent drop（本計画のスコープ外 — `04-sub-projects/C-recurring-source.md` §リスク参照）
- core 側 `RecurringKind::try_from(i16)` が 0..3 のみ受け付ける（4 以上は `Err`）

## 実装手順

1. **`crates/v1/domain/src/source_schedule.rs` の enum 確認**:
   - 該当箇所: `enum RecurringKind { None = 0, Daily = 1, Weekly = 2, Monthly = 3 }` 相当の定義があるか
   - もし enum 名が `RecurringKindEnum` や別名であれば plan を修正（本計画は enum の存在を前提、確認のみ）
   - `serde` 属性: `#[repr(i16)]`、`#[derive(Serialize, Deserialize)]` が付いていることを確認
   - `try_from` 実装（または derive macro `TryFromPrimitive`）があるか

2. **DB DDL の確認** (`crates/v1/migrations/V1_*.sql` または `crates/v1/api/migrations/`):
   - `v1_recurring.kind smallint NOT NULL` 相当のカラム定義
   - CHECK 制約 `CHECK (kind BETWEEN 0 AND 3)` が付与されているか（任意、推奨）
   - もし CHECK 制約が欠落している場合、本計画で追加（schema migration 番号を `decisions.md` に記録）

3. **wire-builder `:75-110` のマップテーブル追加**:
   - 該当箇所: `quick-create-schedule-wire.ts:75-110` の `repeatMode` を `generation.kind` に変換するブロック
   - UI literal → core numeric のマップ（例）:
     ```ts
     const kindMap: Record<string, number> = {
       none: 0,
       daily: 1,
       weekly: 2,
       monthly: 3,
     } as const;
     const kind = kindMap[recurring.repeatMode] ?? 0; // unknown → NONE
     ```
   - `unknown → 0 (NONE)` のフォールバックは C 計画 §"スコープ外" に基づき silent drop（「`condition`」が来たら `0` に丸める）。警告ログは出さない（本計画は最小）
   - もし既存コードが `if` 文チェーンで書かれている場合は `kindMap` に置換（可読性目的、本計画の本筋ではない）

4. **unit test の追加**:
   - テスト名: `wire-builder maps repeatMode to generation.kind for all 4 values`
   - 配置: `tastile-web/app/lib/quick-create/__tests__/schedule-wire.recurring-kind.test.ts`
   - ケース:
     - `repeatMode = "none"` → `payload.generation.kind === 0`
     - `repeatMode = "daily"` → `1`
     - `repeatMode = "weekly"` → `2`
     - `repeatMode = "monthly"` → `3`
     - `repeatMode = "condition"`（将来用）→ `0`（silent drop、warn なし）

5. **integration test の追加** (tastile-core 側):
   - 配置: `crates/v1/api/tests/recurring_kind_roundtrip.rs` または既存 `tests/source_schedule.rs` の該当 case
   - ケース: `RecurringKind::None` を `serde_json` で `"kind":0` に serialize → DB insert → fetch → `RecurringKind::None` に deserialize できることを確認
   - 4 値全てで同様

6. **e2e 補強** (sub-project C の e2e spec 経由):
   - 起動条件: G サブプロジェクト完了、C1b（weekday mask）/ C1c（interval unit）前の状態でも本テストは独立に実行可能
   - 手順: QuickCreate → §5 Recurring で `repeatMode` を "daily" 選択 → 他項目 default → Submit
   - DB 検査（G5a の wslc helper 経由）:
     ```
     SELECT r.kind
     FROM v1_recurring r
     JOIN v1_tile t ON t.id = r.tile_id
     ORDER BY r.id DESC LIMIT 1;
     ```
   - 期待: `kind = 1`
   - 同様シナリオを `"weekly"` で実行 → `kind = 2`

## 検証手順

```bash
# 1. core 側の enum 定義確認
rg -n "RecurringKind" tastile-core/crates/v1/domain/src/source_schedule.rs
# 期待: enum 定義、try_from 実装が見える

# 2. DB DDL 確認
rg -n "v1_recurring" tastile-core/crates/v1/migrations/ | head -30
# 期待: kind smallint NOT NULL 定義が見える

# 3. wire-builder のマップ確認
rg -n "kindMap\|generation.kind\|repeatMode" tastile-web/app/lib/quick-create-schedule-wire.ts
# 期待: :75-110 付近で 4 値マップが見える

# 4. web unit test
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/schedule-wire.recurring-kind.test.ts
# 期待: 5 tests passed

# 5. core integration test (wslc 内)
cd tastile-core.wslc
cargo test --test source_schedule recurring_kind
# 期待: "test result: ok. 4 passed; 0 failed"

# 6. e2e (recurring 全般)
cd tastile-web
bun run test:e2e -- e2e/quick-create-recurring-e2e.spec.ts
# 期待: exit code 0、DB の kind 列が期待値
```

## リスク

- **enum の numeric 値が wire spec と一致するか**: `tastile-core/v1/08` と `crates/v1/domain/src/source_schedule.rs` の値が乖離している可能性。`decisions.md` に「wire spec 準拠の数値」と明記、core 側コードが wire spec に追従していない場合は core 側を修正（本計画の受入条件に含む）
- **`condition` repeatMode の silent drop**: Phase C/D まで UI に出てこないため、現状は問題にならない。将来的に UI で `condition` を選んだ場合に意図せず `NONE` として保存されるリスク → コメントで明示
- **monthly の placements 生成は未対応**: monthly kind=3 で保存できても、`v1_placement` 行が生成されない／生成アルゴリズムが未実装の可能性。本計画は「DB 保存ラウンドトリップ」のみを扱う、placements 生成は別計画
- **CHECK 制約の追加が migration chain を壊す可能性**: 既存テストデータの `kind` が 0..3 範囲内であることを確認してから migration を追加（`SELECT MIN(kind), MAX(kind), COUNT(*) FROM v1_recurring;`）

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md`
- Domain spec: `tastile-core/v1/08-recurring.md` §25-39 (RecurringKind)
- Schema: `tastile-core/v1/10-data-dictionary.md` `v1_recurring.kind` 行
- Wire spec: `tastile-core/v1/14-wire-schedule-definition.md` `generation.kind`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C1 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - C1b（weekday mask roundtrip）
  - C1c（interval unit roundtrip e2e）
  - C7a（recurring weekly e2e green）
