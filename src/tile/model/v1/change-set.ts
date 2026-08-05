/**
 * v1 ChangeSet — tastile-core/v1/04-change-set.md
 *
 * Interfaces only. No business logic.
 */

import type { ConditionNode } from "./condition";
import type {
  ChangeKindValue,
  ChangeLayerValue,
  ChangeSourceValue,
  MergeModeValue,
} from "./constants";

// ---------- Key (numeric 3-element structure) ----------

interface Key {
  /** PLAN=0 | TIME_REQUIREMENT=1 | TASK=2 | RULE=3 | NEST=4 | PLACEMENT=5 | EXECUTION_INPUT=6 */
  group: number;
  /** UUIDv7 identifying the specific element (TaskId, RuleId, …). null when no item. */
  item: string | null;
  /** Numeric part constant scoped to `group` (see v1/04 §Key.part). */
  part: number;
}

// ---------- Activation / Revoked ----------

interface Activation {
  when: ConditionNode | null;
  until: string | null;
}

interface Revoked {
  at: string;
  reason: string | null;
  actorId: string;
}

// ---------- Change ----------

interface ChangeValue {
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

interface ScalarReplace {
  // `value` is intentionally `unknown` to mirror the spec; concrete shapes
  // are constrained at the read/resolve layer using `Key.group`.
  value: unknown;
}

interface IdentifiedPut {
  elementId: string;
  element: unknown;
}

interface IdentifiedDrop {
  elementId: string;
}

interface ChangeSource {
  kind: ChangeSourceValue;
  origin: ChangeOrigin | null;
}

type ChangeOrigin =
  | { kind: "recurring"; recurring: VersionRef; frame: FrameRef }
  | { kind: "flow"; flow: VersionRef; frame: FrameRef }
  | { kind: "user" }
  | { kind: "decision"; feedbackTxn: string; decisionRun: string }
  | { kind: "execution"; execution: VersionRef };

interface VersionRef {
  id: string;
  revision: number;
}

interface FrameRef {
  id: string;
  rangeStart: string;
}

interface Change {
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
