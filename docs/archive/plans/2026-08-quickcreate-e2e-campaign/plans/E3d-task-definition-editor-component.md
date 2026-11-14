# E3d — TaskDefinitionEditor.tsx コンポーネント実装

## メタデータ

- **ID**: E3d
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E (Condition tree + TaskDefinition editors)
- **Depends on**: E2b (ConditionEditor), E3c (TaskDefinition wire builder)
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §4 (`TaskDefinition` editor)

## 前提

- `tastile-web/src/features/create-tile/ui/ConditionEditor.tsx` が E2b で実装済み
- `tastile-web/src/features/create-tile/wire/quick-create-schedule-wire.ts` に E3c で `tasks[]` へのシリアライズが組み込まれている
- `tastile-core/v1/13:122-180` の `TaskDefinition` スキーマ (content / show / complete / order[]) が固定されている
- `quick-create-store.ts` に `tasks: TaskDefinition[]` スライスが存在し、`Plan.completion.tasks[]` と双方向 bind 済み (E3c で配線)

## 目的

QuickCreate パネル内に `TaskDefinitionEditor.tsx` を実装し、ユーザーが 1 タイルあたり N 個のタスクを編集できるようにする。各タスクは content (title/description)、complete Condition (E2b の ConditionEditor を再利用)、order[] リストを保持する。`Plan.completion.tasks[]` への永続化と、wire builder 経由の payload 送出までを一気通貫で担う。

## 受入条件

- `TaskDefinitionEditor` が QuickCreate パネルの Tasks セクションに表示され、タスク追加/削除/並び替え UI を提供する
- 2 件のタスクを入力して submit すると、`POST /v1/schedule-definitions` の payload に `plan.completion.tasks` として 2 行が現れる (`e2e/task-definition.spec.ts` で検証)
- タスク内の complete Condition を E2b の ConditionEditor で `{ALL: [timeReq]}` 等に構築 → submit → 直後の GET で完全一致の Condition AST が `v1_plan` から読み戻せる (round-trip)

## 実装手順

1. **新規ファイル作成**: `tastile-web/src/features/create-tile/ui/TaskDefinitionEditor.tsx` を新設。`useStore(quickCreateStore, s => s.tasks)` で配列購読、追加は `addTask({ content: { title: '', description: '' }, complete: defaultTerm(), order: [] })` を呼び、削除は `removeTask(taskId)`、並び替えは `reorderTasks(fromIdx, toIdx)`。
2. **content サブフォーム**: `task.content.title` を必須 TextField (Mantine `TextInput`)、`task.content.description` を `Textarea` で編集。空タイトルは submit 時に zod (`content.title.min(1)`) で弾く。
3. **complete Condition の差し込み**: `task.complete` を `<ConditionEditor value={task.complete} onChange={cond => updateTask(taskId, { complete: cond })} />` で描画 (E2b のコンポーネントを直接再利用、props は `value` / `onChange` の controlled ペアのみ)。
4. **order[] リスト**: タスク下に `order` を編集する小さなリスト。MVP は文字列 (TaskOrderRule name) をカンマ/ドラッグで並べる。`v1/13:175-180` の `TaskOrderRule` 仕様に従い、最低 1 件の entry を要求。空 order のときは `['default']` にフォールバック。
5. **store 配線**: `quick-create-store.ts` に `tasks: TaskDefinition[]`, `addTask`, `updateTask`, `removeTask`, `reorderTasks` を追加。`TaskDefinition` 型は `tastile-core/v1/13:122-180` と完全同期 (zod schema 経由で派生させるのが望ましい)。
6. **パネルへの埋め込み**: `tastile-web/src/features/create-tile/ui/QuickCreatePanel.tsx` 内の `<Section title="Tasks">` に `<TaskDefinitionEditor />` を配置 (`02-ui-coverage-audit.md` §2 の "Mark done" 単体を置換)。
7. **wire builder との結合**: E3c で追加された `toWireTask(task: TaskDefinition): WireTask` を `tasks.map(toWireTask)` で `plan.completion.tasks[]` に流し込む。`complete` は Condition AST の JSON 表現のまま payload に乗せる (Rust 側で `condition.rs` の `deserialize` が受け持つ)。
8. **i18n**: `messages/en.json` / `messages/ja.json` に `tasks.section.title`, `tasks.field.title`, `tasks.field.description`, `tasks.field.complete`, `tasks.field.order`, `tasks.action.add` のキーを追加。
9. **単体テスト**: `tastile-web/src/features/create-tile/ui/__tests__/TaskDefinitionEditor.test.tsx` を追加 (下記「検証手順」参照)。

## 検証手順

`TaskDefinitionEditor.test.tsx` で React Testing Library + Vitest:

1. **レンダリング**: `<TaskDefinitionEditor />` を描画 → "Tasks" セクション見出し、empty state の "Add task" ボタンが見える。
2. **追加**: "Add task" クリック → 1 件目のタスク row が表示され、title/description 入力、complete セクション (ConditionEditor のフォールバック TERM)、order 空が表示される。
3. **2 件化**: "Add task" を再度クリック → 2 行目が増える。`expect(screen.getAllByTestId('task-row')).toHaveLength(2)`。
4. **condition 編集**: 1 行目の complete セクションでオペレータを `ALL` にして term を 1 件追加 → store の `tasks[0].complete.kind === 'ALL'` を確認 (E2b の ConditionEditor 経路)。
5. **削除**: 2 行目の削除ボタンクリック → 1 行のみ残る。`expect(removeTask).toHaveBeenCalledWith(taskId2)`。
6. **submit round-trip**: `quickCreateStore.getState()` で `tasks` をダンプ → `toWireTasks(tasks)` (E3c) → `plan.completion.tasks` の長さが 2、`tasks[0].complete` が `{ kind: 'ALL', terms: [...] }` 構造であること。
7. **永続化 e2e**: `e2e/task-definition.spec.ts` を sub-project G の wslc TRUNCATE 経由で実行 → `GET /v1/timeline` のレスポンスで `v1_plan` 行の `completion.tasks` が JSON-parse でき、長さ 2 を満たす。

## リスク

- **Condition ネスト UI の深さ**: 1 タスクごとに ConditionEditor がネストするため、3 件以上のタスク × 深い AST でパネルが縦方向に長くなる。MVP は `Accordion` で 1 タスクずつ畳むか、`maxDepth=2` で AST の深さ上限を切る (E2b の条件)。
- **E2b との coupling**: ConditionEditor の props シグネチャが変わると本コンポーネントが壊れる。E2b 完了時に props を `value`/`onChange` に固定し、`TaskDefinitionEditor` 側で shallow compare して不要な re-render を防ぐ。
- **order[] スキーマ未確定**: `v1/13:175-180` の `TaskOrderRule` は MVP では string entry の配列に簡略化している。Phase 4 で構造体 (例: `{ after: taskRef, wait_ms: u32 }`) に拡張すると本コンポーネントも追従必要。
- **空入力フォールバック**: title 空 / order 空のときに wire builder が拒否するか黙ってデフォルトで埋めるかを E3c と統一。`order: ['default']` フォールバックは wire 側で適用し、UI には "default" をヒント表示する。
- **i18n キー漏れ**: en/ja の片方だけ追加すると CI で翻訳チェックが落ちる。実装時に必ず両方を更新する。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §4
- Depends on: E2b (`ConditionEditor`), E3c (`quick-create-schedule-wire.ts` の `tasks[]` シリアライザ)
- Domain spec: `tastile-core/v1/13:122-180` (`TaskDefinition`)
- Wire schema: `tastile-core/crates/v1/domain/src/command.rs` (`Plan.completion.tasks`)
- UI audit: `tile-create-e2e-wiring/01-domain-spec-fields.md` §2 (現状の "Mark done" 単体を置換)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`