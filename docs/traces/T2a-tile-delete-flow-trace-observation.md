# T2a — tile delete runtime trace (observation)

## メタデータ

- **ID**: T2a
- **Phase**: runtime observation / canonical trace
- **Sibling traces**: `T1a` (create), `T1b` (edit), `T2b` (TBD)
- **Plan source**: `tastile-web/docs/plans/T2a-tile-delete-trace.md`
- **Author**: agent (1ターン, 静的追跡のみ)
- **Build / runtime**: **TBD** — DBおよび live APIは未観測（Defender-blocked Windows host, CI=ubuntu-latest が green/red の source of truth）
- **Scope**: v1 SourceTile cancel + v1 tile archive の二系統を静的コードから固定
- **結論 (TL;DR)**: Web UI には `Delete/Remove` 系の tile アクションは **現状実装が存在しない**。Core の canonical 経路は `POST /v1/source-tiles/{id}/cancel`（source_state = CANCELLED, soft lifecycle）。Legacy v0 系は `DELETE /v1/tiles/{id}` → `archive_tile`（v1_tile.archived_at 設定, soft）で、双方とも **物理 DELETE は一切行わない**。

---

## 1. 受入条件別の trace

### AC-1: UI action から発生する全 request の verb, URL, body, status, response を記録する

| Status | Trace |
|---|---|
| **TBD** | Browser 実行は未実施。DevTools Network での live capture は本ターン範囲外。 |

**静的根拠**:

- `tastile-web/src/views/dashboard/ApiExplorerPage.tsx:497-506` では `deleteTile` を `commands.deleteTile` メタ経由のエクスプローラ・サンプルとして列挙するだけで、本番 UI ボタンの呼び出しは存在しない。
- `tastile-web/src/features/manage-projects/ui/ProjectsSidePanel.tsx:106` の `deleteWorkspace(id)` は **workspace**（subject）であり tile ではない。
- `tastile-web/src/shared/api/v1/submit.ts` 113行に渡る `submitCreateTile` / `submitUpdateTile` のみで、**`submitDelete*` / `submitCancel*` 関数は定義なし**。
- `tastile-web/src/shared/api/v1/tile-commands.ts` 770行を全読したが、`updateTileCommand` / `updatePlacementChanges` / `startTileCommand` / `startExecutionCommand` / `pauseExecutionCommand` / `resumeExecutionCommand` / `finishExecutionCommand` / `createManualPlacementCommand` までで **delete / cancel は 1 つも存在しない**。
- `tastile-web/src/shared/api/v1/source-tiles.ts` 570行 (`SourceTileCreatePayload` / `SourceTileUpdatePayload` / `SourceTileDetail` など) にも `cancelSourceTile` / `deleteSourceTile` は **存在しない**。
- `tastile-web/src/shared/api/v1/openapi-generated.d.ts:69-91` (`/v1/source-tiles/{id}/cancel`) および `:1552-1607` (`cancel_source_tile` operation) に型は生成されているが、それを呼び出す wire / UI は **現時点でコードベース上に存在しない**。

→ Web UI から本経路を起動する経路は **TBD (現状コードに経路自体なし)**。ライブ Network trace は未取得。

### AC-2: delete action が `DELETE`, `POST .../cancel`, archive command, または別 endpoint のどちらかを実測する

**Static observation (確定)**:

| 系統 | verb | URL | handler | 出典 |
|---|---|---|---|---|
| **Canonical v1 SourceTile** | `POST` | `/v1/source-tiles/{id}/cancel` | `storage::source_tile_repo::cancel_command` → `cancel` | `crates-v1/api/src/main.rs:324-325`, `crates-v1/api/src/handlers/source_tiles.rs:190-212`, `crates-v1/storage/src/dispatcher.rs:342-344` |
| **Legacy v0/v1 tile** | `DELETE` | `/v1/tiles/{id}` | `storage::tile_repo::archive` | `crates-v1/api/src/main.rs:679`, `crates-v1/api/src/handlers/commands.rs:895-922`, `crates-v1/storage/src/dispatcher.rs:291-294` |

- SourceTile cancel の wire shape (確定):
  ```json
  // { method: "POST", path: "/v1/source-tiles/{id}/cancel", query: "?owner_id={uuid}" }
  {
    "expected_revision": 7,            // null許容; null の場合は server 側で current_revision を補填
    "idempotency_key": "<uuid v7>",
    "occurred_at": "2026-08-05T...Z",  // required
    "payload": { "reason": 0 }          // 0=USER, 1=CLEANUP, 2=MIGRATION
  }
  ```
  出典: `crates-v1/api/src/handlers/source_tiles.rs:183-212` (`CancelSourceTileBody { reason: i16 }`), `crates-v1/domain/src/command.rs:244-252` (`CancelSourceTilePayload`), `tastile-web/src/shared/api/v1/openapi-generated.d.ts:236-252` (`CancelSourceTilePayloadSchema`, `CancelSourceTileRequest`), `crates-v1/domain/src/source_tile/state.rs:11-15` (`cancel_reason::USER/CLEANUP/MIGRATION`).

- SourceTile cancel response (確定):
  ```json
  // 200 OK
  {
    "command_id": "<uuid>",
    "result": 0,                       // 0=applied
    "accepted_at": "2026-08-05T...Z",
    "aggregate": { "kind": 1, "id": "<source_tile_id>" },  // AggregateKind::Source
    "revision": 8,                     // current_revision + 1
    "aggregate_meta": {
      "tile_id": "<source_tile_id>",
      "source_tile_id": "<source_tile_id>",
      "placement_ids": ["<uuid>", ...],  // closed_placement_ids
      "plan_id": null,
      "flow_ids": [], "frame_rule_id": null, "occurrence_ids": [],
      "change_ids": [], "changeset_id": null, "recurring_id": null
    },
    "pending": []
  }
  ```
  出典: `crates-v1/storage/src/source_tile_repo.rs:3260-3276` (`response_for_with_meta` with `AggregateKind::Source`, `aggregate_meta.placement_ids = closed_placement_ids`), `tastile-web/src/shared/api/v1/openapi-generated.d.ts:346-361` (`CommandResponse`).

- archive_tile の wire shape (確定):
  ```http
  DELETE /v1/tiles/{id}
  Content-Type: application/json
  Cookie: tastile.api_token=...; tastile.user_sub=...
  x-tastile-web-bridge-secret: <env>
  x-tastile-web-session-user: <user sub>
  {
    "expected_revision": null,         // パスは未送信 (envelope の自動採番なし)
    "idempotency_key": "<uuid>",       // server-side で stamp
    "occurred_at": "...",
    "payload": { "tile_id": "<id>" }
  }
  ```
  出典: `crates-v1/api/src/handlers/commands.rs:895-922` (`archive_tile` handler expects `Json<CommandRequest<ArchiveTilePayload>>`), `crates-v1/domain/src/command.rs:675-677` (`ArchiveTilePayload { tile_id }`), `tastile-web/src/lib/upstream/events.ts:476-491` (`upstreamArchiveTile` — next/server route 内で `fetch(rustBase()/v1/tiles/{id}, { method: 'DELETE', body: JSON.stringify(envelope({ tile_id })) })` を実行).

  注: `upstreamArchiveTile` は Next.js 側の `/api/tiles/[id]/archive` （推定パス）相当 helper であり、ブラウザのボタンはこの server route を叩く想定。実 button バインドは **TBD**。

→ **結論**: フル runtime trace は得ていない。wire shape / URL / handler / dispatch 連鎖は静的コードから固定。**Browser 実行による status, response, request body 実測は TBD**。

### AC-3: source state/revision の before→after と stale/duplicate cancel の error shape

**Static observation (確定)**:

- Before-state guarantee (確定): `cancel` 開始時 `SELECT owner_id, source_state, revision FROM v1_source_tile WHERE source_tile_id=$1 FOR UPDATE` を実行し、`current_state == SOURCE_STATE_ACTIVE (=0)` かつ `current_revision == cmd.expected_revision` を要求する。両方が揃わない場合は `RepoError` で拒否 (`crates-v1/storage/src/source_tile_repo.rs:3062-3088`).
  - `state == CANCELLED (=3)` → `RepoError::Conflict("source tile already cancelled")` (`source_tile_repo.rs:3075-3077`)
  - `state ∈ {PAUSED, ENDED}` → `RepoError::Conflict(format!("source tile not in ACTIVE state (current state = {current_state})"))` (`source_tile_repo.rs:3078-3082`)
  - revision mismatch → `RepoError::StaleRevision { have, expected }` (`source_tile_repo.rs:3083-3088`)
- After-state (確定): `UPDATE v1_source_tile SET source_state=$1, revision=$2, state_changed_at=$3, state_changed_by_actor_id=$4 WHERE source_tile_id=$5` (`source_tile_repo.rs:3110-3124`). new_revision = current_revision + 1.
- expected_revision 補充挙動 (確定): `cancel_command` は `envelope.expected_revision.unwrap_or(current_revision)` で補填する (`source_tile_repo.rs:3242-3250`). すなわち「client が omit した場合、server 側 current_revision をパスするので **常に成功**」（stale 判定を実質的に bypass する形になる。Test `at_cancel_endpoint_idempotency_key_reused` が依存する）。
- HTTP status mapping (確定): `crates-v1/api/src/handlers/common.rs:228-247`:
  - `RepoError::Conflict(_) → 409`
  - `RepoError::StaleRevision { have, expected } → 409`
  - `RepoError::NotFound(_) → 404` (cross-owner は `RepoError::NotFound` で 404, `source_tile_repo.rs:3235-3240`)
  - `RepoError::Validation(_) → 400`
- OpenAPI spec 上の status (`tastile-web/src/shared/api/v1/openapi-generated.d.ts:1568-1606`):
  - `200` command response
  - `400` validation error (invalid reason)
  - `401` missing/invalid auth
  - `404` not found
  - `409` stale revision / already cancelled

→ **error shape までは static 確定**。**HTTP 400/401/404/409 の各 scenario における実 response body 観測は TBD**（CI 上で `at_cancel_endpoint_*` 8 ケースの coverage は `crates-v1/api/tests/at_cancel_endpoint.rs:8-15` で宣言されている）。

### AC-4: 影響を受けた placements の対象条件, revision, life close, closed_at, domain/outbox event

**Static observation (確定)**:

- 候補取得 (確定): `cancel` 関数は owner schedule lock 取得後、`SELECT p.id FROM v1_placement p JOIN v1_placement_life l ON l.placement_id = p.id WHERE p.source_tile_id=$1 AND l.close=false ORDER BY p.id` で **候補 placements** を列挙 (`source_tile_repo.rs:3090-3097`).
- execution protection (確定): `relation_lifecycle_repo::guard_source_close(tx, owner_id, &component_placements, now)` が **true** を返した（=protected component）場合、`source_tile_repo::cancel` は lifecycle/placement を **一切変更せず即 return Ok(new_revision: current_revision, closed_placement_ids: Vec::new(), lifecycle_event_id: None)** する (`source_tile_repo.rs:3098-3106`, `crates-v1/storage/src/relation_lifecycle_repo.rs:786-893`).
  - guard の本体: `WITH RECURSIVE connected_source` で relation_dependency_edge を辿り、`component_is_protected` で判定 → 真なら `v1_relation_component_state (CURSOR_DECISION_REQUIRED)` と `v1_relation_decision_required` に pending を inserted し `true` 返却 (`relation_lifecycle_repo.rs:792-857`).
  - **実務的帰結**: cancel HTTP 200 でも `closed_placement_ids: []` + lifecycle event 未挿入 → **クライアントから「成功」が見えても**実 DB 上は state 変化なし。プロトコル上は `aggregate_meta.placement_ids == []` で観測可能。
- placeholder affected placement の選定 (確定): component guard 通過時のみ、
  ```sql
  WITH src AS (
    SELECT s.owner_id,
           CASE s.generation_kind
             WHEN 0 THEN s.generation_at + s.window_start_offset_ms * interval '1 millisecond'
             ELSE s.generation_starts_at + s.window_start_offset_ms * interval '1 millisecond'
           END AS horizon_start,
           CASE s.generation_kind
             WHEN 0 THEN s.generation_at + s.window_end_offset_ms * interval '1 millisecond'
             WHEN 1 THEN COALESCE(s.generation_ends_at, now() + interval '100 years')
                       + s.window_end_offset_ms * interval '1 millisecond'
           END AS horizon_end
    FROM v1_source_tile s WHERE s.source_tile_id = $1
  )
  UPDATE v1_placement p
  SET revision = p.revision + 1
  FROM v1_placement_life l, v1_placement_baseline b, src
  WHERE p.id = l.placement_id AND p.id = b.placement_id
    AND p.source_tile_id = $1
    AND p.owner_id = src.owner_id
    AND p.auto_managed = true
    AND l.close = false
    AND tstzrange(b.span_start, b.span_end, '[]') && tstzrange(src.horizon_start, src.horizon_end, '[]')
  RETURNING p.id, p.revision
  ```
  即ち **selection filter**: `source_tile_id = $1 AND owner_id = source.owner AND auto_managed = TRUE AND l.close = FALSE AND span overlaps horizon`。 出典: `source_tile_repo.rs:3148-3180`.
- life close (確定): 続けて `UPDATE v1_placement_life SET close=true, closed_at=$1 WHERE placement_id = ANY($2) AND close = false` を 別 SQL で発行 (`source_tile_repo.rs:3186-3194`). 1 トランザクション内。
- lifecycle event (確定): `v1_source_lifecycle_event` に 1 行挿入:
  ```sql
  INSERT INTO v1_source_lifecycle_event (id, source_id, prev_state, next_state, actor_id, occurred_at, reason)
  VALUES (<uuid v7>, $source_id, 0, 3, $actor, $now, $reason)
  ```
  出典: `source_tile_repo.rs:3127-3136`. Schema: `crates-v1/storage/migrations/V1_026__source_state_and_producer.sql:25-35`.
- placement event (確定): 影響 placement 1 つにつき `append_placement_event(tx, owner_id, placement_id, next_revision, 2 /*PlacementEventKind*/, now)` を call (`source_tile_repo.rs:3199-3201`, `append_placement_event` impl は `source_tile_repo.rs:2499`).
- domain/outbox event (確定): `dispatcher.rs:347-368` で `if aggregate.is_some()` ブランチが generic に実行される:
  - `outbox_repo::append_domain_event(tx, owner_id, internal_kind, agg, rev, Json::Null, now)`
  - `outbox_repo::append(tx, owner_id, internal_kind, agg, Json::Null, now)`
  - `internal_kind` は `internal_event_kind(&envelope.payload)` で `CancelSourceTile` を なんらかの numeric tag にマップ（具体的な値は要追跡）。
- response に乗る `placement_ids` (確定): `closed_placement_ids` = `Vec<PlacementId>` (guard 早期 return 時は空) を `aggregate_meta.placement_ids` に乗せる (`source_tile_repo.rs:3260-3275`).

→ **対象条件 / revision bump / life close / closed_at / lifecycle event / placement event / outbox event すべて static 確定**。**それぞれの row 個数と id の DB 観測は TBD**。

### AC-5: active execution がある placement/source を使い, delete action が execution / segment を変更するか

**Static observation (確定)**:

- `cancel` 内で `v1_execution` テーブルへの read/write は **一切発生しない** (`source_tile_repo.rs:3047-3212` 全文に `execution` 言及なし). つまり cancel は **execution row に触れない**。
- 代わりに `relation_lifecycle_repo::guard_source_close` が **active execution-bound placement を含む component** を検出した場合、cancel を **完全 no-op** 化: HTTP 200 応答のみ、`closed_placement_ids=[]`、`lifecycle_event_id=None` (`source_tile_repo.rs:3098-3106`, `crates-v1/storage/src/relation_lifecycle_repo.rs:786-893`).
  - `component_is_protected` の判定基準 (静的コードから要追跡。related placements に `connected_source` (relation_dependency_edge を辿る) で展開された component が active execution を持つか) — 実装の細部は `relation_lifecycle_repo.rs:817-819` 参照、core テスト要 tracking.
- placement event / outbox event も上記 no-op ケースでは **生成されない** (`if aggregate.is_some()` branch は aggregate が生成される = 必ず lifecycle 1 行挿入、とは限らない; ここに詳細 tracking 必要). 詳細は `dispatcher.rs:347-368` の early-return 経路を dispatcher 側で持っているかは要確認: **cancel は dispatcher 経由で `cancel_command` を呼ぶので、execute guard の後に `aggregate` を返す**。 すなわち **HTTP 200 だが audit log を見ないと「本当に閉じたか」が分からない**。→ plan のリスク "execution protection" 通り。
- **active execution を持つ source の cancel における実際の executions / segments の変化は TBD**。

### AC-6: 物理 cascade がある場合, 削除された child table rows と残った audit rows を FK / table 単位で記録する

**Static observation (確定)**:

- **cancel 経路は物理 DELETE を一切伴わない**。Update / Insert のみ (`source_tile_repo.rs:3047-3212`).
- **archive_tile 経路も物理 DELETE を伴わない**。`UPDATE v1_tile SET archived_at=$1` + `UPDATE v1_placement_life SET close=true` の 2 つの UPDATE のみ (`tile_repo.rs:337-370`).
- FK 構造上、もし `DELETE FROM v1_source_tile WHERE source_tile_id=$1` が **手動で** 実行された場合の影響 (静的観察):

  | FK 参照元 | ON DELETE | 出現 | ソース |
  |---|---|---|---|
  | `v1_source_tile.source_tile_id → v1_tile(id)` | `CASCADE` | `v1_tile` の row ごと delete | `V1_020:5` |
  | `v1_source_occurrence.source_tile_id → v1_source_tile(source_tile_id)` | `CASCADE` | occurrences 自動削除 | `V1_020:50` |
  | `v1_placement.source_tile_id → v1_source_tile(source_tile_id)` | **なし** (default `NO ACTION`) | manual DELETE は **失敗** | `V1_020:69-70` |
  | `v1_placement_source_ref_source.source_tile_id → v1_source_tile(source_tile_id)` | **なし** | 同上 | `V1_020:99` |
  | `v1_change_set_source_ref_source.source_tile_id → v1_source_tile(source_tile_id)` | **なし** | 同上 | `V1_020:110` |
  | `v1_source_lifecycle_event.source_id → v1_source_tile(source_tile_id)` | **なし** | 同上 | `V1_026:27` |
  | `v1_placement_source_ref_producer.placement_id → v1_placement(id)` | `CASCADE` | (related: placement を消すと消える) | `V1_026:38` |

  → **結論**: `v1_source_tile` を物理 DELETE しようとしても placements / lifecycle event / change_set ref から FK 制約で **拒否される**。cancel が `source_state = 3 (CANCELLED)` で soft 終端する design は FK 制約と整合している。

- **archive_tile の FK 影響**: `v1_tile` 自体は archived_at 設定のみ。child として `v1_plan`, `v1_source_tile(source_tile_id → v1_tile CASCADE)`, `v1_recurring` 等は **手動 delete を起こさなければ無傷**。ソースコードの archive は `v1_placement_life` close のみ (`tile_repo.rs:354-362`).
- **audit row 残存**: `v1_source_lifecycle_event` (cancel で挿入), `v1_outbox` (dispatcher), `v1_idempotency` (dispatcher.rs:370-377) は **物理 delete されない**。これは gor cancel 経由でも manual delete 経由でも同じ。

→ **物理 DELETE 発生シナリオ自体は TBD (発生しない)**。**cancel 後の audit row リテンション挙動は static 確定**。

---

## 2. フロー全体図 (静的追跡)

### 2.1 Web (Client) → Core (SourceTile cancel)

```text
[Browser]
  ↓ (現在はトリガー UI なし → TBD)
[Web wire 層] (source-tiles.ts / tile-commands.ts に cancelSourceTile 未定義 → TBD)
  ↓
fetch("/api/proxy/v1/source-tiles/{id}/cancel", { method: "POST", body: envelope({reason}) })
  ↓
[Next.js route: src/app/api/proxy/[...path]/route.ts:183-189]
  - toV1Path("v1/source-tiles/{id}/cancel") → "v1/source-tiles/{id}/cancel" (prefix strip のみ)
  - method/body 透過、Content-Type 維持
  - 通常時: Authorization Bearer + bridge headers (x-tastile-web-bridge-secret, x-tastile-web-session-user) 付与
  - E2E bypass 時: x-owner-id / x-actor-id = 0000...0001
  ↓
[Core API: crates-v1/api/src/main.rs:324-325]
  POST /v1/source-tiles/{id}/cancel → handlers::source_tiles::cancel
  ↓
[crates-v1/api/src/handlers/source_tiles.rs:190-212]
  - command_scope: HeaderMap から owner / actor を resolveCommandOwner + read_owner で導出
  - dispatch(state, CommandKind::CancelSourceTile, CommandPayload::CancelSourceTile(...), expected_revision, idempotency_key, owner_kind, owner, actor)
  ↓
[crates-v1/storage/src/dispatcher.rs:342-344]
  CommandPayload::CancelSourceTile(p) → source_tile_repo::cancel_command(tx, envelope, p, now)
  ↓
[crates-v1/storage/src/source_tile_repo.rs:3217-3277]
  1. owner_id / current_revision を SELECT
  2. owner_id != envelope.actor.owner_id → RepoError::NotFound (cross-owner 404)
  3. CancelCommand { source_id, expected_revision: env.expected_revision.unwrap_or(current_revision), reason, actor, idempotency_key } 構築
  4. cmd.validate() → validation
  5. cancel(tx, &cmd, now)
     5.1 acquire_owner_schedule_lock
     5.2 SELECT FOR UPDATE (state, revision)
     5.3 state != ACTIVE → Conflict; already CANCELLED → Conflict; revision mismatch → StaleRevision
     5.4 component_placements = SELECT p.id WHERE p.source_tile_id=$1 AND l.close=false
     5.5 guard_source_close → true なら no-op CancelResult { new_revision: current, closed_placement_ids: [], lifecycle_event_id: None } 返却
     5.6 UPDATE v1_source_tile SET source_state=3, revision+=1, state_changed_at=$now, state_changed_by_actor_id=$actor
     5.7 v1_source_lifecycle_event INSERT (id: uuid v7, prev_state=0, next_state=3, actor, occurred_at, reason)
     5.8 WITH src (...) UPDATE v1_placement p SET revision+=1 WHERE ... auto_managed=true AND overlap horizon
     5.9 UPDATE v1_placement_life SET close=true, closed_at=$now WHERE placement_id = ANY(closed_ids)
     5.10 each closed placement: append_placement_event(tx, owner_id, placement_id, revision, kind=2, now)
  6. response_for_with_meta(command_id, now, Some(aggregate(Source, source_tile_id)), revision, [], Some(AggregateMeta { tile_id, source_tile_id, placement_ids: closed_placement_ids, ..Default::default() }))
  ↓
[dispatcher.rs:347-368]
  - outbox_repo::append_domain_event (owner_id, internal_kind, aggregate, revision, Null, now)
  - outbox_repo::append (owner_id, internal_kind, aggregate, Null, now)
  - idempotency_repo::put_tx (command_id, idempotency_key, request_hash, &response)
  - tx.commit()
  ↓
[web] CommandResponse decode → ApiError/CommandResponse 判定
  - 200: ok { aggregate.id, revision, aggregate_meta.source_tile_id, aggregate_meta.placement_ids }
  - 409: stale revision / already cancelled
  - 404: not found / cross-owner
  - 400: invalid reason
```

### 2.2 Web (Client) → Core (legacy v0/v1 tile archive)

```text
[Browser]
  ↓ (button バインド TBD; ApiExplorerPage.tsx:500 ではサンプル JSON のみ)
[Next.js route: src/lib/upstream/events.ts:484-]
  upstreamArchiveTile(tileId)
  ↓
fetch(rustBase() + "/v1/tiles/{id}", { method: "DELETE", headers: bridgeHeaders, body: envelope({ tile_id }) })
  - rustBase は env (CLOUD_API_BASE / E2E bypass)
  - 直接 upstream を叩く (proxy は bypass)
  ↓
[Core API: crates-v1/api/src/main.rs:679]
  DELETE /v1/tiles/{id} → handlers::commands::archive_tile
  ↓
[crates-v1/api/src/handlers/commands.rs:895-922]
  - payload.tile_id != path_id → 400 BAD_REQUEST
  - read_owner → (owner_kind, owner, actor)
  - dispatch(state, CommandKind::ArchiveTile, CommandPayload::ArchiveTile(payload), expected_revision, idempotency_key, 0, owner, actor)
  ↓
[crates-v1/storage/src/dispatcher.rs:291-294]
  CommandPayload::ArchiveTile(p) → tile_repo::archive(tx, envelope, TileId, now)
  ↓
[crates-v1/storage/src/tile_repo.rs:337-370]
  1. UPDATE v1_tile SET archived_at=$now, updated_at=$now, revision+=1 WHERE id=$2 AND owner_id=$3 AND archived_at IS NULL
     - ヒットなし → RepoError::NotFound
  2. UPDATE v1_placement_life SET close=true, closed_at=$now WHERE placement_id IN (SELECT id FROM v1_placement WHERE tile_id=$2) AND NOT close
  3. response_for(...)
  ↓
[dispatcher.rs:347-368] generic outbox + idempotency
```

**注**: `archive_tile` response の `aggregate` は `AggregateKind::Recurring` (歴史的経緯, `tile_repo.rs:366`) を返す。 SourceTile 経路で `AggregateKind::Source` を返す点と異なる。

---

## 3. 検証手順 (plan に書かれた手順との対応)

plan の `## 検証手順` に従う。**本ターンで実行可能なのは静的 fuzzy match のみ**。

| 計画手順 | 静的追跡結果 | runtime 実行 |
|---|---|---|
| `cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_cancel_source_tile` | ❌ テスト名は `at_cancel_endpoint` (`crates-v1/api/tests/at_cancel_endpoint.rs:1-15`). `--test` 引数は `at_cancel_endpoint` か。Plan 側は typo でありファイル実態は `api/tests/` 配下。 | **TBD** (Defender-blocked). CI green/red が truth. |
| `curl -i -X POST http://127.0.0.1:31400/v1/source-tiles/$SOURCE_ID/cancel` | 動作する経路としては `dispatcher → cancel_command` に到達。 STATIC 確認: header の `content-type: application/json` 必須, body は `{expected_revision, idempotency_key, occurred_at, payload:{reason}}` (reason が numeric 0/1/2 必須。test 7: `invalid_reason`). | **TBD** |
| `cp $TASTILE_DATABASE_URL -c "SELECT source_tile_id, source_state, revision, state_changed_at, state_changed_by_actor_id FROM v1_source_tile" ` | 結果が WHAT を意味するか: cancel 成功時 `source_state=3 (CANCELLED)`, `revision` は +1, `state_changed_at=$now`, `state_changed_by_actor_id=$actor`. 出典: `source_tile_repo.rs:3110-3124`. | **TBD** |
| `-c "SELECT id, prev_state, next_state, actor_id, occurred_at, reason FROM v1_source_lifecycle_event"` | 期待値: 1 行挿入 (id=uuid v7, prev_state=0, next_state=3, actor, occurred_at=$now, reason=0/1/2). 出典: `source_tile_repo.rs:3127-3136`, `V1_026:25-35`. | **TBD** |
| `-c "SELECT p.id, p.revision, l.close, l.closed_at, p.auto_managed FROM v1_placement p JOIN v1_placement_life l ON l.placement_id=p.id WHERE p.source_tile_id=$SOURCE_ID"` | 期待値: 候補 `p.auto_managed=true AND l.close was false AND span overlap horizon` の row すべてで `l.close=true, l.closed_at=$now` および `p.revision += 1`. guard 早期 return 時 (active execution あり等) は何も変わらない。 | **TBD** |

---

## 4. リスク (plan §リスク との cross-check)

| リスク | 評価 | 根拠 |
|---|---|---|
| **delete semantics confusion** | ✅ 確認 | Web UI には Delete/Remove ボタンは現状不在 (`grep` で 0 hit). Core の canonical 経路は **soft cancel** (state=CANCELLED) であり、物理 DELETE endpoint は `DELETE /v1/tiles/{id}` の archive_tile のみ。 |
| **execution protection** | ✅ 確認 | `relation_lifecycle_repo::guard_source_close` が true 返却時、cancel は no-op (HTTP 200, `closed_placement_ids=[]`, lifecycle_event_id=None). 成功 HTTP だけでは状態変化を主張しない。 |
| **horizon calculation** | ✅ 確認 | `src` CTE で `generation_kind = 0 (ONE_TIME)` と `= 1 (RECURRING)` の 2 分岐。上限は `COALESCE(generation_ends_at, now() + interval '100 years')`. recurring で horizon 無しの場合は 100 年上限。 |
| **audit visibility** | ✅ 確認 | `v1_source_lifecycle_event` + `v1_placement_event` + `v1_outbox` (domain 2 件) + `v1_idempotency` の 4 系統あり、片方だけ見て complete としない。 |

---

## 5. 未観測値 (TBD) まとめ

- **TBD-1**: ブラウザ実行による `POST /v1/source-tiles/{id}/cancel` の Network trace (verb, URL, body, status, response). 1 ターン制約により省略.
- **TBD-2**: ブラウザ実行による `DELETE /v1/tiles/{id}` (archive_tile) の Network trace. 同上.
- **TBD-3**: Web UI 上の Delete/Remove ボタンの現状有無. 静的 grep では **未検出** (workspace delete のみ存在). UX 上の実装有無は design レビューが必要.
- **TBD-4**: active execution 付き source を cancel した際の `relation_lifecycle_repo::guard_source_close` の true/false シナリオ実観測.
- **TBD-5**: `cargo test -p api --test at_cancel_endpoint` の 8 ケース (happy / unauthorized / not_found / cross_owner / stale_revision / idempotency_reused / invalid_reason / openapi_schema) の実際の status と body. CI 待ち.
- **TBD-6**: `internal_event_kind` が `CancelSourceTile` に対して outbox に書く数値タグ. dispatcher.rs 内に 関数定義あり、具体的マッピングは未追跡.
- **TBD-7**: `relation_lifecycle_repo::component_is_protected` の判定基準 (active execution か、あるいは closed segment 含むか). 親プランの `component` 定義に依存.

---

## 6. 関連ファイル (絶対パス)

- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\openapi-generated.d.ts` (cancel operation 定義: lines 69-91, 236-252, 1552-1607)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\submit.ts` (cancel helper 不在)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\tile-commands.ts` (cancel helper 不在)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\source-tiles.ts` (cancel helper 不在)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts` (proxy: 183-189 で POST 透過, 207-213 で DELETE 透過, toV1Path 108-159)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\lib\upstream\events.ts` (476-491: upstreamArchiveTile — DELETE /v1/tiles/{id})
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\main.rs` (324-325: cancel route, 679: archive route)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\source_tiles.rs` (183-212: cancel handler)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\commands.rs` (895-922: archive_tile handler)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\common.rs` (228-247: HTTP error mapping)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\tests\at_cancel_endpoint.rs` (8 acceptance test cases)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\domain\src\command.rs` (117: CancelSourceTile = 34; 244-252: CancelSourceTilePayload; 675-677: ArchiveTilePayload)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\domain\src\source_tile\state.rs` (1-15: source_state / cancel_reason)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\dispatcher.rs` (291-294: archive disp, 342-344: cancel disp, 347-368: outbox & idempotency)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\source_tile_repo.rs` (3030-3212: cancel 実装, 3217-3277: cancel_command adapter)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\tile_repo.rs` (337-370: archive 実装)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\relation_lifecycle_repo.rs` (786-893: guard_source_close)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_020__source_tile_occurrence.sql` (FK 定義: 5, 50, 69-70, 99, 110)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_026__source_state_and_producer.sql` (lifecycle_event 25-35, FK 27, 38)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_001__base.sql` (CASCADE 群, 30-540)

---

## 7. 静的追跡の sanity self-check

- [x] 1. cancel の wire shape が OpenAPI 生成型 (`openapi-generated.d.ts:236-252`) と handler (`source_tiles.rs:183-212`) で一致
- [x] 2. response の `aggregate.kind = AggregateKind::Source (=1)` (assumption — `domain` crate 内 `AggregateKind` enum 値要確認. **TBD-6** に統合)
- [x] 3. guard_source_close の true 返却挙動が source_tile_repo.rs:3098-3106 と一致
- [x] 4. horizon SQL において `auto_managed=true` が必須 = 親プラン §実装手順 8 一致
- [x] 5. archive_tile が `v1_tile.archived_at` soft set + `v1_placement_life.close` = 親プランの "物理 DELETE 不在" 主張と一致
- [x] 6. FK 解析: `v1_placement.source_tile_id` の `ON DELETE` は **なし** → manual delete 失敗 → soft cancel が design と一致

---

## 8. 結論

T2a の受入条件 6 項目すべてについて **静的根拠は確立**。 runtime / DB 実観測は本ターンでは未取得 (Defender-blocked 本ホスト + 1 ターン制約)。次に CI で `at_cancel_endpoint` 8 ケースを green にしてから Browser 実行で Network trace を取得し、本ファイルの TBD-1〜TBD-7 を潰すのが最短ルート。

**コミットは禁止されたため未実施**。
