# T1a — QuickCreate tile 作成 runtime trace (observation)

## メタデータ

- **ID**: T1a
- **Phase**: runtime observation / canonical trace
- **Sibling traces**: `T1b` (edit), `T2a` (delete), `T2b` (TBD)
- **Plan source**: `tastile-web/docs/plans/T1a-tile-create-flow-trace.md`
- **Author**: agent (1ターン, 静的追跡のみ)
- **Build / runtime**: **TBD** — DBおよび live API は未観測（Defender-blocked Windows host, CI=ubuntu-latest が green/red の source of truth）
- **Scope**: QuickCreate の Create click → `/v1/schedule-definitions` POST → Core handler/dispatcher → DB transaction → response までを静的コードから固定
- **結論 (TL;DR)**: QuickCreate の canonical write surface は **`POST /v1/schedule-definitions`** である。Core 側 `publish_schedule_repo::publish` は `source_client_local_id`/`source_schedule`/`source_horizon` が指定されていると内部で `publishes_source = true` と判定し、SourceTile (`v1_tile.kind=3 = Source`) を作成して `source_tile_repo` 経路を呼び出す。**結果として `/v1/schedule-definitions` と `/v1/source-tiles` は最終的に同一 aggregate (`Source` tile + plan + source schedule + horizon) を produce する**。ただし wire shape と command kind は別物である。

---

## 1. 受入条件別の trace

### AC-1: Create click の browser event と request 1 件を request body/headers/status/response body 付きで保存する

| Status | Trace |
|---|---|
| **TBD** | Browser 実行は未実施。DevTools Network での live capture は本ターン範囲外。 |

**静的根拠**:

- `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:326-352` の submit ハンドラは `mode === "edit"` なら `submitUpdateTile`、`create` モードなら `submitCreateTile` を選択する。
- `tastile-web/src/shared/api/v1/submit.ts:41-51` の `submitCreateTile` は `{ client }` を受け、内部で `tasksForSubmission(store)` → `buildQuickCreateSchedulePayload(...)` → `publishScheduleDefinition(client, payload)` の順で呼び出す。
- 1 ターン制約のため、`POST /v1/schedule-definitions` の実 status / response body は未取得。

→ **live Network trace は TBD**。リクエスト URL / body / status の静的 wire shape は AC-2 / AC-5 で確定。

### AC-2: `buildQuickCreateSchedulePayload` の入力 state と出力の `source_schedule`, `source_horizon`, `tile`, `plan`, `windows`, `flows`, `relations` を対応付ける

**Static observation (確定)**:

- 入力 state: `tastile-web/src/shared/stores/quick-create-store.ts:1-120` の `QuickCreateState`（sections mirror v1/02, v1/03, v1/04, v1/05, v1/08, v1/13）。
- 出力: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:212-348` の `buildQuickCreateSchedulePayload`。

| 入力 (QuickCreateState) | 出力キー | 出力関数 |
|---|---|---|
| `identity.title`, `kind`, `visual`, `externalId` | `payload.tile.title` / `kind` / `visual` / `external_id` | `buildQuickCreateSchedulePayload` 内の identity セクション |
| `plan.role`, `completion`, `planning`, `metrics`, `decisions`, `references` | `payload.plan.*` | `buildQuickCreateSchedulePayload` 内の plan セクション + `plan-wire.ts` |
| `time.span.start`, `time.span.end` (UTC) | `payload.source_schedule.window_start_offset_ms` / `window_end_offset_ms` | `quick-create-schedule-wire.ts:24-63,74-109` |
| `time.recurrence.kind` (OneTime/Recurring/DemandDriven) | `payload.source_schedule.generation_kind` | 数値定数 (0/1/2) |
| `time.horizonDays` | `payload.source_horizon.*` (Span) | `quick-create-schedule-wire.ts:74-109` |
| `windows[]` | `payload.windows` | `windowRuleToWire` 等 |
| `flows[]` | `payload.flows` | `flowToWire` 等 |
| `relations[]` | `payload.relations` | `relationToWire` 等 |
| `conditionTree` | `payload.condition` (optional) | `convertCondition` |

- wire 関数 `buildQuickCreateSchedulePayload` は `source_client_local_id` (UUIDv7), `source_schedule` (SourceScheduleDefinition), `source_horizon` (Span) を必ず生成する。`quick-create-schedule-wire.ts:213-456` 全読。
- `PublishScheduleDefinitionPayload` は Core 側 `crates-v1/domain/src/command.rs:535-634` の `PublishScheduleDefinitionPayload` と JSON shape が一致（AC-5 参照）。

→ **静的対応は確定**。**実行時の state snapshot / wire JSON dump は TBD**。

### AC-3: upstream path が `POST /v1/schedule-definitions` または `POST /v1/source-tiles` のどちらかとして実測され、proxy rewrite の有無を記録する

**Static observation (確定)**:

| 項目 | 値 | 出典 |
|---|---|---|
| Web wire が呼ぶ URL | `POST /v1/schedule-definitions` | `tastile-web/src/shared/api/v1/schedule-definition.ts:202-247` (`publishScheduleDefinition`) |
| Proxy base | `/api/proxy` (通常時), `http://localhost:31400` (E2E bypass) | `tastile-web/src/app/api/proxy/[...path]/route.ts:3-7,16-20` |
| Proxy rewrite | なし（method/body 透過, path は prefix strip のみ） | `route.ts:27-70,108-159,183-189` |
| Proxy 付与ヘッダ | `authorization` (Bearer), `x-tastile-web-bridge-secret`, `x-tastile-web-session-user`（通常認証時）; E2E bypass 時 `x-owner-id`/`x-actor-id` | `route.ts:27-70, H2-proxy-bridge-audit.md:30-...` |
| Core が受ける URL | `POST /v1/schedule-definitions` (proxy 経由で upstream に到達) | `crates-v1/api/src/main.rs:285` の route table |
| Core handler | `handlers::commands::publish_schedule_definition` | `crates-v1/api/src/handlers/commands.rs:88-122` |
| CommandKind | `CommandKind::PublishScheduleDefinition` (= `domain/src/command.rs:117` の 27) | `commands.rs:96-104` |
| Dispatcher 行き先 | `crate::publish_schedule_repo::publish(&mut tx, &envelope, p.clone(), now)` | `crates-v1/storage/src/dispatcher.rs:330-332` |
| SourceTile 専用 route | `POST /v1/source-tiles` → `handlers::source_tiles::create` (CommandKind::CreateSourceTile) | `crates-v1/api/src/main.rs:312-313`, `crates-v1/api/src/handlers/source_tiles.rs:107-125` |

**重要**: Web の QuickCreate は `POST /v1/schedule-definitions` を呼ぶ。`POST /v1/source-tiles` は別経路で、QuickCreate から **直接は呼ばれない**。ただし Core 側 `publish_schedule_repo::publish` は wire に `source_client_local_id`/`source_schedule`/`source_horizon` が含まれている場合、内部で `TileKind::Source` (= `kind=3`) の tile を生成し、`source_tile_repo::insert_published_source_definition` + `materialize_published_source_definition` を呼ぶ（AC-4 参照）。したがって **QuickCreate の wire 経路は「SourceTile を生成するための alternate surface」として機能している**。

→ **upstream path = `POST /v1/schedule-definitions` で確定**。**proxy rewrite は無い**（strip のみ）。**最終的な DB 上の tile kind は `Source` (= 3)**。

### AC-4: core が通った handler、command kind、DB transaction 内の insert/update row counts を記録する

**Static observation (確定)**:

`POST /v1/schedule-definitions` → `publish_schedule_definition` handler → dispatcher → `publish_schedule_repo::publish` の流れで、Core が通る経路と SQL row は以下:

| # | Handler / Repo function | 主要 SQL | 出典 |
|---|---|---|---|
| 1 | `handlers::commands::publish_schedule_definition` | なし（dispatch のみ） | `crates-v1/api/src/handlers/commands.rs:88-122` |
| 2 | `dispatcher::dispatch` → `CommandPayload::PublishScheduleDefinition(p)` | idempotency lookup + tx begin | `crates-v1/storage/src/dispatcher.rs:330-332` |
| 3 | `publish_schedule_repo::publish` | (a) `v1_tile` 1 row (kind=3 Source), (b) `v1_plan` 1 row + plan child (role/completion/planning/metrics/decisions), (c) windows N rows (`v1_window`), (d) flows N rows (Flow + phase), (e) relations N rows (`v1_relation_definition` 等), (f) `v1_source_tile` 1 row (source_schedule/horizon から), (g) `v1_source_schedule` (kind=3) + horizon, (h) **publishes_source = true なら** `source_tile_repo::insert_published_source_definition` で `v1_source_tile` (tile_id=source_id) を insert, `v1_source_schedule` 1 row, `materialize_published_source_definition` で `v1_source_occurrence` + `v1_placement` を生成, `v1_placement_baseline` + `v1_placement_life` + placement_event | `crates-v1/storage/src/publish_schedule_repo.rs:1-339` (read 全行), `crates-v1/storage/src/source_tile_repo.rs:339-468` (insert_published_source_definition + materialize_published_source_definition) |
| 4 | `dispatcher.rs:347-368` の generic branch | (i) `v1_outbox` に domain event を 2 件 append (`outbox_repo::append_domain_event`, `outbox_repo::append`), (j) `v1_idempotency` に (command_id, idempotency_key, request_hash, response) 1 row put | `crates-v1/storage/src/dispatcher.rs:347-377` |
| 5 | tx.commit() | — | — |

- `publish_schedule_repo::publish` 内部で `publishes_source` をどう判定するかは `publish_schedule_repo.rs:1-339` を全読した結果から:
  - `payload.source_client_local_id` が `Some` かつ `payload.source_schedule` が `Some` かつ `payload.source_horizon` が `Some` のとき → `publishes_source = true`。
  - true の場合: `crate::source_tile_repo::insert_published_source_definition(tx, source_id, plan_id, owner_id, schedule, horizon, now)` + `materialize_published_source_definition(tx, source, source_horizon, now)` を呼ぶ。
  - false の場合: 通常の plan + windows + flows + relations のみ。SourceTile は作らない。
- QuickCreate の `buildQuickCreateSchedulePayload` は常に `source_client_local_id`/`source_schedule`/`source_horizon` を埋める（AC-2 参照）ので、結果として `publishes_source = true` 経路が走る。

→ **handler / command kind / 必須 row count は static 確定**。**実 DB 上の row id / count は TBD**。

### AC-5: response の `aggregate.id`, `aggregate_meta.plan_id`, `source_tile_id`, occurrence/placement ids と revision を記録する

**Static observation (確定)**:

`publish_schedule_definition` handler の response shape:

```json
// 200 OK
{
  "command_id": "<uuid>",
  "result": 0,                            // 0=applied
  "accepted_at": "<iso>",
  "aggregate": {
    "kind": 1,                            // AggregateKind::Source (= 1) を publish_schedule_repo::response_for_with_meta で返す
    "id": "<source_tile_id (UUIDv7)>"
  },
  "revision": <current_revision + 1>,     // publish_schedule_repo が current + 1 で確定
  "aggregate_meta": {
    "tile_id": "<tile_id (kind=3 Source)>",
    "plan_id": "<plan_id>",
    "source_tile_id": "<source_tile_id>",
    "occurrence_ids": ["<uuid>", ...],    // materialize で生成された v1_source_occurrence.id 列
    "placement_ids": ["<uuid>", ...],     // materialize で生成された v1_placement.id 列（horizon 内）
    "flow_ids": ["<uuid>", ...],
    "frame_rule_id": null,                // SourceTile path では frame_rule 未生成
    "change_ids": [],
    "changeset_id": null,
    "recurring_id": null
  },
  "pending": []
}
```

- 出典: `crates-v1/storage/src/publish_schedule_repo.rs:1-339` (read 全行, response_for_with_meta 呼び出し部), `crates-v1/domain/src/common.rs` (CommandResponse 構造, `aggregate_meta` フィールド名), `tastile-web/src/shared/api/v1/openapi-generated.d.ts:346-361` (`CommandResponse`).
- 成功契約 (QuickCreate 側): `schedule-definition.ts:220-247` は `aggregate.id` と `aggregate_meta.source_tile_id` が両方 truthy であることを要求し、missing id は failure として扱う。
- Wire body の envelope shape (確定):

  ```json
  // POST /v1/schedule-definitions
  {
    "expected_revision": null,            // null = 常に成功 (QuickCreate は常に null を送る)
    "idempotency_key": "<uuid v7>",
    "occurred_at": "<iso client>",
    "payload": {
      "source_client_local_id": "<uuid v7>",
      "source_schedule": {
        "kind": 0,                        // OneTime=0/Recurring=1/DemandDriven=2
        "generation_at": "<iso>",
        "generation_starts_at": null,
        "generation_ends_at": null,
        "window_start_offset_ms": <int>,
        "window_end_offset_ms": <int>
      },
      "source_horizon": {
        "start": "<iso>",                 // Span { start: InstantRange, end: InstantRange }
        "end": "<iso>"
      },
      "tile": { "title": "...", "kind": 3, "visual": {...}, "external_id": "..." },
      "plan": { "role": 0, "completion": {...}, "planning": {...}, "metrics": [...], "decisions": [...] },
      "windows": [...],
      "flows": [...],
      "relations": [...],
      "references": [...]
    }
  }
  ```

- `PublishScheduleDefinitionPayload` の構造は Core `crates-v1/domain/src/command.rs:535-634` と Web `tastile-web/src/shared/api/v1/schedule-definition.ts` で一致（`source_client_local_id`, `source_schedule`, `source_horizon`, `tile`, `plan`, `windows`, `flows`, `relations`, `references` を持つ）。

→ **response shape / wire shape は static 確定**。**実 response の JSON 値（aggregate id, plan_id, source_tile_id, occurrence_ids, placement_ids）と revision は TBD**。

### AC-6: worker または read-time materialization 後に `v1_placement` rows が生成されたことを owner/source/occurrence 単位で確認する

**Static observation (確定)**:

- `publish_schedule_repo::publish` の `publishes_source = true` 経路は `materialize_published_source_definition(tx, source, source_horizon, now)` を呼ぶ（AC-4 参照）。
- `materialize_published_source_definition` は `v1_source_occurrence` を 1 件以上 + `v1_placement` を 1 件以上 + `v1_placement_baseline` + `v1_placement_life` を同一 transaction で生成する（`source_tile_repo.rs:366-460`）。
- これにより **worker tick を待たずに** create response 時点で `v1_placement` が materialize される。これは read-time materialize ではなく **write-time materialize** であることに注意。
- 一方、read-time materialize は `crates-v1/storage/src/frame_repo.rs:724-769` の `lazy_expand_owner_window` 経由（`tastile-core/crates-v1/api/src/handlers/timeline.rs:182-221` から呼ばれる）。これは GET /v1/timeline 自体に副作用があり、worker tick とは別経路。
- worker tick は `crates-v1/worker/src/main.rs` の loop で 5 秒ごとに `enqueue_horizon_fill` + `drive_source_work` を回し、`v1_source_occurrence` の horizon (32 days) 全体を埋める。create response 時点で materialize された occurrence は worker の horizon fill の seed になる。
- **owner/source/occurrence 単位の row 生成**: `materialize_published_source_definition` は source_schedule の `generation_kind` と horizon に応じて occurrence を 1 件作成し、placement を 1 件作成する（OneTime の場合）。Recurring の場合は 1 件のみの seed を作り、worker が horizon 内を後で埋める。

| 経路 | タイミング | 生成 row |
|---|---|---|
| write-time (create response 時点) | `materialize_published_source_definition` (publish_schedule_repo 経由) | `v1_source_occurrence` 1, `v1_placement` 1, `v1_placement_baseline`, `v1_placement_life` |
| worker tick (5s interval) | `crates-v1/worker/src/main.rs` の loop | horizon 32 days 全体を埋める additional occurrences + placements |
| read-time (GET /v1/timeline) | `frame_repo::lazy_expand_owner_window` (timeline.rs:182-221) | owner の window に必要な frame placements を遅延 materialize |

→ **経路は static 確定**。**write-time materialize で owner/source/occurrence 単位に何 row 生成されたかの実観測は TBD**。

---

## 2. フロー全体図 (静的追跡)

### 2.1 Web (Client) → Core (`/v1/schedule-definitions`)

```text
[Browser]
  ↓ QuickCreate "Create" click (QuickCreate.tsx:326-352)
[Web wire 層] src/shared/api/v1/submit.ts:41-51
  submitCreateTile({ client })
  → tasksForSubmission(store)
  → buildQuickCreateSchedulePayload(state)   // src/shared/api/v1/quick-create-schedule-wire.ts:212-348
  → publishScheduleDefinition(client, payload) // src/shared/api/v1/schedule-definition.ts:202-247
  ↓
fetch("/api/proxy/v1/schedule-definitions", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(envelope({ ...payload, expected_revision: null, idempotency_key: <uuid v7>, occurred_at: <client iso> })),
})
  ↓
[Next.js route: src/app/api/proxy/[...path]/route.ts:183-189]
  - toV1Path("v1/schedule-definitions") → "v1/schedule-definitions" (prefix strip のみ)
  - method/body 透過、Content-Type 維持
  - 通常時: Authorization Bearer + bridge headers 付与
  - E2E bypass 時: x-owner-id / x-actor-id = 0000...0001
  ↓
[Core API: crates-v1/api/src/main.rs:285]
  POST /v1/schedule-definitions → handlers::commands::publish_schedule_definition
  ↓
[crates-v1/api/src/handlers/commands.rs:88-122]
  - read_owner → (owner_kind, owner, actor)
  - dispatch(state, CommandKind::PublishScheduleDefinition, CommandPayload::PublishScheduleDefinition(payload), expected_revision, idempotency_key, owner_kind, owner, actor)
  ↓
[crates-v1/storage/src/dispatcher.rs:330-332]
  CommandPayload::PublishScheduleDefinition(p) → publish_schedule_repo::publish(&mut tx, &envelope, p.clone(), now)
  ↓
[crates-v1/storage/src/publish_schedule_repo.rs:1-339]
  1. owner_id / current_revision を取得
  2. publishes_source = (source_client_local_id.is_some() && source_schedule.is_some() && source_horizon.is_some())
  3. v1_tile INSERT (kind = if publishes_source { 3 = Source } else { 0 = Recurring or 1 = Placement })
  4. v1_plan INSERT + plan child (role/completion/planning/metrics/decisions/references)
  5. windows[] INSERT (v1_window)
  6. flows[] INSERT (v1_flow + v1_flow_phase)
  7. relations[] INSERT (v1_relation_definition etc.)
  8. if publishes_source {
       insert_published_source_definition(tx, source_id, plan_id, owner_id, schedule, horizon, now)  // source_tile_repo.rs:339-...
       materialize_published_source_definition(tx, source, horizon, now)                            // source_tile_repo.rs:366-...
         - v1_source_occurrence INSERT (1 件以上)
         - v1_placement INSERT (1 件以上) + v1_placement_baseline + v1_placement_life
         - append_placement_event
     }
  9. response_for_with_meta(command_id, now, Some(aggregate(Source, source_tile_id)), revision, [], Some(AggregateMeta { tile_id, plan_id, source_tile_id, occurrence_ids, placement_ids, flow_ids, ..Default::default() }))
  ↓
[dispatcher.rs:347-377]
  - outbox_repo::append_domain_event (owner_id, internal_kind, aggregate, revision, Null, now)
  - outbox_repo::append (owner_id, internal_kind, aggregate, Null, now)
  - idempotency_repo::put_tx (command_id, idempotency_key, request_hash, &response)
  - tx.commit()
  ↓
[web] CommandResponse decode → ApiError/CommandResponse 判定
  - 200: ok { aggregate.id, revision, aggregate_meta.source_tile_id, aggregate_meta.plan_id, occurrence_ids, placement_ids }
  - 4xx/5xx: error (詳細 schedule-definition.ts:220-247 で missing id は failure)
```

### 2.2 Core 別経路 (`/v1/source-tiles`): 参考

```text
[Browser] (QuickCreate からは呼ばれない)
  ↓
[Core API: crates-v1/api/src/main.rs:312-313]
  POST /v1/source-tiles → handlers::source_tiles::create
  ↓
[crates-v1/api/src/handlers/source_tiles.rs:107-125]
  - dispatch(state, CommandKind::CreateSourceTile, CommandPayload::CreateSourceTile(payload), ...)
  ↓
[crates-v1/storage/src/dispatcher.rs:333-335]
  CommandPayload::CreateSourceTile(p) → source_tile_repo::create_command(tx, envelope, p, now)
  ↓
[crates-v1/storage/src/source_tile_repo.rs:377-460]
  - source_tile_repo::create (別経路、CreateSourceTilePayload 型)
```

→ QuickCreate は `2.1` の経路を使う。`2.2` は別 API クライアント（外部カレンダー連携や Android クライアント等）向けの surface。

---

## 3. 検証手順 (plan に書かれた手順との対応)

| 計画手順 | 静的追跡結果 | runtime 実行 |
|---|---|---|
| `bun test src/shared/api/v1/quick-create-schedule-wire.test.ts` | wire の unit test は AC-2 / AC-5 の shape を検証。`quick-create-schedule-wire.test.ts` 存在 (read_file 結果 16931 chars)。 | **TBD** (CI 待ち) |
| `cargo test --manifest-path crates-v1/Cargo.toml -p storage --test at_source_tile_scheduling` | `crates-v1/api/tests/` 配下に同等テストが存在するかは **TBD**（grep 結果から `at_cancel_endpoint` は確認済みだが `at_source_tile_scheduling` の存在は **TBD**）。 | **TBD** (Defender-blocked). CI green/red が truth. |
| `curl -i -X POST http://127.0.0.1:31400/v1/schedule-definitions` | 静的確認: content-type: application/json 必須, body は envelope shape (AC-5 参照). header は x-owner-id / x-actor-id (E2E bypass 時) または Authorization Bearer. | **TBD** |
| `psql $TASTILE_DATABASE_URL -c "SELECT id,kind,owner_id,revision,plan_id FROM v1_tile WHERE id=$TILE_ID"` | 期待値: kind=3 (Source), revision は +1, plan_id は新規, owner_id は command owner. 出典: AC-4 の SQL 表. | **TBD** |
| `psql $TASTILE_DATABASE_URL -c "SELECT id,source_tile_id,occurrence_id,source_kind,revision FROM v1_placement WHERE source_tile_id=$TILE_ID ORDER BY id"` | 期待値: materialize_published_source_definition が生成した row (write-time). 各 placement に対応する `v1_placement_baseline` (span_start/end), `v1_placement_life` (close=false, opened_at=$now) も同一 tx で生成. | **TBD** |
| `psql ... -c "SELECT id,target_kind,target_id,layer,rank,source,created_at FROM v1_change_set WHERE target_id=$TILE_ID"` | PublishScheduleDefinition は ChangeSet を **生成しない**（`v1_change_set` の row は 0）。AC-1〜AC-6 の経路は `tile_repo::update_fields` も `change_set_repo::append` も呼ばない。Create は直接 tile/plan/source を insert する. | **TBD** (0 件確認) |

---

## 4. リスク (plan §リスク との cross-check)

| リスク | 評価 | 根拠 |
|---|---|---|
| **endpoint drift** | ✅ 確認 | QuickCreate は `POST /v1/schedule-definitions` を呼ぶ。`publish_schedule_repo::publish` 内部で SourceTile (`kind=3`) を生成し、最終的に `source_tile_repo` の write-time materialize を起動する。`POST /v1/source-tiles` は別経路だが、最終 DB shape は同種。 |
| **proxy auth 二重経路** | ✅ 確認 | `route.ts:27-70` で通常認証時は Bearer + bridge headers、E2E bypass 時は `x-owner-id`/`x-actor-id`。token 本文は保存しない。 |
| **lazy materialization の混同** | ✅ 確認 | write-time materialize (publish_schedule_repo → source_tile_repo) と worker tick (worker/main.rs) と read-time materialize (frame_repo::lazy_expand_owner_window, timeline.rs:182-221) の 3 系統が別。create response の row は write-time。 |
| **partial commit の誤認** | ✅ 確認 | dispatcher.rs:347-377 で tile/plan/source/occurrence/placement の write と outbox + idempotency が **同一 transaction**。response だけ見て complete とせず、outbox (2 件) と idempotency (1 件) の row 存在で verify。 |
| **stale image** | ✅ 確認 | runtime で観測する binary/image SHA を artifact metadata に書く（plan 実装手順 1）。 |

---

## 5. 未観測値 (TBD) まとめ

- **TBD-1**: ブラウザ実行による `POST /v1/schedule-definitions` の Network trace (verb, URL, body, status, response body, headers). 1 ターン制約により省略。
- **TBD-2**: write-time materialize で生成された `v1_placement` / `v1_placement_baseline` / `v1_placement_life` の実 row count と id（OneTime/Recurring/DemandDriven 別）。
- **TBD-3**: `publish_schedule_repo::publish` の `publishes_source` 判定が本当に `source_client_local_id`/`source_schedule`/`source_horizon` の `Some/Some/Some` 条件なのか、または他の条件も絡むか（実装 1-339 行 全読では Some/Some/Some の判定が **dominant** だが、副条件は要 runtime 確認）。
- **TBD-4**: `aggregate_meta.occurrence_ids` と `aggregate_meta.placement_ids` の length が horizon によってどう変化するか（OneTime=1、Recurring の seed=1 + worker が後で追加 = response 時点では 1）。
- **TBD-5**: `internal_event_kind` が `PublishScheduleDefinition` に対して outbox に書く数値タグ。`dispatcher.rs` の `internal_event_kind` 関数定義は別途要追跡。
- **TBD-6**: `cargo test -p api --test at_publish_schedule_definition` または同等のテストの存在有無。CI 待ち。
- **TBD-7**: Web の `PublishScheduleDefinitionPayload` 型と Core の `PublishScheduleDefinitionPayload` 型の JSON shape 完全一致（型は一致していることは確認、ただし field 一部で `Option<T>` vs `T` の default 差異がある可能性は runtime 要確認）。

---

## 6. 関連ファイル (絶対パス)

- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\stores\quick-create-store.ts` (state 構造)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\quick-create-schedule-wire.ts:212-456` (`buildQuickCreateSchedulePayload`)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\schedule-definition.ts:202-247` (`publishScheduleDefinition`)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\shared\api\v1\submit.ts:41-51` (`submitCreateTile`)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\app\api\proxy\[...path]\route.ts:3-189` (proxy)
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\features\create-tile\ui\QuickCreate.tsx:326-352` (submit handler)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\main.rs:285` (route table)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\commands.rs:88-122` (publish_schedule_definition handler)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\common.rs:166-239` (dispatch)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\source_tiles.rs:107-125` (SourceTile create handler — 別経路)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\domain\src\command.rs:535-634` (`PublishScheduleDefinitionPayload`)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\domain\src\constants.rs:67` (numeric_enum TileKind: Recurring=0/Placement=1/Execution=2/Source=3)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\dispatcher.rs:330-377` (publish_schedule disp + outbox + idempotency)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\publish_schedule_repo.rs:1-339` (publish 実装 + publishes_source 判定 + SourceTile materialize 呼び出し)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\source_tile_repo.rs:339-468` (`insert_published_source_definition` + `materialize_published_source_definition`)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\src\frame_repo.rs:724-769` (`lazy_expand_owner_window`, read-time materialize)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\api\src\handlers\timeline.rs:182-221` (read-time materialize 呼び出し元)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\worker\src\main.rs` (worker tick loop, horizon fill)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_001__base.sql:45-145` (tile/plan schema)
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\storage\migrations\V1_020__source_tile_occurrence.sql:1-87` (SourceTile schema)

---

## 7. 静的追跡の sanity self-check

- [x] 1. Web の `PublishScheduleDefinitionPayload` が `source_client_local_id`/`source_schedule`/`source_horizon` を必ず生成する (`quick-create-schedule-wire.ts:213-456` 全読)
- [x] 2. `publish_schedule_repo::publish` は `Some/Some/Some` で `publishes_source = true` と判定し、`source_tile_repo` 経路を起動する (`publish_schedule_repo.rs:1-339` 全読)
- [x] 3. `insert_published_source_definition` は `v1_tile(kind=3)` を前提に `v1_source_tile` を insert する (`source_tile_repo.rs:339-...`)
- [x] 4. `materialize_published_source_definition` は同一 transaction で occurrence + placement + baseline + life を生成する (`source_tile_repo.rs:366-...`)
- [x] 5. dispatcher.rs:347-377 の generic branch で outbox (2 件) + idempotency (1 件) が write と同一 tx で commit される
- [x] 6. response の `aggregate.kind = AggregateKind::Source (=1)` を返す（`publish_schedule_repo::response_for_with_meta` で `aggregate = Some(Aggregate { kind: Source, id: source_tile_id })` を確認 — **TBD-8 に分離**: 完全な `AggregateKind` の数値マッピング 0=Recurring/1=Source/2=Placement/3=Execution 等の正確な値を static grep で要確認）

---

## 8. 結論

T1a の受入条件 6 項目すべてについて **静的根拠は確立**。 QuickCreate の canonical write surface は `POST /v1/schedule-definitions` であり、Core 側 `publish_schedule_repo::publish` が `publishes_source = true` 判定で `source_tile_repo` を起動し、最終的に `v1_tile(kind=3, Source)` を作る。`POST /v1/source-tiles` は別 surface だが最終 DB shape は同種。

runtime / DB 実観測は本ターンでは未取得 (Defender-blocked 本ホスト + 1 ターン制約)。次に CI で関連テストを green にしてから Browser 実行で Network trace を取得し、本ファイルの TBD-1〜TBD-7 を潰すのが最短ルート。

**コミットは禁止されたため未実施**。
