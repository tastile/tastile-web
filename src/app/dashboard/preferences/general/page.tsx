"use client";

import { Languages, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { PreferencesSidePanel } from "@/components/panels/PreferencesSidePanel";
import { FormPanel, RowSegmented } from "@/components/ui/form";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getSecurityLockEnabled,
  getSecurityLockTimeoutMinutes,
  setSecurityLockEnabled,
  setSecurityLockTimeoutMinutes,
} from "@/lib/security/security-lock-policy";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useThemeStore } from "@/lib/stores/theme-store";

export default function GeneralPage() {
  const { theme, setTheme } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const { t } = useTranslation();
  // SSR-safe defaults so server and first client render agree;
  // localStorage is read once after mount.
  const [securityLock, setSecurityLock] = useState(true);
  const [securityLockMinutes, setSecurityLockMinutes] = useState(10);
  useEffect(() => {
    setSecurityLock(getSecurityLockEnabled(localStorage));
    setSecurityLockMinutes(getSecurityLockTimeoutMinutes(localStorage));
  }, []);

  useSidePanel(<PreferencesSidePanel />);

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
      <h1 className="text-2xl font-normal text-foreground">General Preferences</h1>

      {/* Theme Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.theme")}</h2>
        <FormPanel>
          <RowSegmented
            icon={Palette}
            value={theme}
            onChange={setTheme}
            options={[
              { value: "light", label: t("settings.themeLight") },
              { value: "gray", label: t("settings.themeGray") },
              { value: "dark", label: t("settings.themeDark") },
            ]}
          />
        </FormPanel>
      </section>

      {/* Language Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.language")}</h2>
        <FormPanel>
          <RowSegmented
            icon={Languages}
            value={locale}
            onChange={setLocale}
            options={[
              { value: "ja", label: t("settings.languageJa") },
              { value: "en", label: t("settings.languageEn") },
            ]}
          />
        </FormPanel>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Security Lock</h2>
        <div className="border border-border bg-surface-0 rounded-md p-6">
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
