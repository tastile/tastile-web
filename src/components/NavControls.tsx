"use client";

import { ChevronDown, Globe, Moon, Sun } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { applyThemeMode, resolveThemeMode, type ThemeMode } from "@/lib/theme-mode";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(() => resolveThemeMode());

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

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

export function LanguageToggle() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get("lang") || "ja";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function switchLang(newLang: string) {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (newLang === "ja") {
      params.delete("lang");
    } else {
      params.set("lang", newLang);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-md bg-surface-1 px-2 py-2 text-sm text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        aria-label="Switch language"
      >
        <Globe size={16} />
        <span className="text-xs font-medium">{lang === "en" ? "EN" : "JP"}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg bg-surface-elevated py-1">
          <button
            type="button"
            onClick={() => switchLang("ja")}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${
              lang === "ja" ? "font-medium text-foreground" : "text-foreground-muted"
            }`}
          >
            日本語
          </button>
          <button
            type="button"
            onClick={() => switchLang("en")}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-2 ${
              lang === "en" ? "font-medium text-foreground" : "text-foreground-muted"
            }`}
          >
            English
          </button>
        </div>
      )}
    </div>
  );
}
