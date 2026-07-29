"use client";

import { Button, NumberInput, Switch } from "@mantine/core";
import { Bell, Languages, Palette } from "lucide-react";
import { useMemo, useState } from "react";
import { DirectDaemonToggle } from "@/components/preferences/DirectDaemonToggle";
import { PreferencesSidePanel } from "@/components/panels/PreferencesSidePanel";
import { RowSegmented } from "@/components/ui/form";
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
  // Read from localStorage / Notification API lazily so the first render
  // already reflects the user's stored prefs — no effect, no extra render.
  // typeof window guards SSR; the lazy initializer runs after hydration on
  // the client, where the browser APIs are available.
  const [securityLock, setSecurityLock] = useState<boolean>(() =>
    typeof window === "undefined" ? false : getSecurityLockEnabled(localStorage),
  );
  const [securityLockMinutes, setSecurityLockMinutes] = useState<number>(() =>
    typeof window === "undefined" ? 10 : getSecurityLockTimeoutMinutes(localStorage),
  );
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() =>
    typeof window === "undefined" || !notificationsSupported()
      ? "unsupported"
      : Notification.permission,
  );
  const [notificationStatus, setNotificationStatus] = useState("");
  const [notificationPreview, setNotificationPreview] = useState("");

  // Memoize to avoid creating a new JSX value on every render, which would
  // re-enter useSidePanel → setContent → parent re-render → page re-render
  // and trigger a "Maximum update depth exceeded" loop.
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

  async function _simulateNotification() {
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
      </section>

      {/* Language Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.language")}</h2>
        <RowSegmented
          icon={Languages}
          value={locale}
          onChange={setLocale}
          options={[
            { value: "ja", label: t("settings.languageJa") },
            { value: "en", label: t("settings.languageEn") },
          ]}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Notifications</h2>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-foreground-muted" />
            <div>
              <p className="text-sm font-semibold text-foreground">Browser notifications</p>
              <p className="mt-1 text-xs text-foreground-muted">Status: {notificationPermission}</p>
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
            <Button component="button" onClick={requestNotifications}>
              Allow
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Security Lock</h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Require device unlock</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Default is off. Turn on to require device unlock on launch. Uses this browser&apos;s
              platform authenticator.
            </p>
          </div>
          <Switch
            checked={securityLock}
            onChange={(e) => updateSecurityLock(e.currentTarget.checked)}
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-foreground-muted">Lock after leaving for</p>
          <div className="flex items-center gap-2">
            <NumberInput
              value={securityLockMinutes}
              min={0}
              max={240}
              size="xs"
              suffix={" min"}
              onChange={(value) => {
                const val = Math.max(0, Number(value) || 0);
                updateSecurityLockMinutes(val);
              }}
              data-testid="tasks-duration-num"
            />
          </div>
        </div>
      </section>

      {/* Network Settings */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.network")}</h2>
        <DirectDaemonToggle />
      </section>
    </div>
  );
}
