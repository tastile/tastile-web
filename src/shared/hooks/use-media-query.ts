"use client";

import { useMediaQuery as useMantineMediaQuery } from "@mantine/hooks";

export function useMediaQuery(query: string): boolean {
	return useMantineMediaQuery(query, false, { getInitialValueInEffect: true });
}

export function useIsDesktop() {
	return useMediaQuery("(min-width: 1024px)");
}

/**
 * Tailwind v4 breakpoint values, in CSS pixels.
 * Source of truth for all JS-driven responsive logic.
 *
 * Mirrors the Tailwind v4 defaults documented in `src/app/globals.css`
 * (see the "Responsive breakpoint policy" comment at the top of that file).
 * If Tailwind ever changes these defaults, this object AND the CSS @media
 * rules in `globals.css` MUST be updated together.
 */
export const TAILWIND_BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	"2xl": 1536,
} as const;

/**
 * Tailwind `sm` breakpoint value in CSS pixels.
 * Re-exported for ergonomic single-import usage in features that only need
 * the mobile/desktop cutoff (e.g. `useResponsiveBreakpoint`).
 */
export const TAILWIND_SM_PX = TAILWIND_BREAKPOINTS.sm;
