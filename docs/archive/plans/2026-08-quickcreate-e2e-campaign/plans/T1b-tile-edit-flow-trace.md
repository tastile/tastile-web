# T1b — tile edit post-submit runtime trace

## メタデータ

- **ID**: T1b
- **Phase**: runtime observation / canonical trace
- **Target repos**: `tastile-web`, `tastile-core`
- **Depends on**: `T1a`, `T2b`
- **Source of truth**: `tastile-web/src/shared/api/v1/submit.ts`, `tile-commands.ts`; `tastile-core/crates-v1/api/src/handlers/source_tiles.rs`, `storage/src/source_tile_repo.rs`
- **Important finding to verify**: 現行 edit path は SourceTile update の単一 `PATCH` ではなく、Web 側の `submitUpdateTile` が tile identity command と placement ChangeSet command を順番に送る旧/互換 path である可能性がある。

## 前提

- Web `submitUpdateTile` は store の `editingTileId` と `editingId` を読み、まず tile identity を更新し、placement span があれば二段目を送る (`submit.ts:55-110`)。
- `source_tiles.rs::update` は `PUT /v1/source-tiles/{source_tile_id}` 相当の handler として `CommandKind::UpdateSourceTile` を dispatch する (`source_tiles.rs:127-156`)。ここには `PATCH` の実装根拠がないため、HTTP verb は Network で確認する。
- SourceTile update は owner schedule lock、`FOR UPDATE`、optional expected revision、`next = current + 1`、tile identity update、plan definition replacement、source update、relation definitions、reflow/materialization readback の流れである (`source_tile_repo.rs:463-566`)。
- placement span の post-submit change path は `POST /v1/placements/{id}/changes` と記載されている (`submit.ts:57-60`)。actual function/route/body/schema は source と runtime で照合する。
- `v1_tile.revision` と `v1_source_tile.revision` は別列/別 aggregate projection の可能性がある。混同せず両方を before/after 取得する。

## 目的

編集画面で Submit を押した後、どの HTTP request が何回発生し、各 request がどの revision/ChangeSet/placement state を生成するかを観測する。特に、edit が source definition replacement なのか、tile identity + placement override の二段 command なのかを確定する。

## 受入条件

- [ ] edit Submit 1 回に対する全 request の順序、verb、URL、body、status、response を記録する。
- [ ] `expected_revision` の送信値と core が読んだ current revision、返した next revision を記録する。
- [ ] SourceTile update の場合、`v1_tile`, `v1_source_tile`, plan child rows、schedule/flow/window/relation rows の変更 count を記録する。
- [ ] placement span edit の場合、`v1_change_set`, `v1_change`, activation/revoked child、placement revision/life の変化を記録する。
- [ ] stale revision、idempotency replay、部分失敗時に前段だけ commit されるかを実 DB で確認する。期待値は不明なままにせず実測する。
- [ ] edit response の `aggregate.id`, `aggregate_meta.plan_id`, `source_tile_id`, `changeset_id`, `change_ids`, `placement_ids` を request と DB に対応付ける。

## 実装手順

1. T1a で作成した tile/source と初期 revision を fixture として選ぶ。edit 前に `v1_tile`, `v1_source_tile`, `v1_plan`, `v1_placement` と child tables を snapshot する。
2. QuickCreate edit mode を開き、title/color/description の identity だけを変更したケースを作る。別 run で span だけを変更するケースを作る。
3. Browser Network を開始して Submit を押し、request sequence を時系列で保存する。`submitUpdateTile` の first request と optional second request を `submit.ts:81-108` と照合する。
4. first request が `/v1/tiles/{id}`、`/v1/source-tiles/{id}`、その他の場合、proxy rewrite と core route table を追跡する。verb は source に書かれたコメントではなく実 request を正とする。
5. SourceTile update が呼ばれた場合、handler の `command_scope` と dispatch metadata を記録する (`source_tiles.rs:90-105,127-156`)。
6. Core transaction 内で `FOR UPDATE`、owner check、expected revision check の結果を log/DB query で確定する (`source_tile_repo.rs:474-503`)。
7. update 成功時に、tile identity (`source_tile_repo.rs:519-522`)、plan definition (`523-532`)、source row (`533`)、relation definitions (`534-543`)、reflow (`547-550`) の順に before/after を比較する。
8. placement change request が呼ばれた場合、`tile-commands.ts` の `updatePlacementChanges` implementation、API command handler、`change_set_repo::append` を読む/観測する。ChangeSet の target/layer/rank/key/value を exact JSON と DB row で対応付ける。
9. `v1_placement.revision`、`v1_placement_baseline`、`v1_placement_life`、`v1_domain_event`、`v1_outbox_event` を placement id で取得する。effective span は timeline read (`timeline.rs:325-343`) で解決されるため、baseline と effective を分けて記録する。
10. response が成功したら command id/idempotency key と `v1_idempotency` response cache を照合する。同じ request replay では `ALREADY_APPLIED` または actual result を記録する。
11. expected revision を故意に古くして stale case を実行し、HTTP error shape、DB row count/revision、前段 request の有無を記録する。
12. trace table に「request → transaction writes → response → read projection」の一行を各 request ごとに記入する。T2b は ChangeSet row-level impact を詳細化する。

## 検証手順

```bash
# Web submit/edit contracts
bun test src/shared/api/v1/submit.test.ts src/shared/api/v1/tile-commands.test.ts

# Core SourceTile update contracts
cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_source_tile_scheduling -- --test-threads=1

# Before/after snapshots
psql "$TASTILE_DATABASE_URL" -c "SELECT id,revision,title,description,color,icon,updated_at FROM v1_tile WHERE id='$TILE_ID';"
psql "$TASTILE_DATABASE_URL" -c "SELECT source_tile_id,revision,source_state,updated_at FROM v1_source_tile WHERE source_tile_id='$TILE_ID';"
psql "$TASTILE_DATABASE_URL" -c "SELECT id,revision,source_kind FROM v1_placement WHERE source_tile_id='$TILE_ID' ORDER BY id;"
psql "$TASTILE_DATABASE_URL" -c "SELECT id,target_kind,target_id,layer,rank,source,created_at FROM v1_change_set WHERE target_id='$PLACEMENT_ID' ORDER BY created_at,id;"
```

成功宣言には実 HTTP output と DB before/after、および non-skip test output が必要。source を読んだだけの結果は `REVIEWED` とする。

## リスク

- **verb の誤記**: コメントに PATCH と書かれていても実装は POST/PUT の場合がある。Network と route registration の両方を根拠にする。
- **二段 submit の部分成功**: tile identity が成功し placement change が失敗する場合、仕様上の atomicity と現実の client orchestration がずれる。失敗時 DB snapshot を必ず残す。
- **revision source の混同**: tile/source/placement/changeset は各々の revision semantics が異なる。aggregate id と table を一列に混ぜない。
- **reflow の副作用**: update は同じ owner/window の automatic placements を再評価し得る (`source_tile_repo.rs:545-550`)。対象 tile 以外の placement changes も owner/window filtered query で確認する。

## 関連

- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\submit.ts:55-110`
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\tile-commands.ts:26-34`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\source_tiles.rs:90-156`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\source_tile_repo.rs:463-566`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\change_set_repo.rs:24-106,127-380`
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\timeline.rs:325-343`
- Sibling traces: `T1a`, `T2a`, `T2b`
