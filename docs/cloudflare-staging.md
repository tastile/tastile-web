# Cloudflare staging deployment

Web の preview / staging は OpenNext の Worker として配信する。production
の EC2/standalone workflow はこの移行では変更せず、staging の検証完了後に
別途 cutover を判断する。

## Required Cloudflare resources

- `staging.app.tastile.app` の custom domain を `tastile-web-staging` Worker に接続する
- private staging RDS に到達する Hyperdrive configuration を作り、binding 名を
  `HYPERDRIVE` にする
- 固定 preview (`tastile-web-preview`) 用と staging (`tastile-web-staging`) 用に、production と異なる Hyperdrive configuration を用意する
- Worker secret は environment ごとに登録する（少なくとも
  `BETTER_AUTH_SECRET` と `TASTILE_WEB_BRIDGE_SECRET`）

BetterAuth は browser や Worker から直接 PostgreSQL を開かず、
`getCloudflareContext().env.HYPERDRIVE.connectionString` を `pg.Pool` に渡す。
通常の EC2 実行では `TASTILE_AUTH_DATABASE_URL` を使う。どちらも BetterAuth
専用の least-privilege auth schema に限定し、Core の domain table には接続しない。

## GitHub Environment secrets

`preview` に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、
`CLOUDFLARE_HYPERDRIVE_PREVIEW_ID` を登録する。

`staging` に `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、
`CLOUDFLARE_HYPERDRIVE_STAGING_ID` を登録する。

`release-*` branch の push は staging workflow を起動し、pull request または手動実行は
固定 preview Worker を更新する。preview は PR ごとには分離せず、最後に検証した revision
を共有する。両方とも `CLOUD_API_BASE=https://api.staging.app.tastile.app` と
`E2E_BYPASS_AUTH=0` を明示する。

preview と staging の Worker secret (`BETTER_AUTH_SECRET`、
`TASTILE_WEB_BRIDGE_SECRET`) は Cloudflare Worker secret store に登録し、CI は deploy
後に両方の secret 名が存在することを検査する。preview の BetterAuth secret は staging
と別値にし、bridge secret は接続先 staging Core の値と一致させる。

Issue の当初記載にある `staging.api.tastile.app` は、Cloudflare Free zone の証明書制約で
このアカウントでは nested hostname の edge TLS が成立しないため使用していない。実働の
staging API は `api.staging.app.tastile.app` とし、Web の CI verifier が staging Core 以外
の URL を拒否する。production Worker / production Core / production DB はこの workflow
から参照しない。

## Local validation

実 ID を使った deploy の前に、次のように binding を materialize して設定を検査する。

```powershell
bun scripts/materialize-cloudflare-config.mts `
  --env staging `
  --hyperdrive-id $env:CLOUDFLARE_HYPERDRIVE_STAGING_ID `
  --app-url https://staging.app.tastile.app `
  --output .tmp/wrangler.staging.json
bun run verify:cloudflare -- .tmp/wrangler.staging.json --env staging
```

CI の smoke test は未認証の `/api/auth/session` と `/api/proxy/v1/timeline` が
401 になり、`/api/auth/bridge` がログインへ 307 リダイレクトすることを確認する。
Hyperdrive が到達不能なら protected runtime は 5xx になり、未認証扱いに丸めない。
staging workflow はさらに Core `/v1/ready` の database reachable と Web root 200 を確認し、
preview workflow は固定 preview URL、Web root 200、anonymous session 401 を確認する。

認証済みの browser smoke（sign-in、session reload、bridge、proxy の write/read、
logout）は staging account を必要とするため、デプロイ後の release verification
として実行する。`E2E_BYPASS_AUTH=1` は使用しない。

Cloudflare Worker の rollback は、前の Worker version を再 deploy するか、
staging custom domain の version pointer を戻す。production route と production
database credential はこの workflow から参照しない。
