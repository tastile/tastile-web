/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Result } from "@/shared/api/endpoints";

const { callMock } = vi.hoisted(() => ({ callMock: vi.fn() }));

vi.mock("@/shared/api/endpoints", async () => {
  const actual = await vi.importActual<typeof import("@/shared/api/endpoints")>(
    "@/shared/api/endpoints",
  );
  return {
    ...actual,
    getCoreClient: () => ({ call: callMock }),
  };
});

// Imported after the mock so the hook under test uses the mocked call.
import { useActiveTile } from "@/shared/hooks/use-active-tile";

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

const snapshotA = {
  is_working: true,
  is_on_break: false,
  is_idle: false,
  main_tile: { id: "tile-a", title: "First" },
  main_tile_started_at: "2026-07-23T09:00:00.000Z",
  main_tile_ends_at: "2026-07-23T10:00:00.000Z",
  tile_count: 1,
  event_count: 1,
  tiles_in_progress: [{ id: "tile-a", title: "First" }],
  pending_prompt_id: null,
};

const snapshotB = {
  ...snapshotA,
  main_tile: { id: "tile-b", title: "Second" },
  main_tile_started_at: "2026-07-23T09:30:00.000Z",
  main_tile_ends_at: "2026-07-23T10:30:00.000Z",
};

function ok(data: typeof snapshotA): Result<typeof snapshotA> {
  return { ok: true, data, status: 200, latencyMs: 1 };
}

function err(message: string): Result<typeof snapshotA> {
  return {
    ok: false,
    error: { kind: "server", status: 502, message, body: null },
  };
}

describe("useActiveTile", () => {
  beforeEach(() => {
    callMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in loading state and resolves to the snapshot", async () => {
    callMock.mockResolvedValue(ok(snapshotA));
    const { result } = renderHook(() => useActiveTile());

    expect(result.current.loading).toBe(true);
    expect(result.current.snapshot).toBeNull();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.snapshot).toEqual(snapshotA);
  });

  it("drops a stale response when a newer request superseded it", async () => {
    let resolveA: (value: Result<typeof snapshotA>) => void = () => {};
    let resolveB: (value: Result<typeof snapshotA>) => void = () => {};
    callMock
      .mockImplementationOnce(() => new Promise<Result<typeof snapshotA>>((r) => (resolveA = r)))
      .mockImplementationOnce(() => new Promise<Result<typeof snapshotA>>((r) => (resolveB = r)));

    const { result } = renderHook(() => useActiveTile());

    // Wait for the first request to be in-flight.
    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));

    // Fire a second concurrent refresh via the global event.
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));

    // Resolve in the wrong order: stale snapshot A arrives after fresh B.
    resolveB(ok(snapshotB));
    resolveA(ok(snapshotA));

    await waitFor(() => {
      expect(result.current.snapshot?.main_tile?.id).toBe("tile-b");
    });
  });

  it("refetches when tastile:execution-changed fires", async () => {
    callMock.mockResolvedValue(ok(snapshotA));
    const { result } = renderHook(() => useActiveTile());

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));

    callMock.mockResolvedValueOnce(ok(snapshotB));
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(result.current.snapshot?.main_tile?.id).toBe("tile-b");
    });
  });

  it("stabilizes the error reference across repeated failures", async () => {
    callMock.mockResolvedValue(err("boom"));
    const { result } = renderHook(() => useActiveTile());

    await waitFor(() => expect(result.current.error?.message).toBe("boom"));
    const firstError = result.current.error;

    // Drive another refresh via the event so the error is recomputed.
    callMock.mockResolvedValueOnce(err("boom"));
    window.dispatchEvent(new CustomEvent("tastile:execution-changed"));

    await waitFor(() => expect(callMock).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBe(firstError);
  });
});