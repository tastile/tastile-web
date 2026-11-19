# G5a — e2e helper: docker exec → wslc container exec + TRUNCATE 拡張

## メタデータ

- **ID**: G5a
- **Phase**: 0 (stack-up)
- **Target repo**: `tastile-web`
- **Sub-project parent**: G (stack-up)
- **Depends on**: G2a (`tastile-db` postgres container up via `bash scripts/wslc/up-v1.sh`)
- **Source spec**: `04-sub-projects/G-stack-up.md` §4 (E2E plumbing rewrite)
- **Sibling plans**: G5b (spec file rewrites in `quick-tile-create-*.spec.ts`), G6* (helper signature / post-submit 検証の置換)
- **Related audit**: `04-e2e-runtime-and-observation.md` §1.3, §7.2 (BLOCKER)

## 前提

- `tastile-db` コンテナが wslc 上で稼働中 (G2a)。確認: `wslc container ls --format '{{.Names}}' | grep '^tastile-db$'`
- `wslc.exe` が PATH に存在 (G1a / `tastile-core/scripts/wslc/up-v1.sh` が前提)
- `tastile-web/e2e/helpers/v1.ts:101, 139-149` が `execFileSync("docker", …)` を呼び出しており、本ホストに Docker Desktop が無いため現状必ず失敗する (`04-e2e-runtime-and-observation.md` §7.2)
- `try { ... } catch { /* no-op */ }` (`v1.ts:147-149`) が失敗を握り潰しているため、テストは silent に dirty state で PASS していた (memory `feedback_observe_actual_behavior.md` 該当)

## 目的

`e2e/helpers/v1.ts` の 2 箇所 (`execSqlSync` / `resetDb`) を `wslc container exec tastile-db psql …` 経由に書き換え、テストが DB クリーン状態を観測可能にする。TRUNCATE リストに `v1_tile` / `v1_annotation` を追加し、Phase A-D で `quick-tile-create-*` 系 spec が `v1_tile` 残存で汚れないようにする。

## 受入条件

1. `e2e/helpers/v1.ts:101` の `execFileSync` が `wslc container exec tastile-db psql …` を呼び出す (binary: `wslc`, args 先頭: `container exec tastile-db`)
2. `e2e/helpers/v1.ts:138-149` (TRUNCATE) のテーブル列挙が **`v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation`** の 7 テーブル (現状 6、`v1_tile` 追加)
3. TRUNCATE `try/catch` が失敗時に `console.error` で stderr 出力する (silent swallow を廃止)
4. dry-run 検証: `wslc container exec tastile-db psql -U tastile -d tastile_db -c 'SELECT 1'` が `?column? \n---------- \n 1 \n(1 row)` を返す (host から wslc 経由で postgres 到達確認)
5. `tastile-db` コンテナ停止中のとき `truncateV1()` が `Error: wslc container exec … exit code 1 …` を throw する (silent no-op ではない)

## 実装手順

### Step 1 — `e2e/helpers/v1.ts:93-104` (annotation INSERT の docker → wslc)

**Before** (`v1.ts:93-103`):

```ts
if (input.labels && input.labels.length > 0) {
    const { execFileSync } = await import("node:child_process");
    for (const label of input.labels) {
      if (!label) continue;
      const escaped = label.replace(/'/g, "''");
      const annId = crypto.randomUUID();
      const sql = "INSERT INTO v1_annotation …";
      try {
        execFileSync("docker", ["exec", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql], { stdio: "ignore" });
      } catch (e) { void e; }
    }
  }
```

**After**:

```ts
if (input.labels && input.labels.length > 0) {
    const { execFileSync } = await import("node:child_process");
    for (const label of input.labels) {
      if (!label) continue;
      const escaped = label.replace(/'/g, "''");
      const annId = crypto.randomUUID();
      const sql = "INSERT INTO v1_annotation …";
      execFileSync(
        "wslc",
        ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql],
        { stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 },
      );
    }
  }
```

保持する点: SQL 文字列 (変数補間)、`crypto.randomUUID()` の採番、`'00000000-0000-0000-0000-000000000001'::uuid` の seed owner UUID、20 秒超えの pgconnect 待ちで spec がハングしないよう `timeout: 15_000` を新設。`stdio: "ignore"` はデバッグ困難化するため `pipe` に切り替え (成功時のみ silent、失敗時は catch で stderr を露出 — 後述)。

### Step 2 — `e2e/helpers/v1.ts:135-150` (`truncateV1` の docker → wslc + TRUNCATE 拡張 + fail-loud)

**Before** (`v1.ts:135-150`):

```ts
export async function truncateV1(): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(
      "docker",
      [
        "exec", "tastile-core-db-1",
        "psql", "-U", "tastile", "-d", "tastile_db", "-c",
        "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation RESTART IDENTITY CASCADE;",
      ],
      { stdio: "ignore" },
    );
  } catch {
    // No-op; docker exec is the canonical cleanup path.
  }
}
```

**After**:

```ts
export async function truncateV1(): Promise<void> {
  const { execFileSync } = await import("node:child_process");
  try {
    execFileSync(
      "wslc",
      [
        "container", "exec", "tastile-db",
        "psql", "-U", "tastile", "-d", "tastile_db", "-c",
        "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation RESTART IDENTITY CASCADE;",
      ],
      { stdio: ["ignore", "pipe", "pipe"], timeout: 15_000 },
    );
  } catch (err) {
    console.error(
      "[truncateV1] wslc container exec tastile-db failed; check `wslc container ls` and `bash scripts/wslc/status.sh`",
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}
```

変更点:

| 項目 | Before | After | 理由 |
| --- | --- | --- | --- |
| binary | `docker` | `wslc` | docker 不在 (本ホスト) |
| container name | `tastile-core-db-1` | `tastile-db` | wslc stack の canonical name (`tastile-core/scripts/wslc/up-v1.sh:33-39`) |
| argv shape | `["exec", "tastile-core-db-1", …]` | `["container", "exec", "tastile-db", …]` | `wslc` CLI は `wslc container exec <name> <cmd>` (Docker CLI と語順が同じ) |
| TRUNCATE 列挙 | 6 テーブル + `v1_annotation` | **7 テーブル**: `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation` | `04-e2e-runtime-and-observation.md` §1.3 指摘の gap (`v1_tile` 不在) を解消 |
| `stdio` | `"ignore"` | `["ignore", "pipe", "pipe"]` | エラー時に psql の stderr を `catch` 内で surface 可能化 |
| `timeout` | 無し | `15_000` (15s) | `v1.ts:101` (annotation) と統一。psql が hang しても spec を 20 秒以内に fail |
| catch | `catch {}` (silent no-op) | `catch (err) { console.error(...); throw err; }` | `feedback_observe_actual_behavior.md`: silent pass を退治、spec を fail-loud 化 |

TRUNCATE のカスケード順は既存どおり (FK 依存: `v1_change_set` → `v1_placement` → `v1_event` → `v1_window` / `v1_recurring` → `v1_tile`)。`v1_tile` を末尾に置くのは CASCADE が伝播するため厳密順は不要だが、DDL 定義順 (`tastile-core/crates/v1/api/migrations/`) に近い方が audit しやすい。

### Step 3 — Playwright 起動前 helper の import 確認

`e2e/helpers/v1.ts:1-5` の import はそのまま:

```ts
import { type APIRequestContext, expect } from "@playwright/test";
```

`execFileSync` は `node:child_process` を dynamic import (`v1.ts:94, 136`) しているため、browser bundle には乗らない。`playwright.config.ts:1-34` の `testDir: ./e2e` + `workers: 1` で serial に走る前提を helper の `truncateV1` も満たす。

### Step 4 — import path 統一 (Phase 0 では触らない)

G 親 spec 指示 (`G-stack-up.md:54`) で「FSD 層 (`shared/api/v1`) で統一」とあるが、本 G5a は docker→wslc の機械的置換のみにスコープを絞り、`shared/api/v1` への切り出しは sub-project F / G6* に委ねる (memory `feedback_never_fix_pre_existing_out_of_scope.md` 該当)。

## 検証手順

### V1 — dry-run: wslc → postgres 到達

```bash
# 1. コンテナ名確認 (期待: 行あり)
wslc container ls --format '{{.Names}}' | grep -E '^tastile-db$'

# 2. SELECT 1 が通る
wslc container exec tastile-db psql -U tastile -d tastile_db -c 'SELECT 1;'
# 期待: "?column?\n----------\n 1\n(1 row)"

# 3. TRUNCATE 文を dry-run (--BEGIN/ROLLBACK では無いので TRUNCATE が走り v1_* が空になる)
#    注意: これで v1_placement 等が全部消える。dev DB 前提なので OK。
wslc container exec tastile-db psql -U tastile -d tastile_db -c 'TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation RESTART IDENTITY CASCADE;'
# 期待: "TRUNCATE"
```

### V2 — helper の単体実行 (spec ファイル無しで smoke test)

`e2e/helpers/` に既存 spec は無い (`G-stack-up.md:42-49` は別 4 spec を経由) ため、host の Node から直接叩く smoke script で確認:

```bash
cd tastile-web
bun -e '
import { truncateV1 } from "./e2e/helpers/v1";
await truncateV1();
console.log("[smoke] truncateV1 ok");
'
# 期待: stderr 0 行、stdout "[smoke] truncateV1 ok"
```

`v1.ts:1-5` が `@playwright/test` を import しているため、`bun -e` 単体では失敗する可能性あり。代替:

```bash
cd tastile-web
bun -e '
const v1 = await import("./e2e/helpers/v1");
await v1.truncateV1();
console.log("ok");
' 2>&1 | tee /tmp/g5a-smoke.log
# 期待: "ok" が出る、もしくは import エラーなら Playwright test runner から叩く
```

Playwright 経由の方が確実 (`@playwright/test` の `expect` import が解決される):

```bash
cd tastile-web
bun run test:e2e -- e2e/helpers/v1.spec.ts --grep "truncateV1 smoke"
```

ただし `e2e/helpers/v1.spec.ts` は **本 G5a のスコープ外で作成しない**。既存 helper に spec を足すのは G6* / F の領分。代わりに、以下のコマンドで「現存する 4 spec のうち 1 件を 1 度走らせて helper が fail-loud で無いこと」を確認:

```bash
cd tastile-web
# Phase 0 で stack が立ち上がっている前提
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
# 期待: 失敗するなら docker 起因ではなく v1 API 起因、
#       truncateV1() で詰まっていない (15s timeout 内で戻る or throw)
```

### V3 — TRUNCATE 拡張の検証 (gap fix)

`v1_tile` 残存が再発しないことの確認:

```bash
# spec 走らせる前
wslc container exec tastile-db psql -U tastile -d tastile_db -t -A -c \
  "SELECT count(*) FROM v1_tile"

# bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts 実行直後
wslc container exec tastile-db psql -U tastile -d tastile_db -t -A -c \
  "SELECT count(*) FROM v1_tile"
# 期待: 0 (truncateV1 が v1_tile を含むため)
```

`04-e2e-runtime-and-observation.md` §1.3 で挙げた gap (`truncateV1` が `v1_tile` を含まない) は本 G5a で塞がる。`quick-tile-create-e2e.spec.ts:20` 内の inlined TRUNCATE も同じ 5 テーブル (`v1_tile` 不在) のため、こちらは G5b で別 file を扱う。

## リスク

| Risk | Severity | Mitigation |
| --- | --- | --- |
| `wslc` binary が PATH に無く `execFileSync` が `ENOENT` で throw | high (Phase 0 ブロッカー化) | `v1.ts:138` の `try/catch` で throw し直すので silent 化はしない。operator 側で `winget install wslc` (`feedback_use_wslc_for_rust_build.md` 参照) |
| `tastile-db` コンテナ名 typo (例: `tastile-db-1`, `tastile-pg`) | medium | 必ず `wslc container ls --format '{{.Names}}' \| grep ^tastile` で実行前に確認。`scripts/wslc/up-v1.sh:33-39` で定義される canonical 名は **`tastile-db`** |
| `wslc container exec` の argv shape を `docker exec` と混同 (例: `["container", "exec", "-u", "root", "tastile-db", …]`) | low | 既存 `execFileSync("docker", ["exec", "tastile-core-db-1", "psql", …])` の形と同型に保つ: `["container", "exec", "tastile-db", "psql", …]`。`-u root` 等の prefix が必要なケースは本 Phase 0 では無い |
| G5b / G6* で inlined TRUNCATE (`quick-tile-create-e2e.spec.ts:20`) を `truncateV1()` 呼び出しに置き換えた場合、本 helper の signature 変更が波及 | medium | 本 G5a は `truncateV1()` の signature 不変 (引数 0、戻り `Promise<void>`)。G5b/G6* で必要なら `truncateV1({ includeTile: boolean })` 等の後方互換オプションを G6* で追加。本 G5a では触らない |
| `v1_tile` を TRUNCATE に追加したことで FK 親を drop する副作用 (down-stream spec が `v1_tile` の seed に依存している場合) | medium | `quick-tile-create-*.spec.ts` 系 (G5b 担当) は `Date.now()` ベースの unique title を使う (`quick-tile-create-e2e.spec.ts:32`、`04-e2e-runtime-and-observation.md` §1.3 末尾)。`at-*.spec.ts` 系 (G5b 担当外の 9-table TRUNCATE) は元から `v1_tile` を含むので影響なし。Phase 0 で本 helper を使うのは新規 quick-tile spec のみ |
| `playwright.config.ts:11` `trace: "on-first-retry"` で TRUNCATE 失敗時の trace が出にくい | low | 本 G5a のスコープ外 (config 変更は Phase 全体で見直し)。`feedback_verify_ui_in_browser.md` 推奨の `trace: "on"` 化は G / H 全体で見直す |
| silent fail だった `catch {}` を throw に変えたことで、CI 環境で wslc が無い場合に **新規に Fail** を出す (False negative) | medium | `feedback_integration_test_skip_masks_contract_bugs.md` 該当: skip ではなく Fail を選ぶ (silent pass より健全)。CI 側で wslc が無ければ、それは CI 設定側で解決 (HARNESS.md §WSLC Container 参照) |
| 既存の `docker exec` caller が 5 files 以外にある (`G-stack-up.md:78`) | medium | 本 G5a は helper file のみ扱う。残存 caller は G5b / G6* / sub-project F の issue として別途列挙。grep: `grep -rn 'docker exec' tastile-web/e2e` で 1 度 inventory |

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md` §4 (E2E plumbing rewrite)
- Existing audit: `tile-create-e2e-wiring/04-e2e-runtime-and-observation.md` §1.3 (TRUNCATE リスト gap) / §7.2 (BLOCKER)
- 親 plan (wslc bring-up): `tile-create-e2e-wiring/04-plans/G2a-postgres-up.md` (別途予定)
- 同 pattern: `tile-create-e2e-wiring/04-plans/G1a-wslc-image-build.md` (本ファイルはこの §実装手順 / §受入条件 / §リスク 構造を踏襲)
- Sibling plans: G5b (4 spec file rewrite), G6* (helper signature / post-submit timeline 検証)
- Memory: `feedback_observe_actual_behavior.md` (silent fail 退治), `feedback_no_unverified_pass.md` (silent PASS 退治), `feedback_integration_test_skip_masks_contract_bugs.md` (skip より Fail), `feedback_use_wslc_for_rust_build.md` (wslc 経路統一)
