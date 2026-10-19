# T1a — QuickCreate tile 作成 runtime trace

## メタデータ

- **ID**: T1a
- **Phase**: runtime observation / canonical trace
- **Target repos**: `tastile-web`, `tastile-core`
- **Depends on**: `A5b-quickcreate-submit-handler`, `H2-proxy-bridge-audit`, `G-stack-up`
- **Sub-project parent**: T (traces)
- **Source of truth**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts`, `submit.ts`, `schedule-definition.ts`; `tastile-core/crates-v1/api/src/handlers/source_tiles.rs`; `source_tile_repo.rs`
- **Trace rule**: 推測ではなく、browser/network/API log/DB query の観測結果を記録する。未観測値は `TBD` とし、実装から補完しない。

## 前提

- 現行の canonical endpoint は `POST /v1/schedule-definitions` ではなく、SourceTile 系の command surface として `POST /v1/source-tiles` が存在する。QuickCreate wire client は現在 `/v1/schedule-definitions` を呼ぶため、両者の実 runtime の一致/不一致を最初に確認する。
- Web の proxy base は `/api/proxy`、E2E bypass 時の upstream は `http://localhost:31400`。通常時は `CLOUD_API_BASE` が使われる (`tastile-web/src/app/api/proxy/[...path]/route.ts:3-7,16-20`)。
- Proxy は request method/body を保ち、通常認証では `authorization`、bridge secret、session user を upstream に付加する (`route.ts:27-70`)。
- SourceTile は `v1_tile(kind=3)` として保存され、`v1_plan`、SourceTile 子テーブル、必要な occurrence/placement を同一 command transaction で生成する (`tastile-core/crates-v1/storage/src/source_tile_repo.rs:377-460`)。
- 実 DB は PostgreSQL。JSONB は idempotency response cache 以外の正本に使わない (`tastile-core/crates-v1/storage/migrations/V1_001__base.sql:0-6,290-300`)。

## 目的

QuickCreate の Create click から、wire payload、proxy request、core handler/dispatcher、transaction、response、worker materialization までを一つの実測可能な trace として固定する。特に、ユーザー指定の `/v1/schedule-definitions` 経路と現行 SourceTile `/v1/source-tiles` 経路が実際にどちらへ到達するかを canonical reference にする。

## 受入条件

- [ ] Create click の browser event と request 1 件を request body/headers/status/response body 付きで保存する。
- [ ] `buildQuickCreateSchedulePayload` の入力 state と出力の `source_schedule`, `source_horizon`, `tile`, `plan`, `windows`, `flows`, `relations` を対応付ける (`quick-create-schedule-wire.ts:212-348`)。
- [ ] upstream path が `POST /v1/schedule-definitions` または `POST /v1/source-tiles` のどちらかとして実測され、proxy rewrite の有無を記録する。
- [ ] core が通った handler、command kind、DB transaction 内の insert/update row counts を記録する。
- [ ] response の `aggregate.id`, `aggregate_meta.plan_id`, `source_tile_id`, occurrence/placement ids と revision を記録する。成功契約は missing ids を failure とする (`schedule-definition.ts:220-247`)。
- [ ] worker または read-time materialization 後に `v1_placement` rows が生成されたことを owner/source/occurrence 単位で確認する。

## 実装手順

1. `tastile-web` の dev/E2E stack と `tastile-core` API/worker/Postgres の実体を確認し、起動 binary/image の commit SHA を記録する。
2. QuickCreate を開き、title、duration、one-time/recurring、window を最小入力する。入力値と owner UUID を記録する。
3. Browser DevTools Network で Create をクリックする。`POST` request の URL、redirect/proxy、headers、request body、status、response body を保存する。
4. `quick-create-store.ts` の snapshot と `buildQuickCreateSchedulePayload` 出力を同じ run id で記録する。入力の local date/time が UTC instant に変換される箇所は `quick-create-schedule-wire.ts:24-63,74-109` を参照する。
5. `submitCreateTile` の call chain を確認する (`submit.ts:41-51`)。`publishScheduleDefinition` が envelope (`expected_revision`, `idempotency_key`, `occurred_at`, `payload`) を作る (`schedule-definition.ts:202-225`)。
6. Proxy を通る場合、`route.ts:16-73` の path conversion、bridge header injection、body forwarding を access log と upstream log で照合する。`sendCommand`/`postCommand` の method/body serialization は `endpoints.ts:77-83,146-188` を参照する。
7. Core route table (`crates-v1/api/src/handlers/mod.rs`, `main.rs`) から実際の handler を特定する。ユーザー指定の `schedule_definitions.rs:create` が存在しない場合は、代替 handler と不存在を明記する。現行 SourceTile handler の create は `source_tiles.rs:107-125`。
8. Core command dispatch の command kind、actor owner、idempotency key、transaction boundary を log/DB の `v1_idempotency` で照合する。直接 DB write を行う箇所ではなく Store/dispatcher 経路を記録する。
9. transaction commit 後、`v1_tile`, `v1_plan`, `v1_source_tile`, `v1_source_schedule`, `v1_source_window`, plan child rows を source id/plan id で count/query する。base parent schema は `V1_001__base.sql:45-145`、SourceTile schema は `V1_020__source_tile_occurrence.sql:1-87` を参照する。
10. response の IDs を DB rows と照合する。`source_tile_repo::create` は tile/plan/source metadata と occurrence/placement IDs を response meta に返す (`source_tile_repo.rs:446-460`)。
11. worker を待ち、`v1_source_materialization_cursor`, `v1_source_occurrence`, `v1_placement`, `v1_placement_baseline`, `v1_placement_life` の before/after を比較する。read request が lazy materialize した場合は worker と区別して記録する。
12. run artifact に request JSON、response JSON、DB query output、server/worker log、commit/image SHA を保存する。canonical plan 本文には要約と artifact path のみを書く。

## 検証手順

```bash
# Web unit contract
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts src/shared/api/v1/schedule-definition.test.ts src/shared/api/v1/submit.test.ts

# Core source scheduling integration (実 DB URL が到達可能な環境のみ)
cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_source_tile_scheduling -- --test-threads=1

# API/worker smoke
curl -i -X POST "http://127.0.0.1:31400/v1/source-tiles" \
  -H "content-type: application/json" -H "x-owner-id: $OWNER_ID" -H "x-actor-id: $OWNER_ID" \
  --data-binary @request.json

psql "$TASTILE_DATABASE_URL" -c "SELECT id,kind,owner_id,revision,plan_id FROM v1_tile WHERE id='$TILE_ID';"
psql "$TASTILE_DATABASE_URL" -c "SELECT id,source_tile_id,occurrence_id,source_kind,revision FROM v1_placement WHERE source_tile_id='$TILE_ID' ORDER BY id;"
```

期待値は、実際の HTTP status/body と `test result: ok` の行を根拠に記録する。テストが skip した場合は未検証扱いとする。

## リスク

- **endpoint drift**: QuickCreate client の `/v1/schedule-definitions` と core route の `/v1/source-tiles` が異なる可能性。修正をこの trace で行わず、実測結果を T1a に固定して後続 plan の前提にする。
- **proxy auth 二重経路**: stale Bearer と bridge headers の組合せは `common::authenticate` の fall-through 契約に依存する。header 値を artifact に残すが token 本文/secret は保存しない。
- **lazy materialization の混同**: timeline read 自身が placement を作るため、worker tick の結果と同じ row に見える。timestamp、worker log、read request の前後を分離する。
- **partial commit の誤認**: response だけを見ず、transaction rollback 時の各 parent/child row count を確認する。
- **実環境の stale image**: source と稼働 binary/image の SHA が異なる場合、source trace を runtime truth と扱わない。

## 関連

- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\stores\quick-create-store.ts`
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\quick-create-schedule-wire.ts:212-348`
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\submit.ts:41-51`
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\schedule-definition.ts:202-247`
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts:16-90`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\source_tiles.rs:107-125`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\source_tile_repo.rs:377-460`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_001__base.sql:45-145`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_020__source_tile_occurrence.sql:1-87`
- Sibling traces: `T1b`, `T2a`, `T2b`, `T3a`, `T3b`
