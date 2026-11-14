# B4a — Window.rules[] time format acceptance e2e

## メタデータ

- **ID**: B4a
- **Phase**: 1 (Write-side e2e wiring)
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: B (Time + Windows)
- **Depends on**: B3a (windows array persist) green
- **Sibling plans**: B4b (windows bounds RFC3339 e2e)
- **Source spec**: `04-sub-projects/B-time-windows.md` §Windows array + §リスク "Windows 検証の硬さ" / `tastile-core/v1/03-time-and-windows.md` §Window / `tastile-core/v1/10-invariants.md` §2 (numeric constants / no JSONB)

## 前提

- **B3a green**: `v1_window` 行が wire 経由で永続化され、`SELECT kind, bounds_start, bounds_end FROM v1_window` で 1 件観測できる
- **wire-builder exists**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts::publishWindows` (:141-189) + `windowRule` (:119-139) が per-window validation と numeric conversion を担う
- **Window rules editor in UI**: QuickCreate panel の `windows[]` 配列で各 window に対し `weekdayMask` (bitmask) + `timeStart`/`timeEnd` (HH:MM 文字列) + `holidayKind` (0/1/2) + `dateRange` (optional) が入力可能
- **Stack up**: G plan suite (`wslc up-v1.sh`) 済み + `v1_window` TRUNCATE が `e2e/helpers/v1.ts` に追加済 (B3a で実施)

## 目的

`Window.rules[]` の入力形式が `kind` ごとに正しい wire-format に conversion され、core DB に `v1_window.rules` JSONB として永続化されることを e2e で prove する。

- **kind=0 (CALENDAR)**: rules は曜日 / 時刻 / 休日 / 学期範囲 の組合せ。wire は `weekday_mask` (i32 ビットマスク, bit0=mon 〜 bit6=sun) + `time_start_min` / `time_end_min` (i32, minute-of-day, 0..1440) + `holiday_kind` (i32, 0=include / 1=exclude / 2=any) + `date_range` (optional) + `offset_min` (i32)
- **kind=1 (LABEL_SPAN) / kind=2 (PARENT_SPAN)**: rules はターゲット Placement を指す参照 + 必要なら時間範囲。wire は `label_placement` / `parent_placement` (UUID 文字列) + 任意の time/date
- **kind=3 (GAP)**: rules は anchor condition + size。本 plan のスコープ外（Phase 2 保留）

数値定数のみ / `0` センチネル禁止 / JSONB 1 段ルール（v1/10 §2）と整合すること。

## 受入条件

| # | 観測 | 期待 |
| --- | --- | --- |
| 1 | `b4a-rules-format.spec.ts` green | `bunx playwright test e2e/b4a-rules-format.spec.ts` 1/1 pass |
| 2 | QuickCreate で 2 windows 追加 (kind=0 + kind=1)、各 rules に異なるフィールドをセット、Submit | 成功トースト表示 |
| 3 | `wslc container exec tastile-db psql -c "SELECT kind, rules FROM v1_window ORDER BY id DESC LIMIT 2"` | 2 rows / kind 0/1 / `rules` JSONB が per-kind expected shape |
| 4 | kind=0 row の `weekday_mask` = `[mon,wed,fri]` ビット和 (bit0\|bit2\|bit4 = 1\|4\|16 = 21) | `rules.weekday_mask == 21` |
| 5 | kind=0 row の `time_start_min` / `time_end_min` = HH:MM "09:00" / "17:00" → 540 / 1020 | `rules.time_start_min == 540` && `rules.time_end_min == 1020` |
| 6 | kind=1 row の `label_placement` = 参照先 UUID | `rules.label_placement == "<uuid>"` |
| 7 | kind=0 row は `label_placement` / `parent_placement` が null | `rules.label_placement == null` && `rules.parent_placement == null` |
| 8 | `bunx playwright test e2e/b4a-rules-format.spec.ts --reporter=line` exit 0 | green |
| 9 | `cargo fmt --manifest-path crates-v1/Cargo.toml --all -- --check` + `cargo clippy --manifest-path crates-v1/Cargo.toml --workspace --all-targets -- -D warnings` | clean (tastile-core 側変更が 0 行なら skip) |

## 実装手順

### Step 1 — e2e spec 新設

`C:\Users\rebui\Desktop\tastile\tastile-web\e2e\b4a-rules-format.spec.ts` を新規作成。テンプレートは `e2e/quick-tile-create-e2e.spec.ts` + `e2e/quick-tile-create-v1-params.spec.ts` を踏襲。

```ts
import { test, expect } from "@playwright/test";
import { TRUNCATE_TABLES } from "./helpers/v1";

test.describe("B4a window rules time format", () => {
  test.beforeEach(async () => {
    await TRUNCATE_TABLES(["v1_window", "v1_placement", "v1_tile", "v1_plan"]);
  });

  test("persists per-kind rules JSON: weekday_mask / time_start_min / label_placement", async ({ page }) => {
    // 1. Dashboard 開く → QuickCreate パネル起動
    // 2. タイトル "rules-format-target" 入力
    // 3. Time セクション: OneTime で 2026-09-01 09:00 / 17:00 (kind=0 の bounds と一致)
    // 4. Windows[] に 2 件追加:
    //    - Window 1: kind = CALENDAR (radio/select), bounds = 2026-09-01 09:00 / 17:00
    //      - weekdayMask toggles: mon, wed, fri (UI は複数の checkbox を持つ想定)
    //      - timeStart = "09:00", timeEnd = "17:00"
    //      - holidayKind = "any"
    //    - Window 2: kind = LABEL_SPAN, bounds = 2026-09-01 09:00 / 17:00
    //      - referenceId = label placement の UUID (test fixture として seed)
    // 5. Submit → 成功トースト待機
    // 6. v1_window の最新 2 行を SELECT し検証
  });
});
```

### Step 2 — UI セレクタの確認

`04-sub-projects/02-ui-coverage-audit.md` §Windows 関連と `tastile-web/src/dashboard/quick-create/` 配下の `windows`-panel component を read し、実装されているセレクタ（`data-testid="window.item"` / `data-testid="window.rules.weekday.mon"` / `data-testid="window.rules.timeStart"` 等）を spec で使用する。セレクタが未実装なら spec は `getByLabel` / `getByRole` で逃げ、B4a 完了後に `feedback_panel_design.md` の §Section-aware sheets 経由で別 PR で `data-testid` を整える。

### Step 3 — wire-format 観測

Submit 成功後、別 process で `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT id, kind, bounds_start, bounds_end, rules FROM v1_window ORDER BY id DESC LIMIT 2"` を実行する。spec 内では `execSync` で `wslc` を叩くより、`/tmp/b4a-rules-format-actual.json` に shell 出力 (psql の `-t -A -F` JSON 出力) を redirect して spec 側で `readFileSync` + `JSON.parse` する方が portable。

```ts
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const actualJson = readFileSync("/tmp/b4a-rules-format-actual.json", "utf8");
const rows = JSON.parse(actualJson);
expect(rows).toHaveLength(2);
const calendar = rows.find((r) => r.kind === 0);
const labelSpan = rows.find((r) => r.kind === 1);
expect(calendar.rules.weekday_mask).toBe(21);   // mon|wed|fri = 1|4|16
expect(calendar.rules.time_start_min).toBe(540); // 09:00
expect(calendar.rules.time_end_min).toBe(1020);  // 17:00
expect(labelSpan.rules.label_placement).toMatch(/^[0-9a-f-]{36}$/);
```

### Step 4 — wire-builder 既知の制約を spec に pin しない

`windowRule` (:119-139) は:
- `rule.weekdayMask` (UI 値) → `weekday_mask: rule.weekdayMask` (numeric そのまま)
- `rule.timeStart` (UI HH:MM 文字列) → `time_start_min: minuteOfDay(rule.timeStart)` (numeric 0..1440 or null)
- `rule.timeEnd` (UI HH:MM 文字列) → `time_end_min: minuteOfDay(rule.timeEnd)` (numeric 0..1440 or null)
- `rule.holidayKind ?? 2` (UI 0/1/2 → numeric 0/1/2、デフォルト 2 = any)
- `rule.dateRange` → `{ start: ..., end: ... }` (string そのまま)
- `window.kind === 1` → `label_placement: window.referenceId`
- `window.kind === 2` → `parent_placement: window.referenceId`
- gap_* フィールドは全て null (kind=3 で初めて populate)

spec 検証は wire-format がこの契約を満たしていることを確認する。`weekdayMask` / `timeStart` / `timeEnd` が UI 側でどう表現されているか（HMS clock picker / bitmask checkbox 群 / mantine TimeInput 等）は spec 実装時に `04-sub-projects/02-ui-coverage-audit.md` で確認。

## 検証手順

### 1. e2e 実行

```bash
cd tastile-web
wslc container exec tastile-db psql -U tastile -d tastile_db -c "TRUNCATE v1_window, v1_placement, v1_tile, v1_plan RESTART IDENTITY CASCADE;"
bunx playwright test e2e/b4a-rules-format.spec.ts --reporter=line
```

期待: `1 passed (Xs)`

### 2. 観察シェル (spec 内の補助コードから呼ばれる)

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -t -A -F$'\t' \
  -c "SELECT id, kind, bounds_start, bounds_end, rules FROM v1_window ORDER BY id DESC LIMIT 2;"
```

期待: 2 行。各行の `rules` 列は JSONB 文字列で `weekday_mask` / `time_start_min` / `time_end_min` / `holiday_kind` / `date_range` / `offset_min` / `label_placement` / `parent_placement` / `gap_*` フィールドのいずれかを持つ。

### 3. UI 側の最終 visual check

`mcp__chrome-devtools__take_snapshot` + `mcp__chrome-devtools__take_screenshot` で、Submit 直前の QuickCreate パネルを画面キャプチャ。`feedback_verify_ui_in_browser.md` の §Calendar Create must have a panel button に従い、Create ボタンの clickability も同時 verify。

### 4. 静的検査 (tastile-web)

```bash
cd tastile-web
bunx biome check e2e/b4a-rules-format.spec.ts
bunx tsc --noEmit
```

期待: exit 0

### 5. 静的検査 (tastile-core, code 変更なしなら skip)

```bash
cd tastile-core
cargo fmt --manifest-path crates-v1/Cargo.toml --all -- --check
cargo clippy --manifest-path crates-v1/Cargo.toml --workspace --all-targets -- -D warnings
```

期待: clean (B4a は web 側 spec のみなので skip 可)

## リスク

### R1 — wire の `weekday_mask` 表現 ≠ 0..6 整数のリスト

`v1/10` §2 は「数値定数のみ」「文字列 enum 禁止」であって「配列を禁止」ではないが、wire-builder :125 `weekday_mask: rule.weekdayMask` は **数値 1 個 (i32 ビットマスク想定)** に変換している。テストで「mon, wed, fri」の入力から期待される wire 値はコード読解上 `1 | 4 | 16 = 21` だが、もし UI が `weekdayMask = [1, 3, 5]` (0-indexed 配列) を保持していて wire-builder が `array_to_bitmask(rule.weekdayMask)` するなら wire 値は依然 `21` だが spec の assertion は「`weekday_mask === 21`」と「`weekday_mask === [1,3,5]`」の 2 パターンがありえる。spec 実装時に `tastile-web/src/lib/state/quick-create-schedule-window-types.ts` 相当の UI 型定義を確認すること。

### R2 — wire の `time_start_min` / `time_end_min` は HH:MM 文字列ではなく minutes-of-day 整数

`windowRule` :126-127 `minuteOfDay(rule.timeStart)` で UI の "09:00" 文字列 → 540 整数 に必ず conversion 済み。spec の assertion は **wire-format の 540 / 1020** を確認する。UI 上の "09:00" 表示を確認したくて spec の assertion を `rules.time_start_min === "09:00"` にすると OFF-BY-TYPE で落ちる。

### R3 — `holiday_kind` のデフォルト値

`windowRule` :128 `rule.holidayKind ?? 2` の `?? 2` は UI 側で holiday を any にしたとき `2` (any) を wire する経路。UI が 0/1/2 の 3 値しか出さないとしても spec の assertion で `holiday_kind === 2` を pin していないので CI 上のフレークは無い。検証時に「any 以外を選ぶと別数値になる」確認は B4a の受入条件外 (Phase 2 保留)。

### R4 — `date_range` の optionality

`windowRule` :129-131 は `rule.dateRange ? { start, end } : null`。kind=0 で date_range を未入力 (UI の semester/section を開かない) なら wire 値は `null`。spec は date_range フィールドを pin しない (kind=0 受入条件 4-5 に集中)。date_range を pin したい場合は B4b など別 PR。

### R5 — `offset_min` 固定 0

`windowRule` :132 `offset_min: 0` は全 window で 0 固定。v1/03 §Moment.offsetMs デフォルト 0 に整合。spec では `rules.offset_min === 0` を pin しない（受入条件 4-7 のどれにも該当しない）。必要なら B4b に分離。

### R6 — kind=3 (GAP) のスコープ外

GAP window は rules が anchor condition + size 必須で、UI に入力経路が無い (B3a plan §Windows ケースで 1 件追加の確認ができたのは kind=0)。kind=3 は Phase 2 保留。本 spec は kind=0 + kind=1 の 2 件のみ。

### R7 — `v1_window.rules` が JSONB 列であることの確認

`v1/10` §2 は「JSONB / `metadata_json` / `condition_json` / `payload_json` を正本に保存しない。子テーブルへ正規化」を要請する。`v1_window.rules` だけは v1/03 §Window の構造体でありリレーショナル分解が spec で明示されていないため、現状 JSONB 1 段で実装されている可能性が高い。**B4a はこの前提のまま e2e を pass させる** が、JSONB 禁止の方針との整合は `feedback_verify_before_claiming_no_change.md` を踏まえて別途 plan で再検討 (Phase 2 以降)。

## 関連

- B3a plan: `04-plans/B3a-windows-array-persist-e2e.md` (依存)
- B4b (sibling): `04-plans/B4b-...` (bounds RFC3339 e2e, 別 PR)
- Sub-project index: `04-sub-projects/B-time-windows.md`
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:119-139` (`windowRule`) + `:141-189` (`publishWindows`)
- Spec §Window: `tastile-core/v1/03-time-and-windows.md:71-129` (Window 集約 + rules 配列)
- Spec §Invariants: `tastile-core/v1/10-invariants.md` §2 (numeric constants / no JSONB)
- Spec §AggregateKind: `tastile-core/v1/14-read-model-and-endpoint.md` §2 (WINDOW は未列挙, RECURRING/PLACEMENT/EXECUTION/SESSION/SOURCE のみ)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
