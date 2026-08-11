import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyTestPoolToEnv, setupTestPoolFromEnv, type TestPoolConfig } from "@/lib/test/setupTestPoolFromEnv";

const POOL: TestPoolConfig = setupTestPoolFromEnv();

const cookieValues = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get(name: string) {
      const value = cookieValues.get(name);
      return value === undefined ? undefined : { value };
    },
  })),
}));

import {
  upstreamArchiveTile,
  upstreamClosePlacement,
  upstreamCreateCalendarEvent,
  upstreamListTimeline,
  upstreamUpdateTile,
} from "./events";

beforeEach(() => {
  cookieValues.clear();
  cookieValues.set("tastile_uid", "forged-victim");
  process.env.TASTILE_WEB_BRIDGE_SECRET = "bridge-secret";
  process.env.CLOUD_API_BASE = process.env.CLOUD_API_BASE ?? "http://localhost:31400";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.E2E_BYPASS_AUTH;
});

describe("events upstream authentication", () => {
  it.each([
    ["list", () => upstreamListTimeline({ start: "2026-01-01", end: "2026-01-02" })],
    [
      "create",
      () =>
        upstreamCreateCalendarEvent({
          title: "event",
          start: "2026-01-01T00:00:00Z",
          end: "2026-01-01T01:00:00Z",
        }),
    ],
    ["update", () => upstreamUpdateTile("tile-1", { title: "updated" })],
    ["archive", () => upstreamArchiveTile("tile-1")],
    ["close", () => upstreamClosePlacement("placement-1")],
  ])("rejects a forged uid before %s reaches upstream", async (_name, invoke) => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }));

    const response = await invoke();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards to the local core as the dev actor when E2E auth bypass is enabled", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.CLOUD_API_BASE = "http://localhost:31400";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }));

    const response = await upstreamListTimeline({
      start: "2026-01-01T00:00:00Z",
      end: "2026-01-02T00:00:00Z",
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      `${"http://localhost:31400"}/v1/timeline?start=2026-01-01T00%3A00%3A00Z&end=2026-01-02T00%3A00%3A00Z&include_labels=false`,
      expect.objectContaining({
        headers: {
          "x-owner-id": "00000000-0000-0000-0000-000000000001",
          "x-actor-id": "00000000-0000-0000-0000-000000000001",
        },
      }),
    );
  });

  it("forwards min_duration_ms with +1 ms to bridge '≤ minMinutes' into Core's strict-less-than filter", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.CLOUD_API_BASE = "http://localhost:31400";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("[]", { status: 200 }));

    await upstreamListTimeline({
      start: "2026-01-01T00:00:00Z",
      end: "2026-01-02T00:00:00Z",
      minMinutes: 5,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("min_duration_ms=300001");
  });

  it("maps Core LABEL timeline items to all-day calendar events", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.CLOUD_API_BASE = "http://localhost:31400";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{
        placement_id: "placement-label",
        tile_id: "tile-label",
        role: 1,
        content: { title: "Term 2" },
        visual: { color: "#DB2777", icon: "calendar" },
        span: { start: "2026-06-09T15:00:00Z", end: "2026-08-10T15:00:00Z" },
        resolution: { state: 0 },
      }])),
    );

    const response = await upstreamListTimeline({ start: "2026-07-01", end: "2026-07-02" });
    const body = (await response.json()) as { occurrences: Array<{ allDay: boolean; title: string }> };

    expect(body.occurrences).toHaveLength(1);
    expect(body.occurrences[0]).toMatchObject({ title: "Term 2", allDay: true });
  });

  it("keeps timed Core LABEL annotations in the hour grid", async () => {
    process.env.E2E_BYPASS_AUTH = "1";
    process.env.CLOUD_API_BASE = "http://localhost:31400";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{
        placement_id: "placement-break",
        tile_id: "tile-break",
        role: 1,
        content: { title: "Break (5 min)" },
        span: { start: "2026-07-15T12:15:00Z", end: "2026-07-15T12:20:00Z" },
      }])),
    );

    const response = await upstreamListTimeline({ start: "2026-07-15", end: "2026-07-16" });
    const body = (await response.json()) as { occurrences: Array<{ allDay: boolean; title: string }> };

    expect(body.occurrences[0]).toMatchObject({ title: "Break (5 min)", allDay: false });
  });

  it("forwards only the Cognito-verified sub in bridge headers", async () => {
    configureCognito();
    cookieValues.set("tastile_access_token", "verified-token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ sub: "verified-sub" })))
      .mockResolvedValueOnce(new Response("[]"));

    const response = await upstreamListTimeline({ start: "2026-01-01", end: "2026-01-02" });

    expect(response.status).toBe(200);
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers["x-tastile-web-session-user"]).toBe("verified-sub");
    expect(headers["x-owner-id"]).toBeUndefined();
  });
});

function configureCognito() {
  applyTestPoolToEnv(POOL);
}
