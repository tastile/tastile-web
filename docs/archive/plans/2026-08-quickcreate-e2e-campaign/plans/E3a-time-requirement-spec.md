# E3a — TimeRequirement TS 型 + シリアライザ

## メタデータ

- **ID**: E3a
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: A (wire 経由の `PublishScheduleDefinitionPayload` に `Plan.completion.timeRequirements[]` が既に到達していること)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §4 + `tastile-core/v1/13-completion.md:16-93`

## 前提

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:258-294` が `state.plan.completion.timeRequirements` を `published.tasks` を通じて `toWireSetPlanBody` に渡している (デフォルト `{required: 30-90min}` 単一要素)
- `tastile-core/v1/13-completion.md:16-22` で `TimeRequirement` 構造が決定的に固定されている
- `tastile-core/v1/13-completion.md:54-93` で `TimeObservation` (scope / source / aggregate / quantifier) の数値定数表が固定されている
- `tastile-core/v1/HARNESS.md` の `TimeScope` / `TimeSource` / `TimeAggregate` / `TimeQuantifier` 数値定数 (集約表) を TS 側の定数モジュールの唯一の出典とする
- `quick-create-schedule-wire.ts:269-276` の `durationIsPreserved` 検査は `requirement.required.minMs / maxMs` を比較するため、`required` は `Range<ScalarValue>` 形を保つ必要がある

## 目的

`Plan.completion.timeRequirements[]` の **TS 型** を `tastile-core/v1/13-completion.md:16-22` の `TimeRequirement` 構造体に 1:1 で揃え、wire 経由で `PublishScheduleDefinitionPayload` に **欠落なく** 流す。E3a はエディタの UI 実装を持たず、**純 TS 型 + 単方向シリアライザ** のみを提供する。E3b 以降がこれを使って `ConditionTreeEditor` と同じく QuickCreate パネルに並べる。

## 受入条件

- `src/shared/api/v1/time-requirement.ts` の `TimeRequirement` 型が `v1/13:16-22` の 3 フィールド (`observation` / `required` / `preferred`) を含む
- `TimeObservation` 4 フィールド (`scope` / `source` / `aggregate` / `quantifier`) が `v1/13:54-58` と一致し、`quantifier` のみ `null` 許容
- `ScalarValue` は `numeric` のサブタイプ (ms 単位 duration 整数値) で `Range<ScalarValue>` / `Target<ScalarValue>` (`v1/13:18-19`) を型レベルで表現
- `serializeTimeRequirement(req: TimeRequirement)` が `PublishScheduleDefinitionPayload` 互換の JSON 形を返し、`null` 省略 / `preferred` 未設定時は `null` を維持
- `quick-create-schedule-wire.ts` が `serializeTimeRequirement` を使い、デフォルト `{required: 30-90min}` が payload `plan.completion.timeRequirements[0]` にそのまま到達することを unit test で pin
- `required: ScalarValue` の Range `min/max` を `null` 許容 (`v1/13:18` `Range<ScalarValue>` の上半開前提、未設定は `null`)
- `bun run typecheck` 通過 / `bun run test:unit` 既存件数 + 新規 4 件 Green

## 実装手順

1. `src/shared/api/v1/time-requirement.ts` を新設。構造は次の 3 段:
   - **数値定数モジュール** — `v1/13:60-93` の表 + `v1/HARNESS.md` の集約表を `as const` で 1 箇所に集約:
     ```ts
     export const TimeScope = {
       EXECUTION: 0, PLACEMENT: 1, FRAME: 2, CHILDREN: 3, REFERENCE: 4,
     } as const;
     export const TimeSource = {
       ACTIVE_SEGMENT: 0, PAUSED_SEGMENT: 1, EXECUTION: 2,
     } as const;
     export const TimeAggregate = {
       TOTAL_DURATION: 0, EACH_DURATION: 1, COUNT: 2,
       GAP_DURATION: 3, SPAN_DURATION: 4,
     } as const;
     export const TimeQuantifier = { ALL: 0, ANY: 1 } as const;
     ```
   - **型定義** — `v1/13:16-22` そのまま:
     ```ts
     export type ScalarValue = number; // ms 単位 duration (整数値)
     export interface Range<S> { minMs: S | null; maxMs: S | null; }
     export interface Target<S> { minMs: S | null; maxMs: S | null; }
     export interface TimeObservation {
       scope: TimeScopeKey;
       source: TimeSourceKey;
       aggregate: TimeAggregateKey;
       quantifier: TimeQuantifierKey | null; // v1/13:57, 88-94 で条件付き
     }
     export interface TimeRequirement {
       observation: TimeObservation;
       required: Range<ScalarValue>;
       preferred: Target<ScalarValue> | null; // v1/13:20
     }
     ```
   - **シリアライザ** — `serializeTimeRequirement(req: TimeRequirement): WireTimeRequirement`:
     - `required.minMs` / `required.maxMs` が両方 `null` のとき `null` 許容 (`v1/13:18` `Range<ScalarValue>` の Open-Range 想定だが wire 側は `null` 統一)
     - `preferred` 未設定 (`null`) なら wire でも `null` 維持
     - `quantifier` は `EACH_DURATION` / `GAP_DURATION` のときのみ `ALL` / `ANY` を要求 (`v1/13:88-94`)。それ以外は `null` を許容、wire では `null` 渡す
2. `quick-create-schedule-wire.ts:258-294` の `state.plan.completion.timeRequirements.map(...)` を `serializeTimeRequirement` 経由に置換。具体的には `toWireSetPlanBody` を呼ぶ直前に `completions.timeRequirements = state.plan.completion.timeRequirements.map(serializeTimeRequirement)` で書き換え
3. `src/shared/api/v1/time-requirement.test.ts` を新設 (4 件):
   - **default `{required: 30-90min}` round-trip** — 最小 requirement を `serializeTimeRequirement` に通し、wire 形が `{observation: {scope:EXECUTION, source:ACTIVE_SEGMENT, aggregate:TOTAL_DURATION, quantifier:null}, required: {minMs:1_800_000, maxMs:5_400_000}, preferred: null}` で戻る (`v1/13:96-101` の "合計4時間必要" 系の最小表現)
   - **EACH_DURATION + quantifier=ALL** — `v1/13:102-105` を表現する requirement をシリアライズし `quantifier=0` が wire で残る
   - **preferred=null 維持** — `preferred: null` 入力で wire `preferred: null` が出る (silently drop しない)
   - **Range open-ended** — `required.minMs=null, maxMs=5_400_000` (max のみ) をシリアライズし `null` が消えない
4. `quick-create-schedule-wire.ts` の unit test を加えて「`state.plan.completion.timeRequirements` の先頭要素が `required.minMs === state.time.durationMinMax.minMs` のとき `durationIsPreserved` 検査が pass する」を pin (line 258-262 のロジックを再 pin、E3a は wire shape のみ触り検査ロジックは無変更)

## 検証手順

```bash
# 1. 型チェック (既存 CI gate)
cd tastile-web
bunx tsc --noEmit

# 2. 新規 unit test
bun test src/shared/api/v1/time-requirement.test.ts

# 3. 既存 wire test の無回帰
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts

# 4. lint
bun run lint
```

期待:
- `tsc --noEmit` exit 0
- 新規 4 件 Green
- 既存 wire test 全件 Green (回帰なし)
- `bun run lint` 0 error

## リスク

- **`ScalarValue` の形**: `v1/13:18-19` は `Range<ScalarValue>` / `Target<ScalarValue>` と書いているが、`ScalarValue` 自体の定義は v1/13 末尾 (182 行以降) にある範囲外の可能性。E3a は ms 整数値に **暫定** で固定し、`v1/13` 末尾の `ScalarValue` 定義を Task 着手時に再確認。発見次第 `ScalarValue` を union (`number` | `string`) 等に拡張する可能性あり
- **`quantifier` の条件付き存在**: `v1/13:88-94` によれば `EACH_DURATION` / `GAP_DURATION` のときのみ必須、それ以外は `null`。型は `quantifier: TimeQuantifierKey | null` で表現し、validation は E3 全体 (UI 編) で実施。E3a は構造のみ
- **`Range.open` vs `Range.closed`**: `v1/13:18` の `Range<ScalarValue>` は `<T, T>` (両端含む) なのか `<T, T)` (右半開) なのか不明。`null` 許容として表現し、validator は E3 以降。本 E3a の wire shape は `minMs` / `maxMs` を `number | null` で持ち左右両端の解釈は consumer に委ねる
- **wire diff**: `quick-create-schedule-wire.ts:258-294` を `serializeTimeRequirement` 経由に置換する際、`state.source.preferredDurationMinMax` の merge (line 285-290) が消えないことを確認。E3a は merge ロジックを **保持** し、merge 後の `requirement` を `serializeTimeRequirement` に渡す

## 関連

- Source spec: `tastile-core/v1/13-completion.md` (16-93 行)
- Sub-project parent: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §4
- 数値定数集約: `tastile-core/v1/HARNESS.md` (TimeScope / TimeSource / TimeAggregate / TimeQuantifier)
- 現在の wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:258-294, 269-276`
- 関連 Store: `state.plan.completion.timeRequirements` (QuickCreateStore)
- 兄弟 plan: E2 (Condition AST editor), E3b (TimeRequirement editor UI — 本 E3a の上に構築)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
