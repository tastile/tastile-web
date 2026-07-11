import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiErrorKind, AggregateKind } from "@/lib/domain/v1/constants";
import { type ApiClient } from "@/lib/api/v1/endpoints";
import {
  ScheduleReferenceUsage,
  WindowKind,
  publishScheduleDefinition,
  listReferenceCatalog,
} from "./schedule-definition";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const okResponse = (body: unknown, status = 200) =>
  ({
    ok: true,
    status,
    json: async () => body,
  }) as unknown as Response;

const errResponse = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    json: async () => body,
  }) as unknown as Response;

const baseClient = (): ApiClient => ({
  baseUrl: "https://api.example.com",
  getIdToken: async () => "tok",
});

const commandAcceptedResponse = (overrides: Record<string, unknown> = {}) =>
  ({
    commandId: "cmd-1",
    acceptedAt: "2026-07-11T00:00:00Z",
    aggregate: { kind: AggregateKind.RECURRING, id: "tile-uuid" },
    revision: 1,
    result: 0,
    pending: [],
    aggregateMeta: {
      tileId: "tile-uuid",
      planId: "plan-uuid",
      recurringId: "recurring-uuid",
      frameRuleId: "frame-rule-uuid",
      changesetId: "changeset-uuid",
      changeIds: ["change-1"],
    },
    ...overrides,
  });

const basePayload = () => ({
  tile: { title: "Semester", plan_role: 1 },
  plan: {},
  reference_targets: [],
  windows: [
    {
      kind: WindowKind.CALENDAR,
      bounds: {
        date_start: "2026-09-01",
        date_end: "2026-12-31",
        weekday_mask: 31,
        time_start: 540,
        time_end: 1080,
      },
    },
  ],
  flows: [{ target_kind: 1 }],
});

describe("publishScheduleDefinition", () => {
  beforeEach(() => mockFetch.mockReset());

  it("POSTs the schedule definition to /v1/schedule-definitions with v1 envelope", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandAcceptedResponse()));
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: basePayload(),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.tileId).toBe("tile-uuid");
      expect(res.planId).toBe("plan-uuid");
      expect(res.windowsIds).toEqual([]);
      expect(res.flowIds).toEqual([]);
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/schedule-definitions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      expected_revision: null,
      payload: basePayload(),
    });
    expect(typeof body.idempotency_key).toBe("string");
    expect(typeof body.occurred_at).toBe("string");
  });

  it("returns VALIDATION ApiError when title is empty without calling fetch", async () => {
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: { ...basePayload(), tile: { title: "   ", plan_role: 1 } },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.VALIDATION);
      expect(res.error.message).toBe("title is required");
      expect(res.error.currentRevision).toBeNull();
      expect(res.error.violations).toEqual([]);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns server VALIDATION ApiError when 422 returned", async () => {
    mockFetch.mockResolvedValueOnce(
      errResponse(422, {
        kind: ApiErrorKind.VALIDATION,
        message: "window reference missing",
        currentRevision: null,
        violations: [{ kind: 0, message: "x", currentRevision: null }],
      }),
    );
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: basePayload(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.VALIDATION);
      expect(res.error.message).toBe("window reference missing");
      expect(res.error.violations).toHaveLength(1);
    }
  });

  it("returns RETRYABLE ApiError when aggregate id is missing in response", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse(
        commandAcceptedResponse({
          aggregate: { kind: AggregateKind.RECURRING, id: null },
          aggregateMeta: {
            tileId: null,
            planId: "plan-uuid",
            recurringId: null,
            frameRuleId: null,
            changesetId: null,
            changeIds: [],
          },
        }),
      ),
    );
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: basePayload(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("tile/plan aggregate ids");
    }
  });

  it("returns RETRYABLE ApiError when planId is missing in response", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse(
        commandAcceptedResponse({
          aggregateMeta: {
            tileId: "tile-uuid",
            planId: null,
            recurringId: null,
            frameRuleId: null,
            changesetId: null,
            changeIds: [],
          },
        }),
      ),
    );
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: basePayload(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
    }
  });

  it("returns RETRYABLE ApiError when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("socket reset"));
    const res = await publishScheduleDefinition({
      client: baseClient(),
      payload: basePayload(),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toBe("socket reset");
    }
  });

  it("POSTs without an Authorization header when proxy bridge is enabled", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(commandAcceptedResponse()));
    const res = await publishScheduleDefinition({
      client: {
        baseUrl: "/api/proxy",
        getIdToken: async () => null,
        useProxyBridge: true,
      },
      payload: basePayload(),
    });
    expect(res.ok).toBe(true);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });
});

describe("listReferenceCatalog", () => {
  beforeEach(() => mockFetch.mockReset());

  it("GETs /v1/reference-catalog with usage and owner_id query params", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse([
        {
          placement_id: "p1",
          tile_id: "t1",
          plan_id: "pl1",
          title: "Semester",
          span_start: "2026-09-01T00:00:00Z",
          span_end: "2026-12-31T00:00:00Z",
          role: 1,
        },
      ]),
    );
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe(200);
      expect(res.data).toHaveLength(1);
      expect(res.data[0].placement_id).toBe("p1");
      expect(res.data[0].role).toBe(1);
    }
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://api.example.com/v1/reference-catalog?usage=1&owner_id=owner-uuid",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    // No body for a GET request.
    expect(init.body).toBeUndefined();
  });

  it("encodes owner_id containing special characters", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));
    await listReferenceCatalog(
      baseClient(),
      "owner with spaces & unicode 日本語",
      ScheduleReferenceUsage.PARENT_SPAN,
    );
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("usage=2");
    expect(url).toContain(
      "owner_id=owner%20with%20spaces%20%26%20unicode%20%E6%97%A5%E6%9C%AC%E8%AA%9E",
    );
  });

  it("emits usage=3 for GAP_ANCHOR selector", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));
    await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.GAP_ANCHOR,
    );
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("usage=3");
  });

  it("returns empty array when server returns a non-array body", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ not: "an array" }));
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });

  it("returns empty array when server returns null body", async () => {
    mockFetch.mockResolvedValueOnce(okResponse(null));
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });

  it("returns FORBIDDEN ApiError when id token is missing", async () => {
    const client: ApiClient = {
      baseUrl: "https://api.example.com",
      getIdToken: async () => null,
    };
    const res = await listReferenceCatalog(
      client,
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.FORBIDDEN);
      expect(res.error.message).toBe("no id token");
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns server NOT_FOUND ApiError on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      errResponse(404, {
        kind: ApiErrorKind.NOT_FOUND,
        message: "owner not found",
        currentRevision: null,
        violations: [],
      }),
    );
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.NOT_FOUND);
      expect(res.error.message).toBe("owner not found");
    }
  });

  it("coerces out-of-range kind to RETRYABLE on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      errResponse(500, {
        kind: 99,
        message: "weird",
        currentRevision: null,
        violations: [],
      }),
    );
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("500");
    }
  });

  it("returns RETRYABLE ApiError when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toBe("offline");
    }
  });

  it("returns RETRYABLE ApiError when error response JSON parse fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid json");
      },
    } as unknown as Response);
    const res = await listReferenceCatalog(
      baseClient(),
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("500");
    }
  });

  it("GETs without an Authorization header when proxy bridge is enabled", async () => {
    mockFetch.mockResolvedValueOnce(okResponse([]));
    const res = await listReferenceCatalog(
      { baseUrl: "/api/proxy", getIdToken: async () => null, useProxyBridge: true },
      "owner-uuid",
      ScheduleReferenceUsage.LABEL_SPAN,
    );
    expect(res.ok).toBe(true);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});