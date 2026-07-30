// src/components/schedule/useResponsiveBreakpoint.ts
"use client";

import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "desktop";

export function useResponsiveBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === "undefined") return "desktop";
    return window.innerWidth <= 600 ? "mobile" : "desktop";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 600px)");
    const handler = (e: MediaQueryListEvent) => setBp(e.matches ? "mobile" : "desktop");
    setBp(mq.matches ? "mobile" : "desktop");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return bp;
}
