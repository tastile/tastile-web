# C3a — source.{offsetMin, priority} round-trip 検証

## メタデータ

- **ID**: C3a
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: A, B
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"変更手順" step 5
- **Sibling plans**: C1 (repeatMode), C2 (weekdayMask), C3b (excludedDates), C3c (preferredDurationMinMax), C3d (splitPolicy)

## 前提

- QuickCreate の `§5 Source` パネルが描画され、`source.offsetMin` と `source.priority` を入力できる状態（A が完了済）
- `POST /v1/schedule-definitions` が「description と memo の同時指定」チェック等を通過する状態（B が完了済）
- wslc 経由の core が起動しており、`v1_source_schedule` テーブルがマイグレーション完了済
- `tastile-web` の dev サーバが `http://localhost:3000` で起動済

## 目的

`source.offsetMin = 540` (JST = UTC+9) と `source.priority = 5` が wire-builder 経由で正しく core に到達し、DB の `v1_source_schedule` へ `generation->>'offset_min' = 540`、`priority = 5` として格納されることを e2e で確認する。`offsetMin` のタイムゾーン解釈（クライアントが JST のオフセットを送る挙動）と `priority` の単純 i32 ラウンドトリップを分離して検証する。

## 受入条件

- QuickCreate §5 Source で `offsetMin=540`, `priority=5` を入力して submit → 200 OK
- DB の `v1_source_schedule` 該当行で `generation->>'offset_min' = 540` AND `priority = 5`
- 他の SourceSchedule フィールド（kind, interval_ms, etc.）が「壊れていない」状態を維持（リグレッションなし）

## 実装手順

1. **wire-builder の該当箇所確認**:
   - `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:85` — `offset_min: state.source.offsetMin` を `generation` オブジェクト内にセット
   - `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:339` — `priority: state.source.priority` を `source_schedule.priority` トップレベルにセット
2. **QuickCreate UI からの入力経路**:
   - `source.offsetMin` は `quick-create-store` の `source` スライスで `number` 型として保持（`SourcePanel.tsx` の InputNumber 経由）
   - `source.priority` は同スライスで `number` 型として保持
3. **wire スキーマの確認**:
   - `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:80-86` の `common` オブジェクトに `offset_min` が含まれている
   - line 339 が `source_schedule.priority` 直属であることを確認
4. **dev サーバ起動**:
   ```bash
   cd tastile-web
   bun dev
   ```
5. **chromium-devtools MCP で QuickCreate を起動**:
   - `http://localhost:3000/dashboard` を開く
   - キーボードショートカットで QuickCreate を表示（`dashboard/layout-client.tsx:79` 参照）
6. **§5 Source パネルで以下を入力**:
   - `offsetMin` = `540` (9時間 × 60 分 = JST UTC+9)
   - `priority` = `5`
7. **Submit**:
   - 成功 toast が出ることを確認
   - DevTools Network タブで `POST /api/proxy/v1/schedule-definitions` のリクエストボディに `source_schedule.priority: 5` と `generation.offset_min: 540` が含まれることを確認

## 検証手順

1. **wslc 経由で Postgres に接続**:
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db
   ```
2. **該当行の確認**:
   ```sql
   SELECT id,
          generation->>'offset_min' AS offset_min,
          priority
   FROM v1_source_schedule
   WHERE priority = 5
   ORDER BY created_at DESC
   LIMIT 1;
   ```
3. **期待値**:
   - `offset_min` 列: `540` (string として返る)
   - `priority` 列: `5` (integer)
4. **リグレッション確認**:
   ```sql
   SELECT generation->>'kind',
          generation->>'interval_ms',
          generation->>'weekday_mask',
          split_policy->>'kind'
   FROM v1_source_schedule
   WHERE priority = 5
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   - 期待: 他の C1/C2/C3 検証で投入した値と一貫した kind/interval_ms/weekday_mask が返る（C1〜C3d 共通のスモーク）
5. **終了条件**:
   - `offset_min = 540` AND `priority = 5` AND 他フィールド無回帰 = PASS
   - いずれか不一致 = FAIL（修正対象は wire-builder の当該 2 行）

## リスク

- **timezone 解釈の暧昧性**: `offsetMin` はクライアントのローカル TZ からの差分（分）として渡す規約。`540` を JST オフセットと解釈するには、wire-builder 側で `offset_min` をそのままの数値で渡し、core 側で `Instant + offsetMin` を適用するという不変条件に依存する（`v1/08` 参照）。もし core 側が「UTC からのシフト」として解釈すると、すべてのユーザーが 540 を渡すと JST ユーザー以外（例: UTC+0 ユーザーでも同じ `540` を入力してしまうケース）で 9 時間ずれる。**e2e では「wire に 540 がそのまま届く」と「DB に 540 がそのまま書かれる」だけを検証し、解釈は別ユニットテスト（c3a-int.rs 相当）に分離する**。
- **負の値 / 範囲外**: `i16` 上限 ±32767 を超えると wire で silent に切られる。QuickCreate 側で InputNumber の max を ±720（±12 時間相当）にクランプしていない場合、海外ユーザーが「PST UTC-8 = -480」を入れた時に `offsetMin` 自体は負値でも OK だが、UI で `min=-720` が未設定だと `-1000` 等が通る。スコープ外（リスクメモのみ）。
- **priority の符号**: `priority` は i32 なので負値も通る。UI 側で 0 以上を強制していない場合、-1 や 0 が混ざる。**C3a では送信値を 5 固定**にして、未クランプ問題は次の C3e に分離。
- **既存行との衝突**: `SELECT ... WHERE priority = 5` だけだと過去テストの行も拾う。`ORDER BY created_at DESC LIMIT 1` で直近のものを取るか、または `source_schedule.client_local_id` を記録してフィルタする方が堅牢。今回は LIMIT 1 で簡略化（回帰検出が目的なので「少なくとも 1 行が成立すれば OK」）。
- **wslc コンテナ停止**: `tastile-db` が落ちていれば SQL 実行が空。先に `wslc container ps | grep tastile-db` で確認。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 5
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:85` (offset_min), `:339` (priority)
- Domain spec: `tastile-core/v1/10-invariants.md` (offset_min の意味)
- Domain spec: `tastile-core/v1/02-core-entities.md` (SourceSchedule.priority の型)
- Core source: `tastile-core/crates/v1/api/src/handlers/source_schedule.rs:11-119`
- 親プラン: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"e2e 検証"
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
