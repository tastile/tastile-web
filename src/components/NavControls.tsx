"use client";

import { ActionIcon } from "@mantine/core";
import { Moon, Sun } from "lucide-react";
import { type Theme, useThemeStore } from "@/lib/stores/theme-store";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  function toggle() {
    const next: Theme = theme === "light" ? "gray" : "light";
    setTheme(next);
  }

  const isDark = theme !== "light";

  return (
    <ActionIcon
      type="button"
      onClick={toggle}
      className="rounded-md bg-surface-1 p-2 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      aria-label="Toggle theme"
      variant="subtle"
      size="sm"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </ActionIcon>
  );
}
