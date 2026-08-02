"use client";

import { cssVariablesResolver } from "@/lib/theme/css-variables-resolver";
import { mantineTheme } from "@/lib/theme/mantine-theme";
import { ThemeClassSyncer } from "@/shared/ui/ThemeClassSyncer";
import { MantineProvider } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import type { ReactNode } from "react";

/**
 * Client-side provider tree for the dashboard. Wraps the app in
 * `MantineProvider` so Mantine components can resolve their theme and
 * CSS variables. The color-scheme itself is driven by globals.css
 * (the `<html>` class set by `themeScript`), so we do not toggle
 * Mantine's own scheme here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={mantineTheme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="auto"
    >
      <ThemeClassSyncer />
      <DatesProvider settings={{ locale: "en", firstDayOfWeek: 0 }}>{children}</DatesProvider>
    </MantineProvider>
  );
}
