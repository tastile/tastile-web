"use client";

import { useMediaQuery as useMantineMediaQuery } from "@mantine/hooks";

export function useMediaQuery(query: string): boolean {
  return useMantineMediaQuery(query, false, { getInitialValueInEffect: true });
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 1024px)");
}
