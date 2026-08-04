# T2a — tile delete runtime trace

## メタデータ

- **ID**: T2a
- **Phase**: runtime observation / canonical trace
- **Target repos**: `tastile-web`, `tastile-core`
- **Depends on**: `T1a`, `T1b`, `T2b`
- **Source of truth**: actual UI delete call, core route/dispatcher, `source_tile_repo.rs`, migrations
- **Scope note**: 現行 canonical SourceTile path は `cancel` (`POST /v1/source-tiles/{id}/cancel`) であり、物理 DELETE endpoint が存在するかは未確定。Delete という UX action が archive/cancel/close のどれへ写像されるかを観測して固定する。

## 前提

- SourceTile handler は `cancel` を `CommandKind::CancelSourceTile` として dispatch する (`tastile-core/crates-v1/api/src/handlers/source_tiles.rs:182-210`)。
- cancel は active state と expected revision を検証し、source state を CANCELLED に更新し、lifecycle event を追加し、auto-managed placements を close する (`tastile-core/crates-v1/storage/src/source_tile_repo.rs:3047-3211`)。
- placement close は `v1_placement_life.close=true`, `closed_at=now` であり、placement parent row を削除しない (`source_tile_repo.rs:3138-3147`)。
- source lifecycle event schema は `v1_source_lifecycle_event` に source/prev/next/actor/time/reason を正規化する (`crates-v1/storage/migrations/V1_026__source_state_and_producer.sql:24-34`)。
- Parent FK に `ON DELETE CASCADE` がある child tables もあるため、物理 delete が本当に起動した場合は cascade を DB state で確認する (`V1_001__base.sql:45-145`; SourceTile occurrence `V1_020__source_tile_occurrence.sql:1-87`)。

## 目的

ユーザーが Delete/Remove を押した際の完全な runtime trace を作り、API verb/endpoint、lifecycle transition、placement closure、audit/outbox、execution protection、DB cascade の実態を確定する。削除を「行が消える」と仮定せず、close/archive/cancel と物理削除を区別する。

## 受入条件

- [ ] UI action から発生する全 request の verb、URL、body、status、response を記録する。
- [ ] delete action が `DELETE`, `POST .../cancel`, archive command、または別 endpoint のどれかを実測する。
- [ ] source state/revision の before→after と stale/duplicate cancel の error shape を記録する。
- [ ] 影響を受けた placements の対象条件、revision、life close、closed_at、domain/outbox event を記録する。
- [ ] active execution が存在する placement/source を使い、delete action が execution/segment を変更するかを確認する。
- [ ] 物理 cascade がある場合、削除された child table rows と残った audit rows を FK/table 単位で記録する。

## 実装手順

1. owner、active SourceTile、少なくとも 2 件の generated placement、1 件の非対象 owner placement、可能なら active execution を fixture にする。全対象 table の row IDs/revisions を snapshot する。
2. UI の Delete/Remove action を browser で実行し、Network trace を保存する。Confirm dialog がある場合、confirm 前後を別時刻にする。
3. Web client の delete/cancel helper と proxy path mapping を特定する。mapping が無い場合は raw path と実 upstream path を記録する。
4. Core route registration から handler を確定し、`source_tiles.rs:189-210` の request body（numeric reason、expected revision envelope）と一致するか照合する。
5. `cancel_command` が owner/revision を解決し low-level `cancel` を呼ぶ流れを追う (`source_tile_repo.rs:3217-3253`)。expected revision が omitted のとき current revision を補う挙動も記録する。
6. cancel 前に `v1_source_tile` row を `FOR UPDATE` path と同じ key で取得する。state 0 ACTIVE、revision、owner、actor を記録する。
7. cancel 後に state, revision, state_changed_at, state_changed_by_actor_id を取得し、`v1_source_lifecycle_event` の event id/prev/next/reason を照合する (`source_tile_repo.rs:3108-3136`)。
8. component placements を source id で列挙し、horizon overlap と `auto_managed=true` filter を再現する SQL 条件を記録する (`source_tile_repo.rs:3148-3179`)。
9. closed rows の placement revision bump、life close update、placement event/outbox の各 row を before/after で比較する (`source_tile_repo.rs:3181-3201`)。
10. active execution-bound placement を別ケースで cancel し、`guard_source_close` が returnする場合の state/revision/closed IDs を観測する (`source_tile_repo.rs:3090-3105`)。
11. 同じ command/idempotency key の replay、cancelled state の二回目、古い expected revision、cross-owner request を順に実行する。各々 HTTP/body/DB delta を記録する。
12. 物理 DELETE request が存在する場合のみ、transaction 前後で `v1_tile`, `v1_plan`, `v1_source_tile`, occurrence/frame/placement child rows, stamps/events を count する。cancel path では delete 不在を明記する。

## 検証手順

```bash
# Core cancel contracts
cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_cancel_source_tile -- --test-threads=1

# Runtime request (actual route/verbは Network trace と一致させる)
curl -i -X POST "http://127.0.0.1:31400/v1/source-tiles/$SOURCE_ID/cancel" \
  -H "content-type: application/json" -H "x-owner-id: $OWNER_ID" -H "x-actor-id: $OWNER_ID" \
  --data-binary @cancel-request.json

# Lifecycle and placements
psql "$TASTILE_DATABASE_URL" -c "SELECT source_tile_id,source_state,revision,state_changed_at,state_changed_by_actor_id FROM v1_source_tile WHERE source_tile_id='$SOURCE_ID';"
psql "$TASTILE_DATABASE_URL" -c "SELECT id,prev_state,next_state,actor_id,occurred_at,reason FROM v1_source_lifecycle_event WHERE source_id='$SOURCE_ID' ORDER BY occurred_at,id;"
psql "$TASTILE_DATABASE_URL" -c "SELECT p.id,p.revision,l.close,l.closed_at,p.auto_managed FROM v1_placement p JOIN v1_placement_life l ON l.placement_id=p.id WHERE p.source_tile_id='$SOURCE_ID' ORDER BY p.id;"
```

実 DB reachable と `test result: ok. N passed; 0 failed; 0 ignored` の両方が揃わない限り VERIFIED としない。

## リスク

- **delete semantics confusion**: UI label が Delete でも source state CANCELLED の soft lifecycle の可能性が高い。物理 row deletion を前提にしない。
- **execution protection**: active execution がある placement は close guard で cancel result が no-op になり得る。成功 HTTP だけでは状態変更を主張しない。
- **horizon calculation**: recurring/one-time generation により horizon SQL が異なる (`source_tile_repo.rs:3040-3045,3150-3161`)。全 placement を一括 close と記録しない。
- **audit visibility**: lifecycle event と placement event/outbox は別 table。片方だけ見て audit complete としない。

## 関連

- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\source_tiles.rs:182-210`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\source_tile_repo.rs:3047-3277`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_026__source_state_and_producer.sql:12-47`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_001__base.sql:45-145`
- Sibling traces: `T1b`, `T2b`, `T3a`
