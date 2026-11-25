# tastile 製品サイト (静的サイト)

NF04-W05 (tastile-web#256)。製品サイト / LP を Cloudflare Pages Free の静的配信へ
移し、Core API や Next.js アプリが停止していても製品情報を表示できるようにする。

## 境界

| 配信先 | 対象パス | 内容 |
| --- | --- | --- |
| Cloudflare Pages (本ディレクトリの生成物) | `/`, `/pricing`, `/download`, `/privacy`, `/terms`, `/tokushoho` | 認証・課金・Core API に依存しない公開マーケティングページ |
| Next.js アプリ (既存デプロイ) | `/login`, `/auth/*`, `/dashboard`, `/app`, `/cli`, `/docs/api`, `/api/*` | セッション・Better Auth・Stripe・Core API が必要なすべて |

- 静的サイトは `src/app/` の実ページコンポーネントと i18n 辞書を
  `react-dom/server` でレンダリングして生成する (`scripts/build-site.mts`)。
  コピーは `src/` が正本であり、静的側へ複製しない。
- locale はパスベース: `en` は接頭辞なし (`/pricing/`)、それ以外は
  `/{locale}/...` (`/ja/pricing/`)。legal 3 ページはアプリと同じく英語のみ。
- `/login` などアプリ専用パスは `_redirects` で `TASTILE_SITE_APP_ORIGIN`
  (既定 `https://app.tastile.app`) へ 302 する。DNS カットオーバー後も
  apex ホスト上の既存 URL が壊れないようにするため。

## ビルド

```bash
bun run site:build
# 出力: site/dist/ (gitignore 済み)
```

環境変数:

- `TASTILE_SITE_APP_ORIGIN` — アプリ側 origin。未指定時は
  `https://app.tastile.app`。staging 等へ出す場合は必ず指定する。

## デプロイ (Cloudflare Pages Free)

Cloudflare アカウント側の操作は人間が行う (agent は credential / DNS を触らない)。

```bash
# 初回: Pages プロジェクト作成 (dashboard または CLI)
bunx wrangler pages project create tastile-site --production-branch=main

# デプロイ (要 `wrangler login` または CLOUDFLARE_API_TOKEN)
bun run site:deploy
# = bun run site:build && wrangler pages deploy site/dist --project-name=tastile-site
```

- production branch を `main` (または release 統合ブランチ) に合わせる。
- カスタムドメイン (例: apex `tastile.app`) は Pages プロジェクトの
  Custom domains で接続する。DNS 変更は承認境界のため人間が実施する。
- Core API / Next.js アプリの停止・障害時も `site/dist` の静的ファイルは
  Pages エッジから配信されるため、製品情報ページは Core 非依存で表示される。

## 含まれないもの

- `/docs/api` — Scalar が `/api/openapi` を実行時取得するため静的化しない。
  アプリ側に残す。
- `/login`, `/auth/*`, `/dashboard`, `/app`, `/cli` — 認証・アプリ機能。
- Google Analytics / DemoSiteBanner — アプリ layout 側の要素であり、
  静的サイトには含めない。
