# B3a — Windows array round-trip to v1_window

## メタデータ

- **ID**: B3a
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: B (§3 Time + §4 Windows)
- **Depends on**: A1a (QuickCreate happy path / wire-builder green)
- **Sibling plans**: B3b (multiple windows), B4* (windows with rules arrays > 1)
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md` §Windows array

## 前提

- A1a (QuickCreate happy path submission, 1 SourceTile row in `v1_source_tile`) が green
- §4 Windows editor (`§4 Windows`) が QuickCreate panel に存在し、UI から 1 件以上の window を追加できる state になっていること
- Wire-builder `publishWindows()` (`tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:141-189`) は ✓ wired 済み — 本 plan は wire 修正ではなく e2e 化 + 行レベル観測
- wslc stack (`bash scripts/wslc/up-v1.sh`) 起動済 + `tastile-db` container が psql 到達可能
- `e2e/quick-tile-create-e2e.spec.ts` の `deleteAllEvents` helper が `TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;` を実行する前提 (`:20`)

## 目的

`§4 Windows` UI の 1 window 入力を `POST /v1/source-tiles` 経路で送信し、wire-builder `publishWindows()` (`:141-189`) で正規化された payload が **1 件の `v1_window` 行**として `v1_window` + `v1_window_bounds` + `v1_window_rule` テーブルに永続化され、kind / bounds / rules / referenceId が UI 入力と一致することを e2e で証明する。現状 wire は ✓ 済みなので、本 plan の主作業は **e2e spec 追加 + psql 観測**。

## 受入条件

- `e2e/b3a-windows-array-persist-e2e.spec.ts` を新設、Playwright 経由で QuickCreate を開き、title + 1 window (kind=CALENDAR=0, bounds ISO 範囲, 1 rule) を入力 → Submit → 200 + ACCEPTED を観測
- spec green 後に `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT id, kind, bounds_start, bounds_end FROM v1_window ORDER BY id DESC LIMIT 1"` を実行し、以下を満たす:
  - 1 行返る (`v1_window` 行が新規作成されている)
  - `kind = 0` (CALENDAR, numeric constant per `v1/10 §2`)
  - `bounds_start` / `bounds_end` が UI 入力と ISO 文字列一致 (TZ-aware)
- `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT count(*) FROM v1_window_bounds WHERE bounds_start = '<UI 入力 ISO>'"` が 1 を返す (`v1_window_bounds` 行も 1 件)
- `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT position_no, kind, time_start, time_end FROM v1_window_rule WHERE window_id = '<上記 id>' ORDER BY position_no"` が 1 行返し、`time_start` / `time_end` が UI 入力と一致 (UI 側で time 入力した場合)
- spec の `bun e2e:b3a-windows-array-persist` (または既存 e2e runner 経由) が exit 0

## 実装手順

### Step 1 — spec skeleton (`tastile-web/e2e/b3a-windows-array-persist-e2e.spec.ts`)

既存の `e2e/quick-tile-create-e2e.spec.ts:1-65` を雛形に:
```ts
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";

// 1) 既存 helper (deleteAllEvents) を再 export または import
async function truncateWindowsAndRelated(_page) {
  execFileSync(
    "wslc",
    ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-c",
     "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_window_bounds, v1_window_rule, v1_recurring RESTART IDENTITY CASCADE;"],
    { stdio: "ignore" },
  );
}

test.describe("B3a windows array persist e2e", () => {
  test.beforeEach(async ({ page }) => { await truncateWindowsAndRelated(page); });

  test("1 window of kind=range with 1 rule persists as 1 v1_window row", async ({ page }) => {
    const title = "B3a windows " + Date.now();
    await page.goto("/dashboard/calendar?view=day");
    await page.getByTestId("sidebar-new-tile").first().click();
    await expect(page.getByTestId("quick-create-submit")).toBeVisible();

    // title 入力 (A1a と同じ input)
    await page.locator("input[aria-required=\"true\"]").first().fill(title);

    // §4 Windows editor 操作:
    //   - デフォルトで 1 window (kind=range, bounds=<day 09:00-18:00>, rules=空) が
    //     出る前提。実 UI の test-id を pane の §4 に合わせて当てる
    //   - rule を 1 件追加 (e.g. timeStart=09:00, timeEnd=18:00)
    //   - kind が range (=2 PARENT_SPAN) の場合は referenceId 必須なので UI が無効化しないこと
    //     を確認 (本 plan では kind=CALENDAR=0 の最小経路で通す)

    await page.getByTestId("quick-create-submit").click();
    await expect(page.getByTestId("quick-create-submit")).not.toBeVisible();

    // v1_window 行が新規に 1 件存在することを psql で観測
    const windowsJson = execFileSync(
      "wslc",
      ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-t", "-A", "-c",
       "SELECT json_build_object('count', count(*), 'latest_kind', max(kind), 'latest_bounds_start', max(bounds_start::text), 'latest_bounds_end', max(bounds_end::text)) FROM v1_window;"],
      { encoding: "utf8" },
    );
    const parsed = JSON.parse(windowsJson.trim());
    expect(parsed.count).toBe(1);
    expect(parsed.latest_kind).toBe(0); // CALENDAR per WindowKind constant at schedule-definition.ts:13
    // bounds は UI 入力の ISO 文字列と完全一致 (TZ を含む)
    // ... expect(parsed.latest_bounds_start).toBe("<UI 入力 ISO>");
  });
});
```

### Step 2 — UI 入力の test-id 確定 (実装フェーズ)

`§4 Windows` editor の現状 panel design を確認し、test-id を 4 種固定:
- `quick-create-window-add` — window 1 件追加ボタン (デフォルトで 1 件あるなら不要)
- `quick-create-window-{i}-bounds-start` / `quick-create-window-{i}-bounds-end` — 各 window の bounds
- `quick-create-window-{i}-kind` — kind 切替 (Calendar / Label / Parent / Gap)
- `quick-create-window-{i}-rule-add` / `quick-create-window-{i}-rule-{j}-time-start` 等

test-id 不在なら `tile-create-e2e-wiring` の spec 確定後、別 PR で `quick-create-panel.tsx` 側に `data-testid` を追加する (本 plan のスコープ外として記録)。

### Step 3 — wire-builder 経路の視覚的確認

`publishWindows()` (`quick-create-schedule-wire.ts:141-189`) の入力型 (`state.windows[]` の `{ kind, bounds: { start, end }, rules: WindowRule[], referenceId? }`) と、payload の出力型 (`{ kind: 0|1|2|3, bounds: { start, end }, rules: WindowRule[] }`) の形状差を確認。本 plan では **wire 修正は行わない** (✓ wired 済みのため)。Step 4 の受信確認は row count + フィールド一致のみで十分。

### Step 4 — Submit 後の DB 観測

spec の assertion 内で `wslc container exec tastile-db psql -t -A -c "<SQL>"` を `execFileSync` で呼び、戻り JSON を parse して expect する。psql 経由が **`tastile-core` の `common::authenticate` を経由しない観測**であり、本 plan の「wire-format と DB row の完全一致」を保証する唯一の方法 (memory `feedback_observe_actual_behavior` 準拠)。

### Step 5 — 既存 e2e との non-regression

`e2e/quick-tile-create-e2e.spec.ts` の `deleteAllEvents` helper (`:12-24`) は `v1_window` を含む TRUNCATE を行うので、B3a 追加で既存 spec が落ちることはない。確認のため `bun e2e` 一斉実行で `quick-tile-create-e2e.spec.ts` が green のままかを Step 6 で確認。

## 検証手順

### 1. wslc stack 起動確認

```bash
wslc list | grep -E "tastile-db|tastile-api|tastile-worker"
# 期待: 3 コンテナ running
curl -fsS http://127.0.0.1:31400/v1/health
# 期待: {"status":"ok"}
```

### 2. spec green

```bash
cd tastile-web
bunx playwright test e2e/b3a-windows-array-persist-e2e.spec.ts --reporter=list
# 期待: 1 passed (1 window persists) in ~Xs
```

### 3. 観測クエリ (spec green 後に手動で 1 度実行)

```bash
# 直近 1 件の v1_window 行
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT id, kind, bounds_start, bounds_end, rules FROM v1_window ORDER BY id DESC LIMIT 1"
# 期待:
#   id    | kind | bounds_start                | bounds_end                  | rules
#   <UUID>| 0    | 2026-08-03 09:00:00+09      | 2026-08-03 18:00:00+09      | [{"time_start":"09:00",...}]
#
# kind=0 = CALENDAR (WindowKind.CALENDAR at schedule-definition.ts:13)
# bounds_start/end は UI 入力 ISO と一致 (TZ aware)

# 紐づく v1_window_bounds 行
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT window_id, bounds_start, bounds_end FROM v1_window_bounds WHERE window_id = (SELECT id FROM v1_window ORDER BY id DESC LIMIT 1)"
# 期待: 1 行 / bounds が v1_window 側と一致

# 紐づく v1_window_rule 行
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT window_id, position_no, kind, time_start, time_end, date_range_start, date_range_end FROM v1_window_rule WHERE window_id = (SELECT id FROM v1_window ORDER BY id DESC LIMIT 1) ORDER BY position_no"
# 期待: 1 行 / UI 入力 rule と一致
```

### 4. 既存 e2e の non-regression

```bash
cd tastile-web
bunx playwright test e2e/quick-tile-create-e2e.spec.ts --reporter=list
# 期待: 1 passed in ~Xs (A1a が落ちないこと)
```

### 5. clippy / fmt / tsc

```bash
cd tastile-core
cargo fmt --manifest-path crates-v1/Cargo.toml --all -- --check
cargo clippy --manifest-path crates-v1/Cargo.toml --workspace --all-targets -- -D warnings
# 期待: グリーン (本 plan は wire 修正なしなので無影響のはず)

cd tastile-web
bunx tsc --noEmit
bunx eslint e2e/b3a-windows-array-persist-e2e.spec.ts
# 期待: クリーン
```

## リスク

- **kind 数値の drift**: `WindowKind.CALENDAR = 0` は `tastile-web/src/shared/api/v1/schedule-definition.ts:13` 側。core 側の `v1_window.kind` (smallint per `v1/10 §2`) も同じ 0 を共有しているか、spec green の前に `v1_window` の DDL コメントで値定義を確認すること。V1_001__base.sql の `:446-454` 周辺で行コメントが 0=CALENDAR 等の registry を含むはずだが、含まれていない場合は spec green 失敗 = 仕様 drift として別 PR で align
- **TZ の正規化**: UI で `09:00` (時刻のみ) を入れると wire-builder は `validInstant(window.bounds.start)` で ISO 文字列へ変換する (`:148`)。`validInstant` の TZ 仮定 (local vs UTC) によって DB に書き込まれる `bounds_start` の TZ 表記が変わる。Asia/Tokyo 固定の E2E 環境 (`quick-tile-create-e2e.spec.ts:4-10` の `todayUtc()` ヘルパが `Asia/Tokyo`) と整合させる必要あり
- **referenceId 必須化**: `quick-create-schedule-wire.ts:156-158` で `kind === 1 || kind === 2` の場合は `referenceId` 必須。`kind=CALENDAR (=0)` を選んでいれば throw されないが、UI 側で kind=Label/Parent を誤って選ぶと Submit 時に `window 1 requires a concrete placement reference` で 422。本 plan は kind=CALENDAR のみを通す
- **rules の time format 検証**: `quick-create-schedule-wire.ts:165-180` で `rule.timeStart` が `HH:mm` 形式、`dateRange.startDate <= endDate` を満たさないと throw。UI 側でも同じ検証を先に行わないと「UI は通るが wire で落ちる」状態になる
- **windows[] が空のとき**: publishWindows は `state.windows.flatMap(...)` で空配列ならそのまま `[]` を返す。v1_window 行は 0 件 (期待動作)。A1a の既存 spec は windows 未入力でも通る前提なので conflict しない
- **bounds.start >= bounds.end**: `:153-155` で `Date.parse(start) >= Date.parse(end)` を throw。UI 側で end < start の範囲を入れないこと
- **既存 e2e の TRUNCATE 順序**: `quick-tile-create-e2e.spec.ts:20` は `v1_window` を含むが `v1_window_bounds` / `v1_window_rule` を含まない。`v1_window` 側の `ON DELETE CASCADE` で両 child も消える (V1_001__base.sql:1057 / 1065 の `REFERENCES v1_window(id) ON DELETE CASCADE`)。本 plan の spec も同パターンで OK
- **観測 psql の権限**: `psql -U tastile -d tastile_db` の password は wslc の `tastile-pgdata` volume 上で `tastile` 固定 (`scripts/wslc/up-v1.sh` defaults)。`PGPASSWORD` 環境変数の指定は不要

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md` §Windows array
- Wire-builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:141-189` (`publishWindows`)
- WindowKind constants: `tastile-web/src/shared/api/v1/schedule-definition.ts:12-18`
- v1_window DDL: `tastile-core/crates-v1/storage/migrations/V1_001__base.sql:446-454` (window) / `:1056-1062` (bounds) / `:1063-1082` (rule)
- v1/02 entity contract: `tastile-core/v1/02-core-entities.md` §Window
- v1/10 invariants: §2 (numeric constants, no JSONB, no enum) / §4 (Command atomicity)
- Core create contracts: `tile-create-e2e-wiring/03-core-create-contracts.md` §3.1 (`CreateSourceTilePayload.windows[]` carries `kind` as integer) / §4 (Persistence map)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling plans: B3b (multiple windows) / B4* (windows with rules arrays > 1)
- Dependency: A1a (QuickCreate happy path)
- Existing e2e helper: `tastile-web/e2e/quick-tile-create-e2e.spec.ts:12-24` (TRUNCATE pattern)
- Memory references: `feedback_observe_actual_behavior` (psql 観測で wire-format / DB row 一致を保証) / `feedback_integration_test_skip_masks_contract_bugs` (skip 経路に依存しない)
