"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { applyThemeMode, resolveThemeMode, type ThemeMode } from "@/lib/theme-mode";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("light");

  useEffect(() => {
    const resolved = resolveThemeMode();
    setMode(resolved);
    applyThemeMode(resolved);
  }, []);

  function toggle() {
    const next: ThemeMode = mode === "light" ? "dark-gray" : "light";
    setMode(next);
    applyThemeMode(next);
  }

  const isDark = mode !== "light";

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-md bg-surface-1 p-2 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
