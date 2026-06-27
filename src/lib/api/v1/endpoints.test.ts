import { describe, expect, it, vi, beforeEach } from "vitest";
import { postV1Command, getV1Read, type V1Client } from "./endpoints";
import { ApiErrorKind } from "@/lib/domain/v1/constants";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

const okResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

const errResponse = (status: number, body: unknown) =>
  ({
    ok: false,
    status,
    json: async () => body,
  }) as unknown as Response;

const baseClient = (): V1Client => ({
  baseUrl: "https://api.example.com",
  getIdToken: async () => "tok",
});

// Shared across the 6 tests that POST without caring about the request
// envelope — keeps the diff tiny and the call sites readable.
const emptyEnvelope = {
  expectedRevision: null,
  idempotencyKey: "k",
  occurredAt: "o",
  payload: {},
};

describe("postV1Command", () => {
  beforeEach(() => mockFetch.mockReset());

  it("POSTs to baseUrl+path with v1 envelope and Bearer token", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        commandId: "c1",
        acceptedAt: "t1",
        aggregate: null,
        revision: null,
        result: 0,
        pending: [],
      }),
    );
    const client = baseClient();
    const res = await postV1Command(client, "/v1/tiles", {
      expectedRevision: null,
      idempotencyKey: "k1",
      occurredAt: "t1",
      payload: { kind: 0 },
    });
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/tiles");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      expectedRevision: null,
      idempotencyKey: "k1",
      occurredAt: "t1",
      payload: { kind: 0 },
    });
  });

  it("returns {ok:true,data,status} on 2xx with parsed JSON", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        commandId: "c2",
        acceptedAt: "t2",
        aggregate: { kind: 0, id: "agg" },
        revision: 5,
        result: 2,
        pending: [{ kind: 0, target: null, notBefore: null }],
      }),
    );
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.status).toBe(200);
      expect(res.data.commandId).toBe("c2");
      expect(res.data.revision).toBe(5);
      expect(res.data.aggregate?.id).toBe("agg");
    }
  });

  it("returns RETRYABLE ApiError when 2xx body is missing commandId", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ acceptedAt: "t1" }));
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("commandId");
    }
  });

  it("returns RETRYABLE ApiError when 2xx body is missing acceptedAt", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ commandId: "c1" }));
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("acceptedAt");
    }
  });

  it("returns {ok:false,error:ApiError} when id token is missing (FORBIDDEN)", async () => {
    const client: V1Client = {
      baseUrl: "https://api.example.com",
      getIdToken: async () => null,
    };
    const res = await postV1Command(client, "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.FORBIDDEN);
      expect(res.error.message).toBe("no id token");
      expect(res.error.currentRevision).toBeNull();
      expect(res.error.violations).toEqual([]);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns ApiError with parsed violations on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      errResponse(422, {
        kind: ApiErrorKind.VALIDATION,
        message: "bad payload",
        currentRevision: 3,
        violations: [
          { kind: 0, message: "x", currentRevision: null },
        ],
      }),
    );
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.VALIDATION);
      expect(res.error.message).toBe("bad payload");
      expect(res.error.currentRevision).toBe(3);
      expect(res.error.violations).toHaveLength(1);
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
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("500");
    }
  });

  it("returns network ApiError (RETRYABLE) when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("socket reset"));
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toBe("socket reset");
      expect(res.error.currentRevision).toBeNull();
      expect(res.error.violations).toEqual([]);
    }
  });

  it("returns network ApiError when response JSON parse fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid json");
      },
    } as unknown as Response);
    const res = await postV1Command(baseClient(), "/v1/x", emptyEnvelope);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toContain("500");
    }
  });
});

describe("getV1Read", () => {
  beforeEach(() => mockFetch.mockReset());

  it("GETs baseUrl+path with Bearer token", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ id: "r1" }));
    const client = baseClient();
    const res = await getV1Read<{ id: string }>(client, "/v1/tiles/r1");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("r1");
    }
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/v1/tiles/r1");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("returns ApiError on non-2xx", async () => {
    mockFetch.mockResolvedValueOnce(
      errResponse(404, {
        kind: ApiErrorKind.NOT_FOUND,
        message: "missing",
        currentRevision: null,
        violations: [],
      }),
    );
    const res = await getV1Read(baseClient(), "/v1/tiles/missing");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.NOT_FOUND);
      expect(res.error.message).toBe("missing");
    }
  });

  it("returns FORBIDDEN ApiError when id token is missing", async () => {
    const client: V1Client = {
      baseUrl: "https://api.example.com",
      getIdToken: async () => null,
    };
    const res = await getV1Read(client, "/v1/x");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.FORBIDDEN);
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns RETRYABLE ApiError when fetch throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const res = await getV1Read(baseClient(), "/v1/x");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe(ApiErrorKind.RETRYABLE);
      expect(res.error.message).toBe("offline");
    }
  });
});