import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchV1ActiveTile, v1ActiveTileSchema } from "./active-tile";
import type { Result } from "@/shared/api/endpoints";

const okEnvelope = (data: unknown) => ({
  ok: true,
  data,
  status: 200,
  latencyMs: 1,
});

const errEnvelope = (error: unknown) => ({
  ok: false,
  error,
});

const mockCall = vi.fn();

vi.mock("@/shared/api/endpoints", () => ({
  getCoreClient: () => ({ call: mockCall }),
}));

const validSnapshot = {
  tile_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8e",
  placement_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8f",
  execution_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d90",
  title: "Plan the launch",
  span_start: "2026-07-23T09:00:00.000Z",
  span_end: "2026-07-23T10:00:00.000Z",
};

describe("v1ActiveTileSchema", () => {
  it("parses a valid snapshot", () => {
    const parsed = v1ActiveTileSchema.parse(validSnapshot);
    expect(parsed.title).toBe("Plan the launch");
  });

  it("parses null execution_id", () => {
    const parsed = v1ActiveTileSchema.parse({ ...validSnapshot, execution_id: null });
    expect(parsed.execution_id).toBeNull();
  });

  it("rejects non-UUID tile_id", () => {
    const result = v1ActiveTileSchema.safeParse({ ...validSnapshot, tile_id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects non-ISO timestamp", () => {
    const result = v1ActiveTileSchema.safeParse({ ...validSnapshot, span_start: "tomorrow" });
    expect(result.success).toBe(false);
  });

  it("rejects wrong title type", () => {
    const result = v1ActiveTileSchema.safeParse({ ...validSnapshot, title: 42 });
    expect(result.success).toBe(false);
  });

  it("ignores unknown fields for forward compatibility", () => {
    const parsed = v1ActiveTileSchema.parse({ ...validSnapshot, extra_future_field: "ok" });
    expect(parsed.tile_id).toBe(validSnapshot.tile_id);
  });
});

describe("fetchV1ActiveTile", () => {
  beforeEach(() => mockCall.mockReset());
  afterEach(() => mockCall.mockReset());

  it("returns ok with parsed snapshot on 200", async () => {
    mockCall.mockResolvedValueOnce(okEnvelope(validSnapshot));
    const res = (await fetchV1ActiveTile()) as Result<Awaited<ReturnType<typeof fetchV1ActiveTile>> extends infer R ? R extends { ok: true; data: infer D } ? D : never : never>;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual(validSnapshot);
    }
  });

  it("returns ok with null data when server has no active tile", async () => {
    mockCall.mockResolvedValueOnce(okEnvelope(null));
    const res = (await fetchV1ActiveTile()) as Result<{
      data: typeof validSnapshot | null;
    }>;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toBeNull();
    }
  });

  it("returns ok with undefined data on empty body", async () => {
    mockCall.mockResolvedValueOnce(okEnvelope(undefined));
    const res = (await fetchV1ActiveTile()) as Result<{
      data: typeof validSnapshot | null | undefined;
    }>;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data == null).toBe(true);
    }
  });

  it("returns server-kind failure with stable generic message on malformed JSON", async () => {
    mockCall.mockResolvedValueOnce(okEnvelope({ tile_id: "not-a-uuid", title: 42 }));
    const res = await fetchV1ActiveTile();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("server");
      expect(res.error.status).toBe(502);
      expect(res.error.message).toBe("Invalid active-tile response");
      // Raw payload must not leak into the public error body.
      expect(JSON.stringify(res.error.body)).not.toContain("not-a-uuid");
    }
  });

  it("passes through transport failures unchanged", async () => {
    const upstreamError = {
      kind: "unauthorized" as const,
      status: 401,
      message: "missing id_token",
      body: null,
    };
    mockCall.mockResolvedValueOnce(errEnvelope(upstreamError));
    const res = await fetchV1ActiveTile();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toEqual(upstreamError);
    }
  });

  it("calls the getActiveTile endpoint key", async () => {
    mockCall.mockResolvedValueOnce(okEnvelope(validSnapshot));
    await fetchV1ActiveTile();
    expect(mockCall).toHaveBeenCalledWith("getActiveTile");
  });
});
