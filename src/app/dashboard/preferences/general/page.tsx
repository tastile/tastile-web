"use client";

import { Bell, Languages, Palette } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PreferencesSidePanel } from "@/components/panels/PreferencesSidePanel";
import { FormPanel, RowSegmented } from "@/components/ui/form";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  notificationsSupported,
  requestNotificationPermissionOnce,
  showNotification,
} from "@/lib/notifications/browser";
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
  const [securityLock, setSecurityLock] = useState(false);
  const [securityLockMinutes, setSecurityLockMinutes] = useState(10);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationPreview, setNotificationPreview] = useState("");
  useEffect(() => {
    setSecurityLock(getSecurityLockEnabled(localStorage));
    setSecurityLockMinutes(getSecurityLockTimeoutMinutes(localStorage));
    setNotificationPermission(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  // メモ化しないと毎レンダーで新規 JSX が作られ useSidePanel → setContent
  // → 親再描画 → ページ再描画のループが "Maximum update depth exceeded"
  // を起こす
  const sidePanel = useMemo(() => <PreferencesSidePanel />, []);
  useSidePanel(sidePanel);

  function updateSecurityLock(enabled: boolean) {
    setSecurityLock(enabled);
    setSecurityLockEnabled(localStorage, enabled);
  }

  function updateSecurityLockMinutes(minutes: number) {
    const normalized = Math.min(Math.max(minutes, 1), 240);
    setSecurityLockMinutes(normalized);
    setSecurityLockTimeoutMinutes(localStorage, normalized);
  }

  async function requestNotifications() {
    const permission = await requestNotificationPermissionOnce();
    setNotificationPermission(permission);
    setNotificationStatus(
      permission === "granted"
        ? "Notifications are enabled."
        : permission === "denied"
          ? "Notifications are blocked by this browser."
          : "Notification permission is still pending.",
    );
  }

  async function simulateNotification() {
    const preview = "This is a test notification from Tastile.";
    setNotificationPreview(preview);
    const permission =
      notificationPermission === "default"
        ? await requestNotificationPermissionOnce()
        : notificationPermission;
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setNotificationStatus(
        permission === "denied"
          ? "Browser notifications are blocked. Showing a local preview instead."
          : "This browser does not support notifications here. Showing a local preview instead.",
      );
      return;
    }
    showNotification({
      kind: "prompt_pending",
      title: "Tastile",
      body: preview,
      tag: `settings-test-${Date.now()}`,
    });
    setNotificationStatus("Sent a test notification.");
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
        <h2 className="mb-4 text-lg font-semibold text-foreground">Notifications</h2>
        <div className="border border-border bg-surface-0 rounded-md p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <Bell className="mt-0.5 h-5 w-5 shrink-0 text-foreground-muted" />
              <div>
                <p className="text-sm font-semibold text-foreground">Browser notifications</p>
                <p className="mt-1 text-xs text-foreground-muted">
                  Status: {notificationPermission}
                </p>
                {notificationStatus ? (
                  <p className="mt-2 text-xs text-foreground-muted">{notificationStatus}</p>
                ) : null}
                {notificationPreview ? (
                  <div className="mt-3 rounded-md border border-border bg-surface-1 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground">Tastile</p>
                    <p className="mt-1 text-xs text-foreground-muted">{notificationPreview}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={requestNotifications}
                className="rounded-lg bg-surface-3 px-3 py-2 text-sm font-semibold text-foreground"
              >
                Allow
              </button>
              <button
                type="button"
                onClick={simulateNotification}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg"
              >
                Test
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Security Lock</h2>
        <div className="border border-border bg-surface-0 rounded-md p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Require device unlock</p>
              <p className="mt-1 text-xs text-foreground-muted">
                Default is off. Turn on to require device unlock on launch. Uses this browser&apos;s
                platform authenticator.
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
