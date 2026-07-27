import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { submitCreateTile } from "./submit";

const ORIGINAL_ENV = { ...process.env };

describe("makeClient (api/v1/submit.ts)", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, { ...ORIGINAL_ENV });
  });

  afterEach(() => {
    Object.assign(process.env, { ...ORIGINAL_ENV });
  });

  it("returns the E2E dev token when NEXT_PUBLIC_E2E_BYPASS_AUTH=1", async () => {
    process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH = "1";
    const { makeClient } = await import("./submit");
    const client = makeClient();
    expect(client.useProxyBridge).toBe(true);
    expect(client.baseUrl).toBe("/api/proxy/v1");
    await expect(client.getIdToken()).resolves.toBe("e2e-bypass-token");
  });

  it("returns null (no Cognito token material) when not in E2E bypass mode", async () => {
    delete process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH;
    const { makeClient } = await import("./submit");
    const client = makeClient();
    // Browser code MUST NEVER receive a Cognito id_token or refresh_token.
    // When the proxy bridge is in use, auth is added server-side; this
    // hook is intentionally a no-op for direct local calls.
    await expect(client.getIdToken()).resolves.toBeNull();
  });
});

describe("submitCreateTile — plan.completion.root passthrough", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    useQuickCreateStore.getState().reset();
    mockFetch.mockReset();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  it("POSTs plan.completion.root from the store", async () => {
    const customRoot = {
      kind: 0,
      children: [
        {
          kind: 3,
          children: [],
          term: { kind: "calendar", value: { weekdayMask: 0x1f } },
        },
      ],
      term: null,
    };
    useQuickCreateStore.getState().setField("identity.title", "Test study");
    useQuickCreateStore.getState().setField("plan.completion.root", customRoot);

    const okResponse = (body: unknown) =>
      ({
        ok: true,
        status: 200,
        json: async () => body,
      }) as unknown as Response;
    mockFetch
      .mockResolvedValueOnce(
        okResponse({
          commandId: "c1",
          acceptedAt: "t1",
          aggregate: { id: "tile-1" },
        }),
      )
      .mockResolvedValueOnce(okResponse({ commandId: "c2", acceptedAt: "t2" }));

    const result = await submitCreateTile({
      client: {
        baseUrl: "https://api.example.com",
        getIdToken: async () => "tok",
      },
    });

    expect(result.ok).toBe(true);
    const secondRequest = JSON.parse(mockFetch.mock.calls[1][1].body as string);
    expect(secondRequest.payload.completion.root).toEqual(customRoot);
  });
});
