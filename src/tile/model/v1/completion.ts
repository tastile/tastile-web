/**
 * v1 Plan Completion — tastile-core/v1/13-completion.md
 *
 * Interfaces only. No business logic.
 */

import type { ConditionNode } from "./condition";
import type {
  TaskOrderRelationValue,
  TimeAggregateValue,
  TimeQuantifierValue,
  TimeScopeValue,
  TimeSourceValue,
} from "./constants";

// ---------- TimeObservation ----------

interface TimeObservation {
  scope: TimeScopeValue;
  source: TimeSourceValue;
  aggregate: TimeAggregateValue;
  quantifier: TimeQuantifierValue | null;
}

// ---------- TimeRequirement ----------

interface ScalarRange {
  minMs: number | null;
  maxMs: number | null;
}

export interface TimeRequirement {
  id: string;
  observation: TimeObservation;
  required: ScalarRange;
  preferred: ScalarRange | null;
}

// ---------- TaskDefinition ----------

interface Content {
  title: string;
  note: string | null;
}

interface TaskOrderRule {
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

// ---------- Completion (root + elements) ----------

export interface Completion {
  root: ConditionNode;
  timeRequirements: TimeRequirement[];
  tasks: TaskDefinition[];
}
