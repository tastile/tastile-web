# 01 — Domain Spec: Fields for Tile Creation + Scheduled Placement

Ground-truth enumeration of every field on the v1 domain entities involved in creating a tile and materialising it as scheduled placements. Every row carries a file:line source. Spec is silent where noted; nothing invented.

## Scope

In scope: Tile (Base + Plan), SourceSchedule (Generation/Window/SplitPolicy/Priority), Window, Flow, Condition, Annotation, Memo, Placement (Span, Source, Inside, Life). Recurring (legacy read-only) noted but flagged as deprecated. NOT in scope: Owner / Workspace / ApiToken / Notification / Quota / Tick / OAuth / Avatar / Profile.

## Per-entity field tables

### Tile (`v1/02-core-entities.md:26-50`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `id` | UUIDv7 | yes | `v1/02:30` | All aggregate IDs |
| `kind` | i16 RECURRING(0)/PLACEMENT(1)/EXECUTION(2)/SOURCE(3) | yes | `v1/02:31,42-46`, `v1/HARNESS.md` registry | numeric constant; new writes use SOURCE(3) not legacy |
| `owner` | Owner ref | yes | `v1/02:32` | Auth-bound; not in payload, server-derived |
| `externalId` | String? | no | `v1/02:33,50` | External system ID; not a UUID |
| `revision` | i64 | yes (auto) | `v1/02:34` | Optimistic lock |
| `content.title` | String | yes | `v1/02:35`, `command.rs:181` | `CreateTilePayload.title` |
| `content.description` (`description`) | String? | no | `v1/02:35`, `command.rs:182` | Optional |
| `visual.color` | hex string? | no | `v1/02:36`, `command.rs:183` | hex not validated server-side |
| `visual.icon` | String? | no | `v1/02:36`, `command.rs:184` | name key, e.g. "check-circle" |
| `frame_rule` | `FrameRuleDef?` | conditional | `command.rs:194` | Required iff `kind=RECURRING`; must be None otherwise (handler validates) |

### Plan (`v1/02-core-entities.md:54-95`, `v1/13-completion.md`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `role` | i16 EXECUTABLE(0)/LABEL(1) | yes | `v1/02:60,73-77`, `command.rs:186` | LABEL is not a 4th tile kind |
| `references[]` | `Vec<ReferenceDef>` | no | `v1/02:61`, `command.rs:245` | UUID-identified |
| `completion` | `Completion` | yes | `v1/02:62`, `command.rs:246`, `v1/13:9-14` | `root + timeRequirements + tasks` |
| `completion.root` | `Condition` | yes | `v1/13:11`, `v1/13:186-208` | Tree of ALL/ANY/NOT + Term refs |
| `completion.timeRequirements[]` | `Vec<TimeRequirement>` | no | `v1/13:12` | UUID-identified |
| `completion.tasks[]` | `Vec<TaskDefinition>` | no | `v1/13:13` | UUID-identified; **no execution state stored** |
| `planning` | `Planning` | yes | `v1/02:63`, `command.rs:247` | placement_rules + nesting_rules + flows |
| `metrics[]` | `Vec<MetricDef>` | no | `v1/02:64`, `command.rs:248` | LITERAL/READ/AGGREGATE/OPERATE/CHOOSE |
| `decisions[]` | `Vec<DecisionDef>` | no | `v1/02:65`, `command.rs:249` | Candidate evaluator |

### TimeRequirement (`v1/13:16-22,49-93`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `observation.scope` | i16 EXECUTION(0)/PLACEMENT(1)/FRAME(2)/CHILDREN(3)/REFERENCE(4) | yes | `v1/13:60-69` | |
| `observation.source` | i16 ACTIVE_SEGMENT(0)/PAUSED_SEGMENT(1)/EXECUTION(2) | yes | `v1/13:74-78` | |
| `observation.aggregate` | i16 TOTAL_DURATION(0)/EACH_DURATION(1)/COUNT(2)/GAP_DURATION(3)/SPAN_DURATION(4) | yes | `v1/13:80-86` | |
| `observation.quantifier` | i16? ALL(0)/ANY(1) | conditional | `v1/13:88-92` | Required for EACH/GAP |
| `required` | `Range<ScalarValue>` | yes | `v1/13:18` | completion gate |
| `preferred` | `Target<ScalarValue>?` | no | `v1/13:19` | placement hint |

### TaskDefinition (`v1/13:122-180`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `id` | UUIDv7 | yes | `v1/13:125` | referenced by Term/Order |
| `content` | `Content` | yes | `v1/13:126` | same shape as Tile.content |
| `show` | `Condition?` | no | `v1/13:127` | null = always visible |
| `complete` | `Condition` | yes | `v1/13:128` | manual check / time / Fact / other |
| `order[]` | `Vec<TaskOrderRule>` | no | `v1/13:129,164-172` | cyclic detection at save |

### Condition (`v1/00-glossary.md:148-156`, `v1/05`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `kind` | ALL/ANY/NOT/TERM | yes | `v1/00:151` | only 4 operators |
| term kinds | TERM sub-variants | when TERM | `v1/05`, `v1/13:96-119` | Reference / Metric / Time / Task / Gap / Calendar |

### SourceSchedule (`command.rs:197-225`, `source_schedule.rs:11-119`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `required_duration_ms` | i64 ms | yes | `source_schedule.rs:14` | total time per occurrence across segments |
| `generation.kind` | i16 OneTime(0)/Recurring(1)/DemandDriven(2) | yes | `source_schedule.rs:25`, HARNESS | |
| `generation.at` | Instant? | conditional | `source_schedule.rs:27` | for OneTime |
| `generation.starts_at` | Instant? | conditional | `source_schedule.rs:29` | for Recurring |
| `generation.interval_ms` | DurationMs? | conditional | `source_schedule.rs:31` | for Recurring |
| `generation.ends_at` | Instant? | no | `source_schedule.rs:33` | null = infinite |
| `generation.weekday_mask` | i8? | no | `source_schedule.rs:34` | bitmask |
| `generation.date_range_start` | String? (date) | no | `source_schedule.rs:36` | ISO date |
| `generation.date_range_end` | String? (date) | no | `source_schedule.rs:38` | ISO date |
| `generation.excluded_dates` | Vec<String> | no | `source_schedule.rs:40` | date strings |
| `generation.offset_min` | i16? | no | `source_schedule.rs:47` | UTC offset, calendar-boundary only |
| `window.start_offset_ms` | i64 ms | yes | `source_schedule.rs:106` | relative to nominal |
| `window.end_offset_ms` | i64 ms | yes | `source_schedule.rs:107` | |
| `split_policy.kind` | i16 Unsplit(0)/Split(1) | yes | `source_schedule.rs:112`, HARNESS | |
| `split_policy.min_segment_ms` | i64? | conditional | `source_schedule.rs:114` | for Split |
| `split_policy.max_segment_ms` | i64? | conditional | `source_schedule.rs:116` | for Split |
| `split_policy.max_segments` | u32? | conditional | `source_schedule.rs:118` | for Split |
| `priority` | i32 | yes | `source_schedule.rs:20` | ordering across sources |

### Recurring (legacy read-only — `v1/08-recurring-and-frame.md:236`, `v1/02-core-entities.md:192`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `life.active.startDate` | LocalDate | yes | `v1/08:26-39` | LocalDate, not Instant |
| `life.active.endDate` | LocalDate? | no | `v1/08:27` | null = infinite |
| `life.state` | i16 ACTIVE(0)/PAUSED(1)/ENDED(2)/CANCELLED(3) | yes | `v1/08:30-37` | |
| `frames[]` | `Vec<FrameRule>` | yes | `v1/02:104`, `v1/08:47-103` | Step/Reference/Calendar/Transform generator |
| `rules[]` | `Vec<RecurringRule>` | yes | `v1/02:105`, `v1/08:156-162` | when/rank/outputs[] |

**Deprecated markers**: `create_tile` rejects `kind=RECURRING` outright (`legacy_recurring_write_removed`); new writes use `kind=SOURCE` (3) and `POST /v1/source-tiles` (`v1/02:190-192`, `v1/14:418-428`).

### Window (`v1/03-time-and-windows.md:73-130`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `id` | UUIDv7 | yes | `v1/03:76` | |
| `owner` | Owner | yes | `v1/03:77` | |
| `kind` | i16 CALENDAR(0)/LABEL_SPAN(1)/PARENT_SPAN(2)/GAP(3) | yes | `v1/03:78-91` | |
| `bounds` | Span | yes | `v1/03:79` | |
| `rules[]` | `Vec<WindowRule>` | no | `v1/03:80` | weekday mask / time / holiday |

### Placement (Span + Source + Inside + Life — `v1/02-core-entities.md:131-204`)

| Field | Type | Required? | Source | Notes |
|---|---|---|---|---|
| `Tile` (id) | UUIDv7 | yes | `v1/02:137` | |
| `Plan` (id) | UUIDv7 | yes | `v1/02:138` | |
| `baseline.span.start` | Instant | yes | `v1/02:141` | start < end |
| `baseline.span.end` | Instant | yes | `v1/02:141` | |
| `baseline.inside.parent` | UUIDv7? | no | `v1/02:142` | nullable |
| `source` | i16 MANUAL(0)/RECURRING(1)/FLOW(2)/IMPORT(3)/SOURCE(4) | yes | `v1/02:165-171` | legacy (1,2,3) read-only; new writes use SOURCE(4) |
| `source.detail` | typed by kind | conditional | `v1/02:184-189` | MANUAL→Stamp / SOURCE→sourceTile+occurrence+split / IMPORT→source+externalId |
| `life.detach` | bool | derived | `v1/02:148` | auto-managed |
| `life.close` | bool | derived | `v1/02:149` | revoked/replaced |

### Annotation / Memo

- **Memo**: lives on Tile via `AttachMemo` CommandKind(29); payload `AttachMemoPayload` (`command.rs:29`) — not in scope of SourceSchedule definition
- **Annotation**: separate domain object, see `crates-v1/domain/src/aggregate.rs` — spec is silent on field list in `v1/02..14`; deferred

## Endpoint table (`v1/14-read-model-and-endpoint.md`, `crates-v1/api/src/main.rs:258-710`)

| Method | Path | Payload / Response struct | Owner/Auth |
|---|---|---|---|
| POST | `/v1/tiles` | `CreateTilePayload` (`command.rs:178`) | actor owner |
| POST | `/v1/tiles/{tileId}/plan` | `SetPlanPayload` (`command.rs:241`) | tile owner |
| POST | `/v1/tiles/{tileId}/update` | `UpdateTilePayload` | tile owner |
| POST | `/v1/tiles/{tileId}/start` | `StartTilePayload` | tile owner |
| POST | `/v1/source-tiles` | `CreateSourceTilePayload` (`command.rs:197`) | actor owner |
| GET | `/v1/source-tiles/{id}` | `SourceTileView` | tile owner |
| PUT | `/v1/source-tiles/{id}` | `UpdateSourceTilePayload` (`command.rs:212`) | tile owner |
| POST | `/v1/source-tiles/{id}/reflow` | `ReflowSourceTilePayload` (`command.rs:227`) | tile owner |
| POST | `/v1/source-tiles/{id}/cancel` | `CancelSourceTilePayload` (`command.rs:234`) | tile owner |
| GET | `/v1/source-tiles/{id}/placements` | `PlacementView[]` | tile owner |
| GET | `/v1/source-tiles/{id}/completion` | `CompletionReportView` | tile owner |
| POST | `/v1/placements` | `CreatePlacementPayload` (`command.rs:252`) | tile owner (legacy manual only) |
| POST | `/v1/placements/{id}/changes` | `AppendChangesPayload` (`command.rs:271`) | placement owner |
| POST | `/v1/schedule-definitions` | `PublishScheduleDefinitionPayload` (CommandKind 30) | actor owner (atomic tile+plan+source-schedule) |
| POST | `/v1/sessions` | `CreateSessionPayload` | actor owner |

The full route table is **152 entries** in `crates-v1/api/src/main.rs:258-710`; only the tile/placement-creation subset is enumerated above. Auth contract: `crates-v1/api/src/handlers/common.rs:733` returns bearer→bridge→x-owner-id in priority order; bridge requires `x-tastile-web-bridge-secret` + `x-tastile-web-session-user`.

## Envelope (`v1/14-read-model-and-endpoint.md:26-50`, `command.rs:25-58`)

```
CommandRequest<T>
├─ expectedRevision  Option<i64>
├─ idempotencyKey    UUIDv7
├─ occurredAt        Option<Instant>     (server overwrites)
└─ payload           T

CommandResponse
├─ commandId         UUIDv7
├─ acceptedAt        Instant
├─ aggregate         Option<AggregateRef>
├─ revision          Option<i64>
├─ result            i8   (APPLIED=0 / ALREADY_APPLIED=1 / ACCEPTED=2)
├─ pending           Vec<PendingWork>
└─ aggregateMeta     Option<AggregateMeta>     // server-assigned sub-IDs

AggregateMeta (Option per field, server fills only what the command produced)
├─ tile_id           Option<UUIDv7>
├─ plan_id           Option<UUIDv7>
├─ recurring_id      Option<UUIDv7>
├─ frame_rule_id     Option<UUIDv7>
├─ changeset_id      Option<UUIDv7>
├─ change_ids        Vec<UUIDv7>
├─ window_ids        Vec<UUIDv7>
├─ flow_ids          Vec<UUIDv7>
├─ source_tile_id    Option<UUIDv7>
├─ occurrence_ids    Vec<UUIDv7>
└─ placement_ids     Vec<UUIDv7>
```

Source: `command.rs:25-80`, `command.rs:82-87`. Per `v1/14:46-62`, `result=ACCEPTED(2)` does NOT mean write-pending; the write IS committed atomically with revision, Domain Event, Outbox Event in one TX (`v1/10 §4`).

`ApiError` (8 kinds): `v1/14:64-83` — `VALIDATION=0 / FORBIDDEN=1 / STALE_REVISION=2 / IDEMPOTENCY_KEY_REUSED=3 / NOT_FOUND=4 / CONFLICT=5 / BLOCKED=6 / RETRYABLE=7`.

## USECASE excerpts (verbatim, file:line cited)

`docs/USECASE.md:3-22` — 判定区分:

```
USECASE は v1 仕様 (v1/) を満たすシステムを構築する上で、確認すべきシナリオの集合である。
ここでは番号 01..30 を 4 つの判定区分に分類する:
  - 時刻・期間境界 (01..06)
  - 変更競合・分割 (07..12)
  - 完了・実行 (13..25)
  - 判断・自動調整 (26..30)
```

`docs/USECASE.md:85-122` — 03 5時間ごとの定期処理を日付境界・並列Worker越しに具体化する:

```
前提:
  - 1 Recurring に 1 StepGenerator (5時間ステップ)
  - 1 Recurring に対し 2 ワーカーが並列実行
  - 起点は 2026-01-01 00:00:00 UTC
  - 1日境界 (Asia/Tokyo 09:00 = UTC 00:00) 跨ぎを含む

期待:
  - Frame は (recurringTileId, frameRuleId, rangeStart) で一意
  - 同一 Frame が 2 ワーカーから二重生成されない
  - 1日跨ぎ Frame は UTC で連続生成される (日付跨ぎの offset は所有者プロファイルが指定)
  - Materialization は Placement を破壊的に更新しない
```

## SCHEDULE excerpts (verbatim, file:line cited)

`docs/SCHEDULE.md:3-22` — 1. 目的:

```
ユーザーの「いつ・なに・どれくらい」を 1 つの時刻-Placement-Source-Change 構造で表現する。
Phase A の核は (1) Time / Window を第一級に置く (2) ChangeSet を Key 構造にする
(3) Effective 解決をクライアントに持ち込まない、の 3 点。
```

`docs/SCHEDULE.md:40-114` — 2.3 条件の種類 / 2.4 / 2.5:

```
### 固定予定
  開始 / 終了 が決まっている Placement。ChangeSet で移動しない。

### 時間窓付き必須予定
  Window(kind=CALENDAR) の中に必ず置く。失敗時は Decision/Session へ通知。

### 期限付き必須予定
  end 時刻までに必ず完了。Window(kind=LABEL_SPAN) または endSpan。

### 推奨条件
  preferred で placement hint を提供。守れなくても即ブロックしない。

### 条件付き生成予定
  SourceTile.generation.weekday_mask / excluded_dates / ends_at / interval_ms
  で生成時刻を調整。Condition は FrameRule.active ではなく Plan.completion.root に書く。

### 推奨条件を守れない場合
  Flow が候補を提示。Decision 経由でユーザー判断。

### 必須条件を守れない場合
  ApiErrorKind::BLOCKED(6) で violations 付き返却。クライアントは独自補正しない。
```

## Fields the docs explicitly mark deprecated / not-supported

| Field / concept | Marked by | Reason |
|---|---|---|
| `v7_tiles / v7_intent_nodes / v7_demand_templates / v7_condition_atoms` | `v1/00:325-339` | banned legacy; use `tile / plan_definition / condition_set / placement / execution` |
| `6軸 enum (Measure/Trigger/Domain/Transform/Satisfaction/Propagation)` | `v1/00:330` | decomposed into `Window / Span / Range / Condition / Metric / ChangeSet` |
| `TickOutput / TickResult / TickResultEffects` | `v1/00:331` | replaced by synchronous `Effective*` resolution + async `Work Item` |
| `Projector / Compiler / DemandGenerator / Solver / Materializer / Arbiter / RuntimeController` pipeline | `v1/00:332` | replaced by `resolver + Worker(MaterializeFrame / RecalculateMetric / EvaluateFlow)` |
| `PlacementScore` (11 fields) | `v1/00:336` | replaced by `violations + state` |
| `NoActionReason` (6 variants) | `v1/00:337` | replaced by `work_item.last_error_kind + failed_at` |
| `isMovable / isFixed / isOverlapAllowed / weekdayOnly / recordingPolicy` | `v1/00:338` | replaced by `PlacementRule / Condition / ChangeSet` |
| `sleepDebt / fatigue / breakMode / examWeekMode / holidaySchedule / napRule / studyBoost` | `v1/00:339` | not stored; derived from `Metric / Flow / Window / Condition` |
| `kind=RECURRING` in `CreateTilePayload` | `command.rs:178-195` (handler-level reject), `v1/02:190-192` | `legacy_recurring_write_removed`; new use `kind=SOURCE(3)` |
| `PlacementSource.RECURRING(1) / FLOW(2)` for new writes | `v1/02:190-192` | legacy read-only compatibility; new use `SOURCE(4)` |
| `target_rest_min / rest_mode / napRule / examWeekMode` | `v1/10 §9`, `v1/00:339`, `v1/03:181-185` | forbidden; use `Window(GAP) + Flow` |
| `weekdayOnly / holidaySkip` flags | `v1/03:27`, `v1/10 §10` | forbidden; use `Window.CALENDAR` rules |
| `metadata_json / condition_json / payload_json` | `v1/10 §2` | forbidden in source-of-truth tables; normalize to child tables |
| `completed: boolean` on Plan/Placement/Execution | `v1/13:206-228`, `v1/10 §7` | forbidden; use `CompletionResult` derived value |
| `completed_at / started_at / status` on Tile | `HARNESS §1-1` | forbidden; Tile holds no derived values |
| `Domain Unit` test using DB or clock | `v1/10 §11`, HARNESS §3-6 | forbidden; pure tests only |

## Source line index

- Core spec files: `tastile-core/v1/{00..15}-*.md` (16 files, listed in `v1/HARNESS.md` and `v1/00:6-15`)
- Rust source-of-truth payload structs: `tastile-core/crates-v1/domain/src/command.rs:1-340`, `tastile-core/crates-v1/domain/src/source_schedule.rs:1-200`, `tastile-core/crates-v1/domain/src/completion.rs` (Completion type)
- USECASE: `tastile-core/docs/USECASE.md:1-1158` (30 numbered scenarios across 4 判定区分)
- SCHEDULE: `tastile-core/docs/SCHEDULE.md:1-1572` (§1 目的 / §2 条件 / §3..25 章別 / 時刻 + 期限 + 推奨 + 条件付き)
- Auth + envelope: `tastile-core/crates-v1/api/src/handlers/common.rs:733-823`, `tastile-core/crates-v1/domain/src/command.rs:25-80`
- Route table: `tastile-core/crates-v1/api/src/main.rs:258-710` (152 entries)
- HARNESS / CLAUDE.md: `tastile-core/HARNESS.md` §1-5, `tastile-core/v1/HARNESS.md` (shortest-map index)

Field-row count: **82 rows** across 9 entity tables. USECASE + SCHEDULE excerpts verbatim. No invented fields; spec-silent positions are marked explicitly.