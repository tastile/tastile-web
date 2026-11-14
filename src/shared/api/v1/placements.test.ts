import { describe, expect, it } from "vitest";

import {
  selectStartableOccurrences,
  type PlacementListItem,
} from "./placements";

function item(overrides: Partial<PlacementListItem>): PlacementListItem {
  return {
    placement_id: "p1",
    tile_id: "tile-1",
    plan_id: "plan-1",
    title: "t",
    close_kind: 0,
    detach_kind: 0,
    span_start: "2026-11-15T09:00:00Z",
    span_end: "2026-11-15T10:00:00Z",
    source_tile_id: null,
    occurrence_id: "occ-1",
    split_index: null,
    split_count: null,
    split_group_id: null,
    ...overrides,
  };
}

const target = { tileId: "tile-1", planId: "plan-1" };

describe("selectStartableOccurrences", () => {
  it("keeps open occurrence-linked placements for the tile/plan pair", () => {
    const out = selectStartableOccurrences(
      [
        item({ placement_id: "a", span_start: "2026-11-16T09:00:00Z" }),
        item({ placement_id: "b", source_tile_id: "tile-1", tile_id: "seg-1" }),
      ],
      target,
    );
    expect(out.map((c) => c.placementId)).toEqual(["b", "a"]);
  });

  it("keeps source-linked placements regardless of their segment plan_id", () => {
    const out = selectStartableOccurrences(
      [
        // Split segments get their own plan_id; the server matches them via
        // source_tile_id without re-checking p.plan_id.
        item({
          placement_id: "seg-a",
          tile_id: "seg-tile-a",
          plan_id: "seg-plan-a",
          source_tile_id: "tile-1",
        }),
      ],
      target,
    );
    expect(out.map((c) => c.placementId)).toEqual(["seg-a"]);
  });

  it("drops closed, detached, non-occurrence, and foreign placements", () => {
    const out = selectStartableOccurrences(
      [
        item({ placement_id: "closed", close_kind: 1 }),
        item({ placement_id: "detached", detach_kind: 1 }),
        item({ placement_id: "manual", occurrence_id: null }),
        item({ placement_id: "other-plan", plan_id: "plan-2" }),
        item({ placement_id: "other-tile", tile_id: "tile-9", source_tile_id: null }),
        item({ placement_id: "ok" }),
      ],
      target,
    );
    expect(out.map((c) => c.placementId)).toEqual(["ok"]);
  });

  it("sorts candidates by span_start ascending", () => {
    const out = selectStartableOccurrences(
      [
        item({ placement_id: "later", span_start: "2026-11-17T09:00:00Z" }),
        item({ placement_id: "earlier", span_start: "2026-11-15T09:00:00Z" }),
      ],
      target,
    );
    expect(out.map((c) => c.placementId)).toEqual(["earlier", "later"]);
  });
});
