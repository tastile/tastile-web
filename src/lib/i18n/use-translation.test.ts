/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { create } from "zustand";
import { describe, expect, it } from "vitest";

type Locale = "en" | "ja" | "de" | "es" | "pt-BR" | "fr" | "ko" | "zh-CN";
const useLocaleStoreMock = create<{ locale: Locale }>(() => ({ locale: "ja" as Locale }));

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

  it("falls back to an empty string when both locale and English miss", () => {
    const { result } = renderHook(() => useTranslation());
    expect(result.current.t("not.a.real.key")).toBe("");
  });

  it("falls back from a non-English locale to English when the locale misses", () => {
    const { result } = renderHook(() => useTranslation());
    act(() => {
      useLocaleStoreMock.setState({ locale: "de" });
    });
    // The ja translation tree has nav.execute populated; the German placeholder
    // resolves through the English fallback. useTranslation never returns
    // the raw key.
    expect(result.current.t("nav.execute")).toBeTruthy();
    expect(result.current.t("nav.execute")).not.toBe("nav.execute");
  });
});