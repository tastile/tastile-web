/**
 * v1 ChangeSet — tastile-core/v1/04-change-set.md
 *
 * Interfaces only. No business logic.
 */

import type {
  ChangeKindValue,
  ChangeLayerValue,
  ChangeSourceValue,
  MergeModeValue,
} from "./constants";
import type { ConditionNode } from "./condition";

// ---------- Key (numeric 3-element structure) ----------

export interface Key {
  /** PLAN=0 | TIME_REQUIREMENT=1 | TASK=2 | RULE=3 | NEST=4 | PLACEMENT=5 | EXECUTION_INPUT=6 */
  group: number;
  /** UUIDv7 identifying the specific element (TaskId, RuleId, …). null when no item. */
  item: string | null;
  /** Numeric part constant scoped to `group` (see v1/04 §Key.part). */
  part: number;
}

// ---------- Activation / Revoked ----------

export interface Activation {
  when: ConditionNode | null;
  until: string | null;
}

export interface Revoked {
  at: string;
  reason: string | null;
  actorId: string;
}

// ---------- Change ----------

export interface ChangeValue {
  // Tagged union: `kind` discriminates the payload shape.
  kind: ChangeKindValue;
  /** SET: scalar replacement (number | string | boolean | null). */
  scalar: ScalarReplace | null;
  /** CLEAR: optional sentinel. */
  cleared: boolean;
  /** PUT: identified element update. */
  put: IdentifiedPut | null;
  /** DROP: identified element exclusion. */
  drop: IdentifiedDrop | null;
}

export interface ScalarReplace {
  // `value` is intentionally `unknown` to mirror the spec; concrete shapes
  // are constrained at the read/resolve layer using `Key.group`.
  value: unknown;
}

export interface IdentifiedPut {
  elementId: string;
  element: unknown;
}

export interface IdentifiedDrop {
  elementId: string;
}

export interface ChangeSource {
  kind: ChangeSourceValue;
  origin: ChangeOrigin | null;
}

export type ChangeOrigin =
  | { kind: "recurring"; recurring: VersionRef; frame: FrameRef }
  | { kind: "flow"; flow: VersionRef; frame: FrameRef }
  | { kind: "user" }
  | { kind: "decision"; feedbackTxn: string; decisionRun: string }
  | { kind: "execution"; execution: VersionRef };

export interface VersionRef {
  id: string;
  revision: number;
}

export interface FrameRef {
  id: string;
  rangeStart: string;
}

export interface ProposalKey {
  producerId: string;
  localId: string;
}

export interface Change {
  id: string;
  key: Key;
  layer: ChangeLayerValue;
  rank: number;
  value: ChangeValue;
  source: ChangeSource;
  activation: Activation;
  revoked: Revoked | null;
}

// ---------- ChangeRule (target → placementChange conversion unit) ----------

export interface ChangeRule {
  id: string;
  when: ConditionNode | null;
  rank: number;
  /** Per-Key merge mode for this rule's output. */
  merge: MergeModeValue;
  changes: Change[];
}

// ---------- ChangeSet ----------

export interface ChangeSet {
  id: string;
  aggregateId: string;
  changes: Change[];
}