/** @vitest-environment jsdom */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const callAllPagesMock = vi.fn();
vi.mock("@/shared/api/endpoints", () => ({
  getCoreClient: () => ({ callAllPages: callAllPagesMock }),
}));
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
    children,
  );

const placementWire = {
  placement_id: "p-1",
  tile_id: "w-1",
  title: "Write report",
  span_start: "2026-01-01T10:00:00Z",
  span_end: "2026-01-01T10:30:00Z",
};
const candidateWire = {
  placement_id: "pl-9",
  tile_id: "w-9",
  title: "Read papers",
  priority: 1,
  span_start: null,
  span_end: null,
};

describe("usePlacements / useCandidates", () => {
  beforeEach(() => callAllPagesMock.mockReset());

  it("loads placements from the paged envelope items", async () => {
    callAllPagesMock.mockResolvedValue({ ok: true, data: [placementWire] });
    const { usePlacements } = await import("./use-placements");
    const { result } = renderHook(() => usePlacements(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callAllPagesMock).toHaveBeenCalledWith("getPlacements");
    expect(result.current.placements).toHaveLength(1);
    expect(result.current.placements[0].work_tile_id).toBe("w-1");
    expect(result.current.placements[0].planned_minutes).toBe(30);
  });

  it("surfaces errors", async () => {
    callAllPagesMock.mockResolvedValue({ ok: false, error: { message: "boom" } });
    const { usePlacements } = await import("./use-placements");
    const { result } = renderHook(() => usePlacements(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe("boom");
  });

  it("refreshes", async () => {
    callAllPagesMock
      .mockResolvedValueOnce({ ok: true, data: [] })
      .mockResolvedValueOnce({
        ok: true,
        data: [{ ...placementWire, placement_id: "p-2", tile_id: "w-2" }],
      });
    const { usePlacements } = await import("./use-placements");
    const { result } = renderHook(() => usePlacements(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.placements).toHaveLength(1));
  });

  it("loads candidates", async () => {
    callAllPagesMock.mockResolvedValue({ ok: true, data: [candidateWire] });
    const { useCandidates } = await import("./use-placements");
    const { result } = renderHook(() => useCandidates(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(callAllPagesMock).toHaveBeenCalledWith("getCandidates");
    expect(result.current.candidates[0].tile_id).toBe("w-9");
  });
});
