import { describe, expect, it, vi } from "vitest";
import { getSourceTile, listSourceTilePlacements, reflowSourceTile } from "./source-tiles";

const client = {
  baseUrl: "https://core.example",
  getIdToken: vi.fn().mockResolvedValue("token"),
};

const range = { start: "2026-07-19T00:00:00Z", end: "2026-07-20T00:00:00Z" };

describe("SourceTile client", () => {
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
    fetchMock.mockRestore();
  });
});
