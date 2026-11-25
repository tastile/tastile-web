# Desktop 認証 contract（web#253 / NF04-W02）

本書は tastile-web 側が固定する Desktop ネイティブ認証の contract である。
実装の分担は次の通りで、本 Issue（W02）は contract の確定と既存境界の維持を
責務とし、endpoint 実装の残差分は web#254（NF04-W03）、Desktop 側実装は
tastile-desktop#53（NF04-D01）、登録制御の実装は web#258（NF04-W07）が担う。

- 正本計画: tastile-root#141（Native-first 正式リリース計画 v0.4）
- 関連 ADR: `../docs/adr/0025-native-first-release-architecture.md`
  （「ネイティブ認証: システムブラウザ、Authorization Code + PKCE、
  スコープ付き Core API token」）
- 先行 contract: `docs/cli/issue-153.md`（`/cli/authorize` +
  `/api/cli/token` の wire contract）、tastile-core `v1/14-read-model-and-endpoint.md`
  §14.5（API-token scopes）、`v1/15-owner-and-profile.md`（identity mapping）

## 1. 維持する不変条件（移行なし）

以下は本 contract で変更しない。既存アカウント（Web / Android / Desktop の
email+password サインイン、`/api/mobile/api-token` 経路）はそのまま利用できる。

- **identity mapping**: Better Auth の user id が
  `v1_subject.external_subject` に保持され、Core 側の owner 導出は
  `Uuid::new_v5(NAMESPACE_OID, external_subject bytes)` で不変
  （ADR 2026-08-22、`v1/15-owner-and-profile.md`）。PKCE 経路でも
  `/api/cli/token` の `subject` はこの user id を返し、Core 側の
  provisioning・owner 解決は既存経路と同一である。
- **認可境界**: Web は `x-tastile-web-bridge-secret` +
  `x-tastile-web-session-user` の bridge credential でのみ Core の
  `/v1/api-tokens` を呼ぶ。Desktop / CLI に bridge secret や
  OwnerAdmin 相当の能力は渡さない。Core の DB へ直接接続する経路は
  追加しない。
- **scope model**: public client に登録できる scope は
  `tastile.read` / `tastile.write` のみ。`all`（OwnerAdmin を含む）は
  API から mint 不可かつ public client の registered set にも含めない
  （`v1/14` §14.5）。
- **fail-closed**: `E2E_BYPASS_AUTH=1` の環境では `/cli/authorize` と
  `/api/cli/token` は `bypass_not_permitted` で拒否する（web#140 の
  fail-closed 方針と同じ境界）。本番必須値
  （`BETTER_AUTH_SECRET` / `TASTILE_AUTH_DATABASE_URL` /
  `TASTILE_WEB_BRIDGE_SECRET`）が欠けた場合、token 発行は失敗し
  fail-open しない。
- **メール確認方針**: `/cli/authorize` は Better Auth session を要求
  するため、sign-up / email verification の方針（web#134 系）は
  authorize 側に別個の gate を追加せず、そのまま継承する。

## 2. Desktop PKCE wire contract

Desktop は `tastile-cli` と同一の endpoint・wire 形式を使う。
`client_id` のみが異なる。専用の `/desktop/*` endpoint は新設しない。

```
GET {web_origin}/cli/authorize
  ?response_type=code
  &client_id=tastile-desktop
  &redirect_uri=http://127.0.0.1:<port>/callback
  &scope=tastile.read tastile.write   （省略時は registered 全集合）
  &state=<opaque>
  &code_challenge=<base64url-sha256(verifier)>
  &code_challenge_method=S256
  → 302 {redirect_uri}?code=<opaque>&state=<echo>
    （未ログイン時は /login?next=... 経由で同 URL へ復帰）

POST {web_origin}/api/cli/token
  body: { "code", "code_verifier", "redirect_uri" }   （ちょうど 3 key）
  Cookie 不要・session を読まない
  → 200 { "token", "expires_at", "subject" }
  → 400 invalid_grant / invalid_scope 系、409 already_used、
    410 gone、502 core_unavailable
```

### client 登録（本 Issue で確定）

| client_id | scopes | redirect_uri |
| --- | --- | --- |
| `tastile-cli` | `tastile.read`, `tastile.write` | `http://127.0.0.1:<port>/callback`（loopback のみ） |
| `tastile-desktop` | `tastile.read`, `tastile.write` | 同上 |

- `tastile-desktop` は `src/shared/auth/cli/clients.ts` に登録済み。
- redirect_uri の検証は `validateLoopbackRedirect` を共用する。
  Desktop は一時的な loopback listener（`/callback` 固定 path、
  ephemeral port）で code を受ける。`tastile://` カスタムスキームは
  PKCE callback には使わない（レガシー OAuth callback の名残であり、
  redirect_uri validator の対象外）。
- mint される Core API token の `label` は grant の `client_id` を
  使う（`/api/cli/token` が `consumed.clientId` をそのまま渡す）。
  account の token 一覧で CLI / Desktop の credential を区別できる。

### コード・token の寿命と単発性

- authorization code: 発行から **5 分**、`used_at` の条件付き UPDATE
  による atomic claim で **単発**（再利用は 409 `already_used`）。
  平文 code は保存せず sha256 hash のみ。
- Core API token: **30 日**（Better Auth session 寿命と同じ、
  `cliTokenExpiresAtIso`）。scope は requested ∩ registered の
  canonical sorted 形で、`"all"` にはならない。
- `web_cli_auth_grant.core_token_id` に Core 発行の token id を保存し、
  監査・失効の追跡に使う（bearer 平文は保存しない）。

## 3. token 失効 contract

Desktop が保持するのは Core API token（`tastile.read` +
`tastile.write`）のみで、Better Auth session token ではない。
失効経路は次の 3 系統で、いずれも既存のまま利用できる。

1. **自己失効**: Desktop は `POST {core}/v1/auth/signout` に自身の
   bearer を付けて呼ぶ。`authenticate_v2()` を要求するが scope 検査は
   なく、呼び出した credential 自身を revoke する
   （`v1/14` §14.5 Special 行）。
2. **ユーザー主導の失効**: Web の account 画面が proxy する
   `GET/DELETE /api/account/tokens[/{id}]`（bridge 経由で Core
   `DELETE /v1/api-tokens/{id}`）で、label `tastile-desktop` の
   token をユーザーが失効できる。
3. **期限切れ**: 30 日で自然失効。更新は token refresh ではなく
   PKCE 再認証（`/cli/authorize` からやり直し）で行う。

## 4. 登録制御との境界（W07 への引き継ぎ）

- 登録制御（招待制・登録上限・不正登録防止、web#258）は sign-up 面の
  責務であり、本 contract の authorize / token 経路には gate を
  追加しない。`/cli/authorize` は既に Better Auth session を必須と
  するため、新規登録を制限すれば PKCE 経路も自動的に制限される。
- W07 が導入する登録 gate は `emailAndPassword` / social sign-up の
  受け口に置くこと。`/cli/authorize`・`/api/cli/token`・
  `/api/mobile/api-token` の wire contract は変更しない。
- 既存アカウントの利用を縮小しない（計画 v0.4 の境界）。登録上限は
  新規 sign-up のみに適用する。

## 5. W03 / D01 が実装する残差分

- **web#254（W03）**: 本 contract の wire 形式で Desktop の E2E を
  実機検証する。consent 画面（`/cli/consent`）の文言が client_id を
  そのまま表示するため、必要なら `tastile-desktop` 向けの表示調整を
  行う。endpoint 自体の追加は不要（client 登録済み）。
- **desktop#53（D01）**: システムブラウザで `/cli/authorize` を開き、
  loopback listener で `code` + `state` を受け、`/api/cli/token` で
  交換して token を DPAPI 保管する。`state` の照合・verifier 生成・
  失効（§3-1）は Desktop 側の責務。
