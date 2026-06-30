import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./endpoints";
import {
  createTileCommand,
  startTileExecutionCommand,
  updateTileCommand,
} from "./tile-commands";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

const client: ApiClient = {
  baseUrl: "/api/proxy",
  useProxyBridge: true,
  getIdToken: async () => null,
};

const commandResponse = {
  command_id: "cmd",
  accepted_at: "2026-06-28T00:00:00.000Z",
  aggregate: null,
  revision: null,
  result: 0,
  pending: [],
};

describe("tile v1 commands", () => {
  beforeEach(() => mockFetch.mockReset());

  it("creates placement tiles through POST /v1/tiles with default visual fields", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandResponse));

    const res = await createTileCommand({ client, title: "  New tile  " });

    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/proxy/v1/tiles");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.payload).toMatchObject({
      kind: 1,
      title: "New tile",
      color: "#3b82f6",
      icon: "check-circle",
      plan_role: 0,
      owner_subject_id: null,
    });
  });

  it("includes owner_subject_id in payload when provided", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandResponse));

    const res = await createTileCommand({
      client,
      title: "In workspace",
      ownerSubjectId: "ws-uuid-1234",
    });

    expect(res.ok).toBe(true);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.payload.owner_subject_id).toBe("ws-uuid-1234");
  });

  it("updates tile identity through POST /v1/tiles/{id}/update", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandResponse));

    const res = await updateTileCommand({
      client,
      tileId: "tile-1",
      title: "  Renamed  ",
    });

    expect(res.ok).toBe(true);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/proxy/v1/tiles/tile-1/update");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).payload).toEqual({
      tile_id: "tile-1",
      title: "Renamed",
    });
  });

  it("includes owner_subject_id in update payload when provided", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandResponse));

    const res = await updateTileCommand({
      client,
      tileId: "tile-1",
      ownerSubjectId: "ws-uuid-1234",
    });

    expect(res.ok).toBe(true);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).payload.owner_subject_id).toBe("ws-uuid-1234");
  });

  it("starts a tile by creating a placement and then starting execution", async () => {
    mockFetch
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregate: { kind: 1, id: "placement-1" },
        }),
      )
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregate: { kind: 2, id: "execution-1" },
        }),
      );

    const res = await startTileExecutionCommand({
      client,
      tileId: "tile-1",
      planId: "plan-1",
      start: "2026-06-28T00:00:00.000Z",
      end: "2026-06-28T00:25:00.000Z",
    });

    expect(res).toEqual({
      ok: true,
      placementId: "placement-1",
      executionId: "execution-1",
    });
    const [placementUrl, placementInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(placementUrl).toBe("/api/proxy/v1/tiles/tile-1/start");
    expect(placementInit.method).toBe("POST");
    expect(JSON.parse(placementInit.body as string).payload).toMatchObject({
      tile_id: "tile-1",
      plan_id: "plan-1",
      source: 0,
      baseline: {
        span: {
          start: "2026-06-28T00:00:00.000Z",
          end: "2026-06-28T00:25:00.000Z",
        },
        inside: null,
      },
    });

    const [executionUrl, executionInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(executionUrl).toBe("/api/proxy/v1/placements/placement-1/executions");
    expect(executionInit.method).toBe("POST");
    expect(JSON.parse(executionInit.body as string).payload).toEqual({
      placement_id: "placement-1",
    });
  });
});
