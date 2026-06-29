/**
 * v1 TimelineItem — tastile-core/v1/domain/src/read.rs §TimelineItem
 * Response of /v1/calendar/{day,week,month} (which forwards to /v1/timeline).
 */

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
  scope: number;
}

export interface TimelineItemSource {
  kind: number;
  detail: string | null;
}

export interface TimelineItemResolution {
  state: number;
  resolved_at: string;
  resolution_hash: string;
  violations: Array<{ kind: number; message: string; current_revision: number | null }>;
}

export interface TimelineItem {
  placement_id: string;
  revision: number;
  content: TimelineItemContent;
  visual: TimelineItemVisual;
  role: number;
  span: { start: string; end: string };
  inside: TimelineItemInside | null;
  source: TimelineItemSource;
  resolution: TimelineItemResolution;
}
