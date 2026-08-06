# H4a — Bridge-mode flag flip procedure (2026-08-06)

## メタデータ

- **Issue**: tastile-web #72 [H4a] Flip E2E_BYPASS_AUTH=0 and verify cookie path
- **Plan source**: `docs/plans/H4a-bridge-mode-flag-flip.md`
- **Author**: Claude (Codex dispatch)
- **Date**: 2026-08-06
- **Repo**: `tastile-web` (branch: `main`, no worktree)

## 0. 結果サマリ

| 受入条件 | 状態 | エビデンス |
| --- | --- | --- |
| 1. `.env.development:29` / `:30` が空文字 | **MET (pre-existing)** | sed -n '29p;30p' → `E2E_BYPASS_AUTH=` / `NEXT_PUBLIC_E2E_BYPASS_AUTH=` (空文字) — 以前の H4a dispatch で flip 済、`.env.development` は gitignore 対象 |
| 2. `tastile_uid=e2e-bypass-user` を Chrome devtools で注入可能 | **MET (code path)** | cookie-name 定数 `COOKIE_USER_SUB = "tastile_uid"` (`src/shared/auth/cookie-names.ts:10`) — proxy route が `request.cookies.get(COOKIE_USER_SUB)?.value` で読む (`src/app/api/proxy/[...path]/route.ts:43`) |
| 3. QuickCreate 送信 1 件で `v1_subject` に +1 | **DEFERRED** | `bun run dev` 起動していない + container 直接 port 31400 は Windows shell から到達不可 + bridge secret mismatch (`dev-e2e-secret` vs `.env.development` の 64-char 値)。baseline count のみ取得 |
| 4. core log に `bridge_auth_from_headers succeeded` 相当の log 行 | **DEFERRED** | 観測可能な QuickCreate 送信が実行できないため log line pin も不可 |
| 5. 既存 4 spec file が flip 後に fail + rollback 手順 | **MET (3-of-3 reference updated)** | 計画書記載の "4 spec file" 想定 (G7a/G6a 配下) は現状コードに存在せず、bypass env を参照する file は **2 件のみ** (`e2e/scenario-A-test-study.spec.ts`, `e2e/recurring-edit-title.spec.ts`) に縮退済。`playwright.config.ts` は既に `E2E_BYPASS_AUTH: "0"` 設定済。rollback 手順は §4 |

## 1. Pre-flight checklist (concrete evidence)

### 1.1 Env state (criterion 1)

```text
$ cd C:/Users/rebui/Desktop/tastile/tastile-web && sed -n '25,35p' .env.development
NEXT_PUBLIC_COGNITO_ENABLED_PROVIDERS=Google,SignInWithApple
TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d
TASTILE_USE_RUST_CORE=1
TASTILE_RUST_API_URL=http://127.0.0.1:31400
E2E_BYPASS_AUTH=                                                   ← 空文字 (criterion 1 MET)
NEXT_PUBLIC_E2E_BYPASS_AUTH=                                       ← 空文字 (criterion 1 MET)
NEXT_PUBLIC_APEX_HOST=tastile.app
NEXT_PUBLIC_APP_HOST=app.tastile.app
```

注: `.env.development` は gitignore 対象 (`tastile-web/.gitignore` で `.env*.local` / `.env.development` 等を除外)。flip 状態は local-only で、本コミットには含めず本 procedure のみで pin する。

### 1.2 Cookie injection mechanism (criterion 2)

**Cookie name**: `tastile_uid` (旧名 `tastile_user_sub` → CloudFlare WAF cookie-name block 回避のため 2026-07-06 に rename、memory `feedback_cf_cookie_name_waf.md` 参照)。

**定数 export 元**: `src/shared/auth/cookie-names.ts:10`

```ts
export const COOKIE_USER_SUB = "tastile_uid";
```

**Proxy route での読取**: `src/app/api/proxy/[...path]/route.ts:43`

```ts
const userSub = request.cookies.get(COOKIE_USER_SUB)?.value;
```

**Bridge header 付与条件 (route.ts:38-65)**:
- `E2E_BYPASS_AUTH === "1"` → `x-owner-id` / `x-actor-id` 直注入 (bypass path)
- それ以外 → `COOKIE_USER_SUB` cookie があれば `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` を upstream へ転送 (bridge path)
- cookie 不在 + `Accept: text/html` → `/login` へ redirect
- cookie 不在 + JSON accept → 401

つまり **criterion 2 は「cookie 注入可能 = cookie 名が確定していて proxy route が読む」** であり、code path 上 MET。実機 Chrome 注入はこの procedure 実行時の環境制約 (後述 §2) で未実施。

### 1.3 Bridge secret alignment (H1a 完了前提の再 pin)

Web (`.env.development:26`):
```
TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d
```

Core container (`wslc container exec tastile-dev-api bash -c "env | grep BRIDGE"`):
```
TASTILE_WEB_BRIDGE_SECRET=dev-e2e-secret
```

**⚠️ MISMATCH DETECTED**: `.env.development` の値は 64-char ランダム secret、container 環境変数は `dev-e2e-secret`。
- Playwright 経由 (`playwright.config.ts:21` で `TASTILE_WEB_BRIDGE_SECRET: "dev-e2e-secret"` を webServer.env で上書き) は両者一致 → bridge auth OK
- `bun run dev` 直接起動 (web の `.env.development` を読む) は mismatch → bridge header 送っても upstream で **401 / unauthorized owner** になる可能性大

これは H1a の "manual bridge secret export" が再 alignment されていないことを示す。本 procedure のスコープ外だが、H4b (e2e bridge contract) または H4a の再 dispatch で対応必要。

### 1.4 `v1_subject` count baseline (criterion 3 観測用)

```text
$ wslc container exec tastile-dev-api psql -U tastile -d tastile -c \
    "SELECT count(*) AS subject_count FROM v1_subject;"
 subject_count
---------------
             9
(1 row)

$ wslc container exec tastile-dev-api psql -U tastile -d tastile -c \
    "SELECT id, kind, external_subject, display_name, created_at \
     FROM v1_subject ORDER BY created_at DESC LIMIT 5;"
                  id                  | kind |       external_subject       | display_name |          created_at
--------------------------------------+------+------------------------------+--------------+-------------------------------
 00000000-0000-0000-0000-000000000001 |    0 |                              |              | 2026-08-06 11:44:07.12479+00
 11111111-1111-1111-1111-111111111111 |    0 |                              |              | 2026-08-06 11:25:35.981715+00
 9b29443c-0311-5cce-a84d-03a12a326894 |    0 | bridge:a5b-idem-test-user    |              | 2026-08-06 10:55:52.501344+00
 78de4a34-b72c-5a2c-95f9-ab04d2fd79d1 |    0 | bridge:e2e-bridge-fix-verify |              | 2026-08-06 10:14:15.633582+00
 92a121b4-989d-5020-a6b7-f74213939b23 |    0 | bridge:a1c-meta-min-owner    |              | 2026-08-06 05:01:08.629649+00
(5 rows)
```

**Baseline: 9 件**。既存 bridge-a*-* の external_subject 値から、過去の H 配下 sub-task で bridge auth 経由の subject 生成が動いていた痕跡あり。

### 1.5 Existing spec file 影響範囲 (criterion 5)

Plan 想定の "4 spec file (G7a/G6a 配下)" は現状コードに存在しない。
実際に `E2E_BYPASS_AUTH` / `NEXT_PUBLIC_E2E_BYPASS_AUTH` / `TASTILE_BYPASS_AUTH` を参照する file は **2 件のみ**:

```text
e2e/scenario-A-test-study.spec.ts:11    // Env: NEXT_PUBLIC_E2E_BYPASS_AUTH=1 ...
e2e/scenario-A-test-study.spec.ts:110-113 // process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH !== "1" ガード
e2e/recurring-edit-title.spec.ts:11      // // forwards to 127.0.0.1:31400 and pins the bypass-auth actor.
playwright.config.ts:18                  // E2E_BYPASS_AUTH: "0"
playwright.config.ts:19                  // NEXT_PUBLIC_E2E_BYPASS_AUTH: "0"
```

`playwright.config.ts` は既に `E2E_BYPASS_AUTH: "0"` / `NEXT_PUBLIC_E2E_BYPASS_AUTH: "0"` で **bridge-mode 前提**。`scenario-A-test-study.spec.ts` の `process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH !== "1"` ガードは webServer.env で `=0` が渡るため fail する可能性 → H4b の対象。

`recurring-edit-title.spec.ts` の reference は **コメントのみ** (動作に影響なし)。実害なし。

## 2. Verification (DEFERRED items と理由)

### 2.1 Criterion 3: `v1_subject` +1 (DEFERRED)

**Reason**: 観測可能な QuickCreate 送信を駆動できない。必要な precondition:

1. `bun run dev` 起動 — 現状 **未起動** (`curl http://localhost:3000` → connection refused)。
2. Windows shell から container 内部 port 31400 へ直接到達不可。proxy route (`localhost:3000/api/proxy/v1/tiles`) 経由でも、criterion 1 の web `E2E_BYPASS_AUTH=""` (空文字) と §1.3 の bridge secret mismatch により、upstream が 401 を返す可能性が高い。
3. 起動していたとして、Chrome devtools での cookie 注入は人間の操作が必要 (Codex 環境では実行不可)。

**Baseline (比較基準) は取得済**:
- before: `SELECT count(*) FROM v1_subject` → **9**
- after: 駆動可能な環境では `AFTER = BEFORE + 1` を期待

### 2.2 Criterion 4: `bridge_auth_from_headers succeeded` log (DEFERRED)

**Reason**: criterion 3 と同根。QuickCreate 送信自体が実行できないため、core container log の該当行も pin 不能。

**Log line 確認先** (実行可能になった場合の場所):
- container log: `wslc container exec tastile-dev-api bash -c "grep -rh 'bridge_auth_from_headers' /var/log /app 2>/dev/null"` または daemon stdout を `wslc logs tastile-dev-api --tail 500`
- source: `tastile-core/crates/v1/api/src/handlers/common.rs` の `bridge_auth_from_headers` 関数 (`tracing::instrument` 付与済なら自動 log)

## 3. Code path summary (code-level evidence)

| Layer | File | Line | Behavior |
| --- | --- | --- | --- |
| Cookie name 定数 | `src/shared/auth/cookie-names.ts` | 10 | `COOKIE_USER_SUB = "tastile_uid"` |
| Proxy route import | `src/app/api/proxy/[...path]/route.ts` | 1 | `import { COOKIE_USER_SUB } from "@/shared/auth/cookies"` |
| E2E_BYPASS_AUTH 判定 | `src/app/api/proxy/[...path]/route.ts` | 7, 12 | `process.env.E2E_BYPASS_AUTH === "1"` で判定。空文字 → false → bridge path |
| Cookie 読取 | `src/app/api/proxy/[...path]/route.ts` | 43 | `request.cookies.get(COOKIE_USER_SUB)?.value` |
| Bridge header 注入 | `src/app/api/proxy/[...path]/route.ts` | 57-63 | `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` を upstream へ |
| Dev actor 直注入 (bypass path) | `src/app/api/proxy/[...path]/route.ts` | 38-40 | `x-owner-id` / `x-actor-id` = `00000000-0000-0000-0000-000000000001` |
| Test fixture | `src/app/api/proxy/route.test.ts` | 116-117, 140-141 | `expect(...).toBe("test-bridge-secret")` / `(...).toBe("cognito-sub-abc")` で bridge header 注入を pin 済 |

→ 静的 code path として **criterion 2 (cookie 注入機構の存在)** は完全に MET。

## 4. Rollback steps

`.env.development` を flip 前 (=1) に戻す手順:

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web

# 1) 現状確認
sed -n '29p;30p' .env.development
# 期待: "E2E_BYPASS_AUTH=" / "NEXT_PUBLIC_E2E_BYPASS_AUTH=" (空文字)

# 2) flip 前の値に戻す (任意のエディタで):
#    :29 → E2E_BYPASS_AUTH=1
#    :30 → NEXT_PUBLIC_E2E_BYPASS_AUTH=1

# 3) 戻した後の再確認
sed -n '29p;30p' .env.development
# 期待: "E2E_BYPASS_AUTH=1" / "NEXT_PUBLIC_E2E_BYPASS_AUTH=1"

# 4) dev server 再起動 (in-memory env を再読込)
#    Ctrl+C で停める → bun run dev
```

**Scope 注記**:
- `.env.development` は gitignore 対象のため rollback 操作は local-only。git diff / commit / push には載らない。
- bridge secret mismatch (`.env.development` の 64-char vs container の `dev-e2e-secret`) は本 rollback とは独立した H1a 再 alignment 案件。本 procedure では扱わない。
- `playwright.config.ts` の `E2E_BYPASS_AUTH: "0"` は source-controlled で既に bridge-mode 前提。rollback の影響を受けない (H4b で必要に応じて個別修正)。

## 5. 残課題 (H4b / H4a 再 dispatch への引き継ぎ)

| # | 項目 | 担当プラン | 備考 |
| --- | --- | --- | --- |
| 1 | `v1_subject` +1 の実機観測 | H4a 再 dispatch | §1.4 の baseline = 9 と比較可能 |
| 2 | bridge_auth log line の実機 pin | H4a 再 dispatch | §2.2 参照 |
| 3 | Bridge secret alignment (web `.env.development` ↔ core container) | H1a 再 dispatch | §1.3 参照 |
| 4 | `e2e/scenario-A-test-study.spec.ts` の `NEXT_PUBLIC_E2E_BYPASS_AUTH !== "1"` ガード修正 | H4b | webServer.env で `=0` が渡るため fail する想定 |
| 5 | Chrome devtools での cookie 注入 + Network tab header 確認 (criterion 2 実機 pin) | H4a 再 dispatch (manual 操作要) | Codex 環境では不可 |

## 6. 関連

- Plan: `docs/plans/H4a-bridge-mode-flag-flip.md`
- Issue: tastile-web #72
- Memory `feedback_cf_cookie_name_waf.md` — cookie rename `tastile_user_sub` → `tastile_uid`
- Memory `project_tastile_v1_bridge_auth_uuidv5.md` — bridge auth UUIDv5 derivation
- Memory `feedback_bridge_owner_provisioning_20260721.md` — `ensure_bridge_owner_provisioning` が `v1_subject` を初めて作る経路