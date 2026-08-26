"use client";

import { DirectDaemonToggle } from "@/features/manage-settings/ui/DirectDaemonToggle";
import { PreferencesSidePanel } from "@/features/manage-settings/ui/PreferencesSidePanel";
import {
  notificationsSupported,
  requestNotificationPermissionOnce,
  showNotification,
} from "@/lib/notifications/browser";
import {
  getEnabled,
  getTimeoutMinutes,
  setEnabled,
  setTimeoutMinutes,
} from "@/lib/security/security-lock-policy";
import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useLocaleStore } from "@/shared/stores/locale-store";
import { useThemeStore } from "@/shared/stores/theme-store";
import { type WeekStartDay, useWeekStartStore } from "@/shared/stores/week-start-store";
import { RowSegmented } from "@/shared/ui/form";
import { Button, NumberInput, Select, Switch } from "@mantine/core";
import { Bell, CalendarDays, Languages, Palette } from "lucide-react";
import { Suspense, useMemo, useState } from "react";

export default function GeneralPreferences() {
  const { theme, setTheme } = useThemeStore();
  const { locale, setLocale } = useLocaleStore();
  const { weekStart, setWeekStart } = useWeekStartStore();
  const { t } = useTranslation();
  const [securityLock, setSecurityLock] = useState<boolean>(() =>
    typeof window === "undefined" ? false : getEnabled(localStorage),
  );
  const [securityLockMinutes, setSecurityLockMinutes] = useState<number>(() =>
    typeof window === "undefined" ? 10 : getTimeoutMinutes(localStorage),
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

  const sidePanel = useMemo(
    () => (
      <Suspense>
        <PreferencesSidePanel />
      </Suspense>
    ),
    [],
  );
  useSidePanel(sidePanel);

  function updateSecurityLock(enabled: boolean) {
    setSecurityLock(enabled);
    setEnabled(localStorage, enabled);
  }

  function updateSecurityLockMinutes(minutes: number) {
    const normalized = Math.min(Math.max(minutes, 1), 240);
    setSecurityLockMinutes(normalized);
    setTimeoutMinutes(localStorage, normalized);
  }

  async function requestNotifications() {
    const permission = await requestNotificationPermissionOnce();
    setNotificationPermission(permission);
    setNotificationStatus(
      permission === "granted"
        ? t("preferences.notifications.allowed")
        : permission === "denied"
          ? t("preferences.notifications.blocked")
          : t("preferences.notifications.pending"),
    );
  }

  async function _simulateNotification() {
    const preview = t("preferences.notifications.testBody");
    setNotificationPreview(preview);
    const permission =
      notificationPermission === "default"
        ? await requestNotificationPermissionOnce()
        : notificationPermission;
    setNotificationPermission(permission);
    if (permission !== "granted") {
      setNotificationStatus(
        permission === "denied"
          ? t("preferences.notifications.blockedHelp")
          : t("preferences.notifications.unsupportedHelp"),
      );
      return;
    }
    showNotification({
      kind: "prompt_pending",
      title: t("preferences.notifications.previewTitle"),
      body: preview,
      tag: `settings-test-${Date.now()}`,
    });
    setNotificationStatus(t("preferences.notifications.sent"));
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-6 sm:p-8">
      <h1 className="text-2xl font-normal text-foreground">{t("preferences.heading")}</h1>

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

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.language")}</h2>
        <div className="flex items-center gap-3">
          <Languages className="size-5 shrink-0 text-foreground-muted" />
          <Select
            className="min-w-[14rem] flex-1"
            data={[
              { value: "ja", label: t("language.ja") },
              { value: "en", label: t("language.en") },
              { value: "zh-CN", label: t("language.zh-CN") },
              { value: "ko", label: t("language.ko") },
              { value: "es", label: t("language.es") },
            ]}
            value={locale}
            onChange={(value) => {
              if (value) setLocale(value as typeof locale);
            }}
            allowDeselect={false}
            checkIconPosition="right"
            aria-label={t("settings.language")}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.weekStart")}</h2>
        <RowSegmented
          icon={CalendarDays}
          value={weekStart}
          onChange={(v) => setWeekStart(v as WeekStartDay)}
          options={[
            { value: "sunday", label: t("settings.weekStartSunday") },
            { value: "monday", label: t("settings.weekStartMonday") },
          ]}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t("preferences.notifications.heading")}
        </h2>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <Bell className="mt-0.5 size-5 shrink-0 text-foreground-muted" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("preferences.notifications.browser")}
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                {t("preferences.notifications.statusLabel", { permission: notificationPermission })}
              </p>
              {notificationStatus ? (
                <p className="mt-2 text-xs text-foreground-muted">{notificationStatus}</p>
              ) : null}
              {notificationPreview ? (
                <div className="mt-3 rounded-md border border-border bg-surface-1 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">
                    {t("preferences.notifications.previewTitle")}
                  </p>
                  <p className="mt-1 text-xs text-foreground-muted">{notificationPreview}</p>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button component="button" onClick={requestNotifications}>
              {t("preferences.notifications.allow")}
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t("preferences.securityLock.heading")}
        </h2>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("preferences.securityLock.require")}
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              {t("preferences.securityLock.helpText")}
            </p>
          </div>
          <Switch
            checked={securityLock}
            onChange={(e) => updateSecurityLock(e.currentTarget.checked)}
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-foreground-muted">{t("preferences.securityLock.lockAfterLeavingFor")}</p>
          <div className="flex items-center gap-2">
            <NumberInput
              value={securityLockMinutes}
              min={0}
              max={240}
              size="xs"
              suffix={` ${t("preferences.securityLock.minutesSuffix")}`}
              onChange={(value) => {
                const val = Math.max(0, Number(value) || 0);
                updateSecurityLockMinutes(val);
              }}
              data-testid="tasks-duration-num"
            />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-foreground">{t("settings.network")}</h2>
        <DirectDaemonToggle />
      </section>
    </div>
  );
}
