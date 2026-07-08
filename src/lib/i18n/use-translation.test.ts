/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { create } from "zustand";
import { describe, expect, it } from "vitest";

const useLocaleStoreMock = create<{ locale: "ja" | "en" }>(() => ({ locale: "ja" }));

vi.mock("../stores/locale-store", () => ({
  useLocaleStore: useLocaleStoreMock,
}));

const { useTranslation } = await import("./use-translation");

describe("useTranslation", () => {
  it("keeps t reference stable across re-renders when locale does not change", () => {
    const { result, rerender } = renderHook(() => useTranslation());
    const firstT = result.current.t;
    rerender();
    rerender();
    expect(result.current.t).toBe(firstT);
  });

  it("returns a new t reference when locale changes", () => {
    const { result } = renderHook(() => useTranslation());
    const firstT = result.current.t;
    act(() => {
      useLocaleStoreMock.setState({ locale: "en" });
    });
    expect(result.current.t).not.toBe(firstT);
  });

  it("falls back to the key when the lookup misses", () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t("not.a.real.key")).toBe("not.a.real.key");
  });
});