import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./endpoints";
import {
  createManualPlacementCommand,
  createRecurringCommand,
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

  it("createRecurringCommand sends placeholder frame rule id and reads aggregateMeta.frameRuleId", async () => {
    // 3 round trips: 1) create recurring tile 2) add frame rule 3) materialize
    mockFetch
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregate: { kind: 0, id: "recurring-1" },
          aggregateMeta: { tileId: "tile-1", planId: "plan-1", recurringId: "recurring-1" },
        }),
      )
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregateMeta: { frameRuleId: "frame-rule-server-1" },
        }),
      )
      .mockResolvedValueOnce(okResponse(commandResponse));

    const res = await createRecurringCommand({
      client,
      title: "Daily standup",
      start: "2026-07-01T09:00:00.000Z",
      end: "2026-07-01T09:30:00.000Z",
      pattern: { kind: "daily" },
      occurrences: 1,
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tileId).toBe("recurring-1");
      expect(res.frameRuleId).toBe("frame-rule-server-1");
    }

    // Add-frame-rule payload must use a placeholder id, not a
    // client-generated uuidv7.
    const [, frameRuleInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    const frameRuleBody = JSON.parse(frameRuleInit.body as string);
    expect(frameRuleBody.payload.rule.id).toBe("00000000-0000-0000-0000-000000000000");

    // Materialize call must use the server-assigned frame rule id.
    const [materializeUrl, materializeInit] = mockFetch.mock.calls[2] as [string, RequestInit];
    expect(materializeUrl).toBe(
      "/api/proxy/v1/recurring/recurring-1/frame-rules/frame-rule-server-1/materialize",
    );
    expect(JSON.parse(materializeInit.body as string).payload.frame_rule_id).toBe(
      "frame-rule-server-1",
    );
  });

  it("createManualPlacementCommand uses aggregateMeta.planId without a follow-up GET", async () => {
    // 2 round trips: 1) create placement tile (returns plan_id in
    // aggregate_meta) 2) create placement.  No GET-after-POST.
    mockFetch
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregate: { kind: 1, id: "tile-1" },
          aggregateMeta: { tileId: "tile-1", planId: "plan-server-1" },
        }),
      )
      .mockResolvedValueOnce(
        okResponse({
          ...commandResponse,
          aggregate: { kind: 1, id: "placement-1" },
          aggregateMeta: {
            tileId: "tile-1",
            planId: "plan-server-1",
          },
        }),
      );

    const res = await createManualPlacementCommand({
      client,
      title: "Manual block",
      start: "2026-07-01T11:00:00.000Z",
      end: "2026-07-01T12:00:00.000Z",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tileId).toBe("tile-1");
      expect(res.planId).toBe("plan-server-1");
      expect(res.placementId).toBe("placement-1");
    }
    // Only 2 calls; no GET /v1/tiles/{id} round trip.
    expect(mockFetch.mock.calls.length).toBe(2);
    const [placementUrl, placementInit] = mockFetch.mock.calls[1] as [string, RequestInit];
    expect(placementUrl).toBe("/api/proxy/v1/placements");
    expect(JSON.parse(placementInit.body as string).payload.plan_id).toBe("plan-server-1");
  });

  it("createManualPlacementCommand surfaces a server-error if aggregate_meta.plan_id is missing", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        ...commandResponse,
        aggregate: { kind: 1, id: "tile-1" },
        // No aggregate_meta.plan_id (older server).
      }),
    );

    const res = await createManualPlacementCommand({
      client,
      title: "Manual block",
      start: "2026-07-01T11:00:00.000Z",
      end: "2026-07-01T12:00:00.000Z",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.stage).toBe("tile");
      expect(res.error.message).toMatch(/aggregate_meta\.plan_id/);
    }
    // No follow-up placement creation.
    expect(mockFetch.mock.calls.length).toBe(1);
  });
});
