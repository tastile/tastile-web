"use client";

import { useLocalStorage } from "@mantine/hooks";
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
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value;
  } catch {
    return null;
  }
}

export function useTrackVisit(path: string): void {
  const [, setStoredPath] = useLocalStorage<string>({
    key: STORAGE_KEY,
    defaultValue: path,
    getInitialValueInEffect: true,
    deserialize: (raw) => raw ?? path,
    serialize: (value) => value,
  });

  useEffect(() => {
    setStoredPath(path);
  }, [path, setStoredPath]);
}