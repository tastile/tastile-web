// src/components/schedule/__tests__/useResponsiveBreakpoint.test.ts
// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { useResponsiveBreakpoint } from './useResponsiveBreakpoint';

describe("useResponsiveBreakpoint", () => {
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  let sharedMql: {
    matches: boolean;
    media: string;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    _handler: (ev: { matches: boolean }) => void;
  };

  function setMatchMedia(width: number, matches: boolean) {
    Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
    sharedMql = {
      matches,
      media: "(max-width: 640px)",
      addEventListener: vi.fn((_e: string, h: (ev: { matches: boolean }) => void) => {
        sharedMql._handler = h;
      }),
      removeEventListener: vi.fn(),
      _handler: undefined as unknown as (ev: { matches: boolean }) => void,
    };
    window.matchMedia = vi.fn().mockImplementation((_q: string) => sharedMql);
  }

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
    window.matchMedia = originalMatchMedia;
  });

  it("returns 'desktop' when innerWidth > 640", () => {
    setMatchMedia(1200, false);
    const { result } = renderHook(() => useResponsiveBreakpoint());
    expect(result.current).toBe("desktop");
  });

  it("returns 'mobile' when innerWidth <= 640", () => {
    setMatchMedia(640, true);
    const { result } = renderHook(() => useResponsiveBreakpoint());
    expect(result.current).toBe("mobile");
  });

  it("updates when matchMedia change fires", () => {
    setMatchMedia(1200, false);
    const { result } = renderHook(() => useResponsiveBreakpoint());
    expect(result.current).toBe("desktop");
    // Simulate matchMedia firing when the viewport crosses the threshold.
    // In a real browser the change event also reflects the new match
    // state on the MediaQueryList; useSyncExternalStore's getSnapshot
    // re-reads it on the next render.
    sharedMql.matches = true;
    act(() => {
      sharedMql._handler({ matches: true });
    });
    expect(result.current).toBe("mobile");
  });
});
