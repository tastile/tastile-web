# Tile Creation Panel — Mantine 移行 Design

- 対象: `tastile-web` のダッシュボード内「タイル作成パネル」
- 目的: 複雑化するパラメータ群の**視覚的一貫性**と**双方向同期の整合性**を、確立された UI ライブラリ (Mantine v8) で担保する
- 日付: 2026-07-15
- ステータス: Draft (ユーザー承認待ち)

---

## 1. スコープ

### In scope

| ファイル | 現状 | 移行先 |
| --- | --- | --- |
| `src/components/tiles/QuickTileCreate.tsx` | 3,117 行 / 8 useState / 8 useEffect | `@mantine/form` + Mantine 入力群で全面再構築 |
| `src/components/ui/form/FormPanel.tsx` | 15 行の wrapper | Mantine `Stack` を中身に持つ薄いラッパに |
| `src/components/ui/form/FormRow.tsx` | 35 行 (icon + content + trailing) | Mantine `Group` ベース・見た目は維持 |
| `src/components/ui/form/RowInput.tsx` | 自前 `<input>` | Mantine `TextInput` / `NumberInput` / `Textarea` |
| `src/components/ui/form/RowToggle.tsx` | 自前 switch | Mantine `Switch` |
| `src/components/ui/form/RowSegmented.tsx` | 自前 radio group | Mantine `SegmentedControl` |
| `src/components/ui/form/RowSubPanel.tsx` | chevron + clickable row | Mantine `UnstyledButton` + `Group` |
| `src/components/ui/form/FormDivider.tsx` | 1px 区切り | Mantine `Divider` |
| `src/components/ui/form/SectionHeader.tsx` | タイトル | そのまま (Mantine 未使用) または `Title order={4}` |

### Out of scope

- `src/components/tiles/editor/*` 配下 (AutomationPanel / AvailabilityPanel / CompletionPanel / RelationshipsPanel / RequiredTimePanel / SchedulePanel)
- ダッシュボードレイアウト (`src/app/dashboard/layout.tsx` 周辺) および他ページ
- 既存の Tailwind v4 設定 (`postcss.config.mjs` の `@tailwindcss/postcss` 行は残す)
- 既存のデザイントークン (`globals.css` の CSS 変数群)
- API / 状態管理バックエンド (`useExecutionEngine` 等)

---

## 2. 採用パッケージ (Mantine v8)

| パッケージ | 用途 | 備考 |
| --- | --- | --- |
| `@mantine/core@^8` | 入力 / Stack / Group / Drawer / Paper | App Router 対応 |
| `@mantine/hooks@^8` | `useDisclosure` 等 | 既存 `useState(true/false)` の整理 |
| `@mantine/form@^8` | `useForm` | 8 useState 統合 / validation |
| `@mantine/notifications@^8` | 作成成功・エラー通知 | 既存 `useToast` の置き換え候補 (任意) |
| `postcss-preset-mantine@^8` (dev) | Mantine 推奨 PostCSS プリセット | `postcss.config.mjs` に追記 |
| `postcss-simple-vars@^7` (dev) | Mantine が必要 | 同上 |

CSS ファイル import:
- `@mantine/core/styles.css` (root layout で 1 度だけ)

---

## 3. 統合アーキテクチャ

```
src/
├── app/
│   ├── layout.tsx          # + ColorSchemeScript, + <MantineProvider>
│   ├── globals.css         # 既存 CSS 変数はそのまま
│   └── providers.tsx       # 新規: MantineProvider + Theme 適用
├── lib/
│   └── theme/
│       ├── mantine-theme.ts        # createTheme() — colors.primaryShade / fontFamily / spacing
│       └── css-variables-resolver.ts # globals.css の --primary / --surface-* / --foreground を Mantine の var(--mantine-color-*) にマッピング
└── components/
    ├── ui/form/                  # Mantine ベースに置換
    └── tiles/QuickTileCreate.tsx # @mantine/form ベースに再構築
```

### 3.1 Theme (CSS 変数マッピング)

`globals.css` の既存トークンを崩さず、Mantine 内部の CSS 変数へ**読み替え**る。これにより:

- 既存 Tailwind (`bg-primary`, `text-foreground` 等) はそのまま機能
- Mantine 側 (`--mantine-color-text`, `--mantine-color-body` 等) も同値
- テーマ切替 (`.dark` / `.theme-gray` 等) も CSS 変数差分でそのまま効く

```ts
// src/lib/theme/css-variables-resolver.ts (抜粋)
import { CSSVariablesResolver, rem } from '@mantine/core';

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    '--mantine-primary-color-filled':       'var(--primary)',
    '--mantine-primary-color-filled-hover': 'var(--primary-hover)',
    '--mantine-color-text':                 'var(--foreground)',
    '--mantine-color-body':                 'var(--surface-0)',
    '--mantine-color-default-border':       'var(--border)',
    // ... 他のセマンティック変数
  },
  light: {},
  dark:  {},
});
```

### 3.2 useForm への統合

QuickTileCreate の 8 useState (label / note / project / duration / repeat / condition / scheduledDateTime / …) を **`useForm({ initialValues })`** に集約。フィールド間の派生値 (例: repeat=weekly なら weekdays[] を表示) は `form.watch()` ではなく **`form.getValues()`** を useEffect 内で参照する従来パターンを維持するか、derived state は **`useComputedStyle`-like な selector** ではなく React の `useMemo` で form.values 依存に再計算する。

- 双方向同期の不変条件 (例: 「recurring なら scheduledDateTime は必須」) は `validate` 関数に集約
- 8 useEffect のうち、**DOM 副作用でないもの (form state 反映)** は `useEffect` → Mantine form の **`onValuesChange` ハンドラ** に移動
- 8 useEffect のうち、**本物の DOM 副作用** (フォーカス管理, スクロール, イベント購読) は `useEffect` のまま

---

## 4. フォーム primitives の移行方針

**Props interface は変えない**。これにより:

- `FormPanel.test.tsx` / `RowSubPanel.test.tsx` 等は **className 文字列検証から DOM/aria 検証**に書き換えれば通る
- QuickTileCreate からの呼び出しは `import` 変更だけで済む

### 4.1 FormPanel → Mantine `Stack` ラッパ

```tsx
import { Stack } from '@mantine/core';
import { cn } from '@/lib/utils/cn';

export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <Stack data-testid="form-panel" gap="xs" p="md" className={cn('p-panel', className)}>
      {children}
    </Stack>
  );
}
```

テストは `data-testid="form-panel"` の存在と class に `p-panel` が含まれることを確認しているので両立可能。

### 4.2 FormRow → Mantine `Group` ベース

- 外枠は `min-h-row` (48px) を `Group h={48}` で維持
- icon / content / trailing の 3-カラム配置は `Group justify="space-between"` + 中身で flex-1
- 見た目を今と完全一致させるには globals.css の `.p-panel` / `.min-h-row` を残す必要あり (Tailwind v4 の utility として)

### 4.3 RowInput → Mantine `TextInput` / `NumberInput` / `Textarea`

- `variant="unstyled"` + 既存 CSS を当てて見た目を現状維持
- `data-testid` 互換のために `wrapperProps` 経由で設定
- `type="time"` / `type="date"` / `type="datetime-local"` については Mantine の **`TimeInput`** / **`DateInput`** / **`DateTimePicker`** (要 `@mantine/dates` + dayjs) も検討。スコープ最小化のため、まず**自前 `<input type=...>` を持たせるパス**で対応し、必要に応じて別 PR で `@mantine/dates` 追加

### 4.4 RowToggle → Mantine `Switch`

- Mantine `Switch` を `Group` 内に配置
- `placeholder` を `label` に渡す
- `on/off` で wrapper の色だけ CSS 変数経由で連動

### 4.5 RowSegmented → Mantine `SegmentedControl`

- 既存 options → `data={options}` に変換 (Mantine 形式)
- `compact` モードは `fullWidth={false}` + `styles.root` で対応
- `role="radiogroup"` / `aria-checked` は Mantine が自動付与

### 4.6 RowSubPanel → Mantine `UnstyledButton` + `Group`

- 中身は元のまま、ベースコンポーネントを `UnstyledButton` に変更
- フォーカスリングは Mantine の `FocusTrap` 経由

### 4.7 FormDivider → Mantine `Divider`

- `color={var(--border)}` で見た目を維持

---

## 5. QuickTileCreate 移行のサブタスク

| サブタスク | 内容 | 検証 |
| --- | --- | --- |
| 5.1 | useForm の `initialValues` を旧 useState から移植 | 起動時に既存 default と一致 |
| 5.2 | 8 useEffect を分類 (副作用 / form state 反映) | useEffect 数が減少 or 同等 |
| 5.3 | validation rule を `useForm.validate` に移植 | 重複必須条件 (recurring + scheduledDateTime 等) がカバー |
| 5.4 | サブコンポーネント (V4EssentialRow / TaskRowMenu / ConditionEditor / TermKindSegmented 等) を Mantine ベースに | 機能同等 |
| 5.5 | `globals.css` の `.duration-range` (dual range slider) は維持 — Mantine `RangeSlider` か要判断 | UX 同等 |
| 5.6 | 既存テスト (`QuickTileCreate.test.tsx` があれば) を `useForm` 経由に更新 | `bun run test` 緑 |

**判断ポイント**: `.duration-range` を Mantine `RangeSlider` に置き換えるかは要確認。Mantine 標準は単一 range なので dual range が必要な quick create 固有要件は残置が無難。

---

## 6. ロールバック

1. `package.json` から Mantine 関連削除 → `bun install`
2. `src/app/layout.tsx` から `<ColorSchemeScript>` / `<MantineProvider>` を取り除く
3. `src/components/ui/form/*.tsx` を git HEAD に復元
4. `QuickTileCreate.tsx` を git HEAD に復元
5. `postcss.config.mjs` から `mantine-postcss-preset` 行を取り除く

すべて小さく独立しているので、PR 単位で切り戻し可能。

---

## 7. 受け入れ条件

- [ ] `bun run check` (biome + eslint + tsc + vitest) 緑
- [ ] `bun run build:prod` 成功
- [ ] chrome-devtools MCP で `/dashboard/tasks` (または QuickTileCreate を開く導線) を開き、Create パネルが崩れていないことを目視確認
- [ ] パラメータ間の同期不変条件 (recurring → weekdays[]、conditionKind 切替でフィールド表示が変わる、等) が回帰していないことを実際の操作で確認
- [ ] 既存の form/ テスト (FormPanel / RowSubPanel 等) は props interface を変えない方針をテストファイル側で `className` 依存から `data-testid` / role / aria ベースに書き換え済み

---

## 8. タイムライン (目安)

| Day | 内容 |
| --- | --- |
| Day 1 | 5.0 / 5.1 / 5.2 (パッケージ導入 + providers + form primitives の置換) |
| Day 2 | 5.3 / 5.4 (useForm 統合 + サブコンポーネント置換) |
| Day 3 | 5.5 / 5.6 + 受け入れ確認 (dual range 残置判断 + テスト + ブラウザ確認) |
