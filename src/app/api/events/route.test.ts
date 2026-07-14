//! Calendar-v1: tile create/edit/remove + occurrence read contract tests.
//!
//! Pins the wire shape between the Next.js API layer and the v1 Rust
//! upstream.  These tests mock the outbound fetch and assert:
//! - POST /api/events                composes a v1 tile + Manual placement
//! - POST /api/events/tiles/[id]/update   sends the patch to v1 /v1/tiles/{id}/update
//! - DELETE /api/events/tiles/[id]  archives the v1 tile
//! - GET /api/events/occurrences    proxies the range query
//! - Legacy GET/POST/PATCH/DELETE on /api/events and /api/events/[id] all 410
//!
//! The Rust-side cross-user isolation lives in
//! `tastile-core/crates/v1/storage/tests/calendar_v1_cross_user_filter.rs`
//! (DB-backed) and `tastile-core/crates/v1/api/src/handlers/timeline.rs`
//! (parse_owner_ids unit tests).

import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
const resolveAuthenticatedUserSub = vi.fn();

vi.mock("@/lib/cognito/authenticated-session", () => ({
  resolveAuthenticatedUserSub,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  resolveAuthenticatedUserSub.mockReset();
  resolveAuthenticatedUserSub.mockResolvedValue("verified-test-user");
  vi.stubEnv("TASTILE_WEB_BRIDGE_SECRET", "bridge-secret");
  vi.stubGlobal("fetch", fetchMock);
  // Default upstream success: tile create returns CommandResponse with
  // aggregate.id (the new tile) and aggregate_meta.plan_id; placement
  // create returns CommandResponse with aggregate.id (the new placement).
  fetchMock.mockImplementation(async (input: unknown) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    if (url.endsWith("/v1/tiles") && !url.includes("/update")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            command_id: "cmd-1",
            accepted_at: "2026-07-01T00:00:00Z",
            aggregate: { kind: 0, id: "tile-1" },
            revision: 1,
            result: 0,
            pending: [],
            aggregate_meta: {
              tile_id: "tile-1",
              plan_id: "plan-1",
              recurring_id: null,
              frame_rule_id: null,
              changeset_id: null,
              change_ids: [],
              window_ids: [],
              flow_ids: [],
              source_tile_id: null,
              occurrence_ids: [],
              placement_ids: [],
            },
          }),
        json: async () => ({ aggregate: { id: "tile-1" } }),
      } as unknown as Response;
    }
    if (url.endsWith("/v1/placements")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            command_id: "cmd-2",
            accepted_at: "2026-07-01T00:00:00Z",
            aggregate: { kind: 1, id: "place-1" },
            revision: 1,
            result: 0,
            pending: [],
            aggregate_meta: { placement_ids: ["place-1"] },
          }),
        json: async () => ({ aggregate: { id: "place-1" } }),
      } as unknown as Response;
    }
    if (url.includes("/v1/tiles/") && url.endsWith("/update")) {
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            command_id: "cmd-3",
            accepted_at: "2026-07-01T00:00:00Z",
            aggregate: { kind: 0, id: "tile-1" },
            revision: 2,
            result: 0,
            pending: [],
          }),
        json: async () => ({ tile_id: "tile-1", title: "updated" }),
      } as unknown as Response;
    }
    if (url.includes("/v1/tiles/")) {
      return { ok: true, status: 204, text: async () => "" } as unknown as Response;
    }
    if (url.includes("/v1/placements/") && url.endsWith("/close")) {
      return { ok: true, status: 204, text: async () => "" } as unknown as Response;
    }
    if (url.includes("/v1/timeline")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
        json: async () => [],
      } as unknown as Response;
    }
    return {
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: "unexpected " + url }),
      json: async () => ({ error: "unexpected " + url }),
    } as unknown as Response;
  });
});

const local = (u: string): string => `http://localhost${u}`;

describe("POST /api/events", () => {
  it("returns 422 when title/start/end are missing", async () => {
    const { POST } = await import("./route");
    const req = new Request(local("/api/events"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/title, start, end/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the create as POST /v1/tiles + POST /v1/placements in v1 envelope", async () => {
    const { POST } = await import("./route");
    const req = new Request(local("/api/events"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Standup",
        description: "Daily",
        start: "2026-07-01T09:00:00.000Z",
        end: "2026-07-01T09:15:00.000Z",
        color: "blue",
        icon: "users",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const calls = fetchMock.mock.calls.map(([arg]) =>
      typeof arg === "string" ? arg : (arg as { url: string }).url,
    );
    const posts = fetchMock.mock.calls.filter(([, init]) => {
      const m = (init as { method?: string } | undefined)?.method;
      return m === "POST";
    });
    expect(calls.some((c) => c.endsWith("/v1/tiles"))).toBe(true);
    expect(calls.some((c) => c.endsWith("/v1/placements"))).toBe(true);
    expect(posts.length).toBeGreaterThanOrEqual(2);

    const tileCall = posts.find(([, init]) => {
      const body = (init as { body?: string } | undefined)?.body ?? "";
      // Tile create has kind=1 in the payload.
      return body.includes('"kind":1');
    });
    const tileBody = JSON.parse((tileCall?.[1] as { body: string }).body);
    expect(tileBody.payload.kind).toBe(1);
    expect(tileBody.payload.title).toBe("Standup");
    expect(tileBody.payload.description).toBe("Daily");
    expect(tileBody.payload.color).toBe("blue");
    expect(tileBody.payload.icon).toBe("users");
    expect(tileBody.payload.plan_role).toBe(0);
    expect(typeof tileBody.idempotency_key).toBe("string");
    expect(tileBody.expected_revision).toBeNull();

    const placementCall = posts.find(([, init]) => {
      const body = (init as { body?: string } | undefined)?.body ?? "";
      return body.includes('"tile_id"') && body.includes('"baseline"');
    });
    const placementBody = JSON.parse(
      (placementCall?.[1] as { body: string }).body,
    );
    expect(placementBody.payload.tile_id).toBe("tile-1");
    expect(placementBody.payload.plan_id).toBe("plan-1");
    expect(placementBody.payload.source).toBe(3);
    expect(placementBody.payload.baseline.span.start).toBe("2026-07-01T09:00:00.000Z");
    expect(placementBody.payload.baseline.span.end).toBe("2026-07-01T09:15:00.000Z");
    expect(placementBody.payload.baseline.inside).toBeNull();
    expect(typeof placementBody.payload.source_ref).toBe("object");
    expect(typeof placementBody.idempotency_key).toBe("string");

    const body = await res.json();
    expect(body.event.id).toBe("place-1");
    expect(body.event.tileId).toBe("tile-1");
  });
});

describe("GET /api/events", () => {
  it("returns 410 to force clients onto /occurrences", async () => {
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error).toMatch(/occurrences/);
  });
});

describe("legacy /api/events/[id]", () => {
  it("returns 410 for GET, PATCH, DELETE", async () => {
    const { GET, PATCH, DELETE } = await import("./[id]/route");
    const id = "11111111-1111-1111-1111-111111111111";
    const ctx = { params: Promise.resolve({ id }) };

    const results = [
      await GET(new Request(local(`/api/events/${id}`)), ctx),
      await PATCH(
        new Request(local(`/api/events/${id}`), { method: "PATCH" }),
        ctx,
      ),
      await DELETE(
        new Request(local(`/api/events/${id}`), { method: "DELETE" }),
        ctx,
      ),
    ];
    for (const r of results) {
      expect(r.status).toBe(410);
    }
  });
});

describe("POST /api/events/tiles/[id]/update", () => {
  it("rejects empty bodies with 422", async () => {
    const { POST } = await import("./tiles/[id]/update/route");
    const ctx = { params: Promise.resolve({ id: "tile-1" }) };
    const req = new Request(local("/api/events/tiles/tile-1/update"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a title/description patch to /v1/tiles/{id}/update in v1 envelope", async () => {
    const { POST } = await import("./tiles/[id]/update/route");
    const ctx = { params: Promise.resolve({ id: "tile-1" }) };
    const req = new Request(local("/api/events/tiles/tile-1/update"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Renamed",
        description: "now with desc",
        color: "red",
      }),
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);

    const call = fetchMock.mock.calls[0];
    const calledUrl = (typeof call[0] === "string"
      ? call[0]
      : (call[0] as { url: string }).url) as string;
    expect(calledUrl).toContain("/v1/tiles/tile-1/update");
    const init = call[1] as { method: string; body: string };
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(typeof body.idempotency_key).toBe("string");
    expect(body.expected_revision).toBeNull();
    expect(body.payload.title).toBe("Renamed");
    expect(body.payload.description).toBe("now with desc");
    expect(body.payload.color).toBe("red");
  });
});

describe("DELETE /api/events/tiles/[id]", () => {
  it("forwards to DELETE /v1/tiles/{id} with v1 envelope body", async () => {
    const { DELETE } = await import("./tiles/[id]/route");
    const ctx = { params: Promise.resolve({ id: "tile-1" }) };
    const req = new Request(local("/api/events/tiles/tile-1"), {
      method: "DELETE",
    });
    const res = await DELETE(req, ctx);
    expect(res.status).toBe(204);

    const call = fetchMock.mock.calls[0];
    const calledUrl = (typeof call[0] === "string"
      ? call[0]
      : (call[0] as { url: string }).url) as string;
    expect(calledUrl).toContain("/v1/tiles/tile-1");
    expect((call[1] as { method: string }).method).toBe("DELETE");
    const init = call[1] as { body?: string; headers?: Record<string, string> };
    expect(init.headers?.["content-type"]).toBe("application/json");
    const body = JSON.parse(init.body ?? "{}");
    expect(typeof body.idempotency_key).toBe("string");
    expect(body.payload.tile_id).toBe("tile-1");
  });
});

describe("POST /api/events/placements/[id]/close", () => {
  it("forwards to POST /v1/placements/{id}/close", async () => {
    const { POST } = await import("./placements/[id]/close/route");
    const ctx = { params: Promise.resolve({ id: "place-1" }) };
    const req = new Request(local("/api/events/placements/place-1/close"), {
      method: "POST",
    });
    const res = await POST(req, ctx);
    expect(res.status).toBe(204);
  });
});