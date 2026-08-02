/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_DIRECT_DAEMON } from "@/shared/auth/cookie-names";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  // Wipe cookie between tests
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
});

describe("getCoreClient mode detection", () => {
  it("returns proxy-mode client when tastile_direct_daemon cookie is absent", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL = "https://core.tastile.test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("getHealth" as keyof typeof ENDPOINTS);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.includes("/api/proxy/")).toBe(true);
  });

  it("returns direct-mode client when tastile_direct_daemon=1", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: `${COOKIE_DIRECT_DAEMON}=1`,
    });
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL = "https://core.tastile.test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("getHealth" as keyof typeof ENDPOINTS);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.credentials ?? "omit")).toBe("include");
    // Direct mode does not inject Authorization header (browser attaches Cookie)
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("falls back to proxy-mode when NEXT_PUBLIC_TASTILE_CORE_URL is unset", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
    delete process.env.NEXT_PUBLIC_TASTILE_CORE_URL;
    delete process.env.NEXT_PUBLIC_DAEMON_BASE_URL;
    vi.stubEnv("NEXT_PUBLIC_E2E_BYPASS_AUTH", "1");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("getHealth" as keyof typeof ENDPOINTS);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.includes("/api/proxy/")).toBe(true);
  });
});
