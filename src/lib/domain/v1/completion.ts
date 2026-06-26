/**
 * v1 Plan Completion — tastile-core/v1/13-completion.md
 *
 * Interfaces only. No business logic.
 */

import type {
  TimeAggregateValue,
  TimeQuantifierValue,
  TimeScopeValue,
  TimeSourceValue,
  TaskOrderRelationValue,
} from "./constants";
import type { ConditionNode } from "./condition";

// ---------- TimeObservation ----------

export interface TimeObservation {
  scope: TimeScopeValue;
  source: TimeSourceValue;
  aggregate: TimeAggregateValue;
  quantifier: TimeQuantifierValue | null;
}

// ---------- TimeRequirement ----------

export interface ScalarRange {
  minMs: number | null;
  maxMs: number | null;
}

export interface ScalarTarget {
  kind: number;
  value: number | null;
  range: ScalarRange | null;
}

export interface TimeRequirement {
  id: string;
  observation: TimeObservation;
  required: ScalarRange;
  preferred: ScalarTarget | null;
}

// ---------- TaskDefinition ----------

export interface Content {
  title: string;
  note: string | null;
}

export interface TaskOrderRule {
  id: string;
  targetTaskId: string;
  relation: TaskOrderRelationValue;
  when: ConditionNode | null;
}

export interface TaskDefinition {
  id: string;
  content: Content;
  show: ConditionNode | null;
  complete: ConditionNode;
  order: TaskOrderRule[];
}

// ---------- CompletionResult (derived; not authoritative) ----------

export interface CompletionTermResult {
  termId: string;
  met: boolean;
  evaluatedAt: string;
}

export interface CompletionResult {
  met: boolean;
  evaluatedAt: string;
  terms: CompletionTermResult[];
}

// ---------- Completion (root + elements) ----------

export interface Completion {
  root: ConditionNode;
  timeRequirements: TimeRequirement[];
  tasks: TaskDefinition[];
}