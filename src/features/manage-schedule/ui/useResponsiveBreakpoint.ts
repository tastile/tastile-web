// src/components/schedule/useResponsiveBreakpoint.ts
"use client";

import { TAILWIND_SM_PX as _TAILWIND_SM_PX } from "@/shared/hooks/use-media-query";
import { useSyncExternalStore } from "react";

// Mobile cutoff in CSS pixels. MUST stay aligned with Tailwind v4's `sm`
// breakpoint (640px) — see the responsive-breakpoint policy block at the top
// of `src/app/globals.css`. Update both if Tailwind defaults ever change.
export const TAILWIND_SM_PX = _TAILWIND_SM_PX;

export type Breakpoint = "mobile" | "desktop";

const QUERY = `(max-width: ${TAILWIND_SM_PX}px)`;

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
