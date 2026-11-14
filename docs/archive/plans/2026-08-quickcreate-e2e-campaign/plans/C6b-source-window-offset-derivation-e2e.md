# C6b — SourceWindow.{start,end}_offset_ms span 派生 e2e

## メタデータ

- **ID**: C6b
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C6a
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"対象フィールド" (`window.start_offset_ms / end_offset_ms` 行)
- **Sibling plans**: C7a (既存 recurring spec wslc 化), C7b (recurring weekly e2e green), C6a (SourceWindow フィールドマッピング基本)

## 前提

- C6a (SourceSchedule の基本フィールド green) が完了しており、`POST /v1/schedule-definitions` で 200 が返る経路が稼働
- §3 Time パネルで `time.span.start` / `time.span.end` (RFC3339) を **明示的に** 入力できる状態 (B が完了済) — 暗黙 derive ではなく、QuickCreate の Time パネル UI に「開始」「終了」テキスト入力がある前提
- wslc 経由の core が起動しており、`v1_source_schedule` の `window` JSONB カラムに `SourceWindow` (`start_offset_ms: i64`, `end_offset_ms: i64`) が永続化される
- ブリッジ認証 (C3a で `x-tastile-web-session-user` → UUIDv5 owner) が成立

## 目的

`source_schedule.window.{start_offset_ms, end_offset_ms}` が wire-builder 経由で `time.span` (RFC3339 start/end) から **正しく派生** されることを e2e で確認する。期待派生:

```
start_offset_ms = 0                       // span 開始時点を anchor とする
end_offset_ms   = durationMinMax.duration // span 長さ = 配置の必要時間
```

`SourceWindow` (`source_schedule.rs:103-108`) のセマンティクスは「`Availability envelope relative to an occurrence's nominal instant`」= 各 occurrence 起点から ±方向に取る「利用可能幅」。span=09:00-10:00 を渡すと「09:00 配置の occurrence に対し、09:00 から 60 min 利用できる」が表現されるべき。これを `start_offset_ms=0, end_offset_ms=3600000` で固定する。

## 受入条件

- QuickCreate §3 Time で span=`2026-08-03T09:00:00+09:00` 〜 `2026-08-03T10:00:00+09:00` (60 min)、`time.durationMinMax` 既定値を入れて submit → 200 OK
- DB の `v1_source_schedule.window->>'start_offset_ms'` = `0` (string)
- DB の `v1_source_schedule.window->>'end_offset_ms'` = `3600000` (string)
- 上記の値が `time.span` の差 (60 min = 3,600,000 ms) と一致
- 既存の `time.durationMinMax.duration` (= 60 min) を上書きしない (リグレッションなし)
- 他の SourceSchedule フィールド (kind, interval_ms, weekday_mask, etc.) 壊れない (C1〜C3d 共通のスモーク)

## 実装手順

1. **wire 経路の特定**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:112-117` の `sourceWindow(state, duration)` が `start_offset_ms: 0` を直書きし、`end_offset_ms: Math.max(duration, spanMs)` を返していることを確認。
   - 現コードは「`duration` と `spanMs` の長い方」を採用する実装。これは `duration=60min, span=60min` の通常ケースでは `3600000` が出るが、`duration=30min, span=60min` のように duration < span のケースでは `end_offset_ms=3600000` (= span 長さ) を返してしまい、本来の「availability 幅 = duration (必要時間)」と矛盾する場合がある
   - C6b の受入条件は「`end_offset_ms = duration` (必要時間)」で固定。`Math.max` は後段の C7* で個別扱い (例: duration 優先 / span 上限の policy) するため、C6b では wire を `end_offset_ms: duration` に直接書き換える
2. **QuickCreate UI からの入力経路**:
   - `tastile-web/src/shared/stores/quick-create-store.ts` の `time` スライスが `span: { start: string, end: string }` (RFC3339) を持つことを確認。なければ B 計画で `string` 型の 2 フィールドを追加
   - `time.durationMinMax: { min: number, max: number }` (分単位) を確認
3. **dev サーバ起動**:
   ```bash
   cd tastile-web
   bun dev
   ```
4. **chromium-devtools MCP で QuickCreate を起動**:
   - `http://localhost:3000/dashboard` を開く
   - キーボードショートカットで QuickCreate を表示 (`dashboard/layout-client.tsx:79` 参照)
5. **§3 Time パネルで以下を入力**:
   - `span.start` = `2026-08-03T09:00:00+09:00`
   - `span.end` = `2026-08-03T10:00:00+09:00`
   - `durationMinMax` = 既定 (30..60 min) — 単位は分、内部で `60 * 60 * 1000 = 3,600,000 ms`
6. **Submit**:
   - 成功 toast が出ることを確認
   - DevTools Network タブで `POST /api/proxy/v1/schedule-definitions` のリクエストボディに
     ```json
     "window": { "start_offset_ms": 0, "end_offset_ms": 3600000 }
     ```
     が含まれることを確認

## 検証手順

1. **wslc 経由で Postgres に接続**:
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db
   ```
2. **該当行の確認 (JSONB フィールド直接検査)**:
   ```sql
   SELECT id,
          window->>'start_offset_ms' AS start_offset_ms,
          window->>'end_offset_ms'   AS end_offset_ms,
          generation->>'kind'        AS gen_kind,
          required_duration_ms
   FROM v1_source_schedule
   WHERE window->>'start_offset_ms' = '0'
     AND window->>'end_offset_ms'   = '3600000'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. **期待値**:
   - `start_offset_ms` 列: `0` (string)
   - `end_offset_ms` 列: `3600000` (string)
   - `gen_kind` 列: `1` (RECURRING) または `0` (ONE_TIME) のいずれか (C6b の目的とは独立、Smoke 確認のみ)
   - `required_duration_ms` 列: `3600000` (C2a 系の回帰確認)
4. **新 spec の作成**: `tastile-web/e2e/quick-create-source-window-e2e.spec.ts` を新規作成。Playwright + chromium-devtools MCP で:
   - QuickCreate 起動 → §3 Time に span=09:00-10:00 入力 → submit
   - success toast を待つ
   - `POST /api/proxy/v1/schedule-definitions` の response を capture
   - レスポンス body に `window.start_offset_ms === 0` AND `window.end_offset_ms === 3600000` を assert
5. **テスト実行**:
   ```bash
   cd tastile-web
   bun test:e2e e2e/quick-create-source-window-e2e.spec.ts
   # 期待: 1 passed
   ```
6. **DB 検証 (spec green 後)**: 上記 psql クエリで同一行の `window` JSONB を直接確認
7. **終了条件**:
   - spec green AND `start_offset_ms=0, end_offset_ms=3600000` AND 他フィールド無回帰 = PASS
   - いずれか不一致 = FAIL (修正対象は `sourceWindow` 関数 1 箇所)

## リスク

- **暗黙 vs 明示派生**: `sourceWindow` 関数が `time.span` を参照せず `duration` のみで計算する場合、span=09:00-10:00 を変更しても `window` が追従しない (C6b の核心リスク)。修正は `sourceWindow` 内で `authoredInstant(state, "start"/"end")` を必ず評価し、`spanMs > 0` のときだけ `end_offset_ms = max(duration, spanMs)` ではなく「`duration` を優先 (= 配置の必要時間)」で固定する
- **anchor の相対性**: `SourceWindow` の `start_offset_ms` / `end_offset_ms` は **occurrence の nominal instant 起点**のオフセット (`source_schedule.rs:103` doc-comment: `relative to an occurrence's nominal instant`)。C6b の「span start = anchor」は **Recurring タイルが span 内の最初の occurrence を nominal instant に持つ** ことが暗黙の前提。OneTime タイル (`generation.kind=0`) で `generation.at = span.start` になる path なら同一、違う path なら span 開始 = window 開始が壊れる。C6b では RECURRING weekly で固定してこの path を pin
- **duration 単位の混同**: `time.durationMinMax` は UI 側で **分**単位、wire 側で **ms** 単位に変換される。`Math.max(duration, spanMs)` の両者は同じ ms 単位なので OK だが、`duration` 引数が `spanMs` よりも常に小さい場合 (= duration < span) は `Math.max` が `spanMs` を選び、availability 幅が必要時間ではなく span 幅に膨らむ。これは「休憩配置の余白を意図的に長く取る」ユースケースと矛盾するため C6b では「`end_offset_ms = duration` 固定」で safety に倒す
- **timezone 解釈**: `time.span.start` = `2026-08-03T09:00:00+09:00` を `Date.parse` で epoch ms に変換するとき、JS Date の内部表現は UTC ms。`spanMs = Date.parse(end) - Date.parse(start)` の差は timezone 非依存 (= 60 min) で確定。`Math.max(duration, spanMs)` も両方 ms なので timezone 影響なし
- **負の値 / 逆順 span**: `span.end < span.start` の場合 `spanMs` が負になる。`Math.max` 経由でも `duration` (正値) が勝つが、UI 側で先に validation して防ぐ方が望ましい。B 計画の validation で `end > start` を保証していれば二重防御不要
- **既存行との衝突**: `SELECT ... WHERE window->>'start_offset_ms' = '0' AND window->>'end_offset_ms' = '3600000'` だけだと過去 C6a テストの行 (他 span) も拾う可能性。`ORDER BY created_at DESC LIMIT 1` で直近のものを取る
- **wslc コンテナ停止**: `tastile-db` が落ちていれば SQL が空。先に `wslc container ps | grep tastile-db` で確認

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"対象フィールド" (window 行)
- Domain source: `tastile-core/crates-v1/domain/src/source_schedule.rs:103-108` (SourceWindow struct)
- Domain source: `tastile-core/crates-v1/domain/src/source_schedule.rs:106-107` (`start_offset_ms: DurationMs`, `end_offset_ms: DurationMs`)
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:112-117` (`sourceWindow` 関数)
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:332` (`window: sourceWindow(state, duration)` 呼出 site)
- Domain spec: `tastile-core/v1/08-recurring-and-frame.md` §"SourceWindow" (意味論)
- Domain spec: `tastile-core/v1/03-time-and-windows.md` §"Window 第一級" (Window モデル)
- Domain spec: `tastile-core/v1/10-invariants.md` §"数値定数のみ" (`DurationMs` = `i64`, JSONB 不在)
- 親プラン: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md`
- Sibling plan: `tile-create-e2e-wiring/04-plans/C6a-source-window-basic-e2e.md` (基本フィールド — 存在する場合)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
