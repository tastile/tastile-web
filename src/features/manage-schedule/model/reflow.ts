import type {
  PlacementTileRead,
  SourceOccurrenceRead,
  SourceTileDetail,
} from "@/shared/api/v1/source-tiles";
import type {
  CommandResponse,
  UnplacedOccurrenceInfo,
} from "@/shared/model/v1/envelope";

/**
 * `SourceBlockedReason` numeric registry (v1/09 §配置競合の決定規則と未配置理由,
 * v1/10 §10). Clients must branch on the number, never on message text.
 */
export const SOURCE_BLOCKED_REASON = {
  INSUFFICIENT_CAPACITY: 0,
  LIMIT_CONFLICT: 1,
  PRIORITY_TIE_CONFLICT: 2,
} as const;

/** i18n key suffix under `panels.schedule.reflow.reasons.*`. */
export function unplacedReasonKey(reason: number): string {
  switch (reason) {
    case SOURCE_BLOCKED_REASON.INSUFFICIENT_CAPACITY:
      return "insufficientCapacity";
    case SOURCE_BLOCKED_REASON.LIMIT_CONFLICT:
      return "limitConflict";
    case SOURCE_BLOCKED_REASON.PRIORITY_TIE_CONFLICT:
      return "priorityTieConflict";
    default:
      return "unknown";
  }
}

export interface BlockedOccurrence {
  occurrence: SourceOccurrenceRead;
  blocked: NonNullable<SourceOccurrenceRead["blocked"]>;
}

/**
 * Occurrences carrying a placement-failure blocked record, in nominal
 * order. `state` alone cannot identify failures (v1/09): only the
 * presence of `blocked` counts.
 */
export function blockedOccurrences(detail: SourceTileDetail): BlockedOccurrence[] {
  return detail.occurrences
    .filter(
      (o): o is SourceOccurrenceRead & { blocked: NonNullable<typeof o.blocked> } =>
        o.blocked != null,
    )
    .sort((a, b) => a.nominal_at.localeCompare(b.nominal_at))
    .map((occurrence) => ({ occurrence, blocked: occurrence.blocked }));
}

/**
 * Next upcoming placements for the "next schedule" read-out: open
 * placements whose span has not fully elapsed, earliest first.
 */
export function nextPlacements(
  placements: PlacementTileRead[],
  nowIso: string,
  limit = 5,
): PlacementTileRead[] {
  return placements
    .filter((p) => !p.closed && p.end > nowIso)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

export interface ReflowSummary {
  placedOccurrences: number;
  placements: number;
  unplaced: UnplacedOccurrenceInfo[];
}

/**
 * Counts carried by a reflow/preview CommandResponse. `occurrenceIds` /
 * `placementIds` only list what was placed; `unplacedOccurrences` is
 * where the *why* lives (v1/14 §4).
 */
export function reflowSummary(response: CommandResponse): ReflowSummary {
  const meta = response.aggregateMeta;
  return {
    placedOccurrences: meta?.occurrenceIds?.length ?? 0,
    placements: meta?.placementIds?.length ?? 0,
    unplaced: meta?.unplacedOccurrences ?? [],
  };
}
