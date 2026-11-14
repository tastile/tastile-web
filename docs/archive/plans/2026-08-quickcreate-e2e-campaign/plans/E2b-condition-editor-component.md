# E2b — ConditionEditor.tsx コンポーネント実装 (4 operators × 6 term kinds)

## メタデータ

- **ID**: E2b
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + Metric / Decision / TimeRequirement / TaskDefinition editors)
- **Depends on**: E2a (Condition モデル/型 + `default-term.ts` ヘルパー)
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §3 (拡大対応 — Condition AST editor)

## 前提

- `tastile-web/src/tile/model/v1/condition.ts:94-98` の `ConditionNode` 型と `v1/05:11-32` / `v1/05:40-52` で定義された 4 operators (ALL / ANY / NOT / TERM) と 6 term kinds (Reference / Metric / Time / Task / Gap / Calendar) が固定
- `tastile-web/src/tile/model/v1/constants.ts` の `ConditionKind` enum と `HolidayKindValue` / `ConditionKindValue` が利用可能
- `tastile-web/src/features/create-tile/ui/default-term.ts` に `defaultTerm(kind)` ヘルパーが実装済み (E2a の成果物)
- `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx` は骨組み (588 行) は書かれているが、本計画で「公開する controlled props シグネチャ」「4 operators × 6 term kinds 全対応」「ネスト再帰」「wire builder 互換の JSON 出力」を仕様 fix する
- `tastile-web/src/features/create-tile/ui/ConditionPanel.tsx` が `ConditionEditor` を内包し、`CompletionSubPanel.tsx:60-67` から `root={plan.completion.root}` / `setField("plan.completion.root", ...)` で既に bind されている
- Mantine v7 (`@mantine/core`, `@mantine/dates`) + `lucide-react`、React 19 hook、`@/shared/ui/form` の `RowSegmented` が利用可能

## 目的

`Source: parent §3` — Recursive な Condition AST エディタを公開し、`Plan.completion.root` (v1/13:11) と `FrameRule.active` (v1/08:54、E2c で繰り返し側) の両方から「同じコンポーネント」を呼び出せるようにすること。公開 API は controlled ペア (`value: ConditionNode`, `onChange: (ConditionNode) => void`) に限定し、store / wire への結合点は利用側 (ConditionPanel / QuickCreate) に残す。6 term kinds 全種の sub-form (kind 別入力 UI) を持ち、AST 構造と JSON 出力が `crates-v1/domain/src/condition.rs` の deserialize と一致することを保証する。

## 受入条件

- `ConditionEditor` が mounted され、4 operators (ALL / ANY / NOT / TERM) 切替 + 6 term kinds 切替の UI が描画される
- 子ノードの追加 / 削除 / 入れ替え (drag は MVP スコープ外、上下ボタンで実装) が可能で、`onChange` が毎回妥当な `ConditionNode` JSON を emit する
- `Plan.completion.root` 経由で submit → `POST /v1/schedule-definitions` payload → 直後 `GET /v1/timeline` で読み戻した `v1_plan.completion.root` が JSON-shape 同一 (round-trip)
- `e2e/condition-tree-basic.spec.ts` グリーン: `{ALL: [timeReq, taskRef]}` を UI 上で構築 → submit → DB round-trip 一致

## 実装手順

1. **公開 props の固定** — `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx:1-30` 付近。先頭の JSDoc に以下を明文化:
   ```ts
   export interface ConditionEditorProps {
     value: ConditionNode;
     onChange: (next: ConditionNode) => void;
     /** E2c で FrameRule.active からも呼ばれる。default false (= Plan.completion.root 想定) */
     allowNotAtRoot?: boolean;
     /** AST の最大深さ。default 3。E3d (TaskDefinitionEditor) からの再利用で 4 以上になる */
     maxDepth?: number;
     /** i18n 経由。useTranslation 省略時は identity でも可 */
     t?: (key: string) => string;
   }
   export function ConditionEditor(props: ConditionEditorProps): JSX.Element;
   ```
   既存の `ConditionPanel.tsx:60-67` 経由の呼び出し (CompletionSubPanel) では `value` / `onChange` のみ渡す形を維持。

2. **再帰本体** — `ConditionEditor.tsx:80-180` 相当の `function ConditionEditor({ value, onChange, maxDepth = 3, t = identity })` を実装。`value.kind` を見て:
   - `ALL` / `ANY` → 子ノード配列 `value.children` を持つ。各児童を `<ConditionEditor value={child} onChange={c => updateChild(idx, c)} />` で再帰描画。`maxDepth` 到達時は「深くできません」disabled 表示。
   - `NOT` → 子は 1 個のみ。`children.length === 1` を invariant として保持し、UI 上でも追加ボタン非表示。
   - `TERM` → 子は 0 個 (`children: []`)、`value.term` 必須。term 選択 UI を `<TermPicker>` サブコンポーネント (後述) で描画。

3. **operator 切替 segmented** — `ConditionEditor.tsx:19-45` の `ConditionKindSegmented` を修正。`v1/05:11-32` 通り 4 options (ALL=0 / ANY=1 / NOT=2 / TERM=3) を `RowSegmented` で並べる。`onChange(newKind)` 時に `value.kind` を更新 + `NOT` を選んだら `children` を 1 要素に truncate、`TERM` を選んだら `term = defaultTerm('calendar')` (default-term.ts:1) を初期投入。

4. **6 term kinds の sub-form** — `ConditionEditor.tsx:200-560` 相当に `<TermPicker value={value.term!} onChange={term => onChange({ ...value, term })} />` を実装。kind = 「calendar / moment / relation / gap / requirement / task / fact / metric / feedback / life」 (`condition.ts:80-90` の `Term` union は 10 種あるが、本 E2b の MVP 必要 6 種は v1/05:40-52 通り: **Reference / Metric / Time / Task / Gap / Calendar**。残 4 種は best-effort でプレースホルダ + 「未実装」ラベル)。
   - `calendar` → `weekdayMask` (7-bit checkbox)、`timeStart` / `timeEnd` (`<TimeInput>`)、`holidayKind` (`Select` with `HolidayKindValue`)、`dateRange` (任意、`<DateRangePicker>` 2 個)、`offsetMin` (`NumberInput`)
   - `moment` (Time 系) → `referenceId` (`<TileReferencePicker>`)、`point` (number)、`offsetMs` (number)
   - `relation` → `referenceId`, `relation` (5-valued Select), `windowKind` (4-valued Select)
   - `gap` → `scope` (5-valued), `leftAnchor` / `rightAnchor` (各 `TileReferencePicker`), `size` (`DurationRange`)
   - `requirement` → `requirementId` (string), `state` (MET=0 / NOT_MET=1)
   - `task` → `taskId` (string), `state` (VISIBLE=0 / MARKED=1 / COMPLETED=2 / NOT_COMPLETED=3)
   - 上記 6 種は `condition.ts:11-54` の interface と 1:1 対応。zod は MVP ではスキップ (E2a で `defaultTerm` が `unknown as Term` キャストしている現状を踏襲)

5. **子ノード追加 / 削除 UI** — `ConditionEditor.tsx:260-340` 相当。ALL / ANY の場合 `<Button onClick={addChild}>` (+ Add condition) で子追加、`defaultTerm` 由来の新規 `ConditionNode` を `children` 末尾 push。NOT の場合は無効化。TERM の場合は非表示。各児童の右上に `<ActionIcon onClick={removeChild(idx)}>` (Trash2 icon) で削除。

6. **ConditionPanel への内部統合** — `ConditionPanel.tsx:60-92` を確認。既に `<ConditionEditor value={root} onChange={setRoot} />` 形式で wired。本 E2b では props シグネチャを固定するだけ (Panel 側の編集は最小)。

7. **wire 互換 JSON emit** — ConditionEditor 内で `onChange` に渡す `ConditionNode` を `JSON.stringify` した結果が `crates-v1/domain/src/condition.rs` の deserialize と shape 一致することを snapshot テストで固定 (§検証手順 4)。`defaultTerm` (E2a) の戻り値がこの shape に乗ることを保証。

8. **i18n** — `messages/en.json` / `messages/ja.json` に `conditionEditor.addChild`, `conditionEditor.removeChild`, `conditionEditor.kind.all`, `conditionEditor.kind.any`, `conditionEditor.kind.not`, `conditionEditor.kind.term`, `conditionEditor.termKind.calendar`, `conditionEditor.termKind.moment`, `conditionEditor.termKind.relation`, `conditionEditor.termKind.gap`, `conditionEditor.termKind.requirement`, `conditionEditor.termKind.task` を追加 (`ConditionPanel.tsx` で既に `quickCreate.conditionAll` 系のキーがあれば流用)。

9. **単体テスト** — `tastile-web/src/features/create-tile/ui/ConditionEditor.test.tsx` (V&R では ConditionPanel.test.tsx が既存) を新規追加。React Testing Library + Vitest。render 直後に 4 operators セグメントが見える / TERM 切替で default term が入ること / ALL を選んで子追加で `onChange` の最新呼び出しが 2 児童配列を含むこと、を 3 ケースで検証。

## 検証手順

1. **コンポーネント単体テスト**:
   ```bash
   cd tastile-web
   bun test src/features/create-tile/ui/ConditionEditor.test.tsx
   # 期待: 3 passed (renderDefaultTerm, switchToAllThenAddChild, antTermEmitsValidJSON)
   ```

2. **JSON snapshot** — テスト内で `const lastArg = onChange.mock.calls.at(-1)![0]; expect(JSON.stringify(lastArg)).toMatchSnapshot()` を `{ALL: [calendarTerm, taskTerm]}` の構成で取得。`__snapshots__/ConditionEditor.test.tsx.snap` の固定値が `crates-v1/domain/src/condition.rs` の deserialize 期待 shape と一致することを CI で確認 (snapshot file を PR review で読み合わせる)。

3. **既存 ConditionPanel テスト**:
   ```bash
   bun test src/features/create-tile/ui/ConditionPanel.test.tsx
   # 期待: 既存全ケース green (props シグネチャ後方互換)
   ```

4. **wire builder 経由の round-trip** — QuickCreate を mount → Plan.completion の root を `{ALL: [timeReq, taskRef]}` に構築 → submit → 直後 `GET /v1/timeline` で取得 → `v1_plan.completion.root` を `JSON.parse` して上述 snapshot と deep equal。

5. **Vitest ui** (任意、目視):
   ```bash
   bun test --ui src/features/create-tile/ui/ConditionEditor
   ```

6. **e2e** (sub-project G の wslc TRUNCATE 環境下):
   ```bash
   bunx playwright test e2e/condition-tree-basic.spec.ts
   # 期待: 1 passed (sub-project E §6 の spec)
   ```

## リスク

- **Combinatorial UX**: 4 operators × 6 term kinds × ネスト深さ × 子数 (max 推奨 5) で UI path が 144+ 通り。Mantine の `Accordion` で kind 別 sub-form を畳み、初期描画コストと複雑性を下げる。MVP は `maxDepth=3` ハードコード。
- **Accessibility**: ネストした Condition ツリーは screen reader にとって「同じ builder が N 段再帰している」 estado が見えにくい。`role="tree"` / `role="treeitem"` でランドマーク化し、各児童ヘッダに `aria-label` ("Condition 1 of 3 — ALL") を付与。
- **wire shape drift**: `condition.ts` 側 interface を Rust 側 (`condition.rs`) と別個に進化させると round-trip が壊れる。`v1/05` への conformance はクロスチェック CI (`tile-create-e2e-wiring/05-impl-order.md` の cross-repo contract check) で担保、E2b 側は snapshot を Gold master として固定。
- **default-term.ts cast**: E2a で `defaultTerm` 戻り値が `unknown as Term` キャスト。E2b で使うときに型安全性が崩れないよう、`<TermPicker value={value.term ?? defaultTerm(selectedKind)} />` で必ず non-null を供給。
- **Performance**: ネスト毎の `onChange` が祖先にまで伝播すると深い AST で re-render が爆発。`React.memo` + 児童ごとの `onChange` メモ化 (`useCallback` の fn dep は `value.term`/`value.children` への shallow compare) を Phase 4 で追加予定。MVP では `key={child.id}` を児童に振って local re-render に留める。
- **6 term kinds 全対応 vs spec の 6 種**: `condition.ts:80-90` の `Term` union は 10 種 (life / fact / feedback を含む) だが spec §3 必須は 6 種 (Reference / Metric / Time / Task / Gap / Calendar)。残り 4 種は disabled + "未実装" バッジで MVP スコープ外を可視化。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §3
- Depends on: E2a (`default-term.ts` ヘルパー)
- Blocks: E2c (FrameRule.active 統合), E3d (TaskDefinitionEditor 内 complete Condition 再利用), E3e (Metric / Decision editor)
- Domain spec: `tastile-core/v1/05-condition-and-reference.md:11-52` (4 operators + 6 term kinds)
- Wire schema: `tastile-core/crates/v1/domain/src/condition.rs` (AST deserialize)
- Plan binding: `tastile-core/v1/13:11` (Plan.completion.root), `tastile-core/v1/08:54` (FrameRule.active, E2c)
- Sister plans: `tile-create-e2e-wiring/04-plans/E3d-task-definition-editor-component.md` (次段), `tile-create-e2e-wiring/04-plans/E3a-time-requirement-spec.md`
- Existing component: `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx` (骨組み), `ConditionPanel.tsx` (外殻)
- UI audit: `tile-create-e2e-wiring/02-ui-coverage-audit.md` §5 (recurring.condition silent drop)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
