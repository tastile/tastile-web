import { type ApiClient, type Result, getRead } from "./endpoints";

/** Wire shape of GET /v1/placements items (snake_case, core read.rs). */
export interface PlacementListItem {
  placement_id: string;
  tile_id: string;
  plan_id: string | null;
  title: string;
  close_kind: number;
  detach_kind: number;
  span_start: string | null;
  span_end: string | null;
  source_tile_id: string | null;
  occurrence_id: string | null;
  split_index: number | null;
  split_count: number | null;
  split_group_id: string | null;
}

export function listPlacements(client: ApiClient): Promise<Result<PlacementListItem[]>> {
  return getRead<PlacementListItem[]>(client, "/v1/placements");
}

export interface StartableOccurrenceCandidate {
  placementId: string;
  spanStart: string | null;
  spanEnd: string | null;
  splitIndex: number | null;
}

const isOpen = (p: PlacementListItem) => p.close_kind === 0 && p.detach_kind === 0;

/**
 * Candidates for explicit-placement start after StartTile reports the
 * "exactly one unfinished live segment" conflict (core placement_repo
 * `start_tile`). Mirrors the server-side candidate predicate:
 *   (p.tile_id = :tile AND p.plan_id = :plan)
 *   OR (p.source_tile_id = :tile AND source.plan_id = :plan)
 * Split segments carry their own plan_id, so placements reached through
 * `source_tile_id` must not be re-filtered on `p.plan_id`. Executions state
 * is not exposed by the list endpoint; a stale candidate surfaces as a
 * normal command error on start, which the caller displays.
 */
export function selectStartableOccurrences(
  placements: PlacementListItem[],
  target: { tileId: string; planId: string },
): StartableOccurrenceCandidate[] {
  return placements
    .filter(
      (p) =>
        isOpen(p) &&
        p.occurrence_id !== null &&
        ((p.tile_id === target.tileId && p.plan_id === target.planId) ||
          p.source_tile_id === target.tileId),
    )
    .sort((a, b) => (a.span_start ?? "").localeCompare(b.span_start ?? ""))
    .map((p) => ({
      placementId: p.placement_id,
      spanStart: p.span_start,
      spanEnd: p.span_end,
      splitIndex: p.split_index,
    }));
}
