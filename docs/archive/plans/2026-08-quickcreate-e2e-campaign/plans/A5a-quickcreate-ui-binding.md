# A5a — QuickCreate UI binding

## メタデータ

- **ID**: A5a
- **Phase**: 2 (QuickCreate wiring — UI half)
- **Target repo**: `tastile-web`
- **Sub-project parent**: A (QuickCreate + Core)
- **Depends on**: A1b (Identity fields), A2a (Plan fields), A3a (Meta-min fields)
- **Source spec**: `04-sub-projects/A-quickcreate-core.md` §3.2
- **Sibling plans**: A5b (submit handler → wire builder), A4 (CRUD round-trip)

## 前提

- A1b / A2a / A3a plans が完了しており、各フィールドの Zod スキーマ断片が揃っている
- `tastile-web/src/features/create-tile/ui/QuickCreate.tsx` が React Hook Form + Zod resolver で `useForm<CreateTileFormValues>` を使っている
- `quick-create-schedule-wire.ts`（A5b 担当）の throw サイトが A1b / A2a / A3a で除去済み（フォーム入力が空のフィールドを渡さない前提）
- Mantine `Tabs` + 共通の `<Section>` ラッパが `tastile-web/src/features/create-tile/ui/_section.tsx` に存在

## 目的

QuickCreate パネル内の Identity / Plan / Meta-min の 3 つのタブを **controlled な RHF 入力**として結びつけ、submit 時に `submitTile(values)` が `quick-create-schedule-wire.ts` を呼べる値を吐くようにする。タブ横断の状態同期（Recurring 有効時に Plan タブ read-only、Open-ended 有効時に End picker disabled）、キーボードナビゲーション、ドラフト autosave までを含む。

## 受入条件

- `tastile-web/e2e/quick-create-panel-binding.spec.ts` が緑で、`POST /v1/tiles` リクエスト body が owner_id / plan / meta の 3 セクションをすべて含む（network fixture で検証）
- タブ順序 Identity → Plan → Meta-min → Recurring → Submit を Tab キー入力で再現し、focusable 順が一致することを Playwright で assert
- Recurring を有効化すると Plan タブ内の全入力が `disabled` 属性になること（`getByRole('textbox', { name: 'Plan start' })` などが `.toBeDisabled()`）
- ブラウザ mid-form リロード（`page.reload()`）で `localStorage["tastile.draft.create-tile"]` からドラフトが復元されること
- どのフィールドもサイレントに落ちない（`formValues` を `JSON.stringify` して wire builder に渡るスナップショットが全タブの入力を含む）

## 実装手順

1. **`QuickCreate.tsx` の構造確定** (`tastile-web/src/features/create-tile/ui/QuickCreate.tsx`)
   - `useForm<CreateTileFormValues>({ resolver: zodResolver(CreateTileFormSchema), defaultValues, mode: 'onBlur' })` を panel root に置く
   - `<Tabs defaultValue="identity">` 配下に `<Tabs.Panel value="identity">` / `"plan"` / `"meta-min"` / `"recurring"` の 4 枚
   - 各 `<Tabs.Panel>` の中身を `<Section title="Identity">` 等の共通ラッパで囲む（A5b の submit ハンドラはこの `useFormContext()` を呼ぶ）

2. **フィールドバインディング**
   - Identity: `Controller name="owner_id"` で `Select`（subject 一覧。`OwnerCombobox.tsx` 既存品を再利用）
   - Plan: `kind` は `SegmentedControl`、`start` / `end` は `DateTimePicker`、`open_ended` は `Checkbox`（後述の依存切替用）
   - Meta-min: `project_id` は `Combobox`、`tags` は `TagsInput`、`notes` は `Textarea`
   - Recurring: `useWatch({ name: 'recurring.enabled' })` を親で監視し、Plan タブの入力を一括 `disabled` 制御

3. **フィールド間依存ロジック**
   - `useWatch` で `recurring.enabled === true` のとき、Plan タブ全体を `<fieldset disabled>` で囲み、上部に `Alert color="info"` で "Plan is derived from recurring settings" を出す
   - `useWatch` で `plan.open_ended === true` のとき、`plan.end` の `DateTimePicker` を `disabled` にし、`value={null}` 相当の sentinel を渡す
   - どちらの依存も RHF の `setValue` ではなく `useEffect` 経由の `useFormState().errors` でなく `useWatch` を使う（re-render コスト低）

4. **キーボードナビゲーション**
   - すべての単一行入力は `Enter` で submit が走る（`<form onSubmit={handleSubmit(onSubmit)}>` を panel root に置く）
   - `notes` の `Textarea` は `Enter` で newline を許可（`<form>` 内で `<Textarea>` の Enter は submit しないよう `onKeyDown` で `e.key === 'Enter' && !e.shiftKey` を吸収）
   - Tab 順を担保するため `Tabs.Panel` 内の `<Section>` 直下に各 `Controller` を `Stack` で並べ、`role="tabpanel"` の aria 属性に頼る

5. **ドラフト autosave**
   - `useEffect(() => { const id = setTimeout(() => localStorage.setItem('tastile.draft.create-tile', JSON.stringify(values)), 1000); return () => clearTimeout(id); }, [values])` を panel mount 時に置く
   - mount 時に `localStorage.getItem('tastile.draft.create-tile')` を読めば `reset(JSON.parse(saved))`
   - submit 成功時に `localStorage.removeItem('tastile.draft.create-tile')`
   - submit 失敗時はドラフトを残す（リトライ可能）

6. **submit 配線 (A5b との境界)**
   - 本 A5a は `onSubmit` の **呼び出し元** までを担当し、A5b は `submitTile` の内部実装を担う
   - `const onSubmit = handleSubmit(async (values) => { await submitTile(values); })` のラッパ 1 行のみ A5a 側で書く

## 検証手順

```bash
# 1. unit: QuickCreate が render できる（jsdom で Tabs が破綻しないか）
cd tastile-web
bun run test src/features/create-tile/ui/QuickCreate.test.tsx
# 期待: 全テスト緑、test result: ok. N passed; 0 failed

# 2. e2e: panel-binding スペック
bunx playwright test e2e/quick-create-panel-binding.spec.ts
# 期待: 緑 / POST /v1/tiles が intercept され body に owner_id / plan / meta が揃う

# 3. ローカル手動 (任意)
cd tastile-web
bun run dev
# → http://localhost:3000/dashboard/timeline で「+ Create」→ 全タブ入力 → 送信
# → DevTools Network で POST /v1/tiles payload を確認

# 4. localStorage 復元テスト (e2e に同梱)
bunx playwright test e2e/quick-create-panel-binding.spec.ts -g "draft restore"
# 期待: page.reload() 後にフォーム値が復元される
```

## リスク

- **RHF + Mantine の controlled ずれ**: `Controller` を入れ子にしすぎると `useWatch` の re-render が増えて重い。`Tabs.Panel` の lazy mount と組み合わせて初回は Identity 以外を unmount しておく
- **autosave の SSR ハイドレーション**: `localStorage` は server-side で `undefined`。`useEffect` 内のみアクセスし、SSR 初期描画は defaultValues で行う
- **Enter キーで意図せず submit**: `<Textarea>` の Enter 吸収を忘れると notes 編集中に submit される。`onKeyDown` のガード必須
- **Playwright の `disabled` 判定揺れ**: Mantine は内部で `aria-disabled` を使う場合がある。`.toBeDisabled()` が失敗したら `toHaveAttribute('data-disabled', '')` を併用

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-quickcreate-core.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sibling plans: `04-plans/A1b-identity-fields.md`, `04-plans/A2a-plan-fields.md`, `04-plans/A3a-meta-min-fields.md`, `04-plans/A5b-submit-handler.md`, `04-plans/A4-crud-roundtrip.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
