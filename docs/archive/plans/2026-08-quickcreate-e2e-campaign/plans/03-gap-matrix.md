# 03 — Gap Matrix: Domain Spec × QuickCreate Coverage

Side A: `01-domain-spec-fields.md`. Side B: `02-ui-coverage-audit.md`. This file is the merged matrix that drives sub-project A–F.

## Full entity × wire-status matrix

| Domain field | Type | Source | UI affordance | Wire status | Action |
|---|---|---|---|---|---|
| `Tile.id` | UUIDv7 | v1/02:30 | — | ✓ server | — |
| `Tile.kind` | i16 (RECURRING=0/PLACEMENT=1/EXECUTION=2/SOURCE=3) | v1/02:31,42-46 | `identity.kind` | ✓ | — |
| `Tile.owner` | Owner ref | v1/02:32 | — | ⚠ header-derived | H |
| `Tile.externalId` | String? | v1/02:33 | `identity.externalId` | ✓ | — |
| `Tile.content.title` | String | v1/02:35 | `identity.title` | ✓ | — |
| `Tile.content.description` | String? | v1/02:35 | `identity.description` + `meta.memo` fallback | ✓ (memo folded) | — |
| `Tile.visual.color` | hex? | v1/02:36 | `identity.visual.color` | ✓ | — |
| `Tile.visual.icon` | String? | v1/02:36 | `identity.visual.icon` | ✓ | — |
| `Tile.frame_rule` | FrameRuleDef? | command.rs:194 | — (frame rules live in §5/§6) | ⚠ THROW | D |
| `Plan.role` | i16 EXECUTABLE/LABEL | v1/02:60,73-77 | `plan.role` (+ `meta.isLabelOnly` mirror) | ✓ | — |
| `Plan.references[]` | Vec<ReferenceDef> | v1/02:61 | `plan.references[]` | ✓ (UUID-only, no Reference editor) | A |
| `Plan.completion` | Completion | v1/02:62, v1/13 | `plan.completion.{root,timeRequirements[],tasks[]}` | ✓ | — |
| `Plan.completion.root` | Condition | v1/13:11 | `plan.completion.root` | ✓ (UI present, basic editor) | E |
| `Plan.completion.timeRequirements[]` | Vec<TimeRequirement> | v1/13:12 | `plan.completion.timeRequirements[]` | ✓ (1 default only, editor missing) | E |
| `Plan.completion.tasks[]` | Vec<TaskDefinition> | v1/13:13 | `plan.completion.tasks[]` | ✓ (1 default only, editor missing) | E |
| `Plan.planning.{placement_rules,nesting_rules}` | rules | v1/02:63, v1/09 | `plan.placementRules / nestingRules` | ✓ | — |
| `Plan.planning.flows[]` | Flow[] | v1/02:63, v1/09 | `plan.planning.flows[]` | ⚠ THROW (wire-builder:249-257) | D |
| `Plan.metrics[]` | Vec<MetricDef> | v1/02:64 | `plan.metrics[]` (UUID-only) | ✓ (no Metric editor) | E |
| `Plan.decisions[]` | Vec<DecisionDef> | v1/02:65 | `plan.decisions[]` (UUID-only) | ✓ (no Decision editor) | E |
| `TimeRequirement.{observation.scope,source,aggregate,quantifier}` | i16 | v1/13:60-92 | — (collapsed into single default) | ✗ | E |
| `TimeRequirement.required / preferred` | Range / Target | v1/13:18-19 | `time.durationMinMax.{min,max}` for required; `source.preferredDurationMinMax` for preferred | ✓ (mapped to required) | — |
| `TaskDefinition.{id,content,show,complete,order[]}` | tree | v1/13:122-180 | — (1 default "Mark done") | ✗ | E |
| `Condition` (ALL/ANY/NOT/TERM) | AST | v1/05:11-32 | `plan.completion.root`, `recurring.condition` | ✓ (basic tree) / ✗ (no editor) | E |
| `SourceSchedule.required_duration_ms` | i64 | source_schedule.rs:14 | `time.durationMinMax` | ✓ | — |
| `SourceSchedule.generation.kind` | i16 OneTime/Recurring/DemandDriven | source_schedule.rs:25 | `recurring.repeatMode` | ✓ (mapped) | — |
| `SourceSchedule.generation.at` | Instant? | source_schedule.rs:27 | `time.span.start` (OneTime) | ✓ (when set) | — |
| `SourceSchedule.generation.starts_at` | Instant? | source_schedule.rs:29 | `recurring.life.active.startDate` | ✓ | — |
| `SourceSchedule.generation.interval_ms` | DurationMs? | source_schedule.rs:31 | `recurring.intervalValue/Unit` | ✓ | — |
| `SourceSchedule.generation.ends_at` | Instant? | source_schedule.rs:33 | `recurring.endDate` | ✓ | — |
| `SourceSchedule.generation.weekday_mask` | i8? | source_schedule.rs:34 | `recurring.weekdayMask` | ✓ | — |
| `SourceSchedule.generation.date_range_start/end` | String? (date) | source_schedule.rs:36,38 | `recurring.life.active.{startDate,endDate}` | ✓ | — |
| `SourceSchedule.generation.excluded_dates` | Vec<String> | source_schedule.rs:40 | `source.excludedDates` | ✓ | — |
| `SourceSchedule.generation.offset_min` | i16? | source_schedule.rs:47 | `source.offsetMin` | ✓ | — |
| `SourceSchedule.window.start_offset_ms / end_offset_ms` | i64 | source_schedule.rs:106-107 | — (computed from `time.span`) | ✓ implicit | — |
| `SourceSchedule.split_policy.{kind,min_segment_ms,max_segment_ms,max_segments}` | enum+i64+u32 | source_schedule.rs:112-118 | `source.splitPolicy` (kind only) | ⚠ partial | C |
| `SourceSchedule.priority` | i32 | source_schedule.rs:20 | `source.priority` | ✓ | — |
| `Recurring.life.active.{startDate,endDate}` | LocalDate? | v1/08:26-39 | `recurring.life.active.{startDate,endDate}` | ✓ | — |
| `Recurring.life.state` | i16 ACTIVE/PAUSED/ENDED/CANCELLED | v1/08:30-37 | — | ✗ | C |
| `Recurring.frames[]` (StepGenerator / ReferenceGenerator / CalendarGenerator / TransformGenerator) | Vec<FrameRule> | v1/02:104, v1/08:47-103 | `recurring.frameRules[]` | ⚠ THROW | D |
| `Recurring.rules[]` (RecurringRule) | Vec | v1/02:105, v1/08:156-162 | `recurring.rules[]` | ⚠ THROW | D |
| `FrameRule.active` (dynamic Condition) | Condition? | v1/08:54, v1/05 | `recurring.condition` | ✗ SILENT DROP | E |
| `StepGenerator.{step,origin,bounds}` | tree | v1/08:71-73 | — (only `step` mapped from intervalValue/Unit) | ⚠ partial | C |
| `ReferenceGenerator.{referenceId,align}` | tree | v1/08:80-82 | — | ✗ | C |
| `CalendarGenerator.{unit,weekdayMask,holidayKind}` | tree | v1/08:97-101 | `recurring.weekdayMask` (weekday only) | ⚠ partial | C |
| `Window` (kind, bounds, rules, referenceId) | discriminated | v1/03, v1/08 | `windows[]` | ✓ via `publishWindows()` (generic) | B |
| `Flow` | tree | v1/02 | `source.flowSequences[]` (atomic) + `plan.planning.flows[]` (legacy) | ✓ / ⚠ THROW | D |
| `Condition` editor (10 Term kinds, EvaluationContext binding) | AST | v1/05:40-52, v1/05:11-32 | none | ✗ | E |
| `Reference.{id,target,pick}` (EXACT/SERIES/FILTER/CONTEXT × ALL/FIRST/LAST/BEFORE/AFTER) | tree | v1/05:121-167 | `plan.references[]` (UUID-only) | ⚠ IDs only | A |
| `Metric.{id,output,expression,limit}` (LITERAL/READ/AGGREGATE/OPERATE/CHOOSE + ScalarExpression + Range) | tree | v1/05:194-230 | `plan.metrics[]` (UUID-only) | ⚠ IDs only | E |
| `Decision.*` | tree | v1/06 | `plan.decisions[]` (UUID-only) | ⚠ IDs only | E |
| `ChangeSet` (any layer — RECURRING / PLACEMENT / EXECUTION / SOURCE) | Key(group,item,part) + value | v1/04 | `advanced.changeSets[]`, `advanced.rules[]` | ⚠ THROW | D |
| `Annotation / Memo` | row | v1/02:35, USECASE | `meta.memo` | ✓ (folded into description) | — |
| `Attachment` | row | (none in v1/*) | — | ✗ | — |
| `Project / Tags` (arbitrary text) | n/a | (none in v1/*) | `meta.project`, `meta.tags[]` | ⚠ THROW | F |
| `Tile.externalId` UUIDv5 mismatch | — | v1/02:34 vs web | raw string | ⚠ schema drift | A |

## Gap summary

### A. THROW sites (need removal, demotion, or wire expansion)

| Field | Wire-builder line | Reason in code |
|---|---|---|
| `meta.project` / `meta.tags[]` | `quick-create-schedule-wire.ts:240-242` | "projects and tags are not supported by atomic schedule publish" |
| `advanced.changeSets[]` / `advanced.rules[]` | `quick-create-schedule-wire.ts:246-248` | "advanced change rules are not supported" |
| `recurring.frameRules[]` / `recurring.rules[]` / `plan.planning.flows[]` | `quick-create-schedule-wire.ts:249-257` | "legacy recurring and flow rules are not supported by SourceScheduleDefinition" |

### B. SILENT DROP (no throw, no wire slot — data loss)

| Field | Where |
|---|---|
| `recurring.condition` (FrameRule.active dynamic Condition) | `quick-create-schedule-wire.ts` (no `condition` slot in payload) |

### C. Domain fields with NO UI affordance

| Sub-system | Missing fields |
|---|---|
| Recurring / SourceSchedule | `Recurring.life.state` machine, `StepGenerator.origin / bounds`, `ReferenceGenerator.{referenceId,align}`, `CalendarGenerator.{unit,holidayKind}` |
| Placement | `source` override, `baseline.inside` (parent picker), `life.detach` / `life.close` |
| Condition | 10 Term kinds (Reference / Metric / Time / Task / Gap / Calendar), EvaluationContext binding, ALL/ANY/NOT composition editor |
| Reference editor | target EXACT/SERIES/FILTER/CONTEXT, pick ALL/FIRST/LAST/BEFORE/AFTER |
| Metric editor | LITERAL/READ/AGGREGATE/OPERATE/CHOOSE + ScalarExpression + Range |
| Decision editor | decision tree editor |
| ChangeSet editor | at any layer |
| Window | discriminator kind/rules/referenceId |
| Attachment | uploader |

### D. Schema observations

- QuickCreate wire emits `POST /v1/schedule-definitions` (SourceScheduleDefinition atomic envelope, `v1/02:321-328`, `v1/14:419-428`). It does **not** expose legacy Recurring / Tile / Placement chains (`quick-create-schedule-wire.ts:362` hardcodes `recurrence: null`).
- Per `v1/02:190-192` "v0.5.3 以降の commitment", `placement_source IN (1,2,3)` legacy writers are no longer accepted. QuickCreate is on the canonical path.
- `Tile.externalId` typed as `String?` in spec (`v1/02:33`), web passes raw UUIDv7 string. Validator on core may or may not coerce. Sub-project A should confirm.