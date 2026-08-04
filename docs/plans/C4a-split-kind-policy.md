# C4a — SplitPolicyKind enum round-trip（NONE=0 / DAILY_BOUNDARY=1 / SESSION_BOUNDARY=2）

## メタデータ

- **ID**: C4a
- **Phase**: 1
- **Target repo**: `tastile-web`（store + wire） + `tastile-core`（domain）
- **Sub-project parent**: C（Recurring + SourceSchedule）
- **Depends on**: A（identity）、B（time）
- **Source spec**: `04-sub-projects/C-recurring-source.md` §`split_policy.kind` 行 + `crates/v1/domain/src/source_schedule.rs:112-118`
- **Sibling plans**: C3a（source priority offset）、C4b（split-policy split deferred）

## 前提

- `crates/v1/domain/src/source_schedule.rs:112` 付近に `SplitPolicyKind` enum が以下の 3 値で定義されている:
  - `NONE = 0`（`sub-project C` のドキュメントでは `Unsplit` とも）
  - `DAILY_BOUNDARY = 1`
  - `SESSION_BOUNDARY = 2`
- wire-builder `:298-307` にて UI の `source.splitPolicy`（`"NONE"` / `"DAILY_BOUNDARY"` / `"SESSION_BOUNDARY"` の文字列）が `source_schedule.split_policy.kind`（i16 数値）に変換される
- DB 列 `v1_recurring.split_kind`（または `v1_source_schedule.split_policy->>'kind'` 経由の JSONB アクセス）が `smallint`
- 本計画は **`kind` フィールドのみ**を扱い、`min_segment_ms` / `max_segment_ms` / `max_segments` の partial 状態は別計画（C4b）とする

## 目的

UI の `source.splitPolicy` 文字列 3 値を core の `SplitPolicyKind` 数値表現に正しく round-trip させる。現状 `kind` のみ ✓ 済みなので、本計画はそれを **3 値全てについて明示的テストで保証し、UI が知らない `kind = 0` を NONE として扱う**ことを再確認する。

## 受入条件

- UI `"NONE"` → wire `split_policy.kind = 0` → DB `split_policy->>'kind' = '0'` → re-fetch で `0`
- UI `"DAILY_BOUNDARY"` → wire `1` → DB `1` → re-fetch `1`
- UI `"SESSION_BOUNDARY"` → wire `2` → DB `2` → re-fetch `2`
- wire-builder `:298-307` ブロックが 3 値全てをハンドリングし、未知値が来た場合は `0` にフォールバック（silent）
- core 側 `SplitPolicyKind::try_from(i16)` が 0..2 の範囲外なら `Err`
- `kind = 1` または `2` の場合、現状の wire payload には `min_segment_ms` / `max_segment_ms` / `max_segments` を含まない（partial scope の明示）— e2e で `kind` 値のみ確認

## 実装手順

1. **`crates/v1/domain/src/source_schedule.rs:112-118` の enum 確認**:
   - `enum SplitPolicyKind { None = 0, DailyBoundary = 1, SessionBoundary = 2 }` 相当の定義
   - `serde` 属性、`try_from` 実装の存在確認
   - struct `SplitPolicy` の `kind` フィールドが `SplitPolicyKind` 型であることの確認

2. **wire-builder `:298-307` のマップ追加**:
   - 該当箇所: `quick-create-schedule-wire.ts:298-307`
   - 既存ロジックが partial の可能性（`splitPolicy ?? "NONE"` しか書いていない等）があるため、3 値マップを明示:
     ```ts
     const splitKindMap: Record<string, number> = {
       NONE: 0,
       DAILY_BOUNDARY: 1,
       SESSION_BOUNDARY: 2,
     } as const;
     const splitKind = splitKindMap[source.splitPolicy] ?? 0;
     ```
   - 出力: `source_schedule.split_policy = { kind: splitKind }`（他の 3 フィールドは省略）
   - もし wire spec が `split_policy.kind` の他にも要求する場合、その差分は wire spec 確認の上、最小実装（本計画の境界）

3. **unit test 追加**:
   - 配置: `tastile-web/app/lib/quick-create/__tests__/schedule-wire.split-policy.test.ts`
   - ケース:
     - `splitPolicy = "NONE"` → `payload.source_schedule.split_policy.kind === 0`
     - `splitPolicy = "DAILY_BOUNDARY"` → `1`
     - `splitPolicy = "SESSION_BOUNDARY"` → `2`
     - `splitPolicy = "GARBAGE"` → `0`（silent drop）

4. **core integration test 追加**:
   - 配置: `crates/v1/api/tests/split_policy_roundtrip.rs`（既存ディレクトリに同居可）
   - ケース:
     - `SplitPolicyKind::None` → serde `"kind":0`
     - `DailyBoundary` → `"kind":1`
     - `SessionBoundary` → `"kind":2`
     - DB insert → fetch → 等価性確認

5. **DB DDL の確認**:
   - `v1_recurring.split_kind smallint` の存在（または JSONB 経由のアクセス経路）
   - 既存 migration 番号を確認し、必要なら CHECK 制約追加（任意）

6. **e2e 補強**:
   - 起動条件: G サブプロジェクト完了
   - 手順: QuickCreate → §5 Source パネル → `splitPolicy = "DAILY_BOUNDARY"` 選択 → Submit
   - DB 検査:
     ```
     SELECT split_policy->>'kind' AS split_kind
     FROM v1_source_schedule
     ORDER BY id DESC LIMIT 1;
     ```
   - 期待: `split_kind = 1`

7. **境界ケースのメモ化**:
   - `split_kind = 1` または `2` で保存されても、`min_segment_ms` / `max_segment_ms` / `max_segments` が payload にないため、core 側で zero / default になり、結果として「split されないか、サーバ側で拒否される」可能性。本計画では「**wire が kind のみを送る**」事実を固定し、split が起きないこと／起きないことへの不平は C4b に分離

## 検証手順

```bash
# 1. core enum 定義
rg -n "SplitPolicyKind" tastile-core/crates/v1/domain/src/source_schedule.rs
# 期待: enum + serde + try_from

# 2. wire-builder のマップ
rg -n "splitKindMap\|split_policy\|splitPolicy" tastile-web/app/lib/quick-create-schedule-wire.ts
# 期待: :298-307 付近で 3 値マップが見える

# 3. web unit test
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/schedule-wire.split-policy.test.ts
# 期待: 4 tests passed

# 4. core integration test (wslc 内)
cd tastile-core.wslc
cargo test --test source_schedule split_policy
# 期待: "test result: ok. 4 passed; 0 failed"

# 5. e2e (recurring + source)
cd tastile-web
bun run test:e2e -- e2e/quick-create-recurring-e2e.spec.ts
# 期待: exit code 0、DB の split_kind 列が期待値
```

## リスク

- **enum の数値ずれ**: wire spec (`v1/14`) と core の数値が乖離している可能性（例: wire は `1=UNSPLIT, 2=SPLIT_DAILY, 3=SPLIT_SESSION` だが core は `0=NONE, 1=DAILY_BOUNDARY, 2=SESSION_BOUNDARY`）。本計画は **core の数値を正とし、wire spec をそれに合わさせる** 方針（decisions.md に記録すること）
- **`split_kind = 1 or 2` で 422 が返る可能性**: core が min/max/max_segments を必須 validation にしている場合、wire payload が kind のみだと reject される。本計画は「**現状 reject されない**」ことを前提にしているが、もし reject されたら wire-builder で min = 1, max = null, max_segments = null を埋める workaround を別タスクで実施
- **JSONB カラム vs 個別カラム**: `v1_recurring.split_kind` が JSONB 経由（`split_policy->>'kind'`）なのか、別カラムなのかで SQL が異なる。本計画は JSONB 経由のクエリを書くが、設計が変わった場合は適宜修正
- **silent drop のフォールバック**: UI で `splitPolicy` を unset のまま Submit したら `0` に fallback するが、UI 側で「未選択」を許しているかは別途確認（本計画の境界）

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §`split_policy.kind` 行
- Domain spec: `tastile-core/v1/08-recurring.md` §split_policy 定義
- Source file: `crates/v1/domain/src/source_schedule.rs:112-118`
- Wire file: `quick-create-schedule-wire.ts:298-307`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C4 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - C3a（source priority offset）
  - C4b（split-policy split deferred: min/max/max_segments の UI 化）
  - C7a（recurring weekly e2e green）
