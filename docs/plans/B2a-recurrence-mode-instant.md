# B2a — RecurrenceMode.instant（Time section default）の wire 経路

## メタデータ

- **ID**: B2a
- **Phase**: 1
- **Target repo**: `tastile-web`（store + wire-builder）
- **Sub-project parent**: B（Time + Windows）
- **Depends on**: —（A 完了済み前提：本ファイル単体で完結する境界）
- **Source spec**: `04-sub-projects/B-time-windows.md` §"対象フィールド" `time.whenMode` 行
- **Sibling plans**: B2b（reference-mode deferred）、B3a（windows array persist e2e）、B4a（windows rules timeformat e2e）

## 前提

- `quick-create-store.ts` に `whenMode: "instant" | "day" | "range" | "reference"` の discriminated field が既に存在
- `quick-create-schedule-wire.ts:213-450` の wire-builder ブロックが `whenMode` を分岐キーとして `Placement.baseline.{start,end}` を組み立てる
- `time.span.start` が ISO 文字列（UI 側入力は `LocalDate` 由来、wire 直前で `Instant` 化）の状態
- core 側 `POST /v1/schedule-definitions` は `placement.baseline.start` / `baseline.end` を `Instant` 型として受信

## 目的

§3 Time セクションの default state（`whenMode === "instant"`）にて、UI 入力の `time.span.start` が wire payload 上に `instant_at`（またはそれに準ずる core の representation）として出現し、core 側 handler がこれを `Placement.baseline.start` に到達させる経路を保証する。現状ワイヤは ✓ 済みなので、本計画は「**default = instant 経路を専用アサーションで固定する**」ことが作業の中心。

## 受入条件

- Wire-builder `quick-create-schedule-wire.ts:213-450` の `whenMode === "instant"` 分岐で、`instant_at` フィールドが payload に必ず含まれる（`undefined` / `null` のどちらかに丸めない）
- `quick-create-store.ts` の `whenMode` の初期値が `"instant"` である（他値にすり替わっていない）
- e2e: `default-state QuickCreate persists a placement row` シナリオで、`v1_placement.baseline_start` が UI の `time.span.start` 入力値（Instant 化済み）と一致する 1 行が作成される
- `whenMode === "instant"` 以外の値（`"day"` / `"range"` / `"reference"`）は wire-builder の別分岐を通る（本計画では instant 経路のみを検証、他は B2b / 後続で扱う）

## 実装手順

1. **`quick-create-store.ts` の `whenMode` 初期値を確認・固定**:
   - 該当箇所: store の initial state ブロック（`time` slice 内）
   - 期待値: `whenMode: "instant"` がリテラルで書かれている
   - もし欠落／他値であれば `"instant"` に修正し、PR description に「default instantiation mode」と明記

2. **`quick-create-schedule-wire.ts:213-450` の分岐確認**:
   - `if (time.whenMode === "instant")` または `switch (time.whenMode)` の `"instant"` ケースを特定
   - そのブロック内で `instant_at: time.span.start` を組み立てる式が存在することを確認
   - もし `instant_at` のキー名が core wire spec（`v1/10`）と不一致であれば、wire spec で許可されたフィールド名（例: `baseline.start` 直書き、または `generation.at`）に合わせて修正

3. **`authoredInstant()` ヘルパの呼び出し位置** (`wire:374-410`):
   - 確認: `whenMode === "instant"` 時に `authoredInstant(time.span.start)` が呼ばれ、その戻り値（Instant 文字列）が `placement.baseline.start` に代入される
   - 戻り値が ISO8601 with offset 形式（`2026-08-03T09:00:00+09:00` 等）であることを `console.assert` か別途 unit test で確認

4. **unit test（または store snapshot test）の追加**:
   - テスト名: `wire-builder produces instant_at when whenMode is instant`
   - 入力: `{ whenMode: "instant", span: { start: "2026-08-03T09:00:00+09:00", end: null } }`
   - 期待出力 payload: `instant_at` フィールドに上記 start 文字列がそのまま出現
   - ファイル配置: `tastile-web/app/lib/quick-create/__tests__/schedule-wire.instant.test.ts`（既存ディレクトリがあればそこ、無ければ `__tests__` を新規作成）

5. **e2e 補強** (`tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts` とは別、A5b/A7a 系 spec):
   - 起動条件: G サブプロジェクト完了（`wslc up-v1.sh` 済み、`tastile-db` 起動済み）
   - 手順: QuickCreate を開く → title 入力 → `time.span.start` を明日の 09:00 に設定 → 他項目は default → Submit
   - DB 検査（G5a の wslc helper 経由）:
     ```
     SELECT id, baseline_start, baseline_end, baseline_inside
     FROM v1_placement
     ORDER BY id DESC LIMIT 1;
     ```
   - 期待: 1 行、`baseline_start` が UI 入力の Instant 文字列と完全一致、`baseline_end` が同値（duration 未指定のため start = end を許容するか、core が duration フォールバックで埋めるかは仕様確定 — どちらも許容するが、NOT NULL であること）

6. **境界条件のメモ化**:
   - `whenMode === "instant"` でも `time.span.start` が空文字列なら wire-builder は 422 を投げるべき（現状の挙動を確認）
   - もし validation がない場合は `wire:213` 直前に `if (!time.span.start) throw new Error("instant mode requires time.span.start")` を追加（本計画スコープ内、最小限）

## 検証手順

```bash
# 1. store の whenMode 初期値が literal "instant" であることを確認
rg -n "whenMode" tastile-web/app/lib/quick-create-store.ts | head -20
# 期待: "whenMode: \"instant\"" を含む行が初期 state 定義に出現

# 2. wire-builder の分岐確認
rg -n "whenMode" tastile-web/app/lib/quick-create-schedule-wire.ts
# 期待: ":213" 近辺に if/switch 分岐、"instant" ケース、authoredInstant() 呼び出しが見える

# 3. unit test 実行
cd tastile-web
bunx vitest run app/lib/quick-create/__tests__/schedule-wire.instant.test.ts
# 期待: 1 passed (もしくは既存 test runner に応じた "ok")

# 4. e2e (default-state シナリオ)
cd tastile-web
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
# 期待: exit code 0、上述 DB アサーションで baseline_start が一致

# 5. DB 直接観測 (e2e 失敗時のデバッグ用)
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "SELECT id, baseline_start, baseline_end FROM v1_placement ORDER BY id DESC LIMIT 1;"
```

## リスク

- **`whenMode` の意味論ずれ**: UI チームと core チームの `"instant"` 定義がズレている可能性（例: UI では「終日 1 点」を意味、core では「time-of-day の単一 instant」を期待）。wire spec (`v1/10`) で再確認、最悪 `whenMode` enum 値の rename を提案
- **`time.span.start` が LocalDate 由来**: タイムゾーン coercion が `authoredInstant()` 内で抜けていると、UTC 1970-01-01 や JST 09:00 が壊れる。`tastile-web/app/lib/quick-create/authored-instant.ts` の実装を `wire:374-410` と併せて確認
- **`baseline_end` の扱い**: instant 経路で `time.span.end` が null の場合、core が `baseline_end` をどう扱うかが未確定。e2e 結果の `baseline_end` 列を見てから B1a / B2b の境界を再評価
- **既存 spec への影響**: default-state シナリオは A サブプロジェクトで既に存在。新規 unit test は追加するが、e2e 既存アサーションの修正は行わない

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md`
- Domain spec: `tastile-core/v1/10-time-placement.md` §baseline 型
- Wire spec: `tastile-core/v1/14-wire-schedule-definition.md` `placement.baseline.*` 定義
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §B2 段階
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans:
  - B1a（time window endpoints）
  - B1b（source horizon range / timezone math）
  - B2b（reference mode deferred）
