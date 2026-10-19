# E4b — Metric + Decision AST ser/de round-trip property tests

## メタデータ

- **ID**: E4b
- **Phase**: 3
- **Target repo**: `tastile-web` (TS unit test) + `tastile-core` (Rust reference)
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: E3a (TimeRequirement TS 型 + シリアライザ — wire shape pin 済) / E4c (DecisionDef TS 型 + 候補評価器シリアライザ — wire shape pin 済) / E4a (Condition AST ser/de round-trip — fast-check harness 構築済)
- **Sibling plans**: E5* (Condition / TimeRequirement / TaskDefinition / Metric / Decision パネル e2e specs)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §5 + `tastile-core/v1/05-condition-and-reference.md:194-230` + `tastile-core/v1/06-decision-and-feedback.md:27-104`

## 前提

- E3a の `src/shared/api/v1/time-requirement.ts` が `WireTimeRequirement` を返し、`bun test src/shared/api/v1/time-requirement.test.ts` 4 件 Green
- E4c の `src/shared/api/v1/decision.ts` が `DecisionDef` 型 + `serializeDecision(def): WireDecision` + `evaluateCandidates(def, ctx): ResolutionResult` を export し、`bun test src/shared/api/v1/decision.test.ts` 5 件 Green
- E4a の `src/shared/api/v1/condition.test.ts` が `fast-check` で Condition AST の ser/de round-trip 50 件 Green。`fast-check` を依存に追加済
- `tastile-core/v1/05-condition-and-reference.md:194-230` で `Metric { id, output: 0..2, expression: ScalarExpression, limit: Range<ScalarValue>|null }` の 4 フィールドが固定済
- `v1/05:236-254` で `ScalarExpression` が LITERAL / READ / AGGREGATE / OPERATE / CHOOSE の 5 kind に確定済
- `tastile-core/v1/06-decision-and-feedback.md:32-77` で `Decision { id, observe, candidates[], reuse[], dialog }` + `DecisionCandidate { id, when: Condition, rank, effects[] }` + `CandidateEffect { kind: 0..2, proposal|null, change|null, request|null }` が固定済
- `v1/06:42-50` / `v1/06:79-86` の数値定数表 (`DecisionObserveScope`, `CandidateEffectKind`) は E4c で TS モジュール集約済
- `tastile-core/v1/HARNESS.md` の数値定数集約表を唯一の出典とする
- 共有 Condition AST は E2a で確立された構造を `DecisionCandidate.when` で **再利用する** (E4c 経由、import 一方向のみ)

## 目的

`Plan.metrics[]` と `Plan.decisions[]` の **TS AST ↔ wire JSON** ser/de round-trip を property-based test (`fast-check`) で固め、TS 側の `Metric` / `DecisionDef` 型 + シリアライザ + 数値定数モジュールが **`tastile-core` の正規化スキーマと drift しない** ことを 50 random Metrics + 50 random Decisions × N=100 で保証する。E4a の Condition AST ser/de test と対称。

Metric と Decision は E3a / E4c で個別 unit test が pin されたが、組み合わせ爆発 (output × expression.kind × limit 開閉 × candidates × effects × reuse × interaction tree) をカバーするには手書きケースでは足りない。`fast-check` の arbitrary ツリーで全フィールドを再帰的にランダム生成し、`serialize → JSON.parse → deepEqual` の round-trip contract を pin することで、フィールド追加 / 数値定数 remap / `null` sentinel 違反を CI で即時検出する。

## 受入条件

- `src/shared/api/v1/metric.test.ts` に **50 random Metrics** を生成し、`serializeMetric → JSON.parse(JSON.stringify(serializeMetric(m)))` の deep-equal を assert する property test が Green (`numRuns=50`)
- `src/shared/api/v1/decision.test.ts` (E4c の 5 件とは別ファイル。新規 `metric.test.ts` とは別名) に **50 random Decisions** を生成し、`serializeDecision → JSON.parse(JSON.stringify(serializeDecision(d)))` の deep-equal を assert する property test が Green
- Metric 側でカバーされる組合せ (各 50 random で最低 1 回は出現することを 1 sample で pin する補助 test):
  - `output` = 0 (DURATION) / 1 (COUNT) / 2 (DECIMAL) の 3 値すべて
  - `expression.kind` = 0 (LITERAL) / 1 (READ) / 2 (AGGREGATE) / 3 (OPERATE) / 4 (CHOOSE) の 5 値すべて
  - `limit = null` (上限なし) と `limit = {minMs, maxMs}` の両形 (Range 開閉)
  - `limit.minMs = null` / `limit.maxMs = null` の片側 null / 両側 null の 3 形
- Decision 側でカバーされる組合せ:
  - `observe.scope` = 0..3 の 4 値すべて
  - `candidates` 0..N 件 (空配列含む)
  - `candidates[].effects[].kind` = 0 (PROPOSE_PLACEMENT) / 1 (PROPOSE_CHANGE) / 2 (REQUEST) の 3 値すべて + `idempotencyKey` 必須 contract (REQUEST のとき空文字は例外)
  - `reuse[]` 0..M 件
  - `dialog = null` と `dialog = InteractionTree` の両形 (E4c は型 alias のみ。`unknown` で素通し)
- Decision tree **cycle rejection** — `candidates[].when` は Condition AST (E2a の `Condition`) であり、DAG 構造ではないが、`dialog: InteractionTree` は `InteractionNode.children: InteractionNode[]` の再帰構造で cycle を持つ random 生成を許すと `JSON.stringify` で `RangeError: Converting circular structure to JSON` を起こす。`fast-check` の arbitrary で **有限 depth + 末端で停止** する generation を強制し、cycle を発生させない
- Metric expression が **未定義 Symbol を参照しない** — `READ` / `AGGREGATE` / `OPERATE` の各 kind は `Symbol { kind: Reference|Frame|Placement|... }` を持つが、`arbitrary_metric` は固定 enum / 固定 ID (UUIDv7 形式 `xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx`) のみを生成し、wire shape で「unknown symbol」エラーを出さない
- `e2e/e4b-metric-decision-roundtrip.spec.ts` (Playwright) を新設 — QuickCreate パネルで `休憩` tile の `metrics[]` に 1 件 + `decisions[]` に 1 件追加し、`/v1/timeline` 経由で永続化された payload の `plan.metrics[0]` / `plan.decisions[0]` が **UI 入力と wire shape で一致** することを pin
- `bun run typecheck` 通過 / `bun run test:unit` 既存件数 + 新規 2 件 (50 + 50 = 100 random round-trip + 補助 sample) Green / `bun run lint` 0 error
- 新規 dependency: `fast-check@^3.x` を `tastile-web/package.json` に追加 (E4a で先行追加済)

## 実装手順

1. **Metric 側**: `src/shared/api/v1/metric.ts` を新設 (E4c の `decision.ts` と同形 3 段構造)
   - **数値定数モジュール** — `v1/05:203-209` の表 + `v1/HARNESS.md` 集約表から:
     ```ts
     export const MetricOutput = { DURATION: 0, COUNT: 1, DECIMAL: 2 } as const;
     export const ScalarExpressionKind = {
       LITERAL: 0, READ: 1, AGGREGATE: 2, OPERATE: 3, CHOOSE: 4,
     } as const;
     ```
   - **型定義** — `v1/05:196-200` そのまま:
     ```ts
     export type ScalarValue = number;
     export interface Range<S> { minMs: S | null; maxMs: S | null; }
     export interface LiteralScalar { kind: 0; valueMs: ScalarValue; }
     export interface ReadScalar { kind: 1; source: 'frame'|'placement'|'execution'|'fact'|'metric'; refId: string; }
     export interface AggregateScalar { kind: 2; quantifier: 'sum'|'avg'|'min'|'max'|'count'; overRange: Range<ScalarValue> | null; }
     export interface OperateScalar { kind: 3; op: 'add'|'sub'|'mul'|'div'; operands: ScalarExpression[]; }
     export interface ChooseScalar { kind: 4; branches: { when: Condition; then: ScalarExpression }[]; default: ScalarExpression | null; }
     export type ScalarExpression = LiteralScalar | ReadScalar | AggregateScalar | OperateScalar | ChooseScalar;
     export interface Metric {
       id: string; // UUIDv7
       output: MetricOutputKey;
       expression: ScalarExpression;
       limit: Range<ScalarValue> | null;
     }
     ```
   - **シリアライザ** — `serializeMetric(m: Metric): WireMetric`:
     - `id` を UUIDv7 文字列として保持
     - `expression` を再帰的に walk し、各 kind の payload を wire shape に写す (E2a の `serializeCondition` を `ChooseScalar.branches[].when` で再利用)
     - `limit = null` なら wire でも `null` 維持 (silent drop 禁止)
     - `limit.minMs = null` / `limit.maxMs = null` の片側 / 両側 null を維持
2. **Decision 側の fast-check harness** — `src/shared/api/v1/decision.test.ts` を **E4c の 5 件テストとは別ファイル** に追加 (E4c のファイルは新規 decision AST + evaluator の pin、本 E4b は property-based test)。同名でファイル名衝突するため `e4b-decision-roundtrip.test.ts` として分離するか、E4c の `decision.test.ts` に追記するかは実装時に判断 (本 plan では E4c ファイルに追記せず、E4b 専用 `decision-roundtrip.test.ts` を新設)
3. **`fast-check` arbitrary の構築**:
   - `arbitrary_scalar_value()` — `fc.integer({ min: 0, max: 1_000_000_000 })` (ms 単位 duration 整数値)
   - `arbitrary_range<T>()` — `fc.record({ minMs: fc.option(arbitrary_scalar_value()), maxMs: fc.option(arbitrary_scalar_value()) })` (両側 / 片側 / 全 null の 4 形を生成)
   - `arbitrary_metric()` — `fc.record({ id: arbitrary_uuidv7(), output: fc.constantFrom(0, 1, 2), expression: arbitrary_scalar_expression({ maxDepth: 3 }), limit: fc.option(arbitrary_range()) })`
   - `arbitrary_scalar_expression({ maxDepth })` — 再帰 arbitrary。`maxDepth === 0` なら `LiteralScalar` のみ。`maxDepth > 0` なら `fc.oneof(Literal, Read, Aggregate, Operate(depth-1), Choose(branches with depth-1))`。`Operate.operands` は `fc.array(arbitrary(depth-1), { maxLength: 3 })` で長さ制限
   - `arbitrary_decision({ maxDepth })` — `fc.record({ id: arbitrary_uuidv7(), observe: arbitrary_decision_observe(), candidates: fc.array(arbitrary_decision_candidate({ maxDepth }), { maxLength: 5 }), reuse: fc.array(arbitrary_feedback_reuse_rule(), { maxLength: 3 }), dialog: fc.option(arbitrary_interaction_tree({ maxDepth: 2 })) })`
   - `arbitrary_interaction_tree({ maxDepth })` — `maxDepth === 0` なら leaf node のみ。`maxDepth > 0` なら `fc.record({ id: arbitrary_uuidv7(), visible: arbitrary_condition({ maxDepth: 1 }), view: arbitrary_string(), inputs: fc.array(...), children: fc.array(arbitrary_interaction_tree({ maxDepth: maxDepth - 1 }), { maxLength: 3 }) })`。**cycle 防止のため再帰 depth で必ず停止**
   - `arbitrary_uuidv7()` — `fc.uuid({ version: 7 })` (E4a で先行定義済)
4. **round-trip property**:
   ```ts
   import fc from 'fast-check';
   import { serializeMetric } from './metric';
   import { serializeDecision } from './decision';

   fc.assert(
     fc.property(arbitrary_metric(), (m) => {
       const wire = serializeMetric(m);
       const wireJson = JSON.stringify(wire);
       const back = JSON.parse(wireJson) as WireMetric;
       expect(back).toEqual(wire);
     }),
     { numRuns: 50 },
   );

   fc.assert(
     fc.property(arbitrary_decision({ maxDepth: 3 }), (d) => {
       const wire = serializeDecision(d);
       const wireJson = JSON.stringify(wire);
       const back = JSON.parse(wireJson) as WireDecision;
       expect(back).toEqual(wire);
     }),
     { numRuns: 50 },
   );
   ```
5. **補助 sample test** (各 output / expression.kind / scope / effect.kind を最低 1 回出現させることを pin):
   - `metric.test.ts` の `covers_all_output_kinds`: `output=0/1/2` 各 1 件の最小 Metric を生成し round-trip
   - `metric.test.ts` の `covers_all_expression_kinds`: `expression.kind=0..4` 各 1 件の最小 Metric を生成し round-trip
   - `metric.test.ts` の `range_open_ended`: `limit.minMs=null, maxMs=5_400_000` (max のみ) / `limit.minMs=1_800_000, maxMs=null` (min のみ) / `limit=null` (無制限) をそれぞれ round-trip
   - `decision-roundtrip.test.ts` の `covers_all_observe_scopes`: `scope=0..3` 各 1 件の最小 Decision を生成し round-trip
   - `decision-roundtrip.test.ts` の `request_requires_idempotency_key`: E4c で pin 済の contract を E4b でも再 pin (`kind=REQUEST` で `idempotencyKey=''` のランダム生成で例外)
   - `decision-roundtrip.test.ts` の `cycle_free_dialog`: `maxDepth=3` の arbitrary で 100 件生成 → 全て JSON.stringify 成功 (cycle 0 件)
6. **e2e spec** — `e2e/e4b-metric-decision-roundtrip.spec.ts` 新設:
   - G1a/G4a の wslc PostgreSQL + API daemon + QuickCreate パネルの経路を踏襲
   - Phase G (wslc stack-up) で起動した daemon 上で、`休憩` tile に `metrics[0]` (output=DURATION, expression=LiteralScalar(30min)) + `decisions[0]` (observe.scope=PLAN, candidates=1 件, effects=[PROPOSE_PLACEMENT]) を QuickCreate パネルから追加
   - Submit → `/v1/timeline` 経由で payload 取得 → `plan.metrics[0]` / `plan.decisions[0]` が UI 入力と wire shape で一致することを assert
   - G4a の wslc TRUNCATE helper で state reset

## 検証手順

```bash
# 1. 型チェック (既存 CI gate)
cd tastile-web
bunx tsc --noEmit

# 2. Metric ser/de round-trip
bun test src/shared/api/v1/metric.test.ts
# 期待: 50 random round-trip + 補助 3 件 (covers_all_output_kinds / covers_all_expression_kinds / range_open_ended) 全件 Green

# 3. Decision ser/de round-trip
bun test src/shared/api/v1/decision-roundtrip.test.ts
# 期待: 50 random round-trip + 補助 3 件 (covers_all_observe_scopes / request_requires_idempotency_key / cycle_free_dialog) 全件 Green

# 4. 既存 wire / E3a / E4c / E4a test の無回帰
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
bun test src/shared/api/v1/time-requirement.test.ts
bun test src/shared/api/v1/decision.test.ts
bun test src/shared/api/v1/condition.test.ts

# 5. lint
bun run lint

# 6. e2e (wslc stack + Playwright)
bash scripts/wslc/up-v1.sh   # G 起動
cd tastile-web
bunx playwright test e2e/e4b-metric-decision-roundtrip.spec.ts
bash scripts/wslc/down.sh    # G 停止
```

期待:
- `tsc --noEmit` exit 0
- 新規 property test 100 件 (50 + 50) + 補助 6 件 Green
- 既存 wire / time-requirement / decision / condition test 全件 Green (回帰なし)
- `bun run lint` 0 error
- Playwright e2e: 1 件 Green (panel → /v1/timeline → payload 一致)

## リスク

- **`fast-check` arbitrary の depth 制御ミス**: `OperateScalar.operands` や `ChooseScalar.branches` を再帰的に生成するとき、`maxDepth` を decrement せずに呼ぶと stack overflow + `JSON.stringify` で cycle 検出。`{ maxDepth: 3 }` のような明示的上限 + 末端でのみ `LiteralScalar` を返す contract で塞ぐ。テストでは `cycle_free_dialog` を 100 件反復して `JSON.stringify` が常に成功することを pin
- **`ScalarExpression` の再帰 JSON cycle**: `Operate.operands[i]` が自分自身の親 (e.g. `Operate(Operate(Operate(...)))`) を **値として** 含めると cycle になる。`operands` は `ScalarExpression[]` で値は ID ではなく実体なので、`fast-check` の `fc.array` がそのまま展開する場合に tree depth が暴走する。`maxLength: 3` + `maxDepth` の二重 cap で defense in depth
- **`idempotencyKey` 空文字 contract**: `fast-check` の `fc.string()` が空文字を生成するため、`REQUEST` effect の生成時に空文字が出ると `serializeDecision` 側で例外が飛ぶ → property test が **失敗** する。これは contract を破る invalid input を正しく reject している結果なので、`fc.pre(idempotencyKey !== '')` で pre-condition として filter するか、`serializeDecision` の例外を property test 内で catch して「REQUEST + 空 key は reject」が 100% 成立することを pin する別の property に切替える。E4c では例外 path を pin しているので、E4b でも同形 contract を維持する
- **wire shape drift detection の遅延**: `fast-check` の 50 random は combinatorial 全探索ではない (e.g. `output=2` × `expression.kind=4` × `limit=null` の組合せを 50 件内で最低 1 回ずつカバーする保証はない)。補助 sample test を **別途** 設けて全 kind × 全 scope × 開閉 range の網羅性を pin する。property test 側は「drift 検出」、sample test 側は「網羅性保証」と役割分担
- **`uuidv7` 生成**: `fast-check` の `fc.uuid({ version: 7 })` は本物の UUIDv7 を生成するが、`crypto.randomUUID()` は v4 を返すので互換性注意。`fc.uuid` を使い、ハンド生成の fixture は使わない。E4a の `arbitrary_uuidv7` を import して再利用
- **`ScalarExpression.kind=READ` の `source` 列挙**: `'frame'|'placement'|'execution'|'fact'|'metric'` の 5 値は `v1/05` には **文字列として書かれていない** (v1/05 は数値定数のみ)。`v1/05` 仕様書を再読して正本の constant set を確認。E4b は wire shape を `source: 'frame'|...` の文字列 union で表現せず、`sourceKind: 0..4` の **数値定数** で持つ形に書き換え (v1/10 §2: 文字列禁止)。`MetricSeriesTargetKind` (0=PLAN, 1=REFERENCE) が `v1/05:220` にあるので、これを流用するか別レジストリを切るかは spec 再読時に確定
- **`AggregateScalar.overRange` が `null`**: `v1/05` の `AGGREGATE` 仕様では window は必須 vs optional 未確定。`v1/05:212-228` の `MetricSeriesWindowKind` を参照。`null` 許容なら wire でも `null` 維持、必須なら sample test で **必ず** range を付ける contract に
- **e2e の `休憩` tile 起動**: G 起動直後の QuickCreate パネルで `休憩` tile を選択できるか、Phase V1_015 の default break seed が動いているかに依存。G 起動 → `/v1/timeline` で `休憩` tile が 1 件見えることを pre-condition として確認

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §5 + `tastile-core/v1/05-condition-and-reference.md` (194-230 行, Metric + ScalarExpression) + `tastile-core/v1/06-decision-and-feedback.md` (27-104 行, Decision / DecisionCandidate / CandidateEffect)
- 数値定数集約: `tastile-core/v1/HARNESS.md` (MetricOutput / ScalarExpressionKind / DecisionObserveScope / CandidateEffectKind)
- 共有 Condition AST: `tile-create-e2e-wiring/04-plans/E2a-condition-tree-spec.md` (E2a — `ChooseScalar.branches[].when` で再利用)
- 共有 TimeRequirement: `tile-create-e2e-wiring/04-plans/E3a-time-requirement-spec.md` (E3a)
- Decision TS 型 + 候補評価器: `tile-create-e2e-wiring/04-plans/E4c-decision-tree-spec.md` (E4c — 本 E4b は E4c の `serializeDecision` の上層 property test)
- Condition AST ser/de round-trip: `tile-create-e2e-wiring/04-plans/E4a-condition-ast-serde-roundtrip.md` (E4a — `fast-check` harness の先行定義)
- 現在の wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:258-294`
- 関連 Store: `state.plan.metrics` / `state.plan.decisions` (QuickCreateStore)
- 兄弟 plan: E5a (Condition basic e2e), E5* (TimeReq / TaskDef / Metric / Decision パネル e2e)
- wslc harness: `tile-create-e2e-wiring/04-plans/G1a-wslc-image-build.md` (G1a)
- e2e helper: `tile-create-e2e-wiring/04-plans/G4a-worker-container-up.md` / `G4b-e2e-helper-truncate-list.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
