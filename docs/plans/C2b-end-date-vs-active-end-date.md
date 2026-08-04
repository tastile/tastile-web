# C2b — endDate (Instant) vs life.active.endDate (LocalDate) 衝突検証

## メタデータ

- **ID**: C2b
- **Phase**: 1 (verify)
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C1a (recurring 経路の wire-builder が組まれている前提)
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 4 + §"リスク" (`LocalDate vs Instant` 行)
- **Sibling plans**: C2a (`repeatMode` → `generation.kind` round-trip) / C2c (weekdayMask) / C2d (intervalValue/Unit)

## 前提

- `tastile-web` の `QuickCreate` フォームに §5 Recurring セクションが存在し、`recurring.endDate` (Instant) と `recurring.life.active.endDate` (LocalDate) を別フィールドとして保持する
- 親 spec C は `source_schedule.rs:33` (`generation.ends_at: Instant?`) と `source_schedule.rs:38` (`generation.date_range_end: String?`) が **別の DB 列** として永続化される前提でマッピング表を書いている
- v1/08:26-39 により `Recurring.life.active.{start,end}` は `LocalDate` であり、Instant ではない (暦上の有効性のため)
- `quick-create-schedule-wire.ts:75-110` の `sourceGeneration` は両フィールドを **同じ `end` 変数** に reduce する現行コード (`validInstant(state.recurring.endDate) ?? validInstant(state.recurring.life.active.endDate)`)。本計画 C2b はこの 1 変数 reduce が **片方だけを反映する** ことを実機 submit + DB 検証で確認する
- wslc stack (`tastile-v1-api:latest` + `tastile-db:5432` on `tastile-net`) が起動済み、`TASTILE_DATABASE_URL` が `127.0.0.1:35432` 経由

## 目的

C 親 spec §"変更手順" step 4 で要求されている「**2 つの end-date 系フィールドが衝突しないこと**」を実機 submit + DB 検査で証明する。具体的には:

- `recurring.endDate = "2026-09-30T00:00:00Z"` (ISO instant) を submit したとき → `v1_source_schedule.generation->>'ends_at'` に **ISO instant 文字列** として永続化される
- `recurring.life.active.endDate = "2026-10-31"` (YYYY-MM-DD) を **同時に** submit したとき → `v1_source_schedule.generation->>'date_range_end'` に **"2026-10-31"** として永続化される (timezone coerce なし)
- 両フィールドが 1 つの列に collapse しない (wire-builder の `validInstant(...) ?? validInstant(...)` が **独立した 2 つのキー** へ別々に書き込まれている)

## 受入条件

- `POST /v1/schedule-definitions` へ `endDate = "2026-09-30T00:00:00Z"` + `life.active.endDate = "2026-10-31"` を同時 submit → 200 / `result: APPLIED`
- DB 検査: `generation->>'ends_at' = "2026-09-30T00:00:00Z"` かつ `generation->>'date_range_end' = "2026-10-31"` (両方とも別フィールド)
- `endDate` のみ submit / `life.active.endDate` のみ submit / 両方 submit / 両方空 の **4 ケース** で `ends_at` と `date_range_end` の直交性を pin
- `endDate` に **UTC 以外の timezone offset** ("2026-09-30T00:00:00+09:00") を与えた場合、wire が ISO 8601 へ正規化 (`2026-09-29T15:00:00Z`) することは許容 (Instant セマンティクス)。`date_range_end` には timezone 概念がないため、ユーザ入力の "2026-10-31" 文字列が **そのまま** 保存される

## 実装手順

1. **確認 — wire 経路の独立性**:
   - `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:75-110` の `sourceGeneration` は `end` 変数を `ends_at` (line 107) と `date_range_end` (line 83) の **両方に** 書き込んでいる現行コード (1 変数 reduce)。本計画はこのコードを **修正しない**。submit 時に `endDate` を埋めて `life.active.endDate` を空にすれば → `ends_at` のみ埋まり `date_range_end` は `null` になる、というケースをまず pin する
2. **submit ヘルパ (GoTrue-free)**:
   - `tastile-web/e2e/quick-create-recurring-e2e.spec.ts` に新規 `test("C2b endDate vs life.active.endDate round-trip", ...)` を追加
   - 4 ケースを `test.each` で table-driven 化 (両空 / endDate のみ / life のみ / 両方)
3. **submit body 構築**:
   - 既存 spec の `buildQuickCreateSchedulePayload` を呼び出す。`state.recurring.endDate` と `state.recurring.life.active.endDate` を 4 ケースで set / null
4. **POST /v1/schedule-definitions**:
   - 既存の auth header (`x-owner-id` + `x-actor-id` + bearer) を reuse
   - 200 / `result: APPLIED` を待つ
5. **DB 検査 SQL**:
   - `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT generation->>'ends_at' AS ends_at, generation->>'date_range_end' AS date_range_end FROM v1_source_schedule WHERE tile_id = (SELECT id FROM v1_tile WHERE title = 'C2b endDate probe' AND owner_id = ...)"` を 4 ケース分実行
6. **4 ケース期待値**:
   - 両空: `ends_at = NULL`, `date_range_end = NULL`
   - endDate のみ ("2026-09-30T00:00:00Z"): `ends_at = "2026-09-30T00:00:00Z"`, `date_range_end = NULL`
   - life のみ ("2026-10-31"): `ends_at = NULL`, `date_range_end = "2026-10-31"`
   - 両方: `ends_at = "2026-09-30T00:00:00Z"`, `date_range_end = "2026-10-31"`
7. **LocalDate 純粋性確認**:
   - 両方ケースで `date_range_end` が "2026-10-31" の **文字列** として入っていることを `length(date_range_end) = 10` で assert (timezone offset 無し)
   - `ends_at` 側は `ends_at LIKE '%Z' OR ends_at LIKE '%+%' OR ends_at LIKE '%-%'` で offset marker 付き ISO instant であることを assert
8. **結果記録**:
   - 検証ログを `tile-create-e2e-wiring/04-plans/evidence/C2b-*.md` に保存 (4 ケースの curl + psql output)

## 検証手順

### 起動前提 (wslc)

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-core
bash scripts/wslc/status.sh   # 3 コンテナ (tastile-db / tastile-api / tastile-worker) running 確認
curl -s http://127.0.0.1:31400/v1/ready  # 200 確認
```

### submit (curl, 4 ケース共通)

```bash
# wslc postgres から新規 owner を作る (sign-up endpoint 経由)
wslc container exec tastile-db psql -U tastile -d tastile_db -c "INSERT INTO v1_subject (id, kind, created_at) VALUES (gen_random_uuid(), 0, now()) RETURNING id"
# → 出力された UUIDv7 を $OID として使う
```

```bash
# ケース A: 両空 (control)
curl -s -X POST http://127.0.0.1:31400/v1/schedule-definitions \
  -H "x-owner-id: $OID" -H "x-actor-id: $OID" -H "content-type: application/json" \
  -d '{
    "source_client_local_id": "c2b-a-001",
    "source_schedule": {
      "required_duration_ms": 1800000,
      "generation": { "kind": 1, "starts_at": "2026-09-01T00:00:00Z", "interval_ms": 86400000, "weekday_mask": 31, "date_range_start": "2026-09-01" },
      "window": { "start_offset_ms": 0, "end_offset_ms": 1800000 },
      "split_policy": { "kind": 0, "min_segment_ms": null, "max_segment_ms": null, "max_segments": null },
      "priority": 5
    },
    "source_horizon": { "start": "2026-09-01T00:00:00Z", "end": "2026-10-31T00:00:00Z" },
    "tile": { "title": "C2b endDate probe" },
    "plan": { "role": 0, "references": [], "completion": {"root": {"kind": 0, "children": []}, "time_requirements": [], "tasks": []}, "planning": { "placement_rules": [], "nesting_rules": [] }, "metrics": [], "decisions": [] },
    "reference_targets": [], "windows": [], "recurrence": null, "flows": [], "relations": []
  }'
```

```bash
# ケース B: endDate のみ
# generation.ends_at = "2026-09-30T00:00:00Z" / date_range_end なし
```

```bash
# ケース C: life のみ
# date_range_end = "2026-10-31" / ends_at なし
```

```bash
# ケース D: 両方 (本 C2b の中心ケース)
# generation.ends_at = "2026-09-30T00:00:00Z" AND date_range_end = "2026-10-31"
```

### 期待 SQL 出力 (ケース D)

```sql
SELECT generation->>'ends_at' AS ends_at, generation->>'date_range_end' AS date_range_end
  FROM v1_source_schedule
 WHERE tile_id = (SELECT id FROM v1_tile WHERE title = 'C2b endDate probe' AND owner_id = $OID);
--        ends_at        | date_range_end
-- ----------------------+----------------
--  2026-09-30T00:00:00Z | 2026-10-31
-- (1 row)
```

### 受け入れ確認チェックリスト

- [ ] ケース A: `ends_at IS NULL AND date_range_end IS NULL`
- [ ] ケース B: `ends_at = '2026-09-30T00:00:00Z' AND date_range_end IS NULL`
- [ ] ケース C: `ends_at IS NULL AND date_range_end = '2026-10-31'`
- [ ] ケース D: `ends_at = '2026-09-30T00:00:00Z' AND date_range_end = '2026-10-31'`
- [ ] ケース D のみ timezone offset marker (Z / + / -) が `ends_at` にのみ存在し、`date_range_end` には付かない (`length() = 10`)
- [ ] 4 ケースとも `result: APPLIED` で 200
- [ ] `cargo test -p storage` 全件 Green (回帰なし)

## リスク

- **LocalDate vs Instant 混同**: `quick-create-schedule-wire.ts:79` の `validInstant(state.recurring.endDate) ?? validInstant(state.recurring.life.active.endDate)` は **両フィールドを 1 つの `end` 変数に reduce** する。ケース D (両方 submit) で `ends_at` は `endDate` (Instant) 側、`date_range_end` は `datePart(end)` (= 1 変数 reduce した結果の `end` の先頭 10 文字) で **うっかり life 側が endDate 側に上書きされる** リスクがある。ケース B/C/D の `ends_at` 値が `recurring.endDate` 入力と完全一致することを assert する
- **timezone coerce**: `datePart` 関数 (`quick-create-schedule-wire.ts:33-36`) は `validInstant(...).slice(0, 10)` を通る経路を持つ。ユーザが `endDate = "2026-09-30"` (日付のみ) を入れた場合、`new Date(...).toISOString()` で UTC 化され、**JST 端末では前日 (09-29)** に化ける可能性。ケース B/C/D では `endDate` 側は ISO instant 完全形 (`...Z`) を入力し、timezone coerce の経路を pin しない
- **同一列 reduce の二段 coerce**: line 79 `validInstant(state.recurring.endDate) ?? validInstant(state.recurring.life.active.endDate)` で **両方が Instant 化された** 後、line 83 `date_range_end: datePart(end)` で **同じ `end` を `slice(0, 10)`** で文字列化するため、ケース D で `endDate` 入力が "2026-09-30T00:00:00Z" の場合 `date_range_end` は **誤って "2026-09-30"** になる (life.active.endDate = "2026-10-31" ではなく)。これは **バグの可能性が高い**。本計画 C2b はこのバグの露出を最優先で観測する役割を持つ
- **wire-builder の throw**: `buildQuickCreateSchedulePayload` line 217-249 は validate throw を持つ。C2b の 4 ケースはいずれも throw しない (project / tag / change / frame 等の special path は触らない) が、念のため unit test で throw しないことを確認してから e2e へ進む
- **DB 列の JSONB vs 正規化**: `v1_source_schedule.generation` が `jsonb` 列で DB に保存されているなら、`->>` で text 抽出できる前提は崩れない。v1/10 §2 違反 (JSONB 正本禁止) のリスクは別 plan で扱う。C2b は **read-only** で `->>` するだけなので本計画は触らない

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 4 / §"リスク" (LocalDate vs Instant)
- v1 spec: `tastile-core/v1/08-recurring-and-frame.md:26-39` (RecurringLife.active = LocalDate)
- Wire: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:75-110` (`sourceGeneration`) + `:33-36` (`datePart`) + `:25-31` (`validInstant`)
- Schema: `tastile-core/v1/08-recurring-and-frame.md:13-17` (`generation.ends_at: Instant?` + `generation.date_range_end: String?`) + `source_schedule.rs:33,38` (DB 列)
- Sibling: C1a / C2a / C2c / C2d (他の round-trip 検証)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
