# G7a — first E2E run (quick-tile-create-e2e.spec.ts) procedure

## メタデータ

- **ID**: G7a
- **Phase**: 0 (stack-up verification)
- **Target repo**: `tastile-web`
- **Sub-project parent**: G (stack-up)
- **Depends on**: G6a (playwright config), G6b (bridge secret), G6c (spec file rewrite)
- **Source spec**: `04-sub-projects/G-stack-up.md` §6
- **Sibling plans**: G7b (recurring / v1-params / edit-delete run)

## 前提

- G1a〜G1c: `tastile-v1-api:latest` / `tastile-v1-worker` / `tastile-db` イメージ build 済
- G2a〜G2c: wslc volume + network + `scripts/wslc/up-v1.sh` 経由の 3 コンテナ起動経路が動作
- G3a/G3b: postgres readiness loop + migration 適用済 (volumes 上に `v1_*` テーブルが存在)
- G4: `tastile-core` 側で `bash scripts/wslc/up-v1.sh` 一発で stack が立ち上がる状態
- G5a: pre-test TRUNCATE helper が `v1_tile, v1_annotation, v1_placement, v1_event, v1_change_set, v1_window, v1_recurring` の 7 テーブルを網羅
- G5b: post-submit 検証が `/api/proxy/v1/timeline?start=…&end=…&owner_ids=…` (v1 `EffectivePlacement[]`) を叩く形に書き換え済
- G6a: `tastile-web/playwright.config.ts` に `E2E_BYPASS_AUTH=1` / `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` / `NEXT_PUBLIC_DAEMON_BASE_URL=http://localhost:31400` / `TASTILE_RUST_API_URL=http://127.0.0.1:31400` / `TASTILE_USE_RUST_CORE=1` / `TASTILE_WEB_BRIDGE_SECRET` / `reuseExistingServer: true` / `timeout: 120_000` が揃っている
- G6b: `BRIDGE_SECRET` を `tastile-web/.env.development` の `TASTILE_WEB_BRIDGE_SECRET` と一致させて export 済
- G6c: `tastile-web/e2e/quick-tile-create-e2e.spec.ts` が新 v1 経路 (TRUNCATE + proxy timeline) に書き換え済

## 目的

stack-up 完了後、`tastile-web/e2e/quick-tile-create-e2e.spec.ts` を実際に走らせて QuickCreate → v1 timeline の end-to-end が通る最初の証拠を取る。Green なら G7b (残り 3 spec) へ進む。Red なら failure-mode トリアージ表 (§ 実装手順 4) に従って切り戻す。

## 受入条件

- `bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts` の exit code = 0
- spec 内 trace で次の順序が確認できる:
  1. QuickCreate panel が `getByRole('dialog')` 等で開く
  2. identity (label / owner subject) フィールドが入力される
  3. plan (start / duration / kind 選択) フィールドが入力される
  4. submit ボタンがクリックされる
  5. レスポンスとして `GET /api/proxy/v1/timeline?start=…&end=…&owner_ids=…` が `200` を返し `EffectivePlacement[]` に新規 placement を含む
- 実行ログを `tile-create-e2e-wiring/logs/G7a-<YYYY-MM-DD>.log` に append (or § 結果 セクションへ貼付)
- pre-flight の 5 項目すべて pass (G7a 開始時に出力された証拠を残す)

## 実装手順

### Step 1: pre-flight checklist (順序厳守)

```bash
# 1-a. API 健全性
curl -s http://127.0.0.1:31400/v1/health
# 期待: {"status":"ok", ...}

# 1-b. 3 コンテナ稼働確認
wslc container ls --format "{{.Names}} {{.Status}} {{.Ports}}" \
  | grep -E "tastile-db|tastile-v1-api|tastile-v1-worker"
# 期待: 3 行すべて "Up" + api は "0.0.0.0:31400->31400"

# 1-c. tastile-web の依存
cd tastile-web && bun install --frozen-lockfile
# 期待: "Done" で終了、error なし

# 1-d. playwright.config.ts の env 注入確認
grep -nE "E2E_BYPASS_AUTH|NEXT_PUBLIC_E2E_BYPASS_AUTH|NEXT_PUBLIC_DAEMON_BASE_URL|TASTILE_RUST_API_URL|TASTILE_USE_RUST_CORE|TASTILE_WEB_BRIDGE_SECRET|reuseExistingServer|timeout:" \
  tastile-web/playwright.config.ts
# 期待: 8 ヒット (G6a の成果物)
# 特に timeout: 120_000 が G6a で propagate 済みかを必ず目視 (下記 リスク § 参照)

# 1-e. BRIDGE_SECRET export
echo "${BRIDGE_SECRET:-<NOT_EXPORTED>}"
test -n "$BRIDGE_SECRET" || {
  echo "BRIDGE_SECRET が未 export。tastile-web/.env.development:26 から取得して export する"
  exit 1
}
# 期待: G6b で export した値 (空文字不可)
```

### Step 2: テスト実行

```bash
cd tastile-web
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
```

- `--reporter=line` を付けない (default の list reporter で spec 名 + pass/fail が見える方が evidence として強い)
- 失敗時に screenshot / trace を見たい場合は `bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts --trace=on` を再実行

### Step 3: 出力の読み方

期待される stdout (概念):

```
Running 1 test using 1 worker
  ✓  e2e/quick-tile-create-e2e.spec.ts > quick-tile-create > creates a tile and appears in v1 timeline (2.4s)
  1 passed (3.1s)
```

NG パターン別:

- `Error: 401` / `403` → bridge secret 不整合 (G6b 戻り)
- `Error: connect ECONNREFUSED 127.0.0.1:31400` → api コンテナ落ち
- `TimeoutError: page.click: Timeout 30000ms exceeded` → サーバ未起動 / panel 未描画 (default 30s。G6a の 120s が反映されているかも要確認)
- `expect(locator).toBeVisible() failed` → UI ラベル変更 / QuickCreate 非表示

### Step 4: failure-mode triage (4 系統)

| 症状 | 原因候補 | 戻り先 |
| --- | --- | --- |
| 401 / 403 (proxy or `/v1/timeline`) | bridge secret mismatch | G6b — `BRIDGE_SECRET` を `.env.development:26` と再同期 |
| 410 Gone on `/api/events/occurrences` | spec ファイルが v0 検証のまま | G5b / G6c — `quick-tile-create-e2e.spec.ts:14-23` の post-submit ブロックを v1 timeline proxy に書き換え |
| Playwright `TimeoutError` 30s | (a) `bun run dev` 未起動 / port 3000 競合<br>(b) `playwright.config.ts:timeout` が 30s のまま | (a) 別ターミナルで `cd tastile-web && bun run dev` を確認<br>(b) G6a の `timeout: 120_000` が propagate しているか再確認 |
| DB row 欠落 (timeline 200 だが空配列) | pre-test TRUNCATE が `v1_tile` を含めていない | G5a — `e2e/helpers/v1.ts:93-103,135-150` の TRUNCATE リストに `v1_tile, v1_annotation` 追加済か確認 |
| Migration error (api 起動時ログ) | `migration::migrate` が `v1_*` DDL に失敗 | G2b — `wslc container logs tastile-v1-api 2>&1 \| tail -100` で原因 SQL を特定 |

### Step 5: 結果記録

`tile-create-e2e-wiring/04-plans/G7a-e2e-run-quick-tile.md` の末尾に `## 結果` セクションを追記し、以下を貼付:

- pre-flight 5 項目の出力 (curl / `wslc container ls` / `bun install` / grep / `echo $BRIDGE_SECRET` の最初の数行)
- テスト実行ログ (pass / fail を含む全体)
- failure-mode に該当した場合は § 4 の表のどの行に該当したかと、戻り先 plan の状況

ログが長くなる場合 (>200 行) は `tile-create-e2e-wiring/logs/G7a-<YYYY-MM-DD>.log` に分離し、本ファイルには要約 + ログファイルへの相対パスのみ残す。

## 検証手順

検証は「実装手順 § 1〜§ 5」と一体。完了判定は § 受入条件 の 3 項目:

1. exit code = 0 (`echo $?` 確認)
2. trace の 5 ステップが `playwright report` または `--trace=on` 時の HTML 上で時系列に並ぶ
3. ログが § 5 に従い `04-plans/G7a-…md` § 結果 or `logs/G7a-<date>.log` に残っている

補助: テスト後に `wslc container logs tastile-v1-api 2>&1 | tail -50` を採取し、spec 実行中の api 側 log に `POST /v1/placements` と `GET /v1/timeline` がペアで出ていることを確認 (QuickCreate 経路が実際に v1 を通った直接証拠)。

## リスク

- **Playwright timeout default 30s**: G6a の `playwright.config.ts:timeout: 120_000` が propagate していないと、QuickCreate の form 表示〜submit〜response 受信が 30s 以内に終わらず flake する。Step 1-d で `timeout: 120_000` の行を必ず目視確認。fallback: テスト内で `test.setTimeout(180_000)` を該当 spec 冒頭に足す (恒久対策は G6a の戻し確認)
- **spec flaky if UI labels change**: QuickCreate のラベル (`"タイトル"` / `"開始"` 等) を i18n 側で書き換えると `getByLabel` 系 locator が壊れる。再発する場合は `quick-tile-create-e2e.spec.ts` に `await expect(page.getByTestId('quick-create-panel')).toHaveScreenshot('quick-create.png', { maxDiffPixelRatio: 0.02 })` のような snapshot test を pin する (本 G のスコープ外。§ 関連 の G7b 後の stabilization で扱う)
- **wslc container 再起動で `BRIDGE_SECRET` 引き継ぎ忘れ**: `bash scripts/wslc/up-v1.sh` 内の `TASTILE_WEB_BRIDGE_SECRET` は `scripts/wslc/up-v1.sh` が default を読む仕様。G6b で export した値が wslc コンテナ env として伝播しているか `wslc container inspect tastile-v1-api --format '{{.Config.Env}}' | tr ' ' '\n' | grep TASTILE_WEB_BRIDGE_SECRET` で必ず確認
- **`reuseExistingServer: true` で dev サーバが古いバイナリ掴み**: 前回 `bun run dev` の残骸が port 3000 を listen していると、別バージョンが host される。`curl -s http://localhost:3000/api/health` の mtime / hash を `tastile-web/.next/BUILD_ID` と突合する (G6a 後の初回 G7a で必ず通す)
- **port 31400 衝突**: `scripts/wslc/up-v1.sh` の `-p 127.0.0.1:31400:31400` が別プロセスに取られていると api bind 失敗。`netstat -ano | findstr :31400` (Windows) or `ss -ltnp | grep 31400` (wslc 内) で掃除する

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/G-stack-up.md` §6
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Sibling: G7b (recurring / v1-params / edit-delete 3 spec 連続実行手順)
- Dependency chain: G6a (config) → G6b (secret) → G6c (spec file) → **G7a** (run) → G7b (run)
- 失敗時の戻り先: G5a (TRUNCATE) / G5b (post-submit) / G6a (config) / G6b (secret) / G2b (migration)
