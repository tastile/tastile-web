# A3a — Meta owner bridge

## メタデータ

- **ID**: A3a
- **Phase**: 1 (Meta/auth ownership)
- **Target repos**: `tastile-web`, `tastile-core`
- **Sub-project parent**: A (Tile + Plan + Meta minimum)
- **Depends on**: A1a、A1b、H 系 bridge-auth/e2e harness
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-23` の `meta.ownerSubjectId`
- **Sibling plans**: A1a（core fields）、A1b（visual/externalId）

## 前提

- `meta.ownerSubjectId` は QuickCreate payload body の正本ではない。core が認証済み request headers から owner を解決し、`v1_tile.owner_id` を設定する。
- web proxy は `tastile-web/src/app/api/proxy/[...path]/route.ts:27-55` で cookie を読み、bridge secret がある場合に `x-tastile-web-bridge-secret` と `x-tastile-web-session-user` を注入する。`COOKIE_USER_SUB` import は同 file `:1`、cookie read は `:33-35`。
- core は `tastile-core/crates-v1/api/src/handlers/common.rs:801-824` の `bridge_auth_from_headers` で secret/user_sub を検証し、`Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes())` を `:822` で計算する。指定 line `:823` は現 HEAD では `Some((owner_id, owner_id))`。
- UUIDv5 contract は既に Rust unit test `common.rs:865-879` と storage AT `crates-v1/storage/tests/at_bridge_owner_provisioning.rs:255-283` に存在する。重複 test を増やす前に、web header injection と tile persistence を跨ぐ欠けた境界を test 対象にする。
- bridge owner provisioning は owner UUID を導出するだけでなく `v1_subject` を用意する必要がある。既存 API integration は `crates-v1/api/tests/bridge_auth_provisioning.rs:103-164` で first request provisioning を検証している。
- proxy の e2e bypass は `route.ts:29-32` で固定 `x-owner-id` を送り bridge path を通らない。A3a の検証では `E2E_BYPASS_AUTH=1` を使わず、有効な user-sub cookie + bridge secret を使う。

## 目的

ブラウザの `COOKIE_USER_SUB` 値が web proxy の bridge headers を経由し、core の canonical UUIDv5 導出で owner UUID になり、その UUID が QuickCreate で作成された `v1_tile.owner_id` に保存される cross-repo contract を unit/integration/e2e で固定する。

## 受入条件

- web proxy が `COOKIE_USER_SUB=<user_sub>` を `x-tastile-web-session-user: <user_sub>` として無変換で送り、設定済み secret を `x-tastile-web-bridge-secret` に送る。
- core が `Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes())` で owner/actor を導出する（`common.rs:801-824`）。namespace、trim、byte encoding を変更しない。
- 有効 bridge headers で QuickCreate を submit した後、`v1_tile.owner_id` が cookie の raw `user_sub` から計算した UUIDv5 と一致する。
- body 内の `owner_id` または `meta.ownerSubjectId` を信頼して bridge owner を上書きしない。handler は `resolve_command_owner`（`tastile-core/crates-v1/api/src/handlers/commands.rs:93-104`）を通す。
- Vitest または Rust unit test を少なくとも 1 件追加/強化して cross-repo contract を pin する。既存 Rust unit が UUID derivation を既に pin しているため、第一候補は proxy Vitest の header injection test。
- 実 PostgreSQL で `v1_subject` provisioning と `v1_tile.owner_id` の両方を観測する。DB 未接続による skip は完了とみなさない。

## 実装手順

1. **既存 contract を再読する。** `route.ts:27-55`、`common.rs:801-824,865-879`、`commands.rs:87-107`、`bridge_auth_provisioning.rs:103-164` を読み、header name・secret gate・UUID namespace を表にする。
2. **Vitest を RED にする。** proxy の既存 test (`tastile-web/src/proxy.test.ts` または route test) に、`COOKIE_USER_SUB="cognito-sub-e2e"` と `TASTILE_WEB_BRIDGE_SECRET="test-bridge-secret"` を与え、mock upstream fetch が受け取った headers を検査する test を追加する。
3. **proxy test の期待を固定する。** `x-tastile-web-session-user === "cognito-sub-e2e"`、`x-tastile-web-bridge-secret === "test-bridge-secret"` を assert する。secret 未設定時は bridge headers を送らない既存 fail-closed 挙動も回帰確認する。
4. **最小修正だけ行う。** `route.ts:47-55` が test を満たさない場合のみ修正する。cookie rename、auth priority、Bearer fall-through は本 plan の範囲外。
5. **Rust UUID contract を評価する。** `common.rs:865-879` が namespace + bytes を既に pin しているため、同内容の test を新設しない。必要なら test 名/fixture を e2e cookie 値と合わせるだけに留める。追加 test が必要なら `bridge_auth_provisioning.rs` に「bridge POST が作成した tile owner」の integration test を置く。
6. **cross-layer integration test を RED にする。** 有効 bridge headers 付きで schedule definition POST を行い、response の tile id を取得した後、DBから `v1_tile.owner_id` を読む test を `tastile-core/crates-v1/api/tests/` の既存 bridge suite に追加する。
7. **expected UUID を test 内で計算する。** fixture `user_sub` から次の一式だけで期待値を作る。
   ```rust
   let expected_owner = Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes());
   ```
   hard-coded UUID を書かず、namespace contract を明示する。
8. **provisioning も assert する。** `v1_subject.id = expected_owner` かつ `external_subject = 'bridge:' || user_sub` の row が存在することを、`bridge_auth_provisioning.rs:142-153` の既存形に合わせて確認する。
9. **browser e2e を追加する。** `E2E_BYPASS_AUTH` を無効にし、browser context に `COOKIE_USER_SUB` cookie を設定、web server に bridge secret を設定して QuickCreate title=`E2E smoke` を submit する。
10. **DB e2e assertion を行う。** title を一意化して次を実行する。
    ```sql
    SELECT owner_id
    FROM v1_tile
    WHERE title = 'E2E smoke';
    ```
    結果を cookie の raw value から算出した UUIDv5 と比較する。DB列が UUID 型でも text 型でも文字列表現を正規化して比較する。
11. **spoofing regression を確認する。** request body に owner field が存在する場合に別 UUID を入れても、認証 owner 以外は採用されないことを既存 authorization test で確認する。body field が無い場合は新設しない。
12. **小さく commit する。** proxy Vitest、core bridge integration、browser e2e を可能なら別 commit にする。実装時は `@test-driven-development`、cross-repo確認は `@cross-repo-contract-check`、実行時は `@executing-plans` を使う。

## 検証手順

```bash
# 1. web proxy header injection
cd tastile-web
bun test src/proxy.test.ts
# 期待: COOKIE_USER_SUB が bridge user header に無変換で入り、secret gate も PASS

# 2. core pure UUID derivation（wslc 内）
cd tastile-core
cargo test --manifest-path crates-v1/Cargo.toml -p api --lib \
  handlers::common::tests::bridge_auth_derives_stable_owner_from_web_session_user
# 期待: 1 passed; 0 failed

# 3. bridge provisioning/integration（実 PostgreSQL、skip 不可）
cargo test --manifest-path crates-v1/Cargo.toml -p api --test bridge_auth_provisioning -- --test-threads=1
# 期待: test result: ok; N passed; 0 failed; 0 ignored

# 4. browser QuickCreate e2e（E2E_BYPASS_AUTH != 1）
cd tastile-web
bun run test:e2e quick-tile-create-e2e.spec.ts
# 期待: submit success、v1_tile.owner_id == UUIDv5(cookie user_sub)

# 5. DB observation
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  "SELECT owner_id FROM v1_tile WHERE title='E2E smoke';"
# 期待: UUIDv5(NAMESPACE_OID, COOKIE_USER_SUB bytes) と同じ UUID
```

UUID の独立計算は Rust test helper、または同じ `uuid` crate を使う短い harness で行う。別 namespace や文字列前処理を独自実装しない。

## リスク

- **bypass auth の偽陽性**: `route.ts:29-32` の bypass は固定 owner header を使い、bridge UUIDv5 を検証しない。A3a e2e では必ず無効化する。
- **line drift**: canonical UUID 計算は現 HEAD `common.rs:822`、`:823` は return。plan 実行時に line を再確認する。
- **Bearer priority**: proxy は API token と bridge headers を同時送信し得る（`route.ts:33-55`）。有効 Bearer は bridge より優先されるため、bridge-only test では API token cookie を消す。stale Bearer fall-through contract は壊さない。
- **provisioning 欠落**: UUIDを導出できても `v1_subject` が無いと storage hook が owner を見落とす。owner_id だけでなく subject row を確認する。
- **user_sub normalization**: core は header valueを `trim()` してから bytes化する（`common.rs:815-822`）。cookie fixture に意図しない空白を含めず、trim contract を別 test と混ぜない。
- **title collision**: `WHERE title='E2E smoke'` が複数行を返すと別 owner を誤認する。pre-test cleanup または run-specific suffix と返却 tile id の併用で一意化する。
- **既存 test 重複**: UUID derivation unit は既に `common.rs:865-879` にある。価値のない同型 test を増やさず、proxy injection / persisted owner の未カバー境界に集中する。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md:6-23`
- Proxy injection: `tastile-web/src/app/api/proxy/[...path]/route.ts:1,27-55`
- Proxy tests: `tastile-web/src/proxy.test.ts`
- Bridge derivation: `tastile-core/crates-v1/api/src/handlers/common.rs:801-824`
- Existing Rust unit: `tastile-core/crates-v1/api/src/handlers/common.rs:865-879`
- Command owner resolution: `tastile-core/crates-v1/api/src/handlers/commands.rs:87-107`
- Provisioning integration: `tastile-core/crates-v1/api/tests/bridge_auth_provisioning.rs:103-164`
- Canonical storage derivation AT: `tastile-core/crates-v1/storage/tests/at_bridge_owner_provisioning.rs:255-283`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
