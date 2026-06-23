"use client";

import { ChevronLeft, X } from "lucide-react";

const TIMEZONES: string[] = [
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "UTC",
];

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  promptOnStart: boolean;
  setPromptOnStart: (v: boolean) => void;
  promptOnEnd: boolean;
  setPromptOnEnd: (v: boolean) => void;
  autoStartAllowed: boolean;
  setAutoStartAllowed: (v: boolean) => void;
  autoEndAllowed: boolean;
  setAutoEndAllowed: (v: boolean) => void;
  timezone: string;
  setTimezone: (v: string) => void;
}

export function QuickTileAutomationSubPanel({
  onBack,
  onClose,
  t,
  locale,
  promptOnStart,
  setPromptOnStart,
  promptOnEnd,
  setPromptOnEnd,
  autoStartAllowed,
  setAutoStartAllowed,
  autoEndAllowed,
  setAutoEndAllowed,
  timezone,
  setTimezone,
}: Props) {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("quickCreate.back")}
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {t("quickCreate.automationNavTitle")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-section">
        <div className="space-y-section">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={promptOnStart}
              onChange={(e) => setPromptOnStart(e.target.checked)}
              aria-label={t("quickCreate.promptOnStartTitle")}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>{t("quickCreate.promptOnStartTitle")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={promptOnEnd}
              onChange={(e) => setPromptOnEnd(e.target.checked)}
              aria-label={t("quickCreate.promptOnEndTitle")}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>{t("quickCreate.promptOnEndTitle")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={autoStartAllowed}
              onChange={(e) => setAutoStartAllowed(e.target.checked)}
              aria-label={t("quickCreate.autoStartAllowedTitle")}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>{t("quickCreate.autoStartAllowedTitle")}</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={autoEndAllowed}
              onChange={(e) => setAutoEndAllowed(e.target.checked)}
              aria-label={t("quickCreate.autoEndAllowedTitle")}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>{t("quickCreate.autoEndAllowedTitle")}</span>
          </label>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-foreground" htmlFor="automation-tz">
              {t("quickCreate.timezoneTitle")}
            </label>
            <p className="text-xs text-foreground-muted">{t("quickCreate.timezoneGuide")}</p>
            <select
              id="automation-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label={t("quickCreate.timezoneTitle")}
              className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="">{t("quickCreate.timezoneAuto")}</option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </>
  );
}
