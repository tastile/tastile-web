"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getSecurityLockEnabled,
  getSecurityLockTimeoutMinutes,
  setSecurityLockEnabled,
  setSecurityLockTimeoutMinutes,
} from "@/lib/security/security-lock-policy";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useThemeStore } from "@/lib/stores/theme-store";

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const { t } = useTranslation();
  const [securityLock, setSecurityLock] = useState(() =>
    typeof window !== "undefined" ? getSecurityLockEnabled(localStorage) : true,
  );
  const [securityLockMinutes, setSecurityLockMinutes] = useState(() =>
    typeof window !== "undefined" ? getSecurityLockTimeoutMinutes(localStorage) : 10,
  );

  function updateSecurityLock(enabled: boolean) {
    setSecurityLock(enabled);
    setSecurityLockEnabled(localStorage, enabled);
  }

  function updateSecurityLockMinutes(minutes: number) {
    const normalized = Math.min(Math.max(minutes, 1), 240);
    setSecurityLockMinutes(normalized);
    setSecurityLockTimeoutMinutes(localStorage, normalized);
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>

      {/* Theme Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.theme")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ThemeButton
            active={theme === "light"}
            onClick={() => setTheme("light")}
            label={t("settings.themeLight")}
            description="White background"
          />
          <ThemeButton
            active={theme === "gray"}
            onClick={() => setTheme("gray")}
            label={t("settings.themeGray")}
            description="Gray background"
          />
          <ThemeButton
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            label={t("settings.themeDark")}
            description="Dark background"
          />
        </div>
      </section>

      {/* Language Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.language")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <LanguageButton
            active={locale === "ja"}
            onClick={() => setLocale("ja")}
            label={t("settings.languageJa")}
          />
          <LanguageButton
            active={locale === "en"}
            onClick={() => setLocale("en")}
            label={t("settings.languageEn")}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Security Lock</h2>
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Require device unlock</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Default is on. Uses this browser&apos;s platform authenticator.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateSecurityLock(!securityLock)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${securityLock ? "bg-primary text-primary-fg" : "bg-surface-3 text-foreground"}`}
            >
              {securityLock ? "On" : "Off"}
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-foreground-muted">Lock after leaving for</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateSecurityLockMinutes(securityLockMinutes - 5)}
                className="rounded-lg bg-surface-3 px-3 py-2 text-sm text-foreground"
              >
                -5
              </button>
              <span className="min-w-16 text-center text-sm font-semibold text-foreground">
                {securityLockMinutes} min
              </span>
              <button
                type="button"
                onClick={() => updateSecurityLockMinutes(securityLockMinutes + 5)}
                className="rounded-lg bg-surface-3 px-3 py-2 text-sm text-foreground"
              >
                +5
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface ThemeButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}

function ThemeButton({ active, onClick, label, description }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-4 text-left ${
        active ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground hover:bg-surface-3"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs opacity-80">{description}</p>
    </button>
  );
}

interface LanguageButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
}

function LanguageButton({ active, onClick, label }: LanguageButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-5 py-4 text-left ${
        active ? "bg-primary text-primary-fg" : "bg-surface-2 text-foreground hover:bg-surface-3"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
    </button>
  );
}
