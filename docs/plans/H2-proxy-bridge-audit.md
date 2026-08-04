# H2 — Proxy route bridge-mode audit

## メタデータ

- **ID**: H2
- **Phase**: 0 (audit; no code change in this plan)
- **Target repo**: `tastile-web`
- **Sub-project parent**: H (auth-bridge)
- **Depends on**: H1 (env var alignment check, optional)
- **Source spec**: `04-sub-projects/H-auth-bridge.md` §"Web-side wiring"
- **Sibling plans**: H3 (proxy route tests), H4 (core-side bridge smoke test)
- **Scope**: `tastile-web/src/app/api/proxy/[...path]/route.ts` (213 lines, 6 HTTP verbs)

## 前提

- `tastile-core` v1 daemon is running locally (or reachable via `CLOUD_API_BASE`)
- `tastile-web/.env.development` has both `E2E_BYPASS_AUTH` and `TASTILE_WEB_BRIDGE_SECRET` set
- Core side `bridge_auth_from_headers` at `crates-v1/api/src/handlers/common.rs:801-823` is the reference contract — proxy route must inject exactly the two header names it expects
- Source spec is `04-sub-projects/H-auth-bridge.md` §"Web-side wiring"; line numbers in this plan refer to `route.ts` as of this plan's date unless noted

## 目的

3-way 分岐（`E2E_BYPASS_AUTH=1` / `COOKIE_USER_SUB` present / otherwise 401）が spec 通りに実装されているかを静的に確認し、不足点を H3 / H4 で補えるように明細化する。**コード変更は H2 では行わない**。成果物:

1. 行番号付きの監査チェックリスト（PASS/FAIL/NA）
2. spec との差異リスト
3. 各分岐の期待動作を確定し、H3（proxy route tests）のテストケースに変換できる形にする
4. 監査ログを `tile-create-e2e-wiring/logs/H2-proxy-audit-<date>.log` に書き出す

## 受入条件

- 監査チェックリストの全項目に PASS/FAIL/NA と根拠（行番号引用）が付与されている
- spec との差異が 0 件、または差異ごとに H3/H4 で対応するテストケースが紐付いている
- `logs/H2-proxy-audit-<date>.log` が生成され、`tile-create-e2e-wiring/05-impl-order.md` から参照可能
- H3（proxy route tests）のテストケース input/output が本計画のチェックリストから直接コピーできる形で列挙されている

## 実装手順

### ステップ 1 — ファイル全体の読み込み

```bash
# ファイル全体の行数確認
wc -l tastile-web/src/app/api/proxy/[...path]/route.ts
# 期待: 213 行
```

Read tool で 1〜213 行を全て取得する。3-way 分岐は L17 `proxyRequest()` 内に集約されている（GET/POST/PUT/PATCH/DELETE ハンドラ L175-213 は全て同関数を呼ぶ）。

### ステップ 2 — E2E_BYPASS_AUTH 分岐の監査 (L11-13, L30-32)

確認ポイント:

| # | 項目 | 期待 | 確認箇所 |
|---|---|---|---|
| 2.1 | `E2E_BYPASS_AUTH` の判定が厳密等価 `"1"` | `process.env.E2E_BYPASS_AUTH === "1"` | `route.ts:12` |
| 2.2 | `x-owner-id` ヘッダが設定される | `headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID)` | `route.ts:31` |
| 2.3 | `x-actor-id` ヘッダが設定される | `headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID)` | `route.ts:32` |
| 2.4 | 固定 UUID の値 | `00000000-0000-0000-0000-000000000001` | `route.ts:15` |
| 2.5 | bridge ヘッダが付かない | `x-tastile-web-bridge-secret` / `x-tastile-web-session-user` が `headers` に出現しない | L30-32 をスコープで確認 |
| 2.6 | `Authorization: Bearer …` も付かない | `apiToken` 読み込みパスが L34 にしかないことを確認 | L30-32 は else に入らない |

**Spec 整合性**: `H-auth-bridge.md` §"Web-side wiring" の `E2E_BYPASS_AUTH=1` 節と一致することを確認。spec 側に「bridge secret 不要」の明記があるため、L30-32 で `TASTILE_WEB_BRIDGE_SECRET` を要求しないことが正しい。

### ステップ 3 — bridge 分岐の監査 (L33-57)

確認ポイント:

| # | 項目 | 期待 | 確認箇所 |
|---|---|---|---|
| 3.1 | `COOKIE_USER_SUB` の取得元 | `request.cookies.get(COOKIE_USER_SUB)?.value` | `route.ts:35` |
| 3.2 | `COOKIE_API_TOKEN` の取得元 | `request.cookies.get(COOKIE_API_TOKEN)?.value` | `route.ts:34` |
| 3.3 | `COOKIE_USER_SUB` の import 経路 | `@/shared/auth/cookies`（L1）または `@/lib/cognito/cookie-names`（project memory 推奨） | `route.ts:1` と memory 比較 |
| 3.4 | `TASTILE_WEB_BRIDGE_SECRET` の取得元 | `process.env.TASTILE_WEB_BRIDGE_SECRET` | `route.ts:49` |
| 3.5 | 環境変数未設定時の挙動 | `console.warn` を出して bridge ヘッダなしで upstream にフォールスルー（**401 は出ない**） | `route.ts:50-55` |
| 3.6 | `x-tastile-web-bridge-secret` の設定 | `headers.set("x-tastile-web-bridge-secret", bridgeSecret)` | `route.ts:53` |
| 3.7 | `x-tastile-web-session-user` の設定 | `headers.set("x-tastile-web-session-user", userSub)` | `route.ts:54` |
| 3.8 | `userSub` の値検証 | **空文字 / 長さチェックなし**（spec: "any non-empty string in dev"） | L48-55 にバリデーション不在を確認 |
| 3.9 | `apiToken` がある時の挙動 | `Authorization: Bearer ${apiToken}` を別途設定 | `route.ts:45-47` |
| 3.10 | `apiToken` と `userSub` 両方ある時 | 両方設定（両認証経路が parallel に立つ） | L45-47 と L48-55 |

**重要**: L36 の `if (!apiToken && !userSub)` は**両方が無い**時のみ 401/redirect。`apiToken` のみ / `userSub` のみでも通る。spec には「`COOKIE_USER_SUB` が唯一の必要 cookie」と書いてあるが、**実装は apiToken だけでも bridge 分岐を通る**ことに注意（後方互換）。

### ステップ 4 — 401 分岐の監査 (L36-44)

確認ポイント:

| # | 項目 | 期待 | 確認箇所 |
|---|---|---|---|
| 4.1 | 401 判定条件 | `!apiToken && !userSub` | `route.ts:36` |
| 4.2 | HTML accept の場合の挙動 | `/login?error=session_expired` へ 307 redirect | `route.ts:37-42` |
| 4.3 | 非 HTML の場合の挙動 | `NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 })` | `route.ts:43` |
| 4.4 | 401 の body が JSON | `error` フィールドを持つ JSON オブジェクト | `route.ts:43` |
| 4.5 | `WWW-Authenticate` ヘッダ | **無い**（spec にも要求なし、core 側 `authenticate()` の 401 にも付かない） | 確認のみ |

### ステップ 5 — spec 差異の記録

差異が出やすい箇所を事前予測:

- **D1**: L1 の import が `@/shared/auth/cookies` で、project memory (`feedback_tastile_web_cookie_imports.md`) は `@/lib/cognito/cookie-names` を推奨している。`@/lib/cognito/cookies` は `next/headers` を引きずって Turbopack を壊すため NG とあるが、`@/shared/auth/cookies` は安全か未確認。`tastile-web/src/shared/auth/cookies.ts` を読んで `next/headers` を import していないことを確認（H3 でテスト前に解消する想定）。
- **D2**: spec §"Auth contract" は "user_sub … any non-empty string in dev" だが、route.ts は空文字 `""` を許容してしまう（`!userSub` は `undefined` のみ false、空文字 truthy）。これは実装のゆるさであり、core 側 `bridge_auth_from_headers`（`common.rs:801`）の挙動に依存。core 側で空文字を弾くかを確認。
- **D3**: spec §"Web-side wiring" は "Otherwise → 401" と単純化しているが、実装は HTML accept 時に redirect する。spec への追記候補。
- **D4**: bridge secret 未設定時（L50-55）、警告のみで upstream に到達する。core 側 `bridge_auth_from_headers` は secret ヘッダが無ければ fail するので結果として 401 になるが、**proxy route 自体は 200 で upstream 応答を返す**。テストでは upstream 401 を確認する必要がある。

### ステップ 6 — 監査ログの書き出し

`tile-create-e2e-wiring/logs/H2-proxy-audit-<date>.log` を以下のスキーマで作成する:

```log
# H2 proxy bridge audit — <date>
# Target: tastile-web/src/app/api/proxy/[...path]/route.ts
# Spec:   tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md

== E2E_BYPASS_AUTH branch (L11-13, L30-32) ==
[2.1] PASS — `process.env.E2E_BYPASS_AUTH === "1"` at L12
[2.2] PASS — `headers.set("x-owner-id", ...)` at L31
[2.3] PASS — `headers.set("x-actor-id", ...)` at L32
[2.4] PASS — DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001" at L15
[2.5] PASS — L30-32 scope does not set bridge headers
[2.6] PASS — L34 cookie read is in else branch only

== Bridge branch (L33-57) ==
[3.1] PASS — `request.cookies.get(COOKIE_USER_SUB)?.value` at L35
[3.2] PASS — `request.cookies.get(COOKIE_API_TOKEN)?.value` at L34
[3.3] NOTE — import is from "@/shared/auth/cookies" (L1), project memory prefers "@/lib/cognito/cookie-names". Investigate whether @/shared/auth/cookies re-exports from there.
[3.4] PASS — `process.env.TASTILE_WEB_BRIDGE_SECRET` at L49
[3.5] NOTE — secret unset => warn + forward without bridge headers (upstream will 401)
[3.6] PASS — `headers.set("x-tastile-web-bridge-secret", bridgeSecret)` at L53
[3.7] PASS — `headers.set("x-tastile-web-session-user", userSub)` at L54
[3.8] NOTE — empty string userSub not rejected by proxy (truthy)
[3.9] PASS — apiToken branch sets Authorization at L45-47
[3.10] PASS — both branches can fire if both cookies present

== 401 branch (L36-44) ==
[4.1] PASS — `!apiToken && !userSub` at L36
[4.2] NOTE — HTML accept => 307 redirect to /login?error=session_expired (L37-42)
[4.3] PASS — non-HTML => 401 JSON at L43
[4.4] PASS — body is `{ error: "no authenticated session for proxy" }`
[4.5] PASS — no WWW-Authenticate header (confirmed absent in source)

== Spec discrepancies ==
[D1] import path may diverge from memory recommendation — see 3.3
[D2] empty userSub not rejected by proxy — core behavior decides end-to-end
[D3] spec §"Web-side wiring" should mention HTML redirect variant
[D4] spec §"Web-side wiring" should mention secret-unset fallback to upstream 401
```

## 検証手順

### 検証 1: import 経路の安全性確認

```bash
# @/shared/auth/cookies が next/headers を取り込んでいないか確認
grep -nE "from ['\"]next/headers['\"]" tastile-web/src/shared/auth/cookies.ts
# 期待: ヒットしない（project memory と同種の危険 import がないこと）
```

### 検証 2: bridge 分岐の unit test（H3 で実装する内容の事前固定）

`route.ts` の `proxyRequest` を直接 import して、ヘッダ注入ロジックだけ検証する Vitest ケースを H3 に持ち越す。H2 では**テスト名と input/output を確定するだけ**:

| Test | env | cookies | 期待 upstream headers |
|---|---|---|---|
| `bypass-sends-owner-and-actor-only` | `E2E_BYPASS_AUTH=1` | (none) | `x-owner-id=00000000-…001`, `x-actor-id=00000000-…001`, no bridge, no auth |
| `bridge-sends-secret-and-session-user` | `E2E_BYPASS_AUTH=0` | `tastile_user_sub=e2e-test` | `x-tastile-web-bridge-secret=<secret>`, `x-tastile-web-session-user=e2e-test`, no `x-owner-id` |
| `api-token-sends-bearer` | `E2E_BYPASS_AUTH=0` | `tastile_api_token=tk1` | `Authorization=Bearer tk1`, no bridge headers |
| `both-cookies-send-both-auths` | `E2E_BYPASS_AUTH=0` | both | bridge + Authorization 両方 |
| `no-cookies-no-html-returns-401-json` | `E2E_BYPASS_AUTH=0` | (none), `Accept: application/json` | 401 `{ error: "no authenticated session for proxy" }` |
| `no-cookies-html-returns-redirect` | `E2E_BYPASS_AUTH=0` | (none), `Accept: text/html` | 307 → `/login?error=session_expired` |
| `bridge-secret-unset-warns-and-forwards` | `E2E_BYPASS_AUTH=0`, `TASTILE_WEB_BRIDGE_SECRET` 未設定 | `tastile_user_sub=e2e-test` | console.warn 1回、bridge ヘッダ無しで upstream へ（upstream 401 が予想） |

### 検証 3: 実 daemon での smoke テスト（H4 の事前固定）

H2 では実行せず、H4 で core 側を起動した上で以下を確認する手順を確定するだけ:

```bash
# Test 1: bypass
E2E_BYPASS_AUTH=1 curl -sS -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/proxy/v1/health
# 期待: 200, proxy log に bridge ヘッダ無し

# Test 2: bridge
E2E_BYPASS_AUTH=0 curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Cookie: tastile_user_sub=e2e-test" \
  http://localhost:3000/api/proxy/v1/health
# 期待: 200, core log に "bridge_auth_from_headers succeeded" 系の出力

# Test 3: no auth
E2E_BYPASS_AUTH=0 curl -sS -w "\n%{http_code}\n" \
  -H "Accept: application/json" \
  http://localhost:3000/api/proxy/v1/health
# 期待: 401, body `{"error":"no authenticated session for proxy"}`
```

## リスク

- **`process.env.TASTILE_WEB_BRIDGE_SECRET` の露出**: `route.ts` は Next.js の server-side route handler（`src/app/api/...`）であり、`process.env` 参照は server bundle にのみ入る。client component には漏れない。ただし**RSC から `fetch("/api/proxy/...")` した場合も同じ route handler を経由**するため安全。RSC から直接 `core` の URL を叩く path があれば別経路で認証が要るが、現状 code ベースには存在しないはず（H3 で確認）。
- **空文字 `userSub` のフォールスルー**: `request.cookies.get(COOKIE_USER_SUB)?.value` が空文字を返しても `!userSub` は false。core 側の挙動に依存。**core 側 `bridge_auth_from_headers` が空文字を拒否するかを確認**していない場合、E2E で 200 が返るのに owner が無い状態になる可能性。
- **secret 未設定時のサイレントフォールスルー**: L50-55 は警告のみで upstream に到達する。dev で `TASTILE_WEB_BRIDGE_SECRET` を `.env.development` に設定し忘れると、proxy log を見ないと原因不明の 401 になる。**fail-fast（環境変数未設定なら即 500）の方が安全**だが、本変更は H3 スコープ。
- **HTML redirect タイミング**: L37-42 の redirect は `Accept` ヘッダに依存。RSC の内部 fetch は `Accept: text/x-component` 等を付けることがあり、その場合は 401 JSON が返る。Next.js の挙動は将来変更され得る。
- **bridge secret を `.env.development` に直書き**: spec にも「`.env.development` ships a real value — confirm it is not the production value」と注意がある。`.env.example` との diff を CI で検出する仕組みが現状ない。
- **import パス `D1`**: `@/shared/auth/cookies` が `next/headers` を import していたら Turbopack が壊れる（project memory）。H2 のステップ 6 検証 1 で確認しないと、H3 のテストがコンパイル段階で死ぬ。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md`（特に §"Web-side wiring", §"Auth contract"）
- Reference impl: `tastile-core/crates-v1/api/src/handlers/common.rs:733-823`
- Memory: `feedback_tastile_web_cookie_imports.md`（`@/lib/cognito/cookie-names` import 推奨）
- Memory: `feedback_no_unverified_pass.md`（read = REVIEWED ≠ VERIFIED。H4 で実 daemon 検証すること）
- Sibling plans: H3（proxy route tests）, H4（core-side bridge smoke test）
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
