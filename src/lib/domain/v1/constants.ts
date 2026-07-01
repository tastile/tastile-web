/**
 * v1 numeric constants — SINGLE SOURCE OF TRUTH.
 *
 * All values are fixed and must never be hard-coded elsewhere in the codebase.
 * Numeric constants only: 0 is NOT a sentinel — use `null` for "not set".
 * Source of truth: tastile-core/v1/HARNESS.md "重要な数値定数" and the
 * per-chapter "数値定数" tables in tastile-core/v1/02..14-*.md.
 */

export const TileKind = {
  RECURRING: 0,
  PLACEMENT: 1,
  EXECUTION: 2,
} as const;
export type TileKindValue = (typeof TileKind)[keyof typeof TileKind];

export const PlanRole = {
  EXECUTABLE: 0,
  LABEL: 1,
} as const;
export type PlanRoleValue = (typeof PlanRole)[keyof typeof PlanRole];

export const RecurringState = {
  ACTIVE: 0,
  PAUSED: 1,
  ENDED: 2,
  CANCELLED: 3,
} as const;
export type RecurringStateValue = (typeof RecurringState)[keyof typeof RecurringState];

export const PlacementSource = {
  MANUAL: 0,
  RECURRING: 1,
  FLOW: 2,
  IMPORT: 3,
} as const;
export type PlacementSourceValue = (typeof PlacementSource)[keyof typeof PlacementSource];

export const ExecutionState = {
  ACTIVE: 0,
  PAUSED: 1,
  FINISHED_NORMAL: 2,
  FINISHED_VOID: 3,
} as const;

export const ExecutionSegmentKind = {
  ACTIVE: 0,
  PAUSED: 1,
} as const;

export const ChangeLayer = {
  RECURRING: 0,
  PLACEMENT: 1,
  EXECUTION: 2,
} as const;
export type ChangeLayerValue = (typeof ChangeLayer)[keyof typeof ChangeLayer];

export const ChangeKind = {
  SET: 0,
  CLEAR: 1,
  PUT: 2,
  DROP: 3,
} as const;
export type ChangeKindValue = (typeof ChangeKind)[keyof typeof ChangeKind];

export const ChangeSource = {
  RECURRING: 0,
  FLOW: 1,
  USER: 2,
  DECISION: 3,
  EXECUTION: 4,
} as const;
export type ChangeSourceValue = (typeof ChangeSource)[keyof typeof ChangeSource];

export const MergeMode = {
  OVERRIDE: 0,
  INTERSECT_RANGE: 1,
  UNION_IDENTIFIED: 2,
  ORDERED_IDENTIFIED: 3,
  SPAN_ENDPOINT: 4,
} as const;
export type MergeModeValue = (typeof MergeMode)[keyof typeof MergeMode];

export const TimeScope = {
  EXECUTION: 0,
  PLACEMENT: 1,
  FRAME: 2,
  CHILDREN: 3,
  REFERENCE: 4,
} as const;
export type TimeScopeValue = (typeof TimeScope)[keyof typeof TimeScope];

export const TimeSource = {
  ACTIVE_SEGMENT: 0,
  PAUSED_SEGMENT: 1,
  EXECUTION: 2,
} as const;
export type TimeSourceValue = (typeof TimeSource)[keyof typeof TimeSource];

export const TimeAggregate = {
  TOTAL_DURATION: 0,
  EACH_DURATION: 1,
  COUNT: 2,
  GAP_DURATION: 3,
  SPAN_DURATION: 4,
} as const;
export type TimeAggregateValue = (typeof TimeAggregate)[keyof typeof TimeAggregate];

export const TimeQuantifier = {
  ALL: 0,
  ANY: 1,
} as const;
export type TimeQuantifierValue = (typeof TimeQuantifier)[keyof typeof TimeQuantifier];

export const TaskOrderRelation = {
  BEFORE: 0,
  AFTER: 1,
} as const;
export type TaskOrderRelationValue = (typeof TaskOrderRelation)[keyof typeof TaskOrderRelation];

export const CommandResult = {
  APPLIED: 0,
  ALREADY_APPLIED: 1,
  ACCEPTED: 2,
} as const;

export const ApiErrorKind = {
  VALIDATION: 0,
  FORBIDDEN: 1,
  STALE_REVISION: 2,
  IDEMPOTENCY_KEY_REUSED: 3,
  NOT_FOUND: 4,
  CONFLICT: 5,
  BLOCKED: 6,
  RETRYABLE: 7,
} as const;
export type ApiErrorKindValue = (typeof ApiErrorKind)[keyof typeof ApiErrorKind];

export const ActorKind = {
  USER: 0,
  WORKER: 1,
  IMPORT: 2,
  SYSTEM: 3,
} as const;
export type ActorKindValue = (typeof ActorKind)[keyof typeof ActorKind];

export const AggregateKind = {
  RECURRING: 0,
  PLACEMENT: 1,
  EXECUTION: 2,
  SESSION: 3,
} as const;
export type AggregateKindValue = (typeof AggregateKind)[keyof typeof AggregateKind];

export const ResolutionState = {
  OPEN: 0,
  CLOSED: 1,
  BLOCKED: 2,
} as const;
export type ResolutionStateValue = (typeof ResolutionState)[keyof typeof ResolutionState];

export const ConditionKind = {
  ALL: 0,
  ANY: 1,
  NOT: 2,
  TERM: 3,
} as const;
export type ConditionKindValue = (typeof ConditionKind)[keyof typeof ConditionKind];

export const HolidayKind = {
  NOT_HOLIDAY: 0,
  HOLIDAY: 1,
  ANY: 2,
} as const;
export type HolidayKindValue = (typeof HolidayKind)[keyof typeof HolidayKind];
