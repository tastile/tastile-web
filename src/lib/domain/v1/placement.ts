/**
 * v1 Placement — tastile-core/v1/02-core-entities.md §Placement
 *
 * Interfaces only. No business logic.
 */

import type {
  PlacementSourceValue,
  ResolutionStateValue,
} from "./constants";
import type { FrameRef, ProposalKey, VersionRef } from "./change-set";
import type { Stamp } from "./actor";
import type { Span } from "./window";

// ---------- PlacementSource detail ----------

export interface PlacementSource {
  kind: PlacementSourceValue;
  detail: PlacementSourceDetail | null;
}

export type PlacementSourceDetail =
  | { kind: "manual"; created: Stamp }
  | { kind: "recurring"; recurring: VersionRef; frame: FrameRef; proposal: ProposalKey }
  | { kind: "flow"; flow: VersionRef; frame: FrameRef | null; proposal: ProposalKey }
  | { kind: "import"; source: string; externalId: string | null };

// ---------- Inside (parent Placement relation) ----------

export interface PlacementInside {
  parentId: string | null;
  /** ROOT=0 | HOST=1 | GAP=2 (Scope.kind) */
  scopeKind: number;
  scopeReferenceId: string | null;
}

// ---------- Baseline (the canonical Span & Inside on Placement) ----------

export interface PlacementBaseline {
  span: Span;
  inside: PlacementInside;
}

// ---------- Life (detach / close) ----------

export interface PlacementLife {
  detached: boolean;
  closed: boolean;
  closedReason: string | null;
  closedAt: string | null;
}

// ---------- Placement (the aggregate) ----------

export interface Placement {
  id: string;
  tileId: string;
  source: PlacementSource;
  baseline: PlacementBaseline;
  life: PlacementLife;
}

// ---------- Effective view (read model only — derived) ----------

export interface EffectivePlacementRef {
  placementId: string;
  revision: number;
  resolutionHash: string;
}

export interface PlacementInsideView {
  parentId: string | null;
  scopeKind: number;
}

export interface PlacementSourceView {
  kind: PlacementSourceValue;
  detail: PlacementSourceDetail | null;
}

export interface ResolutionViolation {
  /** ApiErrorKind numeric value. */
  kind: number;
  message: string;
}

export interface ResolutionInfo {
  /** OPEN=0 | CLOSED=1 | BLOCKED=2 (ResolutionState) */
  state: ResolutionStateValue;
  resolvedAt: string;
  resolutionHash: string;
  violations: ResolutionViolation[];
}

export interface EffectivePlacement {
  placement: Placement;
  revision: number;
  span: Span;
  inside: PlacementInsideView;
  resolution: ResolutionInfo;
}