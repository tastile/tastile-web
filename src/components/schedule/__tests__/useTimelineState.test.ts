// src/components/schedule/__tests__/useTimelineState.test.ts
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

const replace = vi.fn();
let mockSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/dashboard/timeline",
  useSearchParams: () => mockSearch,
  useParams: () => ({}),
}));

import { useTimelineState } from "../useTimelineState";

describe("useTimelineState", () => {
  beforeEach(() => {
    replace.mockReset();
    mockSearch = new URLSearchParams();
  });

  it("defaults to day view, scope mode, today, zoom 56", () => {
    const { result } = renderHook(() => useTimelineState());
    expect(result.current.view).toBe("day");
    expect(result.current.mode).toBe("scope");
    expect(result.current.zoom).toBe(56);
    expect(result.current.anchor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back on invalid view param", () => {
    mockSearch = new URLSearchParams("view=bogus");
    const { result } = renderHook(() => useTimelineState());
    expect(result.current.view).toBe("day");
  });

  it("falls back on invalid zoom", () => {
    mockSearch = new URLSearchParams("zoom=abc");
    const { result } = renderHook(() => useTimelineState());
    expect(result.current.zoom).toBe(56);
  });

  it("setView writes ?view=", () => {
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setView("week"));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("view=week"), { scroll: false });
  });

  it("setMode omits URL param when scope (default)", () => {
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setMode("scope"));
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^[^?]*$/), { scroll: false });
  });

  it("setMode writes ?mode=around for non-default", () => {
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setMode("around"));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("mode=around"), { scroll: false });
  });

  it("setZoom omits URL param when default 56", () => {
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setZoom(56));
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^[^?]*$/), { scroll: false });
  });

  it("setZoom clamps to [24, 160]", () => {
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setZoom(999));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("zoom=160"), { scroll: false });
  });

  it("shiftAnchor moves day by 1 day for day view", () => {
    mockSearch = new URLSearchParams("date=2026-07-30");
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.shiftAnchor(1));
    expect(replace).toHaveBeenCalledWith(expect.stringContaining("date=2026-07-31"), { scroll: false });
  });

  it("todayLocal returns YYYY-MM-DD", () => {
    const { result } = renderHook(() => useTimelineState());
    expect(result.current.todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("goToToday writes empty ? (no date param)", () => {
    mockSearch = new URLSearchParams("date=2026-07-30");
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.goToToday());
    expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^[^?]*$/), { scroll: false });
  });

  it("setAnchor ignores invalid date strings", () => {
    mockSearch = new URLSearchParams();
    const { result } = renderHook(() => useTimelineState());
    act(() => result.current.setAnchor("not-a-date"));
    expect(replace).not.toHaveBeenCalled();
  });
});
