"use client";

import { Clock, Repeat } from "lucide-react";
import type { ObjectiveMode } from "@/lib/domain/tile";
import { FormPanel, FormRow, RowInput, RowSegmented } from "@/components/ui/form";
import { SubPanelHeader } from "./SubPanelHeader";
import {
  parseNonNegativeInt,
  sanitizeNumericInput,
  type RecurrenceFrequency,
} from "../build-command";

const WEEKDAY_LABELS: Record<"ja" | "en", string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const FREQ_OPTIONS: RecurrenceFrequency[] = ["daily", "weekly", "monthly"];

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  objectiveMode: ObjectiveMode;
  setObjectiveMode: (mode: ObjectiveMode) => void;
  isRecurring: boolean;
  showFocusUntilEnd: boolean;
  recurrenceFrequency: RecurrenceFrequency;
  setRecurrenceFrequency: (f: RecurrenceFrequency) => void;
  recurrenceIntervalInput: string;
  setRecurrenceIntervalInput: (v: string) => void;
  recurrenceWeekdays: number[];
  setRecurrenceWeekdays: (w: number[]) => void;
  recurrenceUseStartAt: boolean;
  setRecurrenceUseStartAt: (v: boolean) => void;
  recurrenceUseEndAt: boolean;
  setRecurrenceUseEndAt: (v: boolean) => void;
  recurrenceStartTimeInput: string;
  setRecurrenceStartTimeInput: (v: string) => void;
  recurrenceEndTimeInput: string;
  setRecurrenceEndTimeInput: (v: string) => void;
  recurrenceValidFromEnabled: boolean;
  setRecurrenceValidFromEnabled: (v: boolean) => void;
  recurrenceValidToEnabled: boolean;
  setRecurrenceValidToEnabled: (v: boolean) => void;
  recurrenceValidFromDateInput: string;
  setRecurrenceValidFromDateInput: (v: string) => void;
  recurrenceValidToDateInput: string;
  setRecurrenceValidToDateInput: (v: string) => void;
}

export function QuickTileRecurrenceSubPanel({
  onBack,
  onClose,
  t,
  locale,
  objectiveMode,
  setObjectiveMode,
  isRecurring,
  showFocusUntilEnd,
  recurrenceFrequency,
  setRecurrenceFrequency,
  recurrenceIntervalInput,
  setRecurrenceIntervalInput,
  recurrenceWeekdays,
  setRecurrenceWeekdays,
  recurrenceUseStartAt,
  setRecurrenceUseStartAt,
  recurrenceUseEndAt,
  setRecurrenceUseEndAt,
  recurrenceStartTimeInput,
  setRecurrenceStartTimeInput,
  recurrenceEndTimeInput,
  setRecurrenceEndTimeInput,
  recurrenceValidFromEnabled,
  setRecurrenceValidFromEnabled,
  recurrenceValidToEnabled,
  setRecurrenceValidToEnabled,
  recurrenceValidFromDateInput,
  setRecurrenceValidFromDateInput,
  recurrenceValidToDateInput,
  setRecurrenceValidToDateInput,
}: Props) {
  return (
    <>
      <SubPanelHeader
        onBack={onBack}
        onClose={onClose}
        title={t("quickCreate.recurrenceNavTitle")}
        locale={locale}
        t={t}
      />
      <div className="flex-1 overflow-y-auto">
        <FormPanel>
          <RowSegmented
            icon={Repeat}
            options={[
              { value: "finish_once", label: t("quickCreate.objectiveFinish") },
              { value: "recurring", label: t("quickCreate.objectiveRecurring") },
              ...(showFocusUntilEnd
                ? [{ value: "maximize_within_interval", label: t("quickCreate.objectiveMaximize") }]
                : []),
            ]}
            value={objectiveMode}
            onChange={(v) => setObjectiveMode(v as ObjectiveMode)}
          />

          {isRecurring ? (
            <>
              <h3 className="mt-2 mb-2 text-sm font-medium text-foreground">
                {t("quickCreate.recurrenceTitle")}
              </h3>
              <p className="mb-2 text-xs text-foreground-muted">
                {t("quickCreate.recurrenceGuide")}
              </p>
              <RowSegmented
                icon={Repeat}
                options={FREQ_OPTIONS.map((freq) => ({
                  value: freq,
                  label: t(
                    `quickCreate.recurrenceFreq${freq.charAt(0).toUpperCase()}${freq.slice(1)}`,
                  ),
                }))}
                value={recurrenceFrequency}
                onChange={(v) => setRecurrenceFrequency(v as RecurrenceFrequency)}
              />
              <label className="mt-2 block space-y-1">
                <span className="text-xs text-foreground-muted">
                  {t("quickCreate.recurrenceInterval")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={recurrenceIntervalInput}
                  onChange={(e) =>
                    setRecurrenceIntervalInput(sanitizeNumericInput(e.target.value))
                  }
                  onBlur={() => {
                    const n = parseNonNegativeInt(recurrenceIntervalInput) ?? 0;
                    if (n <= 0) setRecurrenceIntervalInput("1");
                  }}
                  className="w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>

              <div
                role="group"
                aria-label={t("quickCreate.recurrenceTitle")}
                className="flex w-full rounded-md bg-surface-2 p-0.5"
              >
                {WEEKDAY_LABELS[locale].map((label, idx) => {
                  const active = recurrenceWeekdays.includes(idx);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() =>
                        setRecurrenceWeekdays(
                          active
                            ? recurrenceWeekdays.filter((d) => d !== idx)
                            : [...recurrenceWeekdays, idx],
                        )
                      }
                      aria-pressed={active}
                      className={
                        active
                          ? "flex-1 rounded-sm bg-primary px-2 py-1.5 text-xs text-primary-fg shadow-sm"
                          : "flex-1 rounded-sm px-2 py-1.5 text-xs text-foreground-muted hover:text-foreground"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-window-start"
                    className={`flex flex-1 cursor-pointer items-center text-sm ${recurrenceUseStartAt ? "text-foreground" : "text-foreground-muted"}`}
                  >
                    <span>{t("quickCreate.windowStartAt")}</span>
                  </label>
                  <input
                    id="recurrence-window-start"
                    type="checkbox"
                    checked={recurrenceUseStartAt}
                    onChange={(e) => setRecurrenceUseStartAt(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceUseStartAt ? (
                <div className="relative ml-3 border-l border-border pl-3">
                  <RowInput
                    icon={Clock}
                    type="time"
                    placeholder={t("quickCreate.windowStartAt")}
                    value={recurrenceStartTimeInput}
                    onChange={(value) => setRecurrenceStartTimeInput(value)}
                    ariaLabel={t("quickCreate.windowStartAt")}
                  />
                </div>
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-window-end"
                    className={`flex flex-1 cursor-pointer items-center text-sm ${recurrenceUseEndAt ? "text-foreground" : "text-foreground-muted"}`}
                  >
                    <span>{t("quickCreate.windowEndAt")}</span>
                  </label>
                  <input
                    id="recurrence-window-end"
                    type="checkbox"
                    checked={recurrenceUseEndAt}
                    onChange={(e) => setRecurrenceUseEndAt(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceUseEndAt ? (
                <div className="relative ml-3 border-l border-border pl-3">
                  <RowInput
                    icon={Clock}
                    type="time"
                    placeholder={t("quickCreate.windowEndAt")}
                    value={recurrenceEndTimeInput}
                    onChange={(value) => setRecurrenceEndTimeInput(value)}
                    ariaLabel={t("quickCreate.windowEndAt")}
                  />
                </div>
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-valid-from"
                    className={`flex flex-1 cursor-pointer items-center text-sm ${recurrenceValidFromEnabled ? "text-foreground" : "text-foreground-muted"}`}
                  >
                    <span>{t("quickCreate.recurrenceValidFrom")}</span>
                  </label>
                  <input
                    id="recurrence-valid-from"
                    type="checkbox"
                    checked={recurrenceValidFromEnabled}
                    onChange={(e) => setRecurrenceValidFromEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceValidFromEnabled ? (
                <div className="relative ml-3 border-l border-border pl-3">
                  <RowInput
                    icon={Clock}
                    type="date"
                    placeholder={t("quickCreate.recurrenceValidFrom")}
                    value={recurrenceValidFromDateInput}
                    onChange={(value) => setRecurrenceValidFromDateInput(value)}
                    ariaLabel={t("quickCreate.recurrenceValidFrom")}
                  />
                </div>
              ) : null}

              <FormRow icon={<Clock size={20} />}>
                <div className="flex w-full items-center justify-between">
                  <label
                    htmlFor="recurrence-valid-to"
                    className={`flex flex-1 cursor-pointer items-center text-sm ${recurrenceValidToEnabled ? "text-foreground" : "text-foreground-muted"}`}
                  >
                    <span>{t("quickCreate.recurrenceValidTo")}</span>
                  </label>
                  <input
                    id="recurrence-valid-to"
                    type="checkbox"
                    checked={recurrenceValidToEnabled}
                    onChange={(e) => setRecurrenceValidToEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </div>
              </FormRow>
              {recurrenceValidToEnabled ? (
                <div className="relative ml-3 border-l border-border pl-3">
                  <RowInput
                    icon={Clock}
                    type="date"
                    placeholder={t("quickCreate.recurrenceValidTo")}
                    value={recurrenceValidToDateInput}
                    onChange={(value) => setRecurrenceValidToDateInput(value)}
                    ariaLabel={t("quickCreate.recurrenceValidTo")}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </FormPanel>
      </div>
    </>
  );
}
