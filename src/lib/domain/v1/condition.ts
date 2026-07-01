/**
 * v1 Condition AST — tastile-core/v1/05-condition-and-reference.md
 *
 * Interfaces only. No business logic.
 */

import type { ConditionKindValue, HolidayKindValue } from "./constants";

// ---------- Term variants ----------

export interface CalendarTerm {
  weekdayMask: number;
  timeStart: string | null;
  timeEnd: string | null;
  holidayKind: HolidayKindValue;
  dateRange: DateRange | null;
  offsetMin: number;
}

export interface MomentTerm {
  // Defined in 05 §MomentTerm. Kept loose here — the spec uses
  // Moment references for absolute or relative times.
  referenceId: string | null;
  point: number | null;
  offsetMs: number;
}

export interface RelationTerm {
  referenceId: string;
  /** CONTAINS=0 | WITHIN=1 | OVERLAPS=2 | DISJOINT=3 | TOUCHES=4 (v1/05) */
  relation: number;
  /** ROOT=0 | LABEL_SPAN=1 | PARENT_SPAN=2 | GAP=3 (v1/05) */
  windowKind: number;
}

export interface GapTerm {
  /** TimeScope (v1/13) */
  scope: number;
  leftAnchor: AnchorSelector;
  rightAnchor: AnchorSelector;
  size: DurationRange | null;
}

export interface RequirementTerm {
  requirementId: string;
  /** MET=0 | NOT_MET=1 — see v1/13 CompletionResult */
  state: number;
}

export interface TaskTerm {
  taskId: string;
  /** VISIBLE=0 | MARKED=1 | COMPLETED=2 | NOT_COMPLETED=3 */
  state: number;
}

export interface FactTerm {
  factId: string;
  op: number;
  value: number | string | null;
}

export interface MetricTerm {
  metricId: string;
  op: number;
  value: number | string | null;
}

export interface FeedbackTerm {
  feedbackTxnId: string;
  op: number;
  value: number | string | null;
}

export interface LifeTerm {
  target: string;
  /** READY=0 | STARTED=1 | DONE=2 */
  state: number;
}

export type Term =
  | { kind: "calendar"; value: CalendarTerm }
  | { kind: "moment"; value: MomentTerm }
  | { kind: "relation"; value: RelationTerm }
  | { kind: "gap"; value: GapTerm }
  | { kind: "requirement"; value: RequirementTerm }
  | { kind: "task"; value: TaskTerm }
  | { kind: "fact"; value: FactTerm }
  | { kind: "metric"; value: MetricTerm }
  | { kind: "feedback"; value: FeedbackTerm }
  | { kind: "life"; value: LifeTerm };

// ---------- Condition node (recursive) ----------

export interface ConditionNode {
  kind: ConditionKindValue;
  children: ConditionNode[];
  term: Term | null;
}

// ---------- Supporting types ----------

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface DurationRange {
  minMs: number | null;
  maxMs: number | null;
}

export interface AnchorSelector {
  referenceId: string | null;
  /** Sub-select within the anchor (e.g. start / end). */
  point: number | null;
}
