# E2c — TaskDefinitionEditor

## メタデータ

- **ID**: E2c
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + TaskDefinition editors)
- **Depends on**: E2a (Condition editor) + E2b (TimeRequirement editor)
- **Sibling plans**: E3*
- **Source spec**: `04-sub-projects/E-condition-tree.md` §4 拡大対応 TaskDefinition (`04-sub-projects/E-condition-tree.md:26-32`)

## 前提

- E2a の `ConditionEditor` が実装・検証済みで、controlled な `value` / `onChange` API と Condition AST の不変条件を保持する。Condition は ALL / ANY / NOT / TERM の再帰木で、ALL / ANY は子 1 件以上、NOT は子 1 件、TERM は Term 詳細 1 件を持つ (`tastile-core/v1/05-condition-and-reference.md:6-32`)。
- E2b の TimeRequirement editor と payload 配線が Green で、同じ `Plan.completion` 内へ `tasks[]` を追加しても既存の `timeRequirements[]` を壊さない。
- `TaskDefinition` は UUIDv7 の `id`、`content`、nullable な `show`、必須の `complete`、`order[]` から成る。実行状態やチェック状態は定義に保存しない (`tastile-core/v1/13-completion.md:123-143`)。
- `show = null` は常時表示を意味し、`complete` は手動チェック、活動時間、Fact、他 Task、他タイル、Metric、Frame、Feedback を参照できる (`tastile-core/v1/13-completion.md:138-161`)。
- 実装開始前に `tastile-web/CLAUDE.md` と既存 QuickCreate の store / wire builder / e2e fixture を再読し、実際の型名、テスト ID、POST endpoint、DB 正規化テーブル名を確定する。本計画では推測した JSONB 列を新設しない。

## 目的

QuickCreate で 0-N 件の TaskDefinition を編集できる `TaskDefinitionEditor` を作る。ユーザーは各 Task に title、description、任意の show Condition、必須の complete Condition を設定でき、E2a の `ConditionEditor` を show / complete の双方で再利用して、送信 payload の `tasks[]` に欠落なく反映できる。

## 受入条件

- 初期状態は Task 0 件で、ユーザー操作により追加・削除できる。
- 2 件の Task を追加し、それぞれ異なる title と custom show / complete Condition を設定できる。
- submit 時に捕捉した request payload の `tasks[]` が 2 件で、各要素に正しい `id`、`content.title`、`content.description`、`show`、`complete`、`order` が入る。
- `show` を有効化した Task は Condition AST を送信し、無効化した Task は `show: null` を送信する (`tastile-core/v1/13-completion.md:129-141`)。
- 各 `complete` は E2a と同じ AST serializer を通り、ALL / ANY / NOT / TERM の構造と arity 制約を維持する (`tastile-core/v1/05-condition-and-reference.md:10-32`)。
- title / description は `content` の配下にあり、Task のチェック済み状態や `completed: boolean` を payload に追加しない (`tastile-core/v1/13-completion.md:127-143`)。
- Playwright spec `e2e/e2c-task-definition.spec.ts` が、2 Task の UI 操作と `tasks[]` request payload を実際に観測して Green になる。
- PostgreSQL の正規化済み Task / Condition 行を SELECT し、同じ 2 Task と各 show / complete Condition が永続化されたことを確認する。JSONB を正本とみなさない。

## 実装手順

### 1. 既存 contract と配置先を確認する

1. `tastile-web/src/features/create-tile/` 配下の QuickCreate store、型、wire builder、panel composition を確認する。
2. E2a の `ConditionEditor` export と props を確認し、別実装や Task 専用 Condition serializer を作らない。
3. E2b が追加した completion slice の更新方法に合わせ、Task 配列だけを追加する最小変更範囲を決める。
4. `tastile-core` の現行 schema / writer を追跡し、psql 検証で使う正規化テーブルと join key を記録する。Task は UUID で参照し、配列 index を識別子にしない (`tastile-core/v1/13-completion.md:131-139,260-261`)。

### 2. 先に failing E2E spec を作る

**Files:**
- Create: `tastile-web/e2e/e2c-task-definition.spec.ts`

1. 既存 e2e helper で QuickCreate を開き、Task が 0 件であることを確認する。
2. `Add task` を 2 回操作する。
3. Task A / B に異なる title と description を入力する。
4. 各 Task の `show` を有効化し、E2a がサポートする異なる custom Condition を組み立てる。
5. 各 Task の `complete` に異なる custom Condition を組み立てる。
6. request interception を submit 前に登録し、schedule-definition create request を捕捉する。
7. submit 後、payload の `tasks[]` 長さ 2、ID の一意性、content、show、complete、`order: []` を検証する。
8. spec を実行し、`TaskDefinitionEditor` または Tasks UI が未実装で FAIL することを確認する。

```bash
cd tastile-web
bun run test:e2e -- e2e/e2c-task-definition.spec.ts
# 期待: RED。Tasks の追加 UI または task editor が見つからない。
```

### 3. `TaskDefinitionEditor` を最小実装する

**Files:**
- Create: `tastile-web/src/features/create-tile/ui/TaskDefinitionEditor.tsx`
- Modify: 実査で確定した QuickCreate store / state 型ファイル
- Modify: 実査で確定した QuickCreate panel composition ファイル

1. editor の入力を `tasks` と更新 callback の controlled contract にするか、既存 store hook に揃える。独自の二重 state は作らない。
2. 0 件時に empty state と `Add task` button を表示する。
3. 追加時に UUIDv7 の Task ID、空の `content.title` / `content.description`、`show: null`、有効な default `complete`、`order: []` を生成する。UUID 生成は既存 web helper を再利用する。
4. 各 Task を安定した `task.id` key で描画し、配列 index はラベル表示以外の識別に使わない。
5. `content.title` input と `content.description` textarea を Task ごとに bind する。
6. `show` は enable toggle を設ける。OFF は `null`、ON は E2a の有効な default Condition を設定し、`<ConditionEditor value={task.show} onChange={...} />` を表示する。
7. `complete` は常に `<ConditionEditor value={task.complete} onChange={...} />` を表示する。show / complete の AST 処理を copy-paste しない。
8. Task 削除を `task.id` 指定で実装する。別 Task の Condition がずれないことを保つ。
9. QuickCreate panel の既存 Tasks section に `TaskDefinitionEditor` を 1 回だけ配置する。
10. title の必須 validation は既存 form validation 層へ追加し、空 title の submit を UI で明示的に止める。

### 4. `tasks[]` wire payload を接続する

**Files:**
- Modify: 実査で確定した `tastile-web/src/features/create-tile/` 配下の wire builder / schema

1. store の TaskDefinition を payload contract の `tasks[]` へ map する。
2. `content`、`show`、`complete`、`order` を落とさず送る。`show: null` を省略値へ暗黙変換しない。
3. show / complete は E2a の serializer を共用する。
4. Task ID は wire 上も UUID のまま保持する。
5. `order[]` はこの計画では UI を作らず、常に空配列を round-trip させる。文字列の `default` rule や仮の sentinel は生成しない。正式な TaskOrderRule は `id / targetTaskId / relation / when` で、relation は BEFORE=0 / AFTER=1 (`tastile-core/v1/13-completion.md:163-180`)。
6. `completed`、`checked`、`taskRuns` などの実行状態を TaskDefinition payload に追加しない (`tastile-core/v1/13-completion.md:127-143`)。

### 5. E2E を Green にする

1. targeted spec を再実行する。
2. UI selector の都合だけで product code に不自然な状態を追加せず、必要なら安定した accessible name または `data-testid` を Task row / show / complete scope に限定して追加する。
3. 2 Task の payload assertion が Green になるまで最小修正を繰り返す。
4. E2a / E2b の targeted specs も再実行し、ConditionEditor と completion state の回帰がないことを確認する。

```bash
cd tastile-web
bun run test:e2e -- e2e/e2c-task-definition.spec.ts
# 期待: 1 spec Green。2 tasks と各 custom show / complete Condition を確認。
```

### 6. 実ブラウザと DB で一気通貫を確認する

1. wslc の PostgreSQL / core API と tastile-web dev server を、既存 G 系 stack-up plan の手順で起動する。
2. Chrome DevTools で QuickCreate を開き、Task 2 件を追加する。
3. 各 Task の show / complete を編集し、submit 時の Network request body を観測する。
4. submit 成功後に psql で今回作成した Plan の TaskDefinition と Condition 子行を SELECT する。
5. payload だけでなく、DB に Task 2 件、show 2 件、complete 2 件が保存されていることを確認する。
6. 実際に実行していない場合は VERIFIED / Green と記録しない。

## 検証手順

### Targeted Playwright

```bash
cd tastile-web
bun run test:e2e -- e2e/e2c-task-definition.spec.ts
```

期待結果:

- `1 passed`、`0 failed`。
- request payload の `tasks` が length 2。
- `tasks[0]` / `tasks[1]` は assertion 表現にのみ index を使い、payload 自体は各 Task を UUID で識別する。
- 各 Task の `content.title`、`show`、`complete` が UI 入力と一致する。
- 両 Task の `order` は `[]`。

### E2a / E2b regression

実際の sibling spec 名を実査後に指定して実行する。少なくとも E2a の Condition editor と E2b の TimeRequirement editor の targeted specs が Green であることを確認する。

### psql

現行 migration / repository の実テーブル名を確認したうえで、次の意味を満たす SELECT を実行する。存在しない `tasks` JSON 列を仮定しない。

```sql
-- 作成した plan_id に属する TaskDefinition を UUID / position 順で列挙する。
SELECT <task_id>, <title>, <description>
FROM <normalized_task_definition_table>
WHERE <plan_id_column> = '<created-plan-id>'
ORDER BY <stable_position_or_task_id>;

-- 各 task_id に show / complete の condition root が結び付くことを確認する。
SELECT <task_id>, <show_condition_id>, <complete_condition_id>
FROM <normalized_task_definition_table>
WHERE <plan_id_column> = '<created-plan-id>';
```

期待結果:

- Task 行が 2 件。
- title / description が Playwright 入力と一致。
- 各 Task の show / complete condition root が null でなく、Condition 子テーブルを辿って期待 AST と一致。
- TaskOrderRule 行は 0 件。

## リスク

- **`order[]` TaskOrderRule の UI 未実装**: 初期 E2c は `order: []` の保持・送信までとし、BEFORE / AFTER、target task、conditional `when`、循環検出 UI は E3* へ送る。仮の文字列 rule や `default` sentinel は作らない (`tastile-core/v1/13-completion.md:163-180`)。
- **show / complete Condition reuse の崩れ**: 同じ `ConditionEditor` と serializer を両方に使うことを E2E で確認する。show 用の簡略 AST や complete 用 fork を作らない。
- **nullable show の状態遷移**: OFF→ON→編集→OFF→ON で前の AST を保持するか初期化するかは既存 form state 方針に合わせる。ただし OFF の wire 値は必ず `null`。
- **再帰深度 / 描画量**: 0-N Task × show / complete の 2 木により UI が深くなる。E2a の depth guard をそのまま使い、E2c 独自の再帰実装は追加しない。nested tasks という別データ構造は TaskDefinition 仕様にないため作らない。
- **Task 間参照**: complete の TaskTerm や将来の order rule は Task ID を参照する。削除時に dangling reference が生じ得るため、本 E2c では参照作成 UIを拡張せず、E3* で validation と循環検出を扱う。Condition / TaskOrder 間の循環は禁止 (`tastile-core/v1/05-condition-and-reference.md:295-303`)。
- **payload Green と永続化 Green の混同**: intercepted request が正しくても core writer が drop する可能性がある。psql で正規化行を観測するまで e2e 完了としない。
- **既存計画との命名ずれ**: 既存 `E3d-task-definition-editor-component.md` は古い分解や誤った order fallback を含む可能性がある。本 E2c と正本 v1 spec を優先し、重複実装しない。

## 関連

- E2a — Condition AST editor component。show / complete の両方で再利用。
- E2b — TimeRequirement editor。同じ `Plan.completion` state / wire 配線の sibling。
- E3* — TaskOrderRule UI、Task 間参照、循環検出などの拡張。
- `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:18-32` — Condition editor と TaskDefinition editor の分解。
- `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:38-44` — TaskDefinition e2e の 2 Task / complete Condition 検証。
- `tastile-core/v1/13-completion.md:123-180` — TaskDefinition、show、complete、TaskOrderRule の正本。
- `tastile-core/v1/13-completion.md:253-261` — Task 状態、Completion.root、UUID 参照の不変条件。
- `tastile-core/v1/05-condition-and-reference.md:6-32` — Condition AST と arity 制約。
- `tastile-core/v1/05-condition-and-reference.md:40-52` — complete / show で利用可能な Term 群。
- `tastile-core/v1/05-condition-and-reference.md:295-303` — Condition / TaskOrder の循環禁止と未実装 Term の代用禁止。
