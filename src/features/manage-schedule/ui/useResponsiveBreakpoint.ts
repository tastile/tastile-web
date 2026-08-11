// src/components/schedule/useResponsiveBreakpoint.ts
"use client";

import { useEffect, useState } from "react";

// Aligned to Tailwind `sm:` (640px) so consumers can reason about mobile vs
// desktop without juggling two different cutoffs.
const MOBILE_MAX_WIDTH = 640;

export type Breakpoint = "mobile" | "desktop";

export function useResponsiveBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    return window.innerWidth <= MOBILE_MAX_WIDTH ? "mobile" : "desktop";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const handler = (e: MediaQueryListEvent) => setBp(e.matches ? "mobile" : "desktop");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return bp;
}
