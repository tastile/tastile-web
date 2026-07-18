# SourceTile wire parity matrix

Status: in progress. This document is the required comparison gate before
changing `source-tile-wire.ts`.

| Core domain / OpenAPI | Required JSON wire shape | Planned TypeScript wire type | Status |
| --- | --- | --- | --- |
| `CreateSourceTilePayload` | `tile, plan, flows, schedule, horizon` | `SourceTileCreateWire` | pending |
| `UpdateSourceTilePayload` | `source_tile_id` is path-derived; body has `tile, plan, flows, schedule, horizon` | `SourceTileUpdateWire` | pending |
| `SourceGeneration` | numeric `kind`; nullable `at, starts_at, interval_ms, ends_at, weekday_mask, date_range_start, date_range_end` | `WireSourceGeneration` | verified |
| `SourceWindow` | `start_offset_ms, end_offset_ms` | `WireSourceWindow` | verified |
| `SplitPolicy` | numeric `kind`; nullable segment limits | `WireSplitPolicy` | verified |
| `SchedulePlanDefinition` | `role, references, completion, planning, metrics, decisions` | `SourceTilePlanWire` | mismatch — command.rs:399; current type is incomplete |
| `ReferenceDef` | `id, target: TargetSelector, pick, when` | `WireReferenceDef` | mismatch — aggregate.rs:114; target is enum, not numeric i16 |
| `Completion` | `root, time_requirements, tasks` | `WireCompletion` | verified top-level — completion.rs:8 |
| `TimeRequirement` | `id, observation, required, preferred` | `WireTimeRequirement` | verified fields — completion.rs:29 |
| `TaskDefinition` | `id, content, show, complete, order` | `WireTaskDefinition` | verified fields — completion.rs:39 |
| `Planning` | `placement_rules, nesting_rules` | `WirePlanning` | verified top-level — command.rs:407 |
| `PlacementRule` | `id, when, rank, effect` | `WirePlacementRule` | verified fields — nesting.rs:13 |
| `NestingRule` | `id, direction, when, rank, target, scope` | `WireNestingRule` | verified fields — nesting.rs:26 |
| `Condition` | externally tagged `All, Any, Not, Term` | `WireCondition` | verified — condition.rs:14 |
| `Term` | externally tagged `Calendar, Moment, Relation, Gap, Requirement, Task, Fact, Metric, Feedback, Life` | `WireTerm` | mismatch — condition.rs:48; payload variants need exact audit |
| `MetricDef` | `id, output, expression, limit` | `WireMetricDef` | mismatch — aggregate.rs:122; ScalarExpression variants unaudited |
| `DecisionDef` | `id, observe, when, candidates, reuse, dialog` | `WireDecisionDef` | mismatch — aggregate.rs:130; nested variants unaudited |
| `FlowDefinition` | `observes, when, candidates` | `WireFlowDefinition` | specification-blocked — command.rs:458; API/OpenAPI uses textual Rust enum variants, while v1/10 requires fixed kinds numeric; no numeric registry is defined |
| `ScheduleFlowSignal` | textual serde enum variants in domain/OpenAPI | no client DTO | specification-blocked — command.rs:430 and openapi.rs:737; do not infer numeric values |
| `ScheduleFlowOutputDefinition` | `ProposeNewPlanPlacement(NewPlanProposalDefinition)` externally tagged | no client DTO | mismatch — command.rs:447; current numeric claim is unsupported |
| Source read | `source, occurrences, placements` with numeric state/revision and split identity | strict read decoder | pending — openapi.rs:826-875 |
