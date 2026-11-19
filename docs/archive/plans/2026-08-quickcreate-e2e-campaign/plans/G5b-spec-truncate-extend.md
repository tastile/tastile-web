# G5b1 — spec TRUNCATE call sites switch to resetDb()

## メタデータ

- **ID**: G5b1
- **Phase**: 0
- **Target repo**: `tastile-web`
- **Sub-project parent**: G (stack-up)
- **Depends on**: G5a (`resetDb()` now swaps docker→wslc AND adds `v1_tile`/`v1_annotation` to TRUNCATE list)
- **Sibling plans**: G5a (helper rewrite)
- **Source spec**: `04-sub-projects/G-stack-up.md` §4

## 前提

- G5a merged: `tastile-web/e2e/helpers/v1.ts` の `resetDb()` は wslc 経由で 8 テーブル (`v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_tile, v1_annotation, …`) を TRUNCATE する
- `resetDb()` の関数シグネチャは変えない (`resetDb(): void` のまま)
- 4 spec ファイル (`quick-tile-create-e2e.spec.ts`, `quick-tile-create-recurring-e2e.spec.ts`, `quick-tile-create-v1-params.spec.ts`, `quick-tile-edit-delete.spec.ts`) は既存のローカル `deleteAllEvents()` を inline コピペで持っている

## 目的

G5a で docker→wslc 化 + `v1_tile`/`v1_annotation` 追加を済ませた `resetDb()` を、4 spec ファイルがそのまま使えるように置き換える。各 spec の pre-test call shape は変えずに、ヘルパーへの参照を `resetDb()` に切り替えるだけ。これにより:

1. 4 spec の TRUNCATE 漏れ (`v1_tile` 不在によるソース残留) が 一斉に解消される
2. G-stack-up §4 の「post-submit timeline 検証」と並走して pre-test state がクリーンになる
3. 以後の TRUNCATE 拡張 (例: G8 が `v1_condition_atom` を追加するとき) は `resetDb()` 1 箇所変更で済む

## 受入条件

1. 4 spec ファイルすべてが `import { resetDb } from "./helpers/v1"` を持ち、`deleteAllEvents(page/request)` 呼び出しが `await resetDb()` に置換されている
2. 既存 pre-test の call shape (`test.beforeEach(async ({ page }) => { await resetDb(); })`) の形は変えない
3. `bun run test:e2e -- --list-tests` で 4 spec が登録されている
4. いずれかの spec を 1 回実行した前後で `v1_tile` の `count(*)` が 0 → 1 以上に遷移している (post-submit で insert されている証拠)

## 実装手順

各 spec の diff を `tastile-web/e2e/` 起点で示す。

### 共通 diff (`-` = 削除 / `+` = 追加)

各 spec ファイルの先頭 import 領域と `deleteAllEvents` ローカル定義 + `beforeEach` を以下のように書き換える。`deleteAllEvents` は G5a 完了後は各 spec で不要になるので削除。

```diff
-import { test, expect, type Page } from "@playwright/test";
-import { execFileSync } from "node:child_process";
+import { test, expect, type Page } from "@playwright/test";
+import { resetDb } from "./helpers/v1";
```

```diff
-async function deleteAllEvents(_page: Page) { 
-  // /api/events is now 410 (v0 removed).  Wipe the v1 placement+plan rows
-  // directly via docker exec so the day view is fully empty for the next test.
-  execFileSync(
-    "docker",
-    [
-      "exec", "tastile-core-db-1",
-      "psql", "-U", "tastile", "-d", "tastile_db", "-c",
-      "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE;",
-    ],
-    { stdio: "ignore" },
-  );
-}
+// pre-test cleanup delegates to resetDb() (helpers/v1.ts) which now:
+//   (1) routes through wslc container exec tastile-db psql … (no docker)
+//   (2) TRUNCATEs 8 tables — the original 5 (v1_placement, v1_event,
+//       v1_change_set, v1_window, v1_recurring) + v1_tile + v1_annotation
+//       + v1_intent_node (added in G5a).
+// The two new tables matter because v1_tile rows are the source-of-truth
+// the recurring tile -> placement flow writes BEFORE v1_placement, and
+// leaking them across tests corrupts the day view.
```

```diff
 test.beforeEach(async ({ page }) => {
-  await deleteAllEvents(page);
+  await resetDb();
 });
```

### spec 別の追加コメント

各 spec の `beforeEach` 直後に 1 行コメントを入れる:

- `quick-tile-create-e2e.spec.ts` — `// 8-table reset covers v1_tile source rows from prior runs`
- `quick-tile-create-recurring-e2e.spec.ts` — `// recurring source tiles (v1_tile) + v1_annotation get cleared alongside placements`
- `quick-tile-create-v1-params.spec.ts` — `// v1 params write only v1_placement but v1_tile still accumulates per test`
- `quick-tile-edit-delete.spec.ts` — `// edit/delete cycle leaves stale v1_tile if not resetDb()'d`

### import path 統一

G-stack-up §4 末尾「import path は FSD 層 (`shared/api/v1`) で統一」と整合させる。本 G では spec ファイルは e2e ローカルヘルパー (`./helpers/v1`) を import する (FSD ではない) が、これは既存 spec 全 4 ファイルがすでに従っているパターンなので崩さない。`resetDb()` も同 path に置く。

## 検証手順

```bash
cd tastile-web

# 1. 4 spec が登録されている
bun run test:e2e -- --list-tests | grep -E "quick-tile-(create|edit)"
# 期待: 4 行 (create-e2e, create-recurring-e2e, create-v1-params, edit-delete)

# 2. pre-test 実効性の目視: v1_tile が post-submit で増える
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "SELECT count(*) FROM v1_tile;"
# before:  0
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
# after:   >= 1 (QuickCreate が v1_tile を 1 行書いている)

# 3. 次回テスト前に 0 に戻る (resetDb が効いている)
wslc container exec tastile-db psql -U tastile -d tastile_db \
  -c "SELECT count(*) FROM v1_tile;"
# before:  >= 1
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts --grep "sidebar"
# test 開始時の beforeEach で 0 に戻り、その後再度 1 以上で終わる

# 4. 4 件全 Green
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts
bun run test:e2e -- e2e/quick-tile-create-v1-params.spec.ts
bun run test:e2e -- e2e/quick-tile-edit-delete.spec.ts
# 期待: 4 件 全 Green
```

G-stack-up §6 と並走する最終確認:

```bash
curl http://127.0.0.1:31400/v1/health
wslc container ls | grep -E "tastile-db|tastile-v1-api|tastile-v1-worker"
# 出力ログに残す
```

## リスク

1. **`v1_annotation` / `v1_tile` の FK cascade**: TRUNCATE … CASCADE が子テーブルを参照で引っ張り、`v1_event` / `v1_change_set` の FK 制約が連鎖削除される。子孫テーブルの存在を G5a で要確認 — `tastile-core/migrations/` の `v1_tile` / `v1_annotation` 定義を参照テーブルから逆引き
2. **`deleteAllEvents` を spec から消すタイミング**: G5a が未マージの状態で本 G を適用すると `import { resetDb } from "./helpers/v1"` が undefined になる。G5a merge → G5b apply の順を厳守
3. **`resetDb()` の同期性**: `execFileSync` を使っている以上、子プロセス終了まで `beforeEach` がブロックする。wslc cold start だと 1〜2 秒追加の可能性。Playwright 既定 timeout (30s) には収まる想定だが CI で再確認
4. **page vs request fixture**: `quick-tile-create-recurring-e2e.spec.ts:39` は `({ request })` を `beforeEach` に持っている。`resetDb()` は fixture 不要なので `await resetDb()` への置換で OK。fixture 受領は維持
5. **try/catch 削除**: `quick-tile-edit-delete.spec.ts:25-28` の `try { execFileSync… } catch {}` は docker 不在時のフォールバックだが、wslc 化後は不要。G5b で削除して良い

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md` §4
- **Sibling**: G5a (`resetDb()` の docker→wslc 化 + `v1_tile`/`v1_annotation` 追加)
- **Sibling**: G5c (post-submit timeline 検証: `GET /api/proxy/v1/timeline` への切替) — G-stack-up §4 後段
- **Sibling**: G6* (wslc 経由の e2e フル実行 / 並列化)
- **Implementation order**: `tile-create-e2e-wiring/05-impl-order.md`
- **Sub-projects index**: `tile-create-e2e-wiring/00-overview.md`

## 触るファイル一覧 (cite)

- `tastile-web/e2e/quick-tile-create-e2e.spec.ts:14-23` (削除) / `:1-3` (import 追加)
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:14-23` (削除、import に注意 — `:2` で `v1AuthHeaders` も import 済み)
- `tastile-web/e2e/quick-tile-create-v1-params.spec.ts:14-23` (削除)
- `tastile-web/e2e/quick-tile-edit-delete.spec.ts:14-29` (削除 — try/catch 含む)
- `tastile-web/e2e/helpers/v1.ts` (G5a 側で `resetDb()` 追加済み) — 本 G では触らない

各 spec の `beforeEach` (概ね `:27-29` 付近) を `await deleteAllEvents(page/request)` → `await resetDb()` に置換。