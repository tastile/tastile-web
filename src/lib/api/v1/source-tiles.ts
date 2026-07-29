import {
  type ApiError,
  type CommandRequest,
  type CommandResponse,
  nowIso,
  uuidv7,
} from "@/lib/domain/v1/envelope";
import { type ApiClient, type Result, getRead, sendCommand } from "./endpoints";

export interface UtcSpan {
  start: string;
  end: string;
}

/** UUIDv7-bearing identifiers and RFC 3339 UTC instants on the Core wire. */
export type SourceWireId = string;
export type SourceWireInstant = string;

export interface SourceRangeWire<T> {
  min: T | null;
  max: T | null;
}
export interface SourceTimeOfDayWire {
  hour: number;
  minute: number;
  second: number;
  nanos: number;
}
export interface SourceDateRangeWire {
  start: string;
  end: string;
}

/** Serde externally-tagged Condition and Term AST (`v1/05`). */
export type SourceConditionWire =
  | { All: SourceConditionWire[] }
  | { Any: SourceConditionWire[] }
  | { Not: SourceConditionWire }
  | { Term: SourceTermWire };

export type SourceMomentWire =
  | { Absolute: SourceWireInstant }
  | { Reference: [number, SourceMomentWire, number] };
export type SourceMomentTargetWire =
  | { Context: number }
  | { Reference: SourceWireId }
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Frame: SourceWireId };
export type SourceMomentComparisonWire =
  | { At: SourceWireInstant }
  | { Before: SourceMomentTargetWire }
  | { After: SourceMomentTargetWire }
  | { Between: [SourceMomentTargetWire, SourceMomentTargetWire] }
  | { Within: SourceRangeWire<number> };
export interface SourcePickWire {
  kind: number;
  at: SourceMomentWire | null;
}
export interface SourceAnchorSelectorWire {
  when: SourceConditionWire;
  pick: SourcePickWire;
}
export interface SourceGapAnchorsWire {
  left: SourceAnchorSelectorWire;
  right: SourceAnchorSelectorWire;
  size: SourceRangeWire<number> | null;
}
export interface SourceScopeWire {
  kind: number;
  parent: SourceWireId | null;
  gap: SourceGapAnchorsWire | null;
}
export interface SourceCalendarTermWire {
  weekday_mask: number;
  time_start: SourceTimeOfDayWire | null;
  time_end: SourceTimeOfDayWire | null;
  holiday_kind: number;
  date_range: SourceDateRangeWire | null;
  offset_min: number;
}
export interface SourceMomentTermWire {
  point: number;
  target: SourceMomentTargetWire;
  offset: number;
  comparison: SourceMomentComparisonWire;
}
export type SourceTermWire =
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
export type SourceFactComparisonWire =
  | { Equal: string }
  | { NotEqual: string }
  | { GreaterThan: number }
  | { LessThan: number }
  | { InRange: SourceRangeWire<number> }
  | "Exists"
  | "Missing";
export type SourceMetricComparisonWire =
  | { Equal: number }
  | { NotEqual: number }
  | { GreaterThan: number }
  | { LessThan: number }
  | { InRange: SourceRangeWire<number> }
  | "Exists"
  | "Missing";
export type SourceLifeTargetWire =
  | { Tile: SourceWireId }
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Recurring: SourceWireId };

export interface SourceReferenceWire {
  id: SourceWireId;
  target: number;
  pick: SourcePickWire;
  when: SourceConditionWire | null;
}
export interface SourceTimeObservationWire {
  scope: number;
  source: number;
  aggregate: number;
  quantifier: number | null;
  reference: SourceWireId | null;
}
export interface SourceTimeRequirementWire {
  id: SourceWireId;
  observation: SourceTimeObservationWire;
  required: SourceRangeWire<number>;
  preferred: SourceRangeWire<number> | null;
}
export interface SourceTaskDefinitionWire {
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
export interface SourceCompletionWire {
  root: SourceConditionWire;
  time_requirements: SourceTimeRequirementWire[];
  tasks: SourceTaskDefinitionWire[];
}

export interface SourcePlacementRuleWire {
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
export interface SourceNestingRuleWire {
  id: SourceWireId;
  direction: number;
  when: SourceConditionWire | null;
  rank: number;
  target: Omit<SourceReferenceWire, "when">;
  scope: SourceScopeWire;
}
export type SourceScalarExpressionWire =
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
export type SourceReadTargetWire =
  | { FrameDuration: SourceWireId }
  | { PlacementSpan: SourceWireId }
  | { ExecutionActiveDuration: SourceWireId }
  | { Fact: [SourceWireId, string] }
  | { Metric: SourceWireId }
  | { RequirementMet: SourceWireId }
  | { TaskCompleted: SourceWireId };
export interface SourceMetricWire {
  id: SourceWireId;
  output: number;
  expression: SourceScalarExpressionWire;
  limit: SourceRangeWire<number> | null;
}

export type SourceTargetRefWire =
  | { Placement: SourceWireId }
  | { Execution: SourceWireId }
  | { Plan: SourceWireId };
export interface SourceInsideWire {
  parent: SourceWireId;
  scope: number;
}
export type SourceChangeValueWire =
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
export interface SourceDecisionWire {
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
export type SourceCandidateEffectWire = {
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
export type SourceRequestKindWire =
  | { StartExecution: SourceWireId }
  | { FinishExecution: SourceWireId }
  | { PauseExecution: SourceWireId }
  | { ResumeExecution: SourceWireId }
  | { RecordFact: SourceWireId }
  | { MarkTask: [SourceWireId, SourceWireId] };
export interface SourceInteractionNodeWire {
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
export type SourceFlowSignalWire =
  | "PlacementCreated"
  | "PlacementUpdated"
  | "PlacementClosed"
  | "ExecutionStarted"
  | "ExecutionFinished"
  | "FactChanged"
  | "MetricChanged";
export interface SourceFlowDefinitionWire {
  observes: SourceFlowSignalWire[];
  when: SourceConditionWire | null;
  candidates: Array<{
    when: SourceConditionWire;
    rank: number;
    outputs: Array<{ ProposeNewPlanPlacement: { span: UtcSpan } }>;
  }>;
}

/** Server-owned SourceTile IDs are intentionally absent from this payload. */
export interface SourceTileDefinitionWire {
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  external_id: string | null;
}

/** Exact top-level `SchedulePlanDefinition` wire contract. */
export interface SourceTilePlanWire {
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

export interface SourceGenerationWire {
  /** Core's current `SourceGenerationKind` numeric registry value. */
  kind: 0 | 1;
  at: string | null;
  starts_at: string | null;
  interval_ms: number | null;
  ends_at: string | null;
  weekday_mask: number | null;
  date_range_start: string | null;
  date_range_end: string | null;
  excluded_dates?: string[];
}

export interface SourceScheduleWire {
  required_duration_ms: number;
  generation: SourceGenerationWire;
  window: { start_offset_ms: number; end_offset_ms: number };
  split_policy: {
    kind: number;
    min_segment_ms: number | null;
    max_segment_ms: number | null;
    max_segments: number | null;
  };
  priority: number;
}

/** `POST /v1/source-tiles` payload. */
export interface SourceTileCreatePayload {
  tile: SourceTileDefinitionWire;
  plan: SourceTilePlanWire;
  flows: SourceFlowDefinitionWire[];
  schedule: SourceScheduleWire;
  horizon: UtcSpan;
}

/** `PUT /v1/source-tiles/{id}` body; the source ID belongs only in the path. */
export type SourceTileUpdatePayload = SourceTileCreatePayload;

export interface SourceScheduleRead {
  required_duration_ms: number;
  generation: {
    kind: number;
    at: string | null;
    starts_at: string | null;
    interval_ms: number | null;
    ends_at: string | null;
    weekday_mask: number | null;
    date_range_start: string | null;
    date_range_end: string | null;
    excluded_dates: string[];
  };
  window: { start_offset_ms: number; end_offset_ms: number };
  split_policy: {
    kind: number;
    min_segment_ms: number | null;
    max_segment_ms: number | null;
    max_segments: number | null;
  };
  priority: number;
}

export interface SourceTileRead {
  source_tile_id: string;
  plan_id: string;
  owner_id: string;
  revision: number;
  title: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  external_id: string | null;
  plan_role: number;
  schedule: SourceScheduleRead;
  created_at: string;
  updated_at: string;
}

export interface OccurrenceRead {
  occurrence_id: string;
  source_tile_id: string;
  sequence_no: number;
  nominal_at: string;
  window_start: string;
  window_end: string;
  required_duration_ms: number;
  state: number;
  revision: number;
}

export interface PlacementRead {
  placement_id: string;
  source_tile_id: string;
  occurrence_id: string;
  split_index: number;
  split_count: number;
  split_group_id: string;
  start: string;
  end: string;
  closed: boolean;
  closed_at: string | null;
  revision: number;
}

export interface SourceTileDetail {
  source: SourceTileRead;
  occurrences: OccurrenceRead[];
  placements: PlacementRead[];
}

/**
 * Numeric-typed wire-format mirror of `domain::read::SourceTileSummary`
 * (v1/14 §10). Field names match the Rust struct verbatim — JSON keys are
 * the Rust field names, NOT SQL aliases. Numeric codes follow v1/10 §2:
 *   - `kind`            Option<i16>  0=BREAK / 1=SLEEP / null=legacy pre-v0.5.3
 *   - `source_state`    i16          0=ACTIVE / 1=PAUSED / 2=ENDED / 3=CANCELLED
 *   - `generation_kind` i16          0=ONESHOT / 1=RECURRING / 2=DEMAND
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

export function getSourceTile(
  client: ApiClient,
  sourceTileId: string,
): Promise<Result<SourceTileDetail>> {
  return getRead(client, `/v1/source-tiles/${sourceTileId}`);
}

export function listSourceTiles(client: ApiClient): Promise<Result<SourceTileRead[]>> {
  return getRead(client, "/v1/source-tiles");
}

export function listSourceTilePlacements(
  client: ApiClient,
  sourceTileId: string,
): Promise<Result<PlacementRead[]>> {
  return getRead(client, `/v1/source-tiles/${sourceTileId}/placements`);
}
