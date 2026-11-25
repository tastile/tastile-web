# G — wslc stack bring-up + E2E plumbing 修正

## 1. 目的

`quick-create` が DB へ届く状態を wslc で再現する。既存 E2E 4 spec + 1 helper が `docker exec` を叩いているが本ホストには Docker が無いため、wslc 経路へ書き換える + `v1_tile` / `v1_annotation` が TRUNCATE から漏れている + post-submit 検証が v0 (`/api/events/occurrences` = 410 Gone) を見ている、の 3 点を解消する。

## 2. Bring-up sequence

`tastile-core/` 直下から:

```bash
# 1. イメージ build (5〜10 分 cold、warm は秒)
bash scripts/wslc/build.sh

# 2. core + db + worker を起動
bash scripts/wslc/up-v1.sh

# 3. 稼働確認
bash scripts/wslc/status.sh
curl -s http://127.0.0.1:31400/v1/health   # → {"status":"ok",...}

# 4. 停止 (volume + network は保持)
bash scripts/wslc/down.sh
```

`scripts/wslc/up-v1.sh` は `tastile-net` + `tastile-pgdata` volume 上に postgres:16-alpine と api:31400 を展開。postgres readiness loop (`pg_isready -U tastile -d tastile_db`) で DB 立ち上がり後に api を起動する。

## 3. Bridge secret alignment

`tastile-web/.env.development:26` の `TASTILE_WEB_BRIDGE_SECRET` (= `E5SzuyY3s8Sz0-…`) と `scripts/wslc/up-v1.sh` の default (`wslc-dev-bridge-secret`) は別物。ずれ込むと web → api の bridge auth が `Err(BridgeAuthFailed)` で全滅するため **bring-up 前に揃える**:

```bash
export BRIDGE_SECRET="<paste from tastile-web/.env.development>"
bash scripts/wslc/up-v1.sh
```

恒久対策は sub-project **H — auth bridge** (回転 / 起動順序 / 検証ヘルパの整理) で扱う。本 G では起動前の export 1 行で足りる。

## 4. E2E plumbing rewrite

触る 5 ファイル:

- `tastile-web/e2e/helpers/v1.ts:93-103,135-150`
  - `execFileSync("docker", ["exec", "tastile-core-db-1", "psql", …])` → `execFileSync("wslc", ["container", "exec", "tastile-db", "psql", "-U", "tastile", "-d", "tastile_db", "-c", sql])`
  - TRUNCATE リストへ `v1_tile, v1_annotation` を追加 (現状 `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring` の 6 テーブル。`v1_tile` 不在でソースが残りフロー追試が汚染される)

- `tastile-web/e2e/quick-tile-create-e2e.spec.ts:14-23`
- `tastile-web/e2e/quick-tile-create-recurring-e2e.spec.ts:14-23`
- `tastile-web/e2e/quick-tile-create-v1-params.spec.ts:14-23`
- `tastile-web/e2e/quick-tile-edit-delete.spec.ts:14-23`
  - 同 TRUNCATE 拡張 + pre-test TRUNCATE helper の呼び出し
  - post-submit 検証: `GET /api/events/occurrences` (v0, 410 Gone) → `GET /api/proxy/v1/timeline?start=…&end=…&owner_ids=…` (v1 の `EffectivePlacement[]`)

import path は FSD 層 (`shared/api/v1`) で統一。

## 5. Playwright config check

`tastile-web/playwright.config.ts:15-27` を再確認 — 既に `E2E_BYPASS_AUTH=1` / `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` / `NEXT_PUBLIC_DAEMON_BASE_URL=http://localhost:31400` / `TASTILE_RUST_API_URL=http://127.0.0.1:31400` / `TASTILE_USE_RUST_CORE=1` / `reuseExistingServer: true` / `timeout: 120_000` が揃っている。本 G では **触らない**。要確認は「`TASTILE_WEB_BRIDGE_SECRET` が `webServer.env` に乗っているか」1 点のみで、欠けていれば環境変数として注入する。

## 6. Verification

```bash
cd tastile-web
bun run test:e2e -- e2e/quick-tile-create-e2e.spec.ts
bun run test:e2e -- e2e/quick-tile-create-recurring-e2e.spec.ts
bun run test:e2e -- e2e/quick-tile-create-v1-params.spec.ts
bun run test:e2e -- e2e/quick-tile-edit-delete.spec.ts
# 4 件 全 Green + post-submit timeline 取得 OK = 本 G 完了
```

加えて `curl http://127.0.0.1:31400/v1/health` と `wslc list | grep -E "tastile-db|tastile-v1-api|tastile-v1-worker"` を出力ログに残す。

## 7. リスク

- **wslc image cold build が 5〜10 分** — CI と同等の cold cache ヒット率を期待。warm なら秒
- **port 31400 衝突** — `scripts/wslc/up-v1.sh` が `-p 127.0.0.1:31400:31400` で host bind するため、別プロセスが掴んでいたら失敗
- **wslc binary 不在** — `wslc.exe` が PATH にない環境ではタスクブロック。インストールは `HARNESS.md` §WSLC Container 参照
- **既存の docker exec を一部残したまま** — 4 spec + 1 helper 以外の場所で `docker exec` を call している箇所があれば個別対応 (本 G のスコープ外)

## 8. オープン質問

なし (mechanical な書き換えのみ)。
