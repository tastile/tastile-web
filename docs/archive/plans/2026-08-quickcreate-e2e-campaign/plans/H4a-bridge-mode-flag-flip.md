# H4a — Flip E2E_BYPASS_AUTH=0 and verify cookie path

## メタデータ

- **ID**: H4a
- **Phase**: 1 (auth bridge alignment)
- **Target repo**: `tastile-web`
- **Sub-project parent**: H (auth-bridge)
- **Depends on**: H1a (BRIDGE_SECRET export), H1c (bridge secret validation)
- **Source spec**: `04-sub-projects/H-auth-bridge.md` §"Verification"
- **Sibling plans**: H3a (bridge auth curl verify), H4b (e2e bridge contract)
- **Breaks**: G7a (e2e run quick tile), G6a (playwright config check) — 既存の 4 spec file が `E2E_BYPASS_AUTH=1` 前提で書かれているため flip 後に壊れる

## 前提

- `tastile-web/.env.development:29` に `E2E_BYPASS_AUTH=1`、`:30` に `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` が設定済 (現状)
- `tastile-core` 側で `BRIDGE_SECRET` が `.env.development:26` の値と一致した状態で wslc stack が起動済 (H1a 完了前提)
- `tastile-web/src/app/api/proxy/[...path]/route.ts` は `COOKIE_USER_SUB` cookie 在り + `E2E_BYPASS_AUTH != "1"` のときに bridge headers (`x-tastile-web-bridge-secret` + `x-tastile-web-session-user`) を付与する実装 (source spec §"Web-side wiring")
- wslc 経由で `tastile-v1-api` + `tastile-db` コンテナが起動しており、`v1_subject` テーブルが inspect 可能
- 既存の 4 spec file (G7a / G6a 配下) は `E2E_BYPASS_AUTH=1` を前提に書かれているため、本プラン flip 後に **これらを `E2E_BYPASS_AUTH=1` に戻すか、bridge mode 前提に書き換える必要** が出る (source spec §"Verification" step 3)

## 目的

`E2E_BYPASS_AUTH=1` のままだと QuickCreate 経路が **`x-owner-id` / `x-actor-id` 直接注入** で素通りし、production-mode の bridge auth contract を **一度も実機で検証していない**。本プランは env を flip した上で `COOKIE_USER_SUB` cookie を注入し、QuickCreate 1 件が `bridge_auth_from_headers` → `ensure_bridge_owner_provisioning` (`crates-v1/api/src/handlers/common.rs:758-766`) を経由して `v1_subject` を新規 row として永続化することを **実機 observation で pin** する。

## 受入条件

- `tastile-web/.env.development:29` と `:30` が **空文字** になっている (web `bun run dev` からは両方とも `""` として読まれる)
- `bun run dev` 起動後、Chrome devtools の Application → Cookies に `tastile_user_sub=e2e-bypass-user` を手動注入可能
- QuickCreate 送信 1 件で `v1_subject` テーブルに **新規 row が +1** される (`SELECT count(*) FROM v1_subject` で before/after 比較)
- core log に `bridge_auth_from_headers succeeded` 相当の log 行が出る (proxy header injection が contract 通り動作している pin)
- 既存の 4 spec file (G7a / G6a 配下) が flip 後に **fail する** ことを明示的に確認 + 戻し方 (rollback) を本プランに記述

## 実装手順

### Step 1: `.env.development` 編集 (line 29, 30)

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
# 編集前確認
sed -n '29p;30p' .env.development
# 期待: "E2E_BYPASS_AUTH=1" / "NEXT_PUBLIC_E2E_BYPASS_AUTH=1"
```

編集:

```
E2E_BYPASS_AUTH=
NEXT_PUBLIC_E2E_BYPASS_AUTH=
```

注:
- `E2E_BYPASS_AUTH=` (空文字) は `process.env.E2E_BYPASS_AUTH === "1"` の判定が **false** になる (Next.js の env 読込は空文字を空文字として返す)
- `# E2E_BYPASS_AUTH=` のようにコメントアウトしても同じ effect だが、Playwright の `webServer.command` が env を echo する場面で混乱するため **空文字で残す** ほうが見やすい
- `NEXT_PUBLIC_E2E_BYPASS_AUTH` は client bundle に inlining されるため (`NEXT_PUBLIC_*` 規約)、編集後に **必ず `bun run dev` を再起動** してバンドルを rebuild すること。再起動しないと古いバンドルが cache される

### Step 2: 既存の dev server を停め、再起動

```bash
# Windows / Git Bash 環境。Ctrl+C で bun run dev を停める
bun run dev
# 期待: ▲ Next.js 16.0.0 ... - Local: http://localhost:3000
```

`bun run dev` が **port 3000** で起動していること (G6a で確認済の前提)。

### Step 3: 既存 4 spec file への影響確認 (壊れる想定)

本プラン flip 後に **fail する** ことが想定される既存 spec:
- `tastile-web/e2e/quick-tile-create-e2e.spec.ts` (G7a) — `E2E_BYPASS_AUTH=1` 前提で cookie 注入を skip している実装の可能性
- `tastile-web/e2e/timeline-load.spec.ts` (G2a) — 同上
- `tastile-web/e2e/auth-state-restoration.spec.ts` — 同上
- `tastile-web/e2e/dashboard-flow.spec.ts` — 同上

確認:

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
grep -l "E2E_BYPASS_AUTH\|bypass" e2e/*.spec.ts
# 期待: 上記 4 file が list up される
```

### Step 4: 既存 4 spec の退避 (任意)

本プランのスコープは H4a の flag flip のみだが、既存 spec を **退避** することで「flip が spec を壊す」事実を明示できる:

```bash
mkdir -p e2e/_backup_e2e_bypass_1
cp e2e/quick-tile-create-e2e.spec.ts e2e/_backup_e2e_bypass_1/
cp e2e/timeline-load.spec.ts e2e/_backup_e2e_bypass_1/
cp e2e/auth-state-restoration.spec.ts e2e/_backup_e2e_bypass_1/
cp e2e/dashboard-flow.spec.ts e2e/_backup_e2e_bypass_1/
```

`bun run test:e2e` で **これらが fail することを確認** することで、bypass path に依存していた contract を pin できる。fail 確認後、本プランの observation を進める。

### Step 5: Chrome devtools で cookie 注入

1. http://localhost:3000 を開く
2. Chrome devtools (F12) → Application → Storage → Cookies → `http://localhost:3000`
3. `tastile_user_sub` を新規追加:
   - **Name**: `tastile_user_sub` (注: memory `feedback_cf_cookie_name_waf.md` の cookie rename 経緯より、`tastile_uid` に rename されている可能性あり。`tastile-web/src/lib/cognito/cookie-names.ts` で確認推奨)
   - **Value**: `e2e-bypass-user`
   - **Domain**: `localhost`
   - **Path**: `/`
   - **HttpOnly**: **off** (JS から読める必要あり。proxy route は server side で `cookies()` から読むため HttpOnly でも良いが、本プランの observation では devtools 手動注入するので HttpOnly off で統一)
   - **Secure**: off
4. ページを reload

cookie 名が `tastile_user_sub` か `tastile_uid` かは `tastile-web/src/lib/cognito/cookie-names.ts` の `COOKIE_USER_SUB` 定数 export で確認:

```bash
grep -r "COOKIE_USER_SUB" tastile-web/src/lib/cognito/ | head -5
# 期待: COOKIE_USER_SUB = "tastile_user_sub" ないし "tastile_uid"
```

### Step 6: QuickCreate submission (1 件)

1. Dashboard → QuickCreate panel を開く
2. title だけ入力して submit (他 field は default 値で OK)
3. Network tab で `/api/proxy/v1/tiles` (POST) の request headers を確認:
   - `x-tastile-web-bridge-secret: <64-char secret>` ← `.env.development:26` の値と一致
   - `x-tastile-web-session-user: e2e-bypass-user` ← cookie の値と一致
   - `Authorization` header は **付かない** (E2E_BYPASS_AUTH=0 + COOKIE_USER_SUB 在り の組合せ。proxy route が bridge headers のみ付与)
4. Response: HTTP 200 / `tile_id` を含む JSON

### Step 7: `v1_subject` テーブルで +1 を pin

```bash
# before
BEFORE=$(wslc container exec tastile-db psql -U tastile -d tastile_db -tAc "SELECT count(*) FROM v1_subject")
echo "BEFORE: $BEFORE"

# QuickCreate 送信 (Step 6)

# after
AFTER=$(wslc container exec tastile-db psql -U tastile -d tastile_db -tAc "SELECT count(*) FROM v1_subject")
echo "AFTER: $AFTER"

# 差分確認
[ $((AFTER - BEFORE)) -eq 1 ] && echo "OK: +1 row" || echo "FAIL: delta=$((AFTER - BEFORE))"
# 期待: "OK: +1 row"
```

### Step 8: core log で bridge auth 経路を pin

```bash
wslc logs tastile-api --tail 200 | grep -i "bridge_auth_from_headers"
# 期待: bridge_auth success log が出る (例: "bridge_auth_from_headers succeeded for owner=<uuidv5>")
```

注: log format は `RUST_LOG=info,storage=debug` (`up-v1.sh:69`) の設定次第。`bridge_auth_from_headers` の log が出ていない場合は `tracing::instrument` が付与されていない可能性。本プランでは **HTTP 200 + `v1_subject` +1 + cookie 注入済** の 3 点セットで contract を pin できれば十分。

## 検証手順

### Verify 1: env flip が effective

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
sed -n '29p;30p' .env.development
# 期待: "E2E_BYPASS_AUTH=" / "NEXT_PUBLIC_E2E_BYPASS_AUTH=" (空文字)
```

### Verify 2: client bundle が新 env で rebuild 済

```bash
# Chrome devtools の Network tab で /_next/static/chunks/*.js を 1 つ選び、
# `grep -c "E2E_BYPASS_AUTH" <chunk>` で "1" が出てこないことを確認
# (古い bundle だと "E2E_BYPASS_AUTH=1" が inlining されている)
```

簡易確認:

```bash
curl -s http://localhost:3000 | grep -c "E2E_BYPASS_AUTH"
# 期待: 0 (SSR HTML には NEXT_PUBLIC_* が露出しない想定)
```

### Verify 3: bridge headers が request に付与されている

devtools Network tab で QuickCreate POST を選び、request headers を確認:

- `x-tastile-web-bridge-secret`: 64-char secret
- `x-tastile-web-session-user`: `e2e-bypass-user`
- `Authorization`: **不在** (bridge headers に上書き / suppress)

### Verify 4: `v1_subject` row の新規作成

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -c "
  SELECT id, kind, created_at FROM v1_subject ORDER BY created_at DESC LIMIT 3;
"
# 期待: 1 件目 (最新) が今作った owner。kind = 0 (USER)。
```

UUIDv5 derivation pin:

```bash
EXPECTED_OWNER=$(uuidgen --namespace @oid --name "e2e-bypass-user" --sha1 2>/dev/null || python -c "import uuid; print(uuid.uuid5(uuid.NAMESPACE_OID, 'e2e-bypass-user'))")
echo "expected owner: $EXPECTED_OWNER"
wslc container exec tastile-db psql -U tastile -d tastile_db -tAc "SELECT id FROM v1_subject ORDER BY created_at DESC LIMIT 1"
# 期待: 上記 EXPECTED_OWNER と一致 (memory `project_tastile_v1_bridge_auth_uuidv5.md`)
```

### Verify 5: `ensure_bridge_owner_provisioning` が default 休憩 Recurring も同時に seed したか

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -c "
  SELECT t.title FROM v1_tile t
  WHERE t.owner_id = (
    SELECT id FROM v1_subject ORDER BY created_at DESC LIMIT 1
  );
"
# 期待: 少なくとも "休憩" 1 行 (memory `project_v1_android_migration_done.md` + V1_015 default break seed)
```

注: `ensure_bridge_owner_provisioning` が `default_break_recurring_for_owner` を hook しているかは V1_015 + memory `feedback_bridge_owner_provisioning_20260721.md` に依存。古いビルド (V1_015 適用前) では seed されない可能性あり。本プランの observation 時に build hash を確認すること。

### Verify 6: 既存 4 spec が fail することを確認

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:e2e e2e/quick-tile-create-e2e.spec.ts
# 期待: FAIL (E2E_BYPASS_AUTH=1 前提の実装が cookie 不在で 401 を受ける)
```

`Step 4` で退避した `_backup_e2e_bypass_1/` から 4 spec を一時的に戻して再実行 → 緑化 → 再び退避することで「bypass path 依存」を pin できる。が、本プランのスコープは **flip の動作確認** まで。spec の修正は別 PR (H4b)。

## リスク

- **既存 4 spec file が壊れる**: source spec §"Verification" step 3 が明示する known issue。`e2e/_backup_e2e_bypass_1/` に退避し、`bun run test:e2e` の fail を確認した上で、H4b (e2e bridge contract) で bridge mode 前提に書き換える
- **production env との混同**: `.env.development` を編集しているので production build には影響しない (Next.js の env は build time に inline される)。ただし `NEXT_PUBLIC_E2E_BYPASS_AUTH=` を空文字にすると production と同じ env 状態になる。production で絶対に flip しないこと (CI で `E2E_BYPASS_AUTH=1` が強制されているか確認)
- **`tastile_user_sub` vs `tastile_uid` cookie name**: memory `feedback_cf_cookie_name_waf.md` で cookie rename 履歴あり。`tastile-web/src/lib/cognito/cookie-names.ts` の `COOKIE_USER_SUB` 定数を参照して正しい name を使うこと
- **HttpOnly 設定**: devtools 手動注入するので HttpOnly off だが、本番 deploy で cookie を server side 注入する場合は HttpOnly on の方が安全
- **cookie 注入後の reload 漏れ**: devtools で cookie 追加後、ページ reload を忘れると同じ shell の in-memory state に古い cookie set が残ることがある
- **`v1_subject` +1 にならないケース**: 
  - `tastile_user_sub` cookie が正しく読めていない (cookie name mismatch / Path mismatch)
  - bridge secret mismatch (H1a が未完了 / default `wslc-dev-bridge-secret` のまま)
  - api container が古い image で起動している (古い image には `ensure_bridge_owner_provisioning` が無い可能性)
  - この場合は Verify 3 の request header 確認 + api container log (`wslc logs tastile-api`) で切り分け
- **`v1_subject` table の +1 が他経路由来の可能性**: 自動 seed (V1_015 backfill) や他 worker tick が同タイミングで走る可能性。`wslc logs tastile-api --tail 50 | grep -i "create_subject"` で該当 log を 1 行 pin して混同を避ける

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §"Verification" + §"Web-side wiring"
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Sub-projects index: `tile-create-e2e-wiring/00-overview.md`
- Bridge auth header spec: `tile-create-e2e-wiring/04-sub-projects/H-auth-bridge.md` §"Bridge header spec"
- H1a (Manual bridge secret export) — 本プランの前提
- H1c (bridge secret validation) — env injection 経路の検証
- H3a (bridge auth curl verify) — 4 種の header 組合せでの contract pin
- H4b (e2e bridge contract) — 既存 4 spec を bridge mode 前提に書き換える後続 plan
- memory `project_v1_bridge_auth_uuidv5.md` — UUIDv5 derivation pin
- memory `feedback_bridge_owner_provisioning_20260721.md` — bridge owner has no v1_subject until storage is asked
- memory `feedback_cf_cookie_name_waf.md` — `tastile_user_sub` → `tastile_uid` rename 経緯
- V1_015 default break seed: `tastile-core/HARNESS.md` §"実装履歴" + `crates-v1/storage/src/default_break_recurring.rs`
- `tastile-web/src/lib/cognito/cookie-names.ts` — `COOKIE_USER_SUB` 定数の export 元
