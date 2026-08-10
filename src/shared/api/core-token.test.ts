import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadModule() {
  vi.resetModules();
  return import("./core-token");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("core token manager", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("bootstraps once and caches until near expiry", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ token: "t1", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    );
    const { getCoreToken } = await loadModule();

    expect(await getCoreToken()).toBe("t1");
    expect(await getCoreToken()).toBe("t1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent bootstraps", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ token: "t1", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    );
    const { getCoreToken } = await loadModule();

    const [a, b, c] = await Promise.all([getCoreToken(), getCoreToken(), getCoreToken()]);

    expect([a, b, c]).toEqual(["t1", "t1", "t1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-bootstraps when the cached token is within the refresh margin", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: "stale", expiresAt: new Date(Date.now() + 5_000).toISOString() }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: "fresh", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      );
    const { getCoreToken } = await loadModule();

    expect(await getCoreToken()).toBe("stale");
    expect(await getCoreToken()).toBe("fresh");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshCoreToken discards the cached token and fetches a new one", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ token: "old", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ token: "new", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      );
    const { getCoreToken, refreshCoreToken } = await loadModule();

    expect(await getCoreToken()).toBe("old");
    expect(await refreshCoreToken()).toBe("new");
    expect(await getCoreToken()).toBe("new");
  });

  it("clearCoreToken forces the next call to bootstrap again", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        jsonResponse({ token: "t", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
      ),
    );
    const { getCoreToken, clearCoreToken } = await loadModule();

    await getCoreToken();
    clearCoreToken();
    await getCoreToken();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when the bootstrap endpoint rejects the session", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "unauthenticated" }, 401));
    const { getCoreToken } = await loadModule();

    expect(await getCoreToken()).toBeNull();
  });

  it("never persists the token outside memory", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ token: "secret", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }),
    );
    const { getCoreToken } = await loadModule();

    await getCoreToken();

    expect(globalThis.localStorage?.getItem("tastile_core_token") ?? null).toBeNull();
    expect(document.cookie).not.toContain("secret");
  });
});
