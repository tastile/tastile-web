# SourceTile wire parity matrix

Status: in progress. This document is the required comparison gate before
changing `source-tiles.ts` / `schedule-definition.ts` wire types. Audit
baseline: `tastile-core` `release-2-1-0` @ `717de7da` (domain serde structs in
`crates-v1/domain/src/`).

| Core domain / OpenAPI | Required JSON wire shape | TypeScript wire type | Status |
| --- | --- | --- | --- |
| `CreateSourceTilePayload` (command.rs:273) | `source_client_local_id?, tile, plan, flows, relations?, schedule, horizon` | `SourceTileCreatePayload` | verified — optional `source_client_local_id` / `relations` added |
| `UpdateSourceTileBody` (api handlers/source_tiles.rs:52) | same body as create; `source_tile_id` is path-derived, never in payload | `SourceTileUpdatePayload` | verified |
| `SourceGeneration` (source_schedule.rs:24) | numeric `kind` 0–3; nullable `at, starts_at, interval_ms, ends_at, weekday_mask, date_range_start, date_range_end`; optional `excluded_dates`, `offset_min`, `monthly_rule` | `SourceGenerationWire` | verified — `kind` widened to `0\|1\|2\|3`, `offset_min` / `monthly_rule` added |
| `MonthlyRule` (source_schedule.rs:58) | `kind` 0=by_day / 1=by_weekday + `day_of_month` / `week_of_month`+`weekday` | `SourceMonthlyRuleWire` | verified |
| `SourceWindow` (source_schedule.rs:154) | `start_offset_ms, end_offset_ms` | `SourceScheduleWire.window` | verified |
| `SplitPolicy` (source_schedule.rs) | numeric `kind`; nullable `min_segment_ms, max_segment_ms, max_segments` | `SourceScheduleWire.split_policy` | verified |
| `SchedulePlanDefinition` (command.rs:525) | `role, references, completion, planning, metrics, decisions` | `SourceTilePlanWire` | verified top-level |
| `ReferenceDef` (aggregate.rs:137) | `id, target: TargetSelector, pick, when` | `SourceReferenceWire` | verified — `TargetSelector` is a `numeric_enum!` (0–3), wire value is a number |
| `Completion` / `TimeRequirement` / `TaskDefinition` (completion.rs) | `root, time_requirements, tasks` / `id, observation, required, preferred` / `id, content, show, complete, order` | `SourceCompletionWire` etc. | verified top-level |
| `Planning` / `PlacementRule` / `NestingRule` (nesting.rs) | `placement_rules, nesting_rules` / `id, when, rank, effect` / `id, direction, when, rank, target, scope` | `SourcePlacementRuleWire`, `SourceNestingRuleWire` | verified fields |
| `Condition` / `Term` (condition.rs:14,55) | externally tagged `All, Any, Not, Term`; `Calendar, Moment, Relation, Gap, Requirement, Task, Fact, Metric, Feedback, Life` | `SourceConditionWire`, `SourceTermWire` | partially verified — top-level tags confirmed; per-variant payload fields still require line-level audit |
| `CalendarTerm.offset_min` (condition.rs) | optional local offset, `Option<i16>` | `SourceCalendarTermWire.offset_min` | verified |
| `MetricDef` / `ScalarExpression` (aggregate.rs:122, metric.rs) | `id, output, expression, limit` | `SourceMetricWire`, `SourceScalarExpressionWire` | partially verified — `ScalarExpression` variant payloads unaudited |
| `DecisionDef` / `CandidateEffect` / `InteractionTree` (aggregate.rs:130, decision.rs) | `id, observe, when, candidates, reuse, dialog` | `SourceDecisionWire`, `SourceCandidateEffectWire`, `SourceInteractionNodeWire` | partially verified — nested dialog/input variants unaudited |
| `ChangeRule` / `ChangeValue` / `TargetRef` (aggregate.rs:298+) | `change_layer, id, target, kind, key, value, source, source_ref, rank` | `SourceChangeRuleWire` | verified — `change_layer` added (serde default `Placement`) |
| `FlowDefinition` / `ScheduleFlowSignal` (command.rs:430,561) | `observes, when, candidates`; signals are plain string variants | `SourceFlowDefinitionWire` | verified — `ScheduleFlowSignal` serializes as `"PlacementCreated"` etc. |
| `ScheduleFlowOutputDefinition` (command.rs:589) | externally tagged `ProposeNewPlanPlacement` / `ProposeNewPlanPlacementSequence` / `ProposeChangeWithCompanions` | `SourceFlowDefinitionWire` outputs, `PublishScheduleDefinitionPayload.flows` outputs | verified — third variant and `sequence_steps[].target_plan_id` added to both files |
| `SourceRelationDefinitionPayload` (command.rs:665) | `client_local_id, subject/referenced_source_ref (kind-tagged), kind, point, offset_ms, ordering, duration_expression (kind-tagged), split_policy, correlation_scope, lifecycle_filter, eligible_through_revision, summary_priority` | `SourceRelationDefinitionWire`, `PublishScheduleDefinitionPayload.relations` | verified — `duration_expression` fixed to `{kind:"fixed"|"reference_span"}`; phantom `"SubjectSpan"` variant removed |
| Source read (`SourceTileRead`, detail) | `source, relations, occurrences, placements` pages | openapi-generated `components["schemas"]` | verified via generated types — strict decoder still pending |

## Date-specific timetable design (not yet publicly exposed in Web)

A normal timetable Source and a date-specific special Source are separate
SourceTiles. The client must not expand recurrence locally or mutate a normal
Source into a special day.

### Exact Core serde input

`domain/src/source_schedule.rs::SourceGeneration` accepts these fields:

```json
{
  "kind": 1,
  "at": null,
  "starts_at": "2026-07-01T00:00:00Z",
  "interval_ms": 604800000,
  "ends_at": null,
  "weekday_mask": 1,
  "date_range_start": "2026-06-10",
  "date_range_end": "2026-08-10",
  "excluded_dates": ["2026-07-16"],
  "offset_min": 540
}
```

All absolute instants are UTC. `weekday_mask` is the Core generation filter;
`date_range_start` is inclusive and `date_range_end` is exclusive in the
current Core filter. A monthly Source uses `"kind": 3` with `monthly_rule`
(`{"kind":0,"day_of_month":N}` or `{"kind":1,"week_of_month":N,"weekday":N}`)
and must omit `monthly_rule` for every other kind. A date-specific exceptional
slot uses a distinct Source with `kind: 0`, its UTC `at`, and the same explicit
null fields for the recurring-only members. Its horizon is supplied as
`{ "start", "end" }` UTC.

To exclude the exceptional date from the normal Source, send its ISO civil
date in `excluded_dates` on that normal Source and reflow it through the
authenticated Source API. The exclusion is persisted server-side as typed
rows; browser filtering is not equivalent.

### API/OpenAPI and acceptance gap

`api/src/openapi.rs::SourceGenerationSchema` documents the calendar filter
fields and optional `excluded_dates` (default `[]`). Web create/update remain
unavailable until the complete Plan wire DTO consumers (#276–#278) land.

A future authenticated public-API fixture must prove:

1. normal Source produces only its UTC/offset-filtered weekday occurrences;
2. special Source produces exactly its exceptional occurrence;
3. the normal Source excludes that date through a server-owned canonical
   representation, not browser filtering;
4. read/reflow preserve Source → Occurrence → Placement identities and history.
