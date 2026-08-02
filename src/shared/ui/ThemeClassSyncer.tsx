"use client";

import {
  LEGACY_THEME_STORAGE_KEY,
  THEME_MODE_STORAGE_KEY,
  applyThemeMode,
  readPersistedThemeMode,
} from "@/lib/theme-mode";
import { useIsomorphicEffect } from "@mantine/hooks";

// Re-applies the `.dark` / `.theme-dark-*` classes on `<html>` after React 19
// strips them during SSR hydration. The inline `themeScript` in `layout.tsx`
// already sets the classes for the first paint, so this component is purely
// the safety net that guarantees the cascade matches the persisted theme from
// the second paint onward.
//
// Mounted inside `<MantineProvider>` so parent layout effects (Mantine's own
// scheme effect) commit first; this effect runs after them and re-asserts
// both `class` and `data-mantine-color-scheme` to converge on the persisted
// mode — Mantine only manages the attribute, not the dark/light classes.
export function ThemeClassSyncer() {
  useIsomorphicEffect(() => {
    applyThemeMode(readPersistedThemeMode());

    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_MODE_STORAGE_KEY || event.key === LEGACY_THEME_STORAGE_KEY) {
        applyThemeMode(readPersistedThemeMode());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
