// src/components/schedule/useResponsiveBreakpoint.ts
"use client";

import { useSyncExternalStore } from "react";

// Aligned to Tailwind `sm:` (640px) so consumers can reason about mobile vs
// desktop without juggling two different cutoffs.
const MOBILE_MAX_WIDTH = 640;

export type Breakpoint = "mobile" | "desktop";

const QUERY = `(max-width: ${MOBILE_MAX_WIDTH}px)`;

function subscribe(callback: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): Breakpoint {
  return window.matchMedia(QUERY).matches ? "mobile" : "desktop";
}

function getServerSnapshot(): Breakpoint {
  return "desktop";
}

export function useResponsiveBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
