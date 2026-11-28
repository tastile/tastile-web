import {
  type ApiError,
  type CommandRequest,
  type CommandResponse,
  nowIso,
  uuidv7,
} from "@/shared/model/v1/envelope";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import {
  type ApiClient,
  type PagedRead,
  type Result,
  followPages,
  getAllPages,
  getRead,
  sendCommand,
} from "./endpoints";
import type { components } from "./openapi-generated";

export interface UtcSpan {
  start: string;
  end: string;
}

/** UUIDv7-bearing identifiers and RFC 3339 UTC instants on the Core wire. */
type SourceWireId = string;
type SourceWireInstant = string;

interface SourceRangeWire<T> {
  min: T | null;
  max: T | null;
}
interface SourceTimeOfDayWire {
  hour: number;
  minute: number;
  second: number;
  nanos: number;
}
interface SourceDateRangeWire {
  start: string;
  end: string;
}

/** Serde externally-tagged Condition and Term AST (`v1/05`). */
type SourceConditionWire =
  | { All: SourceConditionWire[] }
  | { Any: SourceConditionWire[] }
  | { Not: SourceConditionWire }
  | { Term: SourceTermWire };

type SourceMomentWire =
  | { Absolute: SourceWireInstant }
  | { Reference: [number, SourceMomentWire, number] };
type SourceMomentTargetWire =
  | { Context: number }
  | { Reference: SourceWireId }
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Frame: SourceWireId };
type SourceMomentComparisonWire =
  | { At: SourceWireInstant }
  | { Before: SourceMomentTargetWire }
  | { After: SourceMomentTargetWire }
  | { Between: [SourceMomentTargetWire, SourceMomentTargetWire] }
  | { Within: SourceRangeWire<number> };
interface SourcePickWire {
  kind: number;
  at: SourceMomentWire | null;
}
interface SourceAnchorSelectorWire {
  when: SourceConditionWire;
  pick: SourcePickWire;
}
interface SourceGapAnchorsWire {
  left: SourceAnchorSelectorWire;
  right: SourceAnchorSelectorWire;
  size: SourceRangeWire<number> | null;
}
interface SourceScopeWire {
  kind: number;
  parent: SourceWireId | null;
  gap: SourceGapAnchorsWire | null;
}
interface SourceCalendarTermWire {
  weekday_mask: number;
  time_start: SourceTimeOfDayWire | null;
  time_end: SourceTimeOfDayWire | null;
  holiday_kind: number;
  date_range: SourceDateRangeWire | null;
  offset_min: number;
}
interface SourceMomentTermWire {
  point: number;
  target: SourceMomentTargetWire;
  offset: number;
  comparison: SourceMomentComparisonWire;
}
type SourceTermWire =
  | { Calendar: SourceCalendarTermWire }
  | { Moment: SourceMomentTermWire }
  | {
      Relation: {
        reference_id: SourceWireId;
        relation: number;
        window_kind: "Root" | "LabelSpan" | "ParentSpan" | "Gap";
      };
    }
  | {
      Gap: {
        scope: SourceScopeWire;
        left_anchor: SourceAnchorSelectorWire;
        right_anchor: SourceAnchorSelectorWire;
        size: SourceRangeWire<number> | null;
      };
    }
  | { Requirement: { time_requirement: SourceWireId; state: "Met" | "Unmet" | "Any" } }
  | { Task: { task_id: SourceWireId; state: "Visible" | "Marked" | "Completed" | "NotCompleted" } }
  | { Fact: { key: string; comparison: SourceFactComparisonWire } }
  | { Metric: { metric_id: SourceWireId; comparison: SourceMetricComparisonWire } }
  | { Feedback: { feedback_txn: SourceWireId; state: number } }
  | { Life: { target: SourceLifeTargetWire; state: "Active" | "Paused" | "Closed" | "Voided" } };
type SourceFactComparisonWire =
  | { Equal: string }
  | { NotEqual: string }
  | { GreaterThan: number }
  | { LessThan: number }
  | { InRange: SourceRangeWire<number> }
  | "Exists"
  | "Missing";
type SourceMetricComparisonWire =
  | { Equal: number }
  | { NotEqual: number }
  | { GreaterThan: number }
  | { LessThan: number }
  | { InRange: SourceRangeWire<number> }
  | "Exists"
  | "Missing";
type SourceLifeTargetWire =
  | { Tile: SourceWireId }
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Recurring: SourceWireId };

interface SourceReferenceWire {
  id: SourceWireId;
  target: number;
  pick: SourcePickWire;
  when: SourceConditionWire | null;
}
interface SourceTimeObservationWire {
  scope: number;
  source: number;
  aggregate: number;
  quantifier: number | null;
  reference: SourceWireId | null;
}
interface SourceTimeRequirementWire {
  id: SourceWireId;
  observation: SourceTimeObservationWire;
  required: SourceRangeWire<number>;
  preferred: SourceRangeWire<number> | null;
}
interface SourceTaskDefinitionWire {
  id: SourceWireId;
  content: { title: string; description: string | null };
  show: SourceConditionWire | null;
  complete: SourceConditionWire;
  order: Array<{
    id: SourceWireId;
    target_task_id: SourceWireId;
    relation: number;
    when: SourceConditionWire | null;
  }>;
}
interface SourceCompletionWire {
  root: SourceConditionWire;
  time_requirements: SourceTimeRequirementWire[];
  tasks: SourceTaskDefinitionWire[];
}

interface SourcePlacementRuleWire {
  id: SourceWireId;
  when: SourceConditionWire | null;
  rank: number;
  effect: {
    kind: number;
    scope: SourceScopeWire | null;
    span: SourceRangeWire<number> | null;
    score: number | null;
    record: number | null;
  };
}
interface SourceNestingRuleWire {
  id: SourceWireId;
  direction: number;
  when: SourceConditionWire | null;
  rank: number;
  target: Omit<SourceReferenceWire, "when">;
  scope: SourceScopeWire;
}
type SourceScalarExpressionWire =
  | { Literal: number }
  | { Read: SourceReadTargetWire }
  | {
      Aggregate: {
        kind: number;
        scope: number;
        source: number;
        quantifier: number | null;
        reference: SourceWireId | null;
      };
    }
  | { Operate: { op: number; operands: SourceScalarExpressionWire[] } }
  | {
      Choose: {
        branches: Array<{ when: SourceConditionWire; then: SourceScalarExpressionWire }>;
        default: SourceScalarExpressionWire | null;
      };
    };
type SourceReadTargetWire =
  | { FrameDuration: SourceWireId }
  | { PlacementSpan: SourceWireId }
  | { ExecutionActiveDuration: SourceWireId }
  | { Fact: [SourceWireId, string] }
  | { Metric: SourceWireId }
  | { RequirementMet: SourceWireId }
  | { TaskCompleted: SourceWireId };
interface SourceMetricWire {
  id: SourceWireId;
  output: number;
  expression: SourceScalarExpressionWire;
  limit: SourceRangeWire<number> | null;
}

type SourceTargetRefWire =
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Plan: SourceWireId };
interface SourceInsideWire {
  parent: SourceWireId;
  scope: number;
}
type SourceChangeValueWire =
  | { Span: UtcSpan }
  | { Instant: SourceWireInstant }
  | { Integer: number }
  | { Text: string }
  | { Identifier: SourceWireId }
  | { Inside: SourceInsideWire }
  | { RangeInteger: SourceRangeWire<number> }
  | { RangeInstant: SourceRangeWire<SourceWireInstant> }
  | { Bool: boolean }
  | { TimeRequirementRef: SourceWireId }
  | { TaskDefRef: SourceWireId }
  | "None";
export interface SourceChangeRuleWire {
  change_layer?: number;
  id: SourceWireId;
  target: SourceTargetRefWire;
  kind: number;
  key: { group: number; item: SourceWireId | null; part: number };
  value: SourceChangeValueWire | null;
  source: number;
  source_ref: {
    recurring: SourceWireId | null;
    flow: SourceWireId | null;
    frame: SourceWireId | null;
    feedback_txn: SourceWireId | null;
    decision_run: SourceWireId | null;
    execution: SourceWireId | null;
  } | null;
  rank: number;
}
interface SourceDecisionWire {
  id: SourceWireId;
  observe: number;
  when: SourceConditionWire | null;
  candidates: Array<{
    id: SourceWireId;
    when: SourceConditionWire;
    rank: number;
    effects: SourceCandidateEffectWire[];
  }>;
  reuse: Array<{
    id: SourceWireId;
    when: SourceConditionWire;
    source: "All" | { Feedback: SourceWireId } | { Within: number };
    apply: Array<{
      id: SourceWireId;
      target: SourceTargetRefWire;
      key: { group: number; item: SourceWireId | null; part: number };
      kind: number;
      value: SourceChangeValueWire | null;
    }>;
  }>;
  dialog: SourceInteractionNodeWire;
}
type SourceCandidateEffectWire = {
  kind: number;
  proposal: {
    id: SourceWireId;
    tile_id: SourceWireId;
    plan_id: SourceWireId;
    baseline: { span: UtcSpan; inside: SourceInsideWire | null };
    inside: SourceInsideWire | null;
    proposal_key: { producer_id: SourceWireId; local_id: SourceWireId } | null;
  } | null;
  change: SourceChangeRuleWire | null;
  request: {
    id: SourceWireId;
    kind: SourceRequestKindWire;
    payload: SourceChangeValueWire | null;
    idempotency_key: SourceWireId;
  } | null;
  idempotency_key: SourceWireId | null;
};
type SourceRequestKindWire =
  | { StartExecution: SourceWireId }
  | { FinishExecution: SourceWireId }
  | { PauseExecution: SourceWireId }
  | { ResumeExecution: SourceWireId }
  | { RecordFact: SourceWireId }
  | { MarkTask: [SourceWireId, SourceWireId] };
interface SourceInteractionNodeWire {
  id: SourceWireId;
  visible: SourceConditionWire | null;
  view: { title: string; body: string | null };
  inputs: Array<{
    id: SourceWireId;
    visible: SourceConditionWire | null;
    enabled: SourceConditionWire | null;
    current: SourceChangeValueWire[];
    options: Array<{ id: SourceWireId; label: string; value: SourceChangeValueWire }>;
    acceptance: number;
  }>;
  children: SourceInteractionNodeWire[];
}

/** SourceTile Flow definitions are deliberately separate from Plan planning. */
type SourceFlowSignalWire =
  | "PlacementCreated"
  | "PlacementUpdated"
  | "PlacementClosed"
  | "ExecutionStarted"
  | "ExecutionFinished"
  | "FactChanged"
  | "MetricChanged";
interface SourceFlowDefinitionWire {
  observes: SourceFlowSignalWire[];
  when: SourceConditionWire | null;
  candidates: Array<{
    when: SourceConditionWire;
    rank: number;
    outputs: Array<
      | { ProposeNewPlanPlacement: { span: UtcSpan } }
      | {
          ProposeNewPlanPlacementSequence: {
            proposal: { span: UtcSpan };
            sequence_steps?: Array<{
              wait_before_ms: number;
              emit_duration_ms: number;
              target_plan_id?: SourceWireId | null;
            }>;
          };
        }
      | {
          ProposeChangeWithCompanions: {
            change: SourceChangeRuleWire;
            change_layer?: number;
            companions?: Array<{
              proposal_key: SourceWireId;
              target_plan_id: SourceWireId;
              span: UtcSpan;
              relation_kind: number;
            }>;
          };
        }
    >;
  }>;
}

/** Server-owned SourceTile IDs are intentionally absent from this payload. */
interface SourceTileDefinitionWire {
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  external_id: string | null;
}

/** Exact top-level `SchedulePlanDefinition` wire contract. */
interface SourceTilePlanWire {
  role: number;
  references: SourceReferenceWire[];
  completion: SourceCompletionWire;
  planning: {
    placement_rules: SourcePlacementRuleWire[];
    nesting_rules: SourceNestingRuleWire[];
  };
  metrics: SourceMetricWire[];
  decisions: SourceDecisionWire[];
}

interface SourceMonthlyRuleWire {
  /** `MonthlyRuleKind`: 0 = by_day, 1 = by_weekday. */
  kind: 0 | 1;
  day_of_month?: number | null;
  week_of_month?: number | null;
  weekday?: number | null;
}

interface SourceGenerationWire {
  /** `SourceGenerationKind`: 0 = one_time, 1 = recurring, 2 = demand_driven, 3 = monthly. */
  kind: 0 | 1 | 2 | 3;
  at: string | null;
  starts_at: string | null;
  interval_ms: number | null;
  ends_at: string | null;
  weekday_mask: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  excluded_dates?: string[];
  /** Local calendar offset in minutes east of UTC; absent inherits the owner profile. */
  offset_min?: number | null;
  /** Required iff `kind == 3` (monthly); must be absent for other kinds. */
  monthly_rule?: SourceMonthlyRuleWire | null;
}

interface SourceScheduleWire {
  required_duration_ms: number;
  generation: SourceGenerationWire;
  // react-doctor-disable-next-line react-doctor/no-unguarded-browser-global-at-module-scope
  window: { start_offset_ms: number; end_offset_ms: number };
  split_policy: {
    kind: number;
    min_segment_ms: number | null;
    max_segment_ms: number | null;
    max_segments: number | null;
  };
  priority: number;
}

/** `SourceRelationEndpointRef`: internally tagged `{kind, ...}` wire shape. */
type SourceRelationEndpointRefWire =
  | { kind: "local"; client_local_id: SourceWireId }
  | { kind: "existing"; source_tile_id: SourceWireId };

/** `SourceRelationDefinitionPayload` (command.rs). */
interface SourceRelationDefinitionWire {
  client_local_id: SourceWireId;
  subject_source_ref: SourceRelationEndpointRefWire;
  referenced_source_ref: SourceRelationEndpointRefWire;
  kind: number;
  point: number;
  offset_ms: number;
  ordering: { primary: number; point: number; direction: number };
  duration_expression:
    | { kind: "fixed"; duration_ms: number }
    | { kind: "reference_span"; referenced_source_ref: SourceRelationEndpointRefWire };
  split_policy:
    | { Unsplit: { required_total_duration_ms: number } }
    | {
        Split: {
          required_total_duration_ms: number;
          min_segment_ms: number;
          max_segment_ms: number;
        };
      };
  correlation_scope: number;
  lifecycle_filter: number;
  eligible_through_revision: number;
  summary_priority: number;
}

/** `POST /v1/source-tiles` payload (`CreateSourceTilePayload`). */
export interface SourceTileCreatePayload {
  source_client_local_id?: SourceWireId | null;
  tile: SourceTileDefinitionWire;
  plan: SourceTilePlanWire;
  flows: SourceFlowDefinitionWire[];
  relations?: SourceRelationDefinitionWire[];
  schedule: SourceScheduleWire;
  horizon: UtcSpan;
}

/**
 * `PUT /v1/source-tiles/{id}` body (`UpdateSourceTileBody`). The source ID
 * is path-derived and must NOT appear in the payload.
 */
export type SourceTileUpdatePayload = SourceTileCreatePayload;

// ---------------------------------------------------------------
// Read-side wire types
//
// Aliased from the pinned OpenAPI spec (contract v2.0.0) so the read
// shapes cannot drift from `tastile-core`. List endpoints return the
// `{items, count, next_cursor}` page envelope; the helpers below
// traverse every page before resolving.
// ---------------------------------------------------------------

type Schemas = components["schemas"];

/** Wire shape of `SourceTileRead` (GET /v1/source-tiles items). */
export type SourceTileRead = Schemas["SourceTileRead"];

/** Wire shape of `SourceOccurrenceRead`. `blocked` is non-null only while
 *  the occurrence has a current placement failure (v1/14 §4). */
type SourceOccurrenceRead = Schemas["SourceOccurrenceRead"];

/** Wire shape of `PlacementTileRead` (source-tile placement rows). */
export type PlacementTileRead = Schemas["PlacementTileRead"];

/** Wire shape of `RelationDefinitionRead` (detail `relations` array). */
type RelationDefinitionRead = Schemas["RelationDefinitionRead"];

type SourceTileDetailReadWire = Schemas["SourceTileDetailRead"];

/**
 * Flattened view of `GET /v1/source-tiles/{id}`. The wire response pages
 * `occurrences` and `placements` independently; `getSourceTile` follows
 * both cursors so callers always receive complete collections.
 */
export interface SourceTileDetail {
  source: SourceTileRead;
  relations: RelationDefinitionRead[];
  occurrences: SourceOccurrenceRead[];
  placements: PlacementTileRead[];
}

/**
 * Numeric-typed wire-format mirror of `domain::read::SourceTileSummary`
 * (v1/14 §10). Field names match the Rust struct verbatim — JSON keys are
 * the Rust field names, NOT SQL aliases. Numeric codes follow v1/10 §2:
 *   - `kind`            Option<i16>  0=BREAK / 1=SLEEP / null=legacy pre-v0.5.3
 *   - `source_state`    i16          0=ACTIVE / 1=PAUSED / 2=ENDED / 3=CANCELLED
 *   - `generation_kind` i16          0=ONE_TIME / 1=RECURRING / 2=DEMAND_DRIVEN / 3=MONTHLY
 *   - `split_kind`      i16          0=UNSPLIT / 1=SPLIT
 * `kind === null` is preserved (legacy SourceTiles pre-V1_029 must NOT be
 * guessed from display text per v1/10 §9).
 */
export interface SourceTileSummaryWire {
  kind: number | null;
  source_state: number;
  generation_kind: number;
  split_kind: number;
  priority: number;
  required_duration_ms: number;
  window_start_offset_ms: number;
  window_end_offset_ms: number;
  weekday_mask: number | null;
  external_id: string | null;
  color: string | null;
  icon: string | null;
}

export type SourceTileCommandResult =
  | { ok: true; data: CommandResponse; status: number }
  | { ok: false; error: ApiError };

function commandEnvelope<T>(payload: T, expectedRevision: number | null): CommandRequest<T> {
  return { expectedRevision, idempotencyKey: uuidv7(), occurredAt: nowIso(), payload };
}

export function createSourceTile(options: {
  client: ApiClient;
  payload: SourceTileCreatePayload;
}): Promise<SourceTileCommandResult> {
  return sendCommand(
    options.client,
    "POST",
    "/v1/source-tiles",
    commandEnvelope(options.payload, null),
  );
}

export function updateSourceTile(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  payload: SourceTileUpdatePayload;
}): Promise<SourceTileCommandResult> {
  return sendCommand(
    options.client,
    "PUT",
    `/v1/source-tiles/${options.sourceTileId}`,
    commandEnvelope(options.payload, options.expectedRevision),
  );
}

export function reflowSourceTile(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  range: UtcSpan;
}): Promise<SourceTileCommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/source-tiles/${options.sourceTileId}/reflow`,
    commandEnvelope({ range: options.range }, options.expectedRevision),
  );
}

/**
 * Faithful dry-run of the reflow command (core#413, OpenAPI
 * `preview_source_tile_reflow`). Runs the same code path inside a
 * transaction that is always rolled back, so the returned
 * `CommandResponse` classifies the outcome exactly like `apply` —
 * including `aggregateMeta.unplacedOccurrences` — while writing
 * nothing. `expected_revision` is enforced identically: a stale
 * preview returns STALE_REVISION (409) just like apply.
 */
export function previewSourceTileReflow(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  range: UtcSpan;
}): Promise<SourceTileCommandResult> {
  return sendCommand(
    options.client,
    "POST",
    `/v1/source-tiles/${options.sourceTileId}/reflow/preview`,
    commandEnvelope({ range: options.range }, options.expectedRevision),
  );
}

export type SourceTileReflowOutcome =
  | { ok: true; data: CommandResponse; status: number; retried: boolean }
  | { ok: false; error: ApiError; retried: boolean };

/**
 * Apply a reflow, retrying once when the server rejects with
 * STALE_REVISION and reports `current_revision` in the error body
 * (v1/14 §1-4 conflict contract). The retry issues a fresh command
 * envelope (new idempotency key) against the revision the server
 * reports, so the user's reflow intent is applied to the latest state
 * instead of surfacing a bare 409. Any other failure — or a second
 * STALE_REVISION — is returned unchanged with `retried` marking
 * whether a retry was attempted.
 */
export async function reflowSourceTileWithRevisionRetry(options: {
  client: ApiClient;
  sourceTileId: string;
  expectedRevision: number;
  range: UtcSpan;
}): Promise<SourceTileReflowOutcome> {
  const first = await reflowSourceTile(options);
  if (first.ok || first.error.kind !== ApiErrorKind.STALE_REVISION) {
    return { ...first, retried: false };
  }
  const currentRevision = first.error.currentRevision;
  if (currentRevision == null) return { ...first, retried: false };
  const second = await reflowSourceTile({ ...options, expectedRevision: currentRevision });
  return { ...second, retried: true };
}

/**
 * Follow one paged sub-collection (`occurrences` or `placements`) of the
 * detail endpoint. Each follow-up request returns the full detail body;
 * only the requested collection's page is consumed.
 */
async function collectDetailPages<T>(
  client: ApiClient,
  path: string,
  first: PagedRead<T>,
  firstStatus: number,
  cursorParam: "occurrence_cursor" | "placement_cursor",
  pick: (detail: SourceTileDetailReadWire) => PagedRead<T>,
): Promise<Result<T[]>> {
  return followPages(first, firstStatus, async (cursor) => {
    const res = await getRead<SourceTileDetailReadWire>(
      client,
      `${path}?${cursorParam}=${encodeURIComponent(cursor)}`,
    );
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, data: pick(res.data), status: res.status };
  });
}

export async function getSourceTile(
  client: ApiClient,
  sourceTileId: string,
): Promise<Result<SourceTileDetail>> {
  const path = `/v1/source-tiles/${sourceTileId}`;
  const res = await getRead<SourceTileDetailReadWire>(client, path);
  if (!res.ok) return { ok: false, error: res.error };
  const detail = res.data;

  const occurrences = await collectDetailPages(
    client,
    path,
    detail.occurrences,
    res.status,
    "occurrence_cursor",
    (d) => d.occurrences,
  );
  if (!occurrences.ok) return { ok: false, error: occurrences.error };

  const placements = await collectDetailPages(
    client,
    path,
    detail.placements,
    res.status,
    "placement_cursor",
    (d) => d.placements,
  );
  if (!placements.ok) return { ok: false, error: placements.error };

  return {
    ok: true,
    status: res.status,
    data: {
      source: detail.source,
      relations: detail.relations,
      occurrences: occurrences.data,
      placements: placements.data,
    },
  };
}

/**
 * All SourceTiles owned by the caller. The endpoint is keyset-paginated
 * (contract v2.0.0); every page is followed so callers never see a
 * truncated list.
 */
export function listSourceTiles(client: ApiClient): Promise<Result<SourceTileRead[]>> {
  return getAllPages(client, "/v1/source-tiles");
}

/** All canonical Placement rows for a SourceTile (all pages). */
export function listSourceTilePlacements(
  client: ApiClient,
  sourceTileId: string,
): Promise<Result<PlacementTileRead[]>> {
  return getAllPages(client, `/v1/source-tiles/${sourceTileId}/placements`);
}
