/**
 * v1 Execution — tastile-core/v1/02-core-entities.md §Execution
 *
 * Interfaces only. No business logic.
 */

import type {
  ExecutionSegmentKindValue,
  ExecutionStateValue,
} from "./constants";
import type { VersionRef } from "./change-set";
import type { EffectivePlacementRef, ResolutionInfo } from "./placement";

// ---------- ExecutionSegment (child table) ----------

export interface ExecutionSegment {
  id: string;
  executionId: string;
  /** ACTIVE=0 | PAUSED=1 (ExecutionSegmentKind) */
  kind: ExecutionSegmentKindValue;
  startAt: string;
  endAt: string | null;
  revision: number;
}

// ---------- ExecutionBasis (frozen snapshot at start) ----------

export interface BasisValue {
  key: string;
  value: unknown;
}

export interface ExecutionBasis {
  captured: string;
  placement: VersionRef;
  effective: EffectivePlacementRef;
  values: BasisValue[];
  resolutionHash: string;
}

// ---------- TaskRun / Fact / Track (child tables) ----------

export interface TaskRun {
  id: string;
  executionId: string;
  taskId: string;
  marked: boolean;
  completedAt: string | null;
  revision: number;
}

export interface Fact {
  id: string;
  executionId: string;
  /** Fact kind value — defined per-FactTerm; kept numeric here. */
  kind: number;
  value: number | string | null;
  capturedAt: string;
}

export interface TrackEvent {
  at: string;
  kind: number;
  note: string | null;
}

// ---------- Execution (the aggregate) ----------

export interface ExecutionFinish {
  /** FINISHED_NORMAL=0 | FINISHED_VOID=1 */
  kind: number;
  at: string;
  note: string | null;
}

export interface Execution {
  id: string;
  tileId: string;
  /** Origin Placement reference. */
  sourcePlacement: VersionRef;
  basis: ExecutionBasis;
  /** ACTIVE=0 | PAUSED=1 | FINISHED_NORMAL=2 | FINISHED_VOID=3 (ExecutionState) */
  state: ExecutionStateValue;
  segments: ExecutionSegment[];
  taskRuns: TaskRun[];
  facts: Fact[];
  track: TrackEvent[];
  finish: ExecutionFinish | null;
}

// ---------- Effective view (derived) ----------

export interface EffectiveExecution {
  execution: Execution;
  revision: number;
  resolution: ResolutionInfo;
}