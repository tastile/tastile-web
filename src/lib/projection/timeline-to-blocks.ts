import { PlanRole, ResolutionState } from "@/tile/model/v1/constants";
import type { TimelineItem } from "@/tile/model/v1/timeline-item";

type CalendarBlockKind = "work" | "break" | "label" | "scheduled";
type SemanticRole = "work" | "break" | "label";
type Ownership = "tastile_owned" | "remote_owned" | "synthetic";

interface CalendarBlockView {
  tile_id: string | null;
  title: string;
  kind: CalendarBlockKind;
  is_active: boolean;
  start_at: string;
  end_at: string;
  semantic_role: SemanticRole;
  all_day: boolean;
  ownership: Ownership;
  editable: boolean;
  source_label: string;
}

export interface TimelineProjection {
  blocks: CalendarBlockView[];
  allDaySpans: CalendarBlockView[];
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function isAllDay(item: TimelineItem): boolean {
  if (item.role === PlanRole.LABEL) return true;
  return dateKey(item.span.start) !== dateKey(item.span.end);
}

function roleToKind(role: number): CalendarBlockKind {
  switch (role) {
    case PlanRole.LABEL:
      return "label";
    default:
      return "work";
  }
}

function roleToSemantic(role: number): SemanticRole {
  switch (role) {
    case PlanRole.LABEL:
      return "label";
    default:
      return "work";
  }
}

function ownershipFor(state: number): Ownership {
  if (state === ResolutionState.BLOCKED) return "synthetic";
  return "tastile_owned";
}

export function timelineResponseToBlocks(items: TimelineItem[]): TimelineProjection {
  const blocks: CalendarBlockView[] = [];
  const allDaySpans: CalendarBlockView[] = [];
  for (const it of items) {
    const isActive = it.resolution.state === ResolutionState.OPEN;
    const block: CalendarBlockView = {
      tile_id: it.placement_id,
      title: it.content.title,
      kind: roleToKind(it.role),
      is_active: isActive,
      start_at: it.span.start,
      end_at: it.span.end,
      semantic_role: roleToSemantic(it.role),
      all_day: isAllDay(it),
      ownership: ownershipFor(it.resolution.state),
      editable: it.role === PlanRole.EXECUTABLE,
      source_label: it.visual.icon ?? "tile",
    };
    if (block.all_day) allDaySpans.push(block);
    else blocks.push(block);
  }
  return { blocks, allDaySpans };
}
