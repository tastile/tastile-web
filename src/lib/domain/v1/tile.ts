/**
 * v1 Tile / Plan / Recurring — tastile-core/v1/02-core-entities.md
 * plus Plan Completion (v1/13), Nesting & Flow (v1/09), Recurring & Frame (v1/08).
 *
 * Interfaces only. No business logic.
 */

import type {
  PlanRoleValue,
  RecurringStateValue,
  TileKindValue,
} from "./constants";
import type { ConditionNode } from "./condition";
import type { Completion, TimeRequirement, TaskDefinition } from "./completion";
import type { Reference } from "./reference";
import type { Metric } from "./metric";
import type { Stamp } from "./actor";
import type { Window, Moment, DateRange, DurationRange } from "./window";

// ---------- Tile.Base ----------

export interface TileContent {
  title: string;
  description: string | null;
}

export interface TileVisual {
  color: string;
  icon: string;
}

export interface TileAudit {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Tile {
  id: string;
  kind: TileKindValue;
  owner: string;
  externalId: string | null;
  revision: number;
  content: TileContent;
  visual: TileVisual;
  audit: TileAudit;
}

// ---------- Planning (rules & flows) ----------

/** PlacementRuleEffect.scope.kind: ROOT=0 | HOST=1 | GAP=2 */
export interface Scope {
  kind: number;
  parent: string | null;
  gap: GapScope | null;
}

export interface GapScope {
  leftAnchor: string;
  rightAnchor: string;
  size: DurationRange | null;
}

/** PlacementRuleEffect.record: OPTIONAL=0 | REQUIRED=1 */
export type RecordRequirement = number | null;

export interface PlacementRuleEffect {
  /** PERMIT_SCOPE=0 | DENY_SCOPE=1 | LIMIT_SPAN=2 | SCORE_SCOPE=3 | RECORD_REQUIREMENT=4 */
  kind: number;
  scope: Scope | null;
  span: DurationRange | null;
  score: number | null;
  record: RecordRequirement;
}

export interface PlacementRule {
  id: string;
  when: ConditionNode | null;
  rank: number;
  effect: PlacementRuleEffect;
}

/** NestingRule.direction: HOST=0 | INSIDE=1 */
export interface NestingRule {
  id: string;
  direction: number;
  when: ConditionNode | null;
  rank: number;
  target: Reference;
  scope: Scope;
}

// ---------- Flow ----------

/** Signal kinds are implementation-defined; we keep them numeric. */
export interface Signal {
  id: string;
  kind: number;
  /** Parameters describing the signal source. */
  params: Record<string, unknown>;
}

/** FlowOutput.kind: PROPOSE_PLACEMENT=0 | PROPOSE_CHANGE=1 */
export interface PlacementProposalDraft {
  title: string;
  baselineSpan: { start: string; end: string };
  inside: { parentId: string | null; scopeKind: number };
  sourceRef: string | null;
  proposalKey: { producerId: string; localId: string };
}

export interface FlowOutput {
  kind: number;
  proposal: PlacementProposalDraft | null;
  change: import("./change-set").ChangeRule | null;
}

export interface FlowCandidate {
  id: string;
  when: ConditionNode;
  rank: number;
  outputs: FlowOutput[];
}

export interface Flow {
  id: string;
  observe: Signal[];
  when: ConditionNode | null;
  candidates: FlowCandidate[];
}

export interface Planning {
  placementRules: PlacementRule[];
  nestingRules: NestingRule[];
  flows: Flow[];
}

// ---------- Decision ----------

export interface Decision {
  id: string;
  /** Decision kind is defined in v1/06; left as a numeric here. */
  kind: number;
  when: ConditionNode | null;
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    /** ChangeRule applied when the user picks this option. */
    change: import("./change-set").ChangeRule | null;
  }>;
}

// ---------- Plan ----------

export interface Plan {
  role: PlanRoleValue;
  references: Reference[];
  completion: Completion;
  planning: Planning;
  metrics: Metric[];
  decisions: Decision[];
}

// ---------- Recurring ----------

export interface RecurringLife {
  active: DateRange;
  /** ACTIVE=0 | PAUSED=1 | ENDED=2 | CANCELLED=3 (RecurringState) */
  state: RecurringStateValue;
  changed: Stamp;
}

// ---------- FrameRule generators ----------

export interface StepGenerator {
  step: number;
  origin: Moment | null;
  bounds: { start: string; end: string } | null;
}

export interface ReferenceGenerator {
  referenceId: string;
  /** START=0 | END=1 | CENTER=2 */
  align: number;
}

export interface CalendarGenerator {
  /** DAY=0 | WEEK=1 | MONTH=2 */
  unit: number;
  weekdayMask: number | null;
  /** NOT_HOLIDAY=0 | HOLIDAY=1 | ANY=2 (HolidayKind) */
  holidayKind: number;
}

export interface TransformGenerator {
  sourceFrameId: string;
  shift: number | null;
  scale: number | null;
}

export type FrameGenerator =
  | { kind: "step"; value: StepGenerator }
  | { kind: "reference"; value: ReferenceGenerator }
  | { kind: "calendar"; value: CalendarGenerator }
  | { kind: "transform"; value: TransformGenerator };

export interface FrameRule {
  id: string;
  generator: FrameGenerator;
  active: ConditionNode | null;
}

// ---------- Frame (worker eval unit — not a Placement) ----------

export interface Frame {
  id: string;
  ownerId: string;
  recurringTile: string;
  frameRuleId: string;
  rangeStart: string;
  rangeEnd: string;
  sourceRevision: number;
  createdAt: string;
}

// ---------- RecurringOutput (RecurringRule output element) ----------

/** RecurringOutput.kind: PROPOSE_PLACEMENT=0 | PROPOSE_CHANGE=1 */
export interface RecurringOutput {
  kind: number;
  proposal: PlacementProposalDraft | null;
  change: import("./change-set").ChangeRule | null;
}

export interface RecurringRule {
  id: string;
  when: ConditionNode | null;
  rank: number;
  outputs: RecurringOutput[];
}

// ---------- Recurring ----------

export interface Recurring {
  tileId: string;
  plan: Plan;
  life: RecurringLife;
  frames: Frame[];
  rules: RecurringRule[];
}

// ---------- Convenience: Window re-export (anchor for tile.ts consumers) ----------
export type { Window };