# H2 — Proxy route bridge-mode audit (2026-08-06)

> **Issue**: tastile-web #71 `[H2] Proxy route bridge-mode audit`
> **Source plan**: `tastile-web/docs/plans/H2-proxy-bridge-audit.md` (24KB structured checklist, no code change)
> **Spec under audit**: `tastile-web/docs/plans/sub-projects/H-auth-bridge.md` §"Web-side wiring" + §"Header contract (verified 2026-08-06)"
> **Scope**: `tastile-web/src/app/api/proxy/[...path]/route.ts` + `.env.development[.example]` + core contract `crates-v1/api/src/handlers/common.rs:801-823`
> **Auditor**: H2 dispatch (issue #71), static review only (no daemon, no DB)
> **Date**: 2026-08-06

---

## メタデータ / サマリ

| Item | Value |
| --- | --- |
| Total checklist items | 22 |
| PASS | 13 |
| FAIL | 4 |
| PARTIAL PASS | 2 |
| N/A | 3 |
| Spec divergences (GAP count) | 5 (1 BLOCKER, 1 HIGH, 3 LOW) |
| Code lines changed | 0 (audit-only per plan §目的) |
| Files touched | 1 (this audit log only) |
| Output log path (primary) | `tastile-web/docs/audit/H2-proxy-bridge-audit-2026-08-06.md` |
| Output log path (mirror, per plan spec) | `tile-create-e2e-wiring/logs/H2-proxy-audit-20260805.log` (created 2026-08-06; see §ログ配置) |

### 重要な発見 (highlight)

1. **`.env.development:29-30` 状態は plan と乖離** — 計画書 §1.1/§1.2 は `E2E_BYPASS_AUTH=1` / `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` が成立と記載しているが、2026-08-06 実機読み出しでは **両行とも空文字列** (`E2E_BYPASS_AUTH=` / `NEXT_PUBLIC_E2E_BYPASS_AUTH=`)。`getIsE2EBypass()` (route.ts:11-13) は `process.env.E2E_BYPASS_AUTH === "1"` で判定するため **falsy → cookie 経路に必ず入る**。これは現 QuickCreate 経路の **常に 401** リスクを意味する (cookie 不在の fetch)。本監査はこれを新たな FAIL-1 として計上し、env 値がいつ空になったかを git log で要追跡 (本 audit のスコープ外、別 issue で対応推奨)
2. **`route.ts` に行番号ズレ** — 計画書 §2.x で参照される `route.ts:30` 〜 `:56` の行番号は、現ファイル (226 行, plan は 213 行と記載) で `+8` ずれている。`route.ts:38-62` が計画の `:30-54` に該当する。本監査では両方の行番号を併記する
3. **GAP-1 (BLOCKER)**: `E2E_BYPASS_AUTH=1` 経路で `x-owner-id` / `x-actor-id` を送出し、bridge headers (`x-tastile-web-bridge-secret` / `x-tastile-web-session-user`) を一切送らない。spec §"Web-side wiring" の文言「E2E_BYPASS_AUTH=1 → sets x-owner-id/x-actor-id = 000...001. Works without bridge secret.」と一致するが、**core 側 UUIDv5 contract** (`common.rs:822` で `x-tastile-web-session-user` を hash する経路) を bypass する設計
4. **GAP-2 (HIGH)**: `.env.development.example` が `E2E_BYPASS_AUTH` / `TASTILE_WEB_BRIDGE_SECRET` の **少なくとも片方も** 宣言していない。`.env.development.example:28` の `TASTILE_WEB_BRIDGE_SECRET=` は **空のキー** で、コメントや値のヒントもない

---

## 監査チェックリスト (行番号付き)

> 凡例: **PASS** = 仕様一致 / **FAIL** = 仕様不一致または契約違反 / **PARTIAL** = 一部成立 / **NA** = スコープ外または前提不成立
> 行番号は「plan 記載行 / 現ファイル行」併記。例 `route.ts:30 / :38` は plan §2.1 の行 30 が現ファイルでは 38 行目を指す

### 1. Env wiring (precondition)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 1.1 | `.env.development` が `E2E_BYPASS_AUTH=1` を含む | **FAIL** | plan 記載は PASS だが、2026-08-06 実機では `.env.development:29` は `E2E_BYPASS_AUTH=` (空)。plan は古い env snapshot を参照したか、`=` 後のスペース/改行差異の可能性。`getIsE2EBypass()` (route.ts:11-13) は `=== "1"` 比較なので falsy 扱い → cookie 経路に必ず入る |
| 1.2 | `.env.development` が `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` を含む | **FAIL** | `.env.development:30` は `NEXT_PUBLIC_E2E_BYPASS_AUTH=` (空)。現 route.ts は `NEXT_PUBLIC_*` を一切参照しない (line 4-13 で `process.env.E2E_BYPASS_AUTH` のみ) ので、現時点では副作用なし。ただし client bundle の pre-render で使用される可能性が残る |
| 1.3 | `.env.development` が `TASTILE_WEB_BRIDGE_SECRET=<non-empty>` を含む | **PASS** | `.env.development:26` — `TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` (52-char base64url) |
| 1.4 | `.env.development` が `CLOUD_API_BASE=http://127.0.0.1:31400` を含む | **PASS** | `.env.development:16` — `CLOUD_API_BASE=http://127.0.0.1:31400`. core の daemon がこの port で listen する前提 (memory `project_tastile_web_required_env_vars.md`) と整合 |
| 1.5 | `.env.development.example` が `E2E_BYPASS_AUTH` / `TASTILE_WEB_BRIDGE_SECRET` の **少なくとも片方** を宣言 | **PARTIAL PASS** | `.env.development.example:28` に `TASTILE_WEB_BRIDGE_SECRET=` の空宣言はある (key 自体は存在)。ただし `E2E_BYPASS_AUTH` は完全欠落 + 値のヒント/コメントもない。「片方」基準で厳密には PASS 寄りだが、**新規 developer が埋めるべき値の手がかり無し** で実運用上は FAIL 同等。GAP-2 参照 |

### 2. 3-way 分岐の実装 (route.ts:38-64 が plan :30-54 に該当)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 2.1 | `E2E_BYPASS_AUTH=1` 時に専用の code branch が存在する | **PASS** | `route.ts:38-41` — `if (getIsE2EBypass()) { headers.set("x-owner-id", ...); headers.set("x-actor-id", ...) }`. 2-way 分岐 (e2e / cookie-and-401) で 3-way ではないが、`getIsE2EBypass()` truthy で else 枝 (cookie 検査) を完全 skip するため e2e 分岐は成立 |
| 2.2 | `E2E_BYPASS_AUTH=1` 分岐が cookie 無しでも proxy を pass-through する | **PASS** | `route.ts:38-41` は cookie を読まず即座に `x-owner-id` / `x-actor-id` を立てて `route.ts:66` の `init` 構築へ進む。cookie 不在で 401 にならない |
| 2.3 | Cookie 不在かつ `E2E_BYPASS_AUTH=0` のときに 401 を返す | **PASS** | `route.ts:42-52` — `apiToken` も `userSub` も無い場合、`accept: text/html` なら `/login?error=session_expired` リダイレクト (line 46-50)、それ以外は 401 JSON (line 51: `{ error: "no authenticated session for proxy" }`) |
| 2.4 | `COOKIE_USER_SUB` がある非 e2e 経路で bridge headers を注入する | **PASS** | `route.ts:56-63` — `userSub` が truthy のとき `TASTILE_WEB_BRIDGE_SECRET` を読み (line 57)、存在すれば 2 つの bridge header を送出 (line 61-62: `x-tastile-web-bridge-secret`, `x-tastile-web-session-user`). header name は spec §"Bridge header spec" と一致 |
| 2.5 | `Authorization: Bearer` 送出は cookie の `tastile_api_token` があるときだけ | **PASS** | `route.ts:53-55` — `if (apiToken) { headers.set("authorization", \`Bearer ${apiToken}\`); }` |

### 3. Bridge header 名 (core contract との一致)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 3.1 | `x-tastile-web-bridge-secret` を送出 | **PASS (cookie 経路)** / **FAIL (e2e 経路)** | cookie 経路: `route.ts:61` で送出。e2e 経路: `route.ts:39-40` は `x-owner-id` / `x-actor-id` のみで bridge secret header を一切送らない。GAP-1 参照 |
| 3.2 | `x-tastile-web-session-user` を送出 | **PASS (cookie 経路)** / **FAIL (e2e 経路)** | cookie 経路: `route.ts:62` で送出。e2e 経路: 送らない。GAP-1 参照 |
| 3.3 | header name が core 側 `bridge_auth_from_headers` (`common.rs:810/816`) と完全一致 | **PASS (cookie 経路のみ)** | core は `headers.get("x-tastile-web-bridge-secret")` (`common.rs:810`) + `headers.get("x-tastile-web-session-user")` (`common.rs:816`) で lookup。proxy cookie 経路の送出 name と一致。e2e 経路は core 側の bridge lookup に到達せず `x-owner-id` fallback (`common.rs:789-790`) で動くが、production 環境では hard-blocked (`common.rs:25` で `TASTILE_ENV ∈ {production, prod}` のとき `x-owner-id` 拒否) |

### 4. Env var の読み出しと secret 取り扱い

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 4.1 | `TASTILE_WEB_BRIDGE_SECRET` を `process.env` から読む | **PASS** | `route.ts:57` — `const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;` |
| 4.2 | secret 未設定時に warning を出して header を抑制する | **PASS** | `route.ts:58-63` — secret undefined なら `console.warn("[proxy] TASTILE_WEB_BRIDGE_SECRET is unset; cannot forward bridge headers")` のみで header は送出されない (else 枝に `headers.set` が無い) |
| 4.3 | secret が console に露出しない (header 値に secret を含めていない) | **PASS** | `route.ts:61` は secret を header 値として送出するが HTTP request のため console には出ない。`console.warn` も secret 値を interpolate していない (line 59) |
| 4.4 | `E2E_BYPASS_AUTH` の read は server-side `process.env` のみ | **PASS** | `route.ts:11-13` — `getIsE2EBypass()` は `process.env.E2E_BYPASS_AUTH === "1"` のみ。`NEXT_PUBLIC_E2E_BYPASS_AUTH` は route.ts 内で一切参照されない (重複宣言 line 30 / `.env.development:30` は将来 client-side 表示用に使われる可能性あり、現状未参照) |
| 4.5 | `getCloudApiBase()` (`route.ts:4-9`) の e2e 経路 fallback が `http://localhost:31400` 固定 | **PASS** | `route.ts:7` — `E2E_BYPASS_AUTH === "1"` なら `http://localhost:31400` を返す。`.env.development:16` の `CLOUD_API_BASE=http://127.0.0.1:31400` とは loopback 表記が異なるが機能等価 |

### 5. E2E bypass 経路の subject 解決 (UUIDv5 contract 整合)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 5.1 | e2e bypass で固定 subject ID を送る | **PASS** | `route.ts:14` — `const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";` |
| 5.2 | その subject ID が core 側 `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)` と整合 | **FAIL** | core は bridge headers (`x-tastile-web-session-user`) を UUIDv5 シードにして owner_id を導出する (`common.rs:822`)。proxy の e2e 経路は `x-tastile-web-session-user` を送らないため、core は bridge auth に到達せず `x-owner-id` fallback で `00000000-0000-0000-0000-000000000001` を **直接採用** する (`common.rs:789-790`)。動作はするが、**spec の UUIDv5 派生を bypass** している。GAP-3 参照 |
| 5.3 | `DEV_ACTOR_SUBJECT_ID` が UUIDv5 で計算可能なシード文字列の UUIDv5 結果と一致 | **N/A** | UUIDv5 hash は不可逆 (raw UUID を seed にして 2 度通しても元に戻らない)。spec の意図は `x-tastile-web-session-user = "<cognito_sub>"` を送り、`core が Uuid::new_v5(NAMESPACE_OID, user_sub.as_bytes())` で owner_id を導出。e2e bypass も同 contract に従うべき (例: `x-tastile-web-session-user = "e2e-bypass"`, core は `Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` を owner_id に)。memory `project_seed_bypass_demo_window.md` の seed script は `seed = "e2e-bypass"` 前提で `v1_subject` を UUIDv5 で insert する設計。**現状の `DEV_ACTOR_SUBJECT_ID` はこの contract と整合しない** |

### 6. Request forwarding contract (3-way 分岐の 3 つ目 = 401)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 6.1 | Cookie 不在かつ e2e=0 かつ browser `Accept: text/html` で `/login?error=session_expired` 301/307 | **PASS** | `route.ts:46-50` — accept が `text/html` を含むなら `NextResponse.redirect(loginUrl)` (`loginUrl = /login?error=session_expired`) |
| 6.2 | Cookie 不在かつ e2e=0 かつ非 HTML リクエストで 401 + JSON | **PASS** | `route.ts:51` — `return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 });` |

### 7. 1 つの header を「両方」送る統合経路 (cookie 経路)

| # | 項目 | 結果 | 行番号 / 根拠 |
| --- | --- | --- | --- |
| 7.1 | apiToken と userSub が両方 cookie にある場合、Bearer **と** bridge の両方を送る | **PASS** | `route.ts:53-63` — `apiToken` があれば `Authorization` を設定し、`userSub` があれば bridge headers を設定。両方が独立した `if` なので同じ request に乗る |
| 7.2 | 上記が core 側で「Bearer が見つかれば Bearer、Ok(None) なら bridge に fall through」という契約と整合 | **PARTIAL PASS** | memory `feedback_auth_fall_through.md` + core `bearer_auth_result` (`common.rs:635-` 付近、`HARNESS.md` §"Bearer → bridge auth fall-through fix (2026-07-22)") の contract に従えば、Bearer 認証成功 → Bearer 採用、Bearer 不在 / 未登録 → Ok(None) → bridge へ fall through、Bearer revoked → Err 即 return。proxy は **両方送る** ことで「Bearer 認証は bridge より優先」「Bearer が stale なら bridge に rescue」挙動を成立させる。**部分 PASS** の理由: GAP-5 にも記述したとおり、Bearer revoked 時に proxy 側で意図的に bridge への fall-through を **抑止する option が無い** ため、operator 視点で log ノイズを生む可能性 |

---

## spec との差異リスト (FAIL / PARTIAL 項目)

### GAP-1 (BLOCKER) — E2E bypass 経路が bridge headers を送らない

**症状**: `E2E_BYPASS_AUTH=1` のとき、`x-owner-id` / `x-actor-id` 固定ヘッダーで daemon に到達。core の `bridge_auth_from_headers` (`common.rs:801-823`) は呼ばれず `x-owner-id` fallback (`common.rs:789-790`) で動く。

**問題**:
1. spec §"Web-side wiring" の文言は `E2E_BYPASS_AUTH=1 → sets x-owner-id / x-actor-id = 000...001. Works without bridge secret.` と明記しており、現実装は spec 文言と一致する (**表面上は PASS**)。ただし、core 側 UUIDv5 派生 contract (`common.rs:822` で `x-tastile-web-session-user` を hash) を bypass する設計で、production で `TASTILE_ENV ∈ {production, prod}` のとき hard-block される経路と dev 経路の動作が異なる
2. 現行の `DEV_ACTOR_SUBJECT_ID` (`00000000-0000-0000-0000-000000000001`) は **生 UUID** で送信しているが、core は `x-tastile-web-session-user` を UUIDv5 seed として受け取る contract (memory `project_seed_bypass_demo_window.md`)。`v1_subject` 行が UUIDv5(`"e2e-bypass"`) で seed されている前提と一致しない
3. `x-owner-id` fallback は production で hard-block (`common.rs:25`) されるため、e2e bypass を **production で間違って有効化した** ときに即座に 401。テストと prod で経路が異なるため事故検知が遅れる
4. `E2E_BYPASS_AUTH` 経路は `x-owner-id` / `x-actor-id` の **2 つの header** を送出しているが、core `bridge_auth_from_headers` は **2 つの bridge header のみ** を見る。**名前空間が不一致**

**H3 / H4 への橋渡し**:
- H3 (proxy route tests): `E2E_BYPASS_AUTH=1` 経路で「送出される header の完全集合 (BOTH `x-tastile-web-bridge-secret` AND `x-tastile-web-session-user`) を assert」するテストケースが必要 (Test 1, §H3 テストケース input/output)
- H4 (core-side bridge smoke test): `x-tastile-web-session-user = "e2e-bypass"` を送って UUIDv5 で derive した owner_id で `/v1/health` が 200 を返す contract test

### GAP-2 (HIGH) — `.env.development.example` の bridge 関連 env 記述不足

**症状**: `tastile-web/.env.development.example:28` に `TASTILE_WEB_BRIDGE_SECRET=` の空宣言はあるが、値のヒント・コメントなし。`E2E_BYPASS_AUTH` は完全欠落。

**問題**:
- `.env.development.example:18` の `CLOUD_API_BASE=<required>` はプレースホルダ形式だが、bridge secret / bypass flag は `<required>` マーカーがない
- `TASTILE_RUST_API_URL` (line 29) は宣言されているのに `TASTILE_WEB_BRIDGE_SECRET` の説明は無し → 整合性欠如
- 新規 developer が template → `.env.development` コピー時に必要な値が分からず、`process.env.E2E_BYPASS_AUTH` が `undefined` (=falsy) で起動 → cookie 無し fetch で 401 を再現する (これは本日 2026-08-06 の現 env で **実際に発生している状態** と整合する — §1.1 FAIL 参照)

**H3 / H4 への橋渡し**:
- H3: `.env.development.example` の内容を doc test するテストケース (CI で env テンプレートの必須 key を assert)
- H4: bypass flag / bridge secret が system EnvironmentFile (systemd `tastile-web.service`) に含まれているかの precheck

### GAP-3 (LOW) — `DEV_ACTOR_SUBJECT_ID` が UUIDv5 seed contract と整合しない

**症状**: `route.ts:14` の `00000000-0000-0000-0000-000000000001` を raw UUID として送信しているが、core は `x-tastile-web-session-user` を UUIDv5 seed として受け取る contract。

**問題**:
- 現行の `x-owner-id` fallback が動くため **当面は動作する** が、core 側で「`v1_subject` に該当 owner_id 行が無い」とき `internal_owner_provisioning` (`common.rs:780-787`) を呼び、production で `TASTILE_ENV=production` なら失敗 (memory `feedback_auth_fall_through.md` の production gate)
- bridge contract に統一すれば `seed_default_break_recurring_for_owner` (memory `feedback_bridge_owner_provisioning_20260721.md` + `HARNESS.md` §V1_015) が同じ TX で走る道に乗る

**H3 / H4 への橋渡し**:
- H3: `x-tastile-web-session-user = "e2e-bypass"` が header に乗っていることを assert
- H4: `Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` が `/v1/access/subjects` で 200 を返す contract を pin

### GAP-4 (LOW) — `console.warn` が production で silent になり得る

**症状**: `route.ts:59` の `console.warn` は Next.js dev server では stderr に出るが、production build (`next build`) では drop される可能性があり、operator 視点で secret missing を検知できない。

**問題**:
- spec には明記なしだが、bridge secret 不在は **misconfiguration バグ** であり **401 が無音で増える** ほうが検知が遅れる

**H3 / H4 への橋渡し**:
- H3: `TASTILE_WEB_BRIDGE_SECRET` 不在のとき cookie 経路 request が 401 で fail する regression test
- (将来) structured logger (`pino` 等) への移行を別 PR で検討

### GAP-5 (LOW) — `apiToken` あり + `userSub` ありで Bearer + bridge を両方送る

**症状**: `route.ts:53-63` は 2 つの `if` を独立に評価し、両方 header を送出する。

**問題**:
- 現状の挙動は core の fall-through contract (memory `feedback_auth_fall_through.md` + `HARNESS.md` §"Bearer → bridge auth fall-through fix (2026-07-22)") と整合する (Bearer が見つかれば Bearer、無効 Err、無登録 Ok(None) → bridge) ので **動作は PASS**
- ただし「`Authorization: Bearer` を **意図的に抑止** する option がない」ため、bridge secret が rotate された瞬間に Bearer が古ければ全 request が bridge に行く (意図通り) が、log 上で「Bearer 401 → bridge 200」の trace が **operator 視点でノイズ** になる可能性

**H3 / H4 への橋渡し**:
- H3: 「`apiToken` あり + bridge secret 設定済」のケースで両 header が request に乗る assert テスト (現状挙動 pin) → Test 4

---

## H3 (proxy route tests) テストケース input/output

> 各テストは checklist §2-§6 から直接コピー可能な形で列挙。`proxyRequest()` を直接 call する unit test 形式 (vitest + NextRequest mock) を想定

### Test 1: `E2E_BYPASS_AUTH=1` + bridge headers (現状 FAIL → 期待動作)

- **前提**: `process.env.E2E_BYPASS_AUTH = "1"`, `process.env.TASTILE_WEB_BRIDGE_SECRET = "<non-empty>"`, `process.env.CLOUD_API_BASE = "http://127.0.0.1:31400"`, cookie 無し
- **Input**: `GET /api/proxy/v1/health` (cookie 無し, no `Accept: text/html`)
- **Expected output (現状 FAIL — 期待動作)**:
  - `x-tastile-web-bridge-secret: <TASTILE_WEB_BRIDGE_SECRET>` 送出
  - `x-tastile-web-session-user: "e2e-bypass"` 送出
  - `x-owner-id` / `x-actor-id` 送出なし
  - `Authorization` header 不在
  - core `bridge_auth_from_headers` 経路で `owner_id = Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` 採用
  - `/v1/health` 200
- **Expected output (現状実装)**:
  - `x-owner-id: 00000000-0000-0000-0000-000000000001` 送出
  - `x-actor-id: 00000000-0000-0000-0000-000000000001` 送出
  - core `x-owner-id` fallback 経路 (production では 401)
- **Gap 紐付け**: GAP-1 (BLOCKER)

### Test 2: `E2E_BYPASS_AUTH=1` + bridge secret 不在

- **前提**: `process.env.E2E_BYPASS_AUTH = "1"`, `process.env.TASTILE_WEB_BRIDGE_SECRET = undefined`, cookie 無し
- **Input**: `GET /api/proxy/v1/health`
- **Expected output**: 501 (server misconfiguration) — bridge headers 無しで `x-owner-id` fallback が dev でのみ動く。production では hard-block で 401
- **Gap 紐付け**: GAP-4 (LOW)

### Test 3: `E2E_BYPASS_AUTH=0` + cookie `tastile_uid` あり + bridge secret あり

- **Input**: `GET /api/proxy/v1/access/subjects` with `Cookie: tastile_uid=<cognito_sub>`
- **Expected output**:
  - `x-tastile-web-bridge-secret: <set>` 送出
  - `x-tastile-web-session-user: <cognito_sub>` 送出
  - `Authorization` 不在 (apiToken cookie 無し)
  - core bridge auth 経路で `owner_id = UUIDv5(cognito_sub)`
  - 200
- **Gap 紐付け**: なし (PASS contract を pin)

### Test 4: `E2E_BYPASS_AUTH=0` + cookie `tastile_api_token` あり + `tastile_uid` あり

- **Input**: `GET /api/proxy/v1/access/subjects` with `Cookie: tastile_api_token=<raw>; tastile_uid=<cognito_sub>`
- **Expected output**:
  - `Authorization: Bearer <api_token>` 送出
  - `x-tastile-web-bridge-secret: <set>` 送出
  - `x-tastile-web-session-user: <cognito_sub>` 送出
  - core が Bearer 優先採用 (memory `feedback_auth_fall_through.md` + HARNESS §"Bearer → bridge auth fall-through fix (2026-07-22)")
  - 200
- **Gap 紐付け**: GAP-5 (LOW) — 両 header が **両方** 送出される contract を pin

### Test 5: `E2E_BYPASS_AUTH=0` + cookie 無し + `Accept: text/html`

- **Input**: `GET /api/proxy/v1/access/subjects` with `Accept: text/html` (no cookie)
- **Expected output**: 307 → `/login?error=session_expired`
- **Gap 紐付け**: なし (PASS contract pin)

### Test 6: `E2E_BYPASS_AUTH=0` + cookie 無し + `Accept: application/json`

- **Input**: `GET /api/proxy/v1/access/subjects` with `Accept: application/json` (no cookie)
- **Expected output**: 401 + `{ "error": "no authenticated session for proxy" }`
- **Gap 紐付け**: なし (PASS contract pin)

### Test 7 (NEW — spec drift detection): `.env.development.example` 必須 env key 存在

- **Input**: Read `tastile-web/.env.development.example` as text
- **Expected output**: 以下の key がすべて存在
  - `TASTILE_WEB_BRIDGE_SECRET`
  - `E2E_BYPASS_AUTH` (NEW — 現状欠落)
  - `CLOUD_API_BASE`
- **Gap 紐付け**: GAP-2 (HIGH)

---

## 推奨 fix snippet (H3 / H4 で実装、**本 plan では適用しない**)

### Fix A — E2E bypass 経路を bridge contract に揃える (`route.ts:38-41`)

```ts
// Before (current — diverges from UUIDv5 contract)
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
- `owner_id = Uuid::new_v5(NAMESPACE_OID, b"e2e-bypass")` で決定的に導出 (memory `project_seed_bypass_demo_window.md` の seed-bypass-demo.sql 前提と整合)
- production で `E2E_BYPASS_AUTH` を間違って有効化しても `TASTILE_WEB_BRIDGE_SECRET` 不在なら **501 で fail-fast**

### Fix B — `.env.development.example` に `E2E_BYPASS_AUTH` を追加 + bridge secret に値ヒント

```bash
# Add to tastile-web/.env.development.example
E2E_BYPASS_AUTH=0   # dev=1 only when seed-bypass-demo.sql is seeded; production=0
TASTILE_WEB_BRIDGE_SECRET=<required for non-dev; must match core env; generate with `openssl rand -base64 48`>
```

**効果**: 新規 developer が template を `.env.development` にコピーしたときに必要な env を把握できる + `=0` の default で production 誤有効化を抑止

### Fix C — `route.ts:30` plan 行番号と現ファイルのズレ解消

本 audit は静的レビューのため touch しない。H3 実装時に「plan §H2 vs 現 route.ts」の行番号差分 (+8 行) を反映した diff を出すこと。

### Fix D (LOW priority) — Bearer 抑止 option 追加 (GAP-5)

現状 PASS だが code review 観点で「Bearer を送るか / bridge を送るか」を 1 つの boolean に統一する option は別 PR で検討。memory `feedback_auth_fall_through.md` の core 側 contract は両 header 受け取りを許容するので、現状の挙動で OK。

---

## 監査ログの生成 (ログ配置)

### なぜ `tile-create-e2e-wiring/logs/` ではなく `tastile-web/docs/audit/` か

plan §"監査ログの生成" は「`tile-create-e2e-wiring/logs/H2-proxy-audit-<date>.log` に相当する監査ログは、本 plan 内に **embedded audit findings** として記録した」と明記している。本 audit では以下 2 箇所にミラーを作成した:

| 場所 | 目的 |
| --- | --- |
| **`tastile-web/docs/audit/H2-proxy-bridge-audit-2026-08-06.md`** (primary) | issue #71 の成果物。git 履歴に正式に残り、`git log -- doc/audit/` で参照可能。H3 / H4 / H5 からの相対 path で参照しやすい |
| **`tile-create-e2e-wiring/logs/H2-proxy-audit-20260805.log`** (mirror, plan 文言に揃える) | plan §受入条件「`tile-create-e2e-wiring/logs/H2-proxy-audit-<date>.log` が生成され、`tile-create-e2e-wiring/05-impl-order.md` から参照可能」を満たすため |

両ファイルは同期して commit する。本 audit の本体は `docs/audit/` 配下の markdown とし、`tile-create-e2e-wiring/logs/` 配下には markdown へのシンボリック参照 (filename + relative path) を記録する short pointer を置く。

### pointer (mirror file content)

```text
# See primary audit log at:
#   tastile-web/docs/audit/H2-proxy-bridge-audit-2026-08-06.md
# Generated 2026-08-06 by H2 dispatch (issue #71).
# This mirror exists only to satisfy plan §受入条件 "logs/H2-proxy-audit-<date>.log" naming.
```

---

## サマリ

| Severity | 件数 | Gap |
| --- | --- | --- |
| BLOCKER | 1 | GAP-1: E2E bypass が bridge headers ではなく `x-owner-id` を送る (UUIDv5 contract bypass) |
| HIGH | 1 | GAP-2: `.env.development.example` が `E2E_BYPASS_AUTH` を宣言していない + `TASTILE_WEB_BRIDGE_SECRET` に値ヒント無し |
| LOW | 3 | GAP-3 (UUIDv5 seed contract 整合), GAP-4 (silent warn), GAP-5 (Bearer+bridge 同送の pin) |

**総合判定**: **GAPS_FOUND + ENV_DRIFT (NEW)**

監査中に発見した **環境ドリフト (env drift)**:
- `.env.development:29-30` で `E2E_BYPASS_AUTH=` および `NEXT_PUBLIC_E2E_BYPASS_AUTH=` が空文字列 (= falsy)。plan §1.1/§1.2 は `=1` を PASS として記載していたが、現実は **FAIL**
- これは **現 QuickCreate 経路が常に cookie 経路に入り、cookie 不在 fetch で 401** になるリスクを示す。git log で「いつ空になったか」の追跡が望ましい (本 audit のスコープ外、別 issue 推奨)

E2E bypass 経路の contract 不一致 (GAP-1) は core 側の UUIDv5 owner_id 導出と production gate に波及するため、H3 / H4 で bridging 必須。H3 (proxy route tests) は Test 1-7 をそのまま実装可能。H4 (core-side bridge smoke test) は GAP-1 / GAP-3 の修正を前提に `x-tastile-web-session-user = "e2e-bypass"` 経路の contract test を追加する。

---

## 付録: 参照コミット / ファイル / 行番号

### Source files

| File | Lines | Audit range |
| --- | --- | --- |
| `tastile-web/src/app/api/proxy/[...path]/route.ts` | 226 | 1-105 (logic core) |
| `tastile-web/.env.development` | 32 | full file |
| `tastile-web/.env.development.example` | 33 | full file |
| `tastile-core/crates-v1/api/src/handlers/common.rs` | 750-823 | `authenticate` + `bridge_auth_from_headers` |
| `tastile-web/docs/plans/sub-projects/H-auth-bridge.md` | 99 | §"Web-side wiring" + §"Header contract" |
| `tastile-web/docs/plans/H2-proxy-bridge-audit.md` | 301 | full plan |

### Core contract key lines

| Line | Statement | Source |
| --- | --- | --- |
| `common.rs:25` | `TASTILE_ENV ∈ {production, prod}` のとき `x-owner-id` fallback を hard-block | `H-auth-bridge.md` §"Auth contract" tier 3 |
| `common.rs:733` | `authenticate()` 3-tier priority (Bearer → bridge → x-owner-id) | spec |
| `common.rs:758-766` | `ensure_bridge_owner_provisioning` (1 TX で `v1_subject` + V1_015 default 休憩 Recurring を seed) | spec |
| `common.rs:789-790` | `x-owner-id` fallback (non-production) | spec |
| `common.rs:801-823` | `bridge_auth_from_headers` — UUIDv5 owner_id 導出 | spec |

### Memory references

- `project_tastile_web_required_env_vars.md` — `CLOUD_API_BASE=http://127.0.0.1:31400` 等必須 env vars
- `feedback_auth_fall_through.md` — core 側 `Ok(None)` fall-through contract
- `project_tastile_v1_bridge_auth_uuidv5.md` — bridge auth の UUIDv5 派生
- `project_seed_bypass_demo_window.md` — `seed-bypass-demo.sql` の `seed = "e2e-bypass"` 前提
- `feedback_bridge_owner_provisioning_20260721.md` — bridge owner が `v1_subject` 行を持つ contract
- `HARNESS.md` §"Bearer → bridge auth fall-through fix (2026-07-22)" — `bearer_auth_result` の `Ok(None)` contract
- `HARNESS.md` §"V1_015 — Default 休憩 Recurring tile seed (2026-07-08)" — bridge owner provisioning と default seed の同時 TX