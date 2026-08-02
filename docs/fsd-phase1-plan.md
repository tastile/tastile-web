# FSD Phase 1: shared/ レイヤー確立

## 概要

`src/components/ui/`, `src/lib/api/`, `src/lib/utils/`, `src/lib/i18n/`, `src/lib/domain/ids.ts` を `src/shared/` に移動し、FSD の共有レイヤーを構築する。

## 移動マッピング

| 現在 | 移動先 | ファイル数 | 影響度 |
|------|--------|-----------|--------|
| `src/components/ui/*` | `src/shared/ui/*` | 26 | 高 (27+ imports) |
| `src/lib/api/*` | `src/shared/api/*` | 29 | 高 (14+ imports) |
| `src/lib/utils/*` | `src/shared/lib/*` | 3 | 高 (27 imports on cn.ts) |
| `src/lib/i18n/*` | `src/shared/i18n/*` | 5 | 高 (24+ imports) |
| `src/lib/domain/ids.ts` | `src/shared/model/ids.ts` | 1 | 低 (domain内のみ) |

## 前提条件

- `@/*` → `./src/*` パスエイリアスが設定済み (tsconfig.json)
- 移動後も `@/shared/...` パスでインポート可能

## 実施手順

### Step 1: dead code 削除 (リスク: なし)

削除対象 (外部からインポートなし):
- `src/lib/api/index.ts` — legacy barrel (400行)
- `src/lib/api/events.ts` — index.ts 経由のみ再エクスポート
- `src/lib/api/tiles.ts` — 外部インポートなし

### Step 2: `src/shared/` ディレクトリ作成

```
src/shared/
├── ui/           # from components/ui/
├── api/          # from lib/api/
├── lib/          # from lib/utils/
├── i18n/         # from lib/i18n/
└── model/        # from lib/domain/ids.ts
```

### Step 3: ファイル移動

#### 3a: `components/ui/` → `shared/ui/`

移動対象:
- `Card.tsx`, `StatusDot.tsx`, `Input.tsx`, `BottomSheet.tsx`, `Dropdown.tsx`, `Empty.tsx`
- `form/` (7ファイル + index.ts)
- `floating-menu/` (1ファイル + index.ts)

新規 barrel 作成: `src/shared/ui/index.ts`
```typescript
export * from './Card'
export * from './StatusDot'
export * from './Input'
export * from './BottomSheet'
export * from './Dropdown'
export * from './Empty'
export * from './form'
export * from './floating-menu'
```

#### 3b: `lib/api/` → `shared/api/`

移動対象: 全ファイル (29個)
- `endpoints.ts`, `v1/` ディレクトリ丸ごと

barrel 更新: `src/shared/api/index.ts`
- dead code (`index.ts`, `events.ts`, `tiles.ts`) は削除済み
- `v1/index.ts` はそのまま移動

#### 3c: `lib/utils/` → `shared/lib/`

移動対象:
- `cn.ts`, `tile-formatters.ts`, `map-list-view-to-tile.ts`

新規 barrel 作成: `src/shared/lib/index.ts`
```typescript
export { cn } from './cn'
export { formatDuration, formatFriendlyDateTime } from './tile-formatters'
export { mapListViewToTile } from './map-list-view-to-tile'
```

#### 3d: `lib/i18n/` → `shared/i18n/`

移動対象:
- `use-translation.ts`, `translations.ts`, `server-translations.ts`, `marketing-dict.ts`

新規 barrel 作成: `src/shared/i18n/index.ts`
```typescript
export { useTranslation } from './use-translation'
export { translations } from './translations'
export { getHeaderTranslations, getFooterTranslations } from './server-translations'
export { getMarketingDict } from './marketing-dict'
export type { Lang, Dict, Locale } from './marketing-dict'
```

#### 3e: `lib/domain/ids.ts` → `shared/model/ids.ts`

移動対象:
- `ids.ts` のみ (TileId, EventId, CommandId, RequestId, SegmentId)

### Step 4: インポートパス更新

全ファイルの `@/components/ui/...` → `@/shared/ui/...` 変更
全ファイルの `@/lib/api/...` → `@/shared/api/...` 変更
全ファイルの `@/lib/utils/...` → `@/shared/lib/...` 変更
全ファイルの `@/lib/i18n/...` → `@/shared/i18n/...` 変更
`@/lib/domain/ids` → `@/shared/model/ids` 変更 (domain内のみ)

**影響ファイル数 (推定):**
- `components/ui/*` をインポート: ~8ファイル
- `lib/api/*` をインポート: ~20ファイル
- `lib/utils/cn` をインポート: 27ファイル
- `lib/i18n/*` をインポート: ~25ファイル
- 合計: ~50-60ファイル (重複あり)

### Step 5: barrel 不備修正

- `src/shared/ui/form/index.ts` に `RowToggle`, `RowSubPanel`, `RowInput` を追加
- `src/shared/api/v1/index.ts` に未再エクスポートを追加 (任意)

### Step 6: テスト実行

```bash
bun test
bun run build
bun run lint
```

## リスク評価

| リスク | 影響 | 対策 |
|--------|------|------|
| インポートパス変更の漏れ | ビルド失敗 | grep で全パス変更を検証 |
| barrel 不備 | 型エラー | 移動後に型チェック実行 |
| テスト失敗 | 回帰 | 段階的に移動 + テスト |

## 検証チェックリスト

- [ ] `bun run build` が成功する
- [ ] `bun test` が全テスト通過する
- [ ] `bun run lint` がエラーなし
- [ ] dead code が削除されている
- [ ] `src/shared/` に全ファイルが存在する
- [ ] 古いパス (`@/components/ui/`, `@/lib/api/` 等) が残っていない
