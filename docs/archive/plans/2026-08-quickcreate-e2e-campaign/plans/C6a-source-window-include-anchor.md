# C6a — `SourceWindowInclude` enum + `anchor_mode`（FIXED / FLOATING）の round-trip

## メタデータ

- **ID**: C6a
- **Phase**: 1
- **Target repo**: `tastile-web`（store + wire） + `tastile-core`（domain）
- **Sub-project parent**: C（Recurring + SourceSchedule）
- **Depends on**: A（identity）、B（time windows, B1a, B4a）、C1a-C5a の前段
- **Source spec**: `04-sub-projects/C-recurring-source.md` §`window.start_offset_ms / end_offset_ms` 行 + `crates/v1/domain/src/source_schedule.rs:106-107`
- **Sibling plans**: B1a（time window endpoints）、C6b（source window offset derivation e2e）

## 前提

- `crates/v1/domain/src/source_schedule.rs:106-107` にて `Window` struct の `start_offset_ms` / `end_offset_ms` が `i64` で定義されている
- `SourceWindowInclude` enum は `tastile-core/v1/08-recurring.md` 相当の spec で「ある／なし」の 2 値（または「INCLUDED / EXCLUDED」）が議論されている前提 — 本計画ではそれを `i16` (`INCLUDED = 0` / `EXCLUDED = 1`) として round-trip させる
- `anchor_mode` enum は UI / wire 上で `FIXED` (= 0, 元の placement 開始点に対する絶対 offset) / `FLOATING` (= 1, 生成時刻を起点とした相対 offset) の 2 値で表現される前提
- 現状、wire 経路の field としての発火は implicit（`time.span` から derive）のため explicit なテストが無い

## 目的

`source_schedule.window.{start_offset_ms, end_offset_ms}` が UI の `time.span` から正しく derive され DB に到達すること、加えて `source_window_include` (include/exclude) と `anchor_mode` (FIXED/FLOATING) の 2 値 enum がそれぞれ round-trip できることを保証する。現状は `✓ implicit` 止まりで、明示的テストが無いため本計画でそれを固定する。

## 受入条件

- `time.span = { start: "2026-08-03T09:00:00+09:00", end: "2026-08-03T10:00:00+09:00" }` の場合:
  - `source_schedule.window.start_offset_ms = 0`（または生成 anchor からの相対値、仕様確定）
  - `source_schedule.window.end_offset_ms = 3600000`（1h = 3,600,000 ms）
- UI `sourceWindowInclude = "INCLUDED"` → wire `1` (or `0`) → DB `1` (or `0`) → re-fetch 一致
- UI `sourceWindowInclude = "EXCLUDED"` → wire `0` (or `1`) → DB 一致
- UI `anchorMode = "FIXED"` → wire `0` → DB `0` → re-fetch `0`
- UI `anchorMode = "FLOATING"` → wire `1` → DB `1` → re-fetch `1`
- DB に `v1_source_schedule_includes`（または同等の read model table）が存在し、各 row に `include_kind` / `anchor_mode` カラムが正しく入る
- `anchor_mode = FLOATING` で生成された placement の `baseline_start` が `tick_planner` 実行時刻を起点に relative に計算される

## 実装手順

1. **enum / table 存在確認**:
   - `crates/v1/domain/src/source_schedule.rs:106-107` の `Window` struct 確認
   - 該当 table 名の調査: `rg -n "v1_source_schedule_includes\|source_window_include\|anchor_mode" tastile-core/`
   - もし table / enum が未定義の場合、本計画スコープ外として別チケットに分離し、本計画は「**現状の構造を前提に、既存 field の round-trip のみを保証**」する形に縮約

2. **`window.start_offset_ms` / `window.end_offset_ms` の derive ロジック特定**:
   - `quick-create-schedule-wire.ts` 内で `window.start_offset_ms = (time.span.start - anchor).ms` を計算するブロック
   - 該当箇所が無い（implicit 計算が不要な構造）場合は本計画はその 2 field を skip、`include` / `anchor_mode` のみ扱う

3. **`include` / `anchor_mode` を wire payload に明示**:
   - wire-builder の `source_schedule` 出力ブロックに以下を追加:
     ```ts
     source_window_include: includeMap[source.include ?? "INCLUDED"] ?? 0,
     anchor_mode: anchorMap[source.anchorMode ?? "FIXED"] ?? 0,
     ```
   - map 定義:
     ```ts
     const includeMap = { INCLUDED: 1, EXCLUDED: 0 } as const; // wire spec に合わせる
     const anchorMap  = { FIXED: 0, FLOATING: 1 } as const;
     ```
   - 数値の `0/1` 割当は wire spec (`v1/14`) で確定（本計画は「**現状の読み取り結果に合わせる**」方針）

4. **unit test 追加**:
   - 配置: `tastile-web/app/lib/quick-create/__tests__/schedule-wire.window-include.test.ts`
   - ケース:
     - `include = "INCLUDED"` → `payload.source_schedule.source_window_include === 1` (or spec)
     - `include = "EXCLUDED"` → `0` (or spec)
     - `anchorMode = "FIXED"` → `payload.source_schedule.anchor_mode === 0`
     - `anchorMode = "FLOATING"` → `1`
     - `time.span = { start, end }` で 1h duration → `window.end_offset_ms = 3600000`

5. **core integration test 追加**:
   - 配置: `crates/v1/api/tests/source_window_include_roundtrip.rs`
   - シナリオ:
     - `Window { start_offset_ms: 0, end_offset_ms: 3_600_000, include: SourceWindowInclude::Included, anchor_mode: AnchorMode::Fixed }` を serde → DB insert → fetch → 一致
     - 同じ構造で `Excluded` / `Floating` の round-trip

6. **e2e 補強**:
   - 起動条件: G サブプロジェクト完了、B サブプロジェクト完了（windows array persist）
   - 手順:
     1. QuickCreate → §3 Time で `span = { start: 09:00, end: 10:00 }`
     2. §5 Source: `anchorMode = "FLOATING"` 選択
     3. Submit
   - DB 検査:
     ```
     SELECT
       window->>'start_offset_ms' AS start_offset_ms,
       window->>'end_offset_ms' AS end_offset_ms,
       source_window_include,
       anchor_mode
     FROM v1_source_schedule
     ORDER BY id DESC LIMIT 1;
     ```
   - 期待: `start_offset_ms` または `0`（derive による）、`end_offset_ms = 3600000`、include/anchor_mode が wire で送った値

7. **`v1_source_schedule_includes` 副表の扱い**:
   - read model として別 table がある場合、`SELECT * FROM v1_source_schedule_includes WHERE source_schedule_id = $1` で row の存在と `include_kind` / `anchor_mode` を検査
   - 本計画は「**最低 1 row 存在 + 2 column に期待値**」までで OK

## 検証手順

```bash
# 1. enum / table の存在確認
rg -n "SourceWindowInclude\|AnchorMode\|v1_source_schedule_includes" tastile-core/crates/v1/
# 期待: enum 定義、table 定義が見える（無ければ計画を縮約）

# 2. wire-builder の map
rg -n "includeMap\|anchorMap\|anchor_mode\|source_window_include" tastile-web/app/lib/quick-create-schedule-wire.ts
# 期待: 上記のマップ定義が見える

# 3. unit test
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/schedule-wire.window-include.test.ts
# 期待: 5 tests passed

# 4. core integration test
cd tastile-core.wslc
cargo test --test source_window_include_roundtrip
# 期待: "test result: ok. 2 passed; 0 failed" (Included/Floating 含む)

# 5. e2e
cd tastile-web
bun run test:e2e -- e2e/quick-create-recurring-e2e.spec.ts
# 期待: DB column が期待値
```

## リスク

- **enum の方向性未定**: 現状 `tastile-core/v1/08` に `SourceWindowInclude` の記述があっても、wire spec との数値マッピングが未確定の可能性。本計画は「**core 実装の数値を読み取って wire に合わせる**」方針
- **`anchor_mode = FLOATING` の挙動が未実装**: FLOATING で作成しても、core の tick_planner が「生成 anchor」からの offset を適用しない実装である場合、e2e で `baseline_start` が期待値からずれる。本計画はまず unit test / integration test で保存ラウンドトリップまで保証し、planner 動作の観測は C6b に分離
- **副 table (`v1_source_schedule_includes`) のスキーマ**: read model 側の table 構造が本計画執筆時点で未確定の可能性。本計画の SQL は「副 table の存在を仮定したクエリ」で、無ければ表ごと skip
- **derive の基準 anchor**: `window.start_offset_ms = 0` の意味は「**日次生成される placement の 0 時からの offset**」なのか「**作成 anchor からの offset**」なのかで意味が変わる。spec 確認の上、test の期待値を確定
- **`time.span` 空のとき**: 現状 B 計画で議論されている `Duration-only モード` と相互作用。span が無い場合の `window.start_offset_ms` は null になる／0 になる／送信しない のいずれか、core の挙動に合わせる

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §`window.*_offset_ms` 行
- Domain spec: `tastile-core/v1/08-recurring.md` §Window + §SourceWindowInclude + §AnchorMode
- Source file: `crates/v1/domain/src/source_schedule.rs:106-107`
- Wire spec: `tastile-core/v1/14-wire-schedule-definition.md` `source_schedule.window.*` + `source_window_include` + `anchor_mode`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C6 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - B1a（time window endpoints）
  - B1b（source horizon range）
  - C6b（source window offset derivation e2e: 派生計算の full e2e 観測）
  - C7a（recurring weekly e2e green）
