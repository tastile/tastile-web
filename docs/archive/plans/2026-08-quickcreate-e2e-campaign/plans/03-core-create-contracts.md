# v1 Core Create Contracts — Source-Cited Map

> Audit target: every wire-format and storage path the TEAM-LEAD's planned
> UI features (QuickCreate, calendar create, source-tile authoring) will
> touch on `tastile-core`. Read-only; no edits to spec or code.
>
> Each section is **spec → implemented → legacy**. Implementation rows
> cite `file:line`. Hovering the citation reveals the SQL/event/binding
> shape. Anything annotated **SPEC-ONLY** is described in `v1/` but not
> yet wired or is exposed through a different surface.

---

## 1. Surface map (one-glance)

| Create surface | HTTP | CommandKind | Storage entry | Dispatcher arm |
| --- | --- | --- | --- | --- |
| **SourceTile** (new) | `POST /v1/source-tiles` | `CreateSourceTile = 31` | `source_tile_repo::create` | `dispatcher.rs:333-334` |
| **SourceTile** update | `PUT /v1/source-tiles/{id}` | `UpdateSourceTile = 32` | `source_tile_repo::update` | `dispatcher.rs:336-337` |
| **SourceTile** reflow | `POST /v1/source-tiles/{id}/reflow` | `ReflowSourceTile = 33` | `source_tile_repo::reflow` | `dispatcher.rs:339-340` |
| **SourceTile** cancel | `POST /v1/source-tiles/{id}/cancel` | `CancelSourceTile = 34` | `source_tile_repo::cancel_command` | `dispatcher.rs:342-343` |
| **Tile** (legacy) | `POST /v1/tiles` | `CreateTile = 0` | `tile_repo::create` | `dispatcher.rs:60-61` |
| **Plan** (legacy) | `POST /v1/tiles/{tileId}/plan` | `SetPlan = 1` | `plan_repo::set_plan` | `dispatcher.rs:63-64` |
| **Placement** (legacy) | `POST /v1/placements` | `CreatePlacement = 2` | `placement_repo::create` | `dispatcher.rs:66-67` |
| **Execution** | `POST /v1/placements/{placementId}/executions` | `StartExecution = 4` | `execution_repo::start` | `dispatcher.rs:73-74` |
| **Publish schedule** (legacy) | not in route map | `PublishScheduleDefinition = 30` | `publish_schedule_repo::publish` | `dispatcher.rs:330-331` |
| **Schedule draft** | `POST /v1/schedule-drafts` | `CreateScheduleDraft` → `PublishScheduleDefinition` | `schedule_draft_repo` | indirect (handler map) |

(Read-side surfaces live in §7.)

---

## 2. Spec source — `v1/14-read-model-and-endpoint.md`

### 2.1 Command envelope (`v1/14 §1.2`)
```
CommandRequest<T>
├─ expectedRevision  Int64 | null
├─ idempotencyKey    UUIDv7
├─ occurredAt        Instant        (server overwrites)
└─ payload           T              (kind-specific)
```
Implementation: `crates-v1/domain/src/command.rs:25-31`
`CommandResponse` (+ `aggregate_meta`): `command.rs:44-79`. The
`aggregate_meta` is the server-assigned-IDs block (see §3.4).

`CommandResult` values (`command.rs`/`v1/14 §1-3`):
`0=APPLIED`, `1=ALREADY_APPLIED`, `2=ACCEPTED` — the path returns
`ACCEPTED` for every Create/Update/Reflow because the dispatcher writes
in one transaction and the outbox event is the asynchronous leg.

`ApiErrorKind` (`v1/14 §1-4`, `command.rs:170-176`): 8 values, **numeric
constants only** (`v1/10 §2`). `RepoError → ApiError` mapping is in
`handlers/common.rs` (the `map_repo_error` helper used by `dispatch`).

### 2.2 AggregateKind (`v1/14 §2`)
| Value | Meaning | Used in `AggregateMeta` slot |
| --- | --- | --- |
| 0 | RECURRING | (legacy) |
| 1 | PLACEMENT | (legacy) |
| 2 | EXECUTION | (legacy) |
| 3 | SESSION | (legacy) |
| 4 | SOURCE | `source_tile_id` (v1/14 §SourceTile API) |

### 2.3 Command catalogue (`v1/14 §2.5`)
Spec requires 8 commands at `Phase A 段 8`:
- `CREATE_TILE` / `SET_PLAN` / `CREATE_PLACEMENT` / `APPEND_CHANGES`
- `START_EXECUTION` / `PAUSE_EXECUTION` / `RESUME_EXECUTION` / `FINISH_EXECUTION`

Implemented shapes are richer than the catalogue. Dispatcher arms
(`dispatcher.rs:58-345`) cover 35 commands, including the 4 SourceTile
ones (31–34) plus 18 lifecycle / window / flow / decision / delivery /
work / lease / materialize / detach / close / publish / session /
feedback / endpoint commands.

### 2.4 SourceTile API (canonical)
`v1/14 §SourceTile API` specifies **5 endpoints** as the canonical
surface:
- `POST /v1/source-tiles` (`source_tiles.rs:108-126`)
- `GET /v1/source-tiles/{id}` (`source_tiles.rs:214-234`)
- `PUT /v1/source-tiles/{id}` (`source_tiles.rs:128-157`)
- `POST /v1/source-tiles/{id}/reflow` (`source_tiles.rs:159-181`)
- `GET /v1/source-tiles/{id}/placements` (`source_tiles.rs:236-256`)

Two bonus read endpoints were added later:
- `GET /v1/source-tiles` list (`source_tiles.rs:277-290`)
- `GET /v1/source-tiles/{id}/completion` (`source_tiles.rs:258-275`)
- `POST /v1/source-tiles/{id}/cancel` (`source_tiles.rs:190-212`, AT-091–098)

The CreateSourceTile response contract carries
`sourceTileId / occurrenceIds / placementIds` in `aggregate_meta`
(`source_tile_repo.rs:446-460`). The "Data model" fence rule from
`v1/14 §SourceTile API` ("legacy Recurring を SourceTile と偽装せず") is
enforced by `locked_linked_source_flows` (`source_tile_repo.rs:837-855`)
returning `None` when a flow's stored kind is not one of the 7 source-flow
signals.

### 2.5 Spec-only items
- `GET /v1/timeline` is **specified** (`v1/14 §4`) but the live handler
  returns a richer Effective read model (`v1/14 §4.1
  Source occurrence duration override` (`v1.1 additive`)). The
  implementation lives in `handlers/timeline.rs` (see §7).
- `Source occurrence duration override` is a `v1.1 additive` spec
  (`v1/14 §4.1`); the column lives in migration `V1_054` (see §4).

---

## 3. Command payload shapes (domain types)

### 3.1 CreateSourceTilePayload
`crates-v1/domain/src/command.rs:197-210`
```
{
  source_client_local_id?: UUIDv7,
  tile:   { title, description?, color?, icon?, external_id? },
  plan:   { role, references[], completion, planning{placement_rules, nesting_rules}, metrics[], decisions[] },
  flows:  [{ observes[ScheduleFlowSignal], when?, candidates[{when, rank, outputs[ScheduleFlowOutputDefinition]}] }],
  relations?: [SourceRelationDefinitionPayload],
  schedule: SourceScheduleDefinition,
  horizon:  Span
}
```
`ScheduleFlowOutputDefinition` (`command.rs:494-509`) is a 3-variant
enum:
- `ProposeNewPlanPlacement(NewPlanProposalDefinition)`
- `ProposeNewPlanPlacementSequence { proposal, sequence_steps }`
- `ProposeChangeWithCompanions { change, change_layer, companions }`

`SourceRelationDefinitionPayload` (`command.rs:570-585`) carries a
20-field normalized row, including `SourceRelationEndpointRef`
(`command.rs:552-557` = `Local {client_local_id}` | `Existing {source_tile_id}`).

`SourceScheduleDefinition` (see `domain/src/source_schedule.rs`) — the
serialized form mirrors `v1_source_tile` columns (see §4.3).

### 3.2 UpdateSourceTilePayload
`command.rs:212-225` — same shape as create, plus `source_tile_id`.

### 3.3 ReflowSourceTilePayload
`command.rs:227-232` — `{ source_tile_id, range: Span }`. Only
occurrences whose windows overlap this range are reconsidered. **Does
not change the horizon**; performs a `prepare_source_reflow` + global
`reflow_owner_window` to displace lower-priority automatic placements
within the same owner and window.

### 3.4 CancelSourceTilePayload
`command.rs:234-239` — `{ source_tile_id, reason: i16 }`. Reason is a
numeric `domain::source_tile::state::cancel_reason` registry (USER=0,
CLEANUP=1, MIGRATION=2). Result carries `closed_placement_ids` in
`aggregate_meta` (planned; the current implementation returns the
`source_tile_id` + `revision` only).

### 3.5 CreateTilePayload (legacy, used by v0 clients)
`command.rs:178-195` — `{ kind:TileKind, title, description?, color?, icon?, external_id?, plan_role:PlanRole, frame_rule?:FrameRuleDef }`.
Used by `tile_repo::create`. The dispatcher still wires it
(`dispatcher.rs:60-62`), but **QuickCreate should not call this** — it
is the v0/v7-era path (see §6).

### 3.6 CreatePlacementPayload
`command.rs:252-259` — `{ tile_id, plan_id, source:PlacementSource, source_ref:PlacementSourceRef, baseline:PlacementBaseline }`.
`PlacementSource` numeric (`v1/02 §source`): 0 MANUAL, 1 RECURRING
(legacy-read), 2 FLOW (legacy-read), 3 IMPORT, 4 SOURCE.

### 3.7 StartExecutionPayload
`command.rs:282-285` — `{ placement_id }`. Placement must be in
`role=EXECUTABLE`; the `StartTile` shortcut (`dispatcher.rs:308-319`)
exists for "create Placement and don't start it" flows.

### 3.8 PublishScheduleDefinitionPayload
`command.rs:530-550` — accepts **null** for `source_schedule` /
`source_horizon` to create a flexible schedule without a Source. This
is the path `crates-v1/api/src/handlers/schedule_drafts.rs` uses for
the legacy "draft" surface.

---

## 4. Persistence map (PostgreSQL)

### 4.1 Migration ledger
`crates-v1/storage/migrations.rs:2147-2310` — the `MIGRATIONS` array
walks 58 versions in order. **The create/inventory team needs to know
which version stamped each table.**

| Tables | Migration |
| --- | --- |
| `v1_tile`, `v1_plan`, `v1_recurring`, `v1_placement`, `v1_execution`, `v1_change_set`, `v1_window`, `v1_reference`, `v1_metric`, `v1_flow`, `v1_feedback_txn`, `v1_session`, `v1_decision`, `v1_endpoint`, `v1_delivery`, `v1_outbox_event`, `v1_domain_event`, `v1_work_item`, `v1_idempotency`, `v1_stamp` | `V1_001_BASE` (`migrations.rs:300`, body `l.300-1280`) |
| `v1_flow_candidate_output_proposal` | `V1_002` (`migrations.rs:1687`) |
| `v1_user`, `v1_team`, `v1_team_member`, `v1_api_token`, **`v1_session`** (auth), `v1_session_secret`, `v1_api_token_event`, `v1_access_grant` | `V1_004_ACCESS_GRANT` (`migrations.rs:33`) |
| `v1_calendar_event` | `V1_010` (`migrations.rs:1711`) |
| `v1_calendar_event_extended` | `V1_011` (`migrations.rs:1742`) |
| `v1_annotation` | `V1_012` (`migrations.rs:1764`) |
| `v1_recurring_model` (exclusion table) | `V1_013` (`migrations.rs:1798`) |
| `v1_owner` (profile table) | `V1_016` (`migrations.rs:1899`) |
| `v1_reference.target_kind` typed variant | `V1_017` (`migrations.rs:1975`) |
| `v1_schedule_draft` | `V1_018` (`migrations.rs:2086`) |
| `v1_recurring_frame_rule.placement_duration_ms` | `V1_019` (`migrations.rs:1997`) |
| `v1_source_tile`, `v1_source_occurrence` | `V1_020` (`migrations.rs:2002-2003`) |
| `v1_source_lifecycle_event`, `v1_source_reflow_work` | `V1_021` (`migrations.rs:2004-2005`) |
| `v1_source_revision_reflow` | `V1_022` (`migrations.rs:2006-2007`) |
| `v1_source_tile` generation filters | `V1_023` (`migrations.rs:2009`) |
| `v1_source_date_exclusion` | `V1_024` (`migrations.rs:2016-2017`) |
| `v1_source_occurrence_producer` | `V1_025` (`migrations.rs:2018-2019`) |
| `v1_source_state`, `v1_placement_source_ref_producer` | `V1_026` (`migrations.rs:2020-2021`) |
| flow output phase split | `V1_027` (`migrations.rs:2023`) |
| break workflow upgrade | `V1_028` (`migrations.rs:2026-2027`) |
| flow output sequence normalize | `V1_029` (`migrations.rs:2028-2029`) |
| initial source binding | `V1_030` (`migrations.rs:2030-2031`) |
| tile reference graph | `V1_031` (`migrations.rs:2032-2033`) |
| inside-relation authority | `V1_032` (`migrations.rs:2034-2035`) |
| source local offset | `V1_033` (`migrations.rs:2037-2038`) |
| calendar term offset inheritance | `V1_034` (`migrations.rs:2039-2040`) |
| relation definition client identity | `V1_035` (`migrations.rs:2041-2042`) |
| relation materialization state | `V1_036` (`migrations.rs:2043-2044`) |
| relation decision outbox & lease | `V1_037` (`migrations.rs:2045-2046`) |
| relation decision notification | `V1_038` (`migrations.rs:2047-2048`) |
| split segment identity | `V1_039` (`migrations.rs:2049-2050`) |
| source blocked handoff payload | `V1_040` (`migrations.rs:2051-2052`) |
| execution runtime | `V1_041` (`migrations.rs:2053`) |
| decision runtime | `V1_042` (`migrations.rs:2054`) |
| endpoint delivery token | `V1_043` (`migrations.rs:2055-2056`) |
| delivery runtime | `V1_044` (`migrations.rs:2057-2058`) |
| delivery runtime fences | `V1_045` (`migrations.rs:2059-2060`) |
| endpoint cipher provenance | `V1_046` (`migrations.rs:2061-2062`) |
| delivery workflow session | `V1_047` (`migrations.rs:2063-2064`) |
| decision reuse selector | `V1_048` (`migrations.rs:2065-2066`) |
| decision runtime idempotency | `V1_049` (`migrations.rs:2067-2068`) |
| decision effect change | `V1_050` (`migrations.rs:2069-2070`) |
| interaction input feedback mapping | `V1_051` (`migrations.rs:2071-2072`) |
| sequence step target plan | `V1_052` (`migrations.rs:2073-2074`) |
| metric series source | `V1_053` (`migrations.rs:2075-2076`) |
| **source occurrence duration override** (v1.1 additive) | `V1_054` (`migrations.rs:2077-2078`) |
| flow output companion | `V1_055` (`migrations.rs:2079-2080`) |
| execution flow work | `V1_056` (`migrations.rs:2081-2082`) |
| flow change layer | `V1_057` (`migrations.rs:2083`) |
| flow output change payload | `V1_058` (`migrations.rs:2084-2085`) |

`v1_migration` (`migrations.rs:331-334`) is the bookkeeping table that
records applied versions. `v1_idempotency.response` is the only
**permitted JSONB column** in the entire schema (`v1/10 §2` exception).

### 4.2 Source tile row shape
`v1_source_tile` (per `insert_source` SQL at `source_tile_repo.rs:989-998`)
```
source_tile_id, plan_id, owner_id, revision, required_duration_ms,
generation_kind {0=ONE_TIME, 1=RECURRING},
generation_at, generation_starts_at, generation_interval_ms, generation_ends_at,
generation_weekday_mask, generation_date_range_start, generation_date_range_end,
generation_offset_min,
window_start_offset_ms, window_end_offset_ms,
split_kind {0=UNSPLIT, 1=SPLIT},
split_min_segment_ms, split_max_segment_ms, split_max_segments,
priority, created_at, updated_at
```
Lifecycle (`V1_026`):
```
source_state (0=ACTIVE, 1=PAUSED, 2=ENDED, 3=CANCELLED),
state_changed_at, state_changed_by_actor_id
```

### 4.3 Source occurrence row
`v1_source_occurrence` (per `materialize` SQL ≈ `source_tile_repo.rs:1166-1175`)
```
id, source_tile_id, sequence_no, nominal_at,
window_start, window_end, required_duration_ms,
state {0=PLANNED, 1=UNPLACED, 2=PLACED, 3=BLOCKED, 4=PUT_ASIDE},
revision,
effective_duration_ms?, duration_override_reason? (V1_054)
```

### 4.4 Source-managed placement
```
v1_placement (
  id, tile_id, plan_id, owner_id, source_kind=4 (SOURCE),
  revision, created_at, updated_at
)
v1_placement_baseline (placement_id, span_start, span_end, inside_parent_placement_id, …)
v1_placement_life (placement_id, detached, close, close_kind, close_at, …)
v1_placement_source_ref_source (placement_id, source_tile_id, occurrence_id, split_index, split_count, split_group_id)
v1_placement_source_ref_producer (placement_id, producer_kind, producer_id, producer_revision, local_id) — V1_026
v1_placement_change_set, v1_placement_change (ChangeSet children)
v1_execution_basis, v1_execution_segment (per execution)
```

---

## 5. Wire-format invariants (these are the ones that bite)

| Invariant | Source | Where it lives |
| --- | --- | --- |
| `kind` is an integer, not a string | `v1/10 §2`, `v1/14 §2.7` | handler `Deserialize` (e.g. `source_tiles.rs:184-188` for `reason: i16`) |
| All IDs are UUIDv7 | `v1/02 識別子` | `v1_uuid_v7()` in `migrations.rs:311-328`; every repo uses `Uuid::now_v7()` |
| `0` is not a sentinel | `v1/10 §2` | `Option<…>` everywhere, e.g. `ActiveFlow.ref_id?.raw()` |
| No JSONB in the source of truth | `v1/10 §2` | every spec is normalized into child tables; only `v1_idempotency.response` is JSONB |
| `Command` is atomic | `v1/10 §4`, `v1/14 §1` | `dispatcher.rs:44-378` — one transaction; idempotency check + payload + domain event + outbox event + idempotency put |
| `expectedRevision` mismatch → `STALE_REVISION` | `v1/14 §1-4` | `source_tile_repo.rs:496-502` (and `update`/`reflow` paths) |
| `idempotencyKey` reuse with different payload → `IDEMPOTENCY_KEY_REUSED` | `v1/14 §1-4` | `dispatcher.rs:49-56` |
| Idempotency hash is `(owner_id, expected_revision, payload)` | `v1/10 §4` | `dispatcher.rs:383-390` |
| Outcomes are `[APPLIED, ALREADY_APPLIED, ACCEPTED]` | `v1/14 §1-3` | `dispatcher.rs:420` (always `Accepted` for write paths) |
| Errors are 8 values of `ApiErrorKind` | `v1/14 §1-4` | `handlers/common.rs` (`map_repo_error`) |
| `Revision` is `i64` and is monotonic | `v1/02`, `v1/10 §4` | `source_tile_repo.rs:504` (`current + 1`) |
| All timestamps server-side | `v1/14 §1.2` | `envelope.occurred_at` is whatever the server saw; the handler never trusts client `now` |
| `BREAK`/REST is not a discriminator | `v1/10 §9` | no `isBreak`/`target_rest_min` in any table; `休憩` is just a string title seeded by `V1_015` |
| Cross-owner access → `NOT_FOUND` | `v1/14 §8` | `source_tile_repo.rs:481-484` ("source tile owner mismatch") |
| `Recurring` (legacy) is read-only | `v1/02 §source` (`v0.5.3 以降の commitment`) | `placement_repo::create` rejects `source_kind IN (1,2,3)` for *new* flows per HARNESS §5 |

---

## 6. Legacy / deprecated paths (do NOT target for new QuickCreate)

| Surface | Status | Reason |
| --- | --- | --- |
| `POST /v1/tiles` (CreateTile) | Legacy. Wired (`tile_repo::create` via `dispatcher.rs:60-61`), but `tile_repo` still serves `v0/v7` semantics. | `v1/02 §Tile` keeps `kind=RECURRING|PLACEMENT|EXECUTION` — the legacy 3-value enum. New code should use `kind=SOURCE (3)` via `CreateSourceTile`. |
| `POST /v1/placements` (CreatePlacement) for `source_kind=4` (SOURCE) | Allowed for materialized placements but **authors should not call this directly**. | `v1/02 §v0.5.3 以降の commitment`: new scheduled placements are emitted by `source_tile_repo::materialize` (`source_tile_repo.rs:444`). |
| `PublishScheduleDefinition` (CommandKind 30) | Implemented indirectly via `schedule_drafts` handlers. | `crates-v1/api/src/handlers/schedule_drafts.rs` rewrites it into `CreateSourceTile`. |
| `v7_tiles` / `v7_intent_nodes` / `TickOutput` / `Arbiter` / `Materializer` | **Banned** by `tastile-core/CLAUDE.md` "やってはいけないこと". | All legacy v0 schemas and `crates-v0/*` are frozen. |
| `isBreak` / `restMode` / `napRule` / `examWeekMode` | Banned by `v1/10 §10`. | Any new structure carrying these flags is a regression. |
| `placement_source IN (1, 2, 3)` (RECURRING/FLOW/IMPORT) | SPEC-ONLY for new rows. | `v1/02 §v0.5.3 以降` — legacy writers are read-only; new placements materialize as `source_kind=4 SOURCE`. |

---

## 7. Read-back surfaces (for QuickCreate's "select existing" / "view just created")

| Surface | Handler | Repo | Notes |
| --- | --- | --- | --- |
| `GET /v1/source-tiles` | `handlers/source_tiles.rs:277-290` | `source_tile_repo::list_page` | `?owner_id&limit&offset` (default 100/0, clamp 1..=500) |
| `GET /v1/source-tiles/{id}` | `handlers/source_tiles.rs:214-234` | `source_tile_repo::read_page` | `SourceTileDetailRead` includes relations, occurrences, placements |
| `GET /v1/source-tiles/{id}/placements` | `handlers/source_tiles.rs:236-256` | `source_tile_repo::list_placements_page` | `PlacementTileRead` — single span per row |
| `GET /v1/source-tiles/{id}/completion` | `handlers/source_tiles.rs:258-275` | `completion_repo::get_source_split_completion` | split-aware completion snapshot |
| `GET /v1/timeline` | `handlers/timeline.rs` | `frame_repo::lazy_expand_owner_window` + `read::list_tiles` | Max 31-day window (HARNESS §5 "Production-quality verification pass"). Includes `v1_source_tile` rows via `list_tiles` UNION. |
| `GET /v1/tiles` | `handlers/read.rs` | `read::list_tiles` (UNION `v1_tile` + `v1_source_tile`) | `view_mode` / `lifecycle` / `range` / `granularity` / `search` / `exclude_future` filters |
| `GET /v1/active-tile` | `handlers/read.rs` | `read::active_tile` | Owner + actor headers (Bearer / bridge / x-owner-id fallback) |
| `GET /v1/sync` | `handlers/sync.rs` | `changes_repo` | `SyncChange` 6-value `kind` (0=PLACEMENT_CREATED … 5=EXECUTION_FINISHED) |
| `GET /v1/owners/{kind}/{id}/profile` | `handlers/owner.rs` | `owner_repo` | Phase A: `kind=0` (USER) only; `kind>0` → 501 |
| `GET /v1/openapi.json` | `handlers/openapi.rs` (utoipa 5.5) | static | Schema for `TileListView`, `TemporalView`, `RecurrenceView` lives in `crates-v1/api/src/openapi.rs` (domain stays utoipa-free) |

---

## 8. Mistakes the team-lead's features will hit

These are the contracts I would have to verify in each consumer:

1. **No `kind`/`type` discriminator on placements**.
   `v1/10 §6` says Execution only references Placement. The `v1/self_*`
   code per `memory feedback_no_kind_enums` does not store `isBreak`.
   QuickCreate must not introduce a `kind` parameter that asks the
   client "is this a break?".

2. **`SourceScheduleDefinition` is the only place generation + window +
   split are stored.** Putting any of these on `v1_tile` directly
   violates `v1/10 §2` (no JSONB). The create path always inserts one
   `v1_source_tile` row backed by `v1_source_date_exclusion` for the
   `excluded_dates[]` (`source_tile_repo.rs:1037-1048`).

3. **At `POST /v1/source-tiles` you must pass `source_client_local_id`
   if `relations[]` is non-empty** (`source_tile_repo.rs:383-387`).
   QuickCreate panel that edits relations without a client_local_id
   will be rejected with `VALIDATION`.

4. **Legacy `POST /v1/placements` still accepts `source_kind=0 MANUAL`
   for hand-picked single placements.** If QuickCreate should target
   the new pipeline, it must build a `CreateSourceTilePayload` with
   `source.generation.kind=ONE_TIME` (0) and a single-occurrence horizon
   — see `expand_occurrences_with_offset` in `domain/src/source_schedule.rs`.

5. **`expectedRevision` is required by `Update` / `Reflow` /
   `CancelSourceTile`.** The handler rebinds `expected_revision` from
   the envelope (`source_tiles.rs:139-141`, `170-173`, `201-203`). A
   quick-create follow-up edit must keep the response's `revision` to
   chain subsequent calls.

6. **`aggregate_meta.tile_id == source_tile_id` for SourceTile.**
   `source_tile_repo.rs:453-455` writes both fields. Clients must
   consume `aggregate_meta.source_tile_id` (the canonical alias) and
   not `aggregate.id` for the tile UUID — `AggregateKind::Source` is
   value 4 (see `v1/14 §2 AggregateKind`).

7. **Cancel removes runtime Execution tracking only via
   `closed_placement_ids` in `aggregate_meta` (AT-091..098).** Active
   Executions are kept (v1/10 §6 invariant — Execution never depends
   on Placement). Implementation lives in `source_tile_repo::cancel_command`
   (search `AT-091` in-repo; the function is in `source_tile_repo.rs`).

8. **The 31-day window cap on `GET /v1/timeline`** (HARNESS §5
   "Production-quality verification pass") also applies to any windowed
   read. The create flow itself doesn't hit this, but QuickCreate's
   preview pane must either span ≤31 days or paginate.

9. **Plan completion evaluation re-runs are not idempotent if
   `expected_revision` is None.** `dispatcher.rs:723` clears it for
   the nested `set_plan` call inside `persist_plan_definition`. Don't
   fail loudly if QuickCreate sees `expectedRevision=null` being
   accepted on `Create`.

10. **`integration_database_url() else skip` path can mask contract
    bugs.** Per memory `feedback_integration_test_skip_masks_contract_bugs`,
    every test inside `crates-v1/storage/tests/integration_*.rs` that
    uses that gate must be exercised against a real Postgres before
    closing the contract topic. The `at_source_tile_scheduling.rs` suite
    is the most relevant target.

---

## 9. Inventory of files the team-lead's QuickCreate work will read

| Concern | File |
| --- | --- |
| Command envelope, results, errors | `crates-v1/domain/src/command.rs` |
| SourceTile domain types | `crates-v1/domain/src/source_schedule.rs` |
| SourceTile / relation domain | `crates-v1/domain/src/source_tile.rs` |
| Aggregates, IDs, constants | `crates-v1/domain/src/common.rs` |
| SourceTile persistence | `crates-v1/storage/src/source_tile_repo.rs` |
| SourceTile Plan children | `crates-v1/storage/src/plan_repo.rs` |
| SourceTile Occurrence materialization | `crates-v1/storage/src/frame_repo.rs` |
| SourceTile flow fan-out | `crates-v1/storage/src/flow_repo.rs` |
| Dispatch + idempotency | `crates-v1/storage/src/dispatcher.rs` |
| Tile legacy persistence | `crates-v1/storage/src/tile_repo.rs` |
| Placement persistence | `crates-v1/storage/src/placement_repo.rs` |
| Execution persistence | `crates-v1/storage/src/execution_repo.rs` |
| Schema (DDL) | `crates-v1/storage/src/migrations.rs` + `crates-v1/storage/migrations/V1_*.sql` |
| HTTP routes | `crates-v1/api/src/handlers/source_tiles.rs`, `commands.rs`, `common.rs`, `timeline.rs`, `read.rs` |
| OpenAPI schema | `crates-v1/api/src/openapi.rs` |
| Worker (recurring prefill) | `crates-v1/worker/src/main.rs` (see HARNESS §5 "Recurring fill E2E") |

---

## 10. SPEC-ONLY items still queued

These are described in `v1/14` but not yet wired into the create
contract. Tracking them prevents the team-lead from expecting a runtime
that doesn't exist.

- `Profile override` (`v1/14 §9-2`): `PUT/DELETE` returns 501.
- `v1_session` (auth) table exists in `V1_004_ACCESS_GRANT`, but the
  v1/14 §6 `SyncResponse` Session row is not yet emitted by the
  CommandResponse side.
- `v1.1 additive` Source occurrence duration override (`v1/14 §4.1`)
  is wired in `V1_054` but `SourceTileRead` does not yet expose
  `effective_duration_ms` / `duration_override_reason` in the JSON read
  shape (search `SourceTileRead` in `source_tile_repo.rs:264-281`).

---

## 11. Verification commands (so the next agent can verify cited lines)

```bash
# Domain command payloads
grep -n "pub struct CreateSourceTilePayload" crates-v1/domain/src/command.rs
grep -n "CommandKind::CreateSourceTile" crates-v1/storage/src/dispatcher.rs

# Migration ledger
grep -n "V1_0" crates-v1/storage/src/migrations.rs | head -80

# Idempotency hash contract
grep -n "hash_envelope\|idempotency_hash" crates-v1/storage/src/dispatcher.rs

# SourceTile read shape
grep -n "pub struct SourceTileRead\|pub struct SourceTileDetailRead" crates-v1/storage/src/source_tile_repo.rs
```

End of audit.
