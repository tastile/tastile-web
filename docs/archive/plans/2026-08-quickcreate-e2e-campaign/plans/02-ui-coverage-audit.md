# 02 — UI Coverage Audit: QuickCreate + Submit Pipeline (current state)

Snapshot date: 2026-08-03. Scope: `tastile-web`'s create panel and its write path to core, as it exists today. No recommendations.

## 1. Submit pipeline

```
QuickCreate.tsx                (handleSubmit)
   │  identity / plan / time / windows / recurring / source / advanced / meta
   ▼
shared/api/v1/submit.ts:47     submitCreateTile(options)
   │  reads useQuickCreateStore.getState()
   ▼
shared/api/v1/quick-create-schedule-wire.ts:213
                              buildQuickCreateSchedulePayload(state)
   │  validates + emits PublishScheduleDefinitionPayload
   │  ⚠ THROWS at lines 240-242 / 246-248 / 249-257 if stub fields populated
   ▼
shared/api/v1/schedule-definition.ts:212
                              publishScheduleDefinition({client, payload})
   │  wraps payload in envelope<T> = {expectedRevision:null, idempotencyKey, occurredAt, payload}
   ▼
endpoints.ts: sendCommand(client, "POST", "/v1/schedule-definitions", envelope)
   │
   ▼
POST /v1/schedule-definitions  (core: SourceScheduleDefinition atomic envelope)
```

Edit-mode branch (`submit.ts:65-112` `submitUpdateTile`):

```
QuickCreate.tsx (editing state)
   ▼
submitUpdateTile
   ├─ updateTileCommand  → POST /v1/tiles/{id}/update      (identity fields only)
   └─ updatePlacementChanges → POST /v1/placements/{id}/changes
                              (only when state.time.span.start && state.time.span.end)
```

## 2. Form sections + field table

Field paths from `quick-create-store.ts`. Wire status from `quick-create-schedule-wire.ts:213-450`.

| Section | Field | Type | Store path | Wire status |
|---|---|---|---|---|
| §1 Identity | kind | `0\|1\|2` | `identity.kind` | ✓ `tile.kind` via payload |
| §1 Identity | title | string | `identity.title` | ✓ `tile.title` (required) |
| §1 Identity | description | string\|null | `identity.description` | ✓ `tile.description` |
| §1 Identity | externalId | string\|null | `identity.externalId` | ✓ `tile.external_id` |
| §1 Identity | color | hex | `identity.visual.color` | ✓ `tile.color` |
| §1 Identity | icon | string | `identity.visual.icon` | ✓ `tile.icon` |
| §2 Plan | role | `0\|1` | `plan.role` | ✓ `plan.role` |
| §2 Plan | references[] | array | `plan.references[]` | ✓ with `reference_targets` derived |
| §2 Plan | completion.{root,timeRequirements,tasks} | tree | `plan.completion.*` | ✓ `plan.completion` |
| §2 Plan | planning.{placement,nesting} rules | array | `plan.planning` | ✓ `plan.planning.{placement_rules,nesting_rules}` |
| §2 Plan | planning.flows[] | array | `plan.planning.flows` | ⚠ THROW (wire-builder:249-257) |
| §2 Plan | metrics[] | array | `plan.metrics` | ✓ verbatim |
| §2 Plan | decisions[] | array | `plan.decisions` | ✓ verbatim |
| §3 Time | span.{start,end} | ISO | `time.span.*` | ✓ drives horizon + window |
| §3 Time | durationMinMax | {minMs,maxMs} | `time.durationMinMax.*` | ✓ `required_duration_ms` (must match a timeRequirement, throw at 263-268) |
| §3 Time | whenMode / timeOfDay\* | mixed | `time.*` | ✓ drives authoredInstant() |
| §3 Time | referenceId / label | mixed | `time.reference*` | partial — only referenced indirectly |
| §4 Windows | windows[] | `Window[]` | `windows[]` | ✓ via `publishWindows()` (wire-builder:141-189) |
| §5 Recurring | repeatMode | `0..4` | `recurring.repeatMode` | ✓ maps to generation.kind (0/1/2) |
| §5 Recurring | weekdayMask | number | `recurring.weekdayMask` | ✓ `generation.weekday_mask` |
| §5 Recurring | endDate | ISO | `recurring.endDate` | ✓ `generation.ends_at` |
| §5 Recurring | intervalValue/Unit | mixed | `recurring.interval*` | ✓ `generation.interval_ms` |
| §5 Recurring | life.active.{startDate,endDate} | ISO | `recurring.life.active.*` | ✓ `date_range_{start,end}` |
| §5 Recurring | frameRules[] | array | `recurring.frameRules[]` | ⚠ THROW (wire-builder:249-257) |
| §5 Recurring | rules[] | array | `recurring.rules[]` | ⚠ THROW (wire-builder:249-257) |
| §5 Recurring | condition | `ConditionNode\|null` | `recurring.condition` | ✗ silent drop (no slot in payload) |
| §5 Source | offsetMin | number | `source.offsetMin` | ✓ `generation.offset_min` |
| §5 Source | excludedDates[] | Date[] | `source.excludedDates` | ✓ `generation.excluded_dates` |
| §5 Source | preferredDurationMinMax | {min,max} | `source.preferredDurationMinMax` | ✓ merged into timeRequirements[0].preferred |
| §5 Source | splitPolicy | object | `source.splitPolicy` | ✓ `source_schedule.split_policy` |
| §5 Source | priority | number | `source.priority` | ✓ `source_schedule.priority` |
| §5 Source | relations[] | array | `source.relations[]` | ✓ top-level `relations[]` |
| §5 Source | flowSequences[] | array | `source.flowSequences[]` | ✓ top-level `flows[]` |
| §6 Advanced | changeSets[] | `ChangeRule[]` | `advanced.changeSets[]` | ⚠ THROW (wire-builder:246-248) |
| §6 Advanced | rules[] | `ChangeRule[]` | `advanced.rules[]` | ⚠ THROW (wire-builder:246-248) |
| §7 Meta | ownerSubjectId | string\|null | `meta.ownerSubjectId` | transport (header-derived; not in payload) |
| §7 Meta | project | string\|null | `meta.project` | ⚠ THROW (wire-builder:240-242) |
| §7 Meta | tags[] | string[] | `meta.tags` | ⚠ THROW (wire-builder:240-242) |
| §7 Meta | memo | string | `meta.memo` | ✓ folded into `tile.description` (only if description empty, wire-builder:344) |
| §7 Meta | isLabelOnly | boolean | `meta.isLabelOnly` | ✓ (mirrors `plan.role` via submitter boundary) |

QuickCreate UI directory (`tastile-web/src/features/create-tile/ui/`): 35 files including `QuickCreate.tsx` (root), per-section panels (`IdentityPanel` inferred from store slices, `SchedulePanel.tsx`, `CompletionSubPanel.tsx`, `ConditionEditor.tsx`, `FlowSequencePanel.tsx`, `RelationPanel.tsx`, `MetaSubPanel.tsx`, etc.), shared shell (`SubPanelShell.tsx`, `StagedSection.tsx`), and unit tests.

## 3. Wire payload shape

`PublishScheduleDefinitionPayload` is exported at `schedule-definition.ts:57-184`. Shape (abbreviated):

```
{
  source_client_local_id?: string|null,
  source_schedule?: {                    // null when repeatMode === "once" with no authored start
    required_duration_ms: number,
    generation: {
      kind: 0|1|2,                        // 0=ONCE, 1=STEP, 2=CONDITION
      at?: string|null,                   // kind=0
      starts_at?: string|null,            // kind=1
      interval_ms?: number|null,          // kind=1
      ends_at?: string|null,
      weekday_mask: number|null,
      date_range_start: string|null,
      date_range_end: string|null,
      excluded_dates: string[],
      offset_min: number|null,
    },
    window: { start_offset_ms, end_offset_ms },
    split_policy: { kind: 0|1, min_segment_ms, max_segment_ms, max_segments },
    priority: number,
  } | null,
  source_horizon?: { start, end } | null,
  tile: { title, description, color, icon, external_id },
  plan: {
    role: number,
    references: [{ id, target, pick, when }],
    completion: { root: Condition, time_requirements: TimeRequirement[], tasks: [...] },
    planning: { placement_rules: unknown[], nesting_rules: unknown[] },
    metrics: unknown[],
    decisions: unknown[],
  },
  reference_targets: [{ source_reference_id, target: { Placement|Plan|Execution: string } }],
  windows: [{ kind: WindowKindCode, bounds: {start,end}, rules: WindowRule[] }],
  recurrence: unknown | null,             // hardcoded null at wire-builder:362
  flows: [{ observes: string[], when: Condition|null, candidates: [...] }],
  relations?: [{ client_local_id, subject_source_ref, referenced_source_ref, kind, point, offset_ms, ordering, duration_expression, split_policy, correlation_scope, lifecycle_filter, eligible_through_revision, summary_priority }],
}
```

The wire's `Condition` (lines 20-24) is `{All|Any|Not:Condition|Term:Record<string,unknown>}` — externally tagged.

## 4. Throw sites in wire builder

All inside `buildQuickCreateSchedulePayload()` at `quick-create-schedule-wire.ts:213-450`:

- **Line 240-242** — `meta.project || meta.tags.length > 0` ⇒ `"projects and tags are not supported by atomic schedule publish"`
- **Line 243-245** — `identity.description && meta.memo.trim()` ⇒ `"description and memo cannot both be represented by atomic schedule publish"`
- **Line 246-248** — `advanced.changeSets.length > 0 || advanced.rules.length > 0` ⇒ `"advanced change rules are not supported by atomic schedule publish"`
- **Line 249-257** — `recurring.frameRules.length > 0 || recurring.rules.length > 0 || plan.planning.flows.length > 0` ⇒ `"legacy recurring and flow rules are not supported by SourceScheduleDefinition"`
- **Line 263-268** — duration range not matched by any completion timeRequirement ⇒ `"duration range must be represented by a completion time requirement"`
- Lines 144-180 — per-window validation in `publishWindows()` (bounds / kind-specific references / rule time format)

Note the comment at `submit.ts:62-63` explicitly states: "plan.completion and other aggregate changes are Phase B scope and are not persisted here" — referring to the edit-mode branch, not create.

## 5. Silent drop

- **`recurring.condition`** (`quick-create-store.ts`) — UI accepts a `ConditionNode | null`, but `PublishScheduleDefinitionPayload` has no slot. Wire builder doesn't reference it; no throw, no transport. The data is lost on submit.

## 6. Edit-mode fields

`submitUpdateTile` (`submit.ts:65-112`) writes:

- **To `/v1/tiles/{id}/update`** (`updateTileCommand`): `title`, `description`, `color`, `icon`, `externalId`, `ownerSubjectId` (from `state.identity.*` and `state.meta.ownerSubjectId`).
- **To `/v1/placements/{id}/changes`** (`updatePlacementChanges`): only when `state.editingId && state.time.span.start && state.time.span.end` — `{start, end}`. Single-call; nothing else flows through.

Plan updates (role, completion, planning), recurring updates, source updates, advanced/meta — all skipped. Comment at `submit.ts:62-63` documents this as Phase B.

## 7. E2E plumbing

**`e2e/quick-tile-create-e2e.spec.ts`** (read lines 1-60):
- Line 12-24: `deleteAllEvents()` uses `execFileSync("docker", ["exec", "tastile-core-db-1", "psql", ...])` with TRUNCATE list: `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring`. **Missing `v1_tile` and `v1_annotation`.**
- Line 59: post-submit verification hits `/api/events/occurrences?start=...&end=...` — comment at line 13-14 says this is "now 410 (v0 removed)", but the assertion is still on this endpoint.

**`e2e/helpers/v1.ts`** (read lines 1-160):
- Line 30-107: `v1CreatePlacement()` builds three POSTs in sequence (`/v1/tiles` kind=1, `/v1/tiles/{id}` GET to read plan_id, `/v1/placements` source=0/MANUAL).
- Line 93-104: labels seeded via `execFileSync("docker", ["exec", "tastile-core-db-1", "psql", "-U", "tastile", "-d", "tastile_db", ...])` with hardcoded owner_id `'00000000-0000-0000-0000-000000000001'` and INSERT into `v1_annotation` — bypasses any API.
- Line 135-150: `truncateV1()` again uses `docker exec tastile-core-db-1 psql` with TRUNCATE list `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation`. **Still missing `v1_tile`.**

Both files assume a `docker compose` workflow that doesn't exist on this Windows host (no Docker Desktop, no `tastile-core-db-1` container — DB is provisioned via `scripts/wslc/up-v1.sh` into container `tastile-db`).

## 8. Dead code

`shared/api/v1/build-command.ts` header comment lines 22-26:

> "The legacy `buildCreateTile` / `QuickCreateFormState` exports have been removed per the v1 tile-creation UI plan. Consumers in `QuickCreate.tsx` and `QuickTileRecurrenceSubPanel.tsx` will be migrated to the v1 store + snapshot shape in Task 6 / Task 9."

The current submit path (`submit.ts` → `quick-create-schedule-wire.ts`) does not call into `build-command.ts`. Path constants at `build-command.ts:103-108` (`/v1/tiles/{tileId}/plan`, `/v1/recurrings/{tileId}/frames|rules`) are unreferenced in current submit code. `submitUpdateTile` uses `updateTileCommand` + `updatePlacementChanges` from `tile-commands.ts` instead.