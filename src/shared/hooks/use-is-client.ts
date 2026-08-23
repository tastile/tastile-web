"use client";
import { useSyncExternalStore } from "react";

const subscribe = (): (() => void) => () => {};
const getClientSnapshot = (): boolean => true;
const getServerSnapshot = (): boolean => false;

/**
 * Returns `true` after the component has mounted on the client and `false`
 * during server render. Built on `useSyncExternalStore` so it produces no
 * post-hydration flash — unlike `useState(false) + useEffect(setTrue)`,
 * which renders `false` on first paint and re-renders after hydration.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}