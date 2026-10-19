# C3b — excludedDates ラウンドトリップ & 配置スキップ検証

## メタデータ

- **ID**: C3b
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C3a
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"変更手順" step 5
- **Sibling plans**: C3a (weekdayMask ラウンドトリップ), C3c (offsetMin JST 検証)

## 前提

- C3a が完了しており、`v1_source_schedule` への POST 経路（`POST /v1/schedule-definitions`）が稼働している
- `tastile-core.wslc` 上で daemon が起動済みで、Postgres に `v1_source_schedule` および `v1_placement` テーブルが存在する
- ブリッジ認証（`x-tastile-web-session-user` → UUIDv5 owner）が C3a で成立している
- QuickCreate UI から §5 Recurring + §5 Source パネルを埋めて submit できる状態（`dashboard/layout-client.tsx:79` のキーボードショートカットで QuickCreate 起動）

## 目的

`source.excludedDates`（YYYY-MM-DD 配列）が `generation.excluded_dates` フィールドに正しくシリアライズされ、core 側で該当日が `v1_placement` から除外されることを e2e で確認する。JST ローカルタイムのドリフトやフォーマット差異で「除外されるべき日が placement として生成される」事故を検出する。

## 受入条件

- QuickCreate §5 Source の `excludedDates` に次の日曜日（YYYY-MM-DD）を 1 件入れた daily 14 日間タイルを submit できる
- DB の `v1_source_schedule.generation->'excluded_dates'` が JSONB 配列として投入日の YYYY-MM-DD を含む
- `v1_placement` の件数が「14 日 - 1 除外日 = 13 件」と一致する（同一 `source_schedule_id` 配下）

## 実装手順

1. **wire 経路の特定**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:84` で `excluded_dates: state.source.excludedDates` が `generation` オブジェクトへ直接代入されていることを確認。型は `Vec<String>`（`tastile-core/crates/v1/api/src/source_schedule.rs:40`）。
2. **UI 入力経路の確保**: `tastile-web/src/shared/stores/quick-create-store.ts` の `source` スライスが `excludedDates: string[]` を持つことを確認。なければ C3a と並行で `string[]`（`YYYY-MM-DD`）を追加。
3. **submit スクリプト準備**: `tastile-web/e2e/quick-create-excluded-dates-e2e.spec.ts` を新規作成。次の日曜日を `nextSundayISO()` ヘルパーで算出し、QuickCreate の該当フィールドへ入力 → submit → 成功トーストを待つ。
4. **ブリッジ所有者 UUID 取得**: 既存 C3a テストと同じ fixture を使用（`subject_kind::USER` の v1_subject が事前 provisioning 済み）。`x-tastile-web-session-user` ヘッダの UUIDv5 ハッシュを再利用。
5. **submit payload の組み立て**: 既存の `buildQuickCreateSchedulePayload`（`quick-create-schedule-wire.ts:213-450`）が `state.source.excludedDates` をそのまま `generation.excluded_dates` に乗せる挙動を C3a のスナップショットで固定。submission 時に `repeatMode: "interval"`（daily）、`intervalValue: 1, intervalUnit: "day"`、`life.active.startDate: today`、`life.active.endDate: today + 14`、`excludedDates: [nextSundayISO]` を投入。
6. **POST 実行**: `POST /v1/schedule-definitions`（ブリッジ経由）で送信。401/422 が出たら C3a で green だった経路と同じ条件で再送。
7. **DB 検査（JSONB 含有）**: `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT generation->'excluded_dates' FROM v1_source_schedule WHERE id='<submitted-uuid>'"` を実行。期待値：`["<nextSundayISO>"]` 相当の JSONB 配列。
8. **DB 検査（placement カウント）**: `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT count(*) FROM v1_placement WHERE source_schedule_id='<submitted-uuid>'"` を実行。期待値：`13`（14 daily - 1 excluded）。

## 検証手順

```bash
# 1. テスト実行（Playwright）
cd tastile-web
bun test:e2e e2e/quick-create-excluded-dates-e2e.spec.ts
# 期待: 1 passed (submit 成功 + toJSON で除外日を確認)

# 2. DB JSONB 含有確認
wslc container exec tastile-db psql -U tastile -d tastile_db -At \
  -c "SELECT generation->'excluded_dates' FROM v1_source_schedule \
      WHERE generation->'excluded_dates' IS NOT NULL \
      ORDER BY created_at DESC LIMIT 1"
# 期待: [<nextSundayISO>] （例: ["2026-08-09"]）

# 3. placement 件数確認
SUB_UUID=<submitした source_schedule の UUID>
wslc container exec tastile-db psql -U tastile -d tastile_db -At \
  -c "SELECT count(*) FROM v1_placement WHERE source_schedule_id='${SUB_UUID}'"
# 期待: 13

# 4. 除外日が本当にスキップされているか（配置 start_at 比較）
wslc container exec tastile-db psql -U tastile -d tastile_db -At \
  -c "SELECT count(*) FROM v1_placement \
      WHERE source_schedule_id='${SUB_UUID}' \
        AND (start_at AT TIME ZONE 'Asia/Tokyo')::date = '${NEXT_SUNDAY}'"
# 期待: 0
```

## リスク

- **タイムゾーンドリフト**: wire 側（`quick-create-schedule-wire.ts:84`）は `state.source.excludedDates` をそのまま文字列で渡すが、core 側の placement 生成は JST ではなく UTC で行われている可能性。`start_at` を `AT TIME ZONE 'Asia/Tokyo'` で評価して `YYYY-MM-DD` に丸めた結果と除外日が一致しない場合、配置が残る（または意図しない日が落ちる）。`source_schedule.rs:40` が `Vec<String>` で受け、placement 生成ループ内で `LocalDate` パースしているか確認。
- **フォーマット不一致**: UI 入力が `YYYY-MM-DD` でも、内部で `Date.parse` → `toISOString()` が走り `2026-08-09T00:00:00.000Z` に変換されていれば除外一致判定が壊れる。`quick-create-schedule-wire.ts:33-36` の `datePart()` を経由せず代入されている現状の挙動を維持するか、明示的に `datePart` を通すかを C3a の wire スナップショットで再確認。
- **daily vs weekdayMask の二重フィルタ**: daily 14 日間なので weekdayMask は不要（0 または全曜日）。`excludedDates` だけがスキップ判定を駆動する設計か、weekdayMask との AND 条件で除外が効かない実装になっていないかを確認。
- **submit 前の client-side validation**: `quick-create-schedule-wire.ts:217-258` の事前 throw 群に `excludedDates` バリデーションはないが、過去日付を弾く／未来日付のみ許可する仕様が後付けで入った場合に該当日が silent drop されるリスク。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 5 / §"e2e 検証" step 7
- Wire file: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:75-110`（`sourceGeneration`）/ `:84`（`excluded_dates` 直代入）
- Domain field: `tastile-core/crates/v1/api/src/source_schedule.rs:40`（`excluded_dates: Vec<String>`）
- Sibling plan: `tile-create-e2e-wiring/04-plans/C3a-weekdaymask-roundtrip.md`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
