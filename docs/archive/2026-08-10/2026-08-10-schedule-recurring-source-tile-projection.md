# Schedule `?view=recurring` SourceTile projection

> **Goal:** `/dashboard/schedule?view=recurring` が空で表示される症状を解消する。v1 で `Recurring` kind は `SourceTile` (kind=3) + `generation_kind=1` (RECURRING) に置き換え済み — UI 側が legacy `RecurringTemplateListItem` 形状を期待したまま取り残されているのが根本原因。

## 問題

`ScheduleMain.tsx:23` → `useRecurringTemplates()` (`src/shared/hooks/use-recurring-templates.ts`) は内部で `listRecurringTiles` endpoint (`src/shared/api/endpoints.ts:255`) を呼ぶ。これは legacy パス `/commands/recurring-tile` で、`path-map.ts:18` が silent rewrite で `/v1/tiles` に置換する。**response 形状が一致しない**ため `t.recurrence` が常に `undefined` → `ScheduleMain.tsx:208` の `.reduce((acc, t) => { if (t?.recurrence) acc.push(t); return acc; }, [])` が常に空配列を返し "No recurring templates found" alert が出る。

実機の `GET /v1/tiles` response (`x-tastile-web-bridge-secret` 経由で確認済) には `休憩` / `睡眠` の recurring データが **必ず居る** が、それらは `recurrence` ではなく `source: { generation_kind: 1, weekday_mask, window_start_offset_ms, window_end_offset_ms, required_duration_ms, ... }` フィールドに乗っている (v1/02 §SourceTile, `v1/HARNESS.md` 数値定数表 `SourceGenerationKind.RECURRING = 1`)。

## 触るファイル

| File | Change |
|---|---|
| `src/shared/hooks/use-recurring-templates.ts` | endpoint を `listRecurringTiles` → `getTiles` (既存 `useTileList` と同じ wire) に切替。response を `source != null && source.generation_kind === 1` で filter。`TileListView` の `source` フィールドを既存の `RecurringTemplateListItem` 形に project する内部 mapper を追加 |
| `src/features/manage-schedule/ui/ScheduleMain.tsx` | `describeGenerator()` (line 275-288) で `phases` / `step_min` 分岐を撤去し v1 source-tile の意味論 (`generation_kind=1` なら "Recurring" + `window_start/end_offset_min` の range) へ縮退。`note` フィールドは source-tile に存在しないので line 226-230 の note 行は条件付きレンダ化 (`template.note` truthy 時のみ)。`Map<template>` shape は維持 |

## 触らないファイル

- `src/shared/api/endpoints.ts` — `listRecurringTiles` の entry は legacy 互換のため残置 (他 consumer が居るかは grep で確認するが見当たらない)。`useRecurringTemplates` が新規 endpoint を叩かなくなるだけなので route の削除は将来別 PR で sweep
- `src/shared/api/v1/path-map.ts` — `/commands/recurring-tile → /v1/tiles` の rewrite は維持。`useTileList` が同じ経路を使うので無害
- backend (tastile-core) 側 — frontend projection のみで完結。`SourceGenerationKind.RECURRING` registry も既に backend に存在 (`v1/HARNESS.md` 数値定数表)

## Project shape mapping

`TileListView.source` → `RecurringTemplateListItem.recurrence`:

| UI shape field | source 由来 | 計算 |
|---|---|---|
| `recurrence.generator.step_min` | `required_duration_ms` | `Math.round(required_duration_ms / 60_000)` — single placement duration (best-effort; v1 source-tile に独立した cadence フィールドなし) |
| `recurrence.generator.focus_block_based` | — | undefined (v1 に相当概念なし) |
| `recurrence.window.weekday_mask` | `source.weekday_mask` | `?? 0` |
| `recurrence.window.start_offset_min` | `source.window_start_offset_ms` | `Math.round(window_start_offset_ms / 60_000)` |
| `recurrence.window.end_offset_min` | `source.window_end_offset_ms` | `Math.round(window_end_offset_ms / 60_000)` |
| `recurrence.selector.expression` | — | `null` (v1 に相当概念なし) |
| `note` | — | `""` (source-tile に存在しない field) |

v1/10 §2 整合: すべて smallint / `i64` → `i32` への数値変換のみ。文字列 carrier 追加なし。

## 検証 (実機 wslc + daemon)

1. **Unit**: `bunx vitest run src/shared/hooks/use-recurring-templates` — 新規 mapper を MSW 風に直接 test (test 追加の場合は `use-tile-list` 既存 test と並列に 1 件追加)
2. **Type check**: `bun run typecheck` clean
3. **Lint**: `bun run check` clean (biome + eslint + knip + vitest)
4. **Live browser**: `bun dev` 起動 → chrome-devtools MCP で `http://localhost:3000/dashboard/schedule?view=recurring` を開く → "休憩" / "睡眠" がテンプレート行として表示されること + window range (`HH:MM-HH:MM`) が tile window と一致することを目視
5. **Network**: chrome-devtools MCP の network panel で `/api/proxy/v1/tiles` リクエストを capture → response に `source.generation_kind === 1` の row が含まれ、それが UI のレンダリング数と一致することを確認
6. **Regression**: `ScheduleMain.tsx:23` の `useRecurringTemplates()` を `useTileList({ viewMode: "recurring", ... })` に切替えた場合の既存 `view=placements` / `view=upcoming` (default) 動作への回帰が無いことを手動確認

## ロールバック

- `use-recurring-templates.ts` を git HEAD に復元
- `ScheduleMain.tsx` の `describeGenerator` / note 行を復元
- `useRecurringTemplates` を呼ぶのは `ScheduleMain.tsx` の 1 箇所のみ (grep 確認済) なので影響範囲は限定的

## 既知の follow-up (スコープ外)

- `endpoints.ts:255-277` の `listRecurringTiles` / `getRecurringTile` / `putRecurringTile` の sweep (他 consumer 0 確認済)。legacy path-map も同タイミングで削除可能
- `describeGenerator` が将来的に v1 source-tile の `split_kind`, `priority`, `external_id` を表示したくなったら別 PR で拡張
- `/v1/source-tiles?generation_kind=1` の query filter を backend に追加するのは別 PR (現状の `/v1/tiles` 全件 fetch + client filter で十分)

## 関連 (正本参照)

- v1/02-core-entities.md §SourceTile
- v1/HARNESS.md 数値定数表 (`SourceGenerationKind.RECURRING = 1`)
- HARNESS.md §5 "list_tiles UNION with v1_source_tile — 2026-07-23" (response 形状の正本)
- `src/lib/api/v1/openapi-generated.d.ts:1187-1208` (`SourceTileSummary`) / `:1311-1341` (`TileListView`)