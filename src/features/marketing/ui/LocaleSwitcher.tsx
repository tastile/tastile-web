"use client";

import {
  LOCALE_COOKIE,
  localeCookieAttributes,
} from "@/shared/i18n/locale-cookie";
import type { Locale } from "@/shared/stores/locale-store";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Native-script labels so each option reads naturally to speakers of that
// language — the row matches the rikyu.ai footer "Language" pattern where
// each locale names itself.
const LOCALES: ReadonlyArray<{ code: Locale; label: string }> = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
  { code: "zh-CN", label: "中文" },
  { code: "ko", label: "한국어" },
  { code: "es", label: "Español" },
];

interface LocaleSwitcherProps {
  currentLocale: Locale;
  label: string;
}

export function LocaleSwitcher({ currentLocale, label }: LocaleSwitcherProps) {
  const pathname = usePathname() ?? "/";

  function handleSelect(locale: Locale): void {
    // Persist the choice so subsequent navigations default to it. The
    // server-side resolver reads this cookie ahead of Accept-Language, so
    // a returning visitor lands on their saved locale even on a cold load.
    document.cookie = `${LOCALE_COOKIE}=${locale}; ${localeCookieAttributes()}`;
  }

  function buildHref(locale: Locale): string {
    return `${pathname}?lang=${encodeURIComponent(locale)}`;
  }

  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wider text-foreground-subtle">
        {label}
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {LOCALES.map(({ code, label: name }) => {
          const active = code === currentLocale;
          return (
            <li key={code}>
              <Link
                href={buildHref(code)}
                onClick={() => handleSelect(code)}
                aria-current={active ? "true" : undefined}
                className={
                  active
                    ? "font-semibold text-foreground"
                    : "text-foreground-muted hover:text-foreground"
                }
              >
                {name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
