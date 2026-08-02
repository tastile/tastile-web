/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { Result } from "@/shared/api/endpoints";
import type { V1ActiveTileSnapshot } from "@/shared/api/v1/active-tile";

const { fetchV1ActiveTileMock } = vi.hoisted(() => ({
  fetchV1ActiveTileMock: vi.fn(),
}));

vi.mock("@/shared/api/v1/active-tile", async () => {
  const actual = await vi.importActual<typeof import("@/shared/api/v1/active-tile")>(
    "@/shared/api/v1/active-tile",
  );
  return {
    ...actual,
    fetchV1ActiveTile: fetchV1ActiveTileMock,
  };
});

// Imported after the mock so the hook under test uses the mocked fetch.
import { useV1ActiveTile } from "@/shared/hooks/use-v1-active-tile";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const validSnapshot: V1ActiveTileSnapshot = {
  tile_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8e",
  placement_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d8f",
  execution_id: "0190f4d2-5c8b-7e9a-b1d2-3f4a5b6c7d90",
  title: "Plan the launch",
  span_start: "2026-07-23T09:00:00.000Z",
  span_end: "2026-07-23T10:00:00.000Z",
};

const ok = (data: V1ActiveTileSnapshot | null): Result<V1ActiveTileSnapshot | null> => ({
  ok: true,
  data,
  status: 200,
  latencyMs: 1,
});

const err = (
  kind: "unauthorized" | "server",
  message: string,
): Result<V1ActiveTileSnapshot | null> => ({
  ok: false,
  error: { kind, status: kind === "unauthorized" ? 401 : 502, message, body: null },
});

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function withClient(client: QueryClient) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  Wrapper.displayName = "WithClient";
  return Wrapper;
}

describe("useV1ActiveTile (TanStack Query pilot)", () => {
  beforeEach(() => {
    fetchV1ActiveTileMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in loading state with no snapshot and no error", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    expect(result.current.loading).toBe(true);
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it("returns the parsed snapshot on a successful response", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.snapshot).toEqual(validSnapshot);
    expect(result.current.error).toBeNull();
  });

  it("returns null snapshot when the server reports no active tile", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(null));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("maps a transport failure to a populated error and clears loading", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(err("unauthorized", "missing id_token"));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("missing id_token");
  });

  it("deduplicates concurrent subscribers under one QueryClient", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    const wrapper = withClient(client);
    renderHook(() => useV1ActiveTile(), { wrapper });
    renderHook(() => useV1ActiveTile(), { wrapper });

    await waitFor(() => {
      expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);
    });
  });

  it("refetches when the tastile:execution-changed window event fires", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);
    });

    const updated: V1ActiveTileSnapshot = { ...validSnapshot, title: "Updated title" };
    fetchV1ActiveTileMock.mockResolvedValueOnce(ok(updated));
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));

    await waitFor(() => {
      expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(result.current.snapshot?.title).toBe("Updated title");
    });
  });

  it("polls every 5 seconds while mounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);
    });

    const initial = fetchV1ActiveTileMock.mock.calls.length;

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchV1ActiveTileMock.mock.calls.length).toBeGreaterThan(initial);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetchV1ActiveTileMock.mock.calls.length).toBeGreaterThan(initial + 1);
    vi.useRealTimers();
  });

  it("stops polling after unmount", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(ok(validSnapshot));
    const client = makeClient();
    const { unmount } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);
    });

    unmount();

    const callsBefore = fetchV1ActiveTileMock.mock.calls.length;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();

    expect(fetchV1ActiveTileMock.mock.calls.length).toBe(callsBefore);
  });

  it("does not retry on API/validation failure", async () => {
    fetchV1ActiveTileMock.mockResolvedValue(err("server", "Invalid active-tile response"));
    const client = makeClient();
    const { result } = renderHook(() => useV1ActiveTile(), { wrapper: withClient(client) });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();

    // Even on the 5-second retry, retry:false keeps the call count at 1.
    expect(fetchV1ActiveTileMock).toHaveBeenCalledTimes(1);
  });
});
