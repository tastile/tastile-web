"use client";

import { useEffect } from "react";

const STORAGE_KEY = "tastile:last-visited-path";

export function getLastVisitedPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

export function useTrackVisit(path: string): void {
  useEffect(() => {
    // Empty path is the layout's signal to skip tracking. Used by the
    // dashboard layout to avoid clobbering the previously stored path
    // with the redirect source itself (`/dashboard`); otherwise the
    // page's redirect logic would race its own read-from-storage
    // peephole and always fall back to the default target.
    //
    // We write directly to localStorage here rather than going through
    // useLocalStorage: that hook auto-initializes storage with its
    // defaultValue on mount, which would persist an empty-string
    // sentinel before this effect's early return can skip it. The
    // "rewrites storage once a non-empty path arrives after a skip"
    // test requires storage to stay untouched (null) while path is
    // empty, so the only writer is this effect.
    if (!path) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, path);
    } catch {
      // Private mode / quota exceeded — silently skip tracking.
    }
  }, [path]);
}
