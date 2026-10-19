# B1b — §3 Time in Range モードの source_horizon 永続化検証

## メタデータ

- **ID**: B1b
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: B (Time + Windows)
- **Depends on**: B1a (§3 OneTime モードで `baseline_start` / `baseline_end` が両方 NON-NULL で `v1_placement` に到達)
- **Source spec**: `04-sub-projects/B-time-windows.md` "変更手順" step 2
- **Sibling plans**: B1a (OneTime), B2 (Windows), B3 (Duration-only), B4 (Reference)

## 前提

- B1a が完了していること: `time.span.{start,end}` 入力 → `source_horizon.{start,end}` → `v1_placement.baseline_{start,end}` の経路が e2e で確認済み
- `quick-create-schedule-wire.ts` の `authoredInstant()` (`:47-64`) が `time.span.{start,end}` を ISO に正規化する挙動を確認済み
- `publishScheduleDefinition()` (`schedule-definition.ts:212-249`) が `POST /v1/schedule-definitions` に `source_horizon.{start,end}` を載せることを確認済み
- G サブプロジェクトの `wslc up-v1.sh` で daemon と DB が稼働中
- `e2e/helpers/v1.ts` の TRUNCATE が `v1_tile, v1_annotation, v1_placement` を対象にしている
- `time.whenMode === "range"` で `time.span.start` と `time.span.end` の両方が日付文字列 (`YYYY-MM-DD`) で入力される

## 目的

§3 Time セクションの `whenMode="range"` 経路で、`time.span.{start,end}` に入力された **範囲** が `source_horizon.{start,end}` と `v1_placement.baseline_{start,end}` に同じ値で到達することを e2e + DB 観測で証明する。Range 入力が instant 入力に誤変換されないこと、start と end が入れ替わらないこと、欠落しないことを保証する。

## 受入条件

- `whenMode="range"` + `time.span.start="2026-09-01"` + `time.span.end="2026-09-07"` で Submit した場合、`v1_placement` 行が 1 件作成され `baseline_start = 2026-09-01T00:00:00+00:00`、`baseline_end = 2026-09-07T00:00:00+00:00` (または `T23:59:59`) で永続化される
- `source_horizon.start` と `source_horizon.end` が `baseline_start` / `baseline_end` とそれぞれ同じ値を返す（読み戻し経路で差分なし）
- Wire (`quick-create-schedule-wire.ts:341`) が `source_horizon: { start, end }` を発行し、両フィールドが UI の `time.span.{start,end}` から導出される（`null` フォールバック `+90 day` 経路に落ちない）

## 実装手順

1. **e2e スペック追加**:
   - `tastile-web/e2e/quick-tile-create-e2e.spec.ts` に新規 test `range-mode QuickCreate persists both bounds as a placement row` を追加。
   - B1a と同じ `TRUNCATE` → dashboard 起動 → QuickCreate 起動 → submit のシーケンスを踏襲。

2. **QuickCreate UI 操作** (range ケース):
   - タイトル: `B1b range test`
   - `time.whenMode` を `"range"` に切替
   - `time.span.start = "2026-09-01"`
   - `time.span.end = "2026-09-07"`
   - Submit

3. **Wire payload 観測** (Playwright `page.on('request')`):
   - `POST /v1/schedule-definitions` の body を capture
   - 検証:
     - `payload.source_horizon.start` が `2026-09-01T00:00:00.000Z` (UTC 正規化後)
     - `payload.source_horizon.end` が `2026-09-07T00:00:00.000Z` または `T23:59:59.999Z` (`authoredInstant` `:47-64` の境界条件に依存)
     - `payload.source_horizon` が `null` でないこと（`buildQuickCreateSchedulePayload` `:341` で常にセット）
     - `payload.source_schedule.generation.kind` が `0` (OneTime) で `at = source_horizon.start`

4. **DB 観測** (`wslc container exec`):
   - `psql -U tastile -d tastile_db -c "SELECT id, baseline_start, baseline_end FROM v1_placement ORDER BY id DESC LIMIT 1"`
   - 期待:
     - 1 行
     - `baseline_start = 2026-09-01T00:00:00+00:00`
     - `baseline_end = 2026-09-07T00:00:00+00:00` または `T23:59:59+00:00`

5. **読み戻し経路の検証** (`GET /v1/placements/:id`):
   - 直前で挿入した `v1_placement.id` を使い `getRead(client, "/v1/placements/" + id)`
   - レスポンスの `baseline.start` / `baseline.end` が DB の `baseline_start` / `baseline_end` と一致
   - これにより wire の `source_horizon` と DB の `baseline_*` の値が **同じ範囲** で往復することが証明される

6. **境界条件ハンドリングの確認**:
   - `authoredInstant(state, "end")` (`wire:47-64`) は `time.timeOfDayMode === "range"` 時に `time.timeOfDayEnd || "23:59"` を後置する
   - range モード + `timeOfDayMode="none"` (デフォルト) では `end = "23:59"` が後置される
   - spec に「end は T23:59:59 または T00:00:00 のいずれか; 実装は `authoredInstant` のロジックに従う」と明記

7. **アサーション追加** (`e2e/quick-tile-create-e2e.spec.ts`):
   - DB クエリの結果と UI 入力の一致を `expect(dbRow.baseline_start).toBe("2026-09-01T00:00:00+00:00")` 形式で担保
   - `expect(dbRow.baseline_end).toMatch(/2026-09-07T(00:00:00|23:59:59)/)` で end の境界揺れを許容

## 検証手順

### 1. Wire payload 検証

```bash
# dev サーバ起動 + Playwright test 実行
cd tastile-web
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts -t "range-mode"
```

期待ログ:

```
[wire-capture] payload.source_horizon.start = 2026-09-01T00:00:00.000Z
[wire-capture] payload.source_horizon.end   = 2026-09-07T23:59:59.999Z
[wire-capture] payload.source_horizon !== null
[wire-capture] generation.kind = 0, generation.at = 2026-09-01T00:00:00.000Z
```

### 2. DB 観測

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -c "
  SELECT id, baseline_start, baseline_end
  FROM v1_placement
  ORDER BY id DESC
  LIMIT 1
"
```

期待:

```
                  id                  |     baseline_start      |       baseline_end
--------------------------------------+-------------------------+-------------------------
 0190f5e2-... (B1b range test row)   | 2026-09-01 00:00:00+00  | 2026-09-07 23:59:59+00
```

### 3. 読み戻し一致確認

```bash
curl -s -H "Authorization: Bearer $JWT" \
  http://localhost:31400/v1/placements/0190f5e2-... | jq '.baseline'
```

期待:

```json
{
  "start": "2026-09-01T00:00:00+00:00",
  "end": "2026-09-07T23:59:59+00:00"
}
```

### 4. Wire と DB の一致

- `wire.source_horizon.start` (ISO) ↔ `db.baseline_start` (timestamp)
- `wire.source_horizon.end` (ISO) ↔ `db.baseline_end` (timestamp)
- 両者が秒精度で一致すれば「同じ範囲」が往復している

## リスク

- **range vs instant 混同**: `authoredInstant` (`wire:47-64`) は `time.span[boundary]` が `YYYY-MM-DD` のとき `timeOfDayMode="range"` の場合のみ time-of-day を後置する。`whenMode="range"` でも `timeOfDayMode` がデフォルトの `"none"` だと `end = "23:59"` が後置され、9/7 23:59 が end になる — UI で「9/7 丸一日」と「9/7 00:00 開始」を区別したい場合は `timeOfDayMode` も明示する必要あり。本 B1b は `timeOfDayMode` を `"none"` のまま固定し、end 値が `T23:59:59` になることを許容する。
- **タイムゾーン変換**: `authoredInstant` (`wire:62-63`) は `new Date("2026-09-01T00:00:00")` を **local time** として解釈し `.toISOString()` で UTC に変換する。CI (UTC) と dev (JST) で end 値の "23:59" が "14:59Z" と "23:59Z" に変わる可能性。spec では「ローカル TZ で 23:59 と解釈される」と明記し、テストは `toMatch` で日付部分のみ検証する。
- **`source_horizon` の 90-day fallback 経路**: `buildQuickCreateSchedulePayload` (`wire:298-307`) は `authoredInstant(state, "end")` が null のとき `horizonStart + 90 day` をフォールバックする。range ケースで `time.span.end` が空だとフォールバックが走り、UI の意図 (9/7 まで) と乖離する。spec の前提に「両フィールド必須」を記載してフォールバック発火を防止。
- **`source_schedule.generation.kind` の選択**: `sourceGeneration` (`wire:75-110`) は `repeatMode="once"` で `kind: 0` (OneTime) + `at: start` を選ぶ。range モードでも `repeatMode="once"` を維持すれば `generation.at = horizonStart` で意図と一致する。UI で `whenMode` と `repeatMode` を独立に持つ場合は、e2e で `repeatMode="once"` を明示する必要あり。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md` (変更手順 step 2)
- Wire builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts`
  - `authoredInstant()` `:47-64` — range 時の end 境界ロジック
  - `sourceGeneration()` `:75-110` — generation.kind 選択
  - `buildQuickCreateSchedulePayload()` `:298-307` — horizon 90-day フォールバック
  - `buildQuickCreateSchedulePayload()` `:341` — `source_horizon` 出力
- Schedule definition: `tastile-web/src/shared/api/v1/schedule-definition.ts`
  - `PublishScheduleDefinitionPayload.source_horizon` `:82`
  - `publishScheduleDefinition()` `:212-249`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plan: `tile-create-e2e-wiring/04-plans/B1a-source-horizon-onetime.md`
