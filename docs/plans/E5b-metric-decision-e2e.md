# E5b — Metric + Decision e2e spec

## メタデータ

- **ID**: E5b
- **Phase**: 3
- **Target repo**: `tastile-web` (e2e spec) + `tastile-core` (read API 検証)
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: E4a (Metric editor), E4b (Metric wire builder), E4c (Decision editor)
- **Source spec**: `04-sub-projects/E-condition-tree.md` §6 e2e 検証
- **Sibling plans**: E5a (TimeRequirement + TaskDefinition 編。欠番), E3a (TimeRequirement TS 型), E3d (TaskDefinitionEditor), E2 (Condition AST editor), A2a (plan.completion), A2b (planning.references)

## 前提

- `tastile-core` 側で `Plan.metrics[]` / `Plan.decisions[]` フィールドが `v1_plan` JSON カラム、または `v1_plan_metrics` / `v1_plan_decisions` 子テーブルに永続化されている (E4a-E4c で実装済)
- `tastile-web/src/features/create-tile/ui/MetricEditor.tsx` (E4a) と `DecisionEditor.tsx` (E4c) が QuickCreate パネルに統合されている
- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts` が `state.plan.metrics` / `state.plan.decisions` を `PublishScheduleDefinitionPayload` 経由で `POST /v1/schedule-definitions` に流す (E4b)
- `tastile-web/e2e/helpers/v1.ts` の `truncateV1()` が `v1_plan_metrics` / `v1_plan_decisions` を含む全 v1_* テーブルを TRUNCATE する (G4b/G5b 経由)
- `tastile-core` 側 `tastile-core/v1/05-condition-and-reference.md:191-201` の `Metric` 構造 (output DURATION|COUNT|DECIMAL, expression ScalarExpression, limit Range<ScalarValue>|null) と `tastile-core/v1/06-decision-and-feedback.md:31-40` の `Decision` 構造 (observe, candidates[], reuse[], dialog) が固定されている
- `output=READ` の数値定数は `ScalarExpression::READ = 1` (`tastile-core/v1/05:248-255` の表)
- wslc stack (`tastile-db` / `tastile-api` / `tastile-worker`) が `tastile-net` 上で稼働し、`http://127.0.0.1:31400/v1/health` が 200 を返す (G 完了)

## 目的

QuickCreate パネルから 1 件の Metric (output=READ のみ) と 1 件の Decision (2 候補 × 1 クライテリア) を入力して submit し、その結果が `v1_plan` の `metrics[]` / `decisions[]` に欠落なく永続化され、`GET /v1/schedule-definitions/{id}` (または `GET /v1/timeline` のレスポンス内 plan オブジェクト) で **両配列とも非空** として読み戻せることを e2e で証明する。E4a-E4c の wire 拡張が silent drop / silently-overwritten を起こしていないことを、実機 Playwright + psql 観測で pin する。

## 受入条件

- `tastile-web/e2e/metric-decision.spec.ts` が wslc stack + Playwright 経由で **exit 0** で完走
- submit 直後の `v1_plan.metrics` (または子テーブル) に **1 行以上** 存在し、`output` フィールドが `1` (READ) と一致
- submit 直後の `v1_plan.decisions` (または子テーブル) に **1 行以上** 存在し、`candidates` 配列長が `2`、`criteria` 配列長が `1` と一致
- 上記を `GET /v1/timeline?owner_ids=…&start=…&end=…` のレスポンス経由でも観測でき、JSON 構造が壊れていない (raw bytes 観測)
- SQL で `SELECT count(*) FROM v1_plan_metrics WHERE plan_id = $1` ≥ 1 かつ `SELECT count(*) FROM v1_plan_decisions WHERE plan_id = $1` ≥ 1

## 実装手順

1. **新規ファイル作成**: `tastile-web/e2e/metric-decision.spec.ts` を新設。Playwright の `test` ブロックを 1 件だけ定義。ヘッダは以下:
   ```ts
   import { test, expect } from "@playwright/test";
   import { v1AuthHeaders, truncateV1 } from "./helpers/v1";
   import { execFileSync } from "node:child_process";
   ```
   ファイル冒頭に G 完了前提コメントを 1 行で残す: `// Depends on: G (wslc stack) + E4a-E4c (metric/decision editor + wire)`

2. **beforeAll TRUNCATE**: 既存 `recurring-weekly-to-placement.spec.ts` / `quick-tile-create-e2e.spec.ts` の `truncateV1()` 呼び出しパターンに揃え、`test.beforeAll(async () => { await truncateV1(); })` を 1 行で追加。G4b/G5b 経由の wslc TRUNCATE ヘルパが `v1_plan_metrics` / `v1_plan_decisions` も CASCADE で空にする仕様を前提 (不足時のみ G4b を先に直す)

3. **QuickCreate パネル起動**: `page.goto("/dashboard/timeline")` → `page.getByTestId("quick-create-open").click()` → `page.getByTestId("quick-create-panel").waitFor()`。`recurring-weekly-to-placement.spec.ts:45-62` のパネル起動パターンを踏襲

4. **Metric 入力 (output=READ のみ)**: パネル内 Metric セクションで:
   - `page.getByTestId("metric-add").click()` → 1 件目 Metric row
   - `output` セレクトを `READ` (数値定数 `1`、UI label は `v1/05:248-255` 表の "READ") に切替
   - `expression` 入力は `READ(kind=0, source_kind=1, target_id=<auto-fill local fact id>)` の最小 ScalarExpression。`MetricEditor.tsx` の expression 入力は `ScalarExpression` 構造 (kind=1, source_kind, target_id) を JSON 文字列で受ける前提
   - `limit` は null のまま (UI 上の "Clear" ボタンで null 化)
   - これで 1 件の Metric (output=1) を確定

5. **Decision 入力 (2 candidates × 1 criterion)**: パネル内 Decision セクションで:
   - `page.getByTestId("decision-add").click()` → 1 件目 Decision row
   - `observe` は scope=PLAN (数値 0) をデフォルト採用
   - `candidates` に 2 件追加: "候補 A" / "候補 B" それぞれ rank=0 / rank=1
   - `criteria` に 1 件追加: criterion 名 "Cost" + weight=1.0
   - `dialog` は `InteractionTree::default()` (`v1/06:31-38` の dialog フィールドは構造体。空の default 構造で OK)
   - これで 1 件の Decision (candidates.length=2, criteria.length=1) を確定

6. **submit**: パネル下部の "Create" ボタンをクリック → ネットワーク応答を待機:
   ```ts
   const [resp] = await Promise.all([
     page.waitForResponse(r => r.url().includes("/api/proxy/v1/schedule-definitions") && r.request().method() === "POST"),
     page.getByTestId("quick-create-submit").click(),
   ]);
   expect(resp.status()).toBeLessThan(400);
   ```
   submit 成功レスポンスから `aggregateMeta.planId` を取得 (既存 spec の `H4b` パターン参照)

7. **Read-back GET (HTTP 観測)**: 直後に `GET /v1/timeline?owner_ids=<e2e owner>&start=…&end=…` を叩き、レスポンス JSON の各 `plan` オブジェクトから:
   ```ts
   const plan = items.find(i => i.planId === planId).plan;
   expect(plan.metrics.length).toBeGreaterThanOrEqual(1);
   expect(plan.decisions.length).toBeGreaterThanOrEqual(1);
   expect(plan.decisions[0].candidates.length).toBe(2);
   expect(plan.decisions[0].criteria.length).toBe(1);
   ```
   `tastile-web/e2e/helpers/v1.ts:118-128` の `v1CreatePlacementAndResolve` と同じ GET 経路を使う

8. **SQL 観測 (raw bytes)**: spec 末尾で `wslc container exec tastile-db psql` を直接実行:
   ```bash
   METRICS_COUNT=$(wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT count(*) FROM v1_plan_metrics WHERE plan_id = '$PLAN_ID';")
   DECISIONS_COUNT=$(wslc container exec tastile-db psql -U tastile -d tastile_db -tA -c "SELECT count(*) FROM v1_plan_decisions WHERE plan_id = '$PLAN_ID';")
   test "$METRICS_COUNT" -ge 1
   test "$DECISIONS_COUNT" -ge 1
   ```
   `tastile-web/e2e/at-022-archive-keeps-placement.spec.ts` 等の既存 e2e spec が execFileSync で SQL を叩くパターンを踏襲

9. **i18n キーの整合**: E4a/E4c の `MetricEditor.tsx` / `DecisionEditor.tsx` で `messages/en.json` / `messages/ja.json` に `metric.section.title` / `metric.field.output` / `decision.section.title` / `decision.field.candidates` / `decision.field.criteria` が両言語分追加されていることを確認 (CI の翻訳チェック gate 対策)

10. **重複実行冪等性**: spec を 2 回連続実行しても green であることを `bun run test:e2e -- e2e/metric-decision.spec.ts` × 2 で確認 (1 回目は fresh insert、2 回目は別 planId に対して同じく ≥ 1 行を満たす contract を pin)

## 検証手順

```bash
# 1. wslc stack health (G 完了前提を再確認)
curl http://127.0.0.1:31400/v1/health
# 期待: 200 + {"status":"ok"}

# 2. 対象 e2e spec のみ実行
cd tastile-web
bun run test:e2e -- e2e/metric-decision.spec.ts
# 期待: 1 passed, exit 0, wall < 60s

# 3. SQL 観測 (spec 内 execFileSync が緑にならなかった場合の手動検証)
PLAN_ID=<submit response の aggregateMeta.planId>
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT count(*) AS metrics FROM v1_plan_metrics WHERE plan_id = '$PLAN_ID';"
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT count(*) AS decisions FROM v1_plan_decisions WHERE plan_id = '$PLAN_ID';"
# 期待: metrics >= 1, decisions >= 1

# 4. JSON 構造の raw 観測
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT metrics, decisions FROM v1_plan WHERE id = '$PLAN_ID';"
# 期待: metrics 配列 / decisions 配列 とも要素あり、output=1 (READ), candidates 長さ 2, criteria 長さ 1

# 5. 既存 e2e spec への無回帰
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts e2e/recurring-weekly-to-placement.spec.ts
# 期待: 既存件数のまま全件 Green
```

## リスク

- **Decision の complex input フォーム揺れ**: 2 candidates × 1 criterion の UI 操作は、MetricEditor/DecisionEditor が `Mantine` の `useField` 系 hook を使っている前提で、form state と zod schema の同期が崩れると submit payload の `decisions[0].candidates.length` が 2 にならない可能性。E4c 完了時に `candidates` 入力の `+` ボタンクリックで配列 push、削除ボタンの click index が DOM 順と一致することを `data-testid="decision-candidate-row-{idx}"` で pin しておく (本 E5b の spec で発見したら E4c 側の testid 追加で戻す)
- **wire 拡張の silent drop**: `quick-create-schedule-wire.ts:258-294` (TimeRequirement 経路) と同じパターンで、Metric/Decision 用の `serializeMetric` / `serializeDecision` が wire builder 経路で `state.plan.metrics.map(serializeMetric)` を呼ばずに `null` に潰れていないか。E4b の serialize ヘルパが `null` を返したら wire payload 側で `?? []` フォールバックして silent drop になるので、E5b spec の GET read-back で `plan.metrics.length === 0` が出たら wire diff を疑う
- **TRUNCATE 漏れ**: `v1_plan_metrics` / `v1_plan_decisions` が `v1_plan` への FK CASCADE で消える設計なら G4b の TRUNCATE 一行で十分。FK 設定が無い場合、本 spec 実行ごとに前回行が残り、`count(*) >= 1` は満たすが `decisions[0].candidates.length === 2` が前回 spec 由来の値で固定化される。FK 状態は spec 冒頭で `\d+ v1_plan_metrics` を psql で叩いて確認
- **i18n キー漏れ**: en/ja 翻訳片方だけ追加すると CI の i18n completeness gate で落ちる。E4a/E4c 実装時に両方を更新済であることを `git log --diff-filter=A -- messages/ | head` で確認
- **`output=READ` の expression 入力**: 1 件のみの最小 Metric を成立させるため、`target_id` に local fact (例: `v1_fact.id` の固定値) を要求すると env 依存になる。MVP は `target_id` を省略 / `null` 許容とし、UI 上で「`READ` without target is permitted in this spec」と表示するほうが isolation が高い
- **submit の idempotency_key 衝突**: spec を 2 回連続実行しても緑の contract は、**新しい plan ごとに新しい idempotency_key を `crypto.randomUUID()` で生成** することで担保。E4b の wire builder が `state.idempotencyKey` を payload に乗せる前提
- **candidate rank の numeric 並び順**: `rank=0` / `rank=1` の 2 候補を UI で 1 番目 / 2 番目 ボタンで追加すると、内部の `rank` フィールドが 0/1 と評価される順序を `data-rank="{rank}"` で DOM に出す必要あり。E4c 実装時に `rank` を data attribute に bind しておく

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §6 (e2e 検証)
- Domain spec: `tastile-core/v1/05-condition-and-reference.md` §Metric (191-230) + §ScalarExpression (235-279)
- Domain spec: `tastile-core/v1/06-decision-and-feedback.md` §Decision (27-87)
- Wire schema: `tastile-core/crates/v1/domain/src/command.rs` (`Plan.metrics`, `Plan.decisions`)
- E4a / E4b / E4c — Metric editor / wire builder / Decision editor (E4a-E4c 完了前提)
- Existing v1 e2e spec pattern: `tastile-web/e2e/recurring-weekly-to-placement.spec.ts` (TRUNCATE + GET /v1/timeline)
- Existing v1 helper: `tastile-web/e2e/helpers/v1.ts` (`truncateV1` / `v1AuthHeaders` / `v1CreatePlacementAndResolve`)
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Memory refs:
  - `feedback_verify_ui_in_browser.md` — パネル実装を browser で実機検証する contract
  - `feedback_observe_actual_behavior.md` — wire 経由の実 payload を SQL + curl で観測する
  - `feedback_measure_actual_scheduling.md` — submit 後の DB 状態を count で pin する
