import { afterEach, describe, expect, it, vi } from "vitest";
import { type PromptView, describePromptSubject } from "./prompts";

const client = { baseUrl: "/api/proxy", useProxyBridge: true, getIdToken: async () => null };

function serve(routes: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace("/api/proxy", "");
      if (!(path in routes)) return new Response("{}", { status: 404 });
      return new Response(JSON.stringify(routes[path]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
}

const missedStart = (placementId: string): PromptView => ({
  id: "p1",
  kind: 1,
  subject: { kind: 1, id: placementId },
  note: null,
  created_at: "2026-10-19T00:00:00Z",
  expires_at: null,
});

const placement = (sourceTileId: string | null) => ({
  id: "pl1",
  tile_id: "t1",
  span_start: "2026-10-19T01:00:00Z",
  span_end: "2026-10-19T01:30:00Z",
  source_tile_id: sourceTileId,
});

const source = (kind: number) => ({ source: { schedule: { generation: { kind } } } });

afterEach(() => vi.unstubAllGlobals());

describe("describePromptSubject", () => {
  it("offers the source for a one-time or recurring occurrence", async () => {
    serve({ "/v1/placements/pl1": placement("s1"), "/v1/tiles/t1": { id: "t1", title: "Write" }, "/v1/source-tiles/s1": source(1) });
    const subject = await describePromptSubject(client, missedStart("pl1"));
    expect(subject).toMatchObject({ title: "Write", placementId: "pl1", sourceTileId: "s1" });
  });

  it("does not offer a demand-driven source, which reflow does not re-place", async () => {
    serve({ "/v1/placements/pl1": placement("s2"), "/v1/tiles/t1": { id: "t1", title: "Break" }, "/v1/source-tiles/s2": source(2) });
    const subject = await describePromptSubject(client, missedStart("pl1"));
    expect(subject.sourceTileId).toBeNull();
    expect(subject.placementId).toBe("pl1");
  });

  it("does not offer a source it cannot read", async () => {
    serve({ "/v1/placements/pl1": placement("s3"), "/v1/tiles/t1": { id: "t1", title: "Write" } });
    const subject = await describePromptSubject(client, missedStart("pl1"));
    expect(subject.sourceTileId).toBeNull();
  });
});
