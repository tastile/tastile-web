# C7a1 — recurring e2e spec green end-to-end

## メタデータ

- **ID**: C7a1
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C1–C6 (SourceSchedule fields all round-trip), G5a (wslc-ize pattern for e2e specs)
- **Source spec**: `04-sub-projects/C-recurring-source.md` §"e2e 検証"
- **Sibling plans**: G5a (wslc-ize e2e specs), A7a (one-shot e2e green), B7a (one-shot kind e2e green)

## 前提

- G5a の wslc-ize パターンが完了している（`docker exec tastile-core-db-1 psql …` 呼び出しを `wslc container exec tastile-db psql …` に置換済み、または同等の shell helper に統一済み）
- `tastile-v1-api:latest` イメージが wslc 内に存在（G1a でビルド済み）
- `tastile-db` コンテナが wslc 内で稼働しており、`tastile_db` DB にマイグレーション適用済み
- C1〜C6 の全フィールドが `SourceSchedule` (`source_schedule.rs:11-119`) に正しくマップされ、422 なしで round-trip 可能
- 既存 spec `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts` は現時点で `docker exec` ハードコードの旧実装

## 目的

`quick-tile-create-recurring-e2e.spec.ts` を wslc-ize し、C1〜C6 で確立した SourceSchedule フィールド（`kind`, `weekday_mask`, `interval_ms`, `priority`, `offset_min`, `split_policy`, `excluded_dates`）のアサーションを追加する。spec 実行で「Weekly Mon-Fri × 14 days − exclusions」の placement が DB に生成され、`/api/events/occurrences` および `/v1/timeline` の双方で観測可能であることを一発で確認する。

## 受入条件

- 単一コマンド `bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts` が exit code 0 で完了する
- spec 内 DB 検査で `v1_source_schedule` の該当行が以下を満たす:
  - `generation->>'kind' = '1'`（recurring）
  - `generation->>'weekday_mask' = '31'`（Mon-Fri）
  - `generation->>'interval_ms' = '1800000'`（30 min）
  - `split_policy->>'kind' = '0'`（UNSPLIT）
  - `priority = 5`
  - `generation->>'offset_min' = '540'`（JST）
  - `generation->>'date_range_end' = today+14`
- `v1_placement` の件数が期待値（Mon-Fri × 14 days − excluded dates）に一致し、UI assertion と DB assertion の両方で確認できる
- `/api/events/occurrences` と `/v1/timeline` の双方で source.kind = 1 の placement が観測できる

## 実装手順

1. **既存 spec の wslc-ize** (`tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:1-107`):
   - `deleteAllEvents` 関数 (`spec:23-35`) の `execFileSync("docker", [...])` を G5a の wslc helper に置換
     - `execFileSync("docker", ["exec", "tastile-core-db-1", "psql", ...])` → `execFileSync("wslc", ["container", "exec", "tastile-db", "psql", ...])`
     - TRUNCATE 文は維持: `TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;`
   - import ブロックから `node:child_process` の重複を確認し、G5a で定義した共通 helper を再エクスポートしているならそれを使用

2. **UI 入力拡張** (spec:42-77):
   - QuickCreate パネルで `repeatMode = "weekly"` を選択（既存の "Recurring" radio click を `weekly` サブオプションへ細分化、または `weekdayMask` field を表示）
   - `weekdayMask = 0b0011111`（Mon-Fri）を入力する UI 操作を追加（チェックボックス or ビット入力）
   - `intervalValue = 30`, `intervalUnit = "min"` を入力
   - `life.active.startDate = today`, `life.active.endDate = today + 14 days` を入力
   - `priority = 5` を入力（Source panel）
   - `offsetMin = 540`（JST）を入力（Source panel）
   - `splitPolicy = "UNSPLIT"` を確認/設定（Source panel）
   - `excludedDates = [next Sunday in range]` を入力（Source panel）

3. **DB アサーション追加** (spec:78 付近、`/api/events/occurrences` 検証の後):
   - G5a の wslc helper 経由で以下を実行:
     ```
     SELECT
       generation->>'kind' AS kind,
       generation->>'weekday_mask' AS weekday_mask,
       generation->>'interval_ms' AS interval_ms,
       generation->>'offset_min' AS offset_min,
       generation->>'date_range_end' AS date_range_end,
       split_policy->>'kind' AS split_kind,
       priority
     FROM v1_source_schedule
     WHERE generation->>'weekday_mask' = '31'
     ORDER BY id DESC LIMIT 1;
     ```
   - 期待値: `kind=1`, `weekday_mask=31`, `interval_ms=1800000`, `offset_min=540`, `date_range_end=today+14`, `split_kind=0`, `priority=5`
   - placement count assertion:
     ```
     SELECT COUNT(*) FROM v1_placement p
     JOIN v1_source_schedule s ON p.source_schedule_id = s.id
     WHERE s.generation->>'weekday_mask' = '31';
     ```
   - 期待値: Mon-Fri × 14 days − excluded dates（おおよそ 10 件、excluded Sunday の数により 9〜10 件）

4. **UI アサーション強化** (spec:81-105):
   - 既存の `/api/events/occurrences` 検証 (`spec:81-88`) を維持
   - 既存の `/v1/timeline` 検証 (`spec:92-105`) を維持
   - レスポンス内の placement 数もアサート（`occData.occurrences.filter(o => o.source?.kind === 1).length >= 9` 程度）

5. **`test:e2e` スクリプト確認** (`tastile-web/package.json`):
   - `bun run test:e2e` が `playwright test` を呼び出すことを確認
   - `playwright.config.ts` で `--workers=1` 等の sequential 設定（DB 共有前提）を確認

## 検証手順

```bash
# 1. wslc 側コンテナ稼働確認
wslc container ls | grep -E "tastile-db|tastile-v1-api"
# 期待: 両方の行が存在

# 2. DB マイグレーション適用状態確認
wslc container exec tastile-db psql -U tastile -d tastile_db -c "\dt v1_source_schedule"
# 期待: テーブル一覧に v1_source_schedule が含まれる

# 3. spec 単体実行
cd tastile-web
bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts
# 期待: "1 passed (XXs)" exit code 0

# 4. 期待 placement 数 の事後確認（オプショナル）
wslc container exec tastile-db psql -U tastile -d tastile_db -c "
  SELECT COUNT(*) AS placement_count
  FROM v1_placement p
  JOIN v1_source_schedule s ON p.source_schedule_id = s.id
  WHERE s.generation->>'weekday_mask' = '31';
"
# 期待: 9〜10 件 (excluded_dates による)
```

## リスク

- **worker lag**: spec 実行中に core daemon の placement materializer が遅れていると、UI assertion 直後に placement がまだ存在しない可能性。`page.waitForResponse` または明示的な retry (最大 5s) で DB 反映を待つこと。`v1_change_set` の `committed_at` ではなく `v1_placement.created_at` で確認するのが確実
- **weekday bit order 不一致**: web の `0b0011111`（bit-0=Mon）が core の bit-7=Mon 想定と逆になっていると、生成 placement が逆順（Fri のみ等）になる。C1 で確定済みのマッピングを `v1/08:97-101` で再確認し、spec 内の `weekday_mask = '31'` 文字列一致で間接検証する。DB の `placement.baseline` を見て曜日分布を cross-check すること
- **`life.active.endDate` と `endDate` の混同**: wire-builder で `recurring.endDate` → `generation.ends_at`（Instant）、`recurring.life.active.endDate` → `generation.date_range_end`（LocalDate）。UI で片方だけ設定すると生成範囲がずれる。spec では `endDate` は空、`life.active.endDate` のみ 14 日後に設定する
- **`offset_min` のタイムゾーン解釈**: `offset_min=540` は UTC+9 (JST) を意味する。core 側で `Instant + offset_min` で placement の `at` が計算されるため、UI の `start_at` が UTC 09:00 → placement は UTC 09:00 + 540 min = UTC 18:00（JST 03:00翌日）になる可能性。テストの期待値を DB の実 timestamp と突き合わせて事前計算すること
- **wslc DB container 名**: G1a/G5a で確定した名前が `tastile-db` か `tastile-postgres` かを必ず確認（既存 spec は `tastile-core-db-1` という docker compose 名を参照しており、wslc での実名と乖離している）
- **既存 spec の QuickCreate UI 構造との不一致**: v32+ の UI で kind picker の "Recurring" 選択後、weekly/monthly/daily/interval サブオプションが存在するか未確認。存在しなければ spec 全体を書き換え（spec:66-68 の `getByRole("radio", { name: /Recurring/ })` 以降の UI 操作を再設計）

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"e2e 検証"
- Existing spec: `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts`
- SourceSchedule wire mapping: `tastile-core/crates/v1/api/src/source_schedule.rs:11-119`
- Domain spec: `tastile-core/v1/08-schedule-definition.md:26-101`（Recurring / StepGenerator / CalendarGenerator）
- Read model: `tastile-core/v1/14-read-model-and-endpoint.md`（`/v1/timeline`, `/api/events/occurrences`）
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md` §C7a
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling green specs: `tile-create-e2e-wiring/04-plans/A7a-one-shot-e2e-green.md`, `tile-create-e2e-wiring/04-plans/B7a-one-shot-kind-e2e-green.md`
- G5a wslc-ize pattern: `tile-create-e2e-wiring/04-plans/G5a-wslc-e2e-spec.md`（存在する場合）