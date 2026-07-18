import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSourceTile,
  getSourceTile,
  listSourceTilePlacements,
  reflowSourceTile,
  type SourceTileCreatePayload,
  updateSourceTile,
} from "./source-tiles";

const client = {
  baseUrl: "https://core.example",
  getIdToken: vi.fn().mockResolvedValue("token"),
};

const range = { start: "2026-07-19T00:00:00Z", end: "2026-07-20T00:00:00Z" };

afterEach(() => vi.restoreAllMocks());

const sourceDefinition: SourceTileCreatePayload = {
  tile: {
    title: "朝食",
    description: null,
    color: null,
    icon: null,
    external_id: null,
  },
  plan: {
    role: 0,
    references: [],
    completion: { root: { Any: [] }, time_requirements: [], tasks: [] },
    planning: { placement_rules: [], nesting_rules: [] },
    metrics: [],
    decisions: [],
  },
  flows: [],
  schedule: {
    required_duration_ms: 900000,
    generation: {
      kind: 1,
      at: null,
      starts_at: "2026-07-19T07:40:00Z",
      interval_ms: 86400000,
      ends_at: null,
      weekday_mask: null,
      date_range_start: null,
      date_range_end: null,
      excluded_dates: [],
    },
    window: { start_offset_ms: 0, end_offset_ms: 1200000 },
    split_policy: { kind: 0, min_segment_ms: null, max_segment_ms: null, max_segments: null },
    priority: 0,
  },
  horizon: range,
};

describe("SourceTile client", () => {
  it("creates and updates through the canonical SourceTile commands", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      command_id: "command-1", accepted_at: "2026-07-19T00:00:00Z",
    }), { status: 200 }));

    await createSourceTile({ client, payload: sourceDefinition });
    await updateSourceTile({
      client,
      sourceTileId: "source-1",
      expectedRevision: 2,
      payload: sourceDefinition,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://core.example/v1/source-tiles",
      "https://core.example/v1/source-tiles/source-1",
    ]);
    expect(fetchMock.mock.calls.map(([, init]) => (init as RequestInit).method)).toEqual(["POST", "PUT"]);
    for (const [index, [, init]] of fetchMock.mock.calls.entries()) {
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body).toMatchObject({
        expected_revision: index === 0 ? null : 2,
        idempotency_key: expect.any(String),
        occurred_at: expect.any(String),
        payload: sourceDefinition,
      });
      expect(body.payload).not.toHaveProperty("source_tile_id");
    }
  });

  it("uses source-specific read, reflow, and placement endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      source: { source_tile_id: "source-1" }, occurrences: [], placements: [],
    }), { status: 200 }));

    await getSourceTile(client, "source-1");
    await reflowSourceTile({ client, sourceTileId: "source-1", expectedRevision: 2, range });
    await listSourceTilePlacements(client, "source-1");

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://core.example/v1/source-tiles/source-1",
      "https://core.example/v1/source-tiles/source-1/reflow",
      "https://core.example/v1/source-tiles/source-1/placements",
    ]);
    expect(fetchMock.mock.calls.slice(1).map(([, init]) => (init as RequestInit).method)).toEqual(["POST", "GET"]);
  });
});
