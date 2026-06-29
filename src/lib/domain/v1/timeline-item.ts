/**
 * v1 TimelineItem — tastile-core/crates/v1/domain/src/read.rs §TimelineItem
 * Response of /v1/calendar/{day,week,month} (which forwards to /v1/timeline).
 */

import type {
  ApiErrorKindValue,
  PlacementSourceValue,
  PlanRoleValue,
  ResolutionStateValue,
} from "./constants";
import type { Span } from "./window";

export interface TimelineItemContent {
  title: string;
  description: string | null;
}

export interface TimelineItemVisual {
  color: string | null;
  icon: string | null;
}

export interface TimelineItemInside {
  parent: string;
  /** ScopeKind numeric value (no exported alias in constants.ts as of v1). */
  scope: number;
}

export interface TimelineItemSource {
  kind: PlacementSourceValue;
  detail: string | null;
}

export interface TimelineItemResolution {
  state: ResolutionStateValue;
  resolved_at: string;
  resolution_hash: string;
  violations: Array<{
    kind: ApiErrorKindValue;
    message: string;
    current_revision: number | null;
  }>;
}

export interface TimelineItem {
  placement_id: string;
  revision: number;
  content: TimelineItemContent;
  visual: TimelineItemVisual;
  role: PlanRoleValue;
  span: Span;
  inside: TimelineItemInside | null;
  source: TimelineItemSource;
  resolution: TimelineItemResolution;
}