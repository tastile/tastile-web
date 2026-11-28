import { describe, expect, it } from "vitest";
import type { SourceTileDetail } from "@/shared/api/v1/source-tiles";
import type { CommandResponse } from "@/shared/model/v1/envelope";
import {
  SOURCE_BLOCKED_REASON,
  blockedOccurrences,
  nextPlacements,
  reflowSummary,
  unplacedReasonKey,
} from "./reflow";

const occurrence = (over: Record<string, unknown>) =>
  ({
    occurrence_id: "occ-1",
    source_tile_id: "src-1",
    sequence_no: 1,
    nominal_at: "2026-01-01T09:00:00Z",
    window_start: "2026-01-01T08:00:00Z",
    window_end: "2026-01-01T10:00:00Z",
    required_duration_ms: 1800000,
    state: 0,
    revision: 1,
    blocked: null,
    ...over,
  }) as SourceTileDetail["occurrences"][number];

const placement = (over: Record<string, unknown>) =>
  ({
    placement_id: "pl-1",
    source_tile_id: "src-1",
    occurrence_id: "occ-1",
    split_group_id: "sg-1",
    split_index: 0,
    split_count: 1,
    start: "2026-01-01T09:00:00Z",
    end: "2026-01-01T09:30:00Z",
    closed: false,
    closed_at: null,
    revision: 1,
    ...over,
  }) as SourceTileDetail["placements"][number];

const detail = (over: Partial<SourceTileDetail>): SourceTileDetail =>
  ({ occurrences: [], placements: [], relations: [], ...over }) as SourceTileDetail;

describe("unplacedReasonKey", () => {
  it("maps the numeric SourceBlockedReason registry", () => {
    expect(unplacedReasonKey(SOURCE_BLOCKED_REASON.INSUFFICIENT_CAPACITY)).toBe(
      "insufficientCapacity",
    );
    expect(unplacedReasonKey(SOURCE_BLOCKED_REASON.LIMIT_CONFLICT)).toBe("limitConflict");
    expect(unplacedReasonKey(SOURCE_BLOCKED_REASON.PRIORITY_TIE_CONFLICT)).toBe(
      "priorityTieConflict",
    );
    expect(unplacedReasonKey(99)).toBe("unknown");
  });
});

describe("blockedOccurrences", () => {
  it("returns only occurrences with a blocked record, nominal order", () => {
    const d = detail({
      occurrences: [
        occurrence({ occurrence_id: "b", nominal_at: "2026-01-02T09:00:00Z" }),
        occurrence({
          occurrence_id: "a",
          nominal_at: "2026-01-01T09:00:00Z",
          blocked: {
            reason: 2,
            required_duration_ms: 60000,
            available_duration_ms: 0,
            blocked_at: "2026-01-01T08:00:00Z",
            conflicting_source_tile_id: "peer-1",
          },
        }),
      ],
    });
    const blocked = blockedOccurrences(d);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].occurrence.occurrence_id).toBe("a");
    expect(blocked[0].blocked.reason).toBe(2);
  });
});

describe("nextPlacements", () => {
  const now = "2026-01-01T00:00:00Z";

  it("keeps open placements ending after now, earliest first, capped", () => {
    const d = detail({
      placements: [
        placement({ placement_id: "past", start: "2025-12-31T09:00:00Z", end: "2025-12-31T09:30:00Z" }),
        placement({ placement_id: "closed", closed: true, start: "2026-01-01T10:00:00Z", end: "2026-01-01T11:00:00Z" }),
        placement({ placement_id: "b", start: "2026-01-01T14:00:00Z", end: "2026-01-01T15:00:00Z" }),
        placement({ placement_id: "a", start: "2026-01-01T09:00:00Z", end: "2026-01-01T10:00:00Z" }),
      ],
    });
    const next = nextPlacements(d.placements, now);
    expect(next.map((p) => p.placement_id)).toEqual(["a", "b"]);
  });

  it("respects the limit", () => {
    const placements = Array.from({ length: 8 }, (_, i) =>
      placement({
        placement_id: `p${i}`,
        start: `2026-01-0${i + 1}T09:00:00Z`,
        end: `2026-01-0${i + 1}T10:00:00Z`,
      }),
    );
    expect(nextPlacements(placements, now, 3)).toHaveLength(3);
  });
});

describe("reflowSummary", () => {
  const response = (meta: unknown): CommandResponse =>
    ({
      commandId: "cmd-1",
      acceptedAt: "2026-01-01T00:00:00Z",
      aggregate: null,
      revision: 2,
      result: 0,
      pending: [],
      aggregateMeta: meta,
    }) as CommandResponse;

  it("counts placed ids and carries unplaced occurrences", () => {
    const s = reflowSummary(
      response({
        occurrenceIds: ["o1", "o2"],
        placementIds: ["p1"],
        unplacedOccurrences: [
          {
            occurrenceId: "o3",
            reason: 0,
            requiredDurationMs: 3600000,
            availableDurationMs: 0,
            blockedAt: "2026-01-01T00:00:00Z",
            conflictingSourceTileId: null,
          },
        ],
      }),
    );
    expect(s.placedOccurrences).toBe(2);
    expect(s.placements).toBe(1);
    expect(s.unplaced).toHaveLength(1);
    expect(s.unplaced[0].reason).toBe(0);
  });

  it("handles a missing aggregateMeta", () => {
    const s = reflowSummary(response(null));
    expect(s.placedOccurrences).toBe(0);
    expect(s.unplaced).toEqual([]);
  });
});
