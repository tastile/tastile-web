# C1b — weekday_mask bit-order round-trip

## メタデータ

- **ID**: C1b
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: C (Recurring + SourceSchedule)
- **Depends on**: C1a
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 2 + §"リスク" (Weekday mask bit order)
- **Sibling plans**: C1a, C1c … C1x (per C field matrix)

## 前提

- C1a (wire-builder 全体) が merge 済みで `recurring.weekdayMask` を `generation.weekday_mask` に素通しできる状態
- core の v1/05 §CalendarTerm (`tastile-core/v1/05-condition-and-reference.md:60-68`) で **bit0=Mon … bit6=Sun** が正本として明文化済み
- core 実装の `crates-v1/domain/src/source_schedule.rs:857-862` は `mask & (1 << (weekday - 1))` で判定しており、`weekday` は `local_iso_weekday(...)` の戻り値（ISO 8601: Mon=1 … Sun=7）
- AT-020 (`crates-v1/domain/src/at_acceptance_tests.rs:748-766`) で `weekday_mask: 0b0011111` が Mon-Fri として固定テストされている
- ブラウザ QuickCreate 既定値 `quick-create-store.ts:456` は `weekdayMask: 0b0011111`（同 Mon-Fri）— UI 既定と core 既知テストが同じ bit 並びで一致
- dev DB（wslc 経由の Postgres）に v1_subject + bridge owner が provisioning 済み（C1a の前提）

## 目的

`recurring.weekdayMask` UI 値（既定 0b0011111 = Mon-Fri）が wire-builder 経由で `generation.weekday_mask` にそのまま乗って core に届き、core の placement 生成が **Mon-Fri だけに** materialize することを e2e で確定させる。parent §"リスク" で挙げられた「bit-7=Mon 形式と web の 0b0011111 が乖離する可能性」を **実装と DB 実値の二段**で潰し、もし乖離していたら **normalization helper** を wire-builder に足してビット並びを統一する。

## 受入条件

- `v1_source_schedule.generation->>'weekday_mask'` が、UI で submit した `weekdayMask` 整数値と bitwise に等しい（`SELECT (generation->>'weekday_mask')::int8 = 31` が true）
- 14 日ウィンドウの weekly タイルを submit した結果、`v1_placement` の本数が `2 * (window 内 Mon-Fri 営業日数) - excluded_dates` ぶんだけ Mon-Fri 曜日にのみ分布し、Sat/Sun の placement が **0 件**である（`EXTRACT(ISODOW FROM baseline)` のヒストグラムで Sat=0, Sun=0）
- もし wire 側で `bit 0=Sun` 系の誤った bit 並びが混入していたら、`quick-create-schedule-wire.ts` に `normalizeWeekdayMask()` ヘルパを足し、AT 相当の unit test を `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts` に追加して回帰を防ぐ

## 実装手順

1. **bit-order 正本の再確認** — `tastile-core/v1/05-condition-and-reference.md:62` を再読し、parent §"リスク" の "bit-7=Mon through bit-1=Sun" 仮定が **v1/05 と矛盾**していることを確認（本 C は v1/05 を正本として扱う）。差分は plan 末尾の「リスク」節に明記。
2. **wire の現状確認** — `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:81` の
   ```ts
   weekday_mask: state.recurring.repeatMode === "weekly" ? state.recurring.weekdayMask : null,
   ```
   が bit 並びを変換せず素通ししていることを確認。`WindowRule.weekday_mask`（同 `:125`）も同様。
3. **UI 既定値との一致確認** — `tastile-web/src/shared/stores/quick-create-store.ts:456` の `weekdayMask: 0b0011111 // Mon–Fri` が Mon-Fri を表す bit 並び（bit0=Mon … bit4=Fri）として読まれることを確認。`bit 0 = 2^0 = 1` なので 0b0011111 = 31 = bit0..bit4 すべて ON = Mon..Fri。
4. **(optional) normalization helper 追加** — もし将来 Sun 起点の第三者が値を渡すケースに備え、`quick-create-schedule-wire.ts` の `sourceGeneration()` 直前に
   ```ts
   function normalizeWeekdayMask(mask: number): number {
     // core v1/05: bit0=Mon ... bit6=Sun.  Accept and re-emit as-is.
     return mask & 0b1111111;
   }
   ```
   を足し、`weekday_mask: normalizeWeekdayMask(state.recurring.weekdayMask)` に置換（bit 並び自体は変えないが、bit7 を必ず 0 に切り落とす安全弁）。同時に `quick-create-schedule-wire.test.ts` に `expect(normalizeWeekdayMask(0b0011111)).toBe(0b0011111)` 系の snapshot を追加。
5. **submit スクリプトの準備** — `tastile-web/e2e/quick-create-recurring-e2e.spec.ts`（parent §"e2e 検証" で新規指定）の step 3 を本 C1b の観測点に特化：`repeatMode = weekly`, `weekdayMask = 31`、その他は既定のまま submit する最短経路にしておく。
6. **DB 観測クエリ雛形** — `scripts/wslc/sql/c1b-weekday-mask.sql`（G の stack-up 完了後）を新規作成。内容は `検証手順` 節の SQL 1〜3 をそのまま貼る。

## 検証手順

```bash
# A. dev サーバを立ち上げる（既に立っていれば skip）
cd tastile-web && bun dev

# B. Playwright e2e 実行（headless）
cd tastile-web && bunx playwright test e2e/quick-create-recurring-e2e.spec.ts \
  -g "weekly weekday_mask=31 produces Mon-Fri only"
```

```sql
-- 1. 送信値が DB に bitwise 一致で乗っているか（= が truthy）
SELECT
  id,
  (generation->>'weekday_mask')::int8 AS mask_db,
  (generation->>'kind')::int2        AS gen_kind,
  (generation->>'interval_ms')::int8 AS interval_ms
FROM v1_source_schedule
WHERE generation->>'weekday_mask' IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
-- 期待: 1 行目 (または直近の weekly 投入行) で mask_db = 31

-- 2. ビット内訳を可視化（bit0=Mon … bit6=Sun）
SELECT
  (mask & 0b0000001) <> 0 AS mon,
  (mask & 0b0000010) <> 0 AS tue,
  (mask & 0b0000100) <> 0 AS wed,
  (mask & 0b0001000) <> 0 AS thu,
  (mask & 0b0010000) <> 0 AS fri,
  (mask & 0b0100000) <> 0 AS sat,
  (mask & 0b1000000) <> 0 AS sun
FROM (VALUES (31)) AS m(mask);
-- 期待: mon=t, tue=t, wed=t, thu=t, fri=t, sat=f, sun=f
-- (これは wire が bit 並びを壊していないことの机上確認)

-- 3. placement の曜日ヒストグラム（parent §"e2e 検証" step 7 と同等）
SELECT
  EXTRACT(ISODOW FROM baseline AT TIME ZONE 'UTC') AS iso_dow,  -- 1=Mon … 7=Sun
  COUNT(*) AS n
FROM v1_placement p
JOIN v1_source_schedule s ON p.source_schedule_id = s.id
WHERE s.generation->>'weekday_mask' = '31'
  AND baseline >= now() - interval '21 days'
  AND baseline <  now() + interval '21 days'
GROUP BY 1
ORDER BY 1;
-- 期待: iso_dow ∈ {1,2,3,4,5} の各行 n ≥ 0、iso_dow ∈ {6,7} は必ず n=0
-- (Sat/Sun の row が現れた時点で fail)

-- 4. cross-check: excluded_dates を含む週では該当日のみ n が 1 減る
SELECT baseline::date, EXTRACT(ISODOW FROM baseline) AS dow
FROM v1_placement p
JOIN v1_source_schedule s ON p.source_schedule_id = s.id
WHERE s.generation->>'weekday_mask' = '31'
  AND baseline::date = ANY (
    ARRAY(SELECT jsonb_array_elements_text(s.generation->'excluded_dates')::date)
  )
ORDER BY 1;
-- 期待: 0 行（= excluded_dates に指定した日付には placement が落ちない）
```

## リスク

- **bit-order 取り違え（parent §"リスク"）**: parent 仕様本文は "bit-7=Mon through bit-1=Sun" と読める記述だが、**v1/05:62 を正本**とすれば `bit 0=Mon … bit 6=Sun` が core 実装（`source_schedule.rs:857-862` の `1 << (weekday - 1)`）および AT-020 テストの bit 並びと一致する。parent の文言は v1/05 への reference を意図した言い回しの揺らぎと判断し、本 C1b は v1/05 側を truth として固定する。もし `v1/05` 側文言と `v1/08` 側文言のどちらが正かで offline conflict が出た場合は、`tastile-core/v1/12-acceptance-tests.md` の AT-020 を裁定根拠とする。
- **sign bit 漏洩**: `weekday_mask` の DB 型は `i8`（`source_schedule.rs:34`）。UI 側で `0b10000000`（= 128）を submit すると PostgreSQL 上は `-128` に丸められ、bit6 までしか立たないため「Sun のみ」に見える。逆に **負の数を wire に流さない**よう、step 4 の `normalizeWeekdayMask` で `& 0b1111111` マスクを必ず噛ませる（防御的）。
- **local timezone のズレ**: `source_schedule.rs:859` は `local_iso_weekday(nominal_at, offset_min)` を使う。`offset_min = 540` (JST) を外した状態だと UTC 曜日に評価され、深夜 0〜9 時 (JST) の placement が前日の曜日に見える場合がある。検証クエリは `AT TIME ZONE 'UTC'` で baseline を評価するが、必ず e2e 側で `source.offsetMin = 540` を明示して UTC ↔ JST の単位ずれリスクを消す。
- **既存の partial split_policy 衝突**: C 親表の `split_policy` が partial のため、もし user が `splitPolicy = SPLIT` を選ぶと 400 で弾かれる。本 C1b は `splitPolicy = UNSPLIT` のみを扱い、Split 系は別 task で扱う（親 §"スコープ外" に従い、ここでは触らない）。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"変更手順" step 2 / §"リスク" / §"e2e 検証" step 7
- Bit-order 正本: `tastile-core/v1/05-condition-and-reference.md:60-68`
- Core 実装: `tastile-core/crates-v1/domain/src/source_schedule.rs:34, 857-862`
- Core AT: `tastile-core/crates-v1/domain/src/at_acceptance_tests.rs:748-766` (AT-020)
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:81, 125`
- UI 既定値: `tastile-web/src/shared/stores/quick-create-store.ts:456`
- E2E 親仕様: `tile-create-e2e-wiring/04-sub-projects/C-recurring-source.md` §"e2e 検証"
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
