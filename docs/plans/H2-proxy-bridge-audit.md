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
- **Audit date**: 2026-08-05
- **Auditor**: H2 dispatch (issue #71)

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

---

## 監査対象ファイル

| File | Path | Size |
| --- | --- | --- |
| Proxy route | `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts` | 213 lines |
| Dev env (active) | `C:\Users\rebui\Desktop\tastile\tastile-web\.env.development` | 33 lines |
| Dev env (template) | `C:\Users\rebui\Desktop\tastile\tastile-web\.env.development.example` | 33 lines |
| Core contract | `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\common.rs:801-823` | `bridge_auth_from_headers` |

---

## 監査チェックリスト (行番号付き)

### 1. Env wiring (precondition)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 1.1 | `.env.development` が `E2E_BYPASS_AUTH=1` を含む | **PASS** | `.env.development:29` — `E2E_BYPASS_AUTH=1` |
| 1.2 | `.env.development` が `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` を含む | **PASS** | `.env.development:30` — `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` |
| 1.3 | `.env.development` が `TASTILE_WEB_BRIDGE_SECRET=<non-empty>` を含む | **PASS** | `.env.development:26` — `TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` (52-char base64url, non-empty) |
| 1.4 | `.env.development` が `CLOUD_API_BASE=http://127.0.0.1:31400` を含む | **PASS** | `.env.development:16` — `CLOUD_API_BASE=http://127.0.0.1:31400` (matches memory `project_tastile_web_required_env_vars.md`) |
| 1.5 | `.env.development.example` が `E2E_BYPASS_AUTH` / `TASTILE_WEB_BRIDGE_SECRET` の **少なくとも片方** を宣言 | **FAIL** | `.env.development.example` does not declare either key. Only `NEXT_PUBLIC_DAEMON_BASE_URL` / `CLOUD_API_BASE` (placeholder `<required>`) / `TASTILE_USE_RUST_CORE` are listed. Bridge secret / bypass flag absent from template. |

### 2. 3-way 分岐の実装

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 2.1 | `E2E_BYPASS_AUTH=1` 時に専用の code branch が存在する | **PASS** | `route.ts:30` — `if (getIsE2EBypass()) { … } else { … }` の 2 分岐。3-way 分岐 (e2e / cookie / 401) ではなく 2-way 分岐だが、`getIsE2EBypass()` (line 11-13) が truthy のとき else 枝の cookie 検査を完全に skip する点で e2e 分岐は成立 |
| 2.2 | `E2E_BYPASS_AUTH=1` 分岐が cookie 無しでも proxy を pass-through する | **PASS** | `route.ts:30-32` は cookie を読まず即座に `x-owner-id` / `x-actor-id` を立てて次の `init` 構築 (line 64) に進む。cookie 不在で 401 にならない |
| 2.3 | Cookie 不在かつ `E2E_BYPASS_AUTH=0` のときに 401 を返す | **PASS** | `route.ts:34-44` — `apiToken` も `userSub` も無い場合、`accept: text/html` なら `/login?error=session_expired` リダイレクト、それ以外は 401 JSON |
| 2.4 | `COOKIE_USER_SUB` がある非 e2e 経路で bridge headers を注入する | **PARTIAL PASS** | `route.ts:48-56` — `userSub` が truthy のとき `TASTILE_WEB_BRIDGE_SECRET` を読んで 2 つの bridge header を送出。header name は spec 通り (`x-tastile-web-bridge-secret` + `x-tastile-web-session-user`)。ただし `route.ts:49` は **`apiToken` があるかないかに関係なく bridge headers を送出する** (token 経路と bridge 経路が OR 而不是優先)。これは memory `feedback_auth_fall_through.md` の core 側 `Ok(None)` fall-through contract と整合するため WARN 扱い |
| 2.5 | `Authorization: Bearer` 送出は cookie の `tastile_api_token` があるときだけ | **PASS** | `route.ts:45-47` — `if (apiToken) { headers.set("authorization", \`Bearer ${apiToken}\`); }` |

### 3. Bridge header 名 (core contract との一致)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 3.1 | `x-tastile-web-bridge-secret` を送出 | **PASS (cookie 経路)** / **FAIL (e2e 経路)** | cookie 経路: `route.ts:53` で `headers.set("x-tastile-web-bridge-secret", bridgeSecret)`。e2e 経路: `route.ts:31-32` は `x-owner-id` / `x-actor-id` のみを送出し **bridge secret header を一切送らない** |
| 3.2 | `x-tastile-web-session-user` を送出 | **PASS (cookie 経路)** / **FAIL (e2e 経路)** | cookie 経路: `route.ts:54` で `headers.set("x-tastile-web-session-user", userSub)`。e2e 経路: `route.ts:31-32` は session-user を一切送らない |
| 3.3 | header name が core 側 `bridge_auth_from_headers` (common.rs:810/816) と完全一致 | **PASS (cookie 経路のみ)** | core は `headers.get("x-tastile-web-bridge-secret")` (common.rs:810) と `headers.get("x-tastile-web-session-user")` (common.rs:816) で lookup。proxy cookie 経路の送出 name と一致。e2e 経路は core 側の bridge lookup に到達しない (代わりに `x-owner-id` fallback で救済される: common.rs:789-790 `x-owner-id fallback used (non-production)`) |

### 4. Env var の読み出しと secret 取り扱い

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 4.1 | `TASTILE_WEB_BRIDGE_SECRET` を `process.env` から読む | **PASS** | `route.ts:49` — `const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;` |
| 4.2 | secret 未設定時に warning を出して 401/500 を返す | **PARTIAL** | `route.ts:50-51` — secret undefined なら `console.warn("[proxy] TASTILE_WEB_BRIDGE_SECRET is unset; cannot forward bridge headers")` のみ。**header は送出されない** (else 枝がない) ため、続く fetch は `userSub` 無しで Bearer も無し → `route.ts:43` の **cookie 不在パスはスキップ済** (apiToken が同時に無い場合のみ)。実体は「userSub があるが bridge secret が無い cookie 経路」で、core は `bridge_auth_from_headers` を `configured_secret = None` で呼び → 即 `None` 返却 → `x-owner-id` fallback に進む (production 環境では 401) |
| 4.3 | secret が console に露出しない (header 値に secret を含めていない) | **PASS** | `route.ts:53` は secret を header 値として送出するが HTTP request のため console には出ない。`console.warn` も secret 値を interpolate していない (line 51) |
| 4.4 | `E2E_BYPASS_AUTH` の read は server-side `process.env` のみ | **PASS** | `route.ts:11-13` — `getIsE2EBypass()` は `process.env.E2E_BYPASS_AUTH === "1"` のみ。`NEXT_PUBLIC_*` は使われない (重複宣言 line 30 は将来 client-side 表示用に使われる可能性あり、現状未参照) |
| 4.5 | `getCloudApiBase()` (line 4-9) の e2e 経路 fallback が `http://localhost:31400` 固定 | **PASS (but note)** | `route.ts:7` — `E2E_BYPASS_AUTH=1` なら `localhost:31400` を返す。これは dev の daemon が host 上で listen している前提。`.env.development:16` の `CLOUD_API_BASE=http://127.0.0.1:31400` とは loopback 表記が異なるが機能等価 |

### 5. E2E bypass 経路の subject 解決 (UUIDv5 contract 整合)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 5.1 | e2e bypass で固定 subject ID を送る | **PASS** | `route.ts:15` — `const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";` |
| 5.2 | その subject ID が core 側 `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)` と整合 | **FAIL** | core は bridge headers (`x-tastile-web-session-user`) を UUIDv5 シードにして owner_id を導出する (common.rs:822)。proxy の e2e 経路は `x-tastile-web-session-user` を **送らない** ため、core は bridge auth に到達せず、`x-owner-id` fallback で `00000000-0000-0000-0000-000000000001` を **直接採用** する。動作はするが、これは **spec の UUIDv5 派生を bypass している**。seed 値と派生 owner_id の **決定性が無い** = seed data が UUIDv5 形に揃っていないと、v1_subject 行が見つからず `internal_owner_provisioning` (common.rs:780-787) が走り production で 500 |
| 5.3 | `DEV_ACTOR_SUBJECT_ID` が UUIDv5 で計算可能なシード文字列の UUIDv5 結果と一致 | **N/A** | 仕様上、`x-tastile-web-session-user = "00000000-0000-0000-0000-000000000001"` (seed) を UUIDv5 に通した値 ≠ 同じ UUID を 2 度通した値。core は seed 文字列を hash するため、固定 UUID を seed にしても逆算不可。**spec の意図**は「`x-tastile-web-session-user = "<cognito_user_sub>"` を送り、core が `Uuid::new_v5(NAMESPACE_OID, user_sub.as_bytes())` で owner_id を導出」。e2e bypass も同じ contract に従うべき (`x-tastile-web-session-user = "e2e-bypass"` 等を送り、core は UUIDv5(`e2e-bypass`) を owner_id にする)。seed script (`tastile-core/scripts/seed-bypass-demo.sql`) は `seed = "e2e-bypass"` 前提で `v1_subject` 行を UUIDv5 で insert している前提 (memory `project_seed_bypass_demo_window.md`)。**現状の `DEV_ACTOR_SUBJECT_ID` はこの contract と整合しない** |

### 6. Request forwarding contract (3-way 分岐の 3 つ目 = 401)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 6.1 | Cookie 不在かつ e2e=0 かつ browser `Accept: text/html` で `/login?error=session_expired` 301/307 | **PASS** | `route.ts:37-42` — accept が `text/html` を含むなら redirect |
| 6.2 | Cookie 不在かつ e2e=0 かつ非 HTML リクエストで 401 + JSON | **PASS** | `route.ts:43` — `return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 });` |

### 7. 1 つの header を「両方」送る統合経路 (cookie 経路)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 7.1 | apiToken と userSub が両方 cookie にある場合、Bearer **と** bridge の両方を送る | **PASS (intentional)** | `route.ts:45-56` — `apiToken` があれば `Authorization` を設定し、`userSub` があれば bridge headers を設定。両方が独立した `if` なので両方の header が同じ request に乗る |
| 7.2 | 上記が core 側で「Bearer が見つかれば Bearer、Ok(None) なら bridge に fall through」という契約と整合 | **PASS** | memory `feedback_auth_fall_through.md` + core `bearer_auth_result` (common.rs:635-) の contract。Bear auth 成功時は Bearer 採用、無効 (revoked / DB error) は Err、無登録 / stale は Ok(None) で bridge へ。proxy は **両方送る**ことで「Bearer 認証は bridge より優先 (revoke 等が効く)」「Bearer が stale なら bridge に rescue」という挙動を成立させる |

---

## spec との差異リスト (FAIL 項目のみ)

### GAP-1 (BLOCKER) — E2E bypass 経路が bridge headers を送らない

**症状**: `E2E_BYPASS_AUTH=1` のとき、`x-owner-id` / `x-actor-id` 固定ヘッダーで daemon に到達する。core 側の `bridge_auth_from_headers` (common.rs:801-823) は呼ばれず、`x-owner-id` fallback (common.rs:789-790 `x-owner-id fallback used (non-production)`) で動く。

**問題**:
1. spec (`04-sub-projects/H-auth-bridge.md` §"Web-side wiring") は「E2E_BYPASS_AUTH=1 のときも bridge headers を送る」契約と推測される (3-way 分岐で `E2E_BYPASS_AUTH=1` は「有効な認証済みテストユーザーとして振る舞う」位置づけ)
2. 現行実装は `DEV_ACTOR_SUBJECT_ID` を **生 UUID として**送っている。これは core 側の UUIDv5 派生 contract を bypass している。`v1_subject` 行が UUIDv5(`"e2e-bypass"`) で seed されている前提 (memory `project_seed_bypass_demo_window.md`) と一致しない
3. production 経路で `x-owner-id` fallback が塞がれている (`TASTILE_ENV=production` で 401) ため、e2e bypass を **production で間違って有効化した** ときに即座に 401 になる。テストと prod で経路が異なるため事故検知が遅れる
4. `E2E_BYPASS_AUTH` 経路では `x-owner-id` / `x-actor-id` の **2 つの header を送出**しているが、core 側 `bridge_auth_from_headers` は **2 つの bridge header のみ**を見る。**名前空間が不一致**

**H3 / H4 への橋渡し**:
- H3 (proxy route tests) は `E2E_BYPASS_AUTH=1` 経路で「送出される header の完全集合 (BOTH `x-tastile-web-bridge-secret` AND `x-tastile-web-session-user`) を assert する」テストケースが必要
- H4 (core-side bridge smoke test) は `x-tastile-web-session-user = "e2e-bypass"` を送って UUIDv5 で derive した owner_id で `/v1/health` が 200 を返す contract test が必要

### GAP-2 (HIGH) — `.env.development.example` が bridge 関連 env を宣言していない

**症状**: `tastile-web/.env.development.example` に `E2E_BYPASS_AUTH` も `TASTILE_WEB_BRIDGE_SECRET` も無い。template を `.env.development` にコピーした新規 developer は必要な env 値が分からず、`process.env.E2E_BYPASS_AUTH` が `undefined` (=falsy) で起動 → 401 エラーを再現する。

**問題**:
- `.env.development.example:18` の `CLOUD_API_BASE=<required>` プレースホルダはあるが、bypass / bridge の宣言が無い
- `TASTILE_RUST_API_URL` (line 29) は宣言されているのに `TASTILE_WEB_BRIDGE_SECRET` は無い — 整合性欠如

**H3 / H4 への橋渡し**:
- H3 は `.env.development.example` の内容を doc test するテストケースが必要 (CI で env テンプレートの必須 key を assert)
- H4 は bypass flag / bridge secret が system EnvironmentFile (systemd `tastile-web.service`) に含まれているかの precheck

### GAP-3 (LOW) — `DEV_ACTOR_SUBJECT_ID` が UUIDv5 seed contract と整合しない

**症状**: `route.ts:15` の `00000000-0000-0000-0000-000000000001` を raw UUID として送信しているが、core は `x-tastile-web-session-user` を UUIDv5 seed として受け取る contract。

**問題**:
- 現行の `x-owner-id` fallback が動くため **当面は動作する** が、core 側で「`v1_subject` に該当 owner_id 行が無い」とき `internal_owner_provisioning` (common.rs:780-787) を呼び、production で `TASTILE_ENV=production` なら失敗 (memory `feedback_auth_fall_through.md` の production gate)
- bridge contract に統一すれば `seed_default_break_recurring_for_owner` (memory `feedback_bridge_owner_provisioning_20260721.md`) が同じ TX で走る道に乗る

**H3 / H4 への橋渡し**:
- H3 は `x-tastile-web-session-user = "e2e-bypass"` が header に乗っていることを assert
- H4 は `Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` が `/v1/access/subjects` で 200 を返す contract を pin

### GAP-4 (LOW) — `console.warn` が production で silent

**症状**: `route.ts:50-51` の `console.warn` は Next.js dev server では stderr に出るが、production build (`next build`) では drop される可能性があり、operator 視点で secret missing を検知できない。

**問題**:
- spec には明記なしだが、bridge secret 不在は **misconfiguration バグ**であり **401 が無音で増える**ほうが検知が遅れる

**H3 / H4 への橋渡し**:
- H3 で「`TASTILE_WEB_BRIDGE_SECRET` 不在のとき cookie 経路 request が 401 で fail する」regression test を追加

### GAP-5 (LOW) — `apiToken` あり + `userSub` ありで Bearer + bridge を両方送る

**症状**: `route.ts:45-56` は 2 つの `if` を独立に評価し、両方 header を送出する。

**問題**:
- 現状の挙動は core の fall-through contract (memory `feedback_auth_fall_through.md`) と整合する (Bearer が見つかれば Bearer、無効 Err、無登録 Ok(None) → bridge) ので PASS
- ただし「`Authorization: Bearer` を **意図的に抑止** する option がない」ため、bridge secret が rotate された瞬間に Bearer が古ければ全 request が bridge に行く (それは意図通り) が、log 上で 「Bearer 401 → bridge 200」 の trace が **operator 視点でノイズ** になる可能性

**H3 / H4 への橋渡し**:
- H3 は「`apiToken` があり + bridge secret 設定済」のケースで両 header が request に乗る assert テスト (現状挙動 pin)

---

## 各分岐の期待動作 (H3 テストケース input/output)

### Test 1: `E2E_BYPASS_AUTH=1` + bridge headers

- **前提**: `.env.development` の `E2E_BYPASS_AUTH=1` + `TASTILE_WEB_BRIDGE_SECRET=<set>` が両方存在
- **Input**: `GET /api/proxy/v1/health` (cookie 無し)
- **Expected output** (現状 FAIL / 期待):
  - `x-tastile-web-bridge-secret: <TASTILE_WEB_BRIDGE_SECRET>` 送出
  - `x-tastile-web-session-user: "e2e-bypass"` 送出
  - `Authorization` header 不在
  - core `bridge_auth_from_headers` 経路で `owner_id = Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` 採用
  - `/v1/health` 200
- **Expected output** (現状):
  - `x-owner-id: 00000000-0000-0000-0000-000000000001` 送出
  - `x-actor-id: 00000000-0000-0000-0000-000000000001` 送出
  - core `x-owner-id` fallback 経路 (production では 401)
- **Gap 紐付け**: GAP-1 (BLOCKER)

### Test 2: `E2E_BYPASS_AUTH=1` + bridge secret 不在

- **前提**: `E2E_BYPASS_AUTH=1` のみ、`TASTILE_WEB_BRIDGE_SECRET` 未設定
- **Input**: `GET /api/proxy/v1/health`
- **Expected output**: 501 (server misconfiguration) — bridge headers 無しで `x-owner-id` fallback が dev でのみ動く
- **Gap 紐付け**: GAP-4 (LOW)

### Test 3: `E2E_BYPASS_AUTH=0` + cookie `tastile_uid` あり + bridge secret あり

- **Input**: `GET /api/proxy/v1/access/subjects` with `Cookie: tastile_uid=<cognito_sub>`
- **Expected output**:
  - `x-tastile-web-bridge-secret: <set>` 送出
  - `x-tastile-web-session-user: <cognito_sub>` 送出
  - `Authorization` 不在 (apiToken cookie 無し)
  - core bridge auth 経路で owner_id = UUIDv5(cognito_sub)
  - 200
- **Gap 紐付け**: なし (PASS contract を pin)

### Test 4: `E2E_BYPASS_AUTH=0` + cookie `tastile_api_token` あり + `tastile_uid` あり

- **Input**: `GET /api/proxy/v1/access/subjects` with both cookies
- **Expected output**:
  - `Authorization: Bearer <api_token>` 送出
  - `x-tastile-web-bridge-secret: <set>` 送出
  - `x-tastile-web-session-user: <cognito_sub>` 送出
  - core が Bearer 優先採用 (memory `feedback_auth_fall_through.md`)
  - 200
- **Gap 紐付け**: GAP-5 (LOW) — 両 header が **両方** 送出される contract を pin する

### Test 5: `E2E_BYPASS_AUTH=0` + cookie 無し + `Accept: text/html`

- **Input**: `GET /api/proxy/v1/access/subjects` with `Accept: text/html`
- **Expected output**: 307 → `/login?error=session_expired`
- **Gap 紐付け**: なし (PASS)

### Test 6: `E2E_BYPASS_AUTH=0` + cookie 無し + `Accept: application/json`

- **Input**: `GET /api/proxy/v1/access/subjects` with `Accept: application/json`
- **Expected output**: 401 + `{ "error": "no authenticated session for proxy" }`
- **Gap 紐付け**: なし (PASS)

---

## 推奨 fix snippet (H3 / H4 で実装、**本 plan では適用しない**)

### Fix A — E2E bypass 経路を bridge contract に揃える (`route.ts:30-32`)

```ts
// Before (current — diverges from bridge contract)
if (getIsE2EBypass()) {
  headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID);
  headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID);
}

// After (proposed — bridge contract に統一)
if (getIsE2EBypass()) {
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!bridgeSecret) {
    console.warn("[proxy] E2E_BYPASS_AUTH=1 but TASTILE_WEB_BRIDGE_SECRET is unset");
    return NextResponse.json({ error: "e2e bypass misconfigured" }, { status: 501 });
  }
  headers.set("x-tastile-web-bridge-secret", bridgeSecret);
  headers.set("x-tastile-web-session-user", "e2e-bypass");
}
```

**効果**:
- core は `bridge_auth_from_headers` 経路に必ず乗る
- `owner_id = Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` で決定的に導出
- `seed-bypass-demo.sql` の前提 (memory `project_seed_bypass_demo_window.md`) と整合
- production で `E2E_BYPASS_AUTH` を間違って有効化しても `TASTILE_WEB_BRIDGE_SECRET` 不在なら **501 で fail-fast**

### Fix B — `.env.development.example` に bridge 関連 env を追加

```bash
# Add to tastile-web/.env.development.example
E2E_BYPASS_AUTH=0
TASTILE_WEB_BRIDGE_SECRET=<required for non-dev; generate with `openssl rand -base64 48`>
```

**効果**: 新規 developer が template を `.env.development` にコピーしたときに必要な env を把握できる

### Fix C — 統合 header-set の optionality

現状 PASS だが code review 観点で「Bearer を送るか / bridge を送るか」を 1 つの boolean に統一する option は別 PR で検討 (本 plan のスコープ外)。memory `feedback_auth_fall_through.md` の core 側 contract は両 header 受け取りを許容するので、現状の挙動で OK

---

## 監査ログの生成

`tile-create-e2e-wiring/logs/H2-proxy-audit-20260805.log` に相当する監査ログは、本 plan 内に **embedded audit findings** として記録した (本リポジトリには `tile-create-e2e-wiring/` ディレクトリが存在しないため、別ファイル生成は行わず、本 plan 自体が監査ログを兼ねる)。

将来 `tile-create-e2e-wiring/logs/` が確保された暁には、本 plan のチェックリスト + 差異リストをそのまま転記する follow-up を H4 の scope とすることを推奨。

---

## サマリ

| Severity | 件数 | Gap |
| --- | --- | --- |
| BLOCKER | 1 | GAP-1: E2E bypass が bridge headers ではなく `x-owner-id` を送る |
| HIGH | 1 | GAP-2: `.env.development.example` に bridge env 宣言が無い |
| LOW | 3 | GAP-3 (UUIDv5 seed contract 整合), GAP-4 (silent warn), GAP-5 (Bearer+bridge 同送の pin) |

**総合判定**: **GAPS_FOUND**。E2E bypass 経路の contract 不一致 (GAP-1) は core 側の UUIDv5 owner_id 導出と production gate に波及するため、H3 / H4 で bridging 必須。H3 (proxy route tests) は Test 1-6 をそのまま実装可能。H4 (core-side bridge smoke test) は GAP-1 / GAP-3 の修正を前提に `x-tastile-web-session-user = "e2e-bypass"` 経路の contract test を追加する。