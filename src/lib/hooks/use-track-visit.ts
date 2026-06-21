"use client";

import { useEffect } from "react";

const STORAGE_KEY = "tastile:last-visited-path";

export function trackVisit(path: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // localStorage unavailable
  }
}

export function getLastVisitedPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function useTrackVisit(path: string): void {
  useEffect(() => {
    trackVisit(path);
  }, [path]);
}
