/** @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLastVisitedPath, useTrackVisit } from "./use-track-visit";

const STORAGE_KEY = "tastile:last-visited-path";

describe("useTrackVisit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Storage.prototype, "setItem");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the path to the documented storage key on mount", () => {
    renderHook(() => useTrackVisit("/dashboard/tasks"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("/dashboard/tasks");
  });

  it("rewrites the storage key when the path changes", () => {
    const { rerender } = renderHook(({ path }) => useTrackVisit(path), {
      initialProps: { path: "/dashboard/tasks" },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("/dashboard/tasks");

    rerender({ path: "/dashboard/schedule" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("/dashboard/schedule");
  });

  it("survives when localStorage throws (private mode, quota, etc.)", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    expect(() => renderHook(() => useTrackVisit("/dashboard/tasks"))).not.toThrow();
    setItem.mockRestore();
  });
});

describe("getLastVisitedPath", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the most recent tracked path", () => {
    window.localStorage.setItem(STORAGE_KEY, "/dashboard/schedule");
    expect(getLastVisitedPath()).toBe("/dashboard/schedule");
  });

  it("returns null when no path has been tracked yet", () => {
    expect(getLastVisitedPath()).toBeNull();
  });

  it("returns null when localStorage is unavailable", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("access denied");
      });
    expect(getLastVisitedPath()).toBeNull();
    getItem.mockRestore();
  });
});