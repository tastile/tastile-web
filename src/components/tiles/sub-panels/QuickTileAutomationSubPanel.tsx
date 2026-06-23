"use client";

import { Globe, Zap } from "lucide-react";
import { FormPanel, FormRow } from "@/components/ui/form";
import { SubPanelHeader } from "./SubPanelHeader";

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
      <SubPanelHeader
        onBack={onBack}
        onClose={onClose}
        title={t("quickCreate.automationNavTitle")}
        locale={locale}
        t={t}
      />
      <div className="flex-1 overflow-y-auto">
        <FormPanel>
          <FormRow icon={<Zap size={20} />}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="automation-prompt-on-start"
                className={`flex flex-1 cursor-pointer items-center text-sm ${promptOnStart ? "text-foreground" : "text-foreground-muted"}`}
              >
                <span>{t("quickCreate.promptOnStartTitle")}</span>
              </label>
              <input
                id="automation-prompt-on-start"
                type="checkbox"
                checked={promptOnStart}
                onChange={(e) => setPromptOnStart(e.target.checked)}
                aria-label={t("quickCreate.promptOnStartTitle")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          </FormRow>
          <FormRow icon={<Zap size={20} />}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="automation-prompt-on-end"
                className={`flex flex-1 cursor-pointer items-center text-sm ${promptOnEnd ? "text-foreground" : "text-foreground-muted"}`}
              >
                <span>{t("quickCreate.promptOnEndTitle")}</span>
              </label>
              <input
                id="automation-prompt-on-end"
                type="checkbox"
                checked={promptOnEnd}
                onChange={(e) => setPromptOnEnd(e.target.checked)}
                aria-label={t("quickCreate.promptOnEndTitle")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          </FormRow>
          <FormRow icon={<Zap size={20} />}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="automation-auto-start-allowed"
                className={`flex flex-1 cursor-pointer items-center text-sm ${autoStartAllowed ? "text-foreground" : "text-foreground-muted"}`}
              >
                <span>{t("quickCreate.autoStartAllowedTitle")}</span>
              </label>
              <input
                id="automation-auto-start-allowed"
                type="checkbox"
                checked={autoStartAllowed}
                onChange={(e) => setAutoStartAllowed(e.target.checked)}
                aria-label={t("quickCreate.autoStartAllowedTitle")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          </FormRow>
          <FormRow icon={<Zap size={20} />}>
            <div className="flex w-full items-center justify-between">
              <label
                htmlFor="automation-auto-end-allowed"
                className={`flex flex-1 cursor-pointer items-center text-sm ${autoEndAllowed ? "text-foreground" : "text-foreground-muted"}`}
              >
                <span>{t("quickCreate.autoEndAllowedTitle")}</span>
              </label>
              <input
                id="automation-auto-end-allowed"
                type="checkbox"
                checked={autoEndAllowed}
                onChange={(e) => setAutoEndAllowed(e.target.checked)}
                aria-label={t("quickCreate.autoEndAllowedTitle")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>
          </FormRow>

          <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.timezoneTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("quickCreate.timezoneGuide")}
          </p>
          <FormRow icon={<Globe size={20} />}>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              aria-label={t("quickCreate.timezoneTitle")}
              className="w-full bg-transparent text-sm text-foreground focus:outline-hidden"
            >
              <option value="">{t("quickCreate.timezoneAuto")}</option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </FormRow>
        </FormPanel>
      </div>
    </>
  );
}
