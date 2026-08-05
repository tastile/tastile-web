/**
 * v1 Tile / Plan / Recurring — tastile-core/v1/02-core-entities.md
 * plus Plan Completion (v1/13), Nesting & Flow (v1/09), Recurring & Frame (v1/08).
 *
 * Interfaces only. No business logic.
 */

import type { DecisionDef } from "@/shared/api/v1/decision";
import type { ChangeRule } from "./change-set";
import type { Completion } from "./completion";
import type { ConditionNode } from "./condition";
import type { PlanRoleValue } from "./constants";
import type { Metric } from "./metric";
import type { Reference } from "./reference";
import type { DurationRange, Moment } from "./window";

// ---------- Planning (rules & flows) ----------

/** PlacementRuleEffect.scope.kind: ROOT=0 | HOST=1 | GAP=2 */
interface Scope {
  kind: number;
  parent: string | null;
  gap: GapScope | null;
}

interface GapScope {
  leftAnchor: string;
  rightAnchor: string;
  size: DurationRange | null;
}

/** PlacementRuleEffect.record: OPTIONAL=0 | REQUIRED=1 */
type RecordRequirement = number | null;

interface PlacementRuleEffect {
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
interface NestingRule {
  id: string;
  direction: number;
  when: ConditionNode | null;
  rank: number;
  target: Reference;
  scope: Scope;
}

// ---------- Flow ----------

/** Signal kinds are implementation-defined; we keep them numeric. */
interface Signal {
  id: string;
  kind: number;
  /** Parameters describing the signal source. */
  params: Record<string, unknown>;
}

/** FlowOutput.kind: PROPOSE_PLACEMENT=0 | PROPOSE_CHANGE=1 */
interface PlacementProposalDraft {
  title: string;
  baselineSpan: { start: string; end: string };
  inside: { parentId: string | null; scopeKind: number };
  sourceRef: string | null;
  proposalKey: { producerId: string; localId: string };
}

interface FlowOutput {
  kind: number;
  proposal: PlacementProposalDraft | null;
  change: ChangeRule | null;
}

interface FlowCandidate {
  id: string;
  when: ConditionNode;
  rank: number;
  outputs: FlowOutput[];
}

interface Flow {
  id: string;
  observe: Signal[];
  when: ConditionNode | null;
  candidates: FlowCandidate[];
}

interface Planning {
  placementRules: PlacementRule[];
  nestingRules: NestingRule[];
  flows: Flow[];
}

// ---------- Decision ----------

interface Decision {
  id: string;
  /** Decision kind is defined in v1/06; left as a numeric here. */
  kind: number;
  when: ConditionNode | null;
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    /** ChangeRule applied when the user picks this option. */
    change: ChangeRule | null;
  }>;
}

// Re-export DecisionDef for consumers that import from this module
;

// ---------- Plan ----------

export interface Plan {
  role: PlanRoleValue;
  references: Reference[];
  completion: Completion;
  planning: Planning;
  metrics: Metric[];
  decisions: DecisionDef[];
}

// ---------- FrameRule generators ----------

interface StepGenerator {
  step: number;
  origin: Moment | null;
  bounds: { start: string; end: string } | null;
}

interface ReferenceGenerator {
  referenceId: string;
  /** START=0 | END=1 | CENTER=2 */
  align: number;
}

interface CalendarGenerator {
  /** DAY=0 | WEEK=1 | MONTH=2 */
  unit: number;
  weekdayMask: number | null;
  /** NOT_HOLIDAY=0 | HOLIDAY=1 | ANY=2 (HolidayKind) */
  holidayKind: number;
}

interface TransformGenerator {
  sourceFrameId: string;
  shift: number | null;
  scale: number | null;
}

type FrameGenerator =
  | { kind: "step"; value: StepGenerator }
  | { kind: "reference"; value: ReferenceGenerator }
  | { kind: "calendar"; value: CalendarGenerator }
  | { kind: "transform"; value: TransformGenerator };

export interface FrameRule {
  id: string;
  generator: FrameGenerator;
  active: ConditionNode | null;
}

// ---------- RecurringOutput (RecurringRule output element) ----------

/** RecurringOutput.kind: PROPOSE_PLACEMENT=0 | PROPOSE_CHANGE=1 */
interface RecurringOutput {
  kind: number;
  proposal: PlacementProposalDraft | null;
  change: ChangeRule | null;
}

export interface RecurringRule {
  id: string;
  when: ConditionNode | null;
  rank: number;
  outputs: RecurringOutput[];
}
