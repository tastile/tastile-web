# E4c — DecisionDef TS 型 + 候補評価器シリアライザ

## メタデータ

- **ID**: E4c
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: E2a (Condition AST editor が wire 経由で `plan.completion.root` に到達していること)、A (wire 経由の `PublishScheduleDefinitionPayload` に `Plan.decisions[]` が既に到達していること)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §5 + `tastile-core/v1/06-decision-and-feedback.md:27-104`

## 前提

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts` が `state.plan.decisions` を `toWireSetPlanBody` の `published` 経由で `Plan.decisions[]` に渡せる形 (現状はデフォルト空配列 / 数値定数のみ)
- `tastile-core/v1/06-decision-and-feedback.md:32-104` で `Decision` 構造 (`id` / `observe` / `candidates[]` / `reuse[]` / `dialog`) が決定的に固定されている
- `v1/06:42-50` で `DecisionObserve.scope` の数値定数表 (PLAN=0 / FRAME=1 / PLACEMENT=2 / EXECUTION=3) が固定されている
- `v1/06:55-66` で `DecisionCandidate` (`id` / `when:Condition` / `rank:Int32` / `effects[]`) が固定されている
- `v1/06:67-87` で `CandidateEffect` (`kind` 0=PROPOSE_PLACEMENT / 1=PROPOSE_CHANGE / 2=REQUEST) + 3 payload 候補 (`proposal` / `change` / `request`) が固定されている
- `v1/06:91-104` で自動解決 7 段 (有効 Candidate 収集 → 制約違反除外 → 両立可能組合せ → rank/PlacementRule/ChangeSet 評価 → 過去 Feedback 反映 → 解 1 つに決まれば自動適用 → 複数解は Session へ) が定義されている
- `v1/HARNESS.md` の数値定数表を TS 側の定数モジュールの唯一の出典とする
- `Condition` AST は E2a で確立された構造を `DecisionCandidate.when` で **再利用する** (新規 AST 定義禁止)。`v1/05` を踏襲
- `Plan.decisions[]` への wire 経路は `Plan.completion` と同じ `toWireSetPlanBody` 経由 (`quick-create-schedule-wire.ts`)

## 目的

`Plan.decisions[]` の **TS 型** を `tastile-core/v1/06-decision-and-feedback.md:27-104` の `Decision` 構造体に 1:1 で揃え、wire 経由で `PublishScheduleDefinitionPayload` に **欠落なく** 流す。E4c はエディタの UI 実装を持たず、**純 TS 型 + 単方向シリアライザ + 候補評価器** のみを提供する。E4d 以降がこれを使って `ConditionTreeEditor` と同じく QuickCreate パネルに並べる。

「候補評価器」 = wire shape 確定後にコア側の自動解決 7 段 (`v1/06:91-104`) と 1:1 で対応する **フロント pure 関数**。`candidates` / `constraints` / `placement_rule` / `change_set` を受け取り `ResolutionResult` を返す。Phase D (コア側) が実装されるまでの bridge として、UI 側で「自動適用 vs Session 行き」を preview する用途に供する。

## 受入条件

- `src/shared/api/v1/decision.ts` の `DecisionDef` 型が `v1/06:32-38` の 5 フィールド (`id` / `observe` / `candidates[]` / `reuse[]` / `dialog`) を含む
- `DecisionObserve.scope` が `v1/06:42-50` と一致 (PLAN=0 / FRAME=1 / PLACEMENT=2 / EXECUTION=3)
- `DecisionCandidate` が `v1/06:60-63` の 4 フィールド (`id` / `when` / `rank` / `effects[]`) を含み、`when` は **E2a の Condition 型を import** して共有
- `CandidateEffect` が `v1/06:71-77` の 4 フィールド (`kind` / `proposal` / `change` / `request`) を含み、`kind` は `v1/06:79-86` の 3 値 (PROPOSE_PLACEMENT=0 / PROPOSE_CHANGE=1 / REQUEST=2)
- `kind=REQUEST` の `request.idempotencyKey` を **必須** 化 (v1/06:87 冪等キー必須 contract)
- `serializeDecision(def: DecisionDef): WireDecision` が `PublishScheduleDefinitionPayload` 互換の JSON 形を返し、`null` payload (`proposal=null` / `change=null` / `request=null`) は wire でも `null` 維持
- `evaluateCandidates(def, ctx): ResolutionResult` が `v1/06:91-104` の 7 段を pure 関数で実装し `AutoResolved` / `SessionPending` の 2 値を返す。`when` は E2a Condition 評価器を流用
- `quick-create-schedule-wire.ts` が `serializeDecision` を使い、unit test 1 件 (decision × 2 candidate × 1 criterion round-trip) が pin される
- `bun run typecheck` 通過 / `bun run test:unit` 既存件数 + 新規 5 件 Green

## 実装手順

1. `src/shared/api/v1/decision.ts` を新設。構造は次の 4 段:
   - **数値定数モジュール** — `v1/06:42-86` + `v1/HARNESS.md` を集約:
     ```ts
     export const DecisionObserveScope = {
       PLAN: 0, FRAME: 1, PLACEMENT: 2, EXECUTION: 3,
     } as const;
     export const CandidateEffectKind = {
       PROPOSE_PLACEMENT: 0, PROPOSE_CHANGE: 1, REQUEST: 2,
     } as const;
     ```
   - **型定義** — `v1/06:32-77` そのまま:
     ```ts
     import type { Condition } from './condition'; // E2a
     import type { PlacementProposalDraft, ChangeRule, RequestDraft } from './change-set'; // E4 系列で再 export

     export interface DecisionObserve {
       scope: DecisionObserveScopeKey;
       close: Condition | null; // v1/06:51
     }
     export interface PlacementProposalDraft { /* v1/02 §SourceTile 参照 */ }
     export interface ChangeRule { /* v1/04 参照 */ }
     export interface RequestDraft {
       kind: CandidateEffectKindKey;
       idempotencyKey: string; // v1/06:87 必須
       payload: unknown; // wire で厳密化
     }
     export interface CandidateEffect {
       kind: CandidateEffectKindKey;
       proposal: PlacementProposalDraft | null;
       change: ChangeRule | null;
       request: RequestDraft | null;
     }
     export interface DecisionCandidate {
       id: string; // UUIDv7
       when: Condition;
       rank: number; // Int32
       effects: CandidateEffect[];
     }
     export interface FeedbackReuseRule {
       id: string; // UUIDv7
       when: Condition;
       source: unknown; // FeedbackSelector は v1/06:113 参照 (E4c では unknown で素通り)
       apply: unknown[]; // FeedbackMapping[] も同
     }
     export interface InteractionTree { /* v1/06:155-160 構造は E4d に持ち越し。E4c は型 alias のみ */ }
     export interface DecisionDef {
       id: string;
       observe: DecisionObserve;
       candidates: DecisionCandidate[];
       reuse: FeedbackReuseRule[];
       dialog: InteractionTree | null;
     }
     ```
   - **シリアライザ** — `serializeDecision(def: DecisionDef): WireDecision`:
     - `id` を UUIDv7 として保持
     - `candidates[].when` を E2a の `serializeCondition` 経由で wire 形に変換
     - `candidates[].effects[].kind` が REQUEST のとき `request.idempotencyKey` が空文字なら例外送出 (`v1/06:87` 冪等キー必須 contract を破る path を塞ぐ)
     - `proposal` / `change` / `request` の 3 payload は `kind` に対応する 1 つのみ non-null (wire shape 維持)
   - **候補評価器** — `evaluateCandidates(def: DecisionDef, ctx: EvaluationContext): ResolutionResult`:
     ```ts
     export type ResolutionResult =
       | { kind: 'AutoResolved'; candidateId: string; effects: CandidateEffect[] }
       | { kind: 'SessionPending'; candidates: DecisionCandidate[] };
     ```
     - 段 1: `candidates.filter(c => evaluateCondition(c.when, ctx))` — 有効 Candidate 収集
     - 段 2: `candidates.filter(c => !isViolated(c, ctx))` — 制約違反・失効済み除外
     - 段 3: 両立可能組合せ — 単一 candidate で stop (E4c は 1 候補評価のみ。multi-candidate combinatorial は E4d スコープ)
     - 段 4: `rank` 昇順でソート → 先頭を採番
     - 段 5: `def.reuse` のうち `when` が真のものを effect に merge (Phase D まで素通し、E4c はフック点のみ)
     - 段 6: 採番候補が 1 つだけ → `{ kind: 'AutoResolved', candidateId: c.id, effects: c.effects }`
     - 段 7: 複数候補が残る → `{ kind: 'SessionPending', candidates }`
     - `EvaluationContext` は E2a の Condition 評価器が受け取る型と同一

2. `quick-create-schedule-wire.ts` の `toWireSetPlanBody` 直前に `plan.decisions = state.plan.decisions.map(serializeDecision)` を追加。具体的には E3a で行った `timeRequirements` 置換と対称な位置
3. `src/shared/api/v1/decision.test.ts` を新設 (5 件):
   - **DecisionDef round-trip** — `id=uuidv7` / `observe.scope=PLAN` / `candidates.length=2` / `candidates[0].when=ALL([timeReq, taskRef])` / `candidates[0].effects[0].kind=PROPOSE_PLACEMENT` を `serializeDecision` に通し、wire 形が同形で戻る
   - **REQUEST requires idempotencyKey** — `kind=REQUEST` で `idempotencyKey=''` を渡すと例外 (`Error('REQUEST requires idempotencyKey')`)
   - **AutoResolved path** — `evaluateCandidates(def, ctx)` で 1 候補だけが `when` を満たす → `{ kind: 'AutoResolved', candidateId: candidates[0].id, ... }`
   - **SessionPending path** — 2 候補が両方 `when` を満たす → `{ kind: 'SessionPending', candidates: [c0, c1] }` (rank 昇順)
   - **null payload preserved** — `kind=PROPOSE_PLACEMENT` で `proposal=null` / `change=null` / `request=null` を維持
4. `quick-create-schedule-wire.ts` の unit test を 1 件追加して「`state.plan.decisions` の先頭要素が wire shape に到達する」を pin (E3a の `durationIsPreserved` と対称)

## 検証手順

```bash
# 1. 型チェック (既存 CI gate)
cd tastile-web
bunx tsc --noEmit

# 2. 新規 unit test
bun test src/shared/api/v1/decision.test.ts

# 3. 既存 wire test の無回帰
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts

# 4. Condition (E2a) test の無回帰
bun test src/shared/api/v1/condition.test.ts

# 5. TimeRequirement (E3a) test の無回帰
bun test src/shared/api/v1/time-requirement.test.ts

# 6. lint
bun run lint
```

期待:
- `tsc --noEmit` exit 0
- 新規 5 件 Green
- 既存 wire / condition / time-requirement test 全件 Green (回帰なし)
- `bun run lint` 0 error

## リスク

- **Decision tree depth**: `v1/06:32-38` の `dialog: InteractionTree` はツリー構造 (`v1/06:155-160` の `InteractionNode.children: InteractionNode[]`)。E4c は `InteractionTree` を `type alias` のみで持ち、深いツリーは E4d に持ち越す。E4c の acceptance は "1 decision + 2 candidates + 1 criterion" で固定し、深いダイアログは E4d で別 commit
- **`when: Condition` の循環 import**: E2a (Condition AST) と E4c (Decision) は相互依存しないよう、`decision.ts` が `condition.ts` を **import** する一方向のみ許可。E2a は `decision.ts` を import しない (Condition は Decision より下の層)
- **UUIDv7 生成**: 候補 ID は UUIDv7 必須 (`v1/10` §1)。`crypto.randomUUID()` は v4 を返すので不可。`uuidv7` package を install するか、E4c の generator helper を別モジュールに置く。本 E4c は **TS 型のみ** スコープなので ID 生成は呼び元責務。テストでは固定 UUID 文字列を使う
- **`FeedbackReuseRule` / `InteractionTree` の `unknown` 残置**: `v1/06:107-180` の詳細形は Phase D (DecisionRun / Session) まで未確定。E4c は `unknown` 型で素通しし、wire では JSON として往復できる形のみ保証。E4d 以降で具象型に narrowing
- **候補評価器の「両立可能組合せ」段**: 段 3 は combinatorial search。E4c は 1 candidate 採番で打ち切るが、E4d で `PlacementRule` / `ChangeSet` の競合検知 (`v1/04` 層 / rank) を組む必要あり。E4c は Acceptance を 1 decision + 2 candidate に限定して combinatorial cost を隠す
- **REQUEST の冪等キー contract**: `v1/06:87` 必須 contract を TS 型レベルで enforce するため `RequestDraft.idempotencyKey: string` を non-optional 化。既存 wire に REQUEST 経路が無いため後方互換リスクなし

## 関連

- Source spec: `tastile-core/v1/06-decision-and-feedback.md` (27-104 行)
- Sub-project parent: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §5
- 数値定数集約: `tastile-core/v1/HARNESS.md` (DecisionObserveScope / CandidateEffectKind)
- 共有 Condition AST: `tile-create-e2e-wiring/04-plans/E2a-condition-tree-spec.md` (E2a)
- 共有 TimeRequirement: `tile-create-e2e-wiring/04-plans/E3a-time-requirement-spec.md` (E3a)
- 現在の wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:258-294`
- 関連 Store: `state.plan.decisions` (QuickCreateStore)
- 兄弟 plan: E2a (Condition AST editor)、E3a (TimeRequirement TS 型)、E4d (Decision editor UI — 本 E4c の上に構築)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
