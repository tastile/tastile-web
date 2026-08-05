# T1b — tile edit post-submit runtime trace (observation)

## メタデータ

- **ID**: T1b
- **Phase**: runtime observation / canonical trace
- **Plan source**: `docs/plans/T1b-tile-edit-flow-trace.md`
- **Method**: 静的追跡のみ。Browser Network / live API / PostgreSQL は未観測。
- **Result**: **REVIEWED**（runtime 値は `TBD`）
- **結論**: 現行 QuickCreate edit は canonical `PUT /v1/source-tiles/{id}` ではない。必ず `POST /v1/tiles/{tileId}/update` を送り、placement id と span があれば続けて `POST /v1/placements/{placementId}/changes` を送る、client orchestrated 二段経路である。

---

## 1. 受入条件別 trace

### AC-1: Submit 1 回の request 順序・verb・URL・body・status・response

**静的 trace あり / runtime 値 TBD**。

`QuickCreate.tsx:326-352` は edit mode で `submitUpdateTile` を選択する。`submit.ts:65-111` の順序は直列で、request 1 が失敗すると request 2 は送られない。

| 順序 | 条件 | verb / URL | wire body | status / response |
|---|---|---|---|---|
| 1 | `editingTileId` が存在 | `POST /v1/tiles/{tileId}/update`（通常 browser URL は `/api/proxy/v1/tiles/{tileId}/update`） | `{expected_revision:null,idempotency_key:<new UUIDv7>,occurred_at:<client ISO>,payload:{tile_id,title,description,color,icon,external_id,owner_subject_id}}` | 実値 `TBD`。成功型は `CommandResponse`。 |
| 2 | request 1 成功、かつ `editingId`, span start/end が全て存在 | `POST /v1/placements/{placementId}/changes` | `{expected_revision:null,idempotency_key:<別 UUIDv7>,occurred_at:<別 client ISO>,payload:{placement_id,baseline:{span:{start,end},inside:null}}}` | 実値 `TBD`。成功型は `CommandResponse`。 |

根拠: `submit.ts:67-108`, `tile-commands.ts:430-476`, `endpoints.ts:78-85,230-273`。日付のみの span は `tile-commands.ts:629-634` で `T00:00:00Z` に正規化される。

**重要**: `quick-create-schedule-wire.ts:213-456` / `buildQuickCreateSchedulePayload` は create 専用で、edit 経路から呼ばれない。したがって edit は plan/completion/windows/flows/relations/source schedule を送らない (`submit.ts:62-63`)。

### AC-2: expected_revision / current / next revision

**静的 trace あり /実値 TBD**。

- 両 request とも `envelope()` が `expectedRevision: null` を固定する (`tile-commands.ts:104-110`)。したがって Web edit は stale protection を使用しない。
- request 1: `update_tile` は null を dispatcher に渡す (`commands.rs:866-892`)。`tile_repo::update_fields` は expected revision を比較せず、`v1_tile.revision = revision + 1`。返す `revision` は SQL `RETURNING revision` (`tile_repo.rs:294-334`)。
- request 2: `append_changes` も null を渡す (`commands.rs:231-260`)。`change_set_repo::append` は expected revision を比較せず、最後に `v1_placement.revision += 1` して返す (`change_set_repo.rs:616-653`)。
- `v1_source_tile.revision` は現行 Web edit path では変更されない。

| aggregate | sent expected | current | next |
|---|---:|---:|---:|
| `v1_tile` | `null` | `TBD` | static: current + 1 / runtime: `TBD` |
| `v1_placement`（request 2 時） | `null` | `TBD` | static: current + 1 / runtime: `TBD` |
| `v1_source_tile` | request なし | `TBD` | static: unchanged / runtime: `TBD` |

### AC-3: SourceTile update 時の変更 count

**canonical alternative の静的 trace あり / 現行 Web path では非該当 / runtime count TBD**。

Core route は `PUT /v1/source-tiles/{id}` (`main.rs:315-317`) → `source_tiles::update` → `CommandKind::UpdateSourceTile` (`source_tiles.rs:128-156`) → dispatcher (`dispatcher.rs:336-338`) → `source_tile_repo::update` (`source_tile_repo.rs:463-566`)。

この canonical 経路なら owner schedule lock、`v1_source_tile FOR UPDATE`、optional expected revision check、`next=current+1` の後に以下を同一 dispatcher transaction で行う。

1. `v1_tile` identity update（revision を source next に設定）
2. `persist_plan_definition`（plan child / flows の replacement）
3. `update_source`（source schedule/revision）
4. relation definitions insert
5. source reflow + owner/window refill
6. occurrence / placement ids readback

しかし `submitUpdateTile` はこの route を一度も呼ばない。従って現行 edit Submit の変更 count は静的には `v1_tile: 1 row`, `v1_source_tile: 0`, plan/schedule/flow/window/relation: `0`。実 DB count は全て `TBD`。

### AC-4: placement span edit の ChangeSet / placement 変化

**静的 trace あり / row count と id は TBD**。

`POST /v1/placements/{id}/changes` は handler で path/payload id を照合し、`CommandKind::AppendChanges` を dispatch (`commands.rs:229-260`)。dispatcher は `append_with_companions` (`dispatcher.rs:69-71`) を呼ぶ。

ただし wire body は domain の `AppendChangesPayload { placement_id, changeset, companions, source_flow_id }` (`domain/src/command.rs:281-287`) ではなく `baseline` shorthand を送る。handler に変換層は見当たらないため、現行 core schema に対しては **422 deserialize failure の可能性**がある。runtime status は `TBD`。

仮に受理可能な compatibility deserializer が稼働環境に存在する場合、storage の確定処理は:

- `v1_change_set`: 1 row、server assigned UUIDv7
- `v1_change`: `changes.length` rows（span override なら通常 1 を期待するが実 body 変換が未確認のため `TBD`）
- `v1_change_set_activation`: 常に 1 row
- `v1_change_set_revoked`: `revoked != null` の時だけ 1 row。通常 span edit は `TBD`
- source-ref child: supplied source ref に応じ 0..N rows
- `v1_placement.revision`: +1、`updated_at` 更新
- `v1_placement_life`: 正 span では変更なし。zero/negative span 時のみ protection check 後 close (`change_set_repo.rs:415-451`)
- baseline row:直接更新しない。EffectivePlacement が ChangeSet を解決する。

### AC-5: stale / idempotency replay / 部分失敗

**静的 trace あり / 実 DB 観測 TBD**。

- stale: Web は expected revision を常に null とするため、通常 UI から stale case を生成できない。request 1 の `update_fields` は expected revision check 自体を行わない。request 2 の append も check しない。実 stale response / DB count は `TBD`。
- replay: request ごとに別の UUIDv7 を生成する。dispatcher は idempotency key advisory lock → cache lookupを行い、同一 hash なら cached response、異なる hash なら `IDEMPOTENCY_KEY_REUSED` (`dispatcher.rs:44-56`)。同一 key replay の `result` 実値は `TBD`（cached response をそのまま返す実装）。
- transaction atomicity: 各 command 内では repo writes + domain/outbox + idempotency が一 transaction で commit (`dispatcher.rs:346-379`)。
- **Submit 全体は非 atomic**: request 1 commit 後に request 2 を送る。request 2 が 4xx/5xx/通信失敗なら tile identity だけが残る。補償/rollback request はない (`submit.ts:94-108`)。実 DB before/after は `TBD`。

### AC-6: response ID の request / DB 対応

**静的対応あり / concrete IDs TBD**。

| request | `aggregate.id` | aggregate meta | DB 対応 |
|---|---|---|---|
| tile identity | `tileId`（historical `AggregateKind::Recurring`） | `None` | `v1_tile.id` |
| placement changes | `placementId` (`AggregateKind::Placement`) | `changeset_id`, `change_ids` | `v1_placement.id`, `v1_change_set.id`, `v1_change.id[]` |
| canonical SourceTile update（現行 Web 非使用） | `sourceTileId` (`AggregateKind::Source`) | `tile_id`, `plan_id`, `source_tile_id`, `occurrence_ids`, `placement_ids` | 各同名 row |

現行 `submitUpdateTile` はどちらの `CommandResponse` も caller に返さず、最終的に `{ok:true,tileId}` のみに縮約する (`submit.ts:111`)。従って UI から `changeset_id` / `change_ids` / `placement_ids` を参照できない。具体 ID は `TBD`。

---

## 2. End-to-end 静的フロー

```text
QuickCreate Submit
  → mode === "edit" ? submitUpdateTile
  → store.editingTileId / editingId を取得
  → POST /api/proxy/v1/tiles/{tileId}/update
    → Core POST /v1/tiles/{id}/update
    → handlers::commands::update_tile
    → CommandKind::UpdateTile
    → dispatcher → tile_repo::update_fields
    → v1_tile update, revision +1
    → domain event + outbox + idempotency → commit
  → first success AND placementId/span present
    → POST /api/proxy/v1/placements/{placementId}/changes
    → Core append_changes
    → CommandKind::AppendChanges
    → dispatcher → change_set_repo::append_with_companions
    → ChangeSet child rows + placement revision +1
    → domain event + outbox + idempotency → commit
  → {ok:true,tileId}; UI reset / notifyEventsChanged / close
```

失敗分岐:

- tile id 不在: HTTP 0 件、local validation error。
- request 1 failure: request 2 は 0 件。
- request 2 failure: request 1 は既に commit 済み。UI は error のまま。
- placement id または span 不在: request 1 のみで成功。

---

## 3. static row-impact matrix

| table / artifact | request 1 | request 2（受理時） |
|---|---:|---:|
| `v1_tile` | UPDATE 1 | 0 |
| `v1_source_tile` | 0 | 0 |
| plan/window/flow/relation definitions | 0 | 0 |
| `v1_change_set` | 0 | INSERT 1 |
| `v1_change` | 0 | INSERT N (`TBD`) |
| `v1_change_set_activation` | 0 | INSERT 1 |
| `v1_change_set_revoked` | 0 | 0/1 (`TBD`) |
| `v1_placement` | 0 | UPDATE 1 (revision +1) |
| `v1_placement_baseline` | 0 | 0 |
| `v1_placement_life` | 0 | positive span: 0 |
| domain event / outbox | each 1 aggregate に対し insert | 同左 |
| idempotency cache | INSERT 1 | INSERT 1 |

全 row count / concrete revisions / IDs は live DB 未観測につき `TBD`。

---

## 4. runtime で埋める TBD

1. Network の request 1/2 exact URL, headers, body, status, response。
2. before/current/next の `v1_tile`, `v1_source_tile`, `v1_placement` revisions。
3. request 2 が `baseline` shorthand を受理するか、422 になるか。
4. ChangeSet / change / activation / revoked / source-ref の actual rows と IDs。
5. stale expected revision を手動送信した response と DB non-change。
6. 同一 idempotency key replay の result/status/body。
7. request 2 を意図的に失敗させ、request 1 のみ commit 済みとなる DB snapshot。
8. canonical `PUT /v1/source-tiles/{id}` を別 run で実行した各 child table count。

---

## 5. 結論

Acceptance Criteria 6 項目すべてに静的 trace を付与した。最大の発見は、現行 edit UI が canonical SourceTile replacement を使わず、revision guard なしの tile update と optional placement changes を別 transaction で直列送信する点である。このため Submit 単位の部分成功が可能であり、さらに placement request の `baseline` shorthand と core の `changeset` schema の不一致が疑われる。runtime / DB 実値は捏造せず `TBD` とした。

**git commit / push は実施していない。**
