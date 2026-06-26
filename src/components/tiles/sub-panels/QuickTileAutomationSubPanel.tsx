"use client";

import { Globe, Zap } from "lucide-react";
import { FormPanel, FormRow, RowToggle } from "@/components/ui/form";
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
          <RowToggle
            icon={Zap}
            placeholder={t("quickCreate.promptOnStartTitle")}
            checked={promptOnStart}
            onChange={setPromptOnStart}
          />
          <RowToggle
            icon={Zap}
            placeholder={t("quickCreate.promptOnEndTitle")}
            checked={promptOnEnd}
            onChange={setPromptOnEnd}
          />
          <RowToggle
            icon={Zap}
            placeholder={t("quickCreate.autoStartAllowedTitle")}
            checked={autoStartAllowed}
            onChange={setAutoStartAllowed}
          />
          <RowToggle
            icon={Zap}
            placeholder={t("quickCreate.autoEndAllowedTitle")}
            checked={autoEndAllowed}
            onChange={setAutoEndAllowed}
          />

          <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.timezoneTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">{t("quickCreate.timezoneGuide")}</p>
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
