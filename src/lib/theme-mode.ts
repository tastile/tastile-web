import { resolveInitialThemeMode } from "@/lib/theme-script";

export type ThemeMode = "light" | "dark-gray" | "dark-black";

export const THEME_MODE_STORAGE_KEY = "theme-mode";

// Legacy key from the earlier zustand-persisted theme store. Kept here so the
// resolver below and the inline FOUC-prevention script agree on the migration
// source of truth.
export const LEGACY_THEME_STORAGE_KEY = "tastile-theme";

// Reads the persisted theme from localStorage and falls back to the OS
// preference. Safe to call on mount from a client component, and on the server
// always returns "light" because there is no persisted storage.
//
// React 19's SSR hydration calls `releaseSingletonInstance(documentElement)`,
// which strips every attribute (including `class`) from `<html>`. The inline
// `themeScript` in `layout.tsx` sets the dark classes before hydration runs,
// so they are present at first paint — but the hydration wipe happens between
// that paint and React's commit phase. Anything that wants to keep the
// `<html>` className in sync across reloads must re-apply the class from this
// source of truth inside a `useLayoutEffect` / `useIsomorphicEffect`.
export function readPersistedThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  let prefersDark = false;
  try {
    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    prefersDark = false;
  }
  return resolveInitialThemeMode(
    window.localStorage.getItem(THEME_MODE_STORAGE_KEY),
    window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY),
    prefersDark,
  );
}

export function applyThemeMode(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.remove(
    "dark",
    "theme-dark-gray",
    "theme-dark-black",
    "theme-light",
    "theme-gray",
    "theme-dark",
  );

  if (mode === "dark-gray") {
    root.classList.add("dark", "theme-dark-gray");
  }

  if (mode === "dark-black") {
    root.classList.add("dark", "theme-dark-black");
  }

  window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);

  // Mantine reads `data-mantine-color-scheme` on <html> to pick light/dark
  // variables for its own components (TextInput, Select, Switch, Modal, ...).
  // Our custom theme only toggles classes above, so without this sync Mantine
  // stays on whatever `ColorSchemeScript` last set (often the OS preference),
  // leaving dark Mantine controls on a light page after the user toggles.
  const mantineScheme = mode === "light" ? "light" : "dark";
  root.setAttribute("data-mantine-color-scheme", mantineScheme);
  window.localStorage.setItem("mantine-color-scheme-value", mantineScheme);
}
