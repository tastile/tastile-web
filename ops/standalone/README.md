# Standalone VM デプロイ (NF04-W01 / tastile-web#252)

Next.js `output: "standalone"` バンドルを Docker/Compose で VM 上に起動し、
Cloudflare Tunnel 配下で公開するための最小構成。シークレット取得に
Infisical を使うため、有料クラウド依存なしで build・起動・healthcheck
まで完結する。

## 構成

- `Containerfile`（repo root）: `oven/bun` で `bun run build:prod` →
  `node:*-slim` で `node server.js` を実行。`HEALTHCHECK` は
  `GET /api/health`（liveness）を叩く。
- `compose.yaml`: 上記イメージの build/run 定義。port 3000 を公開し、
  `restart: unless-stopped`。
- `src/app/api/health/route.ts`:
  - `GET /api/health` — liveness。Core API の状態に関係なく 200 を返し、
    Docker healthcheck / 再起動判定に使う。
  - `GET /api/health?deep=1` — readiness。`CLOUD_API_BASE` の
    `/v1/health` を 2 秒 timeout で確認し、未達なら 503。運用監視・
    手動確認用で、コンテナの再起動条件には使わない（Core 停止で
    web を落とさないため）。

## build / 起動

リポジトリルートで実行する。`infisical` CLI の machine identity 認証が
前提（`ops/systemd/tastile-web.service.example` と同じ `/tastile/web`
path）。

```sh
# 初回 / 更新時: build + 起動
docker compose -f ops/standalone/compose.yaml up -d --build

# 状態確認（healthcheck 結果を含む）
docker compose -f ops/standalone/compose.yaml ps
docker inspect --format '{{.State.Health.Status}}' tastile-web

# ログ
 docker compose -f ops/standalone/compose.yaml logs -f web
```

`APP_VERSION` は build arg として `NEXT_PUBLIC_APP_VERSION` に焼き込まれ、
`/api/version`・`/api/health` の `version` フィールドで確認できる。

## Cloudflare Tunnel 接続

VM 上で `cloudflared` を動かし、公開 hostname（例:
`app.tastile.app`）を `http://localhost:3000` に向ける。Tunnel は
無料枠の範囲で運用し、有料トンネルや Access 有料機能は使わない。
`/api/health?deep=1` を Tunnel の public hostname には公開しない
（内部・監視経路のみで使う）。

## Core API 接続の確認

1. `docker compose -f ops/standalone/compose.yaml exec web \
   node -e "fetch('http://127.0.0.1:3000/api/health?deep=1').then(r=>r.json()).then(console.log)"`
   が `{"status":"ok",...,"core":"ok"}` を返すこと。
2. ブラウザで `https://<tunnel-host>/login` が表示され、ログイン後の
   dashboard が Core の read-model を取得できること。

## やらないこと

- `env_file` に実値を置かない。実行時シークレットは `infisical run` で
  注入する（compose.yaml 冒頭コメント参照）。
- healthcheck を `?deep=1` に変えない。Core 障害で web コンテナが
  再起動ループするのを防ぐため、liveness と readiness を分離する。
